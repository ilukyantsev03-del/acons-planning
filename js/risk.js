'use strict';

(function () {

  function number(value) {
    const result = Number(
      String(
        value == null
          ? 0
          : value
      )
        .replace(/\s/g, '')
        .replace(',', '.')
    );

    return Number.isFinite(result)
      ? result
      : 0;
  }


  function addDays(iso, days) {

    if (!iso) {
      return '';
    }


    const date =
      new Date(
        iso +
        'T00:00:00Z'
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }


    date.setUTCDate(
      date.getUTCDate() +
      Number(
        days ||
        0
      )
    );


    return date
      .toISOString()
      .slice(
        0,
        10
      );
  }


  function daysBetween(from, to) {

    if (
      !from ||
      !to
    ) {
      return null;
    }


    const left =
      Date.parse(
        from +
        'T00:00:00Z'
      );

    const right =
      Date.parse(
        to +
        'T00:00:00Z'
      );


    if (
      !Number.isFinite(left) ||
      !Number.isFinite(right)
    ) {
      return null;
    }


    return Math.round(
      (
        right -
        left
      ) /
      86400000
    );
  }


  function projectObject() {

    try {
      return typeof project !==
        'undefined'
        ? project
        : null;
    } catch (error) {
      return null;
    }
  }


  function todayIso() {

    try {
      if (
        typeof today ===
        'function'
      ) {
        return today();
      }
    } catch (error) {
      // use browser date below
    }


    return new Date()
      .toISOString()
      .slice(
        0,
        10
      );
  }


  function linkedFacts(item) {

    const current =
      projectObject();


    if (
      !current ||
      !item?.frontId
    ) {
      return [];
    }


    return (
      current.progressFacts ||
      []
    )
      .filter(
        fact =>
          String(
            fact.frontId ||
            ''
          ) ===
            String(
              item.frontId
            ) &&
          (
            fact.factDate ||
            fact.date
          )
      )
      .map(
        fact => ({
          ...fact,
          _date:
            fact.factDate ||
            fact.date
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          String(
            left._date
          )
            .localeCompare(
              String(
                right._date
              )
            )
      );
  }


  function linkedFront(item) {

    const current =
      projectObject();


    if (
      !current ||
      !item?.frontId
    ) {
      return null;
    }


    return (
      current.fronts ||
      []
    )
      .find(
        front =>
          String(
            front.id
          ) ===
          String(
            item.frontId
          )
      ) ||
      null;
  }


  function targetQuantity(item) {

    const own =
      number(
        item?.targetQty
      );


    if (
      own >
      0
    ) {
      return own;
    }


    return Math.max(
      0,
      number(
        linkedFront(
          item
        )?.totalQty
      )
    );
  }


  function targetUnit(item) {

    return (
      item?.targetUnit ||
      linkedFront(
        item
      )?.unit ||
      ''
    );
  }


  function targetDate(item) {

    return (
      item?.contractDate ||
      item?.workDate ||
      ''
    );
  }


  function doneQuantity(
    item,
    facts
  ) {

    const snapshots =
      facts
        .filter(
          fact =>
            fact.factType ===
              'cumulative_snapshot' &&
            fact.cumulativeQty !==
              null &&
            fact.cumulativeQty !==
              undefined
        );


    if (
      snapshots.length
    ) {

      return Math.max(
        0,
        number(
          snapshots[
            snapshots.length -
            1
          ]
            .cumulativeQty
        )
      );
    }


    const quantityFacts =
      facts
        .filter(
          fact =>
            fact.factType !==
            'cumulative_snapshot'
        );


    if (
      quantityFacts.length
    ) {

      return Math.max(
        0,
        quantityFacts
          .reduce(
            (
              sum,
              fact
            ) =>
              sum +
              number(
                fact.quantity ??
                fact.qty
              ),
            0
          )
      );
    }


    return Math.max(
      0,
      number(
        linkedFront(
          item
        )?.doneQty
      )
    );
  }


  function pace(
    facts,
    windowDays
  ) {

    const end =
      todayIso();


    const start =
      addDays(
        end,
        -(
          Number(
            windowDays
          ) -
          1
        )
      );


    const quantityFacts =
      facts
        .filter(
          fact =>
            fact.factType !==
              'cumulative_snapshot' &&
            fact._date >=
              start &&
            fact._date <=
              end
        );


    if (
      quantityFacts.length
    ) {

      return (
        quantityFacts
          .reduce(
            (
              sum,
              fact
            ) =>
              sum +
              number(
                fact.quantity ??
                fact.qty
              ),
            0
          ) /
        Math.max(
          1,
          Number(
            windowDays
          )
        )
      );
    }


    const snapshots =
      facts
        .filter(
          fact =>
            fact.factType ===
              'cumulative_snapshot' &&
            fact._date <=
              end
        );


    if (
      snapshots.length <
      2
    ) {
      return 0;
    }


    const last =
      snapshots[
        snapshots.length -
        1
      ];


    const first =
      snapshots.find(
        fact =>
          fact._date >=
          start
      ) ||
      snapshots[
        Math.max(
          0,
          snapshots.length -
          2
        )
      ];


    const days =
      Math.max(
        1,
        daysBetween(
          first._date,
          last._date
        ) ||
        1
      );


    return Math.max(
      0,
      (
        number(
          last.cumulativeQty
        ) -
        number(
          first.cumulativeQty
        )
      ) /
      days
    );
  }


  function forecast(item) {

    if (!item) {
      return null;
    }


    const dueDate =
      targetDate(
        item
      );


    const targetQty =
      targetQuantity(
        item
      );


    if (
      !dueDate ||
      targetQty <=
      0
    ) {
      return null;
    }


    const facts =
      linkedFacts(
        item
      );


    const doneQty =
      doneQuantity(
        item,
        facts
      );


    const remaining =
      Math.max(
        0,
        targetQty -
        doneQty
      );


    const rawDays =
      daysBetween(
        todayIso(),
        dueDate
      );


    const daysRemaining =
      Math.max(
        0,
        rawDays ??
        0
      );


    const paceWindow =
      Math.max(
        1,
        Number(
          item.riskWindowDays ||
          7
        )
      );


    const pace7 =
      pace(
        facts,
        paceWindow
      );


    const pace28 =
      pace(
        facts,
        28
      );


    const requiredPace =
      remaining <=
        0
        ? 0
        : remaining /
          Math.max(
            1,
            daysRemaining
          );


    const forecastQty =
      Math.min(
        targetQty,
        doneQty +
        pace7 *
        daysRemaining
      );


    const shortage =
      Math.max(
        0,
        targetQty -
        forecastQty
      );


    const daysToFinish =
      remaining <=
        0
        ? 0
        : (
            pace7 >
              0
              ? Math.ceil(
                  remaining /
                  pace7
                )
              : null
          );


    const forecastFinish =
      daysToFinish ===
        null
        ? ''
        : addDays(
            todayIso(),
            daysToFinish
          );


    let level =
      'green';


    if (
      remaining >
        0 &&
      daysRemaining <=
        0
    ) {

      level =
        'red';

    } else if (
      remaining >
        0 &&
      pace7 <=
        0
    ) {

      level =
        'red';

    } else if (
      shortage >
        0
    ) {

      const ratio =
        requiredPace >
          0
          ? pace7 /
            requiredPace
          : 1;


      level =
        ratio >=
          0.9
          ? 'yellow'
          : (
              ratio >=
                0.65
                ? 'orange'
                : 'red'
            );
    }


    return {
      level,
      targetDate:
        dueDate,
      targetQty,
      unit:
        targetUnit(
          item
        ),
      doneQty,
      remaining,
      daysRemaining,
      pace7,
      pace28,
      requiredPace,
      forecastQty,
      shortage,
      forecastFinish
    };
  }


  function label(risk) {

    if (!risk) {
      return '';
    }


    return {
      green:
        'Норма',
      yellow:
        'Внимание',
      orange:
        'Риск',
      red:
        'Высокий риск'
    }[
      risk.level
    ] ||
    '';
  }


  function escapeHtml(value) {

    if (
      typeof window.esc ===
      'function'
    ) {
      return window.esc(
        value
      );
    }


    return String(
      value == null
        ? ''
        : value
    )
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      );
  }


  function formatNumber(value) {

    return (
      Math.round(
        Number(
          value ||
          0
        ) *
        100
      ) /
      100
    );
  }


  function riskHtml(risk) {

    if (!risk) {
      return '';
    }


    const forecastDate =
      risk.forecastFinish &&
      typeof window.ruDate ===
        'function'
        ? window.ruDate(
            risk.forecastFinish
          )
        : (
            risk.forecastFinish ||
            ''
          );


    const parts = [
      '<div class="milestone-risk milestone-risk-' +
        escapeHtml(
          risk.level
        ) +
        '">',
      '<b>' +
        escapeHtml(
          label(
            risk
          )
        ) +
        '</b>',
      '<span>Цель: ' +
        formatNumber(
          risk.targetQty
        ) +
        (
          risk.unit
            ? ' ' +
              escapeHtml(
                risk.unit
              )
            : ''
        ) +
        '</span>',
      '<span>Факт: ' +
        formatNumber(
          risk.doneQty
        ) +
        '</span>',
      '<span>Нужно: ' +
        formatNumber(
          risk.requiredPace
        ) +
        '/дн.</span>',
      '<span>Темп: ' +
        formatNumber(
          risk.pace7
        ) +
        '/дн.</span>'
    ];


    if (
      risk.shortage >
      0
    ) {
      parts.push(
        '<span>Недобор: ≈ ' +
        formatNumber(
          risk.shortage
        ) +
        '</span>'
      );
    }


    if (
      forecastDate
    ) {
      parts.push(
        '<span>Прогноз: ' +
        escapeHtml(
          forecastDate
        ) +
        '</span>'
      );
    }


    parts.push(
      '</div>'
    );


    return parts.join(
      ''
    );
  }


  window.milestoneRiskForecast =
    forecast;

  window.milestoneRiskLabel =
    label;

  window.milestoneRiskHtml =
    riskHtml;

  window.LIV_RISK = {
    forecast,
    label,
    html:
      riskHtml,
    pace,
    daysBetween,
    addDays
  };

})();
