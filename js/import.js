'use strict';

/* =========================================================
   LIV PLANNING
   ИМПОРТ EXCEL / CSV
   ========================================================= */


/* =========================================================
   ДАТЫ
   ========================================================= */

function normDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    const y =
      value.getFullYear();

    const m =
      String(
        value.getMonth() + 1
      )
        .padStart(
          2,
          '0'
        );

    const d =
      String(
        value.getDate()
      )
        .padStart(
          2,
          '0'
        );

    return (
      `${y}-${m}-${d}`
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


    if (parsed) {

      return (
        `${parsed.y}-` +
        `${String(
          parsed.m
        )
          .padStart(
            2,
            '0'
          )}-` +
        `${String(
          parsed.d
        )
          .padStart(
            2,
            '0'
          )}`
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


  if (match) {

    const year =
      match[3].length ===
        2
        ? `20${match[3]}`
        : match[3];


    return (
      `${year}-` +
      `${match[2]
        .padStart(
          2,
          '0'
        )}-` +
      `${match[1]
        .padStart(
          2,
          '0'
        )}`
    );
  }


  match =
    text.match(
      /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/
    );


  if (match) {

    return (
      `${match[1]}-` +
      `${match[2]
        .padStart(
          2,
          '0'
        )}-` +
      `${match[3]
        .padStart(
          2,
          '0'
        )}`
    );
  }


  return '';
}


/* =========================================================
   СОЗДАНИЕ СПРАВОЧНИКОВ
   ========================================================= */

function ensureNamed(
  list,
  prefix,
  name,
  extra =
    {}
) {

  const clean =
    normText(
      name
    );


  if (!clean) {
    return null;
  }


  let item =
    (
      list ||
      []
    )
      .find(
        row =>
          sameText(
            row.name,
            clean
          )
      );


  if (!item) {

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
) {

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


  if (!structure) {

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
   ОПИСАНИЕ ПОЛЕЙ
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
      'окончание договор',
      'дата по договору'
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
      'кол-во чел',
      'численность',
      'количество персонала'
    ]
  },


  specialization: {

    label:
      'Специализация',

    aliases: [
      'специализация',
      'категория персонала',
      'категория работников',
      'вид персонала',
      'категория'
    ]
  },


  itr: {

    label:
      'ИТР',

    aliases: [
      'итр',
      'инженерно технические работники',
      'инженерно-технические работники'
    ]
  },


  workers: {

    label:
      'Подсобные рабочие',

    aliases: [
      'подсобные рабочие',
      'рабочие',
      'рабочих',
      'рабочий персонал'
    ]
  },


  mechanizers: {

    label:
      'Механизаторы',

    aliases: [
      'механизаторы',
      'машинисты',
      'механизатор'
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
      'механизмы',
      'наименование механизма',
      'вид техники'
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
      'кол-во механизмов',
      'кол во механизмов',
      'количество единиц',
      'кол-во ед.',
      'кол во ед',
      'количество ед',
      'количество машин',
      'кол-во машин'
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
    'organization',
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
   ОПРЕДЕЛЕНИЕ КОЛОНОК
   ========================================================= */

function fieldMatchScore(
  header,
  alias
) {

  const h =
    normKey(
      header
    );


  const a =
    normKey(
      alias
    );


  if (
    !h ||
    !a
  ) {
    return 0;
  }


  if (
    h ===
    a
  ) {
    return 100;
  }


  if (
    h.startsWith(
      a
    ) ||
    a.startsWith(
      h
    )
  ) {
    return 80;
  }


  if (
    h.includes(
      a
    ) ||
    a.includes(
      h
    )
  ) {
    return 60;
  }


  const hWords =
    new Set(
      h
        .split(
          ' '
        )
        .filter(
          Boolean
        )
    );


  const aWords =
    a
      .split(
        ' '
      )
      .filter(
        Boolean
      );


  const matched =
    aWords
      .filter(
        word =>
          hWords.has(
            word
          )
      )
      .length;


  return aWords.length
    ? Math.round(
        (
          matched /
          aWords.length
        ) *
        50
      )
    : 0;
}


function matchField(
  header,
  mode
) {

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

    const def =
      FIELD_DEFS[
        key
      ];


    if (!def) {
      continue;
    }


    for (
      const alias
      of [
        def.label,
        ...(
          def.aliases ||
          []
        )
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

        best =
          key;

        bestScore =
          score;
      }
    }
  }


  return bestScore >=
    60
    ? best
    : '';
}


function buildAutoMapping(
  mode
) {

  const mapping =
    {};


  const used =
    new Set();


  for (
    const header
    of importHeaders
  ) {

    const field =
      matchField(
        header,
        mode
      );


    if (
      field &&
      !used.has(
        field
      )
    ) {

      mapping[
        field
      ] =
        header;


      used.add(
        field
      );
    }
  }


  return mapping;
}


function mappedValue(
  row,
  field
) {

  const header =
    importMapping[
      field
    ];


  return header
    ? row[
        header
      ]
    : '';
}


function detectImportMode(
  headers
) {

  const keys =
    headers.map(
      normKey
    );


  const has =
    (
      ...patterns
    ) =>
      keys.some(
        key =>
          patterns.some(
            pattern =>
              key.includes(
                normKey(
                  pattern
                )
              )
          )
      );


  if (
    has(
      'специализация',
      'категория персонала'
    ) ||
    has(
      'наименование техники',
      'количество техники',
      'механизмы'
    ) ||
    has(
      'количество человек'
    )
  ) {

    return 'resources';
  }


  if (
    has(
      'номер сваи',
      'номер анкера',
      'тип элемента'
    )
  ) {

    return 'elements';
  }


  if (
    has(
      'ключевая дата',
      'контрольная дата',
      'наименование кд'
    )
  ) {

    return 'milestones';
  }


  if (
    has(
      'факт за период',
      'выполнено за период',
      'объем за день'
    )
  ) {

    return 'fact';
  }


  return 'fronts';
}


/* =========================================================
   ЧТЕНИЕ ФАЙЛА
   ========================================================= */

async function readImportFile(
  event
) {

  const file =
    event
      ?.target
      ?.files
      ?.[0];


  if (!file) {
    return;
  }


  if (
    typeof XLSX ===
    'undefined'
  ) {

    alert(
      'Библиотека Excel не загрузилась. Обнови страницу и попробуй еще раз.'
    );

    return;
  }


  importFileName =
    file.name;


  try {

    const buffer =
      await file.arrayBuffer();


    importWorkbook =
      XLSX.read(
        buffer,
        {

          type:
            'array',

          cellDates:
            true,

          raw:
            true
        }
      );


    const sheetSelect =
      $('importSheet');


    sheetSelect.innerHTML =
      '';


    importWorkbook
      .SheetNames
      .forEach(
        name => {

          const option =
            document.createElement(
              'option'
            );


          option.value =
            name;


          option.textContent =
            name;


          sheetSelect.appendChild(
            option
          );
        }
      );


    sheetSelect.disabled =
      false;


    importSheetName =
      importWorkbook
        .SheetNames[
          0
        ] ||
      '';


    sheetSelect.value =
      importSheetName;


    importMapping =
      {};


    importMappingMode =
      '';


    importRows =
      [];


    readSelectedSheet();


    $('analyzeImportBtn')
      .disabled =
        !importRawRows.length;


    $('commitImportBtn')
      .disabled =
        true;


    $('importInfo')
      .className =
        'notice';


    $('importInfo')
      .classList
      .remove(
        'hidden'
      );


    $('importInfo')
      .textContent =
        `Файл загружен: ${importFileName}\n` +
        `Лист: ${importSheetName}\n` +
        `Строк найдено: ${importRawRows.length}\n` +
        'Нажми «Анализировать».';

  } catch (
    error
  ) {

    console.error(
      error
    );


    alert(
      `Не удалось прочитать файл: ${error.message}`
    );
  }
}


function readSelectedSheet() {

  if (
    !importWorkbook
  ) {
    return;
  }


  importSheetName =
    $('importSheet')
      ?.value ||
    importWorkbook
      .SheetNames[
        0
      ] ||
    '';


  const sheet =
    importWorkbook
      .Sheets[
        importSheetName
      ];


  if (!sheet) {

    importHeaders =
      [];


    importRawRows =
      [];


    return;
  }


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
            true
        }
      );


  const headerIndex =
    findHeaderRow(
      matrix
    );


  if (
    headerIndex <
    0
  ) {

    importHeaders =
      [];


    importRawRows =
      [];


    return;
  }


  importHeaders =
    normalizeHeaders(
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
      .map(
        (
          values,
          index
        ) => {

          const row = {

            __sourceRow:
              headerIndex +
              index +
              2
          };


          importHeaders
            .forEach(
              (
                header,
                i
              ) => {

                row[
                  header
                ] =
                  values[
                    i
                  ] ??
                  '';
              }
            );


          return row;
        }
      )
      .filter(
        row =>
          importHeaders
            .some(
              header =>
                normText(
                  row[
                    header
                  ]
                ) !==
                ''
            )
      );
}


function findHeaderRow(
  matrix
) {

  const limit =
    Math.min(
      matrix.length,
      40
    );


  let bestIndex =
    -1;


  let bestScore =
    -1;


  for (
    let i =
      0;
    i <
      limit;
    i++
  ) {

    const row =
      matrix[
        i
      ] ||
      [];


    const nonEmpty =
      row
        .filter(
          value =>
            normText(
              value
            ) !==
            ''
        )
        .length;


    if (
      nonEmpty <
      2
    ) {
      continue;
    }


    const textCells =
      row
        .filter(
          value =>
            typeof value ===
              'string' &&
            normText(
              value
            )
        )
        .length;


    const score =
      nonEmpty *
      2 +
      textCells;


    if (
      score >
      bestScore
    ) {

      bestScore =
        score;


      bestIndex =
        i;
    }
  }


  return bestIndex;
}


function normalizeHeaders(
  row
) {

  const used =
    new Map();


  return row.map(
    (
      value,
      index
    ) => {

      let header =
        normText(
          value
        ) ||
        `Колонка ${index + 1}`;


      const key =
        normKey(
          header
        );


      const count =
        (
          used.get(
            key
          ) ||
          0
        ) +
        1;


      used.set(
        key,
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


/* =========================================================
   FILL DOWN
   ========================================================= */

function applyFillDown(
  rows,
  mode
) {

  if (
    !$('importFillDown')
      ?.checked
  ) {

    return rows.map(
      row => ({
        ...row
      })
    );
  }


  const fieldsByMode = {

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
      'organization'
    ],

    fact: [
      'building',
      'block',
      'floor',
      'capture',
      'axis',
      'side',
      'zone',
      'roomNo',
      'work',
      'organization'
    ],

    resources: [
      'date',
      'organization',
      'building',
      'work',
      'specialization'
    ],

    elements: [
      'elementType',
      'building',
      'capture',
      'zone',
      'work'
    ],

    milestones: [
      'building',
      'organization'
    ]
  };


  const headers =
    (
      fieldsByMode[
        mode
      ] ||
      []
    )
      .map(
        field =>
          importMapping[
            field
          ]
      )
      .filter(
        Boolean
      );


  const last =
    {};


  return rows.map(
    row => {

      const copy = {
        ...row
      };


      headers.forEach(
        header => {

          if (
            normText(
              copy[
                header
              ]
            ) !==
            ''
          ) {

            last[
              header
            ] =
              copy[
                header
              ];

          } else if (
            Object.prototype
              .hasOwnProperty
              .call(
                last,
                header
              )
          ) {

            copy[
              header
            ] =
              last[
                header
              ];
          }
        }
      );


      return copy;
    }
  );
}


/* =========================================================
   UI СОПОСТАВЛЕНИЯ
   ========================================================= */

function renderImportMapping() {

  const card =
    $('importMappingCard');


  const box =
    $('importMapping');


  if (
    !card ||
    !box
  ) {
    return;
  }


  card.classList
    .remove(
      'hidden'
    );


  box.innerHTML =
    (
      MODE_FIELDS[
        importModeResolved
      ] ||
      []
    )
      .map(
        field => {

          const def =
            FIELD_DEFS[
              field
            ];


          const current =
            importMapping[
              field
            ] ||
            '';


          return `
            <div class="mapping-item">

              <b>
                ${esc(
                  def.label
                )}
              </b>

              <select
                data-import-map="${field}">

                <option value="">
                  — не использовать —
                </option>

                ${
                  importHeaders
                    .map(
                      header => `
                        <option
                          value="${esc(
                            header
                          )}"
                          ${
                            header ===
                            current
                              ? 'selected'
                              : ''
                          }>
                          ${esc(
                            header
                          )}
                        </option>
                      `
                    )
                    .join('')
                }

              </select>

            </div>
          `;
        }
      )
      .join('');


  box
    .querySelectorAll(
      '[data-import-map]'
    )
    .forEach(
      select => {

        select.onchange =
          () => {

            const field =
              select.dataset
                .importMap;


            if (
              select.value
            ) {

              importMapping[
                field
              ] =
                select.value;

            } else {

              delete importMapping[
                field
              ];
            }


            $('commitImportBtn')
              .disabled =
                true;
          };
      }
    );
}


/* =========================================================
   ПОИСК / СОЗДАНИЕ ФРОНТА
   ========================================================= */

function mappedStructureData(
  row
) {

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


  return {

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
  };
}


function findMatchingFrontByMapped(
  row
) {

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


  const building =
    (
      project.buildings ||
      []
    )
      .find(
        item =>
          sameText(
            item.name,
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
          sameText(
            item.name,
            workName
          )
      );


  if (
    !building ||
    !work
  ) {
    return null;
  }


  const candidate = {

    buildingId:
      building.id,

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
  };


  const signature =
    structureSignature(
      candidate
    );


  return activeFronts()
    .find(
      front => {

        const structure =
          byId(
            project.structures,
            front.structureId
          );


        return (
          front.workId ===
            work.id &&
          structure &&
          (
            structure.signature ||
            structureSignature(
              structure
            )
          ) ===
            signature
        );
      }
    ) ||
    null;
}


function ensureFrontFromImport(
  row
) {

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


  if (
    !buildingName ||
    !workName
  ) {

    return null;
  }


  const existing =
    findMatchingFrontByMapped(
      row
    );


  if (
    existing
  ) {

    return existing;
  }


  const building =
    ensureNamed(
      project.buildings,
      'BLD',
      buildingName
    );


  const work =
    ensureNamed(
      project.works,
      'WRK',
      workName
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


  const structure =
    ensureStructure({

      ...mappedStructureData(
        row
      ),

      buildingId:
        building.id
    });


  const front = {

    id:
      uid(
        'F'
      ),

    structureId:
      structure.id,

    workId:
      work.id,

    organizationId:
      organization?.id ||
      '',

    status:
      normalizeStatus(
        mappedValue(
          row,
          'status'
        )
      ) ||
      'Не начато',

    unit:
      normText(
        mappedValue(
          row,
          'unit'
        )
      ),

    totalQty:
      num(
        mappedValue(
          row,
          'totalQty'
        )
      ),

    doneQty:
      num(
        mappedValue(
          row,
          'doneQty'
        )
      ),

    contractStart:
      normDate(
        mappedValue(
          row,
          'contractStart'
        )
      ),

    contractEnd:
      normDate(
        mappedValue(
          row,
          'contractEnd'
        )
      ),

    baselineStart:
      normDate(
        mappedValue(
          row,
          'baselineStart'
        )
      ),

    baselineEnd:
      normDate(
        mappedValue(
          row,
          'baselineEnd'
        )
      ),

    planStart:
      normDate(
        mappedValue(
          row,
          'planStart'
        )
      ),

    planEnd:
      normDate(
        mappedValue(
          row,
          'planEnd'
        )
      ),

    factStart:
      normDate(
        mappedValue(
          row,
          'factStart'
        )
      ),

    factEnd:
      normDate(
        mappedValue(
          row,
          'factEnd'
        )
      ),

    forecastEnd:
      normDate(
        mappedValue(
          row,
          'forecastEnd'
        )
      ),

    comment:
      normText(
        mappedValue(
          row,
          'comment'
        )
      ),

    completed:
      normalizeStatus(
        mappedValue(
          row,
          'status'
        )
      ) ===
      'Завершено',

    accepted:
      false,

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


  return front;
}


/* =========================================================
   ПРЕДПРОСМОТР
   ========================================================= */

function resourcePreviewMessage(
  raw
) {

  const org =
    normText(
      mappedValue(
        raw,
        'organization'
      )
    ) ||
    'Без организации';


  const date =
    normDate(
      mappedValue(
        raw,
        'date'
      )
    );


  const specialization =
    normText(
      mappedValue(
        raw,
        'specialization'
      )
    );


  const peopleQty =
    num(
      mappedValue(
        raw,
        'peopleQty'
      )
    );


  const eqType =
    normText(
      mappedValue(
        raw,
        'equipmentType'
      )
    );


  const eqQty =
    num(
      mappedValue(
        raw,
        'equipmentQty'
      )
    );


  const parts = [
    org
  ];


  if (
    date
  ) {

    parts.push(
      ruDate(
        date
      )
    );
  }


  if (
    specialization ||
    peopleQty
  ) {

    parts.push(
      `${specialization || 'Люди'}: ${roundInt(
        peopleQty
      )}`
    );
  }


  if (
    eqType ||
    eqQty
  ) {

    parts.push(
      `${eqType || 'Техника'}: ${roundInt(
        eqQty
      )}`
    );
  }


  return parts.join(
    ' · '
  );
}


function previewImportRow(
  raw,
  index
) {

  const item = {

    raw,

    rowNumber:
      raw.__sourceRow ||
      index +
      1,

    status:
      '',

    message:
      '',

    selected:
      true
  };


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


    if (!date) {

      item.status =
        'Ошибка';


      item.message =
        'Не распознана дата';


      item.selected =
        false;


      return item;
    }


    const hasPersonnelMapping =
      Boolean(
        importMapping
          .peopleQty ||
        importMapping
          .itr ||
        importMapping
          .workers ||
        importMapping
          .mechanizers
      );


    const hasEquipmentMapping =
      Boolean(
        importMapping
          .equipmentType ||
        importMapping
          .equipmentQty
      );


    if (
      !hasPersonnelMapping &&
      !hasEquipmentMapping
    ) {

      item.status =
        'Ошибка';


      item.message =
        'Не найдены колонки людей или техники';


      item.selected =
        false;


      return item;
    }


    if (
      importMapping
        .equipmentType &&
      !importMapping
        .equipmentQty
    ) {

      item.status =
        'Предупреждение';


      item.message =
        `${resourcePreviewMessage(
          raw
        )} · не сопоставлено количество техники`;


      return item;
    }


    item.status =
      'Добавить ресурсы';


    item.message =
      resourcePreviewMessage(
        raw
      );


    return item;
  }


  if (
    importModeResolved ===
    'fronts'
  ) {

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
      !building ||
      !work
    ) {

      item.status =
        'Ошибка';


      item.message =
        'Нужны здание и работа';


      item.selected =
        false;

    } else {

      item.status =
        findMatchingFrontByMapped(
          raw
        )
          ? 'Обновление'
          : 'Новый фронт';


      item.message =
        `${building} · ${work}`;
    }


    return item;
  }


  if (
    importModeResolved ===
    'fact'
  ) {

    const date =
      normDate(
        mappedValue(
          raw,
          'date'
        )
      );


    if (!date) {

      item.status =
        'Ошибка';


      item.message =
        'Не распознана дата';


      item.selected =
        false;

    } else {

      item.status =
        'Добавить факт';


      item.message =
        normText(
          mappedValue(
            raw,
            'work'
          )
        ) ||
        'Факт';
    }


    return item;
  }


  if (
    importModeResolved ===
    'elements'
  ) {

    const type =
      normText(
        mappedValue(
          raw,
          'elementType'
        )
      );


    const number =
      normText(
        mappedValue(
          raw,
          'elementNo'
        )
      );


    if (
      !type ||
      !number
    ) {

      item.status =
        'Ошибка';


      item.message =
        'Нужны тип элемента и номер';


      item.selected =
        false;

    } else {

      item.status =
        'Новый элемент';


      item.message =
        `${type} №${number}`;
    }


    return item;
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


    if (!title) {

      item.status =
        'Ошибка';


      item.message =
        'Не найдено наименование';


      item.selected =
        false;

    } else {

      item.status =
        'КД';


      item.message =
        title;
    }


    return item;
  }


  item.status =
    'Ошибка';


  item.message =
    'Неизвестный режим импорта';


  item.selected =
    false;


  return item;
}


function analyzeImport() {

  if (
    !importWorkbook
  ) {
    return;
  }


  readSelectedSheet();


  const requested =
    $('importMode')
      .value;


  const nextMode =
    requested ===
      'auto'
      ? detectImportMode(
          importHeaders
        )
      : requested;


  importModeResolved =
    nextMode;


  if (
    importMappingMode !==
      nextMode ||
    !Object.keys(
      importMapping
    )
      .length
  ) {

    importMapping =
      buildAutoMapping(
        nextMode
      );


    importMappingMode =
      nextMode;
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


function renderImportPreview() {

  const counts =
    {};


  importRows
    .forEach(
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


  const extraWarnings =
    [];


  if (
    importModeResolved ===
    'resources'
  ) {

    if (
      importMapping
        .equipmentType &&
      !importMapping
        .equipmentQty
    ) {

      extraWarnings.push(
        'ВНИМАНИЕ: найдена техника, но не сопоставлена колонка количества техники.'
      );
    }


    if (
      importMapping
        .equipmentQty &&
      !importMapping
        .equipmentType
    ) {

      extraWarnings.push(
        'ВНИМАНИЕ: найдено количество техники, но не сопоставлено наименование техники.'
      );
    }
  }


  $('importInfo')
    .classList
    .remove(
      'hidden'
    );


  $('importInfo')
    .className =
      extraWarnings.length
        ? 'notice warn'
        : 'notice';


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
        ) +
      (
        extraWarnings.length
          ? `\n${extraWarnings.join(
              '\n'
            )}`
          : ''
      );


  $('importHead')
    .innerHTML = `
      <tr>

        <th></th>

        <th>
          Строка
        </th>

        <th>
          Результат
        </th>

        <th>
          Что найдено
        </th>

        ${
          importHeaders
            .slice(
              0,
              10
            )
            .map(
              header =>
                `<th>${esc(
                  header
                )}</th>`
            )
            .join('')
        }

      </tr>
    `;


  $('importBody')
    .innerHTML =
      importRows
        .slice(
          0,
          500
        )
        .map(
          (
            item,
            index
          ) => `
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
                ${esc(
                  item.status
                )}
              </td>

              <td>
                ${esc(
                  item.message
                )}
              </td>

              ${
                importHeaders
                  .slice(
                    0,
                    10
                  )
                  .map(
                    header =>
                      `<td>${esc(
                        item.raw[
                          header
                        ]
                      )}</td>`
                  )
                  .join('')
              }

            </tr>
          `
        )
        .join('');


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


  $('commitImportBtn')
    .disabled =
      !importRows
        .some(
          item =>
            item.selected &&
            item.status !==
              'Ошибка'
        );
}


/* =========================================================
   РЕСУРСЫ — ПРЕОБРАЗОВАНИЕ СТРОКИ
   ========================================================= */

function importResourceFromRow(
  row,
  item,
  batchId
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


  const peopleQty =
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


  /*
    Если таблица длинного формата:
    "Количество человек" + "Специализация".

    Но если одновременно уже заполнены отдельные
    колонки ИТР / Рабочие / Механизаторы,
    количество повторно НЕ добавляем.
  */

  const hasDirectPeople =
    itr !==
      0 ||
    workers !==
      0 ||
    mechanizers !==
      0;


  if (
    peopleQty !==
      0 &&
    !hasDirectPeople
  ) {

    if (
      specializationKey ===
        'итр' ||
      specializationKey
        .includes(
          'инженерно техничес'
        )
    ) {

      itr =
        peopleQty;

    } else if (
      specializationKey
        .includes(
          'механизатор'
        ) ||
      specializationKey
        .includes(
          'машинист'
        )
    ) {

      mechanizers =
        peopleQty;

    } else if (
      specializationKey
        .includes(
          'рабоч'
        ) ||
      specializationKey
        .includes(
          'подсоб'
        )
    ) {

      workers =
        peopleQty;
    }
  }


  const equipmentType =
    normText(
      mappedValue(
        row,
        'equipmentType'
      )
    );


  const equipmentQty =
    num(
      mappedValue(
        row,
        'equipmentQty'
      )
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
      roundInt(
        itr
      ),

    workers:
      roundInt(
        workers
      ),

    mechanizers:
      roundInt(
        mechanizers
      ),

    specialization,

    peopleQty:
      roundInt(
        peopleQty
      ),

    equipmentType,

    equipmentQty:
      roundInt(
        equipmentQty
      ),

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

      file:
        importFileName,

      sheet:
        importSheetName,

      row:
        item.rowNumber,

      importedAt:
        nowIso()
    }
  };


  resource.importFingerprint =
    [

      resource.date,

      resource.organizationId,

      resource.buildingId,

      resource.workId,

      resource.itr,

      resource.workers,

      resource.mechanizers,

      resource.specialization,

      resource.peopleQty,

      resource.equipmentType,

      resource.equipmentQty,

      resource.comment
    ]
      .join(
        '|'
      );


  return resource;
}


/* =========================================================
   COMMIT
   ========================================================= */

async function commitImport() {

  const selected =
    importRows
      .filter(
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

      const resource =
        importResourceFromRow(
          row,
          item,
          batchId
        );


      const hasPeople =
        resource.itr !==
          0 ||
        resource.workers !==
          0 ||
        resource.mechanizers !==
          0 ||
        resource.peopleQty !==
          0;


      const hasEquipment =
        Boolean(
          resource.equipmentType
        ) ||
        resource.equipmentQty !==
          0;


      if (
        !resource.date ||
        (
          !hasPeople &&
          !hasEquipment
        )
      ) {

        skipped++;

        continue;
      }


      if (
        (
          project.resources ||
          []
        )
          .some(
            existing =>
              existing
                .importFingerprint ===
              resource
                .importFingerprint
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
        Boolean(
          findMatchingFrontByMapped(
            row
          )
        );


      const front =
        ensureFrontFromImport(
          row
        );


      if (!front) {

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


      const organizationName =
        normText(
          mappedValue(
            row,
            'organization'
          )
        );


      if (
        organizationName
      ) {

        const organization =
          ensureNamed(
            project.organizations,
            'ORG',
            organizationName
          );


        front.organizationId =
          organization.id;
      }


      front.completed =
        front.status ===
        'Завершено';


      front.updatedAt =
        nowIso();


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

      const date =
        normDate(
          mappedValue(
            row,
            'date'
          )
        );


      const front =
        ensureFrontFromImport(
          row
        );


      if (
        !date ||
        !front
      ) {

        skipped++;

        continue;
      }


      const qty =
        num(
          mappedValue(
            row,
            'qty'
          )
        );


      const suppliedCumulative =
        mappedValue(
          row,
          'cumulative'
        );


      const previous =
        (
          project.factLog ||
          []
        )
          .filter(
            existing =>
              existing.frontId ===
                front.id &&
              existing.date <=
                date
          )
          .reduce(
            (
              sum,
              existing
            ) =>
              sum +
              num(
                existing.qty
              ),
            0
          );


      const cumulative =
        normText(
          suppliedCumulative
        ) !==
          ''
          ? num(
              suppliedCumulative
            )
          : previous +
            qty;


      const fingerprint =
        [

          front.id,

          date,

          qty,

          cumulative,

          num(
            mappedValue(
              row,
              'people'
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
              existing
                .importFingerprint ===
              fingerprint
          )
      ) {

        skipped++;

        continue;
      }


      project.factLog.push({

        id:
          uid(
            'FCT'
          ),

        frontId:
          front.id,

        date,

        qty,

        cumulative,

        people:
          roundInt(
            mappedValue(
              row,
              'people'
            )
          ),

        comment:
          normText(
            mappedValue(
              row,
              'comment'
            )
          ),

        importFingerprint:
          fingerprint,

        source: {

          batchId,

          file:
            importFileName,

          sheet:
            importSheetName,

          row:
            item.rowNumber,

          importedAt:
            nowIso()
        },

        createdAt:
          nowIso()
      });


      front.doneQty =
        Math.max(
          num(
            front.doneQty
          ),
          cumulative
        );


      if (
        !front.factStart ||
        date <
        front.factStart
      ) {

        front.factStart =
          date;
      }


      front.updatedAt =
        nowIso();


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

      const elementType =
        normText(
          mappedValue(
            row,
            'elementType'
          )
        );


      const elementNo =
        normText(
          mappedValue(
            row,
            'elementNo'
          )
        );


      if (
        !elementType ||
        !elementNo
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


      const capture =
        normText(
          mappedValue(
            row,
            'capture'
          )
        );


      const zone =
        normText(
          mappedValue(
            row,
            'zone'
          )
        );


      const duplicate =
        (
          project
            .numberedElements ||
          []
        )
          .find(
            existing =>
              existing.active !==
                false &&
              sameText(
                existing.elementType,
                elementType
              ) &&
              sameText(
                existing.elementNo,
                elementNo
              ) &&
              String(
                existing.buildingId ||
                ''
              ) ===
              String(
                building?.id ||
                ''
              ) &&
              sameText(
                existing.capture ||
                '',
                capture
              ) &&
              sameText(
                existing.zone ||
                '',
                zone
              )
          );


      if (
        duplicate
      ) {

        duplicate.workId =
          work?.id ||
          duplicate.workId ||
          '';


        duplicate.status =
          normalizeStatus(
            mappedValue(
              row,
              'status'
            )
          ) ||
          duplicate.status ||
          'Не начато';


        duplicate.comment =
          normText(
            mappedValue(
              row,
              'comment'
            )
          ) ||
          duplicate.comment ||
          '';


        duplicate.updatedAt =
          nowIso();


        updated++;

      } else {

        project
          .numberedElements
          .push({

            id:
              uid(
                'EL'
              ),

            elementType,

            elementNo,

            buildingId:
              building?.id ||
              '',

            capture,

            zone,

            workId:
              work?.id ||
              '',

            status:
              normalizeStatus(
                mappedValue(
                  row,
                  'status'
                )
              ) ||
              'Не начато',

            comment:
              normText(
                mappedValue(
                  row,
                  'comment'
                )
              ),

            uniqueScope:
              'context',

            active:
              true,

            source: {

              batchId,

              file:
                importFileName,

              sheet:
                importSheetName,

              row:
                item.rowNumber,

              importedAt:
                nowIso()
            },

            createdAt:
              nowIso(),

            updatedAt:
              nowIso()
          });


        created++;
      }


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


      if (!title) {

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


      let milestone =
        (
          project
            .milestones ||
          []
        )
          .find(
            existing =>
              sameText(
                existing.title ||
                existing.name,
                title
              ) &&
              String(
                existing.buildingId ||
                ''
              ) ===
              String(
                building?.id ||
                ''
              )
          );


      const existed =
        Boolean(
          milestone
        );


      if (
        !milestone
      ) {

        milestone = {

          id:
            uid(
              'M'
            ),

          title,

          createdAt:
            nowIso()
        };


        project
          .milestones
          .push(
            milestone
          );
      }


      milestone.title =
        title;


      milestone.buildingId =
        building?.id ||
        milestone.buildingId ||
        '';


      milestone.organizationId =
        organization?.id ||
        milestone.organizationId ||
        '';


      milestone.contractDate =
        normDate(
          mappedValue(
            row,
            'contractEnd'
          )
        ) ||
        milestone.contractDate ||
        '';


      milestone.workDate =
        normDate(
          mappedValue(
            row,
            'planEnd'
          )
        ) ||
        milestone.workDate ||
        '';


      milestone.forecastDate =
        normDate(
          mappedValue(
            row,
            'forecastEnd'
          )
        ) ||
        milestone.forecastDate ||
        '';


      milestone.factDate =
        normDate(
          mappedValue(
            row,
            'factEnd'
          )
        ) ||
        milestone.factDate ||
        '';


      milestone.status =
        normText(
          mappedValue(
            row,
            'status'
          )
        ) ||
        milestone.status ||
        'Не наступила';


      milestone.comment =
        normText(
          mappedValue(
            row,
            'comment'
          )
        ) ||
        milestone.comment ||
        '';


      milestone.updatedAt =
        nowIso();


      if (
        existed
      ) {

        updated++;

      } else {

        created++;
      }
    }
  }


  project.importHistory =
    project.importHistory ||
    [];


  project
    .importHistory
    .unshift({

      id:
        batchId,

      backupKey:
        preImportBackupKey,

      at:
        nowIso(),

      fileName:
        importFileName,

      sheetName:
        importSheetName,

      mode:
        importModeResolved,

      selected:
        selected.length,

      created,

      updated,

      appended,

      skipped,

      mapping:
        clone(
          importMapping
        )
    });


  log(
    'Импорт',
    'Проект',

    `${importFileName} / ${importSheetName}: ` +
    `создано ${created}, ` +
    `обновлено ${updated}, ` +
    `добавлено ${appended}, ` +
    `пропущено ${skipped}`
  );


  await saveProject();


  initSelects();


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {

    refreshAllMultiFilters();
  }


  if (
    typeof initOrganizationCard ===
    'function'
  ) {

    initOrganizationCard();
  }


  renderAll();


  $('importInfo')
    .className =
      'notice good';


  $('importInfo')
    .textContent =
      `Импорт завершен.\n` +
      `Создано: ${created}\n` +
      `Обновлено: ${updated}\n` +
      `Добавлено: ${appended}\n` +
      `Пропущено: ${skipped}`;


  $('commitImportBtn')
    .disabled =
      true;
}


/* =========================================================
   ОТКАТ ПОСЛЕДНЕГО ИМПОРТА
   ========================================================= */

async function rollbackLastImport() {

  const lastImport =
    project
      .importHistory
      ?.[0];


  if (
    !lastImport
  ) {

    alert(
      'В истории проекта нет импортов для отмены.'
    );

    return;
  }


  if (
    !lastImport
      .backupKey
  ) {

    alert(
      'Для этого импорта отсутствует защитная копия.'
    );

    return;
  }


  const backup =
    await dbGetKey(
      lastImport
        .backupKey
    );


  if (
    !backup
  ) {

    alert(
      'Защитная копия перед импортом не найдена.'
    );

    return;
  }


  if (
    !confirm(
      `Отменить последний импорт?\n\n` +
      `Файл: ${lastImport.fileName || '—'}\n` +
      `Лист: ${lastImport.sheetName || '—'}\n\n` +
      'Текущее состояние перед откатом тоже будет сохранено.'
    )
  ) {

    return;
  }


  await dbPutKey(
    clone(
      project
    ),
    `before-rollback-${Date.now()}`
  );


  project =
    normalizeProject(
      backup
    );


  log(
    'Отмена импорта',
    'Проект',

    `Восстановлено состояние до импорта ${lastImport.fileName || ''}`
  );


  await saveProject();


  initSelects();


  if (
    typeof refreshAllMultiFilters ===
    'function'
  ) {

    refreshAllMultiFilters();
  }


  if (
    typeof initOrganizationCard ===
    'function'
  ) {

    initOrganizationCard();
  }


  renderAll();


  alert(
    'Последний импорт отменен.'
  );
}