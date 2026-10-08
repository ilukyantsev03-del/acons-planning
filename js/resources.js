'use strict';

/* =========================================================
   LIV Planning — РЕСУРСЫ
   ========================================================= */

let livResourceView = 'journal';
let livResourceCharts = [];
let livResourcePlanFactChart = null;
let livResourceSelectedIds = new Set();
let livResourceColumns = [
  'date','organization','building','work','front',
  'itr','workers','mechanizers','equipmentType','equipmentQty','comment'
];

const LIV_RESOURCE_COLUMN_LABELS = {
  date:'Дата',
  organization:'Организация',
  building:'Здание',
  work:'Работа',
  front:'Фронт',
  itr:'ИТР',
  workers:'Рабочие',
  mechanizers:'Механизаторы',
  equipmentType:'Наименование техники',
  equipmentQty:'Количество техники',
  comment:'Комментарий'
};

function resourceShowZero(){
  return $('rShowZero')?.checked === true;
}

function resourceTotalPeople(row){
  return (
    num(row?.itr) +
    num(row?.workers) +
    num(row?.mechanizers)
  );
}

function resourceActivityTotal(rows){
  return (rows || [])
    .reduce(
      (sum,row) =>
        sum +
        resourceTotalPeople(row) +
        num(row.equipmentQty),
      0
    );
}

function hasOwn(
  object,
  key
){
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}


/* =========================================================
   ФИЛЬТР
   ========================================================= */

function resourceFiltered(
  options = {}
){

  const from =
    hasOwn(
      options,
      'from'
    )
      ? options.from
      : (
          $('rFrom')?.value ||
          ''
        );

  const to =
    hasOwn(
      options,
      'to'
    )
      ? options.to
      : (
          $('rTo')?.value ||
          ''
        );

  const orgValues =
    hasOwn(
      options,
      'organizationIds'
    )
      ? options.organizationIds
      : getMultiFilterValues(
          'rOrg'
        );

  const buildingValues =
    hasOwn(
      options,
      'buildingIds'
    )
      ? options.buildingIds
      : getMultiFilterValues(
          'rBuilding'
        );

  const workValues =
    hasOwn(
      options,
      'workIds'
    )
      ? options.workIds
      : getMultiFilterValues(
          'rWork'
        );

  const frontValues =
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

  const match =
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
          !match(
            orgValues,
            row.organizationId
          )
        ) {
          return false;
        }

        if (
          !match(
            buildingValues,
            row.buildingId
          )
        ) {
          return false;
        }

        if (
          !match(
            workValues,
            row.workId
          )
        ) {
          return false;
        }

        if (
          !match(
            frontValues,
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

function resourceColumnValue(
  row,
  column
){

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


function renderResourceColumnPanel(){

  const panel =
    $('resourceColumnsPanel');

  if (
    !panel
  ) {
    return;
  }

  panel.innerHTML =
    `
      <div class="mapping-grid">

        ${
          Object.entries(
            LIV_RESOURCE_COLUMN_LABELS
          )
            .map(
              (
                [
                  key,
                  label
                ]
              ) =>
                `
                  <label class="check-line">

                    <input
                      type="checkbox"
                      data-resource-column="${esc(key)}"
                      ${
                        livResourceColumns.includes(
                          key
                        )
                          ? 'checked'
                          : ''
                      }
                    >

                    ${esc(label)}

                  </label>
                `
            )
            .join('')
        }

      </div>
    `;

  panel
    .querySelectorAll(
      '[data-resource-column]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          () => {

            const key =
              checkbox.dataset
                .resourceColumn;

            if (
              checkbox.checked
            ) {

              if (
                !livResourceColumns.includes(
                  key
                )
              ) {
                livResourceColumns.push(
                  key
                );
              }

            } else {

              livResourceColumns =
                livResourceColumns
                  .filter(
                    item =>
                      item !==
                      key
                  );
            }

            renderResourceJournal();
          };
      }
    );
}


function renderResourceJournal(){

  const rows =
    resourceFiltered();

  const sum =
    field =>
      rows.reduce(
        (
          total,
          row
        ) =>
          total +
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
    $('resourceHead')
  ) {

    $('resourceHead').innerHTML =
      `
        <tr>

          <th class="select-col">
            <input
              id="resourceSelectAll"
              type="checkbox"
            >
          </th>

          ${
            livResourceColumns
              .map(
                key =>
                  `<th>${esc(
                    LIV_RESOURCE_COLUMN_LABELS[
                      key
                    ]
                  )}</th>`
              )
              .join('')
          }

          <th>
            Действия
          </th>

        </tr>
      `;
  }


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
          row =>
            `
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
                  livResourceColumns
                    .map(
                      column =>
                        `
                          <td>
                            ${esc(
                              resourceColumnValue(
                                row,
                                column
                              )
                            )}
                          </td>
                        `
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


function updateResourceSelectionBar(){

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


async function deleteSelectedResources(){

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


async function deleteFilteredResources(){

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
   РЕДАКТОР
   ========================================================= */

function openResourceEditor(
  id =
    null
){

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
        front =>
          `
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
              }
            >
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
          <label>Дата</label>
          <input id="rrDate" type="date" value="${esc(row.date || today())}">
        </div>

        <div class="field">
          <label>Организация</label>
          <select id="rrOrg">
            ${selectOptions(project.organizations,row.organizationId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Здание</label>
          <select id="rrBuilding">
            ${selectOptions(project.buildings,row.buildingId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Вид работ</label>
          <select id="rrWork">
            ${selectOptions(project.works,row.workId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Фронт</label>
          <select id="rrFront">
            <option value="">—</option>
            ${frontOptions}
          </select>
        </div>

        <div class="field">
          <label>ИТР</label>
          <input id="rrItr" type="number" min="0" step="1" value="${row.itr ?? ''}">
        </div>

        <div class="field">
          <label>Подсобные рабочие</label>
          <input id="rrWorkers" type="number" min="0" step="1" value="${row.workers ?? ''}">
        </div>

        <div class="field">
          <label>Механизаторы</label>
          <input id="rrMech" type="number" min="0" step="1" value="${row.mechanizers ?? ''}">
        </div>

        <div class="field">
          <label>Наименование техники</label>
          <input id="rrEqType" value="${esc(row.equipmentType || '')}">
        </div>

        <div class="field">
          <label>Количество техники</label>
          <input id="rrEqQty" type="number" min="0" step="1" value="${row.equipmentQty ?? ''}">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rrComment">${esc(row.comment || '')}</textarea>
      </div>

      <div class="editor-actions">

        ${
          id
            ? `
                <button id="rrDelete" class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

        <button id="rrSave" class="btn primary">
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
){

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
){

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
){
  return resourceFiltered({
    from:
      date,
    to:
      date
  });
}


function renderResourceDaily(){

  const date =
    $('rDailyDate')?.value ||
    $('rTo')?.value ||
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

  const peopleByOrg =
    new Map();

  const equipmentGrouped =
    new Map();


  rows.forEach(
    row => {

      const organizationId =
        String(
          row.organizationId ||
          ''
        );

      if (
        !peopleByOrg.has(
          organizationId
        )
      ) {

        peopleByOrg.set(
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
        peopleByOrg.get(
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


      const quantity =
        num(
          row.equipmentQty
        );

      const equipmentType =
        normText(
          row.equipmentType
        );


      if (
        equipmentType &&
        (
          resourceShowZero() ||
          quantity !==
          0
        )
      ) {

        const key =
          [
            organizationId,
            normKey(
              equipmentType
            )
          ]
            .join(
              '|'
            );

        if (
          !equipmentGrouped.has(
            key
          )
        ) {

          equipmentGrouped.set(
            key,
            {
              organizationId,
              equipmentType,
              quantity:
                0
            }
          );
        }

        equipmentGrouped.get(
          key
        )
          .quantity +=
            quantity;
      }
    }
  );


  let peopleRows =
    [
      ...peopleByOrg.values()
    ];

  if (
    !resourceShowZero()
  ) {

    peopleRows =
      peopleRows.filter(
        item =>
          item.itr +
          item.workers +
          item.mechanizers !==
          0
      );
  }


  peopleRows.sort(
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
      ...equipmentGrouped.values()
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


  const totalPeople =
    peopleRows.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.itr +
        item.workers +
        item.mechanizers,
      0
    );


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
          totalPeople
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


  if (
    $('rdPeopleBody')
  ) {

    $('rdPeopleBody').innerHTML =
      peopleRows
        .map(
          (
            item,
            index
          ) =>
            `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${esc(
                    nameById(
                      project.organizations,
                      item.organizationId
                    ) ||
                    '—'
                  )}
                </td>

                <td>
                  ${Math.round(item.itr)}
                </td>

                <td>
                  ${Math.round(item.workers)}
                </td>

                <td>
                  ${Math.round(item.mechanizers)}
                </td>

                <td>
                  <b>
                    ${Math.round(
                      item.itr +
                      item.workers +
                      item.mechanizers
                    )}
                  </b>
                </td>

              </tr>
            `
        )
        .join('');
  }


  if (
    $('rdEquipmentBody')
  ) {

    $('rdEquipmentBody').innerHTML =
      equipment
        .map(
          (
            item,
            index
          ) =>
            `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${esc(
                    nameById(
                      project.organizations,
                      item.organizationId
                    ) ||
                    '—'
                  )}
                </td>

                <td>
                  ${esc(
                    item.equipmentType
                  )}
                </td>

                <td>
                  ${Math.round(
                    item.quantity
                  )}
                </td>

              </tr>
            `
        )
        .join('');
  }


  if (
    $('rdEquipmentFoot')
  ) {

    $('rdEquipmentFoot')
      .textContent =
        Math.round(
          totalEquipment
        );
  }
}


/* =========================================================
   ДИНАМИКА
   ========================================================= */

function destroyResourceCharts(){

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
){

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
){

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


function renderResourceDynamics(){

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
      '<div class="card muted">Библиотека диаграмм не загрузилась.</div>';

    return;
  }


  const metric =
    $('rDynType')?.value ||
    'total';

  const step =
    $('rDynStep')?.value ||
    'week';

  const quickOrganization =
    $('rDynOrg')?.value ||
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
    quickOrganization !==
    'all'
  ) {

    organizationIds =
      organizationIds.filter(
        id =>
          id ===
          quickOrganization
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
      '<div class="card muted">Нет данных для диаграмм.</div>';

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


      const bucketMap =
        new Map();


      [
        ...daily.entries()
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
              !bucketMap.has(
                key
              )
            ) {

              bucketMap.set(
                key,
                []
              );
            }

            bucketMap.get(
              key
            )
              .push(
                value
              );
          }
        );


      const keys =
        [
          ...bucketMap.keys()
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


      const totalAverage =
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
                totalAverage(
                  bucketMap.get(
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
                  bucketMap.get(
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
                  bucketMap.get(
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
                  bucketMap.get(
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
                  bucketMap.get(
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
                  bucketMap.get(
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

      card.innerHTML =
        `
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
   АНАЛИТИКА
   ========================================================= */

function groupResourcesByOrganizationAndDay(
  rows
){

  const result =
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
          !result.has(
            key
          )
        ) {

          result.set(
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
          result.get(
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
    ...result.values()
  ];
}


function analyticsDates(
  rows,
  organizationId
){

  const method =
    $('rAvgMethod')?.value ||
    'reported';

  const from =
    $('rFrom')?.value ||
    '';

  const to =
    $('rTo')?.value ||
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
){

  const method =
    $('rAvgMethod')?.value ||
    'reported';

  const missingRule =
    $('rMissingRule')?.value ||
    'skip';

  const own =
    daily.filter(
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


function renderResourceAnalytics(){

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
        organizationId =>
          resourceActivityTotal(
            rows.filter(
              row =>
                String(
                  row.organizationId ||
                  ''
                ) ===
                organizationId
            )
          ) !==
          0
      );
  }


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
              total.average,
            days:
              Math.max(
                itr.days,
                workers.days,
                mechanizers.days,
                total.days
              )
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
    $('raPeopleBody')
  ) {

    $('raPeopleBody').innerHTML =
      peopleRows
        .map(
          item =>
            `
              <tr>
                <td>${esc(nameById(project.organizations,item.organizationId) || '—')}</td>
                <td>${Math.round(item.itr)}</td>
                <td>${Math.round(item.mechanizers)}</td>
                <td>${Math.round(item.workers)}</td>
                <td><b>${Math.round(item.total)}</b></td>
              </tr>
            `
        )
        .join('');
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
    $('raPeopleFoot')
  ) {

    $('raPeopleFoot').innerHTML =
      `
        <tr>
          <th>Среднее по организациям</th>
          <th>${Math.round(mean(peopleRows,'itr'))}</th>
          <th>${Math.round(mean(peopleRows,'mechanizers'))}</th>
          <th>${Math.round(mean(peopleRows,'workers'))}</th>
          <th>${Math.round(mean(peopleRows,'total'))}</th>
        </tr>
      `;
  }


  const equipmentTypes =
    uniq(
      rows
        .map(
          row =>
            normText(
              row.equipmentType
            )
        )
        .filter(
          Boolean
        )
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


  if (
    $('raEquipmentHead')
  ) {

    $('raEquipmentHead').innerHTML =
      `
        <tr>
          <th>Организация</th>
          ${
            equipmentTypes
              .map(
                type =>
                  `<th>${esc(type)}</th>`
              )
              .join('')
          }
        </tr>
      `;
  }


  const equipmentBody =
    organizationIds
      .map(
        organizationId => {

          const cells =
            equipmentTypes.map(
              type => {

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
                              type
                            ]
                          )
                      })
                    );

                return averageByDate(
                  own,
                  rows,
                  organizationId,
                  'metric'
                )
                  .average;
              }
            );

          return {
            organizationId,
            cells
          };
        }
      )
      .filter(
        item =>
          resourceShowZero() ||
          item.cells.some(
            value =>
              num(
                value
              ) !==
              0
          )
      );


  if (
    $('raEquipmentBody')
  ) {

    $('raEquipmentBody').innerHTML =
      equipmentBody
        .map(
          item =>
            `
              <tr>
                <td>${esc(nameById(project.organizations,item.organizationId) || '—')}</td>
                ${
                  item.cells
                    .map(
                      value =>
                        `<td>${Math.round(value)}</td>`
                    )
                    .join('')
                }
              </tr>
            `
        )
        .join('');
  }


  const globalDaily =
    new Map();


  rows.forEach(
    row => {

      if (
        !row.date
      ) {
        return;
      }

      if (
        !globalDaily.has(
          row.date
        )
      ) {

        globalDaily.set(
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
        globalDaily.get(
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
      ...globalDaily.keys()
    ]
      .sort();

  const method =
    $('rAvgMethod')?.value ||
    'reported';

  const missingRule =
    $('rMissingRule')?.value ||
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
        globalDaily.get(
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
        missingRule ===
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
   СОХРАНЕННОЕ ПРЕДСТАВЛЕНИЕ
   ========================================================= */

async function saveResourceView(){

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
        $('rFrom')?.value ||
        '',
      to:
        $('rTo')?.value ||
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
        $('rAvgMethod')?.value ||
        'reported',
      missingRule:
        $('rMissingRule')?.value ||
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
   ПЛАН / ФАКТ РЕСУРСОВ
   ========================================================= */

function resourcePlanFiltered(){

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


  const match =
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
        !Array.isArray(
          values
        ) ||
        !values.length
      ) {
        return false;
      }

      return values.includes(
        String(
          value ||
          ''
        )
      );
    };


  const from =
    $('rFrom')?.value ||
    '';

  const to =
    $('rTo')?.value ||
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
        match(
          organizations,
          plan.organizationId
        ) &&
        match(
          buildings,
          plan.buildingId
        ) &&
        match(
          works,
          plan.workId
        ) &&
        match(
          fronts,
          plan.frontId
        )
    );
}


function openResourcePlanEditor(
  id =
    null
){

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
        front =>
          `
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
              }
            >
              ${esc(frontLabel(front))}
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
          <label>Организация</label>
          <select id="rpOrg">
            ${selectOptions(project.organizations,plan.organizationId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Здание</label>
          <select id="rpBuilding">
            ${selectOptions(project.buildings,plan.buildingId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Работа</label>
          <select id="rpWork">
            ${selectOptions(project.works,plan.workId || '',true)}
          </select>
        </div>

        <div class="field">
          <label>Фронт</label>
          <select id="rpFront">
            <option value="">—</option>
            ${frontOptions}
          </select>
        </div>

        <div class="field">
          <label>С</label>
          <input id="rpStart" type="date" value="${esc(plan.startDate || today())}">
        </div>

        <div class="field">
          <label>По</label>
          <input id="rpEnd" type="date" value="${esc(plan.endDate || today())}">
        </div>

        <div class="field">
          <label>План, чел.</label>
          <input id="rpPeople" type="number" min="0" step="1" value="${plan.people ?? ''}">
        </div>

        <div class="field">
          <label>Источник / метод</label>
          <input id="rpMethod" value="${esc(plan.method || 'Ручной')}">
        </div>

      </div>

      <div class="field">
        <label>Комментарий</label>
        <textarea id="rpComment">${esc(plan.comment || '')}</textarea>
      </div>

      <div class="editor-actions">

        ${
          id
            ? `
                <button id="rpDelete" class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

        <button id="rpSave" class="btn primary">
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
){

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
){

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


function renderResourcePlanFact(){

  const plans =
    resourcePlanFiltered();

  const facts =
    resourceFiltered();

  const step =
    $('rpStep')?.value ||
    'week';

  const from =
    $('rFrom')?.value ||
    today();

  const to =
    $('rTo')?.value ||
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
    uniq([
      ...planMap.keys(),
      ...factMap.keys()
    ])
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


  if (
    $('rpHead')
  ) {

    $('rpHead').innerHTML =
      `
        <tr>
          <th>Период</th>
          <th>План</th>
          <th>Факт</th>
          <th>Отклонение</th>
        </tr>
      `;
  }


  if (
    $('rpBody')
  ) {

    $('rpBody').innerHTML =
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

            return `
              <tr>
                <td>${esc(resourceBucketLabel(key,step))}</td>
                <td>${Math.round(plan)}</td>
                <td>${Math.round(fact)}</td>
                <td>${Math.round(fact-plan)}</td>
              </tr>
            `;
          }
        )
        .join('');
  }


  if (
    $('rpFoot')
  ) {

    $('rpFoot').innerHTML =
      `
        <tr>
          <th>Итого</th>
          <th>${Math.round(planSum)}</th>
          <th>${Math.round(factSum)}</th>
          <th>${Math.round(factSum-planSum)}</th>
        </tr>
      `;
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
){

  livResourceView =
    view;

  document
    .querySelectorAll(
      '[data-rview]'
    )
    .forEach(
      button => {

        button.classList.toggle(
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
        panel.classList.add(
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


function renderResourceCurrentView(){

  if (
    livResourceView ===
    'daily'
  ) {
    return renderResourceDaily();
  }

  if (
    livResourceView ===
    'dynamics'
  ) {
    return renderResourceDynamics();
  }

  if (
    livResourceView ===
    'analytics'
  ) {
    return renderResourceAnalytics();
  }

  if (
    livResourceView ===
    'planfact'
  ) {
    return renderResourcePlanFact();
  }

  return renderResourceJournal();
}


function bindResourceUi(){

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


  bindClick(
    'resourceColumnsBtn',
    () => {

      const panel =
        $('resourceColumnsPanel');

      if (
        !panel
      ) {
        return;
      }

      panel.classList.toggle(
        'hidden'
      );

      if (
        !panel.classList.contains(
          'hidden'
        )
      ) {
        renderResourceColumnPanel();
      }
    }
  );
}