// api/doors.js â doors knocked per rep this month, from Sales Rabbit.
//
// A "door" = a KNOCK EVENT: a SalesRabbit lead status-history entry (each disposition a rep
// records), status NOT in {Closed, Do Not Knock, Drive By}, event dated this month, credited to
// the rep who made the change (changedByUserId). This matches how Amplify counts Doors Knocked.
//
// ?office=herndon (default) | richmond   selects team scope + snapshot.
// ?live=1 : recompute fresh from Sales Rabbit (one /leadStatusHistories page, ~5-10s).
// default: serve the office SNAPSHOT instantly. Daily task refreshes the snapshot via ?live=1.
const SNAPSHOTS = {
  "herndon": {
    "updated": "2026-07-14T16:44:40.322Z",
    "total": 1962,
    "reps": [
      {
        "rep": "Andrew Funk",
        "doors": 469
      },
      {
        "rep": "Thurmond shaw",
        "doors": 290
      },
      {
        "rep": "Aiden Glonek",
        "doors": 248
      },
      {
        "rep": "Ethan Wiley",
        "doors": 169
      },
      {
        "rep": "Carol Wright",
        "doors": 157
      },
      {
        "rep": "Jason Cresswell",
        "doors": 146
      },
      {
        "rep": "Mike Mccarthy",
        "doors": 132
      },
      {
        "rep": "Izzy Price",
        "doors": 125
      },
      {
        "rep": "Christian Brown",
        "doors": 87
      },
      {
        "rep": "David Kerns",
        "doors": 59
      },
      {
        "rep": "Harvey Shoemaker",
        "doors": 35
      },
      {
        "rep": "Andrew  Prickel",
        "doors": 25
      },
      {
        "rep": "Kelly Alston",
        "doors": 13
      },
      {
        "rep": "George Bechara",
        "doors": 4
      },
      {
        "rep": "Jack Obert",
        "doors": 3
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
    "updated": "2026-07-14T16:44:42.036Z",
    "total": 1522,
    "reps": [
      {
        "rep": "Andrew Harris",
        "doors": 422
      },
      {
        "rep": "Dalton Barr",
        "doors": 279
      },
      {
        "rep": "Felipe Osorio",
        "doors": 233
      },
      {
        "rep": "Carter Massengill",
        "doors": 125
      },
      {
        "rep": "JR Zaguehi",
        "doors": 112
      },
      {
        "rep": "Logan Burbic",
        "doors": 96
      },
      {
        "rep": "Travis Kizzar",
        "doors": 90
      },
      {
        "rep": "Joshua Baca",
        "doors": 63
      },
      {
        "rep": "JT Dillon",
        "doors": 54
      },
      {
        "rep": "Brandon Simmons",
        "doors": 21
      },
      {
        "rep": "Kylea White",
        "doors": 19
      },
      {
        "rep": "Justin Coghill",
        "doors": 8
      }
    ],
    "allowedReps": [
      "justin coghill",
      "brandon simmons",
      "travis kizzar",
      "joshua baca",
      "logan burbic",
      "carter massengill",
      "pedro ramirez",
      "andrew harris",
      "jr zaguehi",
      "dalton barr",
      "cristina saunders",
      "marcus schanewolf",
      "felipe osorio",
      "jt dillon",
      "kylea white"
    ],
    "roster": [
      "Justin Coghill",
      "Brandon Simmons",
      "Travis Kizzar",
      "Joshua Baca",
      "Logan Burbic",
      "Carter Massengill",
      "Pedro Ramirez",
      "Andrew Harris",
      "JR Zaguehi",
      "Dalton Barr",
      "Cristina Saunders",
      "marcus schanewolf",
      "Felipe Osorio",
      "JT Dillon",
      "Kylea White"
    ]
  }
};

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE_NORM = new Set(['closed', 'donotknock', 'driveby']);
const SR_ALIAS = { 'mike mccarthy': 'michael mccarthy', 'izzy price': 'isabelle price', 'robert mumford-wilson': 'robert wilson' };
const CAP = 2000;

function tok() { const t = process.env.SALESRABBIT_TOKEN; if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel'); return t; }
async function srGet(path, headers) { const res = await fetch(BASE + path, { headers: Object.assign({ Authorization: 'Bearer ' + tok(), Accept: 'application/json' }, headers || {}) }); const text = await res.text(); let json; try { json = JSON.parse(text); } catch (_) { json = text; } return { status: res.status, json }; }
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function monthStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function teamAllowed(t, office) { const n = norm(t); if (office === 'richmond') return n.indexOf('richmond') > -1; return n.indexOf('inbound') > -1 || (n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('jack') > -1; }

async function compute(office) {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    id: String(pick(u, ['id'])),
    name: pick(u, ['fullName']) || [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() || pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const allowedUsers = allUsers.filter((u) => teamAllowed(u.team, office) && u.active !== false);
  const byId = {}; allowedUsers.forEach((u) => { byId[u.id] = repKey(u.name); });
  const allowedReps = new Set(allowedUsers.map((u) => repKey(u.name)));
  const roster = allowedUsers.map((u) => u.name);
  const display = {}; allowedUsers.forEach((u) => { display[repKey(u.name)] = u.name; });

  const start = monthStart();
  const hdr = { 'If-Status-Modified-Since': start.toISOString() };
  const counts = {}; const seenLead = new Set(); let total = 0, eventsScanned = 0;
  for (let page = 1; page <= 120; page++) {
    const r = await srGet('/leadStatusHistories?perPage=' + CAP + '&page=' + page, hdr);
    const data = (r.json && r.json.data) || {};
    const ids = Object.keys(data);
    if (!ids.length) break;
      let fresh = 0;
    for (const lid of ids) {
      if (seenLead.has(lid)) continue; seenLead.add(lid); fresh++;
        const evs = data[lid] || [];
      for (const ev of evs) {
        eventsScanned++;
        const d = new Date(ev.statusUpdated || 0);
        if (isNaN(d) || d < start) continue;
        const rk = byId[String(ev.changedByUserId)];
        if (!rk) continue;
        const st = statusNorm(ev.name);
        if (EXCLUDE_NORM.has(st)) continue;
        counts[rk] = (counts[rk] || 0) + 1;
        total += 1;
      }
    }
    if (fresh === 0) break;
  }
  const reps = Object.keys(counts).map((k) => ({ rep: display[k] || k, doors: counts[k] })).sort((a, b) => b.doors - a.doors);
  return { updated: new Date().toISOString(), total, reps, allowedReps: Array.from(allowedReps), roster, eventsScanned, leadsScanned: seenLead.size, office };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://localhost');
    const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
    const live = url.searchParams.get('live');
    if (url.searchParams.get('debug') === 'teams') {
      const uu = arr((await srGet('/users')).json);
      const byTeam = {};
      uu.forEach((u) => { const team = pick(u,['team'])||'(none)'; const active = pick(u,['active']); const name = pick(u,['fullName'])||[pick(u,['firstName','first']),pick(u,['lastName','last'])].filter(Boolean).join(' ').trim()||pick(u,['name','email'])||'?'; if(!byTeam[team])byTeam[team]=[]; byTeam[team].push(name+(active===false?' [inactive]':'')); });
      res.setHeader('Cache-Control','no-store');
      res.status(200).json({ teams: Object.keys(byTeam).map((t)=>({team:t,count:byTeam[t].length,reps:byTeam[t]})) });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (live === '1') { const data = await compute(office); res.status(200).json(data); return; }
    res.status(200).json(SNAPSHOTS[office] || SNAPSHOTS.herndon);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
