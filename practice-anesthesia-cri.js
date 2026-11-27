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
 function strengthBody(name,value,record){const d=ingredients[name];if(!d)throw Error('성분을 확인해주세요.');const m=record?.body?.strength;
  if(record&&!stockOptions(name,[record]).length)throw Error('저장할 병원 약품을 다시 선택해주세요.');
  // Keep the registered concentration basis and species. Manual confirmation replaces old source/preparation metadata; a new record is dog/IV only.
  return {ingredientId:d.id,name:m?.name||d.name,english:m?.english||d.english,basis:m?.calculationBasis||name,
   aliases:m?.aliases||[name,d.name],species:m?.species||['dog'],route:'injection',release:'standard',kind:'liquid',unit:'mg',value:positive(value,name+' 원액 농도',1000),
   injectionRoute:'IV',confirm:true,...(record?{revision:record.revision}:{} )};
 }
 function mount(b,panel,o){
  const species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]'),f=document.createElement('form');f.className='pt-card pt-special-calculator';f.dataset.calc='anesthesia-cri';
  f.innerHTML='<h3>BLK · TLK 진통 보조 CRI</h3><p>개 전용 · IV 유지 주입 · 기준 속도 <b>1 mL/kg/hr</b>. 초기 부하용량은 포함하지 않습니다.</p><label>참고 조합<select name="protocol"><option value="blk">BLK · Butorphanol + Lidocaine + Ketamine</option><option value="tlk">TLK · Tramadol + Lidocaine + Ketamine</option></select></label><p data-cri-basis class="pt-notice"></p><div class="pt-bar"><button type="button" data-cri-reload>병원 약품 다시 불러오기</button><span data-cri-load role="status">병원 약품 불러오는 중…</span></div><div data-cri-components></div><div class="pt-grid"><label>약물을 포함한 최종 부피 · mL<input name="volume" value="50" inputmode="decimal" required></label><label>사용할 희석액<input name="diluent" placeholder="제품별 적합성을 확인해 입력" maxlength="100" required></label></div><p class="pt-help">원액 농도는 실제 제품 라벨의 mg/mL를 입력하세요. Lidocaine은 정맥 투여에 적합한 epinephrine 없는 제품인지 확인하세요. 혼합 안정성·무균 조제·교체시간은 별도 확인이 필요합니다. 전용 펌프를 사용하고 총 수액량에 포함하세요. 혼합액 속도를 올리면 세 약물 용량이 모두 증가합니다.</p><button type="button" data-cri-reset>참고 용량 다시 적용</button><label class="pt-choice"><input type="checkbox" name="confirmed" required>환자·병용 약물·유지 용량·제품 농도·혼합 적합성을 확인했습니다.</label><button class="pt-primary">CRI 조제량 계산</button><output aria-live="polite"></output><div data-result-actions hidden></div><p><a data-cri-reference target="_blank" rel="noopener noreferrer">용량 근거 확인</a> · 확인 2026-11-27</p>';
  panel.querySelector('nav').after(f);f.hidden=true;
  const clear=()=>{f.querySelector('output').textContent='';f.querySelector('[data-result-actions]').hidden=true;};
  const states=new Map(Object.keys(ingredients).map(name=>[name,{value:'',dirty:false,record:null,options:[],message:''}]));
  let ready=false,canManage=false,saving=false,generation=0;
  const loadState=f.querySelector('[data-cri-load]');
  function invalidate(){clear();f.elements.confirmed.checked=false;}
  function renderStocks(){protocols[f.elements.protocol.value].drugs.forEach(([name],i)=>{
   const st=states.get(name),sel=f.elements['product'+i];sel.replaceChildren(new Option('직접 입력', ''));
   for(const x of st.options)sel.add(new Option(x.title+' · '+x.value+' mg/mL',x.id));sel.value=st.record?.id||'';
   f.elements['stock'+i].value=st.value;sel.disabled=saving||!ready;
   f.querySelector('[data-cri-save="'+i+'"]').disabled=saving||!ready||!canManage;
   f.querySelector('[data-cri-stock-state="'+i+'"]').textContent=st.message||(st.dirty?'직접 입력 · 병원 미저장':st.record?'병원 등록 약품 자동 연결 · '+st.record.body.title:st.options.length>1?'등록 농도가 여러 개입니다. 실제 제품을 선택해주세요.':'등록된 주사 농도 없음 · 제품 라벨을 확인해 입력 후 저장하세요.');
  });f.querySelector('[data-cri-reload]').disabled=saving;}
  function loaded(r){if(!o.guard())return;ready=true;canManage=!!r.canManage;generation++;
   for(const [name,st] of states){st.options=stockOptions(name,r.items);if(!st.dirty){const match=st.record?st.options.find(x=>x.id===st.record.id):st.options.length===1?st.options[0]:null;st.record=match?.record||null;st.value=match?.value??'';st.message='';}}
   loadState.textContent=canManage?'병원에 저장하면 다음 접속·다른 기기에서도 적용됩니다.':'병원 약품 연결 완료 · 저장은 약품 설정 권한이 필요합니다.';invalidate();renderStocks();
  }
  function failed(){ready=false;canManage=false;generation++;loadState.textContent='병원 약품 불러오기 실패 · 입력값은 유지됩니다. 다시 불러오기를 눌러주세요.';invalidate();renderStocks();}
  async function reload(){if(saving||!o.guard())return;const seq=++generation;loadState.textContent='병원 약품 불러오는 중…';try{const r=await o.fresh();if(o.guard()&&seq===generation){loaded(r);o.changed?.(r);}}catch{if(o.guard()&&seq===generation)failed();}}
  async function save(name){if(!o.guard()||!ready||!canManage||saving)return;const st=states.get(name),seq=generation,old=st.record,value=st.value;let body;
   try{body=strengthBody(name,value,old);}catch(e){st.message=e.message;renderStocks();return;}
   saving=true;st.message='병원 약품에 저장 중…';renderStocks();let sent=false;
   try{const fresh=await o.fresh();if(!o.guard())return;if(seq!==generation||value!==st.value)throw Error('입력이 변경되어 저장하지 않았습니다. 다시 확인해주세요.');if(!fresh.canManage)throw Error('병원 약품 저장 권한이 없습니다.');
    if(old){const latest=stockOptions(name,fresh.items).find(x=>x.id===old.id);if(!latest||latest.revision!==old.revision)throw Error('다른 화면에서 약품이 변경됐습니다. 다시 불러온 후 선택해주세요.');}
    sent=true;const response=await o.request('/practice/strengths',{method:'POST',body:JSON.stringify({items:[body]})});if(!o.guard())return;
    const result=response.results?.find(x=>x.ingredientId===ingredients[name].id);if(result?.status!=='saved')throw Error(result?.message||'저장 응답을 확인하지 못했습니다.');
    const r=await o.fresh();if(!o.guard())return;const saved=stockOptions(name,r.items).find(x=>x.id===result.id);if(!saved||saved.value!==body.value)throw Error('저장 결과를 확인하지 못했습니다.');
    const unchanged=value===st.value&&seq===generation;if(unchanged){st.dirty=false;st.record=saved.record;}loaded(r);o.changed?.(r);
    st.message=unchanged?'병원 약품에 저장했습니다. 다음 접속·다른 기기에서도 자동 연결됩니다.':'요청한 농도는 저장됐습니다. 이후 수정한 입력은 아직 저장되지 않았습니다.';
   }catch(e){if(o.guard())st.message=(sent?'저장 상태 확인 필요 · 다시 불러오기로 확인하세요. ':'')+e.message;}
   finally{saving=false;if(o.guard())renderStocks();}
  }
  function resetDoses(){const p=protocols[f.elements.protocol.value];generation++;f.querySelector('[data-cri-basis]').textContent=p.note;f.querySelector('[data-cri-reference]').href=references[f.elements.protocol.value];
   f.querySelector('[data-cri-components]').innerHTML=p.drugs.map(([name,dose,range],i)=>'<fieldset><legend>'+name+'</legend><label>병원 등록 주사제<select name="product'+i+'"></select></label><div class="pt-grid"><label>유지 용량 · mg/kg/hr<input name="dose'+i+'" value="'+dose+'" inputmode="decimal" required></label><label>실제 원액 농도 · mg/mL<input name="stock'+i+'" inputmode="decimal" required></label></div><div class="pt-bar"><button type="button" data-cri-save="'+i+'">병원 약품 농도로 저장</button><span class="pt-help" role="status" data-cri-stock-state="'+i+'"></span></div><p class="pt-help">'+(i===0&&f.elements.protocol.value==='tlk'?'연구 용량 1.3 mg/kg/hr':'참고 범위 '+range.join('–')+' mg/kg/hr')+(i>0?' · 기본값 '+(dose*1000/60).toFixed(0)+' μg/kg/min':'')+'</p></fieldset>').join('');
   p.drugs.forEach(([name],i)=>{f.elements['product'+i].onchange=()=>{const st=states.get(name),x=st.options.find(x=>x.id===f.elements['product'+i].value);st.record=x?.record||null;st.value=x?.value??'';st.dirty=!x;st.message='';generation++;invalidate();renderStocks();};f.querySelector('[data-cri-save="'+i+'"]').onclick=()=>save(name);});invalidate();renderStocks();
  }
  f.elements.protocol.onchange=resetDoses;f.querySelector('[data-cri-reset]').onclick=resetDoses;f.querySelector('[data-cri-reload]').onclick=reload;
  f.addEventListener('input',e=>{if(e.target.closest('[data-result-actions]'))return;clear();if(e.target.name!=='confirmed')f.elements.confirmed.checked=false;
   if(/^stock[0-2]$/.test(e.target.name)){const name=protocols[f.elements.protocol.value].drugs[+e.target.name.slice(-1)][0],st=states.get(name);st.value=e.target.value;st.dirty=true;st.message='직접 입력 · 병원 미저장';generation++;f.querySelector('[data-cri-stock-state="'+e.target.name.slice(-1)+'"]').textContent=st.message;}
  });
  f.onsubmit=e=>{e.preventDefault();clear();if(!o.guard())return;const out=f.querySelector('output');try{
   const wc=b.querySelector('[data-record-weight-confirm]');if(wc&&!wc.closest('label').hidden&&!wc.checked)throw Error('기록 체중을 먼저 확인해주세요.');
   if(!f.elements.confirmed.checked||!f.elements.diluent.value.trim())throw Error('처방과 제품·희석액 적합성을 확인해주세요.');
   const v={...Object.fromEntries(new FormData(f)),species:species.value,weight:weight.value},r=calculate(v),fmt=g.PracticeCalculators.display;
   const text=[protocols[v.protocol].title+' · 개 · 체중 '+r.weight+' kg','주입속도 '+fmt(r.rate)+' mL/hr (1 mL/kg/hr 고정 기준)','약물 포함 최종 부피 '+fmt(r.volume)+' mL',...r.rows.map(x=>x.name+': '+fmt(x.dose)+' mg/kg/hr · '+fmt(x.hourly)+' mg/hr\n원액 '+fmt(x.stock)+' mg/mL에서 '+fmt(x.stockML)+' mL ('+fmt(x.amount)+' mg) · 최종 '+fmt(x.concentration)+' mg/mL'+(x.changed?' · 참고 초기값에서 변경':'')+(x.outside?' · 문헌 범위 밖, 처방 재검토':'')),v.diluent.trim()+' '+fmt(r.diluentML)+' mL로 최종 부피까지 조제','계산상 소진 시간 '+fmt(r.hours)+'시간 (안정성·사용 가능 기간이 아님)',protocols[v.protocol].note,'초기 부하용량 별도 · 통증·진정·호흡·혈압·심전도 감시 · 수액 급속주입과 분리','출처 '+references[v.protocol]].join('\n');out.className='pt-output pt-pre';out.textContent=text;o.resultActions(f,text);
  }catch(e){out.className='pt-error';out.textContent=e.message;}};
  weight.addEventListener('input',invalidate);species.addEventListener('change',invalidate);b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))invalidate();});
  resetDoses();return {show(visible){f.hidden=!visible;},reset(){f.reset();for(const st of states.values()){st.dirty=false;st.message='';const x=st.options.find(x=>x.id===st.record?.id)||(st.options.length===1?st.options[0]:null);st.record=x?.record||null;st.value=x?.value??'';}resetDoses();},refresh:invalidate,loaded,failed};
 }
 const api={protocols,calculate,ingredients,stockOptions,strengthBody,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeAnesthesiaCRI=api;
})(typeof window==='undefined'?globalThis:window);
