/**
 * scripts/validate-excel.js
 * =================================================================
 * EXCEL SCHEMA VALIDATOR & DATA PIPELINE GUARD
 * =================================================================
 * Validates the Excel workbook before ingestion to prevent malformed or
 * inconsistent data from corrupting generated JSON files.
 *
 * Usage:
 *   npm run validate:excel
 *   npm run validate:excel -- --season 2027
 * =================================================================
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.join(ROOT, 'IPL players list.xlsx');
const TEAMS_PATH = path.join(ROOT, 'src', 'data', 'teams.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

const REQUIRED_SHEETS = ['All_Players', 'Metadata'];
const REQUIRED_COLUMNS = [
  'player_id',
  'player_name',
  'team_id',
  'role',
  'nationality',
  'is_overseas',
  'is_wicketkeeper',
];

const VALID_ROLES = new Set(['batter', 'wicketkeeper-batter', 'all-rounder', 'bowler']);
const VALID_STATUSES = new Set([
  '2026-current-squad',
  '2026-injured-retained-master',
  'current-squad',
  'injured-retained-master',
  'active',
  'inactive',
  'unavailable',
  'unavailable-injured',
]);

// Helper to parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let season = null;
  const seasonIdx = args.indexOf('--season');
  if (seasonIdx !== -1 && args[seasonIdx + 1]) {
    season = args[seasonIdx + 1];
  }
  return { season };
}

export function validateExcelWorkbook(excelPath = EXCEL_PATH, options = {}) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(excelPath)) {
    return {
      season: options.season || '2026',
      valid: false,
      errors: [{ code: 'MISSING_FILE', message: `Excel file not found at ${excelPath}` }],
      warnings: [],
      summary: { rows: 0, uniquePlayerIds: 0, newPlayers: 0, invalidTeams: 0, invalidRoles: 0, duplicateIds: 0 },
    };
  }

  const workbook = XLSX.readFile(excelPath);
  const sheetNames = workbook.SheetNames;

  // 1. Check Required Sheets
  REQUIRED_SHEETS.forEach(reqSheet => {
    if (!sheetNames.includes(reqSheet)) {
      errors.push({ code: 'MISSING_SHEET', message: `Required sheet "${reqSheet}" is missing from Excel workbook` });
    }
  });

  if (errors.some(e => e.code === 'MISSING_SHEET')) {
    return {
      season: options.season || '2026',
      valid: false,
      errors,
      warnings,
      summary: { rows: 0, uniquePlayerIds: 0, newPlayers: 0, invalidTeams: 0, invalidRoles: 0, duplicateIds: 0 },
    };
  }

  // 2. Load metadata sheet
  const rawMeta = XLSX.utils.sheet_to_json(workbook.Sheets['Metadata'], { defval: '' });
  const metaDict = {};
  rawMeta.forEach(r => { metaDict[String(r.field).trim()] = r.value; });
  const metadataSeason = String(metaDict.season || options.season || '2026');
  const targetSeason = String(options.season || metadataSeason);

  // 3. Load teams
  let validTeamIds = new Set(['csk', 'dc', 'gt', 'kkr', 'lsg', 'mi', 'pbks', 'rr', 'rcb', 'srh']);
  if (fs.existsSync(TEAMS_PATH)) {
    try {
      const tArr = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf8'));
      validTeamIds = new Set(tArr.map(t => t.id));
    } catch (e) {}
  }

  // 4. Inspect All_Players columns
  const rawPlayers = XLSX.utils.sheet_to_json(workbook.Sheets['All_Players'], { defval: '' });
  if (rawPlayers.length === 0) {
    errors.push({ code: 'EMPTY_SHEET', message: 'Sheet "All_Players" contains no rows' });
    return {
      season: targetSeason,
      valid: false,
      errors,
      warnings,
      summary: { rows: 0, uniquePlayerIds: 0, newPlayers: 0, invalidTeams: 0, invalidRoles: 0, duplicateIds: 0 },
    };
  }

  const columns = Object.keys(rawPlayers[0]);
  REQUIRED_COLUMNS.forEach(col => {
    if (!columns.includes(col)) {
      errors.push({ code: 'MISSING_COLUMN', message: `Required column "${col}" is missing from "All_Players"` });
    }
  });

  // Season metadata check
  if (options.season && options.season !== metadataSeason) {
    warnings.push({ code: 'WARN_METADATA_MISMATCH', message: `CLI season (${options.season}) differs from Metadata sheet season (${metadataSeason})` });
  }

  // 5. Player Rows Validation
  const seenIds = new Set();
  const seenNames = new Map();
  let invalidTeamsCount = 0;
  let invalidRolesCount = 0;
  let duplicateIdsCount = 0;

  const toBool = (v) => v === true || v === 1 || v === 'TRUE' || v === 'true' || v === 'FALSE' || v === 'false' || v === 0 || v === false;

  rawPlayers.forEach((row, index) => {
    const rowNum = index + 2;
    const pId = String(row.player_id || '').trim();
    const pName = String(row.player_name || '').trim();
    const teamId = String(row.team_id || '').trim().toLowerCase();
    const role = String(row.role || '').trim();
    const isOverseas = row.is_overseas;
    const isKeeper = row.is_wicketkeeper;

    // Player ID checks
    if (!pId) {
      errors.push({ code: 'MISSING_PLAYER_ID', message: `[Row ${rowNum}] Missing or whitespace-only player_id for name "${pName || 'UNKNOWN'}"` });
    } else if (seenIds.has(pId)) {
      duplicateIdsCount++;
      errors.push({ code: 'DUPLICATE_PLAYER_ID', message: `[Row ${rowNum}] Duplicate player_id: "${pId}"` });
    } else {
      seenIds.add(pId);
    }

    // Player Name checks
    if (!pName) {
      errors.push({ code: 'MISSING_PLAYER_NAME', message: `[Row ${rowNum}] Missing or blank player_name` });
    } else {
      const normName = pName.toLowerCase();
      if (seenNames.has(normName) && seenNames.get(normName) !== pId) {
        warnings.push({ code: 'WARN_DUPLICATE_NORMALIZED_NAME', message: `[Row ${rowNum}] Duplicate normalized name "${pName}" shared by "${seenNames.get(normName)}" and "${pId}"` });
      } else {
        seenNames.set(normName, pId);
      }
    }

    // Team validation
    if (teamId && !validTeamIds.has(teamId)) {
      invalidTeamsCount++;
      errors.push({ code: 'INVALID_TEAM', message: `[Row ${rowNum}] Player "${pName}" references invalid team_id "${teamId}"` });
    }

    // Role validation
    if (role && !VALID_ROLES.has(role)) {
      invalidRolesCount++;
      errors.push({ code: 'INVALID_ROLE', message: `[Row ${rowNum}] Player "${pName}" has invalid role "${role}"` });
    }

    // Boolean validation
    if (!toBool(isOverseas)) {
      warnings.push({ code: 'INVALID_BOOLEAN_VALUE', message: `[Row ${rowNum}] Player "${pName}" has non-standard is_overseas value: "${isOverseas}"` });
    }
    if (!toBool(isKeeper)) {
      warnings.push({ code: 'INVALID_BOOLEAN_VALUE', message: `[Row ${rowNum}] Player "${pName}" has non-standard is_wicketkeeper value: "${isKeeper}"` });
    }

    // Season Status validation
    Object.keys(row).forEach(key => {
      const match = key.match(/^season_(\d{4})_status$/);
      if (match && row[key]) {
        const val = String(row[key]).trim();
        if (!VALID_STATUSES.has(val)) {
          warnings.push({ code: 'INVALID_SEASON_STATUS', message: `[Row ${rowNum}] Player "${pName}" has unrecognised ${key}: "${val}"` });
        }
      }
    });
  });

  const summary = {
    rows: rawPlayers.length,
    uniquePlayerIds: seenIds.size,
    newPlayers: 0,
    invalidTeams: invalidTeamsCount,
    invalidRoles: invalidRolesCount,
    duplicateIds: duplicateIdsCount,
  };

  return {
    season: targetSeason,
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

export function saveValidationReport(report) {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Deterministic JSON output without dynamic timestamps so runs are reproducible
  const reportFileName = `excel-validation-${report.season}.json`;
  const reportPath = path.join(REPORTS_DIR, reportFileName);

  const cleanReport = {
    season: report.season,
    valid: report.valid,
    errors: report.errors,
    warnings: report.warnings,
    summary: report.summary,
  };

  fs.writeFileSync(reportPath, JSON.stringify(cleanReport, null, 2), 'utf8');
  return reportPath;
}

// Execute if run directly from CLI
if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && process.argv[1].endsWith('validate-excel.js'))) {
  const args = parseArgs();
  const report = validateExcelWorkbook(EXCEL_PATH, args);

  console.log('\n' + '═'.repeat(60));
  console.log(`  IPL DRAFT ARENA — EXCEL SCHEMA VALIDATION (${report.season})`);
  console.log('═'.repeat(60));
  console.log(`  Total Rows Inspected:  ${report.summary.rows}`);
  console.log(`  Unique Player IDs:     ${report.summary.uniquePlayerIds}`);
  console.log(`  Errors Found:          ${report.errors.length}`);
  console.log(`  Warnings Found:        ${report.warnings.length}`);

  if (report.warnings.length > 0) {
    console.log(`\n⚠️   WARNINGS (${report.warnings.length}):`);
    report.warnings.forEach((w, i) => console.warn(`  ${i + 1}. [${w.code}] ${w.message}`));
  }

  if (report.errors.length > 0) {
    console.error(`\n❌  VALIDATION FAILED WITH ${report.errors.length} ERRORS:`);
    report.errors.forEach((e, i) => console.error(`  ${i + 1}. [${e.code}] ${e.message}`));
    saveValidationReport(report);
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  } else {
    console.log('\n✅  EXCEL SCHEMA VALIDATION PASSED WITH 0 ERRORS!');
    saveValidationReport(report);
    console.log('═'.repeat(60) + '\n');
    process.exit(0);
  }
}
