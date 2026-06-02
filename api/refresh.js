const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const ACTIVE_REPS = ['Robert Wilson','Kevin Mahan','Jack Obert','Andrew Funk','Andrew Prickel',
  'George Bechara','Michael McCarthy','Christian Brown','David Kerns','Kelly Alston',
  'Harvey Shoemaker','Marc Mitchell','Alfred Duncan','Isabelle Price','Nick Seward',
  'Mike Mendez','Steven Arevalo'];

function lastDayOfMonth(yr, mo) {
  return new Date(yr, mo, 0).getDate();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const leapToken = process.env.LEAP_ACCESS_TOKEN;
  const ghToken = process.env.GITHUB_TOKEN;
  if (!leapToken || !ghToken) return res.status(500).json({ error: 'Missing env vars' });

  try {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = lastDayOfMonth(yr, now.getMonth() + 1);
    const startDate = yr + '-01-01';
    const endDate = yr + '-' + mo + '-' + lastDay;

    // YTD revenue using date range (required by the API)
    const ytdUrl = 'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report' +
      '?start_date=' + startDate + '&end_date=' + endDate +
      '&duration_type=job_awarded_date&per_page=100';
    const ytdR = await fetch(ytdUrl, { headers: { 'Authorization': 'Bearer ' + leapToken } });
    if (!ytdR.ok) throw new Error('YTD API failed: ' + ytdR.status);
    const ytdData = await ytdR.json();
    const ytdReps = ytdData.data || ytdData.reps || [];

    // MTD revenue using current month date range
    const mtdStartDate = yr + '-' + mo + '-01';
    const mtdUrl = 'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report' +
      '?start_date=' + mtdStartDate + '&end_date=' + endDate +
      '&duration_type=job_awarded_date&per_page=100';
    const mtdR = await fetch(mtdUrl, { headers: { 'Authorization': 'Bearer ' + leapToken } });
    if (!mtdR.ok) throw new Error('MTD API failed: ' + mtdR.status);
    const mtdData = await mtdR.json();
    const mtdReps = mtdData.data || mtdData.reps || [];

    // Also get MTD by contract_signed_date
    const csUrl = 'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report' +
      '?start_date=' + mtdStartDate + '&end_date=' + endDate +
      '&duration_type=contract_signed_date&per_page=100';
    const csR = await fetch(csUrl, { headers: { 'Authorization': 'Bearer ' + leapToken } });
    const csData = csR.ok ? await csR.json() : { data: [] };
    const csReps = csData.data || csData.reps || [];

    // Merge: YTD approved + MTD approved + MTD contract signed
    const revMap = {};
    ACTIVE_REPS.forEach(name => { revMap[name] = { rep: name, approved_ytd_amount: 0, approved_ytd_jobs: 0, approved_mtd_amount: 0, approved_mtd_jobs: 0, contract_ytd_amount: 0, contract_ytd_jobs: 0, contract_mtd_amount: 0, contract_mtd_jobs: 0 }; });

    ytdReps.forEach(r => {
      const name = (r.rep || '').trim().replace(/\s+/g, ' ');
      if (revMap[name]) {
        revMap[name].approved_ytd_amount = r.approved_amount || 0;
        revMap[name].approved_ytd_jobs = r.approved_jobs || 0;
      }
    });
    mtdReps.forEach(r => {
      const name = (r.rep || '').trim().replace(/\s+/g, ' ');
      if (revMap[name]) {
        revMap[name].approved_mtd_amount = r.approved_amount || 0;
        revMap[name].approved_mtd_jobs = r.approved_jobs || 0;
      }
    });
    csReps.forEach(r => {
      const name = (r.rep || '').trim().replace(/\s+/g, ' ');
      if (revMap[name]) {
        revMap[name].contract_ytd_amount = r.approved_amount || 0;
        revMap[name].contract_ytd_jobs = r.approved_jobs || 0;
        revMap[name].contract_mtd_amount = r.approved_amount || 0;
        revMap[name].contract_mtd_jobs = r.approved_jobs || 0;
      }
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
      success: true, reps: revData.reps.length, updated: revData.updated,
      commit: pushResult.commit && pushResult.commit.sha && pushResult.commit.sha.substring(0, 7)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
