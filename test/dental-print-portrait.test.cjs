const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),D=require('../dental-record.js');
const output=process.env.DENTAL_PRINT_OUTPUT||path.resolve(__dirname,'../../dental-portrait-qa');
let browser;
before(async()=>{fs.mkdirSync(output,{recursive:true});browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});});
after(async()=>{await browser?.close();});
function fixture(species,long=false){
 const d=D.empty();d.date='2026-11-15';d.veterinarian='시험 수의사';d.diagnosis='합성 치과 소견';d.procedure='합성 처치';d.followup='합성 재검 계획';d.guardianDraft='합성 보호자 안내\n입력한 안내 내용의 방향과 줄바꿈을 확인합니다.';
 d.teeth=Object.fromEntries(D.teeth(species).map((id,i)=>[id,{gi:i%4,note:long?('치아 '+id+' 소견 내용 ').repeat(12):'시험 소견'}]));
 if(long){d.diagnosis+='\n'+('긴 진료 소견과 처치 내용을 보존합니다. ').repeat(100);d.guardianDraft+='\n'+('보호자 안내 내용을 보존합니다.\n').repeat(120);}
 const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#e6f3f0"/><path d="M160 30L130 65H145V130H175V65H190Z" fill="#17796d"/><text x="160" y="190" text-anchor="middle" font-size="24">UP / TOP</text></svg>').toString('base64');
 d.images=Array.from({length:long?8:2},(_,i)=>({dataUrl:image,kind:'합성 검사 이미지',caption:'사진 '+(i+1)+' 방향 확인'}));
 return {d,item:{patient:{name:'합성 환자',guardianName:'합성 보호자',chartNumber:'TEST-001'},body:{species,weight:5}}};
}
for(const [name,species,options,long] of [['dog-detailed','dog',{},false],['cat-summary','cat',{mode:'summary',images:false},false],['long-record','dog',{},true],['guardian','cat',{target:'guardian'},true]]){
 test(name+' uses upright A4 preview and PDF without lost chart teeth',async()=>{
  const {d,item}=fixture(species,long),html=D.printHtml(item,d,'시험 병원',options);
  assert.equal((html.match(/@page\{/g)||[]).length,1);
  const p=await browser.newPage({viewport:{width:1600,height:1000}});
  try{
   await p.setContent(html);await p.evaluate(()=>document.fonts.ready);
   const box=await p.locator('.dn-print-page').boundingBox();assert.ok(Math.abs(box.width-210*96/25.4)<1);assert.ok(box.height>box.width);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(options.target!=='guardian')assert.equal(await p.locator('.dn-chart svg').count(),D.teeth(species).length);
   await p.screenshot({path:path.join(output,name+'-preview.png'),fullPage:!long});
   const pdf=await p.pdf({path:path.join(output,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
   const raw=pdf.toString('latin1'),boxes=[...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
   assert.ok(boxes.length);for(const [,w,h]of boxes){assert.ok(Math.abs(Number(w)-595.28)<1);assert.ok(Math.abs(Number(h)-841.89)<1);}
   for(const [,rotation]of raw.matchAll(/\/Rotate\s+(-?\d+)/g))assert.equal(Number(rotation)%360,0);
   await p.emulateMedia({media:'print'});assert.equal(await p.locator('.dn-print-toolbar').isVisible(),false);assert.equal(await p.locator('.dn-print-page').evaluate(e=>getComputedStyle(e).transform),'none');
  }finally{await p.close();}
 });
}
test('narrow portrait preview remains readable without horizontal scrolling and print stays two columns',async()=>{
 const {d,item}=fixture('dog');const p=await browser.newPage({viewport:{width:390,height:844}});
 try{await p.setContent(D.printHtml(item,d,'시험 병원'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('.dn-chart').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);await p.screenshot({path:path.join(output,'mobile-preview.png'),fullPage:true});await p.emulateMedia({media:'print'});assert.equal(await p.locator('.dn-chart').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);}finally{await p.close();}
});
