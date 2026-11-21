/* Same measured A4 sheets for preview and browser print. No patient data leaves the page. */
(function(g){'use strict';
 function paginate(doc,html,identity){
  const source=doc.createElement('div');source.innerHTML=html;const article=source.querySelector('.su-document'),units=[];
  const visit=(n,context='')=>{if(n.matches('.su-consent-audit,.su-source-footer'))return;
   if(n.matches('.su-info')){const children=[...n.children];for(let i=0;i<children.length;i+=2){const row=n.cloneNode(false);row.append(children[i].cloneNode(true),children[i+1].cloneNode(true));row.dataset.infoLabel=children[i].textContent;units.push(row);}return;}
   if(n.matches('.su-statutory-annex')){const first=units.length;for(const c of n.children)visit(c,context);if(units[first])units[first].dataset.pageStart='true';return;}
   if(n.matches('.su-surgery-document-section,.su-clause,.su-statutory-annex-item,.su-statutory-clinical,.su-statutory-additional')){const heading=n.querySelector(':scope > h2,:scope > h3,:scope > h4')?.textContent||context;for(const c of n.children)visit(c,heading);return;}
   const unit=n.cloneNode(true);if(context)unit.dataset.continuation=context;units.push(unit);
  };for(const n of article.children)visit(n);
  const pages=[];let body,page;
  const next=(continued='')=>{page=doc.createElement('section');page.className='su-a4-page';const header=doc.createElement('header');header.className='su-page-identity';header.textContent=identity;body=doc.createElement('article');body.className=article.className+' su-page-content';const footer=doc.createElement('footer');footer.className='su-page-number';page.append(header,body,footer);doc.body.append(page);pages.push(page);if(continued){const heading=doc.createElement('h3');heading.className='su-continuation-heading';heading.dataset.continuationHeading='';heading.textContent=continued+' — 계속';body.append(heading);}};
  const fits=()=>body.scrollHeight<=body.clientHeight+1;
  const append=nodes=>nodes.forEach(n=>body.append(n));
  const remove=nodes=>nodes.forEach(n=>n.remove());
  next();let pending=[];
  for(const unit of units){if(unit.dataset.pageStart&&body.childElementCount)next();if(/^H[1-4]$/.test(unit.tagName)){pending.push(unit);continue;}
   let nodes=[...pending,unit];pending=[];const hadContent=body.childElementCount>0;append(nodes);
   if(fits())continue;if(unit.matches('.su-statutory-cover')){unit.classList.add('su-statutory-compact');if(fits())continue;}remove(nodes);if(hadContent)next();append(nodes);if(fits())continue;
   // Split both prose and table values without changing their saved text. The
   // label repeats on continuation pages, so long notes remain attributable.
   const table=unit.matches('.su-info'),textNode=table?unit.querySelector('dd'):unit;
   if((table||unit.tagName==='P')&&!textNode.querySelector('*')){const chars=Array.from(textNode.textContent);unit.remove();let offset=0,continued=false;
    while(offset<chars.length){const fragment=unit.cloneNode(true),target=table?fragment.querySelector('dd'):fragment;if(table&&continued)fragment.querySelector('dt').textContent+=' (계속)';body.append(fragment);let lo=0,hi=chars.length-offset;
     while(lo<hi){const mid=Math.ceil((lo+hi)/2);target.textContent=chars.slice(offset,offset+mid).join('');if(fits())lo=mid;else hi=mid-1;}
     if(!lo)throw Error('페이지에 설명을 배치하지 못했습니다.');
     let end=lo;if(offset+lo<chars.length){const part=chars.slice(offset,offset+lo),cut=Math.max(part.lastIndexOf('\n'),part.lastIndexOf(' '));if(cut>lo*.7)end=cut+1;}
     target.textContent=chars.slice(offset,offset+end).join('');offset+=end;continued=true;if(offset<chars.length)next(table?'':unit.dataset.continuation);
    }
   }else throw Error('페이지에 정보를 배치하지 못했습니다.');
  }
  if(pending.length)append(pending);
  pages.forEach((p,i)=>{p.querySelector('.su-page-number').textContent='CARESTEP · '+(i+1)+' / '+pages.length+'쪽';});return pages.length;
 }
 function previewScale(width,mode){return mode==='fit'?Math.min(1,Math.max(.1,(width-24)/(210*96/25.4))):Math.min(1.5,Math.max(.25,Number(mode)||1));}
 function zoom(doc,mode='fit'){
  const scale=previewScale(doc.documentElement.clientWidth,mode);
  for(const page of doc.querySelectorAll('.su-a4-page')){let sheet=page.parentElement;if(!sheet.classList.contains('su-page-sheet')){sheet=doc.createElement('div');sheet.className='su-page-sheet';page.before(sheet);sheet.append(page);}sheet.style.width=(210*96/25.4*scale)+'px';sheet.style.height=(297*96/25.4*scale)+'px';page.style.transform='scale('+scale+')';}
  return scale;
 }
 g.ConsentPagination={paginate,zoom,previewScale};if(typeof module==='object')module.exports=g.ConsentPagination;
})(typeof window==='undefined'?globalThis:window);
