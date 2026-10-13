'use strict';

(function () {
  const cfg = window.ACONS_CONFIG || {};
  const supabaseLib = window.supabase;

  if (!supabaseLib || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    console.error('LIV Auth: Supabase configuration is missing.');
    return;
  }

  const client = supabaseLib.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  window.LIV_SUPABASE = client;

  function injectStyles() {
    if (document.getElementById('liv-auth-style')) return;

    const style = document.createElement('style');
    style.id = 'liv-auth-style';
    style.textContent =
      'body.liv-auth-locked{overflow:hidden;}' +
      '#livAuthOverlay{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;}' +
      '#livAuthOverlay.hidden{display:none;}' +
      '.liv-auth-card{width:min(420px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.10);padding:28px;}' +
      '.liv-auth-card h1{margin:0 0 8px;font-size:28px;}' +
      '.liv-auth-subtitle{margin:0 0 24px;color:#6b7280;font-size:14px;}' +
      '.liv-auth-field{display:grid;gap:7px;margin-bottom:16px;}' +
      '.liv-auth-field label{font-size:13px;font-weight:700;color:#374151;}' +
      '.liv-auth-field input{width:100%;box-sizing:border-box;min-height:44px;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font:inherit;outline:none;}' +
      '.liv-auth-field input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.10);}' +
      '.liv-auth-btn{width:100%;min-height:44px;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;background:#111827;color:#fff;}' +
      '.liv-auth-btn:disabled{opacity:.6;cursor:wait;}' +
      '.liv-auth-error{min-height:20px;margin:14px 0 0;color:#b91c1c;font-size:13px;}' +
      '.liv-auth-user{display:inline-flex;align-items:center;gap:10px;margin-left:8px;min-width:0;}' +
      '.liv-auth-identity{display:inline-flex;align-items:center;min-width:0;gap:6px;}' +
      '.liv-auth-name{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#cbd5e1;}' +
      '.liv-auth-role{white-space:nowrap;font-size:12px;color:#94a3b8;}' +
      '.liv-auth-role:before{content:"· ";}' +
      '.liv-auth-logout{min-height:34px;padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;flex:0 0 auto;}' +
      '@media(max-width:1100px){.liv-auth-user{margin-left:0}.liv-auth-identity{flex-direction:column;align-items:flex-start;gap:2px}.liv-auth-role:before{content:""}.liv-auth-name{max-width:min(70vw,420px)}}' +
      '@media(max-width:680px){.liv-auth-user{width:100%;justify-content:space-between}.liv-auth-identity{min-width:0;flex:1}.liv-auth-name{max-width:100%;font-size:14px}.liv-auth-role{font-size:12px}.liv-auth-logout{min-height:38px}}';

    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById('livAuthOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'livAuthOverlay';
    overlay.innerHTML =
      '<form id="livAuthForm" class="liv-auth-card" autocomplete="on">' +
        '<h1>LIV Planning</h1>' +
        '<p class="liv-auth-subtitle">Вход в систему</p>' +
        '<div class="liv-auth-field">' +
          '<label for="livAuthEmail">Email</label>' +
          '<input id="livAuthEmail" name="email" type="email" autocomplete="username" required>' +
        '</div>' +
        '<div class="liv-auth-field">' +
          '<label for="livAuthPassword">Пароль</label>' +
          '<input id="livAuthPassword" name="password" type="password" autocomplete="current-password" required>' +
        '</div>' +
        '<button id="livAuthSubmit" class="liv-auth-btn" type="submit">Войти</button>' +
        '<div id="livAuthError" class="liv-auth-error"></div>' +
      '</form>';

    document.body.prepend(overlay);

    const form = document.getElementById('livAuthForm');
    const submit = document.getElementById('livAuthSubmit');
    const error = document.getElementById('livAuthError');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const email = String(document.getElementById('livAuthEmail').value || '').trim();
      const password = String(document.getElementById('livAuthPassword').value || '');

      error.textContent = '';
      submit.disabled = true;
      submit.textContent = 'Входим...';

      try {
        const result = await client.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (result.error) {
          throw result.error;
        }
      } catch (err) {
        error.textContent = authErrorText(err);
      } finally {
        submit.disabled = false;
        submit.textContent = 'Войти';
      }
    });

    return overlay;
  }

  function authErrorText(err) {
    const message = String(err && err.message ? err.message : '');

    if (/invalid login credentials/i.test(message)) {
      return 'Неверный email или пароль.';
    }

    if (/email not confirmed/i.test(message)) {
      return 'Email ещё не подтверждён.';
    }

    if (/failed to fetch/i.test(message)) {
      return 'Не удалось связаться с сервером авторизации.';
    }

    return message || 'Не удалось выполнить вход.';
  }

  async function loadProfile(user) {
    try {
      const result = await client
        .from('app_users')
        .select('full_name, role, email')
        .eq('id', user.id)
        .maybeSingle();

      if (result.error) {
        console.warn('LIV Auth: profile load failed', result.error);
        return null;
      }

      return result.data || null;
    } catch (err) {
      console.warn('LIV Auth: profile load failed', err);
      return null;
    }
  }

  function roleLabel(role) {
    const map = {
      admin: 'Администратор',
      planner: 'Планер',
      director: 'Директор',
      project_manager: 'Руководитель проекта',
      responsible: 'Ответственный',
      contractor: 'Подрядчик',
      customer: 'Заказчик'
    };

    return map[role] || role || '';
  }

  async function ensureUserControls(user) {
    let wrap = document.getElementById('livAuthUserControls');

    if (!wrap) {
      const topActions = document.querySelector('.top-actions');
      if (!topActions) return;

      wrap = document.createElement('div');
      wrap.id = 'livAuthUserControls';
      wrap.className = 'liv-auth-user';
      topActions.appendChild(wrap);
    }

    const profile = await loadProfile(user);
    const fullName = profile && profile.full_name ? profile.full_name.trim() : '';
    const role = profile && profile.role ? roleLabel(profile.role) : '';
    const displayName = fullName || user.email || '';

    wrap.textContent = '';

    const identity = document.createElement('div');
    identity.className = 'liv-auth-identity';
    identity.title = user.email || '';

    const name = document.createElement('span');
    name.className = 'liv-auth-name';
    name.textContent = displayName;

    identity.appendChild(name);

    if (role) {
      const roleNode = document.createElement('span');
      roleNode.className = 'liv-auth-role';
      roleNode.textContent = role;
      identity.appendChild(roleNode);
    }

    const logout = document.createElement('button');
    logout.id = 'livAuthLogout';
    logout.className = 'liv-auth-logout';
    logout.type = 'button';
    logout.textContent = 'Выйти';

    logout.addEventListener('click', async function () {
      await client.auth.signOut();
    });

    wrap.appendChild(identity);
    wrap.appendChild(logout);
  }

  function removeUserControls() {
    const wrap = document.getElementById('livAuthUserControls');
    if (wrap) wrap.remove();
  }

  function applySession(session) {
    const overlay = ensureOverlay();

    if (session && session.user) {
      overlay.classList.add('hidden');
      document.body.classList.remove('liv-auth-locked');
      ensureUserControls(session.user);
    } else {
      overlay.classList.remove('hidden');
      document.body.classList.add('liv-auth-locked');
      removeUserControls();

      const password = document.getElementById('livAuthPassword');
      if (password) password.value = '';
    }
  }

  async function init() {
    injectStyles();
    ensureOverlay();
    document.body.classList.add('liv-auth-locked');

    const result = await client.auth.getSession();

    if (result.error) {
      console.error('LIV Auth: session check failed', result.error);
      applySession(null);
    } else {
      applySession(result.data.session);
    }

    client.auth.onAuthStateChange(function (_event, session) {
      applySession(session);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
