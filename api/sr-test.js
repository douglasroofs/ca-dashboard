module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const jwt = req.query.j;
  const BASE = 'https://app.prod2.salesrabbit.com/api';
  const h = {'Authorization':'Bearer '+jwt,'Content-Type':'application/json','Accept':'application/json'};
  
  const tests = [
    // Try POST with body
    {m:'POST',url:BASE+'/v2/leads',body:{statusAbbreviation:'SGCA',limit:5}},
    {m:'POST',url:BASE+'/v2/leads',body:{status:'SGCA',limit:5}},
    {m:'GET',url:BASE+'/v2/leads?accountId=301977&statusAbbr=SGCA&limit=5',body:null},
    {m:'GET',url:BASE+'/v2/leads?accountId=301977&limit=5',body:null},
    // Try search endpoint
    {m:'GET',url:BASE+'/v2/leads/search?status=SGCA&limit=5',body:null},
    // Try with just limit - maybe it works
    {m:'GET',url:BASE+'/v2/leads?limit=2&page=1&accountId=301977',body:null},
  ];
  
  const results = [];
  for(const {m,url,body} of tests){
    try {
      const opts = {method:m,headers:h};
      if(body) opts.body = JSON.stringify(body);
      const r = await fetch(url,opts);
      const t = await r.text();
      results.push(m+' '+url.replace(BASE,'').substring(0,40)+' -> '+r.status+' '+t.substring(0,80));
    } catch(e){ results.push('ERR '+e.message.substring(0,40)); }
  }
  return res.status(200).json(results);
};