// api/revenue.js - Herndon revenue, computed from JOB-LEVEL data.
//
// WHY THIS CHANGED (2026-08-17):
// The old version read Leap's Sales Performance *Summary* report, which is
// grouped per rep. That report double-counts: a rep who sells an upgrade is
// credited a second row against a job that already belongs to the base rep.
// Measured on 2026 YTD Herndon, that inflated the company figure from
// $6.76M to $10.36M - Haley Barry alone carried $3.15M of duplicate credit
// across 159 duplicate "job" rows. The old name-blocklist in the HTML pages
// was a workaround for exactly this.
//
// This version reads /reports/job_listing instead: ONE ROW PER JOB, with the
// customer rep attached. Upgrades net out by construction, because the job
// belongs to the base rep and is counted once. No blocklist required.
//
// Verified 2026-08-17, Herndon YTD:
//   contract_signed_date -> $6,764,093 across 381 jobs, 0 unattributed
//   job_awarded_date     -> $7,471,016 across 381 jobs
//
// Auth is unchanged (JP_USERNAME / JP_PASSWORD + switch_company). The v3
// developer token does NOT authorize these v1 report endpoints - it returns
// 401 - so the password login has to stay until Leap grants token access.
//
// 2026-08-20: restored the 401/403 retry that the rewrite dropped, and added
// ?duration=YTD so this matches api/rich-revenue.js.
//
// Query params: ?month=YYYY-MM | ?start=&end= | ?duration=YTD | default MTD | ?debug=1

const V1 = 'https://jobprogress.com/api/public/api/v1';
const COMPANY_ID = process.env.JP_COMPANY_ID || '5154';

async function login() {
  const username = process.env.JP_USERNAME, password = process.env.JP_PASSWORD;
  const client_id = process.env.JP_CLIENT_ID, client_secret = process.env.JP_CLIENT_SECRET;
  if (!username || !password) throw new Error('JP_USERNAME / JP_PASSWORD not set in Vercel');
  if (!client_id || !client_secret) throw new Error('JP_CLIENT_ID / JP_CLIENT_SECRET not set in Vercel');
  const res = await fetch(`${V1}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id, client_secret, end_existing_sessions: '0' }).toString(),
  });
  if (!res.ok) throw new Error(`login -> ${res.status}`);
  const d = await res.json();
  const t = (d && d.token && d.token.access_token) || (d && d.access_token);
  if (!t) throw new Error('login ok but no access_token');
  return t;
}
async function switchCompany(token) {
  await fetch(`${V1}/users/switch_company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: COMPANY_ID }).toString(),
  });
  return token;
}
// Leap allows ONE session per account, so a second login silently kills the
// first login's token. The old retry made that WORSE: on a 401 it nulled the
// in-flight tokenPromise, so every parallel page-fetch started its own login
// and each new login invalidated the last one. That is why this endpoint 401'd
// fast on a warm container and returned a clean 200 on a cold one.
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
        const t = await switchCompany(await login());
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
const HDR = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json', platform: 'web' });

function durationQuery(month, s0, e0, dur) {
  const ok = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x));
  if (ok(s0) && ok(e0)) return `duration=DUR&start_date=${s0}&end_date=${e0}`;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const y = +month.slice(0, 4), m = +month.slice(5, 7), pad = (n) => String(n).padStart(2, '0');
    return `duration=DUR&start_date=${y}-${pad(m)}-01&end_date=${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  }
  return `duration=${dur === 'YTD' ? 'YTD' : 'MTD'}`;
}
const JL_BASE = '/reports/job_listing';
const JL_OPTS = 'include_lost_jobs=1&includes[]=customer&includes[]=customer.rep&limit=100&with_archived=0&with_inactive=1';

function jlUrl(dateType, dq, page) {
  return `${JL_BASE}?date_range_type[]=${dateType}&${dq}&${JL_OPTS}&page=${page}`;
}
// Leap allows ONE session per account. Anything else that logs in as the same
// user - the Richmond endpoint, the marketing endpoint, or a human opening
// Leap in a browser - invalidates this token mid-flight. Retry once with a
// fresh login instead of failing the whole page.
async function get(path) {
  let a = await getToken();
  let r = await fetch(V1 + path, { headers: HDR(a.t) });
  if (r.status === 401 || r.status === 403) {
    invalidate(a.gen);
    a = await getToken();
    r = await fetch(V1 + path, { headers: HDR(a.t) });
  }
  if (!r.ok) throw new Error(`GET ${path.split('?')[0]} -> ${r.status}`);
  return r.json();
}

// Page 1 first to learn total_pages, then the rest in parallel - keeps this
// inside the function timeout instead of walking pages one at a time.
async function pullJobs(dateType, dq) {
  const first = await get(jlUrl(dateType, dq, 1));
  const rows = (first.data || []).slice();
  const pg = (first.meta && first.meta.pagination) || {};
  const totalPages = Math.min(pg.total_pages || 1, 25);
  if (totalPages > 1) {
    const pages = [];
    for (let p = 2; p <= totalPages; p++) pages.push(get(jlUrl(dateType, dq, p)));
    (await Promise.all(pages)).forEach((j) => { (j.data || []).forEach((x) => rows.push(x)); });
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
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return n || 'Unassigned';
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
      res.status(200).json({
        approvedJobs: apprRows.length, signedJobs: signRows.length,
        sampleKeys: Object.keys(s), sampleFinancial: Object.keys(fin(s)),
        sampleRep: repOf(s), sampleSignedDate: s.contract_signed_date,
      });
      return;
    }

    const byRep = {};
    const bump = (row, field) => {
      const k = repOf(row);
      if (!byRep[k]) byRep[k] = { rep: k, approved_amount: 0, contract_amount: 0, approved_jobs: 0, contract_jobs: 0 };
      byRep[k][field] += amountOf(row);
      byRep[k][field === 'approved_amount' ? 'approved_jobs' : 'contract_jobs'] += 1;
    };
    apprRows.forEach((r) => bump(r, 'approved_amount'));
    signRows.forEach((r) => bump(r, 'contract_amount'));

    const reps = Object.keys(byRep).map((k) => {
      const r = byRep[k];
      r.approved_amount = round2(r.approved_amount);
      r.contract_amount = round2(r.contract_amount);
      return r;
    }).filter((r) => r.approved_amount || r.contract_amount)
      .sort((a, b) => b.contract_amount - a.contract_amount || b.approved_amount - a.approved_amount);

    const approved_amount = round2(apprRows.reduce((a, r) => a + amountOf(r), 0));
    const contract_amount = round2(signRows.reduce((a, r) => a + amountOf(r), 0));
    const received = round2(signRows.reduce((a, r) => a + (Number(fin(r).total_received_payemnt) || 0), 0));
    const pending = round2(signRows.reduce((a, r) => a + (Number(fin(r).pending_payment) || 0), 0));

    // company and companyAll are identical now: at job level there is no
    // active/inactive split to reconcile, because a job counts once whoever
    // sold it. Both keys are kept so the existing pages don't need changing.
    const company = { approved_amount, contract_amount };

    res.status(200).json({
      updated: new Date().toISOString(),
      duration: (qs && qe) ? `${qs}..${qe}` : (month || (dur === 'YTD' ? 'YTD' : 'MTD')),
      basis: 'job_listing - one row per job, credited to the customer rep',
      company,
      companyAll: company,
      inactive: { approved_amount: 0, contract_amount: 0 },
      jobs: { approved: apprRows.length, contract: signRows.length },
      cash: { received, pending },
      reps,
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};

// Must be set AFTER the handler assignment above, or it gets overwritten.
// This endpoint makes ~8 upstream calls; the 10s default is not enough.
module.exports.config = { maxDuration: 60 };
