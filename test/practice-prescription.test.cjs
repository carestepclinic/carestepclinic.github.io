const {test}=require('node:test'),assert=require('node:assert/strict'),rx=require('../practice-prescription.js');
const sample='omeprazole 0.5 mg/kg\ntelmisartan 0.5 mg/kg\nUDCA 5 mg/kg po bid for 28 days';
for(const unit of ['T','t','Tab','Tablets','정'])test('count prescription '+unit+' is explicit and independent of mass',()=>{
 const row={...rx.parseLine('Synthetic 0.5 '+unit+'/kg PO BID for 28 days'),form:'tablet',strength:'1',strengthUnit:'T'};
 assert.deepEqual(row.issues,[]);assert.equal(row.doseUnit,'T');const r=rx.calculate(row,4);assert.equal(r.amount,2);assert.equal(r.total,112);assert.equal(r.mg,undefined);
 for(const patch of [{strengthUnit:'mg'},{strengthUnit:'U'},{strength:2},{form:'liquid'},{doseUnit:'mg'}])assert.throws(()=>rx.calculate({...row,...patch},4));if(/^(T|t)$/.test(unit))assert.equal(rx.calculate({...row,form:'capsule'},4).unit,'캡슐');else assert.throws(()=>rx.calculate({...row,form:'capsule'},4));
});
test('tablet fixed amounts remain counts and cannot use body surface area',()=>{const calc=require('../practice-calculators.js');const v={weight:4,doseBasis:'fixed',dose:.5,doseUnit:'T',strength:1,strengthUnit:'T',form:'tablet',times:2,days:28};assert.equal(calc.prescription(v).total,28);assert.throws(()=>calc.prescription({...v,doseBasis:'bsa',bsa:.5}));});
test('user example reads separate drug doses and shares the final schedule within its block',()=>{const r=rx.parse(sample);assert.deepEqual(r.map(x=>x.drug),['omeprazole','telmisartan','UDCA']);assert.deepEqual(r.map(x=>x.dose),['0.5','0.5','5']);assert.equal(r[0].times,'2');assert.equal(r[1].days,'28');assert.equal(r[2].route,'PO');assert.equal(r[2].times,'2');assert.equal(r[2].days,'28');assert.deepEqual(r.flatMap(x=>x.issues),[]);});
test('explicit common schedule fills missing fields and preserves per-drug overrides',()=>{const r=rx.parse(sample.split('\n').join('\n\n')+'\n\nOther 1 mg/kg po sid for 3 days'),a=rx.common(r,{route:'PO',times:'2',days:'28'});assert.deepEqual(a.map(x=>x.times),['2','2','2','1']);assert.deepEqual(a.map(x=>x.days),['28','28','28','3']);assert.deepEqual(a[0].commonFields,['route','times','days']);assert.equal(r[0].times,'');});
for(const [suffix,times,days] of [['PO BID for 28 days','2','28'],['po q12h 28days','2','28'],['경구 하루 2회 28일','2','28'],['PO TID for 2 weeks','3','14'],['PO q4h for 1 day','6','1'],['PO q24h 1주','1','7'],['PO QID 3days','4','3']])test('recognizes supported schedule '+suffix,()=>{const r=rx.parseLine('Synthetic 0.5mg/kg '+suffix);assert.deepEqual(r.issues,[]);assert.equal(r.times,times);assert.equal(r.days,days);assert.equal(r.route,'PO');});
for(const unit of ['mcg','ug','UG','Ug','μg','µg'])test('normalizes micrograms '+unit,()=>{const r=rx.parseLine('Synthetic .5 '+unit+'/kg/회 PO BID 28일');assert.equal(r.doseUnit,'mcg');assert.deepEqual(r.issues,[]);});
for(const line of ['Synthetic 5-10 mg/kg PO BID 28일','Synthetic 5–10 mg/kg PO BID 28일','Synthetic 5 mg/kg/day PO BID 28일','Synthetic 5 mg/kg PO PRN','Synthetic 5 mg/kg IV BID 28일','Synthetic 5 mg/kg PO q48h 28일','Synthetic 5 mg/kg PO BID then SID','Synthetic 5 mg/kg PO BID SID 28일','Synthetic 5 mg/kg PO BID for 3-5 days','Synthetic 5 mg/kg PO BID for 3.5 days','Synthetic 5 mg/kg PO BID for 0 days','Synthetic 5 mg/kg PO BID 28일 식후','Synthetic 5 mg/kg/min','Synthetic 5 mg/5mL','Synthetic 5 mg/kg + Other 1 mg/kg','Synthetic 5,5 mg/kg','Synthetic 1e2 mg/kg','Synthetic 5 mg/kg PO BID 28일 14일'])test('unsupported or ambiguous prescription cannot silently calculate: '+line,()=>{const r={...rx.parseLine(line),form:'tablet',strength:'20',strengthUnit:'mg'};assert.throws(()=>rx.calculate(r,10));});
test('arithmetic: common 28-day course yields separate tablet and liquid totals',()=>{const rows=rx.common(rx.parse(sample),{route:'PO',times:'2',days:'28'}).map((r,i)=>({...r,form:i===1?'liquid':'tablet',strength:[20,2,100][i],strengthUnit:'mg'}));const results=rows.map(r=>rx.calculate(r,10));assert.deepEqual(results.map(x=>x.amount),[.25,2.5,.5]);assert.deepEqual(results.map(x=>x.total),[14,140,28]);assert.deepEqual(results.map(x=>x.totalDoses),[56,56,56]);assert.deepEqual(results.map(x=>x.unit),['정','mL','정']);});
const valid={...rx.parseLine('Synthetic 2 mg/kg PO BID for 3 days'),form:'tablet',strength:'3',strengthUnit:'mg'};
test('fractional tablets remain unrounded and micrograms conserve mass',()=>{const a=rx.calculate(valid,5);assert.ok(Math.abs(a.amount-10/3)<1e-12);assert.equal(a.total,20);assert.equal(rx.calculate({...valid,dose:'2000',doseUnit:'mcg'},5).total,20);assert.equal(rx.calculate({...valid,strength:'3000',strengthUnit:'mcg'},5).total,20);});
for(const patch of [{times:''},{days:''},{days:'1.5'},{days:'0'},{days:'367'},{times:'25'},{times:'2.5'},{route:''},{route:'IV'},{strength:''},{strength:'0'},{strength:'1e3'},{doseUnit:'U'},{form:''},{strengthUnit:'mL'},{dose:'-5'},{dose:0}])test('missing or invalid value stays blocked '+JSON.stringify(patch),()=>assert.throws(()=>rx.calculate({...valid,...patch},5)));
test('invalid weight, empty input and oversized input cannot yield results',()=>{for(const w of ['',0,-1,201,'NaN'])assert.throws(()=>rx.calculate(valid,w));for(const s of ['',Array(32).join('X\n'),'x'.repeat(12001)])assert.throws(()=>rx.parse(s));});
test('unknown suffix needs explicit review after editing; readable source is preserved',()=>{const r=rx.parseLine('Synthetic 2 mg/kg PO BID 3 days note');assert.ok(r.issues.length);assert.throws(()=>rx.calculate({...r,form:'tablet',strength:3,strengthUnit:'mg'},5));assert.equal(rx.calculate({...r,reviewed:true,form:'tablet',strength:3,strengthUnit:'mg'},5).total,20);assert.match(r.original,/note$/);});

for(const text of ['lefotil 1/4 T/head po bid for 14 days','lefotil 1 / 4 T/HEAD po bid for 14 days','lefotil ¼ T/head po bid for 14 days','lefotil 0.25 T/마리 경구 하루 2회 14일','lefotil 0.25 T/animal/회 PO BID 14days'])test('per-animal count keeps seven tablets regardless of weight: '+text,()=>{
 const row={...rx.parseLine(text),form:'tablet',strength:1,strengthUnit:'T'};assert.deepEqual(row.issues,[]);assert.equal(row.drug,'lefotil');assert.equal(row.doseBasis,'fixed');for(const w of [2,4.4,10]){const r=rx.calculate(row,w);assert.equal(r.amount,.25);assert.equal(r.total,7);}assert.equal(row.original,text);
});
test('fractional mg and mcg fixed doses preserve mass and differ from per-kg doses',()=>{
 const a={...rx.parseLine('Synthetic 1/2 mg/head PO BID 14 days'),form:'capsule',strength:100,strengthUnit:'mg'};assert.equal(rx.calculate(a,4.4).total,.14);assert.equal(rx.calculate({...a,dose:'500',doseUnit:'mcg'},8).total,.14);
 const b={...rx.parseLine('Synthetic 1/4 T/kg PO BID 14 days'),form:'tablet',strength:1,strengthUnit:'T'};assert.equal(b.doseBasis,'kg');assert.ok(Math.abs(rx.calculate(b,4.4).total-30.8)<1e-10);
});
for(const dose of ['1/0','0/4','-1/4','1/-4','1/2/3','1 1/2','1/2-1','1/2+1','1/2~1','1e2/4'])test('ambiguous or invalid fraction is blocked: '+dose,()=>{const r={...rx.parseLine('Synthetic '+dose+' T/head PO BID 14 days'),form:'tablet',strength:1,strengthUnit:'T'};assert.throws(()=>rx.calculate(r,4.4));});
test('manual review cannot bypass an invalid fixed dose or missing dose basis',()=>{
 const row={...rx.parseLine('Synthetic 1/0 T/head PO BID 14 days'),form:'tablet',strength:1,strengthUnit:'T',reviewed:true};assert.throws(()=>rx.calculate(row,4.4));assert.equal(rx.calculate({...row,dose:'1/4'},4.4).total,7);assert.throws(()=>rx.calculate({...row,dose:'1/4',doseBasis:''},4.4));assert.throws(()=>rx.calculate({...row,dose:'1/4',doseBasis:'head'},4.4));
});

for(const unit of ['ug','UG','mcg','μg','µg'])test('misoprostol microgram spelling preserves exact dose and total: '+unit,()=>{
 const original='misoprostol 5 '+unit+'/kg po bid for 14 days',row={...rx.parseLine(original),form:'tablet',strength:'200',strengthUnit:'mcg'};
 assert.deepEqual(row.issues,[]);assert.equal(row.drug,'misoprostol');assert.equal(row.dose,'5');assert.equal(row.doseUnit,'mcg');assert.equal(row.original,original);const result=rx.calculate(row,4);assert.equal(result.mg,.02);assert.ok(Math.abs(result.amount-.1)<1e-12);assert.ok(Math.abs(result.total-2.8)<1e-12);
});
for(const line of ['misoprostol 200 ug 5 ug/kg po bid for 14 days','misoprostol 2-5 ug/kg po bid for 14 days','misoprostol 5 ugg/kg po bid for 14 days'])test('ug support keeps ambiguous or unsupported doses blocked: '+line,()=>{
 const row={...rx.parseLine(line),form:'tablet',strength:'200',strengthUnit:'mcg'};assert.ok(row.issues.length);assert.throws(()=>rx.calculate(row,4));
});

for(const timing of ['아침','점심','저녁','취침 전'])test('bounded timing note is preserved without deriving a schedule: '+timing,()=>{
 const row=rx.parseLine('Synthetic 6 mg/head po sid for 28 days ('+timing+')');assert.deepEqual(row.issues,[]);assert.equal(row.timing,timing);assert.equal(row.times,'1');assert.equal(row.doseBasis,'fixed');
 const result=rx.calculate({...row,form:'tablet',strength:75,strengthUnit:'mg'},10);assert.ok(Math.abs(result.total-2.24)<1e-12);
 const missing=rx.parseLine('Synthetic 6 mg/head ('+timing+')');assert.equal(missing.route,'');assert.equal(missing.times,'');assert.equal(missing.days,'');assert.throws(()=>rx.calculate({...missing,form:'tablet',strength:75,strengthUnit:'mg'},10));
});
for(const note of ['(저녁 PRN)','(아침·저녁)','(중단)','(저녁) (아침)','(저녁) PRN','(저녁) then BID'])test('clinical instructions inside or after a timing note remain blocked: '+note,()=>{
 const row=rx.parseLine('Synthetic 6 mg/head po sid for 28 days '+note);assert.ok(row.issues.length);assert.throws(()=>rx.calculate({...row,form:'tablet',strength:75,strengthUnit:'mg'},10));
});
test('common BID schedule leaves the separate SID evening row and its note intact',()=>{
 const rows=rx.parse('First 1 mg/kg\nSecond 2 mg/head\nThird 3 mg/kg po bid for 28 days\n\nFourth 6 mg/head po sid for 28 days (저녁)'),out=rx.common(rows,{route:'PO',times:'2',days:'28'});
 assert.deepEqual(out.map(x=>x.times),['2','2','2','1']);assert.deepEqual(out.map(x=>x.timing),['','','','저녁']);assert.deepEqual(out.map(x=>x.doseBasis),['kg','fixed','kg','fixed']);assert.equal(rows[0].times,'2');
});

test('blank-line groups inherit only their trailing complete regimen and timing',()=>{
 const text='First 1 mg/kg\nSecond 2 mg/head\nThird 3 mg/kg\nFourth 4 mg/kg po bid for 28 days\n\nFifth 5 mg/head\nSixth 6 mg/head po sid for 28 days (저녁)',rows=rx.parse(text);
 assert.deepEqual(rows.map(r=>r.times),['2','2','2','2','1','1']);assert.deepEqual(rows.map(r=>r.timing),['','','','','저녁','저녁']);assert.deepEqual(rows.map(r=>r.groupNumber),[1,1,1,1,2,2]);assert.deepEqual(rows[4].groupFields,['route','times','days','timing']);assert.equal(rows[4].groupFrom,'Sixth');assert.equal(rows[4].original,'Fifth 5 mg/head');
 const changed=rx.common(rows,{route:'PO',times:'3',days:'7'});assert.deepEqual(changed.map(r=>r.times),rows.map(r=>r.times));assert.ok(changed.every(r=>r.days==='28'));
 const results=rows.map((r,i)=>rx.calculate({...r,form:'tablet',strength:[30,50,10,10,5,75][i],strengthUnit:'mg'},10));assert.deepEqual(results.map(r=>r.totalDoses),[56,56,56,56,28,28]);assert.equal(results[4].total,28);assert.equal(results[5].total,2.24);
});
for(const separator of ['\n\n','\r\n \t\r\n','\n \n\n'])test('blank separators prevent backwards leakage '+JSON.stringify(separator),()=>{
 const rows=rx.parse('First 1 mg/kg'+separator+'Second 2 mg/head PO SID 3 days (저녁)');assert.equal(rows[0].times,'');assert.equal(rows[0].timing,'');assert.deepEqual(rows[0].groupFields,[]);assert.equal(rows[1].times,'1');
});
test('different complete schedules in an undivided block do not silently fill missing rows',()=>{
 const rows=rx.parse('First 1 mg/kg\nSecond 2 mg/kg PO BID 28 days\nThird 3 mg/head PO SID 28 days (저녁)');assert.equal(rows[0].times,'');assert.match(rows[0].issues.join(''),/서로 다른 용법/);assert.equal(rows[1].times,'2');assert.equal(rows[2].times,'1');assert.equal(rows[1].timing,'');
});
test('explicit partial overrides and timing remain individual',()=>{
 const rows=rx.parse('First 1 mg/kg TID\nSecond 2 mg/head (아침)\nThird 3 mg/head PO SID 28 days (저녁)');assert.equal(rows[0].times,'3');assert.equal(rows[0].timing,'');assert.equal(rows[0].days,'28');assert.equal(rows[1].timing,'아침');assert.equal(rows[1].times,'1');
});
for(const suffix of ['PO BID','PO BID 0 days','PO BID 400 days','PO BID 28 days PRN','PO q48h 28 days'])test('incomplete or invalid trailing regimen cannot supply a group: '+suffix,()=>{
 const rows=rx.parse('First 1 mg/kg\nSecond 2 mg/kg '+suffix);assert.equal(rows[0].route,'');assert.equal(rows[0].times,'');assert.deepEqual(rows[0].groupFields,[]);
});
test('group parsing still blocks unknown per-line clinical instructions and keeps thirty-row bounds',()=>{
 const rows=rx.parse('First 1 mg/kg PRN\nSecond 2 mg/kg PO BID 28 days');assert.ok(rows[0].issues.length);assert.equal(rows[0].times,'');assert.equal(rx.parse(Array(30).fill('Synthetic 1 mg/kg PO SID 1 day').join('\n\n')).length,30);assert.throws(()=>rx.parse(Array(31).fill('Synthetic 1 mg/kg PO SID 1 day').join('\n\n')));
});
