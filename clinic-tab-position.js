(function(g){
 'use strict';
 // Navigate at the controls, never jump past patient/weight inputs to a result.
 function reveal(el){if(!el||el.hidden)return;const r=el.getBoundingClientRect();if(r.top<72)g.scrollBy({top:r.top-80,behavior:'instant'});}
 function top(){const main=document.querySelector('main.main');if(main){main.scrollTop=0;g.scrollTo({top:Math.max(0,g.scrollY+main.getBoundingClientRect().top-8),behavior:'instant'});}else g.scrollTo({top:0,behavior:'instant'});}
 g.CarestepTabPosition={reveal,top};
})(window);
