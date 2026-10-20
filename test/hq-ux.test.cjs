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
    req=baseReq;window.realOverview=loadOverview;loadOverview=async()=>{};window.confirm=()=>false;
  });
  return page;
}
async function billing(page){await page.evaluate(()=>showView('billing'));await page.locator('.plan-card').first().waitFor({state:'attached'});await page.waitForFunction(()=>document.getElementById('hqPaymentProvider').textContent==='정상');}
test('dashboard keeps its current title after loading and places work before collapsed statistics',async t=>{
 const p=await fixture(t,390);
 await p.evaluate(async()=>{
  req=(path,o)=>path==='/hq/overview'?Promise.resolve({clinics:{pending:2},subscriptions:{},people:{},usage:{},content:{},voice:{},recentClinics:[],generatedAt:new Date().toISOString()}):baseReq(path,o);
  loadHqDeploymentStatus=async()=>{};showView('dashboard');await realOverview();
 });
 assert.equal(await p.locator('#hqCurrentView').innerText(),'대시보드');
 assert.equal(await p.locator('#hqOverviewMetrics').evaluate(el=>el.open),false);
 assert.equal(await p.locator('#hqDashboardDiagnostics').evaluate(el=>el.open),false);
 assert.equal(await p.locator('#kPending').isVisible(),false);
 assert.ok(await p.locator('.approval-center').evaluate(el=>el.getBoundingClientRect().top<200));
 await p.locator('#hqOverviewMetrics>summary').click();assert.equal(await p.locator('#kPending').innerText(),'2');
 await p.locator('#hqOverviewMetrics>summary').click();
 await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,'hq-next-dashboard-390.png'),fullPage:true});
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('action center resolves regions independently, never shows a pending zero, and ignores stale responses',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{
  window.actionPending=[];
  req=path=>new Promise((resolve,reject)=>actionPending.push({path,resolve,reject}));
  window.actionRun1=loadHqActionCenter();
 });
 assert.equal(await p.locator('#acClinicPending').innerText(),'확인 중');
 assert.equal(await p.locator('#acPaymentFailed').innerText(),'확인 중');
 await p.evaluate(()=>actionPending.find(x=>x.path.includes('/hq/clinics?')).resolve({clinics:[{},{}]}));
 await p.waitForFunction(()=>document.getElementById('acClinicPending').textContent==='2');
 assert.equal(await p.locator('#acPaymentFailed').innerText(),'확인 중');
 await p.evaluate(()=>{
  window.actionRun2=loadHqActionCenter();
  for(const task of actionPending.slice(10))task.path==='/hq/payments/overview'?task.reject(Error('시험 결제 조회 실패')):task.resolve(task.path.includes('/hq/clinics?')?{clinics:[{}]}:{ok:true,db:true,platform:{oauthAppConfigured:true}});
 });
 await p.evaluate(()=>actionRun2);
 assert.equal(await p.locator('#acClinicPending').innerText(),'1');
 assert.equal(await p.locator('#acPaymentFailed').innerText(),'확인 필요');
 assert.equal(await p.locator('#acTotalPending').innerText(),'일부 조회 실패');
 await p.evaluate(async()=>{for(const task of actionPending.slice(0,10))task.resolve({clinics:Array(9).fill({}),ok:true,db:true});await actionRun1;});
 assert.equal(await p.locator('#acClinicPending').innerText(),'1');
 assert.match(await p.locator('#approvalCenterError').textContent(),/시험 결제 조회 실패/);
});
test('hospital links focus the detail and return to the source filter and scroll',async t=>{
 const p=await fixture(t,390);await billing(p);
 await p.locator('#hqSubscriptionSearch').fill('병원 A');
 await p.evaluate(()=>scrollTo(0,200));const before=await p.evaluate(()=>scrollY);
 await p.locator('#subscriptionTable [data-sub-clinic="A"]').click();
 await p.locator('.hq-contract-summary').waitFor();
 assert.equal(await p.evaluate(()=>document.activeElement===document.querySelector('.detail-title h2')),true);
 assert.ok(await p.locator('#clinicDetail').evaluate(el=>el.getBoundingClientRect().top<150));
 await p.getByRole('button',{name:'요금제 · 구독 · 돌아가기',exact:true}).click();
 await p.locator('#subscriptionTable [data-sub-clinic="A"]').waitFor();
 await p.waitForFunction(()=>document.activeElement?.dataset.subClinic==='A');
 assert.equal(await p.locator('#hqSubscriptionSearch').inputValue(),'병원 A');
 assert.ok(Math.abs(await p.evaluate(()=>scrollY)-before)<3);
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('quick hospital selection restores the filtered hospital list on return',async t=>{
 const p=await fixture(t);
 await p.evaluate(async()=>{
  req=(path,o)=>path.startsWith('/hq/clinics?')?Promise.resolve({clinics:(path.includes('q=')&&new URL(path,'https://example.test').searchParams.get('q')?['A']:['A','B']).map(id=>({id,name:'시험 병원 '+id,status:'active',approvalStatus:'approved',plan:'BASIC'}))}):baseReq(path,o);
  showView('clinics');await loadClinics();
  document.getElementById('clinicSearch').value='병원 A';await loadClinics();
  renderHqQuickClinicResults([{id:'B',name:'시험 병원 B',plan:'BASIC',status:'active'}],'B');
 });
 await p.locator('[data-quick-clinic="B"]').click();
 await p.locator('.hq-contract-summary').waitFor();
 assert.match(await p.locator('.detail-title h2').innerText(),/B$/);
 await p.locator('.hq-back-to-list').click();
 await p.waitForFunction(()=>document.activeElement.id==='clinicSearch');
 assert.equal(await p.locator('#clinicSearch').inputValue(),'병원 A');
 assert.equal(await p.locator('#clinicList .clinic-item').count(),1);
 assert.match(await p.locator('#clinicList').innerText(),/시험 병원 A/);
});
for(const width of [390,1280])test(`journey pagination preserves approval boundaries and full readable details at ${width}px`,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{
  loadPatientJourneysHQ=async()=>{};
  patientJourneys=Array.from({length:45},(_,i)=>({name:'시험 일정 '+String(i+1).padStart(2,'0'),isSystem:true,status:'active',autoSyncStatus:'update_available',sourceId:'test-'+i,sourceVersion:'1',description:'전체 설명 <img src=x onerror=alert(1)>',stages:[{day:1,title:'D+1 상태 확인'},{day:3,title:'다음 확인'}],applyCount:i}));
  showView('journeys');renderPatientJourneysHQ();
 });
 assert.equal(await p.locator('.hq-journey-row').count(),20);
 assert.equal(await p.locator('.hq-journey-table th').count(),5);
 await p.locator('[data-journey-detail]').first().click();
 const detail=p.locator('.hq-journey-detail-row').first();
 assert.match(await detail.innerText(),/전체 설명 <img src=x onerror=alert\(1\)>/);
 assert.match(await detail.innerText(),/D\+1 상태 확인/);assert.doesNotMatch(await detail.innerText(),/D\+1 D\+1/);
 assert.equal(await detail.locator('img').count(),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.ok(await detail.evaluate(el=>el.getBoundingClientRect().width>=el.closest('table').getBoundingClientRect().width*.95));
 await p.locator('#journeySelectAllReview').check();assert.equal(await p.locator('[data-journey-bulk]:checked').count(),20);
 await p.locator('#journeyBulkApprove').click();assert.equal(await p.evaluate(()=>writes.length),0);
 await p.evaluate(()=>{journeyBulkBusy=true;updateJourneyBulkUi();});
 assert.equal(await p.getByRole('button',{name:'다음',exact:true}).isDisabled(),true);
 assert.equal(await p.locator('[data-journey-status-quick]').first().isDisabled(),true);
 await p.evaluate(()=>{journeyBulkBusy=false;updateJourneyBulkUi();});
 await p.getByRole('button',{name:'다음',exact:true}).click();
 assert.equal(await p.locator('[data-journey-bulk]:checked').count(),0);
 assert.match(await p.locator('.hq-journey-count').innerText(),/21–40건/);
 await p.getByRole('button',{name:'다음',exact:true}).click();
 assert.equal(await p.locator('.hq-journey-row').count(),5);assert.equal(await p.getByRole('button',{name:'다음',exact:true}).isDisabled(),true);
 await p.locator('#journeySearch').fill('시험 일정 01');
 assert.equal(await p.locator('.hq-journey-row').count(),1);assert.match(await p.locator('.hq-pagination').innerText(),/1 \/ 1페이지/);
 await p.locator('#journeySearch').fill('');
 if(process.env.HQ_SCREENSHOTS){await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-next-journeys-${width}.png`),fullPage:true});}
});
for(const width of [390,1280])test(`plan comparison shows saved amounts and a single selected editor at ${width}px`,async t=>{
 const p=await fixture(t,width);await billing(p);await p.locator('#hqTabplans').click();
 assert.equal(await p.locator('#hqPlanComparison tbody tr').count(),4);
 assert.match(await p.locator('#hqPlanComparison').innerText(),/86,900원[\s\S]*185,900원[\s\S]*별도 견적/);
 assert.equal(await p.locator('#planGrid .plan-card:visible').count(),1);
 assert.equal(await p.locator('#hqBillingChannels').isVisible(),false);
 await p.locator('[data-choose-plan="PRO"]').click();
 assert.equal(await p.locator('[data-plan="PRO"]').isVisible(),true);assert.equal(await p.locator('[data-plan="BASIC"]').isVisible(),false);
 assert.equal(await p.evaluate(()=>document.activeElement.textContent),'PRO');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('[data-plan="PRO"]').getByRole('button',{name:'수정',exact:true}).click();
 await p.locator('[data-plan="PRO"] .monthly').fill('170000');
 await p.locator('[data-choose-plan="BASIC"]').click();
 assert.equal(await p.locator('[data-plan="PRO"]').isVisible(),true);
 assert.equal(await p.locator('[data-plan="PRO"] .monthly').inputValue(),'170000');
 assert.equal(await p.evaluate(()=>writes.length),0);
 await p.locator('[data-plan="PRO"]').getByRole('button',{name:'수정 취소',exact:true}).click();
 if(process.env.HQ_SCREENSHOTS){await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-next-plans-${width}.png`),fullPage:true});}
});
async function onboardingPage(p){
 await p.evaluate(()=>{
  window.onboardFail=false;
  window.onboardData={summary:{total:2,live:1,setting:0,attention:1},clinics:[
   {clinicId:'A',clinicName:'시험 병원 A',planCode:'BASIC',completed:4,stepCount:6,percent:67,goLiveStatus:'attention',attentionReasons:['문자 연결 확인'],steps:[{key:'profile',label:'병원 정보',detail:'등록 완료',done:true}],solapiOauth:{connected:true},sender:{source:'oauth2',status:'approved',senderNumber:'0000000000'},payment:{trialDaysLeft:12},messageTest:{done:true}},
   {clinicId:'B',clinicName:'시험 병원 B',planCode:'PRO',completed:6,stepCount:6,percent:100,goLiveStatus:'live',attentionReasons:[],steps:[],payment:{trialDaysLeft:0}}
  ]};
  req=(path,o)=>{if(path==='/hq/onboarding'){if(onboardFail)return Promise.reject(Error('시험 개통 조회 실패'));return Promise.resolve(onboardData);}return baseReq(path,o);};
  showView('onboarding');
 });
 await p.locator('[data-onboarding-clinic="A"]').waitFor();
}
test('compact header opens an accessible mobile menu and restores content focus on navigation',async t=>{
 const p=await fixture(t,390);await p.evaluate(()=>showView('dashboard'));
 assert.equal(await p.locator('#nav').isVisible(),false);
 assert.ok(await p.locator('.top').evaluate(el=>el.getBoundingClientRect().height<100));
 await p.locator('#hqMenuToggle').click();
 assert.equal(await p.locator('#nav').getAttribute('aria-modal'),'true');
 assert.equal(await p.locator('main').evaluate(el=>el.inert),true);
 await p.locator('#hqMenuClose').press('Shift+Tab');
 assert.ok(await p.evaluate(()=>document.querySelector('#nav').contains(document.activeElement)));
 await p.keyboard.press('Escape');assert.equal(await p.locator('#nav').isVisible(),false);
 assert.equal(await p.evaluate(()=>document.activeElement.id),'hqMenuToggle');
 await p.locator('#hqMenuToggle').click();await p.locator('#nav [data-view="onboarding"]').click();
 assert.equal(await p.locator('#nav').isVisible(),false);assert.equal(await p.locator('#hqCurrentView').innerText(),'개통 센터');
 assert.equal(await p.evaluate(()=>document.activeElement.textContent),'개통 센터');
 await p.locator('#hqToolsToggle').click();assert.equal(await p.locator('#hqQuickClinicSearch').isVisible(),true);
 assert.equal(await p.locator('#refresh').innerText(),'현재 화면 새로고침');
 await p.keyboard.press('Escape');assert.equal(await p.locator('#hqQuickClinicSearch').isVisible(),false);
 assert.equal(await p.evaluate(()=>writes.length),0);
 await p.setViewportSize({width:1280,height:900});assert.equal(await p.locator('#nav').isVisible(),true);
 assert.equal(await p.locator('main').evaluate(el=>el.inert),false);
});
for(const width of [390,1280])test(`onboarding and subscription tables show five columns and retain details at ${width}px`,async t=>{
 const p=await fixture(t,width);await onboardingPage(p);
 assert.equal(await p.locator('.onboarding-table th').count(),5);
 assert.equal(await p.locator('[data-onboarding-clinic="A"] td').count(),5);
 assert.ok(await p.locator('.onboarding-table th').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=13));
 assert.ok(await p.locator('.hq-onboarding-kpis span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=13));
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('[data-onboarding-clinic="A"] .hq-row-toggle').click();
 const detail=p.locator('[data-onboarding-clinic="A"] + .hq-compact-detail-row');
 assert.match(await detail.innerText(),/SOLAPI 연결[\s\S]*0000000000[\s\S]*12일 남음/);
 assert.match(await detail.locator('.onboarding-step-dots').innerText(),/병원 정보 · 등록 완료/);
 assert.ok(await detail.evaluate(el=>el.getBoundingClientRect().width>=el.closest('table').getBoundingClientRect().width*.95));
 await p.locator('[data-onboarding-clinic="A"] .hq-row-toggle').press('Enter');assert.equal(await detail.isVisible(),false);
 await p.locator('#onboardingSearch').fill('병원 B');
 assert.equal(await p.locator('#onboardingRows .hq-compact-main-row').count(),1);assert.equal(await p.locator('#onboardingRows .hq-compact-main-row td').count(),5);
 assert.match(await p.locator('#onboardingRows').innerText(),/개통 완료/);
 await p.locator('#onboardingSearch').fill('없음');assert.equal(await p.locator('#onboardingRows td').getAttribute('colspan'),'5');
 await p.locator('#onboardingSearch').fill('');
 await p.locator('[data-onboarding-clinic="A"] .hq-row-toggle').click();
 if(width<=650)assert.ok(await p.locator('.onboarding-table').evaluate(el=>el.parentElement.scrollHeight<=el.parentElement.clientHeight+1));
 await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-six-onboarding-${width}.png`),fullPage:true});
 await billing(p);
 assert.equal(await p.locator('#subscriptionTable th').count(),5);
 assert.equal(await p.locator('#subscriptionTable tbody tr').first().locator('td').count(),5);
 assert.match(await p.locator('#subscriptionTable').innerText(),/BASIC · 월 결제[\s\S]*86,900원/);
 await p.locator('#subscriptionTable .hq-row-toggle').click();assert.match(await p.locator('#subscriptionTable').innerText(),/판매 채널[\s\S]*청구 주체[\s\S]*가입 승인/);
 await p.locator('#hqSubscriptionSearch').fill('없음');assert.equal(await p.locator('#subscriptionTable tbody tr:visible').count(),0);
 await p.locator('#hqSubscriptionSearch').fill('');
 assert.equal(await p.locator('#subscriptionTable .hq-compact-detail-row').isVisible(),true);
 await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-six-subscriptions-${width}.png`),fullPage:true});
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('failed onboarding refresh retains prior rows with an error and retries without claiming current data',async t=>{
 const p=await fixture(t);await onboardingPage(p);
 await p.evaluate(()=>onboardFail=true);await p.locator('#onboardingRefresh').click();
 await p.locator('#onboarding .hq-load-status[data-state="error"]').waitFor();
 assert.match(await p.locator('#onboarding .hq-load-status').innerText(),/시험 개통 조회 실패.*이전 결과/);
 assert.equal(await p.locator('#onboardingRows .hq-compact-main-row').count(),2);
 await p.evaluate(()=>onboardFail=false);await p.locator('#onboarding .hq-load-status button').click();
 await p.locator('#onboarding .hq-load-status[data-state="ready"]').waitFor();
 assert.ok(await p.locator('#onboarding .hq-load-status').evaluate(el=>el.getBoundingClientRect().height<=28));
});
test('hospital overview prioritizes actual charge, hides secondary settings and disambiguates statuses',async t=>{
 const p=await fixture(t);
 await p.evaluate(async()=>{const previous=detail;detail=id=>{const d=previous(id);d.subscription.priceOverrideKrw=0;d.subscription.effectivePriceKrw=86900;d.subscription.status='paused';d.clinic.approvalStatus='rejected';return d;};selectedClinic='A';showView('clinics');await loadClinics();});
 assert.match(await p.locator('.detail-title').innerText(),/가입 거절[\s\S]*구독 일시중지[\s\S]*운영 정상/);
 assert.equal(await p.locator('.hq-catalog-comparison').evaluate(el=>el.open),false);
 assert.equal(await p.locator('.hq-contract-settings').evaluate(el=>el.open),false);
 assert.match(await p.locator('.hq-contract-summary').innerText(),/86,900원/);
 await p.locator('.hq-contract-settings summary').click();
 assert.match(await p.locator('.hq-contract-settings').innerText(),/별도 금액 미설정 · 계약 기본가격 적용/);
 assert.doesNotMatch(await p.locator('.hq-contract-settings').innerText(),/플랜 기본값 적용 \(0\)|Founding/);
 await p.locator('.hq-contract-settings summary').click();
 await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
 assert.equal(await p.locator('.hq-contract-settings').evaluate(el=>el.open),true);
 await p.locator('#subNote').fill('시험 메모');await p.locator('#saveSub').click();await p.locator('[data-review-cancel]').click();
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('hospital detail stays in the second column through loading, ready and errors',async t=>{
 const p=await fixture(t);
 await p.evaluate(async()=>{selectedClinic='A';showView('clinics');await loadClinics();});
 const geometry=()=>p.evaluate(()=>{
  const grid=document.querySelector('.hq-clinic-workspace'),list=grid.children[0].getBoundingClientRect(),detail=grid.children[1].getBoundingClientRect();
  return {children:grid.children.length,left:list.left,right:detail.left,delta:Math.abs(list.top-detail.top),width:document.documentElement.scrollWidth};
 });
 let pos=await geometry();assert.equal(pos.children,2);assert.ok(pos.right>pos.left);assert.ok(pos.delta<2);assert.ok(pos.width<=1280);
 assert.match(await p.locator('#clinicListCount').innerText(),/1곳/);
 assert.equal(await p.locator('#hqClinicPane-subscription').isVisible(),true);
 assert.equal(await p.locator('#hqClinicPane-operation').isVisible(),false);
 await p.locator('#hqClinicTab-members').click();assert.equal(await p.locator('#hqClinicPane-members').isVisible(),true);
 await p.locator('#hqClinicTab-members').press('ArrowLeft');assert.equal(await p.locator('#hqClinicTab-connection').getAttribute('aria-selected'),'true');
 await p.evaluate(()=>{req=async path=>{if(path==='/hq/clinics/A')throw Error('시험 조회 실패');return baseReq(path)};return loadClinicDetail('A');});
 pos=await geometry();assert.equal(pos.children,2);assert.ok(pos.delta<2);
 assert.match(await p.locator('.hq-clinic-detail-region').innerText(),/시험 조회 실패/);
 await p.evaluate(()=>{req=baseReq;});
 await p.locator('.hq-clinic-detail-region').getByRole('button',{name:'다시 시도'}).click();
 await p.locator('#hqClinicTab-subscription').click();
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,'hq-hospital-1280.png'),fullPage:true});
});
test('mobile hospital choice supports keyboard, focuses detail and returns to the searchable list',async t=>{
 const p=await fixture(t,390);await p.evaluate(async()=>{showView('clinics');await loadClinics();});
 await p.locator('.clinic-item').focus();await p.locator('.clinic-item').press('Enter');
 await p.waitForFunction(()=>document.activeElement===document.querySelector('#clinicDetail h2'));
 assert.equal(await p.locator('.clinic-item').getAttribute('aria-pressed'),'true');
 assert.equal(await p.locator('.hq-clinic-workspace').evaluate(el=>el.children.length),2);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.getByRole('button',{name:'병원 목록으로',exact:true}).click();
 assert.equal(await p.evaluate(()=>document.activeElement.id),'clinicSearch');
 await p.locator('.clinic-item').click();await p.locator('#hqClinicTab-subscription').waitFor();
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,'hq-hospital-390.png'),fullPage:true});
});
test('hospital refresh reads current catalog while preserving its contract and price difference',async t=>{
 const p=await fixture(t);
 await p.evaluate(async()=>{
  const original=detail;window.catalogReads=0;detail=id=>{const d=original(id);d.subscription.effectivePriceKrw=79000;d.subscription.priceOverrideKrw=0;d.subscription.commercialVersion='legacy';d.entitlements.plan={...syntheticPlans[1],monthlyPriceKrw:79000,limits:{vatExclusive:false,members:3,packagesMonthly:400}};return d;};
  req=(path,o)=>{if(path==='/hq/plans')catalogReads++;return baseReq(path,o);};
  selectedClinic='A';showView('clinics');await loadClinics();
 });
 await p.locator('.hq-catalog-comparison summary').click();
 assert.match(await p.locator('.hq-contract-summary').innerText(),/79,000원[\s\S]*86,900원/);
 await p.evaluate(async()=>{syntheticPlans[1].monthlyPriceKrw=89000;await loadClinicDetail('A');});
 await p.locator('.hq-catalog-comparison summary').click();
 assert.match(await p.locator('.hq-contract-summary').innerText(),/79,000원[\s\S]*97,900원/);
 assert.ok(await p.evaluate(()=>catalogReads>=2));assert.equal(await p.evaluate(()=>writes.length),0);
 await p.evaluate(async()=>{req=path=>path==='/hq/plans'?Promise.reject(Error('catalog unavailable')):baseReq(path);await loadClinicDetail('A');});
 await p.locator('.hq-catalog-comparison summary').click();
 assert.match(await p.locator('.hq-contract-summary').innerText(),/불러오지 못했습니다/);
 await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
 assert.equal(await p.locator('#subPlan').isEnabled(),false);
});
async function contentFixture(t,width=1280){
  const p=await fixture(t,width);
  await p.evaluate(()=>{
    window.contentFail=false;window.contentReads=0;window.contentConfirms=[];
    window.contentReply=[
      {contentId:'sample-live',title:'시험 게시 자료 <img src=x onerror=alert(1)>',status:'published',category:'수술',version:'1.0',qualityScore:95,reviewerName:'시험 검토자',reviewDueAt:'2020-01-01',enabledClinics:4,disabledClinics:1},
      {contentId:'sample-archive-a',title:'시험 보관 자료 A',status:'archived',category:'수술',version:'1.0',qualityScore:90},
      {contentId:'sample-archive-b',title:'시험 보관 자료 B',status:'archived',category:'내과',version:'1.0',qualityScore:80},
      {contentId:'sample-deleted',title:'시험 삭제 이력',status:'deleted',category:'내과'},
    ];
    req=async(path,options)=>{
      if(path==='/hq/content'){contentReads++;if(contentFail)throw Error('시험 콘텐츠 조회 실패');return {contents:contentReply.map(x=>({...x}))};}
      if(path.startsWith('/hq/content/')){
        writes.push({path,method:options.method,body:JSON.parse(options.body||'{}')});
        if(window.contentWriteDelay)await new Promise(r=>window.releaseContent=r);
        if(path.endsWith(window.contentWriteFail||'never-fail'))throw Error('시험 콘텐츠 저장 실패');
        const entry=contentReply.find(x=>x.contentId===path.split('/').pop());
        entry.status=options.method==='DELETE'?'deleted':JSON.parse(options.body).status;return {ok:true};
      }
      return baseReq(path,options);
    };
    loadHqActionCenter=async()=>{};
    window.confirm=message=>{contentConfirms.push(message);return window.allowContentWrite===true;};
  });
  return p;
}
async function contentPage(p){await p.evaluate(()=>showView('content'));await p.locator('#content .hq-load-status[data-state="ready"]').waitFor();}

test('every HQ menu has a unique destination and opens its matching accessible heading',async t=>{
  const p=await fixture(t);
  assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('#nav [data-view]')].filter(b=>document.querySelectorAll('section.view#'+b.dataset.view).length!==1).map(b=>b.dataset.view)),[]);
  await p.evaluate(()=>{
    const noop=async()=>{};
    loadOverview=loadApproval=loadClinics=loadOnboardingPortfolio=loadCustomerSuccess=loadBilling=loadUsageBilling=loadCalendarIntegration=loadMessagingIntegration=loadSenderOnboarding=loadPatientJourneysHQ=loadGuardianSurveyHQ=loadFollowupCrmHQ=loadContent=loadVoice=loadProductionLaunch=loadAudit=noop;
  });
  for(const button of await p.locator('#nav [data-view]').all()){
    const view=await button.getAttribute('data-view'),label=(await button.locator('span').first().textContent()).trim();
    const toggle=button.locator('xpath=ancestor::div[contains(@class,"hq-nav-group")]').locator('[data-hq-nav-toggle]');
    if(!await button.isVisible())await toggle.click();
    await button.click();
    assert.equal(await p.locator('.view.active').getAttribute('id'),view);
    assert.equal(await button.getAttribute('aria-current'),'page');
    assert.match(await p.title(),/CARESTEP HQ$/);
    assert.equal((await p.locator('#'+view+' h1').textContent()).trim().includes(label),true,`${view}: ${label}`);
  }
  assert.equal(await p.evaluate(()=>writes.length),0);
});

test('central content lists safe text, counts, category and review filters without modifying records',async t=>{
  const p=await contentFixture(t);await contentPage(p);
  assert.deepEqual(await p.locator('.hq-content-kpis strong').allTextContents(),['3','1','2','1']);
  assert.equal(await p.locator('[data-content-row]').count(),3);
  assert.equal(await p.locator('#contentTable img').count(),0);
  assert.match(await p.locator('#contentTable').innerText(),/<img src=x onerror=alert\(1\)>/);
  await p.locator('#contentCategory').selectOption('수술');assert.equal(await p.locator('[data-content-row]').count(),2);
  await p.locator('#contentDueOnly').check();assert.equal(await p.locator('[data-content-row]').count(),1);
  await p.locator('#contentSearch').fill('일치 없음');assert.match(await p.locator('#contentTable').innerText(),/검색 조건을 초기화/);
  await p.locator('#contentReset').click();assert.equal(await p.locator('[data-content-row]').count(),3);
  await p.locator('#contentStatus').selectOption('deleted');
  assert.match(await p.locator('#contentTable').innerText(),/시험 삭제 이력/);
  assert.equal(await p.locator('[data-content-delete],[data-content-status],[data-content-bulk]').count(),0);
  assert.equal(await p.evaluate(()=>writes.length),0);
});

test('content selection covers only visible archived rows, supports partial state and clears with filters',async t=>{
  const p=await contentFixture(t);await contentPage(p);
  await p.locator('#contentSelectAllArchived').check();
  assert.equal(await p.locator('[data-content-bulk]:checked').count(),2);
  await p.locator('[data-content-bulk]').first().uncheck();
  assert.equal(await p.locator('#contentSelectAllArchived').evaluate(el=>el.indeterminate),true);
  await p.locator('#contentSearch').fill('보관 자료 A');
  assert.equal(await p.locator('[data-content-bulk]:checked').count(),0);
  assert.equal(await p.locator('#contentBulkDelete').isDisabled(),true);
  await p.locator('#contentSelectAllArchived').check();await p.locator('#contentBulkDelete').click();
  assert.equal(await p.evaluate(()=>writes.length),0);
  assert.match(await p.evaluate(()=>contentConfirms.at(-1)),/1건을 삭제[\s\S]*시험 보관 자료 A[\s\S]*되돌릴 수 없습니다/);
});

test('content loading/error never reports zero data and retry restores real empty result',async t=>{
  const p=await contentFixture(t);await p.evaluate(()=>{contentFail=true;showView('content');});
  await p.locator('#content .hq-load-status[data-state="error"]').waitFor();
  assert.deepEqual(await p.locator('.hq-content-kpis strong').allTextContents(),['—','—','—','—']);
  assert.match(await p.locator('#contentResultSummary').innerText(),/조회 실패/);
  await p.locator('#contentSearch').fill('검색');assert.match(await p.locator('#contentResultSummary').innerText(),/조회 실패/);
  assert.equal(await p.locator('#contentBulkDelete').isDisabled(),true);
  await p.evaluate(()=>{contentFail=false;contentReply=[];});
  await p.locator('#content .hq-load-status button').click();await p.locator('#content .hq-load-status[data-state="ready"]').waitFor();
  assert.equal(await p.locator('#contentTotal').innerText(),'0');
  assert.match(await p.locator('#contentTable').innerText(),/등록된 중앙 콘텐츠가 없습니다/);
});

test('content keeps the newest load and restores category, checkbox and search through deep links',async t=>{
  const p=await contentFixture(t);await contentPage(p);
  await p.evaluate(async()=>{
    const original=req;window.pendingContent=[];req=()=>new Promise(r=>pendingContent.push(r));
    const first=loadContent(),second=loadContent();
    pendingContent[1]({contents:contentReply});await second;
    pendingContent[0]({contents:[]});await first;req=original;
  });
  assert.equal(await p.locator('#contentTotal').innerText(),'3');
  await p.locator('#contentCategory').selectOption('수술');await p.locator('#contentDueOnly').check();await p.locator('#contentSearch').fill('시험 게시');
  await p.evaluate(()=>{history.replaceState(null,'','#content');$('contentCategory').innerHTML='<option value="all">전체 분류</option>';$('contentDueOnly').checked=false;$('contentSearch').value='';CarestepHqUX.restoreRoute();});
  await p.locator('#content .hq-load-status[data-state="ready"]').waitFor();
  assert.equal(await p.locator('#contentCategory').inputValue(),'수술');assert.equal(await p.locator('#contentDueOnly').isChecked(),true);
  assert.equal(await p.locator('#contentSearch').inputValue(),'시험 게시');assert.equal(await p.locator('[data-content-row]').count(),1);
});

test('content status writes once, blocks navigation during save, then reloads confirmed state',async t=>{
  const p=await contentFixture(t);await contentPage(p);
  await p.evaluate(()=>{allowContentWrite=true;contentWriteDelay=true;});
  await p.locator('[data-content-status="sample-live"]').dblclick();
  await p.waitForFunction(()=>writes.length===1);
  assert.equal(await p.locator('#contentRefresh').isDisabled(),true);
  await p.evaluate(()=>showView('voice'));assert.equal(await p.locator('.view.active').getAttribute('id'),'content');
  await p.evaluate(()=>{contentWriteDelay=false;releaseContent();});
  await p.waitForFunction(()=>$('contentPublished').textContent==='0');
  assert.deepEqual((await p.evaluate(()=>writes))[0],{path:'/hq/content/sample-live',method:'PATCH',body:{status:'archived'}});
  assert.match(await p.locator('#contentBulkResult').innerText(),/게시 중단 완료 1건/);
  assert.equal(await p.locator('#contentRefresh').isDisabled(),false);
});

test('content bulk deletion reports partial failure, retains only failed selection and does not retry automatically',async t=>{
  const p=await contentFixture(t);await contentPage(p);
  await p.evaluate(()=>{allowContentWrite=true;contentWriteFail='sample-archive-b';});
  await p.locator('#contentSelectAllArchived').check();await p.locator('#contentBulkDelete').click();
  await p.waitForFunction(()=>$('contentBulkResult').textContent.includes('결과 확인 필요 1건')&&$('contentArchived').textContent==='1');
  assert.equal(await p.evaluate(()=>writes.length),2);
  assert.match(await p.locator('#contentBulkResult').innerText(),/삭제 완료 1건[\s\S]*시험 보관 자료 B: 시험 콘텐츠 저장 실패/);
  assert.equal(await p.locator('[data-content-bulk]:checked').count(),1);
  assert.equal(await p.locator('[data-content-bulk]:checked').inputValue(),'sample-archive-b');
});

for(const width of [390,1280])test(`content layout fits ${width}px with readable titles and usable actions`,async t=>{
  const p=await contentFixture(t,width);await contentPage(p);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await p.locator('.hq-content-title b').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=15));
  if(width<650)assert.equal(await p.locator('.hq-content-table').evaluate(el=>getComputedStyle(el).minWidth),'0px');
  if(process.env.HQ_SCREENSHOTS)await p.locator('#content').screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-content-${width}.png`)});
});

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
test('plan benefits omit central credits and explain hospital SOLAPI billing with included HOME push',async t=>{
  const p=await fixture(t);await billing(p);await p.locator('#hqTabplans').click();
  assert.equal(await p.locator('#planGrid .credit').count(),0);
  assert.doesNotMatch(await p.locator('[data-plan="PILOT"]').innerText(),/문자 5,000원|월 문자 크레딧/);
  assert.match(await p.locator('#planGrid>.notice').innerText(),/병원 SOLAPI 계정에서 별도 결제[\s\S]*HOME 앱 푸시는 구독에 포함/);
  await p.locator('[data-plan="BASIC"]').getByRole('button',{name:'수정',exact:true}).click();
  await p.locator('[data-plan="BASIC"] .monthly').fill('80000');
  await p.locator('[data-plan="BASIC"] .save-plan').click();await p.locator('[data-review-save]').click();
  await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  assert.equal(await p.evaluate(()=>Object.hasOwn(writes[0].body.limits,'messageCreditKrw')),false);
});

test('direct and unconfirmed hospitals do not show or overwrite central credit and legacy overage settings',async t=>{
  const p=await fixture(t);
  await p.evaluate(async()=>{
    const oldDetail=detail;window.directTestMode='direct';
    detail=id=>({...oldDetail(id),messagingBilling:{credit:{includedKrw:20000,usedKrw:0,extraBudgetKrw:5000}},onboarding:directTestMode==='direct'?{solapiOauth:{connected:true}}:{}});
    plans=syntheticPlans;selectedClinic='A';showView('clinics');await loadClinics();
  });
  await p.locator('#hqClinicMessagingPolicy[data-mode="direct"]').waitFor();
  assert.match(await p.locator('#hqClinicMessagingPolicy').innerText(),/병원 SOLAPI 직접 결제/);
  assert.equal(await p.locator('#subExtraMessageBudget,#subMessagesOverride,#subMessagingOverage,#subMessagingOveragePrice').count(),0);
  await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
  await p.locator('#subPrice').fill('88000');await p.locator('#saveSub').click();await p.locator('[data-review-save]').click();
  await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  const body=await p.evaluate(()=>writes[0].body);
  for(const key of ['extraMessageBudgetKrw','messagesMonthlyOverride','messagingOverageEnabled','messagingOveragePriceKrw'])assert.equal(Object.hasOwn(body,key),false);
  await p.evaluate(async()=>{directTestMode='unknown';await loadClinicDetail('A');});
  assert.match(await p.locator('#hqClinicMessagingPolicy[data-mode="unknown"]').innerText(),/결제 방식 확인 필요/);
  assert.equal(await p.locator('#subExtraMessageBudget').count(),0);
});

test('confirmed central-account hospital retains a separate budget editor and explicit reviewed save',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{
    const oldDetail=detail;detail=id=>({...oldDetail(id),messagingBilling:{credit:{includedKrw:20000,usedKrw:500,extraBudgetKrw:5000}},onboarding:{solapiOauth:{connected:false,status:'disconnected'},sender:{source:'legacy',status:'approved'}}});
    plans=syntheticPlans;selectedClinic='A';showView('clinics');await loadClinics();
  });
  await p.locator('#hqClinicMessagingPolicy[data-mode="central"]').waitFor({state:'attached'});
  await p.locator('.hq-contract-settings summary').click();
  assert.match(await p.locator('#hqClinicMessagingPolicy').innerText(),/CARESTEP 중앙계정 발송 · 별도 정산 설정/);
  assert.equal(await p.locator('#subExtraMessageBudget').isVisible(),false);
  await p.locator('.hq-subscription-editor').getByRole('button',{name:'수정',exact:true}).click();
  await p.locator('#subExtraMessageBudget').fill('6000');await p.locator('#saveSub').click();
  assert.match(await p.locator('dialog').innerText(),/중앙계정 월 추가 문자 예산[\s\S]*5,000원[\s\S]*6,000원/);
  await p.locator('[data-review-save]').click();await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  assert.equal(await p.evaluate(()=>writes[0].body.extraMessageBudgetKrw),6000);
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
  await p.locator('[data-choose-plan="PRO"]').click();
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
async function feedbackFixture(t,width=1280){
  const p=await fixture(t,width);
  await p.evaluate(()=>{
    window.reads=[];
    window.crmReply={overall:{activeCases:12,needsReview:3,critical:1,avgRisk:2.5,surveyResponseRate:40,messageSuccessRate:90},byClinic:[{clinicName:'시험 병원 A',activeCases:12,needsReview:3,critical:1,avgRisk:2.5,surveyResponseRate:40}],byJourney:[{journeyName:'시험 회복관리',activeCases:12,needsReview:3,critical:1,high:2,improvementRate:75,messageSuccessRate:90}]};
    window.voiceReply=[{id:'synthetic-request',title:'시험 기능 요청',clinicName:'시험 병원 A',type:'feature',details:'긴 요청 내용\n'+'내용 확인 '.repeat(80)+'<img src=x onerror=alert(1)>',status:'new',adminNote:'기존 메모 보존',sameRequestCount:2,createdAt:'2026-10-20T00:00:00Z'}];
    window.feedbackFail='';
    req=async(path,o)=>{
      reads.push(path);
      if(o?.method==='PATCH'){
        const result=await baseReq(path,o);const body=JSON.parse(o.body);voiceReply[0].status=body.status;return result;
      }
      if(path.startsWith('/hq/followup-crm')){if(feedbackFail==='crm')throw Error('시험 CRM 조회 실패');return structuredClone(crmReply);}
      if(path.startsWith('/hq/voice')){if(feedbackFail==='voice')throw Error('시험 요청 조회 실패');return {requests:structuredClone(voiceReply)};}
      return baseReq(path,o);
    };
  });
  return p;
}
test('CRM and Customer Voice menu clicks show populated screens and send the expected filters',async t=>{
  const p=await feedbackFixture(t);
  await p.locator('[data-hq-nav-toggle="content"]').click();
  await p.getByRole('button',{name:'후속관리 현황',exact:true}).click();
  await p.waitForFunction(()=>$('crmHqActive').textContent==='12');
  assert.match(p.url(),/#crm$/);assert.match(await p.locator('#crmHqClinicTable').innerText(),/시험 병원 A/);
  assert.match(await p.locator('#crmHqJourneyTable').innerText(),/시험 회복관리/);
  await p.locator('#crmHqPeriod').selectOption('90');
  await p.getByRole('button',{name:'병원 요청·문의',exact:true}).click();
  await p.waitForFunction(()=>$('voiceResultSummary').textContent.startsWith('조회 1건'));
  assert.match(p.url(),/#voice$/);
  await p.locator('#voiceType').selectOption('feature');await p.locator('#voiceStatus').selectOption('new');
  await p.waitForFunction(()=>reads.includes('/hq/voice?type=feature&status=new'));
  assert.ok((await p.evaluate(()=>reads)).includes('/hq/followup-crm?days=90'));
  assert.equal(await p.evaluate(()=>writes.length),0);
});
test('CRM loading and failure remain distinct from a successful empty result; retry works',async t=>{
  const p=await feedbackFixture(t);
  await p.evaluate(()=>{feedbackFail='crm';showView('crm');});
  await p.locator('#crm .hq-load-status[data-state="error"]').waitFor();
  assert.equal(await p.locator('#crmHqActive').innerText(),'—');
  assert.doesNotMatch(await p.locator('#crmHqClinicTable').innerText(),/집계된 후속관리가 없습니다/);
  await p.evaluate(()=>{feedbackFail='';crmReply={overall:{},byClinic:[],byJourney:[]};});
  await p.locator('#crm .hq-load-status button').click();
  await p.locator('#crm .hq-load-status[data-state="ready"]').waitFor();
  assert.equal(await p.locator('#crmHqActive').innerText(),'0');
  assert.match(await p.locator('#crmHqClinicTable').innerText(),/선택한 기간에 집계된 후속관리가 없습니다/);
});
test('Customer Voice distinguishes a failed lookup from no requests and supports retry',async t=>{
  const p=await feedbackFixture(t);await p.evaluate(()=>{feedbackFail='voice';showView('voice');});
  await p.locator('#voice .hq-load-status[data-state="error"]').waitFor();
  assert.match(await p.locator('#voiceResultSummary').innerText(),/조회 실패/);
  assert.doesNotMatch(await p.locator('#voiceResultSummary').innerText(),/조회 0건/);
  await p.evaluate(()=>{feedbackFail='';voiceReply=[];});
  await p.locator('#voice .hq-load-status button').click();
  await p.locator('#voice .hq-load-status[data-state="ready"]').waitFor();
  assert.match(await p.locator('#voiceResultSummary').innerText(),/조회 0건/);
  assert.match(await p.locator('#voiceTable').innerText(),/해당하는 병원 요청이 없습니다/);
});
test('CRM and Voice ignore out-of-order responses after changing filters',async t=>{
  const p=await feedbackFixture(t);
  await p.evaluate(async()=>{
    window.pending={};req=path=>new Promise(r=>pending[path]=r);
    $('crmHqPeriod').value='180';const c1=loadFollowupCrmHQ();
    $('crmHqPeriod').value='30';const c2=loadFollowupCrmHQ();
    pending['/hq/followup-crm?days=30']({...crmReply,overall:{activeCases:30}});await c2;
    pending['/hq/followup-crm?days=180']({...crmReply,overall:{activeCases:180}});await c1;
    $('voiceType').value='all';const v1=loadVoice();$('voiceType').value='feature';const v2=loadVoice();
    pending['/hq/voice?type=feature&status=all']({requests:[{...voiceReply[0],title:'최신 조회 결과'}]});await v2;
    pending['/hq/voice?type=all&status=all']({requests:[{...voiceReply[0],title:'오래된 조회 결과'}]});await v1;
  });
  assert.equal(await p.locator('#crmHqActive').textContent(),'30');
  assert.match(await p.locator('#voiceTable').textContent(),/최신 조회 결과/);
  assert.doesNotMatch(await p.locator('#voiceTable').textContent(),/오래된 조회 결과/);
});
test('Voice keeps full escaped request text, preserves admin note and writes each status change once',async t=>{
  const p=await feedbackFixture(t);await p.evaluate(()=>showView('voice'));
  await p.locator('[data-voice]').waitFor();
  await p.locator('#voiceTable summary').click();
  assert.match(await p.locator('#voiceTable .hq-voice-body').first().innerText(),/<img src=x onerror=alert\(1\)>/);
  assert.equal(await p.locator('#voiceTable img').count(),0);
  assert.equal(await p.locator('.voice-save').isDisabled(),true);
  await p.locator('.voice-status').selectOption('reviewing');
  await p.evaluate(()=>{const current=req;req=async(path,o)=>{if(o?.method==='PATCH')await new Promise(r=>window.releaseVoice=r);return current(path,o);};});
  await p.locator('.voice-save').dblclick();
  assert.equal(await p.locator('#voiceType').isDisabled(),true);
  assert.equal(await p.locator('.voice-save').isDisabled(),true);
  await p.evaluate(()=>releaseVoice());await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  assert.deepEqual((await p.evaluate(()=>writes))[0],{path:'/hq/voice/synthetic-request',body:{status:'reviewing',adminNote:'기존 메모 보존'}});
  await p.waitForFunction(()=>document.querySelector('.voice-status')?.value==='reviewing');
});
test('Voice failed save retains the chosen status and permits an explicit retry',async t=>{
  const p=await feedbackFixture(t);await p.evaluate(()=>{showView('voice');failWrite=true;});
  await p.locator('[data-voice]').waitFor();await p.locator('.voice-status').selectOption('hold');await p.locator('.voice-save').click();
  await p.waitForFunction(()=>writes.length===1&&!CarestepHqUX.isSaving());
  assert.equal(await p.locator('.voice-status').inputValue(),'hold');assert.equal(await p.locator('.voice-save').isDisabled(),false);
  assert.match(await p.locator('.hq-voice-save-result').innerText(),/시험 저장 실패/);
});
test('restored feedback deep links retain filters and fit a narrow screen',async t=>{
  const p=await feedbackFixture(t,390);
  for(const view of ['crm','voice']){
    await p.evaluate(view=>{history.replaceState(null,'','#'+view);CarestepHqUX.restoreRoute();},view);
    await p.locator('#'+view+' .hq-load-status[data-state="ready"]').waitFor();
    assert.equal(await p.locator('.view.active').getAttribute('id'),view);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-${view}-390.png`),fullPage:true});
  }
});
for(const width of [390,521,1280])test(`HQ fits ${width}px viewport; tables scroll internally and text is readable`,async t=>{
  const p=await fixture(t,width);await billing(p);
  for(const pane of ['subscriptions','plans','payments']){
    await p.locator('#hqTab'+pane).click();
    const result=await p.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,body:parseFloat(getComputedStyle(document.body).fontSize),button:parseFloat(getComputedStyle(document.querySelector('#hqTabplans')).fontSize),cards:[...document.querySelectorAll('.plan-card:not([hidden])')].map(el=>el.getBoundingClientRect().width)}));
    assert.ok(result.width<=result.viewport+1,`${pane}: ${JSON.stringify(result)}`);
    assert.ok(result.body>=14&&result.button>=14);
    if(width<650&&pane==='plans')assert.ok(result.cards.every(w=>w>width*.7));
    if(process.env.HQ_SCREENSHOTS&&pane==='plans')await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq-plans-${width}.png`),fullPage:true});
  }
});

test('Journey work card and All recover the full list without a hidden approval scope',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{
  window.journeyReply=Array.from({length:67},(_,i)=>({name:'일정 '+i,isSystem:i!==0,status:'active',autoSyncStatus:'synced',sourceId:'j'+i,stages:[]}));
  req=(path,o)=>path==='/hq/patient-journeys'?Promise.resolve({journeys:journeyReply}):baseReq(path,o);
  openApprovalCenterTarget('journeys');
 });
 await p.waitForFunction(()=>document.getElementById('hqJourneyTotal').textContent==='67');
 assert.match(await p.locator('.hq-journey-count').innerText(),/0건/);
 assert.equal(await p.locator('#journeyScope').inputValue(),'all');
 assert.equal(await p.locator('#journeyStatusFilter').isVisible(),false);
 assert.equal(await p.locator('#journeyScope option[value="review"]').count(),0);
 await p.locator('[data-journey-status-quick="all"]').click();
 assert.match(await p.locator('.hq-journey-count').innerText(),/67건/);
 await p.locator('#journeyScope').selectOption('clinic');await p.locator('#journeySearch').fill('없는 이름');
 await p.getByRole('button',{name:'조건 초기화',exact:true}).click();
 assert.match(await p.locator('.hq-journey-count').innerText(),/67건/);
 assert.equal(await p.locator('#journeys .kpis .kpi').count(),3);
 assert.equal(await p.locator('#journeys .hq-help[open]').count(),0);
 assert.equal(await p.evaluate(()=>writes.length),0);
});

test('action totals count six findings at three distinct hospitals and fold only confirmed zero categories',async t=>{
 const p=await fixture(t);await p.evaluate(async()=>{
  window.workReply=path=>{
   if(path.startsWith('/hq/clinics?'))return {clinics:[]};
   if(path==='/hq/onboarding')return {summary:{attention:3},clinics:['A','B','C'].map(clinicId=>({clinicId,needsAttention:true,goLiveStatus:'attention'}))};
   if(path==='/hq/customer-success')return {summary:{risk:3},clinics:['A','B','C'].map(clinicId=>({clinicId,status:'risk'}))};
   return {ok:true,db:true,platform:{oauthAppConfigured:true},provider:{configured:true}};
  };
  req=async path=>workReply(path);showView('dashboard');await loadHqActionCenter();
 });
 assert.equal(await p.locator('#acTotalPending').innerText(),'6');
 assert.equal(await p.locator('#acTargetClinics').innerText(),'대상 병원 3곳 · 중복 제외');
 assert.equal(await p.locator('#hqZeroActions [data-approval-center]').count(),6);
 assert.equal(await p.locator('#hqZeroActions').evaluate(el=>el.open),false);
 assert.equal(await p.locator('[data-approval-center="onboarding"]').isVisible(),true);
 assert.equal(await p.locator('[data-approval-center="content"]').isVisible(),false);
 await p.locator('#hqZeroActions>summary').click();
 assert.equal(await p.locator('[data-approval-center="content"]').isVisible(),true);
 await p.evaluate(async()=>{req=async()=>({ok:true,db:true,platform:{oauthAppConfigured:true}});await loadHqActionCenter();});
 assert.equal(await p.locator('#hqNoActions').isVisible(),true);
 assert.equal(await p.locator('#acTargetClinics').innerText(),'대상 병원 0곳 · 중복 제외');
 assert.equal(await p.evaluate(()=>writes.length),0);
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,'hq8-dashboard-zero.png'),fullPage:true});
});

test('a failed supplementary payment hospital lookup does not invent a distinct hospital total or lose the known count',async t=>{
 const p=await fixture(t);await p.evaluate(async()=>{
  req=async path=>{
   if(path==='/hq/payments/overview')return {subscriptions:{pastDue:2}};
   if(path==='/hq/subscriptions')throw Error('시험 병원 목록 실패');
   return {ok:true,db:true,platform:{oauthAppConfigured:true}};
  };
  await loadHqActionCenter();
 });
 assert.equal(await p.locator('#acPaymentFailed').innerText(),'2');
 assert.equal(await p.locator('#acTotalPending').innerText(),'2');
 assert.equal(await p.locator('#acTargetClinics').innerText(),'대상 병원 일부 확인 불가');
});

test('work cards set matching list conditions before loading and preserve ready hospitals needing attention',async t=>{
 const p=await fixture(t);
 await p.evaluate(()=>{
  req=async(path,o)=>{
   if(path==='/hq/onboarding')return {summary:{attention:1},clinics:[{clinicId:'A',clinicName:'대상 병원',goLiveStatus:'live',needsAttention:true,steps:[]},{clinicId:'B',clinicName:'정상 병원',goLiveStatus:'live',needsAttention:false,steps:[]}]};
   if(path==='/hq/customer-success')return {summary:{risk:1},clinics:[{clinicId:'A',clinicName:'도입 확인 대상',status:'risk'},{clinicId:'B',clinicName:'도입 양호',status:'healthy'}]};
   if(path.startsWith('/hq/messaging/sender-onboarding'))return {requests:[{clinicId:'A',clinicName:'승인 신청 병원',status:'pending'},{clinicId:'B',clinicName:'등록 진행 병원',status:'registering'},{clinicId:'C',clinicName:'승인 완료 병원',status:'approved'}]};
   if(path==='/hq/content')return {contents:[{contentId:'a',title:'재검토 대상',status:'published',reviewDueAt:'2020-01-01'},{contentId:'b',title:'검토 완료',status:'published',reviewDueAt:'2099-01-01'}]};
   if(path==='/hq/subscriptions')return {subscriptions:[{clinicId:'A',clinicName:'결제 확인 대상',status:'past_due'},{clinicId:'B',clinicName:'구독 정상 병원',status:'active'}]};
   return baseReq(path,o);
  };
  document.getElementById('onboardingSearch').value='이전 검색';
  openApprovalCenterTarget('onboarding');
 });
 await p.locator('[data-open-onboarding-clinic="A"]').waitFor();
 assert.doesNotMatch(await p.locator('#onboardingRows').innerText(),/정상 병원/);
 await p.evaluate(()=>openApprovalCenterTarget('customerSuccess'));await p.locator('[data-cs-clinic="A"]').waitFor();
 assert.doesNotMatch(await p.locator('#customerSuccessRows').innerText(),/도입 양호/);
 await p.evaluate(()=>openApprovalCenterTarget('senders'));await p.locator('[data-sender-clinic="B"]').waitFor();
 assert.equal(await p.locator('#senderOnboardingTable tbody tr').count(),2);
 await p.evaluate(()=>openApprovalCenterTarget('content'));await p.locator('[data-content-row="a"]').waitFor();
 assert.equal(await p.locator('#contentDueOnly').isChecked(),true);
 assert.doesNotMatch(await p.locator('#contentTable').innerText(),/검토 완료/);
 await p.evaluate(()=>openApprovalCenterTarget('billing'));await p.locator('[data-sub-clinic="A"]').waitFor();
 assert.equal(await p.locator('#hqSubscriptionStatus').inputValue(),'past_due');
 assert.equal(await p.locator('[data-sub-clinic="B"]').isVisible(),false);
 assert.equal(await p.evaluate(()=>writes.length),0);
});

test('recovery response periods show pending, reject older replies, distinguish failure and retry to a real zero',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{
  window.surveyPendingRequests=[];
  req=path=>new Promise((resolve,reject)=>surveyPendingRequests.push({path,resolve,reject}));
  showView('surveys');
 });
 assert.equal(await p.locator('#surveyHqInvited').innerText(),'—');
 assert.equal(await p.locator('#surveyHqRate').innerText(),'응답률 확인 중');
 await p.locator('#surveyHqPeriod').selectOption('30');
 await p.evaluate(()=>surveyPendingRequests[1].resolve({overall:{invited:10,responded:2,responseRate:20},byClinic:[],byJourney:[]}));
 await p.waitForFunction(()=>document.getElementById('surveyHqInvited').textContent==='10');
 await p.evaluate(()=>surveyPendingRequests[0].resolve({overall:{invited:99},byClinic:[],byJourney:[]}));
 assert.equal(await p.locator('#surveyHqInvited').innerText(),'10');
 await p.locator('#surveyHqPeriod').selectOption('365');
 assert.equal(await p.locator('#surveyHqInvited').innerText(),'—');
 await p.evaluate(()=>surveyPendingRequests[2].reject(Error('시험 회복응답 실패')));
 await p.waitForFunction(()=>document.querySelector('#surveys .hq-load-status')?.dataset.state==='error');
 assert.match(await p.locator('#surveys .hq-load-status').innerText(),/시험 회복응답 실패/);
 assert.doesNotMatch(await p.locator('#surveyHqClinicTable').innerText(),/집계된 회복응답이 없습니다/);
 await p.getByRole('button',{name:'다시 시도',exact:true}).click();
 await p.evaluate(()=>surveyPendingRequests[3].resolve({overall:{invited:0,responded:0},byClinic:[],byJourney:[]}));
 await p.waitForFunction(()=>document.getElementById('surveyHqInvited').textContent==='0');
 assert.match(await p.locator('#surveyHqClinicTable').innerText(),/집계된 회복응답이 없습니다/);
 assert.equal(await p.locator('#surveyHqPeriod').inputValue(),'365');
});

for(const width of [390,1280])test(`adoption and response tables keep key actions readable with full details at ${width}px`,async t=>{
 const p=await fixture(t,width);
 await p.evaluate(()=>{
  req=async(path,o)=>{
   if(path==='/hq/customer-success')return {summary:{total:1,risk:1},clinics:[{clinicId:'A',clinicName:'긴 이름의 시험 병원',status:'risk',riskScore:80,adoptionScore:25,riskReasons:['14일 이상 미사용','개통 준비 미완료'],nextAction:'병원 담당자에게 이용 상황 확인',usage:{packages30:1,followup30:4},subscription:{status:'trialing',trialDaysLeft:3},onboarding:{percent:50}}]};
   if(path.startsWith('/hq/surveys'))return {overall:{invited:20,responded:10,openAlerts:2,openUrgent:1,responseRate:50},byClinic:[{clinicId:'A',clinicName:'확인 대상 병원',openAlerts:2,urgent:1,watch:1,invited:10,responseRate:50},{clinicId:'B',clinicName:'확인 완료 병원',openAlerts:0}],byJourney:[{journeyName:'회복관리 A',openAlerts:2,urgent:1,responded:2,improved:1,responseRate:50}]};
   return baseReq(path,o);
  };
  showView('customerSuccess');
 });
 await p.locator('[data-cs-clinic="A"]').waitFor();
 assert.equal(await p.locator('.hq-adoption-table th').count(),5);
 assert.match(await p.locator('.hq-adoption-table .hq-compact-main-row').innerText(),/병원 담당자에게 이용 상황 확인/);
 assert.ok(await p.locator('.hq-adoption-table td').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('.hq-adoption-table .hq-row-toggle').click();
 assert.match(await p.locator('.hq-adoption-table .hq-compact-detail-row').innerText(),/80[\s\S]*후속 4/);
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq8-adoption-${width}.png`),fullPage:true});
 await p.evaluate(()=>openApprovalCenterTarget('surveys'));
 await p.waitForFunction(()=>document.getElementById('surveyHqInvited').textContent==='20');
 assert.equal(await p.locator('#hqSurveyScope').inputValue(),'open');
 assert.match(await p.locator('#surveyHqClinicTable').innerText(),/확인 대상 병원/);
 assert.doesNotMatch(await p.locator('#surveyHqClinicTable').innerText(),/확인 완료 병원/);
 assert.doesNotMatch(await p.locator('#surveys').innerText(),/urgent|watch|callback|Guardian Response/);
 assert.equal(await p.locator('#surveyHqClinicTable th').count(),5);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('#hqSurveyScope').selectOption('all');
 assert.match(await p.locator('#surveyHqClinicTable').innerText(),/확인 완료 병원/);
 if(process.env.HQ_SCREENSHOTS){await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq8-surveys-${width}.png`),fullPage:true});}
 assert.equal(await p.evaluate(()=>writes.length),0);
});

async function adoptionPortfolio(p){
 await p.evaluate(()=>{
  window.adoptionData={summary:{total:4,risk:3,success:1,trialEnding7:0,inactive14:2},clinics:[
   {clinicId:'A',clinicName:'구독 확인 시험 병원',status:'risk',riskScore:90,subscription:{status:'paused'},onboarding:{ready:false,percent:50},riskReasons:['구독 일시중지','온보딩 미완료','Calendar 미연결','실사용 이벤트 없음','검토 <img src=x onerror=alert(1)>'],nextAction:'구독 상태와 재활성화 의사 확인'},
   {clinicId:'B',clinicName:'연동 확인 시험 병원',status:'risk',riskScore:80,subscription:{status:'active'},onboarding:{ready:false,percent:50},riskReasons:['온보딩 미완료'],nextAction:'개통 준비 확인'},
   {clinicId:'C',clinicName:'운영 확인 시험 병원',status:'risk',riskScore:70,subscription:{status:'active'},onboarding:{ready:true,percent:100},riskReasons:['14일 이상 미사용'],nextAction:'사용 중단 원인 확인'},
   {clinicId:'D',clinicName:'정상 시험 병원',status:'success',riskScore:0,subscription:{status:'active'},onboarding:{ready:true,percent:100},successSignals:['도입 완료'],nextAction:'현재 이용 상태 유지'}
  ].map(x=>({...x,planCode:'BASIC',usage:{packages30:1,followup30:2},createdAt:'2026-10-01'}))};
  req=(path,o)=>path==='/hq/customer-success'?Promise.resolve(adoptionData):path.startsWith('/hq/clinics?')?Promise.resolve({clinics:adoptionData.clinics.map(x=>({id:x.clinicId,name:x.clinicName,status:'active',approvalStatus:'approved',plan:'BASIC'}))}):baseReq(path,o);
  openApprovalCenterTarget('customerSuccess');
 });
 await p.locator('[data-cs-clinic="A"]').waitFor();
}
test('adoption All clears combined conditions and reports the full versus visible hospital count',async t=>{
 const p=await fixture(t);await adoptionPortfolio(p);
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/전체 4곳 · 현재 표시 3곳.*이용 중단 위험/);
 assert.equal(await p.locator('[data-cs-quick="all"]').getAttribute('aria-pressed'),'false');
 await p.locator('#hqAdoptionFilters>summary').click();
 await p.locator('#customerSuccessSearch').fill('구독');
 await p.locator('#customerSuccessPlan').selectOption('BASIC');
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/현재 표시 1곳/);
 await p.getByRole('button',{name:'전체 병원',exact:true}).click();
 assert.equal(await p.locator('#customerSuccessStatus').inputValue(),'all');
 assert.equal(await p.locator('#customerSuccessPlan').inputValue(),'all');
 assert.equal(await p.locator('#customerSuccessSearch').inputValue(),'');
 assert.equal(await p.locator('#customerSuccessRows .hq-compact-main-row').count(),4);
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/^전체 4곳 · 현재 표시 4곳$/);
 await p.locator('#customerSuccessSearch').fill('없는 병원');
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/현재 표시 0곳/);
 await p.locator('#hqAdoptionReset').click();
 assert.equal(await p.locator('#customerSuccessRows .hq-compact-main-row').count(),4);
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('next-step buttons open the selected hospital pane and return to the source conditions without writes',async t=>{
 const p=await fixture(t);await adoptionPortfolio(p);
 await p.locator('#customerSuccessSearch').fill('구독');
 await p.getByRole('button',{name:'구독 확인 시험 병원 구독 확인',exact:true}).click();
 await p.locator('.hq-contract-summary').waitFor();
 assert.match(await p.locator('.detail-title h2').innerText(),/A$/);
 assert.equal(await p.locator('#hqClinicTab-subscription').getAttribute('aria-selected'),'true');
 await p.getByRole('button',{name:'병원 도입 현황 · 돌아가기',exact:true}).click();
 await p.locator('[data-cs-action-clinic="A"]').waitFor();
 assert.equal(await p.locator('#customerSuccessSearch').inputValue(),'구독');
 assert.equal(await p.locator('#customerSuccessStatus').inputValue(),'risk');
 await p.getByRole('button',{name:'전체 병원',exact:true}).click();
 for(const [id,pane] of [['B','connection'],['C','operation']]){
  await p.locator('[data-cs-action-clinic="'+id+'"]').click();
  await p.locator('#hqClinicTab-'+pane+'[aria-selected="true"]').waitFor();
  assert.match(await p.locator('.detail-title h2').innerText(),new RegExp(id+'$'));
  await p.getByRole('button',{name:'병원 도입 현황 · 돌아가기',exact:true}).click();
  await p.locator('[data-cs-action-clinic="'+id+'"]').waitFor();
 }
 assert.equal(await p.evaluate(()=>writes.length),0);
});
for(const width of [390,1280])test(`portfolio metrics, conditions and reasons are compact and readable at ${width}px`,async t=>{
 const p=await fixture(t,width);await adoptionPortfolio(p);
 assert.equal(await p.locator('#customerSuccess .hq-core-metrics>div').count(),3);
 assert.equal(await p.locator('#hqAdoptionMetrics').evaluate(el=>el.open),false);
 assert.equal(await p.locator('#hqAdoptionFilters').evaluate(el=>el.open),false);
 assert.ok(await p.locator('.hq-adoption-table').evaluate(el=>el.getBoundingClientRect().top<650));
 const reasons=p.locator('#customerSuccessRows .cs-reasons').first();
 assert.equal(await reasons.locator(':scope>span').count(),2);
 assert.doesNotMatch(await reasons.innerText(),/온보딩|Calendar|실사용 이벤트/);
 await reasons.locator('summary').click();
 assert.match(await reasons.innerText(),/캘린더 미연결.*사용 기록 없음/s);
 assert.match(await reasons.innerText(),/검토 <img src=x onerror=alert\(1\)>/);
 assert.equal(await reasons.locator('img').count(),0);
 assert.ok(await reasons.locator('span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
 await reasons.locator('summary').click();
 await p.locator('#hqAdoptionMetrics>summary').click();
 assert.equal(await p.locator('#csInactive').isVisible(),true);
 await p.locator('#hqAdoptionMetrics>summary').click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq9-adoption-${width}.png`),fullPage:true});
 await onboardingPage(p);
 assert.equal(await p.locator('#onboarding .hq-core-metrics>div').count(),3);
 assert.ok(await p.locator('.onboarding-reasons span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
 assert.doesNotMatch(await p.locator('#onboarding .notice').innerText(),/kakao:read/);
 await p.locator('#onboarding .hq-technical-help>summary').click();
 assert.match(await p.locator('#onboarding .notice').innerText(),/kakao:read/);
 await p.locator('#onboarding .hq-technical-help>summary').click();
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`hq9-onboarding-${width}.png`),fullPage:true});
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('first portfolio load uses final columns and a failure remains different from an empty result',async t=>{
 const p=await fixture(t,390);
 await p.evaluate(()=>{
  window.portfolioJobs=[];req=path=>new Promise((resolve,reject)=>portfolioJobs.push({path,resolve,reject}));
  showView('customerSuccess');
 });
 assert.equal(await p.locator('.hq-adoption-table th').count(),5);
 assert.equal(await p.locator('.hq-portfolio-loading').first().isVisible(),false); // onboarding is hidden
 assert.equal(await p.locator('#customerSuccessRows .hq-portfolio-loading').isVisible(),true);
 assert.equal(await p.locator('#csTotal').innerText(),'--');
 assert.doesNotMatch(await p.locator('#hqAdoptionResults').innerText(),/0곳/);
 await p.evaluate(()=>portfolioJobs[0].reject(Error('시험 목록 실패')));
 await p.locator('#customerSuccess .hq-load-status[data-state="error"]').waitFor();
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/조회 실패/);
 await p.getByRole('button',{name:'다시 시도',exact:true}).click();
 await p.evaluate(()=>portfolioJobs[1].resolve({summary:{total:0},clinics:[]}));
 await p.locator('#customerSuccess .hq-load-status[data-state="ready"]').waitFor();
 assert.match(await p.locator('#hqAdoptionResults').innerText(),/전체 0곳 · 현재 표시 0곳/);
 await p.evaluate(()=>showView('onboarding'));
 assert.equal(await p.locator('.onboarding-table th').count(),5);
 assert.equal(await p.locator('#onboardingRows td').getAttribute('colspan'),'5');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.evaluate(()=>portfolioJobs[2].resolve({summary:{total:0},clinics:[]}));
});
test('refresh keeps expanded hospital details by ID even after order changes and ignores earlier replies',async t=>{
 const p=await fixture(t);await adoptionPortfolio(p);
 await p.locator('[data-cs-clinic="B"]').locator('..').locator('..').locator('.hq-row-toggle').click();
 await p.evaluate(()=>{
  window.adoptionJobs=[];req=path=>new Promise((resolve,reject)=>adoptionJobs.push({path,resolve,reject}));
  window.olderAdoption=loadCustomerSuccess();window.newerAdoption=loadCustomerSuccess();
 });
 await p.evaluate(()=>adoptionJobs[1].resolve({...adoptionData,clinics:adoptionData.clinics.map(x=>({...x,riskScore:x.clinicId==='B'?99:x.riskScore}))}));
 await p.evaluate(()=>newerAdoption);
 const b=p.locator('.hq-compact-main-row').filter({has:p.locator('[data-cs-clinic="B"]')});
 assert.equal(await b.locator('.hq-row-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await p.locator('#customerSuccessRows .hq-compact-main-row').first().locator('[data-cs-clinic]').getAttribute('data-cs-clinic'),'B');
 await p.evaluate(()=>adoptionJobs[0].resolve({summary:{total:0},clinics:[]}));
 await p.evaluate(()=>olderAdoption);
 assert.equal(await p.locator('#customerSuccessRows .hq-compact-main-row').count(),3);
 await p.locator('#customerSuccessSearch').fill('구독');await p.locator('#customerSuccessSearch').fill('');
 assert.equal(await p.locator('.hq-compact-main-row').filter({has:p.locator('[data-cs-clinic="B"]')}).locator('.hq-row-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await p.evaluate(()=>writes.length),0);
});
test('onboarding refresh preserves expanded details, focus and reading position',async t=>{
 const p=await fixture(t);await onboardingPage(p);
 await p.evaluate(()=>{
  onboardData.clinics=Array.from({length:10},(_,i)=>({...onboardData.clinics[0],clinicId:'hospital-'+i,clinicName:'시험 병원 '+i,attentionReasons:['온보딩 미완료','Calendar 미연결','실사용 이벤트 없음']}));
  renderOnboardingPortfolio();
 });
 const row=p.locator('[data-onboarding-clinic="hospital-5"]'),toggle=row.locator('.hq-row-toggle');
 await toggle.click();
 const before=await row.evaluate(el=>el.getBoundingClientRect().top);
 await p.evaluate(()=>loadOnboardingPortfolio());
 assert.equal(await p.locator('[data-onboarding-clinic="hospital-5"] .hq-row-toggle').getAttribute('aria-expanded'),'true');
 assert.ok(Math.abs(await p.locator('[data-onboarding-clinic="hospital-5"]').evaluate(el=>el.getBoundingClientRect().top)-before)<3);
 assert.equal(await p.evaluate(()=>document.activeElement.closest('[data-onboarding-clinic]')?.dataset.onboardingClinic),'hospital-5');
 assert.equal(await p.evaluate(()=>writes.length),0);
});
