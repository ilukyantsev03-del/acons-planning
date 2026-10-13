'use strict';

(function () {
  const COMPLETE_STATUSES = new Set([
    'выполнено',
    'освидетельствовано',
    'принято',
    'завершено',
    'сделано'
  ]);

  const state = {
    wrapped: false,
    observer: null
  };

  function el(id) {
    return document.getElementById(id);
  }

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

  function key(value) {
    return text(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uidValue(prefix) {
    if (typeof uid === 'function') return uid(prefix);
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function localDate() {
    const date = new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function ensureCollections() {
    const current = currentProject();
    if (!current) return false;
    if (!Array.isArray(current.numberedElementGroups)) current.numberedElementGroups = [];
    if (!Array.isArray(current.numberedElements)) current.numberedElements = [];
    return true;
  }

  function groupCodeFor(element) {
    const modalValue = el('neGroup')?.value || el('neGroupCode')?.value;
    return text(element?.groupCode || element?.mark || modalValue || element?.capture || element?.zone || 'Основная группа');
  }

  function contextualElementKey(element) {
    const scope = element?.uniqueScope || 'context';
    const type = key(element?.elementType);
    const number = key(element?.elementNo);
    const building = String(element?.buildingId || '');
    const group = key(groupCodeFor(element));

    if (scope === 'project') {
      return [type, group, number].join('|');
    }

    if (scope === 'building') {
      return [type, building, group, number].join('|');
    }

    return [
      type,
      building,
      group,
      key(element?.capture),
      key(element?.zone),
      number
    ].join('|');
  }

  function ensureGroup(element, totalQty) {
    const current = currentProject();
    if (!current || !element) return null;
    ensureCollections();

    const groupCode = groupCodeFor(element);
    let group = current.numberedElementGroups.find(item =>
      item.active !== false &&
      String(item.buildingId || '') === String(element.buildingId || '') &&
      key(item.elementType) === key(element.elementType) &&
      key(item.groupCode) === key(groupCode)
    );

    if (!group) {
      group = {
        id: uidValue('NEG'),
        buildingId: element.buildingId || '',
        frontId: element.frontId || '',
        elementType: element.elementType,
        groupCode,
        name: [element.elementType, groupCode].filter(Boolean).join(' · '),
        totalQty: totalQty || null,
        unit: 'шт.',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      current.numberedElementGroups.push(group);
    } else {
      group.frontId = element.frontId || group.frontId || '';
      if (totalQty) group.totalQty = totalQty;
      group.updatedAt = new Date().toISOString();
    }

    return group;
  }

  function injectEditorFields() {
    const typeInput = el('neType');
    if (!typeInput || el('neLayerName')) return;
    const grid = el('modalBody')?.querySelector('.form-grid');
    if (!grid) return;

    const modalTitle = text(el('modalTitle')?.textContent);
    if (!/номерн/i.test(modalTitle)) return;

    const no = text(el('neNo')?.value);
    const current = currentProject();
    const item = (current?.numberedElements || []).find(element =>
      element.elementNo === no && element.elementType === typeInput.value
    ) || {};

    const fields = document.createElement('div');
    fields.style.display = 'contents';
    const hasGroupField = Boolean(el('neGroup') || el('neGroupCode'));
    fields.innerHTML = `
      ${hasGroupField ? '' : `
        <div class="field">
          <label>Группа / марка</label>
          <input id="neGroupCode" value="${text(item.groupCode || item.mark || '')}" placeholder="Например: БНС-2, БСС-1, Г1, Г2">
        </div>
      `}
      <div class="field">
        <label>Слой / ярус</label>
        <input id="neLayerName" value="${text(item.layerName || '')}" placeholder="Например: Ярус 1">
      </div>
      <div class="field">
        <label>Всего элементов в группе</label>
        <input id="neGroupTotal" type="number" min="0" step="1" value="" placeholder="Можно заполнить один раз">
      </div>
    `;
    grid.appendChild(fields);

    const scope = el('neScope');
    if (scope?.querySelector('option[value="context"]')) {
      scope.querySelector('option[value="context"]').textContent = 'Здание + группа + захватка + зона';
    }
  }

  function decorateRows() {
    const current = currentProject();
    if (!current) return;
    document.querySelectorAll('[data-el]').forEach(button => {
      const element = current.numberedElements.find(item => String(item.id) === String(button.dataset.el));
      const row = button.closest('tr');
      if (!element || !row) return;
      const cell = row.children[1];
      if (!cell) return;
      const value = groupCodeFor(element);
      let note = cell.querySelector('.numbered-element-group-note');
      if (!note) {
        note = document.createElement('div');
        note.className = 'muted numbered-element-group-note';
        note.style.fontSize = '10px';
        note.style.marginTop = '3px';
        cell.appendChild(note);
      }
      const nextText = value ? 'Группа: ' + value : '';
      if (note.textContent !== nextText) note.textContent = nextText;
    });
  }

  function wrapFunctions() {
    if (state.wrapped || typeof window.saveElement !== 'function') return false;

    window.elementContextKey = contextualElementKey;
    const originalSave = window.saveElement;

    window.saveElement = async function (id) {
      const beforeIds = new Set((currentProject()?.numberedElements || []).map(item => String(item.id)));
      const extras = {
        groupCode: text(el('neGroup')?.value || el('neGroupCode')?.value),
        mark: text(el('neGroup')?.value || el('neGroupCode')?.value),
        layerName: text(el('neLayerName')?.value),
        groupTotal: Number(el('neGroupTotal')?.value || 0)
      };

      await originalSave(id);

      const current = currentProject();
      const element = id
        ? current?.numberedElements.find(item => String(item.id) === String(id))
        : current?.numberedElements.find(item => !beforeIds.has(String(item.id)));
      if (!element) return;

      element.groupCode = extras.groupCode || element.groupCode || element.capture || element.zone || 'Основная группа';
      element.mark = element.groupCode;
      element.layerName = extras.layerName;
      const group = ensureGroup(element, extras.groupTotal);
      element.groupId = group?.id || element.groupId || '';

      if (COMPLETE_STATUSES.has(key(element.status))) {
        element.completedDate = element.completedDate || localDate();
      } else if (element.status === 'Не начато') {
        element.completedDate = '';
      }
      element.updatedAt = new Date().toISOString();

      if (typeof saveProject === 'function') await saveProject();
      if (typeof renderAll === 'function') renderAll();
    };

    state.wrapped = true;
    return true;
  }

  function bootstrap() {
    ensureCollections();
    const timer = setInterval(() => {
      if (wrapFunctions()) clearInterval(timer);
    }, 150);
    setTimeout(() => clearInterval(timer), 20000);

    state.observer = new MutationObserver(() => {
      injectEditorFields();
      decorateRows();
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
    decorateRows();
  }

  window.LIV_NUMBERED_ELEMENTS_V2 = {
    version: '2026.10.13.4',
    contextKey: contextualElementKey,
    ensureGroup
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
