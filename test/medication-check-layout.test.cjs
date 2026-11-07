const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync,mkdirSync}=require('node:fs'),{resolve,extname}=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
before(async()=>{server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html';res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(name)]||'application/octet-stream');res.end(readFileSync(resolve(root,name)));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
const med=(patch={})=>({name:'검증약 A',dose:'1/2정',frequency:'하루 2회',times:'08:00, 20:00',duration:'28',meal:'식후',...patch});
async function sheet(t,meds,width=1200,options={}){const p=await browser.newPage({viewport:{width,height:1200}});p.setDefaultTimeout(8000);t.after(()=>p.close());const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.clock.install({time:new Date(options.now||'2026-11-07T07:00:00Z')});await p.goto(origin);await p.evaluate(({ms,date})=>{hospital.name='검증 병원';hospital.phone='02-000-0000';document.getElementById('patientName').value='검증 환자';document.getElementById('guardianName').value='검증 보호자';document.getElementById('dischargeDate').value=date;document.getElementById('recheckMode').value='';medications=ms;renderMedicationCheckSheet();const copy=document.getElementById('pdfDocument').cloneNode(true);copy.id='printTest';copy.style.zoom='';copy.className='pdf-document print-only';copy.style.display='block';document.body.append(copy);document.getElementById('appView').style.display='none';document.getElementById('loginView').style.display='none';},{ms:meds,date:options.date||'2026-11-05'});await p.emulateMedia({media:'print'});return {p,errors};}
async function checkFits(p){const checks=await p.locator('#printTest .pdf-page').evaluateAll(pages=>pages.map(page=>{const footer=page.querySelector('.pdf-footer').getBoundingClientRect();const tail=page.querySelector('.med-check-recheck');return {width:page.getBoundingClientRect().width,height:page.getBoundingClientRect().height,overlap:tail?tail.getBoundingClientRect().bottom>footer.top-3:false,wide:page.scrollWidth>page.clientWidth+1,clipped:page.scrollHeight>page.clientHeight+1};}));assert.ok(checks.every(v=>v.width===794&&v.height===1123&&!v.overlap&&!v.wide&&!v.clipped),JSON.stringify(checks));}
for(const width of [390,1200])test('28 days and two BID medications fit one readable A4 page '+width,async t=>{const {p,errors}=await sheet(t,[med(),med({name:'검증약 B'})],width);assert.equal(await p.locator('#printTest .pdf-page').count(),1);assert.equal(await p.locator('#printTest .med-check-week').count(),4);assert.equal(await p.locator('#printTest .med-check-box').count(),112);assert.equal(await p.evaluate(()=>medicationCheckMeta().pageCount),1);await checkFits(p);assert.deepEqual(errors,[]);if(width===1200){mkdirSync(resolve(root,'../medcheck-review'),{recursive:true});await p.locator('#printTest .pdf-page').screenshot({path:resolve(root,'../medcheck-review/28-days-two-medicines.png')});}});
test('90 days retain every dose and match page-count labels',async t=>{const {p}=await sheet(t,[med({duration:'90'})]);const pages=await p.locator('#printTest .pdf-page').count();assert.ok(pages<13);assert.equal(await p.locator('#printTest .med-check-box').count(),180);assert.equal(await p.evaluate(()=>medicationCheckMeta().pageCount),pages);assert.match(await p.evaluate(()=>medicationCheckFileLabel()),new RegExp('_'+pages+'P$'));assert.match(await p.locator('#printTest').innerText(),/90일차/);await checkFits(p);});
test('eight QID medications keep all times and split before footer',async t=>{const {p}=await sheet(t,Array.from({length:8},(_,i)=>med({name:'검증약 '+i,frequency:'하루 4회',times:'06:00, 12:00, 18:00, 23:00'})));assert.equal(await p.locator('#printTest .med-check-box').count(),8*28*4);await checkFits(p);});
test('different durations and EOD retain end days and rest days',async t=>{const {p}=await sheet(t,[med({duration:'3'}),med({name:'검증약 B',duration:'5'}),med({name:'검증약 C',duration:'28',frequency:'EOD · 2일에 1회',times:'08:00'})]);assert.equal(await p.locator('#printTest tr[data-med-index="0"] .med-check-box').count(),6);assert.equal(await p.locator('#printTest tr[data-med-index="1"] .med-check-box').count(),10);assert.equal(await p.locator('#printTest tr[data-med-index="2"] .med-check-box').count(),14);assert.equal(await p.locator('#printTest .med-check-eod-rest').count(),14);assert.equal(await p.locator('#printTest tr[data-med-index="0"]').count(),1);await checkFits(p);});
test('long dose instructions and names remain complete without overflow',async t=>{const text='용량은 처방 라벨에서 확인합니다. ';const {p}=await sheet(t,Array.from({length:8},(_,i)=>med({name:'검증용 긴 이름을 가진 약품 '+i,dose:text.repeat(7),duration:'14',times:'06:00, 12:00, 18:00, 23:00',frequency:'하루 4회'})));assert.equal(await p.locator('#printTest .med-check-box').count(),8*14*4);assert.match(await p.locator('#printTest').innerText(),/이어서/);await checkFits(p);});
test('no time uses one daily checkbox and invalid durations stay blocked',async t=>{const {p}=await sheet(t,[med({duration:'5',times:''})]);assert.equal(await p.locator('#printTest .med-check-box').count(),5);assert.match(await p.locator('#printTest').innerText(),/시간 미설정/);await p.evaluate(()=>{medications[0].duration='';renderMedicationCheckSheet();});assert.equal(await p.evaluate(()=>medicationCheckMeta().valid),false);assert.equal(await p.locator('#pdfDocument .med-check-box').count(),0);});
test('layout cache refreshes after doses, times and dates change and leaves inputs intact',async t=>{const ms=[med(),med({name:'검증약 B'})];const {p}=await sheet(t,ms);assert.equal(await p.evaluate(()=>JSON.stringify(medications)),JSON.stringify(ms));const result=await p.evaluate(()=>{const a=medicationCheckMeta();medications[0].duration='90';medications[0].times='08:17';const b=medicationCheckMeta();return {first:a.maxDays,next:b.maxDays,count:b.pageCount,key:medicationCheckLayoutCache.key};});assert.equal(result.first,28);assert.equal(result.next,90);assert.match(result.key,/08:17/);assert.equal(await p.locator('.med-check-probe').count(),0);});

for(const width of [390,1200])test('afternoon BID prescription starts at 20:00 and retains 14 doses '+width,async t=>{
 const {p,errors}=await sheet(t,[med({duration:'7'})],width,{date:'2026-11-07'});
 assert.equal(await p.locator('#printTest .med-check-box').count(),14);
 assert.equal(await p.locator('#printTest td[data-day="1"] .med-check-time-label').innerText(),'20:00');
 assert.equal(await p.locator('#printTest td[data-day="8"] .med-check-time-label').innerText(),'08:00');
 assert.match(await p.locator('#printTest').innerText(),/7일 처방/);
 assert.match(await p.locator('#printTest').innerText(),/2026-11-07 16:00/);
 assert.match(await p.locator('#printTest').innerText(),/총 14회/);
 await checkFits(p);assert.deepEqual(errors,[]);
 if(width===1200)await p.locator('#printTest .pdf-page').screenshot({path:resolve(root,'../medcheck-review/afternoon-14-doses.png')});
});
test('start stays fixed after the clock advances and a saved draft is restored',async t=>{
 const {p}=await sheet(t,[med({duration:'7'})],1200,{date:'2026-11-07'});
 const saved=await p.evaluate(()=>JSON.stringify(caseInfo));
 await p.clock.setSystemTime(new Date('2026-11-08T14:00:00Z'));
 const result=await p.evaluate(saved=>{caseInfo=JSON.parse(saved);renderMedicationCheckSheet();return medicationCheckMeta();},saved);
 assert.equal(result.start.time,'16:00');assert.equal(result.maxDays,8);assert.deepEqual(result.meds[0].daySlots['1'],['20:00']);
 assert.equal(await p.locator('#pdfDocument .med-check-box').count(),14);
});
test('manual start change updates both checklist and cache without changing prescribed dose',async t=>{
 const {p}=await sheet(t,[med({duration:'7'})],1200,{date:'2026-11-07'});
 const before=await p.evaluate(()=>JSON.stringify(medications));
 await p.evaluate(()=>{const input=document.getElementById('medicationCheckStartTime');input.value='21:00';input.dispatchEvent(new Event('change',{bubbles:true}));renderMedicationCheckSheet();});
 assert.equal(await p.locator('#pdfDocument .med-check-box').count(),14);
 assert.match(await p.locator('#pdfDocument td[data-day="1"]').innerText(),/시작 전/);
 assert.equal(await p.locator('#pdfDocument td[data-day="8"] .med-check-box').count(),2);
 assert.equal(await p.evaluate(()=>caseInfo.medicationCheckStart.time),'21:00');
 assert.equal(await p.evaluate(()=>JSON.stringify(medications)),before);
});
test('exact dose time is included and a time before all doses keeps the original end day',async t=>{
 const {p}=await sheet(t,[med({duration:'7'})],1200,{date:'2026-11-07',now:'2026-11-06T23:00:00Z'});
 assert.equal(await p.locator('#printTest td[data-day="1"] .med-check-box').count(),2);
 assert.equal(await p.evaluate(()=>medicationCheckMeta().maxDays),7);
});
test('mixed periods, missing times and EOD retain each prescribed count after late start',async t=>{
 const {p}=await sheet(t,[med({duration:'3'}),med({name:'B',duration:'5',times:'08:00',frequency:'하루 1회'}),med({name:'C',duration:'7',times:'08:00',frequency:'EOD · 2일에 1회'}),med({name:'D',duration:'2',times:''})],1200,{date:'2026-11-07'});
 for(const [i,n]of [6,5,4,2].entries())assert.equal(await p.locator('#printTest tr[data-med-index="'+i+'"] .med-check-box').count(),n);
 const m=await p.evaluate(()=>medicationCheckMeta().meds[2]);assert.deepEqual(Object.keys(m.daySlots),['2','4','6','8']);
 await checkFits(p);
});
test('different start dates reset the automatic cutoff and invalid manual times do not erase it',async t=>{
 const {p}=await sheet(t,[med({duration:'7'})],1200,{date:'2026-11-07'});
 await p.evaluate(()=>{const el=document.getElementById('medicationCheckStartTime');el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await p.evaluate(()=>caseInfo.medicationCheckStart.time),'16:00');
 for(const date of ['2026-11-08','2026-11-06']){
  const m=await p.evaluate(date=>{document.getElementById('dischargeDate').value=date;renderMedicationCheckSheet();return medicationCheckMeta();},date);
  assert.equal(m.start.time,'00:00');assert.equal(m.maxDays,7);
 }
});
