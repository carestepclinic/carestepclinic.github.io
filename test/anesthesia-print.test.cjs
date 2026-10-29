const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
const {printDocument,printRanges}=require('../anesthesia-record.js');let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});after(async()=>browser?.close());
function fixture(long=false){const base=Date.parse('2026-10-20T03:25:00Z'),at=m=>new Date(base+m*60000).toISOString(),marker=(id,m,key,extra={})=>({recordId:id,type:'marker',marker:key,observedAt:at(m),recorder:{name:'기록자A'},...extra});
 const rows=[marker('prior',-4,'medication',{note:'전처치 기록',administration:{name:'합성 약물A',amount:.5,unit:'mL',route:'IV'}}),marker('start',0,'anesthesiaStart'),marker('op',15,'surgeryStart')];
 for(let m=0;m<= (long?480:120);m+=5)rows.push({recordId:'v'+m,type:'measurement',observedAt:at(m),recorder:{name:m%10?'기록자A':'기록자B'},values:{heartRate:100+m%20,respiratoryRate:20+m%10,etco2:35,spo2:98,temperature:38.2,systolic:105,diastolic:60,meanPressure:75},note:m===15?'측정 메모 보존':''});
 rows.push(marker('end',long?480:120,'anesthesiaEnd'),marker('cancel',18,'other',{voided:true,note:'취소된 사건은 제외'}));
 if(long)for(let m=30;m<480;m+=15)rows.push(marker('event'+m,m,'other',{note:'처치 기록 '+m+' · 충분한 길이의 장시간 기록 내용과 인계 사항을 원문 그대로 남깁니다.'}));
 return {rows,ranges:printRanges(rows),item:{patient:{name:'합성 마취 환자',breed:'합성 품종',birthDate:'2020-02-29',sex:'male',neutered:'yes'},body:{species:'dog',weight:5}},fieldValues:{diagnosis:'합성 진단',operation:'합성 수술',surgeon:'수의사A',anesthetist:'수의사B',tube:'4.5 mm',note:'회복 시 지속 관찰'},plan:'합성 계획 0.5 mL · 준비량이며 실제 투여량 아님',administration:r=>r.administration?r.administration.name+' · '+r.administration.amount+' '+r.administration.unit+' · '+r.administration.route:''};
}
for(const long of [false,true])test('compact PDF preserves measured values, notes and actual administration '+(long?'long':'two-hour'),async t=>{
 const data=fixture(long),html=printDocument(data),p=await browser.newPage({viewport:{width:1120,height:800}});t.after(()=>p.close());await p.setContent(html);await p.emulateMedia({media:'print'});await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('.print-page').count(),long?2:1);assert.equal(await p.locator('.ap-matrix thead th').count()-await p.locator('.ap-matrix').count(),long?97:25);
 const text=await p.locator('body').innerText();for(const s of ['이완기 혈압','기록자A','기록자B','측정 메모 보존','전처치 기록','합성 약물A','계산기 준비량 · 실제 투약 아님'])assert.ok(text.includes(s),s);
 assert.equal(text.split('합성 약물A').length,2);assert.ok(!text.includes('취소된 사건은 제외'));assert.ok(!text.includes('undefined'));
 assert.equal(await p.locator('.ap-charts').count(),long?2:1);assert.equal(await p.locator('.ap-chart').count(),long?16:8);
 const file=path.resolve(__dirname,'../../anesthesia-print-'+(long?'long':'two-hour')+'.pdf');await p.pdf({path:file,preferCSSPageSize:true,printBackground:true});
});
test('selected range and missing metrics never gain fabricated values',()=>{
 const data=fixture();data.rows=[{type:'measurement',observedAt:'2026-10-20T03:30:00Z',values:{heartRate:0},recorder:{name:'<script>bad</script>'},note:'<svg/onload=x>'}];data.complete=false;
 const html=printDocument(data);assert.ok(html.includes('<td>0</td>'));assert.ok(html.includes('<td>—</td>'));assert.ok(html.includes('&lt;script&gt;bad'));assert.ok(!html.includes('<svg/onload=x>'));assert.ok(!html.includes('마취 시작 전 기록'));
});
