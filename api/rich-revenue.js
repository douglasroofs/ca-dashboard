// api/rich-revenue.js
// Live Richmond revenue from JobProgress "Sales Performance" summary report.
// Fully server-side: logs in with stored JP creds (JP_USERNAME/JP_PASSWORD +
// JP_CLIENT_ID/JP_CLIENT_SECRET), switches to the Richmond company (6026), and
// reads the same report the Herndon dashboard uses (field: contract_amount).
// No dependency on any browser login.
// Response: { updated, duration, office, reps:[{rep, approved, contract}] }

const BASE = 'https://www.jobprogress.com/api/public/api/v1';
const RICHMOND_COMPANY = 6026;
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Origin': 'https://www.jobprogress.com',
  'Referer': 'https://www.jobprogress.com/app/'
};

function findToken(obj) {
  var found = null;
  (function walk(o) {
    if (found || !o || typeof o !== 'object') return;
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v = o[k];
      if (typeof v === 'string' && v.length > 20 && /^(token|access_token|auth_token|jwt|api_token)$/i.test(k)) { found = v; return; }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  return found;
}

async function jpLogin() {
  var r = await fetch(BASE + '/login', {
    method: 'POST',
    redirect: 'follow',
    headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'platform': 'web' }, BROWSER_HEADERS),
    body: new URLSearchParams({
      username: process.env.JP_USERNAME || '',
      password: process.env.JP_PASSWORD || '',
      grant_type: 'password',
      client_id: process.env.JP_CLIENT_ID || '',
      client_secret: process.env.JP_CLIENT_SECRET || '',
      platform: 'web',
      end_existing_sessions: 'false'
    }).toString()
  });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error('login ' + r.status + ' ' + (j && j.error && j.error.message ? j.error.message : ''));
  var tok = findToken(j);
  if (!tok) throw new Error('token not found; keys=' + Object.keys(j || {}).join(','));
  return tok;
}

async function switchCompany(token, companyId) {
  var r = await fetch(BASE + '/users/switch_company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'platform': 'web', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ company_id: companyId })
  });
  if (!r.ok) throw new Error('switch_company ' + r.status);
}

async function pullReport(token, dateType, duration, s0, e0) {
  var okd = function (x) { return typeof x === 'string' && x.length === 10 && !isNaN(Date.parse(x)); };
  var dq = (okd(s0) && okd(e0)) ? ('&duration=DUR&start_date=' + s0 + '&end_date=' + e0) : ('&duration=' + encodeURIComponent(duration));
  var url = BASE + '/reports/sales_performance_summary_report?date_range_type[]=' + encodeURIComponent(dateType) + dq + '&limit=200&page=1';
  var r = await fetch(url, { headers: { 'Accept': 'application/json', 'platform': 'web', 'Authorization': 'Bearer ' + token } });
  if (!r.ok) throw new Error('report ' + dateType + ' ' + r.status);
  var j = await r.json();
  var rows = (j && j.data) || [];
  var out = {};
  rows.forEach(function (row) {
    var name = String(row.full_name || '').replace(/\s+/g, ' ').trim();
    var v = Math.round((Number(row.contract_amount) || 0) * 100) / 100;
    if (name) out[name] = v;
  });
  return out;
}

module.exports = async (req, res) => {
  try {
    var q = (req.url.split('?')[1] || '');
    var duration = 'MTD';
    q.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0] === 'duration' && p[1]) duration = decodeURIComponent(p[1]).toUpperCase(); });
    if (duration !== 'YTD' && duration !== 'MTD') duration = 'MTD';
    var qs = null, qe = null;
    q.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0] === 'start' && p[1]) qs = decodeURIComponent(p[1]); if (p[0] === 'end' && p[1]) qe = decodeURIComponent(p[1]); });

    var token = await jpLogin();
    await switchCompany(token, RICHMOND_COMPANY);
    var approved = await pullReport(token, 'job_awarded_date', duration, qs, qe);
    var contract = await pullReport(token, 'contract_signed_date', duration, qs, qe);

    var names = {};
    Object.keys(approved).forEach(function (n) { names[n] = 1; });
    Object.keys(contract).forEach(function (n) { names[n] = 1; });
    var reps = Object.keys(names).map(function (n) {
      return { rep: n, approved: approved[n] || 0, contract: contract[n] || 0 };
    }).filter(function (r) { return r.approved > 0 || r.contract > 0; })
      .sort(function (a, b) { return (b.approved - a.approved) || (b.contract - a.contract); });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ updated: new Date().toISOString(), duration: (qs && qe) ? (qs + '..' + qe) : duration, office: 'richmond', reps: reps });
  } catch (e) {
    res.status(200).json({ updated: new Date().toISOString(), duration: 'MTD', office: 'richmond', reps: [], error: String((e && e.message) || e) });
  }
};
