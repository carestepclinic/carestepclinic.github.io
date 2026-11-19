const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('clinic-support.js','utf8'),{window});const api=window.ClinicSupport;
test('patient and hospital prompts are separate and contain no automatic operational promises',()=>{
 const text=api.consentPatientMethod('공통 진료 설명',{kind:'other',patientChecks:['환자별 처방 계획','병원 운영 · 응급·야간 연락','병원 운영 · 입원 경과 안내']});
 assert.match(text,/이번 환자에서 확인한 내용\n환자별 처방 계획/);assert.match(text,/이번 진료에 적용할 병원 운영 안내\n병원 운영/);assert.doesNotMatch(text,/24시간|항상|자동 승인/);assert.ok(api.consentHasPlaceholder(text));
 const body={kind:'other',method:text,explanationSources:{method:{sourceId:'approved',text}}},model=api.consentDraftModel(body,'method');assert.ok(model);assert.equal(model.base.filter(r=>r.token).length,3);
 for(const row of model.base)if(row.token)row.value='담당 수의사가 확인한 합성 내용';assert.equal(api.consentHasPlaceholder(api.consentDraftText(model)),false);
});
test('only explicitly mapped hospital rows can reuse hospital settings',()=>{
 const prefs={emergencyContact:'합성 연락처',standardProcedures:'합성 절차'};assert.equal(api.consentOperationReuse('병원 운영 · 응급·야간 연락',prefs).value,'합성 연락처');
 for(const label of ['환자별 처방 계획','응급·야간 연락','병원 운영 · 알 수 없음'])assert.equal(api.consentOperationReuse(label,prefs),null);
 assert.equal(api.consentOperationReuse('병원 운영 · 입원 경과 안내',prefs),null);
});
test('signed printing preserves the actually entered hospital guidance and patient plan',()=>{
 const d={status:'signed',body:{kind:'other',method:'현재 환자 계획\n병원 운영 · 응급·야간 연락: 기록 당시 안내'}},snapshot=JSON.stringify(d);
 assert.match(api.consentHTML(d),/기록 당시 안내/);assert.equal(JSON.stringify(d),snapshot);
});
