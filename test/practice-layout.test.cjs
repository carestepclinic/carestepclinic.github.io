const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{resolve}=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
const modules=['clinic-tab-position',...[...readFileSync(resolve(root,'index.html'),'utf8').matchAll(/<script src="(practice-[^"?]+\.js)(?:\?[^" ]*)?"/g)].map(x=>x[1].slice(0,-3)).filter(x=>!['practice-intake','practice-clinic'].includes(x))];
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/practice-tools.css"><main id="root"></main>'+modules.map(x=>'<script src="/'+x+'.js"></script>').join('')+`<script>
var calls=[],selected=new URLSearchParams(location.search).has('patient')?{id:'p1',name:'시험 환자',guardianName:'시험 보호자',species:'dog'}:null,actor='synthetic',fail=false,delay=0,kind='tablet',blocked=false,administrative=false,empty=false,captured=null,stored=[],weightDelay=0,presetDelay=0,failProducts=false,recordedWeight={weight:8.2,weightDate:'2026-10-20'},manager=false,saveFail=false,custom={};
const product=()=>({id:'mfds:200000001',sourceHash:'a'.repeat(64),source:'MFDS',name:kind==='injection'?'시험 주사제 20 mg':'시험 제품 20 mg',manufacturer:'시험 제조사',ingredientEnglish:['Synthetic'],permitStatus:administrative?'취하':'정상',checkedAt:'2026-10-23',sourceUrl:'https://nedrug.mfds.go.kr/test',components:[{ingredient:'시험 성분',amountRaw:'20',unitRaw:'mg',basisRaw:'1정',equivalenceRaw:'',normalization:'structured',per:'tablet',strengthBasis:'시험 성분',issues:[]}],issues:[],selection:{reasons:blocked?['복합제 원문 확인 필요']:administrative?['허가 상태 확인 필요','허가 상태 확인','수출용 표시']:[],option:blocked||administrative?null:{value:20,unit:'mg',form:kind==='tablet'?'tablet':'liquid',route:kind==='injection'?'injection':'oral'}},...custom});
var app=PracticeTools.mount(document.getElementById('root'),{ready:()=>true,identity:()=>actor,can:()=>true,navigate:()=>app.open(),patient:()=>selected,request:async(path,o={})=>{calls.push({path,method:o.method||'GET',body:o.body?JSON.parse(o.body):null});if(path==='/practice/strengths'){if(saveFail)throw Error('저장 연결 실패');const x=JSON.parse(o.body).items[0],old=stored.find(p=>p.body.strength?.ingredientId===x.ingredientId&&JSON.stringify(p.body.strength.species)===JSON.stringify(x.species));if(old&&old.revision!==x.revision)return {results:[{status:'conflict',message:'버전 충돌'}]};const id=old?.id||'new'+stored.length,p={id,revision:(old?.revision||0)+1,body:{title:x.name,value:x.value,unit:x.unit,kind:x.kind,strength:{version:1,ingredientId:x.ingredientId,name:x.name,english:x.english,aliases:x.aliases,species:x.species,route:x.route,release:x.release,calculationBasis:x.basis,sourceUrl:x.sourceUrl,checkedAt:x.checkedAt}}};stored=stored.filter(y=>y.id!==id).concat(p);return {results:[{status:'saved',id}]};}if(path==='/practice/formulary'){if(saveFail)throw Error('저장 연결 실패');const b=JSON.parse(o.body),p=product(),id='cf_test';stored=[{id,revision:(stored[0]?.revision||0)+1,body:{title:p.name,kind:b.kind,value:b.value,unit:b.unit,formulary:{version:1,productId:p.id,sourceHash:p.sourceHash,sourceUrl:p.sourceUrl,checkedAt:p.checkedAt,permitStatus:p.permitStatus,aliases:b.aliases,species:b.species,route:b.route,verification:b.verification,entryMode:b.entryMode,calculatorReady:b.calculatorReady,calculationBasis:b.calculationBasis,warnings:p.selection.reasons}}}];return {ok:true,id};}if(path.startsWith('/practice/products/item/'))return {ok:true,item:product()};if(path.startsWith('/practice/products')){if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('연결 확인');return {ok:true,canManage:false,catalog:empty?null:{id:'prod_test',count:1,checkedAt:'2026-10-23'},items:empty?[]:[product()],hasMore:false};}if(path.startsWith('/practice/patient/')){if(weightDelay)await new Promise(r=>setTimeout(r,weightDelay));return {patient:recordedWeight};}if(path.startsWith('/practice/presets')){if(failProducts)throw Error('시험 약품 연결 실패');if(presetDelay)await new Promise(r=>setTimeout(r,presetDelay));return {ok:true,items:structuredClone(stored),canManage:manager,strengthsVersion:1,protocolsVersion:1};}if(path==='/practice/references')return {libraries:[],canManage:false};if(path.startsWith('/operations'))return {runs:[],templates:[],members:[],manager:false};if(path.startsWith('/intakes'))return {items:[],next:'',canEdit:false};return {items:[]};}});app.calculator();
</script>`);}try{res.end(readFileSync(resolve(root,path.slice(1))));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();server.close();});

for(const width of [390,800,820,1182,1440])test('all calculator panels retain usable content width and placement '+width,async t=>{
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await p.goto(origin+'/fixture');
 await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');
 const kinds=await p.locator('[data-kind]').evaluateAll(es=>es.map(e=>e.dataset.kind));
 for(const kind of kinds){
  if(width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('[data-kind="'+kind+'"]').click();
  const bounds=await p.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
   return {nav:rect('.pt-calc-nav'),main:rect('.pt-calc-main'),layout:rect('.pt-calc-layout'),active:rect('[data-kind-panel]:not([hidden])'),overflow:document.body.scrollWidth>innerWidth+1};
  });
  assert.ok(bounds.main.width>=(width>800?bounds.layout.width-220:bounds.layout.width-2),kind+' content squeezed: '+JSON.stringify(bounds));
  if(width>800){assert.ok(bounds.main.x>bounds.nav.x+bounds.nav.width,kind+' content must be beside menu');assert.ok(Math.abs(bounds.main.y-bounds.layout.y)<2,kind+' content must start in the first row');}
  else assert.ok(bounds.main.y>=bounds.nav.bottom-2,kind+' mobile content must follow menu');
  assert.equal(bounds.overflow,false,kind+' page overflow');
  assert.ok(bounds.active.width>=bounds.main.width-2,kind+' panel width');
 }
 if(width<=800)await p.locator('[data-calc-jump]').selectOption('emergency');else await p.locator('[data-kind=emergency]').click();
 await p.screenshot({path:resolve(root,'../calculator-layout-'+width+'.png')});
 await p.locator('.pt-view-options>summary').click();await p.locator('[data-calc-nav-toggle]').click();
 assert.equal(await p.locator('.pt-calc-nav').isVisible(),false);
 const widths=await p.evaluate(()=>({main:document.querySelector('.pt-calc-main').getBoundingClientRect().width,layout:document.querySelector('.pt-calc-layout').getBoundingClientRect().width}));
 assert.ok(Math.abs(widths.main-widths.layout)<2,'collapsed menu uses full width');
 assert.equal(await p.locator('[data-common-weight]').inputValue(),'5');
 assert.equal(await p.evaluate(()=>calls.some(x=>x.method!=='GET')),false);
});
