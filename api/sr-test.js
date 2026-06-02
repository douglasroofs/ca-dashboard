module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const jwt = req.query.j;
  if(!jwt) return res.status(400).json({error:'no jwt'});
  const headers = {'Authorization':'Bearer '+jwt,'Accept':'application/json'};
  
  // Try various lead query approaches
  const tests = [
    'https://capi.prod2.salesrabbit.com/v1/leads',
    'https://capi.prod2.salesrabbit.com/v1/leads?page[limit]=5',
    'https://capi.prod2.salesrabbit.com/v1/accounts/301977/leads?page[limit]=5',
    'https://app.prod2.salesrabbit.com/api/v2/leads?accountId=301977',
    'https://app.prod2.salesrabbit.com/v2/leads?accountId=301977',
    'https://capi.prod2.salesrabbit.com/v2/leads?accountId=301977',
  ];
  
  const results = [];
  for(const url of tests){
    try {
      const r = await fetch(url,{headers});
      const t = await r.text();
      results.push({url:url.replace('https://','').split('/').slice(0,2).join('/'), status:r.status, preview:t.substring(0,100)});
    } catch(e){ results.push({url:url.split('/')[2], error:e.message.substring(0,40)}); }
  }
  return res.status(200).json(results);
};