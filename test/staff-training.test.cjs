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
async function stopPublication(f,id,actor=f.owner){return f.api('/versions/'+id+'/withdraw','POST',{revision:(await f.doc(id,actor)).document.revision},actor);}
for(const width of [390,1280])browserTest('withdrawn SOP can be republished explicitly from the card without changing version or history '+width,async t=>{
 const f=fixture(t),d=await localSop(f,'01. 진료 시작·마감 점검');await f.publish(d.versionId);const aid=await f.enroll(d.versionId);await f.attempt(aid,[]);await f.enroll(d.versionId,f.owner);await stopPublication(f,d.versionId);
 const history=f.sqlite.prepare('SELECT * FROM staff_training_attempts').all(),body=(await f.doc(d.versionId)).document.body,p=await pageFor(t,f,'owner',width);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'다시 공개',exact:true,includeHidden:true}).count(),1);await versionAction(p,'다시 공개');await p.getByRole('heading',{name:'기존 버전 다시 공개',exact:true}).waitFor();
 assert.match(await p.getByRole('dialog').innerText(),/새 수정본은 만들지 않으며/);assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).click();assert.deepEqual(await p.evaluate(()=>writes),[]);await p.getByRole('button',{name:'닫기',exact:true}).click();assert.equal((await f.doc(d.versionId)).document.status,'withdrawn');
 await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'다시 공개',exact:true}).click();
 for(const key of ['clinical','evidence','privacy','rights'])await p.locator('[data-approve] [name='+key+']').check();
 mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-republish-${width}.png`),fullPage:true});
 await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).click();await p.getByRole('button',{name:'공개 중단',exact:true}).waitFor();
 assert.equal((await f.doc(d.versionId)).document.current,true);assert.equal((await f.doc(d.versionId)).document.version,1);assert.deepEqual((await f.doc(d.versionId)).document.body,body);assert.deepEqual(f.sqlite.prepare('SELECT * FROM staff_training_attempts').all(),history);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_versions').get().n,1);assert.equal((await p.evaluate(()=>writes.filter(x=>x.endsWith('/republish')))).length,1);
 await p.getByRole('button',{name:'닫기',exact:true}).click();assert.match(await p.locator('.st-card').innerText(),/승인됨 · v1/);await p.reload();await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.equal(await p.getByRole('button',{name:'다시 공개',exact:true,includeHidden:true}).count(),0);
});
browserTest('republish is hidden from learners and edit-only staff, and HQ requires reviewer name',async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);await stopPublication(f,d.versionId);f.editor={...f.staff,permissions:{mode:'custom',keys:['training.read','training.edit']}};
 for(const role of ['staff','editor']){const p=await pageFor(t,f,role);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.equal(await p.getByRole('button',{name:'다시 공개',exact:true,includeHidden:true}).count(),0);if(role==='editor'){await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();assert.equal(await p.getByRole('button',{name:'다시 공개',exact:true,includeHidden:true}).count(),0);}}
 const common=await approved(f,f.hq);await stopPublication(f,common.versionId,f.hq);const p=await pageFor(t,f,'hq');await versionAction(p,'다시 공개');for(const key of ['clinical','evidence','privacy','rights'])await p.locator('[data-approve] [name='+key+']').check();await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).click();assert.deepEqual(await p.evaluate(()=>writes),[]);
 await p.getByLabel('검토 의료진 이름').fill('시험 수의사');await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).click();await p.getByRole('button',{name:'공개 중단',exact:true}).waitFor();assert.ok((await f.doc(common.versionId,f.hq)).document.audit.some(x=>x.action==='republish'&&x.detail.reviewerName==='시험 수의사'));
});
browserTest('republish conflict and stale confirmation leave the original withdrawn',async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);await stopPublication(f,d.versionId);const v2=await f.api('/versions/'+d.versionId+'/revise','POST',{revision:(await f.doc(d.versionId)).document.revision});await f.publish(v2.versionId);const p=await pageFor(t,f);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await versionAction(p,'다시 공개');await p.locator('[data-dialog-status]').getByText('다른 버전이 공개 중입니다. 현재 공개 버전을 먼저 확인해주세요.',{exact:true}).waitFor();assert.equal(await p.locator('[data-approve]').count(),0);assert.deepEqual(await p.evaluate(()=>writes),[]);
 await stopPublication(f,v2.versionId);await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('button',{name:'새로고침',exact:true}).click();await versionAction(p,'다시 공개',d.versionId);
 for(const key of ['clinical','evidence','privacy','rights'])await p.locator('[data-approve] [name='+key+']').check();f.sqlite.prepare('UPDATE staff_training_versions SET revision=revision+1 WHERE id=?').run(d.versionId);await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).click();await p.locator('[data-dialog-status]').getByText('자료가 변경되었습니다. 새로고침해주세요.',{exact:true}).waitFor();assert.equal((await f.doc(d.versionId)).document.status,'withdrawn');assert.equal(await p.getByRole('button',{name:'확인 후 다시 공개',exact:true}).isEnabled(),true);
});
browserTest('SOP version delete keeps its published sibling visible and version trash restores only the selected draft',async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);const doc=(await f.doc(d.versionId)).document,v2=await f.api('/versions/'+d.versionId+'/revise','POST',{revision:doc.revision});
 const p=await pageFor(t,f);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();
 await versionAction(p,'버전 삭제',v2.versionId);assert.match(await p.getByRole('dialog').innerText(),/v2만 삭제/);assert.match(await p.getByRole('dialog').innerText(),/다른 버전 1개/);
 await p.locator('[name=confirm]').check();await p.getByRole('button',{name:'삭제 확정',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await p.locator('.st-card').count(),1);assert.match(await p.locator('.st-card').innerText(),/승인됨 · v1/);assert.equal((await f.doc(d.versionId)).document.current,true);
 await p.getByRole('button',{name:'삭제한 자료',exact:true}).click();assert.match(await p.locator('.st-card').innerText(),/v2 버전/);await p.getByRole('button',{name:'복원',exact:true}).click();await p.locator('[name=confirm]').check();await p.getByRole('button',{name:'버전 복원',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal((await f.doc(v2.versionId)).document.status,'draft');assert.equal((await f.doc(d.versionId)).document.current,true);assert.ok((await p.evaluate(()=>writes)).every(x=>x.includes('/versions/')));
});
for(const kind of ['disease','practice','sop'])browserTest('real Korean PDF download, safe assessment handling and complete pagination '+kind,async t=>{
 const f=fixture(t),body=f.body(),actor=kind==='sop'?f.owner:f.hq;
 if(kind==='practice'){body.format='practice';body.config={topic:'시험 업무 흐름',audience:'신입 직원',level:'기초'};body.sections=['objectives','knowledge','workflow','checklist','reporting','scenarios'].map(key=>({key,items:[]}));}
 for(const section of body.sections)section.items=Array.from({length:kind==='disease'?9:2},(_,i)=>({text:`${i+1}. 한글 줄바꿈과 페이지 나눔을 검증하는 시험 내용입니다. `+'직원은 담당자에게 관찰 내용을 정확하게 보고합니다. '.repeat(8)+'\n다음 줄의 내용도 빠짐없이 표시합니다.',sourceIds:kind==='sop'?[]:['guardian']}));
 if(kind==='sop')body.quiz=[];else for(const q of body.quiz)q.explanation='INTERNAL ANSWER SECRET';
 const d=kind==='practice'?await f.c.trainingSaveNew(f.DB,actor,{kind:'education',title:'한글 교육자료 '+kind,body,sources:[await f.c.trainingSource(f.DB,'source')]}):await f.create(actor,{kind:kind==='sop'?'sop':'education',title:'한글 교육자료 '+kind,body});
 const p=await pageFor(t,f,kind==='sop'?'owner':'hq',390),external=[],debug=[];p.on('request',r=>{debug.push(r.url());if(!r.url().startsWith(origin))external.push(r.url());});p.on('pageerror',e=>debug.push(e.message));
 if(kind==='sop')await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();
 await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();const before=(await f.doc(d.versionId,actor)).document;
 const event=p.waitForEvent('download');await p.getByRole('button',{name:'PDF 다운로드',exact:true}).click();const download=await event.catch(async e=>{throw Error(await p.locator('[data-dialog-status]').innerText()+' / '+JSON.stringify(debug)+' / '+e.message);});assert.match(download.suggestedFilename(),/_v1\.pdf$/);
 const dest=resolve(root,'../../tmp/pdfs/training-'+kind+'.pdf');mkdirSync(resolve(root,'../../tmp/pdfs'),{recursive:true});await download.saveAs(dest);const buffer=readFileSync(dest);assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href),pdf=await pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:false}).promise;let text='';
 assert.ok(pdf.numPages>=2);for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();text+=content.items.map(x=>x.str).join('\n');for(const item of content.items){assert.ok(item.transform[4]>=44);assert.ok(item.transform[5]>=23);assert.ok(item.transform[4]+item.width<554,item.str);}}
 assert.match(text,/한글 교육자료/);assert.match(text,/다음 줄의 내용도/);assert.match(text,/작성 중/);if(before.sources.length)assert.match(text,/원본·참고 근거/);assert.doesNotMatch(text,/INTERNAL ANSWER SECRET|정답:|시험 문항/);
 assert.deepEqual(external,[]);assert.deepEqual(await p.evaluate(()=>writes),[]);assert.deepEqual((await f.doc(d.versionId,actor)).document,before);await pdf.destroy();
});
browserTest('PDF font download failure is visible and retry succeeds without a text fallback',async t=>{
 const f=fixture(t);await localSop(f);const p=await pageFor(t,f);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();
 await p.route('**/pretendard-regular-1.3.9.ttf',r=>r.fulfill({status:503,body:'Unavailable'}));await p.getByRole('button',{name:'PDF 다운로드',exact:true}).click();await p.locator('[data-dialog-status]').getByText('PDF 한글 글꼴을 불러오지 못했습니다. 연결을 확인하고 다시 다운로드해주세요.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'PDF 다운로드',exact:true}).isEnabled(),true);await p.unroute('**/pretendard-regular-1.3.9.ttf');const event=p.waitForEvent('download');await p.getByRole('button',{name:'PDF 다운로드',exact:true}).click();assert.match((await event).suggestedFilename(),/\.pdf$/);
});
async function localSop(f,title='출근 준비와 업무 인수인계'){
 const body=f.body();for(const s of body.sections)for(const i of s.items)i.sourceIds=[];body.quiz=[];
 return f.create(f.owner,{kind:'sop',title,category:'원내 업무',body});
}
async function courseLifecycle(f,d,action,actor=f.owner){const i=await f.api('/courses/'+d.courseId+'/impact','GET',undefined,actor);return f.api('/courses/'+d.courseId+'/'+action,'POST',{revisionToken:i.revisionToken,confirm:true,confirmAllVersions:true},actor);}
for(const width of [390,1280])browserTest('SOP delete confirmation, cancellation, trash and restore '+width,async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);const aid=await f.enroll(d.versionId);await f.attempt(aid,[]);
 const p=await pageFor(t,f,'owner',width);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await versionAction(p,'버전 삭제');
 const dialog=p.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.innerText(),/선택한 버전\s+v1/);assert.match(await dialog.innerText(),/이수 완료\s+1건/);assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await p.getByRole('button',{name:'삭제 확정',exact:true}).click();assert.deepEqual(await p.evaluate(()=>writes),[]);
 mkdirSync(resolve(root,'../outputs'),{recursive:true});await p.screenshot({path:resolve(root,`../outputs/training-delete-confirm-${width}.png`),fullPage:true});
 await p.getByRole('button',{name:'취소',exact:true}).focus();await p.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});assert.equal(await p.locator('.st-card').count(),1);
 await versionAction(p,'버전 삭제');await p.locator('[data-lifecycle] [name=confirm]').check();await p.getByRole('button',{name:'삭제 확정',exact:true}).click();await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.querySelectorAll('.st-card').length===0);assert.equal(await p.locator('.st-card').count(),0);
 await p.getByRole('button',{name:'삭제한 자료',exact:true}).click();assert.equal(await p.locator('.st-card').count(),1);await p.getByRole('button',{name:'복원',exact:true}).click();await p.locator('[data-lifecycle] [name=confirm]').check();await p.getByRole('button',{name:'버전 복원',exact:true}).click();await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.querySelectorAll('.st-card').length===0);assert.equal(await p.locator('.st-card').count(),0);
 await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.match(await p.locator('.st-card').innerText(),/공개 중단/);assert.equal((await f.doc(d.versionId)).document.status,'withdrawn');assert.equal(f.sqlite.prepare('SELECT score FROM staff_training_assignments').get().score,100);
 assert.equal((await p.evaluate(()=>writes)).filter(x=>x.endsWith('/delete')).length,1);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth));
});
browserTest('published SOP edit creates draft, keeps approved material and reopens an existing draft',async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);f.editor={...f.staff,permissions:{mode:'custom',keys:['training.read','training.edit']}};
 const p=await pageFor(t,f,'editor');await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.equal(await p.getByRole('button',{name:'버전 삭제',exact:true}).count(),0);await p.getByRole('button',{name:'수정본 작성',exact:true}).click();await p.getByRole('button',{name:'수정본 만들고 편집',exact:true}).click();await p.locator('[data-editor]').waitFor();
 await p.locator('[data-items]').first().fill('담당자의 업무 인계 내용을 확인합니다.');await p.getByRole('button',{name:'초안 저장',exact:true}).click();await p.getByRole('button',{name:'내용 수정',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'검토 후 승인',exact:true}).count(),0);
 const versions=f.sqlite.prepare('SELECT id,status,body_json FROM staff_training_versions ORDER BY version').all();assert.equal(versions.length,2);assert.equal(versions[0].status,'published');assert.equal(versions[1].status,'draft');assert.match(versions[1].body_json,/업무 인계/);assert.doesNotMatch(versions[0].body_json,/업무 인계/);
 await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('button',{name:'수정본 이어쓰기',exact:true}).click();await p.locator('[data-editor]').waitFor();assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_versions').get().n,2);
});
browserTest('stale delete confirmation and network failure preserve visible material',async t=>{
 const f=fixture(t),d=await localSop(f),p=await pageFor(t,f);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await versionAction(p,'버전 삭제');await p.locator('[data-lifecycle]').waitFor();
 const doc=(await f.doc(d.versionId)).document;await f.api('/versions/'+d.versionId,'PUT',{revision:doc.revision,body:doc.body});await p.locator('[name=confirm]').check();await p.getByRole('button',{name:'삭제 확정',exact:true}).click();await p.getByText('자료 상태가 변경되었거나 확인이 누락됐습니다. 다시 열어 확인해주세요.',{exact:true}).first().waitFor();assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_course_lifecycle').get().n,0);
 await p.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await p.locator('.st-card').count(),1);await versionAction(p,'버전 삭제');await p.locator('[name=confirm]').check();await p.route('**/api/versions/*/delete?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'시험 연결 오류'})}));await p.getByRole('button',{name:'삭제 확정',exact:true}).click();await p.locator('[data-dialog-status]').getByText('시험 연결 오류',{exact:true}).waitFor();assert.equal(await p.getByRole('dialog').isVisible(),true);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM staff_training_course_lifecycle').get().n,0);
});
browserTest('common course management remains HQ-only and deleted learning history remains visible',async t=>{
 const f=fixture(t),d=await approved(f,f.hq);const aid=await f.enroll(d.versionId);await f.attempt(aid);
 const clinic=await pageFor(t,f);await clinic.getByRole('button',{name:'자료 보기',exact:true}).click();assert.equal(await clinic.getByRole('button',{name:'버전 삭제',exact:true}).count(),0);assert.equal(await clinic.getByRole('button',{name:'수정본 만들기',exact:true}).count(),0);assert.match(await clinic.getByRole('dialog').innerText(),/수정·삭제는 HQ/);
 const hq=await pageFor(t,f,'hq');await versionAction(hq,'버전 삭제');await hq.locator('[name=confirm]').check();await hq.getByRole('button',{name:'삭제 확정',exact:true}).click();await hq.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await hq.locator('.st-card').count(),0);
 const staff=await pageFor(t,f,'staff');assert.equal(await staff.getByRole('button',{name:'삭제한 자료',exact:true}).count(),0);await staff.getByRole('button',{name:'내 교육',exact:true}).click();assert.match(await staff.locator('.st-card').innerText(),/이수 완료/);assert.match(await staff.locator('.st-card').innerText(),/100점/);assert.match(await staff.locator('.st-card').innerText(),/자료 삭제됨/);assert.equal(await staff.getByRole('button',{name:'다시 보기',exact:true}).count(),0);
});
browserTest('trash deduplicates versions and active AI disables deletion',async t=>{
 const f=fixture(t),d=await localSop(f);await f.publish(d.versionId);const doc=(await f.doc(d.versionId)).document;await f.api('/versions/'+d.versionId+'/revise','POST',{revision:doc.revision});await courseLifecycle(f,d,'delete');
 const p=await pageFor(t,f);await p.getByRole('button',{name:'삭제한 자료',exact:true}).click();assert.equal(await p.locator('.st-card').count(),1);await p.getByRole('button',{name:'복원',exact:true}).click();assert.match(await p.getByRole('dialog').innerText(),/전체 버전\s+2개/);await p.getByRole('button',{name:'취소',exact:true}).click();
 const other=await localSop(f,'생성 중인 시험 자료');f.sqlite.prepare("INSERT INTO staff_training_generation_jobs VALUES('busy','a','busy','owner','running',?,?, '{}','2026-10-22','2026-10-22')").run(other.courseId,other.versionId);await p.getByRole('button',{name:'새로고침',exact:true}).click();await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await versionAction(p,'버전 삭제');assert.equal(await p.getByRole('button',{name:'삭제 확정',exact:true}).isDisabled(),true);assert.match(await p.getByRole('dialog').innerText(),/AI 작성·보완 처리 중/);
});
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
   res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/staff-training.css"><style>body{margin:0;background:#f3f6fb;font-family:Arial,sans-serif}main{max-width:1250px;margin:auto;padding:24px}@media(max-width:600px){main{padding:16px}}</style><main id="root"></main><script src="/staff-training.js"></script><link rel="stylesheet" href="/training-automation.css"><script src="/training-automation.js"></script><script>
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
  if(!/^[a-zA-Z0-9._-]+\.(js|css|html|woff2|ttf)$/.test(name)||!existsSync(resolve(root,name))){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(name)]);res.end(readFileSync(resolve(root,name)));
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
 if(role==='staff'&&width===1280){const pending=p.waitForEvent('download');await p.getByRole('button',{name:'PDF 다운로드',exact:true}).click();const download=await pending;assert.match(download.suggestedFilename(),/\.pdf$/);const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href),pdf=await pdfjs.getDocument({data:new Uint8Array(readFileSync(await download.path()))}).promise;let text='',links=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);text+=(await page.getTextContent()).items.map(x=>x.str).join(' ')+' ';links.push(...await page.getAnnotations());}assert.match(text,/원본·참고 근거/);assert.ok(text.replace(/\s+/g,' ').includes(sourceTitle));assert.ok(links.some(a=>a.url==='https://example.org/reference'));await pdf.destroy();}
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
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});
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
 await p.getByRole('button',{name:'이수 현황',exact:true}).click();await p.locator('[data-report] table').waitFor();
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
 const f=fixture(t),p=await pageFor(t,f);await p.evaluate(()=>{app.clear();failLoad=true;app.open();});
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
browserTest('failed supplement is visible in history without claiming an empty or completed result',async t=>{const {f,p}=await supplementationPage(t);f.provider=supplementProvider(f,{fail:true});await p.locator('[name=confirmSend]').check();await p.getByRole('button',{name:'AI 보완 초안 작성',exact:true}).click();await p.getByRole('dialog').getByText(/AI 제공 서비스가 생성을 완료하지 못했습니다/).waitFor();await p.reload();await p.locator('.st-tabs').waitFor();await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'보완안 열기',exact:true}).click();await p.getByRole('heading',{name:'AI 보완안 비교·반영',exact:true}).waitFor();assert.match(await p.locator('dialog').innerText(),/생성 미완료/);assert.equal(f.provider.calls.length,1);});
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

for(const width of [390,1280])browserTest('HQ bulk queue consent, reuse, progress, private drafts and responsive layout '+width,async t=>{
 const f=fixture(t);await f.create(f.hq);let calls=0;f.provider={transport:async()=>{calls++;return Response.json({status:'completed',output_text:JSON.stringify(f.body())});}};
 const p=await pageFor(t,f,'hq',width);await p.getByRole('button',{name:'일괄 생성·진행 현황',exact:true}).click();await p.getByRole('button',{name:'전체 원본 일괄 등록·생성',exact:true}).waitFor();
 assert.match(await p.locator('[data-ta-selection]').innerText(),/원본 23개/);assert.match(await p.locator('[data-ta-selection]').innerText(),/재사용 가능 1개/);assert.match(await p.locator('[data-ta-selection]').innerText(),/횟수 제한 없음/);
 assert.ok(await p.locator('.training-automation').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await p.getByRole('button',{name:'전체 원본 일괄 등록·생성',exact:true}).click();assert.equal(calls,0);assert.match(await p.locator('[data-ta-notice]').innerText(),/안내를 확인/);
 await p.locator('[data-ta-consent]').check();await p.getByRole('button',{name:'전체 원본 일괄 등록·생성',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.ta-counts')?.textContent.includes('완료 23개'),{timeout:30000});assert.equal(calls,22);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM staff_training_versions WHERE status='draft'").get().n,23);assert.equal((await f.api('/','GET',null,f.staff)).courses.length,0);
 assert.ok(await p.locator('.training-automation').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await p.screenshot({path:resolve(root,'../outputs/training-auto-'+width+'.png'),fullPage:true});await p.getByRole('button',{name:'닫기',exact:true}).click();await p.getByRole('button',{name:'일괄 생성·진행 현황',exact:true}).click();await p.getByRole('button',{name:'전체 원본 일괄 등록·생성',exact:true}).waitFor();assert.match(await p.locator('[data-ta-selection]').innerText(),/재사용 가능 23개/);assert.equal(calls,22);
});
browserTest('queue failed retry needs a separate explicit decision and cancelled work stays stopped',async t=>{
 const f=fixture(t);f.provider={transport:async()=>Response.json({error:'synthetic'},{status:500})};const source=await f.c.trainingSource(f.DB,'source');await f.api('/automation/enqueue','POST',{confirmSend:true,sources:[{id:source.contentId,hash:source.hash,version:String(source.version)}]},f.hq);await f.api('/automation/process','POST',{},f.hq,f.provider);const p=await pageFor(t,f,'hq');await p.getByRole('button',{name:'일괄 생성·진행 현황',exact:true}).click();await p.getByRole('button',{name:'다시 생성',exact:true}).waitFor();await p.getByRole('button',{name:'다시 생성',exact:true}).click();await p.getByRole('group',{name:'재생성 확인'}).getByRole('button',{name:'취소',exact:true}).click();assert.equal(f.sqlite.prepare('SELECT status FROM staff_training_queue').get().status,'failed');assert.equal(await p.evaluate(()=>writes.filter(x=>x.endsWith('/retry')).length),0);
});
browserTest('bulk resume recovers failed and stopped items after one explicit confirmation',async t=>{
 const f=fixture(t),sources=await Promise.all(['source','builtin:patella'].map(async id=>{const s=await f.c.trainingSource(f.DB,id);return {id,hash:s.hash,version:String(s.version)};}));await f.api('/automation/enqueue','POST',{confirmSend:true,sources},f.hq);await f.api('/automation/cancel','POST',{},f.hq);f.provider={transport:async()=>Response.json({status:'completed',output_text:JSON.stringify(f.body())})};const p=await pageFor(t,f,'hq');await p.getByRole('button',{name:'일괄 생성·진행 현황',exact:true}).click();await p.getByRole('button',{name:'미완료·중지 일괄 재개',exact:true}).waitFor();await p.getByRole('button',{name:'미완료·중지 일괄 재개',exact:true}).click();await p.getByRole('button',{name:'확인하고 생성 재개',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.ta-counts')?.textContent.includes('완료 2개'));assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM staff_training_queue WHERE status='completed'").get().n,2);
});
browserTest('temporary provider limits show a waiting state and resume without another click',async t=>{
 const f=fixture(t),source=await f.c.trainingSource(f.DB,'source');await f.api('/automation/enqueue','POST',{confirmSend:true,sources:[{id:'source',hash:source.hash,version:String(source.version)}]},f.hq);let calls=0;f.provider={transport:async()=>++calls===1?Response.json({error:{code:'rate_limit_exceeded'}},{status:429,headers:{'Retry-After':'1'}}):Response.json({status:'completed',output_text:JSON.stringify(f.body())})};const p=await pageFor(t,f,'hq');await p.getByRole('button',{name:'일괄 생성·진행 현황',exact:true}).click();await p.getByRole('button',{name:'지금 생성 이어가기',exact:true}).waitFor();await p.getByRole('button',{name:'지금 생성 이어가기',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-ta-notice]')?.textContent.includes('잠시 대기 중'));await p.waitForFunction(()=>document.querySelector('.ta-counts')?.textContent.includes('완료 1개'),{timeout:20000});assert.equal(calls,2);
});

async function versionAction(p,name,id){const button=p.locator('.st-card-manage').getByRole('button',{name,exact:true,includeHidden:true}).filter(id?{has:p.locator(':scope[data-id="'+id+'"]')}:{});const target=id?p.locator('.st-card-manage [data-id="'+id+'"]').filter({hasText:new RegExp('^'+name+'$')}):button;const details=target.locator('xpath=ancestor::details[1]');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();await target.click();}

for(const width of [390,1280])browserTest('workflow SOP groups versions and keeps numeric order across delete and restore '+width,async t=>{
 const f=fixture(t),one=await localSop(f,'01. 진료 시작·마감 점검'),two=await localSop(f,'02. 접수'),ten=await localSop(f,'10. 감염 관리');for(const d of [one,two,ten])await f.publish(d.versionId);
 const v2=await f.api('/versions/'+one.versionId+'/revise','POST',{revision:(await f.doc(one.versionId)).document.revision});const p=await pageFor(t,f,'owner',width);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();
 assert.deepEqual(await p.locator('.st-card h2').allTextContents(),['01. 진료 시작·마감 점검','02. 접수','10. 감염 관리']);assert.equal(await p.locator('.st-card').count(),3);assert.match(await p.locator('.st-card').first().innerText(),/작성 중 · v2/);assert.equal(await p.getByRole('button',{name:'수정본 이어쓰기',exact:true}).count(),1);
 await versionAction(p,'버전 삭제',v2.versionId);await p.locator('[name=confirm]').check();await p.getByRole('button',{name:'삭제 확정',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await p.locator('.st-card h2').first().innerText(),'01. 진료 시작·마감 점검');
 await p.getByRole('button',{name:'삭제한 자료',exact:true}).click();await p.getByRole('button',{name:'복원',exact:true}).click();await p.locator('[name=confirm]').check();await p.getByRole('button',{name:'버전 복원',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.equal(await p.locator('.st-card').count(),3);assert.equal((await f.doc(one.versionId)).document.current,true);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth));await p.screenshot({path:resolve(root,'../workflow-sop-'+width+'.png'),fullPage:true});
});
browserTest('workflow filters are isolated by tab and categories only include relevant materials',async t=>{
 const f=fixture(t),sop=await localSop(f,'01. 업무'),edu=await approved(f,f.hq,'교육 자료');await f.publish(sop.versionId);const p=await pageFor(t,f);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();await p.getByLabel('교육자료 검색').fill('01.');await p.locator('[data-category]').selectOption({index:1});await p.getByRole('button',{name:'교육자료실',exact:true}).click();assert.equal(await p.getByLabel('교육자료 검색').inputValue(),'');assert.equal(await p.locator('[data-category]').inputValue(),'');assert.match(await p.locator('.st-card h2').innerText(),/교육 자료/);await p.getByRole('button',{name:'우리 병원 SOP',exact:true}).click();assert.equal(await p.getByLabel('교육자료 검색').inputValue(),'01.');assert.equal(await p.locator('.st-card').count(),1);await p.getByRole('button',{name:'조건 해제',exact:true}).click();assert.equal(await p.getByLabel('교육자료 검색').inputValue(),'');assert.equal(await p.locator('[data-category]').inputValue(),'');
});
browserTest('workflow loading preserves prior cards on refresh failure and session clearing removes them',async t=>{
 const f=fixture(t);await approved(f,f.hq,'보존할 교육');const p=await pageFor(t,f);await p.evaluate(()=>{slow=true;failLoad=true;});await p.getByRole('button',{name:'새로고침',exact:true}).click();await p.getByText(/기존 목록을 유지했습니다/).waitFor();assert.match(await p.locator('.st-card').innerText(),/보존할 교육/);await p.evaluate(()=>{syntheticIdentity='next-session';app.clear();});assert.equal(await p.locator('.st-card').count(),0);
});
browserTest('workflow reading actions and table of contents are above long text and focus returns on close',async t=>{
 const f=fixture(t);await approved(f,f.hq,'긴 교육');const p=await pageFor(t,f,'staff');await p.getByRole('button',{name:'자료 보기',exact:true}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.locator('.st-reading-actions [data-st=download]').count(),1);assert.equal(await p.locator('.st-doc-toc button').count(),3);await p.locator('.st-doc-toc button').nth(1).click();assert.equal(await p.locator('#stSection1').evaluate(e=>document.activeElement===e),true);await p.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await p.getByRole('button',{name:'자료 보기',exact:true}).evaluate(e=>document.activeElement===e),true);
});

for(const width of [390,1280])browserTest('approval preflight guides explicit gap decisions and retains approval gate '+width,async t=>{const f=fixture(t),d=await f.create(f.hq,{body:{...f.body(),gaps:['원내 연락 담당자 확인']}}),p=await pageFor(t,f,'hq',width);await p.getByRole('button',{name:'자료·검토 열기',exact:true}).click();await p.getByRole('button',{name:'검토 항목 정리',exact:true}).click();await p.getByLabel('검토 의료진 이름').fill('시험 검토자');await p.getByLabel('처리 방식',{exact:true}).selectOption('guidance');await p.getByLabel('처리 사유·본문 위치·적용 안내',{exact:true}).fill('연락 담당자와 보고 경로는 해당 병원의 현행 지침을 확인합니다.');await p.locator('[name="confirmReviewed"]').check();assert.ok(await p.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.getByRole('button',{name:'처리 내용 저장',exact:true}).click();await p.getByText('적용 전 확인사항',{exact:true}).waitFor();assert.equal((await f.doc(d.versionId,f.hq)).document.status,'draft');assert.equal((await f.doc(d.versionId,f.hq)).document.body.gaps.length,0);assert.equal((await f.doc(d.versionId,f.hq)).document.body.gapReviews.length,1);assert.equal(await p.getByRole('button',{name:'승인하고 공개',exact:true}).count(),0);});
