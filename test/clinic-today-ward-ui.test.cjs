const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,server,origin;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});server=http.createServer((req,res)=>{try{const f=path.join(root,new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;});
after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
async function openPage(t,width=1680){
 const p=await browser.newPage({viewport:{width,height:1000}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/index.html');
 await p.evaluate(()=>{saasMode='auth';saasSessionMeta={id:'flow-test'};saasMe={role:'owner',clinic:{id:'synthetic'},user:{id:'owner'}};saasRequest=async path=>path.includes('/presets')?{items:[{id:'cf_carprofen',revision:1,body:{kind:'tablet',title:'시험 카프로펜 25mg',value:25,unit:'mg',formulary:{version:1,calculatorReady:true,route:'oral',species:['dog'],aliases:['carprofen'],calculationBasis:'carprofen',warnings:[],sourceUrl:'https://example.test/label',checkedAt:'2026-10-25'}}}],canManage:true,protocolsVersion:1,strengthsVersion:1}:path.includes('/references')?{libraries:[],canManage:false}:{ok:true,runs:[],templates:[],members:[],items:[],manager:true,userId:'owner'};showApp();go('practice');});
 await navigatePractice(p,'처방·처치 계산');return p;
}
async function openKind(p,kind){if(p.viewportSize().width<=800)await p.locator('[data-calc-jump]').selectOption(kind);else await p.locator('.pt-calc-menu [data-kind="'+kind+'"]').click();await p.waitForTimeout(100);}
async function context(p){await p.locator('[data-ref-species]').selectOption('dog');await p.locator('[data-common-weight]').fill('5');}
async function navigatePractice(p,label){const keys={'처방·처치 계산':'calc','사전문진':'intake','업무 체크리스트':'ops'},nav=p.locator('.clinic-navigation');if(await nav.count()){if(!await nav.isVisible())await p.locator('[data-practice-menu]').click();const button=nav.locator('[data-tab="'+keys[label]+'"]'),group=button.locator('xpath=ancestor::details[1]');if(!await group.evaluate(d=>d.open))await group.locator('summary').first().click();await button.click();}else await p.getByRole('button',{name:label,exact:true}).click();}


for(const width of [390,1680])test('today inpatient layout and direct patient navigation '+width,async t=>{
 const p=await openPage(t,width);
 await p.evaluate(()=>{
 const item={id:'ward-test',kind:'admission',status:'active',revision:1,patient_id:'',patient:{name:'입원 시험환자',species:'cat'},body:{species:'cat',weight:4,title:'입원',location:'고양이 1',tasks:[],orders:[],infusions:[],wardChecks:[]}};
 const old=saasRequest;saasRequest=async(path,options)=>path.endsWith('/clinical/cases')?{items:[item],hasMore:false}:path.endsWith('/clinical/cases/ward-test')?{item,events:[],canRecord:true}:path.endsWith('/clinical/rooms')?{items:[{id:'room-test',name:'고양이 1',patientCase:item}]}:old(path,options);go('dashboard');
 });
 assert.equal(await p.locator('#dashboard .recent-patients, #workRecentPatients').count(),0);
 await p.evaluate(()=>renderWorkFirstDashboard());
 const grid=await p.locator('#clinicHomePrimary').boundingBox(),queue=await p.locator('#clinicTodayQueue').boundingBox();assert.ok(Math.abs(grid.width-queue.width)<2,'today queue uses available width');
 const overview=p.locator('#wardTodayRoot');await overview.getByRole('button',{name:/입원 시험환자/}).waitFor();assert.match(await overview.innerText(),/입원 중 1마리 · 개 0 · 고양이 1/);
 const ward=await overview.boundingBox(),ops=await p.locator('#practiceTodayRoot').boundingBox();if(width>1000){assert.ok(ward.x>ops.x);assert.equal(ward.y,ops.y);}else assert.ok(ward.y>=ops.y+ops.height);
 assert.ok(await p.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(root,'../today-ward-'+width+'.png'),fullPage:true});
 await overview.getByRole('button',{name:/입원 시험환자/}).click();await p.locator('.cl-workspace[data-section=ward]').waitFor();await p.waitForFunction(()=>document.querySelector('.cl-ward-detail')?.textContent.includes('입원 시험환자'));
 assert.match(await p.locator('.cl-ward-detail').innerText(),/입원 시험환자/);
});
