// api/ca-history.js Ã¢ÂÂ monthly CA counts (ICA + SGCA) per rep, from Sales Rabbit status history.
//
// A CA = a distinct lead that reached ICA or SGCA in a given month, credited to the rep who set
// it (changedByUserId), scoped to the office's Storm team. Counted from /leadStatusHistories events.
//
// ?office=herndon|richmond   Storm scope: Herndon = DC Self Gen, Richmond = Richmond Storm.
// ?live=1                    current month only (fast) Ã¢ÂÂ dashboard CA cards.
// ?live=1&scope=year         full Jan..now grid (heavy) Ã¢ÂÂ daily task builds the snapshot.
// default (no live)          serve the stored year SNAPSHOT Ã¢ÂÂ CA-by-month grid.

const SNAPSHOTS = {
  "herndon": {
    "updated": "2026-07-18T13:18:12.586Z",
    "year": 2026,
    "months": [
      0,
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "reps": [
      {
        "rep": "Andrew Funk",
        "counts": [
          0,
          0,
          0,
          0,
          5,
          14,
          12
        ],
        "total": 31
      },
      {
        "rep": "David Kerns",
        "counts": [
          0,
          0,
          11,
          8,
          5,
          6,
          1
        ],
        "total": 31
      },
      {
        "rep": "Harvey Shoemaker",
        "counts": [
          0,
          1,
          1,
          2,
          5,
          16,
          5
        ],
        "total": 30
      },
      {
        "rep": "Andrew  Prickel",
        "counts": [
          0,
          0,
          3,
          3,
          5,
          1,
          13
        ],
        "total": 25
      },
      {
        "rep": "Jack Obert",
        "counts": [
          0,
          0,
          3,
          5,
          8,
          6,
          3
        ],
        "total": 25
      },
      {
        "rep": "Mike Mccarthy",
        "counts": [
          1,
          0,
          4,
          0,
          8,
          6,
          4
        ],
        "total": 23
      },
      {
        "rep": "Christian Brown",
        "counts": [
          1,
          0,
          1,
          3,
          4,
          6,
          6
        ],
        "total": 21
      },
      {
        "rep": "Marc Mitchell",
        "counts": [
          5,
          2,
          4,
          5,
          4,
          1,
          0
        ],
        "total": 21
      },
      {
        "rep": "Izzy Price",
        "counts": [
          2,
          0,
          5,
          2,
          5,
          3,
          1
        ],
        "total": 18
      },
      {
        "rep": "George Bechara",
        "counts": [
          2,
          0,
          2,
          5,
          2,
          4,
          1
        ],
        "total": 16
      },
      {
        "rep": "Steven Arevalo",
        "counts": [
          2,
          2,
          5,
          3,
          0,
          3,
          0
        ],
        "total": 15
      },
      {
        "rep": "Carol Wright",
        "counts": [
          0,
          0,
          0,
          0,
          0,
          4,
          9
        ],
        "total": 13
      },
      {
        "rep": "Kevin Mahan",
        "counts": [
          0,
          2,
          2,
          2,
          3,
          0,
          0
        ],
        "total": 9
      },
      {
        "rep": "Robert Mumford-Wilson",
        "counts": [
          3,
          0,
          0,
          3,
          1,
          0,
          0
        ],
        "total": 7
      },
      {
        "rep": "Aiden Glonek",
        "counts": [
          0,
          0,
          0,
          1,
          0,
          0,
          1
        ],
        "total": 2
      },
      {
        "rep": "Jason Cresswell",
        "counts": [
          0,
          0,
          0,
          0,
          0,
          0,
          1
        ],
        "total": 1
      },
      {
        "rep": "Thurmond shaw",
        "counts": [
          0,
          0,
          0,
          0,
          0,
          0,
          1
        ],
        "total": 1
      },
      {
        "rep": "Kelly Alston",
        "counts": [
          0,
          0,
          1,
          0,
          0,
          0,
          0
        ],
        "total": 1
      }
    ]
  },
  "richmond": {
    "updated": "2026-07-18T13:19:00.810Z",
    "year": 2026,
    "months": [
      0,
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "reps": [
      {
        "rep": "Joshua Baca",
        "counts": [
          0,
          2,
          13,
          13,
          6,
          21,
          6
        ],
        "total": 61
      },
      {
        "rep": "Travis Kizzar",
        "counts": [
          3,
          2,
          10,
          1,
          6,
          9,
          11
        ],
        "total": 42
      },
      {
        "rep": "Logan Burbic",
        "counts": [
          0,
          6,
          8,
          5,
          6,
          8,
          2
        ],
        "total": 35
      },
      {
        "rep": "Brandon Simmons",
        "counts": [
          2,
          1,
          1,
          5,
          2,
          9,
          3
        ],
        "total": 23
      },
      {
        "rep": "Justin Coghill",
        "counts": [
          1,
          1,
          2,
          4,
          6,
          7,
          0
        ],
        "total": 21
      }
    ]
  }
};

const BASE = 'https://api.salesrabbit.com';
const CA_NORM = new Set(['ica', 'sgca']);
const SR_ALIAS = { 'mike mccarthy': 'michael mccarthy', 'izzy price': 'isabelle price', 'robert mumford-wilson': 'robert wilson' };
const CAP = 2000;

function tok() { const t = process.env.SALESRABBIT_TOKEN; if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel'); return t; }
async function srGet(path, headers) { const res = await fetch(BASE + path, { headers: Object.assign({ Authorization: 'Bearer ' + tok(), Accept: 'application/json' }, headers || {}) }); const text = await res.text(); let json; try { json = JSON.parse(text); } catch (_) { json = text; } return { status: res.status, json }; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function monthStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function stormAllowed(team, office) { const n = norm(team); if (office === 'richmond') return n.indexOf('richmond') > -1; return (n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('jack') > -1 || n.indexOf('inbound') > -1; }

async function compute(office, year, monthOnly) {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    id: String(pick(u, ['id'])),
    name: pick(u, ['fullName']) || [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() || pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const storm = allUsers.filter((u) => stormAllowed(u.team, office) && u.active !== false);
  const byId = {}; storm.forEach((u) => { byId[u.id] = repKey(u.name); });
  const display = {}; storm.forEach((u) => { display[repKey(u.name)] = u.name; });

  const now = new Date();
  const since = monthOnly ? monthStart() : new Date(year, 0, 1);
  const hdr = { 'If-Status-Modified-Since': since.toISOString() };
  const counts = {}; const seen = new Set(); const seenLead = new Set(); let eventsScanned = 0, pages = 0;
  for (let page = 1; page <= 120; page++) {
    const r = await srGet('/leadStatusHistories?perPage=' + CAP + '&page=' + page, hdr);
    const data = (r.json && r.json.data) || {};
    const ids = Object.keys(data);
    if (!ids.length) break;
    pages++;
    let fresh = 0;
    for (const lid of ids) {
      if (seenLead.has(lid)) continue; seenLead.add(lid); fresh++;
      for (const ev of (data[lid] || [])) {
        eventsScanned++;
        const st = statusNorm(ev.name);
        if (!CA_NORM.has(st)) continue;
        const d = new Date(ev.statusUpdated || 0);
        if (isNaN(d)) continue;
        if (monthOnly) { if (d < since) continue; } else { if (d.getFullYear() !== year) continue; }
        const rk = byId[String(ev.changedByUserId)];
        if (!rk) continue;
        const m = d.getMonth();
        const key = rk + '|' + m + '|' + lid;
        if (seen.has(key)) continue; seen.add(key);
        if (!counts[rk]) counts[rk] = new Array(12).fill(0);
        counts[rk][m]++;
      }
    }
    if (fresh === 0) break;
  }
  const lastMonth = (monthOnly || year === now.getFullYear()) ? now.getMonth() : 11;
  const firstMonth = monthOnly ? now.getMonth() : 0;
  const months = []; for (let m = firstMonth; m <= lastMonth; m++) months.push(m);
  const reps = Object.keys(counts).map((rk) => {
    const c = counts[rk]; const total = months.reduce((a, m) => a + c[m], 0);
    return { rep: display[rk] || rk, counts: months.map((m) => c[m]), total };
  }).sort((a, b) => b.total - a.total);
  return { office, year, updated: new Date().toISOString(), months, reps, eventsScanned, pages, leadsScanned: seenLead.size };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'http://localhost');
    const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
    const year = parseInt(url.searchParams.get('year') || '', 10) || new Date().getFullYear();
    const live = url.searchParams.get('live');
    const monthOnly = url.searchParams.get('scope') !== 'year';
    if (live === '1') { const data = await compute(office, year, monthOnly); res.status(200).json(data); return; }
    res.status(200).json(SNAPSHOTS[office] || SNAPSHOTS.herndon);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
