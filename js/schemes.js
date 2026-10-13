'use strict';

(function () {
  const STORAGE_BUCKET = 'liv-schemes';
  const PDFJS_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  const MARK_STATUSES = [
    'Не начато',
    'В работе',
    'Выполнено',
    'Освидетельствовано',
    'Принято',
    'Ограничение'
  ];

  const COMPLETED_STATUSES = new Set([
    'Выполнено',
    'Освидетельствовано',
    'Принято'
  ]);

  const state = {
    currentSchemeId: '',
    currentPdf: null,
    currentPdfSchemeId: '',
    page: 1,
    zoom: 1,
    drawMode: false,
    drawStart: null,
    draftElement: null,
    pendingFile: null,
    loading: false,
    statusFilter: 'all',
    pdfCache: new Map()
  };

  function el(id) {
    return document.getElementById(id);
  }

  function getProject() {
    try {
      return project || null;
    } catch (error) {
      return null;
    }
  }

  function canWrite() {
    if (window.LIV_ACCESS) {
      return window.LIV_ACCESS.readOnly !== true;
    }

    return Boolean(
      window.LIV_REMOTE_SYNC?.canWrite?.()
    );
  }

  function ensureState() {
    const current = getProject();

    if (!current) {
      return false;
    }

    if (!Array.isArray(current.schemes)) {
      current.schemes = [];
    }

    if (!Array.isArray(current.schemeMarks)) {
      current.schemeMarks = [];
    }

    return true;
  }

  function activeSchemes() {
    const current = getProject();

    return (
      current?.schemes || []
    )
      .filter(item => item.active !== false)
      .sort((a, b) =>
        String(b.updatedAt || b.createdAt || '')
          .localeCompare(String(a.updatedAt || a.createdAt || ''))
      );
  }

  function schemeById(id) {
    return (
      getProject()?.schemes || []
    ).find(item => String(item.id) === String(id)) || null;
  }

  function marksForScheme(schemeId, pageNo = null) {
    return (
      getProject()?.schemeMarks || []
    ).filter(mark =>
      mark.active !== false &&
      String(mark.schemeId) === String(schemeId) &&
      (
        pageNo === null ||
        Number(mark.pageNo || 1) === Number(pageNo)
      )
    );
  }

  function markById(id) {
    return (
      getProject()?.schemeMarks || []
    ).find(item => String(item.id) === String(id)) || null;
  }

  function escapeHtml(value) {
    if (typeof esc === 'function') {
      return esc(value);
    }

    return String(value ?? '')
      .replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[char]);
  }

  function safeFileName(value) {
    return String(value || 'scheme.pdf')
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_')
      .slice(-140);
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function statusClass(status) {
    const key = String(status || '');

    if (COMPLETED_STATUSES.has(key)) return 'scheme-mark-complete';
    if (key === 'В работе') return 'scheme-mark-work';
    if (key === 'Ограничение') return 'scheme-mark-risk';
    return 'scheme-mark-idle';
  }

  function statusSuggestedProgress(status) {
    if (COMPLETED_STATUSES.has(status)) return 100;
    if (status === 'В работе') return 50;
    return 0;
  }

  function listOptions(list, selectedId, emptyLabel = '—') {
    return `
      <option value="">${escapeHtml(emptyLabel)}</option>
      ${(
        list || []
      )
        .filter(item => item.active !== false)
        .map(item => `
          <option
            value="${escapeHtml(item.id)}"
            ${String(item.id) === String(selectedId || '') ? 'selected' : ''}>
            ${escapeHtml(item.name || item.id)}
          </option>
        `)
        .join('')}
    `;
  }

  function frontOptions(selectedId) {
    let fronts = [];

    try {
      fronts = typeof activeFronts === 'function'
        ? activeFronts()
        : (getProject()?.fronts || []).filter(item => item.active !== false);
    } catch (error) {
      fronts = [];
    }

    return `
      <option value="">—</option>
      ${fronts
        .map(front => {
          let label = front.id;

          try {
            label = typeof frontLabel === 'function'
              ? frontLabel(front)
              : front.id;
          } catch (error) {
            label = front.id;
          }

          return `
            <option
              value="${escapeHtml(front.id)}"
              ${String(front.id) === String(selectedId || '') ? 'selected' : ''}>
              ${escapeHtml(label)}
            </option>
          `;
        })
        .join('')}
    `;
  }

  function injectStyles() {
    if (document.getElementById('liv-schemes-style')) return;

    const style = document.createElement('style');
    style.id = 'liv-schemes-style';
    style.textContent = `
      .scheme-page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 14px}
      .scheme-page-head h1{margin:0;font-size:26px;line-height:1.1}
      .scheme-page-head p{margin:6px 0 0;color:var(--muted);font-size:13px}
      .scheme-stats{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:9px;margin-bottom:14px}
      .scheme-stat{min-height:74px;padding:13px 14px;border:1px solid #dfe4eb;border-radius:10px;background:#fff}
      .scheme-stat span{display:block;margin-bottom:7px;color:#667085;font-size:11px}
      .scheme-stat strong{font-size:20px;color:#172033}
      .scheme-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}
      .scheme-sidebar{padding:14px;position:sticky;top:78px}
      .scheme-sidebar-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .scheme-sidebar-head h2{margin:0;font-size:16px}
      .scheme-search{width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:9px;background:#fff}
      .scheme-list{display:grid;gap:6px;max-height:650px;overflow:auto}
      .scheme-list-item{width:100%;padding:10px;border:1px solid #e3e7ed;border-radius:9px;background:#fff;text-align:left;cursor:pointer}
      .scheme-list-item:hover{background:#f8fafc}
      .scheme-list-item.active{border-color:#829ac0;background:#eef4ff}
      .scheme-list-item strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
      .scheme-list-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:5px;color:#667085;font-size:10px}
      .scheme-view-card{padding:0;overflow:hidden}
      .scheme-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-bottom:1px solid #e6eaf0;background:#fff;flex-wrap:wrap}
      .scheme-toolbar-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .scheme-toolbar .btn{min-height:34px;padding:6px 9px;font-size:12px}
      .scheme-page-label{min-width:84px;text-align:center;color:#475467;font-size:12px}
      .scheme-filter-select{height:34px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;background:#fff;font-size:12px}
      .scheme-canvas-scroll{position:relative;min-height:620px;max-height:calc(100vh - 235px);overflow:auto;background:#e8edf3;padding:20px}
      .scheme-empty{min-height:570px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#667085;text-align:center}
      .scheme-empty strong{font-size:17px;color:#344054}
      .scheme-stage{position:relative;width:max-content;margin:0 auto;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.15);user-select:none}
      .scheme-stage canvas{display:block}
      .scheme-overlay{position:absolute;inset:0;cursor:default;touch-action:none}
      .scheme-overlay.draw-mode{cursor:crosshair}
      .scheme-mark{position:absolute;display:flex;align-items:center;justify-content:center;min-width:12px;min-height:12px;border:2px solid currentColor;border-radius:4px;background:color-mix(in srgb,currentColor 19%,transparent);cursor:pointer;overflow:hidden}
      .scheme-mark span{max-width:100%;padding:2px 4px;border-radius:4px;background:rgba(255,255,255,.84);color:#182230;font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
      .scheme-mark-complete{color:#16825d}
      .scheme-mark-work{color:#d2860b}
      .scheme-mark-risk{color:#c23a3a}
      .scheme-mark-idle{color:#667085}
      .scheme-mark-draft{position:absolute;border:2px dashed #2563eb;background:rgba(37,99,235,.12);pointer-events:none}
      .scheme-legend{display:flex;gap:12px;flex-wrap:wrap;padding:9px 13px;border-top:1px solid #e6eaf0;background:#fff;color:#667085;font-size:10px}
      .scheme-legend-item{display:inline-flex;align-items:center;gap:5px}
      .scheme-legend-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
      .scheme-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(232,237,243,.78);z-index:8;color:#344054;font-weight:700}
      .scheme-upload-note{padding:10px 12px;border:1px solid #dbe7ff;border-radius:8px;background:#f4f8ff;color:#475467;font-size:12px;line-height:1.45}
      .scheme-editor-progress{display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:8px;align-items:end}
      .scheme-delete-note{padding:11px 12px;border:1px solid #efc1c1;border-radius:9px;background:#fff6f6;color:#8f2424;line-height:1.45}
      body.liv-readonly .scheme-write-action{display:none!important}
      @media(max-width:980px){.scheme-layout{grid-template-columns:1fr}.scheme-sidebar{position:static}.scheme-list{max-height:220px}.scheme-canvas-scroll{min-height:500px}.scheme-stats{grid-template-columns:repeat(2,minmax(120px,1fr))}}
      @media(max-width:640px){.scheme-stats{grid-template-columns:1fr 1fr}.scheme-canvas-scroll{padding:8px}.scheme-page-head h1{font-size:22px}}
    `;

    document.head.appendChild(style);
  }

  function injectUi() {
    if (document.getElementById('tab-schemes')) return;

    const nav = document.querySelector('.tabs');
    const main = document.querySelector('main.container');

    if (!nav || !main) return;

    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.tab = 'schemes';
    tab.textContent = 'Схемы';

    const importTab = nav.querySelector('[data-tab="import"]');
    nav.insertBefore(tab, importTab || null);

    const panel = document.createElement('section');
    panel.id = 'tab-schemes';
    panel.className = 'panel hidden';
    panel.innerHTML = `
      <section class="scheme-page-head">
        <div>
          <h1>Схемы</h1>
          <p>PDF-схемы, участки работ и визуальная фиксация выполнения</p>
        </div>

        <div class="scheme-toolbar-group no-print">
          <button id="schemeUploadBtn" class="btn primary scheme-write-action">+ Загрузить PDF</button>
          <input id="schemeFileInput" type="file" accept="application/pdf,.pdf" hidden>
          <button id="schemeDownloadBtn" class="btn" disabled>Скачать PDF</button>
          <button id="schemeDeleteBtn" class="btn danger-lite scheme-write-action" disabled>Удалить схему</button>
        </div>
      </section>

      <section class="scheme-stats">
        <div class="scheme-stat"><span>Отметок</span><strong id="schemeStatTotal">0</strong></div>
        <div class="scheme-stat"><span>В работе</span><strong id="schemeStatWork">0</strong></div>
        <div class="scheme-stat"><span>Выполнено</span><strong id="schemeStatDone">0</strong></div>
        <div class="scheme-stat"><span>Средняя готовность</span><strong id="schemeStatProgress">0%</strong></div>
      </section>

      <section class="scheme-layout">
        <aside class="card scheme-sidebar no-print">
          <div class="scheme-sidebar-head">
            <h2>Загруженные схемы</h2>
            <span id="schemeListCount" class="badge">0</span>
          </div>

          <input id="schemeSearch" class="scheme-search" type="search" placeholder="Поиск по схемам...">
          <div id="schemeList" class="scheme-list"></div>
        </aside>

        <section class="card scheme-view-card">
          <div class="scheme-toolbar no-print">
            <div class="scheme-toolbar-group">
              <button id="schemePrevPage" class="btn" disabled>‹</button>
              <span id="schemePageLabel" class="scheme-page-label">Страница —</span>
              <button id="schemeNextPage" class="btn" disabled>›</button>
              <button id="schemeZoomOut" class="btn" disabled>−</button>
              <button id="schemeZoomFit" class="btn" disabled>По ширине</button>
              <button id="schemeZoomIn" class="btn" disabled>+</button>
            </div>

            <div class="scheme-toolbar-group">
              <select id="schemeStatusFilter" class="scheme-filter-select">
                <option value="all">Все статусы</option>
                ${MARK_STATUSES.map(status => `<option>${status}</option>`).join('')}
              </select>
              <button id="schemeMarkMode" class="btn primary scheme-write-action" disabled>Отметить участок</button>
            </div>
          </div>

          <div id="schemeCanvasScroll" class="scheme-canvas-scroll">
            <div id="schemeEmpty" class="scheme-empty">
              <strong>Выбери или загрузи PDF-схему</strong>
              <span>После загрузки можно выделять участки и отмечать выполнение.</span>
            </div>

            <div id="schemeStage" class="scheme-stage hidden">
              <canvas id="schemeCanvas"></canvas>
              <div id="schemeOverlay" class="scheme-overlay"></div>
            </div>

            <div id="schemeLoading" class="scheme-loading hidden">Загрузка схемы...</div>
          </div>

          <div class="scheme-legend">
            <span class="scheme-legend-item scheme-mark-idle"><i class="scheme-legend-dot"></i>Не начато</span>
            <span class="scheme-legend-item scheme-mark-work"><i class="scheme-legend-dot"></i>В работе</span>
            <span class="scheme-legend-item scheme-mark-complete"><i class="scheme-legend-dot"></i>Выполнено / принято</span>
            <span class="scheme-legend-item scheme-mark-risk"><i class="scheme-legend-dot"></i>Ограничение</span>
          </div>
        </section>
      </section>
    `;

    const importPanel = document.getElementById('tab-import');
    main.insertBefore(panel, importPanel || null);

    tab.addEventListener('click', () => {
      if (typeof switchTab === 'function') {
        switchTab('schemes');
      } else {
        document.querySelectorAll('main > .panel').forEach(item => item.classList.add('hidden'));
        panel.classList.remove('hidden');
      }

      renderSchemes();
    });
  }

  function bindUi() {
    el('schemeUploadBtn')?.addEventListener('click', () => {
      if (!canWrite()) return;
      el('schemeFileInput')?.click();
    });

    el('schemeFileInput')?.addEventListener('change', event => {
      const file = event.target.files?.[0] || null;
      event.target.value = '';

      if (file) {
        beginSchemeUpload(file);
      }
    });

    el('schemeSearch')?.addEventListener('input', renderSchemeList);
    el('schemePrevPage')?.addEventListener('click', () => changePage(-1));
    el('schemeNextPage')?.addEventListener('click', () => changePage(1));
    el('schemeZoomOut')?.addEventListener('click', () => changeZoom(-0.15));
    el('schemeZoomIn')?.addEventListener('click', () => changeZoom(0.15));
    el('schemeZoomFit')?.addEventListener('click', () => {
      state.zoom = 1;
      renderCurrentPage();
    });

    el('schemeMarkMode')?.addEventListener('click', () => {
      if (!canWrite() || !state.currentPdf) return;
      state.drawMode = !state.drawMode;
      updateToolbarState();
    });

    el('schemeStatusFilter')?.addEventListener('change', event => {
      state.statusFilter = event.target.value || 'all';
      renderMarks();
    });

    el('schemeDownloadBtn')?.addEventListener('click', downloadCurrentScheme);
    el('schemeDeleteBtn')?.addEventListener('click', openDeleteSchemeDialog);

    const overlay = el('schemeOverlay');
    overlay?.addEventListener('pointerdown', beginMarkDraw);
    overlay?.addEventListener('pointermove', moveMarkDraw);
    overlay?.addEventListener('pointerup', finishMarkDraw);
    overlay?.addEventListener('pointercancel', cancelMarkDraw);
  }

  function renderSchemeList() {
    const container = el('schemeList');
    if (!container || !ensureState()) return;

    const query = String(el('schemeSearch')?.value || '')
      .trim()
      .toLocaleLowerCase('ru-RU');

    const schemes = activeSchemes()
      .filter(item =>
        !query ||
        String(item.name || '').toLocaleLowerCase('ru-RU').includes(query) ||
        String(item.fileName || '').toLocaleLowerCase('ru-RU').includes(query)
      );

    el('schemeListCount').textContent = String(activeSchemes().length);

    container.innerHTML = schemes.length
      ? schemes.map(item => {
          const marks = marksForScheme(item.id);
          const done = marks.filter(mark => COMPLETED_STATUSES.has(mark.status)).length;

          return `
            <button
              type="button"
              class="scheme-list-item ${String(item.id) === String(state.currentSchemeId) ? 'active' : ''}"
              data-scheme-id="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.name || item.fileName || 'Схема')}</strong>
              <span class="scheme-list-meta">
                <span>${Number(item.pageCount || 0) || '—'} стр.</span>
                <span>${marks.length} отметок</span>
                <span>${done} выполнено</span>
                ${item.revision ? `<span>Ред. ${escapeHtml(item.revision)}</span>` : ''}
              </span>
            </button>
          `;
        }).join('')
      : `
          <div class="muted" style="padding:18px 5px;text-align:center">
            PDF-схемы пока не загружены.
          </div>
        `;

    container.querySelectorAll('[data-scheme-id]').forEach(button => {
      button.addEventListener('click', () => selectScheme(button.dataset.schemeId));
    });
  }

  function renderStats() {
    const marks = state.currentSchemeId
      ? marksForScheme(state.currentSchemeId)
      : [];

    const inWork = marks.filter(mark => mark.status === 'В работе').length;
    const completed = marks.filter(mark => COMPLETED_STATUSES.has(mark.status)).length;
    const average = marks.length
      ? Math.round(
          marks.reduce((sum, mark) => sum + Number(mark.progressPercent || 0), 0) /
          marks.length
        )
      : 0;

    el('schemeStatTotal').textContent = String(marks.length);
    el('schemeStatWork').textContent = String(inWork);
    el('schemeStatDone').textContent = String(completed);
    el('schemeStatProgress').textContent = average + '%';
  }

  function renderSchemes() {
    if (!ensureState()) return;

    renderSchemeList();
    renderStats();
    updateToolbarState();

    const schemes = activeSchemes();

    if (
      state.currentSchemeId &&
      !schemes.some(item => String(item.id) === String(state.currentSchemeId))
    ) {
      clearCurrentScheme();
    }
  }

  function updateToolbarState() {
    const scheme = schemeById(state.currentSchemeId);
    const hasScheme = Boolean(scheme);
    const hasPdf = Boolean(state.currentPdf);
    const pages = Number(state.currentPdf?.numPages || scheme?.pageCount || 0);

    el('schemeDownloadBtn').disabled = !hasScheme;
    el('schemeDeleteBtn').disabled = !hasScheme || !canWrite();
    el('schemePrevPage').disabled = !hasPdf || state.page <= 1;
    el('schemeNextPage').disabled = !hasPdf || state.page >= pages;
    el('schemeZoomOut').disabled = !hasPdf || state.zoom <= 0.4;
    el('schemeZoomFit').disabled = !hasPdf;
    el('schemeZoomIn').disabled = !hasPdf || state.zoom >= 3;
    el('schemeMarkMode').disabled = !hasPdf || !canWrite();
    el('schemeMarkMode').classList.toggle('primary', state.drawMode);
    el('schemeMarkMode').textContent = state.drawMode
      ? 'Отмена отметки'
      : 'Отметить участок';
    el('schemeOverlay')?.classList.toggle('draw-mode', state.drawMode);

    el('schemePageLabel').textContent = hasPdf
      ? `Страница ${state.page} / ${pages}`
      : 'Страница —';
  }

  async function selectScheme(id) {
    if (!id || String(id) === String(state.currentSchemeId)) {
      renderSchemeList();
      return;
    }

    state.currentSchemeId = id;
    state.page = 1;
    state.zoom = 1;
    state.drawMode = false;
    state.statusFilter = 'all';

    if (el('schemeStatusFilter')) {
      el('schemeStatusFilter').value = 'all';
    }

    renderSchemeList();
    renderStats();
    await loadSchemePdf();
  }

  function clearCurrentScheme() {
    state.currentSchemeId = '';
    state.currentPdf = null;
    state.currentPdfSchemeId = '';
    state.page = 1;
    state.zoom = 1;
    state.drawMode = false;

    el('schemeStage')?.classList.add('hidden');
    el('schemeEmpty')?.classList.remove('hidden');
    el('schemeOverlay').innerHTML = '';
    updateToolbarState();
    renderStats();
    renderSchemeList();
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return window.pdfjsLib;
    }

    if (window.LIV_PDFJS_PROMISE) {
      return window.LIV_PDFJS_PROMISE;
    }

    window.LIV_PDFJS_PROMISE = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error('PDF.js не инициализирован.'));
          return;
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Не удалось загрузить PDF.js.'));
      document.head.appendChild(script);
    });

    return window.LIV_PDFJS_PROMISE;
  }

  function setLoading(value, text = 'Загрузка схемы...') {
    state.loading = Boolean(value);
    const layer = el('schemeLoading');

    if (!layer) return;

    layer.textContent = text;
    layer.classList.toggle('hidden', !value);
  }

  async function loadSchemePdf() {
    const scheme = schemeById(state.currentSchemeId);

    if (!scheme) {
      clearCurrentScheme();
      return;
    }

    setLoading(true, 'Загрузка PDF-схемы...');
    el('schemeEmpty')?.classList.add('hidden');

    try {
      let documentProxy = state.pdfCache.get(scheme.id) || null;

      if (!documentProxy) {
        const client = window.LIV_SUPABASE;

        if (!client) {
          throw new Error('Нет подключения к Supabase.');
        }

        const download = await client.storage
          .from(STORAGE_BUCKET)
          .download(scheme.storagePath);

        if (download.error) {
          throw download.error;
        }

        const pdfjs = await ensurePdfJs();
        const buffer = await download.data.arrayBuffer();
        documentProxy = await pdfjs.getDocument({
          data: new Uint8Array(buffer)
        }).promise;

        state.pdfCache.set(scheme.id, documentProxy);
      }

      state.currentPdf = documentProxy;
      state.currentPdfSchemeId = scheme.id;
      state.page = Math.min(Math.max(1, state.page), documentProxy.numPages);

      if (Number(scheme.pageCount || 0) !== Number(documentProxy.numPages)) {
        scheme.pageCount = documentProxy.numPages;
        scheme.updatedAt = new Date().toISOString();
        await syncSchemeServer(scheme);
        await saveProject();
      }

      await renderCurrentPage();
    } catch (error) {
      console.error('LIV Schemes: PDF load failed', error);
      state.currentPdf = null;
      el('schemeStage')?.classList.add('hidden');
      el('schemeEmpty')?.classList.remove('hidden');
      el('schemeEmpty').innerHTML = `
        <strong>Не удалось открыть PDF</strong>
        <span>${escapeHtml(error?.message || error)}</span>
      `;
    } finally {
      setLoading(false);
      updateToolbarState();
      renderSchemeList();
    }
  }

  async function renderCurrentPage() {
    if (!state.currentPdf) return;

    setLoading(true, 'Отрисовка страницы...');

    try {
      const page = await state.currentPdf.getPage(state.page);
      const scroll = el('schemeCanvasScroll');
      const canvas = el('schemeCanvas');
      const stage = el('schemeStage');
      const overlay = el('schemeOverlay');
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(320, (scroll?.clientWidth || 900) - 42);
      const fitScale = availableWidth / baseViewport.width;
      const viewport = page.getViewport({ scale: fitScale * state.zoom });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext('2d');

      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      stage.style.width = `${Math.floor(viewport.width)}px`;
      stage.style.height = `${Math.floor(viewport.height)}px`;
      overlay.style.width = `${Math.floor(viewport.width)}px`;
      overlay.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0]
      }).promise;

      el('schemeEmpty')?.classList.add('hidden');
      stage.classList.remove('hidden');
      renderMarks();
    } catch (error) {
      console.error('LIV Schemes: page render failed', error);
      alert('Не удалось отрисовать страницу PDF: ' + (error?.message || error));
    } finally {
      setLoading(false);
      updateToolbarState();
    }
  }

  function renderMarks() {
    const overlay = el('schemeOverlay');
    if (!overlay || !state.currentSchemeId) return;

    overlay.querySelectorAll('.scheme-mark').forEach(node => node.remove());

    marksForScheme(state.currentSchemeId, state.page)
      .filter(mark =>
        state.statusFilter === 'all' ||
        mark.status === state.statusFilter
      )
      .forEach(mark => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = `scheme-mark ${statusClass(mark.status)}`;
        node.dataset.schemeMarkId = mark.id;
        node.style.left = `${clamp(mark.x) * 100}%`;
        node.style.top = `${clamp(mark.y) * 100}%`;
        node.style.width = `${clamp(mark.width, 0.008, 1) * 100}%`;
        node.style.height = `${clamp(mark.height, 0.008, 1) * 100}%`;
        node.title = [
          mark.title || 'Участок',
          mark.status || '',
          `${Math.round(Number(mark.progressPercent || 0))}%`
        ].filter(Boolean).join(' · ');
        node.innerHTML = `<span>${escapeHtml(mark.title || mark.status || 'Участок')} · ${Math.round(Number(mark.progressPercent || 0))}%</span>`;

        node.addEventListener('pointerdown', event => event.stopPropagation());
        node.addEventListener('click', event => {
          event.stopPropagation();
          openMarkEditor(mark.id);
        });

        overlay.appendChild(node);
      });
  }

  function pointFromEvent(event) {
    const overlay = el('schemeOverlay');
    const rect = overlay.getBoundingClientRect();

    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height)
    };
  }

  function beginMarkDraw(event) {
    if (
      !state.drawMode ||
      !canWrite() ||
      event.button !== 0 ||
      event.target !== el('schemeOverlay')
    ) {
      return;
    }

    event.preventDefault();
    const overlay = el('schemeOverlay');
    const point = pointFromEvent(event);
    state.drawStart = point;

    const draft = document.createElement('div');
    draft.className = 'scheme-mark-draft';
    overlay.appendChild(draft);
    state.draftElement = draft;
    overlay.setPointerCapture?.(event.pointerId);
  }

  function moveMarkDraw(event) {
    if (!state.drawStart || !state.draftElement) return;

    const current = pointFromEvent(event);
    const left = Math.min(state.drawStart.x, current.x);
    const top = Math.min(state.drawStart.y, current.y);
    const width = Math.abs(current.x - state.drawStart.x);
    const height = Math.abs(current.y - state.drawStart.y);

    state.draftElement.style.left = `${left * 100}%`;
    state.draftElement.style.top = `${top * 100}%`;
    state.draftElement.style.width = `${width * 100}%`;
    state.draftElement.style.height = `${height * 100}%`;
  }

  function finishMarkDraw(event) {
    if (!state.drawStart) return;

    const finish = pointFromEvent(event);
    let x = Math.min(state.drawStart.x, finish.x);
    let y = Math.min(state.drawStart.y, finish.y);
    let width = Math.abs(finish.x - state.drawStart.x);
    let height = Math.abs(finish.y - state.drawStart.y);

    if (width < 0.012 || height < 0.012) {
      width = 0.05;
      height = 0.05;
      x = clamp(finish.x - width / 2, 0, 1 - width);
      y = clamp(finish.y - height / 2, 0, 1 - height);
    }

    cancelMarkDraw();
    state.drawMode = false;
    updateToolbarState();

    openMarkEditor(null, {
      schemeId: state.currentSchemeId,
      pageNo: state.page,
      x,
      y,
      width,
      height
    });
  }

  function cancelMarkDraw() {
    state.drawStart = null;
    state.draftElement?.remove();
    state.draftElement = null;
  }

  function openMarkEditor(markId = null, draft = null) {
    if (!canWrite()) return;

    const current = getProject();
    const existing = markId ? markById(markId) : null;
    const mark = existing || draft || {};

    if (typeof openModal !== 'function') return;

    openModal(
      existing ? 'Отметка выполнения' : 'Новая отметка на схеме',
      `
        <div class="form-grid">
          <div class="field">
            <label>Наименование участка</label>
            <input id="schemeMarkTitle" value="${escapeHtml(mark.title || '')}" placeholder="Например: Ось А, участок 1">
          </div>

          <div class="field">
            <label>Статус</label>
            <select id="schemeMarkStatus">
              ${MARK_STATUSES.map(status => `
                <option ${status === (mark.status || 'Не начато') ? 'selected' : ''}>${escapeHtml(status)}</option>
              `).join('')}
            </select>
          </div>

          <div class="field">
            <label>Готовность, %</label>
            <input id="schemeMarkProgress" type="number" min="0" max="100" step="1" value="${Math.round(Number(mark.progressPercent || 0))}">
          </div>

          <div class="field">
            <label>Вид работ</label>
            <select id="schemeMarkWork">${listOptions(current.works, mark.workId)}</select>
          </div>

          <div class="field">
            <label>Организация</label>
            <select id="schemeMarkOrganization">${listOptions(current.organizations, mark.organizationId)}</select>
          </div>

          <div class="field">
            <label>Связанный фронт</label>
            <select id="schemeMarkFront">${frontOptions(mark.frontId)}</select>
          </div>
        </div>

        <div class="field">
          <label>Комментарий</label>
          <textarea id="schemeMarkComment">${escapeHtml(mark.comment || '')}</textarea>
        </div>

        <div class="liv-editor-footer">
          ${existing ? `<button id="schemeMarkDelete" class="btn danger-lite">Удалить отметку</button>` : ''}
          <button id="schemeMarkCancel" class="btn">Отмена</button>
          <button id="schemeMarkSave" class="btn primary">Сохранить</button>
        </div>
      `
    );

    el('schemeMarkStatus')?.addEventListener('change', event => {
      const progress = el('schemeMarkProgress');
      if (progress) {
        progress.value = String(statusSuggestedProgress(event.target.value));
      }
    });

    el('schemeMarkCancel')?.addEventListener('click', closeModal);
    el('schemeMarkSave')?.addEventListener('click', () => saveMark(existing, mark));
    el('schemeMarkDelete')?.addEventListener('click', () => deleteMark(existing));
  }

  async function saveMark(existing, geometry) {
    const current = getProject();
    if (!current || !canWrite()) return;

    const status = el('schemeMarkStatus')?.value || 'Не начато';
    const progress = clamp(Number(el('schemeMarkProgress')?.value || 0), 0, 100) * 100;
    const now = new Date().toISOString();
    let mark = existing;

    if (!mark) {
      mark = {
        id: typeof uid === 'function' ? uid('SMK') : `SMK-${crypto.randomUUID()}`,
        schemeId: geometry.schemeId,
        pageNo: geometry.pageNo,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        markType: 'area',
        active: true,
        createdAt: now
      };

      current.schemeMarks.push(mark);
    }

    Object.assign(mark, {
      title: String(el('schemeMarkTitle')?.value || '').trim(),
      status,
      progressPercent: Math.round(progress) / 100,
      workId: el('schemeMarkWork')?.value || '',
      organizationId: el('schemeMarkOrganization')?.value || '',
      frontId: el('schemeMarkFront')?.value || '',
      comment: String(el('schemeMarkComment')?.value || '').trim(),
      active: true,
      updatedAt: now
    });

    if (typeof log === 'function') {
      log(
        existing ? 'Изменено' : 'Создано',
        'Отметка на схеме',
        mark.title || schemeById(mark.schemeId)?.name || 'Участок',
        {
          schemeId: mark.schemeId,
          markId: mark.id,
          pageNo: mark.pageNo,
          status: mark.status,
          progressPercent: mark.progressPercent
        }
      );
    }

    await syncMarkServer(mark);
    await saveProject();
    closeModal();
    renderMarks();
    renderStats();
    renderSchemeList();
  }

  async function deleteMark(mark) {
    if (!mark || !canWrite()) return;

    if (!confirm('Удалить отметку со схемы?')) return;

    mark.active = false;
    mark.deletedAt = new Date().toISOString();
    mark.updatedAt = mark.deletedAt;

    if (typeof log === 'function') {
      log('Удалено', 'Отметка на схеме', mark.title || 'Участок', {
        schemeId: mark.schemeId,
        markId: mark.id
      });
    }

    await syncMarkServer(mark);
    await saveProject();
    closeModal();
    renderMarks();
    renderStats();
    renderSchemeList();
  }

  async function changePage(delta) {
    if (!state.currentPdf) return;

    const next = Math.min(
      state.currentPdf.numPages,
      Math.max(1, state.page + delta)
    );

    if (next === state.page) return;
    state.page = next;
    await renderCurrentPage();
  }

  function changeZoom(delta) {
    if (!state.currentPdf) return;
    state.zoom = clamp(state.zoom + delta, 0.4, 3);
    renderCurrentPage();
  }

  function beginSchemeUpload(file) {
    if (!canWrite()) return;

    if (
      file.type !== 'application/pdf' &&
      !String(file.name || '').toLowerCase().endsWith('.pdf')
    ) {
      alert('Можно загрузить только PDF-файл.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('Размер PDF превышает 100 МБ.');
      return;
    }

    state.pendingFile = file;
    const current = getProject();
    const defaultName = String(file.name || 'Схема')
      .replace(/\.pdf$/i, '')
      .trim();

    openModal(
      'Загрузка PDF-схемы',
      `
        <div class="form-grid">
          <div class="field">
            <label>Название схемы</label>
            <input id="schemeUploadName" value="${escapeHtml(defaultName)}">
          </div>

          <div class="field">
            <label>Редакция</label>
            <input id="schemeUploadRevision" placeholder="Например: Р1">
          </div>

          <div class="field">
            <label>Здание</label>
            <select id="schemeUploadBuilding">${listOptions(current.buildings, '')}</select>
          </div>

          <div class="field">
            <label>Связанная шахматка</label>
            <select id="schemeUploadMatrix">${listOptions(current.matrices, '')}</select>
          </div>
        </div>

        <div class="scheme-upload-note">
          Файл: <b>${escapeHtml(file.name)}</b><br>
          Размер: ${(file.size / 1024 / 1024).toFixed(1)} МБ.<br>
          PDF будет храниться в защищённом хранилище Supabase. Координаты отметок сохраняются отдельно, поэтому они не зависят от масштаба экрана.
        </div>

        <div class="liv-editor-footer">
          <button id="schemeUploadCancel" class="btn">Отмена</button>
          <button id="schemeUploadSave" class="btn primary">Загрузить</button>
        </div>
      `
    );

    el('schemeUploadCancel')?.addEventListener('click', () => {
      state.pendingFile = null;
      closeModal();
    });

    el('schemeUploadSave')?.addEventListener('click', uploadPendingScheme);
  }

  async function uploadPendingScheme() {
    const file = state.pendingFile;
    const current = getProject();
    const client = window.LIV_SUPABASE;

    if (!file || !current || !client || !canWrite()) {
      alert('Не удалось начать загрузку. Проверь подключение и права доступа.');
      return;
    }

    const button = el('schemeUploadSave');
    button.disabled = true;
    button.textContent = 'Загрузка...';

    const id = typeof uid === 'function'
      ? uid('SCH')
      : `SCH-${crypto.randomUUID()}`;
    const name = String(el('schemeUploadName')?.value || '').trim() || file.name;
    const path = `schemes/${id}/${safeFileName(file.name)}`;
    const now = new Date().toISOString();

    try {
      const result = await client.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: 'application/pdf',
          upsert: false
        });

      if (result.error) {
        throw result.error;
      }

      const scheme = {
        id,
        name,
        fileName: file.name,
        storagePath: path,
        mimeType: 'application/pdf',
        fileSize: file.size,
        pageCount: 0,
        buildingId: el('schemeUploadBuilding')?.value || '',
        matrixId: el('schemeUploadMatrix')?.value || '',
        revision: String(el('schemeUploadRevision')?.value || '').trim(),
        status: 'Загружена',
        active: true,
        createdAt: now,
        updatedAt: now
      };

      current.schemes.push(scheme);
      await syncSchemeServer(scheme);

      if (typeof log === 'function') {
        log('Загружено', 'PDF-схема', scheme.name, {
          schemeId: scheme.id,
          fileName: scheme.fileName,
          revision: scheme.revision
        });
      }

      await saveProject();
      state.pendingFile = null;
      closeModal();
      renderSchemes();
      await selectScheme(scheme.id);
    } catch (error) {
      console.error('LIV Schemes: upload failed', error);
      alert('Не удалось загрузить PDF: ' + (error?.message || error));
      button.disabled = false;
      button.textContent = 'Загрузить';
    }
  }

  async function syncSchemeServer(scheme) {
    const client = window.LIV_SUPABASE;
    if (!client || !scheme) return;

    try {
      const payload = {
        external_id: scheme.id,
        name: scheme.name,
        file_name: scheme.fileName,
        storage_path: scheme.storagePath,
        mime_type: scheme.mimeType || 'application/pdf',
        page_count: Number(scheme.pageCount || 0),
        revision: scheme.revision || null,
        status: scheme.status || 'Загружена',
        active: scheme.active !== false,
        updated_at: scheme.updatedAt || new Date().toISOString()
      };

      if (scheme.serverId) {
        const update = await client
          .from('schemes')
          .update(payload)
          .eq('id', scheme.serverId)
          .select('id')
          .maybeSingle();

        if (update.error) throw update.error;
        return;
      }

      const existing = await client
        .from('schemes')
        .select('id')
        .eq('external_id', scheme.id)
        .maybeSingle();

      if (existing.error) throw existing.error;

      if (existing.data?.id) {
        scheme.serverId = existing.data.id;
        await client.from('schemes').update(payload).eq('id', scheme.serverId);
        return;
      }

      const insert = await client
        .from('schemes')
        .insert(payload)
        .select('id')
        .single();

      if (insert.error) throw insert.error;
      scheme.serverId = insert.data?.id || '';
    } catch (error) {
      console.warn('LIV Schemes: scheme server sync failed', error);
    }
  }

  async function syncMarkServer(mark) {
    const client = window.LIV_SUPABASE;
    const scheme = schemeById(mark?.schemeId);

    if (!client || !mark || !scheme?.serverId) return;

    try {
      const payload = {
        external_id: mark.id,
        scheme_id: scheme.serverId,
        page_no: Number(mark.pageNo || 1),
        x: clamp(mark.x),
        y: clamp(mark.y),
        width: clamp(mark.width),
        height: clamp(mark.height),
        mark_type: mark.markType || 'area',
        title: mark.title || null,
        status: mark.status || 'Не начато',
        progress_percent: clamp(mark.progressPercent, 0, 100) * 100,
        comment: mark.comment || null,
        active: mark.active !== false,
        updated_at: mark.updatedAt || new Date().toISOString()
      };

      if (mark.serverId) {
        const update = await client
          .from('scheme_marks')
          .update(payload)
          .eq('id', mark.serverId)
          .select('id')
          .maybeSingle();

        if (update.error) throw update.error;
        return;
      }

      const existing = await client
        .from('scheme_marks')
        .select('id')
        .eq('external_id', mark.id)
        .maybeSingle();

      if (existing.error) throw existing.error;

      if (existing.data?.id) {
        mark.serverId = existing.data.id;
        await client.from('scheme_marks').update(payload).eq('id', mark.serverId);
        return;
      }

      const insert = await client
        .from('scheme_marks')
        .insert(payload)
        .select('id')
        .single();

      if (insert.error) throw insert.error;
      mark.serverId = insert.data?.id || '';
    } catch (error) {
      console.warn('LIV Schemes: mark server sync failed', error);
    }
  }

  async function downloadCurrentScheme() {
    const scheme = schemeById(state.currentSchemeId);
    const client = window.LIV_SUPABASE;
    if (!scheme || !client) return;

    setLoading(true, 'Подготовка файла...');

    try {
      const result = await client.storage
        .from(STORAGE_BUCKET)
        .download(scheme.storagePath);

      if (result.error) throw result.error;

      const url = URL.createObjectURL(result.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = scheme.fileName || `${scheme.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Не удалось скачать PDF: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  function openDeleteSchemeDialog() {
    const scheme = schemeById(state.currentSchemeId);
    if (!scheme || !canWrite()) return;

    const marks = marksForScheme(scheme.id);

    openModal(
      'Удаление PDF-схемы',
      `
        <div class="scheme-delete-note">
          Будет удалена схема <b>${escapeHtml(scheme.name)}</b>, исходный PDF и ${marks.length} отметок выполнения.
          Фронты, организации, виды работ и шахматки при этом не удаляются.
        </div>

        <div class="liv-editor-footer">
          <button id="schemeDeleteCancel" class="btn">Отмена</button>
          <button id="schemeDeleteConfirm" class="btn danger">Удалить схему</button>
        </div>
      `
    );

    el('schemeDeleteCancel')?.addEventListener('click', closeModal);
    el('schemeDeleteConfirm')?.addEventListener('click', deleteCurrentScheme);
  }

  async function deleteCurrentScheme() {
    const scheme = schemeById(state.currentSchemeId);
    const client = window.LIV_SUPABASE;
    if (!scheme || !canWrite()) return;

    const button = el('schemeDeleteConfirm');
    button.disabled = true;
    button.textContent = 'Удаление...';

    try {
      if (client && scheme.storagePath) {
        const storageResult = await client.storage
          .from(STORAGE_BUCKET)
          .remove([scheme.storagePath]);

        if (storageResult.error) {
          console.warn('LIV Schemes: storage delete failed', storageResult.error);
        }
      }

      scheme.active = false;
      scheme.deletedAt = new Date().toISOString();
      scheme.updatedAt = scheme.deletedAt;

      marksForScheme(scheme.id).forEach(mark => {
        mark.active = false;
        mark.deletedAt = scheme.deletedAt;
        mark.updatedAt = scheme.deletedAt;
      });

      if (client) {
        if (scheme.serverId) {
          await client.from('schemes').delete().eq('id', scheme.serverId);
        } else {
          await client.from('schemes').delete().eq('external_id', scheme.id);
        }
      }

      if (typeof log === 'function') {
        log('Удалено', 'PDF-схема', scheme.name, {
          schemeId: scheme.id
        });
      }

      await saveProject();
      state.pdfCache.delete(scheme.id);
      closeModal();
      clearCurrentScheme();
      renderSchemes();
    } catch (error) {
      console.error('LIV Schemes: delete failed', error);
      alert('Не удалось удалить схему: ' + (error?.message || error));
      button.disabled = false;
      button.textContent = 'Удалить схему';
    }
  }

  function bootstrap() {
    injectStyles();
    injectUi();
    bindUi();

    const wait = setInterval(() => {
      if (ensureState()) {
        clearInterval(wait);
        renderSchemes();
      }
    }, 150);

    setTimeout(() => clearInterval(wait), 15000);
  }

  window.addEventListener('liv-remote-project', () => {
    setTimeout(() => {
      ensureState();
      renderSchemes();

      if (
        state.currentSchemeId &&
        !schemeById(state.currentSchemeId)
      ) {
        clearCurrentScheme();
      }
    }, 0);
  });

  window.addEventListener('liv-auth-session', () => {
    setTimeout(renderSchemes, 0);
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (
        state.currentPdf &&
        !el('tab-schemes')?.classList.contains('hidden')
      ) {
        renderCurrentPage();
      }
    }, 250);
  });

  window.LIV_SCHEMES = {
    render: renderSchemes,
    select: selectScheme,
    upload: beginSchemeUpload,
    openMarkEditor
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
