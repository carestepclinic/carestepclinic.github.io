/* Local-only synthetic integration checks; served by the review fixture, never by index.html. */
addEventListener('load',()=>{
 const box=document.createElement('section');box.id='loading-review-results';box.style='position:fixed;right:8px;top:8px;z-index:999999;background:white;border:2px solid teal;padding:12px;max-width:500px;max-height:80vh;overflow:auto';
 box.innerHTML='<b>합성 자료 로딩 검증</b><button id="run-loading-review">검증 실행</button><ol></ol>';document.body.append(box);
 let errors=[],requests=[],slowPrefs=false,releasePrefs,slowMembers=false,releaseMembers,searchMode=false,searchWait,searchRelease,posts=0,record=null;
 addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const defaults={surgeons:['합성 수의사'],assistants:[],anesthetists:[],procedures:['합성 수술'],anesthetics:[],drugs:[],bundles:[],revision:1};
 const resource={id:'synthetic-room',name:'합성 수술실',kind:'surgery',active:true,beforeMinutes:0,afterMinutes:0};
 const staff={userId:'synthetic-vet',id:'synthetic-vet',displayName:'합성 수의사',status:'active',role:'vet'};
 const check=(v,m)=>{if(!v)throw Error(m)},wait=async f=>{for(let i=0;i<500;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('화면 대기 초과')};
 const $=s=>document.querySelector(s),fill=(s,v)=>{const e=$(s);check(e,'입력칸 없음 '+s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
 const goTab=async tab=>{go('practice',{practiceTab:tab});await wait(()=>window.ClinicLazyModules&&!ClinicLazyModules.needs(tab==='surgery'||tab==='ward'||tab==='protocols'?'clinical':tab));};
 const ready=()=>wait(()=>$('.sl')&&!$('.sl').hasAttribute('aria-busy'));
 const run=async(name,fn)=>{try{await fn();const li=document.createElement('li');li.textContent='PASS '+name;box.querySelector('ol').append(li);}catch(e){const li=document.createElement('li');li.textContent='FAIL '+name+' · '+e.message;box.querySelector('ol').append(li);throw e;}};
 $('#run-loading-review').onclick=async()=>{box.querySelector('ol').replaceChildren();$('#run-loading-review').disabled=true;
 try{
  saasMode='auth';saasToken='synthetic-local-only';saasSessionMeta={id:'synthetic-session'};saasMe={role:'owner',clinic:{id:'synthetic-clinic',name:'합성 검증 병원'},user:{id:'synthetic-owner'},permissions:{mode:'all'}};
  saasRequest=async(p,o={})=>{
   requests.push(p);if(o.method&&o.method!=='GET')posts++;
   if(p.endsWith('/members')){if(slowMembers){await new Promise(r=>releaseMembers=r);slowMembers=false;}return {members:[staff]};}
   if(p.includes('/ledger/preferences')){if(slowPrefs){await new Promise(r=>releasePrefs=r);slowPrefs=false;}return structuredClone(defaults);}
   if(p.includes('/ledger')){
    if(o.method==='POST'){record={id:'synthetic-record',status:'active',revision:1,body:{record:JSON.parse(o.body).record}};return {document:record};}
    if(p.includes('/ledger/synthetic-record'))return {document:record};
    if(searchMode&&p.includes('procedure=')){if(!p.includes('before=next')){await new Promise(r=>searchRelease=r);return {items:[],next:'next',scannedCount:1000,filtersApplied:true,counts:{active:2271}};}return {items:[],next:'',scannedCount:1271,filtersApplied:true,counts:{active:2271}};}
    return {items:record?[record]:[],next:'',counts:{active:record?1:0}};
   }
   if(p.includes('/support/resources'))return {items:[resource]};
   if(p.includes('/support/bookings'))return {items:[],truncated:false};
   if(p.endsWith('/consents/preferences'))return {doctors:[],templates:[],revision:1,canManage:true};
   if(p.includes('/consent-explanations'))return {items:[]};
   return {ok:true,items:[],members:[],rooms:[],events:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'synthetic-owner',manager:true,next:'',preferences:{},settings:{},revision:1};
  };showApp({deferFullRender:true});
  await run('처음에는 큰 마취·입원 파일을 실행하지 않음',async()=>{check(!window.ClinicalWorkspace,'초기 마취/입원 파일 로딩');check(!!window.RecordListLayout,'공통 목록 도구');});
  await goTab('ledger');await ready();
  await run('병원 설정 대기 중 새 기록 작성 및 늦은 응답의 내용 보존',async()=>{
   slowPrefs=true;$('[data-ledger=new]').click();await wait(()=>$('[data-record]')&&releasePrefs);fill('[data-record] [name=patientName]','가상 작성 유지');fill('[data-record] [name=procedure]','직접 작성 유지');releasePrefs();await wait(()=>!$('[data-preferences-notice]').textContent);check($('[name=procedure]').value==='직접 작성 유지','수술명 덮어쓰기');check($('[name=patientName]').value==='가상 작성 유지','환자명 덮어쓰기');
  });
  await run('합성 저장·재조회 후 입력 보존',async()=>{$('[data-ledger=save]').click();await ready();check(record?.body.record.procedure==='직접 작성 유지','합성 저장');$('[data-ledger=back]').click();await ready();$('[data-ledger=open]').click();await ready();check($('[name=patientName]').value==='가상 작성 유지','재조회');$('[data-ledger=back]').click();await ready();});
  await run('상세 검색 중지·이어 보기와 원본 보존',async()=>{
   searchMode=true;fill('[data-filter] [name=procedure]','없는 수술');$('[data-filter]').requestSubmit();await wait(()=>searchRelease);const stop=[...document.querySelectorAll('button')].find(x=>x.textContent==='검색 중지');check(stop&&!stop.disabled,'검색 중지 버튼');stop.click();searchRelease();await ready();check($('.sl').textContent.includes('검색을 중지했습니다'),'중지 안내');searchMode=false;$('[data-ledger=reset]').click();await ready();check(record.body.record.procedure==='직접 작성 유지','기록 보존');
  });
  await goTab('bookings');await wait(()=>$('[data-booking-view]'));
  await run('직원 응답 지연 중 예약표 사용과 작성 내용 유지',async()=>{
   // Mount a fresh instance so the test cannot reuse the previously loaded staff cache.
   go('practice',{practiceTab:'ledger'});await ready();CarestepPractice.clear();slowMembers=true;await goTab('bookings');await wait(()=>$('[data-booking-view]')&&releaseMembers&&!$('.su').hasAttribute('aria-busy'));
   $('[data-act=new]').click();await wait(()=>$('[data-booking-form]'));fill('[data-booking-form] [name=title]','가상 예약 유지');const r=$('[name=resourceIds]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));releaseMembers();await wait(()=>$('[name=staffIds]'));check($('[name=title]').value==='가상 예약 유지','예약명 덮어쓰기');check($('[name=resourceIds]').checked,'시설 선택 보존');
   fill('[data-booking-form] [name=title]','');CarestepPractice.clear();
  });
  await run('마취·입원·처방 파일 로딩 및 화면 전환',async()=>{
   for(const tab of ['surgery','ward','calc','dental','neuro','ophthalmic','chronic','healthcheck','consents']){await goTab(tab);await wait(()=>!document.querySelector('.cs-module-loading'));await new Promise(r=>setTimeout(r,150));check(!$('.cs-module-loading'),'모듈 대기 '+tab);}
   check(!!window.ClinicalWorkspace&&!!window.AnesthesiaRecord&&!!window.PracticePrescriptionSafety,'의존 모듈');check(!!window.RecordListLayout,'목록 도구 유지');
  });
  await run('입력 중인 새 동의서가 다른 탭 왕복 후 유지됨',async()=>{await wait(()=>$('[data-act=new]')&&!$('.su').hasAttribute('aria-busy'));$('[data-act=new]').click();await wait(()=>$('[name=patientName]'));fill('[name=patientName]','동의서 작성 유지');fill('[name=cost]','비용 작성 유지');await goTab('healthcheck');await goTab('consents');await wait(()=>$('[name=patientName]'));check($('[name=patientName]').value==='동의서 작성 유지','동의서 내용');check($('[name=cost]').value==='비용 작성 유지','비용');});
  await run('파일 중복 실행 및 실행 오류 없음',async()=>{for(const file of ['clinical-workspace.js','anesthesia-record.js'])check([...document.scripts].filter(s=>s.src.includes('/'+file+'?')).length===1,'중복 '+file);check(errors.length===0,errors.join(' / '));});
  box.dataset.done='true';box.dataset.result='pass';
 }catch(e){box.dataset.done='true';box.dataset.result='fail';console.error(e);}finally{$('#run-loading-review').disabled=false;}
 };
});
