/* Bound read waits only. Never retry or time out a write that may have succeeded. */
(function(g){'use strict';
 async function run(task,{signal,timeoutMs=30000}={}){
  const controller=new AbortController();let timer,onAbort;
  const cancelled=new Promise((_,reject)=>{
   onAbort=()=>{const error=signal?.reason||new DOMException('조회가 취소되었습니다.','AbortError');controller.abort(error);reject(error);};
   if(signal?.aborted){onAbort();return;}
   signal?.addEventListener('abort',onAbort,{once:true});
   timer=setTimeout(()=>{const error=Object.assign(Error('조회 시간이 초과되었습니다. 입력은 유지됩니다. 새로고침 또는 다시 시도로 조회해주세요.'),{code:'READ_TIMEOUT'});controller.abort(error);reject(error);},timeoutMs);
  });
  try{return await Promise.race([cancelled,Promise.resolve().then(()=>{if(controller.signal.aborted)throw controller.signal.reason;return task(controller.signal);})]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 g.ClinicReadDeadline={run};
})(typeof window==='undefined'?globalThis:window);
