// api/ca-history.js — monthly CA counts (ICA + SGCA pins) per rep, from Sales Rabbit.
//
// A "CA" for bonus tracking = a SalesRabbit pin whose status is ICA or SGCA.
// Bucketed by the month its status was set (statusModified), per rep, scoped to the
// office's Storm team. This is the source for BOTH offices (Leap historical CA is
// incomplete after the recent switch to tracking CAs in Leap).
//
// ?office=herndon|richmond   Storm scope: Herndon = DC Self Gen, Richmond = Richmond Storm.
// ?live=1[&year=YYYY] : recompute the year from Sales Rabbit (slow). Used by backfill / daily task.
// ?debug=probe        : test the leadStatus filter + show the CA status names returned.
// default             : serve the stored SNAPSHOT for the office.

const SNAPSHOTS = {
  herndon: { updated: null, year: null, months: [], reps: [] },
  richmond: { updated: null, year: null, months: [], reps: [] },
};

const BASE = 'https://api.salesrabbit.com';
const CA_NORM = new Set(['ica', 'sgca']);
const SR_ALIAS = {
  'mike mccarthy': 'michael mccarthy',
  'izzy price': 'isabelle price',
  'robert mumford-wilson': 'robert wilson',
};
const CAP = 2000;

function tok() { const t = process.env.SALESRABBIT_TOKEN; if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel'); return t; }
async function srGet(path, headers) {
  const res = await fetch(BASE + path, { headers: Object.assign({ Authorization: 'Bearer ' + tok(), Accept: 'application/json' }, headers || {}) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: res.status, json };
}
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function stormAllowed(team, office) {
  const n = norm(team);
  if (office === 'richmond') return n.indexOf('richmond') > -1 && n.indexOf('storm') > -1;
  return n.indexOf('self') > -1 && n.indexOf('gen') > -1; // Herndon Storm = DC Self Gen
}

// Fetch ICA + SGCA pins whose status changed since `since`. Uses the server-side
// leadStatus filter for speed; the code re-checks status to stay correct regardless.
async function caLeadsSince(since) {
  const out = [];
  const seen = new Set();
  const hdr = { 'If-Status-Modified-Since': since.toISOString() };
  for (const stName of ['ICA', 'SGCA']) {
    for (let page = 1; page <= 40; page++) {
      const r = await srGet('/leads?leadStatus=' + encodeURIComponent(stName) + '&perPage=' + CAP + '&page=' + page, hdr);
      const leads = arr(r.json);
      if (!leads.length) break;
      for (const ld of leads) { const id = pick(ld, ['id']); if (id != null && seen.has(id)) continue; if (id != null) seen.add(id); out.push(ld); }
      if (leads.length < CAP) break;
    }
  }
  return out;
}

async function compute(office, year) {
  const usersRes = await srGet('/users');
  const allUsers = arr(usersRes.json).map((u) => ({
    name: pick(u, ['fullName']) || [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() || pick(u, ['name', 'email']) || '',
    team: pick(u, ['team']) || '',
    active: pick(u, ['active']),
  }));
  const storm = allUsers.filter((u) => stormAllowed(u.team, office) && u.active !== false);
  const allowed = new Set(storm.map((u) => repKey(u.name)));
  const display = {}; storm.forEach((u) => { display[repKey(u.name)] = u.name; });

  const yearStart = new Date(year, 0, 1);
  const leads = await caLeadsSince(yearStart);

  const counts = {}; // counts[rep] = [12 months]
  const seen = new Set();
  leads.forEach((ld) => {
    const rk = repKey(pick(ld, ['userName']) || '');
    if (!allowed.has(rk)) return;
    const st = statusNorm(pick(ld, ['status']));
    if (!CA_NORM.has(st)) return;
    const sm = new Date(pick(ld, ['statusModified']) || 0);
    if (isNaN(sm) || sm.getFullYear() !== year) return;
    const id = pick(ld, ['id']); if (id != null) { if (seen.has(id)) return; seen.add(id); }
    if (!counts[rk]) counts[rk] = new Array(12).fill(0);
    counts[rk][sm.getMonth()]++;
  });

  const now = new Date();
  const lastMonth = (year === now.getFullYear()) ? now.getMonth() : 11;
  const months = []; for (let m = 0; m <= lastMonth; m++) months.push(m);
  const reps = Object.keys(counts).map((rk) => {
    const c = counts[rk]; const total = c.reduce((a, b) => a + b, 0);
    return { rep: display[rk] || rk, counts: months.map((m) => c[m]), total };
  }).sort((a, b) => b.total - a.total);

  return { office, year, updated: new Date().toISOString(), months, reps, leadsScanned: leads.length };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://localhost');
    const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
    const year = parseInt(url.searchParams.get('year') || '', 10) || new Date().getFullYear();
    const live = url.searchParams.get('live');
    const debug = url.searchParams.get('debug');

    if (debug === 'probe') {
      const since = new Date(new Date().getFullYear(), 0, 1);
      const hdr = { 'If-Status-Modified-Since': since.toISOString() };
      const variants = {
        leadStatus_name: '/leads?leadStatus=ICA&perPage=8',
        status_name: '/leads?status=ICA&perPage=8',
        statusId21: '/leads?statusId=21&perPage=8',
        leadStatusId21: '/leads?leadStatusId=21&perPage=8',
        filter_status: '/leads?' + encodeURIComponent('filter[status]') + '=ICA&perPage=8',
        filter_statusId: '/leads?' + encodeURIComponent('filter[statusId]') + '=21&perPage=8',
      };
      const out = {};
      for (const k of Object.keys(variants)) {
        const rr = await srGet(variants[k], hdr);
        const aa = arr(rr.json);
        out[k] = { status: rr.status, count: aa.length, statuses: aa.slice(0, 8).map((l) => pick(l, ['status'])) };
      }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(out);
      return;
    }

    if (live === '1') {
      const data = await compute(office, year);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(SNAPSHOTS[office] || SNAPSHOTS.herndon);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
