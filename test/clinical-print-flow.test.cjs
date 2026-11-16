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
test('PDF result numbers retain searchable Unicode digits',async()=>{
 const {execFileSync}=require('node:child_process');
 for(const [kind,values] of [['chronic',['2.1','4.3','30']],['anesthesia',['37.4','14:00','98']],['healthcheck',['0','100']]]){
  await load(kind);const html=await inspect(d=>{const doc=d.cloneNode(true);doc.querySelectorAll('script').forEach(s=>s.remove());return '<!doctype html>'+doc.documentElement.outerHTML;});
  const p=await context.newPage();try{await p.goto('http://carestep.test/test/clinical-print-fixture.html');await p.setContent(html);await p.evaluate(()=>document.fonts.ready);await p.emulateMedia({media:'print'});const bytes=await p.pdf({preferCSSPageSize:true,printBackground:true});const text=execFileSync(process.env.PDF_TEST_PYTHON||'python',['-c','import sys,io; from pypdf import PdfReader; sys.stdout.buffer.write("\\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages).encode("utf-8"))'],{input:bytes}).toString('utf8');assert.doesNotMatch(text,/[\uE000-\uF8FF]/);for(const value of values)assert.ok(text.includes(value),kind+' missing '+value);}finally{await p.close();}
 }
});
test('a sparse anesthesia table has a readable compact width without losing its last value',async()=>{
 await load('anesthesia');const r=await inspect(d=>{const t=[...d.querySelectorAll('.cp-pages .ap-matrix')].at(-1),area=t.closest('.pagedjs_page_content');return {width:t.getBoundingClientRect().width/area.getBoundingClientRect().width,count:t.querySelector('thead tr').children.length,content:t.textContent};});assert.equal(r.count,2);assert.ok(r.width<.3);assert.ok(r.content.includes('14:00')&&r.content.includes('기록자')&&r.content.includes('37.4'));
});
test('standalone photos adapt to resolution and page space without changing aspect ratio',async()=>{
 for(const viewport of [1500,390]){await page.setViewportSize({width:viewport,height:1100});for(const [width,height,longCaption] of [[1600,1000,false],[1200,1800,false],[240,160,false],[1600,1000,true]]){
  await page.evaluate(async({width,height,longCaption})=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#ddeee9';ctx.fillRect(0,0,width,height);const src=canvas.toDataURL(),w=out.contentWindow;w.document.open();w.document.write('<html><head><style>.photo-test-title{break-before:page}</style></head><body><main><h2>진단·치료 계획</h2><p>저장된 진료 내용</p><h2 class="photo-test-title">검사 사진</h2><section class="photos"><figure><img src="'+src+'"><figcaption>'+(longCaption?'사진 설명 보존 '.repeat(40):'사진 설명')+'</figcaption></figure></section></main></body></html>');w.document.close();await app.contentWindow.ClinicalPrint.prepare(w,{kind:'ophthalmic',title:'사진 배치 검증'});await ready();},{width,height,longCaption});
  const r=await inspect((d,w)=>{const gallery=d.querySelector('.cp-pages .cp-gallery'),img=gallery.querySelector('img'),area=gallery.closest('.pagedjs_page_content'),box=area.getBoundingClientRect();return {expanded:gallery.dataset.cpExpanded==='true',height:img.offsetHeight,fit:w.getComputedStyle(img).objectFit,bottom:Math.max(...[...area.querySelectorAll('figcaption,.cp-endnote,img')].map(e=>e.getBoundingClientRect().bottom)),limit:box.bottom,ready:d.body.dataset.printReady};});
  assert.equal(r.expanded,width>240,JSON.stringify({width,height,longCaption,...r}));assert.equal(r.fit,'contain');assert.equal(r.ready,'true');assert.ok(r.bottom<=r.limit+2);if(width===240)assert.ok(r.height<=58*96/25.4+1);else assert.ok(r.height>58*96/25.4+8);
 }}await page.setViewportSize({width:1500,height:1100});
});
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
