'use strict';

/* =========================================================
   LIV Planning — РЕСУРСЫ
   Эталонный модуль: данные + конструктор + печать
   ========================================================= */

let livResourceView = 'journal';
let livResourceCharts = [];
let livResourcePlanFactChart = null;
let livResourceSelectedIds = new Set();

/* =========================================================
   КОЛОНКИ
   ========================================================= */

const RESOURCE_JOURNAL_COLUMNS = [
  {
    id:
      'select',

    title:
      'Выбор',

    role:
      'system',

    print:
      false
  },

  {
    id:
      'date',

    title:
      'Дата'
  },

  {
    id:
      'organization',

    title:
      'Организация'
  },

  {
    id:
      'building',

    title:
      'Здание'
  },

  {
    id:
      'work',

    title:
      'Работа'
  },

  {
    id:
      'front',

    title:
      'Фронт'
  },

  {
    id:
      'itr',

    title:
      'ИТР',

    numeric:
      true
  },

  {
    id:
      'workers',

    title:
      'Рабочие',

    numeric:
      true
  },

  {
    id:
      'mechanizers',

    title:
      'Механизаторы',

    numeric:
      true
  },

  {
    id:
      'equipmentType',

    title:
      'Наименование техники'
  },

  {
    id:
      'equipmentQty',

    title:
      'Количество техники',

    numeric:
      true
  },

  {
    id:
      'comment',

    title:
      'Комментарий'
  },

  {
    id:
      'actions',

    title:
      'Действия',

    role:
      'system',

    print:
      false
  }
];

const RESOURCE_DAILY_PEOPLE_COLUMNS = [
  {
    id:
      'number',

    title:
      '№',

    role:
      'rowNumber',

    numeric:
      true
  },

  {
    id:
      'organization',

    title:
      'Организация'
  },

  {
    id:
      'itr',

    title:
      'ИТР',

    numeric:
      true
  },

  {
    id:
      'workers',

    title:
      'Рабочие',

    numeric:
      true
  },

  {
    id:
      'mechanizers',

    title:
      'Механизаторы',

    numeric:
      true
  },

  {
    id:
      'total',

    title:
      'Всего, чел',

    numeric:
      true,

    total:
      true
  }
];

const RESOURCE_DAILY_EQUIPMENT_COLUMNS = [
  {
    id:
      'number',

    title:
      '№',

    role:
      'rowNumber',

    numeric:
      true
  },

  {
    id:
      'organization',

    title:
      'Организация'
  },

  {
    id:
      'equipmentType',

    title:
      'Наименование техники'
  },

  {
    id:
      'quantity',

    title:
      'Количество, ед.',

    numeric:
      true,

    total:
      true
  }
];

const RESOURCE_ANALYTICS_PEOPLE_COLUMNS = [
  {
    id:
      'organization',

    title:
      'Организация'
  },

  {
    id:
      'itr',

    title:
      'ИТР',

    numeric:
      true
  },

  {
    id:
      'mechanizers',

    title:
      'Механизаторы',

    numeric:
      true
  },

  {
    id:
      'workers',

    title:
      'Рабочие',

    numeric:
      true
  },

  {
    id:
      'total',

    title:
      'Итого',

    numeric:
      true,

    total:
      true
  }
];

const RESOURCE_PLANFACT_COLUMNS = [
  {
    id:
      'period',

    title:
      'Период'
  },

  {
    id:
      'plan',

    title:
      'План',

    numeric:
      true
  },

  {
    id:
      'fact',

    title:
      'Факт',

    numeric:
      true
  },

  {
    id:
      'deviation',

    title:
      'Отклонение',

    numeric:
      true,

    total:
      true
  }
];

/* =========================================================
   БАЗОВЫЕ ФУНКЦИИ
   ========================================================= */

function resourceHasOwn(
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

function resourceShowZero() {
  return (
    document
      .getElementById(
        'rShowZero'
      )
      ?.checked ===
    true
  );
}

function resourceTotalPeople(
  row
) {
  return (
    num(
      row?.itr
    ) +
    num(
      row?.workers
    ) +
    num(
      row?.mechanizers
    )
  );
}

function resourceActivityTotal(
  rows
) {
  return (
    (
      rows ||
      []
    )
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          resourceTotalPeople(
            row
          ) +
          num(
            row.equipmentQty
          ),
        0
      )
  );
}

function resourceViewKey(
  viewName =
    livResourceView
) {
  return `resources:${viewName}`;
}

/* =========================================================
   ФИЛЬТРАЦИЯ
   ========================================================= */

function resourceFiltered(
  options =
    {}
) {
  const from =
    resourceHasOwn(
      options,
      'from'
    )
      ? options.from
      : (
          document
            .getElementById(
              'rFrom'
            )
            ?.value ||
          ''
        );

  const to =
    resourceHasOwn(
      options,
      'to'
    )
      ? options.to
      : (
          document
            .getElementById(
              'rTo'
            )
            ?.value ||
          ''
        );

  const organizationIds =
    resourceHasOwn(
      options,
      'organizationIds'
    )
      ? options.organizationIds
      : getMultiFilterValues(
          'rOrg'
        );

  const buildingIds =
    resourceHasOwn(
      options,
      'buildingIds'
    )
      ? options.buildingIds
      : getMultiFilterValues(
          'rBuilding'
        );

  const workIds =
    resourceHasOwn(
      options,
      'workIds'
    )
      ? options.workIds
      : getMultiFilterValues(
          'rWork'
        );

  const frontIds =
    resourceHasOwn(
      options,
      'frontIds'
    )
      ? options.frontIds
      : getMultiFilterValues(
          'rFront'
        );

  const ignoreZeroFilter =
    options.ignoreZeroFilter ===
    true;

  const matches =
    (
      values,
      value
    ) => {
      if (
        values ===
        null
      ) {
        return true;
      }

      if (
        Array.isArray(
          values
        ) &&
        values.length ===
        0
      ) {
        return false;
      }

      return (
        Array.isArray(
          values
        ) &&
        values.includes(
          String(
            value ||
            ''
          )
        )
      );
    };

  return (
    project.resources ||
    []
  )
    .filter(
      row => {
        if (
          from &&
          row.date <
          from
        ) {
          return false;
        }

        if (
          to &&
          row.date >
          to
        ) {
          return false;
        }

        if (
          !matches(
            organizationIds,
            row.organizationId
          )
        ) {
          return false;
        }

        if (
          !matches(
            buildingIds,
            row.buildingId
          )
        ) {
          return false;
        }

        if (
          !matches(
            workIds,
            row.workId
          )
        ) {
          return false;
        }

        if (
          !matches(
            frontIds,
            row.frontId
          )
        ) {
          return false;
        }

        if (
          !ignoreZeroFilter &&
          !resourceShowZero() &&
          resourceTotalPeople(
            row
          ) === 0 &&
          num(
            row.equipmentQty
          ) === 0
        ) {
          return false;
        }

        return true;
      }
    );
}

/* =========================================================
   ДИНАМИЧЕСКАЯ ТЕХНИКА
   ========================================================= */

function resourceAnalyticsEquipmentColumns() {
  const totals =
    new Map();

  resourceFiltered()
    .forEach(
      row => {
        const type =
          normText(
            row.equipmentType
          );

        if (
          !type
        ) {
          return;
        }

        totals.set(
          type,
          (
            totals.get(
              type
            ) ||
            0
          ) +
          num(
            row.equipmentQty
          )
        );
      }
    );

  const types =
    [
      ...totals.entries()
    ]
      .filter(
        (
          [
            type,
            total
          ]
        ) =>
          resourceShowZero() ||
          total !==
          0
      )
      .map(
        (
          [
            type
          ]
        ) =>
          type
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

  return [
    {
      id:
        'organization',

      title:
        'Организация'
    },

    ...types.map(
      type => ({
        id:
          `equipment:${normKey(type)}`,

        title:
          type,

        equipmentType:
          type,

        numeric:
          true
      })
    ),

    {
      id:
        'total',

      title:
        'Итого',

      numeric:
        true,

      total:
        true
    }
  ];
}

/* =========================================================
   СХЕМЫ ТАБЛИЦ
   ========================================================= */

function resourceTableSchema(
  viewName,
  tableId
) {
  const schemas = {
    journal: {
      journal: {
        id:
          'journal',

        title:
          'Журнал ресурсов',

        showTitle:
          false,

        showHeader:
          true,

        showFooter:
          false,

        showRowNumbers:
          false,

        columns:
          RESOURCE_JOURNAL_COLUMNS
      }
    },

    daily: {
      people: {
        id:
          'people',

        title:
          'Люди',

        showTitle:
          true,

        showHeader:
          true,

        showFooter:
          true,

        showRowNumbers:
          true,

        columns:
          RESOURCE_DAILY_PEOPLE_COLUMNS
      },

      equipment: {
        id:
          'equipment',

        title:
          'Техника',

        showTitle:
          true,

        showHeader:
          true,

        showFooter:
          true,

        showRowNumbers:
          true,

        columns:
          RESOURCE_DAILY_EQUIPMENT_COLUMNS
      }
    },

    analytics: {
      people: {
        id:
          'people',

        title:
          'Среднее количество сотрудников',

        showTitle:
          true,

        showHeader:
          true,

        showFooter:
          true,

        showRowNumbers:
          false,

        columns:
          RESOURCE_ANALYTICS_PEOPLE_COLUMNS
      },

      equipment: {
        id:
          'equipment',

        title:
          'Среднее количество строительной техники',

        showTitle:
          true,

        showHeader:
          true,

        showFooter:
          true,

        showRowNumbers:
          false,

        columns:
          resourceAnalyticsEquipmentColumns
      }
    },

    planfact: {
      planfact: {
        id:
          'planfact',

        title:
          'План / факт ресурсов',

        showTitle:
          false,

        showHeader:
          true,

        showFooter:
          true,

        showRowNumbers:
          false,

        columns:
          RESOURCE_PLANFACT_COLUMNS
      }
    }
  };

  return (
    schemas
      ?.[
        viewName
      ]
      ?.[
        tableId
      ] ||
    null
  );
}

function resourceTableConfig(
  viewName,
  tableId
) {
  const schema =
    resourceTableSchema(
      viewName,
      tableId
    );

  if (
    !schema
  ) {
    return null;
  }

  if (
    window
      .LIV_VIEW_BUILDER
      ?.tableConfig
  ) {
    return window
      .LIV_VIEW_BUILDER
      .tableConfig(
        resourceViewKey(
          viewName
        ),
        tableId,
        schema
      );
  }

  const columns =
    typeof schema.columns ===
    'function'
      ? schema.columns()
      : schema.columns;

  return {
    title:
      schema.title ||
      '',

    showTitle:
      schema.showTitle !==
      false,

    showHeader:
      schema.showHeader !==
      false,

    showFooter:
      schema.showFooter !==
      false,

    showRowNumbers:
      schema.showRowNumbers !==
      false,

    hiddenColumns:
      [],

    columnOrder:
      columns.map(
        column =>
          column.id
      ),

    columnTitles:
      {}
  };
}

function resourceVisibleColumns(
  viewName,
  tableId,
  forPrint =
    false
) {
  const schema =
    resourceTableSchema(
      viewName,
      tableId
    );

  if (
    !schema
  ) {
    return [];
  }

  let columns;

  if (
    window
      .LIV_VIEW_BUILDER
      ?.visibleColumns
  ) {
    columns =
      window
        .LIV_VIEW_BUILDER
        .visibleColumns(
          resourceViewKey(
            viewName
          ),
          tableId,
          schema
        );
  } else {
    columns =
      typeof schema.columns ===
      'function'
        ? schema.columns()
        : schema.columns;
  }

  return (
    forPrint
      ? columns.filter(
          column =>
            column.print !==
              false &&
            column.role !==
              'system'
        )
      : columns
  );
}

/* =========================================================
   DOM ТАБЛИЦЫ
   ========================================================= */

function resourceEnsureTable(
  bodyId
) {
  const body =
    document.getElementById(
      bodyId
    );

  const table =
    body
      ?.closest(
        'table'
      );

  if (
    !body ||
    !table
  ) {
    return {};
  }

  let head =
    table.querySelector(
      'thead'
    );

  if (
    !head
  ) {
    head =
      document.createElement(
        'thead'
      );

    table.insertBefore(
      head,
      table.firstChild
    );
  }

  let foot =
    table.querySelector(
      'tfoot'
    );

  if (
    !foot
  ) {
    foot =
      document.createElement(
        'tfoot'
      );

    table.appendChild(
      foot
    );
  }

  const card =
    table.closest(
      '.card'
    );

  const title =
    card
      ?.querySelector(
        'h2,h3'
      ) ||
    null;

  return {
    body,
    table,
    head,
    foot,
    card,
    title
  };
}

function resourceApplyTableChrome(
  viewName,
  tableId,
  bodyId
) {
  const config =
    resourceTableConfig(
      viewName,
      tableId
    );

  const elements =
    resourceEnsureTable(
      bodyId
    );

  if (
    !config
  ) {
    return {
      config:
        null,

      ...elements
    };
  }

  if (
    elements.title
  ) {
    elements.title.textContent =
      config.title ||
      resourceTableSchema(
        viewName,
        tableId
      )
        ?.title ||
      elements.title.textContent;

    elements.title.style.display =
      config.showTitle
        ? ''
        : 'none';
  }

  if (
    elements.head
  ) {
    elements.head.style.display =
      config.showHeader
        ? ''
        : 'none';
  }

  if (
    elements.foot
  ) {
    elements.foot.style.display =
      config.showFooter
        ? ''
        : 'none';
  }

  return {
    config,
    ...elements
  };
}

/* =========================================================
   HTML ТАБЛИЦ
   ========================================================= */

function resourceHeaderHtml(
  columns
) {
  return `
    <tr>

      ${
        columns
          .map(
            column => `
              <th
                class="${column.numeric ? 'num-head' : ''}"
                data-liv-col="${esc(column.id)}">

                ${esc(column.title)}

              </th>
            `
          )
          .join('')
      }

    </tr>
  `;
}

function resourceCellHtml(
  column,
  value,
  rawHtml =
    false
) {
  const classes =
    [
      column.numeric
        ? 'num-cell'
        : '',

      column.total
        ? 'total-cell'
        : ''
    ]
      .filter(
        Boolean
      )
      .join(
        ' '
      );

  return `
    <td
      class="${classes}"
      data-liv-col="${esc(column.id)}">

      ${
        rawHtml
          ? value
          : esc(
              value ??
              ''
            )
      }

    </td>
  `;
}

function resourceFooterHtml(
  columns,
  values,
  label
) {
  if (
    !columns.length
  ) {
    return '';
  }

  const textColumnIndex =
    columns.findIndex(
      column =>
        !column.numeric &&
        column.role !==
          'rowNumber' &&
        column.role !==
          'system'
    );

  const labelIndex =
    textColumnIndex >=
    0
      ? textColumnIndex
      : 0;

  return `
    <tr>

      ${
        columns
          .map(
            (
              column,
              index
            ) => {
              const value =
                values
                  ?.[
                    column.id
                  ];

              const classes =
                [
                  column.numeric
                    ? 'num-head'
                    : '',

                  column.total
                    ? 'total-cell'
                    : ''
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ' '
                  );

              if (
                index ===
                labelIndex
              ) {
                if (
                  value !==
                    undefined &&
                  value !==
                    null &&
                  value !==
                    ''
                ) {
                  return `
                    <th class="${classes}">
                      ${esc(label)} · ${esc(value)}
                    </th>
                  `;
                }

                return `
                  <th class="${classes}">
                    ${esc(label)}
                  </th>
                `;
              }

              return `
                <th class="${classes}">
                  ${
                    value ===
                      undefined ||
                    value ===
                      null
                      ? ''
                      : esc(value)
                  }
                </th>
              `;
            }
          )
          .join('')
      }

    </tr>
  `;
}

/* =========================================================
   ЖУРНАЛ
   ========================================================= */

function resourceJournalValue(
  row,
  columnId
) {
  if (
    columnId ===
    'date'
  ) {
    return ruDate(
      row.date
    );
  }

  if (
    columnId ===
    'organization'
  ) {
    return (
      nameById(
        project.organizations,
        row.organizationId
      ) ||
      '—'
    );
  }

  if (
    columnId ===
    'building'
  ) {
    return (
      nameById(
        project.buildings,
        row.buildingId
      ) ||
      '—'
    );
  }

  if (
    columnId ===
    'work'
  ) {
    return (
      nameById(
        project.works,
        row.workId
      ) ||
      '—'
    );
  }

  if (
    columnId ===
    'front'
  ) {
    const front =
      row.frontId
        ? byId(
            project.fronts,
            row.frontId
          )
        : null;

    return (
      front
        ? frontLabel(
            front
          )
        : '—'
    );
  }

  if (
    [
      'itr',
      'workers',
      'mechanizers',
      'equipmentQty'
    ]
      .includes(
        columnId
      )
  ) {
    return fmt(
      row[
        columnId
      ]
    );
  }

  return (
    row[
      columnId
    ] ??
    ''
  );
}

function resourceRenderJournal() {
  const rows =
    resourceFiltered();

  const columns =
    resourceVisibleColumns(
      'journal',
      'journal'
    );

  const config =
    resourceTableConfig(
      'journal',
      'journal'
    );

  const sum =
    field =>
      rows.reduce(
        (
          result,
          row
        ) =>
          result +
          num(
            row[
              field
            ]
          ),
        0
      );

  const daily =
    {};

  rows.forEach(
    row => {
      if (
        !row.date
      ) {
        return;
      }

      daily[
        row.date
      ] =
        (
          daily[
            row.date
          ] ||
          0
        ) +
        resourceTotalPeople(
          row
        );
    }
  );

  if (
    $('rItr')
  ) {
    $('rItr').textContent =
      Math.round(
        sum(
          'itr'
        )
      );
  }

  if (
    $('rWorkers')
  ) {
    $('rWorkers').textContent =
      Math.round(
        sum(
          'workers'
        )
      );
  }

  if (
    $('rMech')
  ) {
    $('rMech').textContent =
      Math.round(
        sum(
          'mechanizers'
        )
      );
  }

  if (
    $('rTotalPeople')
  ) {
    $('rTotalPeople').textContent =
      Math.round(
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
  }

  if (
    $('rPeak')
  ) {
    $('rPeak').textContent =
      Math.round(
        Math.max(
          0,
          ...Object.values(
            daily
          )
        )
      );
  }

  if (
    $('rEquipDays')
  ) {
    $('rEquipDays').textContent =
      Math.round(
        sum(
          'equipmentQty'
        )
      );
  }

  const visibleIds =
    new Set(
      rows.map(
        row =>
          String(
            row.id
          )
      )
    );

  livResourceSelectedIds =
    new Set(
      [
        ...livResourceSelectedIds
      ]
        .filter(
          id =>
            visibleIds.has(
              id
            )
        )
    );

  if (
    $('resourceHead')
  ) {
    $('resourceHead').style.display =
      config
        ?.showHeader ===
      false
        ? 'none'
        : '';

    $('resourceHead').innerHTML =
      resourceHeaderHtml(
        columns
      );
  }

  if (
    $('resourceRows')
  ) {
    $('resourceRows').innerHTML =
      [
        ...rows
      ]
        .sort(
          (
            a,
            b
          ) =>
            String(
              b.date ||
              ''
            )
              .localeCompare(
                String(
                  a.date ||
                  ''
                )
              )
        )
        .map(
          row => `
            <tr>

              ${
                columns
                  .map(
                    column => {
                      if (
                        column.id ===
                        'select'
                      ) {
                        return resourceCellHtml(
                          column,

                          `
                            <input
                              type="checkbox"
                              data-resource-select="${esc(row.id)}"
                              ${
                                livResourceSelectedIds.has(
                                  String(
                                    row.id
                                  )
                                )
                                  ? 'checked'
                                  : ''
                              }
                            >
                          `,

                          true
                        );
                      }

                      if (
                        column.id ===
                        'actions'
                      ) {
                        return resourceCellHtml(
                          column,

                          `
                            <div class="row-actions">

                              <button
                                class="row-btn"
                                data-resource-edit="${esc(row.id)}">
                                Открыть
                              </button>

                              <button
                                class="row-btn danger-link"
                                data-resource-delete="${esc(row.id)}">
                                Удалить
                              </button>

                            </div>
                          `,

                          true
                        );
                      }

                      return resourceCellHtml(
                        column,
                        resourceJournalValue(
                          row,
                          column.id
                        )
                      );
                    }
                  )
                  .join('')
              }

            </tr>
          `
        )
        .join('');
  }

  document
    .querySelectorAll(
      '[data-resource-select]'
    )
    .forEach(
      checkbox => {
        checkbox.onchange =
          () => {
            const id =
              String(
                checkbox.dataset
                  .resourceSelect
              );

            if (
              checkbox.checked
            ) {
              livResourceSelectedIds.add(
                id
              );
            } else {
              livResourceSelectedIds.delete(
                id
              );
            }

            updateResourceSelectionBar();
          };
      }
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

  document
    .querySelectorAll(
      '[data-resource-delete]'
    )
    .forEach(
      button => {
        button.onclick =
          () =>
            deleteResource(
              button.dataset
                .resourceDelete
            );
      }
    );

  updateResourceSelectionBar();
}

function updateResourceSelectionBar() {
  if (
    $('resourceSelectedCount')
  ) {
    $('resourceSelectedCount').textContent =
      livResourceSelectedIds
        .size
        ? `Выбрано: ${livResourceSelectedIds.size}`
        : 'Ничего не выбрано';
  }

  if (
    $('resourceDeleteSelectedBtn')
  ) {
    $('resourceDeleteSelectedBtn').disabled =
      livResourceSelectedIds
        .size ===
      0;
  }
}

async function deleteSelectedResources() {
  if (
    !livResourceSelectedIds
      .size
  ) {
    return;
  }

  if (
    !confirm(
      `Удалить выбранные записи ресурсов: ${livResourceSelectedIds.size}? Перед удалением будет создана защитная копия.`
    )
  ) {
    return;
  }

  await dbPutKey(
    clone(
      project
    ),
    `pre-resource-delete-${Date.now()}`
  );

  const before =
    (
      project.resources ||
      []
    )
      .length;

  project.resources =
    (
      project.resources ||
      []
    )
      .filter(
        row =>
          !livResourceSelectedIds.has(
            String(
              row.id
            )
          )
      );

  const deleted =
    before -
    project.resources
      .length;

  livResourceSelectedIds
    .clear();

  log(
    'Удалено',
    'Ресурсы',
    `Удалено выбранных записей: ${deleted}`
  );

  await saveProject();

  renderResourceCurrentView();
}

async function deleteFilteredResources() {
  const rows =
    resourceFiltered({
      ignoreZeroFilter:
        true
    });

  if (
    !rows.length
  ) {
    return;
  }

  if (
    !confirm(
      `Удалить ВСЕ записи под текущими фильтрами: ${rows.length}? Перед удалением будет создана защитная копия.`
    )
  ) {
    return;
  }

  await dbPutKey(
    clone(
      project
    ),
    `pre-resource-filter-delete-${Date.now()}`
  );

  const ids =
    new Set(
      rows.map(
        row =>
          String(
            row.id
          )
      )
    );

  project.resources =
    (
      project.resources ||
      []
    )
      .filter(
        row =>
          !ids.has(
            String(
              row.id
            )
          )
      );

  livResourceSelectedIds
    .clear();

  log(
    'Удалено',
    'Ресурсы',
    `Удалено по фильтру: ${rows.length}`
  );

  await saveProject();

  renderResourceCurrentView();
}

/* =========================================================
   РЕДАКТОР
   ========================================================= */

function openResourceEditor(
  id =
    null
) {
  const row =
    id
      ? (
          byId(
            project.resources,
            id
          ) ||
          {}
        )
      : {};

  const frontOptions =
    activeFronts()
      .map(
        front => `
          <option
            value="${esc(front.id)}"
            ${
              String(
                front.id
              ) ===
              String(
                row.frontId ||
                ''
              )
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
      ? 'Ресурсы'
      : 'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">
          <label>Дата</label>
          <input id="rrDate" type="date" value="${esc(row.date || today())}">
        </div>

        <div class="field">
          <label>Организация</label>
          <select id="rrOrg">
            ${selectOptions(project.organizations,row.organizationId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Здание</label>
          <select id="rrBuilding">
            ${selectOptions(project.buildings,row.buildingId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Вид работ</label>
          <select id="rrWork">
            ${selectOptions(project.works,row.workId || '',true)}
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
          <input id="rrItr" type="number" step="1" min="0" value="${row.itr ?? ''}">
        </div>

        <div class="field">
          <label>Подсобные рабочие</label>
          <input id="rrWorkers" type="number" step="1" min="0" value="${row.workers ?? ''}">
        </div>

        <div class="field">
          <label>Механизаторы</label>
          <input id="rrMech" type="number" step="1" min="0" value="${row.mechanizers ?? ''}">
        </div>

        <div class="field">
          <label>Наименование техники</label>
          <input id="rrEqType" value="${esc(row.equipmentType || '')}">
        </div>

        <div class="field">
          <label>Количество техники</label>
          <input id="rrEqQty" type="number" step="1" min="0" value="${row.equipmentQty ?? ''}">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rrComment">${esc(row.comment || '')}</textarea>
      </div>

      <div class="editor-actions">

        ${
          id
            ? '<button id="rrDelete" class="btn danger">Удалить</button>'
            : ''
        }

        <button id="rrSave" class="btn primary">
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

  if (
    id &&
    $('rrDelete')
  ) {
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

  if (
    !row.date
  ) {
    alert(
      'Укажи дату.'
    );

    return;
  }

  if (
    existing
  ) {
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
    `${row.date} · ${nameById(project.organizations,row.organizationId) || 'без организации'}`
  );

  await saveProject();

  closeModal();

  if (
    typeof renderAll ===
    'function'
  ) {
    renderAll();
  } else {
    renderResourceCurrentView();
  }
}

async function deleteResource(
  id
) {
  const row =
    byId(
      project.resources,
      id
    );

  if (
    !row
  ) {
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
    (
      project.resources ||
      []
    )
      .filter(
        item =>
          String(
            item.id
          ) !==
          String(
            id
          )
      );

  log(
    'Удалено',
    'Ресурсы',
    `${row.date} · ${nameById(project.organizations,row.organizationId) || 'без организации'}`
  );

  await saveProject();

  closeModal();

  if (
    typeof renderAll ===
    'function'
  ) {
    renderAll();
  } else {
    renderResourceCurrentView();
  }
}

/* =========================================================
   ЕЖЕДНЕВНАЯ СВОДКА
   ========================================================= */

function resourceDailyModel() {
  const date =
    $('rDailyDate')
      ?.value ||
    $('rTo')
      ?.value ||
    today();

  if (
    $('rDailyDate')
  ) {
    $('rDailyDate').value =
      date;
  }

  const rows =
    resourceFiltered({
      from:
        date,

      to:
        date
    });

  const peopleMap =
    new Map();

  const equipmentMap =
    new Map();

  rows.forEach(
    row => {
      const organizationId =
        String(
          row.organizationId ||
          ''
        );

      if (
        !peopleMap.has(
          organizationId
        )
      ) {
        peopleMap.set(
          organizationId,
          {
            organizationId,
            itr: 0,
            workers: 0,
            mechanizers: 0
          }
        );
      }

      const people =
        peopleMap.get(
          organizationId
        );

      people.itr +=
        num(
          row.itr
        );

      people.workers +=
        num(
          row.workers
        );

      people.mechanizers +=
        num(
          row.mechanizers
        );

      const type =
        normText(
          row.equipmentType
        );

      const quantity =
        num(
          row.equipmentQty
        );

      if (
        type &&
        (
          resourceShowZero() ||
          quantity !==
          0
        )
      ) {
        const key =
          `${organizationId}|${normKey(type)}`;

        if (
          !equipmentMap.has(
            key
          )
        ) {
          equipmentMap.set(
            key,
            {
              organizationId,
              equipmentType:
                type,
              quantity:
                0
            }
          );
        }

        equipmentMap
          .get(
            key
          )
          .quantity +=
            quantity;
      }
    }
  );

  let people =
    [
      ...peopleMap.values()
    ];

  if (
    !resourceShowZero()
  ) {
    people =
      people.filter(
        item =>
          item.itr +
          item.workers +
          item.mechanizers !==
          0
      );
  }

  people.sort(
    (
      a,
      b
    ) =>
      (
        nameById(
          project.organizations,
          a.organizationId
        ) ||
        ''
      )
        .localeCompare(
          nameById(
            project.organizations,
            b.organizationId
          ) ||
          '',
          'ru'
        )
  );

  let equipment =
    [
      ...equipmentMap.values()
    ];

  if (
    !resourceShowZero()
  ) {
    equipment =
      equipment.filter(
        item =>
          num(
            item.quantity
          ) !==
          0
      );
  }

  equipment.sort(
    (
      a,
      b
    ) =>
      (
        nameById(
          project.organizations,
          a.organizationId
        ) ||
        ''
      )
        .localeCompare(
          nameById(
            project.organizations,
            b.organizationId
          ) ||
          '',
          'ru'
        ) ||
      a.equipmentType
        .localeCompare(
          b.equipmentType,
          'ru'
        )
  );

  const totals =
    people.reduce(
      (
        result,
        item
      ) => {
        result.itr +=
          item.itr;

        result.workers +=
          item.workers;

        result.mechanizers +=
          item.mechanizers;

        return result;
      },
      {
        itr:
          0,

        workers:
          0,

        mechanizers:
          0
      }
    );

  totals.total =
    totals.itr +
    totals.workers +
    totals.mechanizers;

  const totalEquipment =
    equipment.reduce(
      (
        sum,
        item
      ) =>
        sum +
        num(
          item.quantity
        ),
      0
    );

  return {
    date,
    people,
    equipment,
    totals,
    totalEquipment
  };
}

function renderResourceDaily() {
  const model =
    resourceDailyModel();

  if (
    $('rdPeopleTotal')
  ) {
    $('rdPeopleTotal').textContent =
      Math.round(
        model.totals.total
      );
  }

  if (
    $('rdEquipmentTotal')
  ) {
    $('rdEquipmentTotal').textContent =
      Math.round(
        model.totalEquipment
      );
  }

  const peopleColumns =
    resourceVisibleColumns(
      'daily',
      'people'
    );

  const peopleElements =
    resourceApplyTableChrome(
      'daily',
      'people',
      'rdPeopleBody'
    );

  if (
    peopleElements.head
  ) {
    peopleElements.head.innerHTML =
      resourceHeaderHtml(
        peopleColumns
      );
  }

  if (
    peopleElements.body
  ) {
    peopleElements.body.innerHTML =
      model.people.length
        ? model.people
            .map(
              (
                item,
                index
              ) => `
                <tr>

                  ${
                    peopleColumns
                      .map(
                        column => {
                          let value =
                            '';

                          if (
                            column.id ===
                            'number'
                          ) {
                            value =
                              index +
                              1;
                          } else if (
                            column.id ===
                            'organization'
                          ) {
                            value =
                              nameById(
                                project.organizations,
                                item.organizationId
                              ) ||
                              '—';
                          } else if (
                            column.id ===
                            'total'
                          ) {
                            value =
                              Math.round(
                                item.itr +
                                item.workers +
                                item.mechanizers
                              );
                          } else {
                            value =
                              Math.round(
                                num(
                                  item[
                                    column.id
                                  ]
                                )
                              );
                          }

                          return resourceCellHtml(
                            column,
                            value
                          );
                        }
                      )
                      .join('')
                  }

                </tr>
              `
            )
            .join('')
        : `
            <tr>
              <td
                colspan="${Math.max(1,peopleColumns.length)}"
                class="resource-empty">
                Нет данных за выбранную дату
              </td>
            </tr>
          `;
  }

  if (
    peopleElements.foot
  ) {
    peopleElements.foot.innerHTML =
      resourceFooterHtml(
        peopleColumns,
        {
          itr:
            Math.round(
              model.totals.itr
            ),

          workers:
            Math.round(
              model.totals.workers
            ),

          mechanizers:
            Math.round(
              model.totals.mechanizers
            ),

          total:
            Math.round(
              model.totals.total
            )
        },
        'Итого'
      );
  }

  const equipmentColumns =
    resourceVisibleColumns(
      'daily',
      'equipment'
    );

  const equipmentElements =
    resourceApplyTableChrome(
      'daily',
      'equipment',
      'rdEquipmentBody'
    );

  if (
    equipmentElements.head
  ) {
    equipmentElements.head.innerHTML =
      resourceHeaderHtml(
        equipmentColumns
      );
  }

  if (
    equipmentElements.body
  ) {
    equipmentElements.body.innerHTML =
      model.equipment.length
        ? model.equipment
            .map(
              (
                item,
                index
              ) => `
                <tr>

                  ${
                    equipmentColumns
                      .map(
                        column => {
                          let value =
                            '';

                          if (
                            column.id ===
                            'number'
                          ) {
                            value =
                              index +
                              1;
                          } else if (
                            column.id ===
                            'organization'
                          ) {
                            value =
                              nameById(
                                project.organizations,
                                item.organizationId
                              ) ||
                              '—';
                          } else if (
                            column.id ===
                            'equipmentType'
                          ) {
                            value =
                              item.equipmentType;
                          } else if (
                            column.id ===
                            'quantity'
                          ) {
                            value =
                              Math.round(
                                item.quantity
                              );
                          }

                          return resourceCellHtml(
                            column,
                            value
                          );
                        }
                      )
                      .join('')
                  }

                </tr>
              `
            )
            .join('')
        : `
            <tr>
              <td
                colspan="${Math.max(1,equipmentColumns.length)}"
                class="resource-empty">
                Нет техники за выбранную дату
              </td>
            </tr>
          `;
  }

  if (
    equipmentElements.foot
  ) {
    equipmentElements.foot.innerHTML =
      resourceFooterHtml(
        equipmentColumns,
        {
          quantity:
            Math.round(
              model.totalEquipment
            )
        },
        'Итого'
      );
  }
}

/* =========================================================
   ДИНАМИКА
   ========================================================= */

function destroyResourceCharts() {
  livResourceCharts.forEach(
    chart => {
      try {
        chart.destroy();
      } catch (
        error
      ) {
      }
    }
  );

  livResourceCharts =
    [];
}

function resourceBucketKey(
  date,
  step
) {
  if (
    step ===
    'week'
  ) {
    return startOfWeek(
      date
    );
  }

  if (
    step ===
    'month'
  ) {
    return (
      String(
        date
      )
        .slice(
          0,
          7
        ) +
      '-01'
    );
  }

  return date;
}

function resourceBucketLabel(
  key,
  step
) {
  if (
    step ===
    'month'
  ) {
    const [
      year,
      month
    ] =
      key.split(
        '-'
      );

    return `${month}.${year}`;
  }

  if (
    step ===
    'week'
  ) {
    return `с ${shortDate(key)}`;
  }

  return shortDate(
    key
  );
}

function resourceDynamicsModel() {
  const metric =
    $('rDynType')
      ?.value ||
    'total';

  const step =
    $('rDynStep')
      ?.value ||
    'week';

  const quick =
    $('rDynOrg')
      ?.value ||
    'all';

  const rows =
    resourceFiltered();

  let organizationIds =
    uniq(
      rows.map(
        row =>
          String(
            row.organizationId ||
            ''
          )
      )
    );

  if (
    quick !==
    'all'
  ) {
    organizationIds =
      organizationIds.filter(
        id =>
          id ===
          quick
      );
  }

  if (
    !resourceShowZero()
  ) {
    organizationIds =
      organizationIds.filter(
        id =>
          resourceActivityTotal(
            rows.filter(
              row =>
                String(
                  row.organizationId ||
                  ''
                ) ===
                id
            )
          ) !==
          0
      );
  }

  organizationIds.sort(
    (
      a,
      b
    ) =>
      (
        nameById(
          project.organizations,
          a
        ) ||
        ''
      )
        .localeCompare(
          nameById(
            project.organizations,
            b
          ) ||
          '',
          'ru'
        )
  );

  return organizationIds.map(
    organizationId => {
      const daily =
        new Map();

      rows
        .filter(
          row =>
            String(
              row.organizationId ||
              ''
            ) ===
            organizationId
        )
        .forEach(
          row => {
            if (
              !row.date
            ) {
              return;
            }

            if (
              !daily.has(
                row.date
              )
            ) {
              daily.set(
                row.date,
                {
                  itr:
                    0,

                  workers:
                    0,

                  mechanizers:
                    0,

                  equipment:
                    0
                }
              );
            }

            const item =
              daily.get(
                row.date
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
          }
        );

      const bucket =
        new Map();

      [
        ...daily
      ]
        .forEach(
          (
            [
              date,
              value
            ]
          ) => {
            const key =
              resourceBucketKey(
                date,
                step
              );

            if (
              !bucket.has(
                key
              )
            ) {
              bucket.set(
                key,
                []
              );
            }

            bucket
              .get(
                key
              )
              .push(
                value
              );
          }
        );

      const keys =
        [
          ...bucket.keys()
        ]
          .sort();

      const average =
        (
          array,
          field
        ) =>
          array.length
            ? Math.round(
                array.reduce(
                  (
                    sum,
                    item
                  ) =>
                    sum +
                    num(
                      item[
                        field
                      ]
                    ),
                  0
                ) /
                array.length
              )
            : null;

      const total =
        array =>
          array.length
            ? Math.round(
                array.reduce(
                  (
                    sum,
                    item
                  ) =>
                    sum +
                    item.itr +
                    item.workers +
                    item.mechanizers,
                  0
                ) /
                array.length
              )
            : null;

      const series =
        [];

      if (
        metric ===
        'total'
      ) {
        series.push({
          label:
            'Общая численность',

          data:
            keys.map(
              key =>
                total(
                  bucket.get(
                    key
                  )
                )
            )
        });
      }

      if (
        metric ===
        'itr'
      ) {
        series.push({
          label:
            'ИТР',

          data:
            keys.map(
              key =>
                average(
                  bucket.get(
                    key
                  ),
                  'itr'
                )
            )
        });
      }

      if (
        metric ===
        'workers'
      ) {
        series.push({
          label:
            'Рабочие',

          data:
            keys.map(
              key =>
                average(
                  bucket.get(
                    key
                  ),
                  'workers'
                )
            )
        });
      }

      if (
        metric ===
        'both'
      ) {
        series.push({
          label:
            'ИТР',

          data:
            keys.map(
              key =>
                average(
                  bucket.get(
                    key
                  ),
                  'itr'
                )
            )
        });

        series.push({
          label:
            'Рабочие',

          data:
            keys.map(
              key =>
                average(
                  bucket.get(
                    key
                  ),
                  'workers'
                )
            )
        });
      }

      if (
        metric ===
        'equipment'
      ) {
        series.push({
          label:
            'Техника',

          data:
            keys.map(
              key =>
                average(
                  bucket.get(
                    key
                  ),
                  'equipment'
                )
            )
        });
      }

      return {
        organizationId,

        title:
          nameById(
            project.organizations,
            organizationId
          ) ||
          'Без организации',

        labels:
          keys.map(
            key =>
              resourceBucketLabel(
                key,
                step
              )
          ),

        series
      };
    }
  );
}

function renderResourceDynamics() {
  destroyResourceCharts();

  const container =
    $('resourceCharts');

  if (
    !container
  ) {
    return;
  }

  container.innerHTML =
    '';

  if (
    typeof Chart ===
    'undefined'
  ) {
    container.innerHTML =
      '<div class="card muted">Библиотека диаграмм не загрузилась.</div>';

    return;
  }

  const models =
    resourceDynamicsModel();

  if (
    !models.length
  ) {
    container.innerHTML =
      '<div class="card muted">Нет данных для диаграмм.</div>';

    return;
  }

  models.forEach(
    model => {
      const card =
        document.createElement(
          'div'
        );

      card.className =
        'card resource-chart-card';

      card.innerHTML = `
        <div class="chart-head">
          <h2>${esc(model.title)}</h2>
        </div>

        <div class="chart-box">
          <canvas></canvas>
        </div>
      `;

      container.appendChild(
        card
      );

      const datasets =
        model.series.map(
          series => ({
            label:
              series.label,

            data:
              series.data,

            borderWidth:
              2,

            tension:
              0,

            spanGaps:
              false
          })
        );

      livResourceCharts.push(
        new Chart(
          card.querySelector(
            'canvas'
          ),
          {
            type:
              'line',

            data: {
              labels:
                model.labels,

              datasets
            },

            options: {
              responsive:
                true,

              maintainAspectRatio:
                false,

              interaction: {
                mode:
                  'index',

                intersect:
                  false
              },

              scales: {
                y: {
                  beginAtZero:
                    true,

                  ticks: {
                    precision:
                      0
                  }
                }
              },

              plugins: {
                legend: {
                  display:
                    datasets.length >
                    1,

                  position:
                    'top'
                }
              }
            }
          }
        )
      );
    }
  );
}

/* =========================================================
   АНАЛИТИКА
   ========================================================= */

function groupResourcesByOrganizationAndDay(
  rows
) {
  const map =
    new Map();

  (
    rows ||
    []
  )
    .forEach(
      row => {
        const key =
          `${row.organizationId || ''}|${row.date || ''}`;

        if (
          !map.has(
            key
          )
        ) {
          map.set(
            key,
            {
              organizationId:
                row.organizationId ||
                '',

              date:
                row.date ||
                '',

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
          map.get(
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

        const type =
          normText(
            row.equipmentType
          );

        if (
          type
        ) {
          item.equipmentTypes[
            type
          ] =
            (
              item.equipmentTypes[
                type
              ] ||
              0
            ) +
            num(
              row.equipmentQty
            );
        }
      }
    );

  return [
    ...map.values()
  ];
}

function analyticsDates(
  rows,
  organizationId
) {
  const method =
    $('rAvgMethod')
      ?.value ||
    'reported';

  const from =
    $('rFrom')
      ?.value ||
    '';

  const to =
    $('rTo')
      ?.value ||
    '';

  const organizationDates =
    uniq(
      rows
        .filter(
          row =>
            String(
              row.organizationId ||
              ''
            ) ===
            String(
              organizationId
            )
        )
        .map(
          row =>
            row.date
        )
        .filter(
          Boolean
        )
    )
      .sort();

  if (
    method ===
    'calendar'
  ) {
    return dateRange(
      from,
      to
    );
  }

  if (
    method ===
    'workdays'
  ) {
    return dateRange(
      from,
      to
    )
      .filter(
        isWorkday
      );
  }

  if (
    method ===
    'project-report-days'
  ) {
    return uniq(
      rows
        .map(
          row =>
            row.date
        )
        .filter(
          Boolean
        )
    )
      .sort();
  }

  return organizationDates;
}

function averageByDate(
  daily,
  allRows,
  organizationId,
  metric
) {
  const method =
    $('rAvgMethod')
      ?.value ||
    'reported';

  const missingRule =
    $('rMissingRule')
      ?.value ||
    'skip';

  const own =
    daily.filter(
      item =>
        String(
          item.organizationId ||
          ''
        ) ===
        String(
          organizationId
        )
    );

  const map =
    new Map(
      own.map(
        item => [
          item.date,
          num(
            item[
              metric
            ]
          )
        ]
      )
    );

  if (
    method ===
    'nonzero'
  ) {
    const values =
      [
        ...map.values()
      ]
        .filter(
          value =>
            value !==
            0
        );

    return {
      average:
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
          : 0,

      days:
        values.length
    };
  }

  const values =
    [];

  analyticsDates(
    allRows,
    organizationId
  )
    .forEach(
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

  return {
    average:
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
        : 0,

    days:
      values.length
  };
}

function resourceAnalyticsModel() {
  const rows =
    resourceFiltered();

  const daily =
    groupResourcesByOrganizationAndDay(
      rows
    );

  let organizationIds =
    uniq(
      rows.map(
        row =>
          String(
            row.organizationId ||
            ''
          )
      )
    )
      .sort(
        (
          a,
          b
        ) =>
          (
            nameById(
              project.organizations,
              a
            ) ||
            ''
          )
            .localeCompare(
              nameById(
                project.organizations,
                b
              ) ||
              '',
              'ru'
            )
      );

  if (
    !resourceShowZero()
  ) {
    organizationIds =
      organizationIds.filter(
        id =>
          resourceActivityTotal(
            rows.filter(
              row =>
                String(
                  row.organizationId ||
                  ''
                ) ===
                id
            )
          ) !==
          0
      );
  }

  const people =
    organizationIds
      .map(
        organizationId => {
          const own =
            daily
              .filter(
                item =>
                  String(
                    item.organizationId ||
                    ''
                  ) ===
                  organizationId
              )
              .map(
                item => ({
                  ...item,

                  totalPeople:
                    item.itr +
                    item.workers +
                    item.mechanizers
                })
              );

          return {
            organizationId,

            itr:
              averageByDate(
                daily,
                rows,
                organizationId,
                'itr'
              )
                .average,

            workers:
              averageByDate(
                daily,
                rows,
                organizationId,
                'workers'
              )
                .average,

            mechanizers:
              averageByDate(
                daily,
                rows,
                organizationId,
                'mechanizers'
              )
                .average,

            total:
              averageByDate(
                own,
                rows,
                organizationId,
                'totalPeople'
              )
                .average
          };
        }
      )
      .filter(
        item =>
          resourceShowZero() ||
          item.total !==
          0
      );

  const equipmentColumns =
    resourceAnalyticsEquipmentColumns();

  const equipmentTypeColumns =
    equipmentColumns.filter(
      column =>
        column.equipmentType
    );

  const equipment =
    organizationIds
      .map(
        organizationId => {
          const cells =
            {};

          equipmentTypeColumns.forEach(
            column => {
              const own =
                daily
                  .filter(
                    item =>
                      String(
                        item.organizationId ||
                        ''
                      ) ===
                      organizationId
                  )
                  .map(
                    item => ({
                      ...item,

                      metric:
                        num(
                          item
                            .equipmentTypes[
                              column.equipmentType
                            ]
                        )
                    })
                  );

              cells[
                column.id
              ] =
                averageByDate(
                  own,
                  rows,
                  organizationId,
                  'metric'
                )
                  .average;
            }
          );

          return {
            organizationId,
            cells,

            total:
              Object
                .values(
                  cells
                )
                .reduce(
                  (
                    sum,
                    value
                  ) =>
                    sum +
                    num(
                      value
                    ),
                  0
                )
          };
        }
      )
      .filter(
        item =>
          resourceShowZero() ||
          item.total !==
          0
      );

  const mean =
    (
      array,
      getter
    ) =>
      array.length
        ? array.reduce(
            (
              sum,
              item
            ) =>
              sum +
              num(
                getter(
                  item
                )
              ),
            0
          ) /
          array.length
        : 0;

  const peopleFooter = {
    itr:
      Math.round(
        mean(
          people,
          item =>
            item.itr
        )
      ),

    mechanizers:
      Math.round(
        mean(
          people,
          item =>
            item.mechanizers
        )
      ),

    workers:
      Math.round(
        mean(
          people,
          item =>
            item.workers
        )
      ),

    total:
      Math.round(
        mean(
          people,
          item =>
            item.total
        )
      )
  };

  const equipmentFooter =
    {};

  equipmentTypeColumns.forEach(
    column => {
      equipmentFooter[
        column.id
      ] =
        Math.round(
          mean(
            equipment,
            item =>
              item.cells[
                column.id
              ]
          )
        );
    }
  );

  equipmentFooter.total =
    Math.round(
      mean(
        equipment,
        item =>
          item.total
      )
    );

  const global =
    new Map();

  rows.forEach(
    row => {
      if (
        !row.date
      ) {
        return;
      }

      if (
        !global.has(
          row.date
        )
      ) {
        global.set(
          row.date,
          {
            people:
              0,

            equipment:
              0
          }
        );
      }

      const item =
        global.get(
          row.date
        );

      item.people +=
        resourceTotalPeople(
          row
        );

      item.equipment +=
        num(
          row.equipmentQty
        );
    }
  );

  let dates =
    [
      ...global.keys()
    ]
      .sort();

  const method =
    $('rAvgMethod')
      ?.value ||
    'reported';

  const missing =
    $('rMissingRule')
      ?.value ||
    'skip';

  if (
    method ===
    'calendar'
  ) {
    dates =
      dateRange(
        $('rFrom').value,
        $('rTo').value
      );
  } else if (
    method ===
    'workdays'
  ) {
    dates =
      dateRange(
        $('rFrom').value,
        $('rTo').value
      )
        .filter(
          isWorkday
        );
  }

  const peopleValues =
    [];

  const equipmentValues =
    [];

  dates.forEach(
    date => {
      const item =
        global.get(
          date
        );

      if (
        item
      ) {
        if (
          method !==
            'nonzero' ||
          item.people !==
            0
        ) {
          peopleValues.push(
            item.people
          );
        }

        if (
          method !==
            'nonzero' ||
          item.equipment !==
            0
        ) {
          equipmentValues.push(
            item.equipment
          );
        }
      } else if (
        missing ===
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

  const average =
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

  return {
    rows,
    people,
    peopleFooter,
    equipment,
    equipmentFooter,
    equipmentColumns,

    kpis: {
      peopleAvg:
        Math.round(
          average(
            peopleValues
          )
        ),

      equipmentAvg:
        Math.round(
          average(
            equipmentValues
          )
        ),

      daysCount:
        Math.max(
          peopleValues.length,
          equipmentValues.length
        )
    }
  };
}

function renderResourceAnalytics() {
  const model =
    resourceAnalyticsModel();

  if (
    $('raPeopleAvg')
  ) {
    $('raPeopleAvg').textContent =
      model.kpis.peopleAvg;
  }

  if (
    $('raEquipmentAvg')
  ) {
    $('raEquipmentAvg').textContent =
      model.kpis.equipmentAvg;
  }

  if (
    $('raDaysCount')
  ) {
    $('raDaysCount').textContent =
      model.kpis.daysCount;
  }

  const peopleColumns =
    resourceVisibleColumns(
      'analytics',
      'people'
    );

  const peopleElements =
    resourceApplyTableChrome(
      'analytics',
      'people',
      'raPeopleBody'
    );

  if (
    peopleElements.head
  ) {
    peopleElements.head.innerHTML =
      resourceHeaderHtml(
        peopleColumns
      );
  }

  if (
    peopleElements.body
  ) {
    peopleElements.body.innerHTML =
      model.people.length
        ? model.people
            .map(
              item => `
                <tr>

                  ${
                    peopleColumns
                      .map(
                        column => {
                          const value =
                            column.id ===
                            'organization'
                              ? (
                                  nameById(
                                    project.organizations,
                                    item.organizationId
                                  ) ||
                                  '—'
                                )
                              : Math.round(
                                  num(
                                    item[
                                      column.id
                                    ]
                                  )
                                );

                          return resourceCellHtml(
                            column,
                            value
                          );
                        }
                      )
                      .join('')
                  }

                </tr>
              `
            )
            .join('')
        : `
            <tr>

              <td
                colspan="${Math.max(1,peopleColumns.length)}"
                class="resource-empty">
                Нет данных
              </td>

            </tr>
          `;
  }

  if (
    peopleElements.foot
  ) {
    peopleElements.foot.innerHTML =
      resourceFooterHtml(
        peopleColumns,
        model.peopleFooter,
        'Среднее по организациям'
      );
  }

  const equipmentColumns =
    resourceVisibleColumns(
      'analytics',
      'equipment'
    );

  const equipmentElements =
    resourceApplyTableChrome(
      'analytics',
      'equipment',
      'raEquipmentBody'
    );

  if (
    equipmentElements.head
  ) {
    equipmentElements.head.innerHTML =
      resourceHeaderHtml(
        equipmentColumns
      );
  }

  if (
    equipmentElements.body
  ) {
    equipmentElements.body.innerHTML =
      model.equipment.length
        ? model.equipment
            .map(
              item => `
                <tr>

                  ${
                    equipmentColumns
                      .map(
                        column => {
                          let value =
                            '';

                          if (
                            column.id ===
                            'organization'
                          ) {
                            value =
                              nameById(
                                project.organizations,
                                item.organizationId
                              ) ||
                              '—';
                          } else if (
                            column.id ===
                            'total'
                          ) {
                            value =
                              Math.round(
                                item.total
                              );
                          } else {
                            value =
                              Math.round(
                                num(
                                  item.cells[
                                    column.id
                                  ]
                                )
                              );
                          }

                          return resourceCellHtml(
                            column,
                            value
                          );
                        }
                      )
                      .join('')
                  }

                </tr>
              `
            )
            .join('')
        : `
            <tr>

              <td
                colspan="${Math.max(1,equipmentColumns.length)}"
                class="resource-empty">
                Нет техники
              </td>

            </tr>
          `;
  }

  if (
    equipmentElements.foot
  ) {
    equipmentElements.foot.innerHTML =
      resourceFooterHtml(
        equipmentColumns,
        model.equipmentFooter,
        'Среднее по организациям'
      );
  }
}

/* =========================================================
   ПЛАН / ФАКТ
   ========================================================= */

function resourcePlanFiltered() {
  const organizations =
    getMultiFilterValues(
      'rOrg'
    );

  const buildings =
    getMultiFilterValues(
      'rBuilding'
    );

  const works =
    getMultiFilterValues(
      'rWork'
    );

  const fronts =
    getMultiFilterValues(
      'rFront'
    );

  const from =
    $('rFrom')
      ?.value ||
    '';

  const to =
    $('rTo')
      ?.value ||
    '';

  const matches =
    (
      values,
      value
    ) =>
      values ===
      null
        ? true
        : (
            Array.isArray(
              values
            ) &&
            values.length
              ? values.includes(
                  String(
                    value ||
                    ''
                  )
                )
              : false
          );

  return (
    project.resourcePlans ||
    []
  )
    .filter(
      plan =>
        (
          !from ||
          plan.endDate >=
          from
        ) &&
        (
          !to ||
          plan.startDate <=
          to
        ) &&
        matches(
          organizations,
          plan.organizationId
        ) &&
        matches(
          buildings,
          plan.buildingId
        ) &&
        matches(
          works,
          plan.workId
        ) &&
        matches(
          fronts,
          plan.frontId
        )
    );
}

function openResourcePlanEditor(
  id =
    null
) {
  const plan =
    id
      ? (
          byId(
            project.resourcePlans,
            id
          ) ||
          {}
        )
      : {};

  const frontOptions =
    activeFronts()
      .map(
        front => `
          <option
            value="${esc(front.id)}"
            ${
              String(
                front.id
              ) ===
              String(
                plan.frontId ||
                ''
              )
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
      ? 'План ресурсов'
      : 'Добавить план ресурсов',

    `
      <div class="form-grid">

        <div class="field">
          <label>Организация</label>
          <select id="rpOrg">
            ${selectOptions(project.organizations,plan.organizationId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Здание</label>
          <select id="rpBuilding">
            ${selectOptions(project.buildings,plan.buildingId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Работа</label>
          <select id="rpWork">
            ${selectOptions(project.works,plan.workId || '',true)}
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
          <label>С</label>
          <input id="rpStart" type="date" value="${esc(plan.startDate || today())}">
        </div>

        <div class="field">
          <label>По</label>
          <input id="rpEnd" type="date" value="${esc(plan.endDate || today())}">
        </div>

        <div class="field">
          <label>План, чел.</label>
          <input id="rpPeople" type="number" step="1" min="0" value="${plan.people ?? ''}">
        </div>

        <div class="field">
          <label>Источник / метод</label>
          <input id="rpMethod" value="${esc(plan.method || 'Ручной')}">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rpComment">${esc(plan.comment || '')}</textarea>
      </div>

      <div class="editor-actions">

        ${
          id
            ? '<button id="rpDelete" class="btn danger">Удалить</button>'
            : ''
        }

        <button id="rpSave" class="btn primary">
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

  if (
    id &&
    $('rpDelete')
  ) {
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

  const row = {
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

    people:
      num(
        $('rpPeople').value
      ),

    method:
      $('rpMethod')
        .value
        .trim(),

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
    !row.startDate ||
    !row.endDate ||
    row.endDate <
    row.startDate
  ) {
    alert(
      'Проверь период плана.'
    );

    return;
  }

  if (
    existing
  ) {
    Object.assign(
      existing,
      row
    );
  } else {
    project.resourcePlans.push(
      row
    );
  }

  log(
    existing
      ? 'Изменено'
      : 'Создано',
    'План ресурсов',
    `${row.startDate}—${row.endDate}`
  );

  await saveProject();

  closeModal();

  renderResourcePlanFact();
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
    (
      project.resourcePlans ||
      []
    )
      .filter(
        item =>
          String(
            item.id
          ) !==
          String(
            id
          )
      );

  log(
    'Удалено',
    'План ресурсов',
    id
  );

  await saveProject();

  closeModal();

  renderResourcePlanFact();
}

function resourcePlanFactModel() {
  const plans =
    resourcePlanFiltered();

  const facts =
    resourceFiltered();

  const step =
    $('rpStep')
      ?.value ||
    'week';

  const from =
    $('rFrom')
      ?.value ||
    today();

  const to =
    $('rTo')
      ?.value ||
    today();

  const planMap =
    new Map();

  const factMap =
    new Map();

  plans.forEach(
    plan => {
      dateRange(
        plan.startDate,
        plan.endDate
      )
        .forEach(
          date => {
            if (
              (
                from &&
                date <
                from
              ) ||
              (
                to &&
                date >
                to
              )
            ) {
              return;
            }

            const key =
              resourceBucketKey(
                date,
                step
              );

            planMap.set(
              key,
              (
                planMap.get(
                  key
                ) ||
                0
              ) +
              num(
                plan.people
              )
            );
          }
        );
    }
  );

  const factDaily =
    new Map();

  facts.forEach(
    row => {
      if (
        !row.date
      ) {
        return;
      }

      factDaily.set(
        row.date,
        (
          factDaily.get(
            row.date
          ) ||
          0
        ) +
        resourceTotalPeople(
          row
        )
      );
    }
  );

  [
    ...factDaily
  ]
    .forEach(
      (
        [
          date,
          value
        ]
      ) => {
        const key =
          resourceBucketKey(
            date,
            step
          );

        factMap.set(
          key,
          (
            factMap.get(
              key
            ) ||
            0
          ) +
          value
        );
      }
    );

  const keys =
    uniq(
      [
        ...planMap.keys(),
        ...factMap.keys()
      ]
    )
      .sort();

  const rows =
    keys.map(
      key => {
        const plan =
          num(
            planMap.get(
              key
            )
          );

        const fact =
          num(
            factMap.get(
              key
            )
          );

        return {
          period:
            resourceBucketLabel(
              key,
              step
            ),

          plan:
            Math.round(
              plan
            ),

          fact:
            Math.round(
              fact
            ),

          deviation:
            Math.round(
              fact -
              plan
            )
        };
      }
    );

  const totals =
    rows.reduce(
      (
        result,
        row
      ) => {
        result.plan +=
          row.plan;

        result.fact +=
          row.fact;

        result.deviation +=
          row.deviation;

        return result;
      },
      {
        plan:
          0,

        fact:
          0,

        deviation:
          0
      }
    );

  return {
    rows,
    totals
  };
}

function renderResourcePlanFact() {
  const model =
    resourcePlanFactModel();

  if (
    $('rpPlanSum')
  ) {
    $('rpPlanSum').textContent =
      Math.round(
        model.totals.plan
      );
  }

  if (
    $('rpFactSum')
  ) {
    $('rpFactSum').textContent =
      Math.round(
        model.totals.fact
      );
  }

  if (
    $('rpDeviation')
  ) {
    $('rpDeviation').textContent =
      Math.round(
        model.totals.deviation
      );
  }

  const columns =
    resourceVisibleColumns(
      'planfact',
      'planfact'
    );

  const elements =
    resourceApplyTableChrome(
      'planfact',
      'planfact',
      'rpBody'
    );

  if (
    elements.head
  ) {
    elements.head.innerHTML =
      resourceHeaderHtml(
        columns
      );
  }

  if (
    elements.body
  ) {
    elements.body.innerHTML =
      model.rows
        .map(
          row => `
            <tr>

              ${
                columns
                  .map(
                    column =>
                      resourceCellHtml(
                        column,
                        row[
                          column.id
                        ]
                      )
                  )
                  .join('')
              }

            </tr>
          `
        )
        .join('');
  }

  if (
    elements.foot
  ) {
    elements.foot.innerHTML =
      resourceFooterHtml(
        columns,
        model.totals,
        'Итого'
      );
  }

  if (
    livResourcePlanFactChart
  ) {
    try {
      livResourcePlanFactChart.destroy();
    } catch (
      error
    ) {
    }
  }

  const canvas =
    $('resourcePlanFactChart');

  if (
    canvas &&
    typeof Chart !==
    'undefined'
  ) {
    livResourcePlanFactChart =
      new Chart(
        canvas,
        {
          type:
            'line',

          data: {
            labels:
              model.rows.map(
                row =>
                  row.period
              ),

            datasets: [
              {
                label:
                  'План',

                data:
                  model.rows.map(
                    row =>
                      row.plan
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
                  model.rows.map(
                    row =>
                      row.fact
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

            maintainAspectRatio:
              false,

            scales: {
              y: {
                beginAtZero:
                  true,

                ticks: {
                  precision:
                    0
                }
              }
            }
          }
        }
      );
  }
}

/* =========================================================
   СОХРАНЕНИЕ СОСТОЯНИЯ ФИЛЬТРОВ
   ========================================================= */

function resourceSetMultiFilter(
  selectId,
  values
) {
  if (
    typeof multiFilters ===
    'undefined'
  ) {
    return;
  }

  const state =
    multiFilters.get(
      selectId
    );

  if (
    !state
  ) {
    return;
  }

  if (
    values ===
      null ||
    values ===
      undefined
  ) {
    state.mode =
      'all';

    state.selected.clear();
  } else {
    state.mode =
      'custom';

    state.selected =
      new Set(
        (
          values ||
          []
        )
          .map(
            String
          )
      );
  }

  const mount =
    document.getElementById(
      state.mountId
    );

  const summary =
    mount
      ?.querySelector(
        '.multi-filter-summary'
      );

  if (
    !summary
  ) {
    return;
  }

  if (
    state.mode ===
    'all'
  ) {
    summary.textContent =
      state.allLabel;
  } else if (
    state.selected.size ===
    0
  ) {
    summary.textContent =
      'Ничего не выбрано';
  } else if (
    state.selected.size ===
    1
  ) {
    const id =
      [
        ...state.selected
      ][
        0
      ];

    const option =
      [
        ...document
          .getElementById(
            selectId
          )
          .options
      ]
        .find(
          item =>
            String(
              item.value
            ) ===
            id
        );

    summary.textContent =
      option?.textContent ||
      '1 выбрано';
  } else {
    const total =
      [
        ...document
          .getElementById(
            selectId
          )
          .options
      ]
        .filter(
          item =>
            item.value !==
            'all'
        )
        .length;

    summary.textContent =
      `Выбрано: ${state.selected.size} из ${total}`;
  }
}

function resourceCaptureViewState(
  viewName
) {
  return {
    from:
      $('rFrom')
        ?.value ||
      '',

    to:
      $('rTo')
        ?.value ||
      '',

    organizations:
      getMultiFilterValues(
        'rOrg'
      ),

    buildings:
      getMultiFilterValues(
        'rBuilding'
      ),

    works:
      getMultiFilterValues(
        'rWork'
      ),

    fronts:
      getMultiFilterValues(
        'rFront'
      ),

    showZero:
      resourceShowZero(),

    dailyDate:
      $('rDailyDate')
        ?.value ||
      '',

    dynType:
      $('rDynType')
        ?.value ||
      'total',

    dynStep:
      $('rDynStep')
        ?.value ||
      'week',

    dynOrg:
      $('rDynOrg')
        ?.value ||
      'all',

    avgMethod:
      $('rAvgMethod')
        ?.value ||
      'reported',

    missingRule:
      $('rMissingRule')
        ?.value ||
      'skip',

    planFactStep:
      $('rpStep')
        ?.value ||
      'week',

    viewName
  };
}

function resourceApplyViewState(
  state
) {
  if (
    !state
  ) {
    return;
  }

  if (
    $('rFrom')
  ) {
    $('rFrom').value =
      state.from ||
      '';
  }

  if (
    $('rTo')
  ) {
    $('rTo').value =
      state.to ||
      '';
  }

  resourceSetMultiFilter(
    'rOrg',
    state.organizations ??
    null
  );

  resourceSetMultiFilter(
    'rBuilding',
    state.buildings ??
    null
  );

  resourceSetMultiFilter(
    'rWork',
    state.works ??
    null
  );

  resourceSetMultiFilter(
    'rFront',
    state.fronts ??
    null
  );

  if (
    $('rShowZero')
  ) {
    $('rShowZero').checked =
      state.showZero ===
      true;
  }

  if (
    $('rDailyDate') &&
    state.dailyDate
  ) {
    $('rDailyDate').value =
      state.dailyDate;
  }

  if (
    $('rDynType') &&
    state.dynType
  ) {
    $('rDynType').value =
      state.dynType;
  }

  if (
    $('rDynStep') &&
    state.dynStep
  ) {
    $('rDynStep').value =
      state.dynStep;
  }

  if (
    $('rDynOrg') &&
    state.dynOrg
  ) {
    $('rDynOrg').value =
      state.dynOrg;
  }

  if (
    $('rAvgMethod') &&
    state.avgMethod
  ) {
    $('rAvgMethod').value =
      state.avgMethod;
  }

  if (
    $('rMissingRule') &&
    state.missingRule
  ) {
    $('rMissingRule').value =
      state.missingRule;
  }

  if (
    $('rpStep') &&
    state.planFactStep
  ) {
    $('rpStep').value =
      state.planFactStep;
  }
}

/* =========================================================
   ПЕЧАТЬ
   ========================================================= */

function resourcePrintTable(
  viewName,
  tableId,
  rows,
  footerValues =
    null,
  footerLabel =
    'Итого'
) {
  const schema =
    resourceTableSchema(
      viewName,
      tableId
    );

  const config =
    resourceTableConfig(
      viewName,
      tableId
    );

  const columns =
    resourceVisibleColumns(
      viewName,
      tableId,
      true
    );

  if (
    !schema ||
    !config ||
    !columns.length
  ) {
    return '';
  }

  const title =
    config.showTitle &&
    (
      config.title ||
      schema.title
    )
      ? `
          <h2>
            ${esc(config.title || schema.title)}
          </h2>
        `
      : '';

  const head =
    config.showHeader
      ? `
          <thead>
            ${resourceHeaderHtml(columns)}
          </thead>
        `
      : '';

  const body = `
    <tbody>

      ${
        rows.length
          ? rows
              .map(
                row => `
                  <tr>

                    ${
                      columns
                        .map(
                          column =>
                            resourceCellHtml(
                              column,
                              row[
                                column.id
                              ]
                            )
                        )
                        .join('')
                    }

                  </tr>
                `
              )
              .join('')
          : `
              <tr>
                <td
                  colspan="${columns.length}"
                  class="muted">
                  Нет данных
                </td>
              </tr>
            `
      }

    </tbody>
  `;

  const foot =
    config.showFooter &&
    footerValues
      ? `
          <tfoot>
            ${
              resourceFooterHtml(
                columns,
                footerValues,
                footerLabel
              )
            }
          </tfoot>
        `
      : '';

  return `
    <section class="liv-report-section">
      ${title}
      <table>
        ${head}
        ${body}
        ${foot}
      </table>
    </section>
  `;
}

function resourcePrintKpis(
  items,
  viewName
) {
  const settings =
    window
      .LIV_VIEW_BUILDER
      ?.settings
      ? window
          .LIV_VIEW_BUILDER
          .settings(
            resourceViewKey(
              viewName
            )
          )
      : null;

  const hidden =
    new Set(
      settings
        ?.hiddenKpis ||
      []
    );

  const order =
    settings
      ?.kpiOrder ||
    [];

  const map =
    new Map(
      items.map(
        item => [
          item.id,
          item
        ]
      )
    );

  const ordered =
    [];

  order.forEach(
    id => {
      if (
        map.has(
          id
        )
      ) {
        ordered.push(
          map.get(
            id
          )
        );
      }
    }
  );

  items.forEach(
    item => {
      if (
        !ordered.some(
          current =>
            current.id ===
            item.id
        )
      ) {
        ordered.push(
          item
        );
      }
    }
  );

  const visible =
    ordered.filter(
      item =>
        !hidden.has(
          item.id
        )
    );

  if (
    !visible.length
  ) {
    return '';
  }

  return `
    <div class="liv-report-kpis">

      ${
        visible
          .map(
            item => `
              <div class="liv-report-kpi">

                <span>
                  ${esc(item.title)}
                </span>

                <strong>
                  ${esc(item.value)}
                </strong>

              </div>
            `
          )
          .join('')
      }

    </div>
  `;
}

function resourcePrintJournal() {
  const rows =
    resourceFiltered();

  const printRows =
    rows.map(
      row => {
        const result =
          {};

        resourceVisibleColumns(
          'journal',
          'journal',
          true
        )
          .forEach(
            column => {
              result[
                column.id
              ] =
                resourceJournalValue(
                  row,
                  column.id
                );
            }
          );

        return result;
      }
    );

  return resourcePrintTable(
    'journal',
    'journal',
    printRows
  );
}

function resourcePrintDaily() {
  const model =
    resourceDailyModel();

  const peopleRows =
    model.people.map(
      (
        item,
        index
      ) => ({
        number:
          index +
          1,

        organization:
          nameById(
            project.organizations,
            item.organizationId
          ) ||
          '—',

        itr:
          Math.round(
            item.itr
          ),

        workers:
          Math.round(
            item.workers
          ),

        mechanizers:
          Math.round(
            item.mechanizers
          ),

        total:
          Math.round(
            item.itr +
            item.workers +
            item.mechanizers
          )
      })
    );

  const equipmentRows =
    model.equipment.map(
      (
        item,
        index
      ) => ({
        number:
          index +
          1,

        organization:
          nameById(
            project.organizations,
            item.organizationId
          ) ||
          '—',

        equipmentType:
          item.equipmentType,

        quantity:
          Math.round(
            item.quantity
          )
      })
    );

  return [
    resourcePrintKpis(
      [
        {
          id:
            'peopleTotal',

          title:
            'Сотрудников на объекте',

          value:
            Math.round(
              model.totals.total
            )
        },

        {
          id:
            'equipmentTotal',

          title:
            'Техники на объекте',

          value:
            Math.round(
              model.totalEquipment
            )
        }
      ],
      'daily'
    ),

    resourcePrintTable(
      'daily',
      'people',
      peopleRows,
      {
        itr:
          Math.round(
            model.totals.itr
          ),

        workers:
          Math.round(
            model.totals.workers
          ),

        mechanizers:
          Math.round(
            model.totals.mechanizers
          ),

        total:
          Math.round(
            model.totals.total
          )
      },
      'Итого'
    ),

    resourcePrintTable(
      'daily',
      'equipment',
      equipmentRows,
      {
        quantity:
          Math.round(
            model.totalEquipment
          )
      },
      'Итого'
    )
  ]
    .join('');
}

function resourcePrintAnalytics() {
  const model =
    resourceAnalyticsModel();

  const peopleRows =
    model.people.map(
      item => ({
        organization:
          nameById(
            project.organizations,
            item.organizationId
          ) ||
          '—',

        itr:
          Math.round(
            item.itr
          ),

        mechanizers:
          Math.round(
            item.mechanizers
          ),

        workers:
          Math.round(
            item.workers
          ),

        total:
          Math.round(
            item.total
          )
      })
    );

  const equipmentRows =
    model.equipment.map(
      item => {
        const row = {
          organization:
            nameById(
              project.organizations,
              item.organizationId
            ) ||
            '—',

          total:
            Math.round(
              item.total
            )
        };

        Object.entries(
          item.cells
        )
          .forEach(
            (
              [
                key,
                value
              ]
            ) => {
              row[
                key
              ] =
                Math.round(
                  value
                );
            }
          );

        return row;
      }
    );

  return [
    resourcePrintKpis(
      [
        {
          id:
            'peopleAvg',

          title:
            'Среднее сотрудников',

          value:
            model.kpis.peopleAvg
        },

        {
          id:
            'equipmentAvg',

          title:
            'Среднее техники',

          value:
            model.kpis.equipmentAvg
        },

        {
          id:
            'daysCount',

          title:
            'Дней в расчете',

          value:
            model.kpis.daysCount
        }
      ],
      'analytics'
    ),

    resourcePrintTable(
      'analytics',
      'people',
      peopleRows,
      model.peopleFooter,
      'Среднее по организациям'
    ),

    resourcePrintTable(
      'analytics',
      'equipment',
      equipmentRows,
      model.equipmentFooter,
      'Среднее по организациям'
    )
  ]
    .join('');
}

function resourcePrintDynamics() {
  const cards =
    [
      ...document.querySelectorAll(
        '#resourceCharts .resource-chart-card'
      )
    ];

  if (
    !cards.length
  ) {
    return `
      <div class="muted">
        Нет данных для диаграмм.
      </div>
    `;
  }

  return cards
    .map(
      card => {
        const title =
          card
            .querySelector(
              'h2'
            )
            ?.textContent
            ?.trim() ||
          'Диаграмма';

        const canvas =
          card.querySelector(
            'canvas'
          );

        let src =
          '';

        try {
          src =
            canvas
              ?.toDataURL(
                'image/png'
              ) ||
            '';
        } catch (
          error
        ) {
        }

        return `
          <section class="liv-report-section">

            <h2>
              ${esc(title)}
            </h2>

            ${
              src
                ? `
                    <img
                      class="liv-report-chart"
                      src="${src}">
                  `
                : `
                    <div class="muted">
                      Диаграмма недоступна для печати.
                    </div>
                  `
            }

          </section>
        `;
      }
    )
    .join('');
}

function resourcePrintPlanFact() {
  const model =
    resourcePlanFactModel();

  let chart =
    '';

  try {
    const src =
      $('resourcePlanFactChart')
        ?.toDataURL(
          'image/png'
        );

    if (
      src
    ) {
      chart = `
        <section class="liv-report-section">

          <h2>
            График план / факт
          </h2>

          <img
            class="liv-report-chart"
            src="${src}">

        </section>
      `;
    }
  } catch (
    error
  ) {
  }

  return [
    resourcePrintKpis(
      [
        {
          id:
            'planSum',

          title:
            'План, чел.-дни',

          value:
            model.totals.plan
        },

        {
          id:
            'factSum',

          title:
            'Факт, чел.-дни',

          value:
            model.totals.fact
        },

        {
          id:
            'deviation',

          title:
            'Отклонение',

          value:
            model.totals.deviation
        }
      ],
      'planfact'
    ),

    resourcePrintTable(
      'planfact',
      'planfact',
      model.rows,
      model.totals,
      'Итого'
    ),

    chart
  ]
    .join('');
}

function resourceGetPrintMeta(
  viewName
) {
  const result =
    [];

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
      `Период: ${from ? ruDate(from) : '—'} — ${to ? ruDate(to) : '—'}`
    );
  }

  if (
    viewName ===
      'daily' &&
    $('rDailyDate')
      ?.value
  ) {
    result.push(
      `Дата сводки: ${ruDate($('rDailyDate').value)}`
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
          $(id)
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

  return result;
}

/* =========================================================
   СХЕМЫ КОНСТРУКТОРА
   ========================================================= */

function resourceSharedModes() {
  return [
    {
      id:
        'journal',

      title:
        'Журнал',

      selector:
        '[data-rview="journal"]'
    },

    {
      id:
        'daily',

      title:
        'Ежедневная сводка',

      selector:
        '[data-rview="daily"]'
    },

    {
      id:
        'dynamics',

      title:
        'Динамика',

      selector:
        '[data-rview="dynamics"]'
    },

    {
      id:
        'analytics',

      title:
        'Месячная аналитика',

      selector:
        '[data-rview="analytics"]'
    },

    {
      id:
        'planfact',

      title:
        'План / факт ресурсов',

      selector:
        '[data-rview="planfact"]'
    }
  ];
}

function resourceSharedFilters() {
  return [
    {
      id:
        'from',

      title:
        'С',

      selector:
        '#rFrom',

      closest:
        '.field'
    },

    {
      id:
        'to',

      title:
        'По',

      selector:
        '#rTo',

      closest:
        '.field'
    },

    {
      id:
        'organizations',

      title:
        'Организации',

      selector:
        '#rOrgMulti',

      closest:
        '.field'
    },

    {
      id:
        'buildings',

      title:
        'Здания',

      selector:
        '#rBuildingMulti',

      closest:
        '.field'
    },

    {
      id:
        'works',

      title:
        'Работы',

      selector:
        '#rWorkMulti',

      closest:
        '.field'
    },

    {
      id:
        'fronts',

      title:
        'Фронты',

      selector:
        '#rFrontMulti',

      closest:
        '.field'
    },

    {
      id:
        'showZero',

      title:
        'Показывать нулевые',

      selector:
        '#rShowZero',

      closest:
        '.switch-line'
    }
  ];
}

function resourceSharedActions() {
  return [
    {
      id:
        'resetFilters',

      title:
        'Сбросить фильтры',

      selector:
        '#resourceResetFiltersBtn'
    },

    {
      id:
        'addResource',

      title:
        '+ Добавить запись',

      selector:
        '#newResourceBtn'
    }
  ];
}

function resourceSchemaBase(
  viewName,
  extras =
    {}
) {
  return {
    title:
      extras.title ||
      livResourceViewTitle(
        viewName
      ),

    modes:
      resourceSharedModes(),

    filters: [
      ...resourceSharedFilters(),
      ...(
        extras.filters ||
        []
      )
    ],

    actions: [
      ...resourceSharedActions(),
      ...(
        extras.actions ||
        []
      )
    ],

    kpis:
      extras.kpis ||
      [],

    blocks:
      extras.blocks ||
      [],

    charts:
      extras.charts ||
      [],

    tables:
      extras.tables ||
      [],

    captureState:
      () =>
        resourceCaptureViewState(
          viewName
        ),

    applyState:
      state =>
        resourceApplyViewState(
          state
        ),

    rerender:
      () => {
        if (
          livResourceView !==
          viewName
        ) {
          switchResourceView(
            viewName
          );
        } else {
          renderResourceCurrentView();
        }
      },

    getPrintMeta:
      () =>
        resourceGetPrintMeta(
          viewName
        ),

    getPrintHtml:
      extras.getPrintHtml
  };
}

function registerResourceBuilderSchemas() {
  if (
    !window
      .LIV_VIEW_BUILDER
      ?.register
  ) {
    return;
  }

  window
    .LIV_VIEW_BUILDER
    .register(
      'resources:journal',

      resourceSchemaBase(
        'journal',
        {
          title:
            'Журнал ресурсов',

          kpis: [
            {
              id:
                'itrDays',

              title:
                'ИТР-дни',

              selector:
                '#rItr',

              closest:
                '.stat'
            },

            {
              id:
                'workerDays',

              title:
                'Рабочие-дни',

              selector:
                '#rWorkers',

              closest:
                '.stat'
            },

            {
              id:
                'mechanizerDays',

              title:
                'Механизаторы-дни',

              selector:
                '#rMech',

              closest:
                '.stat'
            },

            {
              id:
                'peopleDays',

              title:
                'Всего чел.-дней',

              selector:
                '#rTotalPeople',

              closest:
                '.stat'
            },

            {
              id:
                'peakPeople',

              title:
                'Пик людей',

              selector:
                '#rPeak',

              closest:
                '.stat'
            },

            {
              id:
                'equipmentDays',

              title:
                'Технико-дни',

              selector:
                '#rEquipDays',

              closest:
                '.stat'
            }
          ],

          actions: [
            {
              id:
                'columns',

              title:
                'Настроить таблицу',

              selector:
                '#resourceColumnsBtn'
            },

            {
              id:
                'deleteSelected',

              title:
                'Удалить выбранное',

              selector:
                '#resourceDeleteSelectedBtn'
            },

            {
              id:
                'deleteFiltered',

              title:
                'Удалить по фильтру',

              selector:
                '#resourceDeleteFilteredBtn'
            }
          ],

          blocks: [
            {
              id:
                'journalTable',

              title:
                'Журнал',

              selector:
                '#resourceRows',

              closest:
                '.card'
            }
          ],

          tables: [
            {
              ...resourceTableSchema(
                'journal',
                'journal'
              ),

              selector:
                '#resourceRows',

              closest:
                'table'
            }
          ],

          getPrintHtml:
            resourcePrintJournal
        }
      )
    );

  window
    .LIV_VIEW_BUILDER
    .register(
      'resources:daily',

      resourceSchemaBase(
        'daily',
        {
          title:
            'Ежедневная сводка ресурсов',

          filters: [
            {
              id:
                'dailyDate',

              title:
                'Дата сводки',

              selector:
                '#rDailyDate',

              closest:
                '.field'
            }
          ],

          kpis: [
            {
              id:
                'peopleTotal',

              title:
                'Сотрудников на объекте',

              selector:
                '#rdPeopleTotal',

              closest:
                '.stat'
            },

            {
              id:
                'equipmentTotal',

              title:
                'Техники на объекте',

              selector:
                '#rdEquipmentTotal',

              closest:
                '.stat'
            }
          ],

          blocks: [
            {
              id:
                'peopleTable',

              title:
                'Люди',

              selector:
                '#rdPeopleBody',

              closest:
                '.card'
            },

            {
              id:
                'equipmentTable',

              title:
                'Техника',

              selector:
                '#rdEquipmentBody',

              closest:
                '.card'
            }
          ],

          tables: [
            {
              ...resourceTableSchema(
                'daily',
                'people'
              ),

              selector:
                '#rdPeopleBody',

              closest:
                'table'
            },

            {
              ...resourceTableSchema(
                'daily',
                'equipment'
              ),

              selector:
                '#rdEquipmentBody',

              closest:
                'table'
            }
          ],

          getPrintHtml:
            resourcePrintDaily
        }
      )
    );

  window
    .LIV_VIEW_BUILDER
    .register(
      'resources:dynamics',

      resourceSchemaBase(
        'dynamics',
        {
          title:
            'Динамика ресурсов',

          filters: [
            {
              id:
                'metric',

              title:
                'Показатель',

              selector:
                '#rDynType',

              closest:
                '.field'
            },

            {
              id:
                'step',

              title:
                'Шаг',

              selector:
                '#rDynStep',

              closest:
                '.field'
            },

            {
              id:
                'quickOrg',

              title:
                'Быстрый выбор организации',

              selector:
                '#rDynOrg',

              closest:
                '.field'
            }
          ],

          blocks: [
            {
              id:
                'chartsBlock',

              title:
                'Диаграммы',

              selector:
                '#resourceCharts'
            }
          ],

          charts: [
            {
              id:
                'resourceCharts',

              title:
                'Диаграммы ресурсов',

              selector:
                '#resourceCharts'
            }
          ],

          getPrintHtml:
            resourcePrintDynamics
        }
      )
    );

  window
    .LIV_VIEW_BUILDER
    .register(
      'resources:analytics',

      resourceSchemaBase(
        'analytics',
        {
          title:
            'Месячная аналитика ресурсов',

          filters: [
            {
              id:
                'averageMethod',

              title:
                'Метод среднего',

              selector:
                '#rAvgMethod',

              closest:
                '.field'
            },

            {
              id:
                'missingRule',

              title:
                'Если записи нет',

              selector:
                '#rMissingRule',

              closest:
                '.field'
            }
          ],

          actions: [
            {
              id:
                'saveView',

              title:
                'Сохранить представление',

              selector:
                '#saveResourceViewBtn'
            }
          ],

          kpis: [
            {
              id:
                'peopleAvg',

              title:
                'Среднее сотрудников',

              selector:
                '#raPeopleAvg',

              closest:
                '.stat'
            },

            {
              id:
                'equipmentAvg',

              title:
                'Среднее техники',

              selector:
                '#raEquipmentAvg',

              closest:
                '.stat'
            },

            {
              id:
                'daysCount',

              title:
                'Дней в расчете',

              selector:
                '#raDaysCount',

              closest:
                '.stat'
            }
          ],

          blocks: [
            {
              id:
                'peopleAnalytics',

              title:
                'Среднее количество сотрудников',

              selector:
                '#raPeopleBody',

              closest:
                '.card'
            },

            {
              id:
                'equipmentAnalytics',

              title:
                'Среднее количество строительной техники',

              selector:
                '#raEquipmentBody',

              closest:
                '.card'
            }
          ],

          tables: [
            {
              ...resourceTableSchema(
                'analytics',
                'people'
              ),

              selector:
                '#raPeopleBody',

              closest:
                'table'
            },

            {
              ...resourceTableSchema(
                'analytics',
                'equipment'
              ),

              selector:
                '#raEquipmentBody',

              closest:
                'table'
            }
          ],

          getPrintHtml:
            resourcePrintAnalytics
        }
      )
    );

  window
    .LIV_VIEW_BUILDER
    .register(
      'resources:planfact',

      resourceSchemaBase(
        'planfact',
        {
          title:
            'План / факт ресурсов',

          filters: [
            {
              id:
                'planfactStep',

              title:
                'Шаг',

              selector:
                '#rpStep',

              closest:
                '.field'
            }
          ],

          actions: [
            {
              id:
                'addPlan',

              title:
                '+ Добавить план ресурсов',

              selector:
                '#newResourcePlanBtn'
            }
          ],

          kpis: [
            {
              id:
                'planSum',

              title:
                'План, чел.-дни',

              selector:
                '#rpPlanSum',

              closest:
                '.stat'
            },

            {
              id:
                'factSum',

              title:
                'Факт, чел.-дни',

              selector:
                '#rpFactSum',

              closest:
                '.stat'
            },

            {
              id:
                'deviation',

              title:
                'Отклонение',

              selector:
                '#rpDeviation',

              closest:
                '.stat'
            }
          ],

          blocks: [
            {
              id:
                'planfactTable',

              title:
                'Таблица план / факт',

              selector:
                '#rpBody',

              closest:
                '.card'
            },

            {
              id:
                'planfactChart',

              title:
                'График план / факт',

              selector:
                '#resourcePlanFactChart',

              closest:
                '.card'
            }
          ],

          charts: [
            {
              id:
                'planfactChart',

              title:
                'График план / факт',

              selector:
                '#resourcePlanFactChart',

              closest:
                '.card'
            }
          ],

          tables: [
            {
              ...resourceTableSchema(
                'planfact',
                'planfact'
              ),

              selector:
                '#rpBody',

              closest:
                'table'
            }
          ],

          getPrintHtml:
            resourcePrintPlanFact
        }
      )
    );
}

/* =========================================================
   СОХРАНИТЬ ПРЕДСТАВЛЕНИЕ
   ========================================================= */

async function saveResourceView() {
  if (
    typeof livOpenViewBuilder ===
    'function'
  ) {
    livOpenViewBuilder();
    return;
  }

  alert(
    'Конструктор представлений не загружен.'
  );
}

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
   ========================================================= */

function switchResourceView(
  view
) {
  livResourceView =
    view;

  document
    .querySelectorAll(
      '[data-rview]'
    )
    .forEach(
      button => {
        button
          .classList
          .toggle(
            'active',
            button.dataset
              .rview ===
              view
          );
      }
    );

  document
    .querySelectorAll(
      '.resource-view'
    )
    .forEach(
      panel =>
        panel
          .classList
          .add(
            'hidden'
          )
    );

  document
    .getElementById(
      `rview-${view}`
    )
    ?.classList
    .remove(
      'hidden'
    );

  renderResourceCurrentView();
}

function renderResourceCurrentView() {
  registerResourceBuilderSchemas();

  if (
    livResourceView ===
    'daily'
  ) {
    renderResourceDaily();
  } else if (
    livResourceView ===
    'dynamics'
  ) {
    renderResourceDynamics();
  } else if (
    livResourceView ===
    'analytics'
  ) {
    renderResourceAnalytics();
  } else if (
    livResourceView ===
    'planfact'
  ) {
    renderResourcePlanFact();
  } else {
    resourceRenderJournal();
  }

  if (
    typeof livApplyViewConstructor ===
    'function'
  ) {
    setTimeout(
      livApplyViewConstructor,
      0
    );
  }
}

function renderResourceJournal() {
  return resourceRenderJournal();
}

/* =========================================================
   СТИЛИ
   ========================================================= */

function ensureResourceScreenStyles() {
  if (
    $('livResourceScreenStyles')
  ) {
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'livResourceScreenStyles';

  style.textContent = `

    #tab-resources .num-cell,
    #tab-resources .num-head{
      text-align:center!important;
      font-variant-numeric:tabular-nums;
    }

    #tab-resources .total-cell{
      font-weight:700;
    }

    #tab-resources tfoot th,
    #tab-resources tfoot td{
      font-weight:700;
      background:#f6f8fb;
      border-top:1.5px solid #cfd5df;
    }

    #tab-resources .resource-empty{
      text-align:center;
      padding:18px;
      color:var(--muted);
    }

    #tab-resources table th,
    #tab-resources table td{
      vertical-align:middle;
    }

    #tab-resources .resource-filter-grid>*{
      min-width:0;
    }

    #tab-resources .stats>.stat{
      min-width:0;
    }

  `;

  document
    .head
    .appendChild(
      style
    );
}

/* =========================================================
   BIND
   ========================================================= */

function bindResourceUi() {
  ensureResourceScreenStyles();

  registerResourceBuilderSchemas();

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

  [
    'rFrom',
    'rTo',
    'rOrg',
    'rBuilding',
    'rWork',
    'rFront'
  ]
    .forEach(
      id =>
        bindChange(
          id,
          renderResourceCurrentView
        )
    );

  bindChange(
    'rDailyDate',
    renderResourceDaily
  );

  bindChange(
    'rDynType',
    renderResourceDynamics
  );

  bindChange(
    'rDynStep',
    renderResourceDynamics
  );

  bindChange(
    'rDynOrg',
    renderResourceDynamics
  );

  bindChange(
    'rAvgMethod',
    renderResourceAnalytics
  );

  bindChange(
    'rMissingRule',
    renderResourceAnalytics
  );

  bindChange(
    'rpStep',
    renderResourcePlanFact
  );

  bindChange(
    'rShowZero',
    renderResourceCurrentView
  );

  bindClick(
    'resourceResetFiltersBtn',
    () => {
      resetResourceFilters();
      renderResourceCurrentView();
    }
  );

  bindClick(
    'resourceDeleteSelectedBtn',
    deleteSelectedResources
  );

  bindClick(
    'resourceDeleteFilteredBtn',
    deleteFilteredResources
  );

  bindClick(
    'newResourceBtn',
    () =>
      openResourceEditor()
  );

  bindClick(
    'newResourcePlanBtn',
    () =>
      openResourcePlanEditor()
  );

  bindClick(
    'saveResourceViewBtn',
    saveResourceView
  );

  bindClick(
    'resourceColumnsBtn',
    () => {
      if (
        typeof livOpenViewBuilder ===
        'function'
      ) {
        livOpenViewBuilder();
      }
    }
  );
}

/* =========================================================
   АВТОИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function resourceBootstrap(
  attempt =
    0
) {
  if (
    typeof project !==
      'undefined' &&
    project &&
    typeof bindChange ===
      'function'
  ) {
    ensureResourceScreenStyles();

    registerResourceBuilderSchemas();

    bindResourceUi();

    if (
      typeof initLivViewBuilder ===
      'function'
    ) {
      initLivViewBuilder();
    }

    /*
      Второй bind нужен намеренно:
      старый app.js может назначить свои обработчики
      после первого запуска ресурсов.
      Через 600 мс ресурсы возвращают себе
      управление только своими элементами.
    */
    setTimeout(
      () => {
        bindResourceUi();

        if (
          typeof initLivViewBuilder ===
          'function'
        ) {
          initLivViewBuilder();
        }
      },
      600
    );

    return;
  }

  if (
    attempt <
    40
  ) {
    setTimeout(
      () =>
        resourceBootstrap(
          attempt +
          1
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
          resourceBootstrap(),
        50
      )
  );
} else {
  setTimeout(
    () =>
      resourceBootstrap(),
    50
  );
}