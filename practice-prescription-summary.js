/* Korean safety drafts. Private responses stay in memory; generation is an explicit one-time action. */
(function(g){
 'use strict';
 const labels={interaction:'병용 참고사항',liver:'간',kidney:'신장',other:'기타 금기·주의',monitoring:'모니터링'};
 const levels={contraindication:'금기',avoid:'병용·사용 회피',caution:'주의',monitor:'관찰·검사',info:'참고'};
 const species={dog:'개',cat:'고양이',other:'기타 동물',unspecified:'종 특정 없음'};
 const ref=m=>({libraryId:m.libraryId,entryId:m.id});
 function plans(metas,unlinked,combination=false){const unique=[...new Map(metas.map(m=>[m.key,m])).values()].sort((a,b)=>a.key.localeCompare(b.key));return [...(combination&&unique.length>1?[{key:'combination:'+unique.map(x=>x.key+'|'+x.hash).join(','),kind:'combination',refs:unique.map(ref),title:unlinked.length?'연결된 '+unique.length+'개 약물 간 상호작용 · '+unlinked.length+'개 미포함':'이번 처방의 약물 간 상호작용',excluded:[...unlinked]}]:[]),...unique.map(m=>({key:'monograph:'+m.key+'|'+m.hash,kind:'monograph',refs:[ref(m)],title:m.title}))];}
 function mount(host,o){
  const root=document.createElement('section');root.className='pt-ko-safety';root.setAttribute('aria-label','한국어 안전성 요약');host.append(root);
  root.innerHTML='<div class="pt-heading"><h4>한국어 핵심 요약</h4><div class="pt-bar"><button type="button" data-ko-generate hidden>한국어 요약 준비</button><button type="button" data-ko-combination>이번 처방 조합 추가 검토</button><button type="button" data-ko-refresh>저장 요약 다시 확인</button></div></div><p class="pt-help">저장된 요약은 자동 표시됩니다. 약물 DB는 병원 내부에 재사용합니다. 처방 조합 추가 검토는 선택 사항입니다. 새 생성에는 연결된 AI 사용료가 발생할 수 있습니다.</p><p data-ko-status role="status" aria-live="polite"></p><p data-ko-coverage class="pt-help"></p><nav class="pt-bar" data-ko-overview aria-label="약물별 요약 준비 상태"></nav><div data-ko-items></div>';
  const list=root.querySelector('[data-ko-items]'),status=root.querySelector('[data-ko-status]'),button=root.querySelector('[data-ko-generate]'),refresh=root.querySelector('[data-ko-refresh]');
  let currentMetas=[],includeCombination=false,disposed=false,epoch=0,signature='',specs=[],unlinked=[],busy=false,looking=false,progress='',batchNotice='';const results=new Map();
  const alive=token=>!disposed&&host.isConnected&&(!o.guard||o.guard())&&(token===undefined||token===epoch);
  const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  function finding(item,sources){
   const box=element('li',undefined,'pt-ko-finding'),title=element('p');title.append(element('strong',levels[item.level]+' · '));title.append(document.createTextNode(item.text));box.append(title);
   box.append(element('p',(item.species||[]).map(s=>species[s]||s).join('·')+' · '+item.conditions,'pt-help'));
   const evidence=element('details'),summary=element('summary','근거 보기');evidence.append(summary);
   for(const e of item.evidence||[]){const source=sources.find(s=>s.key===e.drugKey);evidence.append(element('p',(source?.libraryTitle||'등록 자료')+' · '+(source?.title||'')+' · 책 '+(source?.printedPage||'미확인')+'쪽 / PDF '+(source?.page||'미확인')+'쪽 · '+e.heading,'pt-help'),element('blockquote',e.quote));}
   box.append(evidence);return box;
  }
  function documentView(spec,result){
   const doc=result.summary,card=element('article',undefined,'pt-ko-card');card.dataset.koKind=spec.kind;card.dataset.koState='ready';card.append(element('h5',spec.title));
   card.append(element('p',doc.reviewedAt?'의료진 원문 대조 확인 · '+doc.reviewedAt.slice(0,10):'AI 한국어 요약 초안 · 의료진 원문 대조 필요','pt-ko-badge'));
   if(result.sources.some(s=>s.errata)){const p=element('p','공식 정오표 수정 대상이 포함되어 있습니다. 등록 원문과 최신 정오표를 함께 확인하세요. ','pt-error'),a=element('a','공식 정오표');a.href='https://plumbs.com/handbook-errata-10th-edition/';a.target='_blank';a.rel='noopener noreferrer';p.append(a);card.append(p);}
   if(spec.kind==='combination'){
    if(spec.excluded?.length)card.append(element('p','부분 검토 · '+spec.excluded.join(', ')+'은(는) 원문이 연결되지 않아 이 결과에서 제외됐습니다.','pt-error'));
    card.append(element('p','처방에 함께 포함된 약물의 참고사항입니다. 실제 투여 시점·휴약 간격·용량·환자 상태는 대조하지 않습니다.','pt-help'));
    if(!doc.items.length)card.append(element('p','등록 근거에서 확인된 병용 항목이 없습니다. 상호작용이 없거나 안전하다는 뜻은 아닙니다.'));
    const ul=element('ul');doc.items.forEach(item=>{const li=finding(item,result.sources);li.prepend(element('strong',item.drugKeys.map(k=>result.sources.find(s=>s.key===k)?.title||'미확인').join(' + ')));ul.append(li);});card.append(ul);
   }else{
    for(const category of ['interaction','liver','kidney','other','monitoring']){const values=doc.items.filter(x=>x.category===category),part=element(category==='other'||category==='monitoring'?'details':'section');if(part.tagName==='DETAILS'&&values.some(x=>['contraindication','avoid'].includes(x.level)))part.open=true;part.append(element(part.tagName==='DETAILS'?'summary':'h6',labels[category]+(values.length?' · '+values.length+'건':'')));
     if(!values.length)part.append(element('p','요약에서 확인된 항목 없음 · 위험이 없다는 뜻은 아닙니다.','pt-help'));
     else {if(category==='interaction')part.append(element('p','이 약물 원문의 병용 참고사항입니다. 현재 처방에 해당하는지는 약물명·계열·조건을 확인하세요.','pt-help'));const ul=element('ul');values.forEach(x=>ul.append(finding(x,result.sources)));part.append(ul);}card.append(part);}
   }
   if(doc.gaps.length){const details=element('details'),ul=element('ul');details.append(element('summary','누락·불확실한 정보 '+doc.gaps.length+'건'));doc.gaps.forEach(x=>ul.append(element('li',x)));details.append(ul);card.append(details);}
   const sources=element('details');sources.append(element('summary','출처·생성 정보'));for(const s of result.sources)sources.append(element('p',s.libraryTitle+' · '+s.title+' · 책 '+s.printedPage+'쪽 / PDF '+s.page+'–'+s.endPage+'쪽 · 원문 등록 확인 '+s.checkedAt));sources.append(element('p','요약 생성 '+doc.generatedAt+' · '+doc.model));card.append(sources);
   if(result.canManage&&!doc.reviewedAt){const details=element('details');details.append(element('summary','의료진 원문 대조 확인'));const label=element('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(' 근거 원문·적용 종·경로·조건과 정오표를 대조했습니다.'));const approve=element('button','대조 확인 저장');approve.type='button';approve.disabled=true;check.onchange=()=>approve.disabled=!check.checked;const message=element('p');message.setAttribute('role','status');approve.onclick=async()=>{if(!check.checked||busy)return;const token=epoch;approve.disabled=true;try{const r=await call(spec,'review',{digest:result.digest,confirm:true});if(!alive(token))return;results.set(spec.key,r);draw();}catch(e){if(alive(token)){message.textContent=e.message||'저장 실패';approve.disabled=false;}}};details.append(label,approve,message);card.append(details);}
   return card;
  }
  const needsGeneration=r=>r?.canManage&&['missing','error'].includes(r.state);
  function draw(){if(!alive())return;list.replaceChildren();let missing=0,ready=0,fail=0;
   for(const spec of specs){const r=results.get(spec.key);if(r?.state==='ready'){ready++;list.append(documentView(spec,r));continue;}
    const card=element('article',undefined,'pt-ko-card');card.dataset.koState=r?.state||'loading';card.dataset.koKind=spec.kind;card.append(element('h5',spec.title));
    if(!r)card.append(element('p','저장된 한국어 요약 확인 중…'));
    else if(r.state==='missing')card.append(element('p',r.canManage?'요약 준비가 필요합니다. 위 버튼으로 남은 항목을 한 번에 준비할 수 있습니다.':'저장된 한국어 요약이 없습니다. 의료진이 먼저 준비할 수 있습니다.'));
    else if(r.state==='pending')card.append(element('p','다른 요청에서 생성 중입니다. 잠시 후 저장 요약 다시 확인을 눌러주세요.'));
    else{fail++;card.append(element('p',r.error||'한국어 요약을 확인하지 못했습니다.','pt-error'));}
    if(needsGeneration(r)){missing++;const one=element('button',r.state==='error'?'이 항목 다시 준비':'이 항목만 준비');one.type='button';one.dataset.koOne=spec.key;one.disabled=busy||looking;one.onclick=()=>void generate([spec]);card.append(one);}list.append(card);
   }
   for(const name of unlinked){const card=element('article',undefined,'pt-ko-card');card.dataset.koState='unlinked';card.append(element('h5',name),element('p','성분·원문 연결 필요 · 이 약물의 요약과 다른 약물과의 상호작용은 아직 확인하지 못했습니다.','pt-error'));const link=element('button','이 약물 원문 연결');link.type='button';link.onclick=()=>o.onConnect?.(name);card.append(link);list.append(card);}
   const overview=root.querySelector('[data-ko-overview]');overview.replaceChildren();for(const card of list.children){if(card.dataset.koKind==='combination')continue;const state={ready:'완료',missing:'준비 필요',error:'다시 확인',pending:'생성 중',loading:'확인 중',unlinked:'원문 연결 필요'}[card.dataset.koState],jump=element('button',card.querySelector('h5').textContent+' · '+state);jump.type='button';jump.onclick=()=>{card.scrollIntoView({block:'center',behavior:'smooth'});card.tabIndex=-1;card.focus({preventScroll:true});};overview.append(jump);}
   root.querySelector('[data-ko-combination]').hidden=currentMetas.length<2||includeCombination;root.querySelector('[data-ko-combination]').disabled=busy||looking;button.hidden=!missing&&!looking;button.disabled=busy||looking;button.textContent=looking?'전체 약물 확인 중…':busy?'한국어 요약 준비 중…':'한국어 요약 준비 · '+missing+'건';refresh.disabled=busy||looking;
   status.textContent=(busy?progress:looking?'전체 약물의 저장 요약을 확인하는 중입니다.':specs.length?'저장 요약 '+ready+'/'+specs.length+'건'+(fail?' · 확인 실패 '+fail+'건':''):'연결된 원문 항목이 없습니다.')+(batchNotice?' · '+batchNotice:'');
   root.querySelector('[data-ko-coverage]').textContent=unlinked.length?'미연결 약물: '+unlinked.join(', ')+' · 연결된 약물끼리만 검토하며, 미연결 약물과의 상호작용은 포함하지 않습니다.':'약물 자체의 참고 정보이며, 환자의 장기 질환 유무나 처방의 전체 안전성을 판정하지 않습니다.';
  }
  const call=(spec,action,extra={})=>o.request('/practice/reference-safety-summary',{method:'POST',body:JSON.stringify({action,kind:spec.kind,refs:spec.refs,...extra})});
  async function look(token){looking=true;draw();let next=0;const work=specs.filter(x=>!results.has(x.key));await Promise.all(Array.from({length:Math.min(3,work.length)},async()=>{while(next<work.length&&alive(token)){const spec=work[next++];try{const r=await call(spec,'lookup');if(!alive(token))return;results.set(spec.key,r);}catch(e){if(!alive(token))return;results.set(spec.key,{state:'error',error:e.message});}draw();}}));if(alive(token)){looking=false;draw();}}
  async function generate(selection){if(busy||looking)return;const token=epoch,work=selection.filter(x=>needsGeneration(results.get(x.key)));busy=true;batchNotice='';let done=0;
   // Translate individual drugs before the combination; an item-specific failure must not suppress the other drugs.
   work.sort((a,b)=>(a.kind==='combination')-(b.kind==='combination'));
   for(const spec of work){if(!alive(token))break;progress='요약 준비 '+(++done)+'/'+work.length+' · '+spec.title;draw();try{const r=await call(spec,'generate');if(!alive(token))break;results.set(spec.key,r);}catch(e){if(!alive(token))break;results.set(spec.key,{state:'error',error:e.message,canManage:true});
     const itemOnly=[413,422].includes(e.status)||e.status===502&&/요약의 한국어|한국어 요약 형식|한국어 요약이 완료/.test(e.message||'');
     if(!itemOnly){batchNotice='요청이 중단됐습니다. 저장된 요약은 유지되며 남은 항목은 다시 준비할 수 있습니다.';break;}
    }draw();}
   if(alive(token)){busy=false;progress='';draw();}
  }
  root.querySelector('[data-ko-combination]').onclick=()=>{if(busy||looking)return;includeCombination=true;specs=plans(currentMetas,unlinked,true);epoch++;void look(epoch);};
  button.onclick=()=>void generate(specs);
  refresh.onclick=()=>{if(busy||looking)return;results.clear();epoch++;batchNotice='';void look(epoch);};
  return {update(metas,missing){const next=plans(metas,missing),sig=JSON.stringify([next.map(x=>x.key),missing]);if(sig===signature)return;currentMetas=metas;includeCombination=false;signature=sig;epoch++;busy=false;looking=false;progress='';batchNotice='';specs=next;unlinked=[...new Set(missing)];void look(epoch);},dispose(){disposed=true;epoch++;results.clear();root.remove();}};
 }
 const api={plans,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticePrescriptionSummary=api;
})(typeof window==='undefined'?globalThis:window);
