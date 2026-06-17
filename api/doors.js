// api/doors.js — doors knocked per rep this month, from Sales Rabbit.
// A "door" = a lead/pin owned by a rep, created this month, whose status is NOT
// one of: Closed, Do Not Knock, Drive By.
//
// Auth: Authorization: Bearer ${SALESRABBIT_TOKEN}   Base: https://api.salesrabbit.com
//   ?debug=1  -> shapes of users / lead statuses / leads so we can lock field names

const BASE = 'https://api.salesrabbit.com';
const EXCLUDE_NORM = new Set(['closed', 'donotknock', 'driveby']);
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
const ALLOWED_TEAMS = new Set(['dc inbound', 'dc self gen']);
const SR_ALIAS = { 'mike mccarthy': 'michael mccarthy', 'izzy price': 'isabelle price', 'robert mumford-wilson': 'robert wilson' };
function repKey(name) { var n = String(name == null ? '' : name).trim().toLowerCase().replace(/\s+/g, ' '); return SR_ALIAS[n] || n; }
function teamNorm(t) { return String(t == null ? '' : t).trim().toLowerCase(); }

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

    if (debug === 'teams') {
      const users = await srGet('/users');
      const teamMap = {};
      arr(users.json).forEach((u) => {
        const t = u.team || u.department || u.region || '(none)';
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        (teamMap[t] = teamMap[t] || []).push({ name, id: u.id, active: u.active });
      });
      res.status(200).json({ teamFields: { teamSeen: !!arr(users.json)[0] && 'team' in arr(users.json)[0] }, teams: Object.keys(teamMap).map((t) => ({ team: t, count: teamMap[t].length, members: teamMap[t] })) });
      return;
    }

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

    // --- allowed roster: only DC Inbound + DC Self Gen teams ---
    const usersRes = await srGet('/users');
    const allowedUserIds = new Set();
    const allowedReps = new Set();
    const roster = [];
    arr(usersRes.json).forEach((u) => {
      if (ALLOWED_TEAMS.has(teamNorm(u.team)) && u.active !== false) {
        if (u.id != null) allowedUserIds.add(u.id);
        const nm = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        if (nm) { allowedReps.add(repKey(nm)); roster.push(nm); }
      }
    });

    // --- pull this month's knocked pins (Sales Rabbit incremental by If-Modified-Since) ---
    const start = monthStart();
    const counts = {};
    const seen = new Set();
    let total = 0;
    let since = new Date(start);
    for (let guard = 0; guard < 30; guard++) {
      const r = await srGet('/leads', { 'If-Modified-Since': since.toUTCString() });
      const leads = arr(r.json);
      if (!leads.length) break;
      let maxMod = since.getTime();
      for (const ld of leads) {
        const mod = new Date(ld.dateModified || 0).getTime();
        if (mod > maxMod) maxMod = mod;
        if (seen.has(ld.id)) continue;
        seen.add(ld.id);
        if (!allowedReps.has(repKey(ld.userName))) continue;
        const knocked = new Date(ld.statusModified || ld.dateCreated || 0);
        if (isNaN(knocked) || knocked < start) continue; // dispositioned/knocked this month
        if (EXCLUDE_NORM.has(norm(ld.status))) continue; // skip Closed / Do Not Knock / Drive-By
        const rep = ld.userName || ('User ' + ld.userId);
        counts[rep] = (counts[rep] || 0) + 1;
        total += 1;
      }
      if (leads.length < 2000 || maxMod <= since.getTime()) break;
      since = new Date(maxMod);
    }
    const reps = Object.keys(counts).map((rep) => ({ rep, doors: counts[rep] })).sort((a, b) => b.doors - a.doors);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ updated: new Date().toISOString(), total, reps, allowedReps: [...allowedReps], roster });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
