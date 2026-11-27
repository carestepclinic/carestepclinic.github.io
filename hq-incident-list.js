/* Read-only, cursor-paged incident list. Resolution remains an explicit audited action. */
(function(g){'use strict';
function mount(root,request){
 let rows=[],next='',history=[''],page=0,asOf='',sequence=0,loading=false,error='',signature='';
 const status=document.getElementById('incidentFilter'),period=document.getElementById('incidentPeriod');
 const nav=document.createElement('div');nav.className='toolbar';nav.innerHTML='<button class="btn" data-inc-prev>이전</button><span role="status" data-inc-position></span><button class="btn" data-inc-next>다음</button><button class="btn" data-inc-retry hidden>다시 조회</button>';root.after(nav);
 const position=nav.querySelector('[data-inc-position]'),previous=nav.querySelector('[data-inc-prev]'),following=nav.querySelector('[data-inc-next]'),retry=nav.querySelector('[data-inc-retry]');
 function render(){
  g.CarestepHqIncidents.render(root,rows,{onPatch:(id,value)=>patchProductionIncident(id,value),limit:200});
  position.textContent=loading?'목록 조회 중…':error||((page+1)+'페이지 · '+rows.length+'건'+(next?' · 다음 목록 있음':' · 마지막 목록'));
  previous.disabled=loading||!page;following.disabled=loading||!next;retry.hidden=!error;
  const label=period.value==='recent'?'최근 7일':period.value==='older'?'7일 이전':'전체 기간';
  document.getElementById('incidentScope').textContent=label+' · '+status.options[status.selectedIndex].text+' 기록입니다. 미처리 이력이 현재 서비스 장애를 뜻하지는 않습니다.';
 }
 async function load({reset=false,target=page}={}){
  const selected=status.value+'|'+period.value;
  if(reset||selected!==signature){history=[''];asOf='';target=0;signature=selected;}
  const token=++sequence,identity=g.CarestepHqWorkspace.owner();loading=true;error='';render();
  const params=new URLSearchParams({status:status.value,period:period.value,limit:'200'});if(asOf)params.set('asOf',asOf);if(history[target])params.set('cursor',history[target]);
  try{const result=await request('/hq/incidents?'+params);if(token!==sequence||!g.CarestepHqWorkspace.ready()||identity!==g.CarestepHqWorkspace.owner())return {incidents:[]};rows=result.incidents||[];page=target;asOf=result.asOf||'';next=result.nextCursor||'';history[page+1]=next;return result;}
  catch(e){if(token===sequence)error='목록 조회 실패 · 다시 조회해주세요.';return {incidents:rows};}
  finally{if(token===sequence){loading=false;render();}}
 }
 previous.onclick=()=>load({target:page-1});following.onclick=()=>load({target:page+1});retry.onclick=()=>load();status.onchange=period.onchange=()=>load({reset:true});
 render();return {load,render,clear(){sequence++;rows=[];next='';history=[''];page=0;asOf='';signature='';loading=false;error='';render();}};
}
g.HqIncidentList={mount};const root=document.getElementById('productionIncidentRows');if(root){const view=mount(root,(p,o)=>req(p,o));g.CarestepHqIncidentList=view;new MutationObserver(()=>{if(!g.CarestepHqWorkspace.ready())view.clear();}).observe(document.getElementById('loginOverlay'),{attributes:true,attributeFilter:['class']});}
})(window);
