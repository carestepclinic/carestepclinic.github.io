/* Emergency reference calculations. No patient writes, automatic prescriptions or dose escalation. */
(function(g){
 'use strict';
 const sources={
  recover:{name:'RECOVER 2024 · CPR 지침',url:'https://doi.org/10.1111/vec.13391'},
  als:{name:'RECOVER 2024 · ALS 근거 검토',url:'https://doi.org/10.1111/vec.13389'},
  seizure:{name:'Munguia 등, 2024 · 발작 응급치료',url:'https://doi.org/10.3390/vetsci11060277'},
  acvim:{name:'ACVIM 2024 · 지속발작 합의문',url:'https://doi.org/10.1111/jvim.16928'},
  aaha:{name:'AAHA 2024 · 저혈당',url:'https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-5-fluid-therapy-in-ill-patients/'},
  sepsis:{name:'Montealegre·Lyons, 2021 · 패혈증 수액·순환 관리',url:'https://doi.org/10.3389/fvets.2021.622127'},
  cardiac:{name:'MSD Veterinary Manual · 심혈관 약물',url:'https://www.merckvetmanual.com/multimedia/table/cardiac-medications-of-dogs-and-cats'},
  triage:{name:'MSD Veterinary Manual · 응급 안정화',url:'https://www.msdvetmanual.com/emergency-medicine-and-critical-care/evaluation-and-initial-treatment-of-small-animal-emergency-patients/initial-triage-and-resuscitation-of-small-animal-emergency-patients'}
 };
 const mfds=id=>'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq='+id;
 const stock=(value,sourceId,note='')=>({value,sourceUrl:mfds(sourceId),note});
 // Values are explicitly reviewed per-mL concentrations from the existing MFDS catalog.
 // No broad fuzzy matching, auto-injectors, combination injections or unreconciled salt masses.
 const drugs=[
  {id:'epinephrine',name:'Epinephrine',ko:'에피네프린',group:'cpr',dose:{dog:0.01,cat:0.01},unit:'mg',route:'IV / IO',ingredientId:'mfds-8a24d87f589e53bafaa1',stocks:[stock(1,'196900031')],note:'심정지 CPR 전용. 비충격 리듬에서 사용하며 3–5분 간격을 확인합니다. 충격 리듬은 첫 제세동을 우선하고, 고용량으로 자동 증량하지 않습니다.',refs:['recover','als']},
  {id:'atropine',name:'Atropine',ko:'아트로핀',group:'cpr',dose:{dog:0.04,cat:0.04},unit:'mg',route:'IV / IO',ingredientId:'mfds-094f47b14988ffdf5996',stocks:[stock(0.5,'196900033','500 mcg/mL = 0.5 mg/mL')],note:'비충격 심정지에서 고려하는 CPR 용량입니다. 사용 시 초기에 1회만 투여하며 반복하지 않습니다. 맥박이 있는 서맥 용법과 구분하세요.',refs:['recover','als']},
  {id:'vasopressin',name:'Vasopressin',ko:'바소프레신',group:'cpr',dose:{dog:0.8,cat:0.8},unit:'U',route:'IV / IO',ingredientId:'manual-bd9c08c6a47210734743',stocks:[stock(20,'198401223','원문 바소프레신 단위 · 질량과 환산하지 않음')],note:'CPR 중 에피네프린의 대안. 비충격 리듬 또는 첫 제세동 후 지속되는 충격 리듬에서 3–5분 간격을 확인합니다. 두 약물을 일률적으로 함께 투여하지 않습니다.',refs:['recover','als']},
  {id:'lidocaine',name:'Lidocaine',ko:'리도카인',group:'cpr',dose:{dog:2},unit:'mg',route:'IV / IO · 2–4분',ingredientId:'manual-5156be2eadcb080c8749',stocks:[stock(20,'197900151','리도카인염산염으로서 20 mg/mL · 에피네프린 없는 단일제')],note:'개에서 첫 제세동에 반응하지 않는 VF/pVT의 보조약입니다. 고양이에는 이 CPR 용량을 적용하지 않습니다. 국소마취용 에피네프린 복합제는 제외합니다.',refs:['recover','als']},
  {id:'amiodarone',name:'Amiodarone',ko:'아미오다론',group:'cpr',dose:{cat:5},unit:'mg',route:'IV / IO · 2–4분',ingredientId:'mfds-1062771d258117c3ceed',stocks:[stock(50,'200603929')],note:'고양이의 첫 제세동에 반응하지 않는 VF/pVT. 개는 polysorbate-80 함유 제제의 혈역학 위험 때문에 이 자동 카드에서 제외합니다. 제품별 희석·투여 조건을 확인하세요.',refs:['recover','als']},
  {id:'naloxone',name:'Naloxone',ko:'날록손',group:'reversal',dose:{dog:0.04,cat:0.04},unit:'mg',route:'IV / IO',ingredientId:'mfds-5d9c91f30ca608cefc28',stocks:[stock(0.4,'198200406'),stock(0.5,'199702376'),stock(1,'198700925')],note:'오피오이드가 원인으로 의심되는 심정지의 길항 용량. 일반 회복·부분 길항 용법과 구분합니다. CPR과 환기를 지연하지 않습니다.',refs:['recover']},
  {id:'flumazenil',name:'Flumazenil',ko:'플루마제닐',group:'reversal',dose:{dog:0.01,cat:0.01},unit:'mg',route:'IV / IO',ingredientId:'mfds-2c75ba9bdeee0af1b6da',stocks:[stock(0.1,'199203395','100 mcg/mL = 0.1 mg/mL')],note:'벤조디아제핀 관련 심정지의 길항 용량. 벤조디아제핀으로 발작을 억제 중인 환자에게 일률적으로 사용하지 않습니다.',refs:['recover']},
  {id:'midazolam',name:'Midazolam',ko:'미다졸람',group:'other',dose:{dog:0.3,cat:0.3},unit:'mg',route:'IV',ingredientId:'mfds-43c17d96856f599dbecb',stocks:[stock(5,'200109948'),stock(1,'200009363')],note:'지속발작·군집발작의 초기 정맥 투여. 호흡·산소화·혈압을 감시하고 반응을 평가합니다. 반복 여부·간격과 다음 단계는 발작 지침에 따라 결정합니다.',refs:['seizure','acvim']},
  {id:'dextrose',name:'Dextrose',ko:'포도당',group:'other',dose:{dog:250,cat:250},range:{dog:[250,500],cat:[250,500]},unit:'mg',route:'희석 후 IV · 2–5분',ingredientId:'mfds-55f88b60633bfcc75094',stocks:[stock(500,'195600006','50% = 500 mg/mL'),stock(200,'195600004','20% = 200 mg/mL'),stock(100,'195700004','10% = 100 mg/mL'),stock(50,'195500006','5% = 50 mg/mL')],note:'증상이 동반된 저혈당 확인 후 사용합니다. 표시값은 희석 전 원액량입니다. 50%는 원액 1에 희석액 2–4를 더해 2–5분에 투여하고 혈당을 재평가합니다. 인슐린종은 최소 유효량을 사용합니다.',refs:['aaha'],dilution:true},
  {id:'dobutamine',name:'Dobutamine',ko:'도부타민',group:'cri',dose:{dog:2,cat:1},range:{dog:[1,15],cat:[0.5,5]},unit:'mcg',route:'IV CRI',ingredientId:'mfds-0765b38b1109711db88d',stocks:[stock(50,'199000148','도부타민으로서 250 mg/5 mL')],note:'수축력 저하 시 반응에 맞춰 조절합니다. 급속 일회 주사 금지. 심전도·혈압 감시가 필요하며 고양이는 떨림·발작·빈맥에 특히 주의합니다.',refs:['cardiac','sepsis']},
  {id:'norepinephrine',name:'Norepinephrine',ko:'노르에피네프린',group:'cri',dose:{dog:0.1,cat:0.1},range:{dog:[0.1,1],cat:[0.1,1]},unit:'mcg',route:'IV CRI',ingredientId:'mfds-5f6d1e61e10332df5d31',stocks:[stock(1,'199806705','노르에피네프린으로서 · 타르타르산염 질량과 구분')],note:'적절한 용적 평가·소생 후에도 저혈압이 지속되는 혈관확장성 쇼크에서 고려합니다. 혈압·말초 관류·주사부위 유출을 감시하며 반응에 맞춰 조절합니다. 급속 일회 주사 금지.',refs:['sepsis']},
  {id:'dopamine',name:'Dopamine',ko:'도파민',group:'cri',dose:{dog:5,cat:5},range:{dog:[5,20],cat:[5,20]},unit:'mcg',route:'IV CRI',ingredientId:'mfds-c4c06e9554aa2d1aec2c',stocks:[stock(40,'197800042')],note:'지속되는 저혈압에서 선택하는 대안 약물입니다. 신장 보호 목적으로 자동 사용하지 않습니다. 심전도·혈압을 감시하며 빈맥·부정맥 시 재평가합니다. 급속 일회 주사 금지.',refs:['triage']}
 ];
 const groups=[['cpr','심정지 · CPR'],['reversal','약물 관련 심정지 · 길항'],['other','발작 · 저혈당'],['cri','저혈압 · 수축력 저하 · 지속주입']];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>{if(!Number.isFinite(n))return '—';const s=Number(n.toPrecision(5)).toString();return s.startsWith('.')?'0'+s:s;};
 const num=(v,label,max=1e6)=>{if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(v).trim())||!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>max)throw Error(label+'을 올바르게 입력해주세요.');return Number(v);};
 function calculate(id,v){
  const d=drugs.find(x=>x.id===id);if(!d||!d.dose[v.species])throw Error('이 종에는 해당 자동 용량을 제공하지 않습니다.');
  const w=num(v.weight,'체중 · kg',200),dose=num(v.dose,'기준 용량'),stockValue=num(v.stock,'원액 농도');
  const range=d.range?.[v.species];if(range?(dose<range[0]||dose>range[1]):dose!==d.dose[v.species])throw Error('선택한 근거 범위 밖입니다. 개별 처방은 경구제·주사제 또는 CRI 계산기를 이용해주세요.');
  if(d.group==='cri'){
   const hourly=w*dose*60/1000,result={hourly,stockRate:hourly/stockValue};
   if(v.mixMode==='prepare'){
    const volume=num(v.volume,'약물 포함 최종 부피'),rate=num(v.rate,'계획한 펌프 속도');
    const concentration=hourly/rate,stockML=concentration*volume/stockValue;
    if(!Number.isFinite(stockML)||stockML<=0||stockML>=volume)throw Error('필요 원액량이 최종 부피 이상이거나 계산 범위를 벗어납니다. 농도·속도·최종 부피를 확인해주세요.');
    return {...result,stockML,volume,concentration,rate,diluentML:volume-stockML,hours:volume/rate,prepare:true};
   }
   if(v.mixMode&&v.mixMode!=='pump')throw Error('희석 계산 방식을 선택해주세요.');
   if(v.stockML!==''&&v.stockML!==undefined||v.volume!==''&&v.volume!==undefined){
    const stockML=num(v.stockML,'혼합한 원액량'),volume=num(v.volume,'약물 포함 최종 부피');if(stockML>=volume)throw Error('최종 부피는 원액량보다 커야 합니다.');
    const concentration=stockValue*stockML/volume;return {...result,stockML,volume,concentration,rate:hourly/concentration,diluentML:volume-stockML,hours:volume/(hourly/concentration)};
   }
   return result;
  }
  return {amount:w*dose,volume:w*dose/stockValue};
 }
 function concentrationOptions(d,items,species){
  // Clinic defaults are an exact ingredient/route/species match. Never borrow an oral or combination product.
  const clinic=(items||[]).filter(p=>{const m=p.body?.strength;return !p.formularyIssue&&m?.ingredientId===d.ingredientId&&m.route==='injection'&&m.release==='standard'&&m.species?.includes(species)&&p.body.kind==='liquid'&&['mg','mcg','U'].includes(p.body.unit)&&(d.unit==='U')===(p.body.unit==='U')&&Number(p.body.value)>0&&Number.isFinite(Number(p.body.value));}).map(p=>({id:'clinic:'+p.id,value:Number(p.body.value)*(p.body.unit==='mcg'?0.001:1),sourceUrl:p.body.strength.sourceUrl||'',note:'병원 저장 · '+p.body.title,clinic:true}));
  // Dextrose catalog contains an inconsistent 10% entry at 1000 mg/mL; never import it or its derived defaults.
  const safe=clinic.filter(x=>d.id!=='dextrose'||d.stocks.some(s=>s.value===x.value));
  return [...safe,...d.stocks.map((s,i)=>({...s,id:'common:'+i}))];
 }
 function mount(b,o){
  const weight=b.querySelector('[data-common-weight]'),species=b.querySelector('[data-ref-species]'),main=b.querySelector('.pt-calc-main');if(!main||!weight||!species)return null;
  const panel=document.createElement('section');panel.dataset.kindPanel='emergency';panel.hidden=true;panel.className='pt-emergency';
  panel.innerHTML='<div class="pt-emergency-heading"><div><h3>응급약물 · 한눈에 계산</h3><p>상단의 종·체중으로 기준 용량을 환산합니다. 카드의 적응증·경로·실제 주사제 농도를 확인하세요.</p></div><button type="button" data-em-print>응급 계산표 인쇄</button></div><p class="pt-notice">성체 개·고양이용 의료진 참고입니다. 신생아 소생에는 적용하지 않습니다. 모든 약물을 투여하라는 목록이 아니며, CPR 약물·길항제·지속주입의 조건을 구분합니다.</p><div data-em-context role="status"></div><nav class="pt-bar" aria-label="응급약물 분류"><button type="button" data-em-filter="all" aria-pressed="true">전체</button>'+groups.map(([id,title])=>'<button type="button" data-em-filter="'+id+'" aria-pressed="false">'+title+'</button>').join('')+'</nav><div data-em-groups></div><details class="pt-em-sources"><summary>근거·계산 기준 확인 · 2026-10-25</summary><p>고정 CPR 용량과 용량 범위를 구분했습니다. 범위가 있는 약물의 초기 표시값은 계산 시작점이며 환자별 처방 승인을 뜻하지 않습니다. 소수점 표시는 유효숫자 5자리 근삿값이며 내부 계산은 반올림하지 않습니다.</p><p>단회 원액량 = kg × 용량 ÷ 원액 농도. 지속주입 mg/hr = kg × mcg/kg/min × 60 ÷ 1000. 펌프 mL/hr = mg/hr ÷ 조제 후 mg/mL. 원액 환산 속도는 펌프 설정값이 아닙니다.</p>'+Object.values(sources).map(s=>'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+'</a></p>').join('')+'</details>';
  main.append(panel);let records=[],cards=new Map(),lastSpecies=species.value,filter='all',detailId='';
  const quick=document.createElement('div');quick.className='pt-em-quick';quick.innerHTML='<p class="pt-help">빠른 계산표 · 농도 변경이나 희석 설정은 해당 약물의 설정 버튼에서 진행하세요.</p><div class="pt-em-table-wrap"><table><caption>현재 종·체중 기준 응급약물 계산표</caption><thead><tr><th>약물 · 사용 조건</th><th>기준 용량</th><th>원액 농도</th><th>계산 결과</th><th>확인</th></tr></thead><tbody></tbody></table></div>';panel.querySelector('[data-em-groups]').before(quick);
  const shortNotes={epinephrine:'심정지 · 비충격 리듬 / 첫 제세동 이후',atropine:'비충격 심정지 · 초기에 1회만',vasopressin:'CPR · 에피네프린의 대안',lidocaine:'개 · 제세동 불응 VF/pVT · 단일제',amiodarone:'고양이 · 제세동 불응 VF/pVT',naloxone:'오피오이드 관련 심정지',flumazenil:'벤조디아제핀 관련 심정지',midazolam:'지속발작·군집발작 · 호흡 감시',dextrose:'증상 동반 저혈당 · 희석 후 투여',dobutamine:'수축력 저하 · 급속 주사 금지',norepinephrine:'용적 평가 후 저혈압 · 급속 주사 금지',dopamine:'저혈압 대안 · 급속 주사 금지'};
  const link=(url,label)=>/^https:\/\//.test(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'';
  for(const [id,title] of groups){const section=document.createElement('section');section.dataset.emGroup=id;section.innerHTML='<h4>'+title+'</h4><div class="pt-emergency-grid"></div>';panel.querySelector('[data-em-groups]').append(section);
   for(const d of drugs.filter(x=>x.group===id)){
    const card=document.createElement('article');card.className='pt-emergency-card';card.dataset.emDrug=d.id;
    card.innerHTML='<header><h5>'+d.name+' <span>'+d.ko+'</span></h5><b>'+d.route+'</b></header><p class="pt-em-indication">'+d.note+'</p><label>기준 용량 · '+d.unit+'/kg'+(id==='cri'?'/min':'/회')+'<input data-em-dose inputmode="decimal" autocomplete="off" '+(d.range?'':'readonly')+'></label><small data-em-dose-note></small><div class="pt-em-result" data-em-result aria-live="polite"></div><details data-em-settings><summary>농도·'+(id==='cri'?'희석 설정':'계산 기준')+'</summary><label>원액 농도 선택<select data-em-stock-choice></select></label><label>실제 원액 · '+(d.unit==='U'?'U':'mg')+'/mL<input data-em-stock inputmode="decimal" autocomplete="off"></label><small data-em-stock-note></small>'+(id==='cri'?'<label>희석 계산 방식<select data-em-mix-mode><option value="prepare">주입속도 지정 → 필요한 원액량 계산</option><option value="pump">원액량 직접 입력 → 주입속도 계산</option></select></label><div class="pt-grid"><label>약물 포함 최종 수액량<select data-em-bag><option value="100">100 mL</option><option value="500">500 mL</option><option value="custom">직접 입력</option></select></label><label data-em-custom-volume hidden>약물 포함 최종 부피 · mL<input data-em-volume value="100" inputmode="decimal" autocomplete="off"></label><label data-em-rate-label>의료진이 정한 펌프 속도 · mL/hr<input data-em-rate inputmode="decimal" autocomplete="off" placeholder="환자 수액 계획에 맞춰 입력"></label><label data-em-stock-ml-label hidden>혼합할 원액 · mL<input data-em-stock-ml inputmode="decimal" autocomplete="off" placeholder="실제 원액량"></label><label>제품 지침에서 확인한 희석액<select data-em-diluent><option value="">희석액 선택</option><option value="ns">N/S · 0.9% 생리식염수</option><option value="d5w">D5W · 5% 포도당</option><option value="other">기타 · 제품 지침 확인</option></select></label></div><p class="pt-help" data-em-diluent-note></p><label class="pt-choice"><input type="checkbox" data-em-mix-confirm>조제량·희석액 적합성·주입 경로를 확인했습니다.</label><p class="pt-help">100·500 mL는 약물을 포함한 최종 목표 부피입니다. 백에서 원액량만큼 빼고 넣는 방식이며 실제 충전량·과충전 여부를 확인하세요. 다른 약물과 한 백에 혼합하는 계산이 아닙니다. 제품별 안정성·사용 가능 시간, 전체 수액량·펌프 최소 속도·사강을 확인합니다.</p>':'')+'<div data-em-source></div></details>';
    section.querySelector('.pt-emergency-grid').append(card);const c={d,el:card,dose:card.querySelector('[data-em-dose]'),stock:card.querySelector('[data-em-stock]'),choice:card.querySelector('[data-em-stock-choice]'),out:card.querySelector('[data-em-result]'),options:[],touched:false};cards.set(d.id,c);
    const row=document.createElement('tr');row.dataset.emRow=d.id;row.innerHTML='<th scope="row">'+d.name+'<small>'+d.ko+' · '+d.route+'</small><small>'+shortNotes[d.id]+'</small></th><td data-em-q-dose></td><td data-em-q-stock></td><td data-em-q-result></td><td><button type="button" data-em-open="'+d.id+'" aria-label="'+d.name+' 농도·근거 설정">설정·근거</button></td>';quick.querySelector('tbody').append(row);c.row=row;
    row.querySelector('button').onclick=()=>{detailId=detailId===d.id?'':d.id;layoutDetails();if(detailId){card.querySelector('[data-em-settings]').open=true;card.scrollIntoView({block:'center',behavior:'instant'});card.querySelector('[data-em-stock-choice]').focus({preventScroll:true});}};
    c.choice.onchange=()=>{c.touched=true;const x=c.options.find(x=>x.id===c.choice.value);c.stock.value=x?x.value:'';invalidateMix(c);stockNote(c);refresh();};
    card.addEventListener('input',e=>{if(e.target===c.stock){c.choice.value='manual';c.touched=true;stockNote(c);}if(e.target!==card.querySelector('[data-em-mix-confirm]'))invalidateMix(c);refresh();});
    card.querySelector('[data-em-mix-confirm]')?.addEventListener('change',refresh);
    card.addEventListener('change',e=>{if(e.target.matches('[data-em-mix-mode],[data-em-bag],[data-em-diluent]')){if(e.target.matches('[data-em-mix-mode]')){card.querySelector('[data-em-stock-ml]').value='';card.querySelector('[data-em-rate]').value='';}if(e.target.matches('[data-em-bag]'))card.querySelector('[data-em-volume]').value=e.target.value==='custom'?'':e.target.value;invalidateMix(c);mixLayout(c);refresh();}});
    mixLayout(c);
   }
  }
  function mixLayout(c){
   if(c.d.group!=='cri')return;
   const el=c.el,prepare=el.querySelector('[data-em-mix-mode]').value==='prepare';
   el.querySelector('[data-em-rate-label]').hidden=!prepare;
   el.querySelector('[data-em-stock-ml-label]').hidden=prepare;
   el.querySelector('[data-em-custom-volume]').hidden=el.querySelector('[data-em-bag]').value!=='custom';
   const diluent=el.querySelector('[data-em-diluent]').value;
   el.querySelector('[data-em-diluent-note]').textContent=c.d.id==='norepinephrine'?'노르에피네프린 농축제는 포도당 함유 희석액을 요구하고 N/S 단독을 권장하지 않는 제품이 있습니다. '+(diluent==='ns'?'선택한 실제 제품이 N/S 단독 희석을 허용하는지 반드시 확인하세요.':'실제 제품 허가사항으로 희석액·사용 가능 시간을 확인하세요.'):'도부타민·도파민은 N/S 또는 D5W가 허용되는 제품이 있으나 실제 제품 지침의 농도·희석액·사용 가능 시간을 확인하세요.';
  }
  function invalidateMix(c){const check=c.el.querySelector('[data-em-mix-confirm]');if(check)check.checked=false;}
  function stockNote(c){const x=c.options.find(x=>x.id===c.choice.value);c.el.querySelector('[data-em-stock-note]').textContent=x?(x.clinic?'병원 저장값':'공통 함량 목록 · 실제 앰플 확인')+(x.note?' · '+x.note:''):'직접 입력 · 실제 주사제의 1mL당 함량을 확인하세요.';c.el.querySelector('[data-em-source]').innerHTML=(x?link(x.sourceUrl,'함량 출처'):'')+' '+c.d.refs.map(k=>link(sources[k].url,sources[k].name)).join(' · ');}
  function layoutDetails(){for(const c of cards.values()){c.el.hidden=c.d.id!==detailId;c.row.hidden=filter!=='all'&&c.d.group!==filter;c.row.querySelector('button').setAttribute('aria-expanded',String(c.d.id===detailId));}panel.querySelectorAll('[data-em-group]').forEach(x=>x.hidden=!detailId||!cards.get(detailId)||cards.get(detailId).d.group!==x.dataset.emGroup);}
  function updateQuick(c){const d=c.d;c.row.querySelector('[data-em-q-dose]').textContent=d.dose[species.value]?c.dose.value+' '+d.unit+'/kg'+(d.group==='cri'?'/min':'/회'):'종별 제외';c.row.querySelector('[data-em-q-stock]').textContent=c.stock.value?fmt(Number(c.stock.value))+' '+(d.unit==='U'?'U':'mg')+'/mL':'농도 선택 필요';const cell=c.row.querySelector('[data-em-q-result]');cell.replaceChildren();const primary=c.out.querySelector('strong');if(primary){const strong=document.createElement('strong');strong.textContent=primary.textContent;cell.append(strong);if(d.group==='cri'){const small=document.createElement('small');small.textContent=c.out.querySelector('.pt-em-setup')?.textContent||c.out.querySelector('span').textContent;cell.append(small);}if(c.out.querySelector('.pt-em-measure')){const small=document.createElement('small');small.textContent='미량 · 희석·측정 계획 확인';cell.append(small);}}else cell.textContent=c.out.textContent;}
  function loadOptions(c){c.options=concentrationOptions(c.d,records,species.value);const old=c.choice.value,value=c.stock.value;c.choice.innerHTML=c.options.map(x=>'<option value="'+esc(x.id)+'">'+(x.clinic?'병원 · ':'공통 · ')+fmt(x.value)+' '+(c.d.unit==='U'?'U':'mg')+'/mL</option>').join('')+'<option value="manual">직접 입력</option>';if(c.touched){c.choice.value=c.options.some(x=>x.id===old)?old:'manual';c.stock.value=value;}else{const unique=[...new Set(c.options.filter(x=>x.clinic).map(x=>x.value))];if(unique.length>1){c.choice.value='manual';c.stock.value='';}else{const selected=c.options[0];c.choice.value=selected.id;c.stock.value=selected.value;}}stockNote(c);}
  function weightProblem(){const record=b.querySelector('[data-record-weight-confirm]');if(record&&!record.closest('label').hidden&&!record.checked)return '기록 체중의 측정일을 확인한 뒤 상단 확인란을 선택해주세요.';try{num(weight.value,'체중 · kg',200);}catch(e){return e.message;}return '';}
  function refresh(){if(!o.guard())return;const sp=species.value,valid=['dog','cat'].includes(sp),problem=valid?weightProblem():'상단에서 개 또는 고양이를 선택해주세요.';panel.querySelector('[data-em-context]').textContent=problem||((sp==='dog'?'개':'고양이')+' · '+weight.value+' kg · 아래 원액 농도 기준의 계산값');
   for(const c of cards.values()){const d=c.d,enabled=!!d.dose[sp];c.el.dataset.available=String(enabled);c.dose.disabled=!enabled;
    if(!enabled||problem){c.out.textContent=!valid?problem:!enabled?(d.id==='amiodarone'?'개 자동 계산 제외 · 제품 첨가제와 대체 약물 확인':'이 종의 CPR 자동 용량 없음 · 개 용량을 적용하지 마세요.'):problem;c.out.className='pt-em-result pt-em-pending';updateQuick(c);continue;}
    try{const cri=d.group==='cri',v={species:sp,weight:weight.value,dose:c.dose.value,stock:c.stock.value,stockML:c.el.querySelector('[data-em-stock-ml]')?.value,volume:c.el.querySelector('[data-em-volume]')?.value,mixMode:c.el.querySelector('[data-em-mix-mode]')?.value,rate:c.el.querySelector('[data-em-rate]')?.value},r=calculate(d.id,v);c.out.className='pt-em-result';
     if(cri){
      const diluent=c.el.querySelector('[data-em-diluent]'),confirmed=c.el.querySelector('[data-em-mix-confirm]').checked&&!!diluent.value;
      const recipe=r.rate?'원액 '+fmt(r.stockML)+' mL + 희석액 '+fmt(r.diluentML)+' mL = 최종 '+fmt(r.volume)+' mL':'';
      c.out.innerHTML='<span>시간당 약물량 <b>'+fmt(r.hourly)+' mg/hr</b></span>'+
       (r.rate?'<strong>'+(confirmed?'펌프 '+fmt(r.rate)+' mL/hr':r.prepare?'조제안 · 필요 원액 '+fmt(r.stockML)+' mL':'조제안 · 원액 '+fmt(r.stockML)+' mL')+'</strong><span class="pt-em-setup">'+recipe+(diluent.value?' · '+esc(diluent.selectedOptions[0].textContent):' · 희석액 선택 필요')+(!confirmed?' · 계획 '+fmt(r.rate)+' mL/hr · 확인 전':'')+'</span>'+
       '<span>'+(confirmed?'확인한':'확인 전 계획')+' 주입속도 '+fmt(r.rate)+' mL/hr · 조제 후 '+fmt(r.concentration)+' mg/mL</span><span>전량 소요시간 '+fmt(r.hours)+'시간 · 조제액 사용 가능 시간과 다릅니다.</span>'+
       (!confirmed?'<b>희석액·조제량 확인 후 펌프 설정에 적용하세요.</b>':'')+
       (r.hours>24?'<small>전량 소요시간이 24시간을 넘습니다. 제품별 안정성에 따라 백 교체·폐기 계획을 별도로 정하고, 전량 소진을 위해 속도를 높이지 마세요.</small>':''):
       '<strong>1시간분 원액 '+fmt(r.stockRate)+' mL</strong><span class="pt-em-setup">희석 후 주입 · 펌프 속도는 희석 설정·확인 필요</span>')+
       '<small>원액 환산 '+fmt(r.stockRate)+' mL/hr · 직접 주입 속도 아님</small>';
     }
     else c.out.innerHTML='<span>1회 약물량 '+fmt(r.amount)+' '+d.unit+'</span><strong>'+(d.dilution?'희석 전 원액 ':'준비할 원액 ')+fmt(r.volume)+' mL</strong><small>'+fmt(Number(c.dose.value))+' '+d.unit+'/kg × '+weight.value+' kg ÷ '+fmt(Number(c.stock.value))+' '+d.unit+'/mL</small>'+(r.volume<0.1?'<small class="pt-em-measure">0.1 mL 미만 · 주사기 눈금에 맞는 희석·측정 계획 확인</small>':'');
    }catch(e){c.out.className='pt-em-result pt-em-pending';c.out.textContent=e.message;}updateQuick(c);
   }
  }
  function contextChanged(){const changed=lastSpecies!==species.value;lastSpecies=species.value;for(const c of cards.values()){if(changed){c.dose.value=c.d.dose[species.value]??'';c.touched=false;loadOptions(c);c.el.querySelectorAll('[data-em-stock-ml],[data-em-rate]').forEach(x=>x.value='');}invalidateMix(c);c.el.querySelector('[data-em-dose-note]').textContent=c.d.range?.[species.value]?'참고 범위 '+c.d.range[species.value].join('–')+' '+c.d.unit+'/kg'+(c.d.group==='cri'?'/min':'/회')+' · 환자 반응에 맞춰 선택':'지침의 고정 기준 · 해당 적응증에만 적용';}refresh();}
  for(const c of cards.values()){c.dose.value=c.d.dose[species.value]??'';loadOptions(c);}contextChanged();layoutDetails();
  weight.addEventListener('input',()=>{for(const c of cards.values())invalidateMix(c);refresh();});species.addEventListener('change',contextChanged);b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))refresh();});
  panel.querySelectorAll('[data-em-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.emFilter;detailId='';layoutDetails();panel.querySelectorAll('[data-em-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));});
  panel.querySelector('[data-em-print]').onclick=()=>{if(!o.guard())return;refresh();if(weightProblem()||!['dog','cat'].includes(species.value)){panel.querySelector('[data-em-context]').focus();return;}const win=window.open('','_blank');if(!win){panel.querySelector('[data-em-context]').textContent='인쇄창이 차단됐습니다. 브라우저의 팝업 설정을 확인해주세요.';return;}const html=[...cards.values()].filter(c=>c.d.dose[species.value]&&(filter==='all'||c.d.group===filter)).map(c=>'<article><h2>'+c.d.name+' · '+c.d.ko+'</h2><p>'+esc(c.d.route)+' · 원액 '+esc(c.stock.value)+' '+(c.d.unit==='U'?'U':'mg')+'/mL</p><p>'+esc(c.out.innerText)+'</p><p>'+esc(c.d.note)+'</p></article>').join('');win.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><title>응급약물 계산표</title><style>body{font:14px sans-serif;color:#142d48}article{break-inside:avoid;border:1px solid #ccc;padding:10px;margin:8px 0}h2{font-size:17px}p{white-space:pre-line}button{padding:12px}@media print{button{display:none}}</style><button onclick="window.print()">인쇄 · PDF로 저장</button><h1>응급약물 참고 계산표</h1><p>'+esc(panel.querySelector('[data-em-context]').textContent)+' · '+new Date().toLocaleString('ko-KR')+'</p><p>환자 상태·적응증·경로·제품 농도를 확인합니다. 표시값은 원액량이며 희석 후 주입량과 다를 수 있습니다.</p>'+html+'<p>근거: RECOVER 2024 · ACVIM 2024 · AAHA 2024 · 각 카드의 출처. 확인 2026-10-25</p></html>');win.document.close();};
  return {loaded(r){records=r.items||[];for(const c of cards.values()){if(!c.touched){invalidateMix(c);loadOptions(c);}}refresh();},refresh,contextChanged,reset(){lastSpecies='';contextChanged();}};
 }
 const api={drugs,sources,calculate,concentrationOptions,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeEmergency=api;
})(typeof window==='object'?window:globalThis);
