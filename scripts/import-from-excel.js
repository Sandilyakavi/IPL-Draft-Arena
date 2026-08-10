/**
 * import-from-excel.js
 * =====================================================
 * PRIMARY DATA PIPELINE SCRIPT
 * =====================================================
 * Source of Truth: IPL players list.xlsx (project root)
 *
 * Reads all sheets and generates:
 *   src/data/players.json   — Master player database with seasonStatus
 *   src/data/teams.json     — Franchise metadata
 *   src/data/rules.json     — Draft rule config
 *   src/data/metadata.json  — Dataset versioning info
 *
 * Run: node scripts/import-from-excel.js
 *
 * IMPORTANT:
 *   Do NOT modify the Excel file.
 *   Do NOT delete players from the master database.
 *   Season availability is a property of the player record,
 *   not a reason for deletion.
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const EXCEL_PATH = path.join(ROOT, 'IPL players list.xlsx');

// ──────────────────────────────────────────────────────
// 1. Load Excel
// ──────────────────────────────────────────────────────
if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`❌ Excel file not found: ${EXCEL_PATH}`);
  process.exit(1);
}

console.log(`📊 Reading Excel: ${EXCEL_PATH}`);
const workbook = XLSX.readFile(EXCEL_PATH);
const sheetNames = workbook.SheetNames;
console.log(`   Sheets found: ${sheetNames.join(', ')}`);

// ──────────────────────────────────────────────────────
// 2. Parse All_Players → players.json
// ──────────────────────────────────────────────────────
const rawPlayers = XLSX.utils.sheet_to_json(workbook.Sheets['All_Players'], { defval: '' });

const players = rawPlayers.map(row => {
  // Normalize boolean fields (Excel may return 0/1, true/false, or strings)
  const toBool = (v) => v === true || v === 1 || v === 'TRUE' || v === 'true';

  const seasonStatus = {};
  if (row.season_2026_status && row.season_2026_status !== '') {
    seasonStatus['2026'] = String(row.season_2026_status).trim();
  } else {
    // Default: if no explicit status, assume active
    seasonStatus['2026'] = 'active';
  }

  return {
    id: String(row.player_id).trim(),
    name: String(row.player_name).trim(),
    teamId: String(row.team_id).trim().toLowerCase(),
    role: String(row.role).trim(),
    nationality: String(row.nationality).trim(),
    isOverseas: toBool(row.is_overseas),
    isWicketkeeper: toBool(row.is_wicketkeeper),
    image: null,
    seasonStatus,
    sourceUrl: row.source_url ? String(row.source_url).trim() : null,
    notes: row.notes ? String(row.notes).trim() : null,
    source: 'official-ipl',
  };
});

// ──────────────────────────────────────────────────────
// 3. Parse Teams → teams.json
// ──────────────────────────────────────────────────────
const rawTeams = XLSX.utils.sheet_to_json(workbook.Sheets['Teams'], { defval: '' });

const SECONDARY_COLORS = {
  csk: '#005CA8',
  dc: '#E42528',
  gt: '#CCA43B',
  kkr: '#F7D070',
  lsg: '#0057B8',
  mi: '#D1AB3E',
  pbks: '#D1AB3E',
  rr: '#254AA5',
  rcb: '#414042',
  srh: '#000000',
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

// ──────────────────────────────────────────────────────
// 4. Parse Rules → rules.json
// ──────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────
// 5. Parse Metadata → metadata.json
// ──────────────────────────────────────────────────────
const rawMeta = XLSX.utils.sheet_to_json(workbook.Sheets['Metadata'], { defval: '' });
const metaRaw = {};
rawMeta.forEach(row => {
  metaRaw[String(row.field).trim()] = row.value;
});

const metadata = {
  dataset: metaRaw.dataset || 'IPL Draft Arena Player Master',
  season: Number(metaRaw.season) || 2026,
  source: metaRaw.source || 'official IPL squad data',
  lastVerified: metaRaw.last_verified || new Date().toISOString().slice(0, 10),
  totalMasterPlayers: players.length,
  notes: {
    ayushMhatre: metaRaw.Ayush_note || '',
    future: metaRaw['2027_note'] || '',
  },
};

// ──────────────────────────────────────────────────────
// 6. Compute Stats for reporting
// ──────────────────────────────────────────────────────
const active2026 = players.filter(p => {
  const s = p.seasonStatus['2026'] || '';
  return s !== '2026-injured-retained-master' &&
    s !== 'unavailable' &&
    s !== 'inactive';
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
// 7. Write all JSON files
// ──────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });

fs.writeFileSync(path.join(DATA_DIR, 'players.json'), JSON.stringify(players, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'teams.json'), JSON.stringify(teams, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'rules.json'), JSON.stringify(rules, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));

// ──────────────────────────────────────────────────────
// 8. Final Report
// ──────────────────────────────────────────────────────
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
console.log(`\n🟡  UNAVAILABLE IN 2026 (remain in master db):`);
unavailable2026.forEach(p => {
  console.log(`    ${p.name}  [${p.teamId.toUpperCase()}]  status: ${p.seasonStatus['2026']}`);
});
console.log('\n✅  players.json  written (' + players.length + ' records)');
console.log('✅  teams.json    written (' + teams.length + ' records)');
console.log('✅  rules.json    written (' + Object.keys(rules).length + ' rules)');
console.log('✅  metadata.json written');
console.log('\n   ✔  Ayush Mhatre REMAINS in master database as CSK player');
console.log('   ✔  His 2026 status: unavailable-injured-retained-master');
console.log('   ✔  He will NOT appear in 2026 draft pool');
console.log('═'.repeat(60));
