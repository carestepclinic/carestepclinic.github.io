const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>{await browser?.close();});
async function setup(t,width,mode){
 const p=await browser.newPage({viewport:{width,height:1000}});t.after(()=>p.close());
 await p.route('**/*',r=>r.abort());
 await p.setContent('<html lang="ko"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
 await p.addStyleTag({path:path.join(__dirname,'../surgery-ledger.css')});
 await p.addScriptTag({path:path.join(__dirname,'../surgery-ledger.js')});
 await p.evaluate(async mode=>{
  const base='/practice/support/ledger';window.writes=[];
  window.saved=mode==='existing'?{id:'entry',revision:1,status:'active',body:{record:{date:'2026-11-20',patientId:'p',patientName:'합성환자',chartNumber:'',species:'Canine',procedure:'기존 수술',weight:'4.2',drug:'기존 약물',notes:'기존 비고'}}}:null;
  const request=async(url,o={})=>{
   if(url===base+'/preferences')return {revision:1};
   if(url==='/members')return {members:[]};
   if(url.startsWith(base+'?'))return {items:saved?[structuredClone(saved)]:[],next:'',counts:{active:saved?1:0}};
   if(url.startsWith('/patient-directory?'))return {patients:[{id:'p',name:'합성환자',externalPatientId:'000123',species:'dog'}]};
   if(url==='/patients/p/workspace')return {patient:{id:mode==='mismatch'?'other':'p',name:'합성환자',species:'dog'},efriends:mode==='mapping'?{connected:true,externalPatientId:'000456'}:{connected:false},recentWeight:{value:6,date:'2026-11-01'}};
   if(o.method==='POST'){const body=JSON.parse(o.body);writes.push(body);saved={id:'entry',revision:(saved?.revision||0)+1,status:'active',body:{record:body.record}};return {document:structuredClone(saved)};}
   if(url===base+'/entry')return {document:structuredClone(saved)};
   throw Error('Unexpected synthetic request '+url);
  };
  window.view=SurgeryLedger.mount(document.querySelector('#root'),{identity:()=> 'synthetic',ready:()=>true,can:()=>true,request});await view.open();
 },mode);
 return p;
}
async function ready(p){await p.waitForFunction(()=>!document.querySelector('#root').hasAttribute('aria-busy'));}
async function select(p){
 const loader=p.locator('.sl-loader');if(!await loader.evaluate(n=>n.open))await loader.locator('summary').click();
 await p.locator('[data-patient-q]').fill('합성');await p.locator('[data-ledger=patients]').click();await ready(p);
 await p.locator('[data-candidate="0"]').click();await ready(p);
}
for(const width of [1440,390])for(const mode of ['directory','mapping','existing'])test(`chart survives selection, save and reload ${mode} ${width}`,async t=>{
 const p=await setup(t,width,mode),expected=mode==='mapping'?'000456':'000123';
 await p.locator(mode==='existing'?'[data-ledger=open]':'[data-ledger=new]').click();await ready(p);
 if(mode!=='existing'){await p.locator('[name=procedure]').fill('기존 수술');await p.locator('[name=weight]').fill('4.2');}
 await select(p);assert.match(await p.locator('[data-source-field=chartNumber]').locator('..').innerText(),/차트번호/);
 assert.match(await p.locator('.sl-source-changes').innerText(),new RegExp(expected));
 await p.locator('[data-ledger=apply-source]').click();await ready(p);
 assert.equal(await p.locator('[name=chartNumber]').inputValue(),expected);
 assert.equal(await p.locator('[name=chartNumber]').evaluate(n=>n.readOnly),true);
 assert.equal(await p.locator('[name=weight]').inputValue(),'4.2');
 assert.equal(await p.locator('[name=procedure]').inputValue(),'기존 수술');
 if(mode==='existing'){assert.equal(await p.locator('[name=drug]').inputValue(),'기존 약물');assert.equal(await p.locator('[name=notes]').inputValue(),'기존 비고');}
 await p.locator('[data-ledger=save]').click();await ready(p);
 assert.equal(await p.evaluate(()=>writes.at(-1).record.chartNumber),expected);
 await p.locator('[data-ledger=back]').click();await ready(p);await p.locator('[data-ledger=open]').click();await ready(p);
 assert.equal(await p.locator('[name=chartNumber]').inputValue(),expected);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(process.env.LEDGER_SCREENSHOTS&&mode==='existing')await p.screenshot({path:path.join(process.env.LEDGER_SCREENSHOTS,'chart-'+width+'.png')});
});
test('different patient detail is rejected without modifying or saving current record',async t=>{
 const p=await setup(t,1440,'mismatch');await p.locator('[data-ledger=new]').click();await ready(p);
 await p.locator('[name=patientName]').fill('기존환자');await p.locator('[name=chartNumber]').fill('KEEP');
 await select(p);assert.match(await p.locator('[data-ledger-message]').innerText(),/환자 연결을 다시 확인/);
 assert.equal(await p.locator('[data-ledger=apply-source]').count(),0);assert.equal(await p.locator('[name=chartNumber]').inputValue(),'KEEP');assert.equal(await p.evaluate(()=>writes.length),0);
});
