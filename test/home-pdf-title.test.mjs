import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../carestep-home.js',import.meta.url),'utf8');
function fixture(title){
 const downloads=[];class Node{constructor(tag){this.tag=tag;this.children=[];this.dataset={};}append(...n){this.children.push(...n);}click(){downloads.push(this.download);}}
 const c={state:{token:'synthetic-session'},API:'https://synthetic.invalid',crypto:webcrypto,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:()=>{}},navigator:{userAgent:'synthetic'},isIos:()=>false,isStandalone:()=>false,document:{createElement:t=>new Node(t)},window:{addEventListener:()=>{}},r113PDFURLs:new Set(),api:async()=>({ok:true,materials:[{deliveryId:'delivery-a',assetId:'asset-a',filename:'carestep-material.pdf',title,byteSize:5,sha256:Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('%PDF-'))).toString('hex')}]}),fetch:async url=>({status:200,url,redirected:false,headers:new Headers({'Content-Type':'application/pdf','Cache-Control':'private, no-store'}),blob:async()=>new Blob(['%PDF-'])})};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function r113PDFTitle('),source.indexOf('  async function api(')),c);return {c,mount:new Node('section'),downloads};
}
for(const title of ['고급자료 10.15','복약체크표 10.15','<img src=x onerror=alert(1)>'])test('Home title and download: '+title,async()=>{const f=fixture(title);await f.c.r113PDFMaterials(f.mount);const card=f.mount.children[0];assert.equal(card.children[0].textContent,title);assert.equal(card.children[0].innerHTML,undefined);await card.children[2].onclick();assert.equal(f.downloads[0],f.c.r113PDFFilename({title}));});
test('older API without title remains readable',async()=>{const f=fixture(undefined);await f.c.r113PDFMaterials(f.mount);assert.equal(f.mount.children[0].children[0].textContent,'carestep-material.pdf');});
test('filename preserves Korean and removes unsafe characters',()=>{const f=fixture('');assert.equal(f.c.r113PDFFilename({title:'복약체크표 10.15.pdf'}),'복약체크표 10.15.pdf');assert.doesNotMatch(f.c.r113PDFFilename({title:'../자료\r\n"/\\:?'}),/[\r\n"/\\:?]/);});
