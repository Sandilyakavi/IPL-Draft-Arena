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
  MULTIPLAYER_EVENTS,
  generateRoomCode,
  createMultiplayerRoomContract,
  joinMultiplayerRoomContract,
  resolveUserRole,
  isUserTurn,
} from '../multiplayer/multiplayerArchitecture.js';

// Memory room cache for offline/testing mode when Supabase is not configured
const memoryRooms = new Map();
// In-memory subscription listeners for immediate fan-out across clients in memory mode
const memorySubscribers = new Map();

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
export async function createRoom(
  hostUser,
  season = '2026',
  maxPlayers = 2,
  turnTimerSeconds = 20,
  draftMode = 'snake'
) {
  if (!hostUser || !hostUser.id) {
    throw new Error('Host user identity is required to create a multiplayer room');
  }
  if (hostUser.id === 'demo_user_123' || typeof hostUser.id !== 'string') {
    throw new Error('You must be signed in with a valid account to create an online room');
  }

  const roomCode = await generateCollisionSafeRoomCode();
  const roomContract = createMultiplayerRoomContract(
    hostUser,
    roomCode,
    season,
    maxPlayers,
    turnTimerSeconds,
    draftMode
  );

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
          max_players: maxPlayers,
          turn_timer_seconds: turnTimerSeconds,
          draft_mode: draftMode,
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
 *
 * Production path: calls the join_room() SECURITY DEFINER RPC which
 * atomically validates capacity, assigns the next role slot, inserts
 * into room_participants, and updates draft_rooms — all in one
 * transaction. This eliminates the direct-UPDATE RLS vulnerability.
 *
 * Memory/offline path: uses joinMultiplayerRoomContract() as before.
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

  // ── Production path: use SECURITY DEFINER RPC ──────────────────────
  if (isSupabaseConfigured && supabase) {
    const displayName = guestUser.username || guestUser.email || 'Player';
    const avatar = guestUser.avatar || '🏏';
    const favoriteTeam = guestUser.favoriteTeamId || null;

    const { data, error } = await supabase.rpc('join_room', {
      p_room_code:     cleanCode,
      p_display_name:  displayName,
      p_avatar:        avatar,
      p_favorite_team: favoriteTeam,
    });

    if (error) {
      // Map RPC error code prefixes to user-friendly messages
      const msg = error.message || '';
      if (msg.includes('ROOM_NOT_FOUND')) {
        throw new Error(`Room with code "${cleanCode}" was not found`);
      }
      if (msg.includes('ROOM_FULL')) {
        throw new Error(`Room "${cleanCode}" is full — no more players can join`);
      }
      if (msg.includes('ROOM_NOT_WAITING')) {
        throw new Error(`Room "${cleanCode}" is not open for joining (already started or finished)`);
      }
      if (msg.includes('ALREADY_HOST')) {
        throw new Error('Host cannot join their own room as guest');
      }
      if (msg.includes('UNAUTHENTICATED')) {
        throw new Error('You must be signed in with a valid account to join an online room');
      }
      throw new Error(`Failed to join room: ${msg}`);
    }

    if (!data || !data.ok) {
      throw new Error(`Unexpected response from join_room RPC for room "${cleanCode}"`);
    }

    // The RPC returns the full game_state after the join
    const updatedContract = data.gameState || data.game_state;
    if (!updatedContract) {
      throw new Error('join_room RPC did not return game state');
    }

    memoryRooms.set(cleanCode, updatedContract);

    const isFull = data.isFull || data.status === ROOM_STATUS.IN_PROGRESS;
    const eventName = isFull ? MULTIPLAYER_EVENTS.GAME_STARTED : MULTIPLAYER_EVENTS.PLAYER_JOINED;
    await broadcastRoomEvent(cleanCode, eventName, updatedContract);
    await broadcastRoomEvent(cleanCode, 'ROOM_STATE_UPDATED', updatedContract);

    return updatedContract;
  }

  // ── Memory/offline path (no Supabase) ──────────────────────────────
  const roomContract = memoryRooms.get(cleanCode);
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
  const isFull = updatedContract.status === ROOM_STATUS.IN_PROGRESS;

  memoryRooms.set(cleanCode, updatedContract);

  const eventName = isFull ? MULTIPLAYER_EVENTS.GAME_STARTED : MULTIPLAYER_EVENTS.PLAYER_JOINED;
  await broadcastRoomEvent(cleanCode, eventName, updatedContract);
  await broadcastRoomEvent(cleanCode, 'ROOM_STATE_UPDATED', updatedContract);

  return updatedContract;
}

/**
 * Broadcasts a realtime event and updated contract to all clients subscribed to a room.
 * Delivers immediately to both Supabase Realtime channel and in-memory listeners.
 */
export async function broadcastRoomEvent(roomCode, eventName, payload) {
  if (!roomCode || !payload) return;
  const cleanCode = roomCode.trim().toUpperCase();

  // 1. Fan out to in-memory subscribers (tests, offline mode, same-origin instances)
  const subscribers = memorySubscribers.get(cleanCode);
  if (subscribers && subscribers.size > 0) {
    subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('Memory subscriber callback error:', err.message);
      }
    });
  }

  // 2. Realtime broadcast via Supabase channel if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const channelName = `room:${cleanCode}`;
      let channel = supabase.getChannels().find(
        (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
      );

      if (!channel) {
        channel = supabase.channel(channelName, {
          config: { presence: { key: cleanCode }, broadcast: { self: false } },
        });
        await new Promise((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
              resolve();
            }
          });
        });
      }

      await channel.send({
        type: 'broadcast',
        event: eventName,
        payload,
      });
    } catch (err) {
      console.warn(`Supabase broadcast warning for ${eventName}:`, err.message);
    }
  }
}

/**
 * Subscribes to Supabase Realtime updates, broadcast events, and presence for a room.
 * Dual-channel listener: supports both Supabase Broadcast and postgres_changes.
 */
export function subscribeToRoom(roomCode, onRoomUpdate = () => {}, onPresenceChange = () => {}) {
  if (!roomCode) return () => {};
  const cleanCode = roomCode.trim().toUpperCase();

  // Register in-memory subscriber for instant cross-client synchronization
  if (!memorySubscribers.has(cleanCode)) {
    memorySubscribers.set(cleanCode, new Set());
  }
  memorySubscribers.get(cleanCode).add(onRoomUpdate);

  const cleanupMemory = () => {
    const subs = memorySubscribers.get(cleanCode);
    if (subs) {
      subs.delete(onRoomUpdate);
      if (subs.size === 0) memorySubscribers.delete(cleanCode);
    }
  };

  if (!isSupabaseConfigured || !supabase) {
    return cleanupMemory;
  }

  try {
    const channelName = `room:${cleanCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: cleanCode },
        broadcast: { self: false },
      },
    });

    // 1. Listen to broadcast events (wildcard and explicit lifecycle events)
    channel
      .on('broadcast', { event: '*' }, ({ payload }) => {
        if (payload) {
          memoryRooms.set(cleanCode, payload);
          onRoomUpdate(payload);
        }
      })
      .on('broadcast', { event: MULTIPLAYER_EVENTS.GAME_STARTED }, ({ payload }) => {
        if (payload) {
          memoryRooms.set(cleanCode, payload);
          onRoomUpdate(payload);
        }
      })
      .on('broadcast', { event: 'ROOM_STATE_UPDATED' }, ({ payload }) => {
        if (payload) {
          memoryRooms.set(cleanCode, payload);
          onRoomUpdate(payload);
        }
      });

    // 2. Listen to database postgres_changes updates on draft_rooms
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'draft_rooms', filter: `room_code=eq.${cleanCode}` },
      (payload) => {
        if (payload.new && payload.new.game_state) {
          memoryRooms.set(cleanCode, payload.new.game_state);
          onRoomUpdate(payload.new.game_state);
        }
      }
    );

    // 3. Listen to presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      onPresenceChange(presenceState);
    });

    channel.subscribe();

    return () => {
      cleanupMemory();
      try {
        supabase.removeChannel(channel);
      } catch (err) {}
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err.message);
    return cleanupMemory;
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
  if (Array.isArray(roomContract.participants)) {
    const participant = roomContract.participants.find(p => p.playerId === userId || p.userId === userId);
    if (participant) {
      participant.connected = true;
      participant.isConnected = true;
      participant.lastSeen = new Date().toISOString();
      participant.lastSeenAt = new Date().toISOString();
    }
  }

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
  memorySubscribers.clear();
}
