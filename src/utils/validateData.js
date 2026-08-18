import { DEFAULT_SEASON } from '../config/seasonConfig.js';

/**
 * validateData.js
 * =====================================================
 * Pure data validation — works in both browser and Node.
 * Season-aware validation suite supporting multi-season data.
 * =====================================================
 */

const VALID_ROLES = new Set(['batter', 'wicketkeeper-batter', 'all-rounder', 'bowler']);

const VALID_SEASON_STATUSES = new Set([
  '2026-current-squad',
  '2026-injured-retained-master',
  'current-squad',
  'injured-retained-master',
  'active',
  'inactive',
  'unavailable',
  'unavailable-injured',
]);

const VALID_RATING_STATUSES = new Set(['verified', 'limited-data', 'unrated', 'insufficient-data']);
const VALID_CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low', 'insufficient']);

export function runValidation(teamsData, playersData, metadataData, ratingsData = null, targetSeason = DEFAULT_SEASON) {
  const errors = [];
  const warnings = [];
  const sStr = String(targetSeason);

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
  const nameToTeam = new Map();

  playersData.forEach((player, index) => {
    const tag = player.name ? `"${player.name}"` : `index ${index}`;

    if (!player.name || typeof player.name !== 'string' || player.name.trim() === '') {
      errors.push(`Empty or invalid player name at index ${index}`);
    }

    if (!player.id || typeof player.id !== 'string') {
      errors.push(`Invalid ID for player ${tag}`);
    } else if (seenIds.has(player.id)) {
      errors.push(`Duplicate player ID: "${player.id}"`);
    } else {
      seenIds.add(player.id);
    }

    if (player.name) {
      const lower = player.name.toLowerCase().trim();
      if (seenNames.has(lower)) {
        errors.push(`Duplicate player name: "${player.name}"`);
      } else {
        seenNames.add(lower);
      }
    }

    const effectiveTeam = (player.seasonTeams && player.seasonTeams[sStr]) || player.teamId;
    if (!effectiveTeam || !validTeamIds.has(effectiveTeam)) {
      errors.push(`Player ${tag} references invalid teamId: "${effectiveTeam}"`);
    }

    if (player.name && effectiveTeam) {
      if (nameToTeam.has(player.name)) {
        const prev = nameToTeam.get(player.name);
        if (prev !== effectiveTeam) {
          errors.push(`Player "${player.name}" appears in both "${prev}" and "${effectiveTeam}"`);
        }
      } else {
        nameToTeam.set(player.name, effectiveTeam);
      }
    }

    if (!VALID_ROLES.has(player.role)) {
      errors.push(`Player ${tag} has invalid role: "${player.role}"`);
    }

    if (!player.nationality || typeof player.nationality !== 'string' || player.nationality.trim() === '') {
      errors.push(`Player ${tag} missing nationality`);
    }

    const expectedOverseas = player.nationality !== 'IND';
    if (typeof player.isOverseas === 'boolean' && player.isOverseas !== expectedOverseas) {
      errors.push(`Player ${tag}: isOverseas (${player.isOverseas}) inconsistent with nationality ("${player.nationality}")`);
    }

    if (typeof player.isWicketkeeper !== 'boolean') {
      errors.push(`Player ${tag}: isWicketkeeper must be a boolean, got ${typeof player.isWicketkeeper}`);
    }

    if (player.role === 'wicketkeeper-batter' && player.isWicketkeeper !== true) {
      errors.push(`Player ${tag}: role is "wicketkeeper-batter" but isWicketkeeper is false`);
    }

    if (!player.seasonStatus || typeof player.seasonStatus !== 'object') {
      errors.push(`Player ${tag}: missing or invalid seasonStatus object`);
    } else {
      const statusForSeason = player.seasonStatus[sStr];
      if (statusForSeason !== undefined && !VALID_SEASON_STATUSES.has(statusForSeason)) {
        warnings.push(`Player ${tag}: unrecognised ${sStr} status "${statusForSeason}" — ensure this is intentional`);
      }
    }
  });

  // ── 4. Ratings dataset validation (if present) ───────────────
  if (ratingsData && Array.isArray(ratingsData)) {
    const seenRatingsKeys = new Set();

    ratingsData.forEach((record, index) => {
      const rTag = `Rating index ${index} (${record.playerId}/${record.season})`;

      if (!record.playerId || !seenIds.has(record.playerId)) {
        errors.push(`${rTag} references invalid or missing playerId: "${record.playerId}"`);
      }

      const ratingKey = `${record.playerId}_${record.season}`;
      if (seenRatingsKeys.has(ratingKey)) {
        errors.push(`Duplicate rating record for ${ratingKey}`);
      } else {
        seenRatingsKeys.add(ratingKey);
      }

      if (record.rating !== null && (typeof record.rating !== 'number' || record.rating < 0 || record.rating > 100)) {
        errors.push(`${rTag} has invalid rating value: ${record.rating} (must be 0-100 or null)`);
      }

      if (!record.season || typeof record.season !== 'string') {
        errors.push(`${rTag} has invalid season: "${record.season}"`);
      }

      if (!VALID_RATING_STATUSES.has(record.ratingStatus)) {
        errors.push(`${rTag} has invalid ratingStatus: "${record.ratingStatus}"`);
      }

      if (!VALID_CONFIDENCE_LEVELS.has(record.confidence)) {
        errors.push(`${rTag} has invalid confidence: "${record.confidence}"`);
      }

      // Verified ratings MUST have source metadata
      if (record.ratingStatus === 'verified') {
        if (!record.source || !record.source.provider || record.source.provider === 'none') {
          errors.push(`${rTag} is marked "verified" but lacks valid source metadata`);
        }
      }

      // Insufficient data players MUST be null rating
      if (record.ratingStatus === 'insufficient-data' && record.rating !== null) {
        errors.push(`${rTag} is marked "insufficient-data" but has a non-null rating: ${record.rating}`);
      }
    });

    // Run historical integrity verification
    const histErrors = validateHistoricalIntegrity(ratingsData);
    errors.push(...histErrors);
  }

  const activePlayersForSeason = playersData.filter(p => {
    const s = p.seasonStatus && p.seasonStatus[sStr];
    return s !== '2026-injured-retained-master' && s !== 'injured-retained-master' && s !== 'unavailable' && s !== 'inactive';
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalPlayers: playersData.length,
    active2026Count: activePlayersForSeason.length,
    activeSeasonCount: activePlayersForSeason.length,
    unavailableCount: playersData.length - activePlayersForSeason.length,
    totalTeams: teamsData ? teamsData.length : 0,
    season: metadataData ? String(metadataData.season || targetSeason) : sStr,
  };
}

/**
 * Validates historical ratings integrity — ensures past season records (2025, 2026) are preserved.
 */
export function validateHistoricalIntegrity(ratingsData, baselineRatings = null) {
  const errors = [];
  if (!ratingsData || !Array.isArray(ratingsData)) return errors;

  const HISTORICAL_SEASONS = ['2025', '2026'];

  HISTORICAL_SEASONS.forEach(pastSeason => {
    const pastRecords = ratingsData.filter(r => String(r.season) === pastSeason);
    if (pastRecords.length === 0) {
      errors.push(`Historical rating records for season ${pastSeason} are missing!`);
      return;
    }

    if (baselineRatings && Array.isArray(baselineRatings)) {
      const basePast = baselineRatings.filter(r => String(r.season) === pastSeason);
      if (pastRecords.length !== basePast.length) {
        errors.push(`Historical ratings count mismatch for ${pastSeason}: expected ${basePast.length}, found ${pastRecords.length}`);
      }

      basePast.forEach(base => {
        const found = pastRecords.find(r => r.playerId === base.playerId);
        if (!found) {
          errors.push(`Historical rating entry for player "${base.playerId}" (${pastSeason}) has been removed!`);
        } else if (found.rating !== base.rating) {
          errors.push(`Historical rating value for player "${base.playerId}" (${pastSeason}) mutated: was ${base.rating}, now ${found.rating}!`);
        }
      });
    }
  });

  return errors;
}
