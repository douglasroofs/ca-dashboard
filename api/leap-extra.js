// api/leap-extra.js — Leap CA (per rep per month) + revenue YTD (per rep), per office. Daily snapshot.
// Leap CA: CA COUNT DataBuilder report (3832 Herndon / 3950 Richmond), rows bucketed by document date.
// Revenue YTD: Job Sub Total Amount by Sales Rep, filtered by Job Awarded Date (approved) and Job
// Contract Signed Date (contract), Jan 1..now. Browser-token/per-context reports -> refreshed daily.
const DATA = {
  herndon: {
    updated: "2026-07-07",
    leapCA: {"Alfred Duncan":[0,0,0,0,2,3,1,0,0,0,0,0],"Andrew Funk":[0,0,0,0,2,12,4,0,0,0,0,0],"Andrew Prickel":[0,0,0,0,2,12,3,0,0,0,0,0],"Christian Brown":[0,0,0,0,0,2,2,0,0,0,0,0],"David Kerns":[0,0,0,0,0,8,0,0,0,0,0,0],"George Bechara":[0,0,0,0,2,5,0,0,0,0,0,0],"Harvey Shoemaker":[0,1,1,0,0,7,1,0,0,0,0,0],"Jack Obert":[2,0,0,0,1,4,0,0,0,0,0,0],"Kevin Mahan":[0,2,0,0,0,0,0,0,0,0,0,0],"Marc Mitchell":[0,0,0,0,0,0,1,0,0,0,0,0],"Michael McCarthy":[0,0,2,0,0,6,2,0,0,0,0,0],"Nick  Seward":[1,2,3,0,2,0,0,0,0,0,0,0],"Robert Wilson":[1,0,0,1,0,0,0,0,0,0,0,0]},
    approved: {"Adam Mulvaney":246596.13,"Alfred Duncan":482351.23,"Andrew Funk":228960.22,"Andrew Prickel":1302180.18,"Carol Wright":13811.11,"Christian Brown":233760.65,"David Kerns":337814.86,"George Bechara":349954.96,"Haley Barry":0,"Harvey Shoemaker":372960.06,"Isabelle Price":158834.16,"Jack Obert":411471.07,"Kelly Alston":25032.86,"Kevin Mahan":252285.73,"Kyle Higginbotham":20275.6,"Marc Mitchell":275123.27,"Michael McCarthy":497079.17,"Mike Mendez":6323.57,"Mike Schoultz":25955,"Nick  Seward":213675.86,"Robert Wilson":322378.13,"Steven Arevalo":305643.29,"Zeke King":77041.68},
    contract: {"Adam Mulvaney":202187.97,"Alfred Duncan":508431.72,"Andrew Funk":152352.64,"Andrew Prickel":1104002.82,"Babayel Dia":48273.31,"Christian Brown":177979.98,"Darien Boatwright":19188.97,"David Kerns":249726.65,"George Bechara":217624.15,"Harvey Shoemaker":335756.78,"Isabelle Price":170788.89,"Jack Obert":362013.04,"Kelly Alston":25032.86,"Kevin Mahan":280300.41,"Kyle Higginbotham":20275.6,"Marc Mitchell":149760.97,"Michael McCarthy":446669.28,"Mike Mendez":6323.57,"Mike Schoultz":25955,"Nick  Seward":172213.17,"Robert Wilson":317432.43,"Steven Arevalo":240164.12,"Zeke King":67054.69}
  },
  richmond: { updated: null, leapCA: {}, approved: {}, contract: {} }
};
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
  res.status(200).json(DATA[office] || DATA.herndon);
};
