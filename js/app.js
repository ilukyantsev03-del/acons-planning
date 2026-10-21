'use strict';

/* =========================================================
   LIV PLANNING
   APP
   Точка запуска + ключевые даты + номерные элементы +
   демонтаж + история + настройки + конструктор + экспорт
   ========================================================= */

const LIV_CONFIG = window.ACONS_CONFIG || {};


function cfg(
  key,
  fallback
) {

  return (
    LIV_CONFIG[key] !==
      undefined
      ? LIV_CONFIG[key]
      : fallback
  );
}


function bindChange(
  id,
  handler
) {

  const element =
    $(
      id
    );


  if (
    element
  ) {

    element.onchange =
      handler;
  }
}


function bindClick(
  id,
  handler
) {

  const element =
    $(
      id
    );


  if (
    element
  ) {

    element.onclick =
      handler;
  }
}


/* =========================================================
   КАЛЕНДАРИ И РАСЧЕТ СРОКОВ
   ========================================================= */


function calendarById(
  id
) {

  const calendars =
    Object.values(
      cfg(
        'CALENDARS',
        {}
      )
    );


  return (
    calendars.find(
      item =>
        item.id ===
        id
    ) ||

    calendars.find(
      item =>
        item.id ===
        cfg(
          'DEFAULT_CALENDAR',
          '5x2'
        )
    ) ||

    {
      id:
        '5x2',

      name:
        '5/2',

      workdays: [
        1,
        2,
        3,
        4,
        5
      ],

      weekends: [
        0,
        6
      ]
    }
  );
}


function projectDateSet(
  key
) {

  return new Set(
    (
      cfg(
        key,
        []
      ) ||
      []
    )
      .map(
        value =>
          String(
            value
          )
            .slice(
              0,
              10
            )
      )
  );
}


function isProjectWorkingDay(
  dateString,
  calendarId =
    cfg(
      'DEFAULT_CALENDAR',
      '5x2'
    )
) {

  if (
    !dateString
  ) {
    return false;
  }


  const forcedWorkdays =
    projectDateSet(
      'WORKDAY_OVERRIDES'
    );


  const holidays =
    projectDateSet(
      'HOLIDAYS'
    );


  if (
    forcedWorkdays.has(
      dateString
    )
  ) {

    return true;
  }


  if (
    holidays.has(
      dateString
    )
  ) {

    return false;
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

    return false;
  }


  return calendarById(
    calendarId
  )
    .workdays
    .includes(
      date.getDay()
    );
}


function isoLocalDate(
  date
) {

  return (
    `${date.getFullYear()}-` +

    `${String(
      date.getMonth() +
      1
    )
      .padStart(
        2,
        '0'
      )}-` +

    `${String(
      date.getDate()
    )
      .padStart(
        2,
        '0'
      )}`
  );
}


function addProjectWorkingDays(
  start,
  count,
  calendarId =
    cfg(
      'DEFAULT_CALENDAR',
      '5x2'
    )
) {

  if (
    !start
  ) {

    return '';
  }


  let remaining =
    Math.max(
      0,
      Math.round(
        num(
          count
        )
      )
    );


  const current =
    new Date(
      `${start}T12:00:00`
    );


  if (
    Number.isNaN(
      current.getTime()
    )
  ) {

    return '';
  }


  if (
    remaining ===
    0
  ) {

    return isoLocalDate(
      current
    );
  }


  let guard =
    0;


  while (
    remaining >
      0 &&
    guard <
      5000
  ) {

    current.setDate(
      current.getDate() +
      1
    );


    const value =
      isoLocalDate(
        current
      );


    if (
      isProjectWorkingDay(
        value,
        calendarId
      )
    ) {

      remaining--;
    }


    guard++;
  }


  return isoLocalDate(
    current
  );
}


function workingDaysBetween(
  from,
  to,
  calendarId =
    cfg(
      'DEFAULT_CALENDAR',
      '5x2'
    )
) {

  if (
    !from ||
    !to ||
    from >
      to
  ) {

    return 0;
  }


  return dateRange(
    from,
    to
  )
    .filter(
      date =>
        isProjectWorkingDay(
          date,
          calendarId
        )
    )
    .length;
}


function calculateDurationDays(
  data =
    {}
) {

  const method =
    data.durationMethod ||
    'manual';


  if (
    method ===
    'duration'
  ) {

    return Math.max(
      0,
      Math.round(
        num(
          data.durationDays
        )
      )
    );
  }


  if (
    method ===
    'productivity'
  ) {

    const volume =
      num(
        data.volume
      );


    const productivity =
      num(
        data.productivity
      );


    return (
      productivity >
        0
        ? Math.ceil(
            volume /
            productivity
          )
        : 0
    );
  }


  if (
    method ===
    'productivity_resources'
  ) {

    const volume =
      num(
        data.volume
      );


    const productivity =
      num(
        data.productivity
      );


    const people =
      Math.max(
        0,
        num(
          data.people
        )
      );


    return (
      productivity >
        0 &&
      people >
        0
        ? Math.ceil(
            volume /
            (
              productivity *
              people
            )
          )
        : 0
    );
  }


  if (
    data.planStart &&
    data.planEnd
  ) {

    return workingDaysBetween(
      data.planStart,
      data.planEnd,
      data.calendarId
    );
  }


  return 0;
}


function applyReserveDays(
  duration,
  reserveType,
  reserveValue
) {

  const base =
    Math.max(
      0,
      Math.round(
        num(
          duration
        )
      )
    );


  const reserve =
    Math.max(
      0,
      num(
        reserveValue
      )
    );


  if (
    reserveType ===
    'days'
  ) {

    return (
      base +
      Math.round(
        reserve
      )
    );
  }


  if (
    reserveType ===
    'percent'
  ) {

    return Math.ceil(
      base *
      (
        1 +
        reserve /
        100
      )
    );
  }


  return base;
}


function calculateForecastEnd(
  data =
    {}
) {

  const start =
    data.factStart ||
    data.planStart ||
    '';


  if (
    !start
  ) {

    return (
      data.forecastEnd ||
      ''
    );
  }


  if (
    (
      data.durationMethod ||
      'manual'
    ) ===
    'manual'
  ) {

    return (
      data.forecastEnd ||
      data.planEnd ||
      ''
    );
  }


  const duration =
    calculateDurationDays(
      data
    );


  const withReserve =
    applyReserveDays(
      duration,
      data.reserveType,
      data.reserveValue
    );


  return addProjectWorkingDays(
    start,
    withReserve,
    data.calendarId
  );
}


function dateDeviationDays(
  target,
  actualOrForecast
) {

  if (
    !target ||
    !actualOrForecast
  ) {

    return null;
  }


  return diffDays(
    target,
    actualOrForecast
  );
}


/* =========================================================
   КЛЮЧЕВЫЕ ДАТЫ
   ========================================================= */


function milestoneStatuses() {

  return cfg(
    'MILESTONE_STATUSES',

    [
      'Не наступила',
      'В работе',
      'Под риском',
      'Просрочена',
      'Выполнена',
      'Выполнена с просрочкой',
      'Перенесена',
      'Отменена'
    ]
  );
}


function correspondenceTypes() {

  return cfg(
    'CORRESPONDENCE_TYPES',

    [
      'Исходящее письмо',
      'Входящее письмо',
      'Ответ подрядчика',
      'Уведомление о нарушении',
      'План компенсирующих мероприятий',
      'Согласование',
      'Замечания',
      'Протокол',
      'Иное'
    ]
  );
}


function milestoneTargetDate(
  item
) {

  return (
    item.contractDate ||
    item.workDate ||
    ''
  );
}


function milestoneCurrentDate(
  item
) {

  return (
    item.factDate ||
    item.forecastDate ||
    item.workDate ||
    ''
  );
}


function milestoneDeviation(
  item
) {

  if (
    item.importedDeviation !==
      null &&
    item.importedDeviation !==
      undefined &&
    item.importedDeviation !==
      ''
  ) {
    return num(
      item.importedDeviation
    );
  }

  const calculated =
    dateDeviationDays(
      milestoneTargetDate(
        item
      ),

      milestoneCurrentDate(
        item
      )
    );


  return calculated ===
    null
    ? null
    : -calculated;
}


function milestoneOrganizationName(
  item
) {

  return (
    nameById(
      project.organizations,
      item.organizationId
    ) ||
    ''
  );
}


function milestoneContractLabel(
  item
) {

  const contract =
    byId(
      project.contracts,
      item.contractId
    );


  return (
    contract?.number ||
    contract?.name ||
    item.contractNo ||
    ''
  );
}


function milestoneLetters(
  item
) {

  return (
    Array.isArray(
      item.correspondence
    )
      ? item.correspondence
      : []
  );
}


function renderMilestones() {

  const body =
    $('milestoneRows');


  if (
    !body
  ) {
    return;
  }


  const rows =
    [
      ...(
        project.milestones ||
        []
      )
    ]
      .sort(
        (
          a,
          b
        ) =>
          String(
            milestoneTargetDate(
              a
            )
          )
            .localeCompare(
              String(
                milestoneTargetDate(
                  b
                )
              )
            )
      );


  body.innerHTML =
    rows
      .map(
        item => {

          const deviation =
            milestoneDeviation(
              item
            );


          const org =
            milestoneOrganizationName(
              item
            );


          const contract =
            milestoneContractLabel(
              item
            );


          const letters =
            milestoneLetters(
              item
            );


          const lastLetter =
            [
              ...letters
            ]
              .sort(
                (
                  a,
                  b
                ) =>
                  String(
                    a.date ||
                    ''
                  )
                    .localeCompare(
                      String(
                        b.date ||
                        ''
                      )
                    )
              )
              .slice(
                -1
              )[0];


          return `
            <tr>

              <td>
                ${esc(
                  nameById(
                    project.buildings,
                    item.buildingId
                  ) ||
                  '—'
                )}
              </td>


              <td>

                <button
                  class="row-btn"
                  data-ms="${esc(
                    item.id
                  )}">

                  <b>
                    ${esc(
                      item.milestoneNo
                        ? `${item.milestoneNo} · ${item.title || ''}`
                        : (
                            item.title ||
                            'Ключевая дата'
                          )
                    )}
                  </b>

                </button>


                ${
                  item.blockCapture ||
                  item.floorCapture ||
                  item.startDate ||
                  item.durationDays
                    ? `
                        <div class="tiny">
                          ${esc(
                            [
                              item.blockCapture
                                ? `Блок/захватка: ${item.blockCapture}`
                                : '',
                              item.floorCapture
                                ? `Этаж/№: ${item.floorCapture}`
                                : '',
                              item.startDate
                                ? `Начало: ${ruDate(item.startDate)}`
                                : '',
                              item.durationDays
                                ? `Длит.: ${item.durationDays} дн.`
                                : ''
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          )}
                        </div>
                      `
                    : ''
                }


                ${
                  org
                    ? `
                        <div class="tiny">
                          ${esc(org)}
                        </div>
                      `
                    : ''
                }


                ${
                  contract
                    ? `
                        <div class="tiny">
                          Договор:
                          ${esc(contract)}
                        </div>
                      `
                    : ''
                }


                ${
                  lastLetter
                    ? `
                        <div class="tiny">

                          Последнее письмо:

                          ${esc(
                            lastLetter.number ||
                            'без №'
                          )}

                          от

                          ${esc(
                            ruDate(
                              lastLetter.date
                            ) ||
                            '—'
                          )}

                        </div>
                      `
                    : ''
                }

              </td>


              <td>
                ${
                  item.contractDate
                    ? ruDate(
                        item.contractDate
                      )
                    : '—'
                }
              </td>


              <td>
                ${
                  item.workDate
                    ? ruDate(
                        item.workDate
                      )
                    : '—'
                }
              </td>


              <td>
                ${
                  item.forecastDate
                    ? ruDate(
                        item.forecastDate
                      )
                    : '—'
                }
              </td>


              <td>
                ${
                  item.factDate
                    ? ruDate(
                        item.factDate
                      )
                    : '—'
                }
              </td>


              <td>

                <span
                  class="badge ${
                    deviation !==
                      null &&
                    deviation <
                      0
                      ? 's-risk'
                      : ''
                  }">

                  ${esc(
                    item.status ||
                    ''
                  )}

                </span>


                ${
                  deviation !==
                    null
                    ? `
                        <div class="tiny">

                          Отклонение:

                          ${
                            deviation >
                              0
                              ? '+'
                              : ''
                          }

                          ${deviation}
                          дн.

                        </div>
                      `
                    : ''
                }


                ${
                  letters.length
                    ? `
                        <div class="tiny">
                          Писем:
                          ${letters.length}
                        </div>
                      `
                    : ''
                }

              </td>

            </tr>
          `;
        }
      )
      .join('') ||

    `
      <tr>

        <td colspan="7">

          <div class="empty-state">
            Ключевые даты пока не добавлены.
          </div>

        </td>

      </tr>
    `;


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


function milestoneContractOptions(
  selectedId =
    ''
) {

  return `
    <option value="">
      —
    </option>

    ${
      (
        project.contracts ||
        []
      )
        .map(
          item => `
            <option
              value="${esc(
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
              }>

              ${esc(
                item.number ||
                item.name ||
                item.id
              )}

            </option>
          `
        )
        .join('')
    }
  `;
}


function milestoneFrontOptions(
  selectedId =
    ''
) {

  return `
    <option value="">
      —
    </option>

    ${
      activeFronts()
        .map(
          front => `
            <option
              value="${esc(
                front.id
              )}"
              ${
                String(
                  front.id
                ) ===
                String(
                  selectedId
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
        .join('')
    }
  `;
}


function correspondenceEditorRows(
  items =
    []
) {

  return (
    items ||
    []
  )
    .map(
      (
        item,
        index
      ) => `
        <div
          class="compare-record"
          data-letter-row="${index}">

          <div class="form-grid">

            <div class="field">

              <label>
                Тип
              </label>

              <select data-letter-type>

                ${
                  correspondenceTypes()
                    .map(
                      type => `
                        <option
                          ${
                            type ===
                            item.type
                              ? 'selected'
                              : ''
                          }>
                          ${esc(type)}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>

            </div>


            <div class="field">

              <label>
                Дата
              </label>

              <input
                data-letter-date
                type="date"
                value="${esc(
                  item.date ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label>
                Номер письма
              </label>

              <input
                data-letter-number
                value="${esc(
                  item.number ||
                  ''
                )}"
                placeholder="ПП.СРК.1213/26"
              >

            </div>


            <div class="field">

              <label>
                Тема / краткое содержание
              </label>

              <input
                data-letter-title
                value="${esc(
                  item.title ||
                  ''
                )}"
              >

            </div>


            <div class="field">

              <label>
                Ссылка на PDF / файл
              </label>

              <input
                data-letter-url
                value="${esc(
                  item.url ||
                  ''
                )}"
                placeholder="https://..."
              >

            </div>


            <div class="field align-end">

              <button
                type="button"
                class="btn danger"
                data-letter-remove>
                Удалить письмо
              </button>

            </div>

          </div>

        </div>
      `
    )
    .join('');
}


function openMilestoneEditor(
  id =
    null
) {

  const milestone =
    id
      ? (
          byId(
            project.milestones,
            id
          ) ||
          {}
        )
      : {};


  const letters =
    clone(
      milestoneLetters(
        milestone
      )
    );


  openModal(
    id
      ? 'Ключевая дата'
      : 'Новая ключевая дата',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Подрядчик
          </label>

          <select id="mOrg">

            ${
              selectOptions(
                project.organizations,
                milestone.organizationId,
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Договор из справочника
          </label>

          <select id="mContractId">

            ${
              milestoneContractOptions(
                milestone.contractId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            № договора вручную
          </label>

          <input
            id="mContractNo"
            value="${esc(
              milestone.contractNo ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            № ключевой даты
          </label>

          <input
            id="mNo"
            value="${esc(
              milestone.milestoneNo ||
              ''
            )}"
            placeholder="КД №1"
          >

        </div>


        <div class="field">

          <label>
            Здание
          </label>

          <select id="mBuilding">

            ${
              selectOptions(
                project.buildings,
                milestone.buildingId,
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Вид работ
          </label>

          <select id="mWorkId">

            ${
              selectOptions(
                project.works,
                milestone.workId,
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Связанный фронт
          </label>

          <select id="mFrontId">

            ${
              milestoneFrontOptions(
                milestone.frontId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Статус
          </label>

          <select id="mStatus">

            ${
              milestoneStatuses()
                .map(
                  status => `
                    <option
                      ${
                        status ===
                        (
                          milestone.status ||
                          'Не наступила'
                        )
                          ? 'selected'
                          : ''
                      }>
                      ${esc(status)}
                    </option>
                  `
                )
                .join('')
            }

          </select>

        </div>


        <div class="field">

          <label>
            Ответственный
          </label>

          <input
            id="mResponsible"
            value="${esc(
              milestone.responsible ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Блок / захватка
          </label>

          <input
            id="mBlockCapture"
            value="${esc(
              milestone.blockCapture ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Этаж / номер захватки
          </label>

          <input
            id="mFloorCapture"
            value="${esc(
              milestone.floorCapture ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Дата начала
          </label>

          <input
            id="mStart"
            type="date"
            value="${esc(
              milestone.startDate ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Длительность, дн.
          </label>

          <input
            id="mDuration"
            type="number"
            min="0"
            step="1"
            value="${
              milestone.durationDays ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Отклонение, дн.
          </label>

          <input
            id="mDeviation"
            type="number"
            step="1"
            value="${
              milestone.importedDeviation ??
              ''
            }"
            placeholder="Пусто — рассчитать автоматически"
          >

        </div>


        <div class="field">

          <label>
            Договорная дата
          </label>

          <input
            id="mContract"
            type="date"
            value="${esc(
              milestone.contractDate ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Рабочая дата
          </label>

          <input
            id="mWork"
            type="date"
            value="${esc(
              milestone.workDate ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Прогноз
          </label>

          <input
            id="mForecast"
            type="date"
            value="${esc(
              milestone.forecastDate ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Факт
          </label>

          <input
            id="mFact"
            type="date"
            value="${esc(
              milestone.factDate ||
              ''
            )}"
          >

        </div>

      </div>


      <div class="field">

        <label>
          Формулировка ключевой даты
        </label>

        <textarea id="mTitle">${esc(
          milestone.title ||
          ''
        )}</textarea>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="mComment">${esc(
          milestone.comment ||
          ''
        )}</textarea>

      </div>


      <div
        class="card"
        style="margin-top:14px">

        <div class="section-toolbar">

          <div>

            <h2>
              Переписка
            </h2>

            <div class="muted">

              Номер, дата, тип и ссылка на PDF/файл.

              Сам файл добавим после перехода
              на файловое хранилище.

            </div>

          </div>


          <button
            id="mAddLetter"
            type="button"
            class="btn">

            + Добавить письмо

          </button>

        </div>


        <div id="mLetters"></div>

      </div>


      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="mDelete"
                  class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }


        <button
          id="mSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );


  function renderLetters() {

    $('mLetters')
      .innerHTML =
        correspondenceEditorRows(
          letters
        ) ||

        `
          <div class="muted">
            Переписка пока не добавлена.
          </div>
        `;


    $('mLetters')
      .querySelectorAll(
        '[data-letter-remove]'
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const row =
                button.closest(
                  '[data-letter-row]'
                );


              const index =
                Number(
                  row?.dataset
                    .letterRow
                );


              if (
                Number.isInteger(
                  index
                )
              ) {

                letters.splice(
                  index,
                  1
                );


                renderLetters();
              }
            };
        }
      );
  }


  function collectLetters() {

    return [
      ...$('mLetters')
        .querySelectorAll(
          '[data-letter-row]'
        )
    ]
      .map(
        row => {

          const index =
            Number(
              row.dataset
                .letterRow
            );


          return {

            id:
              letters[
                index
              ]?.id ||
              uid(
                'COR'
              ),

            type:
              row.querySelector(
                '[data-letter-type]'
              )?.value ||
              'Иное',

            date:
              row.querySelector(
                '[data-letter-date]'
              )?.value ||
              '',

            number:
              row.querySelector(
                '[data-letter-number]'
              )?.value
                .trim() ||
              '',

            title:
              row.querySelector(
                '[data-letter-title]'
              )?.value
                .trim() ||
              '',

            url:
              row.querySelector(
                '[data-letter-url]'
              )?.value
                .trim() ||
              ''
          };
        }
      )
      .filter(
        item =>
          item.date ||
          item.number ||
          item.title ||
          item.url
      );
  }


  renderLetters();


  $('mAddLetter').onclick =
    () => {

      letters.push({

        id:
          uid(
            'COR'
          ),

        type:
          'Исходящее письмо',

        date:
          today(),

        number:
          '',

        title:
          '',

        url:
          ''
      });


      renderLetters();
    };


  $('mSave').onclick =
    () =>
      saveMilestone(
        id,
        collectLetters()
      );


  if (
    id &&
    $('mDelete')
  ) {

    $('mDelete').onclick =
      () =>
        deleteMilestone(
          id
        );
  }
}


async function saveMilestone(
  id,
  correspondence =
    []
) {

  let milestone =
    id
      ? byId(
          project.milestones,
          id
        )
      : null;


  if (
    !milestone
  ) {

    milestone = {

      id:
        uid(
          'M'
        ),

      createdAt:
        nowIso()
    };
  }


  const title =
    $('mTitle')
      .value
      .trim();


  if (
    !title
  ) {

    alert(
      'Укажи формулировку ключевой даты.'
    );

    return;
  }


  Object.assign(
    milestone,
    {

      organizationId:
        $('mOrg').value,

      contractId:
        $('mContractId').value,

      contractNo:
        $('mContractNo')
          .value
          .trim(),

      milestoneNo:
        $('mNo')
          .value
          .trim(),

      buildingId:
        $('mBuilding').value,

      workId:
        $('mWorkId').value,

      frontId:
        $('mFrontId').value,

      responsible:
        $('mResponsible')
          .value
          .trim(),

      blockCapture:
        $('mBlockCapture')
          .value
          .trim(),

      floorCapture:
        $('mFloorCapture')
          .value
          .trim(),

      startDate:
        $('mStart').value,

      durationDays:
        Math.max(
          0,
          roundInt(
            $('mDuration').value
          )
        ),

      importedDeviation:
        $('mDeviation').value ===
          ''
          ? null
          : num(
              $('mDeviation').value
            ),
      title,

      status:
        $('mStatus').value,

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

      correspondence,

      updatedAt:
        nowIso()
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


  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Ключевая дата',

    `${
      milestone.milestoneNo
        ? `${milestone.milestoneNo} · `
        : ''
    }${milestone.title}`
  );


  await saveProject();


  closeModal();


  renderAll();
}


async function deleteMilestone(
  id
) {

  const item =
    byId(
      project.milestones,
      id
    );


  if (
    !item
  ) {
    return;
  }


  if (
    !confirm(
      'Удалить ключевую дату? Перед удалением будет создана защитная копия.'
    )
  ) {

    return;
  }


  await dbPutKey(
    clone(
      project
    ),

    `pre-milestone-delete-${Date.now()}`
  );


  project.milestones =
    project.milestones
      .filter(
        row =>
          String(
            row.id
          ) !==
          String(
            id
          )
      );


  log(
    'Удалено',
    'Ключевая дата',
    item.title ||
    item.id
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
      element.groupCode
    ),
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


  return (
    project.numberedElements ||
    []
  )
    .find(
      element =>

        element.active !==
          false &&

        String(
          element.id
        ) !==
        String(
          excludeId
        ) &&

        elementContextKey(
          element
        ) ===
        key
    );
}


function renderElements() {

  const body =
    $('elementRows');


  if (
    !body
  ) {
    return;
  }


  const buildingId =
    $('elBuilding')?.value ||
    'all';


  const type =
    $('elType')?.value ||
    'all';


  const search =
    normKey(
      $('elSearch')?.value ||
      ''
    );


  const rows =
    (
      project.numberedElements ||
      []
    )
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


  body.innerHTML =
    rows
      .map(
        element => `
          <tr>

            <td>
              ${esc(
                element.elementType ||
                ''
              )}
            </td>

            <td>
              <b>
                ${esc(
                  element.elementNo ||
                  ''
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
                element.groupCode ||
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
                data-el="${esc(
                  element.id
                )}">
                Открыть
              </button>

            </td>

          </tr>
        `
      )
      .join('') ||

    `
      <tr>

        <td colspan="10">

          <div class="empty-state">
            Номерные элементы не найдены.
          </div>

        </td>

      </tr>
    `;


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
      ? (
          byId(
            project.numberedElements,
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
            value="${esc(
              front.id
            )}"
            ${
              String(
                front.id
              ) ===
              String(
                element.frontId ||
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
      ? 'Номерной элемент'
      : 'Новый номерной элемент',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Тип элемента
          </label>

          <input
            id="neType"
            value="${esc(
              element.elementType ||
              ''
            )}"
            placeholder="Свая / Анкер / Шпунт"
          >

        </div>


        <div class="field">

          <label>
            Номер
          </label>

          <input
            id="neNo"
            value="${esc(
              element.elementNo ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Область уникальности
          </label>

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

          <label>
            Здание
          </label>

          <select id="neBuilding">

            ${
              selectOptions(
                project.buildings,
                element.buildingId,
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Группа / ярус / марка
          </label>

          <input
            id="neGroup"
            value="${esc(
              element.groupCode ||
              ''
            )}"
            placeholder="Например: Г1 / БНС-2 / Ярус 1"
          >

        </div>


        <div class="field">

          <label>
            Захватка
          </label>

          <input
            id="neCapture"
            value="${esc(
              element.capture ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Зона / ряд
          </label>

          <input
            id="neZone"
            value="${esc(
              element.zone ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Вид работ
          </label>

          <select id="neWork">

            ${
              selectOptions(
                project.works,
                element.workId,
                true
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Статус
          </label>

          <select id="neStatus">

            ${
              ELEMENT_STATUS_LIST
                .map(
                  status => `
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

                      ${esc(status)}

                    </option>
                  `
                )
                .join('')
            }

          </select>

        </div>


        <div class="field">

          <label>
            Фронт
          </label>

          <select id="neFront">

            <option value="">
              —
            </option>

            ${frontOptions}

          </select>

        </div>

      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="neComment">${esc(
          element.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="neArchive"
                  class="btn danger">

                  Архивировать

                </button>
              `
            : ''
        }


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


  if (
    id &&
    $('neArchive')
  ) {

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

    groupCode:
      $('neGroup')
        .value
        .trim(),

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


  if (
    duplicate
  ) {

    alert(
      `Такой номер уже существует.\n` +
      `${duplicate.elementType} №${duplicate.elementNo}`
    );

    return;
  }


  if (
    id
  ) {

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

    project.numberedElements
      .push({

        ...candidate,

        createdAt:
          nowIso(),

        updatedAt:
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


  initSelects();


  renderAll();
  return true;
}


async function archiveElement(
  id
) {

  const element =
    byId(
      project.numberedElements,
      id
    );


  if (
    !element ||
    !confirm(
      'Архивировать номерной элемент?'
    )
  ) {

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


  initSelects();


  renderAll();
}


/* =========================================================
   ДЕМОНТАЖ
   ========================================================= */


function demolitionForecast(
  item
) {

  const calculated =
    calculateForecastEnd({

      planStart:
        item.planStart,

      factStart:
        item.factStart,

      planEnd:
        item.planEnd,

      forecastEnd:
        item.forecastEnd,

      durationMethod:
        item.durationMethod ||
        'manual',

      durationDays:
        item.durationDays,

      volume:
        item.volume,

      productivity:
        item.productivity,

      people:
        item.people,

      reserveType:
        item.reserveType ||
        'none',

      reserveValue:
        item.reserveValue,

      calendarId:
        item.calendarId ||
        cfg(
          'DEFAULT_CALENDAR',
          '5x2'
        )
    });


  return (
    calculated ||
    item.forecastEnd ||
    ''
  );
}


function renderDemolition() {

  const body =
    $('demolitionRows');


  if (
    !body
  ) {
    return;
  }


  body.innerHTML =
    (
      project.demolition ||
      []
    )
      .filter(
        item =>
          item.active !==
          false
      )
      .map(
        item => {

          const forecast =
            demolitionForecast(
              item
            );


          const current =
            item.factEnd ||
            forecast;


          const deviation =
            dateDeviationDays(
              item.planEnd,
              current
            );


          return `
            <tr>

              <td>

                <button
                  class="row-btn"
                  data-dem-open="${esc(
                    item.id
                  )}">

                  ${esc(
                    item.name ||
                    ''
                  )}

                </button>


                ${
                  deviation !==
                    null
                    ? `
                        <div
                          class="tiny ${
                            deviation >
                              0
                              ? 'danger-text'
                              : ''
                          }">

                          Отклонение:

                          ${
                            deviation >
                              0
                              ? '+'
                              : ''
                          }

                          ${deviation}
                          дн.

                        </div>
                      `
                    : ''
                }

              </td>


              <td>

                <span class="badge">
                  ${esc(
                    item.status ||
                    'Не начато'
                  )}
                </span>

              </td>


              <td>

                ${
                  item.planEnd
                    ? ruDate(
                        item.planEnd
                      )
                    : '—'
                }

              </td>


              <td>

                ${
                  forecast
                    ? ruDate(
                        forecast
                      )
                    : '—'
                }

              </td>


              <td>

                ${
                  item.factEnd
                    ? ruDate(
                        item.factEnd
                      )
                    : '—'
                }

              </td>


              <td>
                ${esc(
                  item.comment ||
                  ''
                )}
              </td>

            </tr>
          `;
        }
      )
      .join('') ||

    `
      <tr>

        <td colspan="6">

          <div class="empty-state">
            Нет объектов демонтажа.
          </div>

        </td>

      </tr>
    `;


  document
    .querySelectorAll(
      '[data-dem-open]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openDemolitionEditor(
              button.dataset
                .demOpen
            );
      }
    );
}


function durationMethodOptions(
  selected =
    'manual'
) {

  return (
    cfg(
      'DURATION_METHODS',
      []
    ) ||
    []
  )
    .map(
      item => `
        <option
          value="${esc(
            item.id
          )}"
          ${
            item.id ===
            selected
              ? 'selected'
              : ''
          }>

          ${esc(
            item.name
          )}

        </option>
      `
    )
    .join('');
}


function reserveTypeOptions(
  selected =
    'none'
) {

  return (
    cfg(
      'RESERVE_TYPES',
      []
    ) ||
    []
  )
    .map(
      item => `
        <option
          value="${esc(
            item.id
          )}"
          ${
            item.id ===
            selected
              ? 'selected'
              : ''
          }>

          ${esc(
            item.name
          )}

        </option>
      `
    )
    .join('');
}


function calendarOptions(
  selected =
    cfg(
      'DEFAULT_CALENDAR',
      '5x2'
    )
) {

  return Object.values(
    cfg(
      'CALENDARS',
      {}
    )
  )
    .map(
      item => `
        <option
          value="${esc(
            item.id
          )}"
          ${
            item.id ===
            selected
              ? 'selected'
              : ''
          }>

          ${esc(
            item.name
          )}

        </option>
      `
    )
    .join('');
}


function openDemolitionEditor(
  id
) {

  const item =
    byId(
      project.demolition,
      id
    );


  if (
    !item
  ) {
    return;
  }


  openModal(
    'Демонтаж',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Объект
          </label>

          <input
            id="demName"
            value="${esc(
              item.name ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Статус
          </label>

          <select id="demStatus">

            ${
              STATUS_LIST
                .map(
                  status => `
                    <option
                      ${
                        status ===
                        (
                          item.status ||
                          'Не начато'
                        )
                          ? 'selected'
                          : ''
                      }>

                      ${esc(status)}

                    </option>
                  `
                )
                .join('')
            }

          </select>

        </div>


        <div class="field">

          <label>
            Календарь
          </label>

          <select id="demCalendar">

            ${
              calendarOptions(
                item.calendarId
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            План начало
          </label>

          <input
            id="demPlanStart"
            type="date"
            value="${esc(
              item.planStart ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            План окончание
          </label>

          <input
            id="demPlanEnd"
            type="date"
            value="${esc(
              item.planEnd ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Метод длительности
          </label>

          <select id="demDurationMethod">

            ${
              durationMethodOptions(
                item.durationMethod ||
                'manual'
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Длительность, рабочих дней
          </label>

          <input
            id="demDuration"
            type="number"
            min="0"
            step="1"
            value="${
              item.durationDays ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Объём
          </label>

          <input
            id="demVolume"
            type="number"
            step="any"
            value="${
              item.volume ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Выработка
          </label>

          <input
            id="demProductivity"
            type="number"
            step="any"
            value="${
              item.productivity ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Люди / ресурс
          </label>

          <input
            id="demPeople"
            type="number"
            min="0"
            step="1"
            value="${
              item.people ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Тип резерва
          </label>

          <select id="demReserveType">

            ${
              reserveTypeOptions(
                item.reserveType ||
                'none'
              )
            }

          </select>

        </div>


        <div class="field">

          <label>
            Резерв
          </label>

          <input
            id="demReserve"
            type="number"
            min="0"
            step="any"
            value="${
              item.reserveValue ??
              ''
            }"
          >

        </div>


        <div class="field">

          <label>
            Факт начало
          </label>

          <input
            id="demFactStart"
            type="date"
            value="${esc(
              item.factStart ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Факт окончание
          </label>

          <input
            id="demFactEnd"
            type="date"
            value="${esc(
              item.factEnd ||
              ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Прогноз окончание
          </label>

          <input
            id="demForecast"
            type="date"
            value="${esc(
              item.forecastEnd ||
              ''
            )}"
          >

        </div>

      </div>


      <div
        class="notice"
        id="demCalcInfo">
      </div>


      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="demComment">${esc(
          item.comment ||
          ''
        )}</textarea>

      </div>


      <div class="editor-actions">

        <button
          id="demArchive"
          class="btn danger">

          Архивировать

        </button>


        <button
          id="demSave"
          class="btn primary">

          Сохранить

        </button>

      </div>
    `
  );


  const recalc =
    () => {

      const data = {

        planStart:
          $('demPlanStart').value,

        factStart:
          $('demFactStart').value,

        planEnd:
          $('demPlanEnd').value,

        forecastEnd:
          $('demForecast').value,

        durationMethod:
          $('demDurationMethod').value,

        durationDays:
          $('demDuration').value,

        volume:
          $('demVolume').value,

        productivity:
          $('demProductivity').value,

        people:
          $('demPeople').value,

        reserveType:
          $('demReserveType').value,

        reserveValue:
          $('demReserve').value,

        calendarId:
          $('demCalendar').value
      };


      const duration =
        calculateDurationDays(
          data
        );


      const total =
        applyReserveDays(
          duration,
          data.reserveType,
          data.reserveValue
        );


      const forecast =
        calculateForecastEnd(
          data
        );


      $('demCalcInfo')
        .textContent =
          data.durationMethod ===
          'manual'
            ? 'Ручной режим: прогноз указывается вручную.'
            : (
                `Расчётная длительность: ${duration} р.д.` +
                ` · с резервом: ${total} р.д.` +
                ` · прогноз: ${
                  forecast
                    ? ruDate(
                        forecast
                      )
                    : '—'
                }`
              );


      if (
        data.durationMethod !==
          'manual' &&
        forecast
      ) {

        $('demForecast').value =
          forecast;
      }
    };


  [
    'demPlanStart',
    'demFactStart',
    'demPlanEnd',
    'demDurationMethod',
    'demDuration',
    'demVolume',
    'demProductivity',
    'demPeople',
    'demReserveType',
    'demReserve',
    'demCalendar'
  ]
    .forEach(
      field =>
        bindChange(
          field,
          recalc
        )
    );


  recalc();


  $('demSave').onclick =
    () =>
      saveDemolitionEditor(
        id
      );


  $('demArchive').onclick =
    () =>
      archiveDemolition(
        id
      );
}


async function saveDemolitionEditor(
  id
) {

  const item =
    byId(
      project.demolition,
      id
    );


  if (
    !item
  ) {
    return;
  }


  const data = {

    name:
      $('demName')
        .value
        .trim(),

    status:
      $('demStatus').value,

    calendarId:
      $('demCalendar').value,

    planStart:
      $('demPlanStart').value,

    planEnd:
      $('demPlanEnd').value,

    durationMethod:
      $('demDurationMethod').value,

    durationDays:
      roundInt(
        $('demDuration').value
      ),

    volume:
      num(
        $('demVolume').value
      ),

    productivity:
      num(
        $('demProductivity').value
      ),

    people:
      roundInt(
        $('demPeople').value
      ),

    reserveType:
      $('demReserveType').value,

    reserveValue:
      num(
        $('demReserve').value
      ),

    factStart:
      $('demFactStart').value,

    factEnd:
      $('demFactEnd').value,

    forecastEnd:
      $('demForecast').value,

    comment:
      $('demComment')
        .value
        .trim(),

    updatedAt:
      nowIso()
  };


  if (
    !data.name
  ) {

    alert(
      'Укажи объект.'
    );

    return;
  }


  if (
    data.durationMethod !==
    'manual'
  ) {

    data.forecastEnd =
      calculateForecastEnd(
        data
      );
  }


  Object.assign(
    item,
    data
  );


  log(
    'Изменено',
    'Демонтаж',
    item.name
  );


  await saveProject();


  closeModal();


  renderAll();
}


async function archiveDemolition(
  id
) {

  const item =
    byId(
      project.demolition,
      id
    );


  if (
    !item ||
    !confirm(
      'Архивировать объект демонтажа?'
    )
  ) {

    return;
  }


  item.active =
    false;


  item.archivedAt =
    nowIso();


  log(
    'Архивировано',
    'Демонтаж',
    item.name
  );


  await saveProject();


  closeModal();


  renderAll();
}


/* =========================================================
   ИСТОРИЯ
   ========================================================= */


function renderHistory() {

  const body =
    $('historyRows');


  if (
    !body
  ) {
    return;
  }


  body.innerHTML =
    (
      project.history ||
      []
    )
      .slice(
        0,
        1000
      )
      .map(
        item => `
          <tr>

            <td class="nowrap">

              ${
                item.at
                  ? new Date(
                      item.at
                    )
                      .toLocaleString(
                        'ru-RU'
                      )
                  : '—'
              }

            </td>


            <td>
              ${esc(
                item.action ||
                ''
              )}
            </td>


            <td>
              ${esc(
                item.entity ||
                ''
              )}
            </td>


            <td>
              ${esc(
                item.description ||
                ''
              )}
            </td>

          </tr>
        `
      )
      .join('') ||

    `
      <tr>

        <td colspan="4">

          <div class="empty-state">
            История пока пуста.
          </div>

        </td>

      </tr>
    `;
}


/* =========================================================
   СПРАВОЧНИКИ
   ========================================================= */


function simpleSettingsConfig(type) {

  return {
    building: {
      list:
        project.buildings,
      prefix:
        'BLD',
      singular:
        'здания',
      title:
        'Здание',
      placeholder:
        'Например: Главный корпус'
    },

    work: {
      list:
        project.works,
      prefix:
        'WRK',
      singular:
        'вида работ',
      title:
        'Вид работ',
      placeholder:
        'Например: Монолитные работы'
    },

    org: {
      list:
        project.organizations,
      prefix:
        'ORG',
      singular:
        'организации',
      title:
        'Организация',
      placeholder:
        'Например: ООО «Подрядчик»'
    }
  }[
    type
  ] || null;
}


async function saveSimpleSettingsItem(
  type,
  id,
  values
) {

  const config =
    simpleSettingsConfig(
      type
    );

  if (!config) return;


  const name =
    String(
      values?.name ||
      ''
    )
      .trim();


  if (!name) {

    alert(
      'Название не может быть пустым.'
    );

    return;
  }


  if (
    config.list.some(
      row =>
        String(
          row.id
        ) !==
          String(
            id ||
            ''
          ) &&
        sameText(
          row.name,
          name
        )
    )
  ) {

    alert(
      'Такая запись уже есть.'
    );

    return;
  }


  let item =
    id
      ? byId(
          config.list,
          id
        )
      : null;


  if (
    item
  ) {

    const oldName =
      item.name ||
      '';

    if (
      oldName &&
      !sameText(
        oldName,
        name
      )
    ) {

      item.aliases =
        Array.isArray(
          item.aliases
        )
          ? item.aliases
          : [];


      if (
        !item.aliases.some(
          alias =>
            sameText(
              alias,
              oldName
            )
        )
      ) {

        item.aliases.push(
          oldName
        );
      }
    }


    item.name =
      name;

    item.active =
      values.active !==
        false;

    item.updatedAt =
      nowIso();


    log(
      'Изменено',
      'Справочник',
      oldName +
        ' → ' +
        name
    );

  } else {

    item = {
      id:
        uid(
          config.prefix
        ),
      name,
      active:
        values.active !==
          false,
      createdAt:
        nowIso(),
      updatedAt:
        nowIso()
    };


    config.list.push(
      item
    );


    log(
      'Создано',
      'Справочник',
      name
    );
  }


  await saveProject();


  closeModal();


  initSelects();


  if (
    typeof refreshAllMultiFilters ===
      'function'
  ) {

    refreshAllMultiFilters();
  }


  renderAll();
}


function openSimpleSettingsEditor(
  type,
  id =
    null
) {

  const config =
    simpleSettingsConfig(
      type
    );

  if (!config) return;


  const item =
    id
      ? (
          byId(
            config.list,
            id
          ) ||
          {}
        )
      : {};


  openModal(
    id
      ? 'Редактирование: ' +
        config.title
      : 'Новый элемент: ' +
        config.title,

    `
      <div class="liv-editor-layout">

        <aside class="liv-editor-nav">
          <button
            type="button"
            class="liv-editor-nav-item active">
            Основное
          </button>

          <button
            type="button"
            class="liv-editor-nav-item"
            disabled>
            Дополнительные поля
          </button>

          <button
            type="button"
            class="liv-editor-nav-item"
            disabled>
            История изменений
          </button>
        </aside>


        <div class="liv-editor-content">

          <div class="field">

            <label>
              Название
              <span class="required-mark">*</span>
            </label>

            <input
              id="simpleEditorName"
              value="${esc(
                item.name ||
                ''
              )}"
              placeholder="${esc(
                config.placeholder
              )}"
              autocomplete="off"
            >

          </div>


          <div class="field">

            <label>
              Статус
            </label>

            <select id="simpleEditorActive">
              <option
                value="1"
                ${
                  item.active ===
                    false
                    ? ''
                    : 'selected'
                }>
                Активно
              </option>

              <option
                value="0"
                ${
                  item.active ===
                    false
                    ? 'selected'
                    : ''
                }>
                Архив
              </option>
            </select>

          </div>


          <div class="liv-editor-hint">
            Изменение названия не разрывает существующие связи:
            LIV хранит связанные данные по внутреннему идентификатору.
          </div>

        </div>

      </div>


      <div class="liv-editor-footer">

        <button
          id="simpleEditorCancel"
          type="button"
          class="btn">
          Отмена
        </button>

        <button
          id="simpleEditorSave"
          type="button"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );


  bindClick(
    'simpleEditorCancel',
    closeModal
  );


  bindClick(
    'simpleEditorSave',
    () =>
      saveSimpleSettingsItem(
        type,
        id,
        {
          name:
            $('simpleEditorName')
              ?.value ||
            '',
          active:
            $('simpleEditorActive')
              ?.value !==
            '0'
        }
      )
  );


  setTimeout(
    () =>
      $('simpleEditorName')
        ?.focus(),
    0
  );
}


/* =========================================================
   НАСТРОЙКИ
   ========================================================= */


function settingsListHtml(
  list,
  type
) {

  return (
    list ||
    []
  )
    .map(
      item => `
        <div
          class="settings-row"
          data-settings-id="${esc(
            item.id
          )}"
          data-settings-type="${esc(
            type
          )}"
          data-settings-name="${esc(
            item.name ||
            ''
          )}">

          <div class="settings-row-main">

            <strong class="settings-row-title">
              ${esc(
                item.name ||
                ''
              )}
            </strong>


            <span
              class="settings-status ${
                item.active ===
                  false
                  ? 'is-archive'
                  : 'is-active'
              }">

              <span class="settings-status-dot"></span>

              ${
                item.active ===
                  false
                  ? 'Архив'
                  : 'Активно'
              }

            </span>

          </div>


          <div class="settings-row-menu-wrap">

            <button
              type="button"
              class="settings-kebab"
              data-settings-menu-button
              aria-label="Действия">
              ⋮
            </button>


            <div
              class="settings-row-menu hidden"
              data-settings-menu>

              <button
                type="button"
                data-settings-edit>
                Редактировать
              </button>

              <button
                type="button"
                data-settings-toggle>
                ${
                  item.active ===
                    false
                    ? 'Вернуть из архива'
                    : 'Сделать архивным'
                }
              </button>

            </div>

          </div>

        </div>
      `
    )
    .join('') ||

  `
    <div class="settings-empty">
      Список пока пуст.
    </div>
  `;
}

function ensureBuilderSettingsCard() {

  const settings =
    $('tab-settings');


  if (
    !settings ||
    $('customSectionsCard')
  ) {

    return;
  }


  const card =
    document.createElement(
      'section'
    );


  card.id =
    'customSectionsCard';


  card.className =
    'card';


  settings.appendChild(
    card
  );
}


function simpleSettingsList(type) {
  if (type === 'building') return project.buildings;
  if (type === 'work') return project.works;
  if (type === 'org') return project.organizations;
  return [];
}


function editSettingsItem(
  type,
  id
) {

  openSimpleSettingsEditor(
    type,
    id
  );
}


async function toggleSettingsItem(type, id) {
  const list =
    simpleSettingsList(
      type
    );

  const item =
    byId(
      list,
      id
    );

  if (!item) return;

  item.active =
    item.active === false;

  item.updatedAt =
    nowIso();

  log(
    item.active
      ? 'Восстановлено'
      : 'Архивировано',
    'Справочник',
    item.name ||
    item.id
  );

  await saveProject();

  initSelects();

  if (
    typeof refreshAllMultiFilters ===
      'function'
  ) {
    refreshAllMultiFilters();
  }

  renderAll();
}


function closeSettingsMenus() {

  document
    .querySelectorAll(
      '[data-settings-menu]'
    )
    .forEach(
      menu =>
        menu.classList
          .add(
            'hidden'
          )
    );
}


function makeSettingsListEditable(
  containerId,
  type
) {

  const container =
    $(
      containerId
    );


  if (!container) return;


  container
    .querySelectorAll(
      '.settings-row'
    )
    .forEach(
      row => {

        const id =
          row.dataset
            .settingsId;


        const menu =
          row.querySelector(
            '[data-settings-menu]'
          );


        row
          .querySelector(
            '[data-settings-menu-button]'
          )
          ?.addEventListener(
            'click',
            event => {

              event.stopPropagation();


              const hidden =
                menu
                  ?.classList
                  .contains(
                    'hidden'
                  );


              closeSettingsMenus();


              if (
                hidden
              ) {

                menu
                  ?.classList
                  .remove(
                    'hidden'
                  );
              }
            }
          );


        row
          .querySelector(
            '[data-settings-edit]'
          )
          ?.addEventListener(
            'click',
            event => {

              event.stopPropagation();

              closeSettingsMenus();

              editSettingsItem(
                type,
                id
              );
            }
          );


        row
          .querySelector(
            '[data-settings-toggle]'
          )
          ?.addEventListener(
            'click',
            event => {

              event.stopPropagation();

              closeSettingsMenus();

              toggleSettingsItem(
                type,
                id
              );
            }
          );


        row.onclick =
          event => {

            if (
              event.target.closest(
                '.settings-row-menu-wrap'
              )
            ) {
              return;
            }


            editSettingsItem(
              type,
              id
            );
          };
      }
    );
}




function renderSettings() {

  if (
    $('settingsBuildingCount')
  ) {
    $('settingsBuildingCount').textContent =
      (
        project.buildings ||
        []
      ).length +
      ' записей';
  }


  if (
    $('settingsWorkCount')
  ) {
    $('settingsWorkCount').textContent =
      (
        project.works ||
        []
      ).length +
      ' записей';
  }


  if (
    $('settingsOrgCount')
  ) {
    $('settingsOrgCount').textContent =
      (
        project.organizations ||
        []
      ).length +
      ' записей';
  }


  if (
    $('buildingList')
  ) {

    $('buildingList').innerHTML =
      settingsListHtml(
        project.buildings,
        'building'
      );

    makeSettingsListEditable(
      'buildingList',
      'building'
    );
  }


  if (
    $('workList')
  ) {

    $('workList').innerHTML =
      settingsListHtml(
        project.works,
        'work'
      );

    makeSettingsListEditable(
      'workList',
      'work'
    );
  }


  if (
    $('orgList')
  ) {

    $('orgList').innerHTML =
      settingsListHtml(
        project.organizations,
        'org'
      );

    makeSettingsListEditable(
      'orgList',
      'org'
    );
  }


  if (
    $('projectMeta')
  ) {

    $('projectMeta').innerHTML = `

      <div class="settings-metrics">

        <div class="settings-metric">
          <span>Версия</span>
          <strong>${esc(
            project.schemaVersion ||
            '—'
          )}</strong>
        </div>

        <div class="settings-metric">
          <span>Фронты</span>
          <strong>${activeFronts().length}</strong>
        </div>

        <div class="settings-metric">
          <span>Ресурсы</span>
          <strong>${
            (
              project.resources ||
              []
            ).length
          }</strong>
        </div>

        <div class="settings-metric">
          <span>Планы ресурсов</span>
          <strong>${
            (
              project.resourcePlans ||
              []
            ).length
          }</strong>
        </div>

        <div class="settings-metric">
          <span>Ключевые даты</span>
          <strong>${
            (
              project.milestones ||
              []
            ).length
          }</strong>
        </div>

        <div class="settings-metric">
          <span>Импорты</span>
          <strong>${
            (
              project.importHistory ||
              []
            ).length
          }</strong>
        </div>

      </div>


      <div class="settings-meta-line">

        <span>
          Последнее изменение
        </span>

        <strong>
          ${
            project.meta
              ?.updatedAt
              ? new Date(
                  project.meta.updatedAt
                )
                  .toLocaleString(
                    'ru-RU'
                  )
              : '—'
          }
        </strong>

      </div>


      <div class="settings-meta-line">

        <span>
          Последняя резервная копия
        </span>

        <strong>
          ${
            project.meta
              ?.lastBackupAt
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


      <div class="settings-danger-zone no-print">

        <div>
          <strong>
            Опасная зона
          </strong>

          <p>
            Эти действия затрагивают рабочие данные проекта.
          </p>
        </div>

        <button
          id="fullResetProjectBtn"
          class="btn danger">

          Полный сброс системы

        </button>

      </div>
    `;


    bindClick(
      'fullResetProjectBtn',
      fullResetProject
    );
  }

  document
    .querySelectorAll(
      '[data-settings-search]'
    )
    .forEach(input => {

      input.oninput =
        () => {

          const list =
            $(
              input.dataset
                .settingsSearch
            );

          if (!list) return;

          const query =
            String(
              input.value ||
              ''
            )
              .trim()
              .toLocaleLowerCase(
                'ru-RU'
              );

          list
            .querySelectorAll(
              '.settings-row'
            )
            .forEach(row => {

              const name =
                String(
                  row.dataset
                    .settingsName ||
                  ''
                )
                  .toLocaleLowerCase(
                    'ru-RU'
                  );

              row.classList.toggle(
                'hidden',
                Boolean(
                  query &&
                  !name.includes(
                    query
                  )
                )
              );
            });
        };
    });


  ensureBuilderSettingsCard();


  renderCustomSectionsSettings();
}


/* =========================================================
   ПОЛНЫЙ СБРОС
   ========================================================= */


async function fullResetProject() {

  const first =
    confirm(
      'Полный сброс удалит рабочие данные И справочники LIV Planning.\n\n' +
      'Перед сбросом будет создана защитная копия. Продолжить?'
    );


  if (
    !first
  ) {
    return;
  }


  const phrase =
    prompt(
      'Для подтверждения введи: СБРОСИТЬ'
    );


  if (
    phrase !==
    'СБРОСИТЬ'
  ) {

    alert(
      'Сброс отменен.'
    );

    return;
  }


  await dbPutKey(
    clone(
      project
    ),

    `pre-full-reset-${Date.now()}`
  );


  project =
    emptyProject();


  project.customSections =
    [];


  log(
    'Полный сброс',
    'Проект',
    'Система сброшена до первоначального состояния.'
  );


  await saveProject();


  if (
    typeof resetMultiFilter ===
    'function'
  ) {

    [
      'rOrg',
      'rBuilding',
      'rWork',
      'rFront'
    ]
      .forEach(
        id =>
          resetMultiFilter(
            id,
            false
          )
      );
  }


  initSelects();


  renderAll();


  alert(
    'LIV Planning сброшен. Защитная копия сохранена локально.'
  );
}


/* =========================================================
   КОНСТРУКТОР РАЗДЕЛОВ
   ========================================================= */


function builderFields() {

  return cfg(
    'BUILDER_FIELDS',

    [
      {
        id:
          'organization',
        name:
          'Организация'
      },
      {
        id:
          'building',
        name:
          'Здание'
      },
      {
        id:
          'work',
        name:
          'Работа'
      },
      {
        id:
          'status',
        name:
          'Статус'
      },
      {
        id:
          'planStart',
        name:
          'План начало'
      },
      {
        id:
          'planEnd',
        name:
          'План окончание'
      },
      {
        id:
          'factStart',
        name:
          'Факт начало'
      },
      {
        id:
          'factEnd',
        name:
          'Факт окончание'
      },
      {
        id:
          'forecastEnd',
        name:
          'Прогноз'
      },
      {
        id:
          'deviation',
        name:
          'Отклонение'
      },
      {
        id:
          'volume',
        name:
          'Объём'
      },
      {
        id:
          'comment',
        name:
          'Комментарий'
      }
    ]
  );
}


function renderCustomSectionsSettings() {

  const card =
    $('customSectionsCard');


  if (
    !card
  ) {
    return;
  }


  card.innerHTML = `
    <div class="section-toolbar">

      <div>

        <h2>
          Конструктор разделов
        </h2>

        <div class="muted">

          Создавай собственные рабочие страницы
          из одной базы:
          например «Фасады», «Кровля»,
          «Наружные сети».

        </div>

      </div>


      <button
        id="newCustomSectionBtn"
        class="btn primary">

        + Создать раздел

      </button>

    </div>


    <div style="margin-top:12px">

      ${
        (
          project.customSections ||
          []
        )
          .map(
            item => `
              <div class="item">

                <span>

                  <b>
                    ${esc(
                      item.name
                    )}
                  </b>

                  ·

                  ${esc(
                    item.viewType ||
                    'table'
                  )}

                  · полей

                  ${
                    item.fields?.length ||
                    0
                  }

                </span>


                <span>

                  <button
                    class="row-btn"
                    data-section-edit="${esc(
                      item.id
                    )}">

                    Изменить

                  </button>

                  &nbsp;

                  <button
                    class="row-btn danger-text"
                    data-section-delete="${esc(
                      item.id
                    )}">

                    Удалить

                  </button>

                </span>

              </div>
            `
          )
          .join('') ||

        `
          <div class="muted">
            Пользовательские разделы пока не созданы.
          </div>
        `
      }

    </div>
  `;


  bindClick(
    'newCustomSectionBtn',
    () =>
      openCustomSectionEditor()
  );


  card
    .querySelectorAll(
      '[data-section-edit]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            openCustomSectionEditor(
              button.dataset
                .sectionEdit
            );
      }
    );


  card
    .querySelectorAll(
      '[data-section-delete]'
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            deleteCustomSection(
              button.dataset
                .sectionDelete
            );
      }
    );
}


function openCustomSectionEditor(
  id =
    null
) {

  const item =
    id
      ? byId(
          project.customSections,
          id
        )
      : null;


  const selected =
    new Set(
      item?.fields ||
      [
        'building',
        'work',
        'organization',
        'status',
        'planStart',
        'planEnd',
        'forecastEnd',
        'factEnd',
        'deviation'
      ]
    );


  const viewTypes =
    cfg(
      'VIEW_TYPES',

      [
        {
          id:
            'table',
          name:
            'Таблица'
        },
        {
          id:
            'gantt',
          name:
            'Гант'
        }
      ]
    );


  openModal(
    id
      ? 'Настройка раздела'
      : 'Новый раздел',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Название раздела
          </label>

          <input
            id="csName"
            value="${esc(
              item?.name ||
              ''
            )}"
            placeholder="Например: Фасады"
          >

        </div>


        <div class="field">

          <label>
            Вид
          </label>

          <select id="csViewType">

            ${
              viewTypes
                .map(
                  type => `
                    <option
                      value="${esc(
                        type.id
                      )}"
                      ${
                        type.id ===
                        (
                          item?.viewType ||
                          'table'
                        )
                          ? 'selected'
                          : ''
                      }>

                      ${esc(
                        type.name
                      )}

                    </option>
                  `
                )
                .join('')
            }

          </select>

        </div>

      </div>


      <h3>
        Поля
      </h3>


      <div class="mapping-grid">

        ${
          builderFields()
            .map(
              field => `
                <label class="check-line">

                  <input
                    type="checkbox"
                    data-cs-field="${esc(
                      field.id
                    )}"
                    ${
                      selected.has(
                        field.id
                      )
                        ? 'checked'
                        : ''
                    }
                  >

                  ${esc(
                    field.name
                  )}

                </label>
              `
            )
            .join('')
        }

      </div>


      <div class="editor-actions">

        <button
          id="csSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );


  $('csSave').onclick =
    () =>
      saveCustomSection(
        id
      );
}


async function saveCustomSection(
  id =
    null
) {

  const name =
    $('csName')
      .value
      .trim();


  if (
    !name
  ) {

    alert(
      'Укажи название раздела.'
    );

    return;
  }


  const fields =
    [
      ...document
        .querySelectorAll(
          '[data-cs-field]:checked'
        )
    ]
      .map(
        input =>
          input.dataset
            .csField
      );


  if (
    !fields.length
  ) {

    alert(
      'Выбери хотя бы одно поле.'
    );

    return;
  }


  let item =
    id
      ? byId(
          project.customSections,
          id
        )
      : null;


  if (
    !item
  ) {

    item = {

      id:
        uid(
          'SECTION'
        ),

      createdAt:
        nowIso()
    };


    project.customSections
      .push(
        item
      );
  }


  Object.assign(
    item,
    {

      name,

      viewType:
        $('csViewType').value,

      fields,

      updatedAt:
        nowIso()
    }
  );


  log(
    id
      ? 'Изменено'
      : 'Создано',

    'Раздел',

    name
  );


  await saveProject();


  closeModal();


  rebuildCustomSections();


  renderSettings();
}


async function deleteCustomSection(
  id
) {

  const item =
    byId(
      project.customSections,
      id
    );


  if (
    !item ||
    !confirm(
      `Удалить пользовательский раздел «${item.name}»? Данные проекта при этом не удаляются.`
    )
  ) {

    return;
  }


  project.customSections =
    project.customSections
      .filter(
        row =>
          String(
            row.id
          ) !==
          String(
            id
          )
      );


  log(
    'Удалено',
    'Раздел',
    item.name
  );


  await saveProject();


  rebuildCustomSections();


  renderSettings();
}


function customFieldLabel(
  id
) {

  return (
    builderFields()
      .find(
        item =>
          item.id ===
          id
      )?.name ||
    id
  );
}


function customFrontValue(
  front,
  field
) {

  const hydrated =
    hydrateFront(
      front
    );


  const map = {

    organization:
      hydrated.organization,

    contract:
      front.contractNo ||
      '',

    building:
      hydrated.building,

    work:
      hydrated.work,

    front:
      frontLabel(
        front
      ),

    status:
      front.status ||
      '',

    planStart:
      front.planStart
        ? ruDate(
            front.planStart
          )
        : '',

    planEnd:
      front.planEnd
        ? ruDate(
            front.planEnd
          )
        : '',

    factStart:
      front.factStart
        ? ruDate(
            front.factStart
          )
        : '',

    factEnd:
      front.factEnd
        ? ruDate(
            front.factEnd
          )
        : '',

    forecastEnd:
      front.forecastEnd
        ? ruDate(
            front.forecastEnd
          )
        : '',

    deviation:
      (() => {

        const d =
          dateDeviationDays(
            front.planEnd,
            front.factEnd ||
            front.forecastEnd
          );


        return (
          d ===
            null
            ? ''
            : `${
                d >
                  0
                  ? '+'
                  : ''
              }${d}`
        );
      })(),

    duration:
      front.planStart &&
      front.planEnd
        ? diffDays(
            front.planStart,
            front.planEnd
          ) +
          1
        : '',

    volume:
      fmt(
        front.totalQty
      ),

    productivity:
      front.productivity ??
      '',

    people:
      front.people ??
      '',

    equipment:
      front.equipment ??
      '',

    reserve:
      front.reserveValue ??
      '',

    comment:
      front.comment ||
      ''
  };


  return (
    map[
      field
    ] ??
    ''
  );
}


function rebuildCustomSections() {

  document
    .querySelectorAll(
      '[data-custom-tab]'
    )
    .forEach(
      node =>
        node.remove()
    );


  document
    .querySelectorAll(
      '[data-custom-panel]'
    )
    .forEach(
      node =>
        node.remove()
    );


  const nav =
    document.querySelector(
      'nav.tabs'
    );


  const main =
    document.querySelector(
      'main.container'
    );


  if (
    !nav ||
    !main
  ) {

    return;
  }


  (
    project.customSections ||
    []
  )
    .forEach(
      section => {

        const tab =
          document.createElement(
            'button'
          );


        tab.className =
          'tab';


        tab.dataset.tab =
          `custom-${section.id}`;


        tab.dataset.customTab =
          section.id;


        tab.textContent =
          section.name;


        nav.appendChild(
          tab
        );


        const panel =
          document.createElement(
            'section'
          );


        panel.id =
          `tab-custom-${section.id}`;


        panel.dataset.customPanel =
          section.id;


        panel.className =
          'panel hidden';


        main.appendChild(
          panel
        );


        tab.onclick =
          () =>
            switchTab(
              `custom-${section.id}`
            );
      }
    );
}


function renderCustomSection(
  sectionId
) {

  const section =
    byId(
      project.customSections,
      sectionId
    );


  const panel =
    $(
      `tab-custom-${sectionId}`
    );


  if (
    !section ||
    !panel
  ) {

    return;
  }


  const fronts =
    activeFronts();


  panel.innerHTML = `
    <section class="card">

      <div class="section-toolbar">

        <div>

          <h2>
            ${esc(
              section.name
            )}
          </h2>

          <div class="muted">

            Пользовательское представление общей базы.

            Настройка — в разделе «Настройки».

          </div>

        </div>


        <button
          class="btn"
          data-custom-export="${esc(
            section.id
          )}">

          Экспорт Excel

        </button>

      </div>

    </section>


    <section class="card table-wrap">

      <table>

        <thead>

          <tr>

            ${
              section.fields
                .map(
                  field =>
                    `<th>${esc(
                      customFieldLabel(
                        field
                      )
                    )}</th>`
                )
                .join('')
            }

          </tr>

        </thead>


        <tbody>

          ${
            fronts
              .map(
                front => `
                  <tr>

                    ${
                      section.fields
                        .map(
                          field =>
                            `<td>${esc(
                              customFrontValue(
                                front,
                                field
                              )
                            )}</td>`
                        )
                        .join('')
                    }

                  </tr>
                `
              )
              .join('')
          }

        </tbody>

      </table>

    </section>
  `;


  panel
    .querySelector(
      '[data-custom-export]'
    )
    ?.addEventListener(
      'click',

      () =>
        exportCustomSectionExcel(
          section.id
        )
    );
}


/* =========================================================
   ЭКСПОРТ EXCEL
   ========================================================= */


function ensureExcelButton() {

  const actions =
    document.querySelector(
      '.top-actions'
    );


  if (
    !actions ||
    $('excelBtn')
  ) {

    return;
  }


  const button =
    document.createElement(
      'button'
    );


  button.id =
    'excelBtn';


  button.className =
    'btn';


  button.textContent =
    'Экспорт Excel';


  actions.appendChild(
    button
  );


  button.onclick =
    exportCurrentViewExcel;
}


function excelDownload(
  rows,
  sheetName,
  fileName
) {

  if (
    typeof XLSX ===
    'undefined'
  ) {

    alert(
      'Библиотека Excel не загрузилась.'
    );

    return;
  }


  const wb =
    XLSX.utils
      .book_new();


  const ws =
    XLSX.utils
      .json_to_sheet(
        rows
      );


  XLSX.utils
    .book_append_sheet(
      wb,
      ws,
      String(
        sheetName ||
        'Данные'
      )
        .slice(
          0,
          31
        )
    );


  XLSX.writeFile(
    wb,
    fileName
  );
}


function exportCustomSectionExcel(
  sectionId
) {

  const section =
    byId(
      project.customSections,
      sectionId
    );


  if (
    !section
  ) {
    return;
  }


  const rows =
    activeFronts()
      .map(
        front => {

          const result =
            {};


          section.fields
            .forEach(
              field => {

                result[
                  customFieldLabel(
                    field
                  )
                ] =
                  customFrontValue(
                    front,
                    field
                  );
              }
            );


          return result;
        }
      );


  excelDownload(
    rows,
    section.name,
    `${section.name}_${today()}.xlsx`
  );
}


function exportCurrentViewExcel() {

  const active =
    document.querySelector(
      '.tab.active[data-tab]'
    )
      ?.dataset
      .tab ||
    'dashboard';


  let rows =
    [];


  let sheet =
    'Данные';


  if (
    active ===
    'resources'
  ) {

    rows =
      resourceFiltered()
        .map(
          row => ({

            'Дата':
              row.date,

            'Организация':
              nameById(
                project.organizations,
                row.organizationId
              ) ||
              '',

            'Здание':
              nameById(
                project.buildings,
                row.buildingId
              ) ||
              '',

            'Работа':
              nameById(
                project.works,
                row.workId
              ) ||
              '',

            'Фронт':
              row.frontId
                ? frontLabel(
                    byId(
                      project.fronts,
                      row.frontId
                    )
                  )
                : '',

            'ИТР':
              roundInt(
                row.itr
              ),

            'Рабочие':
              roundInt(
                row.workers
              ),

            'Механизаторы':
              roundInt(
                row.mechanizers
              ),

            'Техника':
              row.equipmentType ||
              '',

            'Количество техники':
              roundInt(
                row.equipmentQty
              ),

            'Комментарий':
              row.comment ||
              ''
          })
        );


    sheet =
      'Ресурсы';

  } else if (
    active ===
    'milestones'
  ) {

    rows =
      (
        project.milestones ||
        []
      )
        .map(
          item => ({

            'Подрядчик':
              milestoneOrganizationName(
                item
              ),

            'Договор':
              milestoneContractLabel(
                item
              ),

            'Ключевая дата':
              item.milestoneNo ||
              '',

            'Формулировка':
              item.title ||
              '',

            'Здание':
              nameById(
                project.buildings,
                item.buildingId
              ) ||
              '',

            'Договорная дата':
              item.contractDate ||
              '',

            'Рабочая дата':
              item.workDate ||
              '',

            'Прогноз':
              item.forecastDate ||
              '',

            'Факт':
              item.factDate ||
              '',

            'Отклонение, дн.':
              milestoneDeviation(
                item
              ) ??
              '',

            'Статус':
              item.status ||
              '',

            'Писем':
              milestoneLetters(
                item
              )
                .length
          })
        );


    sheet =
      'Ключевые даты';

  } else if (
    active ===
    'elements'
  ) {

    rows =
      (
        project.numberedElements ||
        []
      )
        .filter(
          item =>
            item.active !==
            false
        )
        .map(
          item => ({

            'Тип':
              item.elementType ||
              '',

            'Номер':
              item.elementNo ||
              '',

            'Здание':
              nameById(
                project.buildings,
                item.buildingId
              ) ||
              '',

            'Группа':
              item.groupCode ||
              '',

            'Захватка':
              item.capture ||
              '',

            'Зона':
              item.zone ||
              '',

            'Работа':
              nameById(
                project.works,
                item.workId
              ) ||
              '',

            'Статус':
              item.status ||
              '',

            'Комментарий':
              item.comment ||
              ''
          })
        );


    sheet =
      'Номерные элементы';

  } else if (
    active.startsWith(
      'custom-'
    )
  ) {

    exportCustomSectionExcel(
      active.replace(
        'custom-',
        ''
      )
    );


    return;

  } else {

    rows =
      activeFronts()
        .map(
          front => ({

            'Здание':
              hydrateFront(
                front
              )
                .building,

            'Работа':
              hydrateFront(
                front
              )
                .work,

            'Организация':
              hydrateFront(
                front
              )
                .organization,

            'Статус':
              front.status ||
              '',

            'План начало':
              front.planStart ||
              '',

            'План окончание':
              front.planEnd ||
              '',

            'Факт начало':
              front.factStart ||
              '',

            'Факт окончание':
              front.factEnd ||
              '',

            'Прогноз':
              front.forecastEnd ||
              '',

            'Объём':
              num(
                front.totalQty
              ),

            'Выполнено':
              num(
                front.doneQty
              )
          })
        );


    sheet =
      'Фронты';
  }


  excelDownload(
    rows,
    sheet,
    `LIV_Planning_${sheet}_${today()}.xlsx`
  );
}


/* =========================================================
   ПЕЧАТЬ / PDF
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


  if (
    active
  ) {

    active.classList
      .add(
        'print-active'
      );
  }


  window.print();


  setTimeout(
    () =>
      active
        ?.classList
        .remove(
          'print-active'
        ),

    500
  );
}


/* =========================================================
   УПРАВЛЕНИЕ ШАХМАТКАМИ
   ========================================================= */


function openCreateMatrixEditor() {

  openModal(
    'Новая шахматка',

    `
      <div class="liv-editor-content">

        <div class="field">
          <label>
            Название шахматки
          </label>

          <input
            id="newMatrixName"
            placeholder="Например: Фасады Главного корпуса"
            autocomplete="off"
          >
        </div>

        <div class="liv-editor-hint">
          Шахматка создаётся как отдельное представление.
          Фронты можно добавить вручную или загрузить через импорт.
        </div>

      </div>

      <div class="liv-editor-footer">

        <button
          id="newMatrixCancel"
          class="btn">
          Отмена
        </button>

        <button
          id="newMatrixSave"
          class="btn primary">
          Создать
        </button>

      </div>
    `
  );


  bindClick(
    'newMatrixCancel',
    closeModal
  );


  bindClick(
    'newMatrixSave',
    createMatrixFromEditor
  );


  setTimeout(
    () =>
      $('newMatrixName')
        ?.focus(),
    0
  );
}


async function createMatrixFromEditor() {

  const name =
    $('newMatrixName')
      ?.value
      .trim() ||
    '';


  if (!name) {

    alert(
      'Укажи название шахматки.'
    );

    return;
  }


  const matrix = {
    id:
      uid(
        'MX'
      ),
    name,
    sourceType:
      'manual',
    sourceFile:
      '',
    sourceSheet:
      '',
    active:
      true,
    createdAt:
      nowIso(),
    updatedAt:
      nowIso(),
    lastImportId:
      '',
    viewConfig:
      {}
  };


  project.matrices =
    project.matrices ||
    [];


  project.matrices.push(
    matrix
  );


  log(
    'Создано',
    'Шахматка',
    name,
    {
      matrixId:
        matrix.id
    }
  );


  await saveProject();


  closeModal();


  fillMatrixSelects();


  if (
    $('mfMatrix')
  ) {

    $('mfMatrix').value =
      matrix.id;
  }


  renderMatrix();
}


function updateCurrentMatrixFromFile() {

  const id =
    currentMatrixId();


  const matrix =
    matrixById(
      id
    );


  if (!matrix) {

    alert(
      'Сначала выбери конкретную шахматку.'
    );

    return;
  }


  importMatrixTargetId =
    matrix.id;


  switchTab(
    'import'
  );


  fillMatrixSelects();


  if (
    $('importMatrixTarget')
  ) {

    $('importMatrixTarget').value =
      matrix.id;
  }


  if (
    $('importMatrixName')
  ) {

    $('importMatrixName').disabled =
      true;
  }


  if (
    $('importInfo')
  ) {

    $('importInfo')
      .classList
      .remove(
        'hidden'
      );


    $('importInfo').textContent =
      'Обновление шахматки «' +
      matrix.name +
      '». Загрузи новый Excel-файл и выполни анализ.';
  }
}


async function renameCurrentMatrix() {

  const id =
    currentMatrixId();


  const matrix =
    matrixById(
      id
    );


  if (!matrix) {

    alert(
      'Сначала выбери конкретную шахматку.'
    );

    return;
  }


  const value =
    prompt(
      'Новое название шахматки:',
      matrix.name ||
      ''
    );


  if (
    value ===
    null
  ) {
    return;
  }


  const name =
    value.trim();


  if (!name) {

    alert(
      'Название не может быть пустым.'
    );

    return;
  }


  matrix.name =
    name;

  matrix.updatedAt =
    nowIso();


  log(
    'Переименовано',
    'Шахматка',
    name,
    {
      matrixId:
        matrix.id
    }
  );


  await saveProject();


  fillMatrixSelects();


  $('mfMatrix').value =
    matrix.id;


  renderMatrix();
}


function openDeleteMatrixDialog() {

  const id =
    currentMatrixId();


  const matrix =
    matrixById(
      id
    );


  if (!matrix) {

    alert(
      'Сначала выбери конкретную шахматку.'
    );

    return;
  }


  const links =
    activeMatrixLinks(
      id
    );


  const exclusive =
    links.filter(
      link =>
        matrixFrontUsageCount(
          link.frontId,
          id
        ) ===
          0
    );


  const shared =
    links.length -
    exclusive.length;


  openModal(
    'Удаление шахматки',

    `
      <div class="notice warn">
        <b>${esc(matrix.name)}</b><br>
        Связано фронтов: ${links.length}.<br>
        Только в этой шахматке: ${exclusive.length}.<br>
        Используются также в других шахматках: ${shared}.
      </div>

      <p>
        Что удалить?
      </p>

      <div class="editor-actions">

        <button
          id="matrixDeleteCancel"
          class="btn">
          Отмена
        </button>

        <button
          id="matrixDeleteViewOnly"
          class="btn">
          Только шахматку
        </button>

        <button
          id="matrixDeleteWithData"
          class="btn danger">
          Шахматку и её данные
        </button>

      </div>
    `
  );


  bindClick(
    'matrixDeleteCancel',
    closeModal
  );


  bindClick(
    'matrixDeleteViewOnly',
    () =>
      deleteMatrix(
        id,
        false
      )
  );


  bindClick(
    'matrixDeleteWithData',
    () =>
      deleteMatrix(
        id,
        true
      )
  );
}


async function deleteMatrix(
  matrixId,
  withData
) {

  const matrix =
    matrixById(
      matrixId
    );


  if (!matrix) {
    return;
  }


  const links =
    activeMatrixLinks(
      matrixId
    );


  const linkedFrontIds =
    links.map(
      link =>
        link.frontId
    );


  project.matrixFronts =
    (
      project.matrixFronts ||
      []
    )
      .filter(
        link =>
          String(
            link.matrixId
          ) !==
          String(
            matrixId
          )
      );


  if (
    withData
  ) {

    linkedFrontIds
      .forEach(
        frontId => {

          if (
            matrixFrontUsageCount(
              frontId
            ) >
              0
          ) {
            return;
          }


          const front =
            byId(
              project.fronts,
              frontId
            );


          if (
            front &&
            (
              String(
                front.originMatrixId ||
                ''
              ) ===
                String(
                  matrixId
                ) ||
              String(
                front.source
                  ?.matrixId ||
                ''
              ) ===
                String(
                  matrixId
                )
            )
          ) {

            front.active =
              false;

            front.deletedAt =
              nowIso();

            front.deletedReason =
              'Удалена шахматка';
          }
        }
      );
  }


  matrix.active =
    false;

  matrix.deletedAt =
    nowIso();


  (
    project.importHistory ||
    []
  )
    .forEach(
      item => {

        if (
          String(
            item.matrixId ||
            ''
          ) ===
          String(
            matrixId
          )
        ) {

          item.status =
            'matrix_deleted';

          item.matrixDeletedAt =
            nowIso();
        }
      }
    );


  log(
    'Удалено',
    'Шахматка',
    matrix.name,
    {
      matrixId,
      withData,
      linkedFronts:
        linkedFrontIds.length
    }
  );


  await saveProject();


  closeModal();


  fillMatrixSelects();


  if (
    $('mfMatrix')
  ) {
    $('mfMatrix').value =
      'all';
  }


  renderAll();
}


/* =========================================================
   ЕДИНЫЙ ИНТЕРФЕЙС РАЗДЕЛОВ
   ========================================================= */


function livPanelMeta(
  name
) {

  return {
    dashboard: [
      'Сводка',
      'Ключевые показатели проекта и текущее состояние'
    ],
    matrix: [
      'Шахматка',
      'Рабочее представление по объектам, этажам и видам работ'
    ],
    gantt: [
      'Гант',
      'Сроки, последовательность и текущее состояние работ'
    ],
    planfact: [
      'План / факт',
      'Сравнение плановых и фактических объёмов'
    ],
    volumes: ['Объёмы','Действующие и договорные объёмы, изменения и история'],
    reports: ['Отчёты','Формы по версиям графиков и зафиксированные снимки'],
    resources: [
      'Ресурсы',
      'Люди, техника, динамика и план / факт ресурсов'
    ],
    organizations: [
      'Организации',
      'Карточки подрядчиков и участников проекта'
    ],
    milestones: [
      'Ключевые даты',
      'Договорные и контрольные сроки по подрядчикам'
    ],
    elements: [
      'Номерные элементы',
      'Сваи, анкеры и другие элементы с уникальными номерами'
    ],
    demolition: [
      'Демонтаж',
      'Статус, сроки и зависимости демонтажных работ'
    ],
    import: [
      'Импорт',
      'Загрузка, сопоставление и проверка внешних данных'
    ],
    history: [
      'История',
      'Журнал изменений и действий пользователей'
    ]
  }[
    name
  ] || null;
}


function ensureUnifiedPanelPresentation() {

  document
    .querySelectorAll(
      'main > .panel[id^="tab-"]'
    )
    .forEach(
      panel => {

        const name =
          String(
            panel.id ||
            ''
          )
            .replace(
              'tab-',
              ''
            );


        if (
          name ===
          'settings'
        ) {
          return;
        }


        const meta =
          livPanelMeta(
            name
          );


        if (
          meta &&
          !panel.querySelector(
            ':scope > .liv-page-head'
          )
        ) {

          const head =
            document.createElement(
              'section'
            );


          head.className =
            'liv-page-head';


          head.innerHTML = `
            <div>
              <h1>${esc(meta[0])}</h1>
              <p>${esc(meta[1])}</p>
            </div>
          `;


          panel.prepend(
            head
          );
        }


        panel
          .querySelectorAll(
            ':scope > .toolbar, :scope > .resource-toolbar'
          )
          .forEach(
            node =>
              node.classList.add(
                'liv-filter-bar'
              )
          );


        panel
          .querySelectorAll(
            '.section-toolbar'
          )
          .forEach(
            node =>
              node.classList.add(
                'liv-section-toolbar'
              )
          );


        panel
          .querySelectorAll(
            '.table-wrap'
          )
          .forEach(
            node =>
              node.classList.add(
                'liv-table-surface'
              )
          );


        panel
          .querySelectorAll(
            '.stats'
          )
          .forEach(
            node =>
              node.classList.add(
                'liv-metrics'
              )
          );
      }
    );


  document
    .querySelectorAll(
      '.resource-nav'
    )
    .forEach(
      node =>
        node.classList.add(
          'liv-subnav'
        )
    );
}


/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
   ========================================================= */


function switchTab(
  name
) {

  ensureUnifiedPanelPresentation();


  document
    .querySelectorAll(
      '.tab[data-tab]'
    )
    .forEach(
      button => {

        button.classList
          .toggle(
            'active',

            button.dataset
              .tab ===
              name
          );
      }
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
    name.startsWith(
      'custom-'
    )
  ) {

    renderCustomSection(
      name.replace(
        'custom-',
        ''
      )
    );


    return;
  }


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

    initSelects();


    refreshAllMultiFilters();


    renderResourceCurrentView();
  }


  if (
    name ===
    'organizations'
  ) {

    initOrganizationCard();
  }


  if (
    name ===
    'milestones'
  ) {

    renderMilestones();
  }


  if (
    name ===
    'elements'
  ) {

    renderElements();
  }


  if (
    name ===
    'demolition'
  ) {

    renderDemolition();
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
  window.LIV_PLANNING_UI?.onTab(name);
  if(typeof livApplyViewConstructor==='function')livApplyViewConstructor();
  if(typeof markTotalRows==='function')markTotalRows();
}


/* =========================================================
   ОБЩАЯ ОТРИСОВКА
   ========================================================= */


function markTotalRows() {

  for(const table of document.querySelectorAll('main table')){
    const head=table.querySelector('thead tr');if(!head)continue;
    const cells=[...head.children],rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.children.length===cells.length).slice(0,30);
    cells.forEach((th,index)=>{
      const samples=rows.map(r=>r.children[index]).filter(c=>!c.querySelector('input,select,button')&&c.textContent.trim()&&!/^[—–-]$/.test(c.textContent.trim()));
      const numeric=samples.length>0&&samples.every(c=>/^[+−-]?[\d\s\u00a0]+(?:[.,]\d+)?\s*(?:%|п\.п\.)?$/.test(c.textContent.trim()));
      th.classList.toggle('liv-numeric-cell',numeric);for(const r of rows)r.children[index].classList.toggle('liv-numeric-cell',numeric);
      const date=samples.length>0&&samples.every(c=>/^\d{4}-\d{2}-\d{2}$|^\d{2}\.\d{2}\.\d{4}$/.test(c.textContent.trim()));
      th.classList.toggle('liv-date-cell',date);for(const r of rows)r.children[index].classList.toggle('liv-date-cell',date);
    });
  }

  document
    .querySelectorAll(
      'table tr'
    )
    .forEach(
      row => {

        const hasTotal =
          Array.from(
            row.cells ||
            []
          )
            .some(
              cell =>
                /^\s*(?:итого|всего)(?:\s|:|$)/i
                  .test(
                    String(
                      cell.textContent ||
                      ''
                    )
                  )
            );


        row.classList.toggle(
          'liv-total-row',
          hasTotal || row.parentElement?.tagName==='TFOOT'
        );
      }
    );
}


function renderAll() {

  ensureUnifiedPanelPresentation();


  initSelects();


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {

    refreshAllMultiFilters();
  }


  if (
    $('dTotal')
  ) {

    renderDashboard();
  }


  if (
    $('matrixBody')
  ) {

    renderMatrix();
  }


  if (
    $('gantt')
  ) {

    renderGantt();
  }


  if (
    $('planRows')
  ) {

    renderPlanFact();
  }


  if (
    $('resourceRows')
  ) {

    renderResourceCurrentView();
  }


  if (
    $('milestoneRows')
  ) {

    renderMilestones();
  }


  if (
    $('elementRows')
  ) {

    renderElements();
  }


  if (
    $('demolitionRows')
  ) {

    renderDemolition();
  }


  if (
    $('historyRows')
  ) {

    renderHistory();
  }


  if (
    $('projectMeta')
  ) {

    renderSettings();
  }


  if (
    $('organizationCardSelect')
  ) {

    refreshOrganizationCard();
  }


  if (
    typeof rebuildCustomSections ===
    'function'
  ) {

    rebuildCustomSections();
  }


  /*
    После любой перерисовки
    повторно применяем настройки конструктора
    текущей страницы.
  */

  if (
    typeof livApplyViewConstructor ===
    'function'
  ) {

    livApplyViewConstructor();
  }


  markTotalRows();
  window.LIV_PLANNING_UI?.onTab();
}


/* =========================================================
   ЗАПУСК
   ========================================================= */


async function init() {

  /*
    Открываем локальную базу IndexedDB.
  */

  db =
    await openDb();


  /*
    Загружаем текущий проект.
  */

  const raw =
    await dbGetKey();


  /*
    Нормализуем структуру.
    Существующие данные не очищаем.
  */

  project =
    await migrateIfNeeded(
      raw
    );


  validateLoadedProject();


  /*
    Если база новая или структура была обновлена,
    сохраняем нормализованное состояние.
  */

  if (
    !raw ||
    raw.schemaVersion !==
      SCHEMA_VERSION
  ) {

    await saveProject();
  }


  /*
    Обычные выпадающие списки.
  */

  initSelects();


  /*
    Мультифильтры ресурсов.
  */

  if (
    typeof initResourceMultiFilters ===
    'function'
  ) {

    initResourceMultiFilters();
  }


  /*
    Основные события интерфейса.
  */

  bindUi();


  /*
    Начальные даты.
  */

  await initDefaultDates();


  /*
    Excel.
  */

  if (
    typeof ensureExcelButton ===
    'function'
  ) {

    ensureExcelButton();
  }


  /*
    Пользовательские разделы.
  */

  if (
    typeof rebuildCustomSections ===
    'function'
  ) {

    rebuildCustomSections();
  }


  /*
    Информация о резервной копии.
  */

  if (
    typeof renderBackupNotice ===
    'function'
  ) {

    renderBackupNotice();
  }


  /*
    По умолчанию нулевые значения скрыты,
    если в config.js не задано обратное.
  */

  if (
    $('rShowZero')
  ) {

    $('rShowZero').checked =
      Boolean(
        cfg(
          'SHOW_ZERO_ORGANIZATIONS_BY_DEFAULT',
          false
        )
      );
  }


  /*
    Первая полная отрисовка.
  */

  renderAll();


  /*
    Универсальный конструктор страниц
    + красивый печатный режим.
  */

  if (
    typeof initLivViewBuilder ===
    'function'
  ) {

    initLivViewBuilder();
  }


  /*
    После инициализации конструктора
    еще раз применяем сохраненную конфигурацию
    текущей страницы.
  */

  if (
    typeof livApplyViewConstructor ===
    'function'
  ) {

    livApplyViewConstructor();
  }
}


/* =========================================================
   СОБЫТИЯ
   ========================================================= */


function bindUi() {

  document.addEventListener(
    'click',
    event => {

      if (
        !event.target.closest(
          '.settings-row-menu-wrap'
        )
      ) {
        closeSettingsMenus();
      }
    }
  );


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


  bindClick(
    'modalClose',
    closeModal
  );


  const modal =
    $('modal');


  if (
    modal
  ) {

    modal.onclick =
      event => {

        if (
          event.target ===
          modal
        ) {

          closeModal();
        }
      };
  }


  document.addEventListener(
    'keydown',

    event => {

      if (
        event.key ===
          'Escape' &&
        modal &&
        !modal.classList
          .contains(
            'hidden'
          )
      ) {

        closeModal();
      }
    }
  );


  [
    'mfMatrix',
    'mfBuilding',
    'mfBlock',
    'mfFloor',
    'mfWork',
    'mfOrg',
    'mfStatus'
  ]
    .forEach(
      id =>
        bindChange(
          id,
          renderMatrix
        )
    );


  bindClick(
    'matrixCreateBtn',
    openCreateMatrixEditor
  );


  bindClick(
    'matrixUpdateBtn',
    updateCurrentMatrixFromFile
  );


  bindClick(
    'matrixRenameBtn',
    renameCurrentMatrix
  );


  bindClick(
    'matrixDeleteBtn',
    openDeleteMatrixDialog
  );


  bindClick(
    'newFrontBtn',
    () =>
      openFrontEditor()
  );


  [
    'gBuilding',
    'gWork',
    'gMode'
  ]
    .forEach(
      id =>
        bindChange(
          id,
          renderGantt
        )
    );


  [
    'pfFrom',
    'pfTo',
    'pfBuilding',
    'pfWork'
  ]
    .forEach(
      id =>
        bindChange(
          id,
          renderPlanFact
        )
    );


  bindClick(
    'newPlanRow',
    () =>
      openLogEditor(
        'plan'
      )
  );


  bindClick(
    'newFactRow',
    () =>
      openLogEditor(
        'fact'
      )
  );


  if (
    typeof bindResourceUi ===
    'function'
  ) {

    bindResourceUi();
  }


  bindClick(
    'newMilestoneBtn',
    () =>
      openMilestoneEditor()
  );


  [
    'elBuilding',
    'elType'
  ]
    .forEach(
      id =>
        bindChange(
          id,
          renderElements
        )
    );


  if (
    $('elSearch')
  ) {

    $('elSearch').oninput =
      renderElements;
  }


  bindClick(
    'newElementBtn',
    () =>
      openElementEditor()
  );


  bindClick(
    'addBuildingBtn',
    () =>
      openSimpleSettingsEditor(
        'building'
      )
  );


  bindClick(
    'addWorkBtn',
    () =>
      openSimpleSettingsEditor(
        'work'
      )
  );


  bindClick(
    'addOrgBtn',
    () =>
      openSimpleSettingsEditor(
        'org'
      )
  );


  bindClick(
    'backupBtn',
    exportBackup
  );


  if (
    $('restoreInput')
  ) {

    $('restoreInput').onchange =
      event => {

        const file =
          event.target
            .files
            ?.[0];


        if (
          file
        ) {

          restoreProject(
            file
          );
        }


        event.target.value =
          '';
      };
  }


  if (
    $('compareInput')
  ) {

    $('compareInput').onchange =
      event => {

        const file =
          event.target
            .files
            ?.[0];


        if (
          file
        ) {

          compareProjectFile(
            file
          );
        }


        event.target.value =
          '';
      };
  }


  bindClick(
    'pdfBtn',
    printCurrent
  );


  bindChange(
    'importFile',
    readImportFile
  );


  bindChange(
    'importSheet',

    () => {

      importSheetName =
        $('importSheet').value;


      importMapping =
        {};


      importMappingMode =
        '';


      importRows =
        [];


      readSelectedSheet();


      if (
        $('commitImportBtn')
      ) {

        $('commitImportBtn')
          .disabled =
            true;
      }


      $('importMappingCard')
        ?.classList
        .add(
          'hidden'
        );
    }
  );


  bindChange(
    'importMode',

    () => {

      importMapping =
        {};


      importMappingMode =
        '';


      importRows =
        [];


      if (
        $('commitImportBtn')
      ) {

        $('commitImportBtn')
          .disabled =
            true;
      }


      $('importMappingCard')
        ?.classList
        .add(
          'hidden'
        );
    }
  );


  bindChange(
    'importMatrixTarget',
    () => {

      importMatrixTargetId =
        $('importMatrixTarget')
          ?.value ||
        'new';


      if (
        $('importMatrixName')
      ) {

        $('importMatrixName')
          .disabled =
            importMatrixTargetId !==
            'new';
      }
    }
  );


  bindClick(
    'analyzeImportBtn',
    analyzeImport
  );


  bindClick(
    'commitImportBtn',
    commitImport
  );


  bindClick(
    'rollbackImportBtn',
    rollbackLastImport
  );


  bindClick(
    'clearProjectBtn',

    async () => {

      if (
        !confirm(
          'Очистить рабочие данные?\n\n' +
          'Перед очисткой будет создана локальная защитная копия. ' +
          'Справочники зданий, видов работ и организаций останутся.'
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


      const currentOrganizations =
        clone(
          project.organizations ||
          []
        );


      const currentBuildings =
        clone(
          project.buildings ||
          []
        );


      const currentWorks =
        clone(
          project.works ||
          []
        );


      const currentCustomSections =
        clone(
          project.customSections ||
          []
        );


      const fresh =
        emptyProject();


      fresh.organizations =
        currentOrganizations;


      fresh.buildings =
        currentBuildings;


      fresh.works =
        currentWorks;


      fresh.customSections =
        currentCustomSections;


      project =
        fresh;


      log(
        'Очищено',
        'Проект',

        'Рабочие данные очищены. Справочники и пользовательские разделы сохранены.',

        {
          backupKey
        }
      );


      await saveProject();


      if (
        typeof resourceSelectedIds !==
        'undefined'
      ) {

        resourceSelectedIds
          .clear();
      }


      initSelects();


      if (
        typeof resetMultiFilter ===
        'function'
      ) {

        [
          'rOrg',
          'rBuilding',
          'rWork',
          'rFront'
        ]
          .forEach(
            id =>
              resetMultiFilter(
                id,
                false
              )
          );
      }


      renderAll();


      alert(
        'Рабочие данные очищены. Защитная копия сохранена локально.'
      );
    }
  );
}


/* =========================================================
   ДАТЫ ПО УМОЛЧАНИЮ
   ========================================================= */


async function initDefaultDates() {

  if (
    typeof syncTrustedToday ===
      'function'
  ) {
    await syncTrustedToday();
  }


  const currentDate =
    today();


  if (
    $('pfTo') &&
    !$('pfTo').value
  ) {

    $('pfTo').value =
      currentDate;
  }


  if (
    $('rTo') &&
    !$('rTo').value
  ) {

    $('rTo').value =
      currentDate;
  }


  if (
    $('rDailyDate') &&
    !$('rDailyDate').value
  ) {

    $('rDailyDate').value =
      currentDate;
  }
}


/* =========================================================
   ПРОВЕРКА СТРУКТУРЫ ЗАГРУЖЕННОГО ПРОЕКТА
   ========================================================= */


function validateLoadedProject() {

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
    'planLog',
    'factLog',
    'progressFacts',
    'resources',
    'resourcePlans',
    'milestones',
    'numberedElementGroups',
    'numberedElements',
    'workMetrics',
    'sourceMappings',
    'entityAliases',
    'networkSegments',
    'reportSnapshots',
    'schemes',
    'schemeMarks',
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
    'demolition',
    'customSections'
  ];


  arrays.forEach(
    key => {

      if (
        !Array.isArray(
          project[
            key
          ]
        )
      ) {

        project[
          key
        ] =
          [];
      }
    }
  );
}


/* =========================================================
   ЗАПУСК
   ========================================================= */


async function init() {

  db =
    await openDb();


  const raw =
    await dbGetKey();


  const localProject =
    await migrateIfNeeded(
      raw
    );


  project =
    localProject;


  validateLoadedProject();


  /*
    Интерфейс должен быть рабочим сразу.
    Supabase не блокирует переключение вкладок.
  */

  initSelects();


  if (
    typeof initResourceMultiFilters ===
      'function'
  ) {

    initResourceMultiFilters();
  }


  bindUi();


  await initDefaultDates();


  ensureExcelButton();


  rebuildCustomSections();


  ensureUnifiedPanelPresentation();


  if (
    typeof renderBackupNotice ===
      'function'
  ) {

    renderBackupNotice();
  }


  if (
    $('rShowZero')
  ) {

    $('rShowZero').checked =
      Boolean(
        cfg(
          'SHOW_ZERO_ORGANIZATIONS_BY_DEFAULT',
          false
        )
      );
  }


  renderAll();


  async function applyRemoteState(
    remoteState
  ) {

    if (
      !remoteState?.project
    ) {
      return;
    }


    project =
      await migrateIfNeeded(
        remoteState.project
      );


    validateLoadedProject();


    await dbPutKey(
      project
    );


    initSelects();


    if (
      typeof refreshAllMultiFilters ===
        'function'
    ) {

      refreshAllMultiFilters();
    }


    renderAll();
    window.LIV_PROJECT_READY = true;
    window.dispatchEvent(new CustomEvent('liv-project-ready'));
  }


  if (
    window.LIV_REMOTE_SYNC &&
    typeof window.LIV_REMOTE_SYNC.bootstrap ===
      'function'
  ) {

    try {

      const remoteState =
        await window.LIV_REMOTE_SYNC.bootstrap(
          localProject
        );


      await applyRemoteState(
        remoteState
      );


      window.LIV_REMOTE_SYNC
        .subscribe?.();

    } catch (
      error
    ) {

      console.error(
        'LIV Supabase: startup sync failed',
        error
      );
    }
  }


  if (
    !raw ||
    raw.schemaVersion !==
      SCHEMA_VERSION
  ) {

    await saveProject();
  }


  window.addEventListener(
    'liv-remote-project',
    async event => {

      const incoming =
        event?.detail?.project;


      if (
        !incoming
      ) {
        return;
      }


      try {

        window.LIV_REMOTE_SYNC
          ?.beginRemoteApply?.();


        await applyRemoteState({
          project:
            incoming
        });

      } finally {

        window.LIV_REMOTE_SYNC
          ?.endRemoteApply?.();
      }
    }
  );


  window.addEventListener(
    'liv-auth-session',
    async event => {

      const signedIn =
        Boolean(
          event?.detail?.signedIn
        );


      if (
        !window.LIV_REMOTE_SYNC
      ) {
        return;
      }


      if (
        !signedIn
      ) {

        window.LIV_REMOTE_SYNC
          .disconnect?.();

        return;
      }


      try {

        const state =
          await window.LIV_REMOTE_SYNC
            .reconnect?.(
              project
            );


        await applyRemoteState(
          state
        );

      } catch (
        error
      ) {

        console.error(
          'LIV Supabase: relogin sync failed',
          error
        );
      }
    }
  );
}

/* =========================================================
   DOM READY
   ========================================================= */


document.addEventListener(
  'DOMContentLoaded',

  () => {

    init()
      .catch(
        error => {

          console.error(
            'LIV Planning startup error:',
            error
          );


          alert(
            `Ошибка запуска LIV Planning:\n${
              error?.message ||
              String(
                error
              )
            }`
          );
        }
      );
  }
);
