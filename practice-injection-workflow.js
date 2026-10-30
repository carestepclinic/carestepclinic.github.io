(function(g){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number(Number(n).toFixed(6)).toString();
 let recent=null;
 const patientKey=p=>p?.clinicalCaseId?'case:'+p.clinicalCaseId:p?.id?'patient:'+p.id:'';
 function context(a){return {identity:a.identity(),patient:patientKey(a.patient()),species:a.species(),weight:Number(a.weight())};}
 function same(a,b){return !!a.patient&&a.identity===b.identity&&a.patient===b.patient&&a.species===b.species&&a.weight===b.weight;}
 function remember(a,items){recent={context:context(a),items:structuredClone(items)};}
 function recall(a){if(!recent||!same(recent.context,context(a)))throw Error('동일 환자·종·체중으로 계산한 주사 처방이 없습니다. 여기서 처방을 붙여넣거나 이 환자의 계산기에서 계산해주세요.');return structuredClone(recent.items);}
 const summary=items=>items.map(({medication:m,instruction})=>m.drug+' · '+fmt(m.amount)+' mL · '+m.route+'\n'+(m.calculation?m.calculation.dosePerKg+' '+m.doseUnit+'/kg × '+m.calculation.weight+' kg = ':'1회 고정량 · ')+fmt(m.dose)+' '+m.doseUnit+(m.doseUnit==='mL'?'':' · 농도 '+m.strength+' '+m.strengthUnit+'/mL')+'\n'+instruction).join('\n\n');
 function calculator(b,a){
  const panel=b.querySelector('[data-kind-panel=batch]'),oral=panel?.querySelector('form[data-calc=batch]');if(!oral||!g.PracticeInjection)return;
  const nav=document.createElement('nav');nav.className='pt-bar';nav.setAttribute('aria-label','처방 계산 방식');nav.innerHTML='<button type="button" data-injection-mode="oral" aria-pressed="true">경구 처방</button><button type="button" data-injection-mode="injection" aria-pressed="false">주사 처방 · IV/IM/SC</button>';panel.prepend(nav);
  const host=document.createElement('section');host.className='pt-card';host.hidden=true;host.innerHTML='<p>주사제 1회량을 계산합니다. 여러 약물을 한 줄씩 입력하고, 실제 농도·경로를 확인하세요.</p><div data-injection-calculator></div><pre data-injection-preview hidden></pre><button type="button" data-injection-send hidden>계산한 주사 처방을 마취기록으로 보내기</button><p data-injection-message role="status"></p>';panel.append(host);
  let checked=[];const preview=host.querySelector('[data-injection-preview]'),send=host.querySelector('[data-injection-send]'),message=host.querySelector('[data-injection-message]');
  function changed(){checked=[];preview.hidden=send.hidden=true;message.textContent='';recent=null;}
  const input=g.PracticeInjection.mount(host.querySelector('[data-injection-calculator]'),{...a,valid:()=>a.valid()&&!host.hidden,appliedMessage:'계산 결과 확인 완료 · 아래 준비량을 마취기록에서 불러올 수 있습니다.',changed,add:items=>{checked=structuredClone(items);remember(a,items);preview.textContent=summary(items);preview.hidden=false;send.hidden=false;message.textContent=items.length+'개 주사 계산 완료 · 실제 투약 기록은 마취기록에서 확인 후 저장합니다.';}});
  host.querySelector('[data-injection-apply]').textContent='계산 결과 확인·마취기록에서 재사용';
  nav.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{oral.hidden=btn.dataset.injectionMode!=='oral';host.hidden=!oral.hidden;nav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));});
  send.onclick=()=>{try{if(!a.valid())return;const items=recall(a);if(!checked.length)throw Error('최신 계산 결과를 확인해주세요.');a.send({calculator:'anesthesia',summary:'주사 처방 계산 계획 · 실제 투약 전\n'+summary(items),species:a.species(),weight:Number(a.weight())});}catch(e){message.textContent=e.message;}};
  const changedContext=()=>input.invalidate();b.querySelector('[data-common-weight]')?.addEventListener('input',changedContext);b.querySelector('[data-ref-species]')?.addEventListener('change',changedContext);
  return {dispose(){b.querySelector('[data-common-weight]')?.removeEventListener('input',changedContext);b.querySelector('[data-ref-species]')?.removeEventListener('change',changedContext);}};
 }
 // Each row has an immutable request key. A response loss replays that row, not the saved rows.
 function batchWriter(save,revision){let payload=null,position=0,currentRevision=revision,keys=[],last=null;return async function(entries,recorder){const signature=JSON.stringify({entries,recorder});if(payload&&payload!==signature)throw Error('일부 기록 저장을 시작했습니다. 입력을 변경하지 말고 같은 내용으로 재시도해주세요.');if(!payload){payload=signature;keys=entries.map(()=>crypto.randomUUID());}try{for(;position<entries.length;position++){last=await save('anesthesia.entry',entries[position],currentRevision,recorder,keys[position]);currentRevision=last.revision;}return last;}catch(e){throw Error(position+'/'+entries.length+'개 저장 확인 · 저장된 항목은 반복하지 않습니다. 같은 내용으로 다시 저장하세요. '+e.message);}};}
 function record(a,phase){
  if(!g.PracticeInjection||!a.valid())return;const base=context(a),item=a.item;let queue=[],started=false;
  const name=phase==='induction'?'유도약물':'전처치';
  const d=a.modal(name+' 계산·준비','<p>'+esc(item.patient.name)+' · '+base.weight+' kg · '+name+'</p><p>계산한 약물은 투약 대기로 저장됩니다. 실제 투여할 때 투약을 누르세요.</p><button type="button" data-injection-import>계산기에서 불러오기</button><p data-injection-import-status role="status"></p><div data-injection-entry></div><section data-injection-queue></section><label><input name="injectionConfirm" type="checkbox" required>준비할 약물의 용량·농도·경로를 확인했습니다.</label>',async f=>{
   if(!a.valid()||!same(base,context(a)))throw Error('환자·체중·종이 변경되었습니다. 다시 계산해주세요.');
   if(f.querySelector('[data-injection-text]').value.trim())throw Error('붙여넣은 처방을 계산해 목록에 담거나 원문 입력을 비워주세요.');
   if(!queue.length||!f.elements.injectionConfirm.checked)throw Error('준비할 약물과 계산 결과를 확인해주세요.');
   started=true;f.querySelector('[data-injection-entry]').inert=true;f.querySelector('[data-injection-import]').disabled=true;f.querySelectorAll('[data-injection-remove]').forEach(b=>b.disabled=true);
   return a.save('anesthesia.medication-plan',{confirm:true,species:base.species,weight:base.weight,items:queue.map(q=>({phase,medication:q.medication,instruction:q.instruction}))},item.revision);
  });if(!d)return;const f=d.querySelector('form'),box=f.querySelector('[data-injection-queue]'),status=f.querySelector('[data-injection-import-status]');
  const submit=f.querySelector('[type=submit]');if(submit)submit.textContent='투약 대기로 저장';
  const valid=()=>a.valid()&&d.isConnected&&same(base,context(a))&&!started;
  function paint(){box.innerHTML=queue.length?'<h4>준비 목록 · '+queue.length+'개</h4>'+queue.map((q,i)=>'<div class="iw-review-row"><b>'+esc(q.medication.drug)+'</b><span>'+fmt(q.medication.amount)+' mL · '+q.medication.route+'</span><button type="button" data-injection-remove="'+i+'">제외</button><small>'+esc(q.instruction)+' · '+(q.medication.doseUnit==='mL'?'고정 부피':esc(q.medication.strength+' '+q.medication.strengthUnit+'/mL'))+'</small></div>').join(''):'';box.querySelectorAll('[data-injection-remove]').forEach(btn=>btn.onclick=()=>{if(!valid())return;queue.splice(Number(btn.dataset.injectionRemove),1);paint();});f.elements.injectionConfirm.checked=false;}
  g.PracticeInjection.mount(f.querySelector('[data-injection-entry]'),{...a,valid,appliedMessage:'준비 목록에 담았습니다. 확인 후 투약 대기로 저장하세요.',add:items=>{if(!valid())throw Error('현재 환자 정보를 다시 확인해주세요.');queue=items;paint();}});
  f.querySelector('[data-injection-import]').onclick=()=>{try{if(!valid())return;queue=recall(a);paint();status.textContent=queue.length+'개 계산 계획을 불러왔습니다. 준비할 용량과 경로를 확인하세요.';f.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){status.textContent=e.message;}};
 }
 const api={calculator,record,remember,recall,context,same,batchWriter,summary,clear:()=>{recent=null;}};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeInjectionWorkflow=api;
})(typeof window==='object'?window:globalThis);
