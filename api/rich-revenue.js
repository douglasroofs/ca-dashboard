// api/rich-revenue.js — Richmond revenue snapshot (per rep, MTD).
// Source: Leap DataBuilder report 3421 "Sales Rep Revenue MTD" (JobProgress context 6026,
// "Douglas Roofing Richmond"), field "Job Sub Total Amount" aggregated by sales rep.
//   approved  = filtered by Job Awarded Date (this month)
//   contract  = same report filtered by Job Contract Signed Date (this month)
// Pulled via the reporting browser token (24h) so this is a snapshot refreshed by a daily task.
const DATA = {
  updated: "2026-06-18",
  month: "2026-06",
  reps: [
    { rep: "Bryan Courtney", approved: 82092, contract: 18338 },
    { rep: "Travis Kizzar", approved: 36083.14, contract: 24563.07 },
    { rep: "Terry Eggleston", approved: 24783.29, contract: 0 },
    { rep: "Justin Coghill", approved: 23970.27, contract: 0 },
    { rep: "Brandy Straus", approved: 0, contract: 0 },
    { rep: "Joshua Baca", approved: 0, contract: 17544.25 },
    { rep: "Brandon Simmons", approved: 0, contract: 13028.07 }
  ]
};
module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(DATA);
};
