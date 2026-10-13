'use strict';

(function () {
  const VERSION = '2026.10.13.1';
  const state = {
    observer: null,
    timer: null,
    boundCommit: null,
    pendingMappings: []
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

  function keyDateState() {
    return window.LIV_KEY_DATE_IMPORT?.state?.() || null;
  }

  function ensureWarning() {
    const mapping = $id('keyDateMapping');
    if (!mapping || $id('keyDateGuardNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'keyDateGuardNotice';
    notice.className = 'notice warn';
    notice.style.marginTop = '10px';
    notice.textContent = 'Строки с похожей или новой организацией сняты с выбора. Отметь их вручную только после проверки сопоставления.';
    mapping.insertAdjacentElement('afterend', notice);
  }

  function guardPreview() {
    const preview = $id('keyDatePreview');
    const currentState = keyDateState();
    if (!preview || !currentState?.rows) return;
    ensureWarning();

    preview.querySelectorAll('[data-kd-row]').forEach(checkbox => {
      if (checkbox.dataset.guardApplied === '1') return;
      const index = Number(checkbox.dataset.kdRow);
      const row = currentState.rows[index];
      if (!row) return;

      const ambiguous = [
        'Похоже',
        'Новая организация',
        'Требует проверки'
      ].includes(row.organizationStatus) || [
        'Похоже',
        'Новая организация',
        'Требует проверки'
      ].includes(row.result);

      if (ambiguous && checkbox.checked) {
        checkbox.checked = false;
        row.selected = false;
        checkbox.closest('tr')?.classList.add('import-row-review');
      }
      checkbox.dataset.guardApplied = '1';
    });

    const commit = $id('keyDateCommit');
    if (commit) {
      commit.disabled = !currentState.rows.some(row =>
        row.selected && row.result !== 'Ошибка'
      );
    }
  }

  function collectMappings() {
    const currentState = keyDateState();
    const current = currentProject();
    if (!currentState?.rows || !current) return [];

    return currentState.rows
      .filter(row => row.selected && row.result !== 'Ошибка' && row.organizationName)
      .map(row => {
        let organizationId = row.organizationId;
        if (!organizationId) {
          organizationId = (current.organizations || []).find(item =>
            text(item.name).toLocaleLowerCase('ru-RU') ===
            text(row.organizationName).toLocaleLowerCase('ru-RU')
          )?.id || '';
        }
        return {
          sourceName: currentState.fileName || 'key-date-import',
          sourceEntityType: 'organization',
          sourceValue: row.organizationName,
          targetEntityType: 'organization',
          targetLocalId: organizationId,
          confidence: row.organizationStatus === 'Совпадение' ? 1 : 0.8,
          decision: 'confirmed'
        };
      })
      .filter(item => item.targetLocalId);
  }

  function rememberPendingMappings() {
    const mappings = state.pendingMappings.splice(0);
    if (!mappings.length || !window.LIV_SOURCE_MAPPINGS) return;
    mappings.forEach(mapping => window.LIV_SOURCE_MAPPINGS.remember(mapping));
    window.LIV_SOURCE_MAPPINGS.flush?.();
  }

  function bindCommitCapture() {
    const button = $id('keyDateCommit');
    if (!button || state.boundCommit === button) return;
    state.boundCommit = button;
    button.addEventListener('click', () => {
      state.pendingMappings = collectMappings();
      setTimeout(rememberPendingMappings, 1300);
    }, true);
  }

  function renderSafe() {
    if (state.observer) state.observer.disconnect();
    try {
      guardPreview();
      bindCommitCapture();
    } finally {
      state.observer?.observe(document.body, { childList:true, subtree:true });
    }
  }

  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(renderSafe, 60);
  }

  function injectStyles() {
    if ($id('keyDateGuardStyles')) return;
    const style = document.createElement('style');
    style.id = 'keyDateGuardStyles';
    style.textContent = `
      .import-row-review{background:#fff7e8!important}
      .import-row-review td:nth-child(3),.import-row-review td:nth-child(4){color:#9a5b00;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function bootstrap() {
    injectStyles();
    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.body, { childList:true, subtree:true });
    schedule();
  }

  window.LIV_KEY_DATE_IMPORT_GUARD = {
    version: VERSION,
    apply: schedule
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
  } else {
    bootstrap();
  }
})();
