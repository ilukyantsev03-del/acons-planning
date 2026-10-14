'use strict';

(function () {
  const MODULE_VERSION = '2026.10.14.3';
  const state = {
    workbook: null,
    fileName: '',
    sheetName: '',
    matrix: [],
    headerRow: -1,
    headers: [],
    mapping: {},
    sheetMappings: {},
    rows: [],
    responsibility: ''
  };

  const FIELDS = {
    number: {
      label: '№ / ID',
      aliases: ['№','номер','id','код','номер ключевой даты','ключевая дата']
    },
    title: {
      label: 'Наименование ключевой даты',
      aliases: ['наименование','наименование даты','ключевая дата','контрольная дата','название','формулировка','наименование ключевой даты']
    },
    date: {
      label: 'Дата окончания',
      aliases: ['дата','дата окончания','срок','срок исполнения','договорная дата','ключевая дата окончание','окончание']
    },
    organization: {
      label: 'Подрядчик',
      aliases: ['подрядчик','организация','исполнитель','контрагент','субподрядчик']
    },
    contract: {
      label: '№ договора',
      aliases: ['договор','№ договора','номер договора','договор №']
    },
    building: {
      label: 'Здание / объект',
      aliases: ['здание','объект','корпус','сооружение']
    },
    block: {
      label: 'Блок / захватка',
      aliases: ['блок','захватка','блок/захватка']
    },
    floor: {
      label: 'Этаж / номер захватки',
      aliases: ['этаж','уровень','номер захватки','этаж/номер захватки']
    },
    status: {
      label: 'Статус',
      aliases: ['статус','состояние']
    },
    comment: {
      label: 'Комментарий',
      aliases: ['комментарий','примечание','описание']
    }
  };

  function el(id) {
    return document.getElementById(id);
  }

  function currentProject() {
    try {
      return typeof project !== 'undefined' ? project : null;
    } catch (error) {
      return null;
    }
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalized(value) {
    return text(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/[№%()[\]{}.,:;!?/\\_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    if (typeof esc === 'function') return esc(value);
    return text(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function uidValue(prefix) {
    if (typeof uid === 'function') return uid(prefix);
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function isoDate(value) {
    if (!value && value !== 0) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }
    if (typeof value === 'number' && window.XLSX && value > 20000 && value < 80000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return parsed.y + '-' + String(parsed.m).padStart(2, '0') + '-' + String(parsed.d).padStart(2, '0');
    }
    const raw = text(value);
    let match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (match) {
      const year = match[3].length === 2 ? '20' + match[3] : match[3];
      return year + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
    }
    match = raw.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
    if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
    return '';
  }

  function same(a, b) {
    return normalized(a) === normalized(b);
  }

  function ensureCollections() {
    const current = currentProject();
    if (!current) return false;
    ['organizations','contracts','milestones','importHistory','sourceMappings'].forEach(name => {
      if (!Array.isArray(current[name])) current[name] = [];
    });
    return true;
  }

  function headerScore(row) {
    const fields = new Set();
    let nonEmpty = 0;
    (row || []).forEach(cell => {
      const value = normalized(cell);
      if (!value) return;
      nonEmpty += 1;
      Object.entries(FIELDS).forEach(([field, definition]) => {
        [definition.label, ...definition.aliases].forEach(alias => {
          const aliasKey = normalized(alias);
          if (value === aliasKey || value.includes(aliasKey) || aliasKey.includes(value)) fields.add(field);
        });
      });
    });
    let score = fields.size * 10 + Math.min(nonEmpty, 10);
    if (fields.has('title')) score += 30;
    if (fields.has('date')) score += 20;
    return { score, fields };
  }

  function detectHeaderRow(matrix) {
    let best = { index: -1, score: -1 };
    matrix.slice(0, 50).forEach((row, index) => {
      const result = headerScore(row);
      if (result.score > best.score) best = { index, score: result.score };
    });
    return best.index;
  }

  function uniqueHeaders(row) {
    const used = new Map();
    return (row || []).map((value, index) => {
      const base = text(value) || 'Колонка ' + (index + 1);
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return count === 1 ? base : base + ' (' + count + ')';
    });
  }

  function autoMapping(headers) {
    const mapping = {};
    headers.forEach((header, index) => {
      const headerKey = normalized(header);
      let bestField = '';
      let bestScore = 0;
      Object.entries(FIELDS).forEach(([field, definition]) => {
        [definition.label, ...definition.aliases].forEach(alias => {
          const aliasKey = normalized(alias);
          let score = 0;
          if (headerKey === aliasKey) score = 1000 + aliasKey.length;
          else if (headerKey.includes(aliasKey) || aliasKey.includes(headerKey)) score = 100 + Math.min(headerKey.length, aliasKey.length);
          if (score > bestScore) {
            bestScore = score;
            bestField = field;
          }
        });
      });
      if (bestField && bestScore >= 104 && mapping[bestField] == null) mapping[bestField] = index;
    });
    return mapping;
  }

  function value(row, field) {
    const index = state.mapping[field];
    return index == null ? '' : row[index];
  }

  function sectionText(row) {
    const nonEmpty = (row || []).map(text).filter(Boolean);
    if (nonEmpty.length > 2) return '';
    const joined = nonEmpty.join(' ');
    return /(ключев|контрольн).*(генеральн|подрядчик|заказчик|застройщик)/i.test(joined) ? joined : '';
  }

  function parseMilestoneNo(title, sourceNumber) {
    const source = text(sourceNumber);
    if (source && !/^\d+$/.test(source)) return source;
    const match = text(title).match(/(?:ключевая|контрольная)\s+дата\s*№?\s*([\d.]+)/i);
    if (match) return 'КД №' + match[1];
    return source ? 'КД №' + source : '';
  }

  function findBuildingId(name, title) {
    const current = currentProject();
    if (!current) return '';
    const explicit = text(name);
    if (explicit) {
      const exact = current.buildings.find(item => same(item.name, explicit));
      if (exact) return exact.id;
    }
    const haystack = normalized(title);
    const matches = current.buildings
      .filter(item => haystack.includes(normalized(item.name)))
      .sort((a, b) => normalized(b.name).length - normalized(a.name).length);
    return matches[0]?.id || '';
  }

  function organizationOptions(selectedId) {
    const current = currentProject();
    return `
      <option value="">— использовать значение из файла —</option>
      ${(current?.organizations || [])
        .filter(item => item.active !== false)
        .map(item => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
        .join('')}
    `;
  }

  function findOrganization(name, defaultId) {
    const current = currentProject();
    if (!current) return { item: null, sourceName: text(name), status: 'Ошибка' };
    if (defaultId) {
      return {
        item: current.organizations.find(item => String(item.id) === String(defaultId)) || null,
        sourceName: text(name),
        status: 'Совпадение'
      };
    }

    const sourceName = text(name);
    if (!sourceName) return { item: null, sourceName: '', status: 'Требует проверки' };

    const remembered = window.LIV_SOURCE_MAPPINGS?.resolve?.(
      state.fileName || 'key-date-import',
      'organization',
      sourceName,
      'organization'
    );

    if (remembered?.targetLocalId) {
      const item = current.organizations.find(
        organization => String(organization.id) === String(remembered.targetLocalId)
      ) || null;

      if (item) return { item, sourceName, status: 'Совпадение' };
    }

    const exact = current.organizations.find(item =>
      same(item.name, sourceName) ||
      (Array.isArray(item.aliases) && item.aliases.some(alias => same(alias, sourceName)))
    );
    if (exact) return { item: exact, sourceName, status: 'Совпадение' };

    const sourceKey = normalized(sourceName);
    const similar = current.organizations.filter(item => {
      const keys = [
        normalized(item.name),
        ...(Array.isArray(item.aliases) ? item.aliases.map(normalized) : [])
      ].filter(Boolean);

      return keys.some(itemKey =>
        itemKey.includes(sourceKey) || sourceKey.includes(itemKey)
      );
    });
    if (similar.length === 1) return { item: similar[0], sourceName, status: 'Похоже' };
    return { item: null, sourceName, status: 'Новая организация' };
  }

  function findContract(organizationId, number) {
    const current = currentProject();
    const contractNo = text(number);
    if (!current || !contractNo) return null;
    return current.contracts.find(item =>
      String(item.organizationId || '') === String(organizationId || '') && same(item.number || item.contractNo, contractNo)
    ) || null;
  }

  function inferTarget(title) {
    if (window.LIV_MILESTONE_RISK?.inferTarget) return window.LIV_MILESTONE_RISK.inferTarget(title);
    const match = text(title).match(/(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:сва|анкер)/i);
    return match ? { quantity: Number(match[1].replace(/\s/g, '')), unit: 'шт.' } : { quantity: null, unit: '' };
  }

  function milestoneFingerprint(row) {
    return [
      row.organizationId || normalized(row.organizationName),
      normalized(row.contractNo),
      normalized(row.milestoneNo || row.title),
      row.contractDate
    ].join('|');
  }

  function findExisting(row) {
    const current = currentProject();
    if (!current) return null;
    const fingerprint = milestoneFingerprint(row);
    return current.milestones.find(item => {
      if (item.sourceFingerprint && item.sourceFingerprint === fingerprint) return true;
      const candidate = {
        organizationId: item.organizationId,
        organizationName: current.organizations.find(org => String(org.id) === String(item.organizationId))?.name || '',
        contractNo: item.contractNo,
        milestoneNo: item.milestoneNo,
        title: item.title,
        contractDate: item.contractDate
      };
      return milestoneFingerprint(candidate) === fingerprint;
    }) || null;
  }

  function buildRowsFromContext(context) {
    const matrix = context.matrix || [];
    const headerRow = Number(context.headerRow ?? -1);
    const mapping = context.mapping || {};
    const sheetName = context.sheetName || state.sheetName || '';
    const defaultOrganizationId = el('keyDateDefaultOrg')?.value || '';
    const defaultContract = text(el('keyDateDefaultContract')?.value);
    const rows = [];
    let responsibility = '';
    let inheritedOrganization = '';
    let inheritedContract = defaultContract;
    let inheritedBuilding = '';

    const valueAt = (row, field) => {
      const index = mapping[field];
      return index == null ? '' : row[index];
    };

    matrix.slice(headerRow + 1).forEach((sourceRow, index) => {
      const section = sectionText(sourceRow);
      if (section) {
        responsibility = section;
        return;
      }

      const title = text(valueAt(sourceRow, 'title'));
      const targetDate = isoDate(valueAt(sourceRow, 'date'));
      const rawOrganization = text(valueAt(sourceRow, 'organization'));
      const rawContract = text(valueAt(sourceRow, 'contract'));
      const rawBuilding = text(valueAt(sourceRow, 'building'));

      if (rawOrganization) inheritedOrganization = rawOrganization;
      if (rawContract) inheritedContract = rawContract;
      if (rawBuilding) inheritedBuilding = rawBuilding;
      if (!title && !targetDate) return;

      const organizationSource =
        rawOrganization ||
        inheritedOrganization ||
        (
          defaultOrganizationId
            ? ''
            : sheetName
        );

      const organizationMatch = findOrganization(organizationSource, defaultOrganizationId);
      const milestoneNo = parseMilestoneNo(title, valueAt(sourceRow, 'number'));
      const target = inferTarget(title);
      const parsed = {
        sourceSheet: sheetName,
        rowNumber: headerRow + 2 + index,
        selected: Boolean(title && targetDate),
        title,
        contractDate: targetDate,
        organizationId: organizationMatch.item?.id || '',
        organizationName: organizationMatch.item?.name || organizationMatch.sourceName,
        organizationSource: organizationSource,
        organizationStatus: organizationMatch.status,
        contractNo: rawContract || inheritedContract,
        milestoneNo,
        buildingId: findBuildingId(rawBuilding || inheritedBuilding, title),
        blockCapture: text(valueAt(sourceRow, 'block')),
        floorCapture: text(valueAt(sourceRow, 'floor')),
        status: text(valueAt(sourceRow, 'status')) || 'Не наступила',
        comment: text(valueAt(sourceRow, 'comment')),
        responsibility,
        targetQty: target.quantity,
        targetUnit: target.unit,
        sourceFingerprint: ''
      };
      parsed.sourceFingerprint = milestoneFingerprint(parsed);
      parsed.existing = findExisting(parsed);
      parsed.result = !title || !targetDate
        ? 'Ошибка'
        : parsed.existing
          ? 'Обновление'
          : organizationMatch.item
            ? 'Новая КД'
            : organizationMatch.status;
      rows.push(parsed);
    });

    return rows;
  }

  function buildRows() {
    state.rows = buildRowsFromContext({
      matrix: state.matrix,
      headerRow: state.headerRow,
      mapping: state.mapping,
      sheetName: state.sheetName
    });
  }

  function mappingOptions(field) {
    const current = state.mapping[field];
    return `
      <option value="">— не использовать —</option>
      ${state.headers.map((header, index) => `<option value="${index}" ${current === index ? 'selected' : ''}>${escapeHtml(header)}</option>`).join('')}
    `;
  }

  function renderMapping() {
    const host = el('keyDateMapping');
    if (!host) return;
    host.innerHTML = `
      <div class="schedule-map-title">
        <b>Сопоставление колонок</b>
        <span class="muted">Проверь обязательные поля «Наименование» и «Дата окончания».</span>
      </div>
      <div class="schedule-map-grid">
        ${Object.entries(FIELDS).map(([field, definition]) => `
          <label class="schedule-map-item">
            <span>${escapeHtml(definition.label)}</span>
            <select data-kd-field="${field}">${mappingOptions(field)}</select>
          </label>
        `).join('')}
      </div>
    `;

    host.querySelectorAll('[data-kd-field]').forEach(select => {
      select.addEventListener('change', () => {
        if (select.value === '') delete state.mapping[select.dataset.kdField];
        else state.mapping[select.dataset.kdField] = Number(select.value);
        buildRows();
        renderPreview();
      });
    });
  }

  function renderPreview() {
    const host = el('keyDatePreview');
    const commit = el('keyDateCommit');
    if (!host) return;

    const counts = state.rows.reduce((result, row) => {
      result[row.result] = (result[row.result] || 0) + 1;
      return result;
    }, {});
    const selectedSheets = [...new Set(state.rows.map(row => row.sourceSheet).filter(Boolean))];
    el('keyDateSummary').textContent =
      (state.sheetName === '__ALL__'
        ? 'Листов: ' + selectedSheets.length
        : 'Лист: ' + state.sheetName) +
      ' · строк: ' + state.rows.length + ' · ' +
      Object.entries(counts).map(([name, count]) => name + ': ' + count).join(' · ');

    host.innerHTML = `
      <table>
        <thead>
          <tr>
            <th></th><th>Лист</th><th>Строка</th><th>Результат</th><th>Подрядчик</th><th>Договор</th><th>КД</th><th>Дата</th><th>Цель</th>
          </tr>
        </thead>
        <tbody>
          ${state.rows.slice(0, 500).map((row, index) => `
            <tr>
              <td><input type="checkbox" data-kd-row="${index}" ${row.selected ? 'checked' : ''} ${row.result === 'Ошибка' ? 'disabled' : ''}></td>
              <td>${escapeHtml(row.sourceSheet || '—')}</td>
              <td>${row.rowNumber}</td>
              <td>${escapeHtml(row.result)}</td>
              <td>${escapeHtml(row.organizationName || '—')}</td>
              <td>${escapeHtml(row.contractNo || '—')}</td>
              <td><b>${escapeHtml(row.milestoneNo || '')}</b> ${escapeHtml(row.title)}</td>
              <td>${escapeHtml(row.contractDate || '—')}</td>
              <td>${row.targetQty == null ? '—' : escapeHtml(row.targetQty + ' ' + row.targetUnit)}</td>
            </tr>
          `).join('') || '<tr><td colspan="9"><div class="empty-state">Строки ключевых дат не найдены.</div></td></tr>'}
        </tbody>
      </table>
    `;

    host.querySelectorAll('[data-kd-row]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const row = state.rows[Number(checkbox.dataset.kdRow)];
        if (row) row.selected = checkbox.checked;
        if (commit) commit.disabled = !state.rows.some(item => item.selected && item.result !== 'Ошибка');
      });
    });
    if (commit) commit.disabled = !state.rows.some(item => item.selected && item.result !== 'Ошибка');
  }

  function readSheet() {
    if (!state.workbook) return;

    const selected = el('keyDateSheet')?.value || state.workbook.SheetNames[0];

    if (selected === '__ALL__') {
      state.sheetName = '__ALL__';
      state.matrix = [];
      state.headerRow = -1;
      state.headers = [];
      state.mapping = {};
      state.sheetMappings = {};
      state.rows = [];

      state.workbook.SheetNames.forEach(name => {
        const sheet = state.workbook.Sheets[name];
        const matrix = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
          cellDates: true,
          blankrows: false
        });
        const headerRow = detectHeaderRow(matrix);
        const headers = uniqueHeaders(matrix[headerRow] || []);
        const mapping = autoMapping(headers);

        state.sheetMappings[name] = {
          headerRow,
          headers,
          mapping
        };

        const rows = buildRowsFromContext({
          matrix,
          headerRow,
          mapping,
          sheetName: name
        });

        state.rows.push(...rows);
      });

      const mappingHost = el('keyDateMapping');
      if (mappingHost) {
        mappingHost.innerHTML =
          '<div class="notice">Все листы сопоставлены автоматически отдельно. ' +
          'Если у конкретного листа нестандартная шапка, выбери его в поле «Лист» и скорректируй сопоставление вручную.</div>';
      }

      renderPreview();
      return;
    }

    state.sheetName = selected;
    const sheet = state.workbook.Sheets[state.sheetName];
    state.matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
      cellDates: true,
      blankrows: false
    });
    state.headerRow = detectHeaderRow(state.matrix);
    state.headers = uniqueHeaders(state.matrix[state.headerRow] || []);
    state.mapping = autoMapping(state.headers);
    state.sheetMappings = {
      [state.sheetName]: {
        headerRow: state.headerRow,
        headers: state.headers,
        mapping: state.sheetName === '__ALL__' ? state.sheetMappings : state.mapping
      }
    };
    buildRows();
    renderMapping();
    renderPreview();
  }

  async function readFile(file) {
    if (!file || !window.XLSX) return;
    try {
      state.workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      state.fileName = file.name;
      const sheetSelect = el('keyDateSheet');
      sheetSelect.innerHTML =
        (state.workbook.SheetNames.length > 1
          ? '<option value="__ALL__">Все листы</option>'
          : '') +
        state.workbook.SheetNames
          .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
          .join('');
      sheetSelect.disabled = false;
      sheetSelect.value = state.workbook.SheetNames.length > 1
        ? '__ALL__'
        : state.workbook.SheetNames[0];
      readSheet();
    } catch (error) {
      console.error('LIV key date import:', error);
      alert('Не удалось прочитать файл ключевых дат: ' + (error?.message || error));
    }
  }

  function openImporter() {
    if (!ensureCollections() || typeof openModal !== 'function') return;
    Object.assign(state, {
      workbook: null,
      fileName: '',
      sheetName: '',
      matrix: [],
      headerRow: -1,
      headers: [],
      mapping: {},
      sheetMappings: {},
      rows: []
    });

    openModal('Импорт ключевых дат', `
      <div class="form-grid">
        <div class="field">
          <label>Excel / CSV</label>
          <input id="keyDateFile" type="file" accept=".xlsx,.xls,.csv">
        </div>
        <div class="field">
          <label>Лист</label>
          <select id="keyDateSheet" disabled></select>
        </div>
        <div class="field">
          <label>Подрядчик по умолчанию</label>
          <select id="keyDateDefaultOrg">${organizationOptions('')}</select>
        </div>
        <div class="field">
          <label>№ договора по умолчанию</label>
          <input id="keyDateDefaultContract" placeholder="Если в файле нет отдельной колонки">
        </div>
      </div>

      <div id="keyDateMapping" class="schedule-mapping">
        <div class="empty-state">Выбери файл. LIV определит шапку и предложит сопоставление.</div>
      </div>

      <div id="keyDateSummary" class="notice hidden"></div>
      <div id="keyDatePreview" class="table-wrap schedule-preview"></div>

      <div class="liv-editor-footer">
        <button id="keyDateCancel" class="btn">Отмена</button>
        <button id="keyDateCommit" class="btn primary" disabled>Импортировать выбранное</button>
      </div>
    `);

    el('keyDateFile')?.addEventListener('change', event => readFile(event.target.files?.[0]));
    el('keyDateSheet')?.addEventListener('change', readSheet);
    ['keyDateDefaultOrg','keyDateDefaultContract'].forEach(id => el(id)?.addEventListener('change', () => {
      if (!state.workbook) return;
      buildRows();
      renderPreview();
    }));
    el('keyDateCancel')?.addEventListener('click', closeModal);
    el('keyDateCommit')?.addEventListener('click', commitImport);
  }

  function ensureOrganization(row) {
    const current = currentProject();
    if (!current) return null;

    let organization = null;

    if (row.organizationId) {
      organization = current.organizations.find(
        item => String(item.id) === String(row.organizationId)
      ) || null;
    }

    if (!organization && row.organizationName) {
      organization = current.organizations.find(
        item =>
          same(item.name, row.organizationName) ||
          (
            Array.isArray(item.aliases) &&
            item.aliases.some(alias => same(alias,row.organizationName))
          )
      ) || null;
    }

    if (!organization && row.organizationName) {
      organization = {
        id: uidValue('ORG'),
        name: row.organizationName,
        organizationType: 'contractor',
        aliases: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      current.organizations.push(organization);
    }

    if (!organization) return null;

    const sourceValue = text(row.organizationSource || row.organizationName);
    if (
      sourceValue &&
      !same(sourceValue, organization.name)
    ) {
      organization.aliases = Array.isArray(organization.aliases)
        ? organization.aliases
        : [];

      if (!organization.aliases.some(alias => same(alias,sourceValue))) {
        organization.aliases.push(sourceValue);
      }
    }

    if (sourceValue) {
      window.LIV_SOURCE_MAPPINGS?.remember?.({
        sourceName: state.fileName || 'key-date-import',
        sourceEntityType: 'organization',
        sourceValue,
        targetEntityType: 'organization',
        targetLocalId: organization.id,
        confidence: row.organizationStatus === 'Похоже' ? 0.8 : 1,
        decision: 'confirmed'
      });
    }

    return organization;
  }

  function ensureContract(row, organization) {
    const current = currentProject();
    if (!row.contractNo) return null;
    let contract = findContract(organization?.id, row.contractNo);
    if (!contract) {
      contract = {
        id: uidValue('CTR'),
        organizationId: organization?.id || '',
        number: row.contractNo,
        name: row.contractNo,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      current.contracts.push(contract);
    }
    return contract;
  }

  async function commitImport() {
    const current = currentProject();
    if (!current) return;
    const selected = state.rows.filter(row => row.selected && row.result !== 'Ошибка');
    if (!selected.length) return;
    if (!confirm('Импортировать ключевые даты: ' + selected.length + '?')) return;

    const batchId = uidValue('IMP-KD');
    let created = 0;
    let updated = 0;
    let skipped = 0;

    selected.forEach(row => {
      const organization = ensureOrganization(row);
      if (!organization) {
        skipped += 1;
        return;
      }
      const contract = ensureContract(row, organization);
      let milestone = row.existing || findExisting({ ...row, organizationId: organization.id });
      const now = new Date().toISOString();

      if (!milestone) {
        milestone = {
          id: uidValue('M'),
          correspondence: [],
          createdAt: now,
          active: true
        };
        current.milestones.push(milestone);
        created += 1;
      } else {
        updated += 1;
      }

      const existingLetters = Array.isArray(milestone.correspondence) ? milestone.correspondence : [];
      Object.assign(milestone, {
        organizationId: organization.id,
        contractId: contract?.id || milestone.contractId || '',
        contractNo: row.contractNo,
        milestoneNo: row.milestoneNo,
        buildingId: row.buildingId || milestone.buildingId || '',
        blockCapture: row.blockCapture,
        floorCapture: row.floorCapture,
        title: row.title,
        contractDate: row.contractDate,
        workDate: milestone.workDate || row.contractDate,
        status: row.status || milestone.status || 'Не наступила',
        comment: row.comment || milestone.comment || '',
        responsibility: row.responsibility,
        targetQty: row.targetQty,
        targetUnit: row.targetUnit,
        riskWindowDays: milestone.riskWindowDays || 7,
        riskCalendarId: milestone.riskCalendarId || '7x0',
        sourceFingerprint: row.sourceFingerprint,
        source: {
          batchId,
          file: state.fileName,
          sheet: row.sourceSheet || state.sheetName,
          row: row.rowNumber,
          importedAt: now
        },
        correspondence: existingLetters,
        updatedAt: now,
        active: true
      });
    });

    current.importHistory.unshift({
      id: batchId,
      type: 'milestones',
      mode: 'milestones',
      file: state.fileName,
      sheet: state.sheetName === '__ALL__' ? 'Все листы' : state.sheetName,
      status: 'accepted',
      at: new Date().toISOString(),
      totalRows: state.rows.length,
      created,
      updated,
      skipped,
      details: {
        importer: 'key-date-import',
        version: MODULE_VERSION,
        mapping: state.mapping
      }
    });

    if (typeof log === 'function') {
      log('Импорт', 'Ключевые даты', state.fileName + ' · создано ' + created + ', обновлено ' + updated + ', пропущено ' + skipped);
    }
    if (typeof saveProject === 'function') await saveProject();
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderAll === 'function') renderAll();
    alert('Импорт ключевых дат завершён.\nСоздано: ' + created + '\nОбновлено: ' + updated + '\nПропущено: ' + skipped);
  }

  function injectButton() {
    const original = el('newMilestoneBtn');
    if (!original || el('importMilestonesBtn')) return false;
    const button = document.createElement('button');
    button.id = 'importMilestonesBtn';
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Импорт КД';
    button.addEventListener('click', openImporter);
    original.parentNode.insertBefore(button, original);
    return true;
  }

  function bootstrap() {
    const timer = setInterval(() => {
      if (injectButton()) clearInterval(timer);
    }, 150);
    setTimeout(() => clearInterval(timer), 20000);
  }

  window.LIV_KEY_DATE_IMPORT = {
    version: MODULE_VERSION,
    open: openImporter,
    state: () => ({ ...state, workbook: undefined, matrix: undefined })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
