import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import { updateGameStatistics } from './profileService.js';

/**
 * draftService.js — Centralized Database & Service Layer for Cloud Draft Save, Resume & History.
 */

// Local fallback storage keys
const LOCAL_ACTIVE_DRAFT_KEY = 'ipl-draft-arena:active-cloud-draft:v1';
const LOCAL_HISTORY_KEY = 'ipl-draft-arena:cloud-history-fallback:v1';

// In-memory version tracker for stale-write protection
const activeDraftVersions = new Map();

/**
 * Fetches active (unfinished) draft for authenticated user.
 */
export async function getActiveDraft(ownerId) {
  if (!ownerId) return { success: false, draft: null, source: 'none' };

  if (!isSupabaseConfigured || !supabase) {
    // Check local fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_ACTIVE_DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft && draft.status !== 'completed' && draft.status !== 'discarded') {
            return { success: true, draft, source: 'localStorage' };
          }
        }
      }
    } catch (err) {}
    return { success: true, draft: null, source: 'local' };
  }

  try {
    const { data, error } = await supabase
      .from('draft_games')
      .select('*')
      .eq('owner_id', ownerId)
      .in('status', ['drafting', 'player-selection', 'setup'])
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) return { success: false, error: error.message, source: 'supabase' };
    if (data && data.length > 0) {
      return { success: true, draft: data[0], source: 'supabase' };
    }
    return { success: true, draft: null, source: 'supabase' };
  } catch (err) {
    return { success: false, error: err.message, source: 'supabase' };
  }
}

/**
 * Saves current draft state with version tracking (stale-write protection).
 */
export async function saveDraft(ownerId, gameState) {
  if (!gameState) return { success: false, error: 'NO_GAME_STATE' };

  // Calculate version for stale-write protection
  const draftId = gameState.cloudDraftId || gameState.id || `local_draft_${Date.now()}`;
  const currentVer = (activeDraftVersions.get(draftId) || gameState.version || 0) + 1;

  activeDraftVersions.set(draftId, currentVer);
  const enrichedState = {
    ...gameState,
    cloudDraftId: draftId,
    version: currentVer,
    updatedAt: new Date().toISOString(),
  };

  const payload = {
    id: draftId.startsWith('local_') ? undefined : draftId,
    owner_id: ownerId || 'demo-owner',
    status: gameState.status || 'drafting',
    season: gameState.season || '2026',
    current_turn: gameState.currentTurn || 'player1',
    pick_number: gameState.pickNumber || 0,
    game_state: enrichedState,
    player1_name: gameState.player1?.name || 'Player 1',
    player2_name: gameState.player2?.name || 'Player 2',
    player1_avatar: gameState.player1?.avatar || '🏏',
    player2_avatar: gameState.player2?.avatar || '⚡',
    version: currentVer,
    updated_at: new Date().toISOString(),
  };

  // Always back up locally first for guaranteed zero data loss
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_ACTIVE_DRAFT_KEY, JSON.stringify(payload));
    }
  } catch (err) {}

  if (!isSupabaseConfigured || !supabase || !ownerId || ownerId === 'demo-owner') {
    return { success: true, draft: payload, source: 'localStorage', version: currentVer };
  }

  try {
    // Upsert into Supabase draft_games table
    const { data, error } = await supabase
      .from('draft_games')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, source: 'localStorage-fallback', localDraft: payload };
    }

    return { success: true, draft: data, source: 'supabase', version: currentVer };
  } catch (err) {
    return { success: false, error: err.message, source: 'localStorage-fallback', localDraft: payload };
  }
}

/**
 * Marks draft as completed, calculates winner/scores, updates stats idempotently.
 */
export async function completeDraft(ownerId, draftId, gameState, eval1, eval2) {
  if (!gameState) return { success: false, error: 'NO_GAME_STATE' };

  const p1Score = eval1?.finalScore || 0;
  const p2Score = eval2?.finalScore || 0;
  let winner = 'tie';
  if (p1Score > p2Score) winner = 'player1';
  else if (p2Score > p1Score) winner = 'player2';

  const completedState = {
    ...gameState,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };

  const payload = {
    id: draftId && !draftId.startsWith('local_') ? draftId : undefined,
    owner_id: ownerId || 'demo-owner',
    status: 'completed',
    season: gameState.season || '2026',
    current_turn: gameState.currentTurn || 'player1',
    pick_number: gameState.pickNumber || 24,
    game_state: completedState,
    player1_name: gameState.player1?.name || 'Player 1',
    player2_name: gameState.player2?.name || 'Player 2',
    player1_avatar: gameState.player1?.avatar || '🏏',
    player2_avatar: gameState.player2?.avatar || '⚡',
    player1_score: p1Score,
    player2_score: p2Score,
    winner,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Update local fallback history
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LOCAL_ACTIVE_DRAFT_KEY);
      const rawHist = window.localStorage.getItem(LOCAL_HISTORY_KEY);
      const hist = rawHist ? JSON.parse(rawHist) : [];
      hist.unshift({ ...payload, id: payload.id || `hist_${Date.now()}` });
      window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
    }
  } catch (err) {}

  if (ownerId) {
    // Record profile stats idempotently
    await updateGameStatistics(ownerId, {
      gameId: draftId || `draft_${Date.now()}`,
      finalScore: p1Score,
      isWinner: winner === 'player1',
      isTie: winner === 'tie',
    });
  }

  if (!isSupabaseConfigured || !supabase || !ownerId || ownerId === 'demo-owner') {
    return { success: true, draft: payload, source: 'localStorage' };
  }

  try {
    const { data, error } = await supabase
      .from('draft_games')
      .upsert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, draft: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches completed draft history records for owner.
 */
export async function getDraftHistory(ownerId) {
  if (!ownerId) return { success: true, history: [] };

  if (!isSupabaseConfigured || !supabase || ownerId === 'demo-owner') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
        return { success: true, history: raw ? JSON.parse(raw) : [], source: 'localStorage' };
      }
    } catch (err) {}
    return { success: true, history: [], source: 'localStorage' };
  }

  try {
    const { data, error } = await supabase
      .from('draft_games')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (error) return { success: false, error: error.message, history: [] };
    return { success: true, history: data || [], source: 'supabase' };
  } catch (err) {
    return { success: false, error: err.message, history: [] };
  }
}

/**
 * Discards or deletes an active or completed draft.
 */
export async function discardDraft(ownerId, draftId) {
  if (!draftId) return { success: false, error: 'NO_DRAFT_ID' };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const activeRaw = window.localStorage.getItem(LOCAL_ACTIVE_DRAFT_KEY);
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        if (parsed.id === draftId || parsed.game_state?.cloudDraftId === draftId) {
          window.localStorage.removeItem(LOCAL_ACTIVE_DRAFT_KEY);
        }
      }
    }
  } catch (err) {}

  if (!isSupabaseConfigured || !supabase || !ownerId || ownerId === 'demo-owner') {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('draft_games')
      .delete()
      .eq('id', draftId)
      .eq('owner_id', ownerId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
