/**
 * src/game/playerRatingEngine.js
 * =================================================================
 * PLAYER RATING ENGINE 2.0
 * =================================================================
 * Advanced, explainable, and deterministic IPL-specific player rating system.
 * Evaluates multi-dimensional discipline metrics across Batting, Bowling,
 * Fielding, All-Round value, and Wicketkeeping.
 *
 * Exposes:
 * - getBattingRating(player, season)
 * - getBowlingRating(player, season)
 * - getFieldingRating(player, season)
 * - getAllRoundRating(player, season)
 * - getRoleRating(player, season)
 * - getOverallRating(player, season)
 * - getDetailedDisciplineBreakdown(player, season)
 *
 * Backward-compatible exports:
 * - calculateBattingRating(stats)
 * - calculateBowlingRating(stats)
 * - calculateAllRounderRating(stats)
 * - calculateWicketkeeperRating(stats)
 * - calculateOverallPlayerQuality(player, stats, season)
 * - getPlayerRating(playerId, season)
 * - getSquadQualityScore(squad, season)
 * =================================================================
 */

import playerRatingsData from '../data/playerRatings.json' with { type: 'json' };
import playerStatsData from '../data/playerStats.json' with { type: 'json' };
import playersData from '../data/players.json' with { type: 'json' };
import { DEFAULT_SEASON } from '../config/seasonConfig.js';
import { RATING_CONFIG } from '../config/ratingConfig.js';

// Pre-index stats by `${playerId}_${season}` for O(1) lookups
const statsMap = new Map();
if (playerStatsData && Array.isArray(playerStatsData.stats)) {
  for (const entry of playerStatsData.stats) {
    if (entry.playerId && entry.seasons) {
      for (const [seasonYear, seasonStats] of Object.entries(entry.seasons)) {
        statsMap.set(`${entry.playerId}_${seasonYear}`, seasonStats);
      }
    }
  }
}

// Pre-index master player records
const playerRecordMap = new Map();
if (Array.isArray(playersData)) {
  for (const p of playersData) {
    playerRecordMap.set(p.id, p);
  }
}

/**
 * Retrieves raw stats record for a given player and season.
 */
export function getRawPlayerStats(playerId, season = DEFAULT_SEASON) {
  return statsMap.get(`${playerId}_${String(season)}`) || null;
}

/**
 * Calculates confidence factor based on match count (0.40 - 1.00).
 */
export function calculateConfidenceFactor(matches) {
  if (typeof matches !== 'number' || matches <= 0) {
    return RATING_CONFIG.CONFIDENCE.UNRATED_WEIGHT;
  }
  if (matches >= RATING_CONFIG.CONFIDENCE.HIGH_MATCHES) return 1.0;
  if (matches >= RATING_CONFIG.CONFIDENCE.MEDIUM_MATCHES) return 0.85;
  if (matches >= RATING_CONFIG.CONFIDENCE.LOW_MATCHES) return 0.70;
  if (matches >= RATING_CONFIG.CONFIDENCE.MINIMAL_MATCHES) return 0.55;
  return RATING_CONFIG.CONFIDENCE.UNRATED_WEIGHT;
}

/**
 * Binds a raw score between MIN_RATING and MAX_RATING.
 */
function clamp(val, min = 0, max = 100) {
  return Math.min(max, Math.max(min, val));
}

// ─────────────────────────────────────────────────────────────────
// 1. BATTING METRICS ENGINE
// ─────────────────────────────────────────────────────────────────

/**
 * Detailed Batting Discipline Metrics:
 * - Batting consistency
 * - Batting average
 * - Strike rate
 * - Power hitting / Boundary ability
 * - Strike rotation
 * - Phase effectiveness (Powerplay, Middle, Death)
 * - Chasing / Match impact
 */
export function calculateDetailedBattingMetrics(stats) {
  if (!stats || typeof stats !== 'object') {
    return null;
  }

  const runs = stats.runs || 0;
  const strikeRate = stats.strikeRate || 0;
  const average = stats.average || 0;
  const matches = stats.matches || stats.innings || 0;
  const dismissals = stats.dismissals || (average > 0 ? Math.round(runs / average) : matches);
  const notOuts = stats.notOuts || Math.max(0, matches - dismissals);

  // Normalized Base Components (0–100)
  const runsScore = clamp((runs / RATING_CONFIG.BENCHMARKS.BATTING.ELITE_RUNS) * 100);
  const avgScore = clamp(((average - RATING_CONFIG.BENCHMARKS.BATTING.MIN_AVG) /
    (RATING_CONFIG.BENCHMARKS.BATTING.ELITE_AVG - RATING_CONFIG.BENCHMARKS.BATTING.MIN_AVG)) * 100);
  const srScore = clamp(((strikeRate - RATING_CONFIG.BENCHMARKS.BATTING.MIN_SR) /
    (RATING_CONFIG.BENCHMARKS.BATTING.ELITE_SR - RATING_CONFIG.BENCHMARKS.BATTING.MIN_SR)) * 100);

  // Power Hitting & Boundary Ability (derived from SR exceeding par)
  const powerHitting = clamp(srScore > 60 ? srScore * 1.05 : srScore * 0.90);
  const boundaryAbility = clamp((strikeRate / 160) * 100);

  // Strike Rotation (derived from average-to-SR balance)
  const strikeRotation = clamp((avgScore * 0.45) + (srScore * 0.55));

  // Consistency (reward low dismissal rate and 30+ average stability)
  const consistency = clamp((avgScore * 0.60) + (runsScore * 0.40));

  // Phase Effectiveness:
  // Powerplay: High SR + solid base
  const powerplayBatting = clamp((srScore * 0.55) + (boundaryAbility * 0.45));
  // Middle-Overs: Rotation + boundary keeping
  const middleOverBatting = clamp((strikeRotation * 0.60) + (avgScore * 0.40));
  // Death-Overs: Maximum SR and power hitting
  const deathOverBatting = clamp((srScore * 0.70) + (powerHitting * 0.30));

  // Match Impact: Volume of runs + strike rate premium + finisher not outs
  const matchImpact = clamp((runsScore * 0.45) + (srScore * 0.35) + (notOuts * 4));

  // Weighted Batting Performance
  const weights = RATING_CONFIG.BATTER_WEIGHTS;
  const rawScore = (runsScore * weights.runsVolume) +
    (avgScore * weights.average) +
    (srScore * weights.strikeRate) +
    (powerHitting * weights.powerHitting) +
    (consistency * weights.consistency) +
    (matchImpact * weights.matchImpact);

  const confidence = calculateConfidenceFactor(matches);
  const finalRating = Math.round(rawScore * confidence + RATING_CONFIG.DEFAULT_UNRATED * (1 - confidence));

  return {
    rating: clamp(finalRating, RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING),
    consistency: Math.round(consistency),
    averageScore: Math.round(avgScore),
    strikeRateScore: Math.round(srScore),
    powerHitting: Math.round(powerHitting),
    boundaryAbility: Math.round(boundaryAbility),
    strikeRotation: Math.round(strikeRotation),
    powerplay: Math.round(powerplayBatting),
    middleOvers: Math.round(middleOverBatting),
    deathOvers: Math.round(deathOverBatting),
    matchImpact: Math.round(matchImpact),
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. BOWLING METRICS ENGINE
// ─────────────────────────────────────────────────────────────────

/**
 * Detailed Bowling Discipline Metrics:
 * - Bowling economy
 * - Bowling strike rate
 * - Wicket-taking ability
 * - Powerplay, Middle, and Death bowling
 * - Dot-ball ability
 * - Pressure performance
 * - Match impact
 */
export function calculateDetailedBowlingMetrics(stats) {
  if (!stats || typeof stats !== 'object' || typeof stats.wickets !== 'number') {
    return null;
  }

  const wickets = stats.wickets || 0;
  const economy = stats.economy || 9.2;
  const average = stats.average || 32.0;
  const strikeRate = stats.strikeRate || 24.0;
  const matches = stats.matches || stats.innings || 0;

  // Normalized Base Components (0–100)
  const wicketsScore = clamp((wickets / RATING_CONFIG.BENCHMARKS.BOWLING.ELITE_WICKETS) * 100);
  const ecoScore = clamp(((RATING_CONFIG.BENCHMARKS.BOWLING.MAX_ECONOMY - economy) /
    (RATING_CONFIG.BENCHMARKS.BOWLING.MAX_ECONOMY - RATING_CONFIG.BENCHMARKS.BOWLING.ELITE_ECONOMY)) * 100);
  const srScore = clamp(((RATING_CONFIG.BENCHMARKS.BOWLING.MAX_SR - strikeRate) /
    (RATING_CONFIG.BENCHMARKS.BOWLING.MAX_SR - RATING_CONFIG.BENCHMARKS.BOWLING.ELITE_SR)) * 100);
  const avgScore = clamp(((45.0 - average) / 28.0) * 100);

  // Wicket-Taking Ability
  const wicketTakingAbility = clamp((wicketsScore * 0.55) + (srScore * 0.45));

  // Dot-Ball Ability & Pressure Performance (strong economy correlation)
  const dotBallAbility = clamp((ecoScore * 0.65) + (avgScore * 0.35));
  const pressurePerformance = clamp((ecoScore * 0.50) + (wicketsScore * 0.50));

  // Phase Effectiveness:
  // Powerplay: Strict economy + early wickets
  const powerplayBowling = clamp((ecoScore * 0.60) + (wicketTakingAbility * 0.40));
  // Middle-Overs: Control + spin/containment
  const middleOverBowling = clamp((dotBallAbility * 0.55) + (ecoScore * 0.45));
  // Death Bowling: Wickets at the end while resisting high run environment
  const deathBowling = clamp((wicketTakingAbility * 0.60) + (ecoScore * 0.40));

  // Match Impact: High wickets + stifling economy
  const matchImpact = clamp((wicketsScore * 0.50) + (ecoScore * 0.30) + (srScore * 0.20));

  // Weighted Bowling Performance
  const weights = RATING_CONFIG.BOWLER_WEIGHTS;
  const rawScore = (wicketsScore * weights.wicketsVolume) +
    (ecoScore * weights.economy) +
    (srScore * weights.strikeRate) +
    (dotBallAbility * weights.dotBallAbility) +
    (deathBowling * weights.deathBowling) +
    (matchImpact * weights.matchImpact);

  const confidence = calculateConfidenceFactor(matches);
  const finalRating = Math.round(rawScore * confidence + RATING_CONFIG.DEFAULT_UNRATED * (1 - confidence));

  return {
    rating: clamp(finalRating, RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING),
    economyScore: Math.round(ecoScore),
    strikeRateScore: Math.round(srScore),
    wicketTakingAbility: Math.round(wicketTakingAbility),
    dotBallAbility: Math.round(dotBallAbility),
    pressurePerformance: Math.round(pressurePerformance),
    powerplay: Math.round(powerplayBowling),
    middleOvers: Math.round(middleOverBowling),
    deathOvers: Math.round(deathBowling),
    matchImpact: Math.round(matchImpact),
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────
// 3. FIELDING METRICS ENGINE
// ─────────────────────────────────────────────────────────────────

export function calculateDetailedFieldingMetrics(player, stats) {
  const matches = stats?.matches || 10;
  const catches = stats?.catches || 0;
  const stumpings = stats?.stumpings || 0;

  let baseFielding = RATING_CONFIG.BENCHMARKS.FIELDING.BASELINE_FIELDING;

  // Athleticism adjustments based on role & known agility
  if (player?.role === 'wicketkeeper-batter' || player?.isWicketkeeper) {
    const dismissalBonus = Math.min(22, (catches + stumpings) * 2.2);
    baseFielding = Math.round(75 + dismissalBonus);
  } else if (player?.role === 'all-rounder') {
    baseFielding = 78;
  } else if (player?.role === 'batter') {
    baseFielding = 74;
  } else {
    baseFielding = 70;
  }

  const catchingContribution = clamp(baseFielding + (catches * 1.5));
  const runOutContribution = clamp(baseFielding);
  const fieldingImpact = clamp((catchingContribution * 0.6) + (runOutContribution * 0.4));

  return {
    rating: clamp(Math.round(fieldingImpact), RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING),
    fieldingImpact: Math.round(fieldingImpact),
    catchingContribution: Math.round(catchingContribution),
    runOutContribution: Math.round(runOutContribution),
  };
}

// ─────────────────────────────────────────────────────────────────
// 4. DISCIPLINE GETTERS (PUBLIC API)
// ─────────────────────────────────────────────────────────────────

/**
 * Returns player's normalized Batting Rating (0–100).
 */
export function getBattingRating(player, season = DEFAULT_SEASON) {
  if (!player) return null;
  const statsRecord = getRawPlayerStats(player.id, season);
  const battingStats = statsRecord?.batting || (statsRecord && typeof statsRecord.runs === 'number' ? statsRecord : null);
  const metrics = calculateDetailedBattingMetrics(battingStats);
  return metrics ? metrics.rating : (player.role === 'batter' || player.role === 'wicketkeeper-batter' ? 60 : 35);
}

/**
 * Returns player's normalized Bowling Rating (0–100).
 */
export function getBowlingRating(player, season = DEFAULT_SEASON) {
  if (!player) return null;
  const statsRecord = getRawPlayerStats(player.id, season);
  const bowlingStats = statsRecord?.bowling || (statsRecord && typeof statsRecord.wickets === 'number' ? statsRecord : null);
  const metrics = calculateDetailedBowlingMetrics(bowlingStats);
  return metrics ? metrics.rating : (player.role === 'bowler' ? 60 : (player.role === 'all-rounder' ? 50 : 25));
}

/**
 * Returns player's normalized Fielding Rating (0–100).
 */
export function getFieldingRating(player, season = DEFAULT_SEASON) {
  if (!player) return 70;
  const statsRecord = getRawPlayerStats(player.id, season);
  const metrics = calculateDetailedFieldingMetrics(player, statsRecord);
  return metrics.rating;
}

/**
 * Returns player's normalized All-Round Rating (0–100).
 */
export function getAllRoundRating(player, season = DEFAULT_SEASON) {
  if (!player) return null;
  const batRating = getBattingRating(player, season);
  const bowlRating = getBowlingRating(player, season);

  const primary = Math.max(batRating, bowlRating);
  const secondary = Math.min(batRating, bowlRating);

  // Two-skill reliability bonus: rewarded if both skills are viable (>= 50)
  const balanceBonus = (primary >= 60 && secondary >= 50) ? 8 : (secondary >= 40 ? 4 : 0);
  const composite = (primary * RATING_CONFIG.ALL_ROUNDER_WEIGHTS.primarySkill) +
    (secondary * RATING_CONFIG.ALL_ROUNDER_WEIGHTS.secondarySkill) +
    balanceBonus;

  return clamp(Math.round(composite), RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING);
}

/**
 * Returns role-specific rating for a player based on their primary position.
 */
export function getRoleRating(player, season = DEFAULT_SEASON) {
  if (!player) return 50;

  switch (player.role) {
    case 'batter':
      return getBattingRating(player, season);
    case 'bowler':
      return getBowlingRating(player, season);
    case 'all-rounder':
      return getAllRoundRating(player, season);
    case 'wicketkeeper-batter': {
      const bat = getBattingRating(player, season);
      const field = getFieldingRating(player, season);
      const composite = (bat * RATING_CONFIG.WICKETKEEPER_WEIGHTS.battingContribution) +
        (field * (RATING_CONFIG.WICKETKEEPER_WEIGHTS.keepingContribution + RATING_CONFIG.WICKETKEEPER_WEIGHTS.reliabilityBonus));
      return clamp(Math.round(composite), RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING);
    }
    default:
      return 50;
  }
}

/**
 * Returns the overall player rating (0–100).
 * Formula: overall = roleAdjustedPerformance + matchImpact + consistency + specialistValue
 */
export function getOverallRating(player, season = DEFAULT_SEASON) {
  if (!player) return 50;

  const roleRating = getRoleRating(player, season);
  const fieldRating = getFieldingRating(player, season);

  const roleMult = RATING_CONFIG.ROLE_MULTIPLIERS[player.role] || RATING_CONFIG.ROLE_MULTIPLIERS.batter;
  const batRating = getBattingRating(player, season);
  const bowlRating = getBowlingRating(player, season);

  const roleAdjustedPerformance = (batRating * roleMult.batting) +
    (bowlRating * roleMult.bowling) +
    (fieldRating * roleMult.fielding);

  // Specialist / Match-Winner anchor
  const overall = Math.round((roleAdjustedPerformance * 0.70) + (roleRating * 0.30));
  return clamp(overall, RATING_CONFIG.MIN_RATING, RATING_CONFIG.MAX_RATING);
}

/**
 * Returns full granular metric breakdown for a player card or debug view.
 */
export function getDetailedDisciplineBreakdown(player, season = DEFAULT_SEASON) {
  if (!player) return null;
  const statsRecord = getRawPlayerStats(player.id, season);
  const batStats = statsRecord?.batting || (statsRecord && typeof statsRecord.runs === 'number' ? statsRecord : null);
  const bowlStats = statsRecord?.bowling || (statsRecord && typeof statsRecord.wickets === 'number' ? statsRecord : null);

  const bat = calculateDetailedBattingMetrics(batStats);
  const bowl = calculateDetailedBowlingMetrics(bowlStats);
  const field = calculateDetailedFieldingMetrics(player, statsRecord);
  const overall = getOverallRating(player, season);

  return {
    overall,
    roleRating: getRoleRating(player, season),
    batting: bat,
    bowling: bowl,
    fielding: field,
  };
}

// ─────────────────────────────────────────────────────────────────
// 5. BACKWARD-COMPATIBILITY EXPORTS (Preserves 100% existing test API)
// ─────────────────────────────────────────────────────────────────

export function calculateBattingRating(stats) {
  if (!stats || typeof stats.runs !== 'number') return null;

  const runs = stats.runs || 0;
  const strikeRate = stats.strikeRate || 0;
  const average = stats.average || 0;
  const matches = stats.matches || stats.innings || 0;

  const runsScore = Math.min(100, (runs / 550) * 100);
  const srScore = Math.min(100, Math.max(0, ((strikeRate - 100) / 70) * 100));
  const avgScore = Math.min(100, Math.max(0, ((average - 15) / 35) * 100));
  const matchScore = Math.min(100, (matches / 14) * 100);

  const weighted = (runsScore * 0.40) + (srScore * 0.25) + (avgScore * 0.25) + (matchScore * 0.10);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export function calculateBowlingRating(stats) {
  if (!stats || typeof stats.wickets !== 'number') return null;

  const wickets = stats.wickets || 0;
  const economy = stats.economy || 9.5;
  const average = stats.average || 35.0;
  const strikeRate = stats.strikeRate || 25.0;

  const wicketsScore = Math.min(100, (wickets / 22) * 100);
  const ecoScore = Math.min(100, Math.max(0, ((11.5 - economy) / 5.5) * 100));
  const avgScore = Math.min(100, Math.max(0, ((45.0 - average) / 30.0) * 100));
  const srScore = Math.min(100, Math.max(0, ((35.0 - strikeRate) / 22.0) * 100));

  const weighted = (wicketsScore * 0.40) + (ecoScore * 0.25) + (avgScore * 0.20) + (srScore * 0.15);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export function calculateAllRounderRating(stats) {
  if (!stats) return null;
  const batting = calculateBattingRating(stats.batting);
  const bowling = calculateBowlingRating(stats.bowling);

  if (batting === null && bowling === null) return null;
  if (batting === null) return bowling;
  if (bowling === null) return batting;

  return Math.round((batting * 0.5) + (bowling * 0.5));
}

export function calculateWicketkeeperRating(stats) {
  if (!stats) return null;
  const batting = calculateBattingRating(stats.batting || stats);
  if (batting === null) return null;

  const dismissals = stats.dismissals || (stats.catches || 0) + (stats.stumpings || 0);
  const keepingBonus = Math.min(15, Math.round((dismissals / 12) * 15));

  return Math.min(100, Math.round((batting * 0.85) + keepingBonus));
}

export function calculateOverallPlayerQuality(player, stats, season = DEFAULT_SEASON) {
  if (!player) return null;

  const ratingRecord = playerRatingsData.find(r => r.playerId === player.id && String(r.season) === String(season));
  if (ratingRecord) {
    return ratingRecord;
  }

  if (!stats) {
    return {
      playerId: player.id,
      season: String(season),
      rating: null,
      confidence: 'low',
      ratingStatus: 'unrated',
      components: { batting: null, bowling: null, keeping: null },
    };
  }

  const role = player.role;
  let rating = null;
  let components = { batting: null, bowling: null, keeping: null };

  if (role === 'batter') {
    components.batting = calculateBattingRating(stats.batting || stats);
    rating = components.batting;
  } else if (role === 'bowler') {
    components.bowling = calculateBowlingRating(stats.bowling || stats);
    rating = components.bowling;
  } else if (role === 'all-rounder') {
    components.batting = calculateBattingRating(stats.batting);
    components.bowling = calculateBowlingRating(stats.bowling);
    rating = calculateAllRounderRating(stats);
  } else if (role === 'wicketkeeper-batter') {
    components.batting = calculateBattingRating(stats.batting || stats);
    components.keeping = stats.catches || stats.stumpings ? 80 : null;
    rating = calculateWicketkeeperRating(stats);
  }

  const matches = stats.matches || (stats.batting?.matches || 0) + (stats.bowling?.matches || 0);
  let confidence = 'low';
  let ratingStatus = 'unrated';

  if (rating !== null) {
    ratingStatus = matches >= 10 ? 'verified' : 'limited-data';
    confidence = matches >= 12 ? 'high' : matches >= 5 ? 'medium' : 'low';
  }

  return {
    playerId: player.id,
    season: String(season),
    rating,
    confidence,
    ratingStatus,
    components,
  };
}

export function getPlayerRating(playerId, season = DEFAULT_SEASON) {
  const record = playerRatingsData.find(r => r.playerId === playerId && String(r.season) === String(season));
  if (record) return record;

  const rawStats = getRawPlayerStats(playerId, season);
  if (!rawStats) {
    return {
      playerId,
      season: String(season),
      rating: null,
      confidence: 'low',
      ratingStatus: 'unrated',
      components: { batting: null, bowling: null, keeping: null },
    };
  }

  const player = playerRecordMap.get(playerId);
  if (player) {
    const overall = getOverallRating(player, season);
    return {
      playerId,
      season: String(season),
      rating: overall,
      confidence: 'medium',
      ratingStatus: 'verified',
      components: {
        batting: getBattingRating(player, season),
        bowling: getBowlingRating(player, season),
        keeping: player.isWicketkeeper ? 80 : null,
      },
    };
  }

  return {
    playerId,
    season: String(season),
    rating: null,
    confidence: 'low',
    ratingStatus: 'unrated',
    components: { batting: null, bowling: null, keeping: null },
  };
}

export function getSquadQualityScore(squad = [], season = DEFAULT_SEASON) {
  if (!squad || squad.length === 0) {
    return {
      qualityScore: 0,
      avgRating: 0,
      ratedCount: 0,
      totalCount: 0,
      unratedCount: 0,
    };
  }

  const ratings = squad.map(p => getPlayerRating(p.id, season)).filter(r => r && r.rating !== null);
  const ratedCount = ratings.length;
  const totalCount = squad.length;
  const unratedCount = totalCount - ratedCount;

  if (ratedCount === 0) {
    return {
      qualityScore: 35,
      avgRating: 50,
      ratedCount: 0,
      totalCount,
      unratedCount,
    };
  }

  const sumRatings = ratings.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = sumRatings / ratedCount;
  const qualityScore = Math.round(Math.min(70, Math.max(0, (avgRating / 100) * 70)));

  return {
    qualityScore,
    avgRating: Math.round(avgRating * 10) / 10,
    ratedCount,
    totalCount,
    unratedCount,
  };
}
