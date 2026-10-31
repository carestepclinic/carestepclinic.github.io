const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../practice-injection.js');
const product=(value,unit='mg')=>({body:{kind:'liquid',value,unit}});
test('combination splits complete prescriptions and shares only the trailing route',()=>{
 const text='Ketamine 5 mg/kg + medetomidine 20 ug/kg iv',rows=I.parse(text);
 assert.deepEqual(rows.map(r=>[r.drug,r.dose,r.unit,r.route]),[['Ketamine',5,'mg','IV'],['medetomidine',20,'mcg','IV']]);
 assert.ok(rows.every(r=>r.sourceRaw===text));
 assert.equal(I.calculate(rows[0],8.2,product(50),'dog').amount,.82);
 assert.equal(I.calculate(rows[1],8.2,product(1),'dog').amount,.164);
 assert.deepEqual(I.parse('x 1 mg/kg IV + y 2 mg/kg SC').map(r=>r.route),['IV','SC']);
 assert.equal(I.parse('x 1 mg/kg ＋ y 2 mg/kg sq')[0].route,'SC');
});
for(const text of ['x 1 mg/kg + y 2 mg/kg','x 1 mg/kg IV + y 2 mg/kg + z 3 mg/kg SC','x + y 2 mg/kg IV','x 1 mg/kg + y 2 m/kg IV','x 1 mg/kg + y 2 mg/kg IV +','x 1 mg/kg\ny 2 mg/kg IV'])test('combination refuses missing or ambiguous conditions: '+text,()=>assert.ok(I.parse(text).some(r=>r.error)));
test('combination enforces expanded medication limit',()=>assert.throws(()=>I.parse(Array(16).fill('x 1 mg/kg + y 2 mg/kg IV').join('\n')),/30/));
function fixture(){
 const f={items:[],writes:[],canManage:true,valid:true,changed:0,lose:false};
 f.request=async(path,opt)=>{if(!opt?.method)return {items:structuredClone(f.items),canManage:f.canManage};
  const b=JSON.parse(opt.body).items[0];f.writes.push(b);let old=f.items.find(p=>p.body.strength?.ingredientId===b.ingredientId);
  if(old&&old.revision!==b.revision)return {results:[{status:'conflict'}]};
  const saved={id:old?.id||'s'+f.items.length,revision:(old?.revision||0)+1,body:{title:b.name,kind:b.kind,value:b.value,unit:b.unit,strength:{ingredientId:b.ingredientId,name:b.name,english:b.english,aliases:b.aliases,species:b.species,route:b.route,injectionRoute:b.injectionRoute,release:b.release}}};
  f.items=f.items.filter(p=>p.id!==saved.id).concat(saved);if(f.lose){f.lose=false;throw Error('response lost');}return {results:[{status:'saved',id:saved.id}]};};
 f.store=()=>I.strengthStore({request:f.request,valid:()=>f.valid,strengthsChanged:()=>f.changed++});return f;
}
test('selected concentration persists without dose or patient and is recalled at a different weight',async()=>{
 const f=fixture(),r=I.parse('Ketamine 5 mg/kg IV')[0],store=f.store();
 const saved=await store.save(r,product(50),'dog',()=>true);
 assert.deepEqual(Object.keys(f.writes[0]).sort(),['aliases','basis','confirm','english','ingredientId','injectionRoute','kind','name','release','route','species','unit','value'].sort());
 const options=I.candidates(r,f.items,'dog');assert.equal(I.defaultChoice(r,options,'dog'),saved.id);
 assert.equal(I.calculate(r,10,options[0],'dog').amount,1);
 assert.equal(I.candidates({...r,route:'IM'},f.items,'dog').length,0);assert.equal(I.candidates(r,f.items,'cat').length,0);
 await store.save(r,product(50),'dog',()=>true);assert.equal(f.writes.length,1);
 await store.save(r,product(100),'dog',()=>true);assert.equal(f.items.length,1);assert.equal(f.items[0].body.value,100);
});
test('saved preference wins among existing strengths but does not change existing products',async()=>{
 const f=fixture(),r=I.parse('medetomidine 20 ug/kg IV')[0];const original={id:'existing',body:{title:'medetomidine',kind:'liquid',value:2,unit:'mg',formulary:{route:'injection',species:['dog','cat'],aliases:['medetomidine']}}};
 f.items.push(original);const saved=await f.store().save(r,product(1),'dog',()=>true);
 assert.equal(I.defaultChoice(r,I.candidates(r,f.items,'dog'),'dog'),saved.id);assert.deepEqual(f.items[0],original);
 assert.notEqual(await I.preferenceId(r,'dog'),await I.preferenceId(r,'cat'));assert.notEqual(await I.preferenceId(r,'dog'),await I.preferenceId({...r,route:'IM'},'dog'));
 assert.equal(await I.preferenceId(r,'dog'),await I.preferenceId({...r,drug:'메데토미딘'},'dog'));
});
test('permission denial and stale context never write a concentration',async()=>{
 const f=fixture(),r=I.parse('x 1 mg/kg IV')[0];f.canManage=false;
 await assert.rejects(f.store().save(r,product(50),'dog',()=>true),/권한/);assert.equal(f.writes.length,0);
 await assert.rejects(f.store().save(r,product(50),'dog',()=>false),/변경/);assert.equal(f.writes.length,0);
});
test('concurrent edit is not overwritten and lost responses reconcile without duplication',async()=>{
 const f=fixture(),r=I.parse('x 1 mg/kg IV')[0],first=f.store(),stale=f.store();
 await first.save(r,product(50),'dog',()=>true);stale.remember(f.items);
 await first.save(r,product(100),'dog',()=>true);const count=f.writes.length;
 await assert.rejects(stale.save(r,product(200),'dog',()=>true),/다른 화면/);assert.equal(f.writes.length,count);assert.equal(f.items[0].body.value,100);
 f.lose=true;await first.save(r,product(150),'dog',()=>true);assert.equal(f.items.length,1);assert.equal(f.items[0].body.value,150);
});
test('activity units reload as IU and unsupported storage units are not claimed saved',async()=>{
 const f=fixture(),r=I.parse('x 2 IU/kg SC')[0],saved=await f.store().save(r,product(100,'IU'),'cat',()=>true);
 assert.equal(saved.body.unit,'U');assert.equal(I.calculate(r,5,saved,'cat').amount,.1);
 await assert.rejects(f.store().save(r,product(2,'mEq'),'cat',()=>true),/지원하지/);
});
