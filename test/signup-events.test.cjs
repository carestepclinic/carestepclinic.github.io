const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
const root=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8'),register=index.slice(index.indexOf('let saasRegisterPending='),index.indexOf('async function saasAcceptInvite('));
async function setup(t){
 const p=await browser.newPage();p.setDefaultTimeout(7000);await p.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}):r.abort());await p.goto('http://localhost/');t.after(()=>p.close());
 await p.setContent('<button id="saasRegisterBtn">가입 승인 신청</button>'+['Clinic','Name','Email','Password','Terms','Privacy'].map(k=>'<input id="saasRegister'+k+'" '+(['Terms','Privacy'].includes(k)?'type="checkbox" checked':'value="synthetic-secret"')+'>').join('')+'<input id="saasLoginEmail">');
 await p.addScriptTag({path:path.join(root,'signup-events.js')});await p.addScriptTag({path:path.join(root,'carestep-privacy.js')});
 await p.evaluate(()=>{
  window.$=id=>document.getElementById(id);window.toast=()=>{};window.go=()=>{};window.saasSelectAuth=()=>{};window.saasSaveEndpoint=()=>{};window.saasSetAuthStatus=(m,k)=>window.statusResult={m,k};window.saasFinishAuth=async()=>{};window.posts=[];window.reports=[];window.hold=false;
  window.saasRawRequest=async(url,opt)=>{reports.push({url,body:JSON.parse(opt.body),auth:opt.auth});if(window.reportFail)throw Error('synthetic reporting failure');return {ok:true};};
  window.saasRequest=async(url,opt)=>{
   if(window.preflight){opt=await CarestepPrivacy.prepare(url,opt,{scope:()=>'',request:async()=>{throw Error('private server detail');}});}
   posts.push(JSON.parse(opt.body));if(hold)await new Promise(r=>window.release=r);
   if(window.serverFail)throw Object.assign(Error('private failure details'),{status:400,details:{signupReason:'invalid_input'}});
   return {pending:true,message:'접수 완료'};
  };
 });
 await p.addScriptTag({content:register+';document.getElementById("saasRegisterBtn").onclick=saasRegister;'});return p;
}
test('failed signup reports fixed reason and attempt ID only; reporter failure does not change visible error',async t=>{
 const p=await setup(t);await p.evaluate(()=>{serverFail=true;reportFail=true;});await p.click('#saasRegisterBtn');await p.waitForFunction(()=>reports.length===1);
 const r=await p.evaluate(()=>({reports,posts,statusResult}));assert.deepEqual(Object.keys(r.reports[0].body).sort(),['attemptId','reason']);assert.equal(r.reports[0].body.reason,'invalid_input');assert.equal(r.reports[0].body.attemptId,r.posts[0].attemptId);assert.ok(!JSON.stringify(r.reports).includes('synthetic-secret'));assert.ok(!JSON.stringify(r.reports).includes('private'));assert.equal(r.reports[0].auth,false);assert.equal(r.statusResult.m,'private failure details');assert.equal(await p.locator('#saasRegisterBtn').isDisabled(),false);
});
test('preflight failure is observable even when registration was never sent',async t=>{
 const p=await setup(t);await p.evaluate(()=>preflight=true);await p.click('#saasRegisterBtn');await p.waitForFunction(()=>reports.length===1);assert.equal(await p.evaluate(()=>posts.length),0);assert.equal(await p.evaluate(()=>reports[0].body.reason),'document_unavailable');
});
test('repeat click while pending sends one registration; retry uses new attempt ID',async t=>{
 const p=await setup(t);await p.evaluate(()=>{hold=true;void saasRegister();void saasRegister();});await p.waitForFunction(()=>posts.length===1);assert.equal(await p.locator('#saasRegisterBtn').isDisabled(),true);
 await p.evaluate(()=>{hold=false;release();});await p.waitForFunction(()=>!document.querySelector('#saasRegisterBtn').disabled);await p.click('#saasRegisterBtn');await p.waitForFunction(()=>posts.length===2);assert.notEqual(...await p.evaluate(()=>posts.map(x=>x.attemptId)));assert.equal(await p.evaluate(()=>reports.length),0);
});
test('diagnostic reason does not depend on arbitrary exception content',async t=>{
 const p=await setup(t);const result=await p.evaluate(()=>[CarestepSignupEvents.reason({message:'private email',details:{signupReason:'secret'}}),CarestepSignupEvents.reason({name:'TypeError'}),CarestepSignupEvents.reason({name:'AbortError'})]);assert.deepEqual(result,['request_failed','network','cancelled']);
});

