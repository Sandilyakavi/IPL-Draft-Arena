import { getDraftPool, getPlayerById, getDefaultRules } from '../utils/dataLoader.js';

const defaultRules = getDefaultRules();
import { validatePick, canSelectPlayer, getEligiblePlayers } from './ruleEngine.js';
import { spinTeam as wheelSpinTeam, getEligibleTeams } from './wheelEngine.js';

/**
 * DraftEngine — Centralized Immutable State Manager for IPL Draft Arena.
 * Handles 2-player turn alternation, rule enforcement, pick recording, and game progression.
 */

/**
 * Creates the initial game state structure.
 */
export function createInitialGame(customRules = {}, player1Name = 'Player 1', player2Name = 'Player 2') {
  const rules = { ...defaultRules, ...customRules };

  return {
    status: 'setup', // 'setup' | 'spinning' | 'team-selected' | 'player-selection' | 'complete' | 'error'
    currentTurn: 'player1', // 'player1' | 'player2'
    pickNumber: 0, // 0..24
    player1: {
      id: 'player1',
      name: player1Name,
      squad: [],
    },
    player2: {
      id: 'player2',
      name: player2Name,
      squad: [],
    },
    selectedPlayerIds: [], // Globally drafted player IDs
    currentTeamId: null, // Spun franchise ID
    currentEligiblePlayers: [], // Filtered eligible player objects for current turn
    pendingSelectedPlayerId: null, // Player ID selected before confirmation
    pickHistory: [],
    spinHistory: [],
    respinNotice: null,
    error: null,
    rules,
  };
}

/**
 * Starts the draft game. Moves status from 'setup' to 'spinning'.
 */
export function startGame(gameState) {
  if (!gameState) gameState = createInitialGame();
  return {
    ...gameState,
    status: 'spinning',
    error: null,
    respinNotice: null,
  };
}

/**
 * Gets the current active player object.
 */
export function getCurrentPlayer(gameState) {
  if (!gameState) return null;
  return gameState[gameState.currentTurn] || gameState.player1;
}

/**
 * Executes a team wheel spin for the active player.
 */
export function spinTeam(gameState, randomFn = Math.random) {
  if (!gameState) return { success: false, error: 'NO_GAME_STATE' };

  if (gameState.status === 'complete') {
    return { success: false, error: 'DRAFT_ALREADY_COMPLETE', updatedGameState: gameState };
  }

  // Ensure game is in spinning or team-selected state
  if (gameState.status !== 'spinning' && gameState.status !== 'setup') {
    return { success: false, error: 'INVALID_GAME_STATUS_FOR_SPIN', updatedGameState: gameState };
  }

  const spinResult = wheelSpinTeam(gameState, randomFn);
  return spinResult;
}

/**
 * Manually applies a team spin result (useful for deterministic actions or tests).
 */
export function applyTeamResult(gameState, teamId) {
  if (!gameState) return gameState;
  const currentUserKey = gameState.currentTurn;
  const currentUser = gameState[currentUserKey];
  const userSquad = currentUser ? currentUser.squad : [];

  const eligiblePlayers = getEligiblePlayers(teamId, userSquad, gameState, gameState.rules);

  return {
    ...gameState,
    status: 'player-selection',
    currentTeamId: teamId,
    currentEligiblePlayers: eligiblePlayers,
    pendingSelectedPlayerId: null,
    respinNotice: null,
    error: null,
  };
}

/**
 * Selects a pending player from the spun franchise without confirming pick yet.
 */
export function selectPendingPlayer(gameState, playerId) {
  if (!gameState) return { success: false, error: 'NO_GAME_STATE' };

  if (gameState.status !== 'player-selection') {
    return { success: false, error: 'MUST_SPIN_WHEEL_FIRST', reason: 'You must spin the team wheel before selecting a player.' };
  }

  const player = getPlayerById(playerId);
  if (!player) {
    return { success: false, error: 'PLAYER_NOT_FOUND', reason: 'Player record not found.' };
  }

  // Verify player belongs to spun franchise
  if (player.teamId !== gameState.currentTeamId) {
    return {
      success: false,
      error: 'WRONG_FRANCHISE',
      reason: `Player "${player.name}" does not belong to spun franchise ${gameState.currentTeamId.toUpperCase()}.`,
    };
  }

  const currentUser = gameState[gameState.currentTurn];
  const validation = validatePick(player, currentUser.squad, gameState, gameState.rules);
  if (!validation.isValid) {
    return { success: false, error: 'INVALID_PICK', reason: validation.reason };
  }

  const updatedGameState = {
    ...gameState,
    pendingSelectedPlayerId: playerId,
  };

  return {
    success: true,
    player,
    updatedGameState,
  };
}

/**
 * Confirms and executes the pick for the active player.
 * Adds player to squad, updates pick history, and alternates turn.
 */
export function confirmPick(gameState, playerId = null) {
  if (!gameState) return { success: false, error: 'NO_GAME_STATE' };

  const targetPlayerId = playerId || gameState.pendingSelectedPlayerId;

  if (gameState.status !== 'player-selection') {
    return { success: false, error: 'MUST_SPIN_WHEEL_FIRST', reason: 'You must spin the wheel before picking a player.' };
  }

  if (!targetPlayerId) {
    return { success: false, error: 'NO_PLAYER_SELECTED', reason: 'No player selected to confirm.' };
  }

  const player = getPlayerById(targetPlayerId);
  if (!player) {
    return { success: false, error: 'PLAYER_NOT_FOUND', reason: 'Player record not found.' };
  }

  // 1. Verify franchise restriction
  if (player.teamId !== gameState.currentTeamId) {
    return {
      success: false,
      error: 'WRONG_FRANCHISE',
      reason: `Cannot select ${player.name} (${player.teamId.toUpperCase()}) during ${gameState.currentTeamId.toUpperCase()}'s turn.`,
    };
  }

  // 2. Validate all game rules
  const currentUserKey = gameState.currentTurn;
  const currentUser = gameState[currentUserKey];
  const validation = validatePick(player, currentUser.squad, gameState, gameState.rules);

  if (!validation.isValid) {
    return { success: false, error: 'RULE_VIOLATION', reason: validation.reason };
  }

  // 3. Create pick history record
  const pickNumber = gameState.pickNumber + 1;
  const pickRecord = {
    pickNumber,
    player: player.name,
    playerId: player.id,
    teamId: player.teamId,
    role: player.role,
    isOverseas: player.isOverseas,
    isWicketkeeper: player.isWicketkeeper,
    user: currentUserKey,
    userName: currentUser.name,
    timestamp: new Date().toISOString(),
  };

  // 4. Update current user squad
  const updatedUser = {
    ...currentUser,
    squad: [...currentUser.squad, player],
  };

  const nextPickNumber = pickNumber;
  const updatedSelectedIds = [...gameState.selectedPlayerIds, player.id];
  const updatedPickHistory = [...gameState.pickHistory, pickRecord];

  // 5. Check if draft is complete (24 picks total or both reach squadSize)
  const maxPicksTotal = gameState.rules.squadSize * 2;
  const isComplete = nextPickNumber >= maxPicksTotal ||
    (updatedUser.squad.length >= gameState.rules.squadSize &&
     gameState[currentUserKey === 'player1' ? 'player2' : 'player1'].squad.length >= gameState.rules.squadSize);

  // 6. Switch turn if not complete
  const nextTurnUserKey = currentUserKey === 'player1' ? 'player2' : 'player1';

  const updatedGameState = {
    ...gameState,
    status: isComplete ? 'complete' : 'spinning',
    pickNumber: nextPickNumber,
    [currentUserKey]: updatedUser,
    currentTurn: isComplete ? currentUserKey : nextTurnUserKey,
    selectedPlayerIds: updatedSelectedIds,
    currentTeamId: null,
    currentEligiblePlayers: [],
    pendingSelectedPlayerId: null,
    pickHistory: updatedPickHistory,
    respinNotice: null,
    error: null,
  };

  return {
    success: true,
    pickRecord,
    isDraftComplete: isComplete,
    updatedGameState,
  };
}

/**
 * Convenience wrapper: selects and confirms a player in one step.
 */
export function selectPlayer(gameState, playerId) {
  const pendingRes = selectPendingPlayer(gameState, playerId);
  if (!pendingRes.success) return pendingRes;
  return confirmPick(pendingRes.updatedGameState, playerId);
}

/**
 * Manually switch to next turn (if required by state machine).
 */
export function nextTurn(gameState) {
  if (!gameState) return gameState;
  const nextTurnUserKey = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
  return {
    ...gameState,
    currentTurn: nextTurnUserKey,
    status: 'spinning',
    currentTeamId: null,
    currentEligiblePlayers: [],
    pendingSelectedPlayerId: null,
  };
}

/**
 * Checks if the draft is complete.
 */
export function isDraftComplete(gameState) {
  if (!gameState) return false;
  const maxPicks = (gameState.rules?.squadSize || 12) * 2;
  const p1Squad = gameState.player1?.squad || [];
  const p2Squad = gameState.player2?.squad || [];
  return gameState.status === 'complete' ||
    gameState.pickNumber >= maxPicks ||
    (p1Squad.length >= 12 && p2Squad.length >= 12);
}

/**
 * Gets draft progress stats.
 */
export function getDraftProgress(gameState) {
  if (!gameState) return { pickNumber: 0, totalPicks: 24, p1Count: 0, p2Count: 0, status: 'setup' };
  const totalPicks = (gameState.rules?.squadSize || 12) * 2;
  return {
    pickNumber: gameState.pickNumber,
    totalPicks,
    p1Count: gameState.player1?.squad?.length || 0,
    p2Count: gameState.player2?.squad?.length || 0,
    status: gameState.status,
    currentTurn: gameState.currentTurn,
  };
}

/**
 * Returns pick history array.
 */
export function getPickHistory(gameState) {
  return gameState?.pickHistory || [];
}
