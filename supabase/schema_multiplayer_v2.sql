-- =====================================================================
-- IPL DRAFT ARENA — 2–4 PLAYER MULTIPLAYER SCHEMA MIGRATION (Phase 12)
-- =====================================================================
-- Safe, non-destructive migration upgrading draft_rooms and participants
-- to support 2, 3, or 4 concurrent players, synchronized turn timers,
-- and dynamic Snake draft state.
-- =====================================================================

-- 1. Extend draft_rooms table with 2–4 player columns
ALTER TABLE IF EXISTS public.draft_rooms
  ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 2 CHECK (max_players >= 2 AND max_players <= 4),
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS turn_timer_seconds INTEGER DEFAULT 20 CHECK (turn_timer_seconds IN (10, 15, 20, 30)),
  ADD COLUMN IF NOT EXISTS turn_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_mode VARCHAR(20) DEFAULT 'snake' CHECK (draft_mode IN ('snake', 'alternating')),
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Create room_participants table for multi-user lobby management
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.draft_rooms(id) ON DELETE CASCADE NOT NULL,
  room_code VARCHAR(6) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(15) NOT NULL CHECK (role IN ('player1', 'player2', 'player3', 'player4')),
  role_index INTEGER NOT NULL CHECK (role_index >= 0 AND role_index <= 3),
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '🏏',
  favorite_team TEXT DEFAULT NULL,
  is_ready BOOLEAN DEFAULT TRUE,
  is_connected BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, role)
);

-- 3. Indexes for fast participant and lobby queries
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_code ON public.room_participants(room_code);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);

-- 4. Enable Row Level Security (RLS) on room_participants
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for room_participants
DROP POLICY IF EXISTS "Participants can view their room members" ON public.room_participants;
CREATE POLICY "Participants can view their room members" ON public.room_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.draft_rooms r
      WHERE r.id = room_participants.room_id
      AND (
        r.host_id = auth.uid() OR
        r.status = 'waiting_for_opponent' OR
        EXISTS (
          SELECT 1 FROM public.room_participants p2
          WHERE p2.room_id = r.id AND p2.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own participation" ON public.room_participants;
CREATE POLICY "Users can insert own participation" ON public.room_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own participation" ON public.room_participants;
CREATE POLICY "Users can update own participation" ON public.room_participants
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave room" ON public.room_participants;
CREATE POLICY "Users can leave room" ON public.room_participants
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Add room_participants to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  END IF;
END $$;
