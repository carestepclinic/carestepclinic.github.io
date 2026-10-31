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

test('transfusion distinguishes empty input, real elapsed deadline and reset',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'transfusion');const f=p.locator('[data-calc=transfusion]'),note=f.locator('[data-transfusion-timing-note]');
 assert.doesNotMatch(await f.innerText(),/완료 시점이 지났/);
 await f.locator('[name=product]').selectOption('packed');assert.match(await note.innerText(),/4시간/);
 await f.locator('[name=elapsedMinutes]').evaluate(e=>{e.value='241';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.match(await note.innerText(),/완료 시점이 지났/);
 await f.locator('[name=product]').selectOption('');assert.equal(await note.isVisible(),false);
 await f.locator('[name=product]').selectOption('other');assert.match(await note.innerText(),/총 계획 시간을 입력/);
});
for(const width of [390,768,1440])test('fluid tasks retain inputs, calculate and hand off without duplicate forms '+width,async t=>{
 const p=await openPage(t,width);await context(p);await openKind(p,'fluid');const plan=p.locator('.pt-fluid-plan'),f=p.locator('[data-calc=fluid]');
 assert.equal(await plan.isVisible(),true);assert.equal(await f.isVisible(),false);
 for(const [key,value] of Object.entries({dehydration:'5',hours:'12',loss:'2',other:'3'}))await plan.locator('[data-fp='+key+']').fill(value);
 await plan.locator('[data-fp-confirm]').check();assert.equal(await plan.locator('[data-fp-run]').isVisible(),false);assert.match(await plan.locator('output').innerText(),/32.333/);
 await plan.locator('[data-fp-apply]').click();assert.equal(await f.isVisible(),true);assert.equal(await plan.isVisible(),false);
 assert.ok(Math.abs(Number(await f.locator('[name=rate]').inputValue())-32.3333333333)<1e-8);
 assert.match(await f.locator('output').innerText(),/32.333/);
 await p.locator('[data-fluid-task=plan]').click();assert.equal(await plan.locator('[data-fp=dehydration]').inputValue(),'5');
 assert.equal(await plan.locator('[data-guidance=references]').count(),1);await plan.locator('[data-guidance=references]>summary').click();assert.ok(await plan.locator('a[href*="aaha.org"]').isVisible());
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 const left=await plan.locator('.pt-flow-entry').boundingBox(),right=await plan.locator('.pt-flow-result').boundingBox();if(width>1100)assert.ok(right.x>left.x+left.width);else assert.ok(right.y>=left.y+left.height);
 await p.screenshot({path:path.join(root,'../calculator-consistency-fluid-'+width+'.png'),fullPage:true});
});
test('form terminology follows actual dosage form and keeps manual calculation exact',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');
 assert.match(await f.locator('[name=concentration]').locator('..').innerText(),/제품 농도 · mg\/mL/);
 assert.equal(await f.locator('.pt-extra-settings').count(),1);assert.equal(await f.locator('[data-prep-open]').isVisible(),false);
 await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');
 await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('0.4'));
 assert.match(await f.locator('[name=concentration]').locator('..').innerText(),/제품 함량 · mg\/정/);
 assert.equal(await f.locator('[data-copy]').isDisabled(),true);
 await f.locator('.pt-extra-settings>summary').click();await f.locator('.pt-preparation>summary').click();assert.equal(await f.locator('[data-prep-open]').isVisible(),true);
 assert.equal(await f.locator('[data-guidance=help]').count(),1);await f.locator('[data-guidance=help]>summary').click();assert.match(await f.innerText(),/개수\(T\)/);
});
test('anesthesia keeps clinical warnings and save feedback with two concise provenance labels',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'anesthesia');const card=p.locator('[data-an-drug=butorphanol]');
 assert.match(await card.locator('[data-an-dose-state]').innerText(),/용량: 문헌 참고값/);assert.match(await card.locator('[data-an-origin]').innerText(),/농도: 제품 참고값/);
 assert.equal(await card.locator('[data-an-save-state]').isVisible(),false);assert.match(await card.innerText(),/단독 진통제/);
 await card.locator('[data-an-dose]').fill('0.5');assert.match(await card.locator('[data-an-dose-state]').innerText(),/문헌 범위 밖/);
 await card.locator('[data-an-stock]').fill('5');assert.match(await card.locator('[data-an-save-state]').innerText(),/저장/);
 assert.match(await card.locator('output').innerText(),/1회 투여량 0.5 mL · 1회 약물량 2.5 mg/);
 await card.locator('.pt-flow-an-manage>summary').click();assert.equal(await card.locator('[data-an-save]').isVisible(),true);
 const panel=p.locator('[data-kind-panel=anesthesia]');assert.equal(await panel.locator(':scope > .pt-guidance > details').count(),2);
});
for(const width of [390,1440])test('navigation has one injection entry and guidance stays reachable without overflow '+width,async t=>{
 const p=await openPage(t,width);await context(p);await p.locator('[data-injection-mode=injection]').click();assert.equal(await p.locator('[data-injection-text-mode]').isVisible(),false);assert.equal(await p.locator('[data-injection-text]').isVisible(),true);assert.equal(await p.locator('[data-injection-clear]').isVisible(),true);
 for(const kind of ['cri','potassium','transfusion','acid','nutrition','emergency','anesthesia']){await openKind(p,kind);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),kind);}
 await openKind(p,'cri');assert.equal(await p.locator('[data-cri-picker]>summary').innerText(),'약물 선택');assert.equal(await p.locator('[data-cri-search]').locator('..').innerText(),'약물 찾기');
 await openKind(p,'nutrition');assert.match(await p.locator('[data-calc=nutrition]').innerText(),/저장 설정 불러오기/);assert.equal(await p.locator('[data-nutrition-product]').isVisible(),false);await p.locator('[data-calc=nutrition] .pt-saved-settings>summary').click();assert.equal(await p.locator('[data-nutrition-scope]').isVisible(),true);
 await openKind(p,'batch');await p.locator('[data-injection-mode=injection]').click();await p.screenshot({path:path.join(root,'../calculator-consistency-injection-'+width+'.png'),fullPage:true});
});

