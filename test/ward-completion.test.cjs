const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../clinical-workspace.js');
const entries=statuses=>statuses.map((status,i)=>({task:{id:String(i),status,plannedAt:'2026-01-01T00:00:00Z'},state:status}));
test('completion: cancelled history never inflates the remaining administration count',()=>{
 const rows=entries(['done','done','done','done','done','cancelled']),before=structuredClone(rows);assert.deepEqual(C.wardCalendarStatus(rows),{tone:'done',label:'완료 5/5 · 중단 1',done:5});assert.deepEqual(rows,before);assert.equal(C.handoffTasks(rows.map(e=>e.task)).length,0);
});
test('completion: omissions stay distinct from administrations and cancelled-only is not done',()=>{
 assert.deepEqual(C.wardCalendarStatus(entries(['cancelled'])),{tone:'closed',label:'중단 1 · 남은 처치 없음',done:0});
 assert.deepEqual(C.wardCalendarStatus(entries(['done','omitted','cancelled'])),{tone:'closed',label:'처리 종료 1/2 · 미실시 1 · 중단 1',done:1});
 assert.equal(C.wardCalendarStatus(entries(['done','held','cancelled'])).tone,'late');assert.equal(C.wardCalendarStatus(entries(['done','planned','cancelled'])).tone,'late');assert.equal(C.wardCalendarStatus([]).tone,'planned');
});
