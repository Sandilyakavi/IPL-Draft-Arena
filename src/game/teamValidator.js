import { defaultRuleEngine } from './ruleEngine.js';

/**
 * Team Validator utility to check franchise eligibility during wheel spins.
 */
export class TeamValidator {
  /**
   * Checks if a franchise has any eligible player remaining for a given user.
   * Core Rule 9: If selected franchise has no eligible player remaining for user, respin wheel.
   * @param {string} teamId - Franchise ID
   * @param {Array} allPlayers - Complete player list
   * @param {Array} userSquad - User's current squad
   * @param {Array} globalDraftedIds - All globally drafted player IDs
   * @returns {boolean} True if franchise has at least 1 draftable player for this user
   */
  hasEligiblePlayer(teamId, allPlayers, userSquad, globalDraftedIds = [], ruleEngine = defaultRuleEngine) {
    const teamPlayers = allPlayers.filter(p => p.teamId === teamId);
    const eligible = ruleEngine.getEligiblePlayers(teamPlayers, userSquad, globalDraftedIds);
    return eligible.length > 0;
  }

  /**
   * Gets all franchises that still have eligible players for the current user.
   * @param {Array} allTeams - All team objects
   * @param {Array} allPlayers - Complete player list
   * @param {Array} userSquad - User squad
   * @param {Array} globalDraftedIds - Global drafted IDs
   * @returns {Array} List of eligible team IDs
   */
  getEligibleTeams(allTeams, allPlayers, userSquad, globalDraftedIds = [], ruleEngine = defaultRuleEngine) {
    return allTeams
      .map(t => t.id)
      .filter(teamId => this.hasEligiblePlayer(teamId, allPlayers, userSquad, globalDraftedIds, ruleEngine));
  }
}

export const defaultTeamValidator = new TeamValidator();
