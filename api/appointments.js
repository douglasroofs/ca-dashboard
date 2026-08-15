// api/appointments.js - Leads & Appointments snapshot (Herndon).
//
// SOURCE: Leap DataBuilder report 3197 'Marketing Division Appointments Report (M2D)',
// JP company 5154 (Herndon). Field mapping confirmed 2026-08-14:
//   f_0 Sales Rep / Customer Rep | f_1 Appointment Name | f_2 Appointment Result
//   f_3 Job Current Stage        | f_4 Referral Source  | f_5 Appointment Start Date
//   f_6 Customer Full Name
//
// WHY A SNAPSHOT AND NOT LIVE: reporting-api.jobprogress.com authenticates with the
// rb_auth_token SSO cookie. The JobProgress public-API OAuth token used by revenue.js
// returns 401 there (verified), so a server cannot reach DataBuilder. The public API's
// /appointments endpoint IS reachable server-side but returns raw records: `result` is an
// unresolved questionnaire array and `result_option_ids` are bare ids with no lookup
// endpoint, and `user` is the appointment owner rather than the sales rep. Resolving that
// would be guesswork, so this snapshot uses DataBuilder values that match Leap's own
// reporting. Refresh by re-running the browser pull.
//
// BUCKETS (approved by Kyle 2026-08-14):
//   sold    = CA Signed, Retail Sale, Repair Sold
//   pending = Claim Filed, Damage NO CA
//   drip    = NO Damage, Repair Not Sold, Retail Pitch Miss, Pitch Miss, No Demo
//   dead    = Customer Canceled Appointment, No Answer/No Appointment Actually Set
//   unresulted = blank Appointment Result (the manager alert metric)

const SNAPSHOTS = {
  "herndon": {
    "updated": "2026-08-15T11:28:04.014Z",
    "year": 2026,
    "totals": {
      "total": 495,
      "sold": 89,
      "pending": 38,
      "drip": 114,
      "dead": 20,
      "unresulted": 234,
      "other": 0
    },
    "reps": [
      {
        "rep": "Andrew Prickel",
        "total": 150,
        "sold": 40,
        "pending": 13,
        "drip": 45,
        "dead": 5,
        "unresulted": 47,
        "other": 0,
        "results": {
          "(unresulted)": 47,
          "Retail Sale": 18,
          "NO Damage": 8,
          "No Demo": 11,
          "CA Signed": 22,
          "Damage NO CA": 6,
          "Customer Canceled Appointment": 5,
          "Claim Filed": 7,
          "Retail Pitch Miss": 14,
          "Pitch Miss": 2,
          "Repair Not Sold": 10
        }
      },
      {
        "rep": "Alfred Duncan",
        "total": 76,
        "sold": 10,
        "pending": 10,
        "drip": 35,
        "dead": 5,
        "unresulted": 16,
        "other": 0,
        "results": {
          "Claim Filed": 6,
          "(unresulted)": 16,
          "No Demo": 4,
          "Customer Canceled Appointment": 3,
          "Retail Pitch Miss": 11,
          "Damage NO CA": 4,
          "NO Damage": 5,
          "Repair Not Sold": 14,
          "Repair Sold": 1,
          "Pitch Miss": 1,
          "CA Signed": 8,
          "No Answer/No Appointment Actually Set": 2,
          "Retail Sale": 1
        }
      },
      {
        "rep": "Kevin Mahan",
        "total": 69,
        "sold": 19,
        "pending": 13,
        "drip": 16,
        "dead": 5,
        "unresulted": 16,
        "other": 0,
        "results": {
          "Damage NO CA": 12,
          "Retail Pitch Miss": 5,
          "CA Signed": 16,
          "Repair Not Sold": 7,
          "(unresulted)": 16,
          "NO Damage": 4,
          "Customer Canceled Appointment": 5,
          "Retail Sale": 3,
          "Claim Filed": 1
        }
      },
      {
        "rep": "Nick Seward",
        "total": 58,
        "sold": 13,
        "pending": 2,
        "drip": 12,
        "dead": 4,
        "unresulted": 27,
        "other": 0,
        "results": {
          "NO Damage": 5,
          "Retail Sale": 5,
          "(unresulted)": 27,
          "Repair Sold": 3,
          "CA Signed": 5,
          "Damage NO CA": 2,
          "Customer Canceled Appointment": 4,
          "Repair Not Sold": 6,
          "Retail Pitch Miss": 1
        }
      },
      {
        "rep": "Steven Arevalo",
        "total": 44,
        "sold": 1,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 43,
        "other": 0,
        "results": {
          "(unresulted)": 43,
          "Retail Sale": 1
        }
      },
      {
        "rep": "Jack Obert",
        "total": 41,
        "sold": 2,
        "pending": 0,
        "drip": 1,
        "dead": 0,
        "unresulted": 38,
        "other": 0,
        "results": {
          "(unresulted)": 38,
          "Retail Pitch Miss": 1,
          "CA Signed": 2
        }
      },
      {
        "rep": "Adam Mulvaney",
        "total": 21,
        "sold": 4,
        "pending": 0,
        "drip": 4,
        "dead": 0,
        "unresulted": 13,
        "other": 0,
        "results": {
          "(unresulted)": 13,
          "CA Signed": 1,
          "Repair Sold": 3,
          "Repair Not Sold": 3,
          "Retail Pitch Miss": 1
        }
      },
      {
        "rep": "Marc Mitchell",
        "total": 16,
        "sold": 0,
        "pending": 0,
        "drip": 1,
        "dead": 1,
        "unresulted": 14,
        "other": 0,
        "results": {
          "Customer Canceled Appointment": 1,
          "(unresulted)": 14,
          "Repair Not Sold": 1
        }
      },
      {
        "rep": "Isabelle Price",
        "total": 9,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 9,
        "other": 0,
        "results": {
          "(unresulted)": 9
        }
      },
      {
        "rep": "Steven Arevalo,Steven Arevalo",
        "total": 4,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 4,
        "other": 0,
        "results": {
          "(unresulted)": 4
        }
      },
      {
        "rep": "Robert Wilson",
        "total": 3,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 3,
        "other": 0,
        "results": {
          "(unresulted)": 3
        }
      },
      {
        "rep": "Adam Mulvaney,Adam Mulvaney",
        "total": 2,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 2,
        "other": 0,
        "results": {
          "(unresulted)": 2
        }
      },
      {
        "rep": "Marc Mitchell ,Marc Mitchell",
        "total": 1,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 1,
        "other": 0,
        "results": {
          "(unresulted)": 1
        }
      },
      {
        "rep": "Andrew Prickel ,Andrew Prickel",
        "total": 1,
        "sold": 0,
        "pending": 0,
        "drip": 0,
        "dead": 0,
        "unresulted": 1,
        "other": 0,
        "results": {
          "(unresulted)": 1
        }
      }
    ],
    "stages": {
      "Inspection Set": 264,
      "Claims Filed": 24,
      "Closed": 54,
      "Ready for Project Meeting": 3,
      "Inspected": 82,
      "Review Requested": 2,
      "Project Meeting Scheduled": 5,
      "Partials": 4,
      "Adjusters Meeting Scheduled": 3,
      "Coordinating": 3,
      "Invoiced": 3,
      "Discovery": 19,
      "Scheduled": 12,
      "(none)": 3,
      "Depreciation Being Released": 4,
      "Warranty Filed": 1,
      "Supplementing": 5,
      "Lead": 2,
      "Approved": 1,
      "Production": 1
    },
    "sources": {
      "(none)": 75,
      "Inbound": 24,
      "Zapier": 11,
      "Google Ads - LSA": 243,
      "Other": 27,
      "Truck Graphics": 4,
      "Website": 75,
      "Previous Customer": 14,
      "Word of Mouth": 7,
      "Company Set Inspection": 2,
      "Facebook": 11,
      "Training": 1,
      "Yard Signs": 1
    },
    "results": {
      "(unresulted)": 234,
      "Retail Sale": 28,
      "NO Damage": 22,
      "Repair Sold": 7,
      "CA Signed": 54,
      "Damage NO CA": 24,
      "Customer Canceled Appointment": 18,
      "Repair Not Sold": 41,
      "Retail Pitch Miss": 33,
      "Claim Filed": 14,
      "No Demo": 15,
      "Pitch Miss": 3,
      "No Answer/No Appointment Actually Set": 2
    },
    "recent": [
      {
        "rep": "Steven Arevalo,Steven Arevalo",
        "customer": "Kurt Burkhardt",
        "date": "2026-08-10 14:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Elaine Miletta",
        "date": "2026-08-10 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Sean Stevens",
        "date": "2026-08-07 19:30:00",
        "result": "Retail Sale",
        "bucket": "sold",
        "stage": "Closed",
        "source": "Zapier"
      },
      {
        "rep": "Marc Mitchell ,Marc Mitchell",
        "customer": "Armelle Franklin",
        "date": "2026-08-07 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo,Steven Arevalo",
        "customer": "Suneth De Alwis",
        "date": "2026-08-07 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo,Steven Arevalo",
        "customer": "Eleanor Pascale",
        "date": "2026-08-07 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel ,Andrew Prickel",
        "customer": "Josh Solomon",
        "date": "2026-08-07 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo,Steven Arevalo",
        "customer": "Shane Keenan",
        "date": "2026-08-07 13:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Jami Jhabvala",
        "date": "2026-08-06 19:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "John Pucciano",
        "date": "2026-08-06 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Matthew Curry",
        "date": "2026-08-05 17:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Gabriel Young",
        "date": "2026-08-04 20:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Min Kim",
        "date": "2026-08-04 13:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Josfina Dardas",
        "date": "2026-08-03 19:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Nick Seward",
        "customer": "David Rose",
        "date": "2026-07-31 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Kaushiki Sircar",
        "date": "2026-07-27 22:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Craig & Paula Fried",
        "date": "2026-07-27 14:00:00",
        "result": "Retail Sale",
        "bucket": "sold",
        "stage": "Scheduled",
        "source": "Google Ads - LSA"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Craig & Paula Fried",
        "date": "2026-07-27 14:00:00",
        "result": "Retail Sale",
        "bucket": "sold",
        "stage": "Scheduled",
        "source": "Google Ads - LSA"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Edmond Mjekiqi",
        "date": "2026-07-24 15:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Kevin Mahan",
        "customer": "Sheree Saunders",
        "date": "2026-07-23 21:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "Google Ads - LSA"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Mary Bass",
        "date": "2026-07-22 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Project Meeting Scheduled",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Syed Tanveer",
        "date": "2026-07-22 13:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Alfred Duncan",
        "customer": "Angelia Farmer",
        "date": "2026-07-21 20:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Scheduled",
        "source": "Google Ads - LSA"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "William Friedman",
        "date": "2026-07-21 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Alfred Duncan",
        "customer": "Anthony Archibald",
        "date": "2026-07-21 15:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Scheduled",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Andrew Gibbs",
        "date": "2026-07-21 15:00:00",
        "result": "Retail Sale",
        "bucket": "sold",
        "stage": "Scheduled",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Arthur Kirkpatrick",
        "date": "2026-07-20 15:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Bojan Mici",
        "date": "2026-07-20 13:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Susan Roosenraad",
        "date": "2026-07-18 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Lita Salgado",
        "date": "2026-07-17 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Review Requested",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Patrick McMahill",
        "date": "2026-07-17 14:10:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Isabelle Price",
        "customer": "Danielle Fenwick",
        "date": "2026-07-17 13:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Kevin Mahan",
        "customer": "Nancy Weathers",
        "date": "2026-07-17 13:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Adjusters Meeting Scheduled",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Deyon Marshall",
        "date": "2026-07-17 13:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Claims Filed",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Kevin Anderson",
        "date": "2026-07-16 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Nick Seward",
        "customer": "Laura Maxwell",
        "date": "2026-07-15 22:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Coordinating",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Rasool Ahmed",
        "date": "2026-07-15 18:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Mary Fuska",
        "date": "2026-07-15 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Simone Murray",
        "date": "2026-07-14 19:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Alfred Duncan",
        "customer": "Stephanie Johnson-Smith",
        "date": "2026-07-14 18:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Darrell Landreaux",
        "date": "2026-07-14 17:00:00",
        "result": "Claim Filed",
        "bucket": "pending",
        "stage": "Claims Filed",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Matt Julian",
        "date": "2026-07-14 16:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Claims Filed",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Gary Madonna",
        "date": "2026-07-14 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Savita Iyer",
        "date": "2026-07-11 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Anne Muth",
        "date": "2026-07-11 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "James Templeton",
        "date": "2026-07-10 17:00:00",
        "result": "No Demo",
        "bucket": "drip",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Nick Seward",
        "customer": "William Russell",
        "date": "2026-07-10 16:45:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Adam Mulvaney",
        "customer": "Hhh2 Tester2",
        "date": "2026-07-10 16:01:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "(none)",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Srinivas Somayajula",
        "date": "2026-07-10 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Partials",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Vishnu Agarwal",
        "date": "2026-07-10 16:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Ready for Project Meeting",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Greg Krajci",
        "date": "2026-07-10 13:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Afarin Homer",
        "date": "2026-07-09 20:00:00",
        "result": "Claim Filed",
        "bucket": "pending",
        "stage": "Claims Filed",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Ron Agles",
        "date": "2026-07-09 20:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Qing Lin",
        "date": "2026-07-09 17:00:00",
        "result": "Pitch Miss",
        "bucket": "drip",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Qing Lin",
        "date": "2026-07-09 17:00:00",
        "result": "Pitch Miss",
        "bucket": "drip",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Hany Wahba",
        "date": "2026-07-09 15:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Eric Barberan",
        "date": "2026-07-08 20:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Andrew Prickel",
        "customer": "Mike Golliker",
        "date": "2026-07-08 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Scheduled",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Reggie Menefee",
        "date": "2026-07-08 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Ready for Project Meeting",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Valerie Conley",
        "date": "2026-07-08 17:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Valerie Conley",
        "date": "2026-07-08 17:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Nouman Arif",
        "date": "2026-07-07 18:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Nouman Arif",
        "date": "2026-07-07 17:30:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Nouman Arif",
        "date": "2026-07-07 15:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Paul Martino",
        "date": "2026-07-07 14:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "Zapier"
      },
      {
        "rep": "Steven Arevalo",
        "customer": "Rafay Farugi",
        "date": "2026-07-06 22:00:00",
        "result": "",
        "bucket": "unresulted",
        "stage": "Inspection Set",
        "source": "(none)"
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
