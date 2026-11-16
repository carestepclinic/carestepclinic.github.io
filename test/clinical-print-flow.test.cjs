const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');let browser,context,page;
before(async()=>{
 browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 context=await browser.newContext({viewport:{width:1500,height:1100}});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(!['carestep.test','carestepclinic.github.io'].includes(u.hostname))return r.abort();const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return r.abort();return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});});
 page=await context.newPage();await page.goto('http://carestep.test/test/clinical-print-browser.html');
});
after(async()=>browser?.close());
async function load(kind,length='short',scenario=''){await page.evaluate(async({kind,length,scenario})=>{await loadScenario(scenario,length);await show(kind);},{kind,length,scenario});}
async function inspect(fn){return page.locator('#output').evaluate((frame,source)=>(new Function('d','w','return ('+source+')(d,w)'))(frame.contentDocument,frame.contentWindow),String(fn));}
test('long neuro and chronic records show results before assessment and plans',async()=>{
 for(const kind of ['neuro','chronic']){await load(kind,'long');const result=await inspect(d=>{const container=d.querySelector('.cp-pages'),table=container.querySelector('table'),heading=[...container.querySelectorAll('h2')].find(h=>h.textContent===('판단·감별진단'))||[...container.querySelectorAll('h2')].find(h=>h.textContent==='진단·평가');return {after:!!(table.compareDocumentPosition(heading)&4),end:container.textContent.includes('LONG_NOTE_END'),history:container.textContent.includes('주호소·경과')||container.textContent.includes('주증상·발병·경과')};});assert.deepEqual(result,{after:true,end:true,history:true});}
});
test('anesthesia matrices retain recorder with measurements and readable graph units',async()=>{
 for(const length of ['short','long']){await load('anesthesia',length);const result=await inspect((d,w)=>{const tables=[...d.querySelectorAll('.cp-pages .ap-matrix')];return {pages:d.querySelectorAll('.pagedjs_page').length,complete:tables.every(t=>t.textContent.includes('기록자')&&t.textContent.includes('심박수')),measurements:tables.reduce((n,t)=>n+[...t.querySelectorAll('tbody tr')].filter(tr=>tr.querySelector('th')?.textContent.includes('심박수')).reduce((n,tr)=>n+tr.querySelectorAll('td').length,0),0),minUnits:Math.min(...[...d.querySelectorAll('.cp-pages .ap-chart h3 small')].map(n=>parseFloat(w.getComputedStyle(n).fontSize)))};});assert.equal(result.complete,true);assert.equal(result.measurements,61);assert.ok(result.minUnits>=11.3);assert.ok(result.pages<=(length==='short'?5:6));}
});
test('ophthalmic prescriptions and recheck precede photos, and remain when photos are excluded',async()=>{
 await load('ophthalmic');const result=await inspect(d=>{const first=d.querySelector('.pagedjs_page'),pages=d.querySelector('.cp-pages'),photo=pages.querySelector('.cp-gallery'),prescriptions=pages.querySelector('.cp-prescriptions');return {firstPlan:first.textContent.includes('보호자 안내·재검')&&!!first.querySelector('.cp-prescriptions'),photoAfter:!!(prescriptions.compareDocumentPosition(photo)&4)};});assert.deepEqual(result,{firstPlan:true,photoAfter:true});
 await page.evaluate(async()=>{const d=out.contentDocument,t=d.querySelector('[data-cp-photos]');t.checked=false;t.dispatchEvent(new Event('change',{bubbles:true}));await ready();});
 assert.deepEqual(await inspect(d=>({images:d.querySelectorAll('.cp-pages img').length,plan:!!d.querySelector('.cp-pages .cp-prescriptions')})),{images:0,plan:true});
});
test('short portrait records remain one page and identity text stays inside its field',async()=>{
 for(const kind of ['neuro','chronic','dental']){await load(kind);const result=await inspect(d=>{const cells=[...d.querySelectorAll('.cp-pages .cp-identity dd')];const overflow=cells.some(e=>{const r=d.createRange();r.selectNodeContents(e);const box=e.getBoundingClientRect();return [...r.getClientRects()].some(b=>b.left<box.left-1||b.right>box.right+1);});const staff=cells.at(-1),walker=d.createTreeWalker(staff,4),positions=[];let n;while(n=walker.nextNode()){let i=n.textContent.indexOf('테크니션');while(i>=0){const r=d.createRange();r.setStart(n,i);r.setEnd(n,i+4);positions.push(new Set([...r.getClientRects()].map(b=>Math.round(b.y))).size);i=n.textContent.indexOf('테크니션',i+4);}}return {pages:d.querySelectorAll('.pagedjs_page').length,overflow,wordSplit:positions.some(n=>n>1)};});assert.deepEqual(result,{pages:1,overflow:false,wordSplit:false},kind);}
});
for(const [id,finish] of [['optimized','구성 최적화 검증 완료'],['corrections','번호·새 페이지 검증 완료']])test('existing print workflow: '+id,{timeout:180000},async()=>{
 await page.locator('#'+id).click();await page.waitForFunction(text=>document.querySelector('#state').textContent===text,finish,{timeout:170000});const rows=await page.locator('#results li').allTextContents();assert.ok(rows.length>=4);assert.deepEqual(rows.filter(t=>!t.startsWith('PASS')),[]);console.log(id+': '+rows.length+' browser checks passed');
});
