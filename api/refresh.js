const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const ACTIVE_REPS = ['Robert Wilson','Kevin Mahan','Jack Obert','Andrew Funk','Andrew Prickel',
  'George Bechara','Michael McCarthy','Christian Brown','David Kerns','Kelly Alston',
  'Harvey Shoemaker','Marc Mitchell','Alfred Duncan','Isabelle Price','Nick Seward',
  'Mike Mendez','Steven Arevalo'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const leapToken = process.env.LEAP_ACCESS_TOKEN;
  const ghToken = process.env.GITHUB_TOKEN;
  if (!leapToken || !ghToken) return res.status(500).json({ error: 'Missing env vars' });

  try {
    const now = new Date();

    // Fetch revenue data using OAuth token (works with main Leap API)
    const salesPerfR = await fetch(
      'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report?duration_type=job_awarded_date&per_page=100',
      { headers: { 'Authorization': 'Bearer ' + leapToken } }
    );

    if (!salesPerfR.ok) {
      return res.status(500).json({ success: false, error: 'Sales perf API failed: ' + salesPerfR.status });
    }

    const salesPerf = await salesPerfR.json();
    const repList = salesPerf.data || salesPerf.reps || [];

    const revData = {
      updated: now.toISOString().split('T')[0],
      reps: repList
        .filter(r => ACTIVE_REPS.includes((r.rep || '').trim().replace(/\s+/g,' ')))
        .map(r => ({
          rep: (r.rep || '').trim().replace(/\s+/g,' '),
          approved_ytd_amount: r.approved_ytd_amount || 0,
          approved_mtd_amount: r.approved_mtd_amount || 0,
          approved_ytd_jobs: r.approved_ytd_jobs || 0,
          approved_mtd_jobs: r.approved_mtd_jobs || 0,
          contract_ytd_amount: r.contract_ytd_amount || 0,
          contract_mtd_amount: r.contract_mtd_amount || 0,
          contract_ytd_jobs: r.contract_ytd_jobs || 0,
          contract_mtd_jobs: r.contract_mtd_jobs || 0
        }))
    };

    // Push revenue.json to GitHub
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
      updated: revData.updated,
      commit: pushResult.commit && pushResult.commit.sha && pushResult.commit.sha.substring(0, 7),
      note: 'CA data synced separately via DataBuilder browser task'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
