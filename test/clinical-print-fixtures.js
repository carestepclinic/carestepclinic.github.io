const patient={id:'synthetic',name:'합성 검증환자',species:'cat',breed:'코리안 쇼트헤어',birthDate:'2020-02-20',sex:'female',neutered:'yes',weight:4.5,guardianName:'검증 보호자',chartNumber:'PRINT-001'};
const shortReport=new URLSearchParams(location.search).get('length')==='short';
const long=shortReport?'짧은 소견입니다. 관찰한 변화와 재검 계획을 확인합니다.':'진료 당시 확인한 소견과 추후 확인할 사항을 원문 그대로 보존합니다. 기록의 줄바꿈과 중요한 메모가 페이지 사이에서 잘리지 않는지 확인합니다.\n'.repeat(34)+'LONG_NOTE_END';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e1ede7"/><circle cx="300" cy="200" r="120" fill="none" stroke="#45735e" stroke-width="5"/><text x="200" y="210" font-size="32">Synthetic image</text></svg>');
let currentView=null,record,kindNow='',calls=[];const scenario=new URLSearchParams(location.search).get('scenario')||'';
window.open=()=>{const w=parent.document.querySelector('#output').contentWindow;w.document.open();w.document.write('<!doctype html><html><head></head><body></body></html>');w.document.close();return w;};
const options={ready:()=>true,identity:()=> 'print-qa-'+kindNow,preferencesIdentity:()=> 'print-qa-'+kindNow,can:()=>true,medical:()=>true,clinicalManage:()=>true,patient:()=>null,clinicName:()=> '합성 검증 동물병원',request:async(p,o={})=>{
 calls.push({p,...o});const b=o.body?JSON.parse(o.body):null;
 if(p.endsWith('/members'))return {userId:'u',members:[{id:'u',display_name:'검증 수의사'}]};
 if(/images\?/.test(p))return {dataUrl:image};
 if(p.includes('/chronic-context')){const current=record.body.chronicChart,dates=scenario==='history-long'?Array.from({length:12},(_,i)=>'2026-'+String(i%10+1).padStart(2,'0')+'-'+String(i+1).padStart(2,'0')):scenario==='history'?['2026-09-15','2026-10-14','2026-10-15']:scenario==='two-dates'?['2026-10-15']:[];return {items:dates.map((date,i)=>({id:'prior'+i,category:'chronic',date,title:'합성 이전 기록',images:[],chart:{...structuredClone(current),date,medications:'이전 처방 '+i,plan:'이전 계획 '+i,measurements:{creatinine:1.5+i/10,bun:27+i,phosphorus:3.2+i/10}}})),hasMore:false};}
 if(p.includes('/cases/')){if(p.includes('/events')){if(o.method==='POST'){record.revision++;return {revision:record.revision};}return {items:[],next:null};}if(p.endsWith('/sync'))return {revision:record.revision};return {item:structuredClone(record),canManage:true,canRecord:true};}
 if(/\/(neuro|ophthalmic|chronic|dental)\?/.test(p))return {items:[],next:null};
 return {items:[],members:[],next:null};
}};
async function waitFor(fn){for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('fixture timeout');}
window.loadRecord=async function(kind){
 currentView?.dispose();currentView=null;kindNow=kind;calls=[];document.querySelector('#root').replaceChildren();
 const w=window.open(),common={clinic:'합성 검증 동물병원',patient,date:'2026-11-15',veterinarian:'검증 수의사'};
 if(kind==='anesthesia'){
  const t=Date.parse('2026-11-15T00:00:00Z'),at=m=>new Date(t+m*60000).toISOString(),rows=Array.from({length:61},(_,i)=>({recordId:'m'+i,type:'measurement',observedAt:at(i*5),values:{heartRate:i?100+i%20:0,spo2:98,temperature:38-i/100,meanPressure:70+i%10},recorder:{name:'검증 기록자'},note:i===30?long:''}));
  rows.push(...[['anesthesiaStart',0],['intubation',3],['surgeryStart',8],['surgeryEnd',285],['anesthesiaEnd',295],['extubation',300]].map(([marker,m])=>({type:'marker',marker,observedAt:at(m)})),{type:'marker',marker:'medication',observedAt:at(10),note:'실제 투약 사건 · ANESTHESIA_END'});
  if(scenario==='phase-badges'){rows.splice(0,rows.length,...Array.from({length:12},(_,i)=>({type:'measurement',observedAt:at(i*5),values:{heartRate:110+i,respiratoryRate:20+i,etco2:30+i,systolic:110+i,diastolic:60+i,meanPressure:75+i}})),...['anesthesiaStart','intubation','surgeryStart','surgeryEnd','anesthesiaEnd','extubation'].map((marker,i)=>({type:'marker',marker,observedAt:at([0,1,10,31,52,53][i]),recorder:{name:'합성 기록자'}})));}
  w.document.open();w.document.write(AnesthesiaRecord.printDocument({rows,ranges:AnesthesiaRecord.printRanges(rows),item:{patient,body:{species:'cat',weight:4.5}},fieldValues:{operation:'합성 수술',diagnosis:'합성 진단'},administration:()=>''}));w.document.close();await ClinicalPrint.prepare(w,{...common,kind,title:'마취 기록지',landscape:true,summaryHTML:AnesthesiaRecord.printDocument({rows,ranges:AnesthesiaRecord.printRanges(rows),item:{patient,body:{species:'cat',weight:4.5}},detailed:false,bodyOnly:true})});return;
 }
 if(kind==='ward'){
  const dates=['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19'];const entries=dates.flatMap((d,i)=>Array.from({length:7},(_,n)=>({patient:'합성 입원환자 '+n,chart:'W-'+n,at:d+'T09:30:00+09:00',title:'합성 약물 '+n+' · 긴 처치명과 용량 확인을 위한 검증',dose:'0.25 mL · IV',state:i?'예정':'완료',actualAt:i?'':d+'T09:33:00+09:00',recorder:'검증 기록자',note:n===3?'긴 안내문 '.repeat(25):''})));
  entries.push({patient:'이전 환자',title:'이전 미완료 확인',at:'2026-11-14T20:00:00+09:00',state:'지연'});w.document.body.innerHTML='<main>'+ClinicalPrint.wardHTML(entries,dates,{patient:scenario==='patient'})+'</main>';await ClinicalPrint.prepare(w,{...common,kind,title:'입원처치표',landscape:true,patient:{name:'전체 입원환자'}});return;
 }
 if(kind==='healthcheck'){
  const d=HealthcheckRecord.blank(patient);Object.assign(d,{date:'2026-11-15',veterinarian:'검증 수의사',weight:4.5,overview:'첫 장에 표시되는 핵심 소견입니다.\n관리와 재검 안내를 확인하세요.',summary:scenario==='problems'?'[항목 A]\n'+long+'\n[항목 B]\n소견 B_FIND':long,management:scenario==='problems'?'[항목 A]\n실천 방법: A_MANAGE\n[별도 항목]\nUNMATCHED':'저장된 관리 계획입니다.',followup:scenario==='problems'?'[항목 A]\n권고 시점: A_RECHECK\n[항목 B]\n권고 시점: B_RECHECK':'2주 후 재검 예정',questions:'PRIVATE_INTERNAL',labs:Array.from({length:shortReport?4:46},(_,i)=>({id:'l'+i,name:'합성 검사 '+i,value:String(i),unit:'mg/dL',reference:'0–100',group:'생화학 · 신장',confirmed:true})),images:shortReport?[]:[{id:'pic',kind:'ultrasound',dataUrl:image,caption:'검증 사진'}]});
  w.document.open();w.document.write(HealthcheckRecord.reportHTML(d,patient,d.images,{name:common.clinic}).replaceAll(new URL('.',location.href).href,new URL('.',document.baseURI).href));w.document.close();return;
 }
 const mod={neuro:NeuroRecord,ophthalmic:OphthalmicRecord,chronic:ChronicRecord,dental:DentalRecord}[kind];let chart=kind==='dental'?mod.empty():mod.blank(patient,kind==='chronic'?['ckd']:undefined);
 Object.assign(chart,{date:'2026-11-15',time:'09:30',weight:4.5,patient:{...patient},veterinarian:'검증 수의사',clinicalStatus:'complete'});
 if(kind==='neuro')Object.assign(chart,{history:'신경학적 평가를 위한 합성 병력',context:'sedated',medications:'진정 약물 · NEURO_CONTEXT',examNote:'평가 제한 · NEURO_LIMIT',findings:{'position.LF':'normal','position.RF':'delayed','withdrawal.LH':'normal','deepPain.LH':'unable'},localization:['T3-L3'],laterality:'left',assessment:long,plan:'추가 검사 계획 · NEURO_END'});
 if(kind==='ophthalmic')Object.assign(chart,{context:'sedated',medications:'사용 약물 · OPH_CONTEXT',od:{iop:18,stt:14,device:'OD_DEVICE',testNote:'OD_LIMIT'},os:{iop:21,stt:12,device:'OS_DEVICE'},diagnosis:'합성 좌우 검사 소견',plan:long,guardianInstructions:'보호자용 관리 안내 · OPH_GUARDIAN',followupDate:'2026-11-29',images:[{id:'pic',eye:'od',caption:'우안 합성 이미지',dataUrl:image}],prescriptions:[{eye:'od',name:'합성 점안제',amount:'1방울',frequency:'1일 2회',duration:'7일',note:'검증용 기록'}]});
 if(kind==='chronic')Object.assign(chart,{history:'기존 증상과 경과 · CHRONIC_HISTORY',diagnosis:'합성 만성질환 평가',medications:'저장된 처방 내용',diet:'식이 관리 안내',plan:long,followupDate:'2026-11-29',measurements:{creatinine:2.1,bun:30,phosphorus:4.3},images:[{id:'pic',caption:'합성 검사 영상',dataUrl:image}]});
 if(kind==='dental')Object.assign(chart,{technician:'검증 테크니션',diagnosis:'합성 치과 소견',procedure:long,teeth:{'108':{extracted:true,note:scenario==='tooth-note'?long:'시행 발치'},'109':{extractionPlan:true,fractured:true,note:'아직 시행 전'},'104':{gi:2,pockets:{MB:4,DB:3}}},followup:'재검 일정 · DENTAL_END',guardianDraft:'확인된 시행 처치와 관리 안내 · DENTAL_GUARDIAN',images:[]});
 record={id:'sample',revision:1,patient_id:'synthetic',patient,body:{species:'cat',category:kind,[kind==='neuro'?'neuroChart':kind==='ophthalmic'?'ophthalmicChart':kind==='chronic'?'chronicChart':'dentalChart']:chart}};
 currentView=mod.mount(document.querySelector('#root'),options);await currentView.openRecord('sample');await waitFor(()=>document.querySelector(kind==='neuro'?'[data-nr=print]':kind==='dental'?'[data-dn=print]':'[data-act=print]'));
 if(kind==='chronic')await waitFor(()=>document.querySelector('[data-source-coverage]')?.textContent.includes('전체 조회 완료'));
 if(kind==='dental'){
  document.querySelector('[data-dn=print]').click();
 }else document.querySelector(kind==='neuro'?'[data-nr=print]':'[data-act=print]').click();
};
