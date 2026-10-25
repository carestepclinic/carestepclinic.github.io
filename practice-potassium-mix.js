/* KCl preparation from an explicitly selected prescription; no serum-based prescribing. */
(function(g){
 'use strict';
 function mount(b,o){
  const f=b.querySelector('[data-calc=potassium]');if(!f)return null;
  const c=g.PracticeCalculators,box=document.createElement('section');box.className='pt-potassium-mix';
  box.innerHTML=`<label>계산 기준<select name="kMethod"><option value="mix">KCl 첨가량과 총 주입량 계산</option><option value="direct">이미 조제한 최종 총 K 농도 직접 입력</option></select></label>
  <div data-k-preparation><details open><summary class="pt-summary">혈중 칼륨별 참고 농도</summary><p class="pt-help">유지 수액에 추가하는 KCl 참고표입니다. 검사값만으로 처방을 결정하지 않습니다. 실제 주입속도·기본 수액의 K·신장기능·소변량을 함께 확인하세요. 경계·중간값은 의료진이 판단합니다.</p><div class="pt-table-scroll"><table><thead><tr><th>혈중 K · mEq/L</th><th>수액 1L당 추가 KCl</th><th>현재 수액·원액 기준<br>첨가량 · mL</th></tr></thead><tbody><tr><td>2.0 미만</td><td>80 mEq/L</td></tr><tr><td>2.1–2.5</td><td>60 mEq/L</td></tr><tr><td>2.6–3.0</td><td>40 mEq/L</td></tr><tr><td>3.1–3.5</td><td>25–30 mEq/L</td></tr><tr><td>3.6–5.0</td><td>20 mEq/L</td></tr><tr><td>5.0 초과</td><td>추가 없음</td></tr></tbody></table></div><a href="https://www.merckvetmanual.com/multimedia/table/guideline-for-potassium-supplementation-in-dogs-and-cats" target="_blank" rel="noopener noreferrer">MSD 참고표</a><p class="pt-help">AAHA 2024의 별도 농도표는 특정 수액속도(60 mL/kg/일)를 전제로 하므로 이 표와 혼용하지 않습니다. 모든 정맥 라인을 합산해 0.5 mEq/kg/hr 초과 여부를 계산합니다.</p></details>
  <div class="pt-grid"><label>추가할 K 농도 · mEq/L<input name="added" inputmode="decimal" required placeholder="한 백의 총 mEq가 아닌 L당 농도"></label><label>기본 수액량 · mL<input name="bag" value="500" inputmode="decimal" required></label><label>KCl 원액 농도 · mEq/mL<input name="kstock" value="2" inputmode="decimal" required></label><label>기본 수액의 K · mEq/L<input name="baseK" value="0" inputmode="decimal" required><span class="pt-help">N/S 0 · 균형 수액은 제품 라벨의 K 농도 입력</span></label><label class="pt-span">첨가 방식<select name="mixMode"><option value="add">기본 수액에 그대로 첨가 · 최종 부피 증가</option><option value="final">원액 부피만큼 수액을 빼고 최종 부피 유지</option></select></label></div>
  <div class="pt-bar" data-k-shortcuts aria-label="추가 농도 선택"></div><p data-k-preview role="status" class="pt-note">추가 농도를 선택하면 필요한 KCl 원액량을 표시합니다.</p><p class="pt-help">추가량 = 선택 농도 × 기본 수액량(L) ÷ 원액 농도. 원액을 바로 정맥 주사하지 마세요. 첨가 후 충분히 혼합합니다.</p></div>`;
  f.querySelector('h3').after(box);f.querySelector('h3').textContent='칼륨 첨가량·총 주입량';
  const oldHelp=[...f.children].find(e=>e.matches('p.pt-help'));if(oldHelp)oldHelp.textContent='선택한 추가 농도로 조제량을 환산하고, 기본 수액과 다른 라인의 칼륨을 합산합니다. 처방 농도와 주입속도는 의료진이 확인합니다.';
  const fields=f.elements,prep=box.querySelector('[data-k-preparation]'),preview=box.querySelector('[data-k-preview]');
  for(const n of [10,20,25,30,40,60,80]){const button=document.createElement('button');button.type='button';button.textContent=n+' mEq/L';button.onclick=()=>{fields.added.value=n;fields.added.dispatchEvent(new Event('input',{bubbles:true}));};box.querySelector('[data-k-shortcuts]').append(button);}
  function update(){const mix=fields.kMethod.value==='mix';prep.hidden=!mix;for(const x of prep.querySelectorAll('input,select'))x.disabled=!mix;fields.concentration.readOnly=mix;fields.concentration.required=true;
   if(!mix)return;
   const valid=Number(fields.bag.value)>0&&Number(fields.kstock.value)>0;const ranges=[[80],[60],[40],[25,30],[20],[0]];box.querySelectorAll('tbody tr').forEach((row,i)=>{let td=row.querySelector('[data-k-reference-ml]');if(!td){td=document.createElement('td');td.dataset.kReferenceMl='';row.append(td);}td.textContent=valid?ranges[i].map(n=>c.display(n*Number(fields.bag.value)/1000/Number(fields.kstock.value))).join('–'):'—';});
   try{const r=c.potassiumMix(Object.fromEntries(new FormData(f)));fields.concentration.value=String(r.concentration);preview.textContent='KCl 원액 '+c.display(r.stockML)+' mL · 추가 K '+c.display(r.addedMEq)+' mEq\n'+(fields.mixMode.value==='final'?'기본 수액 '+c.display(r.stockML)+' mL를 빼고 원액 첨가':'기본 수액에 그대로 첨가')+'\n최종 '+c.display(r.volume)+' mL · 기본 수액 K 포함 '+c.display(r.concentration)+' mEq/L';}
   catch(e){fields.concentration.value='';preview.textContent=fields.added.value?e.message:'추가 농도를 선택하면 필요한 KCl 원액량을 표시합니다.';}
  }
  function changed(e){if(!box.contains(e.target))return;fields.confirmed.checked=false;o.clear();if(e.target.name==='kMethod')fields.concentration.value='';update();}
  f.addEventListener('input',changed);f.addEventListener('change',changed);
  f.addEventListener('reset',()=>queueMicrotask(update));
  b.addEventListener('practice-protocol-applied',()=>{if(f.querySelector('[data-protocol]')?.value){fields.kMethod.value='direct';update();}});
  const calculate=f.onsubmit;f.onsubmit=e=>{update();return calculate(e);};update();
  return {reset(){update();}};
 }
 g.PracticePotassiumMix={mount};
})(window);
