'use strict';

(function () {
  const VERSION = '2026.10.13.2';
  const state = {
    loaded: false,
    loading: false,
    flushing: false,
    timer: null,
    localSaveTimer: null
  };

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

  function normalized(value) {
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

  function ensureCollection() {
    const current = currentProject();
    if (!current) return null;
    if (!Array.isArray(current.sourceMappings)) current.sourceMappings = [];
    return current.sourceMappings;
  }

  function identity(mapping) {
    return [
      normalized(mapping.sourceName),
      normalized(mapping.sourceEntityType),
      normalized(mapping.sourceValue)
    ].join('|');
  }

  function queueLocalSave() {
    if (state.loading || typeof saveProject !== 'function') return;
    clearTimeout(state.localSaveTimer);
    state.localSaveTimer = setTimeout(() => {
      saveProject().catch(error =>
        console.warn('LIV source mappings: не удалось сохранить локальную память.', error)
      );
    }, 350);
  }

  function remember(input, options = {}) {
    const collection = ensureCollection();
    if (!collection || !input?.sourceValue || !input?.targetLocalId) return null;

    const candidate = {
      id: input.id || uidValue('MAP'),
      sourceName: text(input.sourceName) || 'manual',
      sourceEntityType: text(input.sourceEntityType),
      sourceValue: text(input.sourceValue),
      normalizedSourceValue: normalized(input.sourceValue),
      targetEntityType: text(input.targetEntityType),
      targetLocalId: String(input.targetLocalId),
      confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 1,
      decision: text(input.decision) || 'confirmed',
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: input.updatedAt || new Date().toISOString()
    };

    let existing = collection.find(item => identity(item) === identity(candidate));
    if (existing) {
      Object.assign(existing, candidate, {
        id: existing.id,
        createdAt: existing.createdAt || candidate.createdAt
      });
    } else {
      existing = candidate;
      collection.push(existing);
    }

    if (!options.fromServer) {
      queueLocalSave();
      queueFlush();
    }
    return existing;
  }

  function resolve(sourceName, sourceEntityType, sourceValue, targetEntityType = '') {
    const collection = ensureCollection() || [];
    const sourceKey = normalized(sourceName);
    const typeKey = normalized(sourceEntityType);
    const valueKey = normalized(sourceValue);
    return collection.find(item =>
      normalized(item.sourceName) === sourceKey &&
      normalized(item.sourceEntityType) === typeKey &&
      normalized(item.sourceValue) === valueKey &&
      (!targetEntityType || normalized(item.targetEntityType) === normalized(targetEntityType))
    ) || null;
  }

  function entityConfig(entityType) {
    return {
      organization: { table: 'organizations', collection: 'organizations', map: 'organization' },
      building: { table: 'buildings', collection: 'buildings', map: 'building' },
      work: { table: 'works', collection: 'works', map: 'work' },
      contract: { table: 'contracts', collection: 'contracts', map: 'contract' },
      front: { table: 'fronts', collection: 'fronts', map: 'front' },
      milestone: { table: 'milestones', collection: 'milestones', map: 'milestone' },
      numbered_element: { table: 'numbered_elements', collection: 'numberedElements', map: 'numberedElement' }
    }[entityType] || null;
  }

  async function serverToLocalMap(entityType, serverIds) {
    const config = entityConfig(entityType);
    const current = currentProject();
    if (!config || !current || !serverIds.length) return new Map();

    const result = await window.LIV_SUPABASE
      .from(config.table)
      .select('id,external_id')
      .in('id', serverIds);
    if (result.error) throw result.error;

    const localIds = new Set((current[config.collection] || []).map(item => String(item.id)));
    return new Map(
      (result.data || [])
        .filter(row => row.external_id && localIds.has(String(row.external_id)))
        .map(row => [String(row.id), String(row.external_id)])
    );
  }

  async function loadServerMappings() {
    if (state.loaded || state.loading) return;
    const client = window.LIV_SUPABASE;
    const normalizer = window.LIV_NORMALIZED_SYNC;
    const projectId = normalizer?.projectId?.();
    if (!client || !projectId) return;

    state.loading = true;
    try {
      const result = await client
        .from('source_mappings')
        .select('id,source_name,source_entity_type,source_value,normalized_source_value,target_entity_type,target_entity_id,confidence,decision,created_at,updated_at')
        .eq('project_id', projectId)
        .range(0, 4999);
      if (result.error) throw result.error;

      const rows = result.data || [];
      const types = [...new Set(rows.map(row => row.target_entity_type).filter(Boolean))];
      const maps = {};

      for (const type of types) {
        const ids = [...new Set(
          rows
            .filter(row => row.target_entity_type === type)
            .map(row => String(row.target_entity_id))
        )];
        maps[type] = await serverToLocalMap(type, ids);
      }

      rows.forEach(row => {
        const targetLocalId = maps[row.target_entity_type]?.get(String(row.target_entity_id)) || '';
        if (!targetLocalId) return;
        remember({
          id: row.id,
          sourceName: row.source_name,
          sourceEntityType: row.source_entity_type,
          sourceValue: row.source_value,
          targetEntityType: row.target_entity_type,
          targetLocalId,
          confidence: row.confidence,
          decision: row.decision,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }, { fromServer: true });
      });
      state.loaded = true;
      queueLocalSave();
    } catch (error) {
      console.warn('LIV source mappings: не удалось загрузить сопоставления.', error);
    } finally {
      state.loading = false;
    }
  }

  function serverId(entityType, localId) {
    const config = entityConfig(entityType);
    return config
      ? window.LIV_NORMALIZED_SYNC?.serverId?.(config.map, localId) || ''
      : '';
  }

  async function flush() {
    if (state.flushing || !window.LIV_REMOTE_SYNC?.canWrite?.()) return;
    const client = window.LIV_SUPABASE;
    const normalizer = window.LIV_NORMALIZED_SYNC;
    const projectId = normalizer?.projectId?.();
    const collection = ensureCollection();
    if (!client || !projectId || !collection?.length) return;

    state.flushing = true;
    try {
      const rows = collection.map(item => {
        const targetEntityId = serverId(item.targetEntityType, item.targetLocalId);
        if (!targetEntityId) return null;
        return {
          project_id: projectId,
          source_name: text(item.sourceName) || 'manual',
          source_entity_type: text(item.sourceEntityType),
          source_value: text(item.sourceValue),
          normalized_source_value: normalized(item.sourceValue),
          target_entity_type: text(item.targetEntityType),
          target_entity_id: targetEntityId,
          confidence: Number(item.confidence || 1),
          decision: text(item.decision) || 'confirmed',
          updated_at: item.updatedAt || new Date().toISOString()
        };
      }).filter(Boolean);

      if (!rows.length) return;
      const result = await client.from('source_mappings').upsert(rows, {
        onConflict: 'project_id,source_name,source_entity_type,normalized_source_value',
        ignoreDuplicates: false
      });
      if (result.error) throw result.error;
    } catch (error) {
      console.warn('LIV source mappings: не удалось сохранить сопоставления.', error);
    } finally {
      state.flushing = false;
    }
  }

  function queueFlush() {
    clearTimeout(state.timer);
    state.timer = setTimeout(flush, 900);
  }

  window.addEventListener('liv-normalized-sync-status', event => {
    if (event.detail?.status !== 'ready') return;
    loadServerMappings();
    queueFlush();
  });

  window.addEventListener('liv-auth-session', event => {
    if (event.detail?.signedIn) setTimeout(loadServerMappings, 500);
  });

  window.LIV_SOURCE_MAPPINGS = {
    version: VERSION,
    remember,
    resolve,
    flush,
    load: loadServerMappings
  };
})();
