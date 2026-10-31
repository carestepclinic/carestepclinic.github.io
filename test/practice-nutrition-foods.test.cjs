const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
const catalog=require('../practice-food-catalog.json'),foods=require('../practice-nutrition-foods.js');
test('catalog contains four official lineups, explicit missing values and normalized calorie units',()=>{
 assert.equal(catalog.items.length,294);assert.equal(new Set(catalog.items.map(p=>p.id)).size,294);
 assert.equal(catalog.items.filter(p=>p.brand==='royalcanin').length,83);assert.equal(catalog.items.filter(p=>p.brand==='hills').length,58);
 assert.equal(catalog.items.filter(p=>p.brand==='naturalbalance').length,43);assert.equal(catalog.items.filter(p=>p.brand==='purina'&&p.purpose!=='reference').length,99);assert.equal(catalog.items.filter(p=>p.purpose==='reference').length,11);assert.ok(catalog.items.every(foods.valid));assert.equal(catalog.items.filter(p=>p.energy).length,140);
 assert.ok(catalog.items.filter(p=>p.status!=='verified').every(p=>p.energy===null));
 assert.equal(catalog.items.find(p=>p.id==='rc-3911').energy.value,4120);
 assert.equal(catalog.items.find(p=>p.id==='rc-4022').energy,null); // discrepant dry/wet values on source page
 assert.equal(catalog.items.find(p=>p.id==='rc-4910').energy.unit,'kcal/kg'); // never assume g = mL
 assert.ok(foods.search(catalog.items,{species:'cat',query:'리커버리'}).length);
 assert.ok(foods.search(catalog.items,{species:'cat',brand:'hills',query:'i/d'}).every(p=>p.species.includes('cat')));
 assert.equal(foods.search(catalog.items,{species:'cat',query:'u/d'}).length,0);
 assert.equal(catalog.items.find(p=>p.id==='nb-774').energy.value,3590);
 for(const id of ['nb-861','nb-99','nb-97','nb-284','purina-3658'])assert.equal(catalog.items.find(p=>p.id===id).energy,null);
 assert.equal(foods.search(catalog.items,{brand:'naturalbalance',query:'내추럴발란스'}).length,43);
 assert.ok(foods.search(catalog.items,{species:'dog',form:'reference',query:'PPVD'}).some(x=>x.id==='purina-family-ha'));
 assert.equal(foods.search(catalog.items,{species:'dog',query:'Liveclear'}).length,0);
 assert.ok(foods.search(catalog.items,{form:'dry'}).every(x=>!x.purpose||x.purpose==='food'));
 assert.ok(!foods.canApply(catalog.items.find(x=>x.id==='nb-260')));
 assert.ok(!foods.valid({...catalog.items[0],sourceUrls:[]}));assert.ok(!foods.valid({...catalog.items[0],sourceUrls:['https://naturalbalance.co.kr.evil.test/']}));
 assert.ok(!foods.valid({...catalog.items.find(x=>x.purpose==='reference'),energy:{value:1,unit:'kcal/g'},status:'verified'}));
});
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function openPage(t,width=1680){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/index.html');
 await p.evaluate(()=>{saasMode='auth';saasSessionMeta={id:'flow-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[{id:'cf_carprofen',revision:1,body:{kind:'tablet',title:'시험 카프로펜 25mg',value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['carprofen'],calculationBasis:'carprofen',warnings:[],sourceUrl:'https://example.test/label',checkedAt:'2026-10-25'}}}],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');});
 await navigatePractice(p,'임상 계산기');return p;
}
async function openKind(p,kind){if(p.viewportSize().width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('.pt-calc-menu [data-kind="'+kind+'"]').click();await p.waitForTimeout(100);}
async function context(p){await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}

async function navigatePractice(p,label){const keys={'임상 계산기':'calc','사전문진':'intake','업무 체크리스트':'ops'},nav=p.locator('.clinic-navigation');if(await nav.count()){if(!await nav.isVisible())await p.locator('[data-practice-menu]').click();const button=nav.locator('[data-tab="'+keys[label]+'"]'),group=button.locator('xpath=ancestor::details[1]');if(!await group.evaluate(d=>d.open))await group.locator('summary').first().click();await button.click();}else await p.getByRole('button',{name:label,exact:true}).click();}

for(const width of [390,1440])test('food selection, calories, manual override and missing data '+width,async t=>{
 const p=await openPage(t,width);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');const select=f.locator('[data-food-product]');await p.waitForFunction(()=>document.querySelector('[data-food-product]')?.options.length>1);
 await f.locator('[name=nutritionProfile]').selectOption('rest');await f.locator('[name=meals]').fill('2');assert.equal(await f.locator('[name=other]').inputValue(),'0');await select.selectOption('rc-3911');assert.equal(await f.locator('[name=density]').inputValue(),'4120');assert.equal(await f.locator('[name=unit]').inputValue(),'kcal/kg');
 await p.waitForTimeout(1200);assert.match(await f.locator('output').textContent(),/가스트로인테스티널/);assert.match(await f.locator('output').textContent(),/하루 급여량/);
 await f.locator('[name=density]').fill('4000');assert.match(await f.locator('[data-food-energy]').innerText(),/이번 계산/);assert.equal(await f.locator('output').textContent(),'');
 await select.selectOption('rc-4022');assert.equal(await f.locator('[name=density]').inputValue(),'');assert.equal(await f.locator('[name=unit]').inputValue(),'');assert.match(await f.locator('[data-food-energy]').innerText(),/확인 필요/);
 await f.locator('[name=density]').fill('1.2');await f.locator('[name=unit]').selectOption('kcal/g');await p.waitForTimeout(1200);assert.match(await f.locator('output').textContent(),/직접 입력값/);
 await f.locator('[data-food-brand]').selectOption('hills');await f.locator('[data-food-search]').fill('w/d');const options=await select.locator('option').allTextContents();assert.ok(options.some(x=>x.includes('354 g')));
 const can=catalog.items.find(x=>x.brand==='hills'&&x.name.includes('w/d')&&x.energy?.packageGrams===354);await select.selectOption(can.id);assert.equal(await f.locator('[name=density]').inputValue(),'201');assert.equal(await f.locator('[name=unit]').inputValue(),'kcal/can');
 await p.waitForTimeout(1200);assert.match(await f.locator('output').textContent(),/354 g 캔/);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await f.locator('[data-food-detail]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(root,'../nutrition-foods-'+width+'.png')});
 await p.locator('[data-ref-species]').selectOption('cat');assert.equal(await select.inputValue(),'');assert.equal(await f.locator('[name=density]').inputValue(),'');assert.equal(await f.locator('[data-food-detail]').isVisible(),false);
 assert.equal(await select.locator('option[value="rc-3911"]').count(),0);
});
test('catalog is lazy, failed loads retry without blocking manual entry, and requests are reused',async t=>{
 const p=await openPage(t);await context(p);let calls=0;await p.route('**/practice-food-catalog.json*',r=>{calls++;return calls===1?r.fulfill({status:503,body:'unavailable'}):r.continue();});assert.equal(calls,0);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]');await f.locator('[data-food-retry]').waitFor();await f.locator('[data-food-retry]').click();await p.waitForFunction(()=>document.querySelector('[data-food-product]').options.length>1);assert.equal(calls,2);
 await openKind(p,'fluid');await openKind(p,'nutrition');assert.equal(calls,2);
});

for(const width of [390,1440])test('new brands, treats and unknown product families '+width,async t=>{
 const p=await openPage(t,width);await context(p);await openKind(p,'nutrition');const f=p.locator('[data-calc=nutrition]'),select=f.locator('[data-food-product]');await p.waitForFunction(()=>document.querySelector('[data-food-product]')?.options.length>1);
 await f.locator('[data-food-brand]').selectOption('naturalbalance');await select.selectOption('nb-774');assert.equal(await f.locator('[name=density]').inputValue(),'3590');assert.equal(await f.locator('[name=unit]').inputValue(),'kcal/kg');
 await select.selectOption('nb-861');assert.equal(await f.locator('[name=density]').inputValue(),'');assert.match(await f.locator('[data-food-energy]').innerText(),/확인 필요/);
 await f.locator('[data-food-form]').selectOption('treat');await select.selectOption('nb-260');assert.equal(await f.locator('[name=density]').inputValue(),'');assert.match(await f.locator('[data-food-energy]').innerText(),/3,100.*참고용/);assert.match(await f.locator('[data-food-note]').innerText(),/자동 적용하지/);
 await f.locator('[data-food-brand]').selectOption('purina');await f.locator('[data-food-form]').selectOption('');await select.selectOption('purina-1775');assert.equal(await f.locator('[name=density]').inputValue(),'3.8');assert.equal(await f.locator('[name=unit]').inputValue(),'kcal/g');
 await select.selectOption('purina-3971');assert.equal(await f.locator('[name=density]').inputValue(),'');assert.equal(await f.locator('[name=unit]').inputValue(),'');
 await f.locator('[data-food-form]').selectOption('reference');await select.selectOption('purina-family-ha');assert.match(await f.locator('[data-food-note]').innerText(),/대상 동물/);assert.equal(await f.locator('[name=density]').inputValue(),'');
 await p.locator('[data-ref-species]').selectOption('cat');await f.locator('[data-food-brand]').selectOption('purina');await select.selectOption('purina-2116');assert.equal(await f.locator('[name=density]').inputValue(),'93.5');assert.equal(await f.locator('[name=unit]').inputValue(),'kcal/can');
 await f.locator('[data-food-detail]').scrollIntoViewIfNeeded();assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(root,'../nutrition-expanded-'+width+'.png')});
});
