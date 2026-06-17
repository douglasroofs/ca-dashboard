// api/job-reps.js — resolve Leap job numbers to the job's assigned salesman.
// Reuses the same auth as revenue.js (login -> switch_company on Douglas Roofing).
//   GET /api/job-reps?nums=2606-8734090-01,2606-8731749-01,...
//     -> { "2606-8734090-01": "Andrew Prickel", ... }
//   GET /api/job-reps?debug=2606-8734090-01
//     -> raw job + reps shape so we can confirm which field is the salesman

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

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
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
    const batch = 5;
    for (let i = 0; i < nums.length; i += batch) {
      const slice = nums.slice(i, i + batch);
      const jobs = await Promise.all(slice.map(n => fetchJob(token, n)));
      slice.forEach((n, k) => { out[n] = salesmanOf(jobs[k]) || 'Unknown'; });
    }
    res.status(200).json({ updated: new Date().toISOString(), reps: out });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
