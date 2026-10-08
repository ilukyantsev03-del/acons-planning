'use strict';

/* =========================================================
   LIV PLANNING
   Универсальные множественные фильтры
   ========================================================= */

LIV.filters = LIV.filters || {};


/* =========================================================
   СОЗДАНИЕ МУЛЬТИФИЛЬТРА
   ========================================================= */

LIV.createMultiFilter = function ({
  id,
  container,
  items,
  allLabel = 'Все',
  onChange = null
}) {

  const element =
    typeof container === 'string'
      ? LIV.$(container)
      : container;


  if (!element) {
    console.warn(
      `Не найден контейнер фильтра: ${container}`
    );

    return null;
  }


  const state = {
    id,
    items: [],
    selected: new Set()
  };


  /* -------------------------------------------------------
     Получить список выбранных значений
     ------------------------------------------------------- */

  function getSelected() {

    if (
      state.selected.size === 0 ||
      state.selected.size === state.items.length
    ) {
      return null;
    }

    return [
      ...state.selected
    ];
  }


  /* -------------------------------------------------------
     Текст на кнопке фильтра
     ------------------------------------------------------- */

  function getSummary() {

    if (
      state.items.length === 0
    ) {
      return allLabel;
    }


    if (
      state.selected.size === 0 ||
      state.selected.size === state.items.length
    ) {
      return allLabel;
    }


    if (
      state.selected.size === 1
    ) {

      const selectedId =
        [...state.selected][0];


      const selectedItem =
        state.items.find(
          item =>
            item.id === selectedId
        );


      return (
        selectedItem?.name ||
        allLabel
      );
    }


    return (
      `Выбрано: ` +
      `${state.selected.size} ` +
      `из ${state.items.length}`
    );
  }


  /* -------------------------------------------------------
     Отрисовка списка чекбоксов
     ------------------------------------------------------- */

  function renderList() {

    const search =
      element.querySelector(
        '.multi-filter-search'
      );


    const list =
      element.querySelector(
        '.multi-filter-list'
      );


    if (!list) {
      return;
    }


    const searchText =
      LIV.normKey(
        search?.value || ''
      );


    const filteredItems =
      state.items.filter(
        item =>
          !searchText ||
          LIV.normKey(
            item.name
          ).includes(
            searchText
          )
      );


    list.innerHTML =
      filteredItems
        .map(
          item => {

            const checked =
              state.selected.size === 0 ||
              state.selected.has(
                item.id
              );


            return `
              <label class="multi-filter-option">

                <input
                  type="checkbox"
                  value="${LIV.esc(item.id)}"
                  ${checked ? 'checked' : ''}
                >

                <span>
                  ${LIV.esc(item.name)}
                </span>

              </label>
            `;
          }
        )
        .join('');
  }


  /* -------------------------------------------------------
     Полная отрисовка фильтра
     ------------------------------------------------------- */

  function render() {

    element.innerHTML = `
      <button
        type="button"
        class="multi-filter-button"
      >
        ${LIV.esc(getSummary())}
      </button>

      <div
        class="multi-filter-menu hidden"
      >

        <input
          type="text"
          class="multi-filter-search"
          placeholder="Поиск..."
        >

        <div class="multi-filter-actions">

          <button
            type="button"
            class="btn mf-all"
          >
            Выбрать все
          </button>

          <button
            type="button"
            class="btn mf-none"
          >
            Снять все
          </button>

          <button
            type="button"
            class="btn mf-invert"
          >
            Инвертировать
          </button>

        </div>

        <div
          class="multi-filter-list"
        ></div>

        <button
          type="button"
          class="btn primary multi-filter-apply"
        >
          Применить
        </button>

      </div>
    `;


    const button =
      element.querySelector(
        '.multi-filter-button'
      );


    const menu =
      element.querySelector(
        '.multi-filter-menu'
      );


    const search =
      element.querySelector(
        '.multi-filter-search'
      );


    button.onclick = event => {

      event.stopPropagation();

      menu.classList.toggle(
        'hidden'
      );


      renderList();
    };


    search.oninput =
      renderList;


    element
      .querySelector(
        '.mf-all'
      )
      .onclick =
        () => {

          state.selected =
            new Set(
              state.items.map(
                item => item.id
              )
            );


          renderList();
        };


    element
      .querySelector(
        '.mf-none'
      )
      .onclick =
        () => {

          state.selected =
            new Set();


          const inputs =
            element.querySelectorAll(
              '.multi-filter-list input'
            );


          inputs.forEach(
            input => {
              input.checked = false;
            }
          );
        };


    element
      .querySelector(
        '.mf-invert'
      )
      .onclick =
        () => {

          const currentSelected =
            state.selected.size === 0
              ? new Set(
                  state.items.map(
                    item => item.id
                  )
                )
              : new Set(
                  state.selected
                );


          state.selected =
            new Set(
              state.items
                .filter(
                  item =>
                    !currentSelected.has(
                      item.id
                    )
                )
                .map(
                  item =>
                    item.id
                )
            );


          renderList();
        };


    element
      .querySelector(
        '.multi-filter-apply'
      )
      .onclick =
        () => {

          const inputs =
            [
              ...element.querySelectorAll(
                '.multi-filter-list input'
              )
            ];


          const checked =
            inputs
              .filter(
                input =>
                  input.checked
              )
              .map(
                input =>
                  String(
                    input.value
                  )
              );


          if (
            checked.length ===
            state.items.length
          ) {
            state.selected =
              new Set();
          } else {
            state.selected =
              new Set(
                checked
              );
          }


          menu.classList.add(
            'hidden'
          );


          button.textContent =
            getSummary();


          if (
            typeof onChange ===
            'function'
          ) {
            onChange(
              getSelected()
            );
          }
        };


    renderList();
  }


  /* -------------------------------------------------------
     Обновление списка вариантов
     ------------------------------------------------------- */

  function setItems(nextItems) {

    const normalizedItems =
      (nextItems || [])
        .map(
          item => ({
            id:
              String(item.id),

            name:
              LIV.normText(
                item.name
              )
          })
        )
        .filter(
          item =>
            item.id &&
            item.name
        );


    state.items =
      normalizedItems;


    const validIds =
      new Set(
        normalizedItems.map(
          item =>
            item.id
        )
      );


    state.selected =
      new Set(
        [...state.selected]
          .filter(
            id =>
              validIds.has(id)
          )
      );


    render();
  }


  /* -------------------------------------------------------
     Установка выбранных значений
     ------------------------------------------------------- */

  function setSelected(values) {

    state.selected =
      new Set(
        (values || [])
          .map(
            value =>
              String(value)
          )
      );


    render();
  }


  /* -------------------------------------------------------
     API фильтра
     ------------------------------------------------------- */

  const api = {
    id,

    setItems,

    setSelected,

    getSelected,

    getItems() {
      return LIV.clone(
        state.items
      );
    },

    clear() {
      state.selected =
        new Set();

      render();
    }
  };


  LIV.filters[id] =
    api;


  setItems(items || []);


  return api;
};


/* =========================================================
   ЗАКРЫТИЕ ФИЛЬТРОВ ПО КЛИКУ ВНЕ
   ========================================================= */

document.addEventListener(
  'click',
  event => {

    document
      .querySelectorAll(
        '.multi-filter'
      )
      .forEach(
        filter => {

          if (
            !filter.contains(
              event.target
            )
          ) {
            filter
              .querySelector(
                '.multi-filter-menu'
              )
              ?.classList
              .add(
                'hidden'
              );
          }
        }
      );
  }
);