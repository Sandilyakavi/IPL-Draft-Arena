/**
 * src/game/pickValueEngine.js
 * =================================================================
 * PLAYER PICK VALUE ENGINE
 * =================================================================
 * Dynamically computes a player's situational tactical value (0–100)
 * specifically for a target squad at the current stage of the draft.
 *
 * Player Rating = How good is this player in isolation?
 * Pick Value    = How valuable is this player for THIS squad right now?
 *
 * Factors evaluated:
 * 1. Player Overall Rating (Base talent anchor)
 * 2. Positional scarcity & squad role needs (Bat, Bowl, AR, WK)
 * 3. Wicketkeeper quota urgency (Critical rule: squad needs at least 1 WK)
 * 4. Bowling depth requirement (Target: at least 5 bowling options)
 * 5. Overseas roster margin (Cap of 4; penalizes over-saturation, boosts domestic)
 * 6. Pace vs Spin bowling balance
 * 7. Remaining draft rounds / squad slots
 * =================================================================
 */

import { getOverallRating, getRoleRating } from './playerRatingEngine.js';
import { DEFAULT_SEASON } from '../config/seasonConfig.js';
import { DRAFT_CONFIG } from '../config/draftConfig.js';

/**
 * Calculates dynamic Pick Value (0–100) for a given player and squad.
 *
 * @param {Object} player - Player object
 * @param {Array} currentSquad - Target squad array
 * @param {Object} rules - Active rules configuration
 * @param {string} season - Season year (default: '2026')
 * @returns {number} Dynamic pick value score (0–100)
 */
export function calculatePickValue(player, currentSquad = [], rules = {}, season = DEFAULT_SEASON) {
  if (!player) return 0;

  const squadSizeTarget = rules.squadSize || DRAFT_CONFIG.SQUAD_SIZE;
  const maxOverseas = rules.maxOverseas || DRAFT_CONFIG.MAX_OVERSEAS_PER_SQUAD;
  const currentCount = currentSquad.length;
  const remainingSlots = Math.max(1, squadSizeTarget - currentCount);

  // 1. Base Talent Anchor (Overall Rating)
  const baseRating = player.rating || getOverallRating(player, season) || 60;

  // 2. Count existing squad disciplines
  const existingBatters = currentSquad.filter(p => p.role === 'batter').length;
  const existingBowlers = currentSquad.filter(p => p.role === 'bowler').length;
  const existingAllRounders = currentSquad.filter(p => p.role === 'all-rounder').length;
  const existingWKs = currentSquad.filter(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter').length;
  const existingBowlingCapable = currentSquad.filter(p => p.role === 'bowler' || p.role === 'all-rounder').length;
  const existingOverseas = currentSquad.filter(p => p.isOverseas).length;

  let valueDelta = 0;

  // 3. Wicketkeeper Urgency
  const isWK = player.isWicketkeeper || player.role === 'wicketkeeper-batter';
  if (isWK) {
    if (existingWKs === 0) {
      // Squad has NO wicketkeeper!
      if (remainingSlots <= 4) {
        valueDelta += 18; // Desperate emergency need
      } else if (remainingSlots <= 7) {
        valueDelta += 12; // High priority
      } else {
        valueDelta += 7; // Good early priority
      }
    } else {
      // Already has a wicketkeeper; second WK is backup, 3rd is redundant
      if (existingWKs === 1) {
        valueDelta -= 4;
      } else {
        valueDelta -= 12;
      }
    }
  } else if (existingWKs === 0 && remainingSlots <= 3) {
    // Non-WK penalty when squad is dangerously low on slots with 0 WKs
    valueDelta -= 6;
  }

  // 4. Bowling Quota Urgency (Need at least 5 bowling options)
  const isBowlingCapable = player.role === 'bowler' || player.role === 'all-rounder';
  const bowlingDeficit = Math.max(0, 5 - existingBowlingCapable);

  if (isBowlingCapable) {
    if (bowlingDeficit > 0) {
      if (remainingSlots <= bowlingDeficit) {
        valueDelta += 16; // Critical need: every remaining slot must bowl
      } else if (remainingSlots <= bowlingDeficit + 2) {
        valueDelta += 10;
      } else {
        valueDelta += 5;
      }
    } else if (existingBowlingCapable >= 7) {
      // Already heavily stacked with bowlers
      valueDelta -= 4;
    }
  }

  // 5. Overseas Roster Margin
  if (player.isOverseas) {
    if (existingOverseas >= maxOverseas) {
      // Cannot legally draft
      return 0;
    } else if (existingOverseas === maxOverseas - 1) {
      // This would consume the very last overseas slot
      // Only high-rated players should be picked for the final international slot
      if (baseRating < 80) {
        valueDelta -= 8;
      } else {
        valueDelta += 2;
      }
    } else if (existingOverseas <= 2 && baseRating >= 85) {
      // Premium international pick
      valueDelta += 5;
    }
  } else {
    // Domestic Indian player premium when overseas slots are tight
    if (existingOverseas >= maxOverseas - 1) {
      valueDelta += 5;
    }
  }

  // 6. Role Scarcity & Balance
  if (player.role === 'all-rounder') {
    // All-rounders provide critical dual-role flexibility
    if (existingAllRounders === 0) {
      valueDelta += 6;
    } else if (existingAllRounders === 1) {
      valueDelta += 3;
    }
  } else if (player.role === 'batter') {
    if (existingBatters < 3 && remainingSlots <= 6) {
      valueDelta += 5;
    } else if (existingBatters >= 5) {
      valueDelta -= 4;
    }
  } else if (player.role === 'bowler') {
    // Pace vs Spin Diversity
    const isSpinner = player.bowlingStyle && (player.bowlingStyle.includes('spin') || player.bowlingStyle.includes('break'));
    const isPacer = player.bowlingStyle && (player.bowlingStyle.includes('fast') || player.bowlingStyle.includes('medium') || player.bowlingStyle.includes('pace'));

    const existingSpinners = currentSquad.filter(p =>
      p.bowlingStyle && (p.bowlingStyle.includes('spin') || p.bowlingStyle.includes('break'))
    ).length;

    const existingPacers = currentSquad.filter(p =>
      p.bowlingStyle && (p.bowlingStyle.includes('fast') || p.bowlingStyle.includes('medium') || p.bowlingStyle.includes('pace'))
    ).length;

    if (isSpinner && existingSpinners === 0 && existingPacers >= 2) {
      valueDelta += 6; // Needs a spinner
    } else if (isPacer && existingPacers === 0 && existingSpinners >= 1) {
      valueDelta += 6; // Needs a frontline pacer
    }
  }

  // Calculate final bounded Pick Value
  const rawPickValue = Math.round(baseRating + valueDelta);
  return Math.min(99, Math.max(15, rawPickValue));
}

/**
 * Returns explainable breakdown reasoning for the calculated pick value.
 */
export function explainPickValue(player, currentSquad = [], rules = {}, season = DEFAULT_SEASON) {
  const pickValue = calculatePickValue(player, currentSquad, rules, season);
  const baseRating = player.rating || getOverallRating(player, season) || 60;
  const reasons = [];

  const isWK = player.isWicketkeeper || player.role === 'wicketkeeper-batter';
  const existingWKs = currentSquad.filter(p => p.isWicketkeeper || p.role === 'wicketkeeper-batter').length;
  const existingBowlingCapable = currentSquad.filter(p => p.role === 'bowler' || p.role === 'all-rounder').length;
  const existingOverseas = currentSquad.filter(p => p.isOverseas).length;

  if (isWK && existingWKs === 0) {
    reasons.push('Fulfills critical specialist wicketkeeper mandate.');
  }
  if ((player.role === 'bowler' || player.role === 'all-rounder') && existingBowlingCapable < 5) {
    reasons.push(`Adds required bowling depth (${existingBowlingCapable + 1}/5 needed).`);
  }
  if (player.role === 'all-rounder') {
    reasons.push('Provides high-value tactical batting and bowling flexibility.');
  }
  if (!player.isOverseas && existingOverseas >= 3) {
    reasons.push('Preserves precious overseas roster spot.');
  }
  if (pickValue > baseRating + 5) {
    reasons.push(`High tactical priority for your squad (+${pickValue - baseRating} boost).`);
  } else if (pickValue < baseRating - 5) {
    reasons.push(`Position already well covered in your squad (${pickValue - baseRating} discount).`);
  }

  return {
    pickValue,
    baseRating,
    difference: pickValue - baseRating,
    reasons,
  };
}

/**
 * Finds the highest Pick Value player among an array of eligible players.
 * Used for auto-pick upon turn timer expiration.
 */
export function getBestAvailablePick(eligiblePlayers = [], currentSquad = [], rules = {}, season = DEFAULT_SEASON) {
  if (!Array.isArray(eligiblePlayers) || eligiblePlayers.length === 0) {
    return null;
  }

  let bestPlayer = null;
  let highestValue = -1;

  for (const player of eligiblePlayers) {
    const val = calculatePickValue(player, currentSquad, rules, season);
    if (val > highestValue) {
      highestValue = val;
      bestPlayer = player;
    }
  }

  return bestPlayer;
}
