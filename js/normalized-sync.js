'use strict';

(function () {
  const MODULE_VERSION = '2026.10.13.8';
  const PROJECT_EXTERNAL_ID = 'LIV-MAIN';
  const SAVE_DELAY = 1200;
  const PAGE_SIZE = 1000;
  const WRITE_CHUNK = 150;
  const RESOURCE_CHUNK = 250;

  const VERSIONED_TABLES = new Set([
    'buildings',
    'organizations',
    'works',
    'contracts',
    'structures',
    'fronts',
    'matrices',
    'milestones',
    'numbered_element_groups',
    'numbered_elements',
    'work_metrics',
    'progress_facts',
    'schedule_versions',
    'schedule_tasks',
    'source_mappings',
    'entity_aliases',
    'resource_log',
    'import_log'
  ]);

  const state = {
    projectId: '',
    running: false,
    resourceRunning: false,
    queuedProject: null,
    timer: null,
    maps: {},
    hashes: {},
    serverVersions: {},
    lastError: '',
    lastSuccessAt: '',
    status: 'idle'
  };

  function client() {
    return window.LIV_SUPABASE || null;
  }

  function dbError(context, error) {
    const message = error?.message || String(error || 'Неизвестная ошибка');
    const code = error?.code ? ' [' + error.code + ']' : '';
    return new Error(context + ': ' + message + code);
  }

  async function syncStep(label, action) {
    try {
      return await action();
    } catch (error) {
      throw dbError(label, error);
    }
  }

  function remoteSync() {
    return window.LIV_REMOTE_SYNC || null;
  }

  function canWrite() {
    return Boolean(remoteSync()?.canWrite?.());
  }

  function localProject() {
    try {
      return typeof project !== 'undefined' ? project : null;
    } catch (error) {
      return null;
    }
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalized(value) {
    return text(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function numberOrNull(value) {
    if (value === '' || value == null) return null;
    const number = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function integer(value, fallback = 0) {
    const number = numberOrNull(value);
    return number == null ? fallback : Math.round(number);
  }

  function dateValue(value) {
    if (!value) return null;
    const raw = text(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (!match) return null;
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    return year + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    Object.keys(value).sort().forEach(key => {
      if (value[key] !== undefined) result[key] = stable(value[key]);
    });
    return result;
  }

  function hash(value) {
    const input = JSON.stringify(stable(value));
    let current = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      current ^= input.charCodeAt(index);
      current = Math.imul(current, 16777619);
    }
    return (current >>> 0).toString(16).padStart(8, '0');
  }

  function hashesStorageKey() {
    return 'liv-normalized-hashes:' + MODULE_VERSION + ':' + (state.projectId || 'pending');
  }

  function loadHashes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(hashesStorageKey()) || '{}');
      state.hashes = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      state.hashes = {};
    }
  }

  function saveHashes() {
    try {
      localStorage.setItem(hashesStorageKey(), JSON.stringify(state.hashes));
    } catch (error) {
      console.warn('LIV normalized sync: не удалось сохранить локальный индекс.', error);
    }
  }

  function versionsStorageKey() {
    return 'liv-normalized-versions:' + MODULE_VERSION + ':' + (state.projectId || 'pending');
  }

  function loadServerVersions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(versionsStorageKey()) || '{}');
      state.serverVersions = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      state.serverVersions = {};
    }
  }

  function saveServerVersions() {
    try {
      localStorage.setItem(versionsStorageKey(), JSON.stringify(state.serverVersions));
    } catch (error) {
      console.warn('LIV normalized sync: не удалось сохранить версии строк.', error);
    }
  }

  function samePayload(localRow, serverRow) {
    return Object.keys(localRow)
      .every(key => {
        if (key === 'row_version' || key === 'updated_at') return true;

        const left = localRow[key] == null ? null : localRow[key];
        const right = serverRow[key] == null ? null : serverRow[key];

        return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
      });
  }

  async function checkWriteConflicts(table, rows, identity) {
    if (
      identity !== 'external_id' ||
      !VERSIONED_TABLES.has(table) ||
      !rows.length
    ) {
      return;
    }

    const ids = rows
      .map(row => row.external_id)
      .filter(Boolean);

    if (!ids.length) return;

    const result = await client()
      .from(table)
      .select('*')
      .in('external_id', ids);

    if (result.error) throw result.error;

    const serverById = new Map(
      (result.data || [])
        .map(row => [String(row.external_id), row])
    );

    for (const row of rows) {
      const id = String(row.external_id || '');
      const serverRow = serverById.get(id);
      if (!serverRow) continue;

      const versionKey = table + ':' + id;
      const serverVersion = Number(serverRow.row_version || 1);
      const knownVersion = Number(state.serverVersions[versionKey] || 0);

      if (
        knownVersion > 0 &&
        serverVersion > knownVersion &&
        !samePayload(row, serverRow)
      ) {
        throw new Error(
          'Конфликт редактирования: запись в «' +
          table +
          '» уже изменена другим пользователем. Обнови данные перед сохранением.'
        );
      }

      state.serverVersions[versionKey] = serverVersion;
    }

    saveServerVersions();
  }

  async function refreshWrittenVersions(table, rows, identity) {
    if (
      identity !== 'external_id' ||
      !VERSIONED_TABLES.has(table) ||
      !rows.length
    ) {
      return;
    }

    const ids = rows.map(row => row.external_id).filter(Boolean);
    if (!ids.length) return;

    const result = await client()
      .from(table)
      .select('external_id,row_version')
      .in('external_id', ids);

    if (result.error) throw result.error;

    (result.data || []).forEach(row => {
      state.serverVersions[table + ':' + row.external_id] =
        Number(row.row_version || 1);
    });

    saveServerVersions();
  }

  function ensureStatusBadge() {
    let badge = document.getElementById('livNormalizedSyncBadge');
    if (badge) return badge;

    const host = document.querySelector('.top-actions') || document.querySelector('.topbar');
    if (!host) return null;

    badge = document.createElement('span');
    badge.id = 'livNormalizedSyncBadge';
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'min-height:30px',
      'padding:5px 9px',
      'border:1px solid #d8dee8',
      'border-radius:8px',
      'background:#fff',
      'font-size:11px',
      'color:#667085',
      'white-space:nowrap'
    ].join(';');
    badge.textContent = 'Серверная база: ожидание';
    host.appendChild(badge);
    return badge;
  }

  function setStatus(status, message, details = {}) {
    state.status = status;
    if (status === 'error') state.lastError = message || '';
    if (status === 'ready') {
      state.lastSuccessAt = new Date().toISOString();
      state.lastError = '';
    }

    const badge = ensureStatusBadge();
    if (badge) {
      badge.textContent = message || status;
      badge.style.background = status === 'error'
        ? '#fff3f3'
        : status === 'syncing'
          ? '#fff9e8'
          : status === 'ready'
            ? '#eefaf3'
            : '#fff';
      badge.style.color = status === 'error'
        ? '#a52828'
        : status === 'syncing'
          ? '#8a6100'
          : status === 'ready'
            ? '#176b49'
            : '#667085';
    }

    window.LIV_NORMALIZED_STATE = {
      version: MODULE_VERSION,
      projectId: state.projectId,
      status,
      message,
      lastError: state.lastError,
      lastSuccessAt: state.lastSuccessAt,
      ...details
    };

    window.dispatchEvent(new CustomEvent('liv-normalized-sync-status', {
      detail: window.LIV_NORMALIZED_STATE
    }));
  }

  function ensureCollections(current) {
    if (!current) return;
    [
      'buildings', 'works', 'organizations', 'contracts', 'structures', 'fronts',
      'matrices', 'matrixFronts', 'milestones', 'numberedElements',
      'numberedElementGroups', 'workMetrics', 'progressFacts', 'factLog',
      'resources', 'resourcePlans', 'scheduleVersions', 'tasks', 'taskDates',
      'taskQuantities', 'dependencies', 'importHistory', 'dailyReports',
      'networkSegments', 'reportSnapshots'
    ].forEach(name => {
      if (!Array.isArray(current[name])) current[name] = [];
    });
  }

  async function fetchAll(table, columns, configure) {
    const rows = [];
    let start = 0;

    while (true) {
      let query = client().from(table).select(columns).range(start, start + PAGE_SIZE - 1);
      if (configure) query = configure(query);
      const result = await query;
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
      if (!result.data || result.data.length < PAGE_SIZE) break;
      start += PAGE_SIZE;
    }

    return rows;
  }

  async function resolveProjectId() {
    if (state.projectId) return state.projectId;
    const result = await client()
      .from('projects')
      .select('id')
      .eq('external_id', PROJECT_EXTERNAL_ID)
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error('Не найден серверный проект LIV-MAIN.');
    state.projectId = result.data.id;
    loadHashes();
    loadServerVersions();
    return state.projectId;
  }

  function mapValue(mapName, localId) {
    if (!localId) return null;
    return state.maps[mapName]?.get(String(localId)) || null;
  }

  async function refreshMap(table, mapName, projectScoped = false) {
    const rows = await fetchAll(
      table,
      'id,external_id',
      projectScoped ? query => query.eq('project_id', state.projectId) : null
    );
    state.maps[mapName] = new Map();
    rows.forEach(row => {
      if (row.external_id) state.maps[mapName].set(String(row.external_id), row.id);
    });
    return state.maps[mapName];
  }

  async function adoptNamedRows(table, items, projectScoped = false) {
    if (!items.length) return;
    const rows = await fetchAll(
      table,
      'id,external_id,name',
      projectScoped ? query => query.eq('project_id', state.projectId) : null
    );
    const byExternal = new Map(rows.filter(row => row.external_id).map(row => [String(row.external_id), row]));
    const byName = new Map(rows.map(row => [normalized(row.name), row]));

    for (const item of items) {
      if (!item?.id || byExternal.has(String(item.id))) continue;
      const row = byName.get(normalized(item.name));
      if (!row || row.external_id) continue;
      const result = await client().from(table).update({ external_id: String(item.id) }).eq('id', row.id);
      if (result.error) throw result.error;
      row.external_id = String(item.id);
      byExternal.set(String(item.id), row);
    }
  }

  function changedRows(tableKey, rows, identity = 'external_id') {
    return rows.filter(row => {
      const id = row[identity];
      if (!id) return true;
      return state.hashes[tableKey + ':' + id] !== hash(row);
    });
  }

  function markRows(tableKey, rows, identity = 'external_id') {
    rows.forEach(row => {
      const id = row[identity];
      if (id) state.hashes[tableKey + ':' + id] = hash(row);
    });
  }

  async function writeVersionedRows(table, rows) {
    const ids = rows.map(row => row.external_id).filter(Boolean);
    if (!ids.length) return 0;

    const lookup = await client()
      .from(table)
      .select('external_id,row_version')
      .in('external_id', ids);

    if (lookup.error) throw dbError('Таблица ' + table + ' · чтение версии', lookup.error);

    const serverById = new Map(
      (lookup.data || []).map(row => [String(row.external_id), row])
    );

    let written = 0;

    for (const row of rows) {
      const id = String(row.external_id || '');
      if (!id) continue;

      const versionKey = table + ':' + id;
      const serverRow = serverById.get(id);

      if (!serverRow) {
        const inserted = await client()
          .from(table)
          .insert(row)
          .select('external_id,row_version')
          .single();

        if (inserted.error) {
          if (inserted.error.code === '23505') {
            throw new Error(
              'Конфликт редактирования: запись «' + id +
              '» в «' + table +
              '» была создана другим пользователем. Обнови данные перед сохранением.'
            );
          }
          throw dbError('Таблица ' + table + ' · вставка', inserted.error);
        }

        state.serverVersions[versionKey] = Number(inserted.data?.row_version || 1);
        written += 1;
        continue;
      }

      const serverVersion = Number(serverRow.row_version || 1);
      const knownVersion = Number(state.serverVersions[versionKey] || 0);

      if (knownVersion > 0 && serverVersion !== knownVersion) {
        throw new Error(
          'Конфликт редактирования: запись «' + id +
          '» в «' + table +
          '» уже изменена другим пользователем. Обнови данные перед сохранением.'
        );
      }

      const updated = await client()
        .from(table)
        .update(row)
        .eq('external_id', id)
        .eq('row_version', serverVersion)
        .select('external_id,row_version');

      if (updated.error) throw dbError('Таблица ' + table + ' · обновление', updated.error);

      if (!updated.data || updated.data.length !== 1) {
        throw new Error(
          'Конфликт редактирования: запись «' + id +
          '» в «' + table +
          '» изменилась во время сохранения. Обнови данные и повтори.'
        );
      }

      state.serverVersions[versionKey] = Number(updated.data[0].row_version || serverVersion + 1);
      written += 1;
    }

    saveServerVersions();
    return written;
  }

  async function upsertRows(table, rows, onConflict, tableKey = table, identity = 'external_id', chunkSize = WRITE_CHUNK) {
    const pending = changedRows(tableKey, rows, identity);
    if (!pending.length) return { written: 0, total: rows.length };

    let written = 0;

    for (let index = 0; index < pending.length; index += chunkSize) {
      const chunk = pending.slice(index, index + chunkSize);

      if (
        identity === 'external_id' &&
        VERSIONED_TABLES.has(table)
      ) {
        written += await writeVersionedRows(table, chunk);
      } else {
        await checkWriteConflicts(
          table,
          chunk,
          identity
        );

        const result = await client().from(table).upsert(chunk, {
          onConflict,
          ignoreDuplicates: false
        });
        if (result.error) throw dbError('Таблица ' + table, result.error);

        await refreshWrittenVersions(
          table,
          chunk,
          identity
        );

        written += chunk.length;
      }

      markRows(tableKey, chunk, identity);
    }

    saveHashes();
    return { written, total: rows.length };
  }

  function organizationType(value) {
    const allowed = new Set([
      'developer', 'technical_customer', 'general_contractor',
      'contractor', 'designer', 'supplier', 'other'
    ]);
    const raw = text(value);
    return allowed.has(raw) ? raw : 'contractor';
  }

  function validFrontStatus(value) {
    const allowed = new Set([
      'Не начато', 'Фронт готов', 'В работе', 'Завершено',
      'Приостановлено', 'Ограничение'
    ]);
    return allowed.has(value) ? value : 'Не начато';
  }

  async function syncDictionaries(current) {
    const buildings = current.buildings.filter(item => item?.id && item?.name);
    const works = current.works.filter(item => item?.id && item?.name);
    const organizations = current.organizations.filter(item => item?.id && item?.name);

    await adoptNamedRows('buildings', buildings, true);
    await adoptNamedRows('works', works, false);
    await adoptNamedRows('organizations', organizations, false);

    await upsertRows('buildings', buildings.map((item, index) => ({
      external_id: String(item.id),
      project_id: state.projectId,
      name: text(item.name),
      code: text(item.code) || null,
      sort_order: integer(item.sort ?? item.sortOrder, index + 1),
      active: item.active !== false
    })), 'external_id');

    await upsertRows('works', works.map((item, index) => ({
      external_id: String(item.id),
      name: text(item.name),
      section_name: text(item.section ?? item.sectionName) || null,
      unit_default: text(item.unit ?? item.unitDefault) || null,
      sort_order: integer(item.sort ?? item.sortOrder, index + 1),
      active: item.active !== false
    })), 'external_id');

    await upsertRows('organizations', organizations.map(item => ({
      external_id: String(item.id),
      name: text(item.name),
      short_name: text(item.shortName) || null,
      organization_type: organizationType(item.organizationType ?? item.type),
      active: item.active !== false
    })), 'external_id');

    await refreshMap('buildings', 'building', true);
    await refreshMap('works', 'work', false);
    await refreshMap('organizations', 'organization', false);

    const projectOrganizations = organizations
      .map(item => mapValue('organization', item.id))
      .filter(Boolean)
      .map(id => ({ project_id: state.projectId, organization_id: id, active: true }));

    if (projectOrganizations.length) {
      const result = await client().from('project_organizations').upsert(projectOrganizations, {
        onConflict: 'project_id,organization_id',
        ignoreDuplicates: false
      });
      if (result.error) throw result.error;
    }
  }

  async function syncAliasesAndMappings(current) {

    const aliases = [];

    const pushAliases = (
      entityType,
      items,
      mapName
    ) => {
      (items || []).forEach(item => {
        const entityId = mapValue(mapName, item.id);
        if (!entityId || !Array.isArray(item.aliases)) return;

        item.aliases
          .map(text)
          .filter(Boolean)
          .forEach(alias => {
            aliases.push({
              project_id: state.projectId,
              entity_type: entityType,
              entity_id: entityId,
              alias,
              source_name: 'LIV',
              active: true
            });
          });
      });
    };

    pushAliases('building', current.buildings, 'building');
    pushAliases('work', current.works, 'work');
    pushAliases('organization', current.organizations, 'organization');

    if (aliases.length) {
      const result = await client()
        .from('entity_aliases')
        .upsert(aliases, {
          onConflict: 'project_id,entity_type,normalized_alias',
          ignoreDuplicates: false
        });

      if (result.error) throw result.error;
    }

    const mappings = (current.sourceMappings || [])
      .filter(item => item?.sourceValue && (item?.targetLocalId || item?.targetEntityId))
      .map(item => {
        let targetEntityId = null;

        if (item.targetEntityType === 'building') {
          targetEntityId = mapValue('building', item.targetLocalId || item.targetEntityId);
        } else if (item.targetEntityType === 'work') {
          targetEntityId = mapValue('work', item.targetLocalId || item.targetEntityId);
        } else if (item.targetEntityType === 'organization') {
          targetEntityId = mapValue('organization', item.targetLocalId || item.targetEntityId);
        }

        if (!targetEntityId) return null;

        return {
          project_id: state.projectId,
          source_name: text(item.sourceName) || 'LIV',
          source_entity_type: text(item.sourceEntityType) || item.targetEntityType,
          source_value: text(item.sourceValue),
          target_entity_type: item.targetEntityType,
          target_entity_id: targetEntityId,
          confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 1))),
          decision: text(item.decision) || 'confirmed'
        };
      })
      .filter(Boolean);

    if (mappings.length) {
      const result = await client()
        .from('source_mappings')
        .upsert(mappings, {
          onConflict: 'project_id,source_name,source_entity_type,normalized_source_value',
          ignoreDuplicates: false
        });

      if (result.error) throw result.error;
    }
  }


  async function verifyMigration(current) {

    const checks = [
      ['buildings', current.buildings.filter(item => item.active !== false).length, true],
      ['organizations', current.organizations.filter(item => item.active !== false).length, false],
      ['works', current.works.filter(item => item.active !== false).length, false],
      ['contracts', current.contracts.filter(item => item.active !== false).length, true],
      ['structures', current.structures.filter(item => item.active !== false).length, true],
      ['fronts', current.fronts.filter(item => item.active !== false).length, true],
      ['matrices', current.matrices.filter(item => item.active !== false).length, true],
      ['milestones', current.milestones.filter(item => item.active !== false).length, true],
      ['numbered_element_groups', current.numberedElementGroups.filter(item => item.active !== false).length, true],
      ['numbered_elements', current.numberedElements.filter(item => item.active !== false).length, true],
      ['work_metrics', derivedMetrics(current).filter(item => item.active !== false).length, true],
      ['progress_facts', current.progressFacts.length, true],
      ['schedule_versions', current.scheduleVersions.length, true],
      ['schedule_tasks', current.tasks.filter(item => item.active !== false && item.testOnly !== true).length, true],
      ['resource_log', current.resources.length, true]
    ];

    const report = {};

    for (const [table, localCount, projectScoped] of checks) {
      let query = client()
        .from(table)
        .select('id', {
          count: 'exact',
          head: true
        });

      if (projectScoped) {
        query = query.eq('project_id', state.projectId);
      }

      const result = await query;
      if (result.error) throw result.error;

      const serverCount = Number(result.count || 0);

      report[table] = {
        local: localCount,
        server: serverCount,
        ok: serverCount >= localCount,
        exact: serverCount === localCount
      };
    }

    window.LIV_MIGRATION_CHECK = report;
    return report;
  }

  async function syncContracts(current) {
    const rows = current.contracts
      .filter(item => item?.id)
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        organization_id: mapValue('organization', item.organizationId),
        number: text(item.number ?? item.contractNo) || null,
        name: text(item.name) || null,
        contract_date: dateValue(item.contractDate),
        start_date: dateValue(item.startDate),
        end_date: dateValue(item.endDate),
        active: item.active !== false,
        custom_data: item.customData || {}
      }));
    await upsertRows('contracts', rows, 'external_id');
    await refreshMap('contracts', 'contract', true);
  }

  function structureKey(item) {
    return text(item.signature) || [
      item.buildingId, item.block, item.floor, item.capture, item.axis,
      item.side, item.zone, item.roomNo, item.roomName, item.equipmentName
    ].map(normalized).join('|');
  }

  async function syncStructures(current) {
    const rows = current.structures
      .filter(item => item?.id && mapValue('building', item.buildingId))
      .map(item => {
        const floorText = text(item.floor ?? item.floorNo);
        const floorNumber = /^-?\d+(?:[.,]\d+)?$/.test(floorText)
          ? numberOrNull(floorText)
          : null;
        return {
          external_id: String(item.id),
          project_id: state.projectId,
          building_id: mapValue('building', item.buildingId),
          block_name: text(item.block ?? item.blockName) || null,
          floor_no: floorNumber,
          floor_label: floorText || null,
          capture_name: text(item.capture ?? item.captureName) || null,
          axis_name: text(item.axis ?? item.axisName) || null,
          side_name: text(item.side ?? item.sideName) || null,
          zone_name: text(item.zone ?? item.zoneName) || null,
          room_number: text(item.roomNo ?? item.roomNumber) || null,
          room_name: text(item.roomName) || null,
          equipment_name: text(item.equipmentName) || null,
          fsm_priority: text(item.fsmPriority) || null,
          fsm_status: text(item.fsmStatus) || null,
          structure_key: structureKey(item),
          custom_data: item.customData || {},
          active: item.active !== false
        };
      });
    await upsertRows('structures', rows, 'external_id');
    await refreshMap('structures', 'structure', true);
  }

  async function syncFronts(current) {
    const rows = current.fronts
      .filter(item => item?.id && mapValue('structure', item.structureId) && mapValue('work', item.workId))
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        structure_id: mapValue('structure', item.structureId),
        work_id: mapValue('work', item.workId),
        organization_id: mapValue('organization', item.organizationId),
        responsible_name: text(item.responsible ?? item.responsibleName) || null,
        status: validFrontStatus(item.status),
        contract_start: dateValue(item.contractStart),
        contract_end: dateValue(item.contractEnd),
        baseline_start: dateValue(item.baselineStart),
        baseline_end: dateValue(item.baselineEnd),
        plan_start: dateValue(item.planStart),
        plan_end: dateValue(item.planEnd),
        fact_start: dateValue(item.factStart),
        fact_end: dateValue(item.factEnd),
        forecast_end: dateValue(item.forecastEnd),
        unit: text(item.unit) || null,
        total_qty: numberOrNull(item.totalQty),
        done_qty: numberOrNull(item.doneQty) || 0,
        completed: item.completed === true || item.status === 'Завершено',
        completed_date: dateValue(item.completedDate ?? item.factEnd),
        presented: item.presented === true,
        presented_date: dateValue(item.presentedDate),
        accepted: item.accepted === true,
        accepted_date: dateValue(item.acceptedDate),
        returned: item.returned === true,
        returned_date: dateValue(item.returnedDate),
        public_comment: text(item.comment ?? item.publicComment) || null,
        custom_data: {
          ...(item.customData || {}),
          constraint: text(item.constraint) || undefined,
          originMatrixId: item.originMatrixId || undefined,
          sourceFingerprint: item.importFingerprint || item.sourceFingerprint || undefined
        },
        source_batch_id: mapValue('importBatch', item.source?.batchId ?? item.lastImport?.batchId),
        source_file: text(item.source?.file ?? item.lastImport?.file) || null,
        source_sheet: text(item.source?.sheet ?? item.lastImport?.sheet) || null,
        source_row: integer(item.source?.row ?? item.lastImport?.row, 0) || null,
        active: item.active !== false
      }));
    await upsertRows('fronts', rows, 'external_id');
    await refreshMap('fronts', 'front', true);
  }

  async function syncMatrices(current) {
    const rows = current.matrices
      .filter(item => item?.id && item?.name)
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        name: text(item.name),
        source_type: text(item.sourceType) || 'manual',
        source_file: text(item.sourceFile) || null,
        view_config: {
          ...(item.viewConfig || {}),
          sourceSheet: item.sourceSheet || undefined,
          lastImportId: item.lastImportId || undefined
        },
        active: item.active !== false
      }));
    await upsertRows('matrices', rows, 'external_id');
    await refreshMap('matrices', 'matrix', true);

    const links = current.matrixFronts
      .filter(item => item?.matrixId && item?.frontId)
      .map(item => ({
        matrix_id: mapValue('matrix', item.matrixId),
        front_id: mapValue('front', item.frontId),
        active: item.active !== false
      }))
      .filter(item => item.matrix_id && item.front_id);

    if (links.length) {
      const result = await client().from('matrix_fronts').upsert(links, {
        onConflict: 'matrix_id,front_id',
        ignoreDuplicates: false
      });
      if (result.error) throw result.error;
    }
  }

  function targetFromTitle(title) {
    const raw = text(title).replace(/\u00a0/g, ' ');
    const patterns = [
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:буронабивн\w*|буросекущ\w*|грунтов\w*)\s+(?:сва|анкер)/i,
      /(\d[\d\s]*)\s*(?:\([^)]*\)\s*)?(?:сва|анкер)/i,
      /(\d+(?:[.,]\d+)?)\s*(м3|м³|м2|м²|м\.? ?п\.?|шт\.?)/i
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (!match) continue;
      const quantity = numberOrNull(match[1]);
      let unit = match[2] ? text(match[2]) : 'шт.';
      if (/м3|м³/i.test(unit)) unit = 'м³';
      if (/м2|м²/i.test(unit)) unit = 'м²';
      if (/м.*п/i.test(unit)) unit = 'м.п.';
      return { quantity, unit };
    }
    return { quantity: null, unit: '' };
  }

  async function syncMilestones(current) {
    const rows = current.milestones
      .filter(item => item?.id && item?.title)
      .map(item => {
        const inferred = targetFromTitle(item.title);
        return {
          external_id: String(item.id),
          project_id: state.projectId,
          building_id: mapValue('building', item.buildingId),
          organization_id: mapValue('organization', item.organizationId),
          contract_id: mapValue('contract', item.contractId),
          contract_no: text(item.contractNo) || null,
          milestone_no: text(item.milestoneNo) || null,
          work_id: mapValue('work', item.workId),
          front_id: mapValue('front', item.frontId),
          responsible_name: text(item.responsible ?? item.responsibleName) || null,
          block_capture: text(item.blockCapture) || null,
          floor_capture: text(item.floorCapture) || null,
          start_date: dateValue(item.startDate),
          duration_days: integer(item.durationDays, 0) || null,
          imported_deviation: numberOrNull(item.importedDeviation),
          title: text(item.title),
          description: text(item.description) || null,
          contract_date: dateValue(item.contractDate),
          baseline_date: dateValue(item.baselineDate),
          work_date: dateValue(item.workDate),
          forecast_date: dateValue(item.forecastDate),
          fact_date: dateValue(item.factDate),
          status: text(item.status) || 'Не наступила',
          public_comment: text(item.comment ?? item.publicComment) || null,
          correspondence: Array.isArray(item.correspondence) ? item.correspondence : [],
          target_qty: numberOrNull(item.targetQty) ?? inferred.quantity,
          target_unit: text(item.targetUnit) || inferred.unit || null,
          risk_method: text(item.riskMethod) || 'auto',
          risk_window_days: Math.max(1, Math.min(90, integer(item.riskWindowDays, 7))),
          risk_level: ({green:'normal',yellow:'attention',orange:'risk',red:'failure',gray:'unknown',normal:'normal',attention:'attention',risk:'risk',failure:'failure',unknown:'unknown'}[text(item.riskLevel)] || null),
          risk_updated_at: item.riskUpdatedAt || null,
          risk_details: item.riskDetails || {},
          custom_data: {
            ...(item.customData || {}),
            sourceFingerprint: item.sourceFingerprint || undefined,
            responsibility: item.responsibility || undefined,
            riskCalendarId: item.riskCalendarId || undefined,
            elementGroupId: item.elementGroupId || undefined
          },
          source_batch_id: mapValue('importBatch', item.source?.batchId),
          source_file: text(item.source?.file) || null,
          source_sheet: text(item.source?.sheet) || null,
          source_row: integer(item.source?.row, 0) || null,
          active: item.active !== false
        };
      });
    await upsertRows('milestones', rows, 'external_id');
    await refreshMap('milestones', 'milestone', true);
  }

  function buildElementGroups(current) {
    const explicit = current.numberedElementGroups.filter(item => item?.id);
    const groups = [...explicit];
    const elementGroupExternal = new Map();
    const byKey = new Map();

    explicit.forEach(item => {
      const key = [item.buildingId, normalized(item.elementType), normalized(item.groupCode ?? item.code)].join('|');
      byKey.set(key, item);
    });

    current.numberedElements.forEach(element => {
      if (!element?.id) return;
      if (element.groupId) {
        elementGroupExternal.set(String(element.id), String(element.groupId));
        return;
      }
      const groupCode = text(element.groupCode ?? element.mark ?? element.capture ?? element.zone) || 'Основная группа';
      const key = [element.buildingId, normalized(element.elementType), normalized(groupCode)].join('|');
      let group = byKey.get(key);
      if (!group) {
        const externalId = 'NEG-' + hash({
          buildingId: element.buildingId || '',
          elementType: element.elementType || '',
          groupCode
        });
        group = {
          id: externalId,
          buildingId: element.buildingId || '',
          frontId: element.frontId || '',
          elementType: element.elementType || 'Элемент',
          groupCode,
          name: [element.elementType, groupCode].filter(Boolean).join(' · '),
          totalQty: null,
          active: true
        };
        groups.push(group);
        byKey.set(key, group);
      }
      elementGroupExternal.set(String(element.id), String(group.id));
    });

    return { groups, elementGroupExternal };
  }

  async function syncNumberedElements(current) {
    const prepared = buildElementGroups(current);
    const groupRows = prepared.groups
      .filter(item => item?.id && item?.elementType && item?.groupCode)
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        building_id: mapValue('building', item.buildingId),
        front_id: mapValue('front', item.frontId),
        element_type: text(item.elementType),
        group_code: text(item.groupCode ?? item.code),
        name: text(item.name) || null,
        total_qty: integer(item.totalQty, 0) || null,
        unit: text(item.unit) || 'шт.',
        active: item.active !== false
      }));
    await upsertRows('numbered_element_groups', groupRows, 'external_id');
    await refreshMap('numbered_element_groups', 'elementGroup', true);

    const rows = current.numberedElements
      .filter(item => item?.id && item?.elementType && item?.elementNo)
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        element_type: text(item.elementType),
        element_no: text(item.elementNo),
        group_id: mapValue('elementGroup', prepared.elementGroupExternal.get(String(item.id))),
        building_id: mapValue('building', item.buildingId),
        work_id: mapValue('work', item.workId),
        front_id: mapValue('front', item.frontId),
        capture: text(item.capture) || null,
        zone: text(item.zone) || null,
        mark: text(item.mark) || null,
        layer_name: text(item.layerName) || null,
        status: text(item.status) || 'Не начато',
        completed_date: dateValue(item.completedDate),
        comment: text(item.comment) || null,
        active: item.active !== false,
        custom_data: {
          ...(item.customData || {}),
          uniqueScope: item.uniqueScope || 'context',
          sourceFingerprint: item.sourceFingerprint || undefined
        },
        source_batch_id: mapValue('importBatch', item.source?.batchId),
        source_file: text(item.source?.file) || null,
        source_sheet: text(item.source?.sheet) || null,
        source_row: integer(item.source?.row, 0) || null
      }));
    await upsertRows('numbered_elements', rows, 'external_id');
    await refreshMap('numbered_elements', 'numberedElement', true);
  }

  function derivedMetrics(current) {
    const explicit = current.workMetrics.filter(item => item?.id && item?.frontId);
    const explicitFronts = new Set(explicit.map(item => String(item.frontId)));
    const result = [...explicit];

    current.fronts.forEach(front => {
      if (!front?.id || explicitFronts.has(String(front.id))) return;
      if (front.totalQty == null && !front.unit) return;
      const work = current.works.find(item => String(item.id) === String(front.workId));
      result.push({
        id: 'METRIC-' + front.id + '-PRIMARY',
        frontId: front.id,
        code: 'primary',
        name: work?.name || 'Основной объём',
        unit: front.unit || work?.unit || 'ед.',
        targetQty: front.totalQty,
        weight: 1,
        calculationMethod: /шт/i.test(front.unit || work?.unit || '') ? 'elements' : 'quantity',
        sourceBatchId: front.source?.batchId || front.lastImport?.batchId || '',
        isPrimary: true,
        active: front.active !== false
      });
    });
    return result;
  }

  async function syncMetricsAndFacts(current) {
    const metrics = derivedMetrics(current);
    const rows = metrics
      .filter(item => mapValue('front', item.frontId))
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        front_id: mapValue('front', item.frontId),
        code: text(item.code) || 'primary',
        name: text(item.name) || 'Основной объём',
        unit: text(item.unit) || 'ед.',
        target_qty: numberOrNull(item.targetQty),
        weight: numberOrNull(item.weight) ?? 1,
        calculation_method: new Set(['quantity','elements','status','length','area','manual']).has(text(item.calculationMethod)) ? text(item.calculationMethod) : 'quantity',
        source_batch_id: mapValue('importBatch', item.sourceBatchId || item.source?.batchId),
        is_primary: item.isPrimary === true,
        active: item.active !== false
      }));
    await upsertRows('work_metrics', rows, 'external_id');
    await refreshMap('work_metrics', 'metric', true);

    const facts = [];
    current.progressFacts.forEach(item => {
      if (!item?.id && !item?.sourceFingerprint) return;
      const sourceFingerprint = text(item.sourceFingerprint) || 'progress:' + item.id;
      facts.push({
        project_id: state.projectId,
        metric_id: mapValue('metric', item.metricId),
        front_id: mapValue('front', item.frontId),
        numbered_element_id: mapValue('numberedElement', item.numberedElementId),
        fact_date: dateValue(item.factDate ?? item.date),
        fact_type: new Set(['quantity','cumulative_snapshot','status','event']).has(text(item.factType)) ? text(item.factType) : 'quantity',
        quantity: numberOrNull(item.quantity ?? item.qty),
        cumulative_qty: numberOrNull(item.cumulativeQty ?? item.cumulative),
        status: text(item.status) || null,
        people: numberOrNull(item.people),
        comment: text(item.comment) || null,
        source_batch_id: mapValue('importBatch', item.source?.batchId),
        source_file: text(item.source?.file) || null,
        source_sheet: text(item.source?.sheet) || null,
        source_row: integer(item.source?.row, 0) || null,
        source_fingerprint: sourceFingerprint
      });
    });

    current.factLog.forEach(item => {
      if (!item?.frontId || !dateValue(item.date ?? item.factDate)) return;
      const metricExternal = item.metricId || 'METRIC-' + item.frontId + '-PRIMARY';
      const sourceFingerprint = text(item.importFingerprint) || 'legacy-fact:' + (item.id || hash(item));
      facts.push({
        project_id: state.projectId,
        metric_id: mapValue('metric', metricExternal),
        front_id: mapValue('front', item.frontId),
        numbered_element_id: null,
        fact_date: dateValue(item.date ?? item.factDate),
        fact_type: 'quantity',
        quantity: numberOrNull(item.qty ?? item.quantity) || 0,
        cumulative_qty: numberOrNull(item.cumulative ?? item.cumulativeQty),
        status: text(item.status) || null,
        people: numberOrNull(item.people),
        comment: text(item.comment) || null,
        source_batch_id: mapValue('importBatch', item.source?.batchId),
        source_file: text(item.source?.file) || null,
        source_sheet: text(item.source?.sheet) || null,
        source_row: integer(item.source?.row, 0) || null,
        source_fingerprint: sourceFingerprint
      });
    });

    const validFacts = facts.filter(item => item.fact_date && (item.metric_id || item.front_id || item.numbered_element_id));
    await upsertRows(
      'progress_facts',
      validFacts,
      'project_id,source_fingerprint',
      'progress_facts',
      'source_fingerprint'
    );
  }

  function lastTaskDate(current, taskId, type) {
    return [...current.taskDates]
      .filter(item => String(item.taskId) === String(taskId) && item.type === type)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .slice(-1)[0] || {};
  }

  async function syncSchedule(current) {
    const versions = [...current.scheduleVersions]
      .filter(item => item?.id)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

    if (current.tasks.length && !versions.length) {
      versions.push({
        id: 'SVER-LEGACY',
        name: 'Рабочий график',
        status: 'Принят',
        createdAt: new Date().toISOString()
      });
    }

    const nameCounters = new Map();
    const versionRows = versions.map(item => {
      const name = text(item.name ?? item.fileName) || 'Рабочий график';
      const counter = (nameCounters.get(name) || 0) + 1;
      nameCounters.set(name, counter);
      const rawStatus = text(item.status).toLocaleLowerCase('ru-RU');
      const status = /принят|accepted/.test(rawStatus)
        ? 'accepted'
        : /удален|архив|archived/.test(rawStatus)
          ? 'archived'
          : /отклон|rejected/.test(rawStatus)
            ? 'rejected'
            : 'draft';
      return {
        external_id: String(item.id),
        project_id: state.projectId,
        name,
        version_no: integer(item.versionNo, counter),
        source_file: text(item.fileName ?? item.sourceFile) || null,
        source_sheet: text(item.sheetName ?? item.sourceSheet) || null,
        source_format: text(item.sourceType ?? item.sourceFormat) || null,
        import_batch_id: mapValue('importBatch', item.id),
        status,
        effective_date: dateValue(item.effectiveDate),
        accepted_at: item.acceptedAt || null
      };
    });
    await upsertRows('schedule_versions', versionRows, 'external_id');
    await refreshMap('schedule_versions', 'scheduleVersion', true);

    const acceptedVersions = versions.filter(item => /принят|accepted/i.test(text(item.status)));
    const fallbackVersion = acceptedVersions.slice(-1)[0] || versions.slice(-1)[0];
    const taskRows = current.tasks
      .filter(item => item?.id && item?.name)
      .map((item, index) => {
        const versionLocalId = item.versionId || item.sourceImportId || fallbackVersion?.id;
        const versionId = mapValue('scheduleVersion', versionLocalId);
        if (!versionId) return null;
        const working = lastTaskDate(current, item.id, 'working');
        const baseline = lastTaskDate(current, item.id, 'baseline');
        const actual = lastTaskDate(current, item.id, 'actual');
        const buildingId = mapValue('building', item.buildingId) || current.buildings
          .filter(row => normalized(row.name) === normalized(item.building))
          .map(row => mapValue('building', row.id))[0] || null;
        const organizationId = mapValue('organization', item.organizationId) || current.organizations
          .filter(row => normalized(row.name) === normalized(item.organizationName))
          .map(row => mapValue('organization', row.id))[0] || null;
        return {
          external_id: String(item.id),
          project_id: state.projectId,
          version_id: versionId,
          source_task_id: text(item.sourceTaskId) || String(item.id),
          parent_task_id: mapValue('scheduleTask', item.parentTaskId),
          outline_level: integer(item.outlineLevel, 0),
          sort_order: integer(item.sortOrder, index + 1),
          title: text(item.name),
          is_summary: item.isSummary === true,
          is_milestone: item.isMilestone === true || numberOrNull(item.durationAccepted) === 0,
          is_critical: item.isCritical === true,
          duration_days: numberOrNull(item.durationAccepted ?? item.durationDays),
          current_start: dateValue(working.start ?? item.workingStart),
          current_end: dateValue(working.finish ?? item.workingFinish),
          baseline_start: dateValue(baseline.start ?? item.baselineStart),
          baseline_end: dateValue(baseline.finish ?? item.baselineFinish),
          percent_complete: Math.max(0, Math.min(100, numberOrNull(item.progressPercent) || 0)),
          building_id: buildingId,
          work_id: mapValue('work', item.workId),
          front_id: mapValue('front', item.frontId),
          organization_id: organizationId,
          status: text(item.status) || null,
          source_row: integer(item.sourceRow, 0) || null,
          custom_data: {
            block: item.block || undefined,
            floor: item.floor || undefined,
            axis: item.axis || undefined,
            capture: item.capture || undefined,
            zone: item.zone || undefined,
            network: item.network || undefined,
            segment: item.segment || undefined,
            unit: item.unit || undefined,
            predecessorsRaw: item.predecessorsRaw || undefined,
            successorsRaw: item.successorsRaw || undefined,
            actualStart: dateValue(actual.start),
            actualFinish: dateValue(actual.finish),
            comment: item.comment || undefined
          }
        };
      })
      .filter(Boolean);

    await refreshMap('schedule_tasks', 'scheduleTask', true);
    taskRows.forEach(row => {
      const local = current.tasks.find(item => String(item.id) === String(row.external_id));
      row.parent_task_id = mapValue('scheduleTask', local?.parentTaskId);
    });
    await upsertRows('schedule_tasks', taskRows, 'external_id');
    await refreshMap('schedule_tasks', 'scheduleTask', true);

    const parentUpdates = current.tasks
      .filter(item => item.parentTaskId && mapValue('scheduleTask', item.id) && mapValue('scheduleTask', item.parentTaskId))
      .map(item => ({
        id: mapValue('scheduleTask', item.id),
        parent_task_id: mapValue('scheduleTask', item.parentTaskId)
      }));
    for (const update of parentUpdates) {
      const result = await client().from('schedule_tasks').update({ parent_task_id: update.parent_task_id }).eq('id', update.id);
      if (result.error) throw result.error;
    }

    const dependencyRows = current.dependencies
      .map(item => ({
        project_id: state.projectId,
        version_id: mapValue('scheduleVersion', item.versionId || fallbackVersion?.id),
        predecessor_task_id: mapValue('scheduleTask', item.predecessorTaskId ?? item.predecessorId),
        successor_task_id: mapValue('scheduleTask', item.successorTaskId ?? item.successorId),
        link_type: new Set(['FS','SS','FF','SF']).has(text(item.linkType).toUpperCase()) ? text(item.linkType).toUpperCase() : 'FS',
        lag_days: numberOrNull(item.lagDays) || 0,
        source_expression: text(item.sourceExpression) || null
      }))
      .filter(item => item.version_id && item.predecessor_task_id && item.successor_task_id);

    if (dependencyRows.length) {
      const result = await client().from('task_dependencies').upsert(dependencyRows, {
        onConflict: 'version_id,predecessor_task_id,successor_task_id,link_type,lag_days',
        ignoreDuplicates: false
      });
      if (result.error) throw result.error;
    }
  }

  async function syncImportHistory(current) {
    const rows = current.importHistory
      .filter(item => item?.id)
      .map(item => ({
        external_id: String(item.id),
        project_id: state.projectId,
        batch_key: String(item.id),
        file_name: text(item.file ?? item.fileName) || null,
        sheet_name: text(item.sheet ?? item.sheetName) || null,
        import_mode: text(item.mode ?? item.type) || null,
        source_kind: text(item.sourceType) || null,
        target_entity_type: text(item.targetEntityType) || null,
        status: text(item.status) || 'accepted',
        imported_at: item.at || item.createdAt || new Date().toISOString(),
        completed_at: item.completedAt || item.at || item.createdAt || null,
        total_rows: integer(item.rowsTotal ?? item.totalRows, 0),
        created_rows: integer(item.created ?? item.rowsCreated, 0),
        updated_rows: integer(item.updated ?? item.rowsUpdated, 0),
        skipped_rows: integer(item.skipped ?? item.rowsSkipped, 0),
        conflict_rows: integer(item.conflicts ?? item.conflictRows, 0),
        matrix_id: mapValue('matrix', item.matrixId),
        mapping_config: item.mappingConfig || {},
        details: item.details || item
      }));
    await upsertRows('import_log', rows, 'external_id');
    await refreshMap('import_log', 'importBatch', true);
  }

  function resourcePayload(item) {
    const organizationId = mapValue('organization', item.organizationId);
    const resourceDate = dateValue(item.date ?? item.resourceDate);
    if (!organizationId || !resourceDate) return null;
    const externalId = String(item.id || ('RES-' + hash(item)));
    return {
      external_id: externalId,
      project_id: state.projectId,
      resource_date: resourceDate,
      organization_id: organizationId,
      building_id: mapValue('building', item.buildingId),
      front_id: mapValue('front', item.frontId),
      work_id: mapValue('work', item.workId),
      itr: Math.max(0, integer(item.itr, 0)),
      workers: Math.max(0, integer(item.workers, 0)),
      mechanizers: Math.max(0, integer(item.mechanizers, 0)),
      specialization: text(item.specialization) || null,
      people_qty: Math.max(0, integer(item.peopleQty, integer(item.itr, 0) + integer(item.workers, 0) + integer(item.mechanizers, 0))),
      equipment_name: text(item.equipmentName ?? item.equipmentType) || null,
      equipment_qty: Math.max(0, numberOrNull(item.equipmentQty) || 0),
      comment: text(item.comment) || null
    };
  }

  async function syncResourcesBackground(current) {
    if (state.resourceRunning || !canWrite() || !current.resources.length) return;
    state.resourceRunning = true;
    try {
      const rows = current.resources.map(resourcePayload).filter(Boolean);
      const pending = changedRows('resource_log', rows);
      if (!pending.length) return;

      let written = 0;
      for (let index = 0; index < pending.length; index += RESOURCE_CHUNK) {
        if (!canWrite()) break;
        const chunk = pending.slice(index, index + RESOURCE_CHUNK);
        setStatus('syncing', 'Ресурсы: ' + Math.min(index + chunk.length, pending.length) + ' / ' + pending.length, {
          resourceProgress: Math.min(index + chunk.length, pending.length),
          resourceTotal: pending.length
        });
        const result = await client().from('resource_log').upsert(chunk, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        });
        if (result.error) throw result.error;
        markRows('resource_log', chunk);
        written += chunk.length;
        saveHashes();
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (
        written &&
        state.status !==
          'error'
      ) {
        setStatus(
          'ready',
          'Серверная база синхронизирована'
        );
      }
    } catch (error) {
      console.error('LIV normalized sync: resource migration failed', error);
      setStatus('error', 'Ошибка переноса ресурсов');
    } finally {
      state.resourceRunning = false;
    }
  }

  async function runSync(current, options = {}) {
    if (!current || !client() || !canWrite()) return false;
    if (state.running) {
      state.queuedProject = current;
      return false;
    }

    state.running = true;
    state.queuedProject = null;
    setStatus('syncing', 'Синхронизация серверной базы...');

    try {
      ensureCollections(current);
      await resolveProjectId();
      await syncStep('Справочники', () => syncDictionaries(current));
      await syncStep('Алиасы и сопоставления', () => syncAliasesAndMappings(current));
      await syncStep('Договоры', () => syncContracts(current));
      await syncStep('Структура зданий', () => syncStructures(current));
      await syncStep('Журнал импорта · база', () => syncImportHistory(current));
      await syncStep('Фронты', () => syncFronts(current));
      await syncStep('Шахматки', () => syncMatrices(current));
      await syncStep('Журнал импорта · связи', () => syncImportHistory(current));
      await syncStep('Ключевые даты', () => syncMilestones(current));
      await syncStep('Номерные элементы', () => syncNumberedElements(current));
      await syncStep('Объёмы и факты', () => syncMetricsAndFacts(current));
      await syncStep('Рабочий график', () => syncSchedule(current));

      const migrationCheck =
        await syncStep(
          'Сверка миграции',
          () => verifyMigration(current)
        );

      saveHashes();

      const failed =
        Object.values(
          migrationCheck
        )
          .filter(
            value =>
              !value.ok
          );

      if (failed.length) {
        setStatus(
          'error',
          'Сверка миграции: есть расхождения'
        );
      } else {
        setStatus(
          'ready',
          'Серверная база синхронизирована'
        );
      }
      setTimeout(() => syncResourcesBackground(current), 50);
      return true;
    } catch (error) {
      console.error('LIV normalized sync failed', error);
      setStatus('error', 'Ошибка серверной синхронизации: ' + (error?.message || error));
      return false;
    } finally {
      state.running = false;
      if (state.queuedProject) {
        const queued = state.queuedProject;
        state.queuedProject = null;
        setTimeout(() => runSync(queued), 100);
      }
    }
  }

  function queue(current) {
    if (!current || !canWrite()) return;
    state.queuedProject = current;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      const queued = state.queuedProject;
      state.queuedProject = null;
      runSync(queued);
    }, SAVE_DELAY);
  }

  async function flush(current) {
    clearTimeout(state.timer);
    return runSync(current || state.queuedProject || localProject());
  }

  function attachToRemoteSync() {
    const remote = remoteSync();
    if (!remote || remote.__normalizedWrapped) return false;

    const originalQueue = remote.queueSave?.bind(remote);
    const originalFlush = remote.flush?.bind(remote);

    remote.queueSave = current => {
      originalQueue?.(current);
      queue(current);
    };

    remote.flush = async current => {
      const snapshotResult = await originalFlush?.(current);
      await flush(current);
      return snapshotResult;
    };

    remote.__normalizedWrapped = true;
    return true;
  }

  function bootstrap() {
    ensureStatusBadge();

    const attachTimer = setInterval(() => {
      if (attachToRemoteSync()) clearInterval(attachTimer);
    }, 100);
    setTimeout(() => clearInterval(attachTimer), 15000);

    const projectTimer = setInterval(() => {
      const current = localProject();
      if (!current || !client()) return;
      clearInterval(projectTimer);
      if (canWrite()) queue(current);
      else setStatus('idle', 'Серверная база: только чтение');
    }, 250);
    setTimeout(() => clearInterval(projectTimer), 20000);
  }

  window.addEventListener('liv-auth-session', event => {
    if (event?.detail?.signedIn) {
      setTimeout(() => {
        attachToRemoteSync();
        const current = localProject();
        if (current && canWrite()) queue(current);
      }, 250);
    } else {
      setStatus('idle', 'Серверная база: нет входа');
    }
  });

  window.addEventListener('liv-remote-project', () => {
    const current = localProject();
    if (current && canWrite()) queue(current);
  });

  window.LIV_NORMALIZED_SYNC = {
    version: MODULE_VERSION,
    queue,
    flush,
    run: runSync,
    syncResources: () => syncResourcesBackground(localProject()),
    state: () => ({ ...state, maps: undefined, hashes: undefined }),
    projectId: () => state.projectId,
    serverId: mapValue,
    inferMilestoneTarget: targetFromTitle,
    verifyMigration:
      () =>
        verifyMigration(
          localProject()
        )
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
