// Independent nonpersistent workerd/D1 databases. No Production config or credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { EXPECTED_WORKER_SHA256, EXPECTED_A2_SHA256 } from '../verify-worker-source.mjs';
const source=readFileSync(new URL('../../worker.txt',import.meta.url),'utf8');
const audit=readFileSync(new URL('../../incoming/worker-v10.7-A.2.txt',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
assert.equal(hash(source),EXPECTED_WORKER_SHA256);assert.equal(hash(audit),EXPECTED_A2_SHA256);
const templates=text=>text.split(String.fromCharCode(96)).filter((_,i)=>i%2);
const table=text=>templates(text).find(s=>s.startsWith('CREATE TABLE IF NOT EXISTS care_followup_cases('));
const oldDDL=table(audit),newDDL=table(source);
const insertSQL=templates(source).find(s=>s.startsWith('INSERT INTO care_followup_cases(id,clinic_id,case_key,message_case_key,patient_id,guardian_id,journey_id,journey_version,'));
const updateSQL=templates(source).find(s=>s.startsWith('UPDATE care_followup_cases SET assignee_user_id='));
assert.ok(oldDDL&&newDDL&&insertSQL&&updateSQL);
const columns=['assignee_user_id','vet_user_id'],results=[];
let outboundAttempts=0;
async function dispatch(request,env){
  const b=await request.json(),api=b.cold?cold:first,trace=[];
  const DB={
    prepare(sql){
      const wrap=stmt=>({raw:stmt,sql,bind(...v){return wrap(stmt.bind(...v));},async all(){trace.push(sql);return stmt.all();},async first(...v){trace.push(sql);return stmt.first(...v);},async run(){trace.push(sql);return stmt.run();}});
      return wrap(env.DB.prepare(sql));
    },
    async batch(items){trace.push(...items.map(x=>x.sql));return env.DB.batch(items.map(x=>x.raw));}
  };
  try{
    if(b.contract)await api.ensureFollowupCaseAssignmentSchema({DB});
    else await api.ensureSaasDb({DB});
    return Response.json({ok:true,trace});
  }catch(e){return Response.json({ok:false,code:e.code||'UNEXPECTED_TEST_ERROR',message:e.message,trace});}
}
const wrapper="import * as first from './first.mjs';\nimport * as cold from './cold.mjs';\nexport default {fetch:"+dispatch.toString()+"};";
async function fixture(label){
  const mf=new Miniflare({
    cf:false,name:'assignment-'+label,host:'127.0.0.1',port:0,
    compatibilityDate:'2026-07-30',d1Databases:{DB:'synthetic-assignment-'+label},d1Persist:false,
    modules:[{type:'ESModule',path:'wrapper.mjs',contents:wrapper},...['first','cold'].map(name=>({type:'ESModule',path:name+'.mjs',contents:source+'\nexport {ensureSaasDb,ensureFollowupCaseAssignmentSchema};'}))],
    outboundService(){outboundAttempts++;return new Response('Isolated: outbound denied',{status:403});}
  });
  const DB=await mf.getD1Database('DB');
  const q=async(sql,...v)=>(await DB.prepare(sql).bind(...v).all()).results;
  const call=async(body={})=>(await mf.dispatchFetch('http://localhost/test',{method:'POST',body:JSON.stringify(body)})).json();
  const init=async body=>{const r=await call(body);assert.equal(r.ok,true,JSON.stringify(r));return r;};
  return {mf,q,call,init};
}
async function check(name,fn){
  let f;
  try{f=await fixture(name.replace(/\W/g,'-').slice(0,45));await fn(f);results.push({name,pass:true});}
  catch(error){results.push({name,pass:false,error:error.stack});}
  finally{if(f)await f.mf.dispose();}
}
const stamp='2026-09-08T00:00:00Z';
async function insert(f,clinic='clinic-A',id='case-A'){
  await f.q(insertSQL,id,clinic,id,'',clinic+'-patient',clinic+'-guardian','',0,'','2026-09-08','[0,7]','active',1,'','','','not_started','{}','','',clinic+'-actor',stamp);
}
const info=f=>f.q('PRAGMA table_info(care_followup_cases)');
const rows=f=>f.q('SELECT * FROM care_followup_cases ORDER BY id');
const pk=async f=>(await info(f)).filter(x=>x.pk).map(({name,pk})=>({name,pk}));
function contract(meta){
  for(const name of columns){const c=meta.find(x=>x.name===name);assert.ok(c,name);assert.equal(c.type,'TEXT');assert.equal(c.notnull,1);assert.equal(c.pk,0);assert.equal(c.dflt_value,"''");}
}
const adds=trace=>trace.filter(s=>/^ALTER TABLE care_followup_cases ADD COLUMN /.test(s));
const oldProjection=list=>list.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!columns.includes(key))));
await check('fresh full bootstrap guarantees both columns and contract',async f=>{
  const r=await f.init();contract(await info(f));assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await f.q('PRAGMA foreign_key_list(care_followup_cases)'),[]);
});
await check('unchanged Worker INSERT omits assignments and gets empty defaults',async f=>{
  await f.init();await insert(f);const [r]=await rows(f);assert.equal(r.assignee_user_id,'');assert.equal(r.vet_user_id,'');assert.equal(r.revision,1);
});
await check('actual assignment UPDATE preserves foreign clinic',async f=>{
  await f.init();await insert(f);await insert(f,'clinic-B','case-B');const before=(await rows(f))[1];
  await f.q(updateSQL,'clinic-A-assignee','clinic-A-vet','clinic-A-actor',stamp,'case-A');
  const [a,b]=await rows(f);assert.equal(a.assignee_user_id,'clinic-A-assignee');assert.equal(a.vet_user_id,'clinic-A-vet');assert.equal(a.revision,2);assert.deepEqual(b,before);
});
await check('legacy 24-column full upgrade preserves rows and original PK',async f=>{
  await f.q(oldDDL);await insert(f);const before=await rows(f),beforePK=await pk(f);
  const r=await f.init();contract(await info(f));assert.equal(adds(r.trace).length,2);
  assert.ok(r.trace.findIndex(s=>s.startsWith('CREATE TABLE IF NOT EXISTS care_followup_cases('))<r.trace.findIndex(s=>s.startsWith('ALTER TABLE care_followup_cases')));
  assert.deepEqual(oldProjection(await rows(f)),before);assert.deepEqual(await pk(f),beforePK);
  assert.equal(r.trace.some(s=>/^(UPDATE|DELETE FROM|REPLACE INTO) care_followup_cases\b/.test(s)),false);
});
for(const present of columns){
  await check('partial upgrade preserves existing '+present,async f=>{
    await f.q(oldDDL);await f.q("ALTER TABLE care_followup_cases ADD COLUMN "+present+" TEXT NOT NULL DEFAULT ''");
    await insert(f);await f.q('UPDATE care_followup_cases SET '+present+'=? WHERE id=?','existing-owner','case-A');
    const before=await rows(f),r=await f.init();contract(await info(f));assert.equal(adds(r.trace).length,1);assert.ok(!adds(r.trace)[0].includes('ADD COLUMN '+present+' '));
    const after=await rows(f);for(const [key,value]of Object.entries(before[0]))assert.equal(after[0][key],value);
  });
}
await check('already-compatible columns no-op preserving assigned users',async f=>{
  await f.q(newDDL);await insert(f);await f.q(updateSQL,'owner','vet','actor',stamp,'case-A');
  const before=await rows(f),beforeInfo=await info(f),r=await f.init();
  assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await rows(f),before);assert.deepEqual(await info(f),beforeInfo);
});
await check('cold repeat preserves all schema and data',async f=>{
  await f.q(oldDDL);await insert(f);await f.init();
  const before=await rows(f),schema=await f.q("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE '_cf_%' ORDER BY type,name");
  const r=await f.init({cold:true});assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await rows(f),before);
  assert.deepEqual(await f.q("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE '_cf_%' ORDER BY type,name"),schema);
});
for(const kind of ['type','nullable','default','pk']){
  await check('existing incompatible '+kind+' blocks without mutation',async f=>{
    let ddl=newDDL;
    const replacement={type:"assignee_user_id INTEGER NOT NULL DEFAULT ''",nullable:"assignee_user_id TEXT DEFAULT ''",default:"assignee_user_id TEXT NOT NULL DEFAULT 'unexpected'",pk:"assignee_user_id TEXT PRIMARY KEY NOT NULL DEFAULT ''"}[kind];
    if(kind==='pk')ddl=ddl.replace('id TEXT PRIMARY KEY,','id TEXT NOT NULL,');
    ddl=ddl.replace("assignee_user_id TEXT NOT NULL DEFAULT ''",replacement);
    await f.q(ddl);await insert(f);const before=await rows(f),schema=await info(f),r=await f.call({contract:true});
    assert.equal(r.ok,false);assert.equal(r.code,'FOLLOWUP_ASSIGNMENT_SCHEMA_CONTRACT_MISMATCH');
    assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await rows(f),before);assert.deepEqual(await info(f),schema);
  });
}
await check('incompatible partial blocks before adding other column',async f=>{
  await f.q(oldDDL);await f.q("ALTER TABLE care_followup_cases ADD COLUMN assignee_user_id TEXT");await insert(f);
  const before=await rows(f),schema=await info(f),r=await f.call({contract:true});
  assert.equal(r.ok,false);assert.equal(r.code,'FOLLOWUP_ASSIGNMENT_SCHEMA_CONTRACT_MISMATCH');
  assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await rows(f),before);assert.deepEqual(await info(f),schema);
});
await check('equivalent parenthesized empty defaults no-op',async f=>{
  const ddl=newDDL.replace("assignee_user_id TEXT NOT NULL DEFAULT ''","assignee_user_id text NOT NULL DEFAULT ('')").replace("vet_user_id TEXT NOT NULL DEFAULT ''","vet_user_id text NOT NULL DEFAULT ((''))");
  await f.q(ddl);const before=await info(f),r=await f.init({contract:true});assert.deepEqual(adds(r.trace),[]);assert.deepEqual(await info(f),before);
});
assert.equal(outboundAttempts,0);
console.log(JSON.stringify({environment:'Independent local nonpersistent workerd D1; synthetic only',workerSha256:hash(source),auditSha256:hash(audit),outboundAttempts,results,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
