(function(g){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0;};
const time=v=>stamp(v)?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'시각 미제공';
const states=new WeakMap();
// Group the fetched snapshot only; retain individual IDs and original messages.
function groupIncidents(rows){
 const groups=new Map(),seen=new Set();
 for(const row of rows||[]){
  if(row.id&&seen.has(row.id))continue;if(row.id)seen.add(row.id);
  const status=row.status||'open',key=JSON.stringify([row.clinicId||row.clinicName||'',row.area||'',row.code||'',row.message||'',row.severity||'error',status]);
  if(!groups.has(key))groups.set(key,{key,status,rows:[]});groups.get(key).rows.push(row);
 }
 return [...groups.values()].map(group=>{
  group.rows.sort((a,b)=>stamp(b.createdAt)-stamp(a.createdAt)||String(a.id||'').localeCompare(String(b.id||'')));
  const dated=group.rows.filter(r=>stamp(r.createdAt));
  return {...group,latest:group.rows[0],count:group.rows.length,firstAt:dated.at(-1)?.createdAt,lastAt:dated[0]?.createdAt};
 }).sort((a,b)=>(a.status==='resolved')-(b.status==='resolved')||stamp(b.lastAt)-stamp(a.lastAt)||a.key.localeCompare(b.key));
}
function render(root,rows,{onPatch,limit=500}={}){
 if(!root)return;
 const state=states.get(root)||{pending:new Set()};states.set(root,state);
 const opened=new Set([...root.querySelectorAll('details[open][data-incident-group]')].map(e=>e.dataset.incidentGroup));
 const groups=groupIncidents(rows),count=groups.reduce((n,x)=>n+x.count,0);
 const badge=status=>'<span class="status '+(status==='resolved'?'active':'past_due')+'">'+(status==='resolved'?'해결':'미해결')+'</span>';
 root.innerHTML='<p class="hq-incident-summary" role="status">'+(count?'조회된 발생 기록 '+count.toLocaleString('ko-KR')+'건 · 동일 장애 '+groups.length.toLocaleString('ko-KR')+'묶음':'조건에 맞는 장애로그가 없습니다.')+'</p><p class="hq-incident-scope">발생 횟수와 최초·최근 시각은 현재 조회 범위(최대 '+limit+'건, 미해결 우선) 기준입니다. 묶음을 열면 원본 기록을 개별 처리할 수 있습니다.</p>'+groups.map(group=>{
  const x=group.latest;
  return '<details class="hq-incident-group" data-incident-group="'+esc(group.key)+'" '+(opened.has(group.key)?'open':'')+'><summary><span class="hq-incident-heading">'+badge(group.status)+'<strong>'+esc(x.clinicName||x.clinicId||'공통')+'</strong><span class="hq-incident-count">'+group.count.toLocaleString('ko-KR')+'회 발생</span><span class="hq-incident-expand">원본 기록 보기</span></span><span class="hq-incident-context"><span>'+esc(x.area||'영역 미제공')+'</span><span class="hq-incident-code">코드 '+esc(x.code||'미제공')+'</span></span><span class="hq-incident-message">'+esc(x.message||'메시지 미제공')+'</span><span class="hq-incident-times"><span>최초 '+esc(time(group.firstAt))+'</span><span>최근 '+esc(time(group.lastAt))+'</span></span></summary><ol class="hq-incident-records">'+group.rows.map(row=>'<li><div><time>'+esc(time(row.createdAt))+'</time><small>기록 ID '+esc(row.id||'미제공')+'</small>'+(row.status==='resolved'&&row.resolvedAt?'<small>해결 '+esc(time(row.resolvedAt))+'</small>':'')+'</div><button class="btn small" data-incident-id="'+esc(row.id||'')+'" data-incident-status="'+(group.status==='resolved'?'open':'resolved')+'" '+(!row.id||state.pending.has(row.id)?'disabled':'')+'>'+(group.status==='resolved'?'재오픈':'해결 처리')+'</button></li>').join('')+'</ol></details>';
 }).join('');
 root.querySelectorAll('[data-incident-id]').forEach(button=>button.onclick=async()=>{
  const id=button.dataset.incidentId;if(!id||state.pending.has(id)||!onPatch)return;
  state.pending.add(id);button.disabled=true;
  try{await onPatch(id,button.dataset.incidentStatus);}finally{state.pending.delete(id);root.querySelectorAll('[data-incident-id]').forEach(current=>{if(current.dataset.incidentId===id)current.disabled=false;});}
 });
}
const api={groupIncidents,render};if(typeof module==='object'&&module.exports)module.exports=api;else g.CarestepHqIncidents=api;
})(globalThis);
