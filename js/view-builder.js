'use strict';

/* =========================================================
   LIV Planning — UNIVERSAL VIEW BUILDER
   Единый конструктор представлений, таблиц и печати
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


function livVBText(value) {
  return String(value ?? '').trim();
}


function livVBKey(value) {
  return normKey(
    livVBText(value)
  ) || 'item';
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


function livVBEnsureState() {

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
   НАСТРОЙКИ ПО УМОЛЧАНИЮ
   ========================================================= */

function livVBDefaultViewConfig() {

  return {

    hiddenModes:
      [],

    modeOrder:
      [],

    hiddenFilters:
      [],

    filterOrder:
      [],

    hiddenKpis:
      [],

    kpiOrder:
      [],

    hiddenBlocks:
      [],

    blockOrder:
      [],

    hiddenCharts:
      [],

    chartOrder:
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

      showFooter:
        true,

      compact:
        false
    }
  };
}


/* =========================================================
   РЕЕСТР СХЕМ
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
    schema
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
   ТЕКУЩИЙ РАЗДЕЛ
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


  return (
    tab ===
    'resources'
      ? `resources:${livActiveResourceView()}`
      : tab
  );
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


/* =========================================================
   НАЗВАНИЯ
   ========================================================= */

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

  return ({
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
  })[
    view
  ] ||
  'Ресурсы';
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
   СОСТОЯНИЕ ПРЕДСТАВЛЕНИЯ
   ========================================================= */

function livViewSettings(
  viewKey =
    livCurrentViewKey()
) {

  livVBEnsureState();


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
        livVBDefaultViewConfig();
  }


  const defaults =
    livVBDefaultViewConfig();


  const current =
    project.viewBuilder
      .views[
        viewKey
      ] ||
    {};


  project.viewBuilder
    .views[
      viewKey
    ] = {

      ...defaults,

      ...current,

      hiddenModes:
        livVBArray(
          current.hiddenModes
        ),

      modeOrder:
        livVBArray(
          current.modeOrder
        ),

      hiddenFilters:
        livVBArray(
          current.hiddenFilters
        ),

      filterOrder:
        livVBArray(
          current.filterOrder
        ),

      hiddenKpis:
        livVBArray(
          current.hiddenKpis
        ),

      kpiOrder:
        livVBArray(
          current.kpiOrder
        ),

      hiddenBlocks:
        livVBArray(
          current.hiddenBlocks
        ),

      blockOrder:
        livVBArray(
          current.blockOrder
        ),

      hiddenCharts:
        livVBArray(
          current.hiddenCharts
        ),

      chartOrder:
        livVBArray(
          current.chartOrder
        ),

      tables:
        current.tables &&
        typeof current.tables ===
          'object'
          ? current.tables
          : {},

      print: {

        ...defaults.print,

        ...(
          current.print ||
          {}
        )
      }
    };


  return project.viewBuilder
    .views[
      viewKey
    ];
}


/* =========================================================
   ПОРЯДОК ЭЛЕМЕНТОВ
   ========================================================= */

function livVBResolveItems(
  items
) {

  return livVBArray(
    items
  )
    .map(
      (
        item,
        index
      ) => ({

        ...item,

        id:
          item.id ||
          `item-${index + 1}`,

        title:
          item.title ||
          item.label ||
          item.id ||
          `Элемент ${index + 1}`
      })
    );
}


function livVBResolveTableColumns(
  tableSchema
) {

  const source =
    typeof tableSchema
      ?.columns ===
    'function'
      ? tableSchema.columns()
      : tableSchema
          ?.columns;


  return livVBResolveItems(
    source
  );
}


function livVBOrdered(
  items,
  order
) {

  const list =
    livVBResolveItems(
      items
    );


  const map =
    new Map(
      list.map(
        item => [
          item.id,
          item
        ]
      )
    );


  return [

    ...livVBArray(
      order
    )
      .filter(
        id =>
          map.has(
            id
          )
      )
      .map(
        id =>
          map.get(
            id
          )
      ),

    ...list
      .filter(
        item =>
          !livVBArray(
            order
          )
            .includes(
              item.id
            )
      )
  ];
}


/* =========================================================
   КОНФИГУРАЦИЯ ТАБЛИЦЫ
   ========================================================= */

function livVBGetTableConfig(
  viewKey,
  tableId,
  tableSchema =
    {}
) {

  const view =
    livViewSettings(
      viewKey
    );


  const existing =
    view.tables
      ?.[
        tableId
      ] ||
    {};


  const columns =
    livVBResolveTableColumns(
      tableSchema
    );


  const defaultOrder =
    columns.map(
      item =>
        item.id
    );


  return {

    showTitle:
      existing.showTitle !==
        false &&
      tableSchema.showTitle !==
        false,

    showHeader:
      existing.showHeader !==
        false &&
      tableSchema.showHeader !==
        false,

    showFooter:
      existing.showFooter !==
        false &&
      tableSchema.showFooter !==
        false,

    showRowNumbers:
      existing.showRowNumbers !==
        false &&
      tableSchema.showRowNumbers !==
        false,

    title:
      existing.title ??
      tableSchema.title ??
      '',

    hiddenColumns:
      livVBArray(
        existing.hiddenColumns
      ),

    columnOrder:
      livVBArray(
        existing.columnOrder
      )
        .length
        ? livVBArray(
            existing.columnOrder
          )
        : defaultOrder,

    columnTitles:
      existing.columnTitles &&
      typeof existing.columnTitles ===
        'object'
        ? existing.columnTitles
        : {}
  };
}


function livVBResolveVisibleColumns(
  viewKey,
  tableId,
  tableSchema =
    {}
) {

  const config =
    livVBGetTableConfig(
      viewKey,
      tableId,
      tableSchema
    );


  const columns =
    livVBResolveTableColumns(
      tableSchema
    );


  const map =
    new Map(
      columns.map(
        item => [
          item.id,
          item
        ]
      )
    );


  const ordered = [

    ...config.columnOrder
      .filter(
        id =>
          map.has(
            id
          )
      )
      .map(
        id =>
          map.get(
            id
          )
      ),

    ...columns
      .filter(
        item =>
          !config.columnOrder
            .includes(
              item.id
            )
      )
  ];


  return ordered

    .filter(
      item =>
        !config.hiddenColumns
          .includes(
            item.id
          )
    )

    .filter(
      item =>
        config.showRowNumbers ||
        item.role !==
          'rowNumber'
    )

    .map(
      item => ({

        ...item,

        title:
          config.columnTitles[
            item.id
          ] ||
          item.title
      })
    );
}


window.LIV_VIEW_BUILDER.tableConfig =
  livVBGetTableConfig;


window.LIV_VIEW_BUILDER.visibleColumns =
  livVBResolveVisibleColumns;


/* =========================================================
   АВТООПРЕДЕЛЕНИЕ СТРАНИЦ
   ДЛЯ МОДУЛЕЙ БЕЗ ЯВНОЙ СХЕМЫ
   ========================================================= */

function livVBAutoSchema(
  viewKey =
    livCurrentViewKey()
) {

  const panel =
    livCurrentPanel();


  const root =
    livActiveMainTab() ===
      'resources'
      ? $('tab-resources')
      : panel;


  if (
    !panel ||
    !root
  ) {

    return {

      title:
        livReportTitle(),

      modes:
        [],

      filters:
        [],

      kpis:
        [],

      blocks:
        [],

      charts:
        [],

      tables:
        []
    };
  }


  const modes =
    livActiveMainTab() ===
    'resources'
      ? [
          ...document
            .querySelectorAll(
              '[data-rview]'
            )
        ]
          .map(
            button => ({

              id:
                button.dataset
                  .rview,

              title:
                livVBText(
                  button.textContent
                ),

              selector:
                `[data-rview="${button.dataset.rview}"]`
            })
          )
      : [];


  const filters =
    [
      ...root
        .querySelectorAll(
          '.resource-toolbar .field,.resource-toolbar .switch-line,.toolbar .field,.section-toolbar.no-print .field'
        )
    ]
      .map(
        (
          element,
          index
        ) => {

          const control =
            element.querySelector(
              'input,select,textarea'
            );


          const id =
            control?.id
              ? `filter:${control.id}`
              : `filter:auto-${index + 1}`;


          if (
            !element.dataset
              .livAutoId
          ) {

            element.dataset
              .livAutoId =
                id;
          }


          return {

            id,

            title:
              livVBText(
                element
                  .querySelector(
                    'label'
                  )
                  ?.textContent ||
                element.textContent
              ) ||
              `Фильтр ${index + 1}`,

            selector:
              `[data-liv-auto-id="${id}"]`
          };
        }
      );


  const kpis =
    [
      ...panel
        .querySelectorAll(
          '.stats > .stat'
        )
    ]
      .map(
        (
          element,
          index
        ) => {

          const id =
            element
              .querySelector(
                'strong'
              )
              ?.id
              ? `kpi:${element.querySelector('strong').id}`
              : `kpi:auto-${index + 1}`;


          if (
            !element.dataset
              .livAutoId
          ) {

            element.dataset
              .livAutoId =
                id;
          }


          return {

            id,

            title:
              livVBText(
                element
                  .querySelector(
                    'span'
                  )
                  ?.textContent
              ) ||
              `Показатель ${index + 1}`,

            selector:
              `[data-liv-auto-id="${id}"]`
          };
        }
      );


  const blocks =
    [
      ...panel.children
    ]
      .filter(
        element =>
          element.matches(
            '.card,.grid2,.grid3,.resource-chart-grid,.chart-box-large'
          )
      )
      .map(
        (
          element,
          index
        ) => {

          const id =
            element.id
              ? `block:${element.id}`
              : `block:auto-${index + 1}`;


          if (
            !element.dataset
              .livAutoId
          ) {

            element.dataset
              .livAutoId =
                id;
          }


          return {

            id,

            title:
              livVBText(
                element
                  .querySelector(
                    'h2,h3'
                  )
                  ?.textContent
              ) ||
              `Блок ${index + 1}`,

            selector:
              `[data-liv-auto-id="${id}"]`
          };
        }
      );


  const charts =
    [
      ...panel
        .querySelectorAll(
          '.resource-chart-card,.chart-box-large'
        )
    ]
      .map(
        (
          element,
          index
        ) => {

          const id =
            element.id
              ? `chart:${element.id}`
              : `chart:auto-${index + 1}`;


          if (
            !element.dataset
              .livAutoId
          ) {

            element.dataset
              .livAutoId =
                id;
          }


          return {

            id,

            title:
              livVBText(
                element
                  .querySelector(
                    'h2,h3'
                  )
                  ?.textContent
              ) ||
              `График ${index + 1}`,

            selector:
              `[data-liv-auto-id="${id}"]`
          };
        }
      );


  return {

    title:
      livReportTitle(),

    modes,

    filters,

    kpis,

    blocks,

    charts,

    tables:
      []
  };
}


function livGetCurrentSchema() {

  const key =
    livCurrentViewKey();


  return (
    livGetRegisteredViewSchema(
      key
    ) ||
    livVBAutoSchema(
      key
    )
  );
}


/* =========================================================
   ПОИСК ЭЛЕМЕНТА
   ========================================================= */

function livVBFind(
  selector,
  root =
    document
) {

  if (
    !selector
  ) {
    return null;
  }


  try {

    return root.querySelector(
      selector
    );

  } catch (
    error
  ) {

    return null;
  }
}


function livVBElementForItem(
  item
) {

  const base =
    livVBFind(
      item
        ?.selector
    );


  if (
    !base
  ) {
    return null;
  }


  if (
    item
      ?.closest
  ) {

    try {

      return (
        base.closest(
          item.closest
        ) ||
        base
      );

    } catch (
      error
    ) {

      return base;
    }
  }


  return base;
}


/* =========================================================
   ПРИМЕНЕНИЕ ВИДИМОСТИ И ПОРЯДКА
   ========================================================= */

function livVBApplyGroup(
  items,
  hiddenIds,
  orderIds
) {

  const resolved =
    livVBResolveItems(
      items
    );


  const hidden =
    new Set(
      livVBArray(
        hiddenIds
      )
    );


  resolved.forEach(
    item => {

      const element =
        livVBElementForItem(
          item
        );


      if (
        element
      ) {

        element.classList
          .toggle(
            'liv-builder-hidden',

            hidden.has(
              item.id
            )
          );
      }
    }
  );


  const ordered =
    livVBOrdered(
      resolved,
      orderIds
    );


  const groups =
    new Map();


  ordered.forEach(
    item => {

      const element =
        livVBElementForItem(
          item
        );


      if (
        !element
          ?.parentElement
      ) {
        return;
      }


      if (
        !groups.has(
          element.parentElement
        )
      ) {

        groups.set(
          element.parentElement,
          []
        );
      }


      groups
        .get(
          element.parentElement
        )
        .push(
          element
        );
    }
  );


  groups.forEach(
    (
      elements,
      parent
    ) => {

      elements.forEach(
        element =>
          parent.appendChild(
            element
          )
      );
    }
  );
}


/* =========================================================
   ПРИМЕНЕНИЕ ТАБЛИЦ
   ========================================================= */

function livVBApplyTables(
  schema
) {

  livVBArray(
    schema.tables
  )
    .forEach(
      tableSchema => {

        const config =
          livVBGetTableConfig(
            livCurrentViewKey(),
            tableSchema.id,
            tableSchema
          );


        const table =
          tableSchema.selector
            ? livVBFind(
                tableSchema.selector
              )
            : null;


        if (
          !table
        ) {
          return;
        }


        const card =
          table.closest(
            '.card'
          );


        const title =
          card
            ?.querySelector(
              'h2,h3'
            );


        if (
          title
        ) {

          title.textContent =
            config.title ||
            tableSchema.title ||
            title.textContent;


          title.classList
            .toggle(
              'liv-builder-hidden',
              !config.showTitle
            );
        }


        const thead =
          table.querySelector(
            'thead'
          );


        const tfoot =
          table.querySelector(
            'tfoot'
          );


        if (
          thead
        ) {

          thead.classList
            .toggle(
              'liv-builder-hidden',
              !config.showHeader
            );
        }


        if (
          tfoot
        ) {

          tfoot.classList
            .toggle(
              'liv-builder-hidden',
              !config.showFooter
            );
        }
      }
    );
}


/* =========================================================
   ГЛАВНОЕ ПРИМЕНЕНИЕ
   ========================================================= */

function livApplyViewConstructor() {

  if (
    !project
  ) {
    return;
  }


  document
    .querySelectorAll(
      '.liv-builder-hidden,.liv-mode-hidden'
    )
    .forEach(
      element => {

        element.classList
          .remove(
            'liv-builder-hidden',
            'liv-mode-hidden'
          );
      }
    );


  const schema =
    livGetCurrentSchema();


  const settings =
    livViewSettings();


  livVBApplyGroup(
    schema.modes,
    settings.hiddenModes,
    settings.modeOrder
  );


  livVBApplyGroup(
    schema.filters,
    settings.hiddenFilters,
    settings.filterOrder
  );


  livVBApplyGroup(
    schema.kpis,
    settings.hiddenKpis,
    settings.kpiOrder
  );


  livVBApplyGroup(
    schema.blocks,
    settings.hiddenBlocks,
    settings.blockOrder
  );


  livVBApplyGroup(
    schema.charts,
    settings.hiddenCharts,
    settings.chartOrder
  );


  livVBApplyTables(
    schema
  );


  if (
    livActiveMainTab() ===
    'resources'
  ) {

    const active =
      livActiveResourceView();


    if (
      settings.hiddenModes
        .includes(
          active
        )
    ) {

      const first =
        livVBOrdered(
          schema.modes,
          settings.modeOrder
        )
          .find(
            item =>
              !settings.hiddenModes
                .includes(
                  item.id
                )
          );


      if (
        first &&
        typeof switchResourceView ===
          'function'
      ) {

        switchResourceView(
          first.id
        );
      }
    }
  }
}


/* =========================================================
   СТРОКА КОНСТРУКТОРА
   ========================================================= */

function livVBBuilderRow(
  item,
  group,
  checked
) {

  return `
    <div
      class="liv-builder-row"
      data-sort-row
      data-item-id="${esc(item.id)}">

      <label class="liv-builder-check">

        <input
          type="checkbox"
          data-builder-group="${esc(group)}"
          data-builder-id="${esc(item.id)}"
          ${
            checked
              ? 'checked'
              : ''
          }
        >

        <span>
          ${esc(item.title)}
        </span>

      </label>


      <div class="liv-builder-row-actions">

        <button
          type="button"
          class="liv-builder-arrow"
          data-move-up
          title="Выше">
          ↑
        </button>

        <button
          type="button"
          class="liv-builder-arrow"
          data-move-down
          title="Ниже">
          ↓
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   ГРУППА КОНСТРУКТОРА
   ========================================================= */

function livVBBuilderGroup(
  title,
  group,
  items,
  hidden,
  order
) {

  const ordered =
    livVBOrdered(
      items,
      order
    );


  if (
    !ordered.length
  ) {

    return '';
  }


  const hiddenSet =
    new Set(
      hidden ||
      []
    );


  return `
    <section class="liv-builder-section">

      <div class="liv-builder-section-head">

        <h3>
          ${esc(title)}
        </h3>

      </div>


      <div
        class="liv-builder-list"
        data-sort-group="${esc(group)}">

        ${
          ordered
            .map(
              item =>
                livVBBuilderRow(
                  item,
                  group,
                  !hiddenSet.has(
                    item.id
                  )
                )
            )
            .join('')
        }

      </div>

    </section>
  `;
}


/* =========================================================
   ТАБЛИЦА В КОНСТРУКТОРЕ
   ========================================================= */

function livVBTableBuilderHtml(
  tableSchema
) {

  const config =
    livVBGetTableConfig(
      livCurrentViewKey(),
      tableSchema.id,
      tableSchema
    );


  const columns =
    livVBOrdered(
      livVBResolveTableColumns(
        tableSchema
      ),
      config.columnOrder
    );


  const hidden =
    new Set(
      config.hiddenColumns
    );


  return `
    <section
      class="liv-builder-table"
      data-table-builder="${esc(tableSchema.id)}">

      <div class="liv-builder-table-head">

        <strong>
          ${esc(
            tableSchema.title ||
            tableSchema.id
          )}
        </strong>

      </div>


      <div class="form-grid liv-table-options">

        <div class="field">

          <label>
            Название блока
          </label>

          <input
            data-table-title
            value="${esc(
              config.title ||
              tableSchema.title ||
              ''
            )}"
          >

        </div>


        <label class="check-line">

          <input
            type="checkbox"
            data-table-show-title
            ${
              config.showTitle
                ? 'checked'
                : ''
            }
          >

          Заголовок блока

        </label>


        <label class="check-line">

          <input
            type="checkbox"
            data-table-show-header
            ${
              config.showHeader
                ? 'checked'
                : ''
            }
          >

          Шапка таблицы

        </label>


        <label class="check-line">

          <input
            type="checkbox"
            data-table-show-footer
            ${
              config.showFooter
                ? 'checked'
                : ''
            }
          >

          Итоговая строка

        </label>


        <label class="check-line">

          <input
            type="checkbox"
            data-table-row-numbers
            ${
              config.showRowNumbers
                ? 'checked'
                : ''
            }
          >

          Нумерация строк

        </label>

      </div>


      <div class="liv-builder-column-head">
        Колонки
      </div>


      <div
        class="liv-builder-list"
        data-column-sort-group="${esc(tableSchema.id)}">

        ${
          columns
            .map(
              column => `

                <div
                  class="liv-builder-row"
                  data-column-row
                  data-column-id="${esc(column.id)}">

                  <label class="liv-builder-check">

                    <input
                      type="checkbox"
                      data-column-visible
                      ${
                        hidden.has(
                          column.id
                        )
                          ? ''
                          : 'checked'
                      }
                    >

                    <span>
                      ${esc(column.title)}
                    </span>

                  </label>


                  <input
                    class="liv-builder-title-input"
                    data-column-title
                    value="${esc(
                      config.columnTitles[
                        column.id
                      ] ||
                      column.title
                    )}"
                    title="Название колонки"
                  >


                  <div class="liv-builder-row-actions">

                    <button
                      type="button"
                      class="liv-builder-arrow"
                      data-move-up
                      title="Выше">
                      ↑
                    </button>

                    <button
                      type="button"
                      class="liv-builder-arrow"
                      data-move-down
                      title="Ниже">
                      ↓
                    </button>

                  </div>

                </div>
              `
            )
            .join('')
        }

      </div>

    </section>
  `;
}


/* =========================================================
   СОХРАНЕННЫЕ ПРЕДСТАВЛЕНИЯ
   ========================================================= */

function livVBProfilesForCurrentView() {

  livVBEnsureState();


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


async function livVBLoadProfile(
  id
) {

  const profile =
    (
      project.viewBuilder
        .profiles ||
      []
    )
      .find(
        item =>
          item.id ===
          id
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


  if (
    typeof renderResourceCurrentView ===
      'function' &&
    livActiveMainTab() ===
      'resources'
  ) {

    renderResourceCurrentView();

  } else {

    livApplyViewConstructor();
  }
}


async function livVBDeleteProfile(
  id
) {

  const profile =
    (
      project.viewBuilder
        .profiles ||
      []
    )
      .find(
        item =>
          item.id ===
          id
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
          id
      );


  await saveProject();


  livOpenViewBuilder();
}


/* =========================================================
   СТРЕЛКИ ПЕРЕМЕЩЕНИЯ
   ========================================================= */

function livVBBindMoveButtons(
  root
) {

  root
    .querySelectorAll(
      '[data-move-up]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const row =
              button.closest(
                '.liv-builder-row'
              );


            if (
              row
                ?.previousElementSibling
            ) {

              row.parentElement
                .insertBefore(
                  row,
                  row.previousElementSibling
                );
            }
          };
      }
    );


  root
    .querySelectorAll(
      '[data-move-down]'
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
              row
                ?.nextElementSibling;


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
}


/* =========================================================
   ОТКРЫТИЕ КОНСТРУКТОРА
   ========================================================= */

function livOpenViewBuilder() {

  const schema =
    livGetCurrentSchema();


  const settings =
    livViewSettings();


  const profiles =
    livVBProfilesForCurrentView();


  openModal(
    `Конструктор · ${schema.title || livReportTitle()}`,

    `
      <div class="liv-builder-shell">

        <div class="liv-builder-intro">

          Собери текущий вид под себя:
          режимы, фильтры, показатели,
          блоки, таблицы, колонки,
          графики и печать.

          Порядок меняется стрелками.
          Настройки сохраняются отдельно
          для каждой вкладки.

        </div>


        ${
          profiles.length
            ? `
                <section class="liv-builder-section">

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

                </section>
              `
            : ''
        }


        ${
          livVBBuilderGroup(
            'Режимы',
            'modes',
            schema.modes,
            settings.hiddenModes,
            settings.modeOrder
          )
        }


        ${
          livVBBuilderGroup(
            'Фильтры и переключатели',
            'filters',
            schema.filters,
            settings.hiddenFilters,
            settings.filterOrder
          )
        }


        ${
          livVBBuilderGroup(
            'Показатели',
            'kpis',
            schema.kpis,
            settings.hiddenKpis,
            settings.kpiOrder
          )
        }


        ${
          livVBBuilderGroup(
            'Разделы и блоки',
            'blocks',
            schema.blocks,
            settings.hiddenBlocks,
            settings.blockOrder
          )
        }


        ${
          livVBBuilderGroup(
            'Графики',
            'charts',
            schema.charts,
            settings.hiddenCharts,
            settings.chartOrder
          )
        }


        ${
          livVBArray(
            schema.tables
          )
            .length
            ? `
                <section class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <h3>
                      Таблицы
                    </h3>

                  </div>


                  <div class="liv-builder-tables">

                    ${
                      livVBArray(
                        schema.tables
                      )
                        .map(
                          table =>
                            livVBTableBuilderHtml(
                              table
                            )
                        )
                        .join('')
                    }

                  </div>

                </section>
              `
            : ''
        }


        <section class="liv-builder-section">

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

              Выбранные фильтры

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

              Подвал отчета

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

        </section>


        <div class="editor-actions">

          <button
            id="livBuilderReset"
            class="btn"
            type="button">

            Сбросить вид

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


  const root =
    $('modalBody');


  livVBBindMoveButtons(
    root
  );


  root
    .querySelectorAll(
      '[data-profile-load]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            livVBLoadProfile(
              button.dataset
                .profileLoad
            );
      }
    );


  root
    .querySelectorAll(
      '[data-profile-delete]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            livVBDeleteProfile(
              button.dataset
                .profileDelete
            );
      }
    );


  $('livBuilderApply')
    .onclick =
      async () => {

        await livVBSaveModalSettings();


        closeModal();


        if (
          typeof renderResourceCurrentView ===
            'function' &&
          livActiveMainTab() ===
            'resources'
        ) {

          renderResourceCurrentView();

        } else {

          livApplyViewConstructor();
        }
      };


  $('livBuilderSaveProfile')
    .onclick =
      async () => {

        await livVBSaveModalSettings();


        const name =
          prompt(
            'Название представления:',
            schema.title ||
            livReportTitle()
          );


        if (
          !name
        ) {
          return;
        }


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


        await saveProject();


        livOpenViewBuilder();
      };


  $('livBuilderReset')
    .onclick =
      async () => {

        project.viewBuilder
          .views[
            livCurrentViewKey()
          ] =
            livVBDefaultViewConfig();


        await saveProject();


        closeModal();


        if (
          typeof renderResourceCurrentView ===
            'function' &&
          livActiveMainTab() ===
            'resources'
        ) {

          renderResourceCurrentView();

        } else {

          livApplyViewConstructor();
        }
      };
}


/* =========================================================
   СОХРАНЕНИЕ КОНСТРУКТОРА
   ========================================================= */

async function livVBSaveModalSettings() {

  const root =
    $('modalBody');


  if (
    !root
  ) {
    return;
  }


  const settings =
    livViewSettings();


  const saveGroup =
    (
      group,
      hiddenKey,
      orderKey
    ) => {

      const list =
        root.querySelector(
          `[data-sort-group="${group}"]`
        );


      if (
        !list
      ) {
        return;
      }


      const rows =
        [
          ...list
            .querySelectorAll(
              ':scope > .liv-builder-row'
            )
        ];


      settings[
        orderKey
      ] =
        rows
          .map(
            row =>
              row.dataset
                .itemId
          )
          .filter(
            Boolean
          );


      settings[
        hiddenKey
      ] =
        rows
          .filter(
            row =>
              !row
                .querySelector(
                  `[data-builder-group="${group}"]`
                )
                ?.checked
          )
          .map(
            row =>
              row.dataset
                .itemId
          )
          .filter(
            Boolean
          );
    };


  saveGroup(
    'modes',
    'hiddenModes',
    'modeOrder'
  );


  saveGroup(
    'filters',
    'hiddenFilters',
    'filterOrder'
  );


  saveGroup(
    'kpis',
    'hiddenKpis',
    'kpiOrder'
  );


  saveGroup(
    'blocks',
    'hiddenBlocks',
    'blockOrder'
  );


  saveGroup(
    'charts',
    'hiddenCharts',
    'chartOrder'
  );


  settings.tables =
    settings.tables ||
    {};


  root
    .querySelectorAll(
      '[data-table-builder]'
    )
    .forEach(
      card => {

        const id =
          card.dataset
            .tableBuilder;


        const rows =
          [
            ...card
              .querySelectorAll(
                '[data-column-row]'
              )
          ];


        const previous =
          settings.tables[
            id
          ] ||
          {};


        settings.tables[
          id
        ] = {

          ...previous,

          title:
            card
              .querySelector(
                '[data-table-title]'
              )
              ?.value
              ?.trim() ||
            '',

          showTitle:
            card
              .querySelector(
                '[data-table-show-title]'
              )
              ?.checked !==
            false,

          showHeader:
            card
              .querySelector(
                '[data-table-show-header]'
              )
              ?.checked !==
            false,

          showFooter:
            card
              .querySelector(
                '[data-table-show-footer]'
              )
              ?.checked !==
            false,

          showRowNumbers:
            card
              .querySelector(
                '[data-table-row-numbers]'
              )
              ?.checked !==
            false,

          columnOrder:
            rows
              .map(
                row =>
                  row.dataset
                    .columnId
              )
              .filter(
                Boolean
              ),

          hiddenColumns:
            rows
              .filter(
                row =>
                  !row
                    .querySelector(
                      '[data-column-visible]'
                    )
                    ?.checked
              )
              .map(
                row =>
                  row.dataset
                    .columnId
              )
              .filter(
                Boolean
              ),

          columnTitles:
            Object.fromEntries(
              rows
                .map(
                  row => [

                    row.dataset
                      .columnId,

                    row
                      .querySelector(
                        '[data-column-title]'
                      )
                      ?.value
                      ?.trim() ||
                    ''
                  ]
                )
                .filter(
                  (
                    [
                      id
                    ]
                  ) =>
                    id
                )
            )
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
}


/* =========================================================
   ФИЛЬТРЫ ДЛЯ ПЕЧАТИ
   ========================================================= */

function livCurrentReportFilters() {

  const result =
    [];


  if (
    livActiveMainTab() ===
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


  return result;
}


/* =========================================================
   ПОДГОТОВКА ПЕЧАТИ
   ========================================================= */

function livPreparePrintClone(
  source
) {

  const clone =
    source.cloneNode(
      true
    );


  const originalCanvases =
    [
      ...source
        .querySelectorAll(
          'canvas'
        )
    ];


  [
    ...clone
      .querySelectorAll(
        'canvas'
      )
  ]
    .forEach(
      (
        canvas,
        index
      ) => {

        try {

          const data =
            originalCanvases[
              index
            ]
              ?.toDataURL(
                'image/png'
              );


          if (
            !data
          ) {

            canvas.remove();

            return;
          }


          const image =
            document.createElement(
              'img'
            );


          image.src =
            data;


          image.className =
            'liv-print-chart';


          canvas.replaceWith(
            image
          );

        } catch (
          error
        ) {

          canvas.remove();
        }
      }
    );


  clone
    .querySelectorAll(
      [
        '.no-print',
        '.hidden',
        '.liv-builder-hidden',
        '.liv-mode-hidden',
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
      table =>
        table.classList
          .add(
            'liv-print-table'
          )
    );


  return clone;
}


/* =========================================================
   CSS ПЕЧАТИ
   ========================================================= */

function livPrintCss(
  settings
) {

  const portrait =
    settings.print
      ?.orientation ===
    'portrait';


  const compact =
    settings.print
      ?.compact ===
    true;


  return `

    @page{
      size:A4 ${portrait ? 'portrait' : 'landscape'};
      margin:9mm;
    }

    *{
      box-sizing:border-box;
    }

    html,
    body{
      margin:0;
      padding:0;
      background:#fff;
      color:#172033;
      font-family:Arial,Helvetica,sans-serif;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }

    body{
      font-size:${compact ? '8px' : '9px'};
    }

    .report{
      width:100%;
    }

    .report-header{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      padding-bottom:8px;
      border-bottom:2px solid #142033;
    }

    .brand{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .brand-mark{
      width:38px;
      height:38px;
      border-radius:7px;
      background:#142033;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:15px;
      font-weight:800;
    }

    .brand-name{
      font-size:15px;
      font-weight:800;
    }

    .brand-subtitle,
    .generated-label{
      font-size:8px;
      color:#667085;
    }

    .generated{
      text-align:right;
    }

    .generated-value{
      font-size:9px;
      font-weight:700;
      margin-top:3px;
    }

    .title-block{
      padding:12px 0 10px;
    }

    .eyebrow{
      font-size:7px;
      font-weight:800;
      letter-spacing:.14em;
      color:#667085;
    }

    .title-block h1{
      margin:3px 0 0;
      font-size:${compact ? '17px' : '20px'};
    }

    .filters{
      display:flex;
      flex-wrap:wrap;
      gap:4px;
      margin-top:7px;
    }

    .filter-chip{
      border:1px solid #d9dee7;
      border-radius:999px;
      background:#f8fafc;
      padding:3px 6px;
      font-size:7px;
      color:#475467;
    }

    .card,
    .stat{
      box-shadow:none!important;
      border:1px solid #d9dee7!important;
      border-radius:7px!important;
      background:#fff!important;
      break-inside:avoid;
    }

    .card{
      padding:${compact ? '6px' : '8px'}!important;
      margin-bottom:7px!important;
    }

    .card h2,
    .card h3{
      margin:0 0 6px!important;
      padding-bottom:4px;
      border-bottom:1px solid #e8ebf0;
      font-size:${compact ? '10px' : '11px'}!important;
    }

    .stats{
      display:grid!important;
      grid-template-columns:repeat(3,1fr)!important;
      gap:6px!important;
      margin-bottom:7px!important;
    }

    .stat{
      padding:7px 8px!important;
    }

    .stat span{
      display:block;
      color:#667085;
      font-size:7px!important;
      margin-bottom:3px!important;
    }

    .stat strong{
      font-size:15px!important;
    }

    .grid2,
    .grid3,
    .resource-chart-grid{
      display:block!important;
    }

    .table-wrap{
      overflow:visible!important;
    }

    table,
    .liv-print-table{
      width:100%!important;
      min-width:0!important;
      border-collapse:collapse!important;
      table-layout:auto!important;
    }

    thead{
      display:table-header-group;
    }

    tfoot{
      display:table-row-group;
    }

    tr{
      break-inside:avoid;
    }

    th,
    td{
      padding:${compact ? '3px 4px' : '4px 5px'}!important;
      border-bottom:1px solid #e4e7ec!important;
      font-size:${compact ? '6.6px' : '7.4px'}!important;
      line-height:1.2!important;
      vertical-align:middle!important;
      position:static!important;
      white-space:normal;
      background:#fff;
    }

    th{
      background:#f2f4f7!important;
      font-weight:700!important;
      color:#344054!important;
    }

    .num-cell,
    .num-head,
    .total-cell{
      text-align:center!important;
      font-variant-numeric:tabular-nums;
    }

    tfoot th,
    tfoot td{
      background:#f6f8fb!important;
      font-weight:700!important;
      border-top:1.5px solid #cfd5df!important;
    }

    .liv-print-chart{
      display:block;
      max-width:100%;
      max-height:150mm;
      margin:0 auto;
    }

    .report-footer{
      display:flex;
      justify-content:space-between;
      margin-top:8px;
      padding-top:5px;
      border-top:1px solid #d9dee7;
      color:#98a2b3;
      font-size:7px;
    }
  `;
}


/* =========================================================
   ПЕЧАТНЫЙ ДОКУМЕНТ
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
          ${esc(livReportTitle())}
        </title>

        <style>
          ${livPrintCss(settings)}
        </style>

      </head>


      <body>

        <div class="report">

          ${
            settings.print
              .showHeader !==
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
                      ${esc(livReportTitle())}
                    </h1>


                    ${
                      settings.print
                        .showFilters !==
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
              .showFooter !==
            false
              ? `
                  <footer class="report-footer">

                    <span>
                      LIV Planning
                    </span>

                    <span>
                      ${esc(livReportTitle())}
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
   ПЕЧАТЬ ЧЕРЕЗ IFRAME
   ========================================================= */

function livDestroyPrintFrame() {

  if (
    !livPrintFrame
  ) {
    return;
  }


  try {

    livPrintFrame.remove();

  } catch (
    error
  ) {
  }


  livPrintFrame =
    null;
}


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


  Object.assign(
    iframe.style,
    {

      position:
        'fixed',

      right:
        '0',

      bottom:
        '0',

      width:
        '1px',

      height:
        '1px',

      border:
        '0',

      opacity:
        '0',

      pointerEvents:
        'none'
    }
  );


  document.body.appendChild(
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
      200
    );

  } else {

    iframe.onload =
      () =>
        setTimeout(
          doPrint,
          200
        );
  }
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
    .liv-mode-hidden{
      display:none!important;
    }

    .liv-builder-shell{
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .liv-builder-intro{
      padding:12px 14px;
      border:1px solid var(--line);
      border-radius:10px;
      background:#f8fafc;
      color:var(--muted);
      line-height:1.45;
    }

    .liv-builder-section{
      border-top:1px solid #edf0f4;
      padding-top:14px;
    }

    .liv-builder-section-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:8px;
    }

    .liv-builder-section-head h3{
      margin:0;
      font-size:15px;
    }

    .liv-builder-list{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .liv-builder-row{
      min-height:42px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      border:1px solid var(--line);
      border-radius:8px;
      padding:7px 9px;
      background:#fff;
    }

    .liv-builder-check{
      display:flex;
      align-items:center;
      gap:8px;
      flex:1;
      min-width:0;
      cursor:pointer;
    }

    .liv-builder-check input{
      margin:0;
    }

    .liv-builder-check span{
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .liv-builder-row-actions{
      display:flex;
      gap:4px;
    }

    .liv-builder-arrow{
      width:30px;
      height:30px;
      border:1px solid var(--line);
      border-radius:6px;
      background:#fff;
      cursor:pointer;
    }

    .liv-builder-arrow:hover{
      background:#f8fafc;
    }

    .liv-builder-tables{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }

    .liv-builder-table{
      border:1px solid var(--line);
      border-radius:10px;
      padding:10px;
      background:#f9fafb;
    }

    .liv-builder-table-head{
      margin-bottom:10px;
    }

    .liv-table-options{
      margin-bottom:10px;
    }

    .liv-builder-column-head{
      font-weight:700;
      margin:8px 0;
    }

    .liv-builder-title-input{
      width:min(220px,35%);
      min-width:120px;
    }

    .liv-profile-list{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .liv-profile-row{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      border:1px solid var(--line);
      border-radius:8px;
      padding:8px 10px;
      background:#fff;
    }

    .liv-profile-row > div{
      display:flex;
      gap:6px;
    }

    @media(max-width:900px){

      .liv-builder-tables{
        grid-template-columns:1fr;
      }

      .liv-builder-title-input{
        width:40%;
      }
    }
  `;


  document.head.appendChild(
    style
  );
}


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function initLivViewBuilder() {

  livEnsureBuilderStyles();


  livEnsureViewBuilderButton();


  if (
    $('pdfBtn')
  ) {

    $('pdfBtn').onclick =
      livPrintCurrent;
  }


  if (
    !livViewBuilderInitialized
  ) {

    livViewBuilderInitialized =
      true;


    document.addEventListener(
      'click',

      event => {

        if (
          event.target.closest(
            '[data-tab],[data-rview]'
          )
        ) {

          setTimeout(
            livApplyViewConstructor,
            0
          );
        }
      }
    );
  }


  livApplyViewConstructor();
}