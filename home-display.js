/* Device-only reading preference. No patient information or server writes. */
(() => {
  'use strict';
  const KEY='carestep_home_text_size_v1';
  const normalize=value=>value==='large'?'large':'default';
  let size='default',control=null;
  try {size=normalize(localStorage.getItem(KEY));} catch {}
  const paint=()=>{
    document.documentElement.dataset.homeTextSize=size;
    if(control)for(const b of control.querySelectorAll('[data-text-size]'))b.setAttribute('aria-pressed',String(b.dataset.textSize===size));
  };
  paint();
  function mount(host){
    if(!host||control?.isConnected)return;
    control=document.createElement('fieldset');control.className='home-display-settings';
    const title=document.createElement('legend');title.textContent='글씨 크기';
    const choices=document.createElement('div');choices.className='home-display-choices';
    const note=document.createElement('p');note.className='home-help';note.setAttribute('role','status');note.textContent='이 기기에서 사용하는 글씨 크기입니다.';
    for(const [value,label] of [['default','기본'],['large','크게']]){
      const b=document.createElement('button');b.type='button';b.className='home-secondary';b.dataset.textSize=value;b.textContent=label;
      b.onclick=()=>{size=value;paint();try{localStorage.setItem(KEY,size);note.textContent='글씨 크기 ‘'+label+'’를 이 기기에 저장했습니다.';}catch{note.textContent='현재 화면에 적용했습니다. 기기 저장이 제한되어 다시 열면 기본 크기로 표시될 수 있습니다.';}};
      choices.append(b);
    }
    control.append(title,choices,note);host.append(control);paint();
  }
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){size=normalize(event.newValue);paint();}});
  window.CarestepHomeDisplay={mount};
})();
