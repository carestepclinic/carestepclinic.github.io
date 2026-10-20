import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const care=readFileSync(new URL('../clinic-care.js',import.meta.url),'utf8');
const timeline=readFileSync(new URL('../patient-timeline.js',import.meta.url),'utf8');
function slice(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'source boundaries exist');return source.slice(a,b);}

function drafts(){
 const fields={retainDraft:{checked:true},timeRestricted:{checked:false},start:{value:'2026-10-20'},firstDoseTime:{value:'20:00'},interval:{value:'1'}};
 const buttons={},storage=new Map(),memory=new Map(),status={},overview={};
 let accepted=true,storageFails=false;
 const c=vm.createContext({draftReady:true,registered:false,auth:'test-patient',overviewScope:'test-patient',patientScope:()=> 'test-patient',valid:()=>true,editor:{get:()=>({name:'검증용 약',times:'08:00,20:00',duration:'3'})},field:k=>fields[k],medicationDrafts:memory,draftStorageKey:'test-draft',sessionStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>{if(storageFails)throw Error('storage denied');storage.delete(k);}},document:{querySelector:()=>overview},mount:{querySelector:()=>null},paintDraftStatus:m=>{status.draft=m;},status,saving:false,checking:false,confirm:()=>accepted,dialog:{open:true,querySelector:s=>buttons[s]??={},close(){this.open=false;},remove(){this.removed=true;}}});
 vm.runInContext(care.split('\n').find(l=>l.includes('function rememberDraft(){')),c);
 vm.runInContext(slice(care,'dialog.requestCareClose=','field(\'retainDraft\').onchange=rememberDraft;'),c);
 c.rememberDraft();
 return {c,fields,buttons,storage,memory,status,accept:v=>accepted=v,failStorage:()=>storageFails=true};
}
test('turning off refresh recovery preserves current input but removes persisted restoration',()=>{
 const f=drafts();assert.equal(f.storage.size,1);
 f.buttons['[data-delete-draft]'].onclick();
 assert.equal(f.storage.size,0);assert.equal(f.memory.size,1);assert.equal(f.fields.retainDraft.checked,false);
 assert.equal(f.memory.get('test-patient').expiresAt,undefined);
 f.c.dialog.requestCareClose();
 assert.equal(f.storage.size,0);assert.equal(f.memory.size,1);assert.equal(f.c.dialog.open,false);
});
test('discard removes both draft stores and the closed dialog cannot recreate discarded input',()=>{
 const f=drafts();f.buttons['[data-discard-draft]'].onclick();
 assert.equal(f.memory.size,0);assert.equal(f.storage.size,0);assert.equal(f.c.dialog.removed,true);
 assert.equal(f.c.draftReady,false);f.c.dialog.requestCareClose();
 assert.equal(f.memory.size,0);assert.equal(f.storage.size,0);
});
test('canceling discard preserves draft, editor and dialog',()=>{
 const f=drafts();f.accept(false);f.buttons['[data-discard-draft]'].onclick();
 assert.equal(f.memory.size,1);assert.equal(f.storage.size,1);assert.equal(f.c.dialog.open,true);assert.equal(f.c.dialog.removed,undefined);
});
test('saving or checking a registration blocks draft disposal',()=>{
 for(const key of ['saving','checking']){const f=drafts();f.c[key]=true;
 f.buttons['[data-delete-draft]'].onclick();f.buttons['[data-discard-draft]'].onclick();
 assert.equal(f.storage.size,1);assert.equal(f.memory.size,1);assert.equal(f.c.dialog.open,true);}
});
test('storage deletion failure preserves input and does not claim successful disposal',()=>{
 const f=drafts();f.failStorage();f.buttons['[data-discard-draft]'].onclick();
 assert.equal(f.memory.size,1);assert.equal(f.c.dialog.open,true);assert.match(f.status.draft,/삭제 실패.*입력은 유지/);
});
test('reopening the same patient retains record type while another patient resets the filter',async()=>{
 const state={patient:{id:'p1'},guardian:{id:'g1'},filter:'weight'};
 let reads=0;const c=vm.createContext({state,loadProtocol:async()=>{},load:()=>reads++,setTimeout:()=>{},$:()=>null});
 vm.runInContext(slice(timeline,'function open(patient,guardian){','  async function openNew('),c);
 c.open({id:'p1'},{id:'g1'});await Promise.resolve();assert.equal(state.filter,'weight');assert.equal(reads,1);
 c.open({id:'p2'},{id:'g1'});await Promise.resolve();assert.equal(state.filter,'clinical');assert.equal(reads,2);
});
function copyPurpose(accepted,mayPublish=true){
 const nodes={crmTimelineType:{value:'visit'},crmTimelineDetail:{value:'검증용 내부 메모'},crmTimelineHomeNote:{value:'기존 공개 안내',focus(){}},crmTimelineHomeVisible:{checked:false},crmTimelineHomeNoteLabel:{},crmTimelineCopyPurpose:{},crmTimelineStatusMessage:{}};
 const prompts=[],c=vm.createContext({$:id=>nodes[id],saasPermission:()=>mayPublish,confirm:m=>{prompts.push(m);return accepted;},state:{dirty:false},document:{querySelector:()=>null}});
 vm.runInContext(timeline.split('\n').find(l=>l.includes('function syncHomeVisibility(){')),c);
 c.syncHomeVisibility();nodes.crmTimelineCopyPurpose.onclick();return {nodes,prompts,c};
}
test('memo copy describes the public destination, cancellation preserves the public note',()=>{
 const f=copyPurpose(false);assert.match(f.prompts[0],/내부 메모를 보호자 공개용 안내에 복사/);
 assert.equal(f.nodes.crmTimelineHomeNote.value,'기존 공개 안내');assert.equal(f.nodes.crmTimelineHomeVisible.checked,false);assert.equal(f.c.state.dirty,false);
});
test('confirmed memo copy changes only the draft public note and respects publishing permissions',()=>{
 const f=copyPurpose(true);assert.equal(f.nodes.crmTimelineHomeNote.value,'검증용 내부 메모');assert.equal(f.nodes.crmTimelineDetail.value,'검증용 내부 메모');
 assert.equal(f.nodes.crmTimelineHomeVisible.checked,true);assert.match(f.nodes.crmTimelineStatusMessage.textContent,/저장 전까지 공개되지 않습니다/);
 const denied=copyPurpose(true,false);assert.equal(denied.nodes.crmTimelineHomeVisible.checked,false);assert.equal(denied.nodes.crmTimelineHomeVisible.disabled,true);
});
