/* Individual authentication is completed by the configured Access application. */
(()=>{'use strict';let popup=null,timer=null;
 const button=document.getElementById('hqIndividualConnect'),status=document.getElementById('hqIndividualStatus');if(!button)return;
 const stop=()=>{clearInterval(timer);timer=null;button.disabled=false;};
 button.onclick=async()=>{
  let base;try{base=new URL(document.getElementById('endpoint').value);if(base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password)throw Error();}catch{status.textContent='서버 주소를 확인해주세요.';return;}
  popup=window.open('about:blank','carestep-hq-auth','width=540,height=720');if(!popup){status.textContent='인증창을 열 수 있도록 팝업을 허용해주세요.';return;}
  button.disabled=true;status.textContent='개인 인증 설정 확인 중…';
  try{const r=await fetch(base.origin+'/hq/auth-mode',{cache:'no-store',signal:AbortSignal.timeout(10000)}),d=await r.json();if(!r.ok||d.mode!=='access'||!d.ready)throw Error('개인 인증의 운영 연결이 아직 준비되지 않았습니다.');
   const expectedOrigin=base.origin,expectedWindow=popup;
   const receive=async event=>{if(event.origin!==expectedOrigin||event.source!==expectedWindow||event.data?.type!=='carestep-hq-access')return;const d=event.data;if(!/^hqs_[A-Za-z0-9_-]{24,120}$/.test(d.token||'')||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(d.expiresAt)<=Date.now())return;window.removeEventListener('message',receive);stop();clearHqSession();sessionStorage.removeItem(HQ_KEY);document.getElementById('hqKey').value='';localStorage.setItem(ENDPOINT_KEY,expectedOrigin);localStorage.setItem(HQ_SESSION_KEY,d.token);localStorage.setItem(HQ_SESSION_EXP_KEY,d.expiresAt);status.textContent='개인 인증 완료';await connect();document.getElementById('conn').textContent='HQ · '+String(d.email||'개인 계정');};
   window.addEventListener('message',receive);popup.location.href=expectedOrigin+'/hq/access/connect?origin='+encodeURIComponent(location.origin);
   const end=Date.now()+10*60000;timer=setInterval(()=>{if(popup.closed||Date.now()>end){window.removeEventListener('message',receive);stop();if(!popup.closed)popup.close();}},1000);status.textContent='새 창에서 개인 계정과 추가 인증을 완료해주세요.';
  }catch(e){popup.close();stop();status.textContent=e.message;}
 };
})();
