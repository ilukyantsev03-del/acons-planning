'use strict';

/* =========================================================
   LIV PLANNING
   Импорт Excel
   ========================================================= */

LIV.importer = {
  workbook: null,

  fileName: '',

  sheetName: '',

  matrix: [],

  headerRowIndex: -1,

  headers: [],

  rawRows: [],

  mapping: {},

  preview: [],

  warnings: []
};


/* =========================================================
   ПОЛЯ ИМПОРТА РЕСУРСОВ
   ========================================================= */

LIV.RESOURCE_IMPORT_FIELDS = [
  {
    key: 'date',
    label: 'Дата',
    required: true
  },

  {
    key: 'organizationName',
    label: 'Организация',
    required: true
  },

  {
    key: 'peopleQty',
    label: 'Количество человек',
    required: false
  },

  {
    key: 'specialization',
    label: 'Специализация',
    required: false
  },

  {
    key: 'equipmentType',
    label: 'Наименование техники',
    required: false
  },

  {
    key: 'equipmentQty',
    label: 'Количество техники',
    required: false
  },

  {
    key: 'buildingName',
    label: 'Здание',
    required: false
  },

  {
    key: 'workName',
    label: 'Работа',
    required: false
  },

  {
    key: 'frontName',
    label: 'Фронт',
    required: false
  },

  {
    key: 'comment',
    label: 'Комментарий',
    required: false
  }
];


/* =========================================================
   ВАРИАНТЫ НАЗВАНИЙ КОЛОНОК
   ========================================================= */

LIV.RESOURCE_IMPORT_ALIASES = {

  date: [
    'дата',
    'дата отчета',
    'дата отчёта',
    'отчетная дата',
    'отчётная дата'
  ],


  organizationName: [
    'организация',
    'наименование организации',
    'подрядчик',
    'субподрядчик',
    'наименование подрядчика'
  ],


  peopleQty: [
    'количество человек',
    'кол во человек',
    'кол-во человек',
    'кол. человек',
    'численность',
    'количество сотрудников',
    'всего человек',
    'всего чел'
  ],


  specialization: [
    'специализация',
    'категория',
    'категория персонала',
    'вид персонала',
    'должность',
    'профессия'
  ],


  equipmentType: [
    'наименование техники',
    'техника',
    'вид техники',
    'тип техники',
    'наименование строительной техники',
    'строительная техника'
  ],


  equipmentQty: [
    'количество техники',
    'кол во техники',
    'кол-во техники',
    'кол. техники',
    'техника количество',

    'количество единиц техники',
    'кол во единиц техники',
    'кол-во единиц техники',

    'количество ед',
    'количество ед.',
    'кол во ед',
    'кол-во ед',
    'кол-во ед.',

    'количество, ед',
    'количество, ед.',
    'количество ед техники',
    'количество единиц'
  ],


  buildingName: [
    'здание',
    'объект',
    'сооружение',
    'корпус'
  ],


  workName: [
    'работа',
    'вид работ',
    'наименование работ',
    'вид работы'
  ],


  frontName: [
    'фронт',
    'фронт работ',
    'участок',
    'зона работ'
  ],


  comment: [
    'комментарий',
    'примечание',
    'комментарии',
    'примечания'
  ]
};


/* =========================================================
   НОРМАЛИЗАЦИЯ ЗАГОЛОВКА
   ========================================================= */

LIV.normalizeImportHeader = function (value) {

  return LIV.normKey(
    String(
      value ?? ''
    )
      .replace(/[,:;]/g, ' ')
      .replace(/\s+/g, ' ')
  );
};


/* =========================================================
   ПОИСК СООТВЕТСТВИЯ ЗАГОЛОВКА
   ========================================================= */

LIV.headerMatchesAliases = function (
  header,
  aliases
) {

  const normalizedHeader =
    LIV.normalizeImportHeader(
      header
    );


  if (!normalizedHeader) {
    return false;
  }


  return aliases.some(
    alias => {

      const normalizedAlias =
        LIV.normalizeImportHeader(
          alias
        );


      return (
        normalizedHeader ===
          normalizedAlias ||
        normalizedHeader.includes(
          normalizedAlias
        )
      );
    }
  );
};


/* =========================================================
   АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ КОЛОНКИ
   ========================================================= */

LIV.detectImportColumn = function (
  headers,
  aliases
) {

  /* Сначала ищем точное совпадение */

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {

    const header =
      LIV.normalizeImportHeader(
        headers[index]
      );


    if (!header) {
      continue;
    }


    const exact =
      aliases.some(
        alias =>
          header ===
          LIV.normalizeImportHeader(
            alias
          )
      );


    if (exact) {
      return index;
    }
  }


  /* Потом частичное */

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {

    if (
      LIV.headerMatchesAliases(
        headers[index],
        aliases
      )
    ) {
      return index;
    }
  }


  return -1;
};


/* =========================================================
   ПОИСК СТРОКИ ЗАГОЛОВКОВ
   ========================================================= */

LIV.findImportHeaderRow = function (
  matrix
) {

  let bestIndex =
    -1;


  let bestScore =
    -1;


  const limit =
    Math.min(
      matrix.length,
      25
    );


  for (
    let rowIndex = 0;
    rowIndex < limit;
    rowIndex += 1
  ) {

    const row =
      matrix[rowIndex] ||
      [];


    let score =
      0;


    Object
      .values(
        LIV.RESOURCE_IMPORT_ALIASES
      )
      .forEach(
        aliases => {

          const found =
            row.some(
              cell =>
                LIV.headerMatchesAliases(
                  cell,
                  aliases
                )
            );


          if (found) {
            score += 1;
          }
        }
      );


    if (
      score >
      bestScore
    ) {
      bestScore =
        score;

      bestIndex =
        rowIndex;
    }
  }


  /*
     Минимально хотим увидеть хотя бы
     дату + еще одно знакомое поле.
  */

  if (
    bestScore <
    2
  ) {
    return -1;
  }


  return bestIndex;
};


/* =========================================================
   АВТОМАТИЧЕСКОЕ СОПОСТАВЛЕНИЕ
   ========================================================= */

LIV.autoDetectResourceMapping = function (
  headers
) {

  const mapping =
    {};


  LIV.RESOURCE_IMPORT_FIELDS
    .forEach(
      field => {

        const aliases =
          LIV.RESOURCE_IMPORT_ALIASES[
            field.key
          ] ||
          [];


        mapping[
          field.key
        ] =
          LIV.detectImportColumn(
            headers,
            aliases
          );
      }
    );


  return mapping;
};


/* =========================================================
   ПРЕОБРАЗОВАНИЕ ДАТЫ EXCEL
   ========================================================= */

LIV.parseImportDate = function (
  value
) {

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
    return value
      .toISOString()
      .slice(
        0,
        10
      );
  }


  /*
     Серийный номер Excel.
  */

  if (
    typeof value ===
      'number' &&
    value > 1000 &&
    typeof XLSX !==
      'undefined' &&
    XLSX.SSF
      ?.parse_date_code
  ) {

    const decoded =
      XLSX.SSF
        .parse_date_code(
          value
        );


    if (decoded) {

      const year =
        String(
          decoded.y
        )
          .padStart(
            4,
            '0'
          );


      const month =
        String(
          decoded.m
        )
          .padStart(
            2,
            '0'
          );


      const day =
        String(
          decoded.d
        )
          .padStart(
            2,
            '0'
          );


      return (
        `${year}-${month}-${day}`
      );
    }
  }


  const text =
    String(value)
      .trim();


  /*
     2026-10-08
  */

  if (
    /^\d{4}-\d{1,2}-\d{1,2}$/
      .test(
        text
      )
  ) {

    const [
      year,
      month,
      day
    ] =
      text.split('-');


    return (
      `${year.padStart(4, '0')}-` +
      `${month.padStart(2, '0')}-` +
      `${day.padStart(2, '0')}`
    );
  }


  /*
     08.10.2026
     08/10/2026
  */

  const russian =
    text.match(
      /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/
    );


  if (russian) {

    let year =
      russian[3];


    if (
      year.length ===
      2
    ) {
      year =
        `20${year}`;
    }


    const month =
      russian[2]
        .padStart(
          2,
          '0'
        );


    const day =
      russian[1]
        .padStart(
          2,
          '0'
        );


    return (
      `${year}-${month}-${day}`
    );
  }


  const parsed =
    new Date(
      text
    );


  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    return parsed
      .toISOString()
      .slice(
        0,
        10
      );
  }


  return '';
};


/* =========================================================
   ЧТЕНИЕ ЗНАЧЕНИЯ ПО СОПОСТАВЛЕНИЮ
   ========================================================= */

LIV.getImportMappedValue = function (
  row,
  mapping,
  key
) {

  const index =
    mapping[key];


  if (
    index ===
      undefined ||
    index ===
      null ||
    Number(index) <
      0
  ) {
    return '';
  }


  return (
    row[
      Number(index)
    ] ??
    ''
  );
};


/* =========================================================
   ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ЛЮДЕЙ
   ========================================================= */

LIV.detectPeopleCategory = function (
  specialization
) {

  const value =
    LIV.normKey(
      specialization
    );


  if (!value) {
    return '';
  }


  if (
    value.includes(
      'итр'
    ) ||
    value.includes(
      'инженерно техничес'
    )
  ) {
    return 'itr';
  }


  if (
    value.includes(
      'механиз'
    ) ||
    value.includes(
      'машинист'
    )
  ) {
    return 'mechanizers';
  }


  if (
    value.includes(
      'подсоб'
    ) ||
    value.includes(
      'рабоч'
    ) ||
    value.includes(
      'монтаж'
    ) ||
    value.includes(
      'бетон'
    ) ||
    value.includes(
      'камен'
    ) ||
    value.includes(
      'арматур'
    )
  ) {
    return 'workers';
  }


  /*
     Если специализация есть, но не распознана,
     не будем молча относить ее к ИТР.
     По умолчанию считаем производственным персоналом.
  */

  return 'workers';
};


/* =========================================================
   СОЗДАНИЕ / ПОИСК СПРАВОЧНИКОВ
   ========================================================= */

LIV.ensureNamedImportItem = function (
  collectionName,
  name,
  prefix
) {

  const cleanName =
    LIV.normText(
      name
    );


  if (!cleanName) {
    return '';
  }


  const collection =
    LIV.project[
      collectionName
    ];


  const existing =
    collection.find(
      item =>
        LIV.sameText(
          item.name,
          cleanName
        )
    );


  if (existing) {
    return existing.id;
  }


  const item = {
    id:
      LIV.uid(
        prefix
      ),

    name:
      cleanName,

    active:
      true,

    createdAt:
      LIV.nowIso(),

    source:
      'import'
  };


  collection.push(
    item
  );


  return item.id;
};


/* =========================================================
   КЛЮЧ ИМПОРТИРОВАННОЙ СТРОКИ
   ========================================================= */

LIV.makeResourceImportKey = function (
  row
) {

  return [
    LIV.normKey(
      row.date
    ),

    LIV.normKey(
      row.organizationName
    ),

    LIV.normKey(
      row.buildingName
    ),

    LIV.normKey(
      row.workName
    ),

    LIV.normKey(
      row.frontName
    ),

    LIV.normKey(
      row.specialization
    ),

    LIV.normKey(
      row.equipmentType
    )
  ]
    .join('|');
};


/* =========================================================
   ПРЕОБРАЗОВАНИЕ СТРОК EXCEL
   ========================================================= */

LIV.buildResourceImportPreview = function () {

  const mapping =
    LIV.importer.mapping;


  const rows =
    LIV.importer.rawRows;


  const preview =
    [];


  const warnings =
    [];


  /*
     Для объединенных ячеек Excel.
     Значения групповых колонок протягиваем вниз.
  */

  const carry = {
    date: '',
    organizationName: '',
    buildingName: '',
    workName: '',
    frontName: ''
  };


  rows.forEach(
    (
      sourceRow,
      index
    ) => {

      let dateRaw =
        LIV.getImportMappedValue(
          sourceRow,
          mapping,
          'date'
        );


      let organizationName =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'organizationName'
          )
        );


      let buildingName =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'buildingName'
          )
        );


      let workName =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'workName'
          )
        );


      let frontName =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'frontName'
          )
        );


      if (
        dateRaw !==
        ''
      ) {
        carry.date =
          dateRaw;
      } else {
        dateRaw =
          carry.date;
      }


      if (
        organizationName
      ) {
        carry.organizationName =
          organizationName;
      } else {
        organizationName =
          carry.organizationName;
      }


      if (
        buildingName
      ) {
        carry.buildingName =
          buildingName;
      } else {
        buildingName =
          carry.buildingName;
      }


      if (
        workName
      ) {
        carry.workName =
          workName;
      } else {
        workName =
          carry.workName;
      }


      if (
        frontName
      ) {
        carry.frontName =
          frontName;
      } else {
        frontName =
          carry.frontName;
      }


      const date =
        LIV.parseImportDate(
          dateRaw
        );


      const peopleQtyRaw =
        LIV.getImportMappedValue(
          sourceRow,
          mapping,
          'peopleQty'
        );


      const specialization =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'specialization'
          )
        );


      const equipmentType =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'equipmentType'
          )
        );


      const equipmentQtyRaw =
        LIV.getImportMappedValue(
          sourceRow,
          mapping,
          'equipmentQty'
        );


      const comment =
        LIV.normText(
          LIV.getImportMappedValue(
            sourceRow,
            mapping,
            'comment'
          )
        );


      const peopleQty =
        LIV.num(
          peopleQtyRaw
        );


      const equipmentQty =
        LIV.num(
          equipmentQtyRaw
        );


      /*
         Полностью пустую строку пропускаем.
      */

      const hasSomething =
        date ||
        organizationName ||
        peopleQty ||
        specialization ||
        equipmentType ||
        equipmentQty ||
        comment;


      if (!hasSomething) {
        return;
      }


      const rowWarnings =
        [];


      if (!date) {
        rowWarnings.push(
          'Не определена дата'
        );
      }


      if (!organizationName) {
        rowWarnings.push(
          'Не определена организация'
        );
      }


      /*
         КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ТЕХНИКИ.

         Если техника указана, но исходная ячейка
         количества вообще пустая — мы НЕ делаем вид,
         что техника равна нулю.
      */

      if (
        equipmentType &&
        (
          equipmentQtyRaw ===
            '' ||
          equipmentQtyRaw ===
            null ||
          equipmentQtyRaw ===
            undefined
        )
      ) {
        rowWarnings.push(
          'Есть техника, но отсутствует количество техники'
        );
      }


      const category =
        LIV.detectPeopleCategory(
          specialization
        );


      let itr =
        0;


      let workers =
        0;


      let mechanizers =
        0;


      if (
        category ===
        'itr'
      ) {
        itr =
          peopleQty;
      }


      if (
        category ===
        'workers'
      ) {
        workers =
          peopleQty;
      }


      if (
        category ===
        'mechanizers'
      ) {
        mechanizers =
          peopleQty;
      }


      const prepared = {
        sourceRow:
          LIV.importer
            .headerRowIndex +
          2 +
          index,

        date,

        organizationName,

        buildingName,

        workName,

        frontName,

        peopleQty:
          LIV.roundInt(
            peopleQty
          ),

        specialization,

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

        equipmentType,

        equipmentQty:
          LIV.roundInt(
            equipmentQty
          ),

        comment,

        warnings:
          rowWarnings
      };


      prepared.importSourceKey =
        LIV.makeResourceImportKey(
          prepared
        );


      preview.push(
        prepared
      );


      rowWarnings.forEach(
        warning => {

          warnings.push(
            `Строка ${prepared.sourceRow}: ${warning}`
          );
        }
      );
    }
  );


  LIV.importer.preview =
    preview;


  LIV.importer.warnings =
    warnings;


  return preview;
};


/* =========================================================
   ОТРИСОВКА СОПОСТАВЛЕНИЯ КОЛОНОК
   ========================================================= */

LIV.renderImportMapping = function () {

  const container =
    LIV.$(
      'importMapping'
    );


  const card =
    LIV.$(
      'importMappingCard'
    );


  if (
    !container ||
    !card
  ) {
    return;
  }


  card.classList.remove(
    'hidden'
  );


  const headers =
    LIV.importer.headers;


  container.innerHTML =
    LIV.RESOURCE_IMPORT_FIELDS
      .map(
        field => {

          const selected =
            LIV.importer.mapping[
              field.key
            ];


          return `
            <div class="field">

              <label>
                ${LIV.esc(
                  field.label
                )}
                ${
                  field.required
                    ? ' *'
                    : ''
                }
              </label>

              <select
                data-import-map="${LIV.esc(
                  field.key
                )}"
              >

                <option value="-1">
                  Не использовать
                </option>

                ${
                  headers
                    .map(
                      (
                        header,
                        index
                      ) => `
                        <option
                          value="${index}"
                          ${
                            Number(
                              selected
                            ) ===
                            index
                              ? 'selected'
                              : ''
                          }
                        >
                          ${
                            index + 1
                          }. ${LIV.esc(
                            header ||
                            '(без названия)'
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


  container
    .querySelectorAll(
      '[data-import-map]'
    )
    .forEach(
      select => {

        select.addEventListener(
          'change',
          () => {

            const key =
              select.dataset
                .importMap;


            LIV.importer.mapping[
              key
            ] =
              Number(
                select.value
              );


            LIV.buildResourceImportPreview();


            LIV.renderImportPreview();
          }
        );
      }
    );
};


/* =========================================================
   ТЕКСТ СОПОСТАВЛЕНИЯ
   ========================================================= */

LIV.getImportMappingSummary = function () {

  const mapping =
    LIV.importer.mapping;


  const headers =
    LIV.importer.headers;


  const parts =
    [];


  LIV.RESOURCE_IMPORT_FIELDS
    .forEach(
      field => {

        const index =
          mapping[
            field.key
          ];


        const source =
          Number(index) >=
          0
            ? headers[
                Number(index)
              ]
            : 'не определено';


        parts.push(
          `${field.label}: ${source}`
        );
      }
    );


  return parts;
};


/* =========================================================
   ОТРИСОВКА ПРЕДПРОСМОТРА
   ========================================================= */

LIV.renderImportPreview = function () {

  const head =
    LIV.$(
      'importHead'
    );


  const body =
    LIV.$(
      'importBody'
    );


  const info =
    LIV.$(
      'importInfo'
    );


  if (
    !head ||
    !body ||
    !info
  ) {
    return;
  }


  const preview =
    LIV.importer.preview;


  head.innerHTML = `
    <tr>

      <th>
        Строка Excel
      </th>

      <th>
        Дата
      </th>

      <th>
        Организация
      </th>

      <th>
        Специализация
      </th>

      <th>
        Кол. человек
      </th>

      <th>
        ИТР
      </th>

      <th>
        Рабочие
      </th>

      <th>
        Механизаторы
      </th>

      <th>
        Техника
      </th>

      <th>
        Кол. техники
      </th>

      <th>
        Проверка
      </th>

    </tr>
  `;


  body.innerHTML =
    preview
      .slice(
        0,
        300
      )
      .map(
        row => `
          <tr>

            <td>
              ${row.sourceRow}
            </td>

            <td>
              ${LIV.esc(
                LIV.ruDate(
                  row.date
                )
              )}
            </td>

            <td>
              ${LIV.esc(
                row.organizationName
              )}
            </td>

            <td>
              ${LIV.esc(
                row.specialization
              )}
            </td>

            <td>
              ${row.peopleQty}
            </td>

            <td>
              ${row.itr}
            </td>

            <td>
              ${row.workers}
            </td>

            <td>
              ${row.mechanizers}
            </td>

            <td>
              ${LIV.esc(
                row.equipmentType
              )}
            </td>

            <td>
              ${
                row.equipmentType &&
                row.warnings.some(
                  warning =>
                    warning.includes(
                      'количество техники'
                    )
                )
                  ? '⚠'
                  : row.equipmentQty
              }
            </td>

            <td>
              ${
                row.warnings.length
                  ? LIV.esc(
                      row.warnings.join(
                        '; '
                      )
                    )
                  : 'OK'
              }
            </td>

          </tr>
        `
      )
      .join('');


  const equipmentQtyIndex =
    LIV.importer.mapping
      .equipmentQty;


  const equipmentQtyHeader =
    Number(
      equipmentQtyIndex
    ) >= 0
      ? LIV.importer.headers[
          Number(
            equipmentQtyIndex
          )
        ]
      : 'НЕ ОПРЕДЕЛЕНА';


  const equipmentTypeIndex =
    LIV.importer.mapping
      .equipmentType;


  const equipmentTypeHeader =
    Number(
      equipmentTypeIndex
    ) >= 0
      ? LIV.importer.headers[
          Number(
            equipmentTypeIndex
          )
        ]
      : 'НЕ ОПРЕДЕЛЕНА';


  info.classList.remove(
    'hidden'
  );


  info.innerHTML = `
    <strong>
      Найдено строк: ${preview.length}
    </strong>

    <br>

    Наименование техники:
    <b>
      ${LIV.esc(
        equipmentTypeHeader
      )}
    </b>

    <br>

    Количество техники:
    <b>
      ${LIV.esc(
        equipmentQtyHeader
      )}
    </b>

    ${
      LIV.importer.warnings.length
        ? `
          <br><br>

          <b>
            Предупреждений:
            ${LIV.importer.warnings.length}
          </b>
        `
        : ''
    }
  `;


  /*
     Если наименование техники нашли,
     а количество техники вообще не нашли,
     импорт блокируем.

     Пользователь сначала вручную выбирает
     правильную колонку.
  */

  const equipmentTypeMapped =
    Number(
      LIV.importer.mapping
        .equipmentType
    ) >= 0;


  const equipmentQtyMapped =
    Number(
      LIV.importer.mapping
        .equipmentQty
    ) >= 0;


  const commit =
    LIV.$(
      'commitImportBtn'
    );


  if (commit) {

    const requiredOk =
      Number(
        LIV.importer.mapping
          .date
      ) >= 0 &&
      Number(
        LIV.importer.mapping
          .organizationName
      ) >= 0;


    const equipmentOk =
      !equipmentTypeMapped ||
      equipmentQtyMapped;


    commit.disabled =
      !requiredOk ||
      !equipmentOk ||
      !preview.length;
  }
};


/* =========================================================
   АНАЛИЗ ВЫБРАННОГО ЛИСТА
   ========================================================= */

LIV.analyzeResourceImport = function () {

  if (
    !LIV.importer.workbook
  ) {
    return;
  }


  const sheetName =
    LIV.$(
      'importSheet'
    )?.value;


  if (!sheetName) {
    return;
  }


  const sheet =
    LIV.importer
      .workbook
      .Sheets[
        sheetName
      ];


  if (!sheet) {
    return;
  }


  const matrix =
    XLSX.utils
      .sheet_to_json(
        sheet,
        {
          header: 1,

          defval: '',

          raw: true,

          blankrows: false
        }
      );


  LIV.importer.sheetName =
    sheetName;


  LIV.importer.matrix =
    matrix;


  const headerRowIndex =
    LIV.findImportHeaderRow(
      matrix
    );


  if (
    headerRowIndex <
    0
  ) {

    alert(
      'Не удалось автоматически определить строку заголовков.'
    );

    return;
  }


  LIV.importer.headerRowIndex =
    headerRowIndex;


  LIV.importer.headers =
    (
      matrix[
        headerRowIndex
      ] ||
      []
    )
      .map(
        value =>
          LIV.normText(
            value
          )
      );


  LIV.importer.rawRows =
    matrix.slice(
      headerRowIndex +
      1
    );


  LIV.importer.mapping =
    LIV.autoDetectResourceMapping(
      LIV.importer.headers
    );


  LIV.renderImportMapping();


  LIV.buildResourceImportPreview();


  LIV.renderImportPreview();
};


/* =========================================================
   ЧТЕНИЕ ФАЙЛА EXCEL
   ========================================================= */

LIV.handleImportFile = async function (
  file
) {

  if (!file) {
    return;
  }


  if (
    typeof XLSX ===
    'undefined'
  ) {
    alert(
      'Библиотека Excel не загрузилась.'
    );

    return;
  }


  const buffer =
    await file.arrayBuffer();


  const workbook =
    XLSX.read(
      buffer,
      {
        type:
          'array',

        cellDates:
          true
      }
    );


  LIV.importer.workbook =
    workbook;


  LIV.importer.fileName =
    file.name;


  const select =
    LIV.$(
      'importSheet'
    );


  if (!select) {
    return;
  }


  select.innerHTML =
    workbook.SheetNames
      .map(
        name => `
          <option value="${LIV.esc(name)}">
            ${LIV.esc(name)}
          </option>
        `
      )
      .join('');


  select.disabled =
    false;


  if (
    LIV.$(
      'analyzeImportBtn'
    )
  ) {
    LIV.$(
      'analyzeImportBtn'
    ).disabled =
      false;
  }


  if (
    workbook.SheetNames
      .length
  ) {
    select.value =
      workbook.SheetNames[
        0
      ];
  }
};


/* =========================================================
   ПОИСК СУЩЕСТВУЮЩЕЙ ИМПОРТИРОВАННОЙ ЗАПИСИ
   ========================================================= */

LIV.findExistingImportedResource = function (
  sourceKey
) {

  return (
    LIV.project.resources ||
    []
  )
    .find(
      row =>
        row.importSourceKey ===
        sourceKey
    ) ||
    null;
};


/* =========================================================
   ИМПОРТ В ПРОЕКТ
   ========================================================= */

LIV.commitResourceImport = async function () {

  const preview =
    LIV.importer.preview;


  if (!preview.length) {
    alert(
      'Нет данных для импорта.'
    );

    return;
  }


  const equipmentTypeMapped =
    Number(
      LIV.importer.mapping
        .equipmentType
    ) >= 0;


  const equipmentQtyMapped =
    Number(
      LIV.importer.mapping
        .equipmentQty
    ) >= 0;


  if (
    equipmentTypeMapped &&
    !equipmentQtyMapped
  ) {

    alert(
      'Найдена колонка с наименованием техники, ' +
      'но не выбрана колонка с количеством техники. ' +
      'Выбери ее в сопоставлении колонок.'
    );

    return;
  }


  /*
     Перед импортом обязательно
     делаем локальную резервную копию.
  */

  const backupKey =
    await LIV.createLocalBackup(
      'pre-import'
    );


  const importId =
    LIV.uid(
      'IMP'
    );


  const createdIds =
    [];


  const updatedBefore =
    [];


  let created =
    0;


  let updated =
    0;


  let skipped =
    0;


  for (
    const row of preview
  ) {

    if (
      !row.date ||
      !row.organizationName
    ) {
      skipped += 1;

      continue;
    }


    const organizationId =
      LIV.ensureNamedImportItem(
        'organizations',
        row.organizationName,
        'ORG'
      );


    const buildingId =
      row.buildingName
        ? LIV.ensureNamedImportItem(
            'buildings',
            row.buildingName,
            'BLD'
          )
        : '';


    const workId =
      row.workName
        ? LIV.ensureNamedImportItem(
            'works',
            row.workName,
            'WORK'
          )
        : '';


    const existing =
      LIV.findExistingImportedResource(
        row.importSourceKey
      );


    const data = {
      date:
        row.date,

      organizationId,

      organizationName:
        row.organizationName,

      buildingId,

      buildingName:
        row.buildingName,

      workId,

      workName:
        row.workName,

      frontName:
        row.frontName,

      specialization:
        row.specialization,

      itr:
        LIV.roundInt(
          row.itr
        ),

      workers:
        LIV.roundInt(
          row.workers
        ),

      mechanizers:
        LIV.roundInt(
          row.mechanizers
        ),

      equipmentType:
        row.equipmentType,

      equipmentQty:
        LIV.roundInt(
          row.equipmentQty
        ),

      comment:
        row.comment,

      importSourceKey:
        row.importSourceKey,

      importId,

      importFile:
        LIV.importer.fileName,

      importSheet:
        LIV.importer.sheetName,

      importSourceRow:
        row.sourceRow,

      updatedAt:
        LIV.nowIso()
    };


    if (existing) {

      updatedBefore.push({
        id:
          existing.id,

        value:
          LIV.clone(
            existing
          )
      });


      Object.assign(
        existing,
        data
      );


      updated += 1;

    } else {

      const newRow = {
        id:
          LIV.uid(
            'R'
          ),

        createdAt:
          LIV.nowIso(),

        ...data
      };


      LIV.project.resources.push(
        newRow
      );


      createdIds.push(
        newRow.id
      );


      created += 1;
    }
  }


  const history = {
    id:
      importId,

    type:
      'resources',

    fileName:
      LIV.importer.fileName,

    sheetName:
      LIV.importer.sheetName,

    at:
      LIV.nowIso(),

    backupKey,

    created,

    updated,

    skipped,

    createdIds,

    updatedBefore,

    mapping:
      LIV.clone(
        LIV.importer.mapping
      ),

    headers:
      LIV.clone(
        LIV.importer.headers
      )
  };


  LIV.project
    .importHistory
    .push(
      history
    );


  LIV.log(
    'Импорт Excel',
    'Ресурсы',

    `${LIV.importer.fileName} · ${LIV.importer.sheetName}`,

    {
      importId,

      created,

      updated,

      skipped
    }
  );


  await LIV.saveProject();


  if (
    typeof LIV.refreshResourceFilters ===
    'function'
  ) {
    LIV.refreshResourceFilters();
  }


  if (
    typeof LIV.renderResources ===
    'function'
  ) {
    LIV.renderResources();
  }


  if (
    typeof LIV.renderOrganizations ===
    'function'
  ) {
    LIV.renderOrganizations();
  }


  alert(
    `Импорт завершен.\n\n` +
    `Добавлено: ${created}\n` +
    `Обновлено: ${updated}\n` +
    `Пропущено: ${skipped}`
  );
};


/* =========================================================
   ОТМЕНА ПОСЛЕДНЕГО ИМПОРТА
   ========================================================= */

LIV.rollbackLastResourceImport = async function () {

  const imports =
    LIV.project
      .importHistory ||
    [];


  const last =
    [...imports]
      .reverse()
      .find(
        item =>
          item.type ===
          'resources'
      );


  if (!last) {

    alert(
      'Импорт ресурсов для отмены не найден.'
    );

    return;
  }


  const approved =
    confirm(
      `Отменить импорт:\n` +
      `${last.fileName || ''}\n` +
      `${last.sheetName || ''}?`
    );


  if (!approved) {
    return;
  }


  /*
     Удаляем записи,
     которые были созданы этим импортом.
  */

  const createdSet =
    new Set(
      last.createdIds ||
      []
    );


  LIV.project.resources =
    LIV.project.resources
      .filter(
        row =>
          !createdSet.has(
            row.id
          )
      );


  /*
     Возвращаем старые значения
     у обновленных записей.
  */

  (
    last.updatedBefore ||
    []
  )
    .forEach(
      snapshot => {

        const index =
          LIV.project.resources
            .findIndex(
              row =>
                row.id ===
                snapshot.id
            );


        if (
          index >=
          0
        ) {
          LIV.project.resources[
            index
          ] =
            LIV.clone(
              snapshot.value
            );
        }
      }
    );


  LIV.project.importHistory =
    LIV.project.importHistory
      .filter(
        item =>
          item.id !==
          last.id
      );


  LIV.log(
    'Отмена импорта',
    'Ресурсы',

    `${last.fileName || ''} · ${last.sheetName || ''}`,

    {
      importId:
        last.id
    }
  );


  await LIV.saveProject();


  if (
    typeof LIV.refreshResourceFilters ===
    'function'
  ) {
    LIV.refreshResourceFilters();
  }


  if (
    typeof LIV.renderResources ===
    'function'
  ) {
    LIV.renderResources();
  }


  alert(
    'Последний импорт ресурсов отменен.'
  );
};


/* =========================================================
   ПРИВЯЗКА СОБЫТИЙ
   ========================================================= */

LIV.bindImportEvents = function () {

  LIV.$(
    'importFile'
  )
    ?.addEventListener(
      'change',
      async event => {

        const file =
          event.target
            .files?.[0];


        await LIV.handleImportFile(
          file
        );
      }
    );


  LIV.$(
    'analyzeImportBtn'
  )
    ?.addEventListener(
      'click',
      LIV.analyzeResourceImport
    );


  LIV.$(
    'commitImportBtn'
  )
    ?.addEventListener(
      'click',
      LIV.commitResourceImport
    );


  LIV.$(
    'rollbackImportBtn'
  )
    ?.addEventListener(
      'click',
      LIV.rollbackLastResourceImport
    );
};