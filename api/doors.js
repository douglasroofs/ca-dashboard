// api/doors.js -- doors knocked per rep this month, from Sales Rabbit.
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
    "updated": "2026-09-05T15:11:37.984Z",
    "total": 487,
    "reps": [
      {
        "rep": "Carol Wright",
        "doors": 140,
        "team": "jack"
      },
      {
        "rep": "Jason Cresswell",
        "doors": 100,
        "team": "jack"
      },
      {
        "rep": "David Kerns",
        "doors": 97,
        "team": "jack"
      },
      {
        "rep": "Harvey Shoemaker",
        "doors": 68,
        "team": "selfgen"
      },
      {
        "rep": "Izzy Price",
        "doors": 59,
        "team": "jack"
      },
      {
        "rep": "Andrew Funk",
        "doors": 13,
        "team": "selfgen"
      },
      {
        "rep": "Mike Mccarthy",
        "doors": 6,
        "team": "mccarthy"
      },
      {
        "rep": "George Bechara",
        "doors": 2,
        "team": "selfgen"
      },
      {
        "rep": "Marc Mitchell",
        "doors": 1,
        "team": "selfgen"
      },
      {
        "rep": "Christian Brown",
        "doors": 1,
        "team": "selfgen"
      }
    ],
    "allowedReps": [
      "kyle higginbotham",
      "adam mulvaney",
      "terry eggleston",
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
      "mike schoultz",
      "sean beasy",
      "nick seward",
      "christian brown",
      "david kerns",
      "carol wright",
      "jason cresswell",
      "liz charles",
      "doug co",
      "doug coffman"
    ],
    "roster": [
      "Kyle Higginbotham",
      "Adam Mulvaney",
      "Terry Eggleston",
      "Kyle Higginbotham",
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
      "mike schoultz",
      "sean beasy",
      "nick seward",
      "Christian Brown",
      "David Kerns",
      "Carol Wright",
      "Jason Cresswell",
      "liz charles",
      "Doug Co",
      "Doug Coffman"
    ]
  },
  "richmond": {
    "updated": "2026-09-05T15:11:38.645Z",
    "total": 545,
    "reps": [
      {
        "rep": "Kylea White",
        "doors": 297,
        "team": "retail"
      },
      {
        "rep": "Dalton Barr",
        "doors": 111,
        "team": "retail"
      },
      {
        "rep": "Andrew Harris",
        "doors": 48,
        "team": "retail"
      },
      {
        "rep": "Carter Massengill",
        "doors": 42,
        "team": "retail"
      },
      {
        "rep": "Travis Kizzar",
        "doors": 36,
        "team": "selfgen"
      },
      {
        "rep": "Felipe Osorio",
        "doors": 11,
        "team": "retail"
      }
    ],
    "allowedReps": [
      "justin coghill",
      "brandon simmons",
      "travis kizzar",
      "joshua baca",
      "carter massengill",
      "andrew harris",
      "dalton barr",
      "marcus schanewolf",
      "felipe osorio",
      "kylea white",
      "james washington"
    ],
    "roster": [
      "Justin Coghill",
      "Brandon Simmons",
      "Travis Kizzar",
      "Joshua Baca",
      "Carter Massengill",
      "Andrew Harris",
      "Dalton Barr",
      "marcus schanewolf",
      "Felipe Osorio",
      "Kylea White",
      "James Washington"
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
function teamLabel(t) { const n = norm(t); if (!n) return 'noteam'; if (n.indexOf('mccarthy') > -1) return 'mccarthy'; if (n.indexOf('jack') > -1) return 'jack'; if (n.indexOf('inbound') > -1) return 'inbound'; if (n.indexOf('retail') > -1) return 'retail'; if ((n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('storm') > -1) return 'selfgen'; return 'other'; }
// A blank SalesRabbit team used to fail this test, which silently dropped the
// rep AND every door they knocked from the company total - they simply were
// not on the dashboard. Blank now counts as Herndon and surfaces as its own
// "No team set" group, so the gap is visible here instead of hidden. Richmond
// stays strict: a rep with no team cannot be assumed to be Richmond's.
function teamAllowed(t, office) { const n = norm(t); if (office === 'richmond') return n.indexOf('richmond') > -1; return !n || n.indexOf('inbound') > -1 || (n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('jack') > -1 || n.indexOf('mccarthy') > -1; }

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
  const teamByRep = {}; allowedUsers.forEach((u) => { teamByRep[repKey(u.name)] = teamLabel(u.team); });

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
  const reps = Object.keys(counts).map((k) => ({ rep: display[k] || k, doors: counts[k], team: teamByRep[k] || 'other' })).sort((a, b) => b.doors - a.doors);
  return { updated: new Date().toISOString(), total, reps, teamByRep, allowedReps: Array.from(allowedReps), roster, eventsScanned, leadsScanned: seenLead.size, office };
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
    // LIVE BY DEFAULT (2026-08-24). This used to serve a snapshot baked into
    // this file, refreshed by a "daily task" that never existed - so the numbers
    // silently froze on 2026-08-17 and drifted 24% low. Herndon read 2,188
    // against a true 3,165, and five reps who were out knocking showed ZERO
    // doors. A rep losing credit for a month of work is a much worse outcome
    // than a page that takes three seconds.
    //
    // The snapshot survives only as a fallback for when Sales Rabbit is
    // unreachable, and every response now says which one you are looking at.
    // ?snapshot=1 forces the old instant path; ?live=1 is the default and is
    // kept working so existing links do not break.
    if (url.searchParams.get('snapshot') === '1' && live !== '1') {
      res.status(200).json(Object.assign({ source: 'snapshot' }, SNAPSHOTS[office] || SNAPSHOTS.herndon));
      return;
    }
    try {
      const data = await compute(office);
      data.source = 'live';
      res.status(200).json(data);
    } catch (e) {
      // Never fail the panel outright - stale numbers beat a blank card, as
      // long as the card can tell you they are stale.
      const snap = SNAPSHOTS[office] || SNAPSHOTS.herndon;
      res.status(200).json(Object.assign({}, snap, {
        source: 'snapshot-fallback',
        staleReason: 'Sales Rabbit live pull failed: ' + String((e && e.message) || e),
      }));
    }
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};

// A live Sales Rabbit pull is ~3s; the 10s default leaves no headroom.
module.exports.config = { maxDuration: 30 };
