const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('../healthcheck-record.js');
test('legacy blood rows route to independent CBC and chemistry tabs without changing data',()=>{
 const rows=[{name:'WBC',group:'blood',value:'8'},{name:'HCT',group:'CBC',value:'40'},{name:'ALT',group:'blood',value:'25'},{name:'RBC',group:'요검사',value:'음성'},{name:'Total T4',value:'2'}],before=JSON.stringify(rows);
 assert.deepEqual(rows.map(H.labTab),['cbc','cbc','labs','urine','additional']);assert.equal(JSON.stringify(rows),before);
});
test('CBC and chemistry progress, review jumps and missing defaults use their own rows',()=>{
 const d=H.blank();d.labs=[H.row({name:'WBC',value:'8'}),H.row({name:'CREA',value:'1.2',confirmed:true})];
 assert.match(H.workflowState(d,'cbc'),/대조 필요 1개/);assert.doesNotMatch(H.workflowState(d,'labs'),/대조/);assert.equal(H.nextWorkStep(d,'exams'),'cbc');
 assert.equal(H.missingLabDefaults(d.labs,'CBC','cat','',d.date,'cbc').items.length,1);assert.equal(H.missingLabDefaults(d.labs,'CBC','cat','',d.date,'labs').items.length,0);
});
test('mixed imports preserve IDs, values and source and report both blood sections exactly once',()=>{
 const d=H.blank(),r=H.row({name:'WBC',value:'8',unit:'K/μL',reference:'3–15',source:'synthetic',date:d.date,confirmed:true});d.labs=H.mergeLabs([r],[{...r,value:'9'},{name:'CREA',value:'1.2',unit:'mg/dL',reference:'0.8–2.4',source:'synthetic'}],'replace',d.date);
 assert.equal(d.labs.length,2);assert.equal(d.labs[0].id,r.id);assert.deepEqual(d.labs.map(H.labTab),['cbc','labs']);
 const html=H.reportHTML(d,{name:'가상 환자',species:'cat'},[]);for(const label of ['혈액검사 · CBC','혈액검사 · 생화학'])assert.equal(html.split('data-report-title="'+label+'"').length-1,1);assert.match(html,/WBC/);assert.match(html,/CREA/);
});
