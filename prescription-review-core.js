/* Lightweight prescription review and product adaptation; no clinical UI dependencies.
 * Legacy clinical-workspace keeps equivalent helpers for already-open pages.
 * clinic-calculator-consult-loading.test.cjs guards helper parity. */
(function(g){
 'use strict';
 const VERSION='clinical-review-20261026-v1';
 const FDA='https://www.fda.gov/animal-veterinary/animal-health-literacy/get-facts-about-pain-relievers-pets';
 const aliases={pds:'prednisolone',프레드니솔론:'prednisolone',프레드니손:'prednisone',멜록시캄:'meloxicam',메타캄:'meloxicam',카프로펜:'carprofen',피로콕시브:'firocoxib',프레비콕스:'firocoxib',로베나콕시브:'robenacoxib',온시어:'robenacoxib',덱사메타손:'dexamethasone',아스피린:'aspirin',udca:'ursodeoxycholicacid',우르소데옥시콜산:'ursodeoxycholicacid'};
 const nsaids=new Set(['carprofen','meloxicam','firocoxib','robenacoxib','deracoxib','ketoprofen','piroxicam','aspirin','ibuprofen','naproxen']);
 const steroids=new Set(['prednisolone','prednisone','dexamethasone','methylprednisolone','triamcinolone','hydrocortisone']);
 const norm=v=>{const family=g.PracticeIngredients?.resolve(v),s=String(family?.english||v||'').normalize('NFKC').toLowerCase().replace(/[\s·_-]/g,'');return aliases[s]||s;};
 function doseDays(row){const start=Number(row.startDay??1),days=Number(row.days),step=Number(row.intervalDays??1),first=Number(row.firstDoseDay??1);if(!Number.isInteger(start)||start<1||!Number.isInteger(days)||days<1||days>366||![1,2].includes(step)||!Number.isInteger(first)||first<1||first>step||first>days)return null;return new Set(Array.from({length:Math.ceil(days/step)},(_,i)=>start+first-1+i*step).filter(d=>d<start+days));}
 function overlaps(a,b){const x=doseDays(a),y=doseDays(b);return !x||!y||[...x].some(n=>y.has(n));}
 function reviewPrescription({rows=[],species='',weight=0,checks=null}={}){
  const findings=[],known=new Set(),unknown=[];const add=(severity,code,text,indices=[],source='')=>findings.push({severity,code,text,indices,source});
  if(!['dog','cat'].includes(species))add('missing','species','대상 동물을 확인해주세요.');if(rows.some(r=>r.doseBasis==='kg')&&!(Number(weight)>0))add('missing','weight','체중당 처방의 현재 체중이 필요합니다.');if(!rows.length)add('missing','empty','검토할 처방이 없습니다.');
  const names=rows.map(r=>norm(r.ingredient||r.calculationIngredient||r.drug));
  rows.forEach((r,i)=>{const name=names[i];if(!name)add('missing','name','약물명이 확인되지 않았습니다.',[i]);if(r.issues?.length&&!r.reviewed)add('missing','parse',r.drug+' · 원문 해석을 먼저 확인해주세요.',[i]);if(r.doseSpecies&&r.doseSpecies!==species)add('warning','species-mismatch',r.drug+' · 처방의 동물종이 현재 환자와 다릅니다.',[i]);if(!(Number(r.strength)>0)||!r.strengthUnit||!r.form)add('missing','strength',r.drug+' · 제형·함량을 확인해주세요.',[i]);if(r.route!=='PO')add('missing','route',r.drug+' · 현재 처방 일괄 검토는 경구 처방만 다룹니다.',[i]);if(!doseDays(r)||!(Number(r.times)>0))add('missing','schedule',r.drug+' · 기간·투여 간격이 확인되지 않았습니다.',[i]);if(nsaids.has(name)||steroids.has(name))known.add(name);else unknown.push(r.drug);});
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){if(!overlaps(rows[i],rows[j]))continue;const a=names[i],b=names[j];if(a&&a===b)add('review','duplicate',rows[i].drug+' / '+rows[j].drug+' · 같은 성분의 투여 기간이 겹칩니다. 의도한 분할 처방인지 확인하세요.',[i,j]);else if(nsaids.has(a)&&nsaids.has(b))add('warning','nsaid-pair','서로 다른 NSAID의 투여 기간이 겹칩니다. 병용 계획을 재검토하세요.',[i,j],FDA);else if(nsaids.has(a)&&steroids.has(b)||steroids.has(a)&&nsaids.has(b))add('warning','nsaid-steroid','NSAID와 스테로이드의 투여 기간이 겹칩니다. 위장관 부작용 위험을 재검토하세요.',[i,j],FDA);}
  for(const [k,label] of [['allergy','약물 알레르기'],['medications','기존 복용약'],['renal','신장 기능'],['hepatic','간 기능'],['hydration','탈수 상태'],['pregnancy','임신·수유']]){if(!checks||checks[k]==='unknown'||!checks[k])add('missing','patient-'+k,label+' 확인사항이 없습니다.');else if(checks[k]==='present')add('review','patient-'+k,label+' 관련 확인사항이 있습니다. 개별 용법을 검토하세요.');}
  if(checks?.medications==='present')add('missing','outside-prescription','기존 복용약은 자동 대조 범위에 포함되지 않습니다. 약물명·중단 시점을 함께 대조해주세요.');
  if([...known].some(x=>nsaids.has(x))&&['renal','hydration'].some(k=>checks?.[k]==='present'))add('warning','nsaid-renal','NSAID 사용과 신장 기능·탈수 상태를 함께 검토하세요.',[],FDA);
  return {version:VERSION,findings,coverage:'동일 성분·일부 NSAID 병용·입력 누락·환자 확인사항 검토. 전체 상호작용, 적정 용량 범위, 약물 중단 후 휴약기간은 자동 판정하지 않습니다.',matched:[...known],unknown:[...new Set(unknown)],summary:findings.length?'확인할 항목 '+findings.length+'개':'등록된 규칙에서 발견된 항목 없음 · 처방 적합성은 별도 검토'};
 }
 function wardCatalogRows(doc){return (doc.ingredients||[]).flatMap(x=>{const options=(x.options||[]).filter(v=>v.value>0&&['tablet','capsule','liquid'].includes(v.kind)&&['mg','mcg','U','IU','mEq','T','unit'].includes(v.unit));const meta={ingredientId:x.id,name:x.name,english:x.english,aliases:[x.name,x.english,...(x.aliases||[]),...(x.searchAliases||[]),...(x.referenceNames||[])].filter(Boolean)};return options.length?options.map(v=>({id:'catalog:'+x.id+':'+v.id,catalog:true,release:v.release,source:v.sources?.[0]?.url||'',body:{title:x.name+' · '+x.english,kind:v.kind,value:v.value,unit:({U:'IU',T:'unit'})[v.unit]||v.unit,strength:{...meta,route:v.route,release:v.release||'standard',...(v.species?{species:v.species}:{})}}})):[{id:'catalog:'+x.id,catalog:true,manual:true,body:{title:x.name+' · '+x.english,strength:meta}}];});}
 const api={VERSION,norm,doseDays,overlaps,reviewPrescription,wardCatalogRows};
 if(typeof module==='object'&&module.exports)module.exports=api;else g.PrescriptionReviewCore=api;
})(typeof window==='undefined'?globalThis:window);
