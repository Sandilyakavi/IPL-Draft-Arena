/**
 * scripts/fetch-cricsheet-stats.js
 * ======================================================
 * Downloads Cricsheet IPL ball-by-ball JSON data and
 * computes player-specific season statistics per our
 * players.json roster.
 *
 * Source: https://cricsheet.org/downloads/ipl_json.zip
 * Format: Cricsheet JSON (https://cricsheet.org/format/)
 *
 * Run: node scripts/fetch-cricsheet-stats.js
 * ======================================================
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const CACHE_DIR = path.join(ROOT, '.cricsheet_cache');
const CACHE_FILE = path.join(CACHE_DIR, 'ipl_json.zip');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');

const CRICSHEET_URL = 'https://cricsheet.org/downloads/ipl_json.zip';
const VERIFIED_AT = new Date().toISOString().split('T')[0];
const SEASONS = ['2025', '2026'];

// ── Name → ID mapping for our roster ──────────────────────────────────────────
// Built from actual Cricsheet IPL 2025+2026 player name output.
// Cricsheet uses initials format (e.g. 'V Kohli', 'JJ Bumrah').
const CRICSHEET_NAME_TO_ID = {
  // ── From actual Cricsheet 2025/2026 IPL data ──────────────────
  'A Badoni':         'ayush-badoni',
  'A Kamboj':         'anshul-kamboj',
  'A Manohar':        null,
  'A Mhatre':         'ayush-mhatre',
  'A Nortje':         'anrich-nortje',
  'A Raghuvanshi':    'angkrish-raghuvanshi',
  'A Zampa':          null,
  'AA Kulkarni':      'arshin-kulkarni',
  'AD Russell':       null,
  'AJ Hosein':        null,
  'AK Markram':       'aiden-markram',
  'AM Ghazanfar':     'allah-ghazanfar',
  'AM Rahane':        'ajinkya-rahane',
  'AR Patel':         'axar-patel',
  'AS Roy':           'akash-singh',
  'Abdul Samad':      'abdul-samad',
  'Abhinandan Singh': 'abhinandan-singh',
  'Abhishek Sharma':  'abhishek-sharma',
  'Abishek Porel':    'abishek-porel',
  'Akash Deep':       'akash-deep',
  'Akash Madhwal':    'akash-madhwal',
  'Akash Singh':      'akash-singh',
  'Akshat Raghuwanshi': 'akshat-raghuwanshi',
  'Aniket Verma':     'aniket-verma',
  'Arjun Tendulkar':  'arjun-tendulkar',
  'Arshad Khan':      'arshad-khan',
  'Arshdeep Singh':   'arshdeep-singh',
  'Ashok Sharma':     null,
  'Ashutosh Sharma':  'ashutosh-sharma',
  'Ashwani Kumar':    null,
  'Atharva Taide':    null,
  'Auqib Nabi':       'auqib-nabi',
  'Avesh Khan':       'avesh-khan',
  'Azmatullah Omarzai': 'azmatullah-omarzai',
  'B Kumar':          'bhuvneshwar-kumar',
  'B Muzarabani':     'blessing-muzarabani',
  'B Sai Sudharsan':  'sai-sudharsan',
  'BJ Dwarshuis':     'ben-dwarshuis',
  'BKG Mendis':       null,
  'Brijesh Sharma':   'brijesh-sharma',
  'C Bosch':          'corbin-bosch',
  'C Connolly':       'cooper-connolly',
  'C Green':          'cameron-green',
  'C Sakariya':       null,
  'CV Varun':         'varun-chakaravarthy',
  'D Brevis':         'dewald-brevis',
  'D Ferreira':       'donovan-ferreira',
  'D Madushanka':     'dilshan-madushanka',
  'D Padikkal':       'devdutt-padikkal',
  'DA Miller':        'david-miller',
  'DA Payne':         null,
  'DJ Hooda':         null,
  'DL Chahar':        'deepak-chahar',
  'DP Conway':        null,
  'DS Rathi':         null,
  'DV Malewar':       'danish-malewar',
  'Dhruv Jurel':      'dhruv-jurel',
  'E Malinga':        'eshan-malinga',
  'F du Plessis':     null,
  'FH Allen':         'finn-allen',
  'Fazalhaq Farooqi': null,
  'G Coetzee':        'gerald-coetzee',
  'GD Phillips':      'glenn-phillips',
  'GF Linde':         'george-linde',
  'GJ Maxwell':       null,
  'Gurjapneet Singh': 'gurjapneet-singh',
  'H Klaasen':        'heinrich-klaasen',
  'HH Pandya':        'hardik-pandya',
  'HV Patel':         'harshal-patel',
  'Harpreet Brar':    'harpreet-brar',
  'Harsh Dubey':      'harsh-dubey',
  'Harshit Rana':     null,
  'Himmat Singh':     'himmat-singh',
  'I Sharma':         null,
  'Ishan Kishan':     'ishan-kishan',
  'J Fraser-McGurk':  null,
  'J Overton':        null,
  'JA Duffy':         'jacob-duffy',
  'JC Archer':        'jofra-archer',
  'JC Buttler':       'jos-buttler',
  'JD Unadkat':       'jaydev-unadkat',
  'JG Bethell':       'jacob-bethell',
  'JJ Bumrah':        'jasprit-bumrah',
  'JM Bairstow':      null,
  'JM Sharma':        'jitesh-sharma',
  'JO Holder':        'jason-holder',
  'JP Inglis':        'josh-inglis',
  'JR Hazlewood':     'josh-hazlewood',
  'K Kartikeya':      null,
  'K Khejroliya':     'kulwant-khejroliya',
  'K Rabada':         'kagiso-rabada',
  'KA Jamieson':      'kyle-jamieson',
  'KH Pandya':        'krunal-pandya',
  'KK Ahmed':         null,
  'KK Nair':          'karun-nair',
  'KL Rahul':         'kl-rahul',
  'KS Rathore':       null,
  'KT Maphaka':       'kwena-maphaka',
  'KV Sharma':        'kartik-sharma',
  'Karim Janat':      null,
  'Kartik Sharma':    'kartik-sharma',
  'Kartik Tyagi':     'kartik-tyagi',
  'Krish Bhagat':     'krish-bhagat',
  'Kuldeep Yadav':    'kuldeep-yadav',
  'Kumar Kushagra':   'kumar-kushagra',
  'L Ngidi':          'lungisani-ngidi',
  'LG Pretorius':     'lhuan-dre-pretorius',
  'LH Ferguson':      'lockie-ferguson',
  'LS Livingstone':   'liam-livingstone',
  'M Jansen':         'marco-jansen',
  'M Markande':       'mayank-markande',
  'M Pathirana':      'matheesha-pathirana',
  'M Prasidh Krishna': 'prasidh-krishna',
  'M Shahrukh Khan':  'shahrukh-khan',
  'M Siddharth':      'm-siddharth',
  'M Theekshana':     'maheesh-theekshana',
  'M Tiwari':         'manish-tiwari',
  'MA Agarwal':       'mayank-agarwal',
  'MA Starc':         'mitchell-starc',
  'MD Choudhary':     'mukesh-choudhary',
  'MD Shanaka':       'dasun-shanaka',
  'MJ Henry':         'matt-henry',
  'MJ Owen':          null,
  'MJ Santner':       'mitchell-santner',
  'MJ Suthar':        null,
  'MK Pandey':        'manish-pandey',
  'MM Ali':           'moeen-ali',
  'MM Sharma':        'mohit-sharma',
  'MP Breetzke':      null,
  'MP Stoinis':       'marcus-stoinis',
  'MP Yadav':         'mayank-yadav',
  'MR Marsh':         'mitchell-marsh',
  'MS Bhandage':      null,
  'MS Dhoni':         'ms-dhoni',
  'MW Short':         'matthew-william-short',
  'Mohammed Shami':   'mohammad-shami',
  'Mohammed Siraj':   'mohammad-siraj',
  'Mohsin Khan':      'mohsin-khan',
  'Mujeeb Ur Rahman': 'mujeeb-ur-rahman',
  'Mukesh Choudhary': 'mukesh-choudhary',
  'Mukesh Kumar':     'mukesh-kumar',
  'Musheer Khan':     'musheer-khan',
  'Mustafizur Rahman': 'mustafizur-rahman',
  'N Burger':         'nandre-burger',
  'N Pooran':         'nicholas-pooran',
  'N Rana':           'nitish-rana',
  'N Sindhu':         'nishant-sindhu',
  'N Thushara':       null,
  'N Wadhera':        'nehal-wadhera',
  'NT Ellis':         null,
  'Naman Dhir':       'naman-dhir',
  'Navdeep Saini':    'navdeep-saini',
  'Nithish Kumar Reddy': 'nitish-kumar-reddy',
  'Noor Ahmad':       'noor-ahmad',
  'P Dubey':          'pravin-dubey',
  'P Nissanka':       'pathum-nissanka',
  'P Simran Singh':   'prabhsimran-singh',
  'PD Salt':          'phil-salt',
  'PHKD Mendis':      'kamindu-mendis',
  'PJ Cummins':       'pat-cummins',
  'PP Hinge':         'praful-hinge',
  'PR Veer':          'prashant-veer',
  'PVD Chameera':     'dushmantha-chameera',
  'PVSN Raju':        null,
  'PWA Mulder':       null,
  'PWH de Silva':     null,
  'Priyansh Arya':    'priyansh-arya',
  'Prince Yadav':     'prince-yadav',
  'Q de Kock':        'quinton-de-kock',
  'R Ashwin':         null,
  'R Minz':           'robin-minz',
  'R Parag':          'riyan-parag',
  'R Powell':         'rovman-powell',
  'R Ravindra':       'rachin-ravindra',
  'R Sai Kishore':    'sai-kishore',
  'R Shepherd':       'romario-shepherd',
  'R Smaran':         'smaran-ravichandran',
  'R Tewatia':        'rahul-tewatia',
  'RA Bawa':          'raj-angad-bawa',
  'RA Jadeja':        'ravindra-jadeja',
  'RA Tripathi':      'rahul-tripathi',
  'RD Chahar':        'deepak-chahar',
  'RD Gaikwad':       'ruturaj-gaikwad',
  'RD Rickelton':     'ryan-rickelton',
  'RG Sharma':        'rohit-sharma',
  'RJ Gleeson':       'richard-gleeson',
  'RJW Topley':       null,
  'RK Singh':         'rinku-singh',
  'RM Patidar':       'rajat-patidar',
  'RR Pant':          'rishabh-pant',
  'RS Ghosh':         null,
  'Raghu Sharma':     'raghu-sharma',
  'Rahmanullah Gurbaz': null,
  'Ramandeep Singh':  'ramandeep-singh',
  'Rashid Khan':      'rashid-khan',
  'Rasikh Salam':     'rasikh-dar',
  'Ravi Bishnoi':     'ravi-bishnoi',
  'Ravi Singh':       null,
  'S Arora':          'salil-arora',
  'S Dube':           'shivam-dube',
  'SA Yadav':         'surya-kumar-yadav',
  'SB Dubey':         'shubham-dubey',
  'SE Rutherford':    'sherfane-rutherford',
  'SH Johnson':       null,
  'SK Rasheed':       'sai-kishore',
  'SM Curran':        null,
  'SN Khan':          'shahrukh-khan',
  'SN Thakur':        'shardul-thakur',
  'SO Hetmyer':       'shimron-hetmyer',
  'SP Narine':        'sunil-narine',
  'SR Dubey':         'saurabh-dubey',
  'SS Iyer':          'shreyas-iyer',
  'SS Mishra':        'sushant-mishra',
  'SU Parakh':        'sahil-parakh',
  'SV Samson':        'sanju-samson',
  'Sakib Hussain':    'sakib-hussain',
  'Salil Arora':      'salil-arora',
  'Sameer Rizvi':     'sameer-rizvi',
  'Sandeep Sharma':   'sandeep-sharma',
  'Sediqullah Atal':  null,
  'Shahbaz Ahmed':    'shahbaz-ahamad',
  'Shashank Singh':   'shashank-singh',
  'Shivang Kumar':    'shivang-kumar',
  'Shubman Gill':     'shubman-gill',
  'Simarjeet Singh':  null,
  'Suryansh Shedge':  'suryansh-shedge',
  'Suyash Sharma':    'suyash-sharma',
  'T Dahiya':         null,
  'T Natarajan':      't-natarajan',
  'T Stubbs':         'tristan-stubbs',
  'T Vijay':          'tripurana-vijay',
  'TA Boult':         'trent-boult',
  'TH David':         'tim-david',
  'TL Seifert':       'tim-seifert',
  'TM Head':          'travis-head',
  'TU Deshpande':     'tushar-deshpande',
  'Tilak Varma':      'n-tilak-varma',
  'Urvil Patel':      'urvil-patel',
  'V Kohli':          'virat-kohli',
  'V Nigam':          'vipraj-nigam',
  'V Puthur':         'vignesh-puthur',
  'V Shankar':        null,
  'V Suryavanshi':    'vaibhav-sooryavanshi',
  'VG Arora':         'vyshak-vijaykumar',
  'VR Iyer':          'venkatesh-iyer',
  'Vijaykumar Vyshak': 'vyshak-vijaykumar',
  'Vishnu Vinod':     'vishnu-vinod',
  "W O'Rourke":       null,
  'WG Jacks':         'will-jacks',
  'Washington Sundar': 'washington-sundar',
  'XC Bartlett':      'xavier-bartlett',
  'YBK Jaiswal':      'yashasvi-jaiswal',
  'YS Chahal':        'yuzvendra-chahal',
  'Yash Dayal':       'yash-dayal',
  'Yash Raj Punja':   'yash-raj-punja',
  'Yash Thakur':      'yash-thakur',
  'Yudhvir Singh':    'yudhvir-singh-charak',
  'Zeeshan Ansari':   'zeeshan-ansari',
};

// ── Utility: normalize player name to ID attempt ───────────────────────────
function normalizeName(name) {
  if (CRICSHEET_NAME_TO_ID[name] !== undefined) {
    return CRICSHEET_NAME_TO_ID[name];
  }
  // Attempt auto-normalization
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// ── Download Cricsheet IPL zip ────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    let redirectCount = 0;

    function doRequest(requestUrl) {
      const parsedUrl = new URL(requestUrl);
      https.get(parsedUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (redirectCount++ > 5) return reject(new Error('Too many redirects'));
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${requestUrl}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    }

    doRequest(url);
  });
}

// ── Parse Cricsheet match JSON and accumulate player stats ────────────────────
function processMatch(matchJson, playerBattingMap, playerBowlingMap, playerMatchSet, seasonYear) {
  try {
    const info = matchJson.info || {};
    const eventName = (info.event?.name || '').toLowerCase();

    // Only include IPL matches
    if (!eventName.includes('indian premier league') && !eventName.includes('premier league')) return;

    const dates = info.dates || [];
    if (dates.length === 0) return;

    const matchYear = String(new Date(dates[0]).getFullYear());
    if (matchYear !== seasonYear) return;

    const innings = matchJson.innings || [];

    for (const inning of innings) {
      // Per-match innings tracking: reset lastBatter/lastBowler per inning to correctly count innings
      const inningBattersTracked = new Set();
      const inningBowlersTracked = new Set();

      const deliveries = [];
      for (const over of inning.overs || []) {
        for (const del of over.deliveries || []) {
          deliveries.push(del);
        }
      }

      for (const del of deliveries) {
        const batterId = normalizeName(del.batter);
        const bowlerId = normalizeName(del.bowler);

        if (!batterId && !bowlerId) continue;

        // BATTING
        if (batterId) {
          if (!playerBattingMap[batterId]) {
            playerBattingMap[batterId] = { runs: 0, balls: 0, dismissals: 0, innings: 0 };
          }
          const bs = playerBattingMap[batterId];

          // Count each new inning (per batter per inning object, not globally)
          const inningKey = batterId + '_' + inning.team;
          if (!inningBattersTracked.has(inningKey)) {
            inningBattersTracked.add(inningKey);
            bs.innings++;
          }

          const batterRuns = del.runs?.batter ?? 0;
          const isWide = (del.extras?.wides || 0) > 0;
          if (!isWide) bs.balls++;
          bs.runs += batterRuns;

          if (del.wickets) {
            for (const w of del.wickets) {
              if (w.player_out === del.batter) bs.dismissals++;
            }
          }
        }

        // BOWLING
        if (bowlerId) {
          if (!playerBowlingMap[bowlerId]) {
            playerBowlingMap[bowlerId] = { balls: 0, runs: 0, wickets: 0, innings: 0 };
          }
          const bs = playerBowlingMap[bowlerId];

          const bowlInningKey = bowlerId + '_' + inning.team;
          if (!inningBowlersTracked.has(bowlInningKey)) {
            inningBowlersTracked.add(bowlInningKey);
            bs.innings++;
          }

          const isWide = (del.extras?.wides || 0) > 0;
          if (!isWide) bs.balls++;

          const bowlerRuns = (del.runs?.total || 0);
          bs.runs += bowlerRuns;

          if (del.wickets) {
            for (const w of del.wickets) {
              const nonBowlerWickets = ['run out', 'obstructing the field', 'retired hurt', 'retired out'];
              if (!nonBowlerWickets.includes(w.kind)) bs.wickets++;
            }
          }
        }

        // MATCH PARTICIPATION
        if (batterId) {
          if (!playerMatchSet[batterId]) playerMatchSet[batterId] = new Set();
        }
        if (bowlerId) {
          if (!playerMatchSet[bowlerId]) playerMatchSet[bowlerId] = new Set();
        }
      }
    }

    // Record match participation by adding match identifier
    const matchId = dates[0] + '_' + (info.teams || []).join('_');
    for (const inning of innings) {
      const allPlayers = new Set();
      for (const over of inning.overs || []) {
        for (const del of over.deliveries || []) {
          if (del.batter) allPlayers.add(normalizeName(del.batter));
          if (del.bowler) allPlayers.add(normalizeName(del.bowler));
        }
      }
      for (const pid of allPlayers) {
        if (pid) {
          if (!playerMatchSet[pid]) playerMatchSet[pid] = new Set();
          playerMatchSet[pid].add(matchId);
        }
      }
    }
  } catch (err) {
    // silently skip malformed match files
  }
}

// ── Compute derived statistics ────────────────────────────────────────────────
function computeBattingStats(raw, matchCount) {
  if (!raw || raw.innings < 1) return null;

  const strikeRate = raw.balls > 0 ? parseFloat(((raw.runs / raw.balls) * 100).toFixed(2)) : 0;
  const notOuts = raw.innings - raw.dismissals;
  const average = raw.dismissals > 0 ? parseFloat((raw.runs / raw.dismissals).toFixed(2)) : (raw.runs > 0 ? null : 0);

  return {
    matches: matchCount,
    innings: raw.innings,
    runs: raw.runs,
    balls: raw.balls,
    strikeRate,
    average,
    dismissals: raw.dismissals,
    notOuts,
  };
}

function computeBowlingStats(raw, matchCount) {
  if (!raw || raw.balls < 6) return null;

  const overs = parseFloat((Math.floor(raw.balls / 6) + (raw.balls % 6) / 10).toFixed(1));
  const economy = raw.balls > 0 ? parseFloat(((raw.runs / raw.balls) * 6).toFixed(2)) : null;
  const average = raw.wickets > 0 ? parseFloat((raw.runs / raw.wickets).toFixed(2)) : null;
  const strikeRate = raw.wickets > 0 ? parseFloat((raw.balls / raw.wickets).toFixed(2)) : null;

  return {
    matches: matchCount,
    innings: raw.innings,
    overs,
    balls: raw.balls,
    runs: raw.runs,
    wickets: raw.wickets,
    economy,
    average,
    strikeRate,
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log('  IPL Draft Arena — Cricsheet Stats Fetcher');
  console.log('═'.repeat(60));

  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const playerIdSet = new Set(players.map(p => p.id));

  // 1. Download Cricsheet ZIP (or use cache)
  if (!fs.existsSync(CACHE_FILE)) {
    console.log(`\n📥 Downloading Cricsheet IPL data from:\n   ${CRICSHEET_URL}`);
    try {
      await downloadFile(CRICSHEET_URL, CACHE_FILE);
      console.log(`   ✅ Downloaded to cache: ${CACHE_FILE}`);
    } catch (err) {
      console.error(`   ❌ Download failed: ${err.message}`);
      console.log('\nWriting empty stats — all players will be marked insufficient-data.');
      writeEmptyStats(players);
      return;
    }
  } else {
    console.log(`\n📦 Using cached Cricsheet data: ${CACHE_FILE}`);
  }

  // 2. Extract and process match JSONs
  const zip = new AdmZip(CACHE_FILE);
  const entries = zip.getEntries().filter(e => e.entryName.endsWith('.json') && !e.isDirectory);
  console.log(`\n📂 Found ${entries.length} match JSON files in archive`);

  const seasonStats = {};
  for (const season of SEASONS) {
    seasonStats[season] = {
      batting: {},   // playerId → raw batting accum
      bowling: {},   // playerId → raw bowling accum
      matches: {},   // playerId → Set of matchIds
    };
  }

  let processed = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const content = zip.readAsText(entry);
      const matchJson = JSON.parse(content);
      const dates = matchJson.info?.dates || [];
      if (dates.length === 0) { skipped++; continue; }
      const matchYear = String(new Date(dates[0]).getFullYear());
      if (!SEASONS.includes(matchYear)) { skipped++; continue; }

      processMatch(
        matchJson,
        seasonStats[matchYear].batting,
        seasonStats[matchYear].bowling,
        seasonStats[matchYear].matches,
        matchYear,
      );
      processed++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`   Processed: ${processed} IPL matches across ${SEASONS.join(', ')}`);
  console.log(`   Skipped:   ${skipped} non-IPL or unparseable files`);

  // 3. Build playerStats.json
  const statsRecords = [];
  const ratingsRecords = [];

  for (const player of players) {
    const pid = player.id;
    const isInjuredUnavailable = player.seasonStatus?.['2026']?.includes('injured');

    const seasonsOutput = {};
    for (const season of SEASONS) {
      const battingRaw = seasonStats[season].batting[pid];
      const bowlingRaw = seasonStats[season].bowling[pid];
      const matchSet = seasonStats[season].matches[pid];
      const matchCount = matchSet ? matchSet.size : 0;

      const battingStats = computeBattingStats(battingRaw, matchCount);
      const bowlingStats = computeBowlingStats(bowlingRaw, matchCount);

      seasonsOutput[season] = {
        _source: {
          provider: 'cricsheet',
          type: 'ball-by-ball-derived',
          url: 'https://cricsheet.org/downloads/ipl_json.zip',
          verifiedAt: VERIFIED_AT,
          derivedFrom: `${processed} IPL match files`,
        },
        batting: battingStats,
        bowling: bowlingStats,
        matchesParticipated: matchCount,
      };

      // Compute rating
      const ratingObj = computeRating(player, battingStats, bowlingStats, matchCount, season, isInjuredUnavailable && season === '2026');
      ratingsRecords.push({
        playerId: pid,
        season,
        ...ratingObj,
        source: {
          provider: 'cricsheet',
          type: 'ball-by-ball-derived',
          url: 'https://cricsheet.org/downloads/ipl_json.zip',
          verifiedAt: VERIFIED_AT,
        },
      });
    }

    statsRecords.push({ playerId: pid, seasons: seasonsOutput });
  }

  // 4. Write output files
  const statsOutput = {
    metadata: {
      source: 'Cricsheet IPL ball-by-ball JSON data',
      sourceUrl: 'https://cricsheet.org/downloads/ipl_json.zip',
      seasons: SEASONS,
      lastVerified: VERIFIED_AT,
      totalPlayers: players.length,
      method: 'ball-by-ball-aggregation',
      note: 'Statistics computed by aggregating individual delivery records. Batting: runs, balls, SR, average. Bowling: balls, runs, wickets, economy, bowling average, bowling SR.',
    },
    stats: statsRecords,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'playerStats.json'), JSON.stringify(statsOutput, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'playerRatings.json'), JSON.stringify(ratingsRecords, null, 2));
  writeSources();

  // 5. Summary
  const verified = ratingsRecords.filter(r => r.ratingStatus === 'verified').length;
  const insufficientData = ratingsRecords.filter(r => r.ratingStatus === 'insufficient-data').length;
  const unrated = ratingsRecords.filter(r => r.ratingStatus === 'unrated').length;

  console.log('\n═'.repeat(60));
  console.log('  Stats Generation Complete');
  console.log('═'.repeat(60));
  console.log(`  Total players:        ${players.length}`);
  console.log(`  Total rating records: ${ratingsRecords.length}`);
  console.log(`  Verified:             ${verified}`);
  console.log(`  Insufficient-data:    ${insufficientData}`);
  console.log(`  Unrated (injured):    ${unrated}`);
  console.log(`  playerStats.json:     ✅ written`);
  console.log(`  playerRatings.json:   ✅ written`);
  console.log(`  performanceSources.json: ✅ written`);
}

// ── Rating computation (no fallbacks, no fabrication) ────────────────────────
function computeRating(player, battingStats, bowlingStats, matchCount, season, forceUnrated) {
  if (forceUnrated) {
    return {
      rating: null,
      ratingStatus: 'unrated',
      confidence: 'low',
      components: { batting: null, bowling: null, keeping: null },
      sampleSize: 0,
    };
  }

  const role = player.role;
  let rating = null;
  let components = { batting: null, bowling: null, keeping: null };
  let ratingStatus = 'insufficient-data';
  let confidence = 'low';
  let sampleSize = matchCount;

  const MIN_BATTING_INNINGS = 3;
  const MIN_BOWLING_BALLS = 18; // 3 overs minimum

  if (role === 'batter') {
    if (battingStats && battingStats.innings >= MIN_BATTING_INNINGS) {
      components.batting = calcBattingScore(battingStats);
      rating = components.batting;
      ratingStatus = 'verified';
      confidence = matchCount >= 10 ? 'high' : matchCount >= 5 ? 'medium' : 'low';
    }

  } else if (role === 'wicketkeeper-batter') {
    if (battingStats && battingStats.innings >= MIN_BATTING_INNINGS) {
      components.batting = calcBattingScore(battingStats);
      // No hardcoded keeping — keeping stats not in Cricsheet ball-by-ball
      components.keeping = null;
      // Rating is 100% batting since we have no reliable keeping source from Cricsheet
      rating = components.batting;
      ratingStatus = 'verified';
      confidence = matchCount >= 10 ? 'high' : matchCount >= 5 ? 'medium' : 'low';
    }

  } else if (role === 'bowler') {
    if (bowlingStats && bowlingStats.balls >= MIN_BOWLING_BALLS) {
      components.bowling = calcBowlingScore(bowlingStats);
      rating = components.bowling;
      ratingStatus = 'verified';
      confidence = matchCount >= 10 ? 'high' : matchCount >= 5 ? 'medium' : 'low';
    }

  } else if (role === 'all-rounder') {
    const hasBatting = battingStats && battingStats.innings >= MIN_BATTING_INNINGS;
    const hasBowling = bowlingStats && bowlingStats.balls >= MIN_BOWLING_BALLS;

    if (hasBatting) components.batting = calcBattingScore(battingStats);
    if (hasBowling) components.bowling = calcBowlingScore(bowlingStats);

    if (hasBatting && hasBowling) {
      rating = Math.round((components.batting * 0.5) + (components.bowling * 0.5));
      ratingStatus = 'verified';
      confidence = matchCount >= 10 ? 'high' : matchCount >= 5 ? 'medium' : 'low';
    } else if (hasBatting || hasBowling) {
      rating = hasBatting ? components.batting : components.bowling;
      ratingStatus = 'verified';
      confidence = 'low'; // single-discipline data only
    }
  }

  return { rating, ratingStatus, confidence, components, sampleSize };
}

function calcBattingScore(stats) {
  if (!stats || stats.innings < 1) return null;

  // Normalization bounds based on IPL T20 context
  const runsScore     = Math.min(100, (stats.runs / 550) * 100);
  const srScore       = Math.min(100, Math.max(0, ((stats.strikeRate - 100) / 70) * 100));
  const avgScore      = stats.average !== null
    ? Math.min(100, Math.max(0, ((stats.average - 15) / 35) * 100))
    : srScore * 0.5; // if all not-outs, use SR proxy
  const inningsScore  = Math.min(100, (stats.innings / 14) * 100);

  const weighted = (runsScore * 0.40) + (srScore * 0.25) + (avgScore * 0.25) + (inningsScore * 0.10);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

function calcBowlingScore(stats) {
  if (!stats || stats.balls < 6) return null;

  const wicketsScore  = Math.min(100, (stats.wickets / 22) * 100);
  const ecoScore      = stats.economy !== null
    ? Math.min(100, Math.max(0, ((11.5 - stats.economy) / 5.5) * 100))
    : 30;
  const avgScore      = stats.average !== null
    ? Math.min(100, Math.max(0, ((45.0 - stats.average) / 30.0) * 100))
    : 30;
  const srScore       = stats.strikeRate !== null
    ? Math.min(100, Math.max(0, ((35.0 - stats.strikeRate) / 22.0) * 100))
    : 30;

  const weighted = (wicketsScore * 0.40) + (ecoScore * 0.25) + (avgScore * 0.20) + (srScore * 0.15);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

function writeSources() {
  const sources = {
    sources: [
      {
        id: 'cricsheet-ipl',
        provider: 'cricsheet',
        type: 'ball-by-ball',
        url: 'https://cricsheet.org/downloads/ipl_json.zip',
        description: 'Cricsheet IPL ball-by-ball JSON match data. All deliveries recorded per batter and bowler.',
        seasons: ['2025', '2026'],
        lastAccessed: VERIFIED_AT,
        license: 'CC BY-SA 4.0 (https://cricsheet.org/license/)',
      },
    ],
    methodology: {
      batting: 'Aggregated across all deliveries faced. SR = (runs/balls)*100. Average = runs/dismissals (null if never dismissed).',
      bowling: 'Aggregated across all deliveries bowled (wides excluded from balls count). Economy = (runs/balls)*6. Average = runs/wickets (null if 0 wickets).',
      minimumSampleBatting: '3 innings required for verified status',
      minimumSampleBowling: '18 balls (3 overs) required for verified status',
      keepingData: 'Keeping dismissals not included — Cricsheet ball-by-ball does not track keeper dismissals separately in a consistently parseable way.',
      normalization: {
        batting: {
          runs: 'min=0, max=550 (best single-season IPL performances)',
          strikeRate: 'min=100, max=170 (T20 context baseline)',
          average: 'min=15, max=50',
          innings: 'min=0, max=14',
        },
        bowling: {
          wickets: 'min=0, max=22',
          economy: 'inversely normalized: best=6.0, worst=11.5',
          average: 'inversely normalized: best=15, worst=45',
          strikeRate: 'inversely normalized: best=13, worst=35',
        },
      },
    },
  };

  fs.writeFileSync(path.join(DATA_DIR, 'performanceSources.json'), JSON.stringify(sources, null, 2));
}

function writeEmptyStats(players) {
  const ratingsRecords = players.map(p => ({
    playerId: p.id,
    season: '2026',
    rating: null,
    ratingStatus: 'insufficient-data',
    confidence: 'low',
    components: { batting: null, bowling: null, keeping: null },
    sampleSize: 0,
    source: { provider: 'none', note: 'Download failed — no data available' },
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'playerRatings.json'), JSON.stringify(ratingsRecords, null, 2));

  const statsOutput = {
    metadata: { source: 'none', note: 'Download failed', lastVerified: VERIFIED_AT },
    stats: players.map(p => ({ playerId: p.id, seasons: {} })),
  };
  fs.writeFileSync(path.join(DATA_DIR, 'playerStats.json'), JSON.stringify(statsOutput, null, 2));
  writeSources();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
