/**
 * validateData.js
 * =====================================================
 * Pure data validation — works in both browser and Node.
 * Updated for the Master Player Database architecture
 * with seasonStatus and draft eligibility separation.
 * =====================================================
 */

const VALID_ROLES = new Set(['batter', 'wicketkeeper-batter', 'all-rounder', 'bowler']);

const VALID_SEASON_STATUSES = new Set([
  '2026-current-squad',
  '2026-injured-retained-master',
  'active',
  'inactive',
  'unavailable',
  'unavailable-injured',
]);

export function runValidation(teamsData, playersData, metadataData) {
  const errors = [];
  const warnings = [];

  // ── 1. Exactly 10 franchises ──────────────────────────────────
  if (!Array.isArray(teamsData)) {
    errors.push('teams.json is not an array');
  } else if (teamsData.length !== 10) {
    errors.push(`Expected exactly 10 teams, found ${teamsData.length}`);
  }

  const validTeamIds = new Set((teamsData || []).map(t => t.id));

  // ── 2. Teams data structure ───────────────────────────────────
  (teamsData || []).forEach(team => {
    if (!team.id || typeof team.id !== 'string') errors.push(`Team missing valid id: ${JSON.stringify(team)}`);
    if (!team.name) errors.push(`Team ${team.id} missing name`);
    if (!team.shortName) errors.push(`Team ${team.id} missing shortName`);
    if (!team.primaryColor) errors.push(`Team ${team.id} missing primaryColor`);
  });

  // ── 3. Players array ─────────────────────────────────────────
  if (!Array.isArray(playersData)) {
    errors.push('players.json is not an array');
    return { isValid: false, errors, warnings, totalPlayers: 0, totalTeams: 0 };
  }

  const seenIds = new Set();
  const seenNames = new Set();
  const nameToTeam = new Map(); // player name → first teamId seen

  playersData.forEach((player, index) => {
    const tag = player.name ? `"${player.name}"` : `index ${index}`;

    // ── No empty names ───────────────────────────────────────
    if (!player.name || typeof player.name !== 'string' || player.name.trim() === '') {
      errors.push(`Empty or invalid player name at index ${index}`);
    }

    // ── Unique player IDs ────────────────────────────────────
    if (!player.id || typeof player.id !== 'string') {
      errors.push(`Invalid ID for player ${tag}`);
    } else if (seenIds.has(player.id)) {
      errors.push(`Duplicate player ID: "${player.id}"`);
    } else {
      seenIds.add(player.id);
    }

    // ── Unique player names ──────────────────────────────────
    if (player.name) {
      const lower = player.name.toLowerCase().trim();
      if (seenNames.has(lower)) {
        errors.push(`Duplicate player name: "${player.name}"`);
      } else {
        seenNames.add(lower);
      }
    }

    // ── Valid teamId reference ───────────────────────────────
    if (!player.teamId || !validTeamIds.has(player.teamId)) {
      errors.push(`Player ${tag} references invalid teamId: "${player.teamId}"`);
    }

    // ── No player assigned to multiple franchises ────────────
    if (player.name && player.teamId) {
      if (nameToTeam.has(player.name)) {
        const prev = nameToTeam.get(player.name);
        if (prev !== player.teamId) {
          errors.push(`Player "${player.name}" appears in both "${prev}" and "${player.teamId}"`);
        }
      } else {
        nameToTeam.set(player.name, player.teamId);
      }
    }

    // ── Valid role enum ──────────────────────────────────────
    if (!VALID_ROLES.has(player.role)) {
      errors.push(`Player ${tag} has invalid role: "${player.role}"`);
    }

    // ── Valid nationality ────────────────────────────────────
    if (!player.nationality || typeof player.nationality !== 'string' || player.nationality.trim() === '') {
      errors.push(`Player ${tag} missing nationality`);
    }

    // ── isOverseas consistency ───────────────────────────────
    const expectedOverseas = player.nationality !== 'IND';
    if (typeof player.isOverseas === 'boolean' && player.isOverseas !== expectedOverseas) {
      errors.push(`Player ${tag}: isOverseas (${player.isOverseas}) inconsistent with nationality ("${player.nationality}")`);
    }

    // ── isWicketkeeper boolean ───────────────────────────────
    if (typeof player.isWicketkeeper !== 'boolean') {
      errors.push(`Player ${tag}: isWicketkeeper must be a boolean, got ${typeof player.isWicketkeeper}`);
    }

    // Wicketkeeper role consistency
    if (player.role === 'wicketkeeper-batter' && player.isWicketkeeper !== true) {
      errors.push(`Player ${tag}: role is "wicketkeeper-batter" but isWicketkeeper is false`);
    }

    // ── seasonStatus field presence & validity ───────────────
    if (!player.seasonStatus || typeof player.seasonStatus !== 'object') {
      errors.push(`Player ${tag}: missing or invalid seasonStatus object`);
    } else {
      const s2026 = player.seasonStatus['2026'];
      if (s2026 !== undefined && !VALID_SEASON_STATUSES.has(s2026)) {
        warnings.push(`Player ${tag}: unrecognised 2026 status "${s2026}" — ensure this is intentional`);
      }
    }

    // ── source field ─────────────────────────────────────────
    if (player.source !== 'official-ipl') {
      warnings.push(`Player ${tag}: source field is not "official-ipl" — got "${player.source}"`);
    }
  });

  // ── 4. Master-player integrity: ensure no accidental deletion
  //      of a player that exists in teams but has no player record
  //      (light check — only verifiable if we have an expected list)
  if (teamsData.length === 10 && playersData.length < 240) {
    warnings.push(`Low player count: ${playersData.length}. Ensure no master players were accidentally removed.`);
  }

  const active2026 = playersData.filter(p => {
    const s = p.seasonStatus && p.seasonStatus['2026'];
    return s !== '2026-injured-retained-master' && s !== 'unavailable' && s !== 'inactive';
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalPlayers: playersData.length,
    active2026Count: active2026.length,
    unavailableCount: playersData.length - active2026.length,
    totalTeams: teamsData ? teamsData.length : 0,
    season: metadataData ? metadataData.season : null,
  };
}
