/**
 * src/services/multiplayerSyncService.js
 * =================================================================
 * MULTIPLAYER REALTIME TURN SYNCHRONIZATION SERVICE (2–4 PLAYERS)
 * =================================================================
 * Enforces database/state-backed 2–4 player turn synchronization.
 * Handles WHEEL_SPUN, PICK_CONFIRMED, TURN_CHANGED, AUTO_PICK, and GAME_COMPLETED actions.
 * Rejects out-of-turn, duplicate, stale, or unauthorized player actions.
 *
 * PRESERVES 100% single-player local game state independence.
 * =================================================================
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import {
  ROOM_STATUS,
  TURN_ROLES,
  MULTIPLAYER_EVENTS,
  isUserTurn,
  resolveUserRole,
  validateStateTransition,
} from '../multiplayer/multiplayerArchitecture.js';
import { fetchRoomByCode, _setMemoryRoom } from './multiplayerRoomService.js';
import {
  startGame,
  spinTeam,
  confirmPick,
  createInitialGame,
  updateSquadOrder,
  getCurrentPlayer,
} from '../game/draftEngine.js';
import { validatePick } from '../game/ruleEngine.js';
import { getBestAvailablePick } from '../game/pickValueEngine.js';

/**
 * Executes a multiplayer wheel spin action.
 * Enforces turn ownership: only the active turn user can spin the wheel.
 */
export async function executeMultiplayerSpin(roomCode, userId, randomFn = Math.random) {
  if (!roomCode || !userId) {
    throw new Error('Room code and user ID are required to execute a spin');
  }

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract) {
    throw new Error(`Multiplayer room "${roomCode}" not found`);
  }
  if (roomContract.status !== ROOM_STATUS.IN_PROGRESS) {
    throw new Error(`Cannot spin wheel: Room status is ${roomContract.status}`);
  }

  // Ensure game engine state exists
  let gameState = roomContract.gameStateSnapshot;
  if (!gameState || gameState.status === 'setup') {
    gameState = startGame(
      createInitialGame(
        {},
        {
          season: roomContract.season,
          playerCount: roomContract.maxPlayers || 2,
          draftMode: roomContract.draftMode || 'snake',
        }
      ),
      randomFn
    );
  }

  // Authoritative turn ownership validation
  const currentEngineTurn = gameState.currentTurn || roomContract.currentTurnRole;
  if (!isUserTurn(roomContract, userId, currentEngineTurn)) {
    throw new Error('Out-of-turn action rejected: It is not your turn to spin the wheel');
  }

  // Execute wheel spin via game engine
  const spinRes = spinTeam(gameState, randomFn);
  const updatedEngineState = spinRes.updatedGameState || spinRes;
  const currentVersion = (roomContract.version || 1) + 1;

  const timerSecs = roomContract.turnTimerSeconds || 20;
  const turnDeadline = new Date(Date.now() + timerSecs * 1000).toISOString();

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.gameStateSnapshot = updatedEngineState;
  updatedContract.version = currentVersion;
  updatedContract.turnDeadline = turnDeadline;
  updatedContract.updatedAt = new Date().toISOString();

  // Persist to memory store
  _setMemoryRoom(roomCode, updatedContract);

  // Persist to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('draft_rooms')
        .update({
          game_state: updatedContract,
          current_turn_role: updatedEngineState.currentTurn,
          updated_at: updatedContract.updatedAt,
        })
        .eq('room_code', roomCode.toUpperCase());
    } catch (err) {
      console.warn('Supabase spin sync warning:', err.message);
    }
  }

  return {
    roomContract: updatedContract,
    event: MULTIPLAYER_EVENTS.WHEEL_SPUN,
    spunTeamId: updatedEngineState.currentTeamId,
  };
}

/**
 * Executes an authoritative multiplayer player pick confirmation.
 * Validates turn ownership, rules, duplicate picks, and sequence version.
 */
export async function executeMultiplayerPick(roomCode, userId, selectedPlayerId) {
  if (!roomCode || !userId || !selectedPlayerId) {
    throw new Error('Room code, user ID, and selected player ID are required to confirm pick');
  }

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract) {
    throw new Error(`Multiplayer room "${roomCode}" not found`);
  }
  if (roomContract.status !== ROOM_STATUS.IN_PROGRESS) {
    throw new Error(`Cannot confirm pick: Room status is ${roomContract.status}`);
  }

  const gameState = roomContract.gameStateSnapshot;
  if (!gameState || !gameState.currentTeamId) {
    throw new Error('No team selected. You must spin the wheel before confirming a player pick');
  }

  // Authoritative turn ownership validation
  const currentEngineTurn = gameState.currentTurn || roomContract.currentTurnRole;
  if (!isUserTurn(roomContract, userId, currentEngineTurn)) {
    throw new Error('Out-of-turn action rejected: It is not your turn to pick a player');
  }

  // Duplicate pick guard
  if (gameState.selectedPlayerIds && gameState.selectedPlayerIds.includes(selectedPlayerId)) {
    throw new Error(`Duplicate pick rejected: Player "${selectedPlayerId}" has already been selected`);
  }

  // Execute pick via game engine confirmPick
  const pickRes = confirmPick(gameState, selectedPlayerId);
  if (!pickRes.success) {
    throw new Error(`Rule validation failed: ${pickRes.reason || pickRes.error}`);
  }

  const updatedEngineState = pickRes.updatedGameState;
  const playerCount = updatedEngineState.playerCount || roomContract.maxPlayers || 2;
  const squadSize = updatedEngineState.rules?.squadSize || 12;
  const maxPicksTotal = squadSize * playerCount;

  const isComplete = updatedEngineState.status === 'complete' || updatedEngineState.pickNumber >= maxPicksTotal;
  const nextStatus = isComplete ? ROOM_STATUS.COMPLETED : ROOM_STATUS.IN_PROGRESS;
  const currentVersion = (roomContract.version || 1) + 1;

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.status = nextStatus;
  updatedContract.currentTurnRole = updatedEngineState.currentTurn;
  updatedContract.gameStateSnapshot = updatedEngineState;
  updatedContract.version = currentVersion;
  updatedContract.updatedAt = new Date().toISOString();

  // Set synchronized turn deadline for next turn
  const timerSecs = updatedContract.turnTimerSeconds || 20;
  updatedContract.turnDeadline = isComplete ? null : new Date(Date.now() + timerSecs * 1000).toISOString();

  // Sync participants array squads and currentTurnPlayerId
  if (Array.isArray(updatedContract.participants) && Array.isArray(updatedEngineState.players)) {
    updatedContract.participants = updatedContract.participants.map(part => {
      const engineP = updatedEngineState.players.find(p => p.id === part.role);
      if (engineP) {
        return {
          ...part,
          squad: engineP.squad || [],
          pickCount: engineP.squad ? engineP.squad.length : 0,
        };
      }
      return part;
    });

    updatedContract.host = updatedContract.participants[0];
    if (updatedContract.participants[1]) {
      updatedContract.guest = updatedContract.participants[1];
    }

    const activeParticipant = updatedContract.participants.find(p => p.role === updatedEngineState.currentTurn);
    if (activeParticipant) {
      updatedContract.currentTurnPlayerId = activeParticipant.playerId;
    }
  }

  // Persist to memory store
  _setMemoryRoom(roomCode, updatedContract);

  // Persist to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('draft_rooms')
        .update({
          status: nextStatus,
          game_state: updatedContract,
          current_turn_role: updatedEngineState.currentTurn,
          updated_at: updatedContract.updatedAt,
        })
        .eq('room_code', roomCode.toUpperCase());
    } catch (err) {
      console.warn('Supabase pick sync warning:', err.message);
    }
  }

  return {
    roomContract: updatedContract,
    event: isComplete ? MULTIPLAYER_EVENTS.GAME_COMPLETED : MULTIPLAYER_EVENTS.PICK_CONFIRMED,
    nextTurnRole: updatedEngineState.currentTurn,
    pickNumber: updatedEngineState.pickNumber,
    isComplete,
  };
}

/**
 * Executes an auto-pick when turn timer expires.
 * Uses Player Pick Value Engine to select the highest value valid player.
 */
export async function executeMultiplayerAutoPick(roomCode, randomFn = Math.random) {
  if (!roomCode) {
    throw new Error('Room code is required to execute auto pick');
  }

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract || roomContract.status !== ROOM_STATUS.IN_PROGRESS) {
    return null;
  }

  let gameState = roomContract.gameStateSnapshot;
  if (!gameState) return null;

  const currentRole = gameState.currentTurn || roomContract.currentTurnRole;
  const currentParticipant = (Array.isArray(roomContract.participants)
    ? roomContract.participants.find(p => p.role === currentRole)
    : null) || (currentRole === 'player1' ? roomContract.host : roomContract.guest);

  if (!currentParticipant) return null;
  const userId = currentParticipant.playerId || currentParticipant.userId;

  // 1. If wheel has not been spun yet, spin the wheel first
  if (!gameState.currentTeamId || gameState.status !== 'player-selection') {
    const spinRes = await executeMultiplayerSpin(roomCode, userId, randomFn);
    gameState = spinRes.roomContract.gameStateSnapshot;
  }

  // 2. Get eligible players
  const eligiblePlayers = gameState.currentEligiblePlayers || [];
  if (eligiblePlayers.length === 0) {
    return null;
  }

  // 3. Find highest Pick Value player
  const currentUser = getCurrentPlayer(gameState);
  const bestPlayer = getBestAvailablePick(eligiblePlayers, currentUser?.squad || [], gameState.rules, gameState.season);

  if (!bestPlayer) return null;

  // 4. Confirm pick automatically
  const pickRes = await executeMultiplayerPick(roomCode, userId, bestPlayer.id);
  return {
    ...pickRes,
    autoPicked: true,
    player: bestPlayer,
  };
}

/**
 * Re-synchronizes state upon reconnect or turn transition.
 * Ensures the user receives the latest database state snapshot.
 */
export async function syncRoomState(roomCode, userId) {
  if (!roomCode || !userId) return null;

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract) return null;

  const userRole = resolveUserRole(roomContract, userId);
  const currentEngineTurn = roomContract.gameStateSnapshot?.currentTurn || roomContract.currentTurnRole || TURN_ROLES.HOST;
  const isMyTurn = isUserTurn(roomContract, userId, currentEngineTurn);

  return {
    roomContract,
    userRole,
    currentTurnRole: currentEngineTurn,
    isMyTurn,
    gameState: roomContract.gameStateSnapshot,
  };
}

/**
 * Updates squad presentation order in multiplayer game state snapshot.
 * Authoritative: updates room contract, version, memory store and Supabase.
 */
export async function executeMultiplayerUpdateSquadOrder(roomCode, userId, playerKey, newSquadOrder) {
  if (!roomCode || !userId || !playerKey || !newSquadOrder) {
    throw new Error('Room code, user ID, player key, and new squad order are required');
  }

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract) {
    throw new Error(`Multiplayer room "${roomCode}" not found`);
  }

  const userRole = resolveUserRole(roomContract, userId);
  if (!userRole) {
    throw new Error('Unauthorized: User is not a participant in this room');
  }

  // Ensure game engine state exists
  const gameState = roomContract.gameStateSnapshot;
  if (!gameState) {
    throw new Error('No game state snapshot found in room contract');
  }

  const updatedGameState = updateSquadOrder(gameState, playerKey, newSquadOrder);
  const currentVersion = (roomContract.version || 1) + 1;

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.gameStateSnapshot = updatedGameState;
  updatedContract.version = currentVersion;
  updatedContract.updatedAt = new Date().toISOString();

  // Persist to memory store
  _setMemoryRoom(roomCode, updatedContract);

  // Persist to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('draft_rooms')
        .update({
          game_state: updatedContract,
          updated_at: updatedContract.updatedAt,
        })
        .eq('room_code', roomCode.toUpperCase());
    } catch (err) {
      console.warn('Supabase squad order sync warning:', err.message);
    }
  }

  return {
    roomContract: updatedContract,
    event: MULTIPLAYER_EVENTS.SQUAD_ORDER_UPDATED || 'SQUAD_ORDER_UPDATED',
    playerKey,
    squadOrder: newSquadOrder,
  };
}

/**
 * Authoritatively ends/abandons a multiplayer draft match.
 * Validates participant authorization, updates room status to ABANDONED,
 * synchronizes state via memory store and Supabase database.
 */
export async function executeMultiplayerEndDraft(roomCode, userId, reason = 'Draft ended by player') {
  if (!roomCode || !userId) {
    throw new Error('Room code and user ID are required to end draft');
  }

  const roomContract = await fetchRoomByCode(roomCode);
  if (!roomContract) {
    throw new Error(`Multiplayer room "${roomCode}" not found`);
  }

  const userRole = resolveUserRole(roomContract, userId);
  if (!userRole) {
    throw new Error('Unauthorized: Only room participants can end the draft');
  }

  if (!validateStateTransition(roomContract.status, ROOM_STATUS.ABANDONED)) {
    throw new Error(`Cannot end draft: Room status is already ${roomContract.status}`);
  }

  const currentVersion = (roomContract.version || 1) + 1;
  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.status = ROOM_STATUS.ABANDONED;
  updatedContract.abandonedBy = userId;
  updatedContract.abandonedByRole = userRole;
  updatedContract.abandonReason = reason;
  if (updatedContract.gameStateSnapshot) {
    updatedContract.gameStateSnapshot.status = 'abandoned';
  }
  updatedContract.version = currentVersion;
  updatedContract.updatedAt = new Date().toISOString();

  // Persist to memory store
  _setMemoryRoom(roomCode, updatedContract);

  // Persist to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('draft_rooms')
        .update({
          status: ROOM_STATUS.ABANDONED,
          game_state: updatedContract,
          updated_at: updatedContract.updatedAt,
        })
        .eq('room_code', roomCode.toUpperCase());
    } catch (err) {
      console.warn('Supabase end draft sync warning:', err.message);
    }
  }

  return {
    roomContract: updatedContract,
    event: MULTIPLAYER_EVENTS.MATCH_ABANDONED,
    endedBy: userId,
  };
}
