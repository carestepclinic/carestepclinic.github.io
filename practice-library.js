/* Authenticated clinic reference reader; extracted values require regimen review. */
(function(g){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const groups={systemic:'일반 약물',ophthalmic:'안과용',dermatologic:'피부용',otic:'귀 치료용'};
 const names={'Introduction':'약물·제품 정보','Prescriber Highlights':'처방 전 핵심 사항','Uses/Indications':'적응증','Pharmacology/Actions':'약리 작용','Pharmacokinetics':'약동학','Laboratory Considerations':'검사 시 고려사항','Chemistry/Synonyms':'성분·동의어','Dosages':'동물종별 용법·용량','Contraindications/Precautions/Warnings':'금기·주의사항','Drug Interactions':'상호작용','Monitoring':'모니터링','Adverse Effects':'이상반응','Reproductive/Nursing Safety':'임신·수유','Overdose/Acute Toxicity':'과량 투여·독성','Dosage Forms/Regulatory Status':'제형·허가 상태','Storage/Stability':'보관·안정성','Compatibility/Compounding Considerations':'혼합·조제','References':'참고 문헌'};
 async function hash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof text==='string'?new TextEncoder().encode(text):text))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function mount(b,o){
  let library=null,entry=null,serial=0,active=null,pdf=null,pdfHash='',disposed=false;
  const alive=()=>!disposed&&o.alive(),request=(path,options)=>o.request('/practice/references'+path,options);
  const shell=document.createElement('section');shell.className='pt-card pt-library';
  shell.innerHTML='<div class="pt-heading"><div><h3>약물 참고자료 · 우리 병원</h3><p class="pt-help">약물명 검색 → 개·고양이 용법 선택 → 용량 범위의 하한값 불러오기</p></div><button type="button" data-library-open>Plumb’s 약물 찾기</button></div><div data-library-content hidden><p data-library-status role="status"></p><div data-library-controls></div><div class="pt-library-layout"><div data-library-list></div><section data-library-detail aria-live="polite"></section></div></div>';
  b.querySelector('.pt-calc-common').after(shell);
  const el=k=>shell.querySelector('[data-library-'+k+']');
  function clearContext(){const previous=active;active=null;for(const f of b.querySelectorAll('[data-calc=dose],[data-calc=cri]')){if(previous?.kind===f.dataset.calc)for(const key of ['dose','concentration','stock','times','days','totalDoses','volume','rate','stockML','bsa'])if(f.elements[key])f.elements[key].value='';f.querySelector('[data-private-context]')?.remove();delete f.dataset.privateSource;delete f.dataset.privateTitle;}o.clear();o.refresh?.();}
  function context(kind){return active&&(!kind||active.kind===kind)?{title:active.title,source:active.source}:null;}
  function importDialog(){
   const d=o.modal('병원 내부 약물 자료 등록','<p>준비된 CARESTEP 약물 자료 파일을 등록합니다. 우리 병원 계정에서만 조회하며 보호자 HOME에는 제공하지 않습니다.</p><label>자료 파일<input data-library-file type="file" accept=".json,.carestep-reference.json"></label><p data-import-summary></p><button type="button" data-import-run disabled>병원 내부 자료로 등록</button><p data-import-status role="status"></p>');
   const input=d.querySelector('[data-library-file]'),button=d.querySelector('[data-import-run]'),status=d.querySelector('[data-import-status]');let doc=null,fileSeq=0;
   input.onchange=async()=>{const seq=++fileSeq;button.disabled=true;doc=null;try{const file=input.files[0];if(!file)return;if(file.size>40000000)throw Error('40 MB 이하의 자료 파일을 선택해주세요.');const parsed=JSON.parse(await file.text());if(seq!==fileSeq||!alive()||!d.isConnected)return;if(parsed.format!=='carestep-private-reference-v1'||parsed.usage!=='clinic-only'||!Array.isArray(parsed.items)||parsed.items.length<1||parsed.items.length>1500||!/^[a-f0-9]{64}$/.test(parsed.sourceHash))throw Error('준비된 CARESTEP 병원 전용 자료 파일을 선택해주세요.');doc=parsed;d.querySelector('[data-import-summary]').textContent=doc.title+' · '+doc.items.length+'개 항목 · 병원 내부 전용';button.disabled=false;status.textContent='';}catch(e){status.textContent='파일 확인 실패: '+e.message;}};
   button.onclick=async()=>{if(!doc||!alive())return;button.disabled=input.disabled=true;try{
    status.textContent='원문 무결성을 확인하는 중…';const index=[];for(const e of doc.items){index.push({id:e.id,title:e.title,aliases:e.aliases,group:e.group,page:e.page,endPage:e.endPage,printedPage:e.printedPage,errata:e.errata,hash:await hash(JSON.stringify(e))});}
    if(!alive()||!d.isConnected)return;
    const state=await request('/import',{method:'POST',body:JSON.stringify({...doc,items:undefined,index,confirmInternalUse:true})});if(!alive()||!d.isConnected)return;
    const stored=new Set(state.stored),pending=doc.items.filter(x=>!stored.has(x.id));let done=stored.size;
    for(let i=0;i<pending.length;i+=5){if(!alive()||!d.isConnected)return;await request('/'+state.id+'/items',{method:'POST',body:JSON.stringify({items:pending.slice(i,i+5)})});done+=pending.slice(i,i+5).length;status.textContent=done+' / '+doc.items.length+'개 등록 중…';}
    if(!alive()||!d.isConnected)return;await request('/'+state.id+'/complete',{method:'POST',body:'{}'});if(!alive()||!d.isConnected)return;o.close();await load();
   }catch(e){if(d.isConnected)status.textContent=e.message+' 같은 파일을 선택하면 완료한 항목을 건너뛰고 이어서 등록합니다.';}finally{if(d.isConnected)button.disabled=input.disabled=false;}};
  }
  async function load(){
   const seq=++serial;el('content').hidden=false;el('status').textContent='병원 약물 자료를 확인하는 중…';el('controls').replaceChildren();el('list').replaceChildren();el('detail').replaceChildren();entry=null;
   try{const r=await request('');if(!alive()||seq!==serial)return;
    const ready=r.libraries.filter(x=>x.status==='ready');el('controls').innerHTML=(ready.length?'<label>자료 선택<select data-library-choice>'+ready.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+' · '+x.count+'개</option>').join('')+'</select></label>':'')+(r.canManage?'<button type="button" data-library-import>내부 자료 등록·이어하기</button>':'');
    shell.querySelector('[data-library-import]')?.addEventListener('click',importDialog);
    if(!ready.length){el('status').textContent=r.libraries.length?'자료를 등록 중입니다. 원장·관리자가 같은 파일로 이어서 등록할 수 있습니다.':'등록된 병원 전용 약물 자료가 없습니다.';library=null;return;}
    const choice=shell.querySelector('[data-library-choice]');choice.onchange=()=>openLibrary(choice.value);await openLibrary(choice.value);
   }catch(e){if(alive()&&seq===serial){el('status').textContent=e.message;const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.onclick=load;el('controls').append(retry);}}
  }
  async function openLibrary(id){
   const seq=++serial;entry=null;library=null;clearContext();el('detail').replaceChildren();el('list').textContent='목차를 불러오는 중…';
   try{const doc=await request('/'+id);if(!alive()||seq!==serial)return;library=doc;el('status').textContent=doc.index.length+'개 항목 · 병원 내부 전용 · 추출 원문 · 정오표 연결 확인 '+doc.checkedAt;
    el('list').innerHTML='<label>약물·제품명 검색<input data-library-query type="search" placeholder="영문 성분명·제품명·등록된 한글명"></label><label>분류<select data-library-group><option value="">전체 분류</option>'+Object.entries(groups).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><p data-library-count></p><div data-library-results></div><div class="pt-bar"><button type="button" data-library-prev>이전</button><span data-library-page></span><button type="button" data-library-next>다음</button></div>';
    let page=0;function list(){const q=el('query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),group=el('group').value,items=library.index.filter(x=>(!group||x.group===group)&&q.every(term=>(x.title+' '+x.aliases).toLowerCase().includes(term)));const max=Math.max(1,Math.ceil(items.length/25));page=Math.min(page,max-1);el('count').textContent=items.length+'개 검색됨';el('page').textContent=(page+1)+' / '+max;el('prev').disabled=page===0;el('next').disabled=page===max-1;el('results').innerHTML=items.slice(page*25,page*25+25).map(x=>'<button type="button" class="pt-library-item" data-reference-id="'+esc(x.id)+'" aria-pressed="'+(entry?.id===x.id)+'"><b>'+esc(x.title)+'</b><small>'+groups[x.group]+' · 원문 '+esc(x.printedPage)+'쪽'+(x.errata?' · 정오표 있음':'')+'</small></button>').join('')||'<p>검색 결과가 없습니다. 영문 성분명 또는 분류로 다시 찾아주세요.</p>';for(const btn of el('results').querySelectorAll('button'))btn.onclick=()=>openEntry(btn.dataset.referenceId);}
    el('query').oninput=el('group').onchange=()=>{serial++;entry=null;clearContext();el('detail').replaceChildren();page=0;list();};el('prev').onclick=()=>{page--;list();};el('next').onclick=()=>{page++;list();};list();
   }catch(e){if(alive()&&seq===serial){el('status').textContent=e.message;el('list').replaceChildren();}}
  }
  async function openEntry(id){
   const seq=++serial,doc=library;if(!doc)return;entry=null;clearContext();el('detail').textContent='약물 원문을 불러오는 중…';
   try{const r=await request('/'+doc.id+'/entries/'+id);if(!alive()||seq!==serial||library!==doc)return;entry=r.entry;const e=entry;
    for(const btn of el('results').querySelectorAll('button'))btn.setAttribute('aria-pressed',String(btn.dataset.referenceId===id));
    el('detail').innerHTML='<h3 tabindex="-1">'+esc(e.title)+'</h3><p class="pt-help">'+groups[e.group]+' · 책 '+esc(e.printedPage)+'쪽 / PDF '+e.page+'~'+e.endPage+'쪽</p><p class="pt-notice">원문 추출본입니다. 동물종·적응증·투여경로·1회량과 1일량을 구분하고 실제 제품 및 정오표와 대조하세요.</p>'+(e.errata?'<p class="pt-error">이 항목은 공식 정오표의 수정 대상입니다. 적용 전에 수정 내용을 확인해주세요.</p>':'')+'<div class="pt-bar"><a href="https://plumbs.com/handbook-errata-10th-edition/" target="_blank" rel="noopener noreferrer">공식 정오표 확인</a><button type="button" data-library-pdf>원본 PDF 확인</button></div><section data-library-profiles></section><div data-library-reading></div><details class="pt-library-bridge" open><summary>용법을 직접 입력하려면</summary>'+(e.group==='systemic'?'<label>연결할 계산<select data-library-calculator><option value="dose">1회 투약·정제 계산</option><option value="cri">지속정주·CRI 계산</option></select></label><label class="pt-choice"><input data-library-reviewed type="checkbox">원문·정오표를 확인했고, 이번 환자에 적용할 용법은 의료진이 정합니다.</label><button type="button" data-library-prepare>이 약물로 계산 준비</button>':'<p>안과·피부·귀 치료용 항목은 국소 적용 원문을 확인합니다. 점안 횟수나 국소 사용량을 체중당 전신 용량으로 바꾸지 않습니다.</p>')+'<p data-library-action-status role="status"></p></details>';
    const priority=['Dosages','Contraindications/Precautions/Warnings','Prescriber Highlights','Uses/Indications','Drug Interactions','Monitoring'];const ordered=[...e.sections].sort((a,b)=>{const ai=priority.indexOf(a.heading),bi=priority.indexOf(b.heading);return (ai<0?99:ai)-(bi<0?99:bi);});el('reading').before(el('detail').querySelector('.pt-library-bridge'));renderProfiles(e,doc);for(const s of ordered){const d=document.createElement('details');d.open=s.heading==='Dosages'&&!el('profiles').querySelector('[data-dose-candidate]');const summary=document.createElement('summary');summary.textContent=names[s.heading]||s.heading;const text=document.createElement('div');text.className='pt-library-text';text.textContent=s.text;d.append(summary,text);el('reading').append(d);}
    el('pdf').onclick=()=>openPdf(e,doc);el('prepare')?.addEventListener('click',()=>{if(!el('reviewed').checked){el('action-status').textContent='원문·정오표 확인 후 계산을 준비해주세요.';return;}prepare(e,doc,el('calculator').value);});
    if(matchMedia('(max-width:800px)').matches)el('detail').querySelector('h3').focus();
   }catch(e){if(alive()&&seq===serial)el('detail').textContent=e.message;}
  }
  function profileAmount(p){return p.low+' '+(p.kind==='cri'?p.doseUnit:p.unit+(p.basis==='kg'?'/kg/회':p.basis==='bsa'?'/m²/회':'/마리/회'));}
  function renderProfiles(e,doc){
   const target=el('profiles');if(!target)return;const species=b.querySelector('[data-ref-species]').value;
   target.replaceChildren();const heading=document.createElement('h4');heading.textContent='개·고양이 용법 → 계산기';target.append(heading);
   if(!g.PracticeLibraryDose){const p=document.createElement('p');p.textContent='용법 자동 입력을 불러오지 못했습니다. 원문 확인 후 아래에서 직접 입력할 수 있습니다.';target.append(p);return;}
   if(!['dog','cat'].includes(species)){target.insertAdjacentHTML('beforeend','<p>이번 환자의 동물종을 선택하면 해당 용법만 표시합니다.</p><button type="button" data-library-species-pick>상단에서 개·고양이 선택</button>');target.querySelector('button').onclick=()=>{const select=b.querySelector('[data-ref-species]');select.focus();select.scrollIntoView({block:'center',behavior:'smooth'});};return;}
   const data=g.PracticeLibraryDose.analyze(e),profiles=data.profiles.filter(p=>p.species===species),usable=profiles.filter(p=>p.eligible),held=profiles.filter(p=>!p.eligible);const manual=el('detail').querySelector('.pt-library-bridge');if(manual)manual.open=usable.length===0;
   target.insertAdjacentHTML('beforeend','<p class="pt-help">'+(species==='dog'?'개':'고양이')+' · 하한값 연결 '+usable.length+'개 · 원문 확인 '+held.length+'개</p><p class="pt-notice">원문에서 추출한 참고값입니다. 용법별 범위의 하한이며 환자별 권장량을 뜻하지 않습니다. 적응증·경로·주의사항을 확인하고 사용할 용법을 선택하세요.</p>');
   if(!profiles.length){target.insertAdjacentHTML('beforeend','<p>이 항목에서 선택한 종의 용법을 명확히 구분할 수 없습니다. 아래 원문에서 제품·동물종별 용법을 확인해주세요.</p>');return;}
   if(data.notes){const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('div');s.textContent='용량 구역 공통 안내';p.className='pt-library-text';p.textContent=data.notes;d.append(s,p);target.append(d);}
   for(const p of usable){const card=document.createElement('article');card.className='pt-dose-profile';card.dataset.doseCandidate=p.id;
    card.innerHTML='<h5>'+esc(p.title.replace(/:$/,''))+'</h5><div class="pt-dose-metrics"><b>'+esc(profileAmount(p))+'</b><span>'+esc(p.route)+' · '+esc(p.frequency.text)+'</span></div><p class="pt-help">원문 범위 '+esc(p.range)+' · '+esc(p.phase)+'</p><details><summary>이 용법의 원문 확인</summary><div class="pt-library-text">'+esc(p.text)+'</div></details><button type="button" data-dose-load>이 용법의 '+(p.low===p.high?'참고값':'하한값')+' 불러오기</button><p data-dose-status role="status"></p>';
    const button=card.querySelector('button');button.onclick=()=>{if(!alive()||entry!==e||library!==doc||b.querySelector('[data-ref-species]').value!==p.species)return;prepare(e,doc,p.kind,p);card.querySelector('[data-dose-status]').textContent='계산기에 불러왔습니다. 제품 함량·기간을 입력하고 환자별 적합성을 확인해주세요.';};target.append(card);
   }
   if(held.length){const d=document.createElement('details'),s=document.createElement('summary');s.textContent='직접 확인할 원문 용법 '+held.length+'개';d.append(s);for(const p of held){const row=document.createElement('div');row.className='pt-dose-held';const title=document.createElement('b'),why=document.createElement('p'),source=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');title.textContent=p.title;why.textContent=[...new Set(p.reasons)].join(' · ');summary.textContent='용법 원문';body.className='pt-library-text';body.textContent=p.text;source.append(summary,body);row.append(title,why,source);d.append(row);}target.append(d);}
  }
  function openPdf(e,doc){
   const d=o.modal('원본 PDF 확인','<p>원본 파일은 이 브라우저에서만 열며 서버로 전송하지 않습니다. 최초 1회 해당 Plumb’s PDF를 선택해주세요.</p><label>원본 PDF<input type="file" accept="application/pdf" data-source-file></label><p data-source-status role="status"></p><a data-source-open target="_blank" rel="noopener" hidden>PDF '+e.page+'쪽 열기</a>');const link=d.querySelector('a'),status=d.querySelector('[data-source-status]');
   const show=()=>{link.href=pdf+'#page='+e.page;link.hidden=false;status.textContent='등록한 원본 파일과 일치합니다. 책 '+e.printedPage+'쪽에 해당합니다.';};if(pdf&&pdfHash===doc.sourceHash)show();
   d.querySelector('input').onchange=async ev=>{try{const file=ev.target.files[0];link.hidden=true;if(!file)return;if(file.size>100000000)throw Error('100 MB 이하의 원본 파일을 선택해주세요.');status.textContent='원본 파일을 확인하는 중…';const digest=await hash(await file.arrayBuffer());if(!alive()||!d.isConnected)return;if(digest!==doc.sourceHash)throw Error('등록한 자료의 원본 PDF와 다릅니다. 같은 파일을 선택해주세요.');if(pdf)URL.revokeObjectURL(pdf);pdf=URL.createObjectURL(file);pdfHash=digest;show();}catch(e){status.textContent=e.message;}};
  }
  function prepare(e,doc,kind,profile){
   if(!alive()||!['dose','cri'].includes(kind))return;const species=b.querySelector('[data-ref-species]').value;if(!['dog','cat'].includes(species)){el('action-status').textContent='상단에서 이번 환자의 동물종을 선택해주세요.';return;}
   o.resetReference();o.dropProtocols();clearContext();const f=b.querySelector('[data-calc='+kind+']'),weight=b.querySelector('[data-common-weight]').value;f.reset();if(f.elements.weight)f.elements.weight.value=weight;for(const key of ['dose','concentration','stock','times','days','totalDoses','volume','rate','stockML','bsa'])if(f.elements[key])f.elements[key].value='';
   if(f.elements.drug)f.elements.drug.value=e.title;for(const key of ['doseBasis','courseMode','mode'])f.elements[key]?.dispatchEvent(new Event('change',{bubbles:true}));
   if(profile){
    if(!profile.eligible||profile.species!==species)return;
    const set=(key,value,event)=>{if(f.elements[key]){f.elements[key].value=value;if(event)f.elements[key].dispatchEvent(new Event('change',{bubbles:true}));}};
    if(kind==='dose'){set('doseBasis',profile.basis,true);set('doseUnit',profile.unit,true);set('strengthUnit',profile.unit,true);set('courseMode',profile.frequency.single?'total':'days',true);set('times',profile.frequency.times||'');set('totalDoses',profile.frequency.single?'1':'');}
    else {set('doseUnit',profile.doseUnit,true);set('stockUnit',profile.unit,true);}
    set('dose',profile.low);f.dispatchEvent(new Event('input',{bubbles:true}));
   }
   active={kind,title:e.title,source:doc.title+' · '+e.title+' · 책 '+e.printedPage+'쪽 · 원본 '+doc.sourceHash.slice(0,12)+(profile?' · '+(species==='dog'?'개':'고양이')+' · '+profile.title+' · '+profile.route+' · 원문 '+profile.range+' · '+profile.frequency.text:''),species,profile};
   f.dataset.privateSource=active.source;f.dataset.privateTitle=e.title;
   const panel=document.createElement('section');panel.className='pt-notice';panel.dataset.privateContext='';panel.innerHTML='<b>'+esc(e.title)+'</b>'+(profile?'<p>'+esc(profile.title)+' · '+esc(profile.route)+'</p><p>불러온 참고값: '+esc(profileAmount(profile))+' · '+esc(profile.frequency.text)+'</p><p>제품 함량·투약 기간은 직접 입력합니다. 필요하면 용량을 수정하고 이번 환자에 맞는지 확인하세요.</p><details><summary>불러온 용법 원문</summary><div class="pt-library-text">'+esc(profile.text)+'</div></details>':'<p>원문을 확인한 처방량·단위·제품을 직접 입력하세요. 수치는 자동 입력되지 않습니다.</p>')+'<label class="pt-choice"><input data-private-confirm type="checkbox">입력한 용법·제품·단위·주의사항을 이번 환자에 맞춰 확인했습니다.</label><button type="button" data-private-release>약물 연결 해제</button><p data-private-error role="status"></p>';f.querySelector('h3').after(panel);panel.querySelector('button').onclick=clearContext;f.querySelector('[data-settings]')?.setAttribute('open','');o.showKind(kind==='dose'?'med':'cri');o.refresh();f.querySelector('h3').scrollIntoView({block:'start',behavior:'smooth'});el('action-status').textContent=e.title+' 계산 입력을 준비했습니다.';
  }
  for(const f of b.querySelectorAll('[data-calc=dose],[data-calc=cri]')){
   f.addEventListener('submit',ev=>{if(!active||active.kind!==f.dataset.calc)return;const check=f.querySelector('[data-private-confirm]');if(!alive()||b.querySelector('[data-ref-species]').value!==active.species||!check?.checked){ev.preventDefault();ev.stopImmediatePropagation();o.clear();const error=f.querySelector('[data-private-error]');if(error)error.textContent='이번 환자에 적용할 용법·제품·단위를 확인해주세요.';}},true);
   f.addEventListener('input',ev=>{if(ev.target.matches('[data-private-confirm]')||ev.target.closest('[data-result-actions]'))return;const check=f.querySelector('[data-private-confirm]');if(check)check.checked=false;});
  }
  b.addEventListener('change',ev=>{if(ev.target.matches('[data-ref-species],[data-protocol],[data-preset],[data-ref-drug],[data-ref-profile]'))clearContext();if(ev.target.matches('[data-ref-species]')&&entry&&library)renderProfiles(entry,library);},true);
  b.addEventListener('click',ev=>{if(ev.target.closest('[data-ref-apply],[data-ref-manual],[data-manual],[data-use-weight]')){clearContext();const field=b.querySelector('[name=bsa]');if(field)field.value='';}},true);
  b.querySelector('[data-common-weight]')?.addEventListener('input',()=>{const field=b.querySelector('[name=bsa]');if(field)field.value='';for(const check of b.querySelectorAll('[data-private-confirm]'))check.checked=false;});
  el('open').onclick=()=>{if(!el('content').hidden){el('content').hidden=true;el('open').textContent='Plumb’s 약물 찾기';return;}el('open').textContent='약물 자료 접기';void load();};
  return {context,clearContext,report(f,text){return active?.kind===f.dataset.calc?'확인 원문: '+active.source+'\n'+text:text;},dispose(){disposed=true;serial++;if(pdf)URL.revokeObjectURL(pdf);pdf=null;library=null;entry=null;active=null;}};
 }
 g.PracticeLibrary={mount,hash};
})(window);
