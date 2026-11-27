/* Anonymous signup diagnostics. Never include form fields or exception messages. */
(function(g){
 'use strict';
 const reasons=new Set(['consent_missing','invalid_input','email_in_use','document_confirmation','document_unavailable','cancelled','network','storage_error','request_failed']);
 function reason(error){
  if(reasons.has(error?.details?.signupReason))return error.details.signupReason;
  if(error?.signupStage==='documents')return 'document_unavailable';
  if(error?.name==='AbortError')return 'cancelled';
  if(error?.name==='TypeError'||error?.name==='TimeoutError')return 'network';
  return 'request_failed';
 }
 async function failed(error,attemptId,request){
  if(!/^[0-9a-f-]{36}$/i.test(attemptId||''))return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{await request('/saas/signup-failure',{method:'POST',auth:false,signal:controller.signal,body:JSON.stringify({attemptId,reason:reason(error)})});}catch{}finally{clearTimeout(timer);}
 }
 g.CarestepSignupEvents={newId:()=>g.crypto.randomUUID(),failed,reason};
})(window);

