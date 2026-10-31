const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function openPage(t,width=1680,presets=[]){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/index.html');
 await p.evaluate((presets)=>{saasMode='auth';saasSessionMeta={id:'flow-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[...presets,{id:'cf_carprofen',revision:1,body:{kind:'tablet',title:'시험 카프로펜 25mg',value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['carprofen'],calculationBasis:'carprofen',warnings:[],sourceUrl:'https://example.test/label',checkedAt:'2026-10-25'}}}],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');},presets);
 await navigatePractice(p,'처방·처치 계산');return p;
}
async function openKind(p,kind){if(p.viewportSize().width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('.pt-calc-menu [data-kind="'+kind+'"]').click();await p.waitForTimeout(100);}
async function context(p){await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}
async function navigatePractice(p,label){const keys={'처방·처치 계산':'calc','사전문진':'intake','업무 체크리스트':'ops'},nav=p.locator('.clinic-navigation');if(await nav.count()){if(!await nav.isVisible())await p.locator('[data-practice-menu]').click();const button=nav.locator('[data-tab="'+keys[label]+'"]'),group=button.locator('xpath=ancestor::details[1]');if(!await group.evaluate(d=>d.open))await group.locator('summary').first().click();await button.click();}else await p.getByRole('button',{name:label,exact:true}).click();}


for(const width of [390,768,1440,1920])test('calculator layout and sidebar remain usable '+width,async t=>{
 const p=await openPage(t,width);await context(p);
 for(const kind of ['cri','nutrition','anesthesia','transfusion','batch']){
  await openKind(p,kind);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),kind+' horizontal overflow');
  if(width>800){const a=await p.locator('.pt-calc-common').boundingBox(),s=await p.locator('[data-calc-search]').boundingBox();assert.ok(s.y>=a.y+a.height-1,kind+' search hidden under context');}
 }
 await p.screenshot({path:path.join(root,'../calculator-clarity-'+width+'.png'),fullPage:true});
});
test('transfusion waits for product, exposes actual timing and retains expired deadline',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'transfusion');const f=p.locator('[data-calc=transfusion]'),d=f.locator('.pt-transfusion-time-settings'),note=f.locator('[data-transfusion-timing-note]');
 assert.equal(await d.isVisible(),false);await f.locator('[name=product]').selectOption('packed');assert.equal(await d.isVisible(),true);assert.match(await d.locator('summary').first().innerText(),/4시간.*15분/);assert.equal(await f.locator('[name=hours]').isVisible(),false);
 await d.locator(':scope>summary').click();await f.locator('[name=hours]').fill('3.75');assert.match(await d.locator('summary').first().innerText(),/3시간 45분/);
 await f.locator('[name=timing]').selectOption('4');await f.locator('[name=elapsedMinutes]').evaluate(e=>{e.value='241';e.dispatchEvent(new Event('input',{bubbles:true}));});await d.locator(':scope>summary').click();assert.equal(await note.isVisible(),true);assert.match(await note.innerText(),/완료 시점이 지났/);
});
test('CRI choice uses full entry width before selecting and concentration words agree',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'cri');const f=p.locator('[data-calc=cri]');assert.match(await f.getAttribute('class'),/pt-cri-choosing/);
 const box=await f.boundingBox(),entry=await f.locator('.pt-flow-entry').boundingBox();assert.ok(entry.width>box.width*.9);
 await f.locator('[data-cri-drug]').first().click();assert.doesNotMatch(await f.getAttribute('class'),/pt-cri-choosing/);assert.match(await f.locator('[data-cri-stock]').locator('..').innerText(),/농도/);
 assert.equal(await f.locator('[data-cri-stock] option').first().innerText(),'농도 선택');
});
test('anesthesia two column cards retain input, warning, evidence and selected priority',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'anesthesia');const cards=p.locator('[data-an-drug]:visible');
 const a=await cards.nth(0).boundingBox(),z=await cards.nth(1).boundingBox();assert.ok(z.x>a.x+a.width-1);assert.ok(Math.abs(z.y-a.y)<2);
 const card=p.locator('[data-an-drug=butorphanol]');await card.locator('[data-an-dose]').fill('0.5');assert.match(await card.innerText(),/문헌 범위 밖/);assert.match(await card.locator('output').innerText(),/mL/);
 await card.locator('[data-an-selected]').check();assert.equal(await card.evaluate(e=>getComputedStyle(e).order),'-1');
});
test('oral input tabs track photo and saved modes; clear stays by text',async t=>{
 const p=await openPage(t);await context(p);const nav=p.locator('.pt-prescription-inputs');
 assert.equal(await nav.locator('[data-prescription-text]').getAttribute('aria-pressed'),'true');assert.equal(await nav.locator('[data-rx-clear]').count(),0);assert.equal(await p.locator('.pt-prescription-clear [data-rx-clear]').isVisible(),true);
 await nav.locator('[data-prescription-photo]').click();await p.waitForFunction(()=>document.querySelector('[data-mode=image]')?.getAttribute('aria-pressed')==='true');assert.equal(await nav.locator('[data-prescription-photo]').getAttribute('aria-pressed'),'true');
 await nav.locator('[data-prescription-text]').click();await nav.locator('[data-prescription-saved]').click();assert.equal(await nav.locator('[data-prescription-saved]').getAttribute('aria-pressed'),'true');
});
test('nutrition has one saved selector and goal before product; empty saved menu is compact',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');
 assert.equal(await f.locator('[data-nutrition-product]').isVisible(),false);assert.equal(await f.locator('[data-protocol=nutrition]').isVisible(),false);assert.doesNotMatch(await f.innerText(),/저장된 계산 설정이 없습니다/);
 const d=f.locator('.pt-saved-settings');await d.locator('summary').click();assert.equal(await f.locator('[data-protocol=nutrition]').isVisible(),true);assert.equal(await f.locator('[data-nutrition-scope]').isVisible(),true);
 const goal=await f.locator('.pt-nutrition-plan').boundingBox(),bar=await f.locator('.pt-protocol-bar').boundingBox();assert.ok(bar.y>=goal.y+goal.height);
});

const foodPreset={id:'food',revision:1,body:{kind:'protocol',calculator:'nutrition',title:'시험 급여 설정',species:'dog',source:'Test',defaults:{multiplier:'1.6',density:'100',unit:'kcal/can',meals:'3'}}};
test('one nutrition list applies product only without changing goal, or complete settings with review',async t=>{
 const p=await openPage(t,1440,[foodPreset]);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');
 await f.locator('[name=nutritionProfile]').selectOption('loss');await f.locator('[name=targetWeight]').fill('4');const multiplier=await f.locator('[name=multiplier]').inputValue();
 await f.locator('.pt-saved-settings>summary').click();await f.locator('[data-protocol=nutrition]').selectOption('food');await p.waitForFunction(()=>document.querySelector('[data-calc=nutrition] [name=density]').value==='100');
 assert.equal(await f.locator('[name=multiplier]').inputValue(),multiplier);assert.equal(await f.locator('[name=targetWeight]').inputValue(),'4');assert.equal(await f.locator('[name=nutritionProfile]').inputValue(),'loss');assert.equal(await f.locator('[name=meals]').inputValue(),'3');
 await f.locator('[data-nutrition-scope]').selectOption('all');await f.locator('[data-nutrition-reapply]').click();await p.waitForFunction(()=>document.querySelector('[data-calc=nutrition] [name=multiplier]').value==='1.6');assert.match(await f.locator('[data-protocol-status]').innerText(),/불러왔습니다/);assert.equal(await p.locator('[data-common-weight]').inputValue(),'5');
});
test('nutrition rejects delayed product response after patient species change',async t=>{
 const p=await openPage(t,1440,[foodPreset]);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');await f.locator('.pt-saved-settings>summary').click();
 await p.evaluate(()=>{const old=saasRequest;saasRequest=async(...args)=>{await new Promise(r=>setTimeout(r,500));return old(...args);};});
 await f.locator('[data-protocol=nutrition]').selectOption('food');await p.locator('[data-ref-species]').selectOption('cat');await p.waitForTimeout(650);assert.notEqual(await f.locator('[name=density]').inputValue(),'100');
});

test('saved setting failure remains visible outside the collapsed chooser',async t=>{
 const p=await openPage(t,1440,[foodPreset]);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');await f.locator('.pt-saved-settings>summary').click();await f.locator('[data-nutrition-scope]').selectOption('all');
 await p.evaluate(()=>{saasRequest=async()=>{throw Error('시험 연결 실패');};});await f.locator('[data-protocol=nutrition]').selectOption('food');await p.waitForFunction(()=>document.querySelector('[data-calc=nutrition] [data-protocol-status]').textContent.includes('실패'));
 await f.locator('.pt-saved-settings>summary').click();assert.equal(await f.locator('[data-protocol-status]').isVisible(),true);assert.match(await f.locator('[data-protocol-status]').innerText(),/실패/);
});
