import metadata from '../data/metadata.json' with { type: 'json' };

/**
 * seasonConfig.js
 * =================================================================
 * Centralized Season Configuration for IPL Draft Arena.
 * Makes season a first-class data architecture concept.
 * =================================================================
 */

// Supported seasons registry
export const SUPPORTED_SEASONS = {
  '2026': {
    season: '2026',
    name: 'IPL 2026',
    status: 'active',
    hasRealData: true,
    matchesAvailable: true,
  },
  '2027': {
    season: '2027',
    name: 'IPL 2027 (Post-Auction)',
    status: 'upcoming',
    hasRealData: false,
    matchesAvailable: false,
  },
};

// Default / active season derived from metadata.json (defaults to '2026')
export const DEFAULT_SEASON = String(metadata?.season || '2026');

/**
 * Checks if a given season is registered in the system.
 */
export function isSeasonSupported(season) {
  if (!season) return false;
  return Boolean(SUPPORTED_SEASONS[String(season)]);
}

/**
 * Returns configuration metadata for a given season.
 */
export function getSeasonConfig(season = DEFAULT_SEASON) {
  const target = String(season);
  return SUPPORTED_SEASONS[target] || {
    season: target,
    name: `IPL ${target}`,
    status: 'unknown',
    hasRealData: false,
    matchesAvailable: false,
  };
}
