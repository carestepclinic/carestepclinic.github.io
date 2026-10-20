import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(src),rest=src.slice(m.index+1),end=rest.search(/^(?:async )?function /m);return src.slice(m.index,m.index+1+end);}
function fixture(){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false});return nodes.get(id);};
 const messages=[],requests=[],ctx=vm.createContext({$:get,billingMoney:x=>Number(x).toLocaleString('ko-KR')+'원',toast:m=>messages.push(m),confirm:()=>true,saasRequest:async(path,o)=>requests.push({path,body:JSON.parse(o.body)}),loadBillingOverview:async()=>{},billingOverviewState:{plans:{PRO:{monthlyTotalKrw:185900,annualTotalKrw:1859000}},subscription:{planCode:'PILOT',billingCycle:'monthly'}}});
 vm.runInContext([fn('billingSelectedPlanInfo'),fn('updateBillingPlanPrice'),fn('renderMessageCreditBudget')].join('\n'),ctx);
 get('billingPlanSelect').value='PRO';get('billingCycleSelect').value='monthly';
 return {ctx,get,messages,requests};
}
test('new quotes use the server VAT-inclusive amount; legacy contracts retain actual charge',()=>{
 const f=fixture();assert.equal(f.ctx.billingSelectedPlanInfo().price,185900);
 f.ctx.billingOverviewState.subscription={planCode:'PRO',billingCycle:'monthly',commercialVersion:'legacy',effectivePriceKrw:169000};
 f.ctx.updateBillingPlanPrice();assert.match(f.get('billingPlanPrice').textContent,/169,000원.*기존 계약 조건 유지/);
 f.get('billingCycleSelect').value='annual';assert.equal(f.ctx.billingSelectedPlanInfo().price,1859000);
});
test('a zero-credit plan explains no included allowance, not unlimited messaging',()=>{
 const f=fixture(),d={messageBillingMode:'central',canManage:true,subscription:{planCode:'BASIC'},messaging:{credit:{includedKrw:0,usedKrw:0,reservedKrw:0,remainingKrw:0,overageGrossKrw:0,extraBudgetKrw:0}}};
 f.ctx.renderMessageCreditBudget(d);const html=f.get('billingOverageSummary').innerHTML;
 assert.match(html,/크레딧 0원/);assert.match(html,/넘는 발송을 차단/);assert.doesNotMatch(html,/무제한/);
});
test('invalid budget does not submit and valid confirmed budget uses the dedicated endpoint',async()=>{
 const f=fixture();f.ctx.renderMessageCreditBudget({messageBillingMode:'central',canManage:true,subscription:{planCode:'PRO'},messaging:{credit:{includedKrw:20000,extraBudgetKrw:0}}});
 f.get('billingMessageBudget').value='-1';await f.get('billingSaveMessageBudget').onclick();assert.equal(f.requests.length,0);
 f.get('billingMessageBudget').value='1000';await f.get('billingSaveMessageBudget').onclick();
 assert.deepEqual(f.requests,[{path:'/saas/billing/message-budget',body:{extraBudgetKrw:1000,confirmed:true}}]);
});

test('direct SOLAPI billing never offers a CARESTEP credit amount, cap or budget editor',()=>{
 const f=fixture();
 f.ctx.renderMessageCreditBudget({messageBillingMode:'direct',canManage:true,subscription:{planCode:'PRO'},messaging:{credit:{includedKrw:20000,usedKrw:0,extraBudgetKrw:0}}});
 const html=f.get('billingOverageSummary').innerHTML;
 assert.match(html,/병원 SOLAPI 직접 결제/);assert.match(html,/적용되지 않습니다/);
 assert.doesNotMatch(html,/20,000원|billingMessageBudget|발송을 차단/);
 assert.equal(f.get('billingCentralHistory').open,false);
 assert.equal(f.requests.length,0);
});

test('unknown connection does not assume central billing and offers a read-only retry',async()=>{
 const f=fixture();let loads=0;f.ctx.loadBillingOverview=async()=>{loads++;};
 f.ctx.renderMessageCreditBudget({messageBillingMode:'unknown',messaging:{credit:{includedKrw:0}}});
 assert.match(f.get('billingOverageSummary').innerHTML,/결제 방식 확인 필요/);
 assert.doesNotMatch(f.get('billingOverageSummary').innerHTML,/billingMessageBudget|발송을 차단/);
 await f.get('billingMessagingRetry').onclick();assert.equal(loads,1);assert.equal(f.requests.length,0);
});

test('mode classification requires connected OAuth or an explicitly approved central sender',()=>{
 const c=vm.createContext({});vm.runInContext(fn('billingMessageMode'),c);
 assert.equal(c.billingMessageMode({solapiOauth:{connected:true},sender:{source:'legacy',status:'approved'}}),'direct');
 assert.equal(c.billingMessageMode({solapiOauth:{connected:false,status:'error'},sender:{source:'legacy',status:'approved'}}),'unknown');
 assert.equal(c.billingMessageMode({solapiOauth:{connected:false},sender:{source:'legacy',status:'approved'}}),'central');
 assert.equal(c.billingMessageMode({sender:{source:'legacy',status:'not_requested'}}),'unknown');
 assert.equal(c.billingMessageMode(null),'unknown');
});

test('billing loader tolerates connection failure, ignores stale results and performs only reads',async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);};
 const calls=[],pending=[];
 const c=vm.createContext({$:get,saasMode:'auth',saasMe:{clinic:{id:'A'}},billingOverviewSequence:0,billingOverviewState:null,
  clinicReadScope:()=>c.scope,scope:'A',renderBillingOverview:()=>{},renderMessageCreditBudget:()=>{},toast:()=>{},
  saasRequest:(path,options)=>{calls.push({path,options});return new Promise((resolve,reject)=>pending.push({path,resolve,reject}));}
 });
 vm.runInContext(fn('billingMessageMode')+'\n'+fn('loadBillingOverview'),c);
 const first=c.loadBillingOverview(),second=c.loadBillingOverview();
 pending[2].resolve({subscription:{planCode:'PRO'}});pending[3].reject(Error('connection unavailable'));await second;
 assert.equal(c.billingOverviewState.messageBillingMode,'unknown');
 pending[0].resolve({subscription:{planCode:'BASIC'}});pending[1].resolve({onboarding:{solapiOauth:{connected:true}}});await first;
 assert.equal(c.billingOverviewState.subscription.planCode,'PRO');
 const third=c.loadBillingOverview();c.scope='B';
 pending[4].resolve({subscription:{planCode:'BASIC'}});pending[5].resolve({onboarding:{solapiOauth:{connected:true}}});await third;
 assert.equal(c.billingOverviewState.subscription.planCode,'PRO');
 assert.ok(calls.every(x=>x.options.method==='GET'));
});
test('publication limits do not prevent authoring or opening existing material',()=>{
 assert.doesNotMatch(fn('saasPackageAllowed'),/packagesMonthly|usage.*packages/);
 assert.match(fn('renderSubscriptionAccess'),/HOME 신규 게시/);
 assert.match(fn('renderBillingOverview'),/d\.messaging\?\.included/);
});
