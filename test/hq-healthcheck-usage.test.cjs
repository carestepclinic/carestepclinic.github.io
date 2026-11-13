const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
let browser;before(async()=>{browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});after(async()=>browser?.close());
for(const width of [1440,390])test('full HQ authorizes cost display only after connection and clears on lock '+width,async()=>{
 const fs=require('node:fs'),root=path.resolve(__dirname,'..'),p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url()),file=path.resolve(root,'.'+u.pathname);if(u.hostname==='localhost'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});return r.abort();});
 await p.goto('http://localhost/hq.html');await p.waitForTimeout(100);assert.equal(await p.locator('#hqHealthcheckUsage .kpi').count(),0);
 await p.evaluate(()=>{window.costCalls=[];req=async url=>{costCalls.push(url);return {totals:{records:1,calls:2,estimatedUsd:.013,unknownCalls:0},fullyPricedRecords:{n:1,averageUsd:.013,maxUsd:.013},clinics:[],operations:[],records:[],totalRecords:0,note:'가상 집계'};};document.querySelector('#loginOverlay').classList.add('hidden');document.querySelectorAll('.view.active').forEach(e=>e.classList.remove('active'));document.querySelector('#usageBilling').classList.add('active');});
 await p.locator('#hqHealthcheckUsage .kpi').first().waitFor();assert.equal(await p.evaluate(()=>costCalls.filter(x=>x.includes('/healthcheck-usage?')).length),1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(root,'../healthcheck-hq-'+width+'.png'),fullPage:true});
 await p.evaluate(()=>{document.querySelector('#usageBilling').classList.remove('active');document.querySelector('#loginOverlay').classList.remove('hidden');});await p.waitForTimeout(30);assert.equal(await p.locator('#hqHealthcheckUsage .kpi').count(),0);assert.deepEqual(errors,[]);await p.close();
});
for(const width of [1440,390])test('HQ cost view filters, unknown costs, failures, clear cancels stale replies '+width,async()=>{
 const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent('<main id="root"></main>');await p.addStyleTag({content:'*{box-sizing:border-box}body{font:14px Arial;margin:12px}.table-wrap{overflow:auto}.head,.hc-cost-filters{display:flex;gap:10px;flex-wrap:wrap}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.table{min-width:650px}td{padding:5px}'});
 await p.addScriptTag({path:path.join(__dirname,'../hq-healthcheck-usage.js')});
 await p.evaluate(()=>{window.calls=[];window.fail=false;window.hold=false;window.reply=null;window.view=HqHealthcheckUsage.mount(document.querySelector('#root'),async url=>{calls.push(url);if(hold)await new Promise(r=>reply=r);if(fail)throw Error('가상 연결 오류');return {totals:{records:2,calls:4,estimatedUsd:.03,unknownCalls:2},fullyPricedRecords:{n:1,averageUsd:.03,maxUsd:.03},clinics:[{clinicId:'a',clinicName:'가상 병원',calls:4,unknownCalls:2,estimatedUsd:.03}],operations:[],records:[],totalRecords:0,note:'가상 집계 · 비용 미확인은 0원이 아닙니다.'};});});
 await p.locator('[data-cost-refresh]').click();await p.getByText('$0.030000',{exact:true}).first().waitFor();assert.match(await p.locator('#root').innerText(),/비용 미확인/);assert.equal(await p.locator('[data-cost-clinic] option').count(),2);
 await p.locator('[data-cost-clinic]').selectOption('a');await p.waitForFunction(()=>calls.length===2);assert.match(await p.evaluate(()=>calls.at(-1)),/clinic=a/);
 await p.evaluate(()=>fail=true);await p.locator('[data-cost-refresh]').click();await p.getByText('조회 실패 · 가상 연결 오류').waitFor();assert.equal(await p.getByText('$0.030000',{exact:true}).count(),4);
 await p.evaluate(()=>{fail=false;hold=true;view.load();});await p.waitForFunction(()=>!!reply);await p.evaluate(()=>{view.clear();reply();});await p.waitForTimeout(50);assert.equal(await p.getByText('$0.030000',{exact:true}).count(),0);assert.equal(await p.locator('[data-cost-clinic] option').count(),1);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.close();
});
