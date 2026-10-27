#!/usr/bin/env node
// scripts/run-job-list.js -- approved one-off Leap writes over a list of job numbers, one job at a time.
//   MODE=setins  -> /api/job-reps?setins=1&write=1&job=N   (Insurance flag + "Insurance Claim" category)
//   MODE=cacheck -> /api/job-reps?cacheck=1&write=1&job=N  (CA Signed Date from a signed CA document;
//                   skips jobs already dated or with no signed CA)
// JOBS_FILE = text file, one job number per line. Writes a report to REPORT_FILE (and SUMMARY_FILE).
// Run by .github/workflows/one-off-writes.yml (workflow_dispatch only).

const fs = require('fs');
const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const MODE = process.env.MODE;
const jobs = fs.readFileSync(process.env.JOBS_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
if (!['setins', 'cacheck'].includes(MODE)) { console.error('MODE must be setins or cacheck'); process.exit(1); }

async function call(job, attempt = 1) {
  const url = MODE === 'setins' ? `${BASE}/api/job-reps?setins=1&write=1&job=${encodeURIComponent(job)}` : `${BASE}/api/job-reps?cacheck=1&write=1&job=${encodeURIComponent(job)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { accept: 'application/json' } });
    const json = JSON.parse(await res.text());
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status} ${json.error || ''}`);
    return json;
  } catch (e) {
    if (attempt < 3) { await new Promise((r) => setTimeout(r, 5000)); return call(job, attempt + 1); }
    return { error: String(e.message || e) };
  }
}

function describe(job, r) {
  if (r.error) return `ERROR    ${job} ${r.error}`;
  if (MODE === 'setins') {
    const p = r.preview || {}, x = r.result || {};
    if (x.ok && !x.skipped) return `marked   ${job} ${p.customer || ''}`;
    if (x.skipped) return `skipped  ${job} ${p.customer || ''} - ${x.skipped}`;
    return `FAILED   ${job} ${p.customer || ''} ${JSON.stringify(x.attempts || x.reason || '').slice(0, 200)}`;
  }
  const x = (r.results || [])[0] || {};
  if (x.action === 'written') return `written  ${job} ${x.customer || ''} -> ${x.date} (${x.date_source}) verified ${x.verified || '-'}`;
  return `${(x.action || 'none').padEnd(8)} ${job} ${x.customer || ''} ${x.reason || x.date_source || ''} ${x.existing || ''}`;
}

(async () => {
  const lines = [`one-off ${MODE}: ${jobs.length} jobs`];
  const tally = {};
  for (const job of jobs) {
    const line = describe(job, await call(job));
    const k = line.split(/\s+/)[0];
    tally[k] = (tally[k] || 0) + 1;
    lines.push(line);
    console.log(line);
  }
  lines.splice(1, 0, 'totals: ' + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', '));
  const out = lines.join('\n') + '\n';
  if (process.env.REPORT_FILE) fs.writeFileSync(process.env.REPORT_FILE, out);
  if (process.env.SUMMARY_FILE) fs.appendFileSync(process.env.SUMMARY_FILE, out);
})();
