const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync,mkdirSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const {pathToFileURL}=require('node:url');
const http=require('node:http');
const {chromium}=require('playwright');
const root=resolve(__dirname,'..'),workerFixture=resolve(process.env.TRAINING_WORKER_ROOT||resolve(root,'../onboard-worker'),'test/helpers/training-fixture.mjs');
let browser,server,origin,fixture,supplementProvider,practiceProvider,practiceConfig,practiceReference;
const fixtures=new Map();
const browserTest=existsSync(workerFixture)?test:test.skip;
before(async()=>{
 if(!existsSync(workerFixture))return;
 ({fixture}=await import(pathToFileURL(workerFixture).href));
 ({supplementProvider}=await import(pathToFileURL(resolve(workerFixture,'../supplement-provider.mjs')).href));
 ({practiceProvider,practiceConfig,practiceReference}=await import(pathToFileURL(resolve(workerFixture,'../practice-provider.mjs')).href));
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
   try{const d=await f.api(u.pathname.slice(4)||'/',req.method,body,actor,f.provider||{});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));}catch(e){res.writeHead(e.statusCode||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
  }
  if(!/^[a-zA-Z0-9._-]+\.(js|css|html|woff2)$/.test(name)||!existsSync(resolve(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'})[extname(name)]);res.end(readFileSync(resolve(root,name)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
for(const role of ['staff','hq'])for(const width of [390,1280])browserTest('reading keeps citations optional and sources available '+role+' '+width,async t=>{
 const f=fixture(t),body=f.body();for(const s of body.sections)s.items[0].sourceIds=['guardian','ref1'];
 const sourceTitle='Reference title for education readability and safe staff workflow '.repeat(3).trim();
 const d=await f.create(f.hq,{body,references:[{title:sourceTitle,excerpt:'Synthetic source excerpt for browser testing only. No clinical use.',url:'https://example.org/reference',rightsConfirmed:true}]});await f.publish(d.versionId,f.hq);
 const before=JSON.stringify((await f.doc(d.versionId,f.hq)).document.body),p=await pageFor(t,f,role,width),open=()=>p.getByRole('button',{name:role==='hq'?'자료·검토 열기':'자료 보기',exact:true}).click();await open();
 const toggle=p.getByRole('button',{name:'문장별 근거 보기',exact:true}),citations=p.locator('[data-item-sources]'),sources=p.locator('.st-sources').first();
 await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await citations.count(),3);assert.equal(await citations.first().isVisible(),false);assert.equal(await sources.getAttribute('open'),null);assert.doesNotMatch(await p.locator('.st-reading').innerText(),/Reference title/);
 assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-reading-clean-${role}-${width}.png`),fullPage:true});
 await toggle.focus();await p.keyboard.press('Enter');assert.equal(await p.getByRole('button',{name:'문장별 근거 숨기기',exact:true}).getAttribute('aria-expanded'),'true');assert.equal(await citations.first().isVisible(),true);assert.match(await citations.first().innerText(),/Reference title/);assert.equal(await citations.first().getByRole('link',{name:sourceTitle,exact:true}).getAttribute('href'),'https://example.org/reference');assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await p.getByRole('button',{name:'문장별 근거 숨기기',exact:true}).click();await p.getByText('원본·참고 근거 2개',{exact:true}).click();assert.equal(await sources.getByRole('link',{name:'근거 원문 열기',exact:true}).isVisible(),true);
 if(role==='staff'&&width===1280){const pending=p.waitForEvent('download');await p.getByRole('button',{name:'자료 다운로드',exact:true}).click();const download=await pending,text=readFileSync(await download.path(),'utf8');assert.match(text,/원본·참고 근거/);assert.ok(text.includes(sourceTitle+' https://example.org/reference'));assert.equal(text.split(sourceTitle).length-1,1);}
 await p.getByRole('button',{name:'닫기',exact:true}).click();await open();await p.getByRole('button',{name:'문장별 근거 보기',exact:true}).waitFor();assert.equal(await citations.first().isVisible(),false);assert.deepEqual(await p.evaluate(()=>writes),[]);assert.equal(JSON.stringify((await f.doc(d.versionId,f.hq)).document.body),before);
});
browserTest('clinic management offers assignment and SOP without content creation or AI',async t=>{
 const f=fixture(t);await approved(f,f.hq);const p=await pageFor(t,f);
 await p.getByRole('button',{name:'교육 관리',exact:true}).click();assert.equal(await p.getByRole('button',{name:'교육자료 만들기',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'직원 배정',exact:true}).count(),1);assert.match(await p.locator('[data-content]').innerText(),/HQ에서 제작/);
 await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await p.getByRole('button',{name:'SOP 작성',exact:true}).click();assert.equal(await p.locator('[name=sourceContentId]').count(),0);assert.equal(await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).count(),0);
 await p.getByLabel('SOP 제목').fill('시험 마감 절차');await p.getByRole('button',{name:'수동 초안 만들기',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM staff_training_courses WHERE kind='sop'").get().n,1);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_generation_jobs').get().n,0);
});
for(const width of [390,1280])browserTest('HQ creates an independent practice draft with no guardian source '+width,async t=>{
 const f=fixture(t);f.provider=practiceProvider(f);const p=await pageFor(t,f,'hq',width);await p.getByRole('button',{name:'교육자료 만들기',exact:true}).click();await p.getByLabel('제작 방식',{exact:true}).selectOption('practice');await p.getByLabel('교육 제목·주제',{exact:true}).fill('입원 환자 인수인계');
 assert.equal(await p.locator('[data-source-wrap]').isVisible(),false);assert.equal(await p.getByLabel('대상 직원',{exact:true}).inputValue(),'신입 직원');await p.getByLabel('교육 수준',{exact:true}).selectOption('실무');
 await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).click();assert.match(await p.locator('[data-dialog-status]').innerText(),/사용료 안내/);assert.equal(f.provider.calls.length,0);assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-practice-form-${width}.png`),fullPage:true});
 await p.locator('[name=confirmSend]').check();await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();assert.equal(f.provider.calls.length,2);assert.equal(await p.locator('.st-reading>section').count(),6);assert.match(await p.locator('dialog').innerText(),/업무 체크리스트/);assert.equal(f.sqlite.prepare('SELECT source_content_id FROM staff_training_versions').get().source_content_id,'');
 await p.getByRole('button',{name:'내용 수정',exact:true}).click();assert.equal(await p.locator('[data-section]').count(),6);await p.getByRole('button',{name:'초안 저장',exact:true}).click();await p.getByRole('button',{name:'검토 요청',exact:true}).waitFor();const row=f.sqlite.prepare('SELECT body_json,status FROM staff_training_versions').get();assert.equal(JSON.parse(row.body_json).format,'practice');assert.equal(JSON.parse(row.body_json).config.level,'실무');assert.equal(row.status,'draft');
});
browserTest('published practice and disease courses can be filtered and practice is assignable',async t=>{
 const f=fixture(t);await approved(f,f.hq,'질환 시험 교육');const d=await f.api('/generate-topic','POST',{config:practiceConfig,confirmSend:true,webSearch:false,references:[practiceReference]},f.hq,practiceProvider(f));await f.publish(d.versionId,f.hq);
 const p=await pageFor(t,f);await p.getByLabel('교육 종류',{exact:true}).selectOption('practice');assert.equal(await p.locator('.st-card').count(),1);assert.match(await p.locator('.st-card').innerText(),/입원 환자 인수인계/);await p.getByRole('button',{name:'직원 배정',exact:true}).click();await p.getByLabel('시험 직원',{exact:true}).check();await p.getByRole('button',{name:'선택 직원에게 배정',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_assignments').get().n,1);
 await p.getByLabel('교육 종류',{exact:true}).selectOption('disease');assert.equal(await p.locator('.st-card').count(),1);assert.match(await p.locator('.st-card').innerText(),/질환 시험 교육/);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_generation_jobs').get().n,1);
});
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
browserTest('source picker searches and filters the complete 68-item library without an AI call',async t=>{
 const f=fixture(t);for(let i=1;i<46;i++){const id='central-'+i;f.sqlite.prepare('INSERT INTO master_content_documents VALUES(?,?,?,?)').run(id,JSON.stringify(f.central),'1','published');f.sqlite.prepare('INSERT INTO master_content_registry VALUES(?,?,?,?)').run(id,'중앙 자료 '+i,'시험','published');}
 const p=await pageFor(t,f,'hq');await p.getByRole('button',{name:'교육자료 만들기',exact:true}).click();await p.locator('[name=sourceContentId] option[value="builtin:cruciate"]').waitFor({state:'attached'});
 assert.equal(await p.locator('[name=sourceContentId] option').count(),69);assert.match(await p.locator('[data-source-count]').innerText(),/전체 68개 · 기본 자료 22개 · 중앙 게시 자료 46개/);
 await p.getByLabel('원본 검색',{exact:true}).fill('전십자인대 수술');assert.equal(await p.locator('[name=sourceContentId] option').count(),2);await p.getByLabel('교육 원본',{exact:true}).selectOption('builtin:cruciate');assert.equal(await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).isEnabled(),true);
 await p.getByLabel('원본 출처',{exact:true}).selectOption('central');assert.equal(await p.getByLabel('교육 원본',{exact:true}).inputValue(),'');assert.equal(await p.getByRole('button',{name:'AI 교육 초안 생성',exact:true}).isEnabled(),false);assert.match(await p.locator('[data-source-count]').innerText(),/현재 조건 0개/);
 await p.getByRole('button',{name:'검색·필터 초기화',exact:true}).click();assert.equal(await p.locator('[name=sourceContentId] option').count(),69);await p.getByLabel('원본 출처',{exact:true}).selectOption('central');assert.equal(await p.locator('[name=sourceContentId] option').count(),47);assert.deepEqual(await p.evaluate(()=>writes),[]);
});
browserTest('built-in manual creation keeps its source type and remains a reviewable draft',async t=>{
 const f=fixture(t),p=await pageFor(t,f,'hq');await p.getByRole('button',{name:'교육자료 만들기',exact:true}).click();await p.getByLabel('교육 원본',{exact:true}).selectOption('builtin:kidney');await p.getByRole('button',{name:'수동 초안 만들기',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();
 await p.getByText('원본·참고 근거 1개',{exact:true}).click();assert.match(await p.locator('.st-sources').first().innerText(),/기본 자료 · 원본 기준/);assert.equal(f.sqlite.prepare('SELECT status FROM staff_training_versions').get().status,'draft');assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_generation_jobs').get().n,0);
});
for(const width of [390,1280])browserTest('source picker remains readable without horizontal overflow '+width,async t=>{
 const f=fixture(t),p=await pageFor(t,f,'hq',width);await p.getByRole('button',{name:'교육자료 만들기',exact:true}).click();await p.locator('[data-source-count]').waitFor();await p.getByLabel('원본 출처',{exact:true}).selectOption('builtin');await p.getByLabel('교육 원본',{exact:true}).selectOption('builtin:pancreatitis');
 assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok(await p.getByLabel('교육 원본',{exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-source-picker-${width}.png`),fullPage:true});
});
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
 const f=fixture(t),p=await pageFor(t,f,'hq');
 
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
 await p.getByLabel('검토 의료진 이름').fill('시험 검토자');await p.getByRole('button',{name:'승인하고 공개',exact:true}).click();
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
 const f=fixture(t),d=await f.create(f.hq,{title:'<img src=x onerror=alert(1)>'}),p=await pageFor(t,f,'hq');
 await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();
 assert.equal(await p.locator('dialog img').count(),0);
 await p.getByRole('button',{name:'내용 수정',exact:true}).click();await p.locator('[data-items]').first().fill('수정 내용');
 p.once('dialog',d=>d.dismiss());await p.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await p.locator('dialog').isVisible(),true);
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await p.locator('dialog').count(),0);assert.equal((await f.doc(d.versionId,f.hq)).document.revision,1);
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
  saasMode='auth';saasSessionMeta={id:'synthetic-session'};saasMe={role:'staff',clinic:{id:'synthetic'},user:{id:'staff'},permissions:{mode:'custom',keys:['training.read']}};
  saasRequest=async()=>({ok:true,actor:{userId:'staff',capabilities:{read:true}},courses:[],assignments:[],members:[],limits:{}});
  showApp();go('training');
 });
 await p.locator('#training .st-tabs').waitFor();
 assert.equal(await p.locator('#viewTitle').innerText(),'직원 교육센터');
 assert.equal(await p.locator('#training').evaluate(e=>e.classList.contains('active-view')),true);
 await p.locator('#r61-patient-context').waitFor({state:'attached'});
 assert.equal(await p.locator('#r61-patient-context').isVisible(),false);
 await p.locator('#clinicSyncStatus').waitFor({state:'attached'});
 assert.equal(await p.locator('#clinicSyncStatus').isVisible(),false);
 await p.evaluate(()=>{document.getElementById('clinicSyncStatus').dataset.state='error';});
 assert.equal(await p.locator('#clinicSyncStatus').isVisible(),true);
 await p.evaluate(()=>{document.getElementById('clinicSyncStatus').dataset.state='idle';saasMe.permissions={mode:'default'};saasMe.role='owner';go('patients');});
 assert.equal(await p.locator('#r61-patient-context').isVisible(),true);
 assert.equal(await p.locator('#clinicSyncStatus').isVisible(),true);
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
async function supplementationPage(t,width=1280){
 const f=fixture(t),d=await f.create(f.hq,{title:'직원 교육 보완 · 화면 검증용',body:{...f.body(),gaps:['병태생리·관찰 기준을 확인해주세요.','병원 보고 절차를 확인해주세요.']}});f.provider=supplementProvider(f);
 const p=await pageFor(t,f,'hq',width);await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'부족한 내용 AI 보완',exact:true}).click();return {f,d,p};
}
async function generateSupplement(p){await p.locator('[name=confirmSend]').check();await p.getByRole('button',{name:'AI 보완 초안 작성',exact:true}).click();await p.getByRole('heading',{name:'AI 보완안 비교·반영',exact:true}).waitFor();}
browserTest('supplement generation requires acknowledgement and survives reload without changing the course',async t=>{
 const {f,d,p}=await supplementationPage(t);await p.getByRole('button',{name:'AI 보완 초안 작성',exact:true}).click();assert.match(await p.locator('[data-dialog-status]').innerText(),/사용료 안내/);assert.equal(f.provider.calls.length,0);await generateSupplement(p);assert.equal(f.provider.calls.length,2);assert.equal((await f.doc(d.versionId,f.hq)).document.revision,1);assert.equal(await p.locator('[name=item]:checked').count(),0);
 await p.reload();await p.locator('.st-tabs').waitFor();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'보완안 열기',exact:true}).click();await p.locator('[data-supplement-apply]').waitFor();assert.equal(f.provider.calls.length,2);
});
for(const width of [390,1280])browserTest('supplement comparison and explicit selective apply '+width,async t=>{
 const {f,d,p}=await supplementationPage(t,width);await generateSupplement(p);assert.equal(await p.locator('[name=replaceQuiz]').isEnabled(),false);await p.locator('[name=item]').first().check();assert.equal(await p.locator('[name=resolvedGap]').first().isEnabled(),false);assert.equal(await p.locator('[name=replaceQuiz]').isEnabled(),false);
 await p.getByRole('button',{name:'추가 내용 전체 선택',exact:true}).click();assert.equal(await p.locator('[name=resolvedGap]').first().isEnabled(),true);await p.locator('[name=resolvedGap]').first().check();await p.locator('[name=replaceQuiz]').check();await p.locator('[name=confirmReviewed]').check();
 assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok(await p.locator('.st-compare').first().evaluate(e=>e.scrollWidth<=e.clientWidth+1));mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-supplement-${width}.png`),fullPage:true});
 await p.getByRole('button',{name:'선택한 내용 초안에 반영',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();const doc=(await f.doc(d.versionId,f.hq)).document;assert.equal(doc.revision,2);assert.equal(doc.status,'draft');assert.equal(doc.body.sections[0].items[0].text,'시험 원본의 확인 내용');assert.equal(doc.body.sections[0].items.length,2);assert.match(doc.body.quiz[0].question,/보완된/);assert.deepEqual([...doc.body.gaps],['병원 보고 절차를 확인해주세요.']);
});
browserTest('partial supplementation preserves questions and review gaps',async t=>{const {f,d,p}=await supplementationPage(t);await generateSupplement(p);await p.locator('[name=item]').first().check();await p.locator('[name=confirmReviewed]').check();await p.getByRole('button',{name:'선택한 내용 초안에 반영',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();const doc=(await f.doc(d.versionId,f.hq)).document;assert.equal(doc.body.gaps.length,2);assert.equal(doc.body.quiz[0].question,'시험 문항 0');assert.equal(doc.body.sections[1].items.length,1);});
browserTest('stale supplement remains readable but has no apply controls',async t=>{const {f,d,p}=await supplementationPage(t);await generateSupplement(p);await f.api('/versions/'+d.versionId,'PUT',{revision:1,body:f.body()},f.hq);await p.getByRole('button',{name:'기존 자료로 돌아가기',exact:true}).click();await p.getByRole('button',{name:'보완안 열기',exact:true}).click();await p.getByRole('heading',{name:'AI 보완안 비교·반영',exact:true}).waitFor();assert.match(await p.locator('dialog').innerText(),/기존 자료가 변경/);assert.equal(await p.getByRole('button',{name:'선택한 내용 초안에 반영',exact:true}).count(),0);});
browserTest('failed supplement is visible in history without claiming an empty or completed result',async t=>{const {f,p}=await supplementationPage(t);f.provider=supplementProvider(f,{fail:true});await p.locator('[name=confirmSend]').check();await p.getByRole('button',{name:'AI 보완 초안 작성',exact:true}).click();await p.getByRole('dialog').getByText('AI 요청을 완료하지 못했습니다. 모델의 검색 지원과 연결 상태를 확인해주세요. 자동 재요청하지 않습니다.',{exact:true}).waitFor();await p.reload();await p.locator('.st-tabs').waitFor();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'보완안 열기',exact:true}).click();await p.getByRole('heading',{name:'AI 보완안 비교·반영',exact:true}).waitFor();assert.match(await p.locator('dialog').innerText(),/생성 미완료/);assert.equal(f.provider.calls.length,1);});
browserTest('clearing a session closes private documents and discards pending results',async t=>{
 const f=fixture(t);await approved(f);const p=await pageFor(t,f,'staff');
 await p.getByRole('button',{name:'자료 보기',exact:true}).click();await p.locator('dialog').waitFor();assert.equal(await p.locator('dialog').count(),1);
 await p.evaluate(()=>{syntheticIdentity='session-b';app.clear();});
 assert.equal(await p.locator('dialog').count(),0);
 await p.evaluate(async()=>{slow=true;const pending=app.open();syntheticIdentity='session-c';app.clear();await pending;});
 assert.equal(await p.locator('.st-card').count(),0);
});
browserTest('failed composition can reuse evidence with new acknowledgement and no repeated search',async t=>{
 const {f,d,p}=await supplementationPage(t);f.provider=supplementProvider(f,{mutate:r=>r.items=[]});await p.locator('[name=confirmSend]').check();await p.getByRole('button',{name:'AI 보완 초안 작성',exact:true}).click();await p.getByRole('dialog').getByText(/AI가 추가할 보완 내용을 제안하지 않았습니다/).waitFor();
 await p.reload();await p.locator('.st-tabs').waitFor();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'보완안 열기',exact:true}).click();await p.getByRole('button',{name:'저장된 근거로 다시 작성',exact:true}).click();
 assert.equal(await p.locator('[name=webSearch]').isChecked(),false);assert.equal(await p.locator('[name=webSearch]').isEnabled(),false);assert.equal(await p.locator('[name=confirmSend]').isChecked(),false);f.provider=supplementProvider(f);await generateSupplement(p);assert.equal(f.provider.calls.length,1);assert.equal(f.provider.calls[0].tools,undefined);assert.equal((await f.doc(d.versionId,f.hq)).document.revision,1);
});
