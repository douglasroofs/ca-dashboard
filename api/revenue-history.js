// api/revenue-history.js — probe proposals + individual job fields
module.exports = async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') return res.status(200).end();

        const token = process.env.JP_API_TOKEN;
        if (!token) return res.status(500).json({ error: 'Missing JP_API_TOKEN' });

        const BASE = 'https://api.jobprogress.com/api/v3';
        const headers = { 'Authorization': 'Bearer ' + token };

        try {
                // Step 1: Fetch proposals (known to work)
                const prResp = await fetch(BASE + '/proposals?limit=10&page=1', { headers });
                const prStatus = prResp.status;
                let prData = {};
                try { prData = await prResp.json(); } catch(e) {}
                const proposals = prData.data || [];
                const sampleProp = proposals[0] || null;

                // Step 2: Get all field names and values from the sample proposal
                const sampleProposalFields = sampleProp ? Object.keys(sampleProp) : [];
                const amountKeys = ['price','total','amount','grand_total','contract_amount','subtotal','cost','value'];
                const dateKeys = ['created_at','updated_at','signed_at','contract_signed_date','date','awarded_date','close_date'];
                const statusKeys = ['status','stage','state','proposal_status'];
                const sampleProposalValues = {};
                if (sampleProp) {
                        [...amountKeys, ...dateKeys, ...statusKeys, 'job_id', 'title', 'name', 'customer_id'].forEach(k => {
                                if (k in sampleProp) sampleProposalValues[k] = sampleProp[k];
                        });
                }

                // Step 3: Fetch individual job using job_id from first proposal
                let sampleJob = null;
                let jobStatus = null;
                let sampleJobFields = [];
                let sampleJobValues = {};
                if (sampleProp && sampleProp.job_id) {
                        const jResp = await fetch(BASE + '/jobs/' + sampleProp.job_id + '?includes[]=rep_user&includes[]=customer', { headers });
                        jobStatus = jResp.status;
                        if (jResp.ok) {
                                const jData = await jResp.json();
                                sampleJob = jData.data || jData;
                                sampleJobFields = Object.keys(sampleJob);
                                [...amountKeys, ...dateKeys, ...statusKeys, 'rep_user', 'customer', 'number', 'title'].forEach(k => {
                                        if (k in sampleJob) sampleJobValues[k] = sampleJob[k];
                                });
                        }
                }

                // Step 4: Get unique statuses across all fetched proposals
                const allStatuses = [...new Set(proposals.map(p => p.status).filter(Boolean))];

                return res.json({
                        _debug: {
                                proposalStatus: prStatus,
                                proposalCount: proposals.length,
                                allProposalStatuses: allStatuses,
                                sampleProposalFields,
                                sampleProposalValues,
                                jobFetchStatus: jobStatus,
                                sampleJobFields,
                                sampleJobValues
                        }
                });
        } catch(err) {
                return res.status(500).json({ error: err.message, stack: err.stack });
        }
};
