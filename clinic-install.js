/* Install metadata only: no new service worker, patient cache, or permissions. */
(function(){
 'use strict';
 function mount(){
  if(document.getElementById('clinicInstall'))return;
  const host=document.querySelector('.topbar > div:first-child')||document.querySelector('.topbar-actions');if(!host)return;host.classList.add('clinic-install-heading');
  const button=document.createElement('button');button.id='clinicInstall';button.type='button';button.className='btn';button.textContent='CLINIC 앱 설치';host.append(button);
  let prompt=null,installed=false;
  const standalone=matchMedia('(display-mode: standalone)');
  const refresh=()=>{button.hidden=installed;button.textContent=standalone.matches||navigator.standalone===true?'CLINIC 앱 설치 확인':'CLINIC 앱 설치';};
  refresh();standalone.addEventListener?.('change',refresh);
  window.addEventListener('beforeinstallprompt',e=>{if(location.pathname!=='/index.html')return;e.preventDefault();prompt=e;refresh();});
  window.addEventListener('appinstalled',()=>{installed=true;prompt=null;refresh();});
  const dialog=document.createElement('dialog');dialog.className='clinic-install-dialog';dialog.setAttribute('aria-labelledby','clinicInstallTitle');
  dialog.innerHTML='<h2 id="clinicInstallTitle">CARESTEP CLINIC 앱 설치</h2><p>병원용 <b>CLINIC</b>과 보호자용 <b>HOME</b>은 별도 앱입니다. 설치창의 이름이 CLINIC인지 확인해주세요.</p><p data-install-status role="status"></p><button type="button" data-install-now hidden>CLINIC 설치</button><p data-install-entry><a class="clinic-install-entry" href="./index.html?install=clinic" target="_blank" rel="noopener">CLINIC 전용 설치 화면 열기</a><br>현재 작성 화면을 유지하고 새 탭에서 엽니다.</p><ol><li><b>Android · Chrome</b><br>아래 CLINIC 주소를 Chrome에서 열고 메뉴 → 앱 설치 또는 홈 화면에 추가를 선택하세요.</li><li><b>iPhone · Safari</b><br>공유 → 홈 화면에 추가 → 웹 앱으로 열기(표시되는 경우)를 선택하세요.</li></ol><label>CLINIC 전용 주소<input data-install-url readonly aria-label="CLINIC 전용 주소" value="https://carestepclinic.github.io/index.html"></label><details data-install-conflict><summary>HOME이 설치돼 있고 ‘이미 앱이 있음’으로 나올 때</summary><p>예전 HOME 앱에 사이트 전체를 연결하는 설정이 남아 있는 경우입니다. 새로고침만으로 설치된 앱 설정이 즉시 바뀌지는 않습니다.</p><ol><li>HOME을 한 번 열고 닫은 뒤 Wi-Fi·충전 상태에서 앱 업데이트를 기다려주세요.</li><li>바로 확인하려면 Chrome 주소창에 <code>about://webapks</code>를 입력하고 Carestep Home의 Update를 선택하세요. HOME을 다시 열고 완전히 닫은 뒤 업데이트 완료를 확인합니다. 이 메뉴는 Chrome 버전에 따라 다를 수 있습니다.</li><li>계속 막히면 기존 HOME 앱만 제거하고 HOME과 CLINIC을 각각 다시 설치할 수 있습니다. <b>사이트 데이터 삭제·인터넷 사용 기록 삭제는 선택하지 마세요.</b> 로그인이나 알림 설정을 다시 확인해야 할 수 있습니다.</li></ol><a href="./home.html" target="_blank" rel="noopener">HOME 설치 주소 열기</a> · <a href="https://web.dev/articles/manifest-updates#updates_on_chrome_for_android" target="_blank" rel="noopener noreferrer">Chrome 앱 업데이트 안내</a></details><p>병원 업무는 인터넷 연결과 로그인이 필요합니다. HOME 앱 안에서 열린 CLINIC 화면이라면 Chrome에서 위 전용 주소를 열어 설치해주세요.</p><form method="dialog"><button>닫기</button></form>';

  document.body.append(dialog);const now=dialog.querySelector('[data-install-now]'),status=dialog.querySelector('[data-install-status]');
  button.onclick=()=>{now.hidden=!prompt;dialog.querySelector('[data-install-entry]').hidden=location.pathname==='/index.html';status.textContent=location.pathname==='/index.html'?'CLINIC 전용 설치 주소입니다.':'전용 설치 화면에서 설치를 진행해주세요.';dialog.showModal();};
  if(new URL(location.href).searchParams.get('install')==='clinic'){button.click();const url=new URL(location.href);url.searchParams.delete('install');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
  now.onclick=async()=>{const current=prompt;if(!current)return;now.disabled=true;try{await current.prompt();const choice=await current.userChoice;status.textContent=choice.outcome==='accepted'?'설치 요청을 전달했습니다. 기기의 안내를 확인해주세요.':'설치를 취소했습니다. 브라우저 메뉴에서 다시 설치할 수 있습니다.';}catch{status.textContent='브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해주세요.';}finally{prompt=null;now.hidden=true;now.disabled=false;}};
  dialog.addEventListener('close',()=>button.focus());
  const offline=document.createElement('p');offline.className='clinic-connection-note';offline.setAttribute('role','status');offline.textContent='인터넷 연결이 끊겼습니다. 재연결 후 최신 기록과 저장 상태를 확인해주세요.';host.after(offline);
  const online=()=>{offline.hidden=navigator.onLine;};window.addEventListener('online',online);window.addEventListener('offline',online);online();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
