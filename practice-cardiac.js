/* Canine echo calculations: explicit measurement methods and units, no automatic staging. */
(function(g){
 'use strict';
 const sources=['https://doi.org/10.1111/jvim.15488','https://doi.org/10.1111/jvim.15438','https://doi.org/10.1111/jvim.15725','https://www.jstage.jst.go.jp/article/jsvc/36/2/36_2_79/_pdf'];
 const methods={simpson_right:'Simpson · 우측 흉골연 장축',simpson_left:'Simpson · 좌측 심첨 4방',simpson_biplane:'Simpson · 이면법',other:'기타 측정법 · 직접 입력',teichholz:'Teichholz · 내경 기반 추정'};
 const present=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
 function positive(v,label,max=10000){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(v??'').trim())||!Number.isFinite(+v)||+v<=0||+v>max)throw Error(label+'의 수치와 단위를 확인해주세요.');return +v;}
 function calculate(v){
  if(v.species!=='dog')throw Error('이 심장 계산의 체중 보정식은 개 전용입니다.');
  const weight=positive(v.weight,'체중',200);if(!['mm','cm'].includes(v.unit))throw Error('내경 단위를 선택해주세요.');
  const r={bsa:.101*Math.pow(weight,2/3),weight,method:v.method},dim=(name,label)=>present(v[name])?positive(v[name],label,v.unit==='mm'?200:20)/(v.unit==='mm'?10:1):null;
  const d=dim('lvidd','LVIDd'),s=dim('lvids','LVIDs');if(d!==null)r.lviddn=d/Math.pow(weight,.294);if(s!==null)r.lvidsn=s/Math.pow(weight,.315);
  if(d!==null&&s!==null){if(s>=d)throw Error('LVIDs는 LVIDd보다 작아야 합니다. 측정 시점과 단위를 확인해주세요.');r.fs=(d-s)/d*100;}
  if(present(v.la)||present(v.ao))r.laao=positive(v.la,'LA')/positive(v.ao,'Ao');
  if(present(v.trv))r.trpg=4*Math.pow(positive(v.trv,'TR 최고속도',15),2);
  if(!Object.hasOwn(methods,v.method))throw Error('심실용적 측정 방법을 선택해주세요.');
  if(v.method==='teichholz'){if(d===null||s===null)throw Error('Teichholz 추정에는 LVIDd와 LVIDs가 필요합니다.');r.edv=7/(2.4+d)*d**3;r.esv=7/(2.4+s)*s**3;}
  else if(present(v.edv)||present(v.esv)){r.edv=positive(v.edv,'EDV');r.esv=positive(v.esv,'ESV');}
  if(r.edv!==undefined){if(r.esv>=r.edv)throw Error('ESV는 EDV보다 작아야 합니다. 용적 측정값을 확인해주세요.');r.ef=(r.edv-r.esv)/r.edv*100;r.edvi=r.edv/r.bsa;r.esvi=r.esv/r.bsa;}
  if(d===null&&s===null&&r.laao===undefined&&r.trpg===undefined&&r.edv===undefined)throw Error('계산할 내경·LA/Ao·TR 속도 또는 심실용적을 입력해주세요.');
  return r;
 }
 function mount(main,o){
  const panel=document.createElement('section');panel.dataset.kindPanel='cardiac';panel.hidden=true;const field=(n,l)=>'<label>'+l+'<input name="'+n+'" inputmode="decimal" autocomplete="off"></label>';
  panel.innerHTML='<form class="pt-card pt-special-calculator" data-calc="cardiac"><h3>심장 계산</h3><p>개 전용 · 상단 체중 사용. 필요한 측정 항목만 입력하면 해당 지표를 계산합니다.</p><fieldset><legend>좌심실 내경 · 좌심방</legend><label>길이 입력 단위<select name="unit"><option value="mm">mm</option><option value="cm">cm</option></select></label><div class="pt-grid">'+field('lvidd','LVIDd · 이완기 내경')+field('lvids','LVIDs · 수축기 내경')+field('la','LA · 좌심방 직경')+field('ao','Ao · 대동맥 직경')+'</div><p class="pt-help">LA와 Ao는 같은 단위로 입력합니다. 추적 검사에서는 동일 단면·시점·측정법을 유지하세요.</p></fieldset><fieldset><legend>도플러 압력차</legend>'+field('trv','TR 최고속도 · m/s')+'<p class="pt-help">4 × TRV²는 우심실–우심방 압력차이며 폐동맥압 자체가 아닙니다.</p></fieldset><fieldset><legend>심실용적 · 박출률</legend><label>용적 측정 방법<select name="method">'+Object.entries(methods).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label><div class="pt-grid" data-cardiac-volumes>'+field('edv','EDV · 이완기말 용적 · mL')+field('esv','ESV · 수축기말 용적 · mL')+'</div><p class="pt-help">Simpson 용적은 장비에서 측정한 값을 입력합니다. Teichholz는 내경으로 추정하며 심실 형태 변화·역류가 있는 환자에서 한계가 있습니다. 서로 다른 측정법의 결과를 동일 기준으로 비교하지 마세요.</p></fieldset><button class="pt-primary">심장 지표 계산</button><output aria-live="polite"></output><div data-result-actions hidden></div><p class="pt-notice">LVIDDN ≥1.7, LA/Ao ≥1.6은 MMVD B2 평가에 사용하는 심장확대 기준입니다. 단독으로 병기·심부전을 확정하지 않습니다. FS·EF도 부하 상태와 역류의 영향을 함께 평가하세요.</p><details><summary>계산식·참고문헌</summary><p>LVIDDN = LVIDd(cm) / kg^0.294 · LVIDSN = LVIDs(cm) / kg^0.315<br>FS = (LVIDd−LVIDs)/LVIDd ×100 · LA/Ao = LA/Ao · TR ΔP = 4×TRV²<br>BSA = 0.101×kg^(2/3) · EF = (EDV−ESV)/EDV ×100 · EDVI = EDV/BSA · ESVI = ESV/BSA<br>Teichholz 용적(mL) = 7×D³/(2.4+D), D는 cm</p>'+sources.map((url,i)=>'<p><a href="'+url+'" target="_blank" rel="noopener noreferrer">'+['ACVIM · MMVD','체중·체표면적 보정과 측정법','ACVIM · 폐고혈압','심초음파 용적·기능 계산식'][i]+'</a></p>').join('')+'<p>확인 2026-11-27</p></details></form>';
  main.append(panel);const f=panel.querySelector('form'),out=f.querySelector('output');
  const clear=()=>{out.textContent='';f.querySelector('[data-result-actions]').hidden=true;};
  function layout(){f.querySelector('[data-cardiac-volumes]').hidden=f.elements.method.value==='teichholz';}
  f.addEventListener('input',e=>{if(!e.target.closest('[data-result-actions]'))clear();});f.addEventListener('change',e=>{if(e.target.closest('[data-result-actions]'))return;clear();if(e.target.name==='unit')for(const n of ['lvidd','lvids','la','ao'])f.elements[n].value='';layout();});
  f.onsubmit=e=>{e.preventDefault();clear();if(!o.guard())return;try{const b=main.closest('.pt-calc-layout').parentElement,wc=b.querySelector('[data-record-weight-confirm]');if(wc&&!wc.closest('label').hidden&&!wc.checked)throw Error('기록 체중을 먼저 확인해주세요.');const v={...Object.fromEntries(new FormData(f)),weight:o.weight.value,species:o.species.value},r=calculate(v),fmt=g.PracticeCalculators.display,labels={lviddn:'LVIDDN',lvidsn:'LVIDSN',fs:'FS',laao:'LA/Ao',trpg:'TR 압력차',bsa:'BSA',edv:'EDV',esv:'ESV',ef:'EF',edvi:'EDVI',esvi:'ESVI'},units={fs:'%',ef:'%',trpg:'mmHg',bsa:'m²',edv:'mL',esv:'mL',edvi:'mL/m²',esvi:'mL/m²'};const text=['심장 계산 · 개 · 체중 '+r.weight+' kg','내경 입력 단위 '+v.unit,...['lvidd','lvids','la','ao','trv'].filter(k=>present(v[k])).map(k=>k.toUpperCase()+' 입력 '+v[k]+' '+(k==='trv'?'m/s':v.unit)),...Object.keys(labels).filter(k=>r[k]!==undefined).map(k=>labels[k]+' '+fmt(r[k])+' '+(units[k]||'')),...(r.edv!==undefined?['용적 측정법: '+methods[r.method]]:[]),'LVIDDN·LA/Ao만으로 MMVD 병기 확정 불가 · TR 압력차는 폐동맥압 자체가 아님','출처 '+sources.join('\n')].join('\n');out.className='pt-output pt-pre';out.textContent=text;o.resultActions(f,text);}catch(e){out.className='pt-error';out.textContent=e.message;}};
  o.weight.addEventListener('input',clear);o.species.addEventListener('change',reset);function reset(){f.reset();layout();clear();}layout();return {reset,clear};
 }
 const api={calculate,methods,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeCardiac=api;
})(typeof window==='undefined'?globalThis:window);
