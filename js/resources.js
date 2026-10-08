'use strict';

/* =========================================================
   LIV PLANNING
   РЕСУРСЫ
   ========================================================= */

let resourceSelectedIds = new Set();
let resourceCharts = [];
let resourcePlanFactChart = null;
let resourceView = 'journal';

const RESOURCE_COLUMN_LABELS = {
  date: 'Дата',
  organization: 'Организация',
  building: 'Здание',
  work: 'Работа',
  front: 'Фронт',
  itr: 'ИТР',
  workers: 'Рабочие',
  mechanizers: 'Механизаторы',
  equipmentType: 'Техника',
  equipmentQty: 'Кол.',
  comment: 'Комментарий'
};

let resourceColumns = [
  'date',
  'organization',
  'building',
  'work',
  'front',
  'itr',
  'workers',
  'mechanizers',
  'equipmentType',
  'equipmentQty',
  'comment'
];

function resourceShowZero() {
  return typeof resourceShowZeroOrganizations === 'function'
    ? resourceShowZeroOrganizations()
    : Boolean($('rShowZero')?.checked);
}

function resourceTotalPeople(row) {
  return num(row?.itr) + num(row?.workers) + num(row?.mechanizers);
}

function resourceActivityTotal(rows) {
  return (rows || []).reduce(
    (sum, row) => sum + resourceTotalPeople(row) + num(row.equipmentQty),
    0
  );
}

function resourceMatches(values, value) {
  if (values === null || values === undefined) return true;
  if (!Array.isArray(values) || values.length === 0) return false;
  return values.includes(String(value ?? ''));
}

function resourceFiltered(options = {}) {
  const from = options.from ?? $('rFrom')?.value ?? '';
  const to = options.to ?? $('rTo')?.value ?? '';

  const organizationIds =
    options.organizationIds ?? getMultiFilterValues('rOrg');

  const buildingIds =
    options.buildingIds ?? getMultiFilterValues('rBuilding');

  const workIds =
    options.workIds ?? getMultiFilterValues('rWork');

  const frontIds =
    options.frontIds ?? getMultiFilterValues('rFront');

  return (project.resources || []).filter(
    row =>
      (!from || row.date >= from) &&
      (!to || row.date <= to) &&
      resourceMatches(
        organizationIds,
        row.organizationId
      ) &&
      resourceMatches(
        buildingIds,
        row.buildingId
      ) &&
      resourceMatches(
        workIds,
        row.workId
      ) &&
      resourceMatches(
        frontIds,
        row.frontId
      )
  );
}


/* =========================================================
   ЖУРНАЛ
   ========================================================= */

function resourceColumnValue(
  row,
  column
) {

  if (column === 'date') {
    return ruDate(row.date);
  }

  if (column === 'organization') {
    return (
      nameById(
        project.organizations,
        row.organizationId
      ) || '—'
    );
  }

  if (column === 'building') {
    return (
      nameById(
        project.buildings,
        row.buildingId
      ) || '—'
    );
  }

  if (column === 'work') {
    return (
      nameById(
        project.works,
        row.workId
      ) || '—'
    );
  }

  if (column === 'front') {

    return row.frontId
      ? frontLabel(
          byId(
            project.fronts,
            row.frontId
          )
        )
      : '—';
  }

  if (
    [
      'itr',
      'workers',
      'mechanizers',
      'equipmentQty'
    ].includes(column)
  ) {

    return roundInt(
      row[column]
    );
  }

  return row[column] ?? '';
}


function renderResourceColumnPanel() {

  const panel =
    $('resourceColumnsPanel');

  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <div class="mapping-grid">

      ${
        Object.entries(
          RESOURCE_COLUMN_LABELS
        )
          .map(
            ([key, label]) => `
              <label class="check-line">

                <input
                  type="checkbox"
                  data-resource-column="${key}"
                  ${
                    resourceColumns.includes(key)
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
      input => {

        input.onchange =
          () => {

            const key =
              input.dataset
                .resourceColumn;

            if (
              input.checked
            ) {

              if (
                !resourceColumns.includes(
                  key
                )
              ) {

                resourceColumns.push(
                  key
                );
              }

            } else {

              resourceColumns =
                resourceColumns
                  .filter(
                    item =>
                      item !== key
                  );
            }

            renderResourceJournal();
          };
      }
    );
}


function renderResourceJournal() {

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
            row[field]
          ),
        0
      );

  const byDay =
    new Map();

  rows.forEach(
    row => {

      const date =
        row.date || '';

      byDay.set(
        date,
        (
          byDay.get(date) ||
          0
        ) +
        resourceTotalPeople(
          row
        )
      );
    }
  );

  if ($('rItr')) {
    $('rItr').textContent =
      roundInt(
        sum('itr')
      );
  }

  if ($('rWorkers')) {
    $('rWorkers').textContent =
      roundInt(
        sum('workers')
      );
  }

  if ($('rMech')) {
    $('rMech').textContent =
      roundInt(
        sum('mechanizers')
      );
  }

  if ($('rTotalPeople')) {
    $('rTotalPeople').textContent =
      roundInt(
        sum('itr') +
        sum('workers') +
        sum('mechanizers')
      );
  }

  if ($('rPeak')) {
    $('rPeak').textContent =
      roundInt(
        Math.max(
          0,
          ...byDay.values()
        )
      );
  }

  if ($('rEquipDays')) {
    $('rEquipDays').textContent =
      roundInt(
        sum('equipmentQty')
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

  resourceSelectedIds =
    new Set(
      [
        ...resourceSelectedIds
      ]
        .filter(
          id =>
            visibleIds.has(
              id
            )
        )
    );

  if ($('resourceHead')) {

    $('resourceHead').innerHTML = `
      <tr>

        <th style="width:42px">

          <input
            id="resourceSelectAll"
            class="resource-check-all"
            type="checkbox"
            aria-label="Выбрать все видимые строки"
          >

        </th>

        ${
          resourceColumns
            .map(
              key =>
                `<th>${esc(
                  RESOURCE_COLUMN_LABELS[
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

  if ($('resourceRows')) {

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
          row => `
            <tr>

              <td>

                <input
                  class="resource-row-check"
                  type="checkbox"
                  data-resource-select="${esc(
                    row.id
                  )}"
                  ${
                    resourceSelectedIds
                      .has(
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
                resourceColumns
                  .map(
                    column =>
                      `<td>${esc(
                        resourceColumnValue(
                          row,
                          column
                        )
                      )}</td>`
                  )
                  .join('')
              }

              <td>

                <div class="table-actions">

                  <button
                    class="row-btn"
                    data-resource-edit="${esc(
                      row.id
                    )}">
                    Открыть
                  </button>

                  <button
                    class="row-btn danger-text"
                    data-resource-delete="${esc(
                      row.id
                    )}">
                    Удалить
                  </button>

                </div>

              </td>

            </tr>
          `
        )
        .join('') ||
      `
        <tr>

          <td
            colspan="${
              resourceColumns.length +
              2
            }">

            <div class="empty-state">

              <strong>
                Нет записей
              </strong>

              Измени фильтры
              или добавь данные ресурсов.

            </div>

          </td>

        </tr>
      `;
  }

  document
    .querySelectorAll(
      '[data-resource-select]'
    )
    .forEach(
      input => {

        input.onchange =
          () => {

            const id =
              String(
                input.dataset
                  .resourceSelect
              );

            if (
              input.checked
            ) {

              resourceSelectedIds.add(
                id
              );

            } else {

              resourceSelectedIds.delete(
                id
              );
            }

            updateResourceSelectionBar();

            updateResourceSelectAllState(
              rows
            );
          };
      }
    );

  const selectAll =
    $('resourceSelectAll');

  if (
    selectAll
  ) {

    selectAll.onchange =
      () => {

        rows.forEach(
          row => {

            const id =
              String(
                row.id
              );

            if (
              selectAll.checked
            ) {

              resourceSelectedIds.add(
                id
              );

            } else {

              resourceSelectedIds.delete(
                id
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

  updateResourceSelectAllState(
    rows
  );
}


function updateResourceSelectAllState(
  rows =
    resourceFiltered()
) {

  const selectAll =
    $('resourceSelectAll');

  if (!selectAll) {
    return;
  }

  const selectedVisible =
    rows
      .filter(
        row =>
          resourceSelectedIds
            .has(
              String(
                row.id
              )
            )
      )
      .length;

  selectAll.checked =
    rows.length >
      0 &&
    selectedVisible ===
      rows.length;

  selectAll.indeterminate =
    selectedVisible >
      0 &&
    selectedVisible <
      rows.length;
}


function updateResourceSelectionBar() {

  const count =
    resourceSelectedIds.size;

  if (
    $('resourceSelectedCount')
  ) {

    $('resourceSelectedCount')
      .textContent =
        count
          ? `Выбрано: ${count}`
          : 'Ничего не выбрано';
  }

  if (
    $('resourceDeleteSelectedBtn')
  ) {

    $('resourceDeleteSelectedBtn')
      .disabled =
        count ===
        0;
  }
}


async function createResourceSafetySnapshot(
  prefix
) {

  await dbPutKey(
    clone(
      project
    ),
    `${prefix}-${Date.now()}`
  );
}


async function deleteSelectedResources() {

  if (
    !resourceSelectedIds.size
  ) {
    return;
  }

  if (
    !confirm(
      `Удалить выбранные записи ресурсов: ${resourceSelectedIds.size}? Перед удалением будет создана защитная копия.`
    )
  ) {
    return;
  }

  await createResourceSafetySnapshot(
    'pre-resource-delete'
  );

  const before =
    project.resources.length;

  project.resources =
    project.resources
      .filter(
        row =>
          !resourceSelectedIds
            .has(
              String(
                row.id
              )
            )
      );

  const deleted =
    before -
    project.resources.length;

  resourceSelectedIds.clear();

  log(
    'Удалено',
    'Ресурсы',
    `Удалено выбранных записей: ${deleted}`
  );

  await saveProject();

  renderResourceCurrentView();
}


async function deleteFilteredResources() {

  const rows =
    resourceFiltered();

  if (
    !rows.length
  ) {

    alert(
      'По текущим фильтрам нет записей для удаления.'
    );

    return;
  }

  if (
    !confirm(
      `Удалить ВСЕ записи по текущим фильтрам: ${rows.length}? Перед удалением будет создана защитная копия.`
    )
  ) {
    return;
  }

  await createResourceSafetySnapshot(
    'pre-resource-filter-delete'
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
    project.resources
      .filter(
        row =>
          !ids.has(
            String(
              row.id
            )
          )
      );

  resourceSelectedIds.clear();

  log(
    'Удалено',
    'Ресурсы',
    `Удалено по фильтру: ${rows.length}`
  );

  await saveProject();

  renderResourceCurrentView();
}


/* =========================================================
   РЕДАКТОР РЕСУРСОВ
   ========================================================= */

function openResourceEditor(
  id =
    null
) {

  const existing =
    id
      ? byId(
          project.resources,
          id
        )
      : null;

  const row =
    existing ||
    {};

  const fronts =
    activeFronts();

  openModal(
    id
      ? 'Редактирование ресурсов'
      : 'Добавить ресурсы',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            Дата
          </label>

          <input
            id="rrDate"
            type="date"
            value="${esc(
              row.date ||
              today()
            )}"
          >

        </div>

        <div class="field">

          <label>
            Организация
          </label>

          <select id="rrOrg">

            ${
              selectOptions(
                project.organizations,
                row.organizationId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Здание
          </label>

          <select id="rrBuilding">

            ${
              selectOptions(
                project.buildings,
                row.buildingId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Вид работ
          </label>

          <select id="rrWork">

            ${
              selectOptions(
                project.works,
                row.workId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Фронт
          </label>

          <select id="rrFront">

            <option value="">
              —
            </option>

            ${
              fronts
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
                          row.frontId ||
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
                .join('')
            }

          </select>

        </div>

        <div class="field">

          <label>
            ИТР
          </label>

          <input
            id="rrItr"
            type="number"
            min="0"
            step="1"
            value="${row.itr ?? ''}"
          >

        </div>

        <div class="field">

          <label>
            Рабочие
          </label>

          <input
            id="rrWorkers"
            type="number"
            min="0"
            step="1"
            value="${row.workers ?? ''}"
          >

        </div>

        <div class="field">

          <label>
            Механизаторы
          </label>

          <input
            id="rrMech"
            type="number"
            min="0"
            step="1"
            value="${row.mechanizers ?? ''}"
          >

        </div>

        <div class="field">

          <label>
            Наименование техники
          </label>

          <input
            id="rrEqType"
            value="${esc(
              row.equipmentType ||
              ''
            )}"
            placeholder="Например: экскаватор"
          >

        </div>

        <div class="field">

          <label>
            Количество техники
          </label>

          <input
            id="rrEqQty"
            type="number"
            min="0"
            step="1"
            value="${
              row.equipmentQty ??
              ''
            }"
          >

        </div>

      </div>

      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="rrComment">${esc(
          row.comment ||
          ''
        )}</textarea>

      </div>

      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="rrDelete"
                  class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

        <button
          id="rrSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );

  $('rrFront').onchange =
    () => {

      const front =
        byId(
          project.fronts,
          $('rrFront').value
        );

      if (!front) {
        return;
      }

      const structure =
        byId(
          project.structures,
          front.structureId
        );

      if (
        structure?.buildingId
      ) {
        $('rrBuilding').value =
          structure.buildingId;
      }

      if (
        front.workId
      ) {
        $('rrWork').value =
          front.workId;
      }

      if (
        front.organizationId &&
        !$('rrOrg').value
      ) {
        $('rrOrg').value =
          front.organizationId;
      }
    };

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
  id =
    null
) {

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
      roundInt(
        $('rrItr').value
      ),

    workers:
      roundInt(
        $('rrWorkers').value
      ),

    mechanizers:
      roundInt(
        $('rrMech').value
      ),

    equipmentType:
      $('rrEqType')
        .value
        .trim(),

    equipmentQty:
      roundInt(
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

  initSelects();

  refreshAllMultiFilters();

  renderAll();
}


async function deleteResource(
  id
) {

  const row =
    byId(
      project.resources,
      id
    );

  if (!row) {
    return;
  }

  if (
    !confirm(
      'Удалить эту запись ресурсов? Перед удалением будет создана защитная копия.'
    )
  ) {
    return;
  }

  await createResourceSafetySnapshot(
    'pre-resource-row-delete'
  );

  project.resources =
    project.resources
      .filter(
        item =>
          String(
            item.id
          ) !==
          String(
            id
          )
      );

  resourceSelectedIds.delete(
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
) {

  return resourceFiltered({
    from:
      date,
    to:
      date
  });
}


function renderResourceDaily() {

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

  const equipmentByOrgType =
    new Map();

  rows.forEach(
    row => {

      const organizationId =
        row.organizationId ||
        '';

      if (
        !peopleByOrg.has(
          organizationId
        )
      ) {

        peopleByOrg.set(
          organizationId,
          {
            organizationId,
            itr: 0,
            workers: 0,
            mechanizers: 0,
            equipment: 0
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

      people.equipment +=
        num(
          row.equipmentQty
        );

      if (
        row.equipmentType ||
        num(
          row.equipmentQty
        ) !==
          0
      ) {

        const type =
          row.equipmentType ||
          'Без наименования';

        const key =
          `${organizationId}|${normKey(
            type
          )}`;

        if (
          !equipmentByOrgType.has(
            key
          )
        ) {

          equipmentByOrgType.set(
            key,
            {
              organizationId,
              equipmentType:
                type,
              quantity:
                0
            }
          );
        }

        equipmentByOrgType
          .get(
            key
          )
          .quantity +=
            num(
              row.equipmentQty
            );
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
      peopleRows
        .filter(
          item =>
            item.itr !==
              0 ||
            item.workers !==
              0 ||
            item.mechanizers !==
              0 ||
            item.equipment !==
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

  let equipmentRows =
    [
      ...equipmentByOrgType.values()
    ];

  if (
    !resourceShowZero()
  ) {

    equipmentRows =
      equipmentRows
        .filter(
          item =>
            item.quantity !==
            0
        );
  }

  equipmentRows.sort(
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
    peopleRows
      .reduce(
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
    equipmentRows
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.quantity,
        0
      );

  if (
    $('rdPeopleTotal')
  ) {

    $('rdPeopleTotal')
      .textContent =
        roundInt(
          totalPeople
        );
  }

  if (
    $('rdEquipmentTotal')
  ) {

    $('rdEquipmentTotal')
      .textContent =
        roundInt(
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
          ) => `
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
                ${roundInt(
                  item.itr
                )}
              </td>

              <td>
                ${roundInt(
                  item.workers
                )}
              </td>

              <td>
                ${roundInt(
                  item.mechanizers
                )}
              </td>

              <td>
                <b>
                  ${roundInt(
                    item.itr +
                    item.workers +
                    item.mechanizers
                  )}
                </b>
              </td>

            </tr>
          `
        )
        .join('') ||
      `
        <tr>

          <td colspan="6">

            <div class="empty-state">
              Нет данных за выбранную дату.
            </div>

          </td>

        </tr>
      `;
  }

  if (
    $('rdEquipmentBody')
  ) {

    $('rdEquipmentBody').innerHTML =
      equipmentRows
        .map(
          (
            item,
            index
          ) => `
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
                ${roundInt(
                  item.quantity
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
              Нет данных по технике.
            </div>

          </td>

        </tr>
      `;
  }

  if (
    $('rdEquipmentFoot')
  ) {

    $('rdEquipmentFoot')
      .textContent =
        roundInt(
          totalEquipment
        );
  }
}


/* =========================================================
   ДИНАМИКА
   ========================================================= */

function destroyResourceCharts() {

  resourceCharts
    .forEach(
      chart => {

        try {

          chart.destroy();

        } catch (
          error
        ) {

          console.warn(
            error
          );
        }
      }
    );

  resourceCharts =
    [];
}


function resourceBucketKey(
  date,
  step
) {

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
      `${String(
        date
      )
        .slice(
          0,
          7
        )}-01`
    );
  }

  return date;
}


function resourceBucketLabel(
  key,
  step
) {

  if (
    step ===
    'month'
  ) {

    const [
      year,
      month
    ] =
      key.split('-');

    return (
      `${month}.${year}`
    );
  }

  if (
    step ===
    'week'
  ) {

    return (
      `с ${shortDate(
        key
      )}`
    );
  }

  return shortDate(
    key
  );
}


function aggregateResourceDay(
  rows
) {

  return rows.reduce(
    (
      acc,
      row
    ) => {

      acc.itr +=
        num(
          row.itr
        );

      acc.workers +=
        num(
          row.workers
        );

      acc.mechanizers +=
        num(
          row.mechanizers
        );

      acc.equipment +=
        num(
          row.equipmentQty
        );

      return acc;
    },
    {
      itr: 0,
      workers: 0,
      mechanizers: 0,
      equipment: 0
    }
  );
}


function averageResourceBucket(
  items,
  field
) {

  if (
    !items.length
  ) {
    return null;
  }

  return roundInt(
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        num(
          item[field]
        ),
      0
    ) /
    items.length
  );
}


function renderResourceDynamics() {

  destroyResourceCharts();

  const container =
    $('resourceCharts');

  if (!container) {
    return;
  }

  container.innerHTML =
    '';

  if (
    typeof Chart ===
    'undefined'
  ) {

    container.innerHTML = `
      <div class="card muted">
        Библиотека диаграмм не загрузилась.
      </div>
    `;

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

  let rows =
    resourceFiltered();

  if (
    quickOrganization !==
    'all'
  ) {

    rows =
      rows.filter(
        row =>
          String(
            row.organizationId
          ) ===
          String(
            quickOrganization
          )
      );
  }

  let organizationIds =
    uniq(
      rows.map(
        row =>
          row.organizationId ||
          ''
      )
    );

  if (
    !resourceShowZero()
  ) {

    organizationIds =
      organizationIds
        .filter(
          id =>
            resourceActivityTotal(
              rows.filter(
                row =>
                  String(
                    row.organizationId ||
                    ''
                  ) ===
                  String(
                    id
                  )
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

    container.innerHTML = `
      <div class="card muted">
        Нет данных для диаграмм.
      </div>
    `;

    return;
  }

  organizationIds.forEach(
    organizationId => {

      const orgRows =
        rows.filter(
          row =>
            String(
              row.organizationId ||
              ''
            ) ===
            String(
              organizationId
            )
        );

      const byDate =
        new Map();

      orgRows.forEach(
        row => {

          const date =
            row.date;

          if (!date) {
            return;
          }

          if (
            !byDate.has(
              date
            )
          ) {

            byDate.set(
              date,
              []
            );
          }

          byDate
            .get(
              date
            )
            .push(
              row
            );
        }
      );

      const dayValues =
        [
          ...byDate.entries()
        ]
          .sort(
            (
              a,
              b
            ) =>
              a[0]
                .localeCompare(
                  b[0]
                )
          )
          .map(
            (
              [
                date,
                dayRows
              ]
            ) => ({
              date,
              ...aggregateResourceDay(
                dayRows
              )
            })
          );

      const buckets =
        new Map();

      dayValues.forEach(
        item => {

          const key =
            resourceBucketKey(
              item.date,
              step
            );

          if (
            !buckets.has(
              key
            )
          ) {

            buckets.set(
              key,
              []
            );
          }

          buckets
            .get(
              key
            )
            .push(
              item
            );
        }
      );

      const keys =
        [
          ...buckets.keys()
        ]
          .sort();

      const datasets =
        [];

      const valuesFor =
        field =>
          keys.map(
            key =>
              averageResourceBucket(
                buckets.get(
                  key
                ),
                field
              )
          );

      const totalValues =
        keys.map(
          key => {

            const items =
              buckets.get(
                key
              );

            if (
              !items.length
            ) {
              return null;
            }

            return roundInt(
              items.reduce(
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
              items.length
            );
          }
        );

      const common = {
        borderWidth: 2,
        tension: 0.15,
        spanGaps: false,
        pointRadius: 2
      };

      if (
        metric ===
        'total'
      ) {

        datasets.push({
          label:
            'Общая численность',
          data:
            totalValues,
          ...common
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
            valuesFor(
              'itr'
            ),
          ...common
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
            valuesFor(
              'workers'
            ),
          ...common
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
            valuesFor(
              'itr'
            ),
          ...common
        });

        datasets.push({
          label:
            'Рабочие',
          data:
            valuesFor(
              'workers'
            ),
          ...common
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
            valuesFor(
              'equipment'
            ),
          ...common
        });
      }

      const card =
        document.createElement(
          'div'
        );

      card.className =
        'card resource-chart-card';

      card.innerHTML = `
        <h2>
          ${esc(
            nameById(
              project.organizations,
              organizationId
            ) ||
            'Без организации'
          )}
        </h2>

        <div class="resource-chart-subtitle">

          ${
            step ===
              'day'
              ? 'по дням'
              : step ===
                  'week'
                ? 'среднее по неделям'
                : 'среднее по месяцам'
          }

        </div>

        <div class="resource-chart-box">

          <canvas></canvas>

        </div>
      `;

      container.appendChild(
        card
      );

      const chart =
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

                x: {

                  ticks: {
                    maxRotation:
                      0,
                    autoSkip:
                      true,
                    maxTicksLimit:
                      14
                  }
                },

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
                },

                tooltip: {
                  enabled:
                    true
                }
              }
            }
          }
        );

      resourceCharts.push(
        chart
      );
    }
  );
}


/* =========================================================
   АНАЛИТИКА
   ========================================================= */

function groupResourcesByOrganizationAndDay(
  rows
) {

  const result =
    new Map();

  rows.forEach(
    row => {

      const organizationId =
        row.organizationId ||
        '';

      const date =
        row.date ||
        '';

      if (!date) {
        return;
      }

      const key =
        `${organizationId}|${date}`;

      if (
        !result.has(
          key
        )
      ) {

        result.set(
          key,
          {
            organizationId,
            date,
            itr: 0,
            workers: 0,
            mechanizers: 0,
            equipment: 0,
            equipmentTypes: {}
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

      const equipmentType =
        normText(
          row.equipmentType
        );

      if (
        equipmentType
      ) {

        item.equipmentTypes[
          equipmentType
        ] =
          (
            item.equipmentTypes[
              equipmentType
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


function resourceAnalysisDates(
  method,
  from,
  to,
  organizationId,
  dailyRows
) {

  if (
    !from ||
    !to
  ) {

    return uniq(
      dailyRows.map(
        item =>
          item.date
      )
    )
      .sort();
  }

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
      resourceFiltered({
        from,
        to,
        organizationIds:
          null
      })
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

  return uniq(
    dailyRows
      .filter(
        item =>
          String(
            item.organizationId
          ) ===
          String(
            organizationId
          )
      )
      .map(
        item =>
          item.date
      )
  )
    .sort();
}


function averageMetricForOrganization({
  dailyRows,
  organizationId,
  field,
  method,
  missingRule,
  from,
  to
}) {

  const orgByDate =
    new Map(
      dailyRows
        .filter(
          item =>
            String(
              item.organizationId
            ) ===
            String(
              organizationId
            )
        )
        .map(
          item => [
            item.date,
            item
          ]
        )
    );

  const dates =
    resourceAnalysisDates(
      method,
      from,
      to,
      organizationId,
      dailyRows
    );

  const values =
    [];

  dates.forEach(
    date => {

      const row =
        orgByDate.get(
          date
        );

      if (!row) {

        if (
          missingRule ===
          'zero'
        ) {

          values.push(
            0
          );
        }

        return;
      }

      const value =
        num(
          row[field]
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
    }
  );

  if (
    !values.length
  ) {

    return {
      average: 0,
      count: 0
    };
  }

  return {
    average:
      roundInt(
        values.reduce(
          (
            sum,
            value
          ) =>
            sum +
            value,
          0
        ) /
        values.length
      ),

    count:
      values.length
  };
}


function renderResourceAnalytics() {

  const rows =
    resourceFiltered();

  const dailyRows =
    groupResourcesByOrganizationAndDay(
      rows
    );

  const method =
    $('rAvgMethod')?.value ||
    'reported';

  const missingRule =
    $('rMissingRule')?.value ||
    'skip';

  const from =
    $('rFrom')?.value ||
    '';

  const to =
    $('rTo')?.value ||
    '';

  let organizationIds =
    uniq(
      dailyRows.map(
        item =>
          item.organizationId
      )
    );

  if (
    !resourceShowZero()
  ) {

    organizationIds =
      organizationIds
        .filter(
          id => {

            const orgRows =
              dailyRows
                .filter(
                  item =>
                    String(
                      item.organizationId
                    ) ===
                    String(
                      id
                    )
                );

            return orgRows.some(
              item =>
                item.itr ||
                item.workers ||
                item.mechanizers ||
                item.equipment
            );
          }
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

  const peopleRows =
    organizationIds
      .map(
        organizationId => {

          const itr =
            averageMetricForOrganization({
              dailyRows,
              organizationId,
              field:
                'itr',
              method,
              missingRule,
              from,
              to
            });

          const workers =
            averageMetricForOrganization({
              dailyRows,
              organizationId,
              field:
                'workers',
              method,
              missingRule,
              from,
              to
            });

          const mechanizers =
            averageMetricForOrganization({
              dailyRows,
              organizationId,
              field:
                'mechanizers',
              method,
              missingRule,
              from,
              to
            });

          return {
            organizationId,
            itr:
              itr.average,
            workers:
              workers.average,
            mechanizers:
              mechanizers.average,
            total:
              itr.average +
              workers.average +
              mechanizers.average,
            days:
              Math.max(
                itr.count,
                workers.count,
                mechanizers.count
              )
          };
        }
      );

  if (
    $('raPeopleBody')
  ) {

    $('raPeopleBody').innerHTML =
      peopleRows
        .map(
          item => `
            <tr>

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
                ${roundInt(
                  item.itr
                )}
              </td>

              <td>
                ${roundInt(
                  item.mechanizers
                )}
              </td>

              <td>
                ${roundInt(
                  item.workers
                )}
              </td>

              <td>
                <b>
                  ${roundInt(
                    item.total
                  )}
                </b>
              </td>

            </tr>
          `
        )
        .join('') ||
      `
        <tr>

          <td colspan="5">

            <div class="empty-state">
              Нет данных для расчета.
            </div>

          </td>

        </tr>
      `;
  }

  const peopleTotal =
    peopleRows
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.total,
        0
      );

  const daysCount =
    peopleRows.length
      ? Math.max(
          ...peopleRows.map(
            item =>
              item.days
          )
        )
      : 0;

  if (
    $('raPeopleAvg')
  ) {

    $('raPeopleAvg').textContent =
      roundInt(
        peopleTotal
      );
  }

  if (
    $('raDaysCount')
  ) {

    $('raDaysCount').textContent =
      roundInt(
        daysCount
      );
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

  const equipmentTable =
    organizationIds
      .map(
        organizationId => {

          const values =
            {};

          equipmentTypes.forEach(
            type => {

              const orgRows =
                rows
                  .filter(
                    row =>
                      String(
                        row.organizationId ||
                        ''
                      ) ===
                        String(
                          organizationId
                        ) &&
                      normText(
                        row.equipmentType
                      ) ===
                        type
                  );

              const byDate =
                new Map();

              orgRows.forEach(
                row => {

                  byDate.set(
                    row.date,
                    (
                      byDate.get(
                        row.date
                      ) ||
                      0
                    ) +
                    num(
                      row.equipmentQty
                    )
                  );
                }
              );

              let dates;

              if (
                method ===
                'calendar'
              ) {

                dates =
                  dateRange(
                    from,
                    to
                  );

              } else if (
                method ===
                'workdays'
              ) {

                dates =
                  dateRange(
                    from,
                    to
                  )
                    .filter(
                      isWorkday
                    );

              } else if (
                method ===
                'project-report-days'
              ) {

                dates =
                  uniq(
                    resourceFiltered({
                      from,
                      to,
                      organizationIds:
                        null
                    })
                      .map(
                        row =>
                          row.date
                      )
                  )
                    .sort();

              } else {

                dates =
                  [
                    ...byDate.keys()
                  ]
                    .sort();
              }

              const array =
                [];

              dates.forEach(
                date => {

                  if (
                    !byDate.has(
                      date
                    )
                  ) {

                    if (
                      missingRule ===
                      'zero'
                    ) {

                      array.push(
                        0
                      );
                    }

                    return;
                  }

                  const value =
                    byDate.get(
                      date
                    );

                  if (
                    method ===
                      'nonzero' &&
                    value ===
                      0
                  ) {
                    return;
                  }

                  array.push(
                    value
                  );
                }
              );

              values[
                type
              ] =
                array.length
                  ? roundInt(
                      array.reduce(
                        (
                          sum,
                          value
                        ) =>
                          sum +
                          value,
                        0
                      ) /
                      array.length
                    )
                  : 0;
            }
          );

          return {
            organizationId,
            values
          };
        }
      );

  if (
    $('raEquipmentHead')
  ) {

    $('raEquipmentHead').innerHTML = `
      <tr>

        <th>
          Организация
        </th>

        ${
          equipmentTypes
            .map(
              type =>
                `<th>${esc(
                  type
                )}</th>`
            )
            .join('')
        }

        <th>
          Итого
        </th>

      </tr>
    `;
  }

  if (
    $('raEquipmentBody')
  ) {

    $('raEquipmentBody').innerHTML =
      equipmentTable
        .map(
          item => {

            const total =
              equipmentTypes
                .reduce(
                  (
                    sum,
                    type
                  ) =>
                    sum +
                    num(
                      item.values[
                        type
                      ]
                    ),
                  0
                );

            return `
              <tr>

                <td>
                  ${esc(
                    nameById(
                      project.organizations,
                      item.organizationId
                    ) ||
                    '—'
                  )}
                </td>

                ${
                  equipmentTypes
                    .map(
                      type =>
                        `<td>${roundInt(
                          item.values[
                            type
                          ]
                        )}</td>`
                    )
                    .join('')
                }

                <td>
                  <b>
                    ${roundInt(
                      total
                    )}
                  </b>
                </td>

              </tr>
            `;
          }
        )
        .join('') ||
      `
        <tr>

          <td
            colspan="${
              equipmentTypes.length +
              2
            }">

            <div class="empty-state">
              Нет данных по технике.
            </div>

          </td>

        </tr>
      `;
  }

  const equipmentTotal =
    equipmentTable
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          equipmentTypes
            .reduce(
              (
                inner,
                type
              ) =>
                inner +
                num(
                  item.values[
                    type
                  ]
                ),
              0
            ),
        0
      );

  if (
    $('raEquipmentAvg')
  ) {

    $('raEquipmentAvg').textContent =
      roundInt(
        equipmentTotal
      );
  }
}


/* =========================================================
   СОХРАНЕНИЕ ПРЕДСТАВЛЕНИЯ
   ========================================================= */

async function saveResourceView() {

  const name =
    prompt(
      'Название представления:'
    );

  if (
    !name?.trim()
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

    type:
      'resources',

    name:
      name.trim(),

    createdAt:
      nowIso(),

    config: {

      view:
        resourceView,

      from:
        $('rFrom')?.value ||
        '',

      to:
        $('rTo')?.value ||
        '',

      organizationIds:
        getMultiFilterValues(
          'rOrg'
        ),

      buildingIds:
        getMultiFilterValues(
          'rBuilding'
        ),

      workIds:
        getMultiFilterValues(
          'rWork'
        ),

      frontIds:
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
        'skip',

      columns:
        [
          ...resourceColumns
        ]
    }
  });

  log(
    'Сохранено',
    'Представление',
    `Ресурсы · ${name.trim()}`
  );

  await saveProject();

  alert(
    'Представление сохранено.'
  );
}


/* =========================================================
   ПЛАН / ФАКТ РЕСУРСОВ
   ========================================================= */

function resourcePlanRows() {

  const from =
    $('rFrom')?.value ||
    '';

  const to =
    $('rTo')?.value ||
    '';

  const orgs =
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

  return (
    project.resourcePlans ||
    []
  )
    .filter(
      row =>
        (
          !from ||
          row.to >=
            from
        ) &&
        (
          !to ||
          row.from <=
            to
        ) &&
        resourceMatches(
          orgs,
          row.organizationId
        ) &&
        resourceMatches(
          buildings,
          row.buildingId
        ) &&
        resourceMatches(
          works,
          row.workId
        ) &&
        resourceMatches(
          fronts,
          row.frontId
        )
    );
}


function resourcePlanDailyValue(
  plan,
  date
) {

  if (
    !date ||
    date <
      plan.from ||
    date >
      plan.to
  ) {
    return 0;
  }

  if (
    plan.calendar ===
      'workdays' &&
    !isWorkday(
      date
    )
  ) {
    return 0;
  }

  return num(
    plan.people
  );
}


function openResourcePlanEditor(
  id =
    null
) {

  const existing =
    id
      ? byId(
          project.resourcePlans,
          id
        )
      : null;

  const plan =
    existing ||
    {};

  openModal(
    id
      ? 'Редактировать план ресурсов'
      : 'Добавить план ресурсов',

    `
      <div class="form-grid">

        <div class="field">

          <label>
            С
          </label>

          <input
            id="rppFrom"
            type="date"
            value="${esc(
              plan.from ||
              $('rFrom')?.value ||
              today()
            )}"
          >

        </div>

        <div class="field">

          <label>
            По
          </label>

          <input
            id="rppTo"
            type="date"
            value="${esc(
              plan.to ||
              $('rTo')?.value ||
              today()
            )}"
          >

        </div>

        <div class="field">

          <label>
            Организация
          </label>

          <select id="rppOrg">

            ${
              selectOptions(
                project.organizations,
                plan.organizationId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Здание
          </label>

          <select id="rppBuilding">

            ${
              selectOptions(
                project.buildings,
                plan.buildingId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Работа
          </label>

          <select id="rppWork">

            ${
              selectOptions(
                project.works,
                plan.workId ||
                '',
                true
              )
            }

          </select>

        </div>

        <div class="field">

          <label>
            Средняя численность, чел.
          </label>

          <input
            id="rppPeople"
            type="number"
            min="0"
            step="1"
            value="${plan.people ?? ''}"
          >

        </div>

        <div class="field">

          <label>
            Календарь
          </label>

          <select id="rppCalendar">

            <option
              value="calendar"
              ${
                plan.calendar !==
                'workdays'
                  ? 'selected'
                  : ''
              }>
              Календарные дни
            </option>

            <option
              value="workdays"
              ${
                plan.calendar ===
                'workdays'
                  ? 'selected'
                  : ''
              }>
              Рабочие дни 5/2
            </option>

          </select>

        </div>

      </div>

      <div class="field">

        <label>
          Комментарий
        </label>

        <textarea id="rppComment">${esc(
          plan.comment ||
          ''
        )}</textarea>

      </div>

      <div class="editor-actions">

        ${
          id
            ? `
                <button
                  id="rppDelete"
                  class="btn danger">
                  Удалить
                </button>
              `
            : ''
        }

        <button
          id="rppSave"
          class="btn primary">
          Сохранить
        </button>

      </div>
    `
  );

  $('rppSave').onclick =
    () =>
      saveResourcePlan(
        id
      );

  if (
    id &&
    $('rppDelete')
  ) {

    $('rppDelete').onclick =
      () =>
        deleteResourcePlan(
          id
        );
  }
}


async function saveResourcePlan(
  id =
    null
) {

  const existing =
    id
      ? byId(
          project.resourcePlans,
          id
        )
      : null;

  const from =
    $('rppFrom').value;

  const to =
    $('rppTo').value;

  if (
    !from ||
    !to ||
    from >
      to
  ) {

    alert(
      'Проверь период плана.'
    );

    return;
  }

  const row = {

    id:
      existing?.id ||
      uid(
        'RP'
      ),

    from,

    to,

    organizationId:
      $('rppOrg').value,

    buildingId:
      $('rppBuilding').value,

    workId:
      $('rppWork').value,

    frontId:
      existing?.frontId ||
      '',

    people:
      roundInt(
        $('rppPeople').value
      ),

    calendar:
      $('rppCalendar').value,

    comment:
      $('rppComment')
        .value
        .trim(),

    createdAt:
      existing?.createdAt ||
      nowIso(),

    updatedAt:
      nowIso()
  };

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
      : 'Добавлено',
    'План ресурсов',
    `${from}–${to} · ${row.people} чел.`
  );

  await saveProject();

  closeModal();

  renderResourcePlanFact();
}


async function deleteResourcePlan(
  id
) {

  const row =
    byId(
      project.resourcePlans,
      id
    );

  if (!row) {
    return;
  }

  if (
    !confirm(
      'Удалить этот план ресурсов?'
    )
  ) {
    return;
  }

  project.resourcePlans =
    project.resourcePlans
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
    `${row.from}–${row.to}`
  );

  await saveProject();

  closeModal();

  renderResourcePlanFact();
}


function renderResourcePlanFact() {

  const step =
    $('rpStep')?.value ||
    'week';

  const from =
    $('rFrom')?.value ||
    '';

  const to =
    $('rTo')?.value ||
    '';

  if (
    !from ||
    !to
  ) {

    if (
      $('rpBody')
    ) {

      $('rpBody').innerHTML = `
        <tr>

          <td colspan="5">

            <div class="empty-state">
              Укажи период сверху.
            </div>

          </td>

        </tr>
      `;
    }

    return;
  }

  const dates =
    dateRange(
      from,
      to
    );

  const plans =
    resourcePlanRows();

  const factRows =
    resourceFiltered();

  const daily =
    dates.map(
      date => {

        const plan =
          plans.reduce(
            (
              sum,
              row
            ) =>
              sum +
              resourcePlanDailyValue(
                row,
                date
              ),
            0
          );

        const fact =
          factRows
            .filter(
              row =>
                row.date ===
                date
            )
            .reduce(
              (
                sum,
                row
              ) =>
                sum +
                resourceTotalPeople(
                  row
                ),
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

  let displayRows;

  if (
    step ===
    'week'
  ) {

    const map =
      new Map();

    daily.forEach(
      item => {

        const key =
          startOfWeek(
            item.date
          );

        if (
          !map.has(
            key
          )
        ) {

          map.set(
            key,
            {
              key,
              plan: 0,
              fact: 0
            }
          );
        }

        const target =
          map.get(
            key
          );

        target.plan +=
          item.plan;

        target.fact +=
          item.fact;
      }
    );

    displayRows =
      [
        ...map.values()
      ]
        .sort(
          (
            a,
            b
          ) =>
            a.key
              .localeCompare(
                b.key
              )
        )
        .map(
          item => ({
            period:
              `с ${ruDate(
                item.key
              )}`,
            key:
              item.key,
            plan:
              item.plan,
            fact:
              item.fact,
            deviation:
              item.fact -
              item.plan
          })
        );

  } else {

    displayRows =
      daily.map(
        item => ({
          period:
            ruDate(
              item.date
            ),
          key:
            item.date,
          plan:
            item.plan,
          fact:
            item.fact,
          deviation:
            item.deviation
        })
      );
  }

  const planSum =
    displayRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.plan,
        0
      );

  const factSum =
    displayRows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.fact,
        0
      );

  if (
    $('rpPlanSum')
  ) {

    $('rpPlanSum').textContent =
      roundInt(
        planSum
      );
  }

  if (
    $('rpFactSum')
  ) {

    $('rpFactSum').textContent =
      roundInt(
        factSum
      );
  }

  if (
    $('rpDeviation')
  ) {

    $('rpDeviation').textContent =
      roundInt(
        factSum -
        planSum
      );
  }

  if (
    $('rpHead')
  ) {

    $('rpHead').innerHTML = `
      <tr>

        <th>
          Период
        </th>

        <th>
          План
        </th>

        <th>
          Факт
        </th>

        <th>
          Отклонение
        </th>

      </tr>
    `;
  }

  if (
    $('rpBody')
  ) {

    $('rpBody').innerHTML =
      displayRows
        .map(
          row => `
            <tr>

              <td>
                ${esc(
                  row.period
                )}
              </td>

              <td>
                ${roundInt(
                  row.plan
                )}
              </td>

              <td>
                ${roundInt(
                  row.fact
                )}
              </td>

              <td
                class="${
                  row.deviation <
                    0
                    ? 'danger-text'
                    : row.deviation >
                        0
                      ? 'success-text'
                      : ''
                }">

                ${roundInt(
                  row.deviation
                )}

              </td>

            </tr>
          `
        )
        .join('');
  }

  if (
    $('rpFoot')
  ) {

    $('rpFoot').innerHTML = `
      <tr>

        <th>
          Итого
        </th>

        <th>
          ${roundInt(
            planSum
          )}
        </th>

        <th>
          ${roundInt(
            factSum
          )}
        </th>

        <th>
          ${roundInt(
            factSum -
            planSum
          )}
        </th>

      </tr>
    `;
  }

  if (
    resourcePlanFactChart
  ) {

    try {

      resourcePlanFactChart
        .destroy();

    } catch (
      error
    ) {

      console.warn(
        error
      );
    }

    resourcePlanFactChart =
      null;
  }

  const canvas =
    $('resourcePlanFactChart');

  if (
    canvas &&
    typeof Chart !==
      'undefined'
  ) {

    resourcePlanFactChart =
      new Chart(
        canvas,
        {

          type:
            'line',

          data: {

            labels:
              displayRows
                .map(
                  row =>
                    row.period
                ),

            datasets: [

              {
                label:
                  'План',
                data:
                  displayRows
                    .map(
                      row =>
                        roundInt(
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
                  displayRows
                    .map(
                      row =>
                        roundInt(
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
                position:
                  'top'
              }
            }
          }
        }
      );
  }
}


/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ПРЕДСТАВЛЕНИЙ
   ========================================================= */

function renderResourceCurrentView() {

  document
    .querySelectorAll(
      '.resource-view'
    )
    .forEach(
      section =>
        section.classList.add(
          'hidden'
        )
    );

  document
    .querySelectorAll(
      '.resource-tab'
    )
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset
            .rview ===
            resourceView
        );
      }
    );

  const section =
    $(
      `rview-${resourceView}`
    );

  if (
    section
  ) {

    section.classList.remove(
      'hidden'
    );
  }

  if (
    resourceView ===
    'journal'
  ) {
    renderResourceJournal();
  }

  if (
    resourceView ===
    'daily'
  ) {
    renderResourceDaily();
  }

  if (
    resourceView ===
    'dynamics'
  ) {
    renderResourceDynamics();
  }

  if (
    resourceView ===
    'analytics'
  ) {
    renderResourceAnalytics();
  }

  if (
    resourceView ===
    'planfact'
  ) {
    renderResourcePlanFact();
  }
}


function switchResourceView(
  name
) {

  resourceView =
    name ||
    'journal';

  renderResourceCurrentView();
}


function renderResources() {

  refreshAllMultiFilters();

  renderResourceCurrentView();
}


/* =========================================================
   СОБЫТИЯ РЕСУРСОВ
   ========================================================= */

function bindResourceUi() {

  document
    .querySelectorAll(
      '.resource-tab'
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

  if (
    $('newResourceBtn')
  ) {

    $('newResourceBtn').onclick =
      () =>
        openResourceEditor();
  }

  if (
    $('resourceDeleteSelectedBtn')
  ) {

    $('resourceDeleteSelectedBtn')
      .onclick =
        deleteSelectedResources;
  }

  if (
    $('resourceDeleteFilteredBtn')
  ) {

    $('resourceDeleteFilteredBtn')
      .onclick =
        deleteFilteredResources;
  }

  if (
    $('resourceColumnsBtn')
  ) {

    $('resourceColumnsBtn').onclick =
      () => {

        const panel =
          $('resourceColumnsPanel');

        if (!panel) {
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
      };
  }

  if (
    $('resourceResetFiltersBtn')
  ) {

    $('resourceResetFiltersBtn')
      .onclick =
        resetResourceFilters;
  }

  [
    'rFrom',
    'rTo'
  ]
    .forEach(
      id => {

        if (
          $(id)
        ) {

          $(id).onchange =
            renderResourceCurrentView;
        }
      }
    );

  if (
    $('rShowZero')
  ) {

    $('rShowZero').onchange =
      renderResourceCurrentView;
  }

  if (
    $('rDailyDate')
  ) {

    $('rDailyDate').onchange =
      renderResourceDaily;
  }

  if (
    $('rDynType')
  ) {

    $('rDynType').onchange =
      renderResourceDynamics;
  }

  if (
    $('rDynStep')
  ) {

    $('rDynStep').onchange =
      renderResourceDynamics;
  }

  if (
    $('rDynOrg')
  ) {

    $('rDynOrg').onchange =
      renderResourceDynamics;
  }

  if (
    $('rAvgMethod')
  ) {

    $('rAvgMethod').onchange =
      renderResourceAnalytics;
  }

  if (
    $('rMissingRule')
  ) {

    $('rMissingRule').onchange =
      renderResourceAnalytics;
  }

  if (
    $('saveResourceViewBtn')
  ) {

    $('saveResourceViewBtn').onclick =
      saveResourceView;
  }

  if (
    $('newResourcePlanBtn')
  ) {

    $('newResourcePlanBtn').onclick =
      () =>
        openResourcePlanEditor();
  }

  if (
    $('rpStep')
  ) {

    $('rpStep').onchange =
      renderResourcePlanFact;
  }
}