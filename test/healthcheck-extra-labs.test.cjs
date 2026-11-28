const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const H=require('../healthcheck-record.js'),{chromium}=require('playwright');let browser;
const {setup,start}=require('./helpers/healthcheck-ui.cjs')(()=>browser);
const out=path.resolve(__dirname,'../../healthcheck-extra-labs-20261128');fs.mkdirSync(out,{recursive:true});
const panel=(name,species='cat',ranges=true)=>H.addManualLabs([],name,species,'',ranges).labs;
const get=(name,species,item)=>panel(name,species).find(x=>x.name===item);
test('all additional configurations keep blank results, no review/date, valid source, supported species and destination',()=>{
 for(const species of ['dog','cat'])for(const [kind,spec] of Object.entries(H.manualExtraPanels))for(const ranges of [true,false]){
  const rows=panel(kind,species,ranges);assert.ok(rows.length);assert.ok(rows.every(r=>r.value===''&&!r.confirmed&&r.date===''&&r.unit&&r.source.length<=160&&H.labTab(r)===spec.tab));
  assert.ok(rows.every(r=>ranges?!!r.reference:r.reference===''));assert.equal(H.addManualLabs(rows,kind,species,'',ranges).added,0);
  assert.ok(rows.every(H.untouchedManualDefault));assert.deepEqual(H.manualLabDefaults(kind,'rabbit'),[]);
 }
});
test('thyroid methods and species remain distinct; canine TSH is not seeded for cats',()=>{
 assert.equal(get('갑상선','dog','Total T4').reference,'1.0 - 4.0');assert.equal(get('갑상선','cat','Total T4').reference,'0.8 - 4.7');
 assert.equal(get('갑상선','cat','Free T4').reference,'0.7 - 2.6');assert.ok(!get('갑상선','cat','TSH'));
 assert.equal(get('Free T4 · 평형투석(ED)','cat','Free T4 (ED)').reference,'1.2 - 4.3');
 const a=H.addManualLabs(panel('갑상선'),'Free T4 · 평형투석(ED)','cat','');assert.equal(a.added,1);
});
test('cardiac, inflammatory and pancreatic assays use species/method-specific units and intervals',()=>{
 assert.equal(get('심장표지자','dog','NT-proBNP').reference,'< 900');assert.equal(get('심장표지자','cat','NT-proBNP').reference,'< 100');
 const crp=get('염증표지자 · CRP/SAA','dog','CRP'),saa=get('염증표지자 · CRP/SAA','cat','SAA');assert.equal(crp.unit,'mg/L');assert.equal(crp.reference,'0 - 10');assert.equal(saa.unit,'μg/mL');assert.equal(saa.reference,'< 5');
 const cpl=panel('췌장 특이 리파아제 · cPL/fPL','dog'),fpl=panel('췌장 특이 리파아제 · cPL/fPL','cat');assert.equal(cpl.length,1);assert.equal(fpl.length,1);assert.equal(cpl[0].reference,'0 - 200');assert.equal(fpl[0].reference,'0 - 4.4');assert.equal(fpl[0].unit,'μg/L');
});
test('TLI uses updated canine threshold; GI nutrition and coagulation units are not converted',()=>{
 const tli=get('소화·흡수 · TLI/B12/Folate','dog','TLI');assert.equal(tli.reference,'≥ 10.9');assert.equal(H.rangeStatus({...tli,value:'8',confirmed:true}),'낮음');
 assert.equal(get('소화·흡수 · TLI/B12/Folate','cat','Cobalamin (B12)').unit,'ng/L');assert.equal(get('소화·흡수 · TLI/B12/Folate','cat','Folate').reference,'9.7 - 21.6');
 assert.equal(get('응고검사','dog','aPTT').reference,'11.0 - 17.5');assert.equal(get('응고검사','cat','PT').reference,'15.0 - 20.0');assert.equal(get('응고검사','cat','D-dimer').unit,'ng/mL');assert.equal(get('응고검사','cat','D-dimer').reference,'0 - 250');
});
test('pre/post meal and ACTH/LDDST timings are distinct; dynamic tests never receive a single normal range',()=>{
 assert.equal(get('담즙산 · 식전/식후','dog','식전 담즙산').reference,'0.0 - 14.9');assert.equal(get('담즙산 · 식전/식후','cat','식후 담즙산').reference,'0.0 - 14.9');
 for(const species of ['dog','cat'])for(const kind of ['ACTH 자극검사','LDDST']){const rows=panel(kind,species);assert.equal(new Set(rows.map(r=>H.canonicalName(r.name))).size,rows.length);for(const r of rows)assert.equal(H.rangeStatus({...r,value:'12',confirmed:true}),'개별 해석');}
 assert.equal(H.rangeStatus({...get('기초 Cortisol','dog','기초 Cortisol'),value:'3',confirmed:true}),'범위 내');
});
test('infection results stay blank and species-inappropriate tests are excluded',()=>{
 assert.deepEqual(panel('감염성 검사','dog').map(r=>r.name),['심장사상충 항원']);assert.equal(panel('감염성 검사','cat').length,4);
 for(const r of panel('감염성 검사')){assert.equal(r.reference,'음성');assert.equal(r.value,'');assert.equal(H.rangeStatus({...r,value:'음성',confirmed:true}),'정성 결과');}
});
test('existing values, modified references, dates and same test in another non-urine group are preserved',()=>{
 const old=[H.row({name:'NT-proBNP',value:'123',reference:'< 120',unit:'pmol/L',source:'병원 기준',date:'2026-10-01',confirmed:true}),H.row({name:'cTnI',reference:'< 0.18',group:'심장표지자'}),H.row({name:'PT',group:'기타 검사',value:'18',reference:'10 - 20'})];
 const r=H.addManualLabs(old,'심장표지자','cat','');assert.equal(r.added,0);assert.deepEqual(r.labs,old);assert.equal(H.addManualLabs(r.labs,'응고검사','cat','').labs.filter(x=>x.name==='PT').length,1);
 const row=panel('응고검사')[0];assert.ok(H.untouchedManualDefault(row));assert.equal(H.untouchedManualDefault({...row,reference:'5 - 20'}),false);assert.equal(H.untouchedManualDefault({...row,date:'2026-01-01'}),false);
 const report=H.reportHTML({...H.blank(),labs:[{...row,value:'17',reference:'15 - 22',confirmed:true}]},{});assert.match(report,/15 - 22/);assert.match(report,/17/);assert.doesNotMatch(report,/Fibrinogen/);
});
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});});after(()=>browser.close());
async function go(p,key){if(await p.locator('[data-step='+key+']').isVisible())await p.locator('[data-step='+key+']').click();else await p.locator('[data-compact-nav]').selectOption(key);}
async function choose(p,kind){await p.locator('.hc-manual-entry').evaluate(e=>e.open=true);await p.locator('[data-manual-extra]').selectOption(kind);}
for(const width of [390,1440])test('extra defaults preview, selection, edited values, navigation, save/reopen '+width,async t=>{
 const {p,errors}=await setup(width);t.after(()=>p.close());await start(p);await p.locator('[data-field=history]').fill('기존 문진 유지');await go(p,'additional');
 assert.ok(await p.locator('[data-manual-extra-add]').isDisabled());await choose(p,'갑상선');await p.locator('[data-manual-extra-preview] details>summary').click();assert.match(await p.locator('[data-manual-extra-preview]').innerText(),/0.8 - 4.7/);assert.doesNotMatch(await p.locator('[data-manual-extra-preview] table').innerText(),/TSH/);await p.locator('[data-manual-extra-add]').click();assert.equal(await p.locator('[data-row]').count(),2);
 const t4=p.locator('[data-row]').filter({has:p.locator('[data-lab=name][value="Total T4"]')});await t4.locator('[data-lab=value]').fill('2.1');await t4.locator('[data-lab=value]').blur();await t4.locator('[data-lab-settings]').click();await t4.locator('[data-lab=reference]').fill('0.9 - 4.5');await t4.locator('[data-lab=reference]').blur();
 await choose(p,'갑상선');await p.locator('[data-manual-extra-add]').click();assert.equal(await p.locator('[data-row]').count(),2);assert.equal(await t4.locator('[data-lab=reference]').inputValue(),'0.9 - 4.5');
 await choose(p,'LDDST');await p.locator('[data-manual-extra-add]').click();assert.equal(await p.locator('[data-row]').count(),5);
 await go(p,'labs');await choose(p,'응고검사');await p.locator('[data-manual-extra-preview] details>summary').click();assert.match(await p.locator('[data-manual-extra-preview]').innerText(),/Cornell/);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,'extra-'+width+'.png'),fullPage:true});await p.locator('[data-manual-extra-add]').click();assert.equal(await p.locator('[data-row]').count(),4);
 await choose(p,'염증표지자 · CRP/SAA');await p.locator('[data-manual-extra-add]').click();assert.equal(await p.locator('[data-lab=name][value=SAA]').count(),1);assert.equal(await p.locator('[data-lab=name][value=CRP]').count(),0);
 await p.locator('[data-action=save]').click();await p.waitForFunction(()=>stored.body.healthcheckChart.labs.length===10);await p.evaluate(()=>view.openRecord('record-1'));await go(p,'additional');assert.equal(await t4.locator('[data-lab=value]').inputValue(),'2.1');assert.equal(await t4.locator('[data-lab=reference]').inputValue(),'0.9 - 4.5');assert.equal(await p.evaluate(()=>stored.body.healthcheckChart.history),'기존 문진 유지');assert.equal(await p.evaluate(()=>calls.filter(c=>/lab-import|healthcheck-summary/.test(c.url)).length),0);assert.deepEqual(errors,[]);
});
test('units-only and read-only behavior work for additional tests',async t=>{const {p}=await setup();t.after(()=>p.close());await start(p);await go(p,'additional');await choose(p,'심장표지자');await p.locator('[data-manual-reference]').selectOption('blank');assert.doesNotMatch(await p.locator('[data-manual-extra-preview]').innerText(),/< 100/);await p.locator('[data-manual-extra-add]').click();assert.deepEqual(await p.locator('[data-lab=reference]').evaluateAll(xs=>xs.map(x=>x.value)),['','']);await choose(p,'갑상선');await p.evaluate(()=>{editable=false;view.sync();});assert.ok(await p.locator('[data-manual-extra-add]').isDisabled());await p.locator('[data-manual-extra-add]').evaluate(e=>e.click());assert.equal(await p.locator('[data-row]').count(),2);});
