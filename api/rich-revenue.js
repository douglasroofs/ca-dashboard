// api/rich-revenue.js - Richmond revenue, computed from JOB-LEVEL data.
// Mirrors api/revenue.js. See that file for why the per-rep Sales Performance
// Summary report is not usable: it credits upgrade sellers a second time on
// jobs that already belong to the base rep. /reports/job_listing returns ONE
// ROW PER JOB with the customer rep attached, so that cannot happen.
//
// Company 6026 (Richmond) is bound with switch_company after login.
// Response keeps the old field names (reps[].approved / .contract) so
// richmond.html needs no changes.
//
// ?month=YYYY-MM | ?start=&end= | ?duration=YTD | default MTD | ?debug=1
const V1 = 'https://jobprogress.com/api/public/api/v1';
const CO = process.env.JP_RICHMOND_COMPANY_ID || '6026';

async function login() {
  const u = process.env.JP_USERNAME, p = process.env.JP_PASSWORD;
  const ci = process.env.JP_CLIENT_ID, cs = process.env.JP_CLIENT_SECRET;
  if (!u || !p) throw new Error('JP_USERNAME / JP_PASSWORD not set in Vercel');
  if (!ci || !cs) throw new Error('JP_CLIENT_ID / JP_CLIENT_SECRET not set in Vercel');
  const r = await fetch(V1 + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username: u, password: p, grant_type: 'password', client_id: ci, client_secret: cs, end_existing_sessions: '0' }).toString(),
  });
  if (!r.ok) throw new Error('login -> ' + r.status);
  const d = await r.json();
  const t = (d && d.token && d.token.access_token) || (d && d.access_token);
  if (!t) throw new Error('login ok but no access_token');
  return t;
}
async function bindCompany(t) {
  const r = await fetch(V1 + '/users/switch_company', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: CO }).toString(),
  });
  if (!r.ok) throw new Error('switch_company -> ' + r.status);
  return t;
}
// Leap allows ONE session per account, so a second login silently kills the
// first login's token. The old retry made that WORSE: on a 401 it nulled the
// in-flight tokenPromise, so every parallel page-fetch started its own login
// and each new login invalidated the last one.
//
// Two rules fix it:
//   1. Single-flight - a caller arriving during a login awaits the SAME
//      promise instead of kicking off another one.
//   2. Generation guard - a 401 only clears the token it actually used, so a
//      straggler cannot throw away a good token someone else just fetched.
let cachedToken = null, tokenPromise = null, tokenGen = 0;
function getToken() {
  if (cachedToken) return Promise.resolve({ t: cachedToken, gen: tokenGen });
  if (!tokenPromise) {
    tokenPromise = (async () => {
      try {
        const t = await bindCompany(await login());
        cachedToken = t;
        tokenGen += 1;
        return { t: t, gen: tokenGen };
      } finally {
        // Cleared only AFTER cachedToken is set, so the next caller sees the
        // token rather than racing to fetch another one.
        tokenPromise = null;
      }
    })();
  }
  return tokenPromise;
}
function invalidate(gen) { if (gen === tokenGen) cachedToken = null; }
const HDR = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/json', platform: 'web' });

// Leap allows one session per account. Anything else that logs in as the same
// user - the Herndon endpoint, or a human in the Leap UI - invalidates this
// token mid-flight. Retry once with a fresh login instead of failing the page.
async function get(path) {
  let a = await getToken();
  let r = await fetch(V1 + path, { headers: HDR(a.t) });
  if (r.status === 401 || r.status === 403) {
    invalidate(a.gen);
    a = await getToken();
    r = await fetch(V1 + path, { headers: HDR(a.t) });
  }
  if (!r.ok) throw new Error('GET ' + path.split('?')[0] + ' -> ' + r.status);
  return r.json();
}

function durationQuery(month, s0, e0, dur) {
  const ok = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x));
  if (ok(s0) && ok(e0)) return 'duration=DUR&start_date=' + s0 + '&end_date=' + e0;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const y = +month.slice(0, 4), m = +month.slice(5, 7), pad = (n) => String(n).padStart(2, '0');
    return 'duration=DUR&start_date=' + y + '-' + pad(m) + '-01&end_date=' + y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate());
  }
  return 'duration=' + (dur === 'YTD' ? 'YTD' : 'MTD');
}
const JL_OPTS = 'include_lost_jobs=1&includes[]=customer&includes[]=customer.rep&limit=100&with_archived=0&with_inactive=1';
function jlUrl(dateType, dq, page) {
  return '/reports/job_listing?date_range_type[]=' + dateType + '&' + dq + '&' + JL_OPTS + '&page=' + page;
}
async function pullJobs(dateType, dq) {
  const first = await get(jlUrl(dateType, dq, 1));
  const rows = (first.data || []).slice();
  const pg = (first.meta && first.meta.pagination) || {};
  const totalPages = Math.min(pg.total_pages || 1, 25);
  if (totalPages > 1) {
    const ps = [];
    for (let p = 2; p <= totalPages; p++) ps.push(get(jlUrl(dateType, dq, p)));
    (await Promise.all(ps)).forEach((j) => { (j.data || []).forEach((x) => rows.push(x)); });
  }
  return rows;
}
function fin(row) {
  const f = row && row.financial_details;
  if (!f) return {};
  return Array.isArray(f) ? (f[0] || {}) : (f.data || f);
}
function amountOf(row) { return Number(fin(row).total_job_amount) || 0; }
function repOf(row) {
  const c = row && row.customer && (row.customer.data || row.customer);
  const p = c && c.rep && (c.rep.data || c.rep);
  if (!p) return 'Unassigned';
  return [p.first_name, p.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Unassigned';
}
const round2 = (n) => Math.round(n * 100) / 100;

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'http://localhost');
    const month = url.searchParams.get('month');
    const qs = url.searchParams.get('start'), qe = url.searchParams.get('end');
    const dur = (url.searchParams.get('duration') || '').toUpperCase();
    const dq = durationQuery(month, qs, qe, dur);

    const [apprRows, signRows] = await Promise.all([
      pullJobs('job_awarded_date', dq),
      pullJobs('contract_signed_date', dq),
    ]);

    if (url.searchParams.get('debug') === '1') {
      const s = signRows[0] || {};
      res.status(200).json({ company: CO, approvedJobs: apprRows.length, signedJobs: signRows.length, sampleRep: repOf(s), sampleKeys: Object.keys(s) });
      return;
    }

    const byRep = {};
    const bump = (row, field) => {
      const k = repOf(row);
      if (!byRep[k]) byRep[k] = { rep: k, approved: 0, contract: 0, approved_jobs: 0, contract_jobs: 0 };
      byRep[k][field] += amountOf(row);
      byRep[k][field === 'approved' ? 'approved_jobs' : 'contract_jobs'] += 1;
    };
    apprRows.forEach((r) => bump(r, 'approved'));
    signRows.forEach((r) => bump(r, 'contract'));

    const reps = Object.keys(byRep).map((k) => {
      const r = byRep[k];
      r.approved = round2(r.approved);
      r.contract = round2(r.contract);
      return r;
    }).filter((r) => r.approved || r.contract)
      .sort((a, b) => b.contract - a.contract || b.approved - a.approved);

    const approved_amount = round2(apprRows.reduce((a, r) => a + amountOf(r), 0));
    const contract_amount = round2(signRows.reduce((a, r) => a + amountOf(r), 0));
    const received = round2(signRows.reduce((a, r) => a + (Number(fin(r).total_received_payemnt) || 0), 0));
    const pending = round2(signRows.reduce((a, r) => a + (Number(fin(r).pending_payment) || 0), 0));
    const company = { approved_amount, contract_amount };

    res.status(200).json({
      updated: new Date().toISOString(),
      duration: (qs && qe) ? (qs + '..' + qe) : (month || (dur === 'YTD' ? 'YTD' : 'MTD')),
      office: 'richmond',
      basis: 'job_listing - one row per job, credited to the customer rep',
      company,
      companyAll: company,
      inactive: { approved_amount: 0, contract_amount: 0 },
      jobs: { approved: apprRows.length, contract: signRows.length },
      cash: { received, pending },
      reps,
    });
  } catch (e) {
    res.status(200).json({ updated: new Date().toISOString(), office: 'richmond', reps: [], error: String((e && e.message) || e) });
  }
};
module.exports.config = { maxDuration: 60 };
