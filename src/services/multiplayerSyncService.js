/**
 * src/services/multiplayerSyncService.js
 * =================================================================
 * MULTIPLAYER REALTIME TURN SYNCHRONIZATION SERVICE (Phase 8 Step 3)
 * =================================================================
 * Enforces database/state-backed 2-player turn synchronization.
 * Handles WHEEL_SPUN, PICK_CONFIRMED, TURN_CHANGED, and GAME_COMPLETED actions.
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
} from '../multiplayer/multiplayerArchitecture.js';
import { fetchRoomByCode, _setMemoryRoom } from './multiplayerRoomService.js';
import { startGame, spinTeam, confirmPick, createInitialGame } from '../game/draftEngine.js';
import { validatePick } from '../game/ruleEngine.js';

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
    gameState = startGame(createInitialGame({}, { season: roomContract.season }), randomFn);
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

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.gameStateSnapshot = updatedEngineState;
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
  const isComplete = updatedEngineState.status === 'complete' || updatedEngineState.pickNumber >= 24;
  const nextStatus = isComplete ? ROOM_STATUS.COMPLETED : ROOM_STATUS.IN_PROGRESS;
  const currentVersion = (roomContract.version || 1) + 1;

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.status = nextStatus;
  updatedContract.currentTurnRole = updatedEngineState.currentTurn;
  updatedContract.gameStateSnapshot = updatedEngineState;
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
