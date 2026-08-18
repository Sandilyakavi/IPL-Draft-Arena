/**
 * scripts/validate.js — Node CLI validation runner
 * Reads JSON data files and runs full validation suite for a target season.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runValidation } from '../src/utils/validateData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '../src/data');

// Parse --season argument if passed, else default to metadata.season
function parseSeasonArg() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--season');
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

try {
  const teams    = JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8'));
  const players  = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(path.join(DATA, 'metadata.json'), 'utf8'));
  const ratings  = JSON.parse(fs.readFileSync(path.join(DATA, 'playerRatings.json'), 'utf8'));

  const targetSeason = parseSeasonArg() || String(metadata.season || '2026');

  console.log('═'.repeat(50));
  console.log('  IPL Draft Arena — Data Validation Suite');
  console.log('═'.repeat(50));
  console.log(`  Season:          ${targetSeason}`);
  console.log(`  Source:          ${metadata.source}`);
  console.log(`  Last Verified:   ${metadata.lastVerified}`);
  console.log(`  Total Teams:     ${teams.length}`);
  console.log(`  Master Players:  ${players.length}`);
  console.log(`  Ratings Records: ${ratings.length}`);

  const result = runValidation(teams, players, metadata, ratings, targetSeason);
  console.log(`  ${targetSeason} Eligible:   ${result.activeSeasonCount}`);
  console.log(`  ${targetSeason} Unavail:    ${result.unavailableCount}`);

  if (result.warnings.length > 0) {
    console.log(`\n⚠️   ${result.warnings.length} WARNINGS:`);
    result.warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
  }

  if (result.isValid) {
    console.log('\n✅  DATA VALIDATION PASSED WITH 0 ERRORS!\n');
    process.exit(0);
  } else {
    console.error(`\n❌  DATA VALIDATION FAILED WITH ${result.errors.length} ERRORS:`);
    result.errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    process.exit(1);
  }
} catch (err) {
  console.error('Failed to run validation:', err.message);
  process.exit(1);
}
