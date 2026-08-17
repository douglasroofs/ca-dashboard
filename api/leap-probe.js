// api/leap-probe.js - TEMPORARY diagnostic v4, delete after the real fix ships.
// Gating question for killing the password login: does the stored API token
// reach the v1 REPORT endpoints, or only api/v3? revenue.js needs
// /reports/job_listing, which lives on v1.
// ?sum=1 also aggregates the year one-row-per-job, which is the correct,
// non-double-counted company figure (Haley's upgrades net out by construction).
const V1 = 'https://jobprogress.com/api/public/api/v1';
const ENVS = ['LEAP_ACCESS_TOKEN', 'RICH_LEAP_API_KEY', 'LEAP_API_TOKEN'];
const JL = '/reports/job_listing?date_range_type[]=contract_signed_date&duration=YTD&include_lost_jobs=1&includes[]=customer&includes[]=customer.rep&limit=100&with_archived=0&with_inactive=1&page=';
function hdr(t) { return { Authorization: 'Bearer ' + t, Accept: 'application/json', platform: 'web' }; }
async function g(t, u) {
  var r = await fetch(V1 + u, { headers: hdr(t) });
  var x = await r.text(); var j = null;
  try { j = JSON.parse(x); } catch (_) {}
  return { status: r.status, ok: r.ok, json: j, raw: j ? null : x.slice(0, 160) };
}
function fdOf(r) { var f = r.financial_details; if (!f) return {}; return Array.isArray(f) ? (f[0] || {}) : (f.data || f); }
function repOf(r) {
  var c = r.customer && (r.customer.data || r.customer);
  var p = c && c.rep && (c.rep.data || c.rep);
  return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).replace(/\s+/g, ' ').trim() : '(none)';
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    var q = new URL(req.url, 'http://x').searchParams;
    var out = { base: V1, auth: [] };
    var tok = null, env = null;
    for (var i = 0; i < ENVS.length; i++) {
      var n = ENVS[i], t = process.env[n];
      if (!t) { out.auth.push({ env: n, present: false }); continue; }
      var r0 = await g(t, JL + '1');
      out.auth.push({ env: n, status: r0.status, ok: r0.ok, note: r0.ok ? null : (r0.raw || '').slice(0, 100) });
      if (r0.ok && !tok) { tok = t; env = n; }
    }
    out.workingEnvVar = env;
    if (!tok || q.get('sum') !== '1') { res.status(200).json(out); return; }

    var rows = [];
    for (var p = 1; p <= 8; p++) {
      var r = await g(tok, JL + p);
      var d = (r.json && r.json.data) || [];
      rows = rows.concat(d);
      var pg = (r.json && r.json.meta && r.json.meta.pagination) || {};
      if (p >= (pg.total_pages || 1) || !d.length) break;
    }
    var tot = 0, recv = 0, pend = 0, byRep = {};
    rows.forEach(function (x) {
      var f = fdOf(x);
      var a = Number(f.total_job_amount) || 0;
      tot += a; recv += Number(f.total_received_payemnt) || 0; pend += Number(f.pending_payment) || 0;
      var k = repOf(x);
      if (!byRep[k]) byRep[k] = { amt: 0, n: 0 };
      byRep[k].amt += a; byRep[k].n++;
    });
    out.jobs = rows.length;
    out.totalJobAmount = Math.round(tot);
    out.paymentsReceived = Math.round(recv);
    out.pendingPayment = Math.round(pend);
    out.byRep = Object.keys(byRep).sort(function (a, b) { return byRep[b].amt - byRep[a].amt; })
      .map(function (k) { return { rep: k, amount: Math.round(byRep[k].amt), jobs: byRep[k].n }; });
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: String((e && e.message) || e) }); }
};
