/* Keep training independent of the selected patient and the material builder. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 separateSop:true, navigation:()=>window.ClinicNavigation?.changed(),
 request:(path,options)=>saasRequest('/saas/training'+path,options),
 isReady:()=>saasMode==='auth'&&!!saasMe,
 identity:()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id].join(':')
});
if(document.getElementById('training').classList.contains('active-view'))window.CarestepTraining.open();
