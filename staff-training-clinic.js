/* Keep training independent of the selected patient and the material builder. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 request:(path,options)=>saasRequest('/saas/training'+path,options),
 isReady:()=>saasMode==='auth'&&!!saasMe,
 identity:()=>[saasMe?.clinic?.id,saasMe?.user?.id,saasSessionMeta?.id].join(':')
});
if(document.getElementById('training').classList.contains('active-view'))window.CarestepTraining.open();
