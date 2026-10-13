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
    sourceType: 'auto'
  };

  const FIELD_DEFS = {
    name: {
      label: 'Задача',
      aliases: ['задача','наименование задачи','название задачи','наименование работ','вид работ','работа','название']
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
    progress: {
      label: '% выполнения',
      aliases: ['% завершен','% завершено','% выполнения','процент выполнения','готовность']
    },
    duration: {
      label: 'Длительность',
      aliases: ['длительность','продолжительность','длительность дни','длительность дн']
    },
    workingStart: {
      label: 'Рабочее начало',
      aliases: ['начало','дата начала','начало план','план начало','текущее начало','рабочее начало']
    },
    workingFinish: {
      label: 'Рабочее окончание',
      aliases: ['окончание','дата окончания','окончание план','план окончание','текущее окончание','рабочее окончание']
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
      aliases: ['объем','объём','общий объем','общий объём','количество']
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

  function isoDate(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.toISOString().slice(0,10);
    }
    if (typeof v === 'number' && window.XLSX && v > 20000 && v < 80000) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return String(d.y).padStart(4,'0')+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
    }
    const s = text(v);
    let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (m) {
      let y = m[3];
      if (y.length === 2) y = '20'+y;
      return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    }
    m = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
    if (m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    return '';
  }

  function uid(prefix) {
    if (typeof window.uid === 'function') return window.uid(prefix);
    return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  }

  function ensureCollections() {
    if (!window.project) return false;
    const names = [
      'tasks','taskDates','taskQuantities','dependencies',
      'dailyReports','factHistory','quantityHistory','forecastSnapshots'
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
      const score = matches.size * 10 + Math.min(nonEmpty,10);
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
          <div id="scheduleMapping" class="schedule-mapping"></div>
          <div id="schedulePreview" class="table-wrap schedule-preview"></div>
          <div class="editor-actions">
            <button id="scheduleImportBtn" class="btn primary" type="button">Импортировать в LIV</button>
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
                <option value="linear">Линейный</option>
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
    const input = document.getElementById('scheduleFileInput');
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('change', handleFile);
    }

    const sheet = document.getElementById('scheduleSheetSelect');
    if (sheet && !sheet.dataset.bound) {
      sheet.dataset.bound = '1';
      sheet.addEventListener('change', () => {
        state.sheetName = sheet.value;
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
    state.workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    state.fileName = file.name;
    state.sheetName = state.workbook.SheetNames[0] || '';

    const select = document.getElementById('scheduleSheetSelect');
    select.innerHTML = state.workbook.SheetNames
      .map(name => '<option value="'+esc(name)+'">'+esc(name)+'</option>')
      .join('');
    select.value = state.sheetName;

    document.getElementById('scheduleImportCard').classList.remove('hidden');
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
    state.dataRows = rows.slice(state.headerRow + 1).filter(row => (row || []).some(cell => text(cell)));
    state.mapping = autoMap(state.headers);

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

    const preview = state.dataRows.slice(0,12);
    const fields = ['name','building','block','floor','network','segment','organization','workingStart','workingFinish','baselineFinish','progress'];
    const visible = fields.filter(f => state.mapping[f] != null);

    host.innerHTML = `
      <table>
        <thead><tr>${visible.map(f => '<th>'+esc(FIELD_DEFS[f].label)+'</th>').join('')}</tr></thead>
        <tbody>
          ${preview.map(row => '<tr>'+visible.map(f => {
            let v = value(row,f);
            if (/Start|Finish/.test(f)) v = isoDate(v) || text(v);
            return '<td>'+esc(v)+'</td>';
          }).join('')+'</tr>').join('')}
        </tbody>
      </table>
    `;

    if (hint) {
      hint.textContent = state.mapping.name == null
        ? 'Нужно выбрать колонку «Задача».'
        : 'Будет добавлено до '+state.dataRows.length+' строк. Пустые строки и строки без задачи пропускаются.';
    }
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
      segment: text(value(row,'segment'))
    };
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

  async function importSchedule() {
    if (!ensureCollections()) return;
    if (state.mapping.name == null) {
      alert('Выберите колонку «Задача».');
      return;
    }

    const importId = uid('SIMP');
    const createdAt = new Date().toISOString();
    let created = 0;

    state.dataRows.forEach((row, index) => {
      const name = text(value(row,'name'));
      if (!name) return;

      const progressRaw = num(value(row,'progress'));
      const progress = progressRaw == null ? 0 : Math.max(0, Math.min(100, progressRaw <= 1 ? progressRaw * 100 : progressRaw));
      const taskId = uid('TASK');
      const ctx = taskContext(row);

      const task = {
        id: taskId,
        projectId: 'local-main',
        parentTaskId: '',
        sourceRow: state.headerRow + 2 + index,
        sourceImportId: importId,
        sourceFile: state.fileName,
        sourceSheet: state.sheetName,
        sourceType: state.sourceType,
        name,
        ...ctx,
        organizationName: text(value(row,'organization')),
        status: detectStatus(progress, value(row,'status')),
        progressPercent: progress,
        durationAccepted: num(value(row,'duration')),
        unit: text(value(row,'unit')),
        predecessorsRaw: text(value(row,'predecessors')),
        successorsRaw: text(value(row,'successors')),
        comment: text(value(row,'comment')),
        active: true,
        createdAt,
        updatedAt: createdAt
      };

      project.tasks.push(task);

      [
        makeDate(taskId,'working',value(row,'workingStart'),value(row,'workingFinish'),'import'),
        makeDate(taskId,'baseline',value(row,'baselineStart'),value(row,'baselineFinish'),'import'),
        makeDate(taskId,'contract',value(row,'contractStart'),value(row,'contractFinish'),'import'),
        makeDate(taskId,'actual',value(row,'factStart'),value(row,'factFinish'),'import')
      ].filter(Boolean).forEach(d => project.taskDates.push(d));

      const q = num(value(row,'quantity'));
      if (q != null) {
        project.taskQuantities.push({
          id: uid('TQTY'),
          taskId,
          name: 'Основной объем',
          quantityType: 'primary',
          unit: text(value(row,'unit')),
          plannedQty: q,
          isPrimary: true,
          createdAt
        });
      }

      created += 1;
    });

    if (!Array.isArray(project.importHistory)) project.importHistory = [];
    project.importHistory.unshift({
      id: importId,
      type: 'schedule',
      fileName: state.fileName,
      sheetName: state.sheetName,
      sourceType: state.sourceType,
      rowsTotal: state.dataRows.length,
      rowsCreated: created,
      createdAt
    });

    if (typeof window.log === 'function') {
      log('Импорт графика', state.fileName+' · '+state.sheetName+' · '+created+' задач');
    }
    if (typeof window.saveProject === 'function') await saveProject();

    renderSchedule();
    alert('Импорт завершен. Добавлено задач: '+created);
  }

  async function clearTestImport() {
    if (!ensureCollections()) return;
    const imported = project.tasks.filter(t => t.sourceImportId);
    if (!imported.length) {
      alert('Тестовых импортов графика нет.');
      return;
    }
    if (!confirm('Удалить все задачи, загруженные через тестовый импорт графиков?\n\nРучные задачи и старые фронты не будут затронуты.')) return;

    const ids = new Set(imported.map(t => String(t.id)));
    project.tasks = project.tasks.filter(t => !ids.has(String(t.id)));
    project.taskDates = project.taskDates.filter(d => !ids.has(String(d.taskId)));
    project.taskQuantities = project.taskQuantities.filter(q => !ids.has(String(q.taskId)));
    project.dependencies = project.dependencies.filter(d => !ids.has(String(d.taskId)) && !ids.has(String(d.predecessorTaskId)));
    project.importHistory = (project.importHistory || []).filter(x => x.type !== 'schedule');

    if (typeof window.saveProject === 'function') await saveProject();
    renderSchedule();
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
    return parts.join(' · ');
  }

  function renderSchedule() {
    if (!window.project) return;
    ensureCollections();

    const search = key(document.getElementById('scheduleSearch')?.value || '');
    let tasks = project.tasks.filter(t => t.active !== false);

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

    const all = project.tasks.filter(t => t.active !== false);
    const imported = all.filter(t => t.sourceImportId);

    document.getElementById('scheduleTotal').textContent = all.length;
    document.getElementById('scheduleInWork').textContent = all.filter(t => t.status === 'В работе').length;
    document.getElementById('scheduleDone').textContent = all.filter(t => t.status === 'Завершено' || t.progressPercent >= 100).length;
    document.getElementById('scheduleWithDates').textContent = all.filter(t => !!dateFor(t.id,'working')).length;
    document.getElementById('scheduleImported').textContent = imported.length;

    if (!tasks.length) {
      table.classList.add('hidden');
      empty.classList.remove('hidden');
      empty.querySelector('b').textContent = all.length ? 'По фильтру задач нет.' : 'График пока не загружен.';
      empty.querySelector('span').textContent = all.length ? 'Измените строку поиска.' : 'Для теста загрузите Excel/CSV. Перед записью LIV покажет найденные поля и первые строки.';
      return;
    }

    empty.classList.add('hidden');
    table.classList.remove('hidden');

    tbody.innerHTML = tasks.slice(0,1000).map((task,index) => {
      const working = dateFor(task.id,'working') || {};
      const baseline = dateFor(task.id,'baseline') || {};
      return `
        <tr>
          <td>${index+1}</td>
          <td><b>${esc(task.name)}</b>${task.sourceSheet ? '<div class="muted schedule-source">'+esc(task.sourceSheet)+'</div>' : ''}</td>
          <td>${esc(contextText(task) || '—')}</td>
          <td>${esc(task.organizationName || '—')}</td>
          <td><span class="schedule-status">${esc(task.status || 'Не начато')}</span></td>
          <td>${esc(working.start || '—')}</td>
          <td>${esc(working.finish || '—')}</td>
          <td>${esc(baseline.finish || '—')}</td>
          <td>${Math.round(Number(task.progressPercent)||0)}%</td>
        </tr>
      `;
    }).join('');

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
