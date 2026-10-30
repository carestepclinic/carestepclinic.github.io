const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../practice-prescription-library.js'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('Korean safety summary loads automatically, source documents wait for expand and are cached',async t=>{
 const dom=new JSDOM('<section data-kind-panel="batch"><div id="root"><div class="pt-drug-references"></div></div></section>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,requests=[],summaries=[];
 w.PracticePrescriptionSummary={mount:()=>({update:(metas,missing)=>summaries.push({metas,missing}),dispose(){}})};w.eval(source);
 const entry={id:'a',title:'Synthetic',group:'systemic',page:1,hash:'hash',sections:[{heading:'Drug Interactions',text:'SYNTHETIC ONLY'}]};
 const request=async p=>{requests.push(p);return p==='/practice/references'?{libraries:[{id:'lib',status:'ready',count:1}]}:p.endsWith('/entries/a')?{entry}:{id:'lib',title:'Synthetic library',index:[entry]};};
 const view=w.PracticePrescriptionLibrary.mount(w.document.querySelector('#root'),{request,guard:()=>true});view.update([{drug:'Synthetic',route:'PO'}]);await wait(250);
 assert.equal(summaries.at(-1).metas[0].title,'Synthetic');assert.equal(requests.filter(p=>p.includes('/entries/')).length,0);
 const details=w.document.querySelector('[data-private-originals]');details.open=true;await wait(30);assert.equal(requests.filter(p=>p.includes('/entries/')).length,1);assert.match(w.document.querySelector('[data-private-content]').textContent,/SYNTHETIC ONLY/);
 details.open=false;await wait(10);details.open=true;await wait(30);assert.equal(requests.filter(p=>p.includes('/entries/')).length,1);
 view.update([]);assert.equal(w.document.querySelectorAll('[data-private-content]').length,0);view.dispose();
});
test('late original response cannot repopulate a cleared prescription',async t=>{
 const dom=new JSDOM('<section data-kind-panel="batch"><div id="root"><div class="pt-drug-references"></div></div></section>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.PracticePrescriptionSummary={mount:()=>({update(){},dispose(){}})};w.eval(source);let release;
 const entry={id:'a',title:'Synthetic',group:'systemic',page:1,hash:'hash',sections:[]};
 const view=w.PracticePrescriptionLibrary.mount(w.document.querySelector('#root'),{guard:()=>true,request:async p=>p==='/practice/references'?{libraries:[{id:'lib',status:'ready',count:1}]}:p.includes('/entries/')?new Promise(r=>release=()=>r({entry})):{id:'lib',index:[entry],title:'Synthetic'}});
 view.update([{drug:'Synthetic'}]);await wait(250);w.document.querySelector('[data-private-originals]').open=true;await wait(20);assert.equal(typeof release,'function');view.update([]);release();await wait(20);assert.equal(w.document.querySelectorAll('[data-private-content]').length,0);view.dispose();
});
test('reference patient and reset keep manual dose in single mode',t=>{
 const inputs=names=>names.map(n=>'<input name="'+n+'">').join('');
 const dom=new JSDOM('<main><section data-kind-panel="med"><form data-calc="dose">'+inputs(['dose','concentration','times','days','totalDoses','doseBasis','doseUnit','strengthUnit'])+'<select name="courseMode"><option value="single">Single</option><option value="days">Days</option></select></form></section><form data-calc="fluid">'+inputs(['rate','volume','hours'])+'</form></main>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 w.PracticeReference={checked:'test',drugs:[],fluids:[],species:()=>''};w.eval(fs.readFileSync(require.resolve('../practice-reference-ui.js'),'utf8'));
 const view=w.PracticeReferenceUI.mount(w.document.querySelector('main'),{layout(){},clear(){}}),mode=w.document.querySelector('[name=courseMode]');let changes=0;mode.addEventListener('change',()=>changes++);
 mode.value='days';view.patient(null);assert.equal(mode.value,'single');mode.value='days';view.resetPreset();assert.equal(mode.value,'single');assert.equal(changes,2);
});
