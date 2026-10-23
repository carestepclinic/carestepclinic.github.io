const {test}=require('node:test'),assert=require('node:assert/strict');
const parser=require('../practice-library-dose.js');
// Synthetic quantities only. No handbook text or clinical drug dataset.
const entry=(text,extra={})=>({id:'synthetic',title:'Synthetic test only',group:'systemic',boundaryVerified:true,sections:[{heading:'Dosages',text}],...extra});
const analyze=(body,extra)=>parser.analyze(entry('DOGS:\nSynthetic indication (extra-label): '+body,extra)).profiles;
test('source-specific range lower bound, species, route and exact frequency',()=>{
 const p=parser.analyze(entry('DOGS:\nFirst indication (extra-label): 3–8 mg/kg PO every 12 hours.\nSecond indication (extra-label): 1–4 mg/kg SC every 24 hours.\nCATS:\nFeline indication (extra-label): 2–7 mg/cat PO twice daily.')).profiles;
 assert.deepEqual(p.map(x=>[x.species,x.low,x.route,x.frequency.times,x.basis]),[['dog',3,'PO',2,'kg'],['dog',1,'SC',1,'kg'],['cat',2,'PO',2,'fixed']]);assert.ok(p.every(x=>x.eligible));
});
test('multiline indication and unqualified bullet headings stay separate',()=>{
 const p=analyze('a) First test (extra-la-\nbel): 3 mg/kg PO every 12 hours.\nb) Different test: 9 mg/kg SC every 24 hours.');
 assert.equal(p.length,2);assert.match(p[1].title,/Different test/);assert.equal(p[1].low,9);
});
test('never carry dog or cat scope into other species or unscoped text',()=>{
 const p=parser.analyze(entry('1 mg/kg PO every 12 hours.\nDOGS:\n2 mg/kg PO every 12 hours.\nHORSES:\n3 mg/kg IV every 24 hours.\nCATS:\n4 mg/cat PO every 24 hours.\nSMALL MAMMALS:\n5 mg/kg SC every 12 hours.')).profiles;
 assert.deepEqual(p.map(x=>[x.species,x.low]),[['dog',2],['cat',4]]);
});
test('explicit shared DOGS/CATS dose yields separate profiles',()=>assert.deepEqual(parser.analyze(entry('DOGS/CATS:\n3 mg/kg PO every 12 hours.')).profiles.map(x=>x.species),['dog','cat']));
for(const [description,body,extra] of [
 ['multiple amounts','3 mg/kg PO, followed by 1 mg/kg PO every 12 hours.'],
 ['loading then maintenance','Loading dose 3 mg/kg PO followed by maintenance dosing.'],
 ['daily total','3 mg/kg/day PO.'],
 ['conditional renal dose','3 mg/kg PO every 12 hours if renal function permits.'],
 ['combination','3 mg/kg PO in addition to another medicine.'],
 ['alternate numeric dose','3 or 9 mg/kg PO every 12 hours.'],
 ['milliunit alternative','3 milliunits/kg/minute (0.18 units/kg/hour) IV CRI.'],
 ['other tablet amount','3 mg/kg PO with 10 mg tablets.'],
 ['upper limit','Up to 3 mg/kg PO every 12 hours.'],
 ['titration','3 mg/kg PO initially and titrate as needed.'],
 ['negative number','-3 mg/kg PO every 12 hours.'],
 ['inequality','<3 mg/kg PO every 12 hours.'],
 ['approximate','≈3 mg/kg PO every 12 hours.'],
 ['multiple routes','3 mg/kg PO or IV every 12 hours.'],
 ['missing route','3 mg/kg every 12 hours.'],
 ['wrong fixed species','3 mg/cat PO every 12 hours.'],
 ['toxic dose','Toxic dose 3 mg/kg PO.'],
 ['species comparison','In horses 3 mg/kg IV every 12 hours.'],
 ['unit volume','3 mL/kg IV every 12 hours.'],
 ['unexplained time unit','3 mg/kg/hour IV.'],
 ['CRI without time denominator','3 mg/kg IV CRI.'],
 ['unsupported unit/minute CRI','3 units/kg/minute IV CRI.'],
 ['not recommended','3 mg/kg PO is not recommended.'],
 ['official errata','3 mg/kg PO every 12 hours.',{errata:true}],
 ['unverified boundary','3 mg/kg PO every 12 hours.',{boundaryVerified:false}],
 ['topical group','3 mg/kg PO every 12 hours.',{group:'ophthalmic'}]
])test('hold '+description,()=>assert.ok(analyze(body,extra).every(x=>!x.eligible),description));
test('ideal body weight note blocks automatic actual-weight interpretation',()=>assert.ok(parser.analyze(entry('Use ideal body weight.\nDOGS:\n3 mg/kg PO every 12 hours.')).profiles.every(x=>!x.eligible)));
for(const [body,expected] of [
 ['0.3–0.8 mg/kg PO every 12 hours.',['kg','mg',0.3,'dose',2]],
 ['.3–.8 µg/kg SC every 24 hours.',['kg','mcg',0.3,'dose',1]],
 ['2 mg/dog (NOT mg/kg) PO every 12 hours.',['fixed','mg',2,'dose',2]],
 ['2–4 mg/m² PO every 24 hours.',['bsa','mg',2,'dose',1]],
 ['0.2–0.4 units/kg SC every 12 hours.',['kg','U',0.2,'dose',2]],
 ['0.002–0.004 g/kg PO every 24 hours.',['kg','mg',2,'dose',1]],
 ['2–4 mcg/kg/minute IV CRI.',['kg','mcg',2,'cri',null]],
 ['0.2–0.4 units/kg/hour IV CRI.',['kg','U',0.2,'cri',null]]
])test('preserve dimensional basis '+body,()=>{const p=analyze(body)[0];assert.equal(p.eligible,true,p.reasons.join(';'));assert.deepEqual([p.basis,p.unit,p.low,p.kind,p.frequency.times],expected);});
for(const text of ['3 mg/kg PO every 8 to 12 hours.','3 mg/kg PO once or twice daily.','3 mg/kg PO every 12 hours or every 24 hours.','3 mg/kg PO twice to three times daily.'])test('do not choose a frequency range: '+text,()=>{const p=analyze(text)[0];assert.equal(p.frequency.times,null);assert.equal(p.frequency.single,false);});
test('citation-adjacent frequency and single dose',()=>{assert.equal(parser.frequency('PO every 12 hours13').times,2);assert.equal(parser.frequency('PO twice daily14').times,2);assert.equal(parser.frequency('PO once1').single,true);});
test('does not inspect non-dosage sections for numerical candidates',()=>assert.equal(parser.analyze({...entry(''),sections:[{heading:'Adverse Effects',text:'DOGS:\n3 mg/kg PO every 12 hours.'}]}).profiles.length,0));
test('wrapped bullet heading cannot inherit the previous indication',()=>{const p=analyze('a) First condition:\n3 mg/kg PO every 12 hours.\nb) Separate condition with a\nwrapped indication title:\n4 mg/kg PO every 24 hours.');assert.equal(p.length,2);assert.match(p[1].title,/Separate condition/);assert.doesNotMatch(p[1].title,/First condition/);});
test('generic subheading keeps parent indication',()=>{const p=analyze('\na) Most commonly recommended:\n3 mg/kg PO every 12 hours.');assert.match(p[0].title,/Synthetic indication.*Most commonly recommended/);});
test('next indication does not absorb a prior wrapped route/frequency line',()=>{const p=analyze('3 mg/kg\nPO every 12 hours; from a test8\nNew indication (extra-label):\n4 mg/kg SC every 24 hours.');assert.equal(p.length,2);assert.equal(p[1].title,'New indication (extra-label):');});
test('generic subheading is scoped to its own bullet',()=>{const p=analyze('\na) Most commonly recommended:\n3 mg/kg PO every 12 hours.\nb) 4 mg/kg PO every 24 hours.');assert.doesNotMatch(p[1].title,/Most commonly/);assert.match(p[1].title,/Synthetic indication/);});
for(const text of ['3 mg/kg PO 3 or 4 times daily.','3 mg/kg PO 2 to 3 times daily.','3 mg/kg PO repeat in 48 hours or once daily.'])test('ambiguous numeric frequency remains blank: '+text,()=>assert.equal(analyze(text)[0].frequency.times,null));
for(const text of ['3 mg/kg PO every 12 hours then decrease to once daily.','3 mg/kg PO is not often recommended.','3 mg/kg PO was used in a pharmacokinetic study.','3 mg/kg PO in conjunction with another drug.'])test('conditional or research dose stays reference-only: '+text,()=>assert.equal(analyze(text)[0].eligible,false));
for(const text of ['3–8 mg/kg PO every 12 hours; the upper end is preferred.','3 mg/kg PO once daily on alternating weeks.','3 mg/kg IV for regional anesthesia.'])test('special context is not a generic low-dose preset: '+text,()=>assert.equal(analyze(text)[0].eligible,false));
test('an unclassified indication is reference-only',()=>assert.equal(parser.analyze(entry('DOGS:\n3 mg/kg PO every 12 hours.')).profiles[0].eligible,false));
