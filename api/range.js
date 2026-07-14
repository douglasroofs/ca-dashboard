// api/range.js — doors + CAs per rep for an ARBITRARY date range, live from Sales Rabbit.
//
// Purely additive: does NOT touch doors.js / ca-history.js / leap-extra.js or their snapshots.
// The MTD tabs keep using those snapshots by default; this endpoint is only hit when a user
// picks a custom date range.
//
// Counting rules are copied verbatim from the existing endpoints so numbers align:
//   doors = every lead status-history event, status NOT in {Closed, Do Not Knock, Drive By},
//           credited to changedByUserId, team scope = doors scope (inbound / self-gen / jack).
//   CAs   = distinct lead that reached ICA or SGCA, credited to changedByUserId,
//           team scope = Storm only (Herndon: DC Self Gen or Jack; Richmond: Richmond Storm).
//
// GET /api/range?office=herndon|richmond&start=YYYY-MM-DD&end=YYYY-MM-DD

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE_NORM = new Set(['closed', 'donotknock', 'driveby']);
const CA_NORM = new Set(['ica', 'sgca']);
const SR_ALIAS = { 'mike mccarthy': 'michael mccarthy', 'izzy price': 'isabelle price', 'robert mumford-wilson': 'robert wilson' };
const CAP = 2000;

function tok() { const t = process.env.SALESRABBIT_TOKEN; if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel'); return t; }
async function srGet(path, headers) { const res = await fetch(BASE + path, { headers: Object.assign({ Authorization: 'Bearer ' + tok(), Accept: 'application/json' }, headers || {}) }); const text = await res.text(); let json; try { json = JSON.parse(text); } catch (_) { json = text; } return { status: res.status, json }; }
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function teamAllowed(t, office) { const n = norm(t); if (office === 'richmond') return n.indexOf('richmond') > -1; return n.indexOf('inbound') > -1 || (n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('jack') > -1; }
function stormAllowed(t, office) { const n = norm(t); if (office === 'richmond') return n.indexOf('richmond') > -1 && n.indexOf('storm') > -1; return (n.indexOf('self') > -1 && n.indexOf('gen') > -1) || n.indexOf('jack') > -1; }

async function compute(office, start, end) {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    id: String(pick(u, ['id'])),
    name: pick(u, ['fullName']) || [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() || pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const live = allUsers.filter((u) => u.active !== false);
  const doorsById = {}; live.filter((u) => teamAllowed(u.team, office)).forEach((u) => { doorsById[u.id] = repKey(u.name); });
  const caById = {}; live.filter((u) => stormAllowed(u.team, office)).forEach((u) => { caById[u.id] = repKey(u.name); });
  const display = {}; live.forEach((u) => { display[repKey(u.name)] = u.name; });

  const hdr = { 'If-Status-Modified-Since': start.toISOString() };
  const doors = {}; const cas = {};
  const seenLead = new Set(); const seenCa = new Set();
  let doorsTotal = 0, caTotal = 0, eventsScanned = 0, pages = 0;
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
        const d = new Date(ev.statusUpdated || 0);
        if (isNaN(d) || d < start || d > end) continue;
        const st = statusNorm(ev.name);
        const dk = doorsById[String(ev.changedByUserId)];
        if (dk && !EXCLUDE_NORM.has(st)) { doors[dk] = (doors[dk] || 0) + 1; doorsTotal++; }
        const ck = caById[String(ev.changedByUserId)];
        if (ck && CA_NORM.has(st)) { const key = ck + '|' + lid; if (!seenCa.has(key)) { seenCa.add(key); cas[ck] = (cas[ck] || 0) + 1; caTotal++; } }
      }
    }
    if (fresh === 0) break;
  }
  const keys = {};
  Object.keys(doors).forEach((k) => { keys[k] = 1; });
  Object.keys(cas).forEach((k) => { keys[k] = 1; });
  const reps = Object.keys(keys)
    .map((k) => ({ rep: display[k] || k, doors: doors[k] || 0, cas: cas[k] || 0 }))
    .sort((a, b) => (b.doors - a.doors) || (b.cas - a.cas));
  return { office, totals: { doors: doorsTotal, cas: caTotal }, reps, eventsScanned, pages, leadsScanned: seenLead.size, updated: new Date().toISOString() };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'http://localhost');
    const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
    const s = url.searchParams.get('start') || '';
    const e = url.searchParams.get('end') || '';
    const RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!RE.test(s) || !RE.test(e)) { res.status(400).json({ error: 'start and end are required as YYYY-MM-DD' }); return; }
    const start = new Date(s + 'T00:00:00.000Z');
    const end = new Date(e + 'T23:59:59.999Z');
    if (end < start) { res.status(400).json({ error: 'end date is before start date' }); return; }
    const data = await compute(office, start, end);
    data.start = s; data.end = e;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
