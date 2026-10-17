/* CARESTEP HOME: compact overview and patient-scoped navigation. No writes or network calls. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const routes = {home:'홈',health:'건강기록',schedule:'관리일정',hospital:'병원',settings:'설정'};
  const positions = new Map();
  let route = 'home', view = '', patientId = '', account = '', auth = '', healthReturn = 'home', settingsReturn = 'home';
  let mounted = false, routing = false, arranging = false, positionRevision = 0;
  const query = new URLSearchParams(location.search);
  function initialHomeRoute(params) {
    if (params.get('customReminder') || params.get('medication') || params.get('care') === 'medications') return 'schedule';
    if (params.get('care') === 'materials' || params.get('followup')) return 'hospital';
    return 'home';
  }
  function nextHomeCare(medication, custom, pid) {
    const valid = [medication,custom].map(x=>x?.patientId===pid?x:null);
    const next = valid.flatMap((x,i)=>x?.state==='ready' && x.next ? [{...x.next,source:i===0?'병원 복약':'보호자 알림'}] : []).sort((a,b)=>a.time.localeCompare(b.time))[0];
    if (next) return {text:'다음 '+next.time+' · '+(next.label||next.title||next.source),target:next.source==='병원 복약'?'homeCarePatients':'homeCustomReminders'};
    if (valid.some(x=>!x||x.state!=='ready')) return {text:'오늘 일정 확인이 필요한 항목이 있습니다',target:'homeCarePatients'};
    if (valid.some(x=>x.count>0)) return {text:'시간이 지난 미완료 기록을 확인해주세요',target:'homeCarePatients'};
    return {text:'오늘 남은 관리가 없습니다 · 전체 일정 보기',target:'homeCarePatients'};
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
      if(focus){const target=typeof focus==='string'?$(focus):focus;if(target&&!target.closest('[hidden]')){target.setAttribute('tabindex','-1');target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});return;}}
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
    const picker=care.querySelector('.home-care-picker');move(picker,chrome);move($('homeCareFreshness'),chrome);
    const warning=make('button','home-navigation-warning');warning.id='homeNavigationWarning';warning.type='button';warning.hidden=true;warning.onclick=()=>{if(warning.dataset.custom==='true'){const detail=$('homeNavigationReminderSettings')?.querySelector('details');if(detail)detail.open=true;go('settings',{target:'homeNavigationReminderSettings'});}else window.carestepHomeCare?.openPushSettings?.();};chrome.append(warning);
    for(const name of ['home','schedule','hospital','settings']){
      const panel=make('section','home-navigation-panel');panel.id='homeNavigation-'+name;panel.dataset.homePage=name;panel.hidden=name!=='home';panel.setAttribute('aria-label',routes[name]);
      if(name!=='home'){const title=make('h2','home-navigation-page-title',name==='hospital'?'병원 자료·상담':routes[name]);panel.append(title);}
      care.append(panel);
    }
    const today=make('section','home-navigation-daily');today.id='homeNavigationDaily';
    const next=make('button','home-navigation-next');next.id='homeNavigationNext';next.type='button';next.onclick=()=>go('schedule',{target:next.dataset.target});today.append(next);
    $('homeNavigation-home').append(today);
    const prevention=make('section','home-navigation-prevention');prevention.id='homeNavigationPrevention';prevention.append(make('h3','','예방 예정'));
    for(const [type,label] of [['heartworm','심장사상충'],['vaccination','예방접종']]){
      const b=make('button','home-navigation-preventive-row');b.type='button';b.dataset.preventiveType=type;
      b.append(make('strong','',label),make('span','home-navigation-preventive-date'),make('span','home-navigation-dday'));
      b.onclick=()=>go('schedule',{target:b.dataset.target||'homeCareUpcoming'});prevention.append(b);
    }
    $('homeNavigation-home').append(prevention);
    const careLink=make('button','home-secondary','병원 후속관리·상담 일정 보기');careLink.type='button';careLink.id='homeNavigationFollowupLink';careLink.onclick=()=>window.carestepOpenHomeFollowups?.(patientId);$('homeNavigation-schedule').append(careLink);
    const reminderSettings=make('div');reminderSettings.id='homeNavigationReminderSettings';$('homeNavigation-settings').append(reminderSettings);
    const back=make('button','home-secondary','이전 화면으로');back.type='button';back.onclick=()=>backFromSettings();$('homeNavigation-settings').prepend(back);
    const nav=make('nav','home-bottom-navigation');nav.id='homeBottomNavigation';nav.hidden=true;nav.setAttribute('aria-label','HOME 주요 메뉴');
    const symbols={home:'<path d="M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8"/>',health:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 12h4l2-4 3 8 2-4h5"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 5 3 3 7-5"/>',hospital:'<path d="M5 21V6h14v15M3 21h18M9 21v-5h6v5M12 8v5m-2.5-2.5h5"/>'};
    for(const name of ['home','health','schedule','hospital']){
      const button=make('button');button.type='button';button.dataset.homeRoute=name;const icon=make('span','home-bottom-icon');icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+symbols[name]+'</svg>';icon.setAttribute('aria-hidden','true');button.append(icon,make('span','',routes[name]));button.onclick=()=>go(name);nav.append(button);
    }
    main.after(nav);
    mounted=true;window.carestepHomeNavigation.mounted=true;
    arrange();
    return true;
  }
  function arrange() {
    if(!mounted||arranging)return;arranging=true;
    try {
      const home=$('homeNavigation-home'),schedule=$('homeNavigation-schedule'),hospital=$('homeNavigation-hospital'),settings=$('homeNavigation-settings');
      // Move live nodes, preserving their handlers, filters, details and drafts.
      move($('homeCareHealth'),home);if(home.firstElementChild!==$('homeCareHealth')&&$('homeCareHealth'))home.prepend($('homeCareHealth'));
      const today=$('homeNavigationDaily');move($('homeCareRemaining'),today);if(today.firstElementChild!==$('homeCareRemaining')&&$('homeCareRemaining'))today.prepend($('homeCareRemaining'));
      move($('homeCareHospitalNotice'),home);move($('homeCareFollowups'),home);
      for(const id of ['homeCareNext','homeCareStatus','homeCareFamilyUpdate','homeCarePatients','homeCustomReminders','homeCareDue','homeCareUpcoming'])move($(id),schedule);
      if($('homeNavigationFollowupLink')?.previousElementSibling!==$('homeCareUpcoming'))schedule.append($('homeNavigationFollowupLink'));
      move($('r61-home-materials'),hospital);move($('homeCareAll'),hospital);
      if($('r61-home-materials')&&$('homeCareAll')?.previousElementSibling!==$('r61-home-materials'))$('r61-home-materials').after($('homeCareAll'));
      const all=$('homeCareAll');if(all){all.open=true;text(all.querySelector(':scope > summary'),'병원 안내·상담');}
      text($('homeFollowupSection')?.querySelector('h2'),'병원 안내·상담');
      move($('homeCareSettings'),settings);if($('homeCareSettings'))$('homeCareSettings').open=true;
      move($('homeCareConnections'),settings);
      const connections=$('homeCareConnections');
      for(const n of [...($('dashboardView')?.children||[])])if(connections&&(n.id==='homeConnections'||n.classList.contains('home-clinic-group')||n.classList.contains('connection-ready')||n.classList.contains('stage-note')))move(n,connections);
      const accountHead=$('logoutButton')?.closest('.dashboard-head');
      move(accountHead,snapshot().base.home?.consentRequired?$('dashboardView'):settings);
      if(snapshot().base.home?.consentRequired&&accountHead&&$('dashboardView').firstElementChild!==accountHead)$('dashboardView').prepend(accountHead);
      const custom=$('homeCustomReminders')?.querySelector('.home-custom-device');
      if(custom)move(custom,$('homeNavigationReminderSettings'));
      refresh();
    } finally { arranging=false; }
  }
  function refresh() {
    if(!mounted)return;
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
    text($('homeNavigationTitle'),route==='home'?'우리 아이 건강관리':route==='hospital'?'병원 자료·상담':routes[route]);
    $('homeNavigationSettingsButton').setAttribute('aria-pressed',String(route==='settings'));
    if($('homeCareRefresh'))$('homeCareRefresh').hidden=route==='health';
    if(!allowed)return;
    const custom=window.carestepHomeReminderSummary?.();
    const next=nextHomeCare(care.medicationSummary,custom,care.patientId);text($('homeNavigationNext'),next.text+' ›');$('homeNavigationNext').dataset.target=next.target;
    $('homeNavigationDaily').hidden=!care.patientId;
    for(const row of preventiveHomeRows(care.preventiveSummary,care.patientId)){
      const b=$('homeNavigationPrevention').querySelector('[data-preventive-type="'+row.type+'"]');
      text(b.querySelector('strong'),row.label+(row.count>1?' · '+row.count+'종':''));
      text(b.querySelector('.home-navigation-preventive-date'),row.state==='failed'?'조회 실패 · 다시 확인':row.state==='loading'?'예정일 확인 중':row.item?.nextDueDate||'예정일 미등록');
      text(b.querySelector('.home-navigation-dday'),row.state==='failed'?'확인 필요':row.state==='loading'?'…':row.item?.countdown||'미등록');
      b.dataset.target=row.item?.days<=0?'homeCareDue':'homeCareUpcoming';b.classList.toggle('is-due',row.state==='ready'&&row.item?.days<=0);
    }
    $('homeNavigationPrevention').hidden=!care.patientId;
    const kind=base.push?.kind||care.push?.kind;
    const warning=kind&&kind!=='active'&&kind!=='loading'?'앱 알림 설정을 확인해주세요 ›':kind==='active'&&custom?.device===false?'이 기기의 보호자 알림이 꺼져 있어요 ›':'';
    text($('homeNavigationWarning'),warning);$('homeNavigationWarning').hidden=!warning;$('homeNavigationWarning').dataset.custom=String(kind==='active'&&custom?.device===false);
  }
  function syncPatient() {
    if(!mount())return;
    const {base,care}=snapshot(),changedAuth=auth!==base.token||account!==base.home?.user?.id;
    if(changedAuth){positions.clear();positionRevision++;route=initialHomeRoute(query);healthReturn='home';auth=base.token||'';account=base.home?.user?.id||'';patientId='';}
    const next=care.patientId||'';
    if(next!==patientId){
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
    syncPatient();remember();
    if(name==='health'&&!patientId)return false;
    if(name==='settings'&&route!=='settings')settingsReturn=route;
    if(name==='health'&&route!=='health'&&route!=='settings')healthReturn=route;
    route=name;routing=true;
    try {
      if(name==='health'){void window.carestepOpenHomeHealth?.(patientId);}
      else window.carestepShowHomeDashboard?.();
    } finally {routing=false;}
    refresh();
    if(scroll)restorePosition(target?0:positions.get(key())||0,target);
    return true;
  }
  function backFromSettings(){go(settingsReturn==='settings'?'home':settingsReturn);}
  window.carestepHomeNavigation={mounted:false,mount,arrange,refresh,go,onView,allowsNotificationFocus:name=>route===name&&view==='dashboardView',back:()=>go(healthReturn==='health'?'home':healthReturn)};
  window.addEventListener('carestep-home-patient',syncPatient);
  const boot=()=>{if(!mount())return;syncPatient();view=window.carestepHomeSnapshot?.().view||(!$('patientView')?.hidden?'patientView':!$('dashboardView')?.hidden?'dashboardView':'');onView(view,window.carestepHomeSnapshot?.().activePatientId);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
