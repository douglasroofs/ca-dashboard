export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.JP_API_TOKEN;
    if (!token) return res.status(500).json({ error: 'JP_API_TOKEN not set in Vercel environment variables' });

  const headers = { 'Authorization': 'Bearer ' + token };
    const BASE = 'https://api.jobprogress.com/api/v3';

  try {
        // Fetch worksheets (CA = Contractor Agreement documents)
      const [wsResp, prResp] = await Promise.all([
              fetch(BASE + '/worksheets?limit=100&includes[]=job&includes[]=customer', { headers }),
              fetch(BASE + '/proposals?limit=100&includes[]=job&includes[]=customer', { headers })
            ]);

      const wsData = wsResp.ok ? await wsResp.json() : { data: [] };
        const prData = prResp.ok ? await prResp.json() : { data: [] };

      // Combine and filter for CA documents
      const all = [...(wsData.data || []), ...(prData.data || [])];
        const caRows = all.filter(d => {
                const name = (d.title || d.name || '').toUpperCase();
                return name.startsWith('CA');
        });

      const rows = caRows.map(d => {
              const job = d.job || {};
              const cust = d.customer || {};
              const addr = job.address || {};
              const addrStr = typeof addr === 'string' ? addr
                        : [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
              const custName = cust.display_name ||
                        ((cust.first_name || '') + ' ' + (cust.last_name || '')).trim();
              const rep = (d.created_by || {}).display_name || d.rep_name || '';
              const status = (d.status || d.proposal_status || d.worksheet_status || '').toLowerCase();
              return {
                        jobId: job.job_number || String(d.job_id || ''),
                        customer: custName,
                        address: addrStr,
                        rep: rep,
                        status: status
              };
      });

      // Include raw sample for debugging
      return res.status(200).json({
              rows,
              debug: { wsStatus: wsResp.status, prStatus: prResp.status, rawSample: all.slice(0,2) }
      });
  } catch(e) {
        return res.status(500).json({ error: e.message });
  }
}
