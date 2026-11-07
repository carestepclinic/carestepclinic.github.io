const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let server,browser,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function page(tab,width=1440){const p=await browser.newPage({viewport:{width,height:950}});p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);await p.evaluate(()=>{window.testRequests=[];saasMode='auth';saasToken='synthetic-local-token';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};saasRequest=async(p,o)=>{testRequests.push({p,o});return {ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,userId:'owner',manager:true,next:null};};showApp({deferFullRender:true});go('practice');});await p.evaluate(tab=>go('practice',{practiceTab:tab}),tab);await p.locator('form[data-list-layout],form.er-filters').waitFor();await p.waitForTimeout(120);return {p,errors};}
for(const tab of ['surgery','dental','neuro','ophthalmic','chronic'])for(const width of [390,1440])test('common record actions '+tab+' '+width,async()=>{
 const {p,errors}=await page(tab,width);try{
  const actions=p.locator('.cs-list-actionbar,.er-list-actions').filter({has:p.getByRole('button',{name:/새 .*기록/})}).first();
  const box=await actions.boundingBox();const buttons=await actions.locator(':scope>button').evaluateAll(es=>es.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,y:e.getBoundingClientRect().y})));
  assert.ok(buttons.length>=2,JSON.stringify(buttons));assert.ok(Math.abs(buttons[0].y-buttons[1].y)<2);assert.ok(Math.abs(buttons[1].right-(box.x+box.width))<3,JSON.stringify({box,buttons}));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  if(tab==='chronic'){assert.equal(await p.getByRole('button',{name:'전체 해제',exact:true}).count(),0);assert.ok(await p.getByRole('button',{name:'전체',exact:true}).isVisible());}
 }finally{await p.close();}
});

test('update opens new version and keeps unsaved input in original tab',async()=>{
 const {p}=await page('chronic');try{
  await p.locator('input[name=q]').fill('유지할 검색');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('clinic-calm.css?v=20261107-review-polish','clinic-calm.css?v=test-next-version');
  await p.route(url+'/index.html',r=>r.fulfill({status:200,contentType:'text/html',headers:{etag:'"new"'},body:html}));
  await p.evaluate(()=>ClinicUpdateNotice.check());assert.ok(await p.locator('.cs-update-notice').isVisible());
  const [popup]=await Promise.all([p.waitForEvent('popup'),p.locator('.cs-update-open').click()]);await popup.waitForLoadState('domcontentloaded');
  assert.equal(await p.locator('input[name=q]').inputValue(),'유지할 검색');assert.ok(popup.url().includes('updated='));await popup.close();
  await p.locator('.cs-update-notice button').click();await p.evaluate(()=>ClinicUpdateNotice.check());assert.equal(await p.locator('.cs-update-notice').count(),0);
 }finally{await p.close();}
});
test('unchanged version and failed update lookup leave workspace alone',async()=>{
 const {p}=await page('dental');try{await p.evaluate(()=>ClinicUpdateNotice.check());assert.equal(await p.locator('.cs-update-notice').count(),0);await p.route(url+'/index.html',r=>r.fulfill({status:503,body:'temporarily unavailable'}));await p.evaluate(()=>ClinicUpdateNotice.check());assert.equal(await p.locator('.cs-update-notice').count(),0);assert.ok(await p.locator('form[data-list-layout]').isVisible());}finally{await p.close();}
});
test('dashboard keeps warning cards outside collapsed normal status',async()=>{
 const {p}=await page('dental');try{
  await p.evaluate(()=>{go('dashboard');});await p.locator('.r61-normal-status').waitFor({state:'attached'});
  assert.equal(await p.locator('.r61-normal-status').getAttribute('open'),null);
  assert.equal(await p.locator('.r61-normal-status .r61-overview-grid').count(),0);
  assert.equal(await p.locator('.r61-normal-status .r61-status-chips').count(),1);
  await p.evaluate(()=>{workFirstFilter='all';renderWorkFirstDashboard();});
  assert.equal(await p.locator('#workFirstListTitle').innerText(),'업무 목록');
  assert.equal(await p.locator('[data-work-filter=care]').isVisible(),false);
 }finally{await p.close();}
});
for(const width of [390,1280,1440])test('calculator compact input and type layout '+width,async()=>{
 const {p,errors}=await page('dental',width);try{
  await p.evaluate(()=>go('practice',{practiceTab:'calc'}));await p.locator('.pt-calc-common').waitFor();
  const boxes=await p.locator('.pt-calc-common').evaluate(e=>Object.fromEntries(['[data-common-inputs]','.pt-mobile-calc-select','.pt-flow-context'].map(s=>{const b=e.querySelector(s).getBoundingClientRect();return[s,{x:b.x,y:b.y,width:b.width}];})));
  if(width>1100&&width<=1280){assert.ok(boxes['.pt-mobile-calc-select'].x>boxes['[data-common-inputs]'].x+boxes['[data-common-inputs]'].width,JSON.stringify(boxes));}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await p.screenshot({path:root+'/../clinic-redesign-preview/calculator-review-'+width+'.png',fullPage:false});
 }finally{await p.close();}
});
