const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
let browser,server,origin;
const root=resolve(__dirname,'..');
const allowed=new Set(['hq.html','hq-ux.js','hq-ux.css','pretendard-variable-1.3.9.woff2']);
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
    req=baseReq;loadOverview=async()=>{};window.confirm=()=>false;
  });
  return page;
}
async function billing(page){await page.evaluate(()=>showView('billing'));await page.locator('.plan-card').first().waitFor({state:'attached'});await page.waitForFunction(()=>document.getElementById('hqPaymentProvider').textContent==='정상');}
test('billing opens on hospitals, separates plan/payment panes, distinguishes free/quote/VAT',async t=>{
  const p=await fixture(t);await billing(p);
  assert.equal(await p.locator('#hqTabsubscriptions').getAttribute('aria-selected'),'true');
  assert.equal(await p.locator('#hqPolicyPane').isVisible(),false);
  await p.locator('#hqTabplans').click();
  assert.match(p.url(),/#billing\/plans$/);
  assert.match(await p.locator('[data-plan="PILOT"] .hq-price-summary').innerText(),/무료체험 · 0원/);
  assert.match(await p.locator('[data-plan="BASIC"] .hq-price-summary').innerText(),/79,000원 \+ 부가세 7,900원[\s\S]*86,900원/);
  assert.match(await p.locator('[data-plan="ENTERPRISE"] .hq-price-summary').innerText(),/개별 계약/);
  assert.equal(await p.locator('[data-plan="BASIC"] .monthly').isVisible(),false);
  await p.goBack();assert.equal(await p.locator('#hqTabsubscriptions').getAttribute('aria-selected'),'true');
});
test('payment outage is unknown, retains other regions, retry restores true zero and OFF',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{failPayment=true;showView('billing');});
  await p.waitForFunction(()=>document.getElementById('hqPaymentProvider').textContent==='확인 필요');
  assert.equal(await p.locator('.plan-card').count(),4);
  assert.match(await p.locator('#subscriptionTable').innerText(),/시험 병원 A/);
  assert.match(await p.locator('#hqOverageAutobillMeta').innerText(),/확인하지 못했습니다/);
  assert.equal(await p.locator('#hqRunBilling').isDisabled(),true);
  await p.locator('#hqTabpayments').click();await p.evaluate(()=>failPayment=false);
  await p.locator('#hqBillingpayments .hq-load-status button').click();
  await p.waitForFunction(()=>document.getElementById('hqPaymentProvider').textContent==='정상');
  assert.equal(await p.locator('#hqPaymentPaid').innerText(),'0');
  assert.match(await p.locator('#hqOverageAutobillMeta').innerText(),/꺼짐/);
});
test('action center marks a failed payment lookup unknown while keeping successful approval count',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{
    failPayment=true;req=(path,o)=>path.startsWith('/hq/clinics?')?Promise.resolve({clinics:[{id:'A'}]}):baseReq(path,o);
    await loadHqActionCenter();
  });
  assert.equal(await p.locator('#acClinicPending').innerText(),'1');
  assert.equal(await p.locator('#acPaymentFailed').innerText(),'확인 필요');
  assert.equal(await p.locator('#acTotalPending').innerText(),'일부 조회 실패');
});
test('plan review shows target/before/after; cancel writes nothing; confirmed double click writes once',async t=>{
  const p=await fixture(t);await billing(p);await p.locator('#hqTabplans').click();
  const card=p.locator('[data-plan="BASIC"]');
  await card.getByRole('button',{name:'수정',exact:true}).click();await card.locator('.monthly').fill('80000');
  await card.locator('.save-plan').click();await p.locator('dialog[open]').waitFor();
  assert.match(await p.locator('dialog').innerText(),/BASIC 공통 요금제 변경[\s\S]*기존 계약[\s\S]*79,000원[\s\S]*80,000원/);
  await p.locator('[data-review-cancel]').click();assert.equal(await p.evaluate(()=>writes.length),0);
  await p.locator('#hqTabpayments').click();assert.equal(await p.locator('#hqTabplans').getAttribute('aria-selected'),'true');
  assert.equal(await card.locator('.monthly').inputValue(),'80000');
  await card.locator('.save-plan').dblclick();await p.locator('[data-review-save]').click();
  await p.waitForFunction(()=>writes.length===1&&document.querySelector('[data-plan="BASIC"]')?.dataset.editing==='false');
  assert.equal(await p.evaluate(()=>writes.length),1);
});
test('failed save keeps editable draft; cancel restores saved value',async t=>{
  const p=await fixture(t);await billing(p);await p.locator('#hqTabplans').click();
  const card=p.locator('[data-plan="BASIC"]');await card.getByRole('button',{name:'수정',exact:true}).click();
  await card.locator('.monthly').fill('81000');await p.evaluate(()=>failWrite=true);
  await card.locator('.save-plan').click();await p.locator('[data-review-save]').click();
  await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  assert.equal(await card.getAttribute('data-editing'),'true');assert.equal(await card.locator('.monthly').inputValue(),'81000');
  await card.getByRole('button',{name:'수정 취소',exact:true}).click();assert.equal(await card.locator('.monthly').inputValue(),'79000');
});
test('another editor cannot discard a dirty draft; saving locks inputs until result',async t=>{
  const p=await fixture(t);await billing(p);await p.locator('#hqTabplans').click();
  const basic=p.locator('[data-plan="BASIC"]'),pro=p.locator('[data-plan="PRO"]');
  await basic.getByRole('button',{name:'수정',exact:true}).click();await basic.locator('.monthly').fill('81000');
  await pro.getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await basic.getAttribute('data-editing'),'true');assert.equal(await pro.getAttribute('data-editing'),'false');
  await p.evaluate(()=>{req=async(path,o)=>{if(o?.method==='PATCH'){await new Promise(r=>window.releaseSave=r);}return baseReq(path,o);};});
  await basic.locator('.save-plan').click();await p.locator('[data-review-save]').click();
  assert.equal(await basic.locator('.monthly').isDisabled(),true);
  assert.equal(await basic.getByRole('button',{name:'수정 취소'}).isDisabled(),true);
  await p.evaluate(()=>releaseSave());await p.waitForFunction(()=>!CarestepHqUX.isSaving());
  assert.equal(await p.evaluate(()=>writes.length),1);
});
test('stale hospital detail cannot replace newer selection; founding controls unlock on deselect',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{
    plans=syntheticPlans;showView('clinics');await loadClinics();
    window.pending={};req=path=>path.startsWith('/hq/clinics/')?new Promise(r=>pending[path.split('/').pop()]=r):baseReq(path);
    selectedClinic='A';window.requestA=loadClinicDetail('A');selectedClinic='B';window.requestB=loadClinicDetail('B');
    pending.B(detail('B'));await requestB;pending.A(detail('A'));await requestA;
  });
  assert.match(await p.locator('#clinicDetail h2').first().innerText(),/B$/);
  await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
  await p.locator('#subFounding').check();assert.equal(await p.locator('#subCycle').isDisabled(),true);
  await p.locator('#subFounding').uncheck();assert.equal(await p.locator('#subCycle').isDisabled(),false);
  assert.equal(await p.locator('#subPrice').isDisabled(),false);
});
test('quick search ignores older response and clears invalidated results',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{
    window.pending={};req=path=>new Promise(r=>pending[new URL('http://test'+path).searchParams.get('q')]=r);
    $('hqQuickClinicSearch').value='A';const first=runHqQuickClinicSearch();
    $('hqQuickClinicSearch').value='B';const second=runHqQuickClinicSearch();
    pending.B({clinics:[{id:'B',name:'시험 병원 B'}]});await second;
    pending.A({clinics:[{id:'A',name:'시험 병원 A'}]});await first;
  });
  assert.match(await p.locator('#hqQuickClinicResults').innerText(),/시험 병원 B/);
  assert.doesNotMatch(await p.locator('#hqQuickClinicResults').innerText(),/시험 병원 A/);
  await p.locator('#hqQuickClinicSearch').fill('');
  assert.equal(await p.locator('#hqQuickClinicResults').isVisible(),false);
});
test('hospital subscription final review uses selected hospital and persists correct payload once',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{plans=syntheticPlans;selectedClinic='A';showView('clinics');await loadClinics();});
  await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
  await p.locator('#subPrice').fill('88000');await p.locator('#saveSub').click();
  assert.match(await p.locator('dialog').innerText(),/시험 병원 A 구독 변경[\s\S]*86,900원[\s\S]*88,000원/);
  await p.locator('[data-review-save]').click();await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  const [write]=await p.evaluate(()=>writes);assert.equal(write.path,'/hq/clinics/A/subscription');assert.equal(write.body.priceOverrideKrw,88000);
});
test('route restoration retains hospital and search filters without resetting billing pane',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{
    sessionStorage.setItem('carestep_hq_ui_v20261020',JSON.stringify({view:'billing',pane:'plans',clinic:'A',filters:{hqSubscriptionSearch:'시험 병원'}}));
    history.replaceState(null,'','#billing/plans');CarestepHqUX.restoreRoute();
  });
  await p.locator('[data-plan="BASIC"]').waitFor();
  assert.equal(await p.locator('#hqSubscriptionSearch').inputValue(),'시험 병원');
  assert.equal(await p.evaluate(()=>selectedClinic),'A');
  assert.equal(await p.locator('#hqTabplans').getAttribute('aria-selected'),'true');
});
test('usage, rates and monthly report load independently; rate editor is reusable after refresh',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{req=(path,o)=>path.startsWith('/hq/reports/monthly')?Promise.reject(Error('시험 보고서 오류')):baseReq(path,o);showView('usageBilling');});
  await p.waitForFunction(()=>document.getElementById('buMessages').textContent==='7');
  assert.equal(await p.locator('#hqReportPackages').innerText(),'—');
  const rate=p.locator('#hqRateEditor');await rate.getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await p.locator('#rateSms').isDisabled(),false);
  await rate.getByRole('button',{name:'수정 취소',exact:true}).click();
  await p.evaluate(()=>loadUsageBilling());await rate.getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await p.locator('#rateSms').isDisabled(),false);
});
for(const width of [390,521,1280])test(`HQ fits ${width}px viewport; tables scroll internally and text is readable`,async t=>{
  const p=await fixture(t,width);await billing(p);
  for(const pane of ['subscriptions','plans','payments']){
    await p.locator('#hqTab'+pane).click();
    const result=await p.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,body:parseFloat(getComputedStyle(document.body).fontSize),button:parseFloat(getComputedStyle(document.querySelector('#hqTabplans')).fontSize),cards:[...document.querySelectorAll('.plan-card')].map(el=>el.getBoundingClientRect().width)}));
    assert.ok(result.width<=result.viewport+1,`${pane}: ${JSON.stringify(result)}`);
    assert.ok(result.body>=14&&result.button>=14);
    if(width<650&&pane==='plans')assert.ok(result.cards.every(w=>w>width*.7));
    if(process.env.HQ_SCREENSHOTS&&pane==='plans')await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-plans-${width}.png`),fullPage:true});
  }
});
