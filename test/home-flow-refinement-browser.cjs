const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{let checks=0,reads=[],failCustom=0,failMedication=0,phone='031-123-4567',phoneState='ready',materials=[{id:'m',patientId:'p',title:'가상 안내자료',text:'가상 본문입니다.',kind:'guidance',sentAt:'2026-11-08T10:00:00+09:00'}],delay=0,failText=0,failPdf=0,members=true,weightCount=1;
const day=new Date(Date.now()+32400000).toISOString().slice(0,10);
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(root,p==='/'?'home.html':p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('https://carestep-ai-api.kk04sdw.workers.dev/**',async route=>{const u=new URL(route.request().url());reads.push(u.pathname);let status=200,body={ok:true,items:[],materials:[],events:[],doses:[],plans:[],reminders:[],occurrences:[],summary:{},date:day,enabled:false};
if(u.pathname==='/home/me')body={ok:true,home:{user:{id:'u',displayName:'가상 보호자'},consentRequired:false,connections:members?[{id:'c',clinicId:'c',clinicName:'가상 병원',clinicPhone:phone,clinicPhoneState:phoneState,patients:[{id:'p',name:'가상 코코',species:'dog'},{id:'q',name:'가상 나비',species:'cat'}]}]:[]}};
if(u.pathname.endsWith('/custom-reminders')&&failCustom){status=failCustom;body={ok:false,error:'synthetic failure'};}
if(u.pathname.endsWith('/medications')){status=failMedication||200;body=failMedication?{ok:false,error:'synthetic failure'}:{ok:true,doses:[{id:'d',planId:'plan',patientId:'p',date:day,time:'23:59',label:'가상 복약',taken:false}],plans:[]};}
if(u.pathname.endsWith('/timeline'))body={ok:true,events:[{id:'w',type:'weight',eventDate:day,value:4.2},...(weightCount===2?[{id:'w2',type:'weight',eventDate:'2020-01-01',value:4}]:[])]};
if(u.pathname==='/home/r61/materials'&&route.request().method()==='GET'){await new Promise(r=>setTimeout(r,delay));status=failText||200;body=failText?{ok:false,error:'test unavailable'}:{ok:true,materials};}
if(u.pathname==='/home/r113/materials'){status=failPdf||200;body=failPdf?{ok:false,error:'test unavailable'}:{ok:true,materials:[]};}
await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/home.html');await page.evaluate(()=>localStorage.setItem('carestep_home_session_v1','synthetic'));await page.reload();await page.waitForFunction(()=>window.carestepHomeCare?.context().patientId==='p'&&document.querySelector('[data-material-key="p|m"]'));checks++;

const check=(value,expected)=>{assert.deepEqual(value,expected);checks++;};
await page.waitForFunction(()=>window.carestepHomeReminderSummary?.().state==='ready');
await page.evaluate(()=>{window.carestepHomeNavigation.go('schedule',{target:'homeCarePatients'});window.carestepHomeNavigation.go('home');});
await page.locator('[data-remaining-custom]').click();
check(await page.locator('#homeCustomReminders').isVisible(),true);
check(await page.locator('[data-schedule-tab="custom"]').getAttribute('aria-selected'),'true');
await page.evaluate(()=>window.carestepHomeNavigation.go('home'));
await page.locator('[data-remaining-med]').click();
check(await page.locator('#homeCarePatients').isVisible(),true);
check(await page.locator('[data-schedule-tab="medication"]').getAttribute('aria-selected'),'true');
await page.evaluate(()=>{window.carestepHomeNavigation.go('schedule',{target:'homeCustomReminders'});window.carestepHomeCare.openMedicationPlans('p');});
check(await page.locator('#homeCarePatients').isVisible(),true);
await page.evaluate(()=>window.carestepHomeNavigation.go('home'));
failCustom=503;await page.evaluate(()=>window.carestepRefreshHomeReminders());
await page.waitForFunction(()=>document.querySelector('#homeNavigationNextNote')?.dataset.action==='retry');
check(await page.locator('#homeNavigationNextNote').isVisible(),true);
reads=[];failCustom=0;
await page.locator('#homeNavigationNextNote').click();
await page.waitForFunction(()=>window.carestepHomeReminderSummary().state==='ready');
check(reads.filter(x=>x.endsWith('/custom-reminders')).length,1);
check(reads.some(x=>x.endsWith('/medications')||x.includes('/materials')),false);
check(await page.locator('#homeNavigationNextNote').isVisible(),false);
// A failed medication request retries medication alone, without downloading the timeline.
failMedication=503;await page.evaluate(()=>window.carestepHomeCare.refreshMedication());
// Full refresh sets the failed-source summary while retaining previously displayed values.
await page.evaluate(()=>window.carestepHomeCare.refresh());
await page.waitForFunction(()=>window.carestepHomeCare.context().medicationSummary.state==='failed');
failMedication=0;reads=[];
await page.locator('#homeNavigationNext').click();
await page.waitForFunction(()=>window.carestepHomeCare.context().medicationSummary.state==='ready');
check(reads.filter(x=>x.endsWith('/medications')).length,1);
check(reads.some(x=>x.endsWith('/timeline')),false);
reads=[];await page.evaluate(()=>window.carestepHomeNavigation.refreshCurrent());
check(reads.filter(x=>x==='/home/followups').length,1);
check(reads.some(x=>x.includes('/materials')),false);
// The home warning has one destination label rather than repeating its call to action.
await page.evaluate(()=>window.carestepHomeCare.setPushStatus({kind:'unsupported'}));
check(await page.locator('#homeNavigationSettingsButton').textContent(),'설정');
check((await page.locator('[data-remaining-custom]').textContent()).includes('직접 만든 알림'),true);
await page.evaluate(()=>window.carestepHomeNavigation.go('hospital'));
check(await page.locator('#r61-home-materials > h2').isVisible(),false);
materials=[];await page.evaluate(()=>window.carestepRefreshHomeMaterials());
check(await page.locator('.home-material-controls').isVisible(),false);
check(await page.locator('.home-material-empty').isVisible(),true);
// Empty search results keep controls so the guardian can clear the query.
materials=[{id:'m2',patientId:'p',title:'가상 두번째 안내',text:'가상 내용',kind:'guidance',sentAt:new Date().toISOString()}];
await page.evaluate(()=>window.carestepRefreshHomeMaterials());
check(await page.locator('.home-material-controls').isVisible(),true);
await page.locator('.home-material-controls input').fill('찾을 수 없는 이름');
check(await page.locator('.home-material-controls').isVisible(),true);
await page.locator('.home-material-controls input').fill('');
// A failed empty read must retain its retry affordance.
materials=[];failPdf=503;await page.evaluate(()=>window.carestepRefreshHomeMaterials());
check(await page.locator('.home-material-controls').isVisible(),true);
failPdf=0;await page.evaluate(()=>window.carestepRefreshHomeMaterials());
for(const width of [390,1280]){await page.setViewportSize({width,height:844});await page.screenshot({path:path.join(root,'..','home-round5-hospital-'+width+'.png'),fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);}
check(errors,[]);
console.log(JSON.stringify({ok:true,checks,errors}));await context.close();}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
