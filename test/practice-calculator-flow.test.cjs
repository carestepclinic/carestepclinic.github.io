const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function openPage(t,width=1680){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/index.html');
 await p.evaluate(()=>{saasMode='auth';saasSessionMeta={id:'flow-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[{id:'cf_carprofen',revision:1,body:{kind:'tablet',title:'시험 카프로펜 25mg',value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['carprofen'],calculationBasis:'carprofen',warnings:[],sourceUrl:'https://example.test/label',checkedAt:'2026-10-25'}}}],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');});
 await navigatePractice(p,'임상 계산기');return p;
}
async function openKind(p,kind){if(p.viewportSize().width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('.pt-calc-menu [data-kind="'+kind+'"]').click();await p.waitForTimeout(100);}
async function context(p){await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}
for(const width of [390,1024,1680])test('categorized work areas share gutters and preserve calculator state '+width,async t=>{
 const p=await openPage(t,width);await context(p);await openKind(p,'med');await p.locator('[data-calc=dose] [name=dose]').fill('1.25');const boxes=[];
 for(const tab of ['업무 체크리스트','사전문진','임상 계산기']){await navigatePractice(p,tab);await p.waitForTimeout(150);boxes.push(await p.locator('#practiceRoot').boundingBox());assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));}
 assert.ok(boxes.every(x=>Math.abs(x.x-boxes[0].x)<1&&Math.abs(x.width-boxes[0].width)<1));assert.equal(await p.locator('[data-calc=dose] [name=dose]').inputValue(),'1.25');
 await p.screenshot({path:path.join(root,'../calculator-flow-shell-'+width+'.png')});
});
test('one context notice replaces repeated emergency errors and preserves ready outputs',async t=>{
 const p=await openPage(t);await openKind(p,'emergency');assert.equal(await p.locator('.pt-flow-context').isVisible(),true);assert.equal(await p.locator('.pt-em-quick').isVisible(),false);await p.locator('.pt-flow-context button').click();assert.equal(await p.locator('[data-ref-species]').evaluate(e=>e===document.activeElement),true);
 await context(p);await p.locator('.pt-em-quick').waitFor();assert.equal(await p.locator('.pt-flow-context').isVisible(),false);assert.match(await p.locator('[data-em-row=epinephrine] [data-em-q-result]').innerText(),/0.05 mL/);
 await p.locator('[data-common-weight]').fill('');await p.locator('.pt-flow-context').waitFor();assert.equal(await p.locator('.pt-em-quick').isVisible(),false);
});
test('single drug search, optional regimen and adjacent results retain native calculation',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'med');const f=p.locator('[data-calc=dose]');assert.equal(await f.locator('[data-quick-product-search]').isVisible(),true);assert.equal(await f.locator('[data-regimen-query]').isVisible(),false);await f.locator('[data-quick-product-search]').fill('carprofen');assert.equal(await f.locator('[data-regimen-query]').inputValue(),'carprofen');assert.match(await f.locator('[data-regimen]').textContent(),/카프로펜|Carprofen/);
 const entry=await f.locator('.pt-flow-entry').boundingBox(),result=await f.locator('.pt-flow-result').boundingBox();assert.ok(result.x>=entry.x+entry.width);await f.locator('.pt-medication-products>summary').click();
 await f.locator('[name=form]').selectOption('tablet');await f.locator('[name=concentration]').fill('25');await f.locator('[name=dose]').fill('2');await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('7');await f.getByRole('button',{name:'계산',exact:true}).click();assert.match(await f.locator('output').textContent(),/5.6 정/);assert.equal(await f.locator('[data-copy]').isEnabled(),false);await f.locator('[data-checked]').check();assert.equal(await f.locator('[data-copy]').isEnabled(),true);await f.locator('[name=dose]').fill('3');assert.equal(await f.locator('[data-result-actions]').isVisible(),false);
 await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(root,'../calculator-flow-med-1680.png')});
});
test('batch entry keeps save after reviewed results, retaining the review requirement',async t=>{
 const p=await openPage(t);await context(p);await openKind(p,'batch');const f=p.locator('[data-calc=batch]');assert.equal(await f.locator('.pt-flow-rx-save').isVisible(),false);assert.equal(await f.locator('.pt-flow-rx-load').evaluate(e=>e.open),false);assert.equal(await f.locator('.pt-image-launch').isVisible(),true);
 await f.locator('[data-rx-text]').fill('carprofen 2 mg/kg po bid for 7 days');await f.locator('.pt-rx-summary-total').first().waitFor();await f.locator('.pt-flow-rx-save').waitFor();assert.equal(await f.locator('[data-checked]').isChecked(),false);await f.locator('[data-rx-save-set]').click();assert.equal(await p.locator('dialog[open]').count(),0);assert.match(await f.locator('[data-rx-reuse-status]').innerText(),/확인/);
 await f.locator('[data-checked]').check();await f.locator('[data-rx-save-set]').click();await p.locator('dialog[open]').waitFor();
});
test('mobile emergency filter, potassium reference and input-result sequence',async t=>{
 const p=await openPage(t,390);await context(p);await openKind(p,'emergency');assert.equal(await p.locator('nav[aria-label="응급약물 분류"]').isVisible(),false);await p.locator('.pt-flow-em-filter select').selectOption('cri');assert.equal(await p.locator('[data-em-filter=cri]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-em-row=epinephrine]').isVisible(),false);
 await openKind(p,'potassium');assert.equal(await p.locator('[data-k-preparation]>details').evaluate(e=>e.open),false);assert.equal(await p.locator('[data-k-reference-status]').count(),1);
 await openKind(p,'fluid');const f=p.locator('[data-calc=fluid]'),input=await f.locator('.pt-flow-entry').boundingBox(),result=await f.locator('.pt-flow-result').boundingBox();assert.ok(result.y>=input.y+input.height);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(root,'../calculator-flow-fluid-390.png')});
});

async function navigatePractice(p,label){const keys={'임상 계산기':'calc','사전문진':'intake','업무 체크리스트':'ops'},nav=p.locator('.clinic-navigation');if(await nav.count()){if(!await nav.isVisible())await p.locator('[data-practice-menu]').click();const button=nav.locator('[data-tab="'+keys[label]+'"]'),group=button.locator('xpath=ancestor::details[1]');if(!await group.evaluate(d=>d.open))await group.locator('summary').first().click();await button.click();}else await p.getByRole('button',{name:label,exact:true}).click();}
