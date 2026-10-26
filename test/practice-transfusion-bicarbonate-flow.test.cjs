const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{resolve}=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
const modules=['clinic-tab-position',...[...readFileSync(resolve(root,'index.html'),'utf8').matchAll(/<script src="(practice-[^"?]+\.js)(?:\?[^" ]*)?"/g)].map(x=>x[1].slice(0,-3)).filter(x=>!['practice-intake','practice-clinic'].includes(x))];
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/practice-tools.css"><main id="root"></main>'+modules.map(x=>'<script src="/'+x+'.js"></script>').join('')+`<script>
var calls=[],selected=new URLSearchParams(location.search).has('patient')?{id:'p1',name:'시험 환자',guardianName:'시험 보호자',species:'dog'}:null,actor='synthetic',fail=false,delay=0,kind='tablet',blocked=false,administrative=false,empty=false,captured=null,stored=[],referenceData=null,weightDelay=0,presetDelay=0,failProducts=false,recordedWeight={weight:8.2,weightDate:'2026-10-20'},manager=false,saveFail=false,custom={};
const product=()=>({id:'mfds:200000001',sourceHash:'a'.repeat(64),source:'MFDS',name:kind==='injection'?'시험 주사제 20 mg':'시험 제품 20 mg',manufacturer:'시험 제조사',ingredientEnglish:['Synthetic'],permitStatus:administrative?'취하':'정상',checkedAt:'2026-10-23',sourceUrl:'https://nedrug.mfds.go.kr/test',components:[{ingredient:'시험 성분',amountRaw:'20',unitRaw:'mg',basisRaw:'1정',equivalenceRaw:'',normalization:'structured',per:'tablet',strengthBasis:'시험 성분',issues:[]}],issues:[],selection:{reasons:blocked?['복합제 원문 확인 필요']:administrative?['허가 상태 확인 필요','허가 상태 확인','수출용 표시']:[],option:blocked||administrative?null:{value:20,unit:'mg',form:kind==='tablet'?'tablet':'liquid',route:kind==='injection'?'injection':'oral'}},...custom});
var app=PracticeTools.mount(document.getElementById('root'),{ready:()=>true,identity:()=>actor,can:()=>true,navigate:()=>app.open(),patient:()=>selected,request:async(path,o={})=>{calls.push({path,method:o.method||'GET',body:o.body?JSON.parse(o.body):null});if(path==='/practice/strengths'){if(saveFail)throw Error('저장 연결 실패');const x=JSON.parse(o.body).items[0],old=stored.find(p=>p.body.strength?.ingredientId===x.ingredientId&&JSON.stringify(p.body.strength.species)===JSON.stringify(x.species));if(old&&old.revision!==x.revision)return {results:[{status:'conflict',message:'버전 충돌'}]};const id=old?.id||'new'+stored.length,p={id,revision:(old?.revision||0)+1,body:{title:x.name,value:x.value,unit:x.unit,kind:x.kind,strength:{version:1,ingredientId:x.ingredientId,name:x.name,english:x.english,aliases:x.aliases,species:x.species,route:x.route,release:x.release,calculationBasis:x.basis,sourceUrl:x.sourceUrl,checkedAt:x.checkedAt}}};stored=stored.filter(y=>y.id!==id).concat(p);return {results:[{status:'saved',id}]};}if(path==='/practice/formulary'){if(saveFail)throw Error('저장 연결 실패');const b=JSON.parse(o.body),p=product(),id='cf_test';stored=[{id,revision:(stored[0]?.revision||0)+1,body:{title:p.name,kind:b.kind,value:b.value,unit:b.unit,formulary:{version:1,productId:p.id,sourceHash:p.sourceHash,sourceUrl:p.sourceUrl,checkedAt:p.checkedAt,permitStatus:p.permitStatus,aliases:b.aliases,species:b.species,route:b.route,verification:b.verification,entryMode:b.entryMode,calculatorReady:b.calculatorReady,calculationBasis:b.calculationBasis,warnings:p.selection.reasons}}}];return {ok:true,id};}if(path.startsWith('/practice/products/item/'))return {ok:true,item:product()};if(path.startsWith('/practice/products')){if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('연결 확인');return {ok:true,canManage:false,catalog:empty?null:{id:'prod_test',count:1,checkedAt:'2026-10-23'},items:empty?[]:[product()],hasMore:false};}if(path.startsWith('/practice/patient/')){if(weightDelay)await new Promise(r=>setTimeout(r,weightDelay));return {patient:recordedWeight};}if(path==='/practice/presets'&&o.method==='POST'){captured=JSON.parse(o.body);stored.push({id:'saved'+stored.length,revision:1,updated_at:'2026-10-26',body:captured});return {ok:true};}if(path.startsWith('/practice/presets')){if(failProducts)throw Error('시험 약품 연결 실패');if(presetDelay)await new Promise(r=>setTimeout(r,presetDelay));return {ok:true,items:structuredClone(stored),canManage:manager,strengthsVersion:1,protocolsVersion:1};}if(path==='/practice/references')return {libraries:referenceData?[{id:'test',title:'Synthetic reference',status:'ready',count:1}]:[],canManage:false};if(path==='/practice/references/test')return {id:'test',title:'Synthetic reference',sourceHash:'a'.repeat(64),checkedAt:'2026-10-26',index:[referenceData]};if(path==='/practice/references/test/entries/entry')return {entry:referenceData};if(path.startsWith('/operations'))return {runs:[],templates:[],members:[],manager:false};if(path.startsWith('/intakes'))return {items:[],next:'',canEdit:false};return {items:[]};}});app.calculator();
</script>`);}try{res.end(readFileSync(resolve(root,path.slice(1))));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();server.close();});


async function page(t,width=1280){const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});await p.goto(origin+'/fixture');await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');return p;}
async function kind(p,k){await p.locator('[data-kind="'+k+'"]').evaluate(e=>e.click());return p.locator('[data-kind-panel="'+k+'"]');}
async function inject(p,rows){await p.evaluate(rows=>{stored=rows;manager=true;app.clear();app.calculator();},rows);await p.locator('[data-calcium-product] option').first().waitFor({state:'attached'});await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}


const c=require('../practice-calculators.js');
test('duration presents hours/minutes/seconds without decimal hours',()=>{
 for(const [input,expected] of [[3.75,'3시간 45분'],[.25,'15분'],[4,'4시간'],[0,'0분'],[1.99999,'2시간'],[1/3600,'1초']])assert.equal(c.duration(input),expected);
});
test('dose-only bicarbonate returns amount and stock without pretending to supply an infusion rate',()=>{
 const r=c.bicarbonate({weight:5,method:'be',measured:-12,target:0,factor:.3,fraction:25,stock:'1',doseOnly:'on'});
 assert.equal(r.amount,4.5);assert.equal(r.stockML,4.5);assert.equal(r.rate,undefined);assert.equal(r.diluentML,undefined);
 assert.throws(()=>c.bicarbonate({weight:5,method:'be',measured:12,target:0,factor:.3,fraction:25,stock:'1',doseOnly:'on'}));
});
for(const width of [390,1280])test('transfusion groups pump and gravity by stage '+width,async t=>{
 const p=await page(t,width);await kind(p,'transfusion');const f=p.locator('[data-calc=transfusion]');
 await f.locator('[name=product]').selectOption('whole');
 for(const [key,value] of Object.entries({current:'15',target:'25',unitPcv:'45'}))await f.locator('[name='+key+']').fill(value);
 await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();await f.locator('.pt-tf-stage').first().waitFor();
 assert.equal(await f.locator('.pt-tf-stage').count(),2);
 const text=await f.locator('output').innerText();assert.match(text,/3시간 45분/);assert.doesNotMatch(text,/3\.75시간/);assert.match(text,/23.54 mL\/hr/);assert.match(text,/72초마다 1방울/);assert.match(text,/7.65초마다 1방울/);
 assert.match(await f.locator('.pt-tf-total').innerText(),/88.89 mL/);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await f.locator('output').screenshot({path:resolve(root,'../transfusion-stages-'+width+'.png')});
 await f.locator('[name=target]').fill('26');assert.equal(await f.locator('output').textContent(),'');
});
async function bicarbonate(p){await kind(p,'acid');await p.locator('[data-acid-view=bicarbonate]').click();return p.locator('[data-calc=bicarbonate]');}
for(const width of [390,1280])test('bicarbonate needs only laboratory values and real concentration by default '+width,async t=>{
 const p=await page(t,width),f=await bicarbonate(p);
 assert.equal(await f.locator('[name=factor]').inputValue(),'0.3');assert.equal(await f.locator('[name=fraction]').inputValue(),'25');
 assert.equal(await f.locator('[name=volume]').isEnabled(),false);
 await f.locator('[name=measured]').fill('12');await f.locator('[name=target]').fill('18');await f.locator('[name=stock]').selectOption('1');
 await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();
 const text=await f.locator('output').textContent();assert.match(text,/이번 보정량 2.25 mEq/);assert.match(text,/중탄산 원액 2.25 mL/);assert.doesNotMatch(text,/NaN|undefined|펌프 속도/);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await f.screenshot({path:resolve(root,'../bicarbonate-simple-'+width+'.png')});
 await f.locator('[name=method]').selectOption('be');assert.equal(await f.locator('[name=target]').inputValue(),'0');assert.equal(await f.locator('[name=measured]').inputValue(),'');assert.equal(await f.locator('output').textContent(),'');
 await f.locator('[name=measured]').fill('-12');await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();assert.match(await f.locator('output').textContent(),/이번 보정량 4.5 mEq/);
});
test('optional infusion requires a real dilution plan; quick choices and copied results retain units',async t=>{
 const p=await page(t),f=await bicarbonate(p);await f.locator('[name=measured]').fill('12');await f.locator('[name=target]').fill('18');await f.locator('[name=stock]').selectOption('0.5');
 await f.locator('[name=doseOnly]').uncheck();assert.equal(await f.locator('[name=volume]').isEnabled(),true);
 await f.locator('[data-bc-quick="volume:20"]').click();await f.locator('[data-bc-quick="minutes:120"]').click();await f.locator('[data-bc-quick="diluent:D5W"]').click();
 await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();
 let text=await f.locator('output').textContent();assert.match(text,/중탄산 원액 4.5 mL/);assert.match(text,/D5W 15.5 mL/);assert.match(text,/계획한 2시간 동안 · 펌프 속도 10 mL\/hr/);
 await f.locator('[name=volume]').fill('4');await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();assert.match(await f.locator('output').textContent(),/최종 부피는 원액량보다 커야/);
 await f.locator('[name=doseOnly]').check();await f.locator('[name=confirmed]').check();await f.locator('button.pt-primary').click();assert.doesNotMatch(await f.locator('output').textContent(),/펌프 속도/);
});

test('optional sample does not falsely block completion and full hospital protocol enables infusion',async t=>{
 const p=await page(t),f=await bicarbonate(p);await f.locator('[name=method]').selectOption('be');await f.locator('[name=measured]').fill('-12');await f.locator('[name=stock]').selectOption('1');await f.locator('[name=confirmed]').check();
 assert.match(await f.locator('[data-remaining=bicarbonate]').innerText(),/필수 입력 완료/);
 await p.evaluate(()=>document.getElementById('root').dispatchEvent(new CustomEvent('practice-protocol-applied',{bubbles:true,detail:{calculator:'bicarbonate',id:'fixture',protocol:{}}})));
 // Event is dispatched at calculator workspace by the protocol loader.
 await p.evaluate(()=>document.querySelector('[data-calc=bicarbonate]').closest('.pt-calculator-focused').dispatchEvent(new CustomEvent('practice-protocol-applied',{detail:{calculator:'bicarbonate',id:'fixture',protocol:{}}})));
 assert.equal(await f.locator('[name=doseOnly]').isChecked(),false);assert.equal(await f.locator('[name=volume]').isEnabled(),true);
 await f.locator('[name=factor]').evaluate(e=>e.value='.5');
 await p.locator('[data-ref-species]').selectOption('cat');
 assert.equal(await f.locator('[name=factor]').inputValue(),'0.3');assert.equal(await f.locator('[name=fraction]').inputValue(),'25');assert.equal(await f.locator('[name=doseOnly]').isChecked(),true);assert.equal(await f.locator('[name=volume]').isEnabled(),false);
});
