/**
 * Leap → Amplify revenue sync  (v1 — single rep, Herndon first)
 * --------------------------------------------------------------------------
 * Pulls per-job DOCUMENT TOTAL from each office's Leap DataBuilder report and
 * pushes it to Amplify (SalesScreen) as revenue activities:
 *   • Document Total on the Job Awarded Date     → "Approved $"
 *   • Document Total on the Contract Signed Date  → "Contract $"
 * Credited to the single Leap "Sales Rep" (setter/closer split is a later v2).
 * Nothing is written to SalesRabbit.
 *
 * Runtime: Vercel serverless function. Trigger manually at /api/revenue-sync
 * or add the daily cron in vercel.json (bottom of file).
 *
 * SECRETS — read only from Vercel env vars (exact case-sensitive names):
 *   herndon    Leap API token, Herndon account
 *   Richmond   Leap API token, Richmond account   (v2)
 *   ampliphy   Amplify (SalesScreen) API key
 * --------------------------------------------------------------------------
 */

// ── Per-office config ──────────────────────────────────────────────────────
const OFFICES = [
  { name: "herndon", reportId: 3955, keyEnv: "herndon" },     // "Amplify Revenue Sync - Herndon"
  // { name: "richmond", reportId: null, keyEnv: "Richmond" },  // v2 — build the same report in Richmond
];

// Column display-names in the DataBuilder report (confirmed against report 3955).
const FIELD_NAMES = {
  rep:           "Sales Rep / Customer Rep",
  documentTotal: "Document Sub Total Amount",   // shows as "(Sum)" in the UI
  awardedDate:   "Job Awarded Date",
  contractDate:  "Job Contract Signed Date",
};

// Rep name (from Leap, "First Last") → Amplify user email.
const REP_EMAIL = {
  "Kelly Alston": "kelly@douglasroofs.com",
  "Steven Arevalo": "steven@douglasroofs.com",
  "Joshua Baca": "joshua@douglasroofs.com",
  "Dalton Barr": "dalton@douglasroofs.com",
  "haley barry": "haley@douglasroofs.com",
  "sean beasy": "sean@douglasroofs.com",
  "George Bechara": "gbechara@douglasroofs.com",
  "Christian Brown": "christian@douglasroofs.com",
  "Logan Burbic": "logan@douglasroofs.com",
  "Justin Coghill": "justin@douglasroofs.com",
  "Bryan Courtney": "bryan@douglasroofs.com",
  "Alfred Duncan": "alfred@douglasroofs.com",
  "Terry Eggleston": "terry@douglasroofs.com",
  "Andrew Funk": "andrew@douglasroofs.com",
  "Aiden Glonek": "aiden@douglasroofs.com",
  "Kenny Gonzalez": "kenny@douglasroofs.com",
  "Andrew Harris": "andrew.h@douglasroofs.com",
  "David Kerns": "david@douglasroofs.com",
  "Travis Kizzar": "travis@douglasroofs.com",
  "Solomon Lincoln Jr.": "solomon@douglasroofs.com",
  "Kevin Mahan": "kevin@douglasroofs.com",
  "Carter Massengill": "carter.m@douglasroofs.com",
  "Kevin Mccann": "kevinm@douglasroofs.com",
  "Mike Mccarthy": "michaelmccarthy@douglasroofs.com",
  "Marc Mitchell": "marc@douglasroofs.com",
  "Adam Mulvaney": "adam@douglasroofs.com",
  "Robert Mumford-Wilson": "robert@douglasroofs.com",
  "Jack Obert": "jack@douglasroofs.com",
  "Felipe Osorio": "felipe@douglasroofs.com",
  "Izzy Price": "isabelle@douglasroofs.com",
  "Andrew Prickel": "andrewprickel@douglasroofs.com",
  "Pedro Ramirez": "pedro@douglasroofs.com",
  "Cristina Saunders": "cristina@douglasroofs.com",
  "marcus schanewolf": "marcus@douglasroofs.com",
  "mike schoultz": "mike@douglasroofs.com",
  "nick seward": "nick@douglasroofs.com",
  "Harvey Shoemaker": "harvey@douglasroofs.com",
  "Brandon Simmons": "brandon@douglasroofs.com",
  "JR Zaguehi": "jr@douglasroofs.com",
  // Leap also shows reps not in Amplify (e.g. Johnathan Lawton, Tyler
  // Prillaman, Trey Thompson) — add them here to credit, else skipped.
};

const ACTIVITY_APPROVED = "Approved Revenue";
const ACTIVITY_CONTRACT = "Contract Signed Revenue";
const AMPLIFY_PUSH_URL = "https://connect.salesscreen.com/api/v1/Record/Add";
const LEAP_REPORTING_BASE = "https://reporting-api.jobprogress.com";

// ── Leap extraction ────────────────────────────────────────────────────────
async function fetchReportRows(office) {
  const token = process.env[office.keyEnv];
  if (!token) throw new Error(`Missing env var ${office.keyEnv}`);
  if (!office.reportId) { console.warn(`No reportId for ${office.name} — skipping`); return []; }

  const auth = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  const cfgRes = await fetch(`${LEAP_REPORTING_BASE}/api/reports/${office.reportId}`, { headers: auth });
  if (!cfgRes.ok) throw new Error(`${office.name} report config ${cfgRes.status} (check Leap key reaches reporting API)`);
  const cfg = await cfgRes.json();
  const fields = cfg.data.configurations.fields;
  const uuidOf = (label) => {
    const f = fields.find((x) => x.display_name === label);
    if (!f) throw new Error(`${office.name}: report missing column "${label}"`);
    return f.uuid;
  };
  const cols = Object.fromEntries(Object.entries(FIELD_NAMES).map(([k, label]) => [k, uuidOf(label)]));

  const yr = new Date().getFullYear();
  const dateFilter = {
    uuid: cols.awardedDate, display_name: FIELD_NAMES.awardedDate,
    filters: [{ keyword: "between", value: `${yr}-01-01 00:00:00`, value2: `${yr}-12-31 23:59:59`, date_type: "custom" }],
  };
  let rows = [], page = 1;
  while (true) {
    const res = await fetch(`${LEAP_REPORTING_BASE}/api/get-data`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ report_id: office.reportId, fields, filters: [dateFilter], page, per_page: 100 }),
    });
    if (!res.ok) throw new Error(`${office.name} get-data ${res.status}`);
    const d = await res.json();
    const batch = d.data || [];
    rows = rows.concat(batch.map((r) => mapRow(r, cols, office.name)));
    const last = (d.meta && d.meta.last_page) || 1;
    if (page >= last || batch.length < 100) break;
    page++;
  }
  return rows;
}

function mapRow(raw, cols, office) {
  const val = (uuid) => raw[uuid] ?? raw[`f_${uuid}`] ?? null;
  return {
    office,
    jobId:         raw.id || "",
    rep:           (val(cols.rep) || "").trim(),
    documentTotal: parseFloat(val(cols.documentTotal)) || 0,
    awardedDate:   val(cols.awardedDate),
    contractDate:  val(cols.contractDate),
  };
}

function toISO(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt) ? null : dt.toISOString();
}

// ── Transform → SalesScreen records (single rep; Doc Total on each date) ────
// Office split is automatic: each rep belongs to a Department (DC Office /
// Richmond) in Amplify, so revenue lands on the right office board.
function toRegistrations(row) {
  const regs = [];
  const email = REP_EMAIL[row.rep];
  if (!email) { console.warn(`No email mapping for rep "${row.rep}" — skipped`); return regs; }
  if (!row.documentTotal) return regs;

  const record = (activityTypeName, date, suffix) => ({
    id: `${row.office}-${row.jobId}-${suffix}`,  // unique record id → idempotent
    activityTypeName,
    user: { id: email, email },
    activity: { key: "Revenue", name: "" },
    quantity: 1,
    value1: row.documentTotal,                   // → the "Amount" field the metric sums
    createdDate: toISO(date),                    // drives the period (awarded vs contract)
  });

  if (row.awardedDate)  regs.push(record(ACTIVITY_APPROVED, row.awardedDate,  "approved"));
  if (row.contractDate) regs.push(record(ACTIVITY_CONTRACT, row.contractDate, "contract"));
  return regs;
}

// ── Amplify push (POST a list, header apiKey) ──────────────────────────────
async function pushToAmplify(records) {
  const key = process.env.ampliphy;
  if (!key) throw new Error("Missing env var ampliphy");
  let ok = 0;
  const CHUNK = 100;                                         // rate limit 200/min
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = records.slice(i, i + CHUNK);
    const res = await fetch(AMPLIFY_PUSH_URL, {
      method: "POST",
      headers: { apiKey: key, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length;
    else console.error("push batch failed", res.status, await res.text());
    await new Promise((r) => setTimeout(r, 1000));
  }
  return ok;
}

// ── Entry point (Vercel serverless handler) ────────────────────────────────
export default async function handler(req, res) {
  try {
    let allRegs = [];
    for (const office of OFFICES) {
      const rows = await fetchReportRows(office);
      for (const row of rows) allRegs = allRegs.concat(toRegistrations(row));
    }
    const pushed = await pushToAmplify(allRegs);
    console.log(`Revenue sync OK — ${allRegs.length} built, ${pushed} pushed.`);
    res.status(200).json({ ok: true, built: allRegs.length, pushed });
  } catch (e) {
    console.error("Revenue sync FAILED:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}

// vercel.json cron (optional, daily 7am ET):
// { "crons": [{ "path": "/api/revenue-sync", "schedule": "0 11 * * *" }] }
