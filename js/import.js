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


function smartNameKey(value) {
  return strictNameKey(value)
    .replace(/ё/g, 'е')
    .replace(/[«»"'“”„]/g, '')
    .replace(/[()\[\]{},.;:]+/g, ' ')
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function nameSimilarity(a, b) {
  const left = smartNameKey(a);
  const right = smartNameKey(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const aTokens = new Set(left.split(' ').filter(Boolean));
  const bTokens = new Set(right.split(' ').filter(Boolean));
  const union = new Set([...aTokens, ...bTokens]);

  let common = 0;

  aTokens.forEach(token => {
    if (bTokens.has(token)) {
      common++;
    }
  });

  const jaccard =
    union.size
      ? common / union.size
      : 0;

  const containment =
    Math.min(aTokens.size, bTokens.size)
      ? common / Math.min(aTokens.size, bTokens.size)
      : 0;

  return (
    jaccard * 0.7 +
    containment * 0.3
  );
}


function namedEntityType(list) {

  if (
    typeof project ===
      'undefined' ||
    !project
  ) {
    return '';
  }


  if (
    list ===
    project.buildings
  ) {
    return 'building';
  }


  if (
    list ===
    project.works
  ) {
    return 'work';
  }


  if (
    list ===
    project.organizations
  ) {
    return 'organization';
  }


  return '';
}


function mappedNamedItem(
  list,
  sourceValue
) {

  const entityType =
    namedEntityType(
      list
    );


  if (
    !entityType ||
    !Array.isArray(
      project.sourceMappings
    )
  ) {
    return null;
  }


  const key =
    smartNameKey(
      sourceValue
    );


  const mapping =
    project.sourceMappings
      .find(
        item =>
          item &&
          item.targetEntityType ===
            entityType &&
          smartNameKey(
            item.sourceValue
          ) ===
            key &&
          item.decision !==
            'rejected'
      );


  if (!mapping) {
    return null;
  }


  return (
    list ||
    []
  )
    .find(
      item =>
        String(
          item.id
        ) ===
        String(
          mapping.targetLocalId ||
          mapping.targetEntityId
        )
    ) ||
    null;
}


function rememberNamedMapping(
  list,
  sourceValue,
  targetItem,
  confidence =
    1
) {

  const entityType =
    namedEntityType(
      list
    );


  const clean =
    normText(
      sourceValue
    );


  if (
    !entityType ||
    !clean ||
    !targetItem?.id
  ) {
    return;
  }


  targetItem.aliases =
    Array.isArray(
      targetItem.aliases
    )
      ? targetItem.aliases
      : [];


  if (
    !sameText(
      clean,
      targetItem.name
    ) &&
    !targetItem.aliases.some(
      alias =>
        sameText(
          alias,
          clean
        )
    )
  ) {

    targetItem.aliases.push(
      clean
    );
  }


  project.sourceMappings =
    Array.isArray(
      project.sourceMappings
    )
      ? project.sourceMappings
      : [];


  const existing =
    project.sourceMappings
      .find(
        item =>
          item.targetEntityType ===
            entityType &&
          smartNameKey(
            item.sourceValue
          ) ===
            smartNameKey(
              clean
            )
      );


  const data = {
    sourceName:
      normText(
        importSheetName
      ) ||
      normText(
        importFileName
      ) ||
      'Импорт',
    sourceEntityType:
      entityType,
    sourceValue:
      clean,
    targetEntityType:
      entityType,
    targetLocalId:
      targetItem.id,
    confidence:
      Number(
        confidence ||
        1
      ),
    decision:
      'confirmed',
    updatedAt:
      nowIso()
  };


  if (
    existing
  ) {

    Object.assign(
      existing,
      data
    );

  } else {

    project.sourceMappings.push({
      id:
        uid(
          'MAP'
        ),
      ...data,
      createdAt:
        nowIso()
    });
  }
}


function findNamedMatch(list, name) {
  const clean = normText(name);

  if (!clean) {
    return {
      kind: 'empty',
      item: null,
      score: 0
    };
  }

  const mapped =
    mappedNamedItem(
      list,
      clean
    );


  if (
    mapped
  ) {

    return {
      kind:
        'mapped',
      item:
        mapped,
      score:
        1
    };
  }


  const exact = (list || []).find(
    row =>
      strictNameKey(row.name) ===
        strictNameKey(clean) ||
      (
        Array.isArray(row.aliases) &&
        row.aliases.some(
          alias =>
            strictNameKey(alias) ===
            strictNameKey(clean)
        )
      )
  );

  if (exact) {
    return {
      kind: 'exact',
      item: exact,
      score: 1
    };
  }

  const canonical = (list || []).find(
    row =>
      smartNameKey(row.name) ===
        smartNameKey(clean) ||
      (
        Array.isArray(row.aliases) &&
        row.aliases.some(
          alias =>
            smartNameKey(alias) ===
            smartNameKey(clean)
        )
      )
  );

  if (canonical) {
    return {
      kind: 'smart',
      item: canonical,
      score: 1
    };
  }

  const ranked = (list || [])
    .map(item => ({
      item,
      score: nameSimilarity(item.name, clean)
    }))
    .sort((a, b) => b.score - a.score);

  const first = ranked[0];
  const second = ranked[1];

  if (
    first &&
    first.score >= 0.96 &&
    (
      !second ||
      first.score - second.score >= 0.08
    )
  ) {
    return {
      kind: 'smart',
      item: first.item,
      score: first.score
    };
  }

  if (
    first &&
    first.score >= 0.72
  ) {
    return {
      kind: 'suggest',
      item: first.item,
      score: first.score
    };
  }

  return {
    kind: 'new',
    item: null,
    score: 0
  };
}


function namedMatchText(label, list, sourceName) {
  const match =
    findNamedMatch(
      list,
      sourceName
    );

  if (match.kind === 'mapped') {
    return label + ': сохранённое соответствие → «' + match.item.name + '»';
  }

  if (match.kind === 'exact') {
    return label + ': совпало с «' + match.item.name + '»';
  }

  if (match.kind === 'smart') {
    return label + ': сопоставлено с «' + match.item.name + '»';
  }

  if (match.kind === 'suggest') {
    return label + ': похоже на «' + match.item.name + '» — будет создано отдельно';
  }

  if (match.kind === 'new') {
    return label + ': новое значение';
  }

  return label + ': не задано';
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


  const match =
    findNamedMatch(
      list,
      clean
    );

  let item =
    (
      match.kind === 'mapped' ||
      match.kind === 'exact' ||
      match.kind === 'smart'
    )
      ? match.item
      : null;


  if (
    item
  ) {

    rememberNamedMapping(
      list,
      clean,
      item,
      match.score
    );
  }


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
      'секция',
      'блок/захватка',
      'блок захватка'
    ]
  },

  floor: {
    label:
      'Этаж',
    aliases: [
      'этаж',
      'уровень',
      'этаж/номер захватки',
      'этаж номер захватки'
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

  groupCode: {
    label:
      'Группа / ярус / марка',
    aliases: [
      'группа',
      'группа элементов',
      'ярус',
      'марка',
      'типоразмер',
      'серия',
      'контур'
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
      'наименование',
      'наименование работы'
    ]
  },

  contractNo: {
    label:
      '№ договора',
    aliases: [
      '№ договора',
      'номер договора',
      'договор',
      'договор №'
    ]
  },

  durationDays: {
    label:
      'Длительность',
    aliases: [
      'длит',
      'длит.',
      'длительность',
      'продолжительность'
    ]
  },

  deviationSource: {
    label:
      'Отклонение',
    aliases: [
      'отклонение'
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
    'groupCode',
    'building',
    'capture',
    'zone',
    'work',
    'status',
    'comment'
  ],

  milestones: [
    'organization',
    'title',
    'building',
    'block',
    'floor',
    'planStart',
    'planEnd',
    'factEnd',
    'durationDays',
    'deviationSource',
    'status',
    'contractNo',
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

  if (
    mode === 'milestones' &&
    normKey(header) === 'комментарий'
  ) {
    return 'contractNo';
  }

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
    ) ||
    (
      /блок захватка/.test(text) &&
      /этаж номер захватки/.test(text) &&
      /окончание факт/.test(text) &&
      /отклонение/.test(text)
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
              'block',
              'floor'
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

function canonicalMatrixWorkName(
  value
){

  const text =
    normText(
      value
    );

  const key =
    normKey(
      text
    );


  if (
    key.includes(
      'кладка наружных стен'
    )
  ) {
    return 'Кладка наружных стен';
  }


  if (
    key.includes(
      'вертикальн'
    ) &&
    key.includes(
      'армирован'
    )
  ) {
    return 'Вертикальное армирование';
  }


  if (
    key.includes(
      'штукатур'
    )
  ) {
    return 'Штукатурка';
  }


  if (
    key.includes(
      'гидроизоляц'
    )
  ) {
    return 'Гидроизоляция балконов';
  }


  if (
    key.includes(
      'перегород'
    )
  ) {
    return 'Перегородки';
  }


  return text;
}


function matrixReadyStatus(
  value
){

  const key =
    normKey(
      value
    );


  if (
    /^(да|готово|выполнено|завершено|готов)$/.test(
      key
    )
  ) {
    return 'Завершено';
  }


  if (
    /^(нет|не готово|не выполнено)$/.test(
      key
    )
  ) {
    return 'Не начато';
  }


  return '';
}


function detectMatrixScheduleLayout(
  matrix
){

  if (
    !Array.isArray(
      matrix
    ) ||
    matrix.length <
      3
  ) {
    return null;
  }


  let subHeaderIndex =
    -1;


  for (
    let index =
      0;
    index <
      Math.min(
        matrix.length,
        12
      );
    index++
  ) {

    const keys =
      (
        matrix[
          index
        ] ||
        []
      )
        .map(
          normKey
        );


    if (
      keys.includes(
        'здание'
      ) &&
      keys.includes(
        'блок'
      ) &&
      keys.includes(
        'этаж'
      ) &&
      keys.some(
        value =>
          value ===
            'вид работ' ||
          value ===
            'работа'
      ) &&
      keys.includes(
        'ось'
      ) &&
      keys.filter(
        value =>
          value ===
          'подрядчик'
      ).length >=
        2
    ) {

      subHeaderIndex =
        index;

      break;
    }
  }


  if (
    subHeaderIndex <=
      0
  ) {
    return null;
  }


  const groupRow =
    matrix[
      subHeaderIndex -
      1
    ] ||
    [];

  const subRow =
    matrix[
      subHeaderIndex
    ] ||
    [];


  const buildingIndex =
    subRow.findIndex(
      value =>
        normKey(
          value
        ) ===
        'здание'
    );

  const blockIndex =
    subRow.findIndex(
      value =>
        normKey(
          value
        ) ===
        'блок'
    );

  const floorIndex =
    subRow.findIndex(
      value =>
        normKey(
          value
        ) ===
        'этаж'
    );

  const sourceWorkIndex =
    subRow.findIndex(
      value =>
        [
          'вид работ',
          'работа'
        ].includes(
          normKey(
            value
          )
        )
    );

  const axisIndex =
    subRow.findIndex(
      value =>
        normKey(
          value
        ) ===
        'ось'
    );


  if (
    [
      buildingIndex,
      blockIndex,
      floorIndex,
      sourceWorkIndex,
      axisIndex
    ]
      .some(
        index =>
          index <
          0
      )
  ) {
    return null;
  }


  const groupStarts =
    [];


  groupRow.forEach(
    (
      value,
      index
    ) => {

      if (
        index >=
          axisIndex &&
        normText(
          value
        )
      ) {

        groupStarts.push(
          index
        );
      }
    }
  );


  if (
    groupStarts.length <
      2
  ) {
    return null;
  }


  const groups =
    groupStarts
      .map(
        (
          start,
          position
        ) => {

          const end =
            position <
              groupStarts.length -
                1
              ? groupStarts[
                  position +
                  1
                ] -
                1
              : Math.max(
                  groupRow.length,
                  subRow.length
                ) -
                1;


          const dataStart =
            Math.max(
              start,
              axisIndex +
                1
            );


          const columns =
            {};


          for (
            let column =
              dataStart;
            column <=
              end;
            column++
          ) {

            const key =
              normKey(
                subRow[
                  column
                ]
              );


            if (
              key ===
                'подрядчик' ||
              key ===
                'организация'
            ) {
              columns.organization =
                column;
            }


            if (
              key ===
              'начало'
            ) {
              columns.start =
                column;
            }


            if (
              key ===
              'окончание'
            ) {
              columns.end =
                column;
            }


            if (
              key.includes(
                'готовность'
              )
            ) {
              columns.ready =
                column;
            }
          }


          return {
            name:
              canonicalMatrixWorkName(
                groupRow[
                  start
                ]
              ),
            sourceName:
              normText(
                groupRow[
                  start
                ]
              ),
            start:
              dataStart,
            end,
            columns
          };
        }
      )
      .filter(
        group =>
          group.name &&
          (
            group.columns.organization !==
              undefined ||
            group.columns.start !==
              undefined ||
            group.columns.end !==
              undefined
          )
      );


  if (
    groups.length <
      2
  ) {
    return null;
  }


  return {
    subHeaderIndex,
    dataStartIndex:
      subHeaderIndex +
      1,
    buildingIndex,
    blockIndex,
    floorIndex,
    sourceWorkIndex,
    axisIndex,
    groups
  };
}


function matrixLayoutRows(
  matrix,
  layout
){

  const result =
    [];


  (
    matrix
      .slice(
        layout.dataStartIndex
      ) ||
    []
  )
    .forEach(
      (
        sourceRow,
        rowOffset
      ) => {

        const building =
          normText(
            sourceRow[
              layout.buildingIndex
            ]
          );

        const block =
          normText(
            sourceRow[
              layout.blockIndex
            ]
          );

        const floor =
          sourceRow[
            layout.floorIndex
          ];

        const sourceWork =
          normText(
            sourceRow[
              layout.sourceWorkIndex
            ]
          );

        const axis =
          normText(
            sourceRow[
              layout.axisIndex
            ]
          );


        if (
          !building &&
          !block &&
          !normText(
            floor
          ) &&
          !axis
        ) {
          return;
        }


        layout.groups
          .forEach(
            group => {

              const organization =
                group.columns.organization !==
                  undefined
                  ? normText(
                      sourceRow[
                        group.columns.organization
                      ]
                    )
                  : '';

              const start =
                group.columns.start !==
                  undefined
                  ? sourceRow[
                      group.columns.start
                    ]
                  : '';

              const end =
                group.columns.end !==
                  undefined
                  ? sourceRow[
                      group.columns.end
                    ]
                  : '';

              const ready =
                group.columns.ready !==
                  undefined
                  ? sourceRow[
                      group.columns.ready
                    ]
                  : '';


              if (
                !organization &&
                !normText(
                  start
                ) &&
                !normText(
                  end
                ) &&
                !normText(
                  ready
                )
              ) {
                return;
              }


              result.push({
                'Здание':
                  building,
                'Блок':
                  block,
                'Этаж':
                  floor,
                'Ось':
                  axis,
                'Сторона':
                  sourceWork,
                'Работа':
                  group.name,
                'Организация':
                  organization,
                'План начало':
                  start,
                'План окончание':
                  end,
                'Статус':
                  matrixReadyStatus(
                    ready
                  ),
                'Комментарий':
                  group.sourceName !==
                    group.name
                    ? 'Источник: ' +
                      group.sourceName
                    : '',
                __sourceRow:
                  layout.dataStartIndex +
                  rowOffset +
                  1,
                __matrixGroup:
                  group.sourceName
              });
            }
          );
      }
    );


  return result;
}


function readSelectedSheet(){

  if (
    !importWorkbook
  ) {
    return;
  }


  importMatrixLayoutDetected =
    false;

  importMatrixLayoutInfo =
    '';


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


  const matrixLayout =
    detectMatrixScheduleLayout(
      matrix
    );


  if (
    matrixLayout
  ) {

    importMatrixLayoutDetected =
      true;


    importRawRows =
      matrixLayoutRows(
        matrix,
        matrixLayout
      );


    importHeaders = [
      'Здание',
      'Блок',
      'Этаж',
      'Ось',
      'Сторона',
      'Работа',
      'Организация',
      'План начало',
      'План окончание',
      'Статус',
      'Комментарий'
    ];


    importMatrixLayoutInfo =
      'Распознана шахматка: ' +
      matrixLayout.groups.length +
      ' групп работ → ' +
      importRawRows.length +
      ' записей.';


    return;
  }


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
      typeof fillMatrixSelects ===
        'function'
    ) {
      fillMatrixSelects();
    }


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
          `Файл загружен: ${file.name}. ` +
          (
            importMatrixLayoutDetected
              ? importMatrixLayoutInfo + ' '
              : ''
          ) +
          'Нажми «Анализировать». ';
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

function findMatchingImportedMilestone(row) {
  const title =
    normText(
      mappedValue(
        row,
        'title'
      )
    );

  if (!title) {
    return null;
  }

  const organizationMatch =
    findNamedMatch(
      project.organizations || [],
      importSheetName
    );

  const buildingName =
    normText(
      mappedValue(
        row,
        'building'
      )
    );

  const buildingMatch =
    findNamedMatch(
      project.buildings || [],
      buildingName
    );

  const contractNo =
    normText(
      mappedValue(
        row,
        'contractNo'
      )
    );

  return (
    project.milestones ||
    []
  ).find(item => {
    if (
      normKey(item.title) !==
      normKey(title)
    ) {
      return false;
    }

    if (
      organizationMatch.item &&
      String(item.organizationId || '') !==
      String(organizationMatch.item.id)
    ) {
      return false;
    }

    if (
      buildingMatch.item &&
      String(item.buildingId || '') !==
      String(buildingMatch.item.id)
    ) {
      return false;
    }

    if (
      contractNo &&
      item.contractNo &&
      normKey(item.contractNo) !==
      normKey(contractNo)
    ) {
      return false;
    }

    return true;
  }) || null;
}


function previewImportRow(
  raw,
  index
){

  const rowNumber =
    raw.__sourceRow ||
    (
      index +
      2
    );


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

    const existing =
      findMatchingImportedMilestone(
        raw
      );

    const buildingName =
      normText(
        mappedValue(
          raw,
          'building'
        )
      );

    const matchText = [
      namedMatchText(
        'Подрядчик',
        project.organizations || [],
        importSheetName
      ),
      namedMatchText(
        'Здание',
        project.buildings || [],
        buildingName
      )
    ].join(' · ');

    return {
      raw,
      rowNumber,
      status:
        existing
          ? 'Совпадение'
          : 'Готово',
      message:
        (
          existing
            ? 'Обновится существующая КД: ' + title
            : 'Новая КД: ' + title
        ) +
        ' · ' +
        matchText,
      selected:
        true,
      existingId:
        existing?.id ||
        ''
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


  const existingFront =
    findMatchingFrontByMapped(
      raw
    );


  return {
    raw,
    rowNumber,
    status:
      existingFront
        ? 'Совпадение'
        : 'Готово',
    message:
      existingFront
        ? 'Обновится существующая ячейка шахматки'
        : 'Новый фронт работ',
    selected:
      true,
    existingId:
      existingFront?.id ||
      ''
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
        (
          importMatrixLayoutDetected
            ? importMatrixLayoutInfo + '\n'
            : ''
        ) +
        `Записей к проверке: ${importRows.length}\n` +

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
    importMatrixLayoutDetected &&
    requested ===
      'auto'
      ? 'fronts'
      : requested ===
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


  const buildingMatch =
    findNamedMatch(
      project.buildings ||
      [],
      buildingName
    );

  const workMatch =
    findNamedMatch(
      project.works ||
      [],
      workName
    );

  const organizationMatch =
    findNamedMatch(
      project.organizations ||
      [],
      organizationName
    );


  const structureCandidate = {
    buildingId:
      buildingMatch.item?.id ||
      '',
    block:
      normText(
        mappedValue(
          row,
          'block'
        )
      ),
    floor:
      normText(
        mappedValue(
          row,
          'floor'
        )
      ),
    capture:
      normText(
        mappedValue(
          row,
          'capture'
        )
      ),
    axis:
      normText(
        mappedValue(
          row,
          'axis'
        )
      ),
    side:
      normText(
        mappedValue(
          row,
          'side'
        )
      ),
    zone:
      normText(
        mappedValue(
          row,
          'zone'
        )
      ),
    roomNo:
      normText(
        mappedValue(
          row,
          'roomNo'
        )
      ),
    roomName:
      normText(
        mappedValue(
          row,
          'roomName'
        )
      )
  };


  const signature =
    structureSignature(
      structureCandidate
    );


  return activeFronts()
    .find(
      front => {

        const structure =
          byId(
            project.structures,
            front.structureId
          );


        const sameStructure =
          structure &&
          (
            structure.signature ||
            structureSignature(
              structure
            )
          ) ===
            signature;


        return (
          sameStructure &&
          (
            !workMatch.item ||
            front.workId ===
              workMatch.item.id
          ) &&
          (
            !importMatrixTargetId ||
            importMatrixTargetId ===
              'new' ||
            matrixFrontIds(
              importMatrixTargetId
            )
              .has(
                String(
                  front.id
                )
              )
          )
        );
      }
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


  if (
    front
  ) {

    front.buildingId =
      building?.id ||
      front.buildingId ||
      '';

    front.workId =
      work?.id ||
      front.workId ||
      '';

    front.organizationId =
      organization?.id ||
      '';

    front.structureId =
      structure.id;
  }


  return front;
}


function ensureImportedContract(
  organizationId,
  contractNo
) {

  const number =
    normText(
      contractNo
    );


  if (
    !number
  ) {
    return null;
  }


  project.contracts =
    project.contracts ||
    [];


  let contract =
    project.contracts
      .find(
        item =>
          item.active !==
            false &&
          sameText(
            item.number ||
            item.contractNo,
            number
          ) &&
          (
            !organizationId ||
            !item.organizationId ||
            String(
              item.organizationId
            ) ===
              String(
                organizationId
              )
          )
      );


  if (
    !contract
  ) {

    contract = {
      id:
        uid(
          'CTR'
        ),
      organizationId:
        organizationId ||
        '',
      number,
      name:
        number,
      active:
        true,
      createdAt:
        nowIso(),
      updatedAt:
        nowIso()
    };


    project.contracts.push(
      contract
    );
  }


  return contract;
}


function inferMilestoneImportTarget(
  title
) {

  const raw =
    normText(
      title
    );


  if (!raw) {
    return {
      qty:
        null,
      unit:
        ''
    };
  }


  const patterns = [
    {
      regex:
        /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:буронабивн\w*|буросекущ\w*|грунтов\w*)\s+(?:сва\w*|анкер\w*)/i,
      unit:
        'шт.'
    },
    {
      regex:
        /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:сва\w*|анкер\w*)/i,
      unit:
        'шт.'
    },
    {
      regex:
        /(\d+(?:[.,]\d+)?)\s*(м3|м³|м2|м²|м\.?\s*п\.?|шт\.?)/i,
      unit:
        ''
    }
  ];


  for (
    const item of patterns
  ) {

    const match =
      raw.match(
        item.regex
      );


    if (!match) {
      continue;
    }


    const qty =
      num(
        String(
          match[1]
        )
          .replace(
            /\s/g,
            ''
          )
      );


    let unit =
      item.unit ||
      normText(
        match[2]
      );


    if (/м3|м³/i.test(unit)) {
      unit =
        'м³';
    } else if (/м2|м²/i.test(unit)) {
      unit =
        'м²';
    } else if (/м.*п/i.test(unit)) {
      unit =
        'м.п.';
    } else if (/шт/i.test(unit)) {
      unit =
        'шт.';
    }


    return {
      qty:
        qty >
          0
          ? qty
          : null,
      unit
    };
  }


  return {
    qty:
      null,
    unit:
      ''
  };
}


function inferMilestoneNumber(
  title
) {

  const match =
    normText(
      title
    )
      .match(
        /(?:ключевая|контрольная)\s+(?:дата|срок)\s*№?\s*([\d.]+)/i
      );


  return match
    ? match[1]
    : '';
}


function normalizeMilestoneStatus(value) {
  const text = normKey(value);

  if (!text) return 'Не наступила';
  if (/заверш|выполн/.test(text)) return 'Выполнена';
  if (/просроч/.test(text)) return 'Просрочена';
  if (/риск/.test(text)) return 'Под риском';
  if (/работ/.test(text)) return 'В работе';
  if (/перенес/.test(text)) return 'Перенесена';
  if (/отмен/.test(text)) return 'Отменена';
  if (/не наступ/.test(text)) return 'Не наступила';

  return normText(value);
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


function selectedImportMatrixTarget() {

  const value =
    $('importMatrixTarget')
      ?.value ||
    importMatrixTargetId ||
    'new';


  importMatrixTargetId =
    value;


  return value;
}


function createImportMatrix() {

  const name =
    normText(
      $('importMatrixName')
        ?.value
    ) ||
    normText(
      importFileName
        .replace(
          /\.[^.]+$/,
          ''
        )
    ) ||
    'Новая шахматка';


  const matrix = {
    id:
      uid(
        'MX'
      ),
    name,
    sourceType:
      'excel',
    sourceFile:
      importFileName,
    sourceSheet:
      importSheetName,
    active:
      true,
    createdAt:
      nowIso(),
    updatedAt:
      nowIso(),
    lastImportId:
      '',
    viewConfig:
      {}
  };


  project.matrices =
    project.matrices ||
    [];


  project.matrices.push(
    matrix
  );


  return matrix;
}


function resolveImportMatrix() {

  if (
    importModeResolved !==
      'fronts'
  ) {
    return null;
  }


  const target =
    selectedImportMatrixTarget();


  if (
    target ===
      'new'
  ) {
    return createImportMatrix();
  }


  return matrixById(
    target
  );
}


function detachStaleMatrixLinks(
  matrixId,
  touchedFrontIds
) {

  const touched =
    new Set(
      [
        ...touchedFrontIds
      ]
        .map(
          String
        )
    );


  (
    project.matrixFronts ||
    []
  )
    .forEach(
      link => {

        if (
          String(
            link.matrixId
          ) ===
            String(
              matrixId
            ) &&
          link.active !==
            false &&
          !touched.has(
            String(
              link.frontId
            )
          )
        ) {

          link.active =
            false;

          link.updatedAt =
            nowIso();
        }
      }
    );
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


  const targetMatrixId =
    selectedImportMatrixTarget();


  const targetMatrix =
    targetMatrixId ===
      'new'
      ? null
      : matrixById(
          targetMatrixId
        );


  if (
    !confirm(
      `Импортировать выбранные строки: ${selected.length}?\n` +
      (
        importModeResolved ===
          'fronts'
          ? (
              targetMatrix
                ? 'Обновится шахматка: ' +
                  targetMatrix.name
                : 'Будет создана новая шахматка'
            )
          : ''
      )
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


  const importMatrix =
    resolveImportMatrix();


  if (
    importModeResolved ===
      'fronts' &&
    !importMatrix
  ) {

    alert(
      'Не удалось определить шахматку для импорта.'
    );

    return;
  }


  const touchedMatrixFrontIds =
    new Set();


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
        matrixId:
          importMatrix?.id ||
          '',
        ...importSource(
          item
        )
      };


      if (
        importMatrix
      ) {

        if (
          !front.originMatrixId
        ) {
          front.originMatrixId =
            importMatrix.id;
        }


        ensureMatrixFrontLink(
          importMatrix.id,
          front.id,
          batchId
        );


        touchedMatrixFrontIds.add(
          front.id
        );
      }


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
          (
            project.progressFacts ||
            []
          )
            .some(
              existing =>
                existing.sourceFingerprint ===
                fingerprint
            )
        ) ||
        (
          (
            project.factLog ||
            []
          )
            .some(
              existing =>
                existing.importFingerprint ===
                fingerprint
            )
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


      const factId =
        uid(
          'FCT'
        );


      const factComment =
        normText(
          mappedValue(
            row,
            'comment'
          )
        );


      project.progressFacts =
        project.progressFacts ||
        [];


      project.progressFacts.push({
        id:
          factId,
        frontId:
          front.id,
        factDate:
          date,
        factType:
          normText(
            cumulativeRaw
          ) !== ''
            ? 'cumulative_snapshot'
            : 'quantity',
        quantity,
        cumulativeQty:
          cumulative,
        people,
        comment:
          factComment,
        sourceFingerprint:
          fingerprint,
        createdAt:
          nowIso(),
        source: {
          batchId,
          ...importSource(
            item
          )
        }
      });


      project.factLog.push({
        id:
          factId,
        frontId:
          front.id,
        date,
        qty:
          quantity,
        cumulative,
        people,
        comment:
          factComment,
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

        groupCode:
          normText(
            mappedValue(
              row,
              'groupCode'
            )
          ),

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
            candidate.groupCode
          ),
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
                  existing.groupCode
                ),
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


      const organizationName =
        normText(
          mappedValue(
            row,
            'organization'
          )
        ) ||
        normText(
          importSheetName
        );


      const organization =
        organizationName
          ? ensureNamed(
              project.organizations,
              'ORG',
              organizationName
            )
          : null;


      const contractNo =
        normText(
          mappedValue(
            row,
            'contractNo'
          )
        );


      const contract =
        ensureImportedContract(
          organization?.id ||
          '',
          contractNo
        );


      const target =
        inferMilestoneImportTarget(
          title
        );


      const existingMilestone =
        findMatchingImportedMilestone(
          row
        );

      const importedMilestone = {

        id:
          existingMilestone?.id ||
          uid(
            'M'
          ),

        buildingId:
          building?.id ||
          '',

        organizationId:
          organization?.id ||
          '',

        contractId:
          contract?.id ||
          '',

        contractNo,

        milestoneNo:
          inferMilestoneNumber(
            title
          ),

        targetQty:
          target.qty,

        targetUnit:
          target.unit,

        riskWindowDays:
          7,

        blockCapture:
          normText(
            mappedValue(
              row,
              'block'
            )
          ),

        floorCapture:
          normText(
            mappedValue(
              row,
              'floor'
            )
          ),

        startDate:
          normDate(
            mappedValue(
              row,
              'planStart'
            )
          ),

        durationDays:
          Math.max(
            0,
            Math.round(
              num(
                mappedValue(
                  row,
                  'durationDays'
                )
              )
            )
          ),

        importedDeviation:
          normText(
            mappedValue(
              row,
              'deviationSource'
            )
          ) === ''
            ? null
            : num(
                mappedValue(
                  row,
                  'deviationSource'
                )
              ),

        title,

        status:
          normalizeMilestoneStatus(
            mappedValue(
              row,
              'status'
            )
          ),

        contractDate:
          '',

        workDate:
          normDate(
            mappedValue(
              row,
              'planEnd'
            )
          ),

        forecastDate:
          '',

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
      };


      if (
        existingMilestone
      ) {

        const correspondence =
          existingMilestone.correspondence ||
          [];


        Object.assign(
          existingMilestone,
          importedMilestone,
          {
            correspondence,
            createdAt:
              existingMilestone.createdAt ||
              importedMilestone.createdAt,
            updatedAt:
              nowIso()
          }
        );


        updated++;

      } else {

        project.milestones.push(
          importedMilestone
        );


        appended++;
      }
    }
  }


  if (
    importMatrix
  ) {

    detachStaleMatrixLinks(
      importMatrix.id,
      touchedMatrixFrontIds
    );


    importMatrix.sourceFile =
      importFileName;

    importMatrix.sourceSheet =
      importSheetName;

    importMatrix.updatedAt =
      nowIso();

    importMatrix.lastImportId =
      batchId;
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

    matrixId:
      importMatrix?.id ||
      '',

    status:
      'accepted',

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
    (
      importMatrix
        ? `Шахматка: ${importMatrix.name}\n`
        : ''
    ) +
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