'use strict';

/* =========================================================
   LIV Planning — РЕСУРСЫ
   Данные + декларативные представления для конструктора
   ========================================================= */

let livResourceView = 'journal';
let livResourceCharts = [];
let livResourcePlanFactChart = null;
let livResourceSelectedIds = new Set();


/* =========================================================
   СХЕМЫ ТАБЛИЦ
   ========================================================= */

const RESOURCE_JOURNAL_COLUMNS = [

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
   ДИНАМИЧЕСКИЕ КОЛОНКИ ТЕХНИКИ
   ========================================================= */

function resourceAnalyticsEquipmentColumns() {

  const rows =
    resourceFiltered();


  const totals =
    new Map();


  rows.forEach(
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

        numeric:
          true,

        equipmentType:
          type
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
   СТИЛИ ЭКРАНА
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
  `;


  document.head.appendChild(
    style
  );
}


/* =========================================================
   РЕГИСТРАЦИЯ В КОНСТРУКТОРЕ
   ========================================================= */

function registerResourceBuilderSchemas() {

  if (
    !window.LIV_VIEW_BUILDER
      ?.register
  ) {
    return;
  }


  const sharedModes = [

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


  const sharedFilters = [

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
    },

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
        '+ Добавить',

      selector:
        '#newResourceBtn'
    }
  ];


/* ---------------------------------------------------------
   ЖУРНАЛ
   --------------------------------------------------------- */

  window.LIV_VIEW_BUILDER.register(
    'resources:journal',

    {

      title:
        'Журнал ресурсов',

      modes:
        sharedModes,

      filters:
        sharedFilters,

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

      charts:
        [],

      tables: [

        {
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
      ]
    }
  );


/* ---------------------------------------------------------
   ЕЖЕДНЕВНАЯ СВОДКА
   --------------------------------------------------------- */

  window.LIV_VIEW_BUILDER.register(
    'resources:daily',

    {

      title:
        'Ежедневная сводка ресурсов',

      modes:
        sharedModes,

      filters: [

        ...sharedFilters,

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

      charts:
        [],

      tables: [

        {
          id:
            'dailyPeople',

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

        {
          id:
            'dailyEquipment',

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
      ]
    }
  );


/* ---------------------------------------------------------
   ДИНАМИКА
   --------------------------------------------------------- */

  window.LIV_VIEW_BUILDER.register(
    'resources:dynamics',

    {

      title:
        'Динамика ресурсов',

      modes:
        sharedModes,

      filters: [

        ...sharedFilters,

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

      kpis:
        [],

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

      tables:
        []
    }
  );


/* ---------------------------------------------------------
   АНАЛИТИКА
   --------------------------------------------------------- */

  window.LIV_VIEW_BUILDER.register(
    'resources:analytics',

    {

      title:
        'Месячная аналитика ресурсов',

      modes:
        sharedModes,

      filters: [

        ...sharedFilters,

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
        },

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

      charts:
        [],

      tables: [

        {
          id:
            'analyticsPeople',

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

        {
          id:
            'analyticsEquipment',

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
      ]
    }
  );


/* ---------------------------------------------------------
   ПЛАН / ФАКТ
   --------------------------------------------------------- */

  window.LIV_VIEW_BUILDER.register(
    'resources:planfact',

    {

      title:
        'План / факт ресурсов',

      modes:
        sharedModes,

      filters: [

        ...sharedFilters,

        {
          id:
            'addPlan',

          title:
            '+ Добавить план ресурсов',

          selector:
            '#newResourcePlanBtn'
        },

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
      ]
    }
  );
}


/* =========================================================
   ПОМОЩНИКИ КОНСТРУКТОРА ТАБЛИЦ
   ========================================================= */

function resourceViewKey(
  name =
    livResourceView
) {

  return `resources:${name}`;
}


function resourceTableConfig(
  viewName,
  tableId,
  schema
) {

  if (
    window.LIV_VIEW_BUILDER
      ?.tableConfig
  ) {

    return window.LIV_VIEW_BUILDER
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

    title:
      schema.title ||
      '',

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
  schema
) {

  if (
    window.LIV_VIEW_BUILDER
      ?.visibleColumns
  ) {

    return window.LIV_VIEW_BUILDER
      .visibleColumns(
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


  return columns
    .filter(
      column =>
        schema.showRowNumbers !==
          false ||
        column.role !==
          'rowNumber'
    );
}


/* =========================================================
   DOM ТАБЛИЦЫ
   ========================================================= */

function resourceTableElements(
  bodyId
) {

  const body =
    $(
      bodyId
    );


  const table =
    body
      ?.closest(
        'table'
      );


  if (
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


/* =========================================================
   ПРИМЕНЕНИЕ НАСТРОЕК ТАБЛИЦЫ
   ========================================================= */

function resourceApplyTableChrome(
  viewName,
  tableId,
  schema,
  bodyId
) {

  const config =
    resourceTableConfig(
      viewName,
      tableId,
      schema
    );


  const {
    head,
    foot,
    title
  } =
    resourceTableElements(
      bodyId
    );


  if (
    title
  ) {

    title.textContent =
      config.title ||
      schema.title ||
      title.textContent;


    title.style.display =
      config.showTitle
        ? ''
        : 'none';
  }


  if (
    head
  ) {

    head.style.display =
      config.showHeader
        ? ''
        : 'none';
  }


  if (
    foot
  ) {

    foot.style.display =
      config.showFooter
        ? ''
        : 'none';
  }


  return config;
}


/* =========================================================
   HTML ШАПКИ
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
                class="${
                  column.numeric
                    ? 'num-head'
                    : ''
                }"
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


/* =========================================================
   HTML ЯЧЕЙКИ
   ========================================================= */

function resourceCellHtml(
  column,
  value
) {

  return `
    <td
      class="${
        column.numeric
          ? 'num-cell'
          : ''
      } ${
        column.total
          ? 'total-cell'
          : ''
      }"
      data-liv-col="${esc(column.id)}">

      ${esc(
        value ??
        ''
      )}

    </td>
  `;
}


/* =========================================================
   HTML FOOTER
   ========================================================= */

function resourceFooterHtml(
  columns,
  values,
  label =
    'Итого'
) {

  let labelUsed =
    false;


  return `
    <tr>

      ${
        columns
          .map(
            column => {

              let value =
                values[
                  column.id
                ];


              if (
                (
                  value ===
                    undefined ||
                  value ===
                    null ||
                  value ===
                    ''
                ) &&
                !labelUsed &&
                column.role !==
                  'rowNumber' &&
                !column.numeric
              ) {

                value =
                  label;


                labelUsed =
                  true;
              }


              if (
                (
                  value ===
                    undefined ||
                  value ===
                    null ||
                  value ===
                    ''
                ) &&
                !labelUsed &&
                column.role !==
                  'rowNumber'
              ) {

                value =
                  label;


                labelUsed =
                  true;
              }


              return `
                <th
                  class="${
                    column.numeric
                      ? 'num-head'
                      : ''
                  } ${
                    column.total
                      ? 'total-cell'
                      : ''
                  }"
                  data-liv-col="${esc(column.id)}">

                  ${esc(
                    value ??
                    ''
                  )}

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
   БАЗОВЫЕ РАСЧЕТЫ
   ========================================================= */

function resourceShowZero() {

  return (
    $('rShowZero')
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
    );
}


function hasOwn(
  object,
  key
) {

  return Object.prototype
    .hasOwnProperty
    .call(
      object,
      key
    );
}


/* =========================================================
   ФИЛЬТРАЦИЯ
   ========================================================= */

function resourceFiltered(
  options =
    {}
) {

  const from =
    hasOwn(
      options,
      'from'
    )
      ? options.from
      : (
          $('rFrom')
            ?.value ||
          ''
        );


  const to =
    hasOwn(
      options,
      'to'
    )
      ? options.to
      : (
          $('rTo')
            ?.value ||
          ''
        );


  const organizationIds =
    hasOwn(
      options,
      'organizationIds'
    )
      ? options.organizationIds
      : getMultiFilterValues(
          'rOrg'
        );


  const buildingIds =
    hasOwn(
      options,
      'buildingIds'
    )
      ? options.buildingIds
      : getMultiFilterValues(
          'rBuilding'
        );


  const workIds =
    hasOwn(
      options,
      'workIds'
    )
      ? options.workIds
      : getMultiFilterValues(
          'rWork'
        );


  const frontIds =
    hasOwn(
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
   ЖУРНАЛ
   ========================================================= */

function resourceJournalValue(
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

    return (
      nameById(
        project.organizations,
        row.organizationId
      ) ||
      '—'
    );
  }


  if (
    column ===
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
    column ===
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
    column ===
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
        column
      )
  ) {

    return fmt(
      row[
        column
      ]
    );
  }


  return (
    row[
      column
    ] ??
    ''
  );
}


function renderResourceJournal() {

  const rows =
    resourceFiltered();


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


  const schema = {

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
  };


  const columns =
    resourceVisibleColumns(
      'journal',
      'journal',
      schema
    );


  const config =
    resourceTableConfig(
      'journal',
      'journal',
      schema
    );


  if (
    $('resourceHead')
  ) {

    $('resourceHead').style.display =
      config.showHeader
        ? ''
        : 'none';


    $('resourceHead').innerHTML = `

      <tr>

        <th class="select-col">

          <input
            id="resourceSelectAll"
            type="checkbox"
          >

        </th>


        ${
          columns
            .map(
              column => `

                <th
                  class="${
                    column.numeric
                      ? 'num-head'
                      : ''
                  }"
                  data-liv-col="${esc(column.id)}">

                  ${esc(column.title)}

                </th>
              `
            )
            .join('')
        }


        <th>
          Действия
        </th>

      </tr>
    `;
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

              <td class="select-col">

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

              </td>


              ${
                columns
                  .map(
                    column =>
                      resourceCellHtml(
                        column,
                        resourceJournalValue(
                          row,
                          column.id
                        )
                      )
                  )
                  .join('')
              }


              <td class="row-actions">

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

              </td>

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


  const selectAll =
    $('resourceSelectAll');


  if (
    selectAll
  ) {

    selectAll.checked =
      rows.length >
        0 &&
      rows.every(
        row =>
          livResourceSelectedIds.has(
            String(
              row.id
            )
          )
      );


    selectAll.onchange =
      () => {

        rows.forEach(
          row => {

            if (
              selectAll.checked
            ) {

              livResourceSelectedIds.add(
                String(
                  row.id
                )
              );

            } else {

              livResourceSelectedIds.delete(
                String(
                  row.id
                )
              );
            }
          }
        );


        renderResourceJournal();
      };
  }


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


/* =========================================================
   ВЫБОР / УДАЛЕНИЕ
   ========================================================= */

function updateResourceSelectionBar() {

  if (
    $('resourceSelectedCount')
  ) {

    $('resourceSelectedCount')
      .textContent =
        livResourceSelectedIds
          .size
          ? `Выбрано: ${livResourceSelectedIds.size}`
          : 'Ничего не выбрано';
  }


  if (
    $('resourceDeleteSelectedBtn')
  ) {

    $('resourceDeleteSelectedBtn')
      .disabled =
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
   РЕДАКТОР РЕСУРСОВ
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
    id
      ? 'Ресурсы'
      : 'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Дата
          </label>

          <input
            id="rrDate"
            type="date"
            value="${esc(
              row.date ||
              today()
            )}"
          >

        </div>


        <div class="field">

          <label>
            Организация
          </label>

          <select id="rrOrg">

            ${
              selectOptions(
                project.organizations,
                row.organizationId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select id="rrBuilding">

            ${
              selectOptions(
                project.buildings,
                row.buildingId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Вид работ
          </label>

          <select id="rrWork">

            ${
              selectOptions(
                project.works,
                row.workId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Фронт
          </label>

          <select id="rrFront">

            <option value="">
              —
            </option>

            ${frontOptions}

          </select>

        </div>


        <div class="field">

          <label>
            ИТР
          </label>

          <input
            id="rrItr"
            type="number"
            step="1"
            min="0"
            value="${
              row.itr ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Подсобные рабочие
          </label>

          <input
            id="rrWorkers"
            type="number"
            step="1"
            min="0"
            value="${
              row.workers ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Механизаторы
          </label>

          <input
            id="rrMech"
            type="number"
            step="1"
            min="0"
            value="${
              row.mechanizers ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Наименование техники
          </label>

          <input
            id="rrEqType"
            value="${esc(
              row.equipmentType ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Количество техники
          </label>

          <input
            id="rrEqQty"
            type="number"
            step="1"
            min="0"
            value="${
              row.equipmentQty ??
              ''
            }"
          >

        </div>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="rrComment">${esc(
          row.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="rrDelete"
                  class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

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
   ЕЖЕДНЕВНАЯ СВОДКА
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
    dailyResourceRows(
      date
    );


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

            itr:
              0,

            workers:
              0,

            mechanizers:
              0
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


  const totals = {

    itr:
      0,

    workers:
      0,

    mechanizers:
      0,

    total:
      0
  };


  people.forEach(
    item => {

      totals.itr +=
        item.itr;


      totals.workers +=
        item.workers;


      totals.mechanizers +=
        item.mechanizers;
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


  if (
    $('rdPeopleTotal')
  ) {

    $('rdPeopleTotal')
      .textContent =
        Math.round(
          totals.total
        );
  }


  if (
    $('rdEquipmentTotal')
  ) {

    $('rdEquipmentTotal')
      .textContent =
        Math.round(
          totalEquipment
        );
  }


/* ---------------------------------------------------------
   ЛЮДИ
   --------------------------------------------------------- */

  const peopleSchema = {

    id:
      'dailyPeople',

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
  };


  const peopleColumns =
    resourceVisibleColumns(
      'daily',
      'dailyPeople',
      peopleSchema
    );


  const peopleElements =
    resourceTableElements(
      'rdPeopleBody'
    );


  const peopleConfig =
    resourceApplyTableChrome(
      'daily',
      'dailyPeople',
      peopleSchema,
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
      people.length
        ? people
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
              totals.itr
            ),

          workers:
            Math.round(
              totals.workers
            ),

          mechanizers:
            Math.round(
              totals.mechanizers
            ),

          total:
            Math.round(
              totals.total
            )
        },

        'Итого'
      );


    peopleElements.foot.style.display =
      peopleConfig.showFooter
        ? ''
        : 'none';
  }


/* ---------------------------------------------------------
   ТЕХНИКА
   --------------------------------------------------------- */

  const equipmentSchema = {

    id:
      'dailyEquipment',

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
  };


  const equipmentColumns =
    resourceVisibleColumns(
      'daily',
      'dailyEquipment',
      equipmentSchema
    );


  const equipmentElements =
    resourceTableElements(
      'rdEquipmentBody'
    );


  const equipmentConfig =
    resourceApplyTableChrome(
      'daily',
      'dailyEquipment',
      equipmentSchema,
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
      equipment.length
        ? equipment
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
              totalEquipment
            )
        },

        'Итого'
      );


    equipmentElements.foot.style.display =
      equipmentConfig.showFooter
        ? ''
        : 'none';
  }
}


/* =========================================================
   ДИНАМИКА
   ========================================================= */

function destroyResourceCharts() {

  livResourceCharts
    .forEach(
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
      `
        <div class="card muted">
          Библиотека диаграмм не загрузилась.
        </div>
      `;

    return;
  }


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


  if (
    !organizationIds.length
  ) {

    container.innerHTML =
      `
        <div class="card muted">
          Нет данных для диаграмм.
        </div>
      `;

    return;
  }


  organizationIds.forEach(
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


      const datasets =
        [];


      if (
        metric ===
        'total'
      ) {

        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });
      }


      if (
        metric ===
        'itr'
      ) {

        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });
      }


      if (
        metric ===
        'workers'
      ) {

        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });
      }


      if (
        metric ===
        'both'
      ) {

        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });


        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });
      }


      if (
        metric ===
        'equipment'
      ) {

        datasets.push({

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
            ),

          borderWidth:
            2,

          tension:
            0,

          spanGaps:
            false
        });
      }


      const card =
        document.createElement(
          'div'
        );


      card.className =
        'card resource-chart-card';


      card.innerHTML = `

        <div class="chart-head">

          <h2>
            ${esc(
              nameById(
                project.organizations,
                organizationId
              ) ||
              'Без организации'
            )}
          </h2>

        </div>

        <div class="chart-box">
          <canvas></canvas>
        </div>
      `;


      container.appendChild(
        card
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
                keys.map(
                  key =>
                    resourceBucketLabel(
                      key,
                      step
                    )
                ),

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
   АНАЛИТИКА — ГРУППИРОВКА
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
    daily
      .filter(
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


/* =========================================================
   АНАЛИТИКА
   ========================================================= */

function renderResourceAnalytics() {

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


/* ---------------------------------------------------------
   ЛЮДИ
   --------------------------------------------------------- */

  const peopleRows =
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


          const itr =
            averageByDate(
              daily,
              rows,
              organizationId,
              'itr'
            );


          const workers =
            averageByDate(
              daily,
              rows,
              organizationId,
              'workers'
            );


          const mechanizers =
            averageByDate(
              daily,
              rows,
              organizationId,
              'mechanizers'
            );


          const total =
            averageByDate(
              own,
              rows,
              organizationId,
              'totalPeople'
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
              total.average
          };
        }
      )
      .filter(
        item =>
          resourceShowZero() ||
          item.total !==
          0
      );


  const peopleSchema = {

    id:
      'analyticsPeople',

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
  };


  const peopleColumns =
    resourceVisibleColumns(
      'analytics',
      'analyticsPeople',
      peopleSchema
    );


  const peopleElements =
    resourceTableElements(
      'raPeopleBody'
    );


  const peopleConfig =
    resourceApplyTableChrome(
      'analytics',
      'analyticsPeople',
      peopleSchema,
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
      peopleRows.length
        ? peopleRows
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


  const mean =
    (
      array,
      field
    ) =>
      array.length
        ? array.reduce(
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
        : 0;


  if (
    peopleElements.foot
  ) {

    peopleElements.foot.innerHTML =
      resourceFooterHtml(
        peopleColumns,

        {

          itr:
            Math.round(
              mean(
                peopleRows,
                'itr'
              )
            ),

          mechanizers:
            Math.round(
              mean(
                peopleRows,
                'mechanizers'
              )
            ),

          workers:
            Math.round(
              mean(
                peopleRows,
                'workers'
              )
            ),

          total:
            Math.round(
              mean(
                peopleRows,
                'total'
              )
            )
        },

        'Среднее по организациям'
      );


    peopleElements.foot.style.display =
      peopleConfig.showFooter
        ? ''
        : 'none';
  }


/* ---------------------------------------------------------
   ТЕХНИКА
   --------------------------------------------------------- */

  const equipmentColumnsFull =
    resourceAnalyticsEquipmentColumns();


  const equipmentSchema = {

    id:
      'analyticsEquipment',

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
      () =>
        equipmentColumnsFull
  };


  const equipmentColumns =
    resourceVisibleColumns(
      'analytics',
      'analyticsEquipment',
      equipmentSchema
    );


  const equipmentElements =
    resourceTableElements(
      'raEquipmentBody'
    );


  const equipmentConfig =
    resourceApplyTableChrome(
      'analytics',
      'analyticsEquipment',
      equipmentSchema,
      'raEquipmentBody'
    );


  const typeColumns =
    equipmentColumns
      .filter(
        column =>
          column.equipmentType
      );


  const equipmentRows =
    organizationIds
      .map(
        organizationId => {

          const cells =
            {};


          equipmentColumnsFull
            .filter(
              column =>
                column.equipmentType
            )
            .forEach(
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
                            item.equipmentTypes[
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


          const total =
            Object.values(
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
              );


          return {

            organizationId,

            cells,

            total
          };
        }
      )
      .filter(
        item =>
          resourceShowZero() ||
          item.total !==
          0
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
      equipmentRows.length
        ? equipmentRows
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


  const equipmentFooter =
    {};


  typeColumns.forEach(
    column => {

      equipmentFooter[
        column.id
      ] =
        equipmentRows.length
          ? Math.round(
              equipmentRows.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  num(
                    item.cells[
                      column.id
                    ]
                  ),
                0
              ) /
              equipmentRows.length
            )
          : 0;
    }
  );


  equipmentFooter.total =
    equipmentRows.length
      ? Math.round(
          equipmentRows.reduce(
            (
              sum,
              item
            ) =>
              sum +
              item.total,
            0
          ) /
          equipmentRows.length
        )
      : 0;


  if (
    equipmentElements.foot
  ) {

    equipmentElements.foot.innerHTML =
      resourceFooterHtml(
        equipmentColumns,
        equipmentFooter,
        'Среднее по организациям'
      );


    equipmentElements.foot.style.display =
      equipmentConfig.showFooter
        ? ''
        : 'none';
  }


/* ---------------------------------------------------------
   KPI АНАЛИТИКИ
   --------------------------------------------------------- */

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


  if (
    $('raPeopleAvg')
  ) {

    $('raPeopleAvg').textContent =
      Math.round(
        average(
          peopleValues
        )
      );
  }


  if (
    $('raEquipmentAvg')
  ) {

    $('raEquipmentAvg').textContent =
      Math.round(
        average(
          equipmentValues
        )
      );
  }


  if (
    $('raDaysCount')
  ) {

    $('raDaysCount').textContent =
      Math.max(
        peopleValues.length,
        equipmentValues.length
      );
  }
}


/* =========================================================
   СОХРАНИТЬ ВИД
   ========================================================= */

async function saveResourceView() {

  const name =
    prompt(
      'Название представления:',
      'Ресурсы — аналитика'
    );


  if (
    !name
  ) {
    return;
  }


  project.views =
    project.views ||
    [];


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

      averageMethod:
        $('rAvgMethod')
          ?.value ||
        'reported',

      missingRule:
        $('rMissingRule')
          ?.value ||
        'skip'
    }
  });


  log(
    'Создано',
    'Представление',
    name.trim()
  );


  await saveProject();


  alert(
    'Представление сохранено.'
  );
}


/* =========================================================
   ПЛАН / ФАКТ — ФИЛЬТР
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


  const from =
    $('rFrom')
      ?.value ||
    '';


  const to =
    $('rTo')
      ?.value ||
    '';


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


/* =========================================================
   ПЛАН РЕСУРСОВ — РЕДАКТОР
   ========================================================= */

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
    id
      ? 'План ресурсов'
      : 'Добавить план ресурсов',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Организация
          </label>

          <select id="rpOrg">

            ${
              selectOptions(
                project.organizations,
                plan.organizationId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select id="rpBuilding">

            ${
              selectOptions(
                project.buildings,
                plan.buildingId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Работа
          </label>

          <select id="rpWork">

            ${
              selectOptions(
                project.works,
                plan.workId ||
                '',
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Фронт
          </label>

          <select id="rpFront">

            <option value="">
              —
            </option>

            ${frontOptions}

          </select>

        </div>


        <div class="field">

          <label>
            С
          </label>

          <input
            id="rpStart"
            type="date"
            value="${esc(
              plan.startDate ||
              today()
            )}"
          >

        </div>


        <div class="field">

          <label>
            По
          </label>

          <input
            id="rpEnd"
            type="date"
            value="${esc(
              plan.endDate ||
              today()
            )}"
          >

        </div>


        <div class="field">

          <label>
            План, чел.
          </label>

          <input
            id="rpPeople"
            type="number"
            step="1"
            min="0"
            value="${
              plan.people ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Источник / метод
          </label>

          <input
            id="rpMethod"
            value="${esc(
              plan.method ||
              'Ручной'
            )}"
          >

        </div>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="rpComment">${esc(
          plan.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="rpDelete"
                  class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

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


/* =========================================================
   ПЛАН / ФАКТ
   ========================================================= */

function renderResourcePlanFact() {

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


  const planSum =
    [
      ...planMap.values()
    ]
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );


  const factSum =
    [
      ...factMap.values()
    ]
      .reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );


  if (
    $('rpPlanSum')
  ) {

    $('rpPlanSum').textContent =
      Math.round(
        planSum
      );
  }


  if (
    $('rpFactSum')
  ) {

    $('rpFactSum').textContent =
      Math.round(
        factSum
      );
  }


  if (
    $('rpDeviation')
  ) {

    $('rpDeviation').textContent =
      Math.round(
        factSum -
        planSum
      );
  }


  const schema = {

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
  };


  const columns =
    resourceVisibleColumns(
      'planfact',
      'planfact',
      schema
    );


  const elements =
    resourceTableElements(
      'rpBody'
    );


  const config =
    resourceApplyTableChrome(
      'planfact',
      'planfact',
      schema,
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
      keys
        .map(
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


            const row = {

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


            return `

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
            `;
          }
        )
        .join('');
  }


  if (
    elements.foot
  ) {

    elements.foot.innerHTML =
      resourceFooterHtml(
        columns,

        {

          plan:
            Math.round(
              planSum
            ),

          fact:
            Math.round(
              factSum
            ),

          deviation:
            Math.round(
              factSum -
              planSum
            )
        },

        'Итого'
      );


    elements.foot.style.display =
      config.showFooter
        ? ''
        : 'none';
  }


  if (
    livResourcePlanFactChart
  ) {

    try {

      livResourcePlanFactChart
        .destroy();

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
              keys.map(
                key =>
                  resourceBucketLabel(
                    key,
                    step
                  )
              ),

            datasets: [

              {
                label:
                  'План',

                data:
                  keys.map(
                    key =>
                      num(
                        planMap.get(
                          key
                        )
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
                  keys.map(
                    key =>
                      num(
                        factMap.get(
                          key
                        )
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
   ПЕРЕКЛЮЧЕНИЕ
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

        button.classList
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
        panel.classList
          .add(
            'hidden'
          )
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


/* =========================================================
   ТЕКУЩИЙ ВИД
   ========================================================= */

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

    renderResourceJournal();
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


/* =========================================================
   СОБЫТИЯ
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


  /*
    Старую кнопку "Колонки"
    теперь отправляем в единый Конструктор.
  */

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