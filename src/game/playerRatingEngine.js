/**
 * Player Rating Engine — Computes player performance ratings and quality scores
 * based on verified IPL statistical data.
 */

import playerRatingsData from '../data/playerRatings.json' with { type: 'json' };

/**
 * Calculates normalized batting rating (0–100).
 */
export function calculateBattingRating(stats) {
  if (!stats || typeof stats.runs !== 'number') return null;

  const runs = stats.runs || 0;
  const strikeRate = stats.strikeRate || 0;
  const average = stats.average || 0;
  const matches = stats.matches || stats.innings || 0;

  // Weightings: Runs 40%, SR 25%, Avg 25%, Matches 10%
  const runsScore = Math.min(100, (runs / 550) * 100);
  const srScore = Math.min(100, Math.max(0, ((strikeRate - 100) / 70) * 100));
  const avgScore = Math.min(100, Math.max(0, ((average - 15) / 35) * 100));
  const matchScore = Math.min(100, (matches / 14) * 100);

  const weighted = (runsScore * 0.40) + (srScore * 0.25) + (avgScore * 0.25) + (matchScore * 0.10);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

/**
 * Calculates normalized bowling rating (0–100).
 */
export function calculateBowlingRating(stats) {
  if (!stats || typeof stats.wickets !== 'number') return null;

  const wickets = stats.wickets || 0;
  const economy = stats.economy || 9.5;
  const average = stats.average || 35.0;
  const strikeRate = stats.strikeRate || 25.0;

  // Weightings: Wickets 40%, Economy 25%, Average 20%, Strike Rate 15%
  const wicketsScore = Math.min(100, (wickets / 22) * 100);
  const ecoScore = Math.min(100, Math.max(0, ((11.5 - economy) / 5.5) * 100));
  const avgScore = Math.min(100, Math.max(0, ((45.0 - average) / 30.0) * 100));
  const srScore = Math.min(100, Math.max(0, ((35.0 - strikeRate) / 22.0) * 100));

  const weighted = (wicketsScore * 0.40) + (ecoScore * 0.25) + (avgScore * 0.20) + (srScore * 0.15);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

/**
 * Calculates normalized all-rounder rating (0–100).
 */
export function calculateAllRounderRating(stats) {
  if (!stats) return null;
  const batting = calculateBattingRating(stats.batting);
  const bowling = calculateBowlingRating(stats.bowling);

  if (batting === null && bowling === null) return null;
  if (batting === null) return bowling;
  if (bowling === null) return batting;

  // Equal 50/50 contribution for all-rounders
  return Math.round((batting * 0.5) + (bowling * 0.5));
}

/**
 * Calculates normalized wicketkeeper rating (0–100).
 */
export function calculateWicketkeeperRating(stats) {
  if (!stats) return null;
  const batting = calculateBattingRating(stats.batting || stats);
  if (batting === null) return null;

  const dismissals = stats.dismissals || (stats.catches || 0) + (stats.stumpings || 0);
  const keepingBonus = Math.min(15, Math.round((dismissals / 12) * 15));

  return Math.min(100, Math.round((batting * 0.85) + keepingBonus));
}

/**
 * Computes player quality evaluation object for a specific player and season.
 */
export function calculateOverallPlayerQuality(player, stats, season = '2026') {
  if (!player) return null;

  // Check pre-calculated verified ratings if present
  const ratingRecord = playerRatingsData.find(r => r.playerId === player.id && String(r.season) === String(season));
  if (ratingRecord) {
    return ratingRecord;
  }

  // Calculate dynamically if stats exist
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

/**
 * Returns player rating object for a given playerId and season.
 */
export function getPlayerRating(playerId, season = '2026') {
  const record = playerRatingsData.find(r => r.playerId === playerId && String(r.season) === String(season));
  if (record) return record;

  return {
    playerId,
    season: String(season),
    rating: null,
    confidence: 'low',
    ratingStatus: 'unrated',
    components: { batting: null, bowling: null, keeping: null },
  };
}

/**
 * Calculates aggregate squad quality score normalized to 0–70 points.
 */
export function getSquadQualityScore(squad = [], season = '2026') {
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
      qualityScore: 35, // Neutral midpoint fallback for completely unrated squad
      avgRating: 50,
      ratedCount: 0,
      totalCount,
      unratedCount,
    };
  }

  const sumRatings = ratings.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = sumRatings / ratedCount;

  // Aggregate Quality Score out of 70 points
  const qualityScore = Math.round(Math.min(70, Math.max(0, (avgRating / 100) * 70)));

  return {
    qualityScore,
    avgRating: Math.round(avgRating * 10) / 10,
    ratedCount,
    totalCount,
    unratedCount,
  };
}
