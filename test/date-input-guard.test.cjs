const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
async function fixture(t){
 const browser=await chromium.launch({executablePath:process.env.HQ_TEST_BROWSER||'/tmp/protocol-chromium/chromium',headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());const page=await browser.newPage();
 await page.setContent('<form><input id="date" type="date"><button>저장</button></form>');
 await page.addScriptTag({path:path.resolve(__dirname,'../date-input-guard.js')});
 await page.evaluate(()=>{document.querySelector('form').insertAdjacentHTML('afterbegin','<input id="time" type="datetime-local" required>');window.saved=[];document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();saved.push(document.querySelector('#time').value);});});
 return page;
}
test('dynamic datetime input corrects six-digit year and preserves month, day and time',async t=>{
 const p=await fixture(t);
 assert.equal(await p.locator('#time').getAttribute('max'),'2099-12-31T23:59:59.999');
 await p.locator('#time').fill('202610-10-31T10:00');
 assert.equal(await p.locator('#time').inputValue(),'2026-10-31T10:00');
 await p.locator('button').click();
 assert.deepEqual(await p.evaluate(()=>saved),['2026-10-31T10:00']);
});
test('native year segment typing cannot retain a six-digit year',async t=>{
 const p=await fixture(t);const el=p.locator('#time');
 await el.fill('2026-10-31T10:00');await el.focus();
 // Chromium en-US date segments: month, day, year.
 for(let i=0;i<6;i++)await p.keyboard.press('ArrowLeft');
 await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');
 await p.keyboard.type('202610');
 assert.equal(await el.inputValue(),'2026-10-31T10:00');
});
test('invalid year blocks saving and regular date and valid datetime retain values',async t=>{
 const p=await fixture(t);
 await p.locator('#time').fill('2100-10-31T10:00');
 await p.locator('button').click();assert.deepEqual(await p.evaluate(()=>saved),[]);
 await p.locator('#time').fill('2028-02-29T23:45');
 await p.locator('#date').fill('202610-10-31');
 assert.equal(await p.locator('#date').inputValue(),'2026-10-31');
 await p.locator('button').click();assert.deepEqual(await p.evaluate(()=>saved),['2028-02-29T23:45']);
 await p.locator('#time').fill('');
 await p.locator('button').click();assert.equal(await p.evaluate(()=>saved.length),1);
});
