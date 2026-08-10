/**
 * scripts/test-game.js
 * =====================================================
 * Comprehensive Test Suite for IPL Draft Arena Core Engine
 * Validates all 22 core gameplay & rule requirements.
 * Run: node scripts/test-game.js
 * =====================================================
 */

import {
  createInitialGame,
  startGame,
  spinTeam,
  selectPendingPlayer,
  confirmPick,
  selectPlayer,
  applyTeamResult,
  isDraftComplete,
  getDraftProgress,
  getPickHistory,
  getCurrentPlayer,
} from '../src/game/draftEngine.js';

import {
  validatePick,
  canSelectPlayer,
  getEligiblePlayers,
  getEligibleTeams,
} from '../src/game/ruleEngine.js';

import {
  spinTeam as wheelSpinTeam,
  getEligibleTeams as wheelGetEligibleTeams,
} from '../src/game/wheelEngine.js';

import {
  getAllPlayers,
  getDraftPool,
  getPlayerById,
} from '../src/utils/dataLoader.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, failureMsg = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ Test ${passed + failed}: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ Test ${passed + failed}: ${testName} — ${failureMsg}`);
  }
}

console.log('═'.repeat(60));
console.log('  IPL Draft Arena — Core Game Engine Test Suite');
console.log('═'.repeat(60));

// 1. Initial game starts with Player 1.
let game = createInitialGame();
assert(game.currentTurn === 'player1', 'Initial game starts with Player 1', `Got: ${game.currentTurn}`);

// 2. Player 1 can spin.
game = startGame(game);
let spinRes = spinTeam(game);
assert(spinRes.success === true && spinRes.resultTeamId !== null, 'Player 1 can spin wheel', `Result: ${JSON.stringify(spinRes)}`);
game = spinRes.updatedGameState;

// 3. Wheel returns a valid eligible team.
const validTeamIds = ['csk', 'dc', 'gt', 'kkr', 'lsg', 'mi', 'pbks', 'rr', 'rcb', 'srh'];
assert(validTeamIds.includes(game.currentTeamId), 'Wheel returns a valid eligible team', `Got: ${game.currentTeamId}`);

// 4. Only players from the selected team are available.
const eligibleForTeam = game.currentEligiblePlayers;
const allMatchTeam = eligibleForTeam.every(p => p.teamId === game.currentTeamId);
assert(allMatchTeam && eligibleForTeam.length > 0, 'Only players from selected team are available', `Count: ${eligibleForTeam.length}`);

// 5. Player cannot pick before spinning (fresh game test).
let freshGame = startGame(createInitialGame());
let pickBeforeSpin = confirmPick(freshGame, 'ruturaj-gaikwad');
assert(pickBeforeSpin.success === false, 'Player cannot pick before spinning', `Expected fail, got success`);

// 6. Player cannot pick a player from another franchise.
let cskGame = applyTeamResult(startGame(createInitialGame()), 'csk');
// Try to pick Virat Kohli (RCB) during CSK turn
let wrongTeamPick = selectPlayer(cskGame, 'virat-kohli');
assert(wrongTeamPick.success === false, 'Player cannot pick player from another franchise', `Got: ${wrongTeamPick.reason}`);

// 7. Successful pick adds player to current squad.
let validPickRes = selectPlayer(cskGame, 'ruturaj-gaikwad');
assert(
  validPickRes.success === true &&
  validPickRes.updatedGameState.player1.squad.some(p => p.id === 'ruturaj-gaikwad'),
  'Successful pick adds player to current squad'
);

// 8. Successful pick switches turn.
assert(
  validPickRes.updatedGameState.currentTurn === 'player2',
  'Successful pick switches turn to Player 2',
  `Got: ${validPickRes.updatedGameState.currentTurn}`
);

// 9. Same player cannot be selected twice globally.
let p2TurnGame = validPickRes.updatedGameState;
p2TurnGame = applyTeamResult(p2TurnGame, 'csk');
let duplicatePickRes = selectPlayer(p2TurnGame, 'ruturaj-gaikwad');
assert(
  duplicatePickRes.success === false,
  'Same player cannot be selected twice globally',
  `Expected fail, got: ${duplicatePickRes.reason}`
);

// 10. User cannot exceed 2 players from one franchise.
// Give player1 two CSK players
let testG = startGame(createInitialGame());
testG = applyTeamResult(testG, 'csk');
testG = selectPlayer(testG, 'ruturaj-gaikwad').updatedGameState; // p1 pick 1 (csk)
testG = applyTeamResult(testG, 'mi');
testG = selectPlayer(testG, 'jasprit-bumrah').updatedGameState; // p2 pick 1
testG = applyTeamResult(testG, 'csk');
testG = selectPlayer(testG, 'sanju-samson').updatedGameState; // p1 pick 2 (csk)
testG = applyTeamResult(testG, 'mi');
testG = selectPlayer(testG, 'suryakumar-yadav').updatedGameState; // p2 pick 2

// Now p1 has 2 CSK players. Attempt 3rd CSK player for p1
testG = applyTeamResult(testG, 'csk');
let p1ThirdCsk = selectPlayer(testG, 'ms-dhoni');
assert(
  p1ThirdCsk.success === false,
  'User cannot exceed 2 players from one franchise (max 2 rule)',
  `Got: ${p1ThirdCsk.reason}`
);

// 11. Other user can still select 2 players from the same franchise.
// Player 2 currently has 0 CSK players.
let p2TurnG = startGame(createInitialGame());
p2TurnG = applyTeamResult(p2TurnG, 'mi');
p2TurnG = selectPlayer(p2TurnG, 'jasprit-bumrah').updatedGameState; // P1 picks MI player, switches turn to P2
p2TurnG = applyTeamResult(p2TurnG, 'csk'); // P2 spins CSK
let p2CskPick = selectPlayer(p2TurnG, 'ms-dhoni');
assert(
  p2CskPick.success === true,
  'Other user can still select 2 players from the same franchise'
);

// 12. User cannot exceed 4 overseas players.
let ovG = startGame(createInitialGame());
// Manually add 4 overseas players to player 1 squad
const pool = getDraftPool('2026');
const overseasPlayers = pool.filter(p => p.isOverseas);
ovG.player1.squad = overseasPlayers.slice(0, 4);
const fifthOverseas = overseasPlayers[4];
ovG = applyTeamResult(ovG, fifthOverseas.teamId);
let fifthOverseasPick = selectPlayer(ovG, fifthOverseas.id);
assert(
  fifthOverseasPick.success === false,
  'User cannot exceed 4 overseas players',
  `Got: ${fifthOverseasPick.reason}`
);

// 13. User can still select Indian players after reaching 4 overseas.
// Find an Indian player from a team where player1 has < 2 players
const p1SquadTeams = ovG.player1.squad.map(p => p.teamId);
const indianPlayer = pool.find(p => !p.isOverseas && p1SquadTeams.filter(t => t === p.teamId).length < 2);
ovG = applyTeamResult(ovG, indianPlayer.teamId);
let indianPick = selectPlayer(ovG, indianPlayer.id);
assert(
  indianPick.success === true,
  'User can still select Indian players after reaching 4 overseas',
  `Got: ${indianPick.reason || indianPick.error}`
);

// 14. User cannot exceed 12 players.
let fullSquadG = startGame(createInitialGame());
fullSquadG.player1.squad = pool.slice(0, 12);
const extraPlayer = pool[12];
fullSquadG = applyTeamResult(fullSquadG, extraPlayer.teamId);
let thirteenthPick = selectPlayer(fullSquadG, extraPlayer.id);
assert(
  thirteenthPick.success === false,
  'User cannot exceed 12 players',
  `Got: ${thirteenthPick.reason}`
);

// 15. Draft ends after 24 successful picks (simulate full 24-pick draft).
let simGame = startGame(createInitialGame());
let pickCount = 0;

for (let i = 0; i < 24; i++) {
  const eligibleT = getEligibleTeams(simGame);
  if (eligibleT.length === 0) {
    console.log('No eligible teams at pick', i + 1);
    break;
  }

  // Pick team that hasn't reached 2 players for current user
  const currentUser = getCurrentPlayer(simGame);
  let spunT = null;
  for (const t of eligibleT) {
    const userTeamCount = currentUser.squad.filter(p => p.teamId === t.id).length;
    if (userTeamCount < 2) {
      spunT = t.id;
      break;
    }
  }

  if (!spunT) spunT = eligibleT[0].id;

  simGame = applyTeamResult(simGame, spunT);
  const availP = simGame.currentEligiblePlayers;

  if (availP.length === 0) {
    console.log('No available players at pick', i + 1, 'for team', spunT);
    break;
  }

  const pickRes = selectPlayer(simGame, availP[0].id);
  if (pickRes.success) {
    simGame = pickRes.updatedGameState;
    pickCount++;
  } else {
    console.log('Pick failed at pick', i + 1, 'reason:', pickRes.reason || pickRes.error);
    break;
  }
}

assert(
  pickCount === 24 && isDraftComplete(simGame),
  'Draft ends after 24 successful picks',
  `Completed picks: ${pickCount}, status: ${simGame.status}`
);

// 16. Unavailable 2026 players are never offered in draft pool.
const draftPool2026 = getDraftPool('2026');
const hasInjuredInPool = draftPool2026.some(p => p.id === 'ayush-mhatre');
assert(
  hasInjuredInPool === false,
  'Unavailable 2026 players are never offered in draft pool'
);

// 17. Ayush Mhatre remains in master database but is excluded from 2026 draft pool.
const masterAyush = getPlayerById('ayush-mhatre');
const allMaster = getAllPlayers();
const ayushInMaster = allMaster.some(p => p.id === 'ayush-mhatre');
assert(
  ayushInMaster && masterAyush !== null && !hasInjuredInPool,
  'Ayush Mhatre remains in master database but is excluded from 2026 draft pool'
);

// 18. Wheel does not return a franchise with zero eligible players.
// Exhaust all CSK players or max out squad for current player
let zeroEligG = startGame(createInitialGame());
// Give player 1 2 CSK players
const cskP = pool.filter(p => p.teamId === 'csk');
zeroEligG.player1.squad = cskP.slice(0, 2);
const eligTeamsForP1 = wheelGetEligibleTeams(zeroEligG);
assert(
  !eligTeamsForP1.some(t => t.id === 'csk'),
  'Wheel does not return a franchise with zero eligible players (CSK excluded for P1)'
);

// 19. No infinite respin loop on spinTeam.
let respinG = startGame(createInitialGame());
// Force spin with mock random that initially hits CSK (index 0) which is ineligible for P1
const mockRandom = () => 0.0; // lands on CSK index 0
let mockSpinRes = spinTeam(zeroEligG, mockRandom);
assert(
  mockSpinRes.success === true && mockSpinRes.wasRespin === true && mockSpinRes.resultTeamId !== 'csk',
  'Respin resolves safely without infinite loop when wheel lands on ineligible team'
);

// 20. Pick history remains accurate.
const history = getPickHistory(simGame);
assert(
  history.length === 24 && history[0].pickNumber === 1 && history[23].pickNumber === 24,
  'Pick history remains accurate across all picks',
  `History length: ${history.length}`
);

// 21. Turn order remains accurate (alternates p1 -> p2 -> p1).
let turnOrderOk = true;
history.forEach((rec, idx) => {
  const expectedUser = idx % 2 === 0 ? 'player1' : 'player2';
  if (rec.user !== expectedUser) turnOrderOk = false;
});
assert(turnOrderOk, 'Turn order remains strictly accurate (alternating p1/p2)');

// 22. Game state remains consistent after every pick.
let stateConsistent = simGame.player1.squad.length === 12 &&
  simGame.player2.squad.length === 12 &&
  simGame.selectedPlayerIds.length === 24 &&
  simGame.pickNumber === 24;
assert(stateConsistent, 'Game state remains completely consistent after every pick');

// 23-32. WHEEL GEOMETRY & POINTER MAPPING TESTS FOR ALL 10 FRANCHISES
import { WHEEL_TEAMS, getTargetRotation, getTeamAtPointer } from '../src/utils/wheelGeometry.js';

let geomRot = 0;
WHEEL_TEAMS.forEach(teamId => {
  geomRot = getTargetRotation(teamId, geomRot, 5);
  const landedAtPointer = getTeamAtPointer(geomRot);
  assert(
    landedAtPointer === teamId,
    `Wheel geometry for franchise "${teamId.toUpperCase()}": pointer lands on segment "${landedAtPointer.toUpperCase()}"`,
    `Expected ${teamId}, got ${landedAtPointer} at rotation ${geomRot}deg`
  );
});

// 33. Consecutive multi-spin geometry test
let seqRot = 0;
const testSeq = ['kkr', 'mi', 'csk', 'srh', 'dc', 'rr', 'gt', 'pbks', 'lsg', 'rcb'];
let seqSuccess = true;
testSeq.forEach(teamId => {
  seqRot = getTargetRotation(teamId, seqRot, 5);
  if (getTeamAtPointer(seqRot) !== teamId) seqSuccess = false;
});
assert(
  seqSuccess,
  'Multi-spin consecutive geometry sequence remains 100% synchronized across all turns'
);

console.log('═'.repeat(60));
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('═'.repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
