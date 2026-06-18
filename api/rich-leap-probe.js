// api/rich-leap-probe.js — TEMP: probe the Richmond Leap API key. Safe to delete.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  var key = (process.env.RICH_LEAP_API_KEY || "").trim();
  var red = function (s) { return String(s).replace(/[A-Za-z0-9_\-.@]{20,}/g, "<x>").slice(0, 240); };
  async function tryGet(url, hdrs) {
    try {
      var r = await fetch(url, { headers: Object.assign({ Accept: "application/json" }, hdrs) });
      var t = await r.text();
      var keys = null; try { var j = JSON.parse(t); keys = j && typeof j === "object" ? Object.keys(j).slice(0, 12) : null; } catch (_) {}
      return { status: r.status, keys: keys, body: red(t) };
    } catch (e) { return { error: String(e).slice(0, 100) }; }
  }
  var out = { present: !!key, len: key.length };
  out.v3_jobs_bearer = await tryGet("https://api.jobprogress.com/api/v3/jobs?per_page=1", { Authorization: "Bearer " + key });
  out.v3_companies_bearer = await tryGet("https://api.jobprogress.com/api/v3/companies", { Authorization: "Bearer " + key });
  out.v1_me_bearer = await tryGet("https://jobprogress.com/api/public/api/v1/users/me", { Authorization: "Bearer " + key });
  out.v3_jobs_xtoken = await tryGet("https://api.jobprogress.com/api/v3/jobs?per_page=1", { "X-Api-Token": key });
  res.status(200).json(out);
};
