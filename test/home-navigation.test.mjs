import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../home-navigation.js',import.meta.url),'utf8');
function models(){const c=vm.createContext({});vm.runInContext(code.slice(code.indexOf('  function initialHomeRoute('),code.indexOf('  function snapshot(')),c);return c;}
test('notification entry chooses the correct destination, keeping ordinary visits on home',()=>{
  const c=models();for(const [search,expected]of [['','home'],['?customReminder=a&patient=p','schedule'],['?medication=p','schedule'],['?care=medications&patient=p','schedule'],['?care=materials&patient=p','hospital'],['?followup=x','hospital'],['?care=unknown','home']])assert.equal(c.initialHomeRoute(new URLSearchParams(search)),expected);
});
test('next action chooses the earliest verified schedule across hospital and guardian care',()=>{
  const c=models(),m={patientId:'p',state:'ready',count:1,next:{time:'20:00',label:'처방약'}},r={patientId:'p',state:'ready',count:1,next:{time:'18:00',title:'영양제'}};
  assert.match(c.nextHomeCare(m,r,'p').text,/18:00.*영양제/);assert.equal(c.nextHomeCare(m,r,'p').target,'homeCustomReminders');r.next.time='21:00';assert.equal(c.nextHomeCare(m,r,'p').target,'homeCarePatients');
});
test('failed and foreign patient reads never imply that all care is complete',()=>{
  const c=models(),ready={patientId:'p',state:'ready',count:0};assert.match(c.nextHomeCare(ready,{patientId:'other',state:'ready',count:0},'p').text,/확인이 필요한/);assert.match(c.nextHomeCare(ready,{patientId:'p',state:'failed',count:0},'p').text,/확인이 필요한/);assert.match(c.nextHomeCare(ready,ready,'p').text,/남은 관리가 없습니다/);assert.match(c.nextHomeCare({...ready,count:1},ready,'p').text,/지난 미완료/);
});
test('preventive overview keeps both types, earliest due date and unknown state',()=>{
  const c=models(),summary={patientId:'p',state:'ready',items:[{type:'vaccination',items:[{days:20,nextDueDate:'2026-11-06'},{days:3,nextDueDate:'2026-10-20'}]}]};const rows=c.preventiveHomeRows(summary,'p');assert.equal(rows.length,2);assert.equal(rows[0].item,undefined);assert.equal(rows[1].item.days,3);assert.equal(rows[1].count,2);assert.equal(c.preventiveHomeRows(summary,'other')[1].state,'loading');assert.equal(c.preventiveHomeRows({...summary,state:'failed'},'p')[1].state,'failed');
});
function router(){
  const frames=[],scrolls=[],health=[];const data={base:{token:'session',home:{user:{id:'owner'}}},care:{patientId:'p'},allowed:true};
  const c=vm.createContext({route:'home',view:'dashboardView',patientId:'p',account:'owner',auth:'session',healthReturn:'home',settingsReturn:'home',routing:false,positionRevision:0,positions:new Map(),routes:{home:1,health:1,schedule:1,hospital:1,settings:1},query:new URLSearchParams(),mounted:true,mount:()=>true,refresh(){},snapshot:()=>data,requestAnimationFrame:fn=>frames.push(fn),window:{scrollY:0,scrollTo:o=>scrolls.push(o.top)},$:()=>null});
  vm.runInContext(code.slice(code.indexOf('  function initialHomeRoute('),code.indexOf('  function nextHomeCare('))+code.slice(code.indexOf('  function key('),code.indexOf('  function mount('))+code.slice(code.indexOf('  function syncPatient('),code.indexOf('  window.carestepHomeNavigation=')),c);
  c.window.carestepShowHomeDashboard=()=>c.onView('dashboardView');c.window.carestepOpenHomeHealth=pid=>{health.push(pid);c.onView('patientView',pid);};c.window.carestepHomeCare={selectPatient:pid=>{if(data.care.patientId!==pid){data.care.patientId=pid;c.syncPatient();}}};
  return {c,data,scrolls,health,flush:()=>{while(frames.length)frames.shift()();}};
}
test('routes retain patient and per-menu reading position',()=>{const f=router();f.c.window.scrollY=180;f.c.go('schedule');f.flush();assert.equal(f.c.patientId,'p');assert.equal(f.c.route,'schedule');f.c.window.scrollY=620;f.c.go('home');f.flush();assert.equal(f.scrolls.at(-1),180);f.c.go('schedule');f.flush();assert.equal(f.scrolls.at(-1),620);});
test('quick navigation cancels stale scheduled scroll restoration',()=>{const f=router();f.c.go('schedule');f.c.go('hospital');f.flush();assert.equal(f.scrolls.length,1);assert.equal(f.c.route,'hospital');});
test('health changes selected patient once and returns through the previous menu',()=>{const f=router();f.c.go('schedule');f.c.go('health');assert.equal(f.c.route,'health');assert.equal(f.health.length,1);f.data.care.patientId='other';f.c.syncPatient();assert.deepEqual(f.health,['p','other']);assert.equal(f.c.patientId,'other');f.c.go(f.c.healthReturn);assert.equal(f.c.route,'schedule');});
test('settings returns to health without changing the selected patient',()=>{const f=router();f.c.go('health');f.c.go('settings');assert.equal(f.c.settingsReturn,'health');f.c.backFromSettings();assert.equal(f.c.route,'health');assert.equal(f.c.patientId,'p');});
test('logout clears positions and cancels pending navigation; consent blocks navigation',()=>{const f=router();f.c.go('schedule');f.c.positions.set('health|p',300);f.data.base={token:'',home:null};f.data.care={patientId:''};f.data.allowed=false;f.c.onView('loginView');f.flush();assert.equal(f.c.positions.size,0);assert.equal(f.scrolls.length,0);assert.equal(f.c.go('health'),false);assert.equal(f.health.length,0);});
test('late medication notification cannot take the user back after navigating away',()=>{const source=readFileSync(new URL('../home-care.js',import.meta.url),'utf8'),c=vm.createContext({medLink:{pid:'p'},linkFocused:false,notificationQuery:new URLSearchParams(),window:{carestepHomeNavigation:{allowsNotificationFocus:()=>false}}});vm.runInContext(source.slice(source.indexOf('function focusMedicationNotification('),source.indexOf('async function api(')),c);c.focusMedicationNotification();assert.equal(c.linkFocused,true);});
test('late custom notification does not refocus a hidden management panel',()=>{const source=readFileSync(new URL('../home-reminders.js',import.meta.url),'utf8'),c=vm.createContext({deepFocused:false,data:{},query:new URLSearchParams('?customReminder=r'),window:{carestepHomeNavigation:{allowsNotificationFocus:()=>false}}});vm.runInContext(source.slice(source.indexOf('function focusDeepLink('),source.indexOf('async function loadDevice(')),c);c.focusDeepLink();assert.equal(c.deepFocused,true);});
