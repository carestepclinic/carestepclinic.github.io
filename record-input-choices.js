/* Optional entry helpers. The original text fields remain the persistence contract. */
(function(g){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,l=v)=>'<option value="'+esc(v)+'">'+esc(l)+'</option>';
const write=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
const allowed=o=>!o.allowed||o.allowed();
function select(input,values,o={}){
 if(!input||input.dataset.recordChoiceBound)return;input.dataset.recordChoiceBound='1';
 const pick=document.createElement('select');pick.dataset.recordChoice='';pick.setAttribute('aria-label',o.label||'선택 또는 직접 입력');
 pick.innerHTML=option('','미입력 / 선택')+values.map(v=>option(v)).join('')+option('__custom','직접 입력');input.before(pick);input.removeAttribute('list');
 function sync(){pick.value=values.includes(input.value)?input.value:input.value?'__custom':'';input.hidden=pick.value!=='__custom';pick.disabled=input.disabled||!allowed(o);}
 pick.onchange=()=>{if(!allowed(o)){sync();return;}input.hidden=pick.value!=='__custom';if(pick.value==='__custom'){input.focus();return;}write(input,pick.value);};
 input.addEventListener('input',()=>{if(pick.value!=='__custom')sync();});sync();return pick;
}
function structured(input,specs,o={}){
 if(!input||input.dataset.recordChoiceBound)return;input.dataset.recordChoiceBound='1';
 const host=document.createElement('div');host.className='ric-panel';host.dataset.recordStructured=input.dataset.field||input.dataset.note;
 input.closest('label').before(host);input.closest('label').hidden=true;input.closest('label').dataset.recordOriginal='';
 host.innerHTML='<div class="ric-grid">'+specs.map((s,i)=>'<label>'+esc(s.label)+'<select data-ric-index="'+i+'">'+option('','미입력 / 선택')+s.values.map(v=>option(v)).join('')+'</select></label>').join('')+'</div><label>'+esc(o.memoLabel||'상세 메모')+'<textarea rows="2" data-ric-memo maxlength="'+(input.maxLength>0?input.maxLength:4000)+'"></textarea></label><small role="status"></small>';
 const memo=host.querySelector('textarea'),status=host.querySelector('small');let changing=false;
 function fill(){const seen=new Set(),rest=[];host.querySelectorAll('select').forEach(e=>e.value='');for(const line of input.value.split('\n')){const i=specs.findIndex(s=>line.startsWith(s.label+': ')&&s.values.includes(line.slice(s.label.length+2)));if(i>=0&&!seen.has(i)){host.querySelector('[data-ric-index="'+i+'"]').value=line.slice(specs[i].label.length+2);seen.add(i);}else rest.push(line);}memo.value=rest.join('\n');}
 function commit(){if(!allowed(o)){fill();return;}const lines=specs.map((s,i)=>{const v=host.querySelector('[data-ric-index="'+i+'"]').value;return v?s.label+': '+v:'';});const v=[...lines.filter(Boolean),memo.value].filter(Boolean).join('\n');if(input.maxLength>0&&v.length>input.maxLength){status.textContent='선택값과 메모가 입력 한도를 초과했습니다. 이번 변경은 반영되지 않았습니다.';fill();return;}status.textContent='';changing=true;write(input,v);changing=false;}
 host.querySelectorAll('select').forEach(el=>el.onchange=commit);memo.oninput=commit;input.addEventListener('input',()=>{if(!changing)fill();});fill();host.querySelectorAll('select,textarea').forEach(el=>el.disabled=!allowed(o));return host;
}
const etSizes=Array.from({length:13},(_,i)=>(3+i*.5).toFixed(1));
// Manufacturer sizing guides, verified 2026-11-12. Codes are not ET diameters.
const vgel={dog:['D3','D4','D5','D6'],cat:['C0','C1','C2','C3','C4','C5'],rabbit:['R1','R2','R3','R4','R5','R6']};
const sources={dog:'https://docsinnovent.com/wp-content/uploads/2022/03/D90036_DOG_web_RGB.pdf',cat:'https://docsinnovent.com/wp-content/uploads/2022/02/D90061_CAT-RABBIT_web_RGB.pdf',rabbit:'https://docsinnovent.com/wp-content/uploads/2022/02/D90061_CAT-RABBIT_web_RGB.pdf'};
function parseAirway(value){
 const et=/^(?:ET tube )?(\d+(?:\.\d+)?)\s*(?:mm)?(?:\s*(?:·\s*)?(cuffed|uncuffed))?$/i.exec(value.trim());
 if(et&&etSizes.includes(Number(et[1]).toFixed(1)))return {type:'et',size:Number(et[1]).toFixed(1),cuff:(et[2]||'').toLowerCase()};
 const vg=/^V-gel (개|고양이|토끼) ([DCR]\d)$/.exec(value);if(vg){const type={개:'dog',고양이:'cat',토끼:'rabbit'}[vg[1]];if(vgel[type].includes(vg[2]))return {type,size:vg[2],cuff:''};}
 return {type:value?'custom':'',size:'',cuff:''};
}
function airway(input,o={}){
 if(!input||input.dataset.recordChoiceBound)return;input.dataset.recordChoiceBound='1';const host=document.createElement('div');host.className='ric-airway';const parent=input.closest('label');parent.dataset.recordOriginal='';parent.before(host);input.setAttribute('aria-label','기도 기구 직접 입력');
 const names={et:'ET tube',dog:'V-gel · 개',cat:'V-gel · 고양이',rabbit:'V-gel · 토끼'};
 const species={개:'dog',강아지:'dog',고양이:'cat',토끼:'rabbit'}[o.species]||o.species;const kinds=['et',...Object.keys(vgel).filter(s=>!species||s===species),'custom'];
 host.innerHTML='<label>기도 기구<select data-airway-type>'+option('','선택')+kinds.map(k=>option(k,names[k]||'직접 입력')).join('')+'</select></label><label data-airway-size-label>규격<select data-airway-size></select></label><label data-airway-cuff-label>커프<select data-airway-cuff>'+option('','미기록')+option('cuffed','있음 · Cuffed')+option('uncuffed','없음 · Uncuffed')+'</select></label><small data-airway-source></small>';
 const type=host.querySelector('[data-airway-type]'),size=host.querySelector('[data-airway-size]'),cuff=host.querySelector('[data-airway-cuff]'),source=host.querySelector('small');let changing=false;
 function paint(p){type.value=kinds.includes(p.type)?p.type:'custom';size.innerHTML=option('','규격 선택')+(type.value==='et'?etSizes:vgel[type.value]||[]).map(s=>option(s,type.value==='et'?s+' mm':s)).join('');size.value=p.size;size.required=!!type.value&&type.value!=='custom';cuff.value=p.cuff;host.querySelector('[data-airway-size-label]').hidden=!size.required;host.querySelector('[data-airway-cuff-label]').hidden=type.value!=='et';input.hidden=type.value!=='custom';parent.hidden=input.hidden;source.innerHTML=vgel[type.value]?'<a href="'+sources[type.value]+'" target="_blank" rel="noopener">공식 규격표</a> · 실제 사용 규격 선택 · 2026-11-12 확인':'';host.querySelectorAll('select').forEach(e=>e.disabled=input.disabled||!allowed(o));}
 function commit(){if(!allowed(o))return;let v='';if(type.value==='et'&&size.value)v='ET tube '+size.value+' mm'+(cuff.value?' · '+cuff.value:'');else if(vgel[type.value]&&size.value)v='V-gel '+({dog:'개',cat:'고양이',rabbit:'토끼'}[type.value])+' '+size.value;else if(type.value==='custom')v=input.value;changing=true;write(input,v);changing=false;}
 type.onchange=()=>{const t=type.value;paint({type:t,size:'',cuff:''});commit();if(t==='custom')input.focus();};size.onchange=cuff.onchange=commit;input.addEventListener('input',()=>{if(!changing&&type.value!=='custom')paint(parseAirway(input.value));});paint(parseAirway(input.value));return host;
}
function appendChoices(input,values,o={}){
 if(!input||input.dataset.recordAppendBound)return;input.dataset.recordAppendBound='1';const host=document.createElement('details');host.className='ric-panel';host.dataset.recordAppend=input.dataset.note;input.closest('label').before(host);
 host.innerHTML='<summary>'+esc(o.label||'자주 쓰는 항목 선택')+'</summary><div class="ric-checks">'+values.map(v=>'<label><input type="checkbox" value="'+esc(v)+'">'+esc(v)+'</label>').join('')+'</div><button type="button">선택 항목 추가</button><small role="status"></small>';
 host.querySelector('button').onclick=()=>{if(!allowed(o))return;const lines=input.value.split('\n'),selected=[...host.querySelectorAll('input:checked')].map(e=>e.value),fresh=selected.filter(s=>!lines.some(l=>l.trim()===s));const value=[input.value,...fresh].filter(Boolean).join('\n');if(input.maxLength>0&&value.length>input.maxLength){host.querySelector('small').textContent='입력 한도를 초과합니다. 메모를 정리해주세요.';return;}if(fresh.length)write(input,value);host.querySelector('small').textContent=fresh.length?'선택 항목을 추가했습니다.':selected.length?'이미 입력된 항목입니다.':'추가할 항목을 선택해주세요.';host.querySelectorAll('input').forEach(e=>e.checked=false);};host.querySelectorAll('input,button').forEach(e=>e.disabled=!allowed(o));
}
function neuro(root,o){structured(root.querySelector('[data-field=history]'),[{label:'증상 시작',values:['오늘','1–3일 전','4–7일 전','1–4주 전','1개월 이상','모름']},{label:'발병 양상',values:['갑작스러운 시작','점진적인 시작','판단 어려움']},{label:'증상 경과',values:['호전','변화 없음','악화','반복·간헐적','판단 어려움']}],{...o,memoLabel:'주증상·정확한 발병 시점·상세 경과'});}
function dental(root,o){appendChoices(root.querySelector('[data-note=procedure]'),['치석 제거','치면 연마','구강 세척','치과 방사선 촬영'],{...o,label:'시행한 공통 처치 선택'});appendChoices(root.querySelector('[data-note=homecare]'),['칫솔질 방법 안내','식이·급여 방법 안내','구강 관리 제품 사용법 안내','구강 상태 관찰·연락 기준 안내'],{...o,label:'시행한 홈케어 안내 선택'});}
function ophthalmic(root,o){
 for(const row of root.querySelectorAll('.er-rx')){
  select(row.querySelector('[data-rx$=".frequency"]'),['하루 1회','하루 2회','하루 3회','하루 4회','4시간마다','6시간마다','8시간마다','12시간마다'],{...o,label:'횟수·간격'});
  select(row.querySelector('[data-rx$=".duration"]'),['3일','5일','7일','14일','28일','재검일까지'],{...o,label:'기간'});
  select(row.querySelector('[data-rx$=".amount"]'),['1방울','2방울'],{...o,label:'1회량 · 점안액 방울 수 / 연고 등 직접 입력'});
  const input=row.querySelector('[data-rx$=".name"]');if(!input||input.dataset.drugPicker)return;input.dataset.drugPicker='1';
  const box=document.createElement('details');box.className='ric-drugs';const wrapper=document.createElement('div');wrapper.className='ric-drug-name';const label=input.closest('label');label.before(wrapper);wrapper.append(label,box);box.innerHTML='<summary>병원 약품에서 선택</summary><label>약품 검색<input type="search" data-drug-query placeholder="약물·제품명"></label><label>저장된 약품<select data-drug-pick>'+option('','약품 선택')+'</select></label><small role="status"></small>';
  let list=[],busy=false,loaded=false;const query=box.querySelector('input'),pick=box.querySelector('select'),status=box.querySelector('small');
  function menu(){const q=query.value.trim().toLowerCase();pick.innerHTML=option('','약품 선택')+list.filter(x=>(x.label+' '+x.aliases).toLowerCase().includes(q)).map((x)=>option(x.id,x.label)).join('');}
  box.ontoggle=async()=>{if(!box.open||loaded||busy||!allowed(o))return;busy=true;status.textContent='병원 약품 조회 중…';try{const items=await o.drugs();if(!box.isConnected||!o.alive())return;list=items.map((x,i)=>({id:String(i),label:x.body?.title||'',aliases:JSON.stringify(x.body?.aliases||[])})).filter(x=>x.label);loaded=true;menu();status.textContent=list.length?'약물명만 반영합니다. 적용 눈·제형·1회량을 확인해주세요.':'저장된 약품 없음 · 약물명 직접 입력';}catch{if(box.isConnected)status.textContent='조회 실패 · 직접 입력 가능 · 다시 펼치면 재시도';}finally{busy=false;}};
  query.oninput=menu;pick.onchange=()=>{if(!allowed(o)||pick.value==='')return;const found=list.find(x=>x.id===pick.value);if(found){if(input.maxLength>0&&found.label.length>input.maxLength){status.textContent='제품명이 길어 자동 입력할 수 없습니다. 약물명을 직접 입력해주세요.';return;}write(input,found.label);box.open=false;}};box.querySelectorAll('input,select').forEach(el=>el.disabled=!allowed(o));
 }
}
g.RecordInputChoices={select,structured,airway,parseAirway,etSizes,vgel,neuro,dental,ophthalmic};
})(typeof window==='undefined'?globalThis:window);
