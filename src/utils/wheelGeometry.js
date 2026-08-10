/**
 * wheelGeometry.js
 * =====================================================
 * Single Source of Truth for Team Wheel Visual Mapping
 * & Pointer Alignment Geometry.
 * =====================================================
 */

export const WHEEL_TEAMS = [
  'csk',
  'dc',
  'gt',
  'kkr',
  'lsg',
  'mi',
  'pbks',
  'rr',
  'rcb',
  'srh',
];

export const TEAM_ANGLE = 360 / WHEEL_TEAMS.length; // 36 degrees per segment

/**
 * Calculates exact target rotation angle (in degrees) to align the center
 * of the selected franchise segment with the TOP pointer (270deg in SVG space).
 *
 * @param {string} teamId - Target franchise ID
 * @param {number} currentRotation - Current cumulative wheel rotation angle (degrees)
 * @param {number} numFullSpins - Number of full 360-degree spins during animation
 * @returns {number} New cumulative rotation angle
 */
export function getTargetRotation(teamId, currentRotation = 0, numFullSpins = 5) {
  const index = WHEEL_TEAMS.indexOf(teamId?.toLowerCase());
  if (index === -1) {
    throw new Error(`Unknown teamId "${teamId}" for wheel rotation calculation.`);
  }

  // Center angle of segment index in SVG unrotated space (0deg = 3 o'clock)
  const segmentCenter = index * TEAM_ANGLE + TEAM_ANGLE / 2;

  // We want (segmentCenter + rotation) % 360 = 270deg (TOP pointer at 12 o'clock)
  // So rotation_base = (270 - segmentCenter) % 360
  const targetBase = (270 - segmentCenter + 3600) % 360;

  // Normalize current rotation modulo 360
  const currentBase = ((currentRotation % 360) + 360) % 360;

  // Forward clockwise delta to reach targetBase
  let delta = (targetBase - currentBase + 360) % 360;
  if (delta === 0) delta = 360; // Always perform forward spin

  return currentRotation + delta + numFullSpins * 360;
}

/**
 * Given a cumulative rotation angle, calculates which franchise segment
 * is positioned directly under the TOP pointer.
 * Used for automated geometry verification tests.
 *
 * @param {number} rotation - Cumulative rotation angle (degrees)
 * @returns {string} teamId of franchise segment under the top pointer
 */
export function getTeamAtPointer(rotation) {
  // Point on unrotated SVG that is currently under TOP pointer (270deg)
  const pointerAngle = (270 - ((rotation % 360) + 360) % 360 + 360) % 360;
  const index = Math.floor(pointerAngle / TEAM_ANGLE) % WHEEL_TEAMS.length;
  return WHEEL_TEAMS[index];
}
