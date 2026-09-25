/**
 * scripts/test-rls-join.js
 * =============================================================
 * Regression tests for the join_room() RPC and RLS hardening.
 *
 * Tests run against the in-memory path using
 * joinMultiplayerRoomContract() to validate business logic that
 * mirrors the SQL SECURITY DEFINER function exactly.
 *
 * SQL-level verification instructions are at the bottom.
 * =============================================================
 * Run: node --experimental-vm-modules scripts/test-rls-join.js
 */

import {
  createMultiplayerRoomContract,
  joinMultiplayerRoomContract,
  ROOM_STATUS,
} from '../src/multiplayer/multiplayerArchitecture.js';

// ── Helpers ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ ok: true, label });
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    results.push({ ok: false, label, detail });
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function assertThrows(label, fn, expectedSubstring) {
  try {
    fn();
    failed++;
    results.push({ ok: false, label, detail: 'Expected exception was not thrown' });
    console.error(`  ❌ ${label} — Expected exception was not thrown`);
  } catch (err) {
    const ok = expectedSubstring ? err.message.toLowerCase().includes(expectedSubstring.toLowerCase()) : true;
    if (ok) {
      passed++;
      results.push({ ok: true, label });
      console.log(`  ✅ ${label}`);
    } else {
      failed++;
      results.push({ ok: false, label, detail: `Got: "${err.message}"` });
      console.error(`  ❌ ${label} — Got: "${err.message}"`);
    }
  }
}

/** Mirrors the reconnect logic in join_room() SQL DEFINER: check duplicate FIRST */
function joinRoomSimulated(roomContract, user) {
  // Duplicate/reconnect check before status check (mirrors fixed SQL order)
  const existing = roomContract.participants?.find(p => p.userId === user.id || p.playerId === user.id);
  if (existing) {
    // Return current state with rejoined=true regardless of room status
    return { contract: roomContract, rejoined: true };
  }
  // Only for new joiners: status check
  if (roomContract.status !== ROOM_STATUS.WAITING) {
    throw new Error(`ROOM_NOT_WAITING: Room is not open for joining (status: ${roomContract.status})`);
  }
  // Capacity check
  const maxPlayers = roomContract.maxPlayers || 2;
  if (roomContract.participants.length >= maxPlayers) {
    throw new Error(`ROOM_FULL: Room is full (${roomContract.participants.length}/${maxPlayers})`);
  }
  return { contract: joinMultiplayerRoomContract(roomContract, user), rejoined: false };
}

function makeUser(n) {
  return {
    id: `user-uuid-${n}-${'a'.repeat(30)}`.slice(0, 36),
    username: `Player ${n}`,
    avatar: ['🏏', '⚡', '🔥', '👑'][n - 1] || '🏏',
    favoriteTeamId: null,
    email: `player${n}@test.com`,
  };
}

// ── Suite 1: 2-player lifecycle ────────────────────────────────────
console.log('\n📋 Suite 1: 2-Player Full Lifecycle');
{
  const host = makeUser(1);
  const p2   = makeUser(2);
  const room = createMultiplayerRoomContract(host, 'TEST01', '2026', 2, 20, 'snake');

  assert('Room created with status=waiting',      room.status === ROOM_STATUS.WAITING);
  assert('Initial participants count = 1',        room.participants.length === 1);
  assert('Host is player1',                       room.participants[0].role === 'player1');
  assert('maxPlayers=2',                          room.maxPlayers === 2);

  const joined = joinMultiplayerRoomContract(room, p2);

  assert('After P2: status=in_progress',          joined.status === ROOM_STATUS.IN_PROGRESS);
  assert('After P2: 2 participants',              joined.participants.length === 2);
  assert('P2 assigned player2',                   joined.participants[1].role === 'player2');
  assert('guest backward-compat set',             joined.guest?.userId === p2.id);
  assert('draftOrder generated',                  Array.isArray(joined.draftOrder) && joined.draftOrder.length > 0);
  assert('gameStateSnapshot initialised',         joined.gameStateSnapshot !== null);
}

// ── Suite 2: 3-player lifecycle ────────────────────────────────────
console.log('\n📋 Suite 2: 3-Player Full Lifecycle');
{
  const [host, p2, p3] = [1, 2, 3].map(makeUser);
  const room = createMultiplayerRoomContract(host, 'TEST02', '2026', 3, 20, 'snake');

  assert('3p: maxPlayers=3',                     room.maxPlayers === 3);

  const after2 = joinMultiplayerRoomContract(room, p2);
  assert('After P2: still waiting (3p)',          after2.status === ROOM_STATUS.WAITING);
  assert('After P2: 2 participants',              after2.participants.length === 2);

  const after3 = joinMultiplayerRoomContract(after2, p3);
  assert('After P3: in_progress (3p)',            after3.status === ROOM_STATUS.IN_PROGRESS);
  assert('After P3: 3 participants',              after3.participants.length === 3);
  assert('P3 is player3',                         after3.participants[2].role === 'player3');
  assert('guest=P2 backward compat (3p)',         after3.guest?.userId === p2.id);
  assert('draftOrder for 3 players',              Array.isArray(after3.draftOrder) && after3.draftOrder.length > 0);
  assert('gameStateSnapshot for 3 players',       after3.gameStateSnapshot !== null);
}

// ── Suite 3: 4-player lifecycle ────────────────────────────────────
console.log('\n📋 Suite 3: 4-Player Full Lifecycle');
{
  const [host, p2, p3, p4] = [1, 2, 3, 4].map(makeUser);
  const room = createMultiplayerRoomContract(host, 'TEST03', '2026', 4, 20, 'snake');

  const after2 = joinMultiplayerRoomContract(room,   p2);
  const after3 = joinMultiplayerRoomContract(after2, p3);
  const after4 = joinMultiplayerRoomContract(after3, p4);

  assert('4p: after P4 — in_progress',           after4.status === ROOM_STATUS.IN_PROGRESS);
  assert('4p: 4 participants',                    after4.participants.length === 4);
  assert('P2=player2, P3=player3, P4=player4',
    after4.participants[1].role === 'player2' &&
    after4.participants[2].role === 'player3' &&
    after4.participants[3].role === 'player4');
  assert('4p: role uniqueness',
    new Set(after4.participants.map(p => p.role)).size === 4);
  assert('4p: draftOrder non-empty',             after4.draftOrder.length > 0);
  assert('4p: gameStateSnapshot',                after4.gameStateSnapshot !== null);
}

// ── Suite 4: 5th player rejected ──────────────────────────────────
console.log('\n📋 Suite 4: 5th Player Rejected');
{
  const [host, p2, p3, p4, p5] = [1, 2, 3, 4, 5].map(makeUser);
  const room = createMultiplayerRoomContract(host, 'TEST04', '2026', 4, 20, 'snake');

  const full = joinMultiplayerRoomContract(
    joinMultiplayerRoomContract(
      joinMultiplayerRoomContract(room, p2), p3), p4);

  assert('4p: room is full and in_progress',     full.status === ROOM_STATUS.IN_PROGRESS);

  // Test via simulated RPC (status check comes AFTER reconnect check for existing users)
  assertThrows(
    '5th player rejected — ROOM_NOT_WAITING (status=in_progress)',
    () => joinRoomSimulated(full, p5),
    'ROOM_NOT_WAITING'
  );
}

// ── Suite 5: Reconnect WHILE waiting (before in_progress) ─────────
console.log('\n📋 Suite 5: Reconnect While Waiting');
{
  const [host, p2, p3] = [1, 2, 3].map(makeUser);
  const room   = createMultiplayerRoomContract(host, 'TEST05', '2026', 3, 20, 'snake');
  const after2 = joinMultiplayerRoomContract(room, p2);

  // P2 reconnects while room is still waiting
  const { contract: reconnected, rejoined } = joinRoomSimulated(after2, p2);

  assert('Reconnect while waiting: rejoined=true', rejoined === true);
  assert('Reconnect while waiting: count unchanged', reconnected.participants.length === 2);
  assert('Reconnect while waiting: status=waiting', reconnected.status === ROOM_STATUS.WAITING);

  // P3 can still join after P2 reconnect
  const after3 = joinMultiplayerRoomContract(reconnected, p3);
  assert('P3 joins after P2 reconnect',           after3.participants.length === 3);
  assert('Room full after P3',                    after3.status === ROOM_STATUS.IN_PROGRESS);
}

// ── Suite 6: Reconnect AFTER in_progress ─────────────────────────
console.log('\n📋 Suite 6: Reconnect After Room Becomes IN_PROGRESS');
{
  const [host, p2, p3] = [1, 2, 3].map(makeUser);
  const room   = createMultiplayerRoomContract(host, 'TEST06', '2026', 3, 20, 'snake');
  const after2 = joinMultiplayerRoomContract(room,   p2);
  const full   = joinMultiplayerRoomContract(after2, p3);

  assert('3p: room is in_progress',              full.status === ROOM_STATUS.IN_PROGRESS);

  // P3 refreshes / reconnects — MUST succeed even though status is in_progress
  const { contract: p3Reconnect, rejoined: p3Rejoined } = joinRoomSimulated(full, p3);
  assert('P3 reconnect after in_progress: rejoined=true',  p3Rejoined === true);
  assert('P3 reconnect: participant count unchanged',       p3Reconnect.participants.length === 3);
  assert('P3 reconnect: status still in_progress',         p3Reconnect.status === ROOM_STATUS.IN_PROGRESS);

  // P2 reconnects after in_progress
  const { contract: p2Reconnect, rejoined: p2Rejoined } = joinRoomSimulated(full, p2);
  assert('P2 reconnect after in_progress: rejoined=true',  p2Rejoined === true);
  assert('P2 reconnect: participant count unchanged',       p2Reconnect.participants.length === 3);

  // Host reconnects after in_progress (using host check in simulated fn)
  // Host is in participants[0] so this hits the reconnect path too
  const { contract: hostRecon, rejoined: hostRejoined } = joinRoomSimulated(full, makeUser(1));
  assert('Host reconnect after in_progress: rejoined=true', hostRejoined === true);

  // A completely new 4th user cannot join in_progress room (not in participants)
  const stranger = makeUser(99);
  assertThrows(
    'New user cannot join in_progress room',
    () => joinRoomSimulated(full, stranger),
    'ROOM_NOT_WAITING'
  );
}

// ── Suite 7: 2-player reconnect after in_progress ─────────────────
console.log('\n📋 Suite 7: 2-Player Reconnect After IN_PROGRESS');
{
  const [host, p2] = [1, 2].map(makeUser);
  const room = createMultiplayerRoomContract(host, 'TEST07', '2026', 2, 20, 'snake');
  const full = joinMultiplayerRoomContract(room, p2);

  assert('2p: in_progress',                      full.status === ROOM_STATUS.IN_PROGRESS);

  const { rejoined: hostRej }    = joinRoomSimulated(full, host);
  const { rejoined: p2Rej }      = joinRoomSimulated(full, p2);
  assert('2p: host can reconnect in_progress',   hostRej === true);
  assert('2p: P2 can reconnect in_progress',     p2Rej === true);

  const stranger = makeUser(9);
  assertThrows(
    '2p: stranger cannot join in_progress room',
    () => joinRoomSimulated(full, stranger),
    'ROOM_NOT_WAITING'
  );
}

// ── Suite 8: Host cannot join own room ───────────────────────────
console.log('\n📋 Suite 8: Host Cannot Join Own Room (waiting)');
{
  const host = makeUser(1);
  const room = createMultiplayerRoomContract(host, 'TEST08', '2026', 2, 20, 'snake');

  assertThrows(
    'Host joining own room is rejected',
    () => joinMultiplayerRoomContract(room, host),
    'Host cannot'
  );
}

// ── Suite 9: Role uniqueness across all slots ─────────────────────
console.log('\n📋 Suite 9: Role Uniqueness');
{
  const [host, p2, p3, p4] = [1, 2, 3, 4].map(makeUser);
  const room   = createMultiplayerRoomContract(host, 'TEST09', '2026', 4, 20, 'snake');
  const after4 = joinMultiplayerRoomContract(
    joinMultiplayerRoomContract(
      joinMultiplayerRoomContract(room, p2), p3), p4);

  const roles = after4.participants.map(p => p.role);
  assert('4 unique roles',                        new Set(roles).size === 4);
  assert('Roles assigned in order p1-p4',         JSON.stringify(roles) === '["player1","player2","player3","player4"]');
  assert('roleIndex matches position',
    after4.participants.every((p, i) => p.roleIndex === i));
}

// ── Suite 10: Timer and draft-mode variants ───────────────────────
console.log('\n📋 Suite 10: Timer / Draft-Mode Variants');
{
  const host = makeUser(1);
  for (const [timer, mode, maxP] of [[10,'snake',2],[15,'alternating',3],[30,'snake',4]]) {
    const room = createMultiplayerRoomContract(host, 'TMR'+timer, '2026', maxP, timer, mode);
    assert(
      `Timer=${timer}s mode=${mode} maxPlayers=${maxP} created OK`,
      room.turnTimerSeconds === timer && room.draftMode === mode && room.maxPlayers === maxP
    );
  }
}

// ── Suite 11: Concurrent join simulation (race guard) ────────────
console.log('\n📋 Suite 11: Concurrent Join Race Guard');
{
  // Simulates two users attempting to take the same slot concurrently.
  // The SQL RPC uses FOR UPDATE row lock so only one wins.
  // In JS we simulate: both read the same room state, one joins first.
  const [host, p2, p3] = [1, 2, 3].map(makeUser);
  const room = createMultiplayerRoomContract(host, 'RACE1', '2026', 2, 20, 'snake');

  // Both P2 and P3 read the same waiting room (1 participant)
  const roomSnapshot = JSON.parse(JSON.stringify(room));

  // P2 wins the race
  const after2 = joinMultiplayerRoomContract(roomSnapshot, p2);
  assert('Race winner (P2) joined successfully',  after2.participants.length === 2);
  assert('Race winner: room is full',             after2.status === ROOM_STATUS.IN_PROGRESS);

  // P3 now tries to join the updated (full) room — must be rejected
  assertThrows(
    'Race loser (P3) rejected from full/in_progress room',
    () => joinRoomSimulated(after2, p3),
    'ROOM_NOT_WAITING'
  );
}

// ── Suite 12: Alternating draft draftOrder check ─────────────────
console.log('\n📋 Suite 12: Alternating Draft Order');
{
  const [host, p2] = [1, 2].map(makeUser);
  const room   = createMultiplayerRoomContract(host, 'ALT01', '2026', 2, 20, 'alternating');
  const joined = joinMultiplayerRoomContract(room, p2);

  assert('alternating: in_progress',              joined.status === ROOM_STATUS.IN_PROGRESS);
  assert('alternating: draftOrder exists',        joined.draftOrder?.length > 0);
  assert('alternating: draftMode preserved',      joined.draftMode === 'alternating');
}

// ── SECURITY DEFINER verification note ───────────────────────────
console.log('\n📋 SQL Security Verification Checklist');
console.log('  (Run these in Supabase SQL Editor AFTER applying the migration)');
console.log('');
console.log('  -- 1. Confirm join_room() is SECURITY DEFINER (prosecdef must be TRUE):');
console.log('  SELECT proname, prosecdef FROM pg_proc WHERE proname = \'join_room\';');
console.log('');
console.log('  -- 2. Confirm grant is to authenticated role only (NOT anon):');
console.log('  SELECT grantee, privilege_type FROM information_schema.routine_privileges');
console.log('  WHERE routine_name = \'join_room\';');
console.log('');
console.log('  -- 3. Confirm NO recursive self-reference in room_participants SELECT policy:');
console.log('  SELECT policyname, qual FROM pg_policies');
console.log('  WHERE tablename = \'room_participants\' AND cmd = \'r\'');
console.log('  AND qual LIKE \'%room_participants%\';');
console.log('  -- Expected: 0 rows (no self-reference)');
console.log('');
console.log('  -- 4. Confirm draft_rooms UPDATE policy has WITH CHECK:');
console.log('  SELECT policyname, with_check FROM pg_policies');
console.log('  WHERE tablename = \'draft_rooms\' AND cmd = \'u\';');

// ── Final summary ─────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`  Total: ${passed + failed}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.ok).forEach(r =>
    console.error(`  ❌ ${r.label}${r.detail ? ' — ' + r.detail : ''}`)
  );
  process.exit(1);
} else {
  console.log('\n  All RLS regression tests PASSED ✅');
  process.exit(0);
}
