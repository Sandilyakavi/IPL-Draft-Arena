import { getAllTeams } from '../utils/dataLoader.js';
import { shuffleArray } from '../utils/shuffle.js';
import {
  getEligibleTeams as ruleGetEligibleTeams,
  getEligiblePlayers as ruleGetEligiblePlayers,
} from './ruleEngine.js';

const teams = getAllTeams();

/**
 * Wheel Engine for IPL Draft Arena.
 * Manages franchise wheel spins, eligibility filtering, and respin resolution.
 */

/**
 * Returns all franchises that have at least one eligible player for the current user turn.
 */
export function getEligibleTeams(gameState) {
  if (!gameState) return [];
  const currentUser = gameState.currentTurn === 'player2' ? gameState.player2 : gameState.player1;
  const userSquad = currentUser?.squad || [];
  return ruleGetEligibleTeams(userSquad, gameState, gameState.rules);
}

/**
 * Returns true if a team has at least one eligible player for the current user turn.
 */
export function hasEligiblePlayers(teamId, userSquad = [], gameState = {}) {
  const eligible = ruleGetEligiblePlayers(teamId, userSquad, gameState, gameState.rules);
  return eligible.length > 0;
}

/**
 * Returns all eligible players for a team given user squad and game state.
 */
export function getEligiblePlayers(teamId, userSquad = [], gameState = {}) {
  return ruleGetEligiblePlayers(teamId, userSquad, gameState, gameState.rules);
}

/**
 * Simulates spinning the team wheel for the current player's turn.
 * Safely resolves wheel result among eligible teams to prevent invalid picks or infinite respin loops.
 *
 * @param {Object} gameState - Current immutable game state
 * @param {Function} [randomFn] - Optional deterministic random generator for testing (returns 0..1)
 * @returns {Object} Result object containing { resultTeamId, wasRespin, spinRecord, updatedGameState }
 */
export function spinTeam(gameState, randomFn = Math.random) {
  const currentUserKey = gameState.currentTurn;
  const currentUser = gameState[currentUserKey];
  const userSquad = currentUser ? currentUser.squad : [];

  // 1. Find all eligible teams for this player
  const eligibleTeams = getEligibleTeams(gameState);

  // 2. Handle scenario where no eligible teams remain
  if (eligibleTeams.length === 0) {
    return {
      success: false,
      error: 'NO_ELIGIBLE_TEAMS',
      message: `No eligible franchises remaining for ${currentUser?.name || 'current player'}.`,
      updatedGameState: {
        ...gameState,
        status: 'error',
        error: 'NO_ELIGIBLE_TEAMS',
        message: `No eligible franchises remaining for ${currentUser?.name || 'current player'}.`,
      },
    };
  }

  // 3. Select a raw team from all 10 teams to simulate physical wheel landing
  const rawIndex = Math.floor(randomFn() * teams.length);
  const landedTeam = teams[rawIndex];

  let selectedTeamId = landedTeam.id;
  let wasRespin = false;
  let respinAttempts = 0;

  // Check if landed team is eligible
  const isLandedEligible = eligibleTeams.some(t => t.id === landedTeam.id);

  if (!isLandedEligible) {
    wasRespin = true;
    respinAttempts = 1;

    // Pick deterministically/randomly from valid eligible teams (no infinite loop)
    const validIndex = Math.floor(randomFn() * eligibleTeams.length);
    selectedTeamId = eligibleTeams[validIndex].id;
  }

  const selectedTeamObj = teams.find(t => t.id === selectedTeamId);
  const rawEligible = getEligiblePlayers(selectedTeamId, userSquad, gameState);
  const eligiblePlayers = shuffleArray(rawEligible, randomFn);

  const spinNumber = (gameState.spinHistory || []).length + 1;
  const spinRecord = {
    spinNumber,
    user: currentUserKey,
    initialTeamId: landedTeam.id,
    resultTeamId: selectedTeamId,
    wasRespin,
    timestamp: new Date().toISOString(),
  };

  const updatedGameState = {
    ...gameState,
    status: 'player-selection',
    currentTeamId: selectedTeamId,
    currentEligiblePlayers: eligiblePlayers,
    pendingSelectedPlayerId: null,
    respinNotice: wasRespin
      ? `Wheel landed on ${landedTeam.shortName} (no eligible players). Respun to ${selectedTeamObj.shortName}.`
      : null,
    spinHistory: [...(gameState.spinHistory || []), spinRecord],
  };

  return {
    success: true,
    resultTeamId: selectedTeamId,
    team: selectedTeamObj,
    eligiblePlayers,
    wasRespin,
    spinRecord,
    updatedGameState,
  };
}
