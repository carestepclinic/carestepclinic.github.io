(function(g){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=n=>n==null?'미집계':Number(n)>=1e9?(Number(n)/1e9).toFixed(2)+' GB':(Number(n)/1e6).toFixed(2)+' MB';
const num=n=>Number(n||0).toLocaleString('ko-KR');
function mount(root,request){
 let data=null,busy=false,epoch=0,message='',query='';
 function clear(){epoch++;data=null;busy=false;message='';query='';render();}
 function rows(){return (data?.clinics||[]).filter(c=>(c.clinicName||'').toLocaleLowerCase().includes(query.toLocaleLowerCase()));}
 function body(){if(!data?.measuredAt)return '<p>아직 집계하지 않았습니다. ‘사용량 측정’을 눌러 확인하세요.</p>';
 const complete=data.photosComplete&&data.clinicsComplete;
 return '<p class="muted">측정 '+esc(new Date(data.measuredAt).toLocaleString('ko-KR'))+(complete?'':' · 일부 집계: 전체 사용량이 아닙니다.')+'</p><div class="storage-kpis">'+[['진료 기록·이력 본문',bytes(data.clinicalDbBytes)],['분리된 사진',bytes(data.photoBytes)],['사진 수',num(data.photos)+'개'],['집계 병원',num(data.clinics.length)+'곳']].map(([l,v])=>'<div><span>'+l+'</span><strong>'+v+'</strong></div>').join('')+'</div><label>병원 검색<input class="input" data-storage-search value="'+esc(query)+'" placeholder="병원명"></label><div class="table-wrap"><table class="table"><thead><tr><th>병원</th><th>기록 / 이력</th><th>기록 본문</th><th>사진</th><th>이달 측정 후 증감</th><th>사진 보관 추정 / 월</th></tr></thead><tbody>'+rows().map(c=>'<tr><td>'+esc(c.clinicName)+'</td><td>'+num(c.records)+' / '+num(c.events)+'</td><td>'+bytes(Number(c.recordBytes)+Number(c.eventBytes))+'</td><td>'+bytes(c.photoBytes)+'</td><td>'+(c.changeBytes==null?'기준 없음':(c.changeBytes<0?'−':'+')+bytes(Math.abs(c.changeBytes)))+'</td><td>'+(c.photoStorageEstimateUsd==null?'미집계':'$'+Number(c.photoStorageEstimateUsd).toFixed(4))+'</td></tr>').join('')+'</tbody></table></div><p class="muted">증감 기준: '+esc(data.baselineAt?new Date(data.baselineAt).toLocaleString('ko-KR'):'이달 첫 측정 전')+' · 월초부터의 증가량이 아닌 첫 측정 이후 변화입니다.</p><p class="muted">'+esc(data.note)+'</p><p class="muted">사진 보관료는 R2 Standard $0.015/GB·월 기준 단순 추정이며 무료 제공량·요청·백업·AI 비용은 제외합니다. <a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" rel="noopener">공식 요금 기준</a></p>';
 }
 function render(){root.innerHTML='<div class="head"><div><h2>진료 데이터·사진 저장 현황 <small>운영자 전용</small></h2><p>병원별 증가량을 확인하고 저장 공간 확장 시점을 검토합니다.</p></div><button class="btn" data-storage-refresh '+(busy?'disabled':'')+'>'+(busy?'측정 중…':'사용량 측정')+'</button></div><p role="status">'+esc(message)+'</p><div data-storage-body>'+body()+'</div><details class="storage-guide"><summary>백업·보관·확장 기준</summary><ul><li>신규 진료 사진은 비공개 저장소에 암호화하여 보관합니다. 기록 DB에는 연결 정보가 저장됩니다.</li><li>공통 교육·프로토콜은 공통 자료를 참조하며, 병원별 수정본은 별도로 보존합니다.</li><li>기존 구성백업은 병원 설정용입니다. 진료 DB의 복구 시점은 Cloudflare D1 Time Travel에서 확인하고, 사진 저장소는 별도로 백업해야 합니다.</li><li>진료 기록·사진은 기간만으로 자동 삭제하지 않습니다. 보존 정책과 환자 데이터 삭제 요청에 따라 처리합니다.</li><li>전체 DB 실사용량·요청 지연을 Cloudflare에서 함께 확인하세요. 한도에 도달하기 전에 병원 단위 저장소 분리를 계획합니다.</li></ul><a href="https://developers.cloudflare.com/d1/reference/time-travel/" target="_blank" rel="noopener">D1 복구 안내</a> · <a href="https://developers.cloudflare.com/d1/platform/limits/" target="_blank" rel="noopener">DB 용량·처리 한도</a></details>';
 root.querySelector('[data-storage-refresh]').onclick=()=>load(true);
 const search=root.querySelector('[data-storage-search]');if(search)search.oninput=e=>{query=e.target.value;const start=e.target.selectionStart;root.querySelector('[data-storage-body]').innerHTML=body();const next=root.querySelector('[data-storage-search]');next.focus();next.setSelectionRange(start,start);next.oninput=search.oninput;};
 }
 async function load(measure=false){if(busy)return;const n=++epoch;busy=true;message='';render();try{const r=await request('/hq/clinical-storage'+(measure?'/refresh':''),measure?{method:'POST',body:'{}'}:undefined);if(n!==epoch)return;data=r;}catch(e){if(n!==epoch)return;message='조회 실패 · '+e.message;if(e.status===401||e.status===403)data=null;}finally{if(n===epoch){busy=false;render();}}}
 render();return {load,clear};
}
g.HqClinicalStorage={mount};
})(globalThis);
