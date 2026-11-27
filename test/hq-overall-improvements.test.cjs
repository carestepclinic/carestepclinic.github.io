const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1);if(name.includes('/')||!/^[-\w.]+\.(html|js|css|woff2|png)$/.test(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.png':'image/png'})[path.extname(name)]);res.end(fs.readFileSync(path.join(root,name)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(t,width=1440){
 const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});await p.goto(origin+'/hq.html');
 await p.evaluate(()=>{
  window.reads=[];window.writes=[];window.identity='synthetic';hqSessionToken=()=>identity;window.holdSources=false;
  window.partner={id:'partner1',name:'합성 제휴사',code:'TEST',status:'active',partnershipModel:'referral',billingOwner:'carestep',partnerSharePercent:30,settlementMethod:'revenue_share',settlementDay:10};
  const doc={id:'doc1',variantId:'1',disease:'합성 질환',species:'dog',title:'시험 설명',procedure:'시험 진료',status:'published',revision:2,sourceCurrent:null,reviewProgress:{pending:0},gaps:0};
  req=async(path,o)=>{if(o?.method&&o.method!=='GET'){writes.push(path);throw Error('No production mutations');}reads.push(path);
   if(path==='/hq/partners')return {partners:[{...partner,clinicCount:0,activeKeyCount:0}]};
   if(path==='/hq/partners/partner1')return {partner:{...partner},clinics:[],apiKeys:[],settlements:[]};
   if(path==='/hq/clinical-storage')return {measuredAt:'2020-01-01',photosComplete:true,clinicsComplete:true,clinics:[],photos:2,photoBytes:1000,clinicalDbBytes:1000};
   if(path==='/hq/clinical-storage/maintenance')return {backup:{status:'complete',objects:2,completedAt:'2026-11-27T00:00:00Z'},external:{status:'complete'},database:{status:'complete'},configured:true,externalConfigured:true,databaseConfigured:true};
   if(path.includes('/healthcheck-usage?'))return {totals:{records:1,calls:2,estimatedUsd:.01},fullyPricedRecords:{n:1,averageUsd:.01},clinics:[],records:[],operations:[]};
   if(path.includes('consent-explanations?view=catalog'))return {items:[doc],queue:{counts:{completed:1},items:[]},backfill:{total:1,registered:1}};
   if(path.includes('consent-explanations?view=source-status')){if(holdSources)await new Promise(r=>window.releaseSources=r);return {items:[{...doc,sourceCurrent:false}]};}
   if(path.startsWith('/hq/incidents?')){const q=new URL(path,'https://test.invalid').searchParams;return {incidents:[{id:q.get('cursor')?'old2':'old1',clinicName:'합성 병원',message:'시험 이력',area:'test',status:'open',createdAt:'2020-01-01'}],asOf:'2026-11-27T00:00:00Z',nextCursor:q.get('cursor')?'':'cursor2'};}
   return {ok:true,items:[],clinics:[],contents:[],requests:[],incidents:[]};
  };
  document.querySelector('#loginOverlay').classList.add('hidden');
 });return p;
}
for(const width of [1440,390])test('separate cost, storage and partner workspaces load only their own data '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{reads=[];showView('aiCost');});await p.locator('#hqHealthcheckUsage .kpi').first().waitFor();assert.equal(await p.locator('#hqCurrentView').innerText(),'건강검진 AI 원가');assert.ok(!(await p.evaluate(()=>reads)).some(x=>x.includes('messaging-billing')||x.includes('production-launch')));
 await p.evaluate(()=>{reads=[];showView('storage');});await p.locator('#hqClinicalStorage .storage-stale').waitFor();await p.waitForFunction(()=>document.querySelector('#hqClinicalStorage').textContent.includes('전체 파일 백업 · 완료'));
 assert.equal(await p.locator('[data-storage-manual]').getAttribute('open'),null);assert.ok((await p.evaluate(()=>reads)).includes('/hq/clinical-storage/maintenance'));assert.ok(!(await p.evaluate(()=>reads)).includes('/hq/production-launch'));
 await p.evaluate(()=>showView('partners'));await p.locator('.partner-item').waitFor();await p.locator('.partner-item').click();await p.locator('#hp-pName').waitFor({state:'visible'});assert.equal(await p.locator('#hp-pName').inputValue(),'합성 제휴사');assert.equal(await p.locator('#partners input[type=password]').count(),0);assert.equal(await p.locator('#hqCurrentView').innerText(),'제휴사 관리');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await p.evaluate(()=>writes),[]);
 await p.screenshot({path:path.resolve(root,'../hq-partners-candidate-'+width+'.png'),fullPage:true});
});
test('partner input survives refresh and navigation; lock clears sensitive content',async t=>{const p=await fixture(t);await p.evaluate(()=>showView('partners'));await p.locator('.partner-item').click();await p.locator('#hp-pName').fill('아직 저장하지 않은 이름');await p.locator('#hp-refresh').click();assert.equal(await p.locator('#hp-pName').inputValue(),'아직 저장하지 않은 이름');await p.evaluate(()=>showView('aiCost'));await p.evaluate(()=>showView('partners'));assert.equal(await p.locator('#hp-pName').inputValue(),'아직 저장하지 않은 이름');await p.evaluate(()=>document.querySelector('#loginOverlay').classList.remove('hidden'));await p.waitForFunction(()=>document.querySelector('#hp-pName').value==='');assert.deepEqual(await p.evaluate(()=>writes),[]);});
test('consent rows render before slow source verification, then changed filter becomes accurate',async t=>{const p=await fixture(t);await p.evaluate(()=>{holdSources=true;showView('consentLibrary');});await p.locator('.ce-card').waitFor();assert.equal(await p.locator('[data-ce-queue]').getAttribute('open'),null);assert.ok(await p.locator('[data-ce-source-state]').innerText());await p.locator('[data-ce-filter]').selectOption('changed');assert.equal(await p.locator('.ce-card').count(),0);await p.waitForFunction(()=>typeof releaseSources==='function');await p.evaluate(()=>releaseSources());await p.locator('.ce-card').waitFor();assert.match(await p.locator('.ce-card').innerText(),/원본 변경/);assert.deepEqual(await p.evaluate(()=>writes),[]);});
test('late source reply after HQ lock does not repopulate private material',async t=>{const p=await fixture(t);await p.evaluate(()=>{holdSources=true;showView('consentLibrary');});await p.locator('.ce-card').waitFor();await p.waitForFunction(()=>typeof releaseSources==='function');await p.evaluate(()=>{document.querySelector('#loginOverlay').classList.remove('hidden');identity='different';releaseSources();});await p.waitForFunction(()=>!document.querySelector('.ce-card'));assert.equal(await p.locator('.ce-card').count(),0);});
test('incident period filters and next/previous pages do not resolve any records',async t=>{const p=await fixture(t);await p.evaluate(()=>showView('production'));await p.waitForFunction(()=>document.querySelector('[data-inc-position]').textContent.includes('1페이지'));await p.locator('#incidentPeriod').selectOption('older');await p.waitForFunction(()=>reads.some(x=>x.includes('period=older')));await p.locator('[data-inc-next]').click();await p.waitForFunction(()=>document.querySelector('[data-inc-position]').textContent.includes('2페이지'));assert.ok((await p.evaluate(()=>reads)).some(x=>x.includes('cursor=cursor2')));await p.locator('[data-inc-prev]').click();await p.waitForFunction(()=>document.querySelector('[data-inc-position]').textContent.includes('1페이지'));assert.deepEqual(await p.evaluate(()=>writes),[]);});
test('old anchor links resolve to independent views',async t=>{const p=await fixture(t);await p.evaluate(()=>location.hash='#usageBilling/cost');await p.waitForFunction(()=>document.querySelector('#aiCost').classList.contains('active'));await p.evaluate(()=>location.hash='#production/storage');await p.waitForFunction(()=>document.querySelector('#storage').classList.contains('active'));assert.equal(await p.locator('#hqCurrentView').innerText(),'백업·복구·저장 공간');});
