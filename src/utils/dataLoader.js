/**
 * dataLoader.js
 * =====================================================
 * Data querying and stats utility.
 * Works with the Master Player Database architecture.
 *
 * Master DB ≠ Draft Pool.
 * Draft pool is always filtered by season + eligibility.
 * =====================================================
 */
import teams from '../data/teams.json' with { type: 'json' };
import players from '../data/players.json' with { type: 'json' };
import rules from '../data/rules.json' with { type: 'json' };
import metadata from '../data/metadata.json' with { type: 'json' };
import { runValidation } from './validateData.js';

// ──────────────────────────────────────────────────────
// SEASON AVAILABILITY HELPERS
// ──────────────────────────────────────────────────────

const UNAVAILABLE_STATUSES = new Set([
  '2026-injured-retained-master',
  'unavailable',
  'unavailable-injured',
  'inactive',
]);

/**
 * Returns true if a player is eligible for the draft in the given season.
 * A player in the MASTER DATABASE may exist but be ineligible for a specific season.
 */
export function isPlayerEligible(player, season = '2026') {
  const status = player.seasonStatus && player.seasonStatus[season];
  if (status === undefined) return true; // no explicit status → eligible by default
  return !UNAVAILABLE_STATUSES.has(status);
}

// ──────────────────────────────────────────────────────
// METADATA
// ──────────────────────────────────────────────────────
export function getMetadata() {
  return metadata;
}

// ──────────────────────────────────────────────────────
// TEAMS
// ──────────────────────────────────────────────────────
export function getAllTeams() {
  return teams;
}

export function getTeamById(teamId) {
  return teams.find(t => t.id === teamId) || null;
}

// ──────────────────────────────────────────────────────
// PLAYERS — MASTER DATABASE (all records, including unavailable)
// ──────────────────────────────────────────────────────
export function getAllPlayers() {
  return players;
}

export function getPlayerById(playerId) {
  return players.find(p => p.id === playerId) || null;
}

export function getPlayersByTeam(teamId) {
  return players.filter(p => p.teamId === teamId);
}

// ──────────────────────────────────────────────────────
// DRAFT POOL — Season-filtered eligible players only
// ──────────────────────────────────────────────────────

/**
 * Returns the draft-eligible player pool for the given season.
 * This is the set of players that will appear in the IPL Draft Arena game.
 * Injured / unavailable players are EXCLUDED from the pool
 * but remain in the master database.
 */
export function getDraftPool(season = '2026') {
  return players.filter(p => isPlayerEligible(p, season));
}

/**
 * Returns draft-eligible players for a specific team in a given season.
 */
export function getDraftPoolByTeam(teamId, season = '2026') {
  return getDraftPool(season).filter(p => p.teamId === teamId);
}

// ──────────────────────────────────────────────────────
// RULES
// ──────────────────────────────────────────────────────
export function getDefaultRules() {
  return rules;
}

// ──────────────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────────────

/**
 * Per-team stats including both master count and eligible count.
 */
export function getTeamStats(teamId, season = '2026') {
  const allTeamPlayers = getPlayersByTeam(teamId);
  const eligiblePlayers = allTeamPlayers.filter(p => isPlayerEligible(p, season));

  const roles = (pool) => ({
    batter:               pool.filter(p => p.role === 'batter').length,
    'wicketkeeper-batter': pool.filter(p => p.role === 'wicketkeeper-batter').length,
    'all-rounder':        pool.filter(p => p.role === 'all-rounder').length,
    bowler:               pool.filter(p => p.role === 'bowler').length,
  });

  return {
    teamId,
    masterCount: allTeamPlayers.length,
    eligibleCount: eligiblePlayers.length,
    unavailableCount: allTeamPlayers.length - eligiblePlayers.length,
    unavailablePlayers: allTeamPlayers.filter(p => !isPlayerEligible(p, season)).map(p => ({
      id: p.id, name: p.name, status: p.seasonStatus?.[season] || 'unknown'
    })),
    indianCount:      eligiblePlayers.filter(p => !p.isOverseas).length,
    overseasCount:    eligiblePlayers.filter(p => p.isOverseas).length,
    wicketkeepers:    eligiblePlayers.filter(p => p.isWicketkeeper).length,
    rolesCount:       roles(eligiblePlayers),
  };
}

/**
 * Overall dataset summary used by the DebugDashboard.
 */
export function getOverallSummary(season = '2026') {
  const pool = getDraftPool(season);
  const masterAll = getAllPlayers();

  const teamSummaries = teams.map(t => ({
    ...t,
    stats: getTeamStats(t.id, season),
  }));

  const validationResult = runValidation(teams, masterAll, metadata);

  return {
    metadata,
    totalTeams: teams.length,
    totalMasterPlayers: masterAll.length,
    totalEligiblePlayers: pool.length,
    totalUnavailablePlayers: masterAll.length - pool.length,
    indianPlayers:   pool.filter(p => !p.isOverseas).length,
    overseasPlayers: pool.filter(p => p.isOverseas).length,
    wicketkeepers:   pool.filter(p => p.isWicketkeeper).length,
    teamSummaries,
    validationResult,
    season,
  };
}
