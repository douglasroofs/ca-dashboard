// api/revenue.js — Douglas Roofing revenue dashboard data
//
// Calls the SAME endpoint Leap's "Sales Performance Report" uses, so our numbers
// match the report by construction (no manual job aggregation).
//
//   Approved        -> date_range_type[]=job_awarded_date      duration=MTD
//   Contract Signed -> date_range_type[]=contract_signed_date  duration=MTD
//
// Report API (public v1):
//   GET /reports/sales_performance_summary_report/total?date_range_type[]=X&duration=MTD&with_inactive=0
//   GET /reports/sales_performance_summary_report?date_range_type[]=X&duration=MTD&limit=100&page=N&sort_field=full_name&sort_order=asc&with_inactive=0
//
// Auth: tries Bearer JP_API_TOKEN first; if that 401s, logs in with
// JP_USERNAME / JP_PASSWORD via POST /login (response shape {token:{access_token}}).
//
// Query params:
//   ?debug=1   -> returns raw total + first rep row so we can confirm field names
//   ?debug=auth -> secret-safe auth diagnostic (status codes only)
//   ?month=YYYY-MM (optional; default = current month, MTD)

const V1 = 'https://jobprogress.com/api/public/api/v1';

// OAuth password-grant client used by the Leap web app (public constants from its JS bundle).
const CLIENT_ID = process.env.JP_CLIENT_ID || '12345';
const CLIENT_SECRET = process.env.JP_CLIENT_SECRET || 'XraqRySfIhUTuvdfz7ATuJxXYf8aX5MY';

async function login() {
  const username = process.env.JP_USERNAME;
  const password = process.env.JP_PASSWORD;
  if (!username || !password) throw new Error('JP_USERNAME / JP_PASSWORD not set in Vercel');
  const res = await fetch(`${V1}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }).toString(),
  });
  if (!res.ok) throw new Error(`login -> ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const d = await res.json();
  const token = (d && d.token && d.token.access_token) || (d && d.access_token) || (d && d.data && d.data.token && d.data.token.access_token);
  if (!token) throw new Error('login ok but no access_token in response');
  return token;
}

// Cache a working token across the function lifetime.
let cachedToken = null;
async function getToken() {
  if (cachedToken) return cachedToken;
  if (process.env.JP_API_TOKEN) cachedToken = process.env.JP_API_TOKEN; // try the stored token first
  else cachedToken = await login();
  return cachedToken;
}

async function apiGet(path) {
  let token = await getToken();
  let res = await fetch(`${V1}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (res.status === 401 && process.env.JP_USERNAME) {
    // stored token rejected — fall back to a fresh login and retry once
    cachedToken = await login();
    res = await fetch(`${V1}${path}`, { headers: { Authorization: `Bearer ${cachedToken}`, Accept: 'application/json' } });
  }
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

const REPORT = '/reports/sales_performance_summary_report';

function durationParams(month) {
  // The report supports duration=MTD directly. If a specific month is passed, use an explicit range.
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const y = +month.slice(0, 4), m = +month.slice(5, 7);
    const pad = (n) => String(n).padStart(2, '0');
    const start = `${y}-${pad(m)}-01`;
    const end = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    return `duration=custom&start_date=${start}&end_date=${end}`;
  }
  return 'duration=MTD';
}

// Pull the contract-amount dollar figure out of a total/row object, whatever it's called.
function dollars(obj) {
  if (!obj) return 0;
  const keys = ['contract_amount', 'final_contract_amount', 'document_amount', 'amount', 'total_contract_amount'];
  for (const k of keys) {
    if (obj[k] != null) { const n = parseFloat(obj[k]); if (!isNaN(n)) return n; }
  }
  return 0;
}
function repName(row) {
  return row.full_name || row.name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unassigned';
}

async function fetchTotal(dateType, month) {
  const j = await apiGet(`${REPORT}/total?date_range_type[]=${dateType}&${durationParams(month)}&with_inactive=0`);
  return j.data || j;
}
async function fetchRows(dateType, month) {
  const rows = [];
  for (let page = 1; page <= 50; page++) {
    const j = await apiGet(`${REPORT}?date_range_type[]=${dateType}&${durationParams(month)}&limit=100&page=${page}&sort_field=full_name&sort_order=asc&with_inactive=0`);
    const data = j.data || j.rows || [];
    rows.push(...data);
    const pag = (j.meta && j.meta.pagination) || j.pagination || {};
    const totalPages = pag.total_pages || (data.length < 100 ? page : page + 1);
    if (page >= totalPages || data.length === 0) break;
  }
  return rows;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const debug = url.searchParams.get('debug');
    const month = url.searchParams.get('month');

    if (debug === 'auth') {
      // Secret-safe diagnostic: which credential authorizes the report endpoint?
      const path = `${REPORT}/total?date_range_type[]=job_awarded_date&duration=MTD&with_inactive=0`;
      const out = {
        hasApiToken: !!process.env.JP_API_TOKEN,
        hasUser: !!process.env.JP_USERNAME,
        hasPass: !!process.env.JP_PASSWORD,
      };
      // A: Bearer JP_API_TOKEN
      if (process.env.JP_API_TOKEN) {
        try { out.A_bearerApiToken = (await fetch(`${V1}${path}`, { headers: { Authorization: `Bearer ${process.env.JP_API_TOKEN}`, Accept: 'application/json' } })).status; } catch (e) { out.A_bearerApiToken = 'err'; }
        // C: JP_API_TOKEN as ?token= query param
        try { const sep = path.includes('?') ? '&' : '?'; out.C_queryToken = (await fetch(`${V1}${path}${sep}token=${encodeURIComponent(process.env.JP_API_TOKEN)}`, { headers: { Accept: 'application/json' } })).status; } catch (e) { out.C_queryToken = 'err'; }
      }
      // B: login -> Bearer access_token
      if (process.env.JP_USERNAME && process.env.JP_PASSWORD) {
        try {
          const tok = await login();
          out.B_loginOk = true;
          out.B_bearerLoginToken = (await fetch(`${V1}${path}`, { headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' } })).status;
        } catch (e) { out.B_loginOk = false; out.B_loginErr = String(e.message || e).replace(/[A-Za-z0-9_\-\.]{14,}/g, '<x>'); }
      }
      res.status(200).json(out);
      return;
    }

    if (debug) {
      const total = await fetchTotal('job_awarded_date', month);
      const rows = await fetchRows('job_awarded_date', month);
      res.status(200).json({ totalKeys: Object.keys(total || {}), total, rowKeys: rows[0] ? Object.keys(rows[0]) : [], firstRow: rows[0] || null, rowCount: rows.length });
      return;
    }

    const [apprTotal, signTotal, apprRows, signRows] = await Promise.all([
      fetchTotal('job_awarded_date', month),
      fetchTotal('contract_signed_date', month),
      fetchRows('job_awarded_date', month),
      fetchRows('contract_signed_date', month),
    ]);

    const apprByRep = {}; apprRows.forEach((r) => { apprByRep[repName(r)] = dollars(r); });
    const signByRep = {}; signRows.forEach((r) => { signByRep[repName(r)] = dollars(r); });
    const names = new Set([...Object.keys(apprByRep), ...Object.keys(signByRep)]);
    const reps = [...names]
      .map((n) => ({ rep: n, approved_amount: apprByRep[n] || 0, contract_amount: signByRep[n] || 0 }))
      .filter((r) => r.approved_amount || r.contract_amount)
      .sort((a, b) => b.contract_amount - a.contract_amount);

    res.status(200).json({
      updated: new Date().toISOString(),
      duration: month || 'MTD',
      company: { approved_amount: dollars(apprTotal), contract_amount: dollars(signTotal) },
      reps,
    });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
