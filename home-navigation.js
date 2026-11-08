/* CARESTEP HOME: compact overview and patient-scoped navigation. Read-only refresh coordination; no record writes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const routes = {home:'홈',health:'건강기록',schedule:'관리 일정',hospital:'병원 안내',settings:'설정'};
  const positions = new Map();
  let routeRefreshFlight=null;
  const scheduleRetryFlights=new Map();
  let scheduleTab='medication',pickerExpanded=false;
  const schedulePositions=new Map();
  let route = 'home', view = '', patientId = '', account = '', auth = '', healthReturn = 'home', settingsReturn = 'home';
  let mounted = false, routing = false, arranging = false, positionRevision = 0;
  const query = new URLSearchParams(location.search);
  function initialHomeRoute(params) {
    if (params.get('customReminder') || params.get('medication') || params.get('care') === 'medications') return 'schedule';
    if (params.get('care') === 'materials' || params.get('followup')) return 'hospital';
    return 'home';
  }
  function nextHomeCare(medication, custom, pid) {
    const valid=[medication,custom].map(x=>x?.patientId===pid?x:null),targets=['homeCarePatients','homeCustomReminders'];
    const next=valid.flatMap((x,i)=>x?.state==='ready'&&x.next?[{...x.next,source:i===0?'병원 복약':'직접 만든 알림',target:targets[i]}]:[]).sort((a,b)=>a.time.localeCompare(b.time))[0];
    const uncertain=valid.findIndex(x=>!x||x.state!=='ready'),overdue=valid.reduce((sum,x)=>sum+(x?.state==='ready'?Number(x.overdue)||0:0),0);
    const overdueTarget=targets[valid.findIndex(x=>x?.state==='ready'&&x.overdue>0)]||targets[0];
    const failed=valid.findIndex(x=>['failed','other-date'].includes(x?.state));
    const note=failed>=0?'일부 일정 조회 실패 · 다시 시도':uncertain>=0?'다른 일정 불러오는 중':overdue?'지난 일정 미기록 '+overdue+'건 · 기록 확인':'';
    if(next)return {text:'다음 '+next.time+' · '+(next.label||next.title||next.source),time:next.time,label:next.label||next.title||next.source,source:next.source,target:next.target,occurrence:next,kind:'next',note,noteAction:failed>=0?'retry':uncertain>=0?'loading':'open',noteTarget:failed>=0?targets[failed]:uncertain>=0?targets[uncertain]:overdueTarget};
    if(failed>=0)return {text:'일정을 불러오지 못했습니다 · 다시 시도',target:targets[failed],kind:'failed',label:'일정을 불러오지 못했어요',source:'다시 시도'};
    if(uncertain>=0)return {text:'오늘 일정을 불러오고 있습니다',target:targets[uncertain],kind:'loading',label:'일정을 불러오는 중이에요',source:'잠시 기다려주세요'};
    if(valid.some(x=>x.count>0))return {text:'지난 일정의 실제 수행 여부를 확인해주세요',target:overdueTarget,kind:'overdue',label:'지난 일정 기록 확인',source:'실제 관리 여부를 확인해주세요'};
    return {text:'오늘 남은 관리가 없습니다 · 전체 일정 보기',target:targets[0],kind:'done',label:'오늘 남은 관리가 없어요',source:'전체 일정 보기'};
  }
  function preventiveHomeRows(summary, pid) {
    const valid = summary?.patientId===pid?summary:null;
    return [['heartworm','심장사상충'],['vaccination','예방접종']].map(([type,label])=>{
      const items=valid?.items.find(x=>x.type===type)?.items||[];
      const item=[...items].sort((a,b)=>a.days-b.days)[0];
      return {type,label,item,count:items.length,state:valid?.state||'loading'};
    });
  }
  function snapshot() {
    const base=window.carestepHomeSnapshot?.()||{},care=window.carestepHomeCare?.context?.()||{};
    return {base,care,allowed:!!base.token&&!!base.home&&!base.home.consentRequired};
  }
  function text(node,value) { if(node&&node.textContent!==value) node.textContent=value; }
  function move(node,parent) { if(node&&parent&&node.parentElement!==parent) parent.append(node); }
  function make(tag,cls,content) { const node=document.createElement(tag);if(cls)node.className=cls;if(content)node.textContent=content;return node; }
  function key(name=route,pid=patientId) { return name+'|'+pid; }
  function remember() { if(['dashboardView','patientView'].includes(view)) positions.set(key(),window.scrollY||0); }
  function restorePosition(top,focus) {
    const revision=++positionRevision,expected=key();
    requestAnimationFrame(()=>{
      if(revision!==positionRevision||expected!==key()||!['dashboardView','patientView'].includes(view))return;
      if(focus){const target=typeof focus==='string'?$(focus):focus;if(target&&!target.closest('[hidden]')){for(let n=target.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;target.setAttribute('tabindex','-1');target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});return;}}
      window.scrollTo({top:Math.max(0,top||0),behavior:'auto'});
    });
  }
  function mount() {
    if(mounted)return true;
    const dashboard=$('dashboardView'),care=$('homeCareToday'),main=dashboard?.parentElement;
    if(!dashboard||!care||!main)return false;
    const chrome=make('section','home-navigation-chrome');chrome.id='homeNavigationChrome';chrome.hidden=true;
    const toolbar=make('div','home-navigation-toolbar');
    const heading=make('h1','','우리 아이 건강관리');heading.id='homeNavigationTitle';
    const actions=make('div','home-navigation-toolbar-actions');
    const settings=make('button','home-secondary','설정');settings.type='button';settings.id='homeNavigationSettingsButton';settings.onclick=()=>go('settings');
    actions.append(settings);move($('homeCareRefresh'),actions);toolbar.append(heading,actions);chrome.append(toolbar);dashboard.before(chrome);
    actions.id='homeNavigationActions';actions.hidden=true;move(actions,document.querySelector('.home-header'));
    document.querySelector('.home-brand')?.addEventListener('click',event=>{if(snapshot().allowed){event.preventDefault();go('home');}});
    const refreshStatus=make('p','home-help');refreshStatus.id='homeNavigationRefreshStatus';refreshStatus.setAttribute('role','status');refreshStatus.hidden=true;chrome.append(refreshStatus);
    const picker=care.querySelector('.home-care-picker');move(picker,chrome);const selectedPet=make('button','home-selected-pet');selectedPet.id='homeSelectedPet';selectedPet.type='button';selectedPet.hidden=true;selectedPet.onclick=()=>{pickerExpanded=!pickerExpanded;refresh();if(pickerExpanded)picker?.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});};chrome.insertBefore(selectedPet,picker);move($('homeCareFreshness'),chrome);
    const warning=make('button','home-navigation-warning');warning.id='homeNavigationWarning';warning.type='button';warning.hidden=true;warning.onclick=()=>{if(warning.dataset.custom==='true'){const detail=$('homeNavigationReminderSettings')?.querySelector('details');if(detail)detail.open=true;go('settings',{target:'homeNavigationReminderSettings'});}else window.carestepHomeCare?.openPushSettings?.();};chrome.append(warning);
    for(const name of ['home','schedule','hospital','settings']){
      const panel=make('section','home-navigation-panel');panel.id='homeNavigation-'+name;panel.dataset.homePage=name;panel.hidden=name!=='home';panel.setAttribute('aria-label',routes[name]);
      if(name!=='home'){const title=make('h2','home-navigation-page-title',name==='hospital'?'병원 안내':routes[name]);panel.append(title);}
      care.append(panel);
    }
    const today=make('section','home-navigation-daily');today.id='homeNavigationDaily';
    today.append(make('h3','','오늘 관리'));const next=make('button','home-navigation-next');next.id='homeNavigationNext';next.type='button';next.onclick=()=>openNextCare();next.append(make('span','home-next-kicker'),make('strong','home-next-time'),make('span','home-next-label'),make('span','home-next-source'));today.append(next);const note=make('button','home-next-note');note.id='homeNavigationNextNote';note.type='button';note.hidden=true;note.onclick=()=>note.dataset.action==='retry'?retrySchedule(note.dataset.target):go('schedule',{target:note.dataset.target});today.append(note);
    $('homeNavigation-home').append(today);
    const prevention=make('section','home-navigation-prevention');prevention.id='homeNavigationPrevention';prevention.append(make('h3','','예방 예정'));
    for(const [type,label] of [['heartworm','심장사상충'],['vaccination','예방접종']]){
      const b=make('button','home-navigation-preventive-row');b.type='button';b.dataset.preventiveType=type;
      b.append(make('strong','',label),make('span','home-navigation-preventive-date'),make('span','home-navigation-dday'));
      b.onclick=()=>go('schedule',{target:b.dataset.target||'homeCareUpcoming'});prevention.append(b);
    }
    $('homeNavigation-home').append(prevention);
    const shortcuts=make('nav','home-schedule-shortcuts');shortcuts.setAttribute('aria-label','관리 일정 종류');
    for(const [label,id] of [['복약','medication'],['예방·재진','prevention'],['직접 만든 알림','custom']]){const b=make('button','home-secondary',label);b.type='button';b.dataset.scheduleTab=id;b.setAttribute('role','tab');b.onclick=()=>selectScheduleTab(id);shortcuts.append(b);}shortcuts.setAttribute('role','tablist');$('homeNavigation-schedule').append(shortcuts);
    const hospitalActions=make('nav','home-hospital-actions');hospitalActions.id='homeHospitalActions';hospitalActions.setAttribute('aria-label','병원 안내 바로가기');
    const materials=make('button','home-secondary','안내자료');materials.type='button';materials.onclick=()=>{if($('homeHospitalMaterials'))$('homeHospitalMaterials').open=true;go('hospital',{target:'homeHospitalMaterials'});};
    const contact=make('button','home-secondary','병원 전화');contact.type='button';contact.id='homeHospitalContactButton';contact.onclick=()=>showHospitalContact();hospitalActions.append(materials,contact);$('homeNavigation-hospital').append(hospitalActions);
    const contactPanel=make('section','home-insight-card');contactPanel.id='homeHospitalContact';contactPanel.hidden=true;hospitalActions.after(contactPanel);
    const careLink=make('button','home-secondary','병원 회복관리·상담 일정 보기');careLink.type='button';careLink.id='homeNavigationFollowupLink';careLink.onclick=()=>window.carestepOpenHomeFollowups?.(patientId);$('homeNavigation-schedule').append(careLink);
    window.CarestepHomeDisplay?.mount($('homeNavigation-settings'));
    const reminderSettings=make('div');reminderSettings.id='homeNavigationReminderSettings';$('homeNavigation-settings').append(reminderSettings);
    const back=make('button','home-secondary','이전 화면으로');back.type='button';back.onclick=()=>backFromSettings();$('homeNavigation-settings').prepend(back);
    const nav=make('nav','home-bottom-navigation');nav.id='homeBottomNavigation';nav.hidden=true;nav.setAttribute('aria-label','HOME 주요 메뉴');
    const symbols={home:'<path d="M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8"/>',health:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 12h4l2-4 3 8 2-4h5"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 5 3 3 7-5"/>',hospital:'<path d="M5 21V6h14v15M3 21h18M9 21v-5h6v5M12 8v5m-2.5-2.5h5"/>'};
    for(const name of ['home','health','schedule','hospital']){
      const button=make('button');button.type='button';button.dataset.homeRoute=name;const icon=make('span','home-bottom-icon');icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+symbols[name]+'</svg>';icon.setAttribute('aria-hidden','true');button.append(icon,make('span','',routes[name]));button.onclick=()=>go(name);nav.append(button);
    }
    main.after(nav);
    const compact=make('button','home-current-patient');compact.id='homeCurrentPatient';compact.type='button';compact.hidden=true;compact.onclick=()=>{const picker=$('homeCarePatientCards');picker?.scrollIntoView({block:'center',behavior:'auto'});picker?.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});};document.body.append(compact);
    let scrollQueued=false;const updateCompact=()=>{scrollQueued=false;const active=!$('homeNavigationChrome').hidden,picker=$('homeCarePatientCards');compact.hidden=route!=='home'||!active||!patientId||!picker||picker.getBoundingClientRect().bottom>0||document.body.classList.contains('care-keyboard-open');};
    window.addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateCompact);}},{passive:true});window.addEventListener('resize',updateCompact);window.addEventListener('carestep-home-patient',updateCompact);
    mounted=true;window.carestepHomeNavigation.mounted=true;
    arrange();
    return true;
  }
  function arrange() {
    if(!mounted||arranging)return;arranging=true;
    try {
      const home=$('homeNavigation-home'),schedule=$('homeNavigation-schedule'),hospital=$('homeNavigation-hospital'),settings=$('homeNavigation-settings');
      // Move live nodes, preserving their handlers, filters, details and drafts.
      let healthCard=$('homeHealthOverview');if(!healthCard){healthCard=make('section','home-health-overview');healthCard.id='homeHealthOverview';home.prepend(healthCard);}move($('homeCareHealth'),healthCard);move($('homeInsightEntry'),healthCard);
      const today=$('homeNavigationDaily');move($('homeCareRemaining'),today);
      move($('homeCareHospitalNotice'),home);move($('homeCareFollowups'),home);
      for(const id of ['homeCareNext','homeCareStatus','homeCareFamilyUpdate','homeCarePatients','homeCareDue','homeCareUpcoming','homeCustomReminders'])move($(id),schedule);
      if($('homeNavigationFollowupLink')?.previousElementSibling!==$('homeCustomReminders'))schedule.append($('homeNavigationFollowupLink'));
      let shelf=$('homeHospitalMaterials');if(!shelf){shelf=make('details','home-hospital-library');shelf.id='homeHospitalMaterials';shelf.append(make('summary','','받은 안내자료'));shelf.open=true;hospital.append(shelf);}
      move($('r61-home-materials'),shelf);move($('homeCareAll'),hospital);
      const all=$('homeCareAll');if(all){all.classList.add('home-hospital-library');text(all.querySelector(':scope > summary'),'경과 전달·상담');}
      text($('homeFollowupSection')?.querySelector('h2'),'경과 전달·상담');
      move($('homeCareSettings'),settings);organizeNotifications();
      move($('homeCareConnections'),settings);
      move($('homeSecurityPanel'),settings);
      const connections=$('homeCareConnections');
      for(const n of [...($('dashboardView')?.children||[])])if(connections&&(n.id==='homeConnections'||n.classList.contains('home-clinic-group')||n.classList.contains('connection-ready')||n.classList.contains('stage-note')))move(n,connections);
      const accountHead=$('logoutButton')?.closest('.dashboard-head');
      move(accountHead,snapshot().base.home?.consentRequired?$('dashboardView'):($('homeSecurityPanel')||settings));if(accountHead?.parentElement===$('homeSecurityPanel')&&$('homeSecurityPanel').firstElementChild!==accountHead)$('homeSecurityPanel').prepend(accountHead);
      if(snapshot().base.home?.consentRequired&&accountHead&&$('dashboardView').firstElementChild!==accountHead)$('dashboardView').prepend(accountHead);
      const custom=$('homeCustomReminders')?.querySelector('.home-custom-device');
      if(custom)move(custom,$('homeNavigationReminderSettings'));
      move($('homeIntakeHospital'),$('homeHospitalActions'));text($('homeIntakeHospital'),'방문 전 문진');
      if(hospital.firstElementChild!==$('homeHospitalActions'))hospital.prepend($('homeHospitalActions'));
      refresh();
    } finally { arranging=false; }
  }
  function organizeNotifications() {
    const host=$('homeCareSettings');if(!host)return;
    host.open=true;text(host.querySelector(':scope > summary'),'알림 설정');
    let detail=$('homeNotificationDetails');
    if(!detail){detail=make('details','home-notification-details');detail.id='homeNotificationDetails';detail.append(make('summary','','복약·직접 만든 알림·수신 내역'));host.append(detail);}
    move($('homePushCard'),host);
    if($('homePushCard')&&host.children[1]!==$('homePushCard'))host.querySelector(':scope > summary').after($('homePushCard'));
    move(host.querySelector('.home-care-push'),detail);
    move($('homeCareRecent')?.closest('details'),detail);
    move($('homeNavigationReminderSettings'),detail);
    const guide=$('homeCareOnboarding');if(guide&&!guide.dataset.compactHelp){guide.open=false;guide.dataset.compactHelp='true';}
    move(guide,$('homeNavigation-settings'));
  }
  function showHospitalContact() {
    const {base,care}=snapshot();if(!base.token||!care.patientId||base.home?.consentRequired)return;
    const shared=window.carestepHomeInsightData?.(),host=$('homeHospitalContact'),connection=base.home.connections?.find(c=>c.patients?.some(p=>p.id===care.patientId));
    host.replaceChildren(make('h3','',connection?.clinicName||'연결 병원'));
    const phone=window.carestepHomeClinicContact?.(connection);
    if(phone?.dial){const call=make('a','home-primary','전화하기 · '+phone.label);call.href='tel:'+phone.dial;host.append(call);}
    else{host.append(make('p','',phone?.state==='missing'?'병원 전화번호가 아직 등록되지 않았어요. 받은 안내자료의 연락처를 확인해주세요.':'병원 전화번호를 확인하지 못했어요. 다시 조회해주세요.'));if(phone?.state!=='missing'){const retry=make('button','home-secondary','전화번호 다시 조회');retry.type='button';retry.onclick=async()=>{retry.disabled=true;await window.carestepRefreshHomeAccess?.(true);if(care.patientId===snapshot().care.patientId&&base.token===snapshot().base.token)showHospitalContact();};host.append(retry);}}
    if(shared?.token===base.token&&shared.followups?.some(f=>f.patientId===care.patientId&&f.status!=='canceled')){const consult=make('button','home-secondary','경과 전달·상담 열기');consult.type='button';consult.onclick=()=>window.carestepHomeContact?.(care.patientId);host.append(consult);}
    const open=make('button','home-secondary','받은 안내자료 확인');open.type='button';open.onclick=()=>go('hospital',{target:'homeHospitalMaterials'});
    const close=make('button','home-secondary','닫기');close.type='button';close.onclick=()=>{host.hidden=true;$('homeHospitalContactButton').focus();};host.append(open,close);host.hidden=false;restorePosition(window.scrollY,host);
  }
  function refresh() {
    if(!mounted)return;
    window.carestepHomeInsights?.refresh();move($('homeInsightEntry'),$('homeHealthOverview'));
    const {base,care,allowed}=snapshot();
    const active=allowed&&['dashboardView','patientView'].includes(view);
    $('homeNavigationChrome').hidden=!active;$('homeBottomNavigation').hidden=!active;
    $('homeNavigationActions').hidden=!active;$('homeNavigationChrome').classList.toggle('is-home',route==='home');
    document.body.classList.toggle('home-navigation-active',active);
    $('homeCareToday').hidden=!allowed;
    for(const panel of document.querySelectorAll('[data-home-page]'))panel.hidden=panel.dataset.homePage!==route;
    for(const b of $('homeBottomNavigation').querySelectorAll('button')){
      if(b.dataset.homeRoute===route)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
      b.disabled=!care.patientId&&['health','schedule'].includes(b.dataset.homeRoute);
    }
    text($('homeNavigationTitle'),route==='home'?'우리 아이 건강관리':route==='hospital'?'병원 안내':routes[route]);
    $('homeNavigationSettingsButton').setAttribute('aria-pressed',String(route==='settings'));
    if($('homeCareRefresh')){$('homeCareRefresh').hidden=route==='health';$('homeCareRefresh').setAttribute('aria-label',routes[route]+' 새로고침');const b=$('homeCareRefresh');if(b.dataset.refreshScope&&b.dataset.refreshScope!==refreshScope()){b.disabled=false;b.textContent='새로고침';delete b.dataset.refreshScope;}}
    const refreshStatus=$('homeNavigationRefreshStatus');if(refreshStatus&&refreshStatus.dataset.scope!==refreshScope())refreshStatus.hidden=true;
    const selected=(base.home?.connections||[]).flatMap(c=>c.patients||[]).find(p=>p.id===care.patientId),compact=$('homeCurrentPatient');text(compact,selected?(selected.name||'환자')+' · '+(selected.species==='cat'?'고양이':selected.species==='dog'?'강아지':'반려동물')+' · 환자 변경':'');if(!active||!selected||route!=='home')compact.hidden=true;
    const picker=$('homeNavigationChrome').querySelector('.home-care-picker');if(picker)picker.hidden=route==='settings'||(['schedule','hospital'].includes(route)&&!pickerExpanded);const selectedPet=$('homeSelectedPet');selectedPet.hidden=!active||!selected||!['schedule','hospital'].includes(route);text(selectedPet,selected?(selected.name||'반려동물')+' · '+(selected.species==='cat'?'고양이':'강아지')+' · '+(pickerExpanded?'선택 닫기':'반려동물 변경'):'');selectedPet.setAttribute('aria-expanded',String(pickerExpanded));paintScheduleTabs();
    if($('homeCareFreshness'))$('homeCareFreshness').hidden=route==='settings';
    $('homeNavigationSettingsButton').hidden=route==='settings';
    if(!allowed)return;
    const custom=window.carestepHomeReminderSummary?.();
    const next=nextHomeCare(care.medicationSummary,custom,care.patientId),nextButton=$('homeNavigationNext');nextButton.dataset.target=next.target;nextButton.dataset.state=next.kind;text(nextButton.querySelector('.home-next-kicker'),next.kind==='next'?'다음 예정':next.kind==='done'?'✓ 확인 완료':next.kind==='loading'?'불러오는 중':next.kind==='failed'?'연결 확인':'지난 일정');text(nextButton.querySelector('.home-next-time'),next.time||'');text(nextButton.querySelector('.home-next-label'),next.label);text(nextButton.querySelector('.home-next-source'),next.source+' ›');nextButton.setAttribute('aria-label',next.text);nextButton.disabled=next.kind==='loading'||scheduleRetryFlights.has(scheduleRetryScope(next.target));const note=$('homeNavigationNextNote');text(note,next.note||'');note.hidden=!next.note;note.dataset.target=next.noteTarget||next.target;note.dataset.action=next.noteAction||'open';note.disabled=next.noteAction==='loading'||scheduleRetryFlights.has(scheduleRetryScope(note.dataset.target));
    $('homeNavigationDaily').hidden=!care.patientId;
    for(const row of preventiveHomeRows(care.preventiveSummary,care.patientId)){
      const b=$('homeNavigationPrevention').querySelector('[data-preventive-type="'+row.type+'"]');
      text(b.querySelector('strong'),row.label+(row.count>1?' · '+row.count+'종':''));
      text(b.querySelector('.home-navigation-preventive-date'),row.state==='failed'?'조회 실패 · 다시 확인':row.state==='loading'?'예정일 확인 중':row.item?.nextDueDate?.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>Number(y)+'년 '+Number(m)+'월 '+Number(d)+'일')||'예정일 미등록');
      text(b.querySelector('.home-navigation-dday'),row.state==='failed'?'다시 시도':row.state==='loading'?'…':row.item?.countdown||'');
      b.dataset.target=row.item?.days<=0?'homeCareDue':'homeCareUpcoming';b.classList.toggle('is-due',row.state==='ready'&&row.item?.days<=0);
    }
    $('homeNavigationPrevention').hidden=!care.patientId;
    const kind=base.push?.kind||care.push?.kind;
    const warning=kind&&kind!=='active'&&kind!=='loading'?({inactive:'이 기기 알림 켜기 ›',blocked:'브라우저에서 알림 허용하기 ›',unsupported:'이 기기 알림 설치 안내 ›',unavailable:'알림 연결 다시 확인 ›'}[kind]||'알림 설정 확인 ›'):kind==='active'&&custom?.device===false?'이 기기의 직접 만든 알림이 꺼져 있어요 ›':'';
    text($('homeNavigationWarning'),warning);$('homeNavigationWarning').hidden=!warning||route!=='home';text($('homeNavigationSettingsButton'),warning&&route!=='home'?'설정 · 알림 확인':'설정');$('homeNavigationWarning').dataset.custom=String(kind==='active'&&custom?.device===false);
  }
  function syncPatient() {
    if(!mount())return;
    const {base,care}=snapshot(),changedAuth=auth!==base.token||account!==base.home?.user?.id;
    if(changedAuth){schedulePositions.clear();scheduleTab=query.get('customReminder')?'custom':'medication';pickerExpanded=false;positions.clear();positionRevision++;route=initialHomeRoute(query);healthReturn='home';auth=base.token||'';account=base.home?.user?.id||'';patientId='';}
    const next=care.patientId||'';
    if(changedAuth||next!==patientId)for(const id of ['homeHospitalMaterials','homeCareAll'])if($(id))$(id).open=id==='homeHospitalMaterials';
    if(next!==patientId){pickerExpanded=false;
      if($('homeHospitalContact')){$('homeHospitalContact').hidden=true;$('homeHospitalContact').replaceChildren();}
      if(!changedAuth)remember();patientId=next;
      if(!routing&&view==='patientView'&&route==='health'&&next){void window.carestepOpenHomeHealth?.(next);}
      else if(!routing&&!changedAuth)restorePosition(positions.get(key())||0);
    }
    refresh();
  }
  function onView(id,pid) {
    if(!mount())return;
    const previous=view;view=id;
    if(id==='patientView'){
      if(route!=='health')healthReturn=route;
      route='health';
      routing=true;try{if(pid)window.carestepHomeCare?.selectPatient?.(pid);syncPatient();}finally{routing=false;}
    }else{
      syncPatient();
      if(id==='dashboardView'&&previous==='patientView'&&route==='health')route=healthReturn==='health'?'home':healthReturn;
      if(!['dashboardView','patientView'].includes(id)){positionRevision++;}
    }
    refresh();
  }
  function go(name,{target,scroll=true}={}) {
    if(!routes[name]||!mount()||!snapshot().allowed)return false;
    syncPatient();if(name===route&&!target&&['dashboardView','patientView'].includes(view))return true;remember();
    if(name==='health'&&!patientId)return false;
    if(name==='settings'&&route!=='settings')settingsReturn=route;
    if(name==='health'&&route!=='health'&&route!=='settings')healthReturn=route;
    route=name;routing=true;pickerExpanded=false;if(name==='schedule'&&target){const node=typeof target==='string'?$(target):target;const id=typeof target==='string'?target:node?.closest('[id]')?.id;scheduleTab=node?.closest('#homeCustomReminders')||id==='homeCustomReminders'?'custom':['homeCareDue','homeCareUpcoming','homeNavigationFollowupLink'].includes(id)?'prevention':'medication';}
    try {
      if(name==='health'){void window.carestepOpenHomeHealth?.(patientId);}
      else window.carestepShowHomeDashboard?.();
    } finally {routing=false;}
    refresh();
    if(scroll)restorePosition(target?0:positions.get(key())||0,target);
    return true;
  }
  function openNextCare(){
    const {care}=snapshot(),next=nextHomeCare(care.medicationSummary,window.carestepHomeReminderSummary?.(),care.patientId);if(next.kind==='failed'){void retrySchedule(next.target);return;}const item=next.occurrence,scope=$(next.target);
    const match=item&&(next.target==='homeCustomReminders'?[...(scope?.querySelectorAll('[data-custom-occurrence]')||[])].find(n=>n.dataset.customOccurrence===item.reminderId+'|'+item.date+'|'+item.time):[...(scope?.querySelectorAll('[data-dose-time]')||[])].find(n=>n.dataset.planId===item.planId&&n.dataset.doseTime===item.time&&n.dataset.doseDate===item.date));
    if(match)for(let n=match.parentElement;n&&n!==scope;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
    go('schedule',{target:match||next.target});
  }
  function paintScheduleTabs(){
    const groups={medication:['homeCareNext','homeCareStatus','homeCareFamilyUpdate','homeCarePatients'],prevention:['homeCareDue','homeCareUpcoming','homeNavigationFollowupLink'],custom:['homeCustomReminders']};
    for(const [name,ids] of Object.entries(groups))for(const id of ids){const node=$(id);if(node)node.classList.toggle('home-schedule-inactive',name!==scheduleTab);}
    for(const button of document.querySelectorAll('[data-schedule-tab]'))button.setAttribute('aria-selected',String(button.dataset.scheduleTab===scheduleTab));
  }
  function selectScheduleTab(name){if(!['medication','prevention','custom'].includes(name))return;schedulePositions.set(patientId+'|'+scheduleTab,window.scrollY);scheduleTab=name;paintScheduleTabs();restorePosition(schedulePositions.get(patientId+'|'+name)||0);}
  function refreshScope(){const s=snapshot();return JSON.stringify([s.base.token,s.base.home?.user?.id,s.care.patientId,route]);}
  function refreshBusy(){return routeRefreshFlight?.scope===refreshScope();}
  async function refreshCurrent(retryJobs){
    const initial=snapshot();if(!initial.allowed)return false;
    const scope=refreshScope();if(routeRefreshFlight?.scope===scope)return routeRefreshFlight.promise;
    const selectedRoute=route,status=$('homeNavigationRefreshStatus'),button=$('homeCareRefresh');
    const jobs=Array.isArray(retryJobs)?retryJobs:selectedRoute==='hospital'?['connections','materials','followups']:selectedRoute==='settings'?['connections','push','device']:selectedRoute==='schedule'?['care','reminders']:['care','reminders'];
    const actions={
      connections:()=>window.carestepRefreshHomeAccess?.(true),
      care:()=>window.carestepHomeCare?.refresh?.(),
      medication:()=>window.carestepHomeCare?.refreshMedication?.(),
      timeline:()=>window.carestepHomeCare?.refreshTimeline?.(),
      reminders:()=>window.carestepRefreshHomeReminders?.(),
      materials:()=>window.carestepRefreshHomeMaterials?.(),
      followups:()=>window.carestepRefreshHomeFollowups?.(),
      push:()=>window.carestepRefreshHomePushStatus?.(),
      device:()=>window.carestepRefreshHomeReminderDevice?.()
    };
    const flight={scope,promise:null};routeRefreshFlight=flight;
    if(button){button.disabled=true;button.textContent='확인 중…';button.dataset.refreshScope=scope;}
    if(status){status.hidden=false;status.textContent=routes[selectedRoute]+' 화면을 새로 확인하고 있습니다…';status.dataset.scope=scope;}
    flight.promise=(async()=>{try{
      const results=await Promise.allSettled(jobs.map(job=>Promise.resolve().then(actions[job])));
      if(refreshScope()!==scope||routeRefreshFlight!==flight)return false;
      const failed=new Set(),care=window.carestepHomeCare?.context?.(),insights=window.carestepHomeInsightData?.();
      jobs.forEach((job,i)=>{if(job!=='care'&&(results[i].status==='rejected'||results[i].value===false))failed.add(job);});
      if(jobs.includes('care')){if(care?.publicGroup?.medicationFailed)failed.add('medication');if(care?.publicGroup?.timelineFailed)failed.add('timeline');if(insights?.followupState==='failed')failed.add('followups');if(results[jobs.indexOf('care')].status==='rejected'&&!failed.size)failed.add('care');}
      if(jobs.includes('reminders')&&window.carestepHomeReminderSummary?.().state==='failed')failed.add('reminders');
      if(jobs.includes('materials')&&insights?.materialState==='failed')failed.add('materials');
      const labels={connections:'병원 연결',care:'건강·복약',medication:'복약',timeline:'건강기록',reminders:'직접 만든 알림',materials:'안내자료',followups:'경과 안내',push:'알림 설정',device:'알림 기기'};
      if(status){status.textContent=failed.size?[...failed].map(x=>labels[x]).join(' · ')+' 조회 실패 · 나머지 항목은 확인했습니다.':'최신 내용을 확인했습니다.';
        if(failed.size){const retry=document.createElement('button');retry.type='button';retry.className='home-secondary';retry.textContent='실패한 항목 다시 조회';retry.onclick=()=>{if(refreshScope()===scope){retry.disabled=true;void refreshCurrent([...failed]);}};status.append(' ',retry);}}
      return failed.size===0;
    }finally{if(routeRefreshFlight===flight)routeRefreshFlight=null;if(refreshScope()===scope&&button){button.disabled=false;button.textContent='새로고침';delete button.dataset.refreshScope;}}})();
    return flight.promise;
  }
  function scheduleRetryScope(target){const s=snapshot();return JSON.stringify([s.base.token,s.care.patientId,target]);}
  async function retrySchedule(target){
    if(!snapshot().allowed)return false;
    const scope=scheduleRetryScope(target);if(scheduleRetryFlights.has(scope))return scheduleRetryFlights.get(scope);
    const task=Promise.resolve().then(()=>target==='homeCustomReminders'?window.carestepRefreshHomeReminders?.():window.carestepHomeCare?.refreshMedication?.()).finally(()=>{scheduleRetryFlights.delete(scope);if(scope===scheduleRetryScope(target))refresh();});
    scheduleRetryFlights.set(scope,task);refresh();
    try{return await task;}catch{return false;}
  }
  function backFromSettings(){go(settingsReturn==='settings'?'home':settingsReturn);}
  window.carestepHomeNavigation={mounted:false,mount,arrange,refresh,refreshCurrent,refreshBusy,go,onView,allowsNotificationFocus:name=>route===name&&view==='dashboardView',back:()=>go(healthReturn==='health'?'home':healthReturn)};
  window.addEventListener('carestep-home-patient',syncPatient);
  const boot=()=>{if(!mount())return;syncPatient();view=window.carestepHomeSnapshot?.().view||(!$('patientView')?.hidden?'patientView':!$('dashboardView')?.hidden?'dashboardView':'');onView(view,window.carestepHomeSnapshot?.().activePatientId);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
