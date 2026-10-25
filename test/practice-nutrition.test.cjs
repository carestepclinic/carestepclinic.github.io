const {test}=require('node:test'),assert=require('node:assert/strict');
const n=require('../practice-nutrition.js'),c=require('../practice-calculators.js');
test('adult maintenance factors follow species-specific PNA values',()=>{
 for(const [id,dog,cat] of [['rest',[1],[1]],['intact',[1.8],[1.4]],['neutered',[1.6],[1.2]],['inactive',[1.2,1.3,1.4],[1]],['loss',[1],[.8,.9,1]]]){assert.deepEqual(n.profile(id,'dog').values,dog);assert.deepEqual(n.profile(id,'cat').values,cat);}
 assert.equal(n.profile('neutered','rabbit'),null);assert.equal(n.profile('pregnant','dog'),null);
});
test('weight change uses explicit target weight and preserves current patient weight',()=>{
 const v={weight:10,targetWeight:8,nutritionProfile:'loss',multiplier:1,other:0,density:4,unit:'kcal/g',meals:2},x=n.resolve(v,'dog'),r=c.nutrition({...v,weight:x.weight});
 assert.equal(x.current,10);assert.equal(x.weight,8);assert.equal(v.weight,10);assert.ok(Math.abs(r.rer-70*Math.pow(8,.75))<1e-9);assert.ok(Math.abs(r.amount-r.rer/4)<1e-9);
 for(const targetWeight of ['',0,-1,11,'NaN','1e1'])assert.throws(()=>n.resolve({...v,targetWeight},'dog'));
 assert.throws(()=>n.resolve({...v,nutritionProfile:'gain',targetWeight:8,multiplier:1.2},'dog'));
 assert.throws(()=>n.resolve({...v,multiplier:3},'dog'));
 assert.throws(()=>n.resolve({...v,nutritionProfile:'unknown'},'dog'));
 assert.equal(n.resolve({...v,nutritionProfile:'manual',targetWeight:2},'dog').weight,10);
});
test('gain factors have separate dog and cat sources and bounded choices',()=>{
 assert.deepEqual(n.profile('gain','dog').values,[1.2,1.4,1.6,1.8]);assert.deepEqual(n.profile('gain','cat').values,[1.2,1.3,1.4]);assert.match(n.profile('gain','dog').source.url,/osu/);assert.match(n.profile('gain','cat').source.url,/royalcanin/);
 assert.equal(n.resolve({weight:3,targetWeight:4,nutritionProfile:'gain',multiplier:1.4},'cat').weight,4);
});
