const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{groupIncidents}=require('../hq-incidents.js');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>{await browser?.close();});
const base={clinicId:'a',clinicName:'가상 병원 A',area:'api:/saas/recovery',code:'500',message:'D1_ERROR: no such column: x.clinic_id at offset 329: SQLITE_ERROR',severity:'error',status:'open'};
const rows=()=>[0,1,2].map(i=>({...base,id:'incident-'+i,createdAt:'2026-11-14T01:0'+i+':00Z',updatedAt:'2026-11-14T10:00:00Z'}));
test('groups identical incidents without mixing clinics, status, severity or different errors',()=>{
 const input=rows(),variants=[{clinicId:'b'},{status:'resolved'},{severity:'warning'},{message:'different error'},{area:'api:/other'},{code:'502'}].map((extra,i)=>({...input[0],id:'other-'+i,...extra}));
 const copy=JSON.stringify(input),groups=groupIncidents([...input,input[0],...variants]);assert.equal(groups.length,7);assert.equal(groups.find(x=>x.count===3).rows.length,3);assert.equal(JSON.stringify(input),copy);assert.equal(groups.at(-1).status,'resolved');
});
test('first and last occurrence use original occurrence times instead of update or resolution time',()=>{
 const group=groupIncidents(rows().reverse())[0];assert.equal(group.firstAt,'2026-11-14T01:00:00Z');assert.equal(group.lastAt,'2026-11-14T01:02:00Z');assert.equal(group.rows[0].id,'incident-2');assert.equal(groupIncidents([]).length,0);
});
async function fixture(t,width){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});
 await p.route('**/*',r=>{const u=new URL(r.request().url()),f=path.resolve(root,'.'+u.pathname);if(u.hostname==='localhost'&&f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.woff2')?'font/woff2':'text/html'});return r.abort();});
 await p.goto('http://localhost/hq.html');
 await p.evaluate(data=>{
  window.incidentFixture=data;window.reads=[];window.writes=[];window.failWrite=false;window.holdWrite=false;hqSessionToken=()=> 'synthetic';
  req=async(url,options)=>{
   if(options?.method==='PATCH'){
    writes.push({url,body:JSON.parse(options.body)});if(holdWrite)await new Promise(r=>window.releaseWrite=r);if(failWrite)throw Error('가상 저장 실패');
    const id=decodeURIComponent(url.split('/').at(-1));incidentFixture.find(x=>x.id===id).status=JSON.parse(options.body).status;return {ok:true};
   }
   reads.push(url);
   if(url.startsWith('/hq/incidents?')){const status=new URL(url,'http://localhost').searchParams.get('status');return {incidents:incidentFixture.filter(x=>status==='all'||x.status===status)};}
   if(url==='/hq/production-launch')return {security:{checks:[]},checklist:{state:{}},operations:{openIncidents:incidentFixture.filter(x=>x.status==='open').length}};
   if(url==='/hq/clinics?status=all&approval=all')return {clinics:[]};
   if(url==='/hq/deletion-requests')return {requests:[]};
   return {};
  };
  document.getElementById('loginOverlay').classList.add('hidden');showView('production');
 },rows());
 await p.locator('.hq-incident-group').waitFor();return p;
}
for(const width of [390,1440])test('HQ collapses repeated errors, shows range and preserves responsive readability '+width,async t=>{
 const p=await fixture(t,width);assert.equal(await p.locator('.hq-incident-group').count(),1);
 assert.match(await p.locator('.hq-incident-summary').innerText(),/3건.*1묶음/);assert.match(await p.locator('.hq-incident-count').innerText(),/3회/);
 assert.match(await p.locator('.hq-incident-times').innerText(),/최초.*최근/s);assert.match(await p.locator('.hq-incident-scope').innerText(),/현재 조회 범위.*500건/);
 assert.ok(await p.evaluate(()=>reads.some(x=>x.includes('/hq/incidents?')&&x.includes('limit=500'))));
 assert.equal(await p.locator('.hq-incident-records').isVisible(),false);await p.locator('.hq-incident-group>summary').click();assert.equal(await p.locator('.hq-incident-records li').count(),3);
 assert.equal(await p.locator('.hq-incident-code').evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');assert.equal(await p.locator('.hq-incident-heading .status').evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
 await p.evaluate(()=>renderProductionIncidents());assert.equal(await p.locator('.hq-incident-group').getAttribute('open'),'');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(await p.evaluate(()=>writes),[]);
 await p.locator('#productionIncidentRows').screenshot({path:'/tmp/recovery-hq-'+width+'.png'});
});
test('individual resolution and reopening target only the chosen original event',async t=>{
 const p=await fixture(t,1440);await p.locator('.hq-incident-group>summary').click();await p.locator('[data-incident-id="incident-1"]').click();
 await p.waitForFunction(()=>document.querySelector('.hq-incident-count').textContent.includes('2회'));
 assert.deepEqual(await p.evaluate(()=>writes),[{url:'/hq/incidents/incident-1',body:{status:'resolved'}}]);assert.equal(await p.locator('.hq-incident-group').count(),1);
 await p.locator('#incidentFilter').selectOption('all');await p.waitForFunction(()=>document.querySelectorAll('.hq-incident-group').length===2);
 const done=p.locator('.hq-incident-group').filter({has:p.locator('[data-incident-id="incident-1"]')});await done.locator('summary').click();await p.locator('[data-incident-id="incident-1"]').click();
 await p.waitForFunction(()=>document.querySelectorAll('.hq-incident-group').length===1&&document.querySelector('.hq-incident-count').textContent.includes('3회'));
 assert.deepEqual(await p.evaluate(()=>writes.at(-1)),{url:'/hq/incidents/incident-1',body:{status:'open'}});
});
test('failed pending action cannot duplicate writes or hide original evidence',async t=>{
 const p=await fixture(t,1440);await p.locator('.hq-incident-group>summary').click();await p.evaluate(()=>{holdWrite=true;failWrite=true;});
 const b=p.locator('[data-incident-id="incident-2"]');await b.click();await p.waitForFunction(()=>typeof releaseWrite==='function');assert.equal(await b.isDisabled(),true);
 await p.evaluate(()=>{renderProductionIncidents();document.querySelector('[data-incident-id="incident-2"]').click();});assert.equal(await p.evaluate(()=>writes.length),1);
 await p.evaluate(()=>releaseWrite());await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('가상 저장 실패'));
 assert.equal(await p.locator('.hq-incident-records li').count(),3);assert.match(await p.locator('.hq-incident-count').innerText(),/3회/);assert.equal(await p.locator('[data-incident-id="incident-2"]').isDisabled(),false);
});
test('escaped error text remains visible without becoming markup, and empty results are explicit',async t=>{
 const p=await fixture(t,390);const value='<img src=x onerror="window.incidentInjected=true">';
 await p.evaluate(message=>{productionIncidents=[{...incidentFixture[0],message}];renderProductionIncidents();},value);
 assert.equal(await p.locator('.hq-incident-message').innerText(),value);assert.equal(await p.locator('#productionIncidentRows img').count(),0);assert.equal(await p.evaluate(()=>window.incidentInjected),undefined);
 await p.evaluate(()=>{productionIncidents=[];renderProductionIncidents();});assert.equal(await p.locator('.hq-incident-group').count(),0);assert.match(await p.locator('.hq-incident-summary').innerText(),/조건에 맞는 장애로그가 없습니다/);
});
