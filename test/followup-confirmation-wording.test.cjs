const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture(){
 const nodes=[],calls=[];
 const createElement=tag=>{const node={tag,textContent:'',children:[],append(...items){this.children.push(...items);},addEventListener(){},showModal(){},close(){this.closed=true;},remove(){}};nodes.push(node);return node;};
 const stage={clinicId:'c',case:{caseKey:'case',patientId:'p',status:'active',revision:1},contractSHA256:'A'.repeat(64),requiredStages:[1,3],confirmedStages:[]};
 const ctx={document:{createElement,body:createElement('body')},saasMode:'auth',saasMe:{clinic:{id:'c'},user:{id:'u'}},saasSessionMeta:{id:'s'},followupCaseNonce:'nonce',crypto:{randomUUID:()=> 'request'},confirm:()=>true,followupResetAfterConfirmed(){},crmCurrentPatient:()=>({patientId:'p'}),saasRequest:async(path,options={})=>{calls.push({path,method:options.method||'GET'});if(options.method==='POST')throw Error('network unavailable');if(path==='/saas/r61/config')return {flags:{followup_auto_completion:true}};if(path==='/saas/followup/cases?patientId=p')return {items:[{patientId:'p',status:'active',caseKey:'case',startDate:'2026-10-31'}]};return stage;}};
 ctx.window=ctx;vm.runInNewContext(fs.readFileSync('r83-clinic.js','utf8'),ctx);return {ctx,nodes,calls};
}
test('uncertain completion directs staff to read status without a repeated write',async()=>{
 const {ctx,nodes,calls}=fixture();await ctx.r83OpenRequiredStages();
 const save=nodes.find(n=>n.textContent==='D+1 해당 일차 관리 완료 확인');assert.ok(save);
 await save.onclick();assert.ok(nodes.some(n=>n.textContent.includes('저장 여부 확인이 필요합니다.')));
 assert.equal(save.disabled,true);
 await nodes.find(n=>n.textContent==='D+1 저장 여부 확인').onclick();
 assert.equal(calls.filter(c=>c.method==='POST').length,1);
 assert.ok(calls.at(-1).path.includes('idempotencyKey='));
 assert.ok(nodes.some(n=>n.textContent.includes('완료 기록이 확인되지 않았습니다.')));
});
test('changed patient prevents write and asks to reopen the confirmation window',async()=>{
 const {ctx,nodes,calls}=fixture();await ctx.r83OpenRequiredStages();ctx.crmCurrentPatient=()=>({patientId:'other'});
 await nodes.find(n=>n.textContent==='D+1 해당 일차 관리 완료 확인').onclick();
 assert.equal(calls.filter(c=>c.method==='POST').length,0);
 assert.ok(nodes.some(n=>n.textContent.includes('창을 닫고 다시 열어주세요.')));
});
