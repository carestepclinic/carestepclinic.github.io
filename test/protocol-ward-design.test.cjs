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



for(const width of [390,768,1600])test('protocol design and ward toolbar '+width,async t=>{
 const {p}=await fixture(t,width);
 await p.evaluate(()=>{const old=saasRequest;saasRequest=async path=>{const r=await old(path);if(path.includes('knowledge-protocols'))r.items=[{id:'sample',title:'각막궤양 검사와 재검 계획',category:'ophthalmology',species:'both',reviewed_at:'2026-11-01',status:'published'}];if(path.endsWith('/rooms'))r.items=[{id:'room1',name:'강아지 입원실 01',kind:'dog',status:'available'}];return r;};});
 await goTab(p,'protocols');await p.locator('.cl-protocol-card').waitFor();
 const source=p.locator('[data-protocol-source="common"]');assert.equal(await source.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(25, 118, 110)');
 const fav=p.locator('[data-protocol-favorite]');await fav.click();assert.equal(await fav.getAttribute('aria-pressed'),'true');
 await p.locator('[data-protocol-quick="favorites"]').click();assert.equal(await p.locator('.cl-protocol-card').count(),1);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:root+'/../clinic-redesign-preview/protocol-design-'+width+'.png'});
 await goTab(p,'ward');const controls=p.locator('.cs-ward-controls');await controls.waitFor();
 assert.equal(await controls.evaluate(e=>e.firstElementChild.classList.contains('cl-tabs')),true);
 assert.equal(await p.locator('.cs-ward-actions [data-cl-action="refresh"]').evaluate(e=>e.previousElementSibling.classList.contains('cl-board-count')),true);
 if(width===1600){const tabs=await controls.locator('.cl-tabs').boundingBox(),counts=await controls.locator('.cl-board-count').boundingBox();assert.ok(counts.x>tabs.x+tabs.width);assert.ok(Math.abs(counts.y-tabs.y)<25);}
 await controls.locator('[data-id="timeline"]').click();await p.locator('.cs-ward-controls [data-id="rooms"]').click();
 await p.locator('.cs-ward-actions [data-cl-action="refresh"]').click();await p.locator('.cs-ward-actions [data-cl-action="refresh"]:not([disabled])').waitFor();
 assert.equal(await p.locator('.cs-ward-actions [data-cl-action="refresh"]').evaluate(e=>e.previousElementSibling.classList.contains('cl-board-count')),true);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:root+'/../clinic-redesign-preview/ward-alignment-'+width+'.png'});
});

