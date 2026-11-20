/* Same measured A4 sheets for preview and browser print. No patient data leaves the page. */
(function(g){'use strict';
 function paginate(doc,html,identity){
  const source=doc.createElement('div');source.innerHTML=html;const article=source.querySelector('.su-document'),units=[];
  const visit=n=>{if(n.matches('.su-consent-audit,.su-source-footer'))return;
   if(n.matches('.su-info')){const children=[...n.children];for(let i=0;i<children.length;i+=2){const row=n.cloneNode(false);row.append(children[i].cloneNode(true),children[i+1].cloneNode(true));units.push(row);}return;}
   if(n.matches('.su-surgery-document-section,.su-clause')){for(const c of n.children)visit(c);return;}
   units.push(n.cloneNode(true));
  };for(const n of article.children)visit(n);
  const pages=[];let body,page;
  const next=()=>{page=doc.createElement('section');page.className='su-a4-page';const header=doc.createElement('header');header.className='su-page-identity';header.textContent=identity;body=doc.createElement('article');body.className=article.className+' su-page-content';const footer=doc.createElement('footer');footer.className='su-page-number';page.append(header,body,footer);doc.body.append(page);pages.push(page);};
  const fits=()=>body.scrollHeight<=body.clientHeight+1;
  const append=nodes=>nodes.forEach(n=>body.append(n));
  const remove=nodes=>nodes.forEach(n=>n.remove());
  next();let pending=[];
  for(const unit of units){if(/^H[1-4]$/.test(unit.tagName)){pending.push(unit);continue;}
   let nodes=[...pending,unit];pending=[];const hadContent=body.childElementCount>0;append(nodes);
   if(fits())continue;remove(nodes);if(hadContent)next();append(nodes);if(fits())continue;
   // Long clinical paragraphs can span sheets; keep their heading with the first lines.
   if(unit.tagName==='P'&&!unit.querySelector('*')){const text=unit.textContent;unit.remove();let rest=text;
    while(rest){const fragment=unit.cloneNode(false);body.append(fragment);let lo=0,hi=rest.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);fragment.textContent=rest.slice(0,mid);if(fits())lo=mid;else hi=mid-1;}
     if(!lo)throw Error('페이지에 설명을 배치하지 못했습니다.');
     // Prefer paragraph/word boundaries without dropping any character.
     let end=lo;if(lo<rest.length){const cut=Math.max(rest.lastIndexOf('\n',lo-1),rest.lastIndexOf(' ',lo-1));if(cut>lo*.7)end=cut+1;}
     fragment.textContent=rest.slice(0,end);rest=rest.slice(end);if(rest)next();
    }
   }else throw Error('한 페이지보다 긴 정보 항목이 있습니다. 내용을 나누어 작성해주세요.');
  }
  if(pending.length)append(pending);
  pages.forEach((p,i)=>{p.querySelector('.su-page-number').textContent='CARESTEP · '+(i+1)+' / '+pages.length+'쪽';});return pages.length;
 }
 g.ConsentPagination={paginate};if(typeof module==='object')module.exports=g.ConsentPagination;
})(typeof window==='undefined'?globalThis:window);
