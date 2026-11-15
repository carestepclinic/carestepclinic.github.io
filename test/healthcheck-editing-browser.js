/* Synthetic-only browser scenarios. Run with healthcheck-record.js and its CSS loaded. */
(function(g){
 'use strict';
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const flush=()=>new Promise(resolve=>setTimeout(resolve,30));
 const $=selector=>document.querySelector(selector);
 const click=async selector=>{const el=$(selector);check(el,'Missing '+selector);el.click();await flush();};
 const input=async(selector,value)=>{const el=$(selector);check(el,'Missing '+selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));await flush();};
 async function fixture(){
  g.hcFixture?.view.dispose();document.querySelectorAll('dialog').forEach(el=>el.remove());
  const root=$('#root');root.replaceChildren();
  const patient={id:'fixture-patient',name:'가상 검증 환자',species:'cat',guardianName:'가상 보호자',chartNumber:'TEST',birthDate:'2020-01-01'};
  const state={identity:'fixture:hospital:user',editable:true,calls:[],fail:false,hold:null};
  const make=id=>({id,revision:1,patient_id:patient.id,patient,body:{species:'cat',healthcheckChart:HealthcheckRecord.blank()}});
  state.records={'record-1':make('record-1'),'record-2':make('record-2')};
  state.request=async(url,options={})=>{
   const body=options.body?JSON.parse(options.body):null;state.calls.push({url,body});
   if(url.endsWith('/healthcheck-summary'))return {overview:'가상 핵심 요약',summary:'검사 기반 가상 AI 소견',management:'가상 관리계획',followup:'가상 재검 안내',questions:'가상 내부 검토',source:'a'.repeat(64)};
   if(url.endsWith('/lab-import'))return {reportDate:state.records['record-1'].body.healthcheckChart.date,singleReport:true,results:[{name:'CREA',value:'2.4',unit:'mg/dL',source:'가상 검사실',reference:'0.5–1.8'}]};
   if(url.endsWith('/members'))return {members:[]};
   if(url.includes('/healthcheck-images?'))return {dataUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect width="120" height="100" fill="%23e1efea"/></svg>'};
   const match=url.match(/\/cases\/([^/?]+)(.*)$/);
   if(match){const record=state.records[match[1]];if(body){if(state.hold)await state.hold;if(state.fail){state.fail=false;throw Error('가상 저장 실패');}record.body.healthcheckChart=structuredClone(body.data);record.revision++;return {id:record.id,revision:record.revision,healthcheckChart:structuredClone(record.body.healthcheckChart)};}return {item:structuredClone(record)};}
   return {items:[]};
  };
  state.view=HealthcheckRecord.mount(root,{identity:()=>state.identity,ready:()=>true,can:()=>state.editable,request:state.request,hospital:()=>({})});
  g.hcFixture=state;await state.view.openRecord('record-1');await flush();return state;
 }
 async function clock(work){
  const set=g.setTimeout,clear=g.clearTimeout,timers=new Map();let id=1000000;
  g.setTimeout=(fn,delay,...args)=>{if(delay!==15000)return set(fn,delay,...args);const key=++id;timers.set(key,()=>fn(...args));return key;};
  g.clearTimeout=key=>{timers.delete(key);clear(key);};
  try{await work(async()=>{const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());await flush();});}finally{g.setTimeout=set;g.clearTimeout=clear;}
 }
 async function generate(){await click('[data-step=summary]');$('[data-ai-consent]').checked=true;await click('[data-action=ai]');}
 const scenarios=[
 ['expanded editor autosaves, retains caret and continues writing after rerender',async()=>clock(async tick=>{
  const f=await fixture();await click('[data-step=summary]');await click('[data-expand-prose=summary]');
  await input('.hc-prose-dialog textarea','첫 번째 가상 소견');$('.hc-prose-dialog textarea').setSelectionRange(2,4);await tick();
  check(f.records['record-1'].body.healthcheckChart.summary==='첫 번째 가상 소견','expanded autosave');
  check($('.hc-prose-dialog[open]'),'dialog stays open');check($('.hc-prose-dialog textarea').selectionStart===2,'caret preserved');
  await input('.hc-prose-dialog textarea','두 번째 가상 소견');await click('[data-prose-save]');
  check(f.records['record-1'].body.healthcheckChart.summary==='두 번째 가상 소견','later edit uses current field');
  check($('[data-prose-status]').textContent.includes('저장 완료'),'save feedback');
 })],
 ['expanded composition, save failure and revoked permission preserve input',async()=>clock(async tick=>{
  const f=await fixture();await click('[data-step=summary]');await click('[data-expand-prose=summary]');
  $('.hc-prose-dialog textarea').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));await input('.hc-prose-dialog textarea','한글 작성 중');await tick();check(f.records['record-1'].revision===1,'composition must postpone');
  $('.hc-prose-dialog textarea').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));f.fail=true;await tick();
  check($('.hc-prose-dialog textarea').value==='한글 작성 중','failed save retains text');check($('[data-prose-status]').textContent.includes('실패'),'failed save visible');
  await click('[data-prose-save]');check(f.records['record-1'].revision===2,'retry succeeds');
  f.editable=false;f.view.sync();check($('.hc-prose-dialog textarea').readOnly,'permission revocation locks modal');
 })],
 ['AI proposal survives administrative edits and requires evidence recheck',async()=>{
  const f=await fixture();await generate();await click('[data-step=exams]');await input('[data-field=veterinarian]','가상 담당자');await click('[data-step=summary]');
  check($('[data-ai-proposed=summary]').textContent.includes('가상 AI 소견'),'proposal survives');check($('[data-ai-stale]').hidden,'metadata is not stale evidence');
  await click('[data-step=exams]');await input('[data-field=weight]','5');await click('[data-step=summary]');check(!$('[data-ai-stale]').hidden,'evidence flagged');
  await click('[data-action=apply-ai]');check($('[data-ai-proposed=summary]'),'unreviewed stale proposal blocked');
  $('[data-ai-rechecked]').checked=true;await click('[data-action=apply-ai]');check($('[data-prose=summary]').value.includes('가상 AI 소견'),'reviewed proposal applied');await click('[data-action=save]');check(f.records['record-1'].body.healthcheckChart.aiSource==='','stale source not presented as current');
 }],
 ['unapplied AI has unload protection, survives record switching and clears with identity',async()=>{
  const f=await fixture();await generate();const event=new Event('beforeunload',{cancelable:true});g.dispatchEvent(event);check(event.defaultPrevented,'AI alone guards reload');
  const moving=f.view.openRecord('record-2');await flush();await click('[data-move=save]');await moving;
  await f.view.openRecord('record-1');await click('[data-step=summary]');check($('[data-ai-proposed=summary]'),'AI restored for matching record');
  f.identity='different:hospital:user';f.view.sync();const cleared=new Event('beforeunload',{cancelable:true});g.dispatchEvent(cleared);check(!cleared.defaultPrevented,'identity clears cache');check(!$('#root').children.length,'identity clears screen');
 }],
 ['save then move persists chart and a failed save cancels navigation',async()=>{
  const f=await fixture();await input('[data-field=veterinarian]','저장할 담당자');let moving=f.view.openRecord('record-2');await flush();await click('[data-move=save]');await moving;
  check(f.records['record-1'].body.healthcheckChart.veterinarian==='저장할 담당자','saved original record');check(f.view.workspaceContext().recordId==='record-2','moved after save');
  await input('[data-field=veterinarian]','실패 시 유지');f.fail=true;moving=f.view.openRecord('record-1');await flush();await click('[data-move=save]');await moving;
  check(f.view.workspaceContext().recordId==='record-2','failure stays on record');check($('[data-field=veterinarian]').value==='실패 시 유지','failed input retained');
 }],
 ['continue writing cancels movement and explicit discard does not save',async()=>{
  const f=await fixture();await input('[data-field=veterinarian]','임시 담당자');let moving=f.view.openRecord('record-2');await flush();await click('[data-move=stay]');await moving;check(f.view.workspaceContext().recordId==='record-1','cancel movement');
  moving=f.view.openRecord('record-2');await flush();await click('[data-move=discard]');await moving;check(f.records['record-1'].revision===1,'discard does not save');check(f.view.workspaceContext().recordId==='record-2','explicit move');
 }],
 ['lab search uses aliases without changing chart and long names remain readable',async()=>{
  const f=await fixture();f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'CREA',value:'2.4'}),HealthcheckRecord.row({name:'검사명이 매우 긴 가상 특수 혈액검사 항목',group:'기타 혈액검사',value:'10'})];await f.view.openRecord('record-1');await click('[data-step=labs]');
  check($('[data-lab=name]').hidden,'configured name uses text');check($('[data-lab-name]').textContent==='CREA','name rendered');
  await input('[data-lab-search]','크레아티닌');check(document.querySelectorAll('[data-row]').length===1,'alias search');check(f.view.workspaceContext().state==='saved','search does not dirty chart');
  await input('[data-lab-search]','없는검사');check($('[data-clear-lab-filter]'),'empty search can clear');await click('[data-clear-lab-filter]');check(document.querySelectorAll('[data-row]').length===2,'clear restores all');
  await click('[data-lab-settings]');check(!$('[data-lab=name]').hidden&&!$('[data-lab=name]').readOnly,'settings permits rename');
 }],
 ['Korean search composition keeps the active input until the word is committed',async()=>{
  const f=await fixture();f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'CREA'}),HealthcheckRecord.row({name:'BUN'})];await f.view.openRecord('record-1');await click('[data-step=labs]');const search=$('[data-lab-search]');search.focus();search.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));search.value='크레';search.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));check(search.isConnected,'composition retains input');search.value='크레아티닌';search.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await flush();check(document.querySelectorAll('[data-row]').length===1,'committed Korean query filters');check($('[data-lab-search]').value==='크레아티닌','committed query retained');
 }],
 ['unapplied files require an explicit choice before saving and moving',async()=>{
  const f=await fixture();await input('[data-field=veterinarian]','가상 담당자');await click('[data-step=labs]');await click('[data-action=import]');const files=new DataTransfer();files.items.add(new File(['%PDF-1.7 synthetic'],'synthetic.pdf',{type:'application/pdf'}));$('[data-lab-file]').files=files.files;$('[data-lab-file]').dispatchEvent(new Event('change',{bubbles:true}));await flush();
  const moving=f.view.openRecord('record-2');await flush();await click('[data-move=save]');check($('.hc-move-dialog[open]'),'unapplied file not silently discarded');check(f.records['record-1'].revision===1,'did not claim to save file');await click('[data-move-files]');await click('[data-move=save]');await moving;check(f.records['record-1'].body.healthcheckChart.veterinarian==='가상 담당자','chart text saved');check(f.records['record-1'].body.healthcheckChart.labs.length===0,'file did not become fabricated results');check(f.view.workspaceContext().recordId==='record-2','explicit move completed');
 }],
 ['file import fills a preset row through the visible review workflow',async()=>{
  const f=await fixture();f.records['record-1'].body.healthcheckChart.labs=[HealthcheckRecord.row({name:'CREA'})];await f.view.openRecord('record-1');await click('[data-step=labs]');await click('[data-action=import]');const files=new DataTransfer();files.items.add(new File(['%PDF-1.7 synthetic'],'synthetic.pdf',{type:'application/pdf'}));$('[data-lab-file]').files=files.files;$('[data-lab-file]').dispatchEvent(new Event('change',{bubbles:true}));await flush();$('[data-file-consent]').checked=true;await click('[data-action=read-file]');check($('[data-import-preview]'),'review shown');$('[data-import-checked]').checked=true;await click('[data-action=apply-import]');await click('[data-action=save]');const labs=f.records['record-1'].body.healthcheckChart.labs;check(labs.length===1&&labs[0].value==='2.4','one populated result after full import');
 }],
 ['photo report toggle is directly available and saved independently of selection',async()=>{
  const f=await fixture();f.records['record-1'].body.healthcheckChart.images=[{id:'photo-1',kind:'radiograph',caption:'가상 사진',imageRevision:1,includeInPrint:true}];await f.view.openRecord('record-1');await click('[data-step=radiograph]');
  check(!$('[data-print-image]').closest('details'),'toggle outside collapsed details');await click('[data-print-image]');check(!$('[data-photo-pick]').checked,'separate from selection');await click('[data-action=save]');check(f.records['record-1'].body.healthcheckChart.images[0].includeInPrint===false,'toggle saved');
 }],
 ['followup and internal notes expand with counters and preserve structured dates',async()=>{
  const f=await fixture();await click('[data-step=summary]');await input('[data-followup-date]','2026-12-01');await input('[data-followup-tests]','가상 재검');await click('[data-expand-prose=followup]');await input('.hc-prose-dialog textarea','재검 시 안내');await click('[data-prose-save]');await click('[data-prose-close]');
  check(f.records['record-1'].body.healthcheckChart.followup.includes('2026-12-01'),'followup date retained');check($('[data-prose-count=followup]').textContent.includes('8000'),'followup counter');
  $('.hc-review-notes').open=true;await click('[data-expand-prose=questions]');await input('.hc-prose-dialog textarea','내부 검토 메모');await click('[data-prose-save]');await click('[data-prose-close]');
  check(f.records['record-1'].body.healthcheckChart.questions==='내부 검토 메모','internal notes saved');check(!HealthcheckRecord.reportHTML(f.records['record-1'].body.healthcheckChart,f.records['record-1'].patient,[]).includes('내부 검토 메모'),'internal notes excluded from report');
 }]
 ];
 g.HealthcheckEditingChecks={fixture,scenarios,async run(report){const errors=[];const errorHandler=e=>errors.push(e.message);g.addEventListener('error',errorHandler);try{for(const[name,fn]of scenarios){try{await fn();report({name,ok:true});}catch(e){report({name,ok:false,error:e.stack||String(e)});}finally{g.hcFixture?.view.dispose();}}if(errors.length)report({name:'browser errors',ok:false,error:errors.join('\n')});}finally{g.removeEventListener('error',errorHandler);}}};
})(window);
