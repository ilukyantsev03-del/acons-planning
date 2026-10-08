'use strict';

/* =========================================================
   LIV Planning
   UNIVERSAL VIEW BUILDER
   Конструктор представлений + печать/PDF
   ========================================================= */

let livViewBuilderInitialized = false;
let livViewRegistry = new Map();
let livPrintFrame = null;


/* =========================================================
   БАЗОВЫЕ ПОМОЩНИКИ
   ========================================================= */

function livVBArray(value) {
  return Array.isArray(value) ? value : [];
}


function livVBClone(value) {

  try {

    return clone(
      value
    );

  } catch (
    error
  ) {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );
  }
}


function livVBKey(value) {

  return (
    normKey(
      String(
        value ||
        ''
      )
    ) ||
    'item'
  );
}


function livVBText(value) {

  return String(
    value ??
    ''
  )
    .trim();
}


function livVBHasOwn(
  object,
  key
) {

  return Object.prototype
    .hasOwnProperty
    .call(
      object ||
      {},
      key
    );
}


function livVBMove(
  array,
  fromIndex,
  toIndex
) {

  const result =
    [
      ...array
    ];


  if (
    fromIndex <
      0 ||
    toIndex <
      0 ||
    fromIndex >=
      result.length ||
    toIndex >=
      result.length ||
    fromIndex ===
      toIndex
  ) {

    return result;
  }


  const [
    item
  ] =
    result.splice(
      fromIndex,
      1
    );


  result.splice(
    toIndex,
    0,
    item
  );


  return result;
}


function livVBEnsureProjectState() {

  if (
    !project
  ) {
    return;
  }


  if (
    !project.viewBuilder ||
    typeof project.viewBuilder !==
      'object' ||
    Array.isArray(
      project.viewBuilder
    )
  ) {

    project.viewBuilder =
      {};
  }


  if (
    !project.viewBuilder.views ||
    typeof project.viewBuilder.views !==
      'object' ||
    Array.isArray(
      project.viewBuilder.views
    )
  ) {

    project.viewBuilder.views =
      {};
  }


  if (
    !Array.isArray(
      project.viewBuilder.profiles
    )
  ) {

    project.viewBuilder.profiles =
      [];
  }
}


/* =========================================================
   РЕЕСТР ДЛЯ БУДУЩИХ МОДУЛЕЙ
   ========================================================= */

function livRegisterViewSchema(
  viewKey,
  schema
) {

  if (
    !viewKey ||
    !schema
  ) {
    return;
  }


  livViewRegistry.set(
    String(
      viewKey
    ),
    livVBClone(
      schema
    )
  );
}


function livGetRegisteredViewSchema(
  viewKey
) {

  return (
    livViewRegistry.get(
      String(
        viewKey
      )
    ) ||
    null
  );
}


window.LIV_VIEW_BUILDER =
  window.LIV_VIEW_BUILDER ||
  {};


window.LIV_VIEW_BUILDER.register =
  livRegisterViewSchema;


window.LIV_VIEW_BUILDER.get =
  livGetRegisteredViewSchema;


/* =========================================================
   ТЕКУЩИЙ РАЗДЕЛ / РЕЖИМ
   ========================================================= */

function livActiveMainTab() {

  return (
    document
      .querySelector(
        '.tab.active[data-tab]'
      )
      ?.dataset
      .tab ||
    'dashboard'
  );
}


function livActiveResourceView() {

  return (
    document
      .querySelector(
        '.resource-tab.active[data-rview]'
      )
      ?.dataset
      .rview ||
    'journal'
  );
}


function livCurrentViewKey() {

  const tab =
    livActiveMainTab();


  if (
    tab ===
    'resources'
  ) {

    return (
      `resources:${livActiveResourceView()}`
    );
  }


  return tab;
}


function livCurrentPanel() {

  const tab =
    livActiveMainTab();


  if (
    tab ===
    'resources'
  ) {

    return (
      $(
        `rview-${livActiveResourceView()}`
      ) ||
      $('tab-resources')
    );
  }


  return $(
    `tab-${tab}`
  );
}


function livMainTabTitle(
  tab
) {

  const map = {

    dashboard:
      'Сводка проекта',

    matrix:
      'Шахматка',

    gantt:
      'График производства работ',

    planfact:
      'План / факт',

    resources:
      'Ресурсы',

    organizations:
      'Карточка организации',

    milestones:
      'Ключевые даты',

    elements:
      'Номерные элементы',

    demolition:
      'Демонтаж',

    import:
      'Импорт',

    history:
      'История изменений',

    settings:
      'Настройки'
  };


  if (
    String(
      tab
    )
      .startsWith(
        'custom-'
      )
  ) {

    const id =
      String(
        tab
      )
        .replace(
          'custom-',
          ''
        );


    return (
      byId(
        project.customSections ||
        [],
        id
      )
        ?.name ||
      'Пользовательский раздел'
    );
  }


  return (
    map[
      tab
    ] ||
    tab
  );
}


function livResourceViewTitle(
  view
) {

  const map = {

    journal:
      'Журнал ресурсов',

    daily:
      'Ежедневная сводка ресурсов',

    dynamics:
      'Динамика ресурсов',

    analytics:
      'Аналитика ресурсов',

    planfact:
      'План / факт ресурсов'
  };


  return (
    map[
      view
    ] ||
    'Ресурсы'
  );
}


function livReportTitle() {

  const tab =
    livActiveMainTab();


  return (
    tab ===
    'resources'
      ? livResourceViewTitle(
          livActiveResourceView()
        )
      : livMainTabTitle(
          tab
        )
  );
}


/* =========================================================
   НАСТРОЙКИ ПРЕДСТАВЛЕНИЯ
   ========================================================= */

function livDefaultViewSettings() {

  return {

    hiddenModes:
      [],

    hiddenFilters:
      [],

    hiddenBlocks:
      [],

    blockOrder:
      [],

    tables:
      {},

    print: {

      orientation:
        'landscape',

      showHeader:
        true,

      showFilters:
        true,

      showKpi:
        true,

      showFooter:
        true,

      compact:
        false
    }
  };
}


function livViewSettings(
  viewKey =
    livCurrentViewKey()
) {

  livVBEnsureProjectState();


  if (
    !project.viewBuilder
      .views[
        viewKey
      ]
  ) {

    project.viewBuilder
      .views[
        viewKey
      ] =
        livDefaultViewSettings();
  }


  const current =
    project.viewBuilder
      .views[
        viewKey
      ];


  const defaults =
    livDefaultViewSettings();


  project.viewBuilder
    .views[
      viewKey
    ] = {

      ...defaults,

      ...current,

      print: {

        ...defaults.print,

        ...(
          current.print ||
          {}
        )
      },

      hiddenModes:
        livVBArray(
          current.hiddenModes
        ),

      hiddenFilters:
        livVBArray(
          current.hiddenFilters
        ),

      hiddenBlocks:
        livVBArray(
          current.hiddenBlocks
        ),

      blockOrder:
        livVBArray(
          current.blockOrder
        ),

      tables:
        current.tables &&
        typeof current.tables ===
          'object'
          ? current.tables
          : {}
    };


  return project.viewBuilder
    .views[
      viewKey
    ];
}


/* =========================================================
   ОБНАРУЖЕНИЕ ФИЛЬТРОВ
   ========================================================= */

function livFilterKey(
  element,
  index
) {

  if (
    element.id
  ) {

    return (
      `id:${element.id}`
    );
  }


  const control =
    element.querySelector(
      'input,select,textarea,button'
    );


  if (
    control?.id
  ) {

    return (
      `control:${control.id}`
    );
  }


  const label =
    livVBText(
      element
        .querySelector(
          'label'
        )
        ?.textContent ||
      element.textContent
    );


  return (
    `filter:${livVBKey(label)}:${index}`
  );
}


function livFilterTitle(
  element,
  index
) {

  const label =
    livVBText(
      element
        .querySelector(
          'label'
        )
        ?.textContent
    );


  if (
    label
  ) {

    return label;
  }


  if (
    element.classList
      .contains(
        'switch-line'
      )
  ) {

    return (
      livVBText(
        element.textContent
      ) ||
      `Переключатель ${index + 1}`
    );
  }


  return (
    `Фильтр ${index + 1}`
  );
}


function livDiscoverFilters() {

  const tab =
    livActiveMainTab();


  const panel =
    tab ===
      'resources'
      ? $('tab-resources')
      : livCurrentPanel();


  if (
    !panel
  ) {

    return [];
  }


  const selectors = [

    '.resource-toolbar .field',

    '.resource-toolbar .switch-line',

    '.toolbar .field',

    '.section-toolbar.no-print .field',

    '.organization-picker .field'
  ];


  const elements =
    [
      ...panel.querySelectorAll(
        selectors.join(
          ','
        )
      )
    ];


  const seen =
    new Set();


  return elements
    .map(
      (
        element,
        index
      ) => {

        const key =
          livFilterKey(
            element,
            index
          );


        if (
          seen.has(
            key
          )
        ) {

          return null;
        }


        seen.add(
          key
        );


        element.dataset
          .livFilterKey =
            key;


        return {

          key,

          title:
            livFilterTitle(
              element,
              index
            ),

          element
        };
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   ОБНАРУЖЕНИЕ РЕЖИМОВ
   ========================================================= */

function livDiscoverModes() {

  if (
    livActiveMainTab() !==
    'resources'
  ) {

    return [];
  }


  return [
    ...document.querySelectorAll(
      '[data-rview]'
    )
  ]
    .map(
      button => ({

        key:
          button.dataset
            .rview,

        title:
          livVBText(
            button.textContent
          ),

        element:
          button
      })
    );
}


/* =========================================================
   ОБНАРУЖЕНИЕ БЛОКОВ
   ========================================================= */

function livBlockTitle(
  element,
  index
) {

  if (
    element.dataset
      .livTitle
  ) {

    return element.dataset
      .livTitle;
  }


  const heading =
    livVBText(
      element
        .querySelector(
          ':scope > h1, :scope > h2, :scope > h3'
        )
        ?.textContent
    );


  if (
    heading
  ) {

    return heading;
  }


  if (
    element.classList
      .contains(
        'stats'
      )
  ) {

    return 'Ключевые показатели';
  }


  if (
    element.classList
      .contains(
        'resource-chart-grid'
      )
  ) {

    return 'Диаграммы';
  }


  if (
    element.classList
      .contains(
        'chart-box-large'
      )
  ) {

    return 'Диаграмма';
  }


  if (
    element.classList
      .contains(
        'grid2'
      )
  ) {

    return 'Блок из двух колонок';
  }


  if (
    element.classList
      .contains(
        'grid3'
      )
  ) {

    return 'Блок из трех колонок';
  }


  const tableHeading =
    livVBText(
      element
        .closest(
          '.card'
        )
        ?.querySelector(
          'h2'
        )
        ?.textContent
    );


  if (
    tableHeading
  ) {

    return tableHeading;
  }


  return (
    `Блок ${index + 1}`
  );
}


function livBlockKey(
  element,
  index
) {

  if (
    element.id
  ) {

    return (
      `id:${element.id}`
    );
  }


  const heading =
    livBlockTitle(
      element,
      index
    );


  return (
    `block:${livVBKey(heading)}:${index}`
  );
}


function livDiscoverBlocks() {

  const panel =
    livCurrentPanel();


  if (
    !panel
  ) {

    return [];
  }


  let candidates =
    [
      ...panel.children
    ]
      .filter(
        element =>
          element.matches(
            '.card,.stats,.grid2,.grid3,.resource-chart-grid,.chart-box-large'
          )
      );


  if (
    !candidates.length
  ) {

    candidates =
      [
        ...panel.querySelectorAll(
          ':scope > .card,:scope > .stats,:scope > .grid2,:scope > .grid3,:scope > .resource-chart-grid,:scope > .chart-box-large'
        )
      ];
  }


  return candidates
    .map(
      (
        element,
        index
      ) => {

        const key =
          livBlockKey(
            element,
            index
          );


        element.dataset
          .livBlockKey =
            key;


        return {

          key,

          title:
            livBlockTitle(
              element,
              index
            ),

          element
        };
      }
    );
}


/* =========================================================
   ОБНАРУЖЕНИЕ ТАБЛИЦ И КОЛОНОК
   ========================================================= */

function livTableTitle(
  table,
  index
) {

  if (
    table.dataset
      .livTitle
  ) {

    return table.dataset
      .livTitle;
  }


  const card =
    table.closest(
      '.card'
    );


  const heading =
    livVBText(
      card
        ?.querySelector(
          'h2,h3'
        )
        ?.textContent
    );


  if (
    heading
  ) {

    return heading;
  }


  return (
    `Таблица ${index + 1}`
  );
}


function livTableKey(
  table,
  index
) {

  if (
    table.id
  ) {

    return (
      `id:${table.id}`
    );
  }


  const headId =
    table.querySelector(
      'thead'
    )
      ?.id;


  if (
    headId
  ) {

    return (
      `head:${headId}`
    );
  }


  const bodyId =
    table.querySelector(
      'tbody'
    )
      ?.id;


  if (
    bodyId
  ) {

    return (
      `body:${bodyId}`
    );
  }


  return (
    `table:${livVBKey(
      livTableTitle(
        table,
        index
      )
    )}:${index}`
  );
}


function livColumnKey(
  th,
  index
) {

  if (
    th.dataset
      .livColumnKey
  ) {

    return th.dataset
      .livColumnKey;
  }


  const text =
    livVBText(
      th.textContent
    );


  return (
    text
      ? `col:${livVBKey(text)}`
      : `col:index-${index}`
  );
}


function livDiscoverTables() {

  const panel =
    livCurrentPanel();


  if (
    !panel
  ) {

    return [];
  }


  return [
    ...panel.querySelectorAll(
      'table'
    )
  ]
    .map(
      (
        table,
        tableIndex
      ) => {

        const key =
          livTableKey(
            table,
            tableIndex
          );


        table.dataset
          .livTableKey =
            key;


        const headerRow =
          table.querySelector(
            'thead tr'
          );


        const headers =
          headerRow
            ? [
                ...headerRow.children
              ]
            : [];


        const columns =
          headers.map(
            (
              th,
              columnIndex
            ) => {

              const columnKey =
                livColumnKey(
                  th,
                  columnIndex
                );


              th.dataset
                .livColumnKey =
                  columnKey;


              return {

                key:
                  columnKey,

                title:
                  livVBText(
                    th.textContent
                  ) ||
                  `Колонка ${columnIndex + 1}`,

                sourceIndex:
                  columnIndex
              };
            }
          );


        return {

          key,

          title:
            livTableTitle(
              table,
              tableIndex
            ),

          table,

          columns
        };
      }
    );
}


/* =========================================================
   ПРИМЕНЕНИЕ ВИДИМОСТИ И ПОРЯДКА БЛОКОВ
   ========================================================= */

function livApplyBlocks(
  settings
) {

  const blocks =
    livDiscoverBlocks();


  const hidden =
    new Set(
      settings.hiddenBlocks ||
      []
    );


  blocks.forEach(
    item => {

      item.element
        .classList
        .toggle(
          'liv-builder-hidden',
          hidden.has(
            item.key
          )
        );
    }
  );


  const order =
    settings.blockOrder ||
    [];


  if (
    !order.length
  ) {

    return;
  }


  const byKey =
    new Map(
      blocks.map(
        item => [
          item.key,
          item
        ]
      )
    );


  const parent =
    blocks[
      0
    ]
      ?.element
      .parentElement;


  if (
    !parent
  ) {

    return;
  }


  order.forEach(
    key => {

      const item =
        byKey.get(
          key
        );


      if (
        item &&
        item.element
          .parentElement ===
          parent
      ) {

        parent.appendChild(
          item.element
        );
      }
    }
  );
}


/* =========================================================
   ПРИМЕНЕНИЕ ФИЛЬТРОВ
   ========================================================= */

function livApplyFilters(
  settings
) {

  const hidden =
    new Set(
      settings.hiddenFilters ||
      []
    );


  livDiscoverFilters()
    .forEach(
      item => {

        item.element
          .classList
          .toggle(
            'liv-builder-hidden',
            hidden.has(
              item.key
            )
          );
      }
    );
}


/* =========================================================
   ПРИМЕНЕНИЕ РЕЖИМОВ
   ========================================================= */

function livApplyModes(
  settings
) {

  const modes =
    livDiscoverModes();


  if (
    !modes.length
  ) {

    return;
  }


  const hidden =
    new Set(
      settings.hiddenModes ||
      []
    );


  modes.forEach(
    item => {

      item.element
        .classList
        .toggle(
          'liv-mode-hidden',
          hidden.has(
            item.key
          )
        );
    }
  );


  const active =
    livActiveResourceView();


  if (
    !hidden.has(
      active
    )
  ) {

    return;
  }


  const firstVisible =
    modes.find(
      item =>
        !hidden.has(
          item.key
        )
    );


  if (
    firstVisible &&
    typeof switchResourceView ===
      'function'
  ) {

    switchResourceView(
      firstVisible.key
    );
  }
}


/* =========================================================
   ПРИМЕНЕНИЕ ТАБЛИЧНЫХ КОЛОНОК
   ========================================================= */

function livApplyTableColumns(
  tableInfo,
  tableSettings
) {

  const table =
    tableInfo.table;


  if (
    !table
  ) {

    return;
  }


  const hidden =
    new Set(
      livVBArray(
        tableSettings
          ?.hiddenColumns
      )
    );


  const requestedOrder =
    livVBArray(
      tableSettings
        ?.columnOrder
    );


  const headerRow =
    table.querySelector(
      'thead tr'
    );


  if (
    !headerRow
  ) {

    return;
  }


  const currentHeaders =
    [
      ...headerRow.children
    ];


  const currentKeys =
    currentHeaders.map(
      (
        th,
        index
      ) => {

        const key =
          th.dataset
            .livColumnKey ||
          livColumnKey(
            th,
            index
          );


        th.dataset
          .livColumnKey =
            key;


        return key;
      }
    );


  const fullOrder = [

    ...requestedOrder
      .filter(
        key =>
          currentKeys.includes(
            key
          )
      ),

    ...currentKeys
      .filter(
        key =>
          !requestedOrder.includes(
            key
          )
      )
  ];


  const rowGroups = [

    headerRow,

    ...table.querySelectorAll(
      'tbody tr'
    ),

    ...table.querySelectorAll(
      'tfoot tr'
    )
  ];


  rowGroups.forEach(
    row => {

      const cells =
        [
          ...row.children
        ];


      if (
        !cells.length
      ) {
        return;
      }


      const map =
        new Map();


      currentKeys.forEach(
        (
          key,
          index
        ) => {

          if (
            cells[
              index
            ]
          ) {

            map.set(
              key,
              cells[
                index
              ]
            );
          }
        }
      );


      fullOrder.forEach(
        key => {

          const cell =
            map.get(
              key
            );


          if (
            cell
          ) {

            row.appendChild(
              cell
            );
          }
        }
      );
    }
  );


  const finalHeaderCells =
    [
      ...headerRow.children
    ];


  finalHeaderCells.forEach(
    th => {

      const key =
        th.dataset
          .livColumnKey;


      const hiddenColumn =
        hidden.has(
          key
        );


      const index =
        [
          ...headerRow.children
        ]
          .indexOf(
            th
          );


      th.classList
        .toggle(
          'liv-column-hidden',
          hiddenColumn
        );


      table
        .querySelectorAll(
          'tbody tr,tfoot tr'
        )
        .forEach(
          row => {

            const cell =
              row.children[
                index
              ];


            if (
              cell
            ) {

              cell.classList
                .toggle(
                  'liv-column-hidden',
                  hiddenColumn
                );
            }
          }
        );
    }
  );
}


function livApplyTables(
  settings
) {

  livDiscoverTables()
    .forEach(
      tableInfo => {

        const tableSettings =
          settings.tables
            ?.[
              tableInfo.key
            ] ||
          {};


        livApplyTableColumns(
          tableInfo,
          tableSettings
        );
      }
    );
}


/* =========================================================
   ГЛАВНОЕ ПРИМЕНЕНИЕ КОНСТРУКТОРА
   ========================================================= */

function livApplyViewConstructor() {

  if (
    !project
  ) {

    return;
  }


  document
    .querySelectorAll(
      '.liv-builder-hidden,.liv-mode-hidden,.liv-column-hidden'
    )
    .forEach(
      element => {

        element.classList
          .remove(
            'liv-builder-hidden',
            'liv-mode-hidden',
            'liv-column-hidden'
          );
      }
    );


  const settings =
    livViewSettings();


  livApplyModes(
    settings
  );


  livApplyFilters(
    settings
  );


  livApplyBlocks(
    settings
  );


  livApplyTables(
    settings
  );
}


/* =========================================================
   HTML СТРОК КОНСТРУКТОРА
   ========================================================= */

function livBuilderRow({
  key,
  title,
  checked,
  type,
  allowMove =
    true
}) {

  return `
    <div
      class="liv-builder-row"
      data-builder-row="${esc(type)}:${esc(key)}">

      <label class="liv-builder-check">

        <input
          type="checkbox"
          data-builder-type="${esc(type)}"
          data-builder-key="${esc(key)}"
          ${
            checked
              ? 'checked'
              : ''
          }
        >

        <span>
          ${esc(title)}
        </span>

      </label>


      ${
        allowMove
          ? `
              <div class="liv-builder-row-actions">

                <button
                  type="button"
                  class="liv-builder-arrow"
                  data-builder-up
                  title="Выше">
                  ↑
                </button>

                <button
                  type="button"
                  class="liv-builder-arrow"
                  data-builder-down
                  title="Ниже">
                  ↓
                </button>

              </div>
            `
          : ''
      }

    </div>
  `;
}


/* =========================================================
   ТАБЛИЦА В КОНСТРУКТОРЕ
   ========================================================= */

function livBuilderTableHtml(
  tableInfo,
  settings
) {

  const tableSettings =
    settings.tables
      ?.[
        tableInfo.key
      ] ||
    {};


  const hidden =
    new Set(
      livVBArray(
        tableSettings
          .hiddenColumns
      )
    );


  const order =
    livVBArray(
      tableSettings
        .columnOrder
    );


  const columnsByKey =
    new Map(
      tableInfo.columns
        .map(
          item => [
            item.key,
            item
          ]
        )
    );


  const ordered = [

    ...order
      .filter(
        key =>
          columnsByKey.has(
            key
          )
      )
      .map(
        key =>
          columnsByKey.get(
            key
          )
      ),

    ...tableInfo.columns
      .filter(
        item =>
          !order.includes(
            item.key
          )
      )
  ];


  return `
    <div
      class="liv-builder-table-card"
      data-builder-table="${esc(tableInfo.key)}">

      <div class="liv-builder-table-title">
        ${esc(tableInfo.title)}
      </div>


      <div class="liv-builder-table-columns">

        ${
          ordered
            .map(
              column =>
                livBuilderRow({

                  key:
                    column.key,

                  title:
                    column.title,

                  checked:
                    !hidden.has(
                      column.key
                    ),

                  type:
                    `column|${tableInfo.key}`,

                  allowMove:
                    true
                })
            )
            .join('')
        }

      </div>

    </div>
  `;
}


/* =========================================================
   СОХРАНЕННЫЕ ПРЕДСТАВЛЕНИЯ
   ========================================================= */

function livProfilesForCurrentView() {

  livVBEnsureProjectState();


  const key =
    livCurrentViewKey();


  return (
    project.viewBuilder
      .profiles ||
    []
  )
    .filter(
      item =>
        item.viewKey ===
        key
    );
}


async function livSaveNamedProfile() {

  const name =
    prompt(
      'Название представления:',
      livReportTitle()
    );


  if (
    !name
  ) {

    return;
  }


  livVBEnsureProjectState();


  project.viewBuilder
    .profiles
    .push({

      id:
        uid(
          'VIEW'
        ),

      viewKey:
        livCurrentViewKey(),

      name:
        name.trim(),

      settings:
        livVBClone(
          livViewSettings()
        ),

      createdAt:
        nowIso(),

      updatedAt:
        nowIso()
    });


  log(
    'Создано',
    'Представление',
    name.trim()
  );


  await saveProject();


  livOpenViewBuilder();
}


async function livLoadProfile(
  profileId
) {

  livVBEnsureProjectState();


  const profile =
    (
      project.viewBuilder
        .profiles ||
      []
    )
      .find(
        item =>
          item.id ===
          profileId
      );


  if (
    !profile
  ) {

    return;
  }


  project.viewBuilder
    .views[
      profile.viewKey
    ] =
      livVBClone(
        profile.settings
      );


  await saveProject();


  closeModal();


  livApplyViewConstructor();
}


async function livDeleteProfile(
  profileId
) {

  livVBEnsureProjectState();


  const profile =
    (
      project.viewBuilder
        .profiles ||
      []
    )
      .find(
        item =>
          item.id ===
          profileId
      );


  if (
    !profile
  ) {

    return;
  }


  if (
    !confirm(
      `Удалить представление «${profile.name}»?`
    )
  ) {

    return;
  }


  project.viewBuilder.profiles =
    project.viewBuilder
      .profiles
      .filter(
        item =>
          item.id !==
          profileId
      );


  await saveProject();


  livOpenViewBuilder();
}


/* =========================================================
   ОТКРЫТИЕ КОНСТРУКТОРА
   ========================================================= */

function livOpenViewBuilder() {

  const settings =
    livViewSettings();


  const modes =
    livDiscoverModes();


  const filters =
    livDiscoverFilters();


  const blocks =
    livDiscoverBlocks();


  const tables =
    livDiscoverTables();


  const profiles =
    livProfilesForCurrentView();


  const hiddenModes =
    new Set(
      settings.hiddenModes ||
      []
    );


  const hiddenFilters =
    new Set(
      settings.hiddenFilters ||
      []
    );


  const hiddenBlocks =
    new Set(
      settings.hiddenBlocks ||
      []
    );


  const blockMap =
    new Map(
      blocks.map(
        item => [
          item.key,
          item
        ]
      )
    );


  const orderedBlocks = [

    ...settings.blockOrder
      .filter(
        key =>
          blockMap.has(
            key
          )
      )
      .map(
        key =>
          blockMap.get(
            key
          )
      ),

    ...blocks
      .filter(
        item =>
          !settings.blockOrder
            .includes(
              item.key
            )
      )
  ];


  openModal(
    `Конструктор · ${livReportTitle()}`,

    `
      <div class="liv-builder-shell">

        <div class="liv-builder-intro">

          Настройка относится только к текущему разделу.

          Можно менять видимость и порядок фильтров,
          блоков, таблиц и колонок.

          Для разных задач можно сохранять несколько
          представлений.

        </div>


        ${
          profiles.length
            ? `
                <div class="liv-builder-section">

                  <div class="liv-builder-section-head">
                    <h3>
                      Сохраненные представления
                    </h3>
                  </div>

                  <div class="liv-profile-list">

                    ${
                      profiles
                        .map(
                          profile => `

                            <div class="liv-profile-row">

                              <span>
                                ${esc(profile.name)}
                              </span>

                              <div>

                                <button
                                  class="btn"
                                  type="button"
                                  data-profile-load="${esc(profile.id)}">

                                  Применить

                                </button>

                                <button
                                  class="btn danger-lite"
                                  type="button"
                                  data-profile-delete="${esc(profile.id)}">

                                  Удалить

                                </button>

                              </div>

                            </div>
                          `
                        )
                        .join('')
                    }

                  </div>

                </div>
              `
            : ''
        }


        ${
          modes.length
            ? `
                <div class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <h3>
                      Режимы
                    </h3>

                  </div>

                  <div class="liv-builder-list">

                    ${
                      modes
                        .map(
                          item =>
                            livBuilderRow({

                              key:
                                item.key,

                              title:
                                item.title,

                              checked:
                                !hiddenModes.has(
                                  item.key
                                ),

                              type:
                                'mode',

                              allowMove:
                                false
                            })
                        )
                        .join('')
                    }

                  </div>

                </div>
              `
            : ''
        }


        ${
          filters.length
            ? `
                <div class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <h3>
                      Фильтры и переключатели
                    </h3>

                  </div>

                  <div
                    class="liv-builder-list"
                    data-builder-sort-group="filters">

                    ${
                      filters
                        .map(
                          item =>
                            livBuilderRow({

                              key:
                                item.key,

                              title:
                                item.title,

                              checked:
                                !hiddenFilters.has(
                                  item.key
                                ),

                              type:
                                'filter',

                              allowMove:
                                false
                            })
                        )
                        .join('')
                    }

                  </div>

                </div>
              `
            : ''
        }


        ${
          orderedBlocks.length
            ? `
                <div class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <h3>
                      Блоки страницы
                    </h3>

                  </div>

                  <div
                    class="liv-builder-list"
                    data-builder-sort-group="blocks">

                    ${
                      orderedBlocks
                        .map(
                          item =>
                            livBuilderRow({

                              key:
                                item.key,

                              title:
                                item.title,

                              checked:
                                !hiddenBlocks.has(
                                  item.key
                                ),

                              type:
                                'block',

                              allowMove:
                                true
                            })
                        )
                        .join('')
                    }

                  </div>

                </div>
              `
            : ''
        }


        ${
          tables.length
            ? `
                <div class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <h3>
                      Таблицы и колонки
                    </h3>

                  </div>

                  <div class="liv-builder-tables">

                    ${
                      tables
                        .map(
                          table =>
                            livBuilderTableHtml(
                              table,
                              settings
                            )
                        )
                        .join('')
                    }

                  </div>

                </div>
              `
            : ''
        }


        <div class="liv-builder-section">

          <div class="liv-builder-section-head">

            <h3>
              Печать / PDF
            </h3>

          </div>


          <div class="form-grid">

            <div class="field">

              <label>
                Ориентация
              </label>

              <select id="livPrintOrientation">

                <option
                  value="landscape"
                  ${
                    settings.print
                      .orientation ===
                    'landscape'
                      ? 'selected'
                      : ''
                  }>

                  Альбомная

                </option>

                <option
                  value="portrait"
                  ${
                    settings.print
                      .orientation ===
                    'portrait'
                      ? 'selected'
                      : ''
                  }>

                  Книжная

                </option>

              </select>

            </div>


            <label class="check-line">

              <input
                id="livPrintHeader"
                type="checkbox"
                ${
                  settings.print
                    .showHeader
                    ? 'checked'
                    : ''
                }
              >

              Шапка отчета

            </label>


            <label class="check-line">

              <input
                id="livPrintFilters"
                type="checkbox"
                ${
                  settings.print
                    .showFilters
                    ? 'checked'
                    : ''
                }
              >

              Фильтры в шапке

            </label>


            <label class="check-line">

              <input
                id="livPrintKpi"
                type="checkbox"
                ${
                  settings.print
                    .showKpi
                    ? 'checked'
                    : ''
                }
              >

              KPI

            </label>


            <label class="check-line">

              <input
                id="livPrintFooter"
                type="checkbox"
                ${
                  settings.print
                    .showFooter
                    ? 'checked'
                    : ''
                }
              >

              Подвал

            </label>


            <label class="check-line">

              <input
                id="livPrintCompact"
                type="checkbox"
                ${
                  settings.print
                    .compact
                    ? 'checked'
                    : ''
                }
              >

              Компактный режим

            </label>

          </div>

        </div>


        <div class="editor-actions">

          <button
            id="livBuilderShowAll"
            class="btn"
            type="button">

            Показать всё

          </button>


          <button
            id="livBuilderSaveProfile"
            class="btn"
            type="button">

            Сохранить как представление

          </button>


          <button
            id="livBuilderApply"
            class="btn primary"
            type="button">

            Применить

          </button>

        </div>

      </div>
    `
  );


  const modalBody =
    $('modalBody');


  modalBody
    .querySelectorAll(
      '[data-builder-up]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const row =
              button.closest(
                '.liv-builder-row'
              );


            const previous =
              row?.previousElementSibling;


            if (
              row &&
              previous
            ) {

              row.parentElement
                .insertBefore(
                  row,
                  previous
                );
            }
          };
      }
    );


  modalBody
    .querySelectorAll(
      '[data-builder-down]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const row =
              button.closest(
                '.liv-builder-row'
              );


            const next =
              row?.nextElementSibling;


            if (
              row &&
              next
            ) {

              row.parentElement
                .insertBefore(
                  next,
                  row
                );
            }
          };
      }
    );


  modalBody
    .querySelectorAll(
      '[data-profile-load]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            livLoadProfile(
              button.dataset
                .profileLoad
            );
      }
    );


  modalBody
    .querySelectorAll(
      '[data-profile-delete]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            livDeleteProfile(
              button.dataset
                .profileDelete
            );
      }
    );


  $('livBuilderShowAll')
    .onclick =
      () => {

        modalBody
          .querySelectorAll(
            '[data-builder-type]'
          )
          .forEach(
            input => {

              input.checked =
                true;
            }
          );
      };


  $('livBuilderSaveProfile')
    .onclick =
      async () => {

        await livSaveBuilderSettingsFromModal(
          false
        );


        await livSaveNamedProfile();
      };


  $('livBuilderApply')
    .onclick =
      async () => {

        await livSaveBuilderSettingsFromModal(
          true
        );
      };
}


/* =========================================================
   СОХРАНЕНИЕ ИЗ МОДАЛЬНОГО ОКНА
   ========================================================= */

async function livSaveBuilderSettingsFromModal(
  closeAfterSave =
    true
) {

  const settings =
    livViewSettings();


  const modalBody =
    $('modalBody');


  if (
    !modalBody
  ) {

    return;
  }


  settings.hiddenModes =
    [
      ...modalBody.querySelectorAll(
        '[data-builder-type="mode"]'
      )
    ]
      .filter(
        input =>
          !input.checked
      )
      .map(
        input =>
          input.dataset
            .builderKey
      );


  settings.hiddenFilters =
    [
      ...modalBody.querySelectorAll(
        '[data-builder-type="filter"]'
      )
    ]
      .filter(
        input =>
          !input.checked
      )
      .map(
        input =>
          input.dataset
            .builderKey
      );


  settings.hiddenBlocks =
    [
      ...modalBody.querySelectorAll(
        '[data-builder-type="block"]'
      )
    ]
      .filter(
        input =>
          !input.checked
      )
      .map(
        input =>
          input.dataset
            .builderKey
      );


  settings.blockOrder =
    [
      ...modalBody.querySelectorAll(
        '[data-builder-sort-group="blocks"] > .liv-builder-row'
      )
    ]
      .map(
        row => {

          const input =
            row.querySelector(
              '[data-builder-type="block"]'
            );


          return (
            input
              ?.dataset
              .builderKey ||
            ''
          );
        }
      )
      .filter(
        Boolean
      );


  settings.tables =
    settings.tables ||
    {};


  modalBody
    .querySelectorAll(
      '[data-builder-table]'
    )
    .forEach(
      tableCard => {

        const tableKey =
          tableCard.dataset
            .builderTable;


        const rows =
          [
            ...tableCard.querySelectorAll(
              '.liv-builder-row'
            )
          ];


        const hiddenColumns =
          [];


        const columnOrder =
          [];


        rows.forEach(
          row => {

            const input =
              row.querySelector(
                '[data-builder-type^="column|"]'
              );


            if (
              !input
            ) {

              return;
            }


            const key =
              input.dataset
                .builderKey;


            columnOrder.push(
              key
            );


            if (
              !input.checked
            ) {

              hiddenColumns.push(
                key
              );
            }
          }
        );


        settings.tables[
          tableKey
        ] = {

          hiddenColumns,

          columnOrder
        };
      }
    );


  settings.print = {

    orientation:
      $('livPrintOrientation')
        ?.value ||
      'landscape',

    showHeader:
      $('livPrintHeader')
        ?.checked !==
      false,

    showFilters:
      $('livPrintFilters')
        ?.checked !==
      false,

    showKpi:
      $('livPrintKpi')
        ?.checked !==
      false,

    showFooter:
      $('livPrintFooter')
        ?.checked !==
      false,

    compact:
      $('livPrintCompact')
        ?.checked ===
      true
  };


  await saveProject();


  if (
    closeAfterSave
  ) {

    closeModal();
  }


  livApplyViewConstructor();
}


/* =========================================================
   КНОПКА КОНСТРУКТОРА
   ========================================================= */

function livEnsureViewBuilderButton() {

  const actions =
    document.querySelector(
      '.top-actions'
    );


  if (
    !actions ||
    $('livViewBuilderBtn')
  ) {

    return;
  }


  const button =
    document.createElement(
      'button'
    );


  button.id =
    'livViewBuilderBtn';


  button.className =
    'btn';


  button.textContent =
    'Конструктор';


  button.onclick =
    livOpenViewBuilder;


  const pdf =
    $('pdfBtn');


  if (
    pdf
  ) {

    actions.insertBefore(
      button,
      pdf
    );

  } else {

    actions.appendChild(
      button
    );
  }
}


/* =========================================================
   ФИЛЬТРЫ ДЛЯ ПЕЧАТИ
   ========================================================= */

function livCurrentReportFilters() {

  const result =
    [];


  const tab =
    livActiveMainTab();


  if (
    tab ===
    'resources'
  ) {

    const from =
      $('rFrom')
        ?.value ||
      '';


    const to =
      $('rTo')
        ?.value ||
      '';


    if (
      from ||
      to
    ) {

      result.push(
        `Период: ${
          from
            ? ruDate(
                from
              )
            : '—'
        } — ${
          to
            ? ruDate(
                to
              )
            : '—'
        }`
      );
    }


    [
      [
        'rOrgMulti',
        'Организации'
      ],
      [
        'rBuildingMulti',
        'Здания'
      ],
      [
        'rWorkMulti',
        'Работы'
      ],
      [
        'rFrontMulti',
        'Фронты'
      ]
    ]
      .forEach(
        (
          [
            id,
            label
          ]
        ) => {

          const text =
            $(
              id
            )
              ?.querySelector(
                '.multi-filter-summary'
              )
              ?.textContent
              ?.trim();


          if (
            text &&
            !/^Все\b/i.test(
              text
            )
          ) {

            result.push(
              `${label}: ${text}`
            );
          }
        }
      );
  }


  if (
    tab ===
    'organizations'
  ) {

    const name =
      $('organizationCardSelect')
        ?.selectedOptions
        ?.[
          0
        ]
        ?.textContent
        ?.trim();


    if (
      name
    ) {

      result.push(
        `Организация: ${name}`
      );
    }
  }


  return result;
}


/* =========================================================
   ПОДГОТОВКА ГРАФИКОВ
   ========================================================= */

function livCanvasToImageMap(
  source
) {

  return [
    ...source.querySelectorAll(
      'canvas'
    )
  ]
    .map(
      canvas => {

        try {

          return canvas.toDataURL(
            'image/png'
          );

        } catch (
          error
        ) {

          return '';
        }
      }
    );
}


/* =========================================================
   ПОДГОТОВКА КЛОНА ДЛЯ ПЕЧАТИ
   ========================================================= */

function livPreparePrintClone(
  source
) {

  const clone =
    source.cloneNode(
      true
    );


  const images =
    livCanvasToImageMap(
      source
    );


  [
    ...clone.querySelectorAll(
      'canvas'
    )
  ]
    .forEach(
      (
        canvas,
        index
      ) => {

        const src =
          images[
            index
          ];


        if (
          !src
        ) {

          canvas.remove();

          return;
        }


        const img =
          document.createElement(
            'img'
          );


        img.src =
          src;


        img.className =
          'liv-print-chart';


        canvas.replaceWith(
          img
        );
      }
    );


  clone
    .querySelectorAll(
      [
        '.no-print',
        '.hidden',
        '.liv-builder-hidden',
        '.liv-mode-hidden',
        '.liv-column-hidden',
        'button',
        'input',
        'select',
        'textarea',
        '.resource-columns-panel',
        '.selection-state',
        '.row-actions',
        '.select-col'
      ]
        .join(
          ','
        )
    )
    .forEach(
      element =>
        element.remove()
    );


  clone
    .querySelectorAll(
      'table'
    )
    .forEach(
      table => {

        table.classList.add(
          'liv-print-table'
        );
      }
    );


  return clone;
}


/* =========================================================
   CSS ПЕЧАТНОГО ОТЧЕТА
   ========================================================= */

function livPrintCss(
  settings
) {

  const orientation =
    settings.print
      ?.orientation ===
    'portrait'
      ? 'portrait'
      : 'landscape';


  const compact =
    settings.print
      ?.compact ===
    true;


  return `

    @page {

      size:
        A4
        ${orientation};

      margin:
        10mm
        9mm
        10mm
        9mm;
    }


    * {
      box-sizing:
        border-box;
    }


    html,
    body {

      margin:
        0;

      padding:
        0;

      background:
        #fff;

      color:
        #182230;

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      -webkit-print-color-adjust:
        exact;

      print-color-adjust:
        exact;
    }


    body {

      font-size:
        ${
          compact
            ? '8px'
            : '9px'
        };
    }


    .report {

      width:
        100%;
    }


    .report-header {

      display:
        flex;

      justify-content:
        space-between;

      align-items:
        flex-start;

      gap:
        16px;

      padding-bottom:
        8px;

      border-bottom:
        2px solid
        #142033;
    }


    .brand {

      display:
        flex;

      gap:
        10px;

      align-items:
        center;
    }


    .brand-mark {

      width:
        38px;

      height:
        38px;

      border-radius:
        7px;

      background:
        #142033;

      color:
        #fff;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      font-weight:
        800;

      font-size:
        15px;
    }


    .brand-name {

      font-size:
        15px;

      font-weight:
        800;
    }


    .brand-subtitle,
    .generated-label {

      color:
        #667085;

      font-size:
        8px;
    }


    .generated {

      text-align:
        right;
    }


    .generated-value {

      margin-top:
        3px;

      font-size:
        9px;

      font-weight:
        700;
    }


    .title-block {

      padding:
        12px
        0
        10px;
    }


    .eyebrow {

      font-size:
        7px;

      font-weight:
        800;

      color:
        #667085;

      letter-spacing:
        .14em;
    }


    h1 {

      margin:
        3px
        0
        0;

      font-size:
        ${
          compact
            ? '17px'
            : '20px'
        };

      line-height:
        1.15;
    }


    .filters {

      display:
        flex;

      flex-wrap:
        wrap;

      gap:
        4px;

      margin-top:
        7px;
    }


    .filter-chip {

      border:
        1px solid
        #d9dee7;

      border-radius:
        999px;

      background:
        #f8fafc;

      padding:
        3px
        6px;

      font-size:
        7px;

      color:
        #475467;
    }


    .card,
    .stat {

      box-shadow:
        none !important;

      border:
        1px solid
        #d9dee7 !important;

      border-radius:
        7px !important;

      background:
        #fff !important;

      break-inside:
        avoid;
    }


    .card {

      padding:
        ${
          compact
            ? '6px'
            : '8px'
        } !important;

      margin-bottom:
        7px !important;
    }


    .card h2,
    .card h3 {

      margin:
        0
        0
        6px !important;

      font-size:
        ${
          compact
            ? '10px'
            : '11px'
        } !important;

      padding-bottom:
        4px;

      border-bottom:
        1px solid
        #e8ebf0;
    }


    .stats {

      display:
        grid !important;

      grid-template-columns:
        repeat(
          3,
          1fr
        ) !important;

      gap:
        6px !important;

      margin-bottom:
        7px !important;
    }


    .stat {

      padding:
        7px
        8px !important;
    }


    .stat span {

      display:
        block;

      color:
        #667085;

      font-size:
        7px !important;

      margin-bottom:
        3px !important;
    }


    .stat strong {

      font-size:
        15px !important;

      line-height:
        1 !important;
    }


    .grid2,
    .grid3,
    .resource-chart-grid {

      display:
        block !important;
    }


    .table-wrap {

      overflow:
        visible !important;
    }


    table,
    .liv-print-table {

      width:
        100% !important;

      min-width:
        0 !important;

      border-collapse:
        collapse !important;

      table-layout:
        auto !important;
    }


    thead {

      display:
        table-header-group;
    }


    tfoot {

      display:
        table-row-group;
    }


    tr {

      break-inside:
        avoid;
    }


    th,
    td {

      padding:
        ${
          compact
            ? '3px 4px'
            : '4px 5px'
        } !important;

      border-bottom:
        1px solid
        #e4e7ec !important;

      font-size:
        ${
          compact
            ? '6.6px'
            : '7.4px'
        } !important;

      line-height:
        1.2 !important;

      vertical-align:
        middle !important;

      position:
        static !important;

      background:
        #fff;

      white-space:
        normal;

      word-break:
        normal;
    }


    th {

      background:
        #f2f4f7 !important;

      font-weight:
        700 !important;

      color:
        #344054 !important;
    }


    td.num-cell,
    th.num-head,
    td.total-cell,
    th.total-cell {

      text-align:
        center !important;

      font-variant-numeric:
        tabular-nums;
    }


    tfoot th,
    tfoot td {

      background:
        #f6f8fb !important;

      font-weight:
        700 !important;

      border-top:
        1.5px solid
        #cfd5df !important;
    }


    .liv-print-chart {

      display:
        block;

      width:
        auto;

      max-width:
        100%;

      max-height:
        150mm;

      margin:
        0 auto;
    }


    .chart-box,
    .chart-box-large {

      height:
        auto !important;

      min-height:
        0 !important;
    }


    .muted {

      color:
        #667085 !important;
    }


    .report-footer {

      display:
        flex;

      justify-content:
        space-between;

      margin-top:
        8px;

      padding-top:
        5px;

      border-top:
        1px solid
        #d9dee7;

      color:
        #98a2b3;

      font-size:
        7px;
    }

  `;
}


/* =========================================================
   КРАСИВАЯ ПЕЧАТЬ В IFRAME
   ========================================================= */

function livBuildPrintableDocument() {

  const source =
    livCurrentPanel();


  if (
    !source
  ) {

    throw new Error(
      'Не найден текущий раздел для печати.'
    );
  }


  const settings =
    livViewSettings();


  const clone =
    livPreparePrintClone(
      source
    );


  if (
    settings.print
      ?.showKpi ===
    false
  ) {

    clone
      .querySelectorAll(
        '.stats'
      )
      .forEach(
        element =>
          element.remove()
      );
  }


  const filters =
    livCurrentReportFilters();


  const generated =
    new Date()
      .toLocaleString(
        'ru-RU'
      );


  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.appendChild(
    clone
  );


  return `
    <!doctype html>

    <html lang="ru">

      <head>

        <meta charset="UTF-8">

        <title>
          ${esc(
            livReportTitle()
          )}
        </title>

        <style>
          ${livPrintCss(settings)}
        </style>

      </head>


      <body>

        <div class="report">

          ${
            settings.print
              ?.showHeader !==
            false
              ? `
                  <header class="report-header">

                    <div class="brand">

                      <div class="brand-mark">
                        LIV
                      </div>

                      <div>

                        <div class="brand-name">
                          LIV Planning
                        </div>

                        <div class="brand-subtitle">
                          Планирование и производственная аналитика
                        </div>

                      </div>

                    </div>


                    <div class="generated">

                      <div class="generated-label">
                        Сформировано
                      </div>

                      <div class="generated-value">
                        ${esc(generated)}
                      </div>

                    </div>

                  </header>


                  <section class="title-block">

                    <div class="eyebrow">
                      ОТЧЕТ
                    </div>

                    <h1>
                      ${esc(
                        livReportTitle()
                      )}
                    </h1>


                    ${
                      settings.print
                        ?.showFilters !==
                        false &&
                      filters.length
                        ? `
                            <div class="filters">

                              ${
                                filters
                                  .map(
                                    text =>
                                      `
                                        <span class="filter-chip">
                                          ${esc(text)}
                                        </span>
                                      `
                                  )
                                  .join('')
                              }

                            </div>
                          `
                        : ''
                    }

                  </section>
                `
              : ''
          }


          <main>

            ${wrapper.innerHTML}

          </main>


          ${
            settings.print
              ?.showFooter !==
            false
              ? `
                  <footer class="report-footer">

                    <span>
                      LIV Planning
                    </span>

                    <span>
                      ${esc(
                        livReportTitle()
                      )}
                    </span>

                  </footer>
                `
              : ''
          }

        </div>

      </body>

    </html>
  `;
}


/* =========================================================
   УДАЛЕНИЕ ПЕЧАТНОГО IFRAME
   ========================================================= */

function livDestroyPrintFrame() {

  if (
    livPrintFrame
  ) {

    try {

      livPrintFrame.remove();

    } catch (
      error
    ) {
    }


    livPrintFrame =
      null;
  }
}


/* =========================================================
   ПЕЧАТЬ
   ========================================================= */

function livPrintCurrent() {

  let html;


  try {

    html =
      livBuildPrintableDocument();

  } catch (
    error
  ) {

    alert(
      error?.message ||
      String(
        error
      )
    );

    return;
  }


  livDestroyPrintFrame();


  const iframe =
    document.createElement(
      'iframe'
    );


  iframe.setAttribute(
    'aria-hidden',
    'true'
  );


  iframe.style.position =
    'fixed';


  iframe.style.right =
    '0';


  iframe.style.bottom =
    '0';


  iframe.style.width =
    '1px';


  iframe.style.height =
    '1px';


  iframe.style.border =
    '0';


  iframe.style.opacity =
    '0';


  iframe.style.pointerEvents =
    'none';


  document.body
    .appendChild(
      iframe
    );


  livPrintFrame =
    iframe;


  const doc =
    iframe.contentDocument ||
    iframe.contentWindow
      .document;


  doc.open();


  doc.write(
    html
  );


  doc.close();


  const doPrint =
    () => {

      try {

        iframe.contentWindow
          .focus();


        iframe.contentWindow
          .print();

      } finally {

        setTimeout(
          livDestroyPrintFrame,
          1500
        );
      }
    };


  if (
    doc.readyState ===
    'complete'
  ) {

    setTimeout(
      doPrint,
      150
    );

  } else {

    iframe.onload =
      () =>
        setTimeout(
          doPrint,
          150
        );
  }
}


/* =========================================================
   СТИЛИ КОНСТРУКТОРА
   ========================================================= */

function livEnsureBuilderStyles() {

  if (
    $('livViewBuilderStyles')
  ) {

    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'livViewBuilderStyles';


  style.textContent = `

    .liv-builder-hidden,
    .liv-mode-hidden,
    .liv-column-hidden {

      display:
        none !important;
    }


    .liv-builder-shell {

      display:
        flex;

      flex-direction:
        column;

      gap:
        16px;
    }


    .liv-builder-intro {

      padding:
        12px
        14px;

      border:
        1px solid
        var(--line);

      border-radius:
        10px;

      background:
        #f8fafc;

      color:
        var(--muted);

      line-height:
        1.45;
    }


    .liv-builder-section {

      border-top:
        1px solid
        #edf0f4;

      padding-top:
        14px;
    }


    .liv-builder-section:first-of-type {

      border-top:
        0;
    }


    .liv-builder-section-head {

      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      margin-bottom:
        8px;
    }


    .liv-builder-section-head h3 {

      margin:
        0;

      font-size:
        15px;
    }


    .liv-builder-list,
    .liv-builder-table-columns {

      display:
        flex;

      flex-direction:
        column;

      gap:
        6px;
    }


    .liv-builder-row {

      min-height:
        42px;

      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        10px;

      border:
        1px solid
        var(--line);

      border-radius:
        8px;

      padding:
        7px
        9px;

      background:
        #fff;
    }


    .liv-builder-check {

      display:
        flex;

      align-items:
        center;

      gap:
        8px;

      flex:
        1;

      min-width:
        0;

      cursor:
        pointer;
    }


    .liv-builder-check input {

      margin:
        0;
    }


    .liv-builder-check span {

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }


    .liv-builder-row-actions {

      display:
        flex;

      gap:
        4px;
    }


    .liv-builder-arrow {

      width:
        30px;

      height:
        30px;

      border:
        1px solid
        var(--line);

      border-radius:
        6px;

      background:
        #fff;

      cursor:
        pointer;
    }


    .liv-builder-arrow:hover {

      background:
        #f8fafc;
    }


    .liv-builder-tables {

      display:
        grid;

      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );

      gap:
        10px;
    }


    .liv-builder-table-card {

      border:
        1px solid
        var(--line);

      border-radius:
        10px;

      padding:
        10px;

      background:
        #f9fafb;
    }


    .liv-builder-table-title {

      font-weight:
        700;

      margin-bottom:
        8px;
    }


    .liv-profile-list {

      display:
        flex;

      flex-direction:
        column;

      gap:
        6px;
    }


    .liv-profile-row {

      display:
        flex;

      justify-content:
        space-between;

      align-items:
        center;

      gap:
        10px;

      border:
        1px solid
        var(--line);

      border-radius:
        8px;

      padding:
        8px
        10px;

      background:
        #fff;
    }


    .liv-profile-row > div {

      display:
        flex;

      gap:
        6px;
    }


    @media (
      max-width:
        900px
    ) {

      .liv-builder-tables {

        grid-template-columns:
          1fr;
      }
    }

  `;


  document.head
    .appendChild(
      style
    );
}


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function initLivViewBuilder() {

  if (
    livViewBuilderInitialized
  ) {

    livApplyViewConstructor();

    return;
  }


  livViewBuilderInitialized =
    true;


  livEnsureBuilderStyles();


  livEnsureViewBuilderButton();


  if (
    $('pdfBtn')
  ) {

    $('pdfBtn').onclick =
      livPrintCurrent;
  }


  document.addEventListener(
    'click',

    event => {

      const trigger =
        event.target.closest(
          '[data-tab],[data-rview]'
        );


      if (
        !trigger
      ) {

        return;
      }


      setTimeout(
        livApplyViewConstructor,
        0
      );
    }
  );


  livApplyViewConstructor();
}