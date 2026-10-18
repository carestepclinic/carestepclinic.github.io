import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8'),nav=read('home-navigation.js'),home=read('carestep-home.js'),sw=read('sw.js');
function refreshFixture(route='hospital'){
 const calls=[],state={base:{token:'a',home:{user:{id:'u'}}},care:{patientId:'p'},allowed:true},status={dataset:{}},button={dataset:{}},waiting={};
 const job=name=>()=>{calls.push(name);return waiting[name]?.()??true;};
 const c=vm.createContext({route,routeRefreshFlight:null,snapshot:()=>state,$:id=>id==='homeCareRefresh'?button:status,routes:{home:'홈',schedule:'관리일정',hospital:'병원',settings:'설정'},window:{carestepHomeCare:{refresh:job('care')},carestepRefreshHomeReminders:job('reminders'),carestepRefreshHomeMaterials:job('materials'),carestepRefreshHomeFollowups:job('followups'),carestepRefreshHomePushStatus:job('push'),carestepRefreshHomeReminderDevice:job('device')}});
 vm.runInContext(nav.slice(nav.indexOf('  function refreshScope('),nav.indexOf('  function backFromSettings(')),c);
 return {c,calls,state,status,button,waiting};
}
test('toolbar refresh invokes only the read domains for its current menu',async()=>{
 for(const [route,expected] of [['hospital',['care','materials','followups']],['schedule',['care','reminders']],['home',['care','reminders','materials','followups']],['settings',['push','device']]]){
  const f=refreshFixture(route);await f.c.refreshCurrent();assert.deepEqual(f.calls,expected);assert.equal(f.button.disabled,false);
 }
});
test('repeat refresh clicks share a flight until every region has settled',async()=>{
 const f=refreshFixture();let release;f.waiting.materials=()=>new Promise(r=>release=r);
 const a=f.c.refreshCurrent(),b=f.c.refreshCurrent();await Promise.resolve();assert.equal(f.calls.filter(x=>x==='materials').length,1);assert.equal(f.button.disabled,true);
 release(true);await Promise.all([a,b]);assert.equal(f.button.disabled,false);
});
test('a failed region reports partial refresh and another menu or patient gets no late status',async()=>{
 const f=refreshFixture();f.waiting.materials=()=>false;await f.c.refreshCurrent();assert.match(f.status.textContent,/일부 항목/);
 let release;f.waiting.materials=()=>new Promise(r=>release=r);const pending=f.c.refreshCurrent();await Promise.resolve();f.state.care.patientId='other';f.status.textContent='다른 환자';release(true);await pending;assert.equal(f.status.textContent,'다른 환자');
 f.state.allowed=false;const count=f.calls.length;assert.equal(await f.c.refreshCurrent(),false);assert.equal(f.calls.length,count);
});
function materialFixture(){
 const selected={carestepHomeSelectedPatient:'p',scrollY:250,scrollTo:v=>{selected.scrollY=v.top;}},list={children:[]},returnSearch={hidden:true},search={value:'췌장염',focus(){}},kind={value:'disease'},order={value:'oldest'},card={dataset:{patientId:'p'},parentElement:list,hidden:true,scrollIntoView(){selected.scrollY=600;}};
 list.children=[card];const c=vm.createContext({window:selected,list,card,returnSearch,search,kind,order,quickFilter:'guidance',showPrevious:true,showAll:true,visibleLimit:26,options:{open:true},previous:{},quickButtons:[],previousSearch:null,current:()=>true,arrivals:{pending:()=>[]},addPending(){},readingAnchor:()=>null,restoreReading(){},filter(){},});
 vm.runInContext(home.slice(home.indexOf('    returnSearch.onclick='),home.indexOf('    await loadMaterialSources(')),c);return {c,selected,card,search,kind,order,returnSearch};
}
test('guide shortcut returns the original query, category, sorting, page limit and reading position',()=>{
 const f=materialFixture();assert.equal(f.c.window.carestepHomeMaterialReveal(f.card),true);assert.equal(f.search.value,'');assert.equal(f.returnSearch.hidden,false);
 f.returnSearch.onclick();assert.equal(f.search.value,'췌장염');assert.equal(f.kind.value,'disease');assert.equal(f.order.value,'oldest');assert.equal(f.c.quickFilter,'guidance');assert.equal(f.c.visibleLimit,26);assert.equal(f.c.showPrevious,true);assert.equal(f.selected.scrollY,250);assert.equal(f.returnSearch.hidden,true);
});
test('material return rejects another patient or invalidated login/list',()=>{
 for(const invalidate of [f=>f.selected.carestepHomeSelectedPatient='q',f=>f.c.current=()=>false]){
  const f=materialFixture();f.c.window.carestepHomeMaterialReveal(f.card);invalidate(f);f.returnSearch.onclick();assert.equal(f.search.value,'');assert.equal(f.returnSearch.hidden,true);
 }
});
function fontFixture(){
 const stores=new Map(),requests=[];const open=async key=>{if(!stores.has(key))stores.set(key,new Map());const map=stores.get(key);return {match:async key=>map.get(key),put:async(k,v)=>map.set(k,v)};};
 const c=vm.createContext({FONT_CACHE:'carestep-fonts-v1',FONT_PATH:'./pretendard-variable-1.3.9.woff2',caches:{open},fetch:async request=>{requests.push(request);return {ok:true,clone(){return this;}};}});
 vm.runInContext(sw.slice(sw.indexOf('async function retainFontCache('),sw.indexOf("self.addEventListener('activate'")),c);return {c,stores,requests,open};
}
test('screen updates reuse an existing font while leaving other cached data separate',async()=>{
 const f=fontFixture(),old=await f.open('carestep-home-old');await old.put('./pretendard-variable-1.3.9.woff2',{font:'old'});await old.put('/home/private',{private:true});
 await f.c.retainFontCache(['carestep-home-old']);assert.deepEqual(await f.c.cachedFont('font-request'),{font:'old'});assert.equal(f.requests.length,0);assert.equal(f.stores.get('carestep-fonts-v1').size,1);
});
test('an uncached font fetches once and is reused without blocking installation',async()=>{
 const f=fontFixture();await f.c.cachedFont('font-request');await f.c.cachedFont('font-request');assert.equal(f.requests.length,1);assert.doesNotMatch(sw.slice(sw.indexOf('const ASSETS='),sw.indexOf('const HOME_PATHS=')),/woff2/);
});
