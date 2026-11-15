const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../anesthesia-efficiency.js'),C=require('../clinical-workspace.js');
test('input format checks reject impossible percentages without treating abnormal readings as typos',()=>{
 for(const n of ['980','-1','Infinity'])assert.notEqual(E.measurementError('spo2',n),'');
 for(const n of ['','0','45','100'])assert.equal(E.measurementError('spo2',n),'');
 assert.equal(E.measurementError('heartRate','320'),'');assert.equal(E.measurementError('meanPressure','20'),'');
 assert.notEqual(E.measurementError('heartRate','-5'),'');assert.notEqual(E.measurementError('temperature','',true),'');
});
test('timestamp shortcuts keep Korean date boundaries and never copy a measured value',()=>{
 assert.equal(E.shiftedTime('2026-11-16T00:02','-5'),'2026-11-15T23:57');
 assert.equal(E.shiftedTime('2026-12-31T23:58','5'),'2027-01-01T00:03');
 assert.equal(E.shiftedTime('2026-01-01T00:00','now',Date.parse('2026-11-15T15:01:00Z')),'2026-11-16T00:01');
});
test('calendar dates cross months and years in Korea',()=>{
 assert.deepEqual(C.wardCalendarDates('2026-12-30','days3'),['2026-12-30','2026-12-31','2027-01-01']);
 assert.equal(C.wardCalendarDates('2026-11-29','days5').at(-1),'2026-12-03');
 assert.deepEqual(C.wardCalendarDates('2026-11-16','all'),['2026-11-16']);
});
const now=Date.parse('2026-11-16T03:00:00Z');
const tasks=[
 {id:'old',status:'planned',plannedAt:'2026-11-15T00:00:00+09:00',assigneeId:'a'},
 {id:'today',status:'planned',plannedAt:'2026-11-16T13:00:00+09:00',assigneeId:'a'},
 {id:'next',status:'planned',plannedAt:'2026-11-17T13:00:00+09:00',assigneeId:'a'},
 {id:'third',status:'done',plannedAt:'2026-11-18T13:00:00+09:00',actualAt:'2026-11-19T00:01:00+09:00',assigneeId:'b'},
 {id:'sixth',status:'planned',plannedAt:'2026-11-21T13:00:00+09:00',assigneeId:'a'},
 {id:'prn',status:'planned',plannedAt:'2026-11-15T00:00:00+09:00',medication:{prn:true},assigneeId:'a'}
];
test('multi-day inclusion keeps older unresolved work and PRN once, without inventing future treatments',()=>{
 const before=JSON.stringify(tasks),result=C.wardCalendarTasks(tasks,'2026-11-16','days3','all','',now);
 assert.deepEqual(result.map(t=>t.id).sort(),['old','today','next','third','prn'].sort());
 assert.equal(JSON.stringify(tasks),before);
 assert.deepEqual(C.wardCalendarTasks(tasks,'2026-11-16','days3','done','',now).map(t=>t.id),['third']);
 assert.ok(C.wardCalendarTasks(tasks,'2026-11-16','days5','all','a',now).every(t=>t.assigneeId==='a'));
});
test('day columns group same-time injections only within the same patient and actual scheduled date',()=>{
 const room={id:'r1'},dates=C.wardCalendarDates('2026-11-16','days3');
 const entries=[...tasks.map(t=>({room,task:t,at:t.plannedAt,targetKind:'task',target:t.id})),{room,task:{id:'second',category:'injection'},at:'2026-11-17T13:00:00+09:00',targetKind:'task',target:'second'}];
 const r=C.wardCalendarGroups(entries,dates);
 assert.deepEqual(r.scheduled.map(g=>g.date),['2026-11-16','2026-11-17','2026-11-17','2026-11-18']);
 assert.deepEqual(r.other.map(e=>e.target).sort(),['old','prn','sixth']);
 assert.equal(C.wardCalendarHours('2026-11-16','days3',now).length,24);
});
