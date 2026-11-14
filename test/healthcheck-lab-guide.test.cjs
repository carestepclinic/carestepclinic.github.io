const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const api=require('../healthcheck-record.js');
const source=fs.readFileSync(path.join(__dirname,'../healthcheck-record.js'),'utf8');
const templates=vm.runInNewContext('('+source.match(/const templates=(.*);/)[1]+')');
const additional=vm.runInNewContext('('+source.match(/const extraTemplates=(.*);/)[1]+')');
const names=[...Object.values(templates).flat(),...Object.values(additional).flat()];
const rows=names.map(name=>({name,value:'1',confirmed:true}));
test('every built-in laboratory preset has a sourced explanation',()=>{
 for(const name of names){const guides=api.reportLabGuides([{name,value:'1'}],'dog');assert.equal(guides.length,1,name);for(const g of guides){assert.ok(g.purpose&&g.high&&g.low&&g.refs.length,name);}}
});
test('blank and unknown tests do not receive invented explanations; zero is included',()=>{
 assert.equal(api.reportLabGuides([{name:'ALT',value:''},{name:'ALT',value:' '},{name:'Custom assay',value:'5'}],'dog').length,0);
 assert.equal(api.reportLabGuides([{name:'GLU',value:0}],'dog').length,1);
 assert.equal(api.reportLabGuides(rows,'rabbit').length,0);
});
test('canonical aliases and instrument suffixes are matched once',()=>{
 const guides=api.reportLabGuides([{name:'CREA',value:'1'},{name:'Creatinine (IDEXX)',value:'2'},{name:'크레아티닌',value:'3'}],'cat');
 assert.equal(guides.length,1);assert.deepEqual(guides[0].names,['CREA']);
});
test('blood and urine results are not confused',()=>{
 assert.equal(api.reportLabGuides([{name:'GLU',group:'요검사',value:'3'}],'cat').length,0);
 assert.equal(api.reportLabGuides([{name:'pH',group:'요검사',value:'7'}],'cat')[0].title,'소변 pH');
});
test('infection and dynamic endocrine tests have context-appropriate labels',()=>{
 for(const name of ['심장사상충 항원','심장사상충 항체','FeLV 항원','FIV 항체']){const g=api.reportLabGuides([{name,value:'음성'}],'cat')[0];assert.equal(g.highLabel,'양성');assert.equal(g.lowLabel,'음성');}
 const g=api.reportLabGuides([{name:'LDDST 8시간 Cortisol',value:'1'}],'dog')[0];assert.equal(g.highLabel,'억제가 부족할 때');assert.match(g.low,/시점/);
});
test('common imported pancreatic and extended biochemistry tests are supported',()=>{
 for(const name of ['DBIL','BA','A/G','FRUCTOSAMINE','ICA','MG','TCO2','AMYL','LIP','CPL','FPL','TLI'])assert.equal(api.reportLabGuides([{name,value:'1'}],'dog').length,1,name);
});
test('report adds only relevant guides without modifying inputs, ranges or findings',()=>{
 const d={...api.blank(),labs:[{name:'ALT',value:'250',reference:'10–100',confirmed:true},{name:'GLU',value:''}],summary:'의료진 개별 소견'};
 const before=JSON.stringify(d),html=api.reportHTML(d,{name:'가상 환자',species:'dog'},[]);
 assert.equal(JSON.stringify(d),before);assert.match(html,/250/);assert.match(html,/10–100/);assert.match(html,/의료진 개별 소견/);assert.match(html,/간세포 관련 효소/);assert.doesNotMatch(html,/몸에서 사용하는 주요 에너지원/);
 assert.match(html,/이 환자의 진단을 뜻하지 않습니다/);assert.match(html,/근거 확인 2026-11-13/);
});
test('appendix retains every guide in a continuous section with valid public source links',()=>{
 const html=api.reportHTML({...api.blank(),labs:rows},{name:'가상 환자',species:'cat'},[]);
 const sections=html.split('<section class="report-part"').filter(s=>s.includes('<div class="lab-guide-grid">'));
 const count=api.reportLabGuides(rows,'cat').length;
 assert.equal(sections.length,1);
 assert.equal((html.match(/<article class="lab-guide">/g)||[]).length,count);
 for(const [,url] of html.matchAll(/<a href="([^"]+)"/g)){assert.equal(new URL(url).protocol,'https:');assert.ok(!url.includes('undefined'));}
});
test('patient text is escaped and a report without tests has no empty appendix',()=>{
 const html=api.reportHTML(api.blank(),{name:'<script>alert(1)</script>',species:'dog'},[]);
 assert.doesNotMatch(html,/<script>alert/);assert.doesNotMatch(html,/<div class="lab-guide-grid">/);
});
