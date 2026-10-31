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
 const p=await openPage(t,width);await context(p);await p.locator('.pt-prescription-modes').waitFor();assert.equal(await p.locator('.pt-rx-review').isVisible(),false);assert.equal(await p.locator('.pt-rx-view-tabs').isVisible(),false);assert.equal(await p.locator('#globalCaseBadge').isVisible(),false);
 assert.equal(await p.locator('[data-kind-panel=batch]').isVisible(),true);
 assert.equal(await p.locator('.pt-calc-menu [data-kind=med]').count(),0);
 assert.equal(await p.locator('.pt-calc-menu [data-kind=convert]').count(),1);
 assert.deepEqual(await p.locator('.pt-calc-group h4').allTextContents(),['약물 투여','수액·주입','보충·보정','영양·환산']);
 await p.locator('[data-prescription-manual]').click();assert.equal(await p.locator('[data-calc=dose]').isVisible(),true);
 await p.locator('[data-injection-mode=injection]').click();assert.equal(await p.locator('[data-injection-calculator]').isVisible(),true);
 await p.locator('[data-injection-mode=oral]').click();assert.equal(await p.locator('[data-rx-text]').isVisible(),true);
 const register=p.getByRole('button',{name:'약물·함량 등록',exact:true});assert.equal(await register.count(),1);assert.equal(await register.isVisible(),true);assert.equal(await register.locator('xpath=ancestor::details').count(),0);await register.click();const dialog=p.getByRole('dialog');await dialog.getByRole('heading',{name:'성분별 기본 함량',exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'목록에 없는 함량 직접 추가',exact:true}).isVisible(),true);assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await dialog.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await p.locator('[data-common-weight]').inputValue(),'5');
 assert.equal(await p.locator('.pt-calc-view-tools > .pt-reset-calculation').isVisible(),true);assert.equal(await p.locator('.pt-reset-calculation').innerText(),'전체 초기화');assert.equal(await p.locator('.pt-workspace-more .pt-reset-calculation').count(),0);
 assert.equal(await p.locator('.pt-workspace-more>summary').innerText(),'병원 설정');assert.equal(await p.locator('.pt-calc-view-tools .pt-drug-management').isVisible(),false);await p.locator('.pt-workspace-more>summary').click();assert.equal(await p.locator('.pt-workspace-options .pt-drug-management').isVisible(),true);assert.equal(await p.locator('.pt-drug-management > summary').isVisible(),false);assert.ok(await p.locator('.pt-workspace-options').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.locator('.pt-workspace-more>summary').click();var header=await p.locator('.pt-calc-common').boundingBox();assert.ok(header.height<=(width>1150?100:width>800?140:240),'compact header '+header.height);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.screenshot({path:path.join(root,'../calculator-header-'+width+'.png'),fullPage:false});
});
test('manual entry auto-calculates and clears stale results without granting export confirmation',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');
 if(!await f.locator('.pt-medication-products').evaluate(e=>e.open))await f.locator('.pt-medication-products>summary').click();await f.locator('.pt-course-settings>summary').click();await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('7');
 await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('5.6 정'));
 assert.equal(await f.locator('[data-copy]').isEnabled(),false);await f.locator('[data-checked]').check();assert.equal(await f.locator('[data-copy]').isEnabled(),true);
 await f.locator('[name=dose]').fill('3');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('8.4 정'));assert.equal(await f.locator('[data-copy]').isEnabled(),false);
 await f.locator('[name=dose]').fill('');await p.waitForTimeout(500);assert.equal(await f.locator('[data-result-actions]').isVisible(),false);
});
test('automatic oral calculations, pending expansion, saved/photo entry and responsive result columns',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days\nunknownmedicine 1 mg/kg po bid for 7 days');
 await f.locator('.pt-rx-summary-total').first().waitFor();assert.match(await f.locator('.pt-rx-summary-total').first().innerText(),/5.6/);
 assert.equal(await f.locator('.pt-rx-drug-card:has([data-pending=true])').locator('.pt-card-edit').evaluate(e=>e.open),true);
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
 await openKind(p,'convert');assert.equal(await p.locator('[data-kind-panel=convert]').isVisible(),true);
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
 await openKind(p,'convert');await p.waitForTimeout(100);assert.equal(await p.locator('[data-calc-jump]').inputValue(),'convert');
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

test('result column stays in place and stale output cannot be used during a rewrite',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]'),result=f.locator('.pt-prescription-result');
 const before=await result.boundingBox();await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await p.waitForTimeout(100);
 const ready=await result.boundingBox();assert.equal(Math.round(ready.x),Math.round(before.x));assert.equal(Math.round(ready.width),Math.round(before.width));
 await f.locator('[data-checked]').check();await f.locator('[data-rx-text]').fill('carprofen 3 mg/kg po bid for 7 days');await p.waitForTimeout(100);
 assert.match(await f.locator('.pt-result-placeholder').innerText(),/이전 결과는 사용할 수 없습니다/);assert.equal(await f.locator('.pt-result-use').isVisible(),false);
 assert.equal(await f.locator('.pt-previous-results button,.pt-previous-results input').count(),0);
 await p.waitForFunction(()=>document.querySelector('.pt-rx-summary-total')?.textContent.includes('8.4'));
 assert.equal(await f.locator('[data-checked]').isChecked(),false);assert.equal(await f.locator('[data-rx-parse]').isVisible(),false);await p.screenshot({path:path.join(root,'../calculator-simple-result-pc.png'),fullPage:true});await p.setViewportSize({width:390,height:900});await p.screenshot({path:path.join(root,'../calculator-simple-result-mobile.png'),fullPage:true});
 await p.locator('[data-common-weight]').fill('6');await p.waitForTimeout(60);assert.equal(await f.locator('.pt-previous-results').count(),0);
});

test('schedule summary preserves mixed daily and EOD stages and opens missing conditions',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days -> 1 mg/kg po EOD for 14 days');await f.locator('.pt-rx-summary-total').first().waitFor();
 assert.match(await f.locator('.pt-schedule-summary>summary').innerText(),/약물별 일정 2종/);assert.match(await f.locator('.pt-rx-drug-summary>summary').innerText(),/8–21일/);assert.match(await f.locator('.pt-rx-drug-summary>summary').innerText(),/격일/);
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg');await p.waitForFunction(()=>document.querySelector('[data-calc=batch]').dataset.calculationState==='review');
 assert.equal(await f.locator('.pt-schedule-summary').evaluate(e=>e.open),true);assert.equal(await f.locator('[data-rx-common=days]').isVisible(),true);
});

test('one modification entry per card retains manual concentration and invalidates export',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await p.waitForTimeout(100);
 const card=f.locator('.pt-rx-drug-card');assert.equal(await card.locator('.pt-card-edit').count(),1);assert.equal(await card.locator('[data-rx-edit]').isVisible(),false);assert.equal(await card.locator('.pt-card-edit>summary').innerText(),'수정');await f.locator('[data-checked]').check();
 await card.locator('.pt-card-edit>summary').click();await card.locator('[data-ingredient-choice]').selectOption('manual');await card.locator('[data-ingredient-value]').fill('50');
 assert.equal(await f.locator('[data-copy]').isEnabled(),false);await card.locator('[data-ingredient-confirm]').check();await card.locator('[data-ingredient-apply]').click();
 await p.waitForFunction(()=>document.querySelector('.pt-rx-summary-total')?.textContent.includes('2.8'));assert.equal(await f.locator('[data-checked]').isChecked(),false);
});

test('result use survives repeated calculation and saves only explicitly reviewed current output',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');
 await p.evaluate(()=>{window.savedRx=[];const original=saasRequest;saasRequest=async(path,options)=>{if(path.endsWith('/practice/rx/sets')&&options?.method==='POST'){window.savedRx.push(JSON.parse(options.body));return {ok:true};}return original(path,options);};});
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await p.waitForTimeout(100);
 await f.locator('.pt-result-more>summary').click();assert.equal(await f.locator('[data-print]').isEnabled(),false);await f.locator('[data-checked]').check();assert.equal(await f.locator('[data-print]').isEnabled(),true);await p.waitForFunction(()=>!document.querySelector('[data-ward-calculator-import]').disabled);
 await f.locator('[data-rx-text]').fill('carprofen 3 mg/kg po bid for 7 days');await p.waitForFunction(()=>document.querySelector('.pt-rx-summary-total')?.textContent.includes('8.4'));await p.waitForTimeout(100);
 assert.equal(await f.locator('[data-rx-save-set]').count(),1);assert.equal(await f.locator('[data-print]').count(),1);assert.equal(await f.locator('[data-print]').isEnabled(),false);
 await f.locator('[data-rx-save-set]').click();assert.equal(await p.locator('dialog[open]').count(),0);assert.equal(await p.evaluate(()=>savedRx.length),0);
 await f.locator('[data-checked]').check();await f.locator('[data-rx-save-set]').click();const dialog=p.locator('dialog[open]');await dialog.locator('[name=title]').fill('합성 시험 세트');await dialog.locator('[name=indication]').fill('시험');await dialog.locator('[name=source]').fill('시험 기준');assert.equal(await dialog.locator('[name=confirm]').count(),0);
 await dialog.locator('form button').click();await p.waitForFunction(()=>window.savedRx.length===1);assert.equal(await p.evaluate(()=>savedRx[0].confirm),true);assert.equal(await p.evaluate(()=>savedRx[0].rows[0].dose),3);
});

test('reviewed save is rejected if inputs change while dialog is open',async t=>{
 const p=await openPage(t);await context(p);const f=p.locator('[data-calc=batch]');await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await f.locator('[data-checked]').check();await f.locator('.pt-result-more>summary').click();await f.locator('[data-rx-save-set]').click();const dialog=p.locator('dialog[open]');
 await dialog.locator('[name=title]').fill('합성 시험');await dialog.locator('[name=indication]').fill('시험');await dialog.locator('[name=source]').fill('시험');await p.evaluate(()=>{const w=document.querySelector('[data-common-weight]');w.value='7';w.dispatchEvent(new Event('input',{bubbles:true}));});await dialog.locator('form button').click();assert.match(await dialog.locator('[data-status]').innerText(),/확인|바뀌|검토|계산/);
});

test('results precede optional reference management while active safety findings stay visible',async t=>{
 const p=await openPage(t,390);await context(p);const f=p.locator('[data-calc=batch]');
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days\nprednisolone 0.5 mg/kg po sid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await p.waitForTimeout(400);
 assert.equal(await f.locator('[data-private-originals]').evaluate(e=>e.open),false);assert.equal(await f.locator('[data-private-summary]').isVisible(),true);
 const warning=f.locator('[data-safety-findings] .pt-safety-warning').first();assert.equal(await warning.isVisible(),true);
 const resultBox=await f.locator('output').boundingBox(),safetyBox=await f.locator('.pt-rx-safety').boundingBox();assert.ok(safetyBox.y>=resultBox.y+resultBox.height);
 assert.equal(await f.locator('[data-private-prepare]').count(),0);await p.locator('.pt-workspace-more>summary').click();assert.equal(await p.locator('[data-library-knowledge]').isVisible(),true);assert.equal(await p.locator('[data-private-prepare]').count(),0);
});

test('nine completed prescriptions form a compact three-column grid on desktop',async t=>{
 const p=await openPage(t);await context(p);await p.evaluate(()=>{const original=saasRequest;saasRequest=async(path,options)=>{if(path.includes('/presets'))return {items:'abcdefghi'.split('').map(letter=>({id:'cf_'+letter,revision:1,body:{kind:'tablet',title:'시험약 '+letter,value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['testdrug'+letter],calculationBasis:'testdrug'+letter,warnings:[]}}})),canManage:true};return original(path,options);};});
 const f=p.locator('[data-calc=batch]');await f.locator('[data-rx-text]').fill('abcdefghi'.split('').map(c=>'testdrug'+c+' 2 mg/kg po bid for 7 days').join('\n'));await p.waitForFunction(()=>document.querySelector('[data-calc=batch]').dataset.calculationState==='complete');
 const cards=f.locator('.pt-rx-drug-card');assert.equal(await cards.count(),9);const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox(),c=await cards.nth(2).boundingBox(),d=await cards.nth(3).boundingBox();assert.equal(a.y,b.y);assert.equal(b.y,c.y);assert.ok(d.y>a.y);assert.ok(a.height<270);assert.ok((await cards.nth(0).locator('.pt-rx-summary-total strong').boundingBox()).height<36);
 await p.screenshot({path:path.join(root,'../calculator-simple-nine-pc.png'),fullPage:true});
});

for(const width of [390,1680])test('efficiency: single dose needs no schedule; course and concentration edits recalculate safely '+width,async t=>{
 const p=await openPage(t,width);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');
 assert.equal(await f.locator('[name=courseMode]').inputValue(),'single');assert.equal(await f.locator('[name=times]').isVisible(),false);assert.equal(await f.locator('[name=days]').isVisible(),false);
 assert.equal(await f.locator('.pt-medication-products [name=concentration]').isVisible(),true);
 await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');
 await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('0.4 정/회'));
 assert.doesNotMatch(await f.locator('output').innerText(),/전체 필요량/);await f.locator('[data-checked]').check();
 await f.locator('.pt-course-settings>summary').click();await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('7');
 await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('5.6 정'));assert.equal(await f.locator('[data-copy]').isEnabled(),false);
 await f.locator('[name=courseMode]').selectOption('single');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('0.4 정/회'));assert.doesNotMatch(await f.locator('output').innerText(),/전체 필요량/);
 assert.equal(await f.locator('.pt-product-fields>summary').isVisible(),false);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.screenshot({path:path.join(root,'../calculator-efficient-single-'+width+'.png'),fullPage:true});
});
for(const width of [390,1680])test('efficiency: injection paste autocalculates, retains reviewed source and invalidates use after changes '+width,async t=>{
 const p=await openPage(t,width);await context(p);await p.locator('[data-injection-mode=injection]').click();const f=p.locator('.pt-injection-workspace');
 await f.locator('[data-injection-text]').fill('SyntheticA 1 mg/kg IV\nSyntheticB 1 mL IM');
 await f.locator('[data-injection-row]').nth(1).waitFor();assert.equal(await f.locator('[data-injection-read]').isVisible(),false);
 const row=f.locator('[data-injection-row]').first();await row.locator('[data-rx-product]').selectOption('manual');await row.locator('[data-rx-strength]').fill('10');assert.match(await row.locator('output').innerText(),/0.5 mL/);
 assert.equal(await f.locator('[data-injection-apply]').isEnabled(),false);const confirmations=await f.locator('[data-rx-confirm]').all();await confirmations[0].check();assert.equal(await f.locator('[data-injection-copy]').isVisible(),false);await confirmations[1].check();assert.equal(await f.locator('[data-injection-apply]').isVisible(),false);
 assert.equal(await f.locator('[data-injection-copy]').isVisible(),true);await f.locator('[data-rx-confirm]').first().uncheck();assert.equal(await f.locator('[data-injection-copy]').isVisible(),false);await f.locator('[data-rx-confirm]').first().check();assert.equal(await f.locator('[data-injection-copy]').isVisible(),true);await p.screenshot({path:path.join(root,'../calculator-consistent-injection-'+width+'.png'),fullPage:true});assert.match(await f.locator('[data-injection-text]').inputValue(),/SyntheticA/);assert.equal(await f.locator('[data-injection-preview]').isVisible(),false);
 await p.locator('[data-injection-mode=oral]').click();await p.locator('[data-injection-mode=injection]').click();assert.equal(await row.locator('[data-rx-strength]').inputValue(),'10');assert.equal(await f.locator('[data-injection-copy]').isVisible(),true);await row.locator('.pt-injection-edit>summary').click();await row.locator('[data-rx-strength]').fill('20');assert.equal(await f.locator('[data-injection-copy]').isVisible(),false);assert.equal(await row.locator('[data-rx-confirm]').isChecked(),false);assert.match(await row.locator('output').innerText(),/0.25 mL/);
 await p.locator('[data-common-weight]').fill('6');await p.waitForFunction(()=>document.querySelectorAll('[data-injection-row]').length===2);assert.equal(await f.locator('[data-injection-copy]').isVisible(),false);
 await p.evaluate(()=>document.querySelector('.pt-organized').dispatchEvent(new CustomEvent('practice-patient-changed')));assert.equal(await f.locator('[data-injection-text]').inputValue(),'');
 await f.locator('[data-injection-clear]').click();assert.equal(await f.locator('[data-injection-row]').count(),0);assert.equal(await f.locator('[data-injection-text]').inputValue(),'');assert.equal(await f.locator('[data-injection-copy]').isVisible(),false);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
});
test('efficiency: shared missing inputs and reset scope are stated once; blank output stays compact',async t=>{
 const p=await openPage(t);assert.equal(await p.locator('.pt-reset-calculation').textContent(),'전체 초기화');assert.ok((await p.locator('.pt-result-placeholder').boundingBox()).height<80);
 await openKind(p,'cri');assert.equal(await p.locator('.pt-flow-context').isVisible(),true);assert.equal(await p.locator('[data-cri-status]').isVisible(),false);assert.equal(await p.locator('.pt-prescription-modes').isVisible(),false);
 await context(p);assert.equal(await p.locator('.pt-flow-context').isVisible(),false);assert.equal(await p.getByText('제품·장비 기본값 연결됨',{exact:true}).count(),0);
});
test('efficiency: preparation candidates use one dose after switching away from a longer course',async t=>{
 const p=await openPage(t);await context(p);await p.locator('[data-prescription-manual]').click();const f=p.locator('[data-calc=dose]');await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');
 await f.locator('.pt-course-settings>summary').click();await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('7');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('5.6 정'));
 await f.locator('[name=courseMode]').selectOption('single');await p.waitForFunction(()=>document.querySelector('[data-calc=dose] output').textContent.includes('0.4 정/회'));
 await f.locator('.pt-extra-settings>summary').click();await f.locator('.pt-dispense summary').click();await f.locator('[data-dispense-step]').fill('0.5');await f.locator('[data-dispense-source]').fill('Synthetic fixture');await f.locator('[data-dispense-run]').click();assert.match(await f.locator('[data-dispense-result]').innerText(),/총 0.5 정/);assert.doesNotMatch(await f.locator('[data-dispense-result]').innerText(),/총 7 정/);
});

for(const width of [390,1680])test('compact context: missing input focus, patient disclosure and one-click settings '+width,async t=>{
 const p=await openPage(t,width);await openKind(p,'emergency');const common=p.locator('.pt-calc-common');
 assert.ok((await common.boundingBox()).height<=(width>800?115:250));
 await p.locator('.pt-flow-context button').click();assert.equal(await p.locator('[data-ref-species]').evaluate(e=>e===document.activeElement),true);
 await p.locator('[data-ref-species]').selectOption('dog');await p.waitForTimeout(100);await p.locator('.pt-flow-context button').click();assert.equal(await p.locator('[data-common-weight]').evaluate(e=>e===document.activeElement),true);
 await p.locator('[data-common-weight]').fill('5');await p.locator('.pt-patient-options>summary').click();assert.equal(await p.locator('[data-patient-search]').isVisible(),true);assert.ok(await common.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.locator('.pt-patient-options>summary').click();
 await p.locator('.pt-workspace-more>summary').click();const menu=p.locator('.pt-workspace-options');await menu.getByRole('button',{name:'수액 계산 설정',exact:true}).click();assert.equal(await p.locator('.pt-workspace-more').evaluate(e=>e.open),false);assert.equal(await p.locator('[data-kind-panel=fluid]').isVisible(),true);assert.equal(await p.locator('[data-calc=fluid] [data-protocol-manage]').isVisible(),true);
 await openKind(p,'convert');assert.equal(await p.locator('[data-calc=convert]').isVisible(),true);assert.equal(await p.locator('[data-common-weight]').inputValue(),'5');
});
