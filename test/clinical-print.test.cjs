const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../clinical-print.js'),A=require('../anesthesia-record.js'),H=require('../healthcheck-record.js');
test('identity escapes user fields, retains zero, and computes age at the visit',()=>{
 const html=P.identity({date:'2026-11-15',patient:{name:'<img onerror=x>',weight:0,birthDate:'2020-12-20',sex:'male',neutered:'yes',chartNumber:'ABC'}});
 assert.ok(html.includes('&lt;img onerror=x&gt;'));assert.ok(!html.includes('<img'));assert.ok(html.includes('0 kg'));assert.ok(html.includes('5세 10개월'));assert.ok(html.includes('미기록'));assert.equal(P.age('2027-01-01','2026-11-15'),'');
});
test('legacy screen/page rules are removed without removing diagram declarations',()=>{
 const css='svg{fill:red}@page{size:A4;@top-left{content:"{safe}"}}@media screen{body{width:200px}}table{border:0}';
 assert.equal(P.stripAtRules(css),'svg{fill:red}table{border:0}');
});
test('ward five-day output uses 3+2 day periods, retains exceptions and recorded states exactly once',()=>{
 const dates=['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19'];
 const entries=dates.map((d,i)=>({at:d+'T09:00:00+09:00',patient:'환자 '+i,title:'처치 '+i,state:i?'예정':'완료',actualAt:i?'':d+'T09:08:00+09:00',note:i?'':'실제 기록'}));entries.push({at:'2026-11-14T10:00:00+09:00',title:'이전 미완료',patient:'환자',state:'지연'},{at:dates[0]+'T11:00:00+09:00',title:'필요 시 처치',prn:true});
 const before=JSON.stringify(entries),html=P.wardHTML(entries,dates);
 assert.equal((html.match(/class="cp-ward-period"/g)||[]).length,2);assert.equal((html.match(/class="cp-task"/g)||[]).length,7);assert.ok(html.includes('09:08'));assert.ok(html.includes('실제 기록'));assert.ok(html.includes('이전 미완료'));assert.ok(html.includes('필요 시 처치'));assert.equal(JSON.stringify(entries),before);assert.ok(html.includes('00:00–08:59'));assert.ok(html.includes('10:00–23:59'));assert.ok(!html.includes('08:00</th>'));assert.ok(P.wardHTML([{at:dates[0]+'T09:00:00+09:00',assignee:'담당자',state:'예정'}],dates.slice(0,1)).includes('담당 담당자'));assert.ok(!P.identity({aggregate:true,date:dates[0]}).includes('미기록'));
});
test('anesthesia print retains all measurements and intubation while limiting matrix columns',()=>{
 const rows=Array.from({length:31},(_,i)=>({recordId:'m'+i,type:'measurement',observedAt:new Date(Date.parse('2026-11-15T01:00:00Z')+i*300000).toISOString(),values:{heartRate:i},recorder:{name:'기록자'}}));rows.push({type:'marker',marker:'intubation',observedAt:'2026-11-15T01:01:00Z'});
 const html=A.printDocument({rows,ranges:A.printRanges(rows),item:{patient:{name:'합성 환자'},body:{species:'cat',weight:4}}});
 const tables=[...html.matchAll(/<table class="ap-matrix">([\s\S]*?)<\/table>/g)];assert.equal(tables.length,3);for(const [,table]of tables)assert.ok((table.match(/<thead>[\s\S]*?<\/thead>/)[0].match(/<th>/g)||[]).length<=13);assert.equal((html.match(/<b>2026-11-15 10:01<\/b>/g)||[]).length,1);assert.ok(html.includes('삽관'));for(let i=0;i<31;i++)assert.ok(html.includes('<td>'+i+'</td>'));
});
test('trends require three dates and use elapsed time without losing any values',()=>{
 assert.equal(P.trend('체중','kg',[{date:'2026-01-01',value:0},{date:'2026-02-01',value:5}]),'');
 const html=P.trend('체중','kg',[{date:'2026-01-01',value:0},{date:'2026-01-02',value:2},{date:'2026-02-01',value:5}]);
 for(const text of ['2026-01-01 · 0 kg','2026-01-02 · 2 kg','2026-02-01 · 5 kg'])assert.ok(html.includes(text));
 const x=[...html.matchAll(/<circle cx="([\d.]+)"/g)].map(m=>Number(m[1]));assert.equal(x.length,3);assert.ok(x[1]-x[0]<10);assert.ok(x[2]-x[1]>200);
});
test('health report summary is explicit and private review notes remain excluded',()=>{
 const d=H.blank({name:'합성 환자',species:'cat'});d.overview='첫 장 핵심';d.summary='종합 소견';d.management='관리 계획';d.questions='PRIVATE_REVIEW';const html=H.reportHTML(d,{name:'합성 환자',species:'cat'},[]);
 assert.ok(html.includes('value="summary"'));assert.ok(html.includes('data-report-summary="true"'));assert.ok(!html.includes('PRIVATE_REVIEW'));assert.ok(!html.includes('의료진 검토 완료'));
});

test('technician and veterinarian remain distinct and safely escaped in print identity',()=>{
 const html=P.identity({veterinarian:'수의사',technician:'<검증>',patient:{name:'가상 환자'}});assert.ok(html.includes('수의사 · 테크니션 &lt;검증&gt;'));assert.ok(!html.includes('<검증>'));
});
test('health contents and every section start on a new page even for short reports',()=>{
 const d=H.blank({name:'가상 환자'});Object.assign(d,{summary:'짧은 소견',management:'집에서 관리',followup:'재검 일정',exams:{physical:'신체 소견'}});const html=H.reportHTML(d,{name:'가상 환자'},[]);for(const title of ['종합소견','관리·재검 계획'])assert.ok(html.includes('data-report-title="'+title+'" data-new-page="true" data-compact="true" data-keep-together="true"'));assert.ok(html.includes('data-report-title="신체검사·진료 소견" data-new-page="true"'));
});
test('ward planned date stays in column while next-day actual timestamp remains explicit',()=>{
 const html=P.wardHTML([{at:'2026-11-15T23:50:00+09:00',actualAt:'2026-11-16T00:10:00+09:00',title:'자정 처치',dose:'0.25 mL',state:'완료',recorder:'담당자'}],['2026-11-15']);assert.ok(html.includes('예정 23:50'));assert.ok(html.includes('실시 2026-11-16 00:10'));assert.ok(html.includes('지시량 0.25 mL'));assert.ok(html.includes('수행 담당자'));
});

test('patient ward archive retains timing, instructions and staff without repeating patient labels',()=>{
 const entries=[{patient:'중복하면안됨',chart:'P-1',at:'2026-11-15T23:50:00+09:00',actualAt:'2026-11-16T00:10:00+09:00',title:'처치 A',dose:'0.25 mL · IV',state:'완료',assignee:'담당 A',recorder:'수행 B',note:'주의 메모'},{at:'2026-11-14T09:00:00+09:00',title:'미완료 C',state:'지연'},{title:'필요 시 B',prn:true,state:'예정'}];
 const before=JSON.stringify(entries),html=P.wardHTML(entries,['2026-11-15'],{patient:true});
 for(const value of ['예정 시각','처치 A','0.25 mL · IV','완료','2026-11-16 00:10','담당 A','수행 B','주의 메모','미완료 C','필요 시 B'])assert.ok(html.includes(value));
 assert.ok(!html.includes('중복하면안됨'));assert.equal((html.match(/처치 A/g)||[]).length,1);assert.equal(JSON.stringify(entries),before);
});
test('anesthesia interval events precede their graphs and all boundary measurements stay in appendix',()=>{
 const base=Date.parse('2026-11-15T00:00:00Z'),at=m=>new Date(base+m*60000).toISOString();
 const rows=[{type:'measurement',observedAt:at(-5),values:{heartRate:111},note:'BEFORE_NOTE'},{type:'marker',marker:'anesthesiaStart',observedAt:at(0)},{type:'marker',marker:'intubation',observedAt:at(3)},{type:'marker',marker:'medication',observedAt:at(120),note:'BOUNDARY_DRUG'},{type:'measurement',observedAt:at(120),values:{heartRate:123},recorder:{name:'STAFF_BOUNDARY'}},{type:'measurement',observedAt:at(240),values:{heartRate:124},note:'LAST_NOTE'},{type:'marker',marker:'extubation',observedAt:at(240)}];
 const options={rows,ranges:A.printRanges(rows),item:{patient:{name:'합성 환자'},body:{species:'cat'}},plan:'PREPARED_ONLY'},html=A.printDocument(options),appendix=html.indexOf('class="ap-data-appendix"');
 assert.equal((html.match(/BOUNDARY_DRUG/g)||[]).length,1);assert.ok(html.indexOf('BOUNDARY_DRUG')<appendix);assert.ok(html.indexOf('<td>123</td>')>appendix);assert.ok(html.indexOf('BEFORE_NOTE')>appendix);assert.ok(html.includes('class="ap-phase"'));assert.ok(html.includes('STAFF_BOUNDARY'));assert.ok(html.indexOf('PREPARED_ONLY')>appendix);
 const summary=A.printDocument({...options,detailed:false,bodyOnly:true});assert.ok(summary.includes('BOUNDARY_DRUG'));assert.ok(summary.includes('LAST_NOTE'));assert.ok(!summary.includes('PREPARED_ONLY'));assert.ok(!summary.includes('class="ap-matrix"'));
 const selected=A.printDocument({...options,ranges:[{start:base+120*60000,minutes:120}],complete:false});assert.ok(!selected.includes('BEFORE_NOTE'));assert.ok(selected.includes('LAST_NOTE'));
});
test('health problems group only unique exact headings and retain unmatched and ambiguous originals',()=>{
 const d=H.blank({name:'합성 환자'});Object.assign(d,{summary:'일반 소견 ROOT\n[항목 A]\n소견 A_FIND\n[항목 B]\n소견 B_FIND',management:'[항목 A]\n실천 방법: A_MANAGE\n[다른 항목]\n실천 방법: UNMATCHED',followup:'[항목 A]\n권고 시점: A_RECHECK\n[항목 B]\n권고 시점: B_RECHECK'});
 const before=JSON.stringify(d),html=H.reportHTML(d,{name:'합성 환자'},[]),part=html.match(/<section[^>]*data-report-title="소견·계획 · 항목 A"[\s\S]*?<\/section>/)[0];
 for(const value of ['A_FIND','A_MANAGE','A_RECHECK'])assert.ok(part.includes(value));assert.ok(part.includes('data-report-summary="true"'));
 for(const value of ['ROOT','B_FIND','B_RECHECK','UNMATCHED'])assert.ok(html.includes(value));assert.equal(JSON.stringify(d),before);
 d.management='[항목 A]\nFIRST\n[항목 A]\nSECOND';d.followup='';const ambiguous=H.reportHTML(d,{name:'합성 환자'},[]);assert.ok(!ambiguous.includes('data-report-title="소견·계획'));assert.ok(ambiguous.includes('FIRST'));assert.ok(ambiguous.includes('SECOND'));
 d.management='[항목 A와 유사]\nDO_NOT_INFER';const unpaired=H.reportHTML(d,{name:'합성 환자'},[]);assert.ok(!unpaired.includes('data-report-title="소견·계획'));
});

test('anesthesia event-only records do not add an empty numeric appendix',()=>{
 const rows=[{type:'marker',marker:'anesthesiaStart',observedAt:'2026-11-15T00:00:00Z',note:'사건 원문'}];const html=A.printDocument({rows,ranges:A.printRanges(rows),item:{patient:{name:'합성 환자'},body:{}},plan:'준비량'});assert.ok(!html.includes('class="ap-data-appendix"'));assert.ok(!html.includes('class="ap-interval-pair"'));assert.ok(html.includes('사건 원문'));assert.ok(html.includes('준비량'));
});

test('anesthesia event badges share a baseline and connect to exact times at both edges',()=>{
 const start=Date.parse('2026-11-15T03:36:00Z'),names=['anesthesiaStart','intubation','surgeryStart','surgeryEnd','anesthesiaEnd','extubation'];
 for(const minutes of [[0,1,10,31,52,53],[0,0,0,0,0,0],[59,59,59,60,60,60]]){
  const rows=names.map((marker,i)=>({type:'marker',marker,observedAt:new Date(start+minutes[i]*60000).toISOString()}));rows.push({type:'measurement',observedAt:new Date(start+12*60000).toISOString(),values:{heartRate:100}});
  const html=A.printDocument({rows,ranges:[{start,minutes:60}],item:{patient:{name:'합성 환자'},body:{}},complete:false});const graph=html.match(/<section class="ap-chart">[\s\S]*?<\/svg>/)[0];
  const labels=[...graph.matchAll(/class="ap-phase-number" x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+)</g)];assert.equal(labels.length,6);assert.equal(new Set(labels.map(m=>m[2])).size,1);assert.deepEqual(labels.map(m=>+m[3]),[1,2,3,4,5,6]);
  labels.forEach((m,i)=>{assert.ok(+m[1]>=32&&+m[1]<=304);if(i)assert.ok(+m[1]-Number(labels[i-1][1])>=17.99);});
  const leaders=[...graph.matchAll(/class="ap-phase-leader" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];assert.equal(leaders.length,6);leaders.forEach((m,i)=>assert.ok(Math.abs(+m[3]-(32+minutes[i]/60*272))<0.00001));
  assert.ok(graph.includes('viewBox="0 0 320 114"'));assert.ok(!graph.includes('viewBox="0 -'));
 }
});
