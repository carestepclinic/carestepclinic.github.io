const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{resolve}=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
const modules=['practice-reference','practice-reference-ui','practice-calculators','practice-acid-base','practice-calcium-transfusion','practice-calculator-workspace','practice-calculator-simple','practice-library-dose','practice-library','practice-prescription','practice-prescription-ui','practice-strengths','practice-products','practice-calculator-ease','practice-tools'];
before(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});
 server=http.createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;
  if(path==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/practice-tools.css"><main id="root"></main>'+modules.map(x=>'<script src="/'+x+'.js"></script>').join('')+`<script>
   var actor='synthetic',selected=null,referenceFail=false,calls=[],stored=[{id:'cf_synthetic',revision:1,body:{title:'시험 정제 20 mg',kind:'tablet',value:20,unit:'mg',formulary:{version:1,calculatorReady:true,aliases:['Synthetic'],species:['dog'],route:'oral',warnings:[],verification:'label',permitStatus:'시험'}}}];
   var app=PracticeTools.mount(document.getElementById('root'),{ready:()=>true,identity:()=>actor,can:()=>true,navigate:()=>app.open(),patient:()=>selected,request:async(path,o={})=>{calls.push({path,method:o.method||'GET'});if(o.method&&o.method!=='GET')throw Error('Unexpected write in layout review');if(path.startsWith('/practice/presets'))return {items:structuredClone(stored),canManage:true,protocolsVersion:1,strengthsVersion:1};if(path.startsWith('/practice/patient/'))return {patient:{weight:8.2,weightDate:'2026-10-20'}};if(path==='/practice/references'){if(referenceFail)throw Error('시험 자료 조회 실패');return {libraries:[],canManage:false};}return {items:[]};}});app.calculator();
  </script>`);}
  try{const data=readFileSync(resolve(root,path.slice(1)));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}
 }).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function page(t,width=1280){const p=await browser.newPage({viewport:{width,height:900}});t.after(()=>p.close());p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/fixture');await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('10');return p;}
async function waitFrame(p){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}

for(const width of [390,1280])test('daily inputs, required product settings and mobile navigation stay reachable '+width,async t=>{
 const p=await page(t,width),dose=p.locator('[data-calc=dose]');
 assert.ok((await dose.locator('[name=dose]').boundingBox()).y<900);assert.equal(await dose.locator('[name=doseUnit]').isVisible(),true);assert.equal(await dose.locator('[name=concentration]').isVisible(),true);assert.equal(await p.locator('[data-manual]').isVisible(),false);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.locator('[data-quick-product-search]').fill('Synthetic');await p.locator('[data-quick-product]').click();assert.equal(await dose.locator('[name=concentration]').inputValue(),'20');assert.equal(await dose.locator('[data-settings]').evaluate(x=>x.open),false);
 await p.locator('[data-kind=cri]').click();for(const name of ['drug','doseUnit','stock','stockUnit','volume','diluent'])assert.equal(await p.locator('[data-calc=cri] [name='+name+']').isVisible(),true,name);
 assert.equal(await p.locator('[data-library-open]').isVisible(),true);await p.locator('[data-kind=acid]').click();assert.equal(await p.locator('[data-library-open]').isVisible(),false);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});

test('dock uses original validation and results retain unit details, review gates and invalidation',async t=>{
 const p=await page(t,390),f=p.locator('[data-calc=dose]');
 // Synthetic arithmetic only; these are not prescribing recommendations.
 await f.locator('[name=dose]').fill('1.5');await f.locator('[name=concentration]').fill('20');await f.locator('[name=times]').fill('2');await f.locator('[name=days]').fill('3');await p.locator('[data-dock-calculate]').click();
 await f.locator('.pt-result-key-grid').waitFor();assert.match(await f.locator('.pt-result-key-grid').innerText(),/0.75 mL/);assert.match(await f.locator('.pt-result-key-grid').innerText(),/4.5 mL/);assert.equal(await f.locator('.pt-result-details').evaluate(x=>x.open),false);
 await p.locator('[data-dock-result]').click();assert.equal(await f.locator('output').evaluate(x=>x===document.activeElement),true);await f.locator('.pt-result-details summary').click();assert.match(await f.locator('.pt-result-details').innerText(),/1회 총량 15 mg/);
 assert.equal(await f.locator('[data-copy]').isDisabled(),true);await f.locator('[data-checked]').check();assert.equal(await f.locator('[data-copy]').isDisabled(),false);await p.locator('[data-common-weight]').fill('11');await waitFrame(p);assert.equal(await f.locator('output').innerText(),'');assert.equal(await p.locator('[data-dock-result]').isDisabled(),true);
});

test('recorded weight still requires review when submitted from the dock; teardown removes context',async t=>{
 const p=await page(t,390);await p.evaluate(()=>{selected={id:'p1',name:'시험 환자',species:'dog'};app.calculator();});await p.waitForFunction(()=>document.querySelector('[data-common-weight]').value==='8.2');const f=p.locator('[data-calc=dose]');await f.locator('[name=dose]').fill('1');await f.locator('[name=concentration]').fill('20');await p.locator('[data-dock-calculate]').click();assert.match(await f.locator('output').innerText(),/기록 체중/);assert.equal(await f.locator('[data-result-actions]').isVisible(),false);assert.match(await p.locator('[data-dock-context]').innerText(),/기록 체중 확인 필요/);
 await p.locator('[data-record-weight-confirm]').check();await p.locator('[data-dock-calculate]').click();await f.locator('.pt-result-key-grid').waitFor();assert.match(await f.locator('output').innerText(),/0.41 mL/);
 await p.evaluate(()=>app.clear());assert.equal(await p.locator('.pt-calc-dock').count(),0);await p.evaluate(()=>{actor='different';selected=null;app.calculator();});await waitFrame(p);assert.equal(await p.locator('.pt-calc-dock').count(),1);assert.doesNotMatch(await p.locator('[data-dock-context]').innerText(),/시험 환자|8.2/);
});

test('strength modal reveals the first row, edits one ingredient and keeps save reachable',async t=>{
 const p=await page(t,390);await p.locator('[data-drug-management]>summary').click();await p.locator('[data-calc=dose] [data-strength-open]').click();await p.locator('.pt-strength-row').first().waitFor();const first=await p.locator('.pt-strength-row>summary').first().boundingBox(),footer=await p.locator('.pt-strength-footer').boundingBox();assert.ok(first.y+first.height<=footer.y);assert.ok(footer.y+footer.height<=900);assert.equal(await p.locator('.pt-strength-row').first().evaluate(x=>x.open),false);
 await p.locator('[data-st-query]').fill('Pimobendan');assert.equal(await p.locator('.pt-strength-row').count(),1);assert.equal(await p.locator('.pt-strength-row').evaluate(x=>x.open),true);await p.locator('[data-st-option]').selectOption('manual');for(const key of ['value','kind','unit','route'])assert.equal(await p.locator('[data-st-'+key+']').inputValue(),'');assert.equal(await p.locator('[data-st-save]').isDisabled(),true);assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});

test('batch review filters preserve all rows, focus unresolved entries and clear only after validation',async t=>{
 const p=await page(t);await p.locator('[data-kind=batch]').click();const source='Synthetic 2 mg/kg PO BID for 3 days\nUnknown 1 mg/kg PO BID for 3 days';await p.locator('[data-rx-text]').fill(source);await p.getByRole('heading',{name:'자동 계산 완료 1/2개 · 미완료 약물 확인 필요',exact:true}).waitFor();
 await p.locator('[data-rx-filter=pending]').click();assert.equal(await p.locator('[data-rx-row="0"]').isVisible(),false);assert.equal(await p.locator('[data-rx-row="1"]').isVisible(),true);await p.locator('[data-rx-next]').click();assert.equal(await p.locator('[data-rx-row="1"]').evaluate(x=>x===document.activeElement),true);
 const row=p.locator('[data-rx-row="1"]');await row.locator('[data-rx-field=product]').fill('시험 액상');await row.locator('[data-rx-field=form]').selectOption('liquid');await row.locator('[data-rx-field=strength]').fill('5');await p.getByRole('heading',{name:'자동 계산 완료 2/2개',exact:true}).waitFor();assert.equal(await p.locator('[data-rx-next]').isDisabled(),true);assert.equal(await p.locator('[data-rx-row]:visible').count(),0);assert.equal(await p.locator('[data-rx-text]').inputValue(),source);
 await p.locator('[data-rx-filter=all]').click();assert.equal(await p.locator('[data-rx-row]:visible').count(),2);assert.equal(await p.locator('.pt-rx-result-detail').first().evaluate(x=>x.open),false);assert.equal(await p.locator('[data-calc=batch] [data-copy]').isDisabled(),true);
});

for(const width of [390,1280])test('full CLINIC shell stays within the viewport and keeps original submit behavior '+width,async t=>{
 const p=await page(t,width);await p.goto(origin+'/index.html');await p.evaluate(()=>{saasMode='auth';saasSessionMeta={id:'layout-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');});await p.getByRole('button',{name:'임상 계산기',exact:true}).click();await p.locator('[data-common-weight]').waitFor();await waitFrame(p);
 assert.ok(await p.locator('#practiceRoot').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok((await p.locator('[data-calc=dose] [name=dose]').boundingBox()).width<width);assert.equal(await p.locator('[data-dock-calculate]').isVisible(),true);assert.match(await p.locator('[data-protocol=dose]').evaluate(x=>x.selectedOptions[0]?.textContent||''),/직접 입력/);
 await p.evaluate(()=>go('dashboard'));await waitFrame(p);assert.equal(await p.locator('.pt-calc-dock').isVisible(),false);
});

test('important infusion warnings stay visible beside compact results',async t=>{
 const p=await page(t);await p.locator('[data-kind=potassium]').click();const f=p.locator('[data-calc=potassium]');await f.locator('[name=concentration]').fill('20');await f.locator('[name=rate]').fill('10');await f.locator('[name=confirmed]').check();await f.getByRole('button',{name:'계산',exact:true}).click();await f.locator('.pt-result-key-grid').waitFor();
 assert.equal(await f.locator('.pt-result-details').evaluate(x=>x.open),false);assert.match(await f.locator('output').innerText(),/급속 주입 금지/);assert.match(await f.locator('output').innerText(),/적합함을 보장하지/);
});


test('reference retry inside drug search never submits the calculation form',async t=>{
 const p=await page(t);await p.evaluate(()=>{referenceFail=true;window.accidentalSubmits=0;document.querySelector('[data-calc=dose]').addEventListener('submit',()=>window.accidentalSubmits++);});await p.locator('[data-library-open]').click();const retry=p.locator('.pt-library').getByRole('button',{name:'다시 불러오기',exact:true});await retry.waitFor();assert.equal(await retry.getAttribute('type'),'button');await p.evaluate(()=>referenceFail=false);await retry.click();assert.equal(await p.evaluate(()=>accidentalSubmits),0);assert.equal(await p.locator('[data-calc=dose] output').innerText(),'');
});
