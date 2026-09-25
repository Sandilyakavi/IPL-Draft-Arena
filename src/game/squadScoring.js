/**
 * src/game/squadScoring.js
 * =================================================================
 * SQUAD SCORE 2.0 ENGINE
 * =================================================================
 * Evaluates comprehensive squad quality, structural balance, phase potency,
 * depth indices, and synergy for IPL squads.
 *
 * Exposes:
 * - calculateDetailedSquadScores(squad, season)
 * =================================================================
 */

import {
  getBattingRating,
  getBowlingRating,
  getFieldingRating,
  getAllRoundRating,
  getOverallRating,
  getDetailedDisciplineBreakdown,
} from './playerRatingEngine.js';
import { DEFAULT_SEASON } from '../config/seasonConfig.js';
import { DRAFT_CONFIG } from '../config/draftConfig.js';

function clamp(val, min = 0, max = 100) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Calculates comprehensive 17-dimension squad metrics (0–100 each)
 * and composite overallSquadScore.
 */
export function calculateDetailedSquadScores(squad = [], season = DEFAULT_SEASON) {
  if (!Array.isArray(squad) || squad.length === 0) {
    return {
      overallSquadScore: 0,
      categories: {
        batting: 0,
        bowling: 0,
        allRound: 0,
        wicketkeeping: 0,
        pace: 0,
        spin: 0,
        depth: 0,
        balance: 0,
        synergy: 0,
        powerplay: 0,
        middleOvers: 0,
        deathOvers: 0,
        battingDepth: 0,
        bowlingDepth: 0,
        overseasUtilization: 0,
        benchStrength: 0,
        squadFlexibility: 0,
        playerQuality: 0,
      },
    };
  }

  const squadSize = squad.length;

  // Granular ratings for each player
  const playerBreakdowns = squad.map(p => ({
    player: p,
    overall: getOverallRating(p, season),
    batting: getBattingRating(p, season),
    bowling: getBowlingRating(p, season),
    fielding: getFieldingRating(p, season),
    allRound: getAllRoundRating(p, season),
    details: getDetailedDisciplineBreakdown(p, season),
  }));

  // 1. Player Quality
  const avgOverall = playerBreakdowns.reduce((sum, p) => sum + p.overall, 0) / squadSize;
  const playerQuality = clamp(Math.round(avgOverall));

  // 2. Batting Strength (Top 6-7 batters)
  const sortedBatters = [...playerBreakdowns].sort((a, b) => b.batting - a.batting);
  const topBatters = sortedBatters.slice(0, 6);
  const avgTopBatting = topBatters.length > 0
    ? topBatters.reduce((sum, b) => sum + b.batting, 0) / topBatters.length
    : 40;
  const battingStrength = clamp(Math.round(avgTopBatting));

  // 3. Batting Depth (Batters 7 to 9)
  const lowerBatters = sortedBatters.slice(6, 9);
  const avgLowerBatting = lowerBatters.length > 0
    ? lowerBatters.reduce((sum, b) => sum + b.batting, 0) / lowerBatters.length
    : 30;
  const battingDepth = clamp(Math.round((avgLowerBatting / 60) * 100));

  // 4. Bowling Strength (Top 5 bowlers)
  const sortedBowlers = [...playerBreakdowns].sort((a, b) => b.bowling - a.bowling);
  const topBowlers = sortedBowlers.slice(0, 5);
  const avgTopBowling = topBowlers.length > 0
    ? topBowlers.reduce((sum, b) => sum + b.bowling, 0) / topBowlers.length
    : 40;
  const bowlingStrength = clamp(Math.round(avgTopBowling));

  // 5. Bowling Depth (Number of capable bowling options)
  const bowlingCapable = playerBreakdowns.filter(p =>
    p.player.role === 'bowler' || p.player.role === 'all-rounder' || p.bowling >= 55
  );
  let bowlingDepthScore = 40;
  if (bowlingCapable.length >= 7) bowlingDepthScore = 98;
  else if (bowlingCapable.length === 6) bowlingDepthScore = 90;
  else if (bowlingCapable.length === 5) bowlingDepthScore = 80;
  else if (bowlingCapable.length === 4) bowlingDepthScore = 60;
  else if (bowlingCapable.length === 3) bowlingDepthScore = 45;
  else bowlingDepthScore = 25;

  // 6. Pace vs Spin Depth
  const pacers = playerBreakdowns.filter(p => {
    const s = p.player.bowlingStyle || '';
    return s.includes('fast') || s.includes('medium') || s.includes('pace') || (p.player.role === 'bowler' && !s.includes('spin'));
  });
  const spinners = playerBreakdowns.filter(p => {
    const s = p.player.bowlingStyle || '';
    return s.includes('spin') || s.includes('break') || s.includes('orthodox');
  });

  const paceDepth = clamp(Math.round(
    pacers.length >= 3 ? 90 + Math.min(10, (pacers.reduce((s, p) => s + p.bowling, 0) / pacers.length) * 0.1)
    : pacers.length === 2 ? 75
    : pacers.length === 1 ? 50 : 25
  ));

  const spinDepth = clamp(Math.round(
    spinners.length >= 2 ? 88 + Math.min(12, (spinners.reduce((s, p) => s + p.bowling, 0) / spinners.length) * 0.1)
    : spinners.length === 1 ? 72 : 30
  ));

  // 7. Wicketkeeping
  const wks = playerBreakdowns.filter(p => p.player.isWicketkeeper || p.player.role === 'wicketkeeper-batter');
  let wicketkeepingScore = 20;
  if (wks.length >= 2) {
    wicketkeepingScore = 96; // Starter + backup
  } else if (wks.length === 1) {
    wicketkeepingScore = 90; // Primary specialist
  }

  // 8. All-Round Strength & Squad Flexibility
  const allRounders = playerBreakdowns.filter(p => p.player.role === 'all-rounder');
  const allRoundStrength = clamp(Math.round(
    allRounders.length >= 2 ? 90 + Math.min(10, (allRounders.reduce((s, p) => s + p.allRound, 0) / allRounders.length) * 0.1)
    : allRounders.length === 1 ? 75 : 40
  ));

  const squadFlexibility = clamp(Math.round((allRoundStrength * 0.6) + (bowlingDepthScore * 0.4)));

  // 9. Phase Potency (Powerplay, Middle-Overs, Death-Overs)
  const ppBat = topBatters.slice(0, 3).reduce((s, b) => s + (b.details?.batting?.powerplay || b.batting), 0) / 3;
  const ppBowl = topBowlers.slice(0, 2).reduce((s, b) => s + (b.details?.bowling?.powerplay || b.bowling), 0) / 2;
  const powerplayStrength = clamp(Math.round((ppBat * 0.50) + (ppBowl * 0.50)));

  const midBat = topBatters.slice(2, 5).reduce((s, b) => s + (b.details?.batting?.middleOvers || b.batting), 0) / Math.max(1, topBatters.slice(2, 5).length);
  const midBowl = topBowlers.slice(1, 4).reduce((s, b) => s + (b.details?.bowling?.middleOvers || b.bowling), 0) / Math.max(1, topBowlers.slice(1, 4).length);
  const middleOverStrength = clamp(Math.round((midBat * 0.50) + (midBowl * 0.50)));

  const deathBat = topBatters.slice(4, 6).reduce((s, b) => s + (b.details?.batting?.deathOvers || b.batting), 0) / Math.max(1, topBatters.slice(4, 6).length);
  const deathBowl = topBowlers.slice(0, 3).reduce((s, b) => s + (b.details?.bowling?.deathOvers || b.bowling), 0) / Math.max(1, topBowlers.slice(0, 3).length);
  const deathOverStrength = clamp(Math.round((deathBat * 0.45) + (deathBowl * 0.55)));

  // 10. Overseas Utilization
  const overseasCount = squad.filter(p => p.isOverseas).length;
  let overseasUtilization = 50;
  if (overseasCount === 4) overseasUtilization = 95; // Optimal IPL standard
  else if (overseasCount === 3) overseasUtilization = 85;
  else if (overseasCount === 2) overseasUtilization = 75;
  else if (overseasCount === 1) overseasUtilization = 60;
  else overseasUtilization = 40;

  // 11. Bench Strength (12th player / backup options)
  const benchPlayer = sortedBatters[sortedBatters.length - 1];
  const benchStrength = clamp(Math.round(benchPlayer ? benchPlayer.overall : 60));

  // 12. Structural Balance
  const roleBalance = clamp(Math.round(
    (wicketkeepingScore * 0.20) +
    (bowlingDepthScore * 0.35) +
    (battingStrength * 0.25) +
    (overseasUtilization * 0.20)
  ));

  // 13. Synergy (Combines complementary skills: Pace + Spin + Batting Depth + All-rounders)
  const synergy = clamp(Math.round(
    (paceDepth * 0.25) +
    (spinDepth * 0.25) +
    (battingDepth * 0.25) +
    (allRoundStrength * 0.25)
  ));

  // 14. Composite Overall Squad Score (0–100 scale, with one decimal precision)
  const compositeScore = (
    (battingStrength * 0.20) +
    (bowlingStrength * 0.20) +
    (allRoundStrength * 0.10) +
    (wicketkeepingScore * 0.08) +
    (roleBalance * 0.12) +
    (synergy * 0.10) +
    (powerplayStrength * 0.07) +
    (middleOverStrength * 0.06) +
    (deathOverStrength * 0.07)
  );

  const overallSquadScore = Math.round(compositeScore * 10) / 10;

  return {
    overallSquadScore: clamp(overallSquadScore),
    categories: {
      batting: battingStrength,
      bowling: bowlingStrength,
      allRound: allRoundStrength,
      wicketkeeping: wicketkeepingScore,
      pace: paceDepth,
      spin: spinDepth,
      depth: Math.round((battingDepth + bowlingDepthScore) / 2),
      balance: roleBalance,
      synergy: synergy,
      powerplay: powerplayStrength,
      middleOvers: middleOverStrength,
      deathOvers: deathOverStrength,
      battingDepth: battingDepth,
      bowlingDepth: bowlingDepthScore,
      overseasUtilization: overseasUtilization,
      benchStrength: benchStrength,
      squadFlexibility: squadFlexibility,
      playerQuality: playerQuality,
    },
  };
}
