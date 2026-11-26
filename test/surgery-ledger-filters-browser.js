/* Offline synthetic adapter: never calls the Clinic API or stores patient data. */
function fixture(){
 const base='/practice/support/ledger',row=(n,surgeon,diagnosis,procedure)=>({id:String(n),status:'active',revision:1,body:{record:{date:'2026-11-20',patientName:'가상환자'+n,chartNumber:'DEMO-'+n,surgeon,diagnosis,procedure}}});
 const records=[row(1,'이 원장','종괴','절제술'),row(2,'박 원장','치주염','발치'),row(3,'김 원장','MPL Grade 3','Trochlear recession'),row(4,'김 원장','CCLR','TPLO'),row(5,'김 원장','MPL Grade 2','TROCHLEAR RECESSION'),row(6,'이 원장','MPL','Trochlear recession')];
 window.calls=[];window.fail=false;window.exported=null;window.printed='';window.reader=false;window.confirm=()=>true;
 const append=document.body.append.bind(document.body);document.body.append=(...nodes)=>{append(...nodes);for(const n of nodes)if(n.matches?.('.sl-print-frame'))n.contentWindow.print=()=>{window.printed=n.contentDocument.body.innerText;};};
 URL.createObjectURL=blob=>{window.exported=blob;return 'blob:synthetic';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=()=>{};
 const request=async url=>{
  calls.push(url);const u=new URL(url,'https://synthetic.invalid');
  if(u.pathname===base){if(fail&&u.searchParams.get('before')==='2')throw Error('합성 조회 실패');
   const q=u.searchParams.get('q'),from=u.searchParams.get('from'),to=u.searchParams.get('to'),status=u.searchParams.get('status');
   const found=records.filter(r=>r.status===status&&(!q||JSON.stringify(r.body.record).includes(q))&&(!from||r.body.record.date>=from)&&(!to||r.body.record.date<=to));
   const offset=Number(u.searchParams.get('before')||0);return {items:structuredClone(found.slice(offset,offset+2)),next:offset+2<found.length?String(offset+2):'',counts:{active:6}};
  }
  if(url===base+'/preferences')return {revision:1};if(url==='/members')return {members:[]};
  const record=records.find(r=>url===base+'/'+r.id);if(record)return {document:structuredClone(record)};
  throw Error('Unexpected synthetic request '+url);
 };
 window.reset=async()=>{window.view?.dispose();calls=[];fail=false;reader=false;document.querySelector('#root').replaceChildren();window.view=SurgeryLedger.mount(document.querySelector('#root'),{identity:()=> 'synthetic',ready:()=>true,can:()=>!reader,request});await view.open();};void reset();
}
const frame=document.querySelector('#frame');frame.style.width='1200px';frame.srcdoc='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../surgery-ledger.css"><style>body{font:14px system-ui;margin:12px;background:#f6f5f1}</style></head><body><div id="root"></div><script src="../surgery-ledger.js"><\/script><script>('+fixture.toString()+')();<\/script></body></html>';
const w=()=>frame.contentWindow,d=()=>frame.contentDocument,$=q=>d().querySelector(q),check=(x,m)=>{if(!x)throw Error(m);};
const ready=async()=>{for(let i=0;i<200;i++){if($('[data-filter]')&&!$('#root').hasAttribute('aria-busy'))return;await new Promise(r=>setTimeout(r,10));}throw Error('대기 시간 초과');};
const settle=async()=>{for(let i=0;i<200;i++){if(!$('#root').hasAttribute('aria-busy'))return;await new Promise(r=>setTimeout(r,10));}throw Error('대기 시간 초과');};
const click=async q=>{$(q).click();await settle();};
const fill=(name,value)=>{const n=$('[name="'+name+'"]');n.value=value;n.dispatchEvent(new (w().Event)('input',{bubbles:true}));};
const search=async()=>{$('[data-filter]').requestSubmit();await ready();};
const patients=()=>[...d().querySelectorAll('.sl-list tbody tr td:nth-child(2)>b')].map(n=>n.textContent).join(',');
document.querySelector('#width').onchange=e=>frame.style.width=e.target.value+'px';
document.querySelector('#run').onclick=async()=>{
 const results=document.querySelector('#results');results.replaceChildren();let passed=0,failed=0;
 const run=async(name,fn)=>{try{await fn();passed++;results.insertAdjacentHTML('beforeend','<p class="pass">PASS '+name+'</p>');}catch(e){failed++;results.insertAdjacentHTML('beforeend','<p class="fail">FAIL '+name+': '+e.message+'</p>');}};
 for(const width of [1200,390]){frame.style.width=width+'px';await w().reset();await ready();
  await run('복합 필터·다음 페이지 '+width,async()=>{fill('surgeon','김');fill('diagnosis','mpl');fill('procedure','recession');await search();check(patients()==='가상환자3','첫 페이지 밖 일치');await click('[data-ledger=more]');check(patients()==='가상환자3,가상환자5','추가 일치');check(!w().calls.some(url=>/surgeon=|diagnosis=|procedure=/.test(url)),'지원되지 않는 서버 필터 전송 금지');check(d().documentElement.scrollWidth<=width+1,'가로 넘침');});
  await run('열기·복귀 조건 유지 '+width,async()=>{await click('[data-ledger=open]');await click('[data-ledger=back]');check($('[name=surgeon]').value==='김','집도의 유지');check(patients()==='가상환자3,가상환자5','목록 유지');});
  await run('엑셀은 모든 일치 기록 '+width,async()=>{await click('[data-ledger=export]');const text=await w().exported.text();check(text.includes('가상환자3')&&text.includes('가상환자5')&&!text.includes('가상환자6')&&!text.includes('가상환자1'),'필터와 엑셀 일치');});
  await run('인쇄도 같은 필터 적용 '+width,async()=>{await click('[data-ledger=print]');check(w().printed.includes('가상환자3')&&w().printed.includes('가상환자5')&&!w().printed.includes('가상환자6')&&!w().printed.includes('가상환자1'),'인쇄 필터 일치');});
  await run('실패 시 기존 조건 표시·재시도 '+width,async()=>{w().fail=true;fill('surgeon','없는 이름');await search();check(patients()==='가상환자3,가상환자5','부분 결과 교체 금지');check($('.sl-applied-filters').textContent.includes('김'),'기존 적용 조건 유지');check($('.sl-error').textContent.includes('다시 검색'),'재시도 안내');w().fail=false;await search();check(patients()===''&&$('.sl-empty').textContent.includes('조건에 맞는'),'결과 없음');});
  await run('초기화·날짜·출력 전 미적용 조건 '+width,async()=>{await click('[data-ledger=reset]');check(!$('[name=surgeon]').value&&!$('[name=diagnosis]').value&&!$('[name=procedure]').value,'필터 초기화');fill('surgeon','김');fill('procedure','TPLO');await click('[data-ledger=export]');const text=await w().exported.text();check(text.includes('가상환자4')&&!text.includes('가상환자3'),'출력 전 조건 반영');fill('from','2026-11-21');await search();check(patients()==='','날짜 동시 적용');await click('[data-ledger=period][data-value=all]');check(patients()==='가상환자4'&&$('[name=surgeon]').value==='김','기간 변경 필터 유지');});
 }
 results.insertAdjacentHTML('afterbegin','<h2>'+passed+' 통과 / '+failed+' 실패</h2>');await w().reset();await ready();frame.style.width=document.querySelector('#width').value+'px';
};
