const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync,mkdirSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const {pathToFileURL}=require('node:url');
const http=require('node:http');
const {chromium}=require('playwright');
const root=resolve(__dirname,'..'),workerFixture=resolve(process.env.TRAINING_WORKER_ROOT||resolve(root,'../onboard-worker'),'test/helpers/training-fixture.mjs');
let browser,server,origin,fixture;
const fixtures=new Map();
const browserTest=existsSync(workerFixture)?test:test.skip;
before(async()=>{
 if(!existsSync(workerFixture))return;
 ({fixture}=await import(pathToFileURL(workerFixture).href));
 browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
 server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost'),name=u.pathname.slice(1),f=fixtures.get(u.searchParams.get('test'));
  if(name==='fixture'){
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/staff-training.css"><style>body{margin:0;background:#f3f6fb;font-family:Arial,sans-serif}main{max-width:1250px;margin:auto;padding:24px}@media(max-width:600px){main{padding:16px}}</style><main id="root"></main><script src="/staff-training.js"></script><script>
const params=new URLSearchParams(location.search);window.writes=[];window.failLoad=false;window.slow=false;window.syntheticIdentity='session-a';
window.app=StaffTraining.mount(document.getElementById('root'),{common:params.get('role')==='hq',identity:()=>syntheticIdentity,request:async(p,o={})=>{
 if(failLoad&&p==='/')throw Error('시험 연결 오류');
 if(slow&&p==='/')await new Promise(r=>setTimeout(r,500));
 if(o.method&&o.method!=='GET')writes.push(p);
 const r=await fetch('/api'+p+'?test='+params.get('test')+'&role='+params.get('role'),o),d=await r.json();if(!r.ok)throw Error(d.error);return d;
}});app.open();</script></html>`);return;
  }
  if(name.startsWith('api')){
   if(!f){res.writeHead(404);res.end();return;}
   const role=u.searchParams.get('role')||'owner',actor=f[role]||f.owner,chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):null;
   try{const d=await f.api(u.pathname.slice(4)||'/',req.method,body,actor);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));}catch(e){res.writeHead(e.statusCode||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
  }
  if(!/^[a-zA-Z0-9._-]+\.(js|css|html|woff2)$/.test(name)||!existsSync(resolve(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'})[extname(name)]);res.end(readFileSync(resolve(root,name)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function pageFor(t,f,role='owner',width=1280){
 const id=Math.random().toString(36).slice(2);fixtures.set(id,f);t.after(()=>fixtures.delete(id));
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});
 await page.goto(origin+'/fixture?test='+id+'&role='+role);
 await page.locator('.st-tabs').waitFor();
 return page;
}
async function approved(f,actor=f.owner,title='시험 직원 교육'){const d=await f.create(actor,{title});await f.publish(d.versionId,actor);return d;}
browserTest('library and my courses do not call AI or show drafts',async t=>{
 const f=fixture(t);await f.create();await approved(f,f.hq);const p=await pageFor(t,f,'staff');
 assert.equal(await p.locator('.st-card').count(),1);
 await p.getByRole('button',{name:'내 교육',exact:true}).click();
 assert.match(await p.locator('[data-list]').innerText(),/아직 배정된 교육이 없습니다/);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
 assert.equal(await p.getByRole('button',{name:'교육 관리',exact:true}).count(),0);
});
browserTest('real browser self-enrollment, assessment and completion persist on reload',async t=>{
 const f=fixture(t);await approved(f);const p=await pageFor(t,f,'staff',390);
 await p.getByRole('button',{name:'자료 보기',exact:true}).click();
 await p.getByRole('button',{name:'내 교육으로 시작',exact:true}).click();
 await p.locator('[data-quiz]').waitFor();
 for(let i=0;i<5;i++)await p.locator(`[name="answer${i}"][value="0"]`).check();
 await p.locator('[name=confirmRead]').check();
 await p.getByRole('button',{name:'답안 제출',exact:true}).click();
 await p.getByRole('heading',{name:'100점 · 이수 완료'}).waitFor();
 await p.getByRole('button',{name:'닫기',exact:true}).click();
 await p.reload();await p.locator('.st-tabs').waitFor();await p.getByRole('button',{name:'내 교육',exact:true}).click();
 assert.match(await p.locator('[data-list]').innerText(),/이수 완료/);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_attempts').get().n,1);
});
browserTest('five-question editor, review and explicit approval publish a manual draft',async t=>{
 const f=fixture(t),p=await pageFor(t,f);
 await p.getByRole('button',{name:'교육 관리',exact:true}).click();
 await p.getByRole('button',{name:'교육자료 만들기',exact:true}).click();
 await p.locator('[name=sourceContentId]').selectOption('source');
 await p.locator('[name=title]').fill('직접 작성한 시험 교육');
 await p.getByRole('button',{name:'수동 초안 만들기',exact:true}).click();
 await p.getByRole('button',{name:'내용 수정',exact:true}).click();
 for(const key of ['clinical','nursing','counseling']){
  const section=p.locator('[data-section='+key+']');await section.locator('[data-items]').fill('시험 원본에서 확인한 업무 내용입니다.');
  await section.locator('input[type=checkbox]').check();
 }
 for(let i=0;i<5;i++){
  const q=p.locator('[data-question]').nth(i);await q.locator('[data-question-text]').fill('시험 질문 '+(i+1));
  for(let j=0;j<4;j++)await q.locator('[data-option]').nth(j).fill('선택 '+(j+1));
  await q.locator('[data-explanation]').fill('시험 원본에서 확인했습니다.');await q.locator('input[type=checkbox]').check();
 }
 await p.locator('[data-gaps]').fill('');
 await p.getByRole('button',{name:'초안 저장',exact:true}).click();
 await p.getByRole('button',{name:'검토 요청',exact:true}).click();
 await p.getByRole('button',{name:'검토 후 승인',exact:true}).click();
 for(const key of ['clinical','evidence','privacy','rights'])await p.locator('[data-approve] [name='+key+']').check();
 await p.getByRole('button',{name:'승인하고 공개',exact:true}).click();
 await p.getByRole('button',{name:'공개 중단',exact:true}).waitFor();
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM staff_training_versions WHERE status='published'").get().n,1);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_generation_jobs').get().n,0);
});
browserTest('assignment dialog identifies staff and updates completion management',async t=>{
 const f=fixture(t);await approved(f);const p=await pageFor(t,f);
 await p.getByRole('button',{name:'직원 배정',exact:true}).click();
 await p.getByLabel('시험 직원',{exact:true}).check();
 await p.locator('[name=dueDate]').fill('2026-12-01');
 await p.getByRole('button',{name:'선택 직원에게 배정',exact:true}).click();
 await p.getByRole('button',{name:'교육 관리',exact:true}).click();
 await p.locator('[data-report] table').waitFor();
 assert.match(await p.locator('[data-report]').innerText(),/시험 직원/);
 assert.match(await p.locator('[data-report]').innerText(),/2026-12-01/);
});
browserTest('SOP entry disables AI and requires an explicit title',async t=>{
 const f=fixture(t),p=await pageFor(t,f);
 await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await p.getByRole('button',{name:'SOP 작성',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).isVisible(),false);
 await p.getByRole('button',{name:'수동 초안 만들기',exact:true}).click();
 assert.match(await p.locator('[data-dialog-status]').innerText(),/SOP 제목/);
});
browserTest('failed load is not rendered as an empty library and can recover',async t=>{
 const f=fixture(t),p=await pageFor(t,f);await p.evaluate(()=>{failLoad=true;app.open();});
 await p.getByRole('button',{name:'다시 불러오기',exact:true}).waitFor();
 assert.match(await p.locator('[data-status]').innerText(),/시험 연결 오류/);
 await p.evaluate(()=>failLoad=false);await p.getByRole('button',{name:'다시 불러오기',exact:true}).click();await p.locator('.st-tabs').waitFor();
});
browserTest('dialog escapes content and confirms loss of unsaved edits',async t=>{
 const f=fixture(t),d=await f.create(f.owner,{title:'<img src=x onerror=alert(1)>'}),p=await pageFor(t,f);
 await p.getByRole('button',{name:'교육 관리',exact:true}).click();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();
 assert.equal(await p.locator('dialog img').count(),0);
 await p.getByRole('button',{name:'내용 수정',exact:true}).click();await p.locator('[data-items]').first().fill('수정 내용');
 p.once('dialog',d=>d.dismiss());await p.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await p.locator('dialog').isVisible(),true);
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await p.locator('dialog').count(),0);assert.equal((await f.doc(d.versionId)).document.revision,1);
});
for(const width of [390,1280])browserTest('responsive reading and library layout '+width,async t=>{
 const f=fixture(t);await approved(f,f.hq,'수술 후 관찰·보고 교육 · 화면 검증용');await approved(f,f.owner,'보호자 상담 교육 · 화면 검증용');const p=await pageFor(t,f,'staff',width);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-library-${width}.png`),fullPage:true});
 await p.getByRole('button',{name:'자료 보기',exact:true}).first().click();
 assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 assert.ok(await p.locator('.st-reading').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
 await p.screenshot({path:resolve(root,`../outputs/training-reading-${width}.png`),fullPage:true});
});
browserTest('HQ approval requires reviewer identity and exposes common scope',async t=>{
 const f=fixture(t),d=await f.create(f.hq);await f.api('/versions/'+d.versionId+'/review','POST',{revision:1},f.hq);const p=await pageFor(t,f,'hq');
 await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'검토 후 승인',exact:true}).click();
 assert.match(await p.locator('dialog').innerText(),/모든 병원/);
 await p.getByLabel('검토 의료진 이름').fill('시험 수의사');
 for(const key of ['clinical','evidence','privacy','rights'])await p.locator('[data-approve] [name='+key+']').check();
 await p.getByRole('button',{name:'승인하고 공개',exact:true}).click();await p.getByRole('button',{name:'공개 중단',exact:true}).waitFor();
 const doc=await f.doc(d.versionId,f.hq);assert.ok(doc.document.audit.some(x=>x.detail.reviewerName==='시험 수의사'));
});
browserTest('real CLINIC document loads training module and navigates without a patient',async t=>{
 const context=await browser.newContext();t.after(()=>context.close());await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const p=await context.newPage();await p.goto(origin+'/index.html');
 await p.evaluate(()=>{
  saasMode='auth';saasMe={role:'staff',clinic:{id:'synthetic'},user:{id:'staff'},permissions:{mode:'custom',keys:['training.read']}};
  saasRequest=async()=>({ok:true,actor:{userId:'staff',capabilities:{read:true}},courses:[],assignments:[],members:[],limits:{}});
  showApp();go('training');
 });
 await p.locator('#training .st-tabs').waitFor();
 assert.equal(await p.locator('#viewTitle').innerText(),'직원 교육센터');
 assert.equal(await p.locator('#training').evaluate(e=>e.classList.contains('active-view')),true);
});
browserTest('real HQ navigation loads the education center through the current router',async t=>{
 const context=await browser.newContext();t.after(()=>context.close());await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const p=await context.newPage();await p.goto(origin+'/hq.html');
 await p.evaluate(()=>{
  document.getElementById('loginOverlay').classList.add('hidden');
  hqSessionToken=()=> 'synthetic';
  req=async()=>({ok:true,actor:{common:true,capabilities:{read:true,edit:true,review:true,manage:true}},courses:[],assignments:[],members:[],limits:{}});
 });
 await p.locator('[data-hq-nav-toggle=content]').click();
 await p.locator('#nav [data-view=training]').click();await p.locator('#training .st-tabs').waitFor();
 assert.match(await p.locator('#training').innerText(),/직원 공통 교육 관리/);
});
browserTest('clearing a session closes private documents and discards pending results',async t=>{
 const f=fixture(t);await approved(f);const p=await pageFor(t,f,'staff');
 await p.getByRole('button',{name:'자료 보기',exact:true}).click();await p.locator('dialog').waitFor();assert.equal(await p.locator('dialog').count(),1);
 await p.evaluate(()=>{syntheticIdentity='session-b';app.clear();});
 assert.equal(await p.locator('dialog').count(),0);
 await p.evaluate(async()=>{slow=true;const pending=app.open();syntheticIdentity='session-c';app.clear();await pending;});
 assert.equal(await p.locator('.st-card').count(),0);
});
