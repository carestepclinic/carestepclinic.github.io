const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{let followupItems,checks=0,reads=[],failRespond=0,failCustom=0,failMedication=0,failFollowup=0,followupDelay=0,phone='031-123-4567',phoneState='ready',materials=[{id:'m',patientId:'p',title:'가상 안내자료',text:'가상 본문입니다.',kind:'guidance',sentAt:'2026-11-08T10:00:00+09:00'}],delay=0,failText=0,failPdf=0,members=true,weightCount=1;
const day=new Date(Date.now()+32400000).toISOString().slice(0,10);
const item={id:'f',patientId:'p',patientName:'가상 코코',clinicName:'가상 병원',title:'가상 수술 후 확인',status:'seen',dueDate:day,stageDay:3,card:{focus:'상처와 식욕 확인',checks:['상처 확인'],journey:'수술 후 관리'}};followupItems=[item,{...item,id:'g',patientId:'q',patientName:'가상 나비'}];
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(root,p==='/'?'home.html':p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('https://carestep-ai-api.kk04sdw.workers.dev/**',async route=>{const u=new URL(route.request().url());reads.push(u.pathname);let status=200,body={ok:true,items:[],materials:[],events:[],doses:[],plans:[],reminders:[],occurrences:[],summary:{},date:day,enabled:false};
if(u.pathname==='/home/me')body={ok:true,home:{user:{id:'u',displayName:'가상 보호자'},consentRequired:false,connections:members?[{id:'c',clinicId:'c',clinicName:'가상 병원',clinicPhone:phone,clinicPhoneState:phoneState,patients:[{id:'p',name:'가상 코코',species:'dog'},{id:'q',name:'가상 나비',species:'cat'}]}]:[]}};
if(u.pathname.endsWith('/custom-reminders')&&failCustom){status=failCustom;body={ok:false,error:'synthetic failure'};}
if(u.pathname.endsWith('/medications')){status=failMedication||200;body=failMedication?{ok:false,error:'synthetic failure'}:{ok:true,doses:[{id:'d',planId:'plan',patientId:'p',date:day,time:'23:59',label:'가상 복약',taken:false}],plans:[]};}
if(u.pathname==='/home/followups'){await new Promise(r=>setTimeout(r,followupDelay));status=failFollowup||200;body=failFollowup?{error:'synthetic unavailable'}:{ok:true,items:followupItems,summary:{}};}
if(u.pathname.endsWith('/respond')&&failRespond){status=failRespond;body={error:'가상 전송 실패'};}
if(u.pathname.endsWith('/respond')&&!failRespond){const data=route.request().postDataJSON();followupItems=followupItems.map(x=>u.pathname.includes('/'+x.id+'/')?{...x,status:'completed',responseCode:data.responseCode,responseNote:data.note,responseEditable:true}:x);}
if(u.pathname.endsWith('/timeline'))body={ok:true,events:[{id:'w',type:'weight',eventDate:day,value:4.2},...(weightCount===2?[{id:'w2',type:'weight',eventDate:'2020-01-01',value:4}]:[])]};
if(u.pathname==='/home/r61/materials'&&route.request().method()==='GET'){await new Promise(r=>setTimeout(r,delay));status=failText||200;body=failText?{ok:false,error:'test unavailable'}:{ok:true,materials};}
if(u.pathname==='/home/r113/materials'){status=failPdf||200;body=failPdf?{ok:false,error:'test unavailable'}:{ok:true,materials:[]};}
await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/home.html');await page.evaluate(()=>localStorage.setItem('carestep_home_session_v1','synthetic'));await page.reload();await page.waitForFunction(()=>window.carestepHomeCare?.context().patientId==='p'&&document.querySelector('[data-material-key="p|m"]'));checks++;


const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
// Guardian-facing copy must remain usable when service-worker registration is unavailable.
await page.waitForFunction(()=>document.getElementById('homePushStatus').textContent.includes('인터넷 연결'));
check(/Cannot read|undefined|HOME_NOTIFICATION/.test(await page.locator('#homePushStatus').textContent()),false);
check(await page.locator('[data-material-key="p|m"] .home-material-topic').count(),0);
check(await page.locator('[data-material-key="p|m"] .home-material-header > :first-child').textContent(),'가상 안내자료');
await page.evaluate(()=>window.carestepHomeNavigation.go('schedule'));
await page.waitForFunction(()=>document.querySelector('[data-plan-id="plan"]'));
check(await page.locator('[data-plan-id="plan"] b').first().textContent(),'가상 복약');


await page.waitForFunction(()=>window.carestepHomeReminderSummary?.().state==='ready');
await page.evaluate(()=>window.carestepOpenHomeFollowups('p'));
const memo=page.locator('[data-followup-response="f"] textarea');
// The expanded content starts with checks, without a repeated dark cover.
check(await page.locator('.home-mobile-care-card header').count(),0);
check(await page.locator('#homeCareAll > summary').textContent(),'경과 전달·상담');
check(await page.locator('#homeFollowupSection h2').isVisible(),false);
check(await page.locator('.home-mobile-focus b').textContent(),'오늘 확인할 내용');
check(await page.locator('[data-followup-response="f"] button[type=submit]').textContent(),'병원에 상태 보내기');
for(const width of [360,390,768,1280]){
 await page.setViewportSize({width,height:844});
 const metrics=await page.locator('[data-followup-response="f"]').evaluate(form=>({
  legend:parseFloat(getComputedStyle(form.querySelector('legend')).fontSize),
  choices:[...form.querySelectorAll('label span')].map(n=>({font:parseFloat(getComputedStyle(n).fontSize),height:n.getBoundingClientRect().height})),
  overflow:document.documentElement.scrollWidth>innerWidth+1
 }));
 check(metrics.legend>=14&&metrics.choices.every(x=>x.font>=14&&x.height>=44),true);
 check(metrics.overflow,false);
 await page.locator('[data-followup-response="f"] button[type=submit]').scrollIntoViewIfNeeded();
 check(await page.locator('[data-followup-response="f"] button[type=submit]').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
 await page.screenshot({path:path.join(root,'..','home-round7-response-'+width+'.png'),fullPage:true});
}
await page.setViewportSize({width:390,height:844});

await memo.fill('보내기 전 작성 중인 가상 메모');await page.locator('[data-followup-response="f"] input[value="watch"]').check();
followupDelay=350;await page.evaluate(()=>{window.testRefresh=window.carestepRefreshHomeFollowups();});
check(await page.locator('.home-followup-card').count(),1);check(await memo.inputValue(),'보내기 전 작성 중인 가상 메모');
await memo.fill('조회 중에도 계속 작성한 메모');await page.evaluate(()=>window.testRefresh);
check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');check(await page.locator('[data-followup-response="f"] input:checked').inputValue(),'watch');check(await page.locator('[data-followup-details="f"]').getAttribute('open'),'');
// New server metadata must not erase text or caret in the same editable response.
followupItems=followupItems.map(x=>x.id==='f'?{...x,title:'새 제목'}:x);await memo.focus();await memo.evaluate(n=>n.setSelectionRange(3,3));
await page.evaluate(()=>window.carestepRefreshHomeFollowups());check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');check(await memo.evaluate(n=>document.activeElement===n&&n.selectionStart===3),true);
failFollowup=503;check(await page.evaluate(()=>window.carestepRefreshHomeFollowups()),false);
check(await page.locator('.home-followup-card').count(),1);check(await page.locator('#homeFollowupToday').textContent(),'1');check((await page.locator('#homeFollowupReadStatus').textContent()).includes('최근 확인한 내용'),true);
failFollowup=0;followupDelay=0;reads=[];await page.locator('[data-followup-retry]').click();await page.waitForFunction(()=>document.querySelector('#homeFollowupReadStatus').hidden);
check(reads.filter(x=>x==='/home/followups').length,1);
await page.locator('[data-followup-filter="completed"]').click();check(await page.locator('#homeFollowupList').textContent(),'완료한 응답이 없습니다전체 보기');
await page.locator('[data-followup-show-all]').click();check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');
await page.evaluate(()=>window.carestepOpenHomeFollowups('q'));check(await page.locator('[data-followup-response="g"] textarea').inputValue(),'');check(await page.locator('[data-followup-response="f"]').count(),0);
await page.locator('[data-followup-response="g"] textarea').fill('다른 환자의 메모');await page.evaluate(()=>window.carestepOpenHomeFollowups('p'));check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');
// Failed sends retain the selected state and memo, and restore the clear send label.
failRespond=503;
await page.locator('[data-followup-response="f"] button[type=submit]').click();
await page.waitForFunction(()=>!document.querySelector('[data-followup-response="f"] button[type=submit]').disabled);
check(await page.locator('[data-followup-response="f"] button[type=submit]').textContent(),'병원에 상태 보내기');
check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');
failRespond=0;
// Submitting clears the unsent draft; edit cancellation goes back to the saved response.
await page.locator('[data-followup-response="f"] button[type=submit]').click();await page.waitForFunction(()=>!!document.querySelector('[data-followup-response-edit="f"]'));
check(await page.locator('.home-followup-delivered').textContent(),'병원에 전달했습니다.');
await page.locator('[data-followup-response-edit="f"]').click();await memo.fill('취소할 수정');await page.locator('[data-followup-response-cancel]').click();await page.locator('[data-followup-response-edit="f"]').click();check(await memo.inputValue(),'조회 중에도 계속 작성한 메모');
await page.evaluate(()=>window.carestepHomeNavigation.go('home'));failMedication=503;
check(await page.evaluate(()=>window.carestepHomeNavigation.refreshCurrent()),false);check((await page.locator('#homeNavigationRefreshStatus').textContent()).includes('복약 조회 실패'),true);
reads=[];failMedication=0;await page.locator('#homeNavigationRefreshStatus button').click();await page.waitForFunction(()=>document.querySelector('#homeNavigationRefreshStatus').textContent==='최신 내용을 확인했습니다.');
check(reads.filter(x=>x.endsWith('/medications')).length,1);check(reads.some(x=>x.endsWith('/timeline')||x==='/home/followups'||x.endsWith('/custom-reminders')),false);
// Two failures are named and retried without reloading healthy areas.
failMedication=503;failCustom=503;await page.evaluate(()=>window.carestepHomeNavigation.refreshCurrent());check((await page.locator('#homeNavigationRefreshStatus').textContent()).includes('직접 만든 알림'),true);
failMedication=0;failCustom=0;reads=[];await page.locator('#homeNavigationRefreshStatus button').click();await page.waitForFunction(()=>document.querySelector('#homeNavigationRefreshStatus').textContent==='최신 내용을 확인했습니다.');check(reads.some(x=>x.endsWith('/timeline')),false);
await page.evaluate(()=>window.carestepOpenHomeFollowups('q'));
for(const width of [360,390,1280]){await page.setViewportSize({width,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(root,'..','home-round6-followup-'+width+'.png'),fullPage:true});}
// Rapid repeated refresh shares a read and preserves the selected patient's draft.
reads=[];followupDelay=200;await page.evaluate(()=>Promise.all([window.carestepRefreshHomeFollowups(),window.carestepRefreshHomeFollowups()]));check(reads.filter(x=>x==='/home/followups').length,1);followupDelay=0;
check(await page.locator('[data-followup-response="g"] textarea').inputValue(),'다른 환자의 메모');
// Explicit loss of access must remove old cards and drafts, not preserve stale sensitive data.
failFollowup=403;await page.evaluate(()=>window.carestepRefreshHomeFollowups());check(await page.locator('.home-followup-card').count(),0);check(await page.locator('#homeFollowupToday').textContent(),'—');
failFollowup=0;await page.evaluate(()=>window.carestepRefreshHomeFollowups());await page.evaluate(()=>window.carestepOpenHomeFollowups('q'));check(await page.locator('[data-followup-response="g"] textarea').inputValue(),'');
followupItems=[];await page.evaluate(()=>window.carestepRefreshHomeFollowups());check((await page.locator('#homeFollowupList').textContent()).includes('아직 받은 경과 확인 안내가 없습니다'),true);
check(errors,[]);console.log(JSON.stringify({ok:true,checks,errors}));await context.close();}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
