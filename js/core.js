'use strict';

window.LIV = window.LIV || {};

LIV.DB_NAME = 'acons_planning_local';
LIV.DB_VERSION = 2;
LIV.STORE = 'project';
LIV.PROJECT_KEY = 'main';

LIV.SCHEMA_VERSION = '2.3.0';

LIV.db = null;
LIV.project = null;


LIV.$ = function (id) {
  return document.getElementById(id);
};


LIV.uid = function (prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
};


LIV.nowIso = function () {
  return new Date().toISOString();
};


LIV.today = function () {
  return new Date()
    .toISOString()
    .slice(0, 10);
};


LIV.clone = function (value) {
  return JSON.parse(
    JSON.stringify(value)
  );
};


LIV.num = function (value) {
  return Number(
    String(value ?? 0)
      .replace(/\s/g, '')
      .replace(',', '.')
  ) || 0;
};


LIV.roundInt = function (value) {
  return Math.round(
    LIV.num(value)
  );
};


LIV.normText = function (value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
};


LIV.normKey = function (value) {
  return LIV.normText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[№#]/g, 'номер')
    .replace(/[()]/g, ' ')
    .replace(/[._/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};


LIV.sameText = function (a, b) {
  return (
    LIV.normKey(a) ===
    LIV.normKey(b)
  );
};


LIV.esc = function (value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[char]
    );
};


LIV.byId = function (
  list,
  id
) {
  return (list || []).find(
    item =>
      String(item.id) ===
      String(id)
  );
};


LIV.nameById = function (
  list,
  id
) {
  return (
    LIV.byId(list, id)?.name ||
    ''
  );
};


LIV.unique = function (items) {
  return [
    ...new Set(
      (items || []).filter(
        value =>
          value !== '' &&
          value !== null &&
          value !== undefined
      )
    )
  ];
};


LIV.dateRange = function (
  from,
  to
) {
  const result = [];

  if (!from || !to) {
    return result;
  }

  let current =
    new Date(`${from}T00:00:00`);

  const end =
    new Date(`${to}T00:00:00`);

  while (current <= end) {
    result.push(
      current
        .toISOString()
        .slice(0, 10)
    );

    current.setDate(
      current.getDate() + 1
    );
  }

  return result;
};


LIV.isWorkday = function (date) {
  const day =
    new Date(
      `${date}T00:00:00`
    ).getDay();

  return (
    day !== 0 &&
    day !== 6
  );
};


LIV.shortDate = function (date) {
  if (!date) {
    return '';
  }

  const parts =
    date.split('-');

  return (
    `${parts[2]}.${parts[1]}`
  );
};


LIV.ruDate = function (date) {
  if (!date) {
    return '';
  }

  const parts =
    date.split('-');

  return (
    `${parts[2]}.${parts[1]}.${parts[0]}`
  );
};


LIV.emptyProject = function () {
  return {
    schemaVersion:
      LIV.SCHEMA_VERSION,

    meta: {
      projectName:
        'LIV Planning',

      createdAt:
        LIV.nowIso(),

      updatedAt:
        LIV.nowIso(),

      lastBackupAt:
        null
    },

    buildings: [],
    organizations: [],
    works: [],
    structures: [],
    fronts: [],

    planLog: [],
    factLog: [],

    resources: [],
    resourcePlans: [],

    milestones: [],
    numberedElements: [],
    demolition: [],

    contracts: [],
    constraints: [],

    diagrams: [],
    diagramMarks: [],

    scheduleVersions: [],
    customFields: [],

    views: [],
    importProfiles: [],
    importHistory: [],

    history: []
  };
};


LIV.normalizeProject =
  function (raw) {

    const base =
      LIV.emptyProject();

    const result = {
      ...base,
      ...(raw || {})
    };

    result.meta = {
      ...base.meta,
      ...(raw?.meta || {})
    };

    const arrays = [
      'buildings',
      'organizations',
      'works',
      'structures',
      'fronts',
      'planLog',
      'factLog',
      'resources',
      'resourcePlans',
      'milestones',
      'numberedElements',
      'demolition',
      'contracts',
      'constraints',
      'diagrams',
      'diagramMarks',
      'scheduleVersions',
      'customFields',
      'views',
      'importProfiles',
      'importHistory',
      'history'
    ];

    arrays.forEach(
      key => {
        if (
          Array.isArray(
            raw?.[key]
          )
        ) {
          result[key] =
            raw[key];
        }
      }
    );

    result.resources =
      result.resources.map(
        row => ({
          itr: 0,
          workers: 0,
          mechanizers: 0,
          equipmentQty: 0,
          ...row
        })
      );

    result.schemaVersion =
      LIV.SCHEMA_VERSION;

    return result;
  };


LIV.log = function (
  action,
  entity,
  description,
  details = {}
) {
  LIV.project.history.unshift({
    id:
      LIV.uid('H'),

    at:
      LIV.nowIso(),

    action,
    entity,
    description,
    details
  });
};


LIV.getFrontLabel =
  function (front) {

    if (!front) {
      return '—';
    }

    const structure =
      LIV.byId(
        LIV.project.structures,
        front.structureId
      ) || {};

    return [
      LIV.nameById(
        LIV.project.buildings,
        structure.buildingId
      ),

      structure.block,

      structure.floor !==
        undefined &&
      structure.floor !==
        ''
        ? `${structure.floor} эт.`
        : '',

      structure.capture
        ? `захв. ${structure.capture}`
        : '',

      structure.axis
        ? `ось ${structure.axis}`
        : '',

      structure.side,
      structure.zone,

      LIV.nameById(
        LIV.project.works,
        front.workId
      )
    ]
      .filter(Boolean)
      .join(' / ');
  };
