/* Canine maintenance CRI. References are not patient-specific prescriptions. */
(function(g){
 'use strict';
 const references={blk:'https://www.canadianveterinarians.net/media/hhlgn5sl/constant-rate-infusions-2023.pdf',tlk:'https://doi.org/10.1590/S0100-736X2017001000015'};
 const protocols={
  blk:{title:'BLK · 낮은 참고 용량',note:'각 성분의 참고 범위 하단을 조합한 예시입니다. 검증된 고정 BLK 표준 처방은 아닙니다. Butorphanol은 진통 천장효과가 있어 큰 수술의 단독 진통으로 간주하지 않습니다.',drugs:[['Butorphanol',.1,[.1,.2]],['Lidocaine',1.5,[1.5,3]],['Ketamine',.12,[.12,.6]]]},
  tlk:{title:'TLK · 수술 중 연구 용량',note:'건강한 개의 난소자궁절제술 중 sevoflurane 요구량 연구 용량입니다. 수술 후 장시간 진통의 일률적인 권장 처방은 아닙니다. 원 연구의 10 mL/kg/hr를 같은 약물 투여량의 1 mL/kg/hr로 환산합니다.',drugs:[['Tramadol',1.3,[1.3,1.3]],['Lidocaine',3,[1.5,3]],['Ketamine',.6,[.12,.6]]]}
 };
 function positive(value,label,max=1e6){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(value??'').trim())||!Number.isFinite(+value)||+value<=0||+value>max)throw Error(label+'의 수치와 단위를 확인해주세요.');return +value;}
 function calculate(v){
  if(v.species!=='dog')throw Error('BLK·TLK 참고 용량은 개 전용입니다. 고양이에게 적용하지 않습니다.');
  const p=protocols[v.protocol];if(!p)throw Error('BLK 또는 TLK를 선택해주세요.');
  const weight=positive(v.weight,'체중',200),volume=positive(v.volume,'최종 부피',10000),rate=weight,rows=p.drugs.map(([name,reference,range],i)=>{
   const dose=positive(v['dose'+i],name+' 용량',100),stock=positive(v['stock'+i],name+' 원액 농도',1000),amount=dose*volume;
   return {name,dose,stock,amount,stockML:amount/stock,concentration:dose,hourly:dose*weight,changed:dose!==reference,outside:dose<range[0]||dose>range[1]};
  }),stockML=rows.reduce((n,r)=>n+r.stockML,0);
  if(stockML>=volume)throw Error('원액 총량이 최종 부피 이상입니다. 원액 농도와 최종 부피를 다시 확인해주세요.');
  return {rows,weight,volume,rate,stockML,diluentML:volume-stockML,hours:volume/rate};
 }
 // Canonical single-ingredient records; combination/local anesthetic products are excluded.
 const ingredients={
  Butorphanol:{id:'mfds-e176f45811b755eb29fc',name:'부토르파놀타르타르산염',english:'Butorphanol Tartrate'},
  Lidocaine:{id:'manual-5156be2eadcb080c8749',name:'리도카인',english:'Lidocaine'},
  Ketamine:{id:'mfds-367581e5934d0c20440e',name:'케타민',english:'Ketamine Hydrochloride'},
  Tramadol:{id:'mfds-1f1cb591fbd23d97a35e',name:'트라마돌염산염',english:'Tramadol Hydrochloride'}
 };
 function stockOptions(name,items){const d=ingredients[name];if(!d)return [];return (items||[]).filter(p=>{
  const m=p.body?.strength,b=p.body;if(!m||p.formularyIssue||m.ingredientId!==d.id||m.route!=='injection'||m.release!=='standard'||!m.species?.includes('dog')||b.kind!=='liquid'||!['mg','mcg'].includes(b.unit))return false;
  if((m.injectionRoute&&m.injectionRoute!=='IV')||(m.preparation?.injectionRoute&&m.preparation.injectionRoute!=='IV'))return false;
  if(/epinephrine|adrenaline|에피네프린|아드레날린|combination/i.test([b.title,m.english,...(m.aliases||[])].join(' ')))return false;
  const n=Number(b.value)*(b.unit==='mcg'?.001:1);return Number.isFinite(n)&&n>0&&n<=1000;
 }).map(p=>({record:p,id:p.id,value:Number(p.body.value)*(p.body.unit==='mcg'?.001:1),title:p.body.title,revision:p.revision}));}
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function strengthBody(name,value,record){const d=ingredients[name];if(!d)throw Error('성분을 확인해주세요.');const m=record?.body?.strength,n=positive(value,name+' 원액 농도',1000);
  if(record&&!stockOptions(name,[record]).length)throw Error('저장할 병원 약품을 다시 선택해주세요.');
  const unit=record?.body.unit||'mg',storedValue=n*(unit==='mcg'?1000:1);
  if(m?.preparation&&Math.abs(Number(m.preparation.vialAmount)/Number(m.preparation.finalVolume)-storedValue)>Math.max(1e-8,storedValue*1e-9))throw Error(name+'은 조제정보가 등록돼 있습니다. 병원 약품 설정에서 바이알 함량·최종 부피와 함께 변경해주세요. 현재 조제정보는 유지됩니다.');
  return {ingredientId:d.id,name:m?.name||d.name,english:m?.english||d.english,basis:m?.calculationBasis||name,
   aliases:m?.aliases||[name,d.name],species:m?.species||['dog'],route:'injection',release:'standard',kind:'liquid',unit,value:storedValue,confirm:true,
   ...(record?{revision:record.revision,...(m.sourceUrl?{sourceUrl:m.sourceUrl,checkedAt:m.checkedAt}:{}),...(m.preparation?{preparation:{...m.preparation}}:{}),...(m.injectionRoute!==undefined?{injectionRoute:m.injectionRoute}:{})}:{injectionRoute:'IV'})};
 }
 function changedStock(name,value,record){const n=positive(value,name+' 원액 농도',1000),old=record&&stockOptions(name,[record])[0];return !old||n!==old.value;}
 function makeDrafts(){return Object.fromEntries(Object.entries(protocols).map(([id,p])=>[id,{doses:p.drugs.map(x=>String(x[1])),volume:'50',diluent:''}]));}
 function mount(b,panel,o){
  const species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]'),f=document.createElement('form');f.className='pt-card pt-special-calculator';f.dataset.calc='anesthesia-cri';
  f.innerHTML='<h3>BLK · TLK 진통 보조 CRI</h3><p>개 전용 · IV 유지 주입 · 기준 속도 <b>1 mL/kg/hr</b>. 초기 부하용량은 포함하지 않습니다.</p><label>참고 조합<select name="protocol"><option value="blk">BLK · Butorphanol + Lidocaine + Ketamine</option><option value="tlk">TLK · Tramadol + Lidocaine + Ketamine</option></select></label><p data-cri-basis class="pt-notice"></p><div class="pt-bar"><button type="button" data-cri-reload>약품 목록 새로고침</button><span data-cri-load role="status">병원 약품 불러오는 중…</span></div><div data-cri-components></div><div class="pt-cri-save-bar"><button type="button" data-cri-save-all>변경한 농도 저장</button><span data-cri-save-summary role="status"></span><p class="pt-help">저장하면 병원 공통 약품 농도가 변경되어 다른 계산기·기기에도 적용됩니다. 환자별 유지 용량은 저장하지 않습니다.</p></div><div class="pt-grid"><label>약물을 포함한 최종 부피 · mL<input name="volume" value="50" inputmode="decimal" required></label><label>사용할 희석액<input name="diluent" placeholder="제품별 적합성을 확인해 입력" maxlength="100" required></label></div><p class="pt-help">원액 농도는 실제 제품 라벨의 mg/mL를 입력하세요. Lidocaine은 정맥 투여에 적합한 epinephrine 없는 제품인지 확인하세요. 혼합 안정성·무균 조제·교체시간은 별도 확인이 필요합니다. 전용 펌프를 사용하고 총 수액량에 포함하세요. 혼합액 속도를 올리면 세 약물 용량이 모두 증가합니다.</p><button type="button" data-cri-reset>참고 용량 다시 적용</button><label class="pt-choice"><input type="checkbox" name="confirmed" required>환자·병용 약물·유지 용량·제품 농도·혼합 적합성을 확인했습니다.</label><button class="pt-primary">CRI 조제량 계산</button><output aria-live="polite"></output><div data-result-actions hidden></div><p><a data-cri-reference target="_blank" rel="noopener noreferrer">용량 근거 확인</a> · 확인 2026-11-27</p>';
  panel.querySelector('nav').after(f);f.hidden=true;
  const clear=()=>{f.querySelector('output').textContent='';f.querySelector('[data-result-actions]').hidden=true;};
  const states=new Map(Object.keys(ingredients).map(name=>[name,{value:'',dirty:false,record:null,options:[],message:''}]));
  let ready=false,canManage=false,saving=false,generation=0,drafts=makeDrafts(),active='blk';
  const loadState=f.querySelector('[data-cri-load]'),saveSummary=f.querySelector('[data-cri-save-summary]');
  function invalidate(){clear();f.elements.confirmed.checked=false;}
  const needsSave=(name,st)=>{try{return presentStock(st.value)&&changedStock(name,st.value,st.record);}catch{return st.dirty;}};
  const presentStock=v=>String(v??'').trim()!=='';
  function renderStocks(){protocols[active].drugs.forEach(([name],i)=>{
   const st=states.get(name),sel=f.elements['product'+i];sel.replaceChildren(new Option('직접 입력', ''));
   for(const x of st.options)sel.add(new Option(x.title+' · '+x.value+' mg/mL',x.id));sel.value=st.record?.id||'';
   if(f.elements['stock'+i].value!==String(st.value))f.elements['stock'+i].value=st.value;f.elements['stock'+i].disabled=saving;sel.disabled=saving||!ready;
   const changed=needsSave(name,st);f.querySelector('[data-cri-restore="'+i+'"]').disabled=saving||!ready||!st.options.length;
   f.querySelector('[data-cri-stock-state="'+i+'"]').textContent=st.message||(changed?'미저장 농도 · 이번 계산에만 적용':st.record?'병원 저장값 연결 · '+st.record.body.title:st.options.length>1?'등록 농도가 여러 개입니다. 실제 제품을 선택해주세요.':'조건에 맞는 등록 주사 농도 없음 · 실제 제품 라벨을 확인해 입력하세요.');
  });
   const names=[...states].filter(([name,st])=>needsSave(name,st)).map(([name])=>name),save=f.querySelector('[data-cri-save-all]');save.textContent='변경한 농도 '+names.length+'개 저장';save.disabled=saving||!ready||!canManage||!names.length;
   saveSummary.textContent=names.length?'미저장: '+names.join(', '):'농도 변경사항 없음';f.querySelector('[data-cri-reload]').disabled=saving;f.elements.protocol.disabled=saving;f.querySelector('button.pt-primary').disabled=saving;
  }
  function loaded(r){if(!o.guard())return;ready=true;canManage=!!r.canManage;generation++;
   for(const [name,st] of states){st.options=stockOptions(name,r.items);if(!st.dirty){const match=st.record?st.options.find(x=>x.id===st.record.id):st.options.length===1?st.options[0]:null;st.record=match?.record||null;st.value=match?.value??'';st.message='';}}
   loadState.textContent=canManage?'목록 새로고침은 직접 입력한 농도를 유지합니다. 되돌리려면 병원 저장값 적용을 누르세요.':'병원 약품 연결 완료 · 저장은 약품 설정 권한이 필요합니다.';invalidate();renderStocks();
  }
  function failed(){ready=false;canManage=false;generation++;loadState.textContent='약품 목록 불러오기 실패 · 입력값 유지 · 목록 새로고침으로 재시도하세요.';invalidate();renderStocks();}
  async function reload(){if(saving||!o.guard())return;const seq=++generation;loadState.textContent='병원 약품 불러오는 중…';try{const r=await o.fresh();if(o.guard()&&seq===generation){loaded(r);o.changed?.(r);}}catch{if(o.guard()&&seq===generation)failed();}}
  async function saveAll(){if(!o.guard()||!ready||!canManage||saving)return;const seq=generation,entries=[];
   try{for(const [name,st] of states){if(!needsSave(name,st))continue;entries.push({name,st,value:st.value,old:st.record,body:strengthBody(name,st.value,st.record)});}}catch(e){loadState.textContent=e.message;return;}
   if(!entries.length){loadState.textContent='같은 농도입니다. 다시 저장하지 않았습니다.';return;}
   saving=true;loadState.textContent='변경한 병원 공통 농도 저장 중…';renderStocks();let sent=false;
   try{const fresh=await o.fresh();if(!o.guard())return;if(seq!==generation)throw Error('입력이 변경되어 저장하지 않았습니다. 다시 확인해주세요.');if(!fresh.canManage)throw Error('병원 약품 저장 권한이 없습니다.');
    for(const e of entries){if(e.old){const latest=stockOptions(e.name,fresh.items).find(x=>x.id===e.old.id);if(!latest||latest.revision!==e.old.revision)throw Error(e.name+'이 다른 화면에서 변경됐습니다. 목록 새로고침 후 병원 저장값을 적용해주세요.');}}
    sent=true;const response=await o.request('/practice/strengths',{method:'POST',body:JSON.stringify({items:entries.map(e=>e.body)})});if(!o.guard())return;
    const r=await o.fresh();if(!o.guard())return;let count=0;const messages=[];
    for(const e of entries){const result=response.results?.find(x=>x.ingredientId===ingredients[e.name].id),saved=stockOptions(e.name,r.items).find(x=>x.id===result?.id);
     if(result?.status==='saved'&&saved&&saved.value===Number(e.value)){count++;if(e.st.value===e.value){e.st.dirty=false;e.st.record=saved.record;}messages.push([e,'병원 공통 농도로 저장했습니다.']);}
     else messages.push([e,(result?.message||'저장 결과 확인 필요 · 목록 새로고침으로 확인하세요.')+' · 현재 입력 유지']);
    }
    loaded(r);o.changed?.(r);for(const [e,message] of messages)e.st.message=message;loadState.textContent=count+' / '+entries.length+'개 저장 확인'+(count<entries.length?' · 나머지 약물의 안내를 확인해주세요.':' · 다음 접속·다른 기기에 적용됩니다.');
   }catch(e){if(o.guard())loadState.textContent=(sent?'저장 상태 확인 필요 · 목록 새로고침 후 확인하세요. ':'')+e.message;}
   finally{saving=false;if(o.guard())renderStocks();}
  }
  function renderProtocol(){const p=protocols[active],draft=drafts[active];generation++;f.querySelector('[data-cri-basis]').textContent=p.note;f.querySelector('[data-cri-reference]').href=references[active];
   f.querySelector('[data-cri-components]').innerHTML=p.drugs.map(([name,dose,range],i)=>'<fieldset><legend>'+name+'</legend><label>병원 등록 주사제<select name="product'+i+'"></select></label><div class="pt-grid"><label>유지 용량 · mg/kg/hr<input name="dose'+i+'" inputmode="decimal" required></label><label>실제 원액 농도 · mg/mL<input name="stock'+i+'" inputmode="decimal" required></label></div><div class="pt-bar"><span class="pt-help" role="status" data-cri-stock-state="'+i+'"></span><button type="button" data-cri-restore="'+i+'">병원 저장값 적용</button></div><p class="pt-help">'+(i===0&&active==='tlk'?'연구 용량 1.3 mg/kg/hr':'참고 범위 '+range.join('–')+' mg/kg/hr')+(i>0?' · 기본값 '+(dose*1000/60).toFixed(0)+' μg/kg/min':'')+'</p></fieldset>').join('');
   p.drugs.forEach(([name],i)=>{f.elements['dose'+i].value=draft.doses[i];f.elements['product'+i].onchange=()=>{const st=states.get(name),x=st.options.find(x=>x.id===f.elements['product'+i].value);st.record=x?.record||null;st.value=x?.value??'';st.dirty=!x;st.message='';generation++;invalidate();renderStocks();};f.querySelector('[data-cri-restore="'+i+'"]').onclick=()=>{const st=states.get(name),x=st.options.find(x=>x.id===st.record?.id)||(st.options.length===1?st.options[0]:null);if(!x){st.message='등록 주사제 목록에서 사용할 제품을 선택해주세요.';renderStocks();return;}st.record=x.record;st.value=x.value;st.dirty=false;st.message='병원 저장값을 적용했습니다.';generation++;invalidate();renderStocks();};});
   f.elements.volume.value=draft.volume;f.elements.diluent.value=draft.diluent;invalidate();renderStocks();
  }
  f.elements.protocol.onchange=()=>{active=f.elements.protocol.value;renderProtocol();};f.querySelector('[data-cri-reset]').onclick=()=>{drafts[active].doses=protocols[active].drugs.map(x=>String(x[1]));renderProtocol();};f.querySelector('[data-cri-reload]').onclick=reload;f.querySelector('[data-cri-save-all]').onclick=saveAll;
  f.addEventListener('input',e=>{if(e.target.closest('[data-result-actions]'))return;clear();if(e.target.name!=='confirmed')f.elements.confirmed.checked=false;
   if(/^dose[0-2]$/.test(e.target.name))drafts[active].doses[+e.target.name.slice(-1)]=e.target.value;
   if(['volume','diluent'].includes(e.target.name))drafts[active][e.target.name]=e.target.value;
   if(/^stock[0-2]$/.test(e.target.name)){const name=protocols[active].drugs[+e.target.name.slice(-1)][0],st=states.get(name);st.value=e.target.value;st.dirty=true;st.message='';generation++;renderStocks();}
  });
  f.onsubmit=e=>{e.preventDefault();clear();if(!o.guard())return;const out=f.querySelector('output');try{
   const wc=b.querySelector('[data-record-weight-confirm]');if(wc&&!wc.closest('label').hidden&&!wc.checked)throw Error('기록 체중을 먼저 확인해주세요.');
   if(!f.elements.confirmed.checked||!f.elements.diluent.value.trim())throw Error('처방과 제품·희석액 적합성을 확인해주세요.');
   const v={...Object.fromEntries(new FormData(f)),species:species.value,weight:weight.value},r=calculate(v),fmt=g.PracticeCalculators.display;
   const text=[protocols[v.protocol].title+' · 개 · 체중 '+r.weight+' kg','주입속도 '+fmt(r.rate)+' mL/hr (1 mL/kg/hr 고정 기준)','약물 포함 최종 부피 '+fmt(r.volume)+' mL',...r.rows.map(x=>x.name+': '+fmt(x.dose)+' mg/kg/hr · '+fmt(x.hourly)+' mg/hr\n원액 '+fmt(x.stock)+' mg/mL에서 '+fmt(x.stockML)+' mL ('+fmt(x.amount)+' mg) · 최종 '+fmt(x.concentration)+' mg/mL'+(x.changed?' · 참고 초기값에서 변경':'')+(x.outside?' · 문헌 범위 밖, 처방 재검토':'')),v.diluent.trim()+' '+fmt(r.diluentML)+' mL로 최종 부피까지 조제','계산상 소진 시간 '+fmt(r.hours)+'시간 (안정성·사용 가능 기간이 아님)',protocols[v.protocol].note,'초기 부하용량 별도 · 통증·진정·호흡·혈압·심전도 감시 · 수액 급속주입과 분리','출처 '+references[v.protocol]].join('\n');out.className='pt-output pt-result-tables';out.innerHTML='<div class="pt-result-summary"><div><span>펌프 주입속도</span><strong>'+esc(fmt(r.rate))+' mL/hr</strong><small>1 mL/kg/hr · '+esc(r.weight)+' kg</small></div><div><span>약물 포함 최종 부피</span><strong>'+esc(fmt(r.volume))+' mL</strong><small>'+esc(v.diluent.trim())+' '+esc(fmt(r.diluentML))+' mL + 약물</small></div></div><div class="pt-table-scroll"><table><caption>CRI 조제량</caption><thead><tr><th scope="col">약물</th><th scope="col">유지 용량<br>mg/kg/hr</th><th scope="col">원액 농도<br>mg/mL</th><th scope="col">넣을 원액량<br>mL</th></tr></thead><tbody>'+r.rows.map(x=>'<tr><th scope="row">'+esc(x.name)+'</th><td data-label="유지 용량 · mg/kg/hr">'+esc(fmt(x.dose))+'</td><td data-label="원액 농도 · mg/mL">'+esc(fmt(x.stock))+'</td><td data-label="넣을 원액량 · mL"><strong>'+esc(fmt(x.stockML))+'</strong></td></tr>').join('')+'</tbody></table></div>'+r.rows.filter(x=>x.changed||x.outside).map(x=>'<p class="'+(x.outside?'pt-error':'pt-help')+'">'+esc(x.name)+(x.outside?' · 문헌 범위 밖, 처방 재검토':' · 참고 초기값에서 변경')+'</p>').join('')+'<p>'+esc(v.diluent.trim())+' '+esc(fmt(r.diluentML))+' mL로 약물을 포함한 최종 '+esc(fmt(r.volume))+' mL를 맞추세요.</p><p class="pt-help">계산상 소진 '+esc(fmt(r.hours))+'시간 · 안정성·사용 가능 기간이 아닙니다.</p><details><summary>투여량 상세·적용 근거</summary><div class="pt-pre">'+esc(text)+'</div></details>';o.resultActions(f,text);
  }catch(e){out.className='pt-error';out.textContent=e.message;}};
  weight.addEventListener('input',invalidate);species.addEventListener('change',invalidate);b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))invalidate();});
  renderProtocol();return {show(visible){f.hidden=!visible;},reset(){f.reset();drafts=makeDrafts();active='blk';for(const st of states.values()){st.dirty=false;st.message='';const x=st.options.find(x=>x.id===st.record?.id)||(st.options.length===1?st.options[0]:null);st.record=x?.record||null;st.value=x?.value??'';}renderProtocol();},refresh:invalidate,loaded,failed};
 }
 const api={protocols,calculate,ingredients,stockOptions,strengthBody,changedStock,makeDrafts,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeAnesthesiaCRI=api;
})(typeof window==='undefined'?globalThis:window);
