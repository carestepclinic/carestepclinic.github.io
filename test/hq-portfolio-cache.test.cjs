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
  window.originalReq=req;window.reads=[];window.writes=[];window.owner='synthetic';hqSessionToken=()=>owner;window.failList=false;
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

for(const view of ['onboarding','customerSuccess'])test('portfolio revisit reuses data; refresh, expiration and owner force reads '+view,async t=>{
 const p=await fixture(t);await p.evaluate(v=>{const old=req;window.n=0;req=(path,o)=>path==='/hq/'+(v==='onboarding'?'onboarding':'customer-success')?(n++,Promise.resolve({clinics:[],summary:{}})):old(path,o);showView(v);},view);
 await p.waitForFunction(v=>!document.getElementById(v+'Refresh').disabled,view);
 await p.evaluate(v=>{showView('audit');showView(v);},view);assert.equal(await p.evaluate(()=>n),1);
 await p.locator('#'+view+'Refresh').click();await p.waitForFunction(v=>!document.getElementById(v+'Refresh').disabled,view);assert.equal(await p.evaluate(()=>n),2);
 await p.evaluate(v=>{const now=Date.now;Date.now=()=>now()+31000;showView('audit');showView(v);},view);await p.waitForFunction(()=>n===3);
 await p.evaluate(v=>{owner='new-owner';showView('audit');showView(v);},view);await p.waitForFunction(()=>n===4);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
});

for(const width of [390,1440])test('short portfolio expands naturally and uses consistent readiness labels '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>{const old=req;req=(path,o)=>path==='/hq/onboarding'?Promise.resolve({clinics:Array.from({length:4},(_,i)=>({clinicId:'c'+i,clinicName:'시험 병원 '+i,steps:[{key:'profile',done:true,label:'병원 정보'},{key:'team',done:true,label:'직원 계정'},{key:'package',done:false,label:'첫 퇴원자료'}],optionalSteps:[{key:'package',done:false,label:'첫 보호자 안내자료'}],summary:{}})),summary:{total:4}}):old(path,o);showView('onboarding');});
 await p.locator('#onboardingRows .hq-compact-main-row').first().waitFor();
 assert.equal(await p.locator('#onboarding .hq-short-portfolio').evaluate(e=>getComputedStyle(e).maxHeight),'none');
 assert.match(await p.locator('#onboarding .onboarding-table thead').innerText(),/기본 준비/);
 const mapped=await p.evaluate(()=>CarestepHqWorkspace.onboardingEntry({steps:[{key:'package',label:'첫 퇴원자료',done:true}]}));assert.equal(mapped.optionalSteps[0].label,'첫 보호자 안내자료');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});

test('protocol cards omit duplicate summary while detail retains source content',async t=>{
 const p=await fixture(t);await p.evaluate(()=>showView('protocols'));await p.locator('.hq-protocol-card').first().waitFor();assert.equal(await p.locator('.hq-protocol-description').count(),0);
 await p.locator('.hq-protocol-card').first().getByRole('button',{name:'초안 검토'}).click();await p.getByText('시험 요약',{exact:true}).waitFor();
});

for(const view of ['onboarding','customerSuccess'])test('successful write invalidates portfolio cache '+view,async t=>{
 const p=await fixture(t);await p.evaluate(v=>{
  req=originalReq;document.getElementById('endpoint').value='https://synthetic.invalid';window.n=0;
  window.fetch=async(url,options)=>{if(String(url).endsWith('/hq/'+(v==='onboarding'?'onboarding':'customer-success')))n++;return {ok:true,json:async()=>({ok:true,clinics:[],summary:{},items:[]})};};showView(v);
 },view);await p.waitForFunction(v=>!document.getElementById(v+'Refresh').disabled,view);
 await p.evaluate(v=>{showView('audit');showView(v);},view);assert.equal(await p.evaluate(()=>n),1);
 await p.evaluate(async v=>{await req('/synthetic-test-save',{method:'POST',body:'{}'});showView('audit');showView(v);},view);await p.waitForFunction(()=>n===2);
});

