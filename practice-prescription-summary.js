/* Korean safety drafts. Private responses stay in memory; generation is an explicit one-time action. */
(function(g){
 'use strict';
 const labels={interaction:'처방 약물 간 병용 주의',liver:'간',kidney:'신장',other:'기타 금기·주의',monitoring:'모니터링'};
 const levels={contraindication:'금기',avoid:'병용·사용 회피',caution:'주의',monitor:'관찰·검사',info:'참고'};
 const species={dog:'개',cat:'고양이',other:'기타 동물',unspecified:'종 특정 없음'};
 const ref=m=>({libraryId:m.libraryId,entryId:m.id});
 function plans(metas,unlinked){const unique=[...new Map(metas.map(m=>[m.key,m])).values()].sort((a,b)=>a.key.localeCompare(b.key));return [...(unique.length>1&&!unlinked.length?[{key:'combination:'+unique.map(x=>x.key+'|'+x.hash).join(','),kind:'combination',refs:unique.map(ref),title:'이번 처방의 약물 간 상호작용'}]:[]),...unique.map(m=>({key:'drug:'+m.key+'|'+m.hash,kind:'drug',refs:[ref(m)],title:m.title}))];}
 function mount(host,o){
  const root=document.createElement('section');root.className='pt-ko-safety';root.setAttribute('aria-label','한국어 안전성 요약');host.append(root);
  root.innerHTML='<div class="pt-heading"><h4>한국어 핵심 요약</h4><div class="pt-bar"><button type="button" data-ko-generate hidden>한국어 요약 준비</button><button type="button" data-ko-refresh>저장 요약 다시 확인</button></div></div><p class="pt-help">저장된 요약은 자동 표시됩니다. 처음 사용하는 약물·처방 조합만 AI로 생성해 병원 내부에 재사용합니다. 새 생성에는 연결된 AI 사용료가 발생할 수 있습니다.</p><p data-ko-status role="status" aria-live="polite"></p><p data-ko-coverage class="pt-help"></p><div data-ko-items></div>';
  const list=root.querySelector('[data-ko-items]'),status=root.querySelector('[data-ko-status]'),button=root.querySelector('[data-ko-generate]'),refresh=root.querySelector('[data-ko-refresh]');
  let disposed=false,epoch=0,signature='',specs=[],unlinked=[],busy=false;const results=new Map();
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
   const doc=result.summary,card=element('article',undefined,'pt-ko-card');card.dataset.koKind=spec.kind;card.append(element('h5',spec.title));
   card.append(element('p',doc.reviewedAt?'의료진 원문 대조 확인 · '+doc.reviewedAt.slice(0,10):'AI 한국어 요약 초안 · 의료진 원문 대조 필요','pt-ko-badge'));
   if(result.sources.some(s=>s.errata)){const p=element('p','공식 정오표 수정 대상이 포함되어 있습니다. 등록 원문과 최신 정오표를 함께 확인하세요. ','pt-error'),a=element('a','공식 정오표');a.href='https://plumbs.com/handbook-errata-10th-edition/';a.target='_blank';a.rel='noopener noreferrer';p.append(a);card.append(p);}
   if(spec.kind==='combination'){
    card.append(element('p','처방에 함께 포함된 약물의 참고사항입니다. 실제 투여 시점·휴약 간격·용량·환자 상태는 대조하지 않습니다.','pt-help'));
    if(!doc.items.length)card.append(element('p','등록 근거에서 확인된 병용 항목이 없습니다. 상호작용이 없거나 안전하다는 뜻은 아닙니다.'));
    const ul=element('ul');doc.items.forEach(item=>{const li=finding(item,result.sources);li.prepend(element('strong',item.drugKeys.map(k=>result.sources.find(s=>s.key===k)?.title||'미확인').join(' + ')));ul.append(li);});card.append(ul);
   }else{
    for(const category of ['liver','kidney','other','monitoring']){const values=doc.items.filter(x=>x.category===category),part=element(category==='other'||category==='monitoring'?'details':'section');if(part.tagName==='DETAILS'&&values.some(x=>['contraindication','avoid'].includes(x.level)))part.open=true;part.append(element(part.tagName==='DETAILS'?'summary':'h6',labels[category]+(values.length?' · '+values.length+'건':'')));
     if(!values.length)part.append(element('p','요약에서 확인된 항목 없음 · 위험이 없다는 뜻은 아닙니다.','pt-help'));
     else {const ul=element('ul');values.forEach(x=>ul.append(finding(x,result.sources)));part.append(ul);}card.append(part);}
   }
   if(doc.gaps.length){const details=element('details'),ul=element('ul');details.append(element('summary','누락·불확실한 정보 '+doc.gaps.length+'건'));doc.gaps.forEach(x=>ul.append(element('li',x)));details.append(ul);card.append(details);}
   const sources=element('details');sources.append(element('summary','출처·생성 정보'));for(const s of result.sources)sources.append(element('p',s.libraryTitle+' · '+s.title+' · 책 '+s.printedPage+'쪽 / PDF '+s.page+'–'+s.endPage+'쪽 · 원문 등록 확인 '+s.checkedAt));sources.append(element('p','요약 생성 '+doc.generatedAt+' · '+doc.model));card.append(sources);
   if(result.canManage&&!doc.reviewedAt){const details=element('details');details.append(element('summary','의료진 원문 대조 확인'));const label=element('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(' 근거 원문·적용 종·경로·조건과 정오표를 대조했습니다.'));const approve=element('button','대조 확인 저장');approve.type='button';approve.disabled=true;check.onchange=()=>approve.disabled=!check.checked;const message=element('p');message.setAttribute('role','status');approve.onclick=async()=>{if(!check.checked||busy)return;const token=epoch;approve.disabled=true;try{const r=await call(spec,'review',{digest:result.digest,confirm:true});if(!alive(token))return;results.set(spec.key,r);draw();}catch(e){if(alive(token)){message.textContent=e.message||'저장 실패';approve.disabled=false;}}};details.append(label,approve,message);card.append(details);}
   return card;
  }
  function draw(){if(!alive())return;list.replaceChildren();let missing=0,ready=0,fail=0;
   for(const spec of specs){const r=results.get(spec.key);if(r?.state==='ready'){ready++;list.append(documentView(spec,r));continue;}
    const card=element('article',undefined,'pt-ko-card');card.append(element('h5',spec.title));
    if(!r)card.append(element('p','저장된 한국어 요약 확인 중…'));
    else if(r.state==='missing'){if(r.canManage)missing++;card.append(element('p',r.canManage?'아직 준비되지 않았습니다. 위의 한국어 요약 준비를 누르면 생성·저장합니다.':'저장된 한국어 요약이 없습니다. 의료진이 먼저 준비할 수 있습니다.'));}
    else if(r.state==='pending')card.append(element('p','다른 요청에서 생성 중입니다. 잠시 후 저장 요약 다시 확인을 눌러주세요.'));
    else{fail++;card.append(element('p',r.error||'한국어 요약을 확인하지 못했습니다.','pt-error'));}list.append(card);
   }
   button.hidden=!missing;button.disabled=busy;button.textContent=busy?'한국어 요약 준비 중…':'한국어 요약 준비 · '+missing+'건';refresh.disabled=busy;
   status.textContent=busy?'필요한 항목만 순서대로 생성·저장 중입니다. 계산 결과는 계속 사용할 수 있습니다.':specs.length?'저장 요약 '+ready+'/'+specs.length+'건'+(fail?' · 확인 실패 '+fail+'건':''):'약물 원문을 연결하면 한국어 요약을 확인할 수 있습니다.';
   root.querySelector('[data-ko-coverage]').textContent=unlinked.length?'미연결 약물: '+unlinked.join(', ')+' · 이 약물을 연결하기 전에는 처방 전체 병용 요약을 생성하지 않습니다.':'약물 자체의 참고 정보이며, 환자의 장기 질환 유무나 처방의 전체 안전성을 판정하지 않습니다.';
  }
  const call=(spec,action,extra={})=>o.request('/practice/reference-safety-summary',{method:'POST',body:JSON.stringify({action,kind:spec.kind,refs:spec.refs,...extra})});
  async function look(token){let next=0;const work=specs.filter(x=>!results.has(x.key));await Promise.all(Array.from({length:Math.min(3,work.length)},async()=>{while(next<work.length&&alive(token)){const spec=work[next++];try{const r=await call(spec,'lookup');if(!alive(token))return;results.set(spec.key,r);}catch(e){if(!alive(token))return;results.set(spec.key,{state:'error',error:e.message});}draw();}}));}
  button.onclick=async()=>{if(busy)return;const token=epoch,work=specs.filter(x=>results.get(x.key)?.state==='missing'&&results.get(x.key)?.canManage);busy=true;draw();
   for(const spec of work){if(!alive(token))break;try{const r=await call(spec,'generate');if(!alive(token))break;results.set(spec.key,r);}catch(e){if(!alive(token))break;results.set(spec.key,{state:'error',error:e.message});draw();break;}draw();}
   if(alive(token)){busy=false;draw();}
  };
  refresh.onclick=()=>{if(busy)return;results.clear();epoch++;draw();void look(epoch);};
  return {update(metas,missing){const next=plans(metas,missing),sig=JSON.stringify([next.map(x=>x.key),missing]);if(sig===signature)return;signature=sig;epoch++;busy=false;specs=next;unlinked=missing;draw();void look(epoch);},dispose(){disposed=true;epoch++;results.clear();root.remove();}};
 }
 const api={plans,mount};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticePrescriptionSummary=api;
})(typeof window==='undefined'?globalThis:window);
