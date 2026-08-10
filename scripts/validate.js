/**
 * scripts/validate.js — Node CLI validation runner
 * Reads the JSON data files and runs the full validation suite.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runValidation } from '../src/utils/validateData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '../src/data');

try {
  const teams    = JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8'));
  const players  = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(path.join(DATA, 'metadata.json'), 'utf8'));

  console.log('═'.repeat(50));
  console.log('  IPL Draft Arena — Data Validation Suite');
  console.log('═'.repeat(50));
  console.log(`  Season:          ${metadata.season}`);
  console.log(`  Source:          ${metadata.source}`);
  console.log(`  Last Verified:   ${metadata.lastVerified}`);
  console.log(`  Total Teams:     ${teams.length}`);
  console.log(`  Master Players:  ${players.length}`);

  const result = runValidation(teams, players, metadata);
  console.log(`  2026 Eligible:   ${result.active2026Count}`);
  console.log(`  2026 Unavail:    ${result.unavailableCount}`);

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
