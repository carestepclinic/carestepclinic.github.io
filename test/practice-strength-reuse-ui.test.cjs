const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>{await browser.close();});
async function page(t,width=1440){const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());await p.route('http://localhost/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await p.goto('http://localhost/');await p.setContent('<main><form id="ward"></form><div id="oral"></div></main>');for(const file of ['practice-injection.js','practice-ingredients.js'])await p.addScriptTag({path:path.join(root,file)});return p;}
async function ward(p){await p.evaluate(()=>{
 window.items=[];window.writes=[];window.added=[];window.freshReads=[];window.weight=5;window.clinic='a';window.fail=false;
 const stock=value=>({id:'catalog:'+value,body:{title:'Alpha '+value,kind:'liquid',value,unit:'mg',strength:{route:'injection',species:['cat','dog'],english:'alpha',aliases:['alpha','알파']}}});
 window.request=async(url,opt)=>{if(!opt)return {items:structuredClone(items),canManage:true};const b=JSON.parse(opt.body).items[0];if(fail)throw Error('연결 실패');if(window.hold)await new Promise(r=>window.release=r);writes.push(b);const old=items.find(p=>p.body.strength.ingredientId===b.ingredientId);const v={id:old?.id||'saved'+items.length,revision:(old?.revision||0)+1,body:{kind:b.kind,value:b.value,unit:b.unit,title:b.name,strength:{...b,version:1}}};items=items.filter(p=>p.id!==v.id).concat(v);return {results:[{status:'saved',id:v.id}]};};
 window.openWard=()=>{document.querySelector('#ward').replaceChildren();const scope=clinic;window.widget=PracticeInjection.mount(document.querySelector('#ward'),{valid:()=>clinic===scope,species:()=> 'dog',weight:()=>weight,products:async(options)=>{freshReads.push(options?.fresh);return [...structuredClone(options?.fresh?items:[]),stock(10),stock(50)];},request,strengthsChanged:()=>{},add:rows=>added.push(rows)});};openWard();
 });}
async function read(p,text){await p.locator('[data-injection-text]').fill(text);await p.locator('[data-injection-read]').click();await p.locator('[data-injection-row]').first().waitFor();}
for(const width of [390,1440])test('ward selection and manual entry survive closing, new weight and alternate name '+width,async t=>{
 const p=await page(t,width);await ward(p);await read(p,'alpha 2 mg/kg IV\nbeta 1 mg/kg SC');
 const a=p.locator('[data-injection-row="0"]'),b=p.locator('[data-injection-row="1"]');
 await a.locator('[data-rx-product]').selectOption('catalog:50');await a.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();
 await b.locator('[data-rx-product]').selectOption('manual');await b.locator('[data-rx-strength]').fill('20');await b.locator('[data-rx-strength]').press('Tab');await b.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();
 await a.locator('[data-rx-confirm]').check();await b.locator('[data-rx-confirm]').check();await p.locator('[data-injection-apply]').click();assert.equal(await p.evaluate(()=>added[0].length),2);
 await p.evaluate(()=>{weight=10;widget.dispose();openWard();});await read(p,'알파 2 mg/kg IV\nbeta 1 mg/kg SC');
 assert.match(await a.locator('[data-rx-product]').inputValue(),/^saved/);assert.match(await b.locator('[data-rx-product]').inputValue(),/^saved/);assert.match(await a.locator('output').innerText(),/0.4 mL/);assert.match(await b.locator('output').innerText(),/0.5 mL/);
 assert.match(await a.locator('[data-strength-save-status]').innerText(),/자동 적용/);assert.equal(await p.evaluate(()=>freshReads.every(Boolean)),true);assert.equal(await p.evaluate(()=>writes.length),2);
 await p.evaluate(()=>{widget.dispose();clinic='b';items=[];openWard();});await read(p,'알파 2 mg/kg IV');assert.equal(await a.locator('[data-rx-product]').inputValue(),'');
});
test('ward prevents re-reading while saving and exposes failed persistence separately',async t=>{
 const p=await page(t);await ward(p);await read(p,'alpha 2 mg/kg IV');await p.evaluate(()=>hold=true);const r=p.locator('[data-injection-row]');await r.locator('[data-rx-product]').selectOption('catalog:50');await p.waitForFunction(()=>typeof release==='function');await p.locator('[data-injection-read]').click();assert.match(await p.locator('[data-injection-status]').innerText(),/저장 완료 후/);await r.locator('[data-rx-confirm]').check();assert.equal(await p.locator('[data-injection-apply]').isDisabled(),true);await p.evaluate(()=>{hold=false;release();});await r.locator('[data-strength-save-status]').filter({hasText:'농도 저장됨'}).waitFor();
 await p.evaluate(()=>fail=true);await r.locator('[data-rx-product]').selectOption('catalog:10');await r.locator('[data-strength-retry]').waitFor();await r.locator('[data-rx-confirm]').check();await p.locator('[data-strength-retry]').waitFor();await p.locator('[data-injection-apply]').click();assert.match(await p.locator('[data-injection-status]').innerText(),/저장되지 않아/);assert.equal(await p.evaluate(()=>items[0].body.value),50);
});
async function oral(p){await p.evaluate(async()=>{
 await PracticeIngredients.configure({ingredients:[{id:'mfds-00000000000000000000',name:'알파',english:'alpha',aliases:['alpha'],options:[{id:'a10',route:'oral',kind:'tablet',unit:'mg',value:10,release:'standard'}]}]});window.calls=[];
 window.openOral=(canManage=true)=>PracticeIngredients.mountCard(document.querySelector('#oral'),{row:{drug:'alpha',doseUnit:'mg'},items:[],species:'cat',phaseCount:1,canManage,alive:()=>true,invalidate:()=>{},cancel:()=>{},apply:async(value,settings)=>{calls.push({value,settings});}});openOral();
 });}
test('oral concentration apply saves by default and can explicitly be one prescription only',async t=>{
 const p=await page(t);await oral(p);await p.locator('[data-ingredient-choice]').selectOption('catalog:mfds-00000000000000000000:a10');await p.locator('[data-ingredient-confirm]').check();await p.locator('[data-ingredient-apply]').click();assert.equal(await p.evaluate(()=>calls[0].settings.save),true);assert.deepEqual(await p.evaluate(()=>calls[0].settings.species),['cat']);
 await p.evaluate(()=>openOral());await p.locator('[data-ingredient-choice]').selectOption('manual');await p.locator('[data-ingredient-value]').fill('15');await p.locator('[data-ingredient-autosave]').uncheck();await p.locator('[data-ingredient-confirm]').check();await p.locator('[data-ingredient-apply]').click();assert.equal(await p.evaluate(()=>calls[1].settings.save),false);
});
test('oral manual concentration validates before saving and read-only users retain calculation access',async t=>{
 const p=await page(t);await oral(p);await p.locator('[data-ingredient-choice]').selectOption('manual');await p.locator('[data-ingredient-value]').fill('-1');await p.locator('[data-ingredient-confirm]').check();await p.locator('[data-ingredient-apply]').click();assert.equal(await p.evaluate(()=>calls.length),0);
 await p.locator('[data-ingredient-value]').fill('30');await p.locator('[data-ingredient-confirm]').check();await p.locator('[data-ingredient-apply]').click();assert.equal(await p.evaluate(()=>calls[0].settings.save),true);assert.equal(await p.evaluate(()=>calls[0].value.value),30);
 await p.evaluate(()=>openOral(false));assert.equal(await p.locator('[data-ingredient-autosave]').count(),0);await p.locator('[data-ingredient-choice]').selectOption('catalog:mfds-00000000000000000000:a10');await p.locator('[data-ingredient-confirm]').check();await p.locator('[data-ingredient-apply]').click();assert.equal(await p.evaluate(()=>calls[1].settings.save),false);
});
