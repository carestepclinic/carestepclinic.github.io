/* Shared CLINIC/HQ staff learning UI. No patient context or local progress storage. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=s=>({draft:'작성 중',review:'검토 대기',published:'승인됨',withdrawn:'공개 중단'})[s]||'확인 필요';
 const keys=['clinical','nursing','counseling'];
 const sourceLabel=id=>id==='guardian'?'보호자 원본':/^ref\d+$/.test(id)?'참고 근거 '+id.slice(3):'참고 근거';
 const labels=kind=>kind==='sop'?['업무 목적·기준','절차·확인사항','응대·보고']:['임상 핵심','간호·보고 체크리스트','보호자 상담'];
 const shortDate=s=>s?String(s).slice(0,10):'기한 없음';
 function filterCourses(data,tab,query='',category=''){
  return (data.courses||[]).filter(c=>tab==='manage'?c.owned:(c.status==='published'&&c.current_version_id===c.id&&(tab==='sop'?c.kind==='sop':c.kind==='education')))
   .filter(c=>(!category||c.category===category)&&(!query||[c.title,c.category,c.common?'공통':'우리 병원'].join(' ').toLowerCase().includes(query.toLowerCase())));
 }
 function mount(root,adapter){
  if(!root)throw Error('Training root missing');
  root.classList.add('staff-training');
  let data=null,tab=adapter.common?'manage':'library',query='',category='',sequence=0,identity='',busy=false,dialog=null,dirty=false,activeDoc=null,activeAssignment=null,requestKey='',message='';
  const ready=()=>!adapter.isReady||adapter.isReady();
  const actor=()=>data?.actor||{capabilities:{}};
  const btn=(text,action,extra='',primary=false)=>`<button type="button" class="st-button ${primary?'st-primary':''}" data-st="${action}" ${extra}>${esc(text)}</button>`;
  function notice(text,error=false){message=text;const el=root.querySelector('[data-status]');if(el){el.textContent=text;el.classList.toggle('st-error',error);}const de=dialog?.querySelector('[data-dialog-status]');if(de){de.textContent=text;de.classList.toggle('st-error',error);}}
  function shell(){
   root.innerHTML=`<header class="st-heading"><div><span class="st-eyebrow">${adapter.common?'CARESTEP HQ':'CARESTEP CLINIC'}</span><h1>${adapter.common?'직원 공통 교육 관리':'직원 교육센터'}</h1><p>${adapter.common?'승인한 공통 교육자료를 각 병원 교육센터에 제공합니다.':'환자 선택 없이 교육자료를 찾고, 배정된 교육을 이어서 학습하세요.'}</p></div>${btn('새로고침','refresh')}</header><p data-status class="st-status" role="status" aria-live="polite"></p><div data-content></div>`;
  }
  function render(){
   shell();notice(message);const host=root.querySelector('[data-content]');
   if(!data){host.innerHTML='<div class="st-empty">직원 교육자료를 불러오고 있습니다.</div>';return;}
   const can=actor().capabilities;
   if(tab==='manage'&&!can.edit&&!can.review&&!can.manage)tab='library';
   const tabs=adapter.common?[['manage','공통 교육 관리'],['library','공개 자료']]:[['library','교육자료실'],['mine','내 교육'],['sop','우리 병원 SOP'],...(can.edit||can.review||can.manage?[['manage','교육 관리']]:[])];
   const mine=data.assignments.filter(a=>a.user_id===actor().userId),pending=mine.filter(a=>!a.completed_at&&a.status==='published').length;
   host.innerHTML=`<nav class="st-tabs" aria-label="교육센터 메뉴">${tabs.map(([id,label])=>`<button type="button" data-st="tab" data-tab="${id}" aria-current="${tab===id?'page':'false'}">${label}${id==='mine'&&pending?` <span>${pending}</span>`:''}</button>`).join('')}</nav>
    ${tab==='mine'?`<div class="st-summary"><b>학습할 교육 ${pending}개</b><span>이수 ${mine.filter(a=>a.completed_at).length}개 · 읽던 자료와 이수 기록은 서버에 저장됩니다.</span></div>`:''}
    ${tab!=='mine'?`<div class="st-toolbar"><label>교육자료 검색<input type="search" data-search placeholder="질환·수술·교육 제목" value="${esc(query)}"></label><label>분류<select data-category><option value="">전체 분류</option>${[...new Set(data.courses.map(x=>x.category).filter(Boolean))].sort().map(c=>`<option ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></label>${can.edit&&(tab==='manage'||tab==='sop')?btn(tab==='sop'?'SOP 작성':'교육자료 만들기','create','',true):''}</div>`:''}
    <div data-list></div>${tab==='manage'&&can.manage&&!adapter.common?'<section class="st-report"><h2>직원별 교육 현황</h2><div data-report></div></section>':''}`;
   renderList();renderReport();
  }
  function renderList(){
   const host=root.querySelector('[data-list]');if(!host||!data)return;
   if(tab==='mine'){
    const rows=data.assignments.filter(a=>a.user_id===actor().userId);
    host.innerHTML=rows.length?`<div class="st-grid">${rows.map(a=>`<article class="st-card"><span class="st-tag ${a.completed_at?'st-approved':''}">${a.completed_at?'이수 완료':a.status!=='published'?'공개 중단':a.opened_at?'학습 중':'학습 전'}</span><h2>${esc(a.title)}</h2><p>v${a.version} · ${a.completed_at?'이수일 '+shortDate(a.completed_at):'기한 '+shortDate(a.due_date)}</p>${a.score!=null?`<p>최근 점수 ${a.score}점</p>`:''}${a.status==='published'?btn(a.completed_at?'다시 보기':'학습 이어가기','learn',`data-id="${esc(a.version_id)}" data-assignment="${esc(a.id)}"`,!a.completed_at):'<p>관리자에게 최신 교육자료를 확인해주세요.</p>'}</article>`).join('')}</div>`:'<div class="st-empty"><b>아직 배정된 교육이 없습니다.</b><p>교육자료실에서 원하는 자료를 선택해 학습을 시작할 수도 있습니다.</p></div>';
    return;
   }
   const rows=filterCourses(data,tab,query,category);
   host.innerHTML=`<p class="st-count">${rows.length}개 자료${query||category?' · 검색 결과':''}</p>`+(rows.length?`<div class="st-grid">${rows.map(c=>`<article class="st-card"><div class="st-card-tags"><span class="st-tag">${c.common?'공통 교육':'우리 병원'}${c.kind==='sop'?' SOP':''}</span><span class="st-tag ${c.status==='published'?'st-approved':''}">${status(c.status)} · v${c.version}</span></div><h2>${esc(c.title)}</h2><p>${esc(c.category||'미분류')} · 수정 ${shortDate(c.updated_at)}</p><div class="st-actions">${btn(tab==='manage'?'자료·검토 열기':'자료 보기','document',`data-id="${esc(c.id)}"`,true)}${!adapter.common&&c.status==='published'&&c.current_version_id===c.id&&actor().capabilities.manage?btn('직원 배정','assign',`data-id="${esc(c.id)}"`):''}</div></article>`).join('')}</div>`:`<div class="st-empty"><b>${query||category?'조건에 맞는 자료가 없습니다.':tab==='manage'?'작성한 교육자료가 없습니다.':'아직 공개된 자료가 없습니다.'}</b><p>${tab==='manage'?'보호자 원본으로 교육 초안을 만들거나 병원 SOP를 작성하세요.':'의료진이 검토·승인한 자료가 여기에 표시됩니다.'}</p>${query||category?btn('검색 초기화','clear'):''}</div>`);
  }
  function renderReport(){
   const host=root.querySelector('[data-report]');if(!host)return;
   host.innerHTML=data.assignments.length?`<div class="st-table-wrap" tabindex="0" aria-label="직원별 교육 현황"><table><thead><tr><th>직원</th><th>교육자료</th><th>기한</th><th>학습 상태</th></tr></thead><tbody>${data.assignments.map(a=>`<tr><td>${esc(a.display_name)}</td><td>${esc(a.title)} <small>v${a.version}</small></td><td>${shortDate(a.due_date)}</td><td>${a.completed_at?'이수 · '+a.score+'점':a.status!=='published'?'공개 중단':a.opened_at?'학습 중':'학습 전'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="st-empty">교육자료의 ‘직원 배정’을 누르면 이수 현황을 확인할 수 있습니다.</p>';
  }
  async function load(){
   const current=adapter.identity?.()||'';
   if(current!==identity){identity=current;data=null;query='';category='';if(dialog){dirty=false;closeDialog();}}
   if(!ready()){data=null;shell();notice('병원 직원 계정으로 로그인하면 교육센터를 사용할 수 있습니다.');return;}
   const seq=++sequence;shell();root.querySelector('[data-content]').innerHTML='<div class="st-empty" aria-busy="true">교육자료와 내 교육을 불러오는 중입니다…</div>';
   try{const result=await adapter.request('/',{method:'GET'});if(seq!==sequence||current!==(adapter.identity?.()||''))return;data=result;message='';render();}
   catch(e){if(seq!==sequence)return;data=null;shell();notice(e.message||'교육자료를 불러오지 못했습니다.',true);root.querySelector('[data-content]').innerHTML=btn('다시 불러오기','refresh');}
  }
  function closeDialog(){
   if(busy){notice('처리 결과를 확인하고 있습니다.');return false;}
   if(dirty&&!global.confirm('저장하지 않은 변경사항을 취소하고 닫을까요?'))return false;
   const old=dialog;dialog=null;dirty=false;activeDoc=null;activeAssignment=null;
   if(old){old.close();old.remove();}return true;
  }
  function showDialog(title,body,wide=false){
   if(dialog&&!closeDialog())return false;
   dialog=document.createElement('dialog');dialog.className='st-dialog'+(wide?' st-wide':'');dialog.setAttribute('aria-labelledby','stDialogTitle');
   dialog.innerHTML=`<header><h2 id="stDialogTitle">${esc(title)}</h2>${btn('닫기','close')}</header><p class="st-status" data-dialog-status role="status" aria-live="polite"></p><div class="st-dialog-body">${body}</div>`;
   dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
   dialog.addEventListener('click',handle);dialog.addEventListener('input',()=>{if(dialog?.querySelector('[data-editor]'))dirty=true;});
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
   return `<details class="st-sources"><summary>원본·참고 근거 ${sources.length}개</summary>${sources.map(s=>`<article><b>${esc(s.title)}</b><p>${s.contentId?'중앙 원본 · v'+esc(s.version):'검토용 참고자료'} · ${sourceLabel(s.id)}</p>${s.url&&/^https?:\/\//.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">근거 원문 열기</a>`:''}<p>${esc(s.excerpt||s.content?.description||'')}</p>${s.content?.sections?`<ul>${s.content.sections.flatMap(x=>x.items.map(i=>`<li>${esc(i)}</li>`)).join('')}</ul>`:''}</article>`).join('')}</details>`;
  }
  async function openDocument(id,assignmentId=''){
   const current=identity,seq=++sequence;notice('교육자료를 여는 중입니다.');
   try{
    const result=await adapter.request('/versions/'+encodeURIComponent(id),{method:'GET'});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const d=result.document,names=labels(d.kind);
    const canEdit=d.editable&&actor().capabilities.edit,canReview=d.editable&&actor().capabilities.review,canLearn=!adapter.common&&d.status==='published';
    const mine=data.assignments.find(a=>a.version_id===id&&a.user_id===actor().userId);
    const aid=assignmentId||mine?.id||'';
   if(aid&&!mine?.completed_at)await request('/assignments/'+encodeURIComponent(aid)+'/open',{});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const body=`<div class="st-doc-meta"><span class="st-tag">${d.common?'공통 교육':'우리 병원'} · v${d.version}</span><span class="st-tag">${status(d.status)}</span>${d.reviewedAt?`<span>승인 ${shortDate(d.reviewedAt)}</span>`:''}</div>
     ${d.body.gaps.length?`<aside class="st-warning"><b>추가 검토 필요</b><ul>${d.body.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></aside>`:''}
     <div class="st-reading">${d.body.sections.map((s,i)=>`<section><h3>${names[i]}</h3>${s.items.length?`<ul${s.key==='nursing'?' class="st-checklist"':''}>${s.items.map(x=>`<li>${esc(x.text)}${x.sourceIds?.length?` <small>근거: ${x.sourceIds.map(sourceLabel).join(', ')}</small>`:''}</li>`).join('')}</ul>`:'<p class="st-muted">작성할 내용이 없습니다.</p>'}</section>`).join('')}</div>${sourceView(d.sources)}
     <div class="st-actions">${btn('자료 다운로드','download')}${canEdit&&['draft','review'].includes(d.status)?btn('내용 수정','edit'):''}${canEdit&&d.status==='draft'?btn('검토 요청','review','',true):''}${canReview&&d.status==='review'?btn('검토 후 승인','approve','',true):''}${canReview&&['published','withdrawn'].includes(d.status)?btn('새 버전 작성','revise'):''}${canReview&&d.status==='published'?btn('공개 중단','withdraw'):''}${canLearn&&!aid?btn('내 교육으로 시작','enroll','',true):''}</div>
     ${aid&&canLearn?`<section class="st-assessment"><h3>${mine?.completed_at?'이수한 교육':'학습 확인'}</h3>${mine?.completed_at?`<p>${shortDate(mine.completed_at)} · ${mine.score}점으로 이수했습니다.</p>`:`<p>${d.body.quiz.length?'5문항 중 4문항 이상 정답이면 이수됩니다.':'자료 내용을 확인한 후 이수를 기록합니다.'}</p><form data-quiz>${d.body.quiz.map((q,i)=>`<fieldset><legend>${i+1}. ${esc(q.question)}</legend>${q.options.map((o,j)=>`<label class="st-choice"><input type="radio" name="answer${i}" value="${j}" required> ${esc(o)}</label>`).join('')}</fieldset>`).join('')}<label class="st-choice"><input type="checkbox" name="confirmRead" required> 교육자료를 읽고 내용을 확인했습니다.</label>${btn(d.body.quiz.length?'답안 제출':'이수 기록','attempt','',true)}</form><div data-feedback></div>`}</section>`:''}
     ${d.editable&&d.body.quiz.length?`<details class="st-sources"><summary>검토자용 평가문항·정답</summary>${d.body.quiz.map((q,i)=>`<p><b>${i+1}. ${esc(q.question)}</b><br>${q.options.map((o,j)=>`${j+1}. ${esc(o)}`).join(' / ')}<br>정답: ${esc(q.options[q.answer])}<br>${esc(q.explanation)} · 근거 ${q.sourceIds.map(sourceLabel).join(', ')}</p>`).join('')}</details>`:''}
     ${d.audit?.length?`<details class="st-sources"><summary>작성·검토 이력</summary>${d.audit.map(x=>`<p>${esc(x.at.replace('T',' ').slice(0,16))} · ${esc(({create:'초안 생성',edit:'내용 수정',review:'검토 요청',publish:'승인·공개',revise:'새 버전 작성',withdraw:'공개 중단',assign:'교육 배정',enroll:'학습 시작'})[x.action]||x.action)} · ${esc(x.detail?.reviewerName||x.actor)}</p>`).join('')}</details>`:''}`;
    if(!showDialog(d.title,body,true))return;activeDoc=d;activeAssignment=aid;requestKey=global.crypto.randomUUID().replaceAll('-','');notice('');
   }catch(e){notice(e.message||'자료를 열지 못했습니다.',true);}
  }
  function refsInputs(selected,sources){return `<div class="st-reference-checks">${sources.map(s=>`<label class="st-choice"><input type="checkbox" value="${esc(s.id)}" ${selected.includes(s.id)?'checked':''}>${esc(s.title)} <small>(${sourceLabel(s.id)})</small></label>`).join('')||'<span class="st-muted">병원 SOP · 내부 기준을 검토해주세요.</span>'}</div>`;}
  function editDocument(){
   const d=activeDoc;if(!d)return;const names=labels(d.kind);
   const body=`<p>한 줄에 한 항목을 입력하고 해당 영역에 사용한 근거를 선택하세요. 저장하면 다시 ‘작성 중’ 상태가 됩니다.</p><form data-editor>${d.body.sections.map((s,i)=>`<section data-section="${s.key}"><label>${names[i]}<textarea rows="6" data-items>${esc(s.items.map(x=>x.text).join('\n'))}</textarea></label><b class="st-label">사용한 근거</b>${refsInputs([...new Set(s.items.flatMap(x=>x.sourceIds))],d.sources)}</section>`).join('')}
    <h3>평가문항 ${d.kind==='sop'?'(선택)':'5개'}</h3>${(d.kind==='sop'?d.body.quiz:Array.from({length:5},(_,i)=>d.body.quiz[i]||{question:'',options:['','','',''],answer:0,explanation:'',sourceIds:[]})).map((q,i)=>`<fieldset data-question><legend>문항 ${i+1}</legend><label>질문<input data-question-text value="${esc(q.question)}" required></label><div class="st-options">${q.options.map((o,j)=>`<label>선택지 ${j+1}<input data-option value="${esc(o)}" required></label>`).join('')}</div><label>정답<select data-answer>${[0,1,2,3].map(j=>`<option value="${j}" ${j===q.answer?'selected':''}>선택지 ${j+1}</option>`).join('')}</select></label><label>해설<textarea rows="2" data-explanation required>${esc(q.explanation)}</textarea></label>${refsInputs(q.sourceIds,d.sources)}</fieldset>`).join('')}
    <label>추가 검토 필요 항목<textarea rows="3" data-gaps placeholder="보완이 끝난 항목은 삭제하세요. 남아 있으면 승인할 수 없습니다.">${esc(d.body.gaps.join('\n'))}</textarea></label><div class="st-actions">${btn('초안 저장','save','',true)}</div></form>`;
   if(showDialog('교육자료 수정',body,true))activeDoc=d;
  }
  function editorBody(){
   const form=dialog.querySelector('[data-editor]'),selected=node=>[...node.querySelectorAll('.st-reference-checks input:checked')].map(x=>x.value);
   return {sections:[...form.querySelectorAll('[data-section]')].map(s=>({key:s.dataset.section,items:s.querySelector('[data-items]').value.split('\n').map(x=>x.trim()).filter(Boolean).map(text=>({text,sourceIds:selected(s)}))})),
    quiz:[...form.querySelectorAll('[data-question]')].map(q=>({question:q.querySelector('[data-question-text]').value,options:[...q.querySelectorAll('[data-option]')].map(x=>x.value),answer:Number(q.querySelector('[data-answer]').value),explanation:q.querySelector('[data-explanation]').value,sourceIds:selected(q)})),
    gaps:form.querySelector('[data-gaps]').value.split('\n').map(x=>x.trim()).filter(Boolean)};
  }
  async function createDialog(){
   const current=identity,seq=++sequence;
   notice('승인된 보호자 원본을 불러오는 중입니다.');
   try{
    const d=await adapter.request('/sources',{method:'GET'});
    if(seq!==sequence||current!==(adapter.identity?.()||''))return;
    const body=`<form data-create><label>자료 종류<select name="kind"><option value="education">보호자 원본에서 직원 교육 생성</option>${!adapter.common?`<option value="sop" ${tab==='sop'?'selected':''}>우리 병원 SOP 직접 작성</option>`:''}</select></label>
     <label>교육 제목<input name="title" maxlength="240" placeholder="원본 선택 시 제목을 자동으로 사용합니다."></label>
     <label>분류<input name="category" maxlength="80" placeholder="예: 수술 · 신입 직원 · 접수"></label>
     <label data-source-wrap>승인된 보호자 원본<select name="sourceContentId"><option value="">원본을 선택하세요</option>${d.sources.map(s=>`<option value="${esc(s.content_id)}">${esc(s.title)} · v${esc(s.version)}</option>`).join('')}</select></label>
     <p class="st-muted">환자별 자료 대신 공통 원문을 사용합니다. 원문에 없는 전문 지식은 근거를 추가한 뒤 검토합니다.</p>
     <details class="st-sources"><summary>임상 참고 근거 추가 (선택)</summary><p>이용 가능한 자료의 필요한 부분만 입력하세요. 근거의 임상 타당성은 승인 시 의료진이 확인합니다.</p>${[1,2,3].map(n=>`<fieldset data-reference><legend>참고 근거 ${n}</legend><label>자료명<input data-ref-title maxlength="240"></label><label>원문 주소 또는 서지정보<input data-ref-url placeholder="https:// 주소 (선택)"><input data-ref-citation placeholder="교재 판·장·페이지 또는 가이드라인 발행연도"></label><label>활용할 원문 내용<textarea data-ref-excerpt rows="3" maxlength="5500"></textarea></label><label class="st-choice"><input type="checkbox" data-ref-rights> 이 내용을 교육 제작에 이용할 권한을 확인했습니다.</label></fieldset>`).join('')}</details>
     <div class="st-actions">${btn('수동 초안 만들기','manual','',true)}${btn('AI 교육 초안 생성','generate')}</div><p class="st-muted">AI 생성은 요청할 때만 실행됩니다. 동일 원본·근거의 기존 결과를 우선 사용하며, 하루 ${data.limits?.dailyGenerations||5}회까지 생성할 수 있습니다.</p></form>`;
    showDialog(adapter.common?'공통 교육자료 만들기':'교육자료 만들기',body,true);notice('');
    const kind=dialog.querySelector('[name=kind]');const sync=()=>{dialog.querySelector('[data-source-wrap]').hidden=kind.value==='sop';dialog.querySelector('[data-st=generate]').hidden=kind.value==='sop';};kind.addEventListener('change',sync);sync();
   }catch(e){notice(e.message||'원본 목록을 불러오지 못했습니다.',true);}
  }
  function creationBody(){
   const f=dialog.querySelector('[data-create]'),get=n=>f.elements[n].value;
   return {kind:get('kind'),title:get('title'),category:get('category'),sourceContentId:get('sourceContentId'),
    references:[...f.querySelectorAll('[data-reference]')].filter(r=>r.querySelector('[data-ref-title]').value||r.querySelector('[data-ref-excerpt]').value).map(r=>({title:r.querySelector('[data-ref-title]').value,excerpt:[r.querySelector('[data-ref-citation]').value,r.querySelector('[data-ref-excerpt]').value].filter(Boolean).join('\n'),url:r.querySelector('[data-ref-url]').value,rightsConfirmed:r.querySelector('[data-ref-rights]').checked}))};
  }
  function assignDialog(id){
   const c=data.courses.find(x=>x.id===id);
   showDialog('직원에게 교육 배정',`<p><b>${esc(c?.title)}</b> · v${c?.version}</p><form data-assign><fieldset><legend>교육 대상 직원</legend>${data.members.map(m=>`<label class="st-choice"><input type="checkbox" name="member" value="${esc(m.id)}"> ${esc(m.display_name)}</label>`).join('')||'<p>활성 직원이 없습니다.</p>'}</fieldset><label>교육 기한 (선택)<input type="date" name="dueDate"></label><p>동일 직원에게 같은 버전은 중복 배정하지 않습니다.</p>${btn('선택 직원에게 배정','assign-submit',`data-id="${esc(id)}"`,true)}</form>`);
  }
  function approvalDialog(){
   const d=activeDoc;showDialog('의료진 검토 후 공개',`<p><b>${esc(d.title)}</b> · v${d.version}</p><p>${d.common?'승인하면 모든 병원의 공통 교육자료실에 표시됩니다.':'승인하면 우리 병원 직원 교육자료실에 표시됩니다.'}</p><form data-approve>${adapter.common?'<label>검토 의료진 이름<input name="reviewerName" required maxlength="120"></label>':''}${[['clinical','교육 내용·간호·응대·보고 기준을 의료진이 검토했습니다.'],['evidence','본문과 문항이 원본·참고 근거에 부합하며 부족한 부분을 보완했습니다.'],['privacy','환자·보호자 개인정보와 공유하면 안 되는 내부 내용이 없습니다.'],['rights','포함한 자료의 저작권·이용 권한을 확인했습니다.']].map(([k,t])=>`<label class="st-choice"><input type="checkbox" name="${k}" required>${t}</label>`).join('')}${btn('승인하고 공개','publish','',true)}</form>`);activeDoc=d;
  }
  async function completeMutation(fn,then){
   return mutate(async current=>{const result=await fn();if(!current())return;dirty=false;busy=false;closeDialog();await load();if(then)await then(result);return result;});
  }
  async function handle(event){
   const b=event.target.closest('[data-st]');if(!b||b.disabled||busy)return;const a=b.dataset.st,id=b.dataset.id;
   if(a==='close'){closeDialog();return;}
   if(a==='refresh'){if(dialog&&!closeDialog())return;await load();return;}
   if(a==='tab'){tab=b.dataset.tab;message='';render();return;}
   if(a==='clear'){query='';category='';render();return;}
   if(a==='document'||a==='learn'){await openDocument(id,b.dataset.assignment||'');return;}
   if(a==='create'){await createDialog();return;}
   if(a==='edit'){editDocument();return;}
   if(a==='assign'){assignDialog(id);return;}
   if(a==='approve'){approvalDialog();return;}
   if(a==='download'){
    const d=activeDoc,names=labels(d.kind),text=[d.title,'v'+d.version+' · '+status(d.status),...d.body.sections.flatMap((s,i)=>['',names[i],...s.items.map(x=>(s.key==='nursing'?'□ ':'• ')+x.text)]),'','원본·참고 근거',...d.sources.map(s=>s.title+(s.url?' '+s.url:''))].join('\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=d.title.replace(/[\\/:*?"<>|]/g,'_')+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
   }
   if(a==='generate'||a==='manual'){
    const body=creationBody();if(body.kind==='education'&&!body.sourceContentId){notice('보호자 원본을 선택해주세요.',true);return;}if(body.kind==='sop'&&!body.title){notice('SOP 제목을 입력해주세요.',true);return;}
    notice(a==='generate'?'원문과 근거로 교육 초안을 생성하고 있습니다. 완료되면 검토 화면을 엽니다.':'초안을 저장하고 있습니다.');
    await completeMutation(()=>request(a==='generate'?'/generate':'/courses',body),r=>openDocument(r.versionId));return;
   }
   if(a==='save'){
    const d=activeDoc,body=editorBody();
    await completeMutation(()=>request('/versions/'+d.id,{revision:d.revision,body},'PUT'),()=>openDocument(d.id));return;
   }
   if(a==='review'||a==='publish'||a==='revise'||a==='withdraw'){
    const d=activeDoc,checks=a==='publish'?Object.fromEntries([...dialog.querySelectorAll('[data-approve] input[type=checkbox]')].map(x=>[x.name,x.checked])):undefined,reviewerName=dialog.querySelector('[name=reviewerName]')?.value||'';
    if(a==='publish'&&!dialog.querySelector('form').reportValidity())return;
    if(a==='withdraw'&&!global.confirm('공개를 중단하면 배정된 직원도 이 자료로 학습·제출할 수 없습니다. 기존 이수 기록은 보존됩니다. 공개를 중단할까요?'))return;
    await completeMutation(()=>request('/versions/'+d.id+'/'+a,{revision:d.revision,checks,reviewerName}),r=>openDocument(r.versionId||d.id));return;
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
  root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){query=e.target.value;renderList();}});
  root.addEventListener('change',e=>{if(e.target.matches('[data-category]')){category=e.target.value;renderList();}});
  global.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  function clear(){
   ++sequence;data=null;identity='';dirty=false;activeDoc=null;activeAssignment=null;query='';category='';message='';
   if(dialog){dialog.close();dialog.remove();dialog=null;}shell();
  }
  return {open:load,close:closeDialog,clear};
 }
 global.StaffTraining={mount,filterCourses};
})(globalThis);
