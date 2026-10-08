'use strict';

/* =========================================================
   LIV PLANNING
   Модуль ресурсов

   Здесь находятся:
   - журнал ресурсов;
   - фильтрация;
   - ежедневная сводка;
   - диаграммы;
   - месячная аналитика;
   - план / факт ресурсов;
   - редактор записей ресурсов.

   ВАЖНО:
   импорт Excel будет находиться отдельно в import.js.
   ========================================================= */


LIV.resources = {
  view: 'journal',

  charts: [],

  planFactChart: null,

  organizationFilter: null,
  buildingFilter: null,
  workFilter: null,
  frontFilter: null
};


/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================= */


/**
 * Возвращает суммарное количество людей в строке ресурсов.
 */
LIV.getResourcePeopleTotal = function (row) {
  return (
    LIV.num(row?.itr) +
    LIV.num(row?.workers) +
    LIV.num(row?.mechanizers)
  );
};


/**
 * Возвращает название организации.
 */
LIV.getResourceOrganizationName = function (row) {
  return (
    LIV.nameById(
      LIV.project.organizations,
      row?.organizationId
    ) ||
    row?.organizationName ||
    '—'
  );
};


/**
 * Возвращает название здания.
 */
LIV.getResourceBuildingName = function (row) {
  return (
    LIV.nameById(
      LIV.project.buildings,
      row?.buildingId
    ) ||
    row?.buildingName ||
    '—'
  );
};


/**
 * Возвращает название работы.
 */
LIV.getResourceWorkName = function (row) {
  return (
    LIV.nameById(
      LIV.project.works,
      row?.workId
    ) ||
    row?.workName ||
    '—'
  );
};


/**
 * Возвращает название фронта.
 */
LIV.getResourceFrontName = function (row) {
  if (row?.frontId) {
    const front =
      LIV.byId(
        LIV.project.fronts,
        row.frontId
      );

    if (front) {
      return LIV.getFrontLabel(front);
    }
  }

  return (
    row?.frontName ||
    '—'
  );
};


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ РЕСУРСОВ
   ========================================================= */

LIV.initResourceFilters = function () {

  const organizations =
    (LIV.project.organizations || [])
      .filter(
        item =>
          item.active !== false
      )
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );


  const buildings =
    (LIV.project.buildings || [])
      .filter(
        item =>
          item.active !== false
      )
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );


  const works =
    (LIV.project.works || [])
      .filter(
        item =>
          item.active !== false
      )
      .map(
        item => ({
          id: item.id,
          name: item.name
        })
      );


  const fronts =
    (LIV.project.fronts || [])
      .map(
        front => ({
          id: front.id,
          name:
            LIV.getFrontLabel(front)
        })
      );


  if (
    LIV.$(
      'resourceOrganizationFilter'
    )
  ) {
    LIV.resources.organizationFilter =
      LIV.createMultiFilter({
        id:
          'resource-organizations',

        container:
          'resourceOrganizationFilter',

        items:
          organizations,

        allLabel:
          'Все организации',

        onChange:
          LIV.renderResources
      });
  }


  if (
    LIV.$(
      'resourceBuildingFilter'
    )
  ) {
    LIV.resources.buildingFilter =
      LIV.createMultiFilter({
        id:
          'resource-buildings',

        container:
          'resourceBuildingFilter',

        items:
          buildings,

        allLabel:
          'Все здания',

        onChange:
          LIV.renderResources
      });
  }


  if (
    LIV.$(
      'resourceWorkFilter'
    )
  ) {
    LIV.resources.workFilter =
      LIV.createMultiFilter({
        id:
          'resource-works',

        container:
          'resourceWorkFilter',

        items:
          works,

        allLabel:
          'Все работы',

        onChange:
          LIV.renderResources
      });
  }


  if (
    LIV.$(
      'resourceFrontFilter'
    )
  ) {
    LIV.resources.frontFilter =
      LIV.createMultiFilter({
        id:
          'resource-fronts',

        container:
          'resourceFrontFilter',

        items:
          fronts,

        allLabel:
          'Все фронты',

        onChange:
          LIV.renderResources
      });
  }
};


/* =========================================================
   ОБНОВЛЕНИЕ СПИСКОВ В ФИЛЬТРАХ
   ========================================================= */

LIV.refreshResourceFilters = function () {

  LIV.resources
    .organizationFilter
    ?.setItems(
      (LIV.project.organizations || [])
        .filter(
          item =>
            item.active !== false
        )
        .map(
          item => ({
            id: item.id,
            name: item.name
          })
        )
    );


  LIV.resources
    .buildingFilter
    ?.setItems(
      (LIV.project.buildings || [])
        .filter(
          item =>
            item.active !== false
        )
        .map(
          item => ({
            id: item.id,
            name: item.name
          })
        )
    );


  LIV.resources
    .workFilter
    ?.setItems(
      (LIV.project.works || [])
        .filter(
          item =>
            item.active !== false
        )
        .map(
          item => ({
            id: item.id,
            name: item.name
          })
        )
    );


  LIV.resources
    .frontFilter
    ?.setItems(
      (LIV.project.fronts || [])
        .map(
          front => ({
            id: front.id,
            name:
              LIV.getFrontLabel(front)
          })
        )
    );
};


/* =========================================================
   ФИЛЬТРАЦИЯ ЖУРНАЛА РЕСУРСОВ
   ========================================================= */

LIV.getFilteredResources = function ({
  from = null,
  to = null,
  ignoreCommonDates = false
} = {}) {

  const dateFrom =
    from ||
    (
      ignoreCommonDates
        ? ''
        : LIV.$('resourceFrom')?.value
    ) ||
    '';


  const dateTo =
    to ||
    (
      ignoreCommonDates
        ? ''
        : LIV.$('resourceTo')?.value
    ) ||
    '';


  const organizations =
    LIV.resources
      .organizationFilter
      ?.getSelected() ||
    null;


  const buildings =
    LIV.resources
      .buildingFilter
      ?.getSelected() ||
    null;


  const works =
    LIV.resources
      .workFilter
      ?.getSelected() ||
    null;


  const fronts =
    LIV.resources
      .frontFilter
      ?.getSelected() ||
    null;


  return (
    LIV.project.resources ||
    []
  )
    .filter(
      row => {

        if (
          dateFrom &&
          row.date &&
          row.date < dateFrom
        ) {
          return false;
        }


        if (
          dateTo &&
          row.date &&
          row.date > dateTo
        ) {
          return false;
        }


        if (
          organizations &&
          !organizations.includes(
            String(
              row.organizationId
            )
          )
        ) {
          return false;
        }


        if (
          buildings &&
          !buildings.includes(
            String(
              row.buildingId
            )
          )
        ) {
          return false;
        }


        if (
          works &&
          !works.includes(
            String(
              row.workId
            )
          )
        ) {
          return false;
        }


        if (
          fronts &&
          !fronts.includes(
            String(
              row.frontId
            )
          )
        ) {
          return false;
        }


        return true;
      }
    );
};


/* =========================================================
   ЖУРНАЛ РЕСУРСОВ
   ========================================================= */

LIV.renderResourceJournal = function () {

  const body =
    LIV.$(
      'resourceJournalBody'
    );


  if (!body) {
    return;
  }


  const rows =
    LIV.getFilteredResources();


  const sum = function (field) {
    return rows.reduce(
      (
        total,
        row
      ) =>
        total +
        LIV.num(
          row[field]
        ),
      0
    );
  };


  const peopleByDate =
    {};


  rows.forEach(
    row => {

      if (!row.date) {
        return;
      }


      peopleByDate[
        row.date
      ] =
        (
          peopleByDate[
            row.date
          ] ||
          0
        ) +
        LIV.getResourcePeopleTotal(
          row
        );
    }
  );


  if (
    LIV.$(
      'rItrDays'
    )
  ) {
    LIV.$(
      'rItrDays'
    ).textContent =
      LIV.roundInt(
        sum('itr')
      );
  }


  if (
    LIV.$(
      'rWorkerDays'
    )
  ) {
    LIV.$(
      'rWorkerDays'
    ).textContent =
      LIV.roundInt(
        sum('workers')
      );
  }


  if (
    LIV.$(
      'rMechanizerDays'
    )
  ) {
    LIV.$(
      'rMechanizerDays'
    ).textContent =
      LIV.roundInt(
        sum('mechanizers')
      );
  }


  if (
    LIV.$(
      'rPeopleDays'
    )
  ) {
    LIV.$(
      'rPeopleDays'
    ).textContent =
      LIV.roundInt(
        sum('itr') +
        sum('workers') +
        sum('mechanizers')
      );
  }


  if (
    LIV.$(
      'rPeoplePeak'
    )
  ) {
    LIV.$(
      'rPeoplePeak'
    ).textContent =
      LIV.roundInt(
        Math.max(
          0,
          ...Object.values(
            peopleByDate
          )
        )
      );
  }


  if (
    LIV.$(
      'rEquipmentDays'
    )
  ) {
    LIV.$(
      'rEquipmentDays'
    ).textContent =
      LIV.roundInt(
        sum(
          'equipmentQty'
        )
      );
  }


  body.innerHTML =
    [...rows]
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.date ||
            ''
          ).localeCompare(
            String(
              a.date ||
              ''
            )
          )
      )
      .map(
        row => `
          <tr>

            <td>
              ${LIV.ruDate(
                row.date
              )}
            </td>

            <td>
              ${LIV.esc(
                LIV.getResourceOrganizationName(
                  row
                )
              )}
            </td>

            <td>
              ${LIV.esc(
                LIV.getResourceBuildingName(
                  row
                )
              )}
            </td>

            <td>
              ${LIV.esc(
                LIV.getResourceWorkName(
                  row
                )
              )}
            </td>

            <td>
              ${LIV.roundInt(
                row.itr
              )}
            </td>

            <td>
              ${LIV.roundInt(
                row.workers
              )}
            </td>

            <td>
              ${LIV.roundInt(
                row.mechanizers
              )}
            </td>

            <td>
              ${LIV.esc(
                row.equipmentType ||
                ''
              )}
            </td>

            <td>
              ${LIV.roundInt(
                row.equipmentQty
              )}
            </td>

            <td>
              ${LIV.esc(
                row.comment ||
                ''
              )}
            </td>

            <td>
              <button
                type="button"
                class="row-btn"
                data-resource-edit="${LIV.esc(
                  row.id
                )}"
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
      '[data-resource-edit]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            LIV.openResourceEditor(
              button.dataset
                .resourceEdit
            );
          };
      }
    );
};


/* =========================================================
   ЕЖЕДНЕВНАЯ СВОДКА
   ========================================================= */

LIV.renderResourceDaily = function () {

  const selectedDate =
    LIV.$(
      'resourceDailyDate'
    )?.value ||
    LIV.today();


  const rows =
    LIV.getFilteredResources({
      from:
        selectedDate,

      to:
        selectedDate,

      ignoreCommonDates:
        true
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


      /* ---------------------------------------------
         ЛЮДИ
         --------------------------------------------- */

      if (
        !peopleMap.has(
          organizationId
        )
      ) {
        peopleMap.set(
          organizationId,
          {
            organizationId,
            organizationName:
              LIV.getResourceOrganizationName(
                row
              ),

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
        LIV.num(
          row.itr
        );


      people.workers +=
        LIV.num(
          row.workers
        );


      people.mechanizers +=
        LIV.num(
          row.mechanizers
        );


      /* ---------------------------------------------
         ТЕХНИКА
         --------------------------------------------- */

      const equipmentType =
        LIV.normText(
          row.equipmentType
        );


      if (
        equipmentType
      ) {

        const key =
          [
            organizationId,
            LIV.normKey(
              equipmentType
            )
          ].join('|');


        if (
          !equipmentMap.has(
            key
          )
        ) {
          equipmentMap.set(
            key,
            {
              organizationId,

              organizationName:
                LIV.getResourceOrganizationName(
                  row
                ),

              equipmentType,

              quantity: 0
            }
          );
        }


        equipmentMap
          .get(key)
          .quantity +=
            LIV.num(
              row.equipmentQty
            );
      }
    }
  );


  const peopleRows =
    [
      ...peopleMap.values()
    ]
      .filter(
        row =>
          row.itr ||
          row.workers ||
          row.mechanizers
      )
      .sort(
        (
          a,
          b
        ) =>
          a.organizationName
            .localeCompare(
              b.organizationName,
              'ru'
            )
      );


  const equipmentRows =
    [
      ...equipmentMap.values()
    ]
      .sort(
        (
          a,
          b
        ) => {

          const orgCompare =
            a.organizationName
              .localeCompare(
                b.organizationName,
                'ru'
              );


          if (
            orgCompare !== 0
          ) {
            return orgCompare;
          }


          return (
            a.equipmentType
              .localeCompare(
                b.equipmentType,
                'ru'
              )
          );
        }
      );


  const peopleTotal =
    peopleRows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.itr +
        row.workers +
        row.mechanizers,
      0
    );


  const equipmentTotal =
    equipmentRows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.quantity,
      0
    );


  if (
    LIV.$(
      'dailyPeopleTotal'
    )
  ) {
    LIV.$(
      'dailyPeopleTotal'
    ).textContent =
      LIV.roundInt(
        peopleTotal
      );
  }


  if (
    LIV.$(
      'dailyEquipmentTotal'
    )
  ) {
    LIV.$(
      'dailyEquipmentTotal'
    ).textContent =
      LIV.roundInt(
        equipmentTotal
      );
  }


  if (
    LIV.$(
      'dailyPeopleBody'
    )
  ) {
    LIV.$(
      'dailyPeopleBody'
    ).innerHTML =
      peopleRows
        .map(
          (
            row,
            index
          ) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${LIV.esc(
                  row.organizationName
                )}
              </td>

              <td>
                ${LIV.roundInt(
                  row.itr
                )}
              </td>

              <td>
                ${LIV.roundInt(
                  row.workers
                )}
              </td>

              <td>
                ${LIV.roundInt(
                  row.mechanizers
                )}
              </td>

              <td>
                <b>
                  ${LIV.roundInt(
                    row.itr +
                    row.workers +
                    row.mechanizers
                  )}
                </b>
              </td>

            </tr>
          `
        )
        .join('');
  }


  if (
    LIV.$(
      'dailyEquipmentBody'
    )
  ) {
    LIV.$(
      'dailyEquipmentBody'
    ).innerHTML =
      equipmentRows
        .map(
          (
            row,
            index
          ) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${LIV.esc(
                  row.organizationName
                )}
              </td>

              <td>
                ${LIV.esc(
                  row.equipmentType
                )}
              </td>

              <td>
                ${LIV.roundInt(
                  row.quantity
                )}
              </td>

            </tr>
          `
        )
        .join('');
  }


  if (
    LIV.$(
      'dailyEquipmentFooter'
    )
  ) {
    LIV.$(
      'dailyEquipmentFooter'
    ).textContent =
      LIV.roundInt(
        equipmentTotal
      );
  }
};


/* =========================================================
   ДИАГРАММЫ
   ========================================================= */


/**
 * Уничтожение старых Chart.js графиков.
 * Нужно перед повторной отрисовкой.
 */
LIV.destroyResourceCharts = function () {

  LIV.resources.charts
    .forEach(
      chart => {

        try {
          chart.destroy();
        } catch (error) {
          console.warn(
            error
          );
        }
      }
    );


  LIV.resources.charts =
    [];
};


/**
 * Диаграммы численности.
 *
 * Для каждой организации:
 * 1 линия — ИТР
 * 2 линия — Рабочие
 *
 * Если отчет на дату отсутствует:
 * значение null и линия имеет разрыв.
 *
 * Если отчет существует и значение равно 0:
 * отображается настоящий 0.
 */
LIV.renderResourceCharts = function () {

  const container =
    LIV.$(
      'resourceCharts'
    );


  if (!container) {
    return;
  }


  LIV.destroyResourceCharts();


  if (
    typeof Chart ===
    'undefined'
  ) {
    container.innerHTML = `
      <div class="card">
        Не удалось загрузить модуль диаграмм.
      </div>
    `;

    return;
  }


  const rows =
    LIV.getFilteredResources();


  if (!rows.length) {
    container.innerHTML = `
      <div class="card">
        Нет данных за выбранный период.
      </div>
    `;

    return;
  }


  const from =
    LIV.$(
      'resourceFrom'
    )?.value ||
    '';


  const to =
    LIV.$(
      'resourceTo'
    )?.value ||
    '';


  let dates =
    [];


  if (
    from &&
    to
  ) {
    dates =
      LIV.dateRange(
        from,
        to
      );
  } else {
    dates =
      LIV.unique(
        rows
          .map(
            row =>
              row.date
          )
          .filter(Boolean)
      )
        .sort();
  }


  const organizationIds =
    LIV.unique(
      rows
        .map(
          row =>
            row.organizationId
        )
        .filter(Boolean)
    );


  container.innerHTML =
    '';


  organizationIds
    .forEach(
      organizationId => {

        const orgRows =
          rows.filter(
            row =>
              String(
                row.organizationId
              ) ===
              String(
                organizationId
              )
          );


        const reportsByDate =
          {};


        orgRows.forEach(
          row => {

            if (!row.date) {
              return;
            }


            if (
              !reportsByDate[
                row.date
              ]
            ) {
              reportsByDate[
                row.date
              ] = {
                exists: true,
                itr: 0,
                workers: 0
              };
            }


            reportsByDate[
              row.date
            ].itr +=
              LIV.num(
                row.itr
              );


            reportsByDate[
              row.date
            ].workers +=
              LIV.num(
                row.workers
              );
          }
        );


        const itrData =
          dates.map(
            date => {

              if (
                !reportsByDate[
                  date
                ]
              ) {
                return null;
              }


              return LIV.roundInt(
                reportsByDate[
                  date
                ].itr
              );
            }
          );


        const workerData =
          dates.map(
            date => {

              if (
                !reportsByDate[
                  date
                ]
              ) {
                return null;
              }


              return LIV.roundInt(
                reportsByDate[
                  date
                ].workers
              );
            }
          );


        const organizationName =
          LIV.nameById(
            LIV.project.organizations,
            organizationId
          ) ||
          orgRows[0]
            ?.organizationName ||
          'Организация';


        const card =
          document.createElement(
            'div'
          );


        card.className =
          'card resource-chart-card';


        card.innerHTML = `
          <h2>
            ${LIV.esc(
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


        const chart =
          new Chart(
            canvas,
            {
              type:
                'line',

              data: {
                labels:
                  dates.map(
                    LIV.shortDate
                  ),

                datasets: [
                  {
                    label:
                      'ИТР',

                    data:
                      itrData,

                    borderWidth:
                      2,

                    tension:
                      0.15,

                    spanGaps:
                      false
                  },

                  {
                    label:
                      'Рабочие',

                    data:
                      workerData,

                    borderWidth:
                      2,

                    tension:
                      0.15,

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
                    },

                    title: {
                      display:
                        true,

                      text:
                        'Количество человек'
                    }
                  }
                },

                plugins: {
                  legend: {
                    display:
                      true,

                    position:
                      'top'
                  },

                  tooltip: {
                    callbacks: {
                      label:
                        function (
                          context
                        ) {

                          if (
                            context.raw ===
                            null
                          ) {
                            return (
                              `${context.dataset.label}: ` +
                              `нет отчета`
                            );
                          }


                          return (
                            `${context.dataset.label}: ` +
                            `${context.raw} чел.`
                          );
                        }
                    }
                  }
                }
              }
            }
          );


        LIV.resources.charts.push(
          chart
        );
      }
    );
};


/* =========================================================
   РАСЧЕТ СРЕДНЕГО
   ========================================================= */

/**
 * valuesByDate:
 *
 * {
 *   "2026-10-01": 50,
 *   "2026-10-02": 0
 * }
 *
 * Если ключ даты отсутствует —
 * на эту дату записи нет.
 */
LIV.averageSeries = function ({
  valuesByDate,
  periodDates,
  reportDates,
  projectReportDates,
  method,
  missingRule
}) {

  let calculationDates =
    [];


  switch (method) {

    case 'calendar':

      calculationDates =
        [...periodDates];

      break;


    case 'workdays':

      calculationDates =
        periodDates.filter(
          LIV.isWorkday
        );

      break;


    case 'project-report-days':

      calculationDates =
        [...projectReportDates];

      break;


    case 'nonzero':

      calculationDates =
        [...reportDates];

      break;


    case 'reported':

    default:

      calculationDates =
        [...reportDates];

      break;
  }


  const values =
    [];


  calculationDates.forEach(
    date => {

      const exists =
        Object.prototype
          .hasOwnProperty
          .call(
            valuesByDate,
            date
          );


      if (exists) {

        const value =
          LIV.num(
            valuesByDate[
              date
            ]
          );


        if (
          method ===
            'nonzero' &&
          value ===
            0
        ) {
          return;
        }


        values.push(
          value
        );

        return;
      }


      if (
        missingRule ===
        'zero'
      ) {
        values.push(
          0
        );
      }
    }
  );


  if (
    values.length ===
    0
  ) {
    return {
      raw: 0,
      rounded: 0,
      days: 0
    };
  }


  const raw =
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length;


  return {
    raw,

    rounded:
      LIV.roundInt(
        raw
      ),

    days:
      values.length
  };
};


/* =========================================================
   МЕСЯЧНАЯ АНАЛИТИКА — ЛЮДИ
   ========================================================= */

LIV.calculatePeopleAnalytics = function (
  rows,
  settings
) {

  const {
    periodDates,
    projectReportDates,
    method,
    missingRule
  } = settings;


  const organizationIds =
    LIV.unique(
      rows
        .map(
          row =>
            row.organizationId
        )
        .filter(Boolean)
    );


  return organizationIds
    .map(
      organizationId => {

        const orgRows =
          rows.filter(
            row =>
              String(
                row.organizationId
              ) ===
              String(
                organizationId
              )
          );


        const reportDates =
          LIV.unique(
            orgRows
              .map(
                row =>
                  row.date
              )
              .filter(Boolean)
          )
            .sort();


        const itrByDate =
          {};


        const workersByDate =
          {};


        const mechanizersByDate =
          {};


        const totalByDate =
          {};


        reportDates.forEach(
          date => {

            const dayRows =
              orgRows.filter(
                row =>
                  row.date ===
                  date
              );


            const itr =
              dayRows.reduce(
                (
                  sum,
                  row
                ) =>
                  sum +
                  LIV.num(
                    row.itr
                  ),
                0
              );


            const workers =
              dayRows.reduce(
                (
                  sum,
                  row
                ) =>
                  sum +
                  LIV.num(
                    row.workers
                  ),
                0
              );


            const mechanizers =
              dayRows.reduce(
                (
                  sum,
                  row
                ) =>
                  sum +
                  LIV.num(
                    row.mechanizers
                  ),
                0
              );


            itrByDate[
              date
            ] =
              itr;


            workersByDate[
              date
            ] =
              workers;


            mechanizersByDate[
              date
            ] =
              mechanizers;


            totalByDate[
              date
            ] =
              itr +
              workers +
              mechanizers;
          }
        );


        const common = {
          periodDates,
          reportDates,
          projectReportDates,
          method,
          missingRule
        };


        const itr =
          LIV.averageSeries({
            ...common,

            valuesByDate:
              itrByDate
          });


        const workers =
          LIV.averageSeries({
            ...common,

            valuesByDate:
              workersByDate
          });


        const mechanizers =
          LIV.averageSeries({
            ...common,

            valuesByDate:
              mechanizersByDate
          });


        const total =
          LIV.averageSeries({
            ...common,

            valuesByDate:
              totalByDate
          });


        const first =
          orgRows[0];


        return {
          organizationId,

          organizationName:
            LIV.nameById(
              LIV.project.organizations,
              organizationId
            ) ||
            first
              ?.organizationName ||
            'Организация',

          itr:
            itr.rounded,

          workers:
            workers.rounded,

          mechanizers:
            mechanizers.rounded,

          total:
            total.rounded,

          days:
            total.days
        };
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        a.organizationName
          .localeCompare(
            b.organizationName,
            'ru'
          )
    );
};


/* =========================================================
   МЕСЯЧНАЯ АНАЛИТИКА — ТЕХНИКА
   ========================================================= */

LIV.calculateEquipmentAnalytics = function (
  rows,
  settings
) {

  const {
    periodDates,
    projectReportDates,
    method,
    missingRule
  } = settings;


  const equipmentTypes =
    LIV.unique(
      rows
        .map(
          row =>
            LIV.normText(
              row.equipmentType
            )
        )
        .filter(Boolean)
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


  const organizationIds =
    LIV.unique(
      rows
        .map(
          row =>
            row.organizationId
        )
        .filter(Boolean)
    );


  const data =
    organizationIds
      .map(
        organizationId => {

          const orgRows =
            rows.filter(
              row =>
                String(
                  row.organizationId
                ) ===
                String(
                  organizationId
                )
            );


          const reportDates =
            LIV.unique(
              orgRows
                .map(
                  row =>
                    row.date
                )
                .filter(Boolean)
            )
              .sort();


          const values =
            {};


          equipmentTypes
            .forEach(
              equipmentType => {

                const byDate =
                  {};


                reportDates.forEach(
                  date => {

                    const dayRows =
                      orgRows.filter(
                        row =>
                          row.date ===
                            date &&
                          LIV.sameText(
                            row.equipmentType,
                            equipmentType
                          )
                      );


                    if (
                      dayRows.length
                    ) {
                      byDate[
                        date
                      ] =
                        dayRows.reduce(
                          (
                            total,
                            row
                          ) =>
                            total +
                            LIV.num(
                              row.equipmentQty
                            ),
                          0
                        );
                    }
                  }
                );


                const result =
                  LIV.averageSeries({
                    valuesByDate:
                      byDate,

                    periodDates,

                    reportDates,

                    projectReportDates,

                    method,

                    missingRule
                  });


                values[
                  equipmentType
                ] =
                  result.rounded;
              }
            );


          return {
            organizationId,

            organizationName:
              LIV.nameById(
                LIV.project.organizations,
                organizationId
              ) ||
              orgRows[0]
                ?.organizationName ||
              'Организация',

            values
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          a.organizationName
            .localeCompare(
              b.organizationName,
              'ru'
            )
      );


  return {
    equipmentTypes,
    data
  };
};


/* =========================================================
   ОБЩАЯ МЕСЯЧНАЯ АНАЛИТИКА
   ========================================================= */

LIV.renderResourceAnalytics = function () {

  if (
    !LIV.$(
      'averagePeopleBody'
    )
  ) {
    return;
  }


  const rows =
    LIV.getFilteredResources();


  const from =
    LIV.$(
      'resourceFrom'
    )?.value ||
    '';


  const to =
    LIV.$(
      'resourceTo'
    )?.value ||
    '';


  const method =
    LIV.$(
      'resourceAverageMethod'
    )?.value ||
    'reported';


  const missingRule =
    LIV.$(
      'resourceMissingRule'
    )?.value ||
    'skip';


  const periodDates =
    LIV.dateRange(
      from,
      to
    );


  const projectReportDates =
    LIV.unique(
      rows
        .map(
          row =>
            row.date
        )
        .filter(Boolean)
    )
      .sort();


  const settings = {
    periodDates,
    projectReportDates,
    method,
    missingRule
  };


  /* -------------------------------------------------------
     ЛЮДИ
     ------------------------------------------------------- */

  const peopleRows =
    LIV.calculatePeopleAnalytics(
      rows,
      settings
    );


  LIV.$(
    'averagePeopleBody'
  ).innerHTML =
    peopleRows
      .map(
        row => `
          <tr>

            <td>
              ${LIV.esc(
                row.organizationName
              )}
            </td>

            <td>
              ${row.itr}
            </td>

            <td>
              ${row.mechanizers}
            </td>

            <td>
              ${row.workers}
            </td>

            <td>
              <b>
                ${row.total}
              </b>
            </td>

          </tr>
        `
      )
      .join('');


  /* -------------------------------------------------------
     ТЕХНИКА
     ------------------------------------------------------- */

  const equipment =
    LIV.calculateEquipmentAnalytics(
      rows,
      settings
    );


  if (
    LIV.$(
      'averageEquipmentHead'
    )
  ) {
    LIV.$(
      'averageEquipmentHead'
    ).innerHTML = `
      <tr>

        <th>
          Организация
        </th>

        ${
          equipment
            .equipmentTypes
            .map(
              type => `
                <th>
                  ${LIV.esc(type)}
                </th>
              `
            )
            .join('')
        }

      </tr>
    `;
  }


  if (
    LIV.$(
      'averageEquipmentBody'
    )
  ) {
    LIV.$(
      'averageEquipmentBody'
    ).innerHTML =
      equipment.data
        .map(
          row => `
            <tr>

              <td>
                ${LIV.esc(
                  row.organizationName
                )}
              </td>

              ${
                equipment
                  .equipmentTypes
                  .map(
                    type => `
                      <td>
                        ${
                          LIV.roundInt(
                            row.values[
                              type
                            ]
                          )
                        }
                      </td>
                    `
                  )
                  .join('')
              }

            </tr>
          `
        )
        .join('');
  }


  /* -------------------------------------------------------
     ОБЩИЕ ПОКАЗАТЕЛИ
     ------------------------------------------------------- */

  const totalsByDate =
    {};


  rows.forEach(
    row => {

      if (!row.date) {
        return;
      }


      if (
        !totalsByDate[
          row.date
        ]
      ) {
        totalsByDate[
          row.date
        ] = {
          people: 0,
          equipment: 0
        };
      }


      totalsByDate[
        row.date
      ].people +=
        LIV.getResourcePeopleTotal(
          row
        );


      totalsByDate[
        row.date
      ].equipment +=
        LIV.num(
          row.equipmentQty
        );
    }
  );


  const reportDates =
    Object.keys(
      totalsByDate
    )
      .sort();


  const peopleByDate =
    {};


  const equipmentByDate =
    {};


  reportDates.forEach(
    date => {

      peopleByDate[
        date
      ] =
        totalsByDate[
          date
        ].people;


      equipmentByDate[
        date
      ] =
        totalsByDate[
          date
        ].equipment;
    }
  );


  const common = {
    periodDates,

    reportDates,

    projectReportDates:
      reportDates,

    method,

    missingRule
  };


  const peopleAverage =
    LIV.averageSeries({
      ...common,

      valuesByDate:
        peopleByDate
    });


  const equipmentAverage =
    LIV.averageSeries({
      ...common,

      valuesByDate:
        equipmentByDate
    });


  if (
    LIV.$(
      'averagePeopleTotal'
    )
  ) {
    LIV.$(
      'averagePeopleTotal'
    ).textContent =
      peopleAverage.rounded;
  }


  if (
    LIV.$(
      'averageEquipmentTotal'
    )
  ) {
    LIV.$(
      'averageEquipmentTotal'
    ).textContent =
      equipmentAverage.rounded;
  }


  if (
    LIV.$(
      'averageDaysCount'
    )
  ) {
    LIV.$(
      'averageDaysCount'
    ).textContent =
      Math.max(
        peopleAverage.days,
        equipmentAverage.days
      );
  }
};


/* =========================================================
   СОХРАНЕННОЕ ПРЕДСТАВЛЕНИЕ РЕСУРСОВ
   ========================================================= */

LIV.saveCurrentResourceView = async function () {

  const name =
    prompt(
      'Название представления'
    );


  if (
    !name ||
    !name.trim()
  ) {
    return;
  }


  const view = {
    id:
      LIV.uid('VIEW'),

    type:
      'resources',

    name:
      name.trim(),

    createdAt:
      LIV.nowIso(),

    config: {
      resourceView:
        LIV.resources.view,

      from:
        LIV.$(
          'resourceFrom'
        )?.value ||
        '',

      to:
        LIV.$(
          'resourceTo'
        )?.value ||
        '',

      organizations:
        LIV.resources
          .organizationFilter
          ?.getSelected() ||
        null,

      buildings:
        LIV.resources
          .buildingFilter
          ?.getSelected() ||
        null,

      works:
        LIV.resources
          .workFilter
          ?.getSelected() ||
        null,

      fronts:
        LIV.resources
          .frontFilter
          ?.getSelected() ||
        null,

      averageMethod:
        LIV.$(
          'resourceAverageMethod'
        )?.value ||
        'reported',

      missingRule:
        LIV.$(
          'resourceMissingRule'
        )?.value ||
        'skip',

      rounding:
        'integer'
    }
  };


  LIV.project.views.push(
    view
  );


  LIV.log(
    'Создано представление',
    'Ресурсы',
    view.name,
    {
      viewId:
        view.id
    }
  );


  await LIV.saveProject();


  alert(
    `Представление «${view.name}» сохранено.`
  );
};


/* =========================================================
   РЕДАКТОР РЕСУРСОВ
   ========================================================= */

LIV.openResourceEditor = function (
  id = null
) {

  if (
    typeof LIV.openModal !==
    'function'
  ) {
    console.warn(
      'Функция LIV.openModal пока не подключена.'
    );

    return;
  }


  const existing =
    id
      ? LIV.byId(
          LIV.project.resources,
          id
        )
      : null;


  const row =
    existing
      ? LIV.clone(
          existing
        )
      : {
          date:
            LIV.today(),

          organizationId:
            '',

          buildingId:
            '',

          workId:
            '',

          frontId:
            '',

          itr:
            0,

          workers:
            0,

          mechanizers:
            0,

          equipmentType:
            '',

          equipmentQty:
            0,

          comment:
            ''
        };


  const organizationsOptions =
    (
      LIV.project.organizations ||
      []
    )
      .map(
        item => `
          <option
            value="${LIV.esc(item.id)}"
            ${
              String(
                item.id
              ) ===
              String(
                row.organizationId
              )
                ? 'selected'
                : ''
            }
          >
            ${LIV.esc(
              item.name
            )}
          </option>
        `
      )
      .join('');


  const buildingOptions =
    (
      LIV.project.buildings ||
      []
    )
      .map(
        item => `
          <option
            value="${LIV.esc(item.id)}"
            ${
              String(
                item.id
              ) ===
              String(
                row.buildingId
              )
                ? 'selected'
                : ''
            }
          >
            ${LIV.esc(
              item.name
            )}
          </option>
        `
      )
      .join('');


  const workOptions =
    (
      LIV.project.works ||
      []
    )
      .map(
        item => `
          <option
            value="${LIV.esc(item.id)}"
            ${
              String(
                item.id
              ) ===
              String(
                row.workId
              )
                ? 'selected'
                : ''
            }
          >
            ${LIV.esc(
              item.name
            )}
          </option>
        `
      )
      .join('');


  const frontOptions =
    (
      LIV.project.fronts ||
      []
    )
      .map(
        front => `
          <option
            value="${LIV.esc(front.id)}"
            ${
              String(
                front.id
              ) ===
              String(
                row.frontId
              )
                ? 'selected'
                : ''
            }
          >
            ${LIV.esc(
              LIV.getFrontLabel(
                front
              )
            )}
          </option>
        `
      )
      .join('');


  LIV.openModal(
    existing
      ? 'Редактирование ресурсов'
      : 'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Дата
          </label>

          <input
            id="editResourceDate"
            type="date"
            value="${LIV.esc(
              row.date
            )}"
          >

        </div>


        <div class="field">

          <label>
            Организация
          </label>

          <select
            id="editResourceOrganization"
          >

            <option value="">
              —
            </option>

            ${organizationsOptions}

          </select>

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select
            id="editResourceBuilding"
          >

            <option value="">
              —
            </option>

            ${buildingOptions}

          </select>

        </div>


        <div class="field">

          <label>
            Работа
          </label>

          <select
            id="editResourceWork"
          >

            <option value="">
              —
            </option>

            ${workOptions}

          </select>

        </div>


        <div class="field">

          <label>
            Фронт
          </label>

          <select
            id="editResourceFront"
          >

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
            id="editResourceItr"
            type="number"
            min="0"
            step="1"
            value="${LIV.roundInt(
              row.itr
            )}"
          >

        </div>


        <div class="field">

          <label>
            Рабочие
          </label>

          <input
            id="editResourceWorkers"
            type="number"
            min="0"
            step="1"
            value="${LIV.roundInt(
              row.workers
            )}"
          >

        </div>


        <div class="field">

          <label>
            Механизаторы
          </label>

          <input
            id="editResourceMechanizers"
            type="number"
            min="0"
            step="1"
            value="${LIV.roundInt(
              row.mechanizers
            )}"
          >

        </div>


        <div class="field">

          <label>
            Наименование техники
          </label>

          <input
            id="editResourceEquipmentType"
            type="text"
            value="${LIV.esc(
              row.equipmentType
            )}"
          >

        </div>


        <div class="field">

          <label>
            Количество техники
          </label>

          <input
            id="editResourceEquipmentQty"
            type="number"
            min="0"
            step="1"
            value="${LIV.roundInt(
              row.equipmentQty
            )}"
          >

        </div>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea
          id="editResourceComment"
          rows="4"
        >${LIV.esc(
          row.comment
        )}</textarea>

      </div>


      <div class="editor-actions">

        ${
          existing
            ? `
              <button
                id="deleteResourceBtn"
                type="button"
                class="btn danger"
              >
                Удалить запись
              </button>
            `
            : ''
        }

        <button
          id="saveResourceBtn"
          type="button"
          class="btn primary"
        >
          Сохранить
        </button>

      </div>
    `
  );


  LIV.$(
    'saveResourceBtn'
  ).onclick =
    async function () {

      const target =
        existing ||
        {
          id:
            LIV.uid('R'),

          createdAt:
            LIV.nowIso()
        };


      target.date =
        LIV.$(
          'editResourceDate'
        ).value;


      target.organizationId =
        LIV.$(
          'editResourceOrganization'
        ).value;


      target.buildingId =
        LIV.$(
          'editResourceBuilding'
        ).value;


      target.workId =
        LIV.$(
          'editResourceWork'
        ).value;


      target.frontId =
        LIV.$(
          'editResourceFront'
        ).value;


      target.itr =
        LIV.roundInt(
          LIV.$(
            'editResourceItr'
          ).value
        );


      target.workers =
        LIV.roundInt(
          LIV.$(
            'editResourceWorkers'
          ).value
        );


      target.mechanizers =
        LIV.roundInt(
          LIV.$(
            'editResourceMechanizers'
          ).value
        );


      target.equipmentType =
        LIV.normText(
          LIV.$(
            'editResourceEquipmentType'
          ).value
        );


      target.equipmentQty =
        LIV.roundInt(
          LIV.$(
            'editResourceEquipmentQty'
          ).value
        );


      target.comment =
        LIV.normText(
          LIV.$(
            'editResourceComment'
          ).value
        );


      target.updatedAt =
        LIV.nowIso();


      if (!existing) {
        LIV.project.resources.push(
          target
        );
      }


      LIV.log(
        existing
          ? 'Изменена запись'
          : 'Создана запись',

        'Ресурсы',

        [
          target.date,
          LIV.getResourceOrganizationName(
            target
          )
        ]
          .filter(Boolean)
          .join(' · '),

        {
          resourceId:
            target.id
        }
      );


      await LIV.saveProject();


      LIV.closeModal();


      LIV.refreshResourceFilters();


      LIV.renderResources();


      if (
        typeof LIV.renderOrganizations ===
        'function'
      ) {
        LIV.renderOrganizations();
      }
    };


  if (
    existing &&
    LIV.$(
      'deleteResourceBtn'
    )
  ) {
    LIV.$(
      'deleteResourceBtn'
    ).onclick =
      async function () {

        const approved =
          confirm(
            'Удалить эту запись ресурсов?'
          );


        if (!approved) {
          return;
        }


        LIV.project.resources =
          LIV.project.resources
            .filter(
              item =>
                item.id !==
                existing.id
            );


        LIV.log(
          'Удалена запись',
          'Ресурсы',

          [
            existing.date,
            LIV.getResourceOrganizationName(
              existing
            )
          ]
            .filter(Boolean)
            .join(' · '),

          {
            resourceId:
              existing.id
          }
        );


        await LIV.saveProject();


        LIV.closeModal();


        LIV.refreshResourceFilters();


        LIV.renderResources();


        if (
          typeof LIV.renderOrganizations ===
          'function'
        ) {
          LIV.renderOrganizations();
        }
      };
  }
};


/* =========================================================
   ПЛАН РЕСУРСОВ
   ========================================================= */


/**
 * Количество дней для планового расчета.
 */
LIV.getResourcePlanDays = function (
  from,
  to,
  calendarType = 'workdays'
) {

  let days =
    LIV.dateRange(
      from,
      to
    );


  if (
    calendarType ===
    'workdays'
  ) {
    days =
      days.filter(
        LIV.isWorkday
      );
  }


  return days;
};


/**
 * Расчет численности из правила:
 *
 * Объем / выработка / количество рабочих дней
 */
LIV.calculateRequiredPeople = function (
  volume,
  productivity,
  workdays
) {

  const v =
    LIV.num(
      volume
    );


  const p =
    LIV.num(
      productivity
    );


  const d =
    LIV.num(
      workdays
    );


  if (
    v <= 0 ||
    p <= 0 ||
    d <= 0
  ) {
    return 0;
  }


  return Math.ceil(
    v /
    p /
    d
  );
};


/**
 * Возвращает ежедневный план людей.
 */
LIV.getResourcePlanDaily = function (
  plan
) {

  if (
    !plan?.dateFrom ||
    !plan?.dateTo
  ) {
    return [];
  }


  const days =
    LIV.getResourcePlanDays(
      plan.dateFrom,
      plan.dateTo,
      plan.calendarType ||
      'workdays'
    );


  let people =
    LIV.roundInt(
      plan.people
    );


  if (
    plan.method ===
    'rule'
  ) {
    people =
      LIV.calculateRequiredPeople(
        plan.volume,
        plan.productivity,
        days.length
      );
  }


  return days.map(
    date => ({
      date,
      people
    })
  );
};


/* =========================================================
   ФИЛЬТРАЦИЯ ПЛАНОВ РЕСУРСОВ
   ========================================================= */

LIV.getFilteredResourcePlans = function () {

  const from =
    LIV.$(
      'resourceFrom'
    )?.value ||
    '';


  const to =
    LIV.$(
      'resourceTo'
    )?.value ||
    '';


  const organizations =
    LIV.resources
      .organizationFilter
      ?.getSelected() ||
    null;


  const buildings =
    LIV.resources
      .buildingFilter
      ?.getSelected() ||
    null;


  const works =
    LIV.resources
      .workFilter
      ?.getSelected() ||
    null;


  const fronts =
    LIV.resources
      .frontFilter
      ?.getSelected() ||
    null;


  return (
    LIV.project.resourcePlans ||
    []
  )
    .filter(
      plan => {

        if (
          from &&
          plan.dateTo &&
          plan.dateTo < from
        ) {
          return false;
        }


        if (
          to &&
          plan.dateFrom &&
          plan.dateFrom > to
        ) {
          return false;
        }


        if (
          organizations &&
          !organizations.includes(
            String(
              plan.organizationId
            )
          )
        ) {
          return false;
        }


        if (
          buildings &&
          !buildings.includes(
            String(
              plan.buildingId
            )
          )
        ) {
          return false;
        }


        if (
          works &&
          !works.includes(
            String(
              plan.workId
            )
          )
        ) {
          return false;
        }


        if (
          fronts &&
          !fronts.includes(
            String(
              plan.frontId
            )
          )
        ) {
          return false;
        }


        return true;
      }
    );
};


/* =========================================================
   ПЛАН / ФАКТ РЕСУРСОВ
   ========================================================= */

LIV.renderResourcePlanFact = function () {

  const body =
    LIV.$(
      'resourcePlanFactBody'
    );


  if (!body) {
    return;
  }


  const from =
    LIV.$(
      'resourceFrom'
    )?.value ||
    '';


  const to =
    LIV.$(
      'resourceTo'
    )?.value ||
    '';


  const step =
    LIV.$(
      'resourcePlanStep'
    )?.value ||
    'week';


  const factRows =
    LIV.getFilteredResources();


  const plans =
    LIV.getFilteredResourcePlans();


  const factByDate =
    {};


  factRows.forEach(
    row => {

      if (!row.date) {
        return;
      }


      factByDate[
        row.date
      ] =
        (
          factByDate[
            row.date
          ] ||
          0
        ) +
        LIV.getResourcePeopleTotal(
          row
        );
    }
  );


  const planByDate =
    {};


  plans.forEach(
    plan => {

      LIV.getResourcePlanDaily(
        plan
      )
        .forEach(
          item => {

            if (
              from &&
              item.date < from
            ) {
              return;
            }


            if (
              to &&
              item.date > to
            ) {
              return;
            }


            planByDate[
              item.date
            ] =
              (
                planByDate[
                  item.date
                ] ||
                0
              ) +
              LIV.num(
                item.people
              );
          }
        );
    }
  );


  let dates =
    LIV.unique([
      ...Object.keys(
        factByDate
      ),
      ...Object.keys(
        planByDate
      )
    ])
      .sort();


  if (
    from &&
    to
  ) {
    dates =
      LIV.dateRange(
        from,
        to
      );
  }


  const daily =
    dates.map(
      date => {

        const plan =
          LIV.roundInt(
            planByDate[
              date
            ] ||
            0
          );


        const fact =
          LIV.roundInt(
            factByDate[
              date
            ] ||
            0
          );


        return {
          date,
          plan,
          fact,
          deviation:
            fact -
            plan
        };
      }
    );


  let displayRows =
    daily;


  if (
    step ===
    'week'
  ) {
    displayRows =
      LIV.groupResourcePlanFactByWeek(
        daily
      );
  }


  body.innerHTML =
    displayRows
      .map(
        item => `
          <tr>

            <td>
              ${LIV.esc(
                item.label
              )}
            </td>

            <td>
              ${LIV.roundInt(
                item.plan
              )}
            </td>

            <td>
              ${LIV.roundInt(
                item.fact
              )}
            </td>

            <td>
              ${
                item.deviation > 0
                  ? '+'
                  : ''
              }${LIV.roundInt(
                item.deviation
              )}
            </td>

          </tr>
        `
      )
      .join('');


  const planTotal =
    daily.reduce(
      (
        total,
        item
      ) =>
        total +
        item.plan,
      0
    );


  const factTotal =
    daily.reduce(
      (
        total,
        item
      ) =>
        total +
        item.fact,
      0
    );


  if (
    LIV.$(
      'resourcePlanTotal'
    )
  ) {
    LIV.$(
      'resourcePlanTotal'
    ).textContent =
      LIV.roundInt(
        planTotal
      );
  }


  if (
    LIV.$(
      'resourceFactTotal'
    )
  ) {
    LIV.$(
      'resourceFactTotal'
    ).textContent =
      LIV.roundInt(
        factTotal
      );
  }


  if (
    LIV.$(
      'resourceDeviation'
    )
  ) {
    const deviation =
      factTotal -
      planTotal;


    LIV.$(
      'resourceDeviation'
    ).textContent =
      (
        deviation > 0
          ? '+'
          : ''
      ) +
      LIV.roundInt(
        deviation
      );
  }


  LIV.renderResourcePlanFactChart(
    displayRows
  );
};


/* =========================================================
   ГРУППИРОВКА ПЛАН / ФАКТ ПО НЕДЕЛЯМ
   ========================================================= */

LIV.groupResourcePlanFactByWeek = function (
  daily
) {

  const groups =
    new Map();


  daily.forEach(
    item => {

      const date =
        new Date(
          `${item.date}T00:00:00`
        );


      const day =
        date.getDay();


      const offset =
        day === 0
          ? -6
          : 1 - day;


      const monday =
        new Date(date);


      monday.setDate(
        date.getDate() +
        offset
      );


      const sunday =
        new Date(
          monday
        );


      sunday.setDate(
        monday.getDate() +
        6
      );


      const mondayIso =
        monday
          .toISOString()
          .slice(
            0,
            10
          );


      const sundayIso =
        sunday
          .toISOString()
          .slice(
            0,
            10
          );


      const key =
        mondayIso;


      if (
        !groups.has(
          key
        )
      ) {
        groups.set(
          key,
          {
            label:
              `${LIV.shortDate(
                mondayIso
              )}–${LIV.shortDate(
                sundayIso
              )}`,

            planSum:
              0,

            factSum:
              0,

            count:
              0
          }
        );
      }


      const group =
        groups.get(
          key
        );


      group.planSum +=
        item.plan;


      group.factSum +=
        item.fact;


      group.count +=
        1;
    }
  );


  return [
    ...groups.values()
  ]
    .map(
      group => {

        const plan =
          group.count
            ? (
                group.planSum /
                group.count
              )
            : 0;


        const fact =
          group.count
            ? (
                group.factSum /
                group.count
              )
            : 0;


        return {
          label:
            group.label,

          plan:
            LIV.roundInt(
              plan
            ),

          fact:
            LIV.roundInt(
              fact
            ),

          deviation:
            LIV.roundInt(
              fact -
              plan
            )
        };
      }
    );
};


/* =========================================================
   ДИАГРАММА ПЛАН / ФАКТ РЕСУРСОВ
   ========================================================= */

LIV.renderResourcePlanFactChart = function (
  rows
) {

  const canvas =
    LIV.$(
      'resourcePlanFactChart'
    );


  if (
    !canvas ||
    typeof Chart ===
    'undefined'
  ) {
    return;
  }


  if (
    LIV.resources
      .planFactChart
  ) {
    try {
      LIV.resources
        .planFactChart
        .destroy();
    } catch (error) {
      console.warn(
        error
      );
    }
  }


  LIV.resources.planFactChart =
    new Chart(
      canvas,
      {
        type:
          'line',

        data: {
          labels:
            rows.map(
              row =>
                row.label
            ),

          datasets: [
            {
              label:
                'План',

              data:
                rows.map(
                  row =>
                    LIV.roundInt(
                      row.plan
                    )
                ),

              borderWidth:
                2,

              tension:
                0.15
            },

            {
              label:
                'Факт',

              data:
                rows.map(
                  row =>
                    LIV.roundInt(
                      row.fact
                    )
                ),

              borderWidth:
                2,

              tension:
                0.15
            }
          ]
        },

        options: {
          responsive:
            true,

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
              },

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
};


/* =========================================================
   РЕДАКТОР ПЛАНА РЕСУРСОВ
   ========================================================= */

LIV.openResourcePlanEditor = function (
  id = null
) {

  if (
    typeof LIV.openModal !==
    'function'
  ) {
    return;
  }


  const existing =
    id
      ? LIV.byId(
          LIV.project.resourcePlans,
          id
        )
      : null;


  const plan =
    existing
      ? LIV.clone(
          existing
        )
      : {
          method:
            'manual',

          dateFrom:
            LIV.$(
              'resourceFrom'
            )?.value ||
            LIV.today(),

          dateTo:
            LIV.$(
              'resourceTo'
            )?.value ||
            LIV.today(),

          organizationId:
            '',

          buildingId:
            '',

          workId:
            '',

          frontId:
            '',

          people:
            0,

          volume:
            0,

          productivity:
            0,

          calendarType:
            'workdays',

          comment:
            ''
        };


  const options = function (
    list,
    selectedId,
    labelFunction = null
  ) {

    return (
      list ||
      []
    )
      .map(
        item => {

          const label =
            labelFunction
              ? labelFunction(
                  item
                )
              : item.name;


          return `
            <option
              value="${LIV.esc(
                item.id
              )}"
              ${
                String(
                  item.id
                ) ===
                String(
                  selectedId
                )
                  ? 'selected'
                  : ''
              }
            >
              ${LIV.esc(
                label
              )}
            </option>
          `;
        }
      )
      .join('');
  };


  LIV.openModal(
    existing
      ? 'Редактировать план ресурсов'
      : 'Добавить план ресурсов',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Способ задания
          </label>

          <select
            id="resourcePlanMethodEdit"
          >

            <option
              value="manual"
              ${
                plan.method ===
                'manual'
                  ? 'selected'
                  : ''
              }
            >
              Вручную
            </option>

            <option
              value="rule"
              ${
                plan.method ===
                'rule'
                  ? 'selected'
                  : ''
              }
            >
              По объему и выработке
            </option>

          </select>

        </div>


        <div class="field">

          <label>
            Начало
          </label>

          <input
            id="resourcePlanFromEdit"
            type="date"
            value="${LIV.esc(
              plan.dateFrom
            )}"
          >

        </div>


        <div class="field">

          <label>
            Окончание
          </label>

          <input
            id="resourcePlanToEdit"
            type="date"
            value="${LIV.esc(
              plan.dateTo
            )}"
          >

        </div>


        <div class="field">

          <label>
            Организация
          </label>

          <select
            id="resourcePlanOrganizationEdit"
          >

            <option value="">
              —
            </option>

            ${
              options(
                LIV.project.organizations,
                plan.organizationId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select
            id="resourcePlanBuildingEdit"
          >

            <option value="">
              —
            </option>

            ${
              options(
                LIV.project.buildings,
                plan.buildingId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Работа
          </label>

          <select
            id="resourcePlanWorkEdit"
          >

            <option value="">
              —
            </option>

            ${
              options(
                LIV.project.works,
                plan.workId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Фронт
          </label>

          <select
            id="resourcePlanFrontEdit"
          >

            <option value="">
              —
            </option>

            ${
              options(
                LIV.project.fronts,
                plan.frontId,
                LIV.getFrontLabel
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Плановая численность, чел.
          </label>

          <input
            id="resourcePlanPeopleEdit"
            type="number"
            min="0"
            step="1"
            value="${LIV.roundInt(
              plan.people
            )}"
          >

        </div>


        <div class="field">

          <label>
            Объем
          </label>

          <input
            id="resourcePlanVolumeEdit"
            type="number"
            min="0"
            step="any"
            value="${LIV.num(
              plan.volume
            )}"
          >

        </div>


        <div class="field">

          <label>
            Выработка на 1 человека в день
          </label>

          <input
            id="resourcePlanProductivityEdit"
            type="number"
            min="0"
            step="any"
            value="${LIV.num(
              plan.productivity
            )}"
          >

        </div>


        <div class="field">

          <label>
            Календарь
          </label>

          <select
            id="resourcePlanCalendarEdit"
          >

            <option
              value="workdays"
              ${
                plan.calendarType ===
                'workdays'
                  ? 'selected'
                  : ''
              }
            >
              Рабочие дни 5/2
            </option>

            <option
              value="calendar"
              ${
                plan.calendarType ===
                'calendar'
                  ? 'selected'
                  : ''
              }
            >
              Календарные дни
            </option>

          </select>

        </div>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea
          id="resourcePlanCommentEdit"
          rows="4"
        >${LIV.esc(
          plan.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        ${
          existing
            ? `
              <button
                id="deleteResourcePlanBtn"
                type="button"
                class="btn danger"
              >
                Удалить план
              </button>
            `
            : ''
        }

        <button
          id="saveResourcePlanBtn"
          type="button"
          class="btn primary"
        >
          Сохранить
        </button>

      </div>
    `
  );


  LIV.$(
    'saveResourcePlanBtn'
  ).onclick =
    async function () {

      const target =
        existing ||
        {
          id:
            LIV.uid(
              'RP'
            ),

          createdAt:
            LIV.nowIso()
        };


      target.method =
        LIV.$(
          'resourcePlanMethodEdit'
        ).value;


      target.dateFrom =
        LIV.$(
          'resourcePlanFromEdit'
        ).value;


      target.dateTo =
        LIV.$(
          'resourcePlanToEdit'
        ).value;


      target.organizationId =
        LIV.$(
          'resourcePlanOrganizationEdit'
        ).value;


      target.buildingId =
        LIV.$(
          'resourcePlanBuildingEdit'
        ).value;


      target.workId =
        LIV.$(
          'resourcePlanWorkEdit'
        ).value;


      target.frontId =
        LIV.$(
          'resourcePlanFrontEdit'
        ).value;


      target.people =
        LIV.roundInt(
          LIV.$(
            'resourcePlanPeopleEdit'
          ).value
        );


      target.volume =
        LIV.num(
          LIV.$(
            'resourcePlanVolumeEdit'
          ).value
        );


      target.productivity =
        LIV.num(
          LIV.$(
            'resourcePlanProductivityEdit'
          ).value
        );


      target.calendarType =
        LIV.$(
          'resourcePlanCalendarEdit'
        ).value;


      target.comment =
        LIV.normText(
          LIV.$(
            'resourcePlanCommentEdit'
          ).value
        );


      target.updatedAt =
        LIV.nowIso();


      if (
        target.method ===
        'rule'
      ) {

        const days =
          LIV.getResourcePlanDays(
            target.dateFrom,
            target.dateTo,
            target.calendarType
          );


        target.people =
          LIV.calculateRequiredPeople(
            target.volume,
            target.productivity,
            days.length
          );
      }


      if (!existing) {
        LIV.project.resourcePlans.push(
          target
        );
      }


      LIV.log(
        existing
          ? 'Изменен план ресурсов'
          : 'Создан план ресурсов',

        'План ресурсов',

        `${target.dateFrom} — ${target.dateTo}`,

        {
          resourcePlanId:
            target.id
        }
      );


      await LIV.saveProject();


      LIV.closeModal();


      LIV.renderResourcePlanFact();
    };


  if (
    existing &&
    LIV.$(
      'deleteResourcePlanBtn'
    )
  ) {
    LIV.$(
      'deleteResourcePlanBtn'
    ).onclick =
      async function () {

        if (
          !confirm(
            'Удалить этот план ресурсов?'
          )
        ) {
          return;
        }


        LIV.project.resourcePlans =
          LIV.project.resourcePlans
            .filter(
              item =>
                item.id !==
                existing.id
            );


        LIV.log(
          'Удален план ресурсов',
          'План ресурсов',

          `${existing.dateFrom} — ${existing.dateTo}`,

          {
            resourcePlanId:
              existing.id
          }
        );


        await LIV.saveProject();


        LIV.closeModal();


        LIV.renderResourcePlanFact();
      };
  }
};


/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ПОДВКЛАДОК РЕСУРСОВ
   ========================================================= */

LIV.switchResourceView = function (
  view
) {

  LIV.resources.view =
    view;


  document
    .querySelectorAll(
      '.resource-tab'
    )
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset
            .resourceView ===
            view
        );
      }
    );


  document
    .querySelectorAll(
      '.resource-view'
    )
    .forEach(
      section => {

        section.classList.add(
          'hidden'
        );
      }
    );


  LIV.$(
    `resource-view-${view}`
  )
    ?.classList
    .remove(
      'hidden'
    );


  LIV.renderResources();
};


/* =========================================================
   ГЛАВНАЯ ОТРИСОВКА МОДУЛЯ
   ========================================================= */

LIV.renderResources = function () {

  switch (
    LIV.resources.view
  ) {

    case 'daily':

      LIV.renderResourceDaily();

      break;


    case 'charts':

      LIV.renderResourceCharts();

      break;


    case 'analytics':

      LIV.renderResourceAnalytics();

      break;


    case 'planfact':

      LIV.renderResourcePlanFact();

      break;


    case 'journal':

    default:

      LIV.renderResourceJournal();

      break;
  }
};


/* =========================================================
   СОБЫТИЯ МОДУЛЯ РЕСУРСОВ
   ========================================================= */

LIV.bindResourceEvents = function () {

  document
    .querySelectorAll(
      '.resource-tab'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            LIV.switchResourceView(
              button.dataset
                .resourceView
            );
          };
      }
    );


  [
    'resourceFrom',
    'resourceTo'
  ]
    .forEach(
      id => {

        LIV.$(
          id
        )
          ?.addEventListener(
            'change',
            LIV.renderResources
          );
      }
    );


  LIV.$(
    'resourceDailyDate'
  )
    ?.addEventListener(
      'change',
      LIV.renderResourceDaily
    );


  LIV.$(
    'resourceAverageMethod'
  )
    ?.addEventListener(
      'change',
      LIV.renderResourceAnalytics
    );


  LIV.$(
    'resourceMissingRule'
  )
    ?.addEventListener(
      'change',
      LIV.renderResourceAnalytics
    );


  LIV.$(
    'resourcePlanStep'
  )
    ?.addEventListener(
      'change',
      LIV.renderResourcePlanFact
    );


  LIV.$(
    'newResourceBtn'
  )
    ?.addEventListener(
      'click',
      () =>
        LIV.openResourceEditor()
    );


  LIV.$(
    'newResourcePlanBtn'
  )
    ?.addEventListener(
      'click',
      () =>
        LIV.openResourcePlanEditor()
    );


  LIV.$(
    'saveResourceViewBtn'
  )
    ?.addEventListener(
      'click',
      LIV.saveCurrentResourceView
    );
};