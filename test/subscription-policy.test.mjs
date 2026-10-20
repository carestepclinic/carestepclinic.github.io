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
 const f=fixture(),d={canManage:true,subscription:{planCode:'BASIC'},messaging:{credit:{includedKrw:0,usedKrw:0,reservedKrw:0,remainingKrw:0,overageGrossKrw:0,extraBudgetKrw:0}}};
 f.ctx.renderMessageCreditBudget(d);const html=f.get('billingOverageSummary').innerHTML;
 assert.match(html,/크레딧 0원/);assert.match(html,/넘는 발송을 차단/);assert.doesNotMatch(html,/무제한/);
});
test('invalid budget does not submit and valid confirmed budget uses the dedicated endpoint',async()=>{
 const f=fixture();f.ctx.renderMessageCreditBudget({canManage:true,subscription:{planCode:'PRO'},messaging:{credit:{includedKrw:20000,extraBudgetKrw:0}}});
 f.get('billingMessageBudget').value='-1';await f.get('billingSaveMessageBudget').onclick();assert.equal(f.requests.length,0);
 f.get('billingMessageBudget').value='1000';await f.get('billingSaveMessageBudget').onclick();
 assert.deepEqual(f.requests,[{path:'/saas/billing/message-budget',body:{extraBudgetKrw:1000,confirmed:true}}]);
});
test('publication limits do not prevent authoring or opening existing material',()=>{
 assert.doesNotMatch(fn('saasPackageAllowed'),/packagesMonthly|usage.*packages/);
 assert.match(fn('renderSubscriptionAccess'),/HOME 신규 게시/);
 assert.match(fn('renderBillingOverview'),/d\.messaging\?\.included/);
});
