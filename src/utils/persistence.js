/**
 * persistence.js
 * =====================================================
 * Safe LocalStorage persistence utility for IPL Draft Arena.
 * Key: ipl-draft-arena:game:v1
 * =====================================================
 */

const STORAGE_KEY = 'ipl-draft-arena:game:v1';

export function saveGameSession(gameState) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && gameState) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }
  } catch (err) {
    // Fail silently in private/restricted storage modes
  }
}

export function loadGameSession() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Basic shape validation to protect against corrupted or legacy localStorage data
        if (parsed && typeof parsed === 'object' && parsed.status && parsed.squads) {
          return parsed;
        }
      }
    }
  } catch (err) {
    // Fail silently on corrupt JSON or storage error
  }
  return null;
}

export function clearGameSession() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    // Fail silently
  }
}
