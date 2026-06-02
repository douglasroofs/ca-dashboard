const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const CA_STATUSES = ['ICA','SGCA'];
const SKIP_STATUSES = ['DNK'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const ghToken = process.env.GITHUB_TOKEN;
    const payload = req.body;
    
    // Store the RAW payload so we can see what SR sends
    const dataPath = 'data/sr-data.json';
    let srData = { updated: new Date().toISOString().split('T')[0], events: [], raw_payloads: [] };
    try {
      const chk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
        { headers: { 'Authorization': 'token ' + ghToken } });
      if (chk.ok) {
        const meta = await chk.json();
        const decoded = Buffer.from(meta.content.replace(/\n/g,''), 'base64').toString('utf8');
        srData = JSON.parse(decoded);
        if (!srData.raw_payloads) srData.raw_payloads = [];
      }
    } catch(e) {}

    // Always log the raw payload (keep last 10)
    srData.raw_payloads.push({ ts: new Date().toISOString(), payload });
    if (srData.raw_payloads.length > 10) srData.raw_payloads = srData.raw_payloads.slice(-10);

    // Try all possible field paths to extract rep and status
    const flatten = (obj, prefix='') => {
      if (!obj || typeof obj !== 'object') return {};
      return Object.entries(obj).reduce((acc, [k,v]) => {
        const key = prefix ? prefix+'.'+k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flatten(v, key));
        else acc[key] = v;
        return acc;
      }, {});
    };
    const flat = flatten(payload);
    
    // Find rep name - look for any field containing a name
    const repFields = ['repName','rep_name','userName','user_name','assigned_to','assignedTo',
      'lead.repName','lead.userName','user.name','rep.name','sales_rep','salesRep'];
    let repName = repFields.map(f => flat[f]).find(v => v && typeof v === 'string') || '';
    
    // Find status
    const statusFields = ['status','statusAbbreviation','status_abbreviation','lead.status',
      'lead.statusAbbreviation','abbreviation','statusName','status_name'];
    let status = statusFields.map(f => flat[f]).find(v => v && typeof v === 'string') || '';

    const dateStr = new Date().toISOString().split('T')[0];
    const isCA = CA_STATUSES.includes(status.toUpperCase());

    if (repName && status && !SKIP_STATUSES.includes(status.toUpperCase())) {
      srData.events.push({ leadId: flat['id']||flat['lead.id']||'', repName, status, isCA, date: dateStr,
        address: flat['address']||flat['lead.address']||flat['streetAddress']||'', eventType: flat['event']||flat['eventType']||'', ts: new Date().toISOString() });
      srData.updated = dateStr;
      // Keep only current year events
      srData.events = srData.events.filter(e => e.date && e.date.startsWith(new Date().getFullYear().toString()));
    }

    // Push to GitHub
    const getChk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
      { headers: { 'Authorization': 'token ' + ghToken } });
    const existing = getChk.ok ? await getChk.json() : null;
    const content = Buffer.from(JSON.stringify(srData, null, 2)).toString('base64');
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath, {
      method: 'PUT', headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'SR webhook event '+dateStr, content, sha: existing?.sha })
    });

    return res.status(200).json({ received: true, repName, status, isCA, events: srData.events.length, raw_logged: true });
  } catch (err) {
    return res.status(200).json({ received: true, error: err.message });
  }
};