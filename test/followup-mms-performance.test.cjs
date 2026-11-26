const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});

async function open(kind='index',width=1440){const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.stack));await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+'/'+kind+'.html');await p.evaluate(kind=>{window.writes=[];if(kind==='index'){saasMode='auth';saasToken='synthetic';saasMe={role:'owner',clinic:{id:'test'},user:{id:'owner'},entitlements:{plan:{features:{}}}};saasRequest=async(p,o={})=>{if(o.method&&o.method!=='GET')writes.push(p);return {ok:true,items:[],members:[],plans:[]};};showApp({deferFullRender:true});}else{req=async(p,o={})=>{if(o.method&&o.method!=='GET')writes.push(p);return {ok:true};};document.getElementById('loginOverlay').classList.add('hidden');}},kind);return {p,errors};}
async function setup(p){await p.evaluate(()=>{saasSessionMeta={id:'session'};window.crmCurrentPatient=()=>({patientId:'p',guardianId:'g'});caseInfo.dischargeDate='2026-12-01';followupCaseNonce='synthetic-case';activePatientJourney={id:'j',name:'시험 후속관리',version:1,stages:[{day:1,title:'상태 확인'},{day:3,title:'재진 확인'}]};activeJourneyStageSelection=[1,3];followupSelectedStages=()=>[1,3];readCaseInfoFromForm=()=>{};followupSettings=()=>({time:'10:00',stages:[1,3]});followupTeamMembers=[{userId:'owner',displayName:'담당자',role:'owner'}];serverFollowupState=null;saasPermission=()=>true;});}
async function finalFixture(p,{fail=false,linked=true,skip=false}={}){await setup(p);await p.evaluate(({fail,linked,skip})=>{currentTemplateId='t';saasToken='synthetic';go('followup');setFollowupGuideStep(5,true);followupGuideTransitionUntil=0;followupGuideMessageValidation=()=>({ok:true});$('messagingChannel').value='sms';$('messagingChannel').dataset.touched='1';$('messagingRecipientPhone').value='01000000000';$('messagingConsent').checked=true;writeFollowupGuideState({messagesSkipped:skip});window.requests=[];saasRequest=async(path,opt={})=>{requests.push({path,method:opt.method||'GET'});if(path.endsWith('/workspace'))return {ok:true,patient:{id:'p'},guardian:{id:'g'},home:{status:linked?'linked':'not_linked'}};if(opt.method==='PUT'){const body=JSON.parse(opt.body);return {ok:true,case:{...body,id:'saved',caseKey:followupCaseNonce,guardianId:'g',revision:1,internalTasks:body.internalTasks.map(x=>({...x,stageDay:x.day}))}};}if(path.endsWith('/home-followups'))return {ok:true,count:2,caseKey:followupCaseNonce,patientId:'p'};if(path.endsWith('/messages/schedule')){if(fail)throw Error('timeout');return {ok:true,count:2,jobs:[{id:'one',stageDay:1,status:'scheduled'},{id:'three',stageDay:3,status:'scheduled'}]};}return {ok:true};};},{fail,linked,skip});}
// All requests use synthetic fixtures; external requests are blocked by open().
test('all selected cards warm once; preview and final save share images without changing the builder',async()=>{
 const {p,errors}=await open();await finalFixture(p);
 await p.evaluate(()=>{clearFollowupMmsCache();window.captures=[];window.messageBodies=[];
  captureFollowupMmsJpeg=async html=>{captures.push(html);return btoa('image-'+captures.length);};
  const request=saasRequest;saasRequest=async(path,opt={})=>{if(path.endsWith('/messages/schedule'))messageBodies.push(JSON.parse(opt.body));return request(path,opt);};
  $('messagingChannel').value='mms';mobileDay=14;window.previewBefore=$('phonePreview').innerHTML;setFollowupGuideStep(4,true);
 });
 await p.waitForFunction(()=>captures.length===2&&[...followupMmsCache.values()].every(x=>!x.pending));
 await p.locator('[data-recipient-media] button').first().click();await p.waitForSelector('[data-recipient-media] img');
 assert.equal(await p.evaluate(()=>captures.length),2);
 await p.evaluate(async()=>{setFollowupGuideStep(5,true);followupGuideTransitionUntil=0;await followupGuideNextAction();});
 assert.equal(await p.evaluate(()=>captures.length),2);
 assert.equal(await p.evaluate(()=>readFollowupGuideState().finished),true);
 assert.deepEqual(await p.evaluate(()=>messageBodies[0].jobs.map(x=>atob(x.imageBase64))),['image-1','image-2']);
 assert.deepEqual(await p.evaluate(()=>({day:mobileDay,same:$('phonePreview').innerHTML===previewBefore})),{day:14,same:true});
 assert.deepEqual(errors,[]);await p.close();
});

test('cache shares pending work, invalidates changed content and separates patient/session identity',async()=>{
 const {p}=await open();await setup(p);
 const result=await p.evaluate(async()=>{clearFollowupMmsCache();let calls=0;captureFollowupMmsJpeg=async()=>String(++calls);
  const first=await Promise.all([preparedFollowupMmsImage(1),preparedFollowupMmsImage(1)]);
  await preparedFollowupMmsImage(3);const initial=calls;
  activePatientJourney.stages[0].title='변경된 안내';await preparedFollowupMmsImage(1);await preparedFollowupMmsImage(3);const dayOnly=calls;
  hospital.name='변경 병원';await preparedFollowupMmsImage(1);const hospitalChanged=calls;
  caseInfo.dischargeDate='2026-12-03';await preparedFollowupMmsImage(1);const dateChanged=calls;
  followupCaseNonce='new-patient-case';await preparedFollowupMmsImage(1);const patientChanged=calls;
  saasSessionMeta={id:'other-session'};await preparedFollowupMmsImage(1);
  return {first,initial,dayOnly,hospitalChanged,dateChanged,patientChanged,sessionChanged:calls,cacheSize:followupMmsCache.size};
 });
 assert.deepEqual(result,{first:['1','1'],initial:2,dayOnly:3,hospitalChanged:4,dateChanged:5,patientChanged:6,sessionChanged:7,cacheSize:1});await p.close();
});

test('background warming honors selected dates and does not run for SMS, skipped messages or hidden workflow',async()=>{
 const {p}=await open();await finalFixture(p);
 await p.evaluate(()=>{clearFollowupMmsCache();window.captures=[];captureFollowupMmsJpeg=async html=>{captures.push(html);return 'eA==';};setFollowupGuideStep(4,true);});
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>captures.length),0);
 await p.evaluate(()=>{$('messagingChannel').value='mms';writeFollowupGuideState({messagesSkipped:true});scheduleFollowupMmsPreparation();});
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>captures.length),0);
 await p.evaluate(()=>{writeFollowupGuideState({messagesSkipped:false});$('followup').classList.remove('active-view');scheduleFollowupMmsPreparation();});
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>captures.length),0);
 await p.evaluate(()=>{$('followup').classList.add('active-view');followupMessagingStages=()=>[3];scheduleFollowupMmsPreparation();});
 await p.waitForFunction(()=>captures.length===1);assert.match(await p.evaluate(()=>captures[0]),/D\+3/);
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>captures.length),1);await p.close();
});

test('failed prewarm does not loop and explicit retry succeeds',async()=>{
 const {p}=await open();await finalFixture(p);
 await p.evaluate(()=>{clearFollowupMmsCache();window.calls=0;captureFollowupMmsJpeg=async()=>{calls++;throw Error('offline');};$('messagingChannel').value='mms';setFollowupGuideStep(4,true);});
 await p.waitForFunction(()=>calls===2);await p.evaluate(()=>scheduleFollowupMmsPreparation());await p.waitForTimeout(450);
 assert.equal(await p.evaluate(()=>calls),2);
 const result=await p.evaluate(async()=>{captureFollowupMmsJpeg=async()=>{calls++;return 'retry';};const image=await preparedFollowupMmsImage(1);return {calls,image};});
 assert.deepEqual(result,{calls:3,image:'retry'});await p.close();
});

test('in-flight capture cannot be reused after content changes and expired entries regenerate',async()=>{
 const {p}=await open();await setup(p);
 const result=await p.evaluate(async()=>{clearFollowupMmsCache();let release;captureFollowupMmsJpeg=()=>new Promise(r=>release=r);
  const pending=preparedFollowupMmsImage(1).then(()=>false,()=>true);await new Promise(r=>setTimeout(r,0));hospital.name='new logo owner';release('stale');const rejected=await pending;
  let count=0;captureFollowupMmsJpeg=async()=>String(++count);await preparedFollowupMmsImage(1);
  for(const entry of followupMmsCache.values())entry.at=Date.now()-600001;
  const image=await preparedFollowupMmsImage(1);return {rejected,image,count};
 });assert.deepEqual(result,{rejected:true,image:'2',count:2});await p.close();
});

for(const width of [390,1440])test('save progress is visible while hidden-step inputs retain their DOM '+width,async()=>{
 const {p,errors}=await open('index',width);await finalFixture(p);
 await p.evaluate(()=>{setFollowupGuideStep(3,true);setFollowupGuideStep(4,true);window.editor=$('[data-followup-message-editor]')||document.querySelector('[data-followup-message-editor]');editor.value='작성 중인 문구';
  setFollowupGuideStep(5,true);followupGuideTransitionUntil=0;window.pendingSteps=[];const request=saasRequest;
  saasRequest=async(path,opt={})=>{if(path.endsWith('/workspace')||['PUT','POST'].includes(opt.method))await new Promise(resolve=>pendingSteps.push({path,resolve}));return request(path,opt);};
  window.saving=followupGuideNextAction();
 });
 const expected=['환자·HOME 연결 확인','원내 업무 저장','HOME 카드 등록','보호자 문자 예약'];
 for(let i=0;i<expected.length;i++){
  await p.waitForFunction(n=>pendingSteps.length>n,i);
  assert.match(await p.locator('#followupSaveProgress').textContent(),new RegExp(expected[i]));
  assert.equal(await p.locator('#followupGuideNext').isDisabled(),true);
  assert.equal(await p.evaluate(()=>editor.isConnected&&editor.value==='작성 중인 문구'),true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(i===2)await p.screenshot({path:require('os').tmpdir()+'/followup-save-progress-'+width+'.png'});
  await p.evaluate(n=>pendingSteps[n].resolve(),i);
 }
 await p.evaluate(()=>saving);assert.equal(await p.locator('#followupSaveProgress').isVisible(),false);assert.deepEqual(errors,[]);await p.close();
});

test('a changed image during patient preflight aborts before any writes',async()=>{
 const {p}=await open();await finalFixture(p);
 await p.evaluate(async()=>{$('messagingChannel').value='mms';captureFollowupMmsJpeg=async()=> 'eA==';const request=saasRequest;saasRequest=async(path,opt)=>{const result=await request(path,opt);if(path.endsWith('/workspace'))hospital.name='changed during verification';return result;};await followupGuideNextAction();});
 assert.equal(await p.evaluate(()=>requests.filter(x=>x.method!=='GET').length),0);assert.equal(await p.evaluate(()=>readFollowupGuideState().completionAttempted),false);await p.close();
});

test('direct canvas pipeline emits JPEG within limits, cleans up, and does not change preview',async()=>{
 const {p}=await open();await setup(p);
 const result=await p.evaluate(async()=>{window.encoded=[];const encode=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,type,q){encoded.push(type);return encode.call(this,cb,type,q);};
  createImageBitmap=()=>{throw Error('intermediate bitmap is forbidden');};window.captured=null;window.captureCanvas=null;
  window.html2pdf=()=>({set(){return this;},from(card){captured={unique:!card.id,width:card.offsetWidth};return this;},toCanvas(){captureCanvas=document.createElement('canvas');captureCanvas.width=1080;captureCanvas.height=1920;const c=captureCanvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1080,1920);c.fillStyle='#14786e';c.font='60px sans-serif';c.fillText('CARESTEP synthetic card',20,100);return this;},async get(){return captureCanvas;}});
  const before=$('phonePreview').innerHTML,day=mobileDay;const image=await captureFollowupMmsJpeg(followupMobileCardHtml(1));const img=new Image();img.src='data:image/jpeg;base64,'+image;await img.decode();
  return {types:encoded,bytes:atob(image).length,width:img.naturalWidth,height:img.naturalHeight,unique:captured.unique,cardWidth:captured.width,clean:!document.querySelector('[aria-hidden="true"] .phone-card'),released:captureCanvas.width===1,previewSame:$('phonePreview').innerHTML===before&&day===mobileDay};
 });assert.deepEqual(result.types,['image/jpeg']);assert.ok(result.bytes<=200*1024);assert.deepEqual([result.width,result.height],[810,1440]);assert.equal(result.unique,true);assert.equal(result.cardWidth,540);assert.equal(result.clean,true);assert.equal(result.released,true);assert.equal(result.previewSame,true);await p.close();
});
