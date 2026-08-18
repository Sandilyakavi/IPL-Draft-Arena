-- =================================================================
-- IPL Draft Arena — Phase 6C Supabase Database Schema & RLS Policies
-- =================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '🏏',
  favorite_team TEXT DEFAULT NULL,

  -- Game Performance Statistics
  games_played INTEGER DEFAULT 0 CHECK (games_played >= 0),
  wins INTEGER DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER DEFAULT 0 CHECK (losses >= 0),
  best_score INTEGER DEFAULT 0 CHECK (best_score >= 0 AND best_score <= 100),
  total_score INTEGER DEFAULT 0 CHECK (total_score >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Index for fast username uniqueness checks & lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (LOWER(username));

-- 5. Trigger Function to automatically create profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar)
  VALUES (
    NEW.id,
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 4),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    '🏏'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- PHASE 6C — DRAFT GAMES TABLE & RLS POLICIES
-- =================================================================

-- 7. Create draft_games table
CREATE TABLE IF NOT EXISTS public.draft_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('setup', 'drafting', 'player-selection', 'completed', 'discarded', 'error')),
  season TEXT DEFAULT '2026',
  current_turn TEXT DEFAULT 'player1',
  pick_number INTEGER DEFAULT 0 CHECK (pick_number >= 0 AND pick_number <= 24),
  game_state JSONB NOT NULL,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  player1_avatar TEXT DEFAULT '🏏',
  player2_avatar TEXT DEFAULT '⚡',
  player1_score INTEGER DEFAULT NULL,
  player2_score INTEGER DEFAULT NULL,
  winner TEXT DEFAULT NULL,
  version INTEGER DEFAULT 1 CHECK (version >= 1),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS on draft_games
ALTER TABLE public.draft_games ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for draft_games (Strict owner-only access)
CREATE POLICY "Users can view own draft games"
  ON public.draft_games FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own draft games"
  ON public.draft_games FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own draft games"
  ON public.draft_games FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own draft games"
  ON public.draft_games FOR DELETE USING (auth.uid() = owner_id);

-- 10. Index for querying active & completed drafts by owner
CREATE INDEX IF NOT EXISTS draft_games_owner_status_idx ON public.draft_games (owner_id, status);
