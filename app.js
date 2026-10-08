'use strict';

/* =========================================================
   ACONS PLANNING
   Локальный пилот
   Версия структуры: 2.2.0
   ========================================================= */


const $ =
  id =>
    document.getElementById(id);


const DB_NAME =
  'acons_planning_local';

const DB_VERSION =
  2;

const STORE =
  'project';

const PROJECT_KEY =
  'main';

const SCHEMA_VERSION =
  '2.2.0';


/* =========================================================
   СПРАВОЧНИКИ ПО УМОЛЧАНИЮ
   ========================================================= */


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


/* =========================================================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
   ========================================================= */


let db =
  null;


let project =
  null;


let compareIncoming =
  null;


let compareItems =
  [];


/* Импорт */

let importWorkbook =
  null;

let importFileName =
  '';

let importSheetName =
  '';

let importHeaders =
  [];

let importRawRows =
  [];

let importRows =
  [];

let importMapping =
  {};

let importModeResolved =
  'fronts';

let importMappingMode =
  '';


/* Ресурсы */

let resourceView =
  'journal';


let resourceCharts =
  [];


let resourcePlanFactChart =
  null;


let resourceColumns = [
  'date',
  'organization',
  'building',
  'work',
  'front',
  'itr',
  'workers',
  'mechanizers',
  'equipmentType',
  'equipmentQty',
  'comment'
];


const RESOURCE_COLUMN_LABELS = {
  date:
    'Дата',

  organization:
    'Организация',

  building:
    'Здание',

  work:
    'Работа',

  front:
    'Фронт',

  itr:
    'ИТР',

  workers:
    'Рабочие',

  mechanizers:
    'Мех.',

  equipmentType:
    'Техника',

  equipmentQty:
    'Кол.',

  comment:
    'Комментарий'
};


/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================= */


const uid =
  prefix =>
    `${prefix}-${crypto.randomUUID()}`;


const today =
  () =>
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


const nowIso =
  () =>
    new Date()
      .toISOString();


const clone =
  value =>
    JSON.parse(
      JSON.stringify(
        value
      )
    );


const num =
  value =>
    Number(
      String(
        value ??
        0
      )
        .replace(
          /\s/g,
          ''
        )
        .replace(
          ',',
          '.'
        )
    ) ||
    0;


const fmt =
  value =>
    Math.round(
      num(value) *
      100
    ) /
    100;


const fmt1 =
  value =>
    Math.round(
      num(value) *
      10
    ) /
    10;


const esc =
  value =>
    String(
      value ??
      ''
    )
      .replace(
        /[&<>"']/g,
        char => ({
          '&':
            '&amp;',

          '<':
            '&lt;',

          '>':
            '&gt;',

          '"':
            '&quot;',

          "'":
            '&#039;'
        })[char]
      );


const normText =
  value =>
    String(
      value ??
      ''
    )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


const normKey =
  value =>
    normText(
      value
    )
      .toLowerCase()
      .replace(
        /ё/g,
        'е'
      )
      .replace(
        /[№#]/g,
        'номер'
      )
      .replace(
        /[()]/g,
        ' '
      )
      .replace(
        /[._/\\-]+/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


const sameText =
  (
    a,
    b
  ) =>
    normKey(a) ===
    normKey(b);


const uniq =
  array =>
    [
      ...new Set(
        (
          array ||
          []
        )
          .filter(
            value =>
              value !==
                '' &&
              value !==
                null &&
              value !==
                undefined
          )
      )
    ];


const byId =
  (
    list,
    id
  ) =>
    (
      list ||
      []
    )
      .find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );


const nameById =
  (
    list,
    id
  ) =>
    byId(
      list,
      id
    )?.name ||
    '';


const diffDays =
  (
    a,
    b
  ) =>
    a &&
    b
      ? Math.round(
          (
            Date.parse(b) -
            Date.parse(a)
          ) /
          86400000
        )
      : null;


function dateRange(
  from,
  to
) {

  const result =
    [];

  if (
    !from ||
    !to
  ) {
    return result;
  }

  let current =
    new Date(
      `${from}T00:00:00`
    );

  const end =
    new Date(
      `${to}T00:00:00`
    );

  while (
    current <=
    end
  ) {

    result.push(
      current
        .toISOString()
        .slice(
          0,
          10
        )
    );

    current.setDate(
      current.getDate() +
      1
    );
  }

  return result;
}


function isWorkday(
  date
) {

  const day =
    new Date(
      `${date}T00:00:00`
    )
      .getDay();

  return (
    day !==
      0 &&
    day !==
      6
  );
}


function ruDate(
  value
) {

  if (!value) {
    return '';
  }

  const [
    year,
    month,
    day
  ] =
    value.split('-');

  return (
    `${day}.${month}.${year}`
  );
}


function shortDate(
  value
) {

  if (!value) {
    return '';
  }

  const [
    ,
    month,
    day
  ] =
    value.split('-');

  return (
    `${day}.${month}`
  );
}


function startOfWeek(
  dateString
) {

  const date =
    new Date(
      `${dateString}T00:00:00`
    );

  const weekday =
    date.getDay();

  const shift =
    weekday ===
      0
      ? -6
      : 1 -
        weekday;

  date.setDate(
    date.getDate() +
    shift
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


/* =========================================================
   СТАТУСЫ
   ========================================================= */


function normalizeStatus(
  value
) {

  const text =
    normKey(
      value
    );

  if (!text) {
    return '';
  }

  if (
    /не начат/.test(
      text
    )
  ) {
    return 'Не начато';
  }

  if (
    /приостанов|останов/.test(
      text
    )
  ) {
    return 'Приостановлено';
  }

  if (
    /огранич|блокир/.test(
      text
    )
  ) {
    return 'Ограничение';
  }

  if (
    /фронт готов|готово к старт/.test(
      text
    )
  ) {
    return 'Фронт готов';
  }

  if (
    /заверш|оконч|выполн/.test(
      text
    )
  ) {
    return 'Завершено';
  }

  if (
    /начат|в работе|производ/.test(
      text
    )
  ) {
    return 'В работе';
  }

  return normText(
    value
  );
}


/* =========================================================
   СТРУКТУРА ПРОЕКТА
   ========================================================= */


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
      DEFAULT_BUILDINGS
        .map(
          (
            name,
            index
          ) => ({

            id:
              `BLD-${String(
                index +
                1
              )
                .padStart(
                  3,
                  '0'
                )}`,

            name,

            active:
              true,

            sort:
              index +
              1
          })
        ),


    organizations:
      [],


    works:
      DEFAULT_WORKS
        .map(
          (
            row,
            index
          ) => ({

            id:
              `WRK-${String(
                index +
                1
              )
                .padStart(
                  3,
                  '0'
                )}`,

            name:
              row[0],

            section:
              row[1],

            unit:
              row[2],

            active:
              true,

            sort:
              index +
              1
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


    resourcePlans:
      [],


    milestones:
      [],


    numberedElements:
      [],


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
      [],


    demolition:
      DEFAULT_DEMOLITION
        .map(
          (
            name,
            index
          ) => ({

            id:
              `DEM-${String(
                index +
                1
              )
                .padStart(
                  3,
                  '0'
                )}`,

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


/* =========================================================
   INDEXED DB
   ========================================================= */


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


async function dbGetKey(
  key =
    PROJECT_KEY
) {

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
            key
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


async function dbPutKey(
  value,
  key =
    PROJECT_KEY
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


/* =========================================================
   МИГРАЦИЯ
   ========================================================= */


function normalizeProject(
  data
) {

  const base =
    emptyProject();


  const result = {

    ...base,

    ...(
      data ||
      {}
    )
  };


  result.meta = {

    ...base.meta,

    ...(
      (
        data ||
        {}
      ).meta ||
      {}
    )
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
    'resourcePlans',
    'milestones',
    'numberedElements',
    'contracts',
    'constraints',
    'diagrams',
    'diagramMarks',
    'scheduleVersions',
    'customFields',
    'views',
    'importProfiles',
    'importHistory',
    'history',
    'demolition'
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
    result.fronts
      .map(
        front => ({

          active:
            true,

          ...front
        })
      );


  result.numberedElements =
    result.numberedElements
      .map(
        item => ({

          active:
            true,

          uniqueScope:
            'context',

          ...item
        })
      );


  result.resources =
    result.resources
      .map(
        row => ({

          itr:
            0,

          workers:
            0,

          mechanizers:
            0,

          equipmentQty:
            0,

          ...row
        })
      );


  result.resourcePlans =
    result.resourcePlans ||
    [];


  result.schemaVersion =
    SCHEMA_VERSION;


  return result;
}


async function migrateIfNeeded(
  raw
) {

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

    return normalizeProject(
      raw
    );
  }


  const backupKey =
    `migration-backup-${Date.now()}`;


  await dbPutKey(
    clone(
      raw
    ),
    backupKey
  );


  const migrated =
    normalizeProject(
      raw
    );


  migrated.meta.lastMigrationAt =
    nowIso();


  migrated.meta.migrationFrom =
    oldVersion;


  migrated.meta.migrationBackupKey =
    backupKey;


  migrated.history.unshift({

    id:
      uid(
        'H'
      ),

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


/* =========================================================
   СОХРАНЕНИЕ И ИСТОРИЯ
   ========================================================= */


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
  details =
    {}
) {

  project.history.unshift({

    id:
      uid(
        'H'
      ),

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


/* =========================================================
   СКАЧИВАНИЕ ФАЙЛА
   ========================================================= */


function download(
  name,
  text,
  type =
    'application/json'
) {

  const blob =
    new Blob(
      [
        text
      ],
      {
        type
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
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


/* =========================================================
   ФРОНТЫ
   ========================================================= */


function activeFronts() {

  return project.fronts
    .filter(
      front =>
        front.active !==
        false
    );
}


function hydrateFront(
  front
) {

  if (!front) {

    return {};
  }


  const structure =
    byId(
      project.structures,
      front.structureId
    ) ||
    {};


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
      structure.block ||
      '',

    floor:
      structure.floor ??
      '',

    capture:
      structure.capture ||
      '',

    axis:
      structure.axis ||
      '',

    side:
      structure.side ||
      '',

    zone:
      structure.zone ||
      '',

    roomNo:
      structure.roomNo ||
      '',

    roomName:
      structure.roomName ||
      ''
  };
}


function frontLabel(
  front
) {

  if (!front) {

    return '—';
  }


  const hydrated =
    hydrateFront(
      front
    );


  return [

    hydrated.building,

    hydrated.block,

    hydrated.floor !==
      ''
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
    .filter(
      Boolean
    )
    .join(
      ' / '
    );
}


function structureSignature(
  structure
) {

  return [

    structure.buildingId ||
      '',

    structure.block ||
      '',

    structure.floor ??
      '',

    structure.capture ||
      '',

    structure.axis ||
      '',

    structure.side ||
      '',

    structure.zone ||
      '',

    structure.roomNo ||
      '',

    structure.roomName ||
      ''
  ]
    .map(
      normKey
    )
    .join(
      '|'
    );
}


/* =========================================================
   SELECT
   ========================================================= */


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
    [
      ...element.options
    ]
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


function selectOptions(
  list,
  value,
  allowBlank =
    false
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
            item.active !==
            false
        )
        .map(
          item =>
            `
              <option
                value="${item.id}"
                ${
                  String(
                    item.id
                  ) ===
                  String(
                    value
                  )
                    ? 'selected'
                    : ''
                }>
                ${esc(
                  item.name
                )}
              </option>
            `
        )
        .join(
          ''
        )
    }
  `;
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
    'pfWork',
    'rWork'
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
    'rOrg',
    'rDynOrg'
  ]
    .forEach(
      id =>
        fill(
          $(id),
          organizations,
          'Все организации'
        )
    );


  const fronts =
    activeFronts()
      .map(
        front => ({
          id:
            front.id,

          name:
            frontLabel(
              front
            )
        })
      );


  fill(
    $('rFront'),
    fronts,
    'Все фронты'
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


/* =========================================================
   СВОДКА
   ========================================================= */


function renderDashboard() {

  const fronts =
    activeFronts()
      .map(
        hydrateFront
      );


  $('dTotal').textContent =
    fronts.length;


  $('dWork').textContent =
    fronts
      .filter(
        front =>
          front.status ===
          'В работе'
      )
      .length;


  $('dDone').textContent =
    fronts
      .filter(
        front =>
          front.status ===
            'Завершено' ||
          front.completed
      )
      .length;


  $('dAccepted').textContent =
    fronts
      .filter(
        front =>
          front.accepted
      )
      .length;


  $('dLate').textContent =
    fronts
      .filter(
        front =>
          front.contractEnd &&
          !front.accepted &&
          front.contractEnd <
          today()
      )
      .length;


  $('dRisk').textContent =
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


  $('dCritical').innerHTML =
    critical
      .map(
        front =>
          `
            <div class="item">
              <span>
                ${esc(
                  frontLabel(
                    front
                  )
                )}
              </span>

              <strong>
                ${esc(
                  front.status
                )}
              </strong>
            </div>
          `
      )
      .join(
        ''
      ) ||
    '<div class="muted">Нет критичных фронтов</div>';


  const lastDate =
    [
      ...project.resources
    ]
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.date
          )
            .localeCompare(
              String(
                b.date
              )
            )
      )
      .slice(
        -1
      )[0]
      ?.date;


  const rows =
    project.resources
      .filter(
        row =>
          row.date ===
          lastDate
      );


  const people =
    rows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.itr
          ) +
          num(
            row.workers
          ) +
          num(
            row.mechanizers
          ),
        0
      );


  const equipment =
    rows
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


  $('dResources').innerHTML =
    lastDate
      ? `
          <div class="item">
            <span>Дата</span>
            <strong>${ruDate(lastDate)}</strong>
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


/* =========================================================
   ШАХМАТКА
   ========================================================= */


function updateMatrixDependent() {

  const buildingId =
    $('mfBuilding')?.value ||
    'all';


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
        (
          a,
          b
        ) =>
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


function matrixFiltered() {

  return activeFronts()
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


function statusRowClass(
  status
) {

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
            <tr class="${statusRowClass(
              front.status
            )}">

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
      .join(
        ''
      );


  document
    .querySelectorAll(
      '[data-edit-front]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openFrontEditor(
              button.dataset
                .editFront
            );
      }
    );
}


/* =========================================================
   МОДАЛЬНОЕ ОКНО
   ========================================================= */


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


  $('modalBody').innerHTML =
    '';
}


/* =========================================================
   РЕДАКТОР ФРОНТА
   ========================================================= */


function frontForm(
  front =
    {}
) {

  const structure =
    front.id
      ? byId(
          project.structures,
          front.structureId
        ) ||
        {}
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
  id =
    null
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
        archiveFront(
          id
        );
  }
}


async function saveFrontFromModal(
  id
) {

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
        uid(
          'STR'
        ),

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
            uid(
              'F'
            ),

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

    frontLabel(
      front
    )
  );


  await saveProject();


  closeModal();


  renderAll();
}


async function archiveFront(
  id
) {

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
    frontLabel(
      front
    )
  );


  await saveProject();


  closeModal();


  renderAll();
}


/* =========================================================
   ГАНТ
   ========================================================= */


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
      .slice(
        -1
      )[0];


  const total =
    Math.max(
      1,

      diffDays(
        min,
        max
      ) +
      1
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
                ) +
                1
              ) /
              total *
              100
            );


          return `
            <div class="gantt-row">

              <div class="gantt-name">

                <b>
                  ${esc(
                    item.front.work
                  )}
                </b>

                <br>

                <small>
                  ${esc(
                    frontLabel(
                      item.front
                    )
                  )}
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
      .join(
        ''
      );
}


/* =========================================================
   ПЛАН / ФАКТ РАБОТ
   ========================================================= */


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

            (
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
    $('pfFrom').value;


  const to =
    $('pfTo').value;


  const plan =
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


  const fact =
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
    plan.reduce(
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
    fact.reduce(
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


  const planCumulative =
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


  const factCumulative =
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
    activeFronts()
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


  $('pfPlanPeriod').textContent =
    fmt(
      planPeriod
    );


  $('pfFactPeriod').textContent =
    fmt(
      factPeriod
    );


  $('pfVarPeriod').textContent =
    fmt(
      factPeriod -
      planPeriod
    );


  $('pfPlanCum').textContent =
    fmt(
      planCumulative
    );


  $('pfFactCum').textContent =
    fmt(
      factCumulative
    );


  $('pfPp').textContent =
    fmt(
      total
        ? (
            factCumulative /
            total -
            planCumulative /
            total
          ) *
          100
        : 0
    );


  $('planRows').innerHTML =
    [
      ...plan
    ]
      .sort(
        (
          a,
          b
        ) =>
          b.date
            .localeCompare(
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
                  frontLabel(
                    byId(
                      project.fronts,
                      row.frontId
                    )
                  )
                )}
              </td>

              <td>
                ${fmt(row.qty)}
              </td>

              <td>
                ${fmt(row.people)}
              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  $('factRows').innerHTML =
    [
      ...fact
    ]
      .sort(
        (
          a,
          b
        ) =>
          b.date
            .localeCompare(
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
                  frontLabel(
                    byId(
                      project.fronts,
                      row.frontId
                    )
                  )
                )}
              </td>

              <td>
                ${fmt(row.qty)}
              </td>

              <td>
                ${fmt(row.cumulative)}
              </td>

              <td>
                ${fmt(row.people)}
              </td>

            </tr>
          `
      )
      .join(
        ''
      );
}


function openLogEditor(
  mode
) {

  const frontOptions =
    activeFronts()
      .map(
        front =>
          `
            <option value="${front.id}">
              ${esc(
                frontLabel(
                  front
                )
              )}
            </option>
          `
      )
      .join(
        ''
      );


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
            ${frontOptions}
          </select>
        </div>

        <div class="field">
          <label>Дата</label>

          <input
            id="lDate"
            type="date"
            value="${today()}">
        </div>

        <div class="field">
          <label>Объем</label>

          <input
            id="lQty"
            type="number"
            step="any">
        </div>

        <div class="field">
          <label>Люди</label>

          <input
            id="lPeople"
            type="number">
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
      saveLog(
        mode
      );
}


async function saveLog(
  mode
) {

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
        uid(
          'P'
        ),

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

    const previous =
      project.factLog
        .filter(
          row =>
            row.frontId ===
              frontId &&
            row.date <=
              date
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


    const cumulative =
      $('lCum').value ===
        ''
        ? previous +
          quantity
        : num(
            $('lCum').value
          );


    project.factLog.push({

      id:
        uid(
          'FCT'
        ),

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
        num(
          front.doneQty
        ),
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


/* =========================================================
   РЕСУРСЫ — ФИЛЬТР
   ========================================================= */


function resourceFiltered(
  options =
    {}
) {

  const from =
    options.from ??
    $('rFrom').value;


  const to =
    options.to ??
    $('rTo').value;


  const organizationId =
    options.organizationId ??
    $('rOrg').value;


  const buildingId =
    options.buildingId ??
    $('rBuilding').value;


  const workId =
    options.workId ??
    $('rWork').value;


  const frontId =
    options.frontId ??
    $('rFront').value;


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
          !organizationId ||
          row.organizationId ===
            organizationId
        ) &&

        (
          buildingId ===
            'all' ||
          !buildingId ||
          row.buildingId ===
            buildingId
        ) &&

        (
          workId ===
            'all' ||
          !workId ||
          row.workId ===
            workId
        ) &&

        (
          frontId ===
            'all' ||
          !frontId ||
          row.frontId ===
            frontId
        )
    );
}


/* =========================================================
   РЕСУРСЫ — ЖУРНАЛ
   ========================================================= */


function resourceColumnValue(
  row,
  column
) {

  if (
    column ===
    'date'
  ) {

    return ruDate(
      row.date
    );
  }


  if (
    column ===
    'organization'
  ) {

    return nameById(
      project.organizations,
      row.organizationId
    ) ||
    '—';
  }


  if (
    column ===
    'building'
  ) {

    return nameById(
      project.buildings,
      row.buildingId
    ) ||
    '—';
  }


  if (
    column ===
    'work'
  ) {

    return nameById(
      project.works,
      row.workId
    ) ||
    '—';
  }


  if (
    column ===
    'front'
  ) {

    return row.frontId
      ? frontLabel(
          byId(
            project.fronts,
            row.frontId
          )
        )
      : '—';
  }


  if (
    [
      'itr',
      'workers',
      'mechanizers',
      'equipmentQty'
    ]
      .includes(
        column
      )
  ) {

    return fmt(
      row[column]
    );
  }


  return row[column] ??
  '';
}


function renderResourceColumnPanel() {

  const panel =
    $('resourceColumnsPanel');


  panel.innerHTML =
    `
      <div class="mapping-grid">

        ${
          Object.entries(
            RESOURCE_COLUMN_LABELS
          )
            .map(
              (
                [
                  key,
                  label
                ]
              ) =>
                `
                  <label class="check-line">

                    <input
                      type="checkbox"
                      data-resource-column="${key}"
                      ${
                        resourceColumns
                          .includes(
                            key
                          )
                          ? 'checked'
                          : ''
                      }>

                    ${esc(label)}

                  </label>
                `
            )
            .join(
              ''
            )
        }

      </div>
    `;


  panel
    .querySelectorAll(
      '[data-resource-column]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          () => {

            const key =
              checkbox.dataset
                .resourceColumn;


            if (
              checkbox.checked
            ) {

              if (
                !resourceColumns
                  .includes(
                    key
                  )
              ) {

                resourceColumns.push(
                  key
                );
              }

            } else {

              resourceColumns =
                resourceColumns
                  .filter(
                    item =>
                      item !==
                      key
                  );
            }


            renderResourceJournal();
          };
      }
    );
}


function renderResourceJournal() {

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
        num(
          row.itr
        ) +
        num(
          row.workers
        ) +
        num(
          row.mechanizers
        );
    }
  );


  $('rItr').textContent =
    fmt(
      sum(
        'itr'
      )
    );


  $('rWorkers').textContent =
    fmt(
      sum(
        'workers'
      )
    );


  $('rMech').textContent =
    fmt(
      sum(
        'mechanizers'
      )
    );


  $('rTotalPeople').textContent =
    fmt(
      sum(
        'itr'
      ) +
      sum(
        'workers'
      ) +
      sum(
        'mechanizers'
      )
    );


  $('rPeak').textContent =
    fmt(
      Math.max(
        0,
        ...Object.values(
          daily
        )
      )
    );


  $('rEquipDays').textContent =
    fmt(
      sum(
        'equipmentQty'
      )
    );


  $('resourceHead').innerHTML =
    `
      <tr>

        ${
          resourceColumns
            .map(
              key =>
                `<th>${esc(
                  RESOURCE_COLUMN_LABELS[key]
                )}</th>`
            )
            .join(
              ''
            )
        }

        <th></th>

      </tr>
    `;


  $('resourceRows').innerHTML =
    [
      ...rows
    ]
      .sort(
        (
          a,
          b
        ) =>
          b.date
            .localeCompare(
              a.date
            )
      )
      .map(
        row =>
          `
            <tr>

              ${
                resourceColumns
                  .map(
                    column =>
                      `
                        <td>
                          ${esc(
                            resourceColumnValue(
                              row,
                              column
                            )
                          )}
                        </td>
                      `
                  )
                  .join(
                    ''
                  )
              }

              <td>

                <button
                  class="row-btn"
                  data-resource-edit="${row.id}">
                  Открыть
                </button>

              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  document
    .querySelectorAll(
      '[data-resource-edit]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openResourceEditor(
              button.dataset
                .resourceEdit
            );
      }
    );
}


/* =========================================================
   РЕСУРСЫ — РЕДАКТОР СТРОКИ
   ========================================================= */


function openResourceEditor(
  id =
    null
) {

  const row =
    id
      ? byId(
          project.resources,
          id
        ) ||
        {}
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
                row.frontId
                  ? 'selected'
                  : ''
              }>

              ${esc(
                frontLabel(
                  front
                )
              )}

            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    id
      ? 'Ресурсы'
      : 'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">

          <label>Дата</label>

          <input
            id="rrDate"
            type="date"
            value="${row.date || today()}">

        </div>


        <div class="field">

          <label>Организация</label>

          <select id="rrOrg">

            ${selectOptions(
              project.organizations,
              row.organizationId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Здание</label>

          <select id="rrBuilding">

            ${selectOptions(
              project.buildings,
              row.buildingId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Вид работ</label>

          <select id="rrWork">

            ${selectOptions(
              project.works,
              row.workId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Фронт</label>

          <select id="rrFront">

            <option value="">—</option>

            ${frontOptions}

          </select>

        </div>


        <div class="field">

          <label>ИТР</label>

          <input
            id="rrItr"
            type="number"
            step="any"
            value="${row.itr ?? ''}">

        </div>


        <div class="field">

          <label>Подсобные рабочие</label>

          <input
            id="rrWorkers"
            type="number"
            step="any"
            value="${row.workers ?? ''}">

        </div>


        <div class="field">

          <label>Механизаторы</label>

          <input
            id="rrMech"
            type="number"
            step="any"
            value="${row.mechanizers ?? ''}">

        </div>


        <div class="field">

          <label>Наименование техники</label>

          <input
            id="rrEqType"
            value="${esc(
              row.equipmentType ||
              ''
            )}">

        </div>


        <div class="field">

          <label>Количество техники</label>

          <input
            id="rrEqQty"
            type="number"
            step="any"
            value="${row.equipmentQty ?? ''}">

        </div>

      </div>


      <div class="field">

        <label>Комментарий</label>

        <textarea id="rrComment">${esc(
          row.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        <button
          id="rrDelete"
          class="btn danger"
          ${
            id
              ? ''
              : 'style="display:none"'
          }>
          Удалить
        </button>


        <button
          id="rrSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );


  $('rrSave').onclick =
    () =>
      saveResource(
        id
      );


  if (id) {

    $('rrDelete').onclick =
      () =>
        deleteResource(
          id
        );
  }
}


async function saveResource(
  id
) {

  const existing =
    id
      ? byId(
          project.resources,
          id
        )
      : null;


  const row = {

    id:
      existing?.id ||
      uid(
        'R'
      ),

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
      existing?.createdAt ||
      nowIso(),

    updatedAt:
      nowIso(),

    source:
      existing?.source ||
      null,

    importFingerprint:
      existing?.importFingerprint ||
      ''
  };


  if (!row.date) {

    alert(
      'Укажи дату.'
    );

    return;
  }


  if (existing) {

    Object.assign(
      existing,
      row
    );

  } else {

    project.resources.push(
      row
    );
  }


  log(
    existing
      ? 'Изменено'
      : 'Добавлено',

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


async function deleteResource(
  id
) {

  const row =
    byId(
      project.resources,
      id
    );


  if (!row) {

    return;
  }


  if (
    !confirm(
      'Удалить эту запись ресурсов?'
    )
  ) {

    return;
  }


  project.resources =
    project.resources
      .filter(
        item =>
          item.id !==
          id
      );


  log(
    'Удалено',
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


/* =========================================================
   РЕСУРСЫ — ЕЖЕДНЕВНАЯ СВОДКА
   ========================================================= */


function dailyResourceRows(
  date
) {

  return resourceFiltered({

    from:
      date,

    to:
      date
  });
}


function renderResourceDaily() {

  const date =
    $('rDailyDate').value ||
    $('rTo').value ||
    today();


  $('rDailyDate').value =
    date;


  const rows =
    dailyResourceRows(
      date
    );


  const peopleByOrg =
    new Map();


  const equipmentRows =
    [];


  rows.forEach(
    row => {

      const organizationId =
        row.organizationId ||
        '';


      if (
        !peopleByOrg.has(
          organizationId
        )
      ) {

        peopleByOrg.set(
          organizationId,
          {

            organizationId,

            itr:
              0,

            workers:
              0,

            mechanizers:
              0
          }
        );
      }


      const item =
        peopleByOrg.get(
          organizationId
        );


      item.itr +=
        num(
          row.itr
        );


      item.workers +=
        num(
          row.workers
        );


      item.mechanizers +=
        num(
          row.mechanizers
        );


      if (
        row.equipmentType ||
        num(
          row.equipmentQty
        ) !==
        0
      ) {

        equipmentRows.push(
          row
        );
      }
    }
  );


  const peopleRows =
    [
      ...peopleByOrg.values()
    ]
      .filter(
        item =>
          item.itr !==
            0 ||
          item.workers !==
            0 ||
          item.mechanizers !==
            0
      )
      .sort(
        (
          a,
          b
        ) =>
          nameById(
            project.organizations,
            a.organizationId
          )
            .localeCompare(
              nameById(
                project.organizations,
                b.organizationId
              ),
              'ru'
            )
      );


  const totalPeople =
    peopleRows
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.itr +
          item.workers +
          item.mechanizers,
        0
      );


  const totalEquipment =
    equipmentRows
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


  $('rdPeopleTotal').textContent =
    fmt(
      totalPeople
    );


  $('rdEquipmentTotal').textContent =
    fmt(
      totalEquipment
    );


  $('rdPeopleBody').innerHTML =
    peopleRows
      .map(
        (
          item,
          index
        ) =>
          `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    item.organizationId
                  ) ||
                  '—'
                )}
              </td>

              <td>
                ${fmt(item.itr)}
              </td>

              <td>
                ${fmt(item.workers)}
              </td>

              <td>
                ${fmt(item.mechanizers)}
              </td>

              <td>
                <b>
                  ${fmt(
                    item.itr +
                    item.workers +
                    item.mechanizers
                  )}
                </b>
              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  const equipmentGrouped =
    new Map();


  equipmentRows.forEach(
    row => {

      const key =
        [
          row.organizationId ||
            '',
          normKey(
            row.equipmentType
          )
        ]
          .join(
            '|'
          );


      if (
        !equipmentGrouped.has(
          key
        )
      ) {

        equipmentGrouped.set(
          key,
          {

            organizationId:
              row.organizationId ||
              '',

            equipmentType:
              row.equipmentType ||
              '',

            quantity:
              0
          }
        );
      }


      equipmentGrouped.get(
        key
      ).quantity +=
        num(
          row.equipmentQty
        );
    }
  );


  const equipment =
    [
      ...equipmentGrouped.values()
    ]
      .sort(
        (
          a,
          b
        ) => {

          const orgCompare =
            nameById(
              project.organizations,
              a.organizationId
            )
              .localeCompare(
                nameById(
                  project.organizations,
                  b.organizationId
                ),
                'ru'
              );


          return orgCompare ||
            a.equipmentType
              .localeCompare(
                b.equipmentType,
                'ru'
              );
        }
      );


  $('rdEquipmentBody').innerHTML =
    equipment
      .map(
        (
          item,
          index
        ) =>
          `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    item.organizationId
                  ) ||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  item.equipmentType
                )}
              </td>

              <td>
                ${fmt(
                  item.quantity
                )}
              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  $('rdEquipmentFoot').textContent =
    fmt(
      totalEquipment
    );
}


/* =========================================================
   РЕСУРСЫ — ДИАГРАММЫ
   ========================================================= */


function destroyResourceCharts() {

  resourceCharts
    .forEach(
      chart => {

        try {

          chart.destroy();

        } catch (
          error
        ) {

          console.warn(
            error
          );
        }
      }
    );


  resourceCharts =
    [];
}


function resourceDatesForDynamics(
  rows
) {

  return uniq(
    rows
      .map(
        row =>
          row.date
      )
  )
    .sort();
}


function renderResourceDynamics() {

  destroyResourceCharts();


  const container =
    $('resourceCharts');


  container.innerHTML =
    '';


  if (
    typeof Chart ===
    'undefined'
  ) {

    container.innerHTML =
      '<div class="card">Библиотека диаграмм не загрузилась.</div>';

    return;
  }


  const type =
    $('rDynType').value;


  const selectedOrg =
    $('rDynOrg').value;


  const rows =
    resourceFiltered();


  let organizationIds =
    uniq(
      rows
        .map(
          row =>
            row.organizationId
        )
    );


  if (
    selectedOrg !==
    'all'
  ) {

    organizationIds =
      organizationIds
        .filter(
          id =>
            id ===
            selectedOrg
        );
  }


  organizationIds
    .sort(
      (
        a,
        b
      ) =>
        nameById(
          project.organizations,
          a
        )
          .localeCompare(
            nameById(
              project.organizations,
              b
            ),
            'ru'
          )
    );


  if (
    !organizationIds.length
  ) {

    container.innerHTML =
      '<div class="card muted">Нет данных для диаграмм.</div>';

    return;
  }


  const globalDates =
    resourceDatesForDynamics(
      rows
    );


  organizationIds
    .forEach(
      organizationId => {

        const organizationName =
          nameById(
            project.organizations,
            organizationId
          ) ||
          'Без организации';


        const card =
          document.createElement(
            'div'
          );


        card.className =
          'card';


        card.innerHTML =
          `
            <h2>
              ${esc(
                organizationName
              )}
            </h2>

            <canvas></canvas>
          `;


        container.appendChild(
          card
        );


        const canvas =
          card.querySelector(
            'canvas'
          );


        const organizationRows =
          rows
            .filter(
              row =>
                row.organizationId ===
                organizationId
            );


        const reportDates =
          new Set(
            organizationRows
              .map(
                row =>
                  row.date
              )
          );


        const values =
          globalDates
            .map(
              date => {

                const dayRows =
                  organizationRows
                    .filter(
                      row =>
                        row.date ===
                        date
                    );


                if (
                  !reportDates.has(
                    date
                  )
                ) {

                  return null;
                }


                if (
                  type ===
                  'equipment'
                ) {

                  return dayRows
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
                }


                return dayRows
                  .reduce(
                    (
                      sum,
                      row
                    ) =>
                      sum +
                      num(
                        row.itr
                      ) +
                      num(
                        row.workers
                      ) +
                      num(
                        row.mechanizers
                      ),
                    0
                  );
              }
            );


        const chart =
          new Chart(
            canvas,
            {

              type:
                'line',


              data: {

                labels:
                  globalDates
                    .map(
                      shortDate
                    ),


                datasets: [

                  {

                    label:
                      type ===
                        'equipment'
                        ? 'Количество техники, ед.'
                        : 'Количество человек, чел.',

                    data:
                      values,

                    borderWidth:
                      2,

                    tension:
                      0,

                    spanGaps:
                      false
                  }
                ]
              },


              options: {

                responsive:
                  true,

                maintainAspectRatio:
                  true,

                scales: {

                  y: {

                    beginAtZero:
                      true,

                    title: {

                      display:
                        true,

                      text:
                        type ===
                          'equipment'
                          ? 'Количество техники, ед.'
                          : 'Количество человек, чел.'
                    }
                  }
                },

                plugins: {

                  legend: {

                    display:
                      false
                  }
                }
              }
            }
          );


        resourceCharts.push(
          chart
        );
      }
    );
}


/* =========================================================
   РЕСУРСЫ — АГРЕГАЦИЯ ПО ДНЯМ
   ========================================================= */


function groupResourcesByOrganizationAndDay(
  rows
) {

  const result =
    new Map();


  rows.forEach(
    row => {

      const organizationId =
        row.organizationId ||
        '';


      const key =
        `${organizationId}|${row.date}`;


      if (
        !result.has(
          key
        )
      ) {

        result.set(
          key,
          {

            organizationId,

            date:
              row.date,

            itr:
              0,

            workers:
              0,

            mechanizers:
              0,

            equipment:
              0,

            equipmentTypes:
              {}
          }
        );
      }


      const item =
        result.get(
          key
        );


      item.itr +=
        num(
          row.itr
        );


      item.workers +=
        num(
          row.workers
        );


      item.mechanizers +=
        num(
          row.mechanizers
        );


      item.equipment +=
        num(
          row.equipmentQty
        );


      if (
        row.equipmentType
      ) {

        const type =
          normText(
            row.equipmentType
          );


        item.equipmentTypes[type] =
          (
            item.equipmentTypes[type] ||
            0
          ) +
          num(
            row.equipmentQty
          );
      }
    }
  );


  return [
    ...result.values()
  ];
}


/* =========================================================
   РЕСУРСЫ — МЕТОД СРЕДНЕГО
   ========================================================= */


function analyticsDateUniverse(
  rows,
  organizationId
) {

  const from =
    $('rFrom').value;


  const to =
    $('rTo').value;


  const method =
    $('rAvgMethod').value;


  const allDates =
    dateRange(
      from,
      to
    );


  const organizationReportDates =
    new Set(

      rows
        .filter(
          row =>
            row.organizationId ===
            organizationId
        )
        .map(
          row =>
            row.date
        )
    );


  const projectReportDates =
    new Set(
      rows
        .map(
          row =>
            row.date
        )
    );


  if (
    method ===
    'calendar'
  ) {

    return allDates;
  }


  if (
    method ===
    'workdays'
  ) {

    return allDates
      .filter(
        isWorkday
      );
  }


  if (
    method ===
    'project_report_days'
  ) {

    return [
      ...projectReportDates
    ]
      .sort();
  }


  return [
    ...organizationReportDates
  ]
    .sort();
}


function averageMetric(
  dailyRows,
  organizationId,
  metric,
  allRows
) {

  const method =
    $('rAvgMethod').value;


  const missingRule =
    $('rMissingRule').value;


  let dates =
    analyticsDateUniverse(
      allRows,
      organizationId
    );


  const organizationDaily =
    dailyRows
      .filter(
        row =>
          row.organizationId ===
          organizationId
      );


  if (
    method ===
    'nonzero'
  ) {

    const values =
      organizationDaily
        .map(
          row =>
            num(
              row[metric]
            )
        )
        .filter(
          value =>
            value !==
            0
        );


    if (!values.length) {

      return {
        average:
          0,

        days:
          0
      };
    }


    return {

      average:
        values.reduce(
          (
            sum,
            value
          ) =>
            sum +
            value,
          0
        ) /
        values.length,

      days:
        values.length
    };
  }


  const map =
    new Map(
      organizationDaily
        .map(
          row => [
            row.date,
            num(
              row[metric]
            )
          ]
        )
    );


  if (
    method ===
    'reported_with_zero'
  ) {

    dates =
      [
        ...map.keys()
      ];
  }


  const values =
    [];


  dates.forEach(
    date => {

      if (
        map.has(
          date
        )
      ) {

        values.push(
          map.get(
            date
          )
        );

      } else if (
        missingRule ===
        'zero'
      ) {

        values.push(
          0
        );
      }
    }
  );


  if (!values.length) {

    return {

      average:
        0,

      days:
        0
    };
  }


  return {

    average:
      values.reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      ) /
      values.length,

    days:
      values.length
  };
}


/* =========================================================
   РЕСУРСЫ — МЕСЯЧНАЯ АНАЛИТИКА
   ========================================================= */


function renderResourceAnalytics() {

  const rows =
    resourceFiltered();


  const daily =
    groupResourcesByOrganizationAndDay(
      rows
    );


  const organizationIds =
    uniq(
      rows
        .map(
          row =>
            row.organizationId
        )
    )
      .sort(
        (
          a,
          b
        ) =>
          nameById(
            project.organizations,
            a
          )
            .localeCompare(
              nameById(
                project.organizations,
                b
              ),
              'ru'
            )
      );


  const peopleRows =
    organizationIds
      .map(
        organizationId => {

          const itr =
            averageMetric(
              daily,
              organizationId,
              'itr',
              rows
            );


          const workers =
            averageMetric(
              daily,
              organizationId,
              'workers',
              rows
            );


          const mechanizers =
            averageMetric(
              daily,
              organizationId,
              'mechanizers',
              rows
            );


          const totalValues =
            daily
              .filter(
                row =>
                  row.organizationId ===
                  organizationId
              )
              .map(
                row => ({

                  ...row,

                  totalPeople:
                    row.itr +
                    row.workers +
                    row.mechanizers
                })
              );


          const total =
            averageMetric(
              totalValues,
              organizationId,
              'totalPeople',
              rows
            );


          return {

            organizationId,

            itr:
              itr.average,

            workers:
              workers.average,

            mechanizers:
              mechanizers.average,

            total:
              total.average,

            days:
              Math.max(
                itr.days,
                workers.days,
                mechanizers.days,
                total.days
              )
          };
        }
      );


  $('raPeopleBody').innerHTML =
    peopleRows
      .map(
        item =>
          `
            <tr>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    item.organizationId
                  ) ||
                  '—'
                )}
              </td>

              <td>
                ${fmt1(item.itr)}
              </td>

              <td>
                ${fmt1(item.mechanizers)}
              </td>

              <td>
                ${fmt1(item.workers)}
              </td>

              <td>
                <b>
                  ${fmt1(item.total)}
                </b>
              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  const mean =
    (
      array,
      field
    ) => {

      const values =
        array
          .map(
            row =>
              num(
                row[field]
              )
          );


      return values.length
        ? values.reduce(
            (
              sum,
              value
            ) =>
              sum +
              value,
            0
          ) /
          values.length
        : 0;
    };


  $('raPeopleFoot').innerHTML =
    `
      <tr>

        <th>
          Среднее по организациям
        </th>

        <th>
          ${fmt1(
            mean(
              peopleRows,
              'itr'
            )
          )}
        </th>

        <th>
          ${fmt1(
            mean(
              peopleRows,
              'mechanizers'
            )
          )}
        </th>

        <th>
          ${fmt1(
            mean(
              peopleRows,
              'workers'
            )
          )}
        </th>

        <th>
          ${fmt1(
            mean(
              peopleRows,
              'total'
            )
          )}
        </th>

      </tr>
    `;


  const equipmentTypes =
    uniq(
      rows
        .map(
          row =>
            normText(
              row.equipmentType
            )
        )
    )
      .filter(
        Boolean
      )
      .sort(
        (
          a,
          b
        ) =>
          a.localeCompare(
            b,
            'ru'
          )
      );


  $('raEquipmentHead').innerHTML =
    `
      <tr>

        <th>
          Организация
        </th>

        ${
          equipmentTypes
            .map(
              type =>
                `<th>${esc(type)}</th>`
            )
            .join(
              ''
            )
        }

      </tr>
    `;


  const equipmentBody =
    organizationIds
      .map(
        organizationId => {

          const cells =
            equipmentTypes
              .map(
                type => {

                  const syntheticDaily =
                    daily
                      .filter(
                        row =>
                          row.organizationId ===
                          organizationId
                      )
                      .map(
                        row => ({

                          ...row,

                          metric:
                            num(
                              row.equipmentTypes[
                                type
                              ]
                            )
                        })
                      );


                  const result =
                    averageMetric(
                      syntheticDaily,
                      organizationId,
                      'metric',
                      rows
                    );


                  return result.average;
                }
              );


          return {

            organizationId,

            cells
          };
        }
      );


  $('raEquipmentBody').innerHTML =
    equipmentBody
      .map(
        row =>
          `
            <tr>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    row.organizationId
                  ) ||
                  '—'
                )}
              </td>

              ${
                row.cells
                  .map(
                    value =>
                      `<td>${fmt1(value)}</td>`
                  )
                  .join(
                    ''
                  )
              }

            </tr>
          `
      )
      .join(
        ''
      );


  const globalDaily =
    {};


  rows.forEach(
    row => {

      if (
        !globalDaily[
          row.date
        ]
      ) {

        globalDaily[
          row.date
        ] = {

          people:
            0,

          equipment:
            0
        };
      }


      globalDaily[
        row.date
      ].people +=

        num(
          row.itr
        ) +

        num(
          row.workers
        ) +

        num(
          row.mechanizers
        );


      globalDaily[
        row.date
      ].equipment +=
        num(
          row.equipmentQty
        );
    }
  );


  let globalDates =
    Object.keys(
      globalDaily
    )
      .sort();


  const method =
    $('rAvgMethod').value;


  const missingRule =
    $('rMissingRule').value;


  if (
    method ===
    'calendar'
  ) {

    globalDates =
      dateRange(
        $('rFrom').value,
        $('rTo').value
      );

  } else if (
    method ===
    'workdays'
  ) {

    globalDates =
      dateRange(
        $('rFrom').value,
        $('rTo').value
      )
        .filter(
          isWorkday
        );
  }


  let peopleValues =
    [];


  let equipmentValues =
    [];


  globalDates.forEach(
    date => {

      const day =
        globalDaily[
          date
        ];


      if (day) {

        if (
          method !==
            'nonzero' ||
          day.people !==
            0
        ) {

          peopleValues.push(
            day.people
          );
        }


        if (
          method !==
            'nonzero' ||
          day.equipment !==
            0
        ) {

          equipmentValues.push(
            day.equipment
          );
        }

      } else if (
        missingRule ===
        'zero'
      ) {

        peopleValues.push(
          0
        );


        equipmentValues.push(
          0
        );
      }
    }
  );


  const avg =
    values =>
      values.length
        ? values.reduce(
            (
              sum,
              value
            ) =>
              sum +
              value,
            0
          ) /
          values.length
        : 0;


  $('raPeopleAvg').textContent =
    fmt1(
      avg(
        peopleValues
      )
    );


  $('raEquipmentAvg').textContent =
    fmt1(
      avg(
        equipmentValues
      )
    );


  $('raDaysCount').textContent =
    Math.max(
      peopleValues.length,
      equipmentValues.length
    );
}


/* =========================================================
   РЕСУРСЫ — СОХРАНИТЬ ПРЕДСТАВЛЕНИЕ
   ========================================================= */


async function saveResourceView() {

  const name =
    prompt(
      'Название представления:',
      'Ресурсы — месячная аналитика'
    );


  if (!name) {

    return;
  }


  project.views.push({

    id:
      uid(
        'VIEW'
      ),

    name:

      name.trim(),

    type:
      'resourceAnalytics',

    createdAt:
      nowIso(),

    config: {

      from:
        $('rFrom').value,

      to:
        $('rTo').value,

      organizationId:
        $('rOrg').value,

      buildingId:
        $('rBuilding').value,

      workId:
        $('rWork').value,

      frontId:
        $('rFront').value,

      averageMethod:
        $('rAvgMethod').value,

      missingRule:
        $('rMissingRule').value
    }
  });


  log(
    'Сохранено',
    'Представление',

    name.trim()
  );


  await saveProject();


  alert(
    'Представление сохранено. Его будем использовать в модуле отчетности.'
  );
}


/* =========================================================
   РЕСУРСЫ — ПЛАН
   ========================================================= */


function resourcePlanPeople(
  plan
) {

  if (
    plan.method ===
    'rule'
  ) {

    const volume =
      num(
        plan.volume
      );


    const productivity =
      num(
        plan.productivity
      );


    const workdays =
      num(
        plan.workdays
      );


    if (
      !volume ||
      !productivity ||
      !workdays
    ) {

      return 0;
    }


    return Math.ceil(
      volume /
      productivity /
      workdays
    );
  }


  return num(
    plan.people
  );
}


function resourcePlanDates(
  plan
) {

  return dateRange(
    plan.startDate,
    plan.endDate
  )
    .filter(
      date => {

        if (
          plan.calendar ===
          'calendar'
        ) {

          return true;
        }


        return isWorkday(
          date
        );
      }
    );
}


function planMatchesResourceFilter(
  plan
) {

  return (

    (
      $('rOrg').value ===
        'all' ||
      !plan.organizationId ||
      plan.organizationId ===
        $('rOrg').value
    ) &&

    (
      $('rBuilding').value ===
        'all' ||
      !plan.buildingId ||
      plan.buildingId ===
        $('rBuilding').value
    ) &&

    (
      $('rWork').value ===
        'all' ||
      !plan.workId ||
      plan.workId ===
        $('rWork').value
    ) &&

    (
      $('rFront').value ===
        'all' ||
      !plan.frontId ||
      plan.frontId ===
        $('rFront').value
    ) &&

    (
      !$('rFrom').value ||
      plan.endDate >=
        $('rFrom').value
    ) &&

    (
      !$('rTo').value ||
      plan.startDate <=
        $('rTo').value
    )
  );
}


function openResourcePlanEditor(
  id =
    null
) {

  const plan =
    id
      ? byId(
          project.resourcePlans,
          id
        ) ||
        {}
      : {};


  const frontOptions =
    activeFronts()
      .map(
        front =>
          `
            <option
              value="${front.id}"
              ${
                plan.frontId ===
                front.id
                  ? 'selected'
                  : ''
              }>

              ${esc(
                frontLabel(
                  front
                )
              )}

            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    id
      ? 'План ресурсов'
      : 'Новый план ресурсов',

    `
      <div class="form-grid">

        <div class="field">

          <label>Организация</label>

          <select id="rpOrg">

            ${selectOptions(
              project.organizations,
              plan.organizationId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Здание</label>

          <select id="rpBuilding">

            ${selectOptions(
              project.buildings,
              plan.buildingId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Работа</label>

          <select id="rpWork">

            ${selectOptions(
              project.works,
              plan.workId ||
              '',
              true
            )}

          </select>

        </div>


        <div class="field">

          <label>Фронт</label>

          <select id="rpFront">

            <option value="">—</option>

            ${frontOptions}

          </select>

        </div>


        <div class="field">

          <label>Начало</label>

          <input
            id="rpStart"
            type="date"
            value="${plan.startDate || today()}">

        </div>


        <div class="field">

          <label>Окончание</label>

          <input
            id="rpEnd"
            type="date"
            value="${plan.endDate || today()}">

        </div>


        <div class="field">

          <label>Способ расчета</label>

          <select id="rpMethod">

            <option
              value="manual"
              ${
                plan.method !==
                  'rule'
                  ? 'selected'
                  : ''
              }>
              Вручную
            </option>

            <option
              value="rule"
              ${
                plan.method ===
                  'rule'
                  ? 'selected'
                  : ''
              }>
              По объему и выработке
            </option>

          </select>

        </div>


        <div class="field">

          <label>Людей вручную</label>

          <input
            id="rpPeople"
            type="number"
            step="any"
            value="${plan.people ?? ''}">

        </div>


        <div class="field">

          <label>Объем</label>

          <input
            id="rpVolume"
            type="number"
            step="any"
            value="${plan.volume ?? ''}">

        </div>


        <div class="field">

          <label>Выработка на 1 чел./день</label>

          <input
            id="rpProductivity"
            type="number"
            step="any"
            value="${plan.productivity ?? ''}">

        </div>


        <div class="field">

          <label>Рабочих дней для расчета</label>

          <input
            id="rpWorkdays"
            type="number"
            step="any"
            value="${plan.workdays ?? ''}">

        </div>


        <div class="field">

          <label>Календарь распределения</label>

          <select id="rpCalendar">

            <option
              value="workdays"
              ${
                plan.calendar !==
                  'calendar'
                  ? 'selected'
                  : ''
              }>
              5/2
            </option>

            <option
              value="calendar"
              ${
                plan.calendar ===
                  'calendar'
                  ? 'selected'
                  : ''
              }>
              Календарные дни
            </option>

          </select>

        </div>

      </div>


      <div class="field">

        <label>Комментарий</label>

        <textarea id="rpComment">${esc(
          plan.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        <button
          id="rpDelete"
          class="btn danger"
          ${
            id
              ? ''
              : 'style="display:none"'
          }>
          Удалить
        </button>


        <button
          id="rpSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );


  $('rpSave').onclick =
    () =>
      saveResourcePlan(
        id
      );


  if (id) {

    $('rpDelete').onclick =
      () =>
        deleteResourcePlan(
          id
        );
  }
}


async function saveResourcePlan(
  id
) {

  const existing =
    id
      ? byId(
          project.resourcePlans,
          id
        )
      : null;


  const plan = {

    id:
      existing?.id ||
      uid(
        'RP'
      ),

    organizationId:
      $('rpOrg').value,

    buildingId:
      $('rpBuilding').value,

    workId:
      $('rpWork').value,

    frontId:
      $('rpFront').value,

    startDate:
      $('rpStart').value,

    endDate:
      $('rpEnd').value,

    method:
      $('rpMethod').value,

    people:
      num(
        $('rpPeople').value
      ),

    volume:
      num(
        $('rpVolume').value
      ),

    productivity:
      num(
        $('rpProductivity').value
      ),

    workdays:
      num(
        $('rpWorkdays').value
      ),

    calendar:
      $('rpCalendar').value,

    comment:
      $('rpComment')
        .value
        .trim(),

    createdAt:
      existing?.createdAt ||
      nowIso(),

    updatedAt:
      nowIso()
  };


  if (
    !plan.startDate ||
    !plan.endDate
  ) {

    alert(
      'Укажи начало и окончание.'
    );

    return;
  }


  if (
    plan.endDate <
    plan.startDate
  ) {

    alert(
      'Окончание не может быть раньше начала.'
    );

    return;
  }


  if (
    plan.method ===
      'manual' &&
    plan.people <=
      0
  ) {

    alert(
      'Укажи плановое количество людей.'
    );

    return;
  }


  if (
    plan.method ===
      'rule' &&
    (
      plan.volume <=
        0 ||
      plan.productivity <=
        0 ||
      plan.workdays <=
        0
    )
  ) {

    alert(
      'Для расчета по правилу укажи объем, выработку и количество рабочих дней.'
    );

    return;
  }


  if (existing) {

    Object.assign(
      existing,
      plan
    );

  } else {

    project.resourcePlans.push(
      plan
    );
  }


  log(
    existing
      ? 'Изменено'
      : 'Создано',

    'План ресурсов',

    `${plan.startDate} → ${plan.endDate} · ${resourcePlanPeople(plan)} чел.`
  );


  await saveProject();


  closeModal();


  renderAll();
}


async function deleteResourcePlan(
  id
) {

  if (
    !confirm(
      'Удалить план ресурсов?'
    )
  ) {

    return;
  }


  project.resourcePlans =
    project.resourcePlans
      .filter(
        item =>
          item.id !==
          id
      );


  log(
    'Удалено',
    'План ресурсов',
    id
  );


  await saveProject();


  closeModal();


  renderAll();
}


/* =========================================================
   РЕСУРСЫ — ПЛАН / ФАКТ
   ========================================================= */


function resourcePlanDailyMap(
  plans
) {

  const map =
    {};


  plans.forEach(
    plan => {

      const people =
        resourcePlanPeople(
          plan
        );


      resourcePlanDates(
        plan
      )
        .forEach(
          date => {

            if (
              date <
                $('rFrom').value ||
              date >
                $('rTo').value
            ) {

              return;
            }


            map[date] =
              (
                map[date] ||
                0
              ) +
              people;
          }
        );
    }
  );


  return map;
}


function resourceFactDailyMap(
  rows
) {

  const map =
    {};


  rows.forEach(
    row => {

      map[row.date] =
        (
          map[row.date] ||
          0
        ) +
        num(
          row.itr
        ) +
        num(
          row.workers
        ) +
        num(
          row.mechanizers
        );
    }
  );


  return map;
}


function bucketResourceSeries(
  dailyMap,
  step
) {

  const buckets =
    {};


  Object.entries(
    dailyMap
  )
    .forEach(
      (
        [
          date,
          value
        ]
      ) => {

        const key =
          step ===
            'week'
            ? startOfWeek(
                date
              )
            : date;


        if (
          !buckets[
            key
          ]
        ) {

          buckets[key] =
            [];
        }


        buckets[
          key
        ].push(
          value
        );
      }
    );


  const result =
    {};


  Object.entries(
    buckets
  )
    .forEach(
      (
        [
          key,
          values
        ]
      ) => {

        result[key] =
          values.length
            ? values.reduce(
                (
                  sum,
                  value
                ) =>
                  sum +
                  value,
                0
              ) /
              values.length
            : 0;
      }
    );


  return result;
}


function renderResourcePlanFact() {

  const plans =
    project.resourcePlans
      .filter(
        planMatchesResourceFilter
      );


  const factRows =
    resourceFiltered();


  const step =
    $('rpStep').value;


  const planDaily =
    resourcePlanDailyMap(
      plans
    );


  const factDaily =
    resourceFactDailyMap(
      factRows
    );


  const planSeries =
    bucketResourceSeries(
      planDaily,
      step
    );


  const factSeries =
    bucketResourceSeries(
      factDaily,
      step
    );


  const keys =
    uniq([
      ...Object.keys(
        planSeries
      ),

      ...Object.keys(
        factSeries
      )
    ])
      .sort();


  $('rpHead').innerHTML =
    `
      <tr>

        <th>
          Период
        </th>

        <th>
          План, чел.
        </th>

        <th>
          Факт, чел.
        </th>

        <th>
          Отклонение
        </th>

      </tr>
    `;


  $('rpBody').innerHTML =
    keys
      .map(
        key => {

          const plan =
            num(
              planSeries[
                key
              ]
            );


          const fact =
            num(
              factSeries[
                key
              ]
            );


          return `
            <tr>

              <td>
                ${
                  step ===
                    'week'
                    ? `Неделя с ${ruDate(key)}`
                    : ruDate(key)
                }
              </td>

              <td>
                ${fmt1(plan)}
              </td>

              <td>
                ${fmt1(fact)}
              </td>

              <td>
                ${fmt1(
                  fact -
                  plan
                )}
              </td>

            </tr>
          `;
        }
      )
      .join(
        ''
      );


  const planPersonDays =
    Object.values(
      planDaily
    )
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );


  const factPersonDays =
    Object.values(
      factDaily
    )
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );


  $('rpPlanSum').textContent =
    fmt1(
      planPersonDays
    );


  $('rpFactSum').textContent =
    fmt1(
      factPersonDays
    );


  $('rpDeviation').textContent =
    fmt1(
      factPersonDays -
      planPersonDays
    );


  $('rpFoot').innerHTML =
    `
      <tr>

        <th>
          Итого
        </th>

        <th>
          ${fmt1(planPersonDays)}
        </th>

        <th>
          ${fmt1(factPersonDays)}
        </th>

        <th>
          ${fmt1(
            factPersonDays -
            planPersonDays
          )}
        </th>

      </tr>
    `;


  if (
    resourcePlanFactChart
  ) {

    try {

      resourcePlanFactChart.destroy();

    } catch (
      error
    ) {

      console.warn(
        error
      );
    }


    resourcePlanFactChart =
      null;
  }


  if (
    typeof Chart !==
      'undefined'
  ) {

    const canvas =
      $('resourcePlanFactChart');


    resourcePlanFactChart =
      new Chart(
        canvas,
        {

          type:
            'line',


          data: {

            labels:
              keys
                .map(
                  key =>
                    step ===
                      'week'
                      ? shortDate(
                          key
                        )
                      : shortDate(
                          key
                        )
                ),


            datasets: [

              {

                label:
                  'План',

                data:
                  keys
                    .map(
                      key =>
                        fmt1(
                          planSeries[
                            key
                          ] ||
                          0
                        )
                    ),

                borderWidth:
                  2,

                tension:
                  0
              },


              {

                label:
                  'Факт',

                data:
                  keys
                    .map(
                      key =>
                        fmt1(
                          factSeries[
                            key
                          ] ||
                          0
                        )
                    ),

                borderWidth:
                  2,

                tension:
                  0
              }
            ]
          },


          options: {

            responsive:
              true,

            scales: {

              y: {

                beginAtZero:
                  true,

                title: {

                  display:
                    true,

                  text:
                    'Количество человек'
                }
              }
            }
          }
        }
      );
  }


  const details =
    plans
      .map(
        plan =>
          `
            <tr>

              <td>
                ${esc(
                  nameById(
                    project.organizations,
                    plan.organizationId
                  ) ||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  nameById(
                    project.works,
                    plan.workId
                  ) ||
                  '—'
                )}
              </td>

              <td>
                ${ruDate(
                  plan.startDate
                )}
              </td>

              <td>
                ${ruDate(
                  plan.endDate
                )}
              </td>

              <td>
                ${
                  plan.method ===
                    'rule'
                    ? 'Расчет'
                    : 'Вручную'
                }
              </td>

              <td>
                ${fmt1(
                  resourcePlanPeople(
                    plan
                  )
                )}
              </td>

              <td>

                <button
                  class="row-btn"
                  data-resource-plan="${plan.id}">
                  Открыть
                </button>

              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  if (
    details
  ) {

    $('rpBody').innerHTML +=
      `
        <tr>
          <td colspan="4">
            <b>
              Настроенные планы
            </b>
          </td>
        </tr>

        <tr>
          <th>Организация</th>
          <th>Работа</th>
          <th>Начало</th>
          <th>Окончание</th>
          <th>Метод</th>
          <th>Людей</th>
          <th></th>
        </tr>

        ${details}
      `;
  }


  document
    .querySelectorAll(
      '[data-resource-plan]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openResourcePlanEditor(
              button.dataset
                .resourcePlan
            );
      }
    );
}


/* =========================================================
   РЕСУРСЫ — ПЕРЕКЛЮЧЕНИЕ ВИДОВ
   ========================================================= */


function switchResourceView(
  view
) {

  resourceView =
    view;


  document
    .querySelectorAll(
      '[data-rview]'
    )
    .forEach(
      button => {

        button.classList
          .toggle(
            'active',
            button.dataset.rview ===
              view
          );
      }
    );


  document
    .querySelectorAll(
      '.resource-view'
    )
    .forEach(
      panel => {

        panel.classList
          .add(
            'hidden'
          );
      }
    );


  $(
    `rview-${view}`
  )
    ?.classList
    .remove(
      'hidden'
    );


  renderResourceCurrentView();
}


function renderResourceCurrentView() {

  if (
    resourceView ===
    'journal'
  ) {

    renderResourceJournal();

    return;
  }


  if (
    resourceView ===
    'daily'
  ) {

    renderResourceDaily();

    return;
  }


  if (
    resourceView ===
    'dynamics'
  ) {

    renderResourceDynamics();

    return;
  }


  if (
    resourceView ===
    'analytics'
  ) {

    renderResourceAnalytics();

    return;
  }


  if (
    resourceView ===
    'planfact'
  ) {

    renderResourcePlanFact();
  }
}


/* =========================================================
   КЛЮЧЕВЫЕ ДАТЫ
   ========================================================= */


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
      .join(
        ''
      );


  document
    .querySelectorAll(
      '[data-ms]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openMilestoneEditor(
              button.dataset
                .ms
            );
      }
    );
}


function openMilestoneEditor(
  id =
    null
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
            value="${esc(
              milestone.title ||
              ''
            )}">

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

        <textarea id="mComment">${esc(
          milestone.comment ||
          ''
        )}</textarea>

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
            uid(
              'M'
            ),

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


  if (
    !milestone.title
  ) {

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


/* =========================================================
   НОМЕРНЫЕ ЭЛЕМЕНТЫ
   ========================================================= */


function elementContextKey(
  element
) {

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
    ]
      .join(
        '|'
      );
  }


  if (
    scope ===
    'building'
  ) {

    return [

      type,

      element.buildingId ||
        '',

      number
    ]
      .join(
        '|'
      );
  }


  return [

    type,

    element.buildingId ||
      '',

    normKey(
      element.capture
    ),

    normKey(
      element.zone
    ),

    number
  ]
    .join(
      '|'
    );
}


function findElementDuplicate(
  candidate,
  excludeId =
    ''
) {

  const key =
    elementContextKey(
      candidate
    );


  return project.numberedElements
    .find(
      element =>

        element.active !==
          false &&

        element.id !==
          excludeId &&

        elementContextKey(
          element
        ) ===
        key
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

          element.active !==
            false &&

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
              .includes(
                search
              )
          )
      );


  $('elementRows').innerHTML =
    rows
      .map(
        element =>
          `
            <tr>

              <td>
                ${esc(
                  element.elementType
                )}
              </td>

              <td>
                <b>
                  ${esc(
                    element.elementNo
                  )}
                </b>
              </td>

              <td>
                ${esc(
                  nameById(
                    project.buildings,
                    element.buildingId
                  ) ||
                  '—'
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
                  ) ||
                  '—'
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
      .join(
        ''
      );


  document
    .querySelectorAll(
      '[data-el]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openElementEditor(
              button.dataset
                .el
            );
      }
    );
}


function openElementEditor(
  id =
    null
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

              ${esc(
                frontLabel(
                  front
                )
              )}

            </option>
          `
      )
      .join(
        ''
      );


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
            value="${esc(
              element.elementType ||
              ''
            )}"
            placeholder="Свая / Анкер / Шпунт">

        </div>


        <div class="field">

          <label>Номер</label>

          <input
            id="neNo"
            value="${esc(
              element.elementNo ||
              ''
            )}">

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
                ]
                  .includes(
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
            value="${esc(
              element.capture ||
              ''
            )}">

        </div>


        <div class="field">

          <label>Зона / ряд</label>

          <input
            id="neZone"
            value="${esc(
              element.zone ||
              ''
            )}">

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
                .join(
                  ''
                )
            }

          </select>

        </div>


        <div class="field">

          <label>Фронт</label>

          <select id="neFront">

            <option value="">—</option>

            ${frontOptions}

          </select>

        </div>

      </div>


      <div class="field">

        <label>Комментарий</label>

        <textarea id="neComment">${esc(
          element.comment ||
          ''
        )}</textarea>

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
      saveElement(
        id
      );


  if (id) {

    $('neArchive').onclick =
      () =>
        archiveElement(
          id
        );
  }
}


async function saveElement(
  id
) {

  const candidate = {

    id:
      id ||
      uid(
        'EL'
      ),

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
      id ||
      ''
    );


  if (duplicate) {

    alert(
      `Такой номер уже существует.\n` +
      `${duplicate.elementType} №${duplicate.elementNo}`
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


async function archiveElement(
  id
) {

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


  if (!element) {

    return;
  }


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


/* =========================================================
   ДЕМОНТАЖ
   ========================================================= */


function renderDemolition() {

  $('demolitionRows').innerHTML =
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
                ${esc(
                  item.name
                )}
              </td>

              <td>

                <select
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
                      .join(
                        ''
                      )
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
                  value="${esc(
                    item.comment ||
                    ''
                  )}">

              </td>

            </tr>
          `
      )
      .join(
        ''
      );


  document
    .querySelectorAll(
      '[data-dem]'
    )
    .forEach(
      element => {

        element.onchange =
          () =>
            saveDemolitionRow(
              element.dataset
                .dem
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

              element.dataset
                .demPlan ||

              element.dataset
                .demForecast ||

              element.dataset
                .demFact ||

              element.dataset
                .demComment
            );
      }
    );
}


async function saveDemolitionRow(
  id
) {

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


/* =========================================================
   ИСТОРИЯ
   ========================================================= */


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
                ${esc(
                  item.action
                )}
              </td>

              <td>
                ${esc(
                  item.entity
                )}
              </td>

              <td>
                ${esc(
                  item.description
                )}
              </td>

            </tr>
          `
      )
      .join(
        ''
      );
}


/* =========================================================
   НАСТРОЙКИ
   ========================================================= */


function renderSettings() {

  const renderList =
    list =>
      list
        .map(
          item =>
            `
              <div class="item">

                <span>

                  ${esc(
                    item.name
                  )}

                  ${
                    item.unit
                      ? ` · ${esc(item.unit)}`
                      : ''
                  }

                </span>

                <small>

                  ${
                    item.active ===
                      false
                      ? 'архив'
                      : 'активно'
                  }

                </small>

              </div>
            `
        )
        .join(
          ''
        );


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

        <span>
          Версия структуры
        </span>

        <strong>
          ${esc(
            project.schemaVersion
          )}
        </strong>

      </div>


      <div class="item">

        <span>
          Последнее изменение
        </span>

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

        <span>
          Последняя резервная копия
        </span>

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

        <span>
          Фронтов
        </span>

        <strong>
          ${activeFronts().length}
        </strong>

      </div>


      <div class="item">

        <span>
          Записей ресурсов
        </span>

        <strong>
          ${project.resources.length}
        </strong>

      </div>


      <div class="item">

        <span>
          Планов ресурсов
        </span>

        <strong>
          ${project.resourcePlans.length}
        </strong>

      </div>


      <div class="item">

        <span>
          Импортов
        </span>

        <strong>
          ${project.importHistory.length}
        </strong>

      </div>
    `;
}


async function addSimple(
  type
) {

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
  ] =
    config;


  const input =
    $(
      inputId
    );


  const name =
    input.value
      .trim();


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
      uid(
        prefix
      ),

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


/* =========================================================
   РЕЗЕРВНАЯ КОПИЯ
   ========================================================= */


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
        Date.parse(
          last
        )
      ) /
      86400000
    );


  $('backupNotice').textContent =

    `Последняя резервная копия: ` +

    `${new Date(last)
      .toLocaleString(
        'ru-RU'
      )}` +

    `${
      days >=
        7
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

    ...clone(
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


async function restoreProject(
  file
) {

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
      clone(
        project
      ),
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

  } catch (
    error
  ) {

    alert(
      'Ошибка загрузки: ' +
      error.message
    );

  } finally {

    $('restoreInput').value =
      '';
  }
}


/* =========================================================
   СРАВНЕНИЕ ПРОЕКТОВ
   ========================================================= */


function compareCollections(
  current,
  incoming
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
              item.id
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
              item.id
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


async function compareProjectFile(
  file
) {

  try {

    compareIncoming =
      normalizeProject(
        JSON.parse(
          await file.text()
        )
      );


    const collections = [

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
        'resourcePlans',
        'Планы ресурсов'
      ],

      [
        'milestones',
        'Ключевые даты'
      ],

      [
        'numberedElements',
        'Номерные элементы'
      ],

      [
        'demolition',
        'Демонтаж'
      ]
    ];


    compareItems =
      [];


    collections.forEach(
      (
        [
          key,
          label
        ]
      ) => {

        const result =
          compareCollections(
            project[key],
            compareIncoming[key]
          );


        result.added
          .forEach(
            row =>
              compareItems.push({

                token:
                  uid(
                    'CMP'
                  ),

                key,

                label,

                type:
                  'added',

                id:
                  row.id,

                after:
                  row
              })
          );


        result.changed
          .forEach(
            pair =>
              compareItems.push({

                token:
                  uid(
                    'CMP'
                  ),

                key,

                label,

                type:
                  'changed',

                id:
                  pair.after.id,

                before:
                  pair.before,

                after:
                  pair.after
              })
          );
      }
    );


    openModal(
      'Сравнение проекта',

      `
        <p>
          Найдено изменений:
          <b>
            ${compareItems.length}
          </b>
        </p>

        <div class="compare-details">

          ${
            compareItems
              .slice(
                0,
                500
              )
              .map(
                item =>
                  `
                    <label class="compare-record">

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

                        <small>
                          ${esc(
                            item.id
                          )}
                        </small>

                      </span>

                    </label>
                  `
              )
              .join(
                ''
              ) ||
            '<div class="muted">Различий нет.</div>'
          }

        </div>

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

  } catch (
    error
  ) {

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

  const selected =
    new Set(
      [
        ...document
          .querySelectorAll(
            '[data-cmp]:checked'
          )
      ]
        .map(
          checkbox =>
            checkbox.dataset
              .cmp
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
        project[
          item.key
        ];


      const index =
        list.findIndex(
          row =>
            String(
              row.id
            ) ===
            String(
              item.id
            )
        );


      if (
        index >=
        0
      ) {

        list[
          index
        ] =
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
    clone(
      project
    ),
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


/* =========================================================
   ИМПОРТ — ДАТА
   ========================================================= */


function normDate(
  value
) {

  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {

    return '';
  }


  if (
    value instanceof
      Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return (

      `${value.getFullYear()}-` +

      `${String(
        value.getMonth() +
        1
      )
        .padStart(
          2,
          '0'
        )}-` +

      `${String(
        value.getDate()
      )
        .padStart(
          2,
          '0'
        )}`
    );
  }


  if (
    typeof value ===
      'number' &&
    value >
      20000 &&
    value <
      80000 &&
    window.XLSX
  ) {

    const parsed =
      XLSX.SSF
        .parse_date_code(
          value
        );


    if (parsed) {

      return (

        `${parsed.y}-` +

        `${String(
          parsed.m
        )
          .padStart(
            2,
            '0'
          )}-` +

        `${String(
          parsed.d
        )
          .padStart(
            2,
            '0'
          )}`
      );
    }
  }


  const text =
    normText(
      value
    );


  let match =
    text.match(
      /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/
    );


  if (match) {

    const year =
      match[3].length ===
        2
        ? '20' +
          match[3]
        : match[3];


    return (

      `${year}-` +

      `${match[2]
        .padStart(
          2,
          '0'
        )}-` +

      `${match[1]
        .padStart(
          2,
          '0'
        )}`
    );
  }


  match =
    text.match(
      /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/
    );


  if (match) {

    return (

      `${match[1]}-` +

      `${match[2]
        .padStart(
          2,
          '0'
        )}-` +

      `${match[3]
        .padStart(
          2,
          '0'
        )}`
    );
  }


  return '';
}


/* =========================================================
   ИМПОРТ — СПРАВОЧНИКИ
   ========================================================= */


function ensureNamed(
  list,
  prefix,
  name,
  extra =
    {}
) {

  const clean =
    normText(
      name
    );


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
        uid(
          prefix
        ),

      name:
        clean,

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


function ensureStructure(
  data
) {

  const candidate = {

    buildingId:
      data.buildingId ||
      '',

    block:
      normText(
        data.block
      ),

    floor:
      normText(
        data.floor
      ),

    capture:
      normText(
        data.capture
      ),

    axis:
      normText(
        data.axis
      ),

    side:
      normText(
        data.side
      ),

    zone:
      normText(
        data.zone
      ),

    roomNo:
      normText(
        data.roomNo
      ),

    roomName:
      normText(
        data.roomName
      )
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
            structureSignature(
              row
            )
          ) ===
          signature
      );


  if (!structure) {

    structure = {

      id:
        uid(
          'STR'
        ),

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


/* =========================================================
   ИМПОРТ — ПОЛЯ
   ========================================================= */


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
      '№ захватки'
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
      'фасад'
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
      'номер помещения'
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
      'вид работ',
      'наименование работы',
      'название задачи',
      'наименование задачи'
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
      'единица измерения'
    ]
  },


  totalQty: {

    label:
      'Общий объем',

    aliases: [
      'общий объем',
      'общий объём',
      'объем',
      'объём'
    ]
  },


  doneQty: {

    label:
      'Накопительный итог',

    aliases: [
      'накопительный итог',
      'выполнено накопительно',
      'накопительно'
    ]
  },


  contractStart: {

    label:
      'Договорное начало',

    aliases: [
      'договорное начало',
      'начало договор'
    ]
  },


  contractEnd: {

    label:
      'Договорное окончание',

    aliases: [
      'договорное окончание',
      'окончание договор'
    ]
  },


  baselineStart: {

    label:
      'Базовое начало',

    aliases: [
      'базовое начало'
    ]
  },


  baselineEnd: {

    label:
      'Базовое окончание',

    aliases: [
      'базовое окончание'
    ]
  },


  planStart: {

    label:
      'План начало',

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
      'План окончание',

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
      'фактическое начало'
    ]
  },


  factEnd: {

    label:
      'Факт окончание',

    aliases: [
      'окончание факт',
      'факт окончание',
      'фактическое окончание'
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
      'численность человек',
      'кол-во чел.',
      'кол-во чел'
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
      'Подсобные рабочие',

    aliases: [
      'подсобные рабочие',
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
      'Наименование техники',

    aliases: [
      'наименование техники',
      'тип техники',
      'техника',
      'механизм',
      'механизмы'
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
      'вид элемента'
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


/* =========================================================
   ИМПОРТ — ПОИСК ЗАГОЛОВКОВ
   ========================================================= */


function matchField(
  header,
  mode
) {

  const normalizedHeader =
    normKey(
      header
    );


  let best =
    '';


  let bestScore =
    0;


  for (
    const key
    of MODE_FIELDS[
      mode
    ] ||
    []
  ) {

    const definition =
      FIELD_DEFS[
        key
      ];


    for (
      const alias
      of [
        definition.label,
        ...definition.aliases
      ]
    ) {

      const normalizedAlias =
        normKey(
          alias
        );


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


  return bestScore >=
    4
    ? best
    : '';
}


function headerScore(
  row
) {

  let score =
    0;


  for (
    const cell
    of row ||
    []
  ) {

    const normalized =
      normKey(
        cell
      );


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
                  normKey(
                    alias
                  ) ===
                  normalized
              )
        )
    ) {

      score++;
    }
  }


  return score;
}


function detectHeaderRow(
  matrix
) {

  let best = {

    index:
      0,

    score:
      -1
  };


  for (
    let index =
      0;

    index <
    Math.min(
      matrix.length,
      40
    );

    index++
  ) {

    const score =
      headerScore(
        matrix[
          index
        ]
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


function uniqueHeaders(
  row
) {

  const used =
    new Map();


  return (
    row ||
    []
  )
    .map(
      (
        value,
        index
      ) => {

        let header =
          normText(
            value
          ) ||
          `Колонка ${index + 1}`;


        const count =
          (
            used.get(
              header
            ) ||
            0
          ) +
          1;


        used.set(
          header,
          count
        );


        if (
          count >
          1
        ) {

          header =
            `${header} (${count})`;
        }


        return header;
      }
    );
}


function detectImportMode(
  headers
) {

  const text =
    headers
      .map(
        normKey
      )
      .join(
        ' | '
      );


  if (
    /итр|механизатор|количество техники|рабочие|количество человек|кол во чел|специализация|наименование техники/.test(
      text
    ) &&
    /дата/.test(
      text
    )
  ) {

    return 'resources';
  }


  if (
    /порядковый номер|номер сваи|номер анкера|тип элемента/.test(
      text
    )
  ) {

    return 'elements';
  }


  if (
    /ключевая дата|контрольная дата|формулировка/.test(
      text
    )
  ) {

    return 'milestones';
  }


  if (
    /факт за период|объем за день|выполнено за период/.test(
      text
    ) &&
    /дата/.test(
      text
    )
  ) {

    return 'fact';
  }


  return 'fronts';
}


function buildAutoMapping(
  mode
) {

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


    result[
      header
    ] =
      key &&
      !Object.values(
        result
      )
        .includes(
          key
        )
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
        MODE_FIELDS[
          mode
        ] ||
        []
      )
        .map(
          key =>
            `
              <option
                value="${key}"
                ${
                  key ===
                  selected
                    ? 'selected'
                    : ''
                }>
                ${esc(
                  FIELD_DEFS[
                    key
                  ]?.label ||
                  key
                )}
              </option>
            `
        )
        .join(
          ''
        )
    }
  `;
}


function renderImportMapping() {

  $('importMappingCard')
    .classList
    .remove(
      'hidden'
    );


  $('importMapping').innerHTML =
    importHeaders
      .map(
        (
          header,
          index
        ) =>
          `
            <div class="mapping-item">

              <b>
                ${esc(header)}
              </b>

              <select
                data-map-header="${index}">

                ${mappingOptions(
                  importModeResolved,
                  importMapping[
                    header
                  ] ||
                  ''
                )}

              </select>

            </div>
          `
      )
      .join(
        ''
      );


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
                      importMapping[
                        key
                      ] ===
                      chosen
                    ) {

                      importMapping[
                        key
                      ] =
                        '';
                    }
                  }
                );
            }


            importMapping[
              header
            ] =
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
          importMapping[
            item
          ] ===
          key
      );


  return header
    ? row[
        header
      ]
    : '';
}


/* =========================================================
   ИМПОРТ — НАСЛЕДОВАНИЕ ЯЧЕЕК
   ========================================================= */


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

    mode ===
      'fronts' ||
    mode ===
      'fact'
      ? [
          'building',
          'block',
          'work'
        ]
      : mode ===
          'elements'
        ? [
            'elementType',
            'building'
          ]
        : mode ===
            'resources'
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
                    importMapping[
                      item
                    ] ===
                    key
                );


            if (!header) {

              return;
            }


            if (
              normText(
                output[
                  header
                ]
              )
            ) {

              last[
                key
              ] =
                output[
                  header
                ];

            } else if (
              last[
                key
              ] !==
              undefined
            ) {

              output[
                header
              ] =
                last[
                  key
                ];
            }
          }
        );


        return output;
      }
    );
}


/* =========================================================
   ИМПОРТ — ЧТЕНИЕ ФАЙЛА
   ========================================================= */


function readSelectedSheet() {

  if (!importWorkbook) {

    return;
  }


  importSheetName =
    $('importSheet').value ||
    importWorkbook
      .SheetNames[0];


  const sheet =
    importWorkbook
      .Sheets[
        importSheetName
      ];


  const matrix =
    XLSX.utils
      .sheet_to_json(
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
    detectHeaderRow(
      matrix
    );


  importHeaders =
    uniqueHeaders(
      matrix[
        headerIndex
      ] ||
      []
    );


  importRawRows =
    matrix
      .slice(
        headerIndex +
        1
      )
      .filter(
        row =>
          row.some(
            value =>
              normText(
                value
              ) !==
              ''
          )
      )
      .map(
        row =>
          Object.fromEntries(
            importHeaders
              .map(
                (
                  header,
                  index
                ) => [

                  header,

                  row[
                    index
                  ] ??
                  ''
                ]
              )
          )
      );
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
      importWorkbook
        .SheetNames
        .map(
          name =>
            `<option>${esc(name)}</option>`
        )
        .join(
          ''
        );


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
      .remove(
        'hidden'
      );


    $('importInfo').className =
      'notice';


    $('importInfo').textContent =
      `Файл прочитан. ` +
      `Листов: ${importWorkbook.SheetNames.length}. ` +
      `Выбери лист и нажми «Анализировать».`;


    readSelectedSheet();

  } catch (
    error
  ) {

    alert(
      'Ошибка чтения файла: ' +
      error.message
    );
  }
}


/* =========================================================
   ИМПОРТ — ФРОНТ
   ========================================================= */


function findMatchingFrontByMapped(
  row
) {

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
            structureSignature(
              item
            )
          ) ===
          signature
      );


  if (!structure) {

    return null;
  }


  return project.fronts
    .find(
      front =>

        front.active !==
          false &&

        front.structureId ===
          structure.id &&

        front.workId ===
          work.id
    ) ||
    null;
}


function ensureFrontFromImport(
  row
) {

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

          item.active !==
            false &&

          item.structureId ===
            structure.id &&

          item.workId ===
            work.id
      );


  if (!front) {

    front = {

      id:
        uid(
          'F'
        ),

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


  if (
    organizationName
  ) {

    const organization =
      ensureNamed(
        project.organizations,
        'ORG',
        organizationName
      );


    front.organizationId =
      organization.id;
  }


  return front;
}


/* =========================================================
   ИМПОРТ — ПРЕДПРОСМОТР
   ========================================================= */


function previewImportRow(
  raw,
  index
) {

  const item = {

    raw,

    rowNumber:
      index +
      1,

    status:
      '',

    message:
      '',

    selected:
      true
  };


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

      item.status =
        'Ошибка';


      item.message =
        'Не распознана дата';


      item.selected =
        false;

    } else {

      item.status =
        'Добавить ресурсы';


      item.message =
        normText(
          mappedValue(
            raw,
            'organization'
          )
        ) ||
        'Без организации';
    }


    return item;
  }


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

      item.status =
        'Ошибка';


      item.message =
        'Нужны здание и работа';


      item.selected =
        false;

    } else {

      const found =
        findMatchingFrontByMapped(
          raw
        );


      item.status =
        found
          ? 'Обновление'
          : 'Новый фронт';


      item.message =
        `${building} · ${work}`;
    }


    return item;
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


    if (!date) {

      item.status =
        'Ошибка';


      item.message =
        'Не распознана дата';


      item.selected =
        false;

    } else {

      item.status =
        'Добавить факт';


      item.message =
        normText(
          mappedValue(
            raw,
            'work'
          )
        );
    }


    return item;
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

      item.status =
        'Ошибка';


      item.message =
        'Нужны тип элемента и номер';


      item.selected =
        false;

    } else {

      item.status =
        'Новый элемент';


      item.message =
        `${type} №${number}`;
    }


    return item;
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
      );


    if (!title) {

      item.status =
        'Ошибка';


      item.message =
        'Не найдено наименование';


      item.selected =
        false;

    } else {

      item.status =
        'КД';


      item.message =
        title;
    }
  }


  return item;
}


function analyzeImport() {

  if (
    !importWorkbook
  ) {

    return;
  }


  readSelectedSheet();


  const requested =
    $('importMode').value;


  const nextMode =
    requested ===
      'auto'
      ? detectImportMode(
          importHeaders
        )
      : requested;


  importModeResolved =
    nextMode;


  if (
    importMappingMode !==
      nextMode ||
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

      counts[
        item.status
      ] =
        (
          counts[
            item.status
          ] ||
          0
        ) +
        1;
    }
  );


  $('importInfo')
    .classList
    .remove(
      'hidden'
    );


  $('importInfo').className =
    'notice';


  $('importInfo').textContent =

    `Файл: ${importFileName}\n` +

    `Лист: ${importSheetName}\n` +

    `Режим: ${MODE_LABELS[importModeResolved]}\n` +

    `Строк: ${importRows.length}\n` +

    Object.entries(
      counts
    )
      .map(
        (
          [
            key,
            value
          ]
        ) =>
          `${key}: ${value}`
      )
      .join(
        ' · '
      );


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
            .join(
              ''
            )
        }

      </tr>
    `;


  $('importBody').innerHTML =
    importRows
      .slice(
        0,
        300
      )
      .map(
        (
          item,
          index
        ) =>
          `
            <tr>

              <td>

                <input
                  type="checkbox"
                  data-import-row="${index}"
                  ${item.selected ? 'checked' : ''}
                  ${
                    item.status ===
                      'Ошибка'
                      ? 'disabled'
                      : ''
                  }>

              </td>

              <td>
                ${item.rowNumber}
              </td>

              <td>
                ${esc(item.status)}
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
                  .join(
                    ''
                  )
              }

            </tr>
          `
      )
      .join(
        ''
      );


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
        item.status !==
          'Ошибка'
    );
}


/* =========================================================
   ИМПОРТ — ЗАПИСЬ
   ========================================================= */


function importSource(
  item
) {

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


async function commitImport() {

  const selected =
    importRows
      .filter(
        item =>
          item.selected &&
          item.status !==
            'Ошибка'
      );


  if (!selected.length) {

    return;
  }


  if (
    !confirm(
      `Импортировать выбранные строки: ${selected.length}?`
    )
  ) {

    return;
  }


  const preImportBackupKey =
    `pre-import-${Date.now()}`;


  await dbPutKey(
    clone(
      project
    ),
    preImportBackupKey
  );


  const batchId =
    uid(
      'IMP'
    );


  let created =
    0;


  let updated =
    0;


  let appended =
    0;


  let skipped =
    0;


  for (
    const item
    of selected
  ) {

    const row =
      item.raw;


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


      const organization =
        organizationName
          ? ensureNamed(
              project.organizations,
              'ORG',
              organizationName
            )
          : null;


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


      const workName =
        normText(
          mappedValue(
            row,
            'work'
          )
        );


      const work =
        workName
          ? ensureNamed(
              project.works,
              'WRK',
              workName
            )
          : null;


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
        peopleQty >
        0
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
          uid(
            'R'
          ),

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

          ...importSource(
            item
          )
        }
      };


      const hasPeople =
        resource.itr >
          0 ||
        resource.workers >
          0 ||
        resource.mechanizers >
          0 ||
        peopleQty >
          0;


      const hasEquipment =
        !!resource.equipmentType ||
        resource.equipmentQty !==
          0;


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
        ]
          .join(
            '|'
          );


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

      continue;
    }


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


      const assign =
        (
          key,
          sourceKey,
          converter =
            value =>
              value
        ) => {

          const value =
            mappedValue(
              row,
              sourceKey
            );


          if (
            normText(
              value
            ) !==
            ''
          ) {

            front[
              key
            ] =
              converter(
                value
              );
          }
        };


      assign(
        'status',
        'status',
        normalizeStatus
      );


      assign(
        'unit',
        'unit',
        normText
      );


      assign(
        'totalQty',
        'totalQty',
        num
      );


      assign(
        'doneQty',
        'doneQty',
        num
      );


      assign(
        'contractStart',
        'contractStart',
        normDate
      );


      assign(
        'contractEnd',
        'contractEnd',
        normDate
      );


      assign(
        'baselineStart',
        'baselineStart',
        normDate
      );


      assign(
        'baselineEnd',
        'baselineEnd',
        normDate
      );


      assign(
        'planStart',
        'planStart',
        normDate
      );


      assign(
        'planEnd',
        'planEnd',
        normDate
      );


      assign(
        'factStart',
        'factStart',
        normDate
      );


      assign(
        'factEnd',
        'factEnd',
        normDate
      );


      assign(
        'forecastEnd',
        'forecastEnd',
        normDate
      );


      assign(
        'comment',
        'comment',
        normText
      );


      front.updatedAt =
        nowIso();


      front.lastImport = {

        batchId,

        ...importSource(
          item
        )
      };


      if (existed) {

        updated++;

      } else {

        created++;
      }


      continue;
    }


    if (
      importModeResolved ===
      'fact'
    ) {

      const front =
        ensureFrontFromImport(
          row
        );


      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );


      if (
        !front ||
        !date
      ) {

        skipped++;

        continue;
      }


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


      const fingerprint =
        [

          front.id,

          date,

          quantity,

          people,

          normText(
            mappedValue(
              row,
              'comment'
            )
          )
        ]
          .join(
            '|'
          );


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
        ) !==
          ''
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
                (
                  sum,
                  fact
                ) =>
                  sum +
                  num(
                    fact.qty
                  ),
                0
              ) +
            quantity;


      project.factLog.push({

        id:
          uid(
            'FCT'
          ),

        frontId:
          front.id,

        date,

        qty:
          quantity,

        cumulative,

        people,

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        createdAt:
          nowIso(),

        importFingerprint:
          fingerprint,

        source: {

          batchId,

          ...importSource(
            item
          )
        }
      });


      front.doneQty =
        Math.max(
          num(
            front.doneQty
          ),
          cumulative
        );


      appended++;

      continue;
    }


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
        );


      const number =
        normText(
          mappedValue(
            row,
            'elementNo'
          )
        );


      if (
        !type ||
        !number
      ) {

        skipped++;

        continue;
      }


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


      const element = {

        id:
          uid(
            'EL'
          ),

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

          ...importSource(
            item
          )
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

      continue;
    }


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
        );


      if (!title) {

        skipped++;

        continue;
      }


      let milestone =
        project.milestones
          .find(
            item =>
              sameText(
                item.title,
                title
              )
          );


      const existed =
        !!milestone;


      if (!milestone) {

        milestone = {

          id:
            uid(
              'M'
            ),

          title,

          createdAt:
            nowIso()
        };


        project.milestones.push(
          milestone
        );
      }


      milestone.contractDate =
        normDate(
          mappedValue(
            row,
            'contractEnd'
          )
        ) ||
        milestone.contractDate ||
        '';


      milestone.workDate =
        normDate(
          mappedValue(
            row,
            'planEnd'
          )
        ) ||
        milestone.workDate ||
        '';


      milestone.forecastDate =
        normDate(
          mappedValue(
            row,
            'forecastEnd'
          )
        ) ||
        milestone.forecastDate ||
        '';


      milestone.factDate =
        normDate(
          mappedValue(
            row,
            'factEnd'
          )
        ) ||
        milestone.factDate ||
        '';


      milestone.status =
        normText(
          mappedValue(
            row,
            'status'
          )
        ) ||
        milestone.status ||
        'Не наступила';


      milestone.updatedAt =
        nowIso();


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
      clone(
        importMapping
      )
  });


  log(
    'Импорт',
    'Проект',

    `${importFileName} / ${importSheetName}: ` +
    `создано ${created}, ` +
    `обновлено ${updated}, ` +
    `добавлено ${appended}, ` +
    `пропущено ${skipped}`
  );


  await saveProject();


  renderAll();


  $('importInfo').className =
    'notice good';


  $('importInfo').textContent =

    `Импорт завершен.\n` +

    `Создано: ${created}\n` +

    `Обновлено: ${updated}\n` +

    `Добавлено: ${appended}\n` +

    `Пропущено: ${skipped}`;


  $('commitImportBtn').disabled =
    true;
}


/* =========================================================
   ОТКАТ ИМПОРТА
   ========================================================= */


async function rollbackLastImport() {

  const lastImport =
    project.importHistory?.[
      0
    ];


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
      'Для этого импорта отсутствует защитная копия.'
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


  if (
    !confirm(
      `Отменить последний импорт?\n\n` +
      `Файл: ${lastImport.fileName || '—'}\n` +
      `Лист: ${lastImport.sheetName || '—'}`
    )
  ) {

    return;
  }


  await dbPutKey(
    clone(
      project
    ),
    `before-rollback-${Date.now()}`
  );


  project =
    normalizeProject(
      backup
    );


  log(
    'Отмена импорта',
    'Проект',

    `Восстановлено состояние до импорта ${lastImport.fileName || ''}`
  );


  await saveProject();


  renderAll();


  alert(
    'Последний импорт отменен.'
  );
}


/* =========================================================
   ПЕЧАТЬ
   ========================================================= */


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


/* =========================================================
   ВКЛАДКИ
   ========================================================= */


function switchTab(
  name
) {

  document
    .querySelectorAll(
      '.tab[data-tab]'
    )
    .forEach(
      button =>
        button.classList
          .toggle(
            'active',

            button.dataset
              .tab ===
              name
          )
    );


  document
    .querySelectorAll(
      'main > .panel'
    )
    .forEach(
      panel =>
        panel.classList
          .add(
            'hidden'
          )
    );


  $(
    `tab-${name}`
  )
    ?.classList
    .remove(
      'hidden'
    );


  if (
    name ===
    'resources'
  ) {

    renderResourceCurrentView();
  }


  if (
    name ===
    'gantt'
  ) {

    renderGantt();
  }
}


/* =========================================================
   ОБЩАЯ ОТРИСОВКА
   ========================================================= */


function renderAll() {

  initSelects();

  renderDashboard();

  renderMatrix();

  renderGantt();

  renderPlanFact();

  renderResourceJournal();

  renderMilestones();

  renderElements();

  renderDemolition();

  renderHistory();

  renderSettings();


  if (
    !$('tab-resources')
      .classList
      .contains(
        'hidden'
      )
  ) {

    renderResourceCurrentView();
  }
}


/* =========================================================
   СОБЫТИЯ
   ========================================================= */


function bindUi() {

  document
    .querySelectorAll(
      '.tab[data-tab]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            switchTab(
              button.dataset
                .tab
            );
      }
    );


  document
    .querySelectorAll(
      '[data-rview]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            switchResourceView(
              button.dataset
                .rview
            );
      }
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
      id => {

        $(id).onchange =
          renderMatrix;
      }
    );


  [
    'gBuilding',
    'gWork',
    'gMode'
  ]
    .forEach(
      id => {

        $(id).onchange =
          renderGantt;
      }
    );


  [
    'pfFrom',
    'pfTo',
    'pfBuilding',
    'pfWork'
  ]
    .forEach(
      id => {

        $(id).onchange =
          renderPlanFact;
      }
    );


  [
    'rFrom',
    'rTo',
    'rOrg',
    'rBuilding',
    'rWork',
    'rFront'
  ]
    .forEach(
      id => {

        $(id).onchange =
          () => {

            renderResourceCurrentView();
          };
      }
    );


  $('rDailyDate').onchange =
    renderResourceDaily;


  $('rDynType').onchange =
    renderResourceDynamics;


  $('rDynOrg').onchange =
    renderResourceDynamics;


  $('rAvgMethod').onchange =
    renderResourceAnalytics;


  $('rMissingRule').onchange =
    renderResourceAnalytics;


  $('rpStep').onchange =
    renderResourcePlanFact;


  $('saveResourceViewBtn').onclick =
    saveResourceView;


  $('resourceColumnsBtn').onclick =
    () => {

      const panel =
        $('resourceColumnsPanel');


      panel.classList
        .toggle(
          'hidden'
        );


      if (
        !panel.classList
          .contains(
            'hidden'
          )
      ) {

        renderResourceColumnPanel();
      }
    };


  [
    'elBuilding',
    'elType'
  ]
    .forEach(
      id => {

        $(id).onchange =
          renderElements;
      }
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
    () =>
      openResourceEditor();


  $('newResourcePlanBtn').onclick =
    () =>
      openResourcePlanEditor();


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
    event => {

      if (
        event.target
          .files[0]
      ) {

        restoreProject(
          event.target
            .files[0]
        );
      }
    };


  $('compareInput').onchange =
    event => {

      if (
        event.target
          .files[0]
      ) {

        compareProjectFile(
          event.target
            .files[0]
        );
      }
    };


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
          'Очистить рабочие данные? Справочники зданий, видов работ и организаций останутся.'
        )
      ) {

        return;
      }


      const backupKey =
        `pre-clear-${Date.now()}`;


      await dbPutKey(
        clone(
          project
        ),
        backupKey
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


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */


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


  const current =
    today();


  const currentDate =
    new Date(
      `${current}T00:00:00`
    );


  const firstOfMonth =
    `${current.slice(0, 8)}01`;


  $('pfTo').value =
    current;


  $('rFrom').value =
    firstOfMonth;


  $('rTo').value =
    current;


  $('rDailyDate').value =
    current;


  renderBackupNotice();


  renderAll();
}


/* =========================================================
   ЗАПУСК
   ========================================================= */


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
