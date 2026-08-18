/**
 * src/services/multiplayerRoomService.js
 * =================================================================
 * MULTIPLAYER ROOM SERVICE (Phase 8 & 9 Production Hardened)
 * =================================================================
 * Manages Supabase `draft_rooms` queries, collision-safe 6-character room
 * code generation, 2-user room creation & joining, waiting room state,
 * host/guest role resolution, and Supabase Realtime subscriptions.
 *
 * PRODUCTION PERSISTENCE RULE:
 * When Supabase is configured, all database writes (createRoom, joinRoom,
 * fetchRoomByCode) operate strictly on the real database. Database errors
 * throw explicit errors and ARE NOT silently masked with local memory state.
 *
 * PRESERVES 100% single-player local game state independence.
 * =================================================================
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import {
  ROOM_STATUS,
  TURN_ROLES,
  generateRoomCode,
  createMultiplayerRoomContract,
  joinMultiplayerRoomContract,
  resolveUserRole,
  isUserTurn,
} from '../multiplayer/multiplayerArchitecture.js';

// Memory room cache for offline/testing mode when Supabase is not configured
const memoryRooms = new Map();

/**
 * Generates a collision-safe 6-character room code by checking database
 */
export async function generateCollisionSafeRoomCode(client = supabase) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const code = generateRoomCode();

    if (isSupabaseConfigured && client) {
      try {
        const { data, error } = await client
          .from('draft_rooms')
          .select('room_code')
          .eq('room_code', code)
          .maybeSingle();

        if (!error && !data) {
          return code;
        }
      } catch (err) {
        if (!memoryRooms.has(code)) return code;
      }
    } else {
      if (!memoryRooms.has(code)) return code;
    }
  }

  return generateRoomCode();
}

/**
 * Creates a new multiplayer draft room for host user.
 * In production mode, writes strictly to Supabase and throws visible error on failure.
 */
export async function createRoom(hostUser, season = '2026') {
  if (!hostUser || !hostUser.id) {
    throw new Error('Host user identity is required to create a multiplayer room');
  }
  if (hostUser.id === 'demo_user_123' || typeof hostUser.id !== 'string') {
    throw new Error('You must be signed in with a valid account to create an online room');
  }

  const roomCode = await generateCollisionSafeRoomCode();
  const roomContract = createMultiplayerRoomContract(hostUser, roomCode, season);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('draft_rooms')
      .insert([
        {
          room_code: roomCode,
          status: ROOM_STATUS.WAITING,
          host_id: hostUser.id,
          guest_id: null,
          season,
          current_turn_role: TURN_ROLES.HOST,
          game_state: roomContract,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create room in production database: ${error.message}`);
    }

    memoryRooms.set(roomCode, roomContract);
    return roomContract;
  }

  memoryRooms.set(roomCode, roomContract);
  return roomContract;
}

/**
 * Fetches an existing room contract by 6-character room code from production database
 */
export async function fetchRoomByCode(roomCode) {
  if (!roomCode) return null;
  const cleanCode = roomCode.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('draft_rooms')
      .select('*')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch room from database: ${error.message}`);
    }

    if (data) {
      const contract = data.game_state || {
        roomCode: data.room_code,
        status: data.status,
        season: data.season,
        host: { userId: data.host_id, role: TURN_ROLES.HOST },
        guest: data.guest_id ? { userId: data.guest_id, role: TURN_ROLES.GUEST } : null,
        currentTurnRole: data.current_turn_role || TURN_ROLES.HOST,
      };
      memoryRooms.set(cleanCode, contract);
      return contract;
    }
    return null;
  }

  return memoryRooms.get(cleanCode) || null;
}

/**
 * Joins a guest user to an existing waiting draft room.
 * In production mode, updates strictly in Supabase and throws visible error on failure.
 */
export async function joinRoom(roomCode, guestUser) {
  if (!roomCode) {
    throw new Error('Room code is required to join a room');
  }
  if (!guestUser || !guestUser.id) {
    throw new Error('Guest user identity is required to join a room');
  }
  if (guestUser.id === 'demo_user_123' || typeof guestUser.id !== 'string') {
    throw new Error('You must be signed in with a valid account to join an online room');
  }

  const cleanCode = roomCode.trim().toUpperCase();
  const roomContract = await fetchRoomByCode(cleanCode);

  if (!roomContract) {
    throw new Error(`Room with code "${cleanCode}" was not found`);
  }
  if (roomContract.status !== ROOM_STATUS.WAITING) {
    throw new Error(`Room "${cleanCode}" is not open for joining. Current status: ${roomContract.status}`);
  }
  if (roomContract.host.userId === guestUser.id) {
    throw new Error('Host cannot join their own room as guest');
  }

  const updatedContract = joinMultiplayerRoomContract(roomContract, guestUser);

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('draft_rooms')
      .update({
        guest_id: guestUser.id,
        status: ROOM_STATUS.IN_PROGRESS,
        game_state: updatedContract,
        updated_at: new Date().toISOString(),
      })
      .eq('room_code', cleanCode);

    if (error) {
      throw new Error(`Failed to join room in production database: ${error.message}`);
    }
  }

  memoryRooms.set(cleanCode, updatedContract);
  return updatedContract;
}

/**
 * Subscribes to Supabase Realtime updates and presence for a room
 */
export function subscribeToRoom(roomCode, onRoomUpdate = () => {}, onPresenceChange = () => {}) {
  if (!roomCode) return () => {};
  const cleanCode = roomCode.trim().toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  try {
    const channel = supabase.channel(`room:${cleanCode}`, {
      config: { presence: { key: cleanCode } },
    });

    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'draft_rooms', filter: `room_code=eq.${cleanCode}` },
        (payload) => {
          if (payload.new && payload.new.game_state) {
            onRoomUpdate(payload.new.game_state);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        onPresenceChange(presenceState);
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {}
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err.message);
    return () => {};
  }
}

/**
 * Reconnects a user to an active room and restores identity role
 */
export async function reconnectRoom(roomCode, userId) {
  if (!roomCode || !userId) return null;
  const cleanCode = roomCode.trim().toUpperCase();
  const roomContract = await fetchRoomByCode(cleanCode);

  if (!roomContract) return null;

  const role = resolveUserRole(roomContract, userId);
  if (!role) return null;

  // Restore connection state
  if (role === TURN_ROLES.HOST && roomContract.host) {
    roomContract.host.isConnected = true;
    roomContract.host.lastSeenAt = new Date().toISOString();
  } else if (role === TURN_ROLES.GUEST && roomContract.guest) {
    roomContract.guest.isConnected = true;
    roomContract.guest.lastSeenAt = new Date().toISOString();
  }

  return {
    roomContract,
    userRole: role,
    isMyTurn: isUserTurn(roomContract, userId),
  };
}

/**
 * Helper to update memoryRooms entry (for offline/test execution)
 */
export function _setMemoryRoom(roomCode, contract) {
  if (!roomCode || !contract) return;
  memoryRooms.set(roomCode.trim().toUpperCase(), contract);
}

/**
 * Helper to reset/clear memoryRooms (for testing)
 */
export function _resetMemoryRooms() {
  memoryRooms.clear();
}
