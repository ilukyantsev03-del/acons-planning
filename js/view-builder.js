'use strict';

/* =========================================================
   LIV Planning — UNIVERSAL VIEW BUILDER
   Конструктор представлений + сохраненные виды + печать
   ========================================================= */

let livViewBuilderInitialized = false;
let livViewRegistry = new Map();

function livVBArray(value) {
  return Array.isArray(value) ? value : [];
}

function livVBText(value) {
  return String(value ?? '').trim();
}

function livVBClone(value) {
  try {
    return clone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

function livVBEnsureState() {
  if (typeof project === 'undefined' || !project) return false;

  if (
    !project.viewBuilder ||
    typeof project.viewBuilder !== 'object' ||
    Array.isArray(project.viewBuilder)
  ) {
    project.viewBuilder = {};
  }

  if (
    !project.viewBuilder.views ||
    typeof project.viewBuilder.views !== 'object' ||
    Array.isArray(project.viewBuilder.views)
  ) {
    project.viewBuilder.views = {};
  }

  if (!Array.isArray(project.viewBuilder.profiles)) {
    project.viewBuilder.profiles = [];
  }

  return true;
}

function livVBDefaultViewSettings() {
  return {
    hiddenModes: [],
    modeOrder: [],
    hiddenFilters: [],
    filterOrder: [],
    hiddenActions: [],
    actionOrder: [],
    hiddenKpis: [],
    kpiOrder: [],
    hiddenBlocks: [],
    blockOrder: [],
    hiddenCharts: [],
    chartOrder: [],
    tables: {},
    print: {
      orientation: 'landscape',
      showReportHeader: true,
      showFilters: true,
      showFooter: true,
      compact: false
    }
  };
}

function livRegisterViewSchema(viewKey, schema) {
  if (!viewKey || !schema) return;
  livViewRegistry.set(String(viewKey), schema);
}

function livGetRegisteredViewSchema(viewKey) {
  return livViewRegistry.get(String(viewKey)) || null;
}

window.LIV_VIEW_BUILDER = window.LIV_VIEW_BUILDER || {};
window.LIV_VIEW_BUILDER.register = livRegisterViewSchema;
window.LIV_VIEW_BUILDER.get = livGetRegisteredViewSchema;

function livActiveMainTab() {
  return document.querySelector('.tab.active[data-tab]')?.dataset.tab || 'dashboard';
}

function livActiveResourceView() {
  return (
    document.querySelector('.resource-tab.active[data-rview]')?.dataset.rview ||
    (typeof livResourceView !== 'undefined' ? livResourceView : 'journal')
  );
}

function livCurrentViewKey() {
  const tab = livActiveMainTab();
  return tab === 'resources'
    ? `resources:${livActiveResourceView()}`
    : tab;
}

function livCurrentPanel() {
  const tab = livActiveMainTab();

  if (tab === 'resources') {
    return (
      document.getElementById(`rview-${livActiveResourceView()}`) ||
      document.getElementById('tab-resources')
    );
  }

  return document.getElementById(`tab-${tab}`);
}

function livMainTabTitle(tab) {
  const titles = {
    dashboard: 'Сводка проекта',
    matrix: 'Шахматка',
    gantt: 'График производства работ',
    planfact: 'План / факт',
    resources: 'Ресурсы',
    organizations: 'Карточка организации',
    milestones: 'Ключевые даты',
    elements: 'Номерные элементы',
    demolition: 'Демонтаж',
    import: 'Импорт',
    history: 'История изменений',
    settings: 'Настройки'
  };

  return titles[tab] || tab;
}

function livResourceViewTitle(view) {
  const titles = {
    journal: 'Журнал ресурсов',
    daily: 'Ежедневная сводка ресурсов',
    dynamics: 'Динамика ресурсов',
    analytics: 'Аналитика ресурсов',
    planfact: 'План / факт ресурсов'
  };

  return titles[view] || 'Ресурсы';
}

function livReportTitle() {
  const tab = livActiveMainTab();

  return tab === 'resources'
    ? livResourceViewTitle(livActiveResourceView())
    : livMainTabTitle(tab);
}

function livViewSettings(viewKey = livCurrentViewKey()) {
  if (!livVBEnsureState()) {
    return livVBDefaultViewSettings();
  }

  const defaults = livVBDefaultViewSettings();
  const current = project.viewBuilder.views[viewKey] || {};

  project.viewBuilder.views[viewKey] = {
    ...defaults,
    ...current,

    hiddenModes: livVBArray(current.hiddenModes),
    modeOrder: livVBArray(current.modeOrder),

    hiddenFilters: livVBArray(current.hiddenFilters),
    filterOrder: livVBArray(current.filterOrder),

    hiddenActions: livVBArray(current.hiddenActions),
    actionOrder: livVBArray(current.actionOrder),

    hiddenKpis: livVBArray(current.hiddenKpis),
    kpiOrder: livVBArray(current.kpiOrder),

    hiddenBlocks: livVBArray(current.hiddenBlocks),
    blockOrder: livVBArray(current.blockOrder),

    hiddenCharts: livVBArray(current.hiddenCharts),
    chartOrder: livVBArray(current.chartOrder),

    tables:
      current.tables &&
      typeof current.tables === 'object' &&
      !Array.isArray(current.tables)
        ? current.tables
        : {},

    print: {
      ...defaults.print,
      ...(current.print || {})
    }
  };

  return project.viewBuilder.views[viewKey];
}

function livVBResolveItems(items) {
  return livVBArray(
    typeof items === 'function'
      ? items()
      : items
  ).map((item, index) => ({
    ...item,

    id:
      item.id ||
      `item-${index + 1}`,

    title:
      item.title ||
      item.label ||
      item.id ||
      `Элемент ${index + 1}`
  }));
}

function livVBOrdered(items, order) {
  const list = livVBResolveItems(items);

  const map = new Map(
    list.map(item => [
      item.id,
      item
    ])
  );

  const result = [];

  livVBArray(order).forEach(id => {
    if (map.has(id)) {
      result.push(
        map.get(id)
      );
    }
  });

  list.forEach(item => {
    if (
      !result.some(
        current =>
          current.id === item.id
      )
    ) {
      result.push(item);
    }
  });

  return result;
}

function livVBResolveTableColumns(tableSchema) {
  return livVBResolveItems(
    tableSchema?.columns || []
  );
}

function livVBGetTableConfig(
  viewKey,
  tableId,
  tableSchema = {}
) {
  const view =
    livViewSettings(viewKey);

  const existing =
    view.tables?.[tableId] || {};

  const columns =
    livVBResolveTableColumns(
      tableSchema
    );

  return {
    title:
      existing.title ??
      tableSchema.title ??
      '',

    showTitle:
      existing.showTitle ??
      (
        tableSchema.showTitle !== false
      ),

    showHeader:
      existing.showHeader ??
      (
        tableSchema.showHeader !== false
      ),

    showFooter:
      existing.showFooter ??
      (
        tableSchema.showFooter !== false
      ),

    showRowNumbers:
      existing.showRowNumbers ??
      (
        tableSchema.showRowNumbers !== false
      ),

    hiddenColumns:
      livVBArray(
        existing.hiddenColumns
      ),

    columnOrder:
      livVBArray(
        existing.columnOrder
      ).length
        ? livVBArray(
            existing.columnOrder
          )
        : columns.map(
            column =>
              column.id
          ),

    columnTitles:
      existing.columnTitles &&
      typeof existing.columnTitles === 'object'
        ? existing.columnTitles
        : {}
  };
}

function livVBVisibleColumns(
  viewKey,
  tableId,
  tableSchema = {}
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
        column => [
          column.id,
          column
        ]
      )
    );

  const ordered = [];

  config.columnOrder.forEach(id => {
    if (map.has(id)) {
      ordered.push(
        map.get(id)
      );
    }
  });

  columns.forEach(column => {
    if (
      !ordered.some(
        current =>
          current.id === column.id
      )
    ) {
      ordered.push(column);
    }
  });

  return ordered
    .filter(
      column =>
        !config.hiddenColumns.includes(
          column.id
        )
    )
    .filter(
      column =>
        config.showRowNumbers ||
        column.role !== 'rowNumber'
    )
    .map(column => ({
      ...column,

      title:
        config.columnTitles[column.id] ||
        column.title
    }));
}

window.LIV_VIEW_BUILDER.tableConfig =
  livVBGetTableConfig;

window.LIV_VIEW_BUILDER.visibleColumns =
  livVBVisibleColumns;

window.LIV_VIEW_BUILDER.settings =
  livViewSettings;

function livVBFindElement(item) {
  if (!item?.selector) {
    return null;
  }

  let element = null;

  try {
    element =
      document.querySelector(
        item.selector
      );
  } catch (error) {
    return null;
  }

  if (!element) {
    return null;
  }

  if (item.closest) {
    try {
      return (
        element.closest(
          item.closest
        ) ||
        element
      );
    } catch (error) {
      return element;
    }
  }

  return element;
}

function livVBApplyGroup(
  items,
  hiddenIds,
  orderIds
) {
  const ordered =
    livVBOrdered(
      items,
      orderIds
    );

  const hidden =
    new Set(
      livVBArray(
        hiddenIds
      )
    );

  /*
    Ключевой принцип:
    не переносим живые DOM-узлы через appendChild.
    Меняем только CSS order и видимость.
  */
  ordered.forEach(
    (
      item,
      index
    ) => {
      const element =
        livVBFindElement(
          item
        );

      if (!element) {
        return;
      }

      element.classList.toggle(
        'liv-builder-hidden',
        hidden.has(item.id)
      );

      element.style.order =
        String(index);

      /*
        Если кнопка почему-то потеряла текст,
        восстанавливаем его из схемы.
      */
      if (
        item.title &&
        element.matches(
          'button,[role="button"]'
        )
      ) {
        const text =
          String(
            element.textContent || ''
          ).trim();

        if (!text) {
          element.textContent =
            item.title;
        }

        element.setAttribute(
          'aria-label',
          item.title
        );

        element.setAttribute(
          'title',
          item.title
        );
      }
    }
  );
}

function livVBRepairNavigationLabels() {
  const mainTitles = {
    dashboard: 'Сводка',
    matrix: 'Шахматка',
    gantt: 'Гант',
    planfact: 'План / факт',
    resources: 'Ресурсы',
    organizations: 'Организации',
    milestones: 'Ключевые даты',
    elements: 'Номерные элементы',
    demolition: 'Демонтаж',
    import: 'Импорт',
    history: 'История',
    settings: 'Настройки'
  };

  document
    .querySelectorAll(
      '[data-tab]'
    )
    .forEach(button => {
      const title =
        mainTitles[
          button.dataset.tab
        ];

      if (!title) {
        return;
      }

      if (
        !String(
          button.textContent || ''
        ).trim()
      ) {
        button.textContent =
          title;
      }

      button.setAttribute(
        'aria-label',
        title
      );

      button.setAttribute(
        'title',
        title
      );
    });

  const resourceTitles = {
    journal: 'Журнал',
    daily: 'Ежедневная сводка',
    dynamics: 'Динамика',
    analytics: 'Месячная аналитика',
    planfact: 'План / факт ресурсов'
  };

  document
    .querySelectorAll(
      '[data-rview]'
    )
    .forEach(button => {
      const title =
        resourceTitles[
          button.dataset.rview
        ];

      if (!title) {
        return;
      }

      button.textContent =
        title;

      button.setAttribute(
        'aria-label',
        title
      );

      button.setAttribute(
        'title',
        title
      );
    });
}

function livVBApplyTables(schema) {
  livVBResolveItems(
    schema.tables
  ).forEach(tableSchema => {
    const config =
      livVBGetTableConfig(
        livCurrentViewKey(),
        tableSchema.id,
        tableSchema
      );

    const anchor =
      tableSchema.selector
        ? document.querySelector(
            tableSchema.selector
          )
        : null;

    const table =
      anchor?.matches?.('table')
        ? anchor
        : anchor?.closest?.('table');

    if (!table) {
      return;
    }

    const card =
      table.closest(
        '.card'
      );

    const title =
      card?.querySelector(
        'h2,h3'
      );

    const head =
      table.querySelector(
        'thead'
      );

    const foot =
      table.querySelector(
        'tfoot'
      );

    if (title) {
      title.textContent =
        config.title ||
        tableSchema.title ||
        title.textContent;

      title.classList.toggle(
        'liv-builder-hidden',
        !config.showTitle
      );
    }

    if (head) {
      head.classList.toggle(
        'liv-builder-hidden',
        !config.showHeader
      );
    }

    if (foot) {
      foot.classList.toggle(
        'liv-builder-hidden',
        !config.showFooter
      );
    }
  });
}

function livGetCurrentSchema() {
  return (
    livGetRegisteredViewSchema(
      livCurrentViewKey()
    ) ||
    {
      title:
        livReportTitle(),

      modes:
        [],

      filters:
        [],

      actions:
        [],

      kpis:
        [],

      blocks:
        [],

      charts:
        [],

      tables:
        []
    }
  );
}

function livApplyViewConstructor() {
  if (!livVBEnsureState()) {
    return;
  }

  livVBRepairNavigationLabels();

  document
    .querySelectorAll(
      '.liv-builder-hidden'
    )
    .forEach(element => {
      element.classList.remove(
        'liv-builder-hidden'
      );
    });

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
    schema.actions,
    settings.hiddenActions,
    settings.actionOrder
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
}

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
          ${checked ? 'checked' : ''}
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
          title="Переместить выше">
          ↑
        </button>

        <button
          type="button"
          class="liv-builder-arrow"
          data-move-down
          title="Переместить ниже">
          ↓
        </button>

      </div>

    </div>
  `;
}

function livVBBuilderGroup(
  title,
  help,
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

  if (!ordered.length) {
    return '';
  }

  const hiddenSet =
    new Set(
      livVBArray(
        hidden
      )
    );

  return `
    <section class="liv-builder-section">

      <div class="liv-builder-section-head">

        <div>

          <h3>
            ${esc(title)}
          </h3>

          ${
            help
              ? `
                  <div class="liv-builder-help">
                    ${esc(help)}
                  </div>
                `
              : ''
          }

        </div>

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

        <div>

          <strong>
            ${esc(
              tableSchema.title ||
              tableSchema.id
            )}
          </strong>

          <div class="liv-builder-help">
            Сначала настрой вид таблицы,
            затем состав и порядок колонок.
          </div>

        </div>

      </div>

      <div class="liv-builder-table-options">

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
            ${config.showTitle ? 'checked' : ''}
          >

          Показывать название блока

        </label>

        <label class="check-line">

          <input
            type="checkbox"
            data-table-show-header
            ${config.showHeader ? 'checked' : ''}
          >

          Показывать шапку таблицы

        </label>

        <label class="check-line">

          <input
            type="checkbox"
            data-table-show-footer
            ${config.showFooter ? 'checked' : ''}
          >

          Показывать итоговую строку

        </label>

        <label class="check-line">

          <input
            type="checkbox"
            data-table-row-numbers
            ${config.showRowNumbers ? 'checked' : ''}
          >

          Показывать нумерацию строк

        </label>

      </div>

      <div class="liv-builder-subtitle">
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
                  class="liv-builder-row liv-builder-column-row"
                  data-column-row
                  data-column-id="${esc(column.id)}">

                  <label class="liv-builder-check">

                    <input
                      type="checkbox"
                      data-column-visible
                      ${hidden.has(column.id) ? '' : 'checked'}
                    >

                    <span>
                      ${esc(column.title)}
                    </span>

                  </label>

                  <input
                    class="liv-builder-title-input"
                    data-column-title
                    value="${esc(
                      config.columnTitles[column.id] ||
                      column.title
                    )}"
                    title="Название колонки"
                  >

                  <div class="liv-builder-row-actions">

                    <button
                      type="button"
                      class="liv-builder-arrow"
                      data-move-up
                      title="Переместить выше">
                      ↑
                    </button>

                    <button
                      type="button"
                      class="liv-builder-arrow"
                      data-move-down
                      title="Переместить ниже">
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

function livVBProfilesForCurrentView() {
  if (!livVBEnsureState()) {
    return [];
  }

  const viewKey =
    livCurrentViewKey();

  return project
    .viewBuilder
    .profiles
    .filter(
      profile =>
        profile.viewKey ===
        viewKey
    );
}

async function livVBSaveProfile() {
  const schema =
    livGetCurrentSchema();

  const name =
    prompt(
      'Название представления:',
      schema.title ||
      livReportTitle()
    );

  if (!name) {
    return;
  }

  const profile = {
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

    dataState:
      typeof schema.captureState ===
        'function'
        ? livVBClone(
            schema.captureState()
          )
        : null,

    createdAt:
      nowIso(),

    updatedAt:
      nowIso()
  };

  project
    .viewBuilder
    .profiles
    .push(
      profile
    );

  await saveProject();

  livOpenViewBuilder();
}

async function livVBLoadProfile(
  profileId
) {
  const profile =
    project
      .viewBuilder
      ?.profiles
      ?.find(
        item =>
          item.id ===
          profileId
      );

  if (!profile) {
    return;
  }

  project
    .viewBuilder
    .views[
      profile.viewKey
    ] =
      livVBClone(
        profile.settings
      );

  const schema =
    livGetRegisteredViewSchema(
      profile.viewKey
    );

  if (
    schema &&
    typeof schema.applyState ===
      'function' &&
    profile.dataState
  ) {
    schema.applyState(
      livVBClone(
        profile.dataState
      )
    );
  }

  await saveProject();

  closeModal();

  if (
    schema &&
    typeof schema.rerender ===
      'function'
  ) {
    schema.rerender();
  } else {
    livApplyViewConstructor();
  }
}

async function livVBDeleteProfile(
  profileId
) {
  const profile =
    project
      .viewBuilder
      ?.profiles
      ?.find(
        item =>
          item.id ===
          profileId
      );

  if (!profile) {
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
    project
      .viewBuilder
      .profiles
      .filter(
        item =>
          item.id !==
          profileId
      );

  await saveProject();

  livOpenViewBuilder();
}

function livVBBindMoveButtons(root) {
  root
    .querySelectorAll(
      '[data-move-up]'
    )
    .forEach(button => {
      button.onclick =
        () => {
          const row =
            button.closest(
              '.liv-builder-row'
            );

          if (
            row?.previousElementSibling
          ) {
            row
              .parentElement
              .insertBefore(
                row,
                row.previousElementSibling
              );
          }
        };
    });

  root
    .querySelectorAll(
      '[data-move-down]'
    )
    .forEach(button => {
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
            row
              .parentElement
              .insertBefore(
                next,
                row
              );
          }
        };
    });
}

function livVBReadGroup(
  root,
  group,
  hiddenKey,
  orderKey,
  settings
) {
  const list =
    root.querySelector(
      `[data-sort-group="${group}"]`
    );

  if (!list) {
    return;
  }

  const rows =
    [
      ...list.querySelectorAll(
        ':scope > .liv-builder-row'
      )
    ];

  settings[orderKey] =
    rows
      .map(
        row =>
          row.dataset.itemId
      )
      .filter(Boolean);

  settings[hiddenKey] =
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
          row.dataset.itemId
      )
      .filter(Boolean);
}

async function livVBSaveModalSettings() {
  const root =
    document.getElementById(
      'modalBody'
    );

  if (!root) {
    return;
  }

  const settings =
    livViewSettings();

  livVBReadGroup(
    root,
    'modes',
    'hiddenModes',
    'modeOrder',
    settings
  );

  livVBReadGroup(
    root,
    'filters',
    'hiddenFilters',
    'filterOrder',
    settings
  );

  livVBReadGroup(
    root,
    'actions',
    'hiddenActions',
    'actionOrder',
    settings
  );

  livVBReadGroup(
    root,
    'kpis',
    'hiddenKpis',
    'kpiOrder',
    settings
  );

  livVBReadGroup(
    root,
    'blocks',
    'hiddenBlocks',
    'blockOrder',
    settings
  );

  livVBReadGroup(
    root,
    'charts',
    'hiddenCharts',
    'chartOrder',
    settings
  );

  settings.tables =
    settings.tables ||
    {};

  root
    .querySelectorAll(
      '[data-table-builder]'
    )
    .forEach(card => {
      const tableId =
        card.dataset.tableBuilder;

      const rows =
        [
          ...card.querySelectorAll(
            '[data-column-row]'
          )
        ];

      settings.tables[tableId] = {
        ...(
          settings.tables[tableId] ||
          {}
        ),

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
                row.dataset.columnId
            )
            .filter(Boolean),

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
                row.dataset.columnId
            )
            .filter(Boolean),

        columnTitles:
          Object.fromEntries(
            rows
              .map(
                row => [
                  row.dataset.columnId,
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
    });

  settings.print = {
    orientation:
      document
        .getElementById(
          'livPrintOrientation'
        )
        ?.value ||
      'landscape',

    showReportHeader:
      document
        .getElementById(
          'livPrintHeader'
        )
        ?.checked !==
      false,

    showFilters:
      document
        .getElementById(
          'livPrintFilters'
        )
        ?.checked !==
      false,

    showFooter:
      document
        .getElementById(
          'livPrintFooter'
        )
        ?.checked !==
      false,

    compact:
      document
        .getElementById(
          'livPrintCompact'
        )
        ?.checked ===
      true
  };

  await saveProject();
}

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

          <strong>
            Как пользоваться:
          </strong>

          1) галочкой включай/выключай элемент;
          2) стрелками меняй порядок;
          3) в разделе «Таблицы» отдельно
          настраиваются название, шапка, итог,
          нумерация и колонки;
          4) нажми «Применить».

          Настройка сохраняется и не должна
          сбрасываться после обновления страницы.

        </div>

        ${
          profiles.length
            ? `
                <section class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <div>

                      <h3>
                        Сохраненные представления
                      </h3>

                      <div class="liv-builder-help">
                        Например: рабочий вид,
                        директор, заказчик, печать.
                      </div>

                    </div>

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
                                  type="button"
                                  class="btn"
                                  data-profile-load="${esc(profile.id)}">
                                  Применить
                                </button>

                                <button
                                  type="button"
                                  class="btn danger-lite"
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
            'Какие подвкладки доступны и в каком порядке.',
            'modes',
            schema.modes,
            settings.hiddenModes,
            settings.modeOrder
          )
        }

        ${
          livVBBuilderGroup(
            'Фильтры',
            'Какие фильтры видит пользователь и в каком порядке.',
            'filters',
            schema.filters,
            settings.hiddenFilters,
            settings.filterOrder
          )
        }

        ${
          livVBBuilderGroup(
            'Действия',
            'Кнопки добавления, сброса, сохранения и другие команды.',
            'actions',
            schema.actions,
            settings.hiddenActions,
            settings.actionOrder
          )
        }

        ${
          livVBBuilderGroup(
            'Показатели',
            'Карточки KPI над таблицами.',
            'kpis',
            schema.kpis,
            settings.hiddenKpis,
            settings.kpiOrder
          )
        }

        ${
          livVBBuilderGroup(
            'Разделы страницы',
            'Целые таблицы, панели и смысловые блоки.',
            'blocks',
            schema.blocks,
            settings.hiddenBlocks,
            settings.blockOrder
          )
        }

        ${
          livVBBuilderGroup(
            'Графики',
            'Графики можно независимо включать, выключать и переставлять.',
            'charts',
            schema.charts,
            settings.hiddenCharts,
            settings.chartOrder
          )
        }

        ${
          livVBResolveItems(
            schema.tables
          ).length
            ? `
                <section class="liv-builder-section">

                  <div class="liv-builder-section-head">

                    <div>

                      <h3>
                        Таблицы
                      </h3>

                      <div class="liv-builder-help">
                        Здесь нет жесткой шапки:
                        состав, порядок и названия
                        колонок задаются тобой.
                      </div>

                    </div>

                  </div>

                  <div class="liv-builder-tables">

                    ${
                      livVBResolveItems(
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

            <div>

              <h3>
                Печать / PDF
              </h3>

              <div class="liv-builder-help">
                PDF строится как отдельный отчет
                из текущего представления,
                а не как скрин страницы.
              </div>

            </div>

          </div>

          <div class="liv-builder-print-grid">

            <div class="field">

              <label>
                Ориентация
              </label>

              <select id="livPrintOrientation">

                <option
                  value="landscape"
                  ${
                    settings.print.orientation ===
                    'landscape'
                      ? 'selected'
                      : ''
                  }>
                  Альбомная
                </option>

                <option
                  value="portrait"
                  ${
                    settings.print.orientation ===
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
                  settings.print.showReportHeader
                    ? 'checked'
                    : ''
                }
              >

              Шапка отчета LIV Planning

            </label>

            <label class="check-line">

              <input
                id="livPrintFilters"
                type="checkbox"
                ${
                  settings.print.showFilters
                    ? 'checked'
                    : ''
                }
              >

              Показывать выбранные фильтры

            </label>

            <label class="check-line">

              <input
                id="livPrintFooter"
                type="checkbox"
                ${
                  settings.print.showFooter
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
                  settings.print.compact
                    ? 'checked'
                    : ''
                }
              >

              Компактная печать

            </label>

          </div>

        </section>

        <div class="editor-actions liv-builder-footer-actions">

          <button
            id="livBuilderReset"
            type="button"
            class="btn">
            Сбросить текущий вид
          </button>

          <button
            id="livBuilderSaveProfile"
            type="button"
            class="btn">
            Сохранить как представление
          </button>

          <button
            id="livBuilderApply"
            type="button"
            class="btn primary">
            Применить
          </button>

        </div>

      </div>
    `
  );

  const root =
    document.getElementById(
      'modalBody'
    );

  livVBBindMoveButtons(
    root
  );

  root
    .querySelectorAll(
      '[data-profile-load]'
    )
    .forEach(button => {
      button.onclick =
        () =>
          livVBLoadProfile(
            button.dataset.profileLoad
          );
    });

  root
    .querySelectorAll(
      '[data-profile-delete]'
    )
    .forEach(button => {
      button.onclick =
        () =>
          livVBDeleteProfile(
            button.dataset.profileDelete
          );
    });

  document
    .getElementById(
      'livBuilderApply'
    )
    .onclick =
      async () => {
        await livVBSaveModalSettings();

        closeModal();

        const currentSchema =
          livGetCurrentSchema();

        if (
          typeof currentSchema.rerender ===
          'function'
        ) {
          currentSchema.rerender();
        } else {
          livApplyViewConstructor();
        }
      };

  document
    .getElementById(
      'livBuilderSaveProfile'
    )
    .onclick =
      async () => {
        await livVBSaveModalSettings();
        await livVBSaveProfile();
      };

  document
    .getElementById(
      'livBuilderReset'
    )
    .onclick =
      async () => {
        if (
          !confirm(
            'Сбросить настройки только текущего представления? Данные проекта не изменятся.'
          )
        ) {
          return;
        }

        project
          .viewBuilder
          .views[
            livCurrentViewKey()
          ] =
            livVBDefaultViewSettings();

        await saveProject();

        closeModal();

        const currentSchema =
          livGetCurrentSchema();

        if (
          typeof currentSchema.rerender ===
          'function'
        ) {
          currentSchema.rerender();
        } else {
          livApplyViewConstructor();
        }
      };
}

function livEnsureViewBuilderButton() {
  const actions =
    document.querySelector(
      '.top-actions'
    );

  if (!actions) {
    return;
  }

  let button =
    document.getElementById(
      'livViewBuilderBtn'
    );

  if (!button) {
    button =
      document.createElement(
        'button'
      );

    button.id =
      'livViewBuilderBtn';

    button.className =
      'btn';

    button.textContent =
      'Конструктор';

    const pdf =
      document.getElementById(
        'pdfBtn'
      );

    if (pdf) {
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

  button.onclick =
    livOpenViewBuilder;
}

function livCurrentReportMeta(schema) {
  if (
    typeof schema.getPrintMeta ===
    'function'
  ) {
    return (
      schema.getPrintMeta() ||
      []
    );
  }

  return [];
}

function livPrintCss(settings) {
  const orientation =
    settings.print.orientation ===
    'portrait'
      ? 'portrait'
      : 'landscape';

  const compact =
    settings.print.compact ===
    true;

  return `
    @page{
      size:A4 ${orientation};
      margin:10mm 9mm 10mm 9mm;
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

    .liv-report{
      width:100%;
    }

    .liv-report-header{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      padding-bottom:8px;
      border-bottom:2px solid #142033;
    }

    .liv-brand{
      display:flex;
      gap:10px;
      align-items:center;
    }

    .liv-brand-mark{
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

    .liv-brand-name{
      font-size:15px;
      font-weight:800;
    }

    .liv-brand-subtitle,
    .liv-generated-label{
      font-size:8px;
      color:#667085;
    }

    .liv-generated{
      text-align:right;
    }

    .liv-generated-value{
      font-size:9px;
      font-weight:700;
      margin-top:3px;
    }

    .liv-report-title{
      padding:12px 0 10px;
    }

    .liv-report-title small{
      display:block;
      font-size:7px;
      font-weight:800;
      letter-spacing:.14em;
      color:#667085;
    }

    .liv-report-title h1{
      margin:3px 0 0;
      font-size:${compact ? '17px' : '20px'};
      line-height:1.15;
    }

    .liv-report-meta{
      display:flex;
      flex-wrap:wrap;
      gap:4px;
      margin-top:7px;
    }

    .liv-report-chip{
      border:1px solid #d9dee7;
      border-radius:999px;
      background:#f8fafc;
      padding:3px 6px;
      font-size:7px;
      color:#475467;
    }

    .liv-report-kpis{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:6px;
      margin:0 0 8px;
    }

    .liv-report-kpi{
      border:1px solid #d9dee7;
      border-radius:7px;
      padding:7px 8px;
      break-inside:avoid;
    }

    .liv-report-kpi span{
      display:block;
      color:#667085;
      font-size:7px;
      margin-bottom:3px;
    }

    .liv-report-kpi strong{
      font-size:15px;
    }

    .liv-report-section{
      margin-bottom:8px;
      break-inside:auto;
    }

    .liv-report-section h2{
      margin:0 0 5px;
      font-size:11px;
      padding-bottom:4px;
      border-bottom:1px solid #e8ebf0;
    }

    table{
      width:100%;
      border-collapse:collapse;
      table-layout:auto;
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
      padding:${compact ? '3px 4px' : '4px 5px'};
      border-bottom:1px solid #e4e7ec;
      font-size:${compact ? '6.6px' : '7.4px'};
      line-height:1.2;
      vertical-align:middle;
      background:#fff;
    }

    th{
      background:#f2f4f7;
      font-weight:700;
      color:#344054;
    }

    .num,
    .num-cell,
    .num-head{
      text-align:center;
      font-variant-numeric:tabular-nums;
    }

    .total,
    .total-cell{
      font-weight:700;
    }

    tfoot th,
    tfoot td{
      background:#f6f8fb;
      font-weight:700;
      border-top:1.5px solid #cfd5df;
    }

    .liv-report-chart{
      max-width:100%;
      display:block;
      margin:0 auto 8px;
      break-inside:avoid;
    }

    .liv-report-footer{
      display:flex;
      justify-content:space-between;
      margin-top:8px;
      padding-top:5px;
      border-top:1px solid #d9dee7;
      color:#98a2b3;
      font-size:7px;
    }

    .muted{
      color:#667085;
    }
  `;
}

function livBuildPrintDocument() {
  const schema =
    livGetCurrentSchema();

  const settings =
    livViewSettings();

  if (
    typeof schema.getPrintHtml !==
    'function'
  ) {
    throw new Error(
      'Для этого представления еще не подключен печатный отчет.'
    );
  }

  const content =
    schema.getPrintHtml();

  if (
    !livVBText(
      content
    )
  ) {
    throw new Error(
      'Печатный отчет не содержит данных.'
    );
  }

  const meta =
    settings.print.showFilters
      ? livCurrentReportMeta(
          schema
        )
      : [];

  const generated =
    new Date()
      .toLocaleString(
        'ru-RU'
      );

  return `
    <!doctype html>

    <html lang="ru">

      <head>

        <meta charset="UTF-8">

        <title>
          ${esc(
            schema.title ||
            livReportTitle()
          )}
        </title>

        <style>
          ${livPrintCss(settings)}
        </style>

      </head>

      <body>

        <div class="liv-report">

          ${
            settings.print.showReportHeader
              ? `
                  <header class="liv-report-header">

                    <div class="liv-brand">

                      <div class="liv-brand-mark">
                        LIV
                      </div>

                      <div>

                        <div class="liv-brand-name">
                          LIV Planning
                        </div>

                        <div class="liv-brand-subtitle">
                          Планирование и производственная аналитика
                        </div>

                      </div>

                    </div>

                    <div class="liv-generated">

                      <div class="liv-generated-label">
                        Сформировано
                      </div>

                      <div class="liv-generated-value">
                        ${esc(generated)}
                      </div>

                    </div>

                  </header>

                  <section class="liv-report-title">

                    <small>
                      ОТЧЕТ
                    </small>

                    <h1>
                      ${esc(
                        schema.title ||
                        livReportTitle()
                      )}
                    </h1>

                    ${
                      meta.length
                        ? `
                            <div class="liv-report-meta">

                              ${
                                meta
                                  .map(
                                    item =>
                                      `
                                        <span class="liv-report-chip">
                                          ${esc(item)}
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
            ${content}
          </main>

          ${
            settings.print.showFooter
              ? `
                  <footer class="liv-report-footer">

                    <span>
                      LIV Planning
                    </span>

                    <span>
                      ${esc(
                        schema.title ||
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

function livPrintCurrent() {
  let printWindow =
    null;

  try {
    printWindow =
      window.open(
        '',
        '_blank'
      );

    if (!printWindow) {
      alert(
        'Браузер заблокировал окно отчета. Разреши всплывающие окна для LIV Planning и повтори.'
      );

      return;
    }

    const reportHtml =
      livBuildPrintDocument();

    const enhanced =
      reportHtml
        .replace(
          '</head>',

          `
            <style>

              .liv-print-toolbar{
                position:sticky;
                top:0;
                z-index:9999;
                display:flex;
                justify-content:flex-end;
                gap:8px;
                padding:10px 14px;
                background:#eef2f7;
                border-bottom:1px solid #d9dee7;
                font-family:Arial,Helvetica,sans-serif;
              }

              .liv-print-toolbar button{
                border:1px solid #cfd6e0;
                border-radius:7px;
                background:#fff;
                padding:8px 12px;
                font-weight:700;
                cursor:pointer;
              }

              .liv-print-toolbar button.primary{
                background:#142033;
                color:#fff;
                border-color:#142033;
              }

              @media print{
                .liv-print-toolbar{
                  display:none!important;
                }
              }

            </style>

          </head>
          `
        )
        .replace(
          '<body>',

          `
            <body>

              <div class="liv-print-toolbar">

                <button
                  type="button"
                  onclick="window.close()">
                  Закрыть
                </button>

                <button
                  type="button"
                  class="primary"
                  onclick="window.print()">
                  Печать / PDF
                </button>

              </div>
          `
        );

    printWindow
      .document
      .open();

    printWindow
      .document
      .write(
        enhanced
      );

    printWindow
      .document
      .close();

    const tryAutoPrint =
      () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (error) {
          /*
            Отчет остается открыт,
            кнопка Печать / PDF доступна вручную.
          */
        }
      };

    if (
      printWindow
        .document
        .readyState ===
      'complete'
    ) {
      setTimeout(
        tryAutoPrint,
        350
      );
    } else {
      printWindow.onload =
        () =>
          setTimeout(
            tryAutoPrint,
            350
          );
    }
  } catch (error) {
    if (
      printWindow &&
      !printWindow.closed
    ) {
      try {
        printWindow
          .document
          .body
          .innerHTML =
            `
              <div
                style="
                  padding:24px;
                  font-family:Arial,sans-serif
                ">

                <h2>
                  Не удалось сформировать отчет
                </h2>

                <p>
                  ${String(
                    error?.message ||
                    error
                  )}
                </p>

              </div>
            `;
      } catch (innerError) {
      }
    }

    alert(
      error?.message ||
      String(
        error
      )
    );
  }
}

function livEnsureBuilderStyles() {
  if (
    document.getElementById(
      'livViewBuilderStyles'
    )
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
    .liv-builder-hidden{
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
      color:#475467;
      line-height:1.55;
    }

    .liv-builder-section{
      border-top:1px solid #edf0f4;
      padding-top:14px;
    }

    .liv-builder-section-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      margin-bottom:8px;
    }

    .liv-builder-section-head h3{
      margin:0;
      font-size:15px;
    }

    .liv-builder-help{
      margin-top:3px;
      color:var(--muted);
      font-size:12px;
      line-height:1.35;
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

    .liv-builder-table-options{
      display:grid;
      grid-template-columns:1fr;
      gap:8px;
      margin-bottom:12px;
      padding-bottom:10px;
      border-bottom:1px solid #e8ebf0;
    }

    .liv-builder-subtitle{
      font-weight:700;
      margin-bottom:8px;
    }

    .liv-builder-column-row{
      display:grid;
      grid-template-columns:minmax(140px,1fr) minmax(140px,220px) auto;
    }

    .liv-builder-title-input{
      width:100%;
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

    .liv-profile-row>div{
      display:flex;
      gap:6px;
    }

    .liv-builder-print-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      align-items:end;
    }

    .liv-builder-footer-actions{
      position:sticky;
      bottom:0;
      padding:10px 0 2px;
      background:linear-gradient(
        to bottom,
        rgba(255,255,255,.7),
        #fff 30%
      );
    }

    @media(max-width:900px){

      .liv-builder-tables,
      .liv-builder-print-grid{
        grid-template-columns:1fr;
      }

      .liv-builder-column-row{
        grid-template-columns:1fr auto;
      }

      .liv-builder-title-input{
        grid-column:1/-1;
      }
    }
  `;

  document
    .head
    .appendChild(
      style
    );
}

function initLivViewBuilder() {
  if (!livVBEnsureState()) {
    return false;
  }

  livEnsureBuilderStyles();

  livEnsureViewBuilderButton();

  const pdfButton =
    document.getElementById(
      'pdfBtn'
    );

  if (pdfButton) {
    pdfButton.onclick =
      livPrintCurrent;
  }

  if (!livViewBuilderInitialized) {
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
            () => {
              livEnsureViewBuilderButton();

              const pdf =
                document.getElementById(
                  'pdfBtn'
                );

              if (pdf) {
                pdf.onclick =
                  livPrintCurrent;
              }

              livApplyViewConstructor();
            },
            0
          );
        }
      }
    );
  }

  livApplyViewConstructor();

  return true;
}

function livViewBuilderBootstrap(
  attempt = 0
) {
  if (
    typeof project !==
      'undefined' &&
    project &&
    typeof openModal ===
      'function'
  ) {
    initLivViewBuilder();
    return;
  }

  if (
    attempt <
    40
  ) {
    setTimeout(
      () =>
        livViewBuilderBootstrap(
          attempt + 1
        ),
      250
    );
  }
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    () =>
      setTimeout(
        () =>
          livViewBuilderBootstrap(),
        0
      )
  );
} else {
  setTimeout(
    () =>
      livViewBuilderBootstrap(),
    0
  );
}