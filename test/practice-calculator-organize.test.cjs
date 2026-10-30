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

for(const width of [390,768,1024,1680])test('grouped navigation, shared prescription entry and no horizontal overflow '+width,async t=>{
 const p=await openPage(t,width);await context(p);await p.locator('.pt-prescription-modes').waitFor();
 assert.equal(await p.locator('[data-kind-panel=batch]').isVisible(),true);
 assert.equal(await p.locator('.pt-calc-menu [data-kind=med]').count(),0);
 assert.equal(await p.locator('.pt-calc-menu [data-kind=convert]').count(),0);
 assert.deepEqual(await p.locator('.pt-calc-group h4').allTextContents(),['약물 투여','수액·주입','보충·보정','영양']);
 await p.locator('[data-prescription-manual]').click();assert.equal(await p.locator('[data-calc=dose]').isVisible(),true);
 await p.locator('[data-injection-mode=injection]').click();assert.equal(await p.locator('[data-injection-calculator]').isVisible(),true);
 await p.locator('[data-injection-mode=oral]').click();assert.equal(await p.locator('[data-rx-text]').isVisible(),true);
 assert.equal(await p.locator('.pt-calc-view-tools .pt-reset-calculation').isVisible(),true);
 assert.equal(await p.locator('.pt-calc-view-tools .pt-drug-management > summary').innerText(),'병원 설정');
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.screenshot({path:path.join(root,'../calculator-organized-'+width+'.png'),fullPage:true});
});
test('manual entry auto-calculates and clears stale results without granting export confirmation',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');
 await f.locator('.pt-medication-products>summary').click();await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('7');
 await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('5.6 정'));
 assert.equal(await f.locator('[data-copy]').isEnabled(),false);await f.locator('[data-checked]').check();assert.equal(await f.locator('[data-copy]').isEnabled(),true);
 await f.locator('[name=dose]').fill('3');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('8.4 정'));assert.equal(await f.locator('[data-copy]').isEnabled(),false);
 await f.locator('[name=dose]').fill('');await p.waitForTimeout(500);assert.equal(await f.locator('[data-result-actions]').isVisible(),false);
});
test('automatic oral calculations, pending expansion, saved/photo entry and responsive result columns',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days\nunknownmedicine 1 mg/kg po bid for 7 days');
 await f.locator('.pt-rx-summary-total').first().waitFor();assert.match(await f.locator('.pt-rx-summary-total').first().innerText(),/5.6/);
 assert.equal(await f.locator('.pt-rx-drug-summary[data-pending=true]').evaluate(e=>e.open),true);
 assert.equal(await f.locator('.pt-rx-drug-summary[data-pending=false]').evaluate(e=>e.open),false);
 const a=await f.locator('.pt-prescription-entry').boundingBox(),b=await f.locator('.pt-prescription-result').boundingBox();assert.ok(b.x>=a.x+a.width);
 await f.locator('[data-prescription-saved]').click();assert.equal(await f.locator('.pt-flow-rx-load').evaluate(e=>e.open),true);
 await f.locator('[data-prescription-photo]').click();assert.equal(await f.locator('[data-photo]').isVisible(),true);await f.locator('[data-prescription-text]').click();
 await p.setViewportSize({width:390,height:900});const aa=await f.locator('.pt-prescription-entry').boundingBox(),bb=await f.locator('.pt-prescription-result').boundingBox();assert.ok(bb.y>=aa.y+aa.height);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
});
test('search groups, auxiliary conversion and form state survive category navigation',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();await p.locator('[data-calc=dose] [name=dose]').fill('1.25');
 await openKind(p,'emergency');await p.locator('[data-em-row=epinephrine]').waitFor();
 await openKind(p,'batch');await p.locator('[data-prescription-manual]').click();assert.equal(await p.locator('[data-calc=dose] [name=dose]').inputValue(),'1.25');
 await p.locator('[data-calc-search]').fill('칼륨');assert.equal(await p.locator('.pt-calc-group:not([hidden])').count(),1);assert.equal(await p.locator('.pt-calc-menu [data-kind=potassium]').isVisible(),true);
 await p.locator('[data-calc-search]').fill('notthere');assert.equal(await p.locator('[data-calc-empty]').isVisible(),true);await p.locator('[data-calc-search]').fill('');
 await p.locator('.pt-calc-view-tools [data-kind=convert]').click();assert.equal(await p.locator('[data-kind-panel=convert]').isVisible(),true);
});
test('CRI clinical checks are not automatically selected',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'cri');const f=p.locator('[data-calc=cri]');
 assert.equal(await f.locator('[name=confirmed]').isChecked(),false);assert.equal(await f.locator('.pt-flow-result [name=confirmed]').count(),1);
 await f.locator('[data-cri-manual]').click();await f.locator('[name=drug]').fill('test');await p.waitForTimeout(450);assert.equal(await f.locator('[name=confirmed]').isChecked(),false);assert.equal(await f.locator('[data-result-actions]').isVisible(),false);
});
for(const width of [390,1680])test('every calculation destination stays reachable and readable '+width,async t=>{
 const p=await openPage(t,width);await context(p);
 for(const kind of ['emergency','anesthesia','fluid','cri','potassium','transfusion','acid','nutrition','batch']){
  await openKind(p,kind);assert.equal(await p.locator('[data-kind-panel="'+kind+'"]').isVisible(),true,kind);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),kind);
 }
 await p.locator('.pt-calc-view-tools [data-kind=convert]').click();await p.waitForTimeout(100);assert.equal(await p.locator('[data-calc-jump]').inputValue(),'convert');
 if(width===390)await p.locator('[data-calc-jump]').selectOption('batch');else await openKind(p,'batch');
 assert.equal(await p.locator('.pt-prescription-modes').isVisible(),true);
});
test('fresh category opens at input and revisiting restores scroll without losing entered values',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'emergency');
 await p.evaluate(()=>window.scrollTo(0,900));const before=await p.evaluate(()=>scrollY);
 await p.evaluate(()=>document.querySelector('[data-kind=fluid]').click());await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>scrollY)<before);
 await p.evaluate(()=>document.querySelector('[data-kind=emergency]').click());await p.waitForTimeout(100);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-before)<5);
});
test('reset cancels without data loss and confirmed new calculation resets only local input',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await p.locator('.pt-rx-summary-total').first().waitFor();
 p.once('dialog',d=>d.dismiss());await p.locator('.pt-reset-calculation').click();assert.match(await p.locator('[data-rx-text]').inputValue(),/carprofen/);
 p.once('dialog',d=>d.accept());await p.locator('.pt-reset-calculation').click();await p.waitForTimeout(300);assert.equal(await p.locator('[data-rx-text]').inputValue(),'');assert.equal(await p.locator('[data-common-weight]').inputValue(),'');
 await context(p);await p.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await p.locator('.pt-rx-summary-total').first().waitFor();assert.match(await p.locator('.pt-rx-summary-total').first().innerText(),/5.6/);
});
