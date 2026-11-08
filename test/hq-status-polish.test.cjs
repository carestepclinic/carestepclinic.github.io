const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1);if(name.includes('/')||!/^[-\w.]+\.(html|js|css|woff2)$/.test(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'})[path.extname(name)]);res.end(fs.readFileSync(path.join(root,name)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(t,width=1280,hash=''){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack));t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});await p.goto(origin+'/hq.html'+hash);
 await p.evaluate(()=>{
  window.reads=[];window.writes=[];window.owner='synthetic';hqSessionToken=()=>owner;window.failList=false;
  const docs=[{id:'p1',title:'시험 질환 A',status:'draft',species:'dog',sourceCurrent:true},{id:'p2',title:'시험 질환 B',status:'published',species:'cat',sourceCurrent:true}];
  req=async(p,o)=>{if(o?.method&&o.method!=='GET'){writes.push(p);throw Error('unexpected write');}reads.push(p);
   if(p==='/hq/training/knowledge-protocols'){if(failList)throw Error('시험 조회 실패');return {items:docs,queue:{counts:{completed:2,queued:1,failed:1},items:[]}};}
   if(p==='/hq/training/knowledge-protocols/preview')return {targets:[]};
   if(p==='/hq/training/knowledge-protocols/p1')return {document:{id:'p1',status:'draft',revision:1,body:{title:'시험 질환 A',disease:'시험',species:'dog',summary:'시험 요약',steps:[]},sources:[],gaps:[],gapResolutions:[]}};
   if(p==='/hq/training/')return {actor:{capabilities:{}},courses:[],assignments:[],members:[],categories:[]};
   if(p==='/hq/guardian-studio/drafts')return {drafts:[],limit:200};
   return {contents:[],categories:[],drafts:[],items:[]};
  };
  document.getElementById('loginOverlay').classList.add('hidden');
 });return p;
}
async function contentFixture(t,width=1440){
 const p=await fixture(t,width);await p.evaluate(()=>{
  const old=req;window.categoryValue='';window.deferContent=false;window.overrideFail=false;window.saveFailure=false;
  req=async(path,o)=>{
   if(path==='/hq/category-overrides') {if(overrideFail)throw Error('분류 연결 실패');return {overrides:categoryValue?[{contentId:'sample',category:categoryValue}]:[]};}
   if(path==='/hq/category-overrides/sample'&&o?.method==='PATCH'){writes.push({path,body:JSON.parse(o.body)});if(saveFailure)throw Error('시험 저장 실패');categoryValue=JSON.parse(o.body).category;return {ok:true};}
   if(path==='/hq/content'){if(deferContent)await new Promise((resolve,reject)=>{window.finishContent=resolve;window.failContent=()=>reject(Error('시험 조회 실패'));});return {contents:[{contentId:'sample',title:'시험 쿠싱 교육',category:'안과',status:'published',version:'0.2'},{contentId:'sample2',title:'시험 눈 교육',category:'안과',status:'published',version:'1.0'}]};}
   return old(path,o);
  };showView('content');
 });await p.locator('[data-content-row=sample]').waitFor();return p;
}

for(const width of [390,1440])test('one loading message, error retry and header alignment '+width,async t=>{
 const p=await contentFixture(t,width);
 assert.equal(await p.locator('#contentManageMode').isVisible(),false);
 await p.evaluate(()=>deferContent=true);await p.locator('#contentRefresh').click();await p.waitForFunction(()=>typeof finishContent==='function');
 assert.equal(await p.locator('#content .hq-load-status:visible').count(),0);
 assert.match(await p.locator('#content [data-hq-read-summary]').innerText(),/이전 결과 표시/);
 assert.equal(await p.locator('[data-content-row]').count(),2);
 await p.evaluate(()=>failContent());await p.locator('#content .hq-load-status[data-state=error]').waitFor();
 assert.equal(await p.locator('#content [data-hq-read-summary]').isVisible(),false);
 await p.evaluate(()=>deferContent=false);await p.locator('#content .hq-load-status').getByRole('button',{name:'다시 시도'}).click();
 await p.waitForFunction(()=>document.querySelector('#content .hq-load-status').dataset.state==='ready');
 assert.match(await p.locator('#content [data-hq-read-summary]').innerText(),/마지막 확인/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
test('archive selection appears only for eligible visible rows and clears when filtered out',async t=>{
 const p=await contentFixture(t);
 await p.evaluate(()=>{contents[0].status='archived';renderContent();});
 assert.equal(await p.locator('#contentManageMode').isVisible(),true);await p.locator('#contentManageMode').check();
 await p.locator('[data-content-bulk]').check();assert.equal(await p.locator('#contentBulkDelete').isEnabled(),true);
 await p.locator('#contentSearch').fill('눈');assert.equal(await p.locator('#contentManageMode').isVisible(),false);
 assert.equal(await p.locator('#contentManageMode').isChecked(),false);assert.equal(await p.locator('#contentBulkDelete').isEnabled(),false);
 await p.locator('#contentSearch').fill('');assert.equal(await p.locator('#contentManageMode').isVisible(),true);
 await p.locator('#contentManageMode').check();assert.equal(await p.locator('[data-content-bulk]').isChecked(),false);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});
for(const width of [390,1440])test('training tabs and header use common HQ styles '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/training/'?Promise.resolve({actor:{common:true,capabilities:{edit:true,review:true}},courses:[],assignments:[],members:[]}):old(path,o);showView('training');});
 await p.locator('#staffTrainingRoot .st-tabs').waitFor();
 const tab=p.locator('#staffTrainingRoot .st-tabs [aria-current=page]');
 assert.equal(await tab.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(25, 118, 111)');
 assert.equal(await tab.evaluate(e=>getComputedStyle(e).fontSize),'14px');
 assert.match(await p.locator('.st-read-summary').innerText(),/마지막 확인/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});

for(const width of [390,1440])for(const view of ['onboarding','integrations'])test('refresh and checked time stay at header right '+view+' '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(v=>{const old=req;req=(path,o)=>path==='/hq/onboarding'?Promise.resolve({clinics:[],summary:{}}):path==='/hq/integrations/messaging'?Promise.resolve({architecture:'home_then_mms_then_lms',oauth:{connected:2}}):old(path,o);showView(v);},view);
 const header=p.locator('#'+view+'>.head');const refresh=p.locator('#'+(view==='onboarding'?'onboardingRefresh':'integrationRefresh'));
 await p.waitForFunction(v=>document.querySelector('#'+v+' [data-hq-read-summary]')?.textContent.includes('마지막 확인'),view);
 const hb=await header.boundingBox(),rb=await refresh.boundingBox();assert.ok(Math.abs(hb.x+hb.width-rb.x-rb.width)<3);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:path.join(process.env.HQ_SCREENSHOTS,view+'-'+width+'.png'),fullPage:false});
});
