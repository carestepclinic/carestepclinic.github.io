const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
module.exports=getBrowser=>{
async function setup(width=1440){
 const p=await getBrowser().newPage({viewport:{width,height:1000}});p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/',r=>r.fulfill({body:'<!doctype html><meta charset="utf-8"><main id="root"></main>',contentType:'text/html'}));await p.goto('http://localhost/');
 await p.addStyleTag({content:'body{font:14px Arial;margin:12px}*{box-sizing:border-box}'});
 for(const f of ['clinic-record-start.css','healthcheck-record.css'])if(fs.existsSync(path.join(root,f)))await p.addStyleTag({path:path.join(root,f)});
 for(const f of ['clinic-record-start.js','healthcheck-record.js'])await p.addScriptTag({path:path.join(root,f)});
 await p.evaluate(()=>{
 window.calls=[];window.stored=null;window.editable=true;window.failure=0;window.identity='hospital:user';window.reportDate='';window.photoRefs=false;window.photoBytes={};window.failAt=0;window.aiHold=false;window.releaseAI=null;window.previous=null;window.workflows=[];window.contextRows=[];
 window.patient={id:'patient-1',name:'가상 환자',species:'cat',weight:4,guardianName:'가상 보호자',chartNumber:'TEST-1',breed:'시험 품종',birthDate:'2020-01-01',sex:'female',neutered:'yes'};
 const request=async(url,o={})=>{const b=o.body?JSON.parse(o.body):null;calls.push({url,b});
 if(url.endsWith('/members'))return {members:[{display_name:'시험 수의사'}]};if(url.includes('/chronic-context?'))return {items:contextRows};if(url.endsWith('/workflows')){if(b){workflows.push({id:'wf-'+(workflows.length+1),revision:1,body:structuredClone(b.body)});return {ok:true};}return {items:structuredClone(workflows)};}
 if(url.includes('/patient-directory'))return {patients:[patient]};
 if(url.includes('/patient-summary?'))return {patient,items:window.priorSource?[{id:priorSource.id,category:priorSource.body.category,date:'2026-01-02'}]:[]};
 if(url.includes('/cases/prior-case?'))return {item:structuredClone(priorSource)};
 if(url.endsWith('/healthcheck-summary')&&aiHold)await new Promise(r=>releaseAI=r);
 if(url.includes('/healthcheck-images?')){const id=new URL('http://localhost'+url).searchParams.get('id');if(window.failPhoto===id){window.failPhoto='';throw Error('temporary photo failure');}return {dataUrl:photoBytes[id]};}
 if(url.endsWith('/healthcheck-summary'))return window.aiFixture||{overview:'첫 장 핵심 소견',summary:'입력 검사 기반 소견',management:'의료진 관리계획',followup:'재검 검토',questions:'확인할 사항',source:'a'.repeat(64)};
 if(url.endsWith('/lab-import')&&window.importSequence?.length){const r=window.importSequence.shift();if(r.error)throw Error(r.error);return r;}
 if(url.endsWith('/lab-import')&&window.importFixture)return window.importFixture;
 if(url.endsWith('/lab-import'))return {reportDate:reportDate||new Date(Date.now()+32400000).toISOString().slice(0,10),singleReport:true,warnings:[],results:[{name:'CREA',value:'2.4',unit:'mg/dL',reference:'0.5–1.8',source:'시험 검사실'}]};
 if(url.endsWith('/cases')&&b){if(b.patientId&&('guardianName' in b.healthcheckChart.patient||'chartNumber' in b.healthcheckChart.patient))throw Error('master identity leak');stored={id:'record-1',revision:1,patient_id:b.patientId||'',patient:b.patientId?patient:{...b.quickPatient,species:b.species},body:{species:b.species,healthcheckChart:b.healthcheckChart}};return {id:stored.id};}
 if(url.endsWith('/events')&&b&&b.kind==='case.delete'){if(window.deleteFail){window.deleteFail=false;throw Error('temporary delete failure');}stored.body.deleted={at:'2026-11-13'};stored.revision++;return {id:stored.id};}
 if(url.endsWith('/events')&&b){if(failAt&&stored.revision===failAt){failAt=0;throw Error('temporary connection failure');}if(photoRefs)b.data.images=b.data.images.map(im=>{if(!im.dataUrl)return im;photoBytes[im.id]=im.dataUrl;const {dataUrl,...meta}=im;return {...meta,imageRevision:stored.revision+1};});if(failure){const e=new Error('수정 필요');e.status=400;failure--;throw e;}stored.body.healthcheckChart=b.data;stored.revision++;return {id:stored.id,revision:stored.revision,healthcheckChart:structuredClone(b.data)};}
 if(url.includes('/cases/record-1?'))return {item:structuredClone(stored)};
 if(url.includes('/cases/previous?'))return {item:structuredClone(previous)};
 if(url.includes('/healthcheck?')&&url.includes('patientId=')&&previous)return {items:[{id:'previous',date:'2025-01-01',veterinarian:'가상 수의사'}]};
 return {items:stored&&!stored.body.deleted?[{id:stored.id,patient:stored.patient,date:stored.body.healthcheckChart.date}]:[]};};
 window.remountHealthcheck=()=>{window.view?.dispose();window.view=HealthcheckRecord.mount(document.querySelector('#root'),{identity:()=>identity,ready:()=>true,can:()=>editable,hospital:()=>window.hospitalFixture||{},request});};remountHealthcheck();view.open();
 });
 return {p,errors};
}
async function start(p,registered=true){await p.locator('[data-action=new]').click();if(registered){await p.locator('[data-start-mode=registered]').click();await p.locator('[data-start-search-form] input').fill('가상');await p.locator('[data-start-search-form] button').click();await p.locator('[data-start-pick="0"]').click();}else{await p.locator('[data-start-field=name]').fill('빠른 환자');await p.locator('[data-start-field=species]').selectOption('dog');}await p.locator('[data-start-submit]').click();await p.locator('[data-hc-editor]').waitFor();}
return {setup,start};
};
