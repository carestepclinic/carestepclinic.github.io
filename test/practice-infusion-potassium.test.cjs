const {test}=require('node:test'),assert=require('node:assert/strict'),c=require('../practice-calculators.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('metronidazole ready-to-use volume and prescribed minutes',()=>{
 const v={mode:'intermittent',weight:10,dose:10,doseUnit:'mg/kg/dose',stock:5,stockUnit:'mg',minutes:60,volume:''};
 const r=c.cri(v);assert.equal(r.amount,100);assert.equal(r.stockML,20);assert.equal(r.rate,20);assert.equal(r.diluentML,0);
 assert.equal(c.cri({...v,minutes:30}).rate,40);assert.equal(c.cri({...v,volume:50}).rate,50);
 assert.throws(()=>c.cri({...v,volume:10}));assert.throws(()=>c.cri({...v,minutes:0}));assert.throws(()=>c.cri({...v,doseUnit:'mg/kg/hr'}));assert.throws(()=>c.cri({...v,stockUnit:'U'}));
});
test('mannitol g/kg and percent-strength conversion give exact total volume',()=>{
 const v={mode:'intermittent',weight:4,dose:.5,doseUnit:'g/kg/dose',stock:200,stockUnit:'mg',minutes:20,volume:''};
 const r=c.cri(v);assert.equal(r.amount,2000);assert.equal(r.stockML,10);assert.equal(r.rate,30);
 close(c.cri({...v,stock:150}).stockML,2000/150);assert.equal(c.cri({...v,stock:250}).stockML,8);
});
test('undiluted propofol calculates actual pump flow without an arbitrary fluid bag',()=>{
 const v={mode:'undiluted',weight:4,dose:.2,doseUnit:'mg/kg/min',stock:10,stockUnit:'mg',volume:''};
 const r=c.cri(v);close(r.rate,4.8);assert.equal(r.hours,null);assert.equal(r.diluentML,0);
 close(c.cri({...v,stock:20}).rate,2.4);close(c.cri({...v,volume:12}).hours,2.5);assert.throws(()=>c.cri({...v,stock:0}));
});
test('furosemide dilution conserves mass and pump rate',()=>{
 const r=c.cri({mode:'prepare',weight:4,dose:.25,doseUnit:'mg/kg/hr',stock:10,stockUnit:'mg',volume:100,rate:2});assert.equal(r.hourly,1);assert.equal(r.stockML,5);assert.equal(r.diluentML,95);assert.equal(r.rate,2);
});
const k={added:10,bag:500,kstock:2,baseK:0,mixMode:'add'};
test('user potassium examples use added mEq per L, not total per bag',()=>{
 assert.equal(c.potassiumMix(k).stockML,2.5);assert.equal(c.potassiumMix({...k,added:20}).stockML,5);
 assert.equal(c.potassiumMix({...k,bag:100,added:20}).stockML,1);assert.equal(c.potassiumMix({...k,kstock:1}).stockML,5);
 assert.equal(c.potassiumMix(k).addedMEq,5);assert.equal(c.potassiumMix(k).volume,502.5);
});
test('potassium includes base fluid, withdrawal, displacement and other IV lines',()=>{
 const r=c.potassiumMix({...k,added:20,baseK:4});assert.equal(r.totalMEq,12);close(r.concentration,12/505*1000);
 const final=c.potassiumMix({...k,added:20,baseK:4,mixMode:'final'});assert.equal(final.baseML,495);close(final.totalMEq,11.98);close(final.concentration,23.96);
 const p=c.potassium({weight:4,concentration:final.concentration,rate:20,other:.1});close(p.hourly,.5792);close(p.perKg,.1448);assert.equal(p.exceeds,false);
 assert.equal(c.potassium({weight:4,concentration:80,rate:30,other:0}).exceeds,true);
});
test('potassium zero addition and invalid entries',()=>{
 assert.equal(c.potassiumMix({...k,added:0}).stockML,0);assert.equal(c.potassiumMix({...k,added:0,baseK:4}).concentration,4);
 for(const bad of [{added:-1},{added:'abc'},{bag:0},{kstock:0},{baseK:-1},{mixMode:'x'},{added:2000}])assert.throws(()=>c.potassiumMix({...k,...bad}));
});
