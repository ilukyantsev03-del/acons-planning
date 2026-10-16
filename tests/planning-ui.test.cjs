'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let domPath=process.env.LIV_DOM_TEST_MODULE;
if(!domPath){try{domPath=require.resolve('linkedom');}catch{}}
function setup(){
  const {parseHTML}=require(domPath),{document,Event}=parseHTML('<html><body><nav class="tabs"></nav><main class="container"></main></body></html>');
  const selectPrototype=Object.getPrototypeOf(document.createElement('select'));
  Object.defineProperty(selectPrototype,'value',{configurable:true,get(){return (this.querySelector('option[selected]')||this.querySelector('option'))?.value||'';},set(v){for(const o of Array.from(this.options))o.removeAttribute('selected');const o=Array.from(this.options).find(o=>o.value===v);if(o)o.setAttribute('selected','');}});
  const messages=[],c={document,window:{},project:{tasks:[],taskDates:[],taskQuantities:[],dependencies:[],scheduleVersions:[],scheduleStaging:[],fronts:[],progressFacts:[],factLog:[],workMetrics:[],importHistory:[]},
    ArrayBuffer,Uint8Array,
    crypto:require('node:crypto').webcrypto,Date,console,setTimeout:()=>1,alert:m=>messages.push(m),confirm:()=>true,saveProject:async()=>{}};
  c.window.saveProject=c.saveProject;c.window.LIV_ACCESS={canEdit:true};vm.createContext(c);
  for(const file of ['planning-core','fact-series','schedule','planning-ui']){
    let source=fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8');
    if(file==='schedule')source=source.replace('  window.renderSchedule = renderSchedule;', '  window.SCHEDULE_TEST={state,prepareRows,importSchedule,promoteTestImport,handleFile};\n  window.renderSchedule = renderSchedule;');
    if(file==='planning-ui')source=source.replace('  window.LIV_PLANNING_UI={render};','  window.UI_TEST={state,selectedInput,dependenciesFor,readDraft,saveScenario,volumeTable};\n  window.LIV_PLANNING_UI={render};');
    vm.runInContext(source,c,{filename:file});
  }
  c.renderSchedule=c.window.renderSchedule;
  const el=id=>document.getElementById(id);
  function set(id,value){const e=el(id);e.value=value;}
  function change(id,value){set(id,value);el(id).dispatchEvent(new Event('change',{bubbles:true}));}
  return {c,el,set,change,messages,Event};
}
function stage(e){const a=e.c.window.SCHEDULE_TEST;Object.assign(a.state,{fileName:'Договор.xlsx',sheetName:'Кровля',headerRow:0,mapping:{name:0,building:1,workingStart:2,workingFinish:3,quantity:4,unit:5},dataRows:[['Кровля','ДЭС','15.10.2026','20.10.2026',100,'м²']]});e.set('scheduleGroup','Кровля / договор');e.set('scheduleRole','contractor');e.set('scheduleEffective','2026-10-15');return a;}
test('Интерфейс: импорт → принятие → сравнение → прогноз → отдельная версия', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);await a.importSchedule();assert.equal(e.c.project.tasks.length,0);assert.equal(e.c.project.scheduleStaging.length,1);await a.promoteTestImport();
  assert.equal(e.c.project.tasks.length,1);assert.ok(e.el('planningTask'));const original=e.c.project.tasks[0],contract=e.c.project.taskDates.find(d=>d.type==='contract');
  e.change('planningMode','productivity');e.change('planningRate','10');e.change('planningResources','2');e.change('planningDone','40');
  e.el('planningCalculate').dispatchEvent(new e.Event('click',{bubbles:true}));assert.equal(e.c.window.UI_TEST.state.preview.get(original.id).days,3);
  await e.c.window.UI_TEST.saveScenario();assert.equal(e.c.project.scheduleVersions.length,2);assert.equal(e.c.project.tasks.length,2);assert.equal(contract.finish,'2026-10-20');assert.equal(e.c.project.taskDates.find(d=>d.taskId!==original.id&&d.type==='working').finish,'2026-10-17');
  assert.equal(e.c.project.scheduleVersions.filter(v=>v.status==='Принят').length,2);assert.match(e.el('planningTools').innerHTML,/Шахматка/);
});
test('Интерфейс: новая версия своей группы не удваивает действующие задачи', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();a.state.dataRows[0][3]='25.10.2026';e.set('scheduleEffective','2026-10-16');await a.importSchedule();await a.promoteTestImport();assert.equal(e.c.project.tasks.length,2);assert.equal(e.c.window.LIV_PLANNING.currentTasks(e.c.project).length,1);assert.equal(e.c.project.scheduleVersions.filter(v=>v.status==='Архив').length,1);
});
test('Интерфейс: отказ записи версии сохраняет прежний рабочий график', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();await a.importSchedule();e.c.saveProject=async()=>{throw Error('offline');};await a.promoteTestImport();assert.equal(e.c.window.LIV_PLANNING.currentTasks(e.c.project).length,1);assert.equal(e.c.project.tasks.length,1);assert.equal(e.c.project.scheduleStaging.length,1);assert.match(e.messages.at(-1),/не сохранена/);
});
test('Интерфейс: запрет записи и некорректный период не ломают просмотр', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();e.change('planningFrom','');assert.match(e.el('planningTools').innerHTML,/Укажите корректный период/);e.c.window.LIV_ACCESS.canEdit=false;await a.importSchedule();assert.equal(e.c.project.scheduleStaging.length,0);
});
test('Интерфейс: импорт реального XLSX с повтором по отдельным версиям', {skip:!domPath||!process.env.LIV_XLSX_TEST_PATH},async()=>{
  const e=setup();vm.runInContext(fs.readFileSync(process.env.LIV_XLSX_TEST_PATH,'utf8'),e.c);e.c.window.XLSX=e.c.XLSX;
  const X=e.c.XLSX,w=X.utils.book_new();X.utils.book_append_sheet(w,X.utils.aoa_to_sheet([['Приложение'],['№ п/п','Наименование работ','Длит.','Начало','Окончание'],['ДЭС'],[1,'Кровля',4,46291,46295],['','Ключевая дата №1 ДЭС','',46295,'']]),'Кровля');
  const data=X.write(w,{type:'array',bookType:'xlsx'}),a=e.c.window.SCHEDULE_TEST;
  await a.handleFile({target:{files:[{name:'Кровля.xlsx',arrayBuffer:async()=>data}]}});e.el('scheduleMilestoneFallback').checked=true;await a.importSchedule();assert.equal(e.c.project.scheduleStaging.length,2);await a.promoteTestImport();assert.equal(e.c.project.tasks.length,2);
});
test('КД: принятие договора регистрирует КД, прогноз меняет только рабочую дату', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);e.c.project.organizations=[{id:'O',name:'Подрядчик'}];e.el('scheduleOrganization').innerHTML='<option value="O">Подрядчик</option>';e.set('scheduleOrganization','O');e.set('scheduleContractNo','Д-1');e.el('scheduleRegisterKD').checked=true;
  a.state.dataRows=[['Ключевая дата №1 — Кровля ДЭС','ДЭС','20.10.2026','20.10.2026','','']];await a.importSchedule();await a.promoteTestImport();assert.equal(e.c.project.milestones.length,1);const m=e.c.project.milestones[0];assert.equal(m.contractDate,'2026-10-20');assert.equal(m.buildingId,'');
  e.change('planningStart','2026-10-25');e.el('planningCalculate').dispatchEvent(new e.Event('click',{bubbles:true}));await e.c.window.UI_TEST.saveScenario();assert.equal(m.contractDate,'2026-10-20');assert.equal(m.workDate,'2026-10-25');assert.equal(e.c.project.milestones.length,1);
});
test('Реальные договорные книги: полный путь чтения и принятия', {skip:!domPath||!process.env.LIV_SCHEDULE_FIXTURES||!process.env.LIV_XLSX_TEST_PATH},async()=>{
  const folder=process.env.LIV_SCHEDULE_FIXTURES,expected=[['Приложение № 4',8,1],['_Фасады.xlsx',6,3],['_кровля.xlsx',20,4]];
  for(const [pattern,count,kds] of expected){const file=fs.readdirSync(folder).find(f=>f.includes(pattern));assert.ok(file,pattern);const e=setup();vm.runInContext(fs.readFileSync(process.env.LIV_XLSX_TEST_PATH,'utf8'),e.c);e.c.window.XLSX=e.c.XLSX;
    const bytes=fs.readFileSync(path.join(folder,file));await e.c.window.SCHEDULE_TEST.handleFile({target:{files:[{name:file,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]}});e.el('scheduleMilestoneFallback').checked=true;
    await e.c.window.SCHEDULE_TEST.importSchedule();assert.equal(e.c.project.scheduleStaging.length,count,file+': '+e.messages.join('\n'));await e.c.window.SCHEDULE_TEST.promoteTestImport();assert.equal(e.c.project.tasks.length,count);assert.equal(e.c.project.tasks.filter(t=>t.isMilestone).length,kds);assert.equal(new Set(e.c.project.tasks.map(t=>t.sourceTaskId)).size,count,'server source IDs must be unique');
    const serialized=JSON.stringify(e.c.project);e.c.project=JSON.parse(serialized);e.c.window.renderSchedule();assert.ok(e.el('planningTask'));assert.equal(e.c.window.LIV_PLANNING.currentTasks(e.c.project).length,count);
  }
});
