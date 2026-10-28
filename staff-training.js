/* Shared CLINIC/HQ staff learning UI. No patient context or local progress storage. */
(function(global){
 'use strict';
 const assetBase=new URL('.',document.currentScript.src);
 let pdfReady;
 function pdfModule(){if(!pdfReady)pdfReady=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('staff-training-pdf.js?v=20261026edu-review',assetBase).href;const timer=setTimeout(()=>{script.remove();pdfReady=null;reject(Error('PDF 도구를 불러오지 못했습니다. 연결을 확인하고 다시 다운로드해주세요.'));},30000);script.onload=()=>{clearTimeout(timer);if(global.StaffTrainingPDF)resolve(global.StaffTrainingPDF);else{pdfReady=null;reject(Error('PDF 도구를 불러오지 못했습니다.'));}};script.onerror=()=>{clearTimeout(timer);script.remove();pdfReady=null;reject(Error('PDF 도구를 불러오지 못했습니다. 연결을 확인하고 다시 다운로드해주세요.'));};document.head.append(script);});return pdfReady;}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=s=>({draft:'작성 중',review:'검토 대기',published:'승인됨',withdrawn:'공개 중단',deleted:'삭제됨'})[s]||'확인 필요';
 const keys=['clinical','nursing','counseling'];
 const practiceKeys=['objectives','knowledge','workflow','checklist','reporting','scenarios'];
 const practiceLabels=['학습 목표','핵심 지식','업무 순서','업무 체크리스트','보고·인계 기준','상황별 예시'];
 const docKeys=d=>d.body?.format==='practice'?practiceKeys:keys;
 const typeLabel=c=>c.kind==='sop'?'병원 SOP':(c.format||c.body?.format)==='practice'?'병원 실무 교육':'질환·증상 교육';
 const topicOptions=d=>d.body?.format==='practice'?Object.fromEntries(practiceKeys.map((k,i)=>[k,practiceLabels[i]])):supplementTopics;
 const sourceLabel=id=>id==='guardian'?'보호자 원본':/^ref\d+$/.test(id)?'참고 근거 '+id.slice(3):/_w\d+$/.test(id)?'외부 검색 근거':'추가 참고 근거';
 const supplementTopics={pathology:'병태생리·등급',diagnosis:'검사·진단의 이해',surgery:'수술 원리·수술 전후 관리',nursing:'간호 관찰·통증 평가·보고',counseling:'보호자 상담·재진 안내',medication:'약물 관리·주의사항'};
 const supplementStatus=s=>({running:'생성 중',ready:'검토 가능',applied:'반영 완료',failed:'생성 미완료'})[s]||'확인 필요';
 const labels=d=>d.body?.format==='practice'?practiceLabels:d.kind==='sop'?['업무 목적·기준','절차·확인사항','응대·보고']:['임상 핵심','간호·보고 체크리스트','보호자 상담'];
 const shortDate=s=>s?String(s).slice(0,10):'기한 없음';
 function filterCourses(data,tab,query='',category='',courseType=''){
  const courses=tab==='trash'?[...new Map((data.courses||[]).filter(c=>c.deleted_at&&c.owned).sort((a,b)=>a.version-b.version).map(c=>[c.course_deleted_at?'course:'+c.course_id:'version:'+c.id,c])).values()]:(data.courses||[]).filter(c=>!c.deleted_at);
  return courses.filter(c=>tab==='trash'?true:tab==='manage'?(data.actor?.common?c.owned:(c.status==='published'&&c.current_version_id===c.id)):(tab==='sop'?c.kind==='sop'&&((c.owned&&(data.actor?.capabilities.edit||data.actor?.capabilities.review))||(c.status==='published'&&c.current_version_id===c.id)):(c.status==='published'&&c.current_version_id===c.id&&c.kind==='education')))
   .filter(c=>!courseType||(courseType==='practice'?c.format==='practice':c.kind==='education'&&c.format!=='practice'))
   .filter(c=>(!category||c.category===category)&&(!query||[c.title,c.category,c.common?'공통':'우리 병원'].join(' ').toLowerCase().includes(query.toLowerCase())));
 }
 function sortCourses(rows,order='number'){
  const name=(a,b)=>String(a.title).localeCompare(String(b.title),'ko',{numeric:true})||String(a.course_id).localeCompare(String(b.course_id))||b.version-a.version;
  return [...rows].sort(order==='recent'?(a,b)=>String(b.groupUpdatedAt||b.updated_at).localeCompare(String(a.groupUpdatedAt||a.updated_at))||name(a,b):name);
 }
 function groupCourses(rows){
  const groups=new Map();for(const row of rows){if(!groups.has(row.course_id))groups.set(row.course_id,[]);groups.get(row.course_id).push(row);}
  return [...groups.values()].map(versions=>{versions.sort((a,b)=>b.version-a.version);const published=versions.find(v=>v.status==='published'&&v.current_version_id===v.id);return {...(published||versions[0]),versions,groupUpdatedAt:versions.map(v=>v.updated_at||'').sort().at(-1)};});
 }
 function mount(root,adapter){
  if(!root)throw Error('Training root missing');
  root.classList.add('staff-training');
  let data=null,tab=adapter.common?'manage':'library',query='',category='',courseType='',sequence=0,identity='',busy=false,dialog=null,dirty=false,activeDoc=null,activeAssignment=null,activeSupplement=null,requestKey='',message='',sort='number',view='',tabState={},returnFocus=null,manageView='assign',mineFilter='all',mineQuery='',reportQuery='',reportMember='',reportState='all',reportDue='all',reportPage=0;
  const ready=()=>!adapter.isReady||adapter.isReady();
  const actor=()=>data?.actor||{capabilities:{}};
  const btn=(text,action,extra='',primary=false)=>`<button type="button" class="st-button ${primary?'st-primary':''}" data-st="${action}" ${extra}>${esc(text)}</button>`;
  function notice(text,error=false){message=text;const el=root.querySelector('[data-status]');if(el){el.textContent=text;el.classList.toggle('st-error',error);}const de=dialog?.querySelector('[data-dialog-status]');if(de){de.textContent=text;de.classList.toggle('st-error',error);}}
  function remember(){tabState[tab]={query,category,courseType,sort,view,scroll:global.scrollY};}
  function switchTab(value){if(value===tab)return;remember();++sequence;tab=value;const state=tabState[tab]||{};query=state.query||'';category=state.category||'';courseType=state.courseType||'';sort=state.sort||'number';view=state.view||(tab==='sop'?'list':'cards');message='';render();const button=root.querySelector('[data-tab="'+tab+'"]');button?.focus({preventScroll:true});requestAnimationFrame(()=>{if(state.scroll!=null)global.scrollTo({top:state.scroll,behavior:'instant'});else global.CarestepTabPosition?.reveal(root.querySelector('.st-tabs'));});}
  const localToday=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
  function learningState(a){return a.completed_at?'done':a.status!=='published'?'unavailable':a.due_date&&a.due_date<localToday()?'overdue':a.opened_at?'learning':'new';}
  function trainingControls(){const toolbar=root.querySelector('.st-toolbar');if(!toolbar)return;const details=document.createElement('details');details.className='st-filter-options';details.innerHTML='<summary>정렬·보기</summary><div></div>';for(const key of ['sort','layout']){const label=toolbar.querySelector('[data-'+key+']')?.closest('label');if(label)details.lastElementChild.append(label);}toolbar.append(details);}
  function tabCourses(){return filterCourses(data,tab,'','','');}
  function shell(){
   root.innerHTML=`<header class="st-heading"><div><span class="st-eyebrow">${adapter.common?'CARESTEP HQ':'CARESTEP CLINIC'}</span><h1>${adapter.common?'직원 공통 교육 관리':'직원 교육'}</h1><p>${adapter.common?'승인한 공통 교육자료를 각 병원 교육센터에 제공합니다.':'환자 선택 없이 교육자료를 찾고, 배정된 교육을 이어서 학습하세요.'}</p></div>${btn('새로고침','refresh')}</header><p data-status class="st-status" role="status" aria-live="polite"></p><div data-content></div>`;
  }
  function render(){
   const expanded=[...root.querySelectorAll('.st-card-manage[open]')].map(e=>e.dataset.course);shell();notice(message);const host=root.querySelector('[data-content]');
   if(!data){host.innerHTML='<div class="st-empty">직원 교육자료를 불러오고 있습니다.</div>';return;}
   const can=actor().capabilities;
   if((tab==='manage'&&!can.edit&&!can.review&&!can.manage)||(tab==='trash'&&!can.edit&&!can.review))tab='library';
   const tabs=adapter.common?[['manage','공통 교육 관리'],['library','공개 자료']]:[['mine','내 교육'],['library','교육자료실'],['sop','병원 SOP'],...(can.edit||can.review||can.manage?[['manage','교육 배정·이수']]:[])];
   if(can.edit||can.review)tabs.push(['trash','삭제한 자료']);
   const mine=data.assignments.filter(a=>a.user_id===actor().userId),pending=mine.filter(a=>!a.completed_at&&a.status==='published').length;
   host.innerHTML=`<nav class="st-tabs" aria-label="교육센터 메뉴">${tabs.map(([id,label])=>`<button type="button" data-st="tab" data-tab="${id}" aria-current="${tab===id?'page':'false'}">${label}${id==='mine'&&pending?` <span>${pending}</span>`:''}</button>`).join('')}</nav>
    ${tab==='sop'?'<p class="st-info">병원 SOP는 직원이 따라야 할 업무 절차입니다. 실제 수행·완료 기록은 병원 운영의 업무 체크리스트에서 관리합니다.</p>':''}
    ${tab==='trash'?'<p class="st-info">삭제한 자료는 직원에게 표시되지 않습니다. 본문과 이수 기록은 보존되며, 복원해도 자동으로 다시 공개되지 않습니다.</p>':''}
    ${tab==='manage'&&!adapter.common?'<nav class="st-subtabs" aria-label="교육 관리 작업">'+btn('교육 배정','manage-view','data-view="assign" aria-pressed="'+(manageView==='assign')+'"')+btn('이수 현황','manage-view','data-view="report" aria-pressed="'+(manageView==='report')+'"')+'</nav>':''}
    ${tab==='mine'?`<div class="st-summary"><b>학습할 교육 ${pending}개</b><span>이수 ${mine.filter(a=>a.completed_at).length}개 · 읽던 자료와 이수 기록은 서버에 저장됩니다.</span></div>`:''}
    ${tab!=='mine'&&!(tab==='manage'&&!adapter.common&&manageView==='report')?`<div class="st-toolbar"><label>교육자료 검색<input type="search" data-search placeholder="질환·실무 주제·교육 제목" value="${esc(query)}"></label><label>분류<select data-category><option value="">전체 분류</option>${[...new Set(tabCourses().map(x=>x.category).filter(Boolean))].sort().map(c=>`<option ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>정렬<select data-sort><option value="number" ${sort==='number'?'selected':''}>번호·제목순</option><option value="recent" ${sort==='recent'?'selected':''}>최근 수정순</option></select></label><label>보기<select data-layout><option value="cards" ${(view||'cards')==='cards'&&tab!=='sop'?'selected':''}>카드</option><option value="list" ${view==='list'||!view&&tab==='sop'?'selected':''}>목록</option></select></label>${!['sop','trash'].includes(tab)?`<label>교육 종류<select data-course-type aria-label="교육 종류"><option value="">전체 교육</option><option value="disease" ${courseType==='disease'?'selected':''}>질환·증상 교육</option><option value="practice" ${courseType==='practice'?'selected':''}>병원 실무 교육</option></select></label>`:''}${adapter.common&&can.edit&&tab==='manage'?btn('일괄 생성·진행 현황','automation'):''}${can.edit&&((adapter.common&&tab==='manage')||(!adapter.common&&tab==='sop'))?btn(tab==='sop'?'SOP 작성':'교육자료 만들기','create','',true):''}</div>`:''}
    ${tab==='manage'&&!adapter.common?(manageView==='report'?`<section class="st-report"><h2>직원별 교육 현황</h2>${can.manage?'<div data-report></div>':'<p>교육 관리 권한이 필요합니다.</p>'}</section>`:'<p class="st-info">공통 자료는 HQ에서 제작합니다. 교육자료를 선택하고 교육받을 직원을 지정하세요.</p>'):''}
    ${tab==='mine'?'<div class="st-mine-controls"><label>내 교육 검색<input type="search" data-mine-search value="'+esc(mineQuery)+'" placeholder="교육 제목"></label><label>학습 상태<select data-mine-filter>'+[['pending','미완료'],['overdue','기한 초과'],['learning','학습 중'],['new','학습 전'],['done','이수 완료'],['all','전체 · 미완료 우선']].map(([id,label])=>'<option value="'+id+'" '+(mineFilter===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>':''}<div data-list ${tab==='manage'&&!adapter.common&&manageView==='report'?'hidden':''}></div>`;
   trainingControls();renderList();renderReport();root.querySelectorAll('.st-card-manage').forEach(e=>{e.open=expanded.includes(e.dataset.course);});
  }
  function renderList(){
   const host=root.querySelector('[data-list]');if(!host||!data)return;
   if(tab==='mine'){
    const priorities={overdue:0,learning:1,new:2,unavailable:3,done:4};const rows=data.assignments.filter(a=>a.user_id===actor().userId).filter(a=>(mineFilter==='all'||mineFilter==='pending'&&!a.completed_at||learningState(a)===mineFilter)&&(!mineQuery||a.title.toLowerCase().includes(mineQuery.trim().toLowerCase()))).sort((a,b)=>priorities[learningState(a)]-priorities[learningState(b)]||String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))||a.title.localeCompare(b.title,'ko'));
    host.innerHTML=rows.length?`<div class="st-grid">${rows.map(a=>`<article class="st-card"><span class="st-tag ${a.completed_at?'st-approved':''}">${a.completed_at?'이수 완료':a.status==='deleted'?'자료 삭제됨':a.status!=='published'?'공개 중단':learningState(a)==='overdue'?'기한 초과':a.opened_at?'학습 중':'학습 전'}</span><h2>${esc(a.title)}</h2><p>v${a.version} · ${a.completed_at?'이수일 '+shortDate(a.completed_at):'기한 '+shortDate(a.due_date)}</p>${a.score!=null?`<p>최근 점수 ${a.score}점</p>`:''}${a.status==='deleted'?'<p>자료 삭제됨 · 기존 이수 기록은 보존됩니다.</p>':''}${a.status==='published'?btn(a.completed_at?'다시 보기':a.opened_at?'학습 이어가기':'학습 시작','learn',`data-id="${esc(a.version_id)}" data-assignment="${esc(a.id)}"`,!a.completed_at):'<p>관리자에게 최신 교육자료를 확인해주세요.</p>'}</article>`).join('')}</div>`:'<div class="st-empty"><b>'+(data.assignments.some(a=>a.user_id===actor().userId)?'현재 조건에 맞는 교육이 없습니다.':'아직 배정된 교육이 없습니다.')+'</b><p>학습 상태를 바꾸거나 교육자료실에서 학습을 시작하세요.</p></div>';
    return;
   }
   const filtered=filterCourses(data,tab,query,category,['sop','trash'].includes(tab)?'':courseType);
   const rows=sortCourses(tab==='sop'?groupCourses(filtered):filtered,sort);
   if(tab==='trash'){
    host.innerHTML='<p class="st-count">'+rows.length+'개 자료</p>'+(rows.length?'<div class="st-grid">'+rows.map(c=>`<article class="st-card"><span class="st-tag">삭제됨 · ${c.common?'공통':'우리 병원'}</span><h2>${esc(c.title)}</h2><p>${esc(typeLabel(c))} · 삭제 ${shortDate(c.deleted_at)}</p><p>${c.course_deleted_at?'자료 전체':'v'+c.version+' 버전'} · 이수 기록 보존</p>${canDelete(c)?btn('복원',c.course_deleted_at?'restore-course':'restore-version',`data-course="${esc(c.course_id)}" data-id="${esc(c.id)}"`):'<p>공개 검토 권한이 있는 관리자에게 복원을 요청해주세요.</p>'}</article>`).join('')+'</div>':'<div class="st-empty">삭제한 자료가 없습니다.</div>');return;
   }
   const active=[query&&'검색: '+query,category,courseType&&({disease:'질환·증상 교육',practice:'병원 실무 교육'})[courseType]].filter(Boolean);
   host.innerHTML=(active.length?'<div class="st-filter-state"><span>'+active.map(esc).join(' · ')+'</span>'+btn('조건 해제','clear')+'</div>':'')+
    '<p class="st-count">'+rows.length+'개 자료'+(active.length?' · 검색 결과':'')+'</p>'+(rows.length?'<div class="st-grid '+((view|| (tab==='sop'?'list':'cards'))==='list'?'st-list-view':'')+'">'+rows.map(c=>courseCard(c)).join('')+'</div>':'<div class="st-empty"><b>'+(active.length?'조건에 맞는 자료가 없습니다.':'아직 표시할 자료가 없습니다.')+'</b><p>'+(active.length?'현재 탭의 검색 조건을 해제하거나 바꿔주세요.':tab==='sop'?'병원에서 사용하는 업무 절차를 작성하고 검토 후 공개하세요.':'HQ에서 공개한 교육자료를 여기에서 확인할 수 있습니다.')+'</p>'+(active.length?btn('검색 초기화','clear'):'')+'</div>');
  }
  function courseCard(c){
   const own=c.owned&&(adapter.common||c.kind==='sop'),can=actor().capabilities,versions=c.versions||[c],draft=versions.find(v=>['draft','review'].includes(v.status));
   return '<article class="st-card"><div class="st-card-main"><div class="st-card-tags"><span class="st-tag">'+esc(typeLabel(c))+' · '+(c.common?'공통':'우리 병원')+'</span><span class="st-tag '+(c.status==='published'?'st-approved':'')+'">'+status(c.status)+' · v'+c.version+'</span>'+(draft&&draft.id!==c.id?'<span class="st-tag st-draft">'+status(draft.status)+' · v'+draft.version+'</span>':'')+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.category||'미분류')+' · 수정 '+shortDate(c.updated_at)+'</p></div><div class="st-actions">'+btn(own?'자료·검토 열기':'자료 보기','document','data-id="'+esc(c.id)+'"',true)+(!adapter.common&&c.status==='published'&&c.current_version_id===c.id&&can.manage?btn('직원 배정','assign','data-id="'+esc(c.id)+'"'):'')+(own&&can.edit?btn(draft?'수정본 이어쓰기':['published','withdrawn'].includes(c.status)?'수정본 작성':'내용 수정','edit-course','data-id="'+esc(draft?.id||c.id)+'"'):'')+(own&&(can.edit||can.review)?'<details class="st-card-manage" data-course="'+esc(c.course_id)+'"><summary>버전 관리 · '+versions.length+'개</summary><div>'+versions.map(v=>'<section><b>v'+v.version+' · '+status(v.status)+'</b><div class="st-actions">'+btn('이 버전 열기','document','data-id="'+esc(v.id)+'"')+(can.review&&v.status==='withdrawn'?btn('다시 공개','reopen-publication','data-id="'+esc(v.id)+'"'):'')+(canDelete(v)?btn('버전 삭제','delete-version','data-id="'+esc(v.id)+'" data-danger'):'')+'</div></section>').join('')+'</div></details>':'')+'</div></article>';
  }

  function renderReport(){
   const host=root.querySelector('[data-report]');if(!host)return;
   const members=[...new Map(data.assignments.map(a=>[a.user_id,a.display_name])).entries()];
   host.innerHTML='<div class="st-summary"><b>미완료 '+data.assignments.filter(a=>!a.completed_at&&a.status==='published').length+'건</b><span>기한 초과 '+data.assignments.filter(a=>learningState(a)==='overdue').length+'건 · 이수 완료 '+data.assignments.filter(a=>a.completed_at).length+'건</span></div><div class="st-report-filters"><label>직원·교육 검색<input type="search" data-report-query value="'+esc(reportQuery)+'"></label><label>직원<select data-report-member><option value="">전체 직원</option>'+members.map(([id,name])=>'<option value="'+esc(id)+'" '+(reportMember===id?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label><label>학습 상태<select data-report-state>'+[['all','전체'],['new','학습 전'],['learning','학습 중'],['done','이수 완료'],['unavailable','자료 이용 불가']].map(([id,label])=>'<option value="'+id+'" '+(reportState===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>교육 기한<select data-report-due>'+[['all','전체 기한'],['overdue','기한 초과'],['upcoming','7일 이내'],['none','기한 없음']].map(([id,label])=>'<option value="'+id+'" '+(reportDue===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div><div data-report-rows></div>';
   host.querySelector('[data-report-query]').oninput=e=>{reportQuery=e.target.value;reportPage=0;renderReportRows();};for(const [key,set] of [['member',v=>reportMember=v],['state',v=>reportState=v],['due',v=>reportDue=v]])host.querySelector('[data-report-'+key+']').onchange=e=>{set(e.target.value);reportPage=0;renderReportRows();};renderReportRows();
  }
  function renderReportRows(){
   const host=root.querySelector('[data-report-rows]');if(!host)return;const today=localToday(),soon=new Date(Date.parse(today)+7*86400000).toISOString().slice(0,10),query=reportQuery.trim().toLowerCase();
   const rows=data.assignments.filter(a=>(!reportMember||a.user_id===reportMember)&&(!query||[a.display_name,a.title].join(' ').toLowerCase().includes(query))&&(reportState==='all'||(reportState==='new'?!a.completed_at&&a.status==='published'&&!a.opened_at:reportState==='learning'?!a.completed_at&&a.status==='published'&&a.opened_at:learningState(a)===reportState))&&(reportDue==='all'||reportDue==='none'&&!a.due_date||reportDue==='overdue'&&learningState(a)==='overdue'||reportDue==='upcoming'&&!a.completed_at&&a.status==='published'&&a.due_date>=today&&a.due_date<=soon));
   const pages=Math.max(1,Math.ceil(rows.length/20));reportPage=Math.min(reportPage,pages-1);const shown=rows.slice(reportPage*20,reportPage*20+20);
   host.innerHTML='<p class="st-count" role="status">'+rows.length+'건 · '+(reportPage+1)+' / '+pages+'쪽</p>'+(rows.length?'<div class="st-table-wrap" tabindex="0" aria-label="직원별 교육 현황"><table><thead><tr><th>직원</th><th>교육자료</th><th>기한</th><th>학습 상태</th></tr></thead><tbody>'+shown.map(a=>'<tr><td data-label="직원">'+esc(a.display_name)+'</td><td data-label="교육자료">'+esc(a.title)+' <small>v'+a.version+'</small></td><td data-label="기한">'+shortDate(a.due_date)+'</td><td data-label="학습 상태">'+({done:'이수 완료',overdue:'기한 초과',learning:'학습 중',new:'학습 전',unavailable:'자료 이용 불가'})[learningState(a)]+(a.completed_at&&a.score!=null?' · '+a.score+'점':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="st-empty">조건에 맞는 교육 기록이 없습니다.</p>')+'<div class="st-actions">'+btn('이전','report-page','data-step="-1" '+(reportPage===0?'disabled':''))+btn('다음','report-page','data-step="1" '+(reportPage===pages-1?'disabled':''))+'</div>';
  }
  async function load(){
   const current=adapter.identity?.()||'';
   if(current!==identity){mineFilter='all';mineQuery='';reportQuery='';reportMember='';reportState='all';reportDue='all';reportPage=0;manageView='assign';identity=current;tabState={};sort='number';view='';data=null;query='';category='';courseType='';if(dialog){dirty=false;closeDialog();}}
   if(!ready()){data=null;shell();notice('병원 직원 계정으로 로그인하면 교육센터를 사용할 수 있습니다.');return;}
   const seq=++sequence;if(!data){shell();root.querySelector('[data-content]').innerHTML='<div class="st-empty st-loading" aria-busy="true">교육자료와 내 교육을 불러오는 중입니다…</div>';}else notice('목록을 업데이트하는 중입니다. 기존 자료를 계속 볼 수 있습니다.');
   try{const result=await adapter.request('/',{method:'GET'});if(seq!==sequence||current!==(adapter.identity?.()||''))return;const y=global.scrollY,focused=root.contains(document.activeElement)?document.activeElement:null,field=focused?.matches('input,select')?Object.keys(focused.dataset)[0]:'',caret=focused?.selectionStart;data=result;message='';render();if(field){const el=root.querySelector('[data-'+field.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']');el?.focus({preventScroll:true});if(caret!=null)el?.setSelectionRange?.(caret,caret);global.scrollTo({top:y,behavior:'instant'});}}
   catch(e){if(seq!==sequence)return;if(!data){shell();root.querySelector('[data-content]').innerHTML=btn('다시 불러오기','refresh');}notice((e.message||'교육자료를 불러오지 못했습니다.')+(data?' 기존 목록을 유지했습니다. 새로고침으로 다시 확인해주세요.':''),true);}
  }
  function closeDialog(){
   if(busy){notice('처리 결과를 확인하고 있습니다.');return false;}
   if(dirty&&!global.confirm('저장하지 않은 변경사항을 취소하고 닫을까요?'))return false;
   const old=dialog;dialog=null;dirty=false;activeDoc=null;activeAssignment=null;activeSupplement=null;
   if(old){old.close();old.remove();returnFocus?.focus?.();}return true;
  }
  function showDialog(title,body,wide=false){
   if(dialog&&!closeDialog())return false;
   returnFocus=document.activeElement;dialog=document.createElement('dialog');dialog.className='st-dialog'+(wide?' st-wide':'');dialog.setAttribute('aria-labelledby','stDialogTitle');
   dialog.innerHTML=`<header><h2 id="stDialogTitle">${esc(title)}</h2>${btn('닫기','close')}</header><p class="st-status" data-dialog-status role="status" aria-live="polite"></p><div class="st-dialog-body">${body}</div>`;
   dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
   dialog.addEventListener('click',handle);dialog.addEventListener('input',()=>{if(dialog?.querySelector('[data-editor],[data-supplement-create],[data-supplement-apply],[data-gap-review]'))dirty=true;});
   document.body.append(dialog);dialog.showModal();return true;
  }
  async function mutate(action){
   if(busy)return;
   const current=identity,epoch=sequence;busy=true;root.setAttribute('aria-busy','true');
   const controls=[...root.querySelectorAll('button'),...(dialog?.querySelectorAll('button')||[])];controls.forEach(b=>{b.dataset.wasDisabled=b.disabled?'1':'0';b.disabled=true;});
   try{return await action(()=>epoch===sequence&&current===(adapter.identity?.()||''));}
   catch(e){if(epoch===sequence)notice(e.message||'요청 결과를 확인하지 못했습니다. 새로고침 후 상태를 확인해주세요.',true);}
   finally{busy=false;root.removeAttribute('aria-busy');controls.forEach(b=>{b.disabled=b.dataset.wasDisabled==='1';delete b.dataset.wasDisabled;});}
  }
  const request=(p,body,method='POST')=>adapter.request(p,{method,body:JSON.stringify(body)});
  function sourceView(sources){
   return `<details class="st-sources"><summary>원본·참고 근거 ${sources.length}개</summary>${sources.map(s=>`<article><b>${esc(s.title)}</b><p>${s.contentId?(s.kind==='builtin'?'기본 자료 · 원본 기준 '+esc(s.version):'중앙 게시 자료 · v'+esc(s.version)):s.kind==='web_search_summary'?'AI 검색 요약 · 원문 확인 필요 · 검색일 '+shortDate(s.retrievedAt):'검토용 참고자료'} · ${sourceLabel(s.id)}</p>${s.url&&/^https?:\/\//.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">근거 원문 열기</a>`:''}<p>${esc(s.excerpt||s.content?.description||'')}</p>${s.content?.sections?`<ul>${s.content.sections.flatMap(x=>x.items.map(i=>`<li>${esc(i)}</li>`)).join('')}</ul>`:''}</article>`).join('')}</details>`;
  }
  async function openDocument(id,assignmentId='',edit=false,reopen=false){
   const current=identity,seq=++sequence;notice('교육자료를 여는 중입니다.');
   try{
    const result=await adapter.request('/versions/'+encodeURIComponent(id),{method:'GET'});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const d=result.document,names=labels(d);
    const canEdit=!d.generating&&d.editable&&(adapter.common||d.kind==='sop')&&actor().capabilities.edit,canReview=!d.generating&&d.editable&&(adapter.common||d.kind==='sop')&&actor().capabilities.review,canLearn=!adapter.common&&d.status==='published';
    const mine=data.assignments.find(a=>a.version_id===id&&a.user_id===actor().userId);
    const aid=assignmentId||mine?.id||'';
   if(aid&&canLearn&&!mine?.completed_at)await request('/assignments/'+encodeURIComponent(aid)+'/open',{});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const body=`<div class="st-doc-meta"><span class="st-tag">${esc(typeLabel(d))} · ${d.common?'공통':'우리 병원'} · v${d.version}</span><span class="st-tag">${status(d.status)}</span>${d.reviewedAt?`<span>승인 ${shortDate(d.reviewedAt)}</span>`:''}</div>
     <div class="st-reading-actions">${btn('PDF 다운로드','download')}${canLearn&&!aid?btn('내 교육으로 시작','enroll','',true):''}${aid&&canLearn?btn('학습 확인으로 이동','section','data-section="stAssessment"'):''}</div>
     <nav class="st-doc-toc" aria-label="교육자료 목차">${d.body.sections.map((section,i)=>btn(names[i],'section','data-section="stSection'+i+'"')).join('')}</nav>
     ${d.generating?'<p class="st-info" role="status">AI가 초안을 작성 중입니다. 잠시 후 닫고 새로고침하면 결과를 확인할 수 있습니다.</p>':''}${d.body.config?`<p class="st-info">${esc(d.body.config.audience)} · ${esc(d.body.config.level)} · ${esc(d.body.config.topic)}</p>`:''}
     ${d.body.gaps.length?`<aside class="st-warning"><b>추가 검토 필요 · ${d.body.gaps.length}개</b><ul>${d.body.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>${canEdit&&d.kind==='education'&&d.supplementEnabled&&['draft','review'].includes(d.status)?btn('부족한 내용 AI 보완','supplement-create','',true):''}${canReview&&['draft','review'].includes(d.status)?btn('검토 항목 정리','review-gaps'):''}</aside>`:''}
     ${(d.body.gapReviews||[]).some(r=>r.disposition==='guidance')?`<aside class="st-info"><b>적용 전 확인사항</b><ul>${[...new Set(d.body.gapReviews.filter(r=>r.disposition==='guidance').map(r=>r.note))].map(note=>`<li>${esc(note)}</li>`).join('')}</ul></aside>`:''}
     ${d.editable&&(d.body.gapReviews||[]).length?`<details class="st-sources"><summary>검토 항목 처리 이력 · ${d.body.gapReviews.length}개</summary>${d.body.gapReviews.map(r=>`<p><b>${r.disposition==='resolved'?'보완 완료':'적용 전 확인'} · ${esc(r.reviewerName)} · ${shortDate(r.at)}</b><br>${esc(r.text)}<br>${esc(r.note)}</p>`).join('')}</details>`:''}
     ${d.body.sections.some(s=>s.items.some(x=>x.sourceIds?.length))?`<div class="st-reading-tools"><span>참고 근거는 본문 아래에서 확인할 수 있습니다.</span>${btn('문장별 근거 보기','toggle-citations','aria-expanded="false" aria-controls="stDocumentReading"')}</div>`:''}<div class="st-reading" id="stDocumentReading">${d.body.sections.map((s,i)=>`<section id="stSection${i}" tabindex="-1"><h3>${names[i]}</h3>${s.items.length?`<ul${['nursing','checklist'].includes(s.key)?' class="st-checklist"':''}>${s.items.map(x=>`<li>${esc(x.text)}${x.sourceIds?.length?` <small class="st-citation" data-item-sources hidden>근거: ${supplementLinks(x.sourceIds,d.sources)}</small>`:''}</li>`).join('')}</ul>`:'<p class="st-muted">작성할 내용이 없습니다.</p>'}</section>`).join('')}</div>${sourceView(d.sources)}
     <div class="st-actions">${canEdit&&['draft','review'].includes(d.status)?btn('내용 수정','edit'):''}${canEdit&&d.status==='draft'?btn('검토 요청','review','',true):''}${canReview&&d.status==='review'?btn('검토 후 승인','approve','',true):''}${canReview&&d.status==='withdrawn'?btn('다시 공개','approve','',true):''}${canEdit&&['published','withdrawn'].includes(d.status)?btn('수정본 만들기','revision-dialog'):''}${canReview&&d.status==='published'?btn('공개 중단','withdraw'):''}${canDelete(data.courses.find(c=>c.id===d.id))?btn('버전 삭제','delete-version',`data-id="${esc(d.id)}" data-danger`):''}</div>
     ${!adapter.common&&d.common?'<p class="st-info">공통 교육자료의 수정·삭제는 HQ에서 관리합니다.</p>':''}
     ${aid&&canLearn?`<section class="st-assessment" id="stAssessment" tabindex="-1"><h3>${mine?.completed_at?'이수한 교육':'학습 확인'}</h3>${mine?.completed_at?`<p>${shortDate(mine.completed_at)} · ${mine.score}점으로 이수했습니다.</p>`:`<p>${d.body.quiz.length?'5문항 중 4문항 이상 정답이면 이수됩니다.':'자료 내용을 확인한 후 이수를 기록합니다.'}</p><form data-quiz>${d.body.quiz.map((q,i)=>`<fieldset><legend>${i+1}. ${esc(q.question)}</legend>${q.options.map((o,j)=>`<label class="st-choice"><input type="radio" name="answer${i}" value="${j}" required> ${esc(o)}</label>`).join('')}</fieldset>`).join('')}<label class="st-choice"><input type="checkbox" name="confirmRead" required> 교육자료를 읽고 내용을 확인했습니다.</label>${btn(d.body.quiz.length?'답안 제출':'이수 기록','attempt','',true)}</form><div data-feedback></div>`}</section>`:''}
     ${adapter.common&&canEdit&&d.kind==='education'?`<section class="st-supplement-entry"><h3>교육 내용 보완</h3><p>부족한 항목을 선택하면 근거를 찾아 별도 보완안을 만듭니다. 검토한 내용만 기존 초안에 추가할 수 있습니다.</p>${d.supplementEnabled&&['draft','review'].includes(d.status)?(d.body.gaps.length?'':btn('부족한 내용 AI 보완','supplement-create','',true)):`<p class="st-muted">${d.supplementEnabled?'새 버전을 작성한 뒤 보완할 수 있습니다.':'AI 보완 저장 공간 적용이 필요합니다.'}</p>`}${d.supplements?.length?`<details open class="st-sources"><summary>보완 이력 ${d.supplements.length}개</summary>${d.supplements.map(s=>`<div class="st-actions st-supplement-history"><span>${shortDate(s.created_at)} · ${supplementStatus(s.status)}${s.base_revision!==d.revision&&s.status==='ready'?' · 이전 본문 기준':''}</span>${btn('보완안 열기','supplement-open',`data-id="${esc(s.id)}"`)}</div>`).join('')}</details>`:''}</section>`:''}
     ${d.editable&&d.body.quiz.length?`<details class="st-sources"><summary>검토자용 평가문항·정답</summary>${d.body.quiz.map((q,i)=>`<p><b>${i+1}. ${esc(q.question)}</b><br>${q.options.map((o,j)=>`${j+1}. ${esc(o)}`).join(' / ')}<br>정답: ${esc(q.options[q.answer])}<br>${esc(q.explanation)} · 근거 ${q.sourceIds.map(sourceLabel).join(', ')}</p>`).join('')}</details>`:''}
     ${d.audit?.length?`<details class="st-sources"><summary>작성·검토 이력</summary>${d.audit.map(x=>`<p>${esc(x.at.replace('T',' ').slice(0,16))} · ${esc(({create:'초안 생성',practice_generate:'실무 교육 초안 생성',edit:'내용 수정',review:'검토 요청',publish:'승인·공개',republish:'검토·재공개',revise:'수정본 작성',delete:'자료 전체 삭제',restore:'자료 전체 복원',version_delete:'버전 삭제',version_restore:'버전 복원',withdraw:'공개 중단',assign:'교육 배정',enroll:'학습 시작',supplement_generate:'AI 보완안 생성',supplement_apply:'보완안 선택 반영',gap_review:'검토 항목 처리'})[x.action]||x.action)} · ${esc(x.detail?.reviewerName||x.actor)}</p>`).join('')}</details>`:''}`;
    if(!showDialog(d.title,body,true))return;activeDoc=d;activeAssignment=aid;requestKey=global.crypto.randomUUID().replaceAll('-','');notice('');if(edit&&canEdit){if(['draft','review'].includes(d.status))editDocument();else revisionDialog();}if(reopen&&canReview&&d.status==='withdrawn')approvalDialog();
   }catch(e){notice(e.message||'자료를 열지 못했습니다.',true);}
  }
  function canDelete(c){return !!c?.owned&&((c.course_deleted_at?c.history_published:c.version_review_required??['published','withdrawn'].includes(c.status))?actor().capabilities.review:actor().capabilities.edit);}
  function revisionDialog(){
   const d=activeDoc;
   const existing=data.courses.find(c=>c.course_id===d.courseId&&['draft','review'].includes(c.status)&&!c.deleted_at);
   const body=`<p class="st-lifecycle-title"><b>${esc(d.title)}</b></p><p>승인된 본문과 기존 이수 기록은 유지됩니다. 수정본은 의료진 검토·승인 후 직원에게 공개됩니다.</p>${existing?'<p class="st-info">이미 작성 중인 수정본이 있습니다. 이어서 수정해주세요.</p>':''}<div class="st-actions">${existing?btn('작성 중인 수정본 열기','edit-course',`data-id="${esc(existing.id)}"`,true):btn('수정본 만들고 편집','revise','',true)}${btn('취소','close')}</div>`;
   if(showDialog('교육자료 수정',body))activeDoc=d;
  }
  async function lifecycleDialog(id,action,whole=false){
   const current=identity,seq=++sequence;notice('자료 상태와 배정·이수 기록을 확인하고 있습니다.');
   try{
    const scope=whole?'courses':'versions',info=await adapter.request('/'+scope+'/'+encodeURIComponent(id)+'/impact',{method:'GET'});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const removing=action==='delete';
    if(removing?!!info.deletedAt:!info.deletedAt){notice('자료 상태가 변경되었습니다. 새로고침 후 다시 확인해주세요.',true);return;}
    const explanation=whole?'전체 자료를 관리 목록으로 복원합니다. 이전에 공개됐던 버전은 공개 중단 상태로 유지됩니다.':removing?`v${info.version}만 삭제합니다. 다른 버전 ${info.otherVersions}개와 해당 버전들의 공개 상태는 유지됩니다. ${info.current?'현재 공개 중인 이 버전의 학습은 중단됩니다. 이전 버전은 자동으로 공개되지 않습니다.':''} 본문과 기존 점수·이수 기록은 보존되며 삭제한 자료에서 복원할 수 있습니다.`:`v${info.version}만 관리 목록으로 복원합니다. 다른 버전의 공개 상태는 유지됩니다. ${['draft','review'].includes(info.previousStatus)?'작성 중 상태로 돌아갑니다.':'공개 중단 상태로 돌아가며 자동으로 다시 공개되지 않습니다.'}`;
    const body=`<p class="st-lifecycle-title"><b>${esc(info.title)}</b></p><span class="st-tag">${info.common?'공통 자료':'우리 병원 자료'} · ${whole?'자료 전체':'v'+info.version}</span><dl class="st-lifecycle-counts"><div><dt>${whole?'전체 버전':'선택한 버전'}</dt><dd>${whole?info.versionCount+'개':'v'+info.version}</dd></div><div><dt>배정·학습</dt><dd>${info.assigned}건</dd></div><div><dt>이수 완료</dt><dd>${info.completed}건</dd></div></dl><p>${explanation}</p>${info.generating?'<p class="st-warning">AI 작성·보완 처리 중에는 삭제하거나 복원할 수 없습니다. 완료 후 다시 확인해주세요.</p>':''}<form data-lifecycle data-scope="${scope}" data-id="${esc(id)}" data-action="${action}" data-token="${esc(info.revisionToken)}"><label class="st-choice"><input type="checkbox" name="confirm" required ${info.generating?'disabled':''}>${removing?'선택한 버전만 삭제하고 이수 기록을 보존함을 확인했습니다.':'복원 후 공개 상태 안내를 확인했습니다.'}</label><div class="st-actions">${btn('취소','close')}${btn(removing?'삭제 확정':whole?'자료 복원':'버전 복원','lifecycle-submit',`${removing?'data-danger':''} ${info.generating?'disabled':''}`,!removing)}</div></form>`;
    if(showDialog(removing?'선택한 버전 삭제':whole?'전체 자료 복원':'선택한 버전 복원',body))notice('');
   }catch(e){notice(e.message||'자료 상태를 확인하지 못했습니다.',true);}
  }

  function supplementCreate(reuse=null){
   const d=activeDoc;
   const form=`<p><b>${esc(d.title)}</b> · 현재 초안은 유지되고 생성 결과는 보완 이력에 저장됩니다.</p><form data-supplement-create data-reuse="${esc(reuse?.id||'')}">${reuse?'<p class="st-info">저장된 검색 근거를 재사용합니다. 새 검색 없이 AI 작성만 요청하며 작성 사용료가 발생합니다.</p>':''}
    ${d.body.gaps.length?`<fieldset><legend>현재 부족한 정보</legend>${d.body.gaps.map((g,i)=>`<label class="st-choice"><input type="checkbox" name="gap" value="${i}" checked>${esc(g)}</label>`).join('')}</fieldset>`:''}
    <fieldset><legend>추가로 보완할 영역</legend><div class="st-topic-grid">${Object.entries(topicOptions(d)).map(([k,v])=>`<label class="st-choice"><input type="checkbox" name="topic" value="${k}">${v}</label>`).join('')}</div></fieldset>
    <label class="st-choice"><input type="checkbox" name="webSearch" ${reuse?'disabled':'checked'}>학회·수의과대학·임상 참고자료에서 근거 검색</label><p class="st-muted">검색에는 교육 주제와 선택한 영역을 사용합니다. 검색 결과의 정확성과 적용 범위는 의료진이 확인합니다.</p>
    <details class="st-sources"><summary>병원 참고 근거 추가 (선택)</summary><p>병원 고유 절차나 추가로 참고할 자료를 입력하세요. 개인정보는 포함하지 마세요.</p>${[1,2,3].map(n=>`<fieldset data-reference><legend>참고 근거 ${n}</legend><label>자료명<input data-ref-title maxlength="240"></label><label>원문 주소<input data-ref-url placeholder="https:// 주소 (선택)"></label><label>활용할 내용·서지정보<textarea data-ref-excerpt maxlength="5500" rows="4"></textarea></label><label class="st-choice"><input type="checkbox" data-ref-rights> 교육 제작에 이용할 권한을 확인했습니다.</label></fieldset>`).join('')}</details>
    <div class="st-warning"><label class="st-choice"><input type="checkbox" name="confirmSend"> 선택한 교육 내용·참고자료를 기존 OpenAI 연결로 전송하고, AI 작성·검색 사용료가 발생함을 확인했습니다.</label><p class="st-muted">검색을 포함하면 근거 검색과 초안 작성으로 나누어 처리합니다. 같은 본문·선택·근거의 보완안은 재사용합니다.</p></div>
    <div class="st-actions">${btn('AI 보완 초안 작성','supplement-generate','',true)}${btn('기존 자료로 돌아가기','supplement-back')}</div></form>`;
   if(showDialog('부족한 내용 AI 보완',form,true))activeDoc=d;
  }
  function supplementCreateBody(){
   const f=dialog.querySelector('[data-supplement-create]');return {revision:activeDoc.revision,reuseSupplementId:f.dataset.reuse||'',topics:[...f.querySelectorAll('[name=topic]:checked')].map(x=>x.value),gapIndexes:[...f.querySelectorAll('[name=gap]:checked')].map(x=>Number(x.value)),webSearch:f.elements.webSearch.checked,confirmSend:f.elements.confirmSend.checked,references:[...f.querySelectorAll('[data-reference]')].filter(r=>r.querySelector('[data-ref-title]').value||r.querySelector('[data-ref-excerpt]').value).map(r=>({title:r.querySelector('[data-ref-title]').value,url:r.querySelector('[data-ref-url]').value,excerpt:r.querySelector('[data-ref-excerpt]').value,rightsConfirmed:r.querySelector('[data-ref-rights]').checked}))};
  }
  function supplementLinks(ids,sources){return `<span class="st-item-sources">${ids.map(id=>{const s=sources.find(x=>x.id===id);if(!s)return '';return s.url&&/^https?:\/\//.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:`<span>${esc(s.title)}</span>`;}).join(' · ')}</span>`;}
  function supplementResult(d,s){
   const usable=s.status==='ready'&&!s.stale,p=s.proposal,names=labels(d);
   let content=`<div class="st-doc-meta"><span class="st-tag">${supplementStatus(s.status)}</span><span>기준 본문 수정 ${s.baseRevision}회 · ${shortDate(s.createdAt)}</span></div>`;
   if(s.status==='running')content+='<p class="st-warning">AI 요청을 처리 중입니다. 잠시 후 보완 이력에서 다시 열어주세요. 중복 생성은 실행되지 않습니다.</p>';
   if(s.status==='failed')content+=`<p class="st-warning">${esc(s.error)} 같은 요청은 자동 재실행되지 않습니다. 참고 근거를 추가하거나 내용을 직접 작성할 수 있습니다.</p>`;
   if(s.status==='failed'&&s.sources.some(x=>x.kind==='web_search_summary'))content+=`${sourceView(s.sources)}${!s.stale?btn('저장된 근거로 다시 작성','supplement-reuse','',true):''}`;
   if(s.status==='ready'&&s.stale)content+='<p class="st-warning">기존 자료가 변경됐습니다. 이 보완안은 참고용으로 확인하고, 최신 초안에서 보완을 다시 요청해주세요.</p>';
   if(p.items?.length){
    content+=`<form data-supplement-apply><p>기존 문장은 유지됩니다. 추가할 내용과 근거를 확인한 후 선택해주세요.</p><div class="st-compare"><section><h3>현재 교육자료</h3>${d.body.sections.map((section,i)=>`<details open><summary>${names[i]}</summary><ul>${section.items.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul></details>`).join('')}</section><section><h3>AI 보완 제안</h3>${usable?btn('추가 내용 전체 선택','supplement-select-all'):''}${p.items.map(x=>`<article class="st-proposal-item"><span class="st-tag">${names[docKeys(d).indexOf(x.section)]}</span><label class="st-choice">${usable?`<input type="checkbox" name="item" value="${esc(x.id)}">`:''}<span>${esc(x.text)}</span></label>${supplementLinks(x.sourceIds,s.sources)}</article>`).join('')}</section></div>
     ${p.remainingGaps?.length?`<aside class="st-warning"><b>보완 후에도 확인할 내용</b><ul>${p.remainingGaps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></aside>`:''}
     <details class="st-sources"><summary>평가문항 비교 · 기존 ${d.body.quiz.length}개 / 보완 5개</summary><div class="st-compare"><section><h3>기존 문항</h3>${d.body.quiz.map((q,i)=>`<p>${i+1}. ${esc(q.question)}</p>`).join('')}</section><section><h3>보완 문항</h3>${p.quiz.map((q,i)=>`<article><b>${i+1}. ${esc(q.question)}</b><ol>${q.options.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>정답: ${esc(q.options[q.answer])}<br>${esc(q.explanation)}</p>${supplementLinks(q.sourceIds,s.sources)}</article>`).join('')}</section></div></details>
     ${sourceView(s.sources)}
     ${usable?`<fieldset><legend>반영 옵션</legend><label class="st-choice"><input type="checkbox" name="replaceQuiz" disabled>평가문항 5개도 보완 문항으로 교체</label><p class="st-muted">평가문항 교체는 추가 내용을 모두 선택했을 때 가능합니다.</p>${s.selection.gapIndexes.length?`<b>보완이 끝난 검토 항목</b><p class="st-muted">관련 내용을 모두 선택하고 충분히 보완됐다고 확인한 항목만 체크하세요.</p>${s.selection.gapIndexes.map(i=>`<label class="st-choice"><input type="checkbox" name="resolvedGap" value="${i}" disabled>${esc(d.body.gaps[i])}</label>`).join('')}`:''}<label class="st-choice"><input type="checkbox" name="confirmReviewed">선택한 보완 내용과 연결된 근거를 확인했습니다.</label></fieldset><div class="st-apply-bar"><p data-selection-summary role="status">추가 내용 0개 선택</p>${btn('선택한 내용 초안에 반영','supplement-apply','',true)}</div>`:''}</form>`;
   }
   content+=`<div class="st-actions">${btn('기존 자료로 돌아가기','supplement-back')}</div>`;
   if(showDialog('AI 보완안 비교·반영',content,true)){activeDoc=d;activeSupplement=s;dialog.addEventListener('change',syncSupplementSelection);}
  }
  function syncSupplementSelection(){
   const s=activeSupplement,f=dialog?.querySelector('[data-supplement-apply]');if(!s||!f)return;
   const selected=[...f.querySelectorAll('[name=item]:checked')].map(x=>x.value),quiz=f.querySelector('[name=replaceQuiz]');
   if(quiz){quiz.disabled=selected.length!==s.proposal.items.length;if(quiz.disabled)quiz.checked=false;}
   for(const input of f.querySelectorAll('[name=resolvedGap]')){const related=s.proposal.items.filter(x=>x.gapIndexes.includes(Number(input.value)));input.disabled=!related.length||related.some(x=>!selected.includes(x.id));if(input.disabled)input.checked=false;}
   const summary=f.querySelector('[data-selection-summary]');if(summary)summary.textContent=`추가 내용 ${selected.length}개 · 문항 ${quiz?.checked?'교체':'유지'} · 검토 항목 해소 ${f.querySelectorAll('[name=resolvedGap]:checked').length}개`;
  }
  async function openSupplement(id){
   const d=activeDoc,current=identity,seq=++sequence;notice('보완안을 불러오고 있습니다.');
   try{const r=await adapter.request('/supplements/'+encodeURIComponent(id),{method:'GET'});if(seq!==sequence||current!==(adapter.identity?.()||''))return;supplementResult(d,r.supplement);notice('');}catch(e){notice(e.message,true);}
  }
  function refsInputs(selected,sources){return `<div class="st-reference-checks">${sources.map(s=>`<label class="st-choice"><input type="checkbox" value="${esc(s.id)}" ${selected.includes(s.id)?'checked':''}>${esc(s.title)} <small>(${sourceLabel(s.id)})</small></label>`).join('')||'<span class="st-muted">병원 SOP · 내부 기준을 검토해주세요.</span>'}</div>`;}
  function editDocument(){
   const d=activeDoc;if(!d)return;const names=labels(d);
   const body=`<p>한 줄에 한 항목을 입력하고 해당 영역에 사용한 근거를 선택하세요. 저장하면 다시 ‘작성 중’ 상태가 됩니다.</p><form data-editor>${d.body.sections.map((s,i)=>`<section data-section="${s.key}"><label>${names[i]}<textarea rows="6" data-items>${esc(s.items.map(x=>x.text).join('\n'))}</textarea></label><b class="st-label">사용한 근거</b>${refsInputs([...new Set(s.items.flatMap(x=>x.sourceIds))],d.sources)}</section>`).join('')}
    <h3>평가문항 ${d.kind==='sop'?'(선택)':'5개'}</h3>${(d.kind==='sop'?d.body.quiz:Array.from({length:5},(_,i)=>d.body.quiz[i]||{question:'',options:['','','',''],answer:0,explanation:'',sourceIds:[]})).map((q,i)=>`<fieldset data-question><legend>문항 ${i+1}</legend><label>질문<input data-question-text value="${esc(q.question)}" required></label><div class="st-options">${q.options.map((o,j)=>`<label>선택지 ${j+1}<input data-option value="${esc(o)}" required></label>`).join('')}</div><label>정답<select data-answer>${[0,1,2,3].map(j=>`<option value="${j}" ${j===q.answer?'selected':''}>선택지 ${j+1}</option>`).join('')}</select></label><label>해설<textarea rows="2" data-explanation required>${esc(q.explanation)}</textarea></label>${refsInputs(q.sourceIds,d.sources)}</fieldset>`).join('')}
    <label>추가 검토 필요 항목<textarea rows="3" data-gaps placeholder="보완이 끝난 항목은 삭제하세요. 남아 있으면 승인할 수 없습니다.">${esc(d.body.gaps.join('\n'))}</textarea></label><div class="st-actions">${btn('초안 저장','save','',true)}</div></form>`;
   if(showDialog('교육자료 수정',body,true))activeDoc=d;
  }
  function editorBody(){
   const form=dialog.querySelector('[data-editor]'),selected=node=>[...node.querySelectorAll('.st-reference-checks input:checked')].map(x=>x.value);
   return {...(activeDoc.body.format==='practice'?{format:'practice',config:activeDoc.body.config}:{}),sections:[...form.querySelectorAll('[data-section]')].map(s=>({key:s.dataset.section,items:s.querySelector('[data-items]').value.split('\n').map(x=>x.trim()).filter(Boolean).map(text=>({text,sourceIds:selected(s)}))})),
    quiz:[...form.querySelectorAll('[data-question]')].map(q=>({question:q.querySelector('[data-question-text]').value,options:[...q.querySelectorAll('[data-option]')].map(x=>x.value),answer:Number(q.querySelector('[data-answer]').value),explanation:q.querySelector('[data-explanation]').value,sourceIds:selected(q)})),
    gaps:form.querySelector('[data-gaps]').value.split('\n').map(x=>x.trim()).filter(Boolean)};
  }
  async function createDialog(){
   if(!adapter.common){
    if(!actor().capabilities.edit||tab!=='sop')return;
    showDialog('우리 병원 SOP 작성',`<p>병원에서 실제 사용하는 업무 기준과 절차를 직접 작성합니다. 승인 후 해당 병원 직원에게 공개됩니다.</p><form data-create><input type="hidden" name="kind" value="sop"><label>SOP 제목<input name="title" maxlength="240" placeholder="예: 개원·마감 점검"></label><label>분류<input name="category" maxlength="80" placeholder="예: 병원 운영"></label><div class="st-actions">${btn('수동 초안 만들기','manual','',true)}</div></form>`,true);return;
   }
   const current=identity,seq=++sequence;
   notice('기본 자료와 중앙 게시 원본을 불러오는 중입니다.');
   try{
    const d=await adapter.request('/sources',{method:'GET'});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const body=`<form data-create><label>제작 방식<select name="kind" aria-label="제작 방식"><option value="education">보호자 자료로 질환·증상 교육 만들기</option><option value="practice">주제로 실무 교육 새로 만들기</option></select></label>
     <label>교육 제목·주제<input name="title" maxlength="160" placeholder="원본 선택 시 제목 자동 사용 / 실무 교육은 주제 입력"></label><fieldset data-practice-wrap hidden><legend>실무 교육 대상</legend><div class="st-source-filters"><label>대상 직원<select name="audience" aria-label="대상 직원">${['신입 직원','진료·간호 직원','접수·상담 직원','관리자','전체 직원'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>교육 수준<select name="level" aria-label="교육 수준">${['기초','실무','심화'].map(x=>`<option>${x}</option>`).join('')}</select></label></div><p class="st-muted">예: 접수·전화 응대, 입원 인수인계, 검체 관리, 소독·멸균, 퇴원 안내</p><p>학습 목표 · 핵심 지식 · 업무 순서 · 체크리스트 · 보고·인계 기준 · 상황별 예시 · 평가 5문항</p><label class="st-choice"><input name="webSearch" type="checkbox" checked>주제에 맞는 전문기관·공공기관의 근거 검색</label><p class="st-muted">검색을 끄면 아래에 참고 근거를 직접 추가하세요. 병원별 담당자·장비·내부 절차는 병원 지침 확인 항목으로 남깁니다.</p></fieldset>
     <label>분류<input name="category" maxlength="80" placeholder="예: 수술 · 신입 직원 · 접수"></label>
     <fieldset data-source-wrap><legend>교육 원본 선택</legend><div class="st-source-filters"><label>원본 검색<input type="search" data-source-search placeholder="질환·수술명 또는 분류로 검색"></label><label>원본 출처<select data-source-type aria-label="원본 출처"><option value="all">전체 출처</option><option value="builtin">기본 자료</option><option value="central">중앙 게시 자료</option></select></label></div><p class="st-muted" data-source-count role="status" aria-live="polite"></p><label>교육 원본<select name="sourceContentId" aria-label="교육 원본" aria-describedby="stSourceHint"></select></label><p class="st-muted" id="stSourceHint">기본 자료와 중앙에 게시된 보호자 안내자료를 사용합니다. 선택한 원문은 교육 초안과 함께 보관됩니다.</p><button type="button" class="st-button" data-source-reset>검색·필터 초기화</button></fieldset>
     <p class="st-muted" data-source-help>환자별 자료 대신 공통 원문을 사용합니다. 원문에 없는 전문 지식은 근거를 추가한 뒤 검토합니다.</p>
     <details class="st-sources"><summary>참고 근거 직접 추가 (선택)</summary><p>이용 가능한 자료의 필요한 부분만 입력하세요. 근거의 임상 타당성은 승인 시 의료진이 확인합니다.</p>${[1,2,3].map(n=>`<fieldset data-reference><legend>참고 근거 ${n}</legend><label>자료명<input data-ref-title maxlength="240"></label><label>원문 주소 또는 서지정보<input data-ref-url placeholder="https:// 주소 (선택)"><input data-ref-citation placeholder="교재 판·장·페이지 또는 가이드라인 발행연도"></label><label>활용할 원문 내용<textarea data-ref-excerpt rows="3" maxlength="5500"></textarea></label><label class="st-choice"><input type="checkbox" data-ref-rights> 이 내용을 교육 제작에 이용할 권한을 확인했습니다.</label></fieldset>`).join('')}</details>
     <div data-practice-consent hidden class="st-warning"><label class="st-choice"><input type="checkbox" name="confirmSend">주제·참고자료를 기존 OpenAI 연결로 전송하고 AI 작성·검색 사용료가 발생함을 확인했습니다.</label><p class="st-muted">개인정보와 병원 비밀정보를 입력하지 마세요. 생성 결과는 승인 전 초안으로 저장됩니다.</p></div><div class="st-actions">${btn('수동 초안 만들기','manual')}${btn('AI 교육 초안 생성','generate','',true)}</div><p class="st-muted">AI 생성은 요청할 때만 실행됩니다. 동일 원본·근거의 기존 결과를 우선 사용하며, ${data.limits?.dailyGenerations===0?'CARESTEP 하루 생성 횟수 제한은 없습니다. 연결된 AI 서비스의 한도와 사용료는 별도로 적용됩니다.':'하루 '+(data.limits?.dailyGenerations||5)+'회까지 생성할 수 있습니다.'}</p></form>`;
    if(!showDialog(adapter.common?'공통 교육자료 만들기':'교육자료 만들기',body,true))return;notice('');
    const form=dialog.querySelector('[data-create]'),kind=form.elements.kind,select=form.elements.sourceContentId,search=form.querySelector('[data-source-search]'),type=form.querySelector('[data-source-type]');
    const sources=d.sources.map(s=>({...s,sourceType:s.sourceType==='builtin'?'builtin':'central'}));
    const sync=()=>{const practice=kind.value==='practice';for(const selector of ['[data-source-wrap]','[data-source-help]'])form.querySelector(selector).hidden=practice;for(const selector of ['[data-practice-wrap]','[data-practice-consent]'])form.querySelector(selector).hidden=!practice;for(const a of ['manual','generate'])form.querySelector('[data-st='+a+']').disabled=!practice&&!select.value;};
    const filter=()=>{
     const before=select.value,words=search.value.normalize('NFKC').toLocaleLowerCase('ko').trim().split(/\s+/).filter(Boolean),matches=sources.filter(s=>(type.value==='all'||s.sourceType===type.value)&&words.every(w=>(s.title+' '+s.category).normalize('NFKC').toLocaleLowerCase('ko').includes(w)));
     select.innerHTML='<option value="">'+(matches.length?'원본을 선택하세요':'조건에 맞는 원본이 없습니다')+'</option>'+['builtin','central'].map(k=>{const rows=matches.filter(s=>s.sourceType===k);return rows.length?`<optgroup label="${k==='builtin'?'기본 자료':'중앙 게시 자료'} · ${rows.length}개">${rows.map(s=>`<option value="${esc(s.content_id)}">${esc(s.title)}${k==='central'?' · v'+esc(s.version):''}</option>`).join('')}</optgroup>`:'';}).join('');
     select.value=matches.some(s=>s.content_id===before)?before:'';
     const builtin=sources.filter(s=>s.sourceType==='builtin').length;
     form.querySelector('[data-source-count]').textContent=`전체 ${sources.length}개 · 기본 자료 ${builtin}개 · 중앙 게시 자료 ${sources.length-builtin}개 · 현재 조건 ${matches.length}개${before&&!select.value?' · 검색 조건이 바뀌어 원본 선택이 해제됐습니다.':''}`;
     form.querySelector('[data-source-reset]').hidden=!search.value&&type.value==='all';sync();
    };
    kind.addEventListener('change',sync);select.addEventListener('change',sync);search.addEventListener('input',filter);type.addEventListener('change',filter);form.querySelector('[data-source-reset]').addEventListener('click',()=>{search.value='';type.value='all';filter();search.focus();});filter();
   }catch(e){notice(e.message||'원본 목록을 불러오지 못했습니다.',true);}
  }
  function creationBody(){
   const f=dialog.querySelector('[data-create]'),get=n=>f.elements[n].value;
   if(get('kind')==='sop')return {kind:'sop',title:get('title'),category:get('category')};
   const practice=get('kind')==='practice';return {kind:'education',format:practice?'practice':undefined,config:practice?{topic:get('title'),audience:get('audience'),level:get('level')}:undefined,webSearch:practice?f.elements.webSearch.checked:undefined,confirmSend:practice?f.elements.confirmSend.checked:undefined,title:get('title'),category:get('category'),sourceContentId:practice?'':get('sourceContentId'),
    references:[...f.querySelectorAll('[data-reference]')].filter(r=>r.querySelector('[data-ref-title]').value||r.querySelector('[data-ref-excerpt]').value).map(r=>({title:r.querySelector('[data-ref-title]').value,excerpt:[r.querySelector('[data-ref-citation]').value,r.querySelector('[data-ref-excerpt]').value].filter(Boolean).join('\n'),url:r.querySelector('[data-ref-url]').value,rightsConfirmed:r.querySelector('[data-ref-rights]').checked}))};
  }
  function assignDialog(id){
   const c=data.courses.find(x=>x.id===id),assigned=new Set(data.assignments.filter(a=>a.version_id===id).map(a=>a.user_id));
   showDialog('직원에게 교육 배정',`<p><b>${esc(c?.title)}</b> · v${c?.version}</p><form data-assign><label>직원 검색<input type="search" data-member-search placeholder="직원 이름"></label><div class="st-actions">${btn('검색 결과 전체 선택','member-select')}${btn('선택 해제','member-clear')}</div><p data-member-count role="status"></p><fieldset><legend>교육 대상 직원</legend>${data.members.map(m=>`<label class="st-choice" data-member-name="${esc(m.display_name.toLowerCase())}"><input type="checkbox" name="member" value="${esc(m.id)}" ${assigned.has(m.id)?'disabled':''}> ${esc(m.display_name)}${assigned.has(m.id)?' · 이미 배정됨':''}</label>`).join('')||'<p>활성 직원이 없습니다.</p>'}</fieldset><label>교육 기한 (선택)<input type="date" name="dueDate"></label><p>이미 배정된 직원의 이수 기록은 유지됩니다.</p>${btn('선택 직원에게 배정','assign-submit',`data-id="${esc(id)}"`,true)}</form>`);
   const f=dialog.querySelector('[data-assign]'),update=()=>{f.querySelector('[data-member-count]').textContent='선택 '+f.querySelectorAll('[name=member]:checked:not(:disabled)').length+'명 · 이미 배정 '+data.members.filter(m=>assigned.has(m.id)).length+'명';};f.querySelector('[data-member-search]').oninput=e=>{const q=e.target.value.trim().toLowerCase();f.querySelectorAll('[data-member-name]').forEach(label=>label.hidden=!label.dataset.memberName.includes(q));};f.onchange=update;f.querySelector('[data-st=member-select]').onclick=()=>{f.querySelectorAll('[data-member-name]:not([hidden]) input:not(:disabled)').forEach(x=>x.checked=true);update();};f.querySelector('[data-st=member-clear]').onclick=()=>{f.querySelectorAll('[name=member]').forEach(x=>x.checked=false);update();};update();
  }
  function gapReviewDialog(){
   const d=activeDoc;if(!d||!actor().capabilities.review)return;
   showDialog('승인 전 검토 항목 정리',`<p>실제 내용이 보완된 항목과 환자별 판단·병원 SOP로 확인할 항목을 구분해주세요. 해결되지 않은 내용은 그대로 남깁니다.</p><form data-gap-review>${adapter.common?'<label>검토 의료진 이름<input name="reviewerName" maxlength="120" required></label>':''}${d.body.gaps.map((g,i)=>`<fieldset class="st-gap-review-item" data-gap-index="${i}"><legend>검토 항목 ${i+1}</legend><p>${esc(g)}</p><label>처리 방식<select aria-label="처리 방식" name="disposition"><option value="pending">미해결 · 승인 보류</option><option value="resolved">본문·근거 보완 완료</option><option value="guidance">환자별 판단·병원 SOP 확인사항</option></select></label><label>처리 사유·본문 위치·적용 안내<textarea name="note" rows="3" maxlength="1000" placeholder="보완한 내용과 근거, 또는 적용 시 확인할 담당자·지침을 적어주세요."></textarea></label></fieldset>`).join('')}<label class="st-choice"><input type="checkbox" name="confirmReviewed" required>내용과 근거를 검토했으며, 미해결 내용을 단순히 제외하지 않았습니다.</label>${btn('처리 내용 저장','save-gap-review','',true)}${btn('자료로 돌아가기','return-document')}</form>`,true);activeDoc=d;
  }
  function approvalDialog(){
   const d=activeDoc,reopening=d.status==='withdrawn';
   if(d.body.gaps.length){showDialog('승인 전 보완 필요',`<p>미해결 검토 항목 ${d.body.gaps.length}개가 남아 있습니다.</p><ul>${d.body.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul><div class="st-actions">${btn('검토 항목 정리','review-gaps','',true)}${btn('본문 수정','edit')}${d.supplementEnabled&&d.kind==='education'?btn('AI 보완','supplement-create'):''}${btn('자료로 돌아가기','return-document')}</div>`);activeDoc=d;return;} 
   if(reopening&&data.courses.some(c=>c.course_id===d.courseId&&c.id!==d.id&&c.status==='published'&&c.current_version_id===c.id&&!c.deleted_at)){notice('다른 버전이 공개 중입니다. 현재 공개 버전을 먼저 확인해주세요.',true);return;}
   showDialog(reopening?'기존 버전 다시 공개':'의료진 검토 후 공개',`<p><b>${esc(d.title)}</b> · v${d.version}</p><p>${d.common?'승인하면 모든 병원의 공통 교육자료실에 표시됩니다.':'승인하면 우리 병원 직원 교육자료실에 표시됩니다.'}</p>${reopening?'<p class="st-info">선택한 버전을 그대로 다시 공개합니다. 새 수정본은 만들지 않으며, 기존 배정·점수·이수 기록을 유지합니다.</p>':''}<form data-approve>${adapter.common?'<label>검토 의료진 이름<input name="reviewerName" required maxlength="120"></label>':''}${[['clinical','교육 내용·간호·응대·보고 기준을 의료진이 검토했습니다.'],['evidence','본문과 문항이 원본·참고 근거에 부합하며 부족한 부분을 보완했습니다.'],['privacy','환자·보호자 개인정보와 공유하면 안 되는 내부 내용이 없습니다.'],['rights','포함한 자료의 저작권·이용 권한을 확인했습니다.']].map(([k,t])=>`<label class="st-choice"><input type="checkbox" name="${k}" required>${t}</label>`).join('')}${btn(reopening?'확인 후 다시 공개':'승인하고 공개',reopening?'republish':'publish','',true)}</form>`);activeDoc=d;
  }
  async function completeMutation(fn,then){
   return mutate(async current=>{const result=await fn();if(!current())return;dirty=false;busy=false;closeDialog();await load();if(then)await then(result);return result;});
  }
  async function handle(event){
   const b=event.target.closest('[data-st]');if(!b||b.disabled||busy)return;const a=b.dataset.st,id=b.dataset.id;
   if(a==='toggle-citations'){const show=b.getAttribute('aria-expanded')!=='true';dialog.querySelectorAll('[data-item-sources]').forEach(x=>{x.hidden=!show;});b.setAttribute('aria-expanded',String(show));b.textContent=show?'문장별 근거 숨기기':'문장별 근거 보기';return;}
   if(a==='close'){closeDialog();return;}
   if(a==='refresh'){if(dialog&&!closeDialog())return;await load();return;}
   if(a==='tab'){switchTab(b.dataset.tab);return;}
   if(a==='manage-view'){manageView=b.dataset.view;render();root.querySelector('[data-st=manage-view][data-view='+manageView+']')?.focus({preventScroll:true});return;}
   if(a==='report-page'){reportPage+=Number(b.dataset.step);renderReportRows();return;}
   if(a==='section'){const target=dialog?.querySelector('#'+b.dataset.section);target?.scrollIntoView({block:'start',behavior:'auto'});target?.focus({preventScroll:true});return;}
   if(a==='clear'){query='';category='';courseType='';render();return;}
   if(a==='reopen-publication'){await openDocument(id,'',false,true);return;}
   if(a==='edit-course'){await openDocument(id,'',true);return;}
   if(a==='revision-dialog'){revisionDialog();return;}
   if(a==='delete-version'||a==='restore-version'){await lifecycleDialog(id,a==='delete-version'?'delete':'restore');return;}
   if(a==='restore-course'){await lifecycleDialog(b.dataset.course,'restore',true);return;}
   if(a==='lifecycle-submit'){
    const form=dialog.querySelector('[data-lifecycle]');if(!form.reportValidity())return;
    const action=form.dataset.action,targetId=form.dataset.id,scope=form.dataset.scope,revisionToken=form.dataset.token;
    await completeMutation(()=>request('/'+scope+'/'+encodeURIComponent(targetId)+'/'+action,{revisionToken,confirm:form.elements.confirm.checked}),()=>notice(action==='delete'?'선택한 버전을 삭제했습니다. 다른 버전과 기존 이수 기록은 유지됩니다.':'자료를 복원했습니다. 공개 상태를 확인해주세요.'));return;
   }
   if(a==='document'||a==='learn'){await openDocument(id,b.dataset.assignment||'');return;}
   if(a==='supplement-create'){supplementCreate();return;}
   if(a==='supplement-reuse'){supplementCreate(activeSupplement);return;}
   if(a==='supplement-open'){await openSupplement(id);return;}
   if(a==='supplement-back'){const d=activeDoc;if(closeDialog())await openDocument(d.id);return;}
   if(a==='supplement-select-all'){dialog.querySelectorAll('[name=item]').forEach(x=>{x.checked=true;});dirty=true;syncSupplementSelection();return;}
   if(a==='supplement-generate'){
    const d=activeDoc,body=supplementCreateBody();
    if(!body.topics.length&&!body.gapIndexes.length){notice('보완할 항목을 하나 이상 선택해주세요.',true);return;}
    if(!body.confirmSend){notice('AI 전달 내용과 사용료 안내를 확인해주세요.',true);return;}
    if(!body.webSearch&&!body.references.length&&!body.reuseSupplementId){notice('외부 근거 검색을 선택하거나 참고자료를 추가해주세요.',true);return;}
    notice(body.webSearch?'근거 검색과 보완 초안 작성을 진행합니다. 완료되면 비교 화면을 엽니다.':body.reuseSupplementId?'저장된 근거로 보완 초안을 작성합니다. 새 검색은 실행하지 않습니다.':'입력한 근거로 보완 초안을 작성합니다.');
    await mutate(async current=>{const r=await request('/versions/'+d.id+'/supplements',body);if(!current())return;dirty=false;busy=false;supplementResult(d,r.supplement);notice('');});return;
   }
   if(a==='supplement-apply'){
    const d=activeDoc,s=activeSupplement,f=dialog.querySelector('[data-supplement-apply]'),body={revision:s.baseRevision,itemIds:[...f.querySelectorAll('[name=item]:checked')].map(x=>x.value),resolvedGapIndexes:[...f.querySelectorAll('[name=resolvedGap]:checked')].map(x=>Number(x.value)),replaceQuiz:f.elements.replaceQuiz.checked,confirmReviewed:f.elements.confirmReviewed.checked};
    if(!body.itemIds.length||!body.confirmReviewed){notice('추가할 내용과 출처 확인을 선택해주세요.',true);return;}
    await completeMutation(()=>request('/supplements/'+s.id+'/apply',body),()=>openDocument(d.id));return;
   }
   if(a==='automation'){if(dialog&&!closeDialog())return;await global.TrainingAutomation.open(adapter,openDocument);return;}
   if(a==='create'){await createDialog();return;}
   if(a==='edit'){editDocument();return;}
   if(a==='assign'){assignDialog(id);return;}
   if(a==='approve'){approvalDialog();return;}
   if(a==='return-document'){const id=activeDoc.id;if(!closeDialog())return;await openDocument(id);return;}
   if(a==='review-gaps'){gapReviewDialog();return;}
   if(a==='save-gap-review'){
    const d=activeDoc,f=dialog.querySelector('[data-gap-review]');if(!f.reportValidity())return;
    const decisions=[...f.querySelectorAll('[data-gap-index]')].map(x=>({index:Number(x.dataset.gapIndex),text:d.body.gaps[Number(x.dataset.gapIndex)],disposition:x.querySelector('[name=disposition]').value,note:x.querySelector('[name=note]').value.trim()})).filter(x=>x.disposition!=='pending');
    if(!decisions.length||decisions.some(x=>x.note.length<10)){notice('처리할 항목을 선택하고 사유를 10자 이상 입력해주세요.',true);return;}
    await completeMutation(()=>request('/versions/'+d.id+'/review-gaps',{revision:d.revision,decisions,reviewerName:f.elements.reviewerName?.value||'',confirmReviewed:f.elements.confirmReviewed.checked}),()=>openDocument(d.id));return;
   }
   if(a==='download'){
    const d=activeDoc;notice('PDF를 만들고 있습니다. 첫 다운로드는 한글 글꼴을 준비하는 데 잠시 걸릴 수 있습니다.');
    await mutate(async current=>{
     const module=await pdfModule(),bytes=await module.create(d);
     if(!current()||activeDoc?.id!==d.id)return;
     const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
     link.href=url;link.download=d.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,160)+'_v'+d.version+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notice('PDF 다운로드를 시작했습니다. 브라우저 다운로드 목록에서 확인해주세요.');
    });return;
   }
   if(a==='generate'||a==='manual'){
    const body=creationBody();if(body.kind==='education'&&body.format!=='practice'&&!body.sourceContentId){notice('보호자 원본을 선택해주세요.',true);return;}if(body.kind==='sop'&&!body.title){notice('SOP 제목을 입력해주세요.',true);return;}
    if(body.format==='practice'&&body.config.topic.trim().length<2){notice('실무 교육 주제를 두 글자 이상 입력해주세요.',true);return;}
    if(a==='generate'&&body.format==='practice'&&!body.confirmSend){notice('AI에 전달할 주제·참고자료와 사용료 안내를 확인해주세요.',true);return;}
    notice(a==='generate'?'원문과 근거로 교육 초안을 생성하고 있습니다. 완료되면 검토 화면을 엽니다.':'초안을 저장하고 있습니다.');
    await completeMutation(()=>request(a==='generate'?(body.format==='practice'?'/generate-topic':'/generate'):'/courses',body),r=>openDocument(r.versionId));return;
   }
   if(a==='save'){
    const d=activeDoc,body=editorBody();
    await completeMutation(()=>request('/versions/'+d.id,{revision:d.revision,body},'PUT'),()=>openDocument(d.id));return;
   }
   if(a==='review'||a==='publish'||a==='republish'||a==='revise'||a==='withdraw'){
    const d=activeDoc,publishing=a==='publish'||a==='republish',checks=publishing?Object.fromEntries([...dialog.querySelectorAll('[data-approve] input[type=checkbox]')].map(x=>[x.name,x.checked])):undefined,reviewerName=dialog.querySelector('[name=reviewerName]')?.value||'';
    if(publishing&&!dialog.querySelector('form').reportValidity())return;
    if(a==='withdraw'&&!global.confirm('공개를 중단하면 배정된 직원도 이 자료로 학습·제출할 수 없습니다. 기존 이수 기록은 보존됩니다. 공개를 중단할까요?'))return;
    await completeMutation(()=>request('/versions/'+d.id+'/'+a,{revision:d.revision,checks,reviewerName}),r=>openDocument(r.versionId||d.id,'',a==='revise'));return;
   }
   if(a==='assign-submit'){
    const f=dialog.querySelector('[data-assign]'),userIds=[...f.querySelectorAll('[name=member]:checked')].map(x=>x.value);if(!userIds.length){notice('교육 대상 직원을 선택해주세요.',true);return;}
    await completeMutation(()=>request('/versions/'+id+'/assign',{userIds,dueDate:f.elements.dueDate.value}),r=>notice(r.count+'명에게 교육을 배정했습니다. 중복 배정은 제외했습니다.'));return;
   }
   if(a==='enroll'){
    const d=activeDoc;await completeMutation(()=>request('/versions/'+d.id+'/enroll',{}),r=>openDocument(d.id,r.assignmentId));return;
   }
   if(a==='attempt'){
    const f=dialog.querySelector('[data-quiz]');if(!f.reportValidity())return;
    const answers=activeDoc.body.quiz.map((_,i)=>Number(f.elements['answer'+i].value)),aid=activeAssignment;
    await mutate(async current=>{
     const r=await request('/assignments/'+aid+'/attempt',{answers,confirmRead:f.elements.confirmRead.checked,requestKey});if(!current())return;
     requestKey=global.crypto.randomUUID().replaceAll('-','');
     dialog.querySelector('[data-feedback]').innerHTML=`<div class="st-result"><h3>${r.score}점 · ${r.passed?'이수 완료':'다시 학습해주세요'}</h3>${(r.feedback||[]).map((x,i)=>`<p><b>${i+1}. ${x.correct?'정답':'오답'} · ${esc(x.answer)}</b><br>${esc(x.explanation)}</p>`).join('')}</div>`;
     if(r.passed){f.hidden=true;const row=data.assignments.find(x=>x.id===aid);if(row){row.completed_at=r.completedAt||new Date().toISOString();row.score=r.score;}render();}
     notice(r.passed?'이수 기록을 저장했습니다.':'해설과 교육자료를 확인한 후 다시 제출할 수 있습니다.');
    });
   }
  }
  root.addEventListener('click',handle);
  root.addEventListener('input',e=>{if(e.target.matches('[data-mine-search]')){mineQuery=e.target.value;renderList();}if(e.target.matches('[data-search]')){query=e.target.value;renderList();}});
  root.addEventListener('change',e=>{if(e.target.matches('[data-mine-filter]')){mineFilter=e.target.value;renderList();}if(e.target.matches('[data-category]')){category=e.target.value;renderList();}if(e.target.matches('[data-course-type]')){courseType=e.target.value;renderList();}if(e.target.matches('[data-sort]')){sort=e.target.value;renderList();}if(e.target.matches('[data-layout]')){view=e.target.value;renderList();}});
  global.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  function clear(){
   if(adapter.common)global.TrainingAutomation?.close();
   ++sequence;tabState={};mineFilter='all';mineQuery='';reportQuery='';reportMember='';reportState='all';reportDue='all';reportPage=0;manageView='assign';sort='number';view='';data=null;identity='';dirty=false;activeDoc=null;activeAssignment=null;activeSupplement=null;query='';category='';courseType='';message='';
   if(dialog){dialog.close();dialog.remove();dialog=null;}shell();
  }
  return {open:load,openVersion:id=>openDocument(id),close:closeDialog,leave(){if(!closeDialog())return false;remember();++sequence;return true;},clear,selectSop(){remember();tab='sop';query='';category='';courseType='';sort='number';view='list';}};
 }
 global.StaffTraining={mount,filterCourses,sortCourses,groupCourses};
})(globalThis);

