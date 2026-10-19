import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const org=readFileSync(new URL('../clinic-organization.js',import.meta.url),'utf8');
const care=readFileSync(new URL('../clinic-care.js',import.meta.url),'utf8');
function organization(extra={}){const c=vm.createContext({module:{exports:{}},...extra});vm.runInContext(org,c);return {c,model:c.module.exports};}
test('only a successfully loaded identical consultation is removed from the clinical tab',()=>{
 const {model}=organization(),rows=[{id:'same',sourceType:'home',responseCode:'concern'},{id:'other',sourceType:'home',responseCode:'concern'},{id:'same',sourceType:'message'},{id:'same',sourceType:'visit'}];
 assert.deepEqual(Array.from(model.clinicalRows(rows,{state:'ready',items:[{id:'same'}]}),r=>r.sourceType+':'+r.id),['home:other','message:same','visit:same']);
 for(const state of ['loading','failed'])assert.equal(model.clinicalRows(rows,{state,items:[{id:'same'}]}).length,4);
 assert.equal(model.clinicalRows(rows,null).length,4);assert.equal(rows.length,4);
});
test('both tab counts distinguish zero from failed, loading, and unavailable reads',()=>{
 const nodes={'clinicToday-tab-attention':{},'clinicToday-tab-clinical':{}};
 const {c,model}=organization({document:{readyState:'loading',addEventListener(){},getElementById:id=>nodes[id]}});
 c.carestepAttentionSummary=()=>({state:'ready',total:0});c.carestepClinicalSummary=()=>({state:'ready',total:7});model.updateTodayCounts();assert.match(nodes['clinicToday-tab-attention'].textContent,/0항목/);assert.match(nodes['clinicToday-tab-clinical'].textContent,/7항목/);
 for(const [state,label] of [['failed','조회 실패'],['loading','확인 중'],['unavailable','이용 불가']]){c.carestepClinicalSummary=()=>({state,total:0});model.updateTodayCounts();assert.match(nodes['clinicToday-tab-clinical'].textContent,new RegExp(label));assert.doesNotMatch(nodes['clinicToday-tab-clinical'].textContent,/0항목/);}
});
test('publication notices never infer an attempt, receipt, or reading from an absent result',()=>{
 const {model}=organization();assert.match(model.noticeLabel(null),/결과 확인 불가/);assert.doesNotMatch(model.noticeLabel(null),/전달 시도|접수 0/);
 assert.match(model.noticeLabel({skipped:'push_unavailable'}),/시도하지 않음/);assert.match(model.noticeLabel({accepted:0,failed:0,attempted:0}),/발송 대상 없음/);assert.match(model.noticeLabel({accepted:0,failed:0}),/시도 여부 확인 필요/);
 assert.match(model.noticeLabel({accepted:2,failed:1,unconfirmed:1}),/접수 2건.*실패 1건.*결과 미확정 1건/);
 assert.match(model.noticeLabel({accepted:2,failed:1}),/열람은 별도/);assert.match(model.noticeLabel({accepted:'2',failed:0}),/확인 불가/);
});
test('single-drug changes update the common registration draft and preserve other drugs',()=>{
 const input={name:'A',dose:'2정',times:'09:00, 21:00'},rows=[{name:'A',dose:'1정'},{name:'B',dose:'3정'}];
 const c=vm.createContext({registrationMeds:rows,importIndex:0,importLoading:false,registrationOptions:new Map(),editor:{get:()=>input},field:k=>({value:{start:'2026-10-20',interval:'1',firstDoseTime:'21:00'}[k],checked:k==='timeRestricted'})});
 const a=care.indexOf('function syncRegistration(){'),b=care.indexOf(' const editor=homeMedicationEditor',a);vm.runInContext(care.slice(a,b),c);c.syncRegistration();assert.equal(rows[0].dose,'2정');assert.equal(rows[1].dose,'3정');assert.notEqual(rows[0],input);assert.equal(c.registrationOptions.get(0).firstDoseTime,'21:00');c.importLoading=true;input.dose='9정';c.syncRegistration();assert.equal(rows[0].dose,'2정');
});
test('batch registration carries the shared dose, start, first dose, interval and restriction',()=>{
 const c=vm.createContext({crypto:{randomUUID:()=> 'fixture-request'}});vm.runInContext(care.slice(care.indexOf('function createRegistrationBatch('),care.indexOf('async function runMedicationBatch(')),c);
 const meds=[{name:'A',dose:'2정',frequency:'하루 2회'},{name:'B',frequency:'EOD'}],options=new Map([[0,{start:'2026-10-21',interval:3,firstDoseTime:'21:00',restricted:true}]]),queue=c.createRegistrationBatch(meds,options,'2026-10-20');assert.equal(queue[0].m.dose,'2정');assert.equal(queue[0].start,'2026-10-21');assert.equal(queue[0].firstDoseTime,'21:00');assert.equal(queue[0].interval,3);assert.equal(queue[0].restricted,true);assert.equal(queue[1].interval,2);assert.equal(queue[1].firstDoseTime,'');assert.notEqual(queue[0].m,meds[0]);
});
test('evening first dose matches its extended course instead of falsely reporting missing registration',()=>{
 const c=vm.createContext({parseMedTimes:s=>String(s).split(',').map(t=>t.trim()).sort()});vm.runInContext(care.slice(care.indexOf('function homeMedicationPayload('),care.indexOf('function createRegistrationBatch(')),c);vm.runInContext(care.slice(care.indexOf('function matchingPrescriptionPlan('),care.indexOf('async function medicationPublicationReminder(')),c);
 const m={name:'A',dose:'1정',frequency:'하루 2회',duration:3,times:'08:00, 20:00'},payload=c.homeMedicationPayload(m,'2026-10-20',1,'20:00'),plan={...payload,active:true};assert.equal(payload.endDate,'2026-10-23');assert.equal(c.matchingPrescriptionPlan([plan],m,'2026-10-20',1),plan);assert.equal(c.matchingPrescriptionPlan([plan],{...m,dose:'2정'},'2026-10-20',1),null);
});
