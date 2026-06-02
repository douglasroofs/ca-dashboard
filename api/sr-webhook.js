const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const CA_STATUSES = ['ICA','SGCA'];
const SKIP_STATUSES = ['DNK'];
const ADMIN_USERS = ['Kyle Higginbotham'];
const SR_USER_MAP = {
  "6": "Steven Arevalo",
  "7": "Marc Mitchell",
  "9": "Andrew Funk",
  "10": "Michael McCarthy",
  "11": "George Bechara",
  "12": "Isabelle Price",
  "13": "Jack Obert",
  "14": "Harvey Shoemaker",
  "15": "Kevin Mahan",
  "19": "Robert Wilson",
  "21": "Andrew Prickel",
  "34": "Alfred Duncan",
  "44": "Nick Seward",
  "62": "Christian Brown",
  "64": "Kelly Alston",
  "72": "David Kerns"
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const ghToken = process.env.GITHUB_TOKEN;
    const payload = req.body;
    
    // Extract from SR webhook payload format
    // { actionUserId, leadData: { status, street1, city, state, statusModified, ... }, leadId, type }
    const leadData = payload.leadData || {};
    const status = (leadData.status || '').toUpperCase();
    const userId = String(payload.actionUserId || leadData.userId || leadData.ownerId || '');
    const repName = SR_USER_MAP[userId] || '';
    const dateStr = (leadData.statusModified || leadData.dateModified || new Date().toISOString()).split('T')[0];
    const address = [leadData.street1, leadData.city, leadData.state].filter(Boolean).join(', ');
    const leadId = String(payload.leadId || leadData.leadId || '');

    if (!repName || !status || SKIP_STATUSES.includes(status)) {
      return res.status(200).json({ received: true, skipped: true, userId, status, note: repName ? 'skip status' : 'unknown user '+userId });
    }

    const isCA = CA_STATUSES.includes(status);
    const dataPath = 'data/sr-data.json';
    let srData = { updated: dateStr, events: [] };
    
    try {
      const chk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
        { headers: { 'Authorization': 'token ' + ghToken } });
      if (chk.ok) {
        const meta = await chk.json();
        const decoded = Buffer.from(meta.content.replace(/\n/g,''), 'base64').toString('utf8');
        srData = JSON.parse(decoded);
        if (!srData.events) srData.events = [];
      }
    } catch(e) {}

    srData.events.push({ leadId, repName, status, isCA, date: dateStr, address, ts: new Date().toISOString() });
    srData.updated = dateStr;
    srData.events = srData.events.filter(e => e.date && e.date.startsWith(new Date().getFullYear().toString()));

    const getChk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
      { headers: { 'Authorization': 'token ' + ghToken } });
    const existing = getChk.ok ? await getChk.json() : null;
    const content = Buffer.from(JSON.stringify(srData, null, 2)).toString('base64');
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath, {
      method: 'PUT', headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'SR: '+repName+' '+status+' '+dateStr, content, sha: existing?.sha })
    });

    return res.status(200).json({ received: true, repName, status, isCA, date: dateStr, total_events: srData.events.length });
  } catch (err) {
    return res.status(200).json({ received: true, error: err.message });
  }
};