module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const srToken = req.query.t;
  const auth = 'Bearer '+srToken;
  
  // Try every reasonable path variant
  const urls = [
    'https://app.prod2.salesrabbit.com/v2/accounts/301977/leads?limit=1',
    'https://app.prod2.salesrabbit.com/v2/account/leads?limit=1',
    'https://app.prod2.salesrabbit.com/api/v2/leads?limit=1',
    'https://app.prod2.salesrabbit.com/api/leads?limit=1',
    'https://app.prod2.salesrabbit.com/v3/leads?limit=1',
    'https://app.prod2.salesrabbit.com/v2/leads?per_page=1',
    'https://app.prod2.salesrabbit.com/v2/leads/list?limit=1',
    'https://app.prod2.salesrabbit.com/v2/leads?count=1'
  ];
  
  const results = [];
  for(const url of urls) {
    try {
      const r = await fetch(url, {headers:{'Authorization':auth,'Accept':'application/json','Content-Type':'application/json'}});
      const t = await r.text();
      results.push(url.replace('https://app.prod2.salesrabbit.com','').substring(0,35)+' -> '+r.status+' '+t.substring(0,50));
    } catch(e) { results.push('CORS '+url.split('/').slice(-1)[0]); }
  }
  return res.status(200).json(results);
};