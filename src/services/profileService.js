import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';

/**
 * profileService.js — Centralized Database Service for User Profiles & Game Statistics.
 */

// Track finalized game IDs in-memory and in localStorage to guarantee idempotency
const FINALIZED_GAMES_KEY = 'ipl-draft-arena:finalized-games:v1';
const memoryFinalizedGames = new Set();

function getFinalizedGamesSet() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(FINALIZED_GAMES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        arr.forEach(id => memoryFinalizedGames.add(id));
      }
    }
  } catch (err) {
    // Fail silently
  }
  return memoryFinalizedGames;
}

function markGameFinalized(gameId) {
  if (!gameId) return;
  memoryFinalizedGames.add(gameId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FINALIZED_GAMES_KEY, JSON.stringify([...memoryFinalizedGames]));
    }
  } catch (err) {
    // Fail silently
  }
}

/**
 * Fetches user profile from Supabase profiles table.
 */
export async function fetchProfile(userId) {
  if (!userId) return { success: false, error: 'NO_USER_ID' };

  if (!isSupabaseConfigured || !supabase) {
    // Return mock profile in offline/demo mode
    return {
      success: true,
      profile: {
        id: userId,
        username: 'arena_champion',
        display_name: 'Draft Champion',
        avatar: '🏏',
        favorite_team: 'csk',
        games_played: 5,
        wins: 4,
        losses: 1,
        best_score: 88,
        total_score: 380,
      },
    };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // If profile not found, try to create default profile
      if (error.code === 'PGRST116') {
        return createProfile(userId, { display_name: 'Player', username: `user_${userId.slice(0, 6)}` });
      }
      return { success: false, error: error.message };
    }

    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates a new profile record in Supabase.
 */
export async function createProfile(userId, profileData = {}) {
  if (!userId) return { success: false, error: 'NO_USER_ID' };

  const defaultUsername = `user_${userId.slice(0, 6)}`;
  const payload = {
    id: userId,
    username: (profileData.username || defaultUsername).trim().toLowerCase(),
    display_name: (profileData.display_name || 'Player').trim(),
    avatar: profileData.avatar || '🏏',
    favorite_team: profileData.favorite_team || null,
    games_played: 0,
    wins: 0,
    losses: 0,
    best_score: 0,
    total_score: 0,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, profile: payload };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Checks if a username is available.
 */
export async function checkUsernameAvailable(username, currentUserId = null) {
  const cleaned = (username || '').trim().toLowerCase();
  if (!cleaned || cleaned.length < 3) return { available: false, reason: 'Username must be at least 3 characters.' };

  if (!isSupabaseConfigured || !supabase) return { available: true };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', cleaned);

    if (error) return { available: true }; // Fallback

    if (data && data.length > 0) {
      const match = data[0];
      if (currentUserId && match.id === currentUserId) {
        return { available: true }; // Same user
      }
      return { available: false, reason: 'Username is already taken.' };
    }

    return { available: true };
  } catch (err) {
    return { available: true };
  }
}

/**
 * Updates editable profile fields for a user.
 */
export async function updateProfile(userId, updates = {}) {
  if (!userId) return { success: false, error: 'NO_USER_ID' };

  const cleanedUsername = (updates.username || '').trim().toLowerCase();
  const cleanedDisplayName = (updates.display_name || '').trim();

  if (!cleanedUsername || cleanedUsername.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }

  if (!cleanedDisplayName) {
    return { success: false, error: 'Display name cannot be empty.' };
  }

  // Check username uniqueness
  const avail = await checkUsernameAvailable(cleanedUsername, userId);
  if (!avail.available) {
    return { success: false, error: avail.reason || 'Username is already taken.' };
  }

  const payload = {
    username: cleanedUsername,
    display_name: cleanedDisplayName,
    avatar: updates.avatar || '🏏',
    favorite_team: updates.favorite_team || null,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, profile: { id: userId, ...payload } };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Idempotently updates game statistics upon draft completion.
 * Prevents duplicate updates caused by re-renders or page refreshes.
 */
export async function updateGameStatistics(userId, gameData = {}) {
  if (!userId || !gameData) return { success: false, error: 'INVALID_INPUT' };

  const gameId = gameData.gameId || `game_${Date.now()}`;
  const finalizedSet = getFinalizedGamesSet();

  if (finalizedSet.has(gameId)) {
    return { success: true, idempotent: true, message: 'Game stats already recorded for this session.' };
  }

  // Calculate new stats
  const finalScore = Math.min(100, Math.max(0, Math.round(gameData.finalScore || 0)));
  const isWinner = Boolean(gameData.isWinner);

  if (!isSupabaseConfigured || !supabase) {
    markGameFinalized(gameId);
    return { success: true, idempotent: false, updatedStats: { score: finalScore, isWinner } };
  }

  try {
    // 1. Fetch current profile stats
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('games_played, wins, losses, best_score, total_score')
      .eq('id', userId)
      .single();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      return { success: false, error: fetchErr.message };
    }

    const currentGames = profile?.games_played || 0;
    const currentWins = profile?.wins || 0;
    const currentLosses = profile?.losses || 0;
    const currentBest = profile?.best_score || 0;
    const currentTotal = profile?.total_score || 0;

    const newGames = currentGames + 1;
    const newWins = isWinner ? currentWins + 1 : currentWins;
    const newLosses = !isWinner && !gameData.isTie ? currentLosses + 1 : currentLosses;
    const newBest = Math.max(currentBest, finalScore);
    const newTotal = currentTotal + finalScore;

    const { data: updatedData, error: updateErr } = await supabase
      .from('profiles')
      .update({
        games_played: newGames,
        wins: newWins,
        losses: newLosses,
        best_score: newBest,
        total_score: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) return { success: false, error: updateErr.message };

    markGameFinalized(gameId);
    return { success: true, idempotent: false, profile: updatedData };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
