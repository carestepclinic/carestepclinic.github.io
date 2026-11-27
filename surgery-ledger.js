/* Hospital-private surgical register; shared code contains no hospital records. */
(function(g){'use strict';
const fields=[['date','수술일','Date'],['chartNumber','차트번호','ID'],['patientName','환자명','Name'],['species','동물종','Species'],['breed','품종','Breed'],['age','나이','Age'],['sex','성별','Sex'],['weight','체중 (kg)','B.W. (kg)'],['diagnosis','진단명','Diagnosis'],['procedure','수술명','OP name'],['surgeon','집도의','Surgeon'],['assistant1','제1 보조자','Assistant1'],['assistant2','제2 보조자','Assistant2'],['anesthetist','마취 담당자','Anesthetist'],['anesthetics','마취 방법','Anesthetics'],['drug','마취 약물','Drug']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
const text=v=>String(v??'').trim(),signature=r=>JSON.stringify([...fields.map(([k])=>text(r[k])),text(r.notes)]);
// Normalize only this clinical term; chart IDs, people, units and other wording keep their case.
const injectionFields=new Set(['diagnosis','procedure','anesthetics','drug']);
const normalizeText=(key,value)=>injectionFields.has(key)?text(value).replace(/\binjection\b/gi,'Injection'):text(value);
function normalizeRecord(record){return {...record,...Object.fromEntries([...injectionFields].filter(k=>Object.hasOwn(record,k)).map(k=>[k,normalizeText(k,record[k])]))};}
const recordSignature=record=>JSON.stringify([...fields.map(([key])=>text(record[key])),text(record.notes),text(record.patientId)]);
function caseResolution(variants){if(!Array.isArray(variants)||variants.length<2)return -1;const originals=variants.map(v=>recordSignature(v.record)),normalized=variants.map(v=>recordSignature(normalizeRecord(v.record)));if(new Set(originals).size<2||new Set(normalized).size!==1)return -1;return originals.indexOf(normalized[0]);}
const settings=[['surgeons','집도의'],['assistants','보조자'],['anesthetists','마취 담당자'],['procedures','수술명'],['anesthetics','마취 방법'],['drugs','마취 약물']];
function excelDate(value,date1904=false){const v=text(value);if(/^\d+(\.\d+)?$/.test(v)){const n=Number(v);if(n<1||n>100000)throw Error('수술 날짜를 확인해주세요.');return new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(n)*86400000).toISOString().slice(0,10);}const normalized=v.replace(/[./]/g,'-');const m=normalized.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);if(!m)throw Error('수술 날짜를 확인해주세요.');const d=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');if(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('수술 날짜를 확인해주세요.');return d;}
function groupRows(rows){
 const groups=new Map();for(const x of rows){const original=x.record,r=normalizeRecord(original),key=JSON.stringify([r.date,text(r.chartNumber)||text(r.patientName),text(r.procedure)]);let item=groups.get(key);if(!item){item={sourceKey:JSON.stringify([original.date,text(original.chartNumber)||text(original.patientName),text(original.procedure)]),variants:[]};groups.set(key,item);}const sig=signature(r),v=item.variants.find(v=>signature(v.record)===sig);if(v)v.sources.push(x.source);else item.variants.push({record:r,sources:[x.source]});}
 const all=[...groups.values()],edges=new Map();
 // Only propose cross-sheet matches that differ in one key field. Never silently merge them.
 for(const omitted of ['date','procedure']){const buckets=new Map();for(const item of all){if(item.variants.length!==1||!item.variants[0].record.chartNumber)continue;const r=item.variants[0].record,k=JSON.stringify(fields.filter(([k])=>k!==omitted).map(([k])=>text(r[k])));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(item);}for(const pair of buckets.values()){if(pair.length!==2)continue;const [a,b]=pair,kind=x=>{const names=x.variants[0].sources.map(s=>/^\d{4}$/.test(s.sheet));return names.every(Boolean)?'annual':names.every(x=>!x)?'combined':'mixed';};if(new Set([kind(a),kind(b)]).size!==2||[kind(a),kind(b)].includes('mixed'))continue;for(const [x,y] of [[a,b],[b,a]]){if(!edges.has(x))edges.set(x,new Set());edges.get(x).add(y);}}}
 const used=new Set(),result=[];for(const item of all){if(used.has(item))continue;const neighbors=edges.get(item),other=neighbors?.size===1?[...neighbors][0]:null;if(other&&edges.get(other)?.size===1&&!used.has(other)){const annual=item.variants[0].sources.some(s=>/^\d{4}$/.test(s.sheet))?item:other,combined=annual===item?other:item;result.push({...annual,variants:[...annual.variants,...combined.variants]});used.add(other);}else result.push(item);used.add(item);}return result;
}
async function workbookRows(file){
 if(!/\.xlsx$/i.test(file.name))throw Error('기본 서식의 .xlsx 파일을 선택해주세요.');if(file.size>10000000)throw Error('엑셀 파일은 10MB 이하로 선택해주세요.');
 const bytes=new Uint8Array(await file.arrayBuffer()),dv=new DataView(bytes.buffer);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){end=i;break;}if(end<0)throw Error('엑셀 파일을 읽을 수 없습니다.');
 const entries=new Map(),count=dv.getUint16(end+10,true);if(count>2000)throw Error('파일 내부 항목이 너무 많습니다.');let pos=dv.getUint32(end+16,true),total=0;
 for(let i=0;i<count;i++){if(pos+46>bytes.length||dv.getUint32(pos,true)!==0x02014b50)throw Error('손상된 엑셀 파일입니다.');const method=dv.getUint16(pos+10,true),size=dv.getUint32(pos+20,true),expanded=dv.getUint32(pos+24,true),nl=dv.getUint16(pos+28,true),el=dv.getUint16(pos+30,true),cl=dv.getUint16(pos+32,true),offset=dv.getUint32(pos+42,true),name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nl));total+=expanded;if(total>60000000||expanded>30000000)throw Error('압축 해제 크기가 너무 큽니다.');entries.set(name,{method,size,expanded,offset});pos+=46+nl+el+cl;}
 const xml=async name=>{const e=entries.get(name);if(!e)throw Error('엑셀 내부 자료를 찾을 수 없습니다.');const o=e.offset;if(o+30>bytes.length||dv.getUint32(o,true)!==0x04034b50)throw Error('파일 구조가 올바르지 않습니다.');const start=o+30+dv.getUint16(o+26,true)+dv.getUint16(o+28,true);if(start+e.size>bytes.length)throw Error('파일 내용이 누락되었습니다.');let raw=bytes.slice(start,start+e.size);if(e.method===8){const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>e.expanded||length>30000000){await reader.cancel();throw Error('압축 크기가 일치하지 않습니다.');}parts.push(value);}raw=new Uint8Array(length);let at=0;for(const p of parts){raw.set(p,at);at+=p.length;}}else if(e.method!==0)throw Error('지원하지 않는 엑셀 압축 형식입니다.');if(raw.length!==e.expanded)throw Error('파일 크기가 일치하지 않습니다.');const doc=new DOMParser().parseFromString(new TextDecoder().decode(raw),'application/xml');if(doc.querySelector('parsererror'))throw Error('엑셀 내용을 읽을 수 없습니다.');return doc;};
 const wb=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels'),strings=entries.has('xl/sharedStrings.xml')?[...(await xml('xl/sharedStrings.xml')).getElementsByTagName('si')].map(n=>[...n.getElementsByTagName('t')].map(t=>t.textContent).join('')):[],date1904=['1','true'].includes(wb.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904'));
 const rows=[],errors=[],sheets=[];for(const sheet of wb.getElementsByTagName('sheet')){const rid=sheet.getAttribute('r:id'),rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);if(!rel||rel.getAttribute('TargetMode')==='External')continue;const target=rel.getAttribute('Target'),path=target.startsWith('/')?target.slice(1):'xl/'+target;if(path.includes('..'))throw Error('지원하지 않는 파일 경로입니다.');const doc=await xml(path),name=sheet.getAttribute('name');let columns=null,accepted=0;
  for(const row of doc.getElementsByTagName('row')){const cells={};for(const c of row.getElementsByTagName('c')){const col=c.getAttribute('r').replace(/\d/g,''),v=c.getElementsByTagName('v')[0]?.textContent||'';cells[col]=c.getAttribute('t')==='s'?strings[Number(v)]||'':c.getAttribute('t')==='inlineStr'?[...c.getElementsByTagName('t')].map(t=>t.textContent).join(''):v;}
   if(!Object.values(cells).some(v=>text(v)))continue;
   if(!columns){const found=Object.fromEntries(exportFields.map(([key,label,english])=>[key,Object.keys(cells).find(c=>[label,english,...(key==='anesthetics'?['마취제']:key==='drug'?['사용 약물']:key==='age'?['당시 나이']:key==='weight'?['당시 체중 (kg)']:[])].some(h=>h.toLowerCase()===text(cells[c]).toLowerCase()))]));if(found.date&&found.patientName&&found.procedure){columns=found;}continue;}
   if(['Date','수술일'].includes(text(cells[columns.date])))continue;
   try{const record=Object.fromEntries(exportFields.map(([key])=>[key,text(cells[columns[key]])]));record.date=excelDate(record.date,date1904);if(!record.patientName||!record.procedure)throw Error('환자명·수술명 누락');for(const [key,label] of exportFields){const max=key==='notes'?4000:injectionFields.has(key)?3000:200;if(record[key].length>max)throw Error(label+'은 '+max+'자 이하로 입력해주세요.');}rows.push({record,source:{sheet:name,row:Number(row.getAttribute('r'))}});accepted++;if(rows.length>15000)throw Error('기록은 15,000행까지 읽을 수 있습니다.');}catch(e){errors.push(name+' '+row.getAttribute('r')+'행: '+e.message);}
  }if(columns)sheets.push({name,rows:accepted});else errors.push(name+': 기본 서식의 제목 행을 찾지 못했습니다.');
 }if(!rows.length&&!errors.length)errors.push('입력된 수술 기록이 없습니다. 기본 서식에 내용을 입력한 뒤 다시 선택해주세요.');const groups=groupRows(rows);for(const group of groups){if(group.variants.length>8||group.variants.some(v=>v.sources.length>30))errors.push(group.variants[0].record.patientName+': 비교 원본은 8개, 같은 원본의 위치는 30개까지 가져올 수 있습니다.');}return {rows,groups,sheets,errors};
}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
const exportFields=[...fields,['notes','비고','Notes']];
const identityKeys=['patientId','patientName','chartNumber','species'];
const patientKeys=['patientId','patientName','chartNumber','species','breed','age','sex','weight','diagnosis','procedure','anesthetics','drug','notes'];

function choiceLabel(key,value){return ({species:{Canine:'개 (Canine)',Feline:'고양이 (Feline)'},sex:{IM:'미중성화 수컷 (IM)',CM:'중성화 수컷 (CM)',IF:'미중성화 암컷 (IF)',SF:'중성화 암컷 (SF)',male:'수컷 · 중성화 미확인',female:'암컷 · 중성화 미확인',unknown:'미확인'},anesthetics:{Injection:'주사마취 (Injection)',Inhalation:'흡입마취 (Inhalation)','Injection, Inhalation':'주사·흡입마취'}})[key]?.[value]||value;}
function ageAtDate(birth,date){const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;if(!valid(birth)||!valid(date)||birth>date)return '';const [y,m,d]=date.split('-').map(Number),[by,bm,bd]=birth.split('-').map(Number),n=(y-by)*12+m-bm-(d<bd?1:0);return n<1?'1개월 미만':[n>=12?Math.floor(n/12)+'세':'',n%12?n%12+'개월':''].filter(Boolean).join(' ');}
function patientSource(workspace,date,selected={}){const p=workspace.patient||{},w=workspace.recentWeight,chartNumber=p.chartNumber||p.externalPatientId||(workspace.efriends?.connected?workspace.efriends.externalPatientId:'')||(p.id&&selected.patientId===p.id?selected.chartNumber:'')||'',record={patientId:p.id,patientName:p.name,chartNumber,species:speciesEnglish(p.species)||'',breed:g.ClinicConnections?.breedEnglish(p.breed,p.species)||p.breed||'',sex:g.ClinicConnections?.sexCode(p)||p.sex||'',age:ageAtDate(p.birthDate||'',date)};if(w&&w.value>0&&w.date&&w.date<=date)record.weight=String(w.value);return {record,explicitKeys:['weight'],notice:'나이는 수술일 '+date+' 기준입니다. '+(record.weight?'체중 측정일 '+w.date+' · 수술 당시 체중인지 확인 후 선택하세요.':'수술일 이전의 날짜가 확인되는 체중이 없어 가져오지 않습니다.')};}
function actualAnesthesia(events){const latest=new Map();for(const e of [...events].sort((a,b)=>a.revision-b.revision))if(e.kind==='anesthesia.entry')latest.set(e.body.recordId,e.body);const rows=[...latest.values()].filter(r=>!r.voided),drugs=[...new Set(rows.filter(r=>r.marker==='medication'&&r.administration?.name).map(r=>r.administration.name))],agents=[...new Set(rows.filter(r=>r.marker==='settings'&&r.settings?.agent&&Number(r.settings.concentration)>0).map(r=>r.settings.agent))];return {drug:[...drugs,...agents].filter((v,i,a)=>a.indexOf(v)===i).join(', '),anesthetics:[rows.some(r=>r.marker==='medication'&&/propofol|alfaxalone|ketamine|etomidate|thiopental|프로포폴|알팍살론|케타민/i.test(r.administration?.name||'')&&['IV','IM'].includes(r.administration?.route))?'Injection':'',agents.length?'Inhalation':''].filter(Boolean).join(', ')};}

function sourcePlan(current,incoming,explicitKeys=[]){
 const values=Object.fromEntries(Object.entries(incoming).filter(([,v])=>text(v)!==''));
 let switching=false;
 if(values.patientId&&current.patientId)switching=values.patientId!==current.patientId;
 else if(values.chartNumber&&current.chartNumber)switching=values.chartNumber!==current.chartNumber;
 else if(values.patientName&&current.patientName)switching=values.patientName!==current.patientName;
 const base={...current};
 if(switching)for(const key of patientKeys)base[key]='';
 const changes=Object.entries(values).filter(([key,value])=>text(current[key])!==text(value)).map(([key,value])=>({key,value,previous:current[key]||'',required:identityKeys.includes(key),explicit:explicitKeys.includes(key),checked:!explicitKeys.includes(key)&&(switching||identityKeys.includes(key)||!text(current[key]))}));
 return {switching,base,changes,cleared:switching?patientKeys.filter(key=>text(current[key])&&!Object.hasOwn(values,key)):[]};
}
function applySource(current,incoming,selected,explicitKeys=[]){
 const plan=sourcePlan(current,incoming),result={...plan.base};
 for(const [key,value] of Object.entries(incoming))if(text(value)!==''&&(identityKeys.includes(key)||plan.switching&&!explicitKeys.includes(key)||selected.includes(key)))result[key]=value;
 return result;
}
function periodRange(value,date=today()){
 const from=value==='today'?date:value==='month'?date.slice(0,7)+'-01':value==='year'?date.slice(0,4)+'-01-01':'';
 const to=value==='all'?'':value==='year'?date.slice(0,4)+'-12-31':value==='month'?new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).toISOString().slice(0,10):date;
 return {from,to};
}
function selectedPeriod(from,to,date=today()){
 return ['today','month','year','all'].find(key=>{const range=periodRange(key,date);return range.from===from&&range.to===to;})||'';
}
function verifyPatientIdentity(original,record){
 if(original.patientId&&['patientName','chartNumber'].some(key=>text(original[key])!==text(record[key])))throw Error('연결된 환자 정보가 변경되었습니다. 환자 변경으로 다시 선택해주세요.');
 return record;
}
// XLSX uses inline string cells, including formula-like text and chart IDs with leading zeros.
// ZIP entries are stored without compression, so no third-party workbook library is required.
function workbookBytes(records){
 const xml=v=>esc(String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''));
 const column=i=>{let out='';for(i++;i;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;};
 const rows=[exportFields.map(([,label])=>label),...records.map(r=>exportFields.map(([key])=>r[key]||''))];
 const sheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="17" width="22" customWidth="1"/></cols><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>'<c r="'+column(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData><autoFilter ref="A1:Q'+rows.length+'"/></worksheet>';
 const entries={
  '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="수술대장" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':sheet
 };
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
 for(const [path,contents] of Object.entries(entries)){
  const name=enc.encode(path),data=enc.encode(contents),sum=crc(data),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,sum,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
  const entry=new Uint8Array(46+name.length),cv=new DataView(entry.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);entry.set(name,46);central.push(entry);parts.push(local,data);offset+=local.length+data.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 const out=new Uint8Array(offset+centralSize+end.length);let at=0;for(const part of [...parts,...central,end]){out.set(part,at);at+=part.length;}return out;
}
function printHTML(records,{clinicName='',from='',to=''}={}){
 const columns=[['수술일',9],['환자·기본정보',19],['진단·수술',26],['집도·보조·마취 담당',18],['마취 방법·약물',28]];
 const rows=records.map(r=>{
  const content=exportFields.map(([key])=>text(r[key])).join('\n'),long=content.length>1200||content.split('\n').length>35;
  return '<tr'+(long?' class="sl-print-long"':'')+'><td>'+esc(r.date)+'</td><td><b>'+esc(r.patientName)+'</b><small>'+esc([r.chartNumber,r.species,r.breed,r.age,r.sex,r.weight&&r.weight+'kg'].filter(Boolean).join(' · '))+'</small></td><td><b>'+esc(r.procedure)+'</b><small>'+esc(r.diagnosis)+'</small></td><td>'+esc([r.surgeon&&'집도 '+r.surgeon,r.assistant1&&'보조 '+r.assistant1,r.assistant2&&'보조 '+r.assistant2,r.anesthetist&&'마취 '+r.anesthetist].filter(Boolean).join('\n'))+'</td><td>'+esc(r.anesthetics)+'<small>'+esc(r.drug)+'</small>'+(r.notes?'<small>비고: '+esc(r.notes)+'</small>':'')+'</td></tr>';
 }).join('');
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>수술대장</title><style>'+
  '@font-face{font-family:Pretendard;src:url("./pretendard-variable-1.3.9.woff2") format("woff2");font-display:swap}'+
  '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;font:11pt/1.5 Pretendard,Arial,sans-serif;color:#20323e}h1{font-size:18pt;line-height:1.4;margin:0 0 8px}p{margin:0 0 14px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #bccbc5;padding:8px;overflow-wrap:anywhere;vertical-align:top;white-space:pre-wrap;text-align:left}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}tr.sl-print-long{break-inside:auto;page-break-inside:auto}small{display:block;font-size:10pt;line-height:1.5;margin-top:5px}th{background:#e8f2ef;font-size:11pt;font-weight:600}b{font-weight:600}'+
  '</style></head><body><h1>'+esc(clinicName)+' 수술대장</h1><p>'+records.length+'건 · '+esc(from||'전체 기간')+' ~ '+esc(to||'현재')+'</p><table><colgroup>'+columns.map(([,width])=>'<col style="width:'+width+'%">').join('')+'</colgroup><thead><tr>'+columns.map(([label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></body></html>';
}
const staffFields=['surgeon','assistant1','assistant2','anesthetist'];
const speciesKey=value=>({canine:'dog',dog:'dog','개':'dog','강아지':'dog',feline:'cat',cat:'cat','고양이':'cat'})[text(value).toLowerCase()]||'other';
const speciesEnglish=value=>({dog:'Canine',cat:'Feline'})[speciesKey(value)]||value;
const breedNormalize=value=>String(value||'').toLowerCase().normalize('NFKC').replace(/[\s._'’\-/()]+/g,'');
const breedInitials=value=>[...String(value)].map(ch=>{const n=ch.charCodeAt(0)-0xAC00;return n>=0&&n<=11171?'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(n/588)]:ch;}).join('');
function breedMatches(species,query){
 const q=breedNormalize(query),dict=g.CARESTEP_BREEDS?.[speciesKey(species)]||[];
 return dict.map((item,index)=>({item,index,score:Math.min(...[item.name,item.en,...item.aliases].map(v=>{const n=breedNormalize(v);return !q?9:n===q?0:n.startsWith(q)?1:n.includes(q)?2:breedNormalize(breedInitials(v)).startsWith(q)?3:99;}))})).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||a.index-b.index).slice(0,14).map(x=>x.item);
}
function bookingLabel(item){
 const local=v=>{const n=v?Date.parse(v):NaN;return Number.isFinite(n)?new Date(n+32400000).toISOString().slice(0,16):'';},start=local(item.startAt),end=local(item.endAt);
 const time=start?(end?(start.slice(0,10)===end.slice(0,10)?start.slice(11)+' ~ '+end.slice(11):start.slice(5).replace('T',' ')+' ~ '+end.slice(5).replace('T',' ')):start.slice(11)):'시간 미등록';
 return [time,item.body.patientName||'환자 미연결',item.body.chartNumber?'차트 '+item.body.chartNumber:'차트번호 없음',item.body.title].filter(Boolean).join(' · ');
}
const classificationFields=[['surgeon','집도의'],['diagnosis','진단명'],['procedure','수술명·방법']];
const filterText=value=>text(value).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
function matchingRecord(document,filter={}){
 const records=document.body?.record?[document.body.record]:(document.body?.variants||[]).map(v=>v.record);
 return records.find(record=>classificationFields.every(([key])=>!filterText(filter[key])||filterText(record?.[key]).includes(filterText(filter[key]))));
}
function matchesClassification(document,filter={}){return matchingRecord(document,filter)!==undefined;}
async function filteredPage(fetchPage,cursor,filter={},control={}){
 const scanned=[],seen=new Set();let result,scannedCount=0;
 do{
  if(seen.has(cursor))throw Error('조회가 반복되어 중단했습니다. 다시 조회해주세요.');seen.add(cursor);
  result=await fetchPage(cursor);scanned.push(...result.items);scannedCount+=result.scannedCount??result.items.length;control.progress?.(scannedCount);
  if(result.next&&seen.has(result.next))throw Error('조회가 반복되어 중단했습니다. 다시 조회해주세요.');
  result={...result,items:result.items.filter(item=>matchesClassification(item,filter))};cursor=result.next;
 }while(!result.items.length&&cursor&&(filterText(filter.q)||classificationFields.some(([key])=>filterText(filter[key])))&&!control.stopped?.());
 return {...result,scanned,scannedCount,stopped:!!control.stopped?.()};
}
function classificationChoices(documents){
 const choices=Object.fromEntries(classificationFields.map(([key])=>[key,new Map()]));
 for(const doc of documents)for(const record of doc.body?.record?[doc.body.record]:(doc.body?.variants||[]).map(v=>v.record))for(const [key] of classificationFields){
  for(const value of text(record?.[key]).split(/\r?\n/).map(text).filter(Boolean))if(!choices[key].has(filterText(value)))choices[key].set(filterText(value),value);
 }
 return Object.fromEntries(classificationFields.map(([key])=>[key,[...choices[key].values()].sort((a,b)=>a.localeCompare(b,'ko'))]));
}
function mount(root,a){
 const scope=a.identity(),alive=()=>!disposed&&a.ready()&&scope===a.identity(),editable=()=>a.can('records.edit'),base='/practice/support/ledger';
 let disposed=false,busy=false,dirty=false,page='list',doc=null,items=[],next='',counts={},status='active',q='',from='',to='',preferences=null,preview=null,importAt=0,imported=0,sequence=0;
 let classification={surgeon:'',diagnosis:'',procedure:''},suggestionRecords=[],stopSearch=false,prefsPending=null,prefsAt=0,prefsEpoch=0;
 const currentFilter=()=>({status,q,from,to,...classification});
 let listPosition=null,loadedPages=1,listLoaded=false,listDirty=false,sourceDraft=null,sourceContext=null,pendingSaved=null,savedId='',importResult=null,preferencesSequence=0,settingsSavedPending=false,staffNames=null,staffRequest=null;
 const request=async(path,options)=>{if(!alive())throw Error('병원 또는 계정이 변경되었습니다.');const r=await a.request(path,options);if(!alive())throw Error('병원 또는 계정이 변경되었습니다.');return r;};
 const post=(path,b)=>request(path,{method:'POST',body:JSON.stringify(b)});
 const message=(s,error=false)=>root.querySelectorAll('[data-ledger-message],[data-ledger-feedback]').forEach(n=>{n.textContent=s;n.classList.toggle('sl-error',error);});
 async function run(fn){
  if(busy||!alive())return;busy=true;root.setAttribute('aria-busy','true');
  root.querySelectorAll('button,input,textarea,select').forEach(b=>{b.dataset.wasDisabled=b.disabled?'1':'0';b.disabled=true;});
  try{await fn();}catch(e){if(alive())message(e.message,true);}
  finally{busy=false;if(alive()){root.removeAttribute('aria-busy');root.querySelectorAll('[data-was-disabled]').forEach(b=>{b.disabled=b.dataset.wasDisabled==='1';delete b.dataset.wasDisabled;});}}
 }
 const btn=(action,label,cls='')=>'<button type="button" data-ledger="'+action+'" class="'+cls+'">'+label+'</button>';
 const currentRecord=()=>doc?.body.record||doc?.body.variants?.[0]?.record||{};
 const labelFor=key=>exportFields.find(([k])=>k===key)?.[1]||(key==='patientId'?'등록 환자 연결':key);
 function shell(content){root.className='sl';root.innerHTML='<p data-ledger-message role="status" aria-live="polite"></p>'+content;bind(root);}
 function bind(container){container.querySelectorAll('[data-ledger]').forEach(b=>b.onclick=()=>{if(!busy)void action(b.dataset.ledger,b);});}
 function captureList(){
  if(page!=='list')return;
  const scrolls=[];for(let el=root.parentElement;el;el=el.parentElement)if(el.scrollHeight>el.clientHeight)scrolls.push({el,top:el.scrollTop,left:el.scrollLeft});
  listPosition={scrolls,x:g.scrollX,y:g.scrollY};
 }
 function restoreListPosition(){if(!listPosition)return;for(const {el,top,left} of listPosition.scrolls)if(el.isConnected){el.scrollTop=top;el.scrollLeft=left;}g.scrollTo(listPosition.x,listPosition.y);}
 const listRequest=(cursor,filter=currentFilter(),control={})=>filteredPage(before=>request(base+'?'+new URLSearchParams({status:filter.status,q:filter.q,from:filter.from,to:filter.to,before,...Object.fromEntries(classificationFields.map(([key])=>[key,filter[key]||'']))})),cursor,filter,control);
 async function load(more=false,filter=currentFilter(),revealId=''){
  let r;stopSearch=false;const searching=!!filter.q||classificationFields.some(([key])=>filterText(filter[key]));
  const statusNode=root.querySelector('[data-ledger-message]'),stop=document.createElement('button');
  if(searching&&statusNode){stop.type='button';stop.textContent='검색 중지';stop.onclick=()=>{stopSearch=true;stop.disabled=true;stop.textContent='현재 조회 후 중지';};statusNode.after(stop);}
  try{r=await listRequest(more?next:'',filter,{stopped:()=>stopSearch,progress:n=>{if(searching)message(n+'건 확인 중…');}});}catch(e){throw Error('목록을 불러오지 못했습니다. 이전 결과는 기존 조건의 결과입니다. 다시 검색해주세요. '+e.message);}finally{stop.remove();}
  if(revealId&&!r.items.some(item=>item.id===revealId)){
   const fresh=(await request(base+'/'+revealId)).document;if(fresh?.status==='active')r.items.unshift(fresh);
  }
  const sameScope=['status','q','from','to'].every(key=>filter[key]===currentFilter()[key]);
  suggestionRecords=[...new Map((sameScope?suggestionRecords:[]).concat(r.scanned).map(item=>[item.id,item])).values()];
  classification=Object.fromEntries(classificationFields.map(([key])=>[key,text(filter[key])]));
  ({status,q,from,to}=filter);items=more?[...new Map(items.concat(r.items).map(item=>[item.id,item])).values()]:r.items;
  next=r.next;counts=r.counts;loadedPages=more?loadedPages+1:1;listLoaded=true;page='list';dirty=false;listDirty=false;if(!more)savedId=revealId;list();if(r.stopped&&next)message('검색을 중지했습니다. 더 보기로 이어서 조회할 수 있습니다.');
 }
 function filterInputs(){
  const f=root.querySelector('[data-filter]');if(!f.reportValidity())return null;
  if(f.from.value&&f.to.value&&f.from.value>f.to.value){message('시작일을 종료일 이전으로 선택해주세요.',true);f.from.focus();return null;}
  return {status,q:f.q.value.trim(),from:f.from.value,to:f.to.value,...Object.fromEntries(classificationFields.map(([key])=>[key,f.elements[key].value.trim()]))};
 }
 async function returnList(){
  if(pendingSaved){
   await load(false,{status:'active',q:'',from:'',to:''},pendingSaved);
   pendingSaved=null;listPosition=null;root.querySelector('[data-saved-record]')?.scrollIntoView({block:'nearest'});return;
  }
  if(listDirty){const pages=loadedPages;let cursor='',updated=[],r;for(let i=0;i<pages;i++){r=await listRequest(cursor);updated.push(...r.items);cursor=r.next;if(!cursor)break;}items=updated;suggestionRecords=[...new Map(suggestionRecords.concat(updated).map(item=>[item.id,item])).values()];next=cursor;counts=r.counts;listDirty=false;}
  page='list';dirty=false;sourceDraft=null;list();restoreListPosition();
 }
 function list(){
  const choices=classificationChoices(suggestionRecords),applied=classificationFields.filter(([key])=>classification[key]).map(([key,label])=>label+': '+classification[key]);
  const tools=(editable()&&status==='review'?btn('normalize-case','Injection 표기 정리'):'')+(editable()&&a.can('clinical.settings')?btn('import','엑셀 가져오기')+btn('settings','입력 항목 설정'):'');
  shell('<div class="sl-toolbar"><nav aria-label="수술대장 목록">'+[['active','수술 기록'],['review','시트 비교 필요'],['deleted','휴지통']].map(([key,label])=>'<button type="button" data-ledger="status" data-value="'+key+'" aria-pressed="'+(status===key)+'">'+label+' <b>'+Number(counts[key]||0)+'</b></button>').join('')+'</nav><div>'+btn('refresh','새로고침')+(editable()?btn('new','새 수술 기록','primary'):'')+'</div></div>'+
   '<form data-filter class="sl-filters"><label class="sl-filter-search">검색<input name="q" value="'+esc(q)+'" placeholder="환자·차트번호·수술·담당자"></label><label class="sl-filter-from">시작일<input type="date" name="from" value="'+esc(from)+'"></label><label class="sl-filter-to">종료일<input type="date" name="to" value="'+esc(to)+'"></label>'+classificationFields.map(([key,label])=>'<label class="sl-filter-'+key+'">'+label+'<input name="'+key+'" value="'+esc(classification[key])+'" list="sl-filter-options-'+key+'" placeholder="선택 또는 입력" maxlength="3000" aria-describedby="sl-filter-help"><datalist id="sl-filter-options-'+key+'">'+choices[key].map(value=>'<option value="'+esc(value)+'"></option>').join('')+'</datalist></label>').join('')+'<small id="sl-filter-help">조회된 값에서 선택하거나 직접 입력하세요. 입력한 글자를 포함하며, 모든 조건에 맞는 기록을 찾습니다.</small><button class="sl-filter-submit">검색</button>'+btn('reset','초기화','sl-filter-reset')+'</form>'+
   '<div class="sl-quick" aria-label="기간 선택">'+[['today','오늘'],['month','이번 달'],['year','올해'],['all','전체 기간']].map(([value,label])=>'<button type="button" data-ledger="period" data-value="'+value+'" aria-pressed="'+(selectedPeriod(from,to)===value)+'">'+label+'</button>').join('')+'</div>'+
   '<div class="sl-toolbar sl-list-actions"><small>현재 '+items.length+'건 표시'+(next?' · 다음 기록 있음':'')+(applied.length?'<span class="sl-applied-filters">적용 중 · '+esc(applied.join(' / '))+'</span>':'')+'<span class="sl-count-note">상단 건수는 전체 기록 기준</span></small><div>'+(status==='active'?btn('export','엑셀 저장 (.xlsx)')+btn('print','인쇄'):'')+(tools?'<details class="sl-list-more"><summary>더 보기</summary><div>'+tools+'</div></details>':'')+'</div></div>'+
   '<div class="sl-table-wrap sl-list-wrap"><table class="sl-table sl-list"><thead><tr>'+['수술일','환자·차트번호','진단·수술명','집도의·마취 담당','기록'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+items.map((d,i)=>{
    const r=matchingRecord(d,classification)||d.body.record||d.body.variants?.[0]?.record||{};
    return '<tr'+(d.id===savedId?' class="sl-saved-record" data-saved-record':'')+'><td data-label="수술일">'+esc(r.date)+'</td><td data-label="환자"><b>'+esc(r.patientName)+'</b>'+(d.id===savedId?'<span class="sl-saved-label">방금 저장</span>':'')+'<small>'+esc([r.chartNumber,r.species].filter(Boolean).join(' · '))+'</small></td><td data-label="수술·진단"><b>'+esc(r.procedure)+'</b><small>'+esc(r.diagnosis)+'</small></td><td data-label="담당자">'+esc(r.surgeon||'—')+'<small>마취 '+esc(r.anesthetist||'—')+'</small></td><td class="sl-open"><button type="button" data-ledger="open" data-index="'+i+'" aria-label="'+esc(r.patientName)+' '+esc(r.date)+' '+(d.status==='review'?'비교·선택':'열기')+'">'+(d.status==='review'?'비교·선택':'열기')+'</button></td></tr>';
   }).join('')+'</tbody></table></div>'+
   (!items.length?'<p class="sl-empty">'+(next?'이 구간에는 검색 결과가 없습니다. 다음 기록을 조회해주세요.':q||from||to||applied.length?'조건에 맞는 기록이 없습니다. 검색어·기간·분류 필터를 변경해주세요.':status==='review'?'비교할 기록이 없습니다.':'등록된 기록이 없습니다.')+'</p>':'')+(next?btn('more','다음 기록 더 보기'):'')+
   '<p class="sl-help">체중·나이·약물은 수술 당시 기록입니다.</p>');
  root.querySelector('[data-filter]').oninput=()=>message('조건을 변경했습니다. 검색을 누르면 목록에 적용됩니다.');
  root.querySelector('[data-filter]').onsubmit=e=>{e.preventDefault();if(busy)return;const filter=filterInputs();if(!filter)return;listPosition=null;void run(()=>load(false,filter));};
 }
 const prefKey=k=>({surgeon:'surgeons',assistant1:'assistants',assistant2:'assistants',anesthetist:'anesthetists',procedure:'procedures',anesthetics:'anesthetics',drug:'drugs'})[k];
 function input(k,r){
  const max=k==='notes'?4000:injectionFields.has(k)?3000:200;
  const label=labelFor(k),required=['date','patientName','procedure'].includes(k),pref=prefKey(k),long=injectionFields.has(k)||k==='notes',readonly=!editable()||(r.patientId&&['patientName','chartNumber'].includes(k))?' readonly':'',value=r[k]||'';
  if(k==='sex'&&editable()&&doc.status!=='deleted'){
   const values=['IM','CM','IF','SF'];if(value&&!values.includes(value))values.push(value);
   return '<label><span>성별</span><select name="sex"><option value="">선택</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(choiceLabel('sex',v))+'</option>').join('')+'</select></label>';
  }
  if(['anesthetics','drug','species',...staffFields].includes(k)&&editable()&&doc.status!=='deleted')return '<div class="'+(['anesthetics','drug'].includes(k)?'sl-wide ':'')+'sl-choice-field" data-choice-field="'+k+'"><label for="sl-choice-'+k+'">'+label+'</label><select id="sl-choice-'+k+'" data-choice="'+k+'" aria-label="'+label+' 선택"></select><div data-choice-values="'+k+'" class="sl-choice-values"></div>'+(long?'<textarea name="'+k+'" maxlength="3000" rows="2" aria-label="'+label+' 직접입력" hidden>'+esc(value)+'</textarea>':'<input name="'+k+'" maxlength="200" aria-label="'+label+' 직접입력" value="'+esc(value)+'" hidden>')+'</div>';
  if(k==='breed'&&editable()&&doc.status!=='deleted')return '<div class="sl-breed-field"><label for="sl-breed-input">품종</label><input id="sl-breed-input" name="breed" value="'+esc(value)+'" maxlength="200" placeholder="한글·영문 품종 검색" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sl-breed-results" autocomplete="off"><div id="sl-breed-results" role="listbox" aria-label="품종 검색 결과" hidden></div></div>';
  let control=long?'<textarea name="'+k+'" maxlength="'+max+'" rows="2"'+(required?' required':'')+readonly+'>'+esc(value)+'</textarea>':'<input name="'+k+'" maxlength="'+max+'" type="'+(k==='date'?'date':'text')+'" value="'+esc(value)+'"'+(required?' required':'')+(pref?' list="sl-'+pref+'"':'')+(k==='weight'?' inputmode="decimal"':'')+readonly+'>';
  if(long&&pref&&preferences?.[pref]?.length&&editable())control+='<select data-preset="'+k+'" aria-label="'+label+' 자주 쓰는 항목"><option value="">자주 쓰는 '+label+' 추가</option>'+preferences[pref].map(v=>'<option>'+esc(v)+'</option>').join('')+'</select>';
  return '<label class="'+(long?'sl-wide':'')+'"><span>'+label+(required?' <span class="sl-required">필수</span>':'')+'</span>'+control+'</label>';
 }
 const choiceDefaults={species:['Canine','Feline'],anesthetics:['Injection','Inhalation'],drug:['Propofol','Ketamine, medetomidine']};
 const choiceValues=key=>staffFields.includes(key)?staffNames||[]:key==='species'?choiceDefaults.species:[...new Set([...choiceDefaults[key],...(preferences?.[prefKey(key)]||[])].filter(v=>v&&v!=='__custom__'&&!(key==='drug'&&['ketamine','medetomidine'].includes(text(v).toLowerCase()))))];
 function drugParts(value){
  const parts=text(value).split(/[,\n]/).map(text).filter(Boolean),result=[];
  for(let i=0;i<parts.length;i++){if(parts[i]==='Ketamine'&&parts[i+1]==='medetomidine'){result.push('Ketamine, medetomidine');i++;}else result.push(parts[i]);}
  return result;
 }
 function syncChoice(key){
  const field=root.querySelector('[data-choice-field="'+key+'"]');if(!field)return;
  const select=field.querySelector('[data-choice]'),input=field.querySelector('[name]'),values=choiceValues(key),parts=key==='drug'?drugParts(input.value):[],shown=key==='species'?speciesEnglish(input.value):input.value,known=key!=='drug'?values.includes(shown):parts.every(v=>values.includes(v));
  const custom=field.dataset.custom==='1'||!!input.value&&!known;
  input.hidden=!custom;
  select.innerHTML='<option value="">'+(key==='drug'?'약물 추가 선택':'선택')+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(choiceLabel(key,v))+'</option>').join('')+'<option value="__custom__">직접입력</option>';
  select.value=key!=='drug'?(custom?'__custom__':shown):custom?'__custom__':'';
  const selected=field.querySelector('[data-choice-values]');selected.replaceChildren();
  if(key==='drug'&&!custom)selected.innerHTML=parts.map((v,i)=>'<span class="sl-choice-tag">'+esc(v)+'<button type="button" data-choice-remove="'+i+'" aria-label="'+esc(v)+' 삭제">×</button></span>').join('');
  selected.querySelectorAll('[data-choice-remove]').forEach(button=>button.onclick=()=>{if(busy)return;parts.splice(Number(button.dataset.choiceRemove),1);input.value=parts.join(', ');changedChoice(input);});
  if(custom&&input.matches('textarea'))grow(input);
 }
 function changedChoice(input){syncChoice(input.name);if(input.name==='species')updateBreedSpecies();dirty=true;message('저장하지 않은 변경사항이 있습니다.');}
 function bindChoices(){
  root.querySelectorAll('[data-choice]').forEach(select=>{const key=select.dataset.choice;syncChoice(key);select.onchange=()=>{
   if(busy)return;const field=select.closest('[data-choice-field]'),input=field.querySelector('[name]'),value=select.value;
   if(value==='__custom__'){field.dataset.custom='1';syncChoice(key);input.focus();return;}
   if(key!=='drug'){field.dataset.custom='0';input.value=value;changedChoice(input);return;}
   if(!value)return;const parts=drugParts(input.value);if(parts.includes(value)){syncChoice(key);return;}
   const next=[input.value,value].filter(Boolean).join(', ');if(next.length>3000){message('마취 약물은 3000자 이하로 입력해주세요.',true);syncChoice(key);return;}
   input.value=next;changedChoice(input);
  };});
 }
 async function loadStaffChoices(){
  const notice=root.querySelector('[data-staff-notice]');if(!notice||!editable()||doc.status==='deleted')return;
  if(staffNames){for(const key of staffFields)syncChoice(key);return;}
  notice.textContent='직원 목록을 불러오는 중입니다.';
  if(!staffRequest)staffRequest=request('/members').then(r=>{staffNames=[...new Set((r.members||[]).filter(m=>m.status==='active').map(m=>text(m.displayName||m.email)).filter(Boolean))];}).finally(()=>staffRequest=null);
  try{await staffRequest;if(!alive()||!notice.isConnected)return;for(const key of staffFields)syncChoice(key);notice.textContent=staffNames.length?'':'등록된 직원이 없습니다. 직접입력으로 작성할 수 있습니다.';}
  catch(e){if(alive()&&notice.isConnected){notice.innerHTML='직원 목록을 불러오지 못했습니다. 직접입력으로 작성할 수 있습니다. '+btn('retry-staff','직원 다시 조회');bind(notice);}}
 }
 function updateBreedSpecies(){
  const input=root.querySelector('#sl-breed-input'),form=root.querySelector('[data-record]');if(!input||!form)return;
  const next=speciesKey(form.elements.species.value);if(input.dataset.species!==next){input.value='';input.dataset.species=next;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('blur'));}
 }
 function bindBreedSearch(){
  const input=root.querySelector('#sl-breed-input'),form=root.querySelector('[data-record]');if(!input||!form)return;
  const list=root.querySelector('#sl-breed-results'),field=input.closest('.sl-breed-field');let matches=[],active=-1;
  input.dataset.species=speciesKey(form.elements.species.value);
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const select=index=>{if(busy||!matches[index])return;input.value=matches[index].en;dirty=true;close();message('저장하지 않은 변경사항이 있습니다.');input.focus();close();};
  const render=()=>{if(busy)return;matches=breedMatches(form.elements.species.value,input.value);active=-1;input.removeAttribute('aria-activedescendant');list.innerHTML=matches.map((item,i)=>'<button type="button" role="option" tabindex="-1" id="sl-breed-'+i+'" data-breed-index="'+i+'" aria-selected="false">'+esc(item.name)+' · '+esc(item.en)+'</button>').join('')||'<p>'+(!g.CARESTEP_BREEDS?'품종 목록을 불러오지 못했습니다. 직접입력할 수 있습니다.':speciesKey(form.elements.species.value)==='other'?'Canine 또는 Feline을 선택하면 품종을 검색할 수 있습니다.':'검색 결과가 없습니다. 직접입력할 수 있습니다.')+'</p>';list.hidden=false;input.setAttribute('aria-expanded','true');list.querySelectorAll('[data-breed-index]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>select(Number(b.dataset.breedIndex));});};
  input.onfocus=render;input.oninput=render;input.onblur=close;
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){close();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(list.hidden)render();if(!matches.length)return;active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;list.querySelectorAll('[role=option]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant','sl-breed-'+active);list.querySelector('#sl-breed-'+active)?.scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(active>=0)select(active);}};
 }
 async function prefs({force=true}={}){
  if(force){prefsEpoch++;prefsPending=null;}else {if(prefsPending)return prefsPending;if(preferences&&Date.now()-prefsAt<30000)return preferences;}
  const epoch=prefsEpoch,task=request(base+'/preferences').then(result=>{if(alive()&&epoch===prefsEpoch){preferences=result;prefsAt=Date.now();}return result;});
  prefsPending=task;try{return await task;}finally{if(prefsPending===task)prefsPending=null;}
 }
 function read(){const f=root.querySelector('[data-record]');if(!f)return currentRecord();const r={...currentRecord()};for(const [k] of exportFields)r[k]=f.elements[k].value;return verifyPatientIdentity(currentRecord(),r);}
 function grow(el){el.style.height='auto';el.style.height=Math.min(260,Math.max(72,el.scrollHeight+2))+'px';}
 function bindPresets(form){
  root.querySelectorAll('[data-preset]').forEach(select=>select.onchange=()=>{if(!select.value)return;const input=form.elements[select.dataset.preset],lines=input.value.split('\n');if(!lines.includes(select.value))input.value=[input.value,select.value].filter(Boolean).join('\n');select.value='';grow(input);dirty=true;message('항목을 추가했습니다. 저장해주세요.');input.focus();});
 }
 async function loadRecordPreferences(){
  const form=root.querySelector('[data-record]'),notice=root.querySelector('[data-preferences-notice]'),token=++preferencesSequence;
  if(!form||!notice)return;notice.textContent='자주 쓰는 항목을 불러오는 중입니다.';
  try{
   const loaded=await prefs({force:false});if(!alive()||!form.isConnected||token!==preferencesSequence)return;preferences=loaded;
   for(const [key] of settings){const list=root.querySelector('#sl-'+key);if(list)list.innerHTML=(preferences[key]||[]).map(v=>'<option value="'+esc(v)+'"></option>').join('');}
   for(const key of ['procedure']){
    let select=form.querySelector('[data-preset="'+key+'"]');const values=preferences[prefKey(key)]||[];
    if(!editable()||doc.status==='deleted'||!values.length){select?.remove();continue;}
    if(!select){form.elements[key].insertAdjacentHTML('afterend','<select data-preset="'+key+'" aria-label="'+labelFor(key)+' 자주 쓰는 항목"></select>');select=form.querySelector('[data-preset="'+key+'"]');if(busy){select.disabled=true;select.dataset.wasDisabled='0';}}
    select.innerHTML='<option value="">자주 쓰는 '+labelFor(key)+' 추가</option>'+values.map(v=>'<option>'+esc(v)+'</option>').join('');
   }
   bindPresets(form);for(const key of ['anesthetics','drug'])syncChoice(key);notice.replaceChildren();
  }catch(e){if(alive()&&form.isConnected&&token===preferencesSequence){notice.innerHTML='<p>자주 쓰는 항목을 불러오지 못했습니다. 수술 기록은 그대로 확인할 수 있습니다.</p>'+btn('retry-record-prefs','입력 항목 다시 조회');bind(notice);}}
 }
 function edit(){
  const r=currentRecord(),canEdit=editable()&&doc.status!=='deleted';page='edit';preferencesSequence++;clearSource();
  const groups=[['환자 정보',['date','chartNumber','patientName','species','breed','age','sex','weight']],['수술 내용',['diagnosis','procedure']],['참여 인력',['surgeon','assistant1','assistant2','anesthetist']],['마취·약물',['anesthetics','drug','notes']]];
  shell('<div class="sl-toolbar"><div><strong class="sl-heading">'+(doc.id?'수술 기록':'새 수술 기록')+'</strong></div><div>'+btn('back','목록으로')+(canEdit?btn('save','저장','primary'):'')+(editable()&&doc.id?'<details class="sl-more"><summary>더 보기</summary>'+btn(doc.status==='deleted'?'restore':'delete',doc.status==='deleted'?'복원':'휴지통으로 이동',doc.status==='deleted'?'':'sl-danger')+'</details>':'')+'</div></div>'+
   '<div data-preferences-notice role="status"></div>'+
   (doc.status==='deleted'?'<p class="sl-help">휴지통의 기록입니다. 복원 후 수정할 수 있습니다.</p>':'')+
   (canEdit?'<details class="sl-card sl-loader"'+(!doc.id&&!r.patientId?' open':'')+'><summary><span><strong>환자·기록 불러오기</strong><small>'+esc(r.patientId?'연결 환자 · '+[r.patientName,r.chartNumber].filter(Boolean).join(' · '):doc.id?'기존 수술 기록 · 필요할 때 환자나 기록을 연결하세요.':'환자 연결 없이도 작성할 수 있습니다.')+'</small></span><span class="sl-loader-state"><span class="sl-when-closed">펼치기</span><span class="sl-when-open">접기</span></span></summary><div class="sl-loader-body"><form data-source-search class="sl-source"><label>환자 검색<input data-patient-q placeholder="환자명·차트번호"></label>'+btn('patients','환자 검색')+btn('booking','수술일 일정')+btn('bundle','진단·수술 묶음')+(a.can('clinical.anesthesia.read')?'<button type="button" data-ledger="anesthesia"'+(!r.patientId?' disabled title="등록 환자를 먼저 연결해주세요."':'')+'>마취 기록</button>':'')+'</form>'+(!r.patientId&&a.can('clinical.anesthesia.read')?'<small>환자를 연결하면 마취 기록을 불러올 수 있습니다.</small>':'')+(r.patientId?'<div class="sl-link-actions">'+btn('unlink-patient','연결 해제 후 직접 입력')+'</div>':'')+'<div data-source-results></div><div data-source-preview></div></div></details>':'')+
   '<form data-record><fieldset '+(!canEdit?'disabled':'')+'>'+groups.map(([title,keys])=>'<section class="sl-card"><div class="sl-panel-heading"><h3>'+title+'</h3>'+(title==='참여 인력'?'<small data-staff-notice role="status"></small>':'')+(title==='환자 정보'&&r.patientId?'<div class="sl-linked-patient"><small>연결 환자 · '+esc(r.patientName)+' · '+esc(r.chartNumber||'차트번호 없음')+'</small>'+(canEdit?btn('change-patient','환자 변경'):'')+'</div>':'')+'</div><div class="sl-grid '+(keys.includes('diagnosis')?'sl-clinical-grid':'')+'">'+keys.map(k=>input(k,r)).join('')+'</div></section>').join('')+'</fieldset></form>'+
   (canEdit?'<div class="sl-savebar"><small data-ledger-feedback>입력 후 저장해주세요.</small><div>'+btn('save-new','저장 후 새 기록')+btn('save-list','저장 후 목록','primary')+'</div></div>':'')+
   settings.map(([key])=>'<datalist id="sl-'+key+'">'+(preferences?.[key]||[]).map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist>').join('')+
   (doc.body.variants?'<details class="sl-original"><summary>가져온 원본·선택 이력</summary><p>'+esc(doc.body.sourceFile)+' · '+(doc.body.selected!==undefined?'원본 '+(doc.body.selected+1)+' 선택 · '+esc(doc.body.resolvedAt?.slice(0,10)):'원본 보존')+'</p>'+compareTable(doc.body.variants)+'</details>':''));
  const form=root.querySelector('[data-record]');form.onsubmit=e=>{e.preventDefault();void run(()=>save());};
  const invalidateBooking=()=>{if(sourceContext&&form.elements.date.value!==sourceContext.date)clearSource('수술일이 변경되었습니다. 불러올 자료를 다시 조회해주세요.');};
  form.oninput=e=>{dirty=true;invalidateBooking();if(e.target.matches('textarea'))grow(e.target);if(e.target.matches('[name]')&&e.target.closest('[data-choice-field]')){e.target.closest('[data-choice-field]').dataset.custom='1';syncChoice(e.target.name);if(e.target.name==='species')updateBreedSpecies();}message('저장하지 않은 변경사항이 있습니다.');};
  form.elements.date.onchange=invalidateBooking;
  root.querySelectorAll('[data-record] textarea').forEach(grow);
  bindPresets(form);bindChoices();bindBreedSearch();void loadStaffChoices();
  const search=root.querySelector('[data-source-search]');if(search)search.onsubmit=e=>{e.preventDefault();void run(()=>source('patients'));};
  const patientQuery=root.querySelector('[data-patient-q]');if(patientQuery)patientQuery.oninput=patientQuery.onchange=()=>{if(sourceContext?.kind==='patients'&&patientQuery.value.trim()!==sourceContext.query)clearSource('검색어가 변경되었습니다. 환자 검색을 다시 눌러주세요.');};
 }
 function compareTable(variants){return '<div class="sl-table-wrap"><table class="sl-table sl-compare"><thead><tr><th>항목</th>'+variants.map(v=>'<th>'+v.sources.map(s=>esc(s.sheet)+' · '+s.row+'행').join('<br>')+'</th>').join('')+'</tr></thead><tbody>'+exportFields.map(([k,label])=>{const different=new Set(variants.map(v=>normalizeText(k,v.record[k]))).size>1;return '<tr class="'+(different?'sl-difference':'')+'"><th>'+label+(different?' · 차이':'')+'</th>'+variants.map(v=>'<td>'+esc(v.record[k]||'—')+'</td>').join('')+'</tr>';}).join('')+'</tbody></table></div>';}
 function compare(){
  const variants=doc.body.variants,caseIndex=caseResolution(variants),differences=exportFields.filter(([k])=>new Set(variants.map(v=>normalizeText(k,v.record[k]))).size>1),r=currentRecord();page='compare';
  shell('<div class="sl-toolbar"><div><strong class="sl-heading">원본 비교 · '+esc(r.patientName)+'</strong><small>'+esc([r.date,r.chartNumber,r.procedure].filter(Boolean).join(' · '))+'</small></div>'+btn('back','목록으로')+'</div>'+
   '<p>서로 다른 '+differences.length+'개 항목을 먼저 표시합니다. 확정 후에도 원본은 보존됩니다.</p>'+
   (caseIndex>=0?'<p class="sl-help">Injection의 대소문자 표기만 다릅니다. 통일해 저장할 수 있습니다.</p>':'')+
   differences.map(([k,label])=>'<section class="sl-card sl-difference"><h3>'+label+'</h3><div class="sl-diff-values">'+variants.map(v=>'<div><small>'+v.sources.map(s=>esc(s.sheet)+' · '+s.row+'행').join(', ')+'</small><p>'+esc(v.record[k]||'—')+'</p></div>').join('')+'</div></section>').join('')+
   (editable()&&caseIndex<0?'<fieldset class="sl-variant-choice"><legend>사용할 원본</legend>'+variants.map((v,i)=>'<label class="sl-check"><input type="radio" name="ledger-variant" value="'+i+'">'+esc(v.sources[0].sheet)+' 내용 선택</label>').join('')+'</fieldset>':'')+
   (editable()?'<div class="sl-toolbar sl-resolve-actions"><div>'+(caseIndex>=0?btn('resolve-case','Injection으로 통일해 저장')+btn('resolve-case-next','통일 후 다음 비교','primary'):btn('resolve','선택한 원본 확정')+btn('resolve-next','확정 후 다음 비교','primary'))+'</div>'+(caseIndex<0&&new Set(variants.map(v=>JSON.stringify([v.record.date,v.record.chartNumber,v.record.procedure]))).size===variants.length?btn('resolve-all','서로 다른 수술 · 모두 보관'):'')+'</div>':'')+
   '<details class="sl-original"><summary>전체 원본 '+variants.length+'개 보기</summary>'+compareTable(variants)+'</details>');
 }
 async function newRecord(date=today()){doc={status:'active',body:{record:{date}},revision:0};dirty=false;edit();void loadRecordPreferences();root.querySelector('[data-patient-q]')?.focus();}
 async function save(destination='edit'){
  if(!editable()||doc.status==='deleted')return;const f=root.querySelector('[data-record]');if(!f.reportValidity())return;
  const isNew=!doc.id,origin=doc.connectionContext;doc=(await post(base+(doc.id?'/'+doc.id:''),{record:normalizeRecord(read()),revision:doc.revision})).document;if(isNew)await g.ClinicConnections?.created('ledger',doc.id,doc.body.record.patientId,origin);dirty=false;listDirty=true;if(isNew||pendingSaved===doc.id)pendingSaved=doc.id;
  edit();
  try{if(destination==='list')await returnList();else if(destination==='new')await newRecord(currentRecord().date);}
  catch(e){message('저장은 완료되었습니다. '+(destination==='new'?'새 기록을 준비하지 못했습니다. 목록에서 새 수술 기록을 눌러주세요.':'목록을 불러오지 못했습니다. 목록으로 버튼을 다시 눌러주세요.')+' '+e.message,true);return;}
  message(destination==='new'?'저장했습니다. 새 기록을 작성해주세요.':'저장했습니다.');
 }
 async function normalizeCaseReviews(){
  const candidates=(await allResults()).filter(d=>d.status==='review'&&caseResolution(d.body.variants)>=0);if(!candidates.length){message('현재 검색 범위에 Injection 대소문자만 다른 기록이 없습니다.');return;}
  let done=0;try{for(const item of candidates){await post(base+'/'+item.id+'/resolve',{revision:item.revision,selected:caseResolution(item.body.variants)});done++;message(done+' / '+candidates.length+'건 표기 정리 중');if(done<candidates.length)await new Promise(resolve=>setTimeout(resolve,1250));}await load();message(done+'건을 Injection으로 통일해 저장했습니다. 원본과 출처는 보존했습니다.');}
  catch(e){await load();message(done+'건 정리 완료 · 나머지는 변경하지 않았습니다. '+e.message,true);}
 }
 async function nextReview(resolvedId){
  items=items.filter(item=>item.id!==resolvedId);const seen=new Set();
  for(;;){
   const candidate=items.find(item=>item.status==='review');
   if(candidate){const fresh=(await request(base+'/'+candidate.id)).document;if(fresh.status==='review'){doc=fresh;compare();message('이전 기록을 확정했습니다. 다음 기록을 비교해주세요.');return;}items=items.filter(item=>item.id!==candidate.id);continue;}
   if(!next)break;if(seen.has(next))throw Error('목록 조회가 반복되었습니다. 새로고침해주세요.');seen.add(next);
   const result=await listRequest(next);items=items.concat(result.items);next=result.next;counts=result.counts;loadedPages++;
  }
  await returnList();message('현재 조회한 비교 작업을 마쳤습니다.');
 }
 async function resolveRecord(selected,advance=false){
  const id=doc.id;doc=(await post(base+'/'+id+'/resolve',{revision:doc.revision,selected})).document;listDirty=true;
  const normalized=normalizeRecord(doc.body.record);if(recordSignature(normalized)!==recordSignature(doc.body.record)){
   try{doc=(await post(base+'/'+id,{record:normalized,revision:doc.revision})).document;}
   catch(e){doc.body.record=normalized;dirty=true;edit();throw Error('원본 선택은 저장되었습니다. Injection 표기 변경을 저장하지 못했으니 저장 버튼을 다시 눌러주세요. '+e.message);}
  }
  dirty=false;if(advance){edit();try{await nextReview(id);}catch(e){message('확정은 저장되었습니다. 다음 기록을 불러오지 못했습니다. 목록에서 다시 확인해주세요. '+e.message,true);}return;}edit();message(doc.body.keptSeparate?'각 원본을 별도 수술 기록으로 보관했습니다.':'선택한 기록을 저장했습니다. 원본은 보존했습니다.');
 }
 function confirmLeave(){return !dirty||g.confirm('저장하지 않은 입력을 버리고 목록으로 돌아갈까요?');}
 function importScreen(){
  page='import';shell('<div class="sl-toolbar"><strong class="sl-heading">엑셀 수술대장 가져오기</strong>'+btn('back','목록으로')+'</div><section class="sl-card"><p><b>'+esc(a.clinicName?.()||a.hospital?.().name||'현재 병원')+'</b>에 등록합니다.</p><p>기본 서식 또는 수술대장에서 저장한 .xlsx 파일을 선택해주세요. 비고도 함께 가져옵니다.</p>'+btn('template','기본 서식 다운로드 (.xlsx)')+'<label class="sl-file">수술대장 엑셀<input type="file" accept=".xlsx" data-ledger-file></label><div data-import-preview></div></section>');
  root.querySelector('[data-ledger-file]').onchange=e=>{const file=e.target.files[0];if(!file||busy)return;preview=null;root.querySelector('[data-import-preview]').replaceChildren();void run(async()=>{
   preview={...await workbookRows(file),file:file.name};importAt=0;imported=0;const conflicts=preview.groups.filter(x=>x.variants.length>1).length,errors=preview.errors||[];
   const target=root.querySelector('[data-import-preview]');target.innerHTML='<p>읽은 기록 '+preview.rows.length+'행 · 중복 정리 후 <b>'+preview.groups.length+'건</b> · 비교 필요 <b>'+conflicts+'건</b></p>'+
    '<ul>'+preview.sheets.map(s=>'<li>'+esc(s.name)+' · '+s.rows+'행</li>').join('')+'</ul>'+
    (errors.length?'<div class="sl-import-errors"><h3>수정이 필요한 항목 '+errors.length+'개</h3><p>오류를 수정한 파일을 다시 선택해주세요. 아직 등록하지 않았습니다.</p><ol>'+errors.slice(0,10).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ol>'+btn('import-errors','전체 오류 내역 저장')+'</div>':'')+
    (!errors.length&&preview.groups.length?'<p>같은 파일에서 이미 등록한 기록은 건너뜁니다. 내용이 다른 기록은 비교 목록에 보관합니다.</p><label class="sl-check"><input type="checkbox" data-import-confirm> 현재 병원에 등록할 자료임을 확인했습니다.</label>'+btn('commit-import','이 병원에 가져오기','primary'):'');bind(target);message(errors.length?'오류를 확인하고 파일을 수정해주세요.':'파일 분석 완료. 아직 등록하지 않았습니다.',!!errors.length);
  });};
 }
 async function commitImport(){
  if(!preview||preview.errors?.length||!a.can('clinical.settings')||!root.querySelector('[data-import-confirm]')?.checked){message('등록할 병원을 확인해주세요.',true);return;}
  for(;importAt<preview.groups.length;){const batch=preview.groups.slice(importAt,importAt+25),r=await post(base+'/import',{file:preview.file,items:batch});imported+=r.inserted;importAt+=batch.length;message(importAt+' / '+preview.groups.length+'건 확인 · 신규 등록 '+imported+'건');if(importAt<preview.groups.length)await new Promise(resolve=>setTimeout(resolve,1250));}
  const n=imported,total=preview.groups.length,conflicts=preview.groups.filter(x=>x.variants.length>1).length;
  importResult={status:conflicts?'review':'active',message:'가져오기 완료 · 신규 '+n+'건 · 이미 등록 '+(total-n)+'건'+(conflicts?' · 비교 목록을 확인해주세요.':' · 수술 기록에서 확인할 수 있습니다.')};
  preview=null;dirty=false;page='import-complete';
  shell('<section class="sl-card"><h3>엑셀 등록 완료</h3><p>'+esc(importResult.message)+'</p>'+btn('import-result',conflicts?'비교 목록 다시 조회':'수술 기록 다시 조회','primary')+'</section>');
  try{await showImportResult();}catch(e){message('등록은 완료되었습니다. 목록을 불러오지 못했습니다. 다시 조회해주세요. '+e.message,true);}
 }
 async function showImportResult(){
  if(!importResult)return;const result=importResult;await load(false,{status:result.status,q:'',from:'',to:''});listPosition=null;importResult=null;message(result.message);
 }
 function bundleRow(b={}){return '<div class="sl-grid sl-bundle"><label>묶음 이름<input data-bundle="name" maxlength="100" value="'+esc(b.name||'')+'"></label><label>진단명<textarea data-bundle="diagnosis" maxlength="3000">'+esc(b.diagnosis||'')+'</textarea></label><label>수술명<textarea data-bundle="procedure" maxlength="3000">'+esc(b.procedure||'')+'</textarea></label>'+btn('remove-bundle','묶음 삭제')+'</div>';}
 async function configuration(){await prefs();settingsSavedPending=false;page='settings';shell('<div class="sl-toolbar"><strong class="sl-heading">우리 병원 입력 항목</strong><div>'+btn('back','목록으로')+btn('save-settings','설정 저장','primary')+'<button type="button" data-ledger="reload-saved-settings" hidden>저장한 설정 다시 조회</button></div></div><p>한 줄에 하나씩 입력하세요. 목록에 없는 내용도 직접 입력할 수 있습니다.</p><form data-settings class="sl-card sl-grid sl-settings">'+settings.map(([key,label])=>'<label>'+label+'<textarea name="'+key+'" rows="6">'+esc(preferences[key].join('\n'))+'</textarea></label>').join('')+'</form><section class="sl-card"><h3>진단·수술 묶음</h3><p>자주 쓰는 진단과 수술명을 함께 저장합니다. 약물·용량은 포함하지 않습니다.</p><div data-bundles>'+ (preferences.bundles||[]).map(bundleRow).join('')+'</div>'+btn('add-bundle','묶음 추가')+'</section>');root.querySelector('[data-settings]').oninput=()=>dirty=true;root.querySelector('[data-bundles]').oninput=()=>dirty=true;}
 async function reloadSavedSettings(){
  try{await configuration();message('우리 병원 설정을 저장했습니다.');}
  catch(e){
   root.querySelectorAll('[data-settings] textarea,[data-ledger="save-settings"]').forEach(el=>{el.disabled=true;el.removeAttribute('data-was-disabled');});
   const retry=root.querySelector('[data-ledger="reload-saved-settings"]');if(retry)retry.hidden=false;
   message('설정은 저장되었습니다. 화면을 갱신하지 못했습니다. 저장한 설정 다시 조회를 눌러주세요. '+e.message,true);
  }
 }
 function clearSource(notice=''){
  sequence++;sourceContext=null;sourceDraft=null;
  const results=root.querySelector('[data-source-results]');if(results)results.textContent=notice;
  root.querySelector('[data-source-preview]')?.replaceChildren();
 }
 function sourceIsCurrent(context){
  return !!context&&context===sourceContext&&context.token===sequence&&alive()&&page==='edit'&&context.results.isConnected&&
   (root.querySelector('[data-record]')?.elements.date.value===context.date)&&
   (context.kind!=='patients'||root.querySelector('[data-patient-q]')?.value.trim()===context.query);
 }
 function checkSource(){
  if(sourceIsCurrent(sourceContext))return true;
  clearSource('조회 조건이 변경되었습니다. 자료를 다시 조회해주세요.');return false;
 }
 function showSourcePreview(candidate){
  if(!checkSource())return;
  const current=read(),plan=sourcePlan(current,candidate.record,candidate.explicitKeys);sourceDraft={candidate,before:recordSignature(current),plan};const container=root.querySelector('[data-source-preview]');
  container.innerHTML='<section class="sl-source-review"><h3>'+esc(candidate.label)+' · 적용할 내용</h3>'+
   (plan.switching?'<p class="sl-warning">환자가 변경됩니다. 이전 환자의 진단·수술·마취·약물·비고와 기본정보를 비운 뒤 선택한 정보를 반영합니다.</p>':'<p>기존 입력은 유지합니다. 바꿀 항목만 선택해주세요.</p>')+
   (candidate.notice?'<p class="sl-help">'+esc(candidate.notice)+'</p>':'')+'<div class="sl-source-changes">'+plan.changes.map(change=>'<label class="sl-source-change"><span><input type="checkbox" data-source-field="'+change.key+'"'+(change.checked?' checked':'')+(change.required||plan.switching&&!change.explicit?' disabled':'')+'>'+labelFor(change.key)+'</span><small>현재: '+esc(change.key==='patientId'?(change.previous?'연결됨':'연결 안 됨'):(change.previous||'비어 있음'))+'</small><span>불러오기: '+esc(change.key==='patientId'?'선택한 환자 연결':change.value)+'</span></label>').join('')+'</div>'+
   (plan.cleared.length?'<p class="sl-help">비워지는 항목: '+plan.cleared.map(labelFor).join(', ')+'</p>':'')+
   (!plan.changes.length?'<p>현재 입력과 같습니다.</p>':'')+'<div class="sl-toolbar"><div>'+btn('cancel-source','취소')+btn('apply-source',plan.switching?'환자 변경 후 적용':'선택한 내용 적용','primary')+'</div></div></section>';bind(container);container.scrollIntoView({block:'nearest'});
 }
 async function source(kind){
  if(!editable()||doc.status==='deleted')return;const current=read(),results=root.querySelector('[data-source-results]');if(!results)return;
  clearSource();message('');const query=root.querySelector('[data-patient-q]').value.trim(),context={kind,query,date:current.date,token:sequence,results};sourceContext=context;let candidates=[];
  try{
  if(kind==='patients'){
   if(!a.can('patients.read'))throw Error('환자 조회 권한이 필요합니다.');if(!query)throw Error('검색어를 입력해주세요.');
   const r=await request('/patient-directory?'+new URLSearchParams({q:query,active:'active',pageSize:'20',limit:'20',page:'1'}));candidates=(r.patients||[]).map(p=>({label:[p.name,p.chartNumber||p.externalPatientId,p.guardianName].filter(Boolean).join(' · '),patientId:p.id,record:{patientId:p.id,patientName:p.name,chartNumber:p.chartNumber||p.externalPatientId||'',species:speciesEnglish(p.species)||''}}));
  }
  if(kind==='bundle'){await prefs({force:false});candidates=(preferences?.bundles||[]).map(b=>({label:b.name,record:{diagnosis:b.diagnosis,procedure:b.procedure},notice:'우리 병원 진단·수술 묶음입니다. 환자에게 해당하는 내용만 선택해주세요.'}));}
  if(kind==='booking'){
   if(!current.date)throw Error('수술일을 먼저 선택해주세요.');const r=await request('/practice/support/bookings?day='+encodeURIComponent(current.date));candidates=(r.items||[]).filter(x=>x.status!=='cancelled').map(x=>({label:bookingLabel(x),record:{patientId:x.body.patientId||'',patientName:x.body.patientName||'',chartNumber:x.body.chartNumber||'',procedure:x.body.title||''}}));
  }
  if(kind==='anesthesia'){
   if(!current.patientId)throw Error('등록 환자를 먼저 연결해주세요.');const r=await request('/practice/clinical/cases?closed=1&patientId='+encodeURIComponent(current.patientId));candidates=(r.items||[]).filter(x=>x.kind==='surgery').map(x=>{const s=x.body.anesthesiaSheet||{};return {caseId:x.id,label:[s.date||x.created_at?.slice(0,10),s.operation||x.body.title].filter(Boolean).join(' · '),record:Object.fromEntries(Object.entries({date:s.date,diagnosis:s.diagnosis,procedure:s.operation,surgeon:s.surgeon,assistant1:s.assistant1,assistant2:s.assistant2,anesthetist:s.anesthetist,breed:g.ClinicConnections?.breedEnglish(s.breed,x.body.species)||s.breed,age:s.age,sex:g.ClinicConnections?.sexCode({sex:s.sex})||s.sex,weight:x.body.weight==null?'':String(x.body.weight)}).filter(([,v])=>v!==undefined&&v!==''))};});
  }
  if(!sourceIsCurrent(context)){if(sourceContext===context)checkSource();return;}
  results.innerHTML=candidates.map((c,i)=>'<button type="button" data-candidate="'+i+'">'+esc(c.label)+'</button>').join('')||'<p>해당 자료가 없습니다.</p>';
  results.querySelectorAll('[data-candidate]').forEach(b=>b.onclick=()=>{if(busy||!sourceIsCurrent(context))return;void run(async()=>{let candidate={...candidates[Number(b.dataset.candidate)]};
    if(candidate.patientId){const w=await request('/patients/'+encodeURIComponent(candidate.patientId)+'/workspace');if(w.patient?.id!==candidate.patientId)throw Error('환자 연결을 다시 확인해주세요.');candidate={...candidate,...patientSource(w,context.date,candidate.record)};}
    if(candidate.caseId){const detail=await request('/practice/clinical/cases/'+encodeURIComponent(candidate.caseId)),item=detail.item;if(!item||item.patient_id!==current.patientId||item.kind!=='surgery')throw Error('마취 기록의 환자를 다시 확인해주세요.');let after=0,events=[];for(let n=0;;n++){if(n>=200)throw Error('마취 기록이 많아 직접 확인이 필요합니다.');const r=await request('/practice/clinical/cases/'+encodeURIComponent(item.id)+'/anesthesia?after='+after+'&through='+item.revision);events.push(...r.events);if(!r.hasMore)break;if(!Number.isInteger(r.next)||r.next<=after)throw Error('마취 기록 조회가 중단됐습니다. 다시 조회해주세요.');after=r.next;}const sheet=item.body.anesthesiaSheet||{};candidate.record=Object.fromEntries(Object.entries({date:sheet.date,diagnosis:sheet.diagnosis,procedure:sheet.operation,surgeon:sheet.surgeon,assistant1:sheet.assistant1,assistant2:sheet.assistant2,anesthetist:sheet.anesthetist,breed:g.ClinicConnections?.breedEnglish(sheet.breed,item.body.species)||sheet.breed,age:sheet.age,sex:g.ClinicConnections?.sexCode({sex:sheet.sex})||sheet.sex,weight:item.body.weight==null?'':String(item.body.weight),...actualAnesthesia(events)}).filter(([,v])=>v!==undefined&&v!==''));candidate.notice='마취 기록 '+(item.body.anesthesiaSheet?.date||item.created_at?.slice(0,10))+' · 실제 투약·흡입 설정 기록만 가져옵니다. 투약 대기·취소·용량은 제외하며, 마취 외 투약이 포함될 수 있어 선택 전 확인해주세요.';candidate.explicitKeys=['drug','anesthetics'];}
    if(sourceIsCurrent(context))showSourcePreview(candidate);});});
  }catch(e){
   if(!sourceIsCurrent(context)){if(sourceContext===context)checkSource();return;}
   const retry=kind==='patients'?'환자 검색':kind==='booking'?'수술일 일정':kind==='bundle'?'진단·수술 묶음':'마취 기록';
   clearSource('자료를 불러오지 못했습니다. '+retry+' 버튼을 다시 눌러주세요.');throw e;
  }
 }
 async function allResults(){let cursor='',out=[],seen=new Set();do{const r=await listRequest(cursor);out.push(...r.items);cursor=r.next;if(cursor&&seen.has(cursor))throw Error('조회가 반복되어 중단했습니다.');seen.add(cursor);}while(cursor);return out;}
 function download(name,type,data){const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function downloadWorkbook(records,name){download(name,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',workbookBytes(records));}
 async function output(print){if(status!=='active')throw Error('수술 기록 탭에서만 엑셀 저장·인쇄할 수 있습니다.');const data=await allResults();const records=data.filter(d=>d.status==='active'&&d.body.record).map(d=>d.body.record);if(!records.length)throw Error('출력할 수술 기록이 없습니다. 검색어·기간·분류 필터를 확인해주세요.');if(!print){downloadWorkbook(records,'수술대장.xlsx');message('현재 검색 조건의 수술 기록 '+records.length+'건을 엑셀로 저장했습니다.');return;}
  const frame=document.createElement('iframe');frame.className='sl-print-frame';frame.title='수술대장 인쇄';document.body.append(frame);const d=frame.contentDocument;
  d.open();d.write(printHTML(records,{clinicName:a.clinicName?.()||'',from,to}));d.close();
  try{if(d.fonts?.ready)await d.fonts.ready;if(!alive())return;frame.contentWindow.focus();frame.contentWindow.print();}
  finally{setTimeout(()=>frame.remove(),60000);}

 }
 async function action(key,b){
  if(key==='retry-staff'){void loadStaffChoices();return;}
  if(key==='retry-record-prefs'){void loadRecordPreferences();return;}
  if(key==='refresh'&&root.querySelector('[data-filter]')){const filter=filterInputs();if(!filter)return;await run(async()=>{await load(false,filter);listPosition=null;});return;}
  if(['export','print'].includes(key)){
   if(status!=='active')return;const filter=filterInputs();if(!filter)return;
   await run(async()=>{if(Object.keys(filter).some(key=>filter[key]!==currentFilter()[key])){await load(false,filter);listPosition=null;}await output(key==='print');});return;
  }
  if(key==='change-patient'){if(!editable())return;const loader=root.querySelector('.sl-loader');loader.open=true;loader.scrollIntoView({block:'nearest'});root.querySelector('[data-patient-q]').focus();return;}
  if(['save','save-list','save-new'].includes(key)&&!root.querySelector('[data-record]').reportValidity())return;
  if(key==='back'){if(!confirmLeave())return;dirty=false;preview=null;await run(returnList);return;}
  if(['new','open','import','settings'].includes(key))captureList();
  await run(async()=>{switch(key){
   case 'new':await newRecord();break;
   case 'refresh':case 'more':await load(key==='more');break;
   case 'status':listPosition=null;await load(false,{...currentFilter(),status:b.dataset.value});break;
   case 'reset':listPosition=null;await load(false,{status,q:'',from:'',to:''});break;
   case 'period':{const range=periodRange(b.dataset.value),form=root.querySelector('[data-filter]');listPosition=null;await load(false,{status,q:form.q.value.trim(),...Object.fromEntries(classificationFields.map(([key])=>[key,form.elements[key].value.trim()])),...range});break;}
   case 'open':doc=(await request(base+'/'+items[+b.dataset.index].id)).document;if(doc.status==='review')compare();else{edit();void loadRecordPreferences();}break;
   case 'save':case 'save-list':case 'save-new':await save(key==='save-list'?'list':key==='save-new'?'new':'edit');break;
   case 'delete':case 'restore':if(!editable()||!g.confirm(key==='delete'?'이 수술 기록을 휴지통으로 이동할까요?':'이 기록을 복원할까요?'))break;await post(base+'/'+doc.id+'/'+key,{revision:doc.revision});if(pendingSaved===doc.id)pendingSaved=null;dirty=false;listDirty=true;await returnList();message(key==='delete'?'휴지통으로 이동했습니다. 휴지통에서 복원할 수 있습니다.':'복원했습니다.');break;
   case 'normalize-case':if(editable()&&status==='review')await normalizeCaseReviews();break;
   case 'resolve-case':case 'resolve-case-next':if(editable()&&caseResolution(doc.body.variants)>=0)await resolveRecord(caseResolution(doc.body.variants),key.endsWith('-next'));break;
   case 'resolve':case 'resolve-next':case 'resolve-all':{
    if(!editable())break;const selected=key==='resolve-all'?'all':root.querySelector('[name=ledger-variant]:checked')?.value;
    if(selected===undefined){message('사용할 원본을 선택해주세요.',true);root.querySelector('[name=ledger-variant]')?.focus();break;}
    if(selected==='all'&&!g.confirm('각 원본을 별도 수술 기록으로 보관할까요?'))break;
    await resolveRecord(selected==='all'?'all':Number(selected),key==='resolve-next');break;
   }
   case 'import':if(editable()&&a.can('clinical.settings'))importScreen();break;
   case 'commit-import':await commitImport();break;
   case 'import-result':await showImportResult();break;
   case 'template':downloadWorkbook([],'수술대장_기본서식.xlsx');message('기본 서식을 저장했습니다. 수술일·환자명·수술명은 필수입니다.');break;
   case 'import-errors':if(preview?.errors?.length)download('수술대장_가져오기_오류.txt','text/plain;charset=utf-8',preview.errors.join('\r\n'));break;
   case 'settings':if(editable()&&a.can('clinical.settings'))await configuration();break;
   case 'add-bundle':if(a.can('clinical.settings')){const el=root.querySelector('[data-bundles]');if(el.children.length>=50)throw Error('묶음은 50개까지 저장할 수 있습니다.');el.insertAdjacentHTML('beforeend',bundleRow());bind(el);dirty=true;}break;
   case 'remove-bundle':if(a.can('clinical.settings')){b.closest('.sl-bundle').remove();dirty=true;}break;
   case 'save-settings':{
    if(!editable()||!a.can('clinical.settings')||settingsSavedPending)break;const f=root.querySelector('[data-settings]'),body={revision:preferences.revision};
    for(const [k] of settings)body[k]=[...new Set(f.elements[k].value.split('\n').map(v=>normalizeText(({procedures:'procedure',anesthetics:'anesthetics',drugs:'drug'})[k]||k,v)).filter(Boolean))];
    body.bundles=[...root.querySelectorAll('.sl-bundle')].map(row=>Object.fromEntries(['name','diagnosis','procedure'].map(k=>[k,row.querySelector('[data-bundle="'+k+'"]').value.trim()])));if(body.bundles.some(b=>!b.name||!b.procedure))throw Error('묶음 이름과 수술명을 입력해주세요.');
    await post(base+'/preferences',body);dirty=false;settingsSavedPending=true;await reloadSavedSettings();break;
   }
   case 'reload-saved-settings':if(settingsSavedPending&&editable()&&a.can('clinical.settings'))await reloadSavedSettings();break;
   case 'unlink-patient':{
    if(!editable()||!g.confirm('환자 연결을 해제하고 직접 입력할까요? 수술 기록의 입력 내용은 유지됩니다.'))break;
    doc.body.record={...read(),patientId:''};dirty=true;edit();message('환자 연결을 해제했습니다. 입력 내용을 확인한 뒤 저장해주세요.');break;
   }
   case 'bundle':case 'patients':case 'booking':case 'anesthesia':await source(key);break;
   case 'cancel-source':sourceDraft=null;root.querySelector('[data-source-preview]').replaceChildren();break;
   case 'apply-source':{
    if(!sourceDraft||!editable()||!checkSource())break;const current=read(),candidate=sourceDraft.candidate;
    if(recordSignature(current)!==sourceDraft.before){showSourcePreview(candidate);message('입력 내용이 변경되었습니다. 적용할 항목을 다시 확인해주세요.');break;}
    const selected=[...root.querySelectorAll('[data-source-field]:checked')].map(x=>x.dataset.sourceField);doc.body.record=applySource(current,candidate.record,selected,candidate.explicitKeys);dirty=true;edit();message('선택한 내용을 반영했습니다. 확인 후 저장해주세요.');break;
   }
  }});
 }
 const unload=e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};g.addEventListener('beforeunload',unload);
 return {
  connectionContext:()=>page==='edit'&&doc?.id?{kind:'ledger',id:doc.id,patientId:currentRecord().patientId,dirty:dirty||busy}:null,
  async fromConnection(c,id){if(busy)return false;if(dirty&&!g.confirm('작성 중인 수술대장 입력을 버리고 연결 기록을 열까요?'))return false;if(id){const r=await request(base+'/'+encodeURIComponent(id));doc=r.document;if(doc.body.record?.patientId!==c.patient.id)throw Error('같은 환자의 수술대장을 선택해주세요.');dirty=false;}else{doc={status:'active',revision:0,connectionContext:c,body:{record:g.ClinicConnections.ledgerDraft(c)}};dirty=true;}edit();void loadRecordPreferences();message(id?'연결 기록을 열었습니다.':'원본 내용을 확인하고 저장해주세요.');return true;},
  async open(){if(!alive()||dirty||busy)return;if(root.childNodes.length&&(listLoaded||page!=='list')){if(page==='list')g.requestAnimationFrame(()=>{if(alive()&&root.isConnected&&root.getClientRects().length&&page==='list')restoreListPosition();});return;}if(!root.childNodes.length)shell('<p>수술대장을 불러오는 중입니다.</p>'+btn('refresh','다시 조회'));await run(()=>load());},
  leave(){if(busy)return false;captureList();return true;},
  dispose(){disposed=true;sequence++;g.removeEventListener('beforeunload',unload);preview=null;sourceDraft=null;listPosition=null;pendingSaved=null;importResult=null;items=[];suggestionRecords=[];doc=null;root.replaceChildren();}
 };
}
g.SurgeryLedger={matchesClassification,filteredPage,classificationChoices,choiceLabel,ageAtDate,patientSource,actualAnesthesia,mount,fields,excelDate,groupRows,workbookRows,workbookBytes,csvCell,normalizeRecord,caseResolution,sourcePlan,applySource,periodRange,selectedPeriod,verifyPatientIdentity,printHTML,bookingLabel,speciesKey,breedMatches};
})(typeof window==='undefined'?globalThis:window);
