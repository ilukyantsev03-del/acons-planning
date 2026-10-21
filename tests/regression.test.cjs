'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function moduleContext(file, expose, extra = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false, textContent: '', innerHTML: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      querySelectorAll: () => [], addEventListener(name, handler) { this[name] = handler; }
    });
    return elements.get(id);
  };
  const window = { addEventListener() {}, dispatchEvent() {} };
  const context = {
    window, document: { readyState: 'loading', addEventListener() {}, getElementById: element },
    project: { buildings: [{ id:'B1', name:'Главный корпус', aliases:['ГК'] }],
      organizations: [{ id:'O1', name:'Подрядчик' }], contracts: [], milestones: [], importHistory: [],
      schemes: [], schemeMarks: [], fronts: [], works: [], matrices: [] },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    console, Date, Uint8Array, crypto: require('node:crypto').webcrypto,
    confirm: () => true, alert: () => {}, saveProject: async () => {}, closeModal() {},
    openModal() {}, renderAll() {}, ...extra
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const instrumented = source.replace(/\}\)\(\);\s*$/, `window.TEST = {${expose}};\n})();`);
  vm.runInContext(instrumented, context, { filename:file });
  return { context, api: window.TEST, element, window };
}

function importer() {
  const env = moduleContext('js/key-date-import.js',
    'isoDate,buildRowsFromContext,commitImport,readFile,readSheet,state,openImporter');
  env.api.state.fileName = 'КД.xlsx';
  return env;
}
const mapping = { number:0, organization:1, contract:2, title:3, date:4, building:5 };
function rows(env, data) {
  return env.api.buildRowsFromContext({ headerRow:0, mapping, sheetName:'КД', matrix:[[], ...data] });
}

test('КД: реальные даты, високосный год и недопустимые даты', () => {
  const { api } = importer();
  assert.equal(api.isoDate('31.02.2026'), '');
  assert.equal(api.isoDate('29.02.2026'), '');
  assert.equal(api.isoDate('29.02.2028'), '2028-02-29');
  assert.equal(api.isoDate('2026-10-15'), '2026-10-15');
});

test('КД: предпросмотр не меняет базу, алиас здания и цель распознаются', () => {
  const env = importer();
  const parsed = rows(env, [['1','Подрядчик','Д-1','Выполнить 190 свай','15.10.2026','ГК']]);
  assert.equal(parsed[0].buildingId, 'B1');
  assert.equal(parsed[0].targetQty, 190);
  assert.equal(env.context.project.milestones.length, 0);
  assert.equal(env.context.project.contracts.length, 0);
});

test('КД: повторный импорт с изменённой датой обновляет запись и сохраняет ручные поля', async () => {
  const env = importer();
  env.api.state.rows = rows(env, [['1','Подрядчик','Д-1','Завершить работы','15.10.2026']]);
  await env.api.commitImport();
  const milestone = env.context.project.milestones[0];
  milestone.targetQty = 500; milestone.targetUnit = 'м³'; milestone.status = 'Выполнена';
  env.api.state.rows = rows(env, [['1','Подрядчик','Д-1','Завершить работы','25.10.2026']]);
  assert.equal(env.api.state.rows[0].result, 'Обновление');
  await env.api.commitImport();
  assert.equal(env.context.project.milestones.length, 1);
  assert.equal(milestone.contractDate, '2026-10-25');
  assert.equal(milestone.status, 'Выполнена');
  assert.equal(milestone.targetQty, 500);
  assert.equal(env.context.project.contracts.length, 1);
});

test('КД: одинаковые номера в разных договорах остаются разными', async () => {
  const env = importer();
  env.api.state.rows = rows(env, [
    ['1','Подрядчик','Д-1','Работы','15.10.2026'],
    ['1','Подрядчик','Д-2','Работы','15.10.2026']
  ]);
  await env.api.commitImport();
  assert.equal(env.context.project.milestones.length, 2);
});

test('КД: все листы сохраняются при изменении значений по умолчанию; новый файл сбрасывает шапки', async () => {
  const env = importer();
  env.api.openImporter();
  const header = ['№','Подрядчик','№ договора','Наименование КД','Дата окончания'];
  const workbook = { SheetNames:['Лист1','Лист2'], Sheets:{
    Лист1: [header, ['1','Подрядчик','','Сваи','15.10.2026']],
    Лист2: [header, ['2','Подрядчик','','Анкеры','16.10.2026']]
  }};
  env.window.XLSX = env.context.XLSX = { read: () => workbook, utils:{ sheet_to_json: sheet => sheet } };
  await env.api.readFile({ name:'КД.xlsx', arrayBuffer:async () => new ArrayBuffer(0) });
  assert.equal(env.api.state.rows.length, 2);
  env.element('keyDateDefaultContract').value = 'Д-3';
  env.element('keyDateDefaultContract').change();
  assert.equal(env.api.state.rows.length, 2);
  assert.ok(env.api.state.rows.every(row => row.contractNo === 'Д-3'));
  env.api.state.sheetMappings.Лист1.mapping.title = 0;
  await env.api.readFile({ name:'Другой.xlsx', arrayBuffer:async () => new ArrayBuffer(0) });
  assert.equal(env.api.state.sheetMappings.Лист1.mapping.title, 3);
});

function schemes(extra) {
  const env = moduleContext('js/schemes.js', 'state,saveMark,loadPdf,pdfjs,syncScheme,syncMark,derivedProgress,stats', extra);
  env.window.LIV_ACCESS = { role:'planner' };
  env.window.LIV_NORMALIZED_SYNC = { projectId: () => 'project-1', serverId: () => null };
  return env;
}

test('PDF: резервный адрес worker сохраняется при повторном открытии', async () => {
  const env = schemes();
  env.window.pdfjsLib = { GlobalWorkerOptions:{ workerSrc:'https://cdn.jsdelivr.net/worker.js' } };
  await env.api.pdfjs();
  assert.equal(env.window.pdfjsLib.GlobalWorkerOptions.workerSrc, 'https://cdn.jsdelivr.net/worker.js');
});

test('PDF: ошибка записи новой отметки не оставляет несохранённую отметку в проекте', async () => {
  let message = '';
  const env = schemes({ alert: value => { message = value; } });
  env.context.project.schemes.push({ id:'SCH1', serverId:'server-scheme' });
  env.window.LIV_SUPABASE = { from() { return { insert() { throw new Error('RLS denied'); } }; } };
  // Lookup fails before insert: the local draft must still be rolled back.
  env.window.LIV_SUPABASE.from = () => ({ select() { return { eq() { return { maybeSingle:async () => ({ error:{message:'RLS denied'} }) }; } }; } });
  await env.api.saveMark(null, { schemeId:'SCH1', pageNo:1, x:.1,y:.2,width:.3,height:.4 });
  assert.equal(env.context.project.schemeMarks.length, 0);
  assert.match(message, /RLS denied/);
  assert.equal(env.element('smSave').disabled, false);
});

test('PDF: чтение без права записи не пытается обновить метаданные', async () => {
  const env = schemes();
  env.window.LIV_ACCESS.role = 'viewer';
  env.context.project.schemes.push({ id:'SCH1', storagePath:'schemes/SCH1/source.pdf', pageCount:0 });
  env.api.state.schemeId = 'SCH1';
  const doc = { numPages:2, getPage:async () => { throw new Error('test canvas omitted'); } };
  env.api.state.cache.set('SCH1', doc);
  env.window.LIV_SUPABASE = { from() { throw new Error('Unexpected write'); } };
  let alerts = [];
  env.context.alert = value => alerts.push(value);
  await env.api.loadPdf();
  assert.equal(env.api.state.pdf, doc);
  assert.ok(alerts.every(message => !message.includes('Unexpected write')));
});

test('Номерные элементы: группа существующей записи не зависит от открытого редактора', () => {
  const env = moduleContext('js/numbered-elements-v2.js', 'contextualElementKey');
  env.context.project.numberedElementGroups = [{id:'G1',groupCode:'Г1'}, {id:'G2',groupCode:'Г2'}];
  env.element('neGroup').value = 'Г2';
  const base = { elementType:'Анкер',buildingId:'B1',capture:'З1',zone:'А',elementNo:'7' };
  const first = env.api.contextualElementKey({...base,groupId:'G1'});
  assert.notEqual(first, env.api.contextualElementKey({...base,groupId:'G2'}));
  env.element('neGroup').value = 'Г3';
  assert.equal(first, env.api.contextualElementKey({...base,groupId:'G1'}));
  assert.notEqual(first, env.api.contextualElementKey({...base,groupId:'G1',zone:'Б'}));
  assert.notEqual(first, env.api.contextualElementKey({...base,groupId:'G1',capture:'З2'}));
});

function versioned(server, updateResult) {
  const env = moduleContext('js/normalized-sync.js', 'writeVersionedRows,state', {
    localStorage: { getItem: () => null, setItem() {} }
  });
  const calls = [];
  env.window.LIV_SUPABASE = { from(table) {
    return {
      select() { return { in:async () => ({data:server}) }; },
      update(row) {
        calls.push({table,row,filters:[]});
        const query = { eq(key,value) { calls.at(-1).filters.push([key,value]); return query; },
          select:async () => ({data:updateResult}) };
        return query;
      }
    };
  }};
  return {...env,calls};
}

test('Синхронизация: одинаковое содержимое не повышает версию и не создаёт ложный конфликт', async () => {
  const env = versioned([{external_id:'M1',title:'КД',row_version:7}]);
  env.api.state.serverVersions['milestones:M1'] = 6;
  await env.api.writeVersionedRows('milestones', [{external_id:'M1',title:'КД'}]);
  assert.equal(env.calls.length, 0);
  assert.equal(env.api.state.serverVersions['milestones:M1'], 7);
});

test('Синхронизация: новая серверная версия с другим содержимым блокирует сохранение', async () => {
  const env = versioned([{external_id:'M1',title:'Сервер',row_version:7}]);
  env.api.state.serverVersions['milestones:M1'] = 6;
  await assert.rejects(env.api.writeVersionedRows('milestones', [{external_id:'M1',title:'Клиент'}]), /Конфликт редактирования/);
  assert.equal(env.calls.length, 0);
});

test('Синхронизация: конкурентная запись между чтением и обновлением блокируется фильтром версии', async () => {
  const env = versioned([{external_id:'M1',title:'Сервер',row_version:7}], []);
  env.api.state.serverVersions['milestones:M1'] = 7;
  await assert.rejects(env.api.writeVersionedRows('milestones', [{external_id:'M1',title:'Клиент'}]), /изменилась во время сохранения/);
  assert.deepEqual(env.calls[0].filters, [['external_id','M1'],['row_version',7]]);
});

test('Номерные элементы: отклонённое сохранение не меняет группу существующей записи', async () => {
  const env = moduleContext('js/numbered-elements-v2.js', 'wrapFunctions');
  const element = {id:'E1',elementType:'Анкер',elementNo:'7',groupCode:'Г1'};
  env.context.project.numberedElements = [element];
  env.window.saveElement = async () => undefined;
  env.element('neGroup').value = 'Г2';
  env.api.wrapFunctions();
  await env.window.saveElement('E1');
  assert.equal(element.groupCode, 'Г1');
});

test('PDF: готовность элемента и группы считается из реестра, без ручного процента', () => {
  const env = schemes();
  env.context.project.numberedElementGroups = [{id:'G1',totalQty:10},{id:'G2',totalQty:null}];
  env.context.project.numberedElements = [
    {id:'E1',groupId:'G1',status:'Выполнено'},
    {id:'E2',groupId:'G1',status:'Принято'},
    {id:'E3',groupId:'G1',status:'В работе'}
  ];
  assert.equal(env.api.derivedProgress('В работе','','G1'), 20);
  assert.equal(env.api.derivedProgress('В работе','','G2'), null);
  assert.equal(env.api.derivedProgress('В работе','','','E1'), 100);
  assert.equal(env.api.derivedProgress('В работе','','','E3'), 0);
  assert.equal(env.api.derivedProgress('Выполнено',''), null);
});

test('PDF: точка, круг и линии сохраняют геометрию при разных пропорциях страницы', () => {
  const {api}=moduleContext('js/schemes.js','geometry');
  const size={width:1000,height:500};
  const circle=api.geometry({x:.2,y:.2},{x:.3,y:.4},'circle',size);
  assert.equal(circle.width*size.width,circle.height*size.height);
  const dot=api.geometry({x:1,y:1},{x:1,y:1},'point',size);
  assert.equal(dot.width*size.width,12);
  assert.ok(dot.x+dot.width<=1 && dot.y+dot.height<=1);
  const line=api.geometry({x:.8,y:.2},{x:.2,y:.8},'line',size);
  assert.equal(line.lineReverse,true);
  const horizontal=api.geometry({x:.1,y:.5},{x:.9,y:.5},'line',size);
  assert.equal(horizontal.height,0);
  assert.equal(horizontal.width,.8);
});

test('Проверка: пустой ID проекта не отправляется в серверные таблицы', async () => {
  const env=moduleContext('js/preflight.js','identityChecks');
  let calls=0;
  env.window.LIV_SUPABASE={from(){calls++;throw new Error('Unexpected query');}};
  env.window.LIV_NORMALIZED_SYNC={projectId:()=>''};
  const results=await env.api.identityChecks();
  assert.equal(calls,0);
  assert.equal(results.length,1);
  assert.equal(results[0].ok,false);
  assert.match(results[0].detail,/проект ещё не определён/);
});

test('Проверка: ожидает разрешения UUID перед запросом таблицы', async () => {
  const env=moduleContext('js/preflight.js','serverIdentitySet');
  const uuid='6cfe4b12-a8f9-4189-81b6-77ced8d99f7e';
  let resolved=false;
  env.window.LIV_NORMALIZED_SYNC={ensureProjectId:async()=>{await Promise.resolve();resolved=true;return uuid;}};
  env.window.LIV_SUPABASE={from(){assert.ok(resolved);return {select(){return this;},range(){return this;},eq(column,value){assert.equal(column,'project_id');assert.equal(value,uuid);return Promise.resolve({data:[]});}};}};
  assert.equal((await env.api.serverIdentitySet('fronts','external_id',true)).size,0);
});

test('PDF: загрузка и фоновая синхронизация одной схемы не создают дубликат', async () => {
  const env=moduleContext('js/schemes.js','writeVersioned,entityWrites');
  let inserts=0,updates=0,version=0;
  env.window.LIV_SUPABASE={from(){return {
    select(){return this;},eq(){return this;},
    async maybeSingle(){await Promise.resolve();return {data:null};},
    insert(){inserts++;return {select(){return this;},async single(){await Promise.resolve();version=1;return {data:{id:'server-1',row_version:version}};}};},
    update(){updates++;return {eq(){return this;},async select(){return {data:[{row_version:++version}]};}};}
  };}};
  const x={id:'SCHEME-1'};
  await Promise.all([env.api.writeVersioned('schemes',x,{name:'PDF'}),env.api.writeVersioned('schemes',x,{name:'PDF'})]);
  assert.equal(inserts,1);assert.equal(updates,1);assert.equal(x.serverVersion,2);
  assert.equal(env.api.entityWrites.size,0);
});

test('PDF: серия рисунков остаётся черновиками без открытия карточки и хранит собственный стиль', () => {
  let modals=0;
  const env=moduleContext('js/schemes.js','state,stageDrawing,visibleMarks,appearance',{openModal(){modals++;}});
  env.api.state.schemeId='S1';env.api.state.draw=true;
  env.api.state.ink={color:'#ff0000',width:8,fill:.3};
  const first=env.api.stageDrawing({x:.1,y:.2,width:.2,height:.1,markType:'line'});
  env.api.state.ink={color:'#00ff00',width:2,fill:0};
  env.api.stageDrawing({x:.5,y:.2,width:.1,height:.1,markType:'circle'});
  assert.equal(modals,0);assert.equal(env.api.state.draw,true);
  assert.equal(env.api.visibleMarks().length,2);assert.equal(env.context.project.schemeMarks.length,0);
  assert.equal(first.appearance.color,'#ff0000');assert.equal(first.appearance.width,8);
});

test('PDF: некорректный цвет и толщина ограничиваются безопасными значениями', () => {
  const {api}=moduleContext('js/schemes.js','appearance');
  const ink=api.appearance({appearance:{color:'bad; color:red',width:100,fill:-1}});
  assert.equal(ink.color,null);assert.equal(ink.width,20);assert.equal(ink.fill,0);
  assert.equal(api.appearance({}).color,null);
});

test('PDF: ошибка пакетного сохранения оставляет рисунок для повторной попытки, стиль пишется на сервер', async () => {
  let fail=true,payload;
  const env=moduleContext('js/schemes.js','state,stageDrawing,saveDrawings');
  env.window.LIV_ACCESS={role:'planner'};
  env.window.LIV_NORMALIZED_SYNC={projectId:()=> 'project-1'};
  env.context.project.schemes=[{id:'S1',serverId:'server-s1'}];
  env.context.document.createElement=()=>({style:{},dataset:{},classList:{add(){},toggle(){}}});
  env.element('schOverlay').appendChild=()=>{};
  env.window.LIV_SUPABASE={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:null};},insert(data){payload=data;return {select(){return this;},async single(){return fail?{error:{message:'test offline'}}:{data:{id:'server-m1',row_version:1}};}};}};}};
  env.api.state.schemeId='S1';env.api.state.ink={color:'#ff0000',width:7,fill:.3};
  const x=env.api.stageDrawing({x:.1,y:.1,width:.1,height:.1,markType:'circle'});
  await env.api.saveDrawings();
  assert.equal(env.api.state.dirty.size,1);assert.equal(env.context.project.schemeMarks.length,0);
  assert.match(env.element('schHint').textContent,/Не удалось сохранить/);
  fail=false;await env.api.saveDrawings();
  assert.equal(env.api.state.dirty.size,0);assert.equal(env.context.project.schemeMarks[0].id,x.id);
  assert.equal(payload.custom_data.appearance.color,'#ff0000');assert.equal(payload.custom_data.appearance.width,7);
});

test('PDF: отпускание мыши не открывает карточку и не выключает рисование', () => {
  let dialogs=0;
  const env=moduleContext('js/schemes.js','state,endDraw',{openModal(){dialogs++;}});
  env.window.LIV_ACCESS={role:'planner'};
  env.context.document.createElement=()=>({style:{},dataset:{},classList:{add(){},toggle(){}}});
  env.element('schOverlay').appendChild=()=>{};
  env.element('schOverlay').getBoundingClientRect=()=>({left:0,top:0,width:1000,height:500});
  Object.assign(env.api.state,{schemeId:'S1',draw:true,start:{x:.1,y:.1},tool:'line',pdf:{numPages:1}});
  env.api.endDraw({clientX:400,clientY:150});
  assert.equal(dialogs,0);assert.equal(env.api.state.draw,true);assert.equal(env.api.state.dirty.size,1);
  assert.match(env.element('schSaveDrawings').textContent,/\(1\)/);
});

function factModel() {return moduleContext('js/fact-series.js','series,primaryRows').api;}
const mixedFacts=[
 {id:'before',frontId:'F1',factDate:'2026-10-01',factType:'quantity',quantity:10},
 {id:'baseline',frontId:'F1',factDate:'2026-10-02',factType:'cumulative_snapshot',cumulativeQty:50},
 {id:'same-day',frontId:'F1',factDate:'2026-10-02',factType:'quantity',quantity:5},
 {id:'after',frontId:'F1',factDate:'2026-10-03',factType:'quantity',quantity:10,cumulativeQty:999},
 {id:'future',frontId:'F1',factDate:'2026-11-01',factType:'quantity',quantity:500},
 {id:'deleted',frontId:'F1',factDate:'2026-10-03',quantity:1000,active:false}
];
test('Факт: накопительная отсечка заменяет предыдущий итог, последующий прирост добавляется',()=>{
 const api=factModel();const result=api.series(mixedFacts,'2026-10-03');
 assert.equal(result.actual,60);assert.equal(result.entries.reduce((s,r)=>s+r.qty,0),60);
 assert.equal(api.series(mixedFacts,'2026-10-01').actual,10);
 assert.equal(api.series(mixedFacts,'2026-10-02').actual,50);
});
test('Факт: исходная отсечка не выдаётся за дневную выработку, исправленная отсечка уменьшает итог',()=>{
 const api=factModel();const rows=[mixedFacts[1],mixedFacts[3]];
 assert.equal(api.series(rows,'2026-10-03').daily.get('2026-10-02'),undefined);
 rows.push({id:'correction',frontId:'F1',factDate:'2026-10-04',factType:'cumulative_snapshot',cumulativeQty:45});
 assert.equal(api.series(rows,'2026-10-04').actual,45);
});
test('Факт: старый журнал не удваивает факты, дополнительные показатели не смешиваются с основным',()=>{
 const api=factModel();const current={workMetrics:[{id:'pipe',frontId:'F1',isPrimary:true},{id:'wells',frontId:'F1'}],progressFacts:[{...mixedFacts[0],metricId:'pipe'},{id:'w',frontId:'F1',metricId:'wells',factDate:'2026-10-01',quantity:100}],factLog:[{id:'before',frontId:'F1',date:'2026-10-01',qty:10}]};
 assert.equal(api.series(api.primaryRows(current)).actual,10);
});
test('Отчёт и риск КД используют один итог на выбранную дату без будущего и дополнительных показателей',()=>{
 const api=factModel();const env=moduleContext('js/report-snapshots.js','factValueAt,snapshotFronts');env.window.LIV_FACT_SERIES=api;
 env.context.project.progressFacts=mixedFacts;env.context.project.workMetrics=[{id:'wells',frontId:'F1'}];
 env.context.project.progressFacts=[...mixedFacts,{id:'w',frontId:'F1',metricId:'wells',factDate:'2026-10-03',quantity:900}];
 assert.equal(env.api.factValueAt('F1','2026-10-03'),60);
 env.context.project.fronts=[{id:'F1',totalQty:100}];
 const report=env.api.snapshotFronts('2026-10-03','2026-10-02')[0];
 assert.equal(report.doneQty,60);assert.equal(report.previousQty,50);assert.equal(report.periodQty,10);
 const risk=moduleContext('js/milestone-risk.js','compute');risk.window.LIV_FACT_SERIES=api;
 Object.assign(risk.context.project,{progressFacts:env.context.project.progressFacts,workMetrics:env.context.project.workMetrics,fronts:[{id:'F1',totalQty:100}]});
 const r=risk.api.compute({id:'M1',frontId:'F1',targetQty:100,contractDate:'2026-10-10'},{asOf:'2026-10-03'});
 assert.equal(r.actualQty,60);assert.equal(r.remainingQty,40);
});

test('XLSX: реальный двулистовой файл → предпросмотр → импорт → повтор без дублей', {skip:!process.env.LIV_XLSX_TEST_PATH}, async()=>{
 const env=importer();vm.runInContext(fs.readFileSync(process.env.LIV_XLSX_TEST_PATH,'utf8'),env.context);env.window.XLSX=env.context.XLSX;
 const X=env.context.XLSX,book=X.utils.book_new();
 const header=['№','Подрядчик','№ договора','Наименование ключевой даты','Дата окончания','Здание'];
 X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([header,['1','Подрядчик','Д-1','Выполнить 190 свай','25.10.2026','ГК'],['2','Подрядчик','Д-1','Кровля выполнена','31.10.2026','ГК']]),'Договор 1');
 X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([header,['1','Подрядчик','Д-2','Выполнить 50 анкеров','28.10.2026','ГК']]),'Договор 2');
 const data=X.write(book,{type:'array',bookType:'xlsx'});
 await env.api.readFile({name:'Проба КД.xlsx',arrayBuffer:async()=>data});
 assert.equal(env.api.state.rows.length,3);assert.equal(env.context.project.milestones.length,0);
 assert.equal(env.api.state.rows.filter(x=>x.result==='Ошибка').length,0);
 assert.equal(env.api.state.rows[0].targetQty,190);
 env.api.state.rows.forEach(x=>x.selected=true);await env.api.commitImport();assert.equal(env.context.project.milestones.length,3);assert.equal(env.context.project.contracts.length,2);
 await env.api.readFile({name:'Проба КД.xlsx',arrayBuffer:async()=>data});env.api.state.rows.forEach(x=>x.selected=true);await env.api.commitImport();assert.equal(env.context.project.milestones.length,3);
});

test('Отчёт: снимок неизменяем, повтор блокируется, ошибка сохранения позволяет повторить',async()=>{
 let fail=true;
 const env=moduleContext('js/report-snapshots.js','capture',{saveProject:async()=>{if(fail)throw Error('offline');}});
 env.context.document.querySelector=()=>null;env.window.LIV_FACT_SERIES=factModel();
 env.context.project.milestones=[{id:'M1',riskDetails:{nested:{value:1}}}];
 const input={reportDate:'2026-10-14',previousReportDate:'2026-10-07',title:'Проверка'};
 await assert.rejects(env.api.capture(input),/offline/);assert.equal(env.context.project.reportSnapshots.length,0);
 fail=false;const snapshot=await env.api.capture(input);
 env.context.project.milestones[0].riskDetails.nested.value=99;
 assert.equal(snapshot.dataSnapshot.milestones[0].riskDetails.nested.value,1);
 await assert.rejects(env.api.capture(input),/уже существует/);
});

function editor(){
 const e=moduleContext('js/schemes.js','state,stageDrawing,historyStep,editMark,visibleMarks,legendEntries,fileKind,deleteVersioned,writeVersioned,imageDocument');
 e.window.LIV_ACCESS={role:'planner'};e.api.state.schemeId='S1';
 e.context.document.createElement=()=>({style:{},dataset:{},classList:{add(){},toggle(){}}});e.element('schOverlay').appendChild=()=>{};return e;
}
test('Схемы: отмена и повтор создания, стиля и удаления после серверного сохранения',()=>{
 const e=editor(),a=e.api,x=a.stageDrawing({markType:'circle',x:.1,y:.1,width:.1,height:.1});
 a.historyStep();assert.equal(a.visibleMarks().length,0);a.historyStep(true);assert.equal(a.visibleMarks().length,1);
 const saved={...a.state.dirty.get(x.id),serverId:'uuid',serverVersion:5};e.context.project.schemeMarks.push(saved);a.state.dirty.clear();
 a.editMark({...saved,appearance:{color:'#ff0000',fill:1,width:8}});
 a.historyStep();assert.equal(a.state.dirty.get(x.id).serverVersion,5);assert.notEqual(a.state.dirty.get(x.id).appearance.color,'#ff0000');
 a.historyStep(true);assert.equal(a.state.dirty.get(x.id).appearance.fill,1);
 a.editMark({...a.state.dirty.get(x.id),active:false});a.historyStep();assert.equal(a.visibleMarks().length,1);
 a.historyStep(true);assert.equal(a.visibleMarks().length,0);
 a.historyStep();a.historyStep();a.historyStep();assert.equal(a.state.dirty.get(x.id).active,false);
 a.historyStep(true);assert.equal(a.state.dirty.get(x.id).serverVersion,5);assert.equal(a.visibleMarks().length,1);
});
test('Схемы: история не отменяет рисунки другой страницы, новое действие сбрасывает повтор',()=>{
 const {api:a}=editor();a.stageDrawing({markType:'point'});a.state.page=2;a.stageDrawing({markType:'point'});
 a.state.page=1;a.historyStep();assert.equal(a.visibleMarks().length,0);a.state.page=2;assert.equal(a.visibleMarks().length,1);
 a.stageDrawing({markType:'line'});assert.equal(a.state.redo.length,0);
});
test('Легенда: объединяет одинаковые обозначения, различает цвета и форму, отражает заливку',()=>{
 const {api:a}=editor();const row={designation:'Монтаж',markType:'circle',appearance:{color:'#ff0000',width:4,fill:1}};
 const list=a.legendEntries([row,row,{...row,appearance:{...row.appearance,color:'#00ff00'}},{...row,markType:'line'}]);
 assert.equal(list.length,3);assert.equal(list[0].count,2);assert.equal(list[0].fill,1);assert.equal(list[1].color,'#00ff00');
 assert.equal(a.legendEntries([{status:'В работе'}])[0].color,'#d2860b');
});
test('Схемы: форматы PDF, PNG, JPEG разрешены, SVG и HTML отклоняются',()=>{
 const {api:a}=editor();for(const type of ['application/pdf','image/png','image/jpeg'])assert.ok(a.fileKind({type}));
 assert.equal(a.fileKind({type:'image/svg+xml',name:'image.png'}),null);assert.equal(a.fileKind({type:'text/html'}),null);
 assert.equal(a.fileKind({type:'',name:'Скриншот.JPG'}).mime,'image/jpeg');
});
test('Изображение: одностраничный документ сохраняет пропорции и использует масштаб canvas',async()=>{
 const e=editor(),calls=[];e.context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:u=>calls.push(u)};
 e.context.Image=class{naturalWidth=1600;naturalHeight=900;async decode(){}};
 const doc=await e.api.imageDocument({}),page=await doc.getPage(1),v=page.getViewport({scale:.5});
 assert.equal(doc.numPages,1);assert.equal(v.width,800);assert.equal(v.height,450);
 await page.render({canvasContext:{save(){},restore(){},transform(...args){calls.push(args)},drawImage(img,x,y,w,h){calls.push([w,h])}},viewport:v,transform:[2,0,0,2,0,0]}).promise;
 assert.deepEqual(calls[2],[800,450]);assert.equal(calls[0],'blob:test');
});
test('Удаление схемы: ждёт запись, обновляет техническую версию, сохраняет проверку конфликта',async()=>{
 const e=editor(),a=e.api;let version=2,deleted=false,changed=false;const x={id:'S1',serverId:'uuid',serverVersion:1,name:'Схема',storagePath:'source.pdf',active:true};
 e.window.LIV_SUPABASE={from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{id:'uuid',row_version:version,name:changed?'Чужое изменение':'Схема',storage_path:'source.pdf',active:true}}},update(){return {eq(){return this},async select(){await Promise.resolve();return {data:[{row_version:++version}]}}}},delete(){return {eq(k,v){if(k==='row_version')assert.equal(v,version);return this},async select(){deleted=true;return {data:[{id:'uuid'}]}}}}}}};
 await Promise.all([a.writeVersioned('schemes',x,{}),a.deleteVersioned('schemes',x)]);assert.equal(deleted,true);
 deleted=false;changed=true;await assert.rejects(a.deleteVersioned('schemes',x),/другой сессии/);assert.equal(deleted,false);
});

test('Изображение: начало и завершение рисунка не блокируются пустым обозначением',async()=>{
 const e=moduleContext('js/schemes.js','state,imageDocument,startDraw,moveDraw,endDraw,visibleMarks,legendEntries');
 e.window.LIV_ACCESS={role:'planner'};
 e.context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};
 e.context.Image=class{naturalWidth=1200;naturalHeight=800;async decode(){}};
 e.context.document.createElement=()=>({style:{},dataset:{},classList:{add(){},toggle(){}},remove(){}});
 const overlay=e.element('schOverlay');overlay.appendChild=()=>{};overlay.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:800});
 Object.assign(e.api.state,{schemeId:'S1',pdf:await e.api.imageDocument({}),draw:true,designation:'',tool:'circle'});
 e.api.startDraw({target:overlay,button:0,pointerId:1,clientX:120,clientY:80,preventDefault(){}});
 assert.ok(e.api.state.start,'Пустое обозначение не должно блокировать рисование');
 e.api.endDraw({clientX:360,clientY:320});
 const rows=e.api.visibleMarks();assert.equal(rows.length,1);assert.equal(rows[0].markType,'circle');
 assert.equal(e.api.legendEntries(rows)[0].label,'Без обозначения');
 assert.equal(e.api.state.draw,true);
});

test('КД по графику: перенос рабочей даты показывает риск без выдуманного объёма',()=>{
 const e=moduleContext('js/milestone-risk.js','compute');e.context.project.tasks=[{id:'T',versionId:'V',active:true}];e.context.project.scheduleVersions=[{id:'V',effectiveDate:'2026-10-15'}];e.context.project.taskDates=[{taskId:'T',type:'working',finish:'2026-10-25'}];
 const r=e.api.compute({id:'M',scheduleTaskId:'T',contractDate:'2026-10-20'},{asOf:'2026-10-16'});assert.equal(r.sourceMode,'schedule');assert.equal(r.riskLevel,'red');assert.equal(r.targetQty,null);assert.equal(r.projectedFinishDate,'2026-10-25');
 const earlier=e.api.compute({id:'M',scheduleTaskId:'T',contractDate:'2026-10-20'},{asOf:'2026-10-10'});assert.equal(earlier.riskLevel,'gray');assert.equal(earlier.projectedFinishDate,'');
});
test('КД по графику: процент задачи не подменяет подтверждение выполнения КД',()=>{
 const e=moduleContext('js/milestone-risk.js','compute');e.context.project.tasks=[{id:'T',progressPercent:100}];e.context.project.taskDates=[{taskId:'T',type:'working',finish:'2026-10-18'}];
 const r=e.api.compute({id:'M',scheduleTaskId:'T',contractDate:'2026-10-20'},{asOf:'2026-10-16'});assert.equal(r.riskLevel,'yellow');assert.match(r.reason,/требует подтверждения/);
});
test('Схема читает канонический факт вместо устаревшего итога фронта; будущее исключено',()=>{
 const e=schemes();e.window.LIV_FACT_SERIES=factModel();e.context.project.fronts=[{id:'F',totalQty:100,doneQty:999}];e.context.project.progressFacts=[{id:'now',frontId:'F',factDate:'2026-10-01',factType:'cumulative_snapshot',cumulativeQty:40},{id:'future',frontId:'F',factDate:'2099-01-01',quantity:50}];assert.equal(e.api.derivedProgress('Выполнено','F'),40);assert.equal(e.context.project.fronts[0].doneQty,999);
});
test('Схема на отчётную дату: повторные отметки не увеличивают вес фронта и не меняют записи',()=>{
 const e=schemes();e.window.LIV_FACT_SERIES=factModel();e.window.LIV_PLANNING_UI={context:()=>({state:{to:'2026-10-21'}})};e.context.project.fronts=[{id:'F',totalQty:100},{id:'G',totalQty:100}];e.context.project.progressFacts=[{id:'f',frontId:'F',factDate:'2026-10-20',factType:'cumulative_snapshot',cumulativeQty:40},{id:'g',frontId:'G',factDate:'2026-10-20',factType:'cumulative_snapshot',cumulativeQty:100}];e.context.project.schemeMarks=[{id:'a',schemeId:'S',frontId:'F',status:'В работе',progressPercent:5},{id:'b',schemeId:'S',frontId:'F',status:'В работе',progressPercent:5},{id:'c',schemeId:'S',frontId:'G',status:'Выполнено',progressPercent:5}];e.api.state.schemeId='S';const before=JSON.stringify(e.context.project);e.api.stats();assert.equal(e.element('schProgress').textContent,'70%');assert.equal(JSON.stringify(e.context.project),before);assert.equal(e.api.derivedProgress('В работе','F','','','2026-10-19'),null);
});
test('Схема блокирует противоречивые связи до записи и создания отметки',async()=>{
 const notices=[],e=schemes({alert:m=>notices.push(m)});e.context.project.numberedElements=[{id:'N',frontId:'F2',groupId:'G2'}];e.element('smFront').value='F1';e.element('smElement').value='N';e.element('smGroup').value='';const before=e.context.project.schemeMarks.length;await e.api.saveMark(null,{schemeId:'S',pageNo:1});assert.equal(e.context.project.schemeMarks.length,before);assert.ok(notices.some(m=>String(m).includes('разным участкам')));
});
test('КД: объём выполнен, но освидетельствование не подтверждено; сохранённый прогноз связан',()=>{
 const e=moduleContext('js/milestone-risk.js','compute');e.window.LIV_FACT_SERIES=factModel();e.context.project.fronts=[{id:'F',totalQty:100}];e.context.project.progressFacts=[{id:'x',frontId:'F',factDate:'2026-10-19',factType:'cumulative_snapshot',cumulativeQty:100}];
 const r=e.api.compute({id:'M',frontId:'F',targetQty:100,contractDate:'2026-10-28'},{asOf:'2026-10-21'});assert.equal(r.riskLevel,'yellow');assert.match(r.reason,/требуют подтверждения/);
 e.window.LIV_CHAIN={milestoneView:()=>({finish:'2026-10-29',version:{effectiveDate:'2026-10-20'}})};const linked=e.api.compute({id:'M',riskMethod:'schedule',contractDate:'2026-10-28'},{asOf:'2026-10-21'});assert.equal(linked.projectedFinishDate,'2026-10-29');assert.equal(linked.riskLevel,'red');
});
