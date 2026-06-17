// api/ca.js — CA (documents named "CA") count this month, by job salesman.
// Served as a function because static-file publishing is currently stuck.
// This is a snapshot refreshed by the daily scheduled task (reporting token is
// browser-only / 24h, so it can't be computed live server-side).
// To update: edit DATA below (the daily task rewrites it).

const DATA = {
  updated: '2026-06-17',
  month: '2026-06',
  total: 31,
  reps: [
    { rep: 'Andrew Funk', count: 6 },
    { rep: 'David Kerns', count: 5 },
    { rep: 'Andrew Prickel', count: 4 },
    { rep: 'Harvey Shoemaker', count: 4 },
    { rep: 'George Bechara', count: 4 },
    { rep: 'Jack Obert', count: 3 },
    { rep: 'Christian Brown', count: 2 },
    { rep: 'Alfred Duncan', count: 1 },
    { rep: 'Michael McCarthy', count: 1 },
    { rep: 'Unassigned', count: 1 },
  ],
};

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(DATA);
};
