#!/usr/bin/env node
// scripts/ca-check.js -- fill the Leap CA Signed Date from accepted CA documents.
//
// Walks /api/job-reps?cacheck=1 one page of open jobs at a time (Leap needs ~18 s per 100 jobs,
// and a Vercel call must finish in 60 s). Each page returns the jobs updated in the last HOURS
// that had no CA date and now have an accepted CA document; with WRITE=1 the date is written.
// Run every 30 min by .github/workflows/ca-check.yml (HOURS=2), plus a nightly HOURS=48 sweep.
// Usage: HOURS=2 WRITE=1 node scripts/ca-check.js   (BASE_URL defaults to https://stats.douglasroofs.com)

const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const HOURS = Number(process.env.HOURS) || 2;
const WRITE = process.env.WRITE === '1';
const ALL = process.env.ALL === '1';
const ONLY_PAGES = (process.env.PAGES || '').split(',').map(Number).filter(Boolean); // e.g. PAGES=16 to redo one page
const MAX_PAGES = Number(process.env.MAX_PAGES) || 60;
const fs = require('fs');

async function callPage(page, attempt = 1, skip = 0) {
  const url = `${BASE}/api/job-reps?cacheck=1&page=${page}&skip=${skip}&hours=${HOURS}${WRITE ? '&write=1' : ''}${ALL ? '&all=1' : ''}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { accept: 'application/json' } });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok || json.error) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
  } catch (e) {
    if (attempt < 3) { console.log(`  page ${page} retry after: ${e.message}`); await new Promise((r) => setTimeout(r, 5000)); return callPage(page, attempt + 1, skip); }
    throw e;
  }
}

async function main() {
  const lines = [`CA check: ${ALL ? 'ALL open jobs' : `last ${HOURS}h`}, ${WRITE ? 'WRITING' : 'dry run'}`];
  const totals = { jobs_seen: 0, recent: 0, already_dated: 0, checked: 0 };
  const found = [];
  let total = ONLY_PAGES.length ? Math.max(...ONLY_PAGES) : 1, failed = 0;
  for (let page = 1; page <= Math.min(total, MAX_PAGES); page++) {
    if (ONLY_PAGES.length && !ONLY_PAGES.includes(page)) continue;
    let r;
    try {
      r = await callPage(page);
      // a page that ran out of time is resumed where it stopped (sweeps check many jobs per page)
      while (r.stats.next_skip != null) {
        const more = await callPage(page, 1, r.stats.next_skip);
        ['already_dated', 'checked'].forEach((k) => { r.stats[k] = (r.stats[k] || 0) + (more.stats[k] || 0); });
        r.results = (r.results || []).concat(more.results || []);
        r.stats.next_skip = more.stats.next_skip; r.stats.stopped_early = more.stats.stopped_early;
      }
    } catch (e) { failed++; lines.push(`page ${page}: FAILED ${e.message}`); continue; }
    total = r.stats.total_pages || total;
    Object.keys(totals).forEach((k) => { totals[k] += r.stats[k] || 0; });
    if (r.stats.stopped_early) lines.push(`page ${page}: ${r.stats.stopped_early}`);
    (r.results || []).forEach((x) => found.push(x));
    console.log(`page ${page}/${total}: ${r.stats.jobs_seen} jobs, ${r.stats.recent} recent, ${(r.results || []).length} results (${r.seconds}s)`);
  }
  lines.push(`pages ${Math.min(total, MAX_PAGES)}, jobs ${totals.jobs_seen}, updated recently ${totals.recent}, already dated ${totals.already_dated}, documents checked ${totals.checked}, failed pages ${failed}`);
  if (!found.length) lines.push('No new signed CAs.');
  found.forEach((x) => lines.push(`${x.action}: ${x.job_number} ${x.customer || ''} - "${x.document || ''}" -> ${x.date || ''} (${x.date_source || x.reason || ''})`));
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.SUMMARY_FILE) fs.writeFileSync(process.env.SUMMARY_FILE, summary + '\n');
  if (failed && failed >= Math.min(total, MAX_PAGES)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
