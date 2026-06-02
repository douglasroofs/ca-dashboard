const GITHUB_REPO = 'douglasroofs/ca-dashboard';
// Statuses that count as a CA signed in Sales Rabbit
const CA_STATUSES = ['ICA','SGCA','ica','sgca'];
// Statuses that do NOT count as a door knock (unvisited, system statuses)
const SKIP_STATUSES = ['DNK','dnk'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ghToken = process.env.GITHUB_TOKEN;
    if (!ghToken) return res.status(500).json({ error: 'Missing GITHUB_TOKEN' });

    const payload = req.body;
    // SR webhook payload varies by event type - extract what we need
    const lead = payload.lead || payload.data || payload;
    const status = lead.status || lead.leadStatus || lead.statusAbbreviation || lead.abbreviation || '';
    const repName = lead.repName || lead.userName || lead.assignedTo || 
                    ((lead.firstName||'') + ' ' + (lead.lastName||'')).trim() ||
                    lead.user?.name || '';
    const eventType = payload.event || payload.eventType || payload.type || 'unknown';
    const timestamp = lead.updatedAt || lead.createdAt || lead.statusUpdatedAt || new Date().toISOString();
    const leadId = lead.id || lead.leadId || '';
    const address = lead.address || lead.streetAddress || '';

    if (!repName || !status) {
      return res.status(200).json({ received: true, skipped: 'missing rep or status', payload_keys: Object.keys(payload) });
    }

    if (SKIP_STATUSES.includes(status.toUpperCase())) {
      return res.status(200).json({ received: true, skipped: 'DNK status' });
    }

    const isCA = CA_STATUSES.includes(status.toUpperCase());
    const dateStr = timestamp.split('T')[0];

    // Load current SR data file from GitHub
    const dataPath = 'data/sr-data.json';
    let srData = { updated: dateStr, events: [] };
    try {
      const chk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
        { headers: { 'Authorization': 'token ' + ghToken } });
      if (chk.ok) {
        const meta = await chk.json();
        const decoded = Buffer.from(meta.content.replace(/\n/g,''), 'base64').toString('utf8');
        srData = JSON.parse(decoded);
      }
    } catch(e) { /* file doesn't exist yet, start fresh */ }

    // Add the new event
    srData.events.push({
      leadId, repName, status, isCA, date: dateStr,
      address, eventType, ts: timestamp
    });
    srData.updated = dateStr;

    // Keep only current year events
    const yr = new Date().getFullYear();
    srData.events = srData.events.filter(e => e.date && e.date.startsWith(yr.toString()));

    // Push back to GitHub
    const getChk = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath,
      { headers: { 'Authorization': 'token ' + ghToken } });
    const existing = getChk.ok ? await getChk.json() : null;
    const content = Buffer.from(JSON.stringify(srData, null, 2)).toString('base64');
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + dataPath, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'SR webhook: ' + repName + ' ' + status + ' ' + dateStr,
        content,
        sha: existing?.sha
      })
    });

    return res.status(200).json({
      received: true, repName, status, isCA, date: dateStr,
      total_events: srData.events.length
    });

  } catch (err) {
    console.error('SR webhook error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};