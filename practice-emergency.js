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
 // Operator-requested preparation defaults: one tenth of the prior reference concentrations.
 // Source labels below describe the original product examples, not these adjusted defaults.
 const dilutionReferences={
  dobutamine:{concentration:0.1,label:'1 mg/mL · 제조사 희석표',url:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=89becb0c-da60-4f43-0a98-29ff7a9eca58'},
  norepinephrine:{concentration:0.0016,label:'0.016 mg/mL (16 mcg/mL) · D5W 완제품 농도 참고',url:'https://catalog.baxter.com/baxterUS/en/Products/Pharmaceuticals/Premixed-Medications/Norepinephrine-Bitartrate-in-5%25-Dextrose-Injection-4-mg-250-mL-%2816-mcg-mL%29-in-VIAFLO-Plastic-Container-Liquid-Premix/p/EZPE7748'},
  dopamine:{concentration:0.16,label:'1.6 mg/mL (1,600 mcg/mL) · D5W 완제품 농도 참고',url:'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=cb97d4a0-89ed-407c-a763-209386b6f75c'}
 };
 const duration=hours=>{const mins=Math.round(hours*60);return (mins>=60?Math.floor(mins/60)+'시간':'')+(mins%60?' '+mins%60+'분':mins<60?'1분 미만':'');};
 const groups=[['cpr','심정지 · CPR'],['reversal','약물 관련 심정지 · 길항'],['other','발작 · 저혈당'],['cri','저혈압 · 수축력 저하 · 지속주입']];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>{if(!Number.isFinite(n))return '—';const s=Number(n.toPrecision(5)).toString();return s.startsWith('.')?'0'+s:s;};
 const num=(v,label,max=1e6)=>{if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(v).trim())||!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>max)throw Error(label+' 입력값을 확인해주세요.');return Number(v);};
 function calculate(id,v){
  const d=drugs.find(x=>x.id===id);if(!d||!d.dose[v.species])throw Error('이 종에는 해당 자동 용량을 제공하지 않습니다.');
  const w=num(v.weight,'체중 · kg',200),dose=num(v.dose,'기준 용량'),stockValue=num(v.stock,'원액 농도');
  const range=d.range?.[v.species],doseOutside=!!range&&(dose<range[0]||dose>range[1]);if(!range&&dose!==d.dose[v.species])throw Error('이 카드는 지침의 고정 용법입니다. 다른 적응증·용량은 직접 처방 계산을 사용하세요.');
  if(d.group==='cri'){
   const hourly=w*dose*60/1000,result={hourly,stockRate:hourly/stockValue,doseOutside};
   if(v.mixMode==='concentration'){
    const volume=num(v.volume,'약물 포함 최종 부피'),concentration=num(v.concentration,'희석 후 농도');
    if(concentration>=stockValue)throw Error('희석 후 농도는 원액 농도보다 낮아야 합니다.');
    const stockML=concentration*volume/stockValue,rate=hourly/concentration;
    if(![stockML,rate,volume/rate].every(n=>Number.isFinite(n)&&n>0))throw Error('희석 농도·속도가 계산 가능한 범위를 벗어납니다.');
    return {...result,stockML,volume,concentration,rate,diluentML:volume-stockML,hours:volume/rate,concentrationMode:true};
   }
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
  return {amount:w*dose,volume:w*dose/stockValue,doseOutside};
 }
 function concentrationOptions(d,items,species){
  // Clinic defaults are an exact ingredient/route/species match. Never borrow an oral or combination product.
  const clinic=(items||[]).filter(p=>{const m=p.body?.strength;return !p.formularyIssue&&m?.ingredientId===d.ingredientId&&m.route==='injection'&&m.release==='standard'&&m.species?.includes(species)&&p.body.kind==='liquid'&&['mg','mcg','U'].includes(p.body.unit)&&(d.unit==='U')===(p.body.unit==='U')&&Number(p.body.value)>0&&Number.isFinite(Number(p.body.value));}).map(p=>({id:'clinic:'+p.id,value:Number(p.body.value)*(p.body.unit==='mcg'?0.001:1),sourceUrl:p.body.strength.sourceUrl||'',note:p.body.title,clinic:true}));
  // Dextrose catalog contains an inconsistent 10% entry at 1000 mg/mL; never import it or its derived defaults.
  const safe=clinic.filter(x=>d.id!=='dextrose'||d.stocks.some(s=>s.value===x.value));
  return [...safe,...d.stocks.map((s,i)=>({...s,id:'common:'+i}))];
 }
 function mount(b,o){
  const weight=b.querySelector('[data-common-weight]'),species=b.querySelector('[data-ref-species]'),main=b.querySelector('.pt-calc-main');if(!main||!weight||!species)return null;
  const panel=document.createElement('section');panel.dataset.kindPanel='emergency';panel.hidden=true;panel.className='pt-emergency';
  panel.innerHTML='<div class="pt-emergency-heading"><div><h3>응급약물 · 한눈에 계산</h3></div><button type="button" data-em-print>응급 계산표 인쇄</button></div><p class="pt-notice">성체 개·고양이 참고 · 신생아 소생 제외. 모든 약물을 함께 투여하는 목록이 아닙니다. 약물별 적응증·경로·실제 농도를 확인하세요.</p><div data-em-context role="status"></div><nav class="pt-bar" aria-label="응급약물 분류"><button type="button" data-em-filter="all" aria-pressed="true">전체</button>'+groups.map(([id,title])=>'<button type="button" data-em-filter="'+id+'" aria-pressed="false">'+title+'</button>').join('')+'</nav><div data-em-groups></div><details class="pt-em-sources"><summary>근거·계산 기준 확인 · 2026-10-25</summary><p>고정 CPR 용량과 용량 범위를 구분했습니다. 범위가 있는 약물의 초기 표시값은 계산 시작점이며 환자별 처방 승인을 뜻하지 않습니다. 소수점 표시는 유효숫자 5자리 근삿값이며 내부 계산은 반올림하지 않습니다.</p><p>단회 원액량 = kg × 용량 ÷ 원액 농도. 지속주입 mg/hr = kg × mcg/kg/min × 60 ÷ 1000. 펌프 mL/hr = mg/hr ÷ 조제 후 mg/mL. 원액 환산 속도는 펌프 설정값이 아닙니다.</p>'+Object.values(sources).map(s=>'<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+'</a></p>').join('')+'</details>';
  main.append(panel);const setup=g.PracticeCalculatorSettings;let records=[],cards=new Map(),lastSpecies=species.value,filter='all',detailId='',setupRows=[],setupReady=false,canManage=false,saveBusy=false,setupFailed=false,epoch=0;
  const quick=document.createElement('div');quick.className='pt-em-quick';quick.innerHTML='<p class="pt-help">농도·희석 변경은 약물별 ‘설정·근거’를 누르세요.</p><div class="pt-em-table-wrap"><table><caption>현재 종·체중 기준 응급약물 계산표</caption><thead><tr><th>약물 · 사용 조건</th><th>기준 용량</th><th>원액 농도</th><th>계산 결과</th><th>확인</th></tr></thead><tbody></tbody></table></div>';panel.querySelector('[data-em-groups]').before(quick);
  const shortNotes={epinephrine:'심정지 · 비충격 리듬 / 첫 제세동 이후',atropine:'비충격 심정지 · 초기에 1회만',vasopressin:'CPR · 에피네프린의 대안',lidocaine:'개 · 제세동 불응 VF/pVT · 단일제',amiodarone:'고양이 · 제세동 불응 VF/pVT',naloxone:'오피오이드 관련 심정지',flumazenil:'벤조디아제핀 관련 심정지',midazolam:'지속발작·군집발작 · 호흡 감시',dextrose:'증상 동반 저혈당 · 희석 후 투여',dobutamine:'수축력 저하 · 급속 주사 금지',norepinephrine:'용적 평가 후 저혈압 · 급속 주사 금지',dopamine:'저혈압 대안 · 급속 주사 금지'};
  const link=(url,label)=>/^https:\/\//.test(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'';
  for(const [id,title] of groups){const section=document.createElement('section');section.dataset.emGroup=id;section.innerHTML='<h4>'+title+'</h4><div class="pt-emergency-grid"></div>';panel.querySelector('[data-em-groups]').append(section);
   for(const d of drugs.filter(x=>x.group===id)){
    const card=document.createElement('article');card.className='pt-emergency-card';card.dataset.emDrug=d.id;
    card.innerHTML='<button type="button" data-em-back class="pt-em-config-back">← 계산표로 돌아가기</button><header><h5>'+d.name+' <span>'+d.ko+'</span></h5><b>'+d.route+'</b></header><p class="pt-em-indication">'+d.note+'</p><label>기준 용량 · '+d.unit+'/kg'+(id==='cri'?'/min':'/회')+'<input data-em-dose inputmode="decimal" autocomplete="off" '+(d.range?'':'readonly')+'></label><small data-em-dose-note></small>'+(d.range?'<button type="button" data-em-dose-reset>문헌 초기값으로 되돌리기</button>':'')+'<div class="pt-em-result" data-em-result aria-live="polite"></div><details data-em-settings><summary>농도·'+(id==='cri'?'희석 설정':'계산 기준')+'</summary><label>원액 농도 선택<select data-em-stock-choice></select></label><label>실제 원액 · '+(d.unit==='U'?'U':'mg')+'/mL<input data-em-stock inputmode="decimal" autocomplete="off"></label><small data-em-stock-note></small>'+(id==='cri'?'<label>희석 계산 방식<select data-em-mix-mode><option value="concentration">희석 농도 기준 → 펌프 속도 자동 계산</option><option value="prepare">주입속도 지정 → 필요한 원액량 계산</option><option value="pump">원액량 직접 입력 → 주입속도 계산</option></select></label><div class="pt-grid"><label data-em-concentration-label>희석 후 농도 · mg/mL<input data-em-concentration inputmode="decimal" autocomplete="off" value="'+dilutionReferences[d.id].concentration+'"></label><label>약물 포함 최종 수액량<select data-em-bag><option value="100">100 mL</option><option value="500">500 mL</option><option value="custom">직접 입력</option></select></label><label data-em-custom-volume hidden>약물 포함 최종 부피 · mL<input data-em-volume value="100" inputmode="decimal" autocomplete="off"></label><label data-em-rate-label>의료진이 정한 펌프 속도 · mL/hr<input data-em-rate inputmode="decimal" autocomplete="off" placeholder="환자 수액 계획에 맞춰 입력"></label><label data-em-stock-ml-label hidden>혼합할 원액 · mL<input data-em-stock-ml inputmode="decimal" autocomplete="off" placeholder="실제 원액량"></label><label>제품 지침에서 확인한 희석액<select data-em-diluent><option value="">희석액 선택</option><option value="ns">N/S · 0.9% 생리식염수</option><option value="d5w">D5W · 5% 포도당</option><option value="other">기타 · 제품 지침 확인</option></select></label></div><p class="pt-help" data-em-dilution-origin>기본 조제 농도 · 기존 참고 농도의 1/10</p><details class="pt-em-optional"><summary>펌프·전체 수액 확인 · 선택사항</summary><div class="pt-grid"><label>펌프 최소 정확 주입속도 · mL/hr<input data-em-pump-min inputmode="decimal" placeholder="장비 사양"></label><label>다른 정맥라인 합계 · mL/hr<input data-em-other-rate inputmode="decimal" placeholder="이번 환자의 다른 수액"></label></div></details><p class="pt-help" data-em-diluent-note></p><label class="pt-choice"><input type="checkbox" data-em-mix-confirm>조제량·희석액 적합성·주입 경로를 확인했습니다.</label><div class="pt-bar"><button type="button" data-em-save disabled>병원 희석 설정 저장</button><button type="button" data-em-reload disabled>저장값 불러오기</button></div><p class="pt-help" data-em-save-state role="status">병원 설정 불러오는 중…</p><details><summary>조제·보관 기준과 참고 근거</summary><p class="pt-help">100·500 mL는 약물을 포함한 최종 목표 부피입니다. 백에서 원액량만큼 빼고 넣는 방식이며 실제 충전량·과충전 여부를 확인하세요. 다른 약물과 한 백에 혼합하는 계산이 아닙니다. 제품별 안정성·사용 가능 시간, 전체 수액량·펌프 최소 속도·사강을 확인합니다.</p><p>기본 조제 농도는 원내 요청에 따라 기존 참고 농도의 1/10로 설정했습니다. 같은 처방 용량에서 원액 첨가량은 1/10, 펌프 속도는 10배입니다. 아래 제품 자료는 조정 전 농도의 출처이며, 변경한 농도·희석액의 적합성은 실제 제품 지침으로 확인하세요. 완제품의 희석액·보관기간을 원내 조제액에 그대로 적용하지 않습니다. 농도·원액·최종 부피·희석액·장비 기준만 저장하며 체중·처방 용량·환자별 수액 속도는 저장하지 않습니다.</p><a href="'+esc(dilutionReferences[d.id].url)+'" target="_blank" rel="noopener noreferrer">'+esc(dilutionReferences[d.id].label)+'</a></details>':'')+'<div data-em-source></div></details>';
    section.querySelector('.pt-emergency-grid').append(card);const c={d,el:card,dose:card.querySelector('[data-em-dose]'),stock:card.querySelector('[data-em-stock]'),choice:card.querySelector('[data-em-stock-choice]'),out:card.querySelector('[data-em-result]'),options:[],touched:false,doseTouched:false,mixTouched:false,record:null,setupProblem:''};cards.set(d.id,c);
    const row=document.createElement('tr');row.dataset.emRow=d.id;row.innerHTML='<th scope="row">'+d.name+'<small>'+d.ko+' · '+d.route+'</small><small>'+shortNotes[d.id]+'</small></th><td data-em-q-dose></td><td data-em-q-stock></td><td data-em-q-result></td><td><button type="button" data-em-open="'+d.id+'" aria-label="'+d.name+' 농도·근거 설정">설정·근거</button></td>';quick.querySelector('tbody').append(row);c.row=row;
    card.querySelector('[data-em-back]').onclick=()=>{detailId='';layoutDetails();quick.scrollIntoView({block:'start',behavior:'instant'});row.querySelector('button').focus({preventScroll:true});};
    row.querySelector('button').onclick=()=>{detailId=detailId===d.id?'':d.id;layoutDetails();if(detailId){card.querySelector('[data-em-settings]').open=true;card.scrollIntoView({block:'start',behavior:'instant'});card.querySelector('[data-em-stock-choice]').focus({preventScroll:true});}};
    c.choice.onchange=()=>{c.mixTouched=true;epoch++;c.touched=true;const x=c.options.find(x=>x.id===c.choice.value);c.stock.value=x?x.value:'';invalidateMix(c);stockNote(c);refresh();};
    card.querySelector('[data-em-dose-reset]')?.addEventListener('click',()=>{if(!o.guard())return;c.dose.value=c.d.dose[species.value]??'';c.doseTouched=false;invalidateMix(c);refresh();});
    card.addEventListener('input',e=>{epoch++;if(e.target.matches('[data-em-stock],[data-em-concentration],[data-em-volume],[data-em-pump-min]')){c.setupProblem='';c.mixTouched=true;setupStatus(c,'이번 계산에서 수정 · 저장 전');}if(e.target===c.dose)c.doseTouched=true;if(e.target===c.stock){c.choice.value='manual';c.touched=true;stockNote(c);}if(e.target!==card.querySelector('[data-em-mix-confirm]'))invalidateMix(c);refresh();});
    card.querySelector('[data-em-mix-confirm]')?.addEventListener('change',async()=>{
     if(c.record&&!c.mixTouched&&card.querySelector('[data-em-mix-confirm]').checked&&o.fresh){
      const start=epoch;card.querySelector('[data-em-mix-confirm]').checked=false;refresh();
      try{const r=await o.fresh();if(!o.guard()||start!==epoch)return;const p=setup.find(setup.partition(r).setupItems,setupKey(c));if(!p||p.revision!==c.record.revision||p.body.note!==c.record.body.note)throw Error('병원 희석 설정이 변경됐습니다. 저장값 불러오기 후 확인하세요.');card.querySelector('[data-em-mix-confirm]').checked=true;}
      catch(e){if(o.guard()){c.setupProblem=e.message;setupStatus(c,e.message);}}
     }refresh();
    });
    card.addEventListener('change',e=>{if(e.target.matches('[data-em-mix-mode],[data-em-bag],[data-em-diluent]')){epoch++;c.mixTouched=true;setupStatus(c,'이번 계산에서 수정 · 저장 전');if(e.target.matches('[data-em-mix-mode]')){card.querySelector('[data-em-stock-ml]').value='';card.querySelector('[data-em-rate]').value='';}if(e.target.matches('[data-em-bag]'))card.querySelector('[data-em-volume]').value=e.target.value==='custom'?'':e.target.value;invalidateMix(c);mixLayout(c);refresh();}});
    card.querySelector('[data-em-save]')?.addEventListener('click',()=>saveSetup(c));
    card.querySelector('[data-em-reload]')?.addEventListener('click',()=>reloadSetup(c));
    mixLayout(c);
   }
  }

  const setupKey=c=>'emergency:'+c.d.id;
  function setupValues(c){return {concentration:c.el.querySelector('[data-em-concentration]').value,stock:c.stock.value,volume:c.el.querySelector('[data-em-volume]').value,diluent:c.el.querySelector('[data-em-diluent]').value,pumpMin:c.el.querySelector('[data-em-pump-min]').value};}
  function setupButtons(c){if(c.d.group!=='cri')return;const enabled=setupReady&&!setupFailed&&!saveBusy&&!!setup&&!!o.fresh;c.el.querySelector('[data-em-save]').disabled=!enabled||!canManage||c.el.querySelector('[data-em-mix-mode]').value!=='concentration';c.el.querySelector('[data-em-reload]').disabled=!enabled;}
  function setupStatus(c,text){if(c.d.group!=='cri')return;c.el.querySelector('[data-em-save-state]').textContent=text;setupButtons(c);c.el.querySelector('[data-em-dilution-origin]').textContent=c.mixTouched?'이번 계산에서 수정한 농도':c.record?'병원 저장 희석 농도 · 개·고양이 공통':'기본 조제 농도 · 기존 참고 농도의 1/10';}
  function applySetup(c,p){
   const m=setup.fact(p);if(!m||m.key!==setupKey(c))throw Error('저장된 희석 설정을 확인해주세요.');
   for(const [k,v] of Object.entries(m.values)){const el=k==='stock'?c.stock:c.el.querySelector('[data-em-'+({concentration:'concentration',volume:'volume',diluent:'diluent',pumpMin:'pump-min'}[k])+']');if(el)el.value=v;}
   if(m.values.pumpMin===undefined)c.el.querySelector('[data-em-pump-min]').value='';
   c.choice.value='manual';c.touched=true;c.record=p;c.mixTouched=false;c.setupProblem='';
   c.el.querySelector('[data-em-bag]').value=['100','500'].includes(m.values.volume)?m.values.volume:'custom';
   c.el.querySelector('[data-em-mix-mode]').value='concentration';invalidateMix(c);stockNote(c);mixLayout(c);setupStatus(c,'병원 저장값 · '+(p.updated_at||'저장 완료'));
  }
  function receiveSetup(c){if(c.d.group!=='cri')return;try{const p=setup?.find(setupRows,setupKey(c));c.setupProblem='';if(c.mixTouched){setupStatus(c,'이번 계산에서 수정 · 저장 전');return;}if(p){applySetup(c,p);}else if(c.record){c.record=null;c.setupProblem='저장된 희석 설정이 삭제·보관됐습니다. 농도를 확인해 다시 설정하세요.';invalidateMix(c);setupStatus(c,c.setupProblem);}else setupStatus(c,canManage?'참고 설정 · 확인 후 병원 기본값으로 저장 가능':'참고 설정 · 저장은 병원 관리 권한 필요');}catch(e){c.setupProblem=e.message;invalidateMix(c);setupStatus(c,e.message);}}
  async function reloadSetup(c){
   if(!o.guard()||saveBusy||!setupReady)return;const start=epoch,before=JSON.stringify(setupValues(c));setupStatus(c,'저장값 불러오는 중…');
   try{const r=await o.fresh();if(!o.guard()||start!==epoch||before!==JSON.stringify(setupValues(c)))return;const rows=setup.partition(r).setupItems,p=setup.find(rows,setupKey(c));setupRows=rows;canManage=!!r.canManage;if(!p){c.record=null;c.mixTouched=true;c.setupProblem='';setupStatus(c,'저장된 희석 설정 없음 · 현재 입력 유지');invalidateMix(c);}else applySetup(c,p);refresh();}catch(e){if(o.guard()){invalidateMix(c);setupStatus(c,'불러오기 실패 · '+e.message);refresh();}}
  }
  async function saveSetup(c){
   if(!o.guard()||saveBusy||!setupReady||!canManage||c.el.querySelector('[data-em-mix-mode]').value!=='concentration')return;
   if(!c.el.querySelector('[data-em-mix-confirm]').checked){setupStatus(c,'희석액·조제량·주입 경로를 확인한 뒤 저장하세요.');return;}
   let payload;try{payload=setup.body('emergency',setupKey(c),setupValues(c));}catch(e){setupStatus(c,e.message);return;}
   const before=JSON.stringify(setupValues(c)),start=epoch,old=c.record;saveBusy=true;for(const card of cards.values())setupButtons(card);setupStatus(c,'병원 희석 설정 저장 중…');let sent=false;
   try{
    const r=await o.fresh();if(!o.guard()||start!==epoch||before!==JSON.stringify(setupValues(c)))throw Error('입력이 변경되어 저장하지 않았습니다.');
    if(!r.canManage)throw Error('병원 설정 저장 권한이 없습니다.');
    const latest=setup.find(setup.partition(r).setupItems,setupKey(c));
    if((latest?.id||'')!==(old?.id||'')||(latest?.revision||0)!==(old?.revision||0))throw Error('다른 화면에서 설정이 변경됐습니다. 저장값 불러오기 후 확인하세요.');
    sent=true;await o.request('/practice/presets'+(old?'/'+encodeURIComponent(old.id):''),{method:old?'PUT':'POST',body:JSON.stringify({...payload,...(old?{revision:old.revision}:{})})});
    const saved=await o.fresh();if(!o.guard())return;const p=setup.find(setup.partition(saved).setupItems,setupKey(c));
    if(!p||p.body.note!==payload.note)throw Error('저장 결과를 확인하지 못했습니다.');
    const changed=start!==epoch||before!==JSON.stringify(setupValues(c));c.record=p;
    if(!changed)applySetup(c,p);else c.mixTouched=true;
    o.changed(saved);if(changed)setupStatus(c,'요청한 설정 저장 완료 · 이후 수정한 입력은 저장 전');
   }catch(e){if(o.guard())setupStatus(c,(sent?'저장 상태 확인 필요 · ':'')+e.message);}
   finally{saveBusy=false;if(o.guard()){for(const card of cards.values())setupButtons(card);refresh();}}
  }
  function mixLayout(c){
   if(c.d.group!=='cri')return;
   const el=c.el,mode=el.querySelector('[data-em-mix-mode]').value,prepare=mode==='prepare';
   el.querySelector('[data-em-rate-label]').hidden=!prepare;
   el.querySelector('[data-em-stock-ml-label]').hidden=mode!=='pump';
   el.querySelector('[data-em-concentration-label]').hidden=mode!=='concentration';
   setupButtons(c);
   el.querySelector('[data-em-custom-volume]').hidden=el.querySelector('[data-em-bag]').value!=='custom';
   const diluent=el.querySelector('[data-em-diluent]').value;
   el.querySelector('[data-em-diluent-note]').textContent=c.d.id==='norepinephrine'?'노르에피네프린 농축제는 포도당 함유 희석액을 요구하고 N/S 단독을 권장하지 않는 제품이 있습니다. '+(diluent==='ns'?'선택한 실제 제품이 N/S 단독 희석을 허용하는지 반드시 확인하세요.':'실제 제품 허가사항으로 희석액·사용 가능 시간을 확인하세요.'):'도부타민·도파민은 N/S 또는 D5W가 허용되는 제품이 있으나 실제 제품 지침의 농도·희석액·사용 가능 시간을 확인하세요.';
  }
  function invalidateMix(c){const check=c.el.querySelector('[data-em-mix-confirm]');if(check)check.checked=false;}
  function stockNote(c){const x=c.options.find(x=>x.id===c.choice.value);c.el.querySelector('[data-em-stock-note]').textContent=x?(x.clinic?'병원 저장값':'공통 함량 목록 · 실제 앰플 확인')+(x.note?' · '+x.note:''):'직접 입력 · 실제 주사제의 1mL당 함량을 확인하세요.';c.el.querySelector('[data-em-source]').innerHTML=(x?link(x.sourceUrl,'함량 출처'):'')+' '+c.d.refs.map(k=>link(sources[k].url,sources[k].name)).join(' · ');}
  function layoutDetails(){panel.classList.toggle('pt-em-config-open',!!detailId);for(const c of cards.values()){c.el.hidden=c.d.id!==detailId;c.row.hidden=filter!=='all'&&c.d.group!==filter;c.row.querySelector('button').setAttribute('aria-expanded',String(c.d.id===detailId));}panel.querySelectorAll('[data-em-group]').forEach(x=>x.hidden=!detailId||!cards.get(detailId)||cards.get(detailId).d.group!==x.dataset.emGroup);}
  function updateQuick(c){const d=c.d;c.row.querySelector('[data-em-q-dose]').textContent=d.dose[species.value]?c.dose.value+' '+d.unit+'/kg'+(d.group==='cri'?'/min':'/회'):(['dog','cat'].includes(species.value)?'해당 종 적용 제외':'동물 선택 필요');c.row.querySelector('[data-em-q-stock]').textContent=c.stock.value?fmt(Number(c.stock.value))+' '+(d.unit==='U'?'U':'mg')+'/mL':'농도 선택 필요';const cell=c.row.querySelector('[data-em-q-result]');cell.replaceChildren();const primary=c.out.querySelector('strong');if(primary){const strong=document.createElement('strong');strong.textContent=primary.textContent;cell.append(strong);if(d.group==='cri'){const small=document.createElement('small');small.textContent=c.out.querySelector('.pt-em-setup')?.textContent||c.out.querySelector('span').textContent;cell.append(small);}if(c.out.querySelector('.pt-dose-review')){const note=document.createElement('small');note.textContent=[...c.out.querySelectorAll('.pt-dose-review')].map(x=>x.textContent).join(' · ');cell.append(note);}if(c.out.querySelector('.pt-em-measure')){const small=document.createElement('small');small.textContent='미량 · 희석·측정 계획 확인';cell.append(small);}}else cell.textContent=c.out.textContent;}
  function loadOptions(c){c.options=concentrationOptions(c.d,records,species.value);const old=c.choice.value,value=c.stock.value;c.choice.innerHTML=c.options.map(x=>'<option value="'+esc(x.id)+'">'+(x.clinic?'병원 · ':'공통 · ')+fmt(x.value)+' '+(c.d.unit==='U'?'U':'mg')+'/mL</option>').join('')+'<option value="manual">직접 입력</option>';if(c.touched){c.choice.value=c.options.some(x=>x.id===old)?old:'manual';c.stock.value=value;}else{const unique=[...new Set(c.options.filter(x=>x.clinic).map(x=>x.value))];if(unique.length>1){c.choice.value='manual';c.stock.value='';}else{const selected=c.options[0];c.choice.value=selected.id;c.stock.value=selected.value;}}stockNote(c);}
  function weightProblem(){const record=b.querySelector('[data-record-weight-confirm]');if(record&&!record.closest('label').hidden&&!record.checked)return '기록 체중의 측정일을 확인한 뒤 상단 확인란을 선택해주세요.';try{num(weight.value,'체중 · kg',200);}catch(e){return e.message;}return '';}
  function refresh(){if(!o.guard())return;const sp=species.value,valid=['dog','cat'].includes(sp),problem=valid?weightProblem():'상단에서 개 또는 고양이를 선택해주세요.';panel.querySelector('[data-em-context]').textContent=problem||((sp==='dog'?'개':'고양이')+' · '+weight.value+' kg · 아래 원액 농도 기준의 계산값');
   for(const c of cards.values()){const d=c.d,enabled=!!d.dose[sp];const doseNote=c.el.querySelector('[data-em-dose-note]');doseNote.textContent=d.range?.[sp]?(c.doseTouched?'수의사 수정값':'문헌 초기값')+' · 참고 범위 '+d.range[sp].join('–')+' '+d.unit+'/kg'+(d.group==='cri'?'/min':'/회'):'지침의 고정 기준 · 해당 적응증에만 적용';c.el.dataset.available=String(enabled);c.dose.disabled=!enabled;
    if(!enabled||problem){c.out.textContent=!valid?problem:!enabled?(d.id==='amiodarone'?'개 자동 계산 제외 · 제품 첨가제와 대체 약물 확인':'이 종의 CPR 자동 용량 없음 · 개 용량을 적용하지 마세요.'):problem;c.out.className='pt-em-result pt-em-pending';updateQuick(c);continue;}
    try{const cri=d.group==='cri',v={species:sp,weight:weight.value,dose:c.dose.value,stock:c.stock.value,stockML:c.el.querySelector('[data-em-stock-ml]')?.value,volume:c.el.querySelector('[data-em-volume]')?.value,mixMode:c.el.querySelector('[data-em-mix-mode]')?.value,rate:c.el.querySelector('[data-em-rate]')?.value,concentration:c.el.querySelector('[data-em-concentration]')?.value},r=calculate(d.id,v);c.out.className='pt-em-result';
     if(cri){
      const diluent=c.el.querySelector('[data-em-diluent]'),confirmed=c.el.querySelector('[data-em-mix-confirm]').checked&&!!diluent.value;
      const recipe=r.rate?'원액 '+fmt(r.stockML)+' mL + 희석액 '+fmt(r.diluentML)+' mL = 최종 '+fmt(r.volume)+' mL':'';
      if(c.setupProblem)throw Error(c.setupProblem);
      const minimum=c.el.querySelector('[data-em-pump-min]').value,other=c.el.querySelector('[data-em-other-rate]').value;
      const low=minimum!==''&&r.rate<num(minimum,'펌프 최소 정확 주입속도');
      let total='';if(other!==''){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(other)||!Number.isFinite(+other)||+other>1e6)throw Error('다른 정맥라인 속도를 확인해주세요.');total='<span>다른 라인 포함 '+fmt(r.rate+Number(other))+' mL/hr · '+fmt((r.rate+Number(other))/Number(weight.value))+' mL/kg/hr</span>';}
      c.out.innerHTML='<strong>'+(confirmed&&!low?'펌프 ':'예상 펌프 ')+fmt(r.rate)+' mL/hr'+(!confirmed||low?' · 확인 전':'')+'</strong><span class="pt-em-setup">'+recipe+' · '+(diluent.value?esc(diluent.selectedOptions[0].textContent):'희석액 선택 필요')+'</span>'+
       '<span>이 약물 수액 '+fmt(r.rate/Number(weight.value))+' mL/kg/hr · '+fmt(r.hourly)+' mg/hr</span>'+total+
       (low?'<b class="pt-dose-review">장비의 최소 정확 주입속도 미만입니다. 농도·펌프를 재검토하세요.</b>':'')+
       (!confirmed?'<small>희석액·조제량·주입 경로 확인 후 적용</small>':'')+
       '<details><summary>농도·전량 소요시간</summary><span>'+fmt(r.concentration)+' mg/mL · 전량 '+duration(r.hours)+'</span><small>전량 소요시간은 조제액 사용 가능 시간과 다릅니다.</small>'+
       (r.hours>24?'<small>24시간을 넘는 계획: 제품별 안정성에 따라 백 교체·폐기를 정하고, 전량 소진을 위해 속도를 높이지 마세요.</small>':'')+'</details>';

     }
     else c.out.innerHTML='<span>1회 약물량 '+fmt(r.amount)+' '+d.unit+'</span><strong>'+(d.dilution?'희석 전 원액 ':'준비할 원액 ')+fmt(r.volume)+' mL</strong><small>'+fmt(Number(c.dose.value))+' '+d.unit+'/kg × '+weight.value+' kg ÷ '+fmt(Number(c.stock.value))+' '+d.unit+'/mL</small>'+(r.volume<0.1?'<small class="pt-em-measure">0.1 mL 미만 · 주사기 눈금에 맞는 희석·측정 계획 확인</small>':'');
    const doseReview=document.createElement('small');doseReview.dataset.emDoseReview='';doseReview.className=r.doseOutside?'pt-dose-review':'pt-help';doseReview.hidden=!r.doseOutside&&!c.doseTouched;doseReview.textContent=r.doseOutside?'수의사 수정값 · 문헌 범위 밖 · 단위·처방 근거 확인':c.doseTouched?'수의사 수정값 · 입력 용량 환산':'문헌 기준값 환산';c.out.append(doseReview);
    }catch(e){c.out.className='pt-em-result pt-em-pending';c.out.textContent=e.message;}updateQuick(c);
   }
  }
  function contextChanged(){epoch++;const changed=lastSpecies!==species.value;lastSpecies=species.value;for(const c of cards.values()){if(changed){c.doseTouched=false;c.dose.value=c.d.dose[species.value]??'';c.touched=false;loadOptions(c);if(c.d.group==='cri'&&c.record&&!c.mixTouched)applySetup(c,c.record);c.el.querySelectorAll('[data-em-stock-ml],[data-em-rate]').forEach(x=>x.value='');}invalidateMix(c);c.el.querySelector('[data-em-dose-note]').textContent=c.d.range?.[species.value]?'참고 범위 '+c.d.range[species.value].join('–')+' '+c.d.unit+'/kg'+(c.d.group==='cri'?'/min':'/회')+' · 환자 반응에 맞춰 선택':'지침의 고정 기준 · 해당 적응증에만 적용';}refresh();}
  for(const c of cards.values()){c.dose.value=c.d.dose[species.value]??'';loadOptions(c);}contextChanged();layoutDetails();
  weight.addEventListener('input',()=>{epoch++;for(const c of cards.values())invalidateMix(c);refresh();});species.addEventListener('change',contextChanged);b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))refresh();});
  panel.querySelectorAll('[data-em-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.emFilter;detailId='';layoutDetails();panel.querySelectorAll('[data-em-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));});
  panel.querySelector('[data-em-print]').onclick=()=>{if(!o.guard())return;refresh();if(weightProblem()||!['dog','cat'].includes(species.value)){panel.querySelector('[data-em-context]').focus();return;}const win=window.open('','_blank');if(!win){panel.querySelector('[data-em-context]').textContent='인쇄창이 차단됐습니다. 브라우저의 팝업 설정을 확인해주세요.';return;}const html=[...cards.values()].filter(c=>c.d.dose[species.value]&&(filter==='all'||c.d.group===filter)).map(c=>'<article><h2>'+c.d.name+' · '+c.d.ko+'</h2><p>'+esc(c.d.route)+' · 원액 '+esc(c.stock.value)+' '+(c.d.unit==='U'?'U':'mg')+'/mL</p><p>'+esc(c.out.innerText)+'</p><p>'+esc(c.d.note)+'</p></article>').join('');win.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><title>응급약물 계산표</title><style>body{font:14px sans-serif;color:#142d48}article{break-inside:avoid;border:1px solid #ccc;padding:10px;margin:8px 0}h2{font-size:17px}p{white-space:pre-line}button{padding:12px}@media print{button{display:none}}</style><button onclick="window.print()">인쇄 · PDF로 저장</button><h1>응급약물 참고 계산표</h1><p>'+esc(panel.querySelector('[data-em-context]').textContent)+' · '+new Date().toLocaleString('ko-KR')+'</p><p>환자 상태·적응증·경로·제품 농도를 확인합니다. 표시값은 원액량이며 희석 후 주입량과 다를 수 있습니다.</p>'+html+'<p>근거: RECOVER 2024 · ACVIM 2024 · AAHA 2024 · 각 카드의 출처. 확인 2026-10-25</p></html>');win.document.close();};
  return {loaded(r){records=r.items||[];setupRows=setup?.partition(r).setupItems||[];setupReady=true;setupFailed=false;canManage=!!r.canManage;for(const c of cards.values()){if(!c.touched){invalidateMix(c);loadOptions(c);}receiveSetup(c);}refresh();},failed(){setupReady=false;setupFailed=true;canManage=false;for(const c of cards.values()){invalidateMix(c);setupStatus(c,'병원 설정 불러오기 실패 · 현재 입력 유지');}refresh();},refresh,contextChanged,reset(){for(const c of cards.values()){if(c.d.group==='cri')c.el.querySelector('[data-em-other-rate]').value='';}lastSpecies='';contextChanged();}};
 }
 const api={drugs,sources,dilutionReferences,duration,calculate,concentrationOptions,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeEmergency=api;
})(typeof window==='object'?window:globalThis);
