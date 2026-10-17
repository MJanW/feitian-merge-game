(function (root) {
  'use strict';
  function initModes(document, window) {
    const names = ['merge', 'rescue'];
    let current = 'merge';
    const api = {
      get current() { return current; },
      select(name, focus = false) {
        if (!names.includes(name)) return;
        current = name;
        for (const item of names) {
          const tab = document.getElementById('mode-' + item);
          const selected = item === name;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
          document.getElementById(item + '-panel').hidden = !selected;
        }
        document.documentElement.dataset.gameMode = name;
        window.dispatchEvent(new window.CustomEvent('feitian-modechange', { detail: { mode: name } }));
        if (focus) document.getElementById('mode-' + name).focus({ preventScroll: true });
      },
    };
    window.GameModes = api;
    for (const name of names) {
      const tab = document.getElementById('mode-' + name);
      tab.addEventListener('click', () => api.select(name));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        api.select(event.key === 'Home' ? names[0] : event.key === 'End' ? names[1] : names[(names.indexOf(name) + 1) % names.length], true);
      });
    }
    api.select('merge');
    return api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = initModes;
  else initModes(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
