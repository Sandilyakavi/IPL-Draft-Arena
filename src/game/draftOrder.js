/**
 * src/game/draftOrder.js
 * =================================================================
 * DRAFT ORDER ENGINE (2–4 PLAYERS)
 * =================================================================
 * Generates and calculates dynamic turn sequences for 2, 3, and 4 players.
 * Supports:
 * - Dynamic Snake Draft (Round 1: 1->2->3->4, Round 2: 4->3->2->1, Round 3: 1->2->3->4...)
 * - Alternating Turn Draft (1->2->3->4 every round)
 * =================================================================
 */

import { DRAFT_CONFIG } from '../config/draftConfig.js';

/**
 * Resolves active player index for a given pickNumber in a draft.
 *
 * @param {number} pickNumber - Current 0-indexed pick number (0 to totalPicks - 1)
 * @param {number} playerCount - Number of players (2, 3, or 4)
 * @param {string} mode - 'snake' | 'alternating'
 * @returns {number} 0-indexed player index (0 to playerCount - 1)
 */
export function getPlayerIndexForPick(pickNumber, playerCount = 2, mode = 'snake') {
  if (playerCount < 2) playerCount = 2;

  // For 2 players, preserve default alternating turn sequence (P1 -> P2 -> P1 -> P2)
  // for complete backward compatibility with existing matches and test suites
  if (playerCount === 2 && mode !== 'strict_snake_2p') {
    return pickNumber % 2;
  }

  const roundIndex = Math.floor(pickNumber / playerCount);
  const positionInRound = pickNumber % playerCount;

  if (mode === 'snake' && roundIndex % 2 === 1) {
    // Reverse order round (e.g. 3p: P3->P2->P1; 4p: P4->P3->P2->P1)
    return playerCount - 1 - positionInRound;
  }

  // Forward order round (e.g. Round 1: 1->2->3->4)
  return positionInRound;
}

/**
 * Returns player ID for a given pickNumber.
 */
export function getTurnPlayerForPick(
  pickNumber,
  playerCount = 2,
  squadSize = DRAFT_CONFIG.SQUAD_SIZE,
  mode = 'snake',
  playerIds = ['player1', 'player2']
) {
  const playerIndex = getPlayerIndexForPick(pickNumber, playerCount, mode);
  return playerIds[playerIndex] || `player${playerIndex + 1}`;
}

/**
 * Returns 1-indexed round number and pick within round.
 */
export function getDraftRound(pickNumber, playerCount = 2) {
  if (playerCount < 1) playerCount = 2;
  const roundNumber = Math.floor(pickNumber / playerCount) + 1;
  const pickInRound = (pickNumber % playerCount) + 1;
  return { roundNumber, pickInRound };
}

/**
 * Generates the full sequence of player IDs for all picks in the draft.
 */
export function generateDraftOrder(
  playerCount = 2,
  squadSize = DRAFT_CONFIG.SQUAD_SIZE,
  mode = 'snake',
  playerIds = null
) {
  const ids = playerIds && playerIds.length >= playerCount
    ? playerIds.slice(0, playerCount)
    : Array.from({ length: playerCount }, (_, i) => `player${i + 1}`);

  const totalPicks = squadSize * playerCount;
  const order = [];

  for (let pick = 0; pick < totalPicks; pick++) {
    const idx = getPlayerIndexForPick(pick, playerCount, mode);
    order.push({
      pickNumber: pick + 1, // 1-indexed
      pickIndex: pick,      // 0-indexed
      playerId: ids[idx],
      playerIndex: idx,
      roundNumber: Math.floor(pick / playerCount) + 1,
      pickInRound: (pick % playerCount) + 1,
    });
  }

  return order;
}
