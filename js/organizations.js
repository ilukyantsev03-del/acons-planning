'use strict';

/* =========================================================
   LIV PLANNING
   ОРГАНИЗАЦИИ
   ========================================================= */


let organizationPeopleChart =
  null;


/* =========================================================
   СВЯЗАННЫЕ КЛЮЧЕВЫЕ ДАТЫ
   ========================================================= */


function organizationLinkedMilestones(
  organizationId
) {

  const contractIds =
    new Set(
      (
        project.contracts ||
        []
      )
        .filter(
          contract =>
            String(
              contract.organizationId ||
              ''
            ) ===
            String(
              organizationId
            )
        )
        .map(
          contract =>
            String(
              contract.id
            )
        )
    );


  return (
    project.milestones ||
    []
  )
    .filter(
      item =>

        String(
          item.organizationId ||
          ''
        ) ===
          String(
            organizationId
          ) ||

        (
          item.contractId &&
          contractIds.has(
            String(
              item.contractId
            )
          )
        )
    );
}


/* =========================================================
   ПОСЛЕДНИЕ РЕСУРСЫ ОРГАНИЗАЦИИ
   ========================================================= */


function organizationLatestResourceRows(
  organizationId
) {

  const rows =
    (
      project.resources ||
      []
    )
      .filter(
        row =>
          String(
            row.organizationId ||
            ''
          ) ===
          String(
            organizationId
          )
      );


  const lastDate =
    rows
      .map(
        row =>
          row.date
      )
      .filter(
        Boolean
      )
      .sort()
      .slice(
        -1
      )[0] ||
    '';


  return {

    lastDate,

    rows:
      lastDate
        ? rows.filter(
            row =>
              row.date ===
              lastDate
          )
        : []
  };
}


/* =========================================================
   АКТИВНЫЕ ФРОНТЫ ОРГАНИЗАЦИИ
   ========================================================= */


function organizationFronts(
  organizationId
) {

  return activeFronts()
    .filter(
      front =>
        String(
          front.organizationId ||
          ''
        ) ===
        String(
          organizationId
        )
    );
}


/* =========================================================
   СВЯЗАННЫЕ ДОГОВОРЫ
   ========================================================= */


function organizationContracts(
  organizationId
) {

  return (
    project.contracts ||
    []
  )
    .filter(
      contract =>
        String(
          contract.organizationId ||
          ''
        ) ===
        String(
          organizationId
        )
    );
}


/* =========================================================
   СВЯЗАННЫЕ ОГРАНИЧЕНИЯ
   ========================================================= */


function organizationConstraints(
  organizationId
) {

  const frontIds =
    new Set(
      organizationFronts(
        organizationId
      )
        .map(
          front =>
            String(
              front.id
            )
        )
    );


  return (
    project.constraints ||
    []
  )
    .filter(
      item =>

        String(
          item.organizationId ||
          ''
        ) ===
          String(
            organizationId
          ) ||

        (
          item.frontId &&
          frontIds.has(
            String(
              item.frontId
            )
          )
        )
    );
}


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ КАРТОЧКИ
   ========================================================= */


function initOrganizationCard() {

  const select =
    $('organizationCardSelect');


  if (!select) {
    return;
  }


  const current =
    select.value;


  fill(
    select,

    (
      project.organizations ||
      []
    )
      .filter(
        item =>
          item.active !==
          false
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.name ||
            ''
          )
            .localeCompare(
              String(
                b.name ||
                ''
              ),
              'ru'
            )
      ),

    undefined
  );


  if (
    current &&
    [
      ...select.options
    ]
      .some(
        option =>
          option.value ===
          current
      )
  ) {

    select.value =
      current;

  } else if (
    !select.value &&
    select.options.length
  ) {

    select.value =
      select.options[0].value;
  }


  select.onchange =
    renderOrganizationCard;


  renderOrganizationCard();
}


/* =========================================================
   ОСНОВНАЯ КАРТОЧКА ОРГАНИЗАЦИИ
   ========================================================= */


function renderOrganizationCard() {

  const select =
    $('organizationCardSelect');


  if (!select) {
    return;
  }


  const organizationId =
    select.value;


  const organization =
    byId(
      project.organizations,
      organizationId
    );


  const empty =
    $('organizationCardEmpty');


  const body =
    $('organizationCardBody');


  if (
    !organization
  ) {

    if (empty) {

      empty.classList
        .remove(
          'hidden'
        );
    }


    if (body) {

      body.classList
        .add(
          'hidden'
        );
    }


    if (
      organizationPeopleChart
    ) {

      organizationPeopleChart.destroy();

      organizationPeopleChart =
        null;
    }


    return;
  }


  if (empty) {

    empty.classList
      .add(
        'hidden'
      );
  }


  if (body) {

    body.classList
      .remove(
        'hidden'
      );
  }


  if (
    $('organizationCardName')
  ) {

    $('organizationCardName')
      .textContent =
        organization.name;
  }


  const fronts =
    organizationFronts(
      organizationId
    );


  const resourceLatest =
    organizationLatestResourceRows(
      organizationId
    );


  const people =
    resourceLatest.rows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.itr
          ) +
          num(
            row.workers
          ) +
          num(
            row.mechanizers
          ),
        0
      );


  const equipment =
    resourceLatest.rows
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          num(
            row.equipmentQty
          ),
        0
      );


  const milestones =
    organizationLinkedMilestones(
      organizationId
    );


  const contracts =
    organizationContracts(
      organizationId
    );


  const constraints =
    organizationConstraints(
      organizationId
    );


  const lateMilestones =
    milestones
      .filter(
        item => {

          const target =
            item.contractDate ||
            item.workDate ||
            item.date ||
            '';


          return (
            target &&
            !item.factDate &&
            target <
              today()
          );
        }
      );


  if (
    $('organizationPeople')
  ) {

    $('organizationPeople')
      .textContent =
        roundInt(
          people
        );
  }


  if (
    $('organizationEquipment')
  ) {

    $('organizationEquipment')
      .textContent =
        roundInt(
          equipment
        );
  }


  if (
    $('organizationFronts')
  ) {

    $('organizationFronts')
      .textContent =
        fronts.length;
  }


  if (
    $('organizationMilestones')
  ) {

    $('organizationMilestones')
      .textContent =
        milestones.length;
  }


  if (
    $('organizationLateMilestones')
  ) {

    $('organizationLateMilestones')
      .textContent =
        lateMilestones.length;
  }


  if (
    $('organizationResourceDate')
  ) {

    $('organizationResourceDate')
      .textContent =
        resourceLatest.lastDate
          ? ruDate(
              resourceLatest.lastDate
            )
          : 'нет данных';
  }


  renderOrganizationWorks(
    fronts
  );


  renderOrganizationMilestones(
    milestones
  );


  renderOrganizationPeopleChart(
    organizationId
  );


  /*
    contracts и constraints пока считаются здесь,
    чтобы карточка уже была готова к следующим вкладкам:
    Договоры / Ограничения.
  */

  return {

    organization,

    fronts,

    milestones,

    contracts,

    constraints,

    resourceLatest
  };
}


/* =========================================================
   РАБОТЫ ОРГАНИЗАЦИИ
   ========================================================= */


function renderOrganizationWorks(
  fronts
) {

  const container =
    $('organizationWorks');


  if (!container) {
    return;
  }


  const workMap =
    new Map();


  (
    fronts ||
    []
  )
    .forEach(
      front => {

        const workId =
          front.workId ||
          '';


        const workName =
          nameById(
            project.works,
            workId
          ) ||
          'Без вида работ';


        if (
          !workMap.has(
            workId
          )
        ) {

          workMap.set(
            workId,
            {

              name:
                workName,

              fronts:
                0,

              active:
                0,

              done:
                0
            }
          );
        }


        const item =
          workMap.get(
            workId
          );


        item.fronts +=
          1;


        if (
          front.status ===
          'В работе'
        ) {

          item.active +=
            1;
        }


        if (
          front.status ===
            'Завершено' ||
          front.completed
        ) {

          item.done +=
            1;
        }
      }
    );


  const rows =
    [
      ...workMap.values()
    ]
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


  container.innerHTML =
    rows.length
      ? rows
          .map(
            item => `
              <div class="organization-work-item">

                <div>
                  <b>
                    ${esc(
                      item.name
                    )}
                  </b>
                </div>

                <div class="muted">

                  Фронтов:
                  ${item.fronts}

                  · В работе:
                  ${item.active}

                  · Завершено:
                  ${item.done}

                </div>

              </div>
            `
          )
          .join('')
      : `
          <div class="muted">
            Нет привязанных работ
          </div>
        `;
}


/* =========================================================
   КЛЮЧЕВЫЕ ДАТЫ ОРГАНИЗАЦИИ
   ========================================================= */


function renderOrganizationMilestones(
  milestones
) {

  const container =
    $('organizationMilestoneList');


  if (!container) {
    return;
  }


  const rows =
    [
      ...(
        milestones ||
        []
      )
    ]
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.contractDate ||
            a.workDate ||
            a.date ||
            ''
          )
            .localeCompare(
              String(
                b.contractDate ||
                b.workDate ||
                b.date ||
                ''
              )
            )
      );


  container.innerHTML =
    rows.length
      ? rows
          .map(
            item => {

              const targetDate =
                item.contractDate ||
                item.workDate ||
                item.date ||
                '';


              const late =
                targetDate &&
                !item.factDate &&
                targetDate <
                  today();


              return `
                <div class="organization-milestone-item">

                  <div>

                    <b>
                      ${esc(
                        item.title ||
                        item.name ||
                        'Ключевая дата'
                      )}
                    </b>

                  </div>

                  <div
                    class="${
                      late
                        ? 'danger-text'
                        : 'muted'
                    }">

                    ${
                      targetDate
                        ? ruDate(
                            targetDate
                          )
                        : 'дата не указана'
                    }

                    ${
                      item.status
                        ? ` · ${esc(
                            item.status
                          )}`
                        : ''
                    }

                    ${
                      late
                        ? ' · просрочено'
                        : ''
                    }

                  </div>

                </div>
              `;
            }
          )
          .join('')
      : `
          <div class="muted">
            Ключевые даты пока не связаны
            с этой организацией
          </div>
        `;
}


/* =========================================================
   ДИНАМИКА ЧИСЛЕННОСТИ ОРГАНИЗАЦИИ
   ========================================================= */


function renderOrganizationPeopleChart(
  organizationId
) {

  const canvas =
    $('organizationPeopleChart');


  if (!canvas) {
    return;
  }


  if (
    organizationPeopleChart
  ) {

    try {

      organizationPeopleChart
        .destroy();

    } catch (
      error
    ) {

      console.warn(
        error
      );
    }


    organizationPeopleChart =
      null;
  }


  if (
    typeof Chart ===
    'undefined'
  ) {
    return;
  }


  const rows =
    (
      project.resources ||
      []
    )
      .filter(
        row =>
          String(
            row.organizationId ||
            ''
          ) ===
          String(
            organizationId
          )
      );


  const daily =
    new Map();


  rows.forEach(
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
    }
  );


  const dates =
    [
      ...daily.keys()
    ]
      .sort();


  const values =
    dates
      .map(
        date => {

          const item =
            daily.get(
              date
            );


          return roundInt(
            item.itr +
            item.workers +
            item.mechanizers
          );
        }
      );


  organizationPeopleChart =
    new Chart(
      canvas,
      {

        type:
          'line',

        data: {

          labels:
            dates.map(
              shortDate
            ),

          datasets: [

            {
              label:
                'Общая численность',

              data:
                values,

              borderWidth:
                2,

              tension:
                0.15,

              spanGaps:
                false,

              pointRadius:
                dates.length >
                  60
                  ? 0
                  : 2
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
                false
            }
          }
        }
      }
    );
}


/* =========================================================
   ОБНОВЛЕНИЕ КАРТОЧКИ ПОСЛЕ ИЗМЕНЕНИЙ
   ========================================================= */


function refreshOrganizationCard() {

  const select =
    $('organizationCardSelect');


  if (!select) {
    return;
  }


  const current =
    select.value;


  initOrganizationCard();


  if (
    current &&
    [
      ...select.options
    ]
      .some(
        option =>
          option.value ===
          current
      )
  ) {

    select.value =
      current;

    renderOrganizationCard();
  }
}