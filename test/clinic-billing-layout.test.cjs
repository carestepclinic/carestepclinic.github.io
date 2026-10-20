const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=resolve(__dirname,'..'),source=readFileSync(resolve(root,'index.html'),'utf8');
// Render real markup and screen styles; omit scripts so no account or payment APIs run.
const markup=source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
const compare=source.slice(source.indexOf('function renderBillingContractComparison()'),source.indexOf('\nfunction renderBillingOverview()'));
let server,browser,origin;
before(async()=>{
 server=http.createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','carestep-ui.css','clinic-organization.css','patient-crm.css','carestep-workflow.css','pretendard-variable-1.3.9.woff2'].includes(path)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'})[extname(path)]);res.end(path==='index.html'?markup:readFileSync(resolve(root,path)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
for(const width of [390,900,1440])test(`Clinic billing uses shared typography, bounded cards and readable controls at ${width}px`,async t=>{
 const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();await page.goto(origin);page.setDefaultTimeout(5000);
 await page.evaluate(()=>{
  document.getElementById('appView').classList.remove('hidden');document.getElementById('loginView').classList.add('hidden');
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active-view'));document.getElementById('account').classList.add('active-view');
  document.querySelectorAll('.account-tab-pane').forEach(x=>x.classList.toggle('active',x.dataset.accountPane==='billing'));
  window.$=id=>document.getElementById(id);window.saasMode='auth';window.saasMe={entitlements:{plan:{limits:{members:15,packagesMonthly:3000}}}};
  window.billingOverviewState={accountVerified:true,subscription:{planCode:'PRO',billingCycle:'monthly',effectivePriceKrw:169000,commercialVersion:'legacy'},plans:{PRO:{monthlyPriceKrw:169000,vatExclusive:true,isActive:true,members:15,packagesMonthly:3000}}};
  window.escapeHtml=s=>String(s).replace(/[<>&"]/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[x]));window.billingMoney=n=>n.toLocaleString('ko-KR')+'원';
 });
 await page.evaluate('(()=>{'+compare+'\nrenderBillingContractComparison();})()');
 await page.evaluate(()=>{
  $('billingCurrentPlan').textContent='PRO · 월';$('billingNextDate').textContent='2026. 10. 30.';$('billingPaymentState').textContent='정상';
  $('billingProviderBadge').textContent='Toss Payments · 연결됨';$('billingProviderBadge').classList.add('on');$('billingPlanPrice').textContent='결제 총액 169,000원 · 부가세 포함 · 기존 계약 조건 유지';
  $('billingInvoiceList').innerHTML='<div class="invoice-row"><div><b>PRO 월 구독 · 169,000원</b><span>2026. 10. 20. · 테스트 청구내역</span></div><span class="invoice-status paid">결제완료</span><a class="btn btn-ghost" href="#receipt">영수증</a></div>';
 });
 await page.locator('#subscriptionBillingPanel').scrollIntoViewIfNeeded();
 const styles=await page.locator('#subscriptionBillingPanel').evaluate(el=>{const s=x=>getComputedStyle(el.querySelector(x));return {grid:s('.billing-grid').display,status:s('.billing-mini span').display,mini:s('.billing-mini b').fontSize,button:s('#billingSchedulePlan').fontSize,control:s('#billingPlanSelect').fontSize,family:s('#billingPlanSelect').fontFamily,body:getComputedStyle(document.body).fontFamily,price:s('.billing-contract-columns strong').fontSize,heading:s('h4').fontSize};});
 assert.equal(styles.grid,'grid');assert.equal(styles.mini,'15px');assert.equal(styles.button,'14px');assert.equal(styles.control,'14px');assert.equal(styles.price,'20px');assert.equal(styles.heading,'16px');assert.match(styles.family,/Carestep Pretendard/);assert.match(styles.body,/Carestep Pretendard/);
 for(const selector of ['.billing-box','.billing-contract-comparison','.billing-plan-row','.invoice-row']){
  const bounds=await page.locator('#subscriptionBillingPanel '+selector).evaluateAll(nodes=>nodes.map(el=>({w:el.clientWidth,scroll:el.scrollWidth})));
  assert.ok(bounds.every(x=>x.scroll<=x.w+1),selector+' must not overflow');
 }
 assert.match(await page.locator('#billingContractComparison').innerText(),/169,000원[\s\S]*185,900원/);
 assert.equal(await page.locator('#billingPlanSelect').isEnabled(),true);
 await page.locator('#billingCycleSelect').selectOption('annual');assert.equal(await page.locator('#billingCycleSelect').inputValue(),'annual');
 await page.locator('#billingContractComparison summary').click();assert.equal(await page.locator('.billing-catalog-row').isVisible(),true);
 if(process.env.HQ_SCREENSHOTS)await page.locator('[data-account-pane="billing"]').screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`clinic-billing-${width}.png`)});
});

const organization=readFileSync(resolve(root,'clinic-organization.js'),'utf8');
const management=organization.slice(organization.indexOf(' function mountHospitalManagement(){'),organization.indexOf(' function mount(){'));
const tabFunction=source.slice(source.indexOf('function setAccountTab('),source.indexOf('function initAccountUx('));
const accountKeyHandler=source.slice(source.indexOf("    tabs.addEventListener('keydown',e=>"),source.indexOf("    tabs.addEventListener('keydown',e=>")+source.slice(source.indexOf("    tabs.addEventListener('keydown',e=>")).indexOf('\n'));
for(const width of [390,1440])test(`Hospital management tabs remain readable and preserve controls at ${width}px`,async t=>{
 const context=await browser.newContext({viewport:{width,height:1000}});t.after(()=>context.close());
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(origin);
 await page.evaluate(()=>{$('appView');function $(id){return document.getElementById(id);}window.$=$;$('appView').classList.remove('hidden');$('loginView').classList.add('hidden');window.ACCOUNT_TABS=new Set(['my','team','billing','security','legal']);window.ACCOUNT_TAB_STORAGE_KEY='test';window.saasMode='demo';});
 await page.evaluate('(()=>{const global=window;const $=window.$;'+management+'\nmountHospitalManagement();mountHospitalManagement();})()');
 await page.evaluate('(()=>{'+tabFunction+'\nwindow.setAccountTab=setAccountTab;})()');
 await page.evaluate('(()=>{const tabs=document.getElementById("accountTabs");'+accountKeyHandler+'})()');
 await page.evaluate(()=>{document.getElementById('hospitalName').dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#saveHospitalScope').getAttribute('data-dirty'),'true');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('carestep:clinical-protocol-updated')));
 assert.equal(await page.locator('#saveClinicalProtocolScope').getAttribute('data-dirty'),'false');
 assert.equal(await page.locator('#clinicLocalAnalytics').count(),1);assert.equal(await page.locator('#clinicVoiceAdministration').count(),1);
 assert.equal(await page.locator('#saasNewPassword').count(),1);assert.equal(await page.locator('label[for="saasNewPassword"]').count(),1);
 for(const view of ['onboarding','settings','account','voice','pilot']){
  await page.evaluate(view=>{document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active-view',el.id===view));window.scrollTo(0,0);if(view==='account')setAccountTab('my');},view);
  await page.locator('#'+view).waitFor({state:'visible'});
  const font=await page.locator('#'+view+' :is(.input,.btn)').first().evaluate(el=>getComputedStyle(el).fontSize);assert.equal(font,'14px',view+' control size');
  if(view==='onboarding'){const color=await page.locator('#onboardingPercent').evaluate(el=>getComputedStyle(el).color);assert.equal(color,'rgb(67, 89, 115)');}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1,`${view} overflow ${overflow}px`);
  if(process.env.HQ_SCREENSHOTS)await page.screenshot({path:resolve(process.env.HQ_SCREENSHOTS,`clinic-management-${view}-${width}.png`)});
 }
 await page.evaluate(()=>{document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active-view',el.id==='pilot'));});
 assert.equal(await page.locator('#pilotLabel').isVisible(),false);await page.locator('#clinicLocalAnalytics>summary').click();assert.equal(await page.locator('#pilotLabel').isVisible(),true);
 await page.evaluate(()=>{document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active-view',el.id==='voice'));});
 assert.equal(await page.locator('#voiceTitle').isVisible(),true);assert.equal(await page.locator('#voiceAdminKey').isVisible(),false);await page.locator('#clinicVoiceAdministration>summary').click();assert.equal(await page.locator('#voiceAdminKey').isVisible(),true);
 assert.equal(await page.locator('[data-voice-type="condition"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active-view',el.id==='account'));setAccountTab('my');document.querySelector('[data-account-tab="team"]').style.display='none';});
 await page.locator('[data-account-tab="my"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-account-tab="billing"]').getAttribute('aria-selected'),'true');
 for(const tab of ['my','team','billing','security','legal']){
  await page.evaluate(tab=>setAccountTab(tab),tab);assert.equal(await page.locator(`[data-account-pane="${tab}"]`).isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'account '+tab+' overflow');
 }
});
