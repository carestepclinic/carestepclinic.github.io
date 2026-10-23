/* Conservative, local-only extraction from an authenticated clinic's reference.
 * Profiles are unapproved input candidates, never prescribing recommendations.
 * No handbook text or drug dose database is bundled with the public application.
 */
(function(g){
 'use strict';
 const VERSION='2026-10-23.1';
 const number='(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
 const amount=()=>new RegExp('(?<![\\d.,/<>≤≥])('+number+')(?:\\s*(?:[–−—-]|to)\\s*('+number+'))?\\s*(mg|mcg|µg|μg|g|units?|IU|U|mL|mEq|mmol)\\s*/\\s*(kg|dogs?|cats?|animal|m[²2])(?:\\s*/\\s*(hours?|hrs?|hr|h|minutes?|mins?|min|days?|day))?','gi');
 function clean(s){return String(s||'').replace(/([A-Za-z])\s*[-­]\s*\n\s*([a-z])/g,'$1$2').replace(/\u00a0/g,' ').replace(/W ARNINGS?/g,'WARNING').replace(/[ \t]+/g,' ').trim();}
 function speciesHeader(line){const s=line.trim();if(!/^[A-Z /(),&–-]{3,}:\s*$/.test(s))return null;if(/^(?:NOTES?|WARNINGS?|CAUTIONS?):/.test(s))return null;const words=s.replace(/:$/,'').trim();if(/^(?:DOGS|CATS)(?:(?:\s*[/&,]\s*|\s+AND\s+)(?:DOGS|CATS))*$/.test(words))return {species:[...(words.includes('DOGS')?['dog']:[]),...(words.includes('CATS')?['cat']:[])],label:words};return {species:[],label:words};}
 function splitSpecies(text){const out=[];let current={species:[],label:'종 구분 전 안내',lines:[]};for(const line of clean(text).split('\n')){const h=speciesHeader(line);if(h){if(current.lines.length)out.push({...current,text:current.lines.join('\n')});current={...h,lines:[]};}else current.lines.push(line);}if(current.lines.length)out.push({...current,text:current.lines.join('\n')});return out;}
 function splitTopics(text){const lines=text.split('\n'),out=[];let body=[],title='원문 용법',primaryTitle='원문 용법';const flush=()=>{const value=body.join(' ').replace(/\s+/g,' ').trim();if(value)out.push({title,text:value});body=[];};
  for(let i=0;i<lines.length;i++){
   const line=lines[i].trim();if(!line)continue;const bullet=/^(?:[a-z]\)|[ivx]{1,5}[.)])\s+/i.test(line);
   // Indications carry their explicit source qualifier. Never infer a species.
   let heading='',end=i;const start=line.replace(/^(?:[a-z]\)|[ivx]{1,5}[.)])\s+/i,'');
   if(/^[A-Z]/.test(start)&&!/^NOTE|^WARNING/.test(start)&&(start.includes(':')||!/[.;][\d,–-]*$/.test(start))){
    let joined='';for(let j=i;j<Math.min(lines.length,i+9);j++){joined+=(joined?' ':'')+lines[j].trim();if(joined.length>650)break;const colon=joined.indexOf(':');if(colon<0)continue;const prefix=joined.slice(0,colon+1);if(/\((?:[^)]*(?:extra[ -]?label|label(?:ed|led)? dosage|FDA[ -]approved|label indication)[^)]*)\)\s*:/i.test(prefix)&&!amount().test(prefix)&&!(/\b(?:PO|SC|IM|IV|every)\b/.test(prefix))){heading=prefix.replace(/^(?:[a-z]\)|[ivx]{1,5}[.)])\s+/i,'');end=j;}break;}
   }
   if(!heading&&bullet&&/^[A-Z]/.test(start)){let joined=start;for(let j=i;j<Math.min(lines.length,i+9);j++){if(j>i)joined+=' '+lines[j].trim();if(joined.length>650)break;const colon=joined.indexOf(':');if(colon>=0){const prefix=joined.slice(0,colon+1);if(!amount().test(prefix)&&!/[.;]/.test(prefix)){heading=prefix;end=j;}break;}if(/[.;]/.test(joined)||amount().test(joined))break;}}
   if(heading){flush();title=/^(?:Most commonly recommended|Alternatively|Alternative|Protocol|Option)\b/i.test(heading)&&title!=='원문 용법'?primaryTitle+' · '+heading:heading;if(!/^(?:Most commonly recommended|Alternatively|Alternative|Protocol|Option)\b/i.test(heading))primaryTitle=title;const all=lines.slice(i,end+1).map(x=>x.trim()).join(' ');body.push(all.slice(all.indexOf(':')+1));i=end;}
   else {if(bullet){flush();title=primaryTitle;}body.push(line);}
  }flush();return out;
 }
 function frequency(text){const s=text.replace(/\s+/g,' ');if(/\b\d+\s*(?:or|to|[–-])\s*\d+\s*times\b|\brepeat\b.*\bor\b/i.test(s))return {text:'복수 간격 · 원문 확인',times:null,single:false};if(/\b(?:once|twice|three times|four times)\s*(?:or|to|[–-])\s*(?:once|twice|three times|four times)\b/i.test(s))return {text:'투여 횟수 범위 · 원문 확인',times:null,single:false};const f=[...s.matchAll(/\bevery\s+(\d+(?:\.\d+)?)(?:\s*(?:to|[–-])\s*(\d+(?:\.\d+)?))?\s*hours?(?=$|[^A-Za-z])/gi)];if(f.length===1){if(f[0][2])return {text:f[0][0],times:null,single:false};const n=24/Number(f[0][1]);return {text:f[0][0],times:Number.isInteger(n)&&n>=1&&n<=24?n:null,single:false};}
  if(f.length>1)return {text:'복수 간격 · 원문 확인',times:null,single:false};
  const daily=[...s.matchAll(/\b(once|twice|three times|3 times|four times|4 times)\s+(?:a day|daily)(?=$|[^A-Za-z])/gi)];if(daily.length===1){const t=daily[0][1].toLowerCase();return {text:daily[0][0],times:t==='once'?1:t==='twice'?2:/three|3/.test(t)?3:4,single:false};}
  if(/\b(?:single dose|once(?:\s+only)?(?:[.;,]|\s+(?:before|prior|at|should|for)))/i.test(s)||/\b(?:PO|SC|IM|IV)\s+once[.;,]?\s*\d*$/i.test(s))return {text:'단회 · 원문 확인',times:null,single:true};
  return {text:'투여 간격 직접 확인',times:null,single:false};
 }
 function candidate(entry,block,species,index,globalNotes){const text=block.text,full=block.title+' '+text,matches=[...text.matchAll(amount())],reasons=[];const p={id:entry.id+':'+species+':'+index,species,title:block.title,text,notes:globalNotes,eligible:false,reasons};
  if(block.title==='원문 용법'||/^(?:IV|PO|SC|IM) dosage/i.test(block.title))reasons.push('적응증 제목을 명확히 구분할 수 없음');
  if(/\b(?:higher end|upper end|alternating weeks|cycles|left untreated|regional|Bier block|epidural|intrathecal|nerve block|intraarticular)\b/i.test(full))reasons.push('권장 범위·치료 주기·특수 시술 조건 확인 필요');
  if(/^(?:Between gestation|Before |After |From gestation)/i.test(block.title))reasons.push('임신 시기·단계별 적용 조건 확인 필요');
  if(entry.group!=='systemic')reasons.push('국소 제제는 적용 부위·제품별 용법 확인');
  if(entry.boundaryVerified!==true)reasons.push('원문 항목 경계 확인 필요');
  if(entry.errata)reasons.push('공식 정오표 수정 대상 · 수치 자동 입력 보류');
  if(/\b(?:ideal body|lean body|not accepted|not recommended|contraindicat\w*)\b/i.test(globalNotes))reasons.push('용량 구역의 공통 주의·체중 기준 검토 필요');
  if(matches.length!==1){reasons.push(matches.length?'여러 용량·단계·병용 약물이 함께 기재됨':'숫자·질량·기준 단위를 명확히 구분할 수 없음');return p;}
  const m=matches[0],low=Number(m[1]),high=Number(m[2]||m[1]),unit=m[3].toLowerCase(),basis=m[4].toLowerCase(),period=m[5]||'';
  const remaining=text.slice(0,m.index)+text.slice(m.index+m[0].length);
  if(/\d\s*(?:mg|mcg|µg|μg|micrograms?|milligrams?|grams?|(?:milli)?units?|IU|mL)\b/i.test(remaining)||/\d\s*(?:or|and|,|to|[–−—-])\s*$/i.test(text.slice(0,m.index)))reasons.push('다른 투여량·제품 수치가 함께 있어 확인 필요');
  if(!(low>0&&high>=low&&high<=1e6))reasons.push('용량 범위·숫자 확인 필요');
  if(!['mg','mcg','µg','μg','g','unit','units','u','iu'].includes(unit))reasons.push('제품 부피·전해질 등 별도 계산이 필요한 단위');
  if(/dog/.test(basis)&&species!=='dog'||/cat/.test(basis)&&species!=='cat')reasons.push('고정량의 동물종이 현재 선택과 다름');
  const routes=[...new Set((text.match(/\b(?:PO|SC|SQ|IM|IV|IP|IO|IT|PR)\b/g)||[]).map(x=>x==='SQ'?'SC':x))];
  if(routes.length!==1||!['PO','SC','IM','IV'].includes(routes[0]))reasons.push('투여경로가 없거나 여러 경로가 함께 기재됨');
  if(/\b(?:loading|subsequent|maintenance dose|then|decreas\w*|increas\w*|modify|modified|in conjunction with|titrat\w*|taper\w*|adjust\w*|combined|combination|concurrently|in addition to|followed by|divided|maximum|not exceed|no more than|up to|at least|or more|or higher|ideal body|lean body|depending|based on|if|when|less than|greater than|weighing|blood glucose|renal failure|renal impairment|hepatic impairment)\b/i.test(full))reasons.push('단계·병용·상한 또는 환자 조건에 따라 달라지는 용법');
  if(/\b(?:not recommended|not be used|experimentally|pharmacokinetic study|case report|contraindicat\w*|not often recommended|ineffective|inefficacious|insufficient evidence|discouraged|toxicity|toxic dose|lethal|LD50|in humans|human dose|horses|cattle|rabbits|rats|mice|ferrets|birds)\b/i.test(full))reasons.push('금기·비권장·다른 동물종 등 문맥 검토 필요');
  if(/[<>≤≥≈~+−-]\s*$/.test(text.slice(0,m.index)))reasons.push('부등호·부호·근삿값으로 표기된 용량');
  if(/\b(?:initially|initial|starting)\b/i.test(full))p.phase='시작 용량';else p.phase='용법별 참고량';
  p.low=unit==='g'?low*1000:low;p.high=unit==='g'?high*1000:high;p.unit=['unit','units','u','iu'].includes(unit)?'U':['µg','μg','mcg'].includes(unit)?'mcg':'mg';p.basis=basis==='kg'?'kg':/^m[²2]$/.test(basis)?'bsa':'fixed';p.route=routes[0]||'';p.range=m[0];p.frequency=frequency(text);p.kind='dose';
  if(period){if(/day/i.test(period))reasons.push('1일 총량은 1회량으로 자동 전환하지 않음');else if(basis!=='kg'||p.route!=='IV'||!/(?:\bCRI\b|constant rate infusion|continuous(?:ly)? infusion)/i.test(full))reasons.push('시간당 용량의 지속정주 조건 확인 필요');else{p.kind='cri';p.doseUnit=p.unit+'/kg/'+(/min/i.test(period)?'min':'hr');if(p.unit==='U'&&/min/i.test(period))reasons.push('분당 활성단위는 별도 환산 필요');}}
  if(!period&&/\bCRI\b|constant rate infusion|continuous infusion/i.test(full))reasons.push('지속정주 단위·기간을 원문에서 확인');
  p.eligible=reasons.length===0;return p;
 }
 function analyze(entry){const sections=(entry.sections||[]).filter(s=>s.heading==='Dosages'),profiles=[],speciesText={dog:[],cat:[]},notes=[];let index=0;
  for(const section of sections){for(const scope of splitSpecies(section.text)){if(!scope.species.length){if(scope.label==='종 구분 전 안내')notes.push(scope.text);continue;}for(const species of scope.species){speciesText[species].push(scope.text);for(const topic of splitTopics(scope.text))profiles.push(candidate(entry,topic,species,index++,notes.join('\n')));}}}
  return {version:VERSION,profiles,speciesText,notes:notes.join('\n'),coverage:sections.length?'explicit-species':'reference-only'};
 }
 const api={version:VERSION,clean,splitSpecies,splitTopics,frequency,analyze};if(typeof module!=='undefined')module.exports=api;g.PracticeLibraryDose=api;
})(typeof window==='undefined'?globalThis:window);
