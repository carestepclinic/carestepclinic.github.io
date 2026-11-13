const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const api=require('../healthcheck-record.js');
const render=(d,species='dog')=>api.reportHTML({...api.blank(),...d},{name:'가상 환자',species},[],{},{includeGuides:true});

test('empty or merely selected exams have no invented education or normal findings',()=>{
 const html=render({examSelection:['skin','nutrition'],exams:{skin:' ',oral:''}});
 assert.doesNotMatch(html,/data-exam-guide=/);assert.doesNotMatch(html,/<div class="bcs-grid">/);
 assert.doesNotMatch(render({bcs:5,exams:{skin:'발적'}},'rabbit'),/<div class="bcs-grid">|data-exam-guide=/);
});
test('all first-tab findings get sourced guidance but clinician text remains unchanged',()=>{
 const keys=['physical','nutrition','skin','ears','eyes','oral','cardiac','respiratory','abdomen','musculoskeletal','neurologic','other'];
 const exams=Object.fromEntries(keys.map(k=>[k,'평가 불가 · 재검 상담 <script>임의 소견</script>']));
 const d={...api.blank(),exams},before=JSON.stringify(d),html=api.reportHTML(d,{name:'가상 환자',species:'cat'},[]);
 assert.equal(JSON.stringify(d),before);
 for(const key of keys)assert.equal((html.match(new RegExp('data-exam-guide="'+key+'"','g'))||[]).length,1,key);
 assert.match(html,/평가 불가로 기록된 항목도 정상으로 간주하지 않습니다/);
 assert.doesNotMatch(html,/<script>임의/);assert.match(html,/&lt;script&gt;임의/);
 assert.equal((html.match(/<div class="exam-guide-grid">/g)||[]).length,2);
 for(const [,url] of html.matchAll(/<a href="([^"]+)"/g))assert.equal(new URL(url).protocol,'https:');
});
test('BCS diagram marks every valid score in species-appropriate bands without duplicate nutrition guide',()=>{
 for(const species of ['dog','cat'])for(let bcs=1;bcs<=9;bcs++){
  const html=render({bcs,exams:{nutrition:'기존 영양 소견'}},species);
  assert.equal((html.match(/class="bcs-card bcs-current"/g)||[]).length,1);
  assert.equal((html.match(/<svg /g)||[]).length,3);
  assert.match(html,new RegExp('이번 BCS <strong>'+bcs+'/9'));
  assert.match(html,new RegExp((species==='cat'?'고양이':'개')+' 위에서 본 체형'));
  assert.match(html,/기존 영양 소견/);assert.doesNotMatch(html,/data-exam-guide="nutrition"/);
  const card=html.match(/<article class="bcs-card bcs-current">([\s\S]*?)<\/article>/)[1];
  assert.match(card,bcs<= (species==='cat'?4:3)?/마른 쪽/:bcs<=5?/적정 체형/:/체지방이 많은 쪽/);
 }
});
test('MCS-only and invalid BCS never invent a BCS; legacy MCS text preserved safely',()=>{
 for(const bcs of [null,0,10,4.5,'bad']){
  const html=render({bcs,mcs:'기존 근육 소견 <img src=x>'});
  assert.doesNotMatch(html,/<div class="bcs-grid">|이번 BCS <strong>/);
  assert.match(html,/이번 MCS · 기존 근육 소견 &lt;img/);assert.doesNotMatch(html,/<img src=x>/);
 }
});
test('imaging findings keep their section and do not get unrelated first-tab guides',()=>{
 const html=render({exams:{radiograph:'방사선 소견',ultrasound:'초음파 소견',skin:'발적'}});
 assert.equal((html.match(/data-exam-guide=/g)||[]).length,1);
 assert.match(html,/data-exam-guide="skin"/);
});

for(const species of ['dog','cat'])test('print and mobile guide layout stays inside page '+species,async()=>{
 const browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1100,height:1000}});await require('./report-assets.cjs').routeReportAssets(p.context());
  const keys=['physical','skin','ears','eyes','oral','cardiac','respiratory','abdomen','musculoskeletal','neurologic','other'];
  const d={bcs:species==='cat'?7:4,mcs:'가벼운 근육 소실 (Mild loss)',exams:Object.fromEntries(keys.map(k=>[k,'관찰 소견 · 의료진 재검 계획 확인'])),clinicalStatus:'complete'};
  await p.setContent(render(d,species));await p.waitForFunction(()=>document.body.dataset.reportReady==='true');
  const nutrition=p.locator('.report-part').filter({has:p.locator('.bcs-grid')}).first();
  await nutrition.screenshot({path:path.join(__dirname,'../../healthcheck-exam-guide-'+species+'.png')});
  await p.emulateMedia({media:'print'});
  const sizes=await p.locator('.report-part').evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,w:e.scrollWidth,c:e.clientWidth})));
  for(const size of sizes){assert.ok(size.w<=size.c+1,JSON.stringify(size));assert.ok(size.h<1032,JSON.stringify(size));}
  if(species==='cat')await p.pdf({path:path.join(__dirname,'../../healthcheck-exam-guide-review.pdf'),preferCSSPageSize:true,printBackground:true});
  await p.emulateMedia({media:'screen'});await p.setViewportSize({width:390,height:844});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await nutrition.screenshot({path:path.join(__dirname,'../../healthcheck-exam-guide-'+species+'-mobile.png')});
 }finally{await browser.close();}
});
