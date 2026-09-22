#!/usr/bin/env node
// scripts/refresh-punchout.js -- keep data/punchout-ledger.json current from /api/job-reps?punchout=1.
//
// Leap never records WHEN the PUNCH OUT customer flag was applied, so this ledger is the memory:
//   customers[<customer_id>] = { first_seen, last_seen, customer, rep, number }   (still open)
//   resolved[]              = { ...same, resolved, days }                          (dropped off the board)
// first_seen is the earlier of the Punch Out stage entry date (when the endpoint knows it) and the
// first night this script saw the customer. Once written, first_seen is never moved later.
//
// Run nightly by .github/workflows/refresh-snapshots.yml after the SR snapshots; the commit redeploys
// Vercel, and api/job-reps.js require()s the fresh ledger.
// Usage: node scripts/refresh-punchout.js   (BASE_URL defaults to https://stats.douglasroofs.com)

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const FILE = path.resolve(__dirname, '..', 'data', 'punchout-ledger.json');
const TIMEOUT_MS = 240000;

const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); // YYYY-MM-DD
const dayDiff = (a, b) => Math.max(0, Math.round((Date.parse(String(b).slice(0, 10) + 'T12:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T12:00:00Z')) / 86400000));

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}, non-JSON body: ${text.slice(0, 200)}`); }
    if (!res.ok || (json && json.error)) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
  } catch (e) {
    if (attempt < 3) { console.log(`  retrying after: ${e.message}`); return fetchJson(url, attempt + 1); }
    throw e;
  }
}

async function main() {
  let ledger = { updated: null, customers: {}, resolved: [] };
  if (fs.existsSync(FILE)) ledger = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  ledger.customers = ledger.customers || {}; ledger.resolved = ledger.resolved || [];

  const url = `${BASE}/api/job-reps?punchout=1&t=${Date.now()}`;
  console.log(`GET ${url}`);
  const board = await fetchJson(url);
  if (!Array.isArray(board.rows)) throw new Error('response has no rows[]');
  const today = nyToday();
  const open = new Set();
  const added = [], cleared = [];

  for (const r of board.rows) {
    const id = String(r.customer_id);
    open.add(id);
    const cur = ledger.customers[id];
    // Stage entry date beats "first night seen" when it is earlier.
    const evidence = r.since_source === 'stage' && r.since ? String(r.since).slice(0, 10) : today;
    if (!cur) {
      ledger.customers[id] = { first_seen: evidence, last_seen: today, customer: r.customer, rep: r.rep, crew: r.crew, company_crew: r.company_crew, number: r.number, source: r.source };
      added.push(`${r.customer} (${r.source}, since ${evidence})`);
    } else {
      if (evidence < cur.first_seen) cur.first_seen = evidence;
      Object.assign(cur, { last_seen: today, customer: r.customer, rep: r.rep, crew: r.crew, company_crew: r.company_crew, number: r.number, source: r.source });
    }
  }
  for (const id of Object.keys(ledger.customers)) {
    if (open.has(id)) continue;
    const c = ledger.customers[id];
    const days = dayDiff(c.first_seen, today);
    ledger.resolved.push(Object.assign({ customer_id: id }, c, { resolved: today, days }));
    delete ledger.customers[id];
    cleared.push(`${c.customer} (${days}d)`);
  }
  ledger.resolved = ledger.resolved.slice(-500);
  ledger.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(ledger, null, 2) + '\n');

  const lines = [
    `punchout: ${board.rows.length} open (${board.counts ? `${board.counts.flagged} flagged, ${board.counts.in_stage} in stage` : ''}); buckets ${JSON.stringify(board.buckets)}`,
    `punchout: new ${added.length ? added.join(', ') : 'none'}`,
    `punchout: cleared ${cleared.length ? cleared.join(', ') : 'none'}`,
  ];
  console.log(lines.join('\n'));
  const SUMMARY = process.env.SUMMARY_FILE;
  if (SUMMARY) fs.appendFileSync(SUMMARY, lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
