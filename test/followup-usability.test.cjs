const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});

async function open(kind='index',width=1440){const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.stack));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+'/'+kind+'.html');await p.evaluate(kind=>{window.writes=[];if(kind==='index'){saasMode='auth';saasToken='synthetic';saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'},entitlements:{plan:{features:{}}}};saasRequest=async(p,o={})=>{if(o.method&&o.method!=='GET')writes.push(p);return {ok:true,items:[],members:[],plans:[]};};showApp({deferFullRender:true});}else{req=async(p,o={})=>{if(o.method&&o.method!=='GET')writes.push(p);return {ok:true};};document.getElementById('loginOverlay').classList.add('hidden');}},kind);return {p,errors};}
async function setup(p){await p.evaluate(()=>{saasSessionMeta={id:'session'};window.crmCurrentPatient=()=>({patientId:'p',guardianId:'g'});caseInfo.dischargeDate='2026-12-01';followupCaseNonce='synthetic-case';activePatientJourney={id:'j',name:'시험 후속관리',version:1,stages:[{day:1,title:'상태 확인'},{day:3,title:'재진 확인'}]};activeJourneyStageSelection=[1,3];followupSelectedStages=()=>[1,3];readCaseInfoFromForm=()=>{};followupSettings=()=>({time:'10:00',stages:[1,3]});followupTeamMembers=[{userId:'owner',displayName:'담당자',role:'owner'}];serverFollowupState=null;saasPermission=()=>true;});}
async function finalFixture(p,{fail=false,linked=true,skip=false}={}){await setup(p);await p.evaluate(({fail,linked,skip})=>{currentTemplateId='t';saasToken='synthetic';go('followup');setFollowupGuideStep(5,true);followupGuideTransitionUntil=0;followupGuideMessageValidation=()=>({ok:true});$('messagingChannel').value='sms';$('messagingChannel').dataset.touched='1';$('messagingRecipientPhone').value='01000000000';$('messagingConsent').checked=true;writeFollowupGuideState({messagesSkipped:skip});window.requests=[];saasRequest=async(path,opt={})=>{requests.push({path,method:opt.method||'GET'});if(path.endsWith('/workspace'))return {ok:true,patient:{id:'p'},guardian:{id:'g'},home:{status:linked?'linked':'not_linked'}};if(opt.method==='PUT'){const body=JSON.parse(opt.body);return {ok:true,case:{...body,id:'saved',caseKey:followupCaseNonce,guardianId:'g',revision:1,internalTasks:body.internalTasks.map(x=>({...x,stageDay:x.day}))}};}if(path.endsWith('/home-followups'))return {ok:true,count:2,caseKey:followupCaseNonce,patientId:'p'};if(path.endsWith('/messages/schedule')){if(fail)throw Error('timeout');return {ok:true,count:2,jobs:[{id:'one',stageDay:1,status:'scheduled'},{id:'three',stageDay:3,status:'scheduled'}]};}return {ok:true};};},{fail,linked,skip});}
test('changed date invalidates the open preview and automatically replaces it without editing the message',async()=>{
 const {p,errors}=await open();await setup(p);await p.evaluate(()=>{go('followup');setFollowupGuideStep(4,true);$('messagingChannel').value='mms';clearFollowupMmsCache();captureFollowupMmsJpeg=async html=>btoa(unescape(encodeURIComponent(html)));renderFollowupRecipientPreview();});
 await p.locator('[data-recipient-media] button').first().click();await p.waitForSelector('[data-recipient-media] img');
 const before=await p.locator('[data-recipient-media] img').first().getAttribute('src');
 await p.locator('[data-followup-message-editor]').first().fill('보호자에게 전달할 개별 문구');
 await p.evaluate(()=>{caseInfo.dischargeDate='2026-12-05';renderFollowupRecipientPreview();});
 assert.equal(await p.locator('[data-recipient-media] img').count(),0);
 await p.waitForFunction(previous=>document.querySelector('[data-recipient-media] img')?.src!==previous&&!!document.querySelector('[data-recipient-media] img'),before);
 assert.match(await p.locator('.followup-card-date').first().textContent(),/2026-12-06/);
 assert.equal(await p.locator('[data-followup-message-editor]').first().inputValue(),'보호자에게 전달할 개별 문구');
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>writes),[]);await p.close();
});

test('one preparation failure is visible; other days finish and explicit retry regenerates only the failed image',async()=>{
 const {p,errors}=await open();await setup(p);await p.evaluate(()=>{go('followup');setFollowupGuideStep(4,true);$('messagingChannel').value='mms';clearFollowupMmsCache();window.calls=[];window.failOne=true;captureFollowupMmsJpeg=async html=>{const day=html.includes('D+1</div>')?1:3;calls.push(day);if(day===1&&failOne)throw Error('failed');return 'eA==';};renderFollowupRecipientPreview();});
 await p.waitForFunction(()=>calls.length===2&&[...followupMmsCache.values()].every(x=>!x.pending));
 assert.match(await p.locator('[data-followup-day="1"] [data-recipient-preparation]').textContent(),/실패/);
 assert.match(await p.locator('[data-followup-day="3"] [data-recipient-preparation]').textContent(),/완료/);
 await p.evaluate(()=>{failOne=false;});await p.locator('[data-followup-day="1"] [data-recipient-media] button').click();
 await p.waitForFunction(()=>document.querySelector('[data-followup-day="1"] [data-recipient-preparation]').textContent.includes('완료'));
 assert.deepEqual(await p.evaluate(()=>calls),[1,3,1]);assert.deepEqual(errors,[]);await p.close();
});

for(const width of [390,1440])test('past dates are flagged before final confirmation and can be excluded without changing other schedules '+width,async()=>{
 const {p,errors}=await open('index',width);await setup(p);await p.evaluate(()=>{go('followup');setFollowupGuideStep(4,true);caseInfo.dischargeDate='2026-01-01';CarestepStabilization.compatible=()=>true;messagingAllowed=()=>true;$('messagingChannel').value='sms';$('messagingRecipientPhone').value='01000000000';$('messagingConsent').checked=true;followupGuideTransitionUntil=0;renderFollowupRecipientPreview();});
 const issue=await p.evaluate(()=>followupGuideMessageValidation());assert.equal(issue.ok,false);assert.equal(issue.field,'followupMessageDay1');
 await p.evaluate(()=>followupGuidePrepareMessages());assert.equal(await p.evaluate(()=>followupGuideStep),4);
 assert.equal(await p.locator('.date-warning').count(),2);assert.equal(await p.locator('#followupMessageDay1').getAttribute('aria-invalid'),'true');
 await p.screenshot({path:require('os').tmpdir()+'/followup-date-warning-'+width+'.png'});
 await p.locator('[data-message-exclude-past]').click();assert.deepEqual(await p.evaluate(()=>followupMessagingStages()),[]);assert.deepEqual(await p.evaluate(()=>followupSelectedStages()),[1,3]);
 assert.equal(await p.evaluate(()=>followupGuideMessageValidation().ok),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>writes),[]);await p.close();
});

test('date becoming invalid while on the final step returns to its checkbox before any request',async()=>{
 const {p}=await open();await setup(p);const result=await p.evaluate(async()=>{go('followup');setFollowupGuideStep(5,true);caseInfo.dischargeDate='2026-01-01';CarestepStabilization.compatible=()=>true;messagingAllowed=()=>true;$('messagingChannel').value='sms';$('messagingRecipientPhone').value='01000000000';$('messagingConsent').checked=true;window.requests=[];saasRequest=async path=>{requests.push(path);return {ok:true};};await finishFollowupSetup();return {step:followupGuideStep,requests,attempted:readFollowupGuideState().completionAttempted};});
 assert.deepEqual(result,{step:4,requests:[],attempted:false});await p.close();
});

for(const width of [390,1440])test('bulk assignee touches only enabled unassigned unfinished tasks and preserves text, dates and delivery choices '+width,async()=>{
 const {p,errors}=await open('index',width);await setup(p);await p.evaluate(()=>{saasRequest=async path=>path==='/saas/members'?{members:[{userId:'vet',displayName:'시험 담당자',status:'active'}]}:{ok:true,items:[]};followupSelectedStages=()=>[1,3,7,14];activeJourneyStageSelection=[1,3,7,14];go('followup');setFollowupGuideStep(3,true);const rows=ClinicFollowupTasks.plan();rows[0].title='수정된 업무';rows[1].assigneeUserId='existing';rows[2].status='completed';rows[3].enabled=false;window.beforeRows=JSON.parse(JSON.stringify(rows));renderFollowupGuide();});
 await p.waitForFunction(()=>document.querySelector('[data-internal-bulk] select option[value="vet"]'));
 await p.locator('[data-internal-bulk] select').selectOption('vet');await p.locator('[data-internal-bulk] button').click();
 const result=await p.evaluate(()=>({before:beforeRows,after:ClinicFollowupTasks.plan(),selected:followupSelectedStages(),messages:followupMessagingStages()}));
 assert.equal(result.after[0].assigneeUserId,'vet');assert.equal(result.after[0].title,'수정된 업무');assert.equal(result.after[0].dueAt,result.before[0].dueAt);assert.deepEqual(result.after.slice(1),result.before.slice(1));assert.deepEqual(result.selected,[1,3,7,14]);assert.deepEqual(result.messages,[1,3,7,14]);
 assert.equal(await p.locator('[data-internal-bulk] button').isDisabled(),true);assert.match(await p.locator('[data-bulk-result]').textContent(),/1건 적용/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.screenshot({path:require('os').tmpdir()+'/followup-bulk-'+width+'.png'});assert.deepEqual(errors,[]);await p.close();
});

test('bulk assignment stays unavailable when roster loading fails',async()=>{
 const {p}=await open();await setup(p);await p.evaluate(()=>{saasRequest=async()=>{throw Error('offline');};go('followup');setFollowupGuideStep(3,true);});
 await p.waitForFunction(()=>document.querySelector('[data-internal-team-status]').textContent.includes('불러오지 못했습니다'));
 assert.equal(await p.locator('[data-internal-bulk] select').isDisabled(),true);assert.equal(await p.locator('[data-internal-bulk] button').isDisabled(),true);assert.ok(await p.evaluate(()=>ClinicFollowupTasks.plan().every(x=>!x.assigneeUserId)));await p.close();
});

test('excluding an expired day retains future message selections and customized text',async()=>{
 const {p}=await open();await setup(p);await p.evaluate(()=>{go('followup');setFollowupGuideStep(4,true);followupDateObject=day=>new Date(Date.now()+(day===1?-3600000:86400000));setFollowupMessageEdit(3,'sms','다음 일정 문구');renderFollowupRecipientPreview();});
 await p.locator('[data-message-exclude-past]').click();assert.deepEqual(await p.evaluate(()=>followupMessagingStages()),[3]);assert.equal(await p.evaluate(()=>followupStageMessage(3,'sms')),'다음 일정 문구');assert.deepEqual(await p.evaluate(()=>followupSelectedStages()),[1,3]);await p.close();
});

test('stale bulk control cannot assign another patient or write while final save is locked',async()=>{
 const {p}=await open();await setup(p);await p.evaluate(()=>{saasRequest=async()=>({members:[{userId:'vet',displayName:'시험 담당자',status:'active'}],items:[]});go('followup');setFollowupGuideStep(3,true);});
 await p.waitForFunction(()=>document.querySelector('[data-internal-bulk] select option[value="vet"]'));await p.locator('[data-internal-bulk] select').selectOption('vet');
 const result=await p.evaluate(()=>{const apply=document.querySelector('[data-internal-bulk] button').onclick;followupGuideNavigationBusy=true;apply();const locked=ClinicFollowupTasks.plan().every(x=>!x.assigneeUserId);followupGuideNavigationBusy=false;followupCaseNonce='different-patient';apply();return {locked,separate:ClinicFollowupTasks.plan().every(x=>!x.assigneeUserId)};});
 assert.deepEqual(result,{locked:true,separate:true});await p.close();
});
