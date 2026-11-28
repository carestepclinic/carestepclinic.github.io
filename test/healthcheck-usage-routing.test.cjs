const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(()=>browser?.close());
const {setup,start}=require('./helpers/healthcheck-ui.cjs')(()=>browser);
for(const width of [1440,390])test('healthcheck usage and dialog use exactly one SaaS prefix and preserve edits '+width,async t=>{
 const {p,errors}=await setup(width);t.after(()=>p.close());await start(p);
 await p.addScriptTag({path:path.resolve(__dirname,'../subscription-resources.js')});
 await p.addStyleTag({path:path.resolve(__dirname,'../subscription-resources.css')});
 await p.evaluate(()=>{
  view.dispose();window.usageCalls=[];window.usageFail=false;
  const result={ok:true,legacy:true,month:'2026-11',planCode:'ENTERPRISE',policy:{aiMode:'unlimited',storageMode:'unlimited'},ai:{used:0,reserved:0,limit:null,remaining:null},storage:{bytes:0,objects:0,limitGb:null,legacyUnmetered:true},credits:{remaining:0},staff:[],requests:[],record:{charged:false}};
  const request=async(path,options={})=>{
   const url='/saas'+path;usageCalls.push({url,method:options.method||'GET'});
   if(url.startsWith('/saas/resources/purchases'))return {ok:true,provider:{configured:false,testMode:true},eligible:false,credits:{remaining:0},policy:{enabled:false,unitPriceKrw:5000},orders:[]};
   if(url==='/saas/resources'||url==='/saas/resources?recordId=record-1'){if(usageFail)throw Error('가상 통신 오류');return result;}
   if(url==='/saas/saas/resources'||url.startsWith('/saas/saas/'))throw Error('잘못된 조회 주소');
   if(url.startsWith('/saas/practice/clinical/cases/record-1?'))return {item:structuredClone(stored)};
   if(url.endsWith('/members'))return {members:[]};
   return {items:[]};
  };
  window.view=HealthcheckRecord.mount(document.querySelector('#root'),{request,identity:()=>identity,ready:()=>true,can:()=>true});
  return view.openRecord('record-1');
 });
 const tab=p.locator('[data-step=summary]');if(await tab.isVisible())await tab.click();else await p.locator('[data-compact-nav]').selectOption('summary');
 await p.locator('[data-r-record-open]').waitFor();
 assert.match(await p.locator('.resource-ai-inline').innerText(),/기존 계약 제공 조건/);
 await p.locator('[data-prose=management]').fill('저장 전 관리계획 유지');
 const before=await p.evaluate(()=>JSON.stringify(stored));
 await p.locator('[data-r-record-open]').click();await p.getByText('AI·저장 공간 이용현황',{exact:true}).waitFor();
 await p.locator('[data-r-close]').click();
 assert.equal(await p.locator('[data-prose=management]').inputValue(),'저장 전 관리계획 유지');
 await p.evaluate(()=>usageFail=true);await p.locator('[data-r-record-reload]').click();await p.getByRole('button',{name:'다시 확인',exact:true}).waitFor();
 await p.evaluate(()=>usageFail=false);await p.getByRole('button',{name:'다시 확인',exact:true}).click();await p.locator('[data-r-record-open]').waitFor();
 assert.equal(await p.locator('[data-prose=management]').inputValue(),'저장 전 관리계획 유지');
 assert.equal(await p.evaluate(()=>JSON.stringify(stored)),before);
 const calls=await p.evaluate(()=>usageCalls);assert.ok(calls.some(c=>c.url==='/saas/resources?recordId=record-1'));assert.ok(calls.some(c=>c.url==='/saas/resources'));assert.ok(calls.some(c=>c.url==='/saas/resources/purchases'));assert.ok(calls.every(c=>c.method==='GET'&&!c.url.includes('/saas/saas/')));assert.deepEqual(errors,[]);
});
