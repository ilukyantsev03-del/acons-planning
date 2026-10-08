'use strict';

/* =========================================================
   LIV PLANNING
   ОБЩАЯ КОНФИГУРАЦИЯ
   ========================================================= */

window.ACONS_CONFIG = {

  /* =======================================================
     API
     ======================================================= */

  API_URL:
    'https://script.google.com/macros/s/AKfycbwFRJAeILdVatxnFpgB3-xN6V3Ug1S-e7zlcvqaIL4jRHfW_fcgQ5NMKY2Vtvq551xASQ/exec',


  /* =======================================================
     ОБЩИЕ НАСТРОЙКИ ПРОДУКТА
     ======================================================= */

  APP_NAME:
    'LIV Planning',

  LOCALE:
    'ru-RU',

  DEFAULT_DATE_FORMAT:
    'DD.MM.YYYY',

  DEFAULT_TIMEZONE:
    'Europe/Moscow',


  /* =======================================================
     КАЛЕНДАРИ
     ======================================================= */

  CALENDARS: {

    FIVE_TWO: {
      id:
        '5x2',

      name:
        '5/2',

      workdays: [
        1,
        2,
        3,
        4,
        5
      ],

      weekends: [
        0,
        6
      ]
    },

    SIX_ONE: {
      id:
        '6x1',

      name:
        '6/1',

      workdays: [
        1,
        2,
        3,
        4,
        5,
        6
      ],

      weekends: [
        0
      ]
    },

    SEVEN_ZERO: {
      id:
        '7x0',

      name:
        '7/0',

      workdays: [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ],

      weekends: []
    }
  },


  DEFAULT_CALENDAR:
    '5x2',


  /* =======================================================
     ПРАЗДНИКИ / ИСКЛЮЧЕНИЯ
     ======================================================= */

  HOLIDAY_MODE:
    'project',

  HOLIDAYS: [],

  WORKDAY_OVERRIDES: [],


  /* =======================================================
     РАСЧЁТ ДЛИТЕЛЬНОСТИ
     ======================================================= */

  DURATION_METHODS: [

    {
      id:
        'manual',

      name:
        'Ручной срок'
    },

    {
      id:
        'duration',

      name:
        'По длительности'
    },

    {
      id:
        'productivity',

      name:
        'По объёму и выработке'
    },

    {
      id:
        'productivity_resources',

      name:
        'По объёму, выработке и ресурсам'
    }
  ],


  /* =======================================================
     РЕЗЕРВ
     ======================================================= */

  RESERVE_TYPES: [

    {
      id:
        'none',

      name:
        'Без резерва'
    },

    {
      id:
        'days',

      name:
        'Резерв в днях'
    },

    {
      id:
        'percent',

      name:
        'Резерв в процентах'
    }
  ],


  DEFAULT_RESERVE_TYPE:
    'none',


  /* =======================================================
     ТИПЫ ПРЕДСТАВЛЕНИЙ
     ======================================================= */

  VIEW_TYPES: [

    {
      id:
        'table',

      name:
        'Таблица'
    },

    {
      id:
        'matrix',

      name:
        'Шахматка'
    },

    {
      id:
        'gantt',

      name:
        'Гант'
    },

    {
      id:
        'planfact',

      name:
        'План / факт'
    },

    {
      id:
        'chart',

      name:
        'Диаграмма'
    },

    {
      id:
        'cards',

      name:
        'Карточки'
    }
  ],


  /* =======================================================
     СТАТУСЫ КЛЮЧЕВЫХ ДАТ
     ======================================================= */

  MILESTONE_STATUSES: [

    'Не наступила',

    'В работе',

    'Под риском',

    'Просрочена',

    'Выполнена',

    'Выполнена с просрочкой',

    'Перенесена',

    'Отменена'
  ],


  /* =======================================================
     ПЕРЕПИСКА ПО КД
     ======================================================= */

  CORRESPONDENCE_TYPES: [

    'Исходящее письмо',

    'Входящее письмо',

    'Ответ подрядчика',

    'Уведомление о нарушении',

    'План компенсирующих мероприятий',

    'Согласование',

    'Замечания',

    'Протокол',

    'Иное'
  ],


  /* =======================================================
     СТАТУСЫ РАБОТ
     ======================================================= */

  WORK_STATUSES: [

    'Не начато',

    'Фронт готов',

    'В работе',

    'Завершено',

    'Приостановлено',

    'Ограничение'
  ],


  /* =======================================================
     РЕСУРСЫ
     ======================================================= */

  RESOURCE_METRICS: [

    {
      id:
        'total',

      name:
        'Общая численность'
    },

    {
      id:
        'itr',

      name:
        'ИТР'
    },

    {
      id:
        'workers',

      name:
        'Рабочие'
    },

    {
      id:
        'both',

      name:
        'ИТР + Рабочие'
    },

    {
      id:
        'equipment',

      name:
        'Техника'
    }
  ],


  RESOURCE_STEPS: [

    {
      id:
        'day',

      name:
        'День'
    },

    {
      id:
        'week',

      name:
        'Неделя'
    },

    {
      id:
        'month',

      name:
        'Месяц'
    }
  ],


  DEFAULT_RESOURCE_METRIC:
    'total',

  DEFAULT_RESOURCE_STEP:
    'week',

  SHOW_ZERO_ORGANIZATIONS_BY_DEFAULT:
    false,


  /* =======================================================
     ЭКСПОРТ
     ======================================================= */

  EXPORT_FORMATS: [

    {
      id:
        'pdf',

      name:
        'PDF'
    },

    {
      id:
        'xlsx',

      name:
        'Excel'
    }
  ],


  EXPORT_CURRENT_VIEW_ONLY:
    true,


  /* =======================================================
     КОНСТРУКТОР ПОЛЕЙ
     ======================================================= */

  BUILDER_FIELDS: [

    {
      id:
        'organization',

      name:
        'Организация'
    },

    {
      id:
        'contract',

      name:
        'Договор'
    },

    {
      id:
        'building',

      name:
        'Здание'
    },

    {
      id:
        'work',

      name:
        'Работа'
    },

    {
      id:
        'front',

      name:
        'Фронт'
    },

    {
      id:
        'status',

      name:
        'Статус'
    },

    {
      id:
        'planStart',

      name:
        'План начало'
    },

    {
      id:
        'planEnd',

      name:
        'План окончание'
    },

    {
      id:
        'factStart',

      name:
        'Факт начало'
    },

    {
      id:
        'factEnd',

      name:
        'Факт окончание'
    },

    {
      id:
        'forecastEnd',

      name:
        'Прогноз'
    },

    {
      id:
        'deviation',

      name:
        'Отклонение'
    },

    {
      id:
        'duration',

      name:
        'Длительность'
    },

    {
      id:
        'volume',

      name:
        'Объём'
    },

    {
      id:
        'productivity',

      name:
        'Выработка'
    },

    {
      id:
        'people',

      name:
        'Люди'
    },

    {
      id:
        'equipment',

      name:
        'Техника'
    },

    {
      id:
        'reserve',

      name:
        'Резерв'
    },

    {
      id:
        'comment',

      name:
        'Комментарий'
    }
  ],


  /* =======================================================
     ПОВЕДЕНИЕ СИСТЕМЫ
     ======================================================= */

  FEATURES: {

    enablePdfExport:
      true,

    enableExcelExport:
      true,

    enableSavedViews:
      true,

    enableCustomSections:
      true,

    enableCalculatedDurations:
      true,

    enableForecast:
      true,

    enableCorrespondence:
      true,

    enableFileAttachments:
      true,

    enableImportRollback:
      true,

    enableSafetyBackups:
      true
  }
};