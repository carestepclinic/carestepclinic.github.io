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
 function prescription(v){const mg=finite(weight(v.weight)*mass(v.dose,v.doseUnit)),strength=mass(v.strength,v.strengthUnit),amount=finite(mg/strength);if(!['liquid','tablet'].includes(v.form))throw Error('제형을 확인해주세요.');const totalDoses=course(v);return {mg,amount,totalDoses,total:finite(amount*totalDoses),unit:v.form==='tablet'?'정':'mL'};}
 function fluid(v){let rate;if(v.mode==='weight')rate=finite(weight(v.weight)*number(v.rate,'처방 속도'));else if(v.mode==='rate')rate=number(v.rate,'시간당 주입량');else if(v.mode==='volume')rate=finite(number(v.volume,'총 주입량')/number(v.hours,'주입 시간'));else throw Error('수액 계산 방식을 선택해주세요.');const volume=v.mode==='volume'?number(v.volume,'총 주입량'):v.volume!==''&&v.volume!==undefined?number(v.volume,'남은 수액량'):null;const hours=v.mode==='volume'?number(v.hours,'주입 시간'):v.hours!==''&&v.hours!==undefined?number(v.hours,'계산할 시간'):null;let drops=null;if(v.factor!==''&&v.factor!==undefined){const f=number(v.factor,'점적계수');if(!Number.isInteger(f)||f>200)throw Error('세트에 표시된 점적계수를 확인해주세요.');drops=finite(rate*f/60);}return {rate:finite(rate),volume:hours?finite(rate*hours):null,hours:volume?finite(volume/rate):null,drops};}
 const api={convert,dose,dilute,format,prescription,fluid,course};if(typeof module!=='undefined')module.exports=api;g.PracticeCalculators=api;
})(typeof window==='undefined'?globalThis:window);
