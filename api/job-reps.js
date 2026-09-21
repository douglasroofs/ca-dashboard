// api/job-reps.js — resolve Leap job numbers to the job's assigned salesman.
// Reuses the same auth as revenue.js (login -> switch_company on Douglas Roofing).
//   GET /api/job-reps?nums=2606-8734090-01,2606-8731749-01,...
//     -> { "2606-8734090-01": "Andrew Prickel", ... }
//   GET /api/job-reps?debug=2606-8734090-01
//     -> raw job + reps shape so we can confirm which field is the salesman
//
// 2026-09-21: also hosts the PUNCH OUT board (Vercel Hobby caps api/ at 12 functions,
// so this lives here instead of its own file).
//   GET /api/job-reps?punchout=1            -> every open Herndon job carrying the PUNCH OUT flag,
//                                              with an age (days) and bucket 0-3 / 4-7 / 8-14 / 15+
//   GET /api/job-reps?punchout=1&raw=1      -> same, plus the raw ids the nightly ledger script needs
//   GET /api/job-reps?punchout=1&probe=1    -> flag / stage catalogue + one sample job (shape discovery)
// Age = earliest of: a flag-applied date if Leap ever returns one, the date the job entered a
// "Punch Out" stage (stage_last_modified), or the night scripts/refresh-punchout.js first saw the
// job flagged (data/punchout-ledger.json). Leap does not stamp when a flag was added.

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
  if (!res.ok) throw new Error(`login -> ${res.status}`);
  const d = await res.json();
  return (d && d.token && d.token.access_token) || (d && d.access_token);
}
async function switchCompany(token) {
  await fetch(`${V1}/users/switch_company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: COMPANY_ID }).toString(),
  });
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
let LEDGER = { updated: null, jobs: {} };
try { LEDGER = require('../data/punchout-ledger.json'); } catch (e) { /* first deploy: no ledger yet */ }
const FLAG_RE = /punch\s*out/i;
const PO_INCLUDES = ['customer', 'customer.rep', 'reps', 'estimators', 'division', 'flags', 'address', 'trades'];
const poQS = () => PO_INCLUDES.map((x) => `includes[]=${x}`).join('&');
const unwrap = (x) => (x && x.data !== undefined) ? x.data : x;
const listOf = (x) => { const u = unwrap(x); return Array.isArray(u) ? u : []; };

async function leapGet(token, path) {
  const r = await fetch(`${V1}${path}`, { headers: HDR(token) });
  if (r.status === 401 || r.status === 403 || r.status === 409) {
    cachedToken = null; tokenPromise = null;
    const t2 = await getToken();
    const r2 = await fetch(`${V1}${path}`, { headers: HDR(t2) });
    if (!r2.ok) throw new Error(`Leap ${path.split('?')[0]} -> ${r2.status}`);
    return r2.json();
  }
  if (!r.ok) throw new Error(`Leap ${path.split('?')[0]} -> ${r.status}`);
  return r.json();
}
async function tryGet(token, path) {
  try { const r = await fetch(`${V1}${path}`, { headers: HDR(token) }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {} return { status: r.status, json: j, text: j ? undefined : text.slice(0, 300) }; }
  catch (e) { return { status: 0, error: String(e.message || e) }; }
}

// Find the PUNCH OUT flag id in Leap's flag catalogue (several v1 spellings exist).
async function findFlag(token) {
  for (const path of ['/flags?for=job&limit=200', '/flags?limit=200', '/jobs/flags?limit=200']) {
    const r = await tryGet(token, path);
    const arr = r.json ? listOf(r.json) : [];
    const hit = arr.find((f) => FLAG_RE.test(String(f.title || f.name || f.label || '')));
    if (hit) return { id: hit.id, title: hit.title || hit.name || hit.label, source: path };
    if (arr.length) return { id: null, source: path, titles: arr.map((f) => f.title || f.name || f.label).slice(0, 60) };
  }
  return { id: null, source: null };
}

function flagsOf(job) {
  const raw = job.flags && (job.flags.data || job.flags);
  return Array.isArray(raw) ? raw : [];
}
function hasPunchOut(job) {
  return flagsOf(job).some((f) => FLAG_RE.test(String((f && (f.title || f.name || f.label)) || (f && f.flag && (f.flag.title || f.flag.name)) || '')))
    || FLAG_RE.test(String(job.current_stage && job.current_stage.name || ''));
}
// Leap has no "flag applied" timestamp; take the earliest evidence we have.
function flagDateOf(job) {
  const dates = [];
  flagsOf(job).forEach((f) => {
    const d = f && (f.created_at || f.updated_at || (f.pivot && f.pivot.created_at));
    if (d && FLAG_RE.test(String((f.title || f.name || f.label) || (f.flag && (f.flag.title || f.flag.name)) || ''))) dates.push({ date: d, source: 'flag' });
  });
  if (job.current_stage && FLAG_RE.test(String(job.current_stage.name || '')) && job.stage_last_modified) dates.push({ date: job.stage_last_modified, source: 'stage' });
  const led = LEDGER.jobs && LEDGER.jobs[String(job.id)];
  if (led && led.first_seen) dates.push({ date: led.first_seen, source: 'ledger' });
  dates.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return dates[0] || null;
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
function addrOf(job) {
  const a = unwrap(job.address) || {};
  const line = [a.address, a.city, a.state_name || (a.state && a.state.code) || a.state].filter(Boolean).join(', ');
  return line || null;
}
function repFromCustomer(job) {
  const c = unwrap(job.customer) || {};
  const p = unwrap(c.rep);
  return nameOf(p) || salesmanOf(job) || 'Unassigned';
}
function customerNameOf(job) {
  const c = unwrap(job.customer) || {};
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || job.customer_name || 'Unknown';
}
function pmOf(job) {
  // Production side: estimators list is where Herndon assigns the production manager / project lead.
  const est = listOf(job.estimators);
  return est.length ? est.map(nameOf).filter(Boolean).join(', ') : null;
}

async function pullFlagged(token, flag) {
  const jobs = [];
  const seen = new Set();
  const push = (arr) => arr.forEach((j) => { if (j && !seen.has(j.id)) { seen.add(j.id); jobs.push(j); } });
  // 1) server-side flag filter, when we know the id
  if (flag && flag.id) {
    for (const key of ['flag_ids[]', 'flags[]']) {
      for (let page = 1; page <= 10; page++) {
        const r = await tryGet(token, `/jobs?${key}=${flag.id}&limit=100&page=${page}&with_archived=0&${poQS()}`);
        const arr = r.json ? (r.json.data || []) : [];
        if (!r.json || r.status !== 200) break;
        push(arr.filter(hasPunchOut));
        if (arr.length < 100) break;
      }
      if (jobs.length) return { jobs, method: key };
    }
  }
  // 2) fallback: walk jobs touched in the last 120 days and keep the flagged ones
  const end = new Date(), start = new Date(Date.now() - 120 * 86400000);
  const ymd = (d) => d.toISOString().slice(0, 10);
  for (let page = 1; page <= 15; page++) {
    const j = await leapGet(token, `/jobs?date_range_type=job_updated_date&start_date=${ymd(start)}&end_date=${ymd(end)}&limit=100&page=${page}&with_archived=0&${poQS()}`);
    const arr = j.data || [];
    push(arr.filter(hasPunchOut));
    if (arr.length < 100) break;
  }
  return { jobs, method: 'scan:job_updated_date:120d' };
}

async function punchout(req, res, url) {
  const token = await getToken();
  const probe = url.searchParams.get('probe');
  if (probe) {
    const out = { flag: await findFlag(token) };
    const extra = (url.searchParams.get('paths') || '').split(',').map((x) => x.trim()).filter((x) => /^\/[a-z0-9_\/-]+(\?[a-z0-9_=&\[\]%.-]+)?$/i.test(x));
    for (const p of ['/flags?for=job&limit=200', '/job_flags', '/jobs/flag', '/flags?type=job', '/company/flags', '/customers/flags', ...extra]) out[p] = await tryGet(token, p);
    // jobs sitting in the Punch Out STAGE, with their flags -- the likeliest place to see a flag's shape
    const st = await tryGet(token, `/jobs?stages[]=1769622271876028355&limit=20&${poQS()}`);
    out.punchOutStageJobs = (st.json && st.json.data || []).map((j) => ({ id: j.id, number: j.number, flags: j.flags, stage: j.current_stage && j.current_stage.name, stage_last_modified: j.stage_last_modified, estimators: listOf(j.estimators).map(nameOf), rep: repFromCustomer(j) }));
    const s = await tryGet(token, `/jobs?limit=3&with_archived=0&${poQS()}`);
    const sample = (s.json && s.json.data || [])[0] || null;
    out.sampleKeys = sample ? Object.keys(sample) : null;
    out.sampleFlags = sample ? sample.flags : null;
    out.sampleStage = sample ? { current_stage: sample.current_stage, stage_last_modified: sample.stage_last_modified } : null;
    out.sampleAddress = sample ? sample.address : null;
    if (probe === 'scan') {
      // walk recently-updated jobs under a few include spellings and report any job with a non-empty flag list
      const found = [];
      const end = new Date(), start = new Date(Date.now() - 60 * 86400000);
      const ymd = (d) => d.toISOString().slice(0, 10);
      for (const inc of ['flags', 'job_flags', 'flag', 'customer.flags']) {
        for (let page = 1; page <= 4; page++) {
          const r = await tryGet(token, `/jobs?date_range_type=job_updated_date&start_date=${ymd(start)}&end_date=${ymd(end)}&limit=100&page=${page}&includes[]=${inc}&includes[]=customer`);
          const arr = (r.json && r.json.data) || [];
          arr.forEach((j) => {
            const cands = { flags: j.flags, job_flags: j.job_flags, flag: j.flag, customer_flags: j.customer && j.customer.flags };
            Object.keys(cands).forEach((k) => { const v = cands[k]; const list = v && (v.data || v); if (Array.isArray(list) && list.length) found.push({ inc, key: k, id: j.id, number: j.number, stage: j.current_stage && j.current_stage.name, value: list.slice(0, 3) }); });
          });
          if (arr.length < 100) break;
        }
        if (found.length) break;
      }
      out.scan = { found: found.slice(0, 15), count: found.length };
    } else if (probe !== '1') { // probe=<job number> -> that job's flags block
      const j = await tryGet(token, `/jobs?job_number=${encodeURIComponent(probe)}&limit=1&${poQS()}`);
      const job = (j.json && j.json.data || [])[0] || null;
      out.job = job ? { id: job.id, number: job.number, flags: job.flags, current_stage: job.current_stage, stage_last_modified: job.stage_last_modified, keys: Object.keys(job) } : j;
    }
    return res.status(200).json(out);
  }
  const flag = await findFlag(token);
  const { jobs, method } = await pullFlagged(token, flag);
  const rows = jobs.map((job) => {
    const fd = flagDateOf(job);
    const days = fd ? ageDays(fd.date) : null;
    const led = LEDGER.jobs && LEDGER.jobs[String(job.id)];
    return {
      id: job.id, number: job.number, customer: customerNameOf(job), address: addrOf(job),
      rep: repFromCustomer(job), pm: pmOf(job),
      division: (unwrap(job.division) || {}).name || null,
      stage: job.current_stage && job.current_stage.name || null, stage_date: job.stage_last_modified || null,
      flagged_since: fd ? fd.date : null, flagged_source: fd ? fd.source : null,
      first_seen: led ? led.first_seen : null,
      days, bucket: bucketOf(days),
      flags: flagsOf(job).map((f) => (f && (f.title || f.name || f.label)) || (f && f.flag && (f.flag.title || f.flag.name)) || null).filter(Boolean),
      leap_url: `https://jobprogress.com/app/#/customer-jobs/${job.customer_id || (unwrap(job.customer) || {}).id || ''}/job/${job.id}/overview`,
    };
  }).sort((a, b) => (b.days == null ? -1 : b.days) - (a.days == null ? -1 : a.days));
  const buckets = { '0-3': 0, '4-7': 0, '8-14': 0, '15+': 0, unknown: 0 };
  rows.forEach((r) => { buckets[r.bucket] = (buckets[r.bucket] || 0) + 1; });
  const out = {
    updated: new Date().toISOString(), office: 'herndon', flag: flag && flag.id ? { id: flag.id, title: flag.title } : null,
    method, open: rows.length, buckets, ledger_updated: LEDGER.updated || null,
    resolved: (LEDGER.resolved || []).slice(-60),
    jobs: rows,
  };
  if (url.searchParams.get('raw') === '1') out.ids = rows.map((r) => ({ id: r.id, number: r.number, customer: r.customer, rep: r.rep }));
  res.status(200).json(out);
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
