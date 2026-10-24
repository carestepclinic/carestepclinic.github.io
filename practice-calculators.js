/* Pure arithmetic. No drug lookup, dose recommendation or clinical protocol. */
(function(g){
 'use strict';
 const units={kg:['mass',1000000000],g:['mass',1000000],mg:['mass',1000],mcg:['mass',1],L:['volume',1000],mL:['volume',1]};
 function number(v,label){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(v).trim()))throw Error(label+'을 숫자로 입력해주세요.');const n=Number(v);if(!Number.isFinite(n)||n<=0||n>1e9)throw Error(label+'은 0보다 크고 10억 이하이어야 합니다.');return n;}
 function finite(n){if(!Number.isFinite(n)||n<=0||n>1e15||n<1e-12)throw Error('계산 결과가 지원 범위를 벗어났습니다. 입력 단위를 확인해주세요.');return n;}
 function convert(value,from,to){if(!units[from]||!units[to]||units[from][0]!==units[to][0])throw Error('같은 종류의 단위를 선택해주세요.');return finite(number(value,'환산값')*units[from][1]/units[to][1]);}
 function dose(weight,dosePerKg,concentration){const w=number(weight,'체중'),d=number(dosePerKg,'1회 처방량'),c=number(concentration,'약물 농도');if(w>200)throw Error('체중은 200 kg 이하로 입력해주세요.');const mg=finite(w*d),mL=finite(mg/c);return {mg,mL};}
 function dilute(stock,target,volume){const c1=number(stock,'원액 농도'),c2=number(target,'목표 농도'),v2=number(volume,'최종 부피');if(c2>=c1)throw Error('목표 농도는 원액 농도보다 낮아야 합니다.');const stockML=finite(c2*v2/c1),diluentML=finite(v2-stockML);return {stockML,diluentML};}
 function format(n){return Number(n.toPrecision(12)).toString();}
 function weight(v){const n=number(v,'체중');if(n>200)throw Error('체중은 200 kg 이하로 입력해주세요.');return n;}
 function mass(v,unit){if(!['mg','mcg'].includes(unit))throw Error('질량 단위를 확인해주세요.');return finite(number(v,'처방량·함량')*(unit==='mcg'?0.001:1));}
 function course(v){const total=v.totalDoses!==undefined&&v.totalDoses!==''?number(v.totalDoses,'총 투여 횟수'):number(v.times,'하루 투여 횟수')*number(v.days,'투약 일수');if(!Number.isInteger(total)||total>10000)throw Error('총 투여 횟수는 1~10,000회 정수로 입력해주세요.');if((v.totalDoses===undefined||v.totalDoses==='')&&(!Number.isInteger(Number(v.times))||!Number.isInteger(Number(v.days))))throw Error('횟수와 일수는 정수로 입력해주세요.');return total;}
 function prescription(v){
  const w=weight(v.weight),basis=v.doseBasis||'kg';if(!['kg','fixed','bsa'].includes(basis))throw Error('용량 기준을 확인해주세요.');
  let factor=basis==='fixed'?1:w;if(basis==='bsa'){factor=number(v.bsa,'의료진이 확인한 체표면적');if(factor>5)throw Error('체표면적 단위 m²와 입력값을 확인해주세요.');}
  const tablets=v.doseUnit==='T'||v.strengthUnit==='T';
  if(tablets){
   if(v.doseUnit!=='T'||v.strengthUnit!=='T'||v.form!=='tablet'||number(v.strength,'정 수 기준')!==1||basis==='bsa')throw Error('정(T) 계산은 정제·1정 기준으로 설정해주세요. mg·mcg·U와 환산하지 않으며 체표면적 기준은 지원하지 않습니다.');
   const amount=finite(factor*number(v.dose,'1회 처방 정 수')),totalDoses=course(v);
   return {tablets:amount,amount,totalDoses,total:finite(amount*totalDoses),unit:'정'};
  }
  const activity=v.doseUnit==='U'||v.strengthUnit==='U';if(activity&&(v.doseUnit!=='U'||v.strengthUnit!=='U'))throw Error('U(활성단위)와 mg·mcg는 서로 환산할 수 없습니다.');
  const totalAmount=finite(factor*(activity?number(v.dose,'1회 활성단위'):mass(v.dose,v.doseUnit))),strength=activity?number(v.strength,'제품 활성단위 함량'):mass(v.strength,v.strengthUnit),amount=finite(totalAmount/strength);
  if(!['liquid','tablet','capsule'].includes(v.form))throw Error('제형을 확인해주세요.');const totalDoses=course(v);
  return {...(activity?{activity:totalAmount}:{mg:totalAmount}),amount,totalDoses,total:finite(amount*totalDoses),unit:({tablet:'정',capsule:'캡슐',liquid:'mL'})[v.form]};
 }
 function fluid(v){let rate;if(v.mode==='weight')rate=finite(weight(v.weight)*number(v.rate,'처방 속도'));else if(v.mode==='rate')rate=number(v.rate,'시간당 주입량');else if(v.mode==='volume')rate=finite(number(v.volume,'총 주입량')/number(v.hours,'주입 시간'));else throw Error('수액 계산 방식을 선택해주세요.');const volume=v.mode==='volume'?number(v.volume,'총 주입량'):v.volume!==''&&v.volume!==undefined?number(v.volume,'남은 수액량'):null;const hours=v.mode==='volume'?number(v.hours,'주입 시간'):v.hours!==''&&v.hours!==undefined?number(v.hours,'계산할 시간'):null;let drops=null;if(v.factor!==''&&v.factor!==undefined){const f=number(v.factor,'점적계수');if(!Number.isInteger(f)||f>200)throw Error('세트에 표시된 점적계수를 확인해주세요.');drops=finite(rate*f/60);}return {rate:finite(rate),volume:hours?finite(rate*hours):null,hours:volume?finite(volume/rate):null,drops};}
 // Convert a prescribed CRI to an hourly mass/activity rate. U is never converted to mg.
 function cri(v){
  const w=weight(v.weight),d=number(v.dose,'처방 CRI 용량');
  const spec={'mcg/kg/min':['mg',0.001,60],'mcg/kg/hr':['mg',0.001,1],'mg/kg/min':['mg',1,60],'mg/kg/hr':['mg',1,1],'U/kg/hr':['U',1,1]}[v.doseUnit];
  if(!spec)throw Error('CRI 용량 단위를 선택해주세요.');
  if(!['mg','mcg','U'].includes(v.stockUnit)||(spec[0]==='U')!==(v.stockUnit==='U'))throw Error('U와 mg·mcg는 서로 환산할 수 없습니다. 제품 단위를 확인해주세요.');
  const stock=number(v.stock,'원액 농도')*(v.stockUnit==='mcg'?0.001:1),hourly=finite(w*d*spec[1]*spec[2]),stockRate=finite(hourly/stock),volume=number(v.volume,'약물 포함 최종 부피');
  let rate,concentration,stockML;
  if(v.mode==='prepare'){rate=number(v.rate,'설정할 펌프 속도');concentration=finite(hourly/rate);stockML=finite(concentration*volume/stock);}
  else if(v.mode==='pump'){stockML=number(v.stockML,'혼합한 원액량');concentration=finite(stockML*stock/volume);rate=finite(hourly/concentration);}
  else throw Error('CRI 계산 방식을 선택해주세요.');
  if(stockML>=volume)throw Error('원액량이 최종 부피 이상입니다. 희석 조제 조건을 다시 정해주세요.');
  return {hourly,stockRate,stockML,concentration,rate,diluentML:finite(volume-stockML),hours:finite(volume/rate),unit:spec[0]};
 }
 function nonnegative(v,label){if(/^(?:\d+\.?\d*|\.\d+)$/.test(String(v).trim())&&Number(v)===0)return 0;return number(v,label);}
 function potassium(v){const w=weight(v.weight),concentration=nonnegative(v.concentration,'최종 총 칼륨 농도'),rate=number(v.rate,'수액 속도'),other=nonnegative(v.other,'다른 정맥 라인의 칼륨 공급량'),hourly=concentration*rate/1000+other,perKg=hourly/w;if(!Number.isFinite(perKg))throw Error('입력 단위를 확인해주세요.');return {hourly,perKg,exceeds:perKg>0.5};}
 function rer(value){return finite(70*Math.pow(weight(value),0.75));}
 function nutrition(v){const energy=rer(v.weight),multiplier=number(v.multiplier,'수의사가 정한 RER 배수'),target=finite(energy*multiplier),other=nonnegative(v.other,'다른 음식 열량');if(other>=target)throw Error('다른 음식 열량이 목표 이상입니다. 추가 급여 계획을 확인해주세요.');const density=number(v.density,'제품 열량');if(!['kcal/g','kcal/kg','kcal/mL','kcal/can'].includes(v.unit))throw Error('제품 열량 단위를 확인해주세요.');const meals=number(v.meals,'하루 급여 횟수');if(!Number.isInteger(meals)||meals>24)throw Error('급여 횟수는 1~24회 정수로 입력해주세요.');const amount=finite((target-other)/(v.unit==='kcal/kg'?density/1000:density));return {rer:energy,target,remaining:target-other,amount,perMeal:amount/meals,unit:({'kcal/g':'g','kcal/kg':'g','kcal/mL':'mL','kcal/can':'캔'})[v.unit]};}
 function bounded(v,label,min,max,signed=false){const text=String(v??'').trim();if(!(signed?/^-?(?:\d+\.?\d*|\.\d+)$/:/^(?:\d+\.?\d*|\.\d+)$/).test(text))throw Error(label+'을 올바른 숫자로 입력해주세요.');const n=Number(text);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+'의 단위·입력값을 확인해주세요 ('+min+'~'+max+').');return n;}
 // These are input bounds, not species-specific reference intervals or treatment thresholds.
 function anionGap(v){const na=bounded(v.na,'Na',1,300),cl=bounded(v.cl,'Cl',1,300),hco3=bounded(v.hco3,'HCO₃',0,100);if(!['withK','withoutK'].includes(v.method))throw Error('AG 계산식을 선택해주세요.');const k=v.method==='withK'?bounded(v.k,'K',0,30):0;return {gap:na+k-cl-hco3,withK:v.method==='withK'};}
 function bicarbonate(v){
  const w=weight(v.weight);if(!['hco3','be'].includes(v.method))throw Error('보정 기준을 선택해주세요.');
  const be=v.method==='be',measured=bounded(v.measured,be?'측정 BE':'측정 HCO₃',be?-60:0,be?0:60,be),target=bounded(v.target,be?'목표 BE':'목표 HCO₃',be?-60:0,be?0:60,be),deficit=target-measured;
  if(deficit<=0)throw Error('목표값은 측정값보다 커야 합니다. 이 계산은 중탄산 보충 계획에 사용합니다.');
  const factor=number(v.factor,'선택한 분포계수'),fraction=number(v.fraction,'이번 보정 비율');if(factor>1||fraction>100)throw Error('분포계수는 1 이하, 보정 비율은 100% 이하로 입력해주세요.');
  if(!['0.5','1'].includes(String(v.stock)))throw Error('실제 제품의 중탄산 농도를 선택해주세요.');
  const stock=Number(v.stock),estimated=finite(w*factor*deficit),amount=finite(estimated*fraction/100),stockML=finite(amount/stock),volume=number(v.volume,'희석 후 최종 부피'),minutes=number(v.minutes,'계획한 주입 시간');
  if(volume<=stockML)throw Error('최종 부피는 원액량보다 커야 합니다. 희석 조제 계획을 확인해주세요.');
  return {deficit,estimated,amount,stockML,diluentML:finite(volume-stockML),concentration:finite(amount/volume),rate:finite(volume*60/minutes),perKg:finite(amount/w),hourlyPerKg:finite(amount/w*60/minutes)};
 }
 // All calcium quantities below are ELEMENTAL calcium, never calcium salt mass.
 function calcium(v){
  const w=weight(v.weight),d=number(v.dose,'처방 원소칼슘 용량'),stock=number(v.stock,'제품의 원소칼슘 함량');
  if(!['single','continuous'].includes(v.mode))throw Error('칼슘 투여 방식을 선택해주세요.');
  const hours=v.mode==='single'?number(v.minutes,'완속 주입 시간')/60:number(v.hours,'지속정주 계획 시간');
  const amount=finite(w*d*(v.mode==='continuous'?hours:1)),stockML=finite(amount/stock),volume=number(v.volume,'약물 포함 최종 부피');
  if(volume<stockML)throw Error('최종 부피가 필요한 원액량보다 작습니다. 원소칼슘 함량·희석 조건을 확인해주세요.');
  return {amount,stockML,diluentML:volume-stockML,concentration:finite(amount/volume),rate:finite(volume/hours),hourly:finite(amount/hours),hourlyPerKg:finite(amount/hours/w),hours};
 }
 // RBC estimate assumes no ongoing loss/hemolysis. It is not a transfusion trigger.
 function transfusion(v){
  const w=weight(v.weight);if(!['dog','cat'].includes(v.species))throw Error('개 또는 고양이를 선택해주세요.');
  if(!['packed','whole','plasma','other'].includes(v.product))throw Error('수혈 제제를 선택해주세요.');
  let volume,bloodVolume=null,coefficientOutside=false;
  if(v.mode==='pcv'){
   if(!['packed','whole'].includes(v.product))throw Error('PCV 계산은 적혈구·전혈 제제에만 사용합니다.');
   const current=bounded(v.current,'환자 PCV (%)',1,100),target=bounded(v.target,'목표 PCV (%)',1,100),unit=bounded(v.unitPcv,'제제 PCV (%)',1,100);
   if(target<=current)throw Error('목표 PCV는 현재 PCV보다 커야 합니다.');
   if(target>=unit)throw Error('목표 PCV는 제제 PCV보다 낮게 설정하고 제제 검사값을 확인해주세요.');
   bloodVolume=bounded(v.bloodVolume,'선택한 추정 혈액량 (mL/kg)',20,150);
   const range=v.species==='dog'?[80,90]:[40,60];coefficientOutside=bloodVolume<range[0]||bloodVolume>range[1];
   volume=finite(w*bloodVolume*(target-current)/unit);
  }else if(v.mode==='dose')volume=finite(w*number(v.dose,'의료진이 정한 제제 용량'));
  else if(v.mode==='volume')volume=number(v.volume,'의료진이 정한 총 수혈량');
  else throw Error('수혈량 계산 방식을 선택해주세요.');
  const hours=number(v.hours,'총 계획 시간');let initialRate=0,initialVolume=0,initialHours=0;
  if(v.initial===true||v.initial==='on'){
   initialRate=finite(w*number(v.initialRate,'초기 처방 속도'));
   initialHours=number(v.initialMinutes,'초기 관찰 시간')/60;
   if(initialHours>=hours)throw Error('총 시간에는 초기 관찰 시간이 포함됩니다. 총 시간을 더 길게 설정해주세요.');
   initialVolume=finite(initialRate*initialHours);
   if(initialVolume>=volume)throw Error('초기 주입량이 총 수혈량 이상입니다. 초기 속도·시간을 다시 확인해주세요.');
  }
  const remaining=finite(volume-initialVolume),remainingHours=hours-initialHours,rate=finite(remaining/remainingHours);
  return {volume,perKg:finite(volume/w),bloodVolume,coefficientOutside,hours,initialRate,initialVolume,initialHours,remaining,remainingHours,rate,ratePerKg:finite(rate/w),overFourHours:hours>4};
 }
 const api={convert,dose,dilute,format,prescription,fluid,course,cri,potassium,rer,nutrition,anionGap,bicarbonate,calcium,transfusion};if(typeof module!=='undefined')module.exports=api;g.PracticeCalculators=api;
})(typeof window==='undefined'?globalThis:window);
