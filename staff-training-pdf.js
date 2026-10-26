/* Local, on-demand PDF export. No education content leaves this browser. */
(function(global){
 'use strict';
 const base=new URL('.',document.currentScript.src),loads=new Map();
 const status={draft:'작성 중',review:'검토 대기',published:'승인됨',withdrawn:'공개 중단'};
 const labels={clinical:'임상 핵심',nursing:'간호·보고 체크리스트',counseling:'보호자 상담',objectives:'학습 목표',knowledge:'핵심 지식',workflow:'업무 순서',checklist:'업무 체크리스트',reporting:'보고·인계 기준',scenarios:'상황별 예시'};
 function library(name,property){
  if(global[property])return Promise.resolve(global[property]);
  if(!loads.has(name))loads.set(name,new Promise((resolve,reject)=>{
   const s=document.createElement('script');s.src=new URL(name,base).href;
   const fail=()=>{clearTimeout(timer);loads.delete(name);s.remove();reject(Error('PDF 도구를 불러오지 못했습니다. 연결을 확인한 뒤 다시 다운로드해주세요.'));};
   const timer=setTimeout(fail,30000);s.onerror=fail;s.onload=()=>{if(!global[property])return fail();clearTimeout(timer);resolve(global[property]);};document.head.append(s);
  }));return loads.get(name);
 }
 let fontBytes;
 async function font(){
  if(!fontBytes)fontBytes=fetch(new URL('pretendard-regular-1.3.9.ttf',base),{credentials:'omit',signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error('font unavailable');return r.arrayBuffer();}).catch(()=>{fontBytes=null;throw Error('PDF 한글 글꼴을 불러오지 못했습니다. 연결을 확인하고 다시 다운로드해주세요.');});
  return fontBytes;
 }
 async function create(d){
  const [P,kit,bytes]=await Promise.all([library('pdf-lib-1.17.1.min.js','PDFLib'),library('pdf-fontkit-1.1.1.min.js','fontkit'),font()]);
  const pdf=await P.PDFDocument.create();pdf.registerFontkit(kit);
  // Keep composite Korean glyphs intact in Acrobat, Edge and system PDF viewers.
  const regular=await pdf.embedFont(bytes,{subset:false});
  pdf.setTitle(d.title);pdf.setAuthor('CARESTEP');pdf.setSubject('직원 교육자료');pdf.setCreator('CARESTEP 직원 교육센터');pdf.setLanguage('ko-KR');
  const W=595.28,H=841.89,M=46,BOTTOM=53,WIDTH=W-M*2;
  const ink=P.rgb(.09,.18,.29),muted=P.rgb(.32,.40,.50),blue=P.rgb(.13,.28,.68),line=P.rgb(.84,.88,.94);
  const glyphs=new Set(regular.getCharacterSet());
  const clean=t=>Array.from(String(t??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')).map(c=>c==='\n'||glyphs.has(c.codePointAt(0))?c:'□').join('');
  const width=(t,size)=>regular.widthOfTextAtSize(t,size);
  const charWidths=new Map();
  const charWidth=(ch,size)=>{const key=ch+':'+size;if(!charWidths.has(key))charWidths.set(key,width(ch,size));return charWidths.get(key);};
  const sumWidth=(t,size)=>Array.from(t).reduce((n,ch)=>n+charWidth(ch,size),0);
  // Prefer word boundaries, while allowing Korean and long URLs to wrap safely.
  function wrap(text,size,max){
   const result=[];
   for(const para of clean(text).split('\n')){
    if(!para){result.push('');continue;}let current='',used=0;
    for(const ch of para){
     if(current&&used+charWidth(ch,size)>max){
      const space=current.lastIndexOf(' ');
      if(space>current.length*.45){result.push(current.slice(0,space));current=current.slice(space+1)+ch;}
      else {result.push(current.trimEnd());current=ch===' '?'':ch;}
      used=sumWidth(current,size);
     }else {current+=ch;used+=charWidth(ch,size);}
    }
    if(current)result.push(current.trimEnd());
   }return result;
  }
  let page,y;
  function newPage(){
   page=pdf.addPage([W,H]);y=H-76;
   page.drawText('CARESTEP  /  직원 교육센터',{x:M,y:H-35,font:regular,size:8.5,color:muted});
   page.drawLine({start:{x:M,y:H-45},end:{x:W-M,y:H-45},thickness:.6,color:line});
  }
  function space(n){if(y-n<BOTTOM)newPage();}
  function paragraph(text,{size=11,leading=18,color=ink,indent=0,gap=9,bullet=false,url=''}={}){
   const rows=wrap(text,size,WIDTH-indent-(bullet?12:0));
   if(rows.length>1)space(leading*2);else space(leading);
   let first=true;
   for(const row of rows){
    space(leading);const x=M+indent+(bullet?12:0);
    if(bullet&&first)page.drawText('•',{x:M+indent,y,font:regular,size,color:blue});
    if(row){
     page.drawText(row,{x,y,font:regular,size,color});
     if(/^https?:\/\//i.test(url)){
      const annotation=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,y-2,x+width(row,size),y+size],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:P.PDFString.of(url)}}));
      page.node.addAnnot(annotation);
     }
    }
    y-=leading;first=false;
   }y-=gap;
  }
  function heading(text){space(82);y-=6;paragraph(text,{size:14,leading:22,color:blue,gap:10});}
  newPage();
  const type=d.kind==='sop'?'우리 병원 SOP':d.body.format==='practice'?'병원 실무 교육':'질환·증상 교육';
  paragraph(type+' · '+(d.common?'공통 자료':'우리 병원 자료'),{size:10,color:blue,leading:17,gap:8});
  paragraph(d.title,{size:21,leading:29,gap:12});
  paragraph('v'+d.version+' · '+(status[d.status]||'상태 확인 필요')+(d.reviewedAt?' · 승인 '+String(d.reviewedAt).slice(0,10):''),{size:9.5,color:muted,leading:16,gap:16});
  if(d.body.config)paragraph(d.body.config.audience+' · '+d.body.config.level,{size:10,color:muted});
  const guidance=[...new Set((d.body.gapReviews||[]).filter(r=>r.disposition==='guidance').map(r=>r.note))];
  if(guidance.length){heading('적용 전 확인사항');for(const text of guidance)paragraph(text,{bullet:true});}
  if(d.body.gaps?.length){heading('추가 검토 필요');for(const text of d.body.gaps)paragraph(text,{bullet:true});}
  const sopLabels={clinical:'업무 목적·기준',nursing:'절차·확인사항',counseling:'응대·보고'};
  for(const section of d.body.sections){
   heading((d.kind==='sop'?sopLabels[section.key]:null)||labels[section.key]||section.key);
   if(!section.items.length)paragraph('작성할 내용이 없습니다.',{color:muted});
   for(const item of section.items)paragraph(item.text,{bullet:true});
  }
  if(d.body.quiz?.length)paragraph('학습 평가와 이수 확인은 직원 교육센터에서 진행하세요.',{size:9.5,color:muted,leading:16,gap:12});
  if(d.sources?.length){
   newPage();heading('원본·참고 근거');paragraph('본문에 활용한 원본과 참고자료입니다. 필요한 경우 원문을 확인하세요.',{size:10,color:muted,leading:17});
   for(const [i,s] of d.sources.entries()){
    space(65);paragraph((i+1)+'. '+s.title,{size:11,leading:18,gap:4});
    const meta=[s.contentId?'보호자 원본':'참고자료',s.version?'v'+s.version:'',s.retrievedAt?'확인일 '+String(s.retrievedAt).slice(0,10):''].filter(Boolean).join(' · ');
    paragraph(meta,{size:9,color:muted,leading:15,gap:4});
    if(/^https?:\/\//i.test(s.url||''))paragraph(s.url,{size:9,color:blue,leading:14,url:s.url,gap:12});else y-=8;
   }
  }
  const pages=pdf.getPages();for(const [i,p] of pages.entries()){
   p.drawLine({start:{x:M,y:39},end:{x:W-M,y:39},thickness:.6,color:line});
   p.drawText(clean(type+' · v'+d.version),{x:M,y:25,font:regular,size:8,color:muted});
   const count=(i+1)+' / '+pages.length;p.drawText(count,{x:W-M-width(count,8),y:25,font:regular,size:8,color:muted});
  }
  return pdf.save();
 }
 global.StaffTrainingPDF={create};
})(window);
