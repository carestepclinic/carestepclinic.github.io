(function(g){'use strict';
/* CLINIC_CAPABILITY_CATALOG_START */
const CLINIC_MODULES = [
 ['ward','입원·처치 보드','clinicalWard'],['anesthesia','마취·수술 기록','clinicalAnesthesia'],
 ['dental','치과기록','clinicalDental'],['neuro','신경검사 기록','clinicalNeuro'],
 ['ophthalmic','안과기록','clinicalOphthalmic'],['chronic','만성질환 기록','clinicalChronic'],['healthcheck','건강검진 기록','clinicalHealthcheck'],
 ['protocols','진료 프로토콜','clinicalProtocols']
];
const CLINIC_FEATURES = [...CLINIC_MODULES.map(([id,label,key])=>({id,label,key,pro:['ward','protocols'].includes(id)})),
 {id:'calculator',label:'처방·처치 계산',key:'clinicalCalculator',pro:false},
 {id:'trainingRead',label:'승인된 직원 교육자료 열람',key:'trainingLibrary',pro:false},
 {id:'trainingManage',label:'교육 배정·이수 관리',key:'trainingManagement',pro:true},
 {id:'labImport',label:'검사결과 파일 인식',key:'clinicalLabImport',pro:true}];
function clinicClinicalFeatures(features={}){return {...Object.fromEntries(CLINIC_FEATURES.map(x=>[x.key,true])),...features};}
function clinicContractFeatures(catalog={},stored){return {...catalog,...Object.fromEntries(CLINIC_FEATURES.map(x=>[x.key,stored?.[x.key]!==false]))};}
function clinicRecommendedFeatures(code){return Object.fromEntries(CLINIC_FEATURES.map(x=>[x.key,code!=='BASIC'||!x.pro]));}
function clinicRecordModule(item){return ['dental','neuro','ophthalmic','chronic','healthcheck'].includes(item?.body?.category)?item.body.category:item?.kind==='surgery'?'anesthesia':'ward';}
/* CLINIC_CAPABILITY_CATALOG_END */
g.ClinicCapabilities={modules:CLINIC_MODULES,features:CLINIC_FEATURES,featuresFor:clinicClinicalFeatures,contractFeatures:clinicContractFeatures,recommended:clinicRecommendedFeatures};})(typeof window==='undefined'?globalThis:window);
