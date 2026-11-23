// api/marketing.js - Marketing division appointments, LIVE.
//
// WHY THIS CHANGED (2026-08-19):
// This file used to be a hand-built snapshot. The last one was written on
// 2026-08-15 and its newest appointment was 2026-08-10, so the dashboard had
// been showing a frozen, eight-day-old picture. It was also built from
// DataBuilder report 3197, which despite its name did NOT filter by division -
// it filtered on a hardcoded list of 10 rep names, hiding roughly two thirds
// of the appointments. August showed 14. The real number is 62.
//
// This version reads Leap's own Appointments Report endpoint, filtered the way
// it was always meant to be: division_ids[] = 7399 (Marketing). No name lists.
//
//   Marketing appointments, verified 2026-08-19:  YTD 804 | Aug 62 | Jul 83
//
// Range defaults to Jan 1 -> +90 days so UPCOMING booked appointments are
// included, not just past ones.
//
// GOOGLE LSA SPEND IS MANUAL and must never be auto-altered. It is read from
// the Google LSA billing console by hand and pasted into SPEND below.
//
// MARKETING COST MODEL (2026-08-20). The page used to divide by LSA spend
// alone, which understated cost per appointment - it ignored Facebook and the
// marketing company entirely. Three sources now roll up into a total:
//   1. Google LSA      - manual, SPEND below
//   2. Facebook ads    - live from the Meta Marketing API when
//                        META_ACCESS_TOKEN + META_AD_ACCOUNT_ID are set in
//                        Vercel, otherwise the manual FACEBOOK.byMonth block
//   3. Agency retainer - AGENCY, an effective-dated schedule
//
// AGENCY is a LIST, not a single number, on purpose. The fee is going up in a
// few months. If that were one editable figure, raising it would retroactively
// change the cost per appointment for every month already closed - July's
// numbers would move because of a November price change. Adding a dated row
// instead leaves history alone. Same rule for the other two if they get
// restated: add a row, never rewrite one.
//
// ?start=YYYY-MM-DD&end=YYYY-MM-DD | ?debug=1 | ?costs=1
const V1 = 'https://jobprogress.com/api/public/api/v1';
const CO = process.env.JP_COMPANY_ID || '5154';
const MARKETING_DIVISION = 7399;

// --- MANUAL: Google Local Services spend. Read from the MCC report
// (Aug 1-31, 2026, Cost column) on 2026-09-03. Three accounts from August on:
// 477-447-4205 and 819-103-9280 (tracked since June) plus 552-749-0839, added
// for August, so Jun/Jul do not include it and are slightly understated by
// comparison. 168-374-3174 exists but spent $0.00 in August.
//   2026-08: 477-447-4205 $17,208.52 + 819-103-9280 $3,908.32 + 552-749-0839 $876.86
// August is FINAL. partialMonth is null until September is read mid-month.
//   2026-09: Sep 1-9, 2026, read 2026-09-09 from the MCC Accounts > Performance table:
//            477-447-4205 $3,383.10 + 819-103-9280 $1,053.65 + 552-749-0839 $171.82 = $4,608.57 (168-374-3174 $0.00).
//            (superseded below)
//   2026-09: Sep 1-30, 2026 ("Last month"), read 2026-10-20: 477-447-4205 $17,521.37 + 819-103-9280 $2,769.83
//            + 552-749-0839 $639.72 = $20,930.92 (168-374-3174 $0.00). FINAL.
//   2026-10: Oct 1-20, 2026, read 2026-10-20: 477-447-4205 $5,838.06 + 819-103-9280 $3,149.12
//            + 552-749-0839 $475.81 = $9,462.99 (168-374-3174 $0.00).
//            (superseded below)
//   2026-10: Oct 1-31, 2026 ("Last month"), read 2026-11-10: 477-447-4205 $7,943.22 + 819-103-9280 $3,762.10
//            + 552-749-0839 $475.81 = $12,181.13 (168-374-3174 $0.00). FINAL.
//   2026-11: Nov 1-10, 2026, read 2026-11-10: 477-447-4205 $943.27 + 819-103-9280 $166.45
//            + 552-749-0839 $310.59 = $1,420.31 (168-374-3174 $0.00).
//            PARTIAL - replace with the Nov 1-30 figure in early December and set partialMonth back to null.
//
// 2026-11-23 RESTRUCTURE - spend is now kept PER ACCOUNT, and each account belongs to an office.
// Why: 552-749-0839 is the RVA LSA account, but the appointments on this page are Leap's
// Marketing division only, which holds no RVA appointments (checked 2026-11-23: no Richmond-area
// jobs are in Marketing and none in the Richmond division are tagged LSA). Dividing RVA spend by
// DC appointments overstated DC's cost per appointment. RVA spend is now reported on its own
// line and kept OUT of cost per appointment until RVA inbound appointments are tracked in Leap.
// Jun/Jul were recorded as a total of the two DC accounts only (552 did not exist yet).
//
// asOf: the last day a month's figure covers. A month without asOf is a full, final month.
// It replaces partialMonth, which could not say HOW FAR into the month a reading went - so a
// Nov 1-10 reading was treated as Nov 1-23 and the month-to-date cost read low.
// 2026-11-23 (later the same day) - SOURCE CHANGED TO GOOGLE ADS BILLING "NET COST".
// The figures above came from the MCC Accounts > Performance "Cost" column. That column
// counts every lead Google charged at the time, including leads later DISPUTED AND CREDITED.
// Billing > Summary "Net cost" is what was actually charged after those credits, so it is the
// number that matches the card statement. On 477-447-4205 the gap was large: Aug Cost
// $17,208.52 vs net $13,241.74, Sep $17,521.37 vs $15,781.82, Oct $7,943.22 vs $7,596.52.
// That gap is also where the old "pending credit" went - it is already netted in, so it is no
// longer shown as a separate figure.
//
// Read 2026-11-23 from Billing > Summary on each account (marketing@douglasroofs.com):
//   477-447-4205 "Douglas NOVA [LSA + Search]" - billing history starts March 2026. Its 7 Search
//     campaigns (incl. "PHLASH - Asphalt Shingle Roofing") are paused and spent $0 Jun 1-Nov 22,
//     so this account's spend is LSA only.
//   819-103-9280 "[LSA] Douglas Roofing - MD"
//   552-749-0839 "[LSA] Douglas Roofing - RVA" - spending all year (paid on a different card,
//     Visa ..0076). Aug is negative: a credit larger than that month's charges.
//   168-374-3174 "[LSA] Douglas PA" - $0, not listed.
// November is month-to-date as of the read (asOf). Re-read early December and drop the asOf.
const LSA_ACCOUNTS = [
  { id: '477-447-4205', label: 'Google LSA - NOVA', office: 'dc' },
  { id: '819-103-9280', label: 'Google LSA - MD', office: 'dc' },
  { id: '552-749-0839', label: 'Google LSA - RVA', office: 'rva' },
];
const SPEND = {
  currency: 'USD',
  source: 'Google Ads Billing > Summary, Net cost (after disputed-lead credits)',
  byAccount: {
    '2026-01': { '819-103-9280': 1307.39, '552-749-0839': 299.46 },
    '2026-02': { '819-103-9280': 1645.18, '552-749-0839': 1161.42 },
    '2026-03': { '477-447-4205': 14553.73, '819-103-9280': 8364.97, '552-749-0839': 2548.40 },
    '2026-04': { '477-447-4205': 17426.30, '819-103-9280': 4712.80, '552-749-0839': 188.46 },
    '2026-05': { '477-447-4205': 12888.64, '819-103-9280': 3701.94, '552-749-0839': 900.48 },
    '2026-06': { '477-447-4205': 14866.74, '819-103-9280': 3181.83, '552-749-0839': 331.86 },
    '2026-07': { '477-447-4205': 15494.14, '819-103-9280': 3463.77, '552-749-0839': 2299.39 },
    '2026-08': { '477-447-4205': 13241.74, '819-103-9280': 3572.74, '552-749-0839': -60.86 },
    '2026-09': { '477-447-4205': 15781.82, '819-103-9280': 2769.83, '552-749-0839': 639.72 },
    '2026-10': { '477-447-4205': 7596.52, '819-103-9280': 3762.10, '552-749-0839': 475.81 },
    '2026-11': { '477-447-4205': 2506.59, '819-103-9280': 712.21, '552-749-0839': 310.59 },
  },
  asOf: { '2026-11': '2026-11-22' },
  // The NOVA account has no billing before March 2026; Jan/Feb NOVA LSA spend is unknown.
  missing: { '477-447-4205': ['2026-01', '2026-02'] },
};
function acctByMonth(id) {
  const out = {};
  Object.keys(SPEND.byAccount).forEach((m) => { const v = SPEND.byAccount[m][id]; if (v !== undefined) out[m] = v; });
  return out;
}
function lsaRoll() {
  const all = {}, dc = {}, rva = {};
  LSA_ACCOUNTS.forEach((a) => {
    const by = acctByMonth(a.id), into = a.office === 'rva' ? rva : dc;
    Object.keys(by).forEach((m) => {
      all[m] = Math.round(((all[m] || 0) + by[m]) * 100) / 100;
      into[m] = Math.round(((into[m] || 0) + by[m]) * 100) / 100;
    });
  });
  return { all, dc, rva };
}
// Kept for anything still reading spend.byMonth (all LSA accounts, both offices).
SPEND.byMonth = lsaRoll().all;
SPEND.partialMonth = Object.keys(SPEND.asOf).sort().pop() || null;

// --- Facebook / Meta ads. Live from the Meta Marketing API when the env vars
// are set. Anything in byMonth below is a manual override and WINS over the
// API for that month - use it to pin a month the API reports differently, or
// to backfill months from before the token existed.
// One ad account, Herndon revenue. Same shape as SPEND above: each figure is
// that month's total charged to the card.
const FACEBOOK = {
  currency: 'USD',
  accounts: ['272377932099924 Douglas Roofing Inc'],
  // Read BY HAND because the Meta API token still does not exist.
  //   2026-07: from Billing > Payment activity on 2026-08-21; only the 27th and
  //            30th could be read before Meta forced a re-auth, so a FLOOR.
  //   2026-08: Ads Manager, Campaigns, Aug 1-31 2026, Amount spent, read
  //            2026-09-03. One campaign live (Alfred Duncan - Maryland,
  //            $1,102.93, 13 form leads); the other four were off at $0.00. FINAL.
  //   2026-09: Ads Manager, Campaigns, Sep 1-9 2026, Amount spent, read 2026-09-09. Same single live campaign
  //            (Alfred Duncan - Maryland, $303.32, 4 form leads); the other four still off at $0.00.
  //            (superseded below)
  //   2026-09: Sep 1-30 2026, Amount spent, read 2026-11-10: Alfred Duncan - Maryland $739.81 (15 form leads),
  //            all others $0.00. FINAL.
  //   2026-10: Oct 1-31 2026, read 2026-11-10: new campaign "PC | LEAD GENERATION | LOCAL AUDIENCE" $875.58;
  //            Alfred Duncan - Maryland now off ($0.00), others $0.00. FINAL.
  //   2026-11: Nov 1-10 2026, read 2026-11-10: PC | LEAD GENERATION | LOCAL AUDIENCE $345.99, others $0.00.
  //            (superseded below)
  //   2026-11: Nov 1-22 2026, read 2026-11-23: PC | LEAD GENERATION | LOCAL AUDIENCE $736.15,
  //            11/19/26 | CBO | Winter Check Up | 2 Video Ads $172.62, 2nd CBO Testing Campaign - Holiday Lights $130.18,
  //            CBO Testing Campaign - Holiday Lights $39.51, all others $0.00 = $1,078.46. PARTIAL (asOf below).
  //            Region breakdown: every campaign delivers to DC / MD / VA metro - all Meta spend is DC office.
  //            Second ad account 2356347398190484 has no payment method and has never spent.
  //   2026-02..07 (read 2026-11-23, Ads Manager, Jan 1-Jul 31 2026, Month breakdown): Ice Dams Feb $418.42;
  //            Alfred Duncan - Maryland Mar $983.49, May $981.00, Jun $1,068.91, Jul $1,104.14; every other
  //            campaign $0.00. July's old $186 was a floor read off Payment activity - replaced.
  byMonth: { '2026-02': 418.42, '2026-03': 983.49, '2026-05': 981.00, '2026-06': 1068.91, '2026-07': 1104.14,
    '2026-08': 1102.93, '2026-09': 739.81, '2026-10': 875.58, '2026-11': 1078.46 },
  asOf: { '2026-11': '2026-11-22' }, // same meaning as SPEND.asOf
  office: 'dc',
};
FACEBOOK.partialMonth = Object.keys(FACEBOOK.asOf).sort().pop() || null;

// --- Marketing company retainer. Effective-dated: each row applies from its
// month forward until the next row starts. To change the fee, ADD a row.
// Do not edit an existing row unless it was entered wrong to begin with.
const AGENCY = [
  // Phlash started July 2026. This row previously read 2026-01, which billed
  // the retainer against six months that never paid it - about $28,500 of
  // marketing cost the company never actually spent.
  { from: '2026-07', monthly: 4750, note: 'Phlash retainer, started July 2026' },
];

const MONTH_RE = /^\d{4}-\d{2}$/;
function monthsBetween(startISO, endISO) {
  const out = [];
  let y = +startISO.slice(0, 4), m = +startISO.slice(5, 7);
  const ey = +endISO.slice(0, 4), em = +endISO.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    out.push(y + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
// The rate in force for a given month is the latest row that starts on or
// before it. Months before the first row cost nothing.
function agencyFor(month) {
  const rows = AGENCY.filter((r) => MONTH_RE.test(r.from) && r.from <= month).sort((a, b) => (a.from < b.from ? -1 : 1));
  const r = rows[rows.length - 1];
  return r ? Number(r.monthly) || 0 : 0;
}
function agencyByMonth(startISO, endISO) {
  const out = {};
  monthsBetween(startISO, endISO).forEach((m) => { const v = agencyFor(m); if (v) out[m] = v; });
  return out;
}

// Meta Marketing API. Failure here must never take the page down - marketing
// numbers still render, Facebook just reports as unavailable and says why.
// META_AD_ACCOUNT_ID takes a COMMA-SEPARATED list. Douglas runs two ad
// accounts (2356347398190484 and 272377932099924) and both are marketing
// cost, so they are summed per month - the same way the two Google LSA
// accounts are already combined. One account failing does not discard the
// other: partial results are kept and the failure is reported.
async function metaSpend(startISO, endISO) {
  const token = process.env.META_ACCESS_TOKEN;
  const raw = process.env.META_AD_ACCOUNT_ID || '';
  const accts = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => (/^act_/.test(s) ? s : 'act_' + s));
  if (!token || !accts.length) {
    return { byMonth: {}, live: false, reason: 'META_ACCESS_TOKEN / META_AD_ACCOUNT_ID not set in Vercel' };
  }
  const ver = process.env.META_API_VERSION || 'v21.0';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);

  async function one(acct) {
    const qs = new URLSearchParams({
      fields: 'spend',
      level: 'account',
      time_increment: 'monthly',
      time_range: JSON.stringify({ since: startISO, until: endISO }),
      limit: '200',
      access_token: token,
    });
    const r = await fetch('https://graph.facebook.com/' + ver + '/' + acct + '/insights?' + qs.toString(), { signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
    const by = {};
    ((j && j.data) || []).forEach((row) => {
      const key = String(row.date_start || '').slice(0, 7);
      const amt = Number(row.spend);
      if (MONTH_RE.test(key) && !isNaN(amt)) by[key] = (by[key] || 0) + amt;
    });
    return by;
  }

  try {
    const settled = await Promise.all(accts.map((a) => one(a).then(
      (by) => ({ ok: true, acct: a, by }),
      (e) => ({ ok: false, acct: a, err: String((e && e.message) || e).slice(0, 120) })
    )));
    const byMonth = {};
    settled.filter((s) => s.ok).forEach((s) => {
      Object.keys(s.by).forEach((m) => { byMonth[m] = Math.round(((byMonth[m] || 0) + s.by[m]) * 100) / 100; });
    });
    const failed = settled.filter((s) => !s.ok);
    const okCount = settled.length - failed.length;
    return {
      byMonth,
      live: okCount > 0,
      accounts: accts,
      // Say so out loud when only some accounts reported - a silently partial
      // total is worse than no total at all.
      reason: failed.length ? ('Meta API: ' + failed.map((f) => f.acct + ' -> ' + f.err).join('; ') + (okCount ? ' (total is PARTIAL - ' + okCount + ' of ' + accts.length + ' accounts)' : '')) : '',
      partial: failed.length > 0 && okCount > 0,
    };
  } catch (e) {
    const msg = (e && e.name === 'AbortError') ? 'Meta API timed out after 9s' : String((e && e.message) || e).slice(0, 160);
    return { byMonth: {}, live: false, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

// 'No Demo' joined this list on 2026-09-02 at Kyle's direction: if no demo
// happened the appointment did not really run, so counting it flattered the run
// rate and deflated cost per appointment ran. On 2026 YTD that is 73 of 841
// appointments - the run rate moves 96% -> 87%.
//
// This is the SINGLE definition of "ran". marketing.html reads it from the API
// response rather than keeping its own copy, so the Ran column in By rep and the
// Cost per appt ran card can never drift apart.
const NOT_RAN = ['Customer Canceled Appointment', 'No Answer/No Appointment Actually Set', 'No Demo'];
// 2026-09-21, Kyle's direction: the CA Signed card on the marketing page is the Leap
// appointment result 'Claim Filed' (a claim actually filed), NOT the 'CA Signed' result;
// Retail / Repair is the 'Retail Sale' result only ('Repair Sold' is not counted).
// marketing.html reads both lists from the API, so the cards, calendar tags and By-rep
// columns all follow this one definition.
const CA_RESULTS = ['Claim Filed'];
const RETAIL_RESULTS = ['Retail Sale'];

async function login() {
  const u = process.env.JP_USERNAME, p = process.env.JP_PASSWORD;
  const ci = process.env.JP_CLIENT_ID, cs = process.env.JP_CLIENT_SECRET;
  if (!u || !p || !ci || !cs) throw new Error('JP_* env vars not fully set in Vercel');
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
async function bind(t) {
  await fetch(V1 + '/users/switch_company', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', platform: 'web' },
    body: new URLSearchParams({ company_id: CO }).toString(),
  });
  return t;
}
// Leap allows ONE session per account, so a second login silently kills the
// first login's token. The old retry made that WORSE: on a 401 it nulled the
// in-flight promise, so every parallel fetch started its own login and each
// new login invalidated the last one.
//
// Two rules fix it:
//   1. Single-flight - a caller arriving during a login awaits the SAME
//      promise instead of kicking off another one.
//   2. Generation guard - a 401 only clears the token it actually used, so a
//      straggler cannot throw away a good token someone else just fetched.
let cached = null, pending = null, gen = 0;
function token() {
  if (cached) return Promise.resolve({ t: cached, g: gen });
  if (!pending) {
    pending = (async () => {
      try {
        const t = await bind(await login());
        cached = t;
        gen += 1;
        return { t: t, g: gen };
      } finally {
        // Cleared only AFTER cached is set, so the next caller sees the token
        // rather than racing to fetch another one.
        pending = null;
      }
    })();
  }
  return pending;
}
function invalidate(g) { if (g === gen) cached = null; }
const HDR = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/json', platform: 'web' });

// Leap allows one session per account, so another caller can invalidate this
// token mid-request. Retry once with a fresh login rather than failing.
async function get(path) {
  let a = await token();
  let r = await fetch(V1 + path, { headers: HDR(a.t) });
  if (r.status === 401 || r.status === 403 || r.status === 409) { // 409 = Leap session bound to another company/login; re-login once
    invalidate(a.g);
    a = await token();
    r = await fetch(V1 + path, { headers: HDR(a.t) });
  }
  if (!r.ok) throw new Error('GET ' + path.split('?')[0] + ' -> ' + r.status);
  return r.json();
}

const INC = '&includes[]=customer&includes[]=jobs&includes[]=result_option';
function apptUrl(s, e, page) {
  return '/reports/appointments?date_range_type[]=appointment_duration_date&division_ids[]=' + MARKETING_DIVISION +
    '&duration=DUR&start_date=' + s + '&end_date=' + e + INC +
    '&limit=100&page=' + page + '&sort_by=created_at&sort_order=desc';
}
async function pullAppointments(s, e) {
  const first = await get(apptUrl(s, e, 1));
  const rows = (first.data || []).slice();
  const pg = (first.meta && first.meta.pagination) || {};
  const totalPages = Math.min(pg.total_pages || 1, 30);
  if (totalPages > 1) {
    const ps = [];
    for (let p = 2; p <= totalPages; p++) ps.push(get(apptUrl(s, e, p)));
    (await Promise.all(ps)).forEach((j) => { (j.data || []).forEach((x) => rows.push(x)); });
  }
  return rows;
}

const un = (o) => (o && (o.data !== undefined ? o.data : o)) || null;
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

function mapRow(a) {
  const user = un(a.user) || {};
  const cust = un(a.customer) || {};
  const jbs = un(a.jobs);
  const job = Array.isArray(jbs) ? (jbs[0] || {}) : (jbs || {});
  const ro = un(a.result_option) || {};
  const stage = job.current_stage && job.current_stage.name;
  return {
    // Leap returns "YYYY-MM-DD HH:MM:SS"; the calendar keys on the date part.
    d: String(a.start_date_time || '').slice(0, 10),
    time: String(a.start_date_time || '').slice(11, 16),
    rep: clean(user.full_name) || clean([user.first_name, user.last_name].filter(Boolean).join(' ')) || '(no rep)',
    cust: clean(cust.full_name) || clean(a.title) || '(no customer)',
    // Result names in Leap carry stray trailing spaces ("Retail Sale ").
    res: clean(ro.name),
    stage: clean(stage) === 'Unknown' ? '' : clean(stage),
    src: clean(cust.source_type) || clean(cust.referred_by_type),
    title: clean(a.title),
    job: clean(job.number),
    completed: !!a.is_completed,
  };
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'http://localhost');
    const now = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const okd = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

    const qs = url.searchParams.get('start'), qe = url.searchParams.get('end');
    // Default window: start of this year through 90 days out, so booked
    // upcoming appointments are part of the payload.
    const start = okd(qs) ? qs : iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
    const end = okd(qe) ? qe : iso(new Date(now.getTime() + 90 * 86400000));

    // Meta runs alongside the Leap pull, not after it - it must not add to
    // wall-clock time, and it must not be able to fail the request.
    const metaP = metaSpend(start, end).catch((e) => ({ byMonth: {}, live: false, reason: String((e && e.message) || e) }));

    const raw = await pullAppointments(start, end);
    const records = raw.map(mapRow).filter((r) => r.d).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

    const meta = await metaP;
    // Manual entries win over the API for the same month.
    const fbByMonth = Object.assign({}, meta.byMonth, FACEBOOK.byMonth);
    // lsa / facebook / agency = DC office, the spend behind the Marketing-division appointments
    // on this page. lsaRva = RVA LSA, reported separately and NOT in cost per appointment.
    const roll = lsaRoll();
    // One entry per Google account that spends, so the page shows each on its own line.
    const lsaAccounts = LSA_ACCOUNTS.map((a) => ({ id: a.id, label: a.label, office: a.office, byMonth: acctByMonth(a.id),
      asOf: SPEND.asOf, missing: (SPEND.missing && SPEND.missing[a.id]) || [], excluded: a.office === 'rva' }));
    const costs = {
      lsaAccounts,
      lsa: { label: 'Google LSA - DC', byMonth: roll.dc, source: SPEND.source, accounts: ['477-447-4205 NOVA', '819-103-9280 MD'], asOf: SPEND.asOf, partialMonth: SPEND.partialMonth, office: 'dc' },
      facebook: { label: 'Meta ads', byMonth: fbByMonth, source: meta.live ? 'live - Meta Marketing API' : 'manual - Ads Manager', live: meta.live, partial: !!meta.partial, note: meta.reason, accounts: meta.accounts || FACEBOOK.accounts, overrides: Object.keys(FACEBOOK.byMonth), asOf: FACEBOOK.asOf, partialMonth: FACEBOOK.partialMonth || null, office: 'dc' },
      agency: { label: 'Marketing company', byMonth: agencyByMonth(start, end), source: 'retainer schedule', schedule: AGENCY, current: agencyFor(new Date().toISOString().slice(0, 7)), office: 'dc' },
      lsaRva: { label: 'Google LSA - RVA', byMonth: roll.rva, source: SPEND.source, accounts: ['552-749-0839 RVA'], asOf: SPEND.asOf, office: 'rva', excluded: true,
        why: 'RVA LSA leads are not in the Leap Marketing division, so there are no RVA appointments here to divide this by.' },
      lsaByAccount: SPEND.byAccount,
    };

    if (url.searchParams.get('costs') === '1') {
      res.status(200).json({ range: { start, end }, costs, meta: { live: meta.live, reason: meta.reason, account: meta.account } });
      return;
    }

    if (url.searchParams.get('debug') === '1') {
      res.status(200).json({ pulled: raw.length, mapped: records.length, start, end, sample: records.slice(0, 3), rawKeys: Object.keys(raw[0] || {}) });
      return;
    }

    const today = iso(now);
    // Cached at Vercel's edge (2026-11-10): served instantly for 5 min, then the stale copy is served while a
    // fresh one is fetched in the background. The Refresh buttons add ?fresh=<time> to force a live pull, and
    // .github/workflows/warm-cache.yml re-pulls every page's URLs during business hours.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).json({
      updated: new Date().toISOString(),
      today,
      year: now.getUTCFullYear(),
      division: 'Marketing (' + MARKETING_DIVISION + ')',
      range: { start, end },
      source: 'Leap Appointments Report, division_ids[]=' + MARKETING_DIVISION,
      notRan: NOT_RAN,
      caResults: CA_RESULTS,
      retailResults: RETAIL_RESULTS,
      spend: SPEND,
      costs,
      counts: {
        total: records.length,
        past: records.filter((r) => r.d <= today).length,
        upcoming: records.filter((r) => r.d > today).length,
        unresulted: records.filter((r) => r.d <= today && !r.res).length,
      },
      records,
    });
  } catch (e) {
    res.status(200).json({ updated: new Date().toISOString(), records: [], spend: SPEND, costs: null, error: String((e && e.message) || e) });
  }
};
module.exports.config = { maxDuration: 60 };
