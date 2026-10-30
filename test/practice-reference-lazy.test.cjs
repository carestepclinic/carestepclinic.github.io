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
