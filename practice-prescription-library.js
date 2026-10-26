/* Authenticated, clinic-scoped reference linkage. Handbook content stays in private API responses and transient memory. */
(function(g){
 'use strict';
 const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[™®]/g,'').replace(/[^a-z0-9가-힣]/g,'');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const groups={systemic:'전신 약물',ophthalmic:'안과용',dermatologic:'피부용',otic:'귀 치료용'};
 const headings=[['Contraindications/Precautions/Warnings','금기·주의사항'],['Drug Interactions','병용·상호작용'],['Prescriber Highlights','처방 핵심 사항'],['Adverse Effects','이상반응'],['Reproductive/Nursing Safety','임신·수유'],['Monitoring','모니터링'],['Laboratory Considerations','검사 시 고려사항']];
 function sections(entry){return headings.map(([heading,label])=>({heading,label,text:(entry.sections||[]).filter(s=>normalize(s.heading)===normalize(heading)).map(s=>s.text).filter(x=>typeof x==='string'&&x.trim()).join('\n\n')}));}
 function names(row,resolve=g.PracticeIngredients?.resolve){
  const values=[row.drug,row.ingredient,row.calculationIngredient].filter(Boolean),out=new Set(values.map(normalize));
  // Use exact ingredient aliases only. Broad discovery/referenceNames may include combination products.
  for(const value of values){const family=resolve?.(value);if(family){out.add(normalize(family.english));if(!family.complex)for(const alias of family.aliases||[])out.add(normalize(alias));}}
  for(const [alias,name] of [['pds','prednisolone'],['udca','ursodiol'],['ursodeoxycholicacid','ursodiol']])if(out.has(alias))out.add(name);
  out.delete('');return out;
 }
 function candidates(index,row,resolve){const keys=names(row,resolve);return index.filter(e=>[e.title,...String(e.aliases||'').split(/[;|\n,]/)].some(v=>keys.has(normalize(v))));}
 function automatic(found,row={}){const e=found[0];return found.length===1&&e.group==='systemic'&&(!/[+\/]|\s(?:and|with)\s/i.test(e.title)||names(row).has(normalize(e.title)))?e:null;}
 function rowKey(row){return JSON.stringify([normalize(row.drug),normalize(row.ingredient),normalize(row.calculationIngredient),row.route||'']);}
 function createClient(request,guard=()=>true){
  let epoch=0,disposed=false,indexPromise=null;const entries=new Map();
  const valid=(token)=>!disposed&&epoch===token&&guard();
  async function index(){
   if(indexPromise)return indexPromise;const token=epoch;
   const promise=(async()=>{const r=await request('/practice/references');if(!valid(token))return null;if(!Array.isArray(r.libraries))throw Error('병원 자료 목록 응답을 확인하지 못했습니다.');
    const ready=r.libraries.filter(x=>x.status==='ready'),docs=[];
    for(const library of ready){if(!valid(token))return null;const doc=await request('/practice/references/'+encodeURIComponent(library.id));if(!valid(token))return null;if(!Array.isArray(doc.index)||doc.index.length!==library.count)throw Error('약물 목차가 변경되었거나 일부 누락되었습니다. 다시 불러와주세요.');docs.push(doc);}
    return {libraries:ready,importing:r.libraries.some(x=>x.status!=='ready'),items:docs.flatMap(doc=>doc.index.map(e=>({...e,key:doc.id+':'+e.id,libraryId:doc.id,libraryTitle:doc.title,sourceHash:doc.sourceHash,checkedAt:doc.checkedAt}))) };
   })();indexPromise=promise;
   try{return await promise;}catch(e){if(valid(token))indexPromise=null;throw e;}
  }
  async function entry(meta){
   const key=meta.key+'|'+meta.hash;if(entries.has(key))return entries.get(key);const token=epoch;
   const promise=(async()=>{if(!valid(token))return null;const r=await request('/practice/references/'+encodeURIComponent(meta.libraryId)+'/entries/'+encodeURIComponent(meta.id));if(!valid(token))return null;const e=r.entry;if(!e||e.id!==meta.id||e.title!==meta.title||e.group!==meta.group||e.page!==meta.page||!Array.isArray(e.sections))throw Error('연결한 약물과 원문이 일치하지 않습니다.');return e;})();entries.set(key,promise);
   try{return await promise;}catch(e){if(valid(token))entries.delete(key);throw e;}
  }
  return {index,entry,reset(){epoch++;indexPromise=null;entries.clear();},dispose(){disposed=true;epoch++;indexPromise=null;entries.clear();}};
 }
 function mount(host,o){
  if(!o.request)return null;
  const box=document.createElement('section');box.className='pt-private-safety';box.setAttribute('aria-label','Plumb’s 안전성 참고자료');
  box.innerHTML='<div class="pt-heading"><h4>Plumb’s · 병원 등록 안전성 자료</h4><button type="button" data-private-reload>자료 다시 불러오기</button></div><p class="pt-help">등록된 전체 약물 목차에서 연결합니다. 금기·주의·상호작용은 등록 원문으로 제공하며, 처방 조합의 자동 판정 결과와는 구분합니다.</p><p data-private-status role="status" aria-live="polite"></p><div data-private-drugs></div>';
  host.querySelector('.pt-drug-references').before(box);
  const client=createClient(o.request,()=>alive()),list=box.querySelector('[data-private-drugs]'),status=box.querySelector('[data-private-status]');
  let disposed=false,generation=0,rows=[],signature='',catalog=null,choice=new Map(),cards=new Map(),timer=null;
  const alive=()=>!disposed&&host.isConnected&&(!o.guard||o.guard());
  const active=()=>alive()&&!host.closest('[data-kind-panel]')?.hidden;
  function clearCards(){generation++;cards.clear();list.replaceChildren();}
  function picker(card,row,found){
   const details=document.createElement('details');details.className='pt-private-picker';details.open=!automatic(found,row);
   details.innerHTML='<summary>약물 연결·변경</summary><label>전체 목차 검색<input type="search" data-private-search placeholder="성분명·제품명·등록 별칭"></label><label>연결할 원문 항목<select data-private-choice><option value="">항목 선택</option></select></label><button type="button" data-private-connect>선택한 항목 연결</button><p data-private-pick-status></p>';
   card.append(details);const search=details.querySelector('input'),select=details.querySelector('select'),info=details.querySelector('p');
   function options(){const q=normalize(search.value),all=q?catalog.items.filter(e=>normalize(e.title+' '+e.aliases+' '+e.libraryTitle).includes(q)):found.length?found:catalog.items;const selected=choice.get(rowKey(row));select.replaceChildren(new Option('항목 선택',''));for(const item of all.slice(0,100))select.add(new Option(item.title+' · '+(groups[item.group]||item.group)+' · '+item.libraryTitle,item.key));if(selected&&all.some(e=>e.key===selected))select.value=selected;info.textContent=all.length>100?all.length+'개 검색됨 · 앞 100개 표시. 검색어를 더 입력해 범위를 좁혀주세요.':all.length+'개 후보';}
   search.oninput=options;options();details.querySelector('button').onclick=()=>{const meta=catalog.items.find(e=>e.key===select.value);if(!meta){info.textContent='연결할 원문 항목을 선택해주세요.';return;}choice.set(rowKey(row),meta.key);details.open=false;void read(card,meta,generation);};
  }
  async function read(card,meta,token){
   const target=card.querySelector('[data-private-content]');target.textContent='금기·주의·상호작용 원문을 불러오는 중…';card.dataset.entryKey=meta.key;
   try{const entry=await client.entry(meta);if(!entry||!active()||token!==generation||!card.isConnected||card.dataset.entryKey!==meta.key)return;
    target.replaceChildren();const source=document.createElement('p');source.className='pt-help';source.textContent=meta.libraryTitle+' · '+entry.title+' · '+(groups[entry.group]||entry.group)+' · 책 '+meta.printedPage+'쪽 / PDF '+meta.page+'–'+meta.endPage+'쪽 · 등록 확인 '+meta.checkedAt;target.append(source);
    if(meta.errata||entry.errata){const warning=document.createElement('p');warning.className='pt-error';warning.textContent='공식 정오표 수정 대상입니다. 적용 전 수정 내용을 함께 확인하세요.';target.append(warning);const link=document.createElement('a');link.href='https://plumbs.com/handbook-errata-10th-edition/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='공식 정오표 확인';target.append(link);}
    const note=document.createElement('p');note.className='pt-help';note.textContent='병원 내부 등록 원문 · 문서의 동물종·경로·조건을 함께 확인하세요. 원문 연결만으로 이 처방의 안전성이 판정되지는 않습니다.';target.append(note);
    for(const section of sections(entry)){const detail=document.createElement('details');detail.dataset.privateSection=section.heading;detail.open=['Contraindications/Precautions/Warnings','Drug Interactions'].includes(section.heading);const summary=document.createElement('summary');summary.textContent=section.label+(section.text?'':' · 등록 원문 구역 없음');detail.append(summary);const text=document.createElement('div');text.className='pt-private-text';text.textContent=section.text||'해당 제목의 원문 구역이 등록돼 있지 않습니다. 금기·주의사항이 없다는 뜻은 아닙니다.';detail.append(text);target.append(detail);}
   }catch(e){if(!active()||token!==generation||card.dataset.entryKey!==meta.key)return;target.textContent='원문 조회 실패 · '+(e.message||'다시 시도해주세요.');const retry=document.createElement('button');retry.type='button';retry.textContent='이 약물 다시 불러오기';retry.onclick=()=>void read(card,meta,token);target.append(retry);}
  }
  async function render(){
   if(!active()||!rows.length)return;const token=generation;status.textContent='병원 등록 약물 목차를 확인하는 중…';
   try{const data=await client.index();if(!data||!active()||token!==generation)return;catalog=data;
    if(!data.items.length){status.textContent=data.importing?'약물 자료 등록 중입니다. 등록 완료 후 다시 불러와주세요.':'등록된 병원 내부 약물 자료가 없습니다. 계산기 상단의 Plumb’s 약물 찾기에서 등록 상태를 확인하세요.';return;}
    status.textContent='병원 자료 '+data.libraries.length+'개 · 전체 '+data.items.length+'개 항목 연결 가능'+(data.importing?' · 등록 중인 자료 제외':'')+' · '+data.libraries.map(x=>x.title).join(' / ');
    const work=[];for(const row of rows){const key=rowKey(row),found=candidates(data.items,row),selected=data.items.find(x=>x.key===choice.get(key)),meta=selected||automatic(found,row),card=document.createElement('article');card.className='pt-private-drug';const heading=document.createElement('h5');heading.textContent=row.drug||'약물명 확인 필요';card.append(heading);const content=document.createElement('div');content.dataset.privateContent='';card.append(content);list.append(card);cards.set(key,card);
     if(meta){if(!selected)choice.set(key,meta.key);work.push(()=>choice.get(key)===meta.key?read(card,meta,token):null);}else content.textContent=found.length?'여러 후보 또는 국소 제형이 검색됐습니다. 적용할 원문 항목을 확인해 연결해주세요.':'이 이름으로 자동 연결된 항목이 없습니다. 전체 목차에서 원문 항목을 찾아 연결할 수 있습니다.';
     picker(card,row,found);
    }
    // Bound requests; fetch only the prescribed drugs, never the entire handbook.
    let next=0;await Promise.all(Array.from({length:Math.min(3,work.length)},async()=>{while(next<work.length&&active()&&token===generation){const fn=work[next++];await fn();}}));
   }catch(e){if(active()&&token===generation){status.textContent='병원 약물 자료 연결 실패 · '+(e.message||'다시 불러와주세요.');}}
  }
  function update(nextRows){
   const unique=[...new Map((nextRows||[]).map(r=>[rowKey(r),r])).values()],next=JSON.stringify(unique.map(r=>[rowKey(r),[...names(r)].sort()]));rows=unique;
   if(next===signature)return;signature=next;clearTimeout(timer);clearCards();box.hidden=!rows.length;
   if(!rows.length){choice.clear();status.textContent='';return;}timer=setTimeout(()=>void render(),180);
  }
  const reload=()=>{if(!alive())return;clearTimeout(timer);client.reset();catalog=null;choice.clear();clearCards();void render();};box.querySelector('[data-private-reload]').onclick=reload;
  const panel=host.closest('[data-kind-panel]'),visibility=new MutationObserver(()=>{if(active()&&rows.length){clearTimeout(timer);clearCards();void render();}});if(panel)visibility.observe(panel,{attributes:true,attributeFilter:['hidden']});
  box.hidden=true;return {update,dispose(){disposed=true;generation++;clearTimeout(timer);visibility.disconnect();client.dispose();catalog=null;rows=[];choice.clear();cards.clear();box.remove();}};
 }
 const api={normalize,names,candidates,automatic,sections,createClient,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticePrescriptionLibrary=api;
})(typeof window==='undefined'?globalThis:window);
