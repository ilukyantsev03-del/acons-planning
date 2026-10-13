'use strict';

(function () {
  const VERSION = '2026.10.13.1';
  const state = {
    observer: null,
    timer: null,
    wrappedSave: false,
    autoLinked: new Set()
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
    return text(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function elementTypeHint(title) {
    const value = norm(title);
    if (value.includes('анкер')) return 'анкер';
    if (value.includes('сва')) return 'сва';
    return '';
  }

  function groupHint(title) {
    const match = text(title).match(
      /\b(БНС\s*[-–—]?\s*\d+|БСС\s*[-–—]?\s*\d+|Г\s*\d+|ярус\s*\d+|группа\s*[A-Za-zА-Яа-яЁё0-9.-]+)\b/i
    );
    return match ? norm(match[1]) : '';
  }

  function groupLabel(group, current) {
    const building = (current.buildings || []).find(item =>
      String(item.id) === String(group.buildingId || '')
    );
    return [
      building?.name,
      group.elementType,
      group.groupCode,
      group.name
    ].filter(Boolean).join(' · ');
  }

  function candidateGroups(milestone, current) {
    const typeHint = elementTypeHint(milestone.title);
    if (!typeHint) return [];
    const groups = (current.numberedElementGroups || []).filter(group => {
      if (group.active === false) return false;
      if (milestone.buildingId && String(group.buildingId || '') !== String(milestone.buildingId)) return false;
      return norm(group.elementType).includes(typeHint);
    });

    const titleGroupHint = groupHint(milestone.title) ||
      norm(milestone.elementGroupCode || milestone.riskDetails?.groupCode || '');
    if (!titleGroupHint) return groups;

    const exact = groups.filter(group => {
      const values = [group.groupCode, group.name].map(norm).filter(Boolean);
      return values.some(value =>
        value === titleGroupHint ||
        value.includes(titleGroupHint) ||
        titleGroupHint.includes(value)
      );
    });
    return exact.length ? exact : groups;
  }

  function autoLinkMilestones() {
    const current = currentProject();
    if (!current) return false;
    let changed = false;

    (current.milestones || []).forEach(milestone => {
      if (milestone.elementGroupId || milestone.riskDetails?.elementGroupId) return;
      if (!elementTypeHint(milestone.title)) return;
      const groups = candidateGroups(milestone, current);
      if (groups.length !== 1) return;
      milestone.elementGroupId = groups[0].id;
      milestone.riskDetails = {
        ...(milestone.riskDetails || {}),
        elementGroupId: groups[0].id,
        autoLinkedElementGroup: true
      };
      milestone.updatedAt = new Date().toISOString();
      state.autoLinked.add(String(milestone.id));
      changed = true;
    });

    if (changed && typeof saveProject === 'function') {
      saveProject().catch(error =>
        console.warn('LIV milestone groups: не удалось сохранить автосвязь.', error)
      );
    }
    return changed;
  }

  function milestoneFromEditor() {
    const current = currentProject();
    const title = text($id('mTitle')?.value);
    const no = text($id('mNo')?.value);
    return [...(current?.milestones || [])].reverse().find(item =>
      (!title || item.title === title) &&
      (!no || item.milestoneNo === no)
    ) || null;
  }

  function groupOptions(selectedId, milestone) {
    const current = currentProject();
    const groups = milestone
      ? candidateGroups(milestone, current)
      : (current?.numberedElementGroups || []).filter(item => item.active !== false);
    return `
      <option value="">— не выбрана —</option>
      ${groups.map(group => `
        <option value="${group.id}" ${String(group.id) === String(selectedId || '') ? 'selected' : ''}>
          ${groupLabel(group, current)}
        </option>
      `).join('')}
    `;
  }

  function injectEditorField() {
    if (!$id('mTitle') || $id('mElementGroupId')) return;
    if (!/ключевая дата/i.test(text($id('modalTitle')?.textContent))) return;
    const grid = $id('modalBody')?.querySelector('.form-grid');
    if (!grid) return;
    const milestone = milestoneFromEditor() || {
      title: $id('mTitle')?.value || '',
      buildingId: $id('mBuilding')?.value || ''
    };
    if (!elementTypeHint(milestone.title)) return;
    const selected = milestone.elementGroupId || milestone.riskDetails?.elementGroupId || '';
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `
      <label>Группа свай / анкеров</label>
      <select id="mElementGroupId">${groupOptions(selected, milestone)}</select>
      <small class="muted">Группа отделяет одинаковые номера, например БСС-1 №93 и БСС-2 №93.</small>
    `;
    grid.appendChild(field);
  }

  function wrapSave() {
    if (state.wrappedSave || typeof window.saveMilestone !== 'function') return false;
    const original = window.saveMilestone;
    window.saveMilestone = async function (id, correspondence) {
      const selectedGroupId = $id('mElementGroupId')?.value || '';
      const before = new Set((currentProject()?.milestones || []).map(item => String(item.id)));
      const title = text($id('mTitle')?.value);
      await original(id, correspondence);

      const current = currentProject();
      let milestone = id
        ? (current?.milestones || []).find(item => String(item.id) === String(id))
        : (current?.milestones || []).find(item => !before.has(String(item.id)) && item.title === title);
      if (!milestone) {
        milestone = [...(current?.milestones || [])].reverse().find(item => item.title === title) || null;
      }
      if (!milestone) return;

      milestone.elementGroupId = selectedGroupId;
      milestone.riskDetails = {
        ...(milestone.riskDetails || {}),
        elementGroupId: selectedGroupId,
        autoLinkedElementGroup: false
      };
      milestone.riskUpdatedAt = '';
      milestone.updatedAt = new Date().toISOString();
      if (typeof saveProject === 'function') await saveProject();
      if (typeof renderAll === 'function') renderAll();
    };
    state.wrappedSave = true;
    return true;
  }

  function decorateAmbiguousRows() {
    const current = currentProject();
    const body = $id('milestoneRows');
    if (!current || !body) return;
    const counts = { red:0, orange:0, yellow:0, green:0, gray:0 };

    body.querySelectorAll('tr').forEach(row => {
      const button = row.querySelector('[data-ms]');
      if (!button) return;
      const milestone = (current.milestones || []).find(item =>
        String(item.id) === String(button.dataset.ms)
      );
      if (!milestone) return;

      const typeHint = elementTypeHint(milestone.title);
      const selected = milestone.elementGroupId || milestone.riskDetails?.elementGroupId || '';
      const groups = typeHint ? candidateGroups(milestone, current) : [];
      const ambiguous = typeHint && !selected && groups.length > 1;

      if (ambiguous) {
        row.dataset.riskLevel = 'gray';
        const box = row.querySelector('.milestone-risk-box');
        if (box) {
          box.className = 'milestone-risk-box risk-gray';
          box.innerHTML = '<strong>Нет расчёта</strong><span>Выбери группу свай / анкеров</span>';
        }
        milestone.riskLevel = 'gray';
        milestone.riskDetails = {
          ...(milestone.riskDetails || {}),
          reviewRequired: true,
          reviewReason: 'Не выбрана группа номерных элементов'
        };
      }

      const level = row.dataset.riskLevel || 'gray';
      counts[level] = (counts[level] || 0) + 1;
    });

    Object.entries(counts).forEach(([level, value]) => {
      const target = $id('riskCount' + level.charAt(0).toUpperCase() + level.slice(1));
      if (target) target.textContent = String(value);
    });
  }

  function renderSafe() {
    if (state.observer) state.observer.disconnect();
    try {
      autoLinkMilestones();
      injectEditorField();
      decorateAmbiguousRows();
    } finally {
      state.observer?.observe(document.body, { childList:true, subtree:true });
    }
  }

  function scheduleRender() {
    clearTimeout(state.timer);
    state.timer = setTimeout(renderSafe, 80);
  }

  function bootstrap() {
    state.observer = new MutationObserver(scheduleRender);
    state.observer.observe(document.body, { childList:true, subtree:true });
    scheduleRender();

    const timer = setInterval(() => {
      if (!window.LIV_MILESTONE_RISK) return;
      if (wrapSave()) clearInterval(timer);
    }, 200);
    setTimeout(() => clearInterval(timer), 20000);
  }

  window.LIV_MILESTONE_RISK_GROUPS = {
    version: VERSION,
    autoLink: autoLinkMilestones,
    candidates: candidateGroups
  };

  window.addEventListener('liv-remote-project', scheduleRender);
  window.addEventListener('liv-normalized-sync-status', event => {
    if (event.detail?.status === 'ready') scheduleRender();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
  } else {
    bootstrap();
  }
})();
