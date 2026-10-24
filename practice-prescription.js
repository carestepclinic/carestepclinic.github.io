/* Deterministic prescription input. No network calls, inferred regimens, or persistent patient data. */
(function(g){
 'use strict';
 const c=typeof module!=='undefined'&&module.exports?require('./practice-calculators.js'):g.PracticeCalculators;
 const decimal=/^(?:\d+(?:\.\d*)?|\.\d+)$/;
 const validNumber=v=>decimal.test(String(v).trim())&&Number(v)>0&&Number.isFinite(Number(v));
 function parseLine(original){
  const row={original:original.trim(),drug:'',dose:'',doseUnit:'mg',route:'',times:'',days:'',issues:[]};
  const s=row.original.normalize('NFKC');
  const match=s.match(/^(.+?)\s+(\d+(?:\.\d+)?|\.\d+)\s*(mg|mcg|μg)\s*\/\s*kg(?![a-z])\s*(.*)$/i);
  if(!match){row.issues.push('약물명과 1회 체중당 용량을 확인해주세요. 예: 약물명 0.5 mg/kg');return row;}
  row.drug=match[1].trim();row.dose=match[2];row.doseUnit=match[3].toLowerCase()==='mg'?'mg':'mcg';
  // Do not take the second number of a range, a product strength, or a combination as a dose.
  if(/[\d.,~\-–—/]$/.test(row.drug)||/\d\s*(?:mg|mcg|μg|ml|%)\b/i.test(row.drug)||/[<>/=]/.test(row.drug)){row.dose='';row.issues.push('용량 범위·제품 함량·복합 성분을 한 용량으로 읽을 수 없습니다. 한 약물의 1회 용량을 명확히 입력해주세요.');}
  let tail=match[4].trim();
  tail=tail.replace(/^\/(?:dose|회)(?=\s|$)/i,'').trim();
  const seen={};
  function take(key,value){if(seen[key])row.issues.push('같은 줄의 '+({route:'경로',times:'횟수',days:'기간'}[key])+'가 중복되어 있습니다.');seen[key]=true;row[key]=String(value);}
  while(tail){
   let m;
   if((m=tail.match(/^(po|경구)(?=\s|$)/i)))take('route','PO');
   else if((m=tail.match(/^(sid|bid|tid|qid)(?=\s|$)/i)))take('times',{sid:1,bid:2,tid:3,qid:4}[m[1].toLowerCase()]);
   else if((m=tail.match(/^q\s*(\d+)\s*h(?=\s|$)/i))){const h=Number(m[1]);if(![4,6,8,12,24].includes(h))row.issues.push('이 투여 간격은 하루 정수 횟수로 계산할 수 없습니다. 원처방을 확인해주세요.');else take('times',24/h);}
   else if((m=tail.match(/^하루\s*(\d+)\s*회(?=\s|$)/)))take('times',m[1]);
   else if((m=tail.match(/^(?:for\s+)?(\d+)\s*(days?|일|weeks?|주)(?=\s|$)/i)))take('days',Number(m[1])*((/^week|주/i).test(m[2])?7:1));
   else {row.issues.push('해석하지 못한 문구: '+tail);break;}
   tail=tail.slice(m[0].length).trim();
  }
  if(!validNumber(row.dose))row.issues.push('처방량은 0보다 큰 수여야 합니다.');
  return row;
 }
 function parse(text){
  if(typeof text!=='string'||text.length>12000)throw Error('처방은 12,000자 이내로 입력해주세요.');
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length)throw Error('약물별로 한 줄씩 처방을 입력해주세요.');
  if(lines.length>30)throw Error('한 번에 약물 30개까지 계산할 수 있습니다.');
  return lines.map(parseLine);
 }
 function common(rows,values){
  return rows.map(row=>{const next={...row,commonFields:[...(row.commonFields||[])]};for(const key of ['route','times','days'])if(!next[key]&&values[key]){next[key]=String(values[key]);next.commonFields.push(key);}return next;});
 }
 function calculate(row,weight){
  if(row.issues?.length&&!row.reviewed)throw Error('해석되지 않은 원문을 확인하고 수정한 값의 확인란을 선택해주세요.');
  if(!String(row.drug||'').trim())throw Error('약물명을 입력해주세요.');
  if(row.route!=='PO')throw Error('경구(PO) 처방인지 확인해주세요.');
  if(!['mg','mcg'].includes(row.doseUnit))throw Error('처방 단위를 확인해주세요.');
  if(!['tablet','capsule','liquid'].includes(row.form))throw Error('정제·캡슐·액상 중 제형을 선택해주세요.');
  if(!['mg','mcg'].includes(row.strengthUnit))throw Error('제품 함량 단위를 확인해주세요.');
  for(const [key,label,max] of [['times','하루 횟수',24],['days','투약 일수',366]])if(!/^\d+$/.test(String(row[key]))||Number(row[key])<1||Number(row[key])>max)throw Error(label+'를 1~'+max+' 사이 정수로 입력해주세요.');
  if(!validNumber(row.strength)||Number(row.strength)>1e6)throw Error('제품의 1정 또는 1mL당 함량을 확인해주세요.');
  return c.prescription({weight,doseBasis:'kg',dose:row.dose,doseUnit:row.doseUnit,strength:row.strength,strengthUnit:row.strengthUnit,form:row.form,times:row.times,days:row.days});
 }
 const api={parse,parseLine,common,calculate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.PracticePrescription=api;
})(typeof window!=='undefined'?window:globalThis);
