import { getDefaultRules, getAllTeams, getDraftPool } from '../utils/dataLoader.js';
import { DEFAULT_SEASON } from '../config/seasonConfig.js';

const defaultRules = getDefaultRules();
const teams = getAllTeams();

/**
 * Rule Engine for IPL Draft Arena.
 * Pure validation functions enforcing all core constraints.
 */

/**
 * Extension point for custom rules.
 * Default implementation returns valid.
 */
export function evaluateCustomRules(player, context = {}) {
  return {
    valid: true,
    reason: null,
  };
}

/**
 * Returns number of players from a specific team in a squad.
 */
export function getTeamPlayerCount(teamId, squad = []) {
  if (!teamId || !Array.isArray(squad)) return 0;
  return squad.filter(p => p.teamId === teamId).length;
}

/**
 * Returns number of overseas players in a squad.
 */
export function getOverseasCount(squad = []) {
  if (!Array.isArray(squad)) return 0;
  return squad.filter(p => p.isOverseas).length;
}

/**
 * Checks if a player ID has already been selected globally.
 */
export function isPlayerAlreadySelected(playerId, gameState) {
  if (!playerId || !gameState) return false;
  const selectedIds = gameState.selectedPlayerIds || [];
  return selectedIds.includes(playerId);
}

/**
 * Validates whether a player can be selected by a user given the current game state and rules.
 * @returns {Object} { isValid: boolean, reason: string | null }
 */
export function validatePick(player, userSquad = [], gameState = {}, rulesConfig = defaultRules) {
  const activeRules = { ...defaultRules, ...rulesConfig };

  if (!player || !player.id) {
    return { isValid: false, reason: 'Invalid player record.' };
  }

  // 1. Check global uniqueness
  if (activeRules.uniquePlayers && isPlayerAlreadySelected(player.id, gameState)) {
    return { isValid: false, reason: `Player "${player.name}" has already been selected.` };
  }

  // 2. Check squad size limit (max 12 per player)
  if (userSquad.length >= activeRules.squadSize) {
    return { isValid: false, reason: `Squad size limit reached (${activeRules.squadSize} players max).` };
  }

  // 3. Check franchise limit (max 2 per team per user)
  const teamCount = getTeamPlayerCount(player.teamId, userSquad);
  if (teamCount >= activeRules.maxPlayersPerTeam) {
    return { isValid: false, reason: `Maximum ${activeRules.maxPlayersPerTeam} players from franchise "${player.teamId.toUpperCase()}" allowed per user.` };
  }

  // 4. Check overseas limit (max 4 overseas per user)
  if (player.isOverseas) {
    const overseasCount = getOverseasCount(userSquad);
    if (overseasCount >= activeRules.maxOverseas) {
      return { isValid: false, reason: `Maximum ${activeRules.maxOverseas} overseas players allowed per user.` };
    }
  }

  // 5. Evaluate custom rule extension point
  const customResult = evaluateCustomRules(player, { userSquad, gameState, rules: activeRules });
  if (!customResult.valid) {
    return { isValid: false, reason: customResult.reason || 'Custom rule check failed.' };
  }

  return { isValid: true, reason: null };
}

/**
 * Boolean wrapper for validatePick.
 */
export function canSelectPlayer(player, userSquad = [], gameState = {}, rulesConfig = defaultRules) {
  return validatePick(player, userSquad, gameState, rulesConfig).isValid;
}

/**
 * Gets all eligible players from a specific franchise for a user.
 * Uses 2026 draft pool (which already excludes unavailable/injured players like Ayush Mhatre).
 */
export function getEligiblePlayers(teamId, userSquad = [], gameState = {}, rulesConfig = defaultRules, season = DEFAULT_SEASON) {
  const pool = getDraftPool(season);
  const teamPlayers = pool.filter(p => p.teamId === teamId);
  return teamPlayers.filter(p => canSelectPlayer(p, userSquad, gameState, rulesConfig));
}

/**
 * Gets all franchises that still have at least 1 eligible player for the user.
 */
export function getEligibleTeams(userSquad = [], gameState = {}, rulesConfig = defaultRules, season = DEFAULT_SEASON) {
  return teams.filter(team => {
    const eligible = getEligiblePlayers(team.id, userSquad, gameState, rulesConfig, season);
    return eligible.length > 0;
  });
}
