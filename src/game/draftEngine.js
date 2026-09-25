import { getDraftPool, getPlayerById, getDefaultRules } from '../utils/dataLoader.js';
import { shuffleArray } from '../utils/shuffle.js';
import { DEFAULT_SEASON } from '../config/seasonConfig.js';
import { DRAFT_CONFIG } from '../config/draftConfig.js';
import { getTurnPlayerForPick, getDraftRound, generateDraftOrder } from './draftOrder.js';

const defaultRules = getDefaultRules();
import { validatePick, canSelectPlayer, getEligiblePlayers } from './ruleEngine.js';
import { spinTeam as wheelSpinTeam, getEligibleTeams } from './wheelEngine.js';

/**
 * DraftEngine — Centralized Immutable State Manager for IPL Draft Arena.
 * Handles 2–4 player turn sequence (dynamic Snake & Alternating modes),
 * rule enforcement, pick recording, and game progression.
 */

export const DEFAULT_AVATARS = ['🏏', '⚡', '🔥', '👑', '🦁', '🐯', '🦅', '🐼'];

/**
 * Creates the initial game state structure with setup configuration.
 * Fully supports 2, 3, or 4 players with backward compatibility for legacy 2-player calls.
 */
export function createInitialGame(customRules = {}, setupConfig = {}) {
  const rules = { ...defaultRules, ...customRules };
  const squadSize = rules.squadSize || DRAFT_CONFIG.SQUAD_SIZE;

  let p1Name = 'Player 1';
  let p2Name = 'Player 2';
  let p1Avatar = '🏏';
  let p2Avatar = '⚡';
  let p1Fav = null;
  let p2Fav = null;
  let firstTurnChoice = 'player1';
  let playerCount = 2;
  let draftMode = 'snake';
  let configuredPlayers = null;

  // Support string arguments for backward compatibility with existing tests
  if (typeof setupConfig === 'string') {
    p1Name = setupConfig;
    if (arguments[2] && typeof arguments[2] === 'string') {
      p2Name = arguments[2];
    }
  } else if (arguments[1] && typeof arguments[1] === 'string') {
    p1Name = arguments[1];
    if (arguments[2] && typeof arguments[2] === 'string') {
      p2Name = arguments[2];
    }
  } else if (setupConfig && typeof setupConfig === 'object') {
    if (setupConfig.playerCount && [2, 3, 4].includes(Number(setupConfig.playerCount))) {
      playerCount = Number(setupConfig.playerCount);
    }
    if (setupConfig.draftMode) {
      draftMode = setupConfig.draftMode;
    }

    if (Array.isArray(setupConfig.players) && setupConfig.players.length >= 2) {
      playerCount = Math.min(4, Math.max(2, setupConfig.players.length));
      configuredPlayers = setupConfig.players.slice(0, playerCount).map((p, idx) => ({
        id: p.id || `player${idx + 1}`,
        name: (p.name || `Player ${idx + 1}`).trim(),
        avatar: p.avatar || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length],
        favoriteTeamId: p.favoriteTeamId || null,
        connected: p.connected !== undefined ? p.connected : true,
        ready: p.ready !== undefined ? p.ready : true,
        squad: Array.isArray(p.squad) ? [...p.squad] : [],
        squadOrder: Array.isArray(p.squadOrder) ? [...p.squadOrder] : [],
        pickCount: p.squad ? p.squad.length : 0,
      }));
    } else {
      if (setupConfig.player1) {
        if (typeof setupConfig.player1 === 'string') p1Name = setupConfig.player1;
        else {
          p1Name = setupConfig.player1.name || 'Player 1';
          p1Avatar = setupConfig.player1.avatar || '🏏';
          p1Fav = setupConfig.player1.favoriteTeamId || null;
        }
      }
      if (setupConfig.player2) {
        if (typeof setupConfig.player2 === 'string') p2Name = setupConfig.player2;
        else {
          p2Name = setupConfig.player2.name || 'Player 2';
          p2Avatar = setupConfig.player2.avatar || '⚡';
          p2Fav = setupConfig.player2.favoriteTeamId || null;
        }
      }
    }

    if (setupConfig.firstTurn) {
      firstTurnChoice = setupConfig.firstTurn;
    }
  }

  p1Name = (p1Name || '').trim() || 'Player 1';
  p2Name = (p2Name || '').trim() || 'Player 2';

  // Build canonical players array
  let players = [];
  if (configuredPlayers) {
    players = configuredPlayers;
  } else {
    players.push({
      id: 'player1',
      name: p1Name,
      avatar: p1Avatar,
      favoriteTeamId: p1Fav,
      connected: true,
      ready: true,
      squad: [],
      squadOrder: [],
      pickCount: 0,
    });
    players.push({
      id: 'player2',
      name: p2Name,
      avatar: p2Avatar,
      favoriteTeamId: p2Fav,
      connected: true,
      ready: true,
      squad: [],
      squadOrder: [],
      pickCount: 0,
    });
    if (playerCount >= 3) {
      players.push({
        id: 'player3',
        name: setupConfig?.player3?.name || 'Player 3',
        avatar: setupConfig?.player3?.avatar || '🔥',
        favoriteTeamId: setupConfig?.player3?.favoriteTeamId || null,
        connected: true,
        ready: true,
        squad: [],
        squadOrder: [],
        pickCount: 0,
      });
    }
    if (playerCount >= 4) {
      players.push({
        id: 'player4',
        name: setupConfig?.player4?.name || 'Player 4',
        avatar: setupConfig?.player4?.avatar || '👑',
        favoriteTeamId: setupConfig?.player4?.favoriteTeamId || null,
        connected: true,
        ready: true,
        squad: [],
        squadOrder: [],
        pickCount: 0,
      });
    }
  }

  const initialTurn = players[0].id;

  const gameState = {
    status: 'setup',
    season: setupConfig?.season || DEFAULT_SEASON,
    playerCount: players.length,
    draftMode,
    currentTurn: initialTurn,
    firstTurnResult: null,
    pickNumber: 0,
    roundNumber: 1,
    pickInRound: 1,
    setup: {
      playerCount: players.length,
      draftMode,
      firstTurn: firstTurnChoice,
      completed: false,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        favoriteTeamId: p.favoriteTeamId,
      })),
      player1: {
        name: players[0].name,
        avatar: players[0].avatar,
        favoriteTeamId: players[0].favoriteTeamId,
      },
      player2: {
        name: players[1].name,
        avatar: players[1].avatar,
        favoriteTeamId: players[1].favoriteTeamId,
      },
    },
    players,
    // Backward compatibility anchors for P1, P2, P3, P4
    player1: players[0],
    player2: players[1],
    ...(players[2] ? { player3: players[2] } : {}),
    ...(players[3] ? { player4: players[3] } : {}),
    selectedPlayerIds: [],
    currentTeamId: null,
    currentEligiblePlayers: [],
    pendingSelectedPlayerId: null,
    pickHistory: [],
    spinHistory: [],
    respinNotice: null,
    error: null,
    rules,
  };

  return gameState;
}

/**
 * Starts the draft game. Resolves first turn and moves status from 'setup' to 'spinning'.
 */
export function startGame(gameState, randomFn = Math.random) {
  if (!gameState) gameState = createInitialGame();

  const players = gameState.players ? [...gameState.players] : [gameState.player1, gameState.player2];
  const playerCount = players.length;

  // Resolve first turn choice
  const firstTurnChoice = gameState.setup?.firstTurn || 'player1';
  let firstTurnKey = players[0].id;

  if (firstTurnChoice === 'random') {
    if (playerCount === 2) {
      firstTurnKey = randomFn() < 0.5 ? 'player1' : 'player2';
    } else {
      const randomIdx = Math.floor(randomFn() * playerCount);
      firstTurnKey = players[randomIdx].id;
    }
  } else {
    const matched = players.find(p => p.id === firstTurnChoice);
    if (matched) {
      firstTurnKey = matched.id;
    } else {
      firstTurnKey = players[0].id;
    }
  }

  const updatedPlayers = players.map(p => ({
    ...p,
    squad: p.squad || [],
    squadOrder: p.squadOrder || [],
  }));

  const updatedState = {
    ...gameState,
    status: 'spinning',
    currentTurn: firstTurnKey,
    firstTurnResult: firstTurnKey,
    playerCount,
    setup: {
      ...gameState.setup,
      completed: true,
    },
    players: updatedPlayers,
    player1: updatedPlayers[0],
    player2: updatedPlayers[1],
    ...(updatedPlayers[2] ? { player3: updatedPlayers[2] } : {}),
    ...(updatedPlayers[3] ? { player4: updatedPlayers[3] } : {}),
    error: null,
    respinNotice: null,
  };

  return updatedState;
}

/**
 * Gets the current active player object.
 */
export function getCurrentPlayer(gameState) {
  if (!gameState) return null;
  if (Array.isArray(gameState.players)) {
    const found = gameState.players.find(p => p.id === gameState.currentTurn);
    if (found) return found;
  }
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

  if (gameState.status !== 'spinning' && gameState.status !== 'setup') {
    return { success: false, error: 'INVALID_GAME_STATUS_FOR_SPIN', updatedGameState: gameState };
  }

  return wheelSpinTeam(gameState, randomFn);
}

/**
 * Manually applies a team spin result.
 */
export function applyTeamResult(gameState, teamId, randomFn = Math.random) {
  if (!gameState) return gameState;
  const currentUser = getCurrentPlayer(gameState);
  const userSquad = currentUser ? currentUser.squad : [];

  const rawEligible = getEligiblePlayers(teamId, userSquad, gameState, gameState.rules);
  const eligiblePlayers = shuffleArray(rawEligible, randomFn);

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

  if (player.teamId !== gameState.currentTeamId) {
    return {
      success: false,
      error: 'WRONG_FRANCHISE',
      reason: `Player "${player.name}" does not belong to spun franchise ${gameState.currentTeamId.toUpperCase()}.`,
    };
  }

  const currentUser = getCurrentPlayer(gameState);
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
 * Adds player to squad, updates pick history, and resolves dynamic turn transition.
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
  const currentUser = getCurrentPlayer(gameState);
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
    userAvatar: currentUser.avatar || '🏏',
    timestamp: new Date().toISOString(),
  };

  // 4. Update current user squad and squadOrder
  const currentSquadOrder = currentUser.squadOrder || currentUser.squad.map(p => p.id);
  const updatedSquadOrder = [...currentSquadOrder, player.id];

  const updatedUser = {
    ...currentUser,
    squad: [...currentUser.squad, player],
    squadOrder: updatedSquadOrder,
    pickCount: (currentUser.pickCount || 0) + 1,
  };

  // Update players array
  const currentPlayers = Array.isArray(gameState.players) ? [...gameState.players] : [gameState.player1, gameState.player2];
  const updatedPlayers = currentPlayers.map(p => p.id === currentUser.id ? updatedUser : p);

  const updatedSelectedIds = [...gameState.selectedPlayerIds, player.id];
  const updatedPickHistory = [...gameState.pickHistory, pickRecord];

  // 5. Check if draft is complete
  const playerCount = updatedPlayers.length;
  const squadSize = gameState.rules?.squadSize || DRAFT_CONFIG.SQUAD_SIZE;
  const maxPicksTotal = squadSize * playerCount;
  const allSquadsFilled = updatedPlayers.every(p => p.squad.length >= squadSize);
  const isComplete = pickNumber >= maxPicksTotal || allSquadsFilled;

  // 6. Switch turn using dynamic draft order (2-player alternation or 3-4 player Snake)
  const nextPickIndex = pickNumber; // 0-indexed for next pick
  let nextTurnUserKey;
  if (isComplete) {
    nextTurnUserKey = currentUserKey;
  } else if (playerCount === 2) {
    // 2-player mode: clean alternation between both players
    nextTurnUserKey = currentUserKey === updatedPlayers[0].id ? updatedPlayers[1].id : updatedPlayers[0].id;
  } else {
    // 3 or 4 players: dynamic snake / alternating draft order
    nextTurnUserKey = getTurnPlayerForPick(
      nextPickIndex,
      playerCount,
      squadSize,
      gameState.draftMode || 'snake',
      updatedPlayers.map(p => p.id)
    );
  }

  const { roundNumber, pickInRound } = getDraftRound(nextPickIndex, playerCount);

  const updatedGameState = {
    ...gameState,
    status: isComplete ? 'complete' : 'spinning',
    pickNumber,
    roundNumber,
    pickInRound,
    players: updatedPlayers,
    [currentUserKey]: updatedUser,
    player1: updatedPlayers[0],
    player2: updatedPlayers[1],
    ...(updatedPlayers[2] ? { player3: updatedPlayers[2] } : {}),
    ...(updatedPlayers[3] ? { player4: updatedPlayers[3] } : {}),
    currentTurn: nextTurnUserKey,
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
 * Manually switch to next turn.
 */
export function nextTurn(gameState) {
  if (!gameState) return gameState;
  const currentPlayers = Array.isArray(gameState.players) ? gameState.players : [gameState.player1, gameState.player2];
  const playerCount = currentPlayers.length;
  const nextPickIndex = gameState.pickNumber;

  let nextTurnKey;
  if (playerCount === 2) {
    nextTurnKey = gameState.currentTurn === currentPlayers[0].id ? currentPlayers[1].id : currentPlayers[0].id;
  } else {
    nextTurnKey = getTurnPlayerForPick(
      nextPickIndex,
      playerCount,
      gameState.rules?.squadSize || 12,
      gameState.draftMode || 'snake',
      currentPlayers.map(p => p.id)
    );
  }

  return {
    ...gameState,
    currentTurn: nextTurnKey,
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
  const players = Array.isArray(gameState.players) ? gameState.players : [gameState.player1, gameState.player2].filter(Boolean);
  const squadSize = gameState.rules?.squadSize || 12;
  const maxPicks = squadSize * players.length;

  return gameState.status === 'complete' ||
    gameState.pickNumber >= maxPicks ||
    (players.length > 0 && players.every(p => (p.squad?.length || 0) >= squadSize));
}

/**
 * Gets draft progress stats.
 */
export function getDraftProgress(gameState) {
  if (!gameState) {
    return {
      pickNumber: 0,
      totalPicks: 24,
      playerCount: 2,
      p1Count: 0,
      p2Count: 0,
      status: 'setup',
      currentTurn: 'player1',
    };
  }

  const players = Array.isArray(gameState.players) ? gameState.players : [gameState.player1, gameState.player2].filter(Boolean);
  const squadSize = gameState.rules?.squadSize || 12;
  const totalPicks = squadSize * players.length;

  return {
    pickNumber: gameState.pickNumber,
    totalPicks,
    playerCount: players.length,
    p1Count: gameState.player1?.squad?.length || 0,
    p2Count: gameState.player2?.squad?.length || 0,
    players: players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, count: p.squad?.length || 0 })),
    status: gameState.status,
    currentTurn: gameState.currentTurn,
    roundNumber: gameState.roundNumber || 1,
    pickInRound: gameState.pickInRound || 1,
  };
}

/**
 * Returns pick history array.
 */
export function getPickHistory(gameState) {
  return gameState?.pickHistory || [];
}

/**
 * Updates squad presentation order for a player without altering canonical squad or pick history.
 */
export function updateSquadOrder(gameState, playerKey, newSquadOrder) {
  if (!gameState) return gameState;
  const user = (Array.isArray(gameState.players) && gameState.players.find(p => p.id === playerKey)) || gameState[playerKey];
  if (!user) return gameState;

  const squad = user.squad || [];
  if (!Array.isArray(newSquadOrder)) return gameState;

  const squadIdSet = new Set(squad.map(p => p.id));
  const newIdSet = new Set(newSquadOrder);

  if (squadIdSet.size !== newIdSet.size || ![...squadIdSet].every(id => newIdSet.has(id))) {
    return gameState;
  }

  const updatedUser = {
    ...user,
    squadOrder: [...newSquadOrder],
  };

  const players = Array.isArray(gameState.players)
    ? gameState.players.map(p => p.id === playerKey ? updatedUser : p)
    : [gameState.player1, gameState.player2];

  return {
    ...gameState,
    players,
    [playerKey]: updatedUser,
    player1: players[0],
    player2: players[1],
    ...(players[2] ? { player3: players[2] } : {}),
    ...(players[3] ? { player4: players[3] } : {}),
  };
}
