/* Synthetic-only UI regression scenarios; run from the QA button, never against a clinic API. */
(async function(g){
 const assert=(v,m)=>{if(!v)throw Error(m)},$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],tick=()=>new Promise(r=>setTimeout(r,40));
 const click=async s=>{assert($(s),'Missing '+s);$(s).click();await tick()},change=async(s,v)=>{assert($(s),'Missing '+s);$(s).value=v;$(s).dispatchEvent(new Event('change',{bubbles:true}));await tick()};
 g.runBloodTabChecks=async()=>{
  const results=[],check=async(name,fn)=>{try{await fn();results.push({name,ok:true})}catch(e){results.push({name,ok:false,error:e.message})}};
  const f=await HealthcheckEditingChecks.fixture(),chart=f.records['record-1'].body.healthcheckChart;
  chart.labs=[HealthcheckRecord.row({name:'WBC',group:'blood',value:'8',unit:'K/μL',reference:'3–15',source:'synthetic CBC'}),HealthcheckRecord.row({name:'RBC',value:'7',source:'synthetic CBC'}),HealthcheckRecord.row({name:'CREA',value:'1.2',unit:'mg/dL',reference:'0.8–2.4',source:'synthetic CHEM',confirmed:true})];chart.history='원래 문진';chart.summary='원래 소견';await f.view.openRecord('record-1');
  await check('기존 기록 분류·각 탭의 입력표와 기본값',async()=>{
   assert($('.hc-steps [data-step=cbc]').textContent.includes('혈구검사'),'CBC label');assert($('.hc-steps [data-step=labs]').textContent.includes('혈청생화학검사'),'CHEM label');
   await click('[data-step=cbc]');assert($$('[data-row]').length===2,'CBC only');await click('[data-manual-open]');assert($('[data-manual-labs="CBC"]')&&!$('[data-manual-labs="생화학"]'),'CBC controls');await click('[data-action=addrow]');assert($$('[data-row]').length===3,'new CBC visible');assert($$('[data-lab=group]').at(-1).value==='CBC · 혈구검사','CBC group');await click('[data-remove-row="3"]');
   await click('[data-step=labs]');assert($$('[data-row]').length===1,'CHEM only');await click('[data-manual-open]');assert(!$('[data-manual-labs="CBC"]')&&$('[data-manual-labs="생화학"]'),'CHEM controls');
  });
  await check('탭 전환 후 값·검색·표시 조건 유지',async()=>{
   await click('[data-step=cbc]');await change('[data-row="0"] [data-lab=value]','9.5');await change('[data-lab-filter]','review');const search=$('[data-lab-search]');search.value='WBC';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();assert($$('[data-row]').length===1,'CBC search');
   await click('[data-step=labs]');assert($('[data-lab-filter]').value==='all'&&$('[data-lab-search]').value==='','independent filters');assert($('[data-lab=value]').value==='1.2','CHEM retained');
   await click('[data-step=cbc]');assert($('[data-lab-filter]').value==='review'&&$('[data-lab-search]').value==='WBC','CBC filters retained');assert($('[data-lab=value]').value==='9.5','CBC value retained');
  });
  await check('확인 필요 이동·기본값 범위·저장 후 재열기',async()=>{
   await click('[data-step=summary]');await click('[data-review-jump=unconfirmed]');assert($('.hc-steps [data-step=cbc]').getAttribute('aria-pressed')==='true','review jump to CBC');assert($$('[data-row]').length===2,'jump clears filter');
   await click('[data-fill-defaults-open]');assert($$('[data-fill-kind] option').some(e=>e.value==='CBC')&&!$$('[data-fill-kind] option').some(e=>e.value==='생화학'),'CBC fill options');await change('[data-fill-kind]','CBC');assert($$('[data-fill-pick]').length===1,'only RBC missing defaults');
   await click('[data-fill-close]');await click('[data-action=save]');assert(f.records['record-1'].body.healthcheckChart.labs.length===3,'both tabs saved');await f.view.openRecord('record-1');await click('[data-step=cbc]');assert($('[data-row="0"] [data-lab=value]').value==='9.5','reopened CBC');await click('[data-step=labs]');assert($('[data-lab=value]').value==='1.2','reopened CHEM');assert(f.records['record-1'].body.healthcheckChart.history==='원래 문진','history preserved');
  });
  await check('보고서 양쪽 검사 포함·읽기 전용·화면 넘침 없음',async()=>{
   const d=f.records['record-1'].body.healthcheckChart,html=HealthcheckRecord.reportHTML(d,{name:'가상 환자',species:'cat'},[]);assert(html.includes('data-report-title="혈액검사 · CBC"')&&html.includes('data-report-title="혈액검사 · 생화학"'),'both report sections');f.editable=false;f.view.sync();await click('[data-step=cbc]');assert($('[data-lab=value]').disabled,'readonly');assert(!$('.hc-steps [data-step=labs]').disabled,'navigation enabled');assert(document.documentElement.scrollWidth<=innerWidth+1,'viewport overflow');
  });
  f.editable=true;f.view.sync();await click('[data-step=cbc]');return results;
 };
})(window);
