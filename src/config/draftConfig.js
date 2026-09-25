/**
 * src/config/draftConfig.js
 * =================================================================
 * MULTIPLAYER & DRAFT CONFIGURATION
 * =================================================================
 * Defines player capacity limits (2–4 players), turn timers, pick value
 * weights, and draft order algorithms.
 * =================================================================
 */

export const DRAFT_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  DEFAULT_PLAYER_COUNT: 2,

  SQUAD_SIZE: 12,
  PLAYING_XI_SIZE: 11,
  MAX_OVERSEAS_PER_SQUAD: 4,
  MAX_PER_FRANCHISE: 2,

  // Turn timer settings (in seconds)
  TIMERS: {
    DEFAULT: 20,
    OPTIONS: [10, 15, 20, 30],
  },

  // Pick Value calculation weights
  PICK_VALUE_WEIGHTS: {
    OVERALL_RATING: 0.40,      // Baseline player talent
    ROLE_NEED: 0.25,           // Critical squad positional scarcity
    OVERSEAS_MARGIN: 0.15,     // Remaining overseas slots vs requirement
    BOWLING_QUOTA_NEED: 0.10,  // Reaching minimum 5 bowlers
    WK_URGENCY: 0.10,          // Urgency to lock in at least 1 wicketkeeper
  },
};
