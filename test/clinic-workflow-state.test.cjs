const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const S=require('../clinic-workflow-state.js'),source=fs.readFileSync(require.resolve('../clinic-workflow-state.js'),'utf8');
test('scheduled, held and omitted care never look completed',()=>{
 for(const value of ['planned','prn','late','held','omitted','cancelled'])assert.notEqual(S.describe('task',value).tone,'complete');
 assert.equal(S.describe('task','done').tone,'complete');assert.equal(S.describe('task','late').tone,'attention');
});
test('delivery failures and unread messages have independent counts and colors',()=>{
 const rows=[{sourceType:'message',status:'failed'},{sourceType:'home',operationalStatus:'overdue'},{sourceType:'home',operationalStatus:'overdue',readAt:'2026-11-28'},{sourceType:'message',status:'failed',failureAcknowledgedAt:'now'},{sourceType:'message',status:'failed',action:{status:'resolved'}}];
 assert.deepEqual(S.deliveryCounts(rows),{failed:1,unread:1});assert.equal(S.work(rows[0]).tone,'error');assert.equal(S.work(rows[1]).tone,'attention');assert.match(S.deliveryHTML(rows),/발송 실패 1/);assert.match(S.deliveryHTML(rows),/미열람 1/);
});
test('late assignments and urgent clinical flags remain distinct',()=>{
 assert.equal(S.work({sourceType:'internal',action:{breached:true}}).tone,'attention');assert.equal(S.work({action:{priority:'urgent'}}).tone,'error');assert.equal(S.work({action:{status:'resolved',priority:'urgent'}}).tone,'complete');
});
test('receipt and intake require actual completion; calculated values are neutral',()=>{
 assert.equal(S.describe('purchase','ordered').tone,'neutral');assert.equal(S.describe('purchase','partial').tone,'attention');assert.equal(S.describe('purchase','received').tone,'complete');
 assert.equal(S.describe('intake','pending').tone,'attention');assert.equal(S.describe('intake','reviewed').tone,'complete');assert.equal(S.describe('calculation','calculated').tone,'neutral');assert.equal(S.describe('calculation','reviewed').tone,'complete');assert.equal(S.describe('booking','booked').tone,'neutral');
 assert.doesNotMatch(S.badge('intake','pending','<img onerror=alert(1)>'),/<img/);
});
function dom(html){const d=new JSDOM('<main>'+html+'</main>',{runScripts:'outside-only'});d.window.eval(source);return d;}
test('required highlights do not mutate values, optional fields, validation or submit',async()=>{
 const d=dom('<form><label>약물 농도<input name="strength" required></label><label>선택 메모<input name="note"></label><label><input name="confirmed" type="checkbox" required>제품 확인</label></form>'),w=d.window,f=w.document.querySelector('form');let writes=0;f.addEventListener('submit',()=>writes++);w.ClinicWorkflowState.watchForm(f);
 assert.equal(f.querySelectorAll('.cs-state-field').length,2);assert.equal(f.elements.note.required,false);assert.equal(f.elements.strength.hasAttribute('aria-invalid'),false);
 f.elements.strength.value='10';f.elements.strength.dispatchEvent(new w.Event('input',{bubbles:true}));f.elements.confirmed.checked=true;f.elements.confirmed.dispatchEvent(new w.Event('change',{bubbles:true}));await Promise.resolve();
 assert.equal(f.querySelectorAll('.cs-state-field').length,0);assert.equal(f.elements.confirmed.closest('label').classList.contains('cs-explicit-review'),true);assert.equal(writes,0);d.window.close();
});
test('calculator presentation removes stale confirmation and ignores hidden or disabled inputs',()=>{
 const d=dom('<form data-calc="batch"><label>농도<input name="strength" required></label><label hidden>선택<input required></label><label><input required disabled></label><section class="pt-prescription-result"><output>가상 계산값 12</output><label><input data-checked type="checkbox">검토 확인</label></section></form>'),w=d.window,r=w.document.querySelector('main'),f=r.querySelector('form'),out=f.querySelector('output');
 w.ClinicWorkflowState.calculator(r,null);assert.equal(r.querySelectorAll('.cs-state-field').length,1);assert.equal(r.querySelector('[data-cs-calculation] [data-cs-state]').dataset.csState,'neutral');
 f.querySelector('[data-checked]').checked=true;w.ClinicWorkflowState.calculator(r,null);assert.equal(r.querySelector('[data-cs-calculation] [data-cs-state]').dataset.csState,'complete');
 f.querySelector('[data-checked]').checked=false;out.textContent='';f.dataset.calculationState='pending';w.ClinicWorkflowState.calculator(r,null);assert.equal(r.querySelector('[data-cs-calculation] [data-cs-state]').dataset.csState,'attention');assert.equal(r.querySelectorAll('[data-cs-calculation]').length,1);d.window.close();
});
test('actual purchase cards use server status and remaining quantity without ordering',async()=>{
 const d=dom('<section id="purchases"></section>'),w=d.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.eval(fs.readFileSync(require.resolve('../clinic-purchases.js'),'utf8'));let writes=0;
 const board={revision:1,userId:'staff',manager:true,canRequest:true,categories:[{id:'c',name:'검사 시약',active:true}],vendors:[],items:['needed','ordered','partial','received'].map((status,i)=>({id:'item-'+i,name:'가상 물품 '+i,status,categoryId:'c',quantity:10,received:status==='partial'?3:status==='received'?10:0,unit:'개',requester:'가상 직원',createdAt:'2026-11-28',updatedAt:'2026-11-28',events:[]}))};
 const view=w.ClinicPurchases.mount(w.document.querySelector('#purchases'),{ready:()=>true,identity:()=> 'test',request:async(p,o)=>{if(o)writes++;return board;}});view.open();await new Promise(r=>setTimeout(r,0));assert.match(w.document.querySelector('[data-cs-state=attention]').textContent,/주문 필요/);
 w.document.querySelector('[data-mode=incoming]').click();assert.match(w.document.querySelector('.purchase-remaining').textContent,/남음 7/);assert.match(w.document.querySelector('[data-cs-state=neutral]').textContent,/입고 대기/);assert.equal(writes,0);view.dispose();d.window.close();
});

test('moving a calculator output keeps one status and cleared errors do not linger',()=>{
 const d=dom('<form data-calc="test"><output class="pt-error">error</output></form>'),w=d.window,r=w.document.querySelector('main'),f=r.querySelector('form'),o=f.querySelector('output');w.ClinicWorkflowState.calculator(r,null);const box=w.document.createElement('section');box.className='pt-flow-result';f.append(box);box.append(o);o.textContent='';w.ClinicWorkflowState.calculator(r,null);assert.equal(f.querySelectorAll('[data-cs-calculation]').length,1);assert.equal(f.querySelector('[data-cs-calculation]').hidden,true);assert.equal(f.querySelector('[data-cs-calculation]').parentElement,box);d.window.close();
});
