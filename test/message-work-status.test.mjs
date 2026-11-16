import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const today='2026-11-16';
const job=(status,extra={})=>({id:status,sourceType:'message',sourceChannel:'mms',status,operationalStatus:status==='failed'?'failed':status==='sent'?'sent':'scheduled',dueDate:today,patientName:'시험 환자',action:{status:status==='failed'?'open':'none'},...extra});
function fixture(){
 const calls=[],prompts=[],notices=[];
 const c=vm.createContext({CarestepStabilization:{today:()=>today,dateKey:x=>x,visibleHome:()=>true},careOperationsActions:[],followupScheduleRows:[],careNotificationPreferences:{},localTodayIso:()=>today,window:{},escapeHtml:x=>String(x??''),workFirstCleanupCandidates:()=>[],careAssigneeOptions:()=>'',confirm:x=>{prompts.push(x);return true;},toast:x=>notices.push(x),saasRequest:async(path,options)=>{calls.push({path,options});return {ok:true};},workFirstRequestAdvance(){},careSignalOperationsChanged(){},loadFollowupScheduleBoard:async()=>true});
 for(const [start,end] of [
  ['function scheduleBoardChannelLabel(', 'function scheduleBoardRowsFiltered('],
  ['function scheduleBoardDateLabel(', 'function scheduleBoardStatusClass('],
  ['function careNotificationType(', 'function careWithinNotificationHours('],
  ['function careNotificationGroups(', 'function paintCareNotificationPreferences('],
  ['function workFirstBuckets(){','function workFirstRequestAdvance('],
  ['async function workFirstRetryMessage(', "window.addEventListener('carestep:quick-record-saved'"],
  ['function renderWorkFirstRows(', 'function renderWorkFirstDashboard('],
  ['function messagingStatusLabel(', '\nfunction ']
 ])vm.runInContext(between(start,end),c);
 const list={innerHTML:'',querySelectorAll:()=>[]};
 return {c,calls,prompts,notices,list};
}

test('today completed and queued external jobs are not actionable failures or unassigned work',()=>{
 const f=fixture();f.c.followupScheduleRows=['sent','delivered','scheduled','provider_pending','sending','canceled','cancelled','completed','expired','unknown',''].map(s=>job(s));
 const before=JSON.stringify(f.c.followupScheduleRows),b=f.c.workFirstBuckets();
 for(const rows of Object.values(b))assert.equal(rows.length,0);
 assert.equal(JSON.stringify(f.c.followupScheduleRows),before,'history and schedule data stay intact');
});

test('only open failures are actionable, with historical failures kept in backlog',()=>{
 const f=fixture(),failed=job('failed',{id:'today-failure'});
 f.c.careOperationsActions=[failed,job('failed',{id:'past-failure',dueDate:'2026-11-15'}),job('failed',{id:'future-failure',dueDate:'2026-11-18'}),job('failed',{id:'ack',failureAcknowledgedAt:today}),job('failed',{id:'resolved',action:{status:'resolved'}})];
 f.c.followupScheduleRows=[failed,job('sent')];const b=f.c.workFirstBuckets();
 assert.deepEqual(Array.from(b.all,x=>x.id),['today-failure']);
 assert.deepEqual(Array.from(b.delivery,x=>x.id),['today-failure']);
 assert.deepEqual(Array.from(b.backlog,x=>x.id),['past-failure']);
});

test('fresh nonfailed schedule state suppresses stale failed action duplicates',()=>{
 const f=fixture();f.c.careOperationsActions=[job('failed',{id:'same'})];
 for(const status of ['sent','scheduled','sending','canceled']){
  f.c.followupScheduleRows=[job(status,{id:'same'})];assert.equal(f.c.workFirstBuckets().all.length,0);
 }
});

test('HOME unread/failed, clinical tasks and visits remain independent of external message filtering',()=>{
 const f=fixture();f.c.followupScheduleRows=[
  {id:'unread',sourceType:'home',operationalStatus:'overdue',dueDate:today},
  {id:'push',sourceType:'home',operationalStatus:'failed',dueDate:today},
  {id:'task',sourceType:'internal',operationalStatus:'scheduled',dueDate:today},
  {id:'visit',sourceType:'visit',operationalStatus:'scheduled',dueDate:today},
  {id:'vaccine',sourceType:'vaccination',operationalStatus:'scheduled',dueDate:today},job('sent')];
 const b=f.c.workFirstBuckets();assert.equal(b.all.length,5);assert.equal(b.care.length,4);assert.equal(b.preventive.length,1);
 assert.deepEqual(Array.from(b.delivery,x=>x.id),['unread','push']);
});

test('external status labels distinguish success, scheduling, progress and failure',()=>{
 const f=fixture();for(const [status,label] of [['sent','발송 완료'],['delivered','전달 완료'],['scheduled','예약됨'],['provider_pending','발송사 접수'],['sending','발송 중'],['failed','발송 실패 확인'],['canceled','예약 취소'],['unknown','상태 확인 필요']])assert.equal(f.c.workFirstReason(job(status)),label);
 assert.equal(f.c.workFirstReason(job('sent',{operationalStatus:'failed'})),'발송 완료');
});

test('retry buttons only render for unacknowledged failed messages and use their real channel',()=>{
 const f=fixture();for(const status of ['sent','delivered','scheduled','provider_pending','sending','failed','unknown']){
  f.c.renderWorkFirstRows(f.list,[job(status)],12);
  assert.equal(f.list.innerHTML.includes('data-work-retry'),status==='failed');
  assert.match(f.list.innerHTML,/<span>MMS<\/span>/);assert.doesNotMatch(f.list.innerHTML,/>MESSAGE</);
 }
 f.c.renderWorkFirstRows(f.list,[job('failed',{failureAcknowledgedAt:today})],12);assert.doesNotMatch(f.list.innerHTML,/data-work-retry/);
});

test('direct retry of nonfailed or acknowledged jobs cannot confirm or issue a request',async()=>{
 const f=fixture();for(const row of [null,job('sent'),job('scheduled'),job('sending'),job('failed',{failureAcknowledgedAt:today}),job('failed',{action:{status:'resolved'}}),job('failed',{sourceType:'home'})])await f.c.workFirstRetryMessage(row);
 assert.equal(f.calls.length,0);assert.equal(f.prompts.length,0);
});

test('genuine failed retry still requires confirmation and makes one request only after approval',async()=>{
 const f=fixture(),row=job('failed',{id:'failed-id',external:{recipientLast4:'1234'}});
 f.c.confirm=()=>false;await f.c.workFirstRetryMessage(row);assert.equal(f.calls.length,0);
 f.c.confirm=x=>{f.prompts.push(x);return true;};await f.c.workFirstRetryMessage(row);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/saas/followup/messages/failed-id/quick-retry');assert.equal(f.calls[0].options.method,'POST');assert.match(f.prompts[0],/1234.*MMS.*재시도/);
});

test('notification groups exclude successful/queued/acknowledged external jobs but retain real failures',()=>{
 const f=fixture();f.c.careOperationsActions=[job('sent'),job('scheduled'),job('failed',{id:'ack',failureAcknowledgedAt:today}),job('failed'),{id:'consult',sourceType:'home',responseCode:'concern',dueDate:today}];
 assert.deepEqual(Array.from(f.c.careNotificationGroups()).flatMap(g=>Array.from(g.items,x=>x.id)),['failed','consult']);
 f.c.careNotificationPreferences.delivery=false;assert.deepEqual(Array.from(f.c.careNotificationGroups()).flatMap(g=>Array.from(g.items,x=>x.id)),['consult']);
});
