// api/marketing.js - Marketing division: appointments, results and ad spend (Herndon).
//
// APPOINTMENTS: Leap DataBuilder report 3197 'Marketing Division Appointments Report',
// JP company 5154. Field map confirmed 2026-08-15:
//   f_0 Sales Rep (group_concat) | f_2 Appointment Result | f_3 Job Current Stage
//   f_4 Referral Source          | f_5 Appointment Start Date | f_6 Customer
// f_0 is comma-aggregated, so names are split/trimmed/de-duplicated (14 apparent reps -> 10).
// Rows are de-duplicated on rep+customer+date+result: 495 raw -> 464 unique (31 dupes).
//
// DEFINITIONS (agreed 2026-08-15):
//   set        = appointment scheduled with a start date in range
//   ran        = set, minus 'Customer Canceled Appointment' and 'No Answer/No Appointment Actually Set'
//   caSigned   = result 'CA Signed' (insurance contingency)
//   retail     = result 'Retail Sale' or 'Repair Sold'
//   unresulted = blank Appointment Result
//
// AD SPEND: Google Local Services, read from the LSA billing console. Herndon spans TWO
// LSA accounts and both are Herndon office revenue (the split was a legacy agency tactic
// to gain traction in part of MD):
//   477-447-4205 '[LSA] Douglas NOVA'      cid 8264252991 bid 4329342463
//   819-103-9280 '[LSA] Douglas Roofing-MD' cid 8959448746 bid 10668570426
// Values below are the SUM of both. Only Jun-Aug are exposed on the billing card; earlier
// months need 'View transactions and documents'. August is partial (through the 15th).
// pendingCredit is money Google expects to credit back for disputed/invalid leads.

const SNAPSHOTS = {
 "herndon": {
  "updated": "2026-08-15T16:15:30.782Z",
  "year": 2026,
  "division": "Marketing (7399)",
  "notRan": [
   "Customer Canceled Appointment",
   "No Answer/No Appointment Actually Set"
  ],
  "caResults": [
   "CA Signed"
  ],
  "retailResults": [
   "Retail Sale",
   "Repair Sold"
  ],
  "spend": {
   "currency": "USD",
   "partialMonth": "2026-08",
   "pendingCredit": 3484.78,
   "accounts": [
    "477-447-4205 NOVA",
    "819-103-9280 MD-labelled"
   ],
   "byMonth": {
    "2026-06": 21867.14,
    "2026-07": 22428.7,
    "2026-08": 12514.29
   }
  },
  "records": [
   {
    "d": "2026-08-10",
    "rep": "Andrew Prickel",
    "cust": "Elaine Miletta",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-10",
    "rep": "Steven Arevalo",
    "cust": "Kurt Burkhardt",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-07",
    "rep": "Andrew Prickel",
    "cust": "Sean Stevens",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Zapier"
   },
   {
    "d": "2026-08-07",
    "rep": "Andrew Prickel",
    "cust": "Josh Solomon",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-07",
    "rep": "Marc Mitchell",
    "cust": "Armelle Franklin",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-07",
    "rep": "Steven Arevalo",
    "cust": "Shane Keenan",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-07",
    "rep": "Steven Arevalo",
    "cust": "Suneth De Alwis",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-07",
    "rep": "Steven Arevalo",
    "cust": "Eleanor Pascale",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-06",
    "rep": "Steven Arevalo",
    "cust": "Jami Jhabvala",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-06",
    "rep": "Steven Arevalo",
    "cust": "John Pucciano",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-05",
    "rep": "Andrew Prickel",
    "cust": "Matthew Curry",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-04",
    "rep": "Steven Arevalo",
    "cust": "Gabriel Young",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-04",
    "rep": "Steven Arevalo",
    "cust": "Min Kim",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-08-03",
    "rep": "Steven Arevalo",
    "cust": "Josfina Dardas",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-31",
    "rep": "Nick Seward",
    "cust": "David Rose",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-27",
    "rep": "Andrew Prickel",
    "cust": "Kaushiki Sircar",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-27",
    "rep": "Andrew Prickel",
    "cust": "Craig & Paula Fried",
    "res": "Retail Sale",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-07-24",
    "rep": "Andrew Prickel",
    "cust": "Edmond Mjekiqi",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-23",
    "rep": "Kevin Mahan",
    "cust": "Sheree Saunders",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-07-22",
    "rep": "Steven Arevalo",
    "cust": "Mary Bass",
    "res": "",
    "stage": "Project Meeting Scheduled",
    "src": "(none)"
   },
   {
    "d": "2026-07-22",
    "rep": "Steven Arevalo",
    "cust": "Syed Tanveer",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-21",
    "rep": "Alfred Duncan",
    "cust": "Angelia Farmer",
    "res": "",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-07-21",
    "rep": "Alfred Duncan",
    "cust": "Anthony Archibald",
    "res": "",
    "stage": "Scheduled",
    "src": "(none)"
   },
   {
    "d": "2026-07-21",
    "rep": "Andrew Prickel",
    "cust": "Andrew Gibbs",
    "res": "Retail Sale",
    "stage": "Scheduled",
    "src": "(none)"
   },
   {
    "d": "2026-07-21",
    "rep": "Steven Arevalo",
    "cust": "William Friedman",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-20",
    "rep": "Steven Arevalo",
    "cust": "Arthur Kirkpatrick",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-20",
    "rep": "Steven Arevalo",
    "cust": "Bojan Mici",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-18",
    "rep": "Steven Arevalo",
    "cust": "Susan Roosenraad",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-17",
    "rep": "Isabelle Price",
    "cust": "Danielle Fenwick",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-17",
    "rep": "Kevin Mahan",
    "cust": "Nancy Weathers",
    "res": "",
    "stage": "Adjusters Meeting Scheduled",
    "src": "(none)"
   },
   {
    "d": "2026-07-17",
    "rep": "Steven Arevalo",
    "cust": "Lita Salgado",
    "res": "",
    "stage": "Review Requested",
    "src": "(none)"
   },
   {
    "d": "2026-07-17",
    "rep": "Steven Arevalo",
    "cust": "Deyon Marshall",
    "res": "",
    "stage": "Claims Filed",
    "src": "(none)"
   },
   {
    "d": "2026-07-17",
    "rep": "Steven Arevalo",
    "cust": "Patrick McMahill",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-16",
    "rep": "Steven Arevalo",
    "cust": "Kevin Anderson",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-15",
    "rep": "Nick Seward",
    "cust": "Laura Maxwell",
    "res": "",
    "stage": "Coordinating",
    "src": "(none)"
   },
   {
    "d": "2026-07-15",
    "rep": "Steven Arevalo",
    "cust": "Mary Fuska",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-15",
    "rep": "Steven Arevalo",
    "cust": "Rasool Ahmed",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-14",
    "rep": "Alfred Duncan",
    "cust": "Stephanie Johnson-Smith",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-14",
    "rep": "Andrew Prickel",
    "cust": "Gary Madonna",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-14",
    "rep": "Andrew Prickel",
    "cust": "Darrell Landreaux",
    "res": "Claim Filed",
    "stage": "Claims Filed",
    "src": "(none)"
   },
   {
    "d": "2026-07-14",
    "rep": "Steven Arevalo",
    "cust": "Simone Murray",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-14",
    "rep": "Steven Arevalo",
    "cust": "Matt Julian",
    "res": "",
    "stage": "Claims Filed",
    "src": "(none)"
   },
   {
    "d": "2026-07-11",
    "rep": "Steven Arevalo",
    "cust": "Savita Iyer",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-11",
    "rep": "Steven Arevalo",
    "cust": "Anne Muth",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Adam Mulvaney",
    "cust": "Hhh2 Tester2",
    "res": "",
    "stage": "(none)",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Andrew Prickel",
    "cust": "Srinivas Somayajula",
    "res": "",
    "stage": "Partials",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Andrew Prickel",
    "cust": "James Templeton",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Nick Seward",
    "cust": "William Russell",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Steven Arevalo",
    "cust": "Vishnu Agarwal",
    "res": "",
    "stage": "Ready for Project Meeting",
    "src": "(none)"
   },
   {
    "d": "2026-07-10",
    "rep": "Steven Arevalo",
    "cust": "Greg Krajci",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-09",
    "rep": "Andrew Prickel",
    "cust": "Qing Lin",
    "res": "Pitch Miss",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-09",
    "rep": "Andrew Prickel",
    "cust": "Afarin Homer",
    "res": "Claim Filed",
    "stage": "Claims Filed",
    "src": "(none)"
   },
   {
    "d": "2026-07-09",
    "rep": "Steven Arevalo",
    "cust": "Ron Agles",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-09",
    "rep": "Steven Arevalo",
    "cust": "Hany Wahba",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-08",
    "rep": "Andrew Prickel",
    "cust": "Mike Golliker",
    "res": "",
    "stage": "Scheduled",
    "src": "(none)"
   },
   {
    "d": "2026-07-08",
    "rep": "Steven Arevalo",
    "cust": "Reggie Menefee",
    "res": "",
    "stage": "Ready for Project Meeting",
    "src": "(none)"
   },
   {
    "d": "2026-07-08",
    "rep": "Steven Arevalo",
    "cust": "Valerie Conley",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-08",
    "rep": "Steven Arevalo",
    "cust": "Eric Barberan",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-07",
    "rep": "Steven Arevalo",
    "cust": "Paul Martino",
    "res": "",
    "stage": "Inspection Set",
    "src": "Zapier"
   },
   {
    "d": "2026-07-07",
    "rep": "Steven Arevalo",
    "cust": "Nouman Arif",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-07-06",
    "rep": "Steven Arevalo",
    "cust": "Rafay Farugi",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-25",
    "rep": "Alfred Duncan",
    "cust": "Joe Williams",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-25",
    "rep": "Andrew Prickel",
    "cust": "Michael Murphy",
    "res": "Claim Filed",
    "stage": "Claims Filed",
    "src": "Zapier"
   },
   {
    "d": "2026-06-25",
    "rep": "Steven Arevalo",
    "cust": "Young Mi Kim",
    "res": "",
    "stage": "Claims Filed",
    "src": "Zapier"
   },
   {
    "d": "2026-06-24",
    "rep": "Andrew Prickel",
    "cust": "Elina Hum",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Inbound"
   },
   {
    "d": "2026-06-23",
    "rep": "Adam Mulvaney",
    "cust": "Bela Gandhi",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-23",
    "rep": "Adam Mulvaney",
    "cust": "Bishnu Dahal",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-23",
    "rep": "Alfred Duncan",
    "cust": "Nicole Menisce",
    "res": "Pitch Miss",
    "stage": "Inspection Set",
    "src": "Zapier"
   },
   {
    "d": "2026-06-22",
    "rep": "Adam Mulvaney",
    "cust": "Ethan Wiley",
    "res": "",
    "stage": "(none)",
    "src": "(none)"
   },
   {
    "d": "2026-06-22",
    "rep": "Adam Mulvaney",
    "cust": "Testr Shaw",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-22",
    "rep": "Jack Obert",
    "cust": "Hyun Yang",
    "res": "",
    "stage": "Discovery",
    "src": "Training"
   },
   {
    "d": "2026-06-20",
    "rep": "Andrew Prickel",
    "cust": "Test V47fix",
    "res": "",
    "stage": "Inspection Set",
    "src": "Zapier"
   },
   {
    "d": "2026-06-19",
    "rep": "Alfred Duncan",
    "cust": "Grant Williams",
    "res": "Claim Filed",
    "stage": "Approved",
    "src": "(none)"
   },
   {
    "d": "2026-06-18",
    "rep": "Alfred Duncan",
    "cust": "Muriel Cooper",
    "res": "",
    "stage": "Depreciation Being Released",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-06-18",
    "rep": "Andrew Prickel",
    "cust": "Diep Ha",
    "res": "",
    "stage": "Inspection Set",
    "src": "Zapier"
   },
   {
    "d": "2026-06-17",
    "rep": "Steven Arevalo",
    "cust": "William Ham",
    "res": "",
    "stage": "Inspection Set",
    "src": "Zapier"
   },
   {
    "d": "2026-06-16",
    "rep": "Alfred Duncan",
    "cust": "Dawn Sims",
    "res": "Claim Filed",
    "stage": "Discovery",
    "src": "Zapier"
   },
   {
    "d": "2026-06-16",
    "rep": "Alfred Duncan",
    "cust": "Alfredo Jones",
    "res": "No Demo",
    "stage": "Inspected",
    "src": "(none)"
   },
   {
    "d": "2026-06-16",
    "rep": "Alfred Duncan",
    "cust": "Victoria Snead",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-06-16",
    "rep": "Alfred Duncan",
    "cust": "Jarielle Stewart",
    "res": "No Demo",
    "stage": "Inspected",
    "src": "(none)"
   },
   {
    "d": "2026-06-15",
    "rep": "Andrew Prickel",
    "cust": "Jill Park",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-06-12",
    "rep": "Jack Obert",
    "cust": "Dustin Gress",
    "res": "",
    "stage": "Discovery",
    "src": "Inbound"
   },
   {
    "d": "2026-06-11",
    "rep": "Andrew Prickel",
    "cust": "Mike Schoultz",
    "res": "",
    "stage": "Lead",
    "src": "(none)"
   },
   {
    "d": "2026-06-11",
    "rep": "Kevin Mahan",
    "cust": "Darrel Smith",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-06-11",
    "rep": "Steven Arevalo",
    "cust": "Moe Mohammad",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-06-10",
    "rep": "Alfred Duncan",
    "cust": "Angelia Farmer",
    "res": "Claim Filed",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-06-10",
    "rep": "Alfred Duncan",
    "cust": "Ismaheel Ajibola",
    "res": "Claim Filed",
    "stage": "Supplementing",
    "src": "(none)"
   },
   {
    "d": "2026-06-10",
    "rep": "Andrew Prickel",
    "cust": "Chris Tolliver",
    "res": "",
    "stage": "Inspection Set",
    "src": "Previous Customer"
   },
   {
    "d": "2026-06-09",
    "rep": "Steven Arevalo",
    "cust": "Mark Friedman",
    "res": "",
    "stage": "Inspection Set",
    "src": "Truck Graphics"
   },
   {
    "d": "2026-06-04",
    "rep": "Andrew Prickel",
    "cust": "Caelen Ramos",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-06-04",
    "rep": "Andrew Prickel",
    "cust": "Aiko Ichimura",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-06-01",
    "rep": "Andrew Prickel",
    "cust": "Samantha Howser",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-06-01",
    "rep": "Andrew Prickel",
    "cust": "Neris Medrano",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-30",
    "rep": "Jack Obert",
    "cust": "Grace Neria",
    "res": "",
    "stage": "Claims Filed",
    "src": "Website"
   },
   {
    "d": "2026-05-29",
    "rep": "Alfred Duncan",
    "cust": "Gail Adams",
    "res": "No Demo",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-29",
    "rep": "Andrew Prickel",
    "cust": "Greg Horvath",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-05-29",
    "rep": "Andrew Prickel",
    "cust": "Micheele Fath",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-05-29",
    "rep": "Andrew Prickel",
    "cust": "Elizabeth Prevost",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-29",
    "rep": "Nick Seward",
    "cust": "Kristine Pribiash",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-28",
    "rep": "Andrew Prickel",
    "cust": "Tom Choquette",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-28",
    "rep": "Andrew Prickel",
    "cust": "Rick Marshall",
    "res": "Claim Filed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-28",
    "rep": "Andrew Prickel",
    "cust": "Jules Patry",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-28",
    "rep": "Nick Seward",
    "cust": "Westwood Facilities Group Undefined",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-27",
    "rep": "Jack Obert",
    "cust": "Albert Zacharias",
    "res": "",
    "stage": "Adjusters Meeting Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-27",
    "rep": "Kevin Mahan",
    "cust": "Carey Tang",
    "res": "Claim Filed",
    "stage": "Inspected",
    "src": "Company Set Inspection"
   },
   {
    "d": "2026-05-26",
    "rep": "Kevin Mahan",
    "cust": "Khalil Khalil",
    "res": "",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-26",
    "rep": "Kevin Mahan",
    "cust": "Heidi Hollis",
    "res": "Retail Sale",
    "stage": "Inspected",
    "src": "Inbound"
   },
   {
    "d": "2026-05-26",
    "rep": "Marc Mitchell",
    "cust": "Robert Voroux",
    "res": "",
    "stage": "Inspected",
    "src": "Inbound"
   },
   {
    "d": "2026-05-26",
    "rep": "Nick Seward",
    "cust": "Daniel Embry",
    "res": "",
    "stage": "Inspection Set",
    "src": "Previous Customer"
   },
   {
    "d": "2026-05-23",
    "rep": "Andrew Prickel",
    "cust": "Mike Schoultz",
    "res": "",
    "stage": "Lead",
    "src": "(none)"
   },
   {
    "d": "2026-05-22",
    "rep": "Andrew Prickel",
    "cust": "Bree Pedrayes",
    "res": "No Demo",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-05-22",
    "rep": "Andrew Prickel",
    "cust": "Susan Lambert",
    "res": "Claim Filed",
    "stage": "Discovery",
    "src": "Other"
   },
   {
    "d": "2026-05-21",
    "rep": "Jack Obert",
    "cust": "Noah Miller",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-21",
    "rep": "Marc Mitchell",
    "cust": "Cathy Lynne Doman",
    "res": "",
    "stage": "Discovery",
    "src": "Website"
   },
   {
    "d": "2026-05-20",
    "rep": "Alfred Duncan",
    "cust": "Donna Rogers",
    "res": "",
    "stage": "Inspection Set",
    "src": "(none)"
   },
   {
    "d": "2026-05-20",
    "rep": "Alfred Duncan",
    "cust": "Ron Stowe",
    "res": "",
    "stage": "Inspected",
    "src": "(none)"
   },
   {
    "d": "2026-05-19",
    "rep": "Alfred Duncan",
    "cust": "Robert Byrer",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-05-19",
    "rep": "Alfred Duncan",
    "cust": "Tracy Hillie",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Facebook"
   },
   {
    "d": "2026-05-19",
    "rep": "Alfred Duncan",
    "cust": "Tamika Jones",
    "res": "",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-05-19",
    "rep": "Kevin Mahan",
    "cust": "Emily Levin",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-05-18",
    "rep": "Jack Obert",
    "cust": "Patty Vazquez",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-18",
    "rep": "Kevin Mahan",
    "cust": "Vijaya Uppalapati",
    "res": "",
    "stage": "Scheduled",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-05-16",
    "rep": "Kevin Mahan",
    "cust": "Cynthia Fermin",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-15",
    "rep": "Adam Mulvaney",
    "cust": "Richard Goodfellow",
    "res": "",
    "stage": "Inspected",
    "src": "Inbound"
   },
   {
    "d": "2026-05-15",
    "rep": "Alfred Duncan",
    "cust": "Ron Stowe",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "(none)"
   },
   {
    "d": "2026-05-15",
    "rep": "Andrew Prickel",
    "cust": "Cathy Smith",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-15",
    "rep": "Nick Seward",
    "cust": "Anna Aguilera",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-14",
    "rep": "Andrew Prickel",
    "cust": "Nicole Wynn",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-14",
    "rep": "Andrew Prickel",
    "cust": "Syed Ahmed",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-14",
    "rep": "Marc Mitchell",
    "cust": "Tom Scott",
    "res": "",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-14",
    "rep": "Marc Mitchell",
    "cust": "Mike Goodman",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-13",
    "rep": "Alfred Duncan",
    "cust": "Willie Parker",
    "res": "",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-05-13",
    "rep": "Andrew Prickel",
    "cust": "Susan Manfred",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-05-13",
    "rep": "Andrew Prickel",
    "cust": "Kieth Bowman",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-12",
    "rep": "Andrew Prickel",
    "cust": "Mark Weshinskey",
    "res": "",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-10",
    "rep": "Jack Obert",
    "cust": "Hong Tiong",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-09",
    "rep": "Andrew Prickel",
    "cust": "Wayne Norwood",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-08",
    "rep": "Andrew Prickel",
    "cust": "Mandy Manthri",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-08",
    "rep": "Kevin Mahan",
    "cust": "Michelle Silva",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-07",
    "rep": "Alfred Duncan",
    "cust": "Tony Hawkins",
    "res": "Claim Filed",
    "stage": "Partials",
    "src": "Facebook"
   },
   {
    "d": "2026-05-07",
    "rep": "Alfred Duncan",
    "cust": "Freida Walton",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Facebook"
   },
   {
    "d": "2026-05-07",
    "rep": "Jack Obert",
    "cust": "Audry Escobedo",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-07",
    "rep": "Kevin Mahan",
    "cust": "Taylor Miles",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Truck Graphics"
   },
   {
    "d": "2026-05-06",
    "rep": "Alfred Duncan",
    "cust": "Ricardo Brannum",
    "res": "CA Signed",
    "stage": "Review Requested",
    "src": "Website"
   },
   {
    "d": "2026-05-06",
    "rep": "Alfred Duncan",
    "cust": "Danny Wahington",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-06",
    "rep": "Alfred Duncan",
    "cust": "Tiru Amen",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-06",
    "rep": "Andrew Prickel",
    "cust": "Ashfaq Buttar",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-05-05",
    "rep": "Andrew Prickel",
    "cust": "K S Ram Mohan",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Website"
   },
   {
    "d": "2026-05-05",
    "rep": "Andrew Prickel",
    "cust": "Steven Nagel",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-05",
    "rep": "Jack Obert",
    "cust": "Amy Upperman",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-05-05",
    "rep": "Jack Obert",
    "cust": "Charlie Chioehankitmun",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-04",
    "rep": "Adam Mulvaney",
    "cust": "Jimmy Tareen",
    "res": "",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-02",
    "rep": "Alfred Duncan",
    "cust": "Jessica Muller",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-05-02",
    "rep": "Marc Mitchell",
    "cust": "Thomas Kappler",
    "res": "",
    "stage": "Project Meeting Scheduled",
    "src": "Previous Customer"
   },
   {
    "d": "2026-05-01",
    "rep": "Jack Obert",
    "cust": "Greg Halsey",
    "res": "",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-04-30",
    "rep": "Adam Mulvaney",
    "cust": "Rebecca Henenlotter",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-30",
    "rep": "Andrew Prickel",
    "cust": "Christy Do",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Other"
   },
   {
    "d": "2026-04-28",
    "rep": "Andrew Prickel",
    "cust": "Jaime Corona",
    "res": "CA Signed",
    "stage": "Coordinating",
    "src": "Website"
   },
   {
    "d": "2026-04-28",
    "rep": "Jack Obert",
    "cust": "Stephanie Renner",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-27",
    "rep": "Adam Mulvaney",
    "cust": "Abdul Seediq",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-27",
    "rep": "Kevin Mahan",
    "cust": "SyTech Building",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-27",
    "rep": "Kevin Mahan",
    "cust": "Brian Moylan",
    "res": "",
    "stage": "Inspected",
    "src": "Other"
   },
   {
    "d": "2026-04-25",
    "rep": "Andrew Prickel",
    "cust": "Sergio Santos",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Alfred Duncan",
    "cust": "Dana Harris",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Alfred Duncan",
    "cust": "Joe Davis",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Andrew Prickel",
    "cust": "Valerie Sinkovits",
    "res": "",
    "stage": "Closed",
    "src": "Yard Signs"
   },
   {
    "d": "2026-04-24",
    "rep": "Jack Obert",
    "cust": "Kenny Scott",
    "res": "",
    "stage": "Coordinating",
    "src": "Inbound"
   },
   {
    "d": "2026-04-24",
    "rep": "Kevin Mahan",
    "cust": "Jeff Fowler",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Kevin Mahan",
    "cust": "Allen Alvarez",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Kevin Mahan",
    "cust": "Nicole Njeutcha",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-24",
    "rep": "Nick Seward",
    "cust": "Nick Fotos",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-23",
    "rep": "Kevin Mahan",
    "cust": "Jenny Zhang",
    "res": "CA Signed",
    "stage": "Partials",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-23",
    "rep": "Nick Seward",
    "cust": "Westridge Construction Partners .",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-22",
    "rep": "Jack Obert",
    "cust": "Tim Ferrara",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Inbound"
   },
   {
    "d": "2026-04-22",
    "rep": "Kevin Mahan",
    "cust": "Alex Rodriguez",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-21",
    "rep": "Alfred Duncan",
    "cust": "Ram Srinivasan",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-21",
    "rep": "Andrew Prickel",
    "cust": "Abida Bhatti",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-20",
    "rep": "Andrew Prickel",
    "cust": "Tina Schwartz",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Website"
   },
   {
    "d": "2026-04-20",
    "rep": "Jack Obert",
    "cust": "Cassandra Terry",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-20",
    "rep": "Jack Obert",
    "cust": "Wayne Chin",
    "res": "CA Signed",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-20",
    "rep": "Kevin Mahan",
    "cust": "Steve Iwicki",
    "res": "",
    "stage": "Closed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-04-18",
    "rep": "Jack Obert",
    "cust": "Pamela Howard",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-18",
    "rep": "Nick Seward",
    "cust": "Jack Schiavone",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-17",
    "rep": "Kevin Mahan",
    "cust": "Claire King",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-17",
    "rep": "Kevin Mahan",
    "cust": "Jane Lochner",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Inbound"
   },
   {
    "d": "2026-04-17",
    "rep": "Nick Seward",
    "cust": "Abdellatif Rayan",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-16",
    "rep": "Alfred Duncan",
    "cust": "Seria Lakes",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-16",
    "rep": "Kevin Mahan",
    "cust": "Zdravko Sonje",
    "res": "CA Signed",
    "stage": "Project Meeting Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-15",
    "rep": "Alfred Duncan",
    "cust": "Curtis Blue",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-15",
    "rep": "Alfred Duncan",
    "cust": "Muriel Cooper",
    "res": "Claim Filed",
    "stage": "Depreciation Being Released",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-15",
    "rep": "Alfred Duncan",
    "cust": "Jonathan Jeter",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-15",
    "rep": "Andrew Prickel",
    "cust": "Ryan Appel",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-14",
    "rep": "Alfred Duncan",
    "cust": "Venessa Mckay",
    "res": "CA Signed",
    "stage": "Ready for Project Meeting",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-14",
    "rep": "Alfred Duncan",
    "cust": "Tianna Brown",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-04-14",
    "rep": "Alfred Duncan",
    "cust": "Lisa Robertson",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-04-14",
    "rep": "Kevin Mahan",
    "cust": "Holdden Miller",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-13",
    "rep": "Alfred Duncan",
    "cust": "Valora Lewis",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-13",
    "rep": "Andrew Prickel",
    "cust": "David Turnbull",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-13",
    "rep": "Andrew Prickel",
    "cust": "Alan Dolleck",
    "res": "CA Signed",
    "stage": "Invoiced",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-12",
    "rep": "Isabelle Price",
    "cust": "Vasu Muthu",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-11",
    "rep": "Alfred Duncan",
    "cust": "Joe Bahleda",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-11",
    "rep": "Andrew Prickel",
    "cust": "Nasryne Matin",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-11",
    "rep": "Andrew Prickel",
    "cust": "Zubin Ali",
    "res": "",
    "stage": "Supplementing",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Alfred Duncan",
    "cust": "Claire Jenkins",
    "res": "CA Signed",
    "stage": "Supplementing",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Alfred Duncan",
    "cust": "Jeffrey Johnson",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Andrew Prickel",
    "cust": "William Kang",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-04-10",
    "rep": "Andrew Prickel",
    "cust": "Eric Moore",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Andrew Prickel",
    "cust": "Rob Ravas",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Andrew Prickel",
    "cust": "Tony Syme",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Kevin Mahan",
    "cust": "Diedre Shelton",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-10",
    "rep": "Marc Mitchell",
    "cust": "Francis Alarie",
    "res": "",
    "stage": "Invoiced",
    "src": "Website"
   },
   {
    "d": "2026-04-09",
    "rep": "Alfred Duncan",
    "cust": "Sybrae Musgrove",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-04-09",
    "rep": "Alfred Duncan",
    "cust": "Olesia Drakk",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-09",
    "rep": "Andrew Prickel",
    "cust": "William Raduchel",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-09",
    "rep": "Andrew Prickel",
    "cust": "Rene Sorra",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-09",
    "rep": "Andrew Prickel",
    "cust": "Don Basnight",
    "res": "Damage NO CA",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-04-09",
    "rep": "Andrew Prickel",
    "cust": "Michael Yeh",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-09",
    "rep": "Andrew Prickel",
    "cust": "Jim Cahill",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Other"
   },
   {
    "d": "2026-04-09",
    "rep": "Kevin Mahan",
    "cust": "Cheryl Feldman",
    "res": "",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-09",
    "rep": "Nick Seward",
    "cust": "Baz S",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-08",
    "rep": "Andrew Prickel",
    "cust": "Lori Bradley",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-08",
    "rep": "Kevin Mahan",
    "cust": "Jeffrey Butts",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-07",
    "rep": "Adam Mulvaney",
    "cust": "A Yerger inc A Yerger inc",
    "res": "Repair Not Sold",
    "stage": "Production",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-07",
    "rep": "Alfred Duncan",
    "cust": "Ray Dorsey",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-07",
    "rep": "Andrew Prickel",
    "cust": "Nauman Ahmed",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-07",
    "rep": "Andrew Prickel",
    "cust": "Michael Bratt",
    "res": "",
    "stage": "Closed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-04-07",
    "rep": "Andrew Prickel",
    "cust": "Joesph Mike",
    "res": "",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-04-07",
    "rep": "Kevin Mahan",
    "cust": "Anand Agrawal",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Other"
   },
   {
    "d": "2026-04-06",
    "rep": "Adam Mulvaney",
    "cust": "Yasser Bosalios",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-06",
    "rep": "Alfred Duncan",
    "cust": "Leroy Bailey",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-06",
    "rep": "Robert Wilson",
    "cust": "Theresa Croson",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-05",
    "rep": "Alfred Duncan",
    "cust": "Danny Personger",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-04",
    "rep": "Alfred Duncan",
    "cust": "MD NEIGHBORLY NETWORKS INC",
    "res": "CA Signed",
    "stage": "Depreciation Being Released",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-04",
    "rep": "Andrew Prickel",
    "cust": "Chris Conley",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-04-04",
    "rep": "Marc Mitchell",
    "cust": "Paul Gautum",
    "res": "",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-04-03",
    "rep": "Adam Mulvaney",
    "cust": "Tanaz Jalinoos",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Other"
   },
   {
    "d": "2026-04-03",
    "rep": "Andrew Prickel",
    "cust": "George Oden",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-03",
    "rep": "Jack Obert",
    "cust": "BEAUX GONZALES",
    "res": "",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-04-03",
    "rep": "Kevin Mahan",
    "cust": "Kelly Shen",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-04-03",
    "rep": "Steven Arevalo",
    "cust": "Dawit Deri",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-02",
    "rep": "Andrew Prickel",
    "cust": "Michael Cohen",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-02",
    "rep": "Jack Obert",
    "cust": "Kathy Showker",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-02",
    "rep": "Kevin Mahan",
    "cust": "Leon Radomsky",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Website"
   },
   {
    "d": "2026-04-02",
    "rep": "Kevin Mahan",
    "cust": "Jimmy Brooks",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-04-01",
    "rep": "Alfred Duncan",
    "cust": "Terry Coleman",
    "res": "Retail Sale",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-04-01",
    "rep": "Andrew Prickel",
    "cust": "Steve Varmecky",
    "res": "CA Signed",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-04-01",
    "rep": "Kevin Mahan",
    "cust": "Emelia Annum",
    "res": "",
    "stage": "Depreciation Being Released",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-04-01",
    "rep": "Kevin Mahan",
    "cust": "Brian Sumerwell",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-31",
    "rep": "Alfred Duncan",
    "cust": "Carl Caltagirone",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-31",
    "rep": "Kevin Mahan",
    "cust": "Jonathon Opata",
    "res": "CA Signed",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-31",
    "rep": "Kevin Mahan",
    "cust": "Marcin Filipczyk",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-31",
    "rep": "Nick Seward",
    "cust": "Shawn Ventner",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-30",
    "rep": "Alfred Duncan",
    "cust": "Bruce Miles",
    "res": "No Answer/No Appointment Actually Set",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-03-30",
    "rep": "Andrew Prickel",
    "cust": "Wajma Quraishi",
    "res": "CA Signed",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-30",
    "rep": "Andrew Prickel",
    "cust": "Charles Pendleton",
    "res": "CA Signed",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-30",
    "rep": "Kevin Mahan",
    "cust": "Wais Yaqub",
    "res": "CA Signed",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-30",
    "rep": "Kevin Mahan",
    "cust": "Ty Fulton",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-27",
    "rep": "Andrew Prickel",
    "cust": "Matthew Ambrogi",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-27",
    "rep": "Andrew Prickel",
    "cust": "Jerri Ricks",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-03-27",
    "rep": "Andrew Prickel",
    "cust": "Rolando Paguio",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-26",
    "rep": "Andrew Prickel",
    "cust": "Kelci Crockett",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-26",
    "rep": "Isabelle Price",
    "cust": "David Coleman",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-26",
    "rep": "Nick Seward",
    "cust": "Brian Pettygrove",
    "res": "Repair Sold",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-03-25",
    "rep": "Adam Mulvaney",
    "cust": "Meghan McCagg",
    "res": "Repair Sold",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-25",
    "rep": "Alfred Duncan",
    "cust": "Sheila Hunter",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-03-25",
    "rep": "Andrew Prickel",
    "cust": "Huanxin Brown",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-25",
    "rep": "Andrew Prickel",
    "cust": "Doug Kelly",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-25",
    "rep": "Andrew Prickel",
    "cust": "Sung Kim",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-24",
    "rep": "Alfred Duncan",
    "cust": "Kim Williams",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-24",
    "rep": "Andrew Prickel",
    "cust": "William Ray",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-24",
    "rep": "Jack Obert",
    "cust": "Michael Cummins",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-24",
    "rep": "Jack Obert",
    "cust": "Kim Chu",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-24",
    "rep": "Nick Seward",
    "cust": "Ferdinand Reid",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-23",
    "rep": "Alfred Duncan",
    "cust": "Tina Hornsby",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-23",
    "rep": "Andrew Prickel",
    "cust": "Joseph Key",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-03-23",
    "rep": "Jack Obert",
    "cust": "Gabriela Nichols",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-23",
    "rep": "Nick Seward",
    "cust": "AJ Siam",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-21",
    "rep": "Alfred Duncan",
    "cust": "Diana Keull",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-21",
    "rep": "Andrew Prickel",
    "cust": "Zack Throckmorton",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-21",
    "rep": "Andrew Prickel",
    "cust": "Collin Mendenhall",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-21",
    "rep": "Isabelle Price",
    "cust": "Suraj Sangroula",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-21",
    "rep": "Kevin Mahan",
    "cust": "Muru Sam",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Inbound"
   },
   {
    "d": "2026-03-20",
    "rep": "Alfred Duncan",
    "cust": "Olivia Mantohbang",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-20",
    "rep": "Andrew Prickel",
    "cust": "Alan Undefined",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-20",
    "rep": "Andrew Prickel",
    "cust": "Kazim Jahami",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-20",
    "rep": "Jack Obert",
    "cust": "Robert Irving",
    "res": "",
    "stage": "Inspection Set",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-03-19",
    "rep": "Alfred Duncan",
    "cust": "Desma Nicholson",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Facebook"
   },
   {
    "d": "2026-03-19",
    "rep": "Kevin Mahan",
    "cust": "Barbara Roy",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-19",
    "rep": "Nick Seward",
    "cust": "Matt Slocum",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-18",
    "rep": "Adam Mulvaney",
    "cust": "Daniel Meresie",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-18",
    "rep": "Adam Mulvaney",
    "cust": "Leona Than",
    "res": "Repair Sold",
    "stage": "Closed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-03-18",
    "rep": "Alfred Duncan",
    "cust": "Marcus Smith",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-18",
    "rep": "Alfred Duncan",
    "cust": "Cynthia Simpson",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-18",
    "rep": "Andrew Prickel",
    "cust": "Michelle Kelly",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-03-18",
    "rep": "Jack Obert",
    "cust": "Wen Kai",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-18",
    "rep": "Nick Seward",
    "cust": "Steve Undefined",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-17",
    "rep": "Adam Mulvaney",
    "cust": "Yuba Sigdel",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-03-17",
    "rep": "Adam Mulvaney",
    "cust": "Zach Conway",
    "res": "",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-03-17",
    "rep": "Alfred Duncan",
    "cust": "Anthony Cheatum",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Alfred Duncan",
    "cust": "Micheal Flowers",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Alfred Duncan",
    "cust": "Natina English",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Alfred Duncan",
    "cust": "Suki Junious",
    "res": "Repair Sold",
    "stage": "Inspected",
    "src": "Facebook"
   },
   {
    "d": "2026-03-17",
    "rep": "Andrew Prickel",
    "cust": "Janet & David Gray",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-17",
    "rep": "Isabelle Price",
    "cust": "Hong Pham",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Nick Seward",
    "cust": "Romero Camarillo",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Nick Seward",
    "cust": "Vineeth Vasudevan",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-17",
    "rep": "Nick Seward",
    "cust": "Eddie Jay",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-16",
    "rep": "Andrew Prickel",
    "cust": "Paul Nelson",
    "res": "CA Signed",
    "stage": "Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-16",
    "rep": "Andrew Prickel",
    "cust": "Chris Brown",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-16",
    "rep": "Andrew Prickel",
    "cust": "Mike Haynes",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-16",
    "rep": "Kevin Mahan",
    "cust": "Garima Lall",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-03-16",
    "rep": "Nick Seward",
    "cust": "Christina Coles",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-16",
    "rep": "Nick Seward",
    "cust": "Vic Sing",
    "res": "CA Signed",
    "stage": "Partials",
    "src": "Other"
   },
   {
    "d": "2026-03-15",
    "rep": "Jack Obert",
    "cust": "David Hammerly",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-15",
    "rep": "Jack Obert",
    "cust": "Dustin Bakshi",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-14",
    "rep": "Alfred Duncan",
    "cust": "Imani Fushay",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-14",
    "rep": "Alfred Duncan",
    "cust": "Adam Baghbabi",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-03-14",
    "rep": "Andrew Prickel",
    "cust": "James Kubilius",
    "res": "",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-14",
    "rep": "Jack Obert",
    "cust": "John Yu",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-14",
    "rep": "Jack Obert",
    "cust": "Tony Hsu",
    "res": "",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-03-14",
    "rep": "Jack Obert",
    "cust": "Nancy Stoepker",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-14",
    "rep": "Nick Seward",
    "cust": "Endri Merxhushi",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-14",
    "rep": "Steven Arevalo",
    "cust": "Beakal (B.K.) Tekola",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-13",
    "rep": "Isabelle Price",
    "cust": "Helen Carter",
    "res": "",
    "stage": "Claims Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-13",
    "rep": "Isabelle Price",
    "cust": "Kristina Evans",
    "res": "",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-13",
    "rep": "Kevin Mahan",
    "cust": "Amir Soltanian",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-13",
    "rep": "Kevin Mahan",
    "cust": "Marilyn James",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-13",
    "rep": "Nick Seward",
    "cust": "Troy McGhee",
    "res": "",
    "stage": "Inspected",
    "src": "Previous Customer"
   },
   {
    "d": "2026-03-13",
    "rep": "Nick Seward",
    "cust": "Bob Bosco",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-12",
    "rep": "Andrew Prickel",
    "cust": "Gina Rupert",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-12",
    "rep": "Kevin Mahan",
    "cust": "Tim Scheiderer",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-12",
    "rep": "Kevin Mahan",
    "cust": "Scott Shedeck",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Truck Graphics"
   },
   {
    "d": "2026-03-12",
    "rep": "Nick Seward",
    "cust": "Donato Mastrangelo",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-11",
    "rep": "Alfred Duncan",
    "cust": "Tynell Edwards",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-11",
    "rep": "Alfred Duncan",
    "cust": "Patricia Eaddy",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-11",
    "rep": "Kevin Mahan",
    "cust": "Tyler Cooper",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-10",
    "rep": "Andrew Prickel",
    "cust": "Wendy Holland",
    "res": "Retail Sale",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-09",
    "rep": "Alfred Duncan",
    "cust": "Kathy Lukenic",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-09",
    "rep": "Andrew Prickel",
    "cust": "Bonnie & Jeff Flippo",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-09",
    "rep": "Kevin Mahan",
    "cust": "Jonathan Gillis",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-09",
    "rep": "Kevin Mahan",
    "cust": "Rinu Reghuthaman",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-03-09",
    "rep": "Kevin Mahan",
    "cust": "Gerta Wasserman",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-07",
    "rep": "Kevin Mahan",
    "cust": "Nicole Nasiatka",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-03-06",
    "rep": "Alfred Duncan",
    "cust": "Patricia Undefined",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Alfred Duncan",
    "cust": "Brenda Simpson",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Andrew Prickel",
    "cust": "Haval Shamdeen",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Andrew Prickel",
    "cust": "Dale King",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Isabelle Price",
    "cust": "Marita Bogdanski",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Isabelle Price",
    "cust": "Michael McGregor",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-05",
    "rep": "Jack Obert",
    "cust": "Yaron Eidelman",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-03-05",
    "rep": "Steven Arevalo",
    "cust": "Honee Hult",
    "res": "",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-03-04",
    "rep": "Andrew Prickel",
    "cust": "Matthew Hemsley",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-04",
    "rep": "Andrew Prickel",
    "cust": "Bahadir Yetki",
    "res": "",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-03",
    "rep": "Alfred Duncan",
    "cust": "Justine Isbell",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-03",
    "rep": "Andrew Prickel",
    "cust": "Nafisa T",
    "res": "Damage NO CA",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-03",
    "rep": "Nick Seward",
    "cust": "Jyoti Karki",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-02",
    "rep": "Andrew Prickel",
    "cust": "Catherine Lin",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-03-02",
    "rep": "Jack Obert",
    "cust": "Marjorie & Mark Brown",
    "res": "",
    "stage": "Inspection Set",
    "src": "Previous Customer"
   },
   {
    "d": "2026-02-27",
    "rep": "Alfred Duncan",
    "cust": "Myia Belton",
    "res": "",
    "stage": "Project Meeting Scheduled",
    "src": "Website"
   },
   {
    "d": "2026-02-27",
    "rep": "Andrew Prickel",
    "cust": "Brenda Cook",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-27",
    "rep": "Marc Mitchell",
    "cust": "Roshan Punn",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-27",
    "rep": "Nick Seward",
    "cust": "Cindy Reppert",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-27",
    "rep": "Nick Seward",
    "cust": "Phillip Oravete",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-27",
    "rep": "Steven Arevalo",
    "cust": "Shawn Seidell",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-26",
    "rep": "Marc Mitchell",
    "cust": "Ramsey Talladivedula",
    "res": "",
    "stage": "Inspection Set",
    "src": "Company Set Inspection"
   },
   {
    "d": "2026-02-26",
    "rep": "Nick Seward",
    "cust": "Gail Manuel",
    "res": "",
    "stage": "Inspection Set",
    "src": "Truck Graphics"
   },
   {
    "d": "2026-02-25",
    "rep": "Andrew Prickel",
    "cust": "Michael Voegele",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-02-25",
    "rep": "Jack Obert",
    "cust": "Georgiana DA CRUZ LIMA ANDRADE",
    "res": "",
    "stage": "Scheduled",
    "src": "Other"
   },
   {
    "d": "2026-02-25",
    "rep": "Marc Mitchell",
    "cust": "Edward Tao",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-25",
    "rep": "Marc Mitchell",
    "cust": "Vamshi Chilukamarri",
    "res": "",
    "stage": "Inspection Set",
    "src": "Facebook"
   },
   {
    "d": "2026-02-24",
    "rep": "Andrew Prickel",
    "cust": "Jeff Roberts",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-24",
    "rep": "Jack Obert",
    "cust": "Donna Thompson",
    "res": "",
    "stage": "Warranty Filed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-24",
    "rep": "Marc Mitchell",
    "cust": "Kim Fischer",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-24",
    "rep": "Marc Mitchell",
    "cust": "Jill Rosengarten",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-23",
    "rep": "Adam Mulvaney",
    "cust": "Anna Deeny",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-23",
    "rep": "Alfred Duncan",
    "cust": "Andrew James",
    "res": "",
    "stage": "Discovery",
    "src": "Other"
   },
   {
    "d": "2026-02-21",
    "rep": "Alfred Duncan",
    "cust": "David Bethea",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-02-21",
    "rep": "Kevin Mahan",
    "cust": "Paul Hirsh",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-21",
    "rep": "Kevin Mahan",
    "cust": "Rob Gelo",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-21",
    "rep": "Robert Wilson",
    "cust": "Maura Pappas",
    "res": "",
    "stage": "Inspected",
    "src": "Other"
   },
   {
    "d": "2026-02-20",
    "rep": "Adam Mulvaney",
    "cust": "Ashley Staheli",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-20",
    "rep": "Andrew Prickel",
    "cust": "Arnold Baker",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Previous Customer"
   },
   {
    "d": "2026-02-20",
    "rep": "Jack Obert",
    "cust": "Sue Ryan",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-20",
    "rep": "Kevin Mahan",
    "cust": "Dora Sasi",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-20",
    "rep": "Nick Seward",
    "cust": "Pedro Fernandez",
    "res": "",
    "stage": "Closed",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-02-19",
    "rep": "Alfred Duncan",
    "cust": "Jason Thorpe",
    "res": "No Answer/No Appointment Actually Set",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-02-19",
    "rep": "Andrew Prickel",
    "cust": "Gil Rushton",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-02-19",
    "rep": "Jack Obert",
    "cust": "Thomas Cochran",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-19",
    "rep": "Kevin Mahan",
    "cust": "Paul Kim",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-18",
    "rep": "Andrew Prickel",
    "cust": "Chris Klinke",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-18",
    "rep": "Andrew Prickel",
    "cust": "Al Massey",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-17",
    "rep": "Andrew Prickel",
    "cust": "Saba Tseggai",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-16",
    "rep": "Andrew Prickel",
    "cust": "Roberto De Ocampo",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-16",
    "rep": "Jack Obert",
    "cust": "Darla Harris",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-16",
    "rep": "Kevin Mahan",
    "cust": "Istar Ali",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-16",
    "rep": "Kevin Mahan",
    "cust": "Steve Hart",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-14",
    "rep": "Adam Mulvaney",
    "cust": "Janice Stopa",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-02-13",
    "rep": "Andrew Prickel",
    "cust": "Joe Collins",
    "res": "CA Signed",
    "stage": "Discovery",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-13",
    "rep": "Kevin Mahan",
    "cust": "Prabha Bhatter",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-13",
    "rep": "Kevin Mahan",
    "cust": "Susan Estes",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-02-13",
    "rep": "Kevin Mahan",
    "cust": "Jim Murphy",
    "res": "",
    "stage": "(none)",
    "src": "Other"
   },
   {
    "d": "2026-02-13",
    "rep": "Nick Seward",
    "cust": "Joann & Nils Straatveit",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-12",
    "rep": "Andrew Prickel",
    "cust": "Purna Pabolu",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-12",
    "rep": "Andrew Prickel",
    "cust": "Sara Barton",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-12",
    "rep": "Andrew Prickel",
    "cust": "Nagendra Tomluru",
    "res": "Damage NO CA",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-12",
    "rep": "Andrew Prickel",
    "cust": "Joann Lyell",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-12",
    "rep": "Marc Mitchell",
    "cust": "Sabrina Moses",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-12",
    "rep": "Nick Seward",
    "cust": "Mike Brown",
    "res": "Damage NO CA",
    "stage": "Adjusters Meeting Scheduled",
    "src": "Previous Customer"
   },
   {
    "d": "2026-02-11",
    "rep": "Nick Seward",
    "cust": "Brittany Cable",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-10",
    "rep": "Adam Mulvaney",
    "cust": "Cedric Lee",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-10",
    "rep": "Andrew Prickel",
    "cust": "Zach Hashemi",
    "res": "Damage NO CA",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-10",
    "rep": "Nick Seward",
    "cust": "Madhav Sharma",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-10",
    "rep": "Nick Seward",
    "cust": "Brad Bunnell",
    "res": "CA Signed",
    "stage": "Project Meeting Scheduled",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-09",
    "rep": "Kevin Mahan",
    "cust": "Gino Pietroforte",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-09",
    "rep": "Nick Seward",
    "cust": "Azim Malik",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-09",
    "rep": "Nick Seward",
    "cust": "Alex Lopez",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-09",
    "rep": "Steven Arevalo",
    "cust": "Haroon Omar",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-07",
    "rep": "Marc Mitchell",
    "cust": "Shirley Leach",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-07",
    "rep": "Nick Seward",
    "cust": "Lee Adolph",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-07",
    "rep": "Nick Seward",
    "cust": "Nicholas Munn",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-07",
    "rep": "Nick Seward",
    "cust": "Amy Tolentino",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-06",
    "rep": "Kevin Mahan",
    "cust": "Chris Kies",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-06",
    "rep": "Nick Seward",
    "cust": "Ligia Cheron",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-06",
    "rep": "Nick Seward",
    "cust": "Moses Debesai",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-02-05",
    "rep": "Andrew Prickel",
    "cust": "Paul Egan",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-05",
    "rep": "Nick Seward",
    "cust": "Abby Isreal",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-05",
    "rep": "Nick Seward",
    "cust": "Nicholas Bauer",
    "res": "Repair Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-05",
    "rep": "Nick Seward",
    "cust": "Henry Graves",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-04",
    "rep": "Andrew Prickel",
    "cust": "Andrew Easter",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-02-04",
    "rep": "Kevin Mahan",
    "cust": "Mandy N",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-02-04",
    "rep": "Nick Seward",
    "cust": "Alex Cutts",
    "res": "Repair Not Sold",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-30",
    "rep": "Andrew Prickel",
    "cust": "Kate Leftin",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Word of Mouth"
   },
   {
    "d": "2026-01-29",
    "rep": "Andrew Prickel",
    "cust": "Monica Pove",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Other"
   },
   {
    "d": "2026-01-28",
    "rep": "Nick Seward",
    "cust": "Alex Lopez",
    "res": "NO Damage",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-24",
    "rep": "Jack Obert",
    "cust": "Chad Hetrick",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-24",
    "rep": "Nick Seward",
    "cust": "Mark Lehner",
    "res": "Repair Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-23",
    "rep": "Andrew Prickel",
    "cust": "John Gutierrez",
    "res": "Retail Pitch Miss",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-23",
    "rep": "Jack Obert",
    "cust": "Beverly Fitzgerald",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-23",
    "rep": "Kevin Mahan",
    "cust": "Samuel (Sam) Hidalgo",
    "res": "NO Damage",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-23",
    "rep": "Kevin Mahan",
    "cust": "Jeff Perrin",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-23",
    "rep": "Nick Seward",
    "cust": "Harry Singh",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-01-23",
    "rep": "Nick Seward",
    "cust": "Yeun Wong",
    "res": "Customer Canceled Appointment",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-22",
    "rep": "Adam Mulvaney",
    "cust": "Martin & Colette Fuller",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-22",
    "rep": "Kevin Mahan",
    "cust": "Manisha Gupta",
    "res": "CA Signed",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-01-22",
    "rep": "Nick Seward",
    "cust": "Praveen Sambaraju",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-20",
    "rep": "Andrew Prickel",
    "cust": "Eric Bosset",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-20",
    "rep": "Andrew Prickel",
    "cust": "Miranda Schneider",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-19",
    "rep": "Andrew Prickel",
    "cust": "Ann Kuzel",
    "res": "",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-01-19",
    "rep": "Kevin Mahan",
    "cust": "Shi Shi",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-19",
    "rep": "Kevin Mahan",
    "cust": "Jay Fuller",
    "res": "Repair Not Sold",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-01-19",
    "rep": "Steven Arevalo",
    "cust": "Matt Royer",
    "res": "Retail Sale",
    "stage": "Closed",
    "src": "Other"
   },
   {
    "d": "2026-01-17",
    "rep": "Kevin Mahan",
    "cust": "Varghese George",
    "res": "Retail Pitch Miss",
    "stage": "Inspected",
    "src": "Website"
   },
   {
    "d": "2026-01-16",
    "rep": "Nick Seward",
    "cust": "Luke Bonus",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-16",
    "rep": "Robert Wilson",
    "cust": "Sheila Kosecke",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-15",
    "rep": "Alfred Duncan",
    "cust": "Wai Chan",
    "res": "",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-15",
    "rep": "Andrew Prickel",
    "cust": "Curt Le",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-01-15",
    "rep": "Andrew Prickel",
    "cust": "Hachem Abdellaoui",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-15",
    "rep": "Jack Obert",
    "cust": "Henry Nixon",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-01-13",
    "rep": "Andrew Prickel",
    "cust": "Jordan David",
    "res": "",
    "stage": "Inspection Set",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-13",
    "rep": "Jack Obert",
    "cust": "Danielle Fey",
    "res": "",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-01-13",
    "rep": "Kevin Mahan",
    "cust": "Andrea Joe",
    "res": "",
    "stage": "Closed",
    "src": "Google Ads - LSA"
   },
   {
    "d": "2026-01-12",
    "rep": "Andrew Prickel",
    "cust": "Eric Singley",
    "res": "",
    "stage": "Closed",
    "src": "Website"
   },
   {
    "d": "2026-01-12",
    "rep": "Kevin Mahan",
    "cust": "Rebecca Frank",
    "res": "Damage NO CA",
    "stage": "Inspection Set",
    "src": "Website"
   },
   {
    "d": "2026-01-12",
    "rep": "Kevin Mahan",
    "cust": "Shiva Arora",
    "res": "Damage NO CA",
    "stage": "Inspected",
    "src": "Google Ads - LSA"
   }
  ]
 }
};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  const office = (url.searchParams.get('office') || 'herndon').toLowerCase();
  const data = SNAPSHOTS[office];
  if (!data) { res.status(404).json({ error: 'no snapshot for office', office }); return; }
  res.status(200).json(data);
};
