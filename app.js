'use strict';

const $ = id => document.getElementById(id);

const DB_NAME = 'acons_planning_local';
const DB_VERSION = 2;
const STORE = 'project';
const PROJECT_KEY = 'main';
const SCHEMA_VERSION = '2.1.0';

const STATUS_LIST = [
  'Не начато',
  'Фронт готов',
  'В работе',
  'Завершено',
  'Приостановлено',
  'Ограничение'
];

const ELEMENT_STATUS_LIST = [
  'Не начато',
  'В работе',
  'Выполнено',
  'Освидетельствовано',
  'Принято',
  'Ограничение'
];

const DEFAULT_BUILDINGS = [
  'Главный корпус',
  'Грязелечебница',
  'Ресторан с банкетным залом',
  'КПП',
  'ДЭС',
  'ТП-2',
  'ТП-3',
  'ТП-4',
  'РТП. Хладоцентр',
  'Котельная',
  'РЧВ',
  'Подпорные стены благоустройства',
  'Аэрарий'
];

const DEFAULT_WORKS = [
  ['Кладка наружных стен', 'АР', 'м²'],
  ['Вертикальное армирование', 'КР', 'т'],
  ['Штукатурка', 'АР', 'м²'],
  ['Гидроизоляция балконов', 'АР', 'м²'],
  ['Передача фронта', 'Организация работ', 'шт.']
];

const DEFAULT_DEMOLITION = [
  "Склад (ангар) литера Д'",
  'Нежилое здание, Корпус №10 литера Д',
  'Нежилое здание, Корпус №9 литера Г',
  'Нежилое здание №11 литера Е',
  'Демонтаж «фонтана с оленем»',
  'Аэрарий',
  'Нежилое здание Корпус №12 литера З',
  'Нежилое здание Корпус №1 литера Б',
  "Котельная литера Ф'",
  "Склад литера Б', 90:25:020102:170",
  "Коттедж 1 литера Ш'",
  'Парники',
  'Коммунальная столовая литера Ц',
  'Управление (бытовые помещения) литера Р',
  'Теплица в ООПТ',
  "Сауна литера Л'",
  'Склад',
  "Кладовая / Аккумуляторная литера Т'",
  "Гараж литера Ж'",
  "Гараж литера С'",
  "Нежилое здание КТП / Диспетчерская литера П'",
  'Нежилое здание, Корпус №4 литера В',
  'Библиотека литера Ю',
  'Нежилое здание Корпус №32 литера И',
  'Спортивная площадка',
  "Нежилое здание (Коттедж 3) литера Ц'",
  'Приемная, спортзал литера Т (ЛФК)',
  'Прачечная литера А (ОКН)',
  "Нежилое здание литера У' (Склад ген.подрядчика)",
  'Офис, нежилое здание литера Ф (штаб тех.заказчика)',
  'Нежилое здание Корпус №35 литера Л (штаб ген.подрядчика)',
  'Нежилое здание, Корпус №34 литера К (ООПТ)'
];

let db = null;
let project = null;

let compareIncoming = null;
let compareItems = [];

let importWorkbook = null;
let importFileName = '';
let importSheetName = '';
let importHeaders = [];
let importRawRows = [];
let importRows = [];
let importMapping = {};
let importModeResolved = 'fronts';
let importMappingMode = '';

const uid = prefix =>
  `${prefix}-${crypto.randomUUID()}`;

const today = () =>
  new Date().toISOString().slice(0, 10);

const nowIso = () =>
  new Date().toISOString();

const clone = value =>
  JSON.parse(JSON.stringify(value));

const num = value =>
  Number(
    String(value ?? 0)
      .replace(/\s/g, '')
      .replace(',', '.')
  ) || 0;

const fmt = value =>
  Math.round(num(value) * 100) / 100;

const esc = value =>
  String(value ?? '')
    .replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[c]
    );

const normText = value =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const normKey = value =>
  normText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[№#]/g, 'номер')
    .replace(/[()]/g, ' ')
    .replace(/[._/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sameText = (a, b) =>
  normKey(a) === normKey(b);

const uniq = arr =>
  [
    ...new Set(
      (arr || [])
        .filter(
          value =>
            value !== '' &&
            value !== null &&
            value !== undefined
        )
    )
  ];

const byId = (list, id) =>
  (list || [])
    .find(
      item =>
        String(item.id) === String(id)
    );

const nameById = (list, id) =>
  byId(list, id)?.name || '';

const diffDays = (a, b) =>
  a && b
    ? Math.round(
        (
          Date.parse(b) -
          Date.parse(a)
        ) / 86400000
      )
    : null;


function normalizeStatus(value) {

  const text =
    normKey(value);

  if (!text) {
    return '';
  }

  if (
    /не начат/.test(text)
  ) {
    return 'Не начато';
  }

  if (
    /приостанов|останов/.test(text)
  ) {
    return 'Приостановлено';
  }

  if (
    /огранич|блокир/.test(text)
  ) {
    return 'Ограничение';
  }

  if (
    /фронт готов|готово к старт/.test(text)
  ) {
    return 'Фронт готов';
  }

  if (
    /заверш|оконч|выполн/.test(text)
  ) {
    return 'Завершено';
  }

  if (
    /начат|в работе|производ/.test(text)
  ) {
    return 'В работе';
  }

  return normText(value);
}


function emptyProject() {

  return {

    schemaVersion:
      SCHEMA_VERSION,

    meta: {
      projectName:
        'ACONS Planning',

      createdAt:
        nowIso(),

      updatedAt:
        nowIso(),

      lastBackupAt:
        null,

      lastMigrationAt:
        null
    },

    buildings:
      DEFAULT_BUILDINGS.map(
        (name, index) => ({

          id:
            `BLD-${String(index + 1)
              .padStart(3, '0')}`,

          name,

          active:
            true,

          sort:
            index + 1
        })
      ),

    organizations:
      [],

    works:
      DEFAULT_WORKS.map(
        (row, index) => ({

          id:
            `WRK-${String(index + 1)
              .padStart(3, '0')}`,

          name:
            row[0],

          section:
            row[1],

          unit:
            row[2],

          active:
            true,

          sort:
            index + 1
        })
      ),

    structures:
      [],

    fronts:
      [],

    planLog:
      [],

    factLog:
      [],

    resources:
      [],

    milestones:
      [],

    numberedElements:
      [],

    demolition:
      DEFAULT_DEMOLITION.map(
        (name, index) => ({

          id:
            `DEM-${String(index + 1)
              .padStart(3, '0')}`,

          name,

          status:
            'Не начато',

          planStart:
            '',

          planEnd:
            '',

          factStart:
            '',

          factEnd:
            '',

          forecastEnd:
            '',

          comment:
            '',

          active:
            true
        })
      ),

    contracts:
      [],

    constraints:
      [],

    diagrams:
      [],

    diagramMarks:
      [],

    scheduleVersions:
      [],

    customFields:
      [],

    views:
      [],

    importProfiles:
      [],

    importHistory:
      [],

    history:
      []
  };
}


function normalizeProject(data) {

  const base =
    emptyProject();

  const result = {
    ...base,
    ...(data || {})
  };

  result.meta = {
    ...base.meta,
    ...((data || {}).meta || {})
  };

  const arrays = [
    'buildings',
    'organizations',
    'works',
    'structures',
    'fronts',
    'planLog',
    'factLog',
    'resources',
    'milestones',
    'numberedElements',
    'demolition',
    'contracts',
    'constraints',
    'diagrams',
    'diagramMarks',
    'scheduleVersions',
    'customFields',
    'views',
    'importProfiles',
    'importHistory',
    'history'
  ];

  arrays.forEach(
    key => {

      if (
        Array.isArray(
          data?.[key]
        )
      ) {
        result[key] =
          data[key];
      }
    }
  );

  result.fronts =
    result.fronts.map(
      front => ({
        active:
          true,

        ...front
      })
    );

  result.numberedElements =
    result.numberedElements.map(
      item => ({
        active:
          true,

        uniqueScope:
          'context',

        ...item
      })
    );

  result.schemaVersion =
    SCHEMA_VERSION;

  return result;
}


async function openDb() {

  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded =
        event => {

          const database =
            event.target.result;

          if (
            !database.objectStoreNames
              .contains(STORE)
          ) {
            database
              .createObjectStore(
                STORE
              );
          }
        };

      request.onsuccess =
        event =>
          resolve(
            event.target.result
          );

      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


async function dbGetKey(
  key = PROJECT_KEY
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE,
          'readonly'
        );

      const request =
        transaction
          .objectStore(STORE)
          .get(key);

      request.onsuccess =
        () =>
          resolve(
            request.result ||
            null
          );

      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


async function dbPutKey(
  value,
  key = PROJECT_KEY
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE,
          'readwrite'
        );

      transaction
        .objectStore(STORE)
        .put(
          value,
          key
        );

      transaction.oncomplete =
        () =>
          resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error
          );
    }
  );
}


async function migrateIfNeeded(raw) {

  if (!raw) {
    return emptyProject();
  }

  const oldVersion =
    raw.schemaVersion ||
    '0.0.0';

  if (
    oldVersion ===
    SCHEMA_VERSION
  ) {
    return normalizeProject(raw);
  }

  const backupKey =
    `migration-backup-${Date.now()}`;

  await dbPutKey(
    clone(raw),
    backupKey
  );

  const migrated =
    normalizeProject(raw);

  migrated.meta.lastMigrationAt =
    nowIso();

  migrated.meta.migrationFrom =
    oldVersion;

  migrated.meta.migrationBackupKey =
    backupKey;

  migrated.history.unshift({

    id:
      uid('H'),

    at:
      nowIso(),

    action:
      'Миграция',

    entity:
      'Проект',

    description:
      `Структура обновлена ${oldVersion} → ${SCHEMA_VERSION}. Создана защитная копия.`
  });

  return migrated;
}


async function saveProject() {

  project.meta.updatedAt =
    nowIso();

  project.schemaVersion =
    SCHEMA_VERSION;

  await dbPutKey(
    project
  );

  renderBackupNotice();
}


function log(
  action,
  entity,
  description,
  details = {}
) {

  project.history.unshift({

    id:
      uid('H'),

    at:
      nowIso(),

    action,

    entity,

    description,

    details
  });

  project.history =
    project.history
      .slice(
        0,
        10000
      );
}


function download(
  name,
  text,
  type = 'application/json'
) {

  const blob =
    new Blob(
      [text],
      { type }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href =
    url;

  link.download =
    name;

  document.body
    .appendChild(link);

  link.click();

  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}


function activeFronts() {

  return project.fronts
    .filter(
      front =>
        front.active !== false
    );
}


function hydrateFront(front) {

  if (!front) {
    return {};
  }

  const structure =
    byId(
      project.structures,
      front.structureId
    ) || {};

  return {

    ...front,

    structure,

    building:
      nameById(
        project.buildings,
        structure.buildingId
      ),

    work:
      nameById(
        project.works,
        front.workId
      ),

    organization:
      nameById(
        project.organizations,
        front.organizationId
      ),

    block:
      structure.block || '',

    floor:
      structure.floor ?? '',

    capture:
      structure.capture || '',

    axis:
      structure.axis || '',

    side:
      structure.side || '',

    zone:
      structure.zone || '',

    roomNo:
      structure.roomNo || '',

    roomName:
      structure.roomName || ''
  };
}


function frontLabel(front) {

  if (!front) {
    return '—';
  }

  const hydrated =
    hydrateFront(front);

  return [
    hydrated.building,
    hydrated.block,

    hydrated.floor !== ''
      ? `${hydrated.floor} эт.`
      : '',

    hydrated.capture
      ? `захв. ${hydrated.capture}`
      : '',

    hydrated.axis
      ? `ось ${hydrated.axis}`
      : '',

    hydrated.side,
    hydrated.zone,

    hydrated.roomNo
      ? `пом. ${hydrated.roomNo}`
      : '',

    hydrated.work
  ]
    .filter(Boolean)
    .join(' / ');
}


function fill(
  element,
  items,
  allLabel
) {

  if (!element) {
    return;
  }

  const current =
    element.value;

  element.innerHTML =
    '';

  if (
    allLabel !== undefined
  ) {

    const option =
      document.createElement(
        'option'
      );

    option.value =
      'all';

    option.textContent =
      allLabel;

    element.appendChild(
      option
    );
  }

  items.forEach(
    item => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        String(
          item.id ??
          item
        );

      option.textContent =
        String(
          item.name ??
          item
        );

      element.appendChild(
        option
      );
    }
  );

  if (
    [...element.options]
      .some(
        option =>
          option.value ===
          current
      )
  ) {
    element.value =
      current;
  }
}


function initSelects() {

  const buildings =
    project.buildings
      .filter(
        item =>
          item.active !== false
      );

  const works =
    project.works
      .filter(
        item =>
          item.active !== false
      );

  const organizations =
    project.organizations
      .filter(
        item =>
          item.active !== false
      );

  [
    'mfBuilding',
    'gBuilding',
    'pfBuilding',
    'rBuilding',
    'elBuilding'
  ]
    .forEach(
      id =>
        fill(
          $(id),
          buildings,
          'Все здания'
        )
    );

  [
    'mfWork',
    'gWork',
    'pfWork'
  ]
    .forEach(
      id =>
        fill(
          $(id),
          works,
          'Все работы'
        )
    );

  [
    'mfOrg',
    'rOrg'
  ]
    .forEach(
      id =>
        fill(
          $(id),
          organizations,
          'Все организации'
        )
    );

  const elementTypes =
    uniq(
      project.numberedElements
        .map(
          item =>
            item.elementType
        )
    )
      .sort()
      .map(
        name => ({
          id:
            name,

          name
        })
      );

  fill(
    $('elType'),
    elementTypes,
    'Все типы'
  );

  updateMatrixDependent();
}


function updateMatrixDependent() {

  const buildingId =
    $('mfBuilding')?.value ||
    'all';

  const structures =
    project.structures
      .filter(
        structure =>
          buildingId === 'all' ||
          structure.buildingId ===
            buildingId
      );

  fill(
    $('mfBlock'),

    uniq(
      structures
        .map(
          item =>
            item.block
        )
    )
      .map(
        name => ({
          id:
            name,

          name
        })
      ),

    'Все блоки'
  );

  fill(
    $('mfFloor'),

    uniq(
      structures
        .map(
          item =>
            item.floor
        )
    )
      .sort(
        (a, b) =>
          num(a) -
          num(b)
      )
      .map(
        name => ({
          id:
            name,

          name
        })
      ),

    'Все этажи'
  );
}


function statusRowClass(status) {

  if (
    status ===
    'Завершено'
  ) {
    return 's-done';
  }

  if (
    status ===
    'В работе'
  ) {
    return 's-work';
  }

  if (
    status ===
    'Ограничение'
  ) {
    return 's-risk';
  }

  if (
    status ===
    'Фронт готов'
  ) {
    return 's-ready';
  }

  if (
    status ===
    'Приостановлено'
  ) {
    return 's-pause';
  }

  return '';
}


function renderDashboard() {

  const fronts =
    activeFronts()
      .map(hydrateFront);

  $('dTotal').textContent =
    fronts.length;

  $('dWork').textContent =
    fronts.filter(
      front =>
        front.status ===
        'В работе'
    ).length;

  $('dDone').textContent =
    fronts.filter(
      front =>
        front.status ===
          'Завершено' ||
        front.completed
    ).length;

  $('dAccepted').textContent =
    fronts.filter(
      front =>
        front.accepted
    ).length;

  $('dLate').textContent =
    fronts.filter(
      front =>
        front.contractEnd &&
        !front.accepted &&
        front.contractEnd <
          today()
    ).length;

  $('dRisk').textContent =
    fronts.filter(
      front =>
        [
          'Ограничение',
          'Приостановлено'
        ]
          .includes(
            front.status
          )
    ).length;

  const critical =
    fronts
      .filter(
        front =>
          (
            front.contractEnd &&
            !front.accepted &&
            front.contractEnd <
              today()
          ) ||
          [
            'Ограничение',
            'Приостановлено'
          ]
            .includes(
              front.status
            )
      )
      .slice(
        0,
        20
      );

  $('dCritical').innerHTML =
    critical
      .map(
        front =>
          `
            <div class="item">
              <span>
                ${esc(frontLabel(front))}
              </span>

              <strong>
                ${esc(front.status)}
              </strong>
            </div>
          `
      )
      .join('') ||
    '<div class="muted">Нет критичных фронтов</div>';

  const lastDate =
    [...project.resources]
      .sort(
        (a, b) =>
          String(a.date)
            .localeCompare(
              String(b.date)
            )
      )
      .slice(-1)[0]
      ?.date;

  const rows =
    project.resources
      .filter(
        row =>
          row.date ===
          lastDate
      );

  const people =
    rows.reduce(
      (sum, row) =>
        sum +
        num(row.itr) +
        num(row.workers) +
        num(row.mechanizers),
      0
    );

  const equipment =
    rows.reduce(
      (sum, row) =>
        sum +
        num(row.equipmentQty),
      0
    );

  $('dResources').innerHTML =
    lastDate
      ? `
          <div class="item">
            <span>Дата</span>
            <strong>${lastDate}</strong>
          </div>

          <div class="item">
            <span>Людей</span>
            <strong>${people}</strong>
          </div>

          <div class="item">
            <span>Техники</span>
            <strong>${equipment}</strong>
          </div>
        `
      : '<div class="muted">Нет данных</div>';
}


function matrixFiltered() {

  return activeFronts()
    .map(hydrateFront)
    .filter(
      front =>
        (
          $('mfBuilding').value ===
            'all' ||
          front.structure.buildingId ===
            $('mfBuilding').value
        ) &&
        (
          $('mfBlock').value ===
            'all' ||
          front.block ===
            $('mfBlock').value
        ) &&
        (
          $('mfFloor').value ===
            'all' ||
          String(front.floor) ===
            $('mfFloor').value
        ) &&
        (
          $('mfWork').value ===
            'all' ||
          front.workId ===
            $('mfWork').value
        ) &&
        (
          $('mfOrg').value ===
            'all' ||
          front.organizationId ===
            $('mfOrg').value
        ) &&
        (
          $('mfStatus').value ===
            'all' ||
          front.status ===
            $('mfStatus').value
        )
    );
}


function renderMatrix() {

  updateMatrixDependent();

  $('matrixHead').innerHTML =
    `
      <tr>
        <th>Здание</th>
        <th>Блок</th>
        <th>Этаж</th>
        <th>Захватка</th>
        <th>Ось</th>
        <th>Сторона</th>
        <th>Зона</th>
        <th>Работа</th>
        <th>Организация</th>
        <th>Статус</th>
        <th>Объем</th>
        <th>Выполнено</th>
        <th></th>
      </tr>
    `;

  $('matrixBody').innerHTML =
    matrixFiltered()
      .map(
        front =>
          `
            <tr class="${statusRowClass(front.status)}">

              <td>${esc(front.building)}</td>
              <td>${esc(front.block)}</td>
              <td>${esc(front.floor)}</td>
              <td>${esc(front.capture)}</td>
              <td>${esc(front.axis)}</td>
              <td>${esc(front.side)}</td>
              <td>${esc(front.zone)}</td>
              <td>${esc(front.work)}</td>
              <td>${esc(front.organization)}</td>

              <td>
                <span class="badge">
                  ${esc(front.status || '')}
                </span>
              </td>

              <td>
                ${fmt(front.totalQty)}
                ${esc(front.unit || '')}
              </td>

              <td>
                ${fmt(front.doneQty)}
                ${esc(front.unit || '')}
              </td>

              <td>
                <button
                  class="row-btn"
                  data-edit-front="${front.id}">
                  Открыть
                </button>
              </td>

            </tr>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-edit-front]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openFrontEditor(
              button.dataset.editFront
            );
      }
    );
}


function openModal(
  title,
  html
) {

  $('modalTitle').textContent =
    title;

  $('modalBody').innerHTML =
    html;

  $('modal')
    .classList
    .remove('hidden');
}


function closeModal() {

  $('modal')
    .classList
    .add('hidden');

  $('modalBody').innerHTML =
    '';
}


function selectOptions(
  list,
  value,
  allowBlank = false
) {

  return `
    ${
      allowBlank
        ? '<option value="">—</option>'
        : ''
    }

    ${
      list
        .filter(
          item =>
            item.active !== false
        )
        .map(
          item =>
            `
              <option
                value="${item.id}"
                ${
                  String(item.id) ===
                  String(value)
                    ? 'selected'
                    : ''
                }>
                ${esc(item.name)}
              </option>
            `
        )
        .join('')
    }
  `;
}


function frontForm(
  front = {}
) {

  const structure =
    front.id
      ? byId(
          project.structures,
          front.structureId
        ) || {}
      : {};

  return `
    <div class="form-grid">

      <div class="field">
        <label>Здание</label>
        <select id="eBuilding">
          ${selectOptions(
            project.buildings,
            structure.buildingId
          )}
        </select>
      </div>

      <div class="field">
        <label>Блок</label>
        <input id="eBlock" value="${esc(structure.block || '')}">
      </div>

      <div class="field">
        <label>Этаж</label>
        <input id="eFloor" value="${esc(structure.floor ?? '')}">
      </div>

      <div class="field">
        <label>Захватка</label>
        <input id="eCapture" value="${esc(structure.capture || '')}">
      </div>

      <div class="field">
        <label>Ось</label>
        <input id="eAxis" value="${esc(structure.axis || '')}">
      </div>

      <div class="field">
        <label>Сторона</label>
        <input id="eSide" value="${esc(structure.side || '')}">
      </div>

      <div class="field">
        <label>Зона</label>
        <input id="eZone" value="${esc(structure.zone || '')}">
      </div>

      <div class="field">
        <label>№ помещения</label>
        <input id="eRoomNo" value="${esc(structure.roomNo || '')}">
      </div>

      <div class="field">
        <label>Помещение</label>
        <input id="eRoomName" value="${esc(structure.roomName || '')}">
      </div>

      <div class="field">
        <label>Вид работы</label>
        <select id="eWork">
          ${selectOptions(
            project.works,
            front.workId
          )}
        </select>
      </div>

      <div class="field">
        <label>Организация</label>
        <select id="eOrg">
          ${selectOptions(
            project.organizations,
            front.organizationId,
            true
          )}
        </select>
      </div>

      <div class="field">
        <label>Ответственный</label>
        <input id="eResponsible" value="${esc(front.responsible || '')}">
      </div>

      <div class="field">
        <label>Статус</label>

        <select id="eStatus">
          ${
            STATUS_LIST
              .map(
                status =>
                  `
                    <option
                      ${
                        status ===
                        (
                          front.status ||
                          'Не начато'
                        )
                          ? 'selected'
                          : ''
                      }>
                      ${status}
                    </option>
                  `
              )
              .join('')
          }
        </select>
      </div>

      <div class="field">
        <label>Ед. изм.</label>
        <input id="eUnit" value="${esc(front.unit || '')}">
      </div>

      <div class="field">
        <label>Общий объем</label>
        <input
          id="eTotal"
          type="number"
          step="any"
          value="${front.totalQty ?? ''}">
      </div>

      <div class="field">
        <label>Накопительно выполнено</label>
        <input
          id="eDone"
          type="number"
          step="any"
          value="${front.doneQty ?? ''}">
      </div>

      <div class="field">
        <label>Договор начало</label>
        <input
          id="eContractStart"
          type="date"
          value="${front.contractStart || ''}">
      </div>

      <div class="field">
        <label>Договор окончание</label>
        <input
          id="eContractEnd"
          type="date"
          value="${front.contractEnd || ''}">
      </div>

      <div class="field">
        <label>База начало</label>
        <input
          id="eBaselineStart"
          type="date"
          value="${front.baselineStart || ''}">
      </div>

      <div class="field">
        <label>База окончание</label>
        <input
          id="eBaselineEnd"
          type="date"
          value="${front.baselineEnd || ''}">
      </div>

      <div class="field">
        <label>Рабочий план начало</label>
        <input
          id="ePlanStart"
          type="date"
          value="${front.planStart || ''}">
      </div>

      <div class="field">
        <label>Рабочий план окончание</label>
        <input
          id="ePlanEnd"
          type="date"
          value="${front.planEnd || ''}">
      </div>

      <div class="field">
        <label>Факт начало</label>
        <input
          id="eFactStart"
          type="date"
          value="${front.factStart || ''}">
      </div>

      <div class="field">
        <label>Факт окончание</label>
        <input
          id="eFactEnd"
          type="date"
          value="${front.factEnd || ''}">
      </div>

      <div class="field">
        <label>Прогноз окончание</label>
        <input
          id="eForecastEnd"
          type="date"
          value="${front.forecastEnd || ''}">
      </div>

    </div>

    <div class="field">
      <label>Ограничение</label>
      <textarea id="eConstraint">${esc(front.constraint || '')}</textarea>
    </div>

    <div class="field">
      <label>Комментарий / факт</label>
      <textarea id="eComment">${esc(front.comment || '')}</textarea>
    </div>

    <div class="editor-actions">

      <button
        id="deleteFront"
        class="btn danger"
        ${
          front.id
            ? ''
            : 'style="display:none"'
        }>
        Архивировать
      </button>

      <button
        id="saveFront"
        class="btn primary">
        Сохранить
      </button>

    </div>
  `;
}


function openFrontEditor(
  id = null
) {

  const front =
    id
      ? byId(
          project.fronts,
          id
        )
      : {};

  openModal(
    id
      ? 'Карточка фронта'
      : 'Новый фронт',

    frontForm(front)
  );

  $('saveFront').onclick =
    () =>
      saveFrontFromModal(id);

  if (id) {
    $('deleteFront').onclick =
      () =>
        archiveFront(id);
  }
}


function structureSignature(structure) {

  return [
    structure.buildingId || '',
    structure.block || '',
    structure.floor ?? '',
    structure.capture || '',
    structure.axis || '',
    structure.side || '',
    structure.zone || '',
    structure.roomNo || '',
    structure.roomName || ''
  ]
    .map(normKey)
    .join('|');
}


async function saveFrontFromModal(id) {

  const buildingId =
    $('eBuilding').value;

  let structure =
    id
      ? byId(
          project.structures,

          byId(
            project.fronts,
            id
          )?.structureId
        )
      : null;

  if (!structure) {

    structure = {
      id:
        uid('STR'),

      buildingId
    };

    project.structures.push(
      structure
    );
  }

  Object.assign(
    structure,
    {
      buildingId,

      block:
        $('eBlock')
          .value
          .trim(),

      floor:
        $('eFloor')
          .value
          .trim(),

      capture:
        $('eCapture')
          .value
          .trim(),

      axis:
        $('eAxis')
          .value
          .trim(),

      side:
        $('eSide')
          .value
          .trim(),

      zone:
        $('eZone')
          .value
          .trim(),

      roomNo:
        $('eRoomNo')
          .value
          .trim(),

      roomName:
        $('eRoomName')
          .value
          .trim()
    }
  );

  structure.signature =
    structureSignature(
      structure
    );

  let front =
    id
      ? byId(
          project.fronts,
          id
        )
      : {
          id:
            uid('F'),

          structureId:
            structure.id,

          createdAt:
            nowIso(),

          active:
            true
        };

  Object.assign(
    front,
    {
      active:
        true,

      structureId:
        structure.id,

      workId:
        $('eWork').value,

      organizationId:
        $('eOrg').value,

      responsible:
        $('eResponsible')
          .value
          .trim(),

      status:
        $('eStatus').value,

      unit:
        $('eUnit')
          .value
          .trim(),

      totalQty:
        num(
          $('eTotal').value
        ),

      doneQty:
        num(
          $('eDone').value
        ),

      contractStart:
        $('eContractStart').value,

      contractEnd:
        $('eContractEnd').value,

      baselineStart:
        $('eBaselineStart').value,

      baselineEnd:
        $('eBaselineEnd').value,

      planStart:
        $('ePlanStart').value,

      planEnd:
        $('ePlanEnd').value,

      factStart:
        $('eFactStart').value,

      factEnd:
        $('eFactEnd').value,

      forecastEnd:
        $('eForecastEnd').value,

      constraint:
        $('eConstraint')
          .value
          .trim(),

      comment:
        $('eComment')
          .value
          .trim(),

      completed:
        $('eStatus').value ===
          'Завершено',

      accepted:
        front.accepted ||
        false,

      updatedAt:
        nowIso()
    }
  );

  if (!id) {
    project.fronts.push(
      front
    );
  }

  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Фронт',

    frontLabel(front)
  );

  await saveProject();

  closeModal();

  renderAll();
}


async function archiveFront(id) {

  if (
    !confirm(
      'Архивировать фронт? История плана и факта останется в базе.'
    )
  ) {
    return;
  }

  const front =
    byId(
      project.fronts,
      id
    );

  if (!front) {
    return;
  }

  front.active =
    false;

  front.archivedAt =
    nowIso();

  log(
    'Архивировано',
    'Фронт',
    frontLabel(front)
  );

  await saveProject();

  closeModal();

  renderAll();
}


function modeDates(
  front,
  mode
) {

  if (
    mode ===
    'contract'
  ) {
    return [
      front.contractStart,
      front.contractEnd
    ];
  }

  if (
    mode ===
    'baseline'
  ) {
    return [
      front.baselineStart,
      front.baselineEnd
    ];
  }

  if (
    mode ===
    'fact'
  ) {
    return [
      front.factStart,

      front.factEnd ||
      front.factStart
    ];
  }

  if (
    mode ===
    'forecast'
  ) {
    return [
      front.planStart ||
      front.factStart,

      front.forecastEnd ||
      front.planEnd
    ];
  }

  return [
    front.planStart,
    front.planEnd
  ];
}


function renderGantt() {

  const buildingId =
    $('gBuilding').value;

  const workId =
    $('gWork').value;

  const mode =
    $('gMode').value;

  const items =
    activeFronts()
      .map(hydrateFront)
      .filter(
        front =>
          (
            buildingId ===
              'all' ||
            front.structure
              .buildingId ===
              buildingId
          ) &&
          (
            workId ===
              'all' ||
            front.workId ===
              workId
          )
      )
      .map(
        front => ({
          front,

          dates:
            modeDates(
              front,
              mode
            )
        })
      )
      .filter(
        item =>
          item.dates[0] &&
          item.dates[1]
      );

  if (!items.length) {

    $('gantt').innerHTML =
      '<div class="muted">Нет заполненных дат для выбранного слоя.</div>';

    return;
  }

  const min =
    items
      .map(
        item =>
          item.dates[0]
      )
      .sort()[0];

  const max =
    items
      .map(
        item =>
          item.dates[1]
      )
      .sort()
      .slice(-1)[0];

  const total =
    Math.max(
      1,

      diffDays(
        min,
        max
      ) + 1
    );

  $('gantt').innerHTML =
    items
      .map(
        item => {

          const left =
            diffDays(
              min,
              item.dates[0]
            ) /
            total *
            100;

          const width =
            Math.max(
              1,

              (
                diffDays(
                  item.dates[0],
                  item.dates[1]
                ) + 1
              ) /
              total *
              100
            );

          return `
            <div class="gantt-row">

              <div class="gantt-name">
                <b>
                  ${esc(item.front.work)}
                </b>

                <br>

                <small>
                  ${esc(frontLabel(item.front))}
                </small>
              </div>

              <div class="gantt-line">

                <div
                  class="gantt-bar"
                  style="left:${left}%;width:${width}%">

                  ${item.dates[0]}
                  →
                  ${item.dates[1]}

                </div>

              </div>

            </div>
          `;
        }
      )
      .join('');
}


function pfFrontIds() {

  const buildingId =
    $('pfBuilding').value;

  const workId =
    $('pfWork').value;

  return new Set(
    activeFronts()
      .filter(
        front => {

          const structure =
            byId(
              project.structures,
              front.structureId
            );

          return (
            buildingId ===
              'all' ||
            structure?.buildingId ===
              buildingId
          ) &&
          (
            workId ===
              'all' ||
            front.workId ===
              workId
          );
        }
      )
      .map(
        front =>
          front.id
      )
  );
}


function renderPlanFact() {

  const ids =
    pfFrontIds();

  const from =
    $('pfFrom').value;

  const to =
    $('pfTo').value;

  const inPeriod =
    row =>
      ids.has(
        row.frontId
      ) &&
      (
        !from ||
        row.date >= from
      ) &&
      (
        !to ||
        row.date <= to
      );

  const plan =
    project.planLog
      .filter(inPeriod);

  const fact =
    project.factLog
      .filter(inPeriod);

  const planPeriod =
    plan.reduce(
      (sum, row) =>
        sum +
        num(row.qty),
      0
    );

  const factPeriod =
    fact.reduce(
      (sum, row) =>
        sum +
        num(row.qty),
      0
    );

  const planCumulative =
    project.planLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&
          (
            !to ||
            row.date <= to
          )
      )
      .reduce(
        (sum, row) =>
          sum +
          num(row.qty),
        0
      );

  const factCumulative =
    project.factLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&
          (
            !to ||
            row.date <= to
          )
      )
      .reduce(
        (sum, row) =>
          sum +
          num(row.qty),
        0
      );

  const total =
    activeFronts()
      .filter(
        front =>
          ids.has(
            front.id
          )
      )
      .reduce(
        (sum, front) =>
          sum +
          num(
            front.totalQty
          ),
        0
      );

  $('pfPlanPeriod').textContent =
    fmt(planPeriod);

  $('pfFactPeriod').textContent =
    fmt(factPeriod);

  $('pfVarPeriod').textContent =
    fmt(
      factPeriod -
      planPeriod
    );

  $('pfPlanCum').textContent =
    fmt(planCumulative);

  $('pfFactCum').textContent =
    fmt(factCumulative);

  $('pfPp').textContent =
    fmt(
      total
        ? (
            factCumulative /
              total -
            planCumulative /
              total
          ) * 100
        : 0
    );

  $('planRows').innerHTML =
    [...plan]
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      )
      .map(
        row =>
          `
            <tr>
              <td>${row.date}</td>

              <td>
                ${esc(
                  frontLabel(
                    byId(
                      project.fronts,
                      row.frontId
                    )
                  )
                )}
              </td>

              <td>${fmt(row.qty)}</td>
              <td>${fmt(row.people)}</td>
            </tr>
          `
      )
      .join('');

  $('factRows').innerHTML =
    [...fact]
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      )
      .map(
        row =>
          `
            <tr>
              <td>${row.date}</td>

              <td>
                ${esc(
                  frontLabel(
                    byId(
                      project.fronts,
                      row.frontId
                    )
                  )
                )}
              </td>

              <td>${fmt(row.qty)}</td>
              <td>${fmt(row.cumulative)}</td>
              <td>${fmt(row.people)}</td>
            </tr>
          `
      )
      .join('');
}


function openLogEditor(mode) {

  const frontOptions =
    activeFronts()
      .map(
        front =>
          `
            <option value="${front.id}">
              ${esc(frontLabel(front))}
            </option>
          `
      )
      .join('');

  openModal(
    mode === 'plan'
      ? 'Добавить план'
      : 'Добавить факт',

    `
      <div class="form-grid">

        <div class="field">
          <label>Фронт</label>

          <select id="lFront">
            ${frontOptions}
          </select>
        </div>

        <div class="field">
          <label>Дата</label>
          <input id="lDate" type="date" value="${today()}">
        </div>

        <div class="field">
          <label>Объем</label>
          <input id="lQty" type="number" step="any">
        </div>

        <div class="field">
          <label>Люди</label>
          <input id="lPeople" type="number">
        </div>

        ${
          mode === 'fact'
            ? `
                <div class="field">
                  <label>
                    Накопительный итог
                    (если пусто — посчитается)
                  </label>

                  <input
                    id="lCum"
                    type="number"
                    step="any">
                </div>
              `
            : ''
        }

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="lComment"></textarea>
      </div>

      <div class="editor-actions">

        <button
          id="lSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );

  $('lSave').onclick =
    () =>
      saveLog(mode);
}


async function saveLog(mode) {

  const frontId =
    $('lFront').value;

  const date =
    $('lDate').value;

  const quantity =
    num(
      $('lQty').value
    );

  const people =
    num(
      $('lPeople').value
    );

  const comment =
    $('lComment')
      .value
      .trim();

  if (
    !frontId ||
    !date
  ) {

    alert(
      'Укажи фронт и дату.'
    );

    return;
  }

  if (
    mode ===
    'plan'
  ) {

    project.planLog.push({

      id:
        uid('P'),

      frontId,

      date,

      qty:
        quantity,

      people,

      comment,

      createdAt:
        nowIso()
    });

    log(
      'Добавлено',
      'План',

      `${date} · ${frontLabel(
        byId(
          project.fronts,
          frontId
        )
      )} · ${quantity}`
    );

  } else {

    const current =
      project.factLog
        .filter(
          row =>
            row.frontId ===
              frontId &&
            row.date <=
              date
        )
        .reduce(
          (sum, row) =>
            sum +
            num(row.qty),
          0
        );

    const cumulative =
      $('lCum').value === ''
        ? current +
          quantity
        : num(
            $('lCum').value
          );

    project.factLog.push({

      id:
        uid('FCT'),

      frontId,

      date,

      qty:
        quantity,

      cumulative,

      people,

      comment,

      createdAt:
        nowIso()
    });

    const front =
      byId(
        project.fronts,
        frontId
      );

    front.doneQty =
      Math.max(
        num(front.doneQty),
        cumulative
      );

    if (
      !front.factStart ||
      date <
        front.factStart
    ) {
      front.factStart =
        date;
    }

    front.updatedAt =
      nowIso();

    log(
      'Добавлено',
      'Факт',
      `${date} · ${frontLabel(front)} · ${quantity}`
    );
  }

  await saveProject();

  closeModal();

  renderAll();
}


function resourceFiltered() {

  const from =
    $('rFrom').value;

  const to =
    $('rTo').value;

  const organizationId =
    $('rOrg').value;

  const buildingId =
    $('rBuilding').value;

  return project.resources
    .filter(
      row =>
        (
          !from ||
          row.date >= from
        ) &&
        (
          !to ||
          row.date <= to
        ) &&
        (
          organizationId ===
            'all' ||
          row.organizationId ===
            organizationId
        ) &&
        (
          buildingId ===
            'all' ||
          row.buildingId ===
            buildingId
        )
    );
}


function renderResources() {

  const rows =
    resourceFiltered();

  const sum =
    field =>
      rows.reduce(
        (total, row) =>
          total +
          num(
            row[field]
          ),
        0
      );

  const daily =
    {};

  rows.forEach(
    row => {

      daily[row.date] =
        (
          daily[row.date] ||
          0
        ) +
        num(row.itr) +
        num(row.workers) +
        num(row.mechanizers);
    }
  );

  $('rItr').textContent =
    sum('itr');

  $('rWorkers').textContent =
    sum('workers');

  $('rMech').textContent =
    sum('mechanizers');

  $('rTotalPeople').textContent =
    sum('itr') +
    sum('workers') +
    sum('mechanizers');

  $('rPeak').textContent =
    Math.max(
      0,
      ...Object.values(daily)
    );

  $('rEquipDays').textContent =
    sum('equipmentQty');

  $('resourceRows').innerHTML =
    [...rows]
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      )
      .map(
        row =>
          `
            <tr>

              <td>
                ${row.date}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    row.organizationId
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.buildings,
                    row.buildingId
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.works,
                    row.workId
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  row.frontId
                    ? frontLabel(
                        byId(
                          project.fronts,
                          row.frontId
                        )
                      )
                    : '—'
                )}
              </td>

              <td>${num(row.itr)}</td>
              <td>${num(row.workers)}</td>
              <td>${num(row.mechanizers)}</td>

              <td>
                ${esc(
                  row.equipmentType ||
                  ''
                )}
              </td>

              <td>
                ${num(row.equipmentQty)}
              </td>

              <td>
                ${esc(
                  row.comment ||
                  ''
                )}
              </td>

            </tr>
          `
      )
      .join('');
}


function openResourceEditor() {

  const frontOptions =
    activeFronts()
      .map(
        front =>
          `
            <option value="${front.id}">
              ${esc(frontLabel(front))}
            </option>
          `
      )
      .join('');

  openModal(
    'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">
          <label>Дата</label>
          <input
            id="rrDate"
            type="date"
            value="${today()}">
        </div>

        <div class="field">
          <label>Организация</label>

          <select id="rrOrg">
            ${selectOptions(
              project.organizations,
              '',
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Здание (необязательно)</label>

          <select id="rrBuilding">
            ${selectOptions(
              project.buildings,
              '',
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Вид работ (необязательно)</label>

          <select id="rrWork">
            ${selectOptions(
              project.works,
              '',
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Фронт (необязательно)</label>

          <select id="rrFront">
            <option value="">—</option>
            ${frontOptions}
          </select>
        </div>

        <div class="field">
          <label>ИТР</label>
          <input id="rrItr" type="number">
        </div>

        <div class="field">
          <label>Рабочие</label>
          <input id="rrWorkers" type="number">
        </div>

        <div class="field">
          <label>Механизаторы</label>
          <input id="rrMech" type="number">
        </div>

        <div class="field">
          <label>Тип техники</label>
          <input id="rrEqType">
        </div>

        <div class="field">
          <label>Количество техники</label>
          <input id="rrEqQty" type="number">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rrComment"></textarea>
      </div>

      <div class="editor-actions">

        <button
          id="rrSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );

  $('rrSave').onclick =
    saveResource;
}


async function saveResource() {

  const row = {

    id:
      uid('R'),

    date:
      $('rrDate').value,

    organizationId:
      $('rrOrg').value,

    buildingId:
      $('rrBuilding').value,

    workId:
      $('rrWork').value,

    frontId:
      $('rrFront').value,

    itr:
      num(
        $('rrItr').value
      ),

    workers:
      num(
        $('rrWorkers').value
      ),

    mechanizers:
      num(
        $('rrMech').value
      ),

    equipmentType:
      $('rrEqType')
        .value
        .trim(),

    equipmentQty:
      num(
        $('rrEqQty').value
      ),

    comment:
      $('rrComment')
        .value
        .trim(),

    createdAt:
      nowIso()
  };

  if (!row.date) {

    alert(
      'Укажи дату.'
    );

    return;
  }

  project.resources.push(
    row
  );

  log(
    'Добавлено',
    'Ресурсы',

    `${row.date} · ${
      nameById(
        project.organizations,
        row.organizationId
      ) ||
      'без организации'
    }`
  );

  await saveProject();

  closeModal();

  renderAll();
}


function renderMilestones() {

  $('milestoneRows').innerHTML =
    project.milestones
      .map(
        milestone =>
          `
            <tr>

              <td>
                ${esc(
                  nameById(
                    project.buildings,
                    milestone.buildingId
                  )
                )}
              </td>

              <td>
                ${esc(
                  milestone.title ||
                  ''
                )}
              </td>

              <td>
                ${
                  milestone.contractDate ||
                  '—'
                }
              </td>

              <td>
                ${
                  milestone.workDate ||
                  '—'
                }
              </td>

              <td>
                ${
                  milestone.forecastDate ||
                  '—'
                }
              </td>

              <td>
                ${
                  milestone.factDate ||
                  '—'
                }
              </td>

              <td>
                <button
                  class="row-btn"
                  data-ms="${milestone.id}">
                  ${esc(
                    milestone.status ||
                    ''
                  )}
                </button>
              </td>

            </tr>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-ms]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openMilestoneEditor(
              button.dataset.ms
            );
      }
    );
}


function openMilestoneEditor(
  id = null
) {

  const milestone =
    id
      ? byId(
          project.milestones,
          id
        )
      : {};

  openModal(
    id
      ? 'Ключевая дата'
      : 'Новая ключевая дата',

    `
      <div class="form-grid">

        <div class="field">
          <label>Здание</label>

          <select id="mBuilding">
            ${selectOptions(
              project.buildings,
              milestone.buildingId,
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Наименование</label>
          <input
            id="mTitle"
            value="${esc(milestone.title || '')}">
        </div>

        <div class="field">
          <label>Статус</label>
          <input
            id="mStatus"
            value="${esc(
              milestone.status ||
              'Не наступила'
            )}">
        </div>

        <div class="field">
          <label>Договорная дата</label>
          <input
            id="mContract"
            type="date"
            value="${milestone.contractDate || ''}">
        </div>

        <div class="field">
          <label>Рабочая дата</label>
          <input
            id="mWork"
            type="date"
            value="${milestone.workDate || ''}">
        </div>

        <div class="field">
          <label>Прогноз</label>
          <input
            id="mForecast"
            type="date"
            value="${milestone.forecastDate || ''}">
        </div>

        <div class="field">
          <label>Факт</label>
          <input
            id="mFact"
            type="date"
            value="${milestone.factDate || ''}">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="mComment">${esc(milestone.comment || '')}</textarea>
      </div>

      <div class="editor-actions">
        <button
          id="mSave"
          class="btn primary">
          Сохранить
        </button>
      </div>
    `
  );

  $('mSave').onclick =
    () =>
      saveMilestone(id);
}


async function saveMilestone(id) {

  let milestone =
    id
      ? byId(
          project.milestones,
          id
        )
      : {
          id:
            uid('M'),

          createdAt:
            nowIso()
        };

  Object.assign(
    milestone,
    {
      buildingId:
        $('mBuilding').value,

      title:
        $('mTitle')
          .value
          .trim(),

      status:
        $('mStatus')
          .value
          .trim(),

      contractDate:
        $('mContract').value,

      workDate:
        $('mWork').value,

      forecastDate:
        $('mForecast').value,

      factDate:
        $('mFact').value,

      comment:
        $('mComment')
          .value
          .trim(),

      updatedAt:
        nowIso()
    }
  );

  if (!milestone.title) {

    alert(
      'Укажи наименование ключевой даты.'
    );

    return;
  }

  if (!id) {
    project.milestones.push(
      milestone
    );
  }

  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Ключевая дата',

    milestone.title
  );

  await saveProject();

  closeModal();

  renderAll();
}


function elementContextKey(element) {

  const scope =
    element.uniqueScope ||
    'context';

  const type =
    normKey(
      element.elementType
    );

  const number =
    normKey(
      element.elementNo
    );

  if (
    scope ===
    'project'
  ) {
    return [
      type,
      number
    ].join('|');
  }

  if (
    scope ===
    'building'
  ) {
    return [
      type,
      element.buildingId || '',
      number
    ].join('|');
  }

  return [
    type,
    element.buildingId || '',
    normKey(element.capture),
    normKey(element.zone),
    number
  ].join('|');
}


function findElementDuplicate(
  candidate,
  excludeId = ''
) {

  const key =
    elementContextKey(
      candidate
    );

  return project.numberedElements
    .find(
      element =>
        element.active !== false &&
        element.id !==
          excludeId &&
        elementContextKey(
          element
        ) === key
    );
}


function renderElements() {

  const buildingId =
    $('elBuilding').value;

  const type =
    $('elType').value;

  const search =
    normKey(
      $('elSearch').value
    );

  const rows =
    project.numberedElements
      .filter(
        element =>
          element.active !== false &&
          (
            buildingId ===
              'all' ||
            element.buildingId ===
              buildingId
          ) &&
          (
            type ===
              'all' ||
            element.elementType ===
              type
          ) &&
          (
            !search ||
            normKey(
              element.elementNo
            )
              .includes(search)
          )
      );

  $('elementRows').innerHTML =
    rows
      .map(
        element =>
          `
            <tr>

              <td>
                ${esc(element.elementType)}
              </td>

              <td>
                <b>
                  ${esc(element.elementNo)}
                </b>
              </td>

              <td>
                ${esc(
                  nameById(
                    project.buildings,
                    element.buildingId
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  element.capture ||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  element.zone ||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.works,
                    element.workId
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  element.status ||
                  ''
                )}
              </td>

              <td>
                ${esc(
                  element.comment ||
                  ''
                )}
              </td>

              <td>
                <button
                  class="row-btn"
                  data-el="${element.id}">
                  Открыть
                </button>
              </td>

            </tr>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-el]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openElementEditor(
              button.dataset.el
            );
      }
    );
}


function openElementEditor(
  id = null
) {

  const element =
    id
      ? byId(
          project.numberedElements,
          id
        )
      : {};

  const frontOptions =
    activeFronts()
      .map(
        front =>
          `
            <option
              value="${front.id}"
              ${
                front.id ===
                element.frontId
                  ? 'selected'
                  : ''
              }>
              ${esc(frontLabel(front))}
            </option>
          `
      )
      .join('');

  openModal(
    id
      ? 'Номерной элемент'
      : 'Новый номерной элемент',

    `
      <div class="form-grid">

        <div class="field">
          <label>Тип элемента</label>
          <input
            id="neType"
            value="${esc(element.elementType || '')}"
            placeholder="Свая / Анкер / Шпунт">
        </div>

        <div class="field">
          <label>Номер</label>
          <input
            id="neNo"
            value="${esc(element.elementNo || '')}">
        </div>

        <div class="field">
          <label>Область уникальности</label>

          <select id="neScope">

            <option
              value="context"
              ${
                ![
                  'project',
                  'building'
                ].includes(
                  element.uniqueScope
                )
                  ? 'selected'
                  : ''
              }>
              Здание + захватка + зона
            </option>

            <option
              value="building"
              ${
                element.uniqueScope ===
                  'building'
                  ? 'selected'
                  : ''
              }>
              В пределах здания
            </option>

            <option
              value="project"
              ${
                element.uniqueScope ===
                  'project'
                  ? 'selected'
                  : ''
              }>
              По всему проекту
            </option>

          </select>
        </div>

        <div class="field">
          <label>Здание</label>

          <select id="neBuilding">
            ${selectOptions(
              project.buildings,
              element.buildingId,
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Захватка</label>
          <input
            id="neCapture"
            value="${esc(element.capture || '')}">
        </div>

        <div class="field">
          <label>Зона / ряд</label>
          <input
            id="neZone"
            value="${esc(element.zone || '')}">
        </div>

        <div class="field">
          <label>Вид работ</label>

          <select id="neWork">
            ${selectOptions(
              project.works,
              element.workId,
              true
            )}
          </select>
        </div>

        <div class="field">
          <label>Статус</label>

          <select id="neStatus">
            ${
              ELEMENT_STATUS_LIST
                .map(
                  status =>
                    `
                      <option
                        ${
                          status ===
                          (
                            element.status ||
                            'Не начато'
                          )
                            ? 'selected'
                            : ''
                        }>
                        ${status}
                      </option>
                    `
                )
                .join('')
            }
          </select>
        </div>

        <div class="field">
          <label>Фронт (необязательно)</label>

          <select id="neFront">
            <option value="">—</option>
            ${frontOptions}
          </select>
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="neComment">${esc(element.comment || '')}</textarea>
      </div>

      <div class="editor-actions">

        <button
          id="neArchive"
          class="btn danger"
          ${
            id
              ? ''
              : 'style="display:none"'
          }>
          Архивировать
        </button>

        <button
          id="neSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );

  $('neSave').onclick =
    () =>
      saveElement(id);

  if (id) {
    $('neArchive').onclick =
      () =>
        archiveElement(id);
  }
}


async function saveElement(id) {

  const candidate = {

    id:
      id ||
      uid('EL'),

    elementType:
      $('neType')
        .value
        .trim(),

    elementNo:
      $('neNo')
        .value
        .trim(),

    uniqueScope:
      $('neScope').value,

    buildingId:
      $('neBuilding').value,

    capture:
      $('neCapture')
        .value
        .trim(),

    zone:
      $('neZone')
        .value
        .trim(),

    workId:
      $('neWork').value,

    frontId:
      $('neFront').value,

    status:
      $('neStatus').value,

    comment:
      $('neComment')
        .value
        .trim(),

    active:
      true
  };

  if (
    !candidate.elementType ||
    !candidate.elementNo
  ) {

    alert(
      'Укажи тип элемента и номер.'
    );

    return;
  }

  const duplicate =
    findElementDuplicate(
      candidate,
      id || ''
    );

  if (duplicate) {

    alert(
      `Такой номер уже существует.\n` +
      `${duplicate.elementType} №${duplicate.elementNo}\n` +
      `${
        nameById(
          project.buildings,
          duplicate.buildingId
        ) || ''
      } ` +
      `${duplicate.capture || ''} ` +
      `${duplicate.zone || ''}`
    );

    return;
  }

  if (id) {

    Object.assign(
      byId(
        project.numberedElements,
        id
      ),
      candidate,
      {
        updatedAt:
          nowIso()
      }
    );

  } else {

    project.numberedElements.push({
      ...candidate,

      createdAt:
        nowIso()
    });
  }

  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Номерной элемент',

    `${candidate.elementType} №${candidate.elementNo}`
  );

  await saveProject();

  closeModal();

  renderAll();
}


async function archiveElement(id) {

  if (
    !confirm(
      'Архивировать номерной элемент?'
    )
  ) {
    return;
  }

  const element =
    byId(
      project.numberedElements,
      id
    );

  element.active =
    false;

  element.archivedAt =
    nowIso();

  log(
    'Архивировано',
    'Номерной элемент',

    `${element.elementType} №${element.elementNo}`
  );

  await saveProject();

  closeModal();

  renderAll();
}


function renderDemolition() {

  $('demolitionRows').innerHTML =
    project.demolition
      .filter(
        item =>
          item.active !== false
      )
      .map(
        item =>
          `
            <tr>

              <td>
                ${esc(item.name)}
              </td>

              <td>

                <select
                  class="dem-status"
                  data-dem="${item.id}">

                  ${
                    [
                      'Не начато',
                      'В работе',
                      'Завершено',
                      'Приостановлено',
                      'Ограничение'
                    ]
                      .map(
                        status =>
                          `
                            <option
                              ${
                                status ===
                                item.status
                                  ? 'selected'
                                  : ''
                              }>
                              ${status}
                            </option>
                          `
                      )
                      .join('')
                  }

                </select>

              </td>

              <td>
                <input
                  type="date"
                  data-dem-plan="${item.id}"
                  value="${item.planEnd || ''}">
              </td>

              <td>
                <input
                  type="date"
                  data-dem-forecast="${item.id}"
                  value="${item.forecastEnd || ''}">
              </td>

              <td>
                <input
                  type="date"
                  data-dem-fact="${item.id}"
                  value="${item.factEnd || ''}">
              </td>

              <td>
                <input
                  data-dem-comment="${item.id}"
                  value="${esc(item.comment || '')}">
              </td>

            </tr>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-dem]'
    )
    .forEach(
      element => {

        element.onchange =
          () =>
            saveDemolitionRow(
              element.dataset.dem
            );
      }
    );

  document
    .querySelectorAll(
      '[data-dem-plan],' +
      '[data-dem-forecast],' +
      '[data-dem-fact],' +
      '[data-dem-comment]'
    )
    .forEach(
      element => {

        element.onchange =
          () =>
            saveDemolitionRow(
              element.dataset.demPlan ||
              element.dataset.demForecast ||
              element.dataset.demFact ||
              element.dataset.demComment
            );
      }
    );
}


async function saveDemolitionRow(id) {

  const item =
    byId(
      project.demolition,
      id
    );

  if (!item) {
    return;
  }

  item.status =
    document.querySelector(
      `[data-dem="${CSS.escape(id)}"]`
    )?.value ||
    item.status;

  item.planEnd =
    document.querySelector(
      `[data-dem-plan="${CSS.escape(id)}"]`
    )?.value ||
    '';

  item.forecastEnd =
    document.querySelector(
      `[data-dem-forecast="${CSS.escape(id)}"]`
    )?.value ||
    '';

  item.factEnd =
    document.querySelector(
      `[data-dem-fact="${CSS.escape(id)}"]`
    )?.value ||
    '';

  item.comment =
    document.querySelector(
      `[data-dem-comment="${CSS.escape(id)}"]`
    )?.value ||
    '';

  item.updatedAt =
    nowIso();

  log(
    'Изменено',
    'Демонтаж',
    item.name
  );

  await saveProject();
}


function renderHistory() {

  $('historyRows').innerHTML =
    project.history
      .slice(
        0,
        1000
      )
      .map(
        item =>
          `
            <tr>

              <td class="nowrap">
                ${new Date(
                  item.at
                ).toLocaleString(
                  'ru-RU'
                )}
              </td>

              <td>
                ${esc(item.action)}
              </td>

              <td>
                ${esc(item.entity)}
              </td>

              <td>
                ${esc(item.description)}
              </td>

            </tr>
          `
      )
      .join('');
}


function renderSettings() {

  const renderList =
    list =>
      list
        .map(
          item =>
            `
              <div class="item">

                <span>
                  ${esc(item.name)}
                  ${
                    item.unit
                      ? ` · ${esc(item.unit)}`
                      : ''
                  }
                </span>

                <small>
                  ${
                    item.active === false
                      ? 'архив'
                      : 'активно'
                  }
                </small>

              </div>
            `
        )
        .join('');

  $('buildingList').innerHTML =
    renderList(
      project.buildings
    );

  $('workList').innerHTML =
    renderList(
      project.works
    );

  $('orgList').innerHTML =
    renderList(
      project.organizations
    );

  $('projectMeta').innerHTML =
    `
      <div class="item">
        <span>Версия структуры</span>
        <strong>${esc(project.schemaVersion)}</strong>
      </div>

      <div class="item">
        <span>Последнее изменение</span>
        <strong>
          ${new Date(
            project.meta.updatedAt
          ).toLocaleString('ru-RU')}
        </strong>
      </div>

      <div class="item">
        <span>Последняя резервная копия</span>

        <strong>
          ${
            project.meta.lastBackupAt
              ? new Date(
                  project.meta.lastBackupAt
                ).toLocaleString(
                  'ru-RU'
                )
              : 'не создавалась'
          }
        </strong>
      </div>

      <div class="item">
        <span>Фронтов</span>
        <strong>${activeFronts().length}</strong>
      </div>

      <div class="item">
        <span>Записей факта</span>
        <strong>${project.factLog.length}</strong>
      </div>

      <div class="item">
        <span>Номерных элементов</span>

        <strong>
          ${
            project.numberedElements
              .filter(
                item =>
                  item.active !== false
              )
              .length
          }
        </strong>
      </div>

      <div class="item">
        <span>Импортов</span>
        <strong>${project.importHistory.length}</strong>
      </div>
    `;
}


async function addSimple(type) {

  const config = {

    building: [
      'newBuilding',
      project.buildings,
      'BLD'
    ],

    work: [
      'newWork',
      project.works,
      'WRK'
    ],

    org: [
      'newOrg',
      project.organizations,
      'ORG'
    ]

  }[type];

  const [
    inputId,
    list,
    prefix
  ] = config;

  const input =
    $(inputId);

  const name =
    input.value.trim();

  if (!name) {
    return;
  }

  if (
    list.some(
      item =>
        sameText(
          item.name,
          name
        )
    )
  ) {

    alert(
      'Такая запись уже есть.'
    );

    return;
  }

  list.push({

    id:
      uid(prefix),

    name,

    active:
      true
  });

  input.value =
    '';

  log(
    'Создано',
    'Справочник',
    name
  );

  await saveProject();

  renderAll();
}


function renderBackupNotice() {

  const last =
    project?.meta
      ?.lastBackupAt;

  const version =
    ` · структура ${project?.schemaVersion || '—'}`;

  if (!last) {

    $('backupNotice').textContent =
      'Резервная копия проекта еще не создавалась' +
      version;

    return;
  }

  const days =
    Math.floor(
      (
        Date.now() -
        Date.parse(last)
      ) /
      86400000
    );

  $('backupNotice').textContent =
    `Последняя резервная копия: ` +
    `${new Date(last).toLocaleString('ru-RU')}` +
    `${
      days >= 7
        ? ' · рекомендуется создать новую копию'
        : ''
    }` +
    version;
}


async function exportBackup() {

  project.meta.lastBackupAt =
    nowIso();

  await saveProject();

  const payload = {

    ...clone(project),

    exportedAt:
      nowIso(),

    source:
      'ACONS Planning local'
  };

  download(
    `ACONS_Planning_${
      new Date()
        .toISOString()
        .slice(0, 16)
        .replace('T', '_')
        .replace(':', '-')
    }.json`,

    JSON.stringify(
      payload,
      null,
      2
    )
  );

  renderAll();
}


async function restoreProject(file) {

  try {

    const data =
      normalizeProject(
        JSON.parse(
          await file.text()
        )
      );

    if (
      !confirm(
        `Заменить текущий проект файлом?\n` +
        `Фронтов в файле: ${data.fronts.length}\n` +
        `Текущих фронтов: ${project.fronts.length}`
      )
    ) {
      return;
    }

    await dbPutKey(
      clone(project),
      `restore-backup-${Date.now()}`
    );

    project =
      data;

    log(
      'Восстановлено',
      'Проект',
      `Загружена резервная копия ${file.name}`
    );

    await saveProject();

    renderAll();

    alert(
      'Проект загружен.'
    );

  } catch (error) {

    alert(
      'Ошибка загрузки: ' +
      error.message
    );

  } finally {

    $('restoreInput').value =
      '';
  }
}


function compareCollections(
  current,
  incoming
) {

  const currentMap =
    new Map(
      (current || [])
        .map(
          item => [
            String(item.id),
            item
          ]
        )
    );

  const incomingMap =
    new Map(
      (incoming || [])
        .map(
          item => [
            String(item.id),
            item
          ]
        )
    );

  const added =
    [];

  const changed =
    [];

  const missing =
    [];

  for (
    const [
      id,
      row
    ]
    of incomingMap
  ) {

    if (
      !currentMap.has(id)
    ) {

      added.push(row);

    } else if (
      JSON.stringify(
        currentMap.get(id)
      ) !==
      JSON.stringify(row)
    ) {

      changed.push({

        before:
          currentMap.get(id),

        after:
          row
      });
    }
  }

  for (
    const [
      id,
      row
    ]
    of currentMap
  ) {

    if (
      !incomingMap.has(id)
    ) {
      missing.push(row);
    }
  }

  return {
    added,
    changed,
    missing
  };
}


function diffFields(
  before,
  after
) {

  const skip =
    new Set([
      'updatedAt',
      'createdAt',
      'exportedAt'
    ]);

  return uniq([
    ...Object.keys(
      before ||
      {}
    ),

    ...Object.keys(
      after ||
      {}
    )
  ])
    .filter(
      key =>
        !skip.has(key) &&
        JSON.stringify(
          before?.[key]
        ) !==
        JSON.stringify(
          after?.[key]
        )
    )
    .map(
      key => ({

        key,

        before:
          before?.[key],

        after:
          after?.[key]
      })
    );
}


function recordLabel(
  key,
  row
) {

  if (
    key ===
    'fronts'
  ) {
    return frontLabel(row);
  }

  if (
    key ===
      'factLog' ||
    key ===
      'planLog'
  ) {

    const front =
      byId(
        project.fronts,
        row.frontId
      ) ||
      byId(
        compareIncoming?.fronts ||
        [],
        row.frontId
      );

    return (
      `${row.date || ''} · ` +
      frontLabel(front)
    );
  }

  if (
    key ===
    'resources'
  ) {

    return (
      `${row.date || ''} · ` +
      (
        nameById(
          project.organizations,
          row.organizationId
        ) ||
        nameById(
          compareIncoming?.organizations ||
          [],
          row.organizationId
        ) ||
        'Ресурсы'
      )
    );
  }

  if (
    key ===
    'milestones'
  ) {
    return (
      row.title ||
      row.id
    );
  }

  if (
    key ===
    'numberedElements'
  ) {

    return (
      `${row.elementType || 'Элемент'} ` +
      `№${row.elementNo || ''}`
    );
  }

  if (
    key ===
    'demolition'
  ) {
    return (
      row.name ||
      row.id
    );
  }

  return (
    row.name ||
    row.title ||
    row.id
  );
}


async function compareProjectFile(file) {

  try {

    compareIncoming =
      normalizeProject(
        JSON.parse(
          await file.text()
        )
      );

    const sets = [
      ['fronts', 'Фронты'],
      ['structures', 'Структуры'],
      ['planLog', 'План'],
      ['factLog', 'Факт'],
      ['resources', 'Ресурсы'],
      ['milestones', 'Ключевые даты'],
      ['numberedElements', 'Номерные элементы'],
      ['demolition', 'Демонтаж'],
      ['buildings', 'Здания'],
      ['works', 'Виды работ'],
      ['organizations', 'Организации']
    ];

    compareItems =
      [];

    let added =
      0;

    let changed =
      0;

    let missing =
      0;

    for (
      const [
        key,
        label
      ]
      of sets
    ) {

      const comparison =
        compareCollections(
          project[key],
          compareIncoming[key]
        );

      added +=
        comparison.added.length;

      changed +=
        comparison.changed.length;

      missing +=
        comparison.missing.length;

      comparison.added
        .forEach(
          row =>
            compareItems.push({

              token:
                uid('CMP'),

              key,

              label,

              type:
                'added',

              id:
                row.id,

              after:
                row,

              diffs:
                []
            })
        );

      comparison.changed
        .forEach(
          pair =>
            compareItems.push({

              token:
                uid('CMP'),

              key,

              label,

              type:
                'changed',

              id:
                pair.after.id,

              before:
                pair.before,

              after:
                pair.after,

              diffs:
                diffFields(
                  pair.before,
                  pair.after
                )
            })
        );
    }

    const detail =
      compareItems
        .slice(
          0,
          500
        )
        .map(
          item =>
            `
              <div class="compare-record">

                <label>

                  <input
                    type="checkbox"
                    data-cmp="${item.token}"
                    checked>

                  <span>

                    <b>
                      ${
                        item.type ===
                          'added'
                          ? 'НОВОЕ'
                          : 'ИЗМЕНЕНО'
                      }
                      ·
                      ${esc(item.label)}
                    </b>

                    <br>

                    ${esc(
                      recordLabel(
                        item.key,
                        item.after
                      )
                    )}

                  </span>

                </label>

                ${
                  item.diffs.length
                    ? `
                        <small>
                          ${
                            item.diffs
                              .slice(
                                0,
                                8
                              )
                              .map(
                                diff =>
                                  `${esc(diff.key)}: ` +
                                  `${esc(String(diff.before ?? '—'))}` +
                                  ` → ` +
                                  `${esc(String(diff.after ?? '—'))}`
                              )
                              .join(' · ')
                          }
                        </small>
                      `
                    : ''
                }

              </div>
            `
        )
        .join('');

    openModal(
      'Сравнение проекта',

      `
        <p>
          <b>Файл:</b>
          ${esc(file.name)}
        </p>

        <div class="compare-summary">

          <div class="compare-box">
            <span>Новых</span>
            <h2>${added}</h2>
          </div>

          <div class="compare-box">
            <span>Изменено</span>
            <h2>${changed}</h2>
          </div>

          <div class="compare-box">
            <span>Есть только у меня</span>
            <h2>${missing}</h2>
          </div>

        </div>

        <div class="compare-details">
          ${
            detail ||
            '<div class="muted">Различий для применения нет.</div>'
          }
        </div>

        <p class="muted">
          Отметь изменения, которые нужно принять.
          Локальные записи, которых нет в файле коллеги,
          не удаляются.
        </p>

        <div class="editor-actions">

          <button
            id="acceptSelectedCompare"
            class="btn primary">
            Принять отмеченные
          </button>

          <button
            id="replaceCompare"
            class="btn danger">
            Заменить проект целиком
          </button>

        </div>
      `
    );

    $('acceptSelectedCompare').onclick =
      acceptSelectedCompared;

    $('replaceCompare').onclick =
      replaceCompared;

  } catch (error) {

    alert(
      'Ошибка сравнения: ' +
      error.message
    );

  } finally {

    $('compareInput').value =
      '';
  }
}


async function acceptSelectedCompared() {

  if (!compareIncoming) {
    return;
  }

  const selected =
    new Set(
      [
        ...document.querySelectorAll(
          '[data-cmp]:checked'
        )
      ]
        .map(
          checkbox =>
            checkbox.dataset.cmp
        )
    );

  const chosen =
    compareItems
      .filter(
        item =>
          selected.has(
            item.token
          )
      );

  chosen.forEach(
    item => {

      const list =
        project[item.key];

      const index =
        list.findIndex(
          row =>
            String(row.id) ===
            String(item.id)
        );

      if (
        index >= 0
      ) {

        list[index] =
          clone(
            item.after
          );

      } else {

        list.push(
          clone(
            item.after
          )
        );
      }
    }
  );

  log(
    'Сравнение',
    'Проект',
    `Принято изменений: ${chosen.length}`
  );

  await saveProject();

  compareIncoming =
    null;

  compareItems =
    [];

  closeModal();

  renderAll();

  alert(
    `Принято изменений: ${chosen.length}`
  );
}


async function replaceCompared() {

  if (
    !compareIncoming ||
    !confirm(
      'Полностью заменить текущий проект версией из файла?'
    )
  ) {
    return;
  }

  await dbPutKey(
    clone(project),
    `compare-replace-backup-${Date.now()}`
  );

  project =
    compareIncoming;

  log(
    'Заменено',
    'Проект',
    'Применена сравниваемая версия целиком'
  );

  await saveProject();

  compareIncoming =
    null;

  compareItems =
    [];

  closeModal();

  renderAll();
}


function normDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return (
      `${value.getFullYear()}-` +
      `${String(
        value.getMonth() + 1
      ).padStart(2, '0')}-` +
      `${String(
        value.getDate()
      ).padStart(2, '0')}`
    );
  }

  if (
    typeof value ===
      'number' &&
    value > 20000 &&
    value < 80000 &&
    window.XLSX
  ) {

    const parsed =
      XLSX.SSF.parse_date_code(
        value
      );

    if (parsed) {

      return (
        `${parsed.y}-` +
        `${String(parsed.m).padStart(2, '0')}-` +
        `${String(parsed.d).padStart(2, '0')}`
      );
    }
  }

  const text =
    normText(value);

  let match =
    text.match(
      /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/
    );

  if (match) {

    const year =
      match[3].length === 2
        ? '20' + match[3]
        : match[3];

    return (
      `${year}-` +
      `${match[2].padStart(2, '0')}-` +
      `${match[1].padStart(2, '0')}`
    );
  }

  match =
    text.match(
      /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/
    );

  if (match) {

    return (
      `${match[1]}-` +
      `${match[2].padStart(2, '0')}-` +
      `${match[3].padStart(2, '0')}`
    );
  }

  return '';
}


function ensureNamed(
  list,
  prefix,
  name,
  extra = {}
) {

  const clean =
    normText(name);

  if (!clean) {
    return null;
  }

  let item =
    list.find(
      row =>
        sameText(
          row.name,
          clean
        )
    );

  if (!item) {

    item = {

      id:
        uid(prefix),

      name:
        clean,

      active:
        true,

      ...extra
    };

    list.push(item);
  }

  return item;
}


function ensureStructure(data) {

  const candidate = {

    buildingId:
      data.buildingId || '',

    block:
      normText(data.block),

    floor:
      normText(data.floor),

    capture:
      normText(data.capture),

    axis:
      normText(data.axis),

    side:
      normText(data.side),

    zone:
      normText(data.zone),

    roomNo:
      normText(data.roomNo),

    roomName:
      normText(data.roomName)
  };

  const signature =
    structureSignature(
      candidate
    );

  let structure =
    project.structures
      .find(
        row =>
          (
            row.signature ||
            structureSignature(row)
          ) === signature
      );

  if (!structure) {

    structure = {

      id:
        uid('STR'),

      ...candidate,

      signature
    };

    project.structures.push(
      structure
    );

  } else if (
    !structure.signature
  ) {

    structure.signature =
      signature;
  }

  return structure;
}


const FIELD_DEFS = {

  building: {
    label:
      'Здание',

    aliases: [
      'здание',
      'объект',
      'сооружение',
      'корпус'
    ]
  },

  block: {
    label:
      'Блок',

    aliases: [
      'блок',
      'секция'
    ]
  },

  floor: {
    label:
      'Этаж',

    aliases: [
      'этаж',
      'уровень'
    ]
  },

  capture: {
    label:
      'Захватка',

    aliases: [
      'захватка',
      'номер захватки',
      '№ захватки',
      'блок/захватка',
      'блок захватка'
    ]
  },

  axis: {
    label:
      'Ось',

    aliases: [
      'ось',
      'оси'
    ]
  },

  side: {
    label:
      'Сторона',

    aliases: [
      'сторона',
      'фасад',
      'ось сторона'
    ]
  },

  zone: {
    label:
      'Зона',

    aliases: [
      'зона',
      'участок',
      'ряд'
    ]
  },

  roomNo: {
    label:
      '№ помещения',

    aliases: [
      '№ помещения',
      'номер помещения',
      'помещение №'
    ]
  },

  roomName: {
    label:
      'Помещение',

    aliases: [
      'помещение',
      'название помещения'
    ]
  },

  work: {
    label:
      'Работа',

    aliases: [
      'работа',
      'вид работы',
      'наименование работы',
      'название задачи',
      'наименование задачи',
      'вид работ'
    ]
  },

  organization: {
    label:
      'Организация',

    aliases: [
      'организация',
      'подрядчик',
      'субподрядчик',
      'исполнитель'
    ]
  },

  status: {
    label:
      'Статус',

    aliases: [
      'статус',
      'состояние'
    ]
  },

  unit: {
    label:
      'Ед. изм.',

    aliases: [
      'ед. изм.',
      'ед изм',
      'единица измерения',
      'единица'
    ]
  },

  totalQty: {
    label:
      'Общий объем',

    aliases: [
      'общий объем',
      'общий объём',
      'объем',
      'объём',
      'всего'
    ]
  },

  doneQty: {
    label:
      'Накопительный итог',

    aliases: [
      'накопительный итог',
      'выполнено накопительно',
      'накопительно',
      'факт накопительно'
    ]
  },

  contractStart: {
    label:
      'Договорное начало',

    aliases: [
      'договорное начало',
      'начало договор',
      'дата начала договор'
    ]
  },

  contractEnd: {
    label:
      'Договорное окончание',

    aliases: [
      'договорное окончание',
      'окончание договор',
      'дата окончания договор'
    ]
  },

  baselineStart: {
    label:
      'Базовое начало',

    aliases: [
      'базовое начало',
      'начало база'
    ]
  },

  baselineEnd: {
    label:
      'Базовое окончание',

    aliases: [
      'базовое окончание',
      'окончание база'
    ]
  },

  planStart: {
    label:
      'Рабочее/план начало',

    aliases: [
      'рабочее начало',
      'начало план',
      'план начало',
      'дата начала',
      'начало'
    ]
  },

  planEnd: {
    label:
      'Рабочее/план окончание',

    aliases: [
      'рабочее окончание',
      'окончание план',
      'план окончание',
      'дата окончания',
      'окончание'
    ]
  },

  factStart: {
    label:
      'Факт начало',

    aliases: [
      'начало факт',
      'факт начало',
      'фактическое начало',
      'дата начала факт'
    ]
  },

  factEnd: {
    label:
      'Факт окончание',

    aliases: [
      'окончание факт',
      'факт окончание',
      'фактическое окончание',
      'дата окончания факт'
    ]
  },

  forecastEnd: {
    label:
      'Прогноз окончание',

    aliases: [
      'прогнозное окончание',
      'прогноз окончания',
      'прогноз'
    ]
  },

  date: {
    label:
      'Дата',

    aliases: [
      'дата',
      'дата отчета',
      'дата отчёта',
      'отчетная дата',
      'отчётная дата'
    ]
  },

  qty: {
    label:
      'Факт за период',

    aliases: [
      'факт за период',
      'выполнено за период',
      'объем за день',
      'объём за день',
      'факт объем',
      'факт объём',
      'выполнено'
    ]
  },

  cumulative: {
    label:
      'Накопительно',

    aliases: [
      'накопительно',
      'накопительный итог',
      'выполнено накопительно'
    ]
  },

  people: {
    label:
      'Люди',

    aliases: [
      'люди',
      'рабочие всего',
      'численность',
      'количество людей'
    ]
  },

  peopleQty: {
    label:
      'Количество человек',

    aliases: [
      'количество человек',
      'кол-во человек',
      'кол во человек',
      'численность человек'
    ]
  },

  specialization: {
    label:
      'Специализация',

    aliases: [
      'специализация',
      'категория персонала',
      'категория работников',
      'вид персонала'
    ]
  },

  itr: {
    label:
      'ИТР',

    aliases: [
      'итр',
      'инженерно технические работники'
    ]
  },

  workers: {
    label:
      'Рабочие',

    aliases: [
      'рабочие',
      'рабочих'
    ]
  },

  mechanizers: {
    label:
      'Механизаторы',

    aliases: [
      'механизаторы',
      'машинисты'
    ]
  },

  equipmentType: {
    label:
      'Тип техники',

    aliases: [
      'тип техники',
      'техника',
      'механизм',
      'механизмы',
      'наименование техники'
    ]
  },

  equipmentQty: {
    label:
      'Количество техники',

    aliases: [
      'количество техники',
      'кол во техники',
      'кол. техники',
      'техника количество'
    ]
  },

  elementType: {
    label:
      'Тип элемента',

    aliases: [
      'тип элемента',
      'элемент',
      'вид элемента',
      'тип сваи',
      'тип анкера'
    ]
  },

  elementNo: {
    label:
      'Номер элемента',

    aliases: [
      'номер элемента',
      'порядковый номер',
      '№ элемента',
      'номер сваи',
      '№ сваи',
      'номер анкера',
      '№ анкера',
      'номер',
      'порядковые номера'
    ]
  },

  title: {
    label:
      'Наименование КД',

    aliases: [
      'ключевая дата',
      'контрольная дата',
      'наименование кд',
      'формулировка',
      'наименование'
    ]
  },

  comment: {
    label:
      'Комментарий',

    aliases: [
      'комментарий',
      'примечание',
      'описание'
    ]
  }
};


const MODE_FIELDS = {

  fronts: [
    'building',
    'block',
    'floor',
    'capture',
    'axis',
    'side',
    'zone',
    'roomNo',
    'roomName',
    'work',
    'organization',
    'status',
    'unit',
    'totalQty',
    'doneQty',
    'contractStart',
    'contractEnd',
    'baselineStart',
    'baselineEnd',
    'planStart',
    'planEnd',
    'factStart',
    'factEnd',
    'forecastEnd',
    'comment'
  ],

  fact: [
    'date',
    'building',
    'block',
    'floor',
    'capture',
    'axis',
    'side',
    'zone',
    'roomNo',
    'work',
    'organization',
    'qty',
    'cumulative',
    'people',
    'status',
    'comment'
  ],

  resources: [
    'date',
    'organization',
    'building',
    'work',
    'peopleQty',
    'specialization',
    'itr',
    'workers',
    'mechanizers',
    'equipmentType',
    'equipmentQty',
    'comment'
  ],

  elements: [
    'elementType',
    'elementNo',
    'building',
    'capture',
    'zone',
    'work',
    'status',
    'comment'
  ],

  milestones: [
    'title',
    'building',
    'contractEnd',
    'planEnd',
    'forecastEnd',
    'factEnd',
    'status',
    'comment'
  ]
};


const MODE_LABELS = {

  fronts:
    'Фронты / рабочий график',

  fact:
    'Факт выполненных работ',

  resources:
    'Ресурсы',

  elements:
    'Номерные элементы',

  milestones:
    'Ключевые даты'
};


function matchField(
  header,
  mode
) {

  const normalizedHeader =
    normKey(header);

  let best =
    '';

  let bestScore =
    0;

  for (
    const key
    of MODE_FIELDS[mode] ||
    []
  ) {

    const definition =
      FIELD_DEFS[key];

    for (
      const alias
      of [
        definition.label,
        ...definition.aliases
      ]
    ) {

      const normalizedAlias =
        normKey(alias);

      let score =
        0;

      if (
        normalizedHeader ===
        normalizedAlias
      ) {

        score =
          100;

      } else if (
        normalizedHeader.includes(
          normalizedAlias
        ) ||
        normalizedAlias.includes(
          normalizedHeader
        )
      ) {

        score =
          Math.min(
            normalizedHeader.length,
            normalizedAlias.length
          );
      }

      if (
        score >
        bestScore
      ) {

        bestScore =
          score;

        best =
          key;
      }
    }
  }

  return bestScore >= 4
    ? best
    : '';
}


function headerScore(row) {

  let score =
    0;

  for (
    const cell
    of row ||
    []
  ) {

    const normalized =
      normKey(cell);

    if (!normalized) {
      continue;
    }

    if (
      Object.values(
        FIELD_DEFS
      )
        .some(
          definition =>
            [
              definition.label,
              ...definition.aliases
            ]
              .some(
                alias =>
                  normKey(alias) ===
                  normalized
              )
        )
    ) {
      score++;
    }
  }

  return score;
}


function detectHeaderRow(matrix) {

  let best = {
    index:
      0,

    score:
      -1
  };

  for (
    let index = 0;
    index <
      Math.min(
        matrix.length,
        35
      );
    index++
  ) {

    const score =
      headerScore(
        matrix[index]
      );

    if (
      score >
      best.score
    ) {

      best = {
        index,
        score
      };
    }
  }

  return best.index;
}


function uniqueHeaders(row) {

  const used =
    new Map();

  return (
    row ||
    []
  )
    .map(
      (value, index) => {

        let header =
          normText(value) ||
          `Колонка ${index + 1}`;

        const count =
          (
            used.get(header) ||
            0
          ) + 1;

        used.set(
          header,
          count
        );

        if (
          count > 1
        ) {
          header =
            `${header} (${count})`;
        }

        return header;
      }
    );
}


function detectImportMode(headers) {

  const text =
    headers
      .map(normKey)
      .join(' | ');

  if (
    /итр|механизатор|количество техники|рабочие|количество человек|специализация/.test(text) &&
    /дата/.test(text)
  ) {
    return 'resources';
  }

  if (
    /порядковый номер|номер сваи|номер анкера|тип элемента/.test(text)
  ) {
    return 'elements';
  }

  if (
    /ключевая дата|контрольная дата|формулировка/.test(text)
  ) {
    return 'milestones';
  }

  if (
    /факт за период|объем за день|выполнено за период/.test(text) &&
    /дата/.test(text)
  ) {
    return 'fact';
  }

  return 'fronts';
}


function buildAutoMapping(mode) {

  const result =
    {};

  for (
    const header
    of importHeaders
  ) {

    const key =
      matchField(
        header,
        mode
      );

    result[header] =
      key &&
      !Object.values(result)
        .includes(key)
        ? key
        : '';
  }

  return result;
}


function mappingOptions(
  mode,
  selected
) {

  return `
    <option value="">
      Не использовать
    </option>

    ${
      (
        MODE_FIELDS[mode] ||
        []
      )
        .map(
          key =>
            `
              <option
                value="${key}"
                ${
                  key === selected
                    ? 'selected'
                    : ''
                }>
                ${esc(
                  FIELD_DEFS[key]
                    ?.label ||
                  key
                )}
              </option>
            `
        )
        .join('')
    }
  `;
}


function renderImportMapping() {

  $('importMappingCard')
    .classList
    .remove('hidden');

  $('importMapping').innerHTML =
    importHeaders
      .map(
        (header, index) =>
          `
            <div class="mapping-item">

              <b>
                ${esc(header)}
              </b>

              <select
                data-map-header="${index}">

                ${mappingOptions(
                  importModeResolved,
                  importMapping[header] ||
                  ''
                )}

              </select>

            </div>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-map-header]'
    )
    .forEach(
      select => {

        select.onchange =
          () => {

            const header =
              importHeaders[
                num(
                  select.dataset
                    .mapHeader
                )
              ];

            const chosen =
              select.value;

            if (chosen) {

              Object.keys(
                importMapping
              )
                .forEach(
                  key => {

                    if (
                      importMapping[key] ===
                      chosen
                    ) {
                      importMapping[key] =
                        '';
                    }
                  }
                );
            }

            importMapping[header] =
              chosen;

            renderImportMapping();
          };
      }
    );
}


function mappedValue(
  row,
  key
) {

  const header =
    Object.keys(
      importMapping
    )
      .find(
        item =>
          importMapping[item] ===
          key
      );

  return header
    ? row[header]
    : '';
}


function applyFillDown(
  rows,
  mode
) {

  if (
    !$('importFillDown').checked
  ) {
    return rows;
  }

  const keys =
    mode === 'fronts' ||
    mode === 'fact'
      ? [
          'building',
          'block',
          'work'
        ]
      : mode === 'elements'
        ? [
            'elementType',
            'building'
          ]
        : mode === 'resources'
          ? [
              'organization',
              'building'
            ]
          : [
              'building',
              'title'
            ];

  const last =
    {};

  return rows
    .map(
      row => {

        const output = {
          ...row
        };

        keys.forEach(
          key => {

            const header =
              Object.keys(
                importMapping
              )
                .find(
                  item =>
                    importMapping[item] ===
                    key
                );

            if (!header) {
              return;
            }

            if (
              normText(
                output[header]
              )
            ) {

              last[key] =
                output[header];

            } else if (
              last[key] !==
              undefined
            ) {

              output[header] =
                last[key];
            }
          }
        );

        return output;
      }
    );
}


function readSelectedSheet() {

  if (!importWorkbook) {
    return;
  }

  importSheetName =
    $('importSheet').value ||
    importWorkbook.SheetNames[0];

  const sheet =
    importWorkbook.Sheets[
      importSheetName
    ];

  const matrix =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header:
          1,

        defval:
          '',

        raw:
          true,

        blankrows:
          false
      }
    );

  const headerIndex =
    detectHeaderRow(matrix);

  importHeaders =
    uniqueHeaders(
      matrix[
        headerIndex
      ] || []
    );

  importRawRows =
    matrix
      .slice(
        headerIndex + 1
      )
      .filter(
        row =>
          row.some(
            value =>
              normText(value) !==
              ''
          )
      )
      .map(
        row =>
          Object.fromEntries(
            importHeaders.map(
              (header, index) => [
                header,
                row[index] ?? ''
              ]
            )
          )
      );
}


async function readImportFile(event) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  try {

    importWorkbook =
      XLSX.read(
        await file.arrayBuffer(),
        {
          type:
            'array',

          cellDates:
            true,

          cellNF:
            false,

          cellText:
            false
        }
      );

    importFileName =
      file.name;

    $('importSheet').innerHTML =
      importWorkbook.SheetNames
        .map(
          name =>
            `<option>${esc(name)}</option>`
        )
        .join('');

    $('importSheet').disabled =
      false;

    importSheetName =
      importWorkbook
        .SheetNames[0] ||
      '';

    $('analyzeImportBtn').disabled =
      !importSheetName;

    $('commitImportBtn').disabled =
      true;

    importMapping =
      {};

    importMappingMode =
      '';

    importRows =
      [];

    $('importInfo')
      .classList
      .remove('hidden');

    $('importInfo').className =
      'notice';

    $('importInfo').textContent =
      `Файл прочитан. ` +
      `Листов: ${importWorkbook.SheetNames.length}. ` +
      `Выбери лист и нажми «Анализировать».`;

    readSelectedSheet();

  } catch (error) {

    alert(
      'Ошибка чтения файла: ' +
      error.message
    );
  }
}


function findMatchingFrontByMapped(row) {

  const buildingName =
    normText(
      mappedValue(
        row,
        'building'
      )
    );

  const workName =
    normText(
      mappedValue(
        row,
        'work'
      )
    );

  if (
    !buildingName ||
    !workName
  ) {
    return null;
  }

  const building =
    project.buildings
      .find(
        item =>
          sameText(
            item.name,
            buildingName
          )
      );

  const work =
    project.works
      .find(
        item =>
          sameText(
            item.name,
            workName
          )
      );

  if (
    !building ||
    !work
  ) {
    return null;
  }

  const signature =
    structureSignature({

      buildingId:
        building.id,

      block:
        mappedValue(
          row,
          'block'
        ),

      floor:
        mappedValue(
          row,
          'floor'
        ),

      capture:
        mappedValue(
          row,
          'capture'
        ),

      axis:
        mappedValue(
          row,
          'axis'
        ),

      side:
        mappedValue(
          row,
          'side'
        ),

      zone:
        mappedValue(
          row,
          'zone'
        ),

      roomNo:
        mappedValue(
          row,
          'roomNo'
        ),

      roomName:
        mappedValue(
          row,
          'roomName'
        )
    });

  const structure =
    project.structures
      .find(
        item =>
          (
            item.signature ||
            structureSignature(item)
          ) ===
          signature
      );

  if (!structure) {
    return null;
  }

  return project.fronts
    .find(
      front =>
        front.active !== false &&
        front.structureId ===
          structure.id &&
        front.workId ===
          work.id
    ) ||
    null;
}


function previewImportRow(
  raw,
  index
) {

  const item = {

    raw,

    rowNumber:
      index + 1,

    status:
      '',

    message:
      '',

    selected:
      true,

    action:
      '',

    resolved:
      null
  };


  if (
    importModeResolved ===
    'fronts'
  ) {

    const building =
      normText(
        mappedValue(
          raw,
          'building'
        )
      );

    const work =
      normText(
        mappedValue(
          raw,
          'work'
        )
      );

    if (
      !building ||
      !work
    ) {

      Object.assign(
        item,
        {
          status:
            'Ошибка',

          message:
            'Нужны «Здание» и «Работа»',

          selected:
            false
        }
      );

    } else if (
      /ключев|контрольн/.test(
        normKey(work)
      )
    ) {

      Object.assign(
        item,
        {
          status:
            'Похоже на КД',

          message:
            'Не импортируется как обычный фронт',

          selected:
            false
        }
      );

    } else {

      const found =
        findMatchingFrontByMapped(
          raw
        );

      Object.assign(
        item,
        {
          status:
            found
              ? 'Обновление'
              : 'Новый фронт',

          message:
            found
              ? frontLabel(found)
              : `${building} · ${work}`,

          action:
            found
              ? 'update'
              : 'create',

          resolved:
            found
        }
      );
    }
  }


  if (
    importModeResolved ===
    'fact'
  ) {

    const date =
      normDate(
        mappedValue(
          raw,
          'date'
        )
      );

    const building =
      normText(
        mappedValue(
          raw,
          'building'
        )
      );

    const work =
      normText(
        mappedValue(
          raw,
          'work'
        )
      );

    if (
      !date ||
      !building ||
      !work
    ) {

      Object.assign(
        item,
        {
          status:
            'Ошибка',

          message:
            'Нужны дата, здание и работа',

          selected:
            false
        }
      );

    } else {

      const found =
        findMatchingFrontByMapped(
          raw
        );

      Object.assign(
        item,
        {
          status:
            found
              ? 'Добавить факт'
              : 'Новый фронт + факт',

          message:
            found
              ? frontLabel(found)
              : `${building} · ${work}`,

          action:
            found
              ? 'append'
              : 'create-front-and-append',

          resolved:
            found
        }
      );
    }
  }


  if (
    importModeResolved ===
    'resources'
  ) {

    const date =
      normDate(
        mappedValue(
          raw,
          'date'
        )
      );

    if (!date) {

      Object.assign(
        item,
        {
          status:
            'Ошибка',

          message:
            'Не распознана дата',

          selected:
            false
        }
      );

    } else {

      Object.assign(
        item,
        {
          status:
            'Добавить ресурсы',

          message:
            normText(
              mappedValue(
                raw,
                'organization'
              )
            ) ||
            'Без организации',

          action:
            'append'
        }
      );
    }
  }


  if (
    importModeResolved ===
    'elements'
  ) {

    const type =
      normText(
        mappedValue(
          raw,
          'elementType'
        )
      ) ||
      normText(
        mappedValue(
          raw,
          'work'
        )
      );

    const number =
      normText(
        mappedValue(
          raw,
          'elementNo'
        )
      );

    if (
      !type ||
      !number
    ) {

      Object.assign(
        item,
        {
          status:
            'Ошибка',

          message:
            'Нужны тип элемента и номер',

          selected:
            false
        }
      );

    } else {

      const buildingName =
        normText(
          mappedValue(
            raw,
            'building'
          )
        );

      const building =
        project.buildings
          .find(
            value =>
              sameText(
                value.name,
                buildingName
              )
          );

      const candidate = {

        elementType:
          type,

        elementNo:
          number,

        buildingId:
          building?.id ||
          '',

        capture:
          normText(
            mappedValue(
              raw,
              'capture'
            )
          ),

        zone:
          normText(
            mappedValue(
              raw,
              'zone'
            )
          ),

        uniqueScope:
          'context'
      };

      const duplicate =
        findElementDuplicate(
          candidate
        );

      if (duplicate) {

        Object.assign(
          item,
          {
            status:
              'Дубль',

            message:
              `Уже есть: ` +
              `${duplicate.elementType} ` +
              `№${duplicate.elementNo}`,

            selected:
              false
          }
        );

      } else {

        Object.assign(
          item,
          {
            status:
              'Новый элемент',

            message:
              `${type} №${number}`,

            action:
              'create'
          }
        );
      }
    }
  }


  if (
    importModeResolved ===
    'milestones'
  ) {

    const title =
      normText(
        mappedValue(
          raw,
          'title'
        )
      ) ||
      normText(
        mappedValue(
          raw,
          'work'
        )
      );

    if (!title) {

      Object.assign(
        item,
        {
          status:
            'Ошибка',

          message:
            'Не найдено наименование ключевой даты',

          selected:
            false
        }
      );

    } else {

      Object.assign(
        item,
        {
          status:
            'КД',

          message:
            title,

          action:
            'create-or-update'
        }
      );
    }
  }

  return item;
}


function analyzeImport() {

  if (
    !importWorkbook ||
    !importSheetName
  ) {
    return;
  }

  readSelectedSheet();

  const requested =
    $('importMode').value;

  const nextMode =
    requested === 'auto'
      ? detectImportMode(
          importHeaders
        )
      : requested;

  if (
    nextMode !==
      importMappingMode ||
    !Object.keys(
      importMapping
    ).length
  ) {

    importMapping =
      buildAutoMapping(
        nextMode
      );

    importMappingMode =
      nextMode;
  }

  importModeResolved =
    nextMode;

  renderImportMapping();

  importRows =
    applyFillDown(
      importRawRows,
      importModeResolved
    )
      .map(
        previewImportRow
      );

  renderImportPreview();
}


function renderImportPreview() {

  const counts =
    {};

  importRows.forEach(
    item => {

      counts[item.status] =
        (
          counts[item.status] ||
          0
        ) + 1;
    }
  );

  $('importInfo')
    .classList
    .remove('hidden');

  $('importInfo').className =
    'notice';

  $('importInfo').textContent =
    `Файл: ${importFileName}\n` +
    `Лист: ${importSheetName}\n` +
    `Режим: ${MODE_LABELS[importModeResolved]}\n` +
    `Строк после заголовка: ${importRows.length}\n` +
    `${
      Object.entries(counts)
        .map(
          ([key, value]) =>
            `${key}: ${value}`
        )
        .join(' · ')
    }`;

  $('importHead').innerHTML =
    `
      <tr>
        <th></th>
        <th>Строка</th>
        <th>Результат</th>
        <th>Что найдено</th>

        ${
          importHeaders
            .slice(
              0,
              10
            )
            .map(
              header =>
                `<th>${esc(header)}</th>`
            )
            .join('')
        }
      </tr>
    `;

  $('importBody').innerHTML =
    importRows
      .slice(
        0,
        200
      )
      .map(
        (item, index) =>
          `
            <tr>

              <td>
                <input
                  type="checkbox"
                  data-import-row="${index}"
                  ${item.selected ? 'checked' : ''}
                  ${
                    [
                      'Ошибка',
                      'Дубль'
                    ].includes(
                      item.status
                    )
                      ? 'disabled'
                      : ''
                  }>
              </td>

              <td>
                ${item.rowNumber}
              </td>

              <td>
                <span class="import-status">
                  ${esc(item.status)}
                </span>
              </td>

              <td>
                ${esc(item.message)}
              </td>

              ${
                importHeaders
                  .slice(
                    0,
                    10
                  )
                  .map(
                    header =>
                      `<td>${esc(item.raw[header])}</td>`
                  )
                  .join('')
              }

            </tr>
          `
      )
      .join('');

  document
    .querySelectorAll(
      '[data-import-row]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          () => {

            importRows[
              num(
                checkbox.dataset
                  .importRow
              )
            ].selected =
              checkbox.checked;
          };
      }
    );

  $('commitImportBtn').disabled =
    !importRows.some(
      item =>
        item.selected &&
        ![
          'Ошибка',
          'Дубль'
        ].includes(
          item.status
        )
    );
}


function importSource(item) {

  return {

    file:
      importFileName,

    sheet:
      importSheetName,

    row:
      item.rowNumber,

    importedAt:
      nowIso()
  };
}


function ensureFrontFromImport(row) {

  const building =
    ensureNamed(
      project.buildings,
      'BLD',
      mappedValue(
        row,
        'building'
      )
    );

  const work =
    ensureNamed(
      project.works,
      'WRK',
      mappedValue(
        row,
        'work'
      ),
      {
        unit:
          normText(
            mappedValue(
              row,
              'unit'
            )
          )
      }
    );

  if (
    !building ||
    !work
  ) {
    return null;
  }

  const structure =
    ensureStructure({

      buildingId:
        building.id,

      block:
        mappedValue(
          row,
          'block'
        ),

      floor:
        mappedValue(
          row,
          'floor'
        ),

      capture:
        mappedValue(
          row,
          'capture'
        ),

      axis:
        mappedValue(
          row,
          'axis'
        ),

      side:
        mappedValue(
          row,
          'side'
        ),

      zone:
        mappedValue(
          row,
          'zone'
        ),

      roomNo:
        mappedValue(
          row,
          'roomNo'
        ),

      roomName:
        mappedValue(
          row,
          'roomName'
        )
    });

  let front =
    project.fronts
      .find(
        item =>
          item.active !== false &&
          item.structureId ===
            structure.id &&
          item.workId ===
            work.id
      );

  if (!front) {

    front = {

      id:
        uid('F'),

      active:
        true,

      structureId:
        structure.id,

      workId:
        work.id,

      status:
        'Не начато',

      createdAt:
        nowIso()
    };

    project.fronts.push(
      front
    );
  }

  const organizationName =
    normText(
      mappedValue(
        row,
        'organization'
      )
    );

  const organization =
    organizationName
      ? ensureNamed(
          project.organizations,
          'ORG',
          organizationName
        )
      : null;

  if (organization) {
    front.organizationId =
      organization.id;
  }

  const unit =
    normText(
      mappedValue(
        row,
        'unit'
      )
    );

  if (unit) {
    front.unit =
      unit;
  }

  return front;
}


function assignIfPresent(
  object,
  key,
  value,
  converter = value => value
) {

  if (
    value !== '' &&
    value !== null &&
    value !== undefined &&
    normText(value) !== ''
  ) {

    object[key] =
      converter(value);
  }
}


async function commitImport() {

  const selected =
    importRows
      .filter(
        item =>
          item.selected &&
          ![
            'Ошибка',
            'Дубль'
          ].includes(
            item.status
          )
      );

  if (!selected.length) {
    return;
  }

  if (
    !confirm(
      `Импортировать выбранные строки: ${selected.length}?\n` +
      `Перед импортом система создаст локальную защитную копию.`
    )
  ) {
    return;
  }

  const preImportBackupKey =
    `pre-import-${Date.now()}`;

  await dbPutKey(
    clone(project),
    preImportBackupKey
  );

  let created =
    0;

  let updated =
    0;

  let appended =
    0;

  let skipped =
    0;

  const batchId =
    uid('IMP');


  for (
    const item
    of selected
  ) {

    const row =
      item.raw;


    /* ФРОНТЫ */

    if (
      importModeResolved ===
      'fronts'
    ) {

      const existed =
        !!findMatchingFrontByMapped(
          row
        );

      const front =
        ensureFrontFromImport(
          row
        );

      if (!front) {

        skipped++;

        continue;
      }

      assignIfPresent(
        front,
        'status',
        mappedValue(
          row,
          'status'
        ),
        normalizeStatus
      );

      assignIfPresent(
        front,
        'totalQty',
        mappedValue(
          row,
          'totalQty'
        ),
        num
      );

      assignIfPresent(
        front,
        'doneQty',
        mappedValue(
          row,
          'doneQty'
        ),
        num
      );

      assignIfPresent(
        front,
        'contractStart',
        mappedValue(
          row,
          'contractStart'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'contractEnd',
        mappedValue(
          row,
          'contractEnd'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'baselineStart',
        mappedValue(
          row,
          'baselineStart'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'baselineEnd',
        mappedValue(
          row,
          'baselineEnd'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'planStart',
        mappedValue(
          row,
          'planStart'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'planEnd',
        mappedValue(
          row,
          'planEnd'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'factStart',
        mappedValue(
          row,
          'factStart'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'factEnd',
        mappedValue(
          row,
          'factEnd'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'forecastEnd',
        mappedValue(
          row,
          'forecastEnd'
        ),
        normDate
      );

      assignIfPresent(
        front,
        'comment',
        mappedValue(
          row,
          'comment'
        ),
        normText
      );

      assignIfPresent(
        front,
        'unit',
        mappedValue(
          row,
          'unit'
        ),
        normText
      );

      front.completed =
        front.status ===
        'Завершено';

      front.updatedAt =
        nowIso();

      front.lastImport = {
        batchId,
        ...importSource(item)
      };

      if (existed) {
        updated++;
      } else {
        created++;
      }
    }


    /* ФАКТ */

    if (
      importModeResolved ===
      'fact'
    ) {

      const front =
        ensureFrontFromImport(
          row
        );

      if (!front) {

        skipped++;

        continue;
      }

      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );

      const quantity =
        num(
          mappedValue(
            row,
            'qty'
          )
        );

      const people =
        num(
          mappedValue(
            row,
            'people'
          )
        );

      const comment =
        normText(
          mappedValue(
            row,
            'comment'
          )
        );

      const fingerprint =
        [
          front.id,
          date,
          quantity,
          people,
          comment
        ].join('|');

      if (
        project.factLog
          .some(
            fact =>
              fact.importFingerprint ===
              fingerprint
          )
      ) {

        skipped++;

        continue;
      }

      const cumulativeRaw =
        mappedValue(
          row,
          'cumulative'
        );

      const cumulative =
        normText(
          cumulativeRaw
        ) !== ''
          ? num(
              cumulativeRaw
            )
          : project.factLog
              .filter(
                fact =>
                  fact.frontId ===
                    front.id &&
                  fact.date <=
                    date
              )
              .reduce(
                (sum, fact) =>
                  sum +
                  num(fact.qty),
                0
              ) +
            quantity;

      project.factLog.push({

        id:
          uid('FCT'),

        frontId:
          front.id,

        date,

        qty:
          quantity,

        cumulative,

        people,

        comment,

        status:
          normText(
            mappedValue(
              row,
              'status'
            )
          ),

        createdAt:
          nowIso(),

        importFingerprint:
          fingerprint,

        source: {
          batchId,
          ...importSource(item)
        }
      });

      front.doneQty =
        Math.max(
          num(front.doneQty),
          cumulative
        );

      if (
        !front.factStart ||
        date <
          front.factStart
      ) {
        front.factStart =
          date;
      }

      assignIfPresent(
        front,
        'status',
        mappedValue(
          row,
          'status'
        ),
        normalizeStatus
      );

      front.updatedAt =
        nowIso();

      appended++;
    }


    /* РЕСУРСЫ */

    if (
      importModeResolved ===
      'resources'
    ) {

      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );

      const organizationName =
        normText(
          mappedValue(
            row,
            'organization'
          )
        );

      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );

      const workName =
        normText(
          mappedValue(
            row,
            'work'
          )
        );

      /*
        ВАЖНО:
        ООО «Пауэр Проджектс»
        ООО «Пауэр Проджектс» (кладка)
        ООО «Пауэр Проджектс» - сети

        остаются РАЗНЫМИ организациями.
        ensureNamed сравнивает полное название.
      */

      const organization =
        organizationName
          ? ensureNamed(
              project.organizations,
              'ORG',
              organizationName
            )
          : null;

      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;

      const work =
        workName
          ? ensureNamed(
              project.works,
              'WRK',
              workName
            )
          : null;


      /*
        Поддерживаются два формата:

        1. ИТР | Рабочие | Механизаторы

        2. Количество человек | Специализация
      */

      let itr =
        num(
          mappedValue(
            row,
            'itr'
          )
        );

      let workers =
        num(
          mappedValue(
            row,
            'workers'
          )
        );

      let mechanizers =
        num(
          mappedValue(
            row,
            'mechanizers'
          )
        );

      const peopleQty =
        num(
          mappedValue(
            row,
            'peopleQty'
          )
        );

      const specialization =
        normText(
          mappedValue(
            row,
            'specialization'
          )
        );

      const specializationKey =
        normKey(
          specialization
        );


      if (
        peopleQty > 0
      ) {

        if (
          specializationKey ===
            'итр' ||
          specializationKey.includes(
            'инженерно техничес'
          )
        ) {

          itr +=
            peopleQty;

        } else if (
          specializationKey.includes(
            'механизатор'
          ) ||
          specializationKey.includes(
            'машинист'
          )
        ) {

          mechanizers +=
            peopleQty;

        } else if (
          specializationKey.includes(
            'рабоч'
          )
        ) {

          workers +=
            peopleQty;
        }
      }


      const resource = {

        id:
          uid('R'),

        date,

        organizationId:
          organization?.id ||
          '',

        buildingId:
          building?.id ||
          '',

        workId:
          work?.id ||
          '',

        frontId:
          '',

        itr,

        workers,

        mechanizers,

        specialization,

        peopleQty,

        equipmentType:
          normText(
            mappedValue(
              row,
              'equipmentType'
            )
          ),

        equipmentQty:
          num(
            mappedValue(
              row,
              'equipmentQty'
            )
          ),

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        createdAt:
          nowIso(),

        source: {
          batchId,
          ...importSource(item)
        }
      };


      const hasPeople =
        resource.itr > 0 ||
        resource.workers > 0 ||
        resource.mechanizers > 0;

      const hasEquipment =
        !!resource.equipmentType ||
        resource.equipmentQty > 0;

      if (
        !hasPeople &&
        !hasEquipment
      ) {

        skipped++;

        continue;
      }


      resource.importFingerprint =
        [
          resource.date,
          resource.organizationId,
          resource.buildingId,
          resource.workId,
          resource.itr,
          resource.workers,
          resource.mechanizers,
          resource.specialization,
          resource.peopleQty,
          resource.equipmentType,
          resource.equipmentQty,
          resource.comment
        ].join('|');


      if (
        project.resources
          .some(
            existing =>
              existing.importFingerprint ===
              resource.importFingerprint
          )
      ) {

        skipped++;

        continue;
      }


      project.resources.push(
        resource
      );

      appended++;
    }


    /* НОМЕРНЫЕ ЭЛЕМЕНТЫ */

    if (
      importModeResolved ===
      'elements'
    ) {

      const type =
        normText(
          mappedValue(
            row,
            'elementType'
          )
        ) ||
        normText(
          mappedValue(
            row,
            'work'
          )
        );

      const number =
        normText(
          mappedValue(
            row,
            'elementNo'
          )
        );

      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );

      const workName =
        normText(
          mappedValue(
            row,
            'work'
          )
        );

      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;

      const work =
        workName
          ? ensureNamed(
              project.works,
              'WRK',
              workName
            )
          : null;

      const element = {

        id:
          uid('EL'),

        elementType:
          type,

        elementNo:
          number,

        buildingId:
          building?.id ||
          '',

        capture:
          normText(
            mappedValue(
              row,
              'capture'
            )
          ),

        zone:
          normText(
            mappedValue(
              row,
              'zone'
            )
          ),

        workId:
          work?.id ||
          '',

        frontId:
          '',

        status:
          normalizeStatus(
            mappedValue(
              row,
              'status'
            )
          ) ||
          'Не начато',

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        uniqueScope:
          'context',

        active:
          true,

        createdAt:
          nowIso(),

        source: {
          batchId,
          ...importSource(item)
        }
      };

      if (
        findElementDuplicate(
          element
        )
      ) {

        skipped++;

        continue;
      }

      project.numberedElements
        .push(
          element
        );

      created++;
    }


    /* КЛЮЧЕВЫЕ ДАТЫ */

    if (
      importModeResolved ===
      'milestones'
    ) {

      const title =
        normText(
          mappedValue(
            row,
            'title'
          )
        ) ||
        normText(
          mappedValue(
            row,
            'work'
          )
        );

      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );

      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;

      const contractDate =
        normDate(
          mappedValue(
            row,
            'contractEnd'
          )
        );

      let milestone =
        project.milestones
          .find(
            item =>
              sameText(
                item.title,
                title
              ) &&
              (
                !building ||
                item.buildingId ===
                  building.id
              ) &&
              (
                !contractDate ||
                item.contractDate ===
                  contractDate
              )
          );

      const existed =
        !!milestone;

      if (!milestone) {

        milestone = {

          id:
            uid('M'),

          createdAt:
            nowIso()
        };

        project.milestones
          .push(
            milestone
          );
      }

      Object.assign(
        milestone,
        {
          title,

          buildingId:
            building?.id ||
            milestone.buildingId ||
            '',

          contractDate:
            contractDate ||
            milestone.contractDate ||
            '',

          workDate:
            normDate(
              mappedValue(
                row,
                'planEnd'
              )
            ) ||
            milestone.workDate ||
            '',

          forecastDate:
            normDate(
              mappedValue(
                row,
                'forecastEnd'
              )
            ) ||
            milestone.forecastDate ||
            '',

          factDate:
            normDate(
              mappedValue(
                row,
                'factEnd'
              )
            ) ||
            milestone.factDate ||
            '',

          status:
            normText(
              mappedValue(
                row,
                'status'
              )
            ) ||
            milestone.status ||
            'Не наступила',

          comment:
            normText(
              mappedValue(
                row,
                'comment'
              )
            ) ||
            milestone.comment ||
            '',

          updatedAt:
            nowIso(),

          lastImport: {
            batchId,
            ...importSource(item)
          }
        }
      );

      if (existed) {
        updated++;
      } else {
        created++;
      }
    }
  }


  project.importHistory.unshift({

    id:
      batchId,

    backupKey:
      preImportBackupKey,

    at:
      nowIso(),

    fileName:
      importFileName,

    sheetName:
      importSheetName,

    mode:
      importModeResolved,

    selected:
      selected.length,

    created,

    updated,

    appended,

    skipped,

    mapping:
      clone(importMapping)
  });


  log(
    'Импорт',
    'Проект',

    `${importFileName} / ${importSheetName}: ` +
    `создано ${created}, ` +
    `обновлено ${updated}, ` +
    `добавлено в журналы ${appended}, ` +
    `пропущено ${skipped}`,

    {
      batchId
    }
  );


  await saveProject();

  renderAll();


  $('importInfo').className =
    'notice good';

  $('importInfo').textContent =
    `Импорт завершен.\n` +
    `Создано: ${created}\n` +
    `Обновлено: ${updated}\n` +
    `Добавлено в журналы: ${appended}\n` +
    `Пропущено: ${skipped}`;

  $('commitImportBtn').disabled =
    true;
}


async function rollbackLastImport() {

  const lastImport =
    project.importHistory?.[0];

  if (!lastImport) {

    alert(
      'В истории проекта нет импортов для отмены.'
    );

    return;
  }

  if (
    !lastImport.backupKey
  ) {

    alert(
      'Этот импорт был сделан до появления автоматического отката. ' +
      'Для него безопасный откат недоступен.'
    );

    return;
  }

  const backup =
    await dbGetKey(
      lastImport.backupKey
    );

  if (!backup) {

    alert(
      'Защитная копия перед импортом не найдена.'
    );

    return;
  }

  const text =
    `Отменить последний импорт?\n\n` +
    `Файл: ${lastImport.fileName || '—'}\n` +
    `Лист: ${lastImport.sheetName || '—'}\n` +
    `Дата: ${
      lastImport.at
        ? new Date(
            lastImport.at
          ).toLocaleString(
            'ru-RU'
          )
        : '—'
    }\n\n` +
    `Проект вернется ровно в состояние до этого импорта.`;

  if (
    !confirm(text)
  ) {
    return;
  }

  await dbPutKey(
    clone(project),
    `before-rollback-${Date.now()}`
  );

  project =
    normalizeProject(
      backup
    );

  log(
    'Отмена импорта',
    'Проект',

    `Восстановлено состояние до импорта ` +
    `${lastImport.fileName || ''}`
  );

  await saveProject();

  renderAll();

  $('importInfo')
    .classList
    .remove('hidden');

  $('importInfo').className =
    'notice good';

  $('importInfo').textContent =
    'Последний импорт отменен. ' +
    'Проект восстановлен из защитной копии.';

  alert(
    'Последний импорт отменен.'
  );
}


function printCurrent() {

  const active =
    document.querySelector(
      '.panel:not(.hidden)'
    );

  document
    .querySelectorAll(
      '.panel'
    )
    .forEach(
      panel =>
        panel.classList
          .remove(
            'print-active'
          )
    );

  if (active) {
    active.classList
      .add(
        'print-active'
      );
  }

  window.print();

  setTimeout(
    () =>
      active?.classList
        .remove(
          'print-active'
        ),
    500
  );
}


function switchTab(name) {

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button =>
        button.classList
          .toggle(
            'active',
            button.dataset.tab ===
              name
          )
    );

  document
    .querySelectorAll(
      '.panel'
    )
    .forEach(
      panel =>
        panel.classList
          .add('hidden')
    );

  $(`tab-${name}`)
    .classList
    .remove('hidden');

  if (
    name ===
    'matrix'
  ) {
    renderMatrix();
  }

  if (
    name ===
    'gantt'
  ) {
    renderGantt();
  }

  if (
    name ===
    'planfact'
  ) {
    renderPlanFact();
  }

  if (
    name ===
    'resources'
  ) {
    renderResources();
  }

  if (
    name ===
    'milestones'
  ) {
    renderMilestones();
  }

  if (
    name ===
    'elements'
  ) {
    renderElements();
  }

  if (
    name ===
    'demolition'
  ) {
    renderDemolition();
  }

  if (
    name ===
    'history'
  ) {
    renderHistory();
  }

  if (
    name ===
    'settings'
  ) {
    renderSettings();
  }
}


function renderAll() {

  initSelects();

  renderDashboard();

  renderMatrix();

  renderGantt();

  renderPlanFact();

  renderResources();

  renderMilestones();

  renderElements();

  renderDemolition();

  renderHistory();

  renderSettings();
}


function bindUi() {

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button =>

        button.onclick =
          () =>
            switchTab(
              button.dataset.tab
            )
    );


  $('modalClose').onclick =
    closeModal;


  $('modal').onclick =
    event => {

      if (
        event.target ===
        $('modal')
      ) {
        closeModal();
      }
    };


  [
    'mfBuilding',
    'mfBlock',
    'mfFloor',
    'mfWork',
    'mfOrg',
    'mfStatus'
  ]
    .forEach(
      id =>
        $(id).onchange =
          renderMatrix
    );


  [
    'gBuilding',
    'gWork',
    'gMode'
  ]
    .forEach(
      id =>
        $(id).onchange =
          renderGantt
    );


  [
    'pfFrom',
    'pfTo',
    'pfBuilding',
    'pfWork'
  ]
    .forEach(
      id =>
        $(id).onchange =
          renderPlanFact
    );


  [
    'rFrom',
    'rTo',
    'rOrg',
    'rBuilding'
  ]
    .forEach(
      id =>
        $(id).onchange =
          renderResources
    );


  [
    'elBuilding',
    'elType'
  ]
    .forEach(
      id =>
        $(id).onchange =
          renderElements
    );


  $('elSearch').oninput =
    renderElements;


  $('newFrontBtn').onclick =
    () =>
      openFrontEditor();


  $('newPlanRow').onclick =
    () =>
      openLogEditor(
        'plan'
      );


  $('newFactRow').onclick =
    () =>
      openLogEditor(
        'fact'
      );


  $('newResourceBtn').onclick =
    openResourceEditor;


  $('newMilestoneBtn').onclick =
    () =>
      openMilestoneEditor();


  $('newElementBtn').onclick =
    () =>
      openElementEditor();


  $('addBuildingBtn').onclick =
    () =>
      addSimple(
        'building'
      );


  $('addWorkBtn').onclick =
    () =>
      addSimple(
        'work'
      );


  $('addOrgBtn').onclick =
    () =>
      addSimple(
        'org'
      );


  $('backupBtn').onclick =
    exportBackup;


  $('restoreInput').onchange =
    event =>

      event.target.files[0] &&
      restoreProject(
        event.target.files[0]
      );


  $('compareInput').onchange =
    event =>

      event.target.files[0] &&
      compareProjectFile(
        event.target.files[0]
      );


  $('pdfBtn').onclick =
    printCurrent;


  $('importFile').onchange =
    readImportFile;


  $('importSheet').onchange =
    () => {

      importSheetName =
        $('importSheet').value;

      importMapping =
        {};

      importMappingMode =
        '';

      readSelectedSheet();

      $('commitImportBtn').disabled =
        true;
    };


  $('importMode').onchange =
    () => {

      importMapping =
        {};

      importMappingMode =
        '';

      $('commitImportBtn').disabled =
        true;
    };


  $('analyzeImportBtn').onclick =
    analyzeImport;


  $('commitImportBtn').onclick =
    commitImport;


  $('rollbackImportBtn').onclick =
    rollbackLastImport;


  $('clearProjectBtn').onclick =
    async () => {

      if (
        !confirm(
          'Очистить рабочие данные? ' +
          'Справочники зданий, видов работ и организаций останутся. ' +
          'Перед очисткой будет создана защитная копия.'
        )
      ) {
        return;
      }

      const preClearBackupKey =
        `pre-clear-${Date.now()}`;

      await dbPutKey(
        clone(project),
        preClearBackupKey
      );

      const fresh =
        emptyProject();

      fresh.organizations =
        clone(
          project.organizations
        );

      fresh.buildings =
        clone(
          project.buildings
        );

      fresh.works =
        clone(
          project.works
        );

      project =
        fresh;

      log(
        'Очищено',
        'Проект',
        'Рабочие данные очищены'
      );

      await saveProject();

      renderAll();
    };
}


async function init() {

  db =
    await openDb();

  const raw =
    await dbGetKey();

  project =
    await migrateIfNeeded(
      raw
    );

  if (
    !raw ||
    raw.schemaVersion !==
      SCHEMA_VERSION
  ) {
    await saveProject();
  }

  bindUi();

  $('pfTo').value =
    today();

  $('rTo').value =
    today();

  renderBackupNotice();

  renderAll();
}


document.addEventListener(
  'DOMContentLoaded',

  () => {

    init()
      .catch(
        error => {

          console.error(
            error
          );

          alert(
            'Ошибка запуска: ' +
            error.message
          );
        }
      );
  }
);
