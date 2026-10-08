'use strict';

/* =========================================================
   LIV PLANNING
   STORAGE
   Резервные копии, восстановление и сравнение проектов
   ========================================================= */


/* =========================================================
   ПАНЕЛЬ РЕЗЕРВНОЙ КОПИИ
   ========================================================= */


function renderBackupNotice() {

  const notice =
    $('backupNotice');


  if (!notice) {
    return;
  }


  notice.classList.remove(
    'hidden'
  );


  const last =
    project?.meta
      ?.lastBackupAt;


  if (!last) {

    notice.textContent =
      'Резервная копия проекта еще не создавалась.';

    return;
  }


  const parsed =
    Date.parse(
      last
    );


  const days =
    Number.isFinite(
      parsed
    )
      ? Math.floor(
          (
            Date.now() -
            parsed
          ) /
          86400000
        )
      : 0;


  const dateText =
    Number.isFinite(
      parsed
    )
      ? new Date(
          parsed
        )
          .toLocaleString(
            'ru-RU'
          )
      : 'дата неизвестна';


  notice.textContent =
    `Последняя резервная копия: ${dateText}` +
    (
      days >=
        7
        ? ' · рекомендуется создать новую копию'
        : ''
    );
}


/* =========================================================
   ИМЯ ФАЙЛА РЕЗЕРВНОЙ КОПИИ
   ========================================================= */


function backupFileName() {

  const stamp =
    new Date()
      .toISOString()
      .slice(
        0,
        16
      )
      .replace(
        'T',
        '_'
      )
      .replace(
        ':',
        '-'
      );


  return (
    `LIV_Planning_${stamp}.json`
  );
}


/* =========================================================
   ВЫГРУЗКА ПОЛНОЙ РЕЗЕРВНОЙ КОПИИ
   ========================================================= */


async function exportBackup() {

  if (!project) {
    return;
  }


  project.meta =
    project.meta ||
    {};


  project.meta.lastBackupAt =
    nowIso();


  await saveProject();


  const payload = {

    ...clone(
      project
    ),

    exportedAt:
      nowIso(),

    source:
      'LIV Planning',

    format:
      'liv-planning-backup',

    schemaVersion:
      SCHEMA_VERSION
  };


  download(
    backupFileName(),

    JSON.stringify(
      payload,
      null,
      2
    ),

    'application/json'
  );


  renderBackupNotice();
}


/* =========================================================
   ПРОВЕРКА JSON ПЕРЕД ВОССТАНОВЛЕНИЕМ
   ========================================================= */


function validateBackupPayload(
  value
) {

  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {

    throw new Error(
      'Файл не содержит корректный проект LIV Planning.'
    );
  }


  const usefulCollections = [
    'fronts',
    'resources',
    'milestones',
    'buildings',
    'works',
    'organizations'
  ];


  const hasProjectData =
    usefulCollections
      .some(
        key =>
          Array.isArray(
            value[
              key
            ]
          )
      );


  if (
    !hasProjectData
  ) {

    throw new Error(
      'В файле не найдена структура проекта.'
    );
  }


  return true;
}


/* =========================================================
   ВОССТАНОВЛЕНИЕ ПРОЕКТА
   ========================================================= */


async function restoreProject(
  file
) {

  if (!file) {
    return;
  }


  try {

    const text =
      await file.text();


    const parsed =
      JSON.parse(
        text
      );


    validateBackupPayload(
      parsed
    );


    const data =
      normalizeProject(
        parsed
      );


    const currentFronts =
      (
        project?.fronts ||
        []
      )
        .length;


    const currentResources =
      (
        project?.resources ||
        []
      )
        .length;


    const incomingFronts =
      (
        data.fronts ||
        []
      )
        .length;


    const incomingResources =
      (
        data.resources ||
        []
      )
        .length;


    const confirmed =
      confirm(
        'Заменить текущий проект данными из резервной копии?\n\n' +

        `Файл: ${file.name}\n\n` +

        `Текущий проект:\n` +
        `Фронтов: ${currentFronts}\n` +
        `Записей ресурсов: ${currentResources}\n\n` +

        `Загружаемый проект:\n` +
        `Фронтов: ${incomingFronts}\n` +
        `Записей ресурсов: ${incomingResources}\n\n` +

        'Перед заменой текущая база будет сохранена локально.'
      );


    if (
      !confirmed
    ) {

      return;
    }


    const safetyKey =
      `restore-backup-${Date.now()}`;


    await dbPutKey(
      clone(
        project
      ),
      safetyKey
    );


    project =
      data;


    project.meta =
      project.meta ||
      {};


    project.meta.restoredAt =
      nowIso();


    project.meta.restoredFrom =
      file.name;


    log(
      'Восстановлено',
      'Проект',
      `Загружена резервная копия ${file.name}`,
      {
        safetyKey
      }
    );


    await saveProject();


    if (
      typeof initSelects ===
      'function'
    ) {

      initSelects();
    }


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
          id => {

            resetMultiFilter(
              id,
              false
            );
          }
        );
    }


    if (
      typeof refreshAllMultiFilters ===
      'function'
    ) {

      refreshAllMultiFilters();
    }


    renderAll();


    alert(
      'Проект восстановлен из резервной копии.'
    );

  } catch (
    error
  ) {

    console.error(
      error
    );


    alert(
      'Ошибка загрузки резервной копии:\n' +
      (
        error?.message ||
        String(
          error
        )
      )
    );

  } finally {

    if (
      $('restoreInput')
    ) {

      $('restoreInput').value =
        '';
    }
  }
}


/* =========================================================
   СРАВНЕНИЕ МАССИВОВ
   ========================================================= */


function compareCollections(
  current,
  incoming
) {

  const currentMap =
    new Map(
      (
        current ||
        []
      )
        .filter(
          item =>
            item &&
            item.id !==
              undefined
        )
        .map(
          item => [

            String(
              item.id
            ),

            item
          ]
        )
    );


  const incomingMap =
    new Map(
      (
        incoming ||
        []
      )
        .filter(
          item =>
            item &&
            item.id !==
              undefined
        )
        .map(
          item => [

            String(
              item.id
            ),

            item
          ]
        )
    );


  const added =
    [];


  const changed =
    [];


  const missing =
    [];


  for (
    const [
      id,
      row
    ]
    of incomingMap
  ) {

    if (
      !currentMap.has(
        id
      )
    ) {

      added.push(
        row
      );

      continue;
    }


    const currentRow =
      currentMap.get(
        id
      );


    if (
      JSON.stringify(
        currentRow
      ) !==
      JSON.stringify(
        row
      )
    ) {

      changed.push({

        before:
          currentRow,

        after:
          row
      });
    }
  }


  for (
    const [
      id,
      row
    ]
    of currentMap
  ) {

    if (
      !incomingMap.has(
        id
      )
    ) {

      missing.push(
        row
      );
    }
  }


  return {

    added,

    changed,

    missing
  };
}


/* =========================================================
   КОЛЛЕКЦИИ ДЛЯ СРАВНЕНИЯ
   ========================================================= */


const COMPARE_COLLECTIONS = [

  [
    'buildings',
    'Здания'
  ],

  [
    'organizations',
    'Организации'
  ],

  [
    'works',
    'Виды работ'
  ],

  [
    'structures',
    'Структура объекта'
  ],

  [
    'fronts',
    'Фронты'
  ],

  [
    'planLog',
    'План'
  ],

  [
    'factLog',
    'Факт'
  ],

  [
    'resources',
    'Ресурсы'
  ],

  [
    'resourcePlans',
    'Планы ресурсов'
  ],

  [
    'milestones',
    'Ключевые даты'
  ],

  [
    'numberedElements',
    'Номерные элементы'
  ],

  [
    'contracts',
    'Договоры'
  ],

  [
    'constraints',
    'Ограничения'
  ],

  [
    'demolition',
    'Демонтаж'
  ],

  [
    'diagrams',
    'Схемы'
  ],

  [
    'diagramMarks',
    'Отметки на схемах'
  ],

  [
    'scheduleVersions',
    'Версии графика'
  ],

  [
    'views',
    'Сохраненные представления'
  ]
];


/* =========================================================
   ТЕКСТ ДЛЯ ЭЛЕМЕНТА СРАВНЕНИЯ
   ========================================================= */


function compareItemLabel(
  item
) {

  const row =
    item.after ||
    item.before ||
    {};


  if (
    item.key ===
    'organizations'
  ) {

    return (
      row.name ||
      row.id ||
      'Организация'
    );
  }


  if (
    item.key ===
    'buildings'
  ) {

    return (
      row.name ||
      row.id ||
      'Здание'
    );
  }


  if (
    item.key ===
    'works'
  ) {

    return (
      row.name ||
      row.id ||
      'Работа'
    );
  }


  if (
    item.key ===
    'milestones'
  ) {

    return (
      row.title ||
      row.name ||
      row.id ||
      'Ключевая дата'
    );
  }


  if (
    item.key ===
    'resources'
  ) {

    const organization =
      nameById(
        project.organizations,
        row.organizationId
      ) ||
      'Без организации';


    return (
      `${row.date || 'без даты'} · ${organization}`
    );
  }


  if (
    item.key ===
    'fronts'
  ) {

    try {

      return (
        frontLabel(
          row
        ) ||
        row.id
      );

    } catch (
      error
    ) {

      return (
        row.id ||
        'Фронт'
      );
    }
  }


  return (
    row.name ||
    row.title ||
    row.id ||
    item.label
  );
}


/* =========================================================
   СРАВНЕНИЕ ФАЙЛА С ТЕКУЩЕЙ БАЗОЙ
   ========================================================= */


async function compareProjectFile(
  file
) {

  if (!file) {
    return;
  }


  try {

    const parsed =
      JSON.parse(
        await file.text()
      );


    validateBackupPayload(
      parsed
    );


    compareIncoming =
      normalizeProject(
        parsed
      );


    compareItems =
      [];


    let totalMissing =
      0;


    COMPARE_COLLECTIONS
      .forEach(
        (
          [
            key,
            label
          ]
        ) => {

          const result =
            compareCollections(
              project[
                key
              ],
              compareIncoming[
                key
              ]
            );


          result.added
            .forEach(
              row => {

                compareItems.push({

                  token:
                    uid(
                      'CMP'
                    ),

                  key,

                  label,

                  type:
                    'added',

                  id:
                    row.id,

                  after:
                    row
                });
              }
            );


          result.changed
            .forEach(
              pair => {

                compareItems.push({

                  token:
                    uid(
                      'CMP'
                    ),

                  key,

                  label,

                  type:
                    'changed',

                  id:
                    pair.after.id,

                  before:
                    pair.before,

                  after:
                    pair.after
                });
              }
            );


          totalMissing +=
            result.missing
              .length;
        }
      );


    const addedCount =
      compareItems
        .filter(
          item =>
            item.type ===
            'added'
        )
        .length;


    const changedCount =
      compareItems
        .filter(
          item =>
            item.type ===
            'changed'
        )
        .length;


    openModal(
      'Сравнение проекта',

      `
        <div class="compare-summary">

          <div class="compare-box">

            <div class="muted">
              Новых
            </div>

            <strong>
              ${addedCount}
            </strong>

          </div>


          <div class="compare-box">

            <div class="muted">
              Измененных
            </div>

            <strong>
              ${changedCount}
            </strong>

          </div>


          <div class="compare-box">

            <div class="muted">
              Отсутствуют в файле
            </div>

            <strong>
              ${totalMissing}
            </strong>

          </div>

        </div>


        <div class="notice">

          Сравнение не меняет рабочую базу.

          Можно принять только выбранные
          новые/измененные записи
          либо заменить проект целиком.

          Записи, которые отсутствуют
          в загружаемом файле,
          автоматически не удаляются.

        </div>


        <div class="compare-details">

          ${
            compareItems.length
              ? compareItems
                  .slice(
                    0,
                    1000
                  )
                  .map(
                    item => `
                      <div class="compare-record">

                        <label>

                          <input
                            type="checkbox"
                            data-cmp="${esc(
                              item.token
                            )}"
                            checked
                          >

                          <span>

                            <b>

                              ${
                                item.type ===
                                  'added'
                                  ? 'НОВОЕ'
                                  : 'ИЗМЕНЕНО'
                              }

                              ·

                              ${esc(
                                item.label
                              )}

                            </b>

                          </span>

                        </label>


                        <small>

                          ${esc(
                            compareItemLabel(
                              item
                            )
                          )}

                        </small>

                      </div>
                    `
                  )
                  .join('')
              : `
                  <div class="empty-state">

                    <strong>
                      Различий нет
                    </strong>

                    Выбранные версии проекта
                    совпадают по рабочим данным.

                  </div>
                `
          }

        </div>


        <div class="editor-actions">

          <button
            id="acceptSelectedCompare"
            class="btn primary"
            ${
              compareItems.length
                ? ''
                : 'disabled'
            }>
            Принять отмеченные
          </button>


          <button
            id="replaceCompare"
            class="btn danger">
            Заменить проект целиком
          </button>

        </div>
      `
    );


    if (
      $('acceptSelectedCompare')
    ) {

      $('acceptSelectedCompare')
        .onclick =
          acceptSelectedCompared;
    }


    if (
      $('replaceCompare')
    ) {

      $('replaceCompare')
        .onclick =
          replaceCompared;
    }

  } catch (
    error
  ) {

    console.error(
      error
    );


    alert(
      'Ошибка сравнения проектов:\n' +
      (
        error?.message ||
        String(
          error
        )
      )
    );

  } finally {

    if (
      $('compareInput')
    ) {

      $('compareInput').value =
        '';
    }
  }
}


/* =========================================================
   ПРИМЕНИТЬ ВЫБРАННЫЕ ИЗМЕНЕНИЯ
   ========================================================= */


async function acceptSelectedCompared() {

  if (
    !compareIncoming
  ) {
    return;
  }


  const selected =
    new Set(
      [
        ...document
          .querySelectorAll(
            '[data-cmp]:checked'
          )
      ]
        .map(
          checkbox =>
            checkbox.dataset
              .cmp
        )
    );


  const chosen =
    compareItems
      .filter(
        item =>
          selected.has(
            item.token
          )
      );


  if (
    !chosen.length
  ) {

    alert(
      'Ничего не выбрано.'
    );

    return;
  }


  if (
    !confirm(
      `Применить выбранные изменения: ${chosen.length}? Перед применением будет создана защитная копия.`
    )
  ) {

    return;
  }


  const safetyKey =
    `compare-merge-backup-${Date.now()}`;


  await dbPutKey(
    clone(
      project
    ),
    safetyKey
  );


  chosen.forEach(
    item => {

      if (
        !Array.isArray(
          project[
            item.key
          ]
        )
      ) {

        project[
          item.key
        ] =
          [];
      }


      const list =
        project[
          item.key
        ];


      const index =
        list.findIndex(
          row =>
            String(
              row.id
            ) ===
            String(
              item.id
            )
        );


      if (
        index >=
        0
      ) {

        list[
          index
        ] =
          clone(
            item.after
          );

      } else {

        list.push(
          clone(
            item.after
          )
        );
      }
    }
  );


  log(
    'Сравнение',
    'Проект',
    `Принято изменений: ${chosen.length}`,
    {
      safetyKey
    }
  );


  await saveProject();


  compareIncoming =
    null;


  compareItems =
    [];


  closeModal();


  if (
    typeof initSelects ===
    'function'
  ) {

    initSelects();
  }


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {

    refreshAllMultiFilters();
  }


  renderAll();
}


/* =========================================================
   ПОЛНАЯ ЗАМЕНА СРАВНИВАЕМОЙ ВЕРСИЕЙ
   ========================================================= */


async function replaceCompared() {

  if (
    !compareIncoming
  ) {
    return;
  }


  if (
    !confirm(
      'Полностью заменить текущий проект сравниваемой версией?\n\nПеред заменой текущая база будет сохранена локально.'
    )
  ) {

    return;
  }


  const safetyKey =
    `compare-replace-backup-${Date.now()}`;


  await dbPutKey(
    clone(
      project
    ),
    safetyKey
  );


  project =
    normalizeProject(
      compareIncoming
    );


  log(
    'Заменено',
    'Проект',
    'Применена сравниваемая версия проекта целиком.',
    {
      safetyKey
    }
  );


  await saveProject();


  compareIncoming =
    null;


  compareItems =
    [];


  closeModal();


  if (
    typeof initSelects ===
    'function'
  ) {

    initSelects();
  }


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
        id => {

          resetMultiFilter(
            id,
            false
          );
        }
      );
  }


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {

    refreshAllMultiFilters();
  }


  renderAll();
}