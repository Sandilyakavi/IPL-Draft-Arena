/**
 * src/services/multiplayerRoomService.js
 * =================================================================
 * MULTIPLAYER ROOM SERVICE (Phase 8 Step 2)
 * =================================================================
 * Manages Supabase `draft_rooms` queries, collision-safe 6-character room
 * code generation, 2-user room creation & joining, waiting room state,
 * host/guest role resolution, and Supabase Realtime subscriptions.
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

// In-memory fallback room store for demo/offline/testing mode when Supabase is unconfigured
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
        // Fallback to random if query fails
        if (!memoryRooms.has(code)) return code;
      }
    } else {
      if (!memoryRooms.has(code)) return code;
    }
  }

  return generateRoomCode();
}

/**
 * Creates a new multiplayer draft room for host user
 */
export async function createRoom(hostUser, season = '2026') {
  if (!hostUser || !hostUser.id) {
    throw new Error('Host user identity is required to create a multiplayer room');
  }

  const roomCode = await generateCollisionSafeRoomCode();
  const roomContract = createMultiplayerRoomContract(hostUser, roomCode, season);

  if (isSupabaseConfigured && supabase) {
    try {
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
        console.warn('Supabase createRoom warning, using memory room:', error.message);
        memoryRooms.set(roomCode, roomContract);
      } else if (data) {
        memoryRooms.set(roomCode, roomContract);
        return roomContract;
      }
    } catch (err) {
      console.warn('createRoom exception, falling back to memory room:', err.message);
      memoryRooms.set(roomCode, roomContract);
    }
  } else {
    memoryRooms.set(roomCode, roomContract);
  }

  return roomContract;
}

/**
 * Fetches an existing room contract by 6-character room code
 */
export async function fetchRoomByCode(roomCode) {
  if (!roomCode) return null;
  const cleanCode = roomCode.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('draft_rooms')
        .select('*')
        .eq('room_code', cleanCode)
        .maybeSingle();

      if (!error && data) {
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
    } catch (err) {
      // Fallback
    }
  }

  return memoryRooms.get(cleanCode) || null;
}

/**
 * Joins a guest user to an existing waiting draft room
 */
export async function joinRoom(roomCode, guestUser) {
  if (!roomCode) {
    throw new Error('Room code is required to join a room');
  }
  if (!guestUser || !guestUser.id) {
    throw new Error('Guest user identity is required to join a room');
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
    try {
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
        console.warn('Supabase joinRoom update warning:', error.message);
      }
    } catch (err) {
      console.warn('joinRoom exception:', err.message);
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
 * Helper to update memoryRooms entry
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
