'use strict';

(function () {
  const VERSION = '2026.10.14.3';
  const state = {
    running: false,
    last: null
  };

  function host() {
    return document.querySelector('.top-actions') || document.querySelector('.topbar');
  }

  function badge() {
    let node = document.getElementById('livPreflightBadge');
    if (node) return node;

    const parent = host();
    if (!parent) return null;

    node = document.createElement('button');
    node.id = 'livPreflightBadge';
    node.type = 'button';
    node.className = 'btn';
    node.style.cssText = [
      'min-height:30px',
      'padding:5px 9px',
      'font-size:11px',
      'white-space:nowrap'
    ].join(';');
    node.textContent = 'Проверка: ожидание';
    node.title = 'Проверить готовность LIV к тесту';
    node.onclick = () => run(true);
    parent.appendChild(node);
    return node;
  }

  function setBadge(status, text) {
    const node = badge();
    if (!node) return;
    node.textContent = text;
    node.style.background =
      status === 'ok'
        ? '#eefaf3'
        : status === 'bad'
          ? '#fff1f1'
          : status === 'running'
            ? '#fff9e8'
            : '#fff';
    node.style.color =
      status === 'ok'
        ? '#176b49'
        : status === 'bad'
          ? '#a52828'
          : status === 'running'
            ? '#8a6100'
            : '';
  }

  function result(name, ok, detail = '') {
    return { name, ok: Boolean(ok), detail: String(detail || '') };
  }

  async function storageCheck() {
    const client = window.LIV_SUPABASE;
    if (!client) return result('PDF-хранилище', false, 'Нет подключения к Supabase');

    try {
      const response = await client.storage
        .from('liv-schemes')
        .list('schemes', { limit: 1 });

      if (response.error) {
        return result('PDF-хранилище', false, response.error.message || response.error);
      }

      return result('PDF-хранилище', true, 'bucket liv-schemes доступен');
    } catch (error) {
      return result('PDF-хранилище', false, error?.message || error);
    }
  }

  function moduleChecks() {
    return [
      result('Серверная синхронизация', Boolean(window.LIV_NORMALIZED_SYNC)),
      result('Память сопоставлений', Boolean(window.LIV_SOURCE_MAPPINGS)),
      result('Импорт КД', Boolean(window.LIV_KEY_DATE_IMPORT)),
      result('Прогноз КД', Boolean(window.LIV_MILESTONE_RISK)),
      result('Номерные элементы', Boolean(window.LIV_NUMBERED_ELEMENTS_V2)),
      result('PDF-схемы', Boolean(window.LIV_SCHEMES)),
      result('Снимки отчётов', Boolean(window.LIV_REPORT_SNAPSHOTS))
    ];
  }

  function currentProject() {
    try {
      return typeof project !== 'undefined' ? project : null;
    } catch (error) {
      return null;
    }
  }

  async function serverIdentitySet(table, column, projectScoped) {
    const client = window.LIV_SUPABASE;
    const projectId = window.LIV_NORMALIZED_SYNC?.projectId?.() || '';
    const values = new Set();
    let from = 0;
    const pageSize = 1000;

    while (true) {
      let query = client
        .from(table)
        .select(column)
        .range(from, from + pageSize - 1);

      if (projectScoped) {
        query = query.eq('project_id', projectId);
      }

      const response = await query;
      if (response.error) throw response.error;

      const rows = response.data || [];
      rows.forEach(row => {
        const value = String(row[column] || '');
        if (value) values.add(value);
      });

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return values;
  }

  async function identityChecks() {
    const current = currentProject();
    if (!current || !window.LIV_SUPABASE) {
      return [result('Сверка ID', false, 'Проект или Supabase не загружен')];
    }

    const active = list => (list || []).filter(item => item && item.active !== false);

    const specs = [
      ['buildings', active(current.buildings), 'external_id', true, item => item.id],
      ['organizations', active(current.organizations), 'external_id', false, item => item.id],
      ['works', active(current.works), 'external_id', false, item => item.id],
      ['contracts', active(current.contracts), 'external_id', true, item => item.id],
      ['structures', active(current.structures), 'external_id', true, item => item.id],
      ['fronts', active(current.fronts), 'external_id', true, item => item.id],
      ['matrices', active(current.matrices), 'external_id', true, item => item.id],
      ['milestones', active(current.milestones), 'external_id', true, item => item.id],
      ['numbered_elements', active(current.numberedElements), 'external_id', true, item => item.id],
      ['schedule_versions', current.scheduleVersions || [], 'external_id', true, item => item.id],
      ['schedule_tasks', (current.tasks || []).filter(item => item && item.active !== false && item.testOnly !== true), 'external_id', true, item => item.id],
      ['network_segments', active(current.networkSegments), 'external_id', true, item => item.id],
      ['report_snapshots', current.reportSnapshots || [], 'external_id', true, item => item.id],
      ['resource_log', current.resources || [], 'external_id', true, item => item.id],
      ['schemes', active(current.schemes), 'external_id', true, item => item.id],
      ['scheme_marks', active(current.schemeMarks), 'external_id', true, item => item.id],
      ['progress_facts', current.progressFacts || [], 'source_fingerprint', true, item => item.sourceFingerprint || (item.id ? 'progress:' + item.id : '')]
    ];

    const checks = [];

    for (const [table, items, column, scoped, getId] of specs) {
      const localRaw = items
        .map(getId)
        .map(value => String(value || ''))
        .filter(Boolean);

      const localSet = new Set(localRaw);
      const duplicates = Math.max(0, localRaw.length - localSet.size);

      let serverSet;
      try {
        serverSet = await serverIdentitySet(table, column, scoped);
      } catch (error) {
        checks.push(result('ID · ' + table, false, error?.message || error));
        continue;
      }

      const missing = [...localSet].filter(id => !serverSet.has(id));
      const extra = [...serverSet].filter(id => !localSet.has(id));

      checks.push(result(
        'ID · ' + table,
        missing.length === 0 && duplicates === 0,
        'локально ' + localSet.size +
        ' · сервер ' + serverSet.size +
        ' · отсутствует ' + missing.length +
        ' · дублей локально ' + duplicates +
        (['organizations','works'].includes(table) ? '' : ' · лишних ' + extra.length)
      ));
    }

    return checks;
  }


  async function migrationChecks() {
    if (!window.LIV_NORMALIZED_SYNC?.verifyMigration) {
      return [result('Сверка миграции', false, 'Модуль не загружен')];
    }

    try {
      const report = await window.LIV_NORMALIZED_SYNC.verifyMigration();
      return Object.entries(report || {}).map(([name, value]) =>
        result(
          'Сверка · ' + name,
          value.ok,
          value.local + ' локально / ' + value.server + ' сервер' +
            (value.exact ? ' · точно' : '')
        )
      );
    } catch (error) {
      return [result('Сверка миграции', false, error?.message || error)];
    }
  }

  async function run(showDialog = false) {
    if (state.running) return state.last;
    state.running = true;
    setBadge('running', 'Проверка...');

    const checks = [];

    const role = window.LIV_REMOTE_SYNC?.role?.() || '';
    checks.push(result(
      'Авторизация',
      Boolean(window.LIV_REMOTE_SYNC && role),
      role ? 'роль: ' + role : 'роль не определена'
    ));

    const normalizedState = window.LIV_NORMALIZED_SYNC?.state?.() || {};
    checks.push(result(
      'Состояние серверной базы',
      normalizedState.status === 'ready',
      normalizedState.message || normalizedState.status || 'нет состояния'
    ));

    checks.push(...moduleChecks());
    checks.push(await storageCheck());
    checks.push(...await migrationChecks());

    if (showDialog) {
      checks.push(...await identityChecks());
    }

    const failed = checks.filter(item => !item.ok);
    state.last = {
      at: new Date().toISOString(),
      ok: failed.length === 0,
      checks
    };
    state.running = false;

    if (failed.length) {
      setBadge('bad', 'Проверка: ' + failed.length + ' проблем');
    } else {
      setBadge('ok', 'Проверка: готово');
    }

    window.LIV_PREFLIGHT_STATE = state.last;
    window.dispatchEvent(new CustomEvent('liv-preflight-status', { detail: state.last }));

    if (showDialog) {
      const lines = checks.map(item =>
        (item.ok ? '✓ ' : '✕ ') +
        item.name +
        (item.detail ? ' — ' + item.detail : '')
      );

      alert(
        (failed.length ? 'LIV — есть проблемы перед тестом' : 'LIV — готовность к тесту подтверждена') +
        '\n\n' +
        lines.join('\n')
      );
    }

    return state.last;
  }

  function bootstrap() {
    badge();

    window.addEventListener('liv-normalized-sync-status', event => {
      if (event.detail?.status === 'ready') {
        setTimeout(() => run(false), 400);
      } else if (event.detail?.status === 'error') {
        setBadge('bad', 'Проверка: серверная ошибка');
      }
    });

    window.addEventListener('liv-auth-session', event => {
      if (event.detail?.signedIn) setTimeout(() => run(false), 1200);
    });
  }

  window.LIV_PREFLIGHT = {
    version: VERSION,
    run,
    state: () => state.last
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
