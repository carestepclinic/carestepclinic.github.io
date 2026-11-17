/* Offer updated CLINIC assets without unloading an active clinical workspace. */
(()=>{
 'use strict';
 function signature(doc){
  const source=doc.getElementById('clinic-module-manifest');if(!source)return null;
  let manifest;try{manifest=JSON.parse(source.textContent);}catch{return null;}
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||Object.values(manifest).some(x=>!Array.isArray(x)||x.some(v=>typeof v!=='string')))return null;
  const optional=new Set(Object.values(manifest).flat()),assets=[...doc.querySelectorAll('script[src],link[rel="stylesheet"]')].map(el=>el.getAttribute('src')||el.getAttribute('href')).filter(src=>src&&!optional.has(src));
  // Optional scripts can be inserted while restoring the previous screen. Their versions already belong to the manifest.
  return JSON.stringify([[...new Set(assets)].sort(),Object.keys(manifest).sort().map(key=>[key,manifest[key]])]);
 }
 let initial=null,pending=false,dismissed='',banner=null,etag='';
 // Later parser-inserted scripts must be included before freezing this tab's version.
 const capture=()=>{initial=signature(document);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',capture,{once:true});else capture();
 async function check(){
  if(initial===null||pending||document.hidden)return;pending=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   // Most checks only read headers; do not repeatedly download the application shell.
   if(etag){const head=await fetch(new URL('index.html',location.href),{method:'HEAD',cache:'no-cache',credentials:'omit',signal:controller.signal});if(head.ok&&head.headers.get('etag')===etag)return;}
   const response=await fetch(new URL('index.html',location.href),{cache:'no-cache',credentials:'omit',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
   if(response.status===304)return;if(!response.ok)return;
   const next=new DOMParser().parseFromString(await response.text(),'text/html');
   const version=signature(next);if(version===null)return;
   etag=response.headers.get('etag')||'';
   if(version===initial||version===dismissed){banner?.remove();banner=null;return;}
   if(!banner){banner=document.createElement('aside');banner.className='cs-update-notice';banner.setAttribute('aria-label','CLINIC 업데이트');banner.innerHTML='<div><strong>새 버전이 준비됐습니다.</strong><span>작성 중인 내용은 이 창에 유지됩니다. 새 버전은 새 창에서 열립니다.</span></div><a target="_blank" rel="noopener" class="cs-update-open">새 버전 열기</a><button type="button" aria-label="업데이트 안내 나중에 보기">나중에</button>';document.body.append(banner);}
   banner.querySelector('a').href=new URL('index.html?updated='+Date.now(),location.href).href;
   banner.querySelector('button').onclick=()=>{dismissed=version;banner.remove();banner=null;};
  }catch(_){/* A version check must never interrupt clinical work. */}
  finally{clearTimeout(timeout);pending=false;}
 }
 setTimeout(check,15000);setInterval(check,300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
 window.ClinicUpdateNotice={check};
})();
