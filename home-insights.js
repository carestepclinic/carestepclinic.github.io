/* Read-only views of already shared HOME information. No clinical interpretation or extra requests. */
(() => {
  'use strict';
  const DAY = 86400000;
  const dayNow = () => new Date(Date.now() + 32400000).toISOString().slice(0, 10);
  function validDay(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  }
  function publicEvents(events, pid) {
    const seen = new Set();
    return (Array.isArray(events) ? events : []).filter(e => {
      if (!e || e.status === 'canceled' || e.homeVisible === false || e.home_visible === 0 || e.patientId && e.patientId !== pid || !validDay(e.eventDate)) return false;
      if (e.id && seen.has(e.id)) return false;
      if (e.id) seen.add(e.id);
      return true;
    }).sort((a,b) => b.eventDate.localeCompare(a.eventDate) || String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || '')));
  }
  function recentRecords(events, pid, days = 7, today = dayNow()) {
    days = days === 30 ? 30 : 7;
    const from = new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * DAY).toISOString().slice(0, 10);
    const all = publicEvents(events, pid).filter(e => e.eventDate <= today);
    const items = all.filter(e => e.eventDate >= from), home = items.filter(e => e.source === 'home');
    const recordedDays = new Set(home.map(e => e.eventDate)).size;
    const weights = new Map();
    for (const e of items) if (e.type === 'weight' && e.value !== '' && e.value != null && Number.isFinite(Number(e.value)) && Number(e.value) > 0 && (!e.unit || e.unit === 'kg') && !weights.has(e.eventDate)) weights.set(e.eventDate, {date:e.eventDate, value:Number(e.value)});
    const samples = [...weights.values()].reverse(), first = samples[0], last = samples.at(-1);
    const counts = ['appetite','water','vomiting','diarrhea','medication'].map(type => ({type, count:home.filter(e => e.type === type).length}));
    return {days, from, to:today, items, counts, recordedDays, missingDays:days-recordedDays, partial:(events || []).length >= 500, samples, first, last, difference:samples.length > 1 ? Math.round((last.value-first.value)*1000)/1000 : null, latestDate:all[0]?.eventDate || '', latestHomeDate:all.find(e=>e.source==='home')?.eventDate || ''};
  }
  function insightModel(base, care, shared, days = 7, today = dayNow()) {
    if (!base?.token || base.token !== care?.token || base.token !== shared?.token || base.home?.consentRequired || !base.home) return null;
    const pid = care.patientId, connection = base.home.connections?.find(c => c.patients?.some(p => p.id === pid)), patient = connection?.patients.find(p => p.id === pid);
    if (!patient || patient.active === false) return null;
    const group = care.publicGroup?.p?.id === pid ? care.publicGroup : null;
    const detail = shared.timeline?.patientId === pid ? shared.timeline : null;
    const useDetail = detail && (!group?.timelineLoadedAt || Number(detail.at || 0) >= Date.parse(group.timelineLoadedAt) || detail.loading || detail.failed);
    const events = useDetail ? detail.events : group?.events || [];
    const failed = useDetail ? detail.failed : group?.timelineFailed;
    const loading = useDetail ? detail.loading : !group || group.timelineLoading;
    const checkedAt = useDetail ? detail.at : group?.timelineLoadedAt;
    const all = publicEvents(events, pid), recent = recentRecords(events, pid, days, today);
    const visits = all.filter(e => ['visit','recheck'].includes(e.type) && e.source !== 'home' && e.eventDate <= today);
    const rechecks = all.filter(e => ['visit','recheck'].includes(e.type) && validDay(e.nextDueDate) && e.nextDueDate >= today).sort((a,b)=>a.nextDueDate.localeCompare(b.nextDueDate));
    const materials = (shared.materials || []).filter(m => m.patientId === pid && !m.replacementId && ['advanced','discharge','disease','postoperative'].includes(m.kind)).sort((a,b)=>(Date.parse(b.sentAt)||0)-(Date.parse(a.sentAt)||0));
    const followups = (shared.followups || []).filter(f => f.patientId === pid && f.status !== 'canceled').sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed') || String(b.dueDate||'').localeCompare(String(a.dueDate||'')));
    const plans = group?.medicationFailed ? [] : (group?.plans || []).filter(p => (!p.patientId || p.patientId === pid) && p.active !== false && (!p.endDate || p.endDate >= today));
    const doses = (group?.doses || []).filter(d => d.date === today && (!d.patientId || d.patientId === pid));
    return {pid, patient, clinic:connection.clinicName, today, events:all, recent, visits, recheck:rechecks[0], materials, followups, plans, medicationReady:!!group && !group.medicationFailed && group.date === today, doses, checkedAt, failed:!!failed, loading:!!loading, materialState:shared.materialState || 'loading', followupState:shared.followupState || 'loading'};
  }
  function recentHeadline(m) {
    const r=m.recent, prefix='최근 '+r.days+'일';
    if(m.failed)return prefix+' · 조회 실패 · 다시 확인 필요';
    if(m.loading)return prefix+' · 기록 확인 중';
    return prefix+(r.partial?' · 조회된 기록 기준':'')+' · 홈 기록 '+r.recordedDays+'일 · 체중 측정 '+r.samples.length+'일';
  }
  // Models are exposed only to the repository's synthetic tests.
  if (typeof document === 'undefined') { globalThis.carestepInsightModels = {validDay, publicEvents, recentRecords, insightModel, recentHeadline}; return; }
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text !== undefined)n.textContent=text;return n;};
  let scope='', period=7, signature='', current=null;
  function inputs() { return {base:window.carestepHomeSnapshot?.() || {}, care:window.carestepHomeCare?.context?.() || {}, shared:window.carestepHomeInsightData?.() || {}}; }
  function button(label, action, cls='home-secondary') {const b=make('button',cls,label);b.type='button';b.onclick=action;return b;}
  function note(host, value, warning=false) {host.append(make('p',warning?'home-insight-note is-warning':'home-insight-note',value));}
  function stamp(value) {const d=new Date(value);return value && Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '확인 시각 없음';}
  function mount() {
    const home=$('homeNavigation-home'), hospital=$('homeNavigation-hospital'), health=$('patientTimelineBody');
    if (!home || !hospital || !health) return false;
    if (!$('homeInsightEntry')) {
      const entry=make('section','home-insight-entry');entry.id='homeInsightEntry';home.append(entry);
      const overview=make('section','home-insight-card');overview.id='homePublicOverview';hospital.prepend(overview);
      const guides=make('section','home-insight-card');guides.id='homeLinkedGuides';overview.after(guides);
      const summary=make('details','home-insight-card home-insight-summary');summary.id='homeRecentSummary';
      const heading=make('summary','','최근 건강기록 요약');summary.append(heading,make('div','home-insight-summary-body'));
      health.querySelector('.patient-chart-card')?.after(summary);
      if (!summary.isConnected) health.prepend(summary);
    }
    return true;
  }
  function clear() {
    current=null;signature='';scope='';period=7;
    for(const id of ['homeInsightEntry','homePublicOverview','homeLinkedGuides']){const n=$(id);if(n){n.hidden=true;n.replaceChildren();}}
    const summary=$('homeRecentSummary');if(summary){summary.hidden=true;summary.open=false;summary.querySelector('summary')?.replaceChildren();summary.querySelector('div')?.replaceChildren();}
  }
  function guard(m, action) {const expected=scope;return () => {const i=inputs(),next=insightModel(i.base,i.care,i.shared,period);if(next && next.pid===m.pid && i.base.token+'|'+next.pid===expected&&scope===expected)action(next);};}
  function records(m, type, id) {return guard(m,()=>window.carestepOpenHomePatientRecord?.(m.pid,type,id));}
  function headline(host, title, subtitle) {host.append(make('h3','',title));if(subtitle)note(host,subtitle);}
  function readable(host, text, key) {
    const value=String(text||'');
    if(value.length<=100){host.append(make('p','home-insight-copy',value));return;}
    host.append(make('p','home-insight-copy',value.slice(0,100)+'…'));
    const d=make('details','home-insight-more');d.dataset.insightExpand='visit:'+key;d.append(make('summary','','공개 안내 전체 보기'),make('p','home-insight-copy',value));host.append(d);
  }
  function list(host, items, render, label) {
    items.slice(0,3).forEach(x=>host.append(render(x)));
    if(items.length>3){const more=make('details','home-insight-more');more.dataset.insightExpand=label;more.append(make('summary','',label+' '+(items.length-3)+'건 더 보기'));items.slice(3).forEach(x=>more.append(render(x)));host.append(more);}
  }
  function renderOverview(m) {
    const host=$('homePublicOverview');headline(host,m.patient.name+' · 공개 진료정보','병원에서 이미 공개한 진료·복약·재진 정보를 모았습니다.');
    if(m.loading || m.failed){note(host,m.failed?'진료정보를 확인하지 못했습니다. 다시 조회해주세요.':'진료정보를 확인하고 있습니다…',m.failed);host.append(button('건강기록 다시 조회',records(m)));}
    else {
      host.append(make('h4','','최근 진료'));
      if(!m.visits.length)note(host,'공개된 진료기록이 없습니다.');
      list(host,m.visits.slice(0,1),e=>{const card=make('article','home-insight-item');card.append(make('small','',e.eventDate+' · 병원 기록'),make('b','',e.title||'병원 진료'));readable(card,e.homeNote||'공개된 방문목적·안내가 없습니다.',e.id);card.append(button('이 진료기록 보기',records(m,'visit',e.id)));return card;},'진료기록');
      if(m.visits.length)host.append(button('공개 진료기록 전체 보기',records(m,'visit')));
      const due=make('div','home-insight-recheck');due.append(make('b','','등록된 다음 재진'),make('span','',m.recheck?.nextDueDate||'공개 기록에 예정일이 없습니다.'));if(m.recheck)due.append(button('재진 기록 보기',records(m,'visit',m.recheck.id)));host.append(due);
      note(host,'최근 병원 진료일 · '+(m.visits[0]?.eventDate||'공개 기록 없음')+' / HOME 조회 · '+stamp(m.checkedAt));
    }
    const meds=make('div','home-insight-medication');meds.append(make('b','','병원 복약 일정'),make('span','',!m.medicationReady?'관리일정에서 조회 필요':m.plans.length?'등록 '+m.plans.length+'개 · 시간과 지시 확인':'등록된 복약 일정 없음'),button('복약 일정 보기',guard(m,()=>window.carestepHomeNavigation?.go('schedule',{target:'homeCarePatients'}))));host.append(meds);
  }
  function renderGuides(m) {
    const host=$('homeLinkedGuides');headline(host,'최근 관리 안내','받은 질환·퇴원·수술 안내의 원문을 확인하세요.');
    if(m.materialState!=='ready')note(host,m.materialState==='failed'?'일부 자료 조회 실패 · 아래 자료함에서 다시 조회해주세요.':'안내자료 확인 중…',m.materialState==='failed');
    list(host,m.materials.slice(0,1),item=>{const row=make('article','home-insight-item');row.append(make('small','',item.kindLabel+' · '+(item.sentAt?stamp(item.sentAt):'게시일 미기록')),make('b','',item.topic||item.title||'병원 안내자료'));if(!item.topic)note(row,'질환·시술명은 자료 원문에서 확인해주세요.');row.append(button('안내자료 보기',guard(m,()=>window.carestepOpenHomeMaterial?.(m.pid,item.key))));return row;},'안내자료');
    if(m.materialState==='ready'&&!m.materials.length)note(host,'연결된 질환·퇴원·수술 안내자료가 없습니다.');
    if(m.followupState!=='ready')note(host,m.followupState==='failed'?'회복관리 안내 조회 실패 · 병원 안내·상담에서 다시 조회해주세요.':'회복관리 안내 확인 중…',m.followupState==='failed');
    if(m.followups.length){const row=make('div','home-insight-medication');row.append(make('b','','병원 안내·상담'),make('span','','받은 안내 '+m.followups.length+'건'),button('병원 안내·상담 전체 보기',guard(m,()=>{if($('homeCareAll'))$('homeCareAll').open=true;window.carestepHomeNavigation?.go('hospital',{target:'homeCareAll'});})));host.append(row);}
    if(m.followupState==='ready'&&!m.followups.length)note(host,'받은 병원 회복관리 안내가 없습니다.');
    host.append(button('자료함 전체 보기',guard(m,()=>window.carestepOpenHomeMaterials?.(m.pid))));
  }

  function renderRecent(m) {
    const container=$('homeRecentSummary'),host=container.querySelector('div');const heading=container.querySelector('summary');heading.replaceChildren(make('span','home-insight-summary-title',m.patient.name+' · 최근 건강기록 요약'),make('span','home-insight-summary-preview',recentHeadline(m)));
    const filters=make('div','home-insight-period');filters.setAttribute('role','group');filters.setAttribute('aria-label','건강기록 요약 기간');
    for(const days of [7,30]){const b=button('최근 '+days+'일',guard(m,()=>{period=days;signature='';refresh();$('homeRecentSummary').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});}));b.setAttribute('aria-pressed',String(period===days));filters.append(b);}host.append(filters);
    const r=m.recent;note(host,r.from+' ~ '+r.to+' · 한국시간 기준');
    if(m.loading || m.failed){note(host,m.failed?'건강기록 조회 실패 · 기록 유무를 확인하지 못했습니다.':'건강기록을 확인하고 있습니다…',m.failed);host.append(button('건강기록 다시 조회',records(m)));return;}
    if(r.partial)note(host,'최근 조회된 최대 500건 안에서만 집계했습니다. 전체 기록 수·미기록 일수는 확정할 수 없습니다.',true);
    const tiles=make('div','home-insight-tiles');
    for(const [label,value] of [['건강기록',r.items.length+'건'],['홈 기록 작성',r.recordedDays+'일'],['홈 기록 미기록',r.partial?'확인 불가':r.missingDays+'일']]){const tile=make('div');tile.append(make('span','',label),make('strong','',value));tiles.append(tile);}host.append(tiles);
    note(host,'미기록은 상태가 좋거나 증상이 없다는 뜻이 아닙니다. 같은 날 여러 번 기록해도 작성일은 1일로 셉니다.');
    host.append(make('h4','','기간 내 체중 변화'));
    if(!r.last)note(host,'이 기간의 체중 기록이 없습니다.');
    else {host.append(make('p','home-insight-weight',r.last.value+' kg · '+r.last.date));note(host,r.difference===null?'측정일 1일 · 비교할 이전 측정일이 없습니다.':r.first.date+' '+r.first.value+' kg → '+r.last.date+' '+r.last.value+' kg · '+(r.difference>0?'+':'')+r.difference+' kg');note(host,'병원·보호자 측정 기록 · 같은 날짜는 마지막 측정값 기준');}
    const labels={appetite:'식욕',water:'음수',vomiting:'구토',diarrhea:'설사',medication:'자유 투약'};
    host.append(make('h4','','보호자가 남긴 홈 기록'));
    const counts=make('ul','home-insight-counts');for(const c of r.counts)counts.append(make('li','',labels[c.type]+' · '+(c.count?c.count+'건':'미기록')));host.append(counts);
    note(host,'기록 건수이며 증상의 발생 횟수나 복약 이행률은 아닙니다. 자유 투약 기록과 복약 일정의 완료 체크는 별도입니다.');
    host.append(make('h4','','오늘 복약 완료 기록'));
    note(host,!m.medicationReady?'복약 조회 필요 · 완료 여부 확인 불가':m.doses.length?'완료로 기록 '+m.doses.filter(d=>d.taken).length+'건 / 오늘 예정 '+m.doses.length+'건':'오늘 등록된 복약 일정이 없습니다.');
    note(host,'마지막 건강기록일 · '+(r.latestDate||'없음')+' / HOME 조회 · '+stamp(m.checkedAt));
    host.append(button('원본 건강기록 보기',records(m)));
  }
  async function openRecent(m) {
    const i=inputs(),auth=i.base.token;await window.carestepOpenHomeHealth?.(m.pid);
    const next=inputs();if(next.base.token!==auth||next.care.patientId!==m.pid||next.base.view!=='patientView')return;
    refresh();const target=$('homeRecentSummary');if(!target||target.hidden)return;target.open=true;target.scrollIntoView({block:'start',behavior:'auto'});target.querySelector('summary')?.focus({preventScroll:true});
  }
  function refresh() {
    if(!mount())return;
    const i=inputs(),m=insightModel(i.base,i.care,i.shared,period);
    if(!m){clear();return;}
    const nextScope=i.base.token+'|'+m.pid;
    if(scope!==nextScope){scope=nextScope;period=7;signature='';$('homeRecentSummary').open=false;return refresh();}
    current=m;
    const key=JSON.stringify([m,period,navigator.onLine]);if(signature===key)return;signature=key;
    const focus=document.activeElement,focusHost=focus?.closest?.('#homeInsightEntry,#homePublicOverview,#homeLinkedGuides,#homeRecentSummary'),focusText=focusHost?focus.textContent:null;
    const open=new Set([...document.querySelectorAll('[data-insight-expand][open]')].map(n=>n.dataset.insightExpand));
    for(const id of ['homeInsightEntry','homePublicOverview','homeLinkedGuides']){$(id).hidden=false;$(id).replaceChildren();}
    $('homeRecentSummary').hidden=false;$('homeRecentSummary').querySelector('div').replaceChildren();
    const entry=$('homeInsightEntry');entry.append(make('h3','','공개 정보 한눈에'));
    const actions=make('div','home-insight-entry-actions');actions.append(button('진료정보·관리 안내',guard(m,()=>window.carestepHomeNavigation?.go('hospital',{target:'homePublicOverview'}))),button('최근 건강기록 요약',guard(m,()=>openRecent(m))));entry.append(actions);
    renderOverview(m);renderGuides(m);renderRecent(m);
    for(const n of document.querySelectorAll('[data-insight-expand]'))n.open=open.has(n.dataset.insightExpand);
    if(focusHost&&focusText)[...($(focusHost.id)?.querySelectorAll('button,summary')||[])].find(n=>n.textContent===focusText)?.focus({preventScroll:true});
    if(navigator.onLine===false)for(const id of ['homePublicOverview','homeLinkedGuides'])note($(id),'오프라인 · 이전에 조회한 정보입니다. 연결 후 다시 확인해주세요.',true);
  }
  window.carestepHomeInsights={refresh,clear};
  window.addEventListener('carestep-home-patient',refresh);
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
