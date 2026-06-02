module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const ghToken = process.env.GITHUB_TOKEN;
    const r = await fetch('https://api.github.com/repos/douglasroofs/ca-dashboard/contents/data/sr-data.json',
      { headers: { 'Authorization': 'token '+ghToken } });
    const meta = await r.json();
    const content = Buffer.from(meta.content.replace(/\n/g,''), 'base64').toString('utf8');
    const data = JSON.parse(content);
    return res.status(200).json(data);
  } catch(err) {
    return res.status(200).json({ events: [], error: err.message });
  }
};