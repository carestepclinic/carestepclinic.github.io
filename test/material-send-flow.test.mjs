import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../r61-clinic.js',import.meta.url),'utf8');
const begin=source.indexOf('    function materialDeliveryFlow('),end=source.indexOf('    let materialComposerOpen',begin);
const base={clinicId:'clinic-a',userId:'user-a',sessionId:'session-a',patientId:'patient-a',guardianId:'guardian-a',materialId:'scope-check',materialRevision:1,channel:'home'};
const draft={kind:'advanced',title:'Synthetic title',text:'Synthetic public content'};
const approved={...draft,id:'material-a',revision:1};
const blob=new Blob(['%PDF-synthetic'],{type:'application/pdf'});
function fixture(opts={}){
 let scope={...base},admin=true,rows=[],state={pending:false,sent:false,status:null,assetId:null,hasRecovery:false},calls=[],events=[],bound,postHook=opts.postHook;
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const sha=async s=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
 const request=async(path,o)=>{
  calls.push({path,...o});if(opts.onRequest)await opts.onRequest(path,o);
  if(path.startsWith('/saas/guardians/'))return {ok:true,guardian:{id:base.guardianId,homeStatus:opts.unlinked?'not_linked':'linked'},patients:[{id:base.patientId,guardianId:base.guardianId,active:true}]};
  if(o.method==='GET')return {ok:true,materials:rows};
  if(o.method==='POST'){rows.push({...approved});if(postHook)await postHook();return {ok:true,id:approved.id};}
  throw Error('unexpected');
 };
 const ctx={Blob,TextDecoder,Error,JSON,Number,Array,Map,materialId:x=>typeof x==='string'&&!!x,materialKinds:[['advanced','Advanced']],materialHash:sha,materialCanon:x=>JSON.stringify(Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]]))),materialSame:(a,b)=>{if(Object.keys(base).some(k=>a[k]!==b[k]))throw Error('MATERIAL_SCOPE_CHANGED');}};
 vm.createContext(ctx);vm.runInContext(source.slice(begin,end),ctx);
 const factory=({scope:q,...rest})=>({state:()=>state,invalidate:()=>{state={pending:false,sent:false,status:null,assetId:null};},recover:async()=>{events.push('recover');rest.selectMaterial(approved);state={...state,pending:false,assetId:'asset-a',status:'READY_UNSENT'};},prepare:async(make)=>{events.push('prepare');assert.equal(q().materialId,approved.id);if(opts.posted){state={...state,sent:true,deliveryId:'delivery-existing'};return null;}await make();},upload:async()=>{events.push('upload');if(opts.uploadLoss){state.pending=true;throw Error('PDF_RESPONSE_UNCONFIRMED');}state={...state,assetId:'asset-a',status:'READY_UNSENT',hasRecovery:true};},attach:async()=>{events.push('attach');if(opts.attachFailure){opts.attachFailure=false;throw Error('PDF_NOT_READY');}state={...state,sent:true,status:'SENT',deliveryId:'delivery-a'};}});
 const flow=ctx.materialDeliveryFlow({scope:()=>scope,request,storage,canApprove:()=>admin,controllerFactory:factory,onMaterial:m=>bound=m});
 return {flow,calls,events,data,rows,setRows:v=>rows=v,setScope:v=>scope=v,setAdmin:v=>admin=v,bound:()=>bound,send:extra=>flow.send({draft,blob,confirmed:true,...extra})};
}
test('one send registers, rereads, uploads and attaches in order',async()=>{const f=fixture();await f.send();assert.deepEqual(f.events,['prepare','upload','attach']);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.flow.state().sent,true);assert.ok(f.calls.every(c=>c.redirect==='error'));assert.equal(f.data.size,0);});
test('existing approved material skips registration',async()=>{const f=fixture();f.setRows([approved]);await f.send({existing:approved});assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(f.flow.state().sent,true);});
test('already sent receipt skips upload and attach',async()=>{const f=fixture({posted:true});f.setRows([approved]);await f.send({existing:approved});assert.deepEqual(f.events,['prepare']);await f.send({existing:approved});assert.deepEqual(f.events,['prepare']);});
test('concurrent send is ignored while first is active',async()=>{let release;const f=fixture({postHook:()=>new Promise(r=>release=r)});const first=f.send();while(!release)await new Promise(r=>setImmediate(r));await f.send();release();await first;assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.events.filter(x=>x==='attach').length,1);});
test('Home unlinked causes zero mutations',async()=>{const f=fixture({unlinked:true});await assert.rejects(f.send(),/HOME_GUARDIAN_NOT_LINKED/);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(f.events.length,0);});
test('staff cannot approve new material but can send approved material',async()=>{const f=fixture();f.setAdmin(false);await assert.rejects(f.send(),/MATERIAL_ADMIN_REQUIRED/);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);f.setRows([approved]);await f.send({existing:approved});assert.equal(f.flow.state().sent,true);});
test('missing confirmation prevents all requests',async()=>{const f=fixture();await assert.rejects(f.send({confirmed:false}));assert.equal(f.calls.length,0);});
test('invalid PDF prevents registration',async()=>{const f=fixture();await assert.rejects(f.send({blob:new Blob(['text'],{type:'application/pdf'})}));assert.equal(f.calls.length,0);});
test('patient or session switch blocks the next operation',async()=>{for(const key of ['patientId','sessionId']){let f;f=fixture({onRequest:()=>{f.setScope({...base,[key]:'changed'});}});await assert.rejects(f.send(),/MATERIAL_SCOPE_CHANGED/);assert.equal(f.calls.length,1);}});
test('registration response loss locks retries and recovers by GET only',async()=>{const f=fixture({postHook:()=>{throw Error('lost');}});await assert.rejects(f.send());assert.equal(f.flow.state().registrationPending,true);await assert.rejects(f.send(),/MATERIAL_ATTEMPT_LOCKED/);const n=f.calls.length;await f.flow.recover();assert.ok(f.calls.slice(n).every(c=>c.method==='GET'));assert.equal(f.flow.state().registrationPending,false);await f.send();assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.flow.state().sent,true);});
test('ambiguous or absent registration recovery keeps lock',async()=>{for(const rows of [[],[approved,{...approved,id:'material-b'}]]){const f=fixture({postHook:()=>{throw Error('lost');}});await assert.rejects(f.send());f.setRows(rows);await assert.rejects(f.flow.recover(),/MATERIAL_REGISTRATION_UNCONFIRMED/);assert.equal(f.flow.state().registrationPending,true);}});
test('creation journal stores fingerprints, not patient text',async()=>{const f=fixture({postHook:()=>{throw Error('lost');}});await assert.rejects(f.send());const raw=[...f.data.values()].join();assert.ok(!raw.includes(draft.text)&&!raw.includes(draft.title)&&!raw.includes(base.patientId));});
test('stale approved revision blocks before any write',async()=>{const f=fixture();f.setRows([{...approved,revision:2}]);await assert.rejects(f.send({existing:approved}),/MATERIAL_REVISION_CHANGED/);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);});
test('upload response loss does not attach or upload again',async()=>{const f=fixture({uploadLoss:true});await assert.rejects(f.send());await assert.rejects(f.send(),/MATERIAL_ATTEMPT_LOCKED/);assert.deepEqual(f.events,['prepare','upload']);});
test('known attach failure resumes existing asset without registration or upload',async()=>{const f=fixture({attachFailure:true});await assert.rejects(f.send());await f.send({blob:null});assert.deepEqual(f.events,['prepare','upload','attach','attach']);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);});
test('draft changes after registration cannot send a mismatched PDF',async()=>{const f=fixture({attachFailure:true});await assert.rejects(f.send());await assert.rejects(f.send({draft:{...draft,text:'changed'}}),/MATERIAL_SCOPE_CHANGED/);assert.equal(f.events.filter(x=>x==='attach').length,1);});

// Isolated DOM + real PDF controller: no browser session or production transport.
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.parent=null;this.style={};this.dataset={};this.listeners={};this._text='';this._value=undefined;this.disabled=false;this.hidden=false;this.isConnected=true;this.classList={contains:k=>(this.className||'').split(' ').includes(k),add:k=>{this.className=(this.className||'')+' '+k;},remove:k=>{this.className=(this.className||'').split(' ').filter(x=>x!==k).join(' ');}};}
 append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 prepend(...items){this.children.unshift(...items);for(const x of items)x.parent=this;}
 replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 get innerText(){return this.textContent;}
 set value(v){this._value=String(v);}
 get value(){return this._value??(this.tagName==='select'?this.children[0]?.value||'':'');}
 get childNodes(){return this.children;}
 get lastElementChild(){return this.children.at(-1);}
 get options(){return this.children;}
 setAttribute(k,v){this[k]=v;}
 removeAttribute(k){delete this[k];}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 showModal(){}
 close(){for(const f of this.listeners.close||[])f();}
 remove(){this.isConnected=false;}
 querySelector(sel){return this.all().find(n=>sel==='.pdf-page'&&n.className==='pdf-page')||null;}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
 cloneNode(deep){const n=new Element(this.tagName);n._text=this._text;n.className=this.className;n.dataset={...this.dataset};if(deep)n.append(...this.children.map(c=>c.cloneNode(true)));return n;}
}
function domFixture({existing=false,loseUpload=false}={}){
 const body=new Element('body'),pdf=new Element('div');body.append(pdf);
 const storageData=new Map(),requests=[],exported=[];let rows=existing?[approved]:[],asset=null,delivery=null;
 const current={patientId:'patient-a',guardianId:'guardian-a'};
 const doc={body,readyState:'loading',createElement:t=>new Element(t),createTextNode:t=>{const n=new Element('text');n.textContent=t;return n;},getElementById:id=>id==='pdfDocument'?pdf:null,addEventListener:()=>{}};
 const hash=s=>webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(x=>Buffer.from(x).toString('hex'));
 const canonical=v=>JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])));
 const assetResult=()=>({...asset,delivery:delivery?{status:'attached',delivery_id:delivery.deliveryId}:null,deliveryReceipt:delivery});
 const ctx={document:doc,crypto:webcrypto,Blob,FormData,URL,URLSearchParams,TextEncoder,TextDecoder,console,MutationObserver:class{},saasMode:'auth',saasToken:'synthetic-token',saasMe:{clinic:{id:'clinic-a'},user:{id:'user-a'},role:'owner'},saasSessionMeta:{id:'session-a'},saasEndpoint:()=> 'https://synthetic.invalid',sessionStorage:{getItem:k=>storageData.get(k)??null,setItem:(k,v)=>storageData.set(k,v),removeItem:k=>storageData.delete(k)},confirm:()=>true,alert:()=>{},
 exportPdfElement:async(name,opt)=>{assert.equal(opt.save,false);exported.push(pdf.innerText);return new Blob(['%PDF-'+pdf.innerText],{type:'application/pdf'});},
 fetch:async(url,o)=>{
  requests.push({url,...o});const p=new URL(url);let d;
  if(p.pathname.endsWith('/pdf-config'))d={ok:true,pdfEnabled:true,guardianMaterialEnabled:true};
  else if(p.pathname.startsWith('/saas/guardians/'))d={ok:true,guardian:{id:current.guardianId,name:'Synthetic guardian',homeStatus:'linked'},patients:[{id:current.patientId,guardianId:current.guardianId,name:'Synthetic patient',active:true}]};
  else if(p.pathname==='/saas/r61/materials'){
   if(o.method==='POST'){const b=JSON.parse(o.body);rows.push({...b,id:'material-a',revision:1});d={ok:true,id:'material-a'};}else d={ok:true,materials:rows};
  }else if(p.pathname.endsWith('/pdf-preflight'))d={ok:true,homeLinked:true,alreadySent:false,scope:{...base,materialId:p.searchParams.get('materialId'),materialRevision:Number(p.searchParams.get('materialRevision'))}};
  else if(p.pathname==='/saas/r113/pdf-assets'&&o.method==='POST'){
   const b=JSON.parse(o.body.get('metadata')),file=o.body.get('file')||o.body.get('pdf');assert.ok(file,'PDF field exists');
   const r={assetId:'asset-a',clinicId:b.scope.clinicId,patientId:b.scope.patientId,guardianId:b.scope.guardianId,materialId:b.scope.materialId,materialRevision:b.scope.materialRevision,channel:'home',mimeType:'application/pdf',byteSize:file.size,sha256:Buffer.from(await webcrypto.subtle.digest('SHA-256',await file.arrayBuffer())).toString('hex'),status:'ready',filename:'carestep-material.pdf'};
   asset={ok:true,assetId:r.assetId,receipt:r,receiptSHA256:await hash(canonical(r))};d=assetResult();if(loseUpload)throw Error('synthetic response loss');
  }else if(p.pathname.endsWith('/attach')){
   const r={...asset.receipt,status:'sent',deliveryId:'delivery-a',createdAt:'2026-01-01T00:00:00.000Z'};delete r.filename;delete r.mimeType;
   delivery={ok:true,deliveryId:r.deliveryId,receipt:r,receiptSHA256:await hash(canonical(r))};d=delivery;
  }else if(p.pathname.includes('/pdf-assets'))d=assetResult();else throw Error('unexpected route '+p.pathname);
  return {ok:true,status:o.method==='POST'?201:200,redirected:false,url,json:async()=>d};
 }};
 ctx.window={crmWorkspaceSelection:()=>current,crmCurrentPatient:()=>current,html2pdf:()=>{}};
 vm.createContext(ctx);vm.runInContext(source.replace('    window.r113PDFController = pdfController;','    window.r113PDFController = pdfController; window.testComposer = sendMaterial;'),ctx);
 const find=(tag,text)=>body.all().find(x=>x.tagName===tag&&(!text||x.textContent===text));
 const click=async text=>{const b=find('button',text);assert.ok(b,text);assert.equal(b.disabled,false,text+' enabled');await b.onclick();};
 const fill=async()=>{const inputs=body.all().filter(n=>n.tagName==='input');inputs[0].value='Reviewed title';find('textarea').value='Reviewed public body';inputs[0].oninput();await click('PDF 미리보기');};
 return {ctx,body,pdf,find,click,fill,requests,exported,current,storageData,open:()=>ctx.window.testComposer()};
}
test('DOM: new draft preview is local, one final click uses real upload/attach receipts',async()=>{
 const f=domFixture();await f.open();await f.fill();assert.ok(f.requests.every(r=>r.method==='GET'));assert.equal(f.find('button','보호자에게 보내기').disabled,true);
 const check=f.body.all().find(n=>n.type==='checkbox');check.checked=true;check.onchange();await f.click('보호자에게 보내기');
 assert.deepEqual(f.requests.filter(r=>r.method==='POST').map(r=>new URL(r.url).pathname),['/saas/r61/materials','/saas/r113/pdf-assets','/saas/r113/pdf-assets/asset-a/attach']);
 assert.ok(f.body.textContent.includes('전송 완료 · CARESTEP Home · Delivery ID: delivery-a'));assert.equal(f.find('button','전송 완료').disabled,true);assert.ok(f.exported[0].includes('Reviewed public body'));assert.ok(f.requests.every(r=>r.redirect==='error'));
});
test('DOM: editing after preview invalidates checkbox and sending',async()=>{const f=domFixture();await f.open();await f.fill();const check=f.body.all().find(n=>n.type==='checkbox');check.checked=true;check.onchange();f.find('textarea').value='changed';f.find('textarea').oninput();assert.equal(check.checked,false);assert.equal(f.find('button','보호자에게 보내기').disabled,true);assert.ok(f.requests.every(r=>r.method==='GET'));});
test('DOM: upload response loss stops attach and enables result recovery',async()=>{const f=domFixture({loseUpload:true});await f.open();await f.fill();const check=f.body.all().find(n=>n.type==='checkbox');check.checked=true;check.onchange();await f.click('보호자에게 보내기');assert.equal(f.requests.filter(r=>r.url.endsWith('/attach')).length,0);assert.equal(f.find('button','보호자에게 보내기').disabled,true);assert.equal(f.find('button','중단된 저장·송부 결과 조회').disabled,false);assert.ok(f.body.textContent.includes('결과 확인이 필요'));});
test('DOM: patient change after preview stops all final requests',async()=>{const f=domFixture();await f.open();await f.fill();const check=f.body.all().find(n=>n.type==='checkbox');check.checked=true;check.onchange();f.current.patientId='other';const before=f.requests.length;await f.click('보호자에게 보내기');assert.equal(f.requests.length,before);assert.ok(f.body.textContent.includes('MATERIAL_SCOPE_CHANGED'));});
