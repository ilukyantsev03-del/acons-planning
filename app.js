'use strict';


const $ = id =>
  document.getElementById(
    id
  );


const DB_NAME =
  'acons_planning_v3';


const DB_VERSION =
  1;


const STORE =
  'project';


const KEY =
  'main';


const SCHEMA_VERSION =
  '3.0.0';



const DEFAULT_STATUSES = [

  {
    id:
      'STS-NOT',

    name:
      'Не начато',

    color:
      '#e5e7eb',

    group:
      'production'
  },


  {
    id:
      'STS-READY',

    name:
      'Фронт готов',

    color:
      '#dbeafe',

    group:
      'production'
  },


  {
    id:
      'STS-WORK',

    name:
      'В работе',

    color:
      '#fef3c7',

    group:
      'production'
  },


  {
    id:
      'STS-DONE',

    name:
      'Выполнено',

    color:
      '#dcfce7',

    group:
      'production'
  },


  {
    id:
      'STS-HOLD',

    name:
      'Приостановлено',

    color:
      '#ede9fe',

    group:
      'production'
  },


  {
    id:
      'STS-RISK',

    name:
      'Ограничение',

    color:
      '#fee2e2',

    group:
      'production'
  }

];



const DEFAULT_ACCEPTANCE = [

  {
    id:
      'ACC-NO',

    name:
      'Не предъявлено',

    color:
      '#f3f4f6'
  },


  {
    id:
      'ACC-READY',

    name:
      'Готово к передаче',

    color:
      '#cffafe'
  },


  {
    id:
      'ACC-PRESENTED',

    name:
      'Предъявлено',

    color:
      '#ccfbf1'
  },


  {
    id:
      'ACC-INSPECTED',

    name:
      'Освидетельствовано',

    color:
      '#bbf7d0'
  },


  {
    id:
      'ACC-ACCEPTED',

    name:
      'Принято',

    color:
      '#86efac'
  }

];



const DIMENSIONS = {

  building:
    'Здание',

  block:
    'Блок',

  floor:
    'Этаж',

  capture:
    'Захватка',

  axis:
    'Ось',

  side:
    'Сторона',

  zone:
    'Зона',

  roomNo:
    '№ помещения',

  roomName:
    'Помещение',

  organization:
    'Организация'

};



const FIELD_LABELS = {

  work:
    'Работа',

  organization:
    'Организация',

  contract:
    'Договор',

  status:
    'Статус работ',

  acceptance:
    'Статус сдачи',

  unit:
    'Ед. изм.',

  totalQty:
    'Общий объём',

  doneQty:
    'Выполнено',

  percent:
    '% выполнения',


  contractStart:
    'Договорное начало',

  contractEnd:
    'Договорное окончание',


  baselineStart:
    'Базовое начало',

  baselineEnd:
    'Базовое окончание',


  planStart:
    'Плановое начало',

  planEnd:
    'Плановое окончание',


  factStart:
    'Фактическое начало',

  factEnd:
    'Фактическое окончание',


  forecastStart:
    'Прогнозное начало',

  forecastEnd:
    'Прогнозное окончание',


  variancePlan:
    'Отклонение от плана',

  varianceContract:
    'Отклонение от договора',


  responsible:
    'Ответственный',

  constraint:
    'Ограничение',

  comment:
    'Комментарий'

};



const CELL_MODES = {

  production:
    'Статус работ',

  acceptance:
    'Статус сдачи',

  percent:
    '% выполнения',

  qty:
    'Факт / объём',

  variancePlan:
    'Отклонение от плана',

  varianceContract:
    'Отклонение от договора',

  endDate:
    'Дата окончания'

};



const GANTT_LAYERS = [

  [
    'contract',
    'Договор'
  ],

  [
    'baseline',
    'База'
  ],

  [
    'plan',
    'План'
  ],

  [
    'fact',
    'Факт'
  ],

  [
    'forecast',
    'Прогноз'
  ]

];



let db =
  null;


let project =
  null;


let activeTab =
  'dashboard';


let currentViewId =
  null;


let compareIncoming =
  null;



const uid = prefix =>
  `${prefix}-${crypto.randomUUID()}`;


const nowIso = () =>
  new Date()
    .toISOString();


const today = () =>
  nowIso()
    .slice(
      0,
      10
    );


const esc = value =>
  String(
    value ??
    ''
  )
    .replace(
      /[&<>"']/g,
      character =>
        ({
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
        })[character]
    );


const num = value =>
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


const fmt = value =>
  Math.round(
    num(
      value
    ) *
    100
  ) /
  100;


const clone = value =>
  structuredClone(
    value
  );


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
  )
    ?.name ||
  '';


const dateDiff = (
  first,
  second
) => {

  if (
    !first ||
    !second
  ) {
    return null;
  }


  return Math.round(
    (
      Date.parse(
        second
      ) -
      Date.parse(
        first
      )
    ) /
    86400000
  );

};



function emptyProject() {


  const units = [

    {
      id:
        'U-M2',

      name:
        'м²',

      active:
        true
    },


    {
      id:
        'U-M',

      name:
        'м.п.',

      active:
        true
    },


    {
      id:
        'U-M3',

      name:
        'м³',

      active:
        true
    },


    {
      id:
        'U-T',

      name:
        'т',

      active:
        true
    },


    {
      id:
        'U-PC',

      name:
        'шт.',

      active:
        true
    },


    {
      id:
        'U-SET',

      name:
        'компл.',

      active:
        true
    }

  ];



  const buildings = [

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

    'Аэрарий'

  ]
    .map(
      (
        name,
        index
      ) => ({

        id:
          `BLD-${String(index + 1).padStart(3, '0')}`,

        name,

        active:
          true

      })
    );



  const works = [

    [
      'Кладка наружных стен',
      'U-M2',
      'Количественный'
    ],

    [
      'Штукатурка',
      'U-M2',
      'Количественный'
    ],

    [
      'Гидроизоляция',
      'U-M2',
      'Количественный'
    ],

    [
      'Кронштейны НВФ',
      'U-PC',
      'Комбинированный'
    ],

    [
      'Передача фронта',
      'U-PC',
      'Статусный'
    ]

  ]
    .map(
      (
        row,
        index
      ) => ({

        id:
          `WRK-${String(index + 1).padStart(3, '0')}`,

        name:
          row[0],

        unitId:
          row[1],

        controlType:
          row[2],

        active:
          true,

        section:
          ''

      })
    );



  const view = {

    id:
      'VIEW-DEFAULT',

    name:
      'Основная шахматка',

    type:
      'matrix',

    rows: [

      'building',

      'block',

      'floor',

      'side'

    ],

    workIds:
      works
        .map(
          work =>
            work.id
        ),

    visibleFields: [

      'status',

      'acceptance',

      'percent',

      'planEnd',

      'factEnd',

      'forecastEnd'

    ],

    cellMode:
      'production',

    filters:
      {},

    isDefault:
      true,

    updatedAt:
      nowIso()

  };



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

      defaultViewId:
        view.id

    },


    buildings,


    organizations:
      [],


    units,


    works,


    contracts:
      [],


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


    constraints:
      [],


    handovers:
      [],


    dependencies:
      [],


    calendars:
      [],


    scheduleVersions:
      [],


    statuses:
      clone(
        DEFAULT_STATUSES
      ),


    acceptanceStatuses:
      clone(
        DEFAULT_ACCEPTANCE
      ),


    equipmentTypes:
      [],


    constraintTypes: [

      'РД',

      'Материал',

      'Фронт',

      'Смежники',

      'Заказчик',

      'Технология',

      'Финансирование',

      'Другое'

    ]
      .map(
        (
          name,
          index
        ) => ({

          id:
            `CT-${index + 1}`,

          name,

          active:
            true

        })
      ),


    views: [
      view
    ],


    reportTemplates:
      [],


    history:
      []

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


      const request =
        db
          .transaction(
            STORE,
            'readonly'
          )
          .objectStore(
            STORE
          )
          .get(
            KEY
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
          KEY
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
      uid(
        'H'
      ),

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
        10000
      );

}



function normalizeProject(
  source
) {


  const base =
    emptyProject();


  const result = {

    ...base,

    ...source,


    meta: {

      ...base.meta,

      ...(
        source.meta ||
        {}
      )

    }

  };



  [

    'buildings',

    'organizations',

    'units',

    'works',

    'contracts',

    'structures',

    'fronts',

    'planLog',

    'factLog',

    'resources',

    'milestones',

    'constraints',

    'handovers',

    'dependencies',

    'calendars',

    'scheduleVersions',

    'statuses',

    'acceptanceStatuses',

    'equipmentTypes',

    'constraintTypes',

    'views',

    'reportTemplates',

    'history'

  ]
    .forEach(
      key => {

        result[key] =
          Array.isArray(
            source[key]
          )
            ? source[key]
            : base[key];

      }
    );


  if (
    result.views.length ===
    0
  ) {

    result.views =
      base.views;

  }


  if (
    !byId(
      result.views,
      result.meta.defaultViewId
    )
  ) {

    result.meta.defaultViewId =
      result.views[0].id;

  }


  result.schemaVersion =
    SCHEMA_VERSION;


  return result;

}



function activeItems(
  list
) {

  return (
    list ||
    []
  )
    .filter(
      item =>
        item.active !==
        false
    );

}



function fillSelect(
  element,
  items,
  allLabel = 'Все'
) {


  if (
    !element
  ) {
    return;
  }


  const current =
    element.value;


  element.innerHTML =
    '';


  if (
    allLabel !==
    null
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


  items
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



function hydrateFront(
  front
) {


  const structure =
    byId(
      project.structures,
      front.structureId
    ) ||
    {};


  const work =
    byId(
      project.works,
      front.workId
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
      '',


    work:
      work.name ||
      '',


    organization:
      nameById(
        project.organizations,
        front.organizationId
      ),


    contract:
      nameById(
        project.contracts,
        front.contractId
      ),


    unit:
      nameById(
        project.units,
        front.unitId ||
        work.unitId
      ),


    statusName:
      nameById(
        project.statuses,
        front.statusId
      ),


    acceptanceName:
      nameById(
        project.acceptanceStatuses,
        front.acceptanceStatusId
      )

  };

}



function frontLabel(
  front
) {


  if (
    !front
  ) {
    return '';
  }


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

    item.side,

    item.zone,

    item.work

  ]
    .filter(
      Boolean
    )
    .join(
      ' / '
    );

}



function statusColor(
  id
) {

  return byId(
    project.statuses,
    id
  )
    ?.color ||
  '#f3f4f6';

}



function acceptanceColor(
  id
) {

  return byId(
    project.acceptanceStatuses,
    id
  )
    ?.color ||
  '#f3f4f6';

}



function varianceInfo(
  front,
  base = 'plan'
) {


  const item =
    hydrateFront(
      front
    );


  const target =
    base ===
    'contract'
      ? item.contractEnd
      : item.planEnd;


  const actual =
    item.factEnd ||
    item.forecastEnd;


  if (
    !target ||
    !actual
  ) {

    return {

      days:
        null,

      label:
        '—',

      level:
        'none'

    };

  }


  const days =
    dateDiff(
      target,
      actual
    );


  let level =
    'ok';


  if (
    days > 0 &&
    days <= 3
  ) {

    level =
      'warn';

  }


  if (
    days > 3 &&
    days <= 7
  ) {

    level =
      'bad';

  }


  if (
    days > 7
  ) {

    level =
      'critical';

  }


  return {

    days,

    label:
      days > 0
        ? `+${days} дн.`
        : `${days} дн.`,

    level

  };

}



function levelColor(
  level
) {

  return ({

    ok:
      '#dcfce7',

    warn:
      '#fef3c7',

    bad:
      '#fed7aa',

    critical:
      '#fecaca',

    none:
      '#f3f4f6'

  })[level];

}



function initSelectors() {


  const buildings =
    activeItems(
      project.buildings
    );


  const works =
    activeItems(
      project.works
    );


  const organizations =
    activeItems(
      project.organizations
    );


  const contracts =
    activeItems(
      project.contracts
    );



  [

    'matrixBuilding',

    'gBuilding',

    'pfBuilding',

    'rBuilding',

    'msBuilding'

  ]
    .forEach(
      id =>
        fillSelect(
          $(id),
          buildings,
          'Все здания'
        )
    );



  [

    'gWork',

    'pfWork'

  ]
    .forEach(
      id =>
        fillSelect(
          $(id),
          works,
          'Все работы'
        )
    );



  [

    'matrixOrg',

    'rOrg',

    'msOrg'

  ]
    .forEach(
      id =>
        fillSelect(
          $(id),
          organizations,
          'Все организации'
        )
    );


  fillSelect(
    $('msContract'),
    contracts,
    'Все договоры'
  );

}



function renderDashboard() {


  const fronts =
    project.fronts
      .map(
        hydrateFront
      );


  const latePlan =
    fronts
      .filter(
        front =>
          varianceInfo(
            front,
            'plan'
          )
            .days >
          0
      )
      .length;


  const lateContract =
    fronts
      .filter(
        front =>
          varianceInfo(
            front,
            'contract'
          )
            .days >
          0
      )
      .length;


  const done =
    fronts
      .filter(
        front =>
          front.statusName ===
          'Выполнено'
      )
      .length;


  const accepted =
    fronts
      .filter(
        front =>
          front.acceptanceName ===
          'Принято'
      )
      .length;


  const risks =
    project.constraints
      .filter(
        item =>
          item.status !==
          'Снято'
      )
      .length;


  $('dTotal')
    .textContent =
      fronts.length;


  $('dDone')
    .textContent =
      done;


  $('dAccepted')
    .textContent =
      accepted;


  $('dLatePlan')
    .textContent =
      latePlan;


  $('dLateContract')
    .textContent =
      lateContract;


  $('dRisk')
    .textContent =
      risks;



  const attention =
    [];


  fronts
    .forEach(
      front => {


        if (
          front.totalQty > 0 &&
          front.doneQty >=
          front.totalQty &&
          !front.factEnd
        ) {

          attention.push(
            `${frontLabel(front)} — 100%, но нет фактического окончания`
          );

        }


        if (
          front.factStart &&
          !front.planStart
        ) {

          attention.push(
            `${frontLabel(front)} — есть факт, но нет планового начала`
          );

        }


        if (
          front.planStart &&
          front.planEnd &&
          front.planEnd <
          front.planStart
        ) {

          attention.push(
            `${frontLabel(front)} — плановое окончание раньше начала`
          );

        }

      }
    );


  project.milestones
    .forEach(
      milestone => {


        if (
          !milestone.contractId
        ) {

          attention.push(
            `КД ${milestone.number || ''} ${milestone.title || ''} — нет договора`
          );

        }

      }
    );


  $('dAttention')
    .innerHTML =
      attention
        .slice(
          0,
          20
        )
        .map(
          text =>
            `
              <div class="item">

                <span>
                  ${esc(text)}
                </span>

              </div>
            `
        )
        .join(
          ''
        ) ||
      `
        <div class="muted">
          Нет замечаний по качеству данных
        </div>
      `;


  $('dMilestones')
    .innerHTML =
      project.milestones
        .filter(
          item =>
            !item.factDate
        )
        .sort(
          (
            first,
            second
          ) =>
            (
              first.contractDate ||
              '9999'
            )
              .localeCompare(
                second.contractDate ||
                '9999'
              )
        )
        .slice(
          0,
          10
        )
        .map(
          milestone =>
            `
              <div class="item">

                <span>
                  КД ${esc(milestone.number || '')}
                  ·
                  ${esc(milestone.title || '')}
                </span>

                <strong>
                  ${esc(milestone.contractDate || '—')}
                </strong>

              </div>
            `
        )
        .join(
          ''
        ) ||
      `
        <div class="muted">
          Нет открытых ключевых дат
        </div>
      `;

}



function currentView() {


  if (
    !currentViewId
  ) {

    currentViewId =
      project.meta.defaultViewId;

  }


  return byId(
    project.views,
    currentViewId
  ) ||
  project.views[0];

}



function renderViews() {


  fillSelect(
    $('viewSelect'),
    project.views,
    null
  );


  $('viewSelect')
    .value =
      currentView().id;


  $('viewBadge')
    .textContent =
      currentView().type ===
      'matrix'
        ? 'Шахматка'
        : 'Таблица';

}



function frontMatchesView(
  front,
  view
) {


  const structure =
    front.structure ||
    {};


  const filters =
    view.filters ||
    {};


  const allows = (
    list,
    value
  ) =>
    !list?.length ||
    list
      .map(
        String
      )
      .includes(
        String(
          value
        )
      );


  if (
    !allows(
      filters.buildingIds,
      structure.buildingId
    ) ||
    !allows(
      filters.organizationIds,
      front.organizationId
    ) ||
    !allows(
      filters.statusIds,
      front.statusId
    ) ||
    !allows(
      filters.acceptanceIds,
      front.acceptanceStatusId
    )
  ) {

    return false;

  }


  if (
    view.workIds?.length &&
    !view.workIds
      .includes(
        front.workId
      )
  ) {

    return false;

  }


  const quickBuilding =
    $('matrixBuilding')
      ?.value ||
    'all';


  const quickOrg =
    $('matrixOrg')
      ?.value ||
    'all';


  if (
    quickBuilding !==
    'all' &&
    structure.buildingId !==
    quickBuilding
  ) {

    return false;

  }


  if (
    quickOrg !==
    'all' &&
    front.organizationId !==
    quickOrg
  ) {

    return false;

  }


  return true;

}



function dimensionValue(
  front,
  key
) {

  return ({

    building:
      front.building,

    block:
      front.block,

    floor:
      front.floor,

    capture:
      front.capture,

    axis:
      front.axis,

    side:
      front.side,

    zone:
      front.zone,

    roomNo:
      front.roomNo,

    roomName:
      front.roomName,

    organization:
      front.organization

  })[key] ??
  '';

}



function cellValue(
  front,
  mode
) {


  if (
    !front
  ) {

    return {

      main:
        '—',

      sub:
        '',

      bg:
        '#f9fafb'

    };

  }


  if (
    mode ===
    'acceptance'
  ) {

    return {

      main:
        front.acceptanceName ||
        'Не предъявлено',

      sub:
        '',

      bg:
        acceptanceColor(
          front.acceptanceStatusId
        )

    };

  }


  if (
    mode ===
    'percent'
  ) {


    const percent =
      front.totalQty
        ? Math.round(
            num(
              front.doneQty
            ) /
            num(
              front.totalQty
            ) *
            100
          )
        : 0;


    return {

      main:
        `${percent}%`,

      sub:
        `${fmt(front.doneQty)} / ${fmt(front.totalQty)} ${front.unit || ''}`,

      bg:
        statusColor(
          front.statusId
        )

    };

  }


  if (
    mode ===
    'qty'
  ) {

    return {

      main:
        `${fmt(front.doneQty)} / ${fmt(front.totalQty)}`,

      sub:
        front.unit ||
        '',

      bg:
        statusColor(
          front.statusId
        )

    };

  }


  if (
    mode ===
    'variancePlan'
  ) {


    const variance =
      varianceInfo(
        front,
        'plan'
      );


    return {

      main:
        variance.label,

      sub:
        'к плану',

      bg:
        levelColor(
          variance.level
        )

    };

  }


  if (
    mode ===
    'varianceContract'
  ) {


    const variance =
      varianceInfo(
        front,
        'contract'
      );


    return {

      main:
        variance.label,

      sub:
        'к договору',

      bg:
        levelColor(
          variance.level
        )

    };

  }


  if (
    mode ===
    'endDate'
  ) {

    return {

      main:
        front.factEnd ||
        front.forecastEnd ||
        front.planEnd ||
        front.contractEnd ||
        '—',

      sub:
        front.statusName ||
        '',

      bg:
        statusColor(
          front.statusId
        )

    };

  }


  return {

    main:
      front.statusName ||
      'Не начато',

    sub:
      front.acceptanceName ||
      '',

    bg:
      statusColor(
        front.statusId
      )

  };

}



function renderMatrix() {


  const view =
    currentView();


  const fronts =
    project.fronts
      .map(
        hydrateFront
      )
      .filter(
        front =>
          frontMatchesView(
            front,
            view
          )
      );


  $('matrixInfo')
    .textContent =
      `${view.name} · фронтов ${fronts.length} · цвет: ${CELL_MODES[view.cellMode] || view.cellMode}`;


  if (
    view.type ===
    'table'
  ) {

    renderMatrixTable(
      fronts,
      view
    );

    return;

  }


  const works =
    (
      view.workIds?.length
        ? view.workIds
            .map(
              id =>
                byId(
                  project.works,
                  id
                )
            )
            .filter(
              Boolean
            )
        : activeItems(
            project.works
          )
    );


  const groups =
    new Map();


  fronts
    .forEach(
      front => {


        const key =
          (
            view.rows ||
            []
          )
            .map(
              field =>
                String(
                  dimensionValue(
                    front,
                    field
                  )
                )
            )
            .join(
              '|||'
            );


        if (
          !groups.has(
            key
          )
        ) {

          groups.set(
            key,
            {

              sample:
                front,

              fronts:
                []

            }
          );

        }


        groups
          .get(
            key
          )
          .fronts
          .push(
            front
          );

      }
    );


  const rowHeaders =
    (
      view.rows ||
      []
    )
      .map(
        key =>
          `
            <th>
              ${esc(DIMENSIONS[key] || key)}
            </th>
          `
      )
      .join(
        ''
      );


  const workHeaders =
    works
      .map(
        work =>
          `
            <th>
              ${esc(work.name)}
            </th>
          `
      )
      .join(
        ''
      );


  const body =
    [
      ...groups.values()
    ]
      .map(
        group => {


          const left =
            (
              view.rows ||
              []
            )
              .map(
                field =>
                  `
                    <td class="matrix-label">
                      ${esc(dimensionValue(group.sample,field))}
                    </td>
                  `
              )
              .join(
                ''
              );


          const right =
            works
              .map(
                work => {


                  const front =
                    group.fronts
                      .find(
                        item =>
                          item.workId ===
                          work.id
                      );


                  const cell =
                    cellValue(
                      front,
                      view.cellMode
                    );


                  return `
                    <td
                      ${
                        front
                          ? `data-front-id="${front.id}"`
                          : ''
                      }
                      class="matrix-cell"
                      style="background:${cell.bg}"
                    >

                      <b>
                        ${esc(cell.main)}
                      </b>

                      ${
                        cell.sub
                          ? `
                            <small>
                              ${esc(cell.sub)}
                            </small>
                          `
                          : ''
                      }

                    </td>
                  `;

                }
              )
              .join(
                ''
              );


          return `
            <tr>
              ${left}
              ${right}
            </tr>
          `;

        }
      )
      .join(
        ''
      );


  $('matrixContainer')
    .innerHTML =
      body
        ? `
          <table class="matrix-table">

            <thead>

              <tr>
                ${rowHeaders}
                ${workHeaders}
              </tr>

            </thead>

            <tbody>
              ${body}
            </tbody>

          </table>
        `
        : `
          <div class="empty-state">
            Нет данных по выбранному представлению
          </div>
        `;


  bindFrontOpeners();

}



function renderMatrixTable(
  fronts,
  view
) {


  const fields =
    view.visibleFields?.length
      ? view.visibleFields
      : [

          'status',

          'acceptance',

          'planEnd',

          'factEnd',

          'forecastEnd'

        ];


  const heads =
    (
      view.rows ||
      []
    )
      .map(
        key =>
          `
            <th>
              ${esc(DIMENSIONS[key] || key)}
            </th>
          `
      )
      .join(
        ''
      ) +

    fields
      .map(
        field =>
          `
            <th>
              ${esc(FIELD_LABELS[field] || field)}
            </th>
          `
      )
      .join(
        ''
      );


  const rows =
    fronts
      .map(
        front => {


          const dimensions =
            (
              view.rows ||
              []
            )
              .map(
                key =>
                  `
                    <td>
                      ${esc(dimensionValue(front,key))}
                    </td>
                  `
              )
              .join(
                ''
              );


          const cells =
            fields
              .map(
                field =>
                  `
                    <td>
                      ${esc(fieldDisplay(front,field))}
                    </td>
                  `
              )
              .join(
                ''
              );


          return `
            <tr data-front-id="${front.id}">
              ${dimensions}
              ${cells}
            </tr>
          `;

        }
      )
      .join(
        ''
      );


  $('matrixContainer')
    .innerHTML =
      `
        <table>

          <thead>

            <tr>
              ${heads}
            </tr>

          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>
      `;


  bindFrontOpeners();

}



function fieldDisplay(
  front,
  key
) {


  const values = {


    work:
      front.work,


    organization:
      front.organization,


    contract:
      front.contract,


    status:
      front.statusName,


    acceptance:
      front.acceptanceName,


    unit:
      front.unit,


    totalQty:
      fmt(
        front.totalQty
      ),


    doneQty:
      fmt(
        front.doneQty
      ),


    percent:
      front.totalQty
        ? `${Math.round(num(front.doneQty) / num(front.totalQty) * 100)}%`
        : '0%',


    contractStart:
      front.contractStart,


    contractEnd:
      front.contractEnd,


    baselineStart:
      front.baselineStart,


    baselineEnd:
      front.baselineEnd,


    planStart:
      front.planStart,


    planEnd:
      front.planEnd,


    factStart:
      front.factStart,


    factEnd:
      front.factEnd,


    forecastStart:
      front.forecastStart,


    forecastEnd:
      front.forecastEnd,


    variancePlan:
      varianceInfo(
        front,
        'plan'
      )
        .label,


    varianceContract:
      varianceInfo(
        front,
        'contract'
      )
        .label,


    responsible:
      front.responsible,


    constraint:
      front.constraint,


    comment:
      front.comment


  };


  return values[key] ??
  '';

}



function bindFrontOpeners() {


  document
    .querySelectorAll(
      '[data-front-id]'
    )
    .forEach(
      element =>
        element.onclick =
          () =>
            openFrontEditor(
              element.dataset.frontId
            )
    );

}



function openViewEditor(
  view = null
) {


  const isNew =
    !view;


  const current =
    clone(
      view ||
      {

        id:
          uid(
            'VIEW'
          ),

        name:
          'Новая шахматка',

        type:
          'matrix',

        rows: [

          'building',

          'block',

          'floor'

        ],

        workIds:
          activeItems(
            project.works
          )
            .map(
              item =>
                item.id
            ),

        visibleFields: [

          'status',

          'acceptance',

          'planEnd',

          'factEnd',

          'forecastEnd'

        ],

        cellMode:
          'production',

        filters:
          {},

        isDefault:
          false

      }
    );



  const dimensions =
    Object.entries(
      DIMENSIONS
    )
      .map(
        (
          [
            key,
            label
          ]
        ) =>
          `
            <label class="check">

              <input
                type="checkbox"
                data-vrow="${key}"
                ${
                  current.rows
                    .includes(
                      key
                    )
                    ? 'checked'
                    : ''
                }
              >

              ${esc(label)}

            </label>
          `
      )
      .join(
        ''
      );



  const works =
    activeItems(
      project.works
    )
      .map(
        work =>
          `
            <label class="check">

              <input
                type="checkbox"
                data-vwork="${work.id}"
                ${
                  current.workIds
                    .includes(
                      work.id
                    )
                    ? 'checked'
                    : ''
                }
              >

              ${esc(work.name)}

            </label>
          `
      )
      .join(
        ''
      );



  const fields =
    Object.entries(
      FIELD_LABELS
    )
      .map(
        (
          [
            key,
            label
          ]
        ) =>
          `
            <label class="check">

              <input
                type="checkbox"
                data-vfield="${key}"
                ${
                  current.visibleFields
                    .includes(
                      key
                    )
                    ? 'checked'
                    : ''
                }
              >

              ${esc(label)}

            </label>
          `
      )
      .join(
        ''
      );



  const modes =
    Object.entries(
      CELL_MODES
    )
      .map(
        (
          [
            key,
            label
          ]
        ) =>
          `
            <option
              value="${key}"
              ${
                current.cellMode ===
                key
                  ? 'selected'
                  : ''
              }
            >
              ${esc(label)}
            </option>
          `
      )
      .join(
        ''
      );



  openModal(
    isNew
      ? 'Новая шахматка'
      : 'Настройка представления',

    `

      <div class="form-grid">


        <div class="field">

          <label>
            Название
          </label>

          <input
            id="vName"
            value="${esc(current.name)}"
          >

        </div>


        <div class="field">

          <label>
            Тип
          </label>

          <select id="vType">

            <option
              value="matrix"
              ${
                current.type ===
                'matrix'
                  ? 'selected'
                  : ''
              }
            >
              Шахматка
            </option>

            <option
              value="table"
              ${
                current.type ===
                'table'
                  ? 'selected'
                  : ''
              }
            >
              Таблица
            </option>

          </select>

        </div>


        <div class="field">

          <label>
            Цвет / содержимое ячейки
          </label>

          <select id="vCellMode">
            ${modes}
          </select>

        </div>


      </div>


      <div class="grid3">


        <div class="config-box">

          <h3>
            Строки
          </h3>

          <div class="check-list">
            ${dimensions}
          </div>

        </div>


        <div class="config-box">

          <h3>
            Работы-колонки
          </h3>

          <div class="check-list">
            ${works}
          </div>

        </div>


        <div class="config-box">

          <h3>
            Поля таблицы
          </h3>

          <div class="check-list">
            ${fields}
          </div>

        </div>


      </div>


      <div class="editor-actions">

        <button
          id="vSave"
          class="btn primary"
        >
          Сохранить
        </button>

      </div>

    `
  );



  $('vSave')
    .onclick =
      async () => {


        current.name =
          $('vName')
            .value
            .trim() ||
          'Без названия';


        current.type =
          $('vType')
            .value;


        current.cellMode =
          $('vCellMode')
            .value;


        current.rows =
          [
            ...document
              .querySelectorAll(
                '[data-vrow]:checked'
              )
          ]
            .map(
              element =>
                element.dataset.vrow
            );


        current.workIds =
          [
            ...document
              .querySelectorAll(
                '[data-vwork]:checked'
              )
          ]
            .map(
              element =>
                element.dataset.vwork
            );


        current.visibleFields =
          [
            ...document
              .querySelectorAll(
                '[data-vfield]:checked'
              )
          ]
            .map(
              element =>
                element.dataset.vfield
            );


        current.updatedAt =
          nowIso();


        if (
          !current.rows.length
        ) {

          alert(
            'Выберите хотя бы одно поле строк'
          );

          return;

        }


        if (
          isNew
        ) {

          project.views
            .push(
              current
            );

        } else {


          const index =
            project.views
              .findIndex(
                item =>
                  item.id ===
                  current.id
              );


          project.views[index] =
            current;

        }


        currentViewId =
          current.id;


        log(
          isNew
            ? 'Создано'
            : 'Изменено',

          'Представление',

          current.name
        );


        await saveProject();


        closeModal();


        renderAll();

      };

}



async function duplicateView() {


  const source =
    clone(
      currentView()
    );


  source.id =
    uid(
      'VIEW'
    );


  source.name +=
    ' — копия';


  source.isDefault =
    false;


  project.views
    .push(
      source
    );


  currentViewId =
    source.id;


  await saveProject();


  renderAll();

}



async function deleteView() {


  if (
    project.views.length <=
    1
  ) {

    alert(
      'Нельзя удалить единственное представление'
    );

    return;

  }


  const view =
    currentView();


  if (
    !confirm(
      `Удалить «${view.name}»?`
    )
  ) {

    return;

  }


  project.views =
    project.views
      .filter(
        item =>
          item.id !==
          view.id
      );


  if (
    project.meta.defaultViewId ===
    view.id
  ) {

    project.meta.defaultViewId =
      project.views[0].id;

  }


  currentViewId =
    project.meta.defaultViewId;


  await saveProject();


  renderAll();

}



async function setDefaultView() {


  project.meta.defaultViewId =
    currentView().id;


  project.views
    .forEach(
      view =>
        view.isDefault =
          view.id ===
          project.meta.defaultViewId
    );


  await saveProject();


  renderAll();

}



function cap(
  value
) {

  return value
    .charAt(
      0
    )
    .toUpperCase() +
  value
    .slice(
      1
    );

}



function datePair(
  label,
  prefix,
  front
) {

  return `
    <div class="date-pair">

      <b>
        ${label}
      </b>

      <label>

        Начало

        <input
          id="f${cap(prefix)}Start"
          type="date"
          value="${front[`${prefix}Start`] || ''}"
        >

      </label>

      <label>

        Окончание

        <input
          id="f${cap(prefix)}End"
          type="date"
          value="${front[`${prefix}End`] || ''}"
        >

      </label>

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
      : {

          statusId:
            project.statuses[0]
              ?.id ||
            '',

          acceptanceStatusId:
            project.acceptanceStatuses[0]
              ?.id ||
            ''

        };


  const structure =
    front.structureId
      ? byId(
          project.structures,
          front.structureId
        ) ||
        {}
      : {};


  const options = (
    list,
    selected,
    blank = '—'
  ) => {


    let html =
      '';


    if (
      blank !==
      null
    ) {

      html +=
        `
          <option value="">
            ${blank}
          </option>
        `;

    }


    html +=
      activeItems(
        list
      )
        .map(
          item =>
            `
              <option
                value="${item.id}"
                ${
                  String(item.id) ===
                  String(selected)
                    ? 'selected'
                    : ''
                }
              >
                ${esc(item.name)}
              </option>
            `
        )
        .join(
          ''
        );


    return html;

  };


  const statusOptions =
    project.statuses
      .map(
        status =>
          `
            <option
              value="${status.id}"
              ${
                status.id ===
                front.statusId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(status.name)}
            </option>
          `
      )
      .join(
        ''
      );


  const acceptanceOptions =
    project.acceptanceStatuses
      .map(
        status =>
          `
            <option
              value="${status.id}"
              ${
                status.id ===
                front.acceptanceStatusId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(status.name)}
            </option>
          `
      )
      .join(
        ''
      );



  openModal(
    id
      ? 'Карточка фронта'
      : 'Новый фронт',

    `

      <div class="section-title">
        Структура
      </div>


      <div class="form-grid">


        <div class="field">

          <label>
            Здание
          </label>

          <select id="fBuilding">
            ${options(project.buildings,structure.buildingId,null)}
          </select>

        </div>


        <div class="field">

          <label>
            Блок
          </label>

          <input
            id="fBlock"
            value="${esc(structure.block || '')}"
          >

        </div>


        <div class="field">

          <label>
            Этаж
          </label>

          <input
            id="fFloor"
            value="${esc(structure.floor ?? '')}"
          >

        </div>


        <div class="field">

          <label>
            Захватка
          </label>

          <input
            id="fCapture"
            value="${esc(structure.capture || '')}"
          >

        </div>


        <div class="field">

          <label>
            Ось
          </label>

          <input
            id="fAxis"
            value="${esc(structure.axis || '')}"
          >

        </div>


        <div class="field">

          <label>
            Сторона
          </label>

          <input
            id="fSide"
            value="${esc(structure.side || '')}"
          >

        </div>


        <div class="field">

          <label>
            Зона
          </label>

          <input
            id="fZone"
            value="${esc(structure.zone || '')}"
          >

        </div>


        <div class="field">

          <label>
            № помещения
          </label>

          <input
            id="fRoomNo"
            value="${esc(structure.roomNo || '')}"
          >

        </div>


        <div class="field">

          <label>
            Помещение
          </label>

          <input
            id="fRoomName"
            value="${esc(structure.roomName || '')}"
          >

        </div>


      </div>



      <div class="section-title">
        Работа
      </div>


      <div class="form-grid">


        <div class="field">

          <label>
            Вид работы
          </label>

          <select id="fWork">
            ${options(project.works,front.workId,null)}
          </select>

        </div>


        <div class="field">

          <label>
            Организация
          </label>

          <select id="fOrg">
            ${options(project.organizations,front.organizationId)}
          </select>

        </div>


        <div class="field">

          <label>
            Договор
          </label>

          <select id="fContract">
            ${options(project.contracts,front.contractId)}
          </select>

        </div>


        <div class="field">

          <label>
            Ответственный
          </label>

          <input
            id="fResp"
            value="${esc(front.responsible || '')}"
          >

        </div>


        <div class="field">

          <label>
            Статус работ
          </label>

          <select id="fStatus">
            ${statusOptions}
          </select>

        </div>


        <div class="field">

          <label>
            Статус сдачи
          </label>

          <select id="fAcceptance">
            ${acceptanceOptions}
          </select>

        </div>


        <div class="field">

          <label>
            Единица
          </label>

          <select id="fUnit">
            ${options(project.units,front.unitId)}
          </select>

        </div>


        <div class="field">

          <label>
            Общий объём
          </label>

          <input
            id="fTotal"
            type="number"
            step="any"
            value="${front.totalQty ?? ''}"
          >

        </div>


        <div class="field">

          <label>
            Выполнено
          </label>

          <input
            id="fDone"
            type="number"
            step="any"
            value="${front.doneQty ?? ''}"
          >

        </div>


      </div>



      <div class="section-title">
        Сроки
      </div>


      <div class="date-grid">

        ${datePair('Договор','contract',front)}

        ${datePair('База','baseline',front)}

        ${datePair('План','plan',front)}

        ${datePair('Факт','fact',front)}

        ${datePair('Прогноз','forecast',front)}

      </div>



      <div class="form-grid">


        <div class="field span-2">

          <label>
            Ограничение / примечание
          </label>

          <textarea id="fConstraint">${esc(front.constraint || '')}</textarea>

        </div>


        <div class="field span-2">

          <label>
            Комментарий
          </label>

          <textarea id="fComment">${esc(front.comment || '')}</textarea>

        </div>


      </div>



      <div class="editor-actions">


        ${
          id
            ? `
              <button
                id="fDelete"
                class="btn danger"
              >
                Удалить
              </button>
            `
            : ''
        }


        <button
          id="fSave"
          class="btn primary"
        >
          Сохранить
        </button>


      </div>

    `
  );


  $('fSave')
    .onclick =
      () =>
        saveFront(
          id
        );


  if (
    id
  ) {

    $('fDelete')
      .onclick =
        () =>
          deleteFront(
            id
          );

  }

}



async function saveFront(
  id
) {


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

          createdAt:
            nowIso()

        };


  let structure =
    id
      ? byId(
          project.structures,
          front.structureId
        )
      : null;


  if (
    !structure
  ) {

    structure = {

      id:
        uid(
          'STR'
        )

    };


    project.structures
      .push(
        structure
      );


    front.structureId =
      structure.id;

  }


  Object.assign(
    structure,
    {

      buildingId:
        $('fBuilding')
          .value,


      block:
        $('fBlock')
          .value
          .trim(),


      floor:
        $('fFloor')
          .value ===
          ''
          ? ''
          : num(
              $('fFloor')
                .value
            ),


      capture:
        $('fCapture')
          .value
          .trim(),


      axis:
        $('fAxis')
          .value
          .trim(),


      side:
        $('fSide')
          .value
          .trim(),


      zone:
        $('fZone')
          .value
          .trim(),


      roomNo:
        $('fRoomNo')
          .value
          .trim(),


      roomName:
        $('fRoomName')
          .value
          .trim()

    }
  );


  Object.assign(
    front,
    {

      workId:
        $('fWork')
          .value,


      organizationId:
        $('fOrg')
          .value,


      contractId:
        $('fContract')
          .value,


      responsible:
        $('fResp')
          .value
          .trim(),


      statusId:
        $('fStatus')
          .value,


      acceptanceStatusId:
        $('fAcceptance')
          .value,


      unitId:
        $('fUnit')
          .value,


      totalQty:
        num(
          $('fTotal')
            .value
        ),


      doneQty:
        num(
          $('fDone')
            .value
        ),


      constraint:
        $('fConstraint')
          .value
          .trim(),


      comment:
        $('fComment')
          .value
          .trim(),


      updatedAt:
        nowIso()

    }
  );


  [

    'contract',

    'baseline',

    'plan',

    'fact',

    'forecast'

  ]
    .forEach(
      prefix => {


        front[`${prefix}Start`] =
          $(
            `f${cap(prefix)}Start`
          )
            .value;


        front[`${prefix}End`] =
          $(
            `f${cap(prefix)}End`
          )
            .value;

      }
    );


  if (
    !id
  ) {

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
      'Удалить фронт и связанные план/факт записи?'
    )
  ) {

    return;

  }


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


  project.constraints =
    project.constraints
      .filter(
        item =>
          item.frontId !==
          id
      );


  await saveProject();


  closeModal();


  renderAll();

}



function ganttDates(
  front,
  layer
) {

  return [

    front[`${layer}Start`],

    front[`${layer}End`]

  ];

}



function renderGantt() {


  const layers =
    [
      ...document
        .querySelectorAll(
          '[data-g-layer]:checked'
        )
    ]
      .map(
        element =>
          element.dataset.gLayer
      );


  const buildingId =
    $('gBuilding')
      .value;


  const workId =
    $('gWork')
      .value;


  const fronts =
    project.fronts
      .map(
        hydrateFront
      )
      .filter(
        front =>
          (
            buildingId ===
            'all' ||
            front.structure.buildingId ===
            buildingId
          ) &&
          (
            workId ===
            'all' ||
            front.workId ===
            workId
          )
      );


  const dated =
    [];


  fronts
    .forEach(
      front => {


        layers
          .forEach(
            layer => {


              const [
                start,
                end
              ] =
                ganttDates(
                  front,
                  layer
                );


              if (
                start &&
                end
              ) {

                dated.push({

                  front,

                  layer,

                  start,

                  end

                });

              }

            }
          );

      }
    );


  if (
    !dated.length
  ) {

    $('gantt')
      .innerHTML =
        `
          <div class="empty-state">
            Нет дат для выбранных слоёв
          </div>
        `;

    return;

  }


  const minimum =
    dated
      .map(
        item =>
          item.start
      )
      .sort()[0];


  const maximum =
    dated
      .map(
        item =>
          item.end
      )
      .sort()
      .slice(
        -1
      )[0];


  const span =
    Math.max(
      1,
      dateDiff(
        minimum,
        maximum
      ) +
      1
    );


  const grouped =
    new Map();


  dated
    .forEach(
      item => {


        if (
          !grouped.has(
            item.front.id
          )
        ) {

          grouped.set(
            item.front.id,
            []
          );

        }


        grouped
          .get(
            item.front.id
          )
          .push(
            item
          );

      }
    );


  $('gantt')
    .innerHTML =
      [
        ...grouped.values()
      ]
        .map(
          items => {


            const front =
              items[0].front;


            const bars =
              items
                .map(
                  item => {


                    const left =
                      dateDiff(
                        minimum,
                        item.start
                      ) /
                      span *
                      100;


                    const width =
                      Math.max(
                        1,
                        (
                          dateDiff(
                            item.start,
                            item.end
                          ) +
                          1
                        ) /
                        span *
                        100
                      );


                    const label =
                      GANTT_LAYERS
                        .find(
                          row =>
                            row[0] ===
                            item.layer
                        )
                        ?.[1] ||
                      item.layer;


                    return `
                      <div
                        class="gantt-bar layer-${item.layer}"
                        style="
                          left:${left}%;
                          width:${width}%;
                        "
                        title="${esc(label)}: ${item.start} — ${item.end}"
                      ></div>
                    `;

                  }
                )
                .join(
                  ''
                );


            return `
              <div class="gantt-row">

                <div class="gantt-name">

                  <b>
                    ${esc(front.work)}
                  </b>

                  <small>
                    ${esc(frontLabel(front))}
                  </small>

                </div>

                <div class="gantt-line">
                  ${bars}
                </div>

              </div>
            `;

          }
        )
        .join(
          ''
        );

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


  const inPeriod =
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
      );


  const plan =
    project.planLog
      .filter(
        inPeriod
      );


  const fact =
    project.factLog
      .filter(
        inPeriod
      );


  const planTotal =
    plan
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


  const factTotal =
    fact
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


  $('pfPlan')
    .textContent =
      fmt(
        planTotal
      );


  $('pfFact')
    .textContent =
      fmt(
        factTotal
      );


  $('pfVar')
    .textContent =
      fmt(
        factTotal -
        planTotal
      );


  $('planRows')
    .innerHTML =
      plan
        .map(
          row =>
            `
              <tr>

                <td>
                  ${row.date}
                </td>

                <td>
                  ${esc(frontLabel(byId(project.fronts,row.frontId)))}
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


  $('factRows')
    .innerHTML =
      fact
        .map(
          row =>
            `
              <tr>

                <td>
                  ${row.date}
                </td>

                <td>
                  ${esc(frontLabel(byId(project.fronts,row.frontId)))}
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

}



function openLogEditor(
  type
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
      .join(
        ''
      );


  openModal(
    type ===
    'plan'
      ? 'Добавить план'
      : 'Добавить факт',

    `

      <div class="form-grid">


        <div class="field span-2">

          <label>
            Фронт
          </label>

          <select id="lFront">
            ${options}
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
            Объём
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
          >

        </div>


        <div class="field span-2">

          <label>
            Комментарий
          </label>

          <textarea id="lComment"></textarea>

        </div>


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


  $('lSave')
    .onclick =
      () =>
        saveLog(
          type
        );

}



async function saveLog(
  type
) {


  const row = {

    id:
      uid(
        type ===
        'plan'
          ? 'P'
          : 'FCT'
      ),

    frontId:
      $('lFront')
        .value,

    date:
      $('lDate')
        .value,

    qty:
      num(
        $('lQty')
          .value
      ),

    people:
      num(
        $('lPeople')
          .value
      ),

    comment:
      $('lComment')
        .value
        .trim(),

    createdAt:
      nowIso()

  };


  if (
    type ===
    'plan'
  ) {

    project.planLog
      .push(
        row
      );

  } else {


    project.factLog
      .push(
        row
      );


    const front =
      byId(
        project.fronts,
        row.frontId
      );


    if (
      front
    ) {


      front.doneQty =
        project.factLog
          .filter(
            item =>
              item.frontId ===
              front.id
          )
          .reduce(
            (
              sum,
              item
            ) =>
              sum +
              num(
                item.qty
              ),
            0
          );


      if (
        !front.factStart
      ) {

        front.factStart =
          row.date;

      }

    }

  }


  log(
    'Добавлено',

    type ===
    'plan'
      ? 'План'
      : 'Факт',

    `${row.date} · ${frontLabel(byId(project.fronts,row.frontId))}`
  );


  await saveProject();


  closeModal();


  renderAll();

}



function renderResources() {


  const buildingId =
    $('rBuilding')
      .value;


  const organizationId =
    $('rOrg')
      .value;


  const from =
    $('rFrom')
      .value;


  const to =
    $('rTo')
      .value;


  const rows =
    project.resources
      .filter(
        row =>
          (
            buildingId ===
              'all' ||
            row.buildingId ===
              buildingId
          ) &&
          (
            organizationId ===
              'all' ||
            row.organizationId ===
              organizationId
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


  $('resourceRows')
    .innerHTML =
      rows
        .map(
          row =>
            `
              <tr>

                <td>
                  ${row.date}
                </td>

                <td>
                  ${esc(nameById(project.organizations,row.organizationId))}
                </td>

                <td>
                  ${esc(nameById(project.buildings,row.buildingId))}
                </td>

                <td>
                  ${row.itr}
                </td>

                <td>
                  ${row.workers}
                </td>

                <td>
                  ${row.mechanizers}
                </td>

                <td>
                  ${esc(row.equipmentType || '')}
                </td>

                <td>
                  ${row.equipmentQty || 0}
                </td>

                <td>
                  ${esc(row.comment || '')}
                </td>

              </tr>
            `
        )
        .join(
          ''
        );

}



function openResourceEditor() {


  const organizations =
    activeItems(
      project.organizations
    )
      .map(
        item =>
          `
            <option value="${item.id}">
              ${esc(item.name)}
            </option>
          `
      )
      .join(
        ''
      );


  const buildings =
    activeItems(
      project.buildings
    )
      .map(
        item =>
          `
            <option value="${item.id}">
              ${esc(item.name)}
            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    'Ресурсы',

    `

      <div class="form-grid">


        <div class="field">

          <label>
            Дата
          </label>

          <input
            id="rrDate"
            type="date"
            value="${today()}"
          >

        </div>


        <div class="field">

          <label>
            Организация
          </label>

          <select id="rrOrg">
            ${organizations}
          </select>

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select id="rrBuilding">
            ${buildings}
          </select>

        </div>


        <div class="field">

          <label>
            ИТР
          </label>

          <input
            id="rrItr"
            type="number"
          >

        </div>


        <div class="field">

          <label>
            Рабочие
          </label>

          <input
            id="rrWorkers"
            type="number"
          >

        </div>


        <div class="field">

          <label>
            Механизаторы
          </label>

          <input
            id="rrMech"
            type="number"
          >

        </div>


        <div class="field">

          <label>
            Техника
          </label>

          <input id="rrEq">

        </div>


        <div class="field">

          <label>
            Количество
          </label>

          <input
            id="rrEqQty"
            type="number"
          >

        </div>


        <div class="field span-2">

          <label>
            Комментарий
          </label>

          <textarea id="rrComment"></textarea>

        </div>


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


  $('rrSave')
    .onclick =
      saveResource;

}



async function saveResource() {


  project.resources
    .push({

      id:
        uid(
          'R'
        ),

      date:
        $('rrDate')
          .value,

      organizationId:
        $('rrOrg')
          .value,

      buildingId:
        $('rrBuilding')
          .value,

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
        $('rrEq')
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
          .trim()

    });


  await saveProject();


  closeModal();


  renderAll();

}



function renderContracts() {


  $('contractRows')
    .innerHTML =
      project.contracts
        .map(
          contract =>
            `
              <tr data-contract-id="${contract.id}">

                <td>
                  ${esc(nameById(project.organizations,contract.organizationId))}
                </td>

                <td>
                  ${esc(contract.number)}
                </td>

                <td>
                  ${esc(contract.date)}
                </td>

                <td>
                  ${esc(contract.subject || '')}
                </td>

                <td>
                  ${esc(nameById(project.buildings,contract.buildingId))}
                </td>

                <td>
                  ${esc(contract.startDate || '')}
                </td>

                <td>
                  ${esc(contract.endDate || '')}
                </td>

              </tr>
            `
        )
        .join(
          ''
        );


  document
    .querySelectorAll(
      '[data-contract-id]'
    )
    .forEach(
      element =>
        element.onclick =
          () =>
            openContractEditor(
              element.dataset.contractId
            )
    );

}



function openContractEditor(
  id = null
) {


  const contract =
    id
      ? byId(
          project.contracts,
          id
        )
      : {};


  const organizations =
    activeItems(
      project.organizations
    )
      .map(
        item =>
          `
            <option
              value="${item.id}"
              ${
                item.id ===
                contract.organizationId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(item.name)}
            </option>
          `
      )
      .join(
        ''
      );


  const buildings =
    activeItems(
      project.buildings
    )
      .map(
        item =>
          `
            <option
              value="${item.id}"
              ${
                item.id ===
                contract.buildingId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(item.name)}
            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    id
      ? 'Договор'
      : 'Новый договор',

    `

      <div class="form-grid">


        <div class="field">

          <label>
            Подрядчик
          </label>

          <select id="cOrg">

            <option value="">
              —
            </option>

            ${organizations}

          </select>

        </div>


        <div class="field">

          <label>
            № договора
          </label>

          <input
            id="cNumber"
            value="${esc(contract.number || '')}"
          >

        </div>


        <div class="field">

          <label>
            Дата договора
          </label>

          <input
            id="cDate"
            type="date"
            value="${contract.date || ''}"
          >

        </div>


        <div class="field span-2">

          <label>
            Предмет
          </label>

          <input
            id="cSubject"
            value="${esc(contract.subject || '')}"
          >

        </div>


        <div class="field">

          <label>
            Объект
          </label>

          <select id="cBld">

            <option value="">
              —
            </option>

            ${buildings}

          </select>

        </div>


        <div class="field">

          <label>
            Начало
          </label>

          <input
            id="cStart"
            type="date"
            value="${contract.startDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Окончание
          </label>

          <input
            id="cEnd"
            type="date"
            value="${contract.endDate || ''}"
          >

        </div>


        <div class="field span-2">

          <label>
            Комментарий
          </label>

          <textarea id="cComment">${esc(contract.comment || '')}</textarea>

        </div>


      </div>


      <div class="editor-actions">


        ${
          id
            ? `
              <button
                id="cDelete"
                class="btn danger"
              >
                Удалить
              </button>
            `
            : ''
        }


        <button
          id="cSave"
          class="btn primary"
        >
          Сохранить
        </button>


      </div>

    `
  );


  $('cSave')
    .onclick =
      () =>
        saveContract(
          id
        );


  if (
    id
  ) {

    $('cDelete')
      .onclick =
        () =>
          deleteEntity(
            'contracts',
            id,
            'Договор'
          );

  }

}



async function saveContract(
  id
) {


  let contract =
    id
      ? byId(
          project.contracts,
          id
        )
      : {

          id:
            uid(
              'CON'
            ),

          active:
            true

        };


  Object.assign(
    contract,
    {

      organizationId:
        $('cOrg')
          .value,

      number:
        $('cNumber')
          .value
          .trim(),

      date:
        $('cDate')
          .value,

      subject:
        $('cSubject')
          .value
          .trim(),

      buildingId:
        $('cBld')
          .value,

      startDate:
        $('cStart')
          .value,

      endDate:
        $('cEnd')
          .value,

      comment:
        $('cComment')
          .value
          .trim()

    }
  );


  if (
    !id
  ) {

    project.contracts
      .push(
        contract
      );

  }


  await saveProject();


  closeModal();


  renderAll();

}



function renderMilestones() {


  const filterBuilding =
    $('msBuilding')
      ?.value ||
    'all';


  const filterOrganization =
    $('msOrg')
      ?.value ||
    'all';


  const filterContract =
    $('msContract')
      ?.value ||
    'all';


  const rows =
    project.milestones
      .filter(
        milestone => {


          const contract =
            byId(
              project.contracts,
              milestone.contractId
            ) ||
            {};


          return (
            (
              filterContract ===
                'all' ||
              milestone.contractId ===
                filterContract
            ) &&
            (
              filterOrganization ===
                'all' ||
              contract.organizationId ===
                filterOrganization
            ) &&
            (
              filterBuilding ===
                'all' ||
              contract.buildingId ===
                filterBuilding
            )
          );

        }
      )
      .map(
        milestone => {


          const contract =
            byId(
              project.contracts,
              milestone.contractId
            ) ||
            {};


          const actual =
            milestone.factDate ||
            milestone.forecastDate;


          const difference =
            milestone.contractDate &&
            actual
              ? dateDiff(
                  milestone.contractDate,
                  actual
                )
              : null;


          let level =
            'none';


          if (
            difference !==
            null
          ) {


            if (
              difference <=
              0
            ) {

              level =
                'ok';

            } else if (
              difference <=
              3
            ) {

              level =
                'warn';

            } else if (
              difference <=
              7
            ) {

              level =
                'bad';

            } else {

              level =
                'critical';

            }

          }


          return `
            <tr data-ms-id="${milestone.id}">

              <td>
                ${esc(nameById(project.organizations,contract.organizationId))}
              </td>

              <td>
                ${esc(contract.number || '')}
              </td>

              <td>
                КД ${esc(milestone.number || '')}
              </td>

              <td>
                ${esc(milestone.title || '')}
              </td>

              <td>
                ${esc(milestone.contractDate || '')}
              </td>

              <td>
                ${esc(milestone.planDate || '')}
              </td>

              <td>
                ${esc(milestone.forecastDate || '')}
              </td>

              <td>
                ${esc(milestone.factDate || '')}
              </td>

              <td
                style="background:${levelColor(level)}"
              >
                ${
                  difference ===
                  null
                    ? '—'
                    : (
                        difference > 0
                          ? `+${difference} дн.`
                          : `${difference} дн.`
                      )
                }
              </td>

            </tr>
          `;

        }
      )
      .join(
        ''
      );


  $('milestoneRows')
    .innerHTML =
      rows;


  document
    .querySelectorAll(
      '[data-ms-id]'
    )
    .forEach(
      element =>
        element.onclick =
          () =>
            openMilestoneEditor(
              element.dataset.msId
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


  const contracts =
    activeItems(
      project.contracts
    )
      .map(
        contract =>
          `
            <option
              value="${contract.id}"
              ${
                contract.id ===
                milestone.contractId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(nameById(project.organizations,contract.organizationId))}
              ·
              ${esc(contract.number || 'без №')}
              ·
              ${esc(contract.date || '')}
            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    id
      ? 'Ключевая дата'
      : 'Новая ключевая дата',

    `

      <div class="form-grid">


        <div class="field span-2">

          <label>
            Договор
          </label>

          <select id="mContract">

            <option value="">
              —
            </option>

            ${contracts}

          </select>

        </div>


        <div class="field">

          <label>
            № КД
          </label>

          <input
            id="mNumber"
            value="${esc(milestone.number || '')}"
          >

        </div>


        <div class="field span-2">

          <label>
            Наименование
          </label>

          <input
            id="mTitle"
            value="${esc(milestone.title || '')}"
          >

        </div>


        <div class="field">

          <label>
            Договорная дата
          </label>

          <input
            id="mContractDate"
            type="date"
            value="${milestone.contractDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Плановая дата
          </label>

          <input
            id="mPlanDate"
            type="date"
            value="${milestone.planDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Прогнозная дата
          </label>

          <input
            id="mForecastDate"
            type="date"
            value="${milestone.forecastDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Фактическая дата
          </label>

          <input
            id="mFactDate"
            type="date"
            value="${milestone.factDate || ''}"
          >

        </div>


        <div class="field span-2">

          <label>
            Комментарий
          </label>

          <textarea id="mComment">${esc(milestone.comment || '')}</textarea>

        </div>


      </div>


      <div class="editor-actions">


        ${
          id
            ? `
              <button
                id="mDelete"
                class="btn danger"
              >
                Удалить
              </button>
            `
            : ''
        }


        <button
          id="mSave"
          class="btn primary"
        >
          Сохранить
        </button>


      </div>

    `
  );


  $('mSave')
    .onclick =
      () =>
        saveMilestone(
          id
        );


  if (
    id
  ) {

    $('mDelete')
      .onclick =
        () =>
          deleteEntity(
            'milestones',
            id,
            'Ключевая дата'
          );

  }

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
              'MS'
            )

        };


  Object.assign(
    milestone,
    {

      contractId:
        $('mContract')
          .value,

      number:
        $('mNumber')
          .value
          .trim(),

      title:
        $('mTitle')
          .value
          .trim(),

      contractDate:
        $('mContractDate')
          .value,

      planDate:
        $('mPlanDate')
          .value,

      forecastDate:
        $('mForecastDate')
          .value,

      factDate:
        $('mFactDate')
          .value,

      comment:
        $('mComment')
          .value
          .trim()

    }
  );


  if (
    !id
  ) {

    project.milestones
      .push(
        milestone
      );

  }


  await saveProject();


  closeModal();


  renderAll();

}



function renderConstraints() {


  $('constraintRows')
    .innerHTML =
      project.constraints
        .map(
          constraint =>
            `
              <tr data-constraint-id="${constraint.id}">

                <td>
                  ${esc(frontLabel(byId(project.fronts,constraint.frontId)))}
                </td>

                <td>
                  ${esc(nameById(project.constraintTypes,constraint.typeId))}
                </td>

                <td>
                  ${esc(constraint.openDate || '')}
                </td>

                <td>
                  ${esc(constraint.planCloseDate || '')}
                </td>

                <td>
                  ${esc(constraint.factCloseDate || '')}
                </td>

                <td>
                  ${esc(constraint.responsible || '')}
                </td>

                <td>
                  ${esc(constraint.status || 'Открыто')}
                </td>

                <td>
                  ${esc(constraint.description || '')}
                </td>

              </tr>
            `
        )
        .join(
          ''
        );


  document
    .querySelectorAll(
      '[data-constraint-id]'
    )
    .forEach(
      element =>
        element.onclick =
          () =>
            openConstraintEditor(
              element.dataset.constraintId
            )
    );

}



function openConstraintEditor(
  id = null
) {


  const constraint =
    id
      ? byId(
          project.constraints,
          id
        )
      : {};


  const fronts =
    project.fronts
      .map(
        front =>
          `
            <option
              value="${front.id}"
              ${
                front.id ===
                constraint.frontId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(frontLabel(front))}
            </option>
          `
      )
      .join(
        ''
      );


  const types =
    project.constraintTypes
      .map(
        type =>
          `
            <option
              value="${type.id}"
              ${
                type.id ===
                constraint.typeId
                  ? 'selected'
                  : ''
              }
            >
              ${esc(type.name)}
            </option>
          `
      )
      .join(
        ''
      );


  openModal(
    id
      ? 'Ограничение'
      : 'Новое ограничение',

    `

      <div class="form-grid">


        <div class="field span-2">

          <label>
            Фронт
          </label>

          <select id="xFront">

            <option value="">
              —
            </option>

            ${fronts}

          </select>

        </div>


        <div class="field">

          <label>
            Тип
          </label>

          <select id="xType">
            ${types}
          </select>

        </div>


        <div class="field">

          <label>
            Дата возникновения
          </label>

          <input
            id="xOpen"
            type="date"
            value="${constraint.openDate || today()}"
          >

        </div>


        <div class="field">

          <label>
            План снятия
          </label>

          <input
            id="xPlan"
            type="date"
            value="${constraint.planCloseDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Факт снятия
          </label>

          <input
            id="xFact"
            type="date"
            value="${constraint.factCloseDate || ''}"
          >

        </div>


        <div class="field">

          <label>
            Ответственный
          </label>

          <input
            id="xResp"
            value="${esc(constraint.responsible || '')}"
          >

        </div>


        <div class="field">

          <label>
            Статус
          </label>

          <select id="xStatus">

            <option
              ${
                constraint.status ===
                'Открыто'
                  ? 'selected'
                  : ''
              }
            >
              Открыто
            </option>

            <option
              ${
                constraint.status ===
                'В работе'
                  ? 'selected'
                  : ''
              }
            >
              В работе
            </option>

            <option
              ${
                constraint.status ===
                'Снято'
                  ? 'selected'
                  : ''
              }
            >
              Снято
            </option>

          </select>

        </div>


        <div class="field span-2">

          <label>
            Описание
          </label>

          <textarea id="xDesc">${esc(constraint.description || '')}</textarea>

        </div>


      </div>


      <div class="editor-actions">


        ${
          id
            ? `
              <button
                id="xDelete"
                class="btn danger"
              >
                Удалить
              </button>
            `
            : ''
        }


        <button
          id="xSave"
          class="btn primary"
        >
          Сохранить
        </button>


      </div>

    `
  );


  $('xSave')
    .onclick =
      () =>
        saveConstraint(
          id
        );


  if (
    id
  ) {

    $('xDelete')
      .onclick =
        () =>
          deleteEntity(
            'constraints',
            id,
            'Ограничение'
          );

  }

}



async function saveConstraint(
  id
) {


  let constraint =
    id
      ? byId(
          project.constraints,
          id
        )
      : {

          id:
            uid(
              'X'
            )

        };


  Object.assign(
    constraint,
    {

      frontId:
        $('xFront')
          .value,

      typeId:
        $('xType')
          .value,

      openDate:
        $('xOpen')
          .value,

      planCloseDate:
        $('xPlan')
          .value,

      factCloseDate:
        $('xFact')
          .value,

      responsible:
        $('xResp')
          .value
          .trim(),

      status:
        $('xStatus')
          .value,

      description:
        $('xDesc')
          .value
          .trim()

    }
  );


  if (
    !id
  ) {

    project.constraints
      .push(
        constraint
      );

  }


  await saveProject();


  closeModal();


  renderAll();

}



function isEntityUsed(
  collection,
  id
) {


  if (
    collection ===
    'organizations'
  ) {

    return (
      project.contracts
        .some(
          item =>
            item.organizationId ===
            id
        ) ||
      project.fronts
        .some(
          item =>
            item.organizationId ===
            id
        ) ||
      project.resources
        .some(
          item =>
            item.organizationId ===
            id
        )
    );

  }


  if (
    collection ===
    'works'
  ) {

    return project.fronts
      .some(
        item =>
          item.workId ===
          id
      );

  }


  if (
    collection ===
    'units'
  ) {

    return (
      project.works
        .some(
          item =>
            item.unitId ===
            id
        ) ||
      project.fronts
        .some(
          item =>
            item.unitId ===
            id
        )
    );

  }


  if (
    collection ===
    'buildings'
  ) {

    return (
      project.structures
        .some(
          item =>
            item.buildingId ===
            id
        ) ||
      project.contracts
        .some(
          item =>
            item.buildingId ===
            id
        )
    );

  }


  if (
    collection ===
    'contracts'
  ) {

    return (
      project.fronts
        .some(
          item =>
            item.contractId ===
            id
        ) ||
      project.milestones
        .some(
          item =>
            item.contractId ===
            id
        )
    );

  }


  return false;

}



async function deleteEntity(
  collection,
  id,
  label
) {


  const used =
    isEntityUsed(
      collection,
      id
    );


  if (
    used
  ) {


    if (
      confirm(
        `${label} используется в других данных.\n\nАрхивировать вместо удаления?`
      )
    ) {


      const item =
        byId(
          project[collection],
          id
        );


      if (
        item
      ) {

        item.active =
          false;

      }


      await saveProject();


      closeModal();


      renderAll();

    }


    return;

  }


  if (
    !confirm(
      `Удалить: ${label}?`
    )
  ) {

    return;

  }


  project[collection] =
    project[collection]
      .filter(
        item =>
          item.id !==
          id
      );


  await saveProject();


  closeModal();


  renderAll();

}



function renderDictionary(
  collection,
  target,
  label,
  fields
) {


  const list =
    project[collection] ||
    [];


  $(target)
    .innerHTML =
      list
        .map(
          item =>
            `
              <div
                class="
                  item
                  ${
                    item.active ===
                    false
                      ? 'archived'
                      : ''
                  }
                "
              >

                <span>

                  ${esc(item.name || '')}

                  ${
                    item.active ===
                    false
                      ? `
                        <small>
                          (архив)
                        </small>
                      `
                      : ''
                  }

                </span>

                <button
                  class="row-btn"
                  data-dict="${collection}"
                  data-id="${item.id}"
                >
                  Редактировать
                </button>

              </div>
            `
        )
        .join(
          ''
        ) ||
      `
        <div class="muted">
          Пока пусто
        </div>
      `;


  document
    .querySelectorAll(
      `[data-dict="${collection}"]`
    )
    .forEach(
      button =>
        button.onclick =
          () =>
            openDictionaryEditor(
              collection,
              button.dataset.id,
              label,
              fields
            )
    );

}



function renderDictionaries() {


  renderDictionary(
    'buildings',
    'dictBuildings',
    'Здание',
    [
      'name'
    ]
  );


  renderDictionary(
    'organizations',
    'dictOrganizations',
    'Организация',
    [
      'name'
    ]
  );


  renderDictionary(
    'units',
    'dictUnits',
    'Единица',
    [
      'name'
    ]
  );


  renderDictionary(
    'works',
    'dictWorks',
    'Вид работы',
    [

      'name',

      'section',

      'controlType'

    ]
  );


  renderDictionary(
    'equipmentTypes',
    'dictEquipment',
    'Тип техники',
    [
      'name'
    ]
  );


  renderDictionary(
    'constraintTypes',
    'dictConstraintTypes',
    'Тип ограничения',
    [
      'name'
    ]
  );


  renderDictionary(
    'statuses',
    'dictStatuses',
    'Статус работ',
    [

      'name',

      'color'

    ]
  );


  renderDictionary(
    'acceptanceStatuses',
    'dictAcceptance',
    'Статус сдачи',
    [

      'name',

      'color'

    ]
  );

}



function openDictionaryEditor(
  collection,
  id = null,
  label = 'Запись',
  fields = [
    'name'
  ]
) {


  const item =
    id
      ? byId(
          project[collection],
          id
        )
      : {

          id:
            uid(
              'D'
            ),

          active:
            true

        };


  const html =
    fields
      .map(
        field => {


          if (
            field ===
            'color'
          ) {

            return `
              <div class="field">

                <label>
                  Цвет
                </label>

                <input
                  id="d_${field}"
                  type="color"
                  value="${esc(item[field] || '#e5e7eb')}"
                >

              </div>
            `;

          }


          if (
            field ===
            'controlType'
          ) {

            return `
              <div class="field">

                <label>
                  Тип контроля
                </label>

                <select id="d_${field}">

                  ${
                    [

                      'Количественный',

                      'Статусный',

                      'Процентный',

                      'Комбинированный'

                    ]
                      .map(
                        value =>
                          `
                            <option
                              ${
                                item[field] ===
                                value
                                  ? 'selected'
                                  : ''
                              }
                            >
                              ${value}
                            </option>
                          `
                      )
                      .join(
                        ''
                      )
                  }

                </select>

              </div>
            `;

          }


          return `
            <div class="field">

              <label>

                ${
                  field ===
                  'name'
                    ? 'Наименование'
                    : (
                        field ===
                        'section'
                          ? 'Раздел'
                          : field
                      )
                }

              </label>

              <input
                id="d_${field}"
                value="${esc(item[field] || '')}"
              >

            </div>
          `;

        }
      )
      .join(
        ''
      );


  openModal(
    id
      ? `Редактировать: ${label}`
      : `Добавить: ${label}`,

    `

      <div class="form-grid">
        ${html}
      </div>


      <div class="editor-actions">


        ${
          id
            ? `
              <button
                id="dArchive"
                class="btn"
              >
                Архивировать / вернуть
              </button>

              <button
                id="dDelete"
                class="btn danger"
              >
                Удалить
              </button>
            `
            : ''
        }


        <button
          id="dSave"
          class="btn primary"
        >
          Сохранить
        </button>


      </div>

    `
  );


  $('dSave')
    .onclick =
      async () => {


        fields
          .forEach(
            field =>
              item[field] =
                $(
                  `d_${field}`
                )
                  .value
                  .trim()
          );


        if (
          !id
        ) {

          project[collection]
            .push(
              item
            );

        }


        await saveProject();


        closeModal();


        renderAll();

      };


  if (
    id
  ) {


    $('dArchive')
      .onclick =
        async () => {


          item.active =
            item.active ===
            false
              ? true
              : false;


          await saveProject();


          closeModal();


          renderAll();

        };


    $('dDelete')
      .onclick =
        () =>
          deleteEntity(
            collection,
            id,
            label
          );

  }

}



function renderVersions() {


  $('versionRows')
    .innerHTML =
      project.scheduleVersions
        .map(
          version =>
            `
              <tr>

                <td>
                  ${
                    new Date(
                      version.createdAt
                    )
                      .toLocaleString(
                        'ru-RU'
                      )
                  }
                </td>

                <td>
                  ${esc(version.name)}
                </td>

                <td>
                  ${version.fronts.length}
                </td>

              </tr>
            `
        )
        .join(
          ''
        );

}



async function createScheduleVersion() {


  const name =
    prompt(
      'Название снимка графика',
      `Снимок ${new Date().toLocaleDateString('ru-RU')}`
    );


  if (
    !name
  ) {
    return;
  }


  project.scheduleVersions
    .unshift({

      id:
        uid(
          'VER'
        ),

      name,

      createdAt:
        nowIso(),

      fronts:
        project.fronts
          .map(
            front => ({

              id:
                front.id,

              contractStart:
                front.contractStart,

              contractEnd:
                front.contractEnd,

              baselineStart:
                front.baselineStart,

              baselineEnd:
                front.baselineEnd,

              planStart:
                front.planStart,

              planEnd:
                front.planEnd,

              factStart:
                front.factStart,

              factEnd:
                front.factEnd,

              forecastStart:
                front.forecastStart,

              forecastEnd:
                front.forecastEnd

            })
          )

    });


  await saveProject();


  renderVersions();

}



function renderReports() {


  $('reportInfo')
    .innerHTML =
      `
        <div class="muted">

          Кнопка «Сохранить PDF» печатает текущую открытую вкладку.

          <br><br>

          Следующим этапом сюда добавим конструктор многоразделных
          шаблонов отчётов, чтобы в один PDF собирать:

          <br>

          Сводку + КД + Гант + шахматку + план/факт + ресурсы + ограничения.

        </div>
      `;

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
        .join(
          ''
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



function switchTab(
  name
) {


  activeTab =
    name;


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


  renderAll();

}



function printCurrent() {


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


  $(
    `tab-${activeTab}`
  )
    .classList
    .add(
      'print-active'
    );


  window.print();


  setTimeout(
    () =>
      $(
        `tab-${activeTab}`
      )
        .classList
        .remove(
          'print-active'
        ),
    400
  );

}



function renderBackupNotice() {


  const last =
    project
      ?.meta
      ?.lastBackupAt;


  $('backupNotice')
    .textContent =
      last
        ? `Последняя резервная копия: ${new Date(last).toLocaleString('ru-RU')}`
        : 'Резервная копия ещё не создавалась';

}



function download(
  name,
  text,
  type = 'application/json'
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


  link.click();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );

}



async function exportBackup() {


  project.meta.lastBackupAt =
    nowIso();


  await saveProject();


  download(
    `ACONS_Planning_${nowIso().slice(0,16).replace('T','_').replace(':','-')}.json`,

    JSON.stringify(
      project,
      null,
      2
    )
  );


  renderBackupNotice();

}



async function restoreFile(
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
        'Полностью заменить текущий локальный проект файлом?'
      )
    ) {

      return;

    }


    project =
      data;


    currentViewId =
      project.meta.defaultViewId;


    await saveProject();


    renderAll();

  } catch (
    error
  ) {


    alert(
      'Ошибка загрузки: ' +
      error.message
    );

  }


  $('restoreInput')
    .value =
      '';

}



function compareProjectFile(
  file
) {


  file.text()
    .then(
      text => {


        compareIncoming =
          normalizeProject(
            JSON.parse(
              text
            )
          );


        const sections = [

          'fronts',

          'contracts',

          'milestones',

          'resources',

          'views'

        ];


        const rows =
          sections
            .map(
              key => {


                const current =
                  new Map(
                    project[key]
                      .map(
                        item => [
                          item.id,
                          JSON.stringify(
                            item
                          )
                        ]
                      )
                  );


                const incoming =
                  new Map(
                    compareIncoming[key]
                      .map(
                        item => [
                          item.id,
                          JSON.stringify(
                            item
                          )
                        ]
                      )
                  );


                let added =
                  0;


                let changed =
                  0;


                let localOnly =
                  0;


                incoming
                  .forEach(
                    (
                      value,
                      id
                    ) => {


                      if (
                        !current.has(
                          id
                        )
                      ) {

                        added++;

                      } else if (
                        current.get(
                          id
                        ) !==
                        value
                      ) {

                        changed++;

                      }

                    }
                  );


                current
                  .forEach(
                    (
                      value,
                      id
                    ) => {


                      if (
                        !incoming.has(
                          id
                        )
                      ) {

                        localOnly++;

                      }

                    }
                  );


                return `
                  <tr>

                    <td>
                      ${key}
                    </td>

                    <td>
                      ${added}
                    </td>

                    <td>
                      ${changed}
                    </td>

                    <td>
                      ${localOnly}
                    </td>

                  </tr>
                `;

              }
            )
            .join(
              ''
            );


        openModal(
          'Сравнение проекта',

          `

            <table>

              <thead>

                <tr>

                  <th>
                    Раздел
                  </th>

                  <th>
                    Новые
                  </th>

                  <th>
                    Изменено
                  </th>

                  <th>
                    Только у меня
                  </th>

                </tr>

              </thead>

              <tbody>
                ${rows}
              </tbody>

            </table>


            <div class="notice">

              Сейчас объединение выполняется по целым записям.

              Следующим этапом сделаем поштучное принятие каждого
              изменённого поля:

              «Принять дату» / «Оставить мою».

            </div>


            <div class="editor-actions">

              <button
                id="mergeAll"
                class="btn primary"
              >
                Объединить всё
              </button>

            </div>

          `
        );


        $('mergeAll')
          .onclick =
            mergeAll;

      }
    );

}



async function mergeAll() {


  if (
    !compareIncoming
  ) {
    return;
  }


  [

    'buildings',

    'organizations',

    'units',

    'works',

    'contracts',

    'structures',

    'fronts',

    'planLog',

    'factLog',

    'resources',

    'milestones',

    'constraints',

    'handovers',

    'dependencies',

    'calendars',

    'scheduleVersions',

    'statuses',

    'acceptanceStatuses',

    'equipmentTypes',

    'constraintTypes',

    'views'

  ]
    .forEach(
      key => {


        const map =
          new Map(
            project[key]
              .map(
                item => [
                  item.id,
                  item
                ]
              )
          );


        compareIncoming[key]
          .forEach(
            item =>
              map.set(
                item.id,
                item
              )
          );


        project[key] =
          [
            ...map.values()
          ];

      }
    );


  await saveProject();


  closeModal();


  renderAll();

}



function renderAll() {


  initSelectors();


  renderDashboard();


  renderViews();


  renderMatrix();


  renderGantt();


  renderPlanFact();


  renderResources();


  renderContracts();


  renderMilestones();


  renderConstraints();


  renderVersions();


  renderReports();


  renderHistory();


  renderDictionaries();

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


  $('modalClose')
    .onclick =
      closeModal;


  $('modal')
    .onclick =
      event => {


        if (
          event.target ===
          $('modal')
        ) {

          closeModal();

        }

      };


  $('backupBtn')
    .onclick =
      exportBackup;


  $('restoreInput')
    .onchange =
      event =>
        event.target.files[0] &&
        restoreFile(
          event.target.files[0]
        );


  $('compareInput')
    .onchange =
      event =>
        event.target.files[0] &&
        compareProjectFile(
          event.target.files[0]
        );


  $('pdfBtn')
    .onclick =
      printCurrent;



  $('viewSelect')
    .onchange =
      () => {


        currentViewId =
          $('viewSelect')
            .value;


        renderMatrix();

      };


  $('newViewBtn')
    .onclick =
      () =>
        openViewEditor();


  $('editViewBtn')
    .onclick =
      () =>
        openViewEditor(
          currentView()
        );


  $('duplicateViewBtn')
    .onclick =
      duplicateView;


  $('deleteViewBtn')
    .onclick =
      deleteView;


  $('defaultViewBtn')
    .onclick =
      setDefaultView;



  $('newFrontBtn')
    .onclick =
      () =>
        openFrontEditor();


  $('newPlanBtn')
    .onclick =
      () =>
        openLogEditor(
          'plan'
        );


  $('newFactBtn')
    .onclick =
      () =>
        openLogEditor(
          'fact'
        );


  $('newResourceBtn')
    .onclick =
      openResourceEditor;


  $('newContractBtn')
    .onclick =
      () =>
        openContractEditor();


  $('newMilestoneBtn')
    .onclick =
      () =>
        openMilestoneEditor();


  $('newConstraintBtn')
    .onclick =
      () =>
        openConstraintEditor();


  $('createVersionBtn')
    .onclick =
      createScheduleVersion;



  [

    'matrixBuilding',

    'matrixOrg'

  ]
    .forEach(
      id =>
        $(id)
          .onchange =
            renderMatrix
    );



  [

    'gBuilding',

    'gWork'

  ]
    .forEach(
      id =>
        $(id)
          .onchange =
            renderGantt
    );


  document
    .querySelectorAll(
      '[data-g-layer]'
    )
    .forEach(
      element =>
        element.onchange =
          renderGantt
    );



  [

    'pfBuilding',

    'pfWork',

    'pfFrom',

    'pfTo'

  ]
    .forEach(
      id =>
        $(id)
          .onchange =
            renderPlanFact
    );



  [

    'rBuilding',

    'rOrg',

    'rFrom',

    'rTo'

  ]
    .forEach(
      id =>
        $(id)
          .onchange =
            renderResources
    );



  [

    'msBuilding',

    'msOrg',

    'msContract'

  ]
    .forEach(
      id =>
        $(id)
          .onchange =
            renderMilestones
    );



  $('addBuilding')
    .onclick =
      () =>
        openDictionaryEditor(
          'buildings',
          null,
          'Здание',
          [
            'name'
          ]
        );


  $('addOrganization')
    .onclick =
      () =>
        openDictionaryEditor(
          'organizations',
          null,
          'Организация',
          [
            'name'
          ]
        );


  $('addUnit')
    .onclick =
      () =>
        openDictionaryEditor(
          'units',
          null,
          'Единица',
          [
            'name'
          ]
        );


  $('addWork')
    .onclick =
      () =>
        openDictionaryEditor(
          'works',
          null,
          'Вид работы',
          [

            'name',

            'section',

            'controlType'

          ]
        );


  $('addEquipment')
    .onclick =
      () =>
        openDictionaryEditor(
          'equipmentTypes',
          null,
          'Тип техники',
          [
            'name'
          ]
        );


  $('addConstraintType')
    .onclick =
      () =>
        openDictionaryEditor(
          'constraintTypes',
          null,
          'Тип ограничения',
          [
            'name'
          ]
        );


  $('addStatus')
    .onclick =
      () =>
        openDictionaryEditor(
          'statuses',
          null,
          'Статус работ',
          [

            'name',

            'color'

          ]
        );


  $('addAcceptance')
    .onclick =
      () =>
        openDictionaryEditor(
          'acceptanceStatuses',
          null,
          'Статус сдачи',
          [

            'name',

            'color'

          ]
        );

}



async function init() {


  db =
    await openDb();


  project =
    normalizeProject(
      await dbGet() ||
      emptyProject()
    );


  currentViewId =
    project.meta.defaultViewId;


  bindUi();


  $('pfTo')
    .value =
      today();


  $('rTo')
    .value =
      today();


  await saveProject();


  renderAll();

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
