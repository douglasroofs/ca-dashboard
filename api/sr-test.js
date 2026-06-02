module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const srToken = req.query.t;
  if(!srToken) return res.status(400).json({error:'no token'});
  
  // Try app.prod2 with various Accept headers and auth formats
  const tests = [
    {url:'https://app.prod2.salesrabbit.com/v2/users', hdrs:{'Authorization':'Bearer '+srToken}},
    {url:'https://app.prod2.salesrabbit.com/v2/users', hdrs:{'Authorization':'Token '+srToken}},
    {url:'https://app.prod2.salesrabbit.com/v2/users', hdrs:{'X-SR-API-Token':srToken}},
    {url:'https://app.prod2.salesrabbit.com/v2/users?api_token='+srToken, hdrs:{}},
    {url:'https://app.prod2.salesrabbit.com/v2/users', hdrs:{'Authorization':'Bearer '+srToken,'Accept':'*/*'}},
    {url:'https://app.prod2.salesrabbit.com/v2/leads?limit=1', hdrs:{'Authorization':'Bearer '+srToken,'Accept':'application/json','Content-Type':'application/json'}},
    {url:'https://app.prod2.salesrabbit.com/v2/lead_statuses', hdrs:{'Authorization':'Bearer '+srToken,'Accept':'application/json'}}
  ];
  
  const results = [];
  for(const {url,hdrs} of tests) {
    try {
      const r = await fetch(url, {headers:hdrs});
      const text = await r.text();
      results.push(url.split('/').slice(-2).join('/')+' '+r.status+' '+text.substring(0,60));
    } catch(e) { results.push('ERR: '+e.message.substring(0,40)); }
  }
  return res.status(200).json(results);
};