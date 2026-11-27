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
 function mount(b,panel,o){
  const species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]'),f=document.createElement('form');f.className='pt-card pt-special-calculator';f.dataset.calc='anesthesia-cri';
  f.innerHTML='<h3>BLK · TLK 진통 보조 CRI</h3><p>개 전용 · IV 유지 주입 · 기준 속도 <b>1 mL/kg/hr</b>. 초기 부하용량은 포함하지 않습니다.</p><label>참고 조합<select name="protocol"><option value="blk">BLK · Butorphanol + Lidocaine + Ketamine</option><option value="tlk">TLK · Tramadol + Lidocaine + Ketamine</option></select></label><p data-cri-basis class="pt-notice"></p><div data-cri-components></div><div class="pt-grid"><label>약물을 포함한 최종 부피 · mL<input name="volume" value="50" inputmode="decimal" required></label><label>사용할 희석액<input name="diluent" placeholder="제품별 적합성을 확인해 입력" maxlength="100" required></label></div><p class="pt-help">원액 농도는 실제 제품 라벨의 mg/mL를 입력하세요. Lidocaine은 정맥 투여에 적합한 epinephrine 없는 제품인지 확인하세요. 혼합 안정성·무균 조제·교체시간은 별도 확인이 필요합니다. 전용 펌프를 사용하고 총 수액량에 포함하세요. 혼합액 속도를 올리면 세 약물 용량이 모두 증가합니다.</p><button type="button" data-cri-reset>참고 용량 다시 적용</button><label class="pt-choice"><input type="checkbox" name="confirmed" required>환자·병용 약물·유지 용량·제품 농도·혼합 적합성을 확인했습니다.</label><button class="pt-primary">CRI 조제량 계산</button><output aria-live="polite"></output><div data-result-actions hidden></div><p><a data-cri-reference target="_blank" rel="noopener noreferrer">용량 근거 확인</a> · 확인 2026-11-27</p>';
  panel.querySelector('nav').before(f);
  const clear=()=>{f.querySelector('output').textContent='';f.querySelector('[data-result-actions]').hidden=true;};
  function resetDoses(){const p=protocols[f.elements.protocol.value];f.querySelector('[data-cri-basis]').textContent=p.note;f.querySelector('[data-cri-reference]').href=references[f.elements.protocol.value];f.querySelector('[data-cri-components]').innerHTML=p.drugs.map(([name,dose,range],i)=>'<fieldset><legend>'+name+'</legend><div class="pt-grid"><label>유지 용량 · mg/kg/hr<input name="dose'+i+'" value="'+dose+'" inputmode="decimal" required></label><label>실제 원액 농도 · mg/mL<input name="stock'+i+'" inputmode="decimal" required></label></div><p class="pt-help">'+(i===0&&f.elements.protocol.value==='tlk'?'연구 용량 1.3 mg/kg/hr':'참고 범위 '+range.join('–')+' mg/kg/hr')+(i>0?' · 기본값 '+(dose*1000/60).toFixed(0)+' μg/kg/min':'')+'</p></fieldset>').join('');f.elements.confirmed.checked=false;clear();}
  f.elements.protocol.onchange=resetDoses;f.querySelector('[data-cri-reset]').onclick=resetDoses;
  f.addEventListener('input',e=>{if(e.target.closest('[data-result-actions]'))return;clear();if(e.target.name!=='confirmed')f.elements.confirmed.checked=false;});
  f.onsubmit=e=>{e.preventDefault();clear();if(!o.guard())return;const out=f.querySelector('output');try{
   const wc=b.querySelector('[data-record-weight-confirm]');if(wc&&!wc.closest('label').hidden&&!wc.checked)throw Error('기록 체중을 먼저 확인해주세요.');
   if(!f.elements.confirmed.checked||!f.elements.diluent.value.trim())throw Error('처방과 제품·희석액 적합성을 확인해주세요.');
   const v={...Object.fromEntries(new FormData(f)),species:species.value,weight:weight.value},r=calculate(v),fmt=g.PracticeCalculators.display;
   const text=[protocols[v.protocol].title+' · 개 · 체중 '+r.weight+' kg','주입속도 '+fmt(r.rate)+' mL/hr (1 mL/kg/hr 고정 기준)','약물 포함 최종 부피 '+fmt(r.volume)+' mL',...r.rows.map(x=>x.name+': '+fmt(x.dose)+' mg/kg/hr · '+fmt(x.hourly)+' mg/hr\n원액 '+fmt(x.stock)+' mg/mL에서 '+fmt(x.stockML)+' mL ('+fmt(x.amount)+' mg) · 최종 '+fmt(x.concentration)+' mg/mL'+(x.changed?' · 참고 초기값에서 변경':'')+(x.outside?' · 문헌 범위 밖, 처방 재검토':'')),v.diluent.trim()+' '+fmt(r.diluentML)+' mL로 최종 부피까지 조제','계산상 소진 시간 '+fmt(r.hours)+'시간 (안정성·사용 가능 기간이 아님)',protocols[v.protocol].note,'초기 부하용량 별도 · 통증·진정·호흡·혈압·심전도 감시 · 수액 급속주입과 분리','출처 '+references[v.protocol]].join('\n');out.className='pt-output pt-pre';out.textContent=text;o.resultActions(f,text);
  }catch(e){out.className='pt-error';out.textContent=e.message;}};
  const invalidate=()=>{clear();f.elements.confirmed.checked=false;};weight.addEventListener('input',invalidate);species.addEventListener('change',invalidate);b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))invalidate();});
  resetDoses();return {reset(){f.reset();resetDoses();},refresh:invalidate};
 }
 const api={protocols,calculate,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeAnesthesiaCRI=api;
})(typeof window==='undefined'?globalThis:window);
