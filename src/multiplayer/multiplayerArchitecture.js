/**
 * src/multiplayer/multiplayerArchitecture.js
 * =================================================================
 * MULTIPLAYER ARCHITECTURE FOUNDATION (2–4 PLAYERS)
 * =================================================================
 * Defines core 2–4 player state contracts, room lifecycle states,
 * turn ownership validation, room code generation, Supabase RLS schema
 * definitions, and realtime event protocols.
 *
 * PRESERVES 100% backward compatibility with single-player local game state
 * and existing 2-player contracts.
 * =================================================================
 */

import { createInitialGame, startGame } from '../game/draftEngine.js';
import { DRAFT_CONFIG } from '../config/draftConfig.js';
import { generateDraftOrder } from '../game/draftOrder.js';

// 1. Room Lifecycle Constants
export const ROOM_STATUS = {
  WAITING: 'waiting_for_opponent',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
};

export const TURN_ROLES = {
  HOST: 'player1',
  GUEST: 'player2',
  PLAYER1: 'player1',
  PLAYER2: 'player2',
  PLAYER3: 'player3',
  PLAYER4: 'player4',
};

// 2. Realtime Broadcast Event Protocol
export const MULTIPLAYER_EVENTS = {
  // Lifecycle & Lobby
  ROOM_JOINED: 'ROOM_JOINED',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  PLAYER_READY: 'PLAYER_READY',
  GAME_STARTED: 'GAME_STARTED',

  // Wheel & Selection
  WHEEL_SPUN: 'WHEEL_SPUN',
  SPIN_STARTED: 'SPIN_STARTED',
  WHEEL_LANDED: 'WHEEL_LANDED',
  PLAYER_SELECTION_STARTED: 'PLAYER_SELECTION_STARTED',
  PICK_CONFIRMED: 'PICK_CONFIRMED',
  PLAYER_SELECTED: 'PLAYER_SELECTED',

  // Turns & Rounds
  TURN_CHANGED: 'TURN_CHANGED',
  ROUND_CHANGED: 'ROUND_CHANGED',
  DRAFT_PAUSED: 'DRAFT_PAUSED',
  TIMER_TICK: 'TIMER_TICK',
  AUTO_PICK_EXECUTED: 'AUTO_PICK_EXECUTED',

  // Connection & Maintenance
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
 * Creates an initial multiplayer room contract supporting 2–4 players.
 */
export function createMultiplayerRoomContract(
  hostUser,
  roomCode = generateRoomCode(),
  season = '2026',
  maxPlayers = DRAFT_CONFIG.DEFAULT_PLAYER_COUNT,
  turnTimerSeconds = DRAFT_CONFIG.TIMERS.DEFAULT,
  draftMode = 'snake'
) {
  if (!hostUser || !hostUser.id) {
    throw new Error('Host user identity is required to create a multiplayer room contract');
  }

  const cleanMaxPlayers = [2, 3, 4].includes(Number(maxPlayers)) ? Number(maxPlayers) : 2;
  const cleanTimer = [10, 15, 20, 30].includes(Number(turnTimerSeconds)) ? Number(turnTimerSeconds) : 20;

  const hostParticipant = {
    playerId: hostUser.id,
    userId: hostUser.id,
    username: hostUser.username || hostUser.email || 'Host Player',
    displayName: hostUser.username || hostUser.email || 'Host Player',
    avatar: hostUser.avatar || '🏏',
    favoriteTeamId: hostUser.favoriteTeamId || null,
    role: TURN_ROLES.HOST,
    roleIndex: 0,
    ready: true,
    connected: true,
    isConnected: true,
    lastSeen: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    squad: [],
    pickCount: 0,
  };

  return {
    roomId: roomCode.toUpperCase(),
    roomCode: roomCode.toUpperCase(),
    status: ROOM_STATUS.WAITING,
    season,
    hostId: hostUser.id,
    maxPlayers: cleanMaxPlayers,
    draftMode,
    squadSize: DRAFT_CONFIG.SQUAD_SIZE,
    turnTimerSeconds: cleanTimer,
    turnDeadline: null,
    draftRound: 1,
    draftPickNumber: 0,
    draftOrder: generateDraftOrder(cleanMaxPlayers, DRAFT_CONFIG.SQUAD_SIZE, draftMode),
    participants: [hostParticipant],
    // Backward compatibility anchors for P1 / P2
    host: hostParticipant,
    guest: null,
    currentTurnRole: TURN_ROLES.HOST,
    currentTurnPlayerId: hostUser.id,
    gameStateSnapshot: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Joins a guest user to an existing waiting room contract.
 * Supports up to maxPlayers (2, 3, or 4). Rejects 5th player.
 */
export function joinMultiplayerRoomContract(roomContract, guestUser) {
  if (!roomContract) {
    throw new Error('Room contract does not exist');
  }
  if (roomContract.status !== ROOM_STATUS.WAITING && roomContract.status !== ROOM_STATUS.READY) {
    throw new Error(`Room is not open for joining. Current status: ${roomContract.status}`);
  }
  if (!guestUser || !guestUser.id) {
    throw new Error('Guest user identity is required to join a room contract');
  }
  if (guestUser.id === roomContract.host.userId || guestUser.id === roomContract.hostId) {
    throw new Error('Host cannot join their own room as guest');
  }

  const participants = Array.isArray(roomContract.participants)
    ? [...roomContract.participants]
    : [roomContract.host];

  const maxPlayers = roomContract.maxPlayers || 2;

  // Prevent duplicate joining by same user
  const existingIdx = participants.findIndex(p => p.playerId === guestUser.id || p.userId === guestUser.id);
  if (existingIdx !== -1) {
    // Reconnect/rejoin existing participant
    const updatedContract = JSON.parse(JSON.stringify(roomContract));
    updatedContract.participants[existingIdx].connected = true;
    updatedContract.participants[existingIdx].isConnected = true;
    updatedContract.participants[existingIdx].lastSeen = new Date().toISOString();
    return updatedContract;
  }

  // Reject joining full room
  if (participants.length >= maxPlayers) {
    throw new Error(`Room is full (maximum ${maxPlayers} players reached)`);
  }

  const newIndex = participants.length;
  const roleName = `player${newIndex + 1}`;
  const defaultAvatars = ['🏏', '⚡', '🔥', '👑'];

  const newParticipant = {
    playerId: guestUser.id,
    userId: guestUser.id,
    username: guestUser.username || guestUser.email || `Player ${newIndex + 1}`,
    displayName: guestUser.username || guestUser.email || `Player ${newIndex + 1}`,
    avatar: guestUser.avatar || defaultAvatars[newIndex % defaultAvatars.length],
    favoriteTeamId: guestUser.favoriteTeamId || null,
    role: roleName,
    roleIndex: newIndex,
    ready: true,
    connected: true,
    isConnected: true,
    lastSeen: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    squad: [],
    pickCount: 0,
  };

  const updatedParticipants = [...participants, newParticipant];
  const isFull = updatedParticipants.length >= maxPlayers;

  const updatedContract = JSON.parse(JSON.stringify(roomContract));
  updatedContract.participants = updatedParticipants;
  updatedContract.maxPlayers = maxPlayers;

  // Set guest property for backward compatibility (Player 2)
  if (updatedParticipants[1]) {
    updatedContract.guest = updatedParticipants[1];
  }

  // If room is full, transition to IN_PROGRESS
  if (isFull) {
    updatedContract.status = ROOM_STATUS.IN_PROGRESS;
  } else {
    updatedContract.status = ROOM_STATUS.WAITING;
  }

  updatedContract.updatedAt = new Date().toISOString();

  // Initialize active draft engine game state
  if (isFull && (!updatedContract.gameStateSnapshot || updatedContract.gameStateSnapshot.status === 'setup')) {
    const setupPlayers = updatedParticipants.map((p, idx) => ({
      id: `player${idx + 1}`,
      name: p.username || `Player ${idx + 1}`,
      avatar: p.avatar,
      favoriteTeamId: p.favoriteTeamId,
      squad: [],
      squadOrder: [],
    }));

    const setupState = createInitialGame(
      {},
      {
        playerCount: maxPlayers,
        draftMode: updatedContract.draftMode || 'snake',
        players: setupPlayers,
        season: updatedContract.season || '2026',
        firstTurn: 'player1',
      }
    );

    const activeState = startGame(setupState);
    updatedContract.gameStateSnapshot = activeState;
    updatedContract.currentTurnRole = activeState.currentTurn;
    updatedContract.currentTurnPlayerId = updatedParticipants[0].playerId;

    // Set synchronized turn deadline
    const timerSecs = updatedContract.turnTimerSeconds || 20;
    updatedContract.turnDeadline = new Date(Date.now() + timerSecs * 1000).toISOString();
  }

  return updatedContract;
}

/**
 * Resolves which player role ('player1', 'player2', 'player3', 'player4') a userId belongs to.
 */
export function resolveUserRole(roomContract, userId) {
  if (!roomContract || !userId) return null;

  if (Array.isArray(roomContract.participants)) {
    const found = roomContract.participants.find(p => p.playerId === userId || p.userId === userId);
    if (found) return found.role;
  }

  if (roomContract.host && (roomContract.host.userId === userId || roomContract.host.playerId === userId)) {
    return TURN_ROLES.HOST;
  }
  if (roomContract.guest && (roomContract.guest.userId === userId || roomContract.guest.playerId === userId)) {
    return TURN_ROLES.GUEST;
  }

  return null;
}

/**
 * Checks if a specific userId owns the current turn in the room contract.
 */
export function isUserTurn(roomContract, userId, engineCurrentTurn = null) {
  if (!roomContract || !userId) return false;
  const userRole = resolveUserRole(roomContract, userId);
  if (!userRole) return false;

  const activeTurnRole = engineCurrentTurn || roomContract.currentTurnRole || TURN_ROLES.HOST;
  return userRole === activeTurnRole;
}

/**
 * Validates multiplayer state transition boundaries.
 */
export function validateStateTransition(currentStatus, targetStatus) {
  const ALLOWED_TRANSITIONS = {
    [ROOM_STATUS.WAITING]: [ROOM_STATUS.READY, ROOM_STATUS.IN_PROGRESS, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.READY]: [ROOM_STATUS.IN_PROGRESS, ROOM_STATUS.WAITING, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.IN_PROGRESS]: [ROOM_STATUS.PAUSED, ROOM_STATUS.COMPLETED, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.PAUSED]: [ROOM_STATUS.IN_PROGRESS, ROOM_STATUS.ABANDONED],
    [ROOM_STATUS.COMPLETED]: [],
    [ROOM_STATUS.ABANDONED]: [],
  };

  const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
  return validNextStates.includes(targetStatus);
}

/**
 * Supabase SQL Schema Specification for Multiplayer Rooms.
 */
export const SUPABASE_MULTIPLAYER_SCHEMA_SPEC = {
  tableName: 'draft_rooms',
  columns: [
    { name: 'id', type: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()' },
    { name: 'room_code', type: 'VARCHAR(6) UNIQUE NOT NULL' },
    { name: 'status', type: 'VARCHAR(30) NOT NULL' },
    { name: 'host_id', type: 'UUID REFERENCES auth.users(id) NOT NULL' },
    { name: 'guest_id', type: 'UUID REFERENCES auth.users(id)' },
    { name: 'max_players', type: 'INTEGER DEFAULT 2' },
    { name: 'participants', type: 'JSONB DEFAULT \'[]\'' },
    { name: 'turn_timer_seconds', type: 'INTEGER DEFAULT 20' },
    { name: 'turn_deadline', type: 'TIMESTAMPTZ' },
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
