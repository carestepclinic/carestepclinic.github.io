const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function openPage(t,width=1680){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/index.html');
 await p.evaluate(()=>{saasMode='auth';saasSessionMeta={id:'flow-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[{id:'cf_carprofen',revision:1,body:{kind:'tablet',title:'시험 카프로펜 25mg',value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['carprofen'],calculationBasis:'carprofen',warnings:[],sourceUrl:'https://example.test/label',checkedAt:'2026-10-25'}}}],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');});
 await navigatePractice(p,'처방·처치 계산');return p;
}
async function openKind(p,kind){if(p.viewportSize().width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('.pt-calc-menu [data-kind="'+kind+'"]').click();await p.waitForTimeout(100);}
async function context(p){await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}
async function navigatePractice(p,label){const keys={'처방·처치 계산':'calc','사전문진':'intake','업무 체크리스트':'ops'},nav=p.locator('.clinic-navigation');if(await nav.count()){if(!await nav.isVisible())await p.locator('[data-practice-menu]').click();const button=nav.locator('[data-tab="'+keys[label]+'"]'),group=button.locator('xpath=ancestor::details[1]');if(!await group.evaluate(d=>d.open))await group.locator('summary').first().click();await button.click();}else await p.getByRole('button',{name:label,exact:true}).click();}

async function setupStore(p){await p.evaluate(()=>{
 window.testStrengths=[];window.testStrengthWrites=[];const old=saasRequest;
 saasRequest=async(path,options)=>{path=path.replace(/^\/saas/,'');
  if(path.startsWith('/practice/presets'))return {items:structuredClone(testStrengths),canManage:true,strengthsVersion:1};
  if(path==='/practice/strengths'){
   const b=JSON.parse(options.body).items[0];testStrengthWrites.push(b);const before=testStrengths.find(p=>p.body.strength.ingredientId===b.ingredientId);
   const saved={id:before?.id||'saved-'+testStrengths.length,revision:(before?.revision||0)+1,body:{title:b.name,kind:b.kind,value:b.value,unit:b.unit,strength:{ingredientId:b.ingredientId,name:b.name,english:b.english,aliases:b.aliases,species:b.species,route:b.route,injectionRoute:b.injectionRoute,release:b.release}}};
   testStrengths=testStrengths.filter(p=>p.id!==saved.id).concat(saved);return {results:[{status:'saved',id:saved.id}]};
  }return old(path,options);
 };
 PracticeStrengths.catalog=async()=>({ingredients:[{id:'manual-0123456789abcdef0123',name:'케타민',english:'ketamine',options:[10,50].map(value=>({id:'k'+value,kind:'liquid',route:'injection',unit:'mg',value,release:'standard'}))}]});
});}
for(const width of [390,1440])test('combination calculator auto-saves selection and manual concentration, recalls after changing patient weight '+width,async t=>{
 const p=await openPage(t,width);await setupStore(p);await context(p);await p.locator('[data-injection-mode=injection]').click();
 await p.locator('[data-injection-text]').fill('Ketamine 5 mg/kg + medetomidine 20 ug/kg iv');await p.locator('[data-injection-row]').nth(1).waitFor();
 const ket=p.locator('[data-injection-row="0"]'),med=p.locator('[data-injection-row="1"]');
 await ket.locator('[data-rx-product]').selectOption('catalog:manual-0123456789abcdef0123:k50');
 await ket.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor().catch(async()=>{throw Error(await ket.innerText());});assert.match(await ket.locator('output').innerText(),/0.5 mL/);
 await med.locator('[data-rx-product]').selectOption('manual');await med.locator('[data-rx-strength]').fill('1000');await med.locator('[data-rx-strength]').press('Tab');
 await med.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();assert.match(await med.locator('output').innerText(),/0.1 mL/);
 assert.equal(await p.evaluate(()=>testStrengths.length),2);
 await ket.locator('[data-rx-confirm]').check();await med.locator('[data-rx-confirm]').check();assert.equal(await p.locator('[data-injection-copy]').isVisible(),true);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(root,'../injection-combo-'+width+'.png'),fullPage:true});
 await p.locator('[data-common-weight]').fill('10');await p.waitForFunction(()=>document.querySelector('[data-injection-row="0"] output')?.textContent.includes('1 mL'));
 assert.match(await ket.locator('output').innerText(),/1 mL/);assert.match(await med.locator('output').innerText(),/0.2 mL/);
 assert.match(await ket.locator('[data-rx-product]').inputValue(),/^saved-/);assert.match(await med.locator('[data-rx-product]').inputValue(),/^saved-/);
 assert.equal(await ket.locator('[data-rx-confirm]').isChecked(),false);assert.equal(await p.evaluate(()=>testStrengthWrites.length),2);
 await navigatePractice(p,'업무 체크리스트');await navigatePractice(p,'처방·처치 계산');await context(p);await p.locator('[data-injection-mode=injection]').click();await p.locator('[data-injection-text]').fill('Ketamine 5 mg/kg + medetomidine 20 ug/kg iv');
 await p.waitForFunction(()=>document.querySelector('[data-injection-row="1"] output')?.textContent.includes('0.1 mL'));assert.match(await med.locator('[data-rx-product]').inputValue(),/^saved-/);
});
test('anesthesia preparation modal uses the same persisted concentrations without creating administration events',async t=>{
 const p=await openPage(t);await setupStore(p);
 await p.evaluate(()=>{
  window.planWrites=[];window.modalWeight=5;
  window.openSyntheticInduction=()=>PracticeInjectionWorkflow.record({item:{id:'synthetic-case',revision:1,patient:{name:'합성 환자'}},identity:()=> 'synthetic-clinic',patient:()=>({clinicalCaseId:'synthetic-case'}),species:()=> 'dog',weight:()=>modalWeight,valid:()=>true,request:(...args)=>saasRequest(...args),products:async()=>(await saasRequest('/practice/presets')).items,
   modal:(title,html,submit)=>{const d=document.createElement('dialog');d.innerHTML='<form>'+html+'<button type="submit">저장</button></form>';document.body.append(d);d.showModal();d.querySelector('form').onsubmit=async e=>{e.preventDefault();await submit(e.target);d.close();d.remove();};return d;},save:async(kind,body)=>{planWrites.push({kind,body});return {revision:2};}},'induction');openSyntheticInduction();
 });
 const d=p.locator('dialog[open]');await d.locator('[data-injection-text]').fill('Ketamine 5 mg/kg + medetomidine 20 ug/kg iv');await d.locator('[data-injection-read]').click();
 for(const [i,value,unit] of [[0,'50','mg'],[1,'1','mg']]){const r=d.locator('[data-injection-row]').nth(i);await r.locator('[data-rx-product]').selectOption('manual');await r.locator('[data-rx-unit]').selectOption(unit);await r.locator('[data-rx-strength]').fill(value);await r.locator('[data-rx-strength]').press('Tab');await r.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();await r.locator('[data-rx-confirm]').check();}
 await d.locator('[data-injection-apply]').click();await d.locator('[name=injectionConfirm]').check();await d.locator('[type=submit]').click();
 const writes=await p.evaluate(()=>planWrites);assert.equal(writes.length,1);assert.equal(writes[0].kind,'anesthesia.medication-plan');assert.equal(writes[0].body.items.length,2);assert.ok(writes[0].body.items.every(x=>x.phase==='induction'));assert.deepEqual(writes[0].body.items.map(x=>x.medication.amount),[.5,.1]);
 await p.evaluate(()=>{modalWeight=10;openSyntheticInduction();});await d.locator('[data-injection-text]').fill('Ketamine 5 mg/kg + medetomidine 20 ug/kg iv');await d.locator('[data-injection-read]').click();await d.locator('[data-injection-row]').nth(1).waitFor();assert.match(await d.locator('[data-injection-row]').nth(1).locator('output').innerText(),/0.2 mL/);
});
test('failed autosave keeps the calculated value and exposes retry without claiming persistence',async t=>{
 const p=await openPage(t);await setupStore(p);await p.evaluate(()=>{window.rejectSave=true;const old=saasRequest;saasRequest=async(path,options)=>{if(rejectSave&&path.endsWith('/strengths'))throw Error('합성 연결 오류');return old(path,options);};});
 await context(p);await p.locator('[data-injection-mode=injection]').click();await p.locator('[data-injection-text]').fill('ketamine 5 mg/kg IV');const r=p.locator('[data-injection-row]').first();await r.locator('[data-rx-product]').selectOption('catalog:manual-0123456789abcdef0123:k50');
 await r.locator('[data-strength-retry]').waitFor();assert.match(await r.locator('[data-strength-save-status]').innerText(),/저장 안 됨/);assert.match(await r.locator('output').innerText(),/0.5 mL/);assert.equal(await p.evaluate(()=>testStrengths.length),0);
 await p.evaluate(()=>rejectSave=false);await r.locator('[data-strength-retry]').click();await r.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();assert.equal(await p.evaluate(()=>testStrengths.length),1);
});
test('result handoff waits for the selected concentration save to settle',async t=>{
 const p=await openPage(t);await setupStore(p);await p.evaluate(()=>{const old=saasRequest;saasRequest=async(path,options)=>{if(path.endsWith('/strengths'))await new Promise(resolve=>window.releaseStrengthSave=resolve);return old(path,options);};});
 await context(p);await p.locator('[data-injection-mode=injection]').click();await p.locator('[data-injection-text]').fill('ketamine 5 mg/kg IV');const r=p.locator('[data-injection-row]').first();await r.locator('[data-rx-product]').selectOption('catalog:manual-0123456789abcdef0123:k50');await p.waitForFunction(()=>typeof releaseStrengthSave==='function');await r.locator('[data-rx-confirm]').check();
 assert.equal(await p.locator('[data-injection-copy]').isVisible(),false);await p.evaluate(()=>releaseStrengthSave());await r.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();assert.equal(await p.locator('[data-injection-copy]').isVisible(),true);
});

