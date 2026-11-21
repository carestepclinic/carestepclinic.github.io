/* Load optional screen definitions once; controllers and drafts stay in PracticeTools. */
(function(g){
 'use strict';
 const manifest=JSON.parse(document.getElementById('clinic-module-manifest')?.textContent||'{}');
 const loaded=new Set(),pending=new Map(),preloaded=new Set();
 function preload(group){
  for(const src of manifest[group]||[]){
   if(loaded.has(src)||preloaded.has(src))continue;
   const link=document.createElement('link');link.rel='preload';link.as='script';link.href=src;
   preloaded.add(src);document.head.append(link);
  }
 }
 function load(src){
  if(loaded.has(src))return Promise.resolve();
  if(pending.has(src))return pending.get(src);
  const task=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=src;script.async=true;
   let settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();preloaded.delete(src);for(const link of document.querySelectorAll('link[rel=preload]'))if(link.getAttribute('href')===src)link.remove();reject(error);}else{loaded.add(src);resolve();}};
   const timer=setTimeout(()=>finish(Error('화면 조회 시간이 초과되었습니다. 다시 시도해주세요.')),20000);
   script.onload=()=>finish();
   script.onerror=()=>finish(Error('화면 파일 조회 실패'));
   document.head.append(script);
  });
  pending.set(src,task);const clear=()=>{if(pending.get(src)===task)pending.delete(src);};task.then(clear,clear);return task;
 }
 // Fetch the selected screen's files together, but execute in dependency order.
 g.ClinicLazyModules={needs:group=>(manifest[group]||[]).some(src=>!loaded.has(src)),async ensure(group){preload(group);for(const src of manifest[group]||[])await load(src);}};
})(window);
