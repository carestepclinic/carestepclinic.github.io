/* Guardian material composer: UI organization only; saving and delivery stay explicit. */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const homeTypes=new Set(['pdf','summary','medcheck']);
let root,search,manual,delivery='home',previewPage=0,queued=false;
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls='btn btn-secondary'){const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;}
function details(label,cls){const d=el('details',null,cls);d.append(el('summary',label));return d;}
function text(id,value){const n=$(id);if(n&&n.textContent!==value)n.textContent=value;}
function requestSync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
function confirmTemplateChange(){
 const fields=['caseProcedure','caseMedication','caseFeeding','caseActivity','caseProtection','caseExtra'];
 const changed=fields.some(id=>$(id)?.value?.trim())||typeof validMedications==='function'&&validMedications().length>0||$('recheckManual')?.value||$('recheckMode')?.value!=='14';
 const following=typeof activePatientJourney!=='undefined'&&!!activePatientJourney;
 if(!changed&&!following)return true;
 return global.confirm('안내자료를 변경하면 현재 입력한 진단·개별 안내·복약·재진·후속관리 계획이 초기화됩니다. 환자명·보호자명·관리 시작일은 유지됩니다. 변경할까요?');
}
function hook(name,after){const old=global[name];if(typeof old!=='function')return;global[name]=function(...args){const result=old.apply(this,args);after(...args);return result;};}
function showSearch(){search.open=true;setWizardStep(1);$('templateSearch')?.focus({preventScroll:true});search.scrollIntoView({block:'nearest'});}
function panelMode(mode){root.dataset.panel=mode;root.querySelectorAll('[data-builder-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.builderPanel===mode)));fitPreview();}
function selectDelivery(mode){delivery=mode;root.dataset.delivery=mode;root.querySelectorAll('[data-builder-delivery]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.builderDelivery===mode)));syncOutputs();}
function syncOutputs(){
 if(!root)return;
 const home=delivery==='home',selected=typeof selectedOutputTypes==='function'?selectedOutputTypes():[];
 const chosen=home?selected.filter(k=>homeTypes.has(k)):selected;
 root.querySelectorAll('.output-option').forEach(n=>{n.hidden=home&&!homeTypes.has(n.dataset.output);});
 $('builderExtraOutputs').hidden=home;
 const extraCount=[...$('builderExtraOutputs').querySelectorAll('.output-select:checked')].length;
 $('builderExtraOutputs').firstElementChild.textContent='추가 자료'+(extraCount?' · '+extraCount+'종 선택':'');
 text('selectedOutputSummary',(home?'HOME 게시':'파일·복사')+' 대상 '+chosen.length+'종 · '+(chosen.map(outputLabel).join(' · ')||'자료를 선택하세요'));
 const excluded=selected.filter(k=>!homeTypes.has(k));
 text('builderDeliveryNote',home?'HOME 게시와 복약 일정 등록은 별도입니다.'+(excluded.length?' 파일 전용 '+excluded.length+'종은 파일 저장에서 이용하세요.':''):'체크한 자료를 저장합니다. 미리보기와 저장 대상은 별도로 선택합니다.');
 root.querySelector('.builder-home-send').hidden=!home;
 root.querySelector('.builder-save-options').hidden=home;
 for(const id of ['outputFormatMode','batchDownloadMode','individualDownloadPanel'])$(id)?.classList.toggle('builder-file-only-hidden',home);
 // A selected optional output remains discoverable when switching back to files.
 if(!home&&extraCount)$('builderExtraOutputs').open=true;
}
function previewPages(){return [...$('pdfDocument').children].filter(n=>n.matches('.page,.pdf-page,.med-page'));}
function fitPreview(){
 if(!root||!root.classList.contains('active-view'))return;
 const wrap=root.querySelector('.preview-wrap'),doc=$('pdfDocument'),phone=$('phonePreview');
 const width=Math.max(0,wrap.clientWidth-24);
 for(const n of [doc,phone]){n.style.zoom='';const natural=n.scrollWidth;if(width>0&&natural>width)n.style.zoom=String(Math.min(1,width/natural));}
}
function paintPreview(){
 const pages=previewPages();previewPage=Math.max(0,Math.min(previewPage,pages.length-1));
 pages.forEach((p,i)=>p.classList.toggle('builder-page-hidden',i!==previewPage));
 $('builderPreviewPages').hidden=pages.length<2||$('pdfDocument').classList.contains('hidden');
 text('builderPreviewPage',(previewPage+1)+' / '+pages.length+'쪽');
 $('builderPreviewPrev').disabled=previewPage<=0;$('builderPreviewNext').disabled=previewPage>=pages.length-1;
 requestAnimationFrame(fitPreview);
}
function stepPreview(){
 if(!root)return;
 const step=typeof currentWizardStep==='number'?currentWizardStep:1;
 $('wizardNext').hidden=step===5;
 const type=({1:'pdf',2:'summary',3:'meds',4:'summary'})[step];
 if(type&&currentOutput!==type){currentOutput=type;renderCurrentOutput();}
 previewPage=0;paintPreview();requestSync();panelMode('write');
}
function sync(){
 if(!root)return;
 document.body.classList.toggle('builder-guide-active',root.classList.contains('active-view'));
 const ready=typeof clinicEducationReady==='function'&&clinicEducationReady();
 if(!ready)search.open=true;
 const patient=typeof caseInfo==='object'?caseInfo:{};
 const context=global.crmMaterialContext?.();
 text('builderPatientSummary',patient.patientName?(patient.patientName+(patient.guardianName?' · 보호자 '+patient.guardianName:'')):'환자를 선택하거나 표시 이름을 입력하세요');
 text('builderPatientChoose',context?.patientId?'환자 변경':'환자 선택');
 text('builderDraftSummary',$('clinicDraftTools')?.querySelector('input')?.checked?'초안 임시보관 · 켜짐':'초안 임시보관 · 꺼짐');
 const cloud=$('clinicSyncStatus');if(cloud)cloud.setAttribute('aria-label','병원 설정 동기화 상태 · 작성 초안 저장과 별개');
 text('builderMaterialChoice',ready?($('builderContextEducation')?.textContent||'선택한 자료'):'안내자료 검색·선택');
 syncOutputs();fitPreview();
}
function mount(){
 root=$('builder');if(!root||$('builderFlowBar'))return;
 root.classList.add('builder-flow');root.dataset.panel='write';
 const controls=root.querySelector('.builder-controls'),context=root.querySelector('.builder-case-context'),pane=root.querySelector('[data-wizard-pane="1"]');
 // One visible patient action. Existing CRM selection and guards are reused.
 const patientBox=el('div',null,'builder-patient-summary');patientBox.append(el('strong','',''));patientBox.firstElementChild.id='builderPatientSummary';
 const choose=button('환자 선택',()=>$('openPatientCrmPicker').click());choose.id='builderPatientChoose';patientBox.append(choose);context.before(patientBox);
 const source=details('', 'builder-material-choice');source.id='builderMaterialSearch';const title=el('span');title.id='builderMaterialChoice';source.firstElementChild.append(title);search=source;
 const searchLabel=pane.querySelector('[for="templateSearch"]'),searchBox=pane.querySelector('.template-search-wrap');source.append(searchLabel,searchBox);context.after(source);
 $('templateSearch').placeholder='질환명·증상 검색';
 const change=$('builderChangeEducation');change.textContent='자료 변경';change.addEventListener('click',showSearch);source.firstElementChild.setAttribute('aria-label','안내자료 검색 또는 변경');
 const casePanel=pane.querySelector('.case-panel');manual=details('표시 이름 직접 입력·수정','builder-name-editor');manual.id='builderManualNames';
 const grid=casePanel.querySelector('.case-grid'),names=[...grid.children].slice(0,2);const nameGrid=el('div',null,'case-grid');nameGrid.append(...names);manual.append(nameGrid,el('p','이름 수정은 이번 자료에만 반영됩니다. 환자 기본정보는 환자 관리에서 변경하세요.','builder-help'));grid.before(manual);
 const nameToggle=$('includePatientNames').closest('.span-2');const more=details('표시·날짜 설정','builder-options');more.append(nameToggle,$('caseDatePreview'));grid.after(more);
 casePanel.querySelector('label[for="dischargeDate"]').textContent='관리 시작일 · 퇴원 안내는 퇴원일';
 $('caseDatePreview').setAttribute('aria-label','관리 시작일 기준 안내 날짜');
 const bar=el('div',null,'builder-flow-bar');bar.id='builderFlowBar';root.prepend(bar);
 const tabs=el('div',null,'builder-panel-tabs');tabs.setAttribute('aria-label','작성과 미리보기');for(const [mode,label] of [['write','작성'],['preview','미리보기']]){const b=button(label,()=>panelMode(mode));b.dataset.builderPanel=mode;tabs.append(b);}bar.append(tabs);
 const draft=$('clinicDraftTools');if(draft){const d=details('','builder-draft-settings');d.firstElementChild.id='builderDraftSummary';const list=draft.querySelector('button');if(list)bar.append(list);d.append(draft,el('p','이 브라우저 탭에서 2시간 보관합니다. HOME 게시 상태와는 별개입니다.','builder-help'));bar.append(d);}
 const info=details('보관·게시 안내','builder-storage-help');info.append(el('p','작성 중 초안은 임시보관 설정을 따릅니다. 파일 다운로드는 PC에 저장하며 HOME에 공개하지 않습니다. HOME 게시 시 자료와 PDF가 서버에 저장되고, 복약 일정은 별도로 등록합니다.','builder-help'));bar.append(info);
 const output=root.querySelector('[data-wizard-pane="5"]'),deliveryTabs=el('div',null,'builder-delivery-tabs');deliveryTabs.setAttribute('aria-label','전달 방법');for(const [mode,label] of [['home','HOME 게시'],['file','파일 저장·인쇄']]){const b=button(label,()=>selectDelivery(mode));b.dataset.builderDelivery=mode;deliveryTabs.append(b);}output.querySelector('.wizard-pane-title').after(deliveryTabs);
 const extras=details('추가 자료','builder-extra-outputs');extras.id='builderExtraOutputs';const chooser=$('outputChooser');for(const n of [...chooser.children])if(!['pdf','summary','meds','medcheck'].includes(n.dataset.output))extras.append(n);chooser.append(extras);
 const note=el('p',null,'builder-help');note.id='builderDeliveryNote';$('selectedOutputSummary').after(note);
 const previewBar=el('div',null,'builder-preview-pages');previewBar.id='builderPreviewPages';const prev=button('이전 쪽',()=>{previewPage--;paintPreview();}),next=button('다음 쪽',()=>{previewPage++;paintPreview();}),count=el('span');prev.id='builderPreviewPrev';next.id='builderPreviewNext';count.id='builderPreviewPage';previewBar.append(prev,count,next);root.querySelector('.preview-toolbar').after(previewBar);
 root.addEventListener('input',requestSync);root.addEventListener('change',requestSync);
 hook('renderBuilderContext',requestSync);hook('renderTemplateSearch',requestSync);hook('updateSelectedOutputUi',requestSync);hook('setWizardStep',stepPreview);
 const previousSwitch=global.switchCaseTemplate;global.switchCaseTemplate=function(...args){const changed=previousSwitch.apply(this,args);if(changed&&clinicEducationReady())search.open=false;requestSync();return changed;};
 hook('clinicConfirmEducation',()=>{search.open=false;requestSync();});
 hook('beginBuilderEdit',target=>{if(target==='education')showSearch();if(target==='patient'){manual.open=true;$('patientName').focus({preventScroll:true});}});
 global.addEventListener('carestep:output-rendered',()=>{previewPage=0;paintPreview();requestSync();});
 new MutationObserver(requestSync).observe(root,{attributes:true,attributeFilter:['class']});
 if(global.ResizeObserver)new ResizeObserver(fitPreview).observe(root.querySelector('.preview-wrap'));
 selectDelivery('home');panelMode('write');sync();paintPreview();
}
global.CarestepBuilderFlow={confirmTemplateChange,mount,selectDelivery,panelMode};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(window);
