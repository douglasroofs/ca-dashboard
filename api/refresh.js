// api/refresh.js - Leap dashboard data refresh endpoint
// Uses LEAP_ACCESS_TOKEN (valid 42 days) + GITHUB_TOKEN env vars
// Called by Sync Now button on the dashboard

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const accessToken = process.env.LEAP_ACCESS_TOKEN;
  const ghToken = process.env.GITHUB_TOKEN;
  const year = new Date().getFullYear();

  if (!accessToken || !ghToken) {
    return res.status(500).json({ error: 'Missing env vars: LEAP_ACCESS_TOKEN or GITHUB_TOKEN' });
  }

  // Push file to GitHub
  const pushGH = async (path, content) => {
    const check = await fetch('https://api.github.com/repos/douglasroofs/ca-dashboard/contents/' + path, {
      headers: { 'Authorization': 'token ' + ghToken }
    });
    const existing = await check.json();
    const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
    const body = { message: 'Auto-refresh ' + new Date().toISOString().split('T')[0], content: encoded };
    if (existing.sha) body.sha = existing.sha;
    const r = await fetch('https://api.github.com/repos/douglasroofs/ca-dashboard/contents/' + path, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.status;
  };

  try {
    const dbBase = 'https://reporting-api.jobprogress.com/api';
    const now = new Date();

    // Fetch CA data from DataBuilder
    const cfgR = await fetch(dbBase + '/reports/3832', { headers: { 'Authorization': 'Bearer ' + accessToken } });
    const cfg = await cfgR.json();
    const fields = cfg.data && cfg.data.configurations && cfg.data.configurations.fields;

    let caData = null;
    if (fields) {
      const docNameUUID = fields.find(f => f.display_name === 'Document Name').uuid;
      const docDateUUID = fields.find(f => f.display_name === 'Document Created Date').uuid;
      const dateFilter = { uuid: docDateUUID, display_name: 'Document Created Date', filters: [{ keyword: 'between', value: year + '-01-01 00:00:00', value2: year + '-12-31 23:59:59', date_type: 'custom' }] };

      const fetchByName = async (val) => {
        const r = await fetch(dbBase + '/get-data', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: 3832, fields, filters: [dateFilter, { uuid: docNameUUID, display_name: 'Document Name', filters: [{ keyword: 'equal_to', value: val, value2: null, date_type: null }] }], page: 1, per_page: 100 })
        });
        const d = await r.json(); return d.data || [];
      };
      const fetchContingency = async () => {
        const r = await fetch(dbBase + '/get-data', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: 3832, fields, filters: [dateFilter, { uuid: docNameUUID, display_name: 'Document Name', filters: [{ keyword: 'contains', value: 'contingency', value2: null, date_type: null }] }], page: 1, per_page: 100 })
        });
        const d = await r.json(); return d.data || [];
      };

      const [ca, caSpace, caTest, contingency] = await Promise.all([fetchByName('CA'), fetchByName('CA '), fetchByName('ca test'), fetchContingency()]);
      const allDocs = [...ca, ...caSpace, ...caTest, ...contingency];
      const seen = {};
      const unique = allDocs.filter(r => { const k = r.f_1 + (r.f_0 || '').trim(); if (seen[k]) return false; seen[k] = true; return true; });
      caData = {
        updated: now.toISOString().split('T')[0],
        month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        cas: unique.map(r => {
          let docName = (r.f_0 || '').trim();
          if (docName.toLowerCase().includes('contingency')) docName = 'CA';
          return { docName, jobId: r.f_1 || '', customer: r.f_2 || '', address: r.f_3 || '', rep: (r.f_4 || '').trim(), status: r.f_5 || '', date: (r.f_6 || '').replace('T', ' ').split('.')[0] };
        })
      };
    }

    // Fetch revenue from Sales Performance API
    const spBase = 'https://jobprogress.com/api/public/api/v1/reports/sales_performance_summary_report';
    const activeTeam = ['Robert Wilson','Kevin Mahan','Jack Obert','Andrew Funk','Andrew Prickel','George Bechara','Michael McCarthy','Christian Brown','David Kerns','Kelly Alston','Harvey Shoemaker','Marc Mitchell','Alfred Duncan','Isabelle Price','Nick Seward','Mike Mendez','Steven Arevalo'];
    const fetchRpt = async (dateType, duration) => {
      const p = new URLSearchParams({ duration, with_inactive: 'false', limit: 200, page: 1, sort_field: 'full_name', sort_order: 'asc' });
      p.append('date_range_type[]', dateType);
      const r = await fetch(spBase + '?' + p.toString(), { headers: { 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' } });
      const d = await r.json(); return d.data || [];
    };
    const norm = n => n.replace(/\s+/g, ' ').trim();
    const toMap = rows => {
      const m = {};
      (rows || []).forEach(r => {
        const n = norm(r.full_name);
        if (!activeTeam.includes(n)) return;
        m[n] = { jobs: parseInt(r.awarded_job_count || 0), contracts: parseInt(r.contracts_jobs_count || 0), amount: parseFloat(r.contract_amount || 0) };
      });
      return m;
    };
    const [aYTD, aMTD, cYTD, cMTD] = await Promise.all([fetchRpt('job_awarded_date', 'YTD'), fetchRpt('job_awarded_date', 'MTD'), fetchRpt('contract_signed_date', 'YTD'), fetchRpt('contract_signed_date', 'MTD')]);
    const aYm = toMap(aYTD), aMm = toMap(aMTD), cYm = toMap(cYTD), cMm = toMap(cMTD);
    const revenueData = {
      updated: now.toISOString().split('T')[0],
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      reps: activeTeam.map(rep => ({
        rep,
        approved_ytd_jobs: (aYm[rep] || {}).jobs || 0, approved_ytd_amount: parseFloat(((aYm[rep] || {}).amount || 0).toFixed(2)),
        approved_mtd_jobs: (aMm[rep] || {}).jobs || 0, approved_mtd_amount: parseFloat(((aMm[rep] || {}).amount || 0).toFixed(2)),
        contract_ytd_jobs: (cYm[rep] || {}).contracts || 0, contract_ytd_amount: parseFloat(((cYm[rep] || {}).amount || 0).toFixed(2)),
        contract_mtd_jobs: (cMm[rep] || {}).contracts || 0, contract_mtd_amount: parseFloat(((cMm[rep] || {}).amount || 0).toFixed(2))
      }))
    };

    // Push both to GitHub
    const [caStatus, revStatus] = await Promise.all([
      caData ? pushGH('data/ca-data.json', caData) : Promise.resolve('skipped'),
      pushGH('data/revenue.json', revenueData)
    ]);

    return res.status(200).json({
      success: true,
      ca_count: caData ? caData.cas.length : 0,
      revenue_updated: revenueData.updated,
      github_ca: caStatus,
      github_rev: revStatus
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};