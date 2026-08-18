import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';

/**
 * profileService.js — Centralized Database Service for User Profiles.
 * Supabase is used ONLY for identity/profile data. Game state stays in localStorage.
 */

// Allowed preset avatars (must match AvatarPicker options)
export const ALLOWED_AVATARS = ['🏏', '⚡', '🔥', '🦁', '🐯', '⭐', '🏆', '🎯', '💥', '🚀'];

// Allowed IPL team IDs (cosmetic-only — never affects draft eligibility)
const ALLOWED_TEAM_IDS = ['csk', 'mi', 'rcb', 'kkr', 'srh', 'dc', 'rr', 'pbks', 'gt', 'lsg'];

// Track finalized game IDs in-memory and localStorage for idempotency
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
  } catch (err) {}
  return memoryFinalizedGames;
}

function markGameFinalized(gameId) {
  if (!gameId) return;
  memoryFinalizedGames.add(gameId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FINALIZED_GAMES_KEY, JSON.stringify([...memoryFinalizedGames]));
    }
  } catch (err) {}
}

/**
 * Validates and sanitizes avatar — returns allowed avatar or '🏏' fallback.
 */
function sanitizeAvatar(avatar) {
  if (ALLOWED_AVATARS.includes(avatar)) return avatar;
  return '🏏';
}

/**
 * Validates and sanitizes favorite_team — returns null if not a known team ID.
 * Cosmetic only — NEVER affects draft eligibility or wheel probability.
 */
function sanitizeFavoriteTeam(teamId) {
  if (!teamId) return null;
  const normalized = String(teamId).toLowerCase().trim();
  return ALLOWED_TEAM_IDS.includes(normalized) ? normalized : null;
}

/**
 * Validates username format: 3–20 chars, only a-z, 0-9, underscore.
 */
function validateUsername(username) {
  const u = (username || '').trim().toLowerCase();
  if (!u || u.length < 3) return { valid: false, error: 'Username must be at least 3 characters.' };
  if (u.length > 20) return { valid: false, error: 'Username must not exceed 20 characters.' };
  if (!/^[a-z0-9_]+$/.test(u)) return { valid: false, error: 'Username may only contain letters, numbers, and underscores.' };
  return { valid: true, value: u };
}

/**
 * Fetches user profile from Supabase profiles table.
 * If profile is missing, safely recovers by creating a new one (ON CONFLICT DO NOTHING safe).
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
        games_played: 0,
        wins: 0,
        losses: 0,
        best_score: 0,
        total_score: 0,
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
      // PGRST116 = no rows returned — profile does not exist yet
      if (error.code === 'PGRST116') {
        return _recoverMissingProfile(userId);
      }
      return { success: false, error: error.message };
    }

    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Recover a missing profile. Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates.
 * The database trigger may have already created the profile (race condition safe).
 */
async function _recoverMissingProfile(userId) {
  // Generate a safe username from the userId suffix (collision unlikely at 8 chars)
  const suffix = userId.replace(/-/g, '').slice(-8);
  const fallbackUsername = `player_${suffix}`;

  const payload = {
    id: userId,
    username: fallbackUsername,
    display_name: 'Player',
    avatar: '🏏',
    favorite_team: null,
    games_played: 0,
    wins: 0,
    losses: 0,
    best_score: 0,
    total_score: 0,
    updated_at: new Date().toISOString(),
  };

  try {
    // upsert with ignoreDuplicates prevents overwriting if trigger already created the row
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      // Try a direct fetch in case upsert upserted but couldn't return via ignoreDuplicates
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (existing) return { success: true, profile: existing };
      return { success: false, error: error.message };
    }

    if (data) return { success: true, profile: data };

    // Final fallback: fetch again (trigger may have beaten us to the insert)
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (existing) return { success: true, profile: existing };

    return { success: true, profile: payload }; // Use local payload if all else fails
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates a new profile record in Supabase (used in tests only — real flow uses fetchProfile recovery).
 */
export async function createProfile(userId, profileData = {}) {
  if (!userId) return { success: false, error: 'NO_USER_ID' };

  const usernameResult = validateUsername(profileData.username || `user_${userId.slice(0, 6)}`);
  const payload = {
    id: userId,
    username: usernameResult.valid ? usernameResult.value : `user_${userId.slice(-6)}`,
    display_name: (profileData.display_name || 'Player').trim().slice(0, 40),
    avatar: sanitizeAvatar(profileData.avatar),
    favorite_team: sanitizeFavoriteTeam(profileData.favorite_team),
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
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message }; 
  }
}

/**
 * Checks if a username is available (case-insensitive, server-side).
 */
export async function checkUsernameAvailable(username, currentUserId = null) {
  const result = validateUsername(username);
  if (!result.valid) return { available: false, reason: result.error };

  if (!isSupabaseConfigured || !supabase) return { available: true };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', result.value)
      .limit(2); // Limit to 2 to detect uniqueness without over-fetching

    if (error) return { available: true }; // Optimistic fallback

    if (data && data.length > 0) {
      const match = data[0];
      // If the only match is the current user's own profile, it's available
      if (currentUserId && match.id === currentUserId) return { available: true };
      return { available: false, reason: 'Username is already taken.' };
    }

    return { available: true };
  } catch (err) {
    return { available: true }; // Optimistic fallback on network error
  }
}

/**
 * Updates editable profile fields for a user.
 * All inputs are validated and sanitized before writing to Supabase.
 */
export async function updateProfile(userId, updates = {}) {
  if (!userId) return { success: false, error: 'NO_USER_ID' };

  // Validate and clean all inputs
  const displayName = (updates.display_name || '').trim().slice(0, 40);
  if (!displayName) return { success: false, error: 'Display name cannot be empty.' };

  const usernameResult = validateUsername(updates.username);
  if (!usernameResult.valid) return { success: false, error: usernameResult.error };

  const avatar = sanitizeAvatar(updates.avatar);
  const favoriteTeam = sanitizeFavoriteTeam(updates.favorite_team);

  // Check username uniqueness (before hitting the database with an update)
  const avail = await checkUsernameAvailable(usernameResult.value, userId);
  if (!avail.available) {
    return { success: false, error: avail.reason || 'Username is already taken.' };
  }

  const payload = {
    username: usernameResult.value,
    display_name: displayName,
    avatar,
    favorite_team: favoriteTeam,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    // Offline / demo mode — return success with merged payload
    return { success: true, profile: { id: userId, ...payload } };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)  // RLS also enforces owner — this is defense in depth
      .select()
      .single();

    if (error) {
      // Map specific DB errors to user-friendly messages
      if (error.code === '23505' || error.message?.includes('unique')) {
        return { success: false, error: 'Username is already taken. Please choose a different one.' };
      }
      return { success: false, error: 'Failed to update profile. Please try again.' };
    }
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: 'Failed to update profile. Check your connection and try again.' };
  }
}

/**
 * Idempotently updates game statistics upon draft completion.
 * NOTE: This function writes to Supabase profiles table (game stats fields).
 * Currently not called from the game UI per Phase 6C reversal — preserved for future use.
 */
export async function updateGameStatistics(userId, gameData = {}) {
  if (!userId || !gameData) return { success: false, error: 'INVALID_INPUT' };

  const gameId = gameData.gameId || `game_${Date.now()}`;
  const finalizedSet = getFinalizedGamesSet();

  if (finalizedSet.has(gameId)) {
    return { success: true, idempotent: true, message: 'Game stats already recorded for this session.' };
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(gameData.finalScore || 0)));
  const isWinner = Boolean(gameData.isWinner);

  if (!isSupabaseConfigured || !supabase) {
    markGameFinalized(gameId);
    return { success: true, idempotent: false, updatedStats: { score: finalScore, isWinner } };
  }

  try {
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('games_played, wins, losses, best_score, total_score')
      .eq('id', userId)
      .single();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      return { success: false, error: fetchErr.message };
    }

    const currentGames = Math.max(0, profile?.games_played || 0);
    const currentWins = Math.max(0, profile?.wins || 0);
    const currentLosses = Math.max(0, profile?.losses || 0);
    const currentBest = Math.min(100, Math.max(0, profile?.best_score || 0));
    const currentTotal = Math.max(0, profile?.total_score || 0);

    const newGames = currentGames + 1;
    const newWins = isWinner ? currentWins + 1 : currentWins;
    const newLosses = !isWinner && !gameData.isTie ? currentLosses + 1 : currentLosses;
    const newBest = Math.min(100, Math.max(currentBest, finalScore));
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
    return { success: true, idempotent: false, updatedStats: { score: finalScore, isWinner }, profile: updatedData };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
