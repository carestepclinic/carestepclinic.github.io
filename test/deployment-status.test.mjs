import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const helper=read('deployment-status.js'),index=read('index.html'),home=read('carestep-home.js');
const ctx=vm.createContext({window:{}});vm.runInContext(helper,ctx);const inspect=ctx.window.CarestepDeployment.inspect;
const data=()=>({worker:{version:'10.7-A.3'},database:{version:'10.4-G',aligned:false,schema:{status:'compatible',compatible:true,missingCount:0,tablesExpected:37,tablesChecked:37,columnsChecked:420,missing:[]}},expectedPatches:{clinic:'10.7-A',home:'10.1-J'},summary:{automationAlerts:0}});
test('Clinic and Home use their own expected versions, independent of Worker and DB labels',()=>{
 for(const [client,version] of [['clinic','10.7-A'],['home','10.1-J']]){const r=inspect(data(),{client,version});assert.equal(r.ready,true);assert.match(r.detail,/10.4-G/);assert.doesNotMatch(r.title,/불일치|확인 필요/);}
});
test('a genuinely stale client requires refresh even with compatible DB',()=>{const r=inspect(data(),{client:'clinic',version:'10.6-A'});assert.equal(r.state,'client_mismatch');assert.match(r.notice,/새로고침/);});
test('missing DB columns remain warnings even if all version labels are identical',()=>{const d=data();d.worker.version='10.7-A';d.database.version='10.7-A';d.database.schema={status:'missing',compatible:false,missingCount:2};const r=inspect(d,{client:'clinic',version:'10.7-A'});assert.equal(r.state,'schema_missing');assert.match(r.detail,/2개 누락/);});
test('legacy responses and incomplete or failed probes never imply DB is healthy',()=>{
 for(const schema of [undefined,{status:'compatible',compatible:true},{status:'unavailable',compatible:null},{status:'compatible',compatible:true,missingCount:0,tablesExpected:37,tablesChecked:12}]){const d=data();d.database.schema=schema;d.database.aligned=true;assert.equal(inspect(d,{client:'clinic',version:'10.7-A'}).ready,false);}
});
test('automation failure and unavailable status cannot become zero warnings',()=>{
 for(const alerts of [2,null,undefined,-1]){const d=data();d.summary.automationAlerts=alerts;const r=inspect(d,{client:'clinic',version:'10.7-A'});assert.equal(r.ready,false);assert.equal(r.state,alerts===2?'automation_warning':'unavailable');}
});
class Element{constructor(){this.children=[];this.dataset={};}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;this.text='';}get firstElementChild(){return this.children[0];}set textContent(v){this.text=String(v);this.children=[];}get textContent(){return (this.text||'')+this.children.map(x=>x.textContent).join(' ');}}
function rendering(){const ids={};for(const id of ['careDeploymentStatus','careDeploymentTitle','careDeploymentDetail','careOpsDetails','homeBuildStatus'])ids[id]=new Element();ids.careDeploymentStatus.append(new Element());const find=(n,id)=>n.id===id?n:n.children.map(c=>find(c,id)).find(Boolean);const c=vm.createContext({window:{CarestepDeployment:{inspect}},document:{createElement:()=>new Element()},$:id=>ids[id]||find(ids.careDeploymentStatus,id),CARESTEP_CLIENT_VERSION:'10.7-A',careDeploymentState:data(),state:{token:'fixture'},CLIENT_VERSION:'10.1-J',api:async()=>data()});vm.runInContext(index.slice(index.indexOf('function renderCareDeploymentStatus(){'),index.indexOf('async function loadCareDeploymentStatus(')),c);const start=home.indexOf('  async function loadDeploymentStatus()');vm.runInContext(home.slice(start,home.indexOf('\n',start)),c);return {c,ids};}
test('Clinic detailed diagnostics present the scope and missing column, and clear stale errors',()=>{
 const {c,ids}=rendering();c.renderCareDeploymentStatus();assert.equal(ids.careDeploymentStatus.className,'care-deployment-status ok');assert.equal(ids.careOpsDetails.open,false);c.careDeploymentState.database.schema={status:'missing',missingCount:1,tablesExpected:37,tablesChecked:37,columnsChecked:420,missing:[{table:'care_patients',column:'active'}]};c.renderCareDeploymentStatus();assert.equal(ids.careOpsDetails.open,true);assert.match(ids.careDeploymentStatus.textContent,/데이터 무결성 검사는 포함하지 않습니다/);assert.match(ids.careDeploymentStatus.textContent,/care_patients · active 열 누락/);c.careDeploymentState=data();c.renderCareDeploymentStatus();assert.doesNotMatch(ids.careDeploymentStatus.textContent,/active 열 누락/);
});
test('Home status uses the shared assessment and errors clear prior successful status',async()=>{
 const {c,ids}=rendering();await c.loadDeploymentStatus();assert.equal(ids.homeBuildStatus.dataset.state,'ok');c.api=async()=>{throw Error('offline');};await c.loadDeploymentStatus();assert.equal(ids.homeBuildStatus.dataset.state,'warning');assert.match(ids.homeBuildStatus.textContent,/확인 불가/);
});
test('incomplete schema counts show an explanation and a failed reload clears old detail',()=>{
 const {c,ids}=rendering();c.careDeploymentState.database.schema={status:'unavailable'};c.renderCareDeploymentStatus();assert.doesNotMatch(ids.careDeploymentStatus.textContent,/undefined|NaN/);assert.match(ids.careDeploymentStatus.textContent,/수치를 확인하지 못했습니다/);c.careDeploymentState=null;c.renderCareDeploymentStatus();assert.doesNotMatch(ids.careDeploymentStatus.textContent,/검사 대상|데이터 무결성/);
});
test('both entry points load the helper and Home cache includes the same versioned asset',()=>{
 for(const entry of [index,read('home.html')])assert.match(entry,/<script src="deployment-status.js\?v=deployment-check-20261019a"><\/script>/);const sw=read('sw.js');const c=vm.createContext({self:{addEventListener(){}},Set,URL});vm.runInContext(sw.slice(0,sw.indexOf("self.addEventListener('install'"))+';this.assets=ASSETS;',c);assert.ok(c.assets.includes('./deployment-status.js?v=deployment-check-20261019a'));for(const name of c.assets)assert.ok(existsSync(new URL('../'+name.split('?')[0],import.meta.url)));
});
