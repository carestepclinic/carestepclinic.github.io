import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../hq.html',import.meta.url),'utf8');
const clinic=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function between(a,b){return src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+1));}
test('all inline scripts compile',()=>{
 for(const match of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1]);
});
test('integrated HQ uses its own endpoint and authentication, with working navigation',()=>{
 assert.match(src,/ENDPOINT_KEY='carestep_hq_endpoint_v20261020'/);
 assert.match(src,/X-CARESTEP-HQ-SESSION/);
 assert.doesNotMatch(src,/carestep_ai_endpoint_v62/);
 assert.match(src,/\$\('endpoint'\)\.value=localStorage\.getItem\(ENDPOINT_KEY\)\|\|'https:\/\/carestep-ai-api\.kk04sdw\.workers\.dev'/);
 assert.match(src,/href="https:\/\/medisanimalhospital\.github\.io\/carestep-clinic-pages\/hq-partners\.html"/);
 assert.doesNotMatch(src,/href="\.\/hq-partners\.html"|location\.href='hq-partners\.html'/);
 assert.match(clinic,/id="operatorHqBillingLink"[^>]+href="\.\/hq\.html#billing"/);
 assert.match(src,/id="returnToClinic"[^>]+href="\.\/"/);
});
function fixture(){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',textContent:''});return nodes.get(id);};
 const requests=[],notices=[],ctx=vm.createContext({$:get,document:{querySelectorAll:()=>[]},esc:s=>String(s??''),fmt:n=>String(n||0),money:n=>Number(n||0).toLocaleString('ko-KR')+'원',date:x=>x,hqButtonTask:async(_b,_l,_s,fn)=>fn(),req:async(path,o)=>requests.push({path,body:JSON.parse(o.body)}),loadBilling:async()=>{},toast:x=>notices.push(x),plans:[{planCode:'BASIC',displayName:'BASIC',monthlyPriceKrw:79000,annualPriceKrw:790000,features:{carestepHome:true,homePush:true,homeConsultation:true},limits:{members:5,packagesMonthly:500,messageCreditKrw:0},isActive:true}],featureNames:{homePush:'HOME 앱 푸시',homeConsultation:'HOME 병원 상담',carestepHome:'CARESTEP HOME 연결'}});
 vm.runInContext(between('function planHint(','function renderSubscriptions('),ctx);
 return {ctx,get,requests,notices};
}
test('HQ plan card distinguishes VAT, credits and publications and retains basic HOME features',()=>{
 const f=fixture();f.ctx.renderPlans();const html=f.get('planGrid').innerHTML;
 assert.match(html,/86,900원/);assert.match(html,/HOME 신규 자료 게시/);assert.match(html,/문자 0원은 포함 크레딧 없음/);
 assert.match(html,/data-feature="homePush" checked disabled/);assert.doesNotMatch(html,/월 메시지.*무제한/);
});
test('HQ invalid plan inputs do not write; valid inputs send credit instead of message count',async()=>{
 const f=fixture(),values={monthly:'79000',annual:'790000',founding:'59000',members:'5',packages:'500',credit:'-1'};
 const card={dataset:{plan:'BASIC'},querySelectorAll:()=>[],querySelector:s=>s==='.active-plan'?{checked:true}:s==='.save-plan'?{}:{value:values[s.slice(1)]}};
 await f.ctx.savePlan(card);assert.equal(f.requests.length,0);
 values.credit='0';await f.ctx.savePlan(card);assert.equal(f.requests.length,1);
 assert.deepEqual(f.requests[0].body.limits,{members:5,packagesMonthly:500,messageCreditKrw:0});
});
test('HQ usage table uses money for credit plans and counts for legacy plans',()=>{
 const f=fixture();
 f.ctx.messagingRates={};f.ctx.messagingBilling={totals:{},rows:[{clinicId:'new',clinicName:'Synthetic',planCode:'BASIC',credit:{usedKrw:45,includedKrw:0,availableKrw:955,reservedKrw:0,extraBudgetKrw:1000,pending:0,overageGrossKrw:50}}]};
 vm.runInContext(between('function renderUsageBilling(','function renderMonthlyOperationsReportsHQ('),f.ctx);
 f.ctx.renderUsageBilling();const html=f.get('messagingBillingTable').innerHTML;
 assert.match(html,/확정 사용 45원/);assert.match(html,/추가 예산 1,000원/);assert.doesNotMatch(html,/∞/);
});
