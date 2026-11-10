// api/leap-extra.js — Leap CA counts, from the Leap "Contingency Contract Signed Date" (CA signed date).
//
// Source: data/ca-ledger.json — one entry per job with a CA signed date, rep = customer rep, refreshed
// nightly by scripts/refresh-ca-ledger.js (Refresh SR snapshots Action). Lost/archived jobs stay counted.
// This is the ONLY source of CA numbers on the dashboard (revenue, CA bonus and marketing pages) as of
// 2026-11-10. The old DataBuilder "CA COUNT" document snapshots and the Richmond office were retired then
// (all RVA jobs now live in the main Leap company).
//
//   GET /api/leap-extra            -> { updated, source, year, leapCA: { rep: [12 monthly counts] } }  (current year)
//   GET /api/leap-extra?jobs=1     -> { updated, source, jobs: [{ job, date, rep, division, customer }] } (current year;
//                                     &year=YYYY for another year) — pages count any date range from this
let LEDGER = null;
function ledger() {
  if (LEDGER) return LEDGER;
  try { LEDGER = require('../data/ca-ledger.json'); } catch (e) { LEDGER = { updated: null, jobs: {} }; }
  return LEDGER;
}
const SOURCE = 'Leap CA signed date (Contingency Contract Signed Date), data/ca-ledger.json';
const cleanRep = (r) => String(r || 'Unassigned').replace(/\s+/g, ' ').trim();

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  const L = ledger();
  const thisYear = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).slice(0, 4);
  const yr = /^\d{4}$/.test(url.searchParams.get('year') || '') ? url.searchParams.get('year') : thisYear;
  const updated = String(L.updated || '').slice(0, 10);
  const rows = Object.entries(L.jobs || {})
    .filter(([, j]) => j && j.date && String(j.date).startsWith(yr))
    .map(([job, j]) => ({ job, date: String(j.date).slice(0, 10), rep: cleanRep(j.rep), division: j.division || null, customer: j.customer || null }));

  if (url.searchParams.get('jobs') === '1') {
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return res.status(200).json({ updated, source: SOURCE, year: yr, jobs: rows });
  }
  const leapCA = {};
  rows.forEach((r) => { (leapCA[r.rep] = leapCA[r.rep] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[Number(r.date.slice(5, 7)) - 1]++; });
  res.status(200).json({ updated, source: SOURCE, year: yr, leapCA });
};
