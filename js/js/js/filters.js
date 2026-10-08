'use strict';


LIV.filters = {};


LIV.createMultiFilter =
  function ({
    id,
    container,
    items,
    allLabel,
    onChange
  }) {

    const element =
      typeof container ===
        'string'
        ? LIV.$(container)
        : container;


    const state = {
      id,
      items: [],
      selected:
        new Set()
    };


    function setItems(
      nextItems
    ) {
      state.items =
        (nextItems || [])
          .map(
            item => ({
              id:
                String(item.id),

              name:
                item.name
            })
          );

      const valid =
        new Set(
          state.items.map(
            item =>
              item.id
          )
        );

      state.selected =
        new Set(
          [...state.selected]
            .filter(
              value =>
                valid.has(value)
            )
        );

      render();
    }


    function summary() {

      if (
        state.selected.size ===
        0 ||
        state.selected.size ===
        state.items.length
      ) {
        return allLabel;
      }

      if (
        state.selected.size ===
        1
      ) {
        const selectedId =
          [...state.selected][0];

        return (
          state.items.find(
            item =>
              item.id ===
              selectedId
          )?.name ||
          allLabel
        );
      }

      return (
        `Выбрано: ` +
        `${state.selected.size} ` +
        `из ${state.items.length}`
      );
    }


    function render() {

      element.innerHTML = `
        <button
          type="button"
          class="multi-filter-button">

          ${LIV.esc(summary())}

        </button>

        <div
          class="multi-filter-menu hidden">

          <input
            class="multi-filter-search"
            placeholder="Поиск..."
          >

          <div class="multi-filter-actions">

            <button
              type="button"
              class="btn mf-all">
              Выбрать все
            </button>

            <button
              type="button"
              class="btn mf-none">
              Снять все
            </button>

            <button
              type="button"
              class="btn mf-invert">
              Инвертировать
            </button>

          </div>

          <div class="multi-filter-list"></div>

          <button
            type="button"
            class="btn primary multi-filter-apply">
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

      const list =
        element.querySelector(
          '.multi-filter-list'
        );


      function renderList() {

        const searchText =
          LIV.normKey(
            search.value
          );

        list.innerHTML =
          state.items
            .filter(
              item =>
                !searchText ||
                LIV.normKey(
                  item.name
                ).includes(
                  searchText
                )
            )
            .map(
              item => `
                <label
                  class="multi-filter-option">

                  <input
                    type="checkbox"
                    value="${LIV.esc(item.id)}"
                    ${
                      state.selected.size === 0 ||
                      state.selected.has(item.id)
                        ? 'checked'
                        : ''
                    }
                  >

                  <span>
                    ${LIV.esc(item.name)}
                  </span>

                </label>
              `
            )
            .join('');
      }


      button.onclick =
        () => {

          menu.classList.toggle(
            'hidden'
          );

          renderList();
        };


      search.oninput =
        renderList;


      element.querySelector(
        '.mf-all'
      ).onclick =
        () => {

          state.selected =
            new Set(
              state.items.map(
                item =>
                  item.id
              )
            );

          renderList();
        };


      element.querySelector(
        '.mf-none'
      ).onclick =
        () => {

          state.selected =
            new Set();

          list
            .querySelectorAll(
              'input'
            )
            .forEach(
              input =>
                input.checked =
                  false
            );
        };


      element.querySelector(
        '.mf-invert'
      ).onclick =
        () => {

          const current =
            new Set(
              state.selected.size
                ? state.selected
                : state.items.map(
                    item =>
                      item.id
                  )
            );

          state.selected =
            new Set(
              state.items
                .filter(
                  item =>
                    !current.has(
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


      element.querySelector(
        '.multi-filter-apply'
      ).onclick =
        () => {

          const checked =
            [
              ...list.querySelectorAll(
                'input:checked'
              )
            ]
              .map(
                input =>
                  input.value
              );

          const visibleCount =
            list.querySelectorAll(
              'input'
            ).length;

          if (
            checked.length ===
            visibleCount &&
            visibleCount ===
            state.items.length
          ) {
            state.selected =
              new Set();
          } else {
            state.selected =
              new Set(checked);
          }

          menu.classList.add(
            'hidden'
          );

          button.textContent =
            summary();

          if (onChange) {
            onChange(
              api.getSelected()
            );
          }
        };


      renderList();
    }


    const api = {

      setItems,

      getSelected() {

        if (
          state.selected.size ===
            0 ||
          state.selected.size ===
            state.items.length
        ) {
          return null;
        }

        return [
          ...state.selected
        ];
      },

      setSelected(
        values
      ) {
        state.selected =
          new Set(
            (values || [])
              .map(String)
          );

        render();
      }
    };


    LIV.filters[id] =
      api;


    setItems(items);


    return api;
  };
