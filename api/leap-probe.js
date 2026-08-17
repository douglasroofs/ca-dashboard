// api/leap-probe.js - TEMPORARY diagnostic v3, delete after validation.
// v1: LEAP_ACCESS_TOKEN authorizes against Leap v3.
// v2: /jobs carries all three dates + structured reps; money is at
//     /jobs/{id}/financial_summary (total_job_price, payments, owed).
// v3: WHICH rep does Leap call the Customer Rep? A job returns several.
//     That choice is the whole $10.35M vs $6.49M gap.
// Employee names are shown (already public on /api/revenue). Customer PII is masked.
const V3 = 'https://api.jobprogress.com/api/v3';
const PII = /email|phone|address|street|zip|lat|lng|note|description/i;
function maskObj(o) { var out = {}; Object.keys(o).slice(0, 40).forEach(function (k) { out[k] = mask(k, o[k]); }); return out; }
function mask(k, v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.slice(0, 5).map(function (x) { return x && typeof x === 'object' ? maskObj(x) : x; });
  if (typeof v === 'object') return maskObj(v);
  if (typeof v !== 'string') return v;
  return PII.test(k) ? '<str ' + v.length + '>' : v.slice(0, 60);
}
function repLite(u) {
  if (!u) return null;
  return { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' '), company_id: u.company_id, active: u.active, group: u.group && u.group.name, role: u.role && u.role[0] && u.role[0].name };
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
    var out = { env: envName, page: q.get('page') || '20' };

    var page = await g(t, '/jobs?limit=100&includes[]=reps&includes[]=customer&page=' + out.page);
    var rows = (page.json && page.json.data) || [];
    var cands = rows.filter(function (r) { return r.contract_signed_date && r.reps && r.reps.data && r.reps.data.length; });
    out.counts = { rows: rows.length, signedWithReps: cands.length };

    // Show several jobs at once so a pattern is visible, not a single anecdote.
    out.jobs = cands.slice(0, 4).map(function (jb) {
      var cust = jb.customer && (jb.customer.data || jb.customer);
      var custRepish = {};
      if (cust) {
        Object.keys(cust).forEach(function (k) {
          if (/rep|canvass|sales|owner|assign|estimator/i.test(k)) custRepish[k] = mask(k, cust[k]);
        });
      }
      return {
        id: jb.id, number: jb.number, division_id: jb.division_id,
        contract_signed_date: jb.contract_signed_date, awarded_date: jb.awarded_date,
        reps: (jb.reps.data || []).map(repLite),
        customerId: cust && cust.id,
        customerRepFields: custRepish,
        customerKeys: cust ? Object.keys(cust) : null,
      };
    });

    // Pull one customer record on its own - the list include may be trimmed.
    var cid = out.jobs[0] && out.jobs[0].customerId;
    if (cid) {
      var c1 = await g(t, '/customers/' + cid + '?includes[]=rep&includes[]=reps&includes[]=sales_rep');
      var cb = c1.json && (c1.json.data || c1.json);
      out.customerDirect = { status: c1.status, keys: cb ? Object.keys(cb) : null, repFields: cb ? Object.keys(cb).filter(function (k) { return /rep|canvass|sales|owner|assign/i.test(k); }).reduce(function (a, k) { a[k] = mask(k, cb[k]); return a; }, {}) : null };
    }

    // And the money, for the same first job.
    var jid = out.jobs[0] && out.jobs[0].id;
    if (jid) {
      var fs = await g(t, '/jobs/' + jid + '/financial_summary');
      out.financialSummary = fs.json ? (fs.json.data || fs.json) : fs.raw;
    }
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: String((e && e.message) || e) }); }
};
