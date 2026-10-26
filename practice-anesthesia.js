/* Selected, species/route-specific reference regimens. Preparation estimates, not automatic prescribing. */
(function(g){
 'use strict';
 const sources={premed:'https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/drug-combinations/premedication-and-sedation/',induction:'https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/drug-combinations/induction-iv/',opioid:'https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/2020-anesthesia/opioid-selection-considerations.pdf',feline:'https://pmc.ncbi.nlm.nih.gov/articles/PMC10816483/',medetomidine:'https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_197594.PDF',diazepam:'https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2435611.PDF',ketmed:'https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2364172.PDF'};
 const mfds=id=>'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq='+id;
 const drugs=[
  {id:'butorphanol',name:'Butorphanol · 부토르파놀',group:'premed',ingredient:'mfds-e176f45811b755eb29fc',route:'IM / IV',range:{dog:[.2,.4],cat:[.2,.4]},unit:'mg',stock:10,stockSource:sources.opioid,ref:'opioid',note:'진정 보조. 큰 수술의 단독 진통제로 간주하지 않습니다. 다른 오피오이드와의 병용 효과를 검토합니다.'},
  {id:'midazolam',name:'Midazolam · 미다졸람',group:'premed',ingredient:'mfds-43c17d96856f599dbecb',route:'IM / IV',range:{dog:[.2,.2],cat:[.2,.2]},unit:'mg',stock:5,stockSource:mfds('200109948'),ref:'premed',note:'진정 보조 참고 용법. 건강하고 흥분한 환자에서 단독 사용 시 역설적 흥분을 평가합니다.'},
  {id:'acepromazine',name:'Acepromazine · 아세프로마진',group:'premed',ingredient:'manual-ac08445b7302205bf0c1',route:'IM',range:{dog:[.01,.03],cat:[.025,.1]},unit:'mg',stock:2,stockSource:'https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_2968379.PDF',ref:'premed',max:{dog:2,cat:1},note:'저혈압·순환 저하와 ABCB1 감수성을 검토합니다. 개 총량 2–3 mg 범위 중 2 mg을 확인 상한으로 사용하며 고양이는 1 mg입니다. 제품 참고 농도는 acepromazine 2 mg/mL 기준입니다.'},
  {id:'dexmedetomidine',name:'Dexmedetomidine · 덱스메데토미딘',group:'premed',ingredient:'mfds-d7457917dc67de9e5a73',route:'IM',range:{dog:[3,7],cat:[3,10]},unit:'mcg',stock:null,ref:'premed',note:'안정된 성체의 중등도 진정 참고 범위. 심혈관 질환·저혈량 환자에 일률 적용하지 않습니다. 사람용 정맥 프리믹스를 IM 제품으로 자동 연결하지 않습니다.',manualStock:true},
  {id:'methadone',name:'Methadone · 메타돈',group:'premed',ingredient:'manual-7a8ee42150a498755e97',route:'IV',range:{dog:[.2,.4],cat:[.2,.4]},unit:'mg',stock:10,stockSource:sources.opioid,ref:'opioid',note:'진통 전처치. 호흡·심박을 감시합니다. 이 카드는 IV 범위이며 IM·OTM 용량과 구분합니다.'},
  {id:'buprenorphine',name:'Buprenorphine · 부프레노르핀',group:'premed',ingredient:'manual-55a14849a0a65a2359ca',route:'IM / IV',range:{dog:[.01,.03],cat:[.01,.03]},unit:'mg',stock:.3,allowedStock:[.3],stockSource:sources.opioid,ref:'opioid',note:'효과 발현까지 시간을 고려합니다. 고농도 장시간 작용 SC 제품은 이 용법에 연결하지 않습니다.'},
  {id:'hydromorphone',name:'Hydromorphone · 히드로모르폰',group:'premed',ingredient:'mfds-637291a2b26086fa5234',route:'IM / IV',range:{dog:[.1,.2],cat:[.1,.1]},unit:'mg',stock:2,stockSource:sources.opioid,ref:'opioid',note:'호흡억제·구토와 고양이의 고체온을 감시합니다.'},
  {id:'propofol',name:'Propofol · 프로포폴',group:'induction',ingredient:'mfds-bd11aec3c2ce50c8e483',route:'IV',range:{dog:[2,6],cat:[2,6]},unit:'mg',stock:10,stockSource:mfds('201100959'),ref:'induction',note:'전처치 깊이에 따라 요구량이 감소합니다. 무호흡·저혈압을 감시하며 기도 확보까지 천천히 효과에 맞춰 투여합니다.'},
  {id:'alfaxalone',name:'Alfaxalone · 알팍살론',group:'induction',ingredient:'manual-692f7ca9e8d68112fda5',route:'IV',range:{dog:[1,3],cat:[2,5]},unit:'mg',stock:10,stockSource:'https://www.vmd.defra.gov.uk/productinformationdatabase/product/A011307',ref:'induction',note:'개와 고양이의 유도 범위가 다릅니다. 호흡·혈압을 감시하며 효과에 맞춰 투여합니다.'},
  {id:'etomidate',name:'Etomidate · 에토미데이트',group:'induction',ingredient:'mfds-e236564747ac6a16d3dc',route:'IV',range:{dog:[1,3],cat:[1,3]},unit:'mg',stock:2,stockSource:mfds('200410460'),ref:'induction',note:'근간대경련·정맥 자극·부신 억제 가능성을 고려합니다. 동반 약물과 환자 상태에 따라 별도 계획합니다.'},
  {id:'ketamine',name:'Ketamine + Midazolam · 케타민 병용 유도',group:'induction',ingredient:'mfds-367581e5934d0c20440e',route:'IV',range:{dog:[2,5],cat:[2,5]},unit:'mg',stock:50,stockSource:mfds('200604139'),ref:'induction',companion:{name:'미다졸람',unit:'mg',range:{dog:[.1,.4],cat:[.1,.4]},stock:5},note:'케타민 단독 유도 카드가 아닙니다. 미다졸람 0.1–0.4 mg/kg를 별도로 계산합니다. 고양이 신기능·빈맥성 부정맥을 검토하며, 같은 주사기 혼합 비율은 자동 설정하지 않습니다.'},
{"id":"medetomidine","name":"Medetomidine · 메데토미딘","group":"premed","route":"IM","range":{"dog":[10,40],"cat":[50,150]},"unit":"mcg","stock":1,"manualStock":true,"basis":"medetomidine-hcl","stockLabel":"메데토미딘 염산염 농도 · mg/mL","stockSource":"https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_197594.PDF","ref":"medetomidine","purpose":{"dog":"개 · 마취 전처치","cat":"고양이 · 중등도·깊은 진정"},"note":"염산염 기준 용량·농도입니다(염산염 1 mg = 유리염기 0.85 mg). Dexmedetomidine과 바꾸어 입력하지 않습니다. 고양이 범위는 단독 진정용이며 저용량 병용 전처치와 구분합니다. 심혈관·호흡기 질환, 간·신장 장애, 쇼크·쇠약, 임신 환자에는 이 참고 용법을 적용하지 않습니다."},
{"id":"diazepam","name":"Diazepam · 디아제팜","group":"premed","route":"IV","range":{"dog":[0.1,0.2],"cat":[0.1,0.2]},"unit":"mg","stock":5,"manualStock":true,"stockSource":"https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_2435611.PDF","ref":"diazepam","note":"전마취 병용 참고 범위입니다. 천천히 IV 투여하며 IM 용법으로 사용하지 않습니다. 흥분·호흡억제·저혈압 및 간기능을 확인합니다. 다른 약물과 같은 주사기에 자동 혼합하지 않습니다."},
{"id":"ketamine-medetomidine","name":"Ketamine + Medetomidine · 케타민·메데토미딘","group":"induction","ingredient":"mfds-367581e5934d0c20440e","route":"IM","range":{"dog":[5,7.5],"cat":[2.5,7.5]},"unit":"mg","stock":50,"stockSource":"https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=200604139","ref":"ketmed","companion":{"name":"메데토미딘 염산염","unit":"mcg","range":{"dog":[40,40],"cat":[80,80]},"stock":1},"note":"두 성분을 각각 IM 투여하는 참고 용법입니다. 같은 주사기 혼합량이나 IV 용량으로 사용하지 않습니다. 고양이는 메데토미딘 후 케타민 IM 순서입니다. 심폐·간·신장 질환, 쇼크 환자에는 적용하지 않습니다. 개 병용 용법의 제품 설명서는 atipamezole 역전을 금지하며, 고양이는 케타민 후 최소 30–40분 이전 α2 길항을 피하도록 안내합니다. 회복·추가 진통 계획을 별도로 확인합니다."}
 ];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=(v,label)=>{if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(v).trim())||!Number.isFinite(+v)||+v<=0)throw Error(label+' 입력값을 확인해주세요.');return +v;};
 function calculate(id,v){const d=drugs.find(x=>x.id===id),r=d?.range[v.species];if(!r)throw Error('개 또는 고양이를 선택해주세요.');const w=num(v.weight,'체중'),dose=num(v.dose,'용량'),stock=num(v.stock,'제품 농도');if(w>200||dose>1e6||stock>1e6)throw Error('체중·용량·농도의 수치와 단위를 확인해주세요.');const amount=w*dose,mg=amount*(d.unit==='mcg'?.001:1);if(d.max&&mg>d.max[v.species])throw Error('이 참고 용법의 총량 확인 상한을 넘었습니다. 개별 처방을 검토하세요.');const warnings=[];if(dose<r[0]||dose>r[1])warnings.push('문헌 범위 밖 · '+rangeText(r)+' '+d.unit+'/kg · 단위·처방 근거 확인');const result={amount,mg,mL:mg/stock,warnings};if(d.companion){const co=d.companion,rr=co.range[v.species],dose2=num(v.companionDose,co.name+' 용량'),stock2=num(v.companionStock,co.name+' 농도');if(dose2>1e6||stock2>1e6)throw Error('병용 용량·농도의 수치와 단위를 확인해주세요.');if(dose2<rr[0]||dose2>rr[1])warnings.push('병용 '+co.name+' 문헌 범위 밖 · '+rangeText(rr)+' '+co.unit+'/kg · 단위·처방 근거 확인');result.companionAmount=w*dose2;result.companionMg=w*dose2*(co.unit==='mcg'?.001:1);result.companionML=result.companionMg/stock2;}return result;}
 function stockOptions(d,items,species){if(d.manualStock)return [];return (items||[]).filter(p=>{const s=p.body?.strength;return !p.formularyIssue&&s?.ingredientId===d.ingredient&&s.route==='injection'&&s.release==='standard'&&s.species?.includes(species)&&p.body.kind==='liquid'&&['mg','mcg'].includes(p.body.unit)&&Number(p.body.value)>0&&Number.isFinite(Number(p.body.value))&&(!d.allowedStock||d.allowedStock.includes(Number(p.body.value)*(p.body.unit==='mcg'?.001:1)));}).map(p=>({id:p.id,value:Number(p.body.value)*(p.body.unit==='mcg'?.001:1),title:p.body.title,revision:p.revision}));}

 const rangeText=r=>r[0]===r[1]?String(r[0]):r.join('–');
 const stockPrefix='CARESTEP_ANESTHESIA_STOCK_V1:';
 function isSavedStock(p){return typeof p?.body?.note==='string'&&p.body.note.startsWith(stockPrefix);}
 function partition(r){return {...r,anesthesiaItems:r.anesthesiaItems||(r.items||[]).filter(isSavedStock),items:(r.items||[]).filter(p=>!isSavedStock(p))};}
 function savedFact(p,d){
  if(!isSavedStock(p))return null;
  try{const m=JSON.parse(p.body.note.slice(stockPrefix.length));
   if(m.drug!==d.id)return null;
   if(m.v!==1||m.route!==d.route||m.basis!==(d.basis||'active')||p.body.kind!=='liquid'||p.body.unit!=='mg')throw Error();
   const value=num(p.body.value,'저장 농도');if(value>1e6)throw Error();
   const companionStock=d.companion?num(m.companionStock,'병용 농도'):null;if(companionStock>1e6||(!d.companion&&m.companionStock!=null))throw Error();
   return {value,companionStock};
  }catch{throw Error('저장된 마취 농도 형식이 올바르지 않습니다. 설정을 확인해주세요.');}
 }
 function savedFor(rows,d){const matches=(rows||[]).filter(p=>{try{return isSavedStock(p)&&JSON.parse(p.body.note.slice(stockPrefix.length)).drug===d.id;}catch{return isSavedStock(p);}});
  if(matches.length>1)throw Error('같은 카드의 저장 농도가 여러 개입니다. 관리자에게 중복 설정 정리를 요청해주세요.');
  if(!matches.length)return null;return {record:matches[0],...savedFact(matches[0],d)};
 }
 function stockBody(d,stock,companionStock){
  const value=num(stock,'제품 농도');if(value>1e6)throw Error('제품 농도를 확인해주세요.');
  const meta={v:1,drug:d.id,route:d.route,basis:d.basis||'active'};
  if(d.companion){meta.companionStock=num(companionStock,'병용 농도');if(meta.companionStock>1e6)throw Error('병용 농도를 확인해주세요.');}
  return {title:('마취 농도 · '+d.name).slice(0,100),kind:'liquid',unit:'mg',value,note:stockPrefix+JSON.stringify(meta),confirm:true};
 }
 function mount(b,o){
  const main=b.querySelector('.pt-calc-main'),species=b.querySelector('[data-ref-species]'),weight=b.querySelector('[data-common-weight]');if(!main)return null;
  const panel=document.createElement('section');panel.dataset.kindPanel='anesthesia';panel.hidden=true;panel.className='pt-anesthesia';
  panel.innerHTML='<h3 tabindex="-1">마취약물 · 전처치와 유도</h3><p class="pt-notice">환자 상태·병용 약물을 고려해 수의사가 정한 용량을 입력하면 준비량을 계산합니다. 각 카드는 선택 가능한 대안이며 모든 약물을 함께 투여하는 처방이 아닙니다. IV 유도약은 환자 반응에 맞춰 분할 투여합니다.</p><p data-an-context role="status"></p><nav class="pt-bar" aria-label="마취 단계"><button type="button" data-an-group="all" aria-pressed="true">전체</button><button type="button" data-an-group="premed">전처치·진정</button><button type="button" data-an-group="induction">유도·병용</button></nav><details class="pt-section-help"><summary>용량·농도·저장 안내</summary><p>종·체중으로 참고 준비량을 계산합니다. 처음 표시되는 용량은 문헌의 비교값이며 권장 시작량을 뜻하지 않습니다. 농도를 수정하고 저장하면 이 카드의 병원 공통값으로 유지됩니다. 용량·체중·환자 정보는 저장하지 않습니다.</p></details><div data-an-cards></div><details><summary>근거·Plumb’s 대조 안내</summary><p>AAHA·AAFP 지침과 VMD 제품 설명서를 대조했습니다. 각 카드의 적용 목적·종·경로를 확인하세요. 병원 전용 Plumb’s 원문·정오표는 약물 참고자료에서 추가 확인합니다.</p>'+Object.entries(sources).map(([k,url])=>'<p><a target="_blank" rel="noopener noreferrer" href="'+url+'">'+({premed:'AAHA · 전처치',induction:'AAHA · IV 유도',opioid:'AAHA · 오피오이드',feline:'AAFP · 고양이 마취',medetomidine:'VMD · Medetomidine',diazepam:'VMD · Diazepam',ketmed:'VMD · Ketamine 병용'})[k]+'</a></p>').join('')+'<p>확인 2026-10-26 · 원액 mL = 체중 × 용량(mg/kg) ÷ mg/mL. mcg는 mg로 환산합니다. 표시값은 근삿값이며 투여량 반올림 지시가 아닙니다.</p></details>';
  main.append(panel);
  const finder=document.createElement('section');finder.className='pt-an-finder';finder.innerHTML='<label>사용 목적<select data-an-purpose><option value="all">전체 참고 용법</option><option value="pain">진통 전처치</option><option value="sedation">진정·전처치 보조</option><option value="iv">정맥 유도</option><option value="im">근육 병용 진정·유도</option></select></label><label>약물 찾기<input type="search" data-an-search placeholder="성분명·한글명"></label><label class="pt-choice"><input type="checkbox" data-an-selected-only>선택한 약물만 보기</label><p data-an-empty hidden>해당 약물이 없습니다. 검색·분류 또는 선택한 약물 보기를 변경하세요.</p>';panel.querySelector('[data-an-cards]').before(finder);
  const cards=new Map();let items=[],savedRows=[],generation=0,canManage=false,saving=false,ready=false,loadFailed=false,report='';
  const fmt=v=>g.PracticeCalculators.display(v),valid=()=>['dog','cat'].includes(species.value);
  for(const d of drugs){
   const co=d.companion,card=document.createElement('article');card.className='pt-card pt-an-card';card.dataset.anDrug=d.id;
   card.innerHTML='<small>'+(d.group==='premed'?'전처치·진정':'유도·병용')+' · '+d.route+'</small><h4>'+esc(d.name)+'</h4><p data-an-range></p><div class="pt-grid"><label>'+(co?'케타민 ':'이번 ')+'용량 · '+d.unit+'/kg<input data-an-dose inputmode="decimal"></label><label>'+esc(d.stockLabel||(co?'케타민 농도 · mg/mL':'제품 농도 · mg/mL'))+'<input data-an-stock inputmode="decimal"></label></div><p data-an-origin class="pt-help"></p><label data-an-choice-label hidden>병원 제품<select data-an-choice></select></label>'+
    (co?'<div class="pt-grid"><label>병용 '+esc(co.name)+' · '+co.unit+'/kg<input data-an-companion-dose inputmode="decimal"></label><label>'+esc(co.name)+' 농도 · mg/mL<input data-an-companion-stock inputmode="decimal"></label></div><p data-an-companion-range class="pt-help"></p>':'')+
    '<p class="pt-help" data-an-dose-state role="status"></p><button type="button" data-an-dose-reset>문헌 초기값으로 되돌리기</button><div class="pt-bar"><button type="button" data-an-save disabled>제품 농도 저장</button><button type="button" data-an-reload>저장 농도 불러오기</button></div><p class="pt-help" data-an-save-state role="status">병원 저장 설정 확인 중…</p><output class="pt-an-result" aria-live="polite"></output><p>'+esc(d.note)+'</p><details><summary>용법·제품 근거</summary><a href="'+sources[d.ref]+'" target="_blank" rel="noopener noreferrer">용법 참고</a>'+(d.stockSource?' · <a href="'+d.stockSource+'" target="_blank" rel="noopener noreferrer">농도 참고</a>':'')+'</details><label class="pt-choice"><input type="checkbox" data-an-selected>이번 계획에 선택 · 용량·경로·실제 제품 확인</label>';
   panel.querySelector('[data-an-cards]').append(card);
   cards.set(d.id,{d,card,dose:card.querySelector('[data-an-dose]'),stock:card.querySelector('[data-an-stock]'),choice:card.querySelector('[data-an-choice]'),out:card.querySelector('output'),coDose:card.querySelector('[data-an-companion-dose]'),coStock:card.querySelector('[data-an-companion-stock]'),state:card.querySelector('[data-an-save-state]'),save:card.querySelector('[data-an-save]'),reload:card.querySelector('[data-an-reload]'),selected:card.querySelector('[data-an-selected]'),touched:false,doseTouched:false,product:null,saved:null,blocked:''});
  }
  const status=panel.querySelector('[data-an-context]'),plan=document.createElement('section');plan.className='pt-card';
  plan.innerHTML='<h4>선택한 마취 계획</h4><p data-an-plan>선택한 약물이 없습니다.</p><button type="button" data-an-copy disabled>확인한 계획 복사</button><p data-an-copy-status role="status"></p>';panel.querySelector('[data-an-cards]').before(plan);plan.classList.add('pt-an-plan-summary');plan.querySelector('[data-an-plan]').setAttribute('aria-live','polite');
  const jump=document.createElement('button');jump.type='button';jump.textContent='선택 약물 확인';jump.dataset.anJump='';jump.onclick=()=>{finder.querySelector('input[type=checkbox]').checked=true;filterCards();plan.scrollIntoView({block:'nearest'});};panel.querySelector('[data-an-context]').after(jump);
  const origin=c=>c.card.querySelector('[data-an-origin]');
  function failed(){ready=false;loadFailed=true;canManage=false;for(const c of cards.values()){c.save.disabled=true;c.state.textContent='불러오기 실패 · 입력값 유지 · 상단에서 다시 불러오기';}}
  function loaded(r){if(!o.guard())return;ready=true;loadFailed=false;const split=partition(r);generation++;items=split.items;savedRows=split.anesthesiaItems;canManage=!!r.canManage;for(const c of cards.values()){c.save.disabled=!canManage||saving;c.reload.disabled=saving;if(!c.touched){setStock(c);c.selected.checked=false;}}update();}
  function setStock(c){
   const options=stockOptions(c.d,items,species.value);c.choice.innerHTML='<option value="">제품 참고 / 직접 입력</option>'+options.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+' · '+p.value+' mg/mL</option>').join('');
   c.choice.closest('label').hidden=!options.length;c.product=null;c.saved=null;c.blocked='';c.choice.value='';
   try{const saved=savedFor(savedRows,c.d);
    if(saved){c.saved=saved.record;c.stock.value=saved.value;if(c.coStock)c.coStock.value=saved.companionStock;origin(c).textContent='저장된 병원 농도 · '+(saved.record.approver_name||'병원 의료진')+' · '+(saved.record.updated_at||'저장 완료');}
    else{c.product=options.length===1?options[0]:null;c.choice.value=c.product?.id||'';c.stock.value=options.length>1?'':c.product?.value??c.d.stock??'';if(c.coStock)c.coStock.value=c.d.companion.stock;origin(c).textContent=c.product?'병원 약품 · '+c.product.title:options.length>1?'병원 농도가 여러 개입니다. 실제 제품을 선택하세요.':'문헌·제품 참고 · 실제 농도 대조 필요';}
    c.state.textContent=!ready?(loadFailed?'불러오기 실패 · 상단에서 다시 불러오기':'병원 설정을 불러오는 중…'):canManage?(saved?'저장됨 · 개·고양이 공통':'제품·장비 기본값 · 미저장'):'농도 저장은 원장·관리자·수의사 권한이 필요합니다.';
   }catch(e){c.blocked=e.message;c.stock.value='';if(c.coStock)c.coStock.value='';c.state.textContent=e.message;origin(c).textContent='저장 설정 확인 필요';}
   c.touched=false;
  }
  function update(){
   if(!o.guard())return;report='';status.textContent=valid()?((species.value==='dog'?'개':'고양이')+' · '+(weight.value||'체중 미입력')+' kg'):'상단에서 동물 종류와 체중을 선택해주세요.';
   const lines=[];let bad=false;
   for(const c of cards.values()){const {d,card}=c;const doseState=card.querySelector('[data-an-dose-state]');doseState.className='pt-help';doseState.textContent=c.doseTouched?'이번 계산값 · 수의사 수정':'처방 용법 참고 · 문헌 초기값';try{
    if(c.blocked)throw Error(c.blocked);
    const wc=b.querySelector('[data-record-weight-confirm]');if(wc&&!wc.closest('label').hidden&&!wc.checked)throw Error('기록 체중을 먼저 확인해주세요.');
    const r=calculate(d.id,{species:species.value,weight:weight.value,dose:c.dose.value,stock:c.stock.value,companionDose:c.coDose?.value,companionStock:c.coStock?.value});
    doseState.textContent+=(r.warnings.length?' · '+r.warnings.join(' · '):'');doseState.className=r.warnings.length?'pt-dose-review':'pt-help';c.out.className='pt-an-result';c.out.textContent=(d.companion?'케타민 ':c.doseTouched?'입력 용량 환산 ':'참고 준비량 ')+fmt(r.mL)+' mL · '+fmt(r.amount)+' '+d.unit+(d.companion?'\n'+d.companion.name+' '+fmt(r.companionML)+' mL · '+fmt(r.companionAmount)+' '+d.companion.unit:'');
    if(r.mL<.01||r.companionML<.01)c.out.textContent+='\n소량 계량·희석 계획을 확인하세요.';
    if(c.selected.checked)lines.push(d.name+' · '+doseState.textContent+' · '+d.route+' · '+c.dose.value+' '+d.unit+'/kg · '+c.stock.value+' mg/mL'+(d.companion?'\n'+d.companion.name+' '+c.coDose.value+' '+d.companion.unit+'/kg · '+c.coStock.value+' mg/mL':'')+'\n'+c.out.textContent+(d.group==='induction'&&d.route==='IV'?' · 효과에 맞춰 분할 투여':''));
   }catch(e){c.out.className='pt-an-result pt-error';c.out.textContent=e.message;if(c.selected.checked)bad=true;}}
   const selectedCount=[...cards.values()].filter(c=>c.selected.checked).length;plan.hidden=!selectedCount;jump.hidden=!selectedCount;plan.querySelector('[data-an-plan]').textContent=lines.length?lines.join('\n\n'):selectedCount?'선택한 약물의 계산 조건을 확인해주세요.':'선택한 약물이 없습니다.';report=status.textContent+'\n'+lines.join('\n\n')+'\n준비량 계산 · 기도·산소·호흡·혈압·체온 모니터링 계획 확인';plan.querySelector('button').disabled=bad||!lines.length||saving;filterCards();jump.textContent='선택 약물 '+selectedCount+'개 확인';
  }
  function reset(){generation++;for(const c of cards.values()){
   const r=c.d.range[species.value],co=c.d.companion,cr=co?.range[species.value];c.dose.value=r?.[0]??'';c.doseTouched=false;
   c.card.querySelector('[data-an-range]').textContent=r?(c.d.purpose?.[species.value]||'문헌 범위')+' · '+rangeText(r)+' '+c.d.unit+'/kg · '+c.d.route:'동물 종류 선택 후 범위 표시';
   if(co){c.coDose.value=cr?.[0]??'';c.card.querySelector('[data-an-companion-range]').textContent=cr?'병용 '+co.name+' '+rangeText(cr)+' '+co.unit+'/kg · '+c.d.route:'';}
   c.selected.checked=false;setStock(c);
  }update();}
  const signature=c=>JSON.stringify([c.stock.value,c.coStock?.value]);
  const sameRevision=(a,b)=>(a?.id||'')===(b?.id||'')&&(a?.revision||0)===(b?.revision||0);
  async function reloadCard(c){if(!o.guard()||saving)return;const seq=generation;c.state.textContent='최신 저장값을 불러오는 중…';try{const r=await o.fresh();if(!o.guard()||seq!==generation)return;loaded(r);c.touched=false;setStock(c);c.selected.checked=false;generation++;update();}catch(e){if(o.guard())c.state.textContent=e.message;}}
  async function saveCard(c){
   if(!o.guard()||!canManage||saving)return;
   let body;try{body=stockBody(c.d,c.stock.value,c.coStock?.value);}catch(e){c.state.textContent=e.message;return;}
   const sig=signature(c),seq=generation,old=c.saved;
   saving=true;for(const x of cards.values()){x.save.disabled=true;x.reload.disabled=true;}c.state.textContent='병원 농도 저장 중…';update();
   let sent=false;
   try{
    const fresh=await o.fresh();if(!o.guard()||seq!==generation||sig!==signature(c))throw Error('입력이 변경되어 저장하지 않았습니다. 값을 확인하고 다시 저장하세요.');
    if(!fresh.canManage)throw Error('농도 저장 권한이 없습니다.');
    const latest=savedFor(partition(fresh).anesthesiaItems,c.d);
    if(!sameRevision(old,latest?.record))throw Error('다른 화면에서 농도가 변경됐습니다. 저장 농도 불러오기 후 다시 확인하세요.');
    if(latest&&latest.value===body.value&&latest.companionStock===(c.d.companion?JSON.parse(body.note.slice(stockPrefix.length)).companionStock:null)){c.state.textContent='이미 같은 농도로 저장되어 있습니다.';return;}
    sent=true;
    await o.request('/practice/presets'+(old?'/'+encodeURIComponent(old.id):''),{method:old?'PUT':'POST',body:JSON.stringify({...body,...(old?{revision:old.revision}:{})})});
    if(!o.guard())return;
    const r=await o.fresh();if(!o.guard())return;
    const saved=savedFor(partition(r).anesthesiaItems,c.d);if(!saved||saved.value!==body.value||saved.companionStock!==(c.d.companion?JSON.parse(body.note.slice(stockPrefix.length)).companionStock:null))throw Error('저장 결과를 확인하지 못했습니다.');
    const changed=seq!==generation||sig!==signature(c);loaded(r);c.saved=saved.record;
    if(!changed){c.touched=false;setStock(c);c.state.textContent='병원에 저장했습니다. 다음 접속·다른 기기에서도 이 카드에 적용됩니다.';}else{c.touched=true;c.state.textContent='요청한 농도는 저장됐습니다. 이후 수정한 현재 입력은 아직 저장되지 않았습니다.';}
    c.selected.checked=false;generation++;update();o.changed?.(r);
   }catch(e){if(o.guard())c.state.textContent=(sent?'저장 상태 확인 필요 · 저장 농도 불러오기로 확인해주세요. ':'')+e.message;}
   finally{saving=false;if(o.guard()){for(const x of cards.values()){x.save.disabled=!canManage;x.reload.disabled=false;}update();}}
  }
  for(const c of cards.values()){
   c.card.querySelector('[data-an-dose-reset]').onclick=()=>{if(!o.guard())return;const r=c.d.range[species.value],co=c.d.companion;c.dose.value=r?.[0]??'';if(co)c.coDose.value=co.range[species.value]?.[0]??'';c.doseTouched=false;c.selected.checked=false;generation++;update();};
   c.card.addEventListener('input',e=>{generation++;if(e.target===c.dose||e.target===c.coDose)c.doseTouched=true;if(e.target===c.stock||e.target===c.coStock){c.touched=true;c.product=null;c.choice.value='';origin(c).textContent='직접 수정값 · 이번 계산만 변경';c.state.textContent='이번 계산만 변경했습니다. 제품 농도 저장을 눌러야 다음에도 유지됩니다. 아직 저장하지 않았습니다.';}if(!e.target.matches('[data-an-selected]'))c.selected.checked=false;update();});
   c.choice.onchange=()=>{const p=stockOptions(c.d,items,species.value).find(x=>x.id===c.choice.value);c.product=p||null;c.stock.value=p?.value??c.d.stock??'';c.touched=true;origin(c).textContent=p?'병원 약품 · '+p.title:'문헌·제품 참고';c.state.textContent='선택한 농도를 유지하려면 저장하세요.';c.selected.checked=false;generation++;update();};
   c.save.onclick=()=>saveCard(c);c.reload.onclick=()=>reloadCard(c);
  }
  plan.querySelector('button').onclick=async()=>{
   const seq=generation;plan.querySelector('[data-an-copy-status]').textContent='병원 농도 최신 상태 확인 중…';
   try{const raw=await o.fresh(),r=partition(raw);if(!o.guard()||seq!==generation)throw Error('입력이 변경됐습니다. 다시 확인해주세요.');
    for(const c of cards.values())if(c.selected.checked){
     if(c.saved&&!c.touched){const latest=savedFor(r.anesthesiaItems,c.d);if(!latest||!sameRevision(latest.record,c.saved)||latest.value!==+c.stock.value||c.coStock&&latest.companionStock!==+c.coStock.value)throw Error('저장된 농도가 변경됐습니다. 저장값을 다시 불러와주세요.');}
     if(c.product){const p=stockOptions(c.d,r.items,species.value).find(x=>x.id===c.product.id);if(!p||p.revision!==c.product.revision||p.value!==+c.stock.value)throw Error('저장된 제품이 변경됐습니다. 농도를 다시 확인해주세요.');}
    }
    update();if(plan.querySelector('button').disabled)throw Error('선택한 용량을 확인해주세요.');await navigator.clipboard.writeText(report);plan.querySelector('[data-an-copy-status]').textContent='확인한 계획을 복사했습니다.';
   }catch(e){plan.querySelector('[data-an-copy-status]').textContent=e.message;}
  };
  function filterCards(){const purpose=finder.querySelector('[data-an-purpose]').value,pain=['butorphanol','methadone','buprenorphine','hydromorphone'];const group=panel.querySelector('[data-an-group][aria-pressed=true]')?.dataset.anGroup||'all',query=finder.querySelector('[data-an-search]').value.toLowerCase().trim(),only=finder.querySelector('[data-an-selected-only]').checked;let count=0;for(const c of cards.values()){c.card.hidden=(purpose==='pain'&&!pain.includes(c.d.id)||purpose==='sedation'&&(c.d.group!=='premed'||pain.includes(c.d.id))||purpose==='iv'&&(c.d.group!=='induction'||c.d.route!=='IV')||purpose==='im'&&(c.d.group!=='induction'||c.d.route!=='IM'))||(group!=='all'&&c.d.group!==group)||!c.d.name.toLowerCase().includes(query)||(only&&!c.selected.checked);if(!c.card.hidden)count++;}finder.querySelector('[data-an-empty]').hidden=count>0;}
  finder.addEventListener('input',filterCards);finder.querySelector('[data-an-purpose]').onchange=()=>{panel.querySelectorAll('[data-an-group]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.anGroup==='all')));filterCards();};panel.querySelectorAll('[data-an-group]').forEach(btn=>btn.onclick=()=>{panel.querySelectorAll('[data-an-group]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));filterCards();});
  species.addEventListener('change',reset);weight.addEventListener('input',()=>{generation++;for(const c of cards.values())c.selected.checked=false;update();});
  b.addEventListener('change',e=>{if(e.target.matches('[data-record-weight-confirm]'))update();});reset();
  return {loaded,failed,refresh:update,reset};
 }
 const api={drugs,sources,calculate,stockOptions,isSavedStock,partition,savedFact,savedFor,stockBody,mount};
 if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeAnesthesia=api;
})(typeof window==='undefined'?globalThis:window);
