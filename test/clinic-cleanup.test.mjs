import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../clinic-care.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function matchingPrescriptionPlan('),source.indexOf('function buttons('));
async function reminder(medications,plans){
 const notes=[],host={hidden:false,isConnected:true,querySelector:()=>null,append:n=>notes.push(n)};
 const c=vm.createContext({selected:()=>({patientId:'p'}),patientScope:()=> 'p',window:{crmCurrentPatient:()=>({patientId:'p'})},medications,document:{createElement:()=>({dataset:{},setAttribute(){}})},api:async()=>({plans}),homeMedicationPayload:m=>m,findMatchingMedicationPlan:(ps,m)=>ps.find(p=>p.name===m.name),today:()=> '2026-10-19'});
 vm.runInContext(code,c);await c.medicationPublicationReminder(host);return notes[0]?.textContent;
}
test('publication with no medication draft never claims a schedule was registered',async()=>{assert.match(await reminder([],[]),/대조할 처방 없음/);});
test('publication identifies missing medication plans independently from PDF success',async()=>{assert.match(await reminder([{name:'A'},{name:'B'}],[{name:'A'}]),/1종 미등록 또는 대조 필요/);});
test('publication confirms only plans matching every named medication',async()=>{assert.match(await reminder([{name:'A'}],[{name:'A'}]),/일치하는 등록 일정 확인 완료/);});
