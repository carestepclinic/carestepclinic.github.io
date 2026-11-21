const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let browser,server,url;
before(async()=>{server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1),file=path.join(root,name||'index.html');if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server.close(r));});
async function fixture(t,width=1440){
 const p=await browser.newPage({viewport:{width,height:900}});p.setDefaultTimeout(7000);const errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(new URL(r.url()).pathname));
 await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url);await p.evaluate(()=>{
  saasMode='auth';saasToken='synthetic';saasSessionMeta={id:'local'};saasMe={role:'owner',clinic:{id:'local'},user:{id:'owner'}};
  saasRequest=async()=>({ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null});showApp({deferFullRender:true});
 });t.after(async()=>{assert.deepEqual(errors,[]);await p.close();});return {p,requests};
}
async function goTab(p,key){await p.evaluate(key=>go('practice',{practiceTab:key}),key);}
for(const width of [390,1440])test('support modules load on demand and scaling stays in surgery through save and reload '+width,async t=>{
 const {p,requests}=await fixture(t,width);
 for(const file of ['clinic-support.js','surgery-ledger.js','clinic-purchases.js','surgery-consent-form.js','consent-pagination.js'])assert.ok(!requests.includes('/'+file));
 await p.evaluate(()=>{
  window.syntheticConsents=[];
  const source={id:'synthetic-source',variantId:'v1',kind:'other',disease:'치석·치은염·치주질환',title:'스케일링 시술 전 설명',procedure:'스케일링',species:'both',status:'published',sourceCurrent:true};
  const original=saasRequest;saasRequest=async(path,opt={})=>{
   if(path==='/saas/practice/consent-explanations')return {items:[source]};
   if(path==='/saas/practice/consent-explanations/synthetic-source')return {document:{...source,revision:2,reviewedBy:'합성 검토자',variants:[{id:'v1',kind:'other',title:source.title,procedure:source.procedure,fields:{diagnosis:{text:'합성 치주 소견'},necessity:{text:'합성 시술 필요성'},method:{text:'합성 스케일링 시술 설명'},risks:{text:'합성 시술 위험'},precautions:{text:'합성 시술 후 관리'}},patientChecks:['실제 시술 범위']}]}};
   if(path.endsWith('/consents/preferences'))return {doctors:[],templates:[],revision:1,canManage:true};
   if(path.includes('/support/consents')){
    if(opt.method==='POST'){const body=JSON.parse(opt.body).body,document={id:'synthetic-draft',status:'draft',revision:1,body};syntheticConsents=[document];return {document};}
    if(path.includes('/consents?'))return {items:syntheticConsents.map(x=>({...x,patientName:x.body.patientName,title:x.body.title})),next:''};
    return {document:structuredClone(syntheticConsents[0])};
   }
   return original(path,opt);
  };
 });
 await goTab(p,'consents');await p.locator('[data-act=new]').click();
 await p.locator('[name=patientName]').fill('합성 환자');await p.locator('[name=species]').fill('개');
 await p.evaluate(()=>{for(const [key,value] of [['risks','직접 작성한 환자별 주의사항'],['cost','보존할 비용']]){const e=document.querySelector('[name='+key+']');e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
 const anesthesia=await p.locator('[name=generalAnesthesia]').isChecked();
 await p.locator('[data-surgery-loader] > button').click();await p.locator('[data-consent-auto-query]').fill('스케일링');await p.locator('[data-act=auto-consent-fill]').click();await p.locator('[data-consent-auto-choice]').first().click();
 assert.equal(await p.locator('[data-consent-dialog][open]').count(),0);assert.equal(await p.locator('[name=kind]').inputValue(),'surgery');
 await p.locator('[data-act=apply-consent-replacement]').click();
 assert.equal(await p.locator('[name=risks]').inputValue(),'직접 작성한 환자별 주의사항');assert.equal(await p.locator('[name=cost]').inputValue(),'보존할 비용');assert.equal(await p.locator('[name=generalAnesthesia]').isChecked(),anesthesia);
 assert.match(await p.locator('[name=method]').inputValue(),/합성 스케일링 시술 설명/);
 await p.locator('[data-act=save-consent-draft]').click();await p.waitForFunction(()=>syntheticConsents.length===1);
 await p.locator('[data-act=back]').click();await p.locator('[data-consent=synthetic-draft]').click();assert.equal(await p.locator('[name=kind]').inputValue(),'surgery');assert.equal(await p.locator('[name=risks]').inputValue(),'직접 작성한 환자별 주의사항');assert.match(await p.locator('[name=method]').inputValue(),/합성 스케일링/);
 // A slow common-content refresh must not replace this editor or its current values.
 await p.evaluate(async()=>{const old=saasRequest;saasRequest=async(path,opt)=>path==='/saas/content/published'?{documents:[],syncToken:'synthetic'}:old(path,opt);saasHasFeature=()=>true;await saasLoadCentralContent(true);});
 assert.equal(await p.locator('[name=cost]').inputValue(),'보존할 비용');
 await p.locator('[data-act=back]').click();await goTab(p,'ledger');await p.waitForFunction(()=>window.SurgeryLedger&&document.querySelector('[data-body]')?.textContent.includes('수술'));await goTab(p,'purchases');await p.waitForFunction(()=>window.ClinicPurchases);await goTab(p,'consents');await p.locator('[data-act=new]').waitFor();assert.equal(requests.filter(x=>x==='/clinic-support.js').length,1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
for(const width of [390,1440])test('healthcheck integrated menu, lazy loading and retained draft '+width,async t=>{
 const {p,requests}=await fixture(t,width);await goTab(p,'healthcheck');await p.locator('[data-action=new]').waitFor();
 await p.locator('[data-action=new]').click();await p.locator('[data-start-mode=quick]').click();await p.locator('[data-start-field=name]').fill('가상 검진 환자');
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();await goTab(p,'healthcheck');
 assert.equal(await p.locator('[data-start-field=name]').inputValue(),'가상 검진 환자');
 assert.equal(requests.filter(x=>x==='/healthcheck-record.js').length,1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await p.screenshot({path:path.join(root,'../healthcheck-integrated-'+width+'.png'),fullPage:true});
});
for(const width of [390,1440])test('initial load omits optional modules, first record loads once '+width,async t=>{
 const {p,requests}=await fixture(t,width);assert.equal(requests.some(x=>/\/(dental-record|chronic-record|practice-emergency)\.js/.test(x)),false);
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,1);assert.equal(requests.includes('/chronic-record.js'),false);
 await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(process.env.REVIEW_SHOTS)await p.screenshot({path:path.join(process.env.REVIEW_SHOTS,'clinic-lazy-'+width+'.png')});
});
test('late module response cannot replace a newer record tab',async t=>{
 const {p}=await fixture(t);let release;const gate=new Promise(r=>release=r);await p.route('**/dental-record.js?*',async r=>{await gate;await r.continue();});
 await goTab(p,'dental');await p.locator('[data-notice]').filter({hasText:'화면을 불러오는 중'}).waitFor();await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();release();await p.waitForFunction(()=>!!window.DentalRecord);
 assert.equal(await p.evaluate(()=>CarestepPractice.route()),'neuro');assert.equal(await p.locator('[data-nr=new]').count(),1);assert.equal(await p.locator('[data-dn=new]').count(),0);
});
test('failed optional file is retryable without duplicate handlers',async t=>{
 const {p,requests}=await fixture(t);let fail=true;await p.route('**/dental-record.js?*',r=>fail?r.abort():r.continue());
 await goTab(p,'dental');await p.locator('[data-notice] button').waitFor();fail=false;await p.locator('[data-notice] button').click();await p.locator('[data-dn=new]').waitFor();assert.equal(requests.filter(x=>x==='/dental-record.js').length,2);assert.equal(await p.locator('[data-dn=new]').count(),1);
});
test('identity removal during loading does not restore the prior workspace',async t=>{
 const {p}=await fixture(t);let release;const gate=new Promise(r=>release=r);await p.route('**/dental-record.js?*',async r=>{await gate;await r.continue();});await goTab(p,'dental');await p.locator('[data-notice]').filter({hasText:'화면을 불러오는 중'}).waitFor();await p.evaluate(()=>{saasMe=null;saasToken='';CarestepPractice.clear();});release();await p.waitForFunction(()=>!!window.DentalRecord);assert.equal(await p.locator('[data-dn=new]').count(),0);
});
test('calculator optional definitions load together and are reused',async t=>{
 const {p,requests}=await fixture(t);await goTab(p,'calc');await p.waitForFunction(()=>window.ClinicLazyModules&&!ClinicLazyModules.needs('calc'));await p.waitForFunction(()=>document.querySelector('[data-body]')?.textContent.includes('응급'));
 for(const file of ['practice-emergency.js','practice-nutrition.js','practice-calcium-transfusion.js'])assert.equal(requests.filter(x=>x==='/'+file).length,1);
 await goTab(p,'dental');await p.locator('[data-dn=new]').waitFor();await goTab(p,'calc');assert.equal(requests.filter(x=>x==='/practice-emergency.js').length,1);
});

test('chronic choices module loads in dependency order and survives navigation reuse',async t=>{const {p,requests}=await fixture(t);await goTab(p,'chronic');await p.locator('[data-act=new]').waitFor();assert.equal(await p.evaluate(()=>typeof ChronicChoices.setup),'function');assert.equal(requests.filter(x=>x==='/chronic-choices.js').length,1);assert.ok(requests.indexOf('/chronic-choices.js')<requests.indexOf('/chronic-record.js'));await goTab(p,'neuro');await p.locator('[data-nr=new]').waitFor();await goTab(p,'chronic');await p.locator('[data-act=new]').waitFor();assert.equal(requests.filter(x=>x==='/chronic-choices.js').length,1);});

test('healthcheck refresh loads the current versioned script and stylesheet again',async t=>{
 const {p}=await fixture(t),seen=[];p.on('request',r=>{if(/healthcheck-record\.(js|css)/.test(r.url()))seen.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),manifest=JSON.parse(html.match(/<script id="clinic-module-manifest"[^>]*>([^<]+)<\/script>/)[1]);
 const script='/'+manifest.healthcheck[0],style='/'+html.match(/href="(healthcheck-record\.css\?[^"]+)"/)[1];
 await goTab(p,'healthcheck');await p.locator('[data-action=new]').waitFor();assert.ok(seen.includes(script));
 await p.reload();await p.evaluate(()=>{saasMode='auth';saasToken='synthetic';saasSessionMeta={id:'local'};saasMe={role:'owner',clinic:{id:'local'},user:{id:'owner'}};saasRequest=async()=>({ok:true,items:[],members:[],courses:[],runs:[],templates:[],patients:[],canManage:true,canRecord:true,userId:'owner',manager:true,next:null});showApp({deferFullRender:true});});
 await goTab(p,'healthcheck');await p.locator('[data-action=new]').waitFor();assert.equal(seen.filter(x=>x===script).length,2);assert.ok(seen.includes(style));assert.equal(await p.evaluate(()=>typeof HealthcheckRecord.nextWorkStep),'function');
});
