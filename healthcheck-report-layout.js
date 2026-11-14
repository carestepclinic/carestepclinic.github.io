/* Locally hosted pagination: patient content and images never leave this window. */
(()=>{
 'use strict';
 const settings=JSON.parse(document.getElementById('report-settings').textContent),template=document.getElementById('report-source'),pages=document.getElementById('report-pages');
 const printButton=document.querySelector('[data-print]'),retry=document.querySelector('[data-rebuild]'),status=document.querySelector('.print-state'),include=document.querySelector('[data-include-guides]');
 const guideOptions=document.querySelector('[data-guide-options]'),photoOptions=document.querySelector('[data-photo-options]'),mode=document.querySelector('[data-report-mode]');
 let engine=null,cssPromise=null,busy=false,queued=false,revision=0;
 const guideChoices=[],photoChoices=new Map();
 const setStatus=(text,error=false)=>{status.textContent=text;status.classList.toggle('print-error',error);};
 function checkbox(label,key){const wrapper=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.guideChoice=key;wrapper.append(input,document.createTextNode(' '+label));guideOptions.append(wrapper);input.addEventListener('change',()=>{mode.value='custom';schedule();});return input;}
 for(const [partIndex,part] of [...template.content.querySelectorAll('[data-report-appendix=true]')].entries()){
  const cards=part.querySelector('.bcs-grid')?[]:[...part.querySelectorAll('.lab-guide,.exam-guide')];
  for(const [i,card] of (cards.length?cards:[part]).entries()){
   const key='guide-'+partIndex+'-'+i;card.dataset.guideKey=key;
   const label=card.querySelector('h3,h2')?.textContent||'일반 안내';guideChoices.push({key,input:checkbox(label,key)});
  }
 }
 if(!guideChoices.length){include.checked=false;include.disabled=true;guideOptions.textContent='추가할 일반 검사 안내가 없습니다.';}
 for(const gallery of template.content.querySelectorAll('[data-gallery]')){
  const figures=[...gallery.querySelectorAll('figure')];if(!figures.length)continue;
  const wrapper=document.createElement('label'),select=document.createElement('select');select.dataset.featuredKind=gallery.dataset.gallery;
  wrapper.append(document.createTextNode((figures[0].querySelector('img')?.alt||'사진').replace(/\s+\d+$/,'')+' 대표 '),select);
  for(const figure of figures){const option=document.createElement('option');option.value=figure.dataset.photoId;option.textContent=(figure.querySelector('figcaption')?.textContent||'사진').slice(0,90);select.append(option);}
  select.addEventListener('change',schedule);photoOptions.append(wrapper);photoChoices.set(gallery.dataset.gallery,select);
 }
 if(!photoChoices.size)photoOptions.hidden=true;
 include.addEventListener('change',()=>{mode.value=include.checked?'custom':'concise';guideOptions.querySelectorAll('input').forEach(x=>x.disabled=!include.checked);schedule();});
 mode.addEventListener('change',()=>{include.checked=mode.value!=='concise'&&guideChoices.length>0;guideOptions.querySelectorAll('input').forEach(x=>{x.disabled=!include.checked;if(mode.value==='detailed')x.checked=true;});schedule();});
 guideOptions.querySelectorAll('input').forEach(x=>x.disabled=!include.checked);
 document.querySelector('[data-photo-layout]').addEventListener('change',schedule);
 retry.addEventListener('click',()=>{cssPromise=null;schedule();});
 printButton.addEventListener('click',()=>{if(document.body.dataset.reportReady==='true')window.print();});
 window.addEventListener('resize',fitScreen);
 function fitScreen(){document.documentElement.style.setProperty('--report-zoom',String(Math.min(1,document.documentElement.clientWidth/(210*96/25.4))));}
 function source(){
  const root=document.createElement('div');root.append(template.content.cloneNode(true));
  if(!include.checked)root.querySelectorAll('[data-report-appendix=true]').forEach(x=>x.remove());
  else{
   for(const choice of guideChoices)if(!choice.input.checked)root.querySelector('[data-guide-key="'+choice.key+'"]')?.remove();
   for(const part of root.querySelectorAll('[data-report-appendix=true]'))if(!part.matches('[data-guide-key]')&&!part.querySelector('[data-guide-key]'))part.remove();
  }
  // Preserve image identity, caption and inclusion. Only the printed order/size changes.
  for(const gallery of root.querySelectorAll('[data-gallery]')){
   const figures=[...gallery.querySelectorAll('figure')],featured=photoChoices.get(gallery.dataset.gallery)?.value;
   gallery.replaceChildren();
   let photoNumber=0;
   const addRow=(list,isFeatured=false)=>{const row=document.createElement('div');row.className='photo-row'+(isFeatured?' featured':'');for(const figure of list){const label=(figure.dataset.photoKind||'사진')+(isFeatured?' · 대표 영상':' '+(++photoNumber));figure.querySelector('figcaption b').textContent=label;figure.querySelector('img').alt=label;}row.append(...list);gallery.append(row);};
   if(document.querySelector('[data-photo-layout]').value==='featured'){
    const i=figures.findIndex(x=>x.dataset.photoId===featured);if(i>=0)addRow(figures.splice(i,1),true);
   }
   for(let i=0;i<figures.length;i+=2)addRow(figures.slice(i,i+2));
  }
  const rows=root.querySelector('[data-toc-rows]'),headings=[...root.querySelectorAll('.part-title')];
  headings.forEach((heading,i)=>{heading.dataset.sectionNumber=String(i+1).padStart(2,'0');});
  for(let i=0;i<headings.length;i+=2){const tr=document.createElement('tr');for(const heading of headings.slice(i,i+2)){const td=document.createElement('td'),a=document.createElement('a'),label=document.createElement('span'),number=document.createElement('span');a.className='toc-link';a.setAttribute('href','#'+heading.id);label.className='toc-label';label.textContent=heading.textContent;number.className='toc-page';number.textContent='—';a.append(label,number);td.append(a);tr.append(td);}rows.append(tr);}
  if(!headings.length)root.querySelector('.report-toc').remove();
  return root;
 }
 async function assets(root){
  if(!window.PagedModule?.Previewer)throw Error('페이지 구성 파일을 불러오지 못했습니다. 보고서를 다시 열어주세요.');
  await Promise.all([400,600,700].map(weight=>document.fonts.load(weight+' 11pt CarestepReport')));await document.fonts.ready;
  if(!document.fonts.check('400 11pt CarestepReport'))throw Error('출력 글꼴을 불러오지 못했습니다. 다시 준비를 눌러주세요.');
  await Promise.all([...root.querySelectorAll('img')].map(async img=>{try{await img.decode();}catch{if(img.alt==='병원 로고'){img.remove();return;}throw Error('출력 사진을 불러오지 못했습니다. 보고서를 다시 열어주세요.');}}));
  cssPromise??=fetch(settings.css,{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('출력 서식을 불러오지 못했습니다.');const text=await r.text();if(!text.includes('.report-part'))throw Error('출력 서식이 올바르지 않습니다.');return text;});
  return await cssPromise;
 }
 function clean(){if(engine){engine.chunker.removePages();engine.chunker.pagesArea?.remove();engine.chunker.pageTemplate?.remove();engine.polisher.styleEl?.remove();engine.polisher.inserted?.forEach(s=>s.remove());engine=null;}pages.replaceChildren();}
 async function build(){
  if(busy){queued=true;return;}busy=true;queued=false;const token=++revision;
  document.body.dataset.reportReady='false';pages.setAttribute('aria-busy','true');printButton.disabled=true;retry.hidden=true;setStatus('글꼴·사진·목차를 준비하고 있습니다.');
  try{
   const root=source(),css=await assets(root);clean();// Measure complete containers so incremental layout cannot skip later rows.
   engine=new window.PagedModule.Previewer({maxChars:Number.MAX_SAFE_INTEGER});
   root.querySelectorAll('table').forEach((table,i)=>table.dataset.printTable=String(i));
   const expected=new Map();root.querySelectorAll('h1,h2,h3,h4,p,li,th,td,dt,dd,figcaption,.patient-block>strong,.report-meta>span').forEach((node,i)=>{if(node.closest('.report-toc'))return;node.dataset.printCheck=String(i);expected.set(String(i),node.textContent.replace(/\s+/g,''));});
   // Restore a continuation table's header before measuring the next overflow.
   engine.chunker.hooks.layout.register(rendered=>{
    for(const table of rendered.querySelectorAll('table[data-split-from][data-print-table]'))if(!table.querySelector('thead')){
     const head=engine.chunker.source.querySelector('table[data-print-table="'+table.dataset.printTable+'"] thead');
     if(head)table.insertBefore(head.cloneNode(true),table.firstChild);
    }
   });
   const styles={};styles[settings.css]=css+'\n'+document.getElementById('report-page-style').textContent;
   const flow=await engine.preview(root,[styles],pages);
   for(const page of flow.pages)page.removeListeners();
   if(queued)return;
   const rendered=[...pages.querySelectorAll('.pagedjs_page')];if(!rendered.length||flow.total!==rendered.length)throw Error('페이지 수를 확인하지 못했습니다.');
   // Put the section name in the reserved margin, never over the report content.
   for(const page of rendered){const part=page.querySelector('.report-part'),title=part?.dataset.reportTitle;if(part&&part.dataset.reportPart!=='0'&&!part.querySelector('.part-title')&&title){const margin=page.querySelector('.pagedjs_margin-top-left .pagedjs_margin-content');if(margin){margin.dataset.continuation=title+' · 계속';page.dataset.continuation=title;}}}
   const toc=[];
   for(const link of pages.querySelectorAll('.toc-link')){
    const id=link.getAttribute('href').slice(1),heading=pages.querySelector('[id="'+id+'"]'),page=heading?.closest('.pagedjs_page'),n=rendered.indexOf(page)+1;
    if(!n)throw Error('목차의 페이지를 확인하지 못했습니다.');link.querySelector('.toc-page').textContent=String(n);toc.push({title:heading.textContent,page:n,id});
   }
   const actual=new Map();for(const node of pages.querySelectorAll('[data-print-check]'))actual.set(node.dataset.printCheck,(actual.get(node.dataset.printCheck)||'')+node.textContent.replace(/\s+/g,''));
   for(const [key,value] of expected)if(value&&!(actual.get(key)||'').includes(value)){throw Error('내용 누락이 확인되어 출력을 중단했습니다. 다시 준비를 눌러주세요.');}
   for(const area of pages.querySelectorAll('.pagedjs_page_content')){
    const box=area.getBoundingClientRect(),walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT),range=document.createRange();let node;
    while((node=walker.nextNode()))for(const token of node.textContent.matchAll(/\S+/g)){
     range.setStart(node,token.index);range.setEnd(node,token.index+token[0].length);
     for(const rect of range.getClientRects())if(rect.width&&rect.height&&(rect.left<box.left-3||rect.right>box.right+3||rect.top<box.top-3||rect.bottom>box.bottom+3)){throw Error('페이지 밖으로 벗어나는 내용이 있어 출력을 중단했습니다. 다시 준비를 눌러주세요.');}
    }
   }
   window.reportLayout={revision:token,pages:rendered.length,toc};document.body.dataset.reportReady='true';pages.setAttribute('aria-busy','false');printButton.disabled=false;fitScreen();setStatus('출력 준비 완료 · '+rendered.length+'쪽 · 목차 자동 생성');
  }catch(e){clean();setStatus(e.message||'출력 준비에 실패했습니다. 다시 준비를 눌러주세요.',true);retry.hidden=false;pages.setAttribute('aria-busy','false');}
  finally{busy=false;if(queued)void build();}
 }
 function schedule(){document.body.dataset.reportReady='false';printButton.disabled=true;void build();}
 fitScreen();void build();
})();
