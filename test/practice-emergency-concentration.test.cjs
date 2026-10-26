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





const emergency=require('../practice-emergency.js'),settings=require('../practice-calculator-settings.js');
test('concentration calculation preserves rate across bag sizes and scales dose/weight',()=>{
 for(const [id,concentration,stock] of [['dobutamine',1,50],['norepinephrine',.016,1],['dopamine',1.6,40]]){
 const dose=emergency.drugs.find(x=>x.id===id).dose.dog,v={species:'dog',weight:5,dose,stock,mixMode:'concentration',concentration,volume:100};
 const a=emergency.calculate(id,v),b=emergency.calculate(id,{...v,volume:500});
 assert.equal(a.rate,b.rate);assert.ok(Math.abs(b.stockML-a.stockML*5)<1e-10);assert.equal(a.stockML+a.diluentML,100);
 assert.equal(emergency.calculate(id,{...v,weight:10}).rate,a.rate*2);
 assert.equal(emergency.calculate(id,{...v,dose:dose*2}).rate,a.rate*2);
 }
 assert.equal(emergency.duration(3.75),'3시간 45분');
 for(const concentration of [0,-1,50,'NaN'])assert.throws(()=>emergency.calculate('dobutamine',{species:'dog',weight:5,dose:2,stock:50,mixMode:'concentration',concentration,volume:100}));
});
test('only dilution facts persist and invalid records are rejected',()=>{
 const b=settings.body('emergency','emergency:dobutamine',{concentration:'1',stock:'50',volume:'100',diluent:'ns',weight:5,dose:2,rate:10,otherRate:3});
 assert.deepEqual(Object.keys(settings.fact({body:b}).values),['concentration','stock','volume','diluent']);
 assert.equal(settings.partition({items:[{body:b}]}).items.length,0);
 assert.throws(()=>settings.body('emergency','emergency:unknown',{concentration:1,stock:50,volume:100,diluent:'ns'}));
 assert.throws(()=>settings.body('emergency','emergency:dobutamine',{concentration:50,stock:50,volume:100,diluent:'ns'}));
});
async function emcard(p,id='dobutamine'){await kind(p,'emergency');await p.locator('[data-em-open="'+id+'"]').click();return p.locator('[data-em-drug="'+id+'"]');}
async function readyManager(p){await p.evaluate(()=>{manager=true;app.clear();app.calculator();});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}
for(const width of [390,1280])test('automatic rate and recipe, review, fluid contribution and minimum pump '+width,async t=>{
 const p=await page(t,width);const c=await emcard(p),out=c.locator('[data-em-result]');
 assert.equal(await c.locator('[data-em-mix-mode]').inputValue(),'concentration');
 assert.match(await out.innerText(),/예상 펌프 0.6 mL\/hr/);assert.match(await out.innerText(),/원액 2 mL/);
 await c.locator('[data-em-bag]').selectOption('500');assert.match(await out.innerText(),/원액 10 mL/);assert.match(await out.innerText(),/희석액 490 mL/);assert.match(await out.innerText(),/0.6 mL\/hr/);
 await c.locator('[data-em-diluent]').selectOption('ns');await c.locator('[data-em-mix-confirm]').check();assert.match(await out.locator('strong').innerText(),/^펌프 /);
 await c.locator('.pt-em-optional summary').click();await c.locator('[data-em-pump-min]').fill('1');assert.match(await out.innerText(),/최소 정확 주입속도 미만/);
 assert.match(await p.locator('[data-em-row=dobutamine]').innerText(),/최소 정확 주입속도 미만/);
 await c.locator('[data-em-other-rate]').fill('2');assert.match(await out.innerText(),/다른 라인 포함 2.6 mL\/hr/);
 await c.locator('[data-em-dose]').fill('4');assert.match(await out.innerText(),/1.2 mL\/hr/);assert.equal(await c.locator('[data-em-mix-confirm]').isChecked(),false);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth));
 await p.screenshot({path:resolve(root,'../pump-setup-'+width+'.png'),fullPage:true});
 assert.equal(await p.evaluate(()=>calls.some(c=>c.method!=='GET')),false);
});
test('save then reload across a new session; edits remain local and dosing remains patient specific',async t=>{
 const p=await page(t);await readyManager(p);const c=await emcard(p);
 await c.locator('[data-em-concentration]').fill('0.5');await c.locator('[data-em-diluent]').selectOption('ns');await c.locator('[data-em-mix-confirm]').check();await c.locator('[data-em-save]').click();
 await p.waitForFunction(()=>stored.length===1);await p.waitForFunction(()=>!document.querySelector('[data-em-drug=dobutamine] [data-em-save]').disabled);
 assert.equal(await p.evaluate(()=>JSON.parse(stored[0].body.note.split('CARESTEP_SETUP_V1:')[1]).values.concentration),'0.5');
 const rows=await p.evaluate(()=>stored);await inject(p,rows);const c2=await emcard(p);
 assert.equal(await c2.locator('[data-em-concentration]').inputValue(),'0.5');assert.equal(await c2.locator('[data-em-dose]').inputValue(),'2');
 assert.equal(await c2.locator('[data-em-mix-confirm]').isChecked(),false);
 await c2.locator('[data-em-concentration]').fill('0.25');assert.equal(await p.evaluate(()=>JSON.parse(stored[0].body.note.split('CARESTEP_SETUP_V1:')[1]).values.concentration),'0.5');
 await c2.locator('[data-em-reload]').click();await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-concentration]').value==='0.5');
 await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await c2.locator('[data-em-dose]').inputValue(),'1');assert.equal(await c2.locator('[data-em-concentration]').inputValue(),'0.5');
 assert.equal(await p.locator('[data-preset] option').count(),1);
});
test('save conflict and failure preserve input; stale saved facts cannot be confirmed',async t=>{
 const p=await page(t);const rows=[{id:'cfg',revision:1,body:settings.body('emergency','emergency:dobutamine',{concentration:'1',stock:'50',volume:'100',diluent:'ns'})}];
 await inject(p,rows);const c=await emcard(p);
 await p.evaluate(()=>stored[0].revision++);await c.locator('[data-em-mix-confirm]').click();await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-result]').textContent.includes('변경'));
 assert.equal(await c.locator('[data-em-mix-confirm]').isChecked(),false);
 await c.locator('[data-em-concentration]').fill('0.5');await c.locator('[data-em-mix-confirm]').check();await c.locator('[data-em-save]').click();
 await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-save-state]').textContent.includes('다른 화면'));
 assert.equal(await p.evaluate(()=>calls.filter(c=>c.method==='PUT').length),0);assert.equal(await c.locator('[data-em-concentration]').inputValue(),'0.5');
 await c.locator('[data-em-reload]').click();await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-concentration]').value==='1');
 await c.locator('[data-em-concentration]').fill('0.5');await p.evaluate(()=>saveFail=true);await c.locator('[data-em-mix-confirm]').check();await c.locator('[data-em-save]').click();
 await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-save-state]').textContent.includes('실패'));
 assert.equal(await c.locator('[data-em-concentration]').inputValue(),'0.5');
});
test('input changed during save is not overwritten or marked saved',async t=>{
 const p=await page(t);await readyManager(p);const c=await emcard(p);
 await c.locator('[data-em-diluent]').selectOption('ns');await c.locator('[data-em-mix-confirm]').check();await p.evaluate(()=>saveDelay=200);await c.locator('[data-em-save]').click();
 await p.waitForFunction(()=>calls.some(c=>c.method==='POST'));await c.locator('[data-em-concentration]').fill('0.5');
 await p.waitForFunction(()=>document.querySelector('[data-em-drug=dobutamine] [data-em-save-state]').textContent.includes('이후 수정'));
 assert.equal(await c.locator('[data-em-concentration]').inputValue(),'0.5');assert.equal(await p.evaluate(()=>JSON.parse(stored[0].body.note.split('CARESTEP_SETUP_V1:')[1]).values.concentration),'1');
});
test('read-only and load failure disable persistence while retaining local reference calculations',async t=>{
 const p=await page(t);let c=await emcard(p);assert.equal(await c.locator('[data-em-save]').isDisabled(),true);
 await p.evaluate(()=>{failProducts=true;app.clear();app.calculator();});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');c=await emcard(p);
 assert.match(await c.locator('[data-em-save-state]').innerText(),/불러오기 실패/);assert.equal(await c.locator('[data-em-save]').isDisabled(),true);
 assert.match(await c.locator('[data-em-result]').innerText(),/0.6 mL\/hr/);
});

test('mobile setup avoids a second long list; back restores the same filter',async t=>{
 const p=await page(t,390);await kind(p,'emergency');await p.locator('[data-em-select]').count();
 const c=await emcard(p);assert.equal(await p.locator('.pt-em-quick').isVisible(),false);
 await c.locator('[data-em-back]').click();assert.equal(await p.locator('.pt-em-quick').isVisible(),true);assert.equal(await c.isVisible(),false);
});

test('clinic concentration source does not duplicate the saved origin label',()=>{
 const drug=emergency.drugs.find(d=>d.id==='dobutamine');
 const opts=emergency.concentrationOptions(drug,[{id:'s1',body:{title:'도부타민',kind:'liquid',unit:'mg',value:50,strength:{ingredientId:drug.ingredientId,route:'injection',release:'standard',species:['dog']}}}],'dog');
 assert.equal(opts[0].note,'도부타민');assert.equal(opts[0].clinic,true);
});
test('missing species explanation is shared while product restrictions remain',async t=>{
 const p=await page(t);await kind(p,'med');await p.locator('[data-ref-species]').selectOption('');
 await p.waitForFunction(()=>[...document.querySelectorAll('[data-protocol-status]')].filter(x=>/상단에서 동물 종류/.test(x.textContent)).every(x=>x.hidden));
 const common=p.locator('.pt-flow-context'); // shared context is independent from the disabled product controls
 assert.equal(await p.locator('[data-protocol-status]').filter({hasText:'상단에서 동물 종류'}).evaluateAll(xs=>xs.every(x=>x.hidden)),true);
});
