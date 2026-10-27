#!/usr/bin/env node
// scripts/refresh-ca-gaps.js -- nightly SalesRabbit-vs-Leap CA cross-check -> data/ca-sr-gaps.json.
//
// Every CA a rep marked in SalesRabbit this month (ICA/SGCA, what Amplify counts) is looked up in Leap.
// Leap's CA Signed Date is what pays and what the dashboard counts, so anything SalesRabbit has that
// Leap doesn't is a CA that may be missed at payroll:
//   - "No Leap job"               the deal never reached Leap
//   - "No CA document in Leap"    the job exists but the signed CA never came across
//   - "Has documents, no CA date" something is attached but it wasn't recognised as a signed CA
// It also lists CAs where SalesRabbit and Leap credit different reps (Leap's customer rep is paid).
// Shown on ca-gaps.html. Run nightly by .github/workflows/refresh-snapshots.yml after the CA ledger.

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const LEDGER = path.resolve(__dirname, '..', 'data', 'ca-ledger.json');
const OUT = path.resolve(__dirname, '..', 'data', 'ca-sr-gaps.json');
const SR_ALIAS = { 'mike mccarthy': 'michael mccarthy', 'izzy price': 'isabelle price', 'robert mumford-wilson': 'robert wilson' };

const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const repKey = (s) => { const n = String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); return SR_ALIAS[n] || n; };

async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { accept: 'application/json' } });
    const json = JSON.parse(await res.text());
    if (!res.ok || json.error) throw new Error(`HTTP ${res.status} ${json.error || ''}`);
    return json;
  } catch (e) {
    if (attempt < 3) { await new Promise((r) => setTimeout(r, 5000)); return getJson(url, attempt + 1); }
    throw e;
  }
}

async function main() {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8')).jobs || {};
  const ledgerList = Object.entries(ledger).map(([job, v]) => Object.assign({ job, w: words(v.customer) }, v));

  const srCas = [];
  for (const office of ['herndon', 'richmond']) {
    const r = await getJson(`${BASE}/api/ca-history?office=${office}&live=1&detail=1`);
    (r.details || []).forEach((x) => srCas.push(Object.assign({ office }, x)));
  }
  // one row per lead (SalesRabbit can carry the same lead several times)
  const seen = new Set();
  const leads = srCas.filter((x) => { const k = x.lead || `${x.name}|${x.address}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const gaps = [], repMismatch = [];
  let ok = 0;
  for (const x of leads) {
    const w = words(x.name);
    const last = w[w.length - 1];
    let hit = last ? ledgerList.filter((l) => l.w.includes(last) && (w.length < 2 || l.w.includes(w[0]) || l.w.length < 2)) : [];
    let leapJobs = null;
    if (!hit.length) {
      const street = String(x.address || '').split(',')[0].split(/\s+/).slice(0, 2).join(' '); // "1703 Shagbark" - Leap's keyword search misses on the full street
      const f = await getJson(`${BASE}/api/job-reps?findjob=1&q=${encodeURIComponent(street)}&name=${encodeURIComponent(x.name || '')}`);
      leapJobs = f.jobs || [];
      hit = leapJobs.filter((j) => j.ca_date).map((j) => ({ job: j.job, rep: j.rep, date: j.ca_date, customer: j.customer }));
    }
    const base = { sr_date: x.date, sr_rep: x.rep, office: x.office, customer: x.name || null, address: x.address || null };
    if (hit.length) {
      ok++;
      const h = hit[0];
      if (h.rep && repKey(h.rep) !== repKey(x.rep)) repMismatch.push(Object.assign(base, { job: h.job, leap_rep: h.rep, leap_customer: h.customer, ca_date: h.date }));
      continue;
    }
    const j = (leapJobs || [])[0];
    if (!j) gaps.push(Object.assign(base, { problem: 'No Leap job' }));
    else gaps.push(Object.assign(base, { problem: j.docs.length ? 'Has documents, no CA date' : 'No CA document in Leap', job: j.job, leap_customer: j.customer, leap_rep: j.rep, stage: j.stage, docs: j.docs }));
  }
  gaps.sort((a, b) => a.sr_rep.localeCompare(b.sr_rep) || a.sr_date.localeCompare(b.sr_date));
  const report = { updated: new Date().toISOString(), month: new Date().toISOString().slice(0, 7), sr_cas: leads.length, in_leap: ok, gaps, rep_mismatch: repMismatch };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n');
  const lines = [`ca-gaps: ${leads.length} SalesRabbit CAs this month, ${ok} have a Leap CA date, ${gaps.length} gaps, ${repMismatch.length} rep mismatches`]
    .concat(gaps.map((g) => `  ${g.sr_date} ${g.sr_rep} | ${g.customer || '(no name)'} ${g.address || ''} -> ${g.problem}${g.job ? ' ' + g.job : ''}`));
  console.log(lines.join('\n'));
  if (process.env.SUMMARY_FILE) fs.appendFileSync(process.env.SUMMARY_FILE, lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
