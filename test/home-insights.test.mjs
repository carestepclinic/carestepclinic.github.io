import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../home-insights.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../carestep-home.js',import.meta.url),'utf8');
function models(){const c=vm.createContext({});vm.runInContext(code,c);return c.carestepInsightModels;}
function fixture(){return {base:{token:'s',home:{connections:[{clinicName:'가상 병원',patients:[{id:'p',name:'가상 환자'}]}]}},care:{token:'s',patientId:'p',publicGroup:{p:{id:'p'},date:'2026-10-18',timelineLoadedAt:'2026-10-18T03:00:00Z',events:[],plans:[],doses:[]}},shared:{token:'s',materials:[],followups:[],materialState:'ready',followupState:'ready'}};}
const model=(f,days=7)=>models().insightModel(f.base,f.care,f.shared,days,'2026-10-18');
const event=(id,date,type='weight',more={})=>({id,eventDate:date,type,source:'home',value:4,...more});
test('inclusive 7/30 day summaries exclude future and invalid dates, deduplicate IDs and separate missing days',()=>{
 const m=models(),items=[event('a','2026-10-12'),event('b','2026-10-18'),event('b','2026-10-18'),event('old','2026-10-11'),event('future','2026-10-19'),event('bad','2026-02-30'),event('c','2026-10-18','appetite')];
 const r=m.recentRecords(items,'p',7,'2026-10-18');assert.equal(r.from,'2026-10-12');assert.equal(r.items.length,3);assert.equal(r.recordedDays,2);assert.equal(r.missingDays,5);assert.equal(m.recentRecords(items,'p',30,'2026-10-18').from,'2026-09-19');
 assert.equal(m.recentRecords([],'p',7,'2026-03-01').from,'2026-02-23');assert.equal(m.recentRecords([],'p',7,'2024-03-01').from,'2024-02-24');
});
test('zero records remain missing, and the 500 record cap explicitly marks partial aggregation',()=>{
 const m=models();assert.equal(m.recentRecords([],'p',7,'2026-10-18').missingDays,7);const all=Array.from({length:500},(_,i)=>event(String(i),'2026-10-18'));assert.equal(m.recentRecords(all,'p',30,'2026-10-18').partial,true);
});
test('weight compares latest measurement per day in kg and never fabricates a trend from one day',()=>{
 const m=models(),r=m.recentRecords([event('a','2026-10-12','weight',{value:5}),event('b','2026-10-18','weight',{value:4.7,createdAt:'2026-10-18T04:00:00Z'}),event('c','2026-10-18','weight',{value:4.6,createdAt:'2026-10-18T05:00:00Z'}),event('wrong','2026-10-18','weight',{value:15,unit:'lb'}),event('empty','2026-10-17','weight',{value:''})],'p',7,'2026-10-18');
 assert.equal(r.samples.length,2);assert.equal(r.last.value,4.6);assert.equal(r.difference,-0.4);assert.equal(m.recentRecords([event('a','2026-10-18')],'p',7,'2026-10-18').difference,null);
});
test('symptom records count entries not occurrence values; hospital records do not count as home logging days',()=>{
 const r=models().recentRecords([event('v','2026-10-18','vomiting',{value:3}),event('w','2026-10-17','weight',{source:'clinic'}),event('free','2026-10-18','medication')],'p',7,'2026-10-18');assert.equal(r.recordedDays,1);assert.equal(r.counts.find(c=>c.type==='vomiting').count,1);assert.equal(r.counts.find(c=>c.type==='medication').count,1);
});
test('canceled, explicitly private and foreign patient records never contribute',()=>{
 const r=models().recentRecords([event('good','2026-10-18'),event('c','2026-10-18','weight',{status:'canceled'}),event('p','2026-10-18','weight',{homeVisible:false}),event('p2','2026-10-18','weight',{home_visible:0}),event('f','2026-10-18','weight',{patientId:'other'})],'p',7,'2026-10-18');assert.equal(r.items.length,1);
});
test('consent, membership, inactive patient and login boundaries fail closed',()=>{
 for(const mutate of [f=>f.base.token='',f=>f.care.token='old',f=>f.shared.token='old',f=>f.base.home.consentRequired=true,f=>f.base.home.connections=[],f=>f.care.patientId='other',f=>f.base.home.connections[0].patients[0].active=false]){const f=fixture();mutate(f);assert.equal(model(f),null);}
});
test('only selected patient data is shown and newer patient timeline supersedes dashboard cache',()=>{
 const f=fixture();f.care.publicGroup.events=[event('old','2026-10-12')];f.shared.timeline={patientId:'p',events:[event('fresh','2026-10-18')],at:Date.parse('2026-10-18T04:00:00Z')};assert.equal(model(f).events[0].id,'fresh');f.shared.timeline.patientId='other';assert.equal(model(f).events[0].id,'old');f.care.publicGroup.p.id='other';assert.equal(model(f).events.length,0);
});
test('failure/loading are carried explicitly rather than being presented as healthy empty state',()=>{
 const f=fixture();f.care.publicGroup.timelineFailed=true;assert.equal(model(f).failed,true);f.shared.timeline={patientId:'p',events:[],at:0,loading:true};assert.equal(model(f).loading,true);f.shared.timeline={patientId:'p',events:[],at:0,failed:true};assert.equal(model(f).failed,true);
});
test('visit view uses dated public visits and nearest valid recheck, with no inferred visit-medication relationship',()=>{
 const f=fixture();f.care.publicGroup.events=[event('v','2026-10-17','visit',{source:'efriends',homeNote:'공개 안내',note:'내부 메모',nextDueDate:'2026-10-23'}),event('r','2026-10-16','recheck',{source:'clinic',nextDueDate:'2026-10-20'}),event('future','2026-10-19','visit',{source:'clinic'})];const out=model(f);assert.equal(out.visits.length,2);assert.equal(out.recheck.id,'r');assert.equal(out.visits[0].homeNote,'공개 안내');assert.equal(out.visits[0].plans,undefined);
});
test('guides exclude replacement, foreign and non-guidance material and keep exact original IDs',()=>{
 const f=fixture();f.shared.materials=[{key:'p|a',patientId:'p',kind:'disease',title:'질환안내',sentAt:'2026-10-18T00:00:00Z'},{key:'p|old',patientId:'p',kind:'disease',replacementId:'a'},{key:'other|a',patientId:'other',kind:'disease'},{key:'p|med',patientId:'p',kind:'medication'}];f.shared.followups=[{id:'exact',patientId:'p',title:'스케일링'},{id:'wrong',patientId:'other',title:'췌장염'},{id:'cancel',patientId:'p',status:'canceled'}];const out=model(f);assert.equal(out.materials.length,1);assert.equal(out.materials[0].key,'p|a');assert.deepEqual(Array.from(out.followups,f=>f.id),['exact']);
});
test('today medication totals never include another date/patient or fabricate 7/30 day compliance',()=>{
 const f=fixture();f.care.publicGroup.doses=[{date:'2026-10-18',taken:true},{date:'2026-10-17',taken:true},{date:'2026-10-18',patientId:'other',taken:true}];assert.equal(model(f).doses.length,1);f.care.publicGroup.date='2026-10-17';assert.equal(model(f).medicationReady,false);f.care.publicGroup.medicationFailed=true;assert.equal(model(f).plans.length,0);
});
test('a detached old button cannot act after account or selected patient changes',()=>{
 const calls=[],f=fixture(),c=vm.createContext({scope:'s|p',period:7,inputs:()=>f,insightModel:models().insightModel});vm.runInContext(code.slice(code.indexOf('  function guard('),code.indexOf('  function records(')),c);const action=c.guard({pid:'p'},()=>calls.push('opened'));action();assert.equal(calls.length,1);f.base.token=f.care.token=f.shared.token='new';c.scope='new|p';action();assert.equal(calls.length,1);
});
test('exact guide navigation does not pick a different Journey and rejects changed membership',()=>{
 const called=[],detail={dataset:{followupDetails:'right'},open:false,scrollIntoView(){called.push('right');},querySelector:()=>null};const c=vm.createContext({window:{carestepHomeSelectedPatient:'p',carestepHomeNavigation:{go(){}}},state:{token:'s',home:{},followups:[{id:'wrong',patientId:'other'},{id:'right',patientId:'p'}]},patientContext:()=>({}),renderFollowups(){},$:id=>id==='homeFollowupList'?{querySelectorAll:()=>[detail]}:null});
 vm.runInContext(core.slice(core.indexOf('  window.carestepOpenHomeGuide='),core.indexOf('  async function loadMaterialSources(')),c);assert.equal(c.window.carestepOpenHomeGuide('p','wrong'),false);assert.equal(c.window.carestepOpenHomeGuide('p','right'),true);assert.deepEqual(called,['right']);c.patientContext=()=>null;assert.equal(c.window.carestepOpenHomeGuide('p','right'),false);
});
test('material shortcut opens only the exact currently authorized source and never marks other materials',()=>{
 const calls=[],card={querySelector:()=>({click:()=>calls.push('pdf')})},c=vm.createContext({insightMaterialIndex:new Map([['p|a',{card,meta:{patientId:'p'}}]]),insightMaterialToken:'s',state:{token:'s'},patientContext:()=>({}),window:{carestepHomeSelectedPatient:'p',carestepHomeNavigation:{go(){}},carestepHomeMaterialReveal:()=>true}});
 vm.runInContext(core.slice(core.indexOf('  window.carestepOpenHomeMaterial='),core.indexOf('  window.carestepOpenHomeGuide=')),c);assert.equal(c.window.carestepOpenHomeMaterial('p','missing'),false);assert.equal(c.window.carestepOpenHomeMaterial('other','p|a'),false);assert.equal(c.window.carestepOpenHomeMaterial('p','p|a'),true);assert.deepEqual(calls,['pdf']);c.state.token='new';assert.equal(c.window.carestepOpenHomeMaterial('p','p|a'),false);
});
