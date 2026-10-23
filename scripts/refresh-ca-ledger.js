#!/usr/bin/env node
// scripts/refresh-ca-ledger.js -- keep data/ca-ledger.json current from /api/job-reps?cacounts=1.
//
// The ledger is the dashboard's source for Leap CA counts (api/leap-extra.js, Herndon): one entry per
// job that has a Leap "Contingency Contract Signed Date", keyed by job number:
//   jobs[<job number>] = { date, rep, customer, division, first_seen, last_seen }
// Leap's job list only returns OPEN jobs, so:
//   - open job with a date      -> added / updated (date or rep changes are taken)
//   - open job without a date   -> removed if it was in the ledger (the date was cleared in Leap)
//   - job not returned at all   -> kept (lost/archived jobs keep their CA)
// Seeded 2026-10-23 from DataBuilder report 4407 (incl. lost/archived jobs).
// Run nightly by .github/workflows/refresh-snapshots.yml.
// Usage: node scripts/refresh-ca-ledger.js   (BASE_URL defaults to https://stats.douglasroofs.com)

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const FILE = path.resolve(__dirname, '..', 'data', 'ca-ledger.json');
const MAX_PAGES = Number(process.env.MAX_PAGES) || 60;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

async function callPage(page, attempt = 1) {
  try {
    const res = await fetch(`${BASE}/api/job-reps?cacounts=1&page=${page}`, { signal: AbortSignal.timeout(90000), headers: { accept: 'application/json' } });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok || json.error) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
  } catch (e) {
    if (attempt < 3) { console.log(`  page ${page} retry after: ${e.message}`); await new Promise((r) => setTimeout(r, 5000)); return callPage(page, attempt + 1); }
    throw e;
  }
}

async function main() {
  let ledger = { updated: null, jobs: {} };
  const SEED = path.resolve(__dirname, '..', 'data', 'ca-ledger-seed.json');
  if (fs.existsSync(FILE)) ledger = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  else if (fs.existsSync(SEED)) { ledger.jobs = JSON.parse(fs.readFileSync(SEED, 'utf8')).jobs; console.log(`starting from seed: ${Object.keys(ledger.jobs).length} jobs`); }
  ledger.jobs = ledger.jobs || {};
  const added = [], changed = [], removed = [];
  let total = 1, pagesOk = 0;
  for (let page = 1; page <= Math.min(total, MAX_PAGES); page++) {
    let r;
    try { r = await callPage(page); } catch (e) { console.log(`page ${page}: FAILED ${e.message}`); continue; }
    pagesOk++;
    total = r.total_pages || total;
    for (const x of r.dated) {
      const cur = ledger.jobs[x.job];
      if (!cur) { ledger.jobs[x.job] = { date: x.date, rep: x.rep, customer: x.customer, division: x.division, first_seen: today, last_seen: today }; added.push(`${x.job} ${x.rep} ${x.date}`); }
      else {
        if (cur.date !== x.date || cur.rep !== x.rep) changed.push(`${x.job} ${cur.rep} ${cur.date} -> ${x.rep} ${x.date}`);
        Object.assign(cur, { date: x.date, rep: x.rep, customer: x.customer, division: x.division, last_seen: today });
      }
    }
    for (const num of r.undated) {
      if (ledger.jobs[num]) { removed.push(`${num} ${ledger.jobs[num].rep} ${ledger.jobs[num].date}`); delete ledger.jobs[num]; }
    }
    console.log(`page ${page}/${total}: ${r.jobs} jobs, ${r.dated.length} with a CA date`);
  }
  if (!pagesOk) throw new Error('no page could be read - ledger left unchanged');
  ledger.updated = new Date().toISOString();
  ledger.jobs = Object.fromEntries(Object.entries(ledger.jobs).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(FILE, JSON.stringify(ledger, null, 1) + '\n');

  const yr = today.slice(0, 4);
  const thisYear = Object.values(ledger.jobs).filter((j) => String(j.date).startsWith(yr)).length;
  const lines = [
    `ca-ledger: ${Object.keys(ledger.jobs).length} jobs (${thisYear} dated ${yr}), pages read ${pagesOk}/${Math.min(total, MAX_PAGES)}`,
    `ca-ledger: added ${added.length}${added.length ? ' - ' + added.slice(0, 30).join('; ') : ''}`,
    `ca-ledger: changed ${changed.length}${changed.length ? ' - ' + changed.slice(0, 30).join('; ') : ''}`,
    `ca-ledger: removed (date cleared) ${removed.length}${removed.length ? ' - ' + removed.slice(0, 30).join('; ') : ''}`,
  ];
  console.log(lines.join('\n'));
  if (process.env.SUMMARY_FILE) fs.appendFileSync(process.env.SUMMARY_FILE, lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
