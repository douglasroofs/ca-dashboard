// api/job-reps.js — resolve Leap job numbers to the job's assigned salesman.
// Reuses the same auth as revenue.js (login -> switch_company on Douglas Roofing).
//   GET /api/job-reps?nums=2606-8734090-01,2606-8731749-01,...
//     -> { "2606-8734090-01": "Andrew Prickel", ... }
//   GET /api/job-reps?debug=2606-8734090-01
//     -> raw job + reps shape so we can confirm which field is the salesman
//
// 2026-09-21: also hosts the PUNCH OUT board (Vercel Hobby caps api/ at 12 functions,
// so this lives here instead of its own file).
//   GET /api/job-reps?punchout=1            -> every open Herndon customer that is punched out: the
//                                              PUNCH OUT customer flag and/or a job in the Punch Out
//                                              stage, merged per customer, with age + bucket
//                                              0-3 / 4-7 / 8-14 / 15+ days
//   GET /api/job-reps?punchout=1&probe=<job number> -> that job's customer flags / stage (shape check)
//   GET /api/job-reps?punchout=1&probe=1&paths=/x,/y -> raw Leap GETs for exploration
// Age = earliest of the Punch Out stage entry date (stage_last_modified) or the night
// scripts/refresh-punchout.js first saw the customer flagged (data/punchout-ledger.json).
// Leap does not stamp when a flag was added.

const V1 = 'https://jobprogress.com/api/public/api/v1';
const CLIENT_ID = process.env.JP_CLIENT_ID || '12345';
const CLIENT_SECRET = process.env.JP_CLIENT_SECRET || 'XraqRySfIhUTuvdfz7ATuJxXYf8aX5MY';
const COMPANY_ID = process.env.JP_COMPANY_ID || '5154';

async function login() {
  const username = process.env.JP_USERNAME, password = process.env.JP_PASSWORD;
  if (!username || !password) throw new Error('JP_USERNAME / JP_PASSWORD not set');
  const res = await fetch(`${V1}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, end_existing_sessions: '0' }).toString(),
  });
  if (res.status === 412) throw new Error('Leap is refusing logins right now (412) - usually clears in a few minutes');
  if (!res.ok) throw new Error(`login -> ${res.status}`);
  const d = await res.json();
  return (d && d.token && d.token.access_token) || (d && d.access_token);
}
async function switchCompany(token) {
  const r = await fetch(`${V1}/users/switch_company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: COMPANY_ID }).toString(),
  });
  if (!r.ok && r.status !== 409) throw new Error(`switch_company -> ${r.status}`);
  return token;
}
let cachedToken = null, tokenPromise = null;
function getToken() {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (!tokenPromise) tokenPromise = (async () => { const t = await login(); cachedToken = await switchCompany(t); return cachedToken; })();
  return tokenPromise;
}
const HDR = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json', platform: 'web' });

async function fetchJob(token, num) {
  const qs = new URLSearchParams();
  qs.set('job_number', num);
  qs.append('includes[]', 'reps');
  qs.append('includes[]', 'customer');
  const res = await fetch(`${V1}/jobs?${qs.toString()}`, { headers: HDR(token) });
  if (!res.ok) return null;
  const j = await res.json();
  const arr = j.data || j.rows || [];
  return arr[0] || null;
}

// Pull the salesman name off a job. Adjust after we see the debug shape.
function nameOf(p) { return p ? (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null) : null; }
function salesmanOf(job) {
  if (!job) return null;
  // The assigned salesman is the customer's rep.
  const cr = job.customer && job.customer.rep;
  if (cr) return nameOf(cr);
  // fallbacks: job reps, then estimators
  const reps = (job.reps && job.reps.data) || job.reps || [];
  if (Array.isArray(reps) && reps[0]) return nameOf(reps[0]);
  const est = (job.estimators && job.estimators.data) || job.estimators || [];
  if (Array.isArray(est) && est[0]) return nameOf(est[0]);
  return null;
}


// ── PUNCH OUT board ─────────────────────────────────────────────────────────
// Two sources, merged per customer (a punch-out is really a customer-level thing):
//   A) customers carrying the PUNCH OUT *customer* flag (id 32538)  -> /customers?flag_ids[]=
//   B) jobs sitting in the "Punch Out" stage (code 1769622271876028355) -> /jobs?stages[]=
// Leap stamps a stage change (stage_last_modified) but never says WHEN a flag was applied, so a
// flag-only customer's age comes from data/punchout-ledger.json: scripts/refresh-punchout.js runs
// nightly in the Refresh SR snapshots Action and records the first night each customer was seen.
let LEDGER = { updated: null, customers: {}, resolved: [] };
try { LEDGER = require('../data/punchout-ledger.json'); } catch (e) { /* first deploy: no ledger yet */ }
const FLAG_ID = process.env.PUNCHOUT_FLAG_ID || '32538';
const STAGE_CODE = process.env.PUNCHOUT_STAGE_CODE || '1769622271876028355';
const FLAG_RE = /punch\s*out/i;
const unwrap = (x) => (x && x.data !== undefined) ? x.data : x;
const listOf = (x) => { const u = unwrap(x); return Array.isArray(u) ? u : []; };

// Leap allows ONE session per account: every fresh login silently kills the token every
// other warm lambda holds, and a login storm ends in Leap answering 412 on /login for a
// while (seen 2026-09-21). So: retry the SAME token first, re-login at most once per
// request, and give up cleanly rather than looping.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function leapGet(token, path) {
  let last = null, relogged = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt === 1 || attempt === 2) await sleep(1200 * attempt);
    if (attempt === 3) {
      if (relogged) break;
      relogged = true; cachedToken = null; tokenPromise = null; await sleep(1500); token = await getToken();
    }
    const r = await fetch(`${V1}${path}`, { headers: HDR(token) });
    if (r.ok) return r.json();
    last = r.status;
    if (![401, 403, 409, 429, 500, 502, 503].includes(r.status)) break;
  }
  throw new Error(`Leap ${path.split('?')[0]} -> ${last}`);
}
async function leapAll(token, path, maxPages = 10) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await leapGet(token, `${path}&page=${page}`);
    const arr = j.data || [];
    out.push(...arr);
    const pg = j.meta && j.meta.pagination;
    if (!arr.length || (pg && pg.current_page >= pg.total_pages) || arr.length < 100) break;
  }
  return out;
}
async function tryGet(token, path) {
  try { const r = await fetch(`${V1}${path}`, { headers: HDR(token) }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {} return { status: r.status, json: j, text: j ? undefined : text.slice(0, 300) }; }
  catch (e) { return { status: 0, error: String(e.message || e) }; }
}

const nyToday = () => new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()) + 'T12:00:00Z');
function ageDays(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  return Math.max(0, Math.round((nyToday() - d) / 86400000));
}
function bucketOf(days) {
  if (days == null) return 'unknown';
  if (days <= 3) return '0-3'; if (days <= 7) return '4-7'; if (days <= 14) return '8-14'; return '15+';
}
function addrOf(a) {
  a = unwrap(a) || {};
  const line = [a.address, a.city, a.state_name || (a.state && a.state.code) || a.state].filter(Boolean).join(', ');
  return line || null;
}
function custName(c) {
  c = unwrap(c) || {};
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || 'Unknown';
}
const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);
function jobRow(j) {
  const est = listOf(j.estimators).map(nameOf).map(clean).filter(Boolean);
  // Work crew = sub-contractors on the job. Show the company when it isn't just the person's name.
  const crew = listOf(j.sub_contractors).map((sc) => { const n = clean(nameOf(sc)), co = clean(sc.company_name); return co && co.toLowerCase() !== (n || '').toLowerCase() && !(n || '').toLowerCase().startsWith(co.toLowerCase()) ? `${co} (${n})` : (co || n); }).filter(Boolean);
  const stage = j.current_stage && j.current_stage.name || null;
  return {
    id: j.id, number: j.number, name: clean(j.name), stage, stage_date: j.stage_last_modified || null,
    in_stage: FLAG_RE.test(String(stage || '')), pm: est.join(', ') || null, crew: crew.join(', ') || null,
    division: (unwrap(j.division) || {}).name || j.division_code || null, archived: !!j.archived, updated_at: j.updated_at || null,
  };
}

async function punchout(req, res, url) {
  const token = await getToken();
  const probe = url.searchParams.get('probe');
  if (probe) {
    const out = {};
    const extra = (url.searchParams.get('paths') || '').split(',').map((x) => x.trim()).filter((x) => /^\/[a-z0-9_\/-]+(\?[a-z0-9_=&\[\]%.-]+)?$/i.test(x));
    for (const p of extra) out[p] = await tryGet(token, p);
    if (probe !== '1') {
      const j = await tryGet(token, `/jobs?job_number=${encodeURIComponent(probe)}&limit=1&includes[]=customer&includes[]=customer.flags&includes[]=estimators`);
      const job = (j.json && j.json.data || [])[0] || null;
      out.job = job ? { id: job.id, number: job.number, customer_flags: (unwrap(job.customer) || {}).flags, current_stage: job.current_stage, stage_last_modified: job.stage_last_modified, keys: Object.keys(job) } : j;
    }
    return res.status(200).json(out);
  }

  const CUST_INC = ['jobs', 'jobs.sub_contractors', 'rep', 'address', 'flags'].map((x) => `includes[]=${x}`).join('&');
  const JOB_INC = ['customer', 'customer.rep', 'customer.flags', 'estimators', 'sub_contractors', 'address', 'division'].map((x) => `includes[]=${x}`).join('&');
  // Sequential on purpose: two concurrent calls on one Leap token have produced 409s.
  const flagged = await leapAll(token, `/customers?flag_ids[]=${FLAG_ID}&limit=100&${CUST_INC}`);
  const staged = await leapAll(token, `/jobs?stages[]=${STAGE_CODE}&limit=100&with_archived=0&${JOB_INC}`);

  // Merge per customer.
  const byCust = new Map();
  const get = (cid, c) => {
    if (!byCust.has(cid)) byCust.set(cid, { customer_id: cid, customer: custName(c), rep: clean(nameOf(unwrap((unwrap(c) || {}).rep))) || 'Unassigned', address: addrOf((unwrap(c) || {}).address), flagged: false, in_stage: false, jobs: new Map() });
    return byCust.get(cid);
  };
  flagged.forEach((c) => {
    const row = get(c.id, c); row.flagged = true;
    listOf(c.jobs).forEach((j) => { if (!j.archived) row.jobs.set(j.id, jobRow(j)); });
  });
  staged.forEach((j) => {
    const c = unwrap(j.customer) || {}; const cid = j.customer_id || c.id;
    const row = get(cid, c);
    const jr = jobRow(j); jr.in_stage = true;
    if (!row.address) row.address = addrOf(j.address);
    const prev = row.jobs.get(j.id); row.jobs.set(j.id, Object.assign(prev || {}, jr));
    if ((unwrap(c.flags) || []).some((f) => FLAG_RE.test(String(f.title || f.name || '')))) row.flagged = true;
  });

  const rows = [];
  byCust.forEach((row) => {
    const jobs = [...row.jobs.values()].sort((a, b) => (b.in_stage - a.in_stage) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    row.in_stage = jobs.some((j) => j.in_stage);
    // Earliest evidence of the punch-out: stage entry date, else the night the ledger first saw the customer.
    const dates = [];
    jobs.forEach((j) => { if (j.in_stage && j.stage_date) dates.push({ date: j.stage_date, source: 'stage' }); });
    const led = LEDGER.customers && LEDGER.customers[String(row.customer_id)];
    if (led && led.first_seen) dates.push({ date: led.first_seen, source: 'ledger' });
    dates.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const since = dates[0] || null;
    const days = since ? ageDays(since.date) : null;
    const primary = jobs[0] || {};
    rows.push({
      customer_id: row.customer_id, customer: row.customer, rep: row.rep, address: row.address,
      source: row.flagged && row.in_stage ? 'both' : (row.flagged ? 'flag' : 'stage'),
      pm: jobs.map((j) => j.pm).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || null,
      crew: jobs.map((j) => j.crew).filter(Boolean).join(', ').split(', ').filter((v, i, a) => v && a.indexOf(v) === i).join(', ') || null,
      number: primary.number || null, stage: primary.stage || null, stage_date: primary.stage_date || null, division: primary.division || null,
      jobs: jobs.map((j) => ({ id: j.id, number: j.number, name: j.name, stage: j.stage, stage_date: j.stage_date, in_stage: j.in_stage, pm: j.pm, crew: j.crew })),
      since: since ? since.date : null, since_source: since ? since.source : null, first_seen: led ? led.first_seen : null,
      days, bucket: bucketOf(days),
      leap_url: `https://jobprogress.com/app/#/customer-jobs/${row.customer_id}${primary.id ? `/job/${primary.id}/overview` : ''}`,
    });
  });
  rows.sort((a, b) => (b.days == null ? -1 : b.days) - (a.days == null ? -1 : a.days));
  const buckets = { '0-3': 0, '4-7': 0, '8-14': 0, '15+': 0, unknown: 0 };
  rows.forEach((r) => { buckets[r.bucket] = (buckets[r.bucket] || 0) + 1; });
  res.status(200).json({
    updated: new Date().toISOString(), office: 'herndon', flag: { id: FLAG_ID, title: 'PUNCH OUT', for: 'customer' }, stage: { code: STAGE_CODE, name: 'Punch Out' },
    counts: { flagged: flagged.length, in_stage: staged.length, open: rows.length }, open: rows.length, buckets,
    ledger_updated: LEDGER.updated || null, resolved: (LEDGER.resolved || []).slice(-60), rows,
  });
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.searchParams.get('punchout') === '1') return await punchout(req, res, url);
    const debug = url.searchParams.get('debug');
    const token = await getToken();

    if (debug) {
      const qs = new URLSearchParams(); qs.set('job_number', debug);
      ['reps','estimators','customer','sub_contractors','division'].forEach((x) => qs.append('includes[]', x));
      const r = await fetch(`${V1}/jobs?${qs.toString()}`, { headers: HDR(token) });
      const j = await r.json();
      const job = (j.data || [])[0] || {};
      const repish = {}; Object.keys(job).forEach((k) => { if (/rep|sales|estimat|assign/i.test(k)) repish[k] = job[k]; });
      res.status(200).json({ status: r.status, repish, reps: job.reps, estimators: job.estimators, customer: job.customer ? { id: job.customer.id, rep: job.customer.rep, reps: job.customer.reps } : null });
      return;
    }

    const nums = (url.searchParams.get('nums') || '').split(',').map(s => s.trim()).filter(Boolean);
    const out = {};
    // resolve sequentially with a small delay to avoid rate-limit 401s
    for (let i = 0; i < nums.length; i++) {
      const job = await fetchJob(token, nums[i]);
      out[nums[i]] = salesmanOf(job) || 'Unknown';
      await new Promise((r) => setTimeout(r, 120));
    }
    res.status(200).json({ updated: new Date().toISOString(), reps: out });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
// Punch-out walks up to ~15 pages of jobs; the 10s default is not enough.
module.exports.config = { maxDuration: 60 };
