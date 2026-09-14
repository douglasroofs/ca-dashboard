#!/usr/bin/env node
// scripts/refresh-snapshots.js -- rebuild the baked-in SNAPSHOTS in api/ca-history.js and api/doors.js
// from the live Sales Rabbit endpoints on stats.douglasroofs.com.
//
// Run daily by .github/workflows/refresh-snapshots.yml (no browser, no Mac mini, no Claude).
// Usage:  node scripts/refresh-snapshots.js            (BASE_URL defaults to https://stats.douglasroofs.com)
//
// Per office and file: fetch live JSON, sanity-check it, and splice it into the `const SNAPSHOTS = {...};`
// block. If one fetch fails, that office keeps its existing snapshot and the script exits 1 at the end
// so the Actions run goes red -- but everything that DID succeed is still written (and committed).
//
// api/leap-extra.js (Leap CA counts) is NOT touched here: it needs a logged-in Leap session.

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'https://stats.douglasroofs.com').replace(/\/$/, '');
const OFFICES = ['herndon', 'richmond'];
const TIMEOUT_MS = 240000; // ca-history scope=year is slow (~60s+); allow plenty
const ROOT = path.resolve(__dirname, '..');

const TARGETS = {
  caHistory: {
    file: path.join(ROOT, 'api', 'ca-history.js'),
    url: (o) => `${BASE}/api/ca-history?office=${o}&live=1&scope=year`,
    keys: ['updated', 'year', 'months', 'reps'],
    check: (j) => {
      if (!Array.isArray(j.months) || !Array.isArray(j.reps)) return 'months/reps missing';
      const now = nyDate();
      if (Number(j.year) !== now.year) return `year ${j.year} != ${now.year}`;
      const want = Array.from({ length: now.month + 1 }, (_, i) => i);
      if (JSON.stringify(j.months) !== JSON.stringify(want)) return `months ${JSON.stringify(j.months)} != Jan..current`;
      return null;
    },
    describe: (j) => `${j.reps.length} reps, ${j.months.length} months`,
  },
  doors: {
    file: path.join(ROOT, 'api', 'doors.js'),
    url: (o) => `${BASE}/api/doors?office=${o}&live=1`,
    keys: ['updated', 'total', 'reps', 'allowedReps', 'roster'],
    check: (j) => {
      if (j.source !== 'live') return `source is ${JSON.stringify(j.source)}, not "live"`;
      if (!Array.isArray(j.reps) || typeof j.total !== 'number') return 'reps/total missing';
      return null;
    },
    describe: (j) => `${j.reps.length} reps, ${j.total} doors`,
  },
};

function nyDate() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric' })
    .formatToParts(new Date());
  const get = (t) => Number(p.find((x) => x.type === t).value);
  return { year: get('year'), month: get('month') - 1 };
}

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}, non-JSON body: ${text.slice(0, 200)}`); }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    if (json && json.error) throw new Error(`API error: ${JSON.stringify(json.error).slice(0, 200)}`);
    return json;
  } catch (e) {
    if (attempt < 2) {
      console.log(`  retrying after: ${e.message}`);
      return fetchJson(url, attempt + 1);
    }
    throw e;
  }
}

function readSnapshots(file) {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('const SNAPSHOTS = {');
  if (start < 0) throw new Error(`${file}: no "const SNAPSHOTS = {" found`);
  const end = src.indexOf('\n};', start);
  if (end < 0) throw new Error(`${file}: SNAPSHOTS block not terminated`);
  const body = src.slice(start + 'const SNAPSHOTS = '.length, end + 2); // "{...}"
  const current = new Function(`return (${body});`)();
  return { src, start, end: end + 3, current }; // end points just past "};"
}

function writeSnapshots(file, parsed, next) {
  const block = 'const SNAPSHOTS = ' + JSON.stringify(next, null, 2) + ';';
  const out = parsed.src.slice(0, parsed.start) + block + parsed.src.slice(parsed.end);
  fs.writeFileSync(file, out);
}

function pick(obj, keys) {
  const o = {};
  for (const k of keys) o[k] = obj[k];
  return o;
}

function currentMonthCA(snap) {
  const m = snap.months.length - 1;
  const out = {};
  for (const r of snap.reps) out[r.rep] = (r.counts && r.counts[m]) || 0;
  return out;
}

async function main() {
  const failures = [];
  const summary = [];

  for (const [name, t] of Object.entries(TARGETS)) {
    const parsed = readSnapshots(t.file);
    const next = JSON.parse(JSON.stringify(parsed.current));
    let changed = false;

    for (const office of OFFICES) {
      const url = t.url(office);
      process.stdout.write(`[${name}/${office}] GET ${url}\n`);
      try {
        const json = await fetchJson(url);
        const problem = t.check(json);
        if (problem) throw new Error(`sanity check failed: ${problem}`);
        const fresh = pick(json, t.keys);
        for (const k of t.keys) if (fresh[k] === undefined) throw new Error(`response missing "${k}"`);

        // Notable changes vs the previous snapshot.
        const prev = parsed.current[office] || {};
        if (name === 'doors') {
          summary.push(`doors/${office}: ${prev.total ?? '?'} -> ${fresh.total} (${t.describe(fresh)})`);
        } else {
          const a = currentMonthCA(prev.months ? prev : fresh), b = currentMonthCA(fresh);
          const moves = Object.keys(b).filter((r) => (a[r] || 0) !== b[r]).map((r) => `${r} ${a[r] || 0}->${b[r]}`);
          summary.push(`ca-history/${office}: ${t.describe(fresh)}; current-month moves: ${moves.length ? moves.join(', ') : 'none'}`);
        }
        next[office] = fresh;
        changed = true;
        console.log(`  ok: ${t.describe(fresh)}`);
      } catch (e) {
        failures.push(`${name}/${office}: ${e.message}`);
        console.log(`  FAILED (keeping existing snapshot): ${e.message}`);
      }
    }

    if (changed) {
      writeSnapshots(t.file, parsed, next);
      console.log(`  wrote ${path.relative(ROOT, t.file)}`);
    }
  }

  // Both files must still parse.
  for (const t of Object.values(TARGETS)) {
    require('child_process').execFileSync(process.execPath, ['--check', t.file], { stdio: 'inherit' });
  }

  const lines = [...summary, ...failures.map((f) => `FAILED ${f}`)];
  const SUMMARY = process.env.SUMMARY_FILE || path.join(require('os').tmpdir(), 'refresh-summary.txt');
  fs.writeFileSync(SUMMARY, lines.join('\n') + '\n');
  console.log('summary written to ' + SUMMARY);
  console.log('\nSummary:\n' + lines.map((l) => '  ' + l).join('\n'));

  if (failures.length) {
    console.error(`\n${failures.length} fetch(es) failed; existing snapshot kept for those.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
