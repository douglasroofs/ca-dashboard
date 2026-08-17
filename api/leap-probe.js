// api/leap-probe.js - TEMPORARY diagnostic v2, delete after validation.
// v1 proved: LEAP_ACCESS_TOKEN authorizes against Leap v3, and /jobs carries
// contract_signed_date, awarded_date, completion_date and division_id.
// v2 answers: where is the contract AMOUNT, and what does the rep relation look like?
// Never prints a token. Masks customer PII because /api/* is unauthenticated.
const V3 = 'https://api.jobprogress.com/api/v3';
const PII = /email|phone|address|street|zip|lat|lng|first_name|last_name|company_name|property_name|note|description/i;
function maskObj(o) { var out = {}; Object.keys(o).slice(0, 30).forEach(function (k) { out[k] = mask(k, o[k]); }); return out; }
function mask(k, v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.slice(0, 3).map(function (x) { return x && typeof x === 'object' ? maskObj(x) : x; });
  if (typeof v === 'object') return maskObj(v);
  if (typeof v !== 'string') return v;
  return PII.test(k) ? '<str ' + v.length + '>' : v.slice(0, 60);
}
function hdr(t) { return { Authorization: 'Bearer ' + t, Accept: 'application/json' }; }
async function g(t, p) {
  var r = await fetch(V3 + p, { headers: hdr(t) });
  var x = await r.text(); var j = null;
  try { j = JSON.parse(x); } catch (_) {}
  return { status: r.status, ok: r.ok, json: j, raw: j ? null : x.slice(0, 200) };
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    var q = new URL(req.url, 'http://x').searchParams;
    var envName = q.get('env') || 'LEAP_ACCESS_TOKEN';
    var t = process.env[envName];
    if (!t) { res.status(200).json({ error: 'env ' + envName + ' not set' }); return; }
    var out = { env: envName };

    var page = await g(t, '/jobs?limit=100&includes[]=reps&includes[]=division&page=' + (q.get('page') || '1'));
    var rows = (page.json && page.json.data) || [];
    var pg = page.json && page.json.meta && page.json.meta.pagination;
    out.listStatus = page.status;
    out.totalJobs = pg && pg.total;
    var withRep = rows.filter(function (r) { var d = r.reps && r.reps.data; return d && d.length; });
    var signed = rows.filter(function (r) { return r.contract_signed_date; });
    out.counts = { rows: rows.length, withReps: withRep.length, withSignedDate: signed.length };

    var pick = withRep[0] || signed[0] || rows[0] || null;
    if (pick) {
      out.pickedJob = {
        id: pick.id, number: pick.number, division_id: pick.division_id,
        contract_signed_date: pick.contract_signed_date, awarded_date: pick.awarded_date,
        completion_date: pick.completion_date, current_stage: mask('current_stage', pick.current_stage),
        reps: mask('reps', pick.reps), division: mask('division', pick.division),
      };
      var fs = await g(t, '/jobs/' + pick.id + '/financial_summary');
      var fsBody = fs.json ? (fs.json.data || fs.json) : null;
      out.financialSummary = { status: fs.status, keys: fsBody ? Object.keys(fsBody) : null, body: fsBody ? mask('fs', fsBody) : fs.raw };
    }

    var tries = ['financial_summary', 'financials', 'amount', 'worksheet', 'estimates'];
    out.includeTests = [];
    for (var i = 0; i < tries.length; i++) {
      var r2 = await g(t, '/jobs?limit=1&includes[]=' + tries[i]);
      var row = (r2.json && r2.json.data && r2.json.data[0]) || null;
      out.includeTests.push({ include: tries[i], status: r2.status, present: row ? Object.keys(row).indexOf(tries[i]) > -1 : null });
    }
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: String((e && e.message) || e) }); }
};
