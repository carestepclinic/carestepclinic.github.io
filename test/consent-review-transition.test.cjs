const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://local').pathname.slice(1)||'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server?.close(r));});
async function fixture(t,width=1200){const p=await browser.newPage({viewport:{width:Math.max(width,800),height:1000}});p.setDefaultTimeout(7000);t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+'/test/consent-flow-browser.html');await p.locator('#width').selectOption(String(width));const f=p.frameLocator('#fixture-frame');await f.locator('[data-act=new]').waitFor();await ready(p);t.after(()=>assert.deepEqual(errors,[]));return {p,f};}
async function ready(p){await p.waitForFunction(()=>!document.querySelector('#fixture-frame').contentDocument.querySelector('.su').hasAttribute('aria-busy'));}
async function draft(p,f,template,options={}){await p.evaluate(({template,options})=>{const w=document.querySelector('#fixture-frame').contentWindow,F=w.ConsentFixture,b=F.docs.find(d=>d.id==='draft').body;b.method=options.text||template;b.anesthesiaPlan='none';b.generalAnesthesia=false;b.explanationSources={method:{sourceId:'synthetic-approved',revision:2,title:'승인된 합성 설명',text:template}};b.patientReviewFields=['method'];if(options.collapse){b.necessity='승인된 합성 목적';b.explanationSources.necessity={sourceId:'synthetic-approved',revision:2,title:'승인된 합성 설명',text:b.necessity};}}, {template,options});await f.locator('[data-consent=draft]').click();await ready(p);}
async function prefs(p,operations){await p.evaluate(operations=>document.querySelector('#fixture-frame').contentWindow.ConsentFixture.externalPrefs(operations),operations);}
const input=f=>f.locator('[data-short-key=method][data-short-part=base]');
for(const width of [390,1200])test('saved approved source with added patient questions exposes every missing input and proceeds after completion '+width,async t=>{
 const {p,f}=await fixture(t,width),template='승인된 합성 수술 설명';
 await draft(p,f,template,{text:template+'\n\n이번 환자에서 확인한 내용\n수술 부위·좌우: [입력: 부위]\n실제 수술 범위: [입력: 범위]\n별도 상담: [입력: 확인 내용]\n병원 운영 · 응급·야간 연락: [입력: 병원 안내]'});
 await f.locator('[data-anesthesia-plan]').selectOption('general');await ready(p);
 const anesthetic=f.locator('[data-short-key=method][data-short-part=anesthesia]');assert.equal(await anesthetic.count(),1);
 for(const n of await anesthetic.all())await n.fill('합성 마취 계획');
 await f.locator('[name=plannedAt]').fill('');await f.locator('[data-act=save-consent-draft]').click();await ready(p);
 await f.locator('[data-act=back]').click();await f.locator('[data-consent=draft]').click();await ready(p);assert.equal(await input(f).count(),4);
 await f.locator('[type=submit]').click();await ready(p);assert.equal(await f.locator('.su-document').count(),0);
 assert.equal(await input(f).first().evaluate(n=>n===document.activeElement),true);
 assert.match(await f.locator('.su-consent-dock [data-consent-save-status]').innerText(),/진료 방법·내용/);
 assert.equal(await f.locator('[data-consent-issues]').isVisible(),true);assert.match(await f.locator('[data-consent-issues]').innerText(),/진료 예정 일시/);
 await input(f).first().scrollIntoViewIfNeeded();if(process.env.UX_SCREENSHOTS)await p.screenshot({path:path.join(process.env.UX_SCREENSHOTS,'consent-missing-'+width+'.png')});
 for(const n of await f.locator('[data-short-answer]').all()){
   if(await n.getAttribute('hidden')!==null)continue;
   if(!(await n.isVisible()))await n.evaluate(n=>{for(let x=n.parentElement;x;x=x.parentElement)if(x.tagName==='DETAILS')x.open=true;});
   if(await n.isVisible()&&!(await n.inputValue()).trim())await n.fill('합성 환자별 확인 내용');
 }
 await f.locator('[name=plannedAt]').fill(await p.evaluate(()=>document.querySelector('#fixture-frame').contentWindow.ConsentFixture.future()));
 assert.equal(await f.locator('[data-consent-issues]').isVisible(),false);
 await f.locator('[type=submit]').click();await ready(p);assert.equal(await f.locator('.su-document').count(),1);
 const report=await f.locator('.su-document').innerText();assert.match(report,/승인된 합성 수술 설명/);assert.match(report,/합성 마취 계획/);assert.match(report,/합성 환자별 확인 내용/);assert.doesNotMatch(report,/\[입력:/);
 assert.equal(await f.locator('[data-sign]').count(),2);assert.deepEqual(await p.evaluate(()=>document.querySelector('#fixture-frame').contentWindow.ConsentFixture.docs.find(d=>d.id==='draft').body.patientReviewFields),[]);
 assert.equal(await p.evaluate(()=>document.querySelector('#fixture-frame').contentWindow.ConsentFixture.calls.some(c=>c.path.endsWith('/sign'))),false);
});
test('multiple placeholders retain their prose and focus the missing short answer',async t=>{
 const {p,f}=await fixture(t);await draft(p,f,'원래 합성 설명',{text:'수정된 문장: [입력: 하나] 및 [입력: 둘]'});
 await f.locator('[data-anesthesia-plan]').selectOption('general');await ready(p);
 for(const n of await f.locator('[data-short-key=method][data-short-part=anesthesia]').all())await n.fill('작성된 합성 계획');
 assert.equal(await input(f).count(),2);
 await f.locator('[type=submit]').click();await ready(p);assert.equal(await input(f).first().evaluate(n=>n===document.activeElement),true);
 assert.match(await f.locator('[name=method]').inputValue(),/수정된 문장: \[입력: 하나\] 및 \[입력: 둘\]/);
});
