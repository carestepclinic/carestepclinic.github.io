/* Label-specific reference data. Values are applied only after clinician review. */
(function(g){
 'use strict';
 const checked='2026-10-22';
 const daily=id=>'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid='+id;
 const sources={
  clavamox:{title:'Zoetis · CLAVAMOX 미국 제품 정보',url:'https://www.zoetisus.com/products/petcare/clavamox/'},
  cephalexin:{title:'Virbac · RILEXINE 미국 허가문서',url:daily('84506621-8429-4b65-a7b4-1c9375dcbd89')},
  clindamycin:{title:'Zoetis · ANTIROBE AQUADROPS 미국 허가문서',url:daily('a2224602-6f04-4b83-968a-8c193230998f')},
  carprofen:{title:'Zoetis · RIMADYL 미국 허가문서',url:'https://www.zoetisus.com/content/_assets/docs/vmips/package-inserts/rimadyl-chewable-tablets-prescribing-information.pdf'},
  maropitantOral:{title:'Zoetis · CERENIA 정제 미국 허가문서',url:daily('3bc065ce-09d6-4131-a5a0-dca3909e0bc8')},
  maropitantInjection:{title:'Zoetis · CERENIA 주사제 미국 허가문서',url:daily('6aeda328-97c9-4868-8ecb-b3a4dcdbc0a0')},
  cefovecin:{title:'Zoetis · CONVENIA 재구성 주사제 미국 허가문서',url:daily('2daeaf25-f98f-49d3-943c-f604a844d93c')},
  fluid:{title:'AAHA 2024 · 수액 종류·유지 요구량',url:'https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-3-fluids-for-replacement-and-maintenance/'},
  anesthesia:{title:'AAHA 2024 · 마취 중 수액',url:'https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-4-fluid-therapy-and-anesthesia/'}
 };
 const profile=(id,species,label,route,min,max,times,extra={})=>({id,species,label,route,min,max,times,basis:'kg',...extra});
 const amoxProfiles=[profile('dog','dog','피부·연조직·치주 감염','PO',13.75,13.75,2,{maxDays:30,note:'두 성분 합산량 기준. 보통 5~7일, 반응·감수성에 따라 재평가.'}),profile('cat','cat','피부·연조직 감염·세균성 방광염','PO',62.5,62.5,2,{basis:'fixed',maxDays:30,note:'고양이는 이 제품 문서의 62.5 mg/마리/회 고정량. 피부 감염 5~7일, 요로감염은 별도 기간 확인.'})];
 const beta='페니실린·세팔로스포린 과민반응 병력 금기. 세균 감염·감수성 및 환자 상태를 확인하세요.';
 const antiemetic='구토 원인을 평가하세요. 위장관 폐색·독물 섭취에서 안전성 미확인. 간기능·병용약·번식/임신/수유 여부를 확인하세요.';
 const drugs=[
  {id:'amoxclav-tablet',name:'아목시실린/클라불란산 · 정제',generic:'amoxicillin clavulanate',product:'CLAVAMOX CHEWABLE',category:'oral',form:'tablet',strengths:[62.5,125,250,375],source:'clavamox',warning:beta+' 함량은 4:1 복합제 합계입니다. 이 제품은 분할량만 투여하지 않고 정제 전체를 사용하도록 표시되어 있습니다.',profiles:amoxProfiles},
  {id:'amoxclav-drops',name:'아목시실린/클라불란산 · 경구액',generic:'amoxicillin clavulanate',product:'CLAVAMOX Drops',category:'oral',form:'liquid',strengths:[62.5],source:'clavamox',warning:beta+' 재구성 후 62.5 mg/mL(두 성분 합계). 냉장 보관·10일 이내 사용 조건을 확인하세요.',profiles:amoxProfiles},
  {id:'cephalexin',name:'세팔렉신 · 정제',generic:'cephalexin',product:'RILEXINE',category:'oral',form:'tablet',strengths:[150,300,600],source:'cephalexin',warning:beta+' 이 문서는 개의 이차성 표재성 농피증에 한정되며 고양이 용량으로 적용하지 않습니다.',profiles:[profile('dog','dog','감수성 S. pseudintermedius에 의한 이차성 표재성 농피증','PO',22,22,2,{note:'제품 문서의 치료 기간은 28일. 배양·감수성 및 임상 반응에 따라 수의사가 치료 계획을 결정합니다.'})]},
  {id:'clindamycin',name:'클린다마이신 · 경구액',generic:'clindamycin',product:'ANTIROBE AQUADROPS',category:'oral',form:'liquid',strengths:[25],source:'clindamycin',warning:'클린다마이신·린코마이신 과민반응 금기. 중증 간·신장질환과 신경근 차단제 병용 시 주의. 아래 범위에서 수의사가 1회 용량을 정합니다.',profiles:[profile('dog','dog','감염성 상처·농양·치과 감염','PO',5.5,33,2,{maxDays:28,note:'미국 문서 2.5~15 mg/lb/회를 약 5.5~33 mg/kg/회로 표시. 3~4일 무반응이면 재평가.'}),profile('cat','cat','감염성 상처·농양·치과 감염','PO',11,33,1,{maxDays:14,note:'미국 문서 5~15 mg/lb/회를 약 11~33 mg/kg/회로 표시. 3~4일 무반응이면 재평가.'})]},
  {id:'carprofen',name:'카프로펜 · 정제',generic:'carprofen',product:'RIMADYL',category:'oral',form:'tablet',strengths:[25,75,100],source:'carprofen',warning:'개 전용 제품. 고양이에 사용하지 않습니다. 다른 NSAID·스테로이드 병용을 피하고 탈수·위장관·신장·간 위험을 평가하세요. 최소 유효량·최단 기간을 사용하며 6주령 미만 안전성은 확립되지 않았습니다.',profiles:[profile('daily','dog','골관절염·수술 후 통증 · 1일 1회','PO',4.4,4.4,1),profile('twice','dog','골관절염·수술 후 통증 · 1일 2회','PO',2.2,2.2,2)]},
  {id:'maropitant-oral',name:'마로피탄트 · 정제',generic:'maropitant',product:'CERENIA Tablets',category:'oral',form:'tablet',strengths:[16,24,60,160],source:'maropitantOral',warning:antiemetic+' 계산값은 분할·조제 확정값이 아니며 제품 체중별 정제표를 확인하세요.',profiles:[profile('young','dog','급성 구토 예방 · 2~7개월령','PO',2,2,1,{maxDays:5,note:'문서상 최소 기준량 2 mg/kg. 5일 이내.'}),profile('adult','dog','급성 구토 예방 · 7개월령 이상','PO',2,2,1,{note:'문서상 최소 기준량 2 mg/kg. 지속되는 구토는 재평가.'}),profile('motion','dog','멀미 구토 예방 · 4개월령 이상','PO',8,8,1,{maxDays:2,note:'문서상 최소 기준량 8 mg/kg. 여행 2시간 전, 소량의 음식과 투여. 최대 연속 2일.'})]},
  {id:'maropitant-injection',name:'마로피탄트 · 주사제',generic:'maropitant',product:'CERENIA Injectable',category:'injection',form:'liquid',strengths:[10],source:'maropitantInjection',warning:antiemetic,profiles:[profile('dog-sc','dog','급성 구토 예방·치료 · 2개월령 이상','SC',1,1,1,{maxDays:5}),profile('dog-iv','dog','급성 구토 예방·치료 · 4개월령 이상','IV',1,1,1,{maxDays:5,note:'정맥투여는 1~2분에 걸쳐 투여.'}),profile('cat-sc','cat','구토 치료 · 4개월령 이상','SC',1,1,1,{maxDays:5}),profile('cat-iv','cat','구토 치료 · 4개월령 이상','IV',1,1,1,{maxDays:5,note:'정맥투여는 1~2분에 걸쳐 투여.'})]},
  {id:'cefovecin',name:'세포베신 · 주사제',generic:'cefovecin',product:'CONVENIA 재구성 제제',category:'injection',form:'liquid',strengths:[80],source:'cefovecin',warning:beta+' 재구성 후 80 mg/mL 제제 기준. 4개월령 미만·번식/수유 동물 안전성 미확인. IM/IV 적용 안 됨. 장기간 잔류하며 이번 계산은 1회분입니다.',profiles:[profile('dog','dog','감수성 균에 의한 피부 감염 · 4개월령 이상','SC',8,8,null,{single:true,note:'재투여 여부·간격은 별도 진료 판단. 매일 투여하는 약물이 아닙니다.'}),profile('cat','cat','감수성 P. multocida에 의한 상처·농양 · 4개월령 이상','SC',8,8,null,{single:true,note:'단회 피하주사.'})]}
 ];
 const fluids=[
  {id:'lrs',name:'젖산 링거액 · LRS / 하트만 계열',balanced:true,note:'균형 등장성 결정질액. 칼슘 함유. 사용 제품의 조성과 혼합 가능 여부 확인.'},
  {id:'plasmalyte',name:'Plasma-Lyte A / 148',balanced:true,note:'균형 등장성 결정질액. acetate·gluconate 완충제. A와 148의 제품 조성을 각각 확인.'},
  {id:'normosol',name:'Normosol-R',balanced:true,note:'균형 등장성 결정질액. 칼슘 미함유·칼륨 함유. 제품 표시 확인.'},
  {id:'saline',name:'0.9% 염화나트륨 · 생리식염수',balanced:false,note:'완충제가 없는 등장성 수액. Na·Cl 및 산염기 상태를 확인. 균형 수액의 마취 기준을 자동 적용하지 않습니다.'},
  {id:'d5w',name:'5% 포도당 수액 · D5W',balanced:false,note:'포도당 대사 후 자유수 공급. 저혈량 소생액으로 사용하지 않으며 혈당·Na·전해질과 별도 처방을 확인.'},
  {id:'half-saline',name:'0.45% 염화나트륨',balanced:false,note:'저장성 수액. 저혈량 소생용이 아니며 Na와 수분 상태에 맞춰 별도 처방.'}
 ];
 function get(id,species,pid){const drug=drugs.find(x=>x.id===id),p=drug?.profiles.find(x=>x.id===pid&&x.species===species);if(!p)throw Error('선택한 종에 해당하는 용법을 다시 선택해주세요.');return {drug,profile:p};}
 function selection(id,species,pid,value,strength){const {drug,profile:p}=get(id,species,pid),dose=Number(value),c=Number(strength);if(!String(value).trim()||!Number.isFinite(dose)||dose<p.min||dose>p.max)throw Error('표시된 참고 범위에서 수의사가 정한 1회 용량을 입력해주세요.');if(!drug.strengths.includes(c))throw Error('실제 제품과 일치하는 함량을 선택해주세요.');return {id,species,profileId:pid,dose,strength:c,form:drug.form,basis:p.basis,times:p.times,single:!!p.single};}
 function validate(s,v){const {drug,profile:p}=get(s.id,s.species,s.profileId);const dose=Number(v.dose)*(v.doseUnit==='mcg'?0.001:1);if(v.doseBasis!==p.basis||v.form!==drug.form||!['mg','mcg'].includes(v.doseUnit)||dose<p.min||dose>p.max||!Number.isFinite(dose))throw Error('선택한 용법과 입력값이 다릅니다. 용법을 다시 확인하거나 직접 입력으로 전환해주세요.');const strength=Number(v.concentration)*(v.strengthUnit==='mcg'?0.001:1);if(!['mg','mcg'].includes(v.strengthUnit)||Math.abs(strength-s.strength)>1e-8)throw Error('적용한 제품 함량과 다릅니다. 제품을 다시 선택하거나 직접 입력으로 전환해주세요.');if(p.single&&(v.courseMode!=='total'||Number(v.totalDoses)!==1))throw Error('이 용법은 단회 주사 1회분만 계산합니다.');if(!p.single){if(v.courseMode!=='days'||Number(v.times)!==p.times)throw Error('선택한 용법의 투여 간격을 확인해주세요.');if(p.maxDays&&Number(v.days)>p.maxDays)throw Error('선택한 용법의 최대 기간 '+p.maxDays+'일을 확인해주세요.');}return {drug,profile:p};}
 function species(v){return ({dog:'dog',cat:'cat',강아지:'dog',개:'dog',고양이:'cat'})[v]||'';}
 const api={checked,sources,drugs,fluids,get,selection,validate,species};if(typeof module!=='undefined')module.exports=api;g.PracticeReference=api;
})(typeof window==='undefined'?globalThis:window);
