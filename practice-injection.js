(function(g){
 'use strict';
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,''),aliases={cefazoline:'cefazolin',세파졸린:'cefazolin',부토르파놀:'butorphanol',부토파놀:'butorphanol',파모티딘:'famotidine',타우린:'taurine',카프로펜:'carprofen',케타민:'ketamine',메데토미딘:'medetomidine'};
 const key=s=>aliases[norm(s)]||norm(s),number=s=>{const p=s.split('/').map(Number);return p.length===2?p[0]/p[1]:p[0];};
 function parseLine(raw){const m=raw.match(/^(.+?)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?|\.\d+)\s*(mg|mcg|ug|μg|µg|ml|iu|meq)(?:\s*\/\s*(kg|head|cat|dog))?\s+(iv|im|sc|sq)\s*$/i);if(!m)return {raw,error:'약물명 · 용량 · 단위 · 경로를 확인하세요. 예: famotidine 0.5 mg/kg IV'};const dose=number(m[2].replace(/\s/g,'')),unit=({mg:'mg',mcg:'mcg',ug:'mcg','μg':'mcg','µg':'mcg',ml:'mL',iu:'IU',meq:'mEq'})[m[3].toLowerCase()],basis=(m[4]||'').toLowerCase(),drug=m[1].trim();if(!(dose>0)||!Number.isFinite(dose)||/[\d<>≤≥=]/.test(drug)||unit!=='mL'&&!basis||unit==='mL'&&basis==='kg')return {raw,error:'용량 기준을 확인하세요. 질량은 /kg 또는 /head, 부피는 1회 mL로 입력합니다.'};return {raw,drug,dose,unit,basis:basis==='kg'?'kg':'total',species:['cat','dog'].includes(basis)?basis:'',route:m[5].toUpperCase()==='SQ'?'SC':m[5].toUpperCase()};}
 function parse(text){
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>30)throw Error('처방을 1~30줄 입력해주세요.');
  const result=lines.flatMap(raw=>{
   const parts=raw.split(/\s*[+＋]\s*/);if(parts.length===1)return [parseLine(raw)];
   const routes=parts.map(p=>p.match(/\s+(IV|IM|SC|SQ)\s*$/i)?.[1].toUpperCase().replace('SQ','SC'));
   const shared=routes.at(-1),consistent=shared&&routes.filter(Boolean).every(r=>r===shared);
   const rows=parts.map((part,i)=>parseLine(!routes[i]&&consistent?part+' '+shared:part));
   if(rows.some(r=>r.error))return [{raw,error:'병용 처방의 각 약물명·용량·단위·경로를 확인하세요. 같은 경로는 맨 끝에 한 번 입력할 수 있습니다.'}];
   return rows.map((r,i)=>({...r,sourceRaw:raw,sharedRoute:!routes[i]?shared:''}));
  });
  if(result.length>30)throw Error('한 번에 약물 30개까지 입력해주세요.');return result;
 }
 function candidates(row,products,species){const matches=(products||[]).filter(p=>{const v=p.body||{},m=v.strength||v.formulary||{};return v.kind==='liquid'&&v.value>0&&!p.formularyIssue&&m.calculatorReady!==false&&m.route==='injection'&&(!m.species?.length||m.species.includes(species))&&(!(m.preparation?.injectionRoute||m.injectionRoute)||(m.preparation?.injectionRoute||m.injectionRoute)===row.route)&&[m.name,m.english,v.title,...(m.aliases||[])].some(s=>key(s)===key(row.drug));});const hospital=matches.filter(p=>!p.id.startsWith('catalog:'));return hospital.length?hospital:matches;}
 function calculate(row,weight,product,species){if(row.error)throw Error(row.error);if(row.species&&row.species!==species)throw Error('처방의 동물종과 현재 환자가 다릅니다.');if(row.basis==='kg'&&!(weight>0))throw Error('계산 체중을 입력해주세요.');const dose=row.dose*(row.basis==='kg'?weight:1),volume=row.unit==='mL',v=product?.body||{},strength=volume?1:Number(v.value),unit=volume?'mL':unitName(v.unit);if(!volume&&(!(strength>0)||v.kind!=='liquid'))throw Error('주사제 농도를 선택하거나 직접 입력해주세요.');if(unit!==row.unit&&!(['mg','mcg'].includes(unit)&&['mg','mcg'].includes(row.unit)))throw Error('처방 단위와 농도 단위가 다릅니다.');const amount=dose*(row.unit==='mcg'?.001:1)/(strength*(unit==='mcg'?.001:1));if(!Number.isFinite(amount)||amount<=0)throw Error('투여량을 확인해주세요.');return {drug:row.drug,dose,doseUnit:row.unit,strength,strengthUnit:unit,amount,amountUnit:'mL',route:row.route,prn:false,minIntervalHours:0,indication:'',...(row.basis==='kg'?{calculation:{basis:'kg',dosePerKg:row.dose,weight}}:{})};}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Number(n.toFixed(6)).toString();
 const unitName=u=>u==='U'?'IU':u;
 const preferenceName=(row,species)=>key(row.drug)+' · '+(species==='cat'?'고양이':'개')+' · '+row.route+' 기본 농도';
 const preference=(row,products,species)=>products.find(p=>p.body?.strength?.name===preferenceName(row,species)&&p.body.strength.injectionRoute===row.route&&p.body.strength.species?.length===1&&p.body.strength.species[0]===species);
 const defaultChoice=(row,options,species)=>preference(row,options,species)?.id||(options.length===1?options[0].id:'');
 async function preferenceId(row,species){const data=new TextEncoder().encode('injection-concentration-v1|'+key(row.drug)+'|'+species+'|'+row.route),hash=await crypto.subtle.digest('SHA-256',data);return 'manual-'+[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,20);}
 // Concentration preferences use the existing clinic strength store. Never persist a dose,
 // patient, weight, or administration record, and never replace unrelated product settings.
 function strengthStore(a){
  let chain=Promise.resolve(),known=new Map();
  const remember=items=>{for(const p of items||[])if(p.body?.strength)known.set(p.body.strength.ingredientId,p);};
  const same=(p,b)=>p&&Number(p.body.value)===b.value&&p.body.unit===b.unit&&p.body.strength?.injectionRoute===b.injectionRoute;
  async function save(row,product,species,valid){
   if(!valid())throw Error('입력이 변경되어 저장하지 않았습니다.');
   const ingredientId=await preferenceId(row,species),v=product?.body||{},unit=v.unit==='IU'?'U':v.unit,value=Number(v.value);
   if(!['mg','mcg','U'].includes(unit))throw Error('이 농도 단위는 자동 저장을 지원하지 않습니다. 이번 계산에만 적용됩니다.');
   if(!Number.isFinite(value)||value<=0||value>1e6||v.kind!=='liquid')throw Error('실제 주사제 농도를 확인해주세요.');
   const body={ingredientId,name:preferenceName(row,species),english:key(row.drug),basis:row.drug,aliases:[row.drug,key(row.drug)],species:[species],route:'injection',injectionRoute:row.route,kind:'liquid',value,unit,release:'standard',confirm:true};
   const work=async()=>{
    if(!valid())throw Error('입력이 변경되어 저장하지 않았습니다.');
    const fresh=await a.request('/practice/presets?protocols=1&formulary=1&strengths=1');
    if(!valid())throw Error('입력이 변경되어 저장하지 않았습니다.');
    const latest=(fresh.items||[]).find(p=>p.body?.strength?.ingredientId===ingredientId);
    if(same(latest,body)){remember([latest]);return latest;}
    if(!fresh.canManage)throw Error('농도 저장은 원장·관리자·수의사 권한이 필요합니다.');
    const expected=known.get(ingredientId);
    if((latest?.revision||0)!==(expected?.revision||0))throw Error('다른 화면에서 농도를 변경했습니다. 처방을 다시 읽고 최신 농도를 확인해주세요.');
    if(latest)body.revision=latest.revision;
    let responseError;
    try{const r=await a.request('/practice/strengths',{method:'POST',body:JSON.stringify({items:[body]})});if(r.results?.[0]?.status!=='saved')responseError=Error('농도 저장 충돌 · 처방을 다시 읽어주세요.');}catch(e){responseError=e;}
    a.strengthsChanged?.();
    if(!a.valid())throw Error('화면이 변경되었습니다. 다음 조회에서 저장 여부를 확인해주세요.');
    const check=await a.request('/practice/presets?protocols=1&formulary=1&strengths=1'),saved=(check.items||[]).find(p=>p.body?.strength?.ingredientId===ingredientId);
    if(!same(saved,body))throw responseError||Error('저장 결과를 확인하지 못했습니다.');
    remember([saved]);return saved;
   };
   const task=chain.then(work);chain=task.catch(()=>{});return task;
  }
  return {remember,save};
 }
 function mount(f,a){const host=document.createElement('section');host.className='cl-injection-input';host.innerHTML='<h3>주사 처방 붙여넣기</h3><label>한 줄씩 또는 +로 병용 입력 · IV/IM/SC<textarea data-injection-text rows="4" placeholder="cefazoline 20 mg/kg IV\ntaurine 1 mL IV"></textarea></label><button type="button" data-injection-read>처방 읽고 계산</button><p data-injection-status role="status"></p><div data-injection-review></div><button type="button" data-injection-apply hidden>확인한 처방을 투약 목록에 담기</button>';f.prepend(host);let rows=[],epoch=0,context='',timer=0,disposed=false;const signature=()=>JSON.stringify([a.species(),Number(a.weight())]);
  const status=host.querySelector('[data-injection-status]'),review=host.querySelector('[data-injection-review]'),apply=host.querySelector('[data-injection-apply]'),source=host.querySelector('textarea');
  const readButton=host.querySelector('[data-injection-read]'),store=a.request?strengthStore(a):null;
  function invalidate(message=''){clearTimeout(timer);a.changed?.();epoch++;rows=[];review.replaceChildren();apply.hidden=true;status.textContent=message;}
  function queue(){clearTimeout(timer);if(!a.auto||!source.value.trim()||!['dog','cat'].includes(a.species())||!(Number(a.weight())>0))return;status.textContent='계산 중…';timer=setTimeout(()=>void read(),400);}
  source.oninput=()=>{invalidate(a.auto?'':'원문 변경 · 다시 읽어주세요.');queue();};
  if(a.auto){readButton.hidden=true;host.querySelector('h3').textContent='주사 처방';source.closest('label').firstChild.textContent='처방 원문';source.rows=5;
   const bar=document.createElement('nav');bar.className='pt-prescription-inputs';bar.setAttribute('aria-label','주사 처방 입력');bar.innerHTML='<button type="button" data-injection-text-mode aria-pressed="true">원문 입력</button><button type="button" data-injection-clear>처방 지우기</button>';
   host.querySelector('h3').after(bar);bar.querySelector('[data-injection-text-mode]').onclick=()=>source.focus();bar.querySelector('[data-injection-clear]').onclick=()=>{source.value='';invalidate();source.focus();};
   const help=document.createElement('details');help.className='pt-entry-help';help.innerHTML='<summary>입력 도움말</summary><p>약물마다 한 줄 또는 +로 연결해 입력하세요. 같은 투여 경로는 맨 끝에 한 번 입력할 수 있습니다. 실제 농도·경로를 확인한 뒤 결과를 사용합니다. 사진 입력·저장 처방 불러오기는 경구 처방에서 지원합니다.</p>';source.closest('label').after(help);
  }

  async function read(){if(disposed||!a.valid())return;clearTimeout(timer);const ticket=++epoch;apply.hidden=true;review.replaceChildren();rows=[];try{if(!['dog','cat'].includes(a.species()))throw Error('계산 대상 동물종을 선택해주세요.');const parsed=parse(source.value);const readingContext=signature();status.textContent='병원 주사제 함량 확인 중…';const products=await a.products();if(disposed||!a.valid()||ticket!==epoch||readingContext!==signature())return;context=readingContext;store?.remember(products);rows=parsed.map(r=>{const options=r.error||r.unit==='mL'?[]:candidates(r,products,a.species());return {...r,options,choice:defaultChoice(r,options,a.species()),manual:'',manualUnit:r.unit==='mcg'?'mcg':r.unit,confirmed:false};});status.textContent='';paint();readButton.hidden=!!a.auto;}catch(e){if(!disposed&&ticket===epoch&&a.valid()){status.textContent=e.message;readButton.hidden=false;readButton.textContent='다시 계산';}}}
  readButton.onclick=()=>void read();
  function result(r){if(context!==signature())throw Error('종·체중이 변경되었습니다. 처방을 다시 읽어주세요.');const p=selectedProduct(r);return calculate(r,a.weight(),p,a.species());}
  function selectedProduct(r){return r.choice==='manual'?{body:{kind:'liquid',value:Number(r.manual),unit:r.manualUnit}}:r.options?.find(p=>p.id===r.choice);}
  async function saveRow(r,card){
   if(!store||r.error||r.unit==='mL'||!r.choice)return;
   const product=selectedProduct(r),label=card.querySelector('[data-strength-save-status]'),retry=card.querySelector('[data-strength-retry]');
   try{result(r);}catch{return;}
   const snapshot=JSON.stringify([r.choice,r.manual,r.manualUnit,signature()]);
   if(r.savedSnapshot===snapshot||r.savingSnapshot===snapshot)return;
   const sequence=(r.saveSequence||0)+1;r.saveSequence=sequence;r.savingSnapshot=snapshot;
   const valid=()=>!disposed&&a.valid()&&rows.includes(r)&&r.saveSequence===sequence&&snapshot===JSON.stringify([r.choice,r.manual,r.manualUnit,signature()]);
   label.textContent='농도 저장 중…';retry.hidden=true;update();
   try{const saved=await store.save(r,product,a.species(),valid);if(!valid())return;
    r.savedSnapshot=snapshot;r.options=r.options.filter(p=>p.id!==saved.id).concat(saved);
    label.textContent=(a.species()==='cat'?'고양이':'개')+' · '+r.route+' 농도 저장됨 · 다음 계산부터 자동 적용';
   }catch(e){if(valid()){label.textContent='농도 저장 안 됨 · '+e.message;retry.hidden=false;}}
   finally{if(r.saveSequence===sequence){r.savingSnapshot='';if(!disposed&&a.valid()&&rows.includes(r))update();}}
  }
  function update(){a.changed?.();rows.forEach((r,i)=>{const card=review.children[i],out=card.querySelector('output');if(!out)return;try{const m=result(r);out.textContent=(r.basis==='kg'?fmt(r.dose)+' '+r.unit+'/kg × '+a.weight()+' kg = '+fmt(m.dose)+' '+m.doseUnit+' → ':'1회 고정량 · ')+fmt(m.amount)+' mL · '+r.route;if(a.auto){const formula=out.textContent;out.textContent='1회 '+fmt(m.amount)+' mL · '+r.route;let detail=card.querySelector('.pt-injection-formula');if(!detail){detail=document.createElement('details');detail.className='pt-entry-help pt-injection-formula';detail.innerHTML='<summary>계산식</summary><p></p>';card.querySelector('.cl-help').after(detail);}detail.querySelector('p').textContent=formula;}out.className='cl-injection-result';card.querySelector('[data-rx-confirm]').disabled=false;}catch(e){out.textContent=e.message;out.className='cl-alert';r.confirmed=false;const c=card.querySelector('[data-rx-confirm]');c.checked=false;c.disabled=true;}});apply.hidden=!!a.reviewed||!rows.length;apply.disabled=rows.some(r=>r.error||!r.confirmed||!!r.savingSnapshot);if(a.reviewed&&rows.length&&!apply.disabled)a.reviewed(rows.map(r=>({medication:result(r),instruction:'처방 원문: '+(r.sourceRaw||r.raw)+(r.sourceRaw?' · 계산 항목: '+r.raw:'')})));}
  function paint(){review.innerHTML=rows.map((r,i)=>'<article data-injection-row="'+i+'"><b>'+esc(r.drug||'입력 확인')+'</b><p class="cl-help">'+esc(r.raw)+'</p>'+(r.error?'<p class="cl-alert">'+esc(r.error)+'</p>':(r.unit==='mL'?'<p>처방된 부피 그대로 · 체중·농도 환산 없음</p>':'<label>사용할 주사제 농도<select data-rx-product><option value="">농도 선택</option>'+r.options.map(p=>'<option value="'+esc(p.id)+'" '+(r.choice===p.id?'selected':'')+'>'+esc(p.body.title)+' · '+p.body.value+' '+esc(p.body.unit)+'/mL</option>').join('')+'<option value="manual">농도 직접 입력</option></select></label><div data-rx-manual hidden><label>실제 주사제 농도 /mL<input data-rx-strength type="number" step="any" min="0"></label><label>농도 단위<select data-rx-unit>'+['mg','mcg','IU','mEq'].map(u=>'<option '+(u===r.manualUnit?'selected':'')+'>'+u+'</option>').join('')+'</select></label></div>')+(store&&r.unit!=='mL'?'<p class="cl-help" data-strength-save-status role="status">농도 선택·입력 시 현재 동물종·경로의 병원 기본값으로 저장됩니다.</p><button type="button" data-strength-retry hidden>농도 저장 재시도</button>':'')+'<output></output><label class="cl-injection-confirm"><input type="checkbox" data-rx-confirm>제품·용량·경로 확인</label>')+'</article>').join('');review.querySelectorAll('article').forEach((card,i)=>{const r=rows[i];card.onchange=e=>{if(e.target.matches('[data-rx-confirm]')){r.confirmed=e.target.checked;if(r.confirmed&&a.auto){const editor=card.querySelector('.pt-injection-edit');if(editor)editor.open=false;}}else{r.confirmed=false;card.querySelector('[data-rx-confirm]').checked=false;}if(e.target.matches('[data-rx-product]')){r.choice=e.target.value;card.querySelector('[data-rx-manual]').hidden=r.choice!=='manual';}if(e.target.matches('[data-rx-unit]'))r.manualUnit=e.target.value;update();if(e.target.matches('[data-rx-product],[data-rx-unit],[data-rx-strength],[data-rx-confirm]'))void saveRow(r,card);};card.querySelector('[data-strength-retry]')?.addEventListener('click',()=>void saveRow(r,card));card.querySelector('[data-rx-strength]')?.addEventListener('input',e=>{r.manual=e.target.value;r.confirmed=false;card.querySelector('[data-rx-confirm]').checked=false;update();});});if(a.auto)review.querySelectorAll('article').forEach((card,i)=>{const r=rows[i],out=card.querySelector('output'),label=card.querySelector('label:has([data-rx-product])');if(!out)return;if(r.unit==='mL')card.querySelector(':scope > p:not(.cl-help)')?.remove();card.querySelector('b').after(out);if(label){const editor=document.createElement('details');editor.className='pt-injection-edit';editor.innerHTML='<summary>수정</summary>';editor.open=!r.choice;label.before(editor);editor.append(label,card.querySelector('[data-rx-manual]'));const info=document.createElement('p');info.className='pt-injection-strength pt-help';editor.before(info);const describe=()=>{const product=r.options.find(p=>p.id===r.choice);info.textContent=(r.choice==='manual'?(r.manual||'농도 미입력')+' '+r.manualUnit+'/mL':product?product.body.value+' '+product.body.unit+'/mL':'농도 선택 필요')+' · '+r.route;};card.addEventListener('change',describe);card.addEventListener('input',describe);describe();}});update();}
  apply.onclick=()=>{if(disposed||!a.valid()||!rows.length||rows.some(r=>r.error||!r.confirmed))return;try{const items=rows.map(r=>({medication:result(r),instruction:'처방 원문: '+(r.sourceRaw||r.raw)+(r.sourceRaw?' · 계산 항목: '+r.raw:'')}));a.add(items);epoch++;if(!a.retainResults){rows=[];review.replaceChildren();source.value='';}apply.hidden=true;status.textContent=a.appliedMessage||items.length+'개 약물을 목록에 담았습니다. 투여 일정 확인 후 저장하세요.';f.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){status.textContent=e.message;}};
  return {reset(){invalidate();context='';source.value='';},invalidate(){invalidate(a.auto?'':'종·체중 변경 · 처방을 다시 읽어주세요.');queue();},dispose(){disposed=true;clearTimeout(timer);epoch++;},refresh:()=>{if(!rows.length)queue();}};
 }
 const api={parse,candidates,calculate,mount,defaultChoice,strengthStore,preferenceId,preferenceName};if(typeof module==='object'&&module.exports)module.exports=api;else g.PracticeInjection=api;
})(typeof window==='object'?window:globalThis);
