import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../carestep-home.js',import.meta.url),'utf8');
function fixture(title,kind){
 const downloads=[];class Node{constructor(tag){this.tag=tag;this.children=[];this.dataset={};}append(...n){this.children.push(...n);}click(){downloads.push(this.download);}querySelector(){return this.children.find(n=>n.dataset.materialReadStatus)||null;}setAttribute(){}all(){return [this,...this.children.flatMap(n=>n.all())];}}
 const c={state:{token:'synthetic-session'},API:'https://synthetic.invalid',crypto:webcrypto,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:()=>{}},navigator:{userAgent:'synthetic'},isIos:()=>false,isStandalone:()=>false,document:{createElement:t=>new Node(t)},window:{addEventListener:()=>{}},r113PDFURLs:new Set(),api:async()=>({ok:true,materials:[{deliveryId:'delivery-a',assetId:'asset-a',filename:'carestep-material.pdf',title,kind,byteSize:5,sha256:Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('%PDF-'))).toString('hex')}]}),fetch:async url=>({status:200,url,redirected:false,headers:new Headers({'Content-Type':'application/pdf','Cache-Control':'private, no-store'}),blob:async()=>new Blob(['%PDF-'])})};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function r113PDFTitle('),source.indexOf('  async function api(')),c);return {c,mount:new Node('section'),downloads};
}

test('an old PDF list from the same login cannot populate a replaced shelf',async()=>{const f=fixture('검수 자료');let release,current=true;f.c.api=()=>new Promise(r=>release=r);const work=f.c.r113PDFMaterials(f.mount,()=>current);current=false;release({ok:true,materials:[{deliveryId:'stale',assetId:'a',title:'OLD_CONTENT'}]});await work;assert.equal(f.mount.children.length,0);});
test('a failed stale PDF request cannot attach an error to a new shelf',async()=>{const f=fixture('검수 자료');let reject,current=true;f.c.api=()=>new Promise((_r,j)=>reject=j);const work=f.c.r113PDFMaterials(f.mount,()=>current);current=false;reject(Error('synthetic failure'));await work;assert.equal(f.mount.children.length,0);});
