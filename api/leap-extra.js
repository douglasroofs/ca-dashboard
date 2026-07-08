// api/leap-extra.js — Leap CA (per rep per month) + revenue YTD (per rep), per office. Daily snapshot.
// Leap CA: CA COUNT DataBuilder report (3832 Herndon / 3950 Richmond), rows bucketed by document date.
// Revenue YTD: Sales Performance summary report (contract_amount field) — approved = by Job Awarded
// Date, contract = by Contract Signed Date, YTD. Session/token-bound reports -> refreshed daily.
const DATA = {
  herndon: {
    updated: "2026-07-07",
    leapCA: {"Alfred Duncan":[0,0,0,0,2,3,1,0,0,0,0,0],"Andrew Funk":[0,0,0,0,2,12,4,0,0,0,0,0],"Andrew Prickel":[0,0,0,0,2,12,3,0,0,0,0,0],"Christian Brown":[0,0,0,0,0,2,2,0,0,0,0,0],"David Kerns":[0,0,0,0,0,8,0,0,0,0,0,0],"George Bechara":[0,0,0,0,2,5,0,0,0,0,0,0],"Harvey Shoemaker":[0,1,1,0,0,7,1,0,0,0,0,0],"Jack Obert":[2,0,0,0,1,4,0,0,0,0,0,0],"Kevin Mahan":[0,2,0,0,0,0,0,0,0,0,0,0],"Marc Mitchell":[0,0,0,0,0,0,1,0,0,0,0,0],"Michael McCarthy":[0,0,2,0,0,6,2,0,0,0,0,0],"Nick  Seward":[1,2,3,0,2,0,0,0,0,0,0,0],"Robert Wilson":[1,0,0,1,0,0,0,0,0,0,0,0]},
    approved: {"Adam Mulvaney":258139.13,"Alfred Duncan":473927.94,"Andrew Funk":228960.22,"Andrew Prickel":1258096.94,"Carol Wright":13811.11,"Christian Brown":233760.65,"David Kerns":337814.86,"George Bechara":347469.86,"Haley Barry":2645891.25,"Harvey Shoemaker":372960.06,"Isabelle Price":158834.16,"Jack Obert":425282.18,"James Moffett":71421.37,"Kelly Alston":25032.86,"Kevin Mahan":243252.51,"Kyle Higginbotham":20275.6,"Marc Mitchell":290971.78,"Michael McCarthy":497079.17,"Mike Mendez":6323.57,"Mike Schoultz":25955,"Nick  Seward":201043.02,"Robert Wilson":322378.13,"Steven Arevalo":305643.29},
    contract: {"Adam Mulvaney":213730.97,"Alfred Duncan":500008.43,"Andrew Funk":152352.64,"Andrew Prickel":1075202.82,"Christian Brown":177979.98,"David Kerns":249726.65,"George Bechara":219618.24,"Haley Barry":2892567.97,"Harvey Shoemaker":335756.78,"Isabelle Price":170788.89,"Jack Obert":362013.04,"James Moffett":71421.37,"Kelly Alston":25032.86,"Kevin Mahan":271267.19,"Kyle Higginbotham":20275.6,"Marc Mitchell":165609.48,"Michael McCarthy":446669.28,"Mike Mendez":6323.57,"Mike Schoultz":25955,"Nick  Seward":172213.17,"Robert Wilson":317432.43,"Steven Arevalo":240164.12}
  },
  richmond: { updated: "2026-07-08", leapCA: {"Joshua Baca":[0,0,0,0,0,12,3,0,0,0,0,0],"Brandon Simmons":[0,0,0,0,0,8,1,0,0,0,0,0],"Justin Coghill":[0,0,0,0,0,6,0,0,0,0,0,0],"Travis Kizzar":[0,0,0,0,0,10,5,0,0,0,0,0],"Logan Burbic":[0,0,0,0,0,2,0,0,0,0,0,0],"Marcus Schanewolf":[0,0,0,0,0,1,0,0,0,0,0,0]}, approved: {"Haley Barry":386964.88,"Bryan Courtney":201845.25,"Justin Coghill":196285.94,"Travis Kizzar":166257.32,"Gregg Desmond":89355,"Brandon Simmons":85382.92,"Paul Brost":59380,"Logan Burbic":37560.87,"Joshua Baca":34702.96,"Pedro Ramirez":28612.92,"Terry Eggleston":24783.29}, contract: {"Haley Barry":636898.95,"Bryan Courtney":200644.53,"Justin Coghill":190096.66,"Travis Kizzar":127372.43,"Gregg Desmond":89355,"Brandon Simmons":144872.2,"Paul Brost":56180,"Logan Burbic":32680.24,"Joshua Baca":34702.96,"Terry Eggleston":24783.29} }
};
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
  res.status(200).json(DATA[office] || DATA.herndon);
};
