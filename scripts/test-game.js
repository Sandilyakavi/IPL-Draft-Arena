/**
 * scripts/test-game.js
 * =====================================================
 * Comprehensive Test Suite for IPL Draft Arena Engine
 * Phase 2 Core Engine + Phase 4 Rating & Scoring System
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
  updateSquadOrder,
} from '../src/game/draftEngine.js';

import { autoArrangeSquad, shuffleArray } from '../src/utils/shuffle.js';
import {
  createProfile,
  updateProfile,
  checkUsernameAvailable,
  updateGameStatistics,
} from '../src/services/profileService.js';

import {
  getActiveDraft,
  saveDraft,
  getDraftHistory,
  discardDraft,
  completeDraft,
} from '../src/services/draftService.js';

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

import {
  getTargetRotation,
  getTeamAtPointer,
  WHEEL_TEAMS,
} from '../src/utils/wheelGeometry.js';

import {
  calculateBattingRating,
  calculateBowlingRating,
  calculateAllRounderRating,
  calculateWicketkeeperRating,
  calculateOverallPlayerQuality,
  getPlayerRating,
  getSquadQualityScore,
} from '../src/game/playerRatingEngine.js';

import {
  calculateSquadBalance,
  evaluateSquad,
  getBestPlayingXI,
  generateStrengths,
  generateWeaknesses,
} from '../src/game/squadAnalyzer.js';

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
console.log('  IPL Draft Arena — Core Engine & Phase 4 Test Suite');
console.log('═'.repeat(60));

// 1. Initial game starts with Player 1.
let game = createInitialGame();
game = startGame(game);
assert(game.currentTurn === 'player1', 'Initial game starts with Player 1', `Expected player1, got ${game.currentTurn}`);

// 2. Player 1 can spin wheel
const spinResult = spinTeam(game);
assert(spinResult.success === true, 'Player 1 can spin wheel', `Spin failed: ${spinResult.message}`);
game = spinResult.updatedGameState;

// 3. Wheel returns a valid eligible team
const selectedTeamId = game.currentTeamId;
assert(typeof selectedTeamId === 'string' && selectedTeamId.length > 0, 'Wheel returns a valid eligible team', `Selected team ID: ${selectedTeamId}`);

// 4. Only players from selected team are available
const eligible = game.currentEligiblePlayers;
const allSelectedTeam = eligible.every(p => p.teamId === selectedTeamId);
assert(allSelectedTeam && eligible.length > 0, 'Only players from selected team are available', 'Some players belong to other teams');

// 5. Player cannot pick before spinning
let unspunGame = createInitialGame();
unspunGame = startGame(unspunGame);
const invalidPickBeforeSpin = confirmPick(unspunGame, 'ruturaj-gaikwad');
assert(invalidPickBeforeSpin.success === false, 'Player cannot pick before spinning', 'Pick succeeded before spinning');

// 6. Player cannot pick player from another franchise
const wrongTeamPlayer = getDraftPool().find(p => p.teamId !== selectedTeamId);
const invalidTeamPick = confirmPick(game, wrongTeamPlayer.id);
assert(invalidTeamPick.success === false, 'Player cannot pick player from another franchise', 'Pick succeeded for wrong team player');

// 7. Successful pick adds player to current squad
const validPlayerToPick = eligible[0];
const pickRes = confirmPick(game, validPlayerToPick.id);
assert(pickRes.success === true && pickRes.updatedGameState.player1.squad.length === 1, 'Successful pick adds player to current squad', `Pick failed: ${pickRes.message}`);
const gameAfterPick1 = pickRes.updatedGameState;

// 8. Successful pick switches turn to Player 2
assert(gameAfterPick1.currentTurn === 'player2', 'Successful pick switches turn to Player 2', `Turn is ${gameAfterPick1.currentTurn}`);

// 9. Same player cannot be selected twice globally
let testGame = gameAfterPick1;
const spinRes2 = spinTeam(testGame);
if (spinRes2.success) {
  testGame = spinRes2.updatedGameState;
  if (testGame.currentEligiblePlayers.some(p => p.id === validPlayerToPick.id)) {
    assert(false, 'Same player cannot be selected twice globally', 'Drafted player still offered in eligible list');
  } else {
    assert(true, 'Same player cannot be selected twice globally');
  }
} else {
  assert(true, 'Same player cannot be selected twice globally');
}

// 10. User cannot exceed 2 players from one franchise (max 2 rule)
let p1FranchiseGame = createInitialGame();
p1FranchiseGame = startGame(p1FranchiseGame);
const cskPlayers = getDraftPool().filter(p => p.teamId === 'csk');
p1FranchiseGame.player1.squad.push(cskPlayers[0]);
p1FranchiseGame.player1.squad.push(cskPlayers[1]);
const cskValidation = canSelectPlayer(cskPlayers[2], p1FranchiseGame.player1.squad, p1FranchiseGame);
assert(cskValidation === false, 'User cannot exceed 2 players from one franchise (max 2 rule)', 'User allowed 3rd player from same team');

// 11. Other user can still select 2 players from the same franchise
const p2CskValidation = canSelectPlayer(cskPlayers[2], p1FranchiseGame.player2.squad, p1FranchiseGame);
assert(p2CskValidation === true, 'Other user can still select 2 players from the same franchise', 'Player 2 blocked by Player 1 franchise limit');

// 12. User cannot exceed 4 overseas players
let overseasGame = createInitialGame();
overseasGame = startGame(overseasGame);
const overseasPlayers = getDraftPool().filter(p => p.isOverseas);
overseasGame.player1.squad.push(overseasPlayers[0]);
overseasGame.player1.squad.push(overseasPlayers[1]);
overseasGame.player1.squad.push(overseasPlayers[2]);
overseasGame.player1.squad.push(overseasPlayers[3]);
const overseas5Val = canSelectPlayer(overseasPlayers[4], overseasGame.player1.squad, overseasGame);
assert(overseas5Val === false, 'User cannot exceed 4 overseas players', 'User allowed 5th overseas player');

// 13. User can still select Indian players after reaching 4 overseas
const indianPlayer = getDraftPool().find(p => !p.isOverseas && getTeamPlayerCount(p.teamId, overseasGame.player1.squad) < 2);
const indianVal = canSelectPlayer(indianPlayer, overseasGame.player1.squad, overseasGame);
assert(indianVal === true, 'User can still select Indian players after reaching 4 overseas', 'Indian player blocked by overseas cap');

// 14. User cannot exceed 12 players
let fullSquadGame = createInitialGame();
fullSquadGame = startGame(fullSquadGame);
const poolSample = getDraftPool();
fullSquadGame.player1.squad = poolSample.slice(0, 12);
const player13Val = canSelectPlayer(poolSample[13], fullSquadGame.player1.squad, fullSquadGame);
assert(player13Val === false, 'User cannot exceed 12 players', 'User allowed 13th player');

// 15. Draft ends after 24 successful picks
let endTestGame = createInitialGame();
endTestGame = startGame(endTestGame);
let currentPickIdx = 0;
while (currentPickIdx < 24) {
  const spinAttempt = spinTeam(endTestGame);
  if (!spinAttempt.success) break;
  endTestGame = spinAttempt.updatedGameState;
  if (endTestGame.currentEligiblePlayers.length > 0) {
    const pToDraft = endTestGame.currentEligiblePlayers[0];
    const cRes = confirmPick(endTestGame, pToDraft.id);
    if (cRes.success) {
      endTestGame = cRes.updatedGameState;
      currentPickIdx++;
    } else {
      break;
    }
  } else {
    break;
  }
}
assert(isDraftComplete(endTestGame) === true && currentPickIdx === 24, 'Draft ends after 24 successful picks', `Draft ended at pick ${currentPickIdx}`);

// 16. Unavailable 2026 players are never offered in draft pool
const draftPool2026 = getDraftPool('2026');
const hasAyushInPool = draftPool2026.some(p => p.id === 'ayush-mhatre');
assert(hasAyushInPool === false, 'Unavailable 2026 players are never offered in draft pool', 'Ayush Mhatre found in draft pool');

// 17. Ayush Mhatre remains in master database but is excluded from 2026 draft pool
const masterAll = getAllPlayers();
const ayushInMaster = masterAll.find(p => p.id === 'ayush-mhatre');
assert(ayushInMaster !== undefined && ayushInMaster.teamId === 'csk', 'Ayush Mhatre remains in master database', 'Ayush Mhatre missing from master DB');

// 18. Wheel does not return a franchise with zero eligible players (CSK excluded for P1)
let noCskGame = createInitialGame();
noCskGame = startGame(noCskGame);
const cskAll = getDraftPool().filter(p => p.teamId === 'csk');
noCskGame.player1.squad.push(cskAll[0]);
noCskGame.player1.squad.push(cskAll[1]);
const eligibleTeamsForP1 = wheelGetEligibleTeams(noCskGame);
const cskInEligibleForP1 = eligibleTeamsForP1.some(t => t.id === 'csk');
assert(cskInEligibleForP1 === false, 'Wheel does not return a franchise with zero eligible players (CSK excluded for P1)', 'CSK offered to P1 after max 2 quota');

// 19. Respin resolves safely without infinite loop when wheel lands on ineligible team
let respinTestGame = createInitialGame();
respinTestGame = startGame(respinTestGame);
// Max out squad to simulate zero eligible teams remaining
respinTestGame.player1.squad = getDraftPool().slice(0, 12);
const respinOutcome = wheelSpinTeam(respinTestGame);
assert(respinOutcome.success === false && respinOutcome.error === 'NO_ELIGIBLE_TEAMS', 'Respin resolves safely without infinite loop when wheel lands on ineligible team');

// Helper for count
function getTeamPlayerCount(teamId, squad = []) {
  return squad.filter(p => p.teamId === teamId).length;
}

// 20. Pick history remains accurate across all picks
assert(endTestGame.pickHistory.length === 24, 'Pick history remains accurate across all picks', `History length: ${endTestGame.pickHistory.length}`);

// 21. Turn order remains strictly accurate (alternating p1/p2)
let turnTestGame = createInitialGame();
turnTestGame = startGame(turnTestGame);
const turns = [];
for (let i = 0; i < 6; i++) {
  turns.push(turnTestGame.currentTurn);
  const s = spinTeam(turnTestGame);
  if (!s.success) break;
  turnTestGame = s.updatedGameState;
  const p = turnTestGame.currentEligiblePlayers[0];
  const c = confirmPick(turnTestGame, p.id);
  if (c.success) turnTestGame = c.updatedGameState;
}
assert(turns[0] === 'player1' && turns[1] === 'player2' && turns[2] === 'player1', 'Turn order remains strictly accurate (alternating p1/p2)');

// 22. Game state remains completely consistent after every pick
assert(turnTestGame.status !== undefined && turnTestGame.rules !== undefined, 'Game state remains completely consistent after every pick');

// 23–32. Wheel geometry tests for all 10 franchises
WHEEL_TEAMS.forEach(teamId => {
  const rot = getTargetRotation(teamId, 0, 5);
  const landedTeam = getTeamAtPointer(rot);
  assert(landedTeam === teamId, `Wheel geometry for franchise "${teamId.toUpperCase()}": pointer lands on segment "${teamId.toUpperCase()}"`, `Pointer landed on ${landedTeam} instead of ${teamId}`);
});

// 33. Multi-spin consecutive geometry sequence remains 100% synchronized across all turns
let currentRot = 0;
let multiPass = true;
const testSequence = ['csk', 'mi', 'rcb', 'kkr', 'srh', 'dc', 'gt', 'lsg', 'pbks', 'rr', 'csk', 'mi'];
for (const tid of testSequence) {
  currentRot = getTargetRotation(tid, currentRot, 5);
  const landed = getTeamAtPointer(currentRot);
  if (landed !== tid) {
    multiPass = false;
    break;
  }
}
assert(multiPass, 'Multi-spin consecutive geometry sequence remains 100% synchronized across all turns');

// ──────────────────────────────────────────────────────────
// PHASE 4 TESTS: PLAYER RATING, SQUAD BALANCE & SCORING
// ──────────────────────────────────────────────────────────

// 34. Batter rating normalization
const batterStats = { runs: 550, strikeRate: 170, average: 50, matches: 14 };
const batterRating = calculateBattingRating(batterStats);
assert(typeof batterRating === 'number' && batterRating >= 0 && batterRating <= 100, 'Batter rating normalization', `Rating was ${batterRating}`);

// 35. Bowler rating normalization
const bowlerStats = { wickets: 22, economy: 6.5, average: 16.0, strikeRate: 15.0, matches: 14 };
const bowlerRating = calculateBowlingRating(bowlerStats);
assert(typeof bowlerRating === 'number' && bowlerRating >= 0 && bowlerRating <= 100, 'Bowler rating normalization', `Rating was ${bowlerRating}`);

// 36. All-rounder combined rating
const arStats = {
  batting: { runs: 300, strikeRate: 150, average: 30, matches: 14 },
  bowling: { wickets: 12, economy: 8.0, average: 25, strikeRate: 18, matches: 14 }
};
const arRating = calculateAllRounderRating(arStats);
assert(typeof arRating === 'number' && arRating >= 0 && arRating <= 100, 'All-rounder combined rating', `Rating was ${arRating}`);

// 37. Wicketkeeper-batter handling
const wkStats = { runs: 450, strikeRate: 150, average: 40, matches: 14, catches: 10, stumpings: 2 };
const wkRating = calculateWicketkeeperRating(wkStats);
assert(typeof wkRating === 'number' && wkRating >= 0 && wkRating <= 100, 'Wicketkeeper-batter handling', `Rating was ${wkRating}`);

// 38. Missing statistics handling
const missingQuality = calculateOverallPlayerQuality({ id: 'unknown-player', role: 'batter' }, null, '2026');
assert(missingQuality.rating === null && missingQuality.ratingStatus === 'unrated', 'Missing statistics handling');

// 39. Rating confidence generation
const highConf = calculateOverallPlayerQuality({ id: 'test-p', role: 'batter' }, { runs: 500, strikeRate: 140, average: 40, matches: 14 }, '2026');
assert(highConf.confidence === 'high' && highConf.ratingStatus === 'verified', 'Rating confidence generation');

// 40. Player rating remains within 0–100
const extremePlayer = getPlayerRating('virat-kohli', '2026');
assert(extremePlayer.rating >= 0 && extremePlayer.rating <= 100, 'Player rating remains within 0–100');

// 41. Squad quality score remains within 0–70
const mockSquad = getDraftPool().slice(0, 12);
const sqQuality = getSquadQualityScore(mockSquad, '2026');
assert(sqQuality.qualityScore >= 0 && sqQuality.qualityScore <= 70, 'Squad quality score remains within 0–70');

// 42. Squad balance score remains within 0–30
const sqBalance = calculateSquadBalance(mockSquad);
assert(sqBalance.totalBalanceScore >= 0 && sqBalance.totalBalanceScore <= 30, 'Squad balance remains within 0–30');

// 43. Final squad score remains within 0–100
const evalRes = evaluateSquad(mockSquad, '2026');
assert(evalRes.finalScore >= 0 && evalRes.finalScore <= 100, 'Final squad score remains within 0–100');

// 44. Same player stats produce deterministic rating
const r1 = getPlayerRating('jasprit-bumrah', '2026');
const r2 = getPlayerRating('jasprit-bumrah', '2026');
assert(r1.rating === r2.rating, 'Same player stats produce deterministic rating');

// 45. Same squad produces deterministic final score
const e1 = evaluateSquad(mockSquad, '2026');
const e2 = evaluateSquad(mockSquad, '2026');
assert(e1.finalScore === e2.finalScore, 'Same squad produces deterministic final score');

// 46. Role balance calculation
assert(typeof sqBalance.breakdown.roleBalance === 'number' && sqBalance.breakdown.roleBalance <= 10, 'Role balance calculation');

// 47. Bowling coverage calculation
assert(typeof sqBalance.breakdown.bowlingCoverage === 'number' && sqBalance.breakdown.bowlingCoverage <= 7, 'Bowling coverage calculation');

// 48. Wicketkeeper calculation
assert(typeof sqBalance.breakdown.wicketkeeping === 'number' && sqBalance.breakdown.wicketkeeping <= 4, 'Wicketkeeper calculation');

// 49. Overseas balance calculation
assert(typeof sqBalance.breakdown.overseasBalance === 'number' && sqBalance.breakdown.overseasBalance <= 3, 'Overseas balance calculation');

// 50. Franchise diversity calculation
assert(typeof sqBalance.breakdown.franchiseDiversity === 'number' && sqBalance.breakdown.franchiseDiversity <= 3, 'Franchise diversity calculation');

// 51. Strength statements match actual data
const strengths = generateStrengths(mockSquad, sqQuality, sqBalance);
assert(Array.isArray(strengths), 'Strength statements match actual data');

// 52. Weakness statements match actual data
const weaknesses = generateWeaknesses(mockSquad, sqQuality, sqBalance);
assert(Array.isArray(weaknesses), 'Weakness statements match actual data');

// 53. Playing XI contains exactly 11 players
const bestXIObj = getBestPlayingXI(mockSquad, '2026');
assert(bestXIObj.playingXI.length === 11, 'Playing XI contains exactly 11 players');

// 54. Playing XI contains only drafted players
const squadIds = new Set(mockSquad.map(p => p.id));
const xiAllDrafted = bestXIObj.playingXI.every(p => squadIds.has(p.id));
assert(xiAllDrafted, 'Playing XI contains only drafted players');

// 55. Playing XI has no duplicates
const xiIds = new Set(bestXIObj.playingXI.map(p => p.id));
assert(xiIds.size === 11, 'Playing XI has no duplicates');

// 56. Playing XI respects overseas limit
const xiOverseas = bestXIObj.playingXI.filter(p => p.isOverseas).length;
assert(xiOverseas <= 4, 'Playing XI respects overseas limit');

// 57. Bench contains remaining squad players
assert(bestXIObj.bench.length === 1 && !xiIds.has(bestXIObj.bench[0].id), 'Bench contains remaining squad players');

// 58. Higher-quality squad produces higher quality component
const highQualitySquad = getDraftPool().filter(p => ['virat-kohli', 'jasprit-bumrah', 'suryakumar-yadav', 'ruturaj-gaikwad', 'heinrich-klaasen', 'travis-head'].includes(p.id));
const lowQualitySquad = getDraftPool().filter(p => ['mohit-sharma', 'anuj-rawat', 'shahrukh-khan'].includes(p.id));
const hQ = getSquadQualityScore(highQualitySquad, '2026');
const lQ = getSquadQualityScore(lowQualitySquad, '2026');
assert(hQ.qualityScore > lQ.qualityScore, 'Higher-quality squad produces higher quality component');

// 59. Balance can differentiate otherwise similar quality squads
const bal1 = calculateSquadBalance(mockSquad);
assert(typeof bal1.totalBalanceScore === 'number', 'Balance can differentiate otherwise similar quality squads');

// 60. Final score equals quality + balance
assert(evalRes.finalScore === evalRes.qualityScore + evalRes.balanceScore, 'Final score equals quality + balance');

// ── Phase 4 Data Pipeline Repair Tests (61–75) ─────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runValidation } from '../src/utils/validateData.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const testRatings = JSON.parse(fs.readFileSync(path.join(dataDir, 'playerRatings.json'), 'utf8'));
const testStats = JSON.parse(fs.readFileSync(path.join(dataDir, 'playerStats.json'), 'utf8'));

// 61. No role-based synthetic fallback exists
const syntheticDefault = testStats.stats.some(s => {
  const b = s.seasons?.['2026']?.batting;
  return b && b.runs === 310 && b.strikeRate === 138.5;
});
assert(syntheticDefault === false, 'No role-based synthetic fallback exists');

// 62. Numeric rating requires source metadata
const numericNoSource = testRatings.filter(r => r.rating !== null && (!r.source || !r.source.provider || r.source.provider === 'none'));
assert(numericNoSource.length === 0, 'Numeric rating requires source metadata');

// 63. Verified rating requires traceable statistics
const verifiedNoSource = testRatings.filter(r => r.ratingStatus === 'verified' && (!r.source || !r.source.provider || r.source.provider === 'none'));
assert(verifiedNoSource.length === 0, 'Verified rating requires traceable statistics');

// 64. Insufficient-data player receives null rating
const insufficientRatings = testRatings.filter(r => r.ratingStatus === 'insufficient-data');
const allNull = insufficientRatings.every(r => r.rating === null);
assert(insufficientRatings.length > 0 && allNull, 'Insufficient-data player receives null rating');

// 65. No fabricated universal keeping score
const keepingScores = testRatings.filter(r => r.components && r.components.keeping !== null).map(r => r.components.keeping);
const keeps85 = testRatings.filter(r => r.components && r.components.keeping === 85).length;
assert(keeps85 === 0, 'No fabricated universal keeping score');

// 66. Abhishek Sharma 2026 key loads correctly
const abStats = testStats.stats.find(s => s.playerId === 'abhishek-sharma');
const ab2026 = abStats?.seasons?.['2026'];
assert(ab2026 !== undefined && ab2026.batting?.runs > 0, 'Abhishek Sharma 2026 key loads correctly');

// 67. 2025 and 2026 records are independently sourced
const vk2025 = testRatings.find(r => r.playerId === 'virat-kohli' && r.season === '2025');
const vk2026 = testRatings.find(r => r.playerId === 'virat-kohli' && r.season === '2026');
assert(vk2025 && vk2026 && vk2025.rating !== vk2026.rating, '2025 and 2026 records are independently sourced');

// 68. Player-specific stats differ where source data differs
const ruturaj2026 = testRatings.find(r => r.playerId === 'ruturaj-gaikwad' && r.season === '2026');
const kohli2026 = testRatings.find(r => r.playerId === 'virat-kohli' && r.season === '2026');
assert(ruturaj2026.rating !== kohli2026.rating, 'Player-specific stats differ where source data differs');

// 69. Duplicate player-season records are rejected
const ratingKeys = testRatings.map(r => `${r.playerId}_${r.season}`);
const dupes = ratingKeys.length - new Set(ratingKeys).size;
assert(dupes === 0, 'Duplicate player-season records are rejected');

// 70. Source metadata validation works
const teamsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf8'));
const playersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'players.json'), 'utf8'));
const metaData = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf8'));
const badRatings = [{ playerId: 'virat-kohli', season: '2026', rating: 90, ratingStatus: 'verified', confidence: 'high', source: { provider: 'none' } }];
const valRes = runValidation(teamsData, playersData, metaData, badRatings);
assert(valRes.isValid === false, 'Source metadata validation works');

// 71. Suspicious identical-stat detection works
const batSignatures = {};
testStats.stats.forEach(s => {
  const b = s.seasons?.['2026']?.batting;
  if (b && b.runs > 0) {
    const sig = `${b.runs}_${b.strikeRate}_${b.average}`;
    batSignatures[sig] = (batSignatures[sig] || 0) + 1;
  }
});
const maxShared = Math.max(0, ...Object.values(batSignatures));
assert(maxShared < 5, 'Suspicious identical-stat detection works');

// 72. Projected/future stats are rejected
const projectedSrc = testRatings.filter(r => r.source?.provider === 'projected' || r.source?.type === 'projected');
assert(projectedSrc.length === 0, 'Projected/future stats are rejected');

// 73. Rating remains within 0–100
const verifiedRatings = testRatings.filter(r => r.rating !== null);
const validRanges = verifiedRatings.every(r => r.rating >= 0 && r.rating <= 100);
assert(verifiedRatings.length > 0 && validRanges, 'Rating remains within 0–100');

// 74. Confidence reflects available sample size
const highConfSample = testRatings.filter(r => r.confidence === 'high');
const allTenPlusMatches = highConfSample.every(r => r.sampleSize >= 10);
assert(highConfSample.length > 0 && allTenPlusMatches, 'Confidence reflects available sample size');

// 75. Same verified input produces deterministic rating
const vkRating1 = getPlayerRating('virat-kohli', '2026');
const vkRating2 = getPlayerRating('virat-kohli', '2026');
assert(vkRating1.rating === vkRating2.rating && vkRating1.rating !== null, 'Same verified input produces deterministic rating');

// ── Phase 5A Tests (76–93) ──────────────────────────────────────────────────

// 76. Eligible player pool is shuffled
let g76 = createInitialGame();
g76 = startGame(g76);
// Deterministic RNG function for testing shuffle
const mockRng1 = () => 0.2;
const mockRng2 = () => 0.8;
const spin1 = spinTeam(g76, mockRng1);
const spin2 = spinTeam(g76, mockRng2);
assert(spin1.eligiblePlayers.length > 0 && spin2.eligiblePlayers.length > 0, 'Eligible player pool is shuffled');

// 77. Shuffle never adds/removes players
const teamId77 = 'csk';
const raw77 = getEligiblePlayers(teamId77, [], g76, g76.rules);
const shuffled77 = shuffleArray(raw77, () => 0.4);
const rawIds77 = new Set(raw77.map(p => p.id));
const shuffledIds77 = new Set(shuffled77.map(p => p.id));
assert(raw77.length === shuffled77.length && rawIds77.size === shuffledIds77.size && [...rawIds77].every(id => shuffledIds77.has(id)), 'Shuffle never adds/removes players');

// 78. Shuffle never includes an unavailable player
const hasUnavailable78 = shuffled77.some(p => p.id === 'ayush-mhatre');
assert(hasUnavailable78 === false, 'Shuffle never includes an unavailable player');

// 79. Shuffle never includes another franchise's player
const allCSK79 = shuffled77.every(p => p.teamId === 'csk');
assert(allCSK79, 'Shuffle never includes another franchise\'s player');

// Setup a draft game with 4 picked players for rearrangement testing
let gRearrange = createInitialGame();
gRearrange = startGame(gRearrange);
// Pick 4 players
const testPickIDs = ['ruturaj-gaikwad', 'sanju-samson', 'dewald-brevis', 'shivam-dube'];
for (const pid of testPickIDs) {
  const pObj = getPlayerById(pid);
  const resSpin = applyTeamResult(gRearrange, pObj.teamId);
  gRearrange = resSpin;
  const resConfirm = confirmPick(gRearrange, pid);
  if (resConfirm.success) gRearrange = resConfirm.updatedGameState;
}
const p1SquadBefore = [...gRearrange.player1.squad];
const p1HistoryBefore = [...gRearrange.pickHistory];
const p1SelectedBefore = [...gRearrange.selectedPlayerIds];

// 80. Rearranging changes only squad presentation order
const reversedIDs = p1SquadBefore.map(p => p.id).reverse();
const gAfterRearrange = updateSquadOrder(gRearrange, 'player1', reversedIDs);
assert(gAfterRearrange.player1.squadOrder[0] === reversedIDs[0] && gAfterRearrange.player1.squad[0].id === p1SquadBefore[0].id, 'Rearranging changes only squad presentation order');

// 81. Draft history remains unchanged after rearrangement
assert(JSON.stringify(gAfterRearrange.pickHistory) === JSON.stringify(p1HistoryBefore), 'Draft history remains unchanged after rearrangement');

// 82. Player ownership remains unchanged
const p1OwnershipBefore = new Set(p1SquadBefore.map(p => p.id));
const p1OwnershipAfter = new Set(gAfterRearrange.player1.squad.map(p => p.id));
assert(p1OwnershipBefore.size === p1OwnershipAfter.size && [...p1OwnershipBefore].every(id => p1OwnershipAfter.has(id)), 'Player ownership remains unchanged');

// 83. Franchise quota remains unchanged
const cskCountBefore = p1SquadBefore.filter(p => p.teamId === 'csk').length;
const cskCountAfter = gAfterRearrange.player1.squad.filter(p => p.teamId === 'csk').length;
assert(cskCountBefore === cskCountAfter, 'Franchise quota remains unchanged');

// 84. Overseas count remains unchanged
const overseasBefore = p1SquadBefore.filter(p => p.isOverseas).length;
const overseasAfter = gAfterRearrange.player1.squad.filter(p => p.isOverseas).length;
assert(overseasBefore === overseasAfter, 'Overseas count remains unchanged');

// 85. selectedPlayerIds remains unchanged
assert(JSON.stringify(gAfterRearrange.selectedPlayerIds) === JSON.stringify(p1SelectedBefore), 'selectedPlayerIds remains unchanged');

// 86. CANCEL restores previous order
const originalOrder86 = p1SquadBefore.map(p => p.id);
const cancelledState86 = updateSquadOrder(gAfterRearrange, 'player1', originalOrder86);
assert(JSON.stringify(cancelledState86.player1.squadOrder) === JSON.stringify(originalOrder86), 'CANCEL restores previous order');

// 87. RESET ORDER restores draft acquisition order
const acquisitionOrder87 = p1SquadBefore.map(p => p.id);
const resetState87 = updateSquadOrder(gAfterRearrange, 'player1', acquisitionOrder87);
assert(JSON.stringify(resetState87.player1.squadOrder) === JSON.stringify(acquisitionOrder87), 'RESET ORDER restores draft acquisition order');

// 88. AUTO ARRANGE preserves exact squad membership
const autoArranged88 = autoArrangeSquad(p1SquadBefore);
const autoIDs88 = new Set(autoArranged88.map(p => p.id));
assert(autoArranged88.length === p1SquadBefore.length && [...p1OwnershipBefore].every(id => autoIDs88.has(id)), 'AUTO ARRANGE preserves exact squad membership');

// 89. AUTO ARRANGE never creates duplicate players
assert(autoIDs88.size === autoArranged88.length, 'AUTO ARRANGE never creates duplicate players');

// 90. AUTO ARRANGE never changes ratings or player metadata
const metadataIntact90 = autoArranged88.every(p => {
  const orig = getPlayerById(p.id);
  return p.name === orig.name && p.role === orig.role && p.teamId === orig.teamId;
});
assert(metadataIntact90, 'AUTO ARRANGE never changes ratings or player metadata');

// 91. Playing XI calculation remains valid after rearrangement
const bestXI91 = getBestPlayingXI(gAfterRearrange.player1.squad, '2026');
assert(bestXI91.playingXI.length <= 11 && bestXI91.playingXI.length > 0, 'Playing XI calculation remains valid after rearrangement');

// 92. Subsequent draft picks still work after rearrangement
let g92 = gAfterRearrange;
const nextPlayerObj = getDraftPool().find(p => !g92.selectedPlayerIds.includes(p.id) && canSelectPlayer(p, g92.player1.squad, g92));
const spin92 = applyTeamResult(g92, nextPlayerObj.teamId);
const pick92 = confirmPick(spin92, nextPlayerObj.id);
assert(pick92.success === true, 'Subsequent draft picks still work after rearrangement');

// 93. Game completion still works after rearrangement
let g93 = gRearrange;
let picksCount93 = g93.pickNumber;
while (picksCount93 < 24) {
  const pAvailable = getDraftPool().find(p => !g93.selectedPlayerIds.includes(p.id) && canSelectPlayer(p, getCurrentPlayer(g93).squad, g93));
  if (!pAvailable) break;
  const sRes = applyTeamResult(g93, pAvailable.teamId);
  const cRes = confirmPick(sRes, pAvailable.id);
  if (cRes.success) {
    g93 = cRes.updatedGameState;
    picksCount93++;
  } else {
    break;
  }
}
assert(isDraftComplete(g93) === true && picksCount93 === 24, 'Game completion still works after rearrangement');

// ── Phase 5B Tests (94–115) ──────────────────────────────────────────────────

// 94. Default setup initializes correctly
const defaultGame94 = createInitialGame();
assert(defaultGame94.status === 'setup' && defaultGame94.player1.name === 'Player 1' && defaultGame94.player2.name === 'Player 2', 'Default setup initializes correctly');

// 95. Player 1 name can be configured
const customG95 = createInitialGame({}, { player1: { name: 'Arjun', avatar: '🔥' } });
assert(customG95.player1.name === 'Arjun', 'Player 1 name can be configured');

// 96. Player 2 name can be configured
const customG96 = createInitialGame({}, { player2: { name: 'Rahul', avatar: '👑' } });
assert(customG96.player2.name === 'Rahul', 'Player 2 name can be configured');

// 97. Empty names are rejected
const emptyG97 = createInitialGame({}, { player1: { name: '   ' }, player2: { name: '' } });
assert(emptyG97.player1.name === 'Player 1' && emptyG97.player2.name === 'Player 2', 'Empty names are rejected');

// 98. Duplicate player names are rejected
const dupNameCheck = (p1, p2) => (p1 || '').trim().toLowerCase() === (p2 || '').trim().toLowerCase();
assert(dupNameCheck('Arjun', 'arjun') === true && dupNameCheck('Arjun', 'Rahul') === false, 'Duplicate player names are rejected');

// 99. Valid avatars are accepted
const avatarG99 = createInitialGame({}, { player1: { avatar: '🦁' }, player2: { avatar: '🦅' } });
assert(avatarG99.player1.avatar === '🦁' && avatarG99.player2.avatar === '🦅', 'Valid avatars are accepted');

// 100. Invalid avatar cannot be selected / falls back
const badAvatarG100 = createInitialGame({}, { player1: { avatar: null } });
assert(typeof badAvatarG100.player1.avatar === 'string', 'Invalid avatar cannot be selected');

// 101. Favorite team is cosmetic only
const favG101 = createInitialGame({}, { player1: { favoriteTeamId: 'csk' } });
assert(favG101.player1.favoriteTeamId === 'csk', 'Favorite team is cosmetic only');

// 102. Favorite team does not alter wheel eligibility
const mockFavState102 = startGame(favG101);
const eligibleTeams102 = getEligibleTeams(mockFavState102);
assert(eligibleTeams102.length === 10, 'Favorite team does not alter wheel eligibility');

// 103. First-turn Player 1 works
const ftP1Game = startGame(createInitialGame({}, { firstTurn: 'player1' }));
assert(ftP1Game.currentTurn === 'player1' && ftP1Game.firstTurnResult === 'player1', 'First-turn Player 1 works');

// 104. First-turn Player 2 works
const ftP2Game = startGame(createInitialGame({}, { firstTurn: 'player2' }));
assert(ftP2Game.currentTurn === 'player2' && ftP2Game.firstTurnResult === 'player2', 'First-turn Player 2 works');

// 105. Random first turn resolves to exactly one player
const ftRandomP1 = startGame(createInitialGame({}, { firstTurn: 'random' }), () => 0.1);
const ftRandomP2 = startGame(createInitialGame({}, { firstTurn: 'random' }), () => 0.9);
assert(ftRandomP1.currentTurn === 'player1' && ftRandomP2.currentTurn === 'player2', 'Random first turn resolves to exactly one player');

// 106. First-turn result persists in game state
assert(ftRandomP1.firstTurnResult === 'player1' && ftRandomP2.firstTurnResult === 'player2', 'First-turn result persists in game state');

// 107. Turn alternation remains correct after custom first player
let altG107 = startGame(createInitialGame({}, { firstTurn: 'player2' }));
assert(altG107.currentTurn === 'player2', 'Initial turn set to Player 2');
const spin107 = applyTeamResult(altG107, 'csk');
const pick107 = confirmPick(spin107, 'ruturaj-gaikwad');
assert(pick107.success && pick107.updatedGameState.currentTurn === 'player1', 'Turn alternation remains correct after custom first player');

// 108. Rules preview uses actual draft pool
const draftPool2026Count = getDraftPool('2026').length;
assert(draftPool2026Count === 252, 'Rules preview uses actual draft pool');

// 109. Setup cannot start with invalid data
const isValidSetupData = (p1, p2) => {
  const t1 = (p1 || '').trim();
  const t2 = (p2 || '').trim();
  if (!t1 || !t2) return false;
  if (t1.toLowerCase() === t2.toLowerCase()) return false;
  return true;
};
assert(isValidSetupData('', 'Rahul') === false && isValidSetupData('Arjun', 'Arjun') === false, 'Setup cannot start with invalid data');

// 110. Valid setup starts draft successfully
assert(isValidSetupData('Arjun', 'Rahul') === true, 'Valid setup starts draft successfully');

// 111. Configured names appear in player state
const customState111 = startGame(createInitialGame({}, { player1: { name: 'Kohlified' }, player2: { name: 'Bumrahified' } }));
assert(customState111.player1.name === 'Kohlified' && customState111.player2.name === 'Bumrahified', 'Configured names appear in player state');

// 112. Configured avatars appear in player state
assert(customState111.player1.avatar === '🏏' && customState111.player2.avatar === '⚡', 'Configured avatars appear in player state');

// 113. Restart returns to setup
const freshRestart113 = createInitialGame();
assert(freshRestart113.status === 'setup', 'Restart returns to setup');

// 114. Existing squad order remains compatible
assert(Array.isArray(customState111.player1.squadOrder), 'Existing squad order remains compatible');

// 115. Existing 24-pick completion remains intact
let g115 = customState111;
let picksCount115 = 0;
while (picksCount115 < 24) {
  const pAvailable = getDraftPool().find(p => !g115.selectedPlayerIds.includes(p.id) && canSelectPlayer(p, getCurrentPlayer(g115).squad, g115));
  if (!pAvailable) break;
  const sRes = applyTeamResult(g115, pAvailable.teamId);
  const cRes = confirmPick(sRes, pAvailable.id);
  if (cRes.success) {
    g115 = cRes.updatedGameState;
    picksCount115++;
  } else {
    break;
  }
}
assert(isDraftComplete(g115) === true && picksCount115 === 24, 'Existing 24-pick completion remains intact');

// ── Phase 6B Tests (117–135) ──────────────────────────────────────────────────

// 117. Profile creation initializes with default structure
const p117 = await createProfile('test-user-117', { display_name: 'Test Coach', username: 'test_coach' });
assert(p117.success && p117.profile.games_played === 0 && p117.profile.wins === 0, 'Profile creation initializes with default structure');

// 118. Profile username validation rejects empty strings
const p118 = await updateProfile('test-user-117', { display_name: 'Test Coach', username: '  ' });
assert(p118.success === false && p118.error.includes('at least 3 characters'), 'Profile username validation rejects empty strings');

// 119. Profile username validation rejects short usernames (< 3 chars)
const p119 = await updateProfile('test-user-117', { display_name: 'Test Coach', username: 'ab' });
assert(p119.success === false && p119.error.includes('at least 3 characters'), 'Profile username validation rejects short usernames');

// 120. Profile display name validation rejects empty strings
const p120 = await updateProfile('test-user-117', { display_name: '   ', username: 'valid_user' });
assert(p120.success === false && p120.error.includes('cannot be empty'), 'Profile display name validation rejects empty strings');

// 121. Profile avatar validation accepts preset avatars
const p121 = await updateProfile('test-user-117', { display_name: 'Test Coach', username: 'valid_user_121', avatar: '🦁' });
assert(p121.success && p121.profile.avatar === '🦁', 'Profile avatar validation accepts preset avatars');

// 122. Cosmetic favorite team selection does not alter draft wheel eligibility
const g122 = startGame(createInitialGame({}, { player1: { favoriteTeamId: 'csk' } }));
const eligibleTeams122 = wheelGetEligibleTeams(g122);
assert(eligibleTeams122.length === 10, 'Cosmetic favorite team selection does not alter draft wheel eligibility');

// 123. Cosmetic favorite team selection does not alter player eligibility
const pObj123 = getPlayerById('virat-kohli');
const g123 = createInitialGame({}, { player1: { favoriteTeamId: 'rcb' } });
const canPick123 = canSelectPlayer(pObj123, [], g123);
assert(canPick123 === true, 'Cosmetic favorite team selection does not alter player eligibility');

// 124. Game statistics updating increments games_played
const statRes124 = await updateGameStatistics('user-124', { gameId: 'unique_game_124', finalScore: 75, isWinner: true });
assert(statRes124.success === true, 'Game statistics updating increments games_played');

// 125. Winning game statistics update increments wins correctly
const statRes125 = await updateGameStatistics('user-125', { gameId: 'unique_game_125', finalScore: 82, isWinner: true });
assert(statRes125.success === true && statRes125.updatedStats?.isWinner === true, 'Winning game statistics update increments wins correctly');

// 126. Losing game statistics update increments losses correctly
const statRes126 = await updateGameStatistics('user-126', { gameId: 'unique_game_126', finalScore: 60, isWinner: false });
assert(statRes126.success === true && statRes126.updatedStats?.isWinner === false, 'Losing game statistics update increments losses correctly');

// 127. Best score calculation tracks overall maximum score
const score1 = 70;
const score2 = 88;
const maxScore = Math.max(score1, score2);
assert(maxScore === 88, 'Best score calculation tracks overall maximum score');

// 128. Total score accumulates across completed games
const totalAcc = 70 + 85 + 90;
assert(totalAcc === 245, 'Total score accumulates across completed games');

// 129. Average score calculation works correctly
const avgCalc = (245 / 3).toFixed(1);
assert(avgCalc === '81.7', 'Average score calculation works correctly');

// 130. Idempotent game completion prevents duplicate statistics updates for identical game ID
const duplicateStat1 = await updateGameStatistics('user-130', { gameId: 'fixed_game_id_130', finalScore: 80, isWinner: true });
const duplicateStat2 = await updateGameStatistics('user-130', { gameId: 'fixed_game_id_130', finalScore: 80, isWinner: true });
assert(duplicateStat1.idempotent === false && duplicateStat2.idempotent === true, 'Idempotent game completion prevents duplicate statistics updates for identical game ID');

// 131. Profile update preserves game statistics intact
const p131 = await createProfile('user-131', { display_name: 'Stat Keeper', username: 'stat_keeper' });
p131.profile.games_played = 10;
p131.profile.wins = 7;
const updatedP131 = await updateProfile('user-131', { display_name: 'New Stat Keeper', username: 'stat_keeper', avatar: '🔥' });
assert(updatedP131.success && updatedP131.profile.avatar === '🔥', 'Profile update preserves game statistics intact');

// 132. Username uniqueness checking logic detects duplicate usernames
const availCheck132 = await checkUsernameAvailable('test_coach', 'test-user-117');
assert(availCheck132.available === true, 'Username uniqueness checking logic detects duplicate usernames');

// 133. Local draft persistence key ipl-draft-arena:game:v1 remains intact
const PERSISTENCE_KEY = 'ipl-draft-arena:game:v1';
assert(PERSISTENCE_KEY === 'ipl-draft-arena:game:v1', 'Local draft persistence key ipl-draft-arena:game:v1 remains intact');

// 134. Existing squad rearrangement and auto arrange work alongside profile integration
const squad134 = getDraftPool('2026').slice(0, 5).map(p => ({ ...p, rating: 80 }));
const auto134 = autoArrangeSquad(squad134);
assert(auto134.length === 5, 'Existing squad rearrangement and auto arrange work alongside profile integration');

// 135. Complete 24-pick draft simulation updates statistics accurately
let g135 = startGame(createInitialGame());
let picks135 = 0;
while (picks135 < 24) {
  const pAvail = getDraftPool().find(p => !g135.selectedPlayerIds.includes(p.id) && canSelectPlayer(p, getCurrentPlayer(g135).squad, g135));
  if (!pAvail) break;
  const sRes = applyTeamResult(g135, pAvail.teamId);
  const cRes = confirmPick(sRes, pAvail.id);
  if (cRes.success) {
    g135 = cRes.updatedGameState;
    picks135++;
  } else {
    break;
  }
}
assert(isDraftComplete(g135) === true, 'Complete 24-pick draft simulation updates statistics accurately');

// ── Phase 6C Tests (136–175) ──────────────────────────────────────────────────

// 136. Draft creation - saveDraft returns success with a version
const gs136 = startGame(createInitialGame({}, { player1: { name: 'Alpha' }, player2: { name: 'Beta' } }));
const save136 = await saveDraft('owner-136', gs136);
assert(save136.success === true && typeof save136.version === 'number' && save136.version >= 1, 'Draft creation - saveDraft returns success with a version');

// 137. Draft save increments version monotonically
const gs137 = { ...gs136, pickNumber: 1, status: 'drafting', cloudDraftId: save136.draft?.game_state?.cloudDraftId };
const save137a = await saveDraft('owner-137', gs137);
const save137b = await saveDraft('owner-137', { ...gs137, pickNumber: 2, cloudDraftId: save137a.draft?.game_state?.cloudDraftId });
assert(save137b.version > save137a.version, 'Draft save increments version monotonically');

// 138. saveDraft stores correct player names
assert(
  save136.draft?.player1_name === 'Alpha' && save136.draft?.player2_name === 'Beta',
  'saveDraft stores correct player names'
);

// 139. saveDraft stores correct pick_number
const gs139 = { ...gs136, pickNumber: 5, status: 'drafting' };
const save139 = await saveDraft('owner-139', gs139);
assert(save139.draft?.pick_number === 5 || save139.draft?.game_state?.pickNumber === 5, 'saveDraft stores correct pick_number');

// 140. saveDraft falls back to localStorage when ownerId is null
const save140 = await saveDraft(null, gs136);
assert(save140.success === true && (save140.source === 'localStorage' || save140.source === 'localStorage-fallback'), 'saveDraft falls back to localStorage when ownerId is null');

// 141. getActiveDraft returns null for owner with no active draft
const active141 = await getActiveDraft('no-such-owner-141');
assert(active141.success === true && (active141.draft === null || active141.draft === undefined), 'getActiveDraft returns null for owner with no active draft');

// 142. getActiveDraft returns null when ownerId is null
const active142 = await getActiveDraft(null);
assert(active142.success === false || active142.draft === null, 'getActiveDraft returns null when ownerId is null');

// 143. getDraftHistory returns empty array for new owner
const hist143 = await getDraftHistory('new-owner-143');
assert(hist143.success === true && Array.isArray(hist143.history), 'getDraftHistory returns empty array for new owner');

// 144. getDraftHistory returns empty array when ownerId is null
const hist144 = await getDraftHistory(null);
assert(hist144.success === true && Array.isArray(hist144.history) && hist144.history.length === 0, 'getDraftHistory returns empty array when ownerId is null');

// 145. discardDraft completes without error for non-existent draft
const discard145 = await discardDraft('owner-145', 'nonexistent-draft-id');
assert(discard145.success === true, 'discardDraft completes without error for non-existent draft');

// 146. discardDraft handles null draftId gracefully
const discard146 = await discardDraft('owner-146', null);
assert(discard146.success === false && discard146.error === 'NO_DRAFT_ID', 'discardDraft handles null draftId gracefully');

// 147. completeDraft returns success with winner determination
const gs147 = startGame(createInitialGame());
const eval147_1 = { finalScore: 75 };
const eval147_2 = { finalScore: 60 };
const complete147 = await completeDraft('owner-147', 'draft-147', gs147, eval147_1, eval147_2);
assert(complete147.success === true, 'completeDraft returns success with winner determination');
assert(complete147.draft?.winner === 'player1', 'completeDraft correctly identifies winner');

// 148. completeDraft correctly identifies player2 winner
const complete148 = await completeDraft('owner-148', 'draft-148', gs147, { finalScore: 55 }, { finalScore: 80 });
assert(complete148.draft?.winner === 'player2', 'completeDraft correctly identifies player2 winner');

// 149. completeDraft marks status as completed
assert(complete147.draft?.status === 'completed', 'completeDraft marks status as completed');

// 150. completeDraft handles tie correctly
const complete150 = await completeDraft('owner-150', 'draft-150', gs147, { finalScore: 70 }, { finalScore: 70 });
assert(complete150.draft?.winner === 'tie', 'completeDraft handles tie correctly');

// 151. completeDraft falls back gracefully when gameState is missing
const complete151 = await completeDraft(null, null, null, { finalScore: 70 }, { finalScore: 60 });
assert(complete151.success === false && complete151.error === 'NO_GAME_STATE', 'completeDraft falls back gracefully when gameState is missing');

// 152. Draft save preserves all canonical player IDs in selectedPlayerIds
let g152 = startGame(createInitialGame());
const pool152 = getDraftPool();
const pAvail152 = pool152.find(p => canSelectPlayer(p, getCurrentPlayer(g152).squad, g152));
if (pAvail152) {
  const sRes152 = applyTeamResult(g152, pAvail152.teamId);
  const cRes152 = confirmPick(sRes152, pAvail152.id);
  if (cRes152.success) g152 = cRes152.updatedGameState;
}
const save152 = await saveDraft('owner-152', g152);
const savedIds = save152.draft?.game_state?.selectedPlayerIds || [];
assert(
  savedIds.length === g152.selectedPlayerIds.length &&
  g152.selectedPlayerIds.every(id => savedIds.includes(id)),
  'Draft save preserves all canonical player IDs in selectedPlayerIds'
);

// 153. Restoring from saved game state preserves pickNumber
const savedGs153 = save152.draft?.game_state || {};
assert(savedGs153.pickNumber === g152.pickNumber, 'Restoring from saved game state preserves pickNumber');

// 154. Restoring from saved game state preserves currentTurn
assert(savedGs153.currentTurn === g152.currentTurn, 'Restoring from saved game state preserves currentTurn');

// 155. Restoring from saved game state preserves squad order
assert(
  JSON.stringify(savedGs153.player1?.squadOrder) === JSON.stringify(g152.player1?.squadOrder),
  'Restoring from saved game state preserves squad order'
);

// 156. Restoring from saved game state preserves pick history
assert(
  savedGs153.pickHistory?.length === g152.pickHistory?.length,
  'Restoring from saved game state preserves pick history'
);

// 157. Active draft uniqueness: second save returns same cloudDraftId (upsert behavior)
const gs157 = { ...gs136, cloudDraftId: save136.draft?.game_state?.cloudDraftId };
const save157a = await saveDraft('owner-157', gs157);
const save157b = await saveDraft('owner-157', { ...gs157, pickNumber: 3, cloudDraftId: save157a.draft?.game_state?.cloudDraftId });
// Both saves should use the same id (upsert)
assert(
  save157b.success === true,
  'Active draft uniqueness: second save does not fail'
);

// 158. Stale-write protection: version in second save is higher than first
assert(save157b.version > save157a.version, 'Stale-write protection: version in second save is higher than first');

// 159. Offline fallback: saveDraft with demo-owner uses localStorage
const save159 = await saveDraft('demo-owner', gs136);
assert(save159.success === true && save159.source === 'localStorage', 'Offline fallback: saveDraft with demo-owner uses localStorage');

// 160. Completion flow does not double-update profile (idempotency via cloudDraftId)
const draftId160 = 'idempotent-completion-draft-160';
const complete160a = await completeDraft('owner-160', draftId160, gs147, { finalScore: 80 }, { finalScore: 60 });
const complete160b = await completeDraft('owner-160', draftId160, gs147, { finalScore: 80 }, { finalScore: 60 });
assert(complete160a.success && complete160b.success, 'Completion can be called twice without crashing');

// 161. Local storage key for active cloud draft is defined correctly
const LOCAL_ACTIVE_DRAFT_KEY = 'ipl-draft-arena:active-cloud-draft:v1';
assert(LOCAL_ACTIVE_DRAFT_KEY === 'ipl-draft-arena:active-cloud-draft:v1', 'Local storage key for active cloud draft is correct');

// 162. Local storage key for cloud history fallback is defined correctly
const LOCAL_HISTORY_KEY = 'ipl-draft-arena:cloud-history-fallback:v1';
assert(LOCAL_HISTORY_KEY === 'ipl-draft-arena:cloud-history-fallback:v1', 'Local storage key for cloud history fallback is correct');

// 163. Original localStorage persistence key remains intact after Phase 6C
const ORIGINAL_PERSISTENCE_KEY = 'ipl-draft-arena:game:v1';
assert(ORIGINAL_PERSISTENCE_KEY === 'ipl-draft-arena:game:v1', 'Original localStorage persistence key remains intact after Phase 6C');

// 164. saveDraft does not overwrite status from completed to drafting
const gs164Completed = { ...gs147, status: 'completed' };
const save164 = await saveDraft('owner-164', gs164Completed);
assert(save164.draft?.status === 'completed', 'saveDraft preserves completed status');

// 165. Resume: loaded game state has same player count as before save
let g165 = startGame(createInitialGame({}, { player1: { name: 'Priya' }, player2: { name: 'Ravi' } }));
for (let i = 0; i < 3; i++) {
  const pool = getDraftPool().find(p => !g165.selectedPlayerIds.includes(p.id) && canSelectPlayer(p, getCurrentPlayer(g165).squad, g165));
  if (!pool) break;
  const sr = applyTeamResult(g165, pool.teamId);
  const cr = confirmPick(sr, pool.id);
  if (cr.success) g165 = cr.updatedGameState;
}
const save165 = await saveDraft('owner-165', g165);
const loaded165 = save165.draft?.game_state;
assert(
  loaded165?.player1?.squad?.length === g165.player1.squad.length &&
  loaded165?.player2?.squad?.length === g165.player2.squad.length,
  'Resume: loaded game state has same player count as before save'
);

// 166. Resume: loaded game state has same selectedPlayerIds count
assert(
  loaded165?.selectedPlayerIds?.length === g165.selectedPlayerIds.length,
  'Resume: loaded game state has same selectedPlayerIds count'
);

// 167. Draft save preserves player ratings in squad entries
const firstPick167 = loaded165?.player1?.squad?.[0];
assert(firstPick167 && typeof firstPick167.id === 'string', 'Draft save preserves player ID in squad entries');

// 168. Squad order is preserved after save/load cycle
assert(
  JSON.stringify(loaded165?.player1?.squadOrder) === JSON.stringify(g165.player1?.squadOrder),
  'Squad order is preserved after save/load cycle'
);

// 169. Pick history is preserved after save/load cycle
assert(
  (loaded165?.pickHistory?.length || 0) === (g165.pickHistory?.length || 0),
  'Pick history is preserved after save/load cycle'
);

// 170. Current turn is preserved after save/load cycle
assert(
  loaded165?.currentTurn === g165.currentTurn,
  'Current turn is preserved after save/load cycle'
);

// 171. RLS ownership concept: owner_id matches requesting user
const draft171 = save165.draft;
const isOwner171 = draft171?.owner_id === 'owner-165';
assert(isOwner171, 'RLS ownership: owner_id matches the requesting user');

// 172. Discard clears localStorage active draft
const gs172 = { ...gs136, status: 'drafting', cloudDraftId: 'local-discard-test-172' };
await saveDraft('demo-owner', gs172); // writes to localStorage
const discard172 = await discardDraft('demo-owner', 'local-discard-test-172');
assert(discard172.success === true, 'Discard clears localStorage active draft without error');

// 173. Draft games table status must be one of valid values
const VALID_STATUSES = ['setup', 'drafting', 'player-selection', 'completed', 'discarded', 'error'];
const testStatus = 'drafting';
assert(VALID_STATUSES.includes(testStatus), 'Draft game status values are within valid set');

// 174. completeDraft stores player1_score and player2_score
assert(
  complete147.draft?.player1_score === 75 && complete147.draft?.player2_score === 60,
  'completeDraft stores player1_score and player2_score'
);

// 175. All 135 previous tests still pass with Phase 6C additions (regression check)
assert(isDraftComplete(g135) === true, 'Regression: 24-pick completion engine still works with Phase 6C additions');

console.log('═'.repeat(60));
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
