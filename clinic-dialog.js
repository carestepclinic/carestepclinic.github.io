/* Shared, scoped confirmation UI. No request or storage operation runs here. */
(function(g){
 'use strict';
 let active=null,serial=0;const passes=new WeakMap();
 const identity=()=>JSON.stringify([typeof saasMode==='undefined'?'':saasMode,typeof saasMe==='undefined'?null:[saasMe?.clinic?.id,saasMe?.user?.id,saasMe?.role,saasMe?.permissions],typeof saasSessionMeta==='undefined'?'':saasSessionMeta?.id]);
 function ask(o={},input=false){
  if(active)return Promise.resolve(input?null:false);
  const scope=identity(),prior=document.activeElement,id='cs-action-'+(++serial),dialog=document.createElement('dialog');
  const valid=()=>{try{return scope===identity()&&(!o.valid||o.valid());}catch{return false;}};
  if(!valid())return Promise.resolve(input?null:false);
  dialog.className='cs-action-dialog';dialog.setAttribute('aria-labelledby',id+'-title');dialog.setAttribute('aria-describedby',id+'-message');
  const title=document.createElement('h2');title.id=id+'-title';title.textContent=o.title||(input?'이름 입력':'변경 확인');dialog.append(title);
  if(o.context){const context=document.createElement('p');context.className='cs-action-context';context.textContent=o.context;dialog.append(context);}
  const message=document.createElement('p');message.id=id+'-message';message.textContent=o.message||'';dialog.append(message);
  const form=document.createElement('form');let field;
  if(input){const label=document.createElement('label');label.textContent=o.label||'이름';field=document.createElement('input');field.type='text';field.required=true;field.maxLength=o.maxLength||100;field.value=o.value||'';label.append(field);form.append(label);}
  const actions=document.createElement('div');actions.className='cs-action-buttons';const cancel=document.createElement('button'),accept=document.createElement('button');
  cancel.type='button';cancel.textContent=o.cancelLabel||'취소';cancel.dataset.dialogCancel='';accept.type='submit';accept.textContent=o.confirmLabel||(input?'입력 완료':'확인');accept.dataset.dialogConfirm='';accept.className=o.destructive?'cs-action-danger':'cs-action-primary';actions.append(cancel,accept);form.append(actions);dialog.append(form);
  return new Promise(resolve=>{
   let ended=false,timer;const observer=new MutationObserver(()=>{if(!dialog.isConnected||!valid())finish(false);});
   const finish=ok=>{if(ended)return;ended=true;clearInterval(timer);observer.disconnect();const accepted=ok&&valid();if(active===dialog)active=null;dialog.remove();if(prior?.isConnected)prior.focus({preventScroll:true});resolve(input?(accepted?field.value.trim():null):accepted);};
   active=dialog;cancel.onclick=()=>finish(false);form.onsubmit=e=>{e.preventDefault();if(field&&!field.value.trim()){field.setCustomValidity('이름을 입력해주세요.');field.reportValidity();return;}finish(true);};if(field)field.oninput=()=>field.setCustomValidity('');
   dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button,input')].filter(x=>!x.disabled&&!x.hidden);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
   dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});dialog.addEventListener('close',()=>finish(false));document.body.append(dialog);
   try{dialog.showModal();}catch{finish(false);return;}
   (input?field:cancel).focus();if(input)field.select();observer.observe(document.body,{childList:true,subtree:true});timer=setInterval(()=>{if(!valid())finish(false);},250);
  });
 }
 function gate(owner,message,resume,o={}){
  const stamp=o.stamp||message,pass=passes.get(owner);
  if(pass===stamp){passes.delete(owner);return true;}
  if(typeof resume!=='function')return false;
  void ask({...o,message,title:o.title||'작성 중인 내용 닫기',confirmLabel:o.confirmLabel||'입력 버리고 이동',destructive:true}).then(ok=>{
   if(!ok)return;passes.set(owner,stamp);try{resume();}finally{if(passes.get(owner)===stamp)passes.delete(owner);}
  });return false;
 }
 g.ClinicDialog={confirm:o=>ask(o),prompt:o=>ask(o,true),gate};
})(window);
