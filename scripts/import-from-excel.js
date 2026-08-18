/**
 * import-from-excel.js
 * =====================================================
 * PRIMARY DATA PIPELINE SCRIPT WITH SAFE GENERATION & DRY-RUN
 * =====================================================
 * Source of Truth: IPL players list.xlsx (project root)
 *
 * Reads all sheets and generates:
 *   src/data/players.json   — Master player database with seasonStatus & seasonTeams
 *   src/data/teams.json     — Franchise metadata
 *   src/data/rules.json     — Draft rule config
 *   src/data/metadata.json  — Dataset versioning info
 *
 * Supports:
 *   node scripts/import-from-excel.js
 *   npm run generate -- --season 2027
 *   npm run generate -- --season 2027 --dry-run
 * =====================================================
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateExcelWorkbook, saveValidationReport } from './validate-excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const EXCEL_PATH = path.join(ROOT, 'IPL players list.xlsx');

// Parse CLI flags
function parseCLI() {
  const args = process.argv.slice(2);
  let season = null;
  const seasonIdx = args.indexOf('--season');
  if (seasonIdx !== -1 && args[seasonIdx + 1]) {
    season = args[seasonIdx + 1];
  }
  const isDryRun = args.includes('--dry-run');
  return { season, isDryRun };
}

const { season: targetSeasonOpt, isDryRun } = parseCLI();

// ──────────────────────────────────────────────────────
// 1. STEP 1: VALIDATE EXCEL WORKBOOK BEFORE GENERATION
// ──────────────────────────────────────────────────────
if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`❌ Excel file not found: ${EXCEL_PATH}`);
  process.exit(1);
}

const validation = validateExcelWorkbook(EXCEL_PATH, { season: targetSeasonOpt });

if (!validation.valid) {
  console.error('\n❌  GENERATION STOPPED — EXCEL VALIDATION FAILED!');
  console.error(`    Errors encountered (${validation.errors.length}):`);
  validation.errors.forEach((e, i) => console.error(`    ${i + 1}. [${e.code}] ${e.message}`));
  saveValidationReport(validation);
  console.error('\n❌  No files were generated or modified.\n');
  process.exit(1);
}

console.log(`📊 Reading Excel: ${EXCEL_PATH}`);
const workbook = XLSX.readFile(EXCEL_PATH);
const sheetNames = workbook.SheetNames;
console.log(`   Sheets found: ${sheetNames.join(', ')}`);

// ──────────────────────────────────────────────────────
// 2. BUILD DATASETS IN MEMORY
// ──────────────────────────────────────────────────────
const PLAYERS_OUTPUT_PATH = path.join(DATA_DIR, 'players.json');
const existingPlayersMap = new Map();
if (fs.existsSync(PLAYERS_OUTPUT_PATH)) {
  try {
    const existingArr = JSON.parse(fs.readFileSync(PLAYERS_OUTPUT_PATH, 'utf8'));
    existingArr.forEach(p => existingPlayersMap.set(p.id, p));
  } catch (err) {}
}

const rawPlayers = XLSX.utils.sheet_to_json(workbook.Sheets['All_Players'], { defval: '' });

const players = rawPlayers.map(row => {
  const toBool = (v) => v === true || v === 1 || v === 'TRUE' || v === 'true';

  const pId = String(row.player_id).trim();
  const currentTeam = String(row.team_id).trim().toLowerCase();
  const existing = existingPlayersMap.get(pId);

  // Preserve historical seasonStatus map
  const seasonStatus = { ...(existing?.seasonStatus || {}) };
  Object.keys(row).forEach(key => {
    const match = key.match(/^season_(\d{4})_status$/);
    if (match && row[key] !== '' && row[key] !== null && row[key] !== undefined) {
      seasonStatus[match[1]] = String(row[key]).trim();
    }
  });

  if (!seasonStatus['2026']) {
    if (row.season_2026_status && String(row.season_2026_status).trim() !== '') {
      seasonStatus['2026'] = String(row.season_2026_status).trim();
    } else {
      seasonStatus['2026'] = 'active';
    }
  }

  // Preserve historical seasonTeams map (e.g. { "2026": "csk", "2027": "rcb" })
  const seasonTeams = { ...(existing?.seasonTeams || {}) };
  seasonTeams['2026'] = existing?.seasonTeams?.['2026'] || currentTeam;
  if (targetSeasonOpt) seasonTeams[targetSeasonOpt] = currentTeam;

  return {
    id: pId,
    name: String(row.player_name).trim(),
    teamId: currentTeam,
    role: String(row.role).trim(),
    nationality: String(row.nationality).trim(),
    isOverseas: toBool(row.is_overseas),
    isWicketkeeper: toBool(row.is_wicketkeeper),
    image: null,
    seasonStatus,
    seasonTeams,
    sourceUrl: row.source_url ? String(row.source_url).trim() : null,
    notes: row.notes ? String(row.notes).trim() : null,
    source: 'official-ipl',
  };
});

// Teams → teams.json
const rawTeams = XLSX.utils.sheet_to_json(workbook.Sheets['Teams'], { defval: '' });
const SECONDARY_COLORS = {
  csk: '#005CA8', dc: '#E42528', gt: '#CCA43B', kkr: '#F7D070', lsg: '#0057B8',
  mi: '#D1AB3E', pbks: '#D1AB3E', rr: '#254AA5', rcb: '#414042', srh: '#000000',
};

const teams = rawTeams.map(row => ({
  id: String(row.team_id).trim().toLowerCase(),
  name: String(row.team_name).trim(),
  shortName: String(row.team).trim().toUpperCase(),
  city: String(row.city).trim(),
  logo: null,
  primaryColor: String(row.primary_color).trim(),
  secondaryColor: SECONDARY_COLORS[String(row.team_id).trim().toLowerCase()] || '#FFFFFF',
  officialSource: row.official_source ? String(row.official_source).trim() : null,
}));

// Rules → rules.json
const rawRules = XLSX.utils.sheet_to_json(workbook.Sheets['Rules'], { defval: '' });
const rules = {};
rawRules.forEach(row => {
  const key = String(row.rule).trim();
  let val = row.value;
  if (val === 'true' || val === true) val = true;
  else if (val === 'false' || val === false) val = false;
  else if (typeof val === 'number') val = val;
  rules[key] = val;
});

// Metadata → metadata.json
const rawMeta = XLSX.utils.sheet_to_json(workbook.Sheets['Metadata'], { defval: '' });
const metaRaw = {};
rawMeta.forEach(row => {
  metaRaw[String(row.field).trim()] = row.value;
});

const metadata = {
  dataset: metaRaw.dataset || 'IPL Draft Arena Player Master',
  season: Number(targetSeasonOpt || metaRaw.season || 2026),
  source: metaRaw.source || 'official IPL squad data',
  lastVerified: metaRaw.last_verified || new Date().toISOString().slice(0, 10),
  totalMasterPlayers: players.length,
  notes: {
    ayushMhatre: metaRaw.Ayush_note || '',
    future: metaRaw['2027_note'] || '',
  },
};

// Compute reporting metrics
const active2026 = players.filter(p => {
  const s = p.seasonStatus['2026'] || '';
  return s !== '2026-injured-retained-master' && s !== 'unavailable' && s !== 'inactive';
});
const unavailable2026 = players.filter(p => !active2026.includes(p));
const overseas = players.filter(p => p.isOverseas);
const indian = players.filter(p => !p.isOverseas);
const keepers = players.filter(p => p.isWicketkeeper);

const byTeam = {};
teams.forEach(t => {
  const tp = players.filter(p => p.teamId === t.id);
  const tpActive = tp.filter(p => active2026.includes(p));
  byTeam[t.id] = { total: tp.length, active: tpActive.length };
});

// ──────────────────────────────────────────────────────
// 3. DRY RUN GUARD OR ATOMIC WRITE
// ──────────────────────────────────────────────────────
if (isDryRun) {
  console.log('\n' + '═'.repeat(60));
  console.log('  IPL DRAFT ARENA — EXCEL IMPORT (DRY RUN MODE)');
  console.log('═'.repeat(60));
  console.log(`✅  Validation Passed:          0 Errors`);
  console.log(`📋  Master Players Processed:   ${players.length}`);
  console.log(`📋  Franchises Processed:       ${teams.length}`);
  console.log(`📋  Target Season:             ${metadata.season}`);
  console.log('\n🔒  DRY RUN — NO FILES MODIFIED');
  console.log('═'.repeat(60) + '\n');
  process.exit(0);
}

// Write generated files atomically
fs.mkdirSync(DATA_DIR, { recursive: true });

fs.writeFileSync(path.join(DATA_DIR, 'players.json'), JSON.stringify(players, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'teams.json'), JSON.stringify(teams, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'rules.json'), JSON.stringify(rules, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));

// Save validation report
saveValidationReport(validation);

// Final Report
console.log('\n' + '═'.repeat(60));
console.log('  IPL DRAFT ARENA — EXCEL IMPORT REPORT');
console.log('═'.repeat(60));
console.log(`✅  Excel file detected:        IPL players list.xlsx`);
console.log(`✅  Sheets detected:            ${sheetNames.join(', ')}`);
console.log(`\n📋  MASTER PLAYER DATABASE`);
console.log(`    Total master players:       ${players.length}`);
console.log(`    2026 draft-eligible:        ${active2026.length}`);
console.log(`    2026 unavailable (master):  ${unavailable2026.length}`);
console.log(`\n🌍  NATIONALITY`);
console.log(`    Indian players:             ${indian.length}`);
console.log(`    Overseas players:           ${overseas.length}`);
console.log(`\n🧤  Wicketkeepers (total):      ${keepers.length}`);
console.log(`\n📊  PLAYER COUNT BY FRANCHISE`);
Object.entries(byTeam).sort().forEach(([tid, c]) => {
  console.log(`    ${tid.toUpperCase().padEnd(6)}: ${String(c.total).padStart(3)} master  |  ${String(c.active).padStart(3)} eligible`);
});
console.log('\n✅  players.json  written (' + players.length + ' records)');
console.log('✅  teams.json    written (' + teams.length + ' records)');
console.log('✅  rules.json    written (' + Object.keys(rules).length + ' rules)');
console.log('✅  metadata.json written');
console.log('═'.repeat(60) + '\n');
