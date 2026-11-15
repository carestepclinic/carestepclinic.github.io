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
test('trend does not invent missing measurements and preserves actual dates and values',()=>{
 assert.equal(P.trend('체중','kg',[{date:'2026-01-01',value:''},{date:'2026-02-01',value:5}]),'');const html=P.trend('체중','kg',[{date:'2026-01-01',value:0},{date:'2026-02-01',value:5}]);assert.ok(html.includes('2026-01-01'));assert.ok(html.includes('>0</text>'));assert.ok(html.includes('>5</text>'));
});
test('health report summary is explicit and private review notes remain excluded',()=>{
 const d=H.blank({name:'합성 환자',species:'cat'});d.overview='첫 장 핵심';d.summary='종합 소견';d.management='관리 계획';d.questions='PRIVATE_REVIEW';const html=H.reportHTML(d,{name:'합성 환자',species:'cat'},[]);
 assert.ok(html.includes('value="summary"'));assert.ok(html.includes('data-report-summary="true"'));assert.ok(!html.includes('PRIVATE_REVIEW'));assert.ok(!html.includes('의료진 검토 완료'));
});

test('technician and veterinarian remain distinct and safely escaped in print identity',()=>{
 const html=P.identity({veterinarian:'수의사',technician:'<검증>',patient:{name:'가상 환자'}});assert.ok(html.includes('수의사 · 테크니션 &lt;검증&gt;'));assert.ok(!html.includes('<검증>'));
});
test('short health report flows summary and management while retaining examination boundaries',()=>{
 const d=H.blank({name:'가상 환자'});Object.assign(d,{summary:'짧은 소견',management:'집에서 관리',followup:'재검 일정',exams:{physical:'신체 소견'}});const html=H.reportHTML(d,{name:'가상 환자'},[]);for(const title of ['종합소견','관리·재검 계획'])assert.ok(html.includes('data-report-title="'+title+'" data-new-page="false" data-compact="true" data-keep-together="true"'));assert.ok(html.includes('data-report-title="신체검사·진료 소견" data-new-page="true"'));
});
test('ward planned date stays in column while next-day actual timestamp remains explicit',()=>{
 const html=P.wardHTML([{at:'2026-11-15T23:50:00+09:00',actualAt:'2026-11-16T00:10:00+09:00',title:'자정 처치',dose:'0.25 mL',state:'완료',recorder:'담당자'}],['2026-11-15']);assert.ok(html.includes('예정 23:50'));assert.ok(html.includes('실시 2026-11-16 00:10'));assert.ok(html.includes('지시량 0.25 mL'));assert.ok(html.includes('수행 담당자'));
});
