const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../hq.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const bootstrap=scripts.find(x=>x.includes('HqClinicalStorage.mount'));
const main=scripts.find(x=>x.includes('async function req(path,opt={})'));
const requestSource=main.slice(main.indexOf('async function req(path,opt={})'),main.indexOf('return d}',main.indexOf('async function req(path,opt={})'))+'return d}'.length);

// Exercise the production HQ mount adapter and shared HTTP request function.
// Module-only mocks miss a second JSON encoding at this integration boundary.
function wire({status=200,response={ok:true},session='synthetic-session'}={}){
 const calls=[];let storageRequest,loadCount=0,clearCount=0;
 const elements={hqClinicalStorage:{},production:{classList:{contains:()=>false}},loginOverlay:{classList:{contains:()=>true}}};
 const observers=[];
 const context=vm.createContext({
  document:{getElementById:id=>elements[id]},
  MutationObserver:class{constructor(callback){observers.push(callback)}observe(){}},
  HqClinicalStorage:{mount(root,request){assert.equal(root,elements.hqClinicalStorage);storageRequest=request;return {load(){loadCount++},clear(){clearCount++}};}},
  endpoint:()=> 'https://synthetic.invalid',localStorage:{getItem:()=>''},ENDPOINT_KEY:'synthetic-endpoint',
  key:()=>'',hqSessionToken:()=>session,
  fetch:async(url,options)=>{calls.push({url,options});return {ok:status<400,status,json:async()=>response};}
 });
 vm.runInContext(requestSource,context);vm.runInContext(bootstrap,context);
 return {request:(...args)=>storageRequest(...args),calls,elements,observers,counts:()=>({loadCount,clearCount})};
}

for(const action of ['step','start-backup','start-external','start-restore','start-database','verify-external','verify-database','start-inventory','start-migration']){
 test('HQ sends one JSON object for storage action '+action,async()=>{
  const w=wire();await w.request('/hq/clinical-storage/maintenance',{method:'POST',body:JSON.stringify({action})});
  assert.equal(w.calls.length,1);const {url,options}=w.calls[0];
  assert.equal(url,'https://synthetic.invalid/hq/clinical-storage/maintenance');
  assert.deepEqual(JSON.parse(options.body),{action});
  assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'application/json');
  assert.equal(options.headers['X-CARESTEP-HQ-SESSION'],'synthetic-session');assert.equal(options.cache,'no-store');
 });
}
test('usage measurement keeps its empty object body',async()=>{
 const w=wire();await w.request('/hq/clinical-storage/refresh',{method:'POST',body:'{}'});
 assert.deepEqual(JSON.parse(w.calls[0].options.body),{});
});
test('recovery package preserves the public-key object without an extra string layer',async()=>{
 const w=wire();const body={publicKey:{kty:'RSA',n:'synthetic-public-modulus',e:'AQAB'}};
 await w.request('/hq/clinical-storage/recovery-package',{method:'POST',body:JSON.stringify(body)});
 assert.deepEqual(JSON.parse(w.calls[0].options.body),body);
});
test('status stays read-only without a request body',async()=>{
 const w=wire();await w.request('/hq/clinical-storage/maintenance');
 const o=w.calls[0].options;assert.equal(o.body,undefined);assert.equal(o.method,undefined);assert.equal(o.headers['Content-Type'],undefined);
});
test('server rejection is surfaced once without retrying a storage write',async()=>{
 const w=wire({status:409,response:{ok:false,error:'synthetic-busy'}});
 await assert.rejects(w.request('/hq/clinical-storage/maintenance',{method:'POST',body:'{"action":"step"}'}),e=>e.status===409&&e.message==='synthetic-busy');
 assert.equal(w.calls.length,1);
});
test('the mount still loads on activation and clears when authentication locks',()=>{
 const w=wire();assert.deepEqual(w.counts(),{loadCount:0,clearCount:0});
 w.elements.production.classList.contains=()=>true;w.observers[0]();w.observers[0]();assert.equal(w.counts().loadCount,1);
 w.elements.loginOverlay.classList.contains=()=>false;w.observers[1]();assert.equal(w.counts().clearCount,1);
 assert.equal(w.calls.length,0);
});
