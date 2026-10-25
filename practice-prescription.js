/* Deterministic prescription input. No network calls or persistent patient data. Blank lines delimit shared-regimen groups. */
(function(g){
 'use strict';
 const c=typeof module!=='undefined'&&module.exports?require('./practice-calculators.js'):g.PracticeCalculators;
 const decimal=/^(?:\d+(?:\.\d*)?|\.\d+)$/;
 const validNumber=v=>decimal.test(String(v).trim())&&Number(v)>0&&Number.isFinite(Number(v));
 function doseNumber(value){
  const text=String(value??'').normalize('NFKC').replace(/⁄/g,'/').trim();
  if(validNumber(text))return Number(text);
  const fraction=text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if(fraction&&Number(fraction[1])>0&&Number(fraction[2])>0&&Number(fraction[1])<=1e9&&Number(fraction[2])<=1e9)return Number(fraction[1])/Number(fraction[2]);
  throw Error('1회 처방량을 양수 또는 분수로 입력해주세요. 예: 0.25, 1/4');
 }
 function parseLine(original){
  const row={original:original.trim(),drug:'',dose:'',doseUnit:'mg',doseBasis:'',route:'',times:'',days:'',timing:'',intervalDays:'1',firstDoseDay:'1',issues:[]};
  const s=row.original.normalize('NFKC').replace(/⁄/g,'/');
  const match=s.match(/^(.+?)\s+(\d+\s*\/\s*\d+|\d+(?:\.\d+)?|\.\d+)\s*(mg|mcg|ug|μg|T|tabs?|tablets?|정)\s*\/\s*(kg|head|animal|마리|cat|dog)(?![a-z가-힣])\s*(.*)$/i);
  if(!match){row.issues.push('약물명·1회 용량·기준을 확인해주세요. 예: 약물명 0.5 mg/kg 또는 약물명 1/4 T/head');return row;}
  row.drug=match[1].trim();row.dose=match[2].replace(/\s/g,'');row.doseBasis=match[4].toLowerCase()==='kg'?'kg':'fixed';row.doseUnit=/^(?:t|tabs?|tablets?|정)$/i.test(match[3])?'T':match[3].toLowerCase()==='mg'?'mg':'mcg';
  if(/^(?:cat|dog)$/i.test(match[4]))row.doseSpecies=match[4].toLowerCase();
  if(/^(?:tabs?|tablets?|정)$/i.test(match[3]))row.countForm='tablet';
  // Do not take the second number of a range, a product strength, or a combination as a dose.
  if(/[\d.,~\-–—/]$/.test(row.drug)||/\d\s*(?:mg|mcg|ug|μg|ml|%)\b/i.test(row.drug)||/[<>/=]/.test(row.drug)){row.dose='';row.issues.push('용량 범위·제품 함량·복합 성분을 한 용량으로 읽을 수 없습니다. 한 약물의 1회 용량을 명확히 입력해주세요.');}
  let tail=match[5].trim();
  tail=tail.replace(/^\/(?:dose|회)(?=\s|$)/i,'').trim();
  const seen={};
  function take(key,value){if(seen[key])row.issues.push('같은 줄의 '+({route:'경로',times:'횟수',days:'기간',timing:'복용 시간'}[key])+'가 중복되어 있습니다.');seen[key]=true;row[key]=String(value);}
  while(tail){
   let m;
   if((m=tail.match(/^(po|경구)(?=\s|$)/i)))take('route','PO');
   else if((m=tail.match(/^(sid|bid|tid|qid)(?=\s|$)/i)))take('times',{sid:1,bid:2,tid:3,qid:4}[m[1].toLowerCase()]);
   else if((m=tail.match(/^(eod|qod|격일)(?=\s|$)/i))){take('times',1);row.intervalDays='2';}
   else if((m=tail.match(/^q\s*(\d+)\s*h(?=\s|$)/i))){const h=Number(m[1]);if(h===48){take('times',1);row.intervalDays='2';}else if(![4,6,8,12,24].includes(h))row.issues.push('이 투여 간격은 하루 정수 횟수로 계산할 수 없습니다. 원처방을 확인해주세요.');else take('times',24/h);}
   else if((m=tail.match(/^하루\s*(\d+)\s*회(?=\s|$)/)))take('times',m[1]);
   else if((m=tail.match(/^(?:for\s+)?(\d+)\s*(days?|일|weeks?|주)(?=\s|$)/i)))take('days',Number(m[1])*((/^week|주/i).test(m[2])?7:1));
   else if((m=tail.match(/^\((아침|점심|저녁|취침\s*전)\)(?=\s|$)/)))take('timing',m[1].replace(/\s+/g,' '));
   else {row.issues.push('해석하지 못한 문구: '+tail);break;}
   tail=tail.slice(m[0].length).trim();
  }
  try{doseNumber(row.dose);}catch(e){row.issues.push(e.message);}
  return row;
 }

 function validSchedule(row){return !row.issues.length&&row.route==='PO'&&/^\d+$/.test(row.times)&&Number(row.times)>=1&&Number(row.times)<=24&&/^\d+$/.test(row.days)&&Number(row.days)>=1&&Number(row.days)<=366&&(!(row.intervalDays==='2')||row.times==='1');}
 function reflow(rows){
  const courses=new Map();
  for(const row of rows){row.startDay=1;row.endDay=Number(row.days)||0;row.courseIssue='';if(row.courseId){if(!courses.has(row.courseId))courses.set(row.courseId,[]);courses.get(row.courseId).push(row);}}
  for(const group of courses.values()){
   let next=1,problem='';
   for(const [index,row] of group.entries()){
    if(group.length!==row.phaseCount||row.phaseIndex!==index+1)problem='단계가 누락되었습니다. 원처방을 다시 읽어주세요.';
    if(!/^\d+$/.test(String(row.days))||Number(row.days)<1||Number(row.days)>366||row.issues.length&&!row.reviewed)problem='단계별 원문과 기간을 모두 확인해야 전체 일정을 계산할 수 있습니다.';
    row.startDay=next;row.endDay=next+Number(row.days)-1;next=row.endDay+1;
   }
   if(next>367)problem='단계를 합친 처방 기간은 366일 이내로 입력해주세요.';
   for(const row of group)row.courseIssue=problem;
  }
  return rows;
 }
 function parse(text){
  if(typeof text!=='string'||text.length>12000)throw Error('처방은 12,000자 이내로 입력해주세요.');
  const groups=text.trim().split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/).map(block=>block.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)).filter(x=>x.length);
  const lines=groups.flat();if(!lines.length)throw Error('약물별로 한 줄씩 처방을 입력해주세요.');if(lines.length>30)throw Error('한 번에 약물 30개까지 계산할 수 있습니다.');
  const result=groups.flatMap((lines,groupIndex)=>{
   const rows=lines.flatMap((line,lineIndex)=>{
    const parts=line.split(/\s*(?:->|→|⇒)\s*/);if(parts.length>12)throw Error('한 약물은 12단계까지 입력해주세요.');
    const first=parseLine(parts[0]);
    return parts.map((part,index)=>{
     const inherited=index>0&&/^\s*(?:\d|\.\d|[¼½¾])/.test(part);
     const row=index===0?first:parseLine(inherited?first.drug+' '+part:part);
     Object.assign(row,{original:part,groupNumber:groupIndex+1,groupFields:[]});
     if(parts.length>1){Object.assign(row,{courseOriginal:line,courseId:groupIndex+'_'+lineIndex,phaseIndex:index+1,phaseCount:parts.length});if(row.drug.toLowerCase()!==first.drug.toLowerCase())row.issues.push('화살표 단계는 같은 약물에만 사용합니다. 다른 약물은 새 줄로 입력해주세요.');}
     return row;
    });
   }),last=rows.at(-1);
   if(!last||last.courseId||!validSchedule(last))return rows;
   const signatures=new Set(rows.filter(row=>!row.courseId&&validSchedule(row)).map(row=>[row.route,row.times,row.days,row.intervalDays,row.timing].join('|')));
   for(const row of rows.slice(0,-1)){
    if(row.issues.length||row.courseId)continue;
    const missing=['route','times','days'].filter(key=>!row[key]);
    if(signatures.size>1){if(missing.length)row.issues.push('한 묶음에 서로 다른 용법이 있습니다. 빈 줄로 묶음을 나누거나 약물별 용법을 입력·확인해주세요.');continue;}
    const compatible=['route','times','days'].every(key=>!row[key]||row[key]===last[key])&&(!row.times||row.intervalDays===last.intervalDays);
    for(const key of missing){row[key]=last[key];row.groupFields.push(key);if(key==='times'){row.intervalDays=last.intervalDays;row.firstDoseDay=last.firstDoseDay;}}
    if(compatible&&!row.timing&&last.timing){row.timing=last.timing;row.groupFields.push('timing');}if(row.groupFields.length)row.groupFrom=last.drug;
   }
   return rows;
  });
  if(result.length>90)throw Error('한 번에 총 90단계까지 계산할 수 있습니다.');return reflow(result);
 }
 function common(rows,values){
  return reflow(rows.map(row=>{const next={...row,commonFields:[...(row.commonFields||[])]};if(row.courseId)return next;for(const key of ['route','times','days'])if(!next[key]&&values[key]){next[key]=String(values[key]);next.commonFields.push(key);if(key==='times'){next.intervalDays=String(values.intervalDays||1);next.firstDoseDay='1';}}return next;}));
 }
 function scheduleDays(row){
  if(row.courseIssue)throw Error(row.courseIssue);
  for(const [key,label,max] of [['times','하루 횟수',24],['days','투약 일수',366]])if(!/^\d+$/.test(String(row[key]))||Number(row[key])<1||Number(row[key])>max)throw Error(label+'를 1~'+max+' 사이 정수로 입력해주세요.');
  const interval=Number(row.intervalDays??1),first=Number(row.firstDoseDay??1);
  if(![1,2].includes(interval)||![1,2].includes(first)||interval===1&&first!==1||interval===2&&Number(row.times)!==1)throw Error('격일(EOD)은 2일마다 1회로 설정해주세요.');
  const days=[];for(let day=first;day<=Number(row.days);day+=interval)days.push(day);
  if(!days.length)throw Error('입력한 기간 안에 투여일이 없습니다. 격일 첫 투여일을 확인해주세요.');return days;
 }
 function frequency(row){return Number(row.intervalDays)===2?'격일(EOD) · 2일마다 1회':'하루 '+row.times+'회';}
 function calendar(results,startDate){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate))throw Error('처방 시작일을 선택해주세요.');
  const base=new Date(startDate+'T00:00:00Z');if(!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==startDate)throw Error('올바른 시작일을 입력해주세요.');
  const count=Math.max(...results.map(x=>Number(x.row.endDay||x.row.days)));if(!Number.isInteger(count)||count<1||count>366)throw Error('전체 처방 기간을 확인해주세요.');
  const days=Array.from({length:count},(_,index)=>({day:index+1,date:new Date(base.getTime()+index*86400000).toISOString().slice(0,10),entries:[]}));
  for(const {row,result} of results){if(!result)throw Error('모든 처방을 계산한 후 날짜별 투여표를 확인할 수 있습니다.');for(const day of result.doseDays){const target=days[(row.startDay||1)+day-2];target.entries.push({drug:row.drug,phase:row.phaseIndex||0,timing:row.timing||'시간 미지정',amount:result.amount,unit:result.unit,times:Number(row.times),dailyTotal:result.amount*Number(row.times),product:row.product});}}
  return days;
 }
 function calculate(row,weight,species){
  if(row.doseSpecies&&row.doseSpecies!==species)throw Error('원문은 /'+row.doseSpecies+' 기준입니다. 계산 대상 동물을 확인해주세요.');
  if(row.issues?.length&&!row.reviewed)throw Error('해석되지 않은 원문을 확인하고 수정한 값의 확인란을 선택해주세요.');
  if(!String(row.drug||'').trim())throw Error('약물명을 입력해주세요.');
  if(row.route!=='PO')throw Error('경구(PO) 처방인지 확인해주세요.');
  if(!['mg','mcg','T'].includes(row.doseUnit))throw Error('처방 단위를 확인해주세요.');
  if(!['tablet','capsule','liquid'].includes(row.form))throw Error('정제·캡슐·액상 중 제형을 선택해주세요.');
  if(row.doseUnit==='T'&&row.countForm&&row.form!==row.countForm)throw Error('원문은 정제 개수입니다. 캡슐 개수로 사용하려면 원처방의 단위를 확인해주세요.');
  if(!['mg','mcg','T'].includes(row.strengthUnit))throw Error('제품 함량 단위를 확인해주세요.');
  const doseDays=scheduleDays(row);
  if(!validNumber(row.strength)||Number(row.strength)>1e6)throw Error('제품의 1정 또는 1mL당 함량을 확인해주세요.');
  const doseBasis=row.doseBasis??'kg';if(!['kg','fixed'].includes(doseBasis))throw Error('처방 기준을 kg당 또는 마리당으로 선택해주세요.');
  return {...c.prescription({weight,doseBasis,dose:doseNumber(row.dose),doseUnit:row.doseUnit,strength:row.strength,strengthUnit:row.strengthUnit,form:row.form,totalDoses:doseDays.length*Number(row.times)}),doseDays};
 }
 const api={parse,parseLine,common,calculate,reflow,scheduleDays,frequency,calendar};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.PracticePrescription=api;
})(typeof window!=='undefined'?window:globalThis);
