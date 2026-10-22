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
 const api={convert,dose,dilute,format};if(typeof module!=='undefined')module.exports=api;g.PracticeCalculators=api;
})(typeof window==='undefined'?globalThis:window);
