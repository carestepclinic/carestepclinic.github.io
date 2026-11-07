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
  window.calls=[];saasRequest=async(path)=>{window.calls.push(path);return ({categories:[],vendors:[],assignments:[],actor:{capabilities:{edit:true,review:true,manage:true}},revision:1,ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null});};showApp({deferFullRender:true});
 });t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});return {p,requests};
}
async function goTab(p,key){await p.evaluate(key=>go('practice',{practiceTab:key}),key);}


for(const width of [390,768,1600])test('refresh toolbars remain compact and functional '+width,async t=>{
 const {p}=await fixture(t,width);
 await goTab(p,'protocols');
 const refresh=p.locator('.cl-protocol-shortcuts [data-cl-action="refresh"]');await refresh.waitFor();
 assert.equal(await p.locator('.cl-toolbar').isVisible(),false);
 assert.equal(await refresh.evaluate(e=>e.previousElementSibling.textContent),'최근 열람');
 const before=await p.evaluate(()=>calls.length);await refresh.click();assert.ok(await p.evaluate(n=>calls.length>n,before));
 await p.mouse.move(0,0);await p.screenshot({path:root+'/../clinic-redesign-preview/refresh-protocols-'+width+'.png'});const style=await refresh.evaluate(e=>{let s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.height,s.borderRadius,s.backgroundColor];});
 await p.evaluate(()=>go('training'));const training=p.locator('#training .st-tabs [data-st="refresh"]');await training.waitFor();
 assert.equal(await p.locator('#training .st-heading').isVisible(),false);
 assert.equal(await p.locator('#training [data-st="refresh"]').count(),1);
 assert.deepEqual(await training.evaluate(e=>{let s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.height,s.borderRadius,s.backgroundColor];}),style);
 await training.click();await training.waitFor();
 await p.evaluate(()=>go('training',{trainingSection:'sop'}));await training.waitFor();assert.match(await p.locator('#training .st-tabs').innerText(),/업무지침/);await p.screenshot({path:root+'/../clinic-redesign-preview/refresh-sop-'+width+'.png'});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await goTab(p,'purchases');const purchase=p.locator('.purchase-toolbar [data-refresh]');await purchase.waitFor();
 assert.equal(await p.locator('.purchase-actions .purchase-status-row').count(),1);
 if(width===1600){const r=await purchase.boundingBox(),c=await p.locator('[data-create]').boundingBox();assert.ok(Math.abs(r.y-c.y)<5);}
 await p.locator('.purchase-searchbar [data-query]').fill('검색 유지');await purchase.click();assert.equal(await p.locator('.purchase-searchbar [data-query]').inputValue(),'검색 유지');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:root+'/../clinic-redesign-preview/refresh-purchases-'+width+'.png'});
 await goTab(p,'surgery');const anesthesia=p.locator('#practiceRoot [data-cl-action="refresh"]');await anesthesia.waitFor();
 assert.deepEqual(await anesthesia.evaluate(e=>{let s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.height,s.borderRadius,s.backgroundColor];}),style);
});
