'use strict';

/* =========================================================
   LIV Planning
   UNIVERSAL VIEW BUILDER + PRINT REPORT
   ========================================================= */


let livViewBuilderInitialized =
  false;


/* =========================================================
   ТЕКУЩИЙ ВИД
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


/* =========================================================
   НАЗВАНИЕ ОТЧЕТА
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
    tab.startsWith(
      'custom-'
    )
  ) {

    const id =
      tab.replace(
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


  if (
    tab ===
    'resources'
  ) {

    return livResourceViewTitle(
      livActiveResourceView()
    );
  }


  return livMainTabTitle(
    tab
  );
}


/* =========================================================
   ХРАНЕНИЕ НАСТРОЕК КОНСТРУКТОРА
   ========================================================= */


function livEnsureViewSettings() {

  if (
    !project
  ) {
    return;
  }


  if (
    !project.viewConstructor ||
    typeof project.viewConstructor !==
      'object' ||
    Array.isArray(
      project.viewConstructor
    )
  ) {

    project.viewConstructor =
      {};
  }
}


function livViewSettings(
  key =
    livCurrentViewKey()
  ) {

  livEnsureViewSettings();


  if (
    !project.viewConstructor[
      key
    ]
  ) {

    project.viewConstructor[
      key
    ] = {

      hidden:
        [],

      hiddenModes:
        []
    };
  }


  return project.viewConstructor[
    key
  ];
}


/* =========================================================
   ПОИСК ТЕКУЩЕЙ ПАНЕЛИ
   ========================================================= */


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
   УНИКАЛЬНЫЕ КЛЮЧИ ЭЛЕМЕНТОВ
   ========================================================= */


function livBuilderElementKey(
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


  const label =
    element
      .querySelector?.(
        'label'
      )
      ?.textContent
      ?.trim() ||

    element
      .querySelector?.(
        'h2'
      )
      ?.textContent
      ?.trim() ||

    element
      .querySelector?.(
        'h3'
      )
      ?.textContent
      ?.trim() ||

    element.dataset
      ?.rview ||

    element.className ||
    'block';


  return (
    `auto:${normKey(label)}:${index}`
  );
}


function livBuilderElementTitle(
  element,
  index
) {

  const explicitLabel =
    element
      .querySelector?.(
        ':scope > label'
      )
      ?.textContent
      ?.trim();


  if (
    explicitLabel
  ) {
    return explicitLabel;
  }


  const heading =
    element
      .querySelector?.(
        ':scope > h2, :scope > h3'
      )
      ?.textContent
      ?.trim();


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
        'table-wrap'
      )
  ) {
    return `Таблица ${index + 1}`;
  }


  if (
    element.classList
      .contains(
        'toolbar'
      ) ||
    element.classList
      .contains(
        'resource-toolbar'
      ) ||
    element.classList
      .contains(
        'section-toolbar'
      )
  ) {
    return 'Панель управления';
  }


  return (
    element.id ||
    `Блок ${index + 1}`
  );
}


/* =========================================================
   ЭЛЕМЕНТЫ, КОТОРЫМИ МОЖНО УПРАВЛЯТЬ
   ========================================================= */


function livDiscoverBuilderItems() {

  const panel =
    livCurrentPanel();


  if (
    !panel
  ) {
    return [];
  }


  const result =
    [];


  const candidates =
    [
      ...panel.querySelectorAll(
        [
          ':scope > .card',
          ':scope > .stats',
          ':scope > .grid2',
          ':scope > .grid3',
          ':scope > .resource-chart-grid',
          ':scope > .chart-box-large',
          '.no-print .field',
          '.resource-toolbar .field',
          '.resource-toolbar .switch-line',
          '.section-toolbar .field'
        ]
          .join(
            ','
          )
      )
    ];


  const seen =
    new Set();


  candidates.forEach(
    (
      element,
      index
    ) => {

      if (
        element.closest(
          '.modal'
        )
      ) {
        return;
      }


      const key =
        livBuilderElementKey(
          element,
          index
        );


      if (
        seen.has(
          key
        )
      ) {
        return;
      }


      seen.add(
        key
      );


      element.dataset
        .livBuilderKey =
          key;


      result.push({

        key,

        title:
          livBuilderElementTitle(
            element,
            index
          ),

        element
      });
    }
  );


  return result;
}


/* =========================================================
   ПРИМЕНЕНИЕ СОХРАНЕННОГО ВИДА
   ========================================================= */


function livApplyViewConstructor() {

  if (
    !project
  ) {
    return;
  }


  const settings =
    livViewSettings();


  document
    .querySelectorAll(
      '[data-liv-builder-key]'
    )
    .forEach(
      element => {

        element.classList
          .remove(
            'liv-builder-hidden'
          );
      }
    );


  const items =
    livDiscoverBuilderItems();


  const hidden =
    new Set(
      settings.hidden ||
      []
    );


  items.forEach(
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


  if (
    livActiveMainTab() ===
    'resources'
  ) {

    const hiddenModes =
      new Set(
        settings.hiddenModes ||
        []
      );


    document
      .querySelectorAll(
        '[data-rview]'
      )
      .forEach(
        button => {

          button.classList
            .toggle(
              'liv-mode-hidden',

              hiddenModes.has(
                button.dataset
                  .rview
              )
            );
        }
      );


    const current =
      livActiveResourceView();


    if (
      hiddenModes.has(
        current
      )
    ) {

      const first =
        [
          ...document
            .querySelectorAll(
              '[data-rview]'
            )
        ]
          .find(
            button =>
              !hiddenModes.has(
                button.dataset
                  .rview
              )
          );


      if (
        first &&
        typeof switchResourceView ===
          'function'
      ) {

        switchResourceView(
          first.dataset
            .rview
        );
      }
    }
  }
}


/* =========================================================
   КОНСТРУКТОР
   ========================================================= */


function livOpenViewBuilder() {

  const key =
    livCurrentViewKey();


  const settings =
    livViewSettings(
      key
    );


  const hidden =
    new Set(
      settings.hidden ||
      []
    );


  const hiddenModes =
    new Set(
      settings.hiddenModes ||
      []
    );


  const items =
    livDiscoverBuilderItems();


  const resourceModes =
    livActiveMainTab() ===
    'resources'
      ? [
          ...document
            .querySelectorAll(
              '[data-rview]'
            )
        ]
      : [];


  openModal(
    `Конструктор · ${livReportTitle()}`,

    `
      <div class="view-builder-intro">

        Здесь настраивается именно текущий вид.

        Можно отключать фильтры, блоки,
        показатели, таблицы и режимы.

        Настройка сохраняется отдельно
        для каждой вкладки.

      </div>


      ${
        resourceModes.length
          ? `
              <div class="view-builder-group">

                <h3>
                  Режимы
                </h3>

                <div class="view-builder-grid">

                  ${
                    resourceModes
                      .map(
                        button => {

                          const mode =
                            button.dataset
                              .rview;

                          return `
                            <label class="view-builder-option">

                              <input
                                type="checkbox"
                                data-builder-mode="${esc(mode)}"
                                ${
                                  hiddenModes.has(
                                    mode
                                  )
                                    ? ''
                                    : 'checked'
                                }
                              >

                              <span>
                                ${esc(
                                  button.textContent
                                    .trim()
                                )}
                              </span>

                            </label>
                          `;
                        }
                      )
                      .join('')
                  }

                </div>

              </div>
            `
          : ''
      }


      <div class="view-builder-group">

        <h3>
          Элементы страницы
        </h3>

        <div class="view-builder-grid">

          ${
            items.length
              ? items
                  .map(
                    item => `
                      <label class="view-builder-option">

                        <input
                          type="checkbox"
                          data-builder-item="${esc(item.key)}"
                          ${
                            hidden.has(
                              item.key
                            )
                              ? ''
                              : 'checked'
                          }
                        >

                        <span>
                          ${esc(item.title)}
                        </span>

                      </label>
                    `
                  )
                  .join('')

              : `
                  <div class="muted">
                    На этой странице пока нет
                    настраиваемых блоков.
                  </div>
                `
          }

        </div>

      </div>


      <div class="editor-actions">

        <button
          id="livBuilderReset"
          class="btn">

          Показать всё

        </button>


        <button
          id="livBuilderSave"
          class="btn primary">

          Применить

        </button>

      </div>
    `
  );


  $('livBuilderSave')
    .onclick =
      async () => {

        const nextHidden =
          [
            ...document
              .querySelectorAll(
                '[data-builder-item]'
              )
          ]
            .filter(
              input =>
                !input.checked
            )
            .map(
              input =>
                input.dataset
                  .builderItem
            );


        const nextHiddenModes =
          [
            ...document
              .querySelectorAll(
                '[data-builder-mode]'
              )
          ]
            .filter(
              input =>
                !input.checked
            )
            .map(
              input =>
                input.dataset
                  .builderMode
            );


        project.viewConstructor[
          key
        ] = {

          hidden:
            nextHidden,

          hiddenModes:
            nextHiddenModes
        };


        await saveProject();


        closeModal();


        livApplyViewConstructor();
      };


  $('livBuilderReset')
    .onclick =
      async () => {

        project.viewConstructor[
          key
        ] = {

          hidden:
            [],

          hiddenModes:
            []
        };


        await saveProject();


        closeModal();


        livApplyViewConstructor();
      };
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


  const pdfButton =
    $('pdfBtn');


  if (
    pdfButton
  ) {

    actions.insertBefore(
      button,
      pdfButton
    );

  } else {

    actions.appendChild(
      button
    );
  }
}


/* =========================================================
   ФИЛЬТРЫ ДЛЯ ШАПКИ ОТЧЕТА
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
        ?.value;


    const to =
      $('rTo')
        ?.value;


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
            !text.startsWith(
              'Все '
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
    livActiveMainTab() ===
    'organizations'
  ) {

    const name =
      $('organizationCardSelect')
        ?.selectedOptions
        ?.[0]
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
   ПОДГОТОВКА CANVAS ДЛЯ ПЕЧАТИ
   ========================================================= */


function livReplaceCanvasWithImages(
  source,
  clone
) {

  const sourceCanvases =
    [
      ...source.querySelectorAll(
        'canvas'
      )
    ];


  const cloneCanvases =
    [
      ...clone.querySelectorAll(
        'canvas'
      )
    ];


  sourceCanvases.forEach(
    (
      canvas,
      index
    ) => {

      const cloneCanvas =
        cloneCanvases[
          index
        ];


      if (
        !cloneCanvas
      ) {
        return;
      }


      try {

        const image =
          document.createElement(
            'img'
          );


        image.src =
          canvas.toDataURL(
            'image/png'
          );


        image.className =
          'print-chart-image';


        cloneCanvas.replaceWith(
          image
        );

      } catch (
        error
      ) {

        cloneCanvas.remove();
      }
    }
  );
}


/* =========================================================
   ОЧИСТКА КЛОНА ДЛЯ ПЕЧАТИ
   ========================================================= */


function livCleanPrintClone(
  clone
) {

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
      '.card'
    )
    .forEach(
      card => {

        if (
          !card.textContent
            .trim() &&
          !card.querySelector(
            'img,table'
          )
        ) {

          card.remove();
        }
      }
    );


  clone
    .querySelectorAll(
      'table'
    )
    .forEach(
      table => {

        table.classList.add(
          'print-report-table'
        );
      }
    );
}


/* =========================================================
   СОЗДАНИЕ ПЕЧАТНОГО ОТЧЕТА
   ========================================================= */


function livBuildPrintReport() {

  const source =
    livCurrentPanel();


  if (
    !source
  ) {

    throw new Error(
      'Не найден текущий раздел для печати.'
    );
  }


  const clone =
    source.cloneNode(
      true
    );


  livReplaceCanvasWithImages(
    source,
    clone
  );


  livCleanPrintClone(
    clone
  );


  const root =
    document.createElement(
      'div'
    );


  root.id =
    'livPrintRoot';


  root.className =
    'liv-print-root';


  const generated =
    new Date()
      .toLocaleString(
        'ru-RU'
      );


  const filters =
    livCurrentReportFilters();


  root.innerHTML =
    `
      <header class="print-report-header">

        <div class="print-report-brand">

          <div class="print-report-logo">
            LIV
          </div>

          <div>

            <div class="print-report-brand-name">
              LIV Planning
            </div>

            <div class="print-report-brand-subtitle">
              Система календарно-сетевого планирования
              и производственной аналитики
            </div>

          </div>

        </div>


        <div class="print-report-date">

          <span>
            Сформировано
          </span>

          <strong>
            ${esc(generated)}
          </strong>

        </div>

      </header>


      <section class="print-report-title">

        <div class="print-report-eyebrow">
          ОТЧЕТ
        </div>

        <h1>
          ${esc(
            livReportTitle()
          )}
        </h1>


        ${
          filters.length
            ? `
                <div class="print-report-filters">

                  ${
                    filters
                      .map(
                        text =>
                          `
                            <span>
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


      <main class="print-report-content">
      </main>


      <footer class="print-report-footer">

        <span>
          LIV Planning
        </span>

        <span>
          Рабочий отчет
        </span>

      </footer>
    `;


  root
    .querySelector(
      '.print-report-content'
    )
    .appendChild(
      clone
    );


  return root;
}


/* =========================================================
   КРАСИВАЯ ПЕЧАТЬ
   ========================================================= */


function livPrintCurrent() {

  document
    .getElementById(
      'livPrintRoot'
    )
    ?.remove();


  let root;


  try {

    root =
      livBuildPrintReport();

  } catch (
    error
  ) {

    alert(
      error.message
    );

    return;
  }


  document.body
    .appendChild(
      root
    );


  document.body
    .classList.add(
      'liv-printing'
    );


  requestAnimationFrame(
    () => {

      requestAnimationFrame(
        () => {

          window.print();


          setTimeout(
            () => {

              document.body
                .classList
                .remove(
                  'liv-printing'
                );


              root.remove();

            },
            500
          );
        }
      );
    }
  );
}


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */


function initLivViewBuilder() {

  if (
    livViewBuilderInitialized
  ) {
    return;
  }


  livViewBuilderInitialized =
    true;


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

      const tab =
        event.target.closest(
          '[data-tab],[data-rview]'
        );


      if (
        !tab
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