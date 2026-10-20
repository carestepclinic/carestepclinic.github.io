import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const context=vm.createContext({});
vm.runInContext(slice('const CATEGORY_CODES=','const PURPOSE_LABELS=')+slice('function inferUnifiedCategory(','function templatePurpose(')+slice('function clinicHomePreflight(','function updateReadiness('),context);

test('shared dog/cat education uses clinical category, with species shown separately',()=>{
 const item={title:'강아지·고양이 췌장염 퇴원관리',category:'질환'};
 assert.equal(context.inferUnifiedCategory(item),'입원퇴원');
 assert.equal(context.templateSpeciesLabel(item),'강아지·고양이 공용');
 assert.equal(context.inferUnifiedCategory({title:'강아지·고양이 스케일링 수술 후 관리'}),'수술시술');
});
test('explicit category overrides are preserved and species does not come from unrelated prose',()=>{
 assert.equal(context.inferUnifiedCategory({title:'고양이 췌장염 퇴원관리'},'병원제작'),'병원제작');
 assert.equal(context.inferUnifiedCategory({title:'고양이 특화 안내'}),'고양이특화');
 assert.equal(context.templateSpeciesLabel({title:'공통 관리',description:'고양이도 확인'}),'대상 동물 확인');
 assert.equal(context.templateSpeciesLabel({title:'공통 관리',species:['dog','cat']}),'강아지·고양이 공용');
 assert.equal(context.templateSpeciesLabel({title:'고양이 자료',species:'dog'}),'강아지 대상');
});
const base=()=>({authenticated:true,educationReady:true,outputs:['pdf'],medicationValid:true,context:{patientId:'p1',guardianId:'g1',patient:{active:true},homeStatus:'linked'},bound:{patientId:'p1',guardianId:'g1'}});
test('valid form entries alone cannot make HOME ready without a registered patient',()=>{
 const x=base();delete x.context;delete x.bound;
 const result=context.clinicHomePreflight(x);assert.equal(result.ready,false);assert.ok(result.issues.includes('등록 환자 선택 필요'));
});
test('another selected patient or guardian requires correcting the writing context',()=>{
 for(const key of ['patientId','guardianId']){const x=base();x.bound[key]='different';const r=context.clinicHomePreflight(x);assert.equal(r.ready,false);assert.match(r.issues.join(' '),/작성 자료의 환자 확인/);}
});
test('unlinked, invited and unknown HOME states are never reported ready',()=>{
 for(const state of ['not_linked','not_invited','invited','unknown',undefined]){const x=base();x.context.homeStatus=state;assert.equal(context.clinicHomePreflight(x).ready,false);}
});
test('inactive patient and unauthenticated session remain blocked in preflight',()=>{
 const x=base();x.context.patient.active=false;assert.equal(context.clinicHomePreflight(x).ready,false);
 x.context.patient.active=true;x.authenticated=false;assert.equal(context.clinicHomePreflight(x).ready,false);
});
test('unconfirmed education and unsupported download targets do not count as publishable',()=>{
 const x=base();x.educationReady=false;assert.equal(context.clinicHomePreflight(x).ready,false);
 x.educationReady=true;x.outputs=['meds','sms','kakao'];assert.equal(context.clinicHomePreflight(x).ready,false);
 x.outputs=[];assert.equal(context.clinicHomePreflight(x).ready,false);
});
test('a selected check sheet requires valid medication input; supported PDFs pass precheck only',()=>{
 const x=base();x.outputs=['medcheck'];x.medicationValid=false;assert.equal(context.clinicHomePreflight(x).ready,false);
 x.medicationValid=true;assert.equal(context.clinicHomePreflight(x).ready,true);
 x.outputs=['summary','pdf'];assert.equal(context.clinicHomePreflight(x).ready,true);
});
function outputFixture(selected=['pdf'],preview='summary'){
 const nodes=new Map(),cards=[{dataset:{output:'pdf'},classList:{toggle(){}}},{dataset:{output:'summary'},classList:{toggle(){}}}];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}}});return nodes.get(id);};
 const c=vm.createContext({currentOutput:preview,medicationCheckLabel:()=> '투약 체크표',selectedOutputTypes:()=>selected,document:{querySelectorAll:()=>cards},$:node,escapeHtml:x=>String(x),outputSupportsFileFormat:x=>!['sms','kakao'].includes(x),selectedOutputFileFormat:()=> 'pdf',selectedBatchDownloadMode:()=> 'individual',batchModeNeeded:x=>x.length>1||x.includes('mobile4')});
 vm.runInContext(slice('function outputLabel(','function pilotPackageEvents(')+slice('function clinicOutputTargets(','function loadHospital('),c);c.updateSelectedOutputUi();return {c,nodes,node,selected};
}
test('preview switch does not change selected download files and displays both targets',()=>{
 const f=outputFixture();assert.deepEqual(f.selected,['pdf']);
 assert.match(f.node('downloadTargetSummary').textContent,/보호자 PDF/);
 assert.match(f.node('previewTargetSummary').textContent,/퇴원 1P 요약.*미리보기만/);
 assert.match(f.node('secondaryOutputBtn').textContent,/현재 미리보기 인쇄/);
 assert.match(f.node('selectedOutputSummary').innerHTML,/대상은 유지/);
});
test('text output is labelled copy or TXT while mobile four-card print identifies D+1',()=>{
 const f=outputFixture(['sms'],'sms');assert.equal(f.node('generateOutputBtn').textContent,'선택한 문구 복사');
 assert.equal(f.node('secondaryOutputBtn').textContent,'현재 문구 TXT 저장');
 assert.match(f.node('previewTargetSummary').textContent,/문자용 안내 문구/);
 const m=outputFixture(['mobile4'],'mobile4');assert.equal(m.node('secondaryOutputBtn').textContent,'D+1 카드 인쇄 / PDF 저장');
 assert.ok(m.node('previewTargetSummary').textContent.includes('D+1 모바일 카드'));
});
test('no checked output disables download while a preview can still be printed',()=>{
 const f=outputFixture([]);assert.equal(f.node('generateOutputBtn').disabled,true);
 assert.match(f.node('downloadTargetSummary').textContent,/선택한 자료 없음/);
 assert.match(f.node('previewTargetSummary').textContent,/퇴원 1P 요약/);
});

test('readiness rendering separates complete input from missing HOME patient context and refreshes on selection',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},classList:{toggle(){}}});return nodes.get(id);};
 let current;
 const c=vm.createContext({readCaseInfoFromForm(){},validMedications:()=>[],medicationInputWarnings:()=>[],recheckIsoDate:()=> '2026-10-25',recheckLabel:()=> '2026-10-25',hospital:{name:'검수 병원'},caseInfo:{dischargeDate:'2026-10-20',procedure:'검수 진단'},clinicEducationReady:()=>true,medicationCheckMeta:()=>({valid:false,meds:[]}),window:{crmMaterialContext:()=>current,crmCurrentPatient:()=>current},saasMode:'auth',selectedOutputTypes:()=>['pdf'],$:node,escapeHtml:x=>String(x),updateMedicationCheckUi(){},saasHasFeature:()=>true,updatePackageDefaultSummary(){}});
 vm.runInContext(slice('function clinicHomePreflight(','function googleCalendarStorageKey('),c);c.updateReadiness();
 assert.match(node('readinessPanel').innerHTML,/입력 형식 확인 완료/);assert.match(node('readinessPanel').innerHTML,/등록 환자 선택 필요/);assert.ok(!node('readinessPanel').innerHTML.includes('%'));
 current={patientId:'p1',guardianId:'g1',homeStatus:'linked',patient:{active:true}};c.updateReadiness();
 assert.match(node('readinessPanel').innerHTML,/게시창에서 최종 확인/);assert.ok(!node('readinessPanel').innerHTML.includes('등록 환자 선택 필요'));
 current.homeStatus='not_linked';c.updateReadiness();assert.match(node('readinessPanel').innerHTML,/보호자 HOME 연결 필요/);
});
