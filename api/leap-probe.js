// api/leap-probe.js - TEMPORARY diagnostic, delete after validation.
// Does the documented Leap v3 API return job-level rows with rep, division,
// amount and dates? If yes, we stop pulling pre-aggregated reports (and stop
// logging in as support@ on every request, which steals the human session).
// Never prints a token. Masks customer PII because /api/* is unauthenticated.
const V3 = 'https://api.jobprogress.com/api/v3';
const CANDS = ['LEAP_API_TOKEN', 'LEAP_ACCESS_TOKEN', 'RICH_LEAP_API_KEY', 'herndon', 'Richmond', 'JP_API_TOKEN'];
const PII = /email|phone|address|street|zip|lat|lng|name/i;
function mask(k, v) {
  if (v == null) return null;
  if (Array.isArray(v)) return { arr: v.length, keys: v[0] && typeof v[0] === 'object' ? Object.keys(v[0]).slice(0, 20) : typeof v[0] };
  if (typeof v === 'object') { var o = {}; Object.keys(v).slice(0, 25).forEach(function (a) { o[a] = mask(a, v[a]); }); return o; }
  if (typeof v !== 'string') return v;
  return PII.test(k) ? '<str ' + v.length + '>' : v.slice(0, 60);
}
function hdr(t) { return { Authorization: 'Bearer ' + t, Accept: 'application/json' }; }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    var shape = new URL(req.url, 'http://x').searchParams.get('shape') === '1';
    var auth = [], tok = null, env = null;
    for (var i = 0; i < CANDS.length; i++) {
      var n = CANDS[i], t = process.env[n];
      if (!t) { auth.push({ env: n, present: false }); continue; }
      try {
        var r0 = await fetch(V3 + '/jobs?limit=1', { headers: hdr(t) });
        auth.push({ env: n, present: true, status: r0.status, ok: r0.ok });
        if (r0.ok && !tok) { tok = t; env = n; }
      } catch (e) { auth.push({ env: n, present: true, err: String(e.message).slice(0, 80) }); }
    }
    if (!tok || !shape) {
      res.status(200).json({ base: V3, auth: auth, workingEnvVar: env, next: tok ? 'call /api/leap-probe?shape=1' : 'Leap Settings -> Developer, add token to Vercel as LEAP_API_TOKEN' });
      return;
    }
    var r = await fetch(V3 + '/jobs?limit=3&includes[]=customer&includes[]=division&includes[]=reps', { headers: hdr(tok) });
    var j = await r.json().catch(function () { return null; });
    var rows = (j && (j.data || j.jobs)) || [];
    var row = rows[0] || null;
    var keys = row ? Object.keys(row) : [];
    var sample = null;
    if (row) { sample = {}; keys.forEach(function (k) { sample[k] = mask(k, row[k]); }); }
    res.status(200).json({
      workingEnvVar: env, status: r.status, rowCount: rows.length,
      meta: (j && (j.meta || j.pagination)) || null,
      fieldNames: keys,
      need: {
        rep: keys.filter(function (k) { return /rep|sales|estimator/i.test(k); }),
        division: keys.filter(function (k) { return /division|office|branch/i.test(k); }),
        amount: keys.filter(function (k) { return /amount|total|price/i.test(k); }),
        date: keys.filter(function (k) { return /date/i.test(k); }),
      },
      sample: sample,
    });
  } catch (e) { res.status(200).json({ error: String((e && e.message) || e) }); }
};
