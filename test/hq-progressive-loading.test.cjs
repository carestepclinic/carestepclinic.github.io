const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
let browser,server,origin;
const root=resolve(__dirname,'..');
const allowed=new Set(['clinic-capabilities.js','guardian-studio.js','guardian-studio.css','hq.html','hq-ux.js','hq-ux.css','staff-training.js','staff-training-hq.js','staff-training.css','pretendard-variable-1.3.9.woff2']);
before(async()=>{
  server=http.createServer((req,res)=>{
    const file=new URL(req.url,'http://localhost').pathname.slice(1);
    if(!allowed.has(file)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'})[extname(file)]);
    res.end(readFileSync(resolve(root,file)));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();await new Promise(r=>server?server.close(r):r());});
async function fixture(t,width=1280){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});
  await page.goto(origin+'/hq.html');
  await page.evaluate(()=>{
    document.getElementById('loginOverlay').classList.add('hidden');
    window.writes=[];window.failPayment=false;window.failWrite=false;
    window.syntheticPlans=['PILOT','BASIC','PRO','ENTERPRISE'].map((code,i)=>({planCode:code,displayName:code,monthlyPriceKrw:[0,79000,169000,329000][i],annualPriceKrw:[0,790000,1690000,3290000][i],foundingMonthlyPriceKrw:[0,59000,129000,249000][i],features:{carestepHome:true,homePush:true,homeConsultation:true},limits:{members:5,packagesMonthly:500,messageCreditKrw:0,vatExclusive:true},isActive:true}));
    window.detail=id=>({clinic:{id,name:'시험 병원 '+id,plan:'BASIC',status:'active',approvalStatus:'approved'},usage:{},subscription:{planCode:'BASIC',status:'active',billingCycle:'monthly',priceOverrideKrw:86900,messagesMonthlyOverride:-1},entitlements:{plan:syntheticPlans[1]},members:[],content:[],errors:[]});
    window.baseReq=async(path,options)=>{
      if(options?.method&&options.method!=='GET'){writes.push({path,body:JSON.parse(options.body||'{}')});if(failWrite)throw Error('시험 저장 실패');if(path.startsWith('/hq/plans/'))Object.assign(syntheticPlans.find(p=>p.planCode===path.split('/').pop()),JSON.parse(options.body));return {ok:true};}
      if(path==='/hq/plans')return {plans:syntheticPlans};
      if(path==='/hq/subscriptions')return {subscriptions:[{clinicId:'A',clinicName:'시험 병원 A',planCode:'BASIC',status:'active',approvalStatus:'approved',billingCycle:'monthly',effectivePriceKrw:86900,credit:{includedKrw:0,extraBudgetKrw:0}}]};
      if(path==='/hq/overview')return {salesChannels:{direct:1,partner:0,activePartners:0}};
      if(path==='/hq/payments/overview'){if(failPayment)throw Error('시험 결제 조회 실패');return {ok:true,provider:{configured:true},subscriptions:{pastDue:0},methods:{active:0},last30Days:{paid:0,failed:0,paidKrw:0},overage:{autobill:{enabled:false}},recent:[]};}
      if(path.startsWith('/hq/clinics?'))return {clinics:[{id:'A',name:'시험 병원 A',status:'active',approvalStatus:'approved',plan:'BASIC'}]};
      if(path.startsWith('/hq/clinics/'))return detail(path.split('/').pop());
      if(path==='/hq/billing/messaging-settings')return {settings:{smsKrw:12,lmsKrw:30,mmsKrw:80,kakaoKrw:10}};
      if(path.startsWith('/hq/billing/messaging'))return {month:'2026-10',totals:{used:7},rows:[]};
      if(path.startsWith('/hq/reports/monthly'))return {totals:{packageGenerations:3},rows:[]};
      return {};
    };
    req=baseReq;window.realOverview=loadOverview;loadOverview=async()=>{};window.confirm=()=>false;
  });
  return page;
}
async function billing(page){await page.evaluate(()=>showView('billing'));await page.locator('.plan-card').first().waitFor({state:'attached'});await page.evaluate(()=>loadPaymentAutomation());await page.waitForFunction(()=>document.getElementById('hqPaymentProvider').textContent==='정상');}

for(const width of [390,1440])test('dashboard reads work first and reads expanded sections only '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(async()=>{window.reads=[];req=async(path,o)=>{reads.push(path);if(path==='/hq/overview')return {clinics:{},subscriptions:{},people:{},usage:{},content:{},voice:{},recentClinics:[]};return baseReq(path,o);};showView('dashboard');await realOverview();});
 assert.equal(await p.evaluate(()=>reads.includes('/hq/overview')||reads.includes('/hq/health')||reads.includes('/hq/deployment-status')),false);
 await p.locator('#hqOverviewMetrics>summary').click();await p.waitForFunction(()=>reads.includes('/hq/overview'));assert.equal(await p.evaluate(()=>reads.includes('/hq/health')),false);
 await p.locator('#hqOverviewMetrics>summary').click();await p.locator('#hqOverviewMetrics>summary').click();assert.equal(await p.evaluate(()=>reads.filter(x=>x==='/hq/overview').length),1);
 await p.locator('#hqDashboardDiagnostics>summary').click();await p.waitForFunction(()=>reads.includes('/hq/health')&&reads.includes('/hq/deployment-status'));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.REVIEW_SHOTS)await p.screenshot({path:resolve(process.env.REVIEW_SHOTS,'hq-progressive-'+width+'.png')});
});
test('hospital detail appears before slow catalog and choices load without replacing edits',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{window.reads=[];window.releasePlans=null;req=async(path,o)=>{reads.push(path);if(path==='/hq/plans')await new Promise(r=>releasePlans=r);return baseReq(path,o);};selectedClinic='A';showView('clinics');});
 await p.locator('#subPlan').waitFor({state:'attached'});assert.equal(await p.locator('#subPlan').isDisabled(),true);
 await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();await p.locator('#subNote').fill('새로 입력한 메모');await p.evaluate(()=>releasePlans());await p.waitForFunction(()=>document.getElementById('subPlan').dataset.catalogPending!=='true');
 assert.equal(await p.locator('#subNote').inputValue(),'새로 입력한 메모');
 await p.evaluate(async()=>{window.confirm=()=>true;await loadClinicDetail('A');});assert.equal(await p.evaluate(()=>reads.filter(x=>x==='/hq/plans').length),1);
});
test('catalog failure keeps hospital info and retry can recover',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{req=(path,o)=>path==='/hq/plans'?Promise.reject(Error('catalog failed')):baseReq(path,o);selectedClinic='A';showView('clinics');});
 await p.waitForFunction(()=>document.querySelector('#clinicDetail')?.textContent.includes('시험 병원 A')&&document.querySelector('[data-state=error]')?.textContent.includes('요금제'));
 assert.equal(await p.locator('#subPlan').isDisabled(),true);await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();await p.locator('#subNote').fill('실패 중 작성');await p.evaluate(()=>{req=baseReq;});await p.locator('#clinics .hq-load-status[data-state=error] button').click();await p.waitForFunction(()=>document.getElementById('subPlan').dataset.catalogPending!=='true');assert.equal(await p.locator('#subNote').inputValue(),'실패 중 작성');
});
test('hospital list failed changed filter retains labeled previous search results',async t=>{
 const p=await fixture(t);await p.evaluate(()=>showView('clinics'));await p.locator('.clinic-item').first().waitFor();
 await p.evaluate(async()=>{document.getElementById('clinicSearch').value='다른 검색';req=()=>Promise.reject(Error('offline'));await loadClinics();});
 assert.match(await p.locator('#clinicList').innerText(),/시험 병원 A/);assert.match(await p.locator('#clinics [data-state=error]').innerText(),/이전 검색 결과 유지/);
});
test('refresh is joined while in flight and redundant actions are hidden',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{window.calls=0;loadApproval=async()=>{calls++;await new Promise(r=>window.release=r);};showView('approval');document.getElementById('refresh').click();document.getElementById('refresh').click();});assert.equal(await p.evaluate(()=>calls),1);await p.evaluate(()=>release());
 for(const id of ['approvalRefresh','billingRefresh','usageBillingRefresh'])assert.equal(await p.locator('#'+id).evaluate(x=>x.hidden),true);
});
test('successful region notices consolidate, failure keeps local retry',async t=>{
 const p=await fixture(t);await p.evaluate(async()=>{showView('billing');await loadBilling();});
 assert.equal(await p.locator('#billing .hq-load-status[data-state=ready]:visible').count(),0);assert.equal(await p.locator('#billing [data-hq-read-summary]:visible').count(),1);
 await p.evaluate(()=>CarestepHqUX.setRegion('subscriptionTable','error',{error:'합성 실패',retry:()=>{}}));assert.equal(await p.locator('#billing .hq-load-status[data-state=error]:visible').count(),1);
});
test('content status is localized in hospital detail',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{const old=detail;detail=id=>({...old(id),content:[{contentId:'synthetic',title:'합성 자료',status:'published',enabled:true,version:1}]});selectedClinic='A';showView('clinics');});await p.locator('.content-setting').waitFor({state:'attached'});assert.match(await p.locator('.content-setting').innerText(),/공개 중/);assert.doesNotMatch(await p.locator('.content-setting').innerText(),/published/);
});
