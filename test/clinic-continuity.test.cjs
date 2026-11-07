const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let server,browser,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function page(tab,width=1440){const p=await browser.newPage({viewport:{width,height:950}});p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);await p.evaluate(()=>{window.testRequests=[];saasMode='auth';saasToken='synthetic-local-token';saasSessionMeta={id:'test'};saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'}};saasRequest=async(p,o)=>{testRequests.push({p,o});return {ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,userId:'owner',manager:true,next:null};};showApp({deferFullRender:true});go('practice');});await p.evaluate(tab=>go('practice',{practiceTab:tab}),tab);await p.locator('form[data-list-layout],form.er-filters').waitFor();await p.waitForTimeout(350);return {p,errors};}

for(const tab of ['surgery','dental','neuro','ophthalmic','chronic'])for(const width of [390,1440])test('record toolbar survives asynchronous list refresh '+tab+' '+width,async()=>{
 const {p,errors}=await page(tab,width);try{
  for(let i=0;i<2;i++){
   assert.equal(await p.locator('.cs-record-navigation').count(),1);assert.ok(await p.locator('.cs-record-navigation').isVisible());
   assert.equal(await p.locator('[data-cs-inpatient]').count(),1);assert.ok(await p.locator('[data-cs-inpatient]').isVisible());
   const actions=p.locator('.cs-list-actionbar,.er-list-actions').filter({has:p.getByRole('button',{name:/새 .*기록/})}).first();
   const box=await actions.boundingBox(),buttons=await actions.locator(':scope>button').evaluateAll(es=>es.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,y:e.getBoundingClientRect().y})));
   assert.ok(buttons.length>=2,JSON.stringify(buttons));assert.ok(Math.abs(buttons[0].y-buttons[1].y)<2);assert.ok(Math.abs(buttons[1].right-box.x-box.width)<3,JSON.stringify({box,buttons}));
   await p.getByRole('button',{name:'새로고침',exact:true}).last().click();await p.waitForTimeout(350);
  }
  const next=tab==='dental'?'neuro':'dental';await p.locator('.cs-record-navigation [data-record-tab='+next+']').click();await p.waitForTimeout(450);assert.equal(await p.locator('.cs-record-navigation').count(),1);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
for(const width of [390,1440])test('calculator patient entry is a keyboard-operable search button '+width,async()=>{
 const {p,errors}=await page('dental',width);try{
 await p.evaluate(()=>go('practice',{practiceTab:'calc'}));const button=p.locator('[data-common-inputs] button.cs-patient-picker');await button.waitFor();assert.equal(await button.textContent(),'환자 불러오기');
 await button.focus();await button.press('Enter');assert.equal(await p.locator('.pt-patient-options').getAttribute('open'),'');assert.ok(await p.locator('[data-patient-picker] input').first().isVisible());
 await p.evaluate(()=>{const el=document.querySelector('[data-patient-summary]');el.textContent='시험 환자';el.dataset.patientSelected='true';el.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(80);assert.equal(await button.textContent(),'환자 변경');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
for(const width of [390,1440])test('preventive grouping shares identity and assignment but preserves each record action '+width,async()=>{
 const {p,errors}=await page('dental',width);try{
 await p.evaluate(()=>go('dashboard'));await p.waitForTimeout(500);
 await p.evaluate(()=>{
 window.groupRows=[{id:'a',eventId:'a',sourceType:'vaccination',patientId:'p',guardianId:'g',patientName:'시험 환자',guardianName:'시험 보호자',title:'종합백신',dueDate:'2026-11-07',action:{}},{id:'b',eventId:'b',sourceType:'heartworm',patientId:'p',guardianId:'g',patientName:'시험 환자',guardianName:'시험 보호자',title:'심장사상충 예방',dueDate:'2026-11-07',action:{}}];careOperationsTeam=[{userId:'t',displayName:'시험 담당'}];renderWorkFirstRows(document.getElementById('workFirstList'),groupRows,12);
 document.getElementById('clinicToday-tab-clinical')?.click();window.quickCalls=[];workFirstOpenQuickRecord=async(item,type)=>quickCalls.push({id:item.id,type});
 });
 const group=p.locator('.cs-preventive-group');await group.waitFor();if(width>1000)assert.ok((await group.locator('.work-first-main').first().boundingBox()).width>250);assert.equal(await group.locator('.work-first-when').count(),0);assert.equal(await group.locator('[data-work-record="weight"]').count(),1);assert.equal(await group.locator('[data-work-record="vaccination"],[data-work-record="heartworm"]').count(),2);
 await p.screenshot({path:path.resolve(root,'../continuity-work-'+width+'.png'),fullPage:true});assert.equal((await group.innerText()).split('시험 보호자').length-1,1);await group.locator('[data-work-record="heartworm"]').click();assert.deepEqual(await p.evaluate(()=>quickCalls),[{id:'b',type:'heartworm'}]);
 await p.evaluate(()=>{window.assignmentCalls=[];saasRequest=async(path,options)=>{assignmentCalls.push({path,body:JSON.parse(options.body)});return {ok:true}};loadFollowupScheduleBoard=async()=>true;careSignalOperationsChanged=()=>{};});await group.locator('[data-work-group-assign]').selectOption('t');await p.waitForTimeout(100);
 assert.equal(await p.evaluate(()=>assignmentCalls.length),2);assert.ok(await p.evaluate(()=>assignmentCalls.every(x=>x.body.status==='in_progress'&&x.body.assignee==='시험 담당')));
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
test('group assignment stops on failure and ignores stale account responses',async()=>{
 const {p}=await page('dental');try{const result=await p.evaluate(async()=>{
 careOperationsTeam=[{userId:'t',displayName:'시험 담당'}];careSignalOperationsChanged=()=>{};loadFollowupScheduleBoard=async()=>true;let calls=0;saasRequest=async()=>{calls++;throw Error('실패')};const items=[{eventId:'a',sourceType:'vaccination'},{eventId:'b',sourceType:'heartworm'}];await workFirstAssignGroup(items,'t');const failed=calls;calls=0;saasRequest=async()=>{calls++;saasMe={...saasMe,clinic:{id:'other'}};return {ok:true}};await workFirstAssignGroup(items,'t');return {failed,changed:calls};});assert.deepEqual(result,{failed:1,changed:1});}finally{await p.close();}
});

for(const width of [390,1440])test('ward shows today and old measurement dates without changing values '+width,async()=>{
 const {p,errors}=await page('dental',width);try{
 await p.evaluate(()=>{const old=saasRequest,now=new Date().toISOString(),past=new Date(Date.now()-9*86400000).toISOString();const item={id:'ward-test',kind:'admission',status:'active',revision:1,patient:{name:'시험 입원환자',species:'cat'},body:{species:'cat',weight:4,tasks:[],orders:[],infusions:[],wardChecks:[],wardVitals:{weightKG:{value:4,observedAt:now},temperature:{value:38.5,observedAt:now},heartRate:{value:130,observedAt:past}}}};saasRequest=async(path,o)=>path.endsWith('/clinical/rooms')?{items:[{id:'cat1',name:'고양이 01',kind:'cat',patientCase:item}]}:old(path,o);go('practice',{practiceTab:'ward'});});
 const card=p.locator('.cc-occupied').first();await card.waitFor();assert.match(await card.innerText(),/이전 측정 · 9일 전/);assert.match(await card.innerText(),/오늘/);assert.match(await card.innerText(),/130/);assert.match(await card.innerText(),/38.5/);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await p.screenshot({path:path.resolve(root,'../continuity-ward-'+width+'.png'),fullPage:true});
 }finally{await p.close();}
});
