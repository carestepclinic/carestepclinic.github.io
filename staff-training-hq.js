/* Uses the existing HQ session; never distributes HQ credentials to a clinic. */
window.CarestepTraining=StaffTraining.mount(document.getElementById('staffTrainingRoot'),{
 common:true,request:(path,options)=>req('/hq/training'+path,options),
 isReady:()=>!!hqSessionToken(),
 identity:()=>hqSessionToken()||'hq-signed-out'
});
if(document.getElementById('training').classList.contains('active'))window.CarestepTraining.open();

const knowledgeToolbar=document.createElement("div");knowledgeToolbar.className="st-actions";knowledgeToolbar.innerHTML='<button type="button">진료 프로토콜 · 일괄 준비·승인</button>';document.getElementById("staffTrainingRoot").before(knowledgeToolbar);knowledgeToolbar.querySelector("button").onclick=()=>{if(!hqSessionToken())return;ClinicalKnowledge.openQueue({request:(p,o)=>req("/hq/training"+p,o),guard:()=>!!hqSessionToken()},"protocol");};
