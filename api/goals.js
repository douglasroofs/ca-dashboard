// api/goals.js — Owners' goals (annual / quarterly / monthly), shown on goals.html.
//
// PRIVATE: this repo is public, so goals are never stored in plain text. data/goals.enc.json holds them
// AES-256-GCM encrypted with a key derived from GOALS_KEY (or, if unset, GOALS_PASSWORD) — both Vercel env
// vars only. Changing GOALS_PASSWORD without a GOALS_KEY makes the existing file unreadable, so set
// GOALS_KEY first (any long random string) if the password will ever change.
//
// Access: every call needs the Goals password (GOALS_PASSWORD) in the x-goals-password header — separate
// from the dashboard's DASH_PASSWORD. If GOALS_PASSWORD is not set, the endpoint refuses everything.
// Storage: read/written live through the GitHub contents API with GITHUB_TOKEN (Contents read/write on
// douglasroofs/ca-dashboard). Every save is a commit (the commit message never contains goal text).
//
//   GET  /api/goals?probe=1   -> { password: bool, token: bool, read: bool, write: bool }  (no secrets, no goals)
//   GET  /api/goals           -> { goals: [...], updated }
//   POST /api/goals  { action: 'upsert', goal: {...} } | { action: 'delete', id }
//
// Goal: { id, period: 'annual'|'quarterly'|'monthly', year, quarter, month, kind: 'metric'|'task', metric, title,
//   department, owner: 'Kyle'|'Mike'|'Adam'|'', target, status, due, notes, created, updated }
// kind 'metric' = a number goal tracked live from the dashboard; metric is one of METRICS below.
// (Goals saved as kind 'revenue' before 2026-11-10 21:00 are read as metric 'contract'.)
const crypto = require('crypto');
const REPO = 'douglasroofs/ca-dashboard';
const PATH = 'data/goals.enc.json';
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
const OWNERS = ['Kyle', 'Mike', 'Adam', ''];
const STATUSES = ['Not started', 'In progress', 'Done', 'Off track'];
const METRICS = ['contract', 'approved', 'cas', 'mkt_cas', 'mkt_set', 'mkt_ran'];
const gh = () => ({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ca-dashboard-goals' });

function secret() { return process.env.GOALS_KEY || process.env.GOALS_PASSWORD || ''; }
function encrypt(obj) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret(), salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, alg: 'aes-256-gcm+scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(env) {
  const key = crypto.scryptSync(secret(), Buffer.from(env.salt, 'base64'), 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  d.setAuthTag(Buffer.from(env.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8'));
}
async function readStore() {
  const r = await fetch(`${API}?ref=main`, { headers: gh() });
  if (r.status === 404) return { doc: { updated: null, goals: [] }, sha: undefined }; // nothing saved yet
  if (!r.ok) throw new Error(`GitHub read -> ${r.status}`);
  const meta = await r.json();
  const env = JSON.parse(Buffer.from(String(meta.content || '').replace(/\n/g, ''), 'base64').toString('utf8'));
  let doc;
  try { doc = decrypt(env); } catch (e) { throw new Error('Saved goals could not be decrypted - was GOALS_PASSWORD changed? (set GOALS_KEY back to the old value)'); }
  return { doc, sha: meta.sha };
}
async function writeStore(doc, sha, message) {
  const body = { message, branch: 'main', content: Buffer.from(JSON.stringify(encrypt(doc)) + '\n').toString('base64') };
  if (sha) body.sha = sha;
  const r = await fetch(API, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, gh()), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) { const e = new Error('conflict'); e.conflict = true; throw e; }
  if (!r.ok) throw new Error(`GitHub write -> ${r.status}`);
}
function passOk(req) {
  const expected = process.env.GOALS_PASSWORD || '';
  const got = String((req.headers && req.headers['x-goals-password']) || '');
  if (!expected || !got) return false;
  const a = crypto.createHash('sha256').update(expected).digest(), b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}
const iso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '';
const int = (v, lo, hi) => { const n = parseInt(v, 10); return n >= lo && n <= hi ? n : null; };
function clean(g, prev) {
  const now = new Date().toISOString();
  const period = ['annual', 'quarterly', 'monthly'].includes(g.period) ? g.period : 'annual';
  const kind = (g.kind === 'metric' || g.kind === 'revenue') ? 'metric' : 'task';
  const metric = kind === 'metric' ? (METRICS.includes(g.metric) ? g.metric : 'contract') : null;
  const out = {
    id: String((prev && prev.id) || g.id || ('g' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'))),
    period,
    year: int(g.year, 2020, 2100) || new Date().getFullYear(),
    quarter: period === 'quarterly' ? (int(g.quarter, 1, 4) || 1) : null,
    month: period === 'monthly' ? (int(g.month, 1, 12) || 1) : null,
    kind,
    metric,
    title: String(g.title || '').trim().slice(0, 300) || (kind === 'metric' ? 'Company' : ''),
    department: String(g.department || '').trim().slice(0, 60),
    owner: OWNERS.includes(g.owner) ? g.owner : '',
    target: kind === 'metric' ? Math.max(0, Number(g.target) || 0) : null,
    status: STATUSES.includes(g.status) ? g.status : 'Not started',
    due: iso(g.due),
    notes: String(g.notes || '').trim().slice(0, 1000),
    created: (prev && prev.created) || now,
    updated: now,
  };
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, private');
  const url = new URL(req.url, 'http://x');
  const hasToken = !!process.env.GITHUB_TOKEN, hasPass = !!process.env.GOALS_PASSWORD;
  try {
    if (req.method === 'GET' && url.searchParams.get('probe') === '1') {
      const out = { password: hasPass, token: hasToken, read: false, write: false };
      if (hasToken) {
        try { const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: gh() }); const j = await r.json(); out.read = r.ok; out.write = !!(j.permissions && j.permissions.push); } catch (e) {}
      }
      return res.status(200).json(out);
    }
    if (!hasPass) return res.status(503).json({ error: 'The Goals page is not set up yet: GOALS_PASSWORD is not set in Vercel.' });
    if (!passOk(req)) return res.status(401).json({ error: 'Wrong Goals password' });
    if (!hasToken) return res.status(503).json({ error: 'Goals storage is not connected: GITHUB_TOKEN is missing in Vercel.' });

    if (req.method === 'GET') {
      const { doc } = await readStore();
      return res.status(200).json({ updated: doc.updated || null, goals: doc.goals || [] });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { doc, sha } = await readStore();
      const goals = Array.isArray(doc.goals) ? doc.goals : [];
      if (body.action === 'delete') {
        const i = goals.findIndex((g) => g.id === body.id);
        if (i < 0) return res.status(404).json({ error: 'Goal not found' });
        goals.splice(i, 1);
      } else {
        const g = body.goal || {};
        const i = g.id ? goals.findIndex((x) => x.id === g.id) : -1;
        const next = clean(g, i >= 0 ? goals[i] : null);
        if (!next.title) return res.status(400).json({ error: 'A goal needs a title' });
        if (next.kind === 'task' && !next.department) return res.status(400).json({ error: 'Department goals need a department' });
        if (i >= 0) goals[i] = next; else goals.push(next);
      }
      const out = { updated: new Date().toISOString(), goals };
      try { await writeStore(out, sha, `Goals updated from the dashboard (${body.action === 'delete' ? 'delete' : 'save'})`); return res.status(200).json(out); }
      catch (e) { if (!e.conflict || attempt === 3) throw e; }
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
