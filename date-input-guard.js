/* CARESTEP Clinic v9.4.3 · four-digit year guard for every date input */
(() => {
  'use strict';
  const MIN_YEAR=1900;
  const MAX_YEAR=2099;
  const DATE_SELECTOR='input[type="date"]';
  const notifiedAt=new WeakMap();

  function today(){return new Date().toISOString().slice(0,10);}
  function isDateInput(el){return !!el&&el.matches?.(DATE_SELECTOR);}
  function parseDate(raw=''){
    const match=String(raw).trim().match(/^\+?(\d{4,})-(\d{2})-(\d{2})$/);
    if(!match)return null;
    return {yearText:match[1],year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
  }
  function isRealDate(year,month,day){
    if(year<MIN_YEAR||year>MAX_YEAR||month<1||month>12||day<1||day>31)return false;
    const d=new Date(Date.UTC(year,month-1,day));
    return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
  }
  function formatDate(year,month,day){return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  function configure(el){
    if(!isDateInput(el))return;
    if(!el.min)el.min=`${MIN_YEAR}-01-01`;
    if(!el.max)el.max=el.id==='crmPatientBirthDate'?today():`${MAX_YEAR}-12-31`;
    el.dataset.fourDigitYear='true';
  }
  function notify(el,message){
    const now=Date.now(),last=notifiedAt.get(el)||0;
    if(now-last<1200)return;
    notifiedAt.set(el,now);
    if(typeof window.toast==='function')window.toast(message);
  }
  function normalize(el,{announce=false}={}){
    if(!isDateInput(el))return {valid:true,changed:false,value:el?.value||''};
    configure(el);
    const raw=String(el.value||'');
    if(!raw){el.setCustomValidity?.('');return {valid:true,changed:false,value:''};}
    const parsed=parseDate(raw);
    if(!parsed){el.setCustomValidity?.('연도 4자리와 월·일을 정확히 입력해주세요.');return {valid:false,changed:false,value:raw};}
    let {yearText,year,month,day}=parsed,changed=false;
    if(yearText.length>4){
      year=Number(yearText.slice(0,4));
      if(isRealDate(year,month,day)){el.value=formatDate(year,month,day);changed=true;if(announce)notify(el,`연도를 ${year}년으로 자동 교정했습니다.`);}
    }
    const valid=yearText.length===4||changed?isRealDate(year,month,day):false;
    el.setCustomValidity?.(valid?'':`연도는 ${MIN_YEAR}~${MAX_YEAR} 사이의 4자리로 입력해주세요.`);
    if(!valid&&announce)notify(el,'연도는 4자리로 입력해주세요.');
    return {valid,changed,value:el.value||raw,year,month,day};
  }
  function configureAll(root=document){
    if(isDateInput(root))configure(root);
    root.querySelectorAll?.(DATE_SELECTOR).forEach(configure);
  }
  function validateForm(form){
    const dates=[...(form?.querySelectorAll?.(DATE_SELECTOR)||[])];
    for(const el of dates){const result=normalize(el,{announce:true});if(!result.valid){el.focus();el.reportValidity?.();return false;}}
    return true;
  }

  document.addEventListener('focusin',e=>{if(isDateInput(e.target))configure(e.target);},true);
  document.addEventListener('input',e=>{if(isDateInput(e.target))normalize(e.target,{announce:true});},true);
  document.addEventListener('change',e=>{if(isDateInput(e.target))normalize(e.target,{announce:true});},true);
  document.addEventListener('blur',e=>{if(isDateInput(e.target)){const result=normalize(e.target,{announce:true});if(!result.valid)e.target.reportValidity?.();}},true);
  document.addEventListener('submit',e=>{if(!validateForm(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>configureAll());else configureAll();
  if(typeof MutationObserver==='function')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)configureAll(node);}).observe(document.documentElement,{childList:true,subtree:true});

  window.carestepDateGuard=Object.freeze({normalize,validateForm,configureAll,minYear:MIN_YEAR,maxYear:MAX_YEAR});
})();
