import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const clinic=read('r61-clinic.js'),index=read('index.html'),display=read('home-display.js');
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.style={};this.value='';this.checked=false;this.disabled=false;this.isConnected=true;}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentElement=this;}
 prepend(...nodes){this.children.unshift(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this.text='';}
 set textContent(v){this.text=String(v);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join(' ');}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 emit(k,e={}){for(const fn of this.listeners[k]||[])fn(e);}
 querySelectorAll(s){return walk(this).slice(1).filter(n=>s==='[data-text-size]'?n.dataset.textSize:['BUTTON','INPUT','SELECT','TEXTAREA'].includes(n.tagName));}
 showModal(){this.open=true;}close(){this.open=false;this.emit('close');}remove(){this.isConnected=false;}focus(){}
}
const walk=n=>[n,...n.children.flatMap(walk)];
function tracker(){
 const d=new Element('dialog'),input=new Element('input'),check=new Element('input'),status=new Element('p'),save=new Element('button'),locked=new Element('button'),events={};check.type='checkbox';locked.disabled=true;d.append(input,check,status,save,locked);let allow=false,asked=0;
 const c=vm.createContext({window:{addEventListener:(k,v)=>events[k]=v,removeEventListener:k=>delete events[k]},confirm:()=>{asked++;return allow;}});
 vm.runInContext(clinic.slice(clinic.indexOf('    function trackSettingsEdits('),clinic.indexOf('    async function settings()')),c);
 return {d,input,check,status,save,locked,events,t:c.trackSettingsEdits(d,[input,check],status,save),allow:v=>allow=v,asked:()=>asked};
}
test('settings edits distinguish unchanged, dirty and reverted values and protect closing',()=>{
 const f=tracker();assert.equal(f.t.dirty(),false);assert.equal(f.d.careBeforeClose(),true);f.input.value='changed';f.input.emit('input');assert.equal(f.d.dataset.saveState,'dirty');assert.equal(f.d.careBeforeClose(),false);f.allow(true);assert.equal(f.d.careBeforeClose(),true);f.input.value='';f.input.emit('change');assert.equal(f.t.dirty(),false);assert.equal(f.d.dataset.saveState,'clean');assert.equal(f.asked(),2);
});
test('pending save prevents close and unload, restores prior disabled states, and success resets dirty',()=>{
 const f=tracker();f.check.checked=true;f.check.emit('change');f.t.begin();assert.equal(f.d.careBeforeClose(),false);assert.equal(f.t.busy(),true);assert.equal(f.input.disabled,true);let prevented=false;f.events.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);f.t.saved();f.t.end();assert.equal(f.t.dirty(),false);assert.equal(f.d.dataset.saveState,'saved');assert.equal(f.input.disabled,false);assert.equal(f.locked.disabled,true);assert.equal(f.save.textContent,'설정 저장');f.d.close();assert.equal(f.events.beforeunload,undefined);
});
test('failed save preserves unsaved values and never marks them saved',()=>{
 const f=tracker();f.input.value='keep me';f.t.begin();f.t.failed();f.t.end();assert.equal(f.input.value,'keep me');assert.equal(f.d.dataset.saveState,'error');assert.equal(f.t.dirty(),true);assert.equal(f.d.careBeforeClose(),false);
});
function settingsFixture(){
 const body=new Element('body'),calls=[];let resolve,reject;const pending=new Promise((r,j)=>{resolve=r;reject=j;});
 const win={addEventListener(){},removeEventListener(){},requestAnimationFrame(){},scrollTo(){}};
 const c=vm.createContext({document:{body,readyState:'loading',createElement:t=>new Element(t),createTextNode:text=>{const n=new Element('#text');n.textContent=text;return n;},addEventListener(){}},window:win,saasMode:'auth',saasMe:{clinic:{id:'c'},user:{id:'u'}},saasSessionMeta:{id:'s'},saasRequest:async(p,opt)=>{calls.push({p,opt});return pending;},confirm:()=>true,alert(){}});
 vm.runInContext(clinic.replace('    function mount() {','    window.testSettings=settings;\n    function mount() {'),c);
 const cfg={ok:true,flags:{preventive_auto_delivery:false,followup_auto_completion:false,guardian_material_delivery:true,efriends_home_visible_default:true},policy:{enabled:true,channels:['lms'],templateBindings:{}}};
 return {c,body,calls,resolve:()=>resolve(cfg),reject,open:()=>win.testSettings()};
}
test('settings opens with honest loading before the read resolves and groups controls without writes',async()=>{
 const f=settingsFixture(),p=f.open();assert.match(f.body.textContent,/불러오는 중/);f.resolve();await p;const groups=walk(f.body).filter(n=>n.className==='r61-settings-group');assert.equal(groups.length,4);assert.match(groups[0].textContent,/기록 공개.*신규 eFriends/);assert.match(groups[1].textContent,/자동 발송·업무 처리.*접종·사상충 자동 발송/);assert.match(groups[2].textContent,/보호자 동의/);assert.equal(groups[3].tagName,'DETAILS');assert.match(groups[3].textContent,/예방관리 알림톡 템플릿 ID/);assert.equal(f.calls.length,1);assert.equal(f.calls[0].opt.method,undefined);
});
test('a closed settings dialog or switched session cannot display a delayed response',async()=>{
 for(const mode of ['closed','session']){const f=settingsFixture(),p=f.open(),d=walk(f.body).find(n=>n.tagName==='DIALOG');if(mode==='closed')d.close();else f.c.saasMe={clinic:{id:'other'},user:{id:'other'}};f.resolve();await p;assert.equal(d.open,false);assert.ok(!walk(d).some(n=>n.className==='r61-settings-group'));}
});
test('failed settings read stays a retryable error and never shows empty default controls',async()=>{
 const f=settingsFixture(),p=f.open();f.reject(Error('network'));await p;assert.match(f.body.textContent,/불러오지 못했습니다.*다시 조회/);assert.ok(!walk(f.body).some(n=>n.tagName==='INPUT'));assert.equal(f.calls.length,1);
});
function fontFixture({value='default',fail=false}={}){
 const root=new Element('html'),host=new Element(),events={},writes=[];let saved=value;
 const c=vm.createContext({document:{documentElement:root,createElement:t=>new Element(t)},window:{addEventListener:(k,f)=>events[k]=f},localStorage:{getItem:()=>saved,setItem:(k,v)=>{if(fail)throw Error('blocked');saved=v;writes.push([k,v]);}},fetch(){throw Error('No server requests');}});vm.runInContext(display,c);c.window.CarestepHomeDisplay.mount(host);return {c,root,host,events,writes};
}
test('Home text size restores locally, updates pressed states and saves only a display preference',()=>{
 const f=fontFixture({value:'large'});assert.equal(f.root.dataset.homeTextSize,'large');const buttons=walk(f.host).filter(n=>n.tagName==='BUTTON');assert.equal(buttons[1].attributes['aria-pressed'],'true');buttons[0].onclick();assert.equal(f.root.dataset.homeTextSize,'default');assert.deepEqual(f.writes,[['carestep_home_text_size_v1','default']]);f.events.storage({key:'carestep_home_text_size_v1',newValue:'large'});assert.equal(f.root.dataset.homeTextSize,'large');const count=f.host.children.length;f.c.window.CarestepHomeDisplay.mount(f.host);assert.equal(f.host.children.length,count);
});
test('blocked storage still applies text size and explains persistence without false saved success',()=>{
 const f=fontFixture({value:'unexpected',fail:true});assert.equal(f.root.dataset.homeTextSize,'default');walk(f.host).find(n=>n.dataset.textSize==='large').onclick();assert.equal(f.root.dataset.homeTextSize,'large');assert.match(f.host.textContent,/기기 저장이 제한/);assert.doesNotMatch(f.host.textContent,/저장했습니다/);
});
test('Clinic header never flashes an old clinic or missing-profile claim while auth loads',()=>{
 const c=vm.createContext({});vm.runInContext(index.slice(index.indexOf('function clinicHeaderIdentity('),index.indexOf('function renderHospitalMeta(')),c);assert.equal(c.clinicHeaderIdentity('auth',null,{name:'old clinic'}).loading,true);assert.equal(c.clinicHeaderIdentity('auth',{clinic:{name:'current clinic'}},{name:'old clinic'}).name,'current clinic');assert.equal(c.clinicHeaderIdentity('demo',null,{}).name,'로컬 데모 병원');
});
test('Home cached shell includes the display preference script and all versioned assets exist',()=>{
 const sw=read('sw.js'),html=read('home.html'),version=sw.match(/const VERSION='([^']+)'/)[1],c=vm.createContext({self:{addEventListener(){}},URL,Set});vm.runInContext(sw.slice(0,sw.indexOf("self.addEventListener('install'"))+';this.assets=ASSETS;',c);assert.ok(c.assets.includes('./home-display.js?v='+version));assert.ok(html.includes('home-display.js?v='+version));for(const a of c.assets)assert.ok(existsSync(new URL('../'+a.split('?')[0],import.meta.url)),a);
});
