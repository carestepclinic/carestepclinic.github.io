/* Public clinical references and verified injectable strengths, not automatic prescriptions. */
(function(g){
 'use strict';
 const refs={pain:'https://wsava.org/wp-content/uploads/2020/01/Recognition-Assessment-and-Treatment-of-Pain-Guidelines.pdf',sepsis:'https://doi.org/10.3389/fvets.2021.622127',seizure:'https://doi.org/10.1111/jvim.16928',gi:'https://www.merckvetmanual.com/multimedia/table/antiemetic-drugs'};
 const stock=(value,unit,item,basis)=>({value,unit,url:'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq='+item,basis});
 Object.assign(refs,{furosemide:'https://www.merckvetmanual.com/pharmacology/systemic-pharmacotherapeutics-of-the-cardiovascular-system/diuretics-for-use-in-animals',propofol:'https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2543398.PDF',mannitol:'https://www.merckvetmanual.com/pharmacology/systemic-pharmacotherapeutics-of-the-urinary-system/diuretics-used-to-treat-urinary-disease-in-animals',metronidazole:'https://www.merckvetmanual.com/emergency-medicine-and-critical-care/monitoring-the-critically-ill-small-animal/monitoring-the-critically-ill-small-animal-using-the-rule-of-20'});
 const drugs=[
  {id:'dobutamine',name:'Dobutamine · 도부타민',ingredient:'mfds-0765b38b1109711db88d',group:'circulation',unit:'mcg/kg/min',ref:'sepsis',stocks:[stock(50,'mg','199000148','도부타민')],note:'수축력 저하 · 심전도·혈압 감시. 급속 일회 주사 금지.'},
  {id:'norepinephrine',name:'Norepinephrine · 노르에피네프린',ingredient:'mfds-5f6d1e61e10332df5d31',group:'circulation',unit:'mcg/kg/min',ref:'sepsis',stocks:[stock(1,'mg','199806705','노르에피네프린')],note:'용적 평가 후 지속 저혈압 · 혈압·관류·주사부위 감시. 제품에 따라 포도당 함유 희석액이 필요하며 N/S 단독 적합성을 별도로 확인합니다.'},
  {id:'dopamine',name:'Dopamine · 도파민',ingredient:'mfds-c4c06e9554aa2d1aec2c',group:'circulation',unit:'mcg/kg/min',ref:'sepsis',stocks:[stock(40,'mg','197800042','도파민염산염')],note:'저혈압 대안 · 빈맥·부정맥 감시. 신장 보호 목적으로 자동 적용하지 않습니다.'},
  {id:'fentanyl',name:'Fentanyl · 펜타닐',ingredient:'mfds-3e5461612667fdf7dfc8',group:'pain',unit:'mcg/kg/hr',ref:'pain',stocks:[stock(50,'mcg','198601875','펜타닐')],note:'진통 · 호흡·진정·심박수 감시. mcg와 mg, 시간당과 분당 단위를 구분합니다.'},
  {id:'ketamine',name:'Ketamine · 케타민',ingredient:'mfds-367581e5934d0c20440e',group:'pain',unit:'mg/kg/hr',ref:'pain',stocks:[stock(50,'mg','200604139','케타민')],note:'보조 진통 · 마취 유도 용량과 구분합니다. 의식·심혈관 상태 및 간·신장 기능을 평가합니다. 염산염 질량을 케타민 질량과 혼동하지 마세요.'},
  {id:'lidocaine',name:'Lidocaine · 리도카인',ingredient:'manual-5156be2eadcb080c8749',group:'pain',species:['dog'],unit:'mg/kg/hr',ref:'pain',stocks:[stock(20,'mg','197900151','리도카인염산염 · 에피네프린 없는 단일제')],note:'개 보조 진통용 항목 · 고양이 공통 CRI에는 제공하지 않습니다. 에피네프린 복합제 제외. 심전도·신경 증상 감시.'},
  {id:'morphine',name:'Morphine · 모르핀',ingredient:'mfds-6059025e4884a2c0e234',group:'pain',unit:'mg/kg/hr',ref:'pain',stocks:[stock(10,'mg','198401387','모르핀염산염수화물')],note:'진통 · 실제 제품의 염·함량 기준을 처방과 대조합니다. 호흡·진정·혈압 감시, 급속 주사 주의.'},
  {id:'midazolam',name:'Midazolam · 미다졸람',ingredient:'mfds-43c17d96856f599dbecb',group:'seizure',unit:'mg/kg/hr',ref:'seizure',stocks:[stock(1,'mg','200009363','미다졸람'),stock(5,'mg','200109948','미다졸람')],note:'지속·군집 발작 관리 · 의식·호흡·발작 반응 감시. 진정 목적과 용량을 구분합니다.'},
  {id:'metoclopramide',name:'Metoclopramide · 메토클로프라미드',ingredient:'mfds-bd55d21ec240c22cf428',group:'gi',unit:'mg/kg/hr',ref:'gi',stocks:[stock(4.23,'mg','198800560','메토클로프라미드 유효성분 기준')],note:'구토·위장관 운동 관리 · 폐색·천공 등 금기와 신장 기능을 확인합니다. 1일량은 24로 나눈 시간당량을 입력합니다. 염산염수화물 10 mg/2mL와 유효성분 농도 4.23 mg/mL는 기준이 다릅니다.'},
  {id:'furosemide',name:'Furosemide · 푸로세미드',ingredient:'mfds-7a75e85ac2c6f02e62d7',group:'diuretic',unit:'mg/kg/hr',ref:'furosemide',stocks:[stock(10,'mg','196400036','푸로세미드')],note:'지속주입 · 탈수·혈압·소변량·신장기능·전해질 감시. 산성 약물과 혼합 시 침전 위험이 있어 라인 적합성을 확인합니다.'},
  {id:'propofol',name:'Propofol · 프로포폴',ingredient:'mfds-bd11aec3c2ce50c8e483',group:'anesthesia',mode:'undiluted',unit:'mg/kg/min',ref:'propofol',stocks:[stock(10,'mg','201100959','프로포폴'),stock(20,'mg','202106888','프로포폴')],note:'원액 지속주입 · 마취 유지 용량을 입력합니다. 기관삽관·산소·환기 준비와 호흡·혈압 감시가 필요합니다. 고양이 반복·장시간 사용 시 회복 지연·산화성 적혈구 손상에 주의하며 제품별 개봉 후 사용 시간을 확인합니다.'},
  {id:'metronidazole',name:'Metronidazole · 메트로니다졸',ingredient:'mfds-908373555273c765326b',group:'intermittent',mode:'intermittent',unit:'mg/kg/dose',ref:'metronidazole',stocks:[{value:5,unit:'mg',url:'https://www.baxter.ca/sites/g/files/ebysai1431/files/2018-11/Metronidazole_Inj_EN.pdf',basis:'메트로니다졸 · 5 mg/mL 완제품 주입액 (국외 제조사 자료)'}],note:'1회 정맥 주입 · 투여 간격과 주입 시간은 처방을 확인합니다. 5 mg/mL 완제품은 추가 희석 없이 사용할 수 있으며 실제 제품 설명을 우선합니다. 누적량·간기능·신경 증상과 다른 약물 혼합 적합성을 확인합니다.'},
  {id:'mannitol',name:'Mannitol · 만니톨',ingredient:'mfds-29dab29cc77b8c0123e3',ingredients:['mfds-f03abe533f449de88b73','mfds-29dab29cc77b8c0123e3'],group:'intermittent',mode:'intermittent',unit:'g/kg/dose',ref:'mannitol',stocks:[stock(150,'mg','196800016','만니톨 15%'),stock(200,'mg','197100028','만니톨 20%'),stock(250,'mg','197100027','만니톨 25%')],note:'1회 정맥 주입 · g와 mg를 구분합니다 (20% = 200 mg/mL). 적응증별 처방량·시간·반복 여부를 확인하고 소변량·체액·전해질을 감시합니다. 결정 유무와 제품별 필터·용해 지침을 확인하세요. 무뇨·과수화에서는 재평가가 필요합니다.'}
 ];

 // Ranges are indication-specific references, not universal therapeutic limits.
 // Initial values use the lower end of the cited range, except explicitly described starts.
 const clinicalSources={
  wsava:{label:'WSAVA 2022 통증 지침 · 표 12·14, 3.12',url:'https://onlinelibrary.wiley.com/doi/10.1111/jsap.13566'},
  cvma:{label:'CVMA 2023 · CRI 교육자료 · 표 1·2',url:'https://www.canadianveterinarians.net/media/hhlgn5sl/constant-rate-infusions-2023.pdf'},
  cardiac:{label:'MSD Veterinary Manual · 개·고양이 심장 약물',url:'https://www.msdvetmanual.com/multimedia/table/cardiac-medications-of-dogs-and-cats'},
  inotrope:{label:'MSD Veterinary Manual · 양성 수축력 약물',url:'https://www.msdvetmanual.com/pharmacology/systemic-pharmacotherapeutics-of-the-cardiovascular-system/positive-inotropes-for-use-in-animals'},
  sepsis:{label:'Frontiers 2021 · 개·고양이 패혈증 수액 치료',url:'https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2021.622127/full'},
  seizure:{label:'Veterinary Sciences 2024 · 응급 발작 관리 · 표 2',url:'https://www.mdpi.com/2306-7381/11/6/277'},
  gi:{label:'MSD Veterinary Manual · 항구토 약물',url:'https://www.merckvetmanual.com/multimedia/table/antiemetic-drugs'},
  propofol:{label:'VMD · Propomitor 10 mg/mL 제품 설명 · 유지 마취',url:refs.propofol},
  metro:{label:'MSD Veterinary Manual · 중환자 Rule of 20',url:refs.metronidazole},
  mannitol:{label:'AAHA 2024 수액 지침 · 외상성 뇌손상',url:'https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-5-fluid-therapy-in-ill-patients/'}
 };
 const range=(min,max,values,extra={})=>({min,max,start:min,values,...extra});
 const protocols={
  dobutamine:{indication:'심근 수축력 저하에 대한 순환 보조',source:'cardiac',dog:range(1,15,[1,2,5]),cat:range(0.5,5,[0.5,1,2]),note:'혈압·심전도와 관류를 보며 증감합니다. 고양이는 신경계 자극과 부정맥에 특히 주의합니다.'},
  norepinephrine:{indication:'용적 상태를 평가한 뒤 지속되는 패혈성 저혈압',source:'sepsis',both:range(0.1,1,[0.1,0.2,0.5]),note:'반응에 맞춰 적정하며 혈압·말초 관류·주사부위를 감시합니다. N/S 단독 희석 가능 여부는 실제 제품별로 확인합니다.'},
  dopamine:{indication:'순환 보조 · 저혈압에서 반응에 따른 적정',source:'inotrope',both:range(1,15,[1,5,10]),note:'저용량의 신장 보호 효과를 전제로 적용하지 않습니다. 빈맥·부정맥과 혈압을 감시하며 효과가 부족하면 치료 계획을 재평가합니다.'},
  fentanyl:{indication:'급성 통증 · 지속 진통',source:'wsava',dog:range(3,6,[3,4,6]),cat:range(2,3,[2,2.5,3]),note:'유지 진통 범위입니다. 마취제 절감 목적의 고용량과 구분하고, 부하 용량은 따로 판단합니다. 호흡·진정·통증 점수를 관찰합니다.'},
  ketamine:{indication:'수술 전후 보조 진통 · 마취 유도용 아님',source:'wsava',both:range(0.12,0.6,[0.12,0.3,0.6]),note:'문헌 2–10 mcg/kg/min을 0.12–0.6 mg/kg/hr로 환산했습니다. 다른 진통제와 병용하고 의식·혈압·회복 상태를 확인합니다.'},
  lidocaine:{indication:'개 수술 중 보조 진통',source:'wsava',dog:range(1.5,3,[1.5,2,3]),note:'25–50 mcg/kg/min의 시간당 환산값입니다. 고양이 자동 용법은 제공하지 않습니다. 국소마취제 병용 총량과 심전도·신경 증상을 확인합니다.'},
  morphine:{indication:'급성 통증 · 지속 진통',source:'cvma',dog:range(0.12,0.3,[0.12,0.2,0.3]),cat:range(0.05,0.1,[0.05,0.075,0.1]),note:'부하 투여를 포함하지 않습니다. 진정·호흡·통증·체온을 확인하고, 급속 IV 주사에 따른 히스타민 유리와 저혈압에 주의합니다.'},
  midazolam:{indication:'지속·군집 발작 · 초기 항경련 치료 후 유지',source:'seizure',both:range(0.3,0.4,[0.3,0.4]),note:'일반 진정 용법과 구분합니다. 초기 투여와 유지 항경련제 계획을 함께 확인하고 발작·호흡·의식을 감시합니다. 중단·감량은 반응에 따라 정합니다.'},
  metoclopramide:{indication:'구토 조절 · 정맥 지속주입',source:'gi',both:range(0.01,0.02,[0.01,0.015,0.02]),note:'이 자료의 항구토 IV 주입 범위입니다. 위장관 폐색·천공, 신기능과 신경계 이상반응을 확인합니다. 다른 목적의 고용량 용법은 별도 검토합니다.'},
  furosemide:{indication:'심인성 폐부종 · 급성 울혈 조절',source:'cardiac',dog:range(0.25,1,[0.25,0.5,1]),cat:range(0.25,0.6,[0.25,0.5,0.6]),note:'호흡·소변량·혈압·신기능·전해질에 맞춰 증감합니다. 탈수·저혈량을 평가하며 다른 약물과 혼합하지 말고 라인 적합성을 확인합니다.'},
  propofol:{indication:'전신마취 유지 · 유도 후 원액 지속주입',source:'propofol',dog:range(0.2,0.4,[0.2,0.3,0.4]),cat:range(0.1,0.3,[0.1,0.2,0.3]),note:'기관삽관·산소·환기 준비가 필요합니다. 전처치와 병용약에 따라 더 낮은 용량이 필요할 수 있습니다. 고양이 장시간·반복 사용 및 회복 지연에 주의합니다.'},
  metronidazole:{indication:'혐기성 감염 치료 · 1회 정맥 주입',source:'metro',both:range(10,15,[10,15]),note:'문헌 용법은 12시간 간격의 느린 IV 투여입니다. 이번 계산은 1회분이며 주입 시간은 제품·원내 지침에 맞춰 선택하세요. 단순 설사에 자동 적용하지 않습니다.'},
  mannitol:{indication:'외상성 뇌손상에서 두개내압 상승 조절',source:'mannitol',both:range(0.5,1,[0.5,1],{minutes:15}),note:'AAHA 기준 15분 주입·미세필터 사용입니다. 소변량·혈량·전해질·폐울혈을 확인하고 무뇨·과수화에서는 재평가합니다. 반복 투여는 자동 계산하지 않습니다.'}
 };
 function profileFor(id,species){const p=protocols[id],d=drugs.find(x=>x.id===id);const r=p&&(p[species]||(['dog','cat'].includes(species)&&p.both));return r?{...r,id,species,unit:d.unit,indication:p.indication,note:p.note,source:clinicalSources[p.source],checked:'2026-10-25'}:null;}
 function doseStatus(profile,value,unit){if(!profile||unit!==profile.unit)return 'unit';const n=Number(value);if(!String(value).trim()||!Number.isFinite(n)||n<=0)return 'empty';return n<profile.min||n>profile.max?'outside':'within';}


 // Compatibility candidates from product information; never a stability or Y-site guarantee.
 const dilutionSources={
  dobutamine:'https://www.medicines.org.uk/emc/product/100017/smpc',
  norepinephrine:'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=c4de72a8-2a75-4984-ce90-e4870226dc12',
  dopamine:'https://www.medicines.org.uk/emc/product/3346/smpc',
  fentanyl:'https://www.medicines.org.uk/emc/product/6617/smpc',
  ketamine:'https://www.medicines.org.uk/emc/product/100814/smpc',
  lidocaine:'https://www.medicines.org.uk/emc/product/6281/smpc',
  morphine:'https://www.anmfonline.org/wp-content/uploads/2025/05/Morphine-Intravenous-Standard-concentration_ANMFv1.0_20250526-1.pdf',
  midazolam:'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=737361a0-8db1-4d3c-ba5e-44df3f49fa22',
  metoclopramide:'https://www.medicines.org.uk/emc/product/6283/smpc',
  furosemide:'https://www.medicines.org.uk/emc/product/11522/smpc'
 };
 function dilutionFor(id){if(!dilutionSources[id])return null;const special={
  norepinephrine:'농축액 설명서의 포도당 함유 희석 기준입니다. N/S 단독 가능 여부는 제품마다 다릅니다. 차광·라인과 농도를 확인하세요.',
  furosemide:'중성·약알칼리 조건(pH 7–10)을 확인하세요. 산성 용액·다른 약물과 혼합하면 침전할 수 있습니다.',
  lidocaine:'에피네프린 없는 정맥용 단일제의 5% 포도당 희석 자료입니다. 국소마취용 제품을 그대로 전환하지 마세요.',
  morphine:'모르핀염산염의 혼합 적합성 참고입니다. 염·보존제·정맥 투여 가능 여부를 실제 앰플에서 확인하세요.'
 };return {value:['norepinephrine','lidocaine'].includes(id)?'D5W':'N/S',source:dilutionSources[id],note:special[id]||'실제 제품 설명서의 희석액·최종 농도·용기·무균 조제 조건을 확인하세요.',checked:'2026-10-25'};}

 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function options(d,records,species){
  const stored=(records||[]).filter(p=>{const s=p.body?.strength;return !p.formularyIssue&&(d.ingredients||[d.ingredient]).includes(s?.ingredientId)&&s.route==='injection'&&s.release==='standard'&&s.species?.includes(species)&&p.body.kind==='liquid'&&['mg','mcg'].includes(p.body.unit)&&Number(p.body.value)>0&&Number.isFinite(Number(p.body.value));}).map(p=>({id:'clinic:'+p.id,value:Number(p.body.value),unit:p.body.unit,basis:p.body.strength.calculationBasis||p.body.title,url:p.body.strength.sourceUrl||'',clinic:true}));
  return [...stored,...d.stocks.map((s,i)=>({...s,id:'common:'+i}))];
 }

 function mount(b,o){
  const f=b.querySelector('[data-calc=cri]'),species=b.querySelector('[data-ref-species]');if(!f||!species)return null;
  const box=document.createElement('section');box.className='pt-cri-presets';
  box.innerHTML='<h4>1. 약물 선택</h4><p class="pt-help">종별 참고 범위·단위를 표시하고, 용량은 직접 선택합니다. 아래 사용 목적과 실제 제품 함량을 확인한 뒤 계산하세요. 부하 투여량은 포함하지 않습니다.</p><details data-cri-picker open><summary>정맥 주입 약물 찾기</summary><label>약물 검색<input type="search" data-cri-search placeholder="예: 펜타닐, furosemide" autocomplete="off"></label><nav class="pt-bar" aria-label="CRI 약물 분류">'+[['all','전체'],['circulation','순환'],['pain','진통'],['seizure','발작'],['gi','위장관'],['diuretic','이뇨'],['anesthesia','마취'],['intermittent','간헐 주입']].map(([id,label])=>'<button type="button" data-cri-group="'+id+'" aria-pressed="'+(id==='all')+'">'+label+'</button>').join('')+'</nav><div class="pt-cri-choices"></div><p data-cri-empty hidden>일치하는 약물이 없습니다. 검색어 또는 분류를 변경해주세요.</p></details><p data-cri-status role="status"></p><div data-cri-reference hidden><div class="pt-cri-regimen"><h4>2. 용법 확인</h4><strong data-cri-indication></strong><p data-cri-range></p><div data-cri-dose-field></div><div class="pt-bar" data-cri-dose-buttons aria-label="참고 용량 빠른 선택"></div><p data-cri-dose-status role="status"></p><p class="pt-help">참고 범위에서 이번 환자에게 적용할 용량을 선택하세요. 하한값도 모든 환자의 권장 시작량은 아닙니다.</p><details><summary>투여 조건·모니터링·근거</summary><p data-cri-note></p><a data-cri-source target="_blank" rel="noopener noreferrer">투여 근거 확인</a><p class="pt-help">확인 2026-10-25 · 환자 반응에 맞춰 조정 · 혼합약물 조제식 아님</p></details></div><label>주사제 함량<select data-cri-stock></select></label><p class="pt-help" data-cri-stock-note></p></div><button type="button" data-cri-manual>다른 약물 직접 입력</button>';
  f.querySelector('h3').after(box);
  let records=[],selected=null,profile=null,choices=[],filter='all',touched=false,applying=false,manualEntry=false;
  const fields=f.elements,status=box.querySelector('[data-cri-status]'),stockSelect=box.querySelector('[data-cri-stock]'),picker=box.querySelector('[data-cri-picker]'),query=box.querySelector('[data-cri-search]');
  const doseLabel=fields.dose.closest('label'),doseHome=doseLabel.parentElement,doseNext=doseLabel.nextSibling;
  const valid=()=>['dog','cat'].includes(species.value);
  const saved=document.createElement('section');saved.className='pt-cri-saved';saved.hidden=true;picker.after(saved);
  function renderSaved(){saved.replaceChildren();const candidates=records.filter(p=>p.body?.kind==='protocol'&&p.body.calculator==='cri'&&p.body.species===species.value&&selected&&(g.PracticeMedicationFlow?.unpack(p.body.note).meta.criId===selected.id||p.body.defaults.drug===selected.name));saved.hidden=!candidates.length;if(!candidates.length)return;const title=document.createElement('b');title.textContent='이 약물의 병원 조제 서식';saved.append(title);for(const p of candidates){const button=document.createElement('button');button.type='button';button.textContent=p.body.title+' · '+p.body.indication;button.onclick=()=>{const select=f.querySelector('[data-protocol]');select.value=p.id;select.dispatchEvent(new Event('change',{bubbles:true}));};saved.append(button);}}
  const loading=document.createElement('details');loading.className='pt-loading-dose';loading.hidden=true;loading.innerHTML='<summary>부하 투여 검토 · 유지주입과 별도</summary><p class="pt-help">기존 전처치·유도약 투여 여부와 환자 상태를 먼저 확인합니다. 아래는 수의사가 정한 부하 용량의 원액 환산이며 자동 투여 권고가 아닙니다. 투여 시간·희석·모니터링은 원내 지침을 적용하세요.</p><div class="pt-grid"><label>확인한 부하 용량<input data-loading-dose inputmode="decimal"></label><label>부하 용량 단위<select data-loading-unit><option value="mg">mg/kg/회</option><option value="mcg">mcg/kg/회</option></select></label></div><label class="pt-choice"><input data-loading-check type="checkbox">기존 투여·부하 용량·IV 경로·실제 원액·투여 계획을 확인했습니다.</label><button type="button" data-loading-run>부하 원액량 계산</button><p data-loading-result role="status"></p><a href="https://www.canadianveterinarians.net/media/hhlgn5sl/constant-rate-infusions-2023.pdf" target="_blank" rel="noopener noreferrer">CVMA · 부하 투여와 유지주입 구분</a>';box.append(loading);
  const prior=document.createElement('label');prior.innerHTML='이번 환자에게 같은 성분을 이미 투여했나요?<select data-loading-prior><option value="">확인 후 선택</option><option value="no">투여하지 않음</option><option value="yes">이미 투여함 · 추가 필요 여부 별도 검토</option><option value="unknown">기록 확인 중</option></select>';loading.querySelector('.pt-grid').before(prior);const priorInfo=document.createElement('p');priorInfo.className='pt-help';prior.after(priorInfo);prior.querySelector('select').onchange=e=>{clearLoading();priorInfo.textContent=e.target.value==='yes'?'전처치·유도 용량과 투여 시각을 확인하고, 추가 부하 필요 여부를 판단하세요. 기존 투여량을 자동 차감하거나 반복하지 않습니다.':'';};
  loading.querySelector('[data-loading-run]').onclick=()=>{const out=loading.querySelector('[data-loading-result]');try{if(!o.guard()||!selected||!['fentanyl','morphine','ketamine'].includes(selected.id)||!valid())throw Error('약물과 동물 종류를 먼저 선택해주세요.');if(!['no','yes'].includes(prior.querySelector('select').value))throw Error('같은 성분의 이전 투여 여부를 먼저 확인해주세요.');if(!loading.querySelector('[data-loading-check]').checked)throw Error('부하 투여 계획을 먼저 확인해주세요.');const dose=Number(loading.querySelector('[data-loading-dose]').value)*(loading.querySelector('[data-loading-unit]').value==='mcg'?0.001:1),stock=Number(fields.stock.value)*(fields.stockUnit.value==='mcg'?0.001:1);if(!['mg','mcg'].includes(fields.stockUnit.value))throw Error('원액 단위를 확인해주세요.');const result=g.PracticeCalculators.dose(b.querySelector('[data-common-weight]').value,dose,stock);out.textContent='부하 투여 원액 '+g.PracticeCalculators.display(result.mL)+' mL · '+g.PracticeCalculators.display(result.mg)+' mg · 유지주입 조제량에 합산하지 않음 · 희석·완속 투여 계획 별도 확인';}catch(e){out.textContent=e.message;}};
  function clearLoading(){loading.querySelector('[data-loading-result]').textContent='';loading.querySelector('[data-loading-check]').checked=false;}
  for(const ev of ['input','change'])b.addEventListener(ev,e=>{if(e.target.matches('[data-loading-check]'))return;clearLoading();});
  function loadingState(){prior.querySelector('select').value='';priorInfo.textContent='';loading.hidden=!selected||!['fentanyl','morphine','ketamine'].includes(selected.id);loading.open=false;loading.querySelector('[data-loading-dose]').value='';clearLoading();}

  function clear(){fields.confirmed.checked=false;o.clear();}
  function notify(){fields.drug.dispatchEvent(new Event('input',{bubbles:true}));o.refresh?.();}
  function render(){
   const q=query.value.trim().toLowerCase();
   const rows=drugs.filter(d=>(filter==='all'||filter===d.group)&&(!d.species||d.species.includes(species.value))&&d.name.toLowerCase().includes(q));
   box.querySelector('.pt-cri-choices').innerHTML=rows.map(d=>'<button type="button" data-cri-drug="'+d.id+'" aria-pressed="'+(selected?.id===d.id)+'" '+(!valid()?'disabled':'')+'>'+esc(d.name)+'</button>').join('');
   box.querySelectorAll('[data-cri-drug]').forEach(btn=>btn.onclick=()=>choose(drugs.find(d=>d.id===btn.dataset.criDrug)));
   box.querySelector('[data-cri-empty]').hidden=!!rows.length;
   if(!valid())status.textContent='상단에서 개 또는 고양이를 선택해주세요.';
  }
  function doseFeedback(){
   const el=box.querySelector('[data-cri-dose-status]'),state=doseStatus(profile,fields.dose.value,fields.doseUnit.value);
   el.textContent=state==='outside'?'문헌 범위를 벗어난 직접 조정값입니다. 적응증·단위·처방 근거를 다시 확인하세요.':state==='empty'?'주입 용량을 입력하거나 참고 용량을 선택해주세요.':state==='unit'?'변경한 단위에는 위 참고 범위를 적용하지 않습니다.':'참고 범위 내 입력값 · 환자별 적합성은 별도 확인';
   el.className=state==='outside'?'pt-error':'pt-help';
   box.querySelectorAll('[data-cri-dose-value]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.criDoseValue===fields.dose.value)));
   f.criReferenceContext=profile&&selected&&fields.drug.value===selected.name&&fields.doseUnit.value===profile.unit?{...profile,id:selected.id,state}:null;
  }
  function showProfile(){
   profile=profileFor(selected.id,species.value);
   if(!profile)return;
   box.querySelector('[data-cri-indication]').textContent=(species.value==='cat'?'고양이':'개')+' · '+profile.indication;
   box.querySelector('[data-cri-range]').textContent='문헌 범위 '+profile.min+'–'+profile.max+' '+profile.unit.replace('/dose','/회')+(profile.minutes?' · '+profile.minutes+'분 주입':'');
   box.querySelector('[data-cri-note]').textContent=profile.note+' '+selected.note;
   const source=box.querySelector('[data-cri-source]');source.href=profile.source.url;source.textContent=profile.source.label;
   fields.dose.value=profile.min===profile.max?String(profile.min):'';if(profile.minutes)fields.minutes.value=String(profile.minutes);
   box.querySelector('[data-cri-dose-field]').append(doseLabel);doseLabel.firstChild.textContent='이번 주입 용량 · '+profile.unit.replace('/dose','/회');
   const buttons=box.querySelector('[data-cri-dose-buttons]');buttons.innerHTML=profile.values.map(v=>'<button type="button" data-cri-dose-value="'+v+'">'+v+' '+profile.unit.replace('/dose','/회')+'</button>').join('');
   buttons.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{if(!o.guard())return;fields.dose.value=btn.dataset.criDoseValue;fields.dose.dispatchEvent(new Event('input',{bubbles:true}));doseFeedback();});
   doseFeedback();
  }
  function applyStock(){
   const x=choices.find(x=>x.id===stockSelect.value);fields.stockUnit.value=x?.unit||'mg';fields.stock.value=x?String(x.value):'';
   const note=box.querySelector('[data-cri-stock-note]');
   note.replaceChildren(document.createTextNode(x?(x.clinic?'병원 저장값':'공통 함량 · 실제 앰플 확인')+' · 기준: '+x.basis:'함량 후보가 여러 개이면 실제 제품을 선택하세요. 직접 입력도 가능합니다.'));
   if(x&&/^https:\/\//.test(x.url)){const a=document.createElement('a');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 함량 출처';note.append(a);}
   if(!x&&stockSelect.value==='manual'){const advanced=f.querySelector('[data-settings]');if(advanced)advanced.open=true;}
   clear();notify();
  }
  function load(){
   choices=options(selected,records,species.value);
   stockSelect.innerHTML='<option value="">함량 선택</option>'+choices.map(x=>'<option value="'+esc(x.id)+'">'+(x.clinic?'병원 저장 · ':'공통 · ')+x.value+' '+x.unit+'/mL</option>').join('')+'<option value="manual">직접 입력</option>';
   const local=choices.filter(x=>x.clinic),set=local.length?local:choices,unique=new Set(set.map(x=>x.value*(x.unit==='mcg'?0.001:1)));
   stockSelect.value=unique.size===1?set[0].id:'';applyStock();
  }
  function choose(d){
   if(!valid()||d.species&&!d.species.includes(species.value)||!o.guard())return;
   manualEntry=false;applying=true;b.dispatchEvent(new CustomEvent('practice-cri-selected'));selected=d;touched=false;
   for(const key of ['dose','stockML','rate','diluent','note','minutes'])fields[key].value='';
   fields.drug.value=d.name;fields.mode.value=d.mode||'prepare';fields.mode.dispatchEvent(new Event('change',{bubbles:true}));
   fields.doseUnit.value=d.unit;fields.volume.value=d.mode?'':'100';bag.value=d.mode?'custom':'100';
   box.querySelector('[data-cri-reference]').hidden=false;showProfile();load();render();
   status.textContent=d.mode==='intermittent'?'1회 주입 · 반복 간격은 별도 처방':d.mode==='undiluted'?'원액 지속주입 · 추가 희석 없음':'희석 지속주입 · 최종 부피와 펌프 속도 선택';
   picker.open=false;picker.querySelector('summary').textContent=d.name+' · 약물 변경';picker.querySelector('summary').focus({preventScroll:true});
   hours.value='';fields.rate.readOnly=false;applyDilution();applying=false;doseFeedback();refreshQuick();renderSaved();loadingState();
  }
  function reset(){
   manualEntry=false;selected=null;profile=null;f.criReferenceContext=null;touched=false;hours.value='';fields.rate.readOnly=false;f.criSetupContext=null;dilutionHelp.replaceChildren();
   doseHome.insertBefore(doseLabel,doseNext?.parentElement===doseHome?doseNext:null);doseLabel.firstChild.textContent='이번 주입 용량';
   box.querySelector('[data-cri-reference]').hidden=true;stockSelect.replaceChildren();status.textContent='';
   picker.open=true;picker.querySelector('summary').textContent='정맥 주입 약물 찾기';query.value='';filter='all';
   box.querySelectorAll('[data-cri-group]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.criGroup==='all')));
   render();bag.value=['20','50','100','500'].includes(fields.volume.value)?fields.volume.value:'custom';refreshQuick();renderSaved();loadingState();
  }
  box.querySelectorAll('[data-cri-group]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.criGroup;box.querySelectorAll('[data-cri-group]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));render();});
  query.addEventListener('input',render);query.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
  stockSelect.onchange=()=>{if(!o.guard())return;touched=true;applying=true;applyStock();applying=false;refreshQuick();};
  box.querySelector('[data-cri-manual]').onclick=()=>{if(!o.guard())return;b.dispatchEvent(new CustomEvent('practice-cri-selected'));for(const key of ['drug','note','dose','doseUnit','stock','stockUnit','rate','stockML','diluent','minutes'])fields[key].value='';reset();manualEntry=true;refreshQuick();clear();applying=true;notify();applying=false;const advanced=f.querySelector('[data-settings]');if(advanced)advanced.open=true;fields.drug.focus();};
  const prepHeading=document.createElement('h4');prepHeading.textContent='3. 조제 설정';doseHome.prepend(prepHeading);
  const bagLabel=document.createElement('label');bagLabel.textContent='약물 포함 최종 수액량';
  const bag=document.createElement('select');bag.dataset.criBag='';bag.innerHTML='<option value="20">20 mL · 시린지</option><option value="50">50 mL · 시린지</option><option value="100">100 mL</option><option value="500">500 mL</option><option value="custom" selected>직접 입력</option>';
  bagLabel.append(bag);prepHeading.after(bagLabel);bagLabel.after(fields.volume.closest('label'));
  bag.onchange=()=>{fields.volume.value=bag.value==='custom'?fields.volume.value:bag.value;fields.volume.dispatchEvent(new Event('input',{bubbles:true}));if(bag.value==='custom'){const advanced=f.querySelector('[data-settings]');if(advanced)advanced.open=true;fields.volume.focus();}};
  const quick=[];
  function shortcuts(field,values,label){
   const host=document.createElement('div');host.className='pt-cri-shortcuts';host.setAttribute('role','group');host.setAttribute('aria-label',label);
   field.after(host);for(const value of values){const button=document.createElement('button');button.type='button';button.textContent=value+(field.name==='rate'?' mL/hr':field.name==='minutes'?'분':'');button.dataset.criQuick=String(value);
    button.onclick=()=>{if(!o.guard())return;field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));refreshQuick();};host.append(button);}
   quick.push({field,host});
  }
  shortcuts(fields.rate,[1,2,5,10],'펌프 속도 빠른 선택');shortcuts(fields.minutes,[15,30,60],'주입 시간 빠른 선택');shortcuts(fields.diluent,['N/S','D5W'],'확인한 희석액 빠른 선택');
  // Keep product-specific fluid candidates visible and derive flow only from explicit inputs.
  doseHome.insertBefore(fields.diluent.closest('label'),fields.confirmed.closest('label'));
  const fluidHelp=document.createElement('small');fluidHelp.textContent='제품별 혼합 적합성 확인 후 선택 · 펌프 속도는 총 수액 계획에 포함';fields.diluent.closest('label').append(fluidHelp);

  const dilutionHelp=document.createElement('p');dilutionHelp.className='pt-help';dilutionHelp.dataset.criDilutionHelp='';fields.diluent.closest('label').after(dilutionHelp);
  function applyDilution(){const d=dilutionFor(selected?.id);dilutionHelp.replaceChildren();if(!d||['undiluted','intermittent'].includes(fields.mode.value))return;fields.diluent.value=d.value;const a=document.createElement('a');a.href=d.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 희석 근거';dilutionHelp.append(document.createTextNode('자동 입력한 희석액 후보 · '+d.value+' · '+d.note+' 국내 제품과의 동일성을 보장하지 않으며 다른 약물 혼합·사용 가능 시간은 별도 확인합니다.'),a);}
  const schedule=document.createElement('label');schedule.className='pt-cri-duration';schedule.innerHTML='조제액 사용 시간으로 속도 설정<select data-cri-hours><option value="">속도 직접 입력 / 병원 서식</option>'+[1,2,4,6,8,12,24].map(h=>'<option value="'+h+'">'+h+'시간 동안 주입</option>').join('')+'</select><small>최종 부피 ÷ 선택 시간 · 제품의 사용 가능 시간을 뜻하지 않습니다.</small>';fields.rate.closest('label').before(schedule);
  const extra=document.createElement('details');extra.className='pt-cri-other';extra.innerHTML='<summary>다른 수액과 합한 주입량 확인</summary><label>다른 모든 정맥 라인의 속도 합계 · mL/hr<input data-cri-other inputmode="decimal" placeholder="없으면 0 · 미입력은 미확인"></label><p class="pt-help">동시에 투여하는 수액과 약물 라인을 포함합니다. 이 값은 환자마다 다시 확인합니다.</p>';schedule.after(extra);const other=extra.querySelector('input');other.oninput=()=>{clear();refreshQuick();};
  const hours=schedule.querySelector('select'),flow=document.createElement('p');flow.className='pt-cri-flow';flow.dataset.criFlow='';schedule.after(flow);let syncing=false;
  hours.onchange=()=>{clear();refreshQuick();};
  function refreshQuick(){
   if(syncing)return;syncing=true;
   const ready=manualEntry||!!fields.drug.value&&(!selected||!!fields.dose.value);f.classList.toggle('pt-cri-await-input',!ready);f.dataset.criStep=!valid()?'species':!fields.drug.value?'drug':!ready?'regimen':'prepare';
   const mode=fields.mode.value,automatic=mode==='prepare'&&!!hours.value;
   schedule.hidden=mode!=='prepare';dilutionHelp.hidden=['undiluted','intermittent'].includes(mode);fields.rate.readOnly=automatic;
   if(automatic){const volume=Number(fields.volume.value),value=Number.isFinite(volume)&&volume>0?String(volume/Number(hours.value)):'';if(fields.rate.value!==value){fields.rate.value=value;fields.rate.dispatchEvent(new Event('input',{bubbles:true}));}}
   const weight=Number(b.querySelector('[data-common-weight]').value);let rate=Number(fields.rate.value),detail='';
   if(mode!=='prepare'){try{const result=g.PracticeCalculators.cri({...Object.fromEntries(new FormData(f)),weight});rate=result.rate;detail='처방량·제품 농도'+(mode==='intermittent'?'·주입 시간':'·조제 내역')+'으로 계산';}catch{rate=0;}}
   else if(automatic)detail=fields.volume.value+' mL ÷ '+hours.value+'시간';
   flow.dataset.mode=automatic?'automatic':'manual';flow.textContent=(automatic?'시간 기준 자동 계산 · ':'처방 입력 기준 · ')+(rate>0&&Number.isFinite(rate)?'펌프 속도 '+g.PracticeCalculators.display(rate)+' mL/hr'+(detail?' · '+detail:'')+(weight>0?' · 이 약물 라인 '+g.PracticeCalculators.display(rate/weight)+' mL/kg/hr':'')+' · 다른 수액과 합한 총 공급량·펌프 정확도 확인':'환자별 수액 계획에 맞춰 속도 또는 조제액 사용 시간을 선택하세요.');
   const otherRate=other.value.trim(),known=/^(?:\d+\.?\d*|\.\d+)$/.test(otherRate)&&Number.isFinite(Number(otherRate));if(rate>0&&Number.isFinite(rate)){flow.textContent+=known?' · 전체 정맥 주입 '+g.PracticeCalculators.display(rate+Number(otherRate))+' mL/hr'+(weight>0?' ('+g.PracticeCalculators.display((rate+Number(otherRate))/weight)+' mL/kg/hr)':''):' · 전체 정맥 주입량: 다른 라인 미확인';}
   const d=selected&&fields.drug.value===selected.name&&!['undiluted','intermittent'].includes(mode)?dilutionFor(selected.id):null;f.criSetupContext={otherRate:known?otherRate:null,totalRate:known&&rate>0?rate+Number(otherRate):null,hours:automatic?hours.value:'',volume:fields.volume.value,dilution:d&&fields.diluent.value===d.value?d:null};
   for(const {field,host} of quick)for(const button of host.children)button.setAttribute('aria-pressed',String(button.dataset.criQuick===field.value));syncing=false;
  }
  b.querySelector('[data-common-weight]').addEventListener('input',refreshQuick);
  b.querySelector('[data-use-weight]')?.addEventListener('click',refreshQuick);

  f.addEventListener('input',e=>{
   if(applying)return;
   if(e.target.name==='rate'&&!syncing){hours.value='';fields.rate.readOnly=false;}
   if(['drug','stock','stockUnit'].includes(e.target.name)){
    touched=true;
    if(e.target.name==='drug'){for(const key of ['dose','stock','stockUnit','rate','stockML','diluent'])fields[key].value='';reset();clear();return;}
    stockSelect.value='manual';box.querySelector('[data-cri-stock-note]').textContent='직접 수정한 함량·단위 · 실제 제품과 대조';
   }
   if(e.target.name==='volume')bag.value=['20','50','100','500'].includes(fields.volume.value)?fields.volume.value:'custom';
   if(profile)doseFeedback();refreshQuick();
  });
  f.addEventListener('change',e=>{
   if(applying)return;
   if(e.target.name==='mode'){hours.value='';fields.rate.readOnly=false;}
   if(['stockUnit','doseUnit'].includes(e.target.name)){touched=true;if(e.target.name==='stockUnit')stockSelect.value='manual';}
   if(profile)doseFeedback();refreshQuick();
  });
  f.addEventListener('reset',()=>queueMicrotask(reset));species.addEventListener('change',reset);b.addEventListener('practice-protocol-applied',e=>{if(e.detail.calculator!=='cri')return;queueMicrotask(()=>{reset();const h=g.PracticeMedicationFlow?.unpack(e.detail.protocol?.body.note).meta.hours;if(h){if(![...hours.options].some(x=>x.value===String(h)))hours.add(new Option(h+'시간 동안 주입',h));hours.value=h;refreshQuick();}});});
  b.addEventListener('practice-protocols-loaded',e=>{records=[...records.filter(p=>p.body?.kind!=='protocol'),...e.detail.items.filter(p=>p.body?.kind==='protocol')];renderSaved();});
  refreshQuick();render();return {loaded(r){records=r.items||[];renderSaved();if(selected&&!touched){applying=true;load();applying=false;refreshQuick();}},reset};
 }
 function describe(f){const p=f.criReferenceContext,x=f.criSetupContext;const setup=(x?.totalRate!==null&&x?.totalRate!==undefined?'\n다른 정맥 라인 '+x.otherRate+' mL/hr · 전체 정맥 주입 '+g.PracticeCalculators.display(x.totalRate)+' mL/hr':'\n전체 정맥 주입량: 다른 라인 미확인')+(x?.hours?'\n속도 설정: 최종 '+x.volume+' mL ÷ '+x.hours+'시간 · 사용 가능 시간은 별도 확인':'')+(x?.dilution?'\n희석액 후보: '+x.dilution.value+' · 실제 제품 조건 확인\n희석 근거 '+x.dilution.source:'');if(!p)return setup;return '참고 용법: '+p.indication+' · '+(p.species==='cat'?'고양이':'개')+'\n문헌 범위 '+p.min+'–'+p.max+' '+p.unit+(p.state==='outside'?' · 범위 밖 수의사 조정값':'')+'\n근거 '+p.source.label+' '+p.source.url+'\n부하 투여량 제외 · 확인 '+p.checked+setup;}
 const api={drugs,options,mount,profileFor,doseStatus,describe,dilutionFor};g.PracticeCRIPresets=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
