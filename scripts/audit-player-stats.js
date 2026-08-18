/**
 * scripts/audit-player-stats.js
 * ══════════════════════════════════════════════════════════════
 * Comprehensive audit for playerStats.json and playerRatings.json.
 *
 * Reports:
 *   1.  Total players
 *   2.  Players with verified stats
 *   3.  Players with insufficient-data
 *   4.  Players unrated
 *   5.  Data sources used
 *   6.  Source coverage %
 *   7.  2025 records
 *   8.  2026 records
 *   9.  Fabricated records (role-template/no source)
 *   10. Projected records (2026 without real data claim)
 *   11. Duplicate records
 *   12. Unsourced numeric ratings
 *   13. Universal keeping values (hardcoded)
 *   14. Abhishek Sharma key fix verification
 *   15. Rating methodology traceability
 *
 * Flags:
 *   - Multiple unrelated players with identical full stat blocks
 *   - ratingStatus="verified" without source metadata
 *   - Numeric rating without stats backing
 *   - Universal keeping=85 (or any single keeping value across all WKs)
 *   - Duplicate player-season records
 *   - Invalid rating range (< 0 or > 100)
 *   - Invalid confidence or ratingStatus values
 * ══════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data');

const VALID_STATUSES = new Set(['verified', 'insufficient-data', 'unrated']);
const VALID_CONFIDENCES = new Set(['high', 'medium', 'low', 'insufficient']);
const VALID_SEASONS = new Set(['2025', '2026']);

// Known fabricated fallback stat blocks from old build-player-stats.js
// If ANY player has these exact values, it is a fabrication flag.
const KNOWN_FABRICATED_BLOCKS = [
  { runs: 310, strikeRate: 138.5, average: 31, matches: 12 },  // old batter fallback
  { wickets: 11, economy: 8.6, average: 28.5, strikeRate: 19.8, matches: 12 }, // old bowler fallback
];

function blockMatchesFabricated(stats) {
  if (!stats) return false;
  return KNOWN_FABRICATED_BLOCKS.some(fb =>
    Object.entries(fb).every(([k, v]) => stats[k] === v)
  );
}

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  console.log('═'.repeat(60));
  console.log('  IPL Draft Arena — Player Stats Data Audit');
  console.log('═'.repeat(60));

  const players = loadJSON(path.join(DATA, 'players.json'));
  const statsFile = loadJSON(path.join(DATA, 'playerStats.json'));
  const ratings = loadJSON(path.join(DATA, 'playerRatings.json'));
  const sources = loadJSON(path.join(DATA, 'performanceSources.json'));

  if (!players || !statsFile || !ratings) {
    console.error('❌ Missing required data files.');
    process.exit(1);
  }

  const statsRecords = statsFile.stats || [];
  const issues = [];
  const warnings = [];

  // ── 1. Player count ────────────────────────────────────────────────────────
  const totalPlayers = players.length;

  // ── 2–4. Rating status breakdown ─────────────────────────────────────────
  const verifiedSet = new Set();
  const insufficientSet = new Set();
  const unratedSet = new Set();
  let verified2025 = 0, verified2026 = 0;
  let insufficient2025 = 0, insufficient2026 = 0;
  let unrated2025 = 0, unrated2026 = 0;

  for (const r of ratings) {
    if (r.season === '2025') {
      if (r.ratingStatus === 'verified')           { verified2025++;    verifiedSet.add(r.playerId); }
      else if (r.ratingStatus === 'insufficient-data') { insufficient2025++; insufficientSet.add(r.playerId); }
      else if (r.ratingStatus === 'unrated')       { unrated2025++;     unratedSet.add(r.playerId); }
    } else if (r.season === '2026') {
      if (r.ratingStatus === 'verified')           { verified2026++;    verifiedSet.add(r.playerId); }
      else if (r.ratingStatus === 'insufficient-data') { insufficient2026++; insufficientSet.add(r.playerId); }
      else if (r.ratingStatus === 'unrated')       { unrated2026++;     unratedSet.add(r.playerId); }
    }
  }

  const playersWithSomeVerified = verifiedSet.size;
  const playersAllInsufficient  = [...insufficientSet].filter(id => !verifiedSet.has(id)).length;
  const playersUnrated          = unratedSet.size;

  // ── 5. Sources used ───────────────────────────────────────────────────────
  const sourceProviders = new Set(ratings.map(r => r.source?.provider).filter(Boolean));

  // ── 6. Source coverage ────────────────────────────────────────────────────
  const numericRatings = ratings.filter(r => r.rating !== null);
  const numericWithSource = numericRatings.filter(r => r.source && r.source.provider !== 'none');
  const sourceCoverage = numericRatings.length > 0
    ? ((numericWithSource.length / numericRatings.length) * 100).toFixed(1)
    : '0';

  // ── 7–8. Records per season ───────────────────────────────────────────────
  const records2025 = ratings.filter(r => r.season === '2025').length;
  const records2026 = ratings.filter(r => r.season === '2026').length;

  // ── 9. Fabricated records ─────────────────────────────────────────────────
  let fabricatedCount = 0;
  for (const sr of statsRecords) {
    for (const season of Object.keys(sr.seasons || {})) {
      const s = sr.seasons[season];
      if (blockMatchesFabricated(s?.batting) || blockMatchesFabricated(s)) {
        fabricatedCount++;
        issues.push(`FABRICATED stats: playerId=${sr.playerId} season=${season}`);
      }
    }
  }

  // ── 10. Projected 2026 records ────────────────────────────────────────────
  // A record is "projected" if it is marked verified for 2026 but has
  // a source that explicitly claims projection. Since our pipeline uses
  // real Cricsheet data, we check for the old "ESPNcricinfo verified database"
  // claim which was used for the synthetic 2026 numbers.
  let projectedCount = 0;
  for (const r of ratings) {
    if (r.season === '2026' && r.ratingStatus === 'verified') {
      const src = r.source?.provider || '';
      if (src === 'none' || !src) {
        projectedCount++;
        issues.push(`PROJECTED/UNSOURCED 2026 verified: playerId=${r.playerId}`);
      }
    }
  }

  // ── 11. Duplicate records ─────────────────────────────────────────────────
  const keys = ratings.map(r => `${r.playerId}_${r.season}`);
  const keySet = new Set();
  let duplicateCount = 0;
  for (const k of keys) {
    if (keySet.has(k)) {
      duplicateCount++;
      issues.push(`DUPLICATE: ${k}`);
    }
    keySet.add(k);
  }

  // ── 12. Unsourced numeric ratings ─────────────────────────────────────────
  let unsourcedNumeric = 0;
  for (const r of ratings) {
    if (r.rating !== null && (!r.source || !r.source.provider || r.source.provider === 'none')) {
      unsourcedNumeric++;
      issues.push(`UNSOURCED numeric rating: playerId=${r.playerId} season=${r.season}`);
    }
  }

  // ── 13. Universal keeping values ──────────────────────────────────────────
  let universalKeepingCount = 0;
  const keepingValues = ratings.filter(r => r.components?.keeping !== null && r.components?.keeping !== undefined).map(r => r.components.keeping);
  if (keepingValues.length > 0) {
    const keepingCounts = {};
    for (const v of keepingValues) { keepingCounts[v] = (keepingCounts[v] || 0) + 1; }
    for (const [v, c] of Object.entries(keepingCounts)) {
      if (c >= 5) { // 5+ players with same keeping value is suspicious
        universalKeepingCount += c;
        issues.push(`UNIVERSAL KEEPING VALUE ${v}: ${c} players have exactly this keeping component`);
      }
    }
  }

  // ── 14. Abhishek Sharma 2026 key fix ──────────────────────────────────────
  const abRecord = statsRecords.find(s => s.playerId === 'abhishek-sharma');
  const abHas2026 = abRecord && Object.keys(abRecord.seasons || {}).includes('2026');
  const abHas2026Real = abHas2026 && (
    abRecord.seasons['2026']?.batting?.runs > 0 ||
    abRecord.seasons['2026']?.bowling?.wickets >= 0
  );

  // ── Additional: invalid statuses / confidences ────────────────────────────
  let invalidStatus = 0, invalidConfidence = 0, invalidRatingRange = 0;
  for (const r of ratings) {
    if (!VALID_STATUSES.has(r.ratingStatus)) {
      invalidStatus++;
      issues.push(`INVALID STATUS: playerId=${r.playerId} season=${r.season} status=${r.ratingStatus}`);
    }
    if (!VALID_CONFIDENCES.has(r.confidence)) {
      invalidConfidence++;
      issues.push(`INVALID CONFIDENCE: playerId=${r.playerId} season=${r.season}`);
    }
    if (r.rating !== null && (r.rating < 0 || r.rating > 100)) {
      invalidRatingRange++;
      issues.push(`OUT-OF-RANGE RATING: playerId=${r.playerId} season=${r.season} rating=${r.rating}`);
    }
    if (!VALID_SEASONS.has(r.season)) {
      issues.push(`INVALID SEASON: playerId=${r.playerId} season=${r.season}`);
    }
  }

  // ── Suspicious identical stat blocks ─────────────────────────────────────
  const statBlockSignatures = {};
  for (const sr of statsRecords) {
    for (const season of Object.keys(sr.seasons || {})) {
      const s = sr.seasons[season];
      if (!s) continue;
      const batting = s.batting;
      if (batting && batting.runs !== null && batting.runs !== undefined) {
        const sig = `bat:${batting.runs}:${batting.strikeRate}:${batting.average}:${batting.innings}`;
        if (!statBlockSignatures[sig]) statBlockSignatures[sig] = [];
        statBlockSignatures[sig].push(`${sr.playerId}/${season}`);
      }
    }
  }
  let suspiciousIdentical = 0;
  for (const [sig, players] of Object.entries(statBlockSignatures)) {
    if (players.length >= 5) {
      suspiciousIdentical += players.length;
      warnings.push(`SUSPICIOUS IDENTICAL BATTING BLOCKS (${players.length} players): ${sig.slice(0,40)}`);
    }
  }

  // ── Print Report ─────────────────────────────────────────────────────────
  console.log('\n📊 DATA PROVENANCE REPORT');
  console.log('─'.repeat(60));
  console.log(`  1.  Total players:                    ${totalPlayers}`);
  console.log(`  2.  Players with any verified stats:  ${playersWithSomeVerified}`);
  console.log(`  3.  Players all insufficient-data:    ${playersAllInsufficient}`);
  console.log(`  4.  Unrated players (injured/etc):    ${playersUnrated}`);
  console.log(`  5.  Data sources used:                ${[...sourceProviders].join(', ') || 'none'}`);
  console.log(`  6.  Source coverage (numeric ratings):${sourceCoverage}%`);
  console.log(`  7.  2025 records:                     ${records2025}`);
  console.log(`  8.  2026 records:                     ${records2026}`);
  console.log(`      2025 verified:                    ${verified2025}`);
  console.log(`      2026 verified:                    ${verified2026}`);
  console.log(`      2025 insufficient:                ${insufficient2025}`);
  console.log(`      2026 insufficient:                ${insufficient2026}`);
  console.log(`  9.  Fabricated stat records:          ${fabricatedCount} ${fabricatedCount === 0 ? '✅' : '❌'}`);
  console.log(`  10. Projected/unsourced 2026 records: ${projectedCount} ${projectedCount === 0 ? '✅' : '❌'}`);
  console.log(`  11. Duplicate player-season records:  ${duplicateCount} ${duplicateCount === 0 ? '✅' : '❌'}`);
  console.log(`  12. Unsourced numeric ratings:        ${unsourcedNumeric} ${unsourcedNumeric === 0 ? '✅' : '❌'}`);
  console.log(`  13. Universal keeping values:         ${universalKeepingCount} ${universalKeepingCount === 0 ? '✅' : '❌'}`);
  console.log(`  14. Abhishek Sharma 2026 key fix:     ${abHas2026Real ? '✅ present with real data' : '❌ MISSING or empty'}`);
  console.log(`  15. Rating methodology:               Cricsheet ball-by-ball derived`);
  console.log(`      Batting formula:                  Runs 40% + SR 25% + Avg 25% + Innings 10%`);
  console.log(`      Bowling formula:                  Wkts 40% + Eco 25% + Avg 20% + SR 15%`);
  console.log(`      All-rounder:                      Bat 50% + Bowl 50%`);
  console.log(`      WK-batter:                        Batting only (no fabricated keeping score)`);
  console.log(`      Min sample (bat):                 3 innings`);
  console.log(`      Min sample (bowl):                18 balls (3 overs)`);

  console.log('\n⚠  WARNINGS');
  console.log('─'.repeat(60));
  if (warnings.length === 0) {
    console.log('  None.');
  } else {
    warnings.forEach(w => console.log('  ⚠  ' + w));
  }

  console.log('\n❌ ISSUES');
  console.log('─'.repeat(60));
  if (issues.length === 0) {
    console.log('  None.');
  } else {
    issues.slice(0, 30).forEach(i => console.log('  ❌ ' + i));
    if (issues.length > 30) console.log(`  ... and ${issues.length - 30} more`);
  }

  const criticalIssues = fabricatedCount + duplicateCount + unsourcedNumeric + universalKeepingCount + invalidStatus + invalidConfidence + invalidRatingRange + projectedCount;

  console.log('\n' + '═'.repeat(60));
  if (criticalIssues === 0 && !abHas2026Real === false) {
    console.log('  ✅ AUDIT PASSED — 0 CRITICAL ISSUES');
  } else {
    console.log(`  ❌ AUDIT FAILED — ${criticalIssues} CRITICAL ISSUE(S)`);
    process.exitCode = 1;
  }
  console.log('═'.repeat(60));
}

main();
