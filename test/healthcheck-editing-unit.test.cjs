const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../healthcheck-record.js');
const date='2026-11-15';
const result={name:'CREA',value:'2.4',unit:'mg/dL',reference:'0.5–1.8',source:'가상 검사실'};
test('import fills one compatible empty template row and keeps its stable id',()=>{
 const blank=H.row({id:'template',name:'크레아티닌',group:'신장'});
 const merged=H.mergeLabs([blank],[result],'fill',date);
 assert.equal(merged.length,1);assert.equal(merged[0].id,'template');assert.equal(merged[0].value,'2.4');assert.equal(merged[0].source,result.source);assert.equal(merged[0].confirmed,true);
 assert.deepEqual(H.importPreview([blank],[result],'fill',date),{added:0,replaced:1,kept:0});
 assert.equal(H.mergeLabs(merged,[result],'fill',date).length,1);
 assert.equal(blank.value,'');
});
for(const [label,extra] of Object.entries({populated:{value:'1.1'},laboratory:{source:'다른 검사실'},unit:{unit:'µmol/L'},date:{date:'2026-11-14'},reference:{reference:'1–3'},confirmed:{confirmed:true}}))test('import preserves '+label+' instead of guessing a blank match',()=>{
 const old=H.row({name:'CREA',...extra});const merged=H.mergeLabs([old],[result],'fill',date);
 assert.equal(merged.length,2);assert.deepEqual(merged[0],old);
});
test('ambiguous blank rows and explicit append stay separate',()=>{
 const a=H.row({name:'CREA'}),b=H.row({name:'CREA'});
 assert.equal(H.mergeLabs([a,b],[result],'fill',date).length,3);
 assert.equal(H.mergeLabs([a],[result],'append',date).length,2);
});
test('urine and blood results never share a blank template',()=>{
 const urine=H.row({name:'GLU',group:'요검사'});
 assert.equal(H.mergeLabs([urine],[{name:'GLU',group:'생화학',value:'100'}],'fill',date).length,2);
});
test('name search recognizes Korean aliases, original names, casing and partial text',()=>{
 const r=H.row({name:'CREA',originalName:'CREATININE (IDEXX)'});
 for(const q of ['크레아티닌','crea',' idexx ','크레아',''])assert.equal(H.labMatchesSearch(r,q),true,q);
 assert.equal(H.labMatchesSearch(r,'혈당'),false);
});
test('AI context excludes administrative edits but detects evidence changes',()=>{
 const d=H.blank(),before=H.proposalContext(d);d.veterinarian='다른 수의사';d.reviewed=true;d.summary='수정한 소견';d.clinicalStatus='complete';
 assert.equal(H.proposalContext(d),before);
 d.history='달라진 문진';assert.notEqual(H.proposalContext(d),before);
 const after=H.proposalContext(d);d.labs.push(H.row(result));assert.notEqual(H.proposalContext(d),after);
});
