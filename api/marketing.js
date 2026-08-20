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

// --- MANUAL: Google Local Services spend. Two accounts, both Herndon revenue.
// Only Jun-Aug are exposed on the billing card; earlier months need
// "View transactions and documents". August is partial.
const SPEND = {
  currency: 'USD',
  partialMonth: '2026-08',
  pendingCredit: 3484.78,
  accounts: ['477-447-4205 NOVA', '819-103-9280 MD-labelled'],
  byMonth: { '2026-06': 21867.14, '2026-07': 22428.70, '2026-08': 12514.29 },
};

// --- Facebook / Meta ads. Live from the Meta Marketing API when the env vars
// are set. Anything in byMonth below is a manual override and WINS over the
// API for that month - use it to pin a month the API reports differently, or
// to backfill months from before the token existed.
const FACEBOOK = { currency: 'USD', byMonth: {} };

// --- Marketing company retainer. Effective-dated: each row applies from its
// month forward until the next row starts. To change the fee, ADD a row.
// Do not edit an existing row unless it was entered wrong to begin with.
const AGENCY = [
  { from: '2026-01', monthly: 4750, note: 'current retainer' },
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
async function metaSpend(startISO, endISO) {
  const token = process.env.META_ACCESS_TOKEN;
  let acct = process.env.META_AD_ACCOUNT_ID || '';
  if (!token || !acct) {
    return { byMonth: {}, live: false, reason: 'META_ACCESS_TOKEN / META_AD_ACCOUNT_ID not set in Vercel' };
  }
  if (!/^act_/.test(acct)) acct = 'act_' + acct.replace(/^act_/, '');
  const ver = process.env.META_API_VERSION || 'v21.0';
  const qs = new URLSearchParams({
    fields: 'spend',
    level: 'account',
    time_increment: 'monthly',
    time_range: JSON.stringify({ since: startISO, until: endISO }),
    limit: '200',
    access_token: token,
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://graph.facebook.com/' + ver + '/' + acct + '/insights?' + qs.toString(), { signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const em = (j && j.error && j.error.message) || ('HTTP ' + r.status);
      return { byMonth: {}, live: false, reason: 'Meta API: ' + String(em).slice(0, 160) };
    }
    const byMonth = {};
    ((j && j.data) || []).forEach((row) => {
      const key = String(row.date_start || '').slice(0, 7);
      const amt = Number(row.spend);
      if (MONTH_RE.test(key) && !isNaN(amt)) byMonth[key] = Math.round(amt * 100) / 100;
    });
    return { byMonth, live: true, account: acct, reason: '' };
  } catch (e) {
    const msg = (e && e.name === 'AbortError') ? 'Meta API timed out after 9s' : String((e && e.message) || e).slice(0, 160);
    return { byMonth: {}, live: false, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

const NOT_RAN = ['Customer Canceled Appointment', 'No Answer/No Appointment Actually Set'];
const CA_RESULTS = ['CA Signed'];
const RETAIL_RESULTS = ['Retail Sale', 'Repair Sold'];

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
let cached = null, pending = null;
function token() {
  if (cached) return Promise.resolve(cached);
  if (!pending) pending = (async () => { cached = await bind(await login()); return cached; })();
  return pending;
}
const HDR = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/json', platform: 'web' });

// Leap allows one session per account, so another caller can invalidate this
// token mid-request. Retry once with a fresh login rather than failing.
async function get(path) {
  let t = await token();
  let r = await fetch(V1 + path, { headers: HDR(t) });
  if (r.status === 401 || r.status === 403) {
    cached = null; pending = null;
    t = await token();
    r = await fetch(V1 + path, { headers: HDR(t) });
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
    const costs = {
      lsa: { label: 'Google LSA', byMonth: SPEND.byMonth, source: 'manual - LSA billing console', accounts: SPEND.accounts, pendingCredit: SPEND.pendingCredit, partialMonth: SPEND.partialMonth },
      facebook: { label: 'Facebook ads', byMonth: fbByMonth, source: meta.live ? 'live - Meta Marketing API' : 'manual', live: meta.live, note: meta.reason, overrides: Object.keys(FACEBOOK.byMonth) },
      agency: { label: 'Marketing company', byMonth: agencyByMonth(start, end), source: 'retainer schedule', schedule: AGENCY, current: agencyFor(new Date().toISOString().slice(0, 7)) },
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
