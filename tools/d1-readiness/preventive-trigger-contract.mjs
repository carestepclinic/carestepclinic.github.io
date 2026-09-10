// Independent local workerd/D1. No Wrangler, remote DB, credentials or Production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { EXPECTED_WORKER_SHA256, EXPECTED_A22_SHA256 } from '../verify-worker-source.mjs';
const source=readFileSync(new URL('../../worker.txt',import.meta.url),'utf8');
const a22=execFileSync(process.env.CARESTEP_GIT||'git',['show','c3ca52b186e5075fd712b233cf935b064a46e75c:worker.txt'],{encoding:'utf8',maxBuffer:5e6});
const hash=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
assert.equal(hash(source),EXPECTED_WORKER_SHA256);assert.equal(hash(a22),EXPECTED_A22_SHA256);
const name='trg_care_home_preventive_push_patient_delete',code='PREVENTIVE_PUSH_DELETE_TRIGGER_CONTRACT_MISMATCH';
const ddl='CREATE TRIGGER '+name+' AFTER DELETE ON care_patients BEGIN DELETE FROM care_home_preventive_push_deliveries WHERE patient_id = OLD.id; END';
const templates=text=>text.split(String.fromCharCode(96)).filter((_,i)=>i%2);
const patientDDL=templates(source).find(s=>s.startsWith('CREATE TABLE IF NOT EXISTS care_patients('));
const deliveryDDL=templates(source).find(s=>s.startsWith('CREATE TABLE IF NOT EXISTS care_home_preventive_push_deliveries('));
const patientDeleteSQL=templates(source).find(s=>s==='DELETE FROM care_patients WHERE id=?1 AND clinic_id=?2');
const mergeSQL=templates(source).find(s=>s==='UPDATE care_home_preventive_push_deliveries SET patient_id=?1 WHERE patient_id=?2');
assert.ok(patientDDL&&deliveryDDL&&patientDeleteSQL&&mergeSQL);
const results=[];let outboundAttempts=0;
async function dispatch(request,env){
  const b=await request.json(),api=b.legacy?old:b.cold?cold:first,trace=[];
  const DB={
    prepare(sql){
      const wrap=stmt=>({raw:stmt,sql,bind(...v){return wrap(stmt.bind(...v));},async all(){trace.push(sql);return stmt.all();},async first(...v){trace.push(sql);return stmt.first(...v);},async run(){trace.push(sql);return stmt.run();}});
      return wrap(env.DB.prepare(sql));
    },
    async batch(items){trace.push(...items.map(x=>x.sql));return env.DB.batch(items.map(x=>x.raw));}
  };
  try{
    if(Object.hasOwn(b,'definition'))return Response.json({ok:true,matches:api.preventivePushDeleteTriggerMatches(b.definition),trace});
    if(b.contract)await api.ensurePreventivePushDeleteTriggerSchema({DB},Boolean(b.inspectOnly));
    else await api.ensureSaasDb({DB});
    return Response.json({ok:true,trace});
  }catch(e){return Response.json({ok:false,code:e.code||'UNEXPECTED_TEST_ERROR',message:e.message,status:e.status,trace});}
}
const wrapper="import * as first from './first.mjs';\nimport * as cold from './cold.mjs';\nimport * as old from './old.mjs';\nexport default {fetch:"+dispatch.toString()+"};";
async function fixture(label){
  const mf=new Miniflare({
    cf:false,name:'preventive-'+label,host:'127.0.0.1',port:0,
    compatibilityDate:'2026-07-30',d1Databases:{DB:'synthetic-preventive-'+label},d1Persist:false,
    modules:[{type:'ESModule',path:'wrapper.mjs',contents:wrapper},
      ...['first','cold'].map(n=>({type:'ESModule',path:n+'.mjs',contents:source+'\nexport {ensureSaasDb,ensurePreventivePushDeleteTriggerSchema,preventivePushDeleteTriggerMatches};'})),
      {type:'ESModule',path:'old.mjs',contents:a22+'\nexport {ensureSaasDb};'}],
    outboundService(){outboundAttempts++;return new Response('Isolated: outbound denied',{status:403});}
  });
  const DB=await mf.getD1Database('DB');
  const q=async(sql,...v)=>(await DB.prepare(sql).bind(...v).all()).results;
  const call=async(body={})=>(await mf.dispatchFetch('http://localhost/test',{method:'POST',body:JSON.stringify(body)})).json();
  const init=async body=>{const r=await call(body);assert.equal(r.ok,true,JSON.stringify(r));return r;};
  const schema=()=>q("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE '_cf_%' ORDER BY type,name");
  return {mf,q,call,init,schema};
}
async function check(label,fn){
  let f;try{f=await fixture(label.replace(/\W/g,'-').slice(0,45));await fn(f);results.push({name:label,pass:true});}
  catch(error){results.push({name:label,pass:false,error:error.stack});}
  finally{if(f)await f.mf.dispose();}
}
const trigger=f=>f.q('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=? COLLATE NOCASE',name);
const writes=trace=>trace.filter(s=>/^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE)\b/i.test(s));
const creates=trace=>trace.filter(s=>/^CREATE TRIGGER/i.test(s)&&s.includes(name));
const base=async f=>{await f.q(patientDDL);await f.q(deliveryDDL);};
async function insert(f,table,values){
  const meta=await f.q('PRAGMA table_info('+table+')'),row={};
  for(const c of meta)if((c.notnull||c.pk)&&c.dflt_value===null)row[c.name]='fixture-'+c.name;
  Object.assign(row,values);
  await f.q('INSERT INTO '+table+'('+Object.keys(row).join(',')+') VALUES('+Object.keys(row).map(()=>'?').join(',')+')',...Object.values(row));
}
async function seed(f){
  for(const [id,clinic]of [['patient-A','clinic-A'],['patient-A2','clinic-A'],['patient-B','clinic-B']]){
    await insert(f,'care_patients',{id,clinic_id:clinic});
    await insert(f,'care_home_preventive_push_deliveries',{id:'delivery-'+id,patient_id:id,event_id:'event-'+id,reminder_group_key:clinic+':'+id,status:'sent',attempt_count:2});
  }
  // Initialization must not sweep pre-existing orphan evidence.
  await insert(f,'care_home_preventive_push_deliveries',{id:'orphan',patient_id:'missing-patient',event_id:'missing-event',reminder_group_key:'orphan',status:'failed'});
}
const snapshot=async f=>({
  patients:await f.q('SELECT * FROM care_patients ORDER BY id'),
  deliveries:await f.q('SELECT * FROM care_home_preventive_push_deliveries ORDER BY id'),
  patientColumns:await f.q('PRAGMA table_info(care_patients)'),
  deliveryColumns:await f.q('PRAGMA table_info(care_home_preventive_push_deliveries)')
});
function blocked(r){assert.equal(r.ok,false);assert.equal(r.code,code);assert.equal(r.message,code);assert.equal(r.status,503);}
await check('preserved A.2.2 identity, version and function/table inventory',async f=>{
  assert.equal(hash(a22),EXPECTED_A22_SHA256);
  const names=text=>[...text.matchAll(/^(?:async )?function\s+(\w+)\s*\(/gm)].map(m=>m[1]);
  assert.deepEqual(names(a22).filter(n=>!names(source).includes(n)),[]);
  assert.deepEqual(names(source).filter(n=>!names(a22).includes(n)),['preventivePushDeleteTriggerMatches','ensurePreventivePushDeleteTriggerSchema']);
  // VM regression separately compares function objects; here test version and tables independently.
  for(const n of ['CARESTEP_VERSION','CARESTEP_BUILD','EFSYNC_VERSION'])assert.ok(source.includes("const "+n+"='10.7-A.2.3';"));
  const tableNames=text=>[...text.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m=>m[1]);
  assert.deepEqual(tableNames(a22).filter(n=>!tableNames(source).includes(n)),[]);
});
await check('fresh full bootstrap creates trigger after both tables',async f=>{
  const r=await f.init(),t=await trigger(f);assert.equal(t.length,1);assert.equal(creates(r.trace).length,1);
  const at=r.trace.indexOf(creates(r.trace)[0]);
  for(const table of ['care_patients','care_home_preventive_push_deliveries'])assert.ok(r.trace.findIndex(s=>s.startsWith('CREATE TABLE IF NOT EXISTS '+table+'('))<at);
  assert.equal((await f.call({definition:t[0].sql})).matches,true);
});
await check('full A.2.2 legacy upgrade creates missing trigger and preserves rows PK metadata',async f=>{
  await f.init({legacy:true});assert.deepEqual(await trigger(f),[]);await seed(f);const before=await snapshot(f);
  const r=await f.init();assert.equal(creates(r.trace).length,1);assert.equal((await trigger(f)).length,1);assert.deepEqual(await snapshot(f),before);
});
await check('minimal legacy dependencies add only trigger with no data rewrite',async f=>{
  await base(f);await seed(f);const before=await snapshot(f),r=await f.init({contract:true});
  assert.equal(writes(r.trace).length,1);assert.equal(creates(r.trace).length,1);assert.deepEqual(await snapshot(f),before);
});
await check('existing canonical trigger full upgrade is byte-identical no-op',async f=>{
  await f.init({legacy:true});await f.q(ddl);await seed(f);const before=await snapshot(f),t=await trigger(f);
  const r=await f.init();assert.deepEqual(creates(r.trace),[]);assert.deepEqual(await trigger(f),t);assert.deepEqual(await snapshot(f),before);
});
const variants=[
 ['if-not-exists',ddl.replace('CREATE TRIGGER','CREATE TRIGGER IF NOT EXISTS')],
 ['lowercase',ddl.toLowerCase()],
 ['uppercase',ddl.toUpperCase()],
 ['whitespace',' \n'+ddl.replaceAll(' ','\t\n')+'\n'],
 ['for-each-row',ddl.replace(' BEGIN',' FOR EACH ROW BEGIN')],
 ['parentheses',ddl.replace('patient_id = OLD.id','((patient_id) = (OLD.id))')],
 ['reversed-equality',ddl.replace('patient_id = OLD.id','OLD.id = patient_id')],
 ['double-equals',ddl.replace('patient_id = OLD.id','patient_id == OLD.id')],
 ['qualified-column',ddl.replace('WHERE patient_id','WHERE care_home_preventive_push_deliveries.patient_id')]
];
for(const [label,left,right]of [['double-quotes','"','"'],['backticks',String.fromCharCode(96),String.fromCharCode(96)],['brackets','[',']']]){
  let v=ddl;for(const id of [name,'care_patients','care_home_preventive_push_deliveries','patient_id','OLD','id'])v=v.replace(new RegExp('\\b'+id+'\\b','g'),left+id+right);
  variants.push([label,v]);
}
for(const [label,sql]of variants)await check('equivalent stored '+label+' no-op',async f=>{
  await base(f);await f.q(sql);await seed(f);const before=await snapshot(f),schema=await f.schema();
  const r=await f.init({contract:true});assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);assert.deepEqual(await snapshot(f),before);
});
const mismatches=[
 ['before-delete',ddl.replace('AFTER DELETE','BEFORE DELETE')],
 ['after-update',ddl.replace('AFTER DELETE','AFTER UPDATE')],
 ['other-target',ddl.replace('ON care_patients','ON care_home_preventive_push_deliveries')],
 ['other-delete-table',ddl.replace('DELETE FROM care_home_preventive_push_deliveries','DELETE FROM care_patients')],
 ['no-where',ddl.replace(' WHERE patient_id = OLD.id','')],
 ['broadened-or',ddl.replace('patient_id = OLD.id','patient_id = OLD.id OR patient_id = patient_id')],
 ['wrong-old-column',ddl.replace('OLD.id','OLD.clinic_id')],
 ['extra-delete',ddl.replace('; END','; DELETE FROM care_patients; END')],
 ['extra-update',ddl.replace('; END','; UPDATE care_patients SET active=0; END')],
 ['extra-insert',ddl.replace('; END','; INSERT INTO care_home_preventive_push_deliveries(id) VALUES(OLD.id); END')],
 ['extra-select',ddl.replace('; END','; SELECT OLD.id; END')],
 ['when-condition',ddl.replace(' BEGIN',' WHEN OLD.active=1 BEGIN')]
];
for(const [label,sql]of mismatches)await check('stored '+label+' BLOCK before any schema or data write',async f=>{
  await base(f);await f.q(sql);await seed(f);const before=await snapshot(f),schema=await f.schema();
  const r=await f.call();blocked(r);assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);assert.deepEqual(await snapshot(f),before);
});
await check('trailing statement string and literals are rejected without SQL execution',async f=>{
  for(const sql of [ddl+'; DELETE FROM care_patients;',ddl+'; '+ddl,ddl.replace('patient_id = OLD.id',"'patient_id' = OLD.id"),ddl+' -- hidden',ddl.replace('WHERE patient_id','WHERE "patient_id; DELETE FROM care_patients"')]){
    const r=await f.call({definition:sql});assert.equal(r.matches,false);assert.deepEqual(r.trace,[]);
  }
});
for(const missing of ['care_patients','care_home_preventive_push_deliveries'])await check('missing '+missing+' blocks creation',async f=>{
  await f.q(missing==='care_patients'?deliveryDDL:patientDDL);const schema=await f.schema();
  blocked(await f.call({contract:true}));assert.deepEqual(await f.schema(),schema);assert.deepEqual(await trigger(f),[]);
});
await check('missing patient_id blocks before bootstrap index or trigger writes',async f=>{
  await f.q(patientDDL);await f.q(deliveryDDL.replace('patient_id TEXT NOT NULL,',''));const schema=await f.schema();
  const r=await f.call();blocked(r);assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);
});
await check('non-global patient PK blocks patient-only cleanup',async f=>{
  await f.q(patientDDL.replace('id TEXT PRIMARY KEY,','id TEXT NOT NULL,').replace(/\)$/,',PRIMARY KEY(clinic_id,id))'));await f.q(deliveryDDL);
  const schema=await f.schema(),r=await f.call({contract:true});blocked(r);assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);
});
await check('non-TEXT delivery patient_id blocks without redefining column',async f=>{
  await f.q(patientDDL);await f.q(deliveryDDL.replace('patient_id TEXT NOT NULL,','patient_id INTEGER NOT NULL,'));
  const schema=await f.schema(),r=await f.call({contract:true});blocked(r);assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);
});
await check('view dependency blocks without replacement',async f=>{
  await f.q(patientDDL);await f.q('CREATE VIEW care_home_preventive_push_deliveries AS SELECT id AS patient_id FROM care_patients');
  const schema=await f.schema(),r=await f.call({contract:true});blocked(r);assert.deepEqual(writes(r.trace),[]);assert.deepEqual(await f.schema(),schema);
});
await check('patient delete removes only its delivery and preserves other patients clinics orphan',async f=>{
  await f.init();await seed(f);const before=await snapshot(f);
  await f.q(patientDeleteSQL,'patient-A','clinic-A');const after=await snapshot(f);
  assert.deepEqual(after.patients,before.patients.filter(r=>r.id!=='patient-A'));
  assert.deepEqual(after.deliveries,before.deliveries.filter(r=>r.patient_id!=='patient-A'));
  assert.deepEqual(after.patientColumns,before.patientColumns);assert.deepEqual(after.deliveryColumns,before.deliveryColumns);
});
await check('foreign clinic delete cannot remove patient or delivery',async f=>{
  await f.init();await seed(f);const before=await snapshot(f);
  await f.q(patientDeleteSQL,'patient-A','clinic-B');assert.deepEqual(await snapshot(f),before);
});
await check('actual Worker merge UPDATE preserves moved deliveries after source delete',async f=>{
  await f.init();await seed(f);const before=await snapshot(f);
  await f.q(mergeSQL,'patient-A2','patient-A');await f.q(patientDeleteSQL,'patient-A','clinic-A');
  const after=await snapshot(f);
  assert.deepEqual(after.deliveries,before.deliveries.map(r=>r.patient_id==='patient-A'?{...r,patient_id:'patient-A2'}:r));
  assert.deepEqual(after.patients,before.patients.filter(r=>r.id!=='patient-A'));
});
await check('cold full upgrade repeat and direct contract repeat are idempotent',async f=>{
  await f.init({legacy:true});await seed(f);await f.init();const before=await snapshot(f),schema=await f.schema();
  const cold=await f.init({cold:true});assert.deepEqual(creates(cold.trace),[]);
  const direct=await f.init({contract:true});assert.deepEqual(writes(direct.trace),[]);
  assert.deepEqual(await snapshot(f),before);assert.deepEqual(await f.schema(),schema);
});
assert.equal(outboundAttempts,0);
console.log(JSON.stringify({environment:'Independent local nonpersistent workerd D1; synthetic only',workerSha256:hash(source),preservedA22Sha256:hash(a22),outboundAttempts,results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
