module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const jwt = req.query.j;
  const BASE = 'https://app.prod2.salesrabbit.com/api';
  const headers = {'Authorization':'Bearer '+jwt};
  
  const tests = [
    BASE+'/v2/leads',
    BASE+'/v2/leads/list',
    BASE+'/v2/leads?limit=5',
    BASE+'/v2/leads?count=5&page=1',
    BASE+'/v2/leads?per_page=5',
    BASE+'/v1/leads',
    BASE+'/v2/account/leads',
    BASE+'/v2/leads/search?status=SGCA',
  ];
  
  const results = [];
  for(const url of tests){
    try {
      const r = await fetch(url,{headers});
      const t = await r.text();
      results.push(url.replace(BASE,'').substring(0,30)+' '+r.status+' '+t.substring(0,80));
    } catch(e){ results.push('ERR '+e.message.substring(0,30)); }
  }
  return res.status(200).json(results);
};