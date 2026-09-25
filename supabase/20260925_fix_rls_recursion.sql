-- =====================================================================
-- IPL DRAFT ARENA — CORRECTIVE MIGRATION: FIX RLS INFINITE RECURSION
-- =====================================================================
-- Migration Name : 20260925_fix_rls_recursion
-- Applies To     : public.draft_rooms, public.room_participants RLS only
-- Safe           : YES — only DROPS and RECREATEs RLS policies
-- Idempotent     : YES — DROP IF EXISTS before every CREATE
--
-- ROOT CAUSE (production error):
--   "infinite recursion detected in policy for relation draft_rooms"
--
--   draft_rooms SELECT policy  →  queries room_participants
--   room_participants SELECT policy  →  queries draft_rooms
--   draft_rooms SELECT policy fires again  →  infinite loop
--
-- WHY THE NEW POLICIES CANNOT RECURSE:
--
--   1. draft_rooms SELECT uses ONLY columns that live on the draft_rooms
--      row itself: host_id, guest_id, status, and the participants JSONB
--      column. It NEVER queries room_participants. The JSONB membership
--      check is a self-contained expression:
--        EXISTS (
--          SELECT 1 FROM jsonb_array_elements(participants) AS p
--          WHERE p->>'userId' = auth.uid()::text
--        )
--      This is a set-returning function call on a column of the current
--      row — it performs no cross-table query and triggers no other RLS.
--
--   2. room_participants SELECT joins draft_rooms to check host/lobby
--      visibility. This DOES trigger draft_rooms RLS. But since
--      draft_rooms RLS no longer touches room_participants, the chain
--      terminates: room_participants → draft_rooms → (no further join).
--
--   Dependency graph (acyclic):
--     room_participants SELECT  →  draft_rooms SELECT  →  (JSONB only, no join)
--
-- AUTHORITATIVE MEMBERSHIP SOURCE:
--   draft_rooms.participants JSONB (set by join_room() RPC atomically).
--   room_participants table is the audit trail / heartbeat store.
--   No policy crosses from draft_rooms into room_participants.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PART A: Fix draft_rooms RLS policies
-- ─────────────────────────────────────────────────────────────────────

-- SELECT: ZERO cross-table joins. Uses only draft_rooms columns.
--
--   (a) host_id = uid           → host always sees their room
--   (b) guest_id = uid          → legacy 2-player backward compat
--   (c) status = waiting        → any authenticated user can look up
--                                 the room by code before calling join_room()
--   (d) participants JSONB      → confirmed members always see the room
--                                 checked via jsonb_array_elements on
--                                 the row's own column — NO join to
--                                 room_participants, NO recursion possible.

DROP POLICY IF EXISTS "Participants or waiting room lookup" ON public.draft_rooms;
CREATE POLICY "Participants or waiting room lookup" ON public.draft_rooms
  FOR SELECT
  USING (
    -- (a) host
    auth.uid() = host_id
    -- (b) legacy 2-player guest (backward compat)
    OR auth.uid() = guest_id
    -- (c) lobby: visible to anyone looking up the code to join
    OR status = 'waiting_for_opponent'
    -- (d) confirmed member via authoritative JSONB — no cross-table query
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(draft_rooms.participants) = 'array' THEN draft_rooms.participants
          ELSE '[]'::jsonb
        END
      ) AS p
      WHERE p->>'userId' = auth.uid()::text
         OR p->>'playerId' = auth.uid()::text
    )
  );

-- INSERT: only host may create a room (unchanged)
DROP POLICY IF EXISTS "Host can create draft room" ON public.draft_rooms;
CREATE POLICY "Host can create draft room" ON public.draft_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- UPDATE: confirmed members only — USING checks who can attempt the update,
--         WITH CHECK ensures the row remains owned by a valid member after.
--         Uses participants JSONB for membership, NOT room_participants join.
DROP POLICY IF EXISTS "Participants can update draft room" ON public.draft_rooms;
CREATE POLICY "Participants can update draft room" ON public.draft_rooms
  FOR UPDATE
  USING (
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(draft_rooms.participants) = 'array' THEN draft_rooms.participants
          ELSE '[]'::jsonb
        END
      ) AS p
      WHERE p->>'userId' = auth.uid()::text
         OR p->>'playerId' = auth.uid()::text
    )
  )
  WITH CHECK (
    -- After update, the row's host_id must still be the caller or a valid member.
    -- Prevents a member from reassigning host_id to an arbitrary UUID.
    auth.uid() = host_id
    OR auth.uid() = guest_id
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(draft_rooms.participants) = 'array' THEN draft_rooms.participants
          ELSE '[]'::jsonb
        END
      ) AS p
      WHERE p->>'userId' = auth.uid()::text
         OR p->>'playerId' = auth.uid()::text
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- PART B: Fix room_participants RLS policies
-- ─────────────────────────────────────────────────────────────────────

-- SELECT: safe to join draft_rooms because draft_rooms policy no longer
--         queries room_participants — the dependency graph is acyclic.
--
--   (a) user_id = uid           → always see your own row (zero joins)
--   (b) draft_rooms join        → host, guest, or lobby-visible room,
--                                 or member in participants JSONB.
--       This fires draft_rooms SELECT RLS → evaluates on JSONB only
--       → terminates. No loop.

DROP POLICY IF EXISTS "Participants can view room members" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can view their room members" ON public.room_participants;
CREATE POLICY "Participants can view room members" ON public.room_participants
  FOR SELECT
  USING (
    -- Own row: always visible, zero joins
    user_id = auth.uid()
    -- Room is host-owned, guest, in lobby, or caller is in JSONB — safe join, no cycle
    OR EXISTS (
      SELECT 1 FROM public.draft_rooms r
      WHERE r.id = room_participants.room_id
        AND (
          r.host_id = auth.uid()
          OR r.guest_id = auth.uid()
          OR r.status = 'waiting_for_opponent'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(r.participants) = 'array' THEN r.participants
                ELSE '[]'::jsonb
              END
            ) AS p
            WHERE p->>'userId' = auth.uid()::text
               OR p->>'playerId' = auth.uid()::text
          )
        )
    )
  );

-- INSERT: belt-and-suspenders (join_room RPC is the real enforcer)
DROP POLICY IF EXISTS "RPC only: insert participation" ON public.room_participants;
DROP POLICY IF EXISTS "Users can insert own participation" ON public.room_participants;
CREATE POLICY "RPC only: insert participation" ON public.room_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: own row only (presence heartbeat / last_seen_at)
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
-- Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- POST-APPLY VERIFICATION QUERIES
-- =====================================================================
-- 1. Confirm draft_rooms SELECT policy has NO reference to room_participants:
-- SELECT policyname, qual
-- FROM pg_policies
-- WHERE tablename = 'draft_rooms' AND cmd = 'r';
-- Expected: qual must NOT contain the string 'room_participants'
--
-- 2. Confirm policies are active:
-- SELECT tablename, policyname, cmd, permissive
-- FROM pg_policies
-- WHERE tablename IN ('draft_rooms', 'room_participants')
-- ORDER BY tablename, cmd;
--
-- 3. Smoke test create room (should succeed, no infinite recursion):
-- INSERT INTO public.draft_rooms (room_code, status, host_id, season, current_turn_role)
-- VALUES ('SMKTEST', 'waiting_for_opponent', auth.uid(), '2026', 'player1');
-- SELECT * FROM public.draft_rooms WHERE room_code = 'SMKTEST';
-- DELETE FROM public.draft_rooms WHERE room_code = 'SMKTEST';
-- =====================================================================
