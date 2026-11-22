/* Synthetic data and mock requests only. No remote services or real records. */
(async()=>{
 const results=[],ok=(v,label)=>{if(!v)throw Error(label);results.push(label);},wait=()=>new Promise(r=>setTimeout(r,40));
 let identity='synthetic:a',reader=false,denied=false,done=false,many=false;const calls=[],opened=[];
 const root=document.querySelector('#documents'),practiceRoot=document.querySelector('#practiceRoot');
 const patient={id:'synthetic-patient',name:'가상 환자',guardianName:'가상 보호자',chartNumber:'TEST001',species:'cat'};
 const health=id=>({id,clinicalStatus:done?'complete':'inProgress',updatedAt:id==='old'?'2026-11-20T00:00:00Z':'2026-11-22T00:00:00Z',patient});
 const body={kind:'surgery',title:'가상 수술 동의서',patientName:'가상 환자',guardianName:'가상 보호자',patientId:patient.id,species:'고양이',diagnosis:'가상 진단',necessity:'가상 필요성',method:'가상 방법',risks:'가상 위험',precautions:'가상 주의',cost:'가상 비용'};
 const docs={c:{id:'c',status:'draft',revision:1,body},signed:{id:'signed',status:'signed',revision:1,body:{...body,signatures:{}},signedAt:'2026-11-22T00:00:00Z'},deleted:{id:'deleted',status:'draft',deleted:true,revision:1,body}};
 const request=async(path,o={})=>{calls.push({path,method:o.method||'GET'});if(o.method&&o.method!=='GET')throw Error('writes prohibited in this fixture');
 if(path.includes('consents/preferences'))return {revision:1,doctors:[],templates:[],canManage:true};
 if(path.includes('/consents?'))return {items:[{...docs.c,patientName:'가상 환자',title:'가상 수술 동의서',updatedAt:'2026-11-22T01:00:00Z',status:done?'signed':'draft'},{...docs.signed,patientName:'완료 문서'},{...docs.deleted,patientName:'삭제 문서'}],next:''};
 if(path.includes('/consents/')){const id=path.split('/').at(-1);if(!docs[id])throw Error('찾을 수 없는 문서');return {document:structuredClone(docs[id])};}
 if(path.includes('/cases/')){const id=path.split('/cases/')[1].split('?')[0];const chart=HealthcheckRecord.blank();chart.patient=patient;chart.date='2026-11-22';return {item:{id,revision:1,patient_id:patient.id,patient,body:{species:'cat',healthcheckChart:chart}}};}
 if(path.includes('/healthcheck?'))return {items:[health('h'),health('old'),{...health('complete'),clinicalStatus:'complete'},...(many?Array.from({length:6},(_,i)=>({...health('extra'+i),updatedAt:'2026-11-22T0'+(i+2)+':00:00Z'})):[])],next:''};
 return {items:[],members:[]};};
 const adapter={ready:()=>true,identity:()=>identity,can:()=>!reader,access:()=>({allowed:true}),patient:()=>null,hospital:()=>({name:'가상 병원'}),navigation:()=>{},request,consentSources:async()=>({items:[]}),consentEducation:async()=>({items:[]})};
 let practice=PracticeTools.mount(practiceRoot,adapter);
 const board=ClinicTodayDocuments.mount(root,{ready:()=>true,identity:()=>identity,allowed:()=>!denied,editable:()=>!reader,today:()=> '2026-11-22',request,open:async(kind,id)=>{opened.push([kind,id]);if(!practice.prepareTab(kind))return false;await practice.open({practiceDocument:{kind,id}});}});
 try{
 await board.refresh();ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===2,'today contains unfinished report and unsigned consent');
 ok(root.querySelectorAll('.cs-documents-past .cs-document-row').length===1,'past unfinished documents separate');ok(!root.querySelector('details').open,'past documents collapsed initially');
 ok(![...root.querySelectorAll('.cs-document-copy b')].some(x=>x.textContent.includes('완료 문서')||x.textContent.includes('삭제 문서')),'signed/deleted excluded');
 root.querySelector('details').open=true;await wait();await board.refresh();ok(root.querySelector('details').open,'expanded past selection survives refresh');
 await root.querySelector('[data-document-action="healthcheck:h"]').onclick();ok(practiceRoot.querySelector('[data-hc-editor]'),'opens real healthcheck editor');ok(calls.some(x=>x.path.includes('/cases/h?view=healthcheck')),'opens selected report by ID');
 const before=calls.filter(x=>x.path.includes('/cases/h?')).length;const field=practiceRoot.querySelector('textarea');ok(field,'report has editable input');field.value='작성 중 가상 내용';
 await root.querySelector('[data-document-action="healthcheck:h"]').onclick();ok(field.isConnected&&field.value==='작성 중 가상 내용','same report keeps existing workspace');ok(calls.filter(x=>x.path.includes('/cases/h?')).length===before,'same report does not refetch and overwrite');
 await root.querySelector('[data-document-action="consents:c"]').onclick();ok(practiceRoot.querySelector('[data-consent-form]'),'opens real consent editor directly');
 const input=practiceRoot.querySelector('[data-consent-form] textarea');ok(input,'consent has editable input');input.value='저장 전 가상 입력';input.dispatchEvent(new Event('input',{bubbles:true}));await wait();
 const consentReads=calls.filter(x=>x.path.endsWith('/consents/c')).length;
 await root.querySelector('[data-document-action="consents:c"]').onclick();ok(input.isConnected&&input.value==='저장 전 가상 입력','same consent preserves unsaved typing');ok(calls.filter(x=>x.path.endsWith('/consents/c')).length===consentReads,'same consent not replaced from server');
 // Use a separate real support controller to verify stale dashboard entries safely open current status.
 const supportRoot=document.createElement('div');practiceRoot.append(supportRoot);const support=ClinicSupport.mount(supportRoot,adapter,'consents');
 await support.openDocument('signed');ok(!supportRoot.querySelector('[data-consent-form]')&&supportRoot.textContent.includes('서명'),'consent signed elsewhere opens review instead of editing');
 let rejected=false;try{await support.openDocument('deleted');}catch{rejected=true;}ok(rejected,'deleted document cannot enter editor');support.dispose();
 const directRoot=document.createElement('div');practiceRoot.append(directRoot);reader=true;const readonly=ClinicSupport.mount(directRoot,adapter,'consents');await readonly.openDocument('c');ok(!directRoot.querySelector('[data-consent-form]'),'read-only user cannot edit draft');readonly.dispose();
 await board.refresh();ok(root.querySelector('[data-document-action="consents:c"]').textContent==='문서 보기','read-only dashboard action says view');reader=false;
 done=true;await board.refresh();ok(!root.querySelector('.cs-document-row'),'completed/signed documents removed after refresh');done=false;
 many=true;await board.refresh();
 ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===5,'many documents initially show five');
 ok(root.querySelector('.cs-documents-current [data-document-action]').dataset.documentAction==='healthcheck:extra5','newest document appears first');
 ok(root.querySelector('[data-document-action=expand-today]').textContent==='나머지 3건 더 보기','remaining count shown');
 root.querySelector('[data-document-action=expand-today]').click();ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===8,'expand shows all today documents');
 await board.refresh();ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===8,'refresh preserves expanded choice');
 root.querySelector('[data-document-action=expand-today]').click();ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===5,'collapse restores five');
 root.querySelector('[data-document-action=expand-today]').click();identity='synthetic:b';await board.refresh();ok(root.querySelectorAll('.cs-documents-current .cs-document-row').length===5,'clinic switch resets expanded documents');
 many=false;await board.refresh();ok(!root.querySelector('[data-document-action=expand-today]'),'small list has no unnecessary expand control');
 denied=true;await board.refresh();ok(root.hidden,'no access hides document summary');denied=false;await board.refresh();
 board.clear();ok(root.hidden&&!root.children.length,'logout clear removes all visible documents');await board.refresh();
 ok(calls.every(x=>x.method==='GET'),'all requests read-only; no AI/signature/payment/message actions');
 practice.clear();root.querySelector('details').open=false;await wait();
 ok(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
 ok([...root.querySelectorAll('button')].filter(b=>b.getClientRects().length).every(b=>b.getBoundingClientRect().height>=36),'touch targets at least 36 pixels');
 }catch(e){results.push('FAIL: '+e.stack);}finally{window.qaResults={passed:results.filter(x=>!x.startsWith('FAIL')).length,results};document.querySelector('#results').textContent=JSON.stringify(window.qaResults);document.documentElement.dataset.qa=results.some(x=>x.startsWith('FAIL'))?'FAIL':'PASS';}
})();
