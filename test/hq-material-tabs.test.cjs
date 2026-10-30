const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1);if(name.includes('/')||!/^[-\w]+\.(html|js|css|woff2)$/.test(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'})[path.extname(name)]);res.end(fs.readFileSync(path.join(root,name)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.HQ_TEST_BROWSER?{executablePath:process.env.HQ_TEST_BROWSER}:{})});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function fixture(t,width=1280,hash=''){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await context.close();});await p.goto(origin+'/hq.html'+hash);
 await p.evaluate(()=>{
  window.reads=[];window.writes=[];window.owner='synthetic';hqSessionToken=()=>owner;window.failList=false;
  const docs=[{id:'p1',title:'시험 질환 A',status:'draft',species:'dog',sourceCurrent:true},{id:'p2',title:'시험 질환 B',status:'published',species:'cat',sourceCurrent:true}];
  req=async(p,o)=>{if(o?.method&&o.method!=='GET'){writes.push(p);throw Error('unexpected write');}reads.push(p);
   if(p==='/hq/training/knowledge-protocols'){if(failList)throw Error('시험 조회 실패');return {items:docs,queue:{counts:{completed:2,queued:1,failed:1},items:[]}};}
   if(p==='/hq/training/knowledge-protocols/preview')return {targets:[]};
   if(p==='/hq/training/knowledge-protocols/p1')return {document:{id:'p1',status:'draft',revision:1,body:{title:'시험 질환 A',disease:'시험',species:'dog',summary:'시험 요약',steps:[]},sources:[],gaps:[],gapResolutions:[]}};
   if(p==='/hq/training/')return {actor:{capabilities:{}},courses:[],assignments:[],members:[],categories:[]};
   if(p==='/hq/guardian-content/drafts')return {drafts:[],limit:200};
   return {contents:[],categories:[],drafts:[],items:[]};
  };
  document.getElementById('loginOverlay').classList.add('hidden');
 });return p;
}
for(const width of [390,768,1440])test('three independent material tabs and mobile layout '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>showView('protocols'));
 await p.locator('.hq-protocol-card').first().waitFor();assert.equal(await p.locator('.hq-protocol-card').count(),2);
 for(const [view,label] of [['training','직원 교육자료'],['content','보호자 안내자료'],['protocols','진료 프로토콜']]){
  await p.locator('.view.active [data-material-view="'+view+'"]').click();
  assert.equal(await p.locator('.view.active').getAttribute('id'),view);
  assert.equal(await p.locator('.view.active [data-material-view][aria-current=page]').innerText(),label);
  assert.equal(await p.locator('#hqCurrentView').innerText(),label);
  assert.equal(await p.locator('#nav [data-view="'+view+'"]').getAttribute('aria-current'),'page');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 assert.equal(await p.locator('#training').getByRole('button',{name:'진료 프로토콜 · 일괄 준비·승인'}).count(),0);
 assert.deepEqual(await p.evaluate(()=>writes),[]);
 if(process.env.HQ_SCREENSHOTS)await p.screenshot({path:path.join(process.env.HQ_SCREENSHOTS,'hq-materials-'+width+'.png'),fullPage:true});
});
test('protocol filters, document review and queue are retained without automatic generation',async t=>{
 const p=await fixture(t);await p.evaluate(()=>showView('protocols'));await p.locator('.hq-protocol-card').first().waitFor();
 await p.locator('[data-protocol-filter]').selectOption('published');assert.equal(await p.locator('.hq-protocol-card').count(),1);
 await p.locator('[data-protocol-search]').fill('없음');assert.match(await p.locator('[data-protocol-list]').innerText(),/검색 조건/);
 await p.locator('[data-protocol-search]').fill('시험 질환 A');await p.locator('[data-protocol-filter]').selectOption('all');
 await p.getByRole('button',{name:'본문·검토 열기',exact:true}).click();await p.locator('[data-ck-editor]').waitFor();
 assert.equal(await p.locator('[name=title]').inputValue(),'시험 질환 A');
 await p.locator('[data-ck=back]').click();await p.locator('.hq-protocol-card').first().waitFor();
 await p.locator('[data-protocol-queue]').click();await p.locator('[data-ck=process]').waitFor();
 assert.equal(await p.locator('[data-ck=process]').isEnabled(),true);assert.deepEqual(await p.evaluate(()=>writes),[]);
});
test('protocol deep link restores after connection and browser history tracks material tabs',async t=>{
 const p=await fixture(t,1280,'#protocols');await p.evaluate(()=>CarestepHqUX.restoreRoute());await p.locator('.hq-protocol-card').first().waitFor();
 assert.equal(await p.locator('.view.active').getAttribute('id'),'protocols');
 await p.locator('#protocols [data-material-view=training]').click();await p.goBack();
 await p.waitForFunction(()=>document.querySelector('.view.active').id==='protocols');
 assert.equal(await p.locator('#protocols [data-material-view=protocols]').getAttribute('aria-current'),'page');
});
test('failed protocol read is retryable and old responses cannot replace a newer load',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{failList=true;showView('protocols');});await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor();
 assert.match(await p.locator('[data-protocol-status]').innerText(),/불러오지 못했습니다/);
 await p.evaluate(()=>failList=false);await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.locator('.hq-protocol-card').first().waitFor();
 await p.evaluate(()=>{window.pending=[];req=()=>new Promise(resolve=>pending.push(resolve));CarestepHqProtocols.open();CarestepHqProtocols.open();pending[1]({items:[{id:'new',title:'최신 결과',status:'draft'}]});});
 await p.waitForFunction(()=>document.querySelector('[data-protocol-list]').textContent.includes('최신 결과'));
 await p.evaluate(()=>pending[0]({items:[{id:'old',title:'오래된 결과',status:'draft'}]}));
 assert.doesNotMatch(await p.locator('[data-protocol-list]').innerText(),/오래된/);
});
test('disconnect clears protocol content and rejects in-flight response',async t=>{
 const p=await fixture(t);await p.evaluate(()=>showView('protocols'));await p.locator('.hq-protocol-card').first().waitFor();
 await p.evaluate(()=>{req=()=>new Promise(resolve=>window.finish=resolve);CarestepHqProtocols.open();owner='';document.getElementById('loginOverlay').classList.remove('hidden');});
 await p.evaluate(()=>finish({items:[{id:'late',title:'늦은 응답',status:'draft'}]}));
 assert.equal(await p.locator('.hq-protocol-card').count(),0);assert.match(await p.locator('[data-protocol-status]').innerText(),/HQ 연결 후/);
});
