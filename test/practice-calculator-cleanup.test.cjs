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


test('single drug result has no empty save disclosure, reviewed prescriptions retain saving',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');
 await f.locator('[name=concentration]').fill('10');await f.locator('[name=dose]').fill('2');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('1회'));
 assert.equal(await f.locator('.pt-result-more').isVisible(),false);await f.locator('[data-checked]').check();assert.equal(await f.locator('.pt-result-more').isVisible(),false);
 await p.locator('[data-injection-mode=oral]').click();const rx=p.locator('[data-calc=batch]');await rx.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await rx.locator('.pt-rx-summary-total').waitFor();await rx.locator('[data-checked]').check();
 await rx.locator('.pt-result-more>summary').click();assert.equal(await rx.locator('[data-rx-save-set]').isVisible(),true);assert.match(await rx.locator('.pt-result-more>summary').innerText(),/처방 저장/);
});
test('nutrition has direct scoped save action and no stale location guide',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');
 assert.doesNotMatch(await f.innerText(),/아래.*서식 관리/);assert.match(await f.locator('.pt-nutrition-save-scope').innerText(),/RER 배수·제품 열량·단위·급여 횟수/);
 await f.locator('[name=multiplier]').fill('1.6');await f.locator('[name=density]').fill('3');await f.locator('[name=unit]').selectOption('kcal/g');await f.locator('[name=meals]').fill('2');
 await f.locator('[data-nutrition-save]').click();await p.locator('dialog[open]').waitFor();assert.match(await p.locator('dialog[open]').innerText(),/계산 설정/);assert.equal(await f.locator('[name=multiplier]').inputValue(),'1.6');
});
test('missing input links use actual field labels including potassium concentration',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'potassium');const f=p.locator('[data-calc=potassium]');
 await p.waitForTimeout(250);
 for(const button of await f.locator('.pt-remaining [data-field-name]').all()){
 const name=await button.getAttribute('data-field-name');if(['confirmed','protocolConfirmed'].includes(name))continue;
 const label=await f.locator('[name="'+name+'"]').evaluate(e=>e.closest('label')?.firstChild?.textContent.trim());
 assert.equal(await button.innerText(),label,name);
 }
 assert.equal(await f.locator('[data-k-reference-status]').innerText(),'');
 await f.locator('[name=serumK]').fill('2.55');assert.match(await f.locator('[data-k-reference-status]').innerText(),/경계·중간값/);assert.equal(await f.locator('[name=added]').inputValue(),'');
});
for(const width of [390,1440])test('fluid plan automatically calculates after confirmation and invalidates changes '+width,async t=>{
 const p=await openPage(t,width);await context(p);await openKind(p,'fluid');const f=p.locator('.pt-fluid-plan');
 assert.equal(await f.locator('h3').isVisible(),false);assert.equal(await f.locator('output').isVisible(),false);
 for(const [key,value]of Object.entries({dehydration:'5',hours:'12',loss:'2',other:'3'}))await f.locator('[data-fp='+key+']').fill(value);
 await f.locator('[data-fp-confirm]').check();assert.match(await f.locator('output').innerText(),/주입속도 ≈ 32.333/);assert.equal(await f.locator('[data-fp-run]').isVisible(),false);
 await f.locator('[data-fp=hours]').fill('0');assert.equal(await f.locator('[data-fp-confirm]').isChecked(),false);assert.equal(await f.locator('output').isVisible(),false);
 await f.locator('[data-fp-confirm]').check();assert.equal(await f.locator('[data-fp-run]').isVisible(),true);assert.equal(await f.locator('[data-fp-apply]').isVisible(),false);
 await f.locator('[data-fp=hours]').fill('12');await f.locator('[data-fp-confirm]').check();await p.locator('[data-common-weight]').fill('6');assert.equal(await f.locator('output').isVisible(),false);assert.equal(await f.locator('[data-fp-confirm]').isChecked(),false);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(root,'../calculator-cleanup-fluid-'+width+'.png'),fullPage:true});
});
test('anesthesia common confirmation is single and medicine-specific caution remains',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'anesthesia');const panel=p.locator('[data-kind-panel=anesthesia]'),card=panel.locator('[data-an-drug=butorphanol]');
 assert.equal((await panel.innerText()).split('계획에 추가하기 전 용량·경로·실제 제품을 확인하세요.').length-1,1);
 assert.match(await card.innerText(),/단독 진통제/);assert.equal(await card.locator('.pt-an-provenance').count(),1);
 assert.match(await card.locator('label.pt-choice').innerText(),/계획에 추가/);await card.locator('.pt-flow-an-manage>summary').click();assert.equal(await card.locator('[data-an-save]').innerText(),'병원 약물 농도 저장');
});
test('emergency result labels preserve dilution distinction and numeric result',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'emergency');
 const epi=p.locator('[data-em-row=epinephrine]');assert.match(await epi.innerText(),/1회 투여량/);assert.match(await epi.innerText(),/0.05 mL/);
 const dob=p.locator('[data-em-row=dobutamine]');await p.locator('[data-em-filter=all]').click();
 assert.match(await dob.textContent(),/주입속도/);assert.doesNotMatch(await dob.textContent(),/예상 펌프/);
});
