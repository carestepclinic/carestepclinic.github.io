const {test}=require('node:test'),assert=require('node:assert/strict');
const a=require('../practice-anesthesia.js'),f=require('../practice-fluid-plan.js');
const v={species:'dog',weight:5,profile:'stable',dose:2,stock:10};
test('induction volume uses mg not maintenance mg/kg/min',()=>{assert.equal(a.calculate('propofol',v).mL,1);assert.equal(a.calculate('alfaxalone',{...v,species:'cat'}).mL,1);assert.throws(()=>a.calculate('alfaxalone',{...v,species:'cat',dose:1}));});
test('micrograms are converted to mg before volume',()=>{const r=a.calculate('dexmedetomidine',{...v,dose:3,stock:.5});assert.equal(r.mL,.03);assert.equal(r.amount,15);});
test('species, unstable patients, out-of-range and invalid numbers are held',()=>{for(const bad of [{species:'rabbit'},{profile:'individual'},{weight:0},{weight:Infinity},{stock:0},{dose:200},{dose:'abc'},{weight:201}])assert.throws(()=>a.calculate('propofol',{...v,...bad}));});
test('acepromazine total and hydromorphone feline limits',()=>{assert.throws(()=>a.calculate('acepromazine',{...v,species:'cat',weight:15,dose:.1,stock:2}));assert.throws(()=>a.calculate('hydromorphone',{...v,species:'cat',dose:.2,stock:2}));});
test('ketamine requires and separately calculates the benzodiazepine',()=>{assert.throws(()=>a.calculate('ketamine',{...v,stock:50}));const r=a.calculate('ketamine',{...v,stock:50,companionDose:.1,companionStock:5});assert.equal(r.mL,.2);assert.equal(r.companionML,.1);});
const product=(patch={})=>({id:'x',revision:1,body:{kind:'liquid',value:20,unit:'mg',strength:{ingredientId:'mfds-bd11aec3c2ce50c8e483',species:['dog','cat'],route:'injection',release:'standard',...patch}}});
test('hospital concentrations require exact ingredient, species, formulation and route',()=>{const d=a.drugs.find(x=>x.id==='propofol');assert.equal(a.stockOptions(d,[product()],'dog')[0].value,20);for(const patch of [{route:'oral'},{release:'modified'},{species:['dog']},{ingredientId:'other'}])assert.equal(a.stockOptions(d,[product(patch)],'cat').length,0);assert.deepEqual(a.stockOptions(a.drugs.find(x=>x.id==='dexmedetomidine'),[product()],'dog'),[]);});
test('fluid plan combines rates over a common period',()=>{const r=f.calculate({species:'dog',weight:5,maintenance:60,dehydration:5,hours:12,loss:2,other:3});assert.equal(r.deficit,250);assert.equal(r.rate,12.5+250/12-1);assert.ok(Math.abs(r.volume-388)<1e-9);});
test('fluid plan never treats blank losses as zero and rejects negative balance',()=>{const base={species:'cat',weight:5,maintenance:40,dehydration:0,hours:12,loss:0,other:0};assert.equal(f.calculate(base).rate,200/24);for(const patch of [{loss:''},{dehydration:16},{other:100},{hours:0},{weight:-5}])assert.throws(()=>f.calculate({...base,...patch}));});

test('new premedication purposes and combination route stay species specific',()=>{
 assert.equal(a.calculate('diazepam',{...v,dose:.1,stock:5}).mL,.1);
 assert.equal(a.calculate('medetomidine',{...v,dose:10,stock:1}).mL,.05);
 assert.equal(a.calculate('medetomidine',{...v,species:'cat',dose:50,stock:1}).mL,.25);
 assert.throws(()=>a.calculate('medetomidine',{...v,species:'cat',dose:10,stock:1}));
 assert.equal(a.drugs.find(d=>d.id==='diazepam').route,'IV');
 assert.equal(a.drugs.find(d=>d.id==='ketamine-medetomidine').route,'IM');
});
test('ketamine medetomidine calculates two separate volumes with mcg conversion',()=>{
 const dog=a.calculate('ketamine-medetomidine',{...v,dose:5,stock:50,companionDose:40,companionStock:1});
 assert.equal(dog.mL,.5);assert.equal(dog.companionMg,.2);assert.equal(dog.companionML,.2);
 const cat=a.calculate('ketamine-medetomidine',{...v,species:'cat',dose:2.5,stock:50,companionDose:80,companionStock:1});
 assert.equal(cat.mL,.25);assert.equal(cat.companionML,.4);
 for(const bad of [{companionDose:80},{companionDose:.04},{companionStock:0},{dose:2.5}])assert.throws(()=>a.calculate('ketamine-medetomidine',{...v,dose:5,stock:50,companionDose:40,companionStock:1,...bad}));
});
test('saved concentration serializes only stock facts and atomically carries companion stock',()=>{
 const d=a.drugs.find(x=>x.id==='ketamine-medetomidine'),body=a.stockBody(d,'100','1'),p={id:'x',revision:1,body};
 assert.deepEqual(a.savedFact(p,d),{value:100,companionStock:1});
 assert.equal(body.kind,'liquid');assert.equal(body.confirm,true);assert.ok(body.note.length<500);
 assert.doesNotMatch(body.note,/dose|weight|patient|species/);
 assert.deepEqual(a.partition({items:[p,product()]}).items,[product()]);
 assert.equal(a.partition({items:[p]}).anesthesiaItems.length,1);
});
test('saved stock rejects corrupted values, wrong route/basis and duplicates',()=>{
 const d=a.drugs[0],body=a.stockBody(d,10),p={id:'x',revision:1,body};
 for(const value of [0,-1,'Infinity','abc',1000001])assert.throws(()=>a.stockBody(d,value));
 assert.throws(()=>a.savedFor([p,p],d));
 assert.throws(()=>a.savedFact({...p,body:{...body,unit:'mcg'}},d));
 assert.throws(()=>a.savedFact({...p,body:{...body,note:body.note.replace('"IM / IV"','"PO"')}},d));
 assert.throws(()=>a.savedFact({...p,body:{...body,note:body.note.replace('"active"','"other"')}},d));
});
