/* Install metadata only: no new service worker, patient cache, or permissions. */
(function(){
 'use strict';
 function mount(){
  if(document.getElementById('clinicInstall'))return;
  const host=document.querySelector('.topbar-actions');if(!host)return;
  const button=document.createElement('button');button.id='clinicInstall';button.type='button';button.className='btn';button.textContent='CLINIC 앱 설치';host.append(button);
  let prompt=null,installed=false;
  const standalone=matchMedia('(display-mode: standalone)');
  const refresh=()=>{button.hidden=installed||standalone.matches||navigator.standalone===true;};
  refresh();standalone.addEventListener?.('change',refresh);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;refresh();});
  window.addEventListener('appinstalled',()=>{installed=true;prompt=null;refresh();});
  const dialog=document.createElement('dialog');dialog.className='clinic-install-dialog';dialog.setAttribute('aria-labelledby','clinicInstallTitle');
  dialog.innerHTML='<h2 id="clinicInstallTitle">CARESTEP CLINIC 앱 설치</h2><p>홈 화면에서 CLINIC을 바로 열 수 있습니다. 병원 업무 기능은 인터넷 연결과 로그인이 필요합니다.</p><p data-install-status role="status"></p><button type="button" data-install-now hidden>이 기기에 설치</button><ol><li><b>Android · Chrome</b><br>브라우저 메뉴 → 앱 설치 또는 홈 화면에 추가</li><li><b>iPhone · Safari</b><br>공유 메뉴 → 홈 화면에 추가 → 웹 앱으로 열기(표시되는 경우) → 추가</li></ol><p>앱 내 브라우저에서 설치 메뉴가 보이지 않으면 아래 주소를 Chrome 또는 Safari에서 열어주세요.</p><a href="./index.html" target="_blank" rel="noopener">CARESTEP CLINIC 열기</a><p>HOME 보호자 앱과 별도의 CLINIC 아이콘으로 추가됩니다.</p><form method="dialog"><button>닫기</button></form>';
  document.body.append(dialog);const now=dialog.querySelector('[data-install-now]'),status=dialog.querySelector('[data-install-status]');
  button.onclick=()=>{now.hidden=!prompt;status.textContent='';dialog.showModal();};
  now.onclick=async()=>{const current=prompt;if(!current)return;now.disabled=true;try{await current.prompt();const choice=await current.userChoice;status.textContent=choice.outcome==='accepted'?'설치 요청을 전달했습니다. 기기의 안내를 확인해주세요.':'설치를 취소했습니다. 브라우저 메뉴에서 다시 설치할 수 있습니다.';}catch{status.textContent='브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해주세요.';}finally{prompt=null;now.hidden=true;now.disabled=false;}};
  dialog.addEventListener('close',()=>button.focus());
  const offline=document.createElement('p');offline.className='clinic-connection-note';offline.setAttribute('role','status');offline.textContent='인터넷 연결이 끊겼습니다. 재연결 후 최신 기록과 저장 상태를 확인해주세요.';host.after(offline);
  const online=()=>{offline.hidden=navigator.onLine;};window.addEventListener('online',online);window.addEventListener('offline',online);online();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
