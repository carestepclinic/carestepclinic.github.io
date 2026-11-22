import fs from 'node:fs';import assert from 'node:assert/strict';
const base='http://127.0.0.1:8944',target=await(await fetch('http://127.0.0.1:9433/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
ws.addEventListener('message',async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);}else if(m.method==='Fetch.requestPaused'){await send(m.params.request.url.startsWith(base)||m.params.request.url.startsWith('data:')?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(!m.params.request.url.startsWith(base)&&!m.params.request.url.startsWith('data:')?{errorReason:'BlockedByClient'}:{})});}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
const results=[];
try{for(const width of [1440,390]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base});
 for(let n=0;n<120;n++){if(await ev("typeof ClinicOrganization!=='undefined'&&typeof CarestepTodayDocuments!=='undefined'&&!!document.getElementById('clinicToday-tab-followup')"))break;await new Promise(r=>setTimeout(r,100));}
 await ev(`(async()=>{saasMode='auth';saasToken='synthetic';saasSessionMeta={id:'local'};saasMe={role:'owner',clinic:{id:'local'},user:{id:'owner'}};window.testWrites=[];window.testReads=[];
 saasRequest=async(p,o={})=>{testReads.push(p);if(o.method&&o.method!=='GET'){testWrites.push(p);throw Error('No test writes');}if(p.includes('/care-operations?'))return {items:window.syntheticWork||[],actions:window.syntheticWork||[],team:{members:[]}};if(p.includes('/operations/purchases'))return {items:[{id:'n',status:'needed',urgent:true},{id:'o',status:'ordered'}],claims:[]};if(p.includes('/clinical/healthcheck?'))return {items:[],next:null};if(p.includes('/support/consents?'))return {items:[],next:null};return {ok:true,items:[],members:[],courses:[],runs:[],requests:[],counts:{},totalGroups:0,templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null};};
 window.crmApiRequest=saasRequest;showApp({deferFullRender:true});go('dashboard');await Promise.all([CarestepTodayWard.refresh(),CarestepTodayPurchases.refresh(true),CarestepTodayDocuments.refresh()]);
 await new Promise(r=>setTimeout(r,500));window.carestepAttentionSummary=()=>({state:'ready',total:0,targets:0,consult:{state:'ready',items:[]}});
 const today=CarestepStabilization.today(),old=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10),make=(id,sourceType,dueDate=today)=>({id,sourceType,dueDate,patientName:'가상 환자',guardianName:'가상 보호자',patientId:'synthetic',guardianId:'guardian',title:sourceType,action:{status:'open',assignee:'합성 담당자'},status:sourceType==='message'?'failed':'scheduled'});
 window.syntheticWork=[make('home','home'),make('internal','internal'),make('message','message'),make('visit','visit'),make('vaccine','vaccination'),make('heartworm','heartworm'),make('old-internal','internal',old)];
 careOperationsActions=syntheticWork;followupScheduleRows=syntheticWork;clinicClinicalReadState='ready';clinicalLoadCheckedAt=Date.now();followupScheduleLoading=false;renderWorkFirstDashboard();ClinicOrganization.updateTodayCounts();})()`);
 const check=async(expr,label)=>{const value=await ev(expr);if(!value)console.log('DIAGNOSTIC',await ev("JSON.stringify({rows:[...document.querySelectorAll('#workFirstList .work-first-row')].map(x=>[x.dataset.workId,x.dataset.workType]),raw:workFirstBuckets(),tabs:document.getElementById('clinicTodayQueue').textContent,errors:window.testWrites})"),errors);assert.ok(value,width+' '+label);results.push(width+' '+label);};
 await check("document.querySelectorAll('#clinicTodayQueue [role=tab]').length===3",'three task tabs');
 await check("document.getElementById('clinicToday-tab-attention').getAttribute('aria-selected')==='true'",'attention remains default with no alerts');
 await check("Math.abs(document.getElementById('todayDocumentsRoot').getBoundingClientRect().width-document.getElementById('purchasesTodayRoot').getBoundingClientRect().width)<2",'document and supplies widths aligned');
 await check("!document.getElementById('todayDocumentsRoot').textContent.includes('저장된 내용부터')&&!document.querySelector('#todayDocumentsRoot .cs-document-help')",'repeated document guidance removed');
 await check("[document.querySelector('.pt-today-ward-time'),document.querySelector('.cs-supply-status'),document.querySelector('.cs-document-time')].every(x=>x&&/^(오전|오후) [0-9]{2}:[0-9]{2} 기준$/.test(x.textContent))",'header times share format');
 await check("document.getElementById('todayDocumentsRoot').getBoundingClientRect().height<100",'empty document card compact');
 await ev("document.getElementById('clinicToday-tab-followup').click()");
 await check("[...document.querySelectorAll('#workFirstList .work-first-row')].map(x=>x.dataset.workType).sort().join(',')==='home,internal,message'",'followup excludes clinical and preventive tasks');
 await check("document.getElementById('clinicToday-tab-followup').textContent.includes('오늘 3건 · 지난 미처리 1건')",'followup counts correct');
 await check("document.querySelector('#workFirstBacklogList .work-first-row').dataset.workId==='old-internal'&&!!document.getElementById('workFirstBacklog').closest('#clinicFollowupTasks')&&!document.getElementById('workFirstBacklog').hidden",'followup backlog retained');
 await check("!!document.querySelector('#workFirstList [data-work-resolve]')&&!!document.querySelector('#workFirstList [data-work-retry]')",'existing complete and retry controls retained');
 await ev("document.querySelector('[data-work-filter=unassigned]').click();document.getElementById('clinicToday-tab-clinical').click()");
 await check("workFirstFilter==='all'",'changing main tab resets subfilter');
 await check("[...document.querySelectorAll('#workFirstList .work-first-row')].map(x=>x.dataset.workType).sort().join(',')==='heartworm,vaccination,visit'",'clinical tab contains visit vaccination heartworm');
 await check("document.getElementById('clinicToday-tab-clinical').textContent.includes('오늘 3건 · 지난 미처리 0건')",'clinical counts independent');
 await check("document.getElementById('workFirstBacklog').hidden",'other category backlog hidden');
 await check("!!document.querySelector('#workFirstList [data-work-record=vaccination]')&&!!document.querySelector('#workFirstList [data-work-record=heartworm]')",'preventive actions retained');
 await ev("ClinicOrganization.updateTodayCounts()");await check("document.getElementById('clinicToday-tab-clinical').getAttribute('aria-selected')==='true'",'refresh does not switch chosen tab');
 await ev("document.getElementById('clinicToday-tab-clinical').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");await check("document.getElementById('clinicToday-tab-followup').getAttribute('aria-selected')==='true'",'keyboard navigation works');
 await ev("go('patients');go('dashboard')");await check("document.getElementById('clinicToday-tab-attention').getAttribute('aria-selected')==='true'",'return to today opens attention');
 await check("testWrites.length===0",'no writes or messages');await check("document.documentElement.scrollWidth<=innerWidth+1",'no horizontal overflow');
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('../today-layout-'+width+'.png',Buffer.from(shot.data,'base64'));
 }
 for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/test/clinic-today-documents-browser.html'});let qa;for(let n=0;n<100;n++){qa=await ev('window.qaResults');if(qa)break;await new Promise(r=>setTimeout(r,100));}assert.equal(qa?.passed,24,JSON.stringify(qa));assert.ok(!qa.results.some(x=>x.startsWith('FAIL')),JSON.stringify(qa));results.push(...qa.results.map(x=>width+' documents: '+x));}
 console.log(JSON.stringify({passed:results.length,results,errors}));assert.deepEqual(errors,[]);
}finally{await send('Page.close');ws.close();}
