import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fixture(){
 const nodes=new Map(),focused=[],rendered=[],patient={patientId:'patient-a',guardianId:'guardian-a'};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},hidden:false,focus:()=>focused.push(id),scrollIntoView(){},querySelector:()=>node('medicationName')});return nodes.get(id);};
 const ctx={$:node,window:{crmCurrentPatient:()=>patient},saasSessionMeta:{id:'session-a'},currentWizardStep:5,currentTemplateId:'dental',templates:[{id:'dental',title:'스케일링·발치 후 관리'},{id:'other',title:'다른 교육자료'}],caseInfo:{patientName:'검수 환자',procedure:'스케일링'},medications:[{name:'검수 약'}],readCaseInfoFromForm(){},go:route=>rendered.push(route),updateReadiness(){},renderCurrentOutput:()=>rendered.push('preview'),document:{querySelectorAll:()=>[],querySelector:()=>({scrollTo(){}})}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('var builderEditReturnKey=null;'),html.indexOf('function careTextMatches(')),ctx);return {ctx,node,focused,rendered,patient};
}
test('edit links focus the appropriate wizard input and return to a fresh output preview',()=>{
 for(const [target,step,field] of [['patient',1,'patientName'],['education',1,'templateSearch'],['instructions',2,'caseProcedure'],['medication',3,'medicationName'],['recheck',4,'recheckMode']]){
  const f=fixture(),before=JSON.stringify([f.ctx.caseInfo,f.ctx.medications]);f.ctx.beginBuilderEdit(target);
  assert.equal(f.ctx.currentWizardStep,step);assert.equal(f.focused.at(-1),field);assert.equal(f.node('builderEditReturn').hidden,false);
  assert.equal(JSON.stringify([f.ctx.caseInfo,f.ctx.medications]),before);assert.equal(f.ctx.currentTemplateId,'dental');
  f.ctx.returnToBuilderOutput();assert.equal(f.ctx.currentWizardStep,5);assert.equal(f.node('builderEditReturn').hidden,true);assert.equal(f.rendered.at(-1),'preview');
 }
});
test('context shows actual selected education separately from entered procedure and updates after editing',()=>{
 const f=fixture();f.ctx.renderBuilderContext();assert.equal(f.node('builderContextEducation').textContent,'스케일링·발치 후 관리');assert.equal(f.node('builderContextProcedure').textContent,'스케일링');
 f.ctx.beginBuilderEdit('education');f.ctx.currentTemplateId='other';f.ctx.renderBuilderContext();assert.equal(f.node('builderContextEducation').textContent,'다른 교육자료');assert.equal(f.node('builderEditReturn').hidden,false);
 f.ctx.caseInfo.procedure='';f.ctx.caseInfo.patientName='';f.ctx.renderBuilderContext();assert.equal(f.node('builderContextProcedure').textContent,'미입력');assert.equal(f.node('builderContextPatient').textContent,'환자명 미입력');
});
test('return shortcut is cleared when the patient or login changes',()=>{
 for(const change of [f=>f.patient.patientId='patient-b',f=>f.ctx.saasSessionMeta.id='session-b']){const f=fixture();f.ctx.beginBuilderEdit('medication');change(f);f.ctx.renderBuilderContext();assert.equal(f.node('builderEditReturn').hidden,true);}
});
