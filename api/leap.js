export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.JP_API_TOKEN;
    if (!token) return res.status(500).json({ error: 'JP_API_TOKEN not set in Vercel environment variables' });

  const headers = { 'Authorization': 'Bearer ' + token };
    const BASE = 'https://api.jobprogress.com/api/v3';

  try {
        // Fetch CA proposals
      const prResp = await fetch(BASE + '/proposals?limit=100', { headers });
        const prData = prResp.ok ? await prResp.json() : { data: [] };

      const caProposals = (prData.data || []).filter(d =>
              (d.title || d.name || '').toUpperCase().startsWith('CA')
                                                         );

      // Collect unique job IDs from the proposals
      const uniqueJobIds = [...new Set(caProposals.map(p => p.job_id).filter(Boolean))];

      // Fetch each job individually — bulk /jobs?limit=100 doesn't guarantee
      // the right jobs are returned, so we look up by specific ID instead
      const jobResults = await Promise.all(
              uniqueJobIds.map(id =>
                        fetch(`${BASE}/jobs/${id}`, { headers })
                                         .then(r => r.ok ? r.json() : null)
                                         .catch(() => null)
                                     )
            );

      // Build job map keyed by job_id
      const jobMap = {};
        jobResults.forEach((result, i) => {
                if (result) {
                          const job = result.data || result;
                          jobMap[uniqueJobIds[i]] = job;
                }
        });

      // Build rows
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
