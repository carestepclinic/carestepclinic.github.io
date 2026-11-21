/* Synthetic, memory-only tour. Never falls through to the hospital API. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=v=>structuredClone(v),today=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
 const hospital={name:'CARESTEP 체험 동물병원 · 가상 자료',address:'체험용 주소 · 실제 병원 정보가 아닙니다',phone:'연락처 예시'};
 const titles={dashboard:'오늘 진료',patients:'환자 목록',healthcheck:'건강검진 기록',surgery:'마취 기록',consents:'동의서·서명',ward:'입원 보드',purchases:'물품 관리',ledger:'수술대장',bookings:'수술검사일정',training:'직원 교육',sop:'업무지침(SOP)',library:'보호자 안내자료',builder:'안내자료 작성',followup:'상담·후속관리',dental:'치과 기록',neuro:'신경검사 기록',ophthalmic:'안과 기록',chronic:'만성질환 기록',protocols:'진료 프로토콜',intake:'사전문진',ops:'업무 체크리스트',calc:'처방 계산',settings:'병원 설정',account:'설정·계정',onboarding:'처음 사용 설정',voice:'문의·요청',pilot:'운영 통계'};
 let active=false,epoch=0,navigation=0,route='dashboard',root,body,status,hcHost,hc,store,config,navSnapshot=[],headerSnapshot=[];
 const button=(label,target,patient='')=>'<button type="button" data-demo-route="'+esc(target)+'"'+(patient?' data-demo-patient="'+esc(patient)+'"':'')+'>'+esc(label)+'</button>';
 function seed(){
  return {patients:[
   {id:'demo-p1',name:'체험 두리',guardianName:'가상 보호자 A',chartNumber:'DEMO-001',species:'dog',weight:5.2,breed:'말티즈',birthDate:'2020-05-01',sex:'male',neutered:'yes'},
   {id:'demo-p2',name:'체험 나비',guardianName:'가상 보호자 B',chartNumber:'DEMO-002',species:'cat',weight:4.1,breed:'코리안 숏헤어',birthDate:'2021-03-01',sex:'female',neutered:'yes'},
   {id:'demo-p3',name:'체험 보리',guardianName:'가상 보호자 C',chartNumber:'DEMO-003',species:'dog',weight:8.6,breed:'믹스',birthDate:'2022-07-01',sex:'female',neutered:'yes'}
  ],records:[],next:1,workflows:[],tasks:[false,false,false],ward:[false,true,false],supplies:[{name:'진료용 장갑',quantity:3,unit:'상자',state:'주문 필요',urgent:true},{name:'거즈',quantity:5,unit:'묶음',state:'입고 대기'},{name:'보호 칼라',quantity:1,unit:'개',state:'교환·반품'}],anesthesia:{weight:'4.1',doctor:'체험 수의사',procedure:'시술 기록 예시',note:'예시 환자의 상태와 계획을 직접 입력해 보세요.'},consent:{patient:'체험 나비',title:'마취·시술 동의서 체험',doctor:'체험 수의사',plan:'진료 설명의 작성 흐름을 확인하는 가상 문서입니다.',risk:'환자별 설명을 입력하는 예시입니다. 실제 진료에 사용할 수 없습니다.',care:'퇴원 후 안내사항을 입력해 보세요.'}};
 }
 function initHealthcheck(){
  if(store.records.length||store.initialized)return;store.initialized=true;
  const chart=g.HealthcheckRecord.blank();Object.assign(chart,{date:today(),weight:5.2,veterinarian:'체험 수의사',bcs:5,mcs:'정상 근육량 (Normal)',history:'가상 환자의 건강검진 예시입니다.',overview:'체험용 검사 결과와 관리계획을 확인해 보세요. 실제 검사나 진단 결과가 아닙니다.',summary:'검사별 결과를 확인하고 종합소견을 직접 수정하는 예시입니다.',management:'담당 수의사가 설명한 내용을 보호자에게 안내하는 예시입니다.',followup:'재검 날짜와 예정 검사를 입력해 보세요.',reviewed:true});
  chart.labs=[['WBC','8.2','10^3/μL','6–17','cbc'],['HCT','43','%','37–55','cbc'],['ALT','125','U/L','10–100','chemistry'],['CREA','1.1','mg/dL','0.5–1.8','chemistry'],['USG','1.035','','1.015–1.045','urine']].map(([name,value,unit,reference,group])=>g.HealthcheckRecord.row({name,value,unit,reference,group,source:'가상 검사실 · 체험 전용',confirmed:true,date:today()}));
  store.records.push({id:'demo-hc-0',revision:1,patient_id:'demo-p1',patient:copy(store.patients[0]),body:{category:'healthcheck',species:'dog',healthcheckChart:chart},updated_at:new Date().toISOString()});
 }
 function notify(message){if(status)status.textContent=message;}
 async function request(path,opt={}){
  if(!active)throw Error('체험이 종료되었습니다.');
  const url=new URL(path,'https://demo.invalid'),p=url.pathname,b=typeof opt.body==='string'?JSON.parse(opt.body):opt.body;
  if(p.endsWith('/patient-directory')){const q=(url.searchParams.get('q')||'').toLowerCase();return {patients:copy(store.patients.filter(x=>[x.name,x.guardianName,x.chartNumber].some(v=>v.toLowerCase().includes(q))))};}
  if(p.endsWith('/patient-summary')){const patient=store.patients.find(x=>x.id===url.searchParams.get('patientId'));return {patient:copy(patient||store.patients[0]),items:[]};}
  if(p.endsWith('/members'))return {members:[{id:'demo-vet',display_name:'체험 수의사',role:'vet',status:'active'}]};
  if(p.endsWith('/chronic-context'))return {items:[]};
  if(p.endsWith('/workflows')){if(b){store.workflows.push({id:'demo-wf-'+store.workflows.length,revision:1,body:copy(b.body)});return {ok:true};}return {items:copy(store.workflows)};}
  if(p.endsWith('/healthcheck')){
   const q=(url.searchParams.get('q')||'').toLowerCase(),pid=url.searchParams.get('patientId'),status=url.searchParams.get('status'),from=url.searchParams.get('from'),to=url.searchParams.get('to'),vet=url.searchParams.get('vet');
   return {items:store.records.filter(r=>!r.body.deleted&&(!pid||r.patient_id===pid)&&(!status||r.body.healthcheckChart.clinicalStatus===status)&&(!from||r.body.healthcheckChart.date>=from)&&(!to||r.body.healthcheckChart.date<=to)&&(!vet||r.body.healthcheckChart.veterinarian.includes(vet))&&[r.patient.name,r.patient.chartNumber,r.patient.guardianName].join(' ').toLowerCase().includes(q)).map(r=>({id:r.id,patient:copy(r.patient),date:r.body.healthcheckChart.date,veterinarian:r.body.healthcheckChart.veterinarian,clinicalStatus:r.body.healthcheckChart.clinicalStatus})),next:''};
  }
  if(p.endsWith('/cases')&&b){
   const patient=store.patients.find(x=>x.id===b.patientId)||{...b.quickPatient,species:b.species};
   const item={id:'demo-hc-'+store.next++,revision:1,patient_id:b.patientId||'',patient:copy(patient),body:{category:'healthcheck',species:b.species,healthcheckChart:copy(b.healthcheckChart)},updated_at:new Date().toISOString()};store.records.unshift(item);return {id:item.id};
  }
  const match=p.match(/\/cases\/([^/]+)(\/events)?$/);
  if(match){const item=store.records.find(x=>x.id===match[1]);if(!item)throw Error('체험 기록을 찾을 수 없습니다.');
   if(!match[2])return {item:copy(item)};
   if(b?.revision!==item.revision){const e=Error('기록이 변경되었습니다. 다시 열어주세요.');e.status=409;throw e;}
   if(b.kind==='healthcheck.chart')item.body.healthcheckChart=copy(b.data);else if(b.kind==='case.delete')item.body.deleted={at:new Date().toISOString()};else throw Error('체험에서 지원하지 않는 저장입니다.');
   item.revision++;return {id:item.id,revision:item.revision,healthcheckChart:copy(item.body.healthcheckChart)};
  }
  throw Error('체험에서는 이 연결을 사용하지 않습니다. 예시 검사값을 직접 수정해 보세요. 실제 AI·외부 서비스에는 전송되지 않습니다.');
 }
 function heading(title,description){return '<div class="cd-heading"><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div>';}
 function card(title,detail,actions){return '<article class="cd-card"><h4>'+esc(title)+'</h4><p>'+esc(detail)+'</p><div class="cd-actions">'+actions+'</div></article>';}
 function patientCards(q=''){return store.patients.filter(p=>[p.name,p.chartNumber,p.guardianName].join(' ').includes(q)).map(p=>card(p.name,(p.species==='cat'?'고양이':'강아지')+' · '+p.chartNumber+' · '+p.weight+' kg · '+p.guardianName,button('건강검진 시작','healthcheck',p.id)+button('연결 기록 보기','patient',p.id))).join('')||'<p class="cd-empty">검색 결과가 없습니다. ‘체험’으로 검색해 보세요.</p>';}
 function dashboard(){body.innerHTML=heading('가상 병원에서 직접 사용해 보세요','환자 선택 → 기록 작성 → 저장 → 보고서 미리보기까지 체험할 수 있습니다.')+'<div class="cd-steps">'+button('1. 환자 선택','patients')+button('2. 건강검진 예시 열기','healthcheck-example')+button('3. 체험 가능 기능','onboarding')+'</div><div class="cd-grid">'+card('오늘 진료 3명','건강검진·시술·입원 예시 환자',button('환자 목록','patients'))+card('입원 중 1명','체험 보리 · 관찰 기록 예시',button('입원 보드','ward'))+card('물품 주문','주문 필요 1 · 입고 대기 1 · 교환·반품 1',button('물품 관리','purchases'))+'</div>'+heading('오늘 할 일','체크하면 이 체험 창에서만 완료 처리됩니다.')+'<div class="cd-card">'+['체험 두리 · 건강검진 결과 확인','체험 나비 · 시술 설명 준비','체험 보리 · 입원 관찰 확인'].map((x,i)=>'<label class="cd-check"><input type="checkbox" data-demo-task="'+i+'" '+(store.tasks[i]?'checked':'')+'>'+esc(x)+'</label>').join('')+'</div>'+heading('기록과 진료지원','각 메뉴의 가상 예시를 확인할 수 있습니다.')+'<div class="cd-actions">'+['healthcheck','surgery','consents','ledger','bookings','library','followup'].map(k=>button(titles[k],k)).join('')+'</div>';}
 function patients(){body.innerHTML=heading('체험 환자 3명','실제 환자와 보호자 정보는 표시하지 않습니다.')+'<label class="cd-search">환자·보호자·차트번호 검색<input type="search" data-demo-search placeholder="체험 두리 또는 DEMO-001"></label><div class="cd-grid" data-demo-patients>'+patientCards()+'</div>';}
 function patient(id){const p=store.patients.find(x=>x.id===id)||store.patients[0];body.innerHTML=heading(p.name,p.chartNumber+' · '+p.guardianName+' · '+p.weight+' kg')+'<div class="cd-grid">'+card('건강검진 기록','선택한 환자의 기본정보가 작성 화면에 반영됩니다.',button('새 건강검진 시작','healthcheck',p.id))+card('진료지원 예시','마취기록·동의서·입원 관리를 살펴보세요.',button('마취 기록','surgery')+button('동의서','consents')+button('입원 보드','ward'))+'</div>'+button('환자 목록으로','patients');}
 function fields(items,model){return items.map(([key,label,type='text'])=>'<label>'+esc(label)+(type==='textarea'?'<textarea data-demo-field="'+key+'" rows="3">'+esc(model[key])+'</textarea>':'<input data-demo-field="'+key+'" type="'+type+'" value="'+esc(model[key])+'"'+(type==='number'?' min="0.01" step="0.01"':'')+'>')+'</label>').join('');}
 function anesthesia(){body.innerHTML=heading('체험 나비 · 마취 기록 예시','체중과 담당자 입력을 체험할 수 있습니다. 실시간 마취 기록과 약물 계산은 병원 로그인 후 이용합니다.')+'<form class="cd-card cd-form" data-demo-form="anesthesia"><div class="cd-grid">'+fields([['weight','현재 체중 (kg)','number'],['doctor','담당 수의사'],['procedure','시술명'],['note','관찰 메모','textarea']],store.anesthesia)+'</div><button type="submit" class="cd-primary">체험 기록 저장</button></form><div class="cd-table-wrap"><table><caption>관찰 기록 · 가상 예시</caption><thead><tr><th>시각</th><th>심박수</th><th>체온</th><th>기록</th></tr></thead><tbody><tr><td>10:00</td><td>120 회/분</td><td>38.2 ℃</td><td>관찰 시작 예시</td></tr><tr><td>10:15</td><td>118 회/분</td><td>38.1 ℃</td><td>관찰 기록 예시</td></tr></tbody></table></div>'+button('동의서 예시 보기','consents');}
 function consent(){body.innerHTML=heading('동의서 작성 흐름 체험','아래는 간편 체험용 문서입니다. 실제 서명·법정 동의서로 사용할 수 없으며 병원 로그인 후 전체 작성 기능을 이용합니다.')+'<form class="cd-card cd-form" data-demo-form="consent"><div class="cd-grid">'+fields([['patient','환자명'],['title','문서 제목'],['doctor','설명 수의사'],['plan','진료 방법·내용','textarea'],['risk','환자별 주의사항','textarea'],['care','진료 후 안내','textarea']],store.consent)+'</div><div class="cd-actions"><button class="cd-primary" type="submit">체험 초안 저장</button><button type="button" data-demo-consent-preview>내용 미리보기</button></div></form>';}
 function previewConsent(){const dialog=document.createElement('dialog');dialog.className='cd-dialog';dialog.innerHTML='<h3>체험용 문서 · 실제 사용 불가</h3><h4>'+esc(store.consent.title)+'</h4>'+Object.entries({환자:store.consent.patient,'설명 수의사':store.consent.doctor,'진료 방법·내용':store.consent.plan,'환자별 주의사항':store.consent.risk,'진료 후 안내':store.consent.care}).map(([k,v])=>'<h4>'+esc(k)+'</h4><p>'+esc(v)+'</p>').join('')+'<p>서명 수집·외부 전송은 체험에 포함되지 않습니다.</p><button type="button">닫기</button>';root.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();}
 function ward(){body.innerHTML=heading('입원 현황 · 체험 보리','입원실 A-1 · 가상 예시 1명')+'<div class="cd-card"><h4>관찰·처치 확인</h4>'+['09:00 상태 관찰','12:00 급식·음수 확인','15:00 상태 관찰'].map((v,i)=>'<label class="cd-check"><input type="checkbox" data-demo-ward="'+i+'" '+(store.ward[i]?'checked':'')+'>'+v+'</label>').join('')+'<p>확인 상태는 이 창 안에서만 유지됩니다.</p></div>'+button('환자 기록으로','patient','demo-p3');}
 function supplies(){body.innerHTML=heading('물품 관리','주문 필요 → 입고 대기 → 처리 내역 흐름을 체험해 보세요. 실제 주문은 실행하지 않습니다.')+'<div class="cd-steps">'+['주문 필요','입고 대기','교환·반품','처리 내역'].map(s=>'<span>'+s+' <b>'+store.supplies.filter(x=>x.state===s).length+'</b></span>').join('')+'</div><div class="cd-grid">'+store.supplies.map((x,i)=>card(x.name,x.quantity+' '+x.unit+' · '+x.state+(x.urgent?' · 긴급':''),x.state==='처리 내역'?'<span>체험 처리 완료</span>':'<button data-demo-supply="'+i+'">'+(x.state==='주문 필요'?'주문 완료 체험':x.state==='입고 대기'?'입고 처리 체험':'교환 완료 체험')+'</button>')).join('')+'</div>';}
 function guide(key){const entries={
  ledger:['수술대장 예시',['오늘 · 체험 나비 · DEMO-002','시술 기록 예시 · 체험 수의사','환자·마취 기록·동의서를 연결해 확인합니다.']],
  bookings:['시설·장비 예약 예시',['10:00–11:00 · 수술실 · 체험 나비','14:00–14:30 · 초음파실 · 체험 두리','병원 로그인 후 준비·정리 시간과 중복 예약을 관리합니다.']],
  followup:['상담·후속관리 예시',['체험 두리 · 오늘 확인할 업무','D+1 · 보호자 안내 예정','병원 로그인 후 필요한 날짜만 선택하여 문자를 예약합니다. 체험에서는 발송하지 않습니다.']],
  library:['보호자 안내자료 예시',['환자와 안내자료 선택','개별 안내·복약·재진 일정을 입력','보호자용 문서 확인 후 전달']],
  builder:['안내자료 작성 예시',['1. 체험 두리 · 환자 선택','2. 안내 내용·복약·재진 일정 작성','3. 미리보기 후 전달 · 체험에서는 외부 전달을 실행하지 않습니다.']],
  training:['직원 교육 예시',['신규 직원 · 오늘 진료 확인하기','환자 선택 후 필요한 기록 시작하기','담당 업무 완료와 인계 확인하기']],
  sop:['업무지침 예시',['오전 준비 · 진료실과 소모품 확인','진료 중 · 환자 확인과 기록 연결','마감 · 미처리 업무와 다음 일정 확인']],
  ops:['업무 체크리스트 예시',['진료실 준비 확인','예약·입원 환자 확인','마감 시 미처리 업무 인계']],
  intake:['사전문진 예시',['체험 두리 · 문진 접수','보호자 작성 내용 → 병원 확인','확인한 환자 정보로 건강검진 시작']],
  dental:['치과 기록 작성 흐름',['환자 선택 → 기본정보 저장','치아별 소견·처치 기록','저장 후 A4 보고서 미리보기']],
  neuro:['신경검사 기록 작성 흐름',['환자 선택 → 기본정보 저장','신경검사 항목별 소견 입력','검토 후 저장·인쇄']],
  ophthalmic:['안과 기록 작성 흐름',['환자 선택 → 우안·좌안 소견 입력','확인한 항목을 선택해 기록','검토 후 저장·인쇄']],
  chronic:['만성질환 기록 작성 흐름',['환자와 관리 질환 선택','검사·진료 내용과 이전 결과 비교','관리계획 작성 후 저장·인쇄']],
  protocols:['진료 프로토콜 이용 흐름',['질환·증상으로 자료 검색','공통 자료와 병원 자료 확인','본문과 연결된 근거 확인']],
  calc:['처방 계산 이용 안내',['환자와 현재 체중 확인','약물·용량·경로를 확인하여 계산','계산 결과를 검토 후 기록 · 실제 계산은 병원 로그인 후 이용']],
  settings:['병원 설정 안내',['병원 정보·직원 권한 설정','서식과 병원별 운영 설정','체험에서는 실제 설정·계약 조건을 변경하지 않습니다.']],
  account:['계정·구독 안내',['내 계정·직원 권한','요금제·사용량·보안 설정','가입 후 병원에 맞는 설정을 확인할 수 있습니다.']],
  pilot:['운영 통계 예시',['오늘 예시 환자 3명','예시 입원 환자 1명','업무·진료 기록을 기반으로 운영 현황 확인']],
  voice:['문의 안내',['체험을 마친 뒤 로그인 화면에서 가입할 수 있습니다.','실제 문의·요청은 병원 계정으로 로그인한 뒤 이용합니다.']]
 };const entry=entries[key];
  if(entry){body.innerHTML=heading(entry[0],'이 메뉴는 흐름 안내입니다. 전체 입력·관리 기능은 병원 로그인 후 이용합니다.')+'<ol class="cd-card cd-guide">'+entry[1].map(v=>'<li>'+esc(v)+'</li>').join('')+'<div class="cd-actions">'+button('직접 작성 가능한 건강검진','healthcheck')+button('환자 목록','patients')+'</div>';return;}
  body.innerHTML=heading('체험 가능한 기능','입력한 내용은 현재 창의 메모리에만 저장되며 새로고침·종료·초기화 시 지워집니다. 실제 개인정보를 입력하지 마세요.')+'<div class="cd-grid">'+card('직접 작성·미리보기','건강검진은 실제 작성 화면에서 검사값 수정·저장·보고서 미리보기를 체험합니다.',button('건강검진 예시 열기','healthcheck-example'))+card('간편 입력 체험','마취 기본정보·동의서 초안·입원 확인·물품 처리의 예시를 조작할 수 있습니다.',button('마취 기록','surgery')+button('동의서','consents'))+card('실제 연결은 로그인 후','AI 파일 읽기·AI 소견 생성·문자·HOME 전송·결제는 실행하지 않습니다. 나머지 메뉴는 사용 흐름을 안내합니다.',button('오늘 진료로','dashboard'))+'</div>';
 }
 async function healthcheck(patientId,example,token,nav){
  if(!g.HealthcheckRecord){body.innerHTML='<p role="status">건강검진 화면을 불러오는 중입니다…</p>';await g.ClinicLazyModules.ensure('healthcheck');}
  if(!active||epoch!==token||navigation!==nav||!['healthcheck','healthcheck-example'].includes(route))return;
  initHealthcheck();body.hidden=true;hcHost.hidden=false;
  if(!hc){const scope=epoch;hc=g.HealthcheckRecord.mount(hcHost,{demo:true,ready:()=>active&&epoch===scope,identity:()=>String(epoch),can:()=>true,hospital:()=>hospital,request:(p,o)=>{if(!active||epoch!==scope)throw Error('체험 자료가 초기화되었습니다.');return request(p,o);}});}
  if(patientId)await hc.fromPatient(copy(store.patients.find(x=>x.id===patientId)||store.patients[0]));else if(example)await hc.openRecord('demo-hc-0');else hc.open();
 }
 function syncNav(key){
  for(const el of document.querySelectorAll('.sidebar .nav-item[data-view]')){const k=el.dataset.tab||el.dataset.trainingSection||el.dataset.view,on=k===(key==='healthcheck-example'?'healthcheck':key==='patient'?'patients':key);el.classList.toggle('active',on);if(on){el.setAttribute('aria-current','page');const group=el.closest('[data-nav-group]');if(group)group.open=true;}else el.removeAttribute('aria-current');}
  g.ClinicNavigation?.collapseMobile();
 }
 function navigate(key,patientId='',historyMode='push'){
  if(!active)return false;
  if(!hcHost.hidden&&hc?.leave()===false){notify('저장이 끝난 뒤 이동해 주세요.');return false;}
  const nav=++navigation;route=key;body.hidden=false;hcHost.hidden=true;notify('');
  document.getElementById('viewTitle').textContent=titles[key]|| (key==='patient'?'환자 정보':key==='healthcheck-example'?'건강검진 기록':'체험 안내');syncNav(key);
  if(historyMode!=='none')history[historyMode==='replace'?'replaceState':'pushState']({carestepDemo:true,key,patientId},'',location.href);
  if(key==='dashboard')dashboard();else if(key==='patients')patients();else if(key==='patient')patient(patientId);else if(key==='surgery')anesthesia();else if(key==='consents')consent();else if(key==='ward')ward();else if(key==='purchases')supplies();else if(key==='healthcheck'||key==='healthcheck-example')void healthcheck(patientId,key==='healthcheck-example',epoch,nav).catch(e=>{if(!active||nav!==navigation||!['healthcheck','healthcheck-example'].includes(route))return;body.hidden=false;hcHost.hidden=true;body.innerHTML=heading('체험 화면을 불러오지 못했습니다',e.message)+button('다시 불러오기','healthcheck');});else guide(key);
  g.scrollTo(0,0);return true;
 }
 function show(view,opt={}){return navigate(view==='practice'?(opt.practiceTab||'healthcheck'):view==='training'?(opt.trainingSection||'training'):view,'',opt.historyMode||'push');}
 function disposeRecord(){hc?.dispose();hc=null;hcHost?.replaceChildren();}
 function reset(){if(!g.confirm('체험 중 입력한 내용을 지우고 처음 예시로 돌아갈까요? 실제 병원 기록에는 영향이 없습니다.'))return;epoch++;disposeRecord();store=seed();navigate('dashboard','','replace');notify('체험 자료를 처음 상태로 되돌렸습니다.');}
 function stop(){if(!active)return;active=false;epoch++;disposeRecord();root?.remove();root=null;document.body.classList.remove('clinic-demo-active');for(const [el,hidden,cls,current,open] of navSnapshot){el.hidden=hidden;el.className=cls;if(current===null)el.removeAttribute('aria-current');else el.setAttribute('aria-current',current);if(el.tagName==='DETAILS')el.open=open;}for(const [el,text] of headerSnapshot)el.textContent=text;navSnapshot=[];headerSnapshot=[];store=null;}
 function exit(){stop();config?.exit();}
 function start(options){
  stop();config=options;active=true;epoch++;store=seed();
  const main=document.querySelector('#appView .main');root=document.createElement('section');root.id='clinicDemoRoot';root.innerHTML='<aside class="cd-banner"><div><b>체험용 가상 병원</b><span>입력은 현재 창에서만 유지 · 새로고침하면 초기화</span></div><div class="cd-actions"><button data-demo-route="onboarding">체험 안내</button><button data-demo-reset>처음 상태로</button><button data-demo-exit>체험 종료</button></div></aside><p class="cd-note">실제 개인정보는 입력하지 마세요. AI·문자·결제는 실행하지 않습니다.</p><p class="cd-status" role="status" aria-live="polite"></p><div class="cd-body"></div><div data-demo-healthcheck hidden></div>';main.append(root);body=root.querySelector('.cd-body');status=root.querySelector('.cd-status');hcHost=root.querySelector('[data-demo-healthcheck]');
  navSnapshot=[...document.querySelectorAll('.sidebar .nav-item,.sidebar [data-nav-group]')].map(el=>[el,el.hidden,el.className,el.getAttribute('aria-current'),el.open]);for(const [el] of navSnapshot){el.hidden=false;el.classList.remove('saas-hidden','role-ui-hidden');}
  headerSnapshot=['hospitalBadge','saasRoleBadge'].map(id=>{const el=document.getElementById(id);return [el,el.textContent];});document.getElementById('hospitalBadge').textContent='가상 체험 병원';document.getElementById('saasRoleBadge').textContent='체험';
  document.body.classList.add('clinic-demo-active');document.getElementById('loginView').classList.add('hidden');document.getElementById('sessionRestoreView')?.classList.add('hidden');document.getElementById('appView').classList.remove('hidden');
  root.addEventListener('click',e=>{const n=e.target.closest('button');if(!n)return;if(n.hasAttribute('data-demo-route'))navigate(n.dataset.demoRoute,n.dataset.demoPatient);else if(n.hasAttribute('data-demo-reset'))reset();else if(n.hasAttribute('data-demo-exit'))exit();else if(n.hasAttribute('data-demo-supply')){const s=store.supplies[+n.dataset.demoSupply];s.state=s.state==='주문 필요'?'입고 대기':'처리 내역';supplies();notify('체험 상태를 변경했습니다. 실제 주문은 실행하지 않았습니다.');}else if(n.hasAttribute('data-demo-consent-preview')){syncForm(n.closest('form'));previewConsent();}});
  root.addEventListener('input',e=>{const n=e.target;if(n.hasAttribute('data-demo-search'))root.querySelector('[data-demo-patients]').innerHTML=patientCards(n.value.trim());if(n.hasAttribute('data-demo-field'))syncForm(n.closest('form'));});
  root.addEventListener('change',e=>{const n=e.target;if(n.hasAttribute('data-demo-task'))store.tasks[+n.dataset.demoTask]=n.checked;if(n.hasAttribute('data-demo-ward'))store.ward[+n.dataset.demoWard]=n.checked;});
  root.addEventListener('submit',e=>{const f=e.target;if(!f.hasAttribute('data-demo-form'))return;e.preventDefault();syncForm(f);notify('체험 기록을 이 창에 저장했습니다. 실제 병원 기록에는 저장되지 않습니다.');});
  navigate('dashboard','','replace');
 }
 function syncForm(f){if(!f)return;const target=store[f.dataset.demoForm];if(!target)return;for(const n of f.querySelectorAll('[data-demo-field]'))target[n.dataset.demoField]=n.value;}
 document.addEventListener('click',e=>{if(!active)return;const n=e.target.closest('.sidebar .nav-item[data-view]');if(!n)return;e.preventDefault();e.stopImmediatePropagation();show(n.dataset.view,{practiceTab:n.dataset.tab,trainingSection:n.dataset.trainingSection});},true);
 g.addEventListener('popstate',e=>{if(active){e.stopImmediatePropagation();navigate(e.state?.carestepDemo?e.state.key:'dashboard',e.state?.patientId||'','none');}},true);
 g.ClinicDemo={start,stop,exit,show,active:()=>active};
})(window);
