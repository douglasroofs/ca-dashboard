// api/ca.js — CA (documents named "CA") count this month, by job salesman.
// Served as a function because static-file publishing is currently stuck.
// This is a snapshot refreshed by the daily scheduled task (reporting token is
// browser-only / 24h, so it can't be computed live server-side).
// To update: edit DATA below (the daily task rewrites it).

const DATA = {
  updated: '2026-07-01',
  month: '2026-07',
  total: 0,
  reps: [],
};

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(DATA);
};
