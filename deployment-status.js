/* Display-only deployment assessment. Component release strings need not be equal. */
(()=>{
 'use strict';
 function inspect(data,{client,version}){
  const d=data||{},expected=String(d.expectedPatches?.[client]||d.expectedClients?.[client]||''),worker=String(d.worker?.build||d.worker?.version||''),schema=d.database?.schema;
  const clientStatus=!expected?'unknown':expected===version?'compatible':'mismatch';
  let schemaStatus='unavailable';
  if(schema?.status==='missing'&&schema.missingCount>0)schemaStatus='missing';
  if(schema?.status==='compatible'&&schema.compatible===true&&schema.missingCount===0&&Number.isInteger(schema.tablesExpected)&&schema.tablesExpected>0&&schema.tablesChecked===schema.tablesExpected)schemaStatus='compatible';
  const alerts=d.summary?.automationAlerts,automationKnown=d.automationStatus!=='unavailable'&&Number.isInteger(alerts)&&alerts>=0;
  let state='ok',title='화면·필수 DB 항목 확인 완료';
  if(clientStatus==='mismatch'){state='client_mismatch';title='화면 업데이트 필요';}
  else if(clientStatus==='unknown'||!worker){state='unavailable';title='서버 배포 정보 확인 필요';}
  else if(schemaStatus==='missing'){state='schema_missing';title='필수 DB 항목 확인 필요';}
  else if(schemaStatus!=='compatible'){state='unavailable';title='DB 구조 확인 결과 없음';}
  else if(!automationKnown){state='unavailable';title='자동화 상태 확인 필요';}
  else if(alerts>0){state='automation_warning';title='자동화 작업 확인 필요';}
  const schemaLabel=schemaStatus==='compatible'?'필수 DB 항목 확인됨':schemaStatus==='missing'?'필수 DB 항목 '+schema.missingCount+'개 누락':'DB 구조 확인 불가';
  const record=String(d.database?.version||''),recordLabel=!record||record==='migration_not_recorded'?'미등록':record;
  const detail='화면 '+version+(clientStatus==='compatible'?' (서버 요구 버전 일치)':expected?' (요구 '+expected+')':' (요구 버전 미확인)')+' · Worker '+(worker||'미확인')+' · '+schemaLabel+' · DB 배포 이력 '+recordLabel+' · 자동화 '+(automationKnown?'경고 '+alerts+'건':'확인 불가');
  return {state,ready:state==='ok',clientStatus,schemaStatus,expected,worker,automationAlerts:automationKnown?alerts:null,title,detail,notice:state==='ok'?'화면 버전과 필수 DB 항목을 확인했습니다.':title+' · '+(state==='client_mismatch'?'화면을 새로고침해주세요.':state==='schema_missing'?'운영 진단 상세에서 누락 항목을 확인해주세요.':'잠시 후 배포 상태를 다시 확인해주세요.')};
 }
 window.CarestepDeployment={inspect};
})();
