const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let server,browser,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function page(tab,width=1440){const p=await browser.newPage({viewport:{width,height:950}});p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);await p.evaluate(()=>{window.testRequests=[];saasMode='auth';saasToken='synthetic-local-token';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};saasRequest=async(p,o)=>{testRequests.push({p,o});return {ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,userId:'owner',manager:true,next:null};};showApp({deferFullRender:true});go('practice');});await p.evaluate(tab=>go('practice',{practiceTab:tab}),tab);await p.locator('form[data-list-layout],form.er-filters').waitFor();await p.waitForTimeout(120);return {p,errors};}

for(const tab of ['surgery','dental','neuro','ophthalmic','chronic'])for(const width of [390,1440])test('always visible record navigation '+tab+' '+width,async()=>{
 const {p,errors}=await page(tab,width);try{
  assert.equal(await p.locator('.cs-record-switcher summary').count(),0);
  const nav=p.locator('.cs-record-navigation');assert.ok(await nav.isVisible());assert.equal(await nav.locator('button:not([data-cs-inpatient])').count(),5);
  for(const b of await nav.locator('button:not([data-cs-inpatient])').all())assert.ok(await b.isVisible());
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await nav.getByRole('button',{name:tab==='dental'?'마취':'치과',exact:true}).click();
  await p.waitForTimeout(180);assert.equal(await p.locator('.cs-record-navigation').count(),1);
  assert.equal(await p.locator('.cs-record-navigation button[aria-pressed=true]').innerText(),tab==='dental'?'마취':'치과');assert.deepEqual(errors,[]);
  if(tab==='dental')await p.screenshot({path:root+'/../clinic-redesign-preview/visible-records-'+width+'.png'});
 }finally{await p.close();}
});
