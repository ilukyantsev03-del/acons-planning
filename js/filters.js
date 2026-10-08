'use strict';

/* =========================================================
   LIV PLANNING
   ЕДИНАЯ СИСТЕМА МУЛЬТИФИЛЬТРОВ

   Принцип:
   - одновременно открыт только один фильтр;
   - поиск не меняет примененный фильтр;
   - изменения вступают в силу только после "Применить";
   - "Отмена" возвращает исходное состояние;
   - можно выбрать все;
   - можно снять все;
   - можно полностью сбросить фильтр;
   - ширина фильтра не меняется от выбранных значений.
   ========================================================= */


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */


const multiFilters =
  new Map();


let openMultiFilter =
  null;


/* =========================================================
   ПОЛУЧЕНИЕ ВЫБРАННЫХ ЗНАЧЕНИЙ

   null = выбрано всё
   []   = ничего не выбрано
   [...] = конкретные выбранные значения
   ========================================================= */


function getMultiFilterValues(
  selectId
) {

  const state =
    multiFilters.get(
      selectId
    );


  if (!state) {
    return null;
  }


  if (
    state.mode ===
    'all'
  ) {
    return null;
  }


  return [
    ...state.selected
  ];
}


/* =========================================================
   ПРОВЕРКА ЗНАЧЕНИЯ ПО ФИЛЬТРУ
   ========================================================= */


function multiFilterAllows(
  selectId,
  value
) {

  const selected =
    getMultiFilterValues(
      selectId
    );


  if (
    selected ===
    null
  ) {
    return true;
  }


  return selected.includes(
    String(
      value ??
      ''
    )
  );
}


/* =========================================================
   ЗАКРЫТИЕ ОТКРЫТОГО ФИЛЬТРА
   ========================================================= */


function closeOpenMultiFilter(
  exceptId =
    null
) {

  if (
    !openMultiFilter ||
    openMultiFilter ===
      exceptId
  ) {
    return;
  }


  const state =
    multiFilters.get(
      openMultiFilter
    );


  if (
    state?.menu
  ) {

    state.menu
      .classList
      .add(
        'hidden'
      );
  }


  openMultiFilter =
    null;
}


/* =========================================================
   ПОЛУЧЕНИЕ ОПЦИЙ ИЗ СКРЫТОГО SELECT
   ========================================================= */


function multiFilterOptions(
  state
) {

  const source =
    $(
      state.selectId
    );


  if (!source) {
    return [];
  }


  return [
    ...source.options
  ]
    .filter(
      option =>
        option.value !==
          'all' &&
        option.value !==
          ''
    )
    .map(
      option => ({

        id:
          String(
            option.value
          ),

        name:
          String(
            option.textContent ||
            option.value
          )
            .trim()
      })
    );
}


/* =========================================================
   СИНХРОНИЗАЦИЯ С ИСХОДНЫМ SELECT

   Он скрыт визуально, но оставляем его актуальным,
   чтобы старые части приложения могли продолжать работать.
   ========================================================= */


function syncMultiFilterSource(
  state
) {

  const source =
    $(
      state.selectId
    );


  if (!source) {
    return;
  }


  const selected =
    state.mode ===
      'all'
      ? null
      : state.selected;


  [
    ...source.options
  ]
    .forEach(
      option => {

        if (
          option.value ===
          'all'
        ) {

          option.selected =
            selected ===
            null;

          return;
        }


        option.selected =
          selected !==
            null &&
          selected.has(
            String(
              option.value
            )
          );
      }
    );
}


/* =========================================================
   ТЕКСТ НА КНОПКЕ ФИЛЬТРА
   ========================================================= */


function multiFilterSummary(
  state
) {

  const options =
    multiFilterOptions(
      state
    );


  if (
    state.mode ===
    'all'
  ) {

    return state.allLabel;
  }


  if (
    state.selected.size ===
    0
  ) {

    return 'Ничего не выбрано';
  }


  if (
    state.selected.size ===
    1
  ) {

    const id =
      [
        ...state.selected
      ][0];


    const item =
      options.find(
        option =>
          option.id ===
          id
      );


    return (
      item?.name ||
      'Выбрано: 1'
    );
  }


  if (
    state.selected.size ===
    options.length &&
    options.length >
      0
  ) {

    return state.allLabel;
  }


  return (
    `Выбрано: ${state.selected.size} из ${options.length}`
  );
}


/* =========================================================
   ОБНОВЛЕНИЕ КНОПКИ
   ========================================================= */


function renderMultiFilterButton(
  state
) {

  const mount =
    $(
      state.mountId
    );


  if (!mount) {
    return;
  }


  const summary =
    mount.querySelector(
      '.multi-filter-summary'
    );


  if (!summary) {
    return;
  }


  summary.textContent =
    multiFilterSummary(
      state
    );


  summary.title =
    summary.textContent;
}


/* =========================================================
   СОСТОЯНИЕ ЧЕРНОВИКА

   draft = то, что пользователь сейчас меняет
   внутри открытого меню.

   selected = уже примененный фильтр.
   ========================================================= */


function beginMultiFilterDraft(
  state
) {

  state.draftMode =
    state.mode;


  state.draft =
    new Set(
      state.selected
    );
}


/* =========================================================
   ПРОВЕРКА: ВЫБРАН ЛИ ЭЛЕМЕНТ В ЧЕРНОВИКЕ
   ========================================================= */


function isDraftItemSelected(
  state,
  id
) {

  if (
    state.draftMode ===
    'all'
  ) {
    return true;
  }


  return state.draft.has(
    id
  );
}


/* =========================================================
   ОТРИСОВКА СПИСКА
   ========================================================= */


function renderMultiFilterList(
  state,
  searchText =
    ''
) {

  const mount =
    $(
      state.mountId
    );


  if (!mount) {
    return;
  }


  const list =
    mount.querySelector(
      '.multi-filter-list'
    );


  if (!list) {
    return;
  }


  const search =
    normKey(
      searchText
    );


  const options =
    multiFilterOptions(
      state
    )
      .filter(
        item =>
          !search ||
          normKey(
            item.name
          )
            .includes(
              search
            )
      );


  if (
    !options.length
  ) {

    list.innerHTML = `
      <div class="empty-state">

        Ничего не найдено

      </div>
    `;

    return;
  }


  list.innerHTML =
    options
      .map(
        item => `
          <label
            class="multi-filter-option">

            <input
              type="checkbox"
              value="${esc(
                item.id
              )}"
              ${
                isDraftItemSelected(
                  state,
                  item.id
                )
                  ? 'checked'
                  : ''
              }
            >

            <span>
              ${esc(
                item.name
              )}
            </span>

          </label>
        `
      )
      .join('');
}


/* =========================================================
   ПЕРЕВОД РЕЖИМА "ВСЕ" В ОБЫЧНЫЙ НАБОР

   Нужен, когда пользователь начинает вручную
   снимать одну из галочек.
   ========================================================= */


function materializeDraftSelection(
  state
) {

  if (
    state.draftMode !==
    'all'
  ) {
    return;
  }


  state.draftMode =
    'custom';


  state.draft =
    new Set(
      multiFilterOptions(
        state
      )
        .map(
          item =>
            item.id
        )
    );
}


/* =========================================================
   СОЗДАНИЕ ФИЛЬТРА
   ========================================================= */


function initMultiFilter(
  selectId,
  mountId,
  allLabel,
  onApply
) {

  const source =
    $(
      selectId
    );


  const mount =
    $(
      mountId
    );


  if (
    !source ||
    !mount
  ) {

    return null;
  }


  /* Если фильтр уже был создан,
     просто обновляем его. */

  if (
    multiFilters.has(
      selectId
    )
  ) {

    const existing =
      multiFilters.get(
        selectId
      );


    existing.onApply =
      onApply;


    refreshMultiFilter(
      selectId
    );


    return existing;
  }


  source.classList.add(
    'multi-source'
  );


  source.multiple =
    true;


  const state = {

    selectId,

    mountId,

    allLabel,

    mode:
      'all',

    selected:
      new Set(),

    draftMode:
      'all',

    draft:
      new Set(),

    menu:
      null,

    onApply
  };


  multiFilters.set(
    selectId,
    state
  );


  mount.innerHTML = `
    <button
      type="button"
      class="multi-filter-button"
      aria-expanded="false">

      <span
        class="multi-filter-summary">
      </span>

    </button>


    <div
      class="multi-filter-menu hidden">

      <input
        class="multi-filter-search"
        type="search"
        placeholder="Поиск..."
        autocomplete="off"
      >


      <div class="multi-filter-actions">

        <button
          type="button"
          class="btn"
          data-mf-all>
          Выбрать все
        </button>


        <button
          type="button"
          class="btn"
          data-mf-none>
          Снять все
        </button>

      </div>


      <div
        class="multi-filter-list">
      </div>


      <div class="multi-filter-footer">

        <button
          type="button"
          class="btn"
          data-mf-cancel>
          Отмена
        </button>


        <button
          type="button"
          class="btn primary"
          data-mf-apply>
          Применить
        </button>

      </div>

    </div>
  `;


  state.menu =
    mount.querySelector(
      '.multi-filter-menu'
    );


  const button =
    mount.querySelector(
      '.multi-filter-button'
    );


  const search =
    mount.querySelector(
      '.multi-filter-search'
    );


  const list =
    mount.querySelector(
      '.multi-filter-list'
    );


  const selectAllButton =
    mount.querySelector(
      '[data-mf-all]'
    );


  const selectNoneButton =
    mount.querySelector(
      '[data-mf-none]'
    );


  const cancelButton =
    mount.querySelector(
      '[data-mf-cancel]'
    );


  const applyButton =
    mount.querySelector(
      '[data-mf-apply]'
    );


  /* =======================================================
     ОТКРЫТИЕ / ЗАКРЫТИЕ
     ======================================================= */


  button.onclick =
    event => {

      event.preventDefault();

      event.stopPropagation();


      const isClosed =
        state.menu
          .classList
          .contains(
            'hidden'
          );


      if (!isClosed) {

        state.menu
          .classList
          .add(
            'hidden'
          );


        button.setAttribute(
          'aria-expanded',
          'false'
        );


        openMultiFilter =
          null;


        return;
      }


      closeOpenMultiFilter(
        selectId
      );


      beginMultiFilterDraft(
        state
      );


      search.value =
        '';


      renderMultiFilterList(
        state
      );


      state.menu
        .classList
        .remove(
          'hidden'
        );


      button.setAttribute(
        'aria-expanded',
        'true'
      );


      openMultiFilter =
        selectId;


      setTimeout(
        () => {

          search.focus();

        },
        0
      );
    };


  state.menu.onclick =
    event => {

      event.stopPropagation();
    };


  /* =======================================================
     ПОИСК
     ======================================================= */


  search.oninput =
    () => {

      renderMultiFilterList(
        state,
        search.value
      );
    };


  /* =======================================================
     ВЫБРАТЬ ВСЕ
     ======================================================= */


  selectAllButton.onclick =
    () => {

      state.draftMode =
        'all';


      state.draft.clear();


      renderMultiFilterList(
        state,
        search.value
      );
    };


  /* =======================================================
     СНЯТЬ ВСЕ
     ======================================================= */


  selectNoneButton.onclick =
    () => {

      state.draftMode =
        'custom';


      state.draft.clear();


      renderMultiFilterList(
        state,
        search.value
      );
    };


  /* =======================================================
     ИЗМЕНЕНИЕ ГАЛОЧКИ
     ======================================================= */


  list.onchange =
    event => {

      const input =
        event.target.closest(
          'input[type="checkbox"]'
        );


      if (!input) {
        return;
      }


      materializeDraftSelection(
        state
      );


      const id =
        String(
          input.value
        );


      if (
        input.checked
      ) {

        state.draft.add(
          id
        );

      } else {

        state.draft.delete(
          id
        );
      }
    };


  /* =======================================================
     ОТМЕНА
     ======================================================= */


  cancelButton.onclick =
    () => {

      state.menu
        .classList
        .add(
          'hidden'
        );


      button.setAttribute(
        'aria-expanded',
        'false'
      );


      openMultiFilter =
        null;


      beginMultiFilterDraft(
        state
      );
    };


  /* =======================================================
     ПРИМЕНИТЬ
     ======================================================= */


  applyButton.onclick =
    () => {

      const allOptions =
        multiFilterOptions(
          state
        );


      /*
        Если выбраны все элементы вручную,
        переводим состояние обратно в "Все".
      */

      if (
        state.draftMode !==
          'all' &&
        state.draft.size ===
          allOptions.length &&
        allOptions.length >
          0
      ) {

        state.mode =
          'all';


        state.selected.clear();

      } else {

        state.mode =
          state.draftMode;


        state.selected =
          new Set(
            state.draft
          );
      }


      syncMultiFilterSource(
        state
      );


      renderMultiFilterButton(
        state
      );


      state.menu
        .classList
        .add(
          'hidden'
        );


      button.setAttribute(
        'aria-expanded',
        'false'
      );


      openMultiFilter =
        null;


      if (
        typeof state.onApply ===
        'function'
      ) {

        state.onApply(
          getMultiFilterValues(
            selectId
          )
        );
      }
    };


  syncMultiFilterSource(
    state
  );


  renderMultiFilterButton(
    state
  );


  return state;
}


/* =========================================================
   ОБНОВЛЕНИЕ ФИЛЬТРА ПОСЛЕ ИЗМЕНЕНИЯ СПРАВОЧНИКА

   Например:
   - добавили организацию;
   - импорт создал новый вид работ;
   - появился новый фронт.
   ========================================================= */


function refreshMultiFilter(
  selectId
) {

  const state =
    multiFilters.get(
      selectId
    );


  if (!state) {
    return;
  }


  const validIds =
    new Set(
      multiFilterOptions(
        state
      )
        .map(
          item =>
            item.id
        )
    );


  if (
    state.mode !==
    'all'
  ) {

    state.selected =
      new Set(
        [
          ...state.selected
        ]
          .filter(
            id =>
              validIds.has(
                id
              )
          )
      );
  }


  if (
    state.draftMode !==
    'all'
  ) {

    state.draft =
      new Set(
        [
          ...state.draft
        ]
          .filter(
            id =>
              validIds.has(
                id
              )
          )
      );
  }


  syncMultiFilterSource(
    state
  );


  renderMultiFilterButton(
    state
  );


  if (
    openMultiFilter ===
    selectId
  ) {

    const search =
      $(
        state.mountId
      )
        ?.querySelector(
          '.multi-filter-search'
        );


    renderMultiFilterList(
      state,
      search?.value ||
      ''
    );
  }
}


/* =========================================================
   ОБНОВЛЕНИЕ ВСЕХ ФИЛЬТРОВ
   ========================================================= */


function refreshAllMultiFilters() {

  [
    ...multiFilters.keys()
  ]
    .forEach(
      refreshMultiFilter
    );
}


/* =========================================================
   ПРОГРАММНАЯ УСТАНОВКА ЗНАЧЕНИЙ
   ========================================================= */


function setMultiFilterValues(
  selectId,
  values
) {

  const state =
    multiFilters.get(
      selectId
    );


  if (!state) {
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

    const valid =
      new Set(
        multiFilterOptions(
          state
        )
          .map(
            item =>
              item.id
          )
      );


    const next =
      new Set(
        (
          Array.isArray(
            values
          )
            ? values
            : [
                values
              ]
        )
          .map(
            String
          )
          .filter(
            id =>
              valid.has(
                id
              )
          )
      );


    if (
      next.size ===
        valid.size &&
      valid.size >
        0
    ) {

      state.mode =
        'all';


      state.selected.clear();

    } else {

      state.mode =
        'custom';


      state.selected =
        next;
    }
  }


  beginMultiFilterDraft(
    state
  );


  syncMultiFilterSource(
    state
  );


  renderMultiFilterButton(
    state
  );
}


/* =========================================================
   СБРОС ОДНОГО ФИЛЬТРА
   ========================================================= */


function resetMultiFilter(
  selectId,
  trigger =
    false
) {

  const state =
    multiFilters.get(
      selectId
    );


  if (!state) {
    return;
  }


  state.mode =
    'all';


  state.selected.clear();


  beginMultiFilterDraft(
    state
  );


  syncMultiFilterSource(
    state
  );


  renderMultiFilterButton(
    state
  );


  if (
    trigger &&
    typeof state.onApply ===
      'function'
  ) {

    state.onApply(
      null
    );
  }
}


/* =========================================================
   СБРОС ВСЕХ ФИЛЬТРОВ РЕСУРСОВ
   ========================================================= */


function resetResourceFilters() {

  [
    'rOrg',
    'rBuilding',
    'rWork',
    'rFront'
  ]
    .forEach(
      selectId => {

        resetMultiFilter(
          selectId,
          false
        );
      }
    );


  if (
    $('rFrom')
  ) {

    $('rFrom').value =
      '';
  }


  if (
    $('rTo')
  ) {

    $('rTo').value =
      today();
  }


  if (
    $('rDynOrg')
  ) {

    $('rDynOrg').value =
      'all';
  }


  closeOpenMultiFilter();


  if (
    typeof renderResourceCurrentView ===
    'function'
  ) {

    renderResourceCurrentView();
  }
}


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ РЕСУРСОВ
   ========================================================= */


function initResourceMultiFilters() {

  const render =
    () => {

      if (
        typeof renderResourceCurrentView ===
        'function'
      ) {

        renderResourceCurrentView();
      }
    };


  initMultiFilter(
    'rOrg',
    'rOrgMulti',
    'Все организации',
    render
  );


  initMultiFilter(
    'rBuilding',
    'rBuildingMulti',
    'Все здания',
    render
  );


  initMultiFilter(
    'rWork',
    'rWorkMulti',
    'Все работы',
    render
  );


  initMultiFilter(
    'rFront',
    'rFrontMulti',
    'Все фронты',
    render
  );
}


/* =========================================================
   ПОКАЗАТЬ НУЛЕВЫЕ ОРГАНИЗАЦИИ

   Само правило применяется в resources.js.
   Здесь только даем общий способ получить состояние.
   ========================================================= */


function resourceShowZeroOrganizations() {

  return Boolean(
    $('rShowZero')?.checked
  );
}


/* =========================================================
   ЗАКРЫТИЕ ПО КЛИКУ ВНЕ ФИЛЬТРА
   ========================================================= */


document.addEventListener(
  'click',
  () => {

    closeOpenMultiFilter();
  }
);


/* =========================================================
   ESC — ЗАКРЫТЬ ОТКРЫТЫЙ ФИЛЬТР БЕЗ ПРИМЕНЕНИЯ
   ========================================================= */


document.addEventListener(
  'keydown',
  event => {

    if (
      event.key !==
      'Escape'
    ) {
      return;
    }


    if (
      !openMultiFilter
    ) {
      return;
    }


    const state =
      multiFilters.get(
        openMultiFilter
      );


    if (!state) {
      return;
    }


    state.menu
      ?.classList
      .add(
        'hidden'
      );


    $(
      state.mountId
    )
      ?.querySelector(
        '.multi-filter-button'
      )
      ?.setAttribute(
        'aria-expanded',
        'false'
      );


    beginMultiFilterDraft(
      state
    );


    openMultiFilter =
      null;
  }
);