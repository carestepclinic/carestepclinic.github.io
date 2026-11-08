/* Shared HQ controls. This module never writes data or stores credentials. */
(function(g){
 'use strict';
 const owner=()=>JSON.stringify([typeof endpoint==='function'?endpoint():'',typeof hqSessionToken==='function'?hqSessionToken():'',typeof key==='function'?key():'']);
 const ready=()=>document.getElementById('loginOverlay')?.classList.contains('hidden');
 let active=null;
 function confirm(message,options={}){
  if(active||!ready())return Promise.resolve(options.input?null:false);
  const identity=owner(),clinic=typeof selectedClinic==='undefined'?'':selectedClinic,view=typeof currentView==='undefined'?'':currentView,prior=document.activeElement,d=document.createElement('dialog');d.className='hq-confirm';d.setAttribute('aria-labelledby','hqConfirmTitle');
  const h=document.createElement('h2');h.id='hqConfirmTitle';h.textContent=options.title||'변경 내용 확인';const p=document.createElement('p');p.textContent=message;d.append(h,p);
  const form=document.createElement('form');let input;if(options.input){const label=document.createElement('label');label.textContent='확인 문구';input=document.createElement('input');input.required=true;input.autocomplete='off';label.append(input);form.append(label);}
  const actions=document.createElement('div');actions.className='hq-confirm-actions';const no=document.createElement('button'),yes=document.createElement('button');no.type='button';no.className='btn';no.textContent=options.cancelLabel||'취소';no.dataset.hqConfirmCancel='';yes.type='submit';yes.className='btn primary';yes.textContent=options.confirmLabel||'확인 후 진행';yes.dataset.hqConfirmAccept='';actions.append(no,yes);form.append(actions);d.append(form);
  return new Promise(resolve=>{let done=false;const valid=()=>ready()&&owner()===identity&&(typeof selectedClinic==='undefined'||selectedClinic===clinic)&&(typeof currentView==='undefined'||currentView===view)&&(!options.valid||options.valid());const finish=ok=>{if(done)return;done=true;observer.disconnect();clearInterval(timer);const accepted=ok&&valid();active=null;d.close();d.remove();if(prior?.isConnected)prior.focus({preventScroll:true});resolve(options.input?(accepted?input.value.trim():null):accepted);};const observer=new MutationObserver(()=>{if(!valid())finish(false);});const timer=setInterval(()=>{if(!valid())finish(false);},200);observer.observe(document.getElementById('loginOverlay'),{attributes:true});active={close:()=>finish(false)};no.onclick=()=>finish(false);form.onsubmit=e=>{e.preventDefault();finish(true);};d.oncancel=e=>{e.preventDefault();finish(false);};document.body.append(d);d.showModal();no.focus();});
 }
 function discard(root,callback){
  if(!root||root.querySelector('[data-hq-discard]'))return false;
  const identity=owner(),box=document.createElement('section');box.dataset.hqDiscard='';box.className='hq-discard';box.innerHTML='<p>저장하지 않은 변경사항이 있습니다.</p><button type="button" class="btn primary" data-hq-stay>작성 계속</button><button type="button" class="btn" data-hq-discard-confirm>저장하지 않고 닫기</button>';(root.querySelector('header')||root.firstElementChild).after(box);box.querySelector('[data-hq-stay]').onclick=()=>box.remove();box.querySelector('[data-hq-discard-confirm]').onclick=()=>{if(ready()&&identity===owner()&&root.isConnected){box.remove();callback();}};box.scrollIntoView({block:'nearest'});box.querySelector('button').focus();return false;
 }
 function documentView(root,label){if(!root)return;root.classList.add('hq-document-workspace');root.dataset.hqDocument=label;const h=root.querySelector('header');if(h&&!h.querySelector('.hq-document-label')){const p=document.createElement('span');p.className='hq-document-label';p.textContent=label;h.prepend(p);}}
 function slice(rows,state,signature,size=24){if(state.signature!==signature){state.signature=signature;state.page=0;}state.page=Math.min(state.page||0,Math.max(0,Math.ceil(rows.length/size)-1));state.size=size;return rows.slice(state.page*size,(state.page+1)*size);}
 function pager(host,state,total,render){if(total<=state.size)return;const nav=document.createElement('nav');nav.className='hq-pagination';nav.setAttribute('aria-label','목록 페이지');const previous=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');previous.type=next.type='button';previous.className=next.className='btn';previous.textContent='이전';next.textContent='다음';previous.disabled=!state.page;next.disabled=(state.page+1)*state.size>=total;count.textContent=(state.page*state.size+1)+'–'+Math.min(total,(state.page+1)*state.size)+' / '+total+'개';count.setAttribute('role','status');const turn=delta=>{state.page+=delta;render();host.scrollIntoView({block:'start'});host.querySelector('.hq-pagination button:not(:disabled)')?.focus({preventScroll:true});};previous.onclick=()=>turn(-1);next.onclick=()=>turn(1);nav.append(previous,count,next);host.append(nav);}
 function species(value){const v=String(value||'');return /both|공통|강아지.*고양이/.test(v)?'both':/dog|강아지|반려견/.test(v)?'dog':/cat|고양이|반려묘/.test(v)?'cat':'';}
 // Display-only taxonomy suggestions; original category stays editable and is never saved here.
 function category(item={}){
  const raw=String(item.category||item.field||item.body?.category||item.brief?.category||item.document?.template?.category||'').trim();
  const title=String(item.title||item.body?.title||'');
  if(!raw||['기타','미분류','예방','고양이 특화','질환·수술'].includes(raw)){
   for(const [pattern,label] of [[/슬개골.*탈구/,'정형외과'],[/아토피/,'피부과'],[/특발성.*방광염|\bFIC\b|\bFLUTD\b|요도.*폐색/i,'비뇨기'],[/전발치|전구강.*발치/,'치과'],[/인지.*기능/,'신경과']])if(pattern.test(title))return label;
  }
  return raw==='고양이 특화'?'분류 확인 필요':raw||'미분류';
 }
 function materialTitle(item){const title=String(item.title||'제목 없음');return item.status==='published'?title.replace(/\s*[·:—-]?\s*초안\s*$/,'').trim():title;}
 function adoptionAction(entry){const text=String(entry.nextAction||'');if(/첫.*(?:퇴원자료|안내자료)/.test(text))return entry.neverUsed===true?'보호자 안내자료 작성 흐름을 안내해주세요.':'최근 30일 보호자 안내자료 사용 현황을 확인해주세요.';return text.replaceAll('퇴원자료','보호자 안내자료');}
 g.CarestepHqWorkspace={confirm,prompt:message=>confirm(message,{input:true}),discard,documentView,slice,pager,species,category,materialTitle,adoptionAction,owner,ready};
})(window);
