/**
 * shuffle.js
 * =================================================════
 * Utility functions for fair player shuffling and
 * intelligent squad auto-arrangement.
 * =================================================════
 */

/**
 * Shuffles an array in-place copy using Fisher-Yates algorithm.
 * Accepts an optional random generator for deterministic testing.
 *
 * @param {Array} array - Array to shuffle
 * @param {Function} [randomFn=Math.random] - Random number generator (returns 0..1)
 * @returns {Array} New shuffled array instance
 */
export function shuffleArray(array, randomFn = Math.random) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Intelligently auto-arranges a squad into a balanced IPL-style 1–12 lineup
 * using ONLY existing player metadata (role, isWicketkeeper, isOverseas, rating).
 *
 * Preferred 1–12 structural layout:
 *   1. Top-Order Batter / Opener
 *   2. Batter
 *   3. Batter / Wicketkeeper
 *   4. All-Rounder
 *   5. All-Rounder
 *   6. Wicketkeeper / Utility
 *   7. All-Rounder / Utility
 *   8. Spinner / Bowler
 *   9. Bowler
 *  10. Bowler
 *  11. Bowler
 *  12. Utility / Extra
 *
 * CRITICAL RULE: Must NEVER add, remove, or duplicate players.
 * Must preserve exact squad membership.
 *
 * @param {Array} squad - Array of player objects in squad
 * @returns {Array} Reordered array of player objects
 */
export function autoArrangeSquad(squad) {
  if (!Array.isArray(squad) || squad.length <= 1) return [...(squad || [])];

  const pool = [...squad];

  // Helper to extract best matching player from pool based on criteria
  const pullBest = (predicate) => {
    let bestIdx = -1;
    let maxRating = -1;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (predicate(p)) {
        const rating = p.rating || 0;
        if (rating > maxRating || bestIdx === -1) {
          maxRating = rating;
          bestIdx = i;
        }
      }
    }

    if (bestIdx !== -1) {
      const [chosen] = pool.splice(bestIdx, 1);
      return chosen;
    }
    return null;
  };

  const arranged = [];

  // Slot 1: Top batter (Batter / WK)
  const slot1 = pullBest(p => p.role === 'batter' || p.role === 'wicketkeeper-batter') || (pool.length > 0 ? pool.shift() : null);
  if (slot1) arranged.push(slot1);

  // Slot 2: Batter
  const slot2 = pullBest(p => p.role === 'batter') || pullBest(p => p.role === 'wicketkeeper-batter') || (pool.length > 0 ? pool.shift() : null);
  if (slot2) arranged.push(slot2);

  // Slot 3: Batter / WK
  const slot3 = pullBest(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter') || pullBest(p => p.role === 'batter') || (pool.length > 0 ? pool.shift() : null);
  if (slot3) arranged.push(slot3);

  // Slot 4: Top All-Rounder / Batter
  const slot4 = pullBest(p => p.role === 'all-rounder') || pullBest(p => p.role === 'batter') || (pool.length > 0 ? pool.shift() : null);
  if (slot4) arranged.push(slot4);

  // Slot 5: All-Rounder
  const slot5 = pullBest(p => p.role === 'all-rounder') || (pool.length > 0 ? pool.shift() : null);
  if (slot5) arranged.push(slot5);

  // Slot 6: WK / Utility
  const slot6 = pullBest(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter') || pullBest(p => p.role === 'all-rounder') || (pool.length > 0 ? pool.shift() : null);
  if (slot6) arranged.push(slot6);

  // Slot 7: All-Rounder / Bowler
  const slot7 = pullBest(p => p.role === 'all-rounder') || pullBest(p => p.role === 'bowler') || (pool.length > 0 ? pool.shift() : null);
  if (slot7) arranged.push(slot7);

  // Slots 8, 9, 10, 11: Bowlers
  for (let i = 0; i < 4; i++) {
    if (pool.length === 0) break;
    const bowler = pullBest(p => p.role === 'bowler') || pullBest(p => p.role === 'all-rounder') || (pool.length > 0 ? pool.shift() : null);
    if (bowler) arranged.push(bowler);
  }

  // Slot 12+: Any remaining players in pool
  while (pool.length > 0) {
    arranged.push(pool.shift());
  }

  return arranged;
}
