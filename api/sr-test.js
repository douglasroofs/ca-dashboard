module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const srToken = process.env.SR_TOKEN || req.query.t;
  if(!srToken) return res.status(400).json({error:'no token'});
  
  const endpoints = [
    'https://app.prod2.salesrabbit.com/v2/users',
    'https://app.prod2.salesrabbit.com/v2/accounts/301977/users',
    'https://app.prod2.salesrabbit.com/v1/users',
    'https://capi.prod2.salesrabbit.com/v1/users',
    'https://capi.prod2.salesrabbit.com/v1/accounts/301977/users'
  ];
  
  const results = [];
  for(const url of endpoints) {
    try {
      const r = await fetch(url, {headers:{'Authorization':'Bearer '+srToken,'Accept':'application/json'}});
      const text = await r.text();
      results.push({url: url.replace('https://','').split('/').slice(0,2).join('/'), status: r.status, preview: text.substring(0,80)});
    } catch(e) { results.push({url: url.replace('https://','').split('/')[0], error: e.message}); }
  }
  return res.status(200).json(results);
};