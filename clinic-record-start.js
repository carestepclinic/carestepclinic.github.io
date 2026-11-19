/* Shared new-record entry. Existing record controllers own persistence. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={surgery:'마취',dental:'치과',neuro:'신경검사',ophthalmic:'안과',chronic:'만성질환',healthcheck:'건강검진'};
 const copy=v=>JSON.parse(JSON.stringify(v));
 const fields=['name','chartNumber','species','weight','guardianName','breed','birthDate','sex'];
 function values(patient={},chart={}){const p={...patient,...chart.patient};const normal=g.ClinicConnections?.sexParts(p);if(normal&&['IM','CM','IF','SF','MC','MN','FS','중성화 수컷','중성화 암컷','미중성화 수컷','미중성화 암컷'].includes(p.sex)){p.sex=normal.sex;p.neutered=normal.neutered;}let sex=p.sex||'unknown';if(['MN','MC','중남'].includes(sex))sex='male:yes';else if(['FS','중여'].includes(sex))sex='female:yes';else if(sex==='M'||sex==='수컷')sex='male:unknown';else if(sex==='F'||sex==='암컷')sex='female:unknown';else if(['male','female'].includes(sex))sex+=':'+(p.neutered||'unknown');return {name:patient.name||'',chartNumber:p.chartNumber||p.externalPatientId||'',species:g.ClinicConnections?.species(patient.species)||patient.species||'',weight:chart.weight??patient.latestWeightKg??patient.weight??'',guardianName:p.guardianName||'',breed:p.breed||'',birthDate:p.birthDate||'',sex};}
 function patient(v){const [sex,neutered]=String(v.sex||'unknown').split(':');return {name:v.name,chartNumber:v.chartNumber,species:v.species,weight:v.weight===''?null:Number(v.weight),guardianName:v.guardianName,breed:v.breed,birthDate:v.birthDate,sex,neutered:neutered||'unknown'};}

 const priorBases=new WeakMap(),priorTeethBases=new WeakMap();
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
  for(const side of ['od','os'])for(const [key,v] of Object.entries(c[side]||{})){if(v===null||v==='')continue;const f=g.OphthalmicRecord?.fields?.find(f=>f[0]===key);lines.push((side==='od'?'우안':'좌안')+' · '+(f?.[1]||key)+': '+(Array.isArray(f?.[2])?f[2].find(x=>x[0]===v)?.[1]||v:v+(f?.[2]&&f[2]!=='text'?' '+f[2]:'')));}
  return {history,medications:typeof c.medications==='string'?c.medications:'',findings:lines.filter(Boolean).join('\n')};
 }
 // New-entry imports are reversible until the first save. Never copy old numeric fields.
 function syncPrior(chart,selected={},kind=''){
  const historyKey=kind==='dental'?'diagnosis':kind==='surgery'?'note':'history',medKey=kind==='surgery'?'note':'medications',keys=[...new Set([historyKey,medKey])];
  let base=priorBases.get(chart);if(!base){base=Object.fromEntries(keys.map(k=>[k,String(chart[k]||'')]));priorBases.set(chart,base);}
  const next={...base},append=(k,v)=>{if(v)next[k]=[next[k],v].filter(Boolean).join('\n\n');};
  append(historyKey,selected.history);append(historyKey,selected.findings);append(medKey,selected.medications);
  const limit=kind==='surgery'?3000:4000;if(Object.values(next).some(v=>v.length>limit))throw Error('선택한 이전 내용이 입력 한도('+limit+'자)를 넘습니다. 가져올 항목을 줄여주세요.');
  Object.assign(chart,next);if(kind==='dental'){if(!priorTeethBases.has(chart))priorTeethBases.set(chart,copy(chart.teeth||{}));const teeth=copy(priorTeethBases.get(chart));for(const [id,t] of Object.entries(selected.teeth||{}))if(!teeth[id])teeth[id]=copy(t);chart.teeth=teeth;}return chart;
 }
 // The newest explicit observation wins; later contradictory observations require review.
 function dentalAbsences(records,species,asOf){
  const allowed=new Set(g.DentalRecord?.teeth?.(species)||[]),observed=new Map(),result=[];
  const rows=[...records].filter(r=>r.body?.dentalChart?.date&&r.body.dentalChart.date<=asOf).sort((a,b)=>String(b.body.dentalChart.date).localeCompare(String(a.body.dentalChart.date))||String(b.created_at||'').localeCompare(String(a.created_at||''))||String(a.id).localeCompare(String(b.id)));
  for(const r of rows)for(const [id,t] of Object.entries(r.body.dentalChart.teeth||{})){
   if(!allowed.has(id)||!t||!Object.values(t).some(v=>v!==false&&v!==null&&v!==''))continue;
   const recent=observed.get(id);if(!recent)observed.set(id,{date:r.body.dentalChart.date,id:r.id});
   if((t.missing||t.extracted)&&!result.some(x=>x.id===id))result.push({id,date:r.body.dentalChart.date,source:r.id,kind:t.extracted?'발치':'결손',conflict:recent||null});
  }
  return result.sort((a,b)=>a.id.localeCompare(b.id));
 }
 async function preparePrior(item){
  const kind=item.body?.category||item.kind,globalName={chronic:'ChronicRecord',neuro:'NeuroRecord',ophthalmic:'OphthalmicRecord'}[kind];
  if(globalName&&!g[globalName]&&g.ClinicLazyModules){await g.ClinicLazyModules.ensure(kind);if(!g[globalName])throw Error('검사 항목 이름을 불러오지 못했습니다. 다시 확인해주세요.');}
 }
 function mount(root,a){
  const s=a.state;if(root.recordStart?.state===s&&root.querySelector('[data-record-start]')){root.recordStart.update(a);return root.recordStart;}s.mode||=a.patientId?'registered':'quick';s.values||=copy(a.values);s.quick||=copy(a.patientId?values():s.values);s.picked??=a.patientId?{id:a.patientId,...patient(s.values)}:null;s.touched??=false;
  const key=a.key(),live=()=>a.valid(key)&&root.querySelector('[data-record-start]')===page,editable=()=>live()&&a.canEdit(),locked=()=>!!s.pending||!!a.pending?.();let searching=false,searchSeq=0;
  const input=(k,label,type='text',attrs='')=>'<label>'+label+'<input data-start-field="'+k+'" name="'+(k==='name'?'quickName':k)+'" type="'+type+'" value="'+esc(s.values[k])+'" '+attrs+'></label>';
  root.innerHTML='<section class="cs-record-start" data-record-start="'+esc(a.kind)+'"><header><h2 tabindex="-1">새 '+names[a.kind]+' 기록</h2><button type="button" data-start-back data-cl-action="close">목록으로</button></header><p class="cs-start-state" data-start-state role="status">작성 준비 · 저장 전</p><div class="cs-start-discard" data-cl-discard hidden><p>저장하지 않은 입력이 있습니다.</p><button type="button" data-start-stay data-cl-action="stay">작성 계속</button><button type="button" data-start-discard data-cl-action="discard">입력 버리고 목록으로</button></div><div class="cs-start-card"><nav class="cs-start-modes" aria-label="환자 입력 방식"><button type="button" data-start-mode="quick">빠른 입력</button><button type="button" data-start-mode="registered">등록 환자 선택</button></nav><section data-start-search hidden><form data-start-search-form><label>등록 환자 검색<input type="search" name="q" maxlength="80" placeholder="환자명·보호자명·차트번호" value="'+esc(s.query||'')+'"></label><button type="submit">검색</button></form><div data-start-results role="status"></div><p data-start-picked></p></section><form data-start-form novalidate><div class="cs-start-grid">'+input('name','환자명','text','maxlength="80"')+input('chartNumber','차트번호 · 선택','text','maxlength="80"')+'<label>동물종<select data-start-field="species" name="species"><option value="">선택</option><option value="dog">개</option><option value="cat">고양이</option></select></label>'+input('weight','체중 · kg · 선택','number','min="0.01" max="1000" step="any"')+'</div><details class="cs-start-extra" '+(s.extraOpen?'open':'')+'><summary>추가 정보 · 선택</summary><div class="cs-start-grid">'+input('guardianName','보호자명','text','maxlength="80"')+input('breed','품종','text','maxlength="150"')+input('birthDate','생년월일','date','max="'+new Date(Date.now()+32400000).toISOString().slice(0,10)+'"')+'<label>성별·중성화<select data-start-field="sex" name="sex"><option value="unknown">미입력</option>'+[['male:no','미중성화 수컷'],['female:no','미중성화 암컷'],['male:yes','중성화 수컷'],['female:yes','중성화 암컷'],['male:unknown','수컷 · 중성화 미입력'],['female:unknown','암컷 · 중성화 미입력']].map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label></div></details>'+(a.options?'<fieldset class="cs-start-options"><legend>관리 질환 · 하나 이상 선택</legend>'+a.options.map(([v,l])=>'<label><input type="checkbox" data-start-option="'+v+'" '+((s.options||[]).includes(v)?'checked':'')+'>'+esc(l)+'</label>').join('')+'</fieldset>':'')+'<p class="cs-start-error" data-start-error role="alert"></p><footer><button type="submit" class="pt-primary" data-start-submit>기본정보 저장·기록 작성</button><small>'+(a.kind==='surgery'?'실제 마취 시작 시각은 기록지에서 별도로 기록합니다.':'기본정보 저장 후 검사·진료 내용을 작성합니다.')+'</small></footer></form></div></section>';
  const page=root.querySelector('[data-record-start]'),form=page.querySelector('[data-start-form]'),error=page.querySelector('[data-start-error]'),status=page.querySelector('[data-start-state]');

  let priorSeq=0,priorDetailSeq=0,dentalSeq=0;
  const freshPrior=pid=>({patientId:pid,rows:[],cursor:'',seen:new Set(),busy:false,error:'',item:null,chosen:new Map(),edits:new Map(),pendingEdits:new Set()});
  let prior=s.priorState||freshPrior(''),dental=s.dentalState||{patientId:'',busy:false,rows:[],chosen:new Set(),error:''};
  const resumePrior=prior.busy;prior.busy=false;if(dental.busy){dental.patientId='';dental.busy=false;}
  const priorBox=document.createElement('section');priorBox.className='cs-start-prior';priorBox.setAttribute('aria-label','이전 기록 연결');
  page.querySelector('[data-start-form]').before(priorBox);
  const sourceInfo=item=>{const kind=item.body?.category||item.kind,c=item.body?.[kind+'Chart']||{};return {kind,date:c.date||item.body?.anesthesiaSheet?.date||item.created_at?.slice(0,10)||'날짜 미기록'};};
  function linkedPrior(){
   if(s.mode!=='registered'||prior.patientId!==s.picked?.id)return {};
   const parts={history:[],medications:[],findings:[]};
   for(const {item,texts} of prior.chosen.values()){
    const {kind,date}=sourceInfo(item),source='[이전 기록 참고 · '+date+' · '+(names[kind]||'진료')+' · '+item.id+']';
    for(const [k,v] of Object.entries(texts))if(v.trim())parts[k].push(source+'\n'+priorLabels[k]+(k==='medications'?' · 현재 복용 여부 확인':'')+'\n'+v.trim());
   }
   const linked=Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,v.join('\n\n')]));
   if(a.kind==='dental'&&dental.patientId===s.picked?.id)linked.teeth=Object.fromEntries(dental.rows.filter(r=>dental.chosen.has(r.id)).map(r=>[r.id,{missing:true,note:'[이전 결손·발치 이력 · '+r.date+' · '+r.source+'] '+r.kind+' → 이번 기록의 기존 결손'}]));
   return linked;
  }
  function paintPrior(){
   s.priorState=prior;
   if(s.mode!=='registered'||!s.picked?.id){priorBox.innerHTML='<small>이전 기록을 연결하려면 등록 환자를 검색해 선택해주세요.</small>';return;}
   priorBox.innerHTML='<div class="cs-prior-heading"><strong data-prior-status role="status">'+esc(prior.error?'이전 기록 조회 실패':prior.busy?'이전 기록 확인 중…':prior.rows.length?'이전 기록 '+prior.rows.length+'건'+(prior.cursor?' 이상':''):'조회 가능한 이전 기록이 없습니다.')+'</strong>'+(prior.error?'<button type=button data-prior-retry>다시 조회</button>':'')+'</div>'+(prior.error?'<p>'+esc(prior.error)+' · 새 기록은 계속 작성할 수 있습니다.</p>':'')+'<div data-dental-prior></div>'+(prior.rows.length?'<label>연결할 이전 기록<select data-prior-record><option value="">날짜·종류를 선택해 내용 확인</option>'+prior.rows.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===prior.selectedId?'selected':'')+'>'+esc([r.date||'날짜 미기록',names[r.category]||'진료',r.title].filter(Boolean).join(' · '))+'</option>').join('')+'</select></label>'+(prior.cursor?'<button type=button data-prior-more>이전 기록 더 보기</button>':'')+'<p class="cs-prior-help">여러 기록에서 필요한 내용을 모아 가져올 수 있습니다. 날짜·출처를 함께 남기며, 이전 검사값은 이번 검사값으로 채우지 않습니다.</p>':'')+'<div data-prior-basket></div><div data-prior-detail></div>';
   priorBox.querySelector('[data-prior-retry]')?.addEventListener('click',()=>loadPrior(false,true));
   priorBox.querySelector('[data-prior-more]')?.addEventListener('click',()=>loadPrior(true));
   priorBox.querySelector('[data-prior-record]')?.addEventListener('change',e=>void selectPrior(e.target.value));
   paintDental();paintBasket();paintPriorDetail();lockPrior();
  }
  function lockPrior(){priorBox.querySelectorAll('button,select,input,textarea').forEach(e=>e.disabled=locked()||!a.canEdit()||prior.busy||(!!e.closest('[data-dental-prior]')&&dental.busy));}
  function paintBasket(){
   const out=priorBox.querySelector('[data-prior-basket]');if(!out)return;
   out.innerHTML=prior.chosen.size?'<strong>가져올 내용 · '+prior.chosen.size+'개 기록</strong><ul>'+[...prior.chosen].map(([id,{item,texts}])=>{const {kind,date}=sourceInfo(item);return '<li><span>'+esc(date+' · '+names[kind]+' · '+Object.keys(texts).map(k=>priorLabels[k]).join(', '))+'</span><button type=button data-prior-remove="'+esc(id)+'">선택 취소</button></li>';}).join('')+'</ul><button type=button data-prior-clear>모두 선택 취소</button>':'';
   const remove=id=>{if(!editable()||locked())return;if(id){prior.chosen.delete(id);for(const k of prior.pendingEdits)if(k.startsWith(id+':'))prior.pendingEdits.delete(k);}else {prior.chosen.clear();prior.pendingEdits.clear();}apply();s.touched=true;showError('');paintBasket();paintPriorDetail();paint();};
   out.querySelectorAll('[data-prior-remove]').forEach(el=>el.onclick=()=>remove(el.dataset.priorRemove));out.querySelector('[data-prior-clear]')?.addEventListener('click',()=>remove());
  }
  function paintPriorDetail(){
   const out=priorBox.querySelector('[data-prior-detail]');if(!out||!prior.item)return;
   const item=prior.item,sections=priorSections(item),entries=Object.entries(sections).filter(([,v])=>v),selected=prior.chosen.get(item.id)?.texts||{};
   out.innerHTML=entries.length?'<p class="cs-prior-help">반영 위치: '+(a.kind==='surgery'?'마취 참고 메모':a.kind==='dental'?'전체 소견·약물':'과거력·약물')+' · 한도를 넘으면 아래에서 필요한 문단·검사만 남겨주세요.</p>'+entries.map(([k,v])=>'<details '+(prior.edits.has(item.id+':'+k)?'open':'')+'><summary>'+esc(priorLabels[k])+' · 내용 확인·부분 편집</summary><label>가져올 내용 편집<textarea rows=5 data-prior-text="'+k+'">'+esc(prior.edits.get(item.id+':'+k)??selected[k]??v)+'</textarea></label><small data-prior-count="'+k+'"></small><button type=button data-prior-edit="'+k+'">편집한 내용 반영</button><p data-prior-edit-status="'+k+'" role=status></p></details><label class="cs-prior-pick"><input type=checkbox data-prior-pick="'+k+'" '+(selected[k]?'checked':'')+'>'+esc(priorLabels[k])+' 가져오기</label>').join(''):'<p data-prior-empty>가져올 텍스트 기록이 없습니다. 다른 기록을 선택해주세요.</p>';
   function change(k,value){
    if(!editable()||locked())return false;const old=prior.chosen.get(item.id),texts={...(old?.texts||{})};if(value.trim())texts[k]=value;else delete texts[k];
    if(Object.keys(texts).length)prior.chosen.set(item.id,{item,texts});else prior.chosen.delete(item.id);
    try{apply();prior.pendingEdits.delete(item.id+':'+k);s.touched=true;showError('');paintBasket();paint();return true;}catch(e){if(old)prior.chosen.set(item.id,old);else prior.chosen.delete(item.id);showError(e.message);return false;}
   }
   out.querySelectorAll('[data-prior-text]').forEach(el=>{const k=el.dataset.priorText,count=out.querySelector('[data-prior-count="'+k+'"]'),update=()=>{count.textContent=el.value.length+'자 · 저장란 전체 한도 '+(a.kind==='surgery'?3000:4000)+'자 (현재 입력·출처 포함)';};update();el.oninput=()=>{prior.edits.set(item.id+':'+k,el.value);prior.pendingEdits.add(item.id+':'+k);update();out.querySelector('[data-prior-edit-status="'+k+'"]').textContent='편집 후 ‘편집한 내용 반영’을 눌러주세요.';};});
   out.querySelectorAll('[data-prior-pick]').forEach(el=>el.onchange=()=>{const k=el.dataset.priorPick,ok=change(k,el.checked?out.querySelector('[data-prior-text="'+k+'"]').value:'');el.checked=!!prior.chosen.get(item.id)?.texts[k];if(!ok)out.querySelector('[data-prior-text="'+k+'"]').closest('details').open=true;});
   out.querySelectorAll('[data-prior-edit]').forEach(el=>el.onclick=()=>{const k=el.dataset.priorEdit,ok=change(k,out.querySelector('[data-prior-text="'+k+'"]').value);out.querySelector('[data-prior-pick="'+k+'"]').checked=!!prior.chosen.get(item.id)?.texts[k];out.querySelector('[data-prior-edit-status="'+k+'"]').textContent=ok?'가져올 내용에 반영했습니다.':'한도를 확인하고 내용을 줄여주세요.';});
  }
  function paintDental(){
   s.dentalState=dental;
   const out=priorBox.querySelector('[data-dental-prior]');if(!out||a.kind!=='dental')return;
   out.innerHTML='<strong>이전 결손·발치 치아</strong>'+(dental.busy?'<p role=status>이전 치아 이력 확인 중…</p>':dental.error?'<p role=alert>'+esc(dental.error)+' 자동 반영하지 않았습니다.</p><button type=button data-dental-retry>치아 이력 다시 확인</button>':dental.rows.length?'<p class="cs-prior-help">'+dental.chosen.size+'개를 기존 결손으로 이어받습니다. 이번 발치·검사 소견은 복사하지 않습니다. 선택을 해제해 수정할 수 있습니다.</p><div class="cs-prior-teeth">'+dental.rows.map(r=>'<label class="cs-prior-pick"><input type=checkbox data-dental-prior-tooth="'+r.id+'" '+(dental.chosen.has(r.id)?'checked':'')+'><span><b>'+r.id+'번</b> · '+esc(r.date+' '+r.kind)+(r.conflict?'<small>이후 '+esc(r.conflict.date)+' 기록과 상태가 다름 · 확인 후 선택</small>':'')+'</span></label>').join('')+'</div><button type=button data-dental-clear>치아 자동 반영 취소</button><button type=button data-dental-restore>일치하는 이력 다시 반영</button>':'<p class="cs-prior-help">이전 결손·발치 이력이 없습니다.</p>');
   const commit=()=>{apply();s.touched=true;paintDental();paint();};
   out.querySelectorAll('[data-dental-prior-tooth]').forEach(el=>el.onchange=()=>{if(!editable()||locked())return;el.checked?dental.chosen.add(el.dataset.dentalPriorTooth):dental.chosen.delete(el.dataset.dentalPriorTooth);commit();});
   out.querySelector('[data-dental-clear]')?.addEventListener('click',()=>{if(!editable()||locked())return;dental.chosen.clear();commit();});
   out.querySelector('[data-dental-restore]')?.addEventListener('click',()=>{if(!editable()||locked())return;dental.chosen=new Set(dental.rows.filter(r=>!r.conflict).map(r=>r.id));commit();});
   out.querySelector('[data-dental-retry]')?.addEventListener('click',()=>loadDental(true));
  }
  async function loadDental(force=false){
   const pid=s.mode==='registered'?s.picked?.id:'';if(a.kind!=='dental')return;
   if(!force&&dental.patientId===pid)return;const seq=++dentalSeq;dental={patientId:pid,busy:!!pid,rows:[],chosen:new Set(),error:''};apply();paintDental();paint();if(!pid)return;
   const species=s.values.species,asOf=a.date?.()||new Date(Date.now()+32400000).toISOString().slice(0,10),valid=()=>live()&&seq===dentalSeq&&s.mode==='registered'&&s.picked?.id===pid;
   try{
    const records=[],ids=new Set(),cursors=new Set();let cursor='';
    do{
     const params=new URLSearchParams({patientId:pid,to:asOf});if(cursor)params.set('cursor',cursor);
     const r=await a.request('/practice/clinical/dental?'+params);if(!valid())return;
     const rows=(r.items||[]).filter(row=>row.id&&!ids.has(row.id));
     for(const row of rows){if(row.patientId!==pid||row.species!==species)throw Error('환자별 치아 이력을 확인할 수 없습니다.');ids.add(row.id);}
     for(let i=0;i<rows.length;i+=4){const results=await Promise.allSettled(rows.slice(i,i+4).map(row=>a.request('/practice/clinical/cases/'+encodeURIComponent(row.id)+'?view=dental')));if(!valid())return;
      for(let j=0;j<results.length;j++){const result=results[j];if(result.status==='rejected')throw result.reason;const item=result.value.item;if(item?.id!==rows[i+j].id||item.patient_id!==pid||item.body?.species!==species||item.body?.deleted||item.body?.category!=='dental')throw Error('같은 환자의 치아 이력인지 확인할 수 없습니다.');records.push(item);}
     }
     cursor=r.next||'';if(cursor&&cursors.has(cursor))throw Error('치아 이력 조회가 반복되었습니다.');if(cursor)cursors.add(cursor);
    }while(cursor);
    if(!valid()||!a.canEdit())return;dental.rows=dentalAbsences(records,species,asOf);dental.chosen=new Set(dental.rows.filter(r=>!r.conflict).map(r=>r.id));apply();
   }catch(e){if(valid()){dental.error=e.message||'치아 이력 조회 실패';dental.rows=[];dental.chosen.clear();apply();}}finally{if(valid()){dental.busy=false;paintDental();paint();}}
  }
  async function loadPrior(more=false,force=false){
   const pid=s.mode==='registered'?s.picked?.id:'';
   if(!pid){++priorSeq;++priorDetailSeq;prior=freshPrior('');void loadDental();paintPrior();return;}
   if(!force&&!more&&prior.patientId===pid)return;
   if(more&&(prior.busy||!prior.cursor))return;
   const seq=++priorSeq;
   if(!more){++priorDetailSeq;const keep=prior.patientId===pid?prior:null;prior=freshPrior(pid);if(keep){prior.chosen=keep.chosen;prior.edits=keep.edits;prior.pendingEdits=keep.pendingEdits;}apply();}
   prior.busy=true;prior.error='';paintPrior();void loadDental();
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
   prior.selectedId=id;prior.item=null;const out=priorBox.querySelector('[data-prior-detail]');out.textContent=row?'선택한 기록을 확인하는 중…':'';if(!row)return;
   const valid=()=>live()&&seq===priorDetailSeq&&prior.selectedId===id&&s.mode==='registered'&&s.picked?.id===pid;
   try{
    const r=await a.request('/practice/clinical/cases/'+encodeURIComponent(id)+'?view='+encodeURIComponent(row.category));if(!valid())return;
    const item=r.item;if(item?.id!==id||item.patient_id!==pid||item.body?.species!==s.values.species||item.body?.deleted||(item.body?.category||item.kind)!==row.category)throw Error('같은 환자의 유효한 기록인지 확인할 수 없습니다.');
    await preparePrior(item);if(!valid())return;prior.item=item;paintPriorDetail();lockPrior();
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
   const button=page.querySelector('[data-start-submit]');button.disabled=!!s.pending||!a.canEdit()||(a.kind==='dental'&&dental.busy);button.textContent=s.pending?'저장 중…':locked()?'저장 재시도':'기본정보 저장·기록 작성';
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
   e.preventDefault();if(!editable()||s.pending||(a.kind==='dental'&&dental.busy))return;showError('');
   if(s.mode==='registered'&&!s.picked){showError('등록 환자를 검색해 선택해주세요.');return;}
   if(!s.values.name.trim()&&(!a.allowChartOnly||!s.values.chartNumber.trim())){showError(a.allowChartOnly?'환자명 또는 차트번호를 입력해주세요.':'환자명을 입력해주세요.','name');return;}
   if(!['dog','cat'].includes(s.values.species)){showError('동물종을 선택해주세요.','species');return;}
   if(s.values.weight!==''&&(!Number.isFinite(Number(s.values.weight))||Number(s.values.weight)<.01||Number(s.values.weight)>1000)){showError('체중을 확인해주세요.','weight');return;}
   const birth=s.values.birthDate;if(birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(Date.parse(birth))||new Date(birth).toISOString().slice(0,10)!==birth||birth>new Date(Date.now()+32400000).toISOString().slice(0,10))){showError('생년월일을 확인해주세요.','birthDate');return;}
   if(a.options&&!s.options?.length){showError('관리할 질환을 하나 이상 선택해주세요.');return;}
   if(prior.pendingEdits.size){const pendingKey=[...prior.pendingEdits][0],id=pendingKey.slice(0,pendingKey.lastIndexOf(':'));priorBox.querySelector('[data-prior-record]').value=id;await selectPrior(id);showError('편집 중인 이전 내용이 있습니다. ‘편집한 내용 반영’을 누른 뒤 저장해주세요.');return;}
   if(!locked())apply();s.pending=true;form.inert=true;paint();
   try{const ok=await a.save();if(live()&&!ok)showError(a.error?.()||'저장하지 못했습니다. 입력을 확인한 뒤 다시 시도해주세요.');}catch(e){if(live())showError('저장 실패 · 입력 유지 · '+(e.message||'다시 시도해주세요.'));}finally{s.pending=false;if(live()){form.inert=false;paint();}}
  };
  paintPrior();paint();void loadPrior(false,resumePrior);void loadDental();root.recordStart={state:s,update(next){a=next;paint();},busy:()=>!!s.pending,back};return root.recordStart;
 }
 const api={mount,values,patient,priorSections,syncPrior,dentalAbsences};if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicRecordStart=api;
})(typeof window==='undefined'?globalThis:window);
