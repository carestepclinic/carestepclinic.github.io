const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('../healthcheck-record.js'),R=require('../record-handoff.js');
const chart=()=>({...H.blank(),date:'2026-11-28',exams:{eyes:'우안 OD · 안압 · IOP: 18 mmHg\n기존 메모',oral:'기존 구강 소견'},history:'기존 과거력',summary:'기존 종합소견',labs:[H.row({name:'CREA',value:'1.1',reference:'수정 범위',confirmed:true})]});
const source=(date='2026-11-28')=>({id:'synthetic-eye',kind:'ophthalmic',date,record:{diagnosis:'가상 안과 진단',od:{iop:22,stt:0,menace:'reduced'},os:{iop:19},images:[]}});
const dental=(date='2026-11-28')=>({id:'synthetic-teeth',kind:'dental',date,record:{teeth:{'108':{missing:true},'208':{extractionPlan:true,extracted:true},'309':{fractured:true,pd:0,pockets:{MB:3},note:'직접 설명'},'310':{},'311':{missing:false}}}});
test('tooth-only records expose actual flags and values without inventing normal findings',()=>{
 const rows=R.candidates(dental(),'healthcheck',chart());assert.deepEqual(rows.map(x=>x.key),['tooth:108','tooth:208','tooth:309']);assert.match(rows[1].value,/발치 예정.*발치 시행/);assert.match(rows[2].value,/PD 0.*협측 근심: 3 mm.*직접 설명/);assert.doesNotMatch(rows.map(x=>x.value).join(' '),/정상|특이 소견 없음/);
});
test('tooth conflicts require comparison, preserve prose, and deduplicate repeated imports',()=>{
 const d=chart(),c=dental();assert.throws(()=>R.apply(c,'healthcheck',d,[{key:'tooth:108'}]),/선택/);assert.deepEqual(R.apply(c,'healthcheck',d,[{key:'tooth:108',mode:'keep'}]),d);
 const n=R.apply(c,'healthcheck',d,[{key:'tooth:108',mode:'append'}]);assert.match(n.exams.oral,/108번 치아: 결손/);assert.match(n.exams.oral,/기존 구강 소견/);assert.deepEqual(n.labs,d.labs);assert.deepEqual(R.apply(c,'healthcheck',n,[{key:'tooth:108',mode:'append'}]),n);
 c.record.teeth['108']={fractured:true};assert.throws(()=>R.apply(c,'healthcheck',n,[{key:'tooth:108',mode:'append'}]),/선택/);const replaced=R.apply(c,'healthcheck',n,[{key:'tooth:108',mode:'replace'}]);assert.match(replaced.exams.oral,/108번 치아: 파절/);assert.match(replaced.history,/변경 전 입력 · 108번 치아: 결손/);assert.match(replaced.exams.oral,/기존 구강 소견/);
});
test('past or undated tooth record remains reference only even with forced replacement',()=>{
 for(const date of ['2020-01-01','']){const d=chart(),c=dental(date),n=R.apply(c,'healthcheck',d,[{key:'tooth:108',mode:'replace'}]);assert.deepEqual(n.exams,d.exams);assert.match(n.history,/108번 치아: 결손/);assert.equal(n.labs[0].reference,'수정 범위');}
});
test('empty tooth destination can be selected, and reference overflow is atomic',()=>{
 const d=chart();d.exams.oral='';const c=dental(),n=R.apply(c,'healthcheck',d,[{key:'tooth:309'}]);assert.match(n.exams.oral,/309번 치아/);assert.doesNotMatch(n.exams.oral,/108번 치아/);d.history='가'.repeat(2999);assert.throws(()=>R.apply(c,'healthcheck',d,[{key:'tooth:309'}]),/과거력/);assert.equal(d.exams.oral,'');
});
test('eye conflict exposes each field and requires an explicit replace; keep is a no-op',()=>{
 const d=chart(),c=source(),r=R.candidates(c,'healthcheck',d).find(x=>x.key==='eye:od:iop');assert.equal(r.current,'18 mmHg');assert.equal(r.value,'22 mmHg');assert.equal(r.conflict,true);
 assert.throws(()=>R.apply(c,'healthcheck',d,[{key:r.key}]),/선택/);assert.deepEqual(R.apply(c,'healthcheck',d,[{key:r.key,mode:'keep'}]),d);
 const n=R.apply(c,'healthcheck',d,[{key:r.key,mode:'replace'},{key:'eye:od:stt'}]);assert.match(n.exams.eyes,/IOP: 22 mmHg/);assert.match(n.exams.eyes,/STT-1: 0 mm\/min/);assert.match(n.exams.eyes,/기존 메모/);assert.match(n.history,/변경 전 입력.*18 mmHg/);assert.deepEqual(n.labs,d.labs);assert.equal(n.summary,d.summary);assert.equal(c.record.od.iop,22);assert.match(d.exams.eyes,/18 mmHg/);
});
test('different or missing examination date cannot overwrite or fill current measurements even with replace',()=>{
 for(const date of ['2026-11-01','']){const d=chart(),c=source(date),n=R.apply(c,'healthcheck',d,[{key:'eye:od:iop',mode:'replace',replace:true},{key:'eye:os:iop'},{key:'finding'}]);assert.deepEqual(n.exams,d.exams);assert.match(n.history,/22 mmHg/);assert.equal(n.labs[0].reference,'수정 범위');}
});
test('repeat source fields and findings are idempotent, including historical references',()=>{
 for(const date of ['2026-11-28','2026-11-01']){const d=chart(),c=source(date),pick=[{key:'eye:od:iop',mode:'replace'},{key:'eye:os:iop'},{key:'finding'}],once=R.apply(c,'healthcheck',d,pick);once.reviewed=true;once.clinicalStatus='complete';const twice=R.apply(c,'healthcheck',once,pick);assert.deepEqual(twice,once);const refs=R.references(twice,'ophthalmic');assert.equal(refs.length,1);assert.equal(refs[0].lines.filter(x=>x==='우안 OD · 안압 · IOP: 22 mmHg').length,1);}
});
test('oral current and historical source notes append once without changing original text',()=>{
 for(const date of ['2026-11-28','2026-11-01']){const c={kind:'dental',date,id:'synthetic-dental',record:{diagnosis:'치석',procedure:'가상 처치'}},d=chart(),n=R.apply(c,'healthcheck',d,[{key:'finding'}]);assert.match(n.exams.oral,/기존 구강 소견/);assert.deepEqual(R.apply(c,'healthcheck',n,[{key:'finding'}]),n);if(date!==d.date){assert.equal(n.exams.oral,d.exams.oral);assert.match(R.references(n,'dental')[0].lines.join('\n'),/치석/);}}
});
test('legacy repeated lines remain intact except explicitly chosen first current value',()=>{
 const d=chart();d.exams.eyes+='\n[2026-11-28 · ophthalmic · legacy]\n우안 OD · 안압 · IOP: 21 mmHg';const n=R.apply(source(),'healthcheck',d,[{key:'eye:od:iop',mode:'replace'}]);assert.equal(H.splitClinicalText(n.exams.eyes,['우안 OD · 안압 · IOP'])['우안 OD · 안압 · IOP'],'22 mmHg');assert.match(n.exams.eyes,/legacy/);assert.match(n.exams.eyes,/21 mmHg/);
});
test('source references retain surrounding history and enforce storage limit atomically',()=>{
 const d=chart(),c=source();const n=R.apply(c,'healthcheck',d,[{key:'eye:od:stt'}]);n.history+='\n사용자가 덧붙인 메모';const more=R.apply(c,'healthcheck',n,[{key:'eye:os:iop'}]);assert.match(more.history,/기존 과거력/);assert.ok(more.history.endsWith('사용자가 덧붙인 메모'));assert.equal(R.references(more,'ophthalmic').length,1);d.history='가'.repeat(2999);assert.throws(()=>R.apply(c,'healthcheck',d,[{key:'eye:od:iop',mode:'replace'}]),/과거력/);assert.match(d.exams.eyes,/18 mmHg/);
});
