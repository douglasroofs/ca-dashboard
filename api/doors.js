// api/doors.js — doors knocked per rep this month, from Sales Rabbit.
// Production: scoped to DC Inbound + DC Self Gen teams. A "door" = a pin owned by
// an allowed rep, status NOT in {Closed, Do Not Knock, Drive By}, dispositioned
// (statusModified) this month. Deduped by pin id.
//
// Efficiency: only leads modified since the 1st of the month are fetched, via the
// If-Modified-Since header (incremental cursor on dateModified).
//
// ?debug=1      -> shapes of users / statuses / leads
// ?debug=tally  -> attribution diagnostics for this month (names + counts only)

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE_NORM = new Set(['closed', 'donotknock', 'driveby']);
const SR_ALIAS = {
  'mike mccarthy': 'michael mccarthy',
  'izzy price': 'isabelle price',
  'robert mumford-wilson': 'robert wilson',
};

function tok() {
  const t = process.env.SALESRABBIT_TOKEN;
  if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel');
  return t;
}
async function srGet(path, headers) {
  const res = await fetch(`${BASE}${path}`, {
    headers: Object.assign(
      { Authorization: `Bearer ${tok()}`, Accept: 'application/json' },
      headers || {}
    ),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: res.status, json };
}
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function monthStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function statusNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function repKey(name) { const n = norm(name); return SR_ALIAS[n] || n; }
function teamAllowed(t) {
  const n = norm(t);
  return n.indexOf('inbound') > -1 || (n.indexOf('self') > -1 && n.indexOf('gen') > -1);
}

// Fetch every lead whose STATUS was modified at/after `since`.
// SalesRabbit caps /leads at 2000 rows, so we page by advancing the
// If-Status-Modified-Since cursor to the newest statusModified each page
// (default sort is ascending). Dedup by id handles boundary repeats.
const CAP = 2000;
async function leadsSince(since) {
  const out = [];
  const seen = new Set();
  let cursorMs = since.getTime();
  for (let guard = 0; guard < 80; guard++) {
    const r = await srGet('/leads', { 'If-Status-Modified-Since': new Date(cursorMs).toISOString() });
    const leads = arr(r.json);
    if (!leads.length) break;
    let maxMs = cursorMs;
    for (const ld of leads) {
      const id = pick(ld, ['id']);
      const sm = new Date(pick(ld, ['statusModified']) || 0).getTime();
      if (!isNaN(sm) && sm > maxMs) maxMs = sm;
      if (id != null && seen.has(id)) continue;
      if (id != null) seen.add(id);
      out.push(ld);
    }
    if (leads.length < CAP) break;      // last page
    if (maxMs <= cursorMs) break;       // can't advance (all same ts) — stop
    cursorMs = maxMs;                   // include boundary; dedup handles repeats
  }
  return out;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const debug = url.searchParams.get('debug');

    if (debug === '1') {
      const users = await srGet('/users');
      let statuses = await srGet('/leadStatuses');
      if (statuses.status >= 400) statuses = await srGet('/lead-statuses');
      const leads = await srGet('/leads');
      const u0 = arr(users.json)[0] || {};
      const l0 = arr(leads.json)[0] || {};
      const redact = (o) => JSON.parse(JSON.stringify(o).replace(/[A-Za-z0-9_\-.@]{24,}/g, '<x>'));
      res.status(200).json({
        users: { status: users.status, count: arr(users.json).length, sampleKeys: Object.keys(u0) },
        statuses: { status: statuses.status, list: arr(statuses.json).map((s) => ({ id: s.id, name: s.name })).slice(0, 50) },
        leads: { status: leads.status, count: arr(leads.json).length, sampleKeys: Object.keys(l0), sample: redact(l0) },
      });
      return;
    }

    if (debug === 'v1') {
      // Probe the newer JSON:API at integrate.salesrabbit.com/v1
      const startIso = monthStart().toISOString();
      const PLUS = (process.env.SALESRABBIT_PLUS_TOKEN || '').trim();
      const redactStr = (s) => String(s).replace(/[A-Za-z0-9_\-.@]{24,}/g, '<x>');
      async function tryAuth(hdrs) {
        const res = await fetch('https://integrate.salesrabbit.com/v1/leads?page[limit]=1', {
          headers: Object.assign({ Accept: 'application/vnd.api+json' }, hdrs),
        });
        const text = await res.text();
        return { status: res.status, body: redactStr(text).slice(0, 300) };
      }
      const variants = {
        bearer: await tryAuth({ Authorization: `Bearer ${PLUS}` }),
        rawAuth: await tryAuth({ Authorization: PLUS }),
        xApiKey: await tryAuth({ 'X-Api-Key': PLUS }),
        apiKey: await tryAuth({ 'Api-Key': PLUS }),
      };
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        monthStart: startIso,
        plusTokenPresent: !!PLUS,
        plusTokenLen: PLUS.length,
        variants,
      });
      return;
    }

    if (debug === 'probe') {
      // find a recent lead id to test per-lead endpoints
      const recent = await srGet('/leads', { 'If-Modified-Since': monthStart().toUTCString() });
      const lid = (arr(recent.json)[0] || {}).id;
      const candidates = [
        `/leads/${lid}`,
        `/leads/${lid}/history`,
        `/leads/${lid}/activities`,
        `/leads/${lid}/activity`,
        '/activities',
        '/leadActivities',
        '/lead-activities',
        '/history',
        '/knocks',
        '/leadHistory',
        '/v2/leads?perPage=1',
        '/areas',
      ];
      const out = [];
      for (const p of candidates) {
        try {
          const r = await srGet(p);
          const a = arr(r.json);
          const s0 = a[0] || (r.json && typeof r.json === 'object' ? r.json : {});
          out.push({ ep: p, status: r.status, isArray: Array.isArray(r.json) || !!(r.json && r.json.data), count: a.length, keys: Object.keys(s0 || {}).slice(0, 25) });
        } catch (e) {
          out.push({ ep: p, error: String(e && e.message ? e.message : e) });
        }
      }
      // Full field dump of one lead (detail view) + list item, redacted.
      const redact = (o) => JSON.parse(JSON.stringify(o).replace(/[A-Za-z0-9_\-.@]{24,}/g, '<x>'));
      const detail = await srGet(`/leads/${lid}`);
      const detailObj = (detail.json && detail.json.data) || detail.json || {};
      const listItem = arr(recent.json)[0] || {};
      // try the leads list WITH a few extra query params that might add the updater
      const withParams = await srGet(`/leads?perPage=1&include=user,status,history,owner`);
      const wp0 = arr(withParams.json)[0] || {};
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        testLeadId: lid,
        results: out,
        detailKeys: Object.keys(detailObj),
        detailSample: redact(detailObj),
        listItemKeys: Object.keys(listItem),
        withIncludeKeys: Object.keys(wp0),
      });
      return;
    }

    // ---- users + teams ----
    const usersRes = await srGet('/users');
    const allUsers = arr(usersRes.json).map((u) => ({
      name: pick(u, ['fullName']) ||
        [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() ||
        pick(u, ['name', 'email']) || '',
      team: pick(u, ['team']) || '',
      active: pick(u, ['active']),
    }));
    const allowedUsers = allUsers.filter((u) => teamAllowed(u.team) && u.active !== false);
    const allowedReps = new Set(allowedUsers.map((u) => repKey(u.name)));
    const roster = allowedUsers.map((u) => u.name);

    const start = monthStart();
    const leads = await leadsSince(start);

    if (debug === 'tally') {
      const teamCounts = {};
      allUsers.forEach((u) => { const k = u.team || '(blank)'; teamCounts[k] = (teamCounts[k] || 0) + 1; });
      const findUsers = allUsers
        .filter((u) => /david|christian|aiden|kerns|brown/i.test(u.name))
        .map((u) => ({ name: u.name, team: u.team, allowed: allowedReps.has(repKey(u.name)) }));

      const monthAllByName = {};
      const monthKnockByName = {};
      const createdByName = {};
      leads.forEach((ld) => {
        const owner = norm(pick(ld, ['userName']) || '');
        const sm = new Date(pick(ld, ['statusModified']) || 0);
        const dc = new Date(pick(ld, ['dateCreated']) || 0);
        const st = statusNorm(pick(ld, ['status']));
        if (!isNaN(dc) && dc >= start && owner) createdByName[owner] = (createdByName[owner] || 0) + 1;
        if (!isNaN(sm) && sm >= start && owner) {
          monthAllByName[owner] = (monthAllByName[owner] || 0) + 1;
          if (!EXCLUDE_NORM.has(st)) monthKnockByName[owner] = (monthKnockByName[owner] || 0) + 1;
        }
      });
      const top = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 40).map((k) => k + ': ' + o[k]);
      const forNames = (o) => Object.keys(o).filter((k) => /david|christian|aiden|kerns|brown/.test(k)).map((k) => k + ': ' + o[k]);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        leadsScannedSinceMonthStart: leads.length,
        monthStart: start.toISOString(),
        teamCounts,
        matchedUsers: findUsers,
        davidChristianAiden: {
          monthStatusModified_anyStatus: forNames(monthAllByName),
          monthStatusModified_knockable: forNames(monthKnockByName),
          createdThisMonth: forNames(createdByName),
        },
        topMonthKnockable: top(monthKnockByName),
      });
      return;
    }

    // ---- production tally ----
    const counts = {};
    const seen = new Set();
    let total = 0;
    leads.forEach((ld) => {
      const rk = repKey(pick(ld, ['userName']) || '');
      if (!allowedReps.has(rk)) return;
      const sm = new Date(pick(ld, ['statusModified']) || 0);
      if (isNaN(sm) || sm < start) return;
      const st = statusNorm(pick(ld, ['status']));
      if (EXCLUDE_NORM.has(st)) return;
      const id = pick(ld, ['id']);
      if (id != null) { if (seen.has(id)) return; seen.add(id); }
      counts[rk] = (counts[rk] || 0) + 1;
      total += 1;
    });
    const display = {};
    allowedUsers.forEach((u) => { display[repKey(u.name)] = u.name; });
    const reps = Object.keys(counts)
      .map((k) => ({ rep: display[k] || k, doors: counts[k] }))
      .sort((a, b) => b.doors - a.doors);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      updated: new Date().toISOString(),
      total,
      reps,
      allowedReps: Array.from(allowedReps),
      roster,
    });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
