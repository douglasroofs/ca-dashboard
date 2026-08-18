// api/leap-probe.js - RECONCILIATION CHECK.
// Runs Leap's own Sales Performance Summary (per rep) and Leap's job_listing
// (one row per job) over the SAME window, and diffs them rep by rep.
// A rep whose summary figure exceeds their job-level figure is being credited
// revenue on jobs that belong to someone else - i.e. upgrade double-counting.
// This is the seed of the nightly "do the numbers still tie out" job.
// ?basis=contract_signed_date|job_awarded_date  ?duration=YTD|MTD
const V1 = 'https://jobprogress.com/api/public/api/v1';
const CO = process.env.JP_COMPANY_ID || '5154';
async function login() {
  const u = process.env.JP_USERNAME, p = process.env.JP_PASSWORD;
  const ci = process.env.JP_CLIENT_ID, cs = process.env.JP_CLIENT_SECRET;
  if (!u || !p || !ci || !cs) throw new Error('JP_* env vars not fully set in Vercel');
  const r = await fetch(V1 + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username: u, password: p, grant_type: 'password', client_id: ci, client_secret: cs, end_existing_sessions: '0' }).toString(),
  });
  if (!r.ok) throw new Error('login ' + r.status);
  const d = await r.json();
  const t = (d && d.token && d.token.access_token) || (d && d.access_token);
  if (!t) throw new Error('no access_token');
  return t;
}
async function sw(t) {
  await fetch(V1 + '/users/switch_company', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: CO }).toString(),
  });
  return t;
}
const H = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/json', platform: 'web' });
async function g(t, p) {
  const r = await fetch(V1 + p, { headers: H(t) });
  if (!r.ok) throw new Error(p.split('?')[0] + ' -> ' + r.status);
  return r.json();
}
function nk(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function amt(r) {
  const f = r.financial_details;
  if (!f) return 0;
  const o = Array.isArray(f) ? (f[0] || {}) : (f.data || f);
  return Number(o.total_job_amount) || 0;
}
function rep(r) {
  const c = r.customer && (r.customer.data || r.customer);
  const p = c && c.rep && (c.rep.data || c.rep);
  if (!p) return 'Unassigned';
  return [p.first_name, p.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Unassigned';
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    const dur = q.get('duration') || 'YTD';
    const dt = q.get('basis') || 'contract_signed_date';
    const t = await sw(await login());

    let sum = [];
    for (let p = 1; p <= 10; p++) {
      const j = await g(t, '/reports/sales_performance_summary_report?date_range_type[]=' + dt + '&duration=' + dur + '&exclude_users_with_no_results=0&limit=100&page=' + p + '&sort_field=full_name&sort_order=asc&with_inactive=true');
      const d = j.data || [];
      sum = sum.concat(d);
      const pg = (j.meta && j.meta.pagination) || {};
      if (p >= (pg.total_pages || 1) || !d.length) break;
    }

    const JL = '/reports/job_listing?date_range_type[]=' + dt + '&duration=' + dur + '&include_lost_jobs=1&includes[]=customer&includes[]=customer.rep&limit=100&with_archived=0&with_inactive=1&page=';
    const f1 = await g(t, JL + '1');
    let jobs = (f1.data || []).slice();
    const pg1 = (f1.meta && f1.meta.pagination) || {};
    const tp = Math.min(pg1.total_pages || 1, 20);
    if (tp > 1) {
      const ps = [];
      for (let p = 2; p <= tp; p++) ps.push(g(t, JL + p));
      (await Promise.all(ps)).forEach((j) => { (j.data || []).forEach((x) => jobs.push(x)); });
    }

    const S = {}, J = {};
    sum.forEach((r) => { S[nk(r.full_name)] = { name: String(r.full_name || '').trim(), amt: Number(r.contract_amount) || 0, jobs: Number(r.contracts_jobs_count) || 0 }; });
    jobs.forEach((r) => { const n = rep(r), k = nk(n); if (!J[k]) J[k] = { name: n, amt: 0, jobs: 0 }; J[k].amt += amt(r); J[k].jobs++; });

    const keys = {};
    Object.keys(S).forEach((k) => { keys[k] = 1; });
    Object.keys(J).forEach((k) => { keys[k] = 1; });
    const rows = Object.keys(keys).map((k) => {
      const s = S[k] || { amt: 0, jobs: 0 }, j = J[k] || { amt: 0, jobs: 0 };
      return { rep: (S[k] || J[k]).name, summary: Math.round(s.amt), jobLevel: Math.round(j.amt), diff: Math.round(s.amt - j.amt), summaryJobs: s.jobs, jobLevelJobs: j.jobs };
    }).filter((r) => r.summary || r.jobLevel).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const tS = rows.reduce((a, r) => a + r.summary, 0);
    const tJ = rows.reduce((a, r) => a + r.jobLevel, 0);
    res.status(200).json({
      basis: dt, duration: dur,
      summaryTotal: tS, jobLevelTotal: tJ, gap: tS - tJ,
      summaryJobCount: sum.reduce((a, r) => a + (Number(r.contracts_jobs_count) || 0), 0),
      jobLevelJobCount: jobs.length,
      overCredited: rows.filter((r) => r.diff > 1).length,
      underCredited: rows.filter((r) => r.diff < -1).length,
      rows,
    });
  } catch (e) { res.status(200).json({ error: String((e && e.message) || e) }); }
};
module.exports.config = { maxDuration: 60 };
