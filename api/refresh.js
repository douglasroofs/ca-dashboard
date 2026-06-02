const REPORTING_API = 'https://reporting-api.jobprogress.com/api';
const REPORT_ID = 3832;
const GITHUB_REPO = 'douglasroofs/ca-dashboard';
const CA_NAMES_EXACT = ['CA', 'CA ', 'ca test', 'ICA', 'SGCA'];
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
    const yr = now.getFullYear();

    const cfgR = await fetch(REPORTING_API + '/reports/' + REPORT_ID, {
      headers: { 'Authorization': 'Bearer ' + leapToken }
    });
    const cfg = await cfgR.json();
    const fields = cfg.data.configurations.fields;
    const docNameUUID = fields.find(f => f.display_name === 'Document Name').uuid;
    const docDateUUID = fields.find(f => f.display_name === 'Document Created Date').uuid;
    const dateFilter = {
      uuid: docDateUUID,
      display_name: 'Document Created Date',
      filters: [{ keyword: 'between', value: yr + '-01-01 00:00:00', value2: yr + '-12-31 23:59:59', date_type: 'custom' }]
    };

    const fetchByName = async (val) => {
      let all = [], p = 1;
      while (true) {
        const r = await fetch(REPORTING_API + '/get-data', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + leapToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: REPORT_ID, fields, page: p, per_page: 100,
            filters: [dateFilter, { uuid: docNameUUID, display_name: 'Document Name',
              filters: [{ keyword: 'equal_to', value: val, value2: null, date_type: null }] }]
          })
        });
        const d = await r.json();
        const batch = d.data || [];
        all = all.concat(batch);
        if (p >= ((d.meta && d.meta.last_page) || 1) || batch.length < 100) break;
        p++;
      }
      return all;
    };

    const fetchContains = async (val) => {
      const r = await fetch(REPORTING_API + '/get-data', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + leapToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: REPORT_ID, fields, page: 1, per_page: 200,
          filters: [dateFilter, { uuid: docNameUUID, display_name: 'Document Name',
            filters: [{ keyword: 'contains', value: val, value2: null, date_type: null }] }]
        })
      });
      const d = await r.json();
      return d.data || [];
    };

    const results = await Promise.all([
      ...CA_NAMES_EXACT.map(n => fetchByName(n)),
      fetchContains('contingency')
    ]);

    const all = results.flat();
    const seen = {};
    const unique = all.filter(r => {
      const k = r.f_1 + (r.f_0 || '').trim();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });

    const caData = {
      updated: now.toISOString().split('T')[0],
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      cas: unique.map(r => {
        let docName = (r.f_0 || '').trim();
        const lower = docName.toLowerCase();
        if (lower.includes('contingency') || lower === 'ica' || lower === 'sgca') docName = 'CA';
        return { docName, jobId: r.f_1 || '', customer: r.f_2 || '',
          address: r.f_3 || '', rep: (r.f_4 || '').trim(),
          status: r.f_5 || '', date: (r.f_6 || '').replace('T', ' ').split('.')[0] };
      })
    };

    const salesPerfR = await fetch(
      'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report?duration_type=job_awarded_date&per_page=100',
      { headers: { 'Authorization': 'Bearer ' + leapToken } }
    );
    const salesPerf = await salesPerfR.json();

    const revData = {
      updated: now.toISOString().split('T')[0],
      reps: ((salesPerf.data || salesPerf.reps || [])
        .filter(r => ACTIVE_REPS.includes((r.rep || '').trim()))
        .map(r => ({
          rep: (r.rep || '').trim(),
          approved_ytd_amount: r.approved_ytd_amount || 0,
          approved_mtd_amount: r.approved_mtd_amount || 0,
          approved_ytd_jobs: r.approved_ytd_jobs || 0,
          approved_mtd_jobs: r.approved_mtd_jobs || 0,
          contract_ytd_amount: r.contract_ytd_amount || 0,
          contract_mtd_amount: r.contract_mtd_amount || 0,
          contract_ytd_jobs: r.contract_ytd_jobs || 0,
          contract_mtd_jobs: r.contract_mtd_jobs || 0
        })))
    };

    const pushFile = async (path, data, msg) => {
      const c = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path,
        { headers: { 'Authorization': 'token ' + ghToken } });
      const ex = await c.json();
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const p = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + path, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, content, sha: ex.sha })
      });
      return p.json();
    };

    const [caR, revR] = await Promise.all([
      pushFile('data/ca-data.json', caData, 'CA update (CA+ICA+SGCA+contingency) - ' + caData.updated),
      pushFile('data/revenue.json', revData, 'Revenue update - ' + revData.updated)
    ]);

    return res.status(200).json({ success: true, cas: caData.cas.length, reps: revData.reps.length,
      ca_commit: caR.commit && caR.commit.sha && caR.commit.sha.substring(0, 7),
      rev_commit: revR.commit && revR.commit.sha && revR.commit.sha.substring(0, 7) });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
