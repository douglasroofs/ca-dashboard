// api/amp-debug.js — TEMPORARY diagnostic (delete after use). Inspect lead + event fields for inbound distinction.
const BASE='https://api.salesrabbit.com';
const CAP=2000;
const ALIAS={'mike mccarthy':'michael mccarthy','izzy price':'isabelle price','robert mumford-wilson':'robert wilson'};
function tok(){const t=process.env.SALESRABBIT_TOKEN;if(!t)throw new Error('no token');return t;}
async function srGet(path,headers){const r=await fetch(BASE+path,{headers:Object.assign({Authorization:'Bearer '+tok(),Accept:'application/json'},headers||{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch(_){j=t}return {status:r.status,json:j};}
function arr(j){return Array.isArray(j)?j:(j&&(j.data||j.results||j.records||j.items))||[];}
function pick(o,ks){for(const k of ks){if(o&&o[k]!=null)return o[k];}return undefined;}
function norm(s){return String(s==null?'':s).trim().toLowerCase().replace(/\s+/g,' ');}
function repKey(n){const x=norm(n);return ALIAS[x]||x;}
function monthStart(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1);}
async function leadsSince(since){const out=[];const seen=new Set();const hdr={'If-Status-Modified-Since':since.toISOString()};for(let p=1;p<=60;p++){const r=await srGet('/leads?perPage='+CAP+'&page='+p,hdr);const ls=arr(r.json);if(!ls.length)break;for(const ld of ls){const id=pick(ld,['id']);if(id!=null&&seen.has(id))continue;if(id!=null)seen.add(id);out.push(ld);}if(ls.length<CAP)break;}return out;}
module.exports=async(req,res)=>{
 try{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  const start=monthStart();
  const leads=await leadsSince(start);
  const leadKeys=leads[0]?Object.keys(leads[0]):[];
  const pk=repKey('andrew prickel');
  const pl=leads.filter(ld=>repKey(pick(ld,['userName'])||'')===pk);
  const pkIds=pl.map(ld=>String(pick(ld,['id'])));
  // fetch histories to show Prickel lead event sequences
  const hist={};const hdr={'If-Status-Modified-Since':start.toISOString()};
  for(let p=1;p<=80;p++){const r=await srGet('/leadStatusHistories?perPage='+CAP+'&page='+p,hdr);const data=(r.json&&r.json.data)||{};const ids=Object.keys(data);if(!ids.length)break;ids.forEach(lid=>{if(pkIds.indexOf(lid)>-1)hist[lid]=(data[lid]||[]).map(e=>({name:e.name,by:e.changedByUserId,at:e.statusUpdated}));});if(ids.length<CAP)break;}
  const evKeys=(function(){for(const lid in hist){/*noop*/}return null;})();
  res.status(200).json({leadKeys, prickelLeadCount:pl.length, prickelLeadsSample:pl.slice(0,6).map(ld=>({id:ld.id,status:pick(ld,['status']),dateCreated:pick(ld,['dateCreated']),statusModified:pick(ld,['statusModified']),leadSource:pick(ld,['leadSource','source','campaign','origin']),full:JSON.stringify(ld).slice(0,500)})), prickelHistories:hist});
 }catch(e){res.status(500).json({error:String(e&&e.message||e)});}
};
