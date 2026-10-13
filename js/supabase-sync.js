'use strict';

(function () {
  const SNAPSHOT_KEY = 'project_snapshot';
  const WRITER_ROLES = new Set(['admin', 'planner']);

  let saveTimer = null;
  let channel = null;
  let role = '';
  let userId = '';
  let applyingRemote = false;

  function sb() {
    return window.LIV_SUPABASE || null;
  }

  function canWrite() {
    return WRITER_ROLES.has(role);
  }

  async function waitForSession() {
    const client = sb();
    if (!client) return null;

    for (let i = 0; i < 20; i++) {
      const result = await client.auth.getSession();
      const session = result?.data?.session || null;
      if (session?.user) return session;
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return null;
  }

  async function loadProfile(id) {
    const client = sb();
    if (!client || !id) return null;

    const result = await client
      .from('app_users')
      .select('id, role, active')
      .eq('id', id)
      .maybeSingle();

    if (result.error) {
      console.warn('LIV Supabase: profile load failed', result.error);
      return null;
    }

    return result.data || null;
  }

  async function readSnapshot() {
    const client = sb();
    if (!client) return null;

    const result = await client
      .from('liv_settings')
      .select('value, updated_at, updated_by')
      .eq('key', SNAPSHOT_KEY)
      .maybeSingle();

    if (result.error) {
      console.warn('LIV Supabase: snapshot read failed', result.error);
      return null;
    }

    return result.data || null;
  }

  async function writeSnapshot(project) {
    const client = sb();

    if (!client || !project || !userId || !canWrite() || applyingRemote) {
      return false;
    }

    const now = new Date().toISOString();

    const result = await client
      .from('liv_settings')
      .upsert(
        {
          key: SNAPSHOT_KEY,
          value: {
            schemaVersion: project.schemaVersion || '',
            savedAt: now,
            project
          },
          updated_by: userId,
          updated_at: now
        },
        { onConflict: 'key' }
      );

    if (result.error) {
      console.error('LIV Supabase: snapshot save failed', result.error);
      return false;
    }

    return true;
  }

  async function bootstrap(localProject) {
    const session = await waitForSession();

    if (!session?.user) {
      return {
        project: localProject,
        online: false,
        role: ''
      };
    }

    userId = session.user.id;

    const profile = await loadProfile(userId);
    role = profile?.role || '';

    const snapshot = await readSnapshot();

    if (snapshot?.value?.project) {
      return {
        project: snapshot.value.project,
        online: true,
        role,
        remoteUpdatedAt: snapshot.updated_at || ''
      };
    }

    if (canWrite() && localProject) {
      await writeSnapshot(localProject);
    }

    return {
      project: localProject,
      online: true,
      role,
      firstUpload: canWrite()
    };
  }

  function queueSave(project) {
    if (!project || !canWrite() || applyingRemote) return;

    clearTimeout(saveTimer);

    saveTimer = setTimeout(
      () => {
        writeSnapshot(project);
      },
      500
    );
  }

  async function flush(project) {
    clearTimeout(saveTimer);
    return writeSnapshot(project);
  }

  function subscribe() {
    const client = sb();

    if (!client || channel) return;

    channel = client
      .channel('liv-project-snapshot')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'liv_settings',
          filter: 'key=eq.' + SNAPSHOT_KEY
        },
        payload => {
          const row = payload?.new || {};

          if (!row?.value?.project) return;

          if (
            row.updated_by &&
            userId &&
            String(row.updated_by) === String(userId)
          ) {
            return;
          }

          window.dispatchEvent(
            new CustomEvent(
              'liv-remote-project',
              {
                detail: {
                  project: row.value.project,
                  updatedAt: row.updated_at || ''
                }
              }
            )
          );
        }
      )
      .subscribe();
  }

  async function reconnect(localProject) {
    const client = sb();

    if (
      channel &&
      client
    ) {
      try {
        await client.removeChannel(
          channel
        );
      } catch (error) {
        console.warn(
          'LIV Supabase: channel reset failed',
          error
        );
      }
    }

    channel = null;
    role = '';
    userId = '';

    const state =
      await bootstrap(
        localProject
      );

    subscribe();

    return state;
  }

  function disconnect() {
    role = '';
    userId = '';

    if (
      channel &&
      sb()
    ) {
      sb()
        .removeChannel(
          channel
        )
        .catch(
          () => {}
        );
    }

    channel = null;
  }

  window.LIV_REMOTE_SYNC = {
    bootstrap,
    reconnect,
    disconnect,
    queueSave,
    flush,
    subscribe,
    beginRemoteApply: () => {
      applyingRemote = true;
    },
    endRemoteApply: () => {
      applyingRemote = false;
    },
    canWrite,
    role: () => role,
    userId: () => userId
  };
})();
