/**
 * src/config/ratingConfig.js
 * =================================================================
 * PLAYER RATING ENGINE 2.0 CONFIGURATION
 * =================================================================
 * Configurable weights, statistical baselines, normalization thresholds,
 * confidence factors, and discipline formulas for IPL Draft Arena.
 * All formulas remain deterministic and explainable.
 * =================================================================
 */

export const RATING_CONFIG = {
  // Scale
  MIN_RATING: 20,
  MAX_RATING: 99,
  DEFAULT_UNRATED: 55,

  // Confidence / Sample Size Calibration
  CONFIDENCE: {
    HIGH_MATCHES: 12,     // 12+ matches = 100% confidence
    MEDIUM_MATCHES: 6,    // 6-11 matches = 85% confidence
    LOW_MATCHES: 2,       // 2-5 matches = 70% confidence
    MINIMAL_MATCHES: 1,   // 1 match = 55% confidence
    UNRATED_WEIGHT: 0.40, // Blend towards baseline for small samples
  },

  // Discipline Weightings for Batters (sum to 1.0)
  BATTER_WEIGHTS: {
    runsVolume: 0.25,        // Total runs impact (target: 500+ runs)
    average: 0.20,           // Batting average (target: 35+)
    strikeRate: 0.20,        // Strike rate (target: 145+)
    powerHitting: 0.15,      // Boundary percentage / six-hitting capability
    consistency: 0.10,       // Frequency of 30+ scores / low failure rate
    matchImpact: 0.10,       // Match winning / clutch performance index
  },

  // Discipline Weightings for Bowlers (sum to 1.0)
  BOWLER_WEIGHTS: {
    wicketsVolume: 0.28,     // Total wickets (target: 18+ wickets)
    economy: 0.25,           // Economy rate (target: <= 7.5 RPO)
    strikeRate: 0.17,        // Bowling strike rate (target: <= 18 balls/wkt)
    dotBallAbility: 0.12,    // Dot ball percentage / pressure building
    deathBowling: 0.10,      // Death over potency / containment
    matchImpact: 0.08,       // Multi-wicket hauls & clutch overs
  },

  // Discipline Weightings for All-Rounders
  ALL_ROUNDER_WEIGHTS: {
    primarySkill: 0.45,      // Stronger discipline (batting or bowling)
    secondarySkill: 0.35,    // Secondary discipline
    balanceBonus: 0.10,      // Two-skill reliability bonus
    matchImpact: 0.10,       // All-round match turning capability
  },

  // Discipline Weightings for Wicketkeeper-Batters
  WICKETKEEPER_WEIGHTS: {
    battingContribution: 0.75, // Batting performance
    keepingContribution: 0.15, // Dismissals (catches + stumpings)
    reliabilityBonus: 0.10,    // Positional reliability
  },

  // Baseline Calibration Targets (IPL Benchmarks)
  BENCHMARKS: {
    BATTING: {
      ELITE_RUNS: 500,
      SOLID_RUNS: 300,
      ELITE_SR: 155.0,
      PAR_SR: 130.0,
      MIN_SR: 90.0,
      ELITE_AVG: 42.0,
      PAR_AVG: 26.0,
      MIN_AVG: 12.0,
    },
    BOWLING: {
      ELITE_WICKETS: 20,
      SOLID_WICKETS: 12,
      ELITE_ECONOMY: 7.2,
      PAR_ECONOMY: 8.8,
      MAX_ECONOMY: 11.5,
      ELITE_SR: 15.0,
      PAR_SR: 22.0,
      MAX_SR: 36.0,
    },
    FIELDING: {
      ELITE_CATCHES: 10,
      BASELINE_FIELDING: 68,
      ELITE_FIELDING: 92,
    },
  },

  // Category Multipliers for Overall Role Rating
  ROLE_MULTIPLIERS: {
    batter: { batting: 0.85, bowling: 0.00, fielding: 0.15 },
    bowler: { batting: 0.05, bowling: 0.80, fielding: 0.15 },
    'all-rounder': { batting: 0.45, bowling: 0.45, fielding: 0.10 },
    'wicketkeeper-batter': { batting: 0.70, bowling: 0.00, fielding: 0.30 }, // Fielding includes keeping
  },
};
