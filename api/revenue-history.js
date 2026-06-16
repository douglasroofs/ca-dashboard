// api/revenue-history.js
module.exports = async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') return res.status(200).end();

        const { month } = req.query;
        const token = process.env.JP_API_TOKEN;
        if (!token) return res.status(500).json({ error: 'Missing JP_API_TOKEN' });
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

        const BASE = 'https://api.jobprogress.com/api/v3';
        const headers = { 'Authorization': 'Bearer ' + token };
        const norm = n => (n || '').replace(/\s+/g, ' ').trim();

        const fetchJobs = async (params) => {
                    const p = new URLSearchParams({ limit: 200, page: 1, ...params });
                    p.append('includes[]', 'rep_user');
                    const r = await fetch(BASE + '/jobs?' + p.toString(), { headers });
                    const d = r.ok ? await r.json() : {};
                    return { status: r.status, data: d.data || [], total: d.meta ? d.meta.total : null };
        };

        try {
                    // Sample one job to learn field names
            const sampleR = await fetch(BASE + '/jobs?limit=1&includes[]=rep_user', { headers });
                    const sampleD = sampleR.ok ? await sampleR.json() : {};
                    const sample = (sampleD.data || [])[0] || null;

            // Try date filters for contract signed and job awarded
            const [contracted, awarded] = await Promise.all([
                            fetchJobs({ 'contract_signed_date[from]': startDate, 'contract_signed_date[to]': endDate }),
                            fetchJobs({ 'job_awarded_date[from]': startDate, 'job_awarded_date[to]': endDate })
                        ]);

            // Build rep map from contracted jobs
            const repMap = {};
                    activeTeam.forEach(name => { repMap[name] = { cJobs: 0, cAmt: 0, aJobs: 0, aAmt: 0 }; });

            const getRepName = job => {
                            const ru = job.rep_user || {};
                            return norm(ru.display_name || ru.name || ((ru.first_name||'') + ' ' + (ru.last_name||'')));
            };
                    const getAmt = job => parseFloat(job.contract_amount || job.total_amount || job.job_total_amount || 0);

            contracted.data.forEach(job => {
                            const name = getRepName(job);
                            if (repMap[name]) { repMap[name].cJobs++; repMap[name].cAmt += getAmt(job); }
            });
                    awarded.data.forEach(job => {
                                    const name = getRepName(job);
                                    if (repMap[name]) { repMap[name].aJobs++; repMap[name].aAmt += getAmt(job); }
                    });

            const reps = activeTeam.map(rep => ({
                            rep,
                            approved_jobs: repMap[rep].aJobs,
                            approved_amount: parseFloat(repMap[rep].aAmt.toFixed(2)),
                            contract_jobs: repMap[rep].cJobs,
                            contract_amount: parseFloat(repMap[rep].cAmt.toFixed(2))
            }));

            return res.status(200).json({
                            success: true, month, start_date: startDate, end_date: endDate, reps,
                            _debug: {
                                                contractedStatus: contracted.status,
                                                contractedCount: contracted.data.length,
                                                awardedStatus: awarded.status,
                                                awardedCount: awarded.data.length,
                                                sampleFields: sample ? Object.keys(sample) : [],
                                                sampleAmounts: sample ? {
                                                                        contract_amount: sample.contract_amount,
                                                                        total_amount: sample.total_amount,
                                                                        job_total_amount: sample.job_total_amount
                                                } : null,
                                                sampleRepUser: sample ? sample.rep_user : null,
                                                contractedSample: contracted.data.slice(0, 2).map(j => ({
                                                                        rep: getRepName(j), contract_amount: j.contract_amount,
                                                                        total_amount: j.total_amount, contract_signed_date: j.contract_signed_date
                                                })),
                                                awardedSample: awarded.data.slice(0, 2).map(j => ({
                                                                        rep: getRepName(j), contract_amount: j.contract_amount,
                                                                        total_amount: j.total_amount, job_awarded_date: j.job_awarded_date
                                                }))
                            }
            });
        } catch (err) {
                    return res.status(500).json({ error: err.message });
        }
};
