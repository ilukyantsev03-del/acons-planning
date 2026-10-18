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
  for(const file of ['planning-core','fact-series','planning-domain','schedule','planning-ui']){
    let source=fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8');
    if(file==='schedule')source=source.replace('  window.renderSchedule = renderSchedule;', '  window.SCHEDULE_TEST={state,prepareRows,importSchedule,promoteTestImport,handleFile};\n  window.renderSchedule = renderSchedule;');
    if(file==='planning-ui')source=source.replace('  window.LIV_PLANNING_UI={render};','  window.UI_TEST={state,selectedInput,dependenciesFor,readDraft,saveScenario,volumeTable,createManual,editManualTask,saveManualFact,saveQuantity,savePeriodPlan,saveKDLinks,savePlanningReport,saveNamedScenario,loadNamedScenario,verifyStorage};\n  window.LIV_PLANNING_UI={render};');
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

 test('Ручной ввод: создание без файла, новая редакция и сохранение базовой версии', {skip:!domPath},async()=>{
  const e=setup();e.c.window.LIV_PLANNING_UI.render();e.set('manualName','Паркинг');e.set('manualRole','customer');e.set('manualRows','Сваи\tПаркинг\t1\t1\tБП-2\t1\t120\tшт.\t19.10.2026\t30.10.2026\tнет\t0');
  await e.c.window.UI_TEST.createManual();assert.equal(e.c.project.tasks.length,1);assert.ok(e.el('planningRateSlider'));const source=e.c.project.scheduleVersions[0];source.isBaseline=true;
  e.set('editTaskFinish','2026-11-02');await e.c.window.UI_TEST.editManualTask();assert.equal(e.c.project.scheduleVersions.length,2);assert.equal(e.c.project.tasks.length,2);assert.equal(source.isBaseline,true);assert.equal(e.c.project.scheduleVersions[0].isBaseline,false);assert.equal(e.c.project.taskDates.find(d=>d.type==='contract'&&d.taskId===e.c.project.tasks.at(-1).id).finish,'2026-11-02');
 });
 test('Ползунки: мгновенный сценарий и сброс устаревшего общего прогноза', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();e.change('planningMode','productivity');e.change('planningRate','10');e.change('planningResources','1');e.el('planningCalculate').dispatchEvent(new e.Event('click',{bubbles:true}));assert.ok(e.el('planningSave'));
  e.set('planningResourcesSlider','2');e.el('planningResourcesSlider').dispatchEvent(new e.Event('input',{bubbles:true}));assert.equal(e.c.window.UI_TEST.state.preview,null);assert.equal(e.el('planningSave'),null);assert.match(e.el('planningLive').innerHTML,/2026-10-19/);assert.equal(e.el('planningResources').value,'2');
 });
 test('Календарь и выравнивание: предпросмотр и сохранение новой версии', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);a.state.dataRows.push(['Стены','ДЭС','15.10.2026','20.10.2026',100,'м²']);await a.importSchedule();await a.promoteTestImport();
  e.change('planningPool','Рабочие');e.change('planningResources','2');e.change('planningTask',e.c.project.tasks[1].id);e.change('planningPool','Рабочие');e.change('planningResources','2');e.change('planningCapacities','Рабочие = 2');e.change('planningHolidays','19.10.2026');
  e.el('planningLevel').dispatchEvent(new e.Event('click',{bubbles:true}));assert.ok(e.c.window.UI_TEST.state.leveled,e.messages.join(' '));assert.equal(e.c.window.UI_TEST.state.leveled.changes.length,1);await e.c.window.UI_TEST.saveScenario();assert.equal(e.c.project.planningSettings.holidays[0],'2026-10-19');assert.equal(e.c.project.scheduleVersions.length,2);assert.ok(e.c.project.tasks.filter(t=>t.versionId===e.c.project.scheduleVersions[0].id).some(t=>t.planning.start>'2026-10-15'));
 });
 test('Факт из графика: ввод, исправление вниз и история', {skip:!domPath},async()=>{
  const e=setup(),a=stage(e);e.c.project.fronts=[{id:'F',name:'Кровля',unit:'м²',totalQty:100,doneQty:0}];await a.importSchedule();await a.promoteTestImport();e.change('planningFront','F');e.set('planningFactDate','2026-10-15');e.set('planningFactQuantity','85');e.set('planningFactType','cumulative_snapshot');await e.c.window.UI_TEST.saveManualFact();assert.equal(e.c.project.fronts[0].doneQty,85);
  e.set('planningFactRecord',e.c.project.progressFacts[0].id);e.set('planningFactDate','2026-10-15');e.set('planningFactQuantity','70');e.set('planningFactType','cumulative_snapshot');await e.c.window.UI_TEST.saveManualFact();assert.equal(e.c.project.fronts[0].doneQty,70);assert.equal(e.c.project.progressFacts.length,1);assert.equal(e.c.project.progressFacts[0].revisions[0].cumulativeQty,85);
 });

test('Сквозной цикл: объём → факт → прогноз КД → отчёт → повторное открытие', {skip:!domPath},async()=>{
 const e=setup(),a=stage(e);let saved='';e.c.saveProject=async()=>{saved=JSON.stringify(e.c.project);};e.c.dbGetKey=async()=>JSON.parse(saved);
 e.c.project.fronts=[{id:'F',name:'Кровля',unit:'м²',totalQty:100,doneQty:40}];e.c.project.milestones=[{id:'M',title:'КД Кровля',contractDate:'2026-10-20'}];e.c.project.progressFacts=[{id:'F1',frontId:'F',factDate:'2026-10-15',factType:'cumulative_snapshot',cumulativeQty:40}];
 await a.importSchedule();await a.promoteTestImport();e.change('planningFront','F');e.set('editTaskName','Кровля');await e.c.window.UI_TEST.editManualTask();
 e.set('quantityDate','2026-10-16');e.set('quantityAmount','20');e.set('quantityKind','add');e.set('quantityReason','Дополнительная конструкция');e.set('quantityDocument','РД-2');await e.c.window.UI_TEST.saveQuantity();assert.equal(e.c.project.fronts[0].totalQty,120);assert.equal(e.el('planningTotal').value,'120');
 const kd=e.el('planningKDTargets').querySelector('option');kd.setAttribute('selected','');await e.c.window.UI_TEST.saveKDLinks();
 e.change('planningMode','productivity');e.change('planningRate','10');e.change('planningResources','1');e.el('planningCalculate').dispatchEvent(new e.Event('click',{bubbles:true}));assert.ok(e.c.window.UI_TEST.state.preview,e.messages.join(' '));await e.c.window.UI_TEST.saveScenario();assert.equal(e.c.project.milestones[0].contractDate,'2026-10-20');assert.equal(e.c.project.milestones[0].workDate,'2026-10-22');
 e.set('periodPlanRows','2026-10-15 ; 2026-10-18 ; 20\n2026-10-19 ; 2026-10-22 ; 60');await e.c.window.UI_TEST.savePeriodPlan();
 e.change('planningFrom','2026-10-16');e.change('planningTo','2026-10-18');e.set('planningReportTitle','Контрольный отчёт');await e.c.window.UI_TEST.savePlanningReport();const frozen=JSON.stringify(e.c.project.reportSnapshots[0].dataSnapshot);
 e.set('planningScenarioName','Две установки');await e.c.window.UI_TEST.saveNamedScenario();await e.c.window.UI_TEST.verifyStorage();assert.match(e.c.window.UI_TEST.state.storageMessage,/Сверка пройдена/);
 const fresh=setup();fresh.c.project=JSON.parse(saved);fresh.c.window.LIV_PLANNING_UI.render();assert.equal(fresh.c.project.quantityChanges.length,1);assert.equal(fresh.c.project.quantityPlans.length,1);assert.equal(fresh.c.project.planningSettings.scenarios.length,1);assert.equal(JSON.stringify(fresh.c.project.reportSnapshots[0].dataSnapshot),frozen);assert.match(fresh.el('planningReportContent').textContent,/Контрольный отчёт/);fresh.set('planningSavedScenario',fresh.c.project.planningSettings.scenarios[0].id);fresh.c.window.UI_TEST.loadNamedScenario();assert.equal(fresh.el('planningRate').value,'10');assert.match(fresh.el('planningReportContent').textContent,/Шахматка на дату отчёта/);
 fresh.c.project.quantityChanges.push({...fresh.c.project.quantityChanges[0],id:'later',delta:50,effectiveDate:'2026-10-18',sequence:2});fresh.c.window.LIV_PLANNING_UI.render();assert.equal(JSON.stringify(fresh.c.project.reportSnapshots[0].dataSnapshot),frozen);
});
test('Сравнение по датам не подставляет будущую версию и восстанавливает выбранную', {skip:!domPath},async()=>{
 const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();e.change('planningComparisonMode','dates');e.change('planningRightDate','2026-10-14');assert.match(e.el('planningTools').textContent,/На выбранную дату нет сохранённой версии/);e.change('planningRightDate','2026-10-16');assert.ok(e.el('planningTask'));assert.equal(e.c.window.UI_TEST.state.right,e.c.project.scheduleVersions[0].id);
});
test('Решение об объёме: отказ сохранения не оставляет частичных изменений', {skip:!domPath},async()=>{
 const e=setup(),a=stage(e);await a.importSchedule();await a.promoteTestImport();e.set('quantityDate','2026-10-16');e.set('quantityAmount','20');e.set('quantityReason','Исключение');e.set('quantityDocument','Письмо');e.c.saveProject=async()=>{throw Error('offline');};await assert.rejects(e.c.window.UI_TEST.saveQuantity(),/offline/);assert.equal(e.c.project.quantityChanges.length,0);assert.equal(e.c.project.quantityBaselines.length,0);
});
