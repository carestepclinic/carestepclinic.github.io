/* Adult energy planning references. Targets are estimates and require follow-up. */
(function(g){
 'use strict';
 const sources={
  pna:{label:'Pet Nutrition Alliance · 에너지 요구량',url:'https://petnutritionalliance.org/wp-content/uploads/2023/03/MER.RER_.PNA_.pdf'},
  osu:{label:'Ohio State · 개의 체중 조절',url:'https://vmc.vet.osu.edu/services/companion-animal-nutrition-support-service'},
  cat:{label:'Royal Canin Academy · 저체중 성묘의 에너지 평가',url:'https://academy.royalcanin.com/en/veterinary/unexplained-weight-loss-in-the-cat'}
 };
 const profiles=[
  {id:'rest',label:'휴식 에너지 · RER만 확인',dog:[1],cat:[1],source:'pna',note:'휴식 에너지 기준입니다. 일반 성체의 유지 열량이나 입원 환자의 실제 급여 시작량과 같지 않습니다.'},
  {id:'intact',label:'표준 성체 유지 · 미중성화',dog:[1.8],cat:[1.4],source:'pna'},
  {id:'neutered',label:'중성화 성체 유지',dog:[1.6],cat:[1.2],source:'pna'},
  {id:'inactive',label:'비만 경향·활동량 적음 · 유지',dog:[1.2,1.3,1.4],cat:[1],source:'pna',note:'체중 유지 참고값입니다. 이미 비만인 환자의 감량 계획은 아래 감량 항목에서 목표 체중으로 계산하세요.'},
  {id:'loss',label:'체중 감량·비만 관리',dog:[1],cat:[0.8,0.9,1],target:true,source:'pna',note:'수의사가 정한 목표 체중의 RER을 사용합니다. 현재 섭취량·BCS·MCS와 감량 속도를 함께 평가하고, 고양이의 급격한 제한과 절식을 피하세요.'},
  {id:'gain',label:'체중 증량·저체중 회복',dog:[1.2,1.4,1.6,1.8],cat:[1.2,1.3,1.4],target:true,source:'osu',note:'목표 체중으로 산정하는 성체의 장기 목표입니다. 장기 절식·중증 저체중의 재급식 시작량이 아니며, 원인 평가와 단계적 급여 계획이 필요합니다.'}
 ];
 function profile(id,species){const p=profiles.find(p=>p.id===id);return p&&['dog','cat'].includes(species)?{...p,values:p[species],source:sources[id==='gain'&&species==='cat'?'cat':p.source]}:null;}
 function kg(value,label){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(String(value).trim())||Number(value)<=0||Number(value)>200)throw Error(label+'을 0보다 크고 200 kg 이하로 입력해주세요.');return Number(value);}
 function resolve(v,species){
  const current=kg(v.weight,'현재 체중'),p=profile(v.nutritionProfile,species);
  if(v.nutritionProfile&&v.nutritionProfile!=='manual'&&!p)throw Error('동물 종류와 영양 목적을 다시 선택해주세요.');
  const target=p?.target?kg(v.targetWeight,'목표 체중'):current;
  if(p?.id==='loss'&&target>current)throw Error('감량 목표 체중은 현재 체중 이하로 입력해주세요.');
  if(p?.id==='gain'&&target<current)throw Error('증량 목표 체중은 현재 체중 이상으로 입력해주세요.');
  if(p&&!p.values.includes(Number(v.multiplier)))throw Error('선택한 목적의 배수를 확인하거나 직접 입력으로 전환해주세요.');
  return {current,weight:target,profile:p,target:!!p?.target};
 }
 function mount(main,o){
  const f=main.querySelector('[data-calc=nutrition]'),m=f.elements.multiplier;
  const box=document.createElement('section');box.className='pt-nutrition-plan';
  box.innerHTML='<label>영양 목적<select name="nutritionProfile"><option value="manual">배수 직접 입력 / 병원 계산 서식</option></select></label><label data-nutrition-range hidden>적용할 RER 배수<select data-nutrition-factor></select></label><label data-nutrition-target hidden>수의사가 정한 목표 체중 · kg<input name="targetWeight" inputmode="decimal" autocomplete="off" placeholder="BCS·MCS를 평가한 목표 체중"></label><p data-nutrition-summary role="status"></p><p class="pt-help" data-nutrition-note></p><details><summary>배수의 근거·적용 범위</summary><p class="pt-help">성체 개·고양이의 초기 추정값입니다. 배수가 범위로 제시된 경우 낮은 값을 먼저 표시하며, 실제 섭취량과 체중 변화에 맞춰 조정하세요. 성장·임신·수유·중환자·재급식은 개별 계획을 직접 입력합니다.</p><a data-nutrition-source target="_blank" rel="noopener noreferrer"></a></details>';
  f.querySelector('.pt-calc-rer').after(box);box.querySelector('label').after(m.closest('label'));
  const sel=f.elements.nutritionProfile,target=f.elements.targetWeight,factor=box.querySelector('[data-nutrition-factor]');let writing=false;
  function info(){const p=profile(sel.value,o.species.value);box.querySelector('[data-nutrition-summary]').textContent=p?(o.species.value==='cat'?'고양이':'개')+' · '+p.label+' · '+m.value+' × '+(p.target?'목표':'현재')+' 체중의 RER':'';box.querySelector('[data-nutrition-note]').textContent=p?.note||'급여 후 체중·BCS·MCS와 섭취량을 재평가해 목표 열량을 조정하세요.';const a=box.querySelector('[data-nutrition-source]'),s=p?.source||sources.pna;a.href=s.url;a.textContent=s.label;}
  function render(){const p=profile(sel.value,o.species.value);m.closest('label').hidden=!!p;box.querySelector('[data-nutrition-range]').hidden=!p;box.querySelector('[data-nutrition-target]').hidden=!p?.target;target.required=!!p?.target;info();}
  function menu(){sel.replaceChildren(new Option('배수 직접 입력 / 병원 계산 서식','manual'));if(['dog','cat'].includes(o.species.value))for(const p of profiles)sel.add(new Option(p.label,p.id));sel.value='manual';target.value='';factor.replaceChildren();render();}
  function setFactor(){writing=true;m.value=factor.value;m.dispatchEvent(new Event('input',{bubbles:true}));writing=false;info();}
  sel.onchange=()=>{const p=profile(sel.value,o.species.value);target.value='';factor.replaceChildren();if(p){for(const n of p.values)factor.add(new Option(n+' × RER',String(n)));setFactor();}render();o.clear();};
  factor.onchange=setFactor;
  m.addEventListener('input',()=>{if(!writing&&sel.value!=='manual'){sel.value='manual';target.value='';render();}});
  f.addEventListener('reset',()=>queueMicrotask(menu));o.species.addEventListener('change',menu);
  main.closest('[data-body]')?.addEventListener('practice-protocol-applied',e=>{if(f.querySelector('[data-protocol]')?.value===e.detail.id)menu();});
  menu();
  return {values(v){return {...v,weight:resolve(v,o.species.value).weight};},describe(v){const x=resolve(v,o.species.value);return '현재 체중 '+x.current+' kg · '+(x.target?'목표 체중':'계산 기준 체중')+' '+x.weight+' kg\n영양 목적: '+(x.profile?.label||'수의사 직접 설정')+'\n'+(x.profile?.note||'초기 추정값 · 체중·BCS·MCS와 실제 섭취량에 따라 조정')+'\n근거 '+(x.profile?.source||sources.pna).url;}};
 }
 const api={profiles,profile,resolve,mount};g.PracticeNutrition=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
