/* Shared new-record entry. Existing record controllers own persistence. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={surgery:'마취',dental:'치과',neuro:'신경검사',ophthalmic:'안과',chronic:'만성질환',healthcheck:'건강검진'};
 const copy=v=>JSON.parse(JSON.stringify(v));
 const fields=['name','chartNumber','species','weight','guardianName','breed','birthDate','sex'];
 function values(patient={},chart={}){const p={...patient,...chart.patient};let sex=p.sex||'unknown';if(['MN','MC','중남'].includes(sex))sex='male:yes';else if(['FS','중여'].includes(sex))sex='female:yes';else if(sex==='M'||sex==='수컷')sex='male:unknown';else if(sex==='F'||sex==='암컷')sex='female:unknown';else if(['male','female'].includes(sex))sex+=':'+(p.neutered||'unknown');return {name:patient.name||'',chartNumber:p.chartNumber||p.externalPatientId||'',species:patient.species||'',weight:chart.weight??patient.latestWeightKg??patient.weight??'',guardianName:p.guardianName||'',breed:p.breed||'',birthDate:p.birthDate||'',sex};}
 function patient(v){const [sex,neutered]=String(v.sex||'unknown').split(':');return {name:v.name,chartNumber:v.chartNumber,species:v.species,weight:v.weight===''?null:Number(v.weight),guardianName:v.guardianName,breed:v.breed,birthDate:v.birthDate,sex,neutered:neutered||'unknown'};}

 const priorBases=new WeakMap();
 const priorLabels={history:'과거력·기록 당시 평가',medications:'기록 당시 약물',findings:'이전 검사·소견 참고'};
 function priorSections(item){
  const kind=item.body?.category||item.kind,c=item.body?.[kind+'Chart']||{},sheet=item.body?.anesthesiaSheet||{};
  const strings=(o,keys)=>keys.filter(([k])=>typeof o[k]==='string'&&o[k].trim()).map(([k,l])=>l+': '+o[k]).join('\n');
  const history=strings(c,[['history','과거력'],['diagnosis','평가'],['assessment','평가'],['stage','병기'],['diet','식이 계획'],['plan','계획'],['management','관리계획'],['followup','재검 계획']])||strings(sheet,[['diagnosis','평가'],['operation','수술'],['note','참고 메모']]);
  const examNames={physical:'신체검사',skin:'피부',eyes:'안과',ears:'귀',oral:'구강',cardiac:'심장',respiratory:'호흡기',abdomen:'복부',musculoskeletal:'근골격',neurologic:'신경',nutrition:'영양',radiograph:'방사선',ultrasound:'초음파',other:'기타'};
  const lines=[strings(c,[['examNote','검사 메모'],['summary','종합소견'],['radiographs','방사선'],['oralFindings','구강 소견'],['radiographFindings','방사선 소견']])];
  for(const r of c.labs||[])if(String(r.value??'').trim())lines.push([r.name,r.value,r.unit,r.reference?'참고범위 '+r.reference:''].filter(Boolean).join(' · '));
  for(const [key,v] of Object.entries(c.measurements||{})){if(v===null||v==='')continue;const f=g.ChronicRecord?.fields?.find(f=>f[0]===key);lines.push((f?.[1]||key)+': '+v+(f?.[2]?' '+f[2]:''));}
  for(const [key,v] of Object.entries(c.exams||{}))if(typeof v==='string'&&v.trim())lines.push((examNames[key]||key)+': '+v);
  for(const [key,v] of Object.entries(c.findings||{})){if(v===null||v==='')continue;const f=g.NeuroRecord?.allFields?.find(f=>f.id===key);lines.push((f?.label||key)+': '+(g.NeuroRecord?.schema?.options?.[f?.type]?.find(x=>x[0]===v)?.[1]||v));}
  for(const side of ['od','os'])for(const [key,v] of Object.entries(c[side]||{})){if(v===null||v==='')continue;const f=g.OphthalmicRecord?.fields?.find(f=>f[0]===key);lines.push((side==='od'?'우안':'좌안')+' · '+(f?.[1]||key)+': '+(Array.isArray(f?.[2])?f[2].find(x=>x[0]===v)?.[1]||v:v));}
  return {history,medications:typeof c.medications==='string'?c.medications:'',findings:lines.filter(Boolean).join('\n')};
 }
 // New-entry imports are reversible until the first save. Never copy old numeric fields.
 function syncPrior(chart,selected={},kind=''){
  const historyKey=kind==='dental'?'diagnosis':kind==='surgery'?'note':'history',medKey=kind==='surgery'?'note':'medications',keys=[...new Set([historyKey,medKey])];
  let base=priorBases.get(chart);if(!base){base=Object.fromEntries(keys.map(k=>[k,String(chart[k]||'')]));priorBases.set(chart,base);}
  const next={...base},append=(k,v)=>{if(v)next[k]=[next[k],v].filter(Boolean).join('\n\n');};
  append(historyKey,selected.history);append(historyKey,selected.findings);append(medKey,selected.medications);
  const limit=kind==='surgery'?3000:4000;if(Object.values(next).some(v=>v.length>limit))throw Error('선택한 이전 내용이 입력 한도('+limit+'자)를 넘습니다. 가져올 항목을 줄여주세요.');
  Object.assign(chart,next);return chart;
 }
 function mount(root,a){
  const s=a.state;if(root.recordStart?.state===s&&root.querySelector('[data-record-start]')){root.recordStart.update(a);return root.recordStart;}s.mode||=a.patientId?'registered':'quick';s.values||=copy(a.values);s.quick||=copy(a.patientId?values():s.values);s.picked??=a.patientId?{id:a.patientId,...patient(s.values)}:null;s.touched??=false;
  const key=a.key(),live=()=>a.valid(key)&&root.querySelector('[data-record-start]')===page,editable=()=>live()&&a.canEdit(),locked=()=>!!s.pending||!!a.pending?.();let searching=false,searchSeq=0;
  const input=(k,label,type='text',attrs='')=>'<label>'+label+'<input data-start-field="'+k+'" name="'+(k==='name'?'quickName':k)+'" type="'+type+'" value="'+esc(s.values[k])+'" '+attrs+'></label>';
  root.innerHTML='<section class="cs-record-start" data-record-start="'+esc(a.kind)+'"><header><h2 tabindex="-1">새 '+names[a.kind]+' 기록</h2><button type="button" data-start-back data-cl-action="close">목록으로</button></header><p class="cs-start-state" data-start-state role="status">작성 준비 · 저장 전</p><div class="cs-start-discard" data-cl-discard hidden><p>저장하지 않은 입력이 있습니다.</p><button type="button" data-start-stay data-cl-action="stay">작성 계속</button><button type="button" data-start-discard data-cl-action="discard">입력 버리고 목록으로</button></div><div class="cs-start-card"><nav class="cs-start-modes" aria-label="환자 입력 방식"><button type="button" data-start-mode="quick">빠른 입력</button><button type="button" data-start-mode="registered">등록 환자 선택</button></nav><section data-start-search hidden><form data-start-search-form><label>등록 환자 검색<input type="search" name="q" maxlength="80" placeholder="환자명·보호자명·차트번호" value="'+esc(s.query||'')+'"></label><button type="submit">검색</button></form><div data-start-results role="status"></div><p data-start-picked></p></section><form data-start-form novalidate><div class="cs-start-grid">'+input('name','환자명','text','maxlength="80"')+input('chartNumber','차트번호 · 선택','text','maxlength="80"')+'<label>동물종<select data-start-field="species" name="species"><option value="">선택</option><option value="dog">개</option><option value="cat">고양이</option></select></label>'+input('weight','체중 · kg · 선택','number','min="0.01" max="1000" step="any"')+'</div><details class="cs-start-extra" '+(s.extraOpen?'open':'')+'><summary>추가 정보 · 선택</summary><div class="cs-start-grid">'+input('guardianName','보호자명','text','maxlength="80"')+input('breed','품종','text','maxlength="150"')+input('birthDate','생년월일','date','max="'+new Date(Date.now()+32400000).toISOString().slice(0,10)+'"')+'<label>성별·중성화<select data-start-field="sex" name="sex"><option value="unknown">미입력</option>'+[['male:no','미중성화 수컷'],['female:no','미중성화 암컷'],['male:yes','중성화 수컷'],['female:yes','중성화 암컷'],['male:unknown','수컷 · 중성화 미입력'],['female:unknown','암컷 · 중성화 미입력']].map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label></div></details>'+(a.options?'<fieldset class="cs-start-options"><legend>관리 질환 · 하나 이상 선택</legend>'+a.options.map(([v,l])=>'<label><input type="checkbox" data-start-option="'+v+'" '+((s.options||[]).includes(v)?'checked':'')+'>'+esc(l)+'</label>').join('')+'</fieldset>':'')+'<p class="cs-start-error" data-start-error role="alert"></p><footer><button type="submit" class="pt-primary" data-start-submit>기본정보 저장·기록 작성</button><small>'+(a.kind==='surgery'?'실제 마취 시작 시각은 기록지에서 별도로 기록합니다.':'기본정보 저장 후 검사·진료 내용을 작성합니다.')+'</small></footer></form></div></section>';
  const page=root.querySelector('[data-record-start]'),form=page.querySelector('[data-start-form]'),error=page.querySelector('[data-start-error]'),status=page.querySelector('[data-start-state]');

  let priorSeq=0,priorDetailSeq=0;
  let prior={patientId:'',rows:[],cursor:'',seen:new Set(),busy:false,error:'',item:null,picks:new Set()};
  const priorBox=document.createElement('section');priorBox.className='cs-start-prior';priorBox.setAttribute('aria-label','이전 기록 연결');
  page.querySelector('[data-start-form]').before(priorBox);
  function linkedPrior(){
   if(s.mode!=='registered'||prior.patientId!==s.picked?.id||!prior.item)return {};
   const c=prior.item.body?.[prior.item.body?.category+'Chart']||{},kind=prior.item.body?.category||prior.item.kind,date=c.date||prior.item.body?.anesthesiaSheet?.date||prior.item.created_at?.slice(0,10)||'날짜 미기록';
   const source='[이전 기록 참고 · '+date+' · '+(names[kind]||'진료')+' · '+prior.item.id+']';
   const sections=priorSections(prior.item);return Object.fromEntries([...prior.picks].filter(k=>sections[k]).map(k=>[k,source+'\n'+priorLabels[k]+(k==='medications'?' · 현재 복용 여부 확인':'')+'\n'+sections[k]]));
  }
  function paintPrior(){
   if(s.mode!=='registered'||!s.picked?.id){priorBox.innerHTML='<small>이전 기록을 연결하려면 등록 환자를 검색해 선택해주세요.</small>';return;}
   priorBox.innerHTML='<div class="cs-prior-heading"><strong data-prior-status role="status">'+esc(prior.error?'이전 기록 조회 실패':prior.busy?'이전 기록 확인 중…':prior.rows.length?'이전 기록 '+prior.rows.length+'건'+(prior.cursor?' 이상':''):'조회 가능한 이전 기록이 없습니다.')+'</strong>'+(prior.error?'<button type=button data-prior-retry>다시 조회</button>':'')+'</div>'+(prior.error?'<p>'+esc(prior.error)+' · 새 기록은 계속 작성할 수 있습니다.</p>':'')+(prior.rows.length?'<label>연결할 이전 기록<select data-prior-record><option value="">날짜·종류를 선택해 내용 확인</option>'+prior.rows.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===prior.selectedId?'selected':'')+'>'+esc([r.date||'날짜 미기록',names[r.category]||'진료',r.title].filter(Boolean).join(' · '))+'</option>').join('')+'</select></label>'+(prior.cursor?'<button type=button data-prior-more>이전 기록 더 보기</button>':'')+'<p class="cs-prior-help">선택한 내용은 날짜·출처와 함께 참고란에 추가됩니다. 이전 검사값은 이번 검사값으로 채우지 않습니다.</p>':'')+'<div data-prior-detail></div>';
   priorBox.querySelector('[data-prior-retry]')?.addEventListener('click',()=>loadPrior(false,true));
   priorBox.querySelector('[data-prior-more]')?.addEventListener('click',()=>loadPrior(true));
   priorBox.querySelector('[data-prior-record]')?.addEventListener('change',e=>void selectPrior(e.target.value));
   paintPriorDetail();lockPrior();
  }
  function lockPrior(){priorBox.querySelectorAll('button,select,input').forEach(e=>e.disabled=locked()||!a.canEdit()||prior.busy);}
  function paintPriorDetail(){
   const out=priorBox.querySelector('[data-prior-detail]');if(!out||!prior.item)return;
   const sections=priorSections(prior.item);out.innerHTML='<p class="cs-prior-help">반영 위치: '+(a.kind==='surgery'?'마취 참고 메모':a.kind==='dental'?'전체 소견·약물':'과거력·약물')+'</p>'+ Object.entries(sections).filter(([,v])=>v).map(([k,v])=>'<details><summary>'+esc(priorLabels[k])+'</summary><pre>'+esc(v)+'</pre></details><label class="cs-prior-pick"><input type=checkbox data-prior-pick="'+k+'" '+(prior.picks.has(k)?'checked':'')+'>'+esc(priorLabels[k])+' 가져오기</label>').join('')||'<p>가져올 텍스트 기록이 없습니다.</p>';
   out.querySelectorAll('[data-prior-pick]').forEach(el=>el.onchange=()=>{if(!editable()||locked())return;const old=new Set(prior.picks);el.checked?prior.picks.add(el.dataset.priorPick):prior.picks.delete(el.dataset.priorPick);try{apply();s.touched=true;showError('');paint();}catch(e){prior.picks=old;el.checked=old.has(el.dataset.priorPick);showError(e.message);}});
  }
  async function loadPrior(more=false,force=false){
   const pid=s.mode==='registered'?s.picked?.id:'';
   if(!pid){++priorSeq;++priorDetailSeq;prior={patientId:'',rows:[],cursor:'',seen:new Set(),busy:false,error:'',item:null,picks:new Set()};paintPrior();return;}
   if(!force&&!more&&prior.patientId===pid)return;
   if(more&&(prior.busy||!prior.cursor))return;
   const seq=++priorSeq;
   if(!more){++priorDetailSeq;prior={patientId:pid,rows:[],cursor:'',seen:new Set(),busy:false,error:'',item:null,picks:new Set()};apply();}
   prior.busy=true;prior.error='';paintPrior();
   const valid=()=>live()&&seq===priorSeq&&s.mode==='registered'&&s.picked?.id===pid;
   try{
    const params=new URLSearchParams({patientId:pid});if(more)params.set('cursor',prior.cursor);
    const r=await a.request('/practice/clinical/patient-summary?'+params);if(!valid())return;
    if(r.patient?.id!==pid||r.patient.species&&r.patient.species!==s.values.species)throw Error('환자 연결을 확인할 수 없습니다. 환자를 다시 선택해주세요.');
    if(r.nextCursor&&prior.seen.has(r.nextCursor))throw Error('이전 기록 조회가 반복되었습니다. 다시 조회해주세요.');
    const incoming=(r.items||[]).filter(x=>x.id&&!x.deleted&&names[x.category]);
    prior.rows=[...new Map([...prior.rows,...incoming].map(x=>[x.id,x])).values()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    prior.cursor=r.nextCursor||'';if(prior.cursor)prior.seen.add(prior.cursor);
   }catch(e){if(valid())prior.error=e.message||'다시 시도해주세요.';}finally{if(valid()){prior.busy=false;paintPrior();}}
  }
  async function selectPrior(id){
   if(!editable()||locked())return;const row=prior.rows.find(r=>r.id===id),pid=prior.patientId,seq=++priorDetailSeq;
   prior.selectedId=id;prior.item=null;prior.picks.clear();apply();const out=priorBox.querySelector('[data-prior-detail]');out.textContent=row?'선택한 기록을 확인하는 중…':'';if(!row)return;
   const valid=()=>live()&&seq===priorDetailSeq&&prior.selectedId===id&&s.mode==='registered'&&s.picked?.id===pid;
   try{
    const r=await a.request('/practice/clinical/cases/'+encodeURIComponent(id)+'?view='+encodeURIComponent(row.category));if(!valid())return;
    const item=r.item;if(item?.id!==id||item.patient_id!==pid||item.body?.species!==s.values.species||item.body?.deleted||(item.body?.category||item.kind)!==row.category)throw Error('같은 환자의 유효한 기록인지 확인할 수 없습니다.');
    prior.item=item;paintPriorDetail();lockPrior();
   }catch(e){if(valid()){out.textContent='기록을 불러오지 못했습니다. '+e.message;const retry=document.createElement('button');retry.type='button';retry.textContent='다시 확인';retry.onclick=()=>selectPrior(id);out.append(retry);lockPrior();}}
  }
  function showError(message,field){error.textContent=message||'';if(field){const el=form.querySelector('[data-start-field="'+field+'"]');if(el){el.setAttribute('aria-invalid','true');const detail=el.closest('details');if(detail)detail.open=true;el.focus();}}}
  function apply(){a.apply(copy(s.values),s.mode==='registered'?s.picked:null,s.options||[],linkedPrior());}
  function paint(){
   lockPrior();
   const registered=s.mode==='registered';page.querySelector('[data-start-search]').hidden=!registered;
   page.querySelectorAll('[data-start-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.startMode===s.mode));b.disabled=locked()||!!a.identityLocked;});
   for(const k of fields){const el=form.querySelector('[data-start-field="'+k+'"]');if(document.activeElement!==el)el.value=s.values[k]??'';el.disabled=locked()||!a.canEdit()||(registered&&['name','chartNumber','species','guardianName'].includes(k))||(!!a.identityLocked&&['name','chartNumber','species','guardianName'].includes(k));}
   form.querySelectorAll('[data-start-option]').forEach(el=>el.disabled=locked()||!a.canEdit());
   page.querySelector('[data-start-picked]').textContent=s.picked?'선택: '+s.picked.name+' · '+(s.picked.chartNumber||s.picked.externalPatientId||'차트번호 미입력')+' · 보호자 '+(s.picked.guardianName||'미입력'):'검색 결과에서 환자를 선택해주세요.';
   const button=page.querySelector('[data-start-submit]');button.disabled=!!s.pending||!a.canEdit();button.textContent=s.pending?'저장 중…':locked()?'저장 재시도':'기본정보 저장·기록 작성';
   page.querySelector('[data-start-back]').disabled=!!s.pending;
   page.querySelector('[data-start-search-form]').inert=locked()||!!a.identityLocked;
   status.textContent=s.pending?'기본정보 저장 중…':locked()?'저장 확인 필요 · 입력 유지':s.touched?'작성 중 · 저장 전':'작성 준비 · 저장 전';
  }
  function setMode(mode){if(!editable()||locked()||a.identityLocked||mode===s.mode)return;if(s.mode==='quick')s.quick=copy(s.values);else s.registered=copy(s.values);s.mode=mode;s.values=copy(mode==='quick'?s.quick:s.registered||values(s.picked||{}));s.touched=true;searchSeq++;page.querySelector('[data-start-results]').textContent='';apply();paint();showError('');void loadPrior();}
  page.querySelectorAll('[data-start-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.startMode));
  for(const el of form.querySelectorAll('[data-start-field]'))el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{if(!editable()||locked())return;s.values[el.dataset.startField]=el.value;s.touched=true;el.removeAttribute('aria-invalid');apply();paint();showError('');});
  form.querySelectorAll('[data-start-option]').forEach(el=>el.onchange=()=>{if(!editable()||locked())return;s.options=[...form.querySelectorAll('[data-start-option]:checked')].map(x=>x.dataset.startOption);s.touched=true;apply();paint();showError('');});
  page.querySelector('.cs-start-extra').ontoggle=e=>{s.extraOpen=e.target.open;};
  page.querySelector('[data-start-search-form]').onsubmit=async e=>{
   e.preventDefault();if(!editable()||locked()||searching||a.identityLocked)return;const query=e.target.elements.q.value.trim(),out=page.querySelector('[data-start-results]');s.query=query;if(!query){out.textContent='검색어를 입력해주세요.';return;}const n=++searchSeq;searching=true;out.textContent='검색 중…';
   try{const r=await a.request('/patient-directory?'+new URLSearchParams({q:query,active:'active',pageSize:'20',limit:'20',page:'1'}));if(!live()||n!==searchSeq||s.mode!=='registered')return;const patients=r.patients||[];out.innerHTML=patients.map((p,i)=>'<button type="button" data-start-pick="'+i+'"><b>'+esc(p.name)+'</b><span>'+esc([(p.species==='dog'?'개':p.species==='cat'?'고양이':'종 확인 필요'),p.chartNumber||p.externalPatientId,p.guardianName?'보호자 '+p.guardianName:''].filter(Boolean).join(' · '))+'</span></button>').join('')||'<p>검색 결과가 없습니다. 검색어를 바꾸거나 빠른 입력을 이용하세요.</p>';if(r.pagination?.hasNext||r.pagination?.total>20)out.insertAdjacentHTML('beforeend','<small>결과가 많습니다. 검색어를 더 구체적으로 입력해주세요.</small>');out.querySelectorAll('[data-start-pick]').forEach(b=>b.onclick=()=>{if(!editable()||locked()||s.mode!=='registered')return;const p=patients[+b.dataset.startPick];if(!['dog','cat'].includes(p.species)){showError('환자 관리에서 동물종을 확인해주세요.');return;}s.picked=copy(p);s.values=values(p);s.touched=true;apply();paint();showError('');void loadPrior();});
   }catch(e){if(live()&&n===searchSeq)out.textContent='검색 실패 · '+(e.message||'다시 시도해주세요.');}finally{searching=false;}
  };
  function back(){if(!live()||s.pending)return;if(a.confirmBack!==false&&(s.touched||a.dirty?.())){const notice=page.querySelector('[data-cl-discard]');notice.hidden=false;notice.scrollIntoView({block:'nearest'});notice.querySelector('button').focus();}else a.back();}
  page.querySelector('[data-start-back]').onclick=back;page.querySelector('[data-start-stay]').onclick=()=>{page.querySelector('[data-cl-discard]').hidden=true;};page.querySelector('[data-start-discard]').onclick=()=>{if(live()&&!s.pending)a.back();};
  form.onsubmit=async e=>{
   e.preventDefault();if(!editable()||s.pending)return;showError('');
   if(s.mode==='registered'&&!s.picked){showError('등록 환자를 검색해 선택해주세요.');return;}
   if(!s.values.name.trim()&&(!a.allowChartOnly||!s.values.chartNumber.trim())){showError(a.allowChartOnly?'환자명 또는 차트번호를 입력해주세요.':'환자명을 입력해주세요.','name');return;}
   if(!['dog','cat'].includes(s.values.species)){showError('동물종을 선택해주세요.','species');return;}
   if(s.values.weight!==''&&(!Number.isFinite(Number(s.values.weight))||Number(s.values.weight)<.01||Number(s.values.weight)>1000)){showError('체중을 확인해주세요.','weight');return;}
   const birth=s.values.birthDate;if(birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(Date.parse(birth))||new Date(birth).toISOString().slice(0,10)!==birth||birth>new Date(Date.now()+32400000).toISOString().slice(0,10))){showError('생년월일을 확인해주세요.','birthDate');return;}
   if(a.options&&!s.options?.length){showError('관리할 질환을 하나 이상 선택해주세요.');return;}
   if(!locked())apply();s.pending=true;form.inert=true;paint();
   try{const ok=await a.save();if(live()&&!ok)showError(a.error?.()||'저장하지 못했습니다. 입력을 확인한 뒤 다시 시도해주세요.');}catch(e){if(live())showError('저장 실패 · 입력 유지 · '+(e.message||'다시 시도해주세요.'));}finally{s.pending=false;if(live()){form.inert=false;paint();}}
  };
  paint();void loadPrior();root.recordStart={state:s,update(next){a=next;paint();},busy:()=>!!s.pending,back};return root.recordStart;
 }
 const api={mount,values,patient,priorSections,syncPrior};if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicRecordStart=api;
})(typeof window==='undefined'?globalThis:window);
