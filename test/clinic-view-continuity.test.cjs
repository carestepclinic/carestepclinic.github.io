const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createLoader}=require('../clinic-today-documents.js');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
const extract=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
test('document background refresh is throttled, manual refresh remains immediate',async()=>{
 let reads=0;const loader=createLoader({identity:()=> 'a',ready:()=>true,allowed:k=>k==='consents',request:async()=>{reads++;return {items:[],next:''}}});
 await loader.refresh();await loader.refresh({ifStale:true});assert.equal(reads,1);await loader.refresh();assert.equal(reads,2);
});
test('failed document refresh retains records and throttles focus retries',async()=>{
 let fail=false,reads=0;const loader=createLoader({identity:()=> 'a',ready:()=>true,allowed:k=>k==='consents',request:async()=>{reads++;if(fail)throw Error('offline');return {items:[{id:'draft',status:'draft'}],next:''}}});
 await loader.refresh();fail=true;await loader.refresh();await loader.refresh({ifStale:true});assert.equal(reads,2);assert.equal(loader.snapshot().rows[0].id,'draft');assert.ok(loader.snapshot().sources.consents.error);
});
test('hospital change bypasses freshness and clears old document rows',async()=>{
 let identity='a',reads=0;const loader=createLoader({identity:()=>identity,ready:()=>true,allowed:k=>k==='consents',request:async()=>{reads++;return {items:[{id:identity,status:'draft'}],next:''}}});
 await loader.refresh();identity='b';await loader.refresh({ifStale:true});assert.equal(reads,2);assert.deepEqual(loader.snapshot().rows.map(r=>r.id),['b']);
});
test('visible dashboard gate skips background tabs, logged out and other menus',()=>{
 const calls=[],c=vm.createContext({document:{hidden:false,getElementById:()=>({classList:{contains:()=>c.visible}})},visible:true,saasMode:'auth',saasMe:{},window:{CarestepTodayDocuments:{refresh:o=>calls.push(o)},CarestepTodayWard:{refresh:o=>calls.push(o)}}});
 vm.runInContext(extract(read('practice-clinic.js'),'function carestepRefreshVisibleToday(){','window.addEventListener(\'focus\',carestepRefreshVisibleToday)'),c);
 c.carestepRefreshVisibleToday();assert.equal(calls.length,2);assert.ok(calls.every(o=>o.ifStale));c.visible=false;c.carestepRefreshVisibleToday();c.visible=true;c.document.hidden=true;c.carestepRefreshVisibleToday();c.document.hidden=false;c.saasMode='guest';c.carestepRefreshVisibleToday();assert.equal(calls.length,2);
});
test('booking visibility requires a connected visible schedule and valid identity',()=>{
 const c=vm.createContext({mode:'bookings',alive:()=>c.valid,valid:true,document:{hidden:false},root:{isConnected:true,getClientRects:()=>c.rects},rects:[{}]});vm.runInContext(extract(read('clinic-support.js'),'function bookingVisible(){',' async function refreshBoard()'),c);
 assert.equal(c.bookingVisible(),true);c.root.isConnected=false;assert.equal(c.bookingVisible(),false);c.root.isConnected=true;c.rects=[];assert.equal(c.bookingVisible(),false);c.rects=[{}];c.document.hidden=true;assert.equal(c.bookingVisible(),false);c.document.hidden=false;c.valid=false;assert.equal(c.bookingVisible(),false);
});
test('ward refresh coalesces, preserves manual retry and ignores freshness across identity',async()=>{
 let release,reads=0;const c=vm.createContext({allowed:()=>true,scope:()=>c.key,key:'a',pending:null,pendingScope:'',lastScope:'a',lastAttempt:0,Date,clear:()=>{},refreshNow:()=>{reads++;return new Promise(r=>release=r)}});
 vm.runInContext(extract(read('clinic-today-ward.js'),'function refresh(options={}){',' async function refreshNow()'),c);const a=c.refresh(),b=c.refresh();assert.equal(a,b);release();await a;await c.refresh({ifStale:true});assert.equal(reads,1);c.key='b';const other=c.refresh({ifStale:true});assert.equal(reads,2);release();await other;
});
test('ledger re-entry retains mounted list and restores position without a request',async()=>{
 let reads=0,restored=0;const c=vm.createContext({alive:()=>true,dirty:false,busy:false,page:'list',listLoaded:true,root:{childNodes:[{}],isConnected:true,getClientRects:()=>[{}]},g:{requestAnimationFrame:fn=>fn()},restoreListPosition:()=>restored++,run:async fn=>fn(),load:()=>reads++,shell:()=>{},btn:()=>''});
 const s=read('surgery-ledger.js'),part=extract(s,'  async open(){','  leave(){');vm.runInContext('const api={'+part+'};this.open=api.open;',c);await c.open();assert.equal(reads,0);assert.equal(restored,1);c.dirty=true;await c.open();assert.equal(restored,1);c.dirty=false;c.listLoaded=false;c.root.childNodes=[];await c.open();assert.equal(reads,1);
});
test('ledger leaving captures scroll only after blocking in-flight operations',()=>{
 let captures=0;const s=read('surgery-ledger.js'),c=vm.createContext({busy:true,captureList:()=>captures++});vm.runInContext('const api={'+extract(s,'  leave(){','  dispose(){')+'};this.leave=api.leave;',c);assert.equal(c.leave(),false);assert.equal(captures,0);c.busy=false;assert.equal(c.leave(),true);assert.equal(captures,1);
});
