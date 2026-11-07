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
for(const width of [390,1440])test('record primary actions match and mobile search stays beside input '+width,async()=>{
 const {p,errors}=await page(width);let color;
 for(const key of ['surgery','dental','neuro','ophthalmic','chronic']){await route(p,key);const button=p.locator('.cs-list-actionbar>.pt-primary');await button.waitFor();const next=await button.evaluate(e=>getComputedStyle(e).backgroundColor);if(color)assert.equal(next,color,key);color=next;
 if(width===390){const form=p.locator('.record-filters,.cl-anesthesia-filters').first(),input=await form.locator(':scope>label:first-child input').boundingBox(),search=await form.locator(':scope>button[type=submit],:scope>button:not([type])').first().boundingBox();assert.ok(Math.abs(input.y-search.y)<8,key);}
 }
 assert.deepEqual(errors,[]);await p.close();
});
test('calculator empty status takes no space and reset remains available',async()=>{const {p}=await page(390);await route(p,'calc');await p.waitForSelector('.pt-calc-common');const size=await p.locator('.pt-settings-status').evaluate(e=>({empty:!e.textContent.trim(),height:e.getBoundingClientRect().height}));if(size.empty)assert.equal(size.height,0);assert.equal(await p.getByRole('button',{name:'계산 입력 모두 지우기',exact:true}).isVisible(),true);await p.close();});
test('settings save controls remain in normal flow',async()=>{const {p}=await page();await p.evaluate(()=>go('settings'));await p.locator('.cs-inline-form .settings-actions').first().waitFor();assert.equal(await p.locator('.cs-inline-form .settings-actions').first().evaluate(e=>getComputedStyle(e).position),'static');await p.close();});



for(const width of [390,1440])test('urgent filter combines status and search, clears selection and survives refresh '+width,async()=>{
 const {p,errors}=await page(width);await p.evaluate(async()=>{await ClinicLazyModules.ensure('purchases').catch(()=>{});const host=document.createElement('section');document.getElementById('practiceRoot').replaceChildren(host);window.supplyData={revision:0,userId:'owner',manager:true,categories:[{id:'c',name:'소모품'}],vendors:[],items:['needed','ordered','received'].flatMap(status=>[false,true].map(urgent=>({id:status+urgent,name:(urgent?'긴급':'일반')+' 물품',categoryId:'c',status,urgent,quantity:1,unit:'개',spec:'',events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))};window.supplies=ClinicPurchases.mount(host,{identity:()=> 'test',ready:()=>true,request:async()=>structuredClone(supplyData)});await supplies.open();});
 await p.locator('.purchase-row').first().waitFor();assert.equal(await p.locator('.purchase-row').count(),2);
 await p.locator('[data-select]').first().check();await p.locator('[data-urgent-only]').click();assert.equal(await p.locator('.purchase-row').count(),1);assert.equal(await p.locator('[data-select]:checked').count(),0);assert.match(await p.locator('[data-selection]').innerText(),/표시된 결과 1건 선택/);
 await p.locator('[data-query]').fill('없는 물품');assert.equal(await p.locator('.purchase-row').count(),0);assert.match(await p.locator('[data-list]').innerText(),/긴급 물품이 없습니다/);
 await p.locator('[data-query]').fill('긴급');await p.locator('[data-refresh]').click();await p.waitForTimeout(100);assert.equal(await p.locator('.purchase-row').count(),1);
 await p.locator('[data-mode=incoming]').click();assert.equal(await p.locator('.purchase-row').count(),1);assert.equal(await p.locator('[data-urgent-only]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-mode=vendors]').click();assert.equal(await p.locator('[data-urgent-only]').isVisible(),false);await p.locator('[data-mode=needed]').click();assert.equal(await p.locator('.purchase-row').count(),1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/urgent-'+width+'.png')});assert.deepEqual(errors,[]);await p.close();
});
for(const width of [390,1440])test('record list has grouped actions and explicit missing labels '+width,async()=>{
 const {p,errors}=await page(width);await route(p,'dental');await p.waitForSelector('.cs-list-actionbar');assert.equal(await p.locator('.cs-list-actionbar .cs-list-tools').count(),1);assert.match(await p.locator('.cs-record-missing').first().innerText(),/미입력: 보호자/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/record-actions-'+width+'.png')});assert.deepEqual(errors,[]);await p.close();
});

for(const width of [390,1440])test('opened records are directly reachable with patient identity '+width,async()=>{
 const {p,errors}=await page(width);await route(p,'dental');await p.locator('[data-record=cc_dental]').click();await p.waitForTimeout(150);await route(p,'chronic');await p.locator('[data-open=cc_chronic]').click();await p.waitForTimeout(150);await p.locator('[data-cs-resume=dental]').waitFor();assert.equal(await p.locator('[data-cs-resume=dental]').isVisible(),true);assert.match(await p.locator('[data-cs-resume=dental]').innerText(),/합성 dental/);await p.locator('[data-cs-resume=dental]').click();await p.waitForFunction(()=>CarestepPractice.route()==='dental');assert.equal(await p.locator('[data-cs-resume=chronic]').isVisible(),true);assert.deepEqual(errors,[]);await p.close();
});
test('dashboard groups failure messages and retry preserves clear failure state',async()=>{
 const {p,errors}=await page();await p.evaluate(async()=>{saasRequest=async()=>{throw Error('합성 조회 실패');};go('dashboard');await carestepRefreshInbox();});await p.locator('.care-failure-details').waitFor({state:'attached'});assert.equal(await p.locator('.care-failure-details').count(),1);assert.equal(await p.locator('#clinicCareRows .is-error').count(),0);assert.equal(await p.locator('#clinicCareStatus button').count(),1);await p.locator('.care-failure-details summary').click();assert.ok(await p.locator('.care-failure-details button').count()>0);await p.locator('#clinicCareStatus button').click();await p.waitForTimeout(150);assert.match(await p.locator('#clinicCareStatus').innerText(),/갱신 실패/);assert.deepEqual(errors,[]);await p.close();
});

test('all five record lists group primary and secondary actions',async()=>{const {p,errors}=await page();for(const key of ['surgery','dental','neuro','ophthalmic','chronic']){await route(p,key);await p.locator('.cs-list-actionbar').waitFor();assert.equal(await p.locator('.cs-list-actionbar .cs-list-tools').count(),1,key);}assert.deepEqual(errors,[]);await p.close();});

test('retained record lists never accumulate controls after repeated navigation',async()=>{
 const {p,errors}=await page();
 for(let cycle=0;cycle<4;cycle++)for(const key of ['surgery','dental','neuro','ophthalmic','chronic']){
  await route(p,key);await p.locator('.cs-list-actionbar').waitFor();
  for(const selector of ['.cs-record-navigation','.cs-list-tools','.cs-record-switcher','[data-cs-inpatient]'])assert.equal(await p.locator(selector).count(),1,key+' cycle '+cycle+' '+selector);
  assert.equal(await p.locator('[data-clinical-summary],.ca-entry').count(),0);
 }
 await p.evaluate(()=>{window.mutationCount=0;window.auditObserver=new MutationObserver(x=>mutationCount+=x.length);auditObserver.observe(document.getElementById('practiceRoot'),{childList:true,subtree:true});});
 await p.waitForTimeout(350);const mutations=await p.evaluate(()=>{auditObserver.disconnect();return mutationCount;});assert.ok(mutations<5,'idle toolbar must settle: '+mutations);
 await p.locator('[data-cs-inpatient]').click();await p.locator('dialog[open]').waitFor();assert.deepEqual(errors,[]);await p.close();
});
for(const width of [390,1440])test('chronic cards and search use readable available width '+width,async()=>{
 const {p}=await page(width);await route(p,'chronic');await p.locator('.chr-patient-group').waitFor();
 const bounds=await p.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {scope:rect('.chr-list-scope'),card:rect('.chr-patient-group'),record:rect('.chr-latest>.er-record'),input:rect('.record-filters input[name=q]'),search:rect('.record-filters>button')};});
 assert.ok(bounds.card.y>=bounds.scope.bottom);assert.ok(bounds.record.width>bounds.card.width*.8);
 if(width===390)assert.ok(Math.abs(bounds.input.y-bounds.search.y)<8,JSON.stringify(bounds));
 await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/chronic-compact-'+width+'.png')});await p.close();
});
for(const width of [390,1100,1800])test('supplies responsive columns preserve long names and actions '+width,async()=>{
 const {p,errors}=await page(width);await p.evaluate(async()=>{const host=document.createElement('section');document.getElementById('practiceRoot').replaceChildren(host);const categories=['의약품','수술실 용품','진료 용품'].map((name,i)=>({id:'c'+i,name}));const data={revision:0,userId:'owner',manager:true,categories,vendors:[],items:categories.flatMap((c,i)=>[0,1].map(n=>({id:c.id+n,name:n?'긴 제품명 확인용 멸균 일회용 카테터 및 수액 연결 세트 100개입':'시험 물품',categoryId:c.id,status:'needed',urgent:!n,quantity:12,unit:'개',spec:'100mg',note:'주문 요청 메모와 긴 규격이 잘리지 않고 줄바꿈되어야 합니다.',events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))};window.supplies=ClinicPurchases.mount(host,{identity:()=> 'test',ready:()=>true,request:async()=>structuredClone(data)});await supplies.open();});
 const layout=await p.evaluate(()=>({width:document.querySelector('.cs-purchases').getBoundingClientRect().width,columns:getComputedStyle(document.querySelector('.purchase-category-grid')).gridTemplateColumns,overflow:[...document.querySelectorAll('.purchase-item,.purchase-row-actions,.purchase-section')].filter(x=>x.scrollWidth>x.clientWidth+2).map(x=>x.className)}));
 assert.deepEqual(layout.overflow,[]);if(layout.width>=1320)assert.equal(layout.columns.split(' ').length,3);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await p.locator('[data-urgent-only]').click();assert.match(await p.locator('[data-mode=needed]').innerText(),/긴급 3/);assert.match(await p.locator('[data-mode=needed]').getAttribute('title'),/전체 6건/);
 await p.screenshot({path:path.resolve(root,'../clinic-redesign-preview/supplies-compact-'+width+'.png'),fullPage:true});assert.deepEqual(errors,[]);await p.close();
});
