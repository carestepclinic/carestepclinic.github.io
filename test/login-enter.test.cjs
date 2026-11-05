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
  await p.locator(ids.first).fill(kind==='clinic'?'test@example.com':'https://example.invalid');await p.locator(ids.secret).fill('test-only-secret');
  return {p,...ids};
}
for(const kind of ['clinic','hq']){
  for(const field of ['first','secret'])test(kind+' Enter in '+field+' submits once',async t=>{
    const x=await setup(t,kind);await x.p.locator(x[field]).press('Enter');await x.p.waitForFunction(()=>loginCalls.length>0);
    assert.equal(await x.p.evaluate(path=>loginCalls.filter(c=>c.path===path).length,x.path),1);
    if(kind==='clinic'){assert.equal(await x.p.evaluate(()=>loginDone),1);assert.deepEqual(await x.p.evaluate(()=>loginCalls[0].body),{email:'test@example.com',password:'test-only-secret'});}
    else assert.equal(await x.p.locator('#loginOverlay').isVisible(),false);
    assert.equal(new URL(x.p.url()).search,'');
  });
  test(kind+' click and repeated Enter share pending guard and recover after error',async t=>{
    const x=await setup(t,kind);await x.p.evaluate(()=>{loginDelay=350;loginFail=true;});await x.p.locator(x.button).click();
    assert.equal(await x.p.locator(x.button).isDisabled(),true);
    await x.p.locator(x.secret).press('Enter');await x.p.evaluate(kind=>kind==='clinic'?saasLogin():connect(),kind);
    await x.p.waitForFunction(sel=>!document.querySelector(sel).disabled,x.button);
    assert.equal(await x.p.evaluate(()=>loginCalls.length),1);assert.ok((await x.p.locator('body').innerText()).includes('시험 로그인 실패'));
    assert.equal(await x.p.locator(x.secret).inputValue(),'test-only-secret');
    await x.p.evaluate(()=>{loginFail=false;loginDelay=0;});await x.p.locator(x.secret).press('Enter');
    await x.p.waitForFunction(()=>loginCalls.length>=2);assert.equal(await x.p.evaluate(path=>loginCalls.filter(c=>c.path===path).length,x.path),2);
  });
  test(kind+' IME Enter is ignored and normal Enter remains available',async t=>{
    const x=await setup(t,kind);assert.equal(await x.p.locator(x.secret).evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}))),false);
    assert.equal(await x.p.evaluate(()=>loginCalls.length),0);await x.p.locator(x.secret).press('Enter');await x.p.waitForFunction(()=>loginCalls.length>0);
  });
  test(kind+' mobile login submits without layout overflow',async t=>{
    const x=await setup(t,kind,390);assert.equal(await x.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await x.p.locator(x.secret).press('Enter');await x.p.waitForFunction(()=>loginCalls.length>0);
  });
}
test('CLINIC registration Enter does not submit login',async t=>{
  const x=await setup(t,'clinic');await x.p.locator('[data-saas-auth="register"]').click();await x.p.locator('#saasRegisterEmail').fill('register@example.com');await x.p.locator('#saasRegisterEmail').press('Enter');assert.equal(await x.p.evaluate(()=>loginCalls.length),0);
});
