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
for(const width of [390,1440])test('base setup ignores optional workflows and filters and counts agree '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{
  const old=req;req=(path,o)=>path==='/hq/onboarding'?Promise.resolve({summary:{total:3,attention:3,live:0},clinics:[
   {clinicId:'a',clinicName:'기본 완료 병원',goLiveStatus:'attention',needsAttention:true,steps:[{key:'profile',label:'병원 정보',done:true},{key:'team',label:'직원 계정',done:true},{key:'messaging',label:'문자 자동발송',done:false},{key:'package',label:'보호자 안내자료',done:false}]},
   {clinicId:'b',clinicName:'직원 준비 병원',goLiveStatus:'live',steps:[{key:'profile',label:'병원 정보',done:true},{key:'team',label:'직원 계정',done:false}]},
   {clinicId:'c',clinicName:'정보 없는 병원',steps:[]}
  ]}):old(path,o);showView('onboarding');
 });await p.locator('#obTotal').getByText('3',{exact:true}).waitFor();
 assert.equal(await p.locator('#obLive').innerText(),'1');assert.equal(await p.locator('#obAttention').innerText(),'2');
 await p.locator('#onboardingStatusFilter').selectOption('live');
 assert.equal(await p.locator('#onboardingRows .hq-compact-main-row').count(),1);
 assert.match(await p.locator('#onboardingRows').innerText(),/기본 완료 병원/);
 await p.locator('#onboardingRows .hq-row-toggle').click();assert.match(await p.locator('#onboardingRows').innerText(),/선택 기능[\s\S]*문자 자동발송/);
 await p.locator('#onboardingStatusFilter').selectOption('attention');assert.equal(await p.locator('#onboardingRows .hq-compact-main-row').count(),2);
 assert.doesNotMatch(await p.locator('#onboardingRows').innerText(),/기본 완료 병원/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});
test('onboarding calculation does not mutate server entries or grant configuration',async t=>{
 const p=await fixture(t);const result=await p.evaluate(()=>{const entry={needsAttention:true,steps:[{key:'profile',done:true},{key:'team',done:true},{key:'messaging',done:false}]};const before=JSON.stringify(entry),view=CarestepHqWorkspace.onboardingEntry(entry);return {same:before===JSON.stringify(entry),ready:!view.needsAttention,optional:view.optionalSteps[0].done};});assert.deepEqual(result,{same:true,ready:true,optional:false});
});
for(const width of [390,1440])test('top and bottom protocol pagination agree and full original title is retained '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{
 const old=req;req=(path,o)=>path==='/hq/training/knowledge-protocols'?Promise.resolve({items:Array.from({length:30},(_,i)=>({id:'p'+i,title:'단백소실성 장질환 의심 환자의 진단적 평가 및 원인 기반 관리와 재평가 프로토콜 '+i,body:{disease:'PLE',summary:'진단 및 평가'},status:'published',species:'dog'})),queue:{items:[],counts:{}}}):old(path,o);showView('protocols');
 });await p.locator('.hq-protocol-card').first().waitFor();assert.equal(await p.locator('#protocols .hq-pagination').count(),2);
 assert.equal(await p.locator('.hq-protocol-card h2').first().innerText(),'PLE');
 assert.match(await p.locator('.hq-protocol-card h2').first().getAttribute('title'),/단백소실성/);
 assert.match(await p.locator('.hq-protocol-description').first().innerText(),/재평가 프로토콜/);
 await p.locator('#protocols .hq-pagination-top').getByRole('button',{name:'다음',exact:true}).click();
 assert.equal(await p.locator('.hq-protocol-card').count(),6);assert.ok(await p.locator('#protocols .hq-pagination-top').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.top').getBoundingClientRect().bottom));for(const nav of await p.locator('#protocols .hq-pagination').all())assert.match(await nav.innerText(),/25–30/);
 await p.locator('#protocols .hq-pagination').last().getByRole('button',{name:'이전',exact:true}).click();assert.equal(await p.locator('.hq-protocol-card').count(),24);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await p.evaluate(()=>writes),[]);
 await p.evaluate(()=>scrollTo(0,0));if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:path.join(process.env.HQ_SCREENSHOTS,'next-protocols-'+width+'.png'),fullPage:true});
});
test('training public and draft buttons target distinct versions with their own dates',async t=>{
 const p=await fixture(t,390);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/training/'?Promise.resolve({actor:{common:true,capabilities:{edit:true,review:true}},courses:[
 {id:'v1',course_id:'a',title:'공통 교육',kind:'education',version:1,status:'published',common:true,owned:true,current_version_id:'v1',updated_at:'2026-10-01'},
 {id:'v2',course_id:'a',title:'공통 교육 수정본',kind:'education',version:2,status:'draft',common:true,owned:true,current_version_id:'v1',updated_at:'2026-11-08'}
 ],assignments:[],members:[]}):old(path,o);showView('training');});await p.locator('.st-card').waitFor();const card=p.locator('.st-card');
 assert.equal(await card.getByRole('button',{name:'공개본 열기',exact:true}).getAttribute('data-id'),'v1');assert.equal(await card.getByRole('button',{name:'수정본 이어쓰기',exact:true}).getAttribute('data-id'),'v2');
 assert.match(await card.innerText(),/수정 2026-10-01/);assert.match(await card.innerText(),/수정본 저장 2026-11-08/);
 assert.equal(await p.locator('#staffTrainingRoot .st-eyebrow').isVisible(),false);assert.deepEqual(await p.evaluate(()=>writes),[]);
});
test('adoption labels describe coverage without asserting overall clinical churn',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/customer-success'?Promise.resolve({summary:{total:1,risk:1},clinics:[{clinicId:'a',clinicName:'시험 병원',status:'risk',statusLabel:'위험',riskScore:90,reasons:['최근 30일 안내자료 0건'],nextAction:'첫 안내자료 안내',onboarding:{percent:0}}]}):old(path,o);showView('customerSuccess');});await p.locator('.cs-status').waitFor();
 assert.equal(await p.locator('.cs-status').innerText(),'사용 현황 확인 필요');assert.doesNotMatch(await p.locator('#customerSuccess').innerText(),/이용 중단 위험|이탈위험/);
 assert.match(await p.locator('#customerSuccess').innerText(),/병원 전체 진료 활동을 평가하는 지표는 아닙니다/);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});
for(const success of [true,false])test('saved-session restore hides credential form then resolves '+success,async t=>{
 const context=await browser.newContext();t.after(()=>context.close());await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await context.addInitScript(()=>{localStorage.setItem('carestep_hq_session_v1013','synthetic-only');localStorage.setItem('carestep_hq_session_exp_v1013',new Date(Date.now()+86400000).toISOString());localStorage.setItem('carestep_hq_endpoint_v20261020','https://synthetic.invalid');const native=fetch;window.fetch=(url,opt)=>String(url).includes('/hq/health')?new Promise(resolve=>window.finishHealth=ok=>resolve(new Response(JSON.stringify(ok?{ok:true}:{error:'시험 인증 만료'}),{status:ok?200:401,headers:{'Content-Type':'application/json'}}))):String(url).startsWith('https://synthetic.invalid')?Promise.resolve(new Response(JSON.stringify({ok:true,contents:[],drafts:[],items:[],queue:{counts:{},items:[]}}),{headers:{'Content-Type':'application/json'}})):native(url,opt);});
 const p=await context.newPage();await p.goto(origin+'/hq.html#protocols');await p.locator('#hqSessionLoading').waitFor();assert.equal(await p.locator('#hqLoginForm').isVisible(),false);
 await p.evaluate(ok=>finishHealth(ok),success);
 if(success)await p.locator('#loginOverlay').waitFor({state:'hidden'});else{await p.locator('#hqLoginForm').waitFor();assert.match(await p.locator('#loginStatus').innerText(),/시험 인증 만료/);assert.equal(await p.locator('#connect').isEnabled(),true);}
});



test('quick protocol states preserve text and species filters and clear contradictory status',async t=>{
 const p=await fixture(t);await p.evaluate(()=>showView('protocols'));await p.locator('.hq-protocol-card').first().waitFor();
 await p.locator('[data-protocol-search]').fill('시험 질환 A');await p.locator('#protocols .hq-secondary-filters summary').click();await p.locator('[data-protocol-species]').selectOption('dog');await p.locator('[data-protocol-filter]').selectOption('published');
 await p.locator('[data-protocol-quick=review]').click();assert.equal(await p.locator('[data-protocol-search]').inputValue(),'시험 질환 A');assert.equal(await p.locator('[data-protocol-species]').inputValue(),'dog');assert.equal(await p.locator('.hq-protocol-card').count(),1);assert.equal(await p.locator('[data-protocol-filter]').inputValue(),'all');
 assert.doesNotMatch(await p.locator('[data-protocol-status]').innerText(),/0개|저장 자료/);assert.equal(await p.locator('#refresh').isVisible(),false);assert.equal(await p.locator('[data-protocol-refresh]').isVisible(),true);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});
test('protocol title and summary are not duplicated; original categories are not guessed',async t=>{
 const p=await fixture(t);assert.deepEqual(await p.evaluate(()=>({label:CarestepHqWorkspace.protocolLabel({title:'갑상선 질환',summary:'갑상선 질환'}),category:CarestepHqWorkspace.category({title:'쿠싱증후군',category:'안과'})})),{label:{title:'갑상선 질환',description:'',full:'갑상선 질환'},category:'안과'});
});
