const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();});
const root=path.resolve(__dirname,'..');
for(const [kind,globalName] of [['chronic','ChronicRecord'],['neuro','NeuroRecord'],['ophthalmic','OphthalmicRecord']]){
 for(const registered of [true,false])test(`${kind}: shared start saves ${registered?'registered identity without master-data mutation':'quick patient identity'}`,async()=>{
  const p=await browser.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const manifest=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script id="clinic-module-manifest"[^>]*>([^<]+)<\/script>/)[1];
  await p.route('http://localhost/**',r=>{
   const file=new URL(r.request().url()).pathname.slice(1);
   if(['chronic-record.js','neuro-record.js','ophthalmic-record.js'].includes(file))return r.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync(path.join(root,file))});
   return r.fulfill({contentType:'text/html; charset=utf-8',body:'<script id="clinic-module-manifest" type="application/json">'+manifest+'</script><main id="root"></main>'});
  });
  await p.goto('http://localhost/');
  for(const file of ['clinic-record-start.js','clinic-lazy-modules.js'])await p.addScriptTag({path:path.join(root,file)});
  await p.evaluate(kind=>ClinicLazyModules.ensure(kind),kind);
  await p.evaluate(async({globalName,kind})=>{
   window.requests=[];window.saved=null;
   window.synthetic={id:'synthetic-patient',name:'시험 환자',species:'dog',weight:7.5,guardianName:'시험 보호자',chartNumber:'TEST-42',breed:'시험 품종',birthDate:'2020-02-03',sex:'female',neutered:true};
   const request=async(url,options={})=>{
    const body=options.body?JSON.parse(options.body):null;requests.push({url,body});
    if(url.includes('/patient-directory'))return {items:[synthetic],patients:[synthetic]};
    if(url==='/practice/clinical/cases'&&body){
     const chart=body[kind+'Chart'];
     if(body.patientId&&['guardianName','chartNumber'].some(k=>Object.hasOwn(chart.patient,k)))throw Error('Registered identity must not be overwritten');
     saved=body;return {id:'synthetic-record',revision:1,[kind+'Chart']:chart};
    }
    if(url.includes('/cases/synthetic-record?'))return {item:{id:'synthetic-record',revision:1,patient_id:saved.patientId||'',patient:saved.patientId?synthetic:{...saved.quickPatient,species:'dog'},body:{category:kind,species:'dog',[kind+'Chart']:saved[kind+'Chart']}},canManage:true};
    return {items:[],members:[],patients:[],records:[],sources:[],cursor:'',hasMore:false};
   };
   window.controller=window[globalName].mount(document.querySelector('#root'),{ready:()=>true,identity:()=>kind,can:()=>true,medical:()=>true,clinicalManage:()=>true,request,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),toast:()=>{},user:()=>({name:'시험 직원'}),self:()=>({name:'시험 직원'})});
   await controller.open();
  },{globalName,kind});
  await p.locator('[data-act="new"],[data-nr="new"]').click();
  // Fill quick identity first to exercise stale-key cleanup when switching modes.
  await p.locator('[data-start-field="name"]').fill('직접 입력 환자');
  await p.locator('[data-start-field="chartNumber"]').fill('QUICK-1');
  await p.locator('[data-start-field="species"]').selectOption('dog');
  await p.locator('.cs-start-extra').evaluate(e=>e.open=true);
  await p.locator('[data-start-field="guardianName"]').fill('직접 입력 보호자');
  if(registered){
   await p.locator('[data-start-mode="registered"]').click();
   await p.locator('[data-start-search-form] input').fill('시험');
   await p.locator('[data-start-search-form] button').click();
   await p.locator('[data-start-pick="0"]').click();
   assert.equal(await p.locator('[data-start-field="guardianName"]').inputValue(),'시험 보호자');
   assert.equal(await p.locator('[data-start-field="chartNumber"]').inputValue(),'TEST-42');
  }
  if(kind==='chronic'){await p.locator('[data-start-option="cardiac"]').check();await p.locator('[data-start-option="cushing"]').check();}
  await p.locator('[data-start-submit]').click();
  await p.waitForFunction(()=>window.saved!==null,{},{timeout:5000});
  const payload=await p.evaluate(()=>saved),patient=payload[kind+'Chart'].patient;
  if(registered){
   assert.equal(payload.patientId,'synthetic-patient');
   assert.equal(Object.hasOwn(patient,'guardianName'),false);
   assert.equal(Object.hasOwn(patient,'chartNumber'),false);
   assert.equal(patient.breed,'시험 품종');
   assert.equal(payload[kind+'Chart'].weight,7.5);
  }else{
   assert.equal(payload.quickPatient.guardianName,'직접 입력 보호자');
   assert.equal(payload.quickPatient.chartNumber,'QUICK-1');
  }
  await p.waitForFunction(()=>!document.querySelector('[data-start-submit]'),{},{timeout:5000});
  assert.equal(await p.evaluate(()=>requests.filter(r=>r.url==='/practice/clinical/cases'&&r.body).length),1);
  await p.evaluate(()=>controller.openRecord('synthetic-record'));
  assert.equal(await p.locator('[data-start-submit]').count(),0);
  assert.match(await p.locator('#root').innerText(),/시험 환자|직접 입력 환자/);
  if(kind==='chronic'){
   await p.evaluate(()=>ClinicLazyModules.ensure('ophthalmic'));
   assert.equal(await p.locator('script[src^="ophthalmic-record.js"]').count(),1);
  }
  assert.deepEqual(errors,[]);
  await p.close();
 });
}
