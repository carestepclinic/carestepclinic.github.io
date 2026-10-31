const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../clinical-efficiency.js');
test('copy logs stay unmodified and do not become a second acknowledgment task',()=>{
 const copy={id:'copy',mode:'copy',title:'Synthetic copy',plannedAt:'2026-11-01T08:30Z',previous:[]};
 const move={id:'move',mode:'move',title:'Synthetic move',plannedAt:'2026-11-01T09:30Z',previous:[]};
 const change={id:'change',title:'Synthetic dose change',effectiveAt:'2026-11-01T10:30Z',previous:[]};
 const item={body:{orderChanges:[copy]}};const original=JSON.stringify(item);const view=C.create({item:()=>item,esc:s=>String(s||''),canRecord:()=>true});
 assert.equal(view.notices(),'');assert.equal(JSON.stringify(item),original);item.body.orderChanges.push(move,change,{...change,id:'done',ackAt:'2026-11-01T10:31Z'});const html=view.notices();assert.match(html,/확인 대기 2건/);assert.doesNotMatch(html,/Synthetic copy/);assert.match(html,/Synthetic move/);assert.match(html,/Synthetic dose change/);assert.equal(copy.ackAt,undefined);
});
