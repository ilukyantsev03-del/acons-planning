'use strict';

/* =========================================================
   LIV PLANNING
   Главный запуск приложения

   Этот файл:
   - сразу подключает переключение вкладок;
   - запускает IndexedDB отдельно;
   - не блокирует интерфейс, если один модуль дал ошибку;
   - связывает Ресурсы, Организации, Импорт;
   - управляет резервной копией и модальным окном.
   ========================================================= */


/* =========================================================
   БЕЗОПАСНЫЙ ВЫЗОВ ФУНКЦИИ
   ========================================================= */

LIV.safeCall = function (
  functionName,
  ...args
) {

  try {

    const fn =
      LIV[
        functionName
      ];


    if (
      typeof fn ===
      'function'
    ) {
      return fn(
        ...args
      );
    }

  } catch (error) {

    console.error(
      `Ошибка в ${functionName}:`,
      error
    );
  }


  return null;
};


/* =========================================================
   МОДАЛЬНОЕ ОКНО
   ========================================================= */

LIV.openModal = function (
  title,
  html
) {

  const modal =
    LIV.$(
      'modal'
    );


  const modalTitle =
    LIV.$(
      'modalTitle'
    );


  const modalBody =
    LIV.$(
      'modalBody'
    );


  if (
    !modal ||
    !modalTitle ||
    !modalBody
  ) {
    return;
  }


  modalTitle.textContent =
    title ||
    'Редактор';


  modalBody.innerHTML =
    html ||
    '';


  modal.classList.remove(
    'hidden'
  );
};


LIV.closeModal = function () {

  const modal =
    LIV.$(
      'modal'
    );


  if (!modal) {
    return;
  }


  modal.classList.add(
    'hidden'
  );


  const modalBody =
    LIV.$(
      'modalBody'
    );


  if (
    modalBody
  ) {
    modalBody.innerHTML =
      '';
  }
};


/* =========================================================
   ОСНОВНЫЕ ВКЛАДКИ
   ========================================================= */

LIV.switchTab = function (
  tabName
) {

  if (
    !tabName
  ) {
    return;
  }


  /* -------------------------------------------------------
     КНОПКИ
     ------------------------------------------------------- */

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.tab ===
            tabName
        );
      }
    );


  /* -------------------------------------------------------
     СЕКЦИИ
     ------------------------------------------------------- */

  document
    .querySelectorAll(
      '.panel'
    )
    .forEach(
      panel => {

        panel.classList.add(
          'hidden'
        );
      }
    );


  const target =
    LIV.$(
      `tab-${tabName}`
    );


  if (
    !target
  ) {

    console.warn(
      `Вкладка tab-${tabName} не найдена`
    );

    return;
  }


  target.classList.remove(
    'hidden'
  );


  /* -------------------------------------------------------
     ОТРИСОВКА ОТКРЫТОЙ ВКЛАДКИ

     Ошибка одного модуля не должна ломать
     само переключение вкладок.
     ------------------------------------------------------- */

  try {

    LIV.renderTab(
      tabName
    );

  } catch (error) {

    console.error(
      `Ошибка отрисовки вкладки ${tabName}:`,
      error
    );
  }
};


/* =========================================================
   ОТРИСОВКА КОНКРЕТНОЙ ВКЛАДКИ
   ========================================================= */

LIV.renderTab = function (
  tabName
) {

  if (
    !LIV.project
  ) {
    return;
  }


  switch (
    tabName
  ) {

    case 'dashboard':

      LIV.safeCall(
        'renderDashboard'
      );

      break;


    case 'resources':

      LIV.safeCall(
        'renderResources'
      );

      break;


    case 'organizations':

      LIV.safeCall(
        'renderOrganizations'
      );

      break;


    case 'history':

      LIV.safeCall(
        'renderHistory'
      );

      break;


    case 'settings':

      LIV.safeCall(
        'renderSystemInfo'
      );

      break;


    /*
       Шахматка, Гант, План/факт,
       Ключевые даты, Номерные элементы,
       Демонтаж пока представлены
       временными секциями index.html.

       Поэтому здесь им пока
       не требуется отдельный render.
    */

    case 'matrix':
    case 'gantt':
    case 'planfact':
    case 'milestones':
    case 'elements':
    case 'demolition':
    case 'import':

      break;


    default:

      console.warn(
        `Неизвестная вкладка: ${tabName}`
      );
  }
};


/* =========================================================
   СВОДКА
   ========================================================= */

LIV.renderDashboard = function () {

  if (
    !LIV.project
  ) {
    return;
  }


  const fronts =
    Array.isArray(
      LIV.project.fronts
    )
      ? LIV.project.fronts
      : [];


  const resources =
    Array.isArray(
      LIV.project.resources
    )
      ? LIV.project.resources
      : [];


  const today =
    LIV.today();


  const normalizedStatus =
    function (
      value
    ) {

      return LIV.normKey(
        value
      );
    };


  const isDone =
    function (
      front
    ) {

      const status =
        normalizedStatus(
          front.status
        );


      return (
        status.includes(
          'заверш'
        ) ||
        status.includes(
          'выполн'
        ) ||
        status.includes(
          'готов'
        )
      );
    };


  const isAccepted =
    function (
      front
    ) {

      const status =
        normalizedStatus(
          front.acceptanceStatus ||
          front.statusAcceptance ||
          ''
        );


      return (
        status.includes(
          'сдан'
        ) ||
        status.includes(
          'принят'
        ) ||
        status.includes(
          'освидетельств'
        )
      );
    };


  const isWork =
    function (
      front
    ) {

      const status =
        normalizedStatus(
          front.status
        );


      return (
        status.includes(
          'работ'
        ) ||
        status.includes(
          'процесс'
        )
      );
    };


  const isLate =
    function (
      front
    ) {

      if (
        isDone(
          front
        )
      ) {
        return false;
      }


      const end =
        front.planEnd ||
        front.baselineEnd ||
        front.contractEnd ||
        '';


      return (
        end &&
        end <
        today
      );
    };


  const hasConstraint =
    function (
      front
    ) {

      if (
        front.constraint ||
        front.restriction ||
        front.hasConstraint ===
          true
      ) {
        return true;
      }


      return (
        LIV.project.constraints ||
        []
      )
        .some(
          constraint => {

            return (
              String(
                constraint.frontId ||
                ''
              ) ===
                String(
                  front.id ||
                  ''
                ) &&
              LIV.normKey(
                constraint.status
              ) !==
                'закрыто'
            );
          }
        );
    };


  if (
    LIV.$(
      'dTotal'
    )
  ) {
    LIV.$(
      'dTotal'
    ).textContent =
      fronts.length;
  }


  if (
    LIV.$(
      'dWork'
    )
  ) {
    LIV.$(
      'dWork'
    ).textContent =
      fronts.filter(
        isWork
      ).length;
  }


  if (
    LIV.$(
      'dDone'
    )
  ) {
    LIV.$(
      'dDone'
    ).textContent =
      fronts.filter(
        isDone
      ).length;
  }


  if (
    LIV.$(
      'dAccepted'
    )
  ) {
    LIV.$(
      'dAccepted'
    ).textContent =
      fronts.filter(
        isAccepted
      ).length;
  }


  if (
    LIV.$(
      'dLate'
    )
  ) {
    LIV.$(
      'dLate'
    ).textContent =
      fronts.filter(
        isLate
      ).length;
  }


  if (
    LIV.$(
      'dRisk'
    )
  ) {
    LIV.$(
      'dRisk'
    ).textContent =
      fronts.filter(
        hasConstraint
      ).length;
  }


  /* =======================================================
     КРИТИЧНЫЕ ФРОНТЫ
     ======================================================= */

  const critical =
    fronts
      .filter(
        front =>
          isLate(
            front
          ) ||
          hasConstraint(
            front
          )
      )
      .slice(
        0,
        15
      );


  const criticalContainer =
    LIV.$(
      'dCritical'
    );


  if (
    criticalContainer
  ) {

    if (
      !critical.length
    ) {

      criticalContainer.innerHTML = `
        <div class="muted">
          Критичные фронты не найдены.
        </div>
      `;

    } else {

      criticalContainer.innerHTML =
        critical
          .map(
            front => {

              const end =
                front.planEnd ||
                front.baselineEnd ||
                front.contractEnd ||
                '';


              return `
                <div class="organization-work-item">

                  <strong>
                    ${LIV.esc(
                      LIV.getFrontLabel(
                        front
                      )
                    )}
                  </strong>

                  <div class="muted">
                    ${
                      end
                        ? `Срок: ${LIV.ruDate(end)}`
                        : 'Срок не указан'
                    }
                  </div>

                </div>
              `;
            }
          )
          .join('');
    }
  }


  /* =======================================================
     ТЕКУЩИЕ РЕСУРСЫ
     ======================================================= */

  const resourceDates =
    LIV.unique(
      resources
        .map(
          row =>
            row.date
        )
        .filter(
          Boolean
        )
    )
      .sort();


  const latestDate =
    resourceDates.length
      ? resourceDates[
          resourceDates.length -
          1
        ]
      : null;


  const latestRows =
    latestDate
      ? resources.filter(
          row =>
            row.date ===
            latestDate
        )
      : [];


  const peopleTotal =
    latestRows.reduce(
      (
        total,
        row
      ) => {

        if (
          typeof LIV.getResourcePeopleTotal ===
          'function'
        ) {
          return (
            total +
            LIV.getResourcePeopleTotal(
              row
            )
          );
        }


        return (
          total +
          LIV.num(
            row.itr
          ) +
          LIV.num(
            row.workers
          ) +
          LIV.num(
            row.mechanizers
          )
        );
      },
      0
    );


  const equipmentTotal =
    latestRows.reduce(
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


  const resourceContainer =
    LIV.$(
      'dResources'
    );


  if (
    resourceContainer
  ) {

    resourceContainer.innerHTML = `
      ${
        latestDate
          ? `
            <div class="muted">
              Данные на
              ${LIV.ruDate(
                latestDate
              )}
            </div>
          `
          : `
            <div class="muted">
              Данные ресурсов пока отсутствуют.
            </div>
          `
      }

      <div style="margin-top:10px;">
        <strong>
          Людей:
          ${LIV.roundInt(
            peopleTotal
          )}
        </strong>
      </div>

      <div style="margin-top:6px;">
        <strong>
          Техники:
          ${LIV.roundInt(
            equipmentTotal
          )}
        </strong>
      </div>
    `;
  }
};


/* =========================================================
   ИСТОРИЯ
   ========================================================= */

LIV.renderHistory = function () {

  const body =
    LIV.$(
      'historyBody'
    );


  if (
    !body ||
    !LIV.project
  ) {
    return;
  }


  const history =
    Array.isArray(
      LIV.project.history
    )
      ? LIV.project.history
      : [];


  body.innerHTML =
    history
      .slice(
        0,
        1000
      )
      .map(
        item => {

          let date =
            '';


          if (
            item.at
          ) {

            const value =
              new Date(
                item.at
              );


            if (
              !Number.isNaN(
                value.getTime()
              )
            ) {
              date =
                value.toLocaleString(
                  'ru-RU'
                );
            }
          }


          return `
            <tr>

              <td>
                ${LIV.esc(
                  date
                )}
              </td>

              <td>
                ${LIV.esc(
                  item.action ||
                  ''
                )}
              </td>

              <td>
                ${LIV.esc(
                  item.entity ||
                  ''
                )}
              </td>

              <td>
                ${LIV.esc(
                  item.description ||
                  ''
                )}
              </td>

            </tr>
          `;
        }
      )
      .join('');
};


/* =========================================================
   О СИСТЕМЕ
   ========================================================= */

LIV.renderSystemInfo = function () {

  const container =
    LIV.$(
      'systemInfo'
    );


  if (
    !container
  ) {
    return;
  }


  const lastBackup =
    LIV.project
      ?.meta
      ?.lastBackupAt;


  let lastBackupText =
    'не создавалась';


  if (
    lastBackup
  ) {

    const date =
      new Date(
        lastBackup
      );


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      lastBackupText =
        date.toLocaleString(
          'ru-RU'
        );
    }
  }


  container.innerHTML = `
    <div class="form-grid">

      <div>
        <div class="muted">
          Название
        </div>

        <strong>
          LIV Planning
        </strong>
      </div>


      <div>
        <div class="muted">
          Назначение
        </div>

        <strong>
          Система производственного планирования
          и контроля строительства
        </strong>
      </div>


      <div>
        <div class="muted">
          Структура данных
        </div>

        <strong>
          ${LIV.esc(
            LIV.SCHEMA_VERSION
          )}
        </strong>
      </div>


      <div>
        <div class="muted">
          Локальная база
        </div>

        <strong>
          ${LIV.esc(
            LIV.DB_NAME
          )}
        </strong>
      </div>


      <div>
        <div class="muted">
          Версия IndexedDB
        </div>

        <strong>
          ${LIV.DB_VERSION}
        </strong>
      </div>


      <div>
        <div class="muted">
          Последняя резервная копия
        </div>

        <strong>
          ${LIV.esc(
            lastBackupText
          )}
        </strong>
      </div>

    </div>
  `;
};


/* =========================================================
   СКАЧИВАНИЕ ФАЙЛА
   ========================================================= */

LIV.downloadBlob = function (
  content,
  filename,
  type =
    'application/octet-stream'
) {

  const blob =
    new Blob(
      [
        content
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
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );
};


/* =========================================================
   СОХРАНЕНИЕ ПРОЕКТА В JSON
   ========================================================= */

LIV.exportProjectBackup = async function () {

  if (
    !LIV.project
  ) {
    alert(
      'Проект еще не загружен.'
    );

    return;
  }


  LIV.project.meta =
    LIV.project.meta ||
    {};


  LIV.project.meta.lastBackupAt =
    LIV.nowIso();


  try {

    if (
      typeof LIV.saveProject ===
      'function'
    ) {
      await LIV.saveProject();
    }

  } catch (error) {

    console.error(
      'Ошибка сохранения отметки резервной копии:',
      error
    );
  }


  const stamp =
    LIV.nowIso()
      .replace(
        /[:.]/g,
        '-'
      );


  const json =
    JSON.stringify(
      LIV.project,
      null,
      2
    );


  LIV.downloadBlob(
    json,
    `LIV-Planning-backup-${stamp}.json`,
    'application/json'
  );


  LIV.renderSystemInfo();
};


/* =========================================================
   ЗАГРУЗКА ПРОЕКТА ИЗ JSON
   ========================================================= */

LIV.restoreProjectFromFile = async function (
  file
) {

  if (
    !file
  ) {
    return;
  }


  let data;


  try {

    data =
      JSON.parse(
        await file.text()
      );

  } catch (error) {

    alert(
      'Не удалось прочитать JSON-файл.'
    );

    return;
  }


  if (
    !data ||
    typeof data !==
      'object'
  ) {

    alert(
      'Выбранный файл не похож на резервную копию LIV Planning.'
    );

    return;
  }


  const approved =
    confirm(
      'Загрузить выбранный проект?\n\n' +
      'Перед заменой текущих данных будет создана ' +
      'локальная резервная копия.'
    );


  if (
    !approved
  ) {
    return;
  }


  try {

    if (
      typeof LIV.createLocalBackup ===
      'function' &&
      LIV.project
    ) {
      await LIV.createLocalBackup(
        'pre-restore'
      );
    }


    LIV.project =
      LIV.normalizeProject(
        data
      );


    LIV.log(
      'Восстановление проекта',
      'Проект',
      file.name ||
      'JSON'
    );


    await LIV.saveProject();


    LIV.refreshAll();


    alert(
      'Проект загружен.'
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      'Не удалось загрузить проект.\n\n' +
      (
        error?.message ||
        String(error)
      )
    );
  }
};


/* =========================================================
   СРАВНЕНИЕ ПРОЕКТОВ
   ========================================================= */

LIV.compareProjectWithFile = async function (
  file
) {

  if (
    !file
  ) {
    return;
  }


  if (
    !LIV.project
  ) {
    alert(
      'Текущий проект еще не загружен.'
    );

    return;
  }


  let other;


  try {

    other =
      JSON.parse(
        await file.text()
      );


    other =
      LIV.normalizeProject(
        other
      );

  } catch (error) {

    alert(
      'Не удалось прочитать файл сравнения.'
    );

    return;
  }


  const sections = [
    {
      key:
        'fronts',

      name:
        'Фронты'
    },

    {
      key:
        'resources',

      name:
        'Ресурсы'
    },

    {
      key:
        'resourcePlans',

      name:
        'Планы ресурсов'
    },

    {
      key:
        'milestones',

      name:
        'Ключевые даты'
    },

    {
      key:
        'organizations',

      name:
        'Организации'
    },

    {
      key:
        'contracts',

      name:
        'Договоры'
    },

    {
      key:
        'constraints',

      name:
        'Ограничения'
    }
  ];


  const rows =
    sections
      .map(
        section => {

          const currentCount =
            Array.isArray(
              LIV.project[
                section.key
              ]
            )
              ? LIV.project[
                  section.key
                ].length
              : 0;


          const otherCount =
            Array.isArray(
              other[
                section.key
              ]
            )
              ? other[
                  section.key
                ].length
              : 0;


          const difference =
            currentCount -
            otherCount;


          return `
            <tr>

              <td>
                ${LIV.esc(
                  section.name
                )}
              </td>

              <td>
                ${currentCount}
              </td>

              <td>
                ${otherCount}
              </td>

              <td>
                ${
                  difference > 0
                    ? '+'
                    : ''
                }${difference}
              </td>

            </tr>
          `;
        }
      )
      .join('');


  LIV.openModal(
    'Сравнение проектов',

    `
      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>
                Раздел
              </th>

              <th>
                Текущий проект
              </th>

              <th>
                Выбранный файл
              </th>

              <th>
                Разница
              </th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>
    `
  );
};


/* =========================================================
   PDF
   ========================================================= */

LIV.printCurrentView = function () {

  window.print();
};


/* =========================================================
   УСТАНОВКА ДАТ РЕСУРСОВ
   ========================================================= */

LIV.setInitialResourceDates = function () {

  if (
    !LIV.project
  ) {
    return;
  }


  const rows =
    Array.isArray(
      LIV.project.resources
    )
      ? LIV.project.resources
      : [];


  const dates =
    LIV.unique(
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


  const firstDate =
    dates.length
      ? dates[0]
      : LIV.today();


  const lastDate =
    dates.length
      ? dates[
          dates.length -
          1
        ]
      : LIV.today();


  const from =
    LIV.$(
      'resourceFrom'
    );


  const to =
    LIV.$(
      'resourceTo'
    );


  const daily =
    LIV.$(
      'resourceDailyDate'
    );


  if (
    from &&
    !from.value
  ) {
    from.value =
      firstDate;
  }


  if (
    to &&
    !to.value
  ) {
    to.value =
      lastDate;
  }


  if (
    daily &&
    !daily.value
  ) {
    daily.value =
      lastDate;
  }
};


/* =========================================================
   ОБЩАЯ ПЕРЕРИСОВКА
   ========================================================= */

LIV.refreshAll = function () {

  if (
    !LIV.project
  ) {
    return;
  }


  LIV.safeCall(
    'refreshResourceFilters'
  );


  LIV.safeCall(
    'renderDashboard'
  );


  LIV.safeCall(
    'renderResources'
  );


  LIV.safeCall(
    'renderOrganizations'
  );


  LIV.safeCall(
    'renderHistory'
  );


  LIV.safeCall(
    'renderSystemInfo'
  );
};


/* =========================================================
   ПРИВЯЗКА ОСНОВНЫХ КНОПОК

   ВАЖНО:
   ЭТО ДЕЛАЕТСЯ ДО ЗАГРУЗКИ INDEXEDDB.
   ПОЭТОМУ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК РАБОТАЕТ
   ДАЖЕ ЕСЛИ БАЗА ИЛИ ОДИН МОДУЛЬ ДАЛ ОШИБКУ.
   ========================================================= */

LIV.bindGlobalEvents = function () {

  /* -------------------------------------------------------
     ВКЛАДКИ
     ------------------------------------------------------- */

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button => {

        button.onclick =
          function () {

            const tabName =
              this.dataset.tab;


            LIV.switchTab(
              tabName
            );
          };
      }
    );


  /* -------------------------------------------------------
     ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
     ------------------------------------------------------- */

  const closeButton =
    LIV.$(
      'modalClose'
    );


  if (
    closeButton
  ) {
    closeButton.onclick =
      LIV.closeModal;
  }


  const modal =
    LIV.$(
      'modal'
    );


  if (
    modal
  ) {

    modal.onclick =
      function (
        event
      ) {

        if (
          event.target ===
          modal
        ) {
          LIV.closeModal();
        }
      };
  }


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Escape'
      ) {
        LIV.closeModal();
      }
    }
  );


  /* -------------------------------------------------------
     РЕЗЕРВНАЯ КОПИЯ
     ------------------------------------------------------- */

  const backup =
    LIV.$(
      'backupBtn'
    );


  if (
    backup
  ) {
    backup.onclick =
      LIV.exportProjectBackup;
  }


  /* -------------------------------------------------------
     ЗАГРУЗКА ПРОЕКТА
     ------------------------------------------------------- */

  const restore =
    LIV.$(
      'restoreInput'
    );


  if (
    restore
  ) {

    restore.onchange =
      async function (
        event
      ) {

        const file =
          event.target
            .files?.[0];


        await LIV.restoreProjectFromFile(
          file
        );


        event.target.value =
          '';
      };
  }


  /* -------------------------------------------------------
     СРАВНЕНИЕ
     ------------------------------------------------------- */

  const compare =
    LIV.$(
      'compareInput'
    );


  if (
    compare
  ) {

    compare.onchange =
      async function (
        event
      ) {

        const file =
          event.target
            .files?.[0];


        await LIV.compareProjectWithFile(
          file
        );


        event.target.value =
          '';
      };
  }


  /* -------------------------------------------------------
     PDF
     ------------------------------------------------------- */

  const pdf =
    LIV.$(
      'pdfBtn'
    );


  if (
    pdf
  ) {
    pdf.onclick =
      LIV.printCurrentView;
  }
};


/* =========================================================
   ПРИВЯЗКА МОДУЛЕЙ
   ========================================================= */

LIV.bindModules = function () {

  LIV.safeCall(
    'bindResourceEvents'
  );


  LIV.safeCall(
    'bindOrganizationEvents'
  );


  LIV.safeCall(
    'bindImportEvents'
  );
};


/* =========================================================
   АВАРИЙНОЕ СОЗДАНИЕ ПУСТОГО ПРОЕКТА

   Используется только если загрузка IndexedDB дала ошибку.
   Саму базу при этом НЕ очищаем.
   ========================================================= */

LIV.createRuntimeFallbackProject = function () {

  try {

    LIV.project =
      LIV.emptyProject();

  } catch (error) {

    console.error(
      'Не удалось создать резервный проект в памяти:',
      error
    );


    LIV.project = {
      schemaVersion:
        '2.3.0',

      meta: {
        projectName:
          'LIV Planning'
      },

      buildings: [],
      organizations: [],
      works: [],
      structures: [],
      fronts: [],
      planLog: [],
      factLog: [],
      resources: [],
      resourcePlans: [],
      milestones: [],
      numberedElements: [],
      demolition: [],
      contracts: [],
      constraints: [],
      diagrams: [],
      diagramMarks: [],
      scheduleVersions: [],
      customFields: [],
      views: [],
      importProfiles: [],
      importHistory: [],
      history: []
    };
  }
};


/* =========================================================
   ЗАПУСК ДАННЫХ
   ========================================================= */

LIV.initializeData = async function () {

  try {

    await LIV.loadProject();


    console.log(
      'LIV Planning: проект загружен',
      LIV.project
    );

  } catch (error) {

    console.error(
      'Ошибка загрузки IndexedDB:',
      error
    );


    /*
       ВАЖНО:
       НЕ удаляем IndexedDB.
       НЕ повышаем и НЕ понижаем ее версию.
       Просто даем интерфейсу возможность работать.
    */

    LIV.createRuntimeFallbackProject();


    console.warn(
      'LIV Planning запущен с временным пустым проектом в памяти. ' +
      'Исходная IndexedDB не изменена.'
    );
  }


  LIV.setInitialResourceDates();


  try {

    LIV.initResourceFilters();

  } catch (error) {

    console.error(
      'Ошибка создания фильтров ресурсов:',
      error
    );
  }


  LIV.bindModules();


  LIV.refreshAll();


  LIV.switchTab(
    'dashboard'
  );
};


/* =========================================================
   ОСНОВНОЙ ЗАПУСК
   ========================================================= */

LIV.start = function () {

  /*
     Сначала включаем интерфейс.
     Кнопки вкладок после этого уже должны работать.
  */

  LIV.bindGlobalEvents();


  /*
     Затем отдельно загружаем данные.
     Ошибка IndexedDB уже не способна
     отключить навигацию.
  */

  LIV.initializeData()
    .catch(
      error => {

        console.error(
          'Критическая ошибка инициализации:',
          error
        );
      }
    );
};


/* =========================================================
   ЗАПУСК ПОСЛЕ ГОТОВНОСТИ DOM
   ========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    LIV.start,
    {
      once: true
    }
  );

} else {

  LIV.start();
}