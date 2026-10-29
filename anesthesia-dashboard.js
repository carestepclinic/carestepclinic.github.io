(function(g){
 'use strict';
 const series={heartRate:{label:'심박수',unit:'회/분',color:'#b42318',dash:''},respiratoryRate:{label:'호흡수',unit:'회/분',color:'#0369a1',dash:'7 3'},meanPressure:{label:'MAP',unit:'mmHg',color:'#7c3aed',dash:'3 3'},spo2:{label:'SpO₂',unit:'%',color:'#087f72',dash:''},etco2:{label:'EtCO₂',unit:'mmHg',color:'#a65a00',dash:'9 3 2 3'}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const local=t=>new Date(new Date(t).getTime()+32400000).toISOString().slice(0,16).replace('T',' '),clock=t=>local(t).slice(11);
 function overviewGraph(rows,start,minutes,keys=Object.keys(series),compact=false){
  keys=keys.filter(k=>series[k]);const end=start+minutes*60000,observations=rows.filter(r=>!r.voided&&r.type==='measurement'&&Date.parse(r.observedAt)>=start&&Date.parse(r.observedAt)<=end);
  const width=compact?600:930,right=width-26,plotWidth=right-54;const high=Math.max(200,Math.ceil(Math.max(0,...observations.flatMap(r=>keys.map(k=>r.values?.[k]??0)))/50)*50),x=t=>54+(Date.parse(t)-start)/(minutes*60000)*plotWidth,y=v=>260-v/high*240;
  let svg='';for(let i=0;i<=5;i++){const v=high*i/5,yy=y(v);svg+='<line x1="54" x2="'+right+'" y1="'+yy+'" y2="'+yy+'"/><text x="46" y="'+(yy+5)+'" text-anchor="end">'+Number(v.toFixed(1))+'</text>';}
  const step=Math.max(5,Math.ceil(minutes/(compact?4:12)/5)*5);for(let m=0;m<=minutes;m+=step){const xx=54+m/minutes*plotWidth;svg+='<line x1="'+xx+'" x2="'+xx+'" y1="20" y2="260"/><text x="'+xx+'" y="287" text-anchor="'+(m===0?'start':m===minutes?'end':'middle')+'">'+clock(start+m*60000)+'</text>';}
  const eventMarkup=g.AnesthesiaRecord?.graphEventMarkup||(typeof module==='object'?require('./anesthesia-record.js').graphEventMarkup:null);if(eventMarkup)svg+=eventMarkup(rows,start,minutes,54,right,20,260);
  for(const k of keys){const s=series[k],points=observations.filter(r=>r.values?.[k]!=null);svg+='<g data-series="'+k+'" style="--series-color:'+s.color+'">';
   for(let i=1;i<points.length;i++)if(Date.parse(points[i].observedAt)-Date.parse(points[i-1].observedAt)<=600000)svg+='<path class="ad-line" stroke-dasharray="'+s.dash+'" d="M'+x(points[i-1].observedAt)+' '+y(points[i-1].values[k])+' L'+x(points[i].observedAt)+' '+y(points[i].values[k])+'"/>';
   for(const r of points)svg+='<circle tabindex="0" role="button" data-ar-point="'+esc(r.recordId)+'" cx="'+x(r.observedAt)+'" cy="'+y(r.values[k])+'" r="4.5" aria-label="'+s.label+' '+r.values[k]+' '+s.unit+' · '+local(r.observedAt)+'"><title>'+s.label+' '+r.values[k]+' '+s.unit+' · '+local(r.observedAt)+'</title></circle>';
   svg+='</g>';
  }
  return '<svg viewBox="0 0 '+width+' 310" role="img" data-ar-overview aria-label="마취 모니터링 통합 추이 · 항목별 단위는 범례에 표시">'+svg+'</svg>'+(keys.length?'':'<p class="ad-empty">표시할 항목을 선택하세요.</p>')+(!observations.length?'<p class="ad-empty">아직 측정 기록이 없습니다. 측정 탭에서 기록하세요.</p>':'');
 }
 function arrange(root,a){
  const sheet=root.querySelector('.ar-sheet'),timing=root.querySelector('.ar-timing');if(!sheet||!timing)return;
  const rows=a.rows,view=a.view,tab=view.entryTab||'measurement',keys=view.overviewKeys||Object.keys(series),query=s=>root.querySelector(s);
  sheet.classList.add('ar-dashboard-sheet');
  const header=query('.ar-record-bar'),actions=query('.ar-quick-actions');actions?.replaceChildren();
  const print=query('.ar-print-menu');if(print)actions?.append(print);query('.ar-secondary')?.remove();
  const setup=query('.ar-summary');if(setup){setup.querySelector('summary').textContent='환자·수술 기본정보 및 설정';sheet.append(setup);}
  const dashboard=document.createElement('div');dashboard.className='ar-dashboard';dashboard.dataset.readonly=String(!a.writable);dashboard.innerHTML='<div class="ad-values" aria-label="최근 측정값"></div><details class="ad-monitor" aria-label="모니터링" '+((view.chartExpanded??(!a.writable||root.clientWidth>820))?'open':'')+'><summary>모니터링 그래프·수치표</summary><div class="ad-monitor-body"></div></details><aside class="ad-entry" aria-label="기록 입력"><nav class="ad-entry-tabs" aria-label="기록 종류">'+[['measurement','측정'],['medication','투약'],['procedure','처치·설정']].map(([k,l])=>a.btn('entry-tab',l,'data-key="'+k+'" aria-pressed="'+(tab===k)+'"')).join('')+'</nav><div class="ad-quick"></div><section data-ad-panel="measurement"></section><section data-ad-panel="medication"></section><section data-ad-panel="procedure"></section></aside>';
  timing.after(dashboard);const chart=dashboard.querySelector('.ad-monitor');chart.addEventListener('toggle',()=>{if(chart.isConnected)view.chartExpanded=chart.open;});const panel=k=>dashboard.querySelector('[data-ad-panel="'+k+'"]'),monitor=dashboard.querySelector('.ad-monitor-body');
  const valueKeys=[...Object.keys(series),'temperature'];dashboard.querySelector('.ad-values').innerHTML=valueKeys.map(k=>{const d=k==='temperature'?{label:'체온',unit:'°C',color:'#334155'}:series[k],record=rows.filter(r=>r.type==='measurement'&&r.values?.[k]!=null).at(-1),review=Number(a.item.body.anesthesiaSheet?.reviewMinutes||view.reviewMinutes),stale=record&&review>0&&(Date.now()-Date.parse(record.observedAt))/60000>=review;return '<div class="'+(stale?'ad-stale':'')+'"><span style="color:'+d.color+'">'+d.label+'</span><strong>'+(record?record.values[k]:'—')+' <small>'+d.unit+'</small></strong><small>'+(record?clock(record.observedAt)+(stale?' · 재확인':''):'미측정')+'</small></div>';}).join('');
  const nav=query('.ar-display');if(nav){nav.querySelector('[data-key=summary]').textContent='통합 그래프';nav.querySelector('[data-key=graphs]').textContent='개별 그래프';monitor.append(nav);}
  const overview=document.createElement('section');overview.className='ad-overview';overview.hidden=a.display!=='summary';overview.innerHTML='<div class="ad-legend">'+Object.entries(series).map(([k,d])=>'<label style="--series-color:'+d.color+'"><input type="checkbox" data-ad-series="'+k+'" '+(keys.includes(k)?'checked':'')+'><span>'+d.label+' <small>'+d.unit+'</small></span></label>').join('')+'</div><p class="ad-period">'+local(a.start)+' ~ '+local(a.start+a.minutes*60000)+'</p>'+overviewGraph(rows,a.start,a.minutes,keys,root.clientWidth<=820);monitor.append(overview);
  const range=query('.ar-range');if(range)monitor.append(range);
  const graphs=query('.ar-detail-graphs');if(graphs)monitor.append(graphs);
  const table=query('[data-ar-lazy=table]')?.closest('details');if(table){table.hidden=a.display!=='table';monitor.append(table);}
  const last=query('.ar-last-values');if(last)monitor.append(last);
  const settings=query('.ar-sheet>.ar-settings-summary');if(settings){const d=document.createElement('details');d.className='ad-settings';d.innerHTML='<summary>현재 마취·수액 설정</summary>';d.append(settings);monitor.append(d);}
  const inline=query('.ae-inline');if(inline)panel('measurement').append(inline);else panel('measurement').innerHTML='<p class="ad-readonly">'+(a.item.status==='closed'?(a.medical?'종료된 기록입니다. 그래프의 측정점을 눌러 기존 기록을 정정할 수 있습니다.':'종료된 기록을 조회하고 있습니다.'):'측정 입력 권한이 없습니다.')+'</p>';
  query('.ar-live-workspace')?.remove();const meds=query('.ar-medication');if(meds){panel('medication').append(meds);const plan=meds.querySelector('details');if(plan){plan.open=view.planExpanded??false;plan.addEventListener('toggle',()=>{if(plan.isConnected)view.planExpanded=plan.open;});}}
  const prepared=query('.ae-prepared');if(prepared){prepared.querySelector('h4').textContent='준비 약물·누적 투여량';prepared.querySelector('[data-ar=medication]')?.remove();panel('medication').append(prepared);}
  const procedure=panel('procedure');procedure.innerHTML='<h4>처치·특이사항</h4>'+(a.writable?'<div class="ad-procedure-actions">'+a.btn('procedure','처치·특이사항 기록')+a.btn('airway','삽관 기록')+a.btn('infusion','수액·CRI 기록')+a.btn('settings','마취·환기 설정')+'</div>':'')+'<div class="ad-procedure-list">'+rows.filter(r=>r.type==='marker'&&['other','intubation','extubation','infusion','settings'].includes(r.marker)).slice(-6).reverse().map(r=>'<p><time>'+clock(r.observedAt)+'</time><b>'+esc(a.markers[r.marker])+'</b><span>'+esc(a.administration(r)||r.note)+'</span>'+(a.medical?a.btn('edit','정정','data-id="'+esc(r.recordId)+'"'):'')+'</p>').join('')+'</div>';
  const quick=query('.ae-quick-entry');if(quick)dashboard.querySelector('.ad-quick').append(quick);
  dashboard.querySelectorAll('[data-ad-panel]').forEach(el=>el.hidden=el.dataset.adPanel!==tab);
  dashboard.querySelectorAll('[data-ar=entry-tab]').forEach(b=>b.addEventListener('click',e=>{e.stopImmediatePropagation();view.entryTab=b.dataset.key;dashboard.querySelectorAll('[data-ad-panel]').forEach(el=>el.hidden=el.dataset.adPanel!==view.entryTab);dashboard.querySelectorAll('[data-ar=entry-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));}));
  overview.querySelectorAll('[data-ad-series]').forEach(el=>el.onchange=()=>a.seriesChanged([...overview.querySelectorAll('[data-ad-series]:checked')].map(e=>e.dataset.adSeries)));
  overview.querySelector('[data-ar-overview]').onclick=e=>{const id=e.target.closest('[data-ar-point]')?.dataset.arPoint;if(id&&a.medical)a.edit(id);};
  // Configuration and history follow the working area; input widgets are never duplicated.
  if(setup)sheet.append(setup);
  const status=sheet.querySelector(':scope>p[role=status]');if(status)header?.firstElementChild?.append(status);header?.setAttribute('aria-label','현재 마취 환자');
 }
 const api={series,overviewGraph,arrange};if(typeof module==='object'&&module.exports)module.exports=api;else g.AnesthesiaDashboard=api;
})(typeof window==='undefined'?globalThis:window);
