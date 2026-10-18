'use strict';

/* =========================================================
   LIV PLANNING
   CORE
   Версия структуры: 2.2.0
   ========================================================= */


const $ = id =>
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
  '2.4.0';


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


let db = null;

let project = null;

let compareIncoming = null;

let compareItems = [];


/* =========================================================
   ИМПОРТ
   ========================================================= */


let importWorkbook = null;

let importFileName = '';

let importSheetName = '';

let importHeaders = [];

let importRawRows = [];

let importRows = [];

let importMapping = {};

let importModeResolved =
  'fronts';

let importMappingMode = '';

let importMatrixLayoutDetected =
  false;

let importMatrixLayoutInfo =
  '';

let importMatrixTargetId =
  '';

let importMatrixTargetMode =
  'new';



/* =========================================================
   БАЗОВЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================= */


const uid = prefix => {

  if (
    window.crypto &&
    typeof crypto.randomUUID ===
      'function'
  ) {

    return (
      `${prefix}-${crypto.randomUUID()}`
    );
  }

  return (
    `${prefix}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
};


let livTrustedToday = '';


function localIsoDate(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    )
      .padStart(
        2,
        '0'
      );

  const day =
    String(
      date.getDate()
    )
      .padStart(
        2,
        '0'
      );

  return (
    `${year}-${month}-${day}`
  );
}


const today = () => {

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      livTrustedToday
    )
  ) {
    return livTrustedToday;
  }

  return localIsoDate(
    new Date()
  );
};


async function syncTrustedToday() {

  try {

    const response =
      await fetch(
        'https://worldtimeapi.org/api/timezone/Etc/UTC',
        {
          cache:
            'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        'time service unavailable'
      );
    }

    const data =
      await response.json();

    const datetime =
      String(
        data.datetime ||
        ''
      );

    if (!datetime) {
      throw new Error(
        'empty server date'
      );
    }

    const instant =
      new Date(
        datetime
      );

    if (
      Number.isNaN(
        instant.getTime()
      )
    ) {
      throw new Error(
        'invalid server date'
      );
    }

    livTrustedToday =
      localIsoDate(
        instant
      );

    return livTrustedToday;

  } catch (
    error
  ) {

    console.warn(
      'LIV: не удалось получить серверную дату, используется локальная дата.',
      error
    );

    livTrustedToday =
      localIsoDate(
        new Date()
      );

    return livTrustedToday;
  }
}


const nowIso = () =>
  new Date().toISOString();


const clone = value =>
  JSON.parse(
    JSON.stringify(
      value
    )
  );


const num = value => {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const cleaned =
    String(value)
      .replace(
        /\s/g,
        ''
      )
      .replace(
        /,/g,
        '.'
      )
      .replace(
        /[^\d.+-]/g,
        ''
      );

  const result =
    Number(cleaned);

  return (
    Number.isFinite(result)
      ? result
      : 0
  );
};


const fmt = value =>
  Math.round(
    num(value) *
    100
  ) /
  100;


const fmt1 = value =>
  Math.round(
    num(value) *
    10
  ) /
  10;


const roundInt = value =>
  Math.round(
    num(value)
  );


const esc = value =>
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


const normText = value =>
  String(
    value ??
    ''
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();


const normKey = value =>
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


const sameText = (
  a,
  b
) =>
  normKey(a) ===
  normKey(b);


const uniq = array =>
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


const byId = (
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
  a,
  b
) => {

  if (
    !a ||
    !b
  ) {
    return null;
  }

  return Math.round(
    (
      Date.parse(b) -
      Date.parse(a)
    ) /
    86400000
  );
};


function dateRange(
  from,
  to
) {

  const result = [];

  if (
    !from ||
    !to
  ) {
    return result;
  }

  let current =
    new Date(
      `${from}T12:00:00`
    );

  const end =
    new Date(
      `${to}T12:00:00`
    );

  if (
    Number.isNaN(
      current.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    ) ||
    current >
      end
  ) {

    return result;
  }

  while (
    current <=
    end
  ) {

    const year =
      current.getFullYear();

    const month =
      String(
        current.getMonth() +
        1
      )
        .padStart(
          2,
          '0'
        );

    const day =
      String(
        current.getDate()
      )
        .padStart(
          2,
          '0'
        );

    result.push(
      `${year}-${month}-${day}`
    );

    current.setDate(
      current.getDate() +
      1
    );
  }

  return result;
}


function isWorkday(
  dateString
) {

  if (!dateString) {
    return false;
  }

  const day =
    new Date(
      `${dateString}T12:00:00`
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

  const parts =
    String(value)
      .slice(
        0,
        10
      )
      .split('-');

  if (
    parts.length !==
    3
  ) {
    return value;
  }

  return (
    `${parts[2]}.${parts[1]}.${parts[0]}`
  );
}


function shortDate(
  value
) {

  if (!value) {
    return '';
  }

  const parts =
    String(value)
      .slice(
        0,
        10
      )
      .split('-');

  if (
    parts.length !==
    3
  ) {
    return value;
  }

  return (
    `${parts[2]}.${parts[1]}`
  );
}


function startOfWeek(
  dateString
) {

  if (!dateString) {
    return '';
  }

  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

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

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
      1
    )
      .padStart(
        2,
        '0'
      );

  const day =
    String(
      date.getDate()
    )
      .padStart(
        2,
        '0'
      );

  return (
    `${year}-${month}-${day}`
  );
}


function monthKey(
  dateString
) {

  if (!dateString) {
    return '';
  }

  return String(
    dateString
  )
    .slice(
      0,
      7
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
        'LIV Planning',

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
                index + 1
              )
                .padStart(
                  3,
                  '0'
                )}`,

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
      DEFAULT_WORKS
        .map(
          (
            row,
            index
          ) => ({

            id:
              `WRK-${String(
                index + 1
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
              index + 1
          })
        ),

    structures:
      [],

    fronts:
      [],

    matrices:
      [],

    matrixFronts:
      [],

    /* Новое ядро графика. Старые fronts сохраняются для совместимости. */
    tasks:
      [],

    taskDates:
      [],

    taskQuantities:
      [],

    dependencies:
      [],

    dailyReports:
      [],

    factHistory:
      [],

    quantityHistory:
      [],

    forecastSnapshots:
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

    numberedElementGroups:
      [],

    numberedElements:
      [],

    workMetrics:
      [],

    progressFacts:
      [],

    sourceMappings:
      [],

    entityAliases:
      [],

    networkSegments:
      [],

    reportSnapshots:
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
                index + 1
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

      request.onblocked =
        () => {

          alert(
            'База LIV Planning открыта в другой вкладке. Закрой старые вкладки приложения и обнови страницу.'
          );
        };
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

      transaction.onabort = () => reject(transaction.error || new Error('Запись отменена локальной базой.'));

      transaction.onerror =
        () =>
          reject(
            transaction.error
          );
    }
  );
}


/* =========================================================
   НОРМАЛИЗАЦИЯ / МИГРАЦИЯ
   ========================================================= */


function normalizeProject(
  data
) {

  const base =
    emptyProject();

  const source =
    data ||
    {};

  const result = {

    ...base,

    ...source
  };


  result.meta = {

    ...base.meta,

    ...(
      source.meta ||
      {}
    ),

    projectName:
      'LIV Planning'
  };


  const arrays = [
    'buildings',
    'organizations',
    'works',
    'structures',
    'fronts',
    'matrices',
    'matrixFronts',
    'tasks',
    'taskDates',
    'taskQuantities',
    'dependencies',
    'dailyReports',
    'factHistory',
    'quantityHistory',
    'quantityBaselines',
    'quantityChanges',
    'quantityPlans',
    'forecastSnapshots',
    'planLog',
    'factLog',
    'resources',
    'resourcePlans',
    'milestones',
    'numberedElementGroups',
    'numberedElements',
    'workMetrics',
    'progressFacts',
    'sourceMappings',
    'entityAliases',
    'networkSegments',
    'reportSnapshots',
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
          source[key]
        )
      ) {

        result[key] =
          source[key];
      }
    }
  );


  result.fronts =
    (
      result.fronts ||
      []
    )
      .map(
        front => ({

          active:
            true,

          accepted:
            false,

          completed:
            false,

          ...front
        })
      );


  result.resources =
    (
      result.resources ||
      []
    )
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
    (
      result.resourcePlans ||
      []
    );


  if (
    !result.progressFacts.length &&
    result.factLog.length
  ) {

    result.progressFacts =
      result.factLog
        .map(
          row => ({
            id:
              row.id ||
              uid(
                'FCT'
              ),
            frontId:
              row.frontId,
            factDate:
              row.date,
            factType:
              'quantity',
            quantity:
              num(
                row.qty
              ),
            cumulativeQty:
              row.cumulative,
            people:
              row.people,
            comment:
              row.comment ||
              '',
            sourceFingerprint:
              row.importFingerprint ||
              (
                'legacy:' +
                (
                  row.id ||
                  uid(
                    'FCT'
                  )
                )
              ),
            createdAt:
              row.createdAt ||
              nowIso(),
            source:
              row.source ||
              null
          })
        );
  }


  result.numberedElements =
    (
      result.numberedElements ||
      []
    )
      .map(
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
      `Структура обновлена ${oldVersion} → ${SCHEMA_VERSION}. Создана локальная защитная копия.`
  });


  return migrated;
}


/* =========================================================
   СОХРАНЕНИЕ / ИСТОРИЯ
   ========================================================= */


async function saveProject() {

  if (!project) {
    return;
  }

  project.meta =
    project.meta ||
    {};

  project.meta.projectName =
    'LIV Planning';

  project.meta.updatedAt =
    nowIso();

  project.schemaVersion =
    SCHEMA_VERSION;


  await dbPutKey(
    project
  );


  if (
    window.LIV_REMOTE_SYNC &&
    typeof window.LIV_REMOTE_SYNC.queueSave ===
      'function'
  ) {

    window.LIV_REMOTE_SYNC.queueSave(
      project
    );
  }


  if (
    typeof renderBackupNotice ===
    'function'
  ) {

    renderBackupNotice();
  }
}


function log(
  action,
  entity,
  description,
  details =
    {}
) {

  if (
    !project
  ) {
    return;
  }

  project.history =
    project.history ||
    [];


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
   СКАЧИВАНИЕ
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

  return (
    project?.fronts ||
    []
  )
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

    ...(window.LIV_PLANNING_DOMAIN?.frontView(project,front)||{}),

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


  const item =
    hydrateFront(
      front
    );


  return [
    item.building,

    item.block,

    item.floor !==
      ''
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


  (
    items ||
    []
  )
    .forEach(
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
      (
        list ||
        []
      )
        .filter(
          item =>
            item.active !==
            false
        )
        .map(
          item => `
            <option
              value="${esc(item.id)}"
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
              ${esc(item.name)}
            </option>
          `
        )
        .join('')
    }
  `;
}


function initSelects() {

  const buildings =
    (
      project.buildings ||
      []
    )
      .filter(
        item =>
          item.active !==
          false
      );


  const works =
    (
      project.works ||
      []
    )
      .filter(
        item =>
          item.active !==
          false
      );


  const organizations =
    (
      project.organizations ||
      []
    )
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
      (
        project.numberedElements ||
        []
      )
        .map(
          item =>
            item.elementType
        )
    )
      .sort(
        (
          a,
          b
        ) =>
          String(a)
            .localeCompare(
              String(b),
              'ru'
            )
      )
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
        front => `
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
                front.status ||
                ''
              )}
            </strong>

          </div>
        `
      )
      .join('') ||
    `
      <div class="muted">
        Нет критичных фронтов
      </div>
    `;


  /*
    0 и "нет данных" — разные состояния.
    Пустые предзаполненные строки не сдвигают дату текущих ресурсов.
  */
  const resourceRowHasData =
    row => {

      if (!row || !row.date) {
        return false;
      }

      const numericKeys = [
        'peopleQty',
        'itr',
        'workers',
        'mechanizers',
        'equipmentQty'
      ];

      const hasPositiveOrNegativeValue =
        numericKeys.some(
          key => {

            const raw =
              row[key];

            if (
              raw === '' ||
              raw === null ||
              raw === undefined
            ) {
              return false;
            }

            const value =
              Number(raw);

            return (
              Number.isFinite(value) &&
              value !== 0
            );
          }
        );

      if (hasPositiveOrNegativeValue) {
        return true;
      }

      return Boolean(
        String(row.equipmentType || '').trim() ||
        String(row.specialization || '').trim() ||
        String(row.comment || '').trim() ||
        row.reportConfirmed === true ||
        row.hasData === true
      );
    };


  const meaningfulResourceRows =
    (
      project.resources ||
      []
    )
      .filter(
        resourceRowHasData
      );


  const currentDate =
    today();


  const rows =
    meaningfulResourceRows
      .filter(
        row =>
          row.date ===
          currentDate
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


  $('dResources').innerHTML = `
    <div class="item">

      <span>
        Дата
      </span>

      <strong>
        ${ruDate(currentDate)}
      </strong>

    </div>

    <div class="item">

      <span>
        Людей
      </span>

      <strong>
        ${roundInt(people)}
      </strong>

    </div>

    <div class="item">

      <span>
        Техники
      </span>

      <strong>
        ${roundInt(equipment)}
      </strong>

    </div>
  `;
}


/* =========================================================
   ШАХМАТКА
   ========================================================= */


function activeMatrices() {

  return (
    project.matrices ||
    []
  )
    .filter(
      matrix =>
        matrix.active !==
        false
    );
}


function matrixById(
  id
) {

  return byId(
    project.matrices,
    id
  );
}


function activeMatrixLinks(
  matrixId
) {

  return (
    project.matrixFronts ||
    []
  )
    .filter(
      link =>
        link.active !==
          false &&
        (
          !matrixId ||
          String(
            link.matrixId
          ) ===
          String(
            matrixId
          )
        )
    );
}


function matrixFrontIds(
  matrixId
) {

  return new Set(
    activeMatrixLinks(
      matrixId
    )
      .map(
        link =>
          String(
            link.frontId
          )
      )
  );
}


function ensureMatrixFrontLink(
  matrixId,
  frontId,
  batchId =
    ''
) {

  if (
    !matrixId ||
    !frontId
  ) {
    return null;
  }


  project.matrixFronts =
    project.matrixFronts ||
    [];


  let link =
    project.matrixFronts
      .find(
        item =>
          String(
            item.matrixId
          ) ===
            String(
              matrixId
            ) &&
          String(
            item.frontId
          ) ===
            String(
              frontId
            )
      );


  if (!link) {

    link = {
      id:
        uid(
          'MXL'
        ),
      matrixId,
      frontId,
      active:
        true,
      createdAt:
        nowIso(),
      updatedAt:
        nowIso(),
      sourceBatchId:
        batchId ||
        ''
    };


    project.matrixFronts.push(
      link
    );

  } else {

    link.active =
      true;

    link.updatedAt =
      nowIso();

    if (
      batchId
    ) {
      link.sourceBatchId =
        batchId;
    }
  }


  return link;
}


function matrixFrontUsageCount(
  frontId,
  excludeMatrixId =
    ''
) {

  return (
    project.matrixFronts ||
    []
  )
    .filter(
      link =>
        link.active !==
          false &&
        String(
          link.frontId
        ) ===
          String(
            frontId
          ) &&
        (
          !excludeMatrixId ||
          String(
            link.matrixId
          ) !==
            String(
              excludeMatrixId
            )
        )
    )
    .length;
}


function fillMatrixSelects() {

  const list =
    activeMatrices();


  if (
    $('mfMatrix')
  ) {

    const current =
      $('mfMatrix').value;


    $('mfMatrix').innerHTML =
      `
        <option value="all">
          Все шахматки
        </option>
      ` +
      list
        .map(
          item => `
            <option value="${esc(item.id)}">
              ${esc(item.name)}
            </option>
          `
        )
        .join('');


    if (
      current &&
      [
        'all',
        ...list.map(
          item =>
            String(
              item.id
            )
        )
      ]
        .includes(
          String(
            current
          )
        )
    ) {
      $('mfMatrix').value =
        current;
    }
  }


  if (
    $('importMatrixTarget')
  ) {

    const current =
      importMatrixTargetId ||
      $('importMatrixTarget').value;


    $('importMatrixTarget').innerHTML =
      `
        <option value="new">
          Создать новую шахматку
        </option>
      ` +
      list
        .map(
          item => `
            <option value="${esc(item.id)}">
              Обновить: ${esc(item.name)}
            </option>
          `
        )
        .join('');


    if (
      current &&
      (
        current ===
          'new' ||
        list.some(
          item =>
            String(
              item.id
            ) ===
            String(
              current
            )
        )
      )
    ) {
      $('importMatrixTarget').value =
        current;
    }
  }
}


function currentMatrixId() {

  const value =
    $('mfMatrix')?.value ||
    'all';


  return (
    value ===
      'all'
      ? ''
      : value
  );
}


function updateMatrixDependent() {

  fillMatrixSelects();


  const buildingId =
    $('mfBuilding')?.value ||
    'all';


  const structures =
    (
      project.structures ||
      []
    )
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

  const matrixId =
    currentMatrixId();


  const linked =
    matrixId
      ? matrixFrontIds(
          matrixId
        )
      : null;


  return activeFronts()
    .map(
      hydrateFront
    )
    .filter(
      front =>

        (
          !linked ||
          linked.has(
            String(
              front.id
            )
          )
        ) &&

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


  const selectedMatrix =
    matrixById(
      currentMatrixId()
    );


  if (
    $('matrixContextInfo')
  ) {

    const count =
      matrixFiltered()
        .length;


    $('matrixContextInfo').innerHTML =
      selectedMatrix
        ? `
            <strong>${esc(selectedMatrix.name)}</strong>
            <span>${count} фронтов</span>
            <span>
              ${selectedMatrix.sourceFile
                ? 'Источник: ' + esc(selectedMatrix.sourceFile)
                : 'Локальная шахматка'}
            </span>
          `
        : `
            <strong>Все шахматки</strong>
            <span>${count} фронтов</span>
          `;
  }


  $('matrixHead').innerHTML = `
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
        front => `
          <tr class="${statusRowClass(
            front.status
          )}">

            <td>
              ${esc(front.building)}
            </td>

            <td>
              ${esc(front.block)}
            </td>

            <td>
              ${esc(front.floor)}
            </td>

            <td>
              ${esc(front.capture)}
            </td>

            <td>
              ${esc(front.axis)}
            </td>

            <td>
              ${esc(front.side)}
            </td>

            <td>
              ${esc(front.zone)}
            </td>

            <td>
              ${esc(front.work)}
            </td>

            <td>
              ${esc(front.organization)}
            </td>

            <td>
              <span class="badge">
                ${esc(
                  front.status ||
                  ''
                )}
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


  document.body.style.overflow =
    'hidden';
}


function closeModal() {

  $('modal')
    .classList
    .add(
      'hidden'
    );


  $('modalBody').innerHTML =
    '';


  document.body.style.overflow =
    '';
}


/* =========================================================
   РЕДАКТОР ФРОНТА
   ========================================================= */


function frontMetricRows(
  frontId
) {

  return (
    project.workMetrics ||
    []
  )
    .filter(
      item =>
        item.active !==
          false &&
        String(
          item.frontId ||
          ''
        ) ===
          String(
            frontId ||
            ''
          ) &&
        item.isPrimary !==
          true
    );
}


function frontMetricRowHtml(
  metric =
    {}
) {

  const methods = [
    [
      'quantity',
      'Объём'
    ],
    [
      'length',
      'Длина'
    ],
    [
      'area',
      'Площадь'
    ],
    [
      'elements',
      'Элементы'
    ],
    [
      'status',
      'Статус'
    ],
    [
      'manual',
      'Ручной'
    ]
  ];


  return `
    <tr
      data-front-metric-row
      data-metric-id="${esc(
        metric.id ||
        ''
      )}">

      <td>
        <input
          data-metric-name
          value="${esc(
            metric.name ||
            ''
          )}"
          placeholder="Например: Труба"
        >
      </td>

      <td>
        <input
          data-metric-unit
          value="${esc(
            metric.unit ||
            ''
          )}"
          placeholder="м.п. / м³ / шт."
        >
      </td>

      <td>
        <input
          data-metric-target
          type="number"
          min="0"
          step="any"
          value="${metric.targetQty ?? ''}"
          placeholder="0"
        >
      </td>

      <td>
        <select data-metric-method>
          ${
            methods
              .map(
                (
                  [
                    value,
                    label
                  ]
                ) =>
                  `
                    <option
                      value="${value}"
                      ${
                        value ===
                        (
                          metric.calculationMethod ||
                          'quantity'
                        )
                          ? 'selected'
                          : ''
                      }>
                      ${label}
                    </option>
                  `
              )
              .join('')
          }
        </select>
      </td>

      <td>
        <button
          type="button"
          class="btn"
          data-remove-front-metric>
          ×
        </button>
      </td>

    </tr>
  `;
}


function bindFrontMetricEditor() {

  const body =
    $('frontMetricsBody');


  const add =
    $('addFrontMetric');


  if (
    !body ||
    !add
  ) {
    return;
  }


  const bindRemove =
    () => {

      body
        .querySelectorAll(
          '[data-remove-front-metric]'
        )
        .forEach(
          button => {

            button.onclick =
              () =>
                button
                  .closest(
                    '[data-front-metric-row]'
                  )
                  ?.remove();
          }
        );
    };


  add.onclick =
    () => {

      body.insertAdjacentHTML(
        'beforeend',
        frontMetricRowHtml()
      );


      bindRemove();
    };


  bindRemove();
}


function saveFrontMetrics(
  front
) {

  project.workMetrics =
    Array.isArray(
      project.workMetrics
    )
      ? project.workMetrics
      : [];


  const work =
    byId(
      project.works,
      front.workId
    );


  const primaryId =
    'METRIC-' +
    front.id +
    '-PRIMARY';


  let primary =
    project.workMetrics
      .find(
        item =>
          String(
            item.id
          ) ===
          primaryId
      );


  if (!primary) {

    primary = {
      id:
        primaryId,
      frontId:
        front.id,
      createdAt:
        nowIso()
    };


    project.workMetrics.push(
      primary
    );
  }


  Object.assign(
    primary,
    {
      frontId:
        front.id,
      code:
        'primary',
      name:
        work?.name ||
        'Основной объём',
      unit:
        front.unit ||
        work?.unit ||
        'ед.',
      targetQty:
        num(
          front.totalQty
        ),
      weight:
        1,
      calculationMethod:
        /шт/i
          .test(
            front.unit ||
            work?.unit ||
            ''
          )
          ? 'elements'
          : 'quantity',
      isPrimary:
        true,
      active:
        true,
      updatedAt:
        nowIso()
    }
  );


  const seen =
    new Set([
      primaryId
    ]);


  document
    .querySelectorAll(
      '[data-front-metric-row]'
    )
    .forEach(
      row => {

        const name =
          row.querySelector(
            '[data-metric-name]'
          )
            ?.value
            .trim() ||
          '';


        const unit =
          row.querySelector(
            '[data-metric-unit]'
          )
            ?.value
            .trim() ||
          '';


        if (
          !name &&
          !unit
        ) {
          return;
        }


        let id =
          row.dataset
            .metricId ||
          '';


        if (!id) {

          id =
            uid(
              'MET'
            );
        }


        let metric =
          project.workMetrics
            .find(
              item =>
                String(
                  item.id
                ) ===
                String(
                  id
                )
            );


        if (!metric) {

          metric = {
            id,
            frontId:
              front.id,
            createdAt:
              nowIso()
          };


          project.workMetrics.push(
            metric
          );
        }


        Object.assign(
          metric,
          {
            frontId:
              front.id,
            code:
              metric.code ||
              (
                'metric-' +
                id
              ),
            name:
              name ||
              'Показатель',
            unit:
              unit ||
              'ед.',
            targetQty:
              num(
                row.querySelector(
                  '[data-metric-target]'
                )
                  ?.value
              ),
            weight:
              num(
                metric.weight ||
                1
              ) ||
              1,
            calculationMethod:
              row.querySelector(
                '[data-metric-method]'
              )
                ?.value ||
              'quantity',
            isPrimary:
              false,
            active:
              true,
            updatedAt:
              nowIso()
          }
        );


        seen.add(
          String(
            metric.id
          )
        );
      }
    );


  project.workMetrics
    .filter(
      item =>
        String(
          item.frontId ||
          ''
        ) ===
          String(
            front.id
          ) &&
        item.isPrimary !==
          true &&
        !seen.has(
          String(
            item.id
          )
        )
    )
    .forEach(
      item => {

        item.active =
          false;

        item.archivedAt =
          nowIso();

        item.updatedAt =
          nowIso();
      }
    );
}


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

        <label>
          Здание
        </label>

        <select id="eBuilding">
          ${selectOptions(
            project.buildings,
            structure.buildingId
          )}
        </select>

      </div>


      <div class="field">

        <label>
          Блок
        </label>

        <input
          id="eBlock"
          value="${esc(
            structure.block ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Этаж
        </label>

        <input
          id="eFloor"
          value="${esc(
            structure.floor ??
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Захватка
        </label>

        <input
          id="eCapture"
          value="${esc(
            structure.capture ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Ось
        </label>

        <input
          id="eAxis"
          value="${esc(
            structure.axis ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Сторона
        </label>

        <input
          id="eSide"
          value="${esc(
            structure.side ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Зона
        </label>

        <input
          id="eZone"
          value="${esc(
            structure.zone ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          № помещения
        </label>

        <input
          id="eRoomNo"
          value="${esc(
            structure.roomNo ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Помещение
        </label>

        <input
          id="eRoomName"
          value="${esc(
            structure.roomName ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Вид работы
        </label>

        <select id="eWork">
          ${selectOptions(
            project.works,
            front.workId
          )}
        </select>

      </div>


      <div class="field">

        <label>
          Организация
        </label>

        <select id="eOrg">

          ${selectOptions(
            project.organizations,
            front.organizationId,
            true
          )}

        </select>

      </div>


      <div class="field">

        <label>
          Ответственный
        </label>

        <input
          id="eResponsible"
          value="${esc(
            front.responsible ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Статус
        </label>

        <select id="eStatus">

          ${
            STATUS_LIST
              .map(
                status => `
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

        <label>
          Ед. изм.
        </label>

        <input
          id="eUnit"
          value="${esc(
            front.unit ||
            ''
          )}"
        >

      </div>


      <div class="field">

        <label>
          Общий объем
        </label>

        <input
          id="eTotal"
          type="number"
          step="any"
          value="${front.totalQty ?? ''}"
        >

      </div>


      <div class="field">

        <label>
          Накопительно выполнено
        </label>

        <input
          id="eDone"
          type="number"
          step="any"
          value="${front.doneQty ?? ''}"
        >

      </div>


      <div class="field">

        <label>
          Договор начало
        </label>

        <input
          id="eContractStart"
          type="date"
          value="${front.contractStart || ''}"
        >

      </div>


      <div class="field">

        <label>
          Договор окончание
        </label>

        <input
          id="eContractEnd"
          type="date"
          value="${front.contractEnd || ''}"
        >

      </div>


      <div class="field">

        <label>
          База начало
        </label>

        <input
          id="eBaselineStart"
          type="date"
          value="${front.baselineStart || ''}"
        >

      </div>


      <div class="field">

        <label>
          База окончание
        </label>

        <input
          id="eBaselineEnd"
          type="date"
          value="${front.baselineEnd || ''}"
        >

      </div>


      <div class="field">

        <label>
          Рабочий план начало
        </label>

        <input
          id="ePlanStart"
          type="date"
          value="${front.planStart || ''}"
        >

      </div>


      <div class="field">

        <label>
          Рабочий план окончание
        </label>

        <input
          id="ePlanEnd"
          type="date"
          value="${front.planEnd || ''}"
        >

      </div>


      <div class="field">

        <label>
          Факт начало
        </label>

        <input
          id="eFactStart"
          type="date"
          value="${front.factStart || ''}"
        >

      </div>


      <div class="field">

        <label>
          Факт окончание
        </label>

        <input
          id="eFactEnd"
          type="date"
          value="${front.factEnd || ''}"
        >

      </div>


      <div class="field">

        <label>
          Прогноз окончание
        </label>

        <input
          id="eForecastEnd"
          type="date"
          value="${front.forecastEnd || ''}"
        >

      </div>

    </div>


    <div
      class="field"
      style="grid-column:1/-1">

      <label>
        Дополнительные показатели объёма
      </label>

      <div class="muted">
        Для инженерных сетей и сложных фронтов можно учитывать несколько показателей:
        труба, траншея, колодцы, изоляция и т. п.
        Основной объём выше остаётся главным показателем фронта.
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Показатель</th>
              <th>Ед.</th>
              <th>Общий объём</th>
              <th>Метод</th>
              <th></th>
            </tr>
          </thead>

          <tbody id="frontMetricsBody">
            ${
              frontMetricRows(
                front.id
              )
                .map(
                  frontMetricRowHtml
                )
                .join('')
            }
          </tbody>
        </table>
      </div>

      <button
        type="button"
        id="addFrontMetric"
        class="btn">
        + Показатель
      </button>

    </div>


    <div class="field">

      <label>
        Ограничение
      </label>

      <textarea id="eConstraint">${esc(
        front.constraint ||
        ''
      )}</textarea>

    </div>


    <div class="field">

      <label>
        Комментарий / факт
      </label>

      <textarea id="eComment">${esc(
        front.comment ||
        ''
      )}</textarea>

    </div>


    <div class="editor-actions">

      ${
        front.id
          ? `
              <button
                id="deleteFront"
                class="btn danger">
                Архивировать
              </button>
            `
          : ''
      }

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
        ) ||
        {}
      : {};


  openModal(
    id
      ? 'Карточка фронта'
      : 'Новый фронт',

    frontForm(
      front
    )
  );


  bindFrontMetricEditor();


  $('saveFront').onclick =
    () =>
      saveFrontFromModal(
        id
      );


  if (
    id &&
    $('deleteFront')
  ) {

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
        front?.accepted ||
        false,

      updatedAt:
        nowIso()
    }
  );


  if (!id) {

    project.fronts.push(
      front
    );


    const matrixId =
      typeof currentMatrixId ===
        'function'
        ? currentMatrixId()
        : '';


    if (
      matrixId &&
      typeof ensureMatrixFrontLink ===
        'function'
    ) {

      ensureMatrixFrontLink(
        matrixId,
        front.id
      );


      front.originMatrixId =
        matrixId;
    }
  }


  saveFrontMetrics(
    front
  );


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

    $('gantt').innerHTML = `
      <div class="muted">
        Нет заполненных дат для выбранного слоя.
      </div>
    `;

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
                  style="
                    left:${left}%;
                    width:${width}%;
                  ">

                  ${ruDate(item.dates[0])}
                  →
                  ${ruDate(item.dates[1])}

                </div>

              </div>

            </div>
          `;
        }
      )
      .join('');
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


function canonicalFactRows() {
  return window.LIV_FACT_SERIES.series(window.LIV_FACT_SERIES.primaryRows(project)).entries;
}


function renderPlanFact() {

  const ids =
    pfFrontIds();


  const from =
    $('pfFrom').value;


  const to =
    $('pfTo').value;


  const plan =
    (
      project.planLog ||
      []
    )
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
    canonicalFactRows()
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
    (
      project.planLog ||
      []
    )
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
    canonicalFactRows()
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
        row => `
          <tr>

            <td>
              ${ruDate(row.date)}
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
              ${roundInt(row.people)}
            </td>

          </tr>
        `
      )
      .join('');


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
        row => `
          <tr>

            <td>
              ${ruDate(row.date)}
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
              ${roundInt(row.people)}
            </td>

          </tr>
        `
      )
      .join('');
}


/* =========================================================
   ДОБАВЛЕНИЕ ПЛАНА / ФАКТА
   ========================================================= */


function openLogEditor(
  mode
) {

  const frontOptions =
    activeFronts()
      .map(
        front => `
          <option value="${front.id}">
            ${esc(
              frontLabel(
                front
              )
            )}
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

          <label>
            Фронт
          </label>

          <select id="lFront">
            ${frontOptions}
          </select>

        </div>


        <div class="field">

          <label>
            Дата
          </label>

          <input
            id="lDate"
            type="date"
            value="${today()}"
          >

        </div>


        <div class="field">

          <label>
            Объем
          </label>

          <input
            id="lQty"
            type="number"
            step="any"
          >

        </div>


        <div class="field">

          <label>
            Люди
          </label>

          <input
            id="lPeople"
            type="number"
            step="1"
            min="0"
          >

        </div>


        ${
          mode ===
            'fact'
            ? `
                <div class="field">

                  <label>
                    Накопительный итог
                  </label>

                  <input
                    id="lCum"
                    type="number"
                    step="any"
                    placeholder="Если пусто — посчитается"
                  >

                </div>
              `
            : ''
        }

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

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
    roundInt(
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
    mode === 'fact' &&
    date < today() &&
    window.LIV_ACCESS &&
    window.LIV_ACCESS.canBackdateFact === false
  ) {
    alert(
      'Корректировка факта задним числом доступна только планеру или администратору.'
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

    const previous = window.LIV_FACT_SERIES.series(
      window.LIV_FACT_SERIES.primaryRows(project,new Set([String(frontId)])),date
    ).actual;

    const cumulative =
      $('lCum').value ===
        ''
        ? previous +
          quantity
        : num(
            $('lCum').value
          );


    const frontBeforeFact =
      byId(
        project.fronts,
        frontId
      );

    if (
      frontBeforeFact &&
      num(frontBeforeFact.totalQty) > 0 &&
      cumulative >
        num(frontBeforeFact.totalQty)
    ) {
      alert(
        'Внимание: накопительный факт превышает исходный объем фронта. ' +
        'Факт будет сохранен. Проверь и при необходимости скорректируй исходный объем.'
      );
    }

    const factId =
      uid(
        'FCT'
      );


    project.progressFacts =
      project.progressFacts ||
      [];


    project.progressFacts.push({

      id:
        factId,

      frontId,

      factDate:
        date,

      factType:
        $('lCum').value === '' ? 'quantity' : 'cumulative_snapshot',

      quantity,

      cumulativeQty:
        cumulative,

      people,

      comment,

      sourceFingerprint:
        'manual:' +
        factId,

      createdAt:
        nowIso(),

      createdByRole:
        window.LIV_ACCESS?.role ||
        '',

      backdated:
        date < today()
    });


    project.factLog.push({

      id:
        factId,

      frontId,

      date,

      qty:
        quantity,

      cumulative,

      people,

      comment,

      createdAt:
        nowIso(),

      createdByRole:
        window.LIV_ACCESS?.role ||
        '',

      backdated:
        date < today()
    });


    const front =
      byId(
        project.fronts,
        frontId
      );


    if(front)window.LIV_FACT_SERIES.refreshFront(project,front,today());

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