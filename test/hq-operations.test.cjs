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
async function fixture(t,width=1440,lateOperations=false){
 const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 if(lateOperations)await context.route('**/hq-operations.js?*',r=>r.fulfill({contentType:'text/javascript',body:''}));
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

async function setup(t,width=1440,lateOperations=false){const p=await fixture(t,width,lateOperations);await p.evaluate(()=>{
 window.checklist={};window.failDelete=false;window.failSave=false;window.failMaterial=false;
 const baseReq=req;req=async(path,opt)=>{
  if(path==='/hq/production-launch'){if(opt?.method==='PUT'){writes.push(JSON.parse(opt.body));if(failSave)throw Error('synthetic save failure');Object.assign(checklist,JSON.parse(opt.body));}return {checklist:{state:{...checklist},done:0,total:9},security:{checks:[]},operations:{}};}
  if(path==='/hq/deletion-requests'){reads.push(path);if(failDelete)throw Error('synthetic deletion failure');if(window.holdDelete)await new Promise(r=>window.releaseDelete=r);return {requests:[]};}
  if(path.startsWith('/hq/audit?')){reads.push(path);const q=new URL(path,'https://test.invalid').searchParams;if(window.holdAudit)await new Promise(r=>window.releaseAudit=r);return {events:[{id:q.get('cursor')?'old':'recent',action:'test',createdAt:'2020-01-01',detail:{}}],actions:['test','old_action'],asOf:'2026-11-27T00:00:00Z',nextCursor:q.get('cursor')?'':'["2020-01-01","old"]'};}
  if(path.startsWith('/hq/material-work?')){reads.push(path);const kind=new URL(path,'https://test.invalid').searchParams.get('kind');if(kind==='content'&&failMaterial)throw Error('synthetic material failure');return {items:kind==='training'?[{id:'draft1',title:'합성 작성 중',status:'writing'}]:[],writing:kind==='training'?1:0,review:0};}
  return baseReq(path,opt);
 };
 });if(lateOperations)await p.addScriptTag({content:fs.readFileSync(path.join(root,'hq-operations.js'),'utf8')});else await p.evaluate(()=>CarestepHqOperations.loadMaterials(true));return p;}
for(const width of [1440,390])test('checklist survives requery and navigation; changed fields only save '+width,async t=>{const p=await setup(t,width);await p.evaluate(()=>showView('production'));await p.locator('[data-launch-key]').first().waitFor();const key=await p.locator('[data-launch-key]').first().getAttribute('data-launch-key');await p.locator('[data-launch-key]').first().check();await p.evaluate(()=>loadProductionLaunch());assert.equal(await p.locator('[data-launch-key]').first().isChecked(),true);assert.match(await p.locator('#hqChecklistDraft').innerText(),/저장하지 않은 변경 1개/);await p.evaluate(()=>showView('dashboard'));await p.evaluate(()=>showView('production'));await p.locator('[data-launch-key]').first().waitFor();assert.equal(await p.locator('[data-launch-key]').first().isChecked(),true);await p.locator('#saveProductionChecklist').click();await p.waitForFunction(()=>!CarestepHqOperations.isSaving());assert.deepEqual(await p.evaluate(()=>writes),[{[key]:true}]);assert.equal(await p.locator('#hqChecklistDraft').innerText(),'');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
test('partial production failure retries only failed panel and retains checklist',async t=>{const p=await setup(t);await p.evaluate(()=>{failDelete=true;showView('production');});await p.locator('[data-hq-panel-state=deletions] button').waitFor();await p.locator('[data-launch-key]').first().check();await p.evaluate(()=>{reads=[];failDelete=false;});await p.locator('[data-hq-panel-state=deletions] button').click();await p.waitForFunction(()=>document.querySelector('[data-hq-panel-state=deletions]').textContent==='');assert.deepEqual(await p.evaluate(()=>reads),['/hq/deletion-requests']);assert.equal(await p.locator('[data-launch-key]').first().isChecked(),true);});
test('checklist save failure keeps local edits; lock clears drafts and late response',async t=>{const p=await setup(t);await p.evaluate(()=>showView('production'));await p.locator('[data-launch-key]').first().check();await p.evaluate(()=>failSave=true);await p.locator('#saveProductionChecklist').click();await p.waitForFunction(()=>!CarestepHqOperations.isSaving());assert.equal(await p.locator('[data-launch-key]').first().isChecked(),true);await p.evaluate(()=>{holdDelete=true;void loadProductionLaunch();});await p.waitForFunction(()=>typeof releaseDelete==='function');await p.evaluate(()=>{document.querySelector('#loginOverlay').classList.remove('hidden');identity='another';releaseDelete();});await p.waitForFunction(()=>!CarestepHqOperations.hasDirty());assert.equal(await p.locator('[data-launch-key]').count(),0);});
test('audit server filters and snapshot pagination; delayed results cannot replace new search',async t=>{const p=await setup(t);await p.evaluate(()=>showView('audit'));await p.locator('[data-audit-next]:enabled').waitFor();await p.locator('[data-audit-next]').click();await p.waitForFunction(()=>document.querySelector('[data-audit-page]').textContent==='2페이지');assert.ok((await p.evaluate(()=>reads)).some(x=>x.includes('cursor=')&&x.includes('asOf=')));await p.locator('#hqAuditClinic').fill('합성');await p.waitForFunction(()=>reads.some(x=>x.includes('clinic=%ED%95%A9%EC%84%B1')));await p.waitForFunction(()=>document.querySelector('[data-audit-page]').textContent==='1페이지');assert.match(await p.locator('#hqAuditSummary').innerText(),/전체 이력 검색/);assert.equal(await p.locator('#hqAuditAction option[value=old_action]').count(),1);assert.deepEqual(await p.evaluate(()=>writes),[]);});
test('material queue retries a source only and opens existing draft without generation',async t=>{const p=await setup(t);await p.evaluate(()=>{failMaterial=true;void CarestepHqOperations.loadMaterials(true);});await p.locator('[data-work-kind=training] .hq-work-item').waitFor();await p.locator('[data-work-kind=content]').getByRole('button',{name:'다시 조회',exact:true}).waitFor();await p.evaluate(()=>{reads=[];failMaterial=false;});await p.locator('[data-work-kind=content]').getByRole('button',{name:'다시 조회',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-work-kind=content]').textContent.includes('해당 자료 없음'));assert.deepEqual(await p.evaluate(()=>reads),['/hq/material-work?kind=content']);await p.evaluate(()=>{CarestepTraining.openVersion=id=>window.opened=id;});await p.locator('[data-work-kind=training] .hq-work-item').click();assert.equal(await p.evaluate(()=>opened),'draft1');assert.deepEqual(await p.evaluate(()=>writes),[]);});
test('paused and expired-trial hospitals are distinct from current action counts; portfolios keep all records',async t=>{const p=await setup(t);await p.evaluate(()=>{
 const base=req;window.testHospitals=[{clinicId:'active',clinicName:'사용 병원',status:'risk',steps:[],subscription:{status:'active'}},{clinicId:'paused',clinicName:'중지 병원',status:'risk',steps:[],subscription:{status:'paused'}},{clinicId:'expired',clinicName:'종료 병원',status:'risk',steps:[],subscription:{status:'trialing',trialDaysLeft:-1}}];req=async(path,o)=>['/hq/onboarding','/hq/customer-success'].includes(path)?{clinics:testHospitals,summary:{risk:3}}:base(path,o);return loadHqActionCenter();
 });assert.equal(await p.locator('#acOnboardingAttention').innerText(),'1');assert.equal(await p.locator('#acCustomerRisk').innerText(),'1');assert.match(await p.locator('#hqDeferredHospitals summary').innerText(),/2곳/);await p.evaluate(()=>{customerSuccessPortfolio={clinics:testHospitals};renderCustomerSuccess();});assert.equal(await p.locator('#customerSuccessRows tr.hq-row-priority').count(),3);await p.evaluate(()=>{document.querySelector('#hqScope-customerSuccess').value='active';renderCustomerSuccess();});assert.equal(await p.locator('#customerSuccessRows tr.hq-row-priority').count(),1);assert.deepEqual(await p.evaluate(()=>writes),[]);});


test('slow deletion lookup does not block checklist or incident rendering; dashboard fits mobile',async t=>{const p=await setup(t,390);await p.evaluate(()=>{holdDelete=true;showView('production');});await p.locator('[data-launch-key]').first().waitFor();await p.locator('[data-inc-position]').waitFor();assert.ok(await p.locator('[data-launch-key]').count()>0);await p.waitForFunction(()=>typeof releaseDelete==='function');await p.evaluate(()=>{releaseDelete();showView('dashboard');});await p.locator('[data-work-kind=training] .hq-work-item').waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(root,'../hq-operations-mobile.png'),fullPage:true});});
test('changing audit query invalidates an older in-flight reply immediately',async t=>{const p=await setup(t);await p.evaluate(()=>showView('audit'));await p.locator('.hq-audit-table').waitFor();await p.evaluate(()=>{holdAudit=true;window.waitingAudit=loadAudit();});await p.waitForFunction(()=>typeof releaseAudit==='function');await p.locator('#hqAuditClinic').fill('다른 조건');await p.evaluate(()=>{holdAudit=false;releaseAudit();});await p.waitForFunction(()=>document.querySelector('#hqAuditSummary').textContent.includes('전체 이력 검색'));assert.ok((await p.evaluate(()=>reads)).some(x=>x.includes('clinic=%EB%8B%A4%EB%A5%B8')));});

test('real training direct-open waits for first list and actor before opening existing document',async t=>{
 const p=await setup(t);await p.evaluate(()=>{
  const previous=req;req=async(path,opt)=>{if(path==='/hq/training/'){reads.push(path);await new Promise(r=>window.finishTrainingList=r);return {actor:{common:true,capabilities:{edit:true,review:true}},courses:[],assignments:[],members:[],categories:[]};}
  if(path==='/hq/training/versions/draft1'){reads.push(path);return {document:{id:'draft1',title:'실제 연결 시험 초안',kind:'education',status:'draft',editable:true,common:true,version:1,revision:1,sources:[],body:{sections:[{key:'clinical',items:[{text:'가상 자료'}]}],gaps:[],quiz:[]}}};}
  return previous(path,opt);};return CarestepHqOperations.loadMaterials(true);
 });await p.locator('[data-work-kind=training] .hq-work-item').click();await p.waitForFunction(()=>typeof finishTrainingList==='function');assert.equal(await p.locator('dialog[open]').count(),0);assert.ok(!(await p.evaluate(()=>reads)).includes('/hq/training/versions/draft1'));await p.evaluate(()=>finishTrainingList());await p.getByRole('heading',{name:'실제 연결 시험 초안',exact:true}).waitFor();assert.equal(await p.locator('dialog[open]').count(),1);assert.deepEqual(await p.evaluate(()=>writes),[]);
});
test('training direct-open is cancelled when operator leaves during first list load',async t=>{
 const p=await setup(t);await p.evaluate(()=>{const previous=req;req=async(path,opt)=>{if(path==='/hq/training/'){await new Promise(r=>window.finishTrainingList=r);return {actor:{capabilities:{}},courses:[],assignments:[],members:[],categories:[]};}return previous(path,opt);};return CarestepHqOperations.loadMaterials(true);});await p.locator('[data-work-kind=training] .hq-work-item').click();await p.waitForFunction(()=>typeof finishTrainingList==='function');await p.evaluate(()=>{showView('dashboard');finishTrainingList();});assert.equal(await p.locator('dialog[open]').count(),0);assert.deepEqual(await p.evaluate(()=>writes),[]);
});

for(const view of ['onboarding','customerSuccess'])test('scope survives route restoration and all reset paths clear it '+view,async t=>{
 const p=await setup(t);await p.evaluate(view=>{showView(view);const rows=[{clinicId:'a',clinicName:'이용 병원',status:'risk',steps:[],subscription:{status:'active'}},{clinicId:'b',clinicName:'중지 병원',status:'risk',steps:[],subscription:{status:'paused'}}];if(view==='onboarding'){onboardingPortfolio={clinics:rows};renderOnboardingPortfolio();}else{customerSuccessPortfolio={clinics:rows};renderCustomerSuccess();}},view);
 await p.locator('#hqScope-'+view).selectOption('deferred');await p.locator('#'+view+'Search').fill('없음');
 await p.evaluate(()=>{const saved=JSON.parse(sessionStorage.getItem('carestep_hq_ui_v20261020'));window.savedFilters=saved.filters;});
 assert.equal(await p.evaluate(v=>savedFilters['hqScope-'+v],view),'deferred');
 await p.evaluate(view=>{document.getElementById('hqScope-'+view).value='all';CarestepHqUX.restoreRoute();},view);
 assert.equal(await p.locator('#hqScope-'+view).inputValue(),'deferred');
 const reset=view==='onboarding'?'onboarding_reset':'cs_reset';
 await p.locator('[data-hq-empty-action='+reset+']').click();
 assert.equal(await p.locator('#hqScope-'+view).inputValue(),'all');assert.equal(await p.locator('#'+view+'Search').inputValue(),'');
 if(view==='customerSuccess'){await p.locator('#hqScope-'+view).selectOption('deferred');await p.locator('#hqAdoptionReset').click();assert.equal(await p.locator('#hqScope-'+view).inputValue(),'all');}
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});

test('material short revisit reuses cache, refresh preserves rows/count and one failed source keeps prior result',async t=>{
 const p=await setup(t);await p.evaluate(()=>{reads=[];showView('billing');showView('dashboard');});
 await p.waitForTimeout(80);assert.equal((await p.evaluate(()=>reads)).filter(x=>x.startsWith('/hq/material-work?')).length,0);
 await p.evaluate(()=>{const previous=req;req=async(path,opt)=>{if(path.includes('material-work?kind=training')){await new Promise(r=>window.finishMaterial=r);throw Error('합성 연결 실패');}return previous(path,opt);};void CarestepHqOperations.loadMaterials(true);});
 await p.waitForFunction(()=>typeof finishMaterial==='function');assert.equal(await p.locator('[data-work-kind=training] .hq-work-item').count(),1);assert.equal(await p.locator('[data-work-tab=writing]').innerText(),'작성 중 1');
 await p.evaluate(()=>finishMaterial());await p.locator('[data-work-kind=training]').getByRole('button',{name:'다시 조회',exact:true}).waitFor();
 assert.equal(await p.locator('[data-work-kind=training] .hq-work-item').count(),1);assert.match(await p.locator('[data-work-kind=training]').innerText(),/이전 결과 유지/);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});

for(const width of [1440,390])test('empty sources stay compact and review tab retains access '+width,async t=>{
 const p=await setup(t,width);await p.evaluate(()=>showView('dashboard'));await p.locator('[data-work-kind=training] .hq-work-item').waitFor();
 assert.equal(await p.locator('.hq-work-sources [data-work-kind]').count(),1);assert.equal(await p.locator('.hq-work-empty [data-work-kind]').count(),3);
 await p.locator('[data-work-tab=review]').click();assert.equal(await p.locator('.hq-work-empty [data-work-kind]').count(),4);assert.ok(await p.locator('.hq-work-sources').isHidden());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('[data-work-kind=protocols] button').click();assert.equal(await p.evaluate(()=>location.hash),'#protocols');assert.deepEqual(await p.evaluate(()=>writes),[]);
});

test('audit loading, failed and empty results have distinct messages and readable known events',async t=>{
 const p=await setup(t);await p.evaluate(()=>{const previous=req;req=async(path,opt)=>{if(path.startsWith('/hq/audit?')){if(window.auditScenario==='wait'){await new Promise(r=>window.finishAudit=r);throw Error('합성 실패');}if(window.auditScenario==='empty')return {events:[],actions:[]};return {events:[{action:'hq.individual_login',targetType:'hq_session',detail:{expiresAt:'2026-12-01T00:00:00Z'}},{action:'guardian.publish',targetType:'content',detail:{reviewerName:'가상 검토자',version:3}},{action:'incident.status',detail:{status:'resolved'}}],actions:['hq.individual_login','guardian.publish']};}return previous(path,opt);};auditScenario='wait';showView('audit');});
 await p.waitForFunction(()=>typeof finishAudit==='function');assert.match(await p.locator('#auditList').innerText(),/불러오고/);assert.doesNotMatch(await p.locator('#auditList').innerText(),/없습니다/);
 await p.evaluate(()=>finishAudit());await p.locator('[data-audit-retry]:visible').waitFor();assert.match(await p.locator('#auditList').innerText(),/확인하지 못/);assert.doesNotMatch(await p.locator('#auditList').innerText(),/없습니다/);
 await p.evaluate(()=>{auditScenario='empty';return loadAudit();});assert.match(await p.locator('#auditList').innerText(),/조건에 맞는.*없습니다/);
 await p.evaluate(()=>{auditScenario='ready';return loadAudit();});const text=await p.locator('#auditList').innerText();assert.match(text,/운영자 개인 인증 로그인/);assert.match(text,/보호자 안내자료 게시/);assert.match(text,/해결 완료/);assert.match(text,/로그인 만료 시각/);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});

test('successful saved changes invalidate material cache through the request wrapper',async t=>{
 const p=await setup(t,1440,true);await p.evaluate(()=>CarestepHqOperations.loadMaterials(true));await p.evaluate(()=>{reads=[];});
 await p.evaluate(()=>req('/hq/production-launch',{method:'PUT',body:'{}'}));
 await p.evaluate(()=>CarestepHqOperations.loadMaterials());assert.equal((await p.evaluate(()=>reads)).filter(x=>x.startsWith('/hq/material-work?')).length,4);
});

test('lock during material refresh clears cached data and ignores late responses',async t=>{
 const p=await setup(t);await p.evaluate(()=>{const prior=req;req=async(path,opt)=>{if(path.includes('material-work?kind=training'))await new Promise(r=>window.finishMaterial=r);return prior(path,opt);};void CarestepHqOperations.loadMaterials(true);});
 await p.waitForFunction(()=>typeof finishMaterial==='function');await p.evaluate(()=>{document.querySelector('#loginOverlay').classList.remove('hidden');identity='other';finishMaterial();});await p.waitForFunction(()=>document.querySelectorAll('.hq-work-item').length===0);assert.equal(await p.locator('.hq-work-item').count(),0);
});
