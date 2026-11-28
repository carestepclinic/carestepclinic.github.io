/* Presentation only. Record controllers remain responsible for validation and persistence. */
(function(g){
 'use strict';
 const roots=new Map(),fieldSelector='input:not([type=hidden]),select,textarea';
 const rootSelector='[data-record-start],[data-hc-editor],.nr.record-layout,.dn.record-layout,.sl form[data-record],.ae-inline,form.su-linear-form,form.su-surgery-form';
 const sectionsSelector='.cs-start-card,[data-hc-editor] [data-panel],[data-record-section],.nr-card,.chr-diseases,.sl-card,[data-surgery-section],.ae-inline';
 const all=(n,s)=>[...n.querySelectorAll(s)],one=(n,s)=>n.querySelector(s);
 const text=(n,value)=>{if(n.textContent!==value)n.textContent=value;};
 const attr=(n,k,v)=>{if(n.getAttribute(k)!==v)n.setAttribute(k,v);};
 const hasValue=n=>n&&(n.type==='checkbox'||n.type==='radio'?n.checked:String(n.value??'').trim()!=='');
 // Hidden tabs and closed details still count; deliberately hidden proxy inputs do not.
 const available=n=>!!n&&!n.hidden&&!n.closest('[hidden],[inert]')&&!n.matches(':disabled')&&n.type!=='hidden';
 function summary(issues,reviewed=false){
  const required=issues.filter(x=>x.kind==='required').length,review=issues.filter(x=>x.kind==='review').length,errors=issues.filter(x=>x.kind==='error').length;
  return {required,review,errors,state:errors?'error':required?'required':review?'review':reviewed?'reviewed':'ready',label:[errors?'입력 오류 '+errors+'개':'',required?'필수 입력 '+required+'개':'',review?'완료 전 확인 '+review+'개':''].filter(Boolean).join(' · ')||(reviewed?'✓ 검토 완료':'필수 입력됨 · 내용 검토는 별도입니다.')};
 }
 function reveal(n){
  if(!n||n.disabled)return;
  for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
  n.scrollIntoView({block:'center',behavior:'auto'});n.focus({preventScroll:true});
 }
 function labelOf(n){return n.getAttribute('aria-label')||n.closest('label')?.childNodes[0]?.textContent.trim()||n.name||'입력 항목';}
 function headingText(n){if(!n)return '다음 작성 구역';const copy=n.cloneNode(true);all(copy,'[data-flow-ui]').forEach(x=>x.remove());return copy.textContent.trim().replace(/^\d+\s*/,'')||'다음 작성 구역';}
 function model(root){
  const issues=[],required=[],q=s=>one(root,s),add=(el,label,missing=!hasValue(el),kind='required',activate)=>{
   if(!el||!available(el))return;
   const entry={el,label,kind,activate:activate||(()=>reveal(el))};
   if(kind==='required')required.push(entry);
   if(missing)issues.push(entry);
  };
  let sections=[],tabs=[],reviewed=false,search=false;
  if(root.matches('[data-record-start]')){
   const form=q('[data-start-form]');
   if(form?.hidden){search=true;add(q('[name=q]'),'등록 환자 검색·선택',true);}
   else{
    const name=q('[data-start-field=name]'),chart=q('[data-start-field=chartNumber]'),either=root.dataset.flowChartOnly==='true';
    add(name,either?'환자명 또는 차트번호':'환자명',!hasValue(name)&&!(either&&hasValue(chart)));
    add(q('[data-start-field=species]'),'동물종');
    const options=all(root,'[data-start-option]');if(options.length)add(options[0],'관리 질환 한 개 이상',!options.some(hasValue));
   }
  }else if(root.matches('[data-hc-editor]')){
   add(q('[data-field=date]'),'검진일');
   if(issues.length)issues[0].step='exams';
   const source=root.closest('.hc-record')?.recordFlowGuidance?.();
   for(const issue of source?.issues||[]){
    const el=q(issue.selector);
    issues.push({el:available(el)?el:null,label:issue.label,kind:'review',step:issue.step,activate:()=>source.navigate(issue)});
   }
   tabs=all(root,'.hc-steps [data-step]').map(button=>({button,key:button.dataset.step,label:button.getAttribute('aria-label'),el:q('[data-panel]')}));
   reviewed=!!source?.reviewed;
  }else if(root.matches('.sl form[data-record]')){
   for(const el of all(root,'[required]'))add(el,labelOf(el).replace(/필수/g,'').trim());
   sections=all(root,'.sl-card');
  }else if(root.matches('.ae-inline')){
   const form=q('[data-ae-inline]');if(!form)return null;
   add(q('[name=observedAt]'),'측정 시각');add(q('[name=recorder]'),'수행자');
   const metrics=all(form,'input[type=number]');if(metrics.length)add(metrics[0],'측정값 한 개 이상',!metrics.some(hasValue));
  }else if(root.matches('.su-linear-form,.su-surgery-form')){
   for(const el of all(root,'[data-pending-input]')){
    if(!available(el)||issues.some(x=>x.el?.closest('label')===el.closest('label')))continue;
    issues.push({el,label:labelOf(el),kind:'review',activate:()=>reveal(el)});
   }
   for(const button of all(root,'[data-consent-target]')){
    const el=document.getElementById(button.dataset.consentTarget);
    if(issues.some(x=>x.el===el))continue;
    issues.push({el:available(el)?el:null,label:button.textContent,kind:'review',activate:()=>button.click()});
   }
   sections=all(root,'[data-surgery-section]');
  }else{
   if(!q('[data-field=date]'))return null; // Lists and the shared new-record screen have no editor guidance.
   add(q('[data-identity=name],[data-name],[name=quickName]'),'환자명');add(q('[data-species],[name=species]'),'동물종');add(q('[data-field=date]'),'진료일');
   if(root.matches('.chr')){const options=all(root,'[data-condition]');if(options.length)add(options[0],'관리 질환 한 개 이상',!options.some(hasValue));}
   sections=all(root,root.matches('.dn')?'.dn-common-meta,[data-record-section]':'.nr-card,.chr-diseases').filter(n=>!n.parentElement.closest('.nr-card,[data-record-section]'));
   tabs=all(root,'.nr-jumps [data-jump],.er-jumps [data-jump],.er-jumps [data-section],.dn-section-nav [data-section-jump]').map(button=>{
    const key=button.dataset.jump||button.dataset.section||button.dataset.sectionJump;
    return {key,button,label:button.childNodes[0]?.textContent.trim(),el:button.dataset.jump?document.getElementById(key):q(button.dataset.section?'[data-panel="'+key+'"]':'[data-record-section="'+key+'"]')};
   });
  }
  // Only existing validation errors are red; opening an empty form is not an error.
  for(const el of all(root,'[aria-invalid=true]'))if(available(el)&&el.matches(fieldSelector)&&!issues.some(x=>x.el===el))issues.push({el,label:labelOf(el),kind:'error',activate:()=>reveal(el)});
  const unique=issues.filter((x,i,a)=>!x.el||a.findIndex(y=>y.el===x.el)===i);
  return {issues:unique,required,sections,tabs,reviewed,search};
 }
 function owned(n){return n.nodeType===1&&n.matches('[data-flow-ui]');}
 function badge(parent,key,label,className='rf-tag'){
  let n=[...parent.children].find(n=>n.dataset.flowUi===key);
  if(!n){n=document.createElement('small');n.dataset.flowUi=key;n.className=className;parent.append(n);}
  text(n,label);return n;
 }
 function reset(root){
  for(const n of all(root,'[data-flow-mark]')){n.classList.remove('rf-required','rf-review','rf-current','rf-reviewed');n.removeAttribute('data-flow-mark');}
  all(root,'[data-flow-ui]').forEach(n=>n.remove());root.classList.remove('rf-record');roots.delete(root);
 }
 function render(root){
  const state=model(root);if(!state){if(roots.has(root))reset(root);return;}
  let ctx=roots.get(root);if(!ctx){ctx={current:null,marks:new Set()};roots.set(root,ctx);}
  ctx.state=state;root.classList.add('rf-record');
  let bar=one(root,':scope > [data-flow-ui=bar]');
  if(!bar){
   bar=document.createElement('aside');bar.dataset.flowUi='bar';bar.className='rf-guide';bar.setAttribute('aria-label','기록 작성 안내');
   bar.innerHTML='<div><strong data-flow-status></strong><small data-flow-help></small></div><button type="button" data-flow-next></button>';
   const anchor=one(root,':scope > .hc-sticky,:scope > .nr-head,:scope > .dn-head,:scope > [data-start-state],:scope > .ae-measure-heading');
   if(anchor)anchor.after(bar);else root.prepend(bar);
   one(bar,'button').onclick=()=>{const c=roots.get(root);if(!c)return;const first=c.state.issues[0];if(first)first.activate();else if(c.next){if(c.next.button)c.next.button.click();else revealSection(c.next.el);}};
  }
  const status=summary(state.issues,state.reviewed);attr(bar,'data-flow-state',status.state);
  text(one(bar,'[data-flow-status]'),state.search?'환자를 선택하면 기록을 시작할 수 있습니다.':status.label);
  text(one(bar,'[data-flow-help]'),state.search?'검색 결과에서 환자를 선택하거나 직접 입력하세요.':status.errors?'표시된 입력값을 확인해주세요.':status.review?'확인 항목은 최종 완료·서명 기준입니다. 작성 중 저장은 기존 조건을 따릅니다.':'살구색은 필수 입력 · 청록색은 현재 구역 · 선택 항목은 필요할 때 작성하세요.');
  const nextMarks=new Set(),tagged=new Set();
  for(const issue of state.issues){
   const el=issue.el;if(!el||issue.kind==='error')continue;
   const cls=issue.kind==='required'?'rf-required':'rf-review';el.classList.add(cls);attr(el,'data-flow-mark','');nextMarks.add(el);
   const label=el.closest('label');
   // Existing consent notes already describe the exact missing item.
   if(label&&!el.hasAttribute('data-pending-input')&&!el.matches('[data-lab=confirmed]')){const b=badge(label,'required',issue.kind==='required'?'필수':'완료 전 확인');tagged.add(b);}
  }
  for(const control of all(root,'[data-lab=confirmed],[data-review]')){
   const label=control.closest('label');if(!label||!available(control))continue;
   if(control.checked){label.classList.add('rf-reviewed');attr(label,'data-flow-mark','');nextMarks.add(label);if(control.hasAttribute('data-review')){const b=badge(label,'reviewed','✓ 검토 확인');tagged.add(b);}}
  }
  for(const s of state.sections){
   const count=state.issues.filter(x=>x.el&&s.contains(x.el)).length;
   const heading=one(s,':scope > h3,:scope > summary,:scope > .sl-panel-heading > h3');
   if(count&&heading){const b=badge(heading,'count','확인 '+count+'개');tagged.add(b);}
  }
  for(const tab of state.tabs){
   const count=state.issues.filter(x=>x.step===tab.key||(x.el&&tab.el?.contains(x.el)&&!x.step)).length;
   if(count){const b=badge(tab.button,'count','확인 '+count+'개');tagged.add(b);}
   // Preserve native tab behavior and names. Existing badges describe entered results.
   if(root.matches('[data-hc-editor]'))attr(tab.button,'data-flow-pending',count?'true':'false');
  }
  if(ctx.current?.isConnected&&root.contains(ctx.current)){ctx.current.classList.add('rf-current');attr(ctx.current,'data-flow-mark','');nextMarks.add(ctx.current);}
  for(const old of ctx.marks)if(!nextMarks.has(old)){old.classList.remove('rf-required','rf-review','rf-current','rf-reviewed');old.removeAttribute('data-flow-mark');}
  ctx.marks=nextMarks;
  for(const n of all(root,'[data-flow-ui=required],[data-flow-ui=reviewed],[data-flow-ui=count]'))if(!tagged.has(n))n.remove();
  const nav=state.tabs.length?state.tabs:state.sections.map(el=>({el,label:headingText(one(el,'h3,summary,h4'))}));
  const active=nav.findIndex(x=>x.button?.getAttribute('aria-pressed')==='true'||x.button?.getAttribute('aria-selected')==='true'||x.button?.getAttribute('aria-current')==='true'||x.el===ctx.current||x.el?.contains(document.activeElement));
  ctx.next=nav[active+1]||null;
  const button=one(bar,'[data-flow-next]'),first=state.issues[0];button.hidden=!first&&!ctx.next;
  text(button,first?(state.search?'환자 검색으로':(first.kind==='required'?'입력: ':'확인: ')+first.label):ctx.next?'다음: '+ctx.next.label:'');
 }
 function revealSection(el){if(!el)return;if(el.tagName==='DETAILS')el.open=true;const input=all(el,fieldSelector).find(available);if(input)reveal(input);else{el.tabIndex=-1;reveal(el);}}
 let frame=0;
 function refresh(){frame=0;for(const root of [...roots.keys()])if(!root.isConnected)roots.delete(root);for(const root of all(document,rootSelector))render(root);}
 // A background tab may suspend animation frames. Keep form state current on return.
 function schedule(){if(!frame)frame=setTimeout(refresh,32);}
 function start(){
  if(!document.body)return;
  new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('[data-flow-ui]')&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].length&&[...r.addedNodes,...r.removedNodes].every(owned))))schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','inert','aria-invalid','aria-pressed','aria-selected','aria-current']});
  document.addEventListener('input',schedule);document.addEventListener('change',schedule);
  document.addEventListener('focusin',e=>{
   const root=e.target.closest(rootSelector),ctx=roots.get(root);if(!ctx||e.target.closest('[data-flow-ui]'))return;
   const section=e.target.closest(sectionsSelector);ctx.current=section&&root.contains(section)?section:null;schedule();
  });schedule();
 }
 g.RecordFlowGuidance={summary,refresh};
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
})(globalThis);
