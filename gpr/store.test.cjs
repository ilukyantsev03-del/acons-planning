'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Store,validate}=require('./store.js');
function fake(rows=[],role='owner'){
 const records=JSON.parse(JSON.stringify(rows)),calls=[];let failure=false;
 const client={rpc:async()=>({data:role,error:null}),from(table){const filters=[];let action='select',payload;
  const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(){return q;},update(v){action='update';payload=v;return q;},insert(v){action='insert';payload=v;return q;},delete(){action='delete';return q;},then(resolve,reject){return Promise.resolve().then(()=>{calls.push({table,action,filters});if(failure)return {error:{message:'offline'}};let found=records.filter(r=>filters.every(([k,v])=>r[k]===v));if(action==='insert'){found=[{...payload,version:1}];records.push(...found);}if(action==='update')for(const r of found)Object.assign(r,payload,{version:r.version+1});if(action==='delete')for(const r of found)records.splice(records.indexOf(r),1);return {data:JSON.parse(JSON.stringify(found)),error:null};}).then(resolve,reject);}};return q;}};
 return {client,records,calls,fail:()=>failure=true};
}
const row=(version=1)=>({schedule_id:'s',kind:'task',id:'a',version,data:{id:'a',name:'A',stage:'stage',preds:[]}});
test('Viewer cannot start a write',async()=>{const f=fake([row()],null),s=new Store(f.client);s.scheduleId='s';await assert.rejects(s.save('task','a',{}),/владельцу/);assert.equal(f.calls.length,0);assert.equal(s.writing,0);});
test('Two writes to the same item use consecutive confirmed versions',async()=>{const f=fake([row()]),s=new Store(f.client);s.scheduleId='s';s.canEdit=true;s.rows.set(s.key('task','a'),row());await Promise.all([s.save('task','a',{name:'B'}),s.save('task','a',{name:'C'})]);assert.equal(f.records[0].version,3);assert.equal(s.rows.get(s.key('task','a')).data.name,'C');assert.deepEqual(f.calls.map(c=>c.filters.find(([k])=>k==='version')[1]),[1,2]);});
test('A stale version is rejected and the confirmed cache is retained',async()=>{const f=fake([row(2)]),s=new Store(f.client);s.scheduleId='s';s.canEdit=true;s.rows.set(s.key('task','a'),row());await assert.rejects(s.save('task','a',{name:'B'}),/другом окне/);assert.equal(f.records[0].data.name,'A');assert.equal(s.rows.get(s.key('task','a')).version,1);});
test('A failed request does not become a local successful save',async()=>{const f=fake([row()]),s=new Store(f.client);s.scheduleId='s';s.canEdit=true;s.rows.set(s.key('task','a'),row());f.fail();await assert.rejects(s.save('task','a',{name:'B'}));assert.equal(s.rows.get(s.key('task','a')).data.name,'A');assert.equal(s.writing,0);});
test('New items and deletion stay scoped to the selected schedule',async()=>{const f=fake(),s=new Store(f.client);s.scheduleId='s';s.canEdit=true;await s.save('task','new',{name:'New'});assert.equal(f.records[0].schedule_id,'s');await s.remove('task','new');assert.equal(f.records.length,0);assert.equal(s.rows.size,0);});
test('Missing predecessors and cycles are blocked',()=>{const t={id:'a',stage:'stage',preds:[]},p={tasks:[t],stages:[{id:'stage'}]};assert(validate(p));assert.throws(()=>validate({...p,tasks:[{...t,preds:[{id:'absent',type:'ОН',lag:0}]}]}),/отсутствующей/);assert.throws(()=>validate({...p,tasks:[{...t,preds:[{id:'a',type:'ОН',lag:0}]}]}),/замкнутый/);});
test('The real schedule fixture loads without embedded data', {skip:!process.env.GPR_FIXTURE},async()=>{const rows=require(process.env.GPR_FIXTURE).map(r=>({...r,schedule_id:'facade-main'})),f=fake(rows,null),s=new Store(f.client),data=await s.load('facade-main');assert.equal(data.tasks.length,214);assert.equal(data.stages.length,11);assert.equal(s.canEdit,false);assert.equal(data.tasks.filter(t=>t.ms).length,13);assert(f.calls.every(c=>c.action==='select'));});

test('historical facade cut replays updates and deletions from the saved origin',async()=>{
 const state={tasks:[{id:'a',name:'До изменения',stage:'s',preds:[]}],stages:[{id:'s'}],settings:{title:'Origin'}};
 const events=[{kind:'task',item_id:'a',action:'UPDATE',new_data:{...state.tasks[0],name:'После изменения'}},{kind:'task',item_id:'b',action:'INSERT',new_data:{id:'b',stage:'s',preds:[]}},{kind:'task',item_id:'b',action:'DELETE',new_data:null}];
 const client={from(){const q={select(){return q},eq(){return q},gt(){return q},lte(){return q},order(){return q},range(){return Promise.resolve({data:events})}};return q}};
 const s=new Store(client);s.scheduleId='facade';s.rows.set(s.key('meta','state-facade-origin'),{data:{at:'2026-11-16T12:00:00Z',state}});s.canEdit=true;
 const cut=await s.asOf('2026-11-17');assert.equal(cut.tasks.length,1);assert.equal(cut.tasks[0].name,'После изменения');assert.equal(state.tasks[0].name,'До изменения');await assert.rejects(()=>s.asOf('2026-11-15'),/состояния нет/);s.canEdit=false;await assert.rejects(()=>s.asOf('2026-11-17'),/владельцу/);
});
