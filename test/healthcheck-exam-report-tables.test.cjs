const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),H=require('../healthcheck-record.js'),R=require('../record-handoff.js'),{routeReportAssets}=require('./report-assets.cjs');
const out=path.resolve(__dirname,'../../healthcheck-exam-report-tables-20261128');fs.mkdirSync(out,{recursive:true});let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});after(()=>browser?.close());
const patient={name:'가상 검진 환자',species:'cat',guardianName:'가상 보호자',chartNumber:'PRINT-TEST'};
function fixture(){
 const d=H.blank();d.date='2026-11-28';d.veterinarian='가상 수의사';d.clinicalStatus='complete';d.reviewed=true;d.bcs=5;d.mcs='정상 근육량 (Normal)';
 d.exams.physical='체온 (°C): 37.5\n심박수 (회/분): 150\n호흡수 (회/분): 30\n모세혈관 재충만 시간 · CRT (초): <1\n점막색 · MMC: 분홍색\n표재 림프절 · Superficial lymph node: 종대 없음\n의식 상태 · Mentation: 명료\n청진 · Auscultation: 특이 소견 없음\n피부 탄력 · Skin turgor: 즉시 회복\n신체 추가 소견 <원문 보존>';
 const od={stt:0,iop:18,vision:'present',palpebral:'present',pupilSize:'normal',menace:'present',plrDirect:'present',plrConsensual:'reduced',dazzle:'present',eyelids:'특이 소견 없음',conjunctiva:'충혈',thirdLid:'특이 소견 없음',cornea:'특이 소견 없음',anteriorChamber:'특이 소견 없음',iris:'특이 소견 없음',lens:'특이 소견 없음',vitreous:'특이 소견 없음',fundus:'관찰 내용'};
 d.exams.eyes=R.eyeFindings({od,os:{...od,stt:15,iop:19,conjunctiva:'특이 소견 없음'}}).join('\n')+'\n안과 추가 소견 <원문 보존>';d.exams.oral='다음 항목 유지';
 return d;
}
async function open(d,width=1200){
 const p=await browser.newPage({viewport:{width,height:1100}});await routeReportAssets(p.context());const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent(H.reportHTML(d,patient,d.images||[],{name:'가상 동물병원',address:'가상 주소',phone:'가상 연락처'}));
 await p.waitForFunction(()=>document.body.dataset.reportReady==='true'||!document.querySelector('[data-rebuild]').hidden,null,{timeout:45000});
 assert.equal(await p.locator('body').getAttribute('data-report-ready'),'true',await p.locator('.print-state').innerText());return {p,errors};
}
async function boundaries(p){
 const data=await p.evaluate(()=>{const pages=[...document.querySelectorAll('.pagedjs_page')],seen=new Set();return {
 sections:[...document.querySelectorAll('#report-pages .report-part')].filter(x=>{if(seen.has(x.dataset.reportPart))return false;seen.add(x.dataset.reportPart);return true;}).map(x=>({title:x.dataset.reportTitle,first:x.closest('.pagedjs_page').querySelector('.report-part')===x})),
 toc:[...document.querySelectorAll('.toc-link')].map(a=>({actual:pages.indexOf(document.querySelector(a.getAttribute('href')).closest('.pagedjs_page'))+1,shown:Number(a.querySelector('.toc-page').textContent)})),
 overflow:[...document.querySelectorAll('#report-pages .exam-result-table tbody tr')].filter(row=>{const r=row.getBoundingClientRect(),b=row.closest('.pagedjs_page_content').getBoundingClientRect();return r.top<b.top-2||r.bottom>b.bottom+2||r.right>b.right+2;}).map(r=>r.textContent)
 };});assert.ok(data.sections.every(x=>x.first),JSON.stringify(data.sections));assert.ok(data.toc.every(x=>x.actual===x.shown));assert.deepEqual(data.overflow,[]);assert.equal(await p.locator('.report-cover-page').count(),1);assert.equal(await p.locator('.report-contents-page').count(),1);
}
for(const width of [390,1200])test('physical and paired eye results remain readable on independent A4 sheets '+width,async()=>{
 const d=fixture(),original=JSON.stringify(d),{p,errors}=await open(d,width);
 assert.equal(await p.locator('#report-pages [data-exam-table=physical] tbody tr').count(),9);assert.equal(await p.locator('#report-pages [data-exam-table=eyes] tbody tr').count(),18);
 assert.equal(await p.locator('#report-pages [data-exam-table=eyes]').count(),1,'ordinary paired results fit one sheet');const eye=p.locator('#report-pages [data-exam-table=eyes] tbody tr');assert.deepEqual(await eye.first().locator('td').allTextContents(),['0 mm/min','15 mm/min']);assert.deepEqual(await eye.nth(1).locator('td').allTextContents(),['18 mmHg','19 mmHg']);
 assert.match(await p.locator('#report-pages').innerText(),/신체 추가 소견 <원문 보존>/);assert.match(await p.locator('#report-pages').innerText(),/안과 추가 소견 <원문 보존>/);assert.equal(JSON.stringify(d),original);
 await boundaries(p);assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width===1200){await p.pdf({path:path.join(out,'exam-tables.pdf'),preferCSSPageSize:true,printBackground:true});for(const kind of ['physical','eyes']){const section=p.locator('.pagedjs_page').filter({has:p.locator('[data-exam-table='+kind+']')}).first();await section.screenshot({path:path.join(out,kind+'.png')});}}
 await p.close();
});
test('source dates, repeated values, blank side and unstructured prose are never discarded or inferred',async()=>{
 const d=fixture();d.exams.eyes='단독 소견\n[2026-11-01 · ophthalmic · source-one]\n우안 OD · 안압 · IOP: 21 mmHg\n우안 OD · 안압 · IOP: 23 mmHg\n좌안 OS · 안압 · IOP: 19 mmHg\n[직접 작성 메모]\n알 수 없는 검사: 원문';const {p}=await open(d);
 const rows=p.locator('#report-pages [data-exam-table=eyes] tbody tr');assert.equal(await rows.count(),2);assert.deepEqual(await rows.first().locator('td').allTextContents(),['21 mmHg','미기록']);assert.deepEqual(await rows.nth(1).locator('td').allTextContents(),['23 mmHg','19 mmHg']);
 const text=await p.locator('#report-pages').innerText();for(const word of ['단독 소견','2026-11-01','source-one','직접 작성 메모','알 수 없는 검사: 원문'])assert.ok(text.includes(word));await boundaries(p);await p.close();
});
test('long eye cells continue with repeated headers without clipping values or following section',async()=>{
 const d=fixture(),long='긴 관찰 소견의 원문을 보존합니다. '.repeat(80)+'끝표시';d.exams.eyes='우안 OD · 각막 · Cornea: '+long+'\n좌안 OS · 각막 · Cornea: '+long;const {p,errors}=await open(d);await boundaries(p);assert.deepEqual(errors,[]);
 assert.equal((await p.locator('#report-pages [data-exam-table=eyes] tbody td:nth-child(2)').allTextContents()).join(''),long);assert.equal((await p.locator('#report-pages [data-exam-table=eyes] tbody td:nth-child(3)').allTextContents()).join(''),long);
 assert.ok(await p.locator('#report-pages [data-exam-table=eyes]').count()>1);assert.ok(await p.locator('#report-pages [data-exam-table=eyes]').evaluateAll(ts=>ts.every(t=>t.querySelector('thead'))));assert.match(await p.locator('#report-pages').innerText(),/다음 항목 유지/);
 await p.pdf({path:path.join(out,'exam-tables-long.pdf'),preferCSSPageSize:true,printBackground:true});await p.close();
});
