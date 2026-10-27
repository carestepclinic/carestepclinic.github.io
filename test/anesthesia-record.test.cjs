const test=require('node:test'),assert=require('node:assert/strict');
const {records,pointFromClick,graph}=require('../anesthesia-record.js');
const start=Date.parse('2026-10-26T14:00:00Z');
test('graph click snaps only time to five minutes, scales value and crosses midnight',()=>{
 const rect={left:0,top:0,width:720,height:300};
 assert.equal(pointFromClick(20,80,rect,start,120,0,300),null);
 assert.deepEqual(pointFromClick(379,141,rect,start,120,0,300),{observedAt:'2026-10-26T15:00:00.000Z',value:150});
 assert.equal(pointFromClick(704,268,rect,start,120,0,100).value,0);
 const mobile={left:12,top:40,width:360,height:150};
 assert.deepEqual(pointFromClick(201.5,110.5,mobile,start,120,0,300),{observedAt:'2026-10-26T15:00:00.000Z',value:150});
});
test('records apply latest amendment without mutating originals or losing cancelled history',()=>{
 const original={id:'e1',revision:2,kind:'anesthesia.entry',body:{recordId:'r1',type:'measurement',observedAt:'2026-10-26T14:00:00Z',values:{heartRate:100}}};
 const changed={id:'e2',revision:3,kind:'anesthesia.entry',body:{...original.body,values:{heartRate:120},voided:true}};
 const legacy={id:'e0',revision:1,kind:'observation',body:{observedAt:'2026-10-26T13:00:00Z',values:{diastolic:60}}};
 const rows=records([changed,legacy,original]);assert.equal(rows.length,2);assert.equal(rows[0].legacy,true);assert.equal(rows[1].voided,true);assert.equal(rows[1].values.heartRate,120);assert.equal(original.body.values.heartRate,100);
});
test('graph does not interpolate unmeasured long gaps or missing values and safely escapes notes',()=>{
 const row=(min,values,extra={})=>({recordId:'r'+min,type:'measurement',observedAt:new Date(start+min*60000).toISOString(),values,...extra});
 const svg=graph('heartRate',[row(0,{heartRate:100}),row(5,{}),row(20,{heartRate:120}),row(25,{heartRate:130},{voided:true})],start,60);
 assert.equal((svg.match(/<circle/g)||[]).length,2);assert.doesNotMatch(svg,/ar-trace/);assert.match(svg,/23:00/);assert.match(svg,/00:00/);
 const connected=graph('heartRate',[row(0,{heartRate:100}),row(5,{heartRate:120})],start,60);assert.match(connected,/ar-trace/);
 assert.match(graph('diastolic',[row(0,{diastolic:180})],start,60),/data-hi="180"/);
});

test('latest settings merge only explicit fields by clinical time after amendments and cancellation',()=>{
 const {latestSettings}=require('../anesthesia-record.js');const r=(id,revision,at,settings,extra={})=>({id,revision,kind:'anesthesia.entry',body:{recordId:id,type:'marker',marker:'settings',observedAt:at,settings,...extra}});
 const events=[r('a',2,'2026-10-26T01:00:00Z',{agent:'Synthetic',concentration:2,ventilation:'spontaneous'}),r('b',3,'2026-10-26T01:10:00Z',{ventilation:'mechanical'}),r('c',4,'2026-10-26T01:05:00Z',{agent:'Synthetic',concentration:0}),r('b',5,'2026-10-26T01:10:00Z',{ventilation:'assisted'}, {voided:true})];
 const result=latestSettings(records(events));assert.match(result.agent.text,/0%/);assert.equal(result.ventilation.text,'자발호흡');assert.equal(result.agent.at,'2026-10-26T01:05:00Z');
});
