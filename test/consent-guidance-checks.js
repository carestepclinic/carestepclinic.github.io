/* Uses consent-linear-fixture.js: in-memory synthetic documents only. */
consentFixture();
document.querySelector('#run').onclick=async()=>{
 const results=[],wait=()=>new Promise(r=>setTimeout(r,300)),assert=(v,m)=>{if(!v)throw Error(m)},$=s=>document.querySelector(s);
 document.querySelector('#result').textContent='검증 중';
 for(const kind of ['surgery','transfusion','admission','discharge','euthanasia','other']){
  try{
   await ConsentFixture.reset();const doc=ConsentFixture.docs.find(d=>d.id==='draft');doc.body.kind=kind;doc.body.guardianName='';
   $('[data-consent=draft]').click();await wait();
   assert($('.rf-guide'),'guide exists');assert($('[data-pending-input]'),'original pending rules');
   const writes=ConsentFixture.calls.filter(x=>x.method!=='GET').length;
   $('[data-flow-next]').click();await wait();assert(document.activeElement?.matches('input,select,textarea'),'next targets an input');assert(ConsentFixture.calls.filter(x=>x.method!=='GET').length===writes,'guide did not save');
   const field=$('[name=guardianName]');field.value='합성 보호자';field.dispatchEvent(new Event('input',{bubbles:true}));await wait();
   assert(!field.classList.contains('rf-review'),'filled review field clears');assert(!$('.rf-guide[data-flow-state=reviewed]'),'filled consent is not signed');
   $('[data-act=confirm-clinical-review]').click();await wait();assert(document.querySelectorAll('[data-sign]').length===2,'signature flow preserved');assert(!$('.su-document [data-flow-ui]'),'output remains clean');
   results.push({kind,ok:true});
  }catch(e){results.push({kind,ok:false,error:e.message});}
 }
 document.querySelector('#result').textContent=JSON.stringify(results,null,2);
};
