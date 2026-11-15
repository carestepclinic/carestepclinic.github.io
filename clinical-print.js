/* Print snapshots only. No patient writes, external services, or inferred clinical findings. */
(function(g){
 'use strict';
 const version='20261115-content-optimized',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cssText=v=>JSON.stringify(String(v??'')).replace(/</g,'\\3c ').replace(/[\r\n\f]/g,' ');
 const base=()=>new URL('.',document.baseURI).href;
 function age(birth,date){if(!/^\d{4}-\d{2}-\d{2}$/.test(birth||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';const [y,m,d]=date.split('-').map(Number),[by,bm,bd]=birth.split('-').map(Number),n=(y-by)*12+m-bm-(d<bd?1:0);return n<0?'':n<1?'1개월 미만':[n>=12?Math.floor(n/12)+'세':'',n%12?n%12+'개월':''].filter(Boolean).join(' ');}
 function identity(o){if(o.aggregate)return [['조회 대상',o.patient?.name||'전체 입원환자'],['출력 기간',o.period||o.date]].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v||'미기록')+'</dd></div>').join('');const p=o.patient||{},sex=p.sexLabel||({male:'수컷',female:'암컷'}[p.sex]||''),neutered=p.neutered==='yes'?'중성화':p.neutered==='no'?'미중성화':'';return [['환자명',p.name],['차트번호',p.chartNumber||p.externalPatientId],['보호자',p.guardianName],['동물종·품종',[{dog:'개',cat:'고양이'}[p.species]||p.species,p.breed].filter(Boolean).join(' · ')],['성별·나이',[sex,sex.includes('중성화')?'':neutered,p.age||age(p.birthDate,o.date)].filter(Boolean).join(' · ')],['체중',p.weight!=null&&p.weight!==''?p.weight+' kg':''],['진료일',[o.date,o.time].filter(Boolean).join(' ')],[o.technician?'담당자':'담당 수의사',[o.veterinarian,o.technician?'테크니션 '+o.technician:''].filter(Boolean).join(' · ')]].map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+esc(v||'미기록')+'</dd></div>').join('');}
 function header(o,mode){return '<header class="cp-heading"><p class="cp-clinic">'+esc(o.clinic||'')+'</p><h1>'+esc(o.title)+'</h1><p class="cp-document-mode">'+({full:'전체 기록',summary:'핵심 요약',guardian:'보호자 안내'}[mode]||'전체 기록')+(o.status&&mode!=='guardian'?' · '+esc(o.status):'')+'</p><dl class="cp-identity">'+identity(o)+'</dl></header>';}
 function blocks(rows){return rows.filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()).map(([title,value])=>'<section class="cp-note"><h2>'+esc(title)+'</h2><p>'+esc(value)+'</p></section>').join('');}
 function trend(label,unit,points){
  const valid=points.filter(p=>p.value!==''&&p.value!=null&&Number.isFinite(Number(p.value))&&Number.isFinite(Date.parse(p.date))).slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));if(valid.length<3)return '';
  const values=valid.map(p=>Number(p.value)),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1,start=Date.parse(valid[0].date),period=Date.parse(valid.at(-1).date)-start||1,coords=valid.map(p=>[38+(Date.parse(p.date)-start)/period*244,65-(Number(p.value)-lo)/span*42]);
  const labels=new Set([0,valid.length-1]);let lastX=38;for(let i=1;i<valid.length-1;i++)if(coords[i][0]-lastX>=65&&282-coords[i][0]>=65){labels.add(i);lastX=coords[i][0];}
  return '<figure class="cp-trend"><figcaption>'+esc(label)+' · '+esc(unit)+'</figcaption><svg viewBox="0 0 320 110" role="img" aria-label="'+esc(label+' 기록 추이 · 실제 날짜 간격')+'"><path d="'+coords.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+'" fill="none" stroke="currentColor" stroke-width="2"/>'+coords.map(([x,y],i)=>'<circle cx="'+x+'" cy="'+y+'" r="3"><title>'+esc(valid[i].date+' · '+values[i]+' '+unit)+'</title></circle>'+(labels.has(i)?'<text x="'+x+'" y="'+(y-9)+'" text-anchor="middle">'+esc(values[i])+'</text><text x="'+x+'" y="97" text-anchor="'+(i===0?'start':i===valid.length-1?'end':'middle')+'">'+esc(valid[i].date)+'</text>':'')).join('')+'</svg><p class="cp-trend-values">'+valid.map((p,i)=>esc(p.date+' · '+values[i]+' '+unit)).join(' / ')+'</p></figure>';
 }
 // Remove legacy page/screen rules while retaining chart and diagram styling.
 function stripAtRules(css){let out='',i=0;while(i<css.length){const m=/@(media|page)\b[^{}]*\{/.exec(css.slice(i));if(!m){out+=css.slice(i);break;}const start=i+m.index;out+=css.slice(i,start);let j=start+m[0].length,depth=1,quote='';for(;j<css.length&&depth;j++){const c=css[j];if(quote){if(c===quote&&css[j-1]!=='\\')quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}')depth--;}i=j;}return out;}
 function wardHTML(entries,dates,options={}){
  const stamp=at=>{const n=Date.parse(at);return Number.isFinite(n)?new Date(n+32400000).toISOString():'';};
  const dated=entries.filter(e=>dates.includes(stamp(e.at).slice(0,10))&&!e.prn),other=entries.filter(e=>!dated.includes(e));
  if(options.patient){
   const time=(at,day)=>{const v=stamp(at);return v?(v.slice(0,10)===day?v.slice(11,16):v.slice(0,16).replace('T',' ')):'—';};
   const table=(list,day)=>'<table class="cp-patient-tasks"><thead><tr>'+['예정 시각','처치 내용','지시량·경로','상태','실시 시각','담당·수행자'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+list.slice().sort((a,b)=>(stamp(a.at)||'z').localeCompare(stamp(b.at)||'z')).map(e=>'<tr><th>'+esc(time(e.at,day))+'</th><td>'+esc(e.title)+(e.note?'<p class="cp-task-note">메모 '+esc(e.note)+'</p>':'')+'</td><td>'+esc(e.dose||'—')+'</td><td>'+esc(e.state||'미기록')+'</td><td>'+esc(time(e.actualAt,day))+'</td><td>'+esc([e.assignee?'담당 '+e.assignee:'',e.recorder?'수행 '+e.recorder:''].filter(Boolean).join('\n')||'미기록')+'</td></tr>').join('')+'</tbody></table>';
   return dates.map(day=>{const list=dated.filter(e=>stamp(e.at).slice(0,10)===day);return '<section class="cp-patient-day"><h2>'+esc(day)+' · 처치 기록</h2>'+(list.length?table(list,day):'<p class="cp-empty">예정 없음</p>')+'</section>';}).join('')+(other.length?'<section><h2>이전 미완료·필요 시 처치·시간 미지정</h2>'+table(other,'')+'</section>':'');
  }

  const time=(at,day)=>{const value=stamp(at);return value?(day&&value.slice(0,10)===day?value.slice(11,16):value.slice(0,16).replace('T',' ')):'';};
  const card=(e,day)=>'<article class="cp-task"><p class="cp-task-patient"><b>'+esc(e.patient||'환자 미기록')+'</b>'+(e.chart?' <span>· '+esc(e.chart)+'</span>':'')+'</p><p class="cp-task-title">'+esc(e.title)+(e.dose?' · 지시량 '+esc(e.dose):'')+'</p><p class="cp-task-state">'+esc(e.state||'미기록')+(e.at?' · 예정 '+esc(time(e.at,day)):'')+(e.actualAt?' · 실시 '+esc(time(e.actualAt,day)):'')+'</p>'+((e.recorder||e.assignee)?'<p class="cp-task-staff">'+(e.recorder?'수행 '+esc(e.recorder):'담당 '+esc(e.assignee))+'</p>':'')+(e.note?'<p>메모 '+esc(e.note)+'</p>':'')+'</article>';
  let html='';for(let offset=0;offset<dates.length;offset+=3){const batch=dates.slice(offset,offset+3);html+='<section class="cp-ward-period"><h2>입원처치표 · '+esc(batch[0])+(batch.length>1?' ~ '+esc(batch.at(-1)):'')+'</h2><table class="cp-ward-table"><colgroup><col style="width:25mm">'+batch.map(()=>'<col>').join('')+'</colgroup><thead><tr><th>시간</th>'+batch.map(d=>'<th>'+esc(d)+'</th>').join('')+'</tr></thead><tbody>';
   const byHour=Array.from({length:24},(_,hour)=>batch.map(day=>dated.filter(e=>{const s=stamp(e.at);return s.slice(0,10)===day&&Number(s.slice(11,13))===hour;})));
   for(let hour=0;hour<24;hour++){const groups=byHour[hour];if(groups.every(a=>!a.length)){let end=hour;while(end<23&&byHour[end+1].every(a=>!a.length))end++;html+='<tr class="cp-empty-period"><th>'+String(hour).padStart(2,'0')+':00'+(end>hour?'–'+String(end).padStart(2,'0')+':59':'–'+String(hour).padStart(2,'0')+':59')+'</th>'+batch.map(()=>'<td><span class="cp-empty">예정 없음</span></td>').join('')+'</tr>';hour=end;continue;}const count=Math.max(1,...groups.map(a=>a.length));for(let n=0;n<count;n++)html+='<tr><th>'+String(hour).padStart(2,'0')+':00'+(n?' · 계속':'')+'</th>'+groups.map((a,i)=>'<td>'+(a[n]?card(a[n],batch[i]):n?'':'<span class="cp-empty">예정 없음</span>')+'</td>').join('')+'</tr>';}
   html+='</tbody></table></section>';
  }if(other.length)html+='<section class="cp-ward-exceptions"><h2>이전 미완료·필요 시 처치·시간 미지정</h2>'+other.map(e=>card(e,'')).join('')+'</section>';return html;
 }
 function organize(root,kind){
  if(kind==='neuro'){
   const main=root.querySelector('main');if(!main)return;const anchor=[...main.querySelectorAll('h2')].find(n=>n.textContent==='검사 결과'),assessment=root.ownerDocument.createElement('div');assessment.className='cp-assessment';if(!anchor)return;
   const context=root.ownerDocument.createElement('section');context.className='cp-neuro-context';
   for(const h of [...main.querySelectorAll('h2')])if(['주증상·발병·경과','복용약·진정·검사 제한','검사 메모'].includes(h.textContent)){const part=root.ownerDocument.createElement('section'),p=h.nextElementSibling;part.className='cp-note'+(p?.textContent.length<180?' cp-brief':'');part.append(h);if(p?.tagName==='P')part.append(p);context.append(part);}if(context.childElementCount)main.prepend(context);
   for(const h of [...main.querySelectorAll('h2')])if(['병변 위치','판단·감별진단','검사·치료·재검 계획'].includes(h.textContent)){const block=root.ownerDocument.createElement('section'),p=h.nextElementSibling;block.className='cp-note';block.append(h);if(p?.tagName==='P')block.append(p);assessment.append(block);}if(anchor&&assessment.childElementCount)anchor.before(assessment);
  }
  if(kind==='dental'){
   const main=root.querySelector('.dn-print-page'),summary=main?.querySelector('.dn-print-summary'),chart=main?.querySelector('.dn-chart');
   if(summary&&chart){const detail=root.ownerDocument.createElement('section');detail.className='cp-dental-detail';for(const p of [...summary.children])if(['진단·소견','시행 처치','재검 계획'].includes(p.querySelector('b')?.textContent)&&(p.querySelector('b')?.textContent!=='진단·소견'||p.textContent.length>200)){detail.append(p);}chart.after(detail);}
   const empty=[];for(const section of root.querySelectorAll('.dn-print-notes>section'))if(section.querySelector('p')?.textContent.trim()==='미기록'){empty.push(section.querySelector('h2').textContent);section.remove();}
   if(empty.length){const p=root.ownerDocument.createElement('p');p.className='cp-unrecorded';p.textContent='미기록: '+empty.join(' · ');root.querySelector('.dn-print-notes')?.append(p);}
   const tables=[...root.querySelectorAll('.dn-findings-grid table')];if(tables.length>1){const first=tables[0];for(const other of tables.slice(1)){first.querySelector('tbody').append(...other.querySelectorAll('tbody>tr'));other.remove();}}
  }
  if(kind==='anesthesia')for(const charts of root.querySelectorAll('.ap-charts')){
   const blank=[];for(const chart of charts.querySelectorAll('.ap-chart'))if(!chart.querySelector('circle')){blank.push(chart.querySelector('h3').textContent);chart.remove();}
   if(blank.length){const p=root.ownerDocument.createElement('p');p.className='cp-unrecorded';p.textContent='미측정: '+blank.join(' · ');charts.after(p);}
   const items=[...charts.children];for(let i=0;i<items.length;i+=2){const row=root.ownerDocument.createElement('div');row.className='cp-chart-row';row.append(...items.slice(i,i+2));charts.append(row);}
  }
 }
 function galleries(root){
  for(const gallery of root.querySelectorAll('.photos,.dn-print-images')){
   const figures=[...gallery.querySelectorAll('figure')];if(!figures.length){gallery.remove();continue;}
   gallery.classList.add('cp-gallery');gallery.classList.toggle('cp-gallery-single',figures.length===1);
   if(!gallery.previousElementSibling?.matches('h2')){const h=root.ownerDocument.createElement('h2');h.textContent='검사 사진';gallery.before(h);}
   figures.forEach((figure,i)=>{let caption=figure.querySelector('figcaption');if(!caption){caption=root.ownerDocument.createElement('figcaption');figure.append(caption);}const label=root.ownerDocument.createElement('b');label.textContent='사진 '+(i+1)+' · ';caption.prepend(label);const img=figure.querySelector('img');if(img&&!img.alt)img.alt='사진 '+(i+1);});
  }
 }
 function lowResolution(root){const seen=new Set();for(const img of root.querySelectorAll('img')){if(/^data:image\/svg|\.svg(?:[?#]|$)/i.test(img.src))continue;const width=img.offsetWidth,height=img.offsetHeight;if(!width||!height)continue;const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);if(Number.isFinite(scale)&&96/scale<150)seen.add(img.src);}return seen.size;}
 async function prepare(win,o={}){
  if(!win||win.closed)return;const d=win.document,asset=n=>new URL(n,base()).href;
  const legacy=[...d.querySelectorAll('style')].map(s=>stripAtRules(s.textContent)).join('\n');
  const snapshot=d.createElement('div');snapshot.className='cp-record cp-'+(o.kind||'record');
  for(const el of [...d.body.children])if(!el.matches('style,script,.ap-controls,.dn-print-toolbar,.record-print-toolbar,.toolbar'))snapshot.append(el.cloneNode(true));
  snapshot.querySelectorAll('button,input,select,script,style').forEach(n=>n.remove());
  for(const el of snapshot.querySelectorAll('[onclick],[onchange]')){el.removeAttribute('onclick');el.removeAttribute('onchange');}
  if(o.stripIntro){const first=snapshot.querySelector(o.contentSelector||'main')||snapshot;for(let i=0;i<o.stripIntro;i++)first.firstElementChild?.remove();}
  if(o.kind==='anesthesia')snapshot.querySelectorAll('.print-page>header').forEach(h=>{h.querySelector('h1')?.remove();h.className='cp-interval';if(h.dataset.printRange){h.querySelector('p').textContent=h.dataset.printRange;}});
  snapshot.querySelectorAll('.photos:empty,.dn-print-images:empty').forEach(n=>n.remove());
  organize(snapshot,o.kind);
  const summary=o.summaryHTML||'',guardian=o.guardianHTML||'';
  const landscape=o.landscape===true,width=landscape?297:210,height=landscape?210:297;
  const ui='*{box-sizing:border-box}body{margin:0;background:#e8eeeb;color:#263a35;font:14px/1.5 CarestepPrint,sans-serif}.cp-tools{position:sticky;top:0;z-index:50;padding:12px 18px;background:white;border-bottom:1px solid #bdcec6;display:flex;gap:8px 18px;flex-wrap:wrap;align-items:center}.cp-tools button,.cp-tools select{font:inherit;padding:8px 12px;border:1px solid #9fb8af;border-radius:5px;background:white;color:#195e52}.cp-tools button:disabled{opacity:.5}.cp-chart-options{flex-basis:100%;max-height:30vh;overflow:auto}.cp-chart-options summary{cursor:pointer}.cp-chart-options label{display:inline-block;margin:6px 16px 4px 0}.cp-tools small,.cp-status{flex-basis:100%;margin:0}.cp-status[data-error=true]{color:#a72c20}.cp-pages{padding:18px 0}.cp-pages[aria-busy=true]{visibility:hidden;height:0;overflow:hidden}.pagedjs_page{background:white;margin:0 auto 20px;box-shadow:0 2px 10px #203a3020}.cp-pages .pagedjs_pages{zoom:var(--cp-zoom,1)}.cp-print-block{display:none}@media print{@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:0}html,body{margin:0!important;padding:0!important;background:white!important}.cp-tools{display:none!important}.cp-pages{padding:0}.cp-pages .pagedjs_pages{zoom:1!important}.pagedjs_page{margin:0!important;box-shadow:none!important;break-after:page}.pagedjs_page:last-child{break-after:auto}body:not([data-print-ready=true]) .cp-pages{display:none}body:not([data-print-ready=true]) .cp-print-block{display:block;padding:20mm}body[data-monochrome=true] .pagedjs_pages{filter:grayscale(1)}}';
  const font='@font-face{font-family:CarestepPrint;src:url('+cssText(asset('pretendard-variable-1.3.9.woff2'))+') format("woff2");font-weight:100 900;font-display:block}';
  d.head.querySelectorAll('style').forEach(s=>s.remove());const style=d.createElement('style');style.dataset.pagedjsIgnore='';style.textContent=font+ui;d.head.append(style);
  d.body.innerHTML='<div class="cp-tools"><button data-cp-print disabled>인쇄 · PDF 저장</button><label>출력 범위 <select data-cp-mode><option value="full">전체 기록</option>'+(summary?'<option value="summary">핵심 요약</option>':'')+(guardian?'<option value="guardian">보호자 안내</option>':'')+'</select></label><label><input type="checkbox" data-cp-mono> 흑백</label><label><input type="checkbox" data-cp-photos checked> 사진 포함</label><p data-cp-notice hidden></p>'+(o.chartChoices?.length?'<details class="cp-chart-options"><summary>추이 그래프 선택</summary>'+o.chartChoices.map((c,i)=>'<label><input type="checkbox" data-cp-chart="'+i+'" '+(c.selected?'checked':'')+'> '+esc(c.label)+'</label>').join('')+'</details>':'')+'<button data-cp-retry hidden>다시 준비</button><p class="cp-status" role="status">글꼴·사진·페이지를 준비하고 있습니다.</p><small>A4 '+(landscape?'가로':'세로')+' · 배율 100% · 브라우저 머리글/바닥글 끄기</small></div><p class="cp-print-block">출력 준비 완료 후 인쇄 버튼을 눌러주세요.</p><div class="cp-pages" aria-busy="true"></div>';
  d.title=o.title||'진료 기록';d.body.dataset.printReady='false';const pages=d.querySelector('.cp-pages'),mode=d.querySelector('[data-cp-mode]'),photos=d.querySelector('[data-cp-photos]'),print=d.querySelector('[data-cp-print]'),retry=d.querySelector('[data-cp-retry]'),status=d.querySelector('.cp-status');
  mode.value=[...mode.options].some(x=>x.value===o.mode)?o.mode:'full';photos.checked=o.includeImages!==false;photos.closest('label').hidden=!snapshot.querySelector('img')&&!o.loadImages;
  let engine=null,busy=false,queued=false,css=null,imagesLoaded=!o.loadImages;
  const fit=()=>d.documentElement.style.setProperty('--cp-zoom',String(Math.min(1,d.documentElement.clientWidth/(width*96/25.4))));win.addEventListener('resize',fit);fit();
  const clean=()=>{if(engine){engine.chunker.removePages();engine.chunker.pagesArea?.remove();engine.chunker.pageTemplate?.remove();engine.polisher.styleEl?.remove();engine.polisher.inserted?.forEach(s=>s.remove());engine=null;}pages.replaceChildren();};
  const load=async()=>{if(!win.PagedModule?.Previewer)await new Promise((resolve,reject)=>{const s=d.createElement('script');s.src=asset('paged-0.4.3.min.js');s.onload=resolve;s.onerror=()=>reject(Error('페이지 구성 파일을 불러오지 못했습니다.'));d.head.append(s);});if(!win.PagedModule?.Previewer)throw Error('페이지 구성을 시작하지 못했습니다.');if(!css){const r=await fetch(asset('clinical-print.css?v='+version));if(!r.ok)throw Error('출력 서식을 불러오지 못했습니다.');css=await r.text();if(!css.includes('.cp-identity'))throw Error('출력 서식이 올바르지 않습니다.');}await Promise.all([400,600,700].map(w=>d.fonts.load(w+' 11pt CarestepPrint')));await d.fonts.ready;if(!d.fonts.check('400 11pt CarestepPrint'))throw Error('출력 글꼴을 불러오지 못했습니다.');};
  const build=async()=>{
   const notice=d.querySelector('[data-cp-notice]');notice.textContent=o.guardianNotice||'';notice.hidden=mode.value!=='guardian'||!o.guardianNotice;
   d.body.dataset.printReady='false';print.disabled=true;if(busy){queued=true;return;}busy=true;queued=false;retry.hidden=true;pages.setAttribute('aria-busy','true');status.dataset.error='false';status.textContent='글꼴·사진·페이지를 준비하고 있습니다.';
   try{
    await load();if(win.closed)return;
    if(photos.checked&&mode.value==='full'&&!imagesLoaded){const html=await o.loadImages();snapshot.querySelector('.photos')?.remove();snapshot.insertAdjacentHTML('beforeend','<section class="photos">'+html+'</section>');imagesLoaded=true;}
    const content=d.createElement('div');content.className=snapshot.className;content.innerHTML=header(o,mode.value)+(mode.value==='guardian'?guardian:mode.value==='summary'?summary:snapshot.innerHTML);
    if(mode.value==='full')for(const el of content.querySelectorAll('[data-cp-chart-id]'))if(!d.querySelector('[data-cp-chart="'+el.dataset.cpChartId+'"]')?.checked)el.remove();
    if(!photos.checked)content.querySelectorAll('.photos,.dn-image-appendix,[data-gallery]').forEach(n=>n.remove());
    if(mode.value!=='full'){if(o.kind==='anesthesia')for(const h of content.querySelectorAll('[data-print-range]')){const p=d.createElement('p');p.className='cp-interval';p.textContent=h.dataset.printRange;h.replaceWith(p);}organize(content,o.kind);}
    content.querySelectorAll('.cp-trend-section').forEach(el=>{if(!el.querySelector('.cp-trend'))el.remove();});
    galleries(content);
    if(o.kind==='ophthalmic'&&mode.value==='full'){const main=content.querySelector('main'),gallery=main?.querySelector('.cp-gallery'),anchor=[...main?.querySelectorAll('h2')||[]].find(h=>h.textContent==='진단·치료 계획');if(gallery&&anchor){const title=gallery.previousElementSibling;if(title?.tagName==='H2')anchor.before(title);anchor.before(gallery);}}

    await Promise.all([...content.querySelectorAll('img')].map(async im=>{try{await im.decode();}catch{throw Error('사진을 불러오지 못했습니다. 다시 준비하거나 사진 포함을 해제해주세요.');}}));
    // A very long narrative must not turn one table row into an unprintable page.
    const notes=d.createElement('section');notes.className='cp-long-notes';let noteNumber=0;
    for(const cell of [...content.querySelectorAll('td')])if(cell.textContent.length>500||cell.textContent.split('\n').length>14){
     const n=++noteNumber,row=cell.closest('tr'),table=cell.closest('table'),column=[...row.children].indexOf(cell),label=[row.querySelector('th')?.textContent||(column>0?row.children[0]?.textContent:''),table.querySelector('thead tr')?.children[column]?.textContent].filter(Boolean).join(' · '),part=d.createElement('section');
     part.innerHTML='<h2 id="cp-note-'+n+'" data-cp-note="'+n+'">'+esc(label||'상세 소견')+' · 별첨 '+n+'</h2>';const original=d.createElement('div');original.className='cp-original-note';while(cell.firstChild)original.append(cell.firstChild);part.append(original);notes.append(part);cell.innerHTML='<a class="cp-note-link" href="#cp-note-'+n+'" data-cp-ref="'+n+'">별첨 '+n+' · <span class="cp-note-page">00</span>쪽</a>';
    }if(noteNumber)content.append(notes);
    if(o.kind!=='dental'||mode.value!=='full')content.insertAdjacentHTML('beforeend','<p class="cp-endnote">'+(mode.value==='guardian'?'저장된 진료 안내 내용입니다.':o.kind==='ward'?'예정은 실제 시행을 뜻하지 않습니다.':'미기록·미검사·평가 불가는 정상 판정을 뜻하지 않습니다.')+'</p>');
    let section=o.title;for(const el of content.querySelectorAll('h2,h3,p,table,figure')){if(el.closest('.cp-heading'))continue;if(el.matches('h2,h3'))section=el.textContent;el.dataset.cpSection=section;}
    content.querySelectorAll('.cp-note').forEach(el=>{if(el.textContent.length<350)el.classList.add('cp-keep');});
    content.querySelectorAll('table').forEach((table,i)=>table.dataset.cpTable=String(i));
    const expected=new Map();content.querySelectorAll('h1,h2,h3,h4,p,li,th,td,dt,dd,figcaption').forEach((n,i)=>{n.dataset.cpCheck=String(i);expected.set(String(i),n.textContent.replace(/\s+/g,''));});
    clean();engine=new win.PagedModule.Previewer({maxChars:Number.MAX_SAFE_INTEGER});
    engine.chunker.hooks.layout.register(rendered=>{for(const table of rendered.querySelectorAll('table[data-split-from][data-cp-table]'))if(!table.querySelector('thead')){const head=engine.chunker.source.querySelector('table[data-cp-table="'+table.dataset.cpTable+'"] thead');if(head)table.prepend(head.cloneNode(true));}});
    const pageCSS='@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:'+(landscape?'13mm 12mm 14mm':'15mm 14mm 15mm')+';@top-left{content:'+cssText(o.clinic||o.title)+';font:8pt CarestepPrint;color:#52645b}@top-right{content:'+cssText([o.patient?.name,o.patient?.chartNumber||o.patient?.externalPatientId,o.date].filter(Boolean).join(' · '))+';font:8pt CarestepPrint;color:#52645b}@bottom-left{content:'+cssText(o.title+' · '+mode.options[mode.selectedIndex].text)+';font:8pt CarestepPrint;color:#52645b}@bottom-right{content:counter(page) " / " counter(pages);font:8pt CarestepPrint}}';
    const styles={};styles[asset('clinical-print.css')]=legacy+'\n'+font+'\n'+css+'\n'+pageCSS;
    const wrapper=d.createElement('div');wrapper.append(content);const flow=await engine.preview(wrapper,[styles],pages);flow.pages.forEach(p=>p.removeListeners());if(queued)return;
    const rendered=pages.querySelectorAll('.pagedjs_page');if(!rendered.length)throw Error('인쇄 페이지를 구성하지 못했습니다.');
    const actual=new Map();for(const n of pages.querySelectorAll('[data-cp-check]'))actual.set(n.dataset.cpCheck,(actual.get(n.dataset.cpCheck)||'')+n.textContent.replace(/\s+/g,''));for(const [k,v]of expected)if(v&&!(actual.get(k)||'').includes(v))throw Error('페이지 구성 중 내용 누락이 확인되어 출력을 중단했습니다.');
    for(const ref of pages.querySelectorAll('[data-cp-ref]')){const target=pages.querySelector('[data-cp-note="'+ref.dataset.cpRef+'"]'),page=target?.closest('.pagedjs_page');if(!page)throw Error('별첨 페이지를 확인하지 못했습니다.');ref.querySelector('.cp-note-page').textContent=String([...rendered].indexOf(page)+1);}
    for(const [i,page]of [...rendered].entries()){if(!i)continue;const first=page.querySelector('[data-cp-section]');if(first&&!first.matches('h2,h3,.cp-interval p,p.cp-interval')){const margin=page.querySelector('.pagedjs_margin-top-left .pagedjs_margin-content');if(margin)margin.dataset.continuation=first.dataset.cpSection+' · 계속';}}
    for(const area of pages.querySelectorAll('.pagedjs_page_content')){const b=area.getBoundingClientRect(),walker=d.createTreeWalker(area,win.NodeFilter.SHOW_TEXT),range=d.createRange();let n;while((n=walker.nextNode())){if(n.parentElement.closest('svg'))continue;for(const t of n.textContent.matchAll(/\S+/g)){range.setStart(n,t.index);range.setEnd(n,t.index+t[0].length);for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<b.left-3||r.right>b.right+3||r.top<b.top-3||r.bottom>b.bottom+3))throw Error('페이지 밖으로 벗어나는 내용이 있어 출력을 중단했습니다.');}}}
    d.body.dataset.printReady='true';pages.setAttribute('aria-busy','false');print.disabled=false;const low=lowResolution(pages);status.textContent='출력 준비 완료 · '+rendered.length+'쪽'+(low?' · 사진 '+low+'장은 크게 인쇄하면 흐릴 수 있습니다.':'');win.clinicalPrintResult={pages:rendered.length,mode:mode.value,width,height};fit();
   }catch(e){clean();pages.setAttribute('aria-busy','false');status.dataset.error='true';status.textContent=e.message||'출력 준비에 실패했습니다.';retry.hidden=false;}
   finally{busy=false;if(queued&&!win.closed)void build();}
  };
  print.onclick=()=>{if(d.body.dataset.printReady==='true')win.print();};mode.onchange=photos.onchange=()=>{o.onPreferences?.({mode:mode.value,photos:photos.checked});void build();};d.querySelector('[data-cp-mono]').onchange=e=>{d.body.dataset.monochrome=String(e.target.checked);pages.style.filter=e.target.checked?'grayscale(1)':'';};retry.onclick=()=>{css=null;void build();};d.querySelectorAll('[data-cp-chart]').forEach(el=>el.onchange=()=>void build());await build();
 }
 function open(o){const w=g.open('','_blank');if(!w)return null;w.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><body><main>'+o.content+'</main></body></html>');w.document.close();void prepare(w,o);return w;}
 const api={identity,header,blocks,trend,stripAtRules,wardHTML,prepare,open,age};if(typeof module==='object'&&module.exports)module.exports=api;else g.ClinicalPrint=api;
})(typeof window==='undefined'?globalThis:window);
