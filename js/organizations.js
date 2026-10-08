'use strict';

/* =========================================================
   LIV PLANNING
   Карточка организации
   ========================================================= */


/* =========================================================
   СОСТОЯНИЕ МОДУЛЯ
   ========================================================= */

LIV.organizations = {
  selectedOrganizationId: null,
  peopleChart: null
};


/* =========================================================
   ПОЛУЧЕНИЕ ТЕКУЩЕЙ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.getSelectedOrganization = function () {

  const select =
    LIV.$(
      'organizationCardSelect'
    );


  const selectedId =
    select?.value ||
    LIV.organizations
      .selectedOrganizationId ||
    '';


  if (!selectedId) {
    return null;
  }


  LIV.organizations
    .selectedOrganizationId =
      selectedId;


  return LIV.byId(
    LIV.project.organizations,
    selectedId
  );
};


/* =========================================================
   ЗАПОЛНЕНИЕ СПИСКА ОРГАНИЗАЦИЙ
   ========================================================= */

LIV.renderOrganizationSelect = function () {

  const select =
    LIV.$(
      'organizationCardSelect'
    );


  if (!select) {
    return;
  }


  const organizations =
    (LIV.project.organizations || [])
      .filter(
        item =>
          item.active !== false
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.name || ''
          ).localeCompare(
            String(
              b.name || ''
            ),
            'ru'
          )
      );


  const previous =
    LIV.organizations
      .selectedOrganizationId ||
    select.value ||
    organizations[0]?.id ||
    '';


  select.innerHTML =
    organizations
      .map(
        item => `
          <option
            value="${LIV.esc(item.id)}"
            ${
              String(item.id) ===
              String(previous)
                ? 'selected'
                : ''
            }
          >
            ${LIV.esc(item.name)}
          </option>
        `
      )
      .join('');


  if (
    organizations.length &&
    !select.value
  ) {
    select.value =
      organizations[0].id;
  }


  LIV.organizations
    .selectedOrganizationId =
      select.value || null;
};


/* =========================================================
   ФРОНТЫ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.getOrganizationFronts = function (
  organizationId
) {

  return (
    LIV.project.fronts ||
    []
  )
    .filter(
      front =>
        String(
          front.organizationId ||
          ''
        ) ===
        String(
          organizationId ||
          ''
        )
    );
};


/* =========================================================
   КЛЮЧЕВЫЕ ДАТЫ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.getOrganizationMilestones = function (
  organizationId
) {

  return (
    LIV.project.milestones ||
    []
  )
    .filter(
      milestone => {

        if (
          String(
            milestone.organizationId ||
            ''
          ) ===
          String(
            organizationId ||
            ''
          )
        ) {
          return true;
        }


        if (
          milestone.frontId
        ) {

          const front =
            LIV.byId(
              LIV.project.fronts,
              milestone.frontId
            );


          if (
            String(
              front?.organizationId ||
              ''
            ) ===
            String(
              organizationId ||
              ''
            )
          ) {
            return true;
          }
        }


        if (
          milestone.contractId
        ) {

          const contract =
            LIV.byId(
              LIV.project.contracts,
              milestone.contractId
            );


          if (
            String(
              contract?.organizationId ||
              ''
            ) ===
            String(
              organizationId ||
              ''
            )
          ) {
            return true;
          }
        }


        return false;
      }
    );
};


/* =========================================================
   РАБОТЫ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.getOrganizationWorks = function (
  organizationId
) {

  const fronts =
    LIV.getOrganizationFronts(
      organizationId
    );


  const workIds =
    LIV.unique(
      fronts
        .map(
          front =>
            front.workId
        )
        .filter(Boolean)
    );


  return workIds
    .map(
      workId => {

        const work =
          LIV.byId(
            LIV.project.works,
            workId
          );


        const frontCount =
          fronts.filter(
            front =>
              String(
                front.workId
              ) ===
              String(
                workId
              )
          ).length;


        return {
          id:
            workId,

          name:
            work?.name ||
            'Без названия',

          frontCount
        };
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        a.name.localeCompare(
          b.name,
          'ru'
        )
    );
};


/* =========================================================
   РЕСУРСЫ ОРГАНИЗАЦИИ НА ПОСЛЕДНЮЮ ДАТУ
   ========================================================= */

LIV.getOrganizationCurrentResources = function (
  organizationId
) {

  const rows =
    (
      LIV.project.resources ||
      []
    )
      .filter(
        row =>
          String(
            row.organizationId ||
            ''
          ) ===
          String(
            organizationId ||
            ''
          ) &&
          row.date
      );


  if (!rows.length) {
    return {
      date: null,
      people: 0,
      equipment: 0
    };
  }


  const latestDate =
    rows
      .map(
        row =>
          row.date
      )
      .sort()
      .at(-1);


  const latestRows =
    rows.filter(
      row =>
        row.date ===
        latestDate
    );


  const people =
    latestRows.reduce(
      (
        total,
        row
      ) =>
        total +
        LIV.getResourcePeopleTotal(
          row
        ),
      0
    );


  const equipment =
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


  return {
    date:
      latestDate,

    people:
      LIV.roundInt(
        people
      ),

    equipment:
      LIV.roundInt(
        equipment
      )
  };
};


/* =========================================================
   ДИНАМИКА ЛЮДЕЙ
   ========================================================= */

LIV.getOrganizationPeopleDynamics = function (
  organizationId
) {

  const rows =
    (
      LIV.project.resources ||
      []
    )
      .filter(
        row =>
          String(
            row.organizationId ||
            ''
          ) ===
          String(
            organizationId ||
            ''
          ) &&
          row.date
      );


  const dates =
    LIV.unique(
      rows.map(
        row =>
          row.date
      )
    )
      .sort();


  return dates.map(
    date => {

      const dayRows =
        rows.filter(
          row =>
            row.date ===
            date
        );


      const itr =
        dayRows.reduce(
          (
            total,
            row
          ) =>
            total +
            LIV.num(
              row.itr
            ),
          0
        );


      const workers =
        dayRows.reduce(
          (
            total,
            row
          ) =>
            total +
            LIV.num(
              row.workers
            ),
          0
        );


      const mechanizers =
        dayRows.reduce(
          (
            total,
            row
          ) =>
            total +
            LIV.num(
              row.mechanizers
            ),
          0
        );


      return {
        date,

        itr:
          LIV.roundInt(
            itr
          ),

        workers:
          LIV.roundInt(
            workers
          ),

        mechanizers:
          LIV.roundInt(
            mechanizers
          ),

        total:
          LIV.roundInt(
            itr +
            workers +
            mechanizers
          )
      };
    }
  );
};


/* =========================================================
   ГРАФИК ЛЮДЕЙ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.renderOrganizationPeopleChart = function (
  organizationId
) {

  const canvas =
    LIV.$(
      'organizationPeopleChart'
    );


  if (
    !canvas ||
    typeof Chart ===
    'undefined'
  ) {
    return;
  }


  if (
    LIV.organizations
      .peopleChart
  ) {
    try {
      LIV.organizations
        .peopleChart
        .destroy();
    } catch (error) {
      console.warn(error);
    }
  }


  const dynamics =
    LIV.getOrganizationPeopleDynamics(
      organizationId
    );


  LIV.organizations
    .peopleChart =
      new Chart(
        canvas,
        {
          type:
            'line',

          data: {
            labels:
              dynamics.map(
                item =>
                  LIV.shortDate(
                    item.date
                  )
              ),

            datasets: [
              {
                label:
                  'ИТР',

                data:
                  dynamics.map(
                    item =>
                      item.itr
                  ),

                borderWidth:
                  2,

                tension:
                  0.15
              },

              {
                label:
                  'Рабочие',

                data:
                  dynamics.map(
                    item =>
                      item.workers
                  ),

                borderWidth:
                  2,

                tension:
                  0.15
              },

              {
                label:
                  'Механизаторы',

                data:
                  dynamics.map(
                    item =>
                      item.mechanizers
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
            }
          }
        }
      );
};


/* =========================================================
   ОТРИСОВКА КАРТОЧКИ ОРГАНИЗАЦИИ
   ========================================================= */

LIV.renderOrganizationCard = function () {

  const organization =
    LIV.getSelectedOrganization();


  if (!organization) {

    if (
      LIV.$(
        'organizationCard'
      )
    ) {
      LIV.$(
        'organizationCard'
      ).innerHTML = `
        <div class="card">
          Нет организаций для отображения.
        </div>
      `;
    }

    return;
  }


  const organizationId =
    organization.id;


  const resources =
    LIV.getOrganizationCurrentResources(
      organizationId
    );


  const fronts =
    LIV.getOrganizationFronts(
      organizationId
    );


  const milestones =
    LIV.getOrganizationMilestones(
      organizationId
    );


  const works =
    LIV.getOrganizationWorks(
      organizationId
    );


  if (
    LIV.$(
      'organizationCardName'
    )
  ) {
    LIV.$(
      'organizationCardName'
    ).textContent =
      organization.name ||
      'Организация';
  }


  if (
    LIV.$(
      'organizationPeople'
    )
  ) {
    LIV.$(
      'organizationPeople'
    ).textContent =
      resources.people;
  }


  if (
    LIV.$(
      'organizationEquipment'
    )
  ) {
    LIV.$(
      'organizationEquipment'
    ).textContent =
      resources.equipment;
  }


  if (
    LIV.$(
      'organizationFronts'
    )
  ) {
    LIV.$(
      'organizationFronts'
    ).textContent =
      fronts.length;
  }


  if (
    LIV.$(
      'organizationMilestones'
    )
  ) {
    LIV.$(
      'organizationMilestones'
    ).textContent =
      milestones.length;
  }


  if (
    LIV.$(
      'organizationWorks'
    )
  ) {

    if (!works.length) {
      LIV.$(
        'organizationWorks'
      ).innerHTML = `
        <div class="muted">
          Связанные работы пока не найдены.
        </div>
      `;
    } else {
      LIV.$(
        'organizationWorks'
      ).innerHTML =
        works
          .map(
            work => `
              <div class="organization-work-item">

                <strong>
                  ${LIV.esc(
                    work.name
                  )}
                </strong>

                <div class="muted">
                  Фронтов: ${work.frontCount}
                </div>

              </div>
            `
          )
          .join('');
    }
  }


  if (
    LIV.$(
      'organizationMilestoneList'
    )
  ) {

    const sortedMilestones =
      [...milestones]
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.date ||
              a.planDate ||
              a.deadline ||
              ''
            )
              .localeCompare(
                String(
                  b.date ||
                  b.planDate ||
                  b.deadline ||
                  ''
                )
              )
        );


    if (
      !sortedMilestones.length
    ) {
      LIV.$(
        'organizationMilestoneList'
      ).innerHTML = `
        <div class="muted">
          Связанные ключевые даты пока не найдены.
        </div>
      `;
    } else {

      LIV.$(
        'organizationMilestoneList'
      ).innerHTML =
        sortedMilestones
          .map(
            milestone => {

              const date =
                milestone.date ||
                milestone.planDate ||
                milestone.deadline ||
                '';


              const name =
                milestone.name ||
                milestone.title ||
                milestone.description ||
                'Ключевая дата';


              const status =
                milestone.status ||
                '';


              return `
                <div class="organization-milestone-item">

                  <strong>
                    ${LIV.esc(name)}
                  </strong>

                  <div class="muted">
                    ${
                      date
                        ? LIV.ruDate(
                            date
                          )
                        : 'Дата не указана'
                    }
                    ${
                      status
                        ? ` · ${LIV.esc(status)}`
                        : ''
                    }
                  </div>

                </div>
              `;
            }
          )
          .join('');
    }
  }


  LIV.renderOrganizationPeopleChart(
    organizationId
  );
};


/* =========================================================
   ОБЩАЯ ОТРИСОВКА МОДУЛЯ
   ========================================================= */

LIV.renderOrganizations = function () {

  LIV.renderOrganizationSelect();

  LIV.renderOrganizationCard();
};


/* =========================================================
   СОБЫТИЯ
   ========================================================= */

LIV.bindOrganizationEvents = function () {

  LIV.$(
    'organizationCardSelect'
  )
    ?.addEventListener(
      'change',
      function () {

        LIV.organizations
          .selectedOrganizationId =
            this.value;


        LIV.renderOrganizationCard();
      }
    );
};