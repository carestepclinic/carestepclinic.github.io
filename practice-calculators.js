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
 function prescription(v){const w=weight(v.weight),basis=v.doseBasis||'kg';if(!['kg','fixed'].includes(basis))throw Error('용량 기준을 확인해주세요.');const mg=finite((basis==='fixed'?1:w)*mass(v.dose,v.doseUnit)),strength=mass(v.strength,v.strengthUnit),amount=finite(mg/strength);if(!['liquid','tablet'].includes(v.form))throw Error('제형을 확인해주세요.');const totalDoses=course(v);return {mg,amount,totalDoses,total:finite(amount*totalDoses),unit:v.form==='tablet'?'정':'mL'};}
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
 const api={convert,dose,dilute,format,prescription,fluid,course,cri,potassium,rer,nutrition};if(typeof module!=='undefined')module.exports=api;g.PracticeCalculators=api;
})(typeof window==='undefined'?globalThis:window);
