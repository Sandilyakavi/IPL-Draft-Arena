-- =====================================================================
-- IPL DRAFT ARENA — DRAFT ROOMS SCHEMA & RLS POLICIES (Phase 8 Step 2)
-- =====================================================================
-- Run this migration in Supabase SQL Editor to enable multiplayer rooms.

-- 1. Create draft_rooms table
CREATE TABLE IF NOT EXISTS draft_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'waiting_for_opponent',
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  season VARCHAR(10) DEFAULT '2026',
  current_turn_role VARCHAR(10) DEFAULT 'player1',
  game_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_draft_rooms_code ON draft_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_host ON draft_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_guest ON draft_rooms(guest_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_status ON draft_rooms(status);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_draft_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_draft_rooms_updated_at ON draft_rooms;
CREATE TRIGGER trigger_draft_rooms_updated_at
  BEFORE UPDATE ON draft_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_draft_rooms_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE draft_rooms ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- SELECT Policy: Users can view rooms they host, guest in, or waiting rooms by code
DROP POLICY IF EXISTS "Participants or waiting room lookup" ON draft_rooms;
CREATE POLICY "Participants or waiting room lookup" ON draft_rooms
  FOR SELECT
  USING (
    auth.uid() = host_id OR
    auth.uid() = guest_id OR
    status = 'waiting_for_opponent'
  );

-- INSERT Policy: Authenticated users can create rooms where they are the host
DROP POLICY IF EXISTS "Host can create draft room" ON draft_rooms;
CREATE POLICY "Host can create draft room" ON draft_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- UPDATE Policy: Host or assigned guest can update room state
DROP POLICY IF EXISTS "Participants can update draft room" ON draft_rooms;
CREATE POLICY "Participants can update draft room" ON draft_rooms
  FOR UPDATE
  USING (
    auth.uid() = host_id OR
    auth.uid() = guest_id OR
    (guest_id IS NULL AND status = 'waiting_for_opponent')
  );

-- Enable Realtime for draft_rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE draft_rooms;
