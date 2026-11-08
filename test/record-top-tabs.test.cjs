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
async function load(p,key){await route(p,key);if(key==='surgery')await p.locator('[data-cl-case=cc_surgery]').click();else {const candidates=p.locator('[data-open="cc_'+key+'"],[data-dn-open="cc_'+key+'"],[data-record="cc_'+key+'"],[data-act="open"][data-id="cc_'+key+'"],[data-dn="open"][data-id="cc_'+key+'"]');if(!await candidates.count())throw Error('Missing record selector '+key+' '+await p.locator('[data-body]').innerText());await candidates.first().click();}await p.waitForTimeout(80);}

for(const width of [360,768,1440])test('page tabs above the heading on all five record screens '+width,async()=>{
 const {p,errors}=await page(width);
 for(const key of ['surgery','dental','neuro','ophthalmic','chronic']){
  await route(p,key);const nav=p.locator('.main > .cs-record-page-tabs');
  await nav.waitFor({state:'visible'});assert.equal(await p.locator('.cs-record-navigation').count(),1);
  assert.equal(await nav.locator('[data-record-tab]').count(),5);
  assert.equal(await nav.locator('[aria-pressed=true]').getAttribute('data-record-tab'),key);
  const box=await nav.boundingBox(),heading=await p.locator('.topbar').boundingBox();
  assert.ok(box.y+box.height<=heading.y+1,'tabs precede page heading');
  const widths=await nav.locator('button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().width));
  assert.ok(Math.max(...widths)-Math.min(...widths)<2,'equal widths');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await p.locator('#practiceRoot [data-cs-inpatient]').count(),1);
 }
 await p.evaluate(()=>go('dashboard'));assert.equal(await p.locator('.cs-record-page-tabs:visible').count(),0);
 await route(p,'ward');assert.equal(await p.locator('.cs-record-page-tabs').count(),0);
 await route(p,'surgery');await p.locator('.cs-record-page-tabs [data-record-tab=dental]').click();await p.waitForFunction(()=>CarestepPractice.route()==='dental');
 if(process.env.TABS_SCREENSHOTS){await p.addStyleTag({content:'@font-face{font-family:PreviewKorean;src:url(data:font/woff2;base64,'+fs.readFileSync(path.join(root,'pretendard-variable-1.3.9.woff2')).toString('base64')+') format("woff2");font-weight:100 900}body,button,input,select,textarea{font-family:PreviewKorean,sans-serif!important}'});await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:path.join(process.env.TABS_SCREENSHOTS,'tabs-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);await p.close();
});
test('top navigation keeps patient-scoped chooser and retained drafts',async()=>{
 const {p,errors}=await page();await load(p,'surgery');
 await p.locator('[data-ae-inline] [name=heartRate]').fill('123');
 await p.locator('.cs-record-page-tabs [data-record-tab=dental]').click();
 await p.locator('[data-cs-all]').click();await p.waitForFunction(()=>CarestepPractice.route()==='dental');
 await p.locator('.cs-record-page-tabs [data-record-tab=surgery]').click();
 await p.waitForFunction(()=>CarestepPractice.route()==='surgery');
 assert.equal(await p.locator('[data-ae-inline] [name=heartRate]').inputValue(),'123');
 assert.equal(await p.locator('#practiceRoot .cs-patient-header').count(),1);
 assert.equal(await p.locator('.main > .cs-patient-header').count(),0);
 assert.equal(await p.locator('.cs-record-navigation').count(),1);assert.deepEqual(errors,[]);await p.close();
});
