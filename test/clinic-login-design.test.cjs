const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=resolve(__dirname,'..');let browser,server,origin;
before(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.HQ_TEST_BROWSER});
  server=http.createServer((req,res)=>{try{const path=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');res.end(readFileSync(resolve(root,path.slice(1))));}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function setup(t,kind,width=1440){
  const p=await browser.newPage({viewport:{width,height:900}});p.setDefaultTimeout(6000);t.after(()=>p.close());
  await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await p.goto(origin+(kind==='clinic'?'/index.html':'/hq.html'));
  await p.evaluate(kind=>{
    window.loginCalls=[];window.loginDelay=0;window.loginFail=false;window.loginDone=0;
    const request=async(path,o={})=>{loginCalls.push({path,body:o.body?JSON.parse(o.body):null});if(loginDelay)await new Promise(r=>setTimeout(r,loginDelay));if(loginFail)throw Error('시험 로그인 실패');return {token:'test-session',expiresAt:'2099-01-01',me:{}};};
    if(kind==='clinic'){saasRequest=request;saasFinishAuth=async()=>{window.loginDone++;};}
    else{req=request;loadOverview=async()=>{};if(window.CarestepHqUX)CarestepHqUX.restoreRoute=()=>{};}
  },kind);
  const ids=kind==='clinic'?{first:'#saasLoginEmail',secret:'#saasLoginPassword',button:'#saasLoginBtn',form:'#saasLoginForm',path:'/saas/login'}:{first:'#endpoint',secret:'#hqKey',button:'#connect',form:'#hqLoginForm',path:'/hq/session'};
  if(kind==='hq')await p.locator('.hq-login-advanced summary').click();
  await p.locator(ids.first).fill(kind==='clinic'?'test@example.com':'https://example.invalid');await p.locator(ids.secret).fill('test-only-secret');
  return {p,...ids};
}
for(const width of [360,390,1440])test('login and both signup panels retain fields, match the workspace and remain usable '+width,async t=>{
 const {p}=await setup(t,'clinic',width);
 await p.locator('#saasLoginEmail').fill('');await p.locator('#saasLoginPassword').fill('');
 for(const mode of ['login','register','invite']){
   await p.locator('[data-saas-auth="'+mode+'"]').click();
   assert.equal(await p.locator('[data-saas-auth="'+mode+'"]').getAttribute('aria-pressed'),'true');
   assert.equal(await p.locator('[data-saas-panel].active').getAttribute('data-saas-panel'),mode);
   const style=await p.locator('#loginView').evaluate(n=>{const tab=n.querySelector('.saas-auth-tab.active'),input=n.querySelector('.saas-auth-panel.active .input');return {bg:getComputedStyle(tab).backgroundColor,font:getComputedStyle(input).fontSize,family:getComputedStyle(input).fontFamily,body:getComputedStyle(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth+1,tabs:[...n.querySelectorAll('.saas-auth-tab')].map(n=>n.getBoundingClientRect().top)};});
   assert.equal(style.bg,'rgb(25, 118, 110)');assert.equal(style.font,'16px');assert.equal(style.family,style.body);assert.equal(style.overflow,false);assert.ok(style.tabs.every(x=>x===style.tabs[0]));
   assert.doesNotMatch(await p.locator('#loginView').innerText(),/v10\.7|PATIENT JOURNEY|CARESTEP SAAS/);
   if(mode!=='login'){const prefix=mode==='register'?'saasRegister':'saasInvite';assert.equal(await p.locator('#'+prefix+'Terms').isChecked(),false);assert.equal(await p.locator('#'+prefix+'Privacy').isChecked(),false);}
   if(process.env.UX_SCREENSHOTS)await p.screenshot({path:resolve(process.env.UX_SCREENSHOTS,'login-'+mode+'-'+width+'.png'),fullPage:true});
 }
 await p.locator('#saasInviteCode').fill('SYNTHETIC-CODE');await p.locator('[data-saas-auth=login]').click();await p.locator('#saasLoginEmail').fill('synthetic@example.com');await p.locator('[data-saas-auth=invite]').click();assert.equal(await p.locator('#saasInviteCode').inputValue(),'SYNTHETIC-CODE');await p.locator('[data-saas-auth=login]').click();assert.equal(await p.locator('#saasLoginEmail').inputValue(),'synthetic@example.com');
 await p.locator('.clinic-login-notice summary').click();assert.match(await p.locator('.clinic-login-notice').innerText(),/SOLAPI/);assert.equal(await p.evaluate(()=>loginCalls.length),0);
});
test('footer legal links keep document routing and do not accept signup terms',async t=>{
 const {p}=await setup(t,'clinic');await p.evaluate(()=>{window.openedLegal=[];openLegalDocument=async kind=>openedLegal.push(kind);});
 await p.locator('.clinic-login-links [data-legal-doc=terms]').click();await p.locator('.clinic-login-links [data-legal-doc=privacy]').click();assert.deepEqual(await p.evaluate(()=>openedLegal),['terms','privacy']);
 await p.locator('[data-saas-auth=register]').click();assert.equal(await p.locator('#saasRegisterTerms').isChecked(),false);assert.equal(await p.locator('#saasRegisterPrivacy').isChecked(),false);
 assert.equal(await p.locator('#saasAuthStatus').getAttribute('role'),'status');await p.evaluate(()=>saasSetAuthStatus('합성 오류 안내','error'));assert.equal(await p.locator('#saasAuthStatus').isVisible(),true);assert.match(await p.locator('#saasAuthStatus').innerText(),/합성 오류/);
});
