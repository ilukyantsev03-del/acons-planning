'use strict';
/* Presentation only. Existing controls retain their nodes, listeners and data. */
(function () {
  function mount() {
    const main = document.querySelector('main.container');
    const actions = document.querySelector('.top-actions');
    const nav = document.querySelector('nav.tabs');
    if (!main || !actions || !nav || document.getElementById('responsiveNavToggle')) return;
    const mobile = window.matchMedia('(max-width: 760px)');
    function toggleFor(target, id, label) {
      if (!target.id) target.id = id + 'Panel';
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'btn responsive-toggle no-print';
      button.setAttribute('aria-controls', target.id);
      button.textContent = label;
      const set = open => {
        target.dataset.responsiveOpen = String(open);
        button.setAttribute('aria-expanded', String(open));
      };
      button.addEventListener('click', () => set(target.dataset.responsiveOpen !== 'true'));
      set(false);
      return { button, set };
    }
    const a = toggleFor(actions, 'responsiveActionsToggle', 'Действия с проектом');
    a.button.classList.add('responsive-actions-toggle');
    actions.parentNode.insertBefore(a.button, actions);
    const n = toggleFor(nav, 'responsiveNavToggle', 'Разделы');
    n.button.classList.add('responsive-nav-toggle');
    nav.parentNode.insertBefore(n.button, nav);
    function updateLabel() {
      const active = nav.querySelector('.tab.active');
      const title = active?.textContent.trim();
      n.button.textContent = title ? 'Разделы · ' + title + ' ▾' : 'Разделы ▾';
    }
    nav.addEventListener('click', event => {
      if (!mobile.matches || !event.target.closest('.tab')) return;
      n.set(false);
      n.button.focus({ preventScroll: true });
    });
    function closeOnEscape(event) {
      if (event.key !== 'Escape' || !mobile.matches) return;
      if (nav.contains(document.activeElement)) { n.set(false); n.button.focus(); }
      if (actions.contains(document.activeElement)) { a.set(false); a.button.focus(); }
    }
    document.addEventListener('keydown', closeOnEscape);
    function resize() {
      for (const [target, menu] of [[nav, n], [actions, a]]) {
        if (mobile.matches && target.contains(document.activeElement)) menu.button.focus({ preventScroll: true });
        menu.set(!mobile.matches);
      }
    }
    mobile.addEventListener('change', resize);
    new MutationObserver(updateLabel).observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // Older modules include bare tables; give each one its own scroll region.
    function tables() {
      for (const table of main.querySelectorAll('table')) {
        if (table.closest('.table-wrap, .responsive-table-scroll, .gantt-scroll, .daily-grid, .planning-load')) continue;
        const wrap = document.createElement('div');
        wrap.className = 'responsive-table-scroll';
        wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', 'Таблица — горизонтальная прокрутка');
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    }
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => { queued = false; tables(); });
    }).observe(main, { childList: true, subtree: true });
    tables(); updateLabel(); resize();
    document.documentElement.classList.add('responsive-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
