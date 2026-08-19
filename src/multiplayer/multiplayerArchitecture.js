/**
 * src/multiplayer/multiplayerArchitecture.js
 * =================================================================
 * MULTIPLAYER ARCHITECTURE FOUNDATION (Phase 8 Step 1)
 * =================================================================
 * Defines the core 2-player state contracts, room lifecycle states,
 * turn ownership validation, room code generation, Supabase RLS schema
 * definitions, and realtime event protocols.
 *
 * PRESERVES 100% backward compatibility with single-player local game state.
 * =================================================================
 */

import { createInitialGame, startGame } from '../game/draftEngine.js';

// 1. Room Lifecycle Constants
export const ROOM_STATUS = {
  WAITING: 'waiting_for_opponent',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
};

export const TURN_ROLES = {
  HOST: 'player1',
  GUEST: 'player2',
};

// 2. Realtime Broadcast Event Protocol
export const MULTIPLAYER_EVENTS = {
  ROOM_JOINED: 'ROOM_JOINED',
  WHEEL_SPUN: 'WHEEL_SPUN',
  PICK_CONFIRMED: 'PICK_CONFIRMED',
  TURN_CHANGED: 'TURN_CHANGED',
  PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED',
  PLAYER_RECONNECTED: 'PLAYER_RECONNECTED',
  SQUAD_ORDER_UPDATED: 'SQUAD_ORDER_UPDATED',
  GAME_COMPLETED: 'GAME_COMPLETED',
  MATCH_ABANDONED: 'MATCH_ABANDONED',
};

/**
 * Generates a clean 6-character uppercase alphanumeric room code (e.g. "IPL92X")
 */
export function generateRoomCode(randomFn = Math.random) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(randomFn() * chars.length));
  }
  return code;
}

/**
 * Creates an initial multiplayer room contract wrapping the draft engine game state
 */
export function createMultiplayerRoomContract(hostUser, roomCode = generateRoomCode(), season = '2026') {
  if (!hostUser || !hostUser.id) {
    throw new Error('Host user identity is required to create a multiplayer room contract');
  }

  return {
    roomCode: roomCode.toUpperCase(),
    status: ROOM_STATUS.WAITING,
    season,
    host: {
      userId: hostUser.id,
      username: hostUser.username || hostUser.email || 'Host Player',
      avatar: hostUser.avatar || '🏏',
      favoriteTeamId: hostUser.favoriteTeamId || null,
      role: TURN_ROLES.HOST,
      isConnected: true,
      lastSeenAt: new Date().toISOString(),
    },
    guest: null,
    currentTurnRole: TURN_ROLES.HOST,
    gameStateSnapshot: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Joins a guest user to an existing waiting room contract
 */
export function joinMultiplayerRoomContract(roomContract, guestUser) {
  if (!roomContract) {
    throw new Error('Room contract does not exist');
  }
  if (roomContract.status !== ROOM_STATUS.WAITING) {
    throw new Error(`Room is not open for joining. Current status: ${roomContract.status}`);
  }
  if (!guestUser || !guestUser.id) {
    throw new Error('Guest user identity is required to join a room contract');
  }
  if (guestUser.id === roomContract.host.userId) {
    throw new Error('Host cannot join their own room as guest');
  }

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.guest = {
    userId: guestUser.id,
    username: guestUser.username || guestUser.email || 'Guest Player',
    avatar: guestUser.avatar || '⚡',
    favoriteTeamId: guestUser.favoriteTeamId || null,
    role: TURN_ROLES.GUEST,
    isConnected: true,
    lastSeenAt: new Date().toISOString(),
  };
  updatedContract.status = ROOM_STATUS.IN_PROGRESS;
  updatedContract.updatedAt = new Date().toISOString();

  // Initialize active draft engine game state for the 2-player match
  if (!updatedContract.gameStateSnapshot || updatedContract.gameStateSnapshot.status === 'setup') {
    const setupState = createInitialGame(
      {},
      {
        player1: {
          name: updatedContract.host.username || 'Host Player',
          avatar: updatedContract.host.avatar || '🏏',
          favoriteTeamId: updatedContract.host.favoriteTeamId || null,
        },
        player2: {
          name: updatedContract.guest.username || 'Guest Player',
          avatar: updatedContract.guest.avatar || '⚡',
          favoriteTeamId: updatedContract.guest.favoriteTeamId || null,
        },
        firstTurn: 'player1',
        season: updatedContract.season || '2026',
      }
    );
    updatedContract.gameStateSnapshot = startGame(setupState);
  }

  return updatedContract;
}

/**
 * Resolves which player role ('player1' or 'player2') a userId belongs to in a room contract
 */
export function resolveUserRole(roomContract, userId) {
  if (!roomContract || !userId) return null;
  if (roomContract.host && roomContract.host.userId === userId) return TURN_ROLES.HOST;
  if (roomContract.guest && roomContract.guest.userId === userId) return TURN_ROLES.GUEST;
  return null;
}

/**
 * Checks if a specific userId owns the current turn in the room contract
 */
export function isUserTurn(roomContract, userId, engineCurrentTurn = null) {
  if (!roomContract || !userId) return false;
  const userRole = resolveUserRole(roomContract, userId);
  if (!userRole) return false;

  const activeTurnRole = engineCurrentTurn || roomContract.currentTurnRole || TURN_ROLES.HOST;
  return userRole === activeTurnRole;
}

/**
 * Validates multiplayer state transition boundaries
 */
export function validateStateTransition(currentStatus, targetStatus) {
  const ALLOWED_TRANSITIONS = {
    [ROOM_STATUS.WAITING]: [ROOM_STATUS.IN_PROGRESS, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.IN_PROGRESS]: [ROOM_STATUS.COMPLETED, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.COMPLETED]: [],
    [ROOM_STATUS.ABANDONED]: [],
  };

  const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
  return validNextStates.includes(targetStatus);
}

/**
 * Supabase SQL Schema Specification for Phase 8 Database Migration
 */
export const SUPABASE_MULTIPLAYER_SCHEMA_SPEC = {
  tableName: 'draft_rooms',
  columns: [
    { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()' },
    { name: 'room_code', type: 'VARCHAR(6) UNIQUE NOT NULL' },
    { name: 'status', type: 'VARCHAR(30) NOT NULL' },
    { name: 'host_id', type: 'UUID REFERENCES auth.users(id) NOT NULL' },
    { name: 'guest_id', type: 'UUID REFERENCES auth.users(id)' },
    { name: 'season', type: 'VARCHAR(10) DEFAULT \'2026\'' },
    { name: 'current_turn_role', type: 'VARCHAR(10) DEFAULT \'player1\'' },
    { name: 'game_state', type: 'JSONB' },
    { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()' },
    { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()' },
  ],
  rlsPolicies: [
    {
      name: 'Users can read rooms they participate in or query by code',
      definition: 'auth.uid() = host_id OR auth.uid() = guest_id OR status = \'waiting_for_opponent\'',
    },
    {
      name: 'Host can insert new room',
      definition: 'auth.uid() = host_id',
    },
    {
      name: 'Participants can update room state',
      definition: 'auth.uid() = host_id OR auth.uid() = guest_id OR (guest_id IS NULL AND status = \'waiting_for_opponent\')',
    },
  ],
};
