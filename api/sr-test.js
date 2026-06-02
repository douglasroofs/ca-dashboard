module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const srToken = req.query.t;
  const BASE = 'https://app.prod2.salesrabbit.com/v2';
  const auth = 'Bearer '+srToken;
  
  const tests = [
    {url:BASE+'/leads?limit=1', accept:'application/json'},
    {url:BASE+'/leads?limit=1', accept:'text/json'},
    {url:BASE+'/leads?limit=1', accept:'text/html'},
    {url:BASE+'/leads?limit=1', accept:'application/xml'},
    {url:BASE+'/leads?limit=1', accept:'*/*'},
    {url:BASE+'/leads?limit=1&format=json', accept:'application/json'},
    {url:BASE+'/leads.json?limit=1', accept:'application/json'},
    {url:BASE+'/leads?limit=1', accept:null}
  ];
  
  const results = [];
  for(const {url,accept} of tests) {
    try {
      const hdrs = {'Authorization':auth};
      if(accept) hdrs['Accept'] = accept;
      const r = await fetch(url, {headers:hdrs});
      const t = await r.text();
      results.push((accept||'no-accept')+' -> '+r.status+' '+t.substring(0,60));
    } catch(e) { results.push('ERR '+e.message.substring(0,30)); }
  }
  return res.status(200).json(results);
};