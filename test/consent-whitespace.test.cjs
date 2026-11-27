const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../surgery-consent-form.js'),heading='마취·진정 설명 (기본 문구 2026-11-18)';
function editor(value){
 const canonical={value},parts=api.split(value),inputs=['base','anesthesia'].map(part=>({value:parts[part],dataset:{surgeryKey:'method',surgeryPart:part},parentElement:{hidden:false}}));
 const form={elements:{method:canonical},classList:{contains:c=>c==='su-linear-form'},querySelector:()=>null,querySelectorAll:q=>q==='[data-surgery-key]'?inputs:[]};
 return {canonical,inputs,type(part,chunk){const input=inputs.find(n=>n.dataset.surgeryPart===part);input.value+=chunk;const expected=input.value;canonical.value=api.replace(canonical.value,part,input.value);api.sync(form);assert.equal(input.value,expected,'input must survive the actual form synchronizer');return input.value;}};
}
for(const eol of ['\n','\r\n'])for(const plan of ['', '선택한 마취 계획: 전신마취'+eol,'선택한 마취 계획: 진정'+eol])test('spaces and blank lines survive keystroke sync '+JSON.stringify({eol,plan}),()=>{
 const original='수술 설명'+eol+eol+plan+heading+eol+'마취 설명',e=editor(original);
 for(const part of ['base','anesthesia']){const other=part==='base'?'anesthesia':'base',before=api.split(e.canonical.value)[other];for(const chunk of [' ',' ','추','가',' ', '\n','\n','관찰'])e.type(part,chunk);assert.equal(api.split(e.canonical.value)[other],before);}
 const saved=JSON.parse(JSON.stringify({body:{method:e.canonical.value},status:'draft'}));assert.equal(api.replace(saved.body.method,'base',api.split(saved.body.method).base),saved.body.method);
 assert.equal(api.replace(original,'base',api.split(original).base),original);
});
test('leading anesthesia whitespace and spaces-only answers survive replacement',()=>{
 const original='수술\n\n'+heading+'\n마취';
 for(const text of [' ','  \n','  환자별 설명\n\n'])for(const part of ['base','anesthesia'])assert.equal(api.split(api.replace(original,part,text))[part],text);
});
test('plain surgery text without anesthesia retains spaces and newlines',()=>{
 const e=editor('수술');for(const chunk of [' ','계획','\n','\n',' ','관찰'])e.type('base',chunk);assert.equal(e.canonical.value,'수술 계획\n\n 관찰');
});
test('signed snapshots and statutory rendering preserve content without mutation',()=>{
 const body={kind:'surgery',method:'수술  설명\n\n\n'+heading+'\n  마취 설명\n',signatures:{doctor:[[[1,2]]],guardian:[[[3,4]]]}},doc={body,status:'signed',signedAt:'2026-11-27',hash:'unchanged'},before=JSON.stringify(doc);
 const html=api.documentHTML(doc,{legal:true,screen:true,svg:()=>'<svg></svg>'});assert.ok(html.includes('수술  설명'));assert.ok(html.includes('  마취 설명'));assert.equal(JSON.stringify(doc),before);
});
