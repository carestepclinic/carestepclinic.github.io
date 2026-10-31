const {test,before}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),ctx={window:{},crypto:webcrypto,TextEncoder};vm.createContext(ctx);
for(const name of ['practice-strengths','practice-ingredients','practice-products'])vm.runInContext(fs.readFileSync(path.join(root,name+'.js'),'utf8'),ctx);
const S=ctx.window.PracticeStrengths,I=ctx.window.PracticeIngredients,P=ctx.window.PracticeProducts,R=require('../practice-prescription.js');
const doc=JSON.parse(fs.readFileSync(path.join(root,'practice-strength-catalog.json'),'utf8')),entry=doc.ingredients.find(x=>x.id==='manual-0793ad74243cf94ae589');
before(()=>I.configure(doc));
const record=()=>({id:'citrate-test',revision:1,body:{title:'Citrate, Potassium',kind:'capsule',value:310,unit:'mg',strength:{version:1,ingredientId:entry.id,name:'Citrate, Potassium',english:'Citrate, Potassium',calculationBasis:'구연산칼륨',species:['cat','dog'],route:'oral',release:'standard',aliases:['Citrate, Potassium','Potassium Citrate','구연산칼륨','Potassium','Citrate,']}}});
test('NOW label separates citrate 310mg from elemental potassium 99mg without prescribing a dose',()=>{
 assert.equal(entry.options.length,1);const v=entry.options[0];assert.equal(v.value,310);assert.equal(v.unit,'mg');assert.equal(v.kind,'capsule');assert.equal(v.route,'oral');assert.equal(new URL(v.sources[0].url).hostname,'www.nowfoods.com');assert.match(entry.labelNote,/원소 칼륨 99mg/);assert.equal(v.dose,undefined);assert.equal(v.frequency,undefined);assert.equal(v.species,undefined);
});
test('citrate aliases cannot reduce to elemental potassium or citrate alone',()=>{
 const a=S.aliases(entry);for(const n of ['Potassium Citrate','Citrate, Potassium','구연산칼륨'])assert.ok(a.includes(n));for(const n of ['Potassium','Citrate,','potassium','citrate'])assert.ok(!a.includes(n));assert.notEqual(I.resolve('potassium'),I.resolve('potassium citrate'));
});
test('old unsafe aliases are removed in memory without mutating the saved original',()=>{
 const old=record(),before=JSON.stringify(old),p=S.adapt({items:[old]}).items[0];assert.equal(JSON.stringify(old),before);assert.ok(!p.body.formulary.aliases.includes('Potassium'));assert.ok(!p.body.strength.aliases.includes('Potassium'));for(const q of ['potassium','칼륨','citrate'])assert.equal(P.candidates([p],q,'dog','oral','mg').length,0);
 const raw={...old,body:{...old.body,formulary:old.body.strength}};assert.equal(I.candidates([raw],'potassium','dog','oral','mg').length,0);
});
test('English and Korean prescriptions auto-link for dogs and cats using 310mg per capsule',()=>{
 const p=S.adapt({items:[record()]}).items[0];for(const species of ['dog','cat'])for(const name of ['potassium citrate','Citrate, Potassium','구연산칼륨']){
 const found=P.autoCandidate(P.candidates([p],name,species,'oral','mg'),name);assert.ok(found);assert.equal(found.body.value,310);
 const row=R.parse(name+' 310 mg/head po sid for 1 days')[0],result=R.calculate({...row,form:found.body.kind,strength:String(found.body.value),strengthUnit:found.body.unit},5);assert.equal(result.amount,1);assert.equal(result.total,1);assert.equal(result.unit,'캡슐');}
});
test('weight-based arithmetic uses citrate mass and respects route isolation',()=>{
 const p=S.adapt({items:[record()]}).items[0],row=R.parse('potassium citrate 31 mg/kg po bid for 2 days')[0];const r=R.calculate({...row,form:'capsule',strength:'310',strengthUnit:'mg'},5);assert.equal(r.amount,.5);assert.equal(r.total,2);assert.equal(P.candidates([p],'potassium citrate','dog','injection','mg').length,0);
});
