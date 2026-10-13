'use strict';

(function () {
  const MODULE_VERSION = '2026.10.13.1';
  const COMPLETE_ELEMENT_STATUSES = new Set([
    'выполнено',
    'выполнен',
    'сделано',
    'завершено',
    'освидетельствовано',
    'принято'
  ]);
  const COMPLETE_MILESTONE_STATUSES = new Set([
    'выполнена',
    'выполнена с просрочкой',
    'завершено',
    'сделано'
  ]);
  const RISK_LABELS = {
    green: 'Норма',
    yellow: 'Внимание',
    orange: 'Риск',
    red: 'Высокий риск',
    gray: 'Нет расчёта'
  };

  const state = {
    filter: 'all',
    lastSnapshotHashes: {},
    wrappedSave: false,
    observer: null,
    rendering: false
  };

  function el(id) {
    return document.getElementById(id);
  }

  function getProject() {
    try {
      return typeof project !== 'undefined' ? project : null;
    } catch (error) {
      return null;
    }
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function key(value) {
    return text(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function numberValue(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function localDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = text(value);
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (!match) return null;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(match[2]) - 1, Number(match[1]), 12);
  }

  function addDays(dateValue, days) {
    const date = parseDate(dateValue) || new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + Number(days || 0));
    return localDate(copy);
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return String(date.getDate()).padStart(2, '0') + '.' +
      String(date.getMonth() + 1).padStart(2, '0') + '.' +
      String(date.getFullYear()).slice(-2);
  }

  function isWorkday(date, calendarId) {
    const day = date.getDay();
    const calendar = text(calendarId || '7x0');
    if (calendar === '5x2') return day !== 0 && day !== 6;
    if (calendar === '6x1') return day !== 0;
    return true;
  }

  function workdaysBetween(fromValue, toValue, calendarId, includeToday = false) {
    const from = parseDate(fromValue);
    const to = parseDate(toValue);
    if (!from || !to || to < from) return 0;

    let count = 0;
    const cursor = new Date(from.getTime());
    if (!includeToday) cursor.setDate(cursor.getDate() + 1);

    while (cursor <= to) {
      if (isWorkday(cursor, calendarId)) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  function addWorkdays(fromValue, days, calendarId) {
    const start = parseDate(fromValue);
    if (!start) return '';
    if (days <= 0) return localDate(start);

    const cursor = new Date(start.getTime());
    let remaining = Math.ceil(days);
    while (remaining > 0) {
      cursor.setDate(cursor.getDate() + 1);
      if (isWorkday(cursor, calendarId)) remaining -= 1;
    }
    return localDate(cursor);
  }

  function inferTarget(title) {
    const raw = text(title).replace(/\u00a0/g, ' ');
    const patterns = [
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:буронабивн\w*|буросекущ\w*|грунтов\w*)\s+(?:сва|анкер)/i,
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:сва|анкер)/i,
      /(\d+(?:[.,]\d+)?)\s*(м3|м³|м2|м²|м\.?\s*п\.?|шт\.?)/i
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const quantity = numberValue(match[1]);
      let unit = match[2] ? text(match[2]) : 'шт.';
      if (/м3|м³/i.test(unit)) unit = 'м³';
      if (/м2|м²/i.test(unit)) unit = 'м²';
      if (/м.*п/i.test(unit)) unit = 'м.п.';
      return { quantity, unit };
    }

    return { quantity: null, unit: '' };
  }

  function milestoneTargetDate(item) {
    return item.contractDate || item.workDate || item.baselineDate || '';
  }

  function milestoneCalendar(item, front) {
    return item.riskCalendarId || item.riskDetails?.calendarId || front?.calendarId || '7x0';
  }

  function linkedFronts(item, current) {
    const ids = new Set();
    if (item.frontId) ids.add(String(item.frontId));
    (item.riskDetails?.frontIds || []).forEach(id => ids.add(String(id)));
    return (current.fronts || []).filter(front => ids.has(String(front.id)) && front.active !== false);
  }

  function elementTypeHint(item) {
    const title = key(item.title);
    if (/анкер/.test(title)) return 'анкер';
    if (/сва/.test(title)) return 'сва';
    return '';
  }

  function linkedElements(item, current) {
    const groupId = item.elementGroupId || item.riskDetails?.elementGroupId || '';
    const hint = elementTypeHint(item);
    const titleKey = key(item.title);

    return (current.numberedElements || []).filter(element => {
      if (element.active === false) return false;
      if (groupId && String(element.groupId || '') !== String(groupId)) return false;
      if (!groupId && item.buildingId && String(element.buildingId || '') !== String(item.buildingId)) return false;
      if (!groupId && item.workId && element.workId && String(element.workId) !== String(item.workId)) return false;
      if (!groupId && hint && !key(element.elementType).includes(hint)) return false;

      const groupHint = key(item.riskDetails?.groupCode || item.blockCapture || item.floorCapture || '');
      if (
        !groupId &&
        groupHint &&
        ![
          element.groupCode,
          element.mark,
          element.capture,
          element.zone,
          element.layerName
        ].some(value => key(value).includes(groupHint) || groupHint.includes(key(value)))
      ) {
        if (!titleKey.includes(groupHint)) return false;
      }
      return Boolean(groupId || hint || item.buildingId || item.workId);
    });
  }

  function isCompletedElement(element) {
    return COMPLETE_ELEMENT_STATUSES.has(key(element.status));
  }

  function eventDate(element) {
    return element.completedDate || element.factDate || element.updatedAt?.slice?.(0, 10) || '';
  }

  function dailySeriesFromElements(elements) {
    const daily = new Map();
    let actual = 0;

    elements.forEach(element => {
      if (!isCompletedElement(element)) return;
      actual += 1;
      const date = eventDate(element);
      if (date) daily.set(date, (daily.get(date) || 0) + 1);
    });

    return { actual, daily, mode: 'elements' };
  }

  function factRecords(item, current, fronts) {
    const frontIds = new Set(fronts.map(front => String(front.id)));
    const metricIds = new Set();
    if (item.metricId) metricIds.add(String(item.metricId));
    (item.riskDetails?.metricIds || []).forEach(id => metricIds.add(String(id)));

    const result = [];
    const seen = new Set();

    (current.progressFacts || []).forEach(row => {
      const linked =
        (row.frontId && frontIds.has(String(row.frontId))) ||
        (row.metricId && metricIds.has(String(row.metricId)));
      if (!linked) return;
      const identity = row.id || row.sourceFingerprint || JSON.stringify(row);
      if (seen.has(identity)) return;
      seen.add(identity);
      result.push({
        date: row.factDate || row.date || '',
        quantity: numberValue(row.quantity ?? row.qty),
        cumulative: numberValue(row.cumulativeQty ?? row.cumulative),
        status: row.status || ''
      });
    });

    (current.factLog || []).forEach(row => {
      if (!row.frontId || !frontIds.has(String(row.frontId))) return;
      const identity = 'legacy:' + (row.id || row.importFingerprint || JSON.stringify(row));
      if (seen.has(identity)) return;
      seen.add(identity);
      result.push({
        date: row.date || row.factDate || '',
        quantity: numberValue(row.qty ?? row.quantity),
        cumulative: numberValue(row.cumulative ?? row.cumulativeQty),
        status: row.status || ''
      });
    });

    return result.filter(row => parseDate(row.date));
  }

  function dailySeriesFromFacts(records, fronts) {
    const cumulativeByDate = new Map();
    const quantityByDate = new Map();

    records.forEach(row => {
      if (row.cumulative != null) {
        cumulativeByDate.set(row.date, Math.max(cumulativeByDate.get(row.date) || 0, row.cumulative));
      } else if (row.quantity != null) {
        quantityByDate.set(row.date, (quantityByDate.get(row.date) || 0) + row.quantity);
      }
    });

    if (cumulativeByDate.size) {
      const daily = new Map();
      let previous = 0;
      [...cumulativeByDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, cumulative]) => {
          daily.set(date, Math.max(0, cumulative - previous));
          previous = Math.max(previous, cumulative);
        });
      return { actual: previous, daily, mode: 'cumulative' };
    }

    if (quantityByDate.size) {
      return {
        actual: [...quantityByDate.values()].reduce((sum, value) => sum + value, 0),
        daily: quantityByDate,
        mode: 'quantity'
      };
    }

    const frontDone = fronts.reduce((sum, front) => sum + (numberValue(front.doneQty) || 0), 0);
    return { actual: frontDone, daily: new Map(), mode: 'front' };
  }

  function averageRate(daily, asOf, days, calendarId) {
    const end = parseDate(asOf);
    if (!end || days <= 0) return 0;
    let total = 0;
    let divisor = 0;
    const cursor = new Date(end.getTime());
    let visited = 0;

    while (visited < days) {
      if (isWorkday(cursor, calendarId)) {
        const iso = localDate(cursor);
        total += Number(daily.get(iso) || 0);
        divisor += 1;
        visited += 1;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return divisor ? total / divisor : 0;
  }

  function currentTarget(item, fronts, elements) {
    const inferred = inferTarget(item.title);
    let targetQty = numberValue(item.targetQty);
    let targetUnit = text(item.targetUnit) || inferred.unit;

    if (targetQty == null) targetQty = inferred.quantity;

    if (targetQty == null && item.elementGroupId) {
      const current = getProject();
      const group = (current?.numberedElementGroups || []).find(row => String(row.id) === String(item.elementGroupId));
      targetQty = numberValue(group?.totalQty);
      targetUnit = targetUnit || group?.unit || 'шт.';
    }

    if (targetQty == null && elements.length) {
      targetQty = elements.length;
      targetUnit = targetUnit || 'шт.';
    }

    if (targetQty == null && fronts.length === 1) {
      targetQty = numberValue(fronts[0].totalQty);
      targetUnit = targetUnit || fronts[0].unit || '';
    }

    return { targetQty, targetUnit };
  }

  function riskLevelFor(values) {
    if (values.completed) return 'green';
    if (!values.targetDate || values.targetQty == null) return 'gray';
    if (values.remainingQty <= 0) return 'green';
    if (values.daysLeft <= 0) return 'red';
    if (values.recentRate <= 0) return values.daysLeft <= 14 ? 'red' : 'orange';

    const paceRatio = values.requiredRate > 0
      ? values.recentRate / values.requiredRate
      : 99;

    if (paceRatio >= 1.15) return 'green';
    if (paceRatio >= 1) return 'yellow';
    if (paceRatio >= 0.8) return 'orange';
    return 'red';
  }

  function reasonFor(values) {
    if (values.completed) return 'Цель выполнена.';
    if (!values.targetDate) return 'Не задана целевая дата.';
    if (values.targetQty == null) return 'Не задан или не распознан целевой объём.';
    if (values.remainingQty <= 0) return 'Целевой объём достигнут.';
    if (values.daysLeft <= 0) return 'Срок наступил, целевой объём не достигнут.';
    if (!values.hasDatedFacts && values.actualQty > 0) {
      return 'Есть накопительный факт, но нет датированных записей для расчёта темпа.';
    }
    if (values.recentRate <= 0) return 'За расчётный период отсутствует положительный факт.';
    if (values.gapQty > 0) {
      return 'При текущем темпе ожидается недобор ' + round(values.gapQty, 1) + ' ' + (values.targetUnit || '') + '.';
    }
    if (values.recentRate < values.requiredRate * 1.15) return 'Срок достижим, но запас производительности минимален.';
    return 'Текущий темп обеспечивает выполнение в срок.';
  }

  function computeRisk(item, options = {}) {
    const current = getProject();
    const asOf = options.asOf || localDate();
    if (!current || !item) return null;

    const fronts = linkedFronts(item, current);
    const elements = linkedElements(item, current);
    const target = currentTarget(item, fronts, elements);
    const calendarId = milestoneCalendar(item, fronts[0]);
    const targetDate = milestoneTargetDate(item);
    const completed = Boolean(item.factDate) || COMPLETE_MILESTONE_STATUSES.has(key(item.status));

    let series;
    if (elements.length && (elementTypeHint(item) || item.elementGroupId || /шт/i.test(target.targetUnit))) {
      series = dailySeriesFromElements(elements);
    } else {
      series = dailySeriesFromFacts(factRecords(item, current, fronts), fronts);
    }

    const actualQty = Math.max(0, numberValue(item.actualQty) ?? series.actual ?? 0);
    const targetQty = target.targetQty;
    const remainingQty = targetQty == null ? null : Math.max(0, targetQty - actualQty);
    const daysLeft = targetDate ? workdaysBetween(asOf, targetDate, calendarId, false) : null;
    const windowDays = Math.max(1, Math.min(90, Math.round(numberValue(item.riskWindowDays) || 7)));
    const recentRate = averageRate(series.daily, asOf, windowDays, calendarId);
    const longRate = averageRate(series.daily, asOf, 28, calendarId);
    const requiredRate = remainingQty == null || !daysLeft
      ? 0
      : remainingQty / Math.max(1, daysLeft);
    const projectedQty = targetQty == null || daysLeft == null
      ? null
      : actualQty + recentRate * Math.max(0, daysLeft);
    const gapQty = targetQty == null || projectedQty == null
      ? null
      : Math.max(0, targetQty - projectedQty);
    const projectedFinishDate = remainingQty == null || remainingQty <= 0
      ? asOf
      : recentRate > 0
        ? addWorkdays(asOf, Math.ceil(remainingQty / recentRate), calendarId)
        : '';

    const values = {
      milestoneId: item.id,
      reportDate: asOf,
      targetDate,
      targetQty,
      targetUnit: target.targetUnit || '',
      actualQty,
      remainingQty,
      daysLeft,
      recentRate,
      longRate,
      requiredRate,
      projectedQty,
      projectedFinishDate,
      gapQty,
      completed,
      calendarId,
      windowDays,
      seriesMode: series.mode,
      hasDatedFacts: series.daily.size > 0,
      linkedFrontCount: fronts.length,
      linkedElementCount: elements.length
    };

    values.riskLevel = riskLevelFor(values);
    values.reason = reasonFor(values);
    values.label = RISK_LABELS[values.riskLevel] || RISK_LABELS.gray;
    return values;
  }

  function escapeHtml(value) {
    if (typeof esc === 'function') return esc(value);
    return text(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function riskShort(risk) {
    if (!risk || risk.riskLevel === 'gray') return risk?.reason || 'Нет данных для расчёта';
    if (risk.completed) return 'Цель выполнена';
    if (risk.gapQty > 0) return 'Недобор ' + round(risk.gapQty, 1) + ' ' + risk.targetUnit;
    if (risk.requiredRate > 0) {
      return 'Темп ' + round(risk.recentRate, 1) + ' / требуется ' + round(risk.requiredRate, 1);
    }
    return risk.reason;
  }

  function injectStyles() {
    if (el('livMilestoneRiskStyles')) return;
    const style = document.createElement('style');
    style.id = 'livMilestoneRiskStyles';
    style.textContent = `
      .milestone-risk-summary{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin-bottom:12px}
      .milestone-risk-stat{padding:11px 12px;border:1px solid #e1e6ed;border-radius:9px;background:#fff}
      .milestone-risk-stat span{display:block;color:#667085;font-size:10px;margin-bottom:5px}
      .milestone-risk-stat strong{font-size:17px;color:#172033}
      .milestone-risk-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding:10px 12px;border:1px solid #e1e6ed;border-radius:9px;background:#fff}
      .milestone-risk-toolbar select{min-height:34px;border:1px solid #dfe4eb;border-radius:7px;padding:5px 8px;background:#fff}
      .milestone-risk-box{margin-top:7px;padding:7px 8px;border-radius:8px;border:1px solid currentColor;background:#fff;cursor:pointer;line-height:1.3}
      .milestone-risk-box strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
      .milestone-risk-box span{display:block;margin-top:3px;color:#475467;font-size:10px}
      .risk-green{color:#16825d;background:#f0faf5}
      .risk-yellow{color:#967000;background:#fffbea}
      .risk-orange{color:#b85b00;background:#fff5e9}
      .risk-red{color:#b42318;background:#fff2f0}
      .risk-gray{color:#667085;background:#f7f8fa}
      .milestone-risk-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;margin:12px 0}
      .milestone-risk-detail{padding:10px;border:1px solid #e1e6ed;border-radius:8px;background:#f8fafc}
      .milestone-risk-detail span{display:block;color:#667085;font-size:10px;margin-bottom:4px}
      .milestone-risk-detail strong{font-size:15px}
      .milestone-risk-note{padding:11px 12px;border-radius:9px;border:1px solid #e1e6ed;background:#fff;line-height:1.45}
      .milestone-risk-editor-card{grid-column:1/-1;padding:11px 12px;border:1px solid #dbe4ef;border-radius:9px;background:#f8fbff}
      .milestone-risk-editor-card b{display:block;margin-bottom:4px}
      @media(max-width:900px){.milestone-risk-summary{grid-template-columns:repeat(2,minmax(110px,1fr))}.milestone-risk-detail-grid{grid-template-columns:repeat(2,minmax(110px,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function ensureSummaryUi() {
    const panel = el('tab-milestones');
    const body = el('milestoneRows');
    if (!panel || !body || el('milestoneRiskUi')) return;

    const tableCard = body.closest('.card') || body.closest('.table-wrap');
    const wrapper = document.createElement('section');
    wrapper.id = 'milestoneRiskUi';
    wrapper.className = 'no-print';
    wrapper.innerHTML = `
      <div class="milestone-risk-toolbar">
        <div>
          <b>Прогноз ключевых дат</b>
          <div class="muted">Расчёт по целевому объёму, факту и темпу последних дней.</div>
        </div>
        <label>
          <span class="muted">Риск</span>
          <select id="milestoneRiskFilter">
            <option value="all">Все</option>
            <option value="red">Высокий риск</option>
            <option value="orange">Риск</option>
            <option value="yellow">Внимание</option>
            <option value="green">Норма</option>
            <option value="gray">Нет расчёта</option>
          </select>
        </label>
      </div>
      <div class="milestone-risk-summary">
        <div class="milestone-risk-stat"><span>Высокий риск</span><strong id="riskCountRed">0</strong></div>
        <div class="milestone-risk-stat"><span>Риск</span><strong id="riskCountOrange">0</strong></div>
        <div class="milestone-risk-stat"><span>Внимание</span><strong id="riskCountYellow">0</strong></div>
        <div class="milestone-risk-stat"><span>Норма</span><strong id="riskCountGreen">0</strong></div>
        <div class="milestone-risk-stat"><span>Нет расчёта</span><strong id="riskCountGray">0</strong></div>
      </div>
    `;

    tableCard?.parentNode?.insertBefore(wrapper, tableCard);
    el('milestoneRiskFilter')?.addEventListener('change', event => {
      state.filter = event.target.value || 'all';
      decorateRows();
    });
  }

  function openRiskDetails(milestone, risk) {
    if (!milestone || !risk || typeof openModal !== 'function') return;
    openModal(
      'Прогноз ключевой даты',
      `
        <div class="milestone-risk-box risk-${escapeHtml(risk.riskLevel)}" style="cursor:default">
          <strong>${escapeHtml(risk.label)}</strong>
          <span>${escapeHtml(risk.reason)}</span>
        </div>

        <h3>${escapeHtml(milestone.milestoneNo ? milestone.milestoneNo + ' · ' + milestone.title : milestone.title)}</h3>

        <div class="milestone-risk-detail-grid">
          <div class="milestone-risk-detail"><span>Цель</span><strong>${risk.targetQty == null ? '—' : round(risk.targetQty, 1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
          <div class="milestone-risk-detail"><span>Факт</span><strong>${round(risk.actualQty, 1)} ${escapeHtml(risk.targetUnit)}</strong></div>
          <div class="milestone-risk-detail"><span>Осталось</span><strong>${risk.remainingQty == null ? '—' : round(risk.remainingQty, 1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
          <div class="milestone-risk-detail"><span>До срока</span><strong>${risk.daysLeft == null ? '—' : risk.daysLeft + ' дн.'}</strong></div>
          <div class="milestone-risk-detail"><span>Темп ${risk.windowDays} дней</span><strong>${round(risk.recentRate, 2)} ${escapeHtml(risk.targetUnit)}/дн.</strong></div>
          <div class="milestone-risk-detail"><span>Темп 28 дней</span><strong>${round(risk.longRate, 2)} ${escapeHtml(risk.targetUnit)}/дн.</strong></div>
          <div class="milestone-risk-detail"><span>Требуемый темп</span><strong>${round(risk.requiredRate, 2)} ${escapeHtml(risk.targetUnit)}/дн.</strong></div>
          <div class="milestone-risk-detail"><span>Прогноз к сроку</span><strong>${risk.projectedQty == null ? '—' : round(risk.projectedQty, 1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
          <div class="milestone-risk-detail"><span>Прогноз завершения</span><strong>${formatDate(risk.projectedFinishDate)}</strong></div>
        </div>

        <div class="milestone-risk-note">
          <b>Основание расчёта</b><br>
          Целевая дата: ${formatDate(risk.targetDate)}.<br>
          Календарь: ${escapeHtml(risk.calendarId)}.<br>
          Связано фронтов: ${risk.linkedFrontCount}; номерных элементов: ${risk.linkedElementCount}.<br>
          Источник факта: ${escapeHtml(risk.seriesMode)}.
        </div>
      `
    );
  }

  function decorateRows() {
    if (state.rendering) return;
    state.rendering = true;
    try {
      ensureSummaryUi();
      const current = getProject();
      const body = el('milestoneRows');
      if (!current || !body) return;

      const counts = { red: 0, orange: 0, yellow: 0, green: 0, gray: 0 };
      body.querySelectorAll('tr').forEach(row => {
        const button = row.querySelector('[data-ms]');
        if (!button) return;
        const milestone = (current.milestones || []).find(item => String(item.id) === String(button.dataset.ms));
        if (!milestone) return;
        const risk = computeRisk(milestone);
        if (!risk) return;
        counts[risk.riskLevel] = (counts[risk.riskLevel] || 0) + 1;
        row.dataset.riskLevel = risk.riskLevel;
        row.classList.toggle('hidden', state.filter !== 'all' && state.filter !== risk.riskLevel);

        const cell = row.lastElementChild;
        if (!cell) return;
        cell.querySelector('.milestone-risk-box')?.remove();
        const box = document.createElement('button');
        box.type = 'button';
        box.className = 'milestone-risk-box risk-' + risk.riskLevel;
        box.innerHTML = '<strong>' + escapeHtml(risk.label) + '</strong><span>' + escapeHtml(riskShort(risk)) + '</span>';
        box.addEventListener('click', event => {
          event.stopPropagation();
          openRiskDetails(milestone, risk);
        });
        cell.appendChild(box);

        milestone.riskLevel = risk.riskLevel;
        milestone.riskUpdatedAt = new Date().toISOString();
        milestone.riskDetails = {
          ...(milestone.riskDetails || {}),
          calculated: risk
        };
      });

      Object.entries(counts).forEach(([level, value]) => {
        const suffix = level.charAt(0).toUpperCase() + level.slice(1);
        const target = el('riskCount' + suffix);
        if (target) target.textContent = String(value);
      });

      persistRiskSnapshots(current);
    } finally {
      state.rendering = false;
    }
  }

  function editorMilestone() {
    const current = getProject();
    const modalTitle = text(el('modalTitle')?.textContent);
    if (!current || !/ключевая дата/i.test(modalTitle)) return null;
    const title = text(el('mTitle')?.value);
    const no = text(el('mNo')?.value);
    const candidates = (current.milestones || []).filter(item =>
      (!title || item.title === title) && (!no || item.milestoneNo === no)
    );
    return candidates.slice(-1)[0] || null;
  }

  function injectEditorFields() {
    const titleInput = el('mTitle');
    if (!titleInput || el('mTargetQty')) return;
    const modalBody = el('modalBody');
    const grid = modalBody?.querySelector('.form-grid');
    if (!grid) return;

    const milestone = editorMilestone() || {};
    const inferred = inferTarget(titleInput.value);
    const targetQty = milestone.targetQty ?? inferred.quantity ?? '';
    const targetUnit = milestone.targetUnit || inferred.unit || '';

    const fragment = document.createElement('div');
    fragment.style.display = 'contents';
    fragment.innerHTML = `
      <div class="field">
        <label>Целевой объём для прогноза</label>
        <input id="mTargetQty" type="number" step="any" min="0" value="${escapeHtml(targetQty)}" placeholder="Например: 190">
      </div>
      <div class="field">
        <label>Единица цели</label>
        <input id="mTargetUnit" value="${escapeHtml(targetUnit)}" placeholder="шт., м³, м², м.п.">
      </div>
      <div class="field">
        <label>Окно фактического темпа, дней</label>
        <input id="mRiskWindow" type="number" min="1" max="90" step="1" value="${escapeHtml(milestone.riskWindowDays || 7)}">
      </div>
      <div class="field">
        <label>Производственный календарь</label>
        <select id="mRiskCalendar">
          <option value="7x0" ${(milestone.riskCalendarId || '7x0') === '7x0' ? 'selected' : ''}>7/0</option>
          <option value="6x1" ${milestone.riskCalendarId === '6x1' ? 'selected' : ''}>6/1</option>
          <option value="5x2" ${milestone.riskCalendarId === '5x2' ? 'selected' : ''}>5/2</option>
        </select>
      </div>
      <div class="milestone-risk-editor-card">
        <b>Прогноз риска</b>
        <span id="mRiskPreview" class="muted">Свяжи ключевую дату с фронтом или группой элементов. LIV рассчитает требуемый и фактический темп автоматически.</span>
      </div>
    `;
    grid.appendChild(fragment);

    const updatePreview = () => {
      const temporary = {
        ...milestone,
        title: titleInput.value,
        contractDate: el('mContract')?.value || milestone.contractDate,
        workDate: el('mWork')?.value || milestone.workDate,
        frontId: el('mFrontId')?.value || milestone.frontId,
        buildingId: el('mBuilding')?.value || milestone.buildingId,
        workId: el('mWorkId')?.value || milestone.workId,
        targetQty: numberValue(el('mTargetQty')?.value),
        targetUnit: text(el('mTargetUnit')?.value),
        riskWindowDays: numberValue(el('mRiskWindow')?.value) || 7,
        riskCalendarId: el('mRiskCalendar')?.value || '7x0'
      };
      const risk = computeRisk(temporary);
      const preview = el('mRiskPreview');
      if (preview && risk) preview.textContent = risk.label + ': ' + risk.reason;
    };

    ['mTitle','mContract','mWork','mFrontId','mBuilding','mWorkId','mTargetQty','mTargetUnit','mRiskWindow','mRiskCalendar']
      .forEach(id => el(id)?.addEventListener('change', updatePreview));
    titleInput.addEventListener('input', () => {
      const inferredNow = inferTarget(titleInput.value);
      if (el('mTargetQty') && !el('mTargetQty').value && inferredNow.quantity != null) el('mTargetQty').value = inferredNow.quantity;
      if (el('mTargetUnit') && !el('mTargetUnit').value && inferredNow.unit) el('mTargetUnit').value = inferredNow.unit;
      updatePreview();
    });
    updatePreview();
  }

  function wrapMilestoneSave() {
    if (state.wrappedSave || typeof window.saveMilestone !== 'function') return false;
    const original = window.saveMilestone;

    window.saveMilestone = async function (id, correspondence) {
      const beforeIds = new Set((getProject()?.milestones || []).map(item => String(item.id)));
      const title = text(el('mTitle')?.value);
      const extras = {
        targetQty: numberValue(el('mTargetQty')?.value),
        targetUnit: text(el('mTargetUnit')?.value),
        riskWindowDays: Math.max(1, Math.min(90, Math.round(numberValue(el('mRiskWindow')?.value) || 7))),
        riskCalendarId: el('mRiskCalendar')?.value || '7x0'
      };

      await original(id, correspondence);

      const current = getProject();
      let milestone = id
        ? (current?.milestones || []).find(item => String(item.id) === String(id))
        : (current?.milestones || []).find(item => !beforeIds.has(String(item.id)) && item.title === title);

      if (!milestone && !id) {
        milestone = [...(current?.milestones || [])].reverse().find(item => item.title === title) || null;
      }

      if (milestone) {
        Object.assign(milestone, extras, {
          riskUpdatedAt: '',
          updatedAt: new Date().toISOString()
        });
        if (typeof window.saveProject === 'function') await window.saveProject();
        if (typeof window.renderAll === 'function') window.renderAll();
      }
    };

    state.wrappedSave = true;
    return true;
  }

  async function persistRiskSnapshots(current) {
    const client = window.LIV_SUPABASE;
    const normalizer = window.LIV_NORMALIZED_SYNC;
    if (!client || !normalizer?.projectId?.() || !window.LIV_REMOTE_SYNC?.canWrite?.()) return;

    const projectId = normalizer.projectId();
    const reportDate = localDate();
    const rows = [];

    (current.milestones || []).forEach(milestone => {
      const serverMilestoneId = normalizer.serverId?.('milestone', milestone.id);
      if (!serverMilestoneId) return;
      const risk = computeRisk(milestone, { asOf: reportDate });
      if (!risk) return;
      const payload = {
        project_id: projectId,
        milestone_id: serverMilestoneId,
        report_date: reportDate,
        target_qty: risk.targetQty,
        actual_qty: risk.actualQty,
        remaining_qty: risk.remainingQty,
        days_left: risk.daysLeft,
        recent_rate: risk.recentRate,
        long_rate: risk.longRate,
        required_rate: risk.requiredRate,
        projected_qty: risk.projectedQty,
        projected_finish_date: risk.projectedFinishDate || null,
        gap_qty: risk.gapQty,
        risk_level: risk.riskLevel,
        reason: risk.reason,
        details: risk
      };
      const identity = serverMilestoneId + ':' + reportDate;
      const signature = JSON.stringify(payload);
      if (state.lastSnapshotHashes[identity] === signature) return;
      state.lastSnapshotHashes[identity] = signature;
      rows.push(payload);
    });

    if (!rows.length) return;
    const result = await client.from('milestone_risk_snapshots').upsert(rows, {
      onConflict: 'milestone_id,report_date',
      ignoreDuplicates: false
    });
    if (result.error) console.warn('LIV milestone risk: snapshot sync failed', result.error);
  }

  function observe() {
    injectStyles();
    ensureSummaryUi();
    decorateRows();

    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        injectEditorFields();
        decorateRows();
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
    }

    const wrapTimer = setInterval(() => {
      if (wrapMilestoneSave()) clearInterval(wrapTimer);
    }, 150);
    setTimeout(() => clearInterval(wrapTimer), 20000);
  }

  window.LIV_MILESTONE_RISK = {
    version: MODULE_VERSION,
    compute: computeRisk,
    render: decorateRows,
    inferTarget
  };

  window.addEventListener('liv-remote-project', () => setTimeout(decorateRows, 0));
  window.addEventListener('liv-normalized-sync-status', event => {
    if (event.detail?.status === 'ready') setTimeout(decorateRows, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
  } else {
    observe();
  }
})();
