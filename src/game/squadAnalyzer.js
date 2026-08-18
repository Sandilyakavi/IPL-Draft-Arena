/**
 * Squad Analyzer Engine — Evaluates squad balance (30 pts), final score (100 pts),
 * strength/weakness analysis, and structural Best Playing XI recommendation.
 */

import { getSquadQualityScore, getPlayerRating } from './playerRatingEngine.js';
import teams from '../data/teams.json' with { type: 'json' };

/**
 * Calculates Squad Balance Score (0–30 points).
 */
export function calculateSquadBalance(squad = []) {
  const squadSize = squad.length;

  // 1. Role Balance (10 pts)
  const batters = squad.filter(p => p.role === 'batter' || p.role === 'wicketkeeper-batter');
  const bowlers = squad.filter(p => p.role === 'bowler');
  const allRounders = squad.filter(p => p.role === 'all-rounder');
  const wicketkeepers = squad.filter(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter');
  const bowlingCapable = squad.filter(p => p.role === 'bowler' || p.role === 'all-rounder');

  let roleBalanceScore = 0;
  if (batters.length >= 4) roleBalanceScore += 3;
  else if (batters.length >= 2) roleBalanceScore += 2;

  if (bowlers.length >= 3) roleBalanceScore += 3;
  else if (bowlers.length >= 1) roleBalanceScore += 2;

  if (allRounders.length >= 1) roleBalanceScore += 2;
  if (wicketkeepers.length >= 1) roleBalanceScore += 2;
  roleBalanceScore = Math.min(10, roleBalanceScore);

  // 2. Bowling Coverage (7 pts)
  let bowlingCoverageScore = 0;
  if (bowlingCapable.length >= 5) bowlingCoverageScore = 7;
  else if (bowlingCapable.length === 4) bowlingCoverageScore = 5;
  else if (bowlingCapable.length === 3) bowlingCoverageScore = 4;
  else if (bowlingCapable.length === 2) bowlingCoverageScore = 2;
  else if (bowlingCapable.length === 1) bowlingCoverageScore = 1;

  // 3. Wicketkeeping (4 pts)
  const wicketkeepingScore = wicketkeepers.length >= 1 ? 4 : 0;

  // 4. Overseas Balance (3 pts)
  const overseasCount = squad.filter(p => p.isOverseas).length;
  let overseasScore = 0;
  if (overseasCount >= 1 && overseasCount <= 4) overseasScore = 3;
  else if (overseasCount === 0) overseasScore = 2;

  // 5. Franchise Diversity (3 pts)
  const uniqueFranchises = new Set(squad.map(p => p.teamId)).size;
  let diversityScore = 1;
  if (uniqueFranchises >= 6) diversityScore = 3;
  else if (uniqueFranchises >= 4) diversityScore = 2;

  // 6. Completeness (3 pts)
  const completenessScore = squadSize === 12 ? 3 : Math.round((squadSize / 12) * 3);

  const totalBalanceScore = Math.min(
    30,
    roleBalanceScore + bowlingCoverageScore + wicketkeepingScore + overseasScore + diversityScore + completenessScore
  );

  return {
    totalBalanceScore,
    breakdown: {
      roleBalance: roleBalanceScore,
      bowlingCoverage: bowlingCoverageScore,
      wicketkeeping: wicketkeepingScore,
      overseasBalance: overseasScore,
      franchiseDiversity: diversityScore,
      completeness: completenessScore,
    },
    counts: {
      batters: batters.length,
      bowlers: bowlers.length,
      allRounders: allRounders.length,
      wicketkeepers: wicketkeepers.length,
      bowlingCapable: bowlingCapable.length,
      overseas: overseasCount,
      uniqueFranchises,
      squadSize,
    },
  };
}

/**
 * Returns descriptive score label for a final score (0–100).
 */
export function getScoreLabel(finalScore) {
  if (finalScore >= 90) return 'ELITE SQUAD';
  if (finalScore >= 80) return 'STRONG SQUAD';
  if (finalScore >= 70) return 'SOLID SQUAD';
  if (finalScore >= 60) return 'NEEDS IMPROVEMENT';
  return 'UNBALANCED SQUAD';
}

/**
 * Evaluates full squad score (Quality 70 + Balance 30 = Total 100).
 */
export function evaluateSquad(squad = [], season = '2026') {
  const quality = getSquadQualityScore(squad, season);
  const balance = calculateSquadBalance(squad);

  const finalScore = Math.min(100, Math.max(0, quality.qualityScore + balance.totalBalanceScore));
  const scoreLabel = getScoreLabel(finalScore);

  return {
    finalScore,
    scoreLabel,
    qualityScore: quality.qualityScore,
    balanceScore: balance.totalBalanceScore,
    qualityDetails: quality,
    balanceDetails: balance,
    strengths: generateStrengths(squad, quality, balance),
    weaknesses: generateWeaknesses(squad, quality, balance),
  };
}

/**
 * Generates factual strength statements based strictly on squad data.
 */
export function generateStrengths(squad, quality, balance) {
  const strengths = [];

  if (quality.avgRating >= 85) {
    strengths.push(`Strong player-quality core with an average verified rating of ${quality.avgRating}.`);
  } else if (quality.avgRating >= 75) {
    strengths.push(`Solid player-quality baseline with an average rating of ${quality.avgRating}.`);
  }

  if (balance.counts.bowlingCapable >= 5) {
    strengths.push(`Excellent bowling depth with ${balance.counts.bowlingCapable} bowling-capable options.`);
  }

  if (balance.counts.wicketkeepers >= 1) {
    strengths.push(`Specialist wicketkeeper coverage present (${balance.counts.wicketkeepers} WK).`);
  }

  if (balance.counts.overseas === 4) {
    strengths.push(`Four overseas players provide maximum allowed overseas roster flexibility.`);
  } else if (balance.counts.overseas >= 2) {
    strengths.push(`Balanced overseas selection with ${balance.counts.overseas} international stars.`);
  }

  if (balance.counts.uniqueFranchises >= 6) {
    strengths.push(`Strong franchise diversity representing ${balance.counts.uniqueFranchises} different IPL teams.`);
  }

  return strengths;
}

/**
 * Generates factual weakness statements based strictly on squad data.
 */
export function generateWeaknesses(squad, quality, balance) {
  const weaknesses = [];

  if (balance.counts.bowlingCapable < 5) {
    weaknesses.push(`Only ${balance.counts.bowlingCapable} bowling-capable players (recommended 5+).`);
  }

  if (balance.counts.wicketkeepers === 0) {
    weaknesses.push(`No specialist wicketkeeper in squad.`);
  }

  if (quality.unratedCount > 0) {
    weaknesses.push(`${quality.unratedCount} drafted player(s) have limited or unrated verified performance data.`);
  }

  if (quality.avgRating < 70) {
    weaknesses.push(`Lower overall player-quality average (${quality.avgRating}).`);
  }

  if (balance.counts.uniqueFranchises < 4) {
    weaknesses.push(`Low franchise diversity (only ${balance.counts.uniqueFranchises} teams represented).`);
  }

  return weaknesses;
}

/**
 * Determines structural Best Playing XI (11 players) and bench (1 player).
 */
export function getBestPlayingXI(squad = [], season = '2026') {
  if (!squad || squad.length === 0) {
    return { playingXI: [], bench: [], explanation: ['Squad is empty.'] };
  }

  // Attach quality rating to players for tie-breaking
  const ratedSquad = squad.map(p => {
    const rObj = getPlayerRating(p.id, season);
    return {
      ...p,
      ratingValue: rObj && rObj.rating !== null ? rObj.rating : 50,
    };
  });

  // Sort by rating descending
  const sorted = [...ratedSquad].sort((a, b) => b.ratingValue - a.ratingValue);

  const selected = [];
  const explanation = [];

  // 1. Pick Wicketkeeper
  const wks = sorted.filter(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter');
  if (wks.length > 0) {
    selected.push(wks[0]);
    explanation.push(`Selected ${wks[0].name} as primary wicketkeeper-batter.`);
  } else {
    explanation.push(`No specialist wicketkeeper available in squad.`);
  }

  // 2. Pick Bowling-Capable Options (up to 5)
  const bowlers = sorted.filter(p => (p.role === 'bowler' || p.role === 'all-rounder') && !selected.some(s => s.id === p.id));
  const neededBowlers = 5;
  let addedBowlers = 0;

  for (const b of bowlers) {
    const currentOverseas = selected.filter(s => s.isOverseas).length;
    if (b.isOverseas && currentOverseas >= 4) continue;

    selected.push(b);
    addedBowlers++;
    if (addedBowlers >= neededBowlers) break;
  }

  if (addedBowlers < 5) {
    explanation.push(`Squad contains only ${addedBowlers} bowling-capable player(s), below preferred target of 5.`);
  } else {
    explanation.push(`Maintained mandatory 5 bowling-capable options in XI.`);
  }

  // 3. Fill remaining slots to reach 11 players
  for (const p of sorted) {
    if (selected.length >= 11) break;
    if (selected.some(s => s.id === p.id)) continue;

    const currentOverseas = selected.filter(s => s.isOverseas).length;
    if (p.isOverseas && currentOverseas >= 4) continue;

    selected.push(p);
  }

  // Fallback if overseas constraint prevented reaching 11
  if (selected.length < 11) {
    for (const p of sorted) {
      if (selected.length >= 11) break;
      if (!selected.some(s => s.id === p.id)) {
        selected.push(p);
      }
    }
  }

  const playingXIIds = new Set(selected.map(s => s.id));
  const bench = squad.filter(p => !playingXIIds.has(p.id));

  const overseasInXI = selected.filter(p => p.isOverseas).length;
  explanation.push(`Selected XI contains ${overseasInXI} overseas player(s) (max 4 allowed).`);

  return {
    playingXI: selected,
    bench,
    explanation,
  };
}
