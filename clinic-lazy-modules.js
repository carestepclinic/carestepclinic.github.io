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
   script.onload=()=>{loaded.add(src);resolve();};
   script.onerror=()=>{script.remove();reject(Error('화면 파일 조회 실패'));};
   document.head.append(script);
  });
  pending.set(src,task);task.then(()=>pending.delete(src),()=>pending.delete(src));return task;
 }
 // Fetch the selected screen's files together, but execute in dependency order.
 g.ClinicLazyModules={needs:group=>(manifest[group]||[]).some(src=>!loaded.has(src)),async ensure(group){preload(group);for(const src of manifest[group]||[])await load(src);}};
})(window);
