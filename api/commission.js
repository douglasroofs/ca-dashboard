// api/commission.js — sales-rep commission automation (Herndon).
//
// Replaces the manual entry in Adam's "Commission Calculator" Google Sheet.
// When a job reaches the commissionable stage (Herndon "Review Requested"),
// pull everything from Leap, run the sheet's formula chain, compare actual
// cost to the pre cap, and write one row per job to the "Leap Auto" tab.
//
//   GET  /api/commission?job=2605-8627717-01        dry run: compute, return JSON, write nothing
//   GET  /api/commission?job=Poyta                   same, by customer-name search
//   GET  /api/commission?job=...&write=1             compute and write/refresh the sheet row
//   GET  /api/commission?job=...&debug=1             include raw Leap job + worksheet JSON
//   GET  /api/commission?sweep=14                    every job that entered the stage in the last 14 days (add &write=1 to write)
//   POST /api/commission                             Leap webhook receiver (jobs / stage_change)
//
// Env (Vercel): JP_USERNAME, JP_PASSWORD, JP_CLIENT_ID, JP_CLIENT_SECRET, JP_COMPANY_ID   (Leap v1 login, same as revenue.js)
//               GOOGLE_SERVICE_ACCOUNT_JSON   full JSON key of a service account the sheet is shared with (Editor)
//               COMMISSION_SHEET_ID           spreadsheet id (defaults to Kyle's copy of the Commission Calculator)
//               COMMISSION_SHEET_TAB          tab name (default "Leap Auto")
//               COMMISSION_STAGE_CODES        comma-separated stage codes that trigger a row (default Herndon "Review Requested")
//               PRECAP_TOLERANCE              fraction, default 0.10 (flag when actual cost is >10% under or over pre cap)
//               LEAD_TYPE_RATES               JSON, default {"inbound":0.30,"marketing":0.10} matched against the customer's Referred By
//
// Reads Leap. Writes only to the Google Sheet. Never modifies Leap.

const crypto = require('crypto');

const V1 = 'https://jobprogress.com/api/public/api/v1';
const CLIENT_ID = process.env.JP_CLIENT_ID || '12345';
const CLIENT_SECRET = process.env.JP_CLIENT_SECRET || '';
const COMPANY_ID = process.env.JP_COMPANY_ID || '5154';
const SHEET_ID = process.env.COMMISSION_SHEET_ID || '1Sh0GanCypUquOeEicN7Tm6JyZzjxOPmnALzjc_kRYBA';
const SHEET_TAB = process.env.COMMISSION_SHEET_TAB || 'Leap Auto';
const STAGE_CODES = (process.env.COMMISSION_STAGE_CODES || '16916022161341505386').split(',').map((s) => s.trim()).filter(Boolean);
const PRECAP_TOL = Number(process.env.PRECAP_TOLERANCE || 0.10);
const OVERHEAD = 0.10;           // sheet column G
const UPGRADE_BONUS = 0.05;      // sheet column N
let LEAD_RATES = { inbound: 0.30, marketing: 0.10 };
try { if (process.env.LEAD_TYPE_RATES) LEAD_RATES = JSON.parse(process.env.LEAD_TYPE_RATES); } catch {}

const HEADER = [
  'Job Name', "Rep's Name", 'Marketing Commission (Lead Type)', 'Final Total Job Price', 'Upgrade Amount',
  'Insurance Job Total (ACV)', 'Overhead to Insurance', 'Overhead from Insurance', 'Job Cost', 'Insurance Profit',
  'Upgrades Cost to Insurance Profit', 'True Insurance Profit', 'Storm Rep Commission', 'Add 5% of Upgrade Total', 'Final Storm Rep Commission',
  'Job #', 'Rate Used', 'Rate Source', 'Pre-Cap Cost (Projected, ex-commission)', 'Actual Cost', 'Cost vs Pre-Cap %', 'Flags', 'Stage', 'Stage Date', 'Leap Job ID', 'Updated',
];
const JOBNUM_COL = 'P'; // column holding Job # — used to find an existing row

// ── Leap v1 auth (same as job-reps.js / revenue.js) ─────────────────────────
let cachedToken = null, tokenPromise = null;
async function login() {
  const username = process.env.JP_USERNAME, password = process.env.JP_PASSWORD;
  if (!username || !password) throw new Error('JP_USERNAME / JP_PASSWORD not set');
  const res = await fetch(`${V1}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, end_existing_sessions: '0' }).toString(),
  });
  if (!res.ok) throw new Error(`Leap login -> ${res.status}`);
  const d = await res.json();
  const t = (d && d.token && d.token.access_token) || (d && d.access_token);
  await fetch(`${V1}/users/switch_company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: COMPANY_ID }).toString(),
  });
  return t;
}
function getToken() {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (!tokenPromise) tokenPromise = login().then((t) => (cachedToken = t)).catch((e) => { tokenPromise = null; throw e; });
  return tokenPromise;
}
const HDR = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json', platform: 'web' });
async function leapGet(path) {
  const t = await getToken();
  const r = await fetch(`${V1}${path}`, { headers: HDR(t) });
  if (r.status === 401) { cachedToken = null; tokenPromise = null; const t2 = await getToken(); const r2 = await fetch(`${V1}${path}`, { headers: HDR(t2) }); if (!r2.ok) throw new Error(`Leap ${path} -> ${r2.status}`); return r2.json(); }
  if (!r.ok) throw new Error(`Leap ${path} -> ${r.status}`);
  return r.json();
}

// ── helpers ─────────────────────────────────────────────────────────────────
const unwrap = (x) => (x && x.data !== undefined) ? x.data : x;
const nameOf = (p) => p ? (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null) : null;
// First dollar-ish number in a value: "Upgrade Cost - $1,082.64" -> 1082.64 ; "2680.50" -> 2680.5 ; "" -> null
const money = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const JOB_INCLUDES = ['customer', 'reps', 'estimators', 'division', 'insurance_details', 'financial_details', 'custom_fields', 'flags'];
const incQS = () => JOB_INCLUDES.map((x) => `includes[]=${x}`).join('&');

async function findJob(q) {
  if (/^\d+$/.test(q)) { const j = await leapGet(`/jobs/${q}?${incQS()}`); return unwrap(j) || j.job || null; }
  const key = /^\d{4}-\d+-\d+$/.test(q) ? 'job_number' : 'customer_name';
  const j = await leapGet(`/jobs?${key}=${encodeURIComponent(q)}&limit=10&${incQS()}`);
  const arr = j.data || j.rows || [];
  return arr[0] || null;
}

// Pull projected / actual cost rows out of the Profit/Loss worksheet without
// depending on exact field names (the v1 worksheet shape isn't documented).
function readWorksheet(ws) {
  const root = unwrap(ws) || ws || {};
  let rows = null;
  const walk = (o, d = 0) => {
    if (rows || !o || typeof o !== 'object' || d > 4) return;
    if (Array.isArray(o)) { if (o.length && o.every((x) => x && typeof x === 'object') && o.some((x) => 'description' in x || 'product_name' in x || 'name' in x)) { rows = o; return; } o.forEach((x) => walk(x, d + 1)); return; }
    for (const v of Object.values(o)) walk(v, d + 1);
  };
  walk(root);
  const out = { rows: [], projected_total: 0, projected_ex_commission: 0, actual_total: 0, found: !!rows };
  for (const r of rows || []) {
    const qty = money(r.qty ?? r.quantity) ?? 0, unit = money(r.unit_cost ?? r.cost_per_qty ?? r.unit_price ?? r.price) ?? 0;
    const aqty = money(r.actual_qty ?? r.actual_quantity) ?? 0, aunit = money(r.actual_unit_cost ?? r.actual_cost_per_qty ?? r.actual_unit_price) ?? 0;
    const projected = money(r.cost ?? r.total ?? r.line_total) ?? r2(qty * unit);
    const actual = money(r.actual_cost ?? r.actual_total ?? r.actual_line_total) ?? r2(aqty * aunit);
    const desc = [r.type, r.name ?? r.product_name, r.description].filter(Boolean).join(' | ');
    const isCommission = /commission/i.test(String(r.description || '') + ' ' + String(r.name || r.product_name || ''));
    out.rows.push({ desc, projected, actual, isCommission });
    out.projected_total += projected || 0;
    if (!isCommission) out.projected_ex_commission += projected || 0;
    out.actual_total += actual || 0;
  }
  out.projected_total = r2(out.projected_total); out.projected_ex_commission = r2(out.projected_ex_commission); out.actual_total = r2(out.actual_total);
  return out;
}

// ── the sheet's formula chain ───────────────────────────────────────────────
function compute(job, ws) {
  const cust = unwrap(job.customer) || {};
  const rep = unwrap(cust.rep) || {};
  const ins = unwrap(job.insurance_details) || {};
  const fin = unwrap(job.financial_details) || {};
  const flags = [], notes = [];

  const D = money(fin.total_job_amount ?? fin.final_job_total ?? job.amount);
  const E = money(ins.upgrade) ?? 0;
  const K = money(ins.policy_number) ?? 0;
  const I = ws.found ? ws.actual_total : null;
  const repName = nameOf(rep) || '';
  const repPct = money(rep.commission_percentage);

  // lead type from the customer's Referred By
  const ref = [cust.referred_by_type, cust.referred_by_name, cust.referred_by && (cust.referred_by.name || cust.referred_by.first_name), cust.referred_by_referral && cust.referred_by_referral.name, cust.referred_by_note]
    .filter((x) => x && typeof x === 'string').join(' ').trim();
  let leadType = '', rate = null, rateSource = '';
  for (const [k, v] of Object.entries(LEAD_RATES)) if (ref && new RegExp(k, 'i').test(ref)) { leadType = k === 'inbound' ? 'Inbound Lead' : k[0].toUpperCase() + k.slice(1); rate = v; rateSource = `lead type "${ref}"`; }
  if (rate == null) {
    if (repPct != null) { rate = repPct / 100; rateSource = `Leap rep profile ${repPct}%`; }
    else { rate = 0; flags.push('NO REP RATE'); rateSource = 'missing'; }
  }

  if (D == null) flags.push('NO JOB PRICE');
  if (!money(ins.upgrade) && ins.upgrade !== '0') notes.push('upgrade blank');
  if (!ws.found) flags.push('NO P&L WORKSHEET');
  else if (!I) flags.push('NO ACTUAL COSTS');
  if (!repName) flags.push('NO CUSTOMER REP');
  if (!job.insurance) notes.push('not an insurance job');
  if (ins.policy_number && money(ins.policy_number) == null) notes.push('policy # not numeric');

  const F = D != null ? r2(D - E) : null;
  const G = F != null ? r2(F * OVERHEAD) : null;
  const H = F != null ? r2(F - G) : null;
  const J = H != null && I != null ? r2(H - I) : null;
  const L = J != null ? r2(J + K) : null;
  const M = L != null ? r2(L * rate) : null;
  const N = r2(E * UPGRADE_BONUS);
  const O = M != null ? r2(M + N) : null;

  // pre-cap check: projected (ex estimated-commission row) vs actual
  const P = ws.found ? ws.projected_ex_commission : null;
  let variance = null;
  if (P && I != null) {
    variance = r2((I - P) / P * 100);
    if (I < P * (1 - PRECAP_TOL)) flags.push(`COSTS LOOK INCOMPLETE (${variance}% under pre-cap)`);
    else if (I > P * (1 + PRECAP_TOL)) flags.push(`OVER PRE-CAP (+${variance}%)`);
  } else if (ws.found && !P) flags.push('NO PRE-CAP ROWS');

  return {
    row: [
      nameOf(cust) || job.name || '', repName, leadType, D, E, F, G, H, I, J, K, L, M, N, O,
      job.number, rate, rateSource, P, I, variance, flags.join('; ') + (notes.length ? ` [${notes.join(', ')}]` : ''),
      job.current_stage && job.current_stage.name, job.stage_last_modified, job.id, new Date().toISOString(),
    ],
    flags, notes,
  };
}

async function processJob(job, { debug = false } = {}) {
  const wsId = job.has_profit_loss_worksheet;
  let wsRaw = null;
  if (wsId) { try { wsRaw = await leapGet(`/worksheet/${wsId}?details_attachment_count=1`); } catch (e) { wsRaw = { error: String(e.message || e) }; } }
  const ws = readWorksheet(wsRaw);
  const result = compute(job, ws);
  const labeled = {}; HEADER.forEach((h, i) => (labeled[h] = result.row[i]));
  const out = { job_number: job.number, leap_job_id: job.id, flags: result.flags, notes: result.notes, values: labeled, worksheet_rows: ws.rows, _row: result.row };
  if (debug) out.debug = { job, worksheet: wsRaw };
  return out;
}

// ── Google Sheets (service account, no SDK) ─────────────────────────────────
async function sheetsToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set in Vercel');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }).toString() });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Google token: ${JSON.stringify(d).slice(0, 200)}`);
  return d.access_token;
}
const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
async function gs(tok, path, init = {}) {
  const r = await fetch(`${SHEETS}${path}`, { ...init, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Sheets ${path} -> ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}
const tab = (a1) => encodeURIComponent(`'${SHEET_TAB}'!${a1}`);
async function ensureTab(tok) {
  const meta = await gs(tok, '?fields=sheets.properties.title');
  if ((meta.sheets || []).some((s) => s.properties.title === SHEET_TAB)) return;
  await gs(tok, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] }) });
  await gs(tok, `/values/${tab('A1')}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [HEADER] }) });
}
async function writeRows(results) {
  const tok = await sheetsToken();
  await ensureTab(tok);
  const existing = await gs(tok, `/values/${tab(`${JOBNUM_COL}2:${JOBNUM_COL}`)}`);
  const index = new Map(); (existing.values || []).forEach((v, i) => { if (v[0]) index.set(String(v[0]), i + 2); });
  const written = [];
  for (const res of results) {
    const rowNum = index.get(String(res.job_number));
    if (rowNum) { await gs(tok, `/values/${tab(`A${rowNum}`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [res._row] }) }); written.push({ job: res.job_number, action: 'updated', row: rowNum }); }
    else { await gs(tok, `/values/${tab('A:Z')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [res._row] }) }); written.push({ job: res.job_number, action: 'added' }); }
  }
  return written;
}

// ── handler ─────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  const write = url.searchParams.get('write') === '1';
  const debug = url.searchParams.get('debug') === '1';
  try {
    let jobs = [];
    if (req.method === 'POST') {
      // Leap webhook: array of notifications; act on stage changes into a target stage
      let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = []; } }
      const events = Array.isArray(body) ? body : [body];
      const ids = [...new Set(events.filter((e) => e && e.action === 'jobs' && e.operation === 'stage_change' && e.stage_moved_to && STAGE_CODES.includes(String(e.stage_moved_to.code))).map((e) => e.id))];
      if (!ids.length) return res.status(200).json({ ok: true, ignored: events.length });
      for (const id of ids) { const j = await findJob(String(id)); if (j) jobs.push(j); }
      const results = []; for (const j of jobs) results.push(await processJob(j));
      const written = await writeRows(results);
      return res.status(200).json({ ok: true, written, flags: results.map((r) => ({ job: r.job_number, flags: r.flags })) });
    }
    const q = (url.searchParams.get('job') || '').trim();
    const sweep = Number(url.searchParams.get('sweep') || 0);
    if (q) { const j = await findJob(q); if (!j) return res.status(404).json({ error: `no Leap job matched "${q}"` }); jobs = [j]; }
    else if (sweep) {
      const end = new Date(), start = new Date(Date.now() - sweep * 86400000);
      const ymd = (d) => d.toISOString().slice(0, 10);
      const stages = STAGE_CODES.map((c) => `stages[]=${c}`).join('&');
      for (let page = 1; page <= 10; page++) {
        const j = await leapGet(`/jobs?${stages}&date_range_type=job_stage_changed_date&start_date=${ymd(start)}&end_date=${ymd(end)}&limit=100&page=${page}&${incQS()}`);
        const arr = j.data || []; jobs.push(...arr);
        if (arr.length < 100) break;
      }
    } else return res.status(400).json({ error: 'pass ?job=<job number | customer name | Leap id>, ?sweep=<days>, or POST a Leap webhook' });

    const results = []; for (const j of jobs) results.push(await processJob(j, { debug }));
    const out = { count: results.length, results: results.map((r) => { const { _row, ...rest } = r; return rest; }) };
    if (write) out.written = await writeRows(results); else out.note = 'dry run — add &write=1 to write to the sheet';
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
module.exports.config = { maxDuration: 60 };
