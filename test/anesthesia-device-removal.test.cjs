const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../anesthesia-record.js'),E=require('../anesthesia-efficiency.js');

test('print omits legacy device metadata while retaining airway, procedure and patient fields',()=>{
 const item={patient:{name:'가상 환자'},body:{species:'cat',weight:4,anesthesiaSheet:{device:'LEGACY-DEVICE-MARKER',tube:'ET tube 4.0 mm',operation:'가상 수술'}}};
 const before=structuredClone(item);
 const html=A.printDocument({rows:[],ranges:[{start:Date.parse('2026-11-15T01:00:00Z'),minutes:60}],item,fieldValues:{...item.body.anesthesiaSheet}});
 assert.doesNotMatch(html,/장비명·규격|LEGACY-DEVICE-MARKER/);
 for(const value of ['ET tube 4.0 mm','가상 수술','가상 환자'])assert.ok(html.includes(value));
 assert.deepEqual(item,before);
});

test('legacy common templates still load measurement order and reminder period',async()=>{
 const legacy={kind:'anesthesia-template',device:'LEGACY-DEVICE',measurementOrder:['etco2','systolic'],reviewMinutes:5},view={};let rendered=0;
 const before=structuredClone(legacy);
 const controller=E.create({item:{status:'active',body:{}},view,medical:true,valid:()=>true,api:async()=>({items:[{body:legacy}]}),render:()=>rendered++});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(view.measurementOrder,legacy.measurementOrder);assert.equal(view.reviewMinutes,5);assert.equal(rendered,1);assert.equal(Object.hasOwn(view,'device'),false);
 assert.match(controller.setup(),/측정 입력 서식/);assert.doesNotMatch(controller.setup(),/측정·장비/);assert.deepEqual(legacy,before);
});

test('selecting and saving a measurement template no longer needs a device input',async()=>{
 const legacy={id:'legacy',body:{kind:'anesthesia-template',title:'가상 서식',device:'LEGACY-DEVICE',measurementOrder:['etco2','heartRate','systolic'],reviewMinutes:7}};
 const form={dataset:{clRequestKey:'synthetic-key'},elements:{template:{value:'legacy'},title:{value:''},reviewMinutes:{value:''},saveCommon:{checked:true}},querySelector:()=>({})};
 for(let i=0;i<8;i++)form.elements['metric'+i]={value:''};
 const writes=[],view={workflowChecked:true};let submit,markup;
 const controller=E.create({item:{status:'active',body:{anesthesiaSheet:{device:'LEGACY-DEVICE'}}},view,medical:true,valid:()=>true,
  api:async(url,method,body)=>{if(method==='POST')writes.push(body);return {items:[legacy]};},
  modal(title,html,callback){markup=title+html;submit=callback;return {querySelector:()=>form};}
 });
 await controller.configure();assert.doesNotMatch(markup,/name="device"|장비명·규격|LEGACY-DEVICE/);
 form.elements.template.onchange();assert.equal(form.elements.reviewMinutes.value,7);assert.equal(form.elements.metric0.value,'etco2');
 await submit(form);assert.equal(writes.length,1);assert.equal(Object.hasOwn(writes[0].body,'device'),false);assert.equal(writes[0].body.reviewMinutes,7);
 assert.deepEqual(writes[0].body.measurementOrder,['etco2','heartRate','systolic','diastolic','meanPressure']);assert.equal(view.reviewMinutes,7);
});
