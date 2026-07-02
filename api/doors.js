// api/doors.js — doors knocked per rep this month, from Sales Rabbit.
//
// ?office=herndon (default) | richmond   — selects the team scope + snapshot.
//   herndon  = DC Inbound + DC Self Gen
//   richmond = Richmond Storm + Richmond Retail
// DEFAULT: serves the office's SNAPSHOT instantly (dashboard + Refresh are fast).
// ?live=1     : recompute fresh from Sales Rabbit (slow ~25-30s). Used by the daily task.
// ?debug=tally: per-owner knockable counts for this month (names + counts only).
//
// A "door" = a pin owned by an allowed rep, status NOT in {Closed, Do Not Knock,
// Drive By}, status-updated this month. Both offices share one Sales Rabbit account.

const SNAPSHOTS = {
  "herndon": {
    "updated": "2026-07-02T14:15:17.655Z",
    "total": 170,
    "reps": [
      {
        "rep": "Thurmond shaw",
        "doors": 33
      },
      {
        "rep": "Mike Mccarthy",
        "doors": 31
      },
      {
        "rep": "David Kerns",
        "doors": 27
      },
      {
        "rep": "Jason Cresswell",
        "doors": 17
      },
      {
        "rep": "Ethan Wiley",
        "doors": 14
      },
      {
        "rep": "Carol Wright",
        "doors": 14
      },
      {
        "rep": "Harvey Shoemaker",
        "doors": 12
      },
      {
        "rep": "Izzy Price",
        "doors": 10
      },
      {
        "rep": "Andrew  Prickel",
        "doors": 5
      },
      {
        "rep": "George Bechara",
        "doors": 3
      },
      {
        "rep": "Andrew Funk",
        "doors": 2
      },
      {
        "rep": "Christian Brown",
        "doors": 2
      }
    ],
    "allowedReps": [
      "steven arevalo",
      "marc mitchell",
      "andrew funk",
      "michael mccarthy",
      "george bechara",
      "isabelle price",
      "jack obert",
      "harvey shoemaker",
      "kevin mahan",
      "robert wilson",
      "andrew prickel",
      "alfred duncan",
      "christian brown",
      "kelly alston",
      "david kerns",
      "aiden glonek",
      "ethan wiley",
      "carol wright",
      "thurmond shaw",
      "jason cresswell"
    ],
    "roster": [
      "Steven Arevalo",
      "Marc Mitchell",
      "Andrew Funk",
      "Mike Mccarthy",
      "George Bechara",
      "Izzy Price",
      "Jack Obert",
      "Harvey Shoemaker",
      "Kevin Mahan",
      "Robert Mumford-Wilson",
      "Andrew  Prickel",
      "Alfred Duncan",
      "Christian Brown",
      "Kelly Alston",
      "David Kerns",
      "Aiden Glonek",
      "Ethan Wiley",
      "Carol Wright",
      "Thurmond shaw",
      "Jason Cresswell"
    ]
  },
  "richmond": {
    "updated": "2026-07-02T14:15:20.273Z",
    "total": 166,
    "reps": [
      {
        "rep": "Andrew Harris",
        "doors": 41
      },
      {
        "rep": "Logan Burbic",
        "doors": 40
      },
      {
        "rep": "Felipe Osorio",
        "doors": 31
      },
      {
        "rep": "Joshua Baca",
        "doors": 20
      },
      {
        "rep": "Carter Massengill",
        "doors": 20
      },
      {
        "rep": "Travis Kizzar",
        "doors": 7
      },
      {
        "rep": "JR Zaguehi",
        "doors": 7
      }
    ],
    "allowedReps": [
      "justin coghill",
      "brandon simmons",
      "travis kizzar",
      "kevin mccann",
      "joshua baca",
      "logan burbic",
      "bryan courtney",
      "carter massengill",
      "pedro ramirez",
      "andrew harris",
      "jr zaguehi",
      "dalton barr",
      "cristina saunders",
      "marcus schanewolf",
      "felipe osorio"
    ],
    "roster": [
      "Justin Coghill",
      "Brandon Simmons",
      "Travis Kizzar",
      "Kevin Mccann",
      "Joshua Baca",
      "Logan Burbic",
      "Bryan Courtney",
      "Carter Massengill",
      "Pedro Ramirez",
      "Andrew Harris",
      "JR Zaguehi",
      "Dalton Barr",
      "Cristina Saunders",
      "marcus schanewolf",
      "Felipe Osorio"
    ]
  }
};

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE_NORM = new Set(['closed', 'donotknock', 'driveby']);
const SR_ALIAS = {
  'mike mccarthy': 'michael mccarthy',
  'izzy price': 'isabelle price',
  'robert mumford-wilson': 'robert wilson',
};
const CAP = 2000;

function tok() {
  const t = process.env.SALESRABBIT_TOKEN;
  if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel');
  return t;
}
async function srGet(path, headers) {
  const res = await fetch(`${BASE}${path}`, {
    headers: Object.assign({ Authorization: `Bearer ${tok()}`, Accept: 'application/json' }, headers || {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: res.status, json };
}
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function monthStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function teamAllowed(t, office) {
  const n = norm(t);
  if (office === 'richmond') return n.indexOf('richmond') > -1;
  return n.indexOf('inbound') > -1 || (n.indexOf('self') > -1 && n.indexOf('gen') > -1);
}

// Fetch every lead whose status was updated since `since`, via offset pagination.
async function leadsSince(since) {
  const out = [];
  const seen = new Set();
  const hdr = { 'If-Status-Modified-Since': since.toISOString() };
  for (let page = 1; page <= 60; page++) {
    const r = await srGet(`/leads?perPage=${CAP}&page=${page}`, hdr);
    const leads = arr(r.json);
    if (!leads.length) break;
    for (const ld of leads) {
      const id = pick(ld, ['id']);
      if (id != null && seen.has(id)) continue;
      if (id != null) seen.add(id);
      out.push(ld);
    }
    if (leads.length < CAP) break;
  }
  return out;
}

async function compute(office) {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    name: pick(u, ['fullName']) ||
      [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() ||
      pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const allowedUsers = allUsers.filter((u) => teamAllowed(u.team, office) && u.active !== false);
  const allowedReps = new Set(allowedUsers.map((u) => repKey(u.name)));
  const roster = allowedUsers.map((u) => u.name);

  const start = monthStart();
  const leads = await leadsSince(start);

  const counts = {};
  const seen = new Set();
  let total = 0;
  leads.forEach((ld) => {
    const rk = repKey(pick(ld, ['userName']) || '');
    if (!allowedReps.has(rk)) return;
    const sm = new Date(pick(ld, ['statusModified']) || 0);
    if (isNaN(sm) || sm < start) return;
    const st = statusNorm(pick(ld, ['status']));
    if (EXCLUDE_NORM.has(st)) return;
    const id = pick(ld, ['id']);
    if (id != null) { if (seen.has(id)) return; seen.add(id); }
    counts[rk] = (counts[rk] || 0) + 1;
    total += 1;
  });
  const display = {};
  allowedUsers.forEach((u) => { display[repKey(u.name)] = u.name; });
  const reps = Object.keys(counts)
    .map((k) => ({ rep: display[k] || k, doors: counts[k] }))
    .sort((a, b) => b.doors - a.doors);

  return { updated: new Date().toISOString(), total, reps, allowedReps: Array.from(allowedReps), roster, leadsScanned: leads.length, office };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://localhost');
    const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
    const live = url.searchParams.get('live');
    const debug = url.searchParams.get('debug');

    if (debug === 'tally') {
      const start = monthStart();
      const leads = await leadsSince(start);
      const byName = {};
      leads.forEach((ld) => {
        const owner = norm(pick(ld, ['userName']) || '');
        const sm = new Date(pick(ld, ['statusModified']) || 0);
        const st = statusNorm(pick(ld, ['status']));
        if (!isNaN(sm) && sm >= start && owner && !EXCLUDE_NORM.has(st)) byName[owner] = (byName[owner] || 0) + 1;
      });
      const top = Object.keys(byName).sort((a, b) => byName[b] - byName[a]).slice(0, 60).map((k) => k + ': ' + byName[k]);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ leadsScanned: leads.length, monthStart: start.toISOString(), topKnockable: top });
      return;
    }

    if (live === '1') {
      const data = await compute(office);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    // Default: instant snapshot for the requested office.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(SNAPSHOTS[office] || SNAPSHOTS.herndon);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
