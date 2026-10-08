'use strict';

/* =========================================================
   LIV PLANNING
   Главный запуск модульной версии приложения
   ========================================================= */


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
    console.warn(
      'Модальное окно не найдено в index.html'
    );

    return;
  }


  modalTitle.textContent =
    title || 'Редактор';


  modalBody.innerHTML =
    html || '';


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


  const body =
    LIV.$(
      'modalBody'
    );


  if (body) {
    body.innerHTML =
      '';
  }
};


/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ОСНОВНЫХ ВКЛАДОК
   ========================================================= */

LIV.switchTab = function (
  tabName
) {

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


  LIV.$(
    `tab-${tabName}`
  )
    ?.classList
    .remove(
      'hidden'
    );


  LIV.renderTab(
    tabName
  );
};


/* =========================================================
   ОТРИСОВКА ВКЛАДКИ
   ========================================================= */

LIV.renderTab = function (
  tabName
) {

  switch (
    tabName
  ) {

    case 'dashboard':

      LIV.renderDashboard();

      break;


    case 'resources':

      if (
        typeof LIV.renderResources ===
        'function'
      ) {
        LIV.renderResources();
      }

      break;


    case 'organizations':

      if (
        typeof LIV.renderOrganizations ===
        'function'
      ) {
        LIV.renderOrganizations();
      }

      break;


    case 'history':

      LIV.renderHistory();

      break;


    case 'settings':

      LIV.renderSystemInfo();

      break;


    default:

      /*
         Остальные старые модули пока
         продолжают жить в старом app.js.

         Новый модульный app.js пока
         их не переписывает.
      */

      break;
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
    LIV.project.fronts ||
    [];


  const resources =
    LIV.project.resources ||
    [];


  const today =
    LIV.today();


  const normalizedStatus =
    value =>
      LIV.normKey(
        value
      );


  const isDone =
    front => {

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
    front => {

      const status =
        normalizedStatus(
          front.acceptanceStatus ||
          front.statusAcceptance ||
          front.status
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
    front => {

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
    front => {

      if (
        isDone(front)
      ) {
        return false;
      }


      const target =
        front.planEnd ||
        front.baselineEnd ||
        front.contractEnd ||
        '';


      return (
        target &&
        target <
        today
      );
    };


  const hasConstraint =
    front => {

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
          constraint =>
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


  /* -------------------------------------------------------
     КРИТИЧНЫЕ ФРОНТЫ
     ------------------------------------------------------- */

  const critical =
    fronts
      .filter(
        front =>
          isLate(front) ||
          hasConstraint(front)
      )
      .slice(
        0,
        15
      );


  if (
    LIV.$(
      'dCritical'
    )
  ) {

    if (
      !critical.length
    ) {
      LIV.$(
        'dCritical'
      ).innerHTML = `
        <div class="muted">
          Критичные фронты не найдены.
        </div>
      `;
    } else {

      LIV.$(
        'dCritical'
      ).innerHTML =
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


  /* -------------------------------------------------------
     ТЕКУЩИЕ РЕСУРСЫ

     Берем последнюю дату, по которой
     вообще есть ресурсный отчет.
     ------------------------------------------------------- */

  const resourceDates =
    LIV.unique(
      resources
        .map(
          row =>
            row.date
        )
        .filter(Boolean)
    )
      .sort();


  const latestDate =
    resourceDates.at(-1) ||
    null;


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
      ) =>
        total +
        (
          typeof LIV.getResourcePeopleTotal ===
          'function'
            ? LIV.getResourcePeopleTotal(
                row
              )
            : (
                LIV.num(row.itr) +
                LIV.num(row.workers) +
                LIV.num(row.mechanizers)
              )
        ),
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


  if (
    LIV.$(
      'dResources'
    )
  ) {
    LIV.$(
      'dResources'
    ).innerHTML = `
      ${
        latestDate
          ? `
            <div class="muted">
              Данные на ${LIV.ruDate(latestDate)}
            </div>
          `
          : ''
      }

      <div style="margin-top: 10px;">
        <strong>
          Людей:
          ${LIV.roundInt(peopleTotal)}
        </strong>
      </div>

      <div style="margin-top: 6px;">
        <strong>
          Техники:
          ${LIV.roundInt(equipmentTotal)}
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


  if (!body) {
    return;
  }


  const history =
    LIV.project.history ||
    [];


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

            const parsed =
              new Date(
                item.at
              );


            if (
              !Number.isNaN(
                parsed.getTime()
              )
            ) {
              date =
                parsed.toLocaleString(
                  'ru-RU'
                );
            }
          }


          return `
            <tr>

              <td>
                ${LIV.esc(date)}
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


  if (!container) {
    return;
  }


  const lastBackup =
    LIV.project.meta
      ?.lastBackupAt;


  let lastBackupText =
    'не создавалась';


  if (
    lastBackup
  ) {

    const parsed =
      new Date(
        lastBackup
      );


    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      lastBackupText =
        parsed.toLocaleString(
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
  type
) {

  const blob =
    new Blob(
      [content],
      {
        type:
          type ||
          'application/octet-stream'
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
   РЕЗЕРВНАЯ КОПИЯ ПРОЕКТА В JSON
   ========================================================= */

LIV.exportProjectBackup = async function () {

  if (
    !LIV.project
  ) {
    return;
  }


  LIV.project.meta.lastBackupAt =
    LIV.nowIso();


  await LIV.saveProject();


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
   ВОССТАНОВЛЕНИЕ ПРОЕКТА ИЗ JSON
   ========================================================= */

LIV.restoreProjectFromFile = async function (
  file
) {

  if (!file) {
    return;
  }


  const text =
    await file.text();


  let data;


  try {

    data =
      JSON.parse(
        text
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
      'Файл не похож на резервную копию проекта.'
    );

    return;
  }


  const approved =
    confirm(
      'Загрузить этот проект?\n\n' +
      'Перед заменой текущего проекта будет создана ' +
      'локальная резервная копия.'
    );


  if (!approved) {
    return;
  }


  await LIV.createLocalBackup(
    'pre-restore'
  );


  LIV.project =
    LIV.normalizeProject(
      data
    );


  LIV.log(
    'Восстановление проекта',
    'Проект',
    file.name || 'JSON'
  );


  await LIV.saveProject();


  LIV.refreshAll();


  alert(
    'Проект загружен.'
  );
};


/* =========================================================
   СРАВНЕНИЕ С ДРУГОЙ КОПИЕЙ
   ========================================================= */

LIV.compareProjectWithFile = async function (
  file
) {

  if (!file) {
    return;
  }


  let other;


  try {

    other =
      JSON.parse(
        await file.text()
      );

  } catch (error) {

    alert(
      'Не удалось прочитать файл сравнения.'
    );

    return;
  }


  other =
    LIV.normalizeProject(
      other
    );


  const current =
    LIV.project;


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
    sections.map(
      section => {

        const currentCount =
          (
            current[
              section.key
            ] ||
            []
          ).length;


        const otherCount =
          (
            other[
              section.key
            ] ||
            []
          ).length;


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

      <p class="muted">
        Это базовое сравнение количества записей.
        Подробное сравнение версий будет вынесено
        в отдельный модуль истории.
      </p>
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
   ОБЩАЯ ПЕРЕРИСОВКА
   ========================================================= */

LIV.refreshAll = function () {

  if (
    typeof LIV.refreshResourceFilters ===
    'function'
  ) {
    LIV.refreshResourceFilters();
  }


  LIV.renderDashboard();


  if (
    typeof LIV.renderResources ===
    'function'
  ) {
    LIV.renderResources();
  }


  if (
    typeof LIV.renderOrganizations ===
    'function'
  ) {
    LIV.renderOrganizations();
  }


  LIV.renderHistory();


  LIV.renderSystemInfo();
};


/* =========================================================
   ОБЩИЕ СОБЫТИЯ
   ========================================================= */

LIV.bindGlobalEvents = function () {

  /* -------------------------------------------------------
     ОСНОВНЫЕ ВКЛАДКИ
     ------------------------------------------------------- */

  document
    .querySelectorAll(
      '.tab'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            LIV.switchTab(
              button.dataset.tab
            );
          }
        );
      }
    );


  /* -------------------------------------------------------
     МОДАЛЬНОЕ ОКНО
     ------------------------------------------------------- */

  LIV.$(
    'modalClose'
  )
    ?.addEventListener(
      'click',
      LIV.closeModal
    );


  LIV.$(
    'modal'
  )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.id ===
          'modal'
        ) {
          LIV.closeModal();
        }
      }
    );


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
     СОХРАНИТЬ ПРОЕКТ
     ------------------------------------------------------- */

  LIV.$(
    'backupBtn'
  )
    ?.addEventListener(
      'click',
      LIV.exportProjectBackup
    );


  /* -------------------------------------------------------
     ЗАГРУЗИТЬ ПРОЕКТ
     ------------------------------------------------------- */

  LIV.$(
    'restoreInput'
  )
    ?.addEventListener(
      'change',
      async event => {

        const file =
          event.target
            .files?.[0];


        await LIV.restoreProjectFromFile(
          file
        );


        event.target.value =
          '';
      }
    );


  /* -------------------------------------------------------
     СРАВНИТЬ
     ------------------------------------------------------- */

  LIV.$(
    'compareInput'
  )
    ?.addEventListener(
      'change',
      async event => {

        const file =
          event.target
            .files?.[0];


        await LIV.compareProjectWithFile(
          file
        );


        event.target.value =
          '';
      }
    );


  /* -------------------------------------------------------
     PDF
     ------------------------------------------------------- */

  LIV.$(
    'pdfBtn'
  )
    ?.addEventListener(
      'click',
      LIV.printCurrentView
    );
};


/* =========================================================
   ПЕРВИЧНЫЕ ДАТЫ РЕСУРСОВ
   ========================================================= */

LIV.setInitialResourceDates = function () {

  const rows =
    LIV.project.resources ||
    [];


  const dates =
    LIV.unique(
      rows
        .map(
          row =>
            row.date
        )
        .filter(Boolean)
    )
      .sort();


  let from =
    dates[0] ||
    LIV.today();


  let to =
    dates.at(-1) ||
    LIV.today();


  /*
     Если в базе уже есть большой исторический период,
     не меняем его автоматически потом.
     Это только первичная установка полей.
  */

  const fromInput =
    LIV.$(
      'resourceFrom'
    );


  const toInput =
    LIV.$(
      'resourceTo'
    );


  const dailyInput =
    LIV.$(
      'resourceDailyDate'
    );


  if (
    fromInput &&
    !fromInput.value
  ) {
    fromInput.value =
      from;
  }


  if (
    toInput &&
    !toInput.value
  ) {
    toInput.value =
      to;
  }


  if (
    dailyInput &&
    !dailyInput.value
  ) {
    dailyInput.value =
      to;
  }
};


/* =========================================================
   ЗАПУСК LIV PLANNING
   ========================================================= */

LIV.start = async function () {

  try {

    /* ---------------------------------------------
       1. Загружаем проект из старой базы IndexedDB
       --------------------------------------------- */

    await LIV.loadProject();


    /* ---------------------------------------------
       2. Устанавливаем даты
       --------------------------------------------- */

    LIV.setInitialResourceDates();


    /* ---------------------------------------------
       3. Создаем универсальные фильтры ресурсов
       --------------------------------------------- */

    if (
      typeof LIV.initResourceFilters ===
      'function'
    ) {
      LIV.initResourceFilters();
    }


    /* ---------------------------------------------
       4. Подключаем события модулей
       --------------------------------------------- */

    LIV.bindGlobalEvents();


    if (
      typeof LIV.bindResourceEvents ===
      'function'
    ) {
      LIV.bindResourceEvents();
    }


    if (
      typeof LIV.bindOrganizationEvents ===
      'function'
    ) {
      LIV.bindOrganizationEvents();
    }


    if (
      typeof LIV.bindImportEvents ===
      'function'
    ) {
      LIV.bindImportEvents();
    }


    /* ---------------------------------------------
       5. Первая отрисовка
       --------------------------------------------- */

    LIV.refreshAll();


    /* ---------------------------------------------
       6. Открываем сводку
       --------------------------------------------- */

    LIV.switchTab(
      'dashboard'
    );


    console.log(
      `LIV Planning ${LIV.SCHEMA_VERSION} запущен`
    );

  } catch (error) {

    console.error(
      'Ошибка запуска LIV Planning:',
      error
    );


    alert(
      'LIV Planning не удалось запустить.\n\n' +
      (
        error?.message ||
        String(error)
      )
    );
  }
};


/* =========================================================
   ЗАПУСК ПОСЛЕ ЗАГРУЗКИ HTML
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    LIV.start();
  }
);