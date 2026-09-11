// api/commission-probe.js — read-only probe for the commission automation.
// Pulls one Leap job and prints every number the Commission Calculator needs,
// from both the v3 developer API (LEAP_ACCESS_TOKEN) and the internal v1 API
// (same login as revenue.js / job-reps.js), so we can see which one exposes
// job cost, projected cost, insurance upgrade, and the Policy # field.
//
//   GET /api/commission-probe?name=Hal%20Poyta      customer name search
//   GET /api/commission-probe?num=2606-1234567-01   exact job number
//   add &raw=1 to include the raw job objects (large)
//
// Writes nothing to Leap. Reads only.

const V1 = 'https://jobprogress.com/api/public/api/v1';
const V3 = 'https://api.jobprogress.com/api/v3';
const CLIENT_ID = process.env.JP_CLIENT_ID || '12345';
const CLIENT_SECRET = process.env.JP_CLIENT_SECRET || '';
const COMPANY_ID = process.env.JP_COMPANY_ID || '5154';

// ── v1 auth (copied from job-reps.js) ───────────────────────────────────────
async function v1Login() {
  const username = process.env.JP_USERNAME, password = process.env.JP_PASSWORD;
  if (!username || !password) throw new Error('JP_USERNAME / JP_PASSWORD not set');
  const res = await fetch(`${V1}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, end_existing_sessions: '0' }).toString(),
  });
  if (!res.ok) throw new Error(`v1 login -> ${res.status}`);
  const d = await res.json();
  const t = (d && d.token && d.token.access_token) || (d && d.access_token);
  await fetch(`${V1}/users/switch_company`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: COMPANY_ID }).toString(),
  });
  return t;
}
const H1 = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json', platform: 'web' });
const H3 = (t) => ({ Authorization: `Bearer ${t}`, Accept: 'application/json' });

async function getJson(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { status: r.status, body };
  } catch (e) { return { status: 0, body: String(e && e.message || e) }; }
}

// Numbers can arrive as "1,200.00", "$1200", 1200, null.
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const nameOf = (p) => p ? (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null) : null;
const unwrap = (x) => (x && x.data !== undefined) ? x.data : x;

// Walk an object and collect every key that looks like money/cost/profit so we
// can see what the API actually returns without guessing field names.
function moneyish(obj, prefix = '', out = {}, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return out;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') { moneyish(v, path, out, depth + 1); continue; }
    if (/amount|price|cost|profit|total|upgrade|acv|rcv|deduct|supplement|policy|claim|overhead|margin|commission|expense|bill|paid|owed|revenue|projected/i.test(k)) out[path] = v;
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  const name = (url.searchParams.get('name') || '').trim();
  const numParam = (url.searchParams.get('num') || '').trim();
  const raw = url.searchParams.get('raw') === '1';
  if (!name && !numParam) return res.status(400).json({ error: 'pass ?name=Customer Name or ?num=job-number' });

  const out = { query: name || numParam, v1: {}, v3: {}, notes: [] };

  // ── v1: find the job ──────────────────────────────────────────────────────
  let v1Job = null, v1Token = null;
  try {
    v1Token = await v1Login();
    const qs = new URLSearchParams();
    if (numParam) qs.set('job_number', numParam); else qs.set('customer_name', name);
    ['customer', 'reps', 'estimators', 'division', 'insurance_details', 'financial_details', 'custom_fields', 'flags'].forEach((x) => qs.append('includes[]', x));
    qs.set('limit', '10');
    const r = await getJson(`${V1}/jobs?${qs}`, H1(v1Token));
    const arr = (r.body && (r.body.data || r.body.rows)) || [];
    out.v1.search = { status: r.status, matches: arr.map((j) => ({ id: j.id, number: j.number, customer: nameOf(j.customer), stage: j.current_stage && j.current_stage.name })) };
    v1Job = arr[0] || null;
    if (arr.length > 1) out.notes.push(`v1: ${arr.length} jobs matched — using the first (${v1Job.number}). Pass ?num= to pin one.`);
  } catch (e) { out.v1.error = String(e && e.message || e); }

  if (v1Job) {
    const id = v1Job.id;
    const cust = unwrap(v1Job.customer) || {};
    const ins = unwrap(v1Job.insurance_details) || {};
    out.v1.job = {
      id, number: v1Job.number, name: v1Job.name,
      customer: nameOf(cust), customer_rep: nameOf(unwrap(cust.rep)),
      job_reps: (unwrap(v1Job.reps) || []).map(nameOf),
      referred_by_type: cust.referred_by_type ?? cust.referred_type ?? null,
      referred_by: cust.referred_by_name ?? cust.referred_by ?? (cust.referred_by_referral && cust.referred_by_referral.name) ?? null,
      division: v1Job.division && (unwrap(v1Job.division) || {}).name,
      current_stage: v1Job.current_stage,
      stage_last_modified: v1Job.stage_last_modified,
      completion_date: v1Job.completion_date,
      insurance: v1Job.insurance,
      insurance_details: { upgrade: ins.upgrade, policy_number: ins.policy_number, acv: ins.acv, rcv: ins.rcv, supplement: ins.supplement, total: ins.total, deductable_amount: ins.deductable_amount, claim_number: ins.claim_number },
      financial_details_include: moneyish(unwrap(v1Job.financial_details)),
      top_level_money_fields: moneyish(v1Job, '', {}, 0),
    };
    // Try every plausible v1 sub-endpoint for job financials and report what answers.
    const tries = ['financial_summary', 'financial_details', 'financials', 'job_price', 'price_and_profit', 'profit_loss', 'job_costs', 'expenses', 'vendor_bills', 'bills', 'invoices', 'payments', 'change_orders', 'proposals', 'worksheets', 'estimates', 'commissions', 'sale_commissions', 'workflow_history'];
    out.v1.endpoints = {};
    for (const p of tries) {
      const r = await getJson(`${V1}/jobs/${id}/${p}`, H1(v1Token));
      if (r.status === 200) out.v1.endpoints[p] = raw ? r.body : moneyish(r.body);
      else out.v1.endpoints[p] = `HTTP ${r.status}`;
      await new Promise((ok) => setTimeout(ok, 120));
    }
    // Leap's Financials page also lives at /jobs/{id}/financial_summary in the web app; some builds use ?job_id=
    for (const p of ['job/financial_summary', 'financial_summary', 'jobs/financial_details', 'job_price_and_profit', 'commissions']) {
      const r = await getJson(`${V1}/${p}?job_id=${id}`, H1(v1Token));
      if (r.status === 200) out.v1.endpoints[`${p}?job_id`] = raw ? r.body : moneyish(r.body);
      await new Promise((ok) => setTimeout(ok, 120));
    }
    if (raw) out.v1.raw_job = v1Job;
  }

  // ── v3: developer API ─────────────────────────────────────────────────────
  const t3 = process.env.LEAP_ACCESS_TOKEN || process.env.LEAP_API_TOKEN;
  if (!t3) out.v3.error = 'LEAP_ACCESS_TOKEN not set';
  else {
    const qs = new URLSearchParams();
    if (numParam) qs.set('job_number', numParam); else qs.set('customer_name', name);
    ['customer', 'reps', 'division', 'insurance_details', 'financial_details', 'custom_fields'].forEach((x) => qs.append('includes[]', x));
    qs.set('limit', '10');
    const r = await getJson(`${V3}/jobs?${qs}`, H3(t3));
    const arr = (r.body && r.body.data) || [];
    out.v3.search = { status: r.status, matches: arr.map((j) => ({ id: j.id, number: j.number, stage: j.current_stage && j.current_stage.name })) };
    const j = arr.find((x) => v1Job && x.number === v1Job.number) || arr[0];
    if (j) {
      const ins = unwrap(j.insurance_details) || {};
      const cust = unwrap(j.customer) || {};
      out.v3.job = {
        id: j.id, number: j.number, current_stage: j.current_stage, completion_date: j.completion_date,
        customer_rep: nameOf(unwrap(cust.rep)), referred_by_type: cust.referred_by_type ?? null,
        insurance_details: { upgrade: ins.upgrade, policy_number: ins.policy_number, acv: ins.acv, rcv: ins.rcv, supplement: ins.supplement, total: ins.total },
        financial_details_include: moneyish(unwrap(j.financial_details)),
      };
      const fs = await getJson(`${V3}/jobs/${j.id}/financial_summary`, H3(t3));
      out.v3.financial_summary = fs.status === 200 ? (fs.body.data || fs.body) : `HTTP ${fs.status}`;
      const vb = await getJson(`${V3}/jobs/${j.id}/vendor_bills?includes[]=vendor&limit=100`, H3(t3));
      if (vb.status === 200) {
        const bills = (vb.body.data || []);
        out.v3.vendor_bills = { count: bills.length, total: bills.reduce((s, b) => s + (num(b.total_amount ?? b.amount ?? b.total) || 0), 0), bills: bills.map((b) => ({ vendor: nameOf(unwrap(b.vendor)) || (b.vendor && b.vendor.display_name), amount: b.total_amount ?? b.amount ?? b.total, date: b.bill_date, number: b.bill_number })) };
      } else out.v3.vendor_bills = `HTTP ${vb.status}`;
      const wh = await getJson(`${V3}/jobs/${j.id}/workflow_history`, H3(t3));
      out.v3.workflow_history = wh.status === 200 ? (wh.body.data || []).map((s) => ({ stage: s.stage, start: s.start_date, done: s.completed_date })) : `HTTP ${wh.status}`;
      if (raw) out.v3.raw_job = j;
    }
  }

  // ── Trial commission math (sheet chain) from whatever we found ───────────
  const v3fs = out.v3.financial_summary && typeof out.v3.financial_summary === 'object' ? out.v3.financial_summary : {};
  const insSrc = (out.v1.job && out.v1.job.insurance_details) || (out.v3.job && out.v3.job.insurance_details) || {};
  const D = num(v3fs.total_job_price);
  const E = num(insSrc.upgrade);
  const K = num(insSrc.policy_number);
  const I = out.v3.vendor_bills && typeof out.v3.vendor_bills === 'object' ? out.v3.vendor_bills.total : null;
  const calc = { D_final_job_price: D, E_upgrade_amount: E, I_job_cost_from_vendor_bills: I, K_upgrades_cost_from_policy_field: K };
  if (D != null && E != null && I != null) {
    const F = D - E, G = F * 0.10, Hh = F - G, J = Hh - I, L = J + (K || 0);
    Object.assign(calc, { F_acv: F, G_overhead_10pct: G, H_net: Hh, J_insurance_profit: J, L_true_insurance_profit: L,
      M_at_40pct: L * 0.40, M_at_50pct: L * 0.50, M_at_60pct: L * 0.60, N_upgrade_bonus_5pct: E * 0.05 });
  } else calc.note = 'one or more inputs missing — see notes / endpoints above for where they may live';
  out.trial_math = calc;

  res.status(200).json(out);
};
