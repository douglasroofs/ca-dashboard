module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const ghToken = process.env.GITHUB_TOKEN;
    const data = req.body;
    const chk = await fetch('https://api.github.com/repos/douglasroofs/ca-dashboard/contents/data/comp-override.json',
      { headers: { 'Authorization': 'token ' + ghToken } });
    const existing = await chk.json();
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const push = await fetch('https://api.github.com/repos/douglasroofs/ca-dashboard/contents/data/comp-override.json', {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update competition CA scores', content, sha: existing.sha })
    });
    const result = await push.json();
    return res.status(200).json({ success: true, commit: result.commit && result.commit.sha && result.commit.sha.substring(0, 7) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};