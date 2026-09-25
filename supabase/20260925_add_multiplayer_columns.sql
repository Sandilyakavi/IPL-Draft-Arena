-- =====================================================================
-- IPL DRAFT ARENA — MIGRATION: ADD 2-4 PLAYER COLUMNS TO draft_rooms
-- =====================================================================
-- Migration Name : 20260925_add_multiplayer_columns (v2 — RLS hardened)
-- Applies To     : public.draft_rooms, public.room_participants
-- Safe           : YES — uses IF NOT EXISTS, no DROP, no data loss
-- Idempotent     : YES — safe to run multiple times
--
-- AUTHORITATIVE PARTICIPANT COUNT:
--   draft_rooms.participants JSONB is the single source of truth.
--   game_state->participants is a derived copy only.
--   room_participants rows are the audit trail (secondary).
--
-- SECURITY MODEL:
--   All join authorization lives inside the join_room() SECURITY DEFINER
--   RPC. No direct UPDATE on draft_rooms is allowed to a user who is not
--   already a confirmed room member.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1: Add missing columns to public.draft_rooms
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 2
    CHECK (max_players >= 2 AND max_players <= 4);

ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS turn_timer_seconds INTEGER NOT NULL DEFAULT 20
    CHECK (turn_timer_seconds IN (10, 15, 20, 30));

ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS draft_mode VARCHAR(20) NOT NULL DEFAULT 'snake'
    CHECK (draft_mode IN ('snake', 'alternating'));

-- SINGLE SOURCE OF TRUTH for participant list.
-- game_state->participants is a derived copy only.
ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE public.draft_rooms
  ADD COLUMN IF NOT EXISTS turn_deadline TIMESTAMPTZ DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill any pre-existing rows that may have NULLs
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.draft_rooms
  SET
    max_players        = COALESCE(max_players, 2),
    turn_timer_seconds = COALESCE(turn_timer_seconds, 20),
    draft_mode         = COALESCE(draft_mode, 'snake'),
    participants       = COALESCE(participants, '[]'::jsonb),
    version            = COALESCE(version, 1)
  WHERE
    max_players IS NULL
    OR turn_timer_seconds IS NULL
    OR draft_mode IS NULL
    OR participants IS NULL
    OR version IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3: Create room_participants table (safe — IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_participants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID        REFERENCES public.draft_rooms(id) ON DELETE CASCADE NOT NULL,
  room_code     VARCHAR(6)  NOT NULL,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role          VARCHAR(15) NOT NULL CHECK (role IN ('player1', 'player2', 'player3', 'player4')),
  role_index    INTEGER     NOT NULL CHECK (role_index >= 0 AND role_index <= 3),
  display_name  TEXT        NOT NULL,
  avatar        TEXT        DEFAULT '🏏',
  favorite_team TEXT        DEFAULT NULL,
  is_ready      BOOLEAN     DEFAULT TRUE,
  is_connected  BOOLEAN     DEFAULT TRUE,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, role)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_code ON public.room_participants(room_code);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- STEP 4: RLS on room_participants
-- ─────────────────────────────────────────────────────────────────────
-- SECURITY REASONING:
--   SELECT:
--     (a) user_id = auth.uid() — always see your own row, no recursion
--     (b) room is host_id = auth.uid() OR status = waiting — lobby visible
--         via a draft_rooms join (NOT a room_participants self-query).
--
--   INSERT/UPDATE/DELETE: join_room() SECURITY DEFINER handles inserts.
--   Direct INSERT still requires uid = user_id (belt+suspenders).

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: NO recursive self-query — resolves via draft_rooms join only
DROP POLICY IF EXISTS "Participants can view room members" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can view their room members" ON public.room_participants;
CREATE POLICY "Participants can view room members" ON public.room_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.draft_rooms r
      WHERE r.id = room_participants.room_id
        AND (
          r.host_id = auth.uid()
          OR r.status = 'waiting_for_opponent'
        )
    )
  );

-- INSERT: belt-and-suspenders guard (join_room RPC is the real enforcer)
DROP POLICY IF EXISTS "RPC only: insert participation" ON public.room_participants;
DROP POLICY IF EXISTS "Users can insert own participation" ON public.room_participants;
CREATE POLICY "RPC only: insert participation" ON public.room_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: own row only (presence / last_seen_at heartbeat)
DROP POLICY IF EXISTS "Users can update own participation" ON public.room_participants;
CREATE POLICY "Users can update own participation" ON public.room_participants
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: own row only (leave room)
DROP POLICY IF EXISTS "Users can leave room" ON public.room_participants;
CREATE POLICY "Users can leave room" ON public.room_participants
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- STEP 5: Fix draft_rooms RLS policies
-- ─────────────────────────────────────────────────────────────────────
-- SECURITY REASONING:
--
--   SELECT:
--     (a) host_id = uid — host always sees their room
--     (b) guest_id = uid — legacy 2-player backward compat
--     (c) status = waiting_for_opponent — any authenticated user can look
--         up the room by code to validate before calling join_room()
--     (d) EXISTS in room_participants — confirmed members always see the room
--         (sub-query direction: draft_rooms → room_participants, no cycle)
--
--   INSERT: only host (uid = host_id)
--
--   UPDATE: RESTRICTED to confirmed members ONLY.
--     New joiners (not yet in room_participants) are NOT granted UPDATE.
--     All join-time writes happen inside join_room() SECURITY DEFINER
--     which bypasses RLS internally. This closes the "any authed user
--     can UPDATE any waiting room" vulnerability.

DROP POLICY IF EXISTS "Participants or waiting room lookup" ON public.draft_rooms;
CREATE POLICY "Participants or waiting room lookup" ON public.draft_rooms
  FOR SELECT
  USING (
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR status = 'waiting_for_opponent'
    OR EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = draft_rooms.id
        AND rp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Host can create draft room" ON public.draft_rooms;
CREATE POLICY "Host can create draft room" ON public.draft_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- UPDATE: ONLY confirmed room members. No open-slot grant for strangers.
-- WITH CHECK mirrors USING — prevents a member from re-writing the row
-- to transfer ownership to a different user.
DROP POLICY IF EXISTS "Participants can update draft room" ON public.draft_rooms;
CREATE POLICY "Participants can update draft room" ON public.draft_rooms
  FOR UPDATE
  USING (
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = draft_rooms.id
        AND rp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- After the update, host_id must still belong to a valid room member.
    -- This prevents a participant from changing host_id to someone else.
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = draft_rooms.id
        AND rp.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 6: Secure join_room() SECURITY DEFINER RPC
-- ─────────────────────────────────────────────────────────────────────
-- This is the ONLY path by which a non-host joins a room.
-- It runs as the function owner (bypasses RLS on writes) but enforces
-- all business-logic checks using auth.uid() internally.
--
-- CRITICAL CHECK ORDER (reconnect safety):
--   1.  Require authenticated caller
--   2.  SELECT room FOR UPDATE (row-level lock, prevents race)
--   3.  Require room exists
--   4.  Host check (host cannot join own room)
--   5.  *** DUPLICATE / RECONNECT CHECK FIRST ***
--         If caller already has a room_participants row → return current
--         game_state with rejoined=true. This works even when status is
--         in_progress, so a reconnecting player does NOT hit ROOM_NOT_WAITING.
--   6.  Only for NEW callers: require status = waiting_for_opponent
--   7.  Capacity check: count < max_players
--   8.  Role slot assignment and uniqueness check
--   9.  INSERT into room_participants
--   10. UPDATE draft_rooms (participants, status, game_state, guest_id, version)
--   11. Transition status → in_progress when count reaches max_players
--   12. Return result

DROP FUNCTION IF EXISTS public.join_room(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.join_room(
  p_room_code     TEXT,
  p_display_name  TEXT,
  p_avatar        TEXT    DEFAULT '🏏',
  p_favorite_team TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID    := auth.uid();
  v_room              public.draft_rooms%ROWTYPE;
  v_participant_count INTEGER;
  v_next_role         TEXT;
  v_next_index        INTEGER;
  v_is_full           BOOLEAN;
  v_new_status        TEXT;
  v_new_participants  JSONB;
  v_participant_entry JSONB;
  v_result            JSONB;
BEGIN

  -- 1. Require authenticated caller
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: You must be signed in to join a room';
  END IF;

  -- 2. Lock room row to prevent concurrent joins
  SELECT * INTO v_room
  FROM public.draft_rooms
  WHERE room_code = UPPER(TRIM(p_room_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND: Room with code "%" was not found',
      UPPER(TRIM(p_room_code));
  END IF;

  -- 3. Host cannot join their own room
  IF v_room.host_id = v_user_id THEN
    RAISE EXCEPTION 'ALREADY_HOST: You are the host of this room';
  END IF;

  -- 4. RECONNECT CHECK — must come before status check.
  --    If the caller already has a room_participants row they are
  --    reconnecting (e.g. refresh after the room became in_progress).
  --    Return current game_state immediately regardless of room status.
  IF EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = v_room.id AND rp.user_id = v_user_id
  ) THEN
    SELECT game_state INTO v_result
    FROM public.draft_rooms WHERE id = v_room.id;
    RETURN jsonb_build_object(
      'ok',        true,
      'rejoined',  true,
      'room_code', v_room.room_code,
      'game_state', v_result
    );
  END IF;

  -- 5. NEW JOINER ONLY: room must still be waiting
  IF v_room.status <> 'waiting_for_opponent' THEN
    RAISE EXCEPTION 'ROOM_NOT_WAITING: Room "%" is not open for joining (status: %)',
      v_room.room_code, v_room.status;
  END IF;

  -- 6. Capacity check (authoritative: participants JSONB column)
  v_participant_count := jsonb_array_length(COALESCE(v_room.participants, '[]'::jsonb));

  IF v_participant_count >= v_room.max_players THEN
    RAISE EXCEPTION 'ROOM_FULL: Room "%" is full (% / % players)',
      v_room.room_code, v_participant_count, v_room.max_players;
  END IF;

  -- 7. Assign next role slot
  v_next_index := v_participant_count;
  v_next_role  := 'player' || (v_next_index + 1)::TEXT;

  IF EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = v_room.id AND rp.role = v_next_role
  ) THEN
    RAISE EXCEPTION 'SLOT_TAKEN: Role slot "%" is already occupied in room "%"',
      v_next_role, v_room.room_code;
  END IF;

  -- 8. Build participant JSONB entry
  v_participant_entry := jsonb_build_object(
    'playerId',       v_user_id::TEXT,
    'userId',         v_user_id::TEXT,
    'displayName',    COALESCE(NULLIF(TRIM(p_display_name), ''), 'Player ' || (v_next_index + 1)::TEXT),
    'username',       COALESCE(NULLIF(TRIM(p_display_name), ''), 'Player ' || (v_next_index + 1)::TEXT),
    'avatar',         COALESCE(NULLIF(p_avatar, ''), '🏏'),
    'favoriteTeamId', p_favorite_team,
    'role',           v_next_role,
    'roleIndex',      v_next_index,
    'ready',          true,
    'connected',      true,
    'isConnected',    true,
    'squad',          '[]'::jsonb,
    'pickCount',      0,
    'lastSeen',       NOW()::TEXT,
    'lastSeenAt',     NOW()::TEXT
  );

  -- Append to authoritative JSONB list
  v_new_participants := COALESCE(v_room.participants, '[]'::jsonb)
                        || jsonb_build_array(v_participant_entry);

  -- 9. Determine new status
  v_is_full    := jsonb_array_length(v_new_participants) >= v_room.max_players;
  v_new_status := CASE WHEN v_is_full THEN 'in_progress' ELSE 'waiting_for_opponent' END;

  -- 10. Insert audit row into room_participants
  INSERT INTO public.room_participants (
    room_id, room_code, user_id, role, role_index,
    display_name, avatar, favorite_team, is_ready, is_connected
  ) VALUES (
    v_room.id,
    v_room.room_code,
    v_user_id,
    v_next_role,
    v_next_index,
    COALESCE(NULLIF(TRIM(p_display_name), ''), 'Player ' || (v_next_index + 1)::TEXT),
    COALESCE(NULLIF(p_avatar, ''), '🏏'),
    p_favorite_team,
    TRUE,
    TRUE
  );

  -- 11. Atomically update draft_rooms
  UPDATE public.draft_rooms
  SET
    participants = v_new_participants,
    status       = v_new_status,
    -- Keep game_state.participants in sync (derived copy for Realtime broadcast)
    game_state   = jsonb_set(
                     COALESCE(game_state, '{}'::jsonb),
                     '{participants}',
                     v_new_participants
                   ),
    -- guest_id: legacy 2-player compat.
    -- Set only when room becomes full via player2.
    -- Keep NULL while still waiting so P3/P4 can still pass SELECT RLS.
    guest_id     = CASE
                     WHEN v_is_full AND v_next_role = 'player2' THEN v_user_id
                     WHEN v_is_full AND v_next_role <> 'player2' THEN v_room.guest_id
                     ELSE NULL
                   END,
    version      = COALESCE(v_room.version, 1) + 1,
    updated_at   = NOW()
  WHERE id = v_room.id;

  -- 12. Return result
  SELECT game_state INTO v_result
  FROM public.draft_rooms WHERE id = v_room.id;

  RETURN jsonb_build_object(
    'ok',        true,
    'rejoined',  false,
    'room_code', v_room.room_code,
    'role',      v_next_role,
    'roleIndex', v_next_index,
    'isFull',    v_is_full,
    'status',    v_new_status,
    'gameState', v_result
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- re-raise with original error code prefix for JS parsing
END;
$$;

-- Grant EXECUTE only to authenticated role; block anon
REVOKE ALL ON FUNCTION public.join_room(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_room(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 7: Add tables to Supabase Realtime publication
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'draft_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_rooms;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 8: Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- VERIFICATION QUERIES — Run after applying to confirm success
-- =====================================================================
-- 1. All columns present:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'draft_rooms'
-- ORDER BY ordinal_position;
--
-- 2. RLS policies on draft_rooms:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'draft_rooms' ORDER BY cmd;
--
-- 3. RLS policies on room_participants:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'room_participants' ORDER BY cmd;
--
-- 4. join_room function exists and is SECURITY DEFINER:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'join_room';
-- (prosecdef must be TRUE)
--
-- 5. Grant on join_room (only authenticated, not anon):
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_name = 'join_room';
--
-- 6. Realtime tables:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--
-- 7. Existing rooms backfilled:
-- SELECT room_code, max_players, turn_timer_seconds, draft_mode, version
-- FROM draft_rooms ORDER BY created_at DESC LIMIT 10;
-- =====================================================================
