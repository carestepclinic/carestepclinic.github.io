const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../record-print-improvements');
async function checkPrintLayout(page,{name,sheet,toolbar,landscape=false}){
 fs.mkdirSync(out,{recursive:true});
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1600,height:1000});
 await page.evaluate(()=>document.fonts.ready);
 const box=await page.locator(sheet).first().boundingBox();
 assert.ok(Math.abs(box.width-(landscape?297:210)*96/25.4)<1,'preview paper width');
 assert.ok(box.height>=(landscape?210:297)*96/25.4-1,'preview paper height');
 assert.ok(await page.locator(toolbar).isVisible());
 const dimensions=await page.locator(sheet).first().evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.width+1,'content must stay inside paper');
 await page.screenshot({path:path.join(out,name+'-preview.png'),fullPage:false});
 await page.setViewportSize({width:390,height:844});
 if(!landscape)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile preview overflow');
 await page.setViewportSize({width:1600,height:1000});await page.emulateMedia({media:'print'});
 assert.equal(await page.locator(toolbar).isVisible(),false);
 const pdf=await page.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true}),raw=pdf.toString('latin1');
 const boxes=[...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];assert.ok(boxes.length);
 for(const [,w,h]of boxes){assert.ok(Math.abs(Number(w)-(landscape?841.89:595.28))<1);assert.ok(Math.abs(Number(h)-(landscape?595.28:841.89))<1);}
 for(const [,rotation]of raw.matchAll(/\/Rotate\s+(-?\d+)/g))assert.equal(Number(rotation)%360,0);
 await page.emulateMedia({media:'screen'});
}
module.exports={checkPrintLayout};
