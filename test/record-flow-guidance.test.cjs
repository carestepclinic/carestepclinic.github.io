const {test}=require('node:test'),assert=require('node:assert/strict');
require('../record-flow-guidance.js');
const {summary}=globalThis.RecordFlowGuidance;
test('entered fields do not imply clinical review',()=>{
 assert.equal(summary([]).state,'ready');assert.doesNotMatch(summary([]).label,/✓|검토 완료/);
 assert.equal(summary([],true).state,'reviewed');assert.match(summary([],true).label,/검토 완료/);
});
test('required entry and final review counts remain separate',()=>{
 const s=summary([{kind:'required'},{kind:'review'},{kind:'review'}],true);
 assert.deepEqual([s.required,s.review,s.errors,s.state],[1,2,0,'required']);
 assert.match(s.label,/필수 입력 1개.*완료 전 확인 2개/);
});
test('real validation errors take precedence over empty required fields',()=>{
 assert.equal(summary([{kind:'required'}]).state,'required');
 assert.equal(summary([{kind:'required'},{kind:'error'}]).state,'error');
 assert.equal(summary([{kind:'review'}],true).state,'review');
});
