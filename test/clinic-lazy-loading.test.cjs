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
for(const width of [390,1440])test('healthcheck integrated menu, lazy loading and retained draft '+width,async t=>{
 const {p,requests}=await fixture(t,width);await goTab(p,'healthcheck');await p.locator('[data-action=new]').waitFor();
 await p.locator('[data-action=new]').click();await p.locator('[data-start-field=name]').fill('가상 검진 환자');
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();await goTab(p,'healthcheck');
 assert.equal(await p.locator('[data-start-field=name]').inputValue(),'가상 검진 환자');
 assert.equal(requests.filter(x=>x==='/healthcheck-record.js').length,1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await p.screenshot({path:path.join(root,'../healthcheck-integrated-'+width+'.png'),fullPage:true});
});
for(const width of [390,1440])test('initial load omits optional modules, first record loads once '+width,async t=>{
 const {p,requests}=await fixture(t,width);assert.equal(requests.some(x=>/\/(dental-record|chronic-record|practice-emergency)\.js/.test(x)),false);
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,1);assert.equal(requests.includes('/chronic-record.js'),false);
 await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(process.env.REVIEW_SHOTS)await p.screenshot({path:path.join(process.env.REVIEW_SHOTS,'clinic-lazy-'+width+'.png')});
});
test('late module response cannot replace a newer record tab',async t=>{
 const {p}=await fixture(t);let release;const gate=new Promise(r=>release=r);await p.route('**/dental-record.js?*',async r=>{await gate;await r.continue();});
 await goTab(p,'dental');await p.locator('[data-notice]').filter({hasText:'화면을 불러오는 중'}).waitFor();await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();release();await p.waitForFunction(()=>!!window.DentalRecord);
 assert.equal(await p.evaluate(()=>CarestepPractice.route()),'neuro');assert.equal(await p.locator('[data-nr=new]').count(),1);assert.equal(await p.locator('[data-dn=new]').count(),0);
});
test('failed optional file is retryable without duplicate handlers',async t=>{
 const {p,requests}=await fixture(t);let fail=true;await p.route('**/dental-record.js?*',r=>fail?r.abort():r.continue());
 await goTab(p,'dental');await p.locator('[data-notice] button').waitFor();fail=false;await p.locator('[data-notice] button').click();await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,2);assert.equal(await p.locator('[data-dn=new]').count(),1);
});
test('identity removal during loading does not restore the prior workspace',async t=>{
 const {p}=await fixture(t);let release;const gate=new Promise(r=>release=r);await p.route('**/dental-record.js?*',async r=>{await gate;await r.continue();});await goTab(p,'dental');await p.locator('[data-notice]').filter({hasText:'화면을 불러오는 중'}).waitFor();await p.evaluate(()=>{saasMe=null;saasToken='';CarestepPractice.clear();});release();await p.waitForFunction(()=>!!window.DentalRecord);assert.equal(await p.locator('[data-dn=new]').count(),0);
});
test('calculator optional definitions load together and are reused',async t=>{
 const {p,requests}=await fixture(t);await goTab(p,'calc');await p.waitForFunction(()=>window.ClinicLazyModules&&!ClinicLazyModules.needs('calc'));await p.waitForFunction(()=>document.querySelector('[data-body]')?.textContent.includes('응급'));
 for(const file of ['practice-emergency.js','practice-nutrition.js','practice-calcium-transfusion.js'])assert.equal(requests.filter(x=>x==='/'+file).length,1);
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();await goTab(p,'calc');assert.equal(requests.filter(x=>x==='/practice-emergency.js').length,1);
});

test('chronic choices module loads in dependency order and survives navigation reuse',async t=>{const {p,requests}=await fixture(t);await goTab(p,'chronic');await p.locator('[data-act=new]').waitFor();assert.equal(await p.evaluate(()=>typeof ChronicChoices.setup),'function');assert.equal(requests.filter(x=>x==='/chronic-choices.js').length,1);assert.ok(requests.indexOf('/chronic-choices.js')<requests.indexOf('/chronic-record.js'));await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();await goTab(p,'chronic');await p.locator('[data-act=new]').waitFor();assert.equal(requests.filter(x=>x==='/chronic-choices.js').length,1);});
