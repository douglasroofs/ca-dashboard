// api/doors.js — doors knocked per rep this month, from Sales Rabbit.
// A "door" = a lead/pin owned by a rep, created this month, whose status is NOT
// one of: Closed, Do Not Knock, Drive By.
//
// Auth: Authorization: Bearer ${SALESRABBIT_TOKEN}   Base: https://api.salesrabbit.com
//   ?debug=1  -> shapes of users / lead statuses / leads so we can lock field names

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE = ['closed', 'do not knock', 'drive by'];

function tok() {
  const t = process.env.SALESRABBIT_TOKEN;
  if (!t) throw new Error('SALESRABBIT_TOKEN not set in Vercel');
  return t;
}
async function srGet(path, headers) {
  const res = await fetch(`${BASE}${path}`, {
    headers: Object.assign({ Authorization: `Bearer ${tok()}`, Accept: 'application/json' }, headers || {}),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: res.status, json };
}
function arr(j) { return Array.isArray(j) ? j : (j && (j.data || j.results || j.records || j.items)) || []; }
function pick(o, keys) { for (const k of keys) { if (o && o[k] != null) return o[k]; } return undefined; }
function monthStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const debug = url.searchParams.get('debug');

    if (debug) {
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

    // --- build rep name map ---
    const usersRes = await srGet('/users');
    const userName = {};
    arr(usersRes.json).forEach((u) => {
      const id = pick(u, ['id', 'userId']);
      const name = pick(u, ['fullName']) || [pick(u, ['firstName', 'first']), pick(u, ['lastName', 'last'])].filter(Boolean).join(' ').trim() || pick(u, ['name', 'email']);
      if (id != null) userName[id] = name || ('User ' + id);
    });

    // --- excluded status ids (by name) ---
    let statusesRes = await srGet('/leadStatuses');
    if (statusesRes.status >= 400) statusesRes = await srGet('/lead-statuses');
    const excludedIds = new Set();
    const statusNameById = {};
    arr(statusesRes.json).forEach((s) => {
      statusNameById[s.id] = s.name;
      if (EXCLUDE.includes(String(s.name || '').trim().toLowerCase())) excludedIds.add(s.id);
    });

    // --- pull leads (paginate) and tally ---
    const start = monthStart();
    const counts = {};
    let total = 0;
    let page = 1;
    for (let guard = 0; guard < 60; guard++) {
      const r = await srGet(`/leads?page=${page}&perPage=200`);
      const leads = arr(r.json);
      if (!leads.length) break;
      for (const ld of leads) {
        const created = new Date(pick(ld, ['dateCreated', 'createdDate', 'created', 'dateAdded', 'date']) || 0);
        if (isNaN(created) || created < start) continue;
        const statusId = pick(ld, ['statusId', 'leadStatusId', 'status_id']);
        const statusName = (pick(ld, ['status', 'statusName']) || statusNameById[statusId] || '').toString().trim().toLowerCase();
        if (excludedIds.has(statusId) || EXCLUDE.includes(statusName)) continue;
        const owner = pick(ld, ['ownerId', 'userId', 'assignedUserId', 'repId']) ?? (ld.owner && ld.owner.id);
        const rep = userName[owner] || 'Unassigned';
        counts[rep] = (counts[rep] || 0) + 1;
        total += 1;
      }
      if (leads.length < 200) break;
      page += 1;
    }
    const reps = Object.keys(counts).map((rep) => ({ rep, doors: counts[rep] })).sort((a, b) => b.doors - a.doors);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ updated: new Date().toISOString(), total, reps });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
