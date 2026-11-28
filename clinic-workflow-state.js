/* Shared presentation of existing workflow states. No writes, clinical judgments, or new validation gates. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const states={
  task:{planned:['neutral','예정'],prn:['neutral','PRN · 필요 시'],late:['attention','수행 기록 지연'],overdue:['attention','지연'],held:['attention','보류'],omitted:['neutral','미실시'],cancelled:['neutral','중단'],done:['complete','수행 완료'],completed:['complete','완료'],scheduled:['neutral','예정'],in_progress:['current','처리 중']},
  purchase:{needed:['attention','주문 필요'],ordered:['neutral','입고 대기'],partial:['attention','일부 입고'],received:['complete','입고 완료'],cancelled:['neutral','요청 취소']},
  claim:{requested:['attention','처리 필요'],sent:['neutral','처리 대기'],completed:['complete','처리 완료'],cancelled:['neutral','취소']},
  intake:{pending:['attention','직원 확인 필요'],submitted:['attention','직원 확인 필요'],reviewed:['complete','직원 확인 완료']},
  calculation:{empty:['neutral','입력 대기'],pending:['attention','재계산 필요'],loading:['current','계산 중'],calculated:['neutral','계산 결과 · 임상 검토 별도'],reviewed:['complete','입력·처방 검토 확인'],error:['error','계산 오류']},
  booking:{booked:['neutral','예약'],current:['current','예약 시간 중'],conflict:['error','일정 충돌'],incomplete:['attention','일정 확인 필요'],cancelled:['neutral','취소']}
 };
 function describe(domain,status){const entry=states[domain]?.[status];return {tone:entry?.[0]||'neutral',label:entry?.[1]||'상태 확인'};}
 function badge(domain,status,label){const x=describe(domain,status);return markup(x.tone,label||x.label);}
 function markup(tone,label){if(!['neutral','attention','current','complete','error'].includes(tone))tone='neutral';return '<span class="cs-state-badge" data-cs-state="'+tone+'"><span aria-hidden="true">'+({neutral:'·',attention:'!',current:'›',complete:'✓',error:'!'}[tone])+'</span> '+esc(label)+'</span>';}
 function work(row){
  const status=row.action?.status||row.status||row.operationalStatus;
  if(['resolved','completed','done'].includes(status))return {tone:'complete',label:'처리 완료'};
  if(['cancelled','canceled','closed','deleted'].includes(status))return {tone:'neutral',label:'처리 종료'};
  if(row.action?.priority==='urgent')return {tone:'error',label:'긴급 확인'};
  const failed=row.sourceType==='message'?(row.status||row.external?.status||row.operationalStatus)==='failed'&&!row.failureAcknowledgedAt&&!row.action?.acknowledgedAt:row.operationalStatus==='failed';
  if(failed)return {tone:'error',label:'발송 실패'};
  if(status==='in_progress')return {tone:'current',label:'처리 중'};
  if(status==='held')return {tone:'attention',label:'보류'};
  if(row.sourceType==='home'&&row.operationalStatus==='overdue'&&!row.readAt)return {tone:'attention',label:'미열람 확인'};
  if(row.responseCode==='concern')return {tone:'attention',label:'보호자 상담 필요'};
  if(row.operationalStatus==='overdue'||row.action?.breached)return {tone:'attention',label:'지연 확인'};
  if(!row.action?.assignee&&!row.action?.assigneeUserId)return {tone:'attention',label:'담당자 미지정'};
  return {tone:'neutral',label:'예정 업무'};
 }
 const workBadge=row=>{const x=work(row);return markup(x.tone,x.label);};
 function deliveryCounts(rows){let failed=0,unread=0;for(const r of rows){const s=r.action?.status;if(['resolved','completed','cancelled','canceled','closed','deleted'].includes(s))continue;if(r.sourceType==='message'?(r.status||r.external?.status||r.operationalStatus)==='failed'&&!r.failureAcknowledgedAt&&!r.action?.acknowledgedAt:r.operationalStatus==='failed')failed++;else if(r.sourceType==='home'&&r.operationalStatus==='overdue'&&!r.readAt)unread++;}return {failed,unread};}
 function deliveryHTML(rows){const c=deliveryCounts(rows);return markup(c.failed?'error':'neutral','발송 실패 '+c.failed)+markup(c.unread?'attention':'neutral','미열람 '+c.unread);}
 function setState(el,tone){if(el&&el.dataset.csState!==tone)el.dataset.csState=tone;}
 const usable=el=>el&&!el.disabled&&!el.hidden&&!el.closest('[hidden],[inert],fieldset[disabled]');
 const missing=el=>el.type==='checkbox'||el.type==='radio'?!el.checked:!String(el.value??'').trim();
 function field(el,pending,review=false){
  if(!el)return;pending=!!pending&&usable(el);el.classList.toggle('cs-state-field',pending);
  if(pending)setState(el,'attention');else if(el.classList.contains('cs-state-field')===false&&el.dataset.csState==='attention')delete el.dataset.csState;
  const label=el.closest('label');if(!label)return;
  if(review)label.classList.toggle('cs-explicit-review',usable(el)&&el.checked);
  let note=[...label.children].find(x=>x.dataset.csFieldNote!==undefined);
  if(pending){if(!note){note=document.createElement('small');note.dataset.csFieldNote='';note.className='cs-state-field-note';label.append(note);}const t=review?'확인 필요':'필수 입력';if(note.textContent!==t)note.textContent=t;}
  else note?.remove();
 }
 function calculator(root,contextField){
  const forms=[...root.querySelectorAll('form[data-calc]')];
  for(const el of root.querySelectorAll('.cs-state-field'))if(el!==contextField&&!el.required)field(el,false);
  if(contextField)field(contextField,true,contextField.type==='checkbox');
  for(const form of forms){
   form.classList.add('cs-workflow-form');
   for(const el of form.querySelectorAll('input[required],select[required],textarea[required]'))field(el,missing(el),el.type==='checkbox');
   const output=form.querySelector('output'),hasResult=!!output?.textContent.trim(),isError=hasResult&&output?.classList.contains('pt-error');
   const review=form.querySelector('[data-checked]');
   const state=isError?'error':form.dataset.calculationState==='loading'?'loading':form.dataset.calculationState==='pending'?'pending':hasResult?(review?.checked?'reviewed':'calculated'):'empty';
   const host=form.querySelector('.pt-flow-result,.pt-prescription-result')||output?.parentElement;
   if(!host||!output)continue;
   let status=form.querySelector('[data-cs-calculation]');
   if(!status){status=document.createElement('div');status.dataset.csCalculation='';status.className='cs-calculation-status';}
   if(status.parentElement!==output.parentElement||status.nextElementSibling!==output)output.before(status);
   const html=badge('calculation',state);if(status.innerHTML!==html)status.innerHTML=html;
   status.hidden=state==='empty';
  }
  // A checked imported-weight control is explicit review; a populated weight alone is not.
  const weight=root.querySelector('[data-record-weight-confirm]');if(weight){const label=weight.closest('label');label?.classList.toggle('cs-explicit-review',usable(weight)&&weight.checked);}
 }
 function watchForm(form){
  if(!form||form.dataset.csWorkflowBound)return;form.dataset.csWorkflowBound='';form.classList.add('cs-workflow-form');
  const refresh=()=>{for(const el of form.querySelectorAll('[required]'))field(el,missing(el),el.type==='checkbox');};
  form.addEventListener('input',()=>queueMicrotask(refresh));form.addEventListener('change',()=>queueMicrotask(refresh));refresh();
 }
 const api={describe,badge,markup,work,workBadge,deliveryCounts,deliveryHTML,setState,field,calculator,watchForm};
 if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicWorkflowState=api;
})(globalThis);
