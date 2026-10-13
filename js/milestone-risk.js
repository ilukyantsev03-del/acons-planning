'use strict';

(function () {
  const VERSION = '2026.10.13.4';
  const COMPLETE = new Set(['выполнено','выполнен','сделано','завершено','освидетельствовано','принято','выполнена','выполнена с просрочкой']);
  const LABELS = {
    green: 'Норма',
    yellow: 'Внимание',
    orange: 'Риск',
    red: 'Высокий риск',
    gray: 'Нет расчёта'
  };

  const state = {
    observer: null,
    timer: null,
    filter: 'all',
    wrappedSave: false,
    lastSnapshots: new Map()
  };

  const $id = id => document.getElementById(id);

  function currentProject() {
    try {
      return typeof project !== 'undefined' ? project : null;
    } catch (error) {
      return null;
    }
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function norm(value) {
    return text(value).toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[«»"']/g,'').replace(/\s+/g,' ').trim();
  }

  function num(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function escapeHtml(value) {
    if (typeof esc === 'function') return esc(value);
    return text(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[char]);
  }

  function iso(value = new Date()) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = text(value);
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(+match[1], +match[2]-1, +match[3], 12);
    match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (!match) return null;
    let year = +match[3];
    if (year < 100) year += 2000;
    return new Date(year, +match[2]-1, +match[1], 12);
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return String(date.getDate()).padStart(2,'0') + '.' + String(date.getMonth()+1).padStart(2,'0') + '.' + String(date.getFullYear()).slice(-2);
  }

  function isWorkday(date, calendar) {
    const day = date.getDay();
    if (calendar === '5x2') return day !== 0 && day !== 6;
    if (calendar === '6x1') return day !== 0;
    return true;
  }

  function workdays(fromValue, toValue, calendar = '7x0') {
    const from = parseDate(fromValue);
    const to = parseDate(toValue);
    if (!from || !to || to < from) return 0;
    let count = 0;
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate()+1);
    while (cursor <= to) {
      if (isWorkday(cursor, calendar)) count += 1;
      cursor.setDate(cursor.getDate()+1);
    }
    return count;
  }

  function addWorkdays(fromValue, count, calendar = '7x0') {
    const date = parseDate(fromValue);
    if (!date) return '';
    const cursor = new Date(date);
    let remaining = Math.max(0, Math.ceil(count));
    while (remaining > 0) {
      cursor.setDate(cursor.getDate()+1);
      if (isWorkday(cursor, calendar)) remaining -= 1;
    }
    return iso(cursor);
  }

  function inferTarget(title) {
    const raw = text(title).replace(/\u00a0/g,' ');
    const patterns = [
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:буронабивн\w*|буросекущ\w*|грунтов\w*)\s+(?:сва|анкер)/i,
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:сва|анкер)/i,
      /(\d+(?:[.,]\d+)?)\s*(м3|м³|м2|м²|м\.?\s*п\.?|шт\.?)/i
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      let unit = match[2] || 'шт.';
      if (/м3|м³/i.test(unit)) unit = 'м³';
      else if (/м2|м²/i.test(unit)) unit = 'м²';
      else if (/м.*п/i.test(unit)) unit = 'м.п.';
      return { quantity: num(match[1]), unit };
    }
    return { quantity: null, unit: '' };
  }

  function elementHint(item) {
    const title = norm(item.title);
    if (title.includes('анкер')) return 'анкер';
    if (title.includes('сва')) return 'сва';
    return '';
  }

  function linkedFronts(item, current) {
    const ids = new Set();
    if (item.frontId) ids.add(String(item.frontId));
    (item.riskDetails?.frontIds || []).forEach(id => ids.add(String(id)));
    return (current.fronts || []).filter(row => row.active !== false && ids.has(String(row.id)));
  }

  function linkedElements(item, current) {
    const groupId = item.elementGroupId || item.riskDetails?.elementGroupId || '';
    const hint = elementHint(item);
    return (current.numberedElements || []).filter(row => {
      if (row.active === false) return false;
      if (groupId) return String(row.groupId || '') === String(groupId);
      if (item.buildingId && String(row.buildingId || '') !== String(item.buildingId)) return false;
      if (item.workId && row.workId && String(row.workId) !== String(item.workId)) return false;
      if (hint && !norm(row.elementType).includes(hint)) return false;
      return Boolean(hint || item.buildingId || item.workId);
    });
  }

  function isCompleted(value) {
    return COMPLETE.has(norm(value));
  }

  function elementSeries(elements) {
    const daily = new Map();
    let actual = 0;
    elements.forEach(element => {
      if (!isCompleted(element.status)) return;
      actual += 1;
      const date = element.completedDate || element.factDate || text(element.updatedAt).slice(0,10);
      if (parseDate(date)) daily.set(date, (daily.get(date) || 0) + 1);
    });
    return { actual, daily, mode: 'elements' };
  }

  function factSeries(item, current, fronts) {
    const frontIds = new Set(fronts.map(row => String(row.id)));
    const metricIds = new Set([item.metricId, ...(item.riskDetails?.metricIds || [])].filter(Boolean).map(String));
    const cumulative = new Map();
    const quantities = new Map();
    const seen = new Set();

    function add(row, legacy) {
      const linked = row.frontId && frontIds.has(String(row.frontId)) || row.metricId && metricIds.has(String(row.metricId));
      if (!linked) return;
      const identity = row.id || row.sourceFingerprint || row.importFingerprint || JSON.stringify(row);
      if (seen.has(identity)) return;
      seen.add(identity);
      const date = row.factDate || row.date || '';
      if (!parseDate(date)) return;
      const cum = num(row.cumulativeQty ?? row.cumulative);
      const qty = num(row.quantity ?? row.qty);
      if (cum != null) cumulative.set(date, Math.max(cumulative.get(date) || 0, cum));
      else if (qty != null) quantities.set(date, (quantities.get(date) || 0) + qty);
    }

    (current.progressFacts || []).forEach(row => add(row, false));
    (current.factLog || []).forEach(row => add(row, true));

    if (cumulative.size) {
      const daily = new Map();
      let previous = 0;
      [...cumulative.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([date,value]) => {
        daily.set(date, Math.max(0, value - previous));
        previous = Math.max(previous, value);
      });
      return { actual: previous, daily, mode: 'cumulative' };
    }

    if (quantities.size) {
      return {
        actual: [...quantities.values()].reduce((sum,value) => sum + value, 0),
        daily: quantities,
        mode: 'quantity'
      };
    }

    return {
      actual: fronts.reduce((sum,front) => sum + (num(front.doneQty) || 0), 0),
      daily: new Map(),
      mode: 'front'
    };
  }

  function averageRate(daily, asOf, days, calendar) {
    const end = parseDate(asOf);
    if (!end) return 0;
    const cursor = new Date(end);
    let total = 0;
    let divisor = 0;
    while (divisor < days) {
      if (isWorkday(cursor, calendar)) {
        total += Number(daily.get(iso(cursor)) || 0);
        divisor += 1;
      }
      cursor.setDate(cursor.getDate()-1);
    }
    return divisor ? total / divisor : 0;
  }

  function targetFor(item, fronts, elements, current) {
    const inferred = inferTarget(item.title);
    let quantity = num(item.targetQty);
    let unit = text(item.targetUnit) || inferred.unit;
    if (quantity == null) quantity = inferred.quantity;

    if (quantity == null && item.elementGroupId) {
      const group = (current.numberedElementGroups || []).find(row => String(row.id) === String(item.elementGroupId));
      quantity = num(group?.totalQty);
      unit = unit || group?.unit || 'шт.';
    }
    if (quantity == null && elements.length) {
      quantity = elements.length;
      unit = unit || 'шт.';
    }
    if (quantity == null && fronts.length === 1) {
      quantity = num(fronts[0].totalQty);
      unit = unit || fronts[0].unit || '';
    }
    return { quantity, unit };
  }

  function compute(item, options = {}) {
    const current = currentProject();
    if (!current || !item) return null;
    const asOf = options.asOf || iso();
    const fronts = linkedFronts(item, current);
    const elements = linkedElements(item, current);
    const target = targetFor(item, fronts, elements, current);
    const useElements = elements.length && (elementHint(item) || item.elementGroupId || /шт/i.test(target.unit));
    const series = useElements ? elementSeries(elements) : factSeries(item, current, fronts);
    const actual = Math.max(0, num(item.actualQty) ?? series.actual ?? 0);
    const targetDate = item.contractDate || item.workDate || item.baselineDate || '';
    const calendar = item.riskCalendarId || item.riskDetails?.calendarId || fronts[0]?.calendarId || '7x0';
    const daysLeft = targetDate ? workdays(asOf, targetDate, calendar) : null;
    const remaining = target.quantity == null ? null : Math.max(0, target.quantity - actual);
    const windowDays = Math.max(1, Math.min(90, Math.round(num(item.riskWindowDays) || 7)));
    const recentRate = averageRate(series.daily, asOf, windowDays, calendar);
    const longRate = averageRate(series.daily, asOf, 28, calendar);
    const requiredRate = remaining == null || !daysLeft ? 0 : remaining / Math.max(1, daysLeft);
    const projectedQty = target.quantity == null || daysLeft == null ? null : actual + recentRate * Math.max(0, daysLeft);
    const gapQty = target.quantity == null || projectedQty == null ? null : Math.max(0, target.quantity - projectedQty);
    const completed = Boolean(item.factDate) || isCompleted(item.status) || remaining === 0;
    const projectedFinishDate = remaining == null || remaining <= 0
      ? asOf
      : recentRate > 0
        ? addWorkdays(asOf, Math.ceil(remaining / recentRate), calendar)
        : '';

    let level = 'gray';
    if (completed) level = 'green';
    else if (!targetDate || target.quantity == null) level = 'gray';
    else if (!daysLeft) level = 'red';
    else if (recentRate <= 0) level = daysLeft <= 14 ? 'red' : 'orange';
    else {
      const ratio = requiredRate > 0 ? recentRate / requiredRate : 99;
      level = ratio >= 1.15 ? 'green' : ratio >= 1 ? 'yellow' : ratio >= 0.8 ? 'orange' : 'red';
    }

    let reason = 'Нет данных для расчёта.';
    if (completed) reason = 'Цель выполнена.';
    else if (!targetDate) reason = 'Не задана целевая дата.';
    else if (target.quantity == null) reason = 'Не задан или не распознан целевой объём.';
    else if (!daysLeft) reason = 'Срок наступил, целевой объём не достигнут.';
    else if (!series.daily.size && actual > 0) reason = 'Есть накопительный факт, но нет датированного факта для расчёта темпа.';
    else if (recentRate <= 0) reason = 'За расчётный период отсутствует положительный факт.';
    else if (gapQty > 0) reason = 'При текущем темпе ожидается недобор ' + round(gapQty,1) + ' ' + target.unit + '.';
    else if (recentRate < requiredRate * 1.15) reason = 'Срок достижим, но запас производительности минимален.';
    else reason = 'Текущий темп обеспечивает выполнение в срок.';

    return {
      milestoneId: item.id,
      reportDate: asOf,
      targetDate,
      targetQty: target.quantity,
      targetUnit: target.unit,
      actualQty: actual,
      remainingQty: remaining,
      daysLeft,
      recentRate,
      longRate,
      requiredRate,
      projectedQty,
      projectedFinishDate,
      gapQty,
      riskLevel: level,
      label: LABELS[level],
      reason,
      calendarId: calendar,
      windowDays,
      sourceMode: series.mode,
      linkedFrontCount: fronts.length,
      linkedElementCount: elements.length
    };
  }

  function injectStyles() {
    if ($id('livMilestoneRiskStyles')) return;
    const style = document.createElement('style');
    style.id = 'livMilestoneRiskStyles';
    style.textContent = `
      .milestone-risk-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding:10px 12px;border:1px solid #e1e6ed;border-radius:9px;background:#fff}
      .milestone-risk-toolbar select{min-height:34px;border:1px solid #dfe4eb;border-radius:7px;padding:5px 8px;background:#fff}
      .milestone-risk-summary{display:grid;grid-template-columns:repeat(5,minmax(105px,1fr));gap:8px;margin-bottom:12px}
      .milestone-risk-stat{padding:10px 12px;border:1px solid #e1e6ed;border-radius:9px;background:#fff}
      .milestone-risk-stat span{display:block;color:#667085;font-size:10px;margin-bottom:4px}.milestone-risk-stat strong{font-size:17px}
      .milestone-risk-box{display:block;width:100%;margin-top:6px;padding:7px 8px;border-radius:8px;border:1px solid currentColor;text-align:left;cursor:pointer;line-height:1.3}
      .milestone-risk-box strong{display:block;font-size:10px;text-transform:uppercase}.milestone-risk-box span{display:block;margin-top:3px;color:#475467;font-size:10px}
      .risk-green{color:#16825d;background:#f0faf5}.risk-yellow{color:#967000;background:#fffbea}.risk-orange{color:#b85b00;background:#fff5e9}.risk-red{color:#b42318;background:#fff2f0}.risk-gray{color:#667085;background:#f7f8fa}
      .milestone-risk-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;margin:12px 0}.milestone-risk-detail{padding:10px;border:1px solid #e1e6ed;border-radius:8px;background:#f8fafc}.milestone-risk-detail span{display:block;color:#667085;font-size:10px;margin-bottom:4px}.milestone-risk-detail strong{font-size:15px}
      .milestone-risk-note,.milestone-risk-editor-card{padding:11px 12px;border:1px solid #dbe4ef;border-radius:9px;background:#f8fbff;line-height:1.45}.milestone-risk-editor-card{grid-column:1/-1}
      @media(max-width:900px){.milestone-risk-summary{grid-template-columns:repeat(2,minmax(105px,1fr))}.milestone-risk-detail-grid{grid-template-columns:repeat(2,minmax(105px,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function ensureSummary() {
    const body = $id('milestoneRows');
    if (!body || $id('milestoneRiskUi')) return;
    const tableCard = body.closest('.card') || body.closest('.table-wrap');
    if (!tableCard?.parentNode) return;
    const section = document.createElement('section');
    section.id = 'milestoneRiskUi';
    section.className = 'no-print';
    section.innerHTML = `
      <div class="milestone-risk-toolbar">
        <div><b>Прогноз ключевых дат</b><div class="muted">Цель, факт, темп и прогнозный недобор.</div></div>
        <label><span class="muted">Риск</span><select id="milestoneRiskFilter">
          <option value="all">Все</option><option value="red">Высокий риск</option><option value="orange">Риск</option><option value="yellow">Внимание</option><option value="green">Норма</option><option value="gray">Нет расчёта</option>
        </select></label>
      </div>
      <div class="milestone-risk-summary">
        <div class="milestone-risk-stat"><span>Высокий риск</span><strong id="riskCountRed">0</strong></div>
        <div class="milestone-risk-stat"><span>Риск</span><strong id="riskCountOrange">0</strong></div>
        <div class="milestone-risk-stat"><span>Внимание</span><strong id="riskCountYellow">0</strong></div>
        <div class="milestone-risk-stat"><span>Норма</span><strong id="riskCountGreen">0</strong></div>
        <div class="milestone-risk-stat"><span>Нет расчёта</span><strong id="riskCountGray">0</strong></div>
      </div>
    `;
    tableCard.parentNode.insertBefore(section, tableCard);
    $id('milestoneRiskFilter')?.addEventListener('change', event => {
      state.filter = event.target.value || 'all';
      scheduleRender();
    });
  }

  function shortText(risk) {
    if (risk.riskLevel === 'gray') return risk.reason;
    if (risk.gapQty > 0) return 'Недобор ' + round(risk.gapQty,1) + ' ' + risk.targetUnit;
    if (risk.requiredRate > 0) return 'Темп ' + round(risk.recentRate,1) + ' / требуется ' + round(risk.requiredRate,1);
    return risk.reason;
  }

  function openDetails(item, risk) {
    if (typeof openModal !== 'function') return;
    openModal('Прогноз ключевой даты', `
      <div class="milestone-risk-box risk-${escapeHtml(risk.riskLevel)}" style="cursor:default"><strong>${escapeHtml(risk.label)}</strong><span>${escapeHtml(risk.reason)}</span></div>
      <h3>${escapeHtml(item.milestoneNo ? item.milestoneNo + ' · ' + item.title : item.title)}</h3>
      <div class="milestone-risk-detail-grid">
        <div class="milestone-risk-detail"><span>Цель</span><strong>${risk.targetQty == null ? '—' : round(risk.targetQty,1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
        <div class="milestone-risk-detail"><span>Факт</span><strong>${round(risk.actualQty,1)} ${escapeHtml(risk.targetUnit)}</strong></div>
        <div class="milestone-risk-detail"><span>Осталось</span><strong>${risk.remainingQty == null ? '—' : round(risk.remainingQty,1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
        <div class="milestone-risk-detail"><span>До срока</span><strong>${risk.daysLeft == null ? '—' : risk.daysLeft + ' дн.'}</strong></div>
        <div class="milestone-risk-detail"><span>Темп ${risk.windowDays} дней</span><strong>${round(risk.recentRate,2)} ${escapeHtml(risk.targetUnit)}/дн.</strong></div>
        <div class="milestone-risk-detail"><span>Требуемый темп</span><strong>${round(risk.requiredRate,2)} ${escapeHtml(risk.targetUnit)}/дн.</strong></div>
        <div class="milestone-risk-detail"><span>Прогноз к сроку</span><strong>${risk.projectedQty == null ? '—' : round(risk.projectedQty,1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
        <div class="milestone-risk-detail"><span>Недобор</span><strong>${risk.gapQty == null ? '—' : round(risk.gapQty,1) + ' ' + escapeHtml(risk.targetUnit)}</strong></div>
        <div class="milestone-risk-detail"><span>Прогноз завершения</span><strong>${formatDate(risk.projectedFinishDate)}</strong></div>
      </div>
      <div class="milestone-risk-note"><b>Основание</b><br>Целевая дата: ${formatDate(risk.targetDate)} · календарь ${escapeHtml(risk.calendarId)}.<br>Связано фронтов: ${risk.linkedFrontCount}; номерных элементов: ${risk.linkedElementCount}. Источник факта: ${escapeHtml(risk.sourceMode)}.</div>
    `);
  }

  function renderRows() {
    const current = currentProject();
    const body = $id('milestoneRows');
    if (!current || !body) return;
    ensureSummary();

    const counts = { red:0, orange:0, yellow:0, green:0, gray:0 };
    body.querySelectorAll('tr').forEach(row => {
      const button = row.querySelector('[data-ms]');
      if (!button) return;
      const item = (current.milestones || []).find(value => String(value.id) === String(button.dataset.ms));
      if (!item) return;
      const risk = compute(item);
      if (!risk) return;
      counts[risk.riskLevel] += 1;
      row.dataset.riskLevel = risk.riskLevel;
      row.classList.toggle('hidden', state.filter !== 'all' && state.filter !== risk.riskLevel);

      const cell = row.lastElementChild;
      if (!cell) return;
      const signature = JSON.stringify([risk.riskLevel,risk.reason,round(risk.gapQty,2),round(risk.recentRate,2),round(risk.requiredRate,2)]);
      let box = cell.querySelector('.milestone-risk-box');
      if (!box) {
        box = document.createElement('button');
        box.type = 'button';
        box.className = 'milestone-risk-box';
        cell.appendChild(box);
      }
      if (box.dataset.signature !== signature) {
        box.dataset.signature = signature;
        box.className = 'milestone-risk-box risk-' + risk.riskLevel;
        box.innerHTML = '<strong>' + escapeHtml(risk.label) + '</strong><span>' + escapeHtml(shortText(risk)) + '</span>';
      }
      box.onclick = event => {
        event.stopPropagation();
        openDetails(item, risk);
      };

      item.riskLevel = risk.riskLevel;
      item.riskUpdatedAt = new Date().toISOString();
      item.riskDetails = { ...(item.riskDetails || {}), calculated: risk };
    });

    Object.entries(counts).forEach(([level,value]) => {
      const target = $id('riskCount' + level.charAt(0).toUpperCase() + level.slice(1));
      if (target && target.textContent !== String(value)) target.textContent = String(value);
    });
    persistSnapshots(current);
  }

  function renderSafe() {
    if (state.observer) state.observer.disconnect();
    try {
      injectEditor();
      renderRows();
    } finally {
      state.observer?.observe(document.body, { childList:true, subtree:true });
    }
  }

  function scheduleRender() {
    clearTimeout(state.timer);
    state.timer = setTimeout(renderSafe, 30);
  }

  function editorItem() {
    const current = currentProject();
    const title = text($id('mTitle')?.value);
    const no = text($id('mNo')?.value);
    return [...(current?.milestones || [])].reverse().find(item =>
      (!title || item.title === title) && (!no || item.milestoneNo === no)
    ) || null;
  }

  function injectEditor() {
    const title = $id('mTitle');
    if (!title || $id('mTargetQty') || !/ключевая дата/i.test(text($id('modalTitle')?.textContent))) return;
    const grid = $id('modalBody')?.querySelector('.form-grid');
    if (!grid) return;
    const item = editorItem() || {};
    const inferred = inferTarget(title.value);
    const holder = document.createElement('div');
    holder.style.display = 'contents';
    holder.innerHTML = `
      <div class="field"><label>Целевой объём</label><input id="mTargetQty" type="number" min="0" step="any" value="${escapeHtml(item.targetQty ?? inferred.quantity ?? '')}" placeholder="Например: 190"></div>
      <div class="field"><label>Единица цели</label><input id="mTargetUnit" value="${escapeHtml(item.targetUnit || inferred.unit || '')}" placeholder="шт., м³, м², м.п."></div>
      <div class="field"><label>Окно темпа, дней</label><input id="mRiskWindow" type="number" min="1" max="90" value="${escapeHtml(item.riskWindowDays || 7)}"></div>
      <div class="field"><label>Календарь</label><select id="mRiskCalendar"><option value="7x0" ${(item.riskCalendarId || '7x0') === '7x0' ? 'selected' : ''}>7/0</option><option value="6x1" ${item.riskCalendarId === '6x1' ? 'selected' : ''}>6/1</option><option value="5x2" ${item.riskCalendarId === '5x2' ? 'selected' : ''}>5/2</option></select></div>
      <div class="milestone-risk-editor-card"><b>Прогноз риска</b><span id="mRiskPreview" class="muted">После связи с фронтом или группой элементов LIV рассчитает риск автоматически.</span></div>
    `;
    grid.appendChild(holder);

    function preview() {
      const temporary = {
        ...item,
        title: title.value,
        contractDate: $id('mContract')?.value,
        workDate: $id('mWork')?.value,
        frontId: $id('mFrontId')?.value,
        buildingId: $id('mBuilding')?.value,
        workId: $id('mWorkId')?.value,
        targetQty: num($id('mTargetQty')?.value),
        targetUnit: text($id('mTargetUnit')?.value),
        riskWindowDays: num($id('mRiskWindow')?.value) || 7,
        riskCalendarId: $id('mRiskCalendar')?.value || '7x0'
      };
      const risk = compute(temporary);
      if ($id('mRiskPreview') && risk) $id('mRiskPreview').textContent = risk.label + ': ' + risk.reason;
    }

    ['mTitle','mContract','mWork','mFrontId','mBuilding','mWorkId','mTargetQty','mTargetUnit','mRiskWindow','mRiskCalendar']
      .forEach(id => $id(id)?.addEventListener('change', preview));
    title.addEventListener('input', () => {
      const inferredNow = inferTarget(title.value);
      if ($id('mTargetQty') && !$id('mTargetQty').value && inferredNow.quantity != null) $id('mTargetQty').value = inferredNow.quantity;
      if ($id('mTargetUnit') && !$id('mTargetUnit').value && inferredNow.unit) $id('mTargetUnit').value = inferredNow.unit;
      preview();
    });
    preview();
  }

  function wrapSave() {
    if (state.wrappedSave || typeof window.saveMilestone !== 'function') return false;
    const original = window.saveMilestone;
    window.saveMilestone = async function (id, correspondence) {
      const current = currentProject();
      const before = new Set((current?.milestones || []).map(item => String(item.id)));
      const title = text($id('mTitle')?.value);
      const extras = {
        targetQty: num($id('mTargetQty')?.value),
        targetUnit: text($id('mTargetUnit')?.value),
        riskWindowDays: Math.max(1, Math.min(90, Math.round(num($id('mRiskWindow')?.value) || 7))),
        riskCalendarId: $id('mRiskCalendar')?.value || '7x0'
      };
      await original(id, correspondence);
      const updated = currentProject();
      let item = id
        ? (updated?.milestones || []).find(value => String(value.id) === String(id))
        : (updated?.milestones || []).find(value => !before.has(String(value.id)) && value.title === title);
      if (!item) item = [...(updated?.milestones || [])].reverse().find(value => value.title === title) || null;
      if (item) {
        Object.assign(item, extras, { riskUpdatedAt:'', updatedAt:new Date().toISOString() });
        if (typeof saveProject === 'function') await saveProject();
        if (typeof renderAll === 'function') renderAll();
      }
    };
    state.wrappedSave = true;
    return true;
  }

  async function persistSnapshots(current) {
    const client = window.LIV_SUPABASE;
    const normalizer = window.LIV_NORMALIZED_SYNC;
    if (!client || !normalizer?.projectId?.() || !window.LIV_REMOTE_SYNC?.canWrite?.()) return;
    const projectId = normalizer.projectId();
    const reportDate = iso();
    const rows = [];

    (current.milestones || []).forEach(item => {
      const serverId = normalizer.serverId?.('milestone', item.id);
      if (!serverId) return;
      const risk = compute(item, { asOf:reportDate });
      if (!risk) return;
      const payload = {
        project_id:projectId,
        milestone_id:serverId,
        report_date:reportDate,
        target_qty:risk.targetQty,
        actual_qty:risk.actualQty,
        remaining_qty:risk.remainingQty,
        days_left:risk.daysLeft,
        recent_rate:risk.recentRate,
        long_rate:risk.longRate,
        required_rate:risk.requiredRate,
        projected_qty:risk.projectedQty,
        projected_finish_date:risk.projectedFinishDate || null,
        gap_qty:risk.gapQty,
        risk_level:({green:'normal',yellow:'attention',orange:'risk',red:'failure',gray:'unknown'}[risk.riskLevel]||'unknown'),
        reason:risk.reason,
        details:risk
      };
      const identity = serverId + ':' + reportDate;
      const signature = JSON.stringify(payload);
      if (state.lastSnapshots.get(identity) === signature) return;
      state.lastSnapshots.set(identity, signature);
      rows.push(payload);
    });

    if (!rows.length) return;
    const result = await client.from('milestone_risk_snapshots').upsert(rows, {
      onConflict:'milestone_id,report_date',
      ignoreDuplicates:false
    });
    if (result.error) console.warn('LIV milestone risk: snapshot sync failed', result.error);
  }

  function bootstrap() {
    injectStyles();
    state.observer = new MutationObserver(scheduleRender);
    state.observer.observe(document.body, { childList:true, subtree:true });
    scheduleRender();

    const timer = setInterval(() => {
      if (wrapSave()) clearInterval(timer);
    }, 150);
    setTimeout(() => clearInterval(timer), 20000);
  }

  window.LIV_MILESTONE_RISK = {
    version:VERSION,
    compute,
    inferTarget,
    render:scheduleRender
  };

  window.addEventListener('liv-remote-project', scheduleRender);
  window.addEventListener('liv-normalized-sync-status', event => {
    if (event.detail?.status === 'ready') scheduleRender();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
  else bootstrap();
})();
