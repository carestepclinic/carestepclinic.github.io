/* Uses the existing HQ session; never distributes HQ credentials to a clinic. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 common:true,request:(path,options)=>req('/hq/training'+path,options),
 isReady:()=>!!hqSessionToken(),
 identity:()=>hqSessionToken()||'hq-signed-out'
});
if(document.getElementById('training').classList.contains('active'))window.CarestepTraining.open();
