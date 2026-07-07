// api/amp-debug.js — TEMPORARY diagnostic (delete after use). Compares doors/CA counting defs vs Amplify.
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
  const us=arr((await srGet('/users')).json).map(u=>({name:pick(u,['fullName'])||pick(u,['name','email'])||'',team:pick(u,['team'])||'',active:pick(u,['active'])}));
  const allowedUsers=us.filter(u=>teamAllowed(u.team)&&u.active!==false);
  const allowed=new Set(allowedUsers.map(u=>repKey(u.name)));
  const disp={};allowedUsers.forEach(u=>{disp[repKey(u.name)]=u.name;});
  const leads=await leadsSince(start);
  const A={},B={},C={},CAcur={},CAdc={};const statusDist={};const seen=new Set();
  leads.forEach(ld=>{
   const rk=repKey(pick(ld,['userName'])||'');if(!allowed.has(rk))return;
   const id=pick(ld,['id']);if(id!=null){if(seen.has(id))return;seen.add(id);}
   const sm=new Date(pick(ld,['statusModified'])||0);const dc=new Date(pick(ld,['dateCreated'])||0);const st=statusNorm(pick(ld,['status']));
   const inSM=!isNaN(sm)&&sm>=start;const inDC=!isNaN(dc)&&dc>=start;
   if(inSM&&!EXCL.has(st))A[rk]=(A[rk]||0)+1;
   if(inDC)B[rk]=(B[rk]||0)+1;
   if(inDC&&!EXCL.has(st))C[rk]=(C[rk]||0)+1;
   if(CA.has(st)&&inSM)CAcur[rk]=(CAcur[rk]||0)+1;
   if(CA.has(st)&&inDC)CAdc[rk]=(CAdc[rk]||0)+1;
   if(inDC){const raw=pick(ld,['status'])||'?';statusDist[raw]=(statusDist[raw]||0)+1;}
  });
  const reps=Array.from(allowed).map(rk=>({rep:disp[rk]||rk,A:A[rk]||0,B:B[rk]||0,C:C[rk]||0,CAcur:CAcur[rk]||0,CAdc:CAdc[rk]||0})).filter(r=>r.A||r.B||r.C).sort((a,b)=>b.B-a.B);
  const sum=k=>reps.reduce((s,r)=>s+r[k],0);
  res.status(200).json({month:start.toISOString().slice(0,7),leadsScanned:leads.length,totals:{A:sum('A'),B:sum('B'),C:sum('C'),CAcur:sum('CAcur'),CAdc:sum('CAdc')},reps,statusDist});
 }catch(e){res.status(500).json({error:String(e&&e.message||e)});}
};
