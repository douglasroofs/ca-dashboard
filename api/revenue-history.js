// api/revenue-history.js
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { month } = req.query;
        const accessToken = process.env.JP_API_TOKEN || process.env.LEAP_ACCESS_TOKEN;

    if (!accessToken) return res.status(500).json({ error: 'Missing LEAP_ACCESS_TOKEN' });
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ error: 'Invalid month. Use YYYY-MM' });
    }

    const [year, mo] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(mo), 0).getDate();
    const startDate = year + '-' + mo + '-01';
    const endDate = year + '-' + mo + '-' + lastDay;

    const activeTeam = ['Robert Wilson','Kevin Mahan','Jack Obert','Andrew Funk','Andrew Prickel',
                            'George Bechara','Michael McCarthy','Christian Brown','David Kerns','Kelly Alston',
                            'Harvey Shoemaker','Marc Mitchell','Alfred Duncan','Isabelle Price','Nick Seward',
                            'Mike Mendez','Steven Arevalo'];

    const base = 'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report';
    const norm = n => (n || '').replace(/\s+/g, ' ').trim();

    const fetchRpt = async (dateType) => {
          const p = new URLSearchParams({
                  duration: 'custom', with_inactive: 'false',
                  limit: 200, page: 1,
                  sort_field: 'full_name', sort_order: 'asc',
                  start_date: startDate, end_date: endDate
          });
          p.append('date_range_type[]', dateType);
          const r = await fetch(base + '?' + p.toString(), {
                  headers: { 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
          });
          const d = await r.json();
          return { status: r.status, data: d.data || [], raw: d };
    };

    try {
          const [awarded, contracted] = await Promise.all([
                  fetchRpt('job_awarded_date'),
                  fetchRpt('contract_signed_date')
                ]);

      // Debug: return raw API info
      const awardedNames = (awarded.data || []).map(r => norm(r.full_name));
          const contractedNames = (contracted.data || []).map(r => norm(r.full_name));

      const toMap = rows => {
              const m = {};
              (rows || []).forEach(r => {
                        const n = norm(r.full_name);
                        m[n] = { jobs: parseInt(r.awarded_job_count || 0), contracts: parseInt(r.contracts_jobs_count || 0), amount: parseFloat(r.contract_amount || 0) };
              });
              return m;
      };

      const aMap = toMap(awarded.data);
          const cMap = toMap(contracted.data);

      const reps = activeTeam.map(rep => ({
              rep,
              approved_jobs: (aMap[rep] || {}).jobs || 0,
              approved_amount: parseFloat(((aMap[rep] || {}).amount || 0).toFixed(2)),
              contract_jobs: (cMap[rep] || {}).contracts || 0,
              contract_amount: parseFloat(((cMap[rep] || {}).amount || 0).toFixed(2))
      }));

      return res.status(200).json({
              success: true, month, start_date: startDate, end_date: endDate, reps,
              _debug: {
                        awardedStatus: awarded.status,
                        contractedStatus: contracted.status,
                        awardedCount: awarded.data.length,
                        contractedCount: contracted.data.length,
                        awardedNames: awardedNames.slice(0, 10),
                        contractedNames: contractedNames.slice(0, 10),
                        awardedSample: (awarded.data || []).slice(0, 2),
                        contractedSample: (contracted.data || []).slice(0, 2)
              }
      });
    } catch (err) {
          return res.status(500).json({ error: err.message });
    }
};
