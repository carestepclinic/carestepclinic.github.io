const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let server,browser,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function page(tab,width=1440){const p=await browser.newPage({viewport:{width,height:950}});p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);await p.evaluate(()=>{window.testRequests=[];saasMode='auth';saasToken='synthetic-local-token';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};saasRequest=async(p,o)=>{testRequests.push({p,o});return {ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,userId:'owner',manager:true,next:null};};showApp({deferFullRender:true});go('practice');});await p.evaluate(tab=>go('practice',{practiceTab:tab}),tab);await p.locator('form[data-list-layout],form.er-filters').waitFor();await p.waitForTimeout(120);return {p,errors};}

for(const width of [390,1440])test('all record toolbars have identical typography '+width,async()=>{
 const snapshots=[];
 for(const tab of ['surgery','dental','neuro','ophthalmic','chronic']){
  const {p,errors}=await page(tab,width);try{
   const values=await p.locator('.cs-list-actionbar button,.er-list-actions button').evaluateAll(es=>es.filter(e=>e.offsetWidth).map(e=>{const s=getComputedStyle(e);return {text:e.textContent.trim(),font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,line:s.lineHeight,radius:s.borderRadius,height:e.getBoundingClientRect().height};}));
   assert.ok(values.length>=7,JSON.stringify(values));for(const b of values){assert.equal(b.size,'14px');assert.equal(b.weight,'600');assert.equal(b.height,width<800?44:40,JSON.stringify(b));}
   snapshots.push(values[0].font);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   if(tab==='surgery')await p.screenshot({path:root+'/../clinic-redesign-preview/toolbar-'+width+'.png'});
  }finally{await p.close();}
 }
 assert.equal(new Set(snapshots).size,1);
});
for(const [width,columns] of [[390,1],[1440,2],[1920,3]])test('vendor orders responsive groups '+width,async()=>{
 const {p,errors}=await page('surgery',width);try{
 await p.evaluate(async()=>{
  const host=document.createElement('section');document.getElementById('practiceRoot').replaceChildren(host);
  const vendors=[{id:'v1',name:'가나다 긴 거래처명 동물의약품 및 의료소모품 공급회사',active:true,url:'https://example.invalid',phone:'02-1234-5678'},{id:'v2',name:'나무 공급사',active:true},{id:'v3',name:'다온 공급사',active:true},{id:'v4',name:'라온 공급사',active:true}];
  const data={revision:0,userId:'owner',manager:true,categories:[{id:'a',name:'의약품',active:true}],vendors,items:vendors.map((v,i)=>({id:'i'+i,name:i===0?'긴 제품명 주사용 소모품 규격 확인용 합성 자료':'합성 물품 '+i,categoryId:'a',vendorId:v.id,status:'needed',quantity:2,unit:'개',spec:'100 mg',requester:'시험 담당자',urgent:i===0,events:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))};
  window.supplies=ClinicPurchases.mount(host,{identity:()=> 'test',ready:()=>true,request:async()=>structuredClone(data)});await supplies.open();
 });
 await p.locator('[data-group=vendor]').click();const sections=p.locator('.purchase-section');assert.equal(await sections.count(),4);
 const boxes=await sections.evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width};}));assert.equal(boxes.filter(b=>Math.abs(b.y-boxes[0].y)<2).length,columns,JSON.stringify(boxes));
 await p.locator('[data-group-select=v1]').check();assert.equal(await p.locator('[data-select=i0]').isChecked(),true);assert.equal(await p.locator('[data-select=i1]').isChecked(),false);assert.equal(await p.locator('[data-group-copy=v1]').isEnabled(),true);
 await p.locator('.purchase-section').first().locator('summary').first().click();assert.equal(await p.locator('[data-select=i0]').isVisible(),false);await p.locator('.purchase-section').first().locator('summary').first().click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const overflow=await p.locator('.purchase-section').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.textContent));assert.deepEqual(overflow,[]);
 await p.screenshot({path:root+'/../clinic-redesign-preview/vendors-'+width+'.png'});
 await p.locator('[data-group=category]').click();assert.equal(await p.locator('.purchase-section').count(),1);assert.equal(await p.locator('[data-select=i0]').isChecked(),true);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
