import { useState, useEffect, useRef, useCallback } from 'react';
import { saveDraft, getActiveDraft, completeDraft } from '../services/draftService.js';

/**
 * useCloudSync — Debounced auto-save hook for Phase 6C cloud draft persistence.
 *
 * Features:
 * - Debounced save (500ms) to prevent excessive writes
 * - Version-based stale-write protection (monotonically increasing)
 * - Local-first: never blocks gameplay on cloud failure
 * - Tracks save status: 'idle' | 'saving' | 'saved' | 'local' | 'error'
 */
export function useCloudSync({ ownerId, gameState, enabled = true }) {
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'local' | 'error'
  const debounceTimerRef = useRef(null);
  const latestVersionRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastSavedStatusRef = useRef(null); // track last status to only save on meaningful changes

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const triggerSave = useCallback(async (stateToSave, ownId) => {
    if (!stateToSave || !ownId) return;

    // Skip saving during setup or if disabled
    if (!enabled || stateToSave.status === 'setup') return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;

      const thisVersion = ++latestVersionRef.current;
      if (isMountedRef.current) setSaveStatus('saving');

      try {
        const result = await saveDraft(ownId, stateToSave);

        // Stale-write protection: only update UI if this is still the latest save
        if (thisVersion < latestVersionRef.current) return;
        if (!isMountedRef.current) return;

        if (result.success) {
          setSaveStatus(result.source === 'supabase' ? 'saved' : 'local');
          setTimeout(() => {
            if (isMountedRef.current && thisVersion >= latestVersionRef.current) {
              setSaveStatus('idle');
            }
          }, 3000);
        } else {
          setSaveStatus('error');
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus('local');
          }, 3000);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setSaveStatus('local');
      }
    }, 500);
  }, [enabled]);

  // Watch for meaningful game-state changes and trigger debounced save
  useEffect(() => {
    if (!gameState || !ownerId || !enabled) return;
    if (gameState.status === 'setup') return;

    // Only save on meaningful state changes (not every re-render)
    const meaningfulKey = JSON.stringify({
      status: gameState.status,
      pickNumber: gameState.pickNumber,
      currentTurn: gameState.currentTurn,
      currentTeamId: gameState.currentTeamId,
      pendingSelectedPlayerId: gameState.pendingSelectedPlayerId,
      p1SquadLen: gameState.player1?.squad?.length,
      p2SquadLen: gameState.player2?.squad?.length,
      p1SquadOrder: gameState.player1?.squadOrder,
      p2SquadOrder: gameState.player2?.squadOrder,
    });

    if (meaningfulKey === lastSavedStatusRef.current) return;
    lastSavedStatusRef.current = meaningfulKey;

    triggerSave(gameState, ownerId);
  }, [gameState, ownerId, enabled, triggerSave]);

  return { saveStatus };
}

/**
 * useActiveDraft — Hook to detect an existing active cloud draft on app load.
 */
export function useActiveDraft(ownerId) {
  const [activeDraft, setActiveDraft] = useState(null);
  const [isCheckingDraft, setIsCheckingDraft] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!ownerId || hasChecked) return;

    async function check() {
      setIsCheckingDraft(true);
      try {
        const result = await getActiveDraft(ownerId);
        if (result.success && result.draft) {
          setActiveDraft(result.draft);
        }
      } catch (err) {
        // Silently fail; local fallback still active
      } finally {
        setIsCheckingDraft(false);
        setHasChecked(true);
      }
    }

    check();
  }, [ownerId, hasChecked]);

  const clearActiveDraft = useCallback(() => setActiveDraft(null), []);

  return { activeDraft, isCheckingDraft, hasChecked, clearActiveDraft, setActiveDraft };
}
