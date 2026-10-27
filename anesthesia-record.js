(function(g){
 'use strict';
 const metrics={heartRate:['심박수','회/분',0,300],respiratoryRate:['호흡수','회/분',0,100],etco2:['EtCO₂','mmHg',0,100],spo2:['SpO₂','%',50,100],temperature:['체온','°C',30,42],systolic:['수축기 혈압','mmHg',0,250],diastolic:['이완기 혈압','mmHg',0,150],meanPressure:['평균 혈압','mmHg',0,180]};
 const markers={anesthesiaStart:'마취 시작',anesthesiaEnd:'마취 종료',surgeryStart:'수술 시작',surgeryEnd:'수술 종료',intubation:'삽관',extubation:'발관',medication:'추가 투약',other:'기타 사건'};
 const fields={diagnosis:'진단',operation:'수술명',surgeon:'집도의',assistant1:'제1 보조자',assistant2:'제2 보조자',anesthetist:'마취 담당자',age:'나이',sex:'성별·중성화',tube:'기관튜브 규격',fluid:'수액 종류',fluidRate:'수액 속도 · mL/hr',agent:'흡입마취제·설정 농도',oxygen:'산소 공급 설정',ventilation:'자발·보조·기계 환기',note:'비고·회복 계획'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const local=t=>new Date(new Date(t).getTime()+32400000).toISOString().slice(0,16);
 const when=t=>local(t).replace('T',' ');
 const clock=t=>local(t).slice(11);
 const input=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any"':''}></label>`;
 const btn=(act,text,extra='')=>`<button type="button" data-ar="${act}" ${extra}>${esc(text)}</button>`;
 function records(events){
  const result=new Map();for(const e of [...events].sort((a,b)=>a.revision-b.revision)){
   if(e.kind==='anesthesia.entry')result.set(e.body.recordId,{...e.body,revision:e.revision,eventId:e.id});
   else if(e.kind==='observation'&&Object.keys(e.body.values||{}).some(k=>metrics[k]))result.set(e.id,{...e.body,recordId:e.id,revision:e.revision,type:'measurement',legacy:true});
  }return [...result.values()].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.revision-b.revision);
 }
 function pointFromClick(x,y,rect,start,minutes,lo,hi){
  const sx=(x-rect.left)/rect.width*720,sy=(y-rect.top)/rect.height*300;
  if(sx<54||sx>704||sy<14||sy>268)return null;
  const offset=Math.round(((sx-54)/650*minutes)/5)*5,value=lo+(268-sy)/254*(hi-lo);
  return {observedAt:new Date(start+offset*60000).toISOString(),value:Math.round(value*10)/10};
 }
 function graph(key,rows,start,minutes,events=[]){
  const [label,unit,min,max]=metrics[key],end=start+minutes*60000;
  const points=rows.filter(r=>!r.voided&&r.type==='measurement'&&r.values?.[key]!=null&&Date.parse(r.observedAt)>=start&&Date.parse(r.observedAt)<=end);
  const lo=Math.min(min,...points.map(r=>r.values[key])),hi=Math.max(max,...points.map(r=>r.values[key]));
  const x=t=>54+(Date.parse(t)-start)/(minutes*60000)*650,y=v=>268-(v-lo)/(hi-lo)*254;
  let svg='';for(let i=0;i<=4;i++){const yy=14+i*63.5;svg+=`<line x1="54" x2="704" y1="${yy}" y2="${yy}"/><text x="48" y="${yy+4}" text-anchor="end">${Number((hi-(hi-lo)*i/4).toFixed(key==='temperature'?1:0))}</text>`;}
  for(let i=0;i<=minutes;i+=5){const xx=54+i/minutes*650;svg+=`<line x1="${xx}" x2="${xx}" y1="14" y2="268" class="ar-minor"/>`;if(i%(minutes>120?60:30)===0)svg+=`<text x="${xx}" y="292" text-anchor="${i===0?'start':i===minutes?'end':'middle'}">${clock(start+i*60000)}</text>`;}
  // Only connect adjacent observations within two 5-minute columns; missing intervals remain visible.
  for(let i=1;i<points.length;i++)if(Date.parse(points[i].observedAt)-Date.parse(points[i-1].observedAt)<=600000)svg+=`<path class="ar-trace" d="M${x(points[i-1].observedAt)} ${y(points[i-1].values[key])} L${x(points[i].observedAt)} ${y(points[i].values[key])}"/>`;
  for(const r of events.filter(r=>!r.voided&&r.type==='marker'&&Date.parse(r.observedAt)>=start&&Date.parse(r.observedAt)<=end))svg+=`<line class="ar-event-line" x1="${x(r.observedAt)}" x2="${x(r.observedAt)}" y1="14" y2="268"><title>${esc(markers[r.marker])} · ${clock(r.observedAt)}</title></line>`;
  for(const r of points)svg+=`<circle tabindex="0" role="button" aria-label="${esc(label+' '+r.values[key]+' '+unit+' · '+when(r.observedAt))}" data-ar-point="${esc(r.recordId)}" cx="${x(r.observedAt)}" cy="${y(r.values[key])}" r="5"><title>${when(r.observedAt)} · ${r.values[key]} ${unit}</title></circle>`;
  return `<section class="ar-chart"><h4>${label} <small>${unit}</small></h4><svg viewBox="0 0 720 300" data-ar-chart="${key}" data-lo="${lo}" data-hi="${hi}" role="img" aria-label="${label} 시간별 기록">${svg}</svg></section>`;
 }
 function mount(root,a){
  const item=a.item,context=a.context,valid=()=>root.isConnected&&a.valid(context,item.id);
  let all=[],events=[],ready=false,loading=false,error='',start=0,minutes=120,filter='all',auditLimit=100,editRevision=item.revision;
  const writable=()=>a.canRecord&&item.status!=='closed';
  const rows=()=>all.filter(r=>!r.voided),windowRows=()=>rows().filter(r=>Date.parse(r.observedAt)>=start&&Date.parse(r.observedAt)<=start+minutes*60000);
  function table(rs,actions=true){return `<div class="ar-table"><table><thead><tr><th>시각 · 한국 시간</th>${Object.values(metrics).map(m=>`<th>${m[0]}<small>${m[1]}</small></th>`).join('')}<th>기록자</th><th>메모${actions?'·정정':''}</th></tr></thead><tbody>${rs.filter(r=>r.type==='measurement').map(r=>`<tr><td>${when(r.observedAt)}</td>${Object.keys(metrics).map(k=>`<td>${r.values?.[k]??'—'}</td>`).join('')}<td>${esc(r.recorder?.name||'미기록')}</td><td>${esc(r.note)}${actions&&a.medical&&!r.legacy?btn('edit','정정',`data-id="${esc(r.recordId)}"`):''}${r.legacy?' · 기존 관찰 기록':''}</td></tr>`).join('')||'<tr><td colspan="11">이 구간에 측정 기록이 없습니다.</td></tr>'}</tbody></table></div>`;}
  function render(){if(!valid())return;
   root.innerHTML=`<section class="ar-sheet"><div class="ar-toolbar"><h3>마취 기록지</h3><div>${btn('refresh','기록 새로고침',loading?'disabled':'')}${btn('print','현재 구간 인쇄·PDF',!ready?'disabled':'')}</div></div><details class="ar-summary"><summary>수술·마취 기본정보${item.body.anesthesiaSheet?.operation?' · '+esc(item.body.anesthesiaSheet.operation):''}</summary><dl>${Object.entries(fields).map(([k,l])=>`<div><dt>${l}</dt><dd>${esc(item.body.anesthesiaSheet?.[k]||'미입력')}</dd></div>`).join('')}</dl>${a.medical&&item.status!=='closed'?btn('sheet','기본정보 작성·수정'):''}</details>
   <p role="status">${esc(error|| (loading?'전체 기록을 불러오는 중 · '+events.length+'건':ready?'전체 '+rows().length+'건 조회 완료 · 정정 이력 포함 '+events.length+'건':''))}</p>${error?btn('refresh','다시 불러오기'):''}
   ${ready?`<div class="ar-toolbar"><div>${btn('previous','← 이전 구간')}${input('arStart','조회 시작 · 한국 시간',local(start),'datetime-local')}<label>표시 범위<select name="arMinutes">${[60,120,240].map(n=>`<option value="${n}" ${n===minutes?'selected':''}>${n/60}시간</option>`).join('')}</select>${btn('next','다음 구간 →')}${btn('latest','최근 기록')}</div><div>${writable()?btn('measurement','측정값 입력')+btn('marker','시작·종료·사건 기록'):''}</div></div><p class="ar-help">5분 눈금 · 항목의 그래프를 누르면 시간·수치를 확인한 뒤 저장합니다. 빈칸은 미측정이며 숫자로도 입력할 수 있습니다.</p><nav aria-label="그래프 항목">${[['all','전체'],...Object.entries(metrics).map(([k,v])=>[k,v[0]])].map(([k,v])=>btn('filter',v,`data-key="${k}" aria-pressed="${filter===k}"`)).join('')}</nav><div class="ar-charts">${Object.keys(metrics).filter(k=>filter==='all'||filter===k).map(k=>graph(k,rows(),start,minutes,rows())).join('')}</div><div class="ar-markers">${windowRows().filter(r=>r.type==='marker').map(r=>`<p><b>${clock(r.observedAt)} · ${markers[r.marker]}</b> ${esc(r.note)} · ${esc(r.recorder?.name||'미기록')} ${a.medical?btn('edit','정정',`data-id="${r.recordId}"`):''}</p>`).join('')}</div><details open><summary>측정 수치표 · ${when(start)}부터 ${minutes/60}시간</summary>${table(windowRows())}</details><details><summary>정정·입력 이력 ${events.length}건</summary><div class="ar-audit">${events.slice().reverse().slice(0,auditLimit).map(e=>`<p>${when(e.recorded_at)} · ${esc(e.body.recorder?.name||'기록자 미기록')} · ${e.body.reason?'정정: '+esc(e.body.reason):'입력'}${e.body.voided?' · 취소됨':''} · 측정/사건 ${when(e.body.observedAt)}<br>${esc(e.body.type==='marker'?markers[e.body.marker]:Object.entries(e.body.values||{}).filter(([k])=>metrics[k]).map(([k,v])=>metrics[k][0]+' '+v+' '+metrics[k][1]).join(' · '))}</p>`).join('')}</div>${events.length>auditLimit?btn('audit-more','이전 이력 100건 더 보기'):''}${all.filter(r=>r.voided).map(r=>`<p>${when(r.observedAt)} · 취소된 기록 ${a.medical?btn('edit','정정·복원',`data-id="${r.recordId}"`):''}</p>`).join('')}</details>`:''}</section>`;
   root.querySelectorAll('[data-ar]').forEach(b=>b.onclick=()=>action(b));
   root.querySelector('[name=arStart]')?.addEventListener('change',e=>{const n=Date.parse(e.target.value+'+09:00');if(Number.isFinite(n)){start=n;render();}});
   root.querySelector('[name=arMinutes]')?.addEventListener('change',e=>{minutes=Number(e.target.value);render();});
   root.querySelectorAll('[data-ar-chart]').forEach(svg=>svg.onclick=e=>{
    const id=e.target.closest('[data-ar-point]')?.dataset.arPoint;if(id){const r=all.find(r=>r.recordId===id);if(a.medical&&!r.legacy)entry(r);return;}
    if(!writable())return;const value=pointFromClick(e.clientX,e.clientY,svg.getBoundingClientRect(),start,minutes,+svg.dataset.lo,+svg.dataset.hi);if(!value)return;
    const key=svg.dataset.arChart;value.value=key==='temperature'?value.value:Math.round(value.value);
    const old=all.find(r=>!r.voided&&!r.legacy&&r.type==='measurement'&&r.observedAt===value.observedAt);
    if(old&&!a.medical){error='해당 시각에 기록이 있습니다. 의료진에게 정정을 요청하거나 실제 측정 시각을 직접 입력해주세요.';render();return;}
    entry(old||null,{observedAt:value.observedAt,values:{...(old?.values||{}),[key]:value.value}});
   });
   root.querySelectorAll('[data-ar-point]').forEach(p=>p.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();const r=all.find(r=>r.recordId===p.dataset.arPoint);if(a.medical&&!r.legacy)entry(r);}});
  }
  async function fetchAll(){if(loading)return;loading=true;ready=false;error='';events=[];render();try{
   let after=0,through=0;do{const r=await a.api('/cases/'+item.id+'/anesthesia?after='+after+(through?'&through='+through:''));if(!valid())return;through=r.through;events.push(...r.events);render();if(!r.hasMore)break;if(!Number.isInteger(r.next)||r.next<=after)throw Error('기록 조회가 중단됐습니다. 다시 불러와 주세요.');after=r.next;}while(true);
   all=records(events);ready=true;if(through!==item.revision){error='다른 직원이 기록을 변경했습니다. 새로고침 후 작성해주세요.';ready=false;}if(!start){const latest=all.filter(r=>!r.voided).at(-1)?.observedAt||new Date().toISOString();start=Math.floor(Date.parse(latest)/3600000)*3600000;}
  }catch(e){if(valid())error=e.message||'기록을 불러오지 못했습니다.';}finally{loading=false;if(valid())render();}}
  function entry(old=null,seed={},type='measurement'){
   if(!ready||(!old&&!writable())||(old&&!a.medical))return;
   const v={type,observedAt:new Date().toISOString(),values:{},...old,...seed};
   let html=`<p><b>${esc(item.patient.name)}</b> · ${v.type==='measurement'?'측정값 확인':'사건 기록'}</p>`+input('observedAt','실제 시각 · 한국 시간',local(v.observedAt),'datetime-local');
   if(v.type==='measurement')html+='<div class="cl-form-grid">'+Object.entries(metrics).map(([k,m])=>input(k,m[0]+' · '+m[1],v.values?.[k]??'','number')).join('')+'</div><p>측정한 항목만 입력하세요. 빈칸은 0으로 저장하지 않습니다.</p>';
   else html+='<label>사건 종류<select name="marker">'+Object.entries(markers).map(([k,l])=>`<option value="${k}" ${k===v.marker?'selected':''}>${l}</option>`).join('')+'</select></label>';
   html+=`<label>메모<textarea name="note">${esc(v.note)}</textarea></label>`;
   if(old)html+=`<label>정정 사유<input name="reason" required></label><label><input type="checkbox" name="voided" ${old.voided?'checked':''}>이 기록 취소 · 원본은 이력에 보관</label>`;
   html+='<label><input type="checkbox" name="confirm" required>환자·시각·수치·단위를 확인했습니다.</label>';
   const dialog=a.modal(old?'마취 기록 정정':'마취 측정·사건 기록',html,async f=>{
    const values={};if(v.type==='measurement')for(const k of Object.keys(metrics))if(f.elements[k].value!=='')values[k]=Number(f.elements[k].value);
    const data={type:v.type,observedAt:new Date(f.elements.observedAt.value+'+09:00').toISOString(),note:f.elements.note.value,...(v.type==='measurement'?{values}:{marker:f.elements.marker.value}),...(old?{recordId:old.recordId,supersedes:old.revision,reason:f.elements.reason.value,voided:f.elements.voided.checked}:{})};
    await a.save('anesthesia.entry',data,editRevision);
   });
   const recorder=dialog?.querySelector('[name=recordedPersonId]');if(old?.recorder?.id&&recorder&&[...recorder.options].some(o=>o.value===old.recorder.id))recorder.value=old.recorder.id;
  }
  function sheet(){a.modal('마취기록 기본정보','<p>'+esc(item.patient.name)+' · '+esc(item.body.species==='cat'?'고양이':'개')+' · '+esc(item.body.weight??'체중 미입력')+' kg</p><div class="cl-form-grid">'+Object.entries(fields).map(([k,l])=>input(k,l,item.body.anesthesiaSheet?.[k]||'')).join('')+'</div>',f=>a.save('anesthesia.sheet',Object.fromEntries(Object.keys(fields).map(k=>[k,f.elements[k].value])),editRevision));}
  function print(){
   const win=window.open('','_blank');if(!win){error='인쇄 창이 차단됐습니다. 팝업을 허용한 후 다시 눌러주세요.';render();return;}
   const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>마취 기록지</title><style>body{font:12px sans-serif;color:#142b48}h1{font-size:20px}dl{display:grid;grid-template-columns:repeat(3,1fr)}dt{font-weight:bold}dd{margin:3px 0 10px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #bbb;padding:5px}th small{display:block}svg{width:100%;height:auto}svg line{stroke:#ddd}svg text{font-size:11px}.ar-trace{stroke:#2455dd;fill:none;stroke-width:2}circle{fill:#2455dd}.ar-event-line{stroke:#b45309;stroke-dasharray:4 4}.ar-chart{break-inside:avoid}.charts{display:grid;grid-template-columns:1fr 1fr}.ar-chart h4{margin:6px}button{padding:10px}@media print{button{display:none}thead{display:table-header-group}@page{size:A4 landscape;margin:12mm}}</style></head><body><button onclick="window.print()">인쇄 / PDF로 저장</button><h1>마취 기록지 · ${esc(item.patient.name)}</h1><p>${esc(item.body.species==='cat'?'고양이':'개')} · ${esc(item.body.weight??'미입력')} kg · ${when(start)} ~ ${when(start+minutes*60000)} · 선택 구간 출력</p><dl>${Object.entries(fields).map(([k,l])=>`<div><dt>${l}</dt><dd>${esc(item.body.anesthesiaSheet?.[k]||'미입력')}</dd></div>`).join('')}</dl><div class="charts">${Object.keys(metrics).map(k=>graph(k,rows(),start,minutes,rows())).join('')}</div>${windowRows().filter(r=>r.type==='marker').map(r=>`<p>${when(r.observedAt)} ${markers[r.marker]} · ${esc(r.note)}</p>`).join('')}${table(windowRows(),false)}</body></html>`;
   win.document.open();win.document.write(html);win.document.close();
  }
  function action(b){switch(b.dataset.ar){case 'refresh':return a.reload();case 'audit-more':auditLimit+=100;break;case 'previous':start-=minutes*60000;break;case 'next':start+=minutes*60000;break;case 'latest':start=Math.floor(Date.parse(rows().at(-1)?.observedAt||new Date().toISOString())/3600000)*3600000;break;case 'filter':filter=b.dataset.key;break;case 'sheet':return sheet();case 'measurement':return entry();case 'marker':return entry(null,{},'marker');case 'edit':return entry(all.find(r=>r.recordId===b.dataset.id));case 'print':return print();}render();}
  void fetchAll();
 }
 const api={metrics,markers,records,pointFromClick,graph,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.AnesthesiaRecord=api;
})(typeof window==='undefined'?globalThis:window);
