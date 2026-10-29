const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../anesthesia-record.js'),D=require('../anesthesia-dashboard.js');
const start=Date.parse('2026-10-29T03:35:00Z');
const events=['anesthesiaStart','surgeryStart','surgeryEnd','anesthesiaEnd'].map((marker,i)=>({type:'marker',recordId:'event'+i,marker,observedAt:new Date(start+i*60000).toISOString()}));
test('care simple: graph labels every phase at corrected clinical time, with collision lanes',()=>{
 const html=R.graphEventMarkup(events,start,120,54,704,14,268);
 for(const label of ['마취 시작 12:35','수술 시작 12:36','수술 종료 12:37','마취 종료 12:38'])assert.ok(html.includes(label));
 assert.equal((html.match(/data-ar-event=/g)||[]).length,4);
 const ys=[...html.matchAll(/<text class="ar-phase-label"[^>]* y="([\d.]+)"/g)].map(m=>m[1]);assert.equal(new Set(ys).size,4);
});
test('care simple: no future, cancelled or out-of-range event labels',()=>{
 const html=R.graphEventMarkup([...events,{...events[0],voided:true},{...events[0],observedAt:new Date(start-60000).toISOString()}],start,1,54,704,14,268);
 assert.equal((html.match(/data-ar-event=/g)||[]).length,2);assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));
});
test('care simple: individual and integrated graphs both show phase names; geometry unchanged',()=>{
 const individual=R.graph('heartRate',[],start,120,events),overview=D.overviewGraph(events,start,120);
 for(const html of [individual,overview]){assert.match(html,/ar-phase-label/);assert.match(html,/수술 종료 12:37/);}
 assert.match(individual,/viewBox="0 0 720 300"/);assert.deepEqual(R.pointFromClick(379,141,{left:0,top:0,width:720,height:300},start,120,0,300),{observedAt:new Date(start+60*60000).toISOString(),value:150});
});
