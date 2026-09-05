/* CARESTEP eFriends Staging Import Helper v1.0
 * Manual one-time helper. Not loaded by CARESTEP unless invoked explicitly.
 * Uses the currently authenticated CARESTEP Clinic browser session via window.saasRequest.
 */
(() => {
  'use strict';

  if (window.__carestepEfriendsStagingImportMounted) {
    document.getElementById('efriendsStagingImportOverlay')?.remove();
  }
  window.__carestepEfriendsStagingImportMounted = true;

  const api = window.saasRequest;
  if (typeof api !== 'function') {
    alert('CARESTEP 병원 화면에 로그인한 상태에서 실행해주세요. saasRequest를 찾지 못했습니다.');
    return;
  }

  const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toDate = v => String(v || '').slice(0,10);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const addDays = (date, days) => {
    if (!date || !Number.isFinite(Number(days))) return '';
    const d = new Date(date + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0,10);
  };

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i=0;i<text.length;i++) {
      const ch=text[i];
      if (quoted) {
        if (ch==='"' && text[i+1]==='"') { field+='"'; i++; }
        else if (ch==='"') quoted=false;
        else field+=ch;
      } else {
        if (ch==='"') quoted=true;
        else if (ch===',') { row.push(field); field=''; }
        else if (ch==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
        else field+=ch;
      }
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(x=>String(x||'').trim());
    return rows.filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }

  const vaccineMeta = {
    canine_dhpp:{title:'종합백신',code:'dhppl'},
    canine_coronavirus:{title:'코로나백신',code:'corona'},
    canine_kennel_cough:{title:'켄넬코프백신',code:'kennel'},
    canine_influenza:{title:'인플루엔자백신',code:'influenza'},
    feline_fvrcp:{title:'종합백신',code:'fvrcp'},
    feline_felv:{title:'백혈병백신',code:'felv'},
    rabies:{title:'광견병백신',code:'rabies'},
    feline_fip:{title:'전염성복막염 백신',code:'fip'},
    ferret_distemper:{title:'페럿 디스템퍼 백신',code:'ferret-distemper'},
    rabbit_rvhf:{title:'토끼 바이러스성출혈열 백신',code:'rvhf'}
  };
  const doseLabel = r => String(r.booster_detected)==='1' ? 'booster' : (r.dose_no_detected ? `${r.dose_no_detected}차` : '');
  const vaccineTitle = r => {
    const m=vaccineMeta[r.carestep_vaccine_type] || {title:'예방접종',code:r.carestep_vaccine_type||'other'};
    return `${m.title}${doseLabel(r)?' '+doseLabel(r):''}`;
  };

  const state = {files:{}, data:{}, candidates:[], selected:[], created:{guardians:[],patients:[],events:[]}, log:[]};

  function log(msg, kind='') {
    state.log.unshift({at:new Date().toLocaleTimeString(),msg,kind});
    const el=document.getElementById('efLog');
    if(el) el.innerHTML=state.log.slice(0,80).map(x=>`<div class="${x.kind}"><small>${esc(x.at)}</small> ${esc(x.msg)}</div>`).join('');
  }

  function fileByBase(files, base) {
    return [...files].find(f=>f.name.toLowerCase()===base.toLowerCase()) || [...files].find(f=>f.name.toLowerCase().startsWith(base.replace('.csv','').toLowerCase()));
  }

  async function loadFiles(fileList) {
    const required=['guardians.csv','patients.csv','weights.csv','visits.csv','vaccinations.csv','heartworm.csv'];
    const found={};
    for(const name of required){
      const f=fileByBase(fileList,name);
      if(!f) throw new Error(`${name} 파일을 선택하지 않았습니다.`);
      found[name]=f;
    }
    state.files=found;
    for(const [name,f] of Object.entries(found)){
      const text=await f.text();
      state.data[name]=parseCsv(text);
      log(`${name}: ${state.data[name].length.toLocaleString()}건 읽음`);
    }
    buildCandidates();
  }

  function buildCandidates(){
    const gs=new Map(state.data['guardians.csv'].map(x=>[String(x.external_guardian_id),x]));
    const weights=groupBy(state.data['weights.csv'],'external_patient_id');
    const visits=groupBy(state.data['visits.csv'],'external_patient_id');
    const vacc=groupBy(state.data['vaccinations.csv'],'external_patient_id');
    const hw=groupBy(state.data['heartworm.csv'],'external_patient_id');
    const phoneCounts=new Map();
    for(const g of state.data['guardians.csv']){
      const p=String(g.mobile_phone_normalized||'').replace(/\D/g,'');
      if(p) phoneCounts.set(p,(phoneCounts.get(p)||0)+1);
    }
    state.candidates=state.data['patients.csv'].map(p=>{
      const g=gs.get(String(p.external_guardian_id));
      const phone=String(g?.mobile_phone_normalized||'').replace(/\D/g,'');
      return {p,g,phone,uniquePhone:!!phone && (phoneCounts.get(phone)||0)===1,
        weightCount:(weights.get(String(p.external_patient_id))||[]).length,
        visitCount:(visits.get(String(p.external_patient_id))||[]).length,
        vaccCount:(vacc.get(String(p.external_patient_id))||[]).length,
        hwCount:(hw.get(String(p.external_patient_id))||[]).length};
    }).filter(x=>x.g && String(x.p.active)!=='0' && String(x.g.active)!=='0')
      .sort((a,b)=>(Number(b.uniquePhone)-Number(a.uniquePhone)) + ((b.vaccCount+b.hwCount+b.weightCount>0)-(a.vaccCount+a.hwCount+a.weightCount>0))*2 || (b.vaccCount+b.hwCount+b.weightCount+b.visitCount)-(a.vaccCount+a.hwCount+a.weightCount+a.visitCount));

    const preferred=state.candidates.filter(x=>x.uniquePhone && (x.weightCount>=2 || x.vaccCount || x.hwCount) && x.visitCount).slice(0,5);
    state.selected=preferred.length===5?preferred:state.candidates.filter(x=>x.uniquePhone).slice(0,5);
    renderCandidates();
  }

  function groupBy(rows,key){const m=new Map();for(const r of rows||[]){const k=String(r[key]||'');if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}

  function renderCandidates(){
    const el=document.getElementById('efCandidates');
    const selectedIds=new Set(state.selected.map(x=>String(x.p.external_patient_id)));
    el.innerHTML=state.candidates.slice(0,40).map((x,i)=>{
      const id=String(x.p.external_patient_id), checked=selectedIds.has(id);
      return `<label class="ef-row"><input type="checkbox" data-ef-patient="${esc(id)}" ${checked?'checked':''}><span><b>${esc(x.p.patient_name||'이름없음')}</b><small>보호자 ${esc(x.g.display_name||'')} · ${esc(x.p.species||'other')} · eF ${esc(id)}</small></span><em>체중 ${x.weightCount} · 진료 ${x.visitCount} · 접종 ${x.vaccCount} · 사상충 ${x.hwCount}${x.uniquePhone?'':' · 번호중복'}</em></label>`;
    }).join('');
    el.querySelectorAll('[data-ef-patient]').forEach(box=>box.addEventListener('change',()=>{
      const checked=[...el.querySelectorAll('[data-ef-patient]:checked')].map(b=>b.dataset.efPatient);
      if(checked.length>5){box.checked=false;alert('Staging은 최대 5마리까지만 선택합니다.');return;}
      state.selected=checked.map(id=>state.candidates.find(x=>String(x.p.external_patient_id)===id)).filter(Boolean);
      updateCount();
    }));
    updateCount();
  }
  function updateCount(){document.getElementById('efSelectedCount').textContent=`선택 ${state.selected.length}/5`;}

  function formatPhone(v=''){
    const n=String(v||'').replace(/\D/g,'').slice(0,11);
    if(n.length===11)return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`;
    if(n.length===10)return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
    return n;
  }

  async function ensureGuardian(g){
    const body={name:String(g.display_name||'').trim()||'보호자',phone:formatPhone(g.mobile_phone_normalized||g.mobile_phone||''),memo:'eFriends Staging Import',homeStatus:'not_invited',consentConfirmed:true};
    let quality={};
    try{quality=await api('/saas/data-quality/check',{method:'POST',body:JSON.stringify({kind:'guardian',...body})});}catch{}
    const exact=(quality.candidates||[]).find(x=>x.exactPhone);
    if(exact){log(`기존 보호자 사용: ${body.name}`);return {id:exact.guardianId,created:false};}
    const d=await api('/saas/guardians',{method:'POST',body:JSON.stringify(body)});
    state.created.guardians.push(d.guardian.id);
    log(`보호자 생성: ${body.name}`,'ok');
    return {id:d.guardian.id,created:true};
  }

  async function ensurePatient(candidate, guardianId){
    const p=candidate.p;
    const neutered=String(p.neutered)==='1'?'yes':String(p.neutered)==='0'?'no':'unknown';
    const body={guardianId,name:String(p.patient_name||'').trim()||'환자',species:['dog','cat','other'].includes(p.species)?p.species:'other',breed:String(p.breed_name_raw||p.breed_code_raw||'').trim(),sex:['male','female','unknown'].includes(p.sex)?p.sex:'unknown',birthDate:toDate(p.birth_date),neutered,latestWeightKg:String(p.current_weight_kg||''),mainConditions:'',notes:`eFriends external patient ${p.external_patient_id}`};
    let quality={};
    try{quality=await api('/saas/data-quality/check',{method:'POST',body:JSON.stringify({kind:'patient',...body})});}catch{}
    const exact=(quality.candidates||[]).find(x=>x.exactPatient && x.guardianId===guardianId) || (quality.candidates||[]).find(x=>x.exactPatient);
    if(exact){log(`기존 환자 사용: ${body.name}`);return {id:exact.patientId,created:false};}
    const d=await api('/saas/patients',{method:'POST',body:JSON.stringify(body)});
    state.created.patients.push(d.patient.id);
    log(`환자 생성: ${body.name}`,'ok');
    return {id:d.patient.id,created:true};
  }

  async function postEvent(patientId, body){
    const d=await api(`/saas/patients/${encodeURIComponent(patientId)}/timeline`,{method:'POST',body:JSON.stringify(body)});
    if(d?.event?.id && !d.deduped) state.created.events.push({patientId,eventId:d.event.id});
    return d;
  }

  function pickLatest(rows, n, dateKey){return (rows||[]).slice().sort((a,b)=>String(b[dateKey]||'').localeCompare(String(a[dateKey]||''))).slice(0,n).reverse();}

  async function importTimeline(candidate, patientId){
    const external=String(candidate.p.external_patient_id);
    const weights=pickLatest(state.data['weights.csv'].filter(x=>String(x.external_patient_id)===external),10,'measured_at');
    const visits=pickLatest(state.data['visits.csv'].filter(x=>String(x.external_patient_id)===external),10,'check_in_at');
    const vacc=pickLatest(state.data['vaccinations.csv'].filter(x=>String(x.external_patient_id)===external),20,'event_at');
    const hw=pickLatest(state.data['heartworm.csv'].filter(x=>String(x.external_patient_id)===external && !/pack/i.test(String(x.item_description||''))),20,'event_at');

    for(const r of weights){
      const date=toDate(r.measured_at), value=num(r.weight_kg); if(!date||!value)continue;
      await postEvent(patientId,{type:'weight',eventDate:date,title:'체중 측정',value:String(value),measuredWeightKg:'',nextDueDate:'',status:'completed',detail:'eFriends 과거 체중 기록',source:'clinic',journeyId:'',sourceRef:`efriends:weight:${external}:${r.source_hcl_id||date}`,homeVisible:false,homeNote:''});
    }
    for(const r of visits){
      const date=toDate(r.check_in_at); if(!date)continue;
      await postEvent(patientId,{type:'visit',eventDate:date,title:'병원 진료',value:'',measuredWeightKg:'',nextDueDate:'',status:'completed',detail:String(r.pov||'').trim(),source:'clinic',journeyId:'',sourceRef:`efriends:visit:${r.external_visit_id}`,homeVisible:false,homeNote:''});
    }
    for(const r of vacc){
      const date=toDate(r.event_at); if(!date)continue;
      const meta=vaccineMeta[r.carestep_vaccine_type]||{code:r.carestep_vaccine_type||'other'};
      const visitRef=r.source_visit_id||`${external}-${date}`;
      await postEvent(patientId,{type:'vaccination',eventDate:date,title:vaccineTitle(r),value:'',measuredWeightKg:'',nextDueDate:toDate(r.suggested_next_due_at),status:'completed',detail:String(r.item_description||'').trim(),source:'clinic',journeyId:'',sourceRef:`vaccination-group:efriends-${visitRef}:${meta.code}-${r.source_item_id}`,homeVisible:false,homeNote:''});
    }
    for(const r of hw){
      const date=toDate(r.event_at); if(!date)continue;
      await postEvent(patientId,{type:'heartworm',eventDate:date,title:'심장사상충 예방',value:'',measuredWeightKg:'',nextDueDate:addDays(date,28),status:'completed',detail:String(r.item_description||'').trim(),source:'clinic',journeyId:'',sourceRef:`efriends:heartworm:${r.source_visit_id||date}:${r.source_item_id}`,homeVisible:false,homeNote:''});
    }
    log(`${candidate.p.patient_name}: 체중 ${weights.length}, 진료 ${visits.length}, 접종 ${vacc.length}, 사상충 ${hw.length} Staging 기록`,'ok');
  }

  async function runStaging(){
    if(state.selected.length<1||state.selected.length>5){alert('1~5마리를 선택해주세요.');return;}
    if(!document.getElementById('efConsent').checked){alert('병원이 기존 진료기록의 CARESTEP 이전 근거를 확인했다는 체크가 필요합니다.');return;}
    if(!confirm(`선택한 ${state.selected.length}마리를 CARESTEP에 Staging Import합니다.\n\nHome에는 비공개로 기록됩니다. 진행할까요?`))return;
    const btn=document.getElementById('efRun');btn.disabled=true;
    try{
      for(const c of state.selected){
        const guardian=await ensureGuardian(c.g);
        const patient=await ensurePatient(c,guardian.id);
        await importTimeline(c,patient.id);
      }
      log('Staging Import 완료. CARESTEP 환자 화면에서 기록을 확인하세요.','ok');
      document.getElementById('efResult').innerHTML=`<b>완료</b><span>생성 보호자 ${state.created.guardians.length} · 생성 환자 ${state.created.patients.length} · 생성 이벤트 ${state.created.events.length}</span>`;
      document.getElementById('efRollback').disabled=false;
    }catch(e){console.error(e);log(`오류: ${e.message||e}`,'err');alert(e.message||'Staging Import 중 오류가 발생했습니다.');}
    finally{btn.disabled=false;}
  }

  async function rollback(){
    if(!state.created.events.length&&!state.created.patients.length&&!state.created.guardians.length){alert('이번 세션에서 생성된 항목이 없습니다.');return;}
    if(!confirm('이번 Staging 세션에서 새로 만든 이벤트/환자/보호자를 가능한 범위에서 삭제합니다. 계속할까요?'))return;
    const btn=document.getElementById('efRollback');btn.disabled=true;
    try{
      for(const e of state.created.events.slice().reverse()){
        try{await api(`/saas/patients/${encodeURIComponent(e.patientId)}/timeline/${encodeURIComponent(e.eventId)}`,{method:'DELETE'});}catch(err){log(`이벤트 롤백 실패: ${err.message||err}`,'err');}
      }
      for(const id of state.created.patients.slice().reverse()){
        try{await api(`/saas/patients/${encodeURIComponent(id)}`,{method:'DELETE'});}catch(err){log(`환자 롤백 실패: ${err.message||err}`,'err');}
      }
      for(const id of state.created.guardians.slice().reverse()){
        try{await api(`/saas/guardians/${encodeURIComponent(id)}`,{method:'DELETE'});}catch(err){log(`보호자 롤백 실패: ${err.message||err}`,'err');}
      }
      state.created={guardians:[],patients:[],events:[]};
      log('롤백 시도 완료. 기존 CARESTEP 항목은 삭제하지 않았습니다.','ok');
    }finally{btn.disabled=true;}
  }

  const style=document.createElement('style');style.textContent=`
#efriendsStagingImportOverlay{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}.ef-panel{width:min(980px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:24px;color:#172033}.ef-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.ef-head h2{margin:3px 0 4px;font-size:24px}.ef-head p{margin:0;color:#64748b}.ef-close{border:0;background:#eef2f7;border-radius:10px;padding:8px 12px;cursor:pointer}.ef-card{border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-top:16px}.ef-card h3{margin:0 0 10px;font-size:16px}.ef-file{display:block;border:1px dashed #94a3b8;border-radius:12px;padding:14px;background:#f8fafc}.ef-file input{display:block;margin-top:8px}.ef-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0}.ef-list{max-height:300px;overflow:auto;border-top:1px solid #eef2f7}.ef-row{display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid #eef2f7}.ef-row span{display:flex;flex-direction:column}.ef-row small,.ef-row em{font-size:12px;color:#64748b;font-style:normal}.ef-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ef-btn{border:0;border-radius:11px;padding:10px 16px;font-weight:700;cursor:pointer}.ef-btn.primary{background:#2563eb;color:white}.ef-btn.danger{background:#fff1f2;color:#be123c}.ef-btn:disabled{opacity:.45;cursor:not-allowed}.ef-consent{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px;color:#475569}.ef-result{display:flex;gap:14px;margin-top:10px}.ef-result b{color:#047857}.ef-log{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;max-height:180px;overflow:auto;background:#0f172a;color:#cbd5e1;border-radius:12px;padding:10px}.ef-log .ok{color:#86efac}.ef-log .err{color:#fda4af}.ef-log small{color:#64748b}.ef-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 12px;font-size:13px}`;document.head.appendChild(style);

  const overlay=document.createElement('div');overlay.id='efriendsStagingImportOverlay';overlay.innerHTML=`<div class="ef-panel"><div class="ef-head"><div><small>CARESTEP · eFriends</small><h2>Staging Import · 최대 5마리</h2><p>기존 eFriends CSV를 CARESTEP에 시험 이전합니다. Home에는 비공개로 저장됩니다.</p></div><button class="ef-close" id="efClose">닫기</button></div><div class="ef-warn">운영 전체 이전 도구가 아닙니다. 검증용 1~5마리만 사용하세요. guardians/patients CSV는 이 브라우저에서 읽으며, 가져오기 버튼을 누르기 전에는 CARESTEP 서버로 전송하지 않습니다.</div><section class="ef-card"><h3>1. v1.7 CSV 6개 선택</h3><label class="ef-file">guardians.csv, patients.csv, weights.csv, visits.csv, vaccinations.csv, heartworm.csv<input id="efFiles" type="file" accept=".csv,text/csv" multiple></label></section><section class="ef-card"><div class="ef-toolbar"><h3>2. 테스트 환자 선택</h3><b id="efSelectedCount">선택 0/5</b></div><div id="efCandidates" class="ef-list"><p>CSV를 먼저 선택해주세요.</p></div><label class="ef-consent"><input id="efConsent" type="checkbox"><span>병원이 보유한 기존 진료기록을 CARESTEP으로 이전할 수 있는 내부 권한·처리 근거를 확인했습니다.</span></label><div class="ef-actions"><button id="efRun" class="ef-btn primary" disabled>선택 환자 Staging Import</button><button id="efRollback" class="ef-btn danger" disabled>이번 세션 롤백</button></div><div id="efResult" class="ef-result"></div></section><section class="ef-card"><h3>실행 로그</h3><div id="efLog" class="ef-log">대기 중</div></section></div>`;document.body.appendChild(overlay);

  document.getElementById('efClose').onclick=()=>{overlay.remove();style.remove();window.__carestepEfriendsStagingImportMounted=false;};
  document.getElementById('efFiles').addEventListener('change',async e=>{try{await loadFiles(e.target.files);document.getElementById('efRun').disabled=false;}catch(err){alert(err.message);log(err.message,'err');}});
  document.getElementById('efRun').onclick=runStaging;
  document.getElementById('efRollback').onclick=rollback;
  log('Staging Import Helper 준비 완료.');
})();
