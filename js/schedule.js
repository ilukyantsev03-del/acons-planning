'use strict';

/* =========================================================
   LIV Planning — ГРАФИК
   Тестовый импорт графиков Excel / CSV
   Единая модель задач без разрушения старых fronts
   ========================================================= */

(function () {
  const state = {
    workbook: null,
    fileName: '',
    sheetName: '',
    rows: [],
    headerRow: -1,
    headers: [],
    dataRows: [],
    mapping: {},
    sourceType: 'auto',
    sheetMappings: {},
    defaultGroup: ''
  };

  const FIELD_DEFS = {
    element: {label:'Элемент / конструкция', aliases:['наименование элемента','конструкция','элемент']},
    name: {
      label: 'Задача',
      aliases: ['task name','задача','наименование задачи','название задачи','наименование работ','вид работ','работа','название']
    },
    building: {
      label: 'Здание / объект',
      aliases: ['здание','объект','корпус','сооружение']
    },
    block: {
      label: 'Блок / секция',
      aliases: ['блок','секция']
    },
    floor: {
      label: 'Этаж / уровень',
      aliases: ['этаж','уровень']
    },
    axis: {
      label: 'Оси',
      aliases: ['ось','оси']
    },
    capture: {
      label: 'Захватка',
      aliases: ['захватка','участок работ']
    },
    zone: {
      label: 'Зона',
      aliases: ['зона']
    },
    network: {
      label: 'Сеть',
      aliases: ['сеть','наименование сети']
    },
    segment: {
      label: 'Участок / сегмент',
      aliases: ['участок','сегмент','участок сети']
    },
    organization: {
      label: 'Подрядчик',
      aliases: ['подрядчик','организация','субподрядчик','исполнитель']
    },
    status: {
      label: 'Статус',
      aliases: ['статус','состояние']
    },
    sourceTaskId: {
      label: 'ID задачи',
      aliases: ['№ п/п','ид','id','id задачи','номер задачи','№ задачи','task id']
    },
    outlineNumber: {
      label: 'Код структуры',
      aliases: ['код структуры','номер структуры','структурный номер','outline number','wbs','сдп']
    },
    progress: {
      label: '% выполнения',
      aliases: ['% complete','% завершен','% завершено','% выполнения','процент выполнения','готовность']
    },
    duration: {
      label: 'Длительность',
      aliases: ['duration','длит','длительность','продолжительность','длительность дни','длительность дн']
    },
    workingStart: {
      label: 'Рабочее начало',
      aliases: ['start','начало','дата начала','начало план','план начало','текущее начало','рабочее начало']
    },
    workingFinish: {
      label: 'Рабочее окончание',
      aliases: ['finish','окончание','дата окончания','окончание план','план окончание','текущее окончание','рабочее окончание']
    },
    baselineStart: {
      label: 'Базовое начало',
      aliases: ['базовое начало','начало базового плана','начало базовый план']
    },
    baselineFinish: {
      label: 'Базовое окончание',
      aliases: ['базовое окончание','окончание базового плана','окончание базовый план']
    },
    contractStart: {
      label: 'Договорное начало',
      aliases: ['договорное начало','начало договор']
    },
    contractFinish: {
      label: 'Договорное окончание',
      aliases: ['договорное окончание','окончание договор']
    },
    factStart: {
      label: 'Факт начало',
      aliases: ['факт начало','фактическое начало','начало факт']
    },
    factFinish: {
      label: 'Факт окончание',
      aliases: ['факт окончание','фактическое окончание','окончание факт']
    },
    predecessors: {
      label: 'Предшественники',
      aliases: ['предшественники','предшественник','предыдущие задачи','предыдущая задача']
    },
    successors: {
      label: 'Последователи',
      aliases: ['последователи','последователь','следующие задачи']
    },
    unit: {
      label: 'Ед. изм.',
      aliases: ['ед изм','ед. изм.','единица измерения']
    },
    quantity: {
      label: 'Объем',
      aliases: ['объем ориентировочно','объем','объём','общий объем','общий объём','количество']
    },
    comment: {
      label: 'Комментарий',
      aliases: ['комментарий','примечание','описание']
    }
  };

  function text(v) {
    return String(v == null ? '' : v).trim();
  }

  function key(v) {
    return text(v)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[%№]/g, ' ')
      .replace(/[()\[\]{}.,:;!?/\\_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(v) {
    return text(v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function num(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(text(v).replace(/\s/g,'').replace(',','.').replace('%',''));
    return Number.isFinite(n) ? n : null;
  }

  function isoDate(v) { return window.LIV_PLANNING.date(v); }

  function uid(prefix) {
    if (typeof window.uid === 'function') return window.uid(prefix);
    return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  }

  function ensureCollections() {
    if (typeof project === 'undefined' || !project) return false;
    const names = [
      'tasks','taskDates','taskQuantities','dependencies',
      'dailyReports','factHistory','quantityHistory','forecastSnapshots',
      'scheduleStaging','scheduleVersions'
    ];
    names.forEach(name => {
      if (!Array.isArray(project[name])) project[name] = [];
    });
    return true;
  }

  function matchHeader(header) {
    const h = key(header);
    if (!h) return '';
    let best = '';
    let bestScore = 0;
    Object.entries(FIELD_DEFS).forEach(([field, def]) => {
      [def.label, ...def.aliases].forEach(alias => {
        const a = key(alias);
        let score = 0;
        if (h === a) score = 1000 + a.length;
        else if (h.includes(a) || a.includes(h)) score = 100 + Math.min(h.length,a.length);
        if (score > bestScore) {
          bestScore = score;
          best = field;
        }
      });
    });
    return bestScore >= 104 ? best : '';
  }

  function detectHeaderRow(rows) {
    let bestIndex = -1;
    let bestScore = -1;
    rows.slice(0,35).forEach((row, index) => {
      const matches = new Set();
      let nonEmpty = 0;
      (row || []).forEach(cell => {
        if (text(cell)) nonEmpty += 1;
        const field = matchHeader(cell);
        if (field) matches.add(field);
      });
      let score = matches.size * 10 + Math.min(nonEmpty,10);
      if (matches.has('name')) score += 20;
      if (matches.has('workingStart') || matches.has('workingFinish')) score += 8;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function autoMap(headers) {
    const mapping = {};
    headers.forEach((header, index) => {
      const field = matchHeader(header);
      if (field && mapping[field] == null) mapping[field] = index;
    });
    return mapping;
  }

  function ensureTabAndPanel() {
    const nav = document.querySelector('nav.tabs');
    const main = document.querySelector('main.container');
    if (!nav || !main) return;

    let tab = nav.querySelector('[data-tab="schedule"]');
    if (!tab) {
      tab = document.createElement('button');
      tab.className = 'tab';
      tab.dataset.tab = 'schedule';
      tab.textContent = 'График';
      const matrixTab = nav.querySelector('[data-tab="matrix"]');
      if (matrixTab) nav.insertBefore(tab, matrixTab);
      else nav.appendChild(tab);
    }

    if (!tab.dataset.scheduleBound) {
      tab.dataset.scheduleBound = '1';
      tab.addEventListener('click', () => {
        setTimeout(renderSchedule, 0);
      });
    }

    if (!document.getElementById('tab-schedule')) {
      const panel = document.createElement('section');
      panel.id = 'tab-schedule';
      panel.className = 'panel hidden';
      panel.innerHTML = `
        <section class="card schedule-hero no-print">
          <div>
            <div class="schedule-kicker">ГРАФИК ПРОЕКТА</div>
            <h2>Единая модель задач</h2>
            <p class="muted schedule-lead">Загрузите Excel или CSV, проверьте сопоставление колонок и импортируйте задачи. Исходный файл не заменяет данные LIV.</p>
          </div>
          <div class="schedule-hero-actions">
            <label class="btn primary">
              Загрузить график
              <input id="scheduleFileInput" type="file" accept=".xlsx,.xls,.csv" hidden>
            </label>
            <button id="schedulePromoteBtn" class="btn" type="button">Принять как рабочий график</button>
            <button id="scheduleClearTestBtn" class="btn danger-lite" type="button">Удалить тестовый импорт</button>
          </div>
        </section>

        <section id="scheduleImportCard" class="card hidden no-print">
          <div class="schedule-import-head">
            <div>
              <h2>Проверка импорта</h2>
              <div id="scheduleFileMeta" class="muted"></div>
            </div>
            <div class="schedule-import-controls">
              <div class="field compact-field">
                <label>Лист</label>
                <select id="scheduleSheetSelect"></select>
              </div>
              <div class="field compact-field">
                <label>Тип исходника</label>
                <select id="scheduleSourceType">
                  <option value="auto">Авто</option>
                  <option value="classic">Классический график</option>
                  <option value="matrix">Шахматка</option>
                  <option value="linear">Линейный / сети</option>
                </select>
              </div>
            </div>
          </div>
          <div class="schedule-mapping">
            <label>Группа графика (одинаковая для всех его версий)<input id="scheduleGroup" placeholder="Например: Кровля / договор Ренессанс"></label>
            <label>Назначение<select id="scheduleRole"><option value="working">Внутренний рабочий</option><option value="contractor">Договор подрядчика</option><option value="customer">График Заказчика</option></select></label>
            <label>Организация<select id="scheduleOrganization"><option value="">Не выбрана</option></select></label>
            <label>Номер договора<input id="scheduleContractNo" placeholder="Точный номер договора"></label>
            <label><input id="scheduleRegisterKD" type="checkbox"> При принятии зарегистрировать КД в договорном журнале</label>
            <label>Дата версии<input id="scheduleEffective" type="date"></label>
            <label>Календарь<select id="scheduleCalendar"><option value="7x0">7 дней в неделю</option><option value="6x1">6 дней, воскресенье выходной</option><option value="5x2">5 дней, суббота и воскресенье выходные</option></select></label>
            <label><input id="scheduleMilestoneFallback" type="checkbox"> Для строк КД использовать единственную дату из «Начала» как срок КД</label>
            <p class="muted">Рабочие дни считаются включительно. Исходные даты сохраняются без пересчёта. Договорные сроки не изменяются прогнозом.</p>
          </div>
          <div id="scheduleMapping" class="schedule-mapping"></div>
          <div id="schedulePreview" class="table-wrap schedule-preview"></div>
          <div class="editor-actions">
            <button id="scheduleImportBtn" class="btn primary" type="button">Загрузить в тестовый контур</button>
            <span id="scheduleImportHint" class="muted"></span>
          </div>
        </section>

        <section class="card no-print">
          <div class="schedule-toolbar">
            <div class="field">
              <label>Поиск</label>
              <input id="scheduleSearch" placeholder="Задача, объект, подрядчик, участок">
            </div>
            <div class="field compact-field">
              <label>Представление</label>
              <select id="scheduleViewMode">
                <option value="classic">Классический</option>
                <option value="matrix">Шахматка</option>
                <option value="all">Таблица и шахматка</option>
              </select>
            </div>
          </div>
        </section>

        <section class="stats stats-5 schedule-stats">
          <div class="stat"><span>Задач</span><strong id="scheduleTotal">0</strong></div>
          <div class="stat"><span>В работе</span><strong id="scheduleInWork">0</strong></div>
          <div class="stat"><span>Завершено</span><strong id="scheduleDone">0</strong></div>
          <div class="stat"><span>С датами</span><strong id="scheduleWithDates">0</strong></div>
          <div class="stat"><span>Из импорта</span><strong id="scheduleImported">0</strong></div>
        </section>

        <section class="card table-wrap">
          <div id="scheduleEmpty" class="schedule-empty">
            <b>График пока не загружен.</b>
            <span>Для теста загрузите Excel/CSV. Перед записью LIV покажет найденные поля и первые строки.</span>
          </div>
          <table id="scheduleTable" class="hidden">
            <thead>
              <tr>
                <th>№</th>
                <th>Задача</th>
                <th>Контекст</th>
                <th>Подрядчик</th>
                <th>Статус</th>
                <th>Рабочее начало</th>
                <th>Рабочее окончание</th>
                <th>Базовое начало</th>
                <th>Базовое окончание</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody id="scheduleRows"></tbody>
          </table>
        </section>
      `;
      const dashboard = document.getElementById('tab-dashboard');
      if (dashboard && dashboard.nextSibling) main.insertBefore(panel, dashboard.nextSibling);
      else main.appendChild(panel);
    }

    bindUi();
    registerBuilder();
  }

  function registerBuilder() {
    const api = window.LIV_VIEW_BUILDER;
    if (!api || typeof api.register !== 'function') return;
    api.register('schedule', {
      modes: [
        { id: 'classic', label: 'Классический' },
        { id: 'matrix', label: 'Шахматка' },
        { id: 'linear', label: 'Линейный' }
      ],
      filters: [
        { id: 'scheduleSearch', selector: '#scheduleSearch', label: 'Поиск' },
        { id: 'scheduleViewMode', selector: '#scheduleViewMode', label: 'Представление' }
      ],
      actions: [
        { id: 'upload', selector: '.schedule-hero-actions .btn.primary', label: 'Загрузить график' },
        { id: 'promote', selector: '#schedulePromoteBtn', label: 'Принять как рабочий график' },
        { id: 'clear', selector: '#scheduleClearTestBtn', label: 'Удалить тестовый импорт' }
      ],
      kpis: [
        { id: 'total', selector: '#scheduleTotal', label: 'Задач' },
        { id: 'inWork', selector: '#scheduleInWork', label: 'В работе' },
        { id: 'done', selector: '#scheduleDone', label: 'Завершено' },
        { id: 'dates', selector: '#scheduleWithDates', label: 'С датами' },
        { id: 'imported', selector: '#scheduleImported', label: 'Из импорта' }
      ],
      blocks: [
        { id: 'table', selector: '#scheduleTable', label: 'Таблица графика' }
      ]
    });
  }

  function bindUi() {
    const fallback=document.getElementById('scheduleMilestoneFallback');
    if(fallback&&!fallback.dataset.bound){fallback.dataset.bound='1';fallback.addEventListener('change',()=>renderImportPreview());}
    const input = document.getElementById('scheduleFileInput');
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('change', handleFile);
    }

    const sheet = document.getElementById('scheduleSheetSelect');
    if (sheet && !sheet.dataset.bound) {
      sheet.dataset.bound = '1';
      sheet.addEventListener('change', () => {
        state.sheetMappings[state.sheetName]={...state.mapping};
        state.sheetName = sheet.value;
        const group=document.getElementById('scheduleGroup');
        const nextGroup=state.fileName.replace(/\.(xlsx?|csv)$/i,'').replace(/\d{2}[._-]\d{2}[._-]\d{2,4}/g,'').trim()+' / '+state.sheetName;
        if(group.value===state.defaultGroup)group.value=nextGroup;
        state.defaultGroup=nextGroup;
        parseSheet();
      });
    }

    const sourceType = document.getElementById('scheduleSourceType');
    if (sourceType && !sourceType.dataset.bound) {
      sourceType.dataset.bound = '1';
      sourceType.addEventListener('change', () => {
        state.sourceType = sourceType.value;
      });
    }

    const importBtn = document.getElementById('scheduleImportBtn');
    if (importBtn && !importBtn.dataset.bound) {
      importBtn.dataset.bound = '1';
      importBtn.addEventListener('click', importSchedule);
    }

    const promoteBtn = document.getElementById('schedulePromoteBtn');
    if (promoteBtn && !promoteBtn.dataset.bound) {
      promoteBtn.dataset.bound = '1';
      promoteBtn.addEventListener('click', promoteTestImport);
    }

    const clearBtn = document.getElementById('scheduleClearTestBtn');
    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = '1';
      clearBtn.addEventListener('click', clearTestImport);
    }

    const search = document.getElementById('scheduleSearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', renderSchedule);
    }

    const view = document.getElementById('scheduleViewMode');
    if (view && !view.dataset.bound) {
      view.dataset.bound = '1';
      view.addEventListener('change', renderSchedule);
    }
  }

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !window.XLSX) return;

    const buffer = await file.arrayBuffer();
    state.sheetMappings={};
    state.workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: true });
    state.fileName = file.name;
    state.sheetName = state.workbook.SheetNames[0] || '';

    const select = document.getElementById('scheduleSheetSelect');
    select.innerHTML = state.workbook.SheetNames
      .map(name => '<option value="'+esc(name)+'">'+esc(name)+'</option>')
      .join('');
    select.value = state.sheetName;

    document.getElementById('scheduleImportCard').classList.remove('hidden');
    document.getElementById('scheduleOrganization').innerHTML='<option value="">Не выбрана</option>'+(project.organizations||[]).filter(o=>o.active!==false).map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join('');
    document.getElementById('scheduleRegisterKD').checked=false;
    document.getElementById('scheduleContractNo').value='';
    state.defaultGroup=state.fileName.replace(/\.(xlsx?|csv)$/i,'').replace(/\d{2}[._-]\d{2}[._-]\d{2,4}/g,'').trim()+' / '+state.sheetName;
    document.getElementById('scheduleGroup').value=state.defaultGroup;
    document.getElementById('scheduleEffective').value=new Date().toISOString().slice(0,10);
    document.getElementById('scheduleMilestoneFallback').checked=false;
    parseSheet();
  }

  function parseSheet() {
    if (!state.workbook || !state.sheetName) return;
    const ws = state.workbook.Sheets[state.sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    state.rows = rows;
    state.headerRow = detectHeaderRow(rows);

    if (state.headerRow < 0) {
      state.headers = [];
      state.dataRows = [];
      renderImportPreview('Не удалось определить строку заголовков.');
      return;
    }

    state.headers = (rows[state.headerRow] || []).map((h,i) => text(h) || 'Колонка '+(i+1));
    state.dataRows = rows.slice(state.headerRow + 1); // Preserve original source row numbers.
    state.mapping = state.sheetMappings[state.sheetName]||autoMap(state.headers);

    renderMapping();
    renderImportPreview();
  }

  function renderMapping() {
    const host = document.getElementById('scheduleMapping');
    if (!host) return;

    const used = Object.entries(state.mapping);
    host.innerHTML = `
      <div class="schedule-map-title">
        <b>Найденные поля</b>
        <span class="muted">Можно поправить сопоставление перед импортом.</span>
      </div>
      <div class="schedule-map-grid">
        ${Object.entries(FIELD_DEFS).map(([field,def]) => {
          const current = state.mapping[field];
          return `
            <label class="schedule-map-item">
              <span>${esc(def.label)}</span>
              <select data-schedule-field="${field}">
                <option value="">— не импортировать —</option>
                ${state.headers.map((h,index) => `
                  <option value="${index}" ${current === index ? 'selected' : ''}>${esc(h)}</option>
                `).join('')}
              </select>
            </label>
          `;
        }).join('')}
      </div>
      <div class="muted schedule-map-summary">Автоматически сопоставлено: ${used.length} полей · строк данных: ${state.dataRows.length}</div>
    `;

    host.querySelectorAll('[data-schedule-field]').forEach(select => {
      select.addEventListener('change', () => {
        const field = select.dataset.scheduleField;
        if (select.value === '') delete state.mapping[field];
        else state.mapping[field] = Number(select.value);
        renderImportPreview();
      });
    });
  }

  function value(row, field) {
    const index = state.mapping[field];
    return index == null ? '' : row[index];
  }

  function renderImportPreview(message) {
    const host = document.getElementById('schedulePreview');
    const meta = document.getElementById('scheduleFileMeta');
    const hint = document.getElementById('scheduleImportHint');
    if (!host) return;

    if (meta) {
      meta.textContent = state.fileName+' · '+state.sheetName+' · заголовок: строка '+(state.headerRow+1);
    }

    if (message) {
      host.innerHTML = '<div class="schedule-empty">'+esc(message)+'</div>';
      return;
    }

    const prepared=prepareRows({milestoneFallback:document.getElementById('scheduleMilestoneFallback')?.checked});
    host.innerHTML='<table><thead><tr><th>Строка</th><th>Тип</th><th>Здание</th><th>Работа</th><th>Элемент</th><th>Захватка</th><th>Начало</th><th>Окончание</th></tr></thead><tbody>'+prepared.rows.map(r=>'<tr><td>'+r.sourceRow+'</td><td>'+(r.isMilestone?'КД':'Работа')+'</td><td>'+esc(r.building||'Не определено')+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.element)+'</td><td>'+esc(r.capture)+'</td><td>'+esc(r.start||'—')+'</td><td>'+esc(r.finish||'—')+'</td></tr>').join('')+'</tbody></table>'+
      (prepared.errors.length?'<p class="planning-late">'+prepared.errors.map(esc).join('<br>')+'</p>':'')+
      (prepared.warnings.length?'<p class="muted">'+prepared.warnings.map(esc).join('<br>')+'</p>':'');
    if(hint)hint.textContent=state.mapping.name==null?'Нужно выбрать колонку «Задача».':'Распознано: '+prepared.rows.length+' строк. Ошибок: '+prepared.errors.length+'.';
  }

  function detectStatus(progress, status) {
    const explicit = text(status);
    if (explicit) return explicit;
    const p = num(progress);
    if (p != null && p >= 100) return 'Завершено';
    if (p != null && p > 0) return 'В работе';
    return 'Не начато';
  }

  function taskContext(row) {
    return {
      building: text(value(row,'building')),
      block: text(value(row,'block')),
      floor: text(value(row,'floor')),
      axis: text(value(row,'axis')),
      capture: text(value(row,'capture')),
      zone: text(value(row,'zone')),
      network: text(value(row,'network')),
      segment: text(value(row,'segment')),
      element: text(value(row,'element'))
    };
  }

  function parseDependencyToken(raw) {

    const value =
      text(
        raw
      )
        .replace(
          /\s+/g,
          ''
        );


    if (!value) {
      return null;
    }


    const match =
      value.match(
        /^(\d+(?:\.\d+)*)(FS|SS|FF|SF|ОН|НН|ОО|НО)?(?:([+-])(\d+(?:[.,]\d+)?)(?:d|д|дн|days?)?)?$/i
      );


    if (!match) {
      return null;
    }


    const lag =
      match[4]
        ? Number(
            String(
              match[4]
            )
              .replace(
                ',',
                '.'
              )
          ) *
          (
            match[3] ===
              '-'
              ? -1
              : 1
          )
        : 0;


    return {
      sourceTaskId:
        match[1],
      linkType:
        (
          {
            'ОН':
              'FS',
            'НН':
              'SS',
            'ОО':
              'FF',
            'НО':
              'SF'
          }[
            (
              match[2] ||
              ''
            )
              .toUpperCase()
          ] ||
          (
            match[2] ||
            'FS'
          )
            .toUpperCase()
        ),
      lagDays:
        Number.isFinite(
          lag
        )
          ? lag
          : 0,
      sourceExpression:
        text(
          raw
        )
    };
  }


  function parseDependencyList(raw) {

    return text(
      raw
    )
      .split(
        /[;,]+/
      )
      .map(
        parseDependencyToken
      )
      .filter(Boolean);
  }


  function buildStagedDependencies(
    staged,
    versionId
  ) {

    const bySourceId =
      new Map();


    const byOutline =
      new Map();


    staged.forEach(
      (
        item,
        index
      ) => {

        const sourceTaskId =
          text(
            item.task
              .sourceTaskId
          ) ||
          String(
            index +
            1
          );


        bySourceId.set(
          sourceTaskId,
          item.task.id
        );


        if (
          item.task
            .outlineNumber
        ) {

          byOutline.set(
            text(
              item.task
                .outlineNumber
            ),
            item.task.id
          );
        }
      }
    );


    staged.forEach(
      item => {

        const outline =
          text(
            item.task
              .outlineNumber
          );


        if (
          outline &&
          outline.includes(
            '.'
          )
        ) {

          const parentOutline =
            outline
              .split(
                '.'
              )
              .slice(
                0,
                -1
              )
              .join(
                '.'
              );


          item.task.parentTaskId =
            byOutline.get(
              parentOutline
            ) ||
            '';


          item.task.outlineLevel =
            Math.max(
              0,
              outline
                .split(
                  '.'
                )
                .length -
              1
            );
        }
      }
    );


    const dependencies = [];
    const seen = new Set();


    const pushDependency =
      (
        predecessorTaskId,
        successorTaskId,
        parsed
      ) => {

        if (
          !predecessorTaskId ||
          !successorTaskId ||
          predecessorTaskId ===
            successorTaskId
        ) {
          return;
        }


        const key =
          [
            predecessorTaskId,
            successorTaskId,
            parsed.linkType,
            parsed.lagDays
          ]
            .join(
              '|'
            );


        if (
          seen.has(
            key
          )
        ) {
          return;
        }


        seen.add(
          key
        );


        dependencies.push({
          id:
            uid(
              'DEP'
            ),
          versionId,
          predecessorTaskId,
          successorTaskId,
          linkType:
            parsed.linkType,
          lagDays:
            parsed.lagDays,
          sourceExpression:
            parsed.sourceExpression,
          createdAt:
            new Date()
              .toISOString()
        });
      };


    staged.forEach(
      item => {

        parseDependencyList(
          item.task
            .predecessorsRaw
        )
          .forEach(
            parsed => {

              pushDependency(
                bySourceId.get(
                  parsed.sourceTaskId
                ),
                item.task.id,
                parsed
              );
            }
          );


        parseDependencyList(
          item.task
            .successorsRaw
        )
          .forEach(
            parsed => {

              pushDependency(
                item.task.id,
                bySourceId.get(
                  parsed.sourceTaskId
                ),
                parsed
              );
            }
          );
      }
    );


    return dependencies;
  }


  function makeDate(taskId, type, start, finish, source) {
    const s = isoDate(start);
    const f = isoDate(finish);
    if (!s && !f) return null;
    return {
      id: uid('TDATE'),
      taskId,
      type,
      start: s,
      finish: f,
      source: source || 'import',
      createdAt: new Date().toISOString()
    };
  }

  function scheduleTaskIdentity(task) { return window.LIV_PLANNING.identity(task); }

  function stagedWorkingDate(item) {

    return (
      item.dates ||
      []
    )
      .find(
        date =>
          date.type ===
          'working'
      ) ||
      {};
  }


  function acceptedWorkingDate(taskId) {

    const rows =
      (
        project.taskDates ||
        []
      )
        .filter(
          date =>
            String(
              date.taskId
            ) ===
              String(
                taskId
              ) &&
            date.type ===
              'working'
        );


    return rows.length
      ? rows[
          rows.length -
          1
        ]
      : {};
  }


  function buildScheduleComparison(staged) {

    const current =
      (
        project.tasks ||
        []
      )
        .filter(
          task =>
            task.active !==
              false &&
            task.testOnly !==
              true
        );


    const currentMap =
      new Map(
        current.map(
          task => [
            scheduleTaskIdentity(
              task
            ),
            task
          ]
        )
      );


    const stagedKeys =
      new Set();


    let added = 0;
    let changed = 0;
    let unchanged = 0;


    staged.forEach(
      item => {

        const identity =
          scheduleTaskIdentity(
            item.task
          );


        stagedKeys.add(
          identity
        );


        const existing =
          currentMap.get(
            identity
          );


        if (!existing) {
          added++;
          return;
        }


        const stagedDate =
          stagedWorkingDate(
            item
          );


        const currentDate =
          acceptedWorkingDate(
            existing.id
          );


        const isChanged =
          text(
            existing.name
          ) !==
            text(
              item.task.name
            ) ||
          Number(
            existing.progressPercent ||
            0
          ) !==
            Number(
              item.task.progressPercent ||
              0
            ) ||
          text(
            existing.status
          ) !==
            text(
              item.task.status
            ) ||
          text(
            currentDate.start
          ) !==
            text(
              stagedDate.start
            ) ||
          text(
            currentDate.finish
          ) !==
            text(
              stagedDate.finish
            );


        if (
          isChanged
        ) {
          changed++;
        } else {
          unchanged++;
        }
      }
    );


    const removed =
      current
        .filter(
          task =>
            !stagedKeys.has(
              scheduleTaskIdentity(
                task
              )
            )
        )
        .length;


    return {
      added,
      changed,
      unchanged,
      removed
    };
  }


  function prepareRows(options={}) {
    const rows=[],errors=[],warnings=[],sections=[];
    let section='';
    state.dataRows.forEach((row,index)=>{
      const sourceRow=state.headerRow+2+index;
      const nonempty=(row||[]).filter(v=>text(v));
      if(!nonempty.length)return;
      let name=text(value(row,'name'));
      if(nonempty.length===1&&!name){section=text(nonempty[0]);sections.push(section);return;}
      if(!name)return;
      const isMilestone=/ключев[а-яё]*\s+дат|контрольн[а-яё]*\s+дат/i.test(name);
      const rawStart=value(row,'workingStart'),rawFinish=value(row,'workingFinish');
      let start=isoDate(rawStart),finish=isoDate(rawFinish);
      for(const field of ['workingStart','workingFinish','baselineStart','baselineFinish','contractStart','contractFinish','factStart','factFinish']) {
        const v=value(row,field);if(text(v)&&!isoDate(v))errors.push('Строка '+sourceRow+': некорректная дата «'+text(v)+'».');
      }
      if(isMilestone&&!finish&&start){
        if(options.milestoneFallback){finish=start;warnings.push('Строка '+sourceRow+': срок КД взят из колонки начала.');}
        else errors.push('Строка '+sourceRow+': КД имеет дату только в «Начале». Подтвердите правило переноса даты над таблицей.');
      }
      if(isMilestone){start=finish;if(!finish)errors.push('Строка '+sourceRow+': у КД отсутствует срок.');}
      if(start&&finish&&finish<start)errors.push('Строка '+sourceRow+': окончание раньше начала.');
      const ctx=taskContext(row);if(!ctx.building)ctx.building=section;
      if(!start&&!finish&&!isMilestone){warnings.push('Строка '+sourceRow+': нет дат, строка пропущена.');return;}
      let progress=0;const raw=value(row,'progress');
      if(text(raw)) {progress=num(text(raw).replace('%',''));if(!text(raw).includes('%')&&progress>0&&progress<1)progress*=100;
        const column=state.mapping.progress,sheet=state.workbook?.Sheets?.[state.sheetName];
        if(typeof raw==='number'&&sheet&&window.XLSX&&column!=null){const cell=sheet[XLSX.utils.encode_cell({r:sourceRow-1,c:column})];if(/%/.test(cell?.z||'')&&raw>=0&&raw<=1)progress=raw*100;}}
      const durationRaw=text(value(row,'duration')).replace(/\s*(дней|дня|день|дн\.?|days?|д)\s*$/i,'');
      const duration=durationRaw?num(durationRaw):null;
      rows.push({sourceRow,name,...ctx,isMilestone,start,finish,progress:Math.max(0,Math.min(100,progress||0)),duration:isMilestone?0:duration,
        sourceTaskId:text(value(row,'sourceTaskId')),organizationName:text(value(row,'organization')),
        status:detectStatus(progress,value(row,'status')),outlineNumber:text(value(row,'outlineNumber')),
        unit:text(value(row,'unit')),quantity:text(value(row,'quantity'))?num(value(row,'quantity')):null,
        predecessorsRaw:text(value(row,'predecessors')),successorsRaw:text(value(row,'successors')),comment:text(value(row,'comment')),raw:row});
    });
    const compact=v=>text(v).toLowerCase().replace(/[^а-яёa-z0-9]/g,'');
    for(const r of rows.filter(r=>r.isMilestone&&!text(value(r.raw,'building')))){
      const matches=[...new Set(sections)].filter(b=>compact(r.name).includes(compact(b)));
      r.building=matches.length===1?matches[0]:'';
      if(matches.length!==1)warnings.push('Строка '+r.sourceRow+': КД относится к нескольким зданиям или здание не определено. Привязка к последнему разделу не выполняется.');
    }
    const seen=new Set();for(const r of rows){const id=scheduleTaskIdentity(r);if(seen.has(id))errors.push('Строка '+r.sourceRow+': неоднозначный повтор работы. Уточните элемент, захватку или зону.');seen.add(id);}
    return {rows,errors,warnings};
  }

  async function importSchedule() {
    if(window.LIV_ACCESS?.canEdit===false){alert('Нет права изменять график.');return;}
    if(!ensureCollections())return;
    if(state.mapping.name==null){alert('Выберите колонку «Задача».');return;}
    const group=text(document.getElementById('scheduleGroup')?.value),role=document.getElementById('scheduleRole')?.value||'working';
    const effectiveDate=isoDate(document.getElementById('scheduleEffective')?.value),calendar=document.getElementById('scheduleCalendar')?.value||'7x0';
    if(!group||!effectiveDate){alert('Укажите группу графика и дату версии.');return;}
    const registerMilestones=Boolean(document.getElementById('scheduleRegisterKD')?.checked),organizationId=document.getElementById('scheduleOrganization')?.value||'',contractNo=text(document.getElementById('scheduleContractNo')?.value);
    if(registerMilestones&&(role==='working'||!organizationId||!contractNo)){alert('Для регистрации договорных КД выберите договорный график, организацию и номер договора.');return;}
    const prepared=prepareRows({milestoneFallback:document.getElementById('scheduleMilestoneFallback')?.checked});
    if(prepared.errors.length){alert(prepared.errors.join('\n'));return;}
    if(!prepared.rows.length){alert('Нет строк с работами и датами.');return;}
    if(prepared.warnings.length&&!confirm(prepared.warnings.join('\n')+'\nПродолжить тестовую загрузку?'))return;
    const importId=uid('SIMP'),createdAt=new Date().toISOString(),scheduleKey=[role,key(group),organizationId,key(contractNo)].join('|');
    const staged=prepared.rows.map(r=>{
      const taskId=uid('TASK');
      const task={...r,id:taskId,raw:undefined,versionId:importId,sourceImportId:importId,sourceFile:state.fileName,sourceSheet:state.sheetName,
        scheduleKey,role,effectiveDate,calendar,organizationId,active:true,testOnly:true,createdAt,updatedAt:createdAt,progressPercent:r.progress,durationAccepted:r.duration,
        sourceTaskId:r.sourceTaskId||String(r.sourceRow),logicalId:scheduleTaskIdentity(r),isMilestone:r.isMilestone};
      const dates=[makeDate(taskId,'working',r.start,r.finish,'test-import'),
        makeDate(taskId,'baseline',value(r.raw,'baselineStart'),value(r.raw,'baselineFinish'),'test-import'),
        makeDate(taskId,'contract',role==='working'?value(r.raw,'contractStart'):r.start,role==='working'?value(r.raw,'contractFinish'):r.finish,'test-import'),
        makeDate(taskId,'actual',value(r.raw,'factStart'),value(r.raw,'factFinish'),'test-import')].filter(Boolean);
      const quantities=r.quantity===null?[]:[{id:uid('TQTY'),taskId,name:'Основной объём',quantityType:'primary',quantity:r.quantity,unit:r.unit}];
      return {task,dates,quantities};
    });
    const dependencies=buildStagedDependencies(staged,importId);
    const parents=new Set(staged.map(x=>x.task.parentTaskId).filter(Boolean));for(const x of staged)x.task.isSummary=parents.has(x.task.id);
    const sourceIds=new Set(staged.map(x=>x.task.sourceTaskId));
    const relationErrors=[];
    for(const {task} of staged)for(const field of ['predecessorsRaw','successorsRaw'])for(const token of text(task[field]).split(/[;,]+/).filter(Boolean)){
      const parsed=parseDependencyToken(token);
      if(!parsed||!sourceIds.has(parsed.sourceTaskId)||parsed.sourceTaskId===task.sourceTaskId)relationErrors.push('Строка '+task.sourceRow+': некорректная или не найденная связь '+token);
    }
    if(relationErrors.length){alert(relationErrors.join('\n'));return;}
    const declared=staged.reduce((n,x)=>n+parseDependencyList(x.task.predecessorsRaw).length+parseDependencyList(x.task.successorsRaw).length,0);
    if(declared&&!dependencies.length){alert('Связи указаны, но не найдены задачи по ID. Проверьте сопоставление.');return;}
    // Duplicate source IDs are common inside building sections; links are ambiguous in that case.
    if(declared&&new Set(staged.map(x=>x.task.sourceTaskId)).size!==staged.length){alert('Номера задач повторяются между разделами. Для связей нужны уникальные ID.');return;}
    const sourceCounts=new Map();for(const {task} of staged)sourceCounts.set(task.sourceTaskId,(sourceCounts.get(task.sourceTaskId)||0)+1);
    for(const {task} of staged)if(sourceCounts.get(task.sourceTaskId)>1){task.originalSourceTaskId=task.sourceTaskId;task.sourceTaskId='row:'+task.sourceRow+':'+task.sourceTaskId;}
    for(const item of staged)item.dependencies=dependencies.filter(d=>d.predecessorTaskId===item.task.id||d.successorTaskId===item.task.id);
    if(project.scheduleStaging.length&&!confirm('Заменить предыдущую тестовую загрузку? Рабочие версии сохраняются.'))return;
    project.scheduleVersions.filter(v=>v.status==='Тест').forEach(v=>{v.status='Удален';});
    project.scheduleStaging=staged;
    project.scheduleVersions.unshift({id:importId,name:group,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).map(v=>Number(v.versionNo)||0),project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).length)+1,fileName:state.fileName,sheetName:state.sheetName,sourceType:state.sourceType,
      scheduleKey,role,effectiveDate,calendar,organizationId,contractNo,registerMilestones,createdAt,status:'Тест',rowsCreated:staged.length,dependencyCount:dependencies.length});
    if(typeof saveProject==='function')await saveProject();
    renderSchedule();alert('В тестовом контуре: '+staged.length+' задач, '+staged.filter(x=>x.task.isMilestone).length+' КД. Проверьте таблицу перед принятием.');
  }

  async function promoteTestImport() {
    if(window.LIV_ACCESS?.canEdit===false){alert('Нет права изменять график.');return;}
    if(!ensureCollections()||!project.scheduleStaging.length){alert('Сначала загрузите график в тестовый контур.');return;}
    const id=project.scheduleStaging[0].task.sourceImportId;
    const version=project.scheduleVersions.find(v=>v.id===id);
    if(!confirm('Принять версию? Предыдущая версия этой группы останется в истории. Другие графики не изменятся.'+(version?.registerMilestones?'\nКД этого договора будут созданы или обновлены в журнале. Изменённые договорные сроки сохранятся в истории.':'\nКД останутся вехами графика; договорный журнал не изменяется.')))return;
    try {
      await window.LIV_PLANNING.persist(project,()=>{
        window.LIV_PLANNING.accept(project,id);
        const v=project.scheduleVersions.find(x=>x.id===id);
        project.importHistory=project.importHistory||[];
        project.importHistory.unshift({id,type:'schedule',fileName:v.fileName,sheetName:v.sheetName,createdAt:v.acceptedAt,rowsCreated:v.rowsCreated});
      },()=>saveProject());
    }catch(error){alert('Версия не сохранена: '+error.message);return;}
    renderSchedule();alert('Версия принята. Предыдущие версии доступны для сравнения.');
  }

  async function clearTestImport() {
    if(window.LIV_ACCESS?.canEdit===false){alert('Нет права изменять график.');return;}
    if (!ensureCollections()) return;
    const staged = Array.isArray(project.scheduleStaging) ? project.scheduleStaging : [];
    if (!staged.length) {
      alert('Тестовых загрузок графика нет.');
      return;
    }
    if (!confirm('Удалить текущую тестовую загрузку графика?\n\nРабочие задачи не будут затронуты.')) return;

    project.scheduleStaging = [];
    const current = (project.scheduleVersions || []).find(v => v.status === 'Тест');
    if (current) {
      current.status = 'Удален';
      current.deletedAt = new Date().toISOString();
    }

    if (typeof window.saveProject === 'function') await saveProject();
    renderSchedule();
  }

  function stagedDateFor(taskId, type) {
    const staged = Array.isArray(project.scheduleStaging) ? project.scheduleStaging : [];
    for (const item of staged) {
      if (String(item.task?.id) !== String(taskId)) continue;
      const row = (item.dates || []).find(d => d.type === type);
      if (row) return row;
    }
    return null;
  }

  function dateFor(taskId, type) {
    const rows = (project.taskDates || []).filter(d => String(d.taskId) === String(taskId) && d.type === type);
    return rows.length ? rows[rows.length-1] : null;
  }

  function contextText(task) {
    const parts = [];
    if (task.building) parts.push(task.building);
    if (task.block) parts.push('Блок '+task.block);
    if (task.floor) parts.push('Этаж '+task.floor);
    if (task.axis) parts.push('Оси '+task.axis);
    if (task.network) parts.push(task.network);
    if (task.segment) parts.push(task.segment);
    if (task.capture) parts.push(task.capture);
    if (task.zone) parts.push(task.zone);
    if (task.element) parts.push(task.element);
    return parts.join(' · ');
  }

  function renderSchedule() {
    if (typeof project === 'undefined' || !project) return;
    ensureCollections();
    if(window.LIV_PLANNING_UI)window.LIV_PLANNING_UI.render();

    const search = key(document.getElementById('scheduleSearch')?.value || '');
    const stagedTasks = (project.scheduleStaging || [])
      .map(item => ({ ...item.task, testOnly: true }))
      .filter(t => t.active !== false);

    let tasks = [
      ...window.LIV_PLANNING.currentTasks(project),
      ...stagedTasks
    ];

    if (search) {
      tasks = tasks.filter(t => key([
        t.name,t.building,t.block,t.floor,t.axis,t.network,t.segment,
        t.capture,t.zone,t.organizationName,t.status
      ].join(' ')).includes(search));
    }

    const tbody = document.getElementById('scheduleRows');
    const table = document.getElementById('scheduleTable');
    const empty = document.getElementById('scheduleEmpty');
    if (!tbody || !table || !empty) return;

    const official = window.LIV_PLANNING.currentTasks(project);
    const all = [...official, ...stagedTasks];
    const imported = official.filter(t => t.sourceImportId);
    const stagedCount = stagedTasks.length;

    document.getElementById('scheduleTotal').textContent = all.length;
    document.getElementById('scheduleInWork').textContent = all.filter(t => t.status === 'В работе').length;
    document.getElementById('scheduleDone').textContent = all.filter(t => t.status === 'Завершено' || t.progressPercent >= 100).length;
    document.getElementById('scheduleWithDates').textContent = all.filter(t => !!dateFor(t.id,'working')).length;
    document.getElementById('scheduleImported').textContent = stagedCount ? stagedCount+' тест' : imported.length;

    if (!tasks.length) {
      table.classList.add('hidden');
      empty.classList.remove('hidden');
      empty.querySelector('b').textContent = all.length ? 'По фильтру задач нет.' : 'График пока не загружен.';
      empty.querySelector('span').textContent = all.length ? 'Измените строку поиска.' : 'Для теста загрузите Excel/CSV. Перед записью LIV покажет найденные поля и первые строки.';
      return;
    }

    empty.classList.add('hidden');
    table.classList.remove('hidden');

    tbody.innerHTML = tasks.map((task,index) => {
      const working = (task.testOnly ? stagedDateFor(task.id,'working') : dateFor(task.id,'working')) || {};
      const baseline = (task.testOnly ? stagedDateFor(task.id,'baseline') : dateFor(task.id,'baseline')) || {};
      return `
        <tr>
          <td>${index+1}</td>
          <td><b>${esc(task.name)}</b>${task.testOnly ? '<div class="schedule-test-badge">ТЕСТ</div>' : ''}${task.sourceSheet ? '<div class="muted schedule-source">'+esc(task.sourceSheet)+'</div>' : ''}</td>
          <td>${esc(contextText(task) || '—')}</td>
          <td>${esc(task.organizationName || '—')}</td>
          <td><span class="schedule-status">${esc(task.status || 'Не начато')}</span></td>
          <td>${esc(working.start || '—')}</td>
          <td>${esc(working.finish || '—')}</td>
          <td>${esc(baseline.start || '—')}</td>
          <td>${esc(baseline.finish || '—')}</td>
          <td>${Math.round(Number(task.progressPercent)||0)}%</td>
        </tr>
      `;
    }).join('');

    const viewMode=document.getElementById('scheduleViewMode')?.value||'classic';
    table.classList.toggle('hidden',viewMode==='matrix');
    const matrix=document.querySelector('#planningTools .planning-matrix');
    if(matrix)matrix.classList.toggle('hidden',viewMode==='classic');
    if (window.LIV_VIEW_BUILDER && typeof window.livApplyViewConstructor === 'function') {
      window.livApplyViewConstructor();
    }
  }

  window.renderSchedule = renderSchedule;
  window.LIV_SCHEDULE = {
    render: renderSchedule,
    ensureCollections
  };

  ensureTabAndPanel();
  document.addEventListener('DOMContentLoaded', () => {
    ensureTabAndPanel();
    renderSchedule();
  }, { once: true });
})();
