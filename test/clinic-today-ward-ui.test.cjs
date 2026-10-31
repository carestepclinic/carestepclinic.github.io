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


for(const width of [390,1680])test('today inpatient layout and direct patient navigation '+width,async t=>{
 const p=await openPage(t,width);
 await p.evaluate(()=>{
 const item={id:'ward-test',kind:'admission',status:'active',revision:1,patient_id:'',patient:{name:'입원 시험환자',species:'cat'},body:{species:'cat',weight:4,title:'입원',location:'고양이 1',tasks:[],orders:[],infusions:[],wardChecks:[]}};
 const old=saasRequest;saasRequest=async(path,options)=>path.endsWith('/clinical/cases')?{items:[item],hasMore:false}:path.endsWith('/clinical/cases/ward-test')?{item,events:[],canRecord:true}:path.endsWith('/clinical/rooms')?{items:[{id:'room-test',name:'고양이 1',patientCase:item}]}:old(path,options);go('dashboard');
 });
 assert.equal(await p.locator('#dashboard .recent-patients, #workRecentPatients').count(),0);
 await p.evaluate(()=>renderWorkFirstDashboard());
 const grid=await p.locator('#clinicHomePrimary').boundingBox(),queue=await p.locator('#clinicTodayQueue').boundingBox();assert.ok(Math.abs(grid.width-queue.width)<2,'today queue uses available width');
 const overview=p.locator('#wardTodayRoot');await overview.getByRole('button',{name:/입원 시험환자/}).waitFor();assert.match(await overview.innerText(),/입원 중 1마리 · 개 0 · 고양이 1/);
 const ward=await overview.boundingBox(),ops=await p.locator('#practiceTodayRoot').boundingBox();assert.ok(ward.y>=ops.y+ops.height);assert.ok(ops.height<120);
 const menu=p.locator("#clinicDashboardManagement");assert.equal(await menu.getAttribute("open"),null);await menu.locator("summary").click();assert.ok(await p.locator("#clinicHomeDirectoryOpen1").isVisible());
 await p.evaluate(()=>document.getElementById("subscriptionBanner").classList.add("blocked"));await p.waitForFunction(()=>document.getElementById("subscriptionBanner").parentElement.id==="dashboard");
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(root,'../today-ward-'+width+'.png'),fullPage:true});
 await overview.getByRole('button',{name:/입원 시험환자/}).click();await p.locator('.cl-workspace[data-section=ward]').waitFor();await p.waitForFunction(()=>document.querySelector('.cl-ward-detail')?.textContent.includes('입원 시험환자'));
 assert.match(await p.locator('.cl-ward-detail').innerText(),/입원 시험환자/);
});

for(const width of [390,1680])test('restored dashboard loads both summaries without visiting another tab '+width,async t=>{
 const p=await openPage(t,width);
 await p.evaluate(async()=>{
  const me=saasMe;saasToken='synthetic-restore-token';saasMode='demo';saasMe=null;
  document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active-view',e.id==='dashboard'));
  document.getElementById('practiceTodayRoot').hidden=true;window.CarestepTodayWard.clear();
  window.restoreSummaryCalls=[];const old=saasRequest;
  saasRequest=async(path,options)=>{restoreSummaryCalls.push(path);return path==='/saas/practice/clinical/cases'?{items:[]}:old(path,options);};
  saasStoredLastView=()=> 'dashboard';saasBootstrapMeOnce=async()=>({me,session:{id:'restored-session'}});
  saasStartSessionServices=async()=>{};
  await saasBootstrap();
 });
 await p.locator('#practiceTodayRoot').getByText('미완료 0건 · 보류 0건',{exact:true}).waitFor();
 await p.locator('#wardTodayRoot').getByText('현재 입원 중인 환자가 없습니다.',{exact:true}).waitFor();
 assert.equal(await p.locator('.view.active-view').getAttribute('id'),'dashboard');
 assert.ok(await p.locator('#practiceTodayRoot').isVisible());assert.ok(await p.locator('#wardTodayRoot').isVisible());
 const calls=await p.evaluate(()=>restoreSummaryCalls);assert.ok(calls.includes('/saas/operations/'));assert.ok(calls.includes('/saas/practice/clinical/cases'));
});

test('clinical work keeps counts during refresh and labels stale results on failure',async t=>{
 const p=await openPage(t,390);
 await p.evaluate(async()=>{
  resetClinicalLoad();followupAllowed=()=>true;notifyNewCareConsultations=()=>{};loadConsultInbox=async()=>{};
  const old=saasRequest;window.clinicalReads=0;window.delayClinical=false;window.failClinical=false;
  saasRequest=async(path,opts)=>{if(!path.startsWith('/saas/care-operations?'))return old(path,opts);clinicalReads++;if(delayClinical)await new Promise(r=>window.releaseClinical=r);if(failClinical)throw Error('offline');return {items:[],actions:[]};};
  go('dashboard');await loadFollowupScheduleBoard();
 });
 await p.waitForFunction(()=>document.getElementById('clinicToday-tab-clinical').textContent.includes('개별 업무 0건'));
 await p.evaluate(()=>{delayClinical=true;window.refreshPending=loadFollowupScheduleBoard(true);});
 assert.match(await p.locator('#clinicToday-tab-clinical').innerText(),/개별 업무 0건.*갱신 중/);
 await p.evaluate(async()=>{failClinical=true;releaseClinical();await refreshPending;});
 assert.match(await p.locator('#clinicToday-tab-clinical').innerText(),/개별 업무 0건.*최신 조회 실패/);
 await p.locator('#clinicToday-tab-clinical').click();assert.match(await p.locator('#clinicClinicalFreshness').innerText(),/최신 조회 실패.*마지막 확인/);
});

for(const width of [390,1680])test('restore shares pending authentication, hides private view and defers full render '+width,async t=>{
 const p=await openPage(t,width);
 await p.evaluate(()=>{
  window.savedRestoreMe=saasMe;saasToken='synthetic-session';saasMe=null;saasMode='demo';
  window.restoreAuthCalls=0;window.fullRenderCalls=0;renderAll=()=>{fullRenderCalls++;};
  saasStoredLastView=()=> 'dashboard';saasStartSessionServices=async()=>{};
  saasBootstrapMeOnce=async()=>{restoreAuthCalls++;await new Promise(r=>window.releaseAuth=r);return {me:savedRestoreMe,session:{id:'verified'}};};
  window.restoreOne=saasBootstrap();window.restoreTwo=saasBootstrap();
 });
 assert.equal(await p.evaluate(()=>restoreOne===restoreTwo),true);assert.equal(await p.evaluate(()=>restoreAuthCalls),1);
 assert.equal(await p.locator('#appView').isVisible(),false);assert.equal(await p.locator('.session-restore-preview').isVisible(),true);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.evaluate(async()=>{releaseAuth();await Promise.all([restoreOne,restoreTwo]);});
 assert.equal(await p.locator('#appView').isVisible(),true);assert.equal(await p.evaluate(()=>fullRenderCalls),0);
 const timing=await p.evaluate(()=>CarestepRestoreTiming);assert.equal(timing.state,'visible');assert.ok(timing.authMs>=0);assert.ok(timing.viewMs>=0);assert.ok(timing.totalMs>=timing.authMs);
});
test('cancelled restoration cannot reopen authenticated screen after response arrives',async t=>{
 const p=await openPage(t,390);await p.evaluate(()=>{const me=saasMe;saasToken='old-session';saasBootstrapMeOnce=async()=>{await new Promise(r=>window.releaseAuth=r);return {me,session:{id:'old'}};};window.restorePending=saasBootstrap();saasCancelRestoreAndLogin();});
 await p.evaluate(async()=>{releaseAuth();await restorePending;});assert.equal(await p.locator('#appView').isVisible(),false);assert.equal(await p.locator('#loginView').isVisible(),true);
});

for(const width of [390,1440])test('account panes load independently, retry failures and open quick actions '+width,async t=>{
 const p=await openPage(t,width);
 await p.evaluate(()=>{
  window.accountCalls=[];window.failAccountSessions=true;saasToken='synthetic-account-token';saasMe.user={id:'owner',displayName:'시험 사용자',email:'example@example.test'};saasMe.clinic.name='시험 병원';
  const old=saasRequest;saasRequest=async(path,opts)=>{accountCalls.push(path);if(path==='/saas/sessions'&&failAccountSessions)throw Error('synthetic offline');if(path==='/saas/members')return {members:[{membershipId:'test',displayName:'시험 직원',email:'staff@example.test',role:'staff',status:'active',permissions:{mode:'default'}}]};if(path==='/saas/diagnostics')return {errors:[]};return old(path,opts);};
  go('account',{accountTab:'my'});
 });
 assert.equal(await p.locator('#accountPassword').getAttribute('open'),null);
 await p.locator('#accountPassword>summary').click();await p.locator('#saasCurrentPassword').waitFor({state:'visible'});
 await p.evaluate(()=>go('account',{accountTab:'team'}));await p.locator('#saasMemberList').getByText('시험 직원',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>accountCalls.filter(x=>x==='/saas/members').length),1);
 await p.evaluate(()=>go('account',{accountTab:'security'}));await p.locator('[data-read="sessions"]').getByRole('button',{name:'다시 시도'}).waitFor();
 assert.match(await p.locator('[data-read="diagnostics"]').innerText(),/확인/);
 const count=await p.evaluate(()=>accountCalls.filter(x=>x==='/saas/diagnostics').length);
 await p.evaluate(()=>failAccountSessions=false);await p.locator('[data-read="sessions"]').getByRole('button').click();await p.waitForFunction(()=>!document.querySelector('[data-read="sessions"] button'));
 assert.equal(await p.evaluate(()=>accountCalls.filter(x=>x==='/saas/diagnostics').length),count);
 await p.evaluate(()=>go('account',{accountTab:'team'}));assert.equal(await p.evaluate(()=>accountCalls.filter(x=>x==='/saas/members').length),1);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:'/tmp/account-settings-'+width+'.png',fullPage:true});
});
