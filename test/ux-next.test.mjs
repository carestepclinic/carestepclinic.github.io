import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../home-care.js',import.meta.url),'utf8'),clinic=readFileSync(new URL('../clinic-care.js',import.meta.url),'utf8');
const ctx=vm.createContext({Date,JSON,Number});
vm.runInContext(home.slice(home.indexOf('function nextMedicationSummary('),home.indexOf('function setPushStatus('))+clinic.slice(clinic.indexOf('function findMatchingMedicationPlan('),clinic.indexOf('function homeMedicationEditor(')),ctx);
test('next dose is selected across patients, excluding completed and past-day records',()=>{
 const groups=[{p:{name:'가상 A'},doses:[{date:'2026-10-16',time:'20:00',taken:false,label:'A'},{date:'2026-10-16',time:'08:00',taken:false},{date:'2026-10-16',time:'19:00',taken:true}]},{p:{name:'가상 B'},doses:[{date:'2026-10-16',time:'18:00',taken:false,label:'B'},{date:'2026-10-15',time:'23:55',taken:false}]}];
 const result=ctx.nextMedicationSummary(groups,Date.parse('2026-10-16T17:00:00+09:00'));assert.equal(result.pending,3);assert.equal(result.overdue,1);assert.equal(result.next.patientName,'가상 B');assert.equal(result.next.time,'18:00');
});
test('overdue records are counted but never selected as next medication',()=>{const r=ctx.nextMedicationSummary([{p:{name:'A'},doses:[{date:'2026-10-16',time:'08:00',taken:false}]}],Date.parse('2026-10-16T17:00:00+09:00'));assert.equal(r.next,undefined);assert.equal(r.overdue,1);});
test('duplicate detection requires exact active visible label, instructions, times and dates',()=>{const p={label:'가상약',instructions:'가상지시',times:['20:00','08:00'],startDate:'2026-10-16',endDate:'2026-10-20',intervalDays:1},saved={...p,active:true,homeVisible:true};assert.equal(ctx.findMatchingMedicationPlan([saved],{...p,times:['08:00','20:00']}),saved);for(const changed of [{active:false},{homeVisible:false},{instructions:'변경'},{startDate:'2026-10-17'},{times:['08:00']},{intervalDays:2}])assert.equal(ctx.findMatchingMedicationPlan([{...saved,...changed}],p),undefined);});
