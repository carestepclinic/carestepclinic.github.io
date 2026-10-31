/* Presentation-only calculator workflow. Delegates every calculation and saved-setting application. */
(function(g){
 'use strict';
 function mount(b){
  if(!b||b.dataset.clarityMounted)return {dispose(){}};
  b.dataset.clarityMounted='true';
  const q=s=>b.querySelector(s),all=s=>[...b.querySelectorAll(s)],set=(n,t)=>{if(n&&n.textContent!==t)n.textContent=t;},hide=(n,v)=>{if(n&&n.hidden!==v)n.hidden=v;};
  let frame=0,disposed=false;
  const cleanups=[],saved=[];
  function details(label,cls){const d=document.createElement('details');d.className=cls;const s=document.createElement('summary');s.textContent=label;d.append(s);return d;}
  const common=q('.pt-calc-common');
  function measure(){const h=common&&getComputedStyle(common).position==='sticky'?Math.ceil(common.getBoundingClientRect().height):0;b.style.setProperty('--pt-context-height',h+'px');}
  const resize=new ResizeObserver(measure);if(common)resize.observe(common);window.addEventListener('resize',measure);measure();
  for(const select of all('select[data-protocol]')){
   const label=select.closest('label'),bar=select.closest('.pt-protocol-bar');if(!label||!bar)continue;
   const d=details('저장 설정 불러오기','pt-saved-settings');label.before(d);d.append(label);saved.push({select,d,status:bar.querySelector('[data-protocol-status]')});
  }
  // One nutrition chooser. Product-only and complete settings retain their original handlers.
  const nutrition=q('[data-calc=nutrition]'),whole=nutrition?.querySelector('[data-protocol=nutrition]'),food=nutrition?.querySelector('[data-nutrition-product]');
  
  if(whole&&food){
   const original=whole.onchange,foodLabel=food.closest('label'),foodState=foodLabel.nextElementSibling,bar=whole.closest('.pt-protocol-bar'),goal=nutrition.querySelector('.pt-nutrition-plan');
   hide(foodLabel,true);hide(foodState,true);goal?.after(bar);
   const scope=document.createElement('label');scope.textContent='불러올 범위';const choice=document.createElement('select');choice.dataset.nutritionScope='';choice.add(new Option('제품 정보만 · 목표 열량 유지','product'));choice.add(new Option('전체 계산 설정 · 목표 포함','all'));scope.append(choice);whole.closest('label').before(scope);
   let foodBusy=false;
   const reapply=document.createElement('button');reapply.type='button';reapply.dataset.nutritionReapply='';reapply.textContent='선택한 범위로 다시 불러오기';reapply.hidden=true;whole.closest('label').after(reapply);
   choice.onchange=()=>hide(reapply,!whole.value);
   whole.onchange=async()=>{
    if(foodBusy)return;const id=whole.value,scopeValue=choice.value,species=q('[data-ref-species]')?.value;
    foodBusy=true;choice.disabled=true;whole.disabled=true;reapply.disabled=true;hide(reapply,true);
    try{if(scopeValue==='all'){hide(foodState,true);await original();if(!disposed&&whole.value===id&&species===q('[data-ref-species]')?.value)choice.value='all';}
     else if(id){food.value=id;hide(foodState,false);foodState.textContent='제품 설정을 확인하는 중…';await food.onchange();}
    }finally{foodBusy=false;choice.disabled=false;whole.disabled=false;reapply.disabled=false;}
   };
   reapply.onclick=()=>whole.onchange();
   cleanups.push(()=>whole.onchange=original);
   const product=nutrition.querySelector('[name=density]')?.closest('details'),save=nutrition.querySelector('[data-nutrition-save]'),note=nutrition.querySelector('.pt-nutrition-save-scope');
   if(product){product.classList.add('pt-nutrition-product-fields');product.open=true;if(save){const actions=document.createElement('div');actions.className='pt-nutrition-save-actions';product.after(actions);actions.append(save);if(note)actions.append(note);}}
  }
  // Keep actual elapsed-time warnings outside the folded timing inputs.
  const tf=q('[data-calc=transfusion]');let timing=null,gravity=null;
  if(tf){
   const protocol=tf.querySelector('.pt-transfusion-protocol'),hours=tf.elements.hours?.closest('.pt-grid'),initial=tf.elements.initial?.closest('label'),initialGrid=tf.querySelector('[data-transfusion-initial]'),help=initialGrid?.nextElementSibling,note=tf.querySelector('[data-transfusion-timing-note]');
   if(protocol&&hours&&initial&&initialGrid){timing=details('주입 시간','pt-transfusion-time-settings');protocol.before(timing);if(note)timing.before(note);timing.append(protocol,hours,initial,initialGrid);if(help?.matches('p.pt-help'))timing.append(help);}
   const body=tf.querySelector('.pt-transfusion-gravity');if(body){gravity=details('점적 환산','pt-transfusion-drop-settings');body.before(gravity);gravity.append(body);}
  }
  const rx=q('[data-calc=batch]')||q('[data-rx-text]')?.closest('form'),nav=q('.pt-prescription-inputs');
  if(rx&&nav){const clear=nav.querySelector('[data-rx-clear]'),text=rx.querySelector('[data-rx-text]');if(clear&&text){const label=text.closest('label'),actions=document.createElement('div'),title=document.createElement('strong');actions.className='pt-prescription-clear';title.textContent='처방 원문';if(label.firstChild?.nodeType===3)label.firstChild.textContent='';text.setAttribute('aria-label','처방 원문');label.before(actions);actions.append(title,clear);set(clear,'원문 지우기');}}
  function refresh(){
   frame=0;if(disposed)return;
   for(const {select,d,status}of saved){
    const empty=!select.disabled&&select.options.length<=1;
    set(d.querySelector('summary'),'저장 설정 불러오기'+(empty?' · 없음':select.value?' · '+select.selectedOptions[0].textContent:''));
    if(status){const benign=status.textContent==='저장된 설정 없음';hide(status,benign&&!d.open);}
   }
   if(tf&&timing){const selected=!!tf.elements.product.value;hide(timing,!selected);hide(gravity,!selected);tf.classList.toggle('pt-awaiting-product',!selected);
    const h=Number(tf.elements.hours.value),mins=Number(tf.elements.initialMinutes.value),rate=tf.elements.initialRate.value;
    const duration=Number.isFinite(h)&&h>0?g.PracticeCalculators.duration(h):'시간 확인 필요';
    set(timing.querySelector('summary'),'주입 시간 · '+duration+(tf.elements.initial.checked?' · 초기 '+(mins||'—')+'분 '+(rate||'—')+' mL/kg/hr':' · 일정 속도')+' · 변경');
    set(gravity?.querySelector('summary'),'점적 환산 · '+tf.elements.factor.value+'방울/mL · 변경');
   }
   const cri=q('[data-calc=cri]'),picker=q('[data-cri-picker]');if(cri&&picker)cri.classList.toggle('pt-cri-choosing',picker.open);
   for(const card of all('[data-an-drug]'))card.classList.toggle('pt-an-chosen',!!card.querySelector('[data-an-selected]')?.checked);
   if(nav){const image=rx.querySelector('[data-mode=image]'),photo=!!(image?.getAttribute('aria-pressed')==='true'||rx.querySelector('.pt-image-launch')?.disabled);hide(rx.querySelector('.pt-prescription-clear'),photo);
    const load=rx.querySelector('.pt-flow-rx-load'),savedOpen=!!load?.open;
    for(const [key,active]of [['text',!savedOpen&&!photo],['photo',!savedOpen&&photo],['saved',savedOpen]]){const button=nav.querySelector('[data-prescription-'+key+']');if(button&&button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));}
   }
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(refresh);}
  const observer=new MutationObserver(schedule);observer.observe(b,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','disabled','aria-pressed']});
  for(const event of ['input','change','practice-kind-selected','reset'])b.addEventListener(event,schedule);
  b.addEventListener('toggle',schedule,true);refresh();
  return {dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();window.removeEventListener('resize',measure);for(const event of ['input','change','practice-kind-selected','reset'])b.removeEventListener(event,schedule);b.removeEventListener('toggle',schedule,true);cleanups.forEach(f=>f());delete b.dataset.clarityMounted;}};
 }
 g.PracticeCalculatorClarity={mount};
})(window);
