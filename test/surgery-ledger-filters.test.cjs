const test=require('node:test'),assert=require('node:assert/strict');require('../surgery-ledger.js');
const {matchesClassification,filteredPage,classificationChoices}=global.SurgeryLedger;
const doc=(id,record)=>({id,status:'active',body:{record}});
test('classification is case/spacing insensitive, partial and AND across fields',()=>{
 const d=doc('a',{surgeon:'김 원장',diagnosis:'MPL\nGrade 3',procedure:'Trochlear recession'});
 assert.equal(matchesClassification(d,{surgeon:'김',diagnosis:'mpl grade',procedure:'RECESSION'}),true);
 assert.equal(matchesClassification(d,{surgeon:'이',diagnosis:'MPL'}),false);
 assert.equal(matchesClassification(d,{procedure:'TPLO'}),false);
 assert.equal(matchesClassification(d,{}),true);
 assert.equal(matchesClassification(doc('b',{}),{surgeon:'김'}),false);
});
test('all conditions must match one review variant, never combined across variants',()=>{
 const d={body:{variants:[{record:{surgeon:'김',diagnosis:'MPL'}},{record:{surgeon:'이',diagnosis:'CCLR'}}]}};
 assert.equal(matchesClassification(d,{surgeon:'김',diagnosis:'CCLR'}),false);
 assert.equal(matchesClassification(d,{surgeon:'이',diagnosis:'CCLR'}),true);
});
test('pagination skips empty matching pages and retains next cursor for later matches',async()=>{
 const pages={'':{items:[doc('1',{surgeon:'이'})],next:'a'},a:{items:[],next:'b'},b:{items:[doc('2',{surgeon:'김'}),doc('3',{surgeon:'이'})],next:'c'},c:{items:[doc('4',{surgeon:'김'})],next:''}},calls=[];
 const fetch=async cursor=>{calls.push(cursor);return {...pages[cursor],counts:{active:4}}};
 const first=await filteredPage(fetch,'',{surgeon:'김'});assert.deepEqual(first.items.map(d=>d.id),['2']);assert.equal(first.next,'c');assert.equal(first.scanned.length,3);assert.equal(first.counts.active,4);
 const more=await filteredPage(fetch,first.next,{surgeon:'김'});assert.deepEqual(more.items.map(d=>d.id),['4']);assert.equal(more.next,'');assert.deepEqual(calls,['','a','b','c']);
});
test('no match reaches final page; errors and repeated cursors cannot return incomplete results',async()=>{
 const pages={'':{items:[doc('1',{surgeon:'이'})],next:'a'},a:{items:[],next:''}};
 assert.equal((await filteredPage(async c=>pages[c],'',{surgeon:'김'})).items.length,0);
 await assert.rejects(filteredPage(async c=>{if(c)throw Error('network');return pages[c]},'',{surgeon:'김'}),/network/);
 await assert.rejects(filteredPage(async c=>({items:[],next:c==='a'?'b':'a'}),'',{surgeon:'김'}),/반복/);
});
test('suggestions include multiline values and review variants, deduplicated without changing records',()=>{
 const data=[doc('1',{surgeon:'김',diagnosis:'MPL\nCCLR',procedure:'TPLO'}),{body:{variants:[{record:{surgeon:'이',diagnosis:'mpl',procedure:'tplo'}}]}}],before=JSON.stringify(data),c=classificationChoices(data);
 assert.deepEqual(c.surgeon,['김','이']);assert.equal(c.diagnosis.length,2);assert.equal(c.procedure.length,1);assert.equal(JSON.stringify(data),before);
});
