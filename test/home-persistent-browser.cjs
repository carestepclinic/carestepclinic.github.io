const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 let version='before',checks=0;
 const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,p==='/'?'home.html':p);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{let body=fs.readFileSync(file);if(p==='/sw.js'&&version==='before')body=Buffer.from(body.toString().replace("home-usability-20261108final","home-session-test-before"));res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.json')||p.endsWith('.webmanifest')?'application/json':'application/octet-stream');res.end(body)}catch{res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}).catch(error=>{server.close();throw error});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});let meStatus=200,mutations=[],devices=[{id:'s1',label:'Windows · Edge',current:true,lastSeenAt:'2026-11-08T00:00:00Z'},{id:'s2',label:'Android · Chrome',current:false,lastSeenAt:'2026-11-07T12:00:00Z'}];
 await context.route('https://carestep-ai-api.kk04sdw.workers.dev/**',async route=>{const req=route.request(),url=new URL(req.url());let status=200,body={ok:true,items:[],materials:[],connections:[],events:[],doses:[],plans:[],reminders:[],summary:{},enabled:false};
 if(url.pathname==='/home/me'){status=meStatus;body={ok:true,home:{user:{id:'synthetic',displayName:'가상 보호자'},connections:[],consentRequired:false},session:{persistent:true},error:'로그인이 해제되었습니다.'};}
 if(url.pathname==='/home/sessions')body={ok:true,devices};
 if(url.pathname==='/home/login')body={ok:true,session:{token:'synthetic-token'},home:{user:{id:'synthetic',displayName:'가상 보호자'},connections:[],consentRequired:false}};
 if(['/home/sessions/revoke','/home/password/change','/home/logout'].includes(url.pathname)){const data=req.postData()?req.postDataJSON():{};mutations.push({path:url.pathname,...data});if(data.password==='wrong'){status=400;body={error:'현재 비밀번호를 확인해주세요.'}}else{body={ok:true,signedOut:url.pathname==='/home/password/change'||data.all===true||data.sessionId==='s1'};devices=devices.filter(d=>d.id!==data.sessionId);}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/home.html');await page.evaluate(()=>localStorage.setItem('carestep_home_session_v1','synthetic-token'));await page.reload();await page.waitForFunction(()=>window.carestepHomeSnapshot?.().home?.user?.id==='synthetic');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);checks++;
 // Actual service-worker update on an open app must keep login and allow new settings.
 version='after';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting);await page.locator('#homeApplyUpdate').click();await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration())?.waiting);
 await page.waitForFunction(async()=>{const cacheNames=await caches.keys();return cacheNames.includes('carestep-home-home-usability-20261108final')});
 await page.waitForFunction(()=>window.carestepHomeSnapshot?.().home?.user?.id==='synthetic');assert.equal(await page.evaluate(()=>localStorage.getItem('carestep_home_session_v1')),'synthetic-token');checks++;
 await page.locator('#homeNavigationSettingsButton').click();await page.locator('#homeSecurityLoad').click();await page.locator('.home-security-device').nth(1).waitFor();assert.equal(await page.locator('.home-security-device').count(),2);checks++;
 for(const width of [1280,390,360]){await page.setViewportSize({width,height:900});const overflow=await page.locator('#homeSecurityPanel').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);checks++;await page.locator('#homeSecurityPanel').screenshot({path:path.join(root,'..','home-security-'+width+'.png')});}
 await page.locator('.home-security-device').nth(1).getByRole('button').click();await page.locator('#homeSecurityCurrent').fill('wrong');await page.locator('#homeSecuritySubmit').click();await page.getByText('현재 비밀번호를 확인해주세요.').waitFor();assert.equal(await page.locator('.home-security-device').count(),2);checks++;
 await page.locator('#homeSecurityCurrent').fill('pass12345');await page.locator('#homeSecuritySubmit').click();await page.waitForFunction(()=>document.querySelectorAll('.home-security-device').length===1);checks++;
 await page.locator('#homeSecurityPassword').click();await page.locator('#homeSecurityCurrent').fill('pass12345');await page.locator('#homeSecurityNew').fill('changed123');await page.locator('#homeSecurityRepeat').fill('different123');const count=mutations.length;await page.locator('#homeSecuritySubmit').click();await page.getByText('새 비밀번호가 일치하지 않습니다.').waitFor();assert.equal(mutations.length,count);checks++;
 await page.locator('#homeSecurityRepeat').fill('changed123');await page.locator('#homeSecuritySubmit').click();await page.locator('#loginView').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.getItem('carestep_home_session_v1')),null);assert.equal(await page.locator('#homeSecurityCurrent').inputValue(),'');checks++;
 await page.locator('#loginPhone').fill('01000000000');await page.locator('#loginPassword').fill('changed123');await page.locator('#loginSubmit').click();await page.waitForFunction(()=>!!window.carestepHomeSnapshot?.().home);assert.equal(await page.locator('#loginPassword').inputValue(),'');checks++;
 // Temporary server error retains token; a confirmed revocation removes it.
 meStatus=503;await page.evaluate(()=>window.carestepRefreshHomeAccess(true));assert.equal(await page.evaluate(()=>localStorage.getItem('carestep_home_session_v1')),'synthetic-token');checks++;
 meStatus=401;await page.evaluate(()=>window.carestepRefreshHomeAccess(true));await page.locator('#loginView').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.getItem('carestep_home_session_v1')),null);checks++;
 meStatus=200;await page.locator('#loginPhone').fill('01000000000');await page.locator('#loginPassword').fill('changed123');await page.locator('#loginSubmit').click();await page.waitForFunction(()=>!!window.carestepHomeSnapshot?.().home);
 const other=await context.newPage();await other.goto(base+'/home.html');await other.waitForFunction(()=>!!window.carestepHomeSnapshot?.().home);await page.evaluate(()=>localStorage.removeItem('carestep_home_session_v1'));await other.locator('#loginView').waitFor({state:'visible'});assert.equal(await other.evaluate(()=>window.carestepHomeSnapshot().home),null);checks++;
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks,errors:errors.length}));await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
