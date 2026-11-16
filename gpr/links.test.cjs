const {test}=require('node:test');
const assert=require('node:assert/strict');
const {route}=require('./links.js');
const box=(start,end,y,startDay=1,finishDay=3,milestone=false)=>({start,end,y,startDay,finishDay,milestone,dayWidth:6});
test('all four link types attach to the corresponding bar edges',()=>{
 for(const [type,sides] of Object.entries({'ОН':['end','start'],'НН':['start','start'],'ОО':['end','end'],'НО':['start','end']})){
  const a=box(100,130,24),b=box(170,210,72,4,8),r=route(a,b,type);
  assert.equal(r.x1,a[sides[0]]);assert.equal(r.x2,b[sides[1]]);
  assert.match(r.d,new RegExp(`^M${r.x1},24 `));assert.match(r.d,new RegExp(` H${r.x2}$`));
 }
});
test('same-day FS overlap remains in its stored direction and detours outside bars',()=>{
 const r=route(box(100,130,24,1,3),box(124,160,72,3,6),'ОН',-1);
 assert.equal(r.reversed,false);assert.equal(r.type,'ОН');assert.match(r.d,/V44/);assert.match(r.d,/H110 V72 H124$/);
});
test('negative reverse relation is displayed from earlier event, preserving storage',()=>{
 const a=box(200,250,72,10,15),b=box(80,130,24,2,7);
 const before=JSON.stringify([a,b]);const r=route(a,b,'НН',-8);
 assert.equal(r.reversed,true);assert.equal(r.x1,80);assert.equal(r.x2,200);assert.equal(JSON.stringify([a,b]),before);
 const sf=route(a,b,'НО',-3);assert.equal(sf.type,'ОН');assert.equal(sf.fromSide,'end');assert.equal(sf.toSide,'start');
});
test('milestones attach to diamond boundary',()=>{
 const r=route(box(100,106,24,3,3,true),box(150,180,72,4,8),'ОН');assert.equal(r.x1,112);
});
