/* Read-only inpatient selection. Clinical observations are never copied into a new exam. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function patient(item){
  const b=item.body||{},p={...b.quickPatient,...item.patient,...b.patientDemographics};
  const observations=[b.wardVitals?.weightKG,b.wardVitals?.weight,...Object.values(b.latestObservations||{}).map(v=>({value:v.values?.weightKG??v.values?.weight,observedAt:v.observedAt}))].filter(v=>v&&Number(v.value)>0).sort((a,b)=>(Date.parse(b.observedAt)||0)-(Date.parse(a.observedAt)||0));
  const measured=observations[0];
  const weight=measured?Number(measured.value):Number(b.weight)>0?Number(b.weight):null;
  return {id:item.patient_id||'',name:p.name||'',guardianName:p.guardianName||'',chartNumber:p.chartNumber||p.externalPatientId||'',species:b.species||p.species||'',breed:p.breed||'',birthDate:p.birthDate||p.birth_date||'',sex:p.sex||'unknown',neutered:p.neutered||'unknown',weight,latestWeightKg:weight,weightMeasuredAt:measured?.observedAt||'',clinicalCaseId:item.id};
 }
 function occupied(items){return (items||[]).filter(r=>r.patientCase?.kind==='admission'&&r.patientCase.status!=='closed'&&!r.patientCase.body?.deleted).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko',{numeric:true}));}
 function mount(a){
  let epoch=0;
  async function open(){
   if(!a.ready()||!a.allowed())return;
   const key=a.identity(),route=a.route(),n=++epoch;
   const d=a.modal('입원환자 불러오기','<p data-ip-status role="status">입원실 확인 중…</p><div class="cs-inpatient-list" data-ip-list></div>');
   const live=()=>n===epoch&&a.ready()&&a.allowed()&&a.identity()===key&&a.route()===route&&d.isConnected&&d.open;
   const status=d.querySelector('[data-ip-status]'),list=d.querySelector('[data-ip-list]');
   async function load(){
    try{const r=await a.request('/practice/clinical/rooms');if(!live())return;const rooms=occupied(r.items);status.textContent=rooms.length?'환자를 선택하면 기본정보와 최근 체중을 가져옵니다.':'입원 중인 환자가 없습니다.';
     list.innerHTML=rooms.map((room,i)=>{const p=patient(room.patientCase);return '<button type="button" data-ip-pick="'+i+'"><b>'+esc(p.name||'이름 미입력')+'</b><span>'+esc(room.name)+'</span><small>'+esc([p.species==='dog'?'개':p.species==='cat'?'고양이':'동물종 미입력',p.breed,p.guardianName?'보호자 '+p.guardianName:'',p.chartNumber?'차트 '+p.chartNumber:'',p.weight!==null?p.weight+' kg':'체중 미입력'].filter(Boolean).join(' · '))+'</small></button>';}).join('');
     list.querySelectorAll('[data-ip-pick]').forEach(btn=>btn.onclick=async()=>{
      if(!live())return;list.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='현재 입원 정보 확인 중…';
      try{const selected=rooms[Number(btn.dataset.ipPick)],fresh=await a.request('/practice/clinical/rooms');if(!live())return;const room=occupied(fresh.items).find(r=>r.id===selected.id&&r.patientCase.id===selected.patientCase.id);if(!room)throw Error('입원실 배정이 변경되었습니다. 목록을 다시 확인해주세요.');
       const detail=await a.request('/practice/clinical/cases/'+encodeURIComponent(room.patientCase.id));if(!live())return;const item=detail.item;
       if(!item||item.id!==room.patientCase.id||(item.patient_id||'')!==(room.patientCase.patient_id||'')||item.kind!=='admission'||item.status==='closed'||item.body?.deleted)throw Error('퇴원 또는 변경된 기록입니다. 입원실을 다시 확인해주세요.');
       const p=patient(item);if(!['dog','cat'].includes(p.species)||!p.name)throw Error('입원환자의 이름과 동물종을 먼저 확인해주세요.');
       if(a.close()){epoch++;a.select(item,p);}
      }catch(e){if(live()){status.textContent=e.message||'환자를 불러오지 못했습니다.';list.querySelectorAll('button').forEach(b=>b.disabled=false);}}
     });
    }catch(e){if(live()){status.textContent=e.message||'입원실 조회 실패';list.innerHTML='<button type="button" data-ip-retry>다시 조회</button>';list.querySelector('[data-ip-retry]').onclick=()=>void load();}}
   }
   await load();
  }
  return {open,clear(){epoch++;}};
 }
 const api={patient,occupied,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicInpatients=api;
})(typeof window==='undefined'?globalThis:window);
