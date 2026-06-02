const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const BASE_URL = 'https://ca-dashboard-khaki.vercel.app';
const ACTIVE_REPS = ['Robert Wilson','Kevin Mahan','Jack Obert','Andrew Funk','Andrew Prickel',
  'George Bechara','Michael McCarthy','Christian Brown','David Kerns','Kelly Alston',
  'Harvey Shoemaker','Marc Mitchell','Alfred Duncan','Isabelle Price','Nick Seward',
  'Mike Mendez','Steven Arevalo'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) return res.status(500).json({ error: 'Missing GITHUB_TOKEN' });

  try {
    const now = new Date();
    const yr = now.getFullYear();
    const curMo = now.getMonth() + 1;

    // Build revenue map by calling revenue-history for each month YTD
    const revMap = {};
    ACTIVE_REPS.forEach(name => {
      revMap[name] = {
        rep: name,
        approved_ytd_amount: 0, approved_ytd_jobs: 0,
        approved_mtd_amount: 0, approved_mtd_jobs: 0,
        contract_ytd_amount: 0, contract_ytd_jobs: 0,
        contract_mtd_amount: 0, contract_mtd_jobs: 0
      };
    });

    // Fetch all months in parallel
    const monthFetches = [];
    for (let m = 1; m <= curMo; m++) {
      const mo = String(m).padStart(2, '0');
      monthFetches.push(
        fetch(BASE_URL + '/api/revenue-history?month=' + yr + '-' + mo)
          .then(r => r.json())
          .then(d => ({ month: m, data: d }))
          .catch(() => ({ month: m, data: null }))
      );
    }
    const monthResults = await Promise.all(monthFetches);

    monthResults.forEach(({ month, data }) => {
      if (!data || !data.success || !data.reps) return;
      const isMTD = month === curMo;
      data.reps.forEach(r => {
        const name = (r.rep || '').trim().replace(/\s+/g, ' ');
        if (!revMap[name]) return;
        revMap[name].approved_ytd_amount += r.approved_amount || 0;
        revMap[name].approved_ytd_jobs += r.approved_jobs || 0;
        revMap[name].contract_ytd_amount += r.contract_amount || 0;
        revMap[name].contract_ytd_jobs += r.contract_jobs || 0;
        if (isMTD) {
          revMap[name].approved_mtd_amount = r.approved_amount || 0;
          revMap[name].approved_mtd_jobs = r.approved_jobs || 0;
          revMap[name].contract_mtd_amount = r.contract_amount || 0;
          revMap[name].contract_mtd_jobs = r.contract_jobs || 0;
        }
      });
    });

    const revData = { updated: now.toISOString().split('T')[0], reps: Object.values(revMap) };

    // Push to GitHub
    const chkR = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/data/revenue.json',
      { headers: { 'Authorization': 'token ' + ghToken } });
    const ex = await chkR.json();
    const content = Buffer.from(JSON.stringify(revData, null, 2)).toString('base64');
    const pushR = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/data/revenue.json', {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Revenue update - ' + revData.updated, content, sha: ex.sha })
    });
    const pushResult = await pushR.json();

    return res.status(200).json({
      success: true,
      reps: revData.reps.length,
      months_fetched: curMo,
      updated: revData.updated,
      commit: pushResult.commit && pushResult.commit.sha && pushResult.commit.sha.substring(0, 7)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
