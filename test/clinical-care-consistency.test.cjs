const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER}));after(async()=>browser?.close());
async function fixture(t,width=1440,medical=true){
 const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.abort());await p.setContent('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width"><body style="margin:12px"><main id="root"></main></body></html>');
 for(const f of ['clinical-workspace.css','staff-training.css','clinical-knowledge.css','clinical-care-ui.css'])await p.addStyleTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 for(const f of ['clinical-compact.js','clinical-knowledge.js','clinical-workspace.js'])await p.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 await p.evaluate(({medical})=>{
  const doc=i=>({id:'protocol'+i,title:'합성 각막 '+String(i).padStart(2,'0'),species:i%2?'dog':'cat',status:'published',version:1,revision:1,body:{title:'합성 각막 '+String(i).padStart(2,'0'),disease:'각막',species:i%2?'dog':'cat',summary:'실제 진료에 사용하지 않는 시험 자료',steps:[{id:'s',stage:'assessment',title:'합성 단계',detail:'합성 단계 내용',calculator:'fluid'}],sources:[],trainingVersionId:''},sources:[],gaps:[],gapResolutions:[]});
  window.docs=Array.from({length:30},(_,i)=>doc(i));window.calls=[];window.moves=[];window.identity='synthetic';window.failCommon=false;
  const stamp=new Date().toISOString();window.wardItem={id:'case1',revision:1,status:'active',kind:'admission',patient:{name:'합성 입원 환자',breed:'합성 품종',birthDate:'2020-01-01',sex:'MN'},body:{species:'dog',weight:5,title:'입원',careTeam:{chiefComplaint:'합성 주호소',veterinarianName:'합성 수의사',technicianName:'합성 테크니션'},tasks:[],orders:[],wardChecks:[],infusions:[],latestMonitoring:{observedAt:stamp,appetite:'normal',energy:'reduced',vomiting:'none',feces:'normal',urine:'unknown'},wardVitals:{temperature:{value:38.5,observedAt:stamp},weightKG:{value:5,observedAt:stamp}}}};
  const adapter={ready:()=>true,identity:()=>identity,medical:()=>medical,can:()=>true,externalTabs:true,patient:()=>null,calculator:(patient,kind)=>moves.push({patient,kind}),request:async(url,o={})=>{
   calls.push({url,method:o.method||'GET'});if(url.endsWith('/knowledge-protocols')){if(failCommon)throw Error('Synthetic offline');return {items:docs};}
   if(url.includes('/knowledge-protocols/'))return {document:docs.find(d=>url.endsWith(d.id))};
   if(url.endsWith('/clinical/protocols'))return {items:docs};
   if(url.endsWith('/clinical/rooms'))return {items:[{id:'room1',name:'강아지 입원실 01',kind:'dog',care_state:'ready',patientCase:wardItem}]};
   if(url.endsWith('/clinical/cases'))return {items:[wardItem],hasMore:false};
   if(url.endsWith('/clinical/cases/case1'))return {item:wardItem,events:[],canRecord:true};
   if(url.endsWith('/members'))return {members:[{id:'staff',display_name:'합성 수행자'}],userId:'staff'};
   return {items:[],events:[],courses:[],hasMore:false};
  }};window.app=ClinicalWorkspace.mount(document.querySelector('#root'),adapter);
 },{medical});
 t.after(async()=>{await p.evaluate(()=>app.dispose());await p.close();assert.deepEqual(errors,[]);});return p;
}
for(const width of [390,1440])test('protocol navigation: same reader, preserved filters/page/focus, no extra list reads '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>app.open('protocols'));await p.locator('[data-protocol-source=hospital]').click();await p.locator('[data-protocol-species]').selectOption('dog');await p.locator('[data-protocol-page="2"]').click();
 const card=p.locator('[data-cl-action=hospital-protocol]').first(),title=await card.innerText();await card.click();assert.equal(await p.locator('.ck-protocol-reader').count(),1);assert.match(await p.locator('.ck-step').innerText(),/합성 단계 내용/);assert.equal(await p.evaluate(()=>calls.length),2);
 await p.locator('[data-ck-close]').click();assert.match(await p.locator('.cl-protocol-pages').innerText(),/2 [/] 2/);assert.equal(await p.locator('[data-protocol-species]').inputValue(),'dog');assert.equal(await p.evaluate(()=>document.activeElement.innerText),title);
 await card.click();await p.locator('[data-ck-calculator]').click();assert.equal(await p.locator('dialog').count(),0);assert.equal(await p.evaluate(()=>moves[0].kind),'fluid');
 await p.locator('[data-protocol-source=common]').click();await p.locator('[data-cl-action=common-protocol]').first().click();await p.locator('.ck-step').waitFor();assert.equal(await p.locator('dialog h2').count(),1);assert.equal(await p.locator('[data-ck=publish]').count(),0);await p.locator('[data-ck-close]').click();assert.equal(await p.evaluate(()=>calls.filter(c=>c.url.endsWith('/clinical/protocols')||c.url.endsWith('/knowledge-protocols')).length),2);assert.equal(await p.evaluate(()=>calls.some(c=>c.method!=='GET')),false);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
test('protocol navigation: source failure retains hospital content and retry does not reload hospital',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{failCommon=true;return app.open('protocols');});await p.locator('[data-protocol-source=hospital]').click();assert.equal(await p.locator('[data-cl-action=hospital-protocol]').count(),12);await p.locator('[data-protocol-source=common]').click();await p.evaluate(()=>failCommon=false);await p.locator('[data-cl-action=protocol-retry]').click();await p.locator('[data-cl-action=common-protocol]').first().waitFor();assert.equal(await p.evaluate(()=>calls.filter(c=>c.url.endsWith('/clinical/protocols')).length),1);
});
test('protocol navigation: nonmedical reader cannot publish revise or apply',async t=>{
 const p=await fixture(t,390,false);await p.evaluate(()=>app.open('protocols'));await p.locator('[data-protocol-source=hospital]').click();await p.locator('[data-cl-action=hospital-protocol]').first().click();assert.equal(await p.locator('[data-ck-hospital]').count(),0);assert.equal(await p.evaluate(()=>calls.some(c=>c.method!=='GET')),false);
});
for(const width of [390,1440])test('ward summary: complaint and abnormal observations appear once while unknown stays distinct '+width,async t=>{
 const p=await fixture(t,width);await p.evaluate(()=>app.open('ward'));await p.locator('[data-room-card=room1]').waitFor();const card=p.locator('[data-room-card=room1]');
 await card.locator('.cl-room-details').evaluate(e=>e.open=true);assert.equal((await card.innerText()).split('합성 주호소').length-1,1);assert.equal(await card.locator('.cl-monitor-abnormal').count(),1);assert.match(await card.innerText(),/미관찰/);assert.ok(await card.locator('[data-monitor=appetite]').count());assert.equal(await card.locator('.cl-care-cc').count(),0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.resolve(root,'../care-ward-summary-'+width+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>calls.some(c=>c.method!=='GET')),false);
});
