(function(g){
 'use strict';
 let generation=0;
 const scope=()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':');
 const allowed=()=>saasMode==='auth'&&!!saasMe&&['materials.read','records.read','patients.read'].every(k=>saasPermission(k,true));
 function node(tag,text,cls){const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,fn){const el=node('button',text);el.type='button';el.onclick=fn;return el;}
 function clear(){generation++;const root=document.getElementById('wardTodayRoot');if(root){root.replaceChildren();root.hidden=true;}}
 async function refresh(){
  const root=document.getElementById('wardTodayRoot');if(!root)return;if(!allowed()){clear();return;}
  const token=++generation,key=scope(),current=()=>token===generation&&key===scope()&&allowed()&&root.isConnected;
  root.hidden=false;root.className='pt';root.replaceChildren();const card=node('section',null,'pt-card pt-today-ward'),head=node('div',null,'pt-today-ward-head'),title=node('h3','입원환자 현황'),state=node('p','입원환자를 확인하는 중…','pt-help');state.setAttribute('role','status');head.append(title,button('새로고침',refresh));card.append(head,state);root.append(card);card.setAttribute('aria-busy','true');
  try{
   const result=await saasRequest('/saas/practice/clinical/cases');if(!current())return;
   const patients=(result.items||[]).filter(c=>c.kind==='admission'&&c.status!=='closed'&&!c.body?.deleted);
   patients.sort((a,b)=>String(a.body?.location||'\uffff').localeCompare(String(b.body?.location||'\uffff'),'ko')||String(a.patient?.name||'').localeCompare(String(b.patient?.name||''),'ko'));
   const dog=patients.filter(c=>(c.body?.species||c.patient?.species)==='dog').length,cat=patients.filter(c=>(c.body?.species||c.patient?.species)==='cat').length;
   state.textContent=(result.hasMore?'조회된 입원 ':'입원 중 ')+patients.length+'마리'+(patients.length?' · 개 '+dog+' · 고양이 '+cat:'');
   const list=node('div',null,'pt-today-ward-list');card.append(list);let expanded=false;
   const open=id=>{if(current())g.CarestepPractice?.wardPatient(id);};
   function paint(){list.replaceChildren();for(const c of patients.slice(0,expanded?patients.length:6)){const line=button('',()=>open(c.id));line.className='pt-today-ward-patient';const copy=node('span'),name=node('b',c.patient?.name||c.body?.quickPatient?.name||'환자명 확인 필요'),species={dog:'개',cat:'고양이'}[c.body?.species||c.patient?.species]||'동물종 미입력',meta=node('small',[species,Number(c.body?.weight)>0?c.body.weight+' kg':'',c.body?.location||'입원실 미배정'].filter(Boolean).join(' · '));copy.append(name,meta);line.append(copy,node('span','열기','pt-today-ward-open'));list.append(line);}}
   paint();if(!patients.length)list.append(node('p',result.hasMore?'조회 범위에 입원환자가 없습니다. 전체 입원 현황은 보드에서 확인해주세요.':'현재 입원 중인 환자가 없습니다.','pt-help'));
   const footer=node('div',null,'pt-today-ward-footer');if(patients.length>6){const more=button('환자 '+(patients.length-6)+'마리 더 보기',()=>{expanded=!expanded;paint();more.textContent=expanded?'간략히 보기':'환자 '+(patients.length-6)+'마리 더 보기';more.setAttribute('aria-expanded',String(expanded));});more.setAttribute('aria-expanded','false');footer.append(more);}
   footer.append(button('입원보드 열기',()=>open('')));card.append(footer);if(result.hasMore)card.append(node('p','최근 진료 200건 기준입니다. 입원보드에서 전체 입원실도 확인해주세요.','pt-help'));
   card.append(node('small',new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})+' 기준','pt-today-ward-time'));
  }catch(e){if(current()){state.textContent='입원환자 현황을 불러오지 못했습니다.';card.append(button('다시 시도',refresh));}}
  finally{if(current())card.setAttribute('aria-busy','false');}
 }
 g.CarestepTodayWard={refresh,clear};
 document.getElementById('refreshWorkFirst')?.addEventListener('click',refresh);
})(window);
