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

// Fetch only leads modified at/after `since`, advancing a dateModified cursor.
async function leadsSince(since) {
  const out = [];
  const seen = new Set();
  let cursor = new Date(since.getTime());
  for (let guard = 0; guard < 40; guard++) {
    const r = await srGet('/leads', { 'If-Modified-Since': cursor.toUTCString() });
    const leads = arr(r.json);
    if (!leads.length) break;
    let maxMod = cursor.getTime();
    let added = 0;
    for (const ld of leads) {
      const id = pick(ld, ['id']);
      const m = new Date(pick(ld, ['dateModified']) || 0).getTime();
      if (!isNaN(m) && m > maxMod) maxMod = m;
      if (id != null && seen.has(id)) continue;
      if (id != null) seen.add(id);
      out.push(ld);
      added += 1;
    }
    if (added === 0 || maxMod <= cursor.getTime()) break;
    if (leads.length < 1000) break; // likely the last page
    cursor = new Date(maxMod + 1000);
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
