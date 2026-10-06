'use strict';

const $ = id =>
  document.getElementById(id);

const cfg =
  window.ACONS_CONFIG || {};

const badConfig =
  !cfg.SUPABASE_URL ||
  !cfg.SUPABASE_PUBLISHABLE_KEY ||
  cfg.SUPABASE_URL.includes('PASTE_') ||
  cfg.SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');

let sb = null;
let currentUser = null;
let profile = null;

let selectedFrontId = null;
let logMode = 'plan';

let importRows = [];

let realtimeChannel = null;

let editingMilestoneId = null;

const state = {
  buildings: [],
  works: [],
  organizations: [],
  structures: [],
  fronts: [],
  planLog: [],
  factLog: [],
  resourceLog: [],
  milestones: [],
  customFields: [],
  views: [],
  history: [],
  users: []
};

const BASE_COLUMNS = [
  ['building', 'Здание'],
  ['block', 'Блок'],
  ['floor', 'Этаж'],
  ['capture', 'Захватка'],
  ['axis', 'Ось'],
  ['side', 'Сторона'],
  ['zone', 'Зона'],
  ['room_no', '№ помещения'],
  ['room_name', 'Помещение'],
  ['equipment', 'Оборудование'],
  ['fsm_priority', 'Приоритет ФСМ'],
  ['fsm_status', 'Статус ФСМ'],
  ['organization', 'Организация'],
  ['responsible', 'Ответственный'],
  ['status', 'Статус']
];

let visibleColumns = [
  'building',
  'block',
  'floor',
  'axis',
  'side',
  'organization',
  'status'
];

const esc = value =>
  String(value ?? '')
    .replace(
      /[&<>"']/g,
      char =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        })[char]
    );

const uniq = array =>
  [
    ...new Set(
      array.filter(
        value =>
          value !== undefined &&
          value !== null &&
          String(value) !== ''
      )
    )
  ];

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const num = value =>
  Number(value || 0);

const fmt = value =>
  Math.round(
    num(value) * 100
  ) / 100;

const diffDays = (
  date1,
  date2
) =>
  date1 && date2
    ?
    Math.round(
      (
        Date.parse(date2) -
        Date.parse(date1)
      ) /
      86400000
    )
    :
    null;

function showBootError(text) {

  $('bootError')
    .classList
    .remove('hidden');

  $('bootError')
    .innerHTML =
      `
        <div class="notice error">

          <b>
            Ошибка запуска:
          </b>

          ${esc(text)}

        </div>
      `;
}

function notice(
  text,
  ok = false
) {

  $('syncStatus')
    .textContent =
      text;

  $('syncStatus')
    .style.color =
      ok
        ?
        '#86efac'
        :
        '#fde68a';
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
      .appendChild(option);
  }

  items.forEach(item => {

    const option =
      document
        .createElement(
          'option'
        );

    option.value =
      String(
        item.id ?? item
      );

    option.textContent =
      String(
        item.name ?? item
      );

    element
      .appendChild(option);
  });

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

function nameById(
  list,
  id
) {

  return (
    list.find(
      item =>
        item.id === id
    )?.name ||
    ''
  );
}

async function init() {

  if (badConfig) {

    showBootError(
      'В config.js не заполнены адрес проекта и публикуемый ключ Supabase.'
    );

    return;
  }

  sb =
    window.supabase
      .createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

  bindAuth();

  const {
    data: {
      session
    }
  } =
    await sb.auth
      .getSession();

  if (session) {

    await enterApp(
      session.user
    );
  }

  sb.auth
    .onAuthStateChange(
      async (
        _event,
        session
      ) => {

        if (
          session?.user &&
          session.user.id !==
            currentUser?.id
        ) {

          await enterApp(
            session.user
          );
        }

        if (!session) {

          currentUser =
            null;

          profile =
            null;

          $('app')
            .classList
            .add('hidden');

          $('authScreen')
            .classList
            .remove('hidden');
        }
      }
    );
}

function bindAuth() {

  $('signInBtn').onclick =
    async () => {

      const email =
        $('authEmail')
          .value
          .trim();

      const password =
        $('authPassword')
          .value;

      $('authNotice')
        .innerHTML =
          '';

      const {
        error
      } =
        await sb.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {

        $('authNotice')
          .innerHTML =
            `
              <div class="notice error">
                ${esc(error.message)}
              </div>
            `;
      }
    };

  $('signUpBtn').onclick =
    async () => {

      const email =
        $('authEmail')
          .value
          .trim();

      const password =
        $('authPassword')
          .value;

      const {
        error
      } =
        await sb.auth
          .signUp({
            email,
            password
          });

      $('authNotice')
        .innerHTML =
          error
            ?
            `
              <div class="notice error">
                ${esc(error.message)}
              </div>
            `
            :
            `
              <div class="notice ok">
                Учетная запись создана.
                Если включено подтверждение почты,
                подтверди email и войди.
              </div>
            `;
    };

  $('signOutBtn').onclick =
    () =>
      sb.auth
        .signOut();
}

async function enterApp(user) {

  currentUser =
    user;

  const {
    data,
    error
  } =
    await sb
      .from('app_users')
      .select('*')
      .eq(
        'id',
        user.id
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  profile =
    data;

  $('userLabel')
    .textContent =
      `${user.email} · ${profile?.role || 'без роли'}`;

  $('authScreen')
    .classList
    .add('hidden');

  $('app')
    .classList
    .remove('hidden');

  bindUi();

  await reloadAll();

  subscribeRealtime();
}

async function reloadAll() {

  notice(
    'Загрузка общей базы...'
  );

  const tables = [
    [
      'buildings',
      'buildings'
    ],

    [
      'works',
      'works'
    ],

    [
      'organizations',
      'organizations'
    ],

    [
      'custom_fields',
      'customFields'
    ],

    [
      'structures',
      'structures'
    ],

    [
      'fronts',
      'fronts'
    ],

    [
      'plan_log',
      'planLog'
    ],

    [
      'fact_log',
      'factLog'
    ],

    [
      'resource_log',
      'resourceLog'
    ],

    [
      'milestones',
      'milestones'
    ],

    [
      'matrix_views',
      'views'
    ],

    [
      'change_log',
      'history'
    ],

    [
      'app_users',
      'users'
    ]
  ];

  for (
    const [
      table,
      key
    ]
    of tables
  ) {

    const {
      data,
      error
    } =
      await sb
        .from(table)
        .select('*');

    if (error) {
      throw error;
    }

    state[key] =
      data || [];
  }

  renderAll();

  notice(
    'Синхронизировано',
    true
  );
}

function subscribeRealtime() {

  if (realtimeChannel) {

    sb.removeChannel(
      realtimeChannel
    );
  }

  realtimeChannel =
    sb.channel(
      'acons-live'
    );

  [
    'fronts',
    'plan_log',
    'fact_log',
    'resource_log',
    'milestones',
    'buildings',
    'works',
    'structures',
    'organizations',
    'matrix_views'
  ]
    .forEach(table => {

      realtimeChannel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table
          },
          async () => {

            notice(
              'Получено изменение...'
            );

            await reloadAll();
          }
        );
    });

  realtimeChannel
    .subscribe(status => {

      if (
        status ===
        'SUBSCRIBED'
      ) {

        notice(
          'Онлайн · изменения видны всем',
          true
        );
      }
    });
}

function bindUi() {

  if (
    window.__aconsBound
  ) {
    return;
  }

  window.__aconsBound =
    true;

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(button => {

      button.onclick =
        () =>
          showTab(
            button.dataset.tab
          );
    });

  $('closeFront').onclick =
    () =>
      $('frontEditor')
        .classList
        .add('hidden');

  $('saveFrontBtn').onclick =
    saveFront;

  $('openViewSettings').onclick =
    () =>
      $('viewSettings')
        .classList
        .remove('hidden');

  $('closeViewSettings').onclick =
    () =>
      $('viewSettings')
        .classList
        .add('hidden');

  $('saveViewBtn').onclick =
    saveView;

  $('loadViewBtn').onclick =
    loadView;

  [
    'mfBuilding',
    'mfBlock',
    'mfFloor',
    'mfWork',
    'mfOrg',
    'mfStatus'
  ]
    .forEach(id => {

      $(id).onchange =
        renderMatrix;
    });

  [
    'gBuilding',
    'gWork',
    'gOrg',
    'gMode'
  ]
    .forEach(id => {

      $(id).onchange =
        renderGantt;
    });

  $('calcPlanFact').onclick =
    renderPlanFact;

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

  $('closeLogBtn').onclick =
    () =>
      $('logEditor')
        .classList
        .add('hidden');

  $('saveLogBtn').onclick =
    saveLog;

  $('newResourceBtn').onclick =
    () => {

      $('resourceEditor')
        .classList
        .remove('hidden');

      $('reDate').value =
        today();
    };

  $('closeResourceBtn').onclick =
    () =>
      $('resourceEditor')
        .classList
        .add('hidden');

  $('saveResourceBtn').onclick =
    saveResource;

  $('filterResourcesBtn').onclick =
    renderResources;

  $('newMilestoneBtn').onclick =
    () =>
      openMilestone();

  $('saveMilestoneBtn').onclick =
    saveMilestone;

  $('closeMilestoneBtn').onclick =
    () =>
      $('milestoneEditor')
        .classList
        .add('hidden');

  $('buildReportBtn').onclick =
    buildReport;

  $('downloadPdfBtn').onclick =
    downloadPdf;

  $('importFile').onchange =
    readImportFile;

  $('commitImportBtn').onclick =
    commitImport;

  $('addBuildingBtn').onclick =
    () =>
      addSimple(
        'buildings',
        $('newBuilding')
          .value
          .trim()
      );

  $('addWorkBtn').onclick =
    () =>
      addSimple(
        'works',
        $('newWork')
          .value
          .trim()
      );

  $('addOrgBtn').onclick =
    () =>
      addSimple(
        'organizations',
        $('newOrg')
          .value
          .trim()
      );

  $('addCfBtn').onclick =
    addCustomField;

  $('addStructureBtn').onclick =
    addStructure;
}

function showTab(name) {

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(button => {

      button
        .classList
        .toggle(
          'active',
          button.dataset.tab ===
            name
        );
    });

  document
    .querySelectorAll(
      '.panel'
    )
    .forEach(panel => {

      panel
        .classList
        .add('hidden');
    });

  $('tab-' + name)
    .classList
    .remove('hidden');

  if (
    name ===
    'dashboard'
  ) {
    renderDashboard();
  }

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
    'reports'
  ) {
    buildReport();
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

function hydrateFront(front) {

  const structure =
    state.structures
      .find(
        item =>
          item.id ===
          front.structure_id
      ) ||
    {};

  return {
    ...front,

    structure,

    building:
      nameById(
        state.buildings,
        structure.building_id
      ),

    work:
      nameById(
        state.works,
        front.work_id
      ),

    organization:
      nameById(
        state.organizations,
        front.organization_id
      ),

    block:
      structure.block_name ||
      '',

    floor:
      structure.floor_no ??
      '',

    capture:
      structure.capture_name ||
      '',

    axis:
      structure.axis_name ||
      '',

    side:
      structure.side_name ||
      '',

    zone:
      structure.zone_name ||
      '',

    room_no:
      structure.room_number ||
      '',

    room_name:
      structure.room_name ||
      '',

    equipment:
      structure.equipment_name ||
      '',

    fsm_priority:
      structure.fsm_priority ||
      '',

    fsm_status:
      structure.fsm_status ||
      ''
  };
}

function frontLabel(front) {

  const item =
    hydrateFront(front);

  return [
    item.building,
    item.block,

    item.floor !== ''
      ?
      `${item.floor} эт.`
      :
      '',

    item.capture
      ?
      `захв. ${item.capture}`
      :
      '',

    item.axis
      ?
      `ось ${item.axis}`
      :
      '',

    item.side,
    item.zone,

    item.room_no
      ?
      `пом. ${item.room_no}`
      :
      '',

    item.work
  ]
    .filter(Boolean)
    .join(' / ');
}

function statusClass(status) {

  return (
    status ===
      'Фронт готов'
      ?
      's-ready'
      :
    status ===
      'В работе'
      ?
      's-work'
      :
    status ===
      'Завершено'
      ?
      's-done'
      :
    status ===
      'Приостановлено'
      ?
      's-pause'
      :
    status ===
      'Ограничение'
      ?
      's-risk'
      :
      's-not'
  );
}

function initSelects() {

  const buildings =
    state.buildings
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );

  const works =
    state.works
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );

  const organizations =
    state.organizations
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );

  [
    'mfBuilding',
    'gBuilding',
    'pfBuilding',
    'rBuilding',
    'repBuilding'
  ]
    .forEach(id => {

      fill(
        $(id),
        buildings,
        'Все здания'
      );
    });

  fill(
    $('msBuilding'),
    buildings
  );

  [
    'mfWork',
    'gWork',
    'pfWork',
    'repWork'
  ]
    .forEach(id => {

      fill(
        $(id),
        works,
        'Все работы'
      );
    });

  [
    'mfOrg',
    'gOrg',
    'pfOrg',
    'rOrg',
    'repOrg'
  ]
    .forEach(id => {

      fill(
        $(id),
        organizations,
        'Все организации'
      );
    });

  fill(
    $('fOrg'),
    [
      {
        id: '',
        name: '—'
      },
      ...organizations
    ]
  );

  fill(
    $('reOrg'),
    organizations
  );

  fill(
    $('reBuilding'),
    buildings
  );

  fill(
    $('sBuilding'),
    buildings
  );

  fill(
    $('sWork'),
    works
  );

  updateMatrixDependent();

  fill(
    $('savedViewSelect'),
    state.views
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      ),
    'Выбери вид'
  );
}

function updateMatrixDependent() {

  const buildingId =
    $('mfBuilding').value;

  const structures =
    state.structures
      .filter(
        structure =>
          buildingId ===
            'all' ||
          structure.building_id ===
            buildingId
      );

  fill(
    $('mfBlock'),
    uniq(
      structures
        .map(
          item =>
            item.block_name
        )
    )
      .map(
        value => ({
          id: value,
          name: value
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
            item.floor_no
        )
    )
      .sort(
        (a, b) =>
          num(a) -
          num(b)
      )
      .map(
        value => ({
          id: value,
          name: value
        })
      ),
    'Все этажи'
  );
}

function renderDashboard() {

  const fronts =
    state.fronts
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
          front.contract_end &&
          !front.accepted &&
          front.contract_end <
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
            front.contract_end &&
            !front.accepted &&
            front.contract_end <
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
        15
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

      '<div class="muted">Нет критичных работ</div>';

  const lastDate =
    [...state.resourceLog]
      .sort(
        (a, b) =>
          String(a.resource_date)
            .localeCompare(
              String(b.resource_date)
            )
      )
      .slice(-1)[0]
      ?.resource_date;

  const resourceRows =
    state.resourceLog
      .filter(
        row =>
          row.resource_date ===
          lastDate
      );

  const people =
    resourceRows
      .reduce(
        (sum, row) =>
          sum +
          num(row.itr) +
          num(row.workers) +
          num(row.mechanizers),
        0
      );

  const equipment =
    resourceRows
      .reduce(
        (sum, row) =>
          sum +
          num(
            row.equipment_qty
          ),
        0
      );

  $('dResources')
    .innerHTML =
      lastDate
        ?
        `
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
        :
        '<div class="muted">Нет данных</div>';
}

function getColumnDefs() {

  const customColumns =
    state.customFields
      .filter(
        field =>
          field.scope ===
          'structure'
      )
      .map(
        field => [
          `cf:${field.id}`,
          field.name
        ]
      );

  return [
    ...BASE_COLUMNS,
    ...customColumns
  ];
}

function renderColumnChooser() {

  const definitions =
    getColumnDefs();

  $('columnChooser')
    .innerHTML =
      definitions
        .map(
          ([key, name]) =>
            `
              <label>

                <input
                  type="checkbox"
                  data-col="${key}"
                  ${
                    visibleColumns
                      .includes(key)
                      ?
                      'checked'
                      :
                      ''
                  }>

                ${esc(name)}

              </label>
            `
        )
        .join('');

  document
    .querySelectorAll(
      '[data-col]'
    )
    .forEach(checkbox => {

      checkbox.onchange =
        () => {

          visibleColumns =
            [
              ...document
                .querySelectorAll(
                  '[data-col]:checked'
                )
            ]
              .map(
                element =>
                  element.dataset.col
              );

          renderMatrix();
        };
    });
}

function matrixFiltered() {

  return state.fronts
    .map(
      hydrateFront
    )
    .filter(
      front =>
        (
          $('mfBuilding').value ===
            'all' ||
          front.structure
            .building_id ===
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
          front.work_id ===
            $('mfWork').value
        ) &&

        (
          $('mfOrg').value ===
            'all' ||
          front.organization_id ===
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

function colValue(
  front,
  key
) {

  if (
    key.startsWith(
      'cf:'
    )
  ) {

    return (
      front.structure
        .custom_data?.[
          key.slice(3)
        ] ??
      ''
    );
  }

  return (
    front[key] ??
    ''
  );
}

function renderMatrix() {

  initSelects();

  renderColumnChooser();

  const definitions =
    new Map(
      getColumnDefs()
    );

  const rows =
    matrixFiltered();

  $('matrixHead')
    .innerHTML =
      '<tr>' +

      visibleColumns
        .map(
          key =>
            `
              <th>
                ${esc(definitions.get(key) || key)}
              </th>
            `
        )
        .join('') +

      '<th>Работа</th>' +
      '<th>Карточка</th>' +

      '</tr>';

  $('matrixBody')
    .innerHTML =
      rows
        .map(
          front =>
            `
              <tr>

                ${
                  visibleColumns
                    .map(
                      key =>
                        `
                          <td>
                            ${esc(colValue(front,key))}
                          </td>
                        `
                    )
                    .join('')
                }

                <td>
                  ${esc(front.work)}
                </td>

                <td>

                  <button
                    class="cellbtn ${statusClass(front.status)}"
                    data-open-front="${front.id}">

                    <b>
                      ${esc(front.status)}
                    </b>

                    <br>

                    <small>
                      ${esc(front.fact_text || 'Факт не указан')}
                    </small>

                  </button>

                </td>

              </tr>
            `
        )
        .join('');

  document
    .querySelectorAll(
      '[data-open-front]'
    )
    .forEach(button => {

      button.onclick =
        () =>
          openFront(
            button.dataset.openFront
          );
    });
}

async function saveView() {

  const name =
    $('viewName')
      .value
      .trim();

  if (!name) {

    alert(
      'Укажи название вида'
    );

    return;
  }

  const payload = {
    name,

    owner_user_id:
      currentUser.id,

    is_shared:
      profile?.role ===
        'admin' ||
      profile?.role ===
        'planner',

    columns:
      visibleColumns,

    filters: {}
  };

  const {
    error
  } =
    await sb
      .from(
        'matrix_views'
      )
      .insert(
        payload
      );

  if (error) {

    alert(
      error.message
    );

    return;
  }

  await reloadAll();
}

function loadView() {

  const view =
    state.views
      .find(
        item =>
          item.id ===
          $('savedViewSelect')
            .value
      );

  if (!view) {
    return;
  }

  visibleColumns =
    Array.isArray(
      view.columns
    )
      ?
      view.columns
      :
      [];

  renderMatrix();
}

function renderFrontCustom(
  front
) {

  const fields =
    state.customFields
      .filter(
        field =>
          field.scope ===
          'front'
      );

  $('frontCustom')
    .innerHTML =
      fields
        .map(field => {

          const value =
            front.custom_data?.[
              field.id
            ] ??
            '';

          if (
            field.field_type ===
            'boolean'
          ) {

            return `
              <div class="field inline">

                <label>

                  <input
                    id="fcf_${field.id}"
                    type="checkbox"
                    ${value ? 'checked' : ''}>

                  ${esc(field.name)}

                </label>

              </div>
            `;
          }

          if (
            field.field_type ===
            'select'
          ) {

            return `
              <div class="field">

                <label>
                  ${esc(field.name)}
                </label>

                <select id="fcf_${field.id}">

                  <option value=""></option>

                  ${
                    (field.options || [])
                      .map(
                        option =>
                          `
                            <option
                              ${
                                String(option) ===
                                String(value)
                                  ?
                                  'selected'
                                  :
                                  ''
                              }>

                              ${esc(option)}

                            </option>
                          `
                      )
                      .join('')
                  }

                </select>

              </div>
            `;
          }

          const type =
            field.field_type ===
              'date'
              ?
              'date'
              :
            [
              'number',
              'percent'
            ]
              .includes(
                field.field_type
              )
              ?
              'number'
              :
              'text';

          return `
            <div class="field">

              <label>
                ${esc(field.name)}
              </label>

              <input
                id="fcf_${field.id}"
                type="${type}"
                value="${esc(value)}">

            </div>
          `;
        })
        .join('');
}

function readFrontCustom() {

  const result =
    {};

  state.customFields
    .filter(
      field =>
        field.scope ===
        'front'
    )
    .forEach(field => {

      const element =
        $('fcf_' + field.id);

      result[field.id] =
        field.field_type ===
          'boolean'
          ?
          element.checked
          :
          element.value;
    });

  return result;
}

function openFront(id) {

  const front =
    state.fronts
      .find(
        item =>
          item.id === id
      );

  if (!front) {
    return;
  }

  selectedFrontId =
    id;

  $('frontTitle')
    .textContent =
      nameById(
        state.works,
        front.work_id
      );

  $('frontMeta')
    .textContent =
      frontLabel(front);

  fill(
    $('fOrg'),
    [
      {
        id: '',
        name: '—'
      },
      ...state.organizations
    ]
  );

  $('fStatus').value =
    front.status;

  $('fOrg').value =
    front.organization_id ||
    '';

  $('fResponsible').value =
    front.responsible ||
    '';

  $('fContractStart').value =
    front.contract_start ||
    '';

  $('fContractEnd').value =
    front.contract_end ||
    '';

  $('fBaselineStart').value =
    front.baseline_start ||
    '';

  $('fBaselineEnd').value =
    front.baseline_end ||
    '';

  $('fPlanStart').value =
    front.plan_start ||
    '';

  $('fPlanEnd').value =
    front.plan_end ||
    '';

  $('fFactStart').value =
    front.fact_start ||
    '';

  $('fFactEnd').value =
    front.fact_end ||
    '';

  $('fForecastEnd').value =
    front.forecast_end ||
    '';

  $('fUnit').value =
    front.unit ||
    '';

  $('fTotalQty').value =
    front.total_qty ??
    '';

  $('fDoneQty').value =
    front.done_qty ??
    '';

  $('fPeople').value =
    front.current_people ??
    '';

  $('fCompleted').checked =
    !!front.completed;

  $('fPresented').checked =
    !!front.presented;

  $('fAccepted').checked =
    !!front.accepted;

  $('fAcceptedDate').value =
    front.accepted_date ||
    '';

  $('fFactText').value =
    front.fact_text ||
    '';

  $('fConstraint').value =
    front.constraint_text ||
    '';

  renderFrontCustom(
    front
  );

  $('frontEditor')
    .classList
    .remove('hidden');

  $('frontEditor')
    .scrollIntoView({
      behavior: 'smooth'
    });
}

async function logChanges(
  entity,
  id,
  oldRow,
  newRow
) {

  const rows =
    [];

  for (
    const [
      field,
      value
    ]
    of Object.entries(newRow)
  ) {

    if (
      String(
        oldRow[field] ??
        ''
      ) !==
      String(
        value ??
        ''
      )
    ) {

      rows.push({
        entity_type:
          entity,

        entity_id:
          id,

        field_name:
          field,

        old_value:
          String(
            oldRow[field] ??
            ''
          ),

        new_value:
          String(
            value ??
            ''
          ),

        changed_by:
          currentUser.id
      });
    }
  }

  if (
    rows.length
  ) {

    await sb
      .from(
        'change_log'
      )
      .insert(
        rows
      );
  }
}

async function saveFront() {

  const front =
    state.fronts
      .find(
        item =>
          item.id ===
          selectedFrontId
      );

  if (!front) {
    return;
  }

  const update = {

    status:
      $('fStatus').value,

    organization_id:
      $('fOrg').value ||
      null,

    responsible:
      $('fResponsible').value ||
      null,

    contract_start:
      $('fContractStart').value ||
      null,

    contract_end:
      $('fContractEnd').value ||
      null,

    baseline_start:
      $('fBaselineStart').value ||
      null,

    baseline_end:
      $('fBaselineEnd').value ||
      null,

    plan_start:
      $('fPlanStart').value ||
      null,

    plan_end:
      $('fPlanEnd').value ||
      null,

    fact_start:
      $('fFactStart').value ||
      null,

    fact_end:
      $('fFactEnd').value ||
      null,

    forecast_end:
      $('fForecastEnd').value ||
      null,

    unit:
      $('fUnit').value ||
      null,

    total_qty:
      $('fTotalQty').value ===
        ''
        ?
        null
        :
        num(
          $('fTotalQty').value
        ),

    done_qty:
      $('fDoneQty').value ===
        ''
        ?
        null
        :
        num(
          $('fDoneQty').value
        ),

    current_people:
      $('fPeople').value ===
        ''
        ?
        null
        :
        num(
          $('fPeople').value
        ),

    completed:
      $('fCompleted').checked,

    presented:
      $('fPresented').checked,

    accepted:
      $('fAccepted').checked,

    accepted_date:
      $('fAcceptedDate').value ||
      null,

    fact_text:
      $('fFactText').value ||
      null,

    constraint_text:
      $('fConstraint').value ||
      null,

    custom_data:
      readFrontCustom(),

    updated_at:
      new Date()
        .toISOString()
  };

  const {
    error
  } =
    await sb
      .from('fronts')
      .update(update)
      .eq(
        'id',
        front.id
      );

  if (error) {

    alert(
      error.message
    );

    return;
  }

  await logChanges(
    'front',
    front.id,
    front,
    update
  );

  notice(
    'Сохранено · остальные пользователи получат обновление',
    true
  );
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
      front.contract_start,
      front.contract_end
    ];
  }

  if (
    mode ===
    'baseline'
  ) {

    return [
      front.baseline_start,
      front.baseline_end
    ];
  }

  if (
    mode ===
    'fact'
  ) {

    return [
      front.fact_start,
      front.fact_end ||
      front.fact_start
    ];
  }

  if (
    mode ===
    'forecast'
  ) {

    return [
      front.plan_start ||
      front.fact_start,

      front.forecast_end ||
      front.plan_end
    ];
  }

  return [
    front.plan_start,
    front.plan_end
  ];
}

function renderGantt() {

  initSelects();

  const buildingId =
    $('gBuilding').value;

  const workId =
    $('gWork').value;

  const organizationId =
    $('gOrg').value;

  const mode =
    $('gMode').value;

  const items =
    state.fronts
      .map(
        hydrateFront
      )
      .filter(
        front =>
          (
            buildingId ===
              'all' ||
            front.structure
              .building_id ===
              buildingId
          ) &&

          (
            workId ===
              'all' ||
            front.work_id ===
              workId
          ) &&

          (
            organizationId ===
              'all' ||
            front.organization_id ===
              organizationId
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
        `
          <div
            class="muted"
            style="padding:14px">

            Нет заполненных дат
            для выбранного слоя.

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
        .map(item => {

          const front =
            item.front;

          const dates =
            item.dates;

          const left =
            (
              diffDays(
                min,
                dates[0]
              ) /
              total
            ) * 100;

          const width =
            Math.max(
              1,
              (
                (
                  diffDays(
                    dates[0],
                    dates[1]
                  ) + 1
                ) /
                total
              ) * 100
            );

          return `
            <div class="gantt-row">

              <div class="gantt-name">

                <b>
                  ${esc(front.work)}
                </b>

                <br>

                <small>
                  ${esc(frontLabel(front))}
                </small>

              </div>

              <div class="gantt-line">

                <div
                  class="gantt-bar"
                  style="
                    left:${left}%;
                    width:${width}%
                  ">

                  ${dates[0]}
                  →
                  ${dates[1]}

                </div>

              </div>

            </div>
          `;
        })
        .join('');
}

function pfFrontIds() {

  const buildingId =
    $('pfBuilding').value;

  const workId =
    $('pfWork').value;

  const organizationId =
    $('pfOrg').value;

  return new Set(

    state.fronts
      .filter(front => {

        const structure =
          state.structures
            .find(
              item =>
                item.id ===
                front.structure_id
            );

        return (
          (
            buildingId ===
              'all' ||
            structure
              ?.building_id ===
              buildingId
          ) &&

          (
            workId ===
              'all' ||
            front.work_id ===
              workId
          ) &&

          (
            organizationId ===
              'all' ||
            front.organization_id ===
              organizationId
          )
        );
      })
      .map(
        front =>
          front.id
      )
  );
}

function renderPlanFact() {

  initSelects();

  const ids =
    pfFrontIds();

  const from =
    $('pfFrom').value;

  const to =
    $('pfTo').value;

  const planPeriodRows =
    state.planLog
      .filter(
        row =>
          ids.has(
            row.front_id
          ) &&

          (
            !from ||
            row.plan_date >=
              from
          ) &&

          (
            !to ||
            row.plan_date <=
              to
          )
      );

  const factPeriodRows =
    state.factLog
      .filter(
        row =>
          ids.has(
            row.front_id
          ) &&

          (
            !from ||
            row.fact_date >=
              from
          ) &&

          (
            !to ||
            row.fact_date <=
              to
          )
      );

  const planPeriod =
    planPeriodRows
      .reduce(
        (sum, row) =>
          sum +
          num(
            row.planned_qty
          ),
        0
      );

  const factPeriod =
    factPeriodRows
      .reduce(
        (sum, row) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const planCum =
    state.planLog
      .filter(
        row =>
          ids.has(
            row.front_id
          ) &&
          (
            !to ||
            row.plan_date <=
              to
          )
      )
      .reduce(
        (sum, row) =>
          sum +
          num(
            row.planned_qty
          ),
        0
      );

  const factCum =
    state.factLog
      .filter(
        row =>
          ids.has(
            row.front_id
          ) &&
          (
            !to ||
            row.fact_date <=
              to
          )
      )
      .reduce(
        (sum, row) =>
          sum +
          num(
            row.qty
          ),
        0
      );

  const total =
    state.fronts
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
            front.total_qty
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
    fmt(planCum);

  $('pfFactCum').textContent =
    fmt(factCum);

  const planPercent =
    total
      ?
      (
        planCum /
        total *
        100
      )
      :
      0;

  const factPercent =
    total
      ?
      (
        factCum /
        total *
        100
      )
      :
      0;

  $('pfPp').textContent =
    fmt(
      factPercent -
      planPercent
    );

  $('planRows')
    .innerHTML =
      planPeriodRows
        .sort(
          (a, b) =>
            String(
              b.plan_date
            )
              .localeCompare(
                String(
                  a.plan_date
                )
              )
        )
        .map(row => {

          const front =
            state.fronts
              .find(
                item =>
                  item.id ===
                  row.front_id
              );

          return `
            <tr>

              <td>
                ${row.plan_date}
              </td>

              <td>
                ${esc(frontLabel(front))}
              </td>

              <td>
                ${fmt(row.planned_qty)}
              </td>

              <td>
                ${fmt(row.planned_people)}
              </td>

            </tr>
          `;
        })
        .join('');

  $('factRows')
    .innerHTML =
      factPeriodRows
        .sort(
          (a, b) =>
            String(
              b.fact_date
            )
              .localeCompare(
                String(
                  a.fact_date
                )
              )
        )
        .map(row => {

          const front =
            state.fronts
              .find(
                item =>
                  item.id ===
                  row.front_id
              );

          return `
            <tr>

              <td>
                ${row.fact_date}
              </td>

              <td>
                ${esc(frontLabel(front))}
              </td>

              <td>
                ${fmt(row.qty)}
              </td>

              <td>
                ${fmt(row.cumulative_qty)}
              </td>

              <td>
                ${fmt(row.people)}
              </td>

            </tr>
          `;
        })
        .join('');
}

function openLogEditor(mode) {

  logMode =
    mode;

  fill(
    $('logFront'),
    state.fronts
      .map(
        front => ({
          id: front.id,
          name: frontLabel(front)
        })
      )
  );

  $('logDate').value =
    today();

  $('logQty').value =
    '';

  $('logCum').value =
    '';

  $('logPeople').value =
    '';

  $('logComment').value =
    '';

  $('logCum')
    .closest('.field')
    .style.display =
      mode ===
        'fact'
        ?
        ''
        :
        'none';

  $('logEditor')
    .classList
    .remove('hidden');
}

async function saveLog() {

  const frontId =
    $('logFront').value;

  if (
    logMode ===
    'plan'
  ) {

    const {
      error
    } =
      await sb
        .from('plan_log')
        .insert({
          front_id:
            frontId,

          plan_date:
            $('logDate').value,

          planned_qty:
            num(
              $('logQty').value
            ),

          planned_people:
            num(
              $('logPeople').value
            ),

          comment:
            $('logComment').value ||
            null,

          created_by:
            currentUser.id
        });

    if (error) {

      alert(
        error.message
      );

      return;
    }

  } else {

    const {
      error
    } =
      await sb
        .from('fact_log')
        .insert({
          front_id:
            frontId,

          fact_date:
            $('logDate').value,

          qty:
            num(
              $('logQty').value
            ),

          cumulative_qty:
            $('logCum').value ===
              ''
              ?
              null
              :
              num(
                $('logCum').value
              ),

          people:
            num(
              $('logPeople').value
            ),

          comment:
            $('logComment').value ||
            null,

          created_by:
            currentUser.id
        });

    if (error) {

      alert(
        error.message
      );

      return;
    }
  }

  $('logEditor')
    .classList
    .add('hidden');
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

  return state.resourceLog
    .filter(
      row =>
        (
          !from ||
          row.resource_date >=
            from
        ) &&

        (
          !to ||
          row.resource_date <=
            to
        ) &&

        (
          organizationId ===
            'all' ||
          row.organization_id ===
            organizationId
        ) &&

        (
          buildingId ===
            'all' ||
          row.building_id ===
            buildingId
        )
    );
}

function renderResources() {

  initSelects();

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

  rows.forEach(row => {

    daily[
      row.resource_date
    ] =
      (
        daily[
          row.resource_date
        ] ||
        0
      ) +

      num(row.itr) +
      num(row.workers) +
      num(row.mechanizers);
  });

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
    fmt(
      sum(
        'equipment_qty'
      )
    );

  $('resourceRows')
    .innerHTML =
      rows
        .sort(
          (a, b) =>
            String(
              b.resource_date
            )
              .localeCompare(
                String(
                  a.resource_date
                )
              )
        )
        .map(
          row =>
            `
              <tr>

                <td>
                  ${row.resource_date}
                </td>

                <td>
                  ${
                    esc(
                      nameById(
                        state.organizations,
                        row.organization_id
                      )
                    )
                  }
                </td>

                <td>
                  ${
                    esc(
                      nameById(
                        state.buildings,
                        row.building_id
                      )
                    )
                  }
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
                  ${esc(row.equipment_type || '—')}
                </td>

                <td>
                  ${fmt(row.equipment_qty)}
                </td>

                <td>
                  ${esc(row.comment || '')}
                </td>

              </tr>
            `
        )
        .join('');
}

async function saveResource() {

  const payload = {

    resource_date:
      $('reDate').value,

    organization_id:
      $('reOrg').value,

    building_id:
      $('reBuilding').value ||
      null,

    itr:
      num(
        $('reItr').value
      ),

    workers:
      num(
        $('reWorkers').value
      ),

    mechanizers:
      num(
        $('reMech').value
      ),

    equipment_type:
      $('reEquipType').value ||
      null,

    equipment_qty:
      num(
        $('reEquipQty').value
      ),

    comment:
      $('reComment').value ||
      null,

    created_by:
      currentUser.id
  };

  const {
    error
  } =
    await sb
      .from(
        'resource_log'
      )
      .insert(
        payload
      );

  if (error) {

    alert(
      error.message
    );

    return;
  }

  $('resourceEditor')
    .classList
    .add('hidden');
}

function renderMilestones() {

  $('milestoneRows')
    .innerHTML =
      state.milestones
        .map(
          milestone =>
            `
              <tr>

                <td>
                  ${
                    esc(
                      nameById(
                        state.buildings,
                        milestone.building_id
                      )
                    )
                  }
                </td>

                <td>
                  ${esc(milestone.title)}
                </td>

                <td>
                  ${milestone.contract_date || '—'}
                </td>

                <td>
                  ${milestone.work_date || '—'}
                </td>

                <td>
                  ${milestone.forecast_date || '—'}
                </td>

                <td>
                  ${milestone.fact_date || '—'}
                </td>

                <td>

                  <button
                    class="btn small editMs"
                    data-id="${milestone.id}">

                    ${esc(milestone.status)}

                  </button>

                </td>

              </tr>
            `
        )
        .join('');

  document
    .querySelectorAll(
      '.editMs'
    )
    .forEach(button => {

      button.onclick =
        () =>
          openMilestone(
            button.dataset.id
          );
    });
}

function openMilestone(
  id = null
) {

  editingMilestoneId =
    id;

  const milestone =
    state.milestones
      .find(
        item =>
          item.id === id
      ) ||
    {};

  fill(
    $('msBuilding'),
    state.buildings
  );

  $('msBuilding').value =
    milestone.building_id ||
    state.buildings[0]?.id ||
    '';

  $('msTitle').value =
    milestone.title ||
    '';

  $('msContract').value =
    milestone.contract_date ||
    '';

  $('msWork').value =
    milestone.work_date ||
    '';

  $('msForecast').value =
    milestone.forecast_date ||
    '';

  $('msFact').value =
    milestone.fact_date ||
    '';

  $('msStatus').value =
    milestone.status ||
    'Не наступила';

  $('msComment').value =
    milestone.comment ||
    '';

  $('milestoneEditor')
    .classList
    .remove('hidden');
}

async function saveMilestone() {

  const payload = {

    building_id:
      $('msBuilding').value ||
      null,

    title:
      $('msTitle')
        .value
        .trim(),

    contract_date:
      $('msContract').value ||
      null,

    work_date:
      $('msWork').value ||
      null,

    forecast_date:
      $('msForecast').value ||
      null,

    fact_date:
      $('msFact').value ||
      null,

    status:
      $('msStatus').value,

    comment:
      $('msComment').value ||
      null,

    updated_at:
      new Date()
        .toISOString()
  };

  if (
    !payload.title
  ) {

    alert(
      'Укажи наименование ключевой даты'
    );

    return;
  }

  let error;

  if (
    editingMilestoneId
  ) {

    ({
      error
    } =
      await sb
        .from('milestones')
        .update(payload)
        .eq(
          'id',
          editingMilestoneId
        )
    );

  } else {

    ({
      error
    } =
      await sb
        .from('milestones')
        .insert(payload)
    );
  }

  if (error) {

    alert(
      error.message
    );

    return;
  }

  $('milestoneEditor')
    .classList
    .add('hidden');
}

function reportFronts() {

  const buildingId =
    $('repBuilding').value;

  const workId =
    $('repWork').value;

  const organizationId =
    $('repOrg').value;

  const status =
    $('repStatus').value;

  return state.fronts
    .map(
      hydrateFront
    )
    .filter(
      front =>
        (
          buildingId ===
            'all' ||
          front.structure
            .building_id ===
            buildingId
        ) &&

        (
          workId ===
            'all' ||
          front.work_id ===
            workId
        ) &&

        (
          organizationId ===
            'all' ||
          front.organization_id ===
            organizationId
        ) &&

        (
          status ===
            'all' ||
          front.status ===
            status
        )
    );
}

function buildReport() {

  initSelects();

  const buildingId =
    $('repBuilding').value ||
    'all';

  const organizationId =
    $('repOrg').value ||
    'all';

  const fronts =
    reportFronts();

  const ids =
    new Set(
      fronts
        .map(
          front =>
            front.id
        )
    );

  const from =
    $('repFrom').value;

  const to =
    $('repTo').value;

  const inPeriod =
    date =>
      date &&
      (
        !from ||
        date >= from
      ) &&
      (
        !to ||
        date <= to
      );

  let html =
    `
      <p>
        <b>Период:</b>
        ${from || 'с начала'}
        —
        ${to || 'по текущую дату'}
      </p>
    `;

  if (
    $('repIncludePlanFact').checked
  ) {

    const plan =
      state.planLog
        .filter(
          row =>
            ids.has(
              row.front_id
            ) &&
            inPeriod(
              row.plan_date
            )
        )
        .reduce(
          (sum, row) =>
            sum +
            num(
              row.planned_qty
            ),
          0
        );

    const fact =
      state.factLog
        .filter(
          row =>
            ids.has(
              row.front_id
            ) &&
            inPeriod(
              row.fact_date
            )
        )
        .reduce(
          (sum, row) =>
            sum +
            num(
              row.qty
            ),
          0
        );

    html +=
      `
        <div class="report-section">

          <h2>
            План / факт
          </h2>

          <p>
            План:
            <b>${fmt(plan)}</b>

            ·

            Факт:
            <b>${fmt(fact)}</b>

            ·

            Отклонение:
            <b>${fmt(fact - plan)}</b>
          </p>

        </div>
      `;
  }

  if (
    $('repIncludeResources').checked
  ) {

    const resources =
      state.resourceLog
        .filter(
          row =>
            (
              organizationId ===
                'all' ||
              row.organization_id ===
                organizationId
            ) &&

            (
              buildingId ===
                'all' ||
              row.building_id ===
                buildingId
            ) &&

            inPeriod(
              row.resource_date
            )
        );

    const people =
      resources
        .reduce(
          (sum, row) =>
            sum +
            num(row.itr) +
            num(row.workers) +
            num(row.mechanizers),
          0
        );

    const equipment =
      resources
        .reduce(
          (sum, row) =>
            sum +
            num(
              row.equipment_qty
            ),
          0
        );

    html +=
      `
        <div class="report-section">

          <h2>
            Ресурсы
          </h2>

          <p>
            Человеко-дни:
            <b>${people}</b>

            ·

            Технико-дни:
            <b>${fmt(equipment)}</b>
          </p>

        </div>
      `;
  }

  if (
    $('repIncludeMilestones').checked
  ) {

    const milestones =
      state.milestones
        .filter(
          milestone =>
            buildingId ===
              'all' ||
            milestone.building_id ===
              buildingId
        );

    html +=
      `
        <div class="report-section">

          <h2>
            Ключевые даты
          </h2>

          <table>

            <thead>
              <tr>
                <th>Наименование</th>
                <th>Договор</th>
                <th>Прогноз</th>
                <th>Факт</th>
                <th>Статус</th>
              </tr>
            </thead>

            <tbody>

              ${
                milestones
                  .map(
                    milestone =>
                      `
                        <tr>

                          <td>
                            ${esc(milestone.title)}
                          </td>

                          <td>
                            ${milestone.contract_date || '—'}
                          </td>

                          <td>
                            ${milestone.forecast_date || '—'}
                          </td>

                          <td>
                            ${milestone.fact_date || '—'}
                          </td>

                          <td>
                            ${esc(milestone.status)}
                          </td>

                        </tr>
                      `
                  )
                  .join('')
              }

            </tbody>

          </table>

        </div>
      `;
  }

  if (
    $('repIncludeWorks').checked
  ) {

    html +=
      `
        <div class="report-section">

          <h2>
            Работы
          </h2>

          <table>

            <thead>
              <tr>
                <th>Фронт</th>
                <th>Статус</th>
                <th>Организация</th>
                <th>Рабочее окончание</th>
                <th>Прогноз</th>
                <th>Сдано</th>
              </tr>
            </thead>

            <tbody>

              ${
                fronts
                  .map(
                    front =>
                      `
                        <tr>

                          <td>
                            ${esc(frontLabel(front))}
                          </td>

                          <td>
                            ${esc(front.status)}
                          </td>

                          <td>
                            ${esc(front.organization)}
                          </td>

                          <td>
                            ${front.plan_end || '—'}
                          </td>

                          <td>
                            ${front.forecast_end || '—'}
                          </td>

                          <td>
                            ${front.accepted ? 'Да' : 'Нет'}
                          </td>

                        </tr>
                      `
                  )
                  .join('')
              }

            </tbody>

          </table>

        </div>
      `;
  }

  $('reportContent')
    .innerHTML =
      html;
}

function downloadPdf() {

  buildReport();

  const options = {

    margin: 8,

    filename:
      `ACONS_report_${today()}.pdf`,

    image: {
      type: 'jpeg',
      quality: 0.96
    },

    html2canvas: {
      scale: 2,
      useCORS: true
    },

    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape'
    }
  };

  html2pdf()
    .set(options)
    .from(
      $('reportArea')
    )
    .save();
}

async function readImportFile(
  event
) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  const data =
    await file
      .arrayBuffer();

  const workbook =
    XLSX.read(
      data,
      {
        type: 'array',
        cellDates: true
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
          defval: ''
        }
      );

  $('importInfo')
    .classList
    .remove('hidden');

  $('importInfo')
    .textContent =
      `Прочитано строк: ${importRows.length}. Проверь предварительный просмотр.`;

  const headers =
    importRows[0]
      ?
      Object.keys(
        importRows[0]
      )
      :
      [];

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
}

function normalizeDate(value) {

  if (!value) {
    return null;
  }

  if (
    value instanceof Date
  ) {

    return value
      .toISOString()
      .slice(0, 10);
  }

  const string =
    String(value)
      .trim();

  const match =
    string.match(
      /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/
    );

  if (match) {

    const year =
      match[3].length ===
        2
        ?
        '20' +
        match[3]
        :
        match[3];

    return (
      year +
      '-' +
      match[2]
        .padStart(
          2,
          '0'
        ) +
      '-' +
      match[1]
        .padStart(
          2,
          '0'
        )
    );
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(string)
  ) {

    return string;
  }

  return null;
}

async function ensureNamed(
  table,
  name
) {

  if (!name) {
    return null;
  }

  const list =
    state[
      table ===
        'buildings'
        ?
        'buildings'
        :
      table ===
        'works'
        ?
        'works'
        :
        'organizations'
    ];

  const existing =
    list.find(
      item =>
        item.name === name
    );

  if (existing) {

    return existing.id;
  }

  const {
    data,
    error
  } =
    await sb
      .from(table)
      .insert({
        name
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  list.push(
    data
  );

  return data.id;
}

async function commitImport() {

  if (
    !importRows.length
  ) {
    return;
  }

  if (
    ![
      'admin',
      'planner'
    ]
      .includes(
        profile?.role
      )
  ) {

    alert(
      'Импорт структуры доступен администратору или планировщику.'
    );

    return;
  }

  $('commitImportBtn')
    .disabled =
      true;

  try {

    let created = 0;
    let updated = 0;

    for (
      const row
      of importRows
    ) {

      const building =
        String(
          row['Здание'] ||
          ''
        )
          .trim();

      const work =
        String(
          row['Работа'] ||
          ''
        )
          .trim();

      if (
        !building ||
        !work
      ) {

        continue;
      }

      const buildingId =
        await ensureNamed(
          'buildings',
          building
        );

      const workId =
        await ensureNamed(
          'works',
          work
        );

      const organizationId =
        await ensureNamed(
          'organizations',
          String(
            row['Организация'] ||
            ''
          )
            .trim()
        );

      const structurePayload = {

        building_id:
          buildingId,

        block_name:
          String(
            row['Блок'] ||
            ''
          )
            .trim() ||
          null,

        floor_no:
          row['Этаж'] ===
            ''
            ?
            null
            :
            num(
              row['Этаж']
            ),

        capture_name:
          String(
            row['Захватка'] ||
            ''
          )
            .trim() ||
          null,

        axis_name:
          String(
            row['Ось'] ||
            ''
          )
            .trim() ||
          null,

        side_name:
          String(
            row['Сторона'] ||
            ''
          )
            .trim() ||
          null,

        zone_name:
          String(
            row['Зона'] ||
            ''
          )
            .trim() ||
          null,

        room_number:
          String(
            row['Номер помещения'] ||
            ''
          )
            .trim() ||
          null,

        room_name:
          String(
            row['Название помещения'] ||
            ''
          )
            .trim() ||
          null,

        equipment_name:
          String(
            row['Оборудование'] ||
            ''
          )
            .trim() ||
          null
      };

      let query =
        sb
          .from('structures')
          .select('*')
          .eq(
            'building_id',
            buildingId
          );

      for (
        const [
          field,
          value
        ]
        of Object.entries(
          structurePayload
        )
      ) {

        if (
          field ===
          'building_id'
        ) {
          continue;
        }

        query =
          value === null
            ?
            query.is(
              field,
              null
            )
            :
            query.eq(
              field,
              value
            );
      }

      const {
        data: found
      } =
        await query
          .limit(1);

      let structureId =
        found?.[0]?.id;

      if (
        !structureId
      ) {

        const insert =
          await sb
            .from('structures')
            .insert(
              structurePayload
            )
            .select()
            .single();

        if (
          insert.error
        ) {
          throw insert.error;
        }

        structureId =
          insert.data.id;
      }

      const frontPayload = {

        structure_id:
          structureId,

        work_id:
          workId,

        organization_id:
          organizationId,

        contract_start:
          normalizeDate(
            row['Договорное начало']
          ),

        contract_end:
          normalizeDate(
            row['Договорное окончание']
          ),

        baseline_start:
          normalizeDate(
            row['Базовое начало']
          ),

        baseline_end:
          normalizeDate(
            row['Базовое окончание']
          ),

        plan_start:
          normalizeDate(
            row['Рабочее начало']
          ),

        plan_end:
          normalizeDate(
            row['Рабочее окончание']
          ),

        total_qty:
          row['Общий объем'] ===
            ''
            ?
            null
            :
            num(
              row['Общий объем']
            ),

        unit:
          String(
            row['Ед. изм.'] ||
            ''
          )
            .trim() ||
          null
      };

      const existing =
        await sb
          .from('fronts')
          .select('id')
          .eq(
            'structure_id',
            structureId
          )
          .eq(
            'work_id',
            workId
          )
          .maybeSingle();

      if (
        existing.data?.id
      ) {

        const update =
          await sb
            .from('fronts')
            .update(
              frontPayload
            )
            .eq(
              'id',
              existing.data.id
            );

        if (
          update.error
        ) {
          throw update.error;
        }

        updated++;

      } else {

        const insert =
          await sb
            .from('fronts')
            .insert(
              frontPayload
            );

        if (
          insert.error
        ) {
          throw insert.error;
        }

        created++;
      }
    }

    $('importInfo')
      .textContent =
        `Импорт завершен. Создано фронтов: ${created}, обновлено: ${updated}.`;

    importRows =
      [];

    $('commitImportBtn')
      .disabled =
        true;

    await reloadAll();

  } catch (error) {

    alert(
      'Ошибка импорта: ' +
      error.message
    );

  } finally {

    $('commitImportBtn')
      .disabled =
        false;
  }
}

function renderHistory() {

  $('historyRows')
    .innerHTML =
      [...state.history]
        .sort(
          (a, b) =>
            String(
              b.changed_at
            )
              .localeCompare(
                String(
                  a.changed_at
                )
              )
        )
        .slice(
          0,
          500
        )
        .map(history => {

          const user =
            state.users
              .find(
                item =>
                  item.id ===
                  history.changed_by
              );

          return `
            <tr>

              <td>
                ${
                  new Date(
                    history.changed_at
                  )
                    .toLocaleString(
                      'ru-RU'
                    )
                }
              </td>

              <td>
                ${
                  esc(
                    user?.email ||
                    history.changed_by ||
                    ''
                  )
                }
              </td>

              <td>
                ${esc(history.entity_type)}
              </td>

              <td>
                ${esc(history.field_name)}
              </td>

              <td>
                ${esc(history.old_value)}
              </td>

              <td>
                ${esc(history.new_value)}
              </td>

            </tr>
          `;
        })
        .join('');
}

function renderSettings() {

  initSelects();

  $('buildingList')
    .innerHTML =
      state.buildings
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
      state.works
        .map(
          item =>
            `
              <div class="item">
                <span>${esc(item.name)}</span>
              </div>
            `
        )
        .join('');

  $('orgList')
    .innerHTML =
      state.organizations
        .map(
          item =>
            `
              <div class="item">
                <span>${esc(item.name)}</span>
              </div>
            `
        )
        .join('');

  $('customFieldList')
    .innerHTML =
      state.customFields
        .map(
          item =>
            `
              <div class="item">

                <span>
                  ${esc(item.name)}
                  ·
                  ${esc(item.scope)}
                  ·
                  ${esc(item.field_type)}
                </span>

              </div>
            `
        )
        .join('');
}

async function addSimple(
  table,
  name
) {

  if (!name) {
    return;
  }

  const {
    error
  } =
    await sb
      .from(table)
      .insert({
        name
      });

  if (error) {

    alert(
      error.message
    );

    return;
  }

  if (
    table ===
    'buildings'
  ) {
    $('newBuilding').value =
      '';
  }

  if (
    table ===
    'works'
  ) {
    $('newWork').value =
      '';
  }

  if (
    table ===
    'organizations'
  ) {
    $('newOrg').value =
      '';
  }
}

async function addCustomField() {

  const name =
    $('cfName')
      .value
      .trim();

  if (!name) {
    return;
  }

  const type =
    $('cfType').value;

  const options =
    type ===
      'select'
      ?
      $('cfOptions')
        .value
        .split(';')
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
      :
      [];

  const {
    error
  } =
    await sb
      .from(
        'custom_fields'
      )
      .insert({
        name,

        scope:
          $('cfScope').value,

        field_type:
          type,

        options
      });

  if (error) {

    alert(
      error.message
    );

    return;
  }

  $('cfName').value =
    '';

  $('cfOptions').value =
    '';
}

async function addStructure() {

  const payload = {

    building_id:
      $('sBuilding').value,

    block_name:
      $('sBlock').value ||
      null,

    floor_no:
      $('sFloor').value ===
        ''
        ?
        null
        :
        num(
          $('sFloor').value
        ),

    capture_name:
      $('sCapture').value ||
      null,

    axis_name:
      $('sAxis').value ||
      null,

    side_name:
      $('sSide').value ||
      null,

    zone_name:
      $('sZone').value ||
      null,

    room_number:
      $('sRoomNo').value ||
      null,

    room_name:
      $('sRoomName').value ||
      null,

    equipment_name:
      $('sEquipment').value ||
      null
  };

  const {
    data,
    error
  } =
    await sb
      .from(
        'structures'
      )
      .insert(
        payload
      )
      .select()
      .single();

  if (error) {

    alert(
      error.message
    );

    return;
  }

  const workIds =
    $('sWorkMode').value ===
      'all'
      ?
      state.works
        .map(
          work =>
            work.id
        )
      :
      [
        $('sWork').value
      ];

  const rows =
    workIds
      .map(
        work_id => ({
          structure_id:
            data.id,

          work_id
        })
      );

  const insert =
    await sb
      .from('fronts')
      .insert(rows);

  if (
    insert.error
  ) {

    alert(
      insert.error.message
    );
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

  renderSettings();

  renderHistory();

  buildReport();
}

document.addEventListener(
  'DOMContentLoaded',
  () => {

    init()
      .catch(error => {

        console.error(
          error
        );

        showBootError(
          error.message
        );
      });
  }
);