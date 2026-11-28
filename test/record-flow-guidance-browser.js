/* Actual record views with synthetic adapters. No network, patient writes, or signatures. */
(function(g){
 const assert=(v,m)=>{if(!v)throw Error(m)},tick=()=>new Promise(r=>setTimeout(r,180)),$=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 const input=async(s,v)=>{const el=$(s);assert(el,'Missing '+s);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));await tick();};
 const click=async s=>{assert($(s),'Missing '+s);$(s).click();await tick();};
 g.runRecordFlowChecks=async()=>{
  const results=[],check=async(name,fn)=>{try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack,dom:root.innerHTML.slice(0,2200),guideCount:all("[data-flow-ui=bar]").length});}},root=$('#root');let view=null;
  const clean=()=>{view?.dispose?.();view=null;g.hcFixture?.view.dispose();g.hcFixture=null;root.replaceChildren();root.className='';document.querySelectorAll('dialog').forEach(n=>n.remove());};
  await check('새 기록: 필수 표시·선택 항목·입력 이동·차트번호 대체',async()=>{
   clean();let writes=0;ClinicRecordStart.mount(root,{kind:'dental',state:{mode:'quick'},values:ClinicRecordStart.values(),key:()=>1,valid:()=>true,canEdit:()=>true,allowChartOnly:true,apply:()=>{},save:()=>{writes++;return true},back:()=>{},request:async()=>({items:[]})});await tick();
   assert($('[data-start-field=name]').classList.contains('rf-required'),'name required');assert(!$('[data-start-field=weight]').classList.contains('rf-required'),'optional weight');
   await click('[data-flow-next]');assert(document.activeElement===$('[data-start-field=name]'),'next focuses field');assert(!$('[aria-invalid=true]'),'navigation does not produce an error');
   await input('[data-start-field=chartNumber]','SYN-1');assert(!$('[data-start-field=name]').classList.contains('rf-required'),'chart-only alternative');await input('[data-start-field=species]','dog');assert(!$('[data-flow-state=reviewed]'),'not reviewed from filled inputs');assert(writes===0,'guide cannot save');
  });
  await check('건강검진: 다른 탭의 확인 건수·안내 이동·명시적 대조·수정 시 해제',async()=>{
   clean();const f=await HealthcheckEditingChecks.fixture();view=f.view;const chart=f.records['record-1'].body.healthcheckChart;chart.labs=[HealthcheckRecord.row({name:'WBC',value:'8',group:'CBC',unit:'K/μL',reference:'3–15',source:'가상 검사실'}),HealthcheckRecord.row({name:'CREA',value:'1.2',group:'생화학',unit:'mg/dL',reference:'0.8–2.4',source:'가상 검사실'})];await view.openRecord('record-1');await tick();
   assert($('.hc-steps [data-step=cbc] [data-flow-ui=count]'),'CBC off-screen count');assert($('.hc-steps [data-step=labs] [data-flow-ui=count]'),'chemistry off-screen count');assert($('[data-flow-state=review]'),'review is separate from draft save');
   await click('[data-flow-next]');assert(document.activeElement===$('[data-field=veterinarian]'),'existing completion target');assert(!$('[data-field=veterinarian]').hasAttribute('aria-invalid'),'guidance is not error');
   await input('[data-field=veterinarian]','가상 수의사');await click('.hc-steps [data-step=cbc]');const box=$('[data-lab=confirmed]');assert(box.classList.contains('rf-review'),'review field amber');box.click();await tick();assert($('[data-lab=confirmed]').closest('label').classList.contains('rf-reviewed'),'explicit comparison shown');
   await input('[data-lab=value]','9');assert(!$('[data-lab=confirmed]').checked,'editing resets clinical check');assert(!$('[data-lab=confirmed]').closest('label').classList.contains('rf-reviewed'),'stale green removed');
   const writes=f.calls.filter(c=>c.body).length;await click('.hc-steps [data-step=summary]');await click('.hc-steps [data-step=labs]');assert(f.calls.filter(c=>c.body).length===writes,'navigation does not save');
   assert(document.documentElement.scrollWidth<=innerWidth+1,'healthcheck overflow');
  });
  for(const [kind,apiName] of [['neuro','NeuroRecord'],['ophthalmic','OphthalmicRecord'],['chronic','ChronicRecord'],['dental','DentalWorkflow']])await check(kind+' 실제 기록: 필수 날짜·닫힌 구역 이동·내용 보존',async()=>{
   clean();const api=g[apiName],chart=kind==='dental'?DentalRecord.empty():g[apiName].blank({},kind==='chronic'?['ckd']:undefined);chart.date='2026-11-28';let writes=0;
   const record={id:'synthetic-'+kind,revision:1,status:'active',kind:'consult',patient_id:'synthetic-patient',patient:{id:'synthetic-patient',name:'가상 검증 환자',species:'dog'},body:{category:kind,species:'dog',weight:5,[kind+'Chart']:chart}};
   const adapter={ready:()=>true,identity:()=>kind+'-fixture',can:()=>true,medical:()=>true,clinicalManage:()=>true,hospital:()=>({}),request:async(p,o={})=>{if(o.method&&o.method!=='GET'){writes++;return {revision:2,[kind+'Chart']:JSON.parse(o.body).data};}if(p.includes('/cases/'+record.id))return {item:structuredClone(record)};return {items:[],members:[]};}};
   view=api.mount(root,adapter);await view.openRecord(record.id);await tick();assert($('[data-flow-ui=bar]'),'guide mounted');
   await input('[data-field=date]','');assert($('[data-field=date]').classList.contains('rf-required'),'date required');await click('[data-flow-next]');assert(document.activeElement===$('[data-field=date]'),'focus closed basic details');
   await input('[data-field=date]','2026-11-28');await tick();assert(!$('[data-field=date]').classList.contains('rf-required'),'required removed');assert(!$('[data-flow-state=reviewed]'),'input not clinical completion');assert(writes===0,'guide no mutation');assert(document.documentElement.scrollWidth<=innerWidth+1,kind+' overflow');
  });
  await check('수술대장: 기존 필수 3개만 표시·다음 구역·초안 보존',async()=>{
   clean();let writes=0;view=SurgeryLedger.mount(root,{ready:()=>true,identity:()=> 'ledger-fixture',can:()=>true,request:async(p,o={})=>{if(o.method&&o.method!=='GET')writes++;return {items:[],members:[],settings:{},preferences:{},counts:{}};}});await view.open();await click('[data-ledger=new]');
   assert($('.sl form[data-record] [data-flow-ui=bar]'),'ledger guide');assert($('[name=patientName]').classList.contains('rf-required'),'patient required');assert($('[name=procedure]').classList.contains('rf-required'),'procedure required');assert(!$('[name=diagnosis]').classList.contains('rf-required'),'diagnosis optional');await input('[name=patientName]','가상 환자');await click('[data-flow-next]');assert(document.activeElement===$('[name=procedure]'),'next procedure');assert(writes===0,'no save');assert(document.documentElement.scrollWidth<=innerWidth+1,'ledger overflow');
  });
  await check('마취 측정: 측정값 그룹·수행자·읽기 전용·오류 구분',async()=>{
   clean();root.innerHTML='<section class="ae-inline"><header class="ae-measure-heading"><h4>측정 기록</h4></header><form data-ae-inline><label>시각<input name="observedAt" type="datetime-local" value="2026-11-28T10:00"></label><label>심박수<input name="heartRate" type="number"></label><label>호흡수<input name="respiratoryRate" type="number"></label><label>수행자<select name="recorder"><option value="">선택</option><option>가상 수행자</option></select></label></form></section>';await tick();assert($('[name=heartRate]').classList.contains('rf-required'),'at least one measurement');await input('[name=respiratoryRate]','20');assert(!$('[name=heartRate]').classList.contains('rf-required'),'second measurement satisfies group');await input('[name=recorder]','가상 수행자');assert($('[data-flow-state=ready]'),'entered only');$('[name=respiratoryRate]').setAttribute('aria-invalid','true');await tick();assert($('[data-flow-state=error]'),'real error separate');all('input,select').forEach(n=>n.disabled=true);await tick();assert(!$('.rf-required'),'disabled no input prompt');
  });
  clean();return results;
 };
})(window);
