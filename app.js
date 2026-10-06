'use strict';

const $ = id =>
  document.getElementById(id);

const DB_NAME =
  'acons_planning_local';

const DB_VERSION =
  1;

const STORE =
  'project';

const PROJECT_KEY =
  'main';

const SCHEMA_VERSION =
  '1.0.0';

const STATUS_LIST = [
  'Не начато',
  'Фронт готов',
  'В работе',
  'Завершено',
  'Приостановлено',
  'Ограничение'
];

const BUILDINGS = [
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

const WORKS = [
  [
    'Кладка наружных стен',
    'АР',
    'м²'
  ],
  [
    'Вертикальное армирование',
    'КР',
    'т'
  ],
  [
    'Штукатурка',
    'АР',
    'м²'
  ],
  [
    'Гидроизоляция балконов',
    'АР',
    'м²'
  ],
  [
    'Передача фронта',
    'Организация работ',
    'шт.'
  ]
];

const DEMOLITION = [
  "Склад (ангар) литера Д'",
  "Нежилое здание, Корпус №10 литера Д",
  "Нежилое здание, Корпус №9 литера Г",
  "Нежилое здание №11 литера Е",
  "Демонтаж «фонтана с оленем»",
  "Аэрарий",
  "Нежилое здание Корпус №12 литера З",
  "Нежилое здание Корпус №1 литера Б",
  "Котельная литера Ф'",
  "Склад литера Б', 90:25:020102:170",
  "Коттедж 1 литера Ш'",
  "Парники",
  "Коммунальная столовая литера Ц",
  "Управление (бытовые помещения) литера Р",
  "Теплица в ООПТ",
  "Сауна литера Л'",
  "Склад",
  "Кладовая / Аккумуляторная литера Т'",
  "Гараж литера Ж'",
  "Гараж литера С'",
  "Нежилое здание КТП / Диспетчерская литера П'",
  "Нежилое здание, Корпус №4 литера В",
  "Библиотека литера Ю",
  "Нежилое здание Корпус №32 литера И",
  "Спортивная площадка",
  "Нежилое здание (Коттедж 3) литера Ц'",
  "Приемная, спортзал литера Т (ЛФК)",
  "Прачечная литера А (ОКН)",
  "Нежилое здание литера У' (Склад ген.подрядчика)",
  "Офис, нежилое здание литера Ф (штаб тех.заказчика)",
  "Нежилое здание Корпус №35 литера Л (штаб ген.подрядчика)",
  "Нежилое здание, Корпус №34 литера К (ООПТ)"
];

let db = null;
let project = null;
let importRows = [];
let compareIncoming = null;

const uid = prefix =>
  prefix +
  '-' +
  crypto.randomUUID();

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const nowIso = () =>
  new Date()
    .toISOString();

const num = value =>
  Number(
    String(
      value ?? 0
    )
      .replace(
        /\s/g,
        ''
      )
      .replace(
        ',',
        '.'
      )
  ) || 0;

const fmt = value =>
  Math.round(
    num(value) * 100
  ) / 100;

const esc = value =>
  String(
    value ?? ''
  )
    .replace(
      /[&<>"']/g,
      char =>
        ({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#039;'
        })[char]
    );

const uniq = array =>
  [
    ...new Set(
      array.filter(
        value =>
          value !== '' &&
          value !== null &&
          value !== undefined
      )
    )
  ];

const byId = (
  list,
  id
) =>
  list.find(
    item =>
      String(
        item.id
      ) ===
      String(
        id
      )
  );

const nameById = (
  list,
  id
) =>
  byId(
    list,
    id
  )?.name ||
  '';

const diffDays = (
  first,
  second
) =>
  first &&
  second
    ? Math.round(
        (
          Date.parse(second) -
          Date.parse(first)
        ) /
        86400000
      )
    : null;

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
        null
    },

    buildings:
      BUILDINGS.map(
        (
          name,
          index
        ) => ({
          id:
            `BLD-${String(index + 1).padStart(3,'0')}`,

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
      WORKS.map(
        (
          item,
          index
        ) => ({
          id:
            `WRK-${String(index + 1).padStart(3,'0')}`,

          name:
            item[0],

          section:
            item[1],

          unit:
            item[2],

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

    customFields:
      [],

    views:
      [],

    history:
      [],

    demolition:
      DEMOLITION.map(
        (
          name,
          index
        ) => ({
          id:
            `DEM-${String(index + 1).padStart(3,'0')}`,

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
      )
  };
}

async function openDb() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

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
            !database
              .objectStoreNames
              .contains(
                STORE
              )
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

async function dbGet() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const transaction =
        db.transaction(
          STORE,
          'readonly'
        );

      const request =
        transaction
          .objectStore(
            STORE
          )
          .get(
            PROJECT_KEY
          );

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

async function dbPut(
  value
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const transaction =
        db.transaction(
          STORE,
          'readwrite'
        );

      transaction
        .objectStore(
          STORE
        )
        .put(
          value,
          PROJECT_KEY
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

async function saveProject() {

  project.meta.updatedAt =
    nowIso();

  await dbPut(
    project
  );

  renderBackupNotice();
}

function log(
  action,
  entity,
  description
) {

  project.history.unshift({
    id:
      uid('H'),

    at:
      nowIso(),

    action,

    entity,

    description
  });

  project.history =
    project.history
      .slice(
        0,
        5000
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
      {
        type
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document
      .createElement(
        'a'
      );

  link.href =
    url;

  link.download =
    name;

  document.body
    .appendChild(
      link
    );

  link.click();

  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}

function hydrateFront(
  front
) {

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

function frontLabel(
  front
) {

  const item =
    hydrateFront(
      front
    );

  return [
    item.building,
    item.block,

    item.floor !== ''
      ? `${item.floor} эт.`
      : '',

    item.capture
      ? `захв. ${item.capture}`
      : '',

    item.axis
      ? `ось ${item.axis}`
      : '',

    item.side,
    item.zone,

    item.roomNo
      ? `пом. ${item.roomNo}`
      : '',

    item.work
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
    allLabel !==
    undefined
  ) {

    const option =
      document
        .createElement(
          'option'
        );

    option.value =
      'all';

    option.textContent =
      allLabel;

    element
      .appendChild(
        option
      );
  }

  items.forEach(
    item => {

      const option =
        document
          .createElement(
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

      element
        .appendChild(
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
          item.active !==
          false
      );

  const works =
    project.works
      .filter(
        item =>
          item.active !==
          false
      );

  const organizations =
    project.organizations
      .filter(
        item =>
          item.active !==
          false
      );

  [
    'mfBuilding',
    'gBuilding',
    'pfBuilding',
    'rBuilding'
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

  updateMatrixDependent();
}

function updateMatrixDependent() {

  const buildingId =
    $('mfBuilding')
      .value;

  const structures =
    project.structures
      .filter(
        structure =>
          buildingId ===
            'all' ||
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
        value => ({
          id:
            value,

          name:
            value
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
        (
          first,
          second
        ) =>
          num(first) -
          num(second)
      )
      .map(
        value => ({
          id:
            value,

          name:
            value
        })
      ),

    'Все этажи'
  );
}

function renderAll() {

  initSelects();

  renderDashboard();

  renderMatrix();

  renderGantt();

  renderPlanFact();

  renderResources();

  renderMilestones();

  renderDemolition();

  renderHistory();

  renderSettings();
}

function renderDashboard() {

  const fronts =
    project.fronts
      .map(
        hydrateFront
      );

  $('dTotal')
    .textContent =
      fronts.length;

  $('dWork')
    .textContent =
      fronts
        .filter(
          front =>
            front.status ===
            'В работе'
        )
        .length;

  $('dDone')
    .textContent =
      fronts
        .filter(
          front =>
            front.status ===
              'Завершено' ||
            front.completed
        )
        .length;

  $('dAccepted')
    .textContent =
      fronts
        .filter(
          front =>
            front.accepted
        )
        .length;

  $('dLate')
    .textContent =
      fronts
        .filter(
          front =>
            front.contractEnd &&
            !front.accepted &&
            front.contractEnd <
              today()
        )
        .length;

  $('dRisk')
    .textContent =
      fronts
        .filter(
          front =>
            [
              'Ограничение',
              'Приостановлено'
            ]
              .includes(
                front.status
              )
        )
        .length;

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

  $('dCritical')
    .innerHTML =
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
        (
          first,
          second
        ) =>
          String(
            first.date
          )
            .localeCompare(
              String(
                second.date
              )
            )
      )
      .slice(-1)[0]
      ?.date;

  const resourceRows =
    project.resources
      .filter(
        row =>
          row.date ===
          lastDate
      );

  const people =
    resourceRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(row.itr) +
          num(row.workers) +
          num(row.mechanizers),
        0
      );

  const equipment =
    resourceRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.equipmentQty
          ),
        0
      );

  $('dResources')
    .innerHTML =
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

  return project.fronts
    .map(
      hydrateFront
    )
    .filter(
      front =>
        (
          $('mfBuilding').value ===
            'all' ||
          front.structure
            .buildingId ===
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
          String(
            front.floor
          ) ===
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

  $('matrixHead')
    .innerHTML =
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

  $('matrixBody')
    .innerHTML =
      matrixFiltered()
        .map(
          front =>
            `
              <tr class="${
                front.status ===
                  'Завершено'
                  ? 's-done'
                  :
                front.status ===
                  'В работе'
                  ? 's-work'
                  :
                front.status ===
                  'Ограничение'
                  ? 's-risk'
                  : ''
              }">

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
                    ${esc(front.status)}
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
                    data-edit-front="${front.id}"
                  >
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
      button =>
        button.onclick =
          () =>
            openFrontEditor(
              button.dataset.editFront
            )
    );
}

function openModal(
  title,
  html
) {

  $('modalTitle')
    .textContent =
      title;

  $('modalBody')
    .innerHTML =
      html;

  $('modal')
    .classList
    .remove(
      'hidden'
    );
}

function closeModal() {

  $('modal')
    .classList
    .add(
      'hidden'
    );

  $('modalBody')
    .innerHTML =
      '';
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

  const options = (
    list,
    value
  ) =>
    list
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
              }
            >
              ${esc(item.name)}
            </option>
          `
      )
      .join('');

  return `
    <div class="form-grid">

      <div class="field">
        <label>Здание</label>
        <select id="eBuilding">
          ${options(project.buildings,structure.buildingId)}
        </select>
      </div>

      <div class="field">
        <label>Блок</label>
        <input
          id="eBlock"
          value="${esc(structure.block || '')}"
        >
      </div>

      <div class="field">
        <label>Этаж</label>
        <input
          id="eFloor"
          type="number"
          value="${esc(structure.floor ?? '')}"
        >
      </div>

      <div class="field">
        <label>Захватка</label>
        <input
          id="eCapture"
          value="${esc(structure.capture || '')}"
        >
      </div>

      <div class="field">
        <label>Ось</label>
        <input
          id="eAxis"
          value="${esc(structure.axis || '')}"
        >
      </div>

      <div class="field">
        <label>Сторона</label>
        <input
          id="eSide"
          value="${esc(structure.side || '')}"
        >
      </div>

      <div class="field">
        <label>Зона</label>
        <input
          id="eZone"
          value="${esc(structure.zone || '')}"
        >
      </div>

      <div class="field">
        <label>№ помещения</label>
        <input
          id="eRoomNo"
          value="${esc(structure.roomNo || '')}"
        >
      </div>

      <div class="field">
        <label>Помещение</label>
        <input
          id="eRoomName"
          value="${esc(structure.roomName || '')}"
        >
      </div>

      <div class="field">
        <label>Вид работы</label>
        <select id="eWork">
          ${options(project.works,front.workId)}
        </select>
      </div>

      <div class="field">
        <label>Организация</label>
        <select id="eOrg">
          <option value="">—</option>
          ${options(project.organizations,front.organizationId)}
        </select>
      </div>

      <div class="field">
        <label>Ответственный</label>
        <input
          id="eResponsible"
          value="${esc(front.responsible || '')}"
        >
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
                      }
                    >
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
        <input
          id="eUnit"
          value="${esc(front.unit || '')}"
        >
      </div>

      <div class="field">
        <label>Общий объем</label>
        <input
          id="eTotal"
          type="number"
          step="any"
          value="${front.totalQty ?? ''}"
        >
      </div>

      <div class="field">
        <label>Накопительно выполнено</label>
        <input
          id="eDone"
          type="number"
          step="any"
          value="${front.doneQty ?? ''}"
        >
      </div>

      <div class="field">
        <label>Договор начало</label>
        <input
          id="eContractStart"
          type="date"
          value="${front.contractStart || ''}"
        >
      </div>

      <div class="field">
        <label>Договор окончание</label>
        <input
          id="eContractEnd"
          type="date"
          value="${front.contractEnd || ''}"
        >
      </div>

      <div class="field">
        <label>База начало</label>
        <input
          id="eBaselineStart"
          type="date"
          value="${front.baselineStart || ''}"
        >
      </div>

      <div class="field">
        <label>База окончание</label>
        <input
          id="eBaselineEnd"
          type="date"
          value="${front.baselineEnd || ''}"
        >
      </div>

      <div class="field">
        <label>Рабочий план начало</label>
        <input
          id="ePlanStart"
          type="date"
          value="${front.planStart || ''}"
        >
      </div>

      <div class="field">
        <label>Рабочий план окончание</label>
        <input
          id="ePlanEnd"
          type="date"
          value="${front.planEnd || ''}"
        >
      </div>

      <div class="field">
        <label>Факт начало</label>
        <input
          id="eFactStart"
          type="date"
          value="${front.factStart || ''}"
        >
      </div>

      <div class="field">
        <label>Факт окончание</label>
        <input
          id="eFactEnd"
          type="date"
          value="${front.factEnd || ''}"
        >
      </div>

      <div class="field">
        <label>Прогноз окончание</label>
        <input
          id="eForecastEnd"
          type="date"
          value="${front.forecastEnd || ''}"
        >
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
        }
      >
        Удалить
      </button>

      <button
        id="saveFront"
        class="btn primary"
      >
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

    frontForm(
      front
    )
  );

  $('saveFront').onclick =
    () =>
      saveFrontFromModal(
        id
      );

  if (id) {
    $('deleteFront').onclick =
      () =>
        deleteFront(
          id
        );
  }
}

async function saveFrontFromModal(
  id
) {

  const buildingId =
    $('eBuilding')
      .value;

  let structure =
    id
      ? byId(
          project.structures,
          byId(
            project.fronts,
            id
          ).structureId
        )
      : null;

  if (!structure) {

    structure = {
      id:
        uid('STR'),

      buildingId
    };

    project.structures
      .push(
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
        $('eFloor').value ===
          ''
          ? ''
          : num(
              $('eFloor')
                .value
            ),

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
            nowIso()
        };

  Object.assign(
    front,
    {
      structureId:
        structure.id,

      workId:
        $('eWork')
          .value,

      organizationId:
        $('eOrg')
          .value,

      responsible:
        $('eResponsible')
          .value
          .trim(),

      status:
        $('eStatus')
          .value,

      unit:
        $('eUnit')
          .value
          .trim(),

      totalQty:
        num(
          $('eTotal')
            .value
        ),

      doneQty:
        num(
          $('eDone')
            .value
        ),

      contractStart:
        $('eContractStart')
          .value,

      contractEnd:
        $('eContractEnd')
          .value,

      baselineStart:
        $('eBaselineStart')
          .value,

      baselineEnd:
        $('eBaselineEnd')
          .value,

      planStart:
        $('ePlanStart')
          .value,

      planEnd:
        $('ePlanEnd')
          .value,

      factStart:
        $('eFactStart')
          .value,

      factEnd:
        $('eFactEnd')
          .value,

      forecastEnd:
        $('eForecastEnd')
          .value,

      constraint:
        $('eConstraint')
          .value
          .trim(),

      comment:
        $('eComment')
          .value
          .trim(),

      completed:
        $('eStatus')
          .value ===
          'Завершено',

      accepted:
        front.accepted ||
        false,

      updatedAt:
        nowIso()
    }
  );

  if (!id) {
    project.fronts
      .push(
        front
      );
  }

  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Фронт',

    frontLabel(
      front
    )
  );

  await saveProject();

  closeModal();

  renderAll();
}

async function deleteFront(
  id
) {

  if (
    !confirm(
      'Удалить фронт?'
    )
  ) {
    return;
  }

  const front =
    byId(
      project.fronts,
      id
    );

  project.fronts =
    project.fronts
      .filter(
        item =>
          item.id !==
          id
      );

  project.planLog =
    project.planLog
      .filter(
        item =>
          item.frontId !==
          id
      );

  project.factLog =
    project.factLog
      .filter(
        item =>
          item.frontId !==
          id
      );

  log(
    'Удалено',
    'Фронт',
    frontLabel(
      front
    )
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
    $('gBuilding')
      .value;

  const workId =
    $('gWork')
      .value;

  const mode =
    $('gMode')
      .value;

  const items =
    project.fronts
      .map(
        hydrateFront
      )
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

  if (
    !items.length
  ) {

    $('gantt')
      .innerHTML =
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

  $('gantt')
    .innerHTML =
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
                    style="
                      left:${left}%;
                      width:${width}%
                    "
                  >
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
    $('pfBuilding')
      .value;

  const workId =
    $('pfWork')
      .value;

  return new Set(
    project.fronts
      .filter(
        front => {

          const structure =
            byId(
              project.structures,
              front.structureId
            );

          return (
            (
              buildingId ===
                'all' ||
              structure
                ?.buildingId ===
                buildingId
            ) &&

            (
              workId ===
                'all' ||
              front.workId ===
                workId
            )
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
    $('pfFrom')
      .value;

  const to =
    $('pfTo')
      .value;

  const planRows =
    project.planLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&

          (
            !from ||
            row.date >=
              from
          ) &&

          (
            !to ||
            row.date <=
              to
          )
      );

  const factRows =
    project.factLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&

          (
            !from ||
            row.date >=
              from
          ) &&

          (
            !to ||
            row.date <=
              to
          )
      );

  const planPeriod =
    planRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const factPeriod =
    factRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const planCum =
    project.planLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&
          (
            !to ||
            row.date <=
              to
          )
      )
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const factCum =
    project.factLog
      .filter(
        row =>
          ids.has(
            row.frontId
          ) &&
          (
            !to ||
            row.date <=
              to
          )
      )
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const total =
    project.fronts
      .filter(
        front =>
          ids.has(
            front.id
          )
      )
      .reduce(
        (
          sum,
          front
        ) =>
          sum +
          num(
            front.totalQty
          ),
        0
      );

  $('pfPlanPeriod')
    .textContent =
      fmt(
        planPeriod
      );

  $('pfFactPeriod')
    .textContent =
      fmt(
        factPeriod
      );

  $('pfVarPeriod')
    .textContent =
      fmt(
        factPeriod -
        planPeriod
      );

  $('pfPlanCum')
    .textContent =
      fmt(
        planCum
      );

  $('pfFactCum')
    .textContent =
      fmt(
        factCum
      );

  $('pfPp')
    .textContent =
      fmt(
        total
          ? (
              factCum /
              total -
              planCum /
              total
            ) * 100
          : 0
      );

  $('planRows')
    .innerHTML =
      planRows
        .sort(
          (
            first,
            second
          ) =>
            second.date
              .localeCompare(
                first.date
              )
        )
        .map(
          row =>
            `
              <tr>
                <td>${row.date}</td>
                <td>${esc(frontLabel(byId(project.fronts,row.frontId)))}</td>
                <td>${fmt(row.qty)}</td>
                <td>${fmt(row.people)}</td>
              </tr>
            `
        )
        .join('');

  $('factRows')
    .innerHTML =
      factRows
        .sort(
          (
            first,
            second
          ) =>
            second.date
              .localeCompare(
                first.date
              )
        )
        .map(
          row =>
            `
              <tr>
                <td>${row.date}</td>
                <td>${esc(frontLabel(byId(project.fronts,row.frontId)))}</td>
                <td>${fmt(row.qty)}</td>
                <td>${fmt(row.cumulative)}</td>
                <td>${fmt(row.people)}</td>
              </tr>
            `
        )
        .join('');
}

function openLogEditor(
  mode
) {

  const options =
    project.fronts
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
    mode ===
      'plan'
      ? 'Добавить план'
      : 'Добавить факт',

    `
      <div class="form-grid">

        <div class="field">
          <label>Фронт</label>
          <select id="lFront">
            ${options}
          </select>
        </div>

        <div class="field">
          <label>Дата</label>
          <input
            id="lDate"
            type="date"
            value="${today()}"
          >
        </div>

        <div class="field">
          <label>Объем</label>
          <input
            id="lQty"
            type="number"
            step="any"
          >
        </div>

        <div class="field">
          <label>Люди</label>
          <input
            id="lPeople"
            type="number"
          >
        </div>

        ${
          mode ===
          'fact'
            ? `
              <div class="field">
                <label>
                  Накопительный итог
                  (если пусто — посчитается)
                </label>

                <input
                  id="lCum"
                  type="number"
                  step="any"
                >
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
          class="btn primary"
        >
          Сохранить
        </button>
      </div>
    `
  );

  $('lSave').onclick =
    () =>
      saveLog(
        mode
      );
}

async function saveLog(
  mode
) {

  const frontId =
    $('lFront')
      .value;

  const date =
    $('lDate')
      .value;

  const qty =
    num(
      $('lQty')
        .value
    );

  const people =
    num(
      $('lPeople')
        .value
    );

  const comment =
    $('lComment')
      .value
      .trim();

  if (
    mode ===
    'plan'
  ) {

    project.planLog
      .push({
        id:
          uid('P'),

        frontId,

        date,

        qty,

        people,

        comment,

        createdAt:
          nowIso()
      });

    log(
      'Добавлено',
      'План',
      `${date} · ${frontLabel(byId(project.fronts,frontId))} · ${qty}`
    );

  } else {

    let cumulative =
      $('lCum').value ===
        ''
        ? project.factLog
            .filter(
              row =>
                row.frontId ===
                frontId
            )
            .reduce(
              (
                sum,
                row
              ) =>
                sum +
                num(
                  row.qty
                ),
              0
            ) +
            qty
        : num(
            $('lCum')
              .value
          );

    project.factLog
      .push({
        id:
          uid('FCT'),

        frontId,

        date,

        qty,

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
      cumulative;

    if (
      !front.factStart
    ) {
      front.factStart =
        date;
    }

    front.updatedAt =
      nowIso();

    log(
      'Добавлено',
      'Факт',
      `${date} · ${frontLabel(front)} · ${qty}`
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
          row.date >=
            from
        ) &&

        (
          !to ||
          row.date <=
            to
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
      rows
        .reduce(
          (
            total,
            row
          ) =>
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

  $('rItr')
    .textContent =
      sum(
        'itr'
      );

  $('rWorkers')
    .textContent =
      sum(
        'workers'
      );

  $('rMech')
    .textContent =
      sum(
        'mechanizers'
      );

  $('rTotalPeople')
    .textContent =
      sum('itr') +
      sum('workers') +
      sum('mechanizers');

  $('rPeak')
    .textContent =
      Math.max(
        0,
        ...Object.values(
          daily
        )
      );

  $('rEquipDays')
    .textContent =
      sum(
        'equipmentQty'
      );

  $('resourceRows')
    .innerHTML =
      rows
        .sort(
          (
            first,
            second
          ) =>
            second.date
              .localeCompare(
                first.date
              )
        )
        .map(
          row =>
            `
              <tr>

                <td>${row.date}</td>

                <td>
                  ${esc(nameById(project.organizations,row.organizationId))}
                </td>

                <td>
                  ${esc(nameById(project.buildings,row.buildingId))}
                </td>

                <td>${row.itr}</td>
                <td>${row.workers}</td>
                <td>${row.mechanizers}</td>
                <td>${esc(row.equipmentType || '')}</td>
                <td>${row.equipmentQty}</td>
                <td>${esc(row.comment || '')}</td>

              </tr>
            `
        )
        .join('');
}

function openResourceEditor() {

  const options =
    list =>
      list
        .map(
          item =>
            `
              <option value="${item.id}">
                ${esc(item.name)}
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
            value="${today()}"
          >
        </div>

        <div class="field">
          <label>Организация</label>
          <select id="rrOrg">
            <option value="">—</option>
            ${options(project.organizations)}
          </select>
        </div>

        <div class="field">
          <label>Здание</label>
          <select id="rrBuilding">
            <option value="">—</option>
            ${options(project.buildings)}
          </select>
        </div>

        <div class="field">
          <label>ИТР</label>
          <input
            id="rrItr"
            type="number"
          >
        </div>

        <div class="field">
          <label>Рабочие</label>
          <input
            id="rrWorkers"
            type="number"
          >
        </div>

        <div class="field">
          <label>Механизаторы</label>
          <input
            id="rrMech"
            type="number"
          >
        </div>

        <div class="field">
          <label>Тип техники</label>
          <input id="rrEqType">
        </div>

        <div class="field">
          <label>Количество техники</label>
          <input
            id="rrEqQty"
            type="number"
          >
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rrComment"></textarea>
      </div>

      <div class="editor-actions">
        <button
          id="rrSave"
          class="btn primary"
        >
          Сохранить
        </button>
      </div>
    `
  );

  $('rrSave').onclick =
    saveResource;
}

async function saveResource() {

  const resource = {

    id:
      uid('R'),

    date:
      $('rrDate').value,

    organizationId:
      $('rrOrg').value,

    buildingId:
      $('rrBuilding').value,

    itr:
      num(
        $('rrItr')
          .value
      ),

    workers:
      num(
        $('rrWorkers')
          .value
      ),

    mechanizers:
      num(
        $('rrMech')
          .value
      ),

    equipmentType:
      $('rrEqType')
        .value
        .trim(),

    equipmentQty:
      num(
        $('rrEqQty')
          .value
      ),

    comment:
      $('rrComment')
        .value
        .trim(),

    createdAt:
      nowIso()
  };

  project.resources
    .push(
      resource
    );

  log(
    'Добавлено',
    'Ресурсы',
    `${resource.date} · ${nameById(project.organizations,resource.organizationId)}`
  );

  await saveProject();

  closeModal();

  renderAll();
}

function renderMilestones() {

  $('milestoneRows')
    .innerHTML =
      project.milestones
        .map(
          milestone =>
            `
              <tr>

                <td>
                  ${esc(nameById(project.buildings,milestone.buildingId))}
                </td>

                <td>
                  ${esc(milestone.title)}
                </td>

                <td>
                  ${milestone.contractDate || '—'}
                </td>

                <td>
                  ${milestone.workDate || '—'}
                </td>

                <td>
                  ${milestone.forecastDate || '—'}
                </td>

                <td>
                  ${milestone.factDate || '—'}
                </td>

                <td>
                  <button
                    class="row-btn"
                    data-ms="${milestone.id}"
                  >
                    ${esc(milestone.status || '')}
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
      button =>
        button.onclick =
          () =>
            openMilestoneEditor(
              button.dataset.ms
            )
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

  const buildingOptions =
    project.buildings
      .map(
        item =>
          `
            <option
              value="${item.id}"
              ${
                item.id ===
                milestone.buildingId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(item.name)}
            </option>
          `
      )
      .join('');

  openModal(
    id
      ? 'Ключевая дата'
      : 'Новая ключевая дата',

    `
      <div class="form-grid">

        <div class="field">
          <label>Здание</label>
          <select id="mBuilding">
            ${buildingOptions}
          </select>
        </div>

        <div class="field">
          <label>Наименование</label>
          <input
            id="mTitle"
            value="${esc(milestone.title || '')}"
          >
        </div>

        <div class="field">
          <label>Статус</label>
          <input
            id="mStatus"
            value="${esc(milestone.status || 'Не наступила')}"
          >
        </div>

        <div class="field">
          <label>Договорная дата</label>
          <input
            id="mContract"
            type="date"
            value="${milestone.contractDate || ''}"
          >
        </div>

        <div class="field">
          <label>Рабочая дата</label>
          <input
            id="mWork"
            type="date"
            value="${milestone.workDate || ''}"
          >
        </div>

        <div class="field">
          <label>Прогноз</label>
          <input
            id="mForecast"
            type="date"
            value="${milestone.forecastDate || ''}"
          >
        </div>

        <div class="field">
          <label>Факт</label>
          <input
            id="mFact"
            type="date"
            value="${milestone.factDate || ''}"
          >
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="mComment">${esc(milestone.comment || '')}</textarea>
      </div>

      <div class="editor-actions">
        <button
          id="mSave"
          class="btn primary"
        >
          Сохранить
        </button>
      </div>
    `
  );

  $('mSave').onclick =
    () =>
      saveMilestone(
        id
      );
}

async function saveMilestone(
  id
) {

  let milestone =
    id
      ? byId(
          project.milestones,
          id
        )
      : {
          id:
            uid('M')
        };

  Object.assign(
    milestone,
    {
      buildingId:
        $('mBuilding')
          .value,

      title:
        $('mTitle')
          .value
          .trim(),

      status:
        $('mStatus')
          .value
          .trim(),

      contractDate:
        $('mContract')
          .value,

      workDate:
        $('mWork')
          .value,

      forecastDate:
        $('mForecast')
          .value,

      factDate:
        $('mFact')
          .value,

      comment:
        $('mComment')
          .value
          .trim(),

      updatedAt:
        nowIso()
    }
  );

  if (!id) {

    project.milestones
      .push(
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

function renderDemolition() {

  $('demolitionRows')
    .innerHTML =
      project.demolition
        .filter(
          item =>
            item.active !==
            false
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
                    data-dem-status="${item.id}"
                  >
                    ${
                      STATUS_LIST
                        .map(
                          status =>
                            `
                              <option
                                ${
                                  status ===
                                  item.status
                                    ? 'selected'
                                    : ''
                                }
                              >
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
                    value="${item.planEnd || ''}"
                  >
                </td>

                <td>
                  <input
                    type="date"
                    data-dem-forecast="${item.id}"
                    value="${item.forecastEnd || ''}"
                  >
                </td>

                <td>
                  <input
                    type="date"
                    data-dem-fact="${item.id}"
                    value="${item.factEnd || ''}"
                  >
                </td>

                <td>
                  <input
                    data-dem-comment="${item.id}"
                    value="${esc(item.comment || '')}"
                  >
                </td>

              </tr>
            `
        )
        .join('');

  document
    .querySelectorAll(
      '[data-dem-status],' +
      '[data-dem-plan],' +
      '[data-dem-forecast],' +
      '[data-dem-fact],' +
      '[data-dem-comment]'
    )
    .forEach(
      element =>
        element.onchange =
          () =>
            saveDemInline(
              element
            )
    );
}

async function saveDemInline(
  element
) {

  const id =
    element.dataset.demStatus ||
    element.dataset.demPlan ||
    element.dataset.demForecast ||
    element.dataset.demFact ||
    element.dataset.demComment;

  const item =
    byId(
      project.demolition,
      id
    );

  if (
    element.dataset.demStatus
  ) {
    item.status =
      element.value;
  }

  if (
    element.dataset.demPlan
  ) {
    item.planEnd =
      element.value;
  }

  if (
    element.dataset.demForecast
  ) {
    item.forecastEnd =
      element.value;
  }

  if (
    element.dataset.demFact
  ) {
    item.factEnd =
      element.value;
  }

  if (
    element.dataset.demComment
  ) {
    item.comment =
      element.value;
  }

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

  $('historyRows')
    .innerHTML =
      project.history
        .map(
          item =>
            `
              <tr>

                <td>
                  ${
                    new Date(
                      item.at
                    )
                      .toLocaleString(
                        'ru-RU'
                      )
                  }
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

  $('buildingList')
    .innerHTML =
      project.buildings
        .map(
          item =>
            `
              <div class="item">
                <span>${esc(item.name)}</span>
              </div>
            `
        )
        .join('');

  $('workList')
    .innerHTML =
      project.works
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
              </div>
            `
        )
        .join('');

  $('orgList')
    .innerHTML =
      project.organizations
        .map(
          item =>
            `
              <div class="item">
                <span>${esc(item.name)}</span>
              </div>
            `
        )
        .join('');

  $('projectMeta')
    .innerHTML =
      `
        <div class="item">
          <span>Версия структуры</span>
          <strong>${project.schemaVersion}</strong>
        </div>

        <div class="item">
          <span>Последнее изменение</span>
          <strong>
            ${
              new Date(
                project.meta.updatedAt
              )
                .toLocaleString(
                  'ru-RU'
                )
            }
          </strong>
        </div>

        <div class="item">
          <span>Последняя резервная копия</span>
          <strong>
            ${
              project.meta.lastBackupAt
                ? new Date(
                    project.meta.lastBackupAt
                  )
                    .toLocaleString(
                      'ru-RU'
                    )
                : 'не создавалась'
            }
          </strong>
        </div>

        <div class="item">
          <span>Фронтов</span>
          <strong>${project.fronts.length}</strong>
        </div>

        <div class="item">
          <span>Записей факта</span>
          <strong>${project.factLog.length}</strong>
        </div>
      `;
}

async function addSimple(
  kind
) {

  const map = {
    building: [
      'newBuilding',
      'buildings',
      'BLD',
      'Здание'
    ],

    work: [
      'newWork',
      'works',
      'WRK',
      'Вид работы'
    ],

    org: [
      'newOrg',
      'organizations',
      'ORG',
      'Организация'
    ]
  };

  const [
    input,
    list,
    prefix,
    label
  ] =
    map[kind];

  const name =
    $(input)
      .value
      .trim();

  if (!name) {
    return;
  }

  project[list]
    .push({
      id:
        uid(prefix),

      name,

      active:
        true
    });

  $(input).value =
    '';

  log(
    'Создано',
    label,
    name
  );

  await saveProject();

  renderAll();
}

async function exportBackup() {

  project.meta.lastBackupAt =
    nowIso();

  await saveProject();

  const payload = {
    ...structuredClone(
      project
    ),

    exportedAt:
      nowIso(),

    source:
      'ACONS Planning local'
  };

  download(
    `ACONS_Planning_${
      new Date()
        .toISOString()
        .slice(
          0,
          16
        )
        .replace(
          'T',
          '_'
        )
        .replace(
          ':',
          '-'
        )
    }.json`,

    JSON.stringify(
      payload,
      null,
      2
    )
  );

  renderAll();
}

async function readJsonFile(
  file
) {

  const text =
    await file.text();

  const data =
    JSON.parse(
      text
    );

  if (
    !data ||
    !Array.isArray(
      data.buildings
    ) ||
    !Array.isArray(
      data.fronts
    )
  ) {

    throw new Error(
      'Это не резервная копия ACONS Planning.'
    );
  }

  return data;
}

async function restoreProject(
  file
) {

  try {

    const data =
      await readJsonFile(
        file
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

    project =
      normalizeProject(
        data
      );

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

    $('restoreInput')
      .value =
        '';
  }
}

function normalizeProject(
  data
) {

  const base =
    emptyProject();

  return {
    ...base,
    ...data,

    meta: {
      ...base.meta,
      ...(
        data.meta ||
        {}
      )
    },

    buildings:
      data.buildings ||
      base.buildings,

    works:
      data.works ||
      base.works,

    organizations:
      data.organizations ||
      [],

    structures:
      data.structures ||
      [],

    fronts:
      data.fronts ||
      [],

    planLog:
      data.planLog ||
      [],

    factLog:
      data.factLog ||
      [],

    resources:
      data.resources ||
      [],

    milestones:
      data.milestones ||
      [],

    demolition:
      data.demolition ||
      base.demolition,

    history:
      data.history ||
      []
  };
}

function compareCollections(
  current,
  incoming,
  key
) {

  const currentMap =
    new Map(
      (
        current ||
        []
      )
        .map(
          item => [
            String(
              item[key]
            ),
            item
          ]
        )
    );

  const incomingMap =
    new Map(
      (
        incoming ||
        []
      )
        .map(
          item => [
            String(
              item[key]
            ),
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
      !currentMap.has(
        id
      )
    ) {

      added.push(
        row
      );

    } else if (
      JSON.stringify(
        currentMap.get(
          id
        )
      ) !==
      JSON.stringify(
        row
      )
    ) {

      changed.push({
        before:
          currentMap.get(
            id
          ),

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
      !incomingMap.has(
        id
      )
    ) {

      missing.push(
        row
      );
    }
  }

  return {
    added,
    changed,
    missing
  };
}

function buildComparison(
  incoming
) {

  const sets = [
    [
      'fronts',
      'Фронты'
    ],
    [
      'structures',
      'Структуры'
    ],
    [
      'planLog',
      'План'
    ],
    [
      'factLog',
      'Факт'
    ],
    [
      'resources',
      'Ресурсы'
    ],
    [
      'milestones',
      'Ключевые даты'
    ],
    [
      'demolition',
      'Демонтаж'
    ],
    [
      'buildings',
      'Здания'
    ],
    [
      'works',
      'Виды работ'
    ],
    [
      'organizations',
      'Организации'
    ]
  ];

  return sets
    .map(
      (
        [
          key,
          label
        ]
      ) => ({
        key,
        label,

        ...compareCollections(
          project[key],
          incoming[key],
          'id'
        )
      })
    );
}

async function compareProjectFile(
  file
) {

  try {

    compareIncoming =
      normalizeProject(
        await readJsonFile(
          file
        )
      );

    const comparison =
      buildComparison(
        compareIncoming
      );

    const totals =
      comparison
        .reduce(
          (
            accumulator,
            item
          ) => ({
            added:
              accumulator.added +
              item.added.length,

            changed:
              accumulator.changed +
              item.changed.length,

            missing:
              accumulator.missing +
              item.missing.length
          }),

          {
            added:
              0,

            changed:
              0,

            missing:
              0
          }
        );

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
            <h2>${totals.added}</h2>
          </div>

          <div class="compare-box">
            <span>Изменено</span>
            <h2>${totals.changed}</h2>
          </div>

          <div class="compare-box">
            <span>Есть только у меня</span>
            <h2>${totals.missing}</h2>
          </div>

        </div>

        <div class="compare-details">

          ${
            comparison
              .map(
                item =>
                  `
                    <div class="item">

                      <span>
                        ${esc(item.label)}
                      </span>

                      <strong>
                        +${item.added.length}
                        /
                        ~${item.changed.length}
                        /
                        локально ${item.missing.length}
                      </strong>

                    </div>
                  `
              )
              .join('')
          }

        </div>

        <p class="muted">
          «Объединить» добавит новые записи
          и заменит совпадающие ID версией из файла,
          но не удалит локальные записи.
          «Заменить полностью» сделает файл
          новой рабочей базой.
        </p>

        <div class="editor-actions">

          <button
            id="mergeCompare"
            class="btn"
          >
            Объединить
          </button>

          <button
            id="replaceCompare"
            class="btn primary"
          >
            Заменить полностью
          </button>

        </div>
      `
    );

    $('mergeCompare').onclick =
      mergeCompared;

    $('replaceCompare').onclick =
      replaceCompared;

  } catch (error) {

    alert(
      'Ошибка сравнения: ' +
      error.message
    );

  } finally {

    $('compareInput')
      .value =
        '';
  }
}

async function mergeCompared() {

  if (
    !compareIncoming
  ) {
    return;
  }

  const keys = [
    'buildings',
    'organizations',
    'works',
    'structures',
    'fronts',
    'planLog',
    'factLog',
    'resources',
    'milestones',
    'demolition'
  ];

  for (
    const key
    of keys
  ) {

    const map =
      new Map(
        project[key]
          .map(
            item => [
              String(
                item.id
              ),
              item
            ]
          )
      );

    for (
      const row
      of (
        compareIncoming[key] ||
        []
      )
    ) {

      map.set(
        String(
          row.id
        ),
        row
      );
    }

    project[key] =
      [
        ...map.values()
      ];
  }

  log(
    'Объединено',
    'Проект',
    'Применены изменения из сравниваемого файла'
  );

  await saveProject();

  compareIncoming =
    null;

  closeModal();

  renderAll();

  alert(
    'Изменения объединены.'
  );
}

async function replaceCompared() {

  if (
    !compareIncoming
  ) {
    return;
  }

  if (
    !confirm(
      'Полностью заменить текущий проект версией из файла?'
    )
  ) {
    return;
  }

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

  closeModal();

  renderAll();
}

function renderBackupNotice() {

  const last =
    project
      ?.meta
      ?.lastBackupAt;

  if (!last) {

    $('backupNotice')
      .textContent =
        'Резервная копия проекта еще не создавалась.';

    return;
  }

  const days =
    Math.floor(
      (
        Date.now() -
        Date.parse(
          last
        )
      ) /
      86400000
    );

  $('backupNotice')
    .textContent =
      `Последняя резервная копия: ${
        new Date(
          last
        )
          .toLocaleString(
            'ru-RU'
          )
      }${
        days >= 7
          ? ' · рекомендуется создать новую копию'
          : ''
      }`;
}

async function readImportFile(
  event
) {

  const file =
    event.target
      .files[0];

  if (!file) {
    return;
  }

  try {

    const data =
      await file
        .arrayBuffer();

    const workbook =
      XLSX.read(
        data,
        {
          type:
            'array',

          cellDates:
            true
        }
      );

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    importRows =
      XLSX.utils
        .sheet_to_json(
          sheet,
          {
            defval:
              ''
          }
        );

    $('importInfo')
      .classList
      .remove(
        'hidden'
      );

    $('importInfo')
      .textContent =
        `Прочитано строк: ${importRows.length}. Показываю первые 50.`;

    const headers =
      importRows[0]
        ? Object.keys(
            importRows[0]
          )
        : [];

    $('importHead')
      .innerHTML =
        '<tr>' +

        headers
          .map(
            header =>
              `<th>${esc(header)}</th>`
          )
          .join('') +

        '</tr>';

    $('importBody')
      .innerHTML =
        importRows
          .slice(
            0,
            50
          )
          .map(
            row =>
              '<tr>' +

              headers
                .map(
                  header =>
                    `<td>${esc(row[header])}</td>`
                )
                .join('') +

              '</tr>'
          )
          .join('');

    $('commitImportBtn')
      .disabled =
        !importRows.length;

  } catch (error) {

    alert(
      'Ошибка чтения файла: ' +
      error.message
    );
  }
}

function normDate(
  value
) {

  if (!value) {
    return '';
  }

  if (
    value instanceof Date
  ) {

    return value
      .toISOString()
      .slice(
        0,
        10
      );
  }

  const string =
    String(
      value
    )
      .trim();

  const match =
    string.match(
      /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/
    );

  if (match) {

    const year =
      match[3].length ===
        2
        ? '20' +
          match[3]
        : match[3];

    return `${year}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/
    .test(
      string
    )
      ? string
      : '';
}

function ensureNamed(
  list,
  prefix,
  name,
  extra = {}
) {

  let item =
    list.find(
      row =>
        row.name ===
        name
    );

  if (!item) {

    item = {
      id:
        uid(prefix),

      name,

      active:
        true,

      ...extra
    };

    list.push(
      item
    );
  }

  return item;
}

async function commitImport() {

  if (
    !importRows.length
  ) {
    return;
  }

  if (
    !confirm(
      `Импортировать ${importRows.length} строк? Перед импортом рекомендуется сохранить проект.`
    )
  ) {
    return;
  }

  let created =
    0;

  let updated =
    0;

  let skipped =
    0;

  for (
    const row
    of importRows
  ) {

    const buildingName =
      String(
        row['Здание'] ||
        ''
      )
        .trim();

    const workName =
      String(
        row['Работа'] ||
        row['Вид работы'] ||
        ''
      )
        .trim();

    if (
      !buildingName ||
      !workName
    ) {

      skipped++;
      continue;
    }

    const building =
      ensureNamed(
        project.buildings,
        'BLD',
        buildingName
      );

    const work =
      ensureNamed(
        project.works,
        'WRK',
        workName,
        {
          unit:
            String(
              row['Ед. изм.'] ||
              ''
            )
              .trim()
        }
      );

    const organizationName =
      String(
        row['Организация'] ||
        ''
      )
        .trim();

    const organization =
      organizationName
        ? ensureNamed(
            project.organizations,
            'ORG',
            organizationName
          )
        : null;

    const signature =
      [
        building.id,
        row['Блок'] || '',
        row['Этаж'] || '',
        row['Захватка'] || '',
        row['Ось'] || '',
        row['Сторона'] || '',
        row['Зона'] || '',
        row['№ помещения'] ||
        row['Номер помещения'] ||
        ''
      ]
        .map(
          String
        )
        .join('|');

    let structure =
      project.structures
        .find(
          item =>
            item.signature ===
            signature
        );

    if (!structure) {

      structure = {
        id:
          uid('STR'),

        signature,

        buildingId:
          building.id,

        block:
          String(
            row['Блок'] ||
            ''
          )
            .trim(),

        floor:
          row['Этаж'] ===
            ''
            ? ''
            : num(
                row['Этаж']
              ),

        capture:
          String(
            row['Захватка'] ||
            ''
          )
            .trim(),

        axis:
          String(
            row['Ось'] ||
            ''
          )
            .trim(),

        side:
          String(
            row['Сторона'] ||
            ''
          )
            .trim(),

        zone:
          String(
            row['Зона'] ||
            ''
          )
            .trim(),

        roomNo:
          String(
            row['№ помещения'] ||
            row['Номер помещения'] ||
            ''
          )
            .trim(),

        roomName:
          String(
            row['Помещение'] ||
            row['Название помещения'] ||
            ''
          )
            .trim()
      };

      project.structures
        .push(
          structure
        );
    }

    let front =
      project.fronts
        .find(
          item =>
            item.structureId ===
              structure.id &&
            item.workId ===
              work.id
        );

    if (!front) {

      front = {
        id:
          uid('F'),

        structureId:
          structure.id,

        workId:
          work.id,

        status:
          'Не начато',

        createdAt:
          nowIso()
      };

      project.fronts
        .push(
          front
        );

      created++;

    } else {

      updated++;
    }

    Object.assign(
      front,
      {
        organizationId:
          organization
            ?.id ||
          front.organizationId ||
          '',

        unit:
          String(
            row['Ед. изм.'] ||
            front.unit ||
            ''
          )
            .trim(),

        totalQty:
          row['Общий объем'] ===
            ''
            ? num(
                front.totalQty
              )
            : num(
                row['Общий объем']
              ),

        doneQty:
          row['Накопительный итог'] ===
            ''
            ? num(
                front.doneQty
              )
            : num(
                row['Накопительный итог']
              ),

        status:
          String(
            row['Статус'] ||
            front.status ||
            'Не начато'
          ),

        contractStart:
          normDate(
            row['Договорное начало']
          ) ||
          front.contractStart ||
          '',

        contractEnd:
          normDate(
            row['Договорное окончание']
          ) ||
          front.contractEnd ||
          '',

        baselineStart:
          normDate(
            row['Базовое начало']
          ) ||
          front.baselineStart ||
          '',

        baselineEnd:
          normDate(
            row['Базовое окончание']
          ) ||
          front.baselineEnd ||
          '',

        planStart:
          normDate(
            row['Рабочее начало']
          ) ||
          front.planStart ||
          '',

        planEnd:
          normDate(
            row['Рабочее окончание']
          ) ||
          front.planEnd ||
          '',

        forecastEnd:
          normDate(
            row['Прогнозное окончание']
          ) ||
          front.forecastEnd ||
          '',

        updatedAt:
          nowIso()
      }
    );
  }

  log(
    'Импорт',
    'Проект',
    `Создано ${created}, обновлено ${updated}, пропущено ${skipped}`
  );

  await saveProject();

  $('importInfo')
    .textContent =
      `Импорт завершен. Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.`;

  importRows =
    [];

  $('commitImportBtn')
    .disabled =
      true;

  renderAll();
}

function printCurrent() {

  const active =
    document
      .querySelector(
        '.panel:not(.hidden)'
      );

  document
    .querySelectorAll(
      '.panel'
    )
    .forEach(
      panel =>
        panel
          .classList
          .remove(
            'print-active'
          )
    );

  if (active) {

    active
      .classList
      .add(
        'print-active'
      );
  }

  window.print();

  setTimeout(
    () =>
      active
        ?.classList
        .remove(
          'print-active'
        ),
    500
  );
}

function switchTab(
  name
) {

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button =>
        button
          .classList
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
        panel
          .classList
          .add(
            'hidden'
          )
    );

  $(
    `tab-${name}`
  )
    .classList
    .remove(
      'hidden'
    );

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

  $('commitImportBtn').onclick =
    commitImport;

  $('clearProjectBtn').onclick =
    async () => {

      if (
        !confirm(
          'Очистить рабочие данные? Справочники зданий и видов работ останутся.'
        )
      ) {
        return;
      }

      const fresh =
        emptyProject();

      fresh.organizations =
        project.organizations;

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

  project =
    await dbGet();

  if (!project) {

    project =
      emptyProject();

    await saveProject();

  } else {

    project =
      normalizeProject(
        project
      );
  }

  bindUi();

  renderBackupNotice();

  renderAll();

  $('pfTo').value =
    today();

  $('rTo').value =
    today();
}

document
  .addEventListener(
    'DOMContentLoaded',
    () =>
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
        )
  );

