/* Shared first-screen filters. Existing record modules own querying and permissions. */
(function(g){
 'use strict';
 function mount(form){
  if(!form||form.dataset.listLayout)return;
  const status=form.querySelector('select[name=status],select[data-filter=status]');
  if(!status)return;
  form.dataset.listLayout='compact';
  const host=form.parentElement,submit=form.querySelector('button[type=submit],button:not([type])');
  const statusLabel=status.closest('label');statusLabel.hidden=true;
  const details=document.createElement('details');details.className='record-list-details';
  const summary=document.createElement('summary');summary.textContent='상세 조건';details.append(summary);
  const advanced=document.createElement('div');advanced.className='record-list-advanced';details.append(advanced);
  for(const name of ['from','to','vet']){
   const input=form.querySelector('[name='+name+'],[data-filter='+name+']');
   if(input){advanced.append(input.closest('label'));if(input.value)details.open=true;}
  }
  if(details.open)summary.textContent='상세 조건 · 적용 중';
  form.append(details);
  const bar=document.createElement('div');bar.className='record-list-shortcuts';bar.setAttribute('role','group');bar.setAttribute('aria-label','기록 상태');
  for(const option of status.options){
   const button=document.createElement('button');button.type='button';button.dataset.recordStatus=option.value;
   button.textContent=({inProgress:'작성 중',complete:'작성 완료',amended:'완료 후 수정'})[option.value]||(option.value?option.textContent:'전체 상태');
   button.setAttribute('aria-pressed',String(status.value===option.value));button.disabled=!!submit?.disabled;
   button.onclick=()=>{if(submit?.disabled)return;status.value=option.value;for(const b of bar.querySelectorAll('[data-record-status]'))b.setAttribute('aria-pressed',String(b.dataset.recordStatus===status.value));form.requestSubmit(submit);};
   bar.append(button);
  }
  let reset=host.querySelector('[data-filter-reset],[data-search-reset]');
  if(!reset){reset=document.createElement('button');reset.type='button';reset.onclick=()=>{if(submit?.disabled)return;for(const input of form.querySelectorAll('input,select'))input.value='';form.requestSubmit(submit);};}
  reset.textContent='검색 조건 초기화';reset.classList.add('record-list-reset');
  const applied=[...form.querySelectorAll('input,select')].filter(el=>!el.disabled&&el.type!=='hidden'&&el.value.trim());reset.hidden=!applied.length;
  summary.textContent=applied.some(el=>['from','to','vet'].includes(el.name||el.dataset.filter))?'상세 조건 · 적용 중':'상세 조건';reset.disabled=!!submit?.disabled;bar.append(reset);
  form.after(bar);
  for(const box of host.querySelectorAll('.dn-list-conditions,.nr-search-applied'))if(!box.textContent.trim())box.hidden=true;
  form.addEventListener('submit',()=>{
   const from=form.querySelector('[name=from],[data-filter=from]'),to=form.querySelector('[name=to],[data-filter=to]');
   if(from?.value&&to?.value&&from.value>to.value)details.open=true;
  },true);
 }
 g.RecordListLayout={mount};
})(typeof window==='undefined'?globalThis:window);
