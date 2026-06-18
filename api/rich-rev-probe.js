// api/rich-rev-probe.js — TEMP: explore JobProgress v3 jobs schema. Delete after.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  var key = (process.env.RICH_LEAP_API_KEY || "").trim();
  var red = function (s) { return String(s).replace(/[A-Za-z0-9_\-.@]{20,}/g, "<x>"); };
  async function g(url) {
    var r = await fetch(url, { headers: { Authorization: "Bearer " + key, Accept: "application/json" } });
    var t = await r.text(); var j; try { j = JSON.parse(t); } catch (e) { j = null; }
    return { status: r.status, j: j };
  }
  try {
    var out = {};
    var a = await g("https://api.jobprogress.com/api/v3/jobs?per_page=1");
    var job = (a.j && a.j.data && a.j.data[0]) || {};
    out.jobStatus = a.status;
    out.jobKeys = Object.keys(job);
    out.jobSample = JSON.parse(red(JSON.stringify(job)));
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: String(e) }); }
};
