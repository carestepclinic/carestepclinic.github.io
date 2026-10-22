window.CarestepPractice=PracticeTools.mount(document.getElementById('practiceRoot'),{
 request:(path,options)=>saasRequest('/saas'+path,options),
 ready:()=>saasMode==='auth'&&!!saasMe,
 identity:()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id,JSON.stringify(saasMe?.permissions||{}),saasMe?.role].join(':'),
 can:key=>saasPermission(key,true),navigate:view=>go(view),
 patient:()=>{const x=window.crmMaterialContext?.();return x?.patientId?{id:x.patientId,name:x.patient?.name||'',guardianName:x.guardian?.name||''}:null;}
});
if(document.getElementById('practice').classList.contains('active-view'))window.CarestepPractice.open();
