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
  const env = moduleContext('js/schemes.js', 'state,saveMark,loadPdf,pdfjs,syncScheme,syncMark,derivedProgress', extra);
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
