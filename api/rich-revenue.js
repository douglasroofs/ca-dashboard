// api/rich-revenue.js — Richmond revenue snapshot (per rep, MTD).
// Source: Leap DataBuilder report 3421 "Sales Rep Revenue MTD" (JobProgress context 6026,
// "Douglas Roofing Richmond"), field "Job Sub Total Amount" aggregated by sales rep.
//   approved  = filtered by Job Awarded Date (current month)
//   contract  = same report filtered by Job Contract Signed Date (current month)
// Pulled via the reporting browser token (24h) so this is a snapshot refreshed by the daily task.
const DATA = {
  updated: "2026-07-07",
  month: "2026-07",
  reps: [
    { rep: "Bryan Courtney", approved: 12200.72, contract: 0 }
  ]
};
module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(DATA);
};
