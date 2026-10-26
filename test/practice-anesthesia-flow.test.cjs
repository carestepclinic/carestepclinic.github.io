const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{resolve}=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
const modules=['clinic-tab-position',...[...readFileSync(resolve(root,'index.html'),'utf8').matchAll(/<script src="(practice-[^"?]+\.js)(?:\?[^" ]*)?"/g)].map(x=>x[1].slice(0,-3)).filter(x=>!['practice-intake','practice-clinic'].includes(x))];
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/practice-tools.css"><main id="root"></main>'+modules.map(x=>'<script src="/'+x+'.js"></script>').join('')+`<script>
var calls=[],selected=new URLSearchParams(location.search).has('patient')?{id:'p1',name:'시험 환자',guardianName:'시험 보호자',species:'dog'}:null,actor='synthetic',fail=false,delay=0,kind='tablet',blocked=false,administrative=false,empty=false,captured=null,stored=[],referenceData=null,weightDelay=0,presetDelay=0,failProducts=false,recordedWeight={weight:8.2,weightDate:'2026-10-20'},manager=false,saveFail=false,saveDelay=0,custom={};
const product=()=>({id:'mfds:200000001',sourceHash:'a'.repeat(64),source:'MFDS',name:kind==='injection'?'시험 주사제 20 mg':'시험 제품 20 mg',manufacturer:'시험 제조사',ingredientEnglish:['Synthetic'],permitStatus:administrative?'취하':'정상',checkedAt:'2026-10-23',sourceUrl:'https://nedrug.mfds.go.kr/test',components:[{ingredient:'시험 성분',amountRaw:'20',unitRaw:'mg',basisRaw:'1정',equivalenceRaw:'',normalization:'structured',per:'tablet',strengthBasis:'시험 성분',issues:[]}],issues:[],selection:{reasons:blocked?['복합제 원문 확인 필요']:administrative?['허가 상태 확인 필요','허가 상태 확인','수출용 표시']:[],option:blocked||administrative?null:{value:20,unit:'mg',form:kind==='tablet'?'tablet':'liquid',route:kind==='injection'?'injection':'oral'}},...custom});
var app=PracticeTools.mount(document.getElementById('root'),{ready:()=>true,identity:()=>actor,can:()=>true,navigate:()=>app.open(),patient:()=>selected,request:async(path,o={})=>{calls.push({path,method:o.method||'GET',body:o.body?JSON.parse(o.body):null});if(path==='/practice/strengths'){if(saveFail)throw Error('저장 연결 실패');const x=JSON.parse(o.body).items[0],old=stored.find(p=>p.body.strength?.ingredientId===x.ingredientId&&JSON.stringify(p.body.strength.species)===JSON.stringify(x.species));if(old&&old.revision!==x.revision)return {results:[{status:'conflict',message:'버전 충돌'}]};const id=old?.id||'new'+stored.length,p={id,revision:(old?.revision||0)+1,body:{title:x.name,value:x.value,unit:x.unit,kind:x.kind,strength:{version:1,ingredientId:x.ingredientId,name:x.name,english:x.english,aliases:x.aliases,species:x.species,route:x.route,release:x.release,calculationBasis:x.basis,sourceUrl:x.sourceUrl,checkedAt:x.checkedAt}}};stored=stored.filter(y=>y.id!==id).concat(p);return {results:[{status:'saved',id}]};}if(path==='/practice/formulary'){if(saveFail)throw Error('저장 연결 실패');const b=JSON.parse(o.body),p=product(),id='cf_test';stored=[{id,revision:(stored[0]?.revision||0)+1,body:{title:p.name,kind:b.kind,value:b.value,unit:b.unit,formulary:{version:1,productId:p.id,sourceHash:p.sourceHash,sourceUrl:p.sourceUrl,checkedAt:p.checkedAt,permitStatus:p.permitStatus,aliases:b.aliases,species:b.species,route:b.route,verification:b.verification,entryMode:b.entryMode,calculatorReady:b.calculatorReady,calculationBasis:b.calculationBasis,warnings:p.selection.reasons}}}];return {ok:true,id};}if(path.startsWith('/practice/products/item/'))return {ok:true,item:product()};if(path.startsWith('/practice/products')){if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('연결 확인');return {ok:true,canManage:false,catalog:empty?null:{id:'prod_test',count:1,checkedAt:'2026-10-23'},items:empty?[]:[product()],hasMore:false};}if(path.startsWith('/practice/patient/')){if(weightDelay)await new Promise(r=>setTimeout(r,weightDelay));return {patient:recordedWeight};}if(path.startsWith('/practice/presets')&&['POST','PUT'].includes(o.method)){if(saveDelay)await new Promise(r=>setTimeout(r,saveDelay));if(saveFail)throw Error('저장 연결 실패');captured=JSON.parse(o.body);const id=o.method==='PUT'?path.split('/').pop():'saved'+stored.length,old=stored.find(x=>x.id===id);if(o.method==='PUT'&&old?.revision!==captured.revision)throw Error('서식이 변경되었습니다.');stored=stored.filter(x=>x.id!==id).concat({id,revision:(old?.revision||0)+1,updated_at:'2026-10-26',body:captured});return {ok:true,id};}if(path.startsWith('/practice/presets')){if(failProducts)throw Error('시험 약품 연결 실패');if(presetDelay)await new Promise(r=>setTimeout(r,presetDelay));return {ok:true,items:structuredClone(stored),canManage:manager,strengthsVersion:1,protocolsVersion:1};}if(path==='/practice/references')return {libraries:referenceData?[{id:'test',title:'Synthetic reference',status:'ready',count:1}]:[],canManage:false};if(path==='/practice/references/test')return {id:'test',title:'Synthetic reference',sourceHash:'a'.repeat(64),checkedAt:'2026-10-26',index:[referenceData]};if(path==='/practice/references/test/entries/entry')return {entry:referenceData};if(path.startsWith('/operations'))return {runs:[],templates:[],members:[],manager:false};if(path.startsWith('/intakes'))return {items:[],next:'',canEdit:false};return {items:[]};}});app.calculator();
</script>`);}try{res.end(readFileSync(resolve(root,path.slice(1))));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();server.close();});


async function page(t,width=1280){const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});await p.goto(origin+'/fixture');await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');return p;}
async function kind(p,k){await p.locator('[data-kind="'+k+'"]').evaluate(e=>e.click());return p.locator('[data-kind-panel="'+k+'"]');}
async function inject(p,rows){await p.evaluate(rows=>{stored=rows;manager=true;app.clear();app.calculator();},rows);await p.locator('[data-calcium-product] option').first().waitFor({state:'attached'});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}



for(const width of [390,1280])test('anesthesia reference volumes and responsive stage selection '+width,async t=>{
 const p=await page(t,width);await kind(p,'anesthesia');const card=p.locator('[data-an-drug=propofol]');assert.match(await card.locator('output').innerText(),/1 mL/);assert.equal(await p.locator('[data-an-drug]').count(),14);await card.locator('[data-an-stock]').fill('20');assert.match(await card.locator('output').innerText(),/0.5 mL/);await card.locator('[data-an-selected]').check();assert.equal(await p.locator('[data-an-copy]').isEnabled(),true);await p.locator('[data-common-weight]').fill('10');assert.equal(await card.locator('[data-an-selected]').isChecked(),false);await p.locator('[data-an-profile]').selectOption('individual');assert.match(await card.locator('output').innerText(),/개별 마취 계획/);await p.locator('[data-an-profile]').selectOption('stable');await p.locator('[data-an-group=induction]').click();assert.equal(await p.locator('[data-an-drug]:visible').count(),5);assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.locator('[data-kind-panel=anesthesia]').screenshot({path:resolve(root,'../anesthesia-'+width+'.png')});
});
test('feline doses reset on species change and micrograms retain units',async t=>{
 const p=await page(t);await kind(p,'anesthesia');await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await p.locator('[data-an-drug=alfaxalone] [data-an-dose]').inputValue(),'2');const d=p.locator('[data-an-drug=dexmedetomidine]');await d.locator('[data-an-stock]').fill('0.5');assert.match(await d.locator('output').innerText(),/0.03 mL.*15 mcg/);await p.locator('[data-ref-species]').selectOption('dog');assert.equal(await d.locator('[data-an-stock]').inputValue(),'');
});
test('hospital stock is selected only when unambiguous',async t=>{
 const p=await page(t);await inject(p,[{id:'p20',revision:1,body:{title:'시험 프로포폴',kind:'liquid',value:20,unit:'mg',strength:{ingredientId:'mfds-bd11aec3c2ce50c8e483',species:['dog','cat'],route:'injection',release:'standard'}}}]);await kind(p,'anesthesia');const card=p.locator('[data-an-drug=propofol]');assert.equal(await card.locator('[data-an-stock]').inputValue(),'20');assert.match(await card.locator('[data-an-origin]').innerText(),/병원 약품/);assert.match(await card.locator('output').innerText(),/0.5 mL/);
});
test('integrated fluids require explicit loss inputs and propagate calculated rate',async t=>{
 const p=await page(t,390);await kind(p,'fluid');const f=p.locator('.pt-fluid-plan');assert.equal(await f.locator('[data-fp=maintenance]').inputValue(),'60');for(const [k,v] of Object.entries({dehydration:'5',hours:'12',loss:'2',other:'3'}))await f.locator('[data-fp='+k+']').fill(v);await f.locator('[data-fp-confirm]').check();await f.locator('[data-fp-run]').click();assert.match(await f.locator('output').innerText(),/32.333/);await f.locator('[data-fp-apply]').click();assert.equal(Number(await p.locator('[data-calc=fluid] [name=rate]').inputValue()),12.5+250/12-1);await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await f.locator('[data-fp=maintenance]').inputValue(),'40');assert.equal(await f.locator('output').textContent(),'');assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
});
test('CRI progressively reveals compounding after drug and dose selection',async t=>{
 const p=await page(t);await kind(p,'cri');const f=p.locator('[data-calc=cri]');assert.equal(await f.getAttribute('data-cri-step'),'drug');assert.equal(await f.locator('[name=volume]').isVisible(),false);await f.locator('[data-cri-drug=dobutamine]').click();assert.equal(await f.getAttribute('data-cri-step'),'regimen');await f.locator('[data-cri-dose-value]').first().click();assert.equal(await f.getAttribute('data-cri-step'),'prepare');assert.equal(await f.locator('[name=volume]').isVisible(),true);await f.locator('[data-cri-bag]').selectOption('500');assert.equal(await f.locator('[name=volume]').inputValue(),'500');await f.locator('[data-cri-bag]').selectOption('custom');assert.equal(await f.locator('[name=volume]').inputValue(),'500');
});
test('tab switches start at the current calculator rather than a deep old scroll position',async t=>{
 const p=await page(t,390);await kind(p,'anesthesia');await p.locator('[data-an-drug=ketamine]').scrollIntoViewIfNeeded();await kind(p,'fluid');await kind(p,'anesthesia');await p.waitForTimeout(80);const y=await p.locator('[data-kind-panel=anesthesia] h3').evaluate(e=>e.getBoundingClientRect().top);assert.ok(y>=0&&y<300);
});

test('undiluted CRI exhaustion is displayed as hours and minutes',async t=>{const p=await page(t);await kind(p,'cri');const f=p.locator('[data-calc=cri]');await f.locator('[data-cri-drug=propofol]').click();await f.locator('[data-cri-dose-value="0.2"]').click();await f.locator('[data-settings]').evaluate(e=>e.open=true);await f.locator('[name=stock]').fill('10');await f.locator('[name=volume]').fill('22.5');await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();assert.match(await f.locator('output').textContent(),/3시간 45분/);assert.doesNotMatch(await f.locator('output').textContent(),/3.75시간/);});

async function enableSave(p){await p.evaluate(()=>{manager=true;app.clear();app.calculator();});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');await kind(p,'anesthesia');await p.locator('[data-an-drug=propofol] [data-an-save]').waitFor({state:'visible'});}
async function reopen(p){await p.evaluate(()=>{app.clear();app.calculator();});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');await kind(p,'anesthesia');}
test('explicit save persists across reopening, updates same record and leaves dose transient',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');
 await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-dose]').fill('4');await c.locator('[data-an-save]').click();
 await p.waitForFunction(()=>stored.some(x=>x.body.note?.includes('CARESTEP_ANESTHESIA_STOCK')));
 await p.waitForFunction(()=>!document.querySelector('[data-an-drug=propofol] [data-an-save]').disabled);
 assert.match(await c.locator('[data-an-save-state]').innerText(),/저장/);
 await reopen(p);assert.equal(await c.locator('[data-an-stock]').inputValue(),'20');assert.equal(await c.locator('[data-an-dose]').inputValue(),'2');assert.match(await c.locator('[data-an-origin]').innerText(),/저장된 병원/);
 await c.locator('[data-an-stock]').fill('30');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored[0]?.revision===2);
 assert.equal(await p.evaluate(()=>stored.length),1);await reopen(p);assert.equal(await c.locator('[data-an-stock]').inputValue(),'30');
 // No leakage into ordinary medication choices.
 assert.doesNotMatch(await p.locator('[data-preset]').innerHTML(),/마취 농도/);
});
test('unsaved stock changes disappear on reopen and saved values survive species reset',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');
 await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored.length===1);
 await reopen(p);await c.locator('[data-an-stock]').fill('30');await reopen(p);assert.equal(await c.locator('[data-an-stock]').inputValue(),'20');
 await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await c.locator('[data-an-stock]').inputValue(),'20');
});
test('combination saves both concentrations in one record and restores species-specific doses',async t=>{
 const p=await page(t,390);await enableSave(p);const c=p.locator('[data-an-drug=ketamine-medetomidine]');
 await c.locator('[data-an-stock]').fill('100');await c.locator('[data-an-companion-stock]').fill('2');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored.length===1);await reopen(p);
 assert.equal(await c.locator('[data-an-stock]').inputValue(),'100');assert.equal(await c.locator('[data-an-companion-stock]').inputValue(),'2');
 assert.match(await c.locator('output').textContent(),/케타민 0.25 mL/);assert.match(await c.locator('output').textContent(),/메데토미딘 염산염 0.1 mL/);
 await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await c.locator('[data-an-companion-dose]').inputValue(),'80');assert.match(await c.locator('output').textContent(),/메데토미딘 염산염 0.2 mL/);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await c.screenshot({path:resolve(root,'../anesthesia-stock-combination.png')});
});
test('write permission and invalid stock cannot save',async t=>{
 const p=await page(t);await kind(p,'anesthesia');const c=p.locator('[data-an-drug=propofol]');assert.equal(await c.locator('[data-an-save]').isEnabled(),false);
 await enableSave(p);await c.locator('[data-an-stock]').fill('0');await c.locator('[data-an-save]').click();assert.match(await c.locator('[data-an-save-state]').textContent(),/농도 입력값을 확인/);assert.equal(await p.evaluate(()=>calls.filter(x=>x.path==='/practice/presets'&&x.method==='POST').length),0);
});
test('save failure never reports saved and reloading recovers persisted value',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');await p.evaluate(()=>saveFail=true);
 await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-save]').click();await c.locator('[data-an-save-state]').filter({hasText:'저장 연결 실패'}).waitFor();
 assert.equal(await p.evaluate(()=>stored.length),0);assert.equal(await c.locator('[data-an-stock]').inputValue(),'20');
 await p.evaluate(()=>saveFail=false);await c.locator('[data-an-reload]').click();await c.locator('[data-an-origin]').filter({hasText:'문헌'}).waitFor();assert.equal(await c.locator('[data-an-stock]').inputValue(),'10');
});
test('another editor revision prevents overwriting and reload makes next save explicit',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored.length===1);await reopen(p);
 await p.evaluate(()=>{stored[0].revision=2;stored[0].body.value=25;});await c.locator('[data-an-stock]').fill('30');await c.locator('[data-an-save]').click();await c.locator('[data-an-save-state]').filter({hasText:'다른 화면'}).waitFor();assert.equal(await p.evaluate(()=>stored[0].body.value),25);
 await c.locator('[data-an-reload]').click();await p.waitForFunction(()=>document.querySelector('[data-an-drug=propofol] [data-an-stock]').value==='25');
});
test('editing while a save is pending keeps newer edit visibly unsaved',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');await p.evaluate(()=>saveDelay=200);
 await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>calls.some(x=>x.path==='/practice/presets'&&x.method==='POST'));await c.locator('[data-an-stock]').fill('30');
 await p.waitForFunction(()=>stored.length===1);await p.waitForFunction(()=>!document.querySelector('[data-an-drug=propofol] [data-an-save]').disabled);
 assert.equal(await c.locator('[data-an-stock]').inputValue(),'30');assert.equal(await p.evaluate(()=>stored[0].body.value),20);assert.match(await c.locator('[data-an-save-state]').textContent(),/아직 저장/);
});
test('saved pair appears in a second browser context using the same hospital records',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=ketamine]');await c.locator('[data-an-stock]').fill('100');await c.locator('[data-an-companion-stock]').fill('2');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored.length===1);
 const records=await p.evaluate(()=>stored),p2=await page(t);await inject(p2,records);await kind(p2,'anesthesia');assert.equal(await p2.locator('[data-an-drug=ketamine] [data-an-stock]').inputValue(),'100');assert.equal(await p2.locator('[data-an-drug=ketamine] [data-an-companion-stock]').inputValue(),'2');
});

test('duplicate saved cards are held instead of choosing an arbitrary concentration',async t=>{
 const p=await page(t);const rows=await p.evaluate(()=>{const body=PracticeAnesthesia.stockBody(PracticeAnesthesia.drugs.find(d=>d.id==='propofol'),20);return [{id:'x',revision:1,body},{id:'y',revision:1,body:{...body,value:30}}];});
 await inject(p,rows);await kind(p,'anesthesia');const c=p.locator('[data-an-drug=propofol]');assert.equal(await c.locator('[data-an-stock]').inputValue(),'');assert.match(await c.locator('output').textContent(),/여러 개/);
});
test('copy validates saved concentration revision before putting a plan on clipboard',async t=>{
 const p=await page(t);await enableSave(p);const c=p.locator('[data-an-drug=propofol]');await c.locator('[data-an-stock]').fill('20');await c.locator('[data-an-save]').click();await p.waitForFunction(()=>stored.length===1);await reopen(p);
 await c.locator('[data-an-selected]').check();await p.evaluate(()=>{stored[0].revision++;stored[0].body.value=30;});await p.locator('[data-an-copy]').click();await p.locator('[data-an-copy-status]').filter({hasText:'저장된 농도가 변경'}).waitFor();
});
