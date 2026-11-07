const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function fixture(t,width=1440){
 const p=await browser.newPage({viewport:{width,height:900}});p.setDefaultTimeout(7000);const errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(new URL(r.url()).pathname));
 await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url);await p.evaluate(()=>{
  saasMode='auth';saasToken='synthetic';saasSessionMeta={id:'local'};saasMe={role:'owner',clinic:{id:'local'},user:{id:'owner'}};
  saasRequest=async()=>({ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null});showApp({deferFullRender:true});
 });t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});return {p,requests};
}
async function goTab(p,key){await p.evaluate(key=>go('practice',{practiceTab:key}),key);}

for(const width of [390,1280,1600])test('dashboard context stays compact and library badges keep distinct information '+width,async t=>{
 const {p}=await fixture(t,width);await p.evaluate(()=>go('dashboard'));await p.locator('#clinicToday-tab-clinical').click();await p.waitForTimeout(150);await p.evaluate(()=>{workFirstFilter='all';clinicalLoadCheckedAt=Date.now();renderWorkFirstDashboard();});
 await p.locator('#clinicClinicalFreshness').waitFor({state:'visible'});
 assert.equal(await p.locator('#workFirstListTitle').isVisible(),false);
 assert.equal(await p.locator('.work-first-section-head #clinicClinicalFreshness').count(),1);
 assert.match(await p.locator('#workFirstListMeta').textContent(),/^\d+건$/);
 const height=await p.locator('.work-first-section-head').evaluate(el=>el.getBoundingClientRect().height);assert.ok(height<85,'toolbar height '+height);
 const cards=await p.evaluate(()=>{const sample=(category,purpose)=>({id:'test',title:'합성 자료',category,purpose,species:'dog'});return {duplicate:templateCategoryBadge(sample('수술시술'),'procedure'),different:templateCategoryBadge(sample('종양중증'),'procedure'),discharge:templateCategoryBadge(sample('입원퇴원'),'discharge'),education:templateCategoryBadge(sample('만성질환'),'education')};});
 assert.equal(cards.duplicate,'');assert.equal(cards.discharge,'');assert.match(cards.different,/종양/);assert.match(cards.education,/만성질환/);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:root+'/../clinic-redesign-preview/clarity-dashboard-'+width+'.png'});
});
for(const tab of ['dental','neuro','ophthalmic','chronic'])test('one loading label and no placeholder controls '+tab,async t=>{
 const {p}=await fixture(t);let release;const gate=new Promise(r=>release=r);const file={dental:'dental-record',neuro:'neuro-record',ophthalmic:'ophthalmic-record',chronic:'chronic-record'}[tab];
 await p.route('**/'+file+'.js?*',async r=>{await gate;await r.continue();});
 try{await goTab(p,tab);await p.locator('.cs-record-placeholder').waitFor();assert.equal(await p.locator('[data-notice]').innerText(),'화면을 불러오는 중…');assert.equal(await p.locator('.cs-record-placeholder button,.cs-record-placeholder input,.cs-record-placeholder select').count(),0);assert.equal(await p.locator('.cs-record-placeholder').getAttribute('aria-hidden'),'true');assert.equal(await p.locator('.cs-record-navigation button[data-record-tab]').count(),5);assert.equal(await p.locator('.cs-record-placeholder').innerText(),'');}
 finally{release();}
 await p.waitForFunction(tab=>!ClinicLazyModules.needs(tab),tab);await p.waitForFunction(()=>!document.querySelector('.cs-record-placeholder'));
 assert.equal(await p.locator('.cs-record-navigation button[data-record-tab]').count(),5);
});
