
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{resolve}=require('node:path');
const a=require('../practice-anesthesia.js');
async function setup(t){assert.ok(process.env.TRAINING_WORKER_ROOT,'Set TRAINING_WORKER_ROOT to the reviewed Worker fixture');const {fixture}=await import(pathToFileURL(resolve(process.env.TRAINING_WORKER_ROOT,'test/helpers/practice-fixture.mjs')).href);return fixture(t);}
test('existing encrypted preset API round-trips every anesthesia concentration and paired stock',async t=>{
 const f=await setup(t);
 for(const d of a.drugs){const body=a.stockBody(d,d.stock||.5,d.companion?.stock),result=await f.extras('/presets','POST',body);
 const saved=(await f.extras('/presets')).items.find(x=>x.id===result.id);assert.deepEqual(a.savedFact(saved,d),{value:body.value,companionStock:d.companion?.stock??null});
 await f.extras('/presets/'+result.id,'PUT',{...body,value:body.value*2,revision:saved.revision});
 const changed=(await f.extras('/presets')).items.find(x=>x.id===result.id);assert.equal(changed.revision,2);assert.equal(a.savedFact(changed,d).value,body.value*2);
 await assert.rejects(f.extras('/presets/'+result.id,'PUT',{...body,revision:saved.revision}),e=>e.statusCode===409);
 }
 assert.equal((await f.extras('/presets')).items.length,14);
 assert.equal((await f.extras('/presets','GET',undefined,f.other)).items.length,0);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM care_calc_presets WHERE body_cipher LIKE ?').get('enc:%').n,14);
});
test('preset storage does not grant staff write access or other hospital updates',async t=>{
 const f=await setup(t),body=a.stockBody(a.drugs[0],10),r=await f.extras('/presets','POST',body);
 await assert.rejects(f.extras('/presets','POST',body,f.staff),e=>e.statusCode===403);
 await assert.rejects(f.extras('/presets/'+r.id,'PUT',{...body,value:20,revision:1},f.other),e=>e.statusCode===404);
 const item=(await f.extras('/presets')).items[0];assert.equal(item.body.value,10);
});
