// api/amp-debug.js — TEMPORARY diagnostic (delete after use). Event-based, attributed to lead OWNER.
const BASE='https://api.salesrabbit.com';
const EXCL=new Set(['closed','donotknock','driveby']);
const CA=new Set(['ica','sgca']);
const CAP=2000;
const ALIAS={'mike mccarthy':'michael mccarthy','izzy price':'isabelle price','robert mumford-wilson':'robert wilson'};
function tok(){const t=process.env.SALESRABBIT_TOKEN;if(!t)throw new Error('no token');return t;}
async function srGet(path,headers){const r=await fetch(BASE+path,{headers:Object.assign({Authorization:'Bearer '+tok(),Accept:'application/json'},headers||{})});const t=await r.text();let j;try{j=JSON.parse(t)}catch(_){j=t}return {status:r.status,json:j};}
function arr(j){return Array.isArray(j)?j:(j&&(j.data||j.results||j.records||j.items))||[];}
function pick(o,ks){for(const k of ks){if(o&&o[k]!=null)return o[k];}return undefined;}
function norm(s){return String(s==null?'':s).trim().toLowerCase().replace(/\s+/g,' ');}
function statusNorm(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function repKey(n){const x=norm(n);return ALIAS[x]||x;}
function teamAllowed(t){const n=norm(t);return n.indexOf('inbound')>-1||(n.indexOf('self')>-1&&n.indexOf('gen')>-1);}
function monthStart(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1);}
async function leadsSince(since){const out=[];const seen=new Set();const hdr={'If-Status-Modified-Since':since.toISOString()};for(let p=1;p<=60;p++){const r=await srGet('/leads?perPage='+CAP+'&page='+p,hdr);const ls=arr(r.json);if(!ls.length)break;for(const ld of ls){const id=pick(ld,['id']);if(id!=null&&seen.has(id))continue;if(id!=null)seen.add(id);out.push(ld);}if(ls.length<CAP)break;}return out;}
module.exports=async(req,res)=>{
 try{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  const start=monthStart();
  const us=arr((await srGet('/users')).json);
  const allowed=new Set();const disp={};
  us.forEach(u=>{const name=pick(u,['fullName'])||[pick(u,['firstName','first']),pick(u,['lastName','last'])].filter(Boolean).join(' ').trim()||pick(u,['name','email'])||'';const rk=repKey(name);if(teamAllowed(pick(u,['team'])||'')&&pick(u,['active'])!==false){allowed.add(rk);disp[rk]=name;}});
  const leads=await leadsSince(start);
  const owner={};leads.forEach(ld=>{owner[String(pick(ld,['id']))]=repKey(pick(ld,['userName'])||'');});
  const doorsO={},doorsC={},caSet={};let evMonth=0;
  const hdr={'If-Status-Modified-Since':start.toISOString()};
  for(let p=1;p<=80;p++){
   const r=await srGet('/leadStatusHistories?perPage='+CAP+'&page='+p,hdr);
   const data=(r.json&&r.json.data)||{};const ids=Object.keys(data);if(!ids.length)break;
   ids.forEach(lid=>{const ork=owner[lid];if(!ork||!allowed.has(ork))return;(data[lid]||[]).forEach(ev=>{const d=new Date(ev.statusUpdated||0);if(isNaN(d)||d<start)return;evMonth++;const st=statusNorm(ev.name);doorsO[ork]=(doorsO[ork]||0)+1;if(!EXCL.has(st))doorsC[ork]=(doorsC[ork]||0)+1;if(CA.has(st)){(caSet[ork]=caSet[ork]||new Set()).add(lid);}});});
   if(ids.length<CAP)break;
  }
  const keys=new Set([].concat(Object.keys(doorsO),Object.keys(caSet)));
  const reps=Array.from(keys).map(rk=>({rep:disp[rk]||rk,doorsAll:doorsO[rk]||0,doorsExcl:doorsC[rk]||0,ca:(caSet[rk]?caSet[rk].size:0)})).sort((a,b)=>b.doorsExcl-a.doorsExcl);
  const sum=k=>reps.reduce((s,r)=>s+r[k],0);
  res.status(200).json({month:start.toISOString().slice(0,7),evMonth,leadCnt:leads.length,totals:{doorsAll:sum('doorsAll'),doorsExcl:sum('doorsExcl'),ca:sum('ca')},reps});
 }catch(e){res.status(500).json({error:String(e&&e.message||e)});}
};
