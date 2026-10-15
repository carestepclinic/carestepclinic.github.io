import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const data=(name,end)=>{const start=html.indexOf(`const ${name} = `)+`const ${name} = `.length;return JSON.parse(html.slice(start,html.indexOf(end,start)+end.length-1));};
test('real education renderer uses dental cover, care and timeline with a scaling procedure',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',dataset:{},classList:{add(){},remove(){}}});return nodes.get(id);};
 const ctx={$:node,window:{crmCurrentPatient:()=>({patientId:'synthetic-patient'})},templates:data('templates','\n];'),journeyProfiles:data('journeyProfiles','\n};'),currentTemplateId:'pancreatitis',caseInfo:{procedure:'스케일링'},hospital:{license:'SYNTHETIC'},qrDataUrl:'',Date,
  readCaseInfoFromForm(){},refreshQrData(){},escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),hospitalName:()=> '검수 병원',logoHtml:()=>'',footerClinicLine:()=> '검수용',contactLine:()=>'',medicationPageCount:()=>0,actualDateFor:()=>'',baseDateLabel:()=>'',recheckLabel:()=>'',templateDisplayTitle:t=>t.title,checklist:rows=>(rows||[]).join(' · '),patientCoverHtml:()=>'<div>진단/수술 스케일링</div>',customPlanEntries:()=>[['진단/수술','스케일링']]};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function flattenCareItems(t){'),html.indexOf('function renderCheckCard(day){')),ctx);
 ctx.renderAdvancedPdf();assert.match(node('pdfDocument').innerHTML,/췌장염/);
 ctx.currentTemplateId='dental';ctx.renderAdvancedPdf();const output=node('pdfDocument').innerHTML;
 assert.match(output,/강아지·고양이 스케일링·발치 후 관리/);assert.match(output,/스케일링·발치 후 구강회복 관리/);assert.match(output,/진단\/수술<\/td><td>스케일링/);assert.doesNotMatch(output,/췌장염/);assert.match(output,/회복 타임라인/);
});
