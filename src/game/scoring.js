/**
 * Scoring calculator stub for Phase 1.
 * Ready for future match simulation and XI scoring rules.
 */
export function calculateSquadBalance(squad) {
  if (!squad || !Array.isArray(squad)) {
    return { score: 0, balanceRating: 'Empty' };
  }

  const batters = squad.filter(p => p.role === 'batter').length;
  const keepers = squad.filter(p => p.role === 'wicketkeeper-batter' || p.isWicketkeeper).length;
  const allRounders = squad.filter(p => p.role === 'all-rounder').length;
  const bowlers = squad.filter(p => p.role === 'bowler').length;

  let balanceScore = 0;
  if (batters >= 3) balanceScore += 25;
  if (keepers >= 1) balanceScore += 25;
  if (allRounders >= 2) balanceScore += 25;
  if (bowlers >= 3) balanceScore += 25;

  return {
    score: balanceScore,
    counts: { batters, keepers, allRounders, bowlers },
    hasWicketkeeper: keepers > 0,
    hasMinBowlers: bowlers >= 3,
    hasMinBatters: batters >= 3
  };
}
