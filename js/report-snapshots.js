'use strict';

(function () {
  const VERSION = '2026.10.14.3';

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

  function num(value) {
    const result = Number(String(value == null ? 0 : value).replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(result) ? result : 0;
  }

  function dateIso(value) {
    const raw = text(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function addDays(iso, days) {
    const date = new Date((iso || new Date().toISOString().slice(0,10)) + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0,10);
  }

  function todayIso() {
    try {
      if (typeof today === 'function') return today();
    } catch (_) {}
    return new Date().toISOString().slice(0,10);
  }

  function idValue(prefix) {
    if (typeof uid === 'function') return uid(prefix);
    return prefix + '-' + crypto.randomUUID();
  }

  function byId(list,id) {
    return (list || []).find(item => String(item.id) === String(id || '')) || null;
  }

  function factDate(row) {
    return row.factDate || row.date || '';
  }

  function factValueAt(
    frontId,
    reportDate,
    metricId = '',
    includeUnassigned = true
  ) {
    const current = currentProject();

    const facts = (current?.progressFacts || [])
      .filter(row => {
        if (
          String(row.frontId || '') !== String(frontId || '') ||
          !factDate(row) ||
          factDate(row) > reportDate
        ) {
          return false;
        }

        if (!metricId) return true;

        const rowMetricId = String(row.metricId || '');
        return rowMetricId === String(metricId) ||
          (includeUnassigned && !rowMetricId);
      })
      .sort((a,b) => String(factDate(a)).localeCompare(String(factDate(b))));

    const snapshots = facts.filter(row =>
      row.factType === 'cumulative_snapshot' &&
      row.cumulativeQty !== null &&
      row.cumulativeQty !== undefined
    );

    if (snapshots.length) {
      return Math.max(0,num(snapshots[snapshots.length-1].cumulativeQty));
    }

    if (facts.length) {
      return Math.max(0,facts
        .filter(row => row.factType !== 'cumulative_snapshot')
        .reduce((sum,row) => sum + num(row.quantity ?? row.qty),0));
    }

    if (!metricId || includeUnassigned) {
      const front = byId(current?.fronts,frontId);
      if (reportDate >= todayIso()) return Math.max(0,num(front?.doneQty));
    }

    return 0;
  }

  function activeTab() {
    const active = document.querySelector('nav.tabs .tab.active');
    return active?.dataset?.tab || '';
  }

  function currentFilters() {
    const ids = [
      'mfMatrix','mfBuilding','mfBlock','mfFloor','mfWork','mfOrg','mfStatus',
      'gBuilding','gWork','gMode',
      'pfFrom','pfTo','pfBuilding','pfWork',
      'rFrom','rTo','rBuilding','rWork','rOrg',
      'elBuilding','elType'
    ];
    const result = {
      activeTab: activeTab()
    };

    ids.forEach(id => {
      const node = document.getElementById(id);
      if (node) result[id] = node.value;
    });

    return result;
  }

  function snapshotFronts(reportDate, previousDate) {
    const current = currentProject();
    return (current?.fronts || [])
      .filter(front => front.active !== false)
      .map(front => {
        const structure = byId(current.structures,front.structureId) || {};
        const building = byId(current.buildings,structure.buildingId);
        const work = byId(current.works,front.workId);
        const organization = byId(current.organizations,front.organizationId);
        const primaryMetric = (current.workMetrics || []).find(metric =>
          metric.active !== false &&
          metric.isPrimary === true &&
          String(metric.frontId || '') === String(front.id)
        ) || null;

        const done = factValueAt(
          front.id,
          reportDate,
          primaryMetric?.id || '',
          true
        );

        const previous = previousDate
          ? factValueAt(
              front.id,
              previousDate,
              primaryMetric?.id || '',
              true
            )
          : 0;

        const total = Math.max(0,num(front.totalQty));
        return {
          frontId: front.id,
          building: building?.name || '',
          block: structure.block || '',
          floor: structure.floor ?? '',
          capture: structure.capture || '',
          axis: structure.axis || '',
          zone: structure.zone || '',
          work: work?.name || '',
          organization: organization?.name || '',
          unit: front.unit || work?.unit || '',
          totalQty: total,
          doneQty: done,
          previousQty: previous,
          periodQty: done - previous,
          percent: total > 0 ? Math.max(0,Math.min(100,Math.round(done / total * 10000) / 100)) : null,
          status: front.status || ''
        };
      });
  }

  function snapshotMetrics(reportDate, previousDate) {
    const current = currentProject();

    return (current?.workMetrics || [])
      .filter(metric => metric && metric.active !== false)
      .map(metric => {
        const front = byId(current.fronts,metric.frontId);
        if (!front || front.active === false) return null;

        const done = factValueAt(
          front.id,
          reportDate,
          metric.id,
          metric.isPrimary === true
        );

        const previous = previousDate
          ? factValueAt(
              front.id,
              previousDate,
              metric.id,
              metric.isPrimary === true
            )
          : 0;

        const total = Math.max(0,num(metric.targetQty));

        return {
          metricId: metric.id,
          frontId: front.id,
          code: metric.code || '',
          name: metric.name || '',
          unit: metric.unit || '',
          targetQty: total || null,
          doneQty: done,
          previousQty: previous,
          periodQty: done - previous,
          percent: total > 0
            ? Math.max(0,Math.min(100,Math.round(done / total * 10000) / 100))
            : null,
          calculationMethod: metric.calculationMethod || 'quantity',
          isPrimary: metric.isPrimary === true
        };
      })
      .filter(Boolean);
  }


  function snapshotMilestones() {
    const current = currentProject();
    return (current?.milestones || [])
      .filter(item => item.active !== false)
      .map(item => ({
        milestoneId: item.id,
        number: item.milestoneNo || '',
        title: item.title || '',
        contractDate: item.contractDate || '',
        workDate: item.workDate || '',
        factDate: item.factDate || '',
        status: item.status || '',
        targetQty: item.targetQty ?? null,
        targetUnit: item.targetUnit || '',
        riskLevel: item.riskLevel || '',
        riskDetails: item.riskDetails || {}
      }));
  }

  function snapshotNumbered(reportDate, previousDate) {
    const current = currentProject();
    const groups = current?.numberedElementGroups || [];
    return groups
      .filter(group => group.active !== false)
      .map(group => {
        const elements = (current.numberedElements || [])
          .filter(item =>
            item.active !== false &&
            String(item.groupId || '') === String(group.id)
          );

        const isDoneAt = (item,date) => {
          if (item.completedDate) return item.completedDate <= date;
          return date >= todayIso() && ['Выполнено','Освидетельствовано','Принято'].includes(item.status);
        };

        const done = elements.filter(item => isDoneAt(item,reportDate)).length;
        const previous = previousDate
          ? elements.filter(item => isDoneAt(item,previousDate)).length
          : 0;

        return {
          groupId: group.id,
          name: group.name || group.groupCode || '',
          elementType: group.elementType || '',
          total: num(group.totalQty) || elements.length,
          completed: done,
          previousCompleted: previous,
          periodCompleted: done - previous,
          unit: group.unit || 'шт.'
        };
      });
  }

  function buildSnapshot(reportDate, previousDate) {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      reportDate,
      previousReportDate: previousDate || '',
      filters: currentFilters(),
      fronts: snapshotFronts(reportDate,previousDate),
      metrics: snapshotMetrics(reportDate,previousDate),
      milestones: snapshotMilestones(),
      numberedGroups: snapshotNumbered(reportDate,previousDate)
    };
  }

  async function capture(input = {}) {
    const current = currentProject();
    if (!current) throw new Error('Проект не загружен.');

    const reportDate = dateIso(input.reportDate) || todayIso();
    const previousReportDate = dateIso(input.previousReportDate);
    const reportType = text(input.reportType) || 'weekly';
    const title = text(input.title) || ('Отчёт на ' + reportDate);

    current.reportSnapshots = Array.isArray(current.reportSnapshots)
      ? current.reportSnapshots
      : [];

    const duplicate = current.reportSnapshots.find(item =>
      item &&
      item.reportType === reportType &&
      item.reportDate === reportDate &&
      text(item.title) === title
    );

    if (duplicate) {
      throw new Error(
        'Снимок с таким типом, датой и названием уже существует. Измени название либо отчётную дату.'
      );
    }

    const dataSnapshot = buildSnapshot(reportDate,previousReportDate);

    const snapshot = {
      id: idValue('RPT'),
      reportType,
      reportDate,
      previousReportDate,
      title,
      filters: dataSnapshot.filters,
      dataSnapshot,
      storagePath: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    current.reportSnapshots.push(snapshot);

    if (typeof log === 'function') {
      log('Создано','Снимок отчёта',title,{
        reportDate,
        previousReportDate,
        reportType,
        snapshotId: snapshot.id
      });
    }

    if (typeof saveProject === 'function') await saveProject();

    return snapshot;
  }

  function openCapture() {
    if (typeof openModal !== 'function') return;
    const reportDate = todayIso();
    const previousDate = addDays(reportDate,-7);

    openModal('Зафиксировать отчёт',`
      <div class="form-grid">
        <div class="field">
          <label>Тип</label>
          <select id="rsType">
            <option value="weekly">Еженедельный</option>
            <option value="customer">Заказчику</option>
            <option value="internal">Внутренний</option>
          </select>
        </div>

        <div class="field">
          <label>Отчётная дата</label>
          <input id="rsDate" type="date" value="${reportDate}">
        </div>

        <div class="field">
          <label>Предыдущая отчётная дата</label>
          <input id="rsPrevDate" type="date" value="${previousDate}">
        </div>

        <div class="field">
          <label>Название</label>
          <input id="rsTitle" value="Еженедельный отчёт ${reportDate}">
        </div>
      </div>

      <div class="notice">
        LIV сохранит неизменяемый срез объёмов, КД, номерных элементов и текущих фильтров.
        Позже этот снимок можно будет связать с выпущенным PDF.
      </div>

      <div class="liv-editor-footer">
        <button id="rsCancel" class="btn">Отмена</button>
        <button id="rsSave" class="btn primary">Зафиксировать</button>
      </div>
    `);

    document.getElementById('rsCancel')?.addEventListener('click',() => closeModal());
    document.getElementById('rsSave')?.addEventListener('click',async () => {
      const button = document.getElementById('rsSave');
      try {
        button.disabled = true;
        await capture({
          reportType: document.getElementById('rsType')?.value,
          reportDate: document.getElementById('rsDate')?.value,
          previousReportDate: document.getElementById('rsPrevDate')?.value,
          title: document.getElementById('rsTitle')?.value
        });
        closeModal();
        alert('Снимок отчёта сохранён.');
      } catch (error) {
        alert('Не удалось сохранить снимок отчёта: ' + (error?.message || error));
        button.disabled = false;
      }
    });
  }

  function injectButton() {
    const pdfButton = document.getElementById('pdfBtn');
    if (!pdfButton || document.getElementById('reportSnapshotBtn')) return false;

    const button = document.createElement('button');
    button.id = 'reportSnapshotBtn';
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Зафиксировать отчёт';
    button.addEventListener('click',openCapture);
    pdfButton.parentNode.insertBefore(button,pdfButton);
    return true;
  }

  function bootstrap() {
    const timer = setInterval(() => {
      if (injectButton()) clearInterval(timer);
    },150);
    setTimeout(() => clearInterval(timer),20000);
  }

  window.LIV_REPORT_SNAPSHOTS = {
    version: VERSION,
    capture,
    buildSnapshot
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  } else {
    bootstrap();
  }
})();
