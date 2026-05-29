// CA Dashboard - Leap API v2
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.JP_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'JP_API_TOKEN not set in Vercel environment variables' });

  const headers = { 'Authorization': 'Bearer ' + token };
  const BASE = 'https://api.jobprogress.com/api/v3';

  try {
    const [prResp, jobsResp] = await Promise.all([
      fetch(BASE + '/proposals?limit=100', { headers }),
      fetch(BASE + '/jobs?limit=100&includes[]=address&includes[]=customer&includes[]=rep_user', { headers })
    ]);

    const prData = prResp.ok ? await prResp.json() : { data: [] };
    const jobsData = jobsResp.ok ? await jobsResp.json() : { data: [] };

    const caProposals = (prData.data || []).filter(d =>
      (d.title || d.name || '').toUpperCase().startsWith('CA')
    );

    const jobMap = {};
    (jobsData.data || []).forEach(j => { jobMap[j.id] = j; });

    const rows = caProposals.map(p => {
      const job = jobMap[p.job_id] || {};
      const cust = job.customer || {};
      const addr = job.address || {};
      const addrStr = typeof addr === 'string' ? addr
        : [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
      const custName = cust.display_name ||
        ((cust.first_name || '') + ' ' + (cust.last_name || '')).trim() || '';
      const rep = (job.rep_user || {}).display_name ||
        (job.rep_user || {}).name || job.customer_rep || '';
      return {
        jobId: job.job_number || String(p.job_id || ''),
        customer: custName,
        address: addrStr,
        rep: rep,
        status: (p.status || '').toLowerCase()
      };
    });

    return res.status(200).json({ rows });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
