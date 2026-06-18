// api/rich-revenue.js — Richmond revenue snapshot (Approved = Job Sub Total Amount by Job Awarded Date, MTD).
// Source: Leap DataBuilder report 3421 "Sales Rep Revenue MTD" (Richmond account), pulled via the
// reporting browser token (24h) so this is a snapshot refreshed by the daily task.
// Contract Signed is pending a sibling report (3421 filtered by Contract Signed Date).
const DATA = {
  updated: "2026-06-18",
  month: "2026-06",
  reps: [
    { rep: "Bryan Courtney", approved: 82092, contract: 0 },
    { rep: "Travis Kizzar", approved: 36083.14, contract: 0 },
    { rep: "Terry Eggleston", approved: 24783.29, contract: 0 },
    { rep: "Justin Coghill", approved: 23970.27, contract: 0 },
    { rep: "Brandy Straus", approved: 0, contract: 0 }
  ]
};
module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(DATA);
};
