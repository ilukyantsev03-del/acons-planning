'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function api(){const c={window:{},Date,console};vm.createContext(c);for(const f of ['planning-core','planning-gantt'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),c);return {G:c.window.LIV_GANTT,P:c.window.LIV_PLANNING};}
const manual=(start='2026-10-19',days=2)=>({mode:'manual',manual:days,start,calendar:'7x0',resources:2,pool:'Буровые'});
test('Шкала: високосный февраль, неполная неделя, край полосы и крупный масштаб',()=>{
 const {G}=api(),a=G.axis('2028-02-27','2028-03-02','day');assert.equal(a.cells.length,5);assert.equal(a.x('2028-03-02',true),a.width);assert.equal(a.x('2028-02-28'),42);assert.equal(a.x('2028-02-26'),0);
 const w=G.axis('2026-10-21','2026-10-28','week');assert.equal(w.cells[0].finish,'2026-10-25');assert.equal(w.cells[1].start,'2026-10-26');assert.equal(w.x('2026-10-26'),104);
 const m=G.axis('2028-02-01','2028-03-31','month');assert.equal(m.cells[0].finish,'2028-02-29');assert.equal(m.cells.length,2);assert.equal(G.axis('2020-01-01','2030-01-01','day').scale,'month');assert.throws(()=>G.axis('2026-11-01','2026-10-01'),/период/);
});
test('Стрелки: четыре типа выбирают правильные начала и окончания',()=>{
 const {G}=api(),rows=[{id:'a'},{id:'b'}],r=new Map([['a',{start:'2026-10-19',finish:'2026-10-21'}],['b',{start:'2026-10-22',finish:'2026-10-25'}]]),a=G.axis('2026-10-19','2026-10-25');
 for(const type of ['FS','SS','FF','SF']){const g=G.linkGeometry({predecessorTaskId:'a',successorTaskId:'b',linkType:type},rows,r,a);assert.equal(g.x1,type[0]==='S'?0:126);assert.equal(g.x2,type[1]==='F'?294:126);assert.ok(g.path.includes('H'));}
 assert.equal(G.linkGeometry({predecessorTaskId:'a',successorTaskId:'b'},rows,r,G.axis('2026-10-22','2026-10-25')),null);
});
test('Ресурсные недели показывают максимум и неизвестный лимит, не сумму',()=>{
 const {G}=api(),a=G.axis('2026-10-19','2026-10-25','week'),load=[{date:'2026-10-19',pool:'Буровые',used:4,capacity:3,overload:1},{date:'2026-10-20',pool:'Буровые',used:2,capacity:3,overload:0},{date:'2026-10-19',pool:'Рабочие',used:50,capacity:null}];
 const r=G.aggregate(load,'Буровые',a)[0];assert.equal(r.used,4);assert.equal(r.overload,1);assert.equal(r.peakDate,'2026-10-19');assert.equal(G.aggregate(load,'Рабочие',a)[0].capacity,null);
});
test('Выравнивание сохраняет независимый расчёт до и неизменный объём назначений',()=>{
 const {P,G}=api(),tasks=[{id:'a',name:'Первый фронт'},{id:'b',name:'Второй фронт'}],source=JSON.stringify(tasks),level=P.levelResources(tasks,[],()=>manual(),{'Буровые':2}),before=P.resourceLoad(tasks,level.before,()=>manual(),{'Буровые':2});
 assert.equal(level.before.get('b').start,'2026-10-19');assert.equal(level.results.get('b').start,'2026-10-21');assert.equal(before.reduce((n,r)=>n+r.used,0),level.load.reduce((n,r)=>n+r.used,0));assert.equal(JSON.stringify(tasks),source);
 const opts={tasks,base:level.before,before:level.before,after:level.results,leveled:true,calculated:true,changes:level.changes,beforeLoad:before,afterLoad:level.load,capacities:{'Буровые':2},kdBefore:[{id:'m',finish:'2026-10-20'}],kdAfter:[{id:'m',title:'КД <тест>',contractDate:'2026-10-21',finish:'2026-10-22',delta:1,determining:['Второй фронт']}]};
 const html=G.render(opts);assert.match(html,/До выравнивания/);assert.match(html,/После выравнивания/);assert.match(html,/КД &lt;тест&gt;/);assert.match(html,/<td>\+2<\/td>/);assert.match(html,/>\+1<\/td>/);assert.match(html,/gantt-moved/);
});
test('Большой график: страницы, поиск, скрытые связи, фильтры не меняют расчёт',()=>{
 const {G}=api(),tasks=Array.from({length:205},(_,i)=>({id:String(i),name:i===204?'Нужная работа':'Работа '+i})),r=new Map(tasks.map(t=>[t.id,{start:'2026-10-19',finish:'2026-10-20'}])),opts={tasks,base:r,after:r,calculated:true,dependencies:[{predecessorTaskId:'0',successorTaskId:'204'}],critical:new Map([['204',{isCritical:true}]])};
 let m=G.build(opts);assert.equal(m.rows.length,100);assert.equal(m.pages,3);assert.equal(m.hiddenLinks,1);m=G.build(opts,{search:'нужная'});assert.equal(m.rows[0].id,'204');assert.equal(r.size,205);assert.equal(G.build(opts,{page:99}).rows.length,5);assert.equal(G.build(opts,{critical:true}).rows.length,1);
 assert.match(G.render(opts,{search:'нет такого'}),/Нет работ/);assert.equal(G.build({...opts,calculated:false},{critical:true,moved:true}).total,205);
});
