/* Synthetic local fixture. External requests are blocked by the local review server. */
addEventListener('load',()=>{
 const box=document.createElement('section');box.id='continuity-results';box.style='position:fixed;right:8px;top:8px;z-index:999999;background:white;border:2px solid teal;padding:12px;max-width:440px;max-height:65vh;overflow:auto';box.innerHTML='<b>가상 자료 화면 복귀 검증</b><button id="run-continuity">검증 실행</button><ol></ol>';document.body.append(box);
 const $=s=>document.querySelector(s),check=(v,m)=>{if(!v)throw Error(m)},tick=()=>new Promise(r=>setTimeout(r,50)),wait=async f=>{for(let i=0;i<500;i++){if(f())return;await tick();}throw Error('화면 대기 초과');};
 let calls=[],writes=0,offset=0,errors=[],failWard=false,failDocs=false;const now=Date.now.bind(Date);Date.now=()=>now()+offset;
 addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const ledgerRows=Array.from({length:200},(_,i)=>({id:'synthetic-'+i,status:'active',revision:1,body:{record:{date:'2026-11-27',patientName:'합성 환자 '+i,chartNumber:'TEST-'+i,procedure:'가상 수술',surgeon:'합성 담당자'}}}));
 const request=async(p,o={})=>{
  calls.push(p);if(o.method&&o.method!=='GET'){writes++;throw Error('Writes forbidden in review');}
  if(p.includes('/ledger/preferences'))return {surgeons:[],assistants:[],anesthetists:[],procedures:[],anesthetics:[],drugs:[],bundles:[],revision:1};
  if(p.includes('/ledger?'))return {items:p.includes('before=next')?ledgerRows.slice(100):ledgerRows.slice(0,100),next:p.includes('before=next')?'':'next',filtersApplied:true,counts:{active:200}};
  if(p.includes('/members'))return {members:[]};
  if(p.includes('/support/resources'))return {items:[{id:'room',name:'가상 수술실',kind:'surgery',active:true,beforeMinutes:0,afterMinutes:0}]};
  if(p.includes('/support/bookings'))return {items:[],truncated:false};
  if(p.includes('/consents/preferences'))return {doctors:[],templates:[],revision:1,canManage:true};
  if(p.includes('/support/consents?')){if(failDocs)throw Error('Synthetic offline');return {items:[{id:'synthetic-draft',status:'draft',patientName:'합성 환자',title:'가상 동의서',updatedAt:new Date(now()).toISOString()},{id:'signed',status:'signed'}],next:''};}
  if(p.includes('/clinical/healthcheck?'))return {items:[],next:''};
  if(p.includes('/clinical/cases')){if(failWard)throw Error('Synthetic offline');return {items:[],hasMore:false};}
  if(p.includes('/clinical/rooms')){if(failWard)throw Error('Synthetic offline');return {items:[]};}
  return {ok:true,items:[],members:[],rooms:[],events:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'synthetic-owner',manager:true,next:'',preferences:{},settings:{},revision:1};
 };
 const count=s=>calls.filter(p=>p.includes(s)).length;
 const goTab=async tab=>{go('practice',{practiceTab:tab});await wait(()=>window.ClinicLazyModules&&!ClinicLazyModules.needs(tab));await tick();};
 const ledgerReady=()=>wait(()=>$('.sl')&&!$('.sl').hasAttribute('aria-busy'));
 const run=async(name,fn)=>{try{await fn();const li=document.createElement('li');li.textContent='PASS '+name;box.querySelector('ol').append(li);}catch(e){const li=document.createElement('li');li.textContent='FAIL '+name+' · '+e.message;box.querySelector('ol').append(li);throw e;}};
 $('#run-continuity').onclick=async()=>{box.querySelector('ol').replaceChildren();$('#run-continuity').disabled=true;
 try{
  saasMode='auth';saasToken='synthetic-local';saasSessionMeta={id:'synthetic-session'};saasMe={role:'owner',clinic:{id:'synthetic-clinic',name:'가상 검증 병원'},user:{id:'synthetic-owner'},permissions:{mode:'all'}};saasRequest=request;showApp({deferFullRender:true});
  await run('오늘 진료의 오래된 정보 갱신·중복 조회 방지',async()=>{
   go('dashboard');await CarestepTodayDocuments.refresh();await CarestepTodayWard.refresh();await tick();let w=count('/clinical/cases'),d=count('/support/consents?');
   carestepRefreshVisibleToday();carestepRefreshVisibleToday();await tick();check(count('/clinical/cases')===w&&count('/support/consents?')===d,'최신 정보 중복 조회');
   offset=61000;carestepRefreshVisibleToday();carestepRefreshVisibleToday();await tick();check(count('/clinical/cases')===w+1&&count('/support/consents?')===d+1,'오래된 정보 1회 갱신');check(!$('#todayDocumentsRoot').textContent.includes('signed'),'서명본 제외');
  });
  await run('갱신 실패 시 기존 화면 보존·즉시 재시도 가능',async()=>{
   failWard=failDocs=true;await CarestepTodayWard.refresh();await CarestepTodayDocuments.refresh();check($('#wardTodayRoot').textContent.includes('갱신 실패'),'진료 현황 실패 안내');check($('#todayDocumentsRoot').textContent.includes('가상 동의서'),'기존 문서 보존');failWard=failDocs=false;await CarestepTodayWard.refresh();await CarestepTodayDocuments.refresh();check(!$('#wardTodayRoot').textContent.includes('갱신 실패'),'수동 재시도');
  });
  await goTab('ledger');await ledgerReady();
  await run('검색한 수술대장 200건 펼치기',async()=>{
   const f=$('[data-filter]');f.q.value='합성';f.elements.surgeon.value='합성 담당자';f.requestSubmit();await ledgerReady();$('[data-ledger=more]').click();await ledgerReady();check($('.sl').textContent.includes('현재 200건 표시'),'200건');
  });
  await run('메뉴 왕복 후 검색·펼친 목록·스크롤 유지',async()=>{
   window.scrollTo(0,700);await tick();const y=scrollY,root=$('.sl'),reads=count('/ledger?');check(y>100,'스크롤 준비');await goTab('bookings');await wait(()=>$('[data-booking-view]')&&!$('.su').hasAttribute('aria-busy'));await goTab('ledger');await ledgerReady();await tick();
   check($('.sl')===root,'목록 DOM 유지');check($('.sl').textContent.includes('현재 200건 표시'),'펼친 목록');check($('[data-filter] [name=q]').value==='합성','검색어');check($('[data-filter] [name=surgeon]').value==='합성 담당자','상세 조건');check(Math.abs(scrollY-y)<3,'스크롤 '+scrollY+'/'+y);check(count('/ledger?')===reads,'반복 조회 없음');
  });
  await run('분리된 예약표는 초점 복귀 시 조회하지 않음',async()=>{const n=count('/support/bookings');dispatchEvent(new Event('focus'));await tick();check(count('/support/bookings')===n,'숨은 예약표 조회');});
  await run('예약표 재진입 시 화면 유지·최신 조회',async()=>{await goTab('bookings');await tick();const root=$('.su'),n=count('/support/bookings');dispatchEvent(new Event('focus'));await tick();check(count('/support/bookings')===n+1,'표시 중 예약표 갱신');check($('.su')===root,'예약표 유지');});
  await run('오늘 진료 뒤의 숨은 예약표 조회 중단',async()=>{go('dashboard');await tick();const n=count('/support/bookings');dispatchEvent(new Event('focus'));await tick();check(count('/support/bookings')===n,'다른 화면의 예약표 조회');});
  await run('작성 중 수술대장 입력 유지',async()=>{await goTab('ledger');await ledgerReady();$('[data-ledger=new]').click();await wait(()=>$('[data-record]'));const input=$('[data-record] [name=patientName]');input.value='가상 작성 유지';input.dispatchEvent(new Event('input',{bubbles:true}));await goTab('bookings');await goTab('ledger');check($('[data-record] [name=patientName]').value==='가상 작성 유지','입력 보존');});
  await run('병원 변경 후 이전 목록을 재사용하지 않음',async()=>{saasMe={...saasMe,clinic:{id:'synthetic-second',name:'다른 가상 병원'}};CarestepPractice.sync();await goTab('ledger');await ledgerReady();check(!$('[data-record]'),'이전 편집 화면 분리');await CarestepTodayDocuments.refresh({ifStale:true});});
  await run('실제 저장·서명·발송 없음, 실행 오류 없음',async()=>{check(writes===0,'쓰기를 호출함');check(errors.length===0,errors.join(' / '));});
  box.dataset.done='true';box.dataset.result='pass';
 }catch(e){box.dataset.done='true';box.dataset.result='fail';console.error(e);}finally{offset=0;$('#run-continuity').disabled=false;}
 };
});
