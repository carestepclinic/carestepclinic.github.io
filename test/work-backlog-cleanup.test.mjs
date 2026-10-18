import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=index.slice(index.indexOf('let workFirstCleanupBusy='),index.indexOf('let workFirstBacklogLimit='));
const failed=(id,extra={})=>({id,sourceType:'message',status:'failed',operationalStatus:'failed',dueDate:'2026-10-03',patientName:'검수 환자',title:'D+1 외부 후속관리',...extra});
function fixture(){
 const feedback={},buttons=[{},{}],calls=[],confirmations=[];
 const c=vm.createContext({saasMode:'auth',saasToken:'token',saasMe:{clinic:{id:'c'},user:{id:'u'}},saasSessionMeta:{id:'s'},CarestepStabilization:{today:()=> '2026-10-18',dateKey:x=>x},careOperationsActions:[],followupScheduleRows:[],document:{querySelectorAll:()=>buttons},$:()=>feedback,confirm:message=>{confirmations.push(message);return true;},saasRequest:async(path,opt)=>{calls.push({path,opt});return {ok:true,id:decodeURIComponent(path.split('/').at(-2)),failureAcknowledgedAt:'2026-10-18T03:00:00Z'};},loadFollowupScheduleBoard:async()=>true,renderWorkFirstDashboard(){},careSignalOperationsChanged(){}});
 vm.runInContext(source,c);return {c,feedback,buttons,calls,confirmations};
}
test('cleanup targets only unique past failed external jobs, excluding today, future, acknowledged and clinical tasks',()=>{
 const {c}=fixture(),rows=[failed('old'),failed('old'),failed('today',{dueDate:'2026-10-18'}),failed('future',{dueDate:'2026-10-19'}),failed('empty',{dueDate:''}),failed('home',{sourceType:'home'}),failed('vaccine',{sourceType:'vaccination'}),failed('pending',{status:'sending',operationalStatus:'scheduled'}),failed('seen',{failureAcknowledgedAt:'2026-10-04'}),failed('done',{action:{status:'resolved'}})];
 assert.deepEqual(Array.from(c.workFirstCleanupCandidates(rows),x=>x.id),['old']);
});
test('confirmation sends only acknowledgment requests and preserves failure data',async()=>{
 const f=fixture(),rows=[failed('a'),failed('b')],before=JSON.stringify(rows);await f.c.workFirstAcknowledgeMessages(rows);
 assert.equal(f.calls.length,2);assert.ok(f.calls.every(x=>x.path.endsWith('/ack')&&x.opt.method==='POST'));
 assert.match(f.confirmations[0],/실패 2건.*확인 후 정리/s);assert.match(f.confirmations[0],/문자 재발송이나 발송 성공 처리는 하지 않습니다/);
 assert.equal(JSON.stringify(rows),before);assert.match(f.feedback.textContent,/2건 확인 처리 완료.*실패 이력 보존.*문자 재발송 없음/);assert.ok(f.buttons.every(x=>x.disabled===false));
});
test('cancel or changed session at confirmation sends no request',async()=>{
 for(const change of [false,true]){const f=fixture();f.c.confirm=()=>{if(change)f.c.saasToken='other';return change;};await f.c.workFirstAcknowledgeMessages([failed('a')]);assert.equal(f.calls.length,0);}
});
test('response loss stops the batch, reports partial completion and never retries or sends messages',async()=>{
 const f=fixture();f.c.saasRequest=async(path,opt)=>{f.calls.push({path,opt});if(f.calls.length===2)throw Error('lost response');return {ok:true,id:'a',failureAcknowledgedAt:'now'};};await f.c.workFirstAcknowledgeMessages([failed('a'),failed('b'),failed('c')]);
 assert.equal(f.calls.length,2);assert.match(f.feedback.textContent,/1건 확인 처리 완료/);assert.match(f.feedback.textContent,/처리 결과를 확인하지 못했습니다/);assert.match(f.feedback.textContent,/나머지 1건은 처리하지 않았습니다/);assert.doesNotMatch(JSON.stringify(f.calls),/retry|cancel|DELETE/);
});
test('unconfirmed response never counts as cleanup success',async()=>{
 for(const result of [{ok:true},{ok:true,id:'wrong',failureAcknowledgedAt:'now'},{ok:false,id:'a',failureAcknowledgedAt:'now'}]){const f=fixture();f.c.saasRequest=async()=>result;await f.c.workFirstAcknowledgeMessages([failed('a')]);assert.match(f.feedback.textContent,/0건 확인 처리 완료/);assert.match(f.feedback.textContent,/결과를 확인하지 못했습니다/);}
});
test('duplicate clicks are blocked and session changes stop remaining acknowledgments',async()=>{
 const f=fixture();let release;f.c.saasRequest=(path,opt)=>{f.calls.push({path,opt});return new Promise(r=>release=r);};const first=f.c.workFirstAcknowledgeMessages([failed('a'),failed('b')]);await f.c.workFirstAcknowledgeMessages([failed('a')]);assert.equal(f.calls.length,1);f.c.saasSessionMeta.id='new';release({ok:true,id:'a',failureAcknowledgedAt:'now'});await first;assert.equal(f.calls.length,1);assert.doesNotMatch(f.feedback.textContent,/확인 처리 완료/);
});
test('failed list refresh preserves old rows instead of claiming an empty inbox',async()=>{
 const f=fixture(),rows=[failed('a')];f.c.careOperationsActions=rows;f.c.followupScheduleRows=rows;f.c.loadFollowupScheduleBoard=async()=>{f.c.careOperationsActions=[];f.c.followupScheduleRows=[];return false;};await f.c.workFirstAcknowledgeMessages(rows);assert.equal(f.c.careOperationsActions,rows);assert.equal(f.c.followupScheduleRows,rows);assert.match(f.feedback.textContent,/목록 조회에 실패해 이전 목록/);
});
