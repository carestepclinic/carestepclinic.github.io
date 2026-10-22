const {test}=require('node:test'),assert=require('node:assert/strict'),r=require('../practice-reference.js'),c=require('../practice-calculators.js');
test('고양이 고정량은 체중을 곱하지 않고 mg/mcg·제형을 보존',()=>{
 const s=r.selection('amoxclav-drops','cat','cat',62.5,62.5);
 for(const weight of [2,4,8]){const v={weight,dose:62.5,doseUnit:'mg',doseBasis:s.basis,form:'liquid',concentration:62.5,strengthUnit:'mg',courseMode:'days',times:2,days:5};r.validate(s,v);const result=c.prescription({...v,strength:v.concentration});assert.equal(result.mg,62.5);assert.equal(result.amount,1);assert.equal(result.total,10);}
 assert.equal(c.prescription({weight:4,dose:62500,doseUnit:'mcg',doseBasis:'fixed',form:'liquid',strength:62.5,strengthUnit:'mg',times:2,days:1}).amount,1);
 assert.throws(()=>c.prescription({weight:4,dose:1,doseBasis:'daily'}));
});
test('다른 종·미선택 용법·범위·제품 함량을 잘못 적용하지 않음',()=>{
 assert.throws(()=>r.selection('carprofen','cat','daily',4.4,25));
 assert.throws(()=>r.selection('maropitant-oral','cat','adult',2,16));
 for(const value of ['',0,34,'Infinity','bad'])assert.throws(()=>r.selection('clindamycin','cat','cat',value,25));
 assert.throws(()=>r.selection('clindamycin','cat','cat',11,10));
 const s=r.selection('clindamycin','cat','cat',11,25),v={dose:11,doseUnit:'mg',doseBasis:'kg',form:'liquid',concentration:25,strengthUnit:'mg',courseMode:'days',times:1,days:14};r.validate(s,v);
 assert.throws(()=>r.validate(s,{...v,times:2}));assert.throws(()=>r.validate(s,{...v,days:15}));assert.throws(()=>r.validate(s,{...v,doseBasis:'fixed'}));assert.throws(()=>r.validate(s,{...v,concentration:10}));
});
test('장기지속 주사제는 1회분만 계산, 일일 반복량으로 확장하지 않음',()=>{
 const s=r.selection('cefovecin','cat','cat',8,80),v={dose:8,doseUnit:'mg',doseBasis:'kg',form:'liquid',concentration:80,strengthUnit:'mg',courseMode:'total',totalDoses:1};r.validate(s,v);
 assert.equal(c.prescription({...v,weight:4,strength:80}).amount,0.4);
 assert.throws(()=>r.validate(s,{...v,totalDoses:2}));assert.throws(()=>r.validate(s,{...v,courseMode:'days',times:1,days:14}));
});
test('모든 제공 용법은 종·경로·출처가 있고 출처 없는 수치를 만들지 않음',()=>{
 const ids=new Set();for(const d of r.drugs){assert.ok(!ids.has(d.id));ids.add(d.id);assert.match(r.sources[d.source].url,/^https:\/\//);assert.ok(d.warning);for(const p of d.profiles){assert.ok(['dog','cat'].includes(p.species));assert.ok(['PO','SC','IV'].includes(p.route));assert.ok(p.min>0&&p.max>=p.min);assert.ok(p.single||24%p.times===0);}}
 assert.equal(r.species('other'),'');assert.equal(r.species('고양이'),'cat');
});
