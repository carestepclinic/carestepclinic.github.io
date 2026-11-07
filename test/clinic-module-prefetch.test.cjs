const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
test('selected module downloads overlap while scripts execute in dependency order',async()=>{
 const requests=[],completed=[];const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<script id="clinic-module-manifest" type="application/json">{"selected":["/1.js","/2.js","/3.js","/4.js"],"other":["/unused.js"]}</script>');}
  requests.push(req.url);res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','public,max-age=60');
  setTimeout(()=>{completed.push(req.url);res.end('window.order=(window.order||[]);order.push('+JSON.stringify(req.url)+');');},120);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER,headless:true});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port);await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../clinic-lazy-modules.js'),'utf8')});const load=p.evaluate(()=>Promise.all([ClinicLazyModules.ensure('selected'),ClinicLazyModules.ensure('selected')]));
 await new Promise(r=>{const timer=setInterval(()=>{if(requests.filter(x=>/\d\.js/.test(x)).length>=4||completed.length){clearInterval(timer);r();}},5);});assert.equal(completed.length,0,'all files must start before the first response');
 await load;assert.deepEqual(await p.evaluate(()=>order),['/1.js','/2.js','/3.js','/4.js']);await p.evaluate(()=>ClinicLazyModules.ensure('selected'));assert.equal(requests.filter(x=>/\d\.js/.test(x)).length,4);assert.equal(requests.includes('/unused.js'),false);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
