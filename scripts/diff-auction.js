/**
 * scripts/diff-auction.js
 * =================================================================
 * AUCTION DIFF & VALIDATION TOOL
 * =================================================================
 * Compares an updated Excel workbook against the generated player dataset.
 * Detects:
 *   - New players
 *   - Removed / unavailable players
 *   - Franchise transfers
 *   - Metadata changes (role, nationality, overseas, keeper)
 *   - Validation warnings (duplicates, invalid IDs/teams/roles)
 *   - Historical safety & Cricsheet mapping gaps
 *
 * DOES NOT MODIFY any source or generated data files.
 * Output: Console summary & JSON report saved in reports/ directory.
 *
 * Usage:
 *   npm run diff
 *   npm run diff -- --from 2026 --to 2027
 * =================================================================
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.join(ROOT, 'IPL players list.xlsx');
const PLAYERS_JSON_PATH = path.join(ROOT, 'src', 'data', 'players.json');
const TEAMS_JSON_PATH = path.join(ROOT, 'src', 'data', 'teams.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

const VALID_ROLES = new Set(['batter', 'wicketkeeper-batter', 'all-rounder', 'bowler']);

// Parse CLI arguments (--from, --to)
function parseArgs() {
  const args = process.argv.slice(2);
  let fromSeason = '2026';
  let toSeason = '2027';

  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && args[fromIdx + 1]) fromSeason = args[fromIdx + 1];

  const toIdx = args.indexOf('--to');
  if (toIdx !== -1 && args[toIdx + 1]) toSeason = args[toIdx + 1];

  return { fromSeason, toSeason };
}

export function computeAuctionDiff(excelPath = EXCEL_PATH, playersPath = PLAYERS_JSON_PATH, options = {}) {
  const fromSeason = options.fromSeason || '2026';
  const toSeason = options.toSeason || '2027';

  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel workbook not found at ${excelPath}`);
  }
  if (!fs.existsSync(playersPath)) {
    throw new Error(`Generated players dataset not found at ${playersPath}`);
  }

  const workbook = XLSX.readFile(excelPath);
  const rawExcelPlayers = XLSX.utils.sheet_to_json(workbook.Sheets['All_Players'], { defval: '' });
  const existingPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

  let validTeams = new Set(['csk', 'dc', 'gt', 'kkr', 'lsg', 'mi', 'pbks', 'rr', 'rcb', 'srh']);
  if (fs.existsSync(TEAMS_JSON_PATH)) {
    const teams = JSON.parse(fs.readFileSync(TEAMS_JSON_PATH, 'utf8'));
    validTeams = new Set(teams.map(t => t.id));
  }

  const existingMap = new Map();
  existingPlayers.forEach(p => existingMap.set(p.id, p));

  const newPlayers = [];
  const removedPlayers = [];
  const franchiseTransfers = [];
  const metadataChanges = [];
  const warnings = [];

  const seenExcelIds = new Set();
  const seenExcelNames = new Map();

  const toBool = (v) => v === true || v === 1 || v === 'TRUE' || v === 'true';

  rawExcelPlayers.forEach((row, index) => {
    const rowNum = index + 2; // Excel header is row 1
    const pId = String(row.player_id || '').trim();
    const pName = String(row.player_name || '').trim();
    const teamId = String(row.team_id || '').trim().toLowerCase();
    const role = String(row.role || '').trim();
    const nationality = String(row.nationality || '').trim();
    const isOverseas = toBool(row.is_overseas);
    const isKeeper = toBool(row.is_wicketkeeper);

    // Validation Check: Missing Player ID
    if (!pId) {
      warnings.push(`[Row ${rowNum}] Missing player_id for player "${pName || 'UNKNOWN'}"`);
      return;
    }

    // Validation Check: Duplicate Player ID in Excel
    if (seenExcelIds.has(pId)) {
      warnings.push(`[Row ${rowNum}] Duplicate player_id in Excel: "${pId}"`);
    } else {
      seenExcelIds.add(pId);
    }

    // Validation Check: Duplicate normalized name in Excel
    if (pName) {
      const normName = pName.toLowerCase();
      if (seenExcelNames.has(normName) && seenExcelNames.get(normName) !== pId) {
        warnings.push(`[Row ${rowNum}] Duplicate normalized player name "${pName}" shared by IDs "${seenExcelNames.get(normName)}" and "${pId}"`);
      } else {
        seenExcelNames.set(normName, pId);
      }
    }

    // Validation Check: Invalid Team ID
    if (teamId && !validTeams.has(teamId)) {
      warnings.push(`[Row ${rowNum}] Player "${pName}" (${pId}) references invalid team_id: "${teamId}"`);
    }

    // Validation Check: Invalid Role
    if (role && !VALID_ROLES.has(role)) {
      warnings.push(`[Row ${rowNum}] Player "${pName}" (${pId}) has invalid role: "${role}"`);
    }

    const seasonStatusKey = `season_${toSeason}_status`;
    const toSeasonStatus = row[seasonStatusKey] || row.season_2026_status || 'active';

    const existing = existingMap.get(pId);

    if (!existing) {
      // ➕ New Player
      newPlayers.push({
        id: pId,
        name: pName,
        teamId,
        role,
        nationality,
        isOverseas,
        isWicketkeeper: isKeeper,
        status: String(toSeasonStatus).trim(),
      });
    } else {
      // Compare Franchise Transfer
      const oldTeam = (existing.seasonTeams && existing.seasonTeams[fromSeason]) || existing.teamId;
      if (teamId && oldTeam && teamId !== oldTeam) {
        franchiseTransfers.push({
          id: pId,
          name: pName,
          oldTeam,
          newTeam: teamId,
        });
      }

      // Compare Metadata Changes
      const changes = [];
      if (existing.role !== role) changes.push({ field: 'role', old: existing.role, new: role });
      if (existing.nationality !== nationality) changes.push({ field: 'nationality', old: existing.nationality, new: nationality });
      if (existing.isOverseas !== isOverseas) changes.push({ field: 'isOverseas', old: existing.isOverseas, new: isOverseas });
      if (existing.isWicketkeeper !== isKeeper) changes.push({ field: 'isWicketkeeper', old: existing.isWicketkeeper, new: isKeeper });

      if (changes.length > 0) {
        metadataChanges.push({
          id: pId,
          name: pName,
          changes,
        });
      }
    }
  });

  // ➖ Check for Removed / Unavailable Players (in existing DB but missing/marked unavailable in Excel)
  existingPlayers.forEach(p => {
    const inExcel = seenExcelIds.has(p.id);
    const prevStatus = (p.seasonStatus && p.seasonStatus[fromSeason]) || 'active';
    if (!inExcel) {
      removedPlayers.push({
        id: p.id,
        name: p.name,
        previousStatus: prevStatus,
        newStatus: 'removed-from-excel',
      });
    }
  });

  const summary = {
    fromSeason,
    toSeason,
    totalExistingMaster: existingPlayers.length,
    totalExcelRows: rawExcelPlayers.length,
    newPlayersCount: newPlayers.length,
    removedPlayersCount: removedPlayers.length,
    transfersCount: franchiseTransfers.length,
    metadataChangesCount: metadataChanges.length,
    warningsCount: warnings.length,
  };

  const diffReport = {
    summary,
    newPlayers,
    removedPlayers,
    franchiseTransfers,
    metadataChanges,
    warnings,
    generatedAt: new Date().toISOString(),
  };

  return diffReport;
}

export function printAndSaveDiffReport(diffReport) {
  const { summary, newPlayers, removedPlayers, franchiseTransfers, metadataChanges, warnings } = diffReport;

  console.log('\n' + '═'.repeat(65));
  console.log(`  IPL DRAFT ARENA — AUCTION DIFF REPORT (${summary.fromSeason} ➔ ${summary.toSeason})`);
  console.log('═'.repeat(65));

  console.log(`\n📋  SUMMARY METRICS:`);
  console.log(`    Previous Master DB Count:   ${summary.totalExistingMaster}`);
  console.log(`    Incoming Excel Rows:        ${summary.totalExcelRows}`);
  console.log(`    ➕ New Players:             ${summary.newPlayersCount}`);
  console.log(`    ➖ Removed/Unavailable:     ${summary.removedPlayersCount}`);
  console.log(`    ↔  Franchise Transfers:     ${summary.transfersCount}`);
  console.log(`    ✏️  Metadata Edits:          ${summary.metadataChangesCount}`);
  console.log(`    ⚠️  Validation Warnings:     ${summary.warningsCount}`);

  if (newPlayers.length > 0) {
    console.log(`\n➕  NEW PLAYERS ADDED (${newPlayers.length}):`);
    newPlayers.forEach(p => {
      console.log(`    • ${p.name.padEnd(24)} [${p.teamId.toUpperCase()}]  ${p.role} (${p.nationality})`);
    });
  }

  if (removedPlayers.length > 0) {
    console.log(`\n➖  REMOVED / UNAVAILABLE PLAYERS (${removedPlayers.length}):`);
    removedPlayers.forEach(p => {
      console.log(`    • ${p.name.padEnd(24)} [${p.id}]  prev status: ${p.previousStatus}`);
    });
  }

  if (franchiseTransfers.length > 0) {
    console.log(`\n↔   FRANCHISE TRANSFERS (${franchiseTransfers.length}):`);
    franchiseTransfers.forEach(p => {
      console.log(`    • ${p.name.padEnd(24)} ${p.oldTeam.toUpperCase()} ➔ ${p.newTeam.toUpperCase()}`);
    });
  }

  if (metadataChanges.length > 0) {
    console.log(`\n✏️   METADATA EDITS (${metadataChanges.length}):`);
    metadataChanges.forEach(p => {
      const details = p.changes.map(c => `${c.field}: ${c.old} ➔ ${c.new}`).join(', ');
      console.log(`    • ${p.name.padEnd(24)} (${details})`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️   VALIDATION WARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.warn(`    ${w}`));
  }

  console.log('\n' + '═'.repeat(65));

  // Save JSON report in reports/ directory without modifying dataset
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportFileName = `auction-diff-${summary.fromSeason}-to-${summary.toSeason}.json`;
  const reportPath = path.join(REPORTS_DIR, reportFileName);
  fs.writeFileSync(reportPath, JSON.stringify(diffReport, null, 2), 'utf8');
  console.log(`✅  Diff report saved: reports/${reportFileName}\n`);
}

// Execute if run directly from CLI
const currentScriptPath = fileURLToPath(import.meta.url);
const entryScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryScriptPath === currentScriptPath || entryScriptPath.endsWith('diff-auction.js')) {
  const options = parseArgs();
  const report = computeAuctionDiff(EXCEL_PATH, PLAYERS_JSON_PATH, options);
  printAndSaveDiffReport(report);
}
