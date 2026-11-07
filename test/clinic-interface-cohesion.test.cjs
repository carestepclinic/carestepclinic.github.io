const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function page(width=1440){const p=await browser.newPage({viewport:{width,height:950}});p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);await p.evaluate(async()=>{await Promise.all(['dental','neuro','ophthalmic','chronic'].map(k=>ClinicLazyModules.ensure(k)));});await p.evaluate(()=>{
 window.testRequests=[];window.saveFail=false;window.records=[];saasMode='auth';saasToken='synthetic-local-token';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};
 const charts={dental:DentalRecord.empty(),neuro:NeuroRecord.blank(),ophthalmic:OphthalmicRecord.blank(),chronic:ChronicRecord.blank({},['ckd'])};
 for(const [category,chart] of Object.entries(charts))records.push({id:'cc_'+category,kind:'consult',status:'active',revision:1,patient_id:'p_'+category,patient:{id:'p_'+category,name:'합성 '+category,species:'dog'},body:{category,species:'dog',weight:5,[category+'Chart']:chart}});
 records.push({id:'cc_surgery',kind:'surgery',status:'active',revision:1,patient_id:'p_surgery',patient:{id:'p_surgery',name:'합성 마취',species:'dog'},created_at:new Date().toISOString(),body:{species:'dog',weight:5,title:'합성 수술',tasks:[],observations:[],measurements:[],anesthesia:[],timeline:[],events:[],medications:[],surgeryChecks:{},anesthesiaSheet:{},phase:'anesthesia'}});
 saasRequest=async(p,o={})=>{testRequests.push({p,o});const b=o.body?JSON.parse(o.body):null;const fallback={ok:true,items:[],members:[{id:'owner',display_name:'시험 수의사'}],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null};
  const id=p.split('/cases/')[1]?.split(/[/?]/)[0],r=records.find(r=>r.id===id);
  if(r){if(o.method==='POST'){if(saveFail)throw Error('합성 저장 실패');if(b.revision!==r.revision)throw Object.assign(Error('합성 충돌'),{status:409});const category=r.body.category;r.body[category+'Chart']=structuredClone(b.data);r.revision++;return {id:r.id,revision:r.revision,[category+'Chart']:structuredClone(b.data)};}return {...fallback,item:structuredClone(r),events:[],revision:r.revision};}
  if(p.includes('/cases?')||p.endsWith('/cases'))return {...fallback,items:structuredClone(records)};
  for(const category of Object.keys(charts))if(p.includes('/'+category+'?'))return {...fallback,items:records.filter(r=>r.body.category===category).map(r=>({...r,date:r.body[category+'Chart'].date,clinicalStatus:'inProgress',conditions:category==='chronic'?['ckd']:[],diagnosis:''}))};
  return fallback;
 };showApp({deferFullRender:true});go('practice');
 });return {p,errors};}
async function route(p,key){await p.evaluate(key=>go('practice',{practiceTab:key}),key);await p.waitForFunction(key=>CarestepPractice.route()===key,key);await p.waitForTimeout(60);}


for(const width of [390,1280,1600])test('compact calculator, record actions and library '+width,async()=>{
 const {p,errors}=await page(width);await route(p,'calc');await p.waitForSelector('.pt-organized');
 const common=p.locator('.pt-organized .pt-calc-common');
 assert.equal(await common.locator('[data-common-weight]').count(),1);
 assert.equal(await common.locator('.pt-mobile-calc-select').count(),1);
 assert.equal(await p.locator('.pt-workspace-options [data-strength-open]').count(),1);
 await common.locator('[data-common-weight]').fill('5.25');await common.locator('[data-ref-species]').selectOption('dog');
 if(width<1300)await common.locator('[data-calc-jump]').selectOption('fluid');
 else await p.locator('[data-kind=fluid]').click();
 assert.equal(await common.locator('[data-common-weight]').inputValue(),'5.25');
 assert.ok((await common.boundingBox()).height<(width<800?320:220));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/cohesion-calc-'+width+'.png'),fullPage:true});
 await route(p,'dental');await p.waitForSelector('.cs-record-switcher');
 assert.equal(await p.locator('.cs-record-switcher').getAttribute('open'),null);
 assert.equal(await p.locator('[data-cs-inpatient]').count(),1);
 await p.locator('.cs-record-switcher summary').click();
 await p.waitForTimeout(150);assert.equal(await p.locator('.cs-record-navigation').count(),1);
 await p.evaluate(()=>{workflowSettings.recent=[];go('library');renderLibrary();});
 assert.equal(await p.locator('#clinicLibraryRecent').isVisible(),false);
 assert.equal(await p.locator('#clinicLibraryActiveFilters').innerText(),'');
 assert.match(await p.locator('#libraryResultMeta').innerText(),/^\d+개 자료$/);
 assert.equal(await p.locator('#clinicLibraryOutputs').count(),1);
 assert.equal(await p.locator('#library .resource-includes').first().isVisible(),false);
 await p.locator('#searchInput').fill('고양이');await p.locator('#searchInput').dispatchEvent('input');
 assert.equal(await p.locator('#clinicLibraryReset').isVisible(),true);
 await p.locator('#clinicLibraryReset').click();assert.equal(await p.locator('#searchInput').inputValue(),'');
 await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/cohesion-library-'+width+'.png'),fullPage:true});
 assert.deepEqual(errors,[]);await p.close();
});
for(const width of [390,1280])test('ward has one vertical scroll surface and next care follows cards '+width,async()=>{
 const {p,errors}=await page(width);await p.evaluate(()=>{const old=saasRequest;const item={id:'ward',kind:'admission',status:'active',revision:1,patient:{name:'합성 환자',species:'cat'},body:{species:'cat',weight:4,tasks:[{id:'a',title:'시험 주사',category:'injection',status:'planned',plannedAt:new Date(Date.now()+3600000).toISOString()}],orders:[],infusions:[],wardChecks:[]}};records.push(item);saasRequest=async(path,o)=>path.endsWith('/clinical/rooms')?{items:[{id:'a',kind:'cat',name:'고양이 01',patientCase:item},{id:'b',kind:'dog',name:'강아지 01'}]}:old(path,o);});
 await route(p,'ward');await p.waitForSelector('.cs-ward-room-scroll');
 const flow=await p.evaluate(()=>{const a=document.querySelector('.cs-ward-room-scroll'),b=document.querySelector('.cs-next-treatments');return {overflow:getComputedStyle(a).overflowY,max:getComputedStyle(a).maxHeight,position:getComputedStyle(b).position,after:b.getBoundingClientRect().top>=a.getBoundingClientRect().bottom-1};});
 assert.deepEqual(flow,{overflow:'visible',max:'none',position:'static',after:true});
 await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/cohesion-ward-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);await p.close();
});
test('today chooses available clinical work once and respects manual selection',async()=>{
 const {p}=await page();const result=await p.evaluate(()=>{go('dashboard');carestepAttentionSummary=()=>({state:'ready',total:0,targets:0});carestepClinicalSummary=()=>({state:'ready',total:7});ClinicOrganization.updateTodayCounts();const selected=()=>document.querySelector('#clinicTodayQueue [aria-selected=true]').id;const first=selected();document.getElementById('clinicToday-tab-attention').click();ClinicOrganization.updateTodayCounts();return [first,selected()];});
 assert.deepEqual(result,['clinicToday-tab-clinical','clinicToday-tab-attention']);await p.close();
});
test('initial billing load and failure do not claim login failure or absent payment card',async()=>{
 const {p}=await page();const result=await p.evaluate(()=>{billingOverviewState=null;billingOverviewLoading=true;renderBillingOverview();const pending=[document.getElementById('billingSubscriptionSummary').textContent,document.getElementById('billingCardBox').textContent];billingOverviewLoading=false;renderBillingOverview();return {pending,failed:document.getElementById('billingCardBox').textContent};});
 assert.ok(result.pending.every(x=>x.includes('불러오는 중')));assert.match(result.failed,/확인하지 못했습니다/);assert.doesNotMatch(JSON.stringify(result),/로그인 후|등록된 카드 없음/);await p.close();
});

for(const width of [390,1440])test('empty supplies and populated filters remain usable '+width,async()=>{
 const {p,errors}=await page(width);await p.evaluate(()=>{window.supplyData={revision:0,userId:'owner',manager:true,categories:[{id:'a',name:'사료',active:true},{id:'b',name:'기타',active:true}],vendors:[],items:[]};const host=document.createElement('section');host.id='suppliesTest';document.getElementById('practiceRoot').replaceChildren(host);window.supplies=ClinicPurchases.mount(host,{identity:()=> 'test',ready:()=>true,request:async()=>supplyData});supplies.open();});
 await p.waitForSelector('.purchase-empty');assert.equal(await p.locator('#suppliesTest [data-selection]').isVisible(),false);assert.equal(await p.locator('#suppliesTest [data-filters]').isVisible(),false);assert.equal(await p.locator('.purchase-section').count(),0);assert.equal(await p.locator('#suppliesTest [data-create]').isVisible(),true);
 await p.evaluate(()=>{supplyData.items=[{id:'one',name:'합성 사료',categoryId:'a',status:'needed',quantity:1,unit:'봉',spec:'1kg',events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];});await p.locator('#suppliesTest [data-refresh]').click();await p.waitForSelector('.purchase-row');assert.equal(await p.locator('.purchase-section').count(),1);assert.equal(await p.locator('#suppliesTest [data-selection]').isVisible(),true);await p.locator('#suppliesTest [data-query]').fill('없는물품');assert.equal(await p.locator('.purchase-row').count(),0);await p.locator('#suppliesTest [data-query]').fill('');assert.equal(await p.locator('.purchase-row').count(),1);assert.deepEqual(errors,[]);await p.close();
});
test('HOME settings retain guardian connection and one automation action',async()=>{const {p,errors}=await page();await p.evaluate(()=>{go('settings');ClinicSettings.openSection(4);window.homeOpened=0;window.r61OpenHomeSettings=()=>homeOpened++;});assert.equal(await p.locator('[data-settings-action=home]').isVisible(),true);assert.equal(await p.locator('[data-settings-action=visibility]:visible').count(),0);await p.getByRole('button',{name:'자동발송·HOME 공개 설정',exact:true}).click();assert.equal(await p.evaluate(()=>homeOpened),1);assert.deepEqual(errors,[]);await p.close();});
