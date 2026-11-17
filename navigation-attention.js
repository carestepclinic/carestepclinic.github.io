/* Reflect existing permitted submenu notices; no requests or new counts. */
(function(){
 'use strict';
 const nav=document.querySelector('.clinic-navigation')||document.getElementById('nav');if(!nav)return;
 const groupSelector='[data-nav-group],[data-hq-nav-group]';
 const sourceSelector='#navFollowupBadge,#onboardingNavBadge,.hq-nav-items .hq-nav-count';
 function pending(source){
  if(source.closest('[hidden],.hidden,.saas-hidden,.role-ui-hidden'))return false;
  const item=source.closest('button');if(!item||getComputedStyle(item).display==='none'||getComputedStyle(source).display==='none')return false;
  const value=source.textContent.trim();if(!value)return false;
  if(source.id==='onboardingNavBadge')return !source.classList.contains('done');
  return /[1-9]/.test(value);
 }
 function sync(){
  for(const group of nav.querySelectorAll(groupSelector)){
   const header=group.querySelector(':scope>summary,:scope>[data-hq-nav-toggle]');if(!header)continue;
   let badge=header.querySelector('.nav-group-attention');if(!badge){badge=document.createElement('span');badge.className='nav-group-attention';badge.textContent='확인';badge.setAttribute('aria-label','확인할 항목 있음');badge.title='분류를 펼쳐 확인할 항목을 확인하세요';header.insertBefore(badge,header.querySelector('i'));}
   const show=[...group.querySelectorAll(sourceSelector)].some(pending);if(badge.hidden===show)badge.hidden=!show;
  }
 }
 sync();
 new MutationObserver(changes=>{if(changes.some(change=>{const target=change.target.nodeType===1?change.target:change.target.parentElement;return !target?.closest('.nav-group-attention');}))sync();}).observe(nav,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style']});
})();
