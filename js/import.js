'use strict';

/* =========================================================
   LIV Planning — ИМПОРТ
   Excel / CSV -> единая база LIV Planning
   ========================================================= */


/* =========================================================
   ДАТЫ
   ========================================================= */

function normDate(
  value
){

  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return '';
  }


  if (
    value instanceof
      Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return (
      `${value.getFullYear()}-` +
      `${String(value.getMonth()+1).padStart(2,'0')}-` +
      `${String(value.getDate()).padStart(2,'0')}`
    );
  }


  if (
    typeof value ===
      'number' &&
    value >
      20000 &&
    value <
      80000 &&
    window.XLSX
  ) {

    const parsed =
      XLSX.SSF
        .parse_date_code(
          value
        );

    if (
      parsed
    ) {

      return (
        `${parsed.y}-` +
        `${String(parsed.m).padStart(2,'0')}-` +
        `${String(parsed.d).padStart(2,'0')}`
      );
    }
  }


  const text =
    normText(
      value
    );


  let match =
    text.match(
      /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/
    );


  if (
    match
  ) {

    const year =
      match[
        3
      ]
        .length ===
        2
        ? '20' +
          match[
            3
          ]
        : match[
            3
          ];

    return (
      `${year}-` +
      `${match[2].padStart(2,'0')}-` +
      `${match[1].padStart(2,'0')}`
    );
  }


  match =
    text.match(
      /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/
    );


  if (
    match
  ) {

    return (
      `${match[1]}-` +
      `${match[2].padStart(2,'0')}-` +
      `${match[3].padStart(2,'0')}`
    );
  }


  return '';
}


/* =========================================================
   СПРАВОЧНИКИ
   ========================================================= */

function strictNameKey(
  value
){

  return String(
    value ??
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .toLocaleLowerCase(
      'ru-RU'
    );
}


/*
  ВАЖНО:
  для организаций НЕ используем агрессивную нормализацию.

  Поэтому:
  ООО "Пауэр Проджектс"
  ООО "Пауэр Проджектс"(кладка)
  ООО "Пауэр Проджектс" - сети

  останутся разными организациями.
*/

function ensureNamed(
  list,
  prefix,
  name,
  extra =
    {}
){

  const clean =
    normText(
      name
    );

  if (
    !clean
  ) {
    return null;
  }


  let item =
    list.find(
      row =>
        strictNameKey(
          row.name
        ) ===
        strictNameKey(
          clean
        )
    );


  if (
    !item
  ) {

    item = {
      id:
        uid(
          prefix
        ),
      name:
        clean,
      active:
        true,
      ...extra
    };

    list.push(
      item
    );
  }


  return item;
}


function ensureStructure(
  data
){

  const candidate = {

    buildingId:
      data.buildingId ||
      '',

    block:
      normText(
        data.block
      ),

    floor:
      normText(
        data.floor
      ),

    capture:
      normText(
        data.capture
      ),

    axis:
      normText(
        data.axis
      ),

    side:
      normText(
        data.side
      ),

    zone:
      normText(
        data.zone
      ),

    roomNo:
      normText(
        data.roomNo
      ),

    roomName:
      normText(
        data.roomName
      )
  };


  const signature =
    structureSignature(
      candidate
    );


  let structure =
    (
      project.structures ||
      []
    )
      .find(
        row =>
          (
            row.signature ||
            structureSignature(
              row
            )
          ) ===
          signature
      );


  if (
    !structure
  ) {

    structure = {
      id:
        uid(
          'STR'
        ),
      ...candidate,
      signature
    };

    project.structures.push(
      structure
    );

  } else if (
    !structure.signature
  ) {

    structure.signature =
      signature;
  }


  return structure;
}


/* =========================================================
   ПОЛЯ
   ========================================================= */

const FIELD_DEFS = {

  building: {
    label:
      'Здание',
    aliases: [
      'здание',
      'объект',
      'сооружение',
      'корпус'
    ]
  },

  block: {
    label:
      'Блок',
    aliases: [
      'блок',
      'секция'
    ]
  },

  floor: {
    label:
      'Этаж',
    aliases: [
      'этаж',
      'уровень'
    ]
  },

  capture: {
    label:
      'Захватка',
    aliases: [
      'захватка',
      'номер захватки',
      '№ захватки'
    ]
  },

  axis: {
    label:
      'Ось',
    aliases: [
      'ось',
      'оси'
    ]
  },

  side: {
    label:
      'Сторона',
    aliases: [
      'сторона',
      'фасад'
    ]
  },

  zone: {
    label:
      'Зона',
    aliases: [
      'зона',
      'участок',
      'ряд'
    ]
  },

  roomNo: {
    label:
      '№ помещения',
    aliases: [
      '№ помещения',
      'номер помещения'
    ]
  },

  roomName: {
    label:
      'Помещение',
    aliases: [
      'помещение',
      'название помещения'
    ]
  },

  work: {
    label:
      'Работа',
    aliases: [
      'работа',
      'вид работы',
      'вид работ',
      'наименование работы',
      'название задачи',
      'наименование задачи'
    ]
  },

  organization: {
    label:
      'Организация',
    aliases: [
      'организация',
      'подрядчик',
      'субподрядчик',
      'исполнитель'
    ]
  },

  status: {
    label:
      'Статус',
    aliases: [
      'статус',
      'состояние'
    ]
  },

  unit: {
    label:
      'Ед. изм.',
    aliases: [
      'ед. изм.',
      'ед изм',
      'единица измерения'
    ]
  },

  totalQty: {
    label:
      'Общий объем',
    aliases: [
      'общий объем',
      'общий объём',
      'объем',
      'объём'
    ]
  },

  doneQty: {
    label:
      'Накопительный итог',
    aliases: [
      'накопительный итог',
      'выполнено накопительно',
      'накопительно'
    ]
  },

  contractStart: {
    label:
      'Договорное начало',
    aliases: [
      'договорное начало',
      'начало договор'
    ]
  },

  contractEnd: {
    label:
      'Договорное окончание',
    aliases: [
      'договорное окончание',
      'окончание договор'
    ]
  },

  baselineStart: {
    label:
      'Базовое начало',
    aliases: [
      'базовое начало'
    ]
  },

  baselineEnd: {
    label:
      'Базовое окончание',
    aliases: [
      'базовое окончание'
    ]
  },

  planStart: {
    label:
      'План начало',
    aliases: [
      'рабочее начало',
      'начало план',
      'план начало',
      'дата начала',
      'начало'
    ]
  },

  planEnd: {
    label:
      'План окончание',
    aliases: [
      'рабочее окончание',
      'окончание план',
      'план окончание',
      'дата окончания',
      'окончание'
    ]
  },

  factStart: {
    label:
      'Факт начало',
    aliases: [
      'начало факт',
      'факт начало',
      'фактическое начало'
    ]
  },

  factEnd: {
    label:
      'Факт окончание',
    aliases: [
      'окончание факт',
      'факт окончание',
      'фактическое окончание'
    ]
  },

  forecastEnd: {
    label:
      'Прогноз окончание',
    aliases: [
      'прогнозное окончание',
      'прогноз окончания',
      'прогноз'
    ]
  },

  date: {
    label:
      'Дата',
    aliases: [
      'дата',
      'дата отчета',
      'дата отчёта',
      'отчетная дата',
      'отчётная дата'
    ]
  },

  qty: {
    label:
      'Факт за период',
    aliases: [
      'факт за период',
      'выполнено за период',
      'объем за день',
      'объём за день',
      'выполнено'
    ]
  },

  cumulative: {
    label:
      'Накопительно',
    aliases: [
      'накопительно',
      'накопительный итог',
      'выполнено накопительно'
    ]
  },

  people: {
    label:
      'Люди',
    aliases: [
      'люди',
      'количество людей'
    ]
  },

  peopleQty: {
    label:
      'Количество человек',
    aliases: [
      'количество человек',
      'кол-во человек',
      'кол во человек',
      'численность человек',
      'кол-во чел.',
      'кол-во чел'
    ]
  },

  specialization: {
    label:
      'Специализация',
    aliases: [
      'специализация',
      'категория персонала',
      'категория работников',
      'вид персонала'
    ]
  },

  itr: {
    label:
      'ИТР',
    aliases: [
      'итр',
      'инженерно технические работники'
    ]
  },

  workers: {
    label:
      'Подсобные рабочие',
    aliases: [
      'подсобные рабочие',
      'рабочие',
      'рабочих'
    ]
  },

  mechanizers: {
    label:
      'Механизаторы',
    aliases: [
      'механизаторы',
      'машинисты'
    ]
  },

  equipmentType: {
    label:
      'Наименование техники',
    aliases: [
      'наименование техники',
      'тип техники',
      'техника',
      'механизм',
      'механизмы'
    ]
  },

  equipmentQty: {
    label:
      'Количество техники',
    aliases: [
      'количество техники',
      'кол во техники',
      'кол. техники',
      'техника количество',
      'количество, ед.',
      'количество ед.',
      'кол-во техники',
      'количество единиц техники',
      'кол-во, ед.',
      'количество механизмов',
      'кол-во механизмов'
    ]
  },

  elementType: {
    label:
      'Тип элемента',
    aliases: [
      'тип элемента',
      'элемент',
      'вид элемента'
    ]
  },

  elementNo: {
    label:
      'Номер элемента',
    aliases: [
      'номер элемента',
      'порядковый номер',
      '№ элемента',
      'номер сваи',
      '№ сваи',
      'номер анкера',
      '№ анкера',
      'номер',
      'порядковые номера'
    ]
  },

  title: {
    label:
      'Наименование КД',
    aliases: [
      'ключевая дата',
      'контрольная дата',
      'наименование кд',
      'формулировка',
      'наименование'
    ]
  },

  comment: {
    label:
      'Комментарий',
    aliases: [
      'комментарий',
      'примечание',
      'описание'
    ]
  }
};


const MODE_FIELDS = {

  fronts: [
    'building',
    'block',
    'floor',
    'capture',
    'axis',
    'side',
    'zone',
    'roomNo',
    'roomName',
    'work',
    'organization',
    'status',
    'unit',
    'totalQty',
    'doneQty',
    'contractStart',
    'contractEnd',
    'baselineStart',
    'baselineEnd',
    'planStart',
    'planEnd',
    'factStart',
    'factEnd',
    'forecastEnd',
    'comment'
  ],

  fact: [
    'date',
    'building',
    'block',
    'floor',
    'capture',
    'axis',
    'side',
    'zone',
    'roomNo',
    'work',
    'organization',
    'qty',
    'cumulative',
    'people',
    'status',
    'comment'
  ],

  resources: [
    'date',
    'organization',
    'building',
    'work',
    'peopleQty',
    'specialization',
    'itr',
    'workers',
    'mechanizers',
    'equipmentType',
    'equipmentQty',
    'comment'
  ],

  elements: [
    'elementType',
    'elementNo',
    'building',
    'capture',
    'zone',
    'work',
    'status',
    'comment'
  ],

  milestones: [
    'title',
    'building',
    'contractEnd',
    'planEnd',
    'forecastEnd',
    'factEnd',
    'status',
    'comment'
  ]
};


const MODE_LABELS = {
  fronts:
    'Фронты / рабочий график',
  fact:
    'Факт выполненных работ',
  resources:
    'Ресурсы',
  elements:
    'Номерные элементы',
  milestones:
    'Ключевые даты'
};


/* =========================================================
   СОПОСТАВЛЕНИЕ КОЛОНОК
   ========================================================= */

function fieldMatchScore(
  header,
  alias
){

  const normalizedHeader =
    normKey(
      header
    );

  const normalizedAlias =
    normKey(
      alias
    );

  if (
    !normalizedHeader ||
    !normalizedAlias
  ) {
    return 0;
  }

  if (
    normalizedHeader ===
    normalizedAlias
  ) {
    return (
      1000 +
      normalizedAlias.length
    );
  }

  if (
    normalizedHeader.includes(
      normalizedAlias
    ) ||
    normalizedAlias.includes(
      normalizedHeader
    )
  ) {
    return (
      100 +
      Math.min(
        normalizedHeader.length,
        normalizedAlias.length
      )
    );
  }

  return 0;
}


function matchField(
  header,
  mode
){

  let best =
    '';

  let bestScore =
    0;


  for (
    const key
    of MODE_FIELDS[
      mode
    ] ||
    []
  ) {

    const definition =
      FIELD_DEFS[
        key
      ];

    for (
      const alias
      of [
        definition.label,
        ...definition.aliases
      ]
    ) {

      const score =
        fieldMatchScore(
          header,
          alias
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;
        best =
          key;
      }
    }
  }


  return (
    bestScore >=
      104
      ? best
      : ''
  );
}


function headerScore(
  row
){

  return (
    row ||
    []
  )
    .reduce(
      (
        sum,
        cell
      ) =>
        sum +
        (
          Object.values(
            MODE_FIELDS
          )
            .some(
              fields =>
                fields.some(
                  key =>
                    [
                      FIELD_DEFS[
                        key
                      ].label,
                      ...FIELD_DEFS[
                        key
                      ].aliases
                    ]
                      .some(
                        alias =>
                          normKey(
                            alias
                          ) ===
                          normKey(
                            cell
                          )
                      )
                )
            )
            ? 1
            : 0
        ),
      0
    );
}


function detectHeaderRow(
  matrix
){

  let best = {
    index:
      0,
    score:
      -1
  };

  for (
    let index =
      0;
    index <
      Math.min(
        matrix.length,
        40
      );
    index++
  ) {

    const score =
      headerScore(
        matrix[
          index
        ]
      );

    if (
      score >
      best.score
    ) {

      best = {
        index,
        score
      };
    }
  }

  return best.index;
}


function uniqueHeaders(
  row
){

  const used =
    new Map();

  return (
    row ||
    []
  )
    .map(
      (
        value,
        index
      ) => {

        let header =
          normText(
            value
          ) ||
          `Колонка ${index + 1}`;

        const count =
          (
            used.get(
              header
            ) ||
            0
          ) +
          1;

        used.set(
          header,
          count
        );

        if (
          count >
          1
        ) {
          header =
            `${header} (${count})`;
        }

        return header;
      }
    );
}


function detectImportMode(
  headers
){

  const text =
    headers
      .map(
        normKey
      )
      .join(
        ' | '
      );


  if (
    /итр|механизатор|количество техники|рабочие|количество человек|специализация|наименование техники/.test(
      text
    ) &&
    /дата/.test(
      text
    )
  ) {
    return 'resources';
  }

  if (
    /порядковый номер|номер сваи|номер анкера|тип элемента/.test(
      text
    )
  ) {
    return 'elements';
  }

  if (
    /ключевая дата|контрольная дата|формулировка/.test(
      text
    )
  ) {
    return 'milestones';
  }

  if (
    /факт за период|объем за день|выполнено за период/.test(
      text
    ) &&
    /дата/.test(
      text
    )
  ) {
    return 'fact';
  }

  return 'fronts';
}


function buildAutoMapping(
  mode
){

  const result =
    {};

  for (
    const header
    of importHeaders
  ) {

    const key =
      matchField(
        header,
        mode
      );

    result[
      header
    ] =
      key &&
      !Object.values(
        result
      )
        .includes(
          key
        )
        ? key
        : '';
  }

  return result;
}


function mappingOptions(
  mode,
  selected
){

  return `
    <option value="">
      Не использовать
    </option>

    ${
      (
        MODE_FIELDS[
          mode
        ] ||
        []
      )
        .map(
          key =>
            `
              <option
                value="${esc(key)}"
                ${
                  key ===
                  selected
                    ? 'selected'
                    : ''
                }
              >
                ${esc(
                  FIELD_DEFS[
                    key
                  ]?.label ||
                  key
                )}
              </option>
            `
        )
        .join('')
    }
  `;
}


function renderImportMapping(){

  const card =
    $('importMappingCard');

  const container =
    $('importMapping');

  if (
    !card ||
    !container
  ) {
    return;
  }

  card.classList.remove(
    'hidden'
  );


  container.innerHTML =
    importHeaders
      .map(
        (
          header,
          index
        ) =>
          `
            <div class="mapping-item">

              <b>
                ${esc(header)}
              </b>

              <select
                data-map-header="${index}"
              >
                ${
                  mappingOptions(
                    importModeResolved,
                    importMapping[
                      header
                    ] ||
                    ''
                  )
                }
              </select>

            </div>
          `
      )
      .join('');


  container
    .querySelectorAll(
      '[data-map-header]'
    )
    .forEach(
      select => {

        select.onchange =
          () => {

            const header =
              importHeaders[
                num(
                  select.dataset
                    .mapHeader
                )
              ];

            const chosen =
              select.value;

            if (
              chosen
            ) {

              Object.keys(
                importMapping
              )
                .forEach(
                  key => {

                    if (
                      importMapping[
                        key
                      ] ===
                      chosen
                    ) {
                      importMapping[
                        key
                      ] =
                        '';
                    }
                  }
                );
            }

            importMapping[
              header
            ] =
              chosen;

            renderImportMapping();
          };
      }
    );
}


function mappedValue(
  row,
  key
){

  const header =
    Object.keys(
      importMapping
    )
      .find(
        item =>
          importMapping[
            item
          ] ===
          key
      );

  return (
    header
      ? row[
          header
        ]
      : ''
  );
}


function mappedHasValue(
  row,
  key
){

  const value =
    mappedValue(
      row,
      key
    );

  return (
    value !==
      null &&
    value !==
      undefined &&
    String(
      value
    )
      .trim() !==
      ''
  );
}


/* =========================================================
   FILL DOWN
   ========================================================= */

function applyFillDown(
  rows,
  mode
){

  if (
    !$('importFillDown')
      ?.checked
  ) {
    return rows;
  }


  const keys =
    (
      mode ===
        'fronts' ||
      mode ===
        'fact'
    )
      ? [
          'building',
          'block',
          'work'
        ]
      : mode ===
          'elements'
        ? [
            'elementType',
            'building'
          ]
        : mode ===
            'resources'
          ? [
              'organization',
              'building'
            ]
          : [
              'building',
              'title'
            ];


  const last =
    {};


  return rows.map(
    row => {

      const output = {
        ...row
      };

      keys.forEach(
        key => {

          const header =
            Object.keys(
              importMapping
            )
              .find(
                item =>
                  importMapping[
                    item
                  ] ===
                  key
              );

          if (
            !header
          ) {
            return;
          }

          if (
            normText(
              output[
                header
              ]
            )
          ) {

            last[
              key
            ] =
              output[
                header
              ];

          } else if (
            last[
              key
            ] !==
            undefined
          ) {

            output[
              header
            ] =
              last[
                key
              ];
          }
        }
      );

      return output;
    }
  );
}


/* =========================================================
   ЧТЕНИЕ EXCEL
   ========================================================= */

function readSelectedSheet(){

  if (
    !importWorkbook
  ) {
    return;
  }

  importSheetName =
    $('importSheet')?.value ||
    importWorkbook
      .SheetNames[
        0
      ];

  const sheet =
    importWorkbook
      .Sheets[
        importSheetName
      ];

  const matrix =
    XLSX.utils
      .sheet_to_json(
        sheet,
        {
          header:
            1,
          defval:
            '',
          raw:
            true,
          blankrows:
            false
        }
      );

  const headerIndex =
    detectHeaderRow(
      matrix
    );

  importHeaders =
    uniqueHeaders(
      matrix[
        headerIndex
      ] ||
      []
    );

  importRawRows =
    matrix
      .slice(
        headerIndex +
        1
      )
      .filter(
        row =>
          row.some(
            value =>
              normText(
                value
              ) !==
              ''
          )
      )
      .map(
        row =>
          Object.fromEntries(
            importHeaders.map(
              (
                header,
                index
              ) => [
                header,
                row[
                  index
                ] ??
                ''
              ]
            )
          )
      );
}


async function readImportFile(
  event
){

  const file =
    event.target
      .files
      ?.[0];

  if (
    !file
  ) {
    return;
  }

  try {

    importWorkbook =
      XLSX.read(
        await file.arrayBuffer(),
        {
          type:
            'array',
          cellDates:
            true,
          cellNF:
            false,
          cellText:
            false
        }
      );

    importFileName =
      file.name;

    const select =
      $('importSheet');

    select.innerHTML =
      importWorkbook
        .SheetNames
        .map(
          name =>
            `
              <option value="${esc(name)}">
                ${esc(name)}
              </option>
            `
        )
        .join('');

    select.disabled =
      false;

    importSheetName =
      importWorkbook
        .SheetNames[
          0
        ];

    select.value =
      importSheetName;

    readSelectedSheet();

    if (
      $('analyzeImportBtn')
    ) {
      $('analyzeImportBtn')
        .disabled =
          false;
    }

    if (
      $('commitImportBtn')
    ) {
      $('commitImportBtn')
        .disabled =
          true;
    }

    if (
      $('importInfo')
    ) {

      $('importInfo')
        .classList
        .remove(
          'hidden'
        );

      $('importInfo')
        .textContent =
          `Файл загружен: ${file.name}. Выбери лист и нажми «Анализировать».`;
    }

  } catch (
    error
  ) {

    console.error(
      error
    );

    alert(
      'Ошибка чтения файла: ' +
      error.message
    );
  }
}


/* =========================================================
   РАЗБОР РЕСУРСОВ
   ========================================================= */

function resourceValuesFromRow(
  row
){

  const peopleRaw =
    num(
      mappedValue(
        row,
        'peopleQty'
      )
    );

  const specialization =
    normText(
      mappedValue(
        row,
        'specialization'
      )
    );

  const specializationKey =
    normKey(
      specialization
    );

  const equipmentType =
    normText(
      mappedValue(
        row,
        'equipmentType'
      )
    );


  const explicitEquipmentQty =
    mappedHasValue(
      row,
      'equipmentQty'
    )
      ? num(
          mappedValue(
            row,
            'equipmentQty'
          )
        )
      : null;


  let itr =
    num(
      mappedValue(
        row,
        'itr'
      )
    );

  let workers =
    num(
      mappedValue(
        row,
        'workers'
      )
    );

  let mechanizers =
    num(
      mappedValue(
        row,
        'mechanizers'
      )
    );


  /*
    В исходной таблице пользователя
    один числовой столбец используется и для людей,
    и для строк техники.

    Если есть название техники, но отдельное
    "Количество техники" отсутствует или пусто,
    число из "Количество человек" считаем количеством техники.
  */

  let equipmentQty =
    explicitEquipmentQty;


  if (
    equipmentType &&
    equipmentQty ===
    null
  ) {

    equipmentQty =
      peopleRaw;
  }


  if (
    equipmentQty ===
    null
  ) {

    equipmentQty =
      0;
  }


  /*
    Число считаем людьми только если есть специализация.
    Поэтому строка:
    3 | Экскаватор | [пустая специализация]
    даст 3 ед. техники, а не 3 человека.
  */

  if (
    specialization
  ) {

    if (
      specializationKey ===
        'итр' ||
      specializationKey.includes(
        'инженерно техничес'
      )
    ) {

      itr +=
        peopleRaw;

    } else if (
      specializationKey.includes(
        'механизатор'
      ) ||
      specializationKey.includes(
        'машинист'
      )
    ) {

      mechanizers +=
        peopleRaw;

    } else if (
      specializationKey.includes(
        'рабоч'
      )
    ) {

      workers +=
        peopleRaw;
    }
  }


  const peopleQty =
    specialization
      ? peopleRaw
      : 0;


  return {
    itr,
    workers,
    mechanizers,
    peopleQty,
    specialization,
    equipmentType,
    equipmentQty
  };
}


/* =========================================================
   ПРЕДПРОСМОТР
   ========================================================= */

function previewImportRow(
  raw,
  index
){

  const rowNumber =
    index +
    2;


  if (
    importModeResolved ===
    'resources'
  ) {

    const date =
      normDate(
        mappedValue(
          raw,
          'date'
        )
      );

    const organization =
      normText(
        mappedValue(
          raw,
          'organization'
        )
      );

    const values =
      resourceValuesFromRow(
        raw
      );


    if (
      !date
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Ошибка',
        message:
          'Не определена дата',
        selected:
          false
      };
    }


    if (
      !organization
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Ошибка',
        message:
          'Не определена организация',
        selected:
          false
      };
    }


    if (
      !values.specialization &&
      !values.equipmentType &&
      values.itr ===
        0 &&
      values.workers ===
        0 &&
      values.mechanizers ===
        0
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Пропуск',
        message:
          'Нет людей и техники',
        selected:
          false
      };
    }


    let message =
      'Ресурсы';


    if (
      values.equipmentType
    ) {

      message +=
        ` · ${values.equipmentType}: ${values.equipmentQty} ед.`;
    }


    if (
      values.specialization
    ) {

      message +=
        ` · ${values.specialization}: ${values.peopleQty} чел.`;
    }


    return {
      raw,
      rowNumber,
      status:
        'Готово',
      message,
      selected:
        true
    };
  }


  if (
    importModeResolved ===
    'elements'
  ) {

    const number =
      normText(
        mappedValue(
          raw,
          'elementNo'
        )
      );

    const type =
      normText(
        mappedValue(
          raw,
          'elementType'
        )
      );

    if (
      !number ||
      !type
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Ошибка',
        message:
          'Нужны тип и номер элемента',
        selected:
          false
      };
    }

    return {
      raw,
      rowNumber,
      status:
        'Готово',
      message:
        `${type} №${number}`,
      selected:
        true
    };
  }


  if (
    importModeResolved ===
    'milestones'
  ) {

    const title =
      normText(
        mappedValue(
          raw,
          'title'
        )
      );

    if (
      !title
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Ошибка',
        message:
          'Нет наименования ключевой даты',
        selected:
          false
      };
    }

    return {
      raw,
      rowNumber,
      status:
        'Готово',
      message:
        title,
      selected:
        true
    };
  }


  if (
    importModeResolved ===
    'fact'
  ) {

    if (
      !normDate(
        mappedValue(
          raw,
          'date'
        )
      )
    ) {

      return {
        raw,
        rowNumber,
        status:
          'Ошибка',
        message:
          'Нет даты факта',
        selected:
          false
      };
    }

    return {
      raw,
      rowNumber,
      status:
        'Готово',
      message:
        'Факт работ',
      selected:
        true
    };
  }


  const building =
    normText(
      mappedValue(
        raw,
        'building'
      )
    );

  const work =
    normText(
      mappedValue(
        raw,
        'work'
      )
    );


  if (
    !building &&
    !work
  ) {

    return {
      raw,
      rowNumber,
      status:
        'Ошибка',
      message:
        'Не определены здание/работа',
      selected:
        false
    };
  }


  return {
    raw,
    rowNumber,
    status:
      'Готово',
    message:
      'Фронт работ',
    selected:
      true
  };
}


function renderImportPreview(){

  const counts =
    {};

  importRows.forEach(
    item => {

      counts[
        item.status
      ] =
        (
          counts[
            item.status
          ] ||
          0
        ) +
        1;
    }
  );


  if (
    $('importInfo')
  ) {

    $('importInfo')
      .classList
      .remove(
        'hidden'
      );

    $('importInfo')
      .className =
        'notice';

    $('importInfo')
      .textContent =

        `Файл: ${importFileName}\n` +
        `Лист: ${importSheetName}\n` +
        `Режим: ${MODE_LABELS[importModeResolved]}\n` +
        `Строк: ${importRows.length}\n` +

        Object.entries(
          counts
        )
          .map(
            (
              [
                key,
                value
              ]
            ) =>
              `${key}: ${value}`
          )
          .join(
            ' · '
          );
  }


  if (
    $('importHead')
  ) {

    $('importHead').innerHTML =
      `
        <tr>

          <th></th>
          <th>Строка</th>
          <th>Результат</th>
          <th>Что найдено</th>

          ${
            importHeaders
              .slice(
                0,
                10
              )
              .map(
                header =>
                  `<th>${esc(header)}</th>`
              )
              .join('')
          }

        </tr>
      `;
  }


  if (
    $('importBody')
  ) {

    $('importBody').innerHTML =
      importRows
        .slice(
          0,
          300
        )
        .map(
          (
            item,
            index
          ) =>
            `
              <tr>

                <td>

                  <input
                    type="checkbox"
                    data-import-row="${index}"
                    ${
                      item.selected
                        ? 'checked'
                        : ''
                    }
                    ${
                      item.status ===
                        'Ошибка'
                        ? 'disabled'
                        : ''
                    }
                  >

                </td>

                <td>
                  ${item.rowNumber}
                </td>

                <td>
                  ${esc(item.status)}
                </td>

                <td>
                  ${esc(item.message)}
                </td>

                ${
                  importHeaders
                    .slice(
                      0,
                      10
                    )
                    .map(
                      header =>
                        `<td>${esc(item.raw[header])}</td>`
                    )
                    .join('')
                }

              </tr>
            `
        )
        .join('');
  }


  document
    .querySelectorAll(
      '[data-import-row]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          () => {

            importRows[
              num(
                checkbox.dataset
                  .importRow
              )
            ]
              .selected =
                checkbox.checked;
          };
      }
    );


  if (
    $('commitImportBtn')
  ) {

    $('commitImportBtn')
      .disabled =
        !importRows.some(
          item =>
            item.selected &&
            item.status !==
              'Ошибка'
        );
  }
}


function analyzeImport(){

  if (
    !importWorkbook
  ) {
    return;
  }


  readSelectedSheet();


  const requested =
    $('importMode')?.value ||
    'auto';


  importModeResolved =
    requested ===
      'auto'
      ? detectImportMode(
          importHeaders
        )
      : requested;


  if (
    importMappingMode !==
      importModeResolved ||
    !Object.keys(
      importMapping
    )
      .length
  ) {

    importMapping =
      buildAutoMapping(
        importModeResolved
      );

    importMappingMode =
      importModeResolved;
  }


  renderImportMapping();


  importRows =
    applyFillDown(
      importRawRows,
      importModeResolved
    )
      .map(
        previewImportRow
      );


  renderImportPreview();
}


/* =========================================================
   ФРОНТЫ
   ========================================================= */

function findMatchingFrontByMapped(
  row
){

  const buildingName =
    normText(
      mappedValue(
        row,
        'building'
      )
    );

  const workName =
    normText(
      mappedValue(
        row,
        'work'
      )
    );

  const organizationName =
    normText(
      mappedValue(
        row,
        'organization'
      )
    );


  const building =
    (
      project.buildings ||
      []
    )
      .find(
        item =>
          strictNameKey(
            item.name
          ) ===
          strictNameKey(
            buildingName
          )
      );


  const work =
    (
      project.works ||
      []
    )
      .find(
        item =>
          strictNameKey(
            item.name
          ) ===
          strictNameKey(
            workName
          )
      );


  const organization =
    (
      project.organizations ||
      []
    )
      .find(
        item =>
          strictNameKey(
            item.name
          ) ===
          strictNameKey(
            organizationName
          )
      );


  return activeFronts()
    .find(
      front =>
        (
          !building ||
          front.buildingId ===
          building.id
        ) &&
        (
          !work ||
          front.workId ===
          work.id
        ) &&
        (
          !organization ||
          front.organizationId ===
          organization.id
        )
    );
}


function ensureFrontFromImport(
  row
){

  const buildingName =
    normText(
      mappedValue(
        row,
        'building'
      )
    );

  const workName =
    normText(
      mappedValue(
        row,
        'work'
      )
    );

  const organizationName =
    normText(
      mappedValue(
        row,
        'organization'
      )
    );


  const building =
    buildingName
      ? ensureNamed(
          project.buildings,
          'BLD',
          buildingName
        )
      : null;


  const work =
    workName
      ? ensureNamed(
          project.works,
          'WRK',
          workName
        )
      : null;


  const organization =
    organizationName
      ? ensureNamed(
          project.organizations,
          'ORG',
          organizationName
        )
      : null;


  if (
    !building &&
    !work
  ) {
    return null;
  }


  const structure =
    ensureStructure({
      buildingId:
        building?.id ||
        '',
      block:
        mappedValue(
          row,
          'block'
        ),
      floor:
        mappedValue(
          row,
          'floor'
        ),
      capture:
        mappedValue(
          row,
          'capture'
        ),
      axis:
        mappedValue(
          row,
          'axis'
        ),
      side:
        mappedValue(
          row,
          'side'
        ),
      zone:
        mappedValue(
          row,
          'zone'
        ),
      roomNo:
        mappedValue(
          row,
          'roomNo'
        ),
      roomName:
        mappedValue(
          row,
          'roomName'
        )
    });


  let front =
    findMatchingFrontByMapped(
      row
    );


  if (
    !front
  ) {

    front = {
      id:
        uid(
          'FR'
        ),
      buildingId:
        building?.id ||
        '',
      workId:
        work?.id ||
        '',
      organizationId:
        organization?.id ||
        '',
      structureId:
        structure.id,
      status:
        normalizeStatus(
          mappedValue(
            row,
            'status'
          ) ||
          'Не начато'
        ),
      active:
        true,
      createdAt:
        nowIso(),
      updatedAt:
        nowIso()
    };

    project.fronts.push(
      front
    );
  }


  return front;
}


/* =========================================================
   ИМПОРТ
   ========================================================= */

function importSource(
  item
){

  return {
    file:
      importFileName,
    sheet:
      importSheetName,
    row:
      item.rowNumber,
    importedAt:
      nowIso()
  };
}


async function commitImport(){

  const selected =
    importRows.filter(
      item =>
        item.selected &&
        item.status !==
          'Ошибка'
    );


  if (
    !selected.length
  ) {
    return;
  }


  if (
    !confirm(
      `Импортировать выбранные строки: ${selected.length}?`
    )
  ) {
    return;
  }


  const preImportBackupKey =
    `pre-import-${Date.now()}`;


  await dbPutKey(
    clone(
      project
    ),
    preImportBackupKey
  );


  const batchId =
    uid(
      'IMP'
    );


  let created =
    0;

  let updated =
    0;

  let appended =
    0;

  let skipped =
    0;


  for (
    const item
    of selected
  ) {

    const row =
      item.raw;


    /* =====================================================
       РЕСУРСЫ
       ===================================================== */

    if (
      importModeResolved ===
      'resources'
    ) {

      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );


      const organizationName =
        normText(
          mappedValue(
            row,
            'organization'
          )
        );


      const organization =
        organizationName
          ? ensureNamed(
              project.organizations,
              'ORG',
              organizationName
            )
          : null;


      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );


      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;


      const workName =
        normText(
          mappedValue(
            row,
            'work'
          )
        );


      const work =
        workName
          ? ensureNamed(
              project.works,
              'WRK',
              workName
            )
          : null;


      const values =
        resourceValuesFromRow(
          row
        );


      const resource = {

        id:
          uid(
            'R'
          ),

        date,

        organizationId:
          organization?.id ||
          '',

        buildingId:
          building?.id ||
          '',

        workId:
          work?.id ||
          '',

        frontId:
          '',

        itr:
          values.itr,

        workers:
          values.workers,

        mechanizers:
          values.mechanizers,

        specialization:
          values.specialization,

        peopleQty:
          values.peopleQty,

        equipmentType:
          values.equipmentType,

        equipmentQty:
          values.equipmentQty,

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        createdAt:
          nowIso(),

        updatedAt:
          nowIso(),

        source: {
          batchId,
          ...importSource(
            item
          )
        }
      };


      const hasPeople =
        resource.itr !==
          0 ||
        resource.workers !==
          0 ||
        resource.mechanizers !==
          0;


      const hasEquipment =
        !!resource.equipmentType ||
        resource.equipmentQty !==
          0;


      if (
        !date ||
        !organization ||
        (
          !hasPeople &&
          !hasEquipment
        )
      ) {

        skipped++;

        continue;
      }


      resource.importFingerprint =
        [
          resource.date,
          resource.organizationId,
          resource.buildingId,
          resource.workId,
          resource.itr,
          resource.workers,
          resource.mechanizers,
          resource.equipmentType,
          resource.equipmentQty,
          resource.comment
        ]
          .join(
            '|'
          );


      if (
        (
          project.resources ||
          []
        )
          .some(
            existing =>
              existing.importFingerprint ===
              resource.importFingerprint
          )
      ) {

        skipped++;

        continue;
      }


      project.resources.push(
        resource
      );

      appended++;

      continue;
    }


    /* =====================================================
       ФРОНТЫ
       ===================================================== */

    if (
      importModeResolved ===
      'fronts'
    ) {

      const existed =
        !!findMatchingFrontByMapped(
          row
        );


      const front =
        ensureFrontFromImport(
          row
        );


      if (
        !front
      ) {

        skipped++;

        continue;
      }


      const assign =
        (
          key,
          sourceKey,
          converter =
            value =>
              value
        ) => {

          const value =
            mappedValue(
              row,
              sourceKey
            );

          if (
            normText(
              value
            ) !==
            ''
          ) {

            front[
              key
            ] =
              converter(
                value
              );
          }
        };


      assign(
        'status',
        'status',
        normalizeStatus
      );

      assign(
        'unit',
        'unit',
        normText
      );

      assign(
        'totalQty',
        'totalQty',
        num
      );

      assign(
        'doneQty',
        'doneQty',
        num
      );

      assign(
        'contractStart',
        'contractStart',
        normDate
      );

      assign(
        'contractEnd',
        'contractEnd',
        normDate
      );

      assign(
        'baselineStart',
        'baselineStart',
        normDate
      );

      assign(
        'baselineEnd',
        'baselineEnd',
        normDate
      );

      assign(
        'planStart',
        'planStart',
        normDate
      );

      assign(
        'planEnd',
        'planEnd',
        normDate
      );

      assign(
        'factStart',
        'factStart',
        normDate
      );

      assign(
        'factEnd',
        'factEnd',
        normDate
      );

      assign(
        'forecastEnd',
        'forecastEnd',
        normDate
      );

      assign(
        'comment',
        'comment',
        normText
      );


      front.updatedAt =
        nowIso();

      front.lastImport = {
        batchId,
        ...importSource(
          item
        )
      };


      if (
        existed
      ) {
        updated++;
      } else {
        created++;
      }

      continue;
    }


    /* =====================================================
       ФАКТ
       ===================================================== */

    if (
      importModeResolved ===
      'fact'
    ) {

      const front =
        ensureFrontFromImport(
          row
        );

      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );


      if (
        !front ||
        !date
      ) {

        skipped++;

        continue;
      }


      const quantity =
        num(
          mappedValue(
            row,
            'qty'
          )
        );


      const people =
        num(
          mappedValue(
            row,
            'people'
          )
        );


      const fingerprint =
        [
          front.id,
          date,
          quantity,
          people,
          normText(
            mappedValue(
              row,
              'comment'
            )
          )
        ]
          .join(
            '|'
          );


      if (
        (
          project.factLog ||
          []
        )
          .some(
            existing =>
              existing.importFingerprint ===
              fingerprint
          )
      ) {

        skipped++;

        continue;
      }


      const cumulativeRaw =
        mappedValue(
          row,
          'cumulative'
        );


      const cumulative =
        normText(
          cumulativeRaw
        ) !==
          ''
          ? num(
              cumulativeRaw
            )
          : (
              project.factLog ||
              []
            )
              .filter(
                fact =>
                  fact.frontId ===
                    front.id &&
                  fact.date <=
                    date
              )
              .reduce(
                (
                  sum,
                  fact
                ) =>
                  sum +
                  num(
                    fact.qty
                  ),
                0
              ) +
            quantity;


      project.factLog.push({
        id:
          uid(
            'FCT'
          ),
        frontId:
          front.id,
        date,
        qty:
          quantity,
        cumulative,
        people,
        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),
        createdAt:
          nowIso(),
        importFingerprint:
          fingerprint,
        source: {
          batchId,
          ...importSource(
            item
          )
        }
      });

      appended++;

      continue;
    }


    /* =====================================================
       НОМЕРНЫЕ ЭЛЕМЕНТЫ
       ===================================================== */

    if (
      importModeResolved ===
      'elements'
    ) {

      const type =
        normText(
          mappedValue(
            row,
            'elementType'
          )
        );

      const number =
        normText(
          mappedValue(
            row,
            'elementNo'
          )
        );


      if (
        !type ||
        !number
      ) {

        skipped++;

        continue;
      }


      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );


      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;


      const workName =
        normText(
          mappedValue(
            row,
            'work'
          )
        );


      const work =
        workName
          ? ensureNamed(
              project.works,
              'WRK',
              workName
            )
          : null;


      const candidate = {

        id:
          uid(
            'EL'
          ),

        elementType:
          type,

        elementNo:
          number,

        uniqueScope:
          'context',

        buildingId:
          building?.id ||
          '',

        capture:
          normText(
            mappedValue(
              row,
              'capture'
            )
          ),

        zone:
          normText(
            mappedValue(
              row,
              'zone'
            )
          ),

        workId:
          work?.id ||
          '',

        frontId:
          '',

        status:
          normalizeStatus(
            mappedValue(
              row,
              'status'
            ) ||
            'Не начато'
          ),

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        active:
          true,

        createdAt:
          nowIso(),

        source: {
          batchId,
          ...importSource(
            item
          )
        }
      };


      const key =
        [
          normKey(
            candidate.elementType
          ),
          candidate.buildingId,
          normKey(
            candidate.capture
          ),
          normKey(
            candidate.zone
          ),
          normKey(
            candidate.elementNo
          )
        ]
          .join(
            '|'
          );


      if (
        (
          project.numberedElements ||
          []
        )
          .some(
            existing =>
              existing.active !==
                false &&
              [
                normKey(
                  existing.elementType
                ),
                existing.buildingId ||
                  '',
                normKey(
                  existing.capture
                ),
                normKey(
                  existing.zone
                ),
                normKey(
                  existing.elementNo
                )
              ]
                .join(
                  '|'
                ) ===
                key
          )
      ) {

        skipped++;

        continue;
      }


      project.numberedElements.push(
        candidate
      );

      appended++;

      continue;
    }


    /* =====================================================
       КЛЮЧЕВЫЕ ДАТЫ
       ===================================================== */

    if (
      importModeResolved ===
      'milestones'
    ) {

      const title =
        normText(
          mappedValue(
            row,
            'title'
          )
        );


      if (
        !title
      ) {

        skipped++;

        continue;
      }


      const buildingName =
        normText(
          mappedValue(
            row,
            'building'
          )
        );


      const building =
        buildingName
          ? ensureNamed(
              project.buildings,
              'BLD',
              buildingName
            )
          : null;


      project.milestones.push({

        id:
          uid(
            'M'
          ),

        buildingId:
          building?.id ||
          '',

        title,

        status:
          normText(
            mappedValue(
              row,
              'status'
            )
          ) ||
          'Не наступила',

        contractDate:
          normDate(
            mappedValue(
              row,
              'contractEnd'
            )
          ),

        workDate:
          normDate(
            mappedValue(
              row,
              'planEnd'
            )
          ),

        forecastDate:
          normDate(
            mappedValue(
              row,
              'forecastEnd'
            )
          ),

        factDate:
          normDate(
            mappedValue(
              row,
              'factEnd'
            )
          ),

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        correspondence:
          [],

        createdAt:
          nowIso(),

        updatedAt:
          nowIso(),

        source: {
          batchId,
          ...importSource(
            item
          )
        }
      });

      appended++;
    }
  }


  project.importHistory =
    project.importHistory ||
    [];


  project.importHistory.unshift({

    id:
      batchId,

    file:
      importFileName,

    sheet:
      importSheetName,

    mode:
      importModeResolved,

    at:
      nowIso(),

    created,

    updated,

    appended,

    skipped,

    backupKey:
      preImportBackupKey
  });


  log(
    'Импорт',
    'Проект',
    `${MODE_LABELS[importModeResolved]} · добавлено ${created + appended}, обновлено ${updated}, пропущено ${skipped}`
  );


  await saveProject();


  initSelects();


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {
    refreshAllMultiFilters();
  }


  renderAll();


  alert(
    `Импорт завершен.\n` +
    `Добавлено: ${created + appended}\n` +
    `Обновлено: ${updated}\n` +
    `Пропущено: ${skipped}`
  );
}


/* =========================================================
   ОТКАТ
   ========================================================= */

async function rollbackLastImport(){

  const history =
    project.importHistory ||
    [];

  const last =
    history[
      0
    ];


  if (
    !last
  ) {

    alert(
      'Нет импорта для отмены.'
    );

    return;
  }


  if (
    !confirm(
      `Отменить последний импорт?\n` +
      `${last.file || ''}\n` +
      `${
        last.at
          ? new Date(
              last.at
            )
              .toLocaleString(
                'ru-RU'
              )
          : ''
      }`
    )
  ) {
    return;
  }


  if (
    last.backupKey
  ) {

    const backup =
      await dbGetKey(
        last.backupKey
      );


    if (
      backup
    ) {

      project =
        normalizeProject(
          backup
        );

      log(
        'Откат импорта',
        'Проект',
        `Отменен импорт ${last.file || ''}`
      );

      await saveProject();

      initSelects();

      if (
        typeof refreshAllMultiFilters ===
        'function'
      ) {
        refreshAllMultiFilters();
      }

      renderAll();

      alert(
        'Последний импорт отменен.'
      );

      return;
    }
  }


  const batchId =
    last.id;


  project.resources =
    (
      project.resources ||
      []
    )
      .filter(
        item =>
          item.source?.batchId !==
          batchId
      );


  project.factLog =
    (
      project.factLog ||
      []
    )
      .filter(
        item =>
          item.source?.batchId !==
          batchId
      );


  project.numberedElements =
    (
      project.numberedElements ||
      []
    )
      .filter(
        item =>
          item.source?.batchId !==
          batchId
      );


  project.milestones =
    (
      project.milestones ||
      []
    )
      .filter(
        item =>
          item.source?.batchId !==
          batchId
      );


  project.importHistory =
    history.slice(
      1
    );


  log(
    'Откат импорта',
    'Проект',
    `Отменен импорт ${last.file || ''}`
  );


  await saveProject();

  renderAll();

  alert(
    'Последний импорт отменен.'
  );
}