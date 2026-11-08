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
for(const width of [390,1440])test('existing content can be searched while refreshing; mutations blocked; retry after failure '+width,async t=>{
 const p=await contentFixture(t,width);await p.evaluate(()=>{deferContent=true;});await p.locator('#contentRefresh').click();
 await p.waitForFunction(()=>typeof finishContent==='function');
 assert.equal(await p.locator('#contentSearch').isEnabled(),true);await p.locator('#contentSearch').fill('쿠싱');
 assert.equal(await p.locator('[data-content-row]').count(),1);assert.equal(await p.locator('[data-content-status]').isEnabled(),false);
 assert.equal(await p.locator('#contentRefresh').isEnabled(),false);await p.evaluate(()=>failContent());
 await p.waitForFunction(()=>!document.getElementById('contentRefresh').disabled);
 await p.locator('#contentSearch').fill('눈');assert.equal(await p.locator('[data-content-row]').count(),1);
 assert.equal(await p.locator('#contentRefresh').isEnabled(),true);assert.equal(await p.locator('[data-content-status]').isEnabled(),false);
 await p.evaluate(()=>{deferContent=false;});await p.locator('#contentRefresh').click();await p.waitForFunction(()=>!document.querySelector('[data-content-status]').disabled);
 assert.equal(await p.locator('#contentSearch').inputValue(),'눈');assert.deepEqual(await p.evaluate(()=>writes),[]);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
test('category change uses metadata endpoint, persists in list and filter without generating/publishing',async t=>{
 const p=await contentFixture(t);const row=p.locator('[data-content-row=sample]');await row.locator('summary').click();await row.getByRole('button',{name:'분류 확인·수정'}).click();
 const d=p.getByRole('dialog');await d.locator('[data-category-value]').selectOption('만성질환');await d.getByRole('button',{name:'분류 저장',exact:true}).click();await d.waitFor({state:'detached'});
 assert.match(await p.locator('[data-content-row=sample] .hq-content-title').innerText(),/만성질환/);
 assert.match(await p.locator('[data-content-row=sample]').innerText(),/공개 중/);
 assert.deepEqual(await p.evaluate(()=>writes),[{path:'/hq/category-overrides/sample',body:{category:'만성질환'}}]);
 await p.locator('#content .hq-secondary-filters summary').click();await p.locator('#contentCategory').selectOption('만성질환');assert.equal(await p.locator('[data-content-row]').count(),1);
 await p.locator('#contentRefresh').click();await p.waitForFunction(()=>!document.getElementById('contentRefresh').disabled);assert.equal(await p.locator('#contentCategory').inputValue(),'만성질환');assert.equal(await p.locator('[data-content-row]').count(),1);
});
test('category save failure stays open without success label; category-read failure disables mutation',async t=>{
 const p=await contentFixture(t);await p.evaluate(()=>saveFailure=true);await p.locator('[data-content-row=sample] summary').click();await p.locator('[data-guardian-category=sample]').click();
 await p.locator('[data-category-value]').selectOption('만성질환');await p.locator('[data-category-save]').click();await p.getByText('저장하지 못했습니다. 시험 저장 실패').waitFor();assert.equal(await p.locator('[data-category-save]').isEnabled(),true);
 await p.locator('[data-category-cancel]').click();await p.evaluate(()=>overrideFail=true);await p.locator('#contentRefresh').click();await p.getByText(/분류 설정을 불러오지 못했습니다/).waitFor();
 await p.locator('[data-content-row=sample] summary').click();assert.equal(await p.locator('[data-guardian-category=sample]').isEnabled(),false);
});
test('training public tab does not inherit manage draft filter and manage choice is retained',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/training/'?Promise.resolve({actor:{common:true,capabilities:{edit:true,review:true}},courses:[{id:'v1',course_id:'a',title:'공개 교육',kind:'education',version:1,status:'published',common:true,owned:true,current_version_id:'v1'},{id:'v2',course_id:'b',title:'작성 교육',kind:'education',version:1,status:'draft',common:true,owned:true}],assignments:[],members:[]}):old(path,o);showView('training');});
 await p.locator('.st-card').first().waitFor();await p.locator('#staffTrainingRoot .st-filter-options summary').click();await p.locator('[data-hq-status]').selectOption('draft');assert.equal(await p.locator('.st-card').count(),1);
 await p.getByRole('button',{name:'공개 자료',exact:true}).click();assert.equal(await p.locator('[data-hq-status]').count(),0);assert.match(await p.locator('.st-card').innerText(),/공개 교육/);
 await p.getByRole('button',{name:'공통 교육 관리',exact:true}).click();assert.equal(await p.locator('[data-hq-status]').inputValue(),'draft');assert.match(await p.locator('.st-card').innerText(),/작성 교육/);assert.deepEqual(await p.evaluate(()=>writes),[]);
});
for(const width of [390,1440])test('integrations show readable delivery method and one refresh control '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/integrations/messaging'?Promise.resolve({architecture:'home_then_mms_then_lms',oauth:{connected:2,kakaoRead:1}}):old(path,o);showView('integrations');});
 await p.locator('#msgSchedulingMode').getByText('HOME → 사진 문자 → 장문 문자',{exact:true}).waitFor();assert.equal(await p.locator('#refresh').isVisible(),false);assert.equal(await p.locator('#integrationRefresh').isVisible(),true);
 assert.doesNotMatch(await p.locator('#msgQueueSummary').innerText(),/OAuth|kakao:read/);assert.doesNotMatch(await p.locator('#integrations').innerText(),/D1 저장/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:path.join(process.env.HQ_SCREENSHOTS,'integrations-'+width+'.png'),fullPage:true});
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});
