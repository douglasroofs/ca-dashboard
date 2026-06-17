// api/doors.js — doors knocked per rep this month, from Sales Rabbit.
//
// DEFAULT: serves the SNAPSHOT below instantly (so the dashboard + Refresh
//   button are fast). The snapshot is refreshed by the daily scheduled task.
// ?live=1     : recompute fresh from Sales Rabbit (slow, ~25s). Used by the
//               daily refresh task to produce a new snapshot.
// ?debug=tally: attribution diagnostics for this month (names + counts only).
//
// A "door" = a pin owned by an allowed rep (DC Inbound + DC Self Gen),
// status NOT in {Closed, Do Not Knock, Drive By}, status-updated this month.

const SNAPSHOT = {
  updated: '2026-06-17T22:12:49.764Z',
  total: 2790,
  reps: [
    { rep: 'Andrew Funk', doors: 677 },
    { rep: 'Harvey Shoemaker', doors: 464 },
    { rep: 'Christian Brown', doors: 363 },
    { rep: 'Mike Mccarthy', doors: 299 },
    { rep: 'Aiden Glonek', doors: 248 },
    { rep: 'Izzy Price', doors: 245 },
    { rep: 'Jack Obert', doors: 230 },
    { rep: 'David Kerns', doors: 144 },
    { rep: 'Kelly Alston', doors: 67 },
    { rep: 'George Bechara', doors: 32 },
    { rep: 'Marc Mitchell', doors: 7 },
    { rep: 'Solomon Lincoln Jr.', doors: 7 },
    { rep: 'Andrew  Prickel', doors: 4 },
    { rep: 'Kevin Mahan', doors: 2 },
    { rep: 'Steven Arevalo', doors: 1 },
  ],
  allowedReps: ['steven arevalo', 'marc mitchell', 'andrew funk', 'michael mccarthy', 'george bechara', 'isabelle price', 'jack obert', 'harvey shoemaker', 'kevin mahan', 'robert wilson', 'andrew prickel', 'alfred duncan', 'christian brown', 'kelly alston', 'david kerns', 'aiden glonek', 'solomon lincoln jr.'],
  roster: ['Steven Arevalo', 'Marc Mitchell', 'Andrew Funk', 'Mike Mccarthy', 'George Bechara', 'Izzy Price', 'Jack Obert', 'Harvey Shoemaker', 'Kevin Mahan', 'Robert Wilson', 'Andrew Prickel', 'Alfred Duncan', 'Christian Brown', 'Kelly Alston', 'David Kerns', 'Aiden Glonek', 'Solomon Lincoln Jr.'],
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
function teamAllowed(t) {
  const n = norm(t);
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

async function compute() {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    name: pick(u, ['fullName']) ||
      [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() ||
      pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const allowedUsers = allUsers.filter((u) => teamAllowed(u.team) && u.active !== false);
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

  return { updated: new Date().toISOString(), total, reps, allowedReps: Array.from(allowedReps), roster, leadsScanned: leads.length };
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
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
      const top = Object.keys(byName).sort((a, b) => byName[b] - byName[a]).slice(0, 40).map((k) => k + ': ' + byName[k]);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ leadsScanned: leads.length, monthStart: start.toISOString(), topKnockable: top });
      return;
    }

    if (live === '1') {
      const data = await compute();
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    // Default: instant snapshot.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(SNAPSHOT);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
