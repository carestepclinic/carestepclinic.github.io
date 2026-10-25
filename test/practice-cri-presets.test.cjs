const {test}=require('node:test'),assert=require('node:assert/strict');
const {drugs,options}=require('../practice-cri-presets.js'),c=require('../practice-calculators.js'),catalog=require('../practice-strength-catalog.json');
const fent=drugs.find(x=>x.id==='fentanyl');
const item=(id,over={})=>({id,body:{kind:'liquid',value:25,unit:'mcg',strength:{ingredientId:fent.ingredient,route:'injection',release:'standard',species:['dog'],calculationBasis:'Fentanyl',...over}}});
test('common injectable candidates are traceable to public catalog or existing reviewed emergency source',()=>{
 const em=require('node:fs').readFileSync(require('node:path').join(__dirname,'../practice-emergency.js'),'utf8');
 for(const d of drugs){assert.ok(d.note);assert.ok(d.unit.endsWith('/hr')||d.unit.endsWith('/min')||d.unit.endsWith('/dose'));for(const s of d.stocks){assert.ok(s.value>0);if(d.id==='metronidazole'){assert.equal(s.value,5);assert.match(s.url,/baxter.ca/);continue;}assert.match(s.url,/nedrug.mfds.go.kr/);if(d.id==='lidocaine'){assert.ok(em.includes("stock(20,'197900151'"));continue;}const rows=catalog.ingredients.filter(x=>(d.ingredients||[d.ingredient]).includes(x.id));assert.ok(rows.flatMap(r=>r.options).some(x=>x.route==='injection'&&x.value===s.value&&x.unit===s.unit&&x.sources.some(z=>z.url===s.url)),d.id);}}
});
test('clinic candidates must match exact ingredient, injectable form, species, release and compatible units',()=>{
 const records=[item('yes'),item('oral',{route:'oral'}),item('cat',{species:['cat']}),item('other',{ingredientId:'other'}),item('release',{release:'extended'}),{...item('issue'),formularyIssue:'requires review'},{id:'tablet',body:{...item('x').body,kind:'tablet'}},{id:'u',body:{...item('x').body,unit:'U'}},{id:'zero',body:{...item('x').body,value:0}}];
 assert.deepEqual(options(fent,records,'dog').filter(x=>x.clinic).map(x=>x.id),['clinic:yes']);assert.equal(options(fent,records,'cat')[0].id,'clinic:cat');
});
test('mass unit and time basis remain exact for all supported common drugs',()=>{
 for(const d of drugs){const s=d.stocks[0];for(const unit of ['mcg/kg/hr','mcg/kg/min','mg/kg/hr','mg/kg/min']){const v={weight:4,dose:0.0001,doseUnit:unit,stock:s.value,stockUnit:s.unit,volume:100,mode:'prepare',rate:10};const r=c.cri(v),expected=4*0.0001*(unit.startsWith('mcg')?0.001:1)*(unit.endsWith('min')?60:1);assert.ok(Math.abs(r.hourly-expected)<1e-12);assert.ok(Math.abs(r.concentration*r.rate-expected)<1e-12);const inverse=c.cri({...v,mode:'pump',stockML:r.stockML.toFixed(20)});assert.ok(Math.abs(inverse.rate-10)<1e-9);}}
});
test('open-product elapsed time is included in four-hour limit without altering prescribed flow',()=>{
 const v={species:'dog',weight:10,product:'plasma',mode:'volume',volume:100,hours:3.5,initial:true,initialRate:0.5,initialMinutes:15,factor:20,elapsedMinutes:30};
 const r=c.transfusion(v);assert.equal(r.overFourHours,false);const late=c.transfusion({...v,elapsedMinutes:31});assert.equal(late.overFourHours,true);assert.equal(late.rate,r.rate);assert.throws(()=>c.transfusion({...v,elapsedMinutes:-1}));assert.throws(()=>c.transfusion({...v,elapsedMinutes:'abc'}));
});
