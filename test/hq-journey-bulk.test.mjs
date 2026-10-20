import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../hq.html',import.meta.url),'utf8');
const markup=source.slice(0,source.indexOf('<script>'));
const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);

function fixture() {
  const rows=[],posts=[],notices=[],nodes=new Map(),timers=[];
  let confirmResult=true, responder=async()=>({ok:true,json:async()=>({ok:true})});
  function node(id='') {
    const listeners={};
    return {id,value:'',checked:false,disabled:false,indeterminate:false,textContent:'',dataset:{},style:{},isConnected:true,
      set innerHTML(html){this.html=html;for(const m of html.matchAll(/\bid="([^"]+)"/g))if(!nodes.has(m[1]))nodes.set(m[1],node(m[1]));},
      get innerHTML(){return this.html||'';},
      classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,fn){listeners[type]=fn;},
      async dispatch(type){const fn=this['on'+type]||listeners[type];return fn?.({target:this});},
      appendChild(child){if(child.id)nodes.set(child.id,child);},
      querySelector(){return null;},
      querySelectorAll(selector){return selector.includes('data-journey-bulk')?rows:[];}
    };
  }
  for(const m of markup.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],node(m[1]));
  const select=(selector)=>{
    if(selector.includes('data-journey-bulk'))return rows.filter(r=>!selector.includes(':checked')||r.checked);
    return [];
  };
  const storage=()=>({getItem(){return null;},setItem(){},removeItem(){}});
  const ctx=vm.createContext({document:{getElementById:id=>nodes.get(id)||null,createElement:()=>node(),querySelectorAll:select,querySelector:s=>['.brand span','#loginOverlay .warn b'].includes(s)?node():null,addEventListener(){}},
    localStorage:storage(),sessionStorage:storage(),location:{hash:''},
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    confirm:()=>confirmResult,
    fetch:async(url,opt)=>{posts.push({url,...opt});return responder(url,opt);},
    console,URL,AbortController});
  for(const s of scripts)vm.runInContext(s,ctx);
  // Simulated requests only: no real endpoint or stored user authentication.
  nodes.get('endpoint').value='https://example.test';
  vm.runInContext("toast=t=>testNotices.push(t);loadPatientJourneysHQ=async()=>{};loadHqActionCenter=async()=>{};",Object.assign(ctx,{testNotices:notices}));
  return {ctx,rows,nodes,posts,notices,add(value,checked=false){const r=node();r.value=value;r.checked=checked;rows.push(r);return r;},
    confirm(value){confirmResult=value;},respond(fn){responder=fn;}};
}

test('actual HQ boot binds Journey bulk controls even when optional CRM/content/voice widgets are absent',()=>{
  const f=fixture();
  assert.equal(f.nodes.has('crmHqRefresh'),false);
  assert.equal(typeof f.nodes.get('journeySelectAllReview').onchange,'function');
  assert.equal(typeof f.nodes.get('journeyBulkApprove').onclick,'function');
  assert.equal(typeof f.nodes.get('journeyRefresh').onclick,'function');
});

test('select all, partial selection, clear and no eligible rows keep header/count/button consistent',async()=>{
  const f=fixture(),all=f.nodes.get('journeySelectAllReview'),button=f.nodes.get('journeyBulkApprove');
  f.add('a');f.add('b');f.add('');
  all.checked=true;await all.dispatch('change');
  assert.equal(f.nodes.get('journeyBulkSummary').textContent,'선택 2건');
  assert.equal(button.disabled,false);
  assert.equal(all.checked,true);
  f.rows[1].checked=false;f.ctx.updateJourneyBulkUi();
  assert.equal(all.indeterminate,true);assert.equal(all.checked,false);
  all.checked=false;await all.dispatch('change');
  assert.equal(f.ctx.selectedJourneyBulkIds().length,0);assert.equal(button.disabled,true);
  f.rows.length=0;f.ctx.updateJourneyBulkUi();
  assert.equal(all.disabled,true);assert.equal(all.checked,false);assert.equal(all.indeterminate,false);
  assert.equal(f.posts.length,0);
});

test('canceling final approval sends no requests; selected IDs are deduplicated',async()=>{
  const f=fixture();f.add('a',true);f.add('a',true);f.add('b',false);
  assert.deepEqual(Array.from(f.ctx.selectedJourneyBulkIds()),['a']);
  f.confirm(false);await f.ctx.bulkApproveJourneys();
  assert.equal(f.posts.length,0);
});

test('bulk approval sends each selected item once, blocks repeat clicks and reports partial failure',async()=>{
  const f=fixture();f.add('a',true);f.add('b',true);f.add('not-selected');
  let release;
  f.respond(async url=>{
    if(url.endsWith('/a/publish'))await new Promise(r=>{release=r;});
    return {ok:!url.endsWith('/b/publish'),status:400,json:async()=>url.endsWith('/b/publish')?{ok:false,error:'검토 필요'}:{ok:true}};
  });
  const pending=f.ctx.bulkApproveJourneys();
  assert.equal(f.posts.length,1);
  assert.equal(f.nodes.get('journeyBulkApprove').disabled,true);
  await f.ctx.bulkApproveJourneys();
  assert.equal(f.posts.length,1);
  release();await pending;
  assert.deepEqual(f.posts.map(x=>x.url),['https://example.test/hq/patient-journey-sync/a/publish','https://example.test/hq/patient-journey-sync/b/publish']);
  assert.match(f.nodes.get('journeyBulkResult').textContent,/성공 1 · 실패 1/);
  assert.equal(f.rows[0].checked,false);
  assert.equal(f.rows[1].checked,true);
});
