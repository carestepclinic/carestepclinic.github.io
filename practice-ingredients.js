/* Ingredient discovery and explicit clinic defaults. Formulations remain separate facts. */
(function(g){
 'use strict';
 const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const units={tablet:'정',capsule:'캡슐',liquid:'mL'},releaseNames={standard:'일반형',extended:'서방형',enteric:'장용형'};
 let catalog=null,promise=null;const families=new Map(),aliasIndex=new Map(),idIndex=new Map();
 const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
 function baseName(s){return String(s||'').replace(/\s+(?:Granules\s+Micronized|Micronized|Pellets)$/i,'').replace(/^(?:Ciclosporin|Cyclosporin)$/i,'Cyclosporine');}
 function addAlias(s,f){const k=key(s);if(!k)return;if(!aliasIndex.has(k))aliasIndex.set(k,new Set());aliasIndex.get(k).add(f);}
 async function configure(doc){
  if(!Array.isArray(doc?.ingredients))throw Error('성분 목록 형식을 확인해주세요.');families.clear();aliasIndex.clear();idIndex.clear();
  for(const entry of doc.ingredients){const english=entry.setupMode==='product'?entry.english:baseName(entry.english||entry.name),k=key(english);if(!k)continue;
   if(!families.has(k))families.set(k,{key:k,english,name:entry.name,entries:[],aliases:new Set(),complex:entry.setupMode==='product'});
   const f=families.get(k);f.entries.push(entry);idIndex.set(entry.id,f);if(key(entry.english)===k)f.name=entry.name;
   for(const name of [entry.name,entry.english,...(entry.aliases||[]),...(g.PracticeStrengths?.aliases(entry)||[])]){f.aliases.add(name);addAlias(name,f);}addAlias(english,f);
  }
  for(const [target,names] of [['ursodeoxycholicacid',['UDCA','ursodiol']],['prednisolone',['pds']],['cyclosporine',['ciclosporin','cyclosporin']]]){const f=families.get(target);if(f)for(const n of names){f.aliases.add(n);addAlias(n,f);}}
  await Promise.all([...families.values()].map(async f=>{f.preferredId='manual-'+await hash('carestep-prescription-default-v1|'+f.key);idIndex.set(f.preferredId,f);}));catalog=doc;return doc;
 }
 async function load(){if(catalog)return catalog;if(!promise)promise=(g.PracticeStrengths?.catalog?g.PracticeStrengths.catalog():fetch('practice-strength-catalog.json?v=20261031-potassium1',{credentials:'omit',cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('성분 목록을 불러오지 못했습니다.');return r.json();})).then(configure).catch(e=>{promise=null;throw e;});return promise;}
 function resolve(name){const set=aliasIndex.get(key(name));return set?.size===1?[...set][0]:null;}
 function metadata(p){return p.body?.formulary||p.body?.strength;}
 function familyOf(p){const m=metadata(p);if(!m)return null;const byId=idIndex.get(m.ingredientId);if(byId)return byId;const refs=new Set([m.english,m.calculationBasis,...(m.aliases||[])].map(resolve).filter(Boolean));return refs.size===1?[...refs][0]:null;}
 function named(p,drug){const m=metadata(p);if((m?.ingredientId==='manual-0793ad74243cf94ae589'||['citratepotassium','potassiumcitrate','구연산칼륨'].includes(key(m?.english)))&&['potassium','칼륨','citrate','구연산','elementalpotassium'].includes(key(drug)))return false;return [p.body?.title,...(metadata(p)?.aliases||[])].some(x=>key(x)===key(drug));}
 function matching(items,drug){const f=resolve(drug);return items.filter(p=>named(p,drug)||(f&&familyOf(p)===f));}
 function preferred(p,f){return !!f&&p.body?.strength?.ingredientId===f.preferredId;}
 function candidates(items,drug,species,route,doseUnit){
  const f=resolve(drug),all=matching(items,drug).filter(p=>{const b=p.body,m=metadata(p);return m?.version===1&&m.route===route&&m.species?.includes(species)&&m.calculatorReady!==false&&!p.formularyIssue&&['tablet','capsule','liquid'].includes(b.kind)&&['mg','mcg','T'].includes(b.unit)&&(!doseUnit||(doseUnit==='T')===(b.unit==='T'));});
  const favorites=all.filter(p=>preferred(p,f));if(favorites.length){const specific=favorites.filter(p=>metadata(p).species.length===1);return specific.length?specific:favorites;}
  const exact=all.filter(p=>named(p,drug));const original=exact.filter(p=>!p.body.strength);if(original.length)return original;
  if(exact.length)return exact;
  // Broad discovery must not silently pick a micronized/modified formulation.
  return all.map(p=>({...p,ingredientChoiceRequired:true}));
 }
 function title(drug){const f=resolve(drug);return f?f.name+' · '+f.english:drug;}
 function hint(items,drug,species,route='oral',unit){const all=matching(items,drug);if(!resolve(drug)&&!all.length)return '성분 확인 필요 · 성분명을 확인하거나 사용할 함량을 직접 입력해주세요.';if(all.length&&!all.some(p=>metadata(p)?.route===route))return (route==='oral'?'경구':'주사')+' 함량 미설정 · 이 경로에 사용할 함량을 선택해주세요.';if(all.length&&!all.some(p=>metadata(p)?.route===route&&metadata(p)?.species?.includes(species)))return '적용 동물 확인 필요 · 현재 동물에 사용할 함량을 선택해주세요.';if(unit==='T'&&all.length&&!all.some(p=>p.body.unit==='T'))return '정·캡슐 개수 기준을 확인해주세요. mg 함량과 자동 환산하지 않습니다.';return '함량 선택 필요 · 병원 기본 함량을 선택하거나 직접 입력해주세요.';}
 function optionLabel(v){return v.value+' '+v.unit+'/'+units[v.kind]+' · '+(v.variant||releaseNames[v.release]||'제형 확인')+(v.saved?' · 병원 저장값':' · 공통 후보');}
 function choices(items,drug,species,unit){
  const f=resolve(drug),options=[];
  for(const p of matching(items,drug)){const b=p.body,m=metadata(p);if(m?.route!=='oral'||!m.species?.includes(species)||m.calculatorReady===false||p.formularyIssue||!['tablet','capsule','liquid'].includes(b.kind)||(unit==='T')!==(b.unit==='T'))continue;options.push({id:'saved:'+p.id,preset:p,value:b.value,unit:b.unit,kind:b.kind,release:p.body.strength?.release||'standard',variant:m.calculationBasis||b.title,saved:true});}
  if(f&&!f.complex&&unit!=='T')for(const entry of f.entries)for(const v of entry.options||[])if(v.route==='oral'&&['mg','mcg'].includes(v.unit))options.push({...v,id:'catalog:'+entry.id+':'+v.id,entry,variant:entry.english+' · '+releaseNames[v.release],sourceUrl:v.sources?.[0]?.url||'',checkedAt:catalog.checkedAt});
  const seen=new Set();return options.filter(v=>{const k=JSON.stringify([v.value,v.unit,v.kind,v.release,v.variant,v.saved]);if(seen.has(k))return false;seen.add(k);return true;});
 }
 async function defaultBody(items,drug,value,species){
  const f=resolve(drug);if(!f)throw Error('병원 기본값으로 저장할 성분을 먼저 확인해주세요.');
  if(f.complex||value.unit==='T')throw Error('복합제·개수 기준은 제품별 계산 기준을 확인해 약품 관리에서 저장해주세요.');
  const animals=[...new Set(species)].sort(),prior=items.find(p=>preferred(p,f)&&metadata(p).route==='oral'&&JSON.stringify(metadata(p).species.slice().sort())===JSON.stringify(animals));
  return {ingredientId:f.preferredId,name:f.name,english:f.english,basis:value.basis||f.name,aliases:[...new Set([f.english,f.name,...f.aliases])].filter(Boolean).slice(0,12),species:animals,kind:value.kind,value:Number(value.value),unit:value.unit,route:'oral',release:value.release||'standard',sourceUrl:value.sourceUrl||'',checkedAt:value.sourceUrl?value.checkedAt||'':'',revision:prior?.revision,confirm:true};
 }
 function mountCard(box,ctx){
  const row=ctx.row,f=resolve(row.drug),opts=choices(ctx.items,row.drug,ctx.species,row.doseUnit),selected=row.presetId?'saved:'+row.presetId:row.ingredientOption||'',pending=!row.product||!row.strength;
  box.className='pt-rx-inline-strength';box.replaceChildren();
  const current=document.createElement('p');current.className='pt-help';current.textContent=row.strength?(row.inlineScope==='default'?'병원 기본값 적용':row.autoProduct?'병원 저장 함량으로 자동 연결':'이번 처방에만 적용'):'사용할 함량을 선택하면 이 약물의 계산이 이어집니다.';box.append(current);
  const editor=document.createElement('details');editor.open=pending;editor.innerHTML='<summary class="pt-summary">'+(pending?'함량·제형 확인':'함량·제형 변경')+'</summary><label>사용 함량<select data-ingredient-choice aria-label="'+esc(row.drug)+' 사용 함량"><option value="">선택해주세요</option>'+opts.map(v=>'<option value="'+esc(v.id)+'" '+(selected===v.id?'selected':'')+'>'+esc(optionLabel(v))+'</option>').join('')+'<option value="manual">함량 직접 입력</option></select></label><div data-ingredient-manual hidden><div class="pt-rx-fields"><label>제형<select data-ingredient-kind><option value="tablet">정제 · 1정당</option><option value="capsule">캡슐 · 1캡슐당</option><option value="liquid">액상 · 1mL당</option></select></label><label>함량<input data-ingredient-value inputmode="decimal"></label><label>단위<select data-ingredient-unit>'+(row.doseUnit==='T'?'<option value="T">개수(T)</option>':'<option value="mg">mg</option><option value="mcg">mcg</option>')+'</select></label><label>제형 특성<select data-ingredient-release><option value="standard">일반형</option><option value="extended">서방형</option><option value="enteric">장용형</option></select></label></div><label>계산 기준·제형 메모<input data-ingredient-basis maxlength="512" placeholder="성분 기준·미분화 등 제형 특성"></label></div><p class="pt-help" data-ingredient-note>경구용 함량입니다. 제형·방출 특성과 실제 제품 함량을 확인해주세요.</p>'+ (ctx.phaseCount>1?'<label>적용 단계<select data-ingredient-scope><option value="all">이 약물의 전체 '+ctx.phaseCount+'단계</option><option value="one">현재 '+row.phaseIndex+'단계만</option></select></label>':'')+'<label class="pt-choice"><input type="checkbox" data-ingredient-confirm>선택한 함량·제형·계산 기준을 확인했습니다.</label><div class="pt-bar"><button type="button" data-ingredient-apply disabled>이번 처방에 적용</button>'+(ctx.canManage&&f&&!f.complex&&row.doseUnit!=='T'?'<button type="button" data-ingredient-save disabled>병원 기본값으로 저장·적용</button>':'')+'<button type="button" data-ingredient-cancel>변경 취소</button></div>'+(ctx.canManage&&f&&!f.complex&&row.doseUnit!=='T'?'<label>기본값 저장 대상<select data-ingredient-species><option value="'+ctx.species+'">'+(ctx.species==='cat'?'고양이':'개')+'</option><option value="both">개·고양이 공통</option></select></label><p class="pt-help">저장 버튼을 누를 때만 다음 처방에도 적용됩니다. 기존 제품 기록은 유지합니다.</p>':'')+'<p data-ingredient-status role="status"></p>';
  box.append(editor);const el=n=>editor.querySelector('[data-ingredient-'+n+']'),report=t=>el('status').textContent=t;let busy=false;
  for(const [name,v] of [['kind',row.form||'tablet'],['value',row.strength||''],['unit',row.strengthUnit||'mg'],['release',row.release||'standard'],['basis',row.calculationBasis||f?.name||row.drug]])el(name).value=v;
  if(!selected&&row.strength){el('choice').value='manual';el('manual').hidden=false;}
  function stage(){if(busy)return;el('confirm').checked=false;el('apply').disabled=true;if(el('save'))el('save').disabled=true;report('');ctx.invalidate();}
  el('choice').onchange=()=>{stage();el('manual').hidden=el('choice').value!=='manual';const v=opts.find(v=>v.id===el('choice').value);el('note').textContent=v?'선택: '+optionLabel(v)+' · 실제 제품 표시와 확인해주세요.':el('note').textContent;};
  for(const input of editor.querySelectorAll('[data-ingredient-manual] input,[data-ingredient-manual] select,[data-ingredient-scope],[data-ingredient-species]'))input.addEventListener('input',stage);
  el('confirm').onchange=()=>{el('apply').disabled=busy||!el('confirm').checked;if(el('save'))el('save').disabled=busy||!el('confirm').checked;};
  function read(){const choice=el('choice').value,v=opts.find(v=>v.id===choice);if(v)return {...v,basis:v.preset?metadata(v.preset).calculationBasis:v.entry.name+' · '+v.entry.english};if(choice!=='manual')throw Error('함량을 선택해주세요.');const value=Number(el('value').value),kind=el('kind').value,unit=el('unit').value,release=el('release').value,basis=el('basis').value.trim();if(!Number.isFinite(value)||value<=0||value>1e6||!basis||unit==='T'&&(value!==1||kind==='liquid')||kind==='liquid'&&release!=='standard')throw Error('제형·함량·단위·계산 기준을 확인해주세요. 액상은 1mL당 값으로 입력합니다.');return {id:'manual',kind,value,unit,release,basis,variant:basis};}
  async function apply(save){if(busy||!el('confirm').checked||!ctx.alive())return;let v;try{v=read();}catch(e){report(e.message);return;}busy=true;for(const x of editor.querySelectorAll('input,select,button'))x.disabled=true;report(save?'병원 기본값 저장 중…':'계산에 적용 중…');try{await ctx.apply(v,{save,scope:el('scope')?.value||'one',species:el('species')?.value==='both'?['dog','cat']:[ctx.species]});}catch(e){if(ctx.alive()){report(e.message);for(const x of editor.querySelectorAll('input,select,button'))x.disabled=false;el('confirm').checked=false;el('apply').disabled=true;if(el('save'))el('save').disabled=true;}}finally{busy=false;}}
  el('cancel').onclick=()=>{if(!busy&&ctx.alive())ctx.cancel();};el('apply').onclick=()=>void apply(false);if(el('save'))el('save').onclick=()=>void apply(true);
 }
 g.PracticeIngredients={load,configure,resolve,familyOf,matching,candidates,title,hint,choices,preferred,defaultBody,mountCard,key};
})(window);
