const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname+(new URL(req.url,'http://local').pathname==='/'?'index.html':''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await require('playwright').chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function setup(t,width,hq=false){const p=await browser.newPage({viewport:{width,height:950}}),errors=[];p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.stack));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+(hq?'/hq.html':'/'));
 t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 if(hq)await p.evaluate(()=>{hqSessionToken=()=> 'synthetic';window.writes=[];req=async(p,o={})=>{if(o.method&&o.method!=='GET'){writes.push(p);throw Error('unexpected write');}return {requests:[],cost:{revision:0,body:{}},items:[],rows:[],clinics:[],plans:[],subscriptions:[],payments:[],courses:[],members:[],assignments:[],categories:[],totals:{},summary:{},actor:{capabilities:{}}};};document.getElementById('loginOverlay').classList.add('hidden');});
 else await p.evaluate(()=>{saasMode='auth';saasToken='synthetic';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};window.writes=[];saasRequest=async(p,o={})=>{if(o.method&&o.method!=='GET')writes.push(p);return {ok:true,items:[],vendors:[],categories:[],claims:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,userId:'owner',manager:true};};localStorage.setItem('carestep.navigation.favorites:'+JSON.stringify(['test','owner']),JSON.stringify(['dental','purchases','view:account:my']));showApp({deferFullRender:true});go('practice',{practiceTab:'dental'});});
 return p;
}
async function menu(p,hq,width){if(width<=(hq?900:760)){const b=p.locator(hq?'#hqMenuToggle':'[data-practice-menu]');if(await b.getAttribute('aria-expanded')!=='true')await b.click();}}
for(const width of [390,820,1440]){
 test('Clinic records are one level deep and old favorites still navigate '+width,async t=>{
  const p=await setup(t,width);await menu(p,false,width);
  assert.equal(await p.locator('.cs-record-menu').count(),0);assert.equal(await p.locator('[data-nav-group=records] .nav-item').count(),6);
  assert.deepEqual((await p.locator('.cs-favorite-links button').allTextContents()).sort(),['내 계정','물품 관리','치과 기록'].sort());
  for(const key of ['healthcheck','surgery','dental','neuro','ophthalmic','chronic']){await menu(p,false,width);if(!await p.locator('[data-nav-group=records]').evaluate(e=>e.open))await p.locator('[data-nav-group=records]>summary').click();await p.locator('[data-nav-group=records] [data-tab='+key+']').click();await p.waitForFunction(k=>CarestepPractice.route()===k,key);assert.equal(await p.locator('[data-tab='+key+'][aria-current=page]').count(),1);}
  await menu(p,false,width);await p.locator('[data-favorite-route=purchases]').click();await p.waitForFunction(()=>CarestepPractice.route()==='purchases');assert.equal(await p.locator('#viewTitle').innerText(),'물품 관리');
  await menu(p,false,width);await p.locator('[data-favorite-route="view:account:my"]').click();assert.equal(await p.locator('#account.active-view').count(),1);
  assert.equal(await p.locator('#clinicMainNavigation [data-nav-account=my]').count(),0);assert.equal(await p.locator('.sidebar-foot [data-nav-account=my]').count(),1);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('carestep.navigation.favorites:'+JSON.stringify(['test','owner'])))),['dental','purchases','view:account:my']);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await menu(p,false,width);await p.locator('[data-nav-group=records]>summary').click();
  if(process.env.MENU_SHOTS)await p.screenshot({path:path.join(process.env.MENU_SHOTS,'clinic-'+width+'.png')});
 });
 test('HQ groups, section shortcuts and history preserve existing screens '+width,async t=>{
  const p=await setup(t,width,true);await menu(p,true,width);
  assert.equal(await p.locator('[data-hq-nav-group=clinic] [data-view=approval]').count(),1);
  assert.equal(await p.locator('[data-hq-nav-group=clinic] [data-view=voice]').count(),1);
  assert.equal(await p.locator('[data-hq-nav-group=today] [data-view=surveys]').count(),1);
  assert.equal(await p.locator('.hq-nav-utilities #returnToClinic').count(),1);
  for(const [key,group,view,hash] of [['payments','billing','billing','#billing/payments'],['cost','billing','usageBilling','#usageBilling/cost'],['storage','system','production','#production/storage']]){
   await menu(p,true,width);await p.locator('[data-hq-nav-toggle='+group+']').click();await p.locator('[data-hq-shortcut='+key+']').click();await p.waitForFunction(v=>document.querySelector('.view.active').id===v,view);
   assert.equal(await p.evaluate(()=>location.hash),hash);assert.equal(await p.locator('#nav [aria-current=page]').count(),1);assert.equal(await p.locator('[data-hq-shortcut='+key+']').getAttribute('aria-current'),'page');
   if(key==='payments')assert.equal(await p.locator('#hqBillingpayments').isVisible(),true);
  }
  await p.goBack();await p.waitForFunction(()=>location.hash==='#usageBilling/cost');assert.equal(await p.locator('[data-hq-shortcut=cost]').getAttribute('aria-current'),'page');
  await p.evaluate(()=>CarestepHqUX.restoreRoute());assert.equal(await p.locator('[data-hq-shortcut=cost]').getAttribute('aria-current'),'page');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await p.evaluate(()=>writes),[]);
  await menu(p,true,width);if(process.env.MENU_SHOTS)await p.screenshot({path:path.join(process.env.MENU_SHOTS,'hq-'+width+'.png')});
 });
}
test('Clinic denied records and favorites remain inaccessible, account switch keeps favorites scoped',async t=>{
 const p=await setup(t,1440);await p.evaluate(()=>{const prior=saasPermission;saasPermission=(key,f)=>key.startsWith('clinical.')||key==='purchases.read'?false:prior(key,f);ClinicNavigation.sync('practice');});
 assert.equal(await p.locator('[data-nav-group=records]').isVisible(),false);assert.equal(await p.locator('[data-nav-group=clinical]').isVisible(),false);
 assert.equal(await p.locator('[data-favorite-route=dental]').count(),0);assert.equal(await p.locator('[data-favorite-route=purchases]').count(),0);
 await p.evaluate(()=>{saasMe={role:'staff',clinic:{id:'other'},user:{id:'other'}};ClinicNavigation.sync('dashboard');});assert.equal(await p.locator('.cs-favorite-links button').count(),0);
});
test('HQ shortcuts respect unsaved changes and locked authentication',async t=>{
 const p=await setup(t,1440,true);await p.evaluate(()=>{window.preventLeave=true;window.CarestepResourceDrafts={hasDirty:()=>preventLeave,isSaving:()=>false,discard:()=>{preventLeave=false}};showView('billing');});
 // showView was stopped by the existing guard. Dismiss it without losing input.
 const dialog=p.locator('dialog');await dialog.waitFor();await dialog.locator('[data-hq-confirm-cancel]').count();await dialog.getByRole('button',{name:'취소',exact:true}).click();
 await p.locator('[data-hq-nav-toggle=system]').click();await p.locator('[data-hq-shortcut=storage]').click();await dialog.waitFor();await dialog.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await p.locator('#dashboard.active').count(),1);
 await p.evaluate(()=>{preventLeave=false;document.getElementById('loginOverlay').classList.remove('hidden');document.querySelector('[data-hq-shortcut=storage]').click();});assert.equal(await p.locator('#dashboard.active').count(),1);assert.deepEqual(await p.evaluate(()=>writes),[]);
});

for(const width of [820,1440])test('collapsed Clinic exposes saved favorites and honors permissions '+width,async t=>{
 const p=await setup(t,width);await p.locator('.cs-desktop-menu').click();const pins=p.locator('.cs-rail-favorites');assert.equal(await pins.isVisible(),true);assert.deepEqual(await pins.locator('button').allTextContents(),['치과 기록','물품 관리','내 계정']);
 await pins.locator('[data-rail-favorite=purchases]').click();await p.waitForFunction(()=>CarestepPractice.route()==='purchases');if(process.env.MENU_SHOTS)await p.screenshot({path:path.join(process.env.MENU_SHOTS,'rail-'+width+'.png')});assert.equal(await pins.locator('[data-rail-favorite=purchases]').getAttribute('aria-current'),'page');await p.setViewportSize({width,height:550});await p.locator('.cs-nav-rail').getByRole('button',{name:'병원 설정',exact:true}).scrollIntoViewIfNeeded();assert.ok(await p.locator('.cs-nav-rail').evaluate(e=>e.scrollHeight>e.clientHeight));
 await p.evaluate(()=>{const old=saasPermission;saasPermission=(k,d)=>k==='purchases.read'?false:old(k,d);ClinicNavigation.sync('practice');});assert.equal(await pins.locator('[data-rail-favorite=purchases]').count(),0);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('carestep.navigation.favorites:'+JSON.stringify(['test','owner'])))),['dental','purchases','view:account:my']);
 await p.evaluate(()=>{saasMe={role:'staff',clinic:{id:'other'},user:{id:'other'}};ClinicNavigation.sync('dashboard');});assert.equal(await pins.isVisible(),false);
});
for(const hq of [false,true])test('category attention reflects permitted notices without adding counts '+hq,async t=>{
 const p=await setup(t,1440,hq),group=hq?'[data-hq-nav-group=clinic]':'[data-nav-group=guardians]',source=hq?'#navApprovalCount':'#navFollowupBadge';
 await p.evaluate(s=>{const e=document.querySelector(s);e.textContent='3';e.hidden=false;e.classList.remove('hidden');if(e.parentElement.classList.contains('nav-followup-status'))e.parentElement.hidden=false;},source);
 await p.waitForFunction(g=>document.querySelector(g+' .nav-group-attention')?.hidden===false,group);assert.equal(await p.locator(group+' .nav-group-attention').isVisible(),true);
 await p.locator(group+(hq?' [data-hq-nav-toggle]':'>summary')).click();assert.equal(await p.locator(group+' .nav-group-attention').isVisible(),false);
 await p.locator(group+(hq?' [data-hq-nav-toggle]':'>summary')).click();
 // HQ category buttons keep the chosen group open; close through another category.
 if(hq)await p.locator('[data-hq-nav-toggle=system]').click();
 await p.evaluate(s=>document.querySelector(s).closest('button').hidden=true,source);await p.waitForFunction(g=>document.querySelector(g+' .nav-group-attention').hidden,group);
 await p.evaluate(s=>{const e=document.querySelector(s);e.closest('button').hidden=false;e.textContent='0';},source);assert.equal(await p.locator(group+' .nav-group-attention').isVisible(),false);
 await p.evaluate(s=>{const e=document.querySelector(s);e.textContent='5';e.classList.add('hidden');},source);assert.equal(await p.locator(group+' .nav-group-attention').isVisible(),false);
});
for(const width of [390,1440])test('HQ dashboard opens directly from any group '+width,async t=>{
 const p=await setup(t,width,true);await p.evaluate(()=>showView('billing'));await menu(p,true,width);assert.equal(await p.locator('.hq-nav-main>[data-view=dashboard]').count(),1);if(process.env.MENU_SHOTS)await p.screenshot({path:path.join(process.env.MENU_SHOTS,'dashboard-menu-'+width+'.png')});await p.locator('.hq-nav-home').click();await p.waitForFunction(()=>document.querySelector('#dashboard').classList.contains('active'));assert.equal(await p.locator('.hq-nav-home').getAttribute('aria-current'),'page');assert.equal(await p.locator('[data-hq-nav-group].open').count(),0);if(width===390)assert.equal(await p.locator('#hqMenuToggle').getAttribute('aria-expanded'),'false');
});
