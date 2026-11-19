const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});after(async()=>browser?.close());
async function fixture(t,{width=1440,medical=true,closed=false,weight=5}={}){
 const p=await browser.newPage({viewport:{width,height:960}}),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:12px;font-family:system-ui"><main id="root"></main></body></html>'}));await p.goto('http://localhost/');await p.unroute('http://localhost/**');await p.route('**/*',r=>r.abort());
 for(const f of ['clinical-workspace.css','anesthesia-record.css','clinical-care-ui.css'])await p.addStyleTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 for(const f of ['clinical-compact.js','anesthesia-efficiency.js','anesthesia-dashboard.js','anesthesia-record.js','clinical-workspace.js'])await p.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 await p.evaluate(async({medical,closed,weight})=>{
  window.calls=[];window.calculations=[];window.failSave=false;const stamp=new Date().toISOString();
  window.item={id:'weight-case',revision:1,kind:'surgery',status:closed?'closed':'active',created_at:stamp,patient_id:'synthetic',patient:{id:'synthetic',name:'합성 마취 환자',guardianName:'합성 보호자'},body:{species:'dog',weight,title:'합성 수술',anesthesiaSheet:{},tasks:[],orders:[],infusions:[]}};
  window.originalEvents=[{id:'old-calculation',kind:'calculation',revision:1,recorded_at:stamp,body:{calculator:'anesthesia',weight:5,summary:'과거 합성 계산 5 kg'}},{id:'old-dose',kind:'anesthesia.entry',revision:1,recorded_at:stamp,body:{recordId:'old-dose',type:'marker',marker:'medication',observedAt:stamp,administration:{name:'합성 약물',amount:1,unit:'mL',route:'IV'}}}];
  window.app=ClinicalWorkspace.mount(document.querySelector('#root'),{ready:()=>true,identity:()=> 'weight-test',externalTabs:true,medical:()=>medical,can:()=>medical,patient:()=>null,calculator:(patient,kind)=>calculations.push({patient,kind}),request:async(url,o={})=>{
   const body=o.body?JSON.parse(o.body):null;calls.push({url,method:o.method||'GET',body});
   if(url.endsWith('/members'))return {members:[{id:'staff',display_name:'합성 수행자'}],userId:'staff'};
   if(o.method==='POST'&&url.endsWith('/events')){if(failSave)throw Error('합성 저장 실패');if(body.kind==='case.details'){item.body.weight=body.data.weight;item.revision++;}return {ok:true,revision:item.revision};}
   if(url.includes('/anesthesia'))return {events:structuredClone(originalEvents.filter(e=>e.kind==='anesthesia.entry')),hasMore:false};
   if(url.includes('/cases/weight-case'))return {item:structuredClone(item),events:structuredClone(originalEvents),canRecord:!closed,canManage:medical,hasMoreEvents:false};
   if(url.includes('/cases'))return {items:[structuredClone(item)],canManage:medical};return {items:[]};
  }});await app.openSurgery(item.id);
 },{medical,closed,weight});
 await p.locator('.ar-record-bar').waitFor();await p.waitForFunction(()=>document.querySelector('.ar-sync-status')?.textContent.includes('확인'));
 t.after(async()=>{await p.evaluate(()=>app.dispose());await p.close();assert.deepEqual(errors,[]);});return p;
}
for(const width of [390,1440])test('top weight button opens existing editor, updates calculation context and preserves history '+width,async t=>{
 const p=await fixture(t,{width}),button=p.locator('.ar-record-bar [data-ar=weight]');await button.waitFor({state:'visible'});
 assert.equal(await p.locator('.cl-surgery-management').evaluate(e=>e.open),false);const rect=await button.boundingBox(),bar=await p.locator('.ar-record-bar').boundingBox();assert.ok(rect.y>=bar.y&&rect.y+rect.height<=bar.y+bar.height+1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const original=await p.evaluate(()=>JSON.stringify(originalEvents));await button.click();await p.locator('.cl-dialog [name=weight]').fill('6');await p.locator('.cl-dialog [type=submit]').click();await p.waitForFunction(()=>document.querySelector('.ar-record-bar')?.textContent.includes('6 kg'));assert.equal(await p.evaluate(()=>app.patient().weight),6);assert.equal(await p.evaluate(()=>JSON.stringify(originalEvents)),original);
 await p.locator('.cl-surgery-management>summary').click();await p.locator('.cl-surgery-management [data-cl-action=calc][data-kind=anesthesia]').click();assert.equal(await p.evaluate(()=>calculations.at(-1).patient.weight),6);assert.equal(await p.evaluate(()=>calls.filter(c=>c.method==='POST').length),1);
 // A second render must retain a working callback, not a detached listener.
 await p.locator('.ar-record-bar [data-ar=weight]').click();assert.equal(await p.locator('.cl-dialog [name=weight]').inputValue(),'6');
 if(process.env.WEIGHT_SCREENSHOTS){await p.locator('.cl-dialog [data-cl-action=close]').click();await p.locator('.ar-record-bar').screenshot({path:path.resolve(root,'../anesthesia-weight-'+width+'.png')});}
});
test('weight save failure retains entered value and prior calculation context',async t=>{const p=await fixture(t);await p.evaluate(()=>failSave=true);await p.locator('.ar-record-bar [data-ar=weight]').click();await p.locator('.cl-dialog [name=weight]').fill('6');await p.locator('.cl-dialog [type=submit]').click();await p.waitForFunction(()=>document.querySelector('.cl-dialog')?.textContent.includes('합성 저장 실패'));assert.equal(await p.locator('.cl-dialog [name=weight]').inputValue(),'6');assert.equal(await p.evaluate(()=>app.patient().weight),5);});
for(const mode of [{medical:false},{closed:true}])test('no top weight editing for '+JSON.stringify(mode),async t=>{const p=await fixture(t,mode);assert.equal(await p.locator('.ar-record-bar [data-ar=weight]').count(),0);assert.equal(await p.evaluate(()=>calls.filter(c=>c.method==='POST').length),0);});
test('missing weight uses a clear entry action',async t=>{const p=await fixture(t,{weight:null});await p.locator('.ar-record-bar [data-ar=weight]').waitFor();assert.equal(await p.locator('.ar-record-bar [data-ar=weight]').innerText(),'체중 입력');await p.locator('.ar-record-bar [data-ar=weight]').click();assert.equal(await p.locator('.cl-dialog [name=weight]').inputValue(),'');});
