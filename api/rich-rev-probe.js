// api/rich-rev-probe.js — TEMP: explore JobProgress v3 amounts. Delete after.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  var key = (process.env.RICH_LEAP_API_KEY || "").trim();
  var red = function (s) { return String(s).replace(/[A-Za-z0-9_\-.@]{20,}/g, "<x>"); };
  async function g(url) {
    var r = await fetch(url, { headers: { Authorization: "Bearer " + key, Accept: "application/json" } });
    var t = await r.text(); var j; try { j = JSON.parse(t); } catch (e) { j = null; }
    return { status: r.status, j: j, raw: j ? null : String(t).slice(0,120) };
  }
  try {
    var out = {};
    // base list, look for a job that is awarded/signed (has amounts)
    var a = await g("https://api.jobprogress.com/api/v3/jobs?per_page=1&includes[]=estimates&includes[]=proposals&includes[]=financial&includes[]=reps");
    var job = (a.j && a.j.data && a.j.data[0]) || {};
    out.incStatus = a.status;
    out.incKeys = Object.keys(job);
    out.incSample = job ? JSON.parse(red(JSON.stringify(job))) : null;
    // try common revenue endpoints
    var paths = [
      "https://api.jobprogress.com/api/v3/proposals?per_page=1",
      "https://api.jobprogress.com/api/v3/estimates?per_page=1",
      "https://api.jobprogress.com/api/v3/reports/sales-performance",
      "https://api.jobprogress.com/api/v3/financials?per_page=1"
    ];
    out.endpoints = {};
    for (var i=0;i<paths.length;i++){ var rr=await g(paths[i]); var d=(rr.j&&(rr.j.data||rr.j))||{}; var s=Array.isArray(d)?d[0]:d; out.endpoints[paths[i].split("/v3/")[1]]={status:rr.status, keys:(s&&typeof s==="object")?Object.keys(s).slice(0,20):null}; }
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: String(e) }); }
};
