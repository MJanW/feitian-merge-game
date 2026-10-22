(function (root) {
  'use strict';
  function initGarden(document, window) {
    const $ = id => document.getElementById(id), canvas = $('garden-canvas');
    if (!canvas) return null;
    let game = null, renderer = null, audio = null, state = null, active = false, manualPaused = false;
    let selected = 'shooter', shovel = false, hover = null, pointer = null, pendingLevel = null;
    let frame = null, lastFrame = null, destroyed = false, notice = '', noticeUntil = 0;
    const cards = new Map(), levelButtons = [], listeners = [], completed = new Set();
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let soundEnabled = typeof window.GameSoundEnabled === 'boolean' ? window.GameSoundEnabled : read('photo-merge-sound', 'on') !== 'off';
    try { const saved = JSON.parse(read('feitian-garden-classic-completed-v1', '[]')); if (Array.isArray(saved)) saved.filter(n => Number.isInteger(n) && n >= 0 && n < (window.GardenGame?.LEVELS.length || 4)).forEach(n => completed.add(n)); } catch (_) {}
    function read(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } }
    function write(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} }
    function listen(target, type, fn, opts) { target?.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
    function text(id, value) { const node = $(id); if (node && node.textContent !== String(value)) node.textContent = String(value); }
    function attr(node, name, value) { if (node?.getAttribute(name) !== String(value)) node?.setAttribute(name, String(value)); }
    function blocked() { return !active || document.hidden || manualPaused || Boolean(document.querySelector('dialog[open]')); }
    function audioCall(method, ...args) { try { const p = audio?.[method]?.(...args); if (p?.catch) p.catch(() => {}); } catch (_) {} }
    function unlock() { if (active) audioCall('unlock'); }
    function now() { return window.performance?.now?.() || Date.now(); }
    function showNotice(message) { notice = message; noticeUntil = now() + 2700; refresh(); }
    function soundUI() { text('garden-sound', soundEnabled ? '音效开' : '音效关'); attr($('garden-sound'), 'aria-pressed', soundEnabled); }
    function level() { return window.GardenGame.LEVELS[state?.levelIndex || 0]; }
    function available(type) { const config = level(); return (!config.cards || config.cards.includes(type)) && (state?.tutorialReady !== false || type === config.tutorialGate?.type); }
    function onEvent(event) {
      const sounds = { plant: 'hatch', shot: 'shoot', hit: 'supplyHit', collect: 'kill', explode: 'special', mower: 'special', win: 'upgrade', lose: 'lose' };
      if (active && !blocked() && sounds[event.type]) audioCall('play', { ...event, type: sounds[event.type] });
      if (event.type === 'win') {
        const index = game?.levelIndex ?? state?.levelIndex ?? 0;
        completed.add(index); write('feitian-garden-classic-completed-v1', JSON.stringify([...completed]));
      }
      if (event.type === 'wave' && game) showNotice('新一波入侵者来了，检查每条小路的防线。');
    }
    function makeDeck() {
      for (const [i, plant] of window.GardenGame.PLANTS.entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-seed';
        attr(button, 'aria-pressed', false); attr(button, 'title', `${plant.name} · ${plant.cost}阳光 · ${plant.description}`);
        attr(button, 'aria-label', `${plant.name}，${plant.cost}阳光，${plant.description}`);
        const key = document.createElement('span'); key.className = 'garden-seed-key'; key.textContent = i + 1;
        const portrait = document.createElement('span'); portrait.className = 'garden-portrait';
        const form = window.GardenForms?.[plant.id] || window.GameLevels?.levels?.[plant.photoIndex];
        if (form) {
          const img = document.createElement('img'); img.src = form.image; img.alt = ''; img.draggable = false;
          const [x, y, w, h] = form.frame || [0, 0, 1, 1], [iw, ih] = form.imageSize || [w, h], side = Math.max(w, h);
          img.style.width = `${iw / side * 100}%`; img.style.height = `${ih / side * 100}%`;
          img.style.left = `${((side - w) / 2 - x) / side * 100}%`; img.style.top = `${((side - h) / 2 - y) / side * 100}%`;
          portrait.appendChild(img);
        }
        const name = document.createElement('strong'); name.textContent = plant.name;
        const footer = document.createElement('small'), cost = document.createElement('span'), status = document.createElement('span');
        cost.textContent = `☀ ${plant.cost}`; status.className = 'garden-seed-status'; footer.append(cost, status);
        button.append(key, portrait, name, footer); $('garden-seeds').appendChild(button);
        cards.set(plant.id, { button, status, plant }); listen(button, 'click', () => choose(plant.id));
      }
      for (const [index, config] of window.GardenGame.LEVELS.entries()) {
        const button = document.createElement('button'); button.type = 'button';
        const number = document.createElement('span'); number.textContent = config.practice ? 'FREE PLAY' : `0${index + 1}`;
        const title = document.createElement('b'); title.textContent = config.title.replace(/^\d+\s*·\s*/, '');
        button.append(number, title); attr(button, 'aria-label', config.practice ? config.title : `第${index + 1}关 ${config.title.replace(/^\d+\s*·\s*/, '')}`);
        $('garden-levels').appendChild(button); levelButtons.push(button); listen(button, 'click', () => requestReset(index));
      }
    }
    function ensure() {
      if (game) return true;
      if (!window.GardenGame || !window.GardenRenderer) { text('garden-status', '花园加载失败，请刷新页面重试。'); return false; }
      game = new window.GardenGame({ onEvent }); state = game.getState();
      renderer = new window.GardenRenderer(canvas, { levels: window.GameLevels?.levels || [], forms: window.GardenForms, reducedMotion, onReady: () => { if (active) draw(); } });
      try { if (window.DefenseAudio) audio = new window.DefenseAudio({ enabled: soundEnabled }); } catch (_) {}
      makeDeck(); refresh(); return true;
    }
    function draw() { if (active && state && renderer) renderer.render(state, { selected, shovel, hover, time: state.elapsed }); }
    function resize() {
      if (!active || !renderer) return;
      pointer = null; hover = null;
      const rect = canvas.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) renderer.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
      draw();
    }
    function refresh() {
      if (!game) return;
      state = game.getState(); const config = level(), running = state.status === 'running';
      text('garden-sun', state.sun); text('garden-level-name', config.title);
      text('garden-level-goal', config.subtitle || '守住五条小路');
      text('garden-wave', state.status === 'ready' ? '准备种植' : state.tutorialReady === false ? '教学布阵' : !state.wave ? `布阵时间 · ${Math.max(0, Math.ceil((state.nextWaveIn ?? ((config.waves?.[0]?.at || 20000) - state.elapsed)) / 1000))}s` : `第 ${state.wave}/${state.totalWaves || 3} 波 · 击退 ${state.kills}`);
      for (const [id, { button, status, plant }] of cards) {
        const cd = state.cooldowns?.[id] || 0, allowed = available(id);
        button.disabled = !allowed; attr(button, 'aria-pressed', selected === id && !shovel);
        attr(button, 'data-unaffordable', state.sun < plant.cost);
        button.style.setProperty('--cooldown', `${Math.min(100, cd / plant.cooldown * 100)}%`);
        const label = !allowed ? config.cards.includes(id) ? '先完成教学' : '后续关卡' : cd > 0 ? `${Math.ceil(cd / 1000)}s` : state.sun < plant.cost ? '缺阳光' : '就绪';
        if (status.textContent !== label) status.textContent = label;
      }
      levelButtons.forEach((button, i) => { attr(button, 'aria-current', state.levelIndex === i); attr(button, 'data-complete', completed.has(i)); });
      $('garden-pause').disabled = !['running', 'paused'].includes(state.status);
      $('garden-shovel').disabled = config.shovel === false;
      attr($('garden-shovel'), 'title', config.shovel === false ? '自由演练中可使用铲除工具' : '移除一位同伴，不返还阳光');
      text('garden-pause', state.status === 'paused' ? '继续' : '暂停'); attr($('garden-pause'), 'aria-pressed', state.status === 'paused');
      attr($('garden-shovel'), 'aria-pressed', shovel);
      const plant = cards.get(selected)?.plant;
      text('garden-selected-name', shovel ? '铲除工具' : plant ? `${plant.name} · ${plant.cost} 阳光` : '选择一位同伴');
      text('garden-status', noticeUntil > now() ? notice : state.tutorialReady === false && state.status === 'running' ? state.tutorialHint : shovel ? '点击已种植的角色铲除。铲除不返还阳光。' : plant?.description || '选择角色，再点击空格种植。');
      $('garden-overlay').hidden = running;
      const secondary = $('garden-overlay-secondary'); secondary.hidden = !['won', 'lost'].includes(state.status);
      text('garden-overlay-secondary', state.status === 'lost' ? '重新布阵' : '再玩本关');
      if (state.status === 'ready') {
        text('garden-overlay-kicker', config.practice ? '自由演练 / 六位同伴全部开放' : `第 ${state.levelIndex + 1} 关 / ${config.title.replace(/^\d+\s*·\s*/, '')}`);
        text('garden-overlay-title', '今天，守住花园。');
        text('garden-overlay-copy', config.subtitle || '先种采光员收集阳光，再在每条小路安排射手。'); text('garden-start', '开始种植 ↗');
      } else if (state.status === 'paused') {
        text('garden-overlay-kicker', '花园已暂停'); text('garden-overlay-title', '歇一会，阳光还在。');
        text('garden-overlay-copy', '同伴和入侵者都会等你回来。'); text('garden-start', '继续守护 ↗');
      } else if (state.status === 'won') {
        text('garden-overlay-kicker', `第 ${state.levelIndex + 1} 关完成 · 击退 ${state.kills}`); text('garden-overlay-title', '这一片晴天，守住了。');
        const next = window.GardenGame.LEVELS[state.levelIndex + 1];
        text('garden-overlay-copy', next ? next.practice ? '基础关卡已完成。自由演练开放五行草地、六位同伴和铲除工具。' : `获得新同伴，下一关：${next.subtitle}` : '六位同伴都已登场。可以重试演练，或回到前面的关卡。');
        text('garden-start', next ? next.practice ? '进入自由演练 ↗' : '进入下一关 ↗' : '再守一轮 ↗');
      } else if (state.status === 'lost') {
        text('garden-overlay-kicker', `击退 ${state.kills} 位入侵者`); text('garden-overlay-title', '花园需要你再试一次。');
        text('garden-overlay-copy', '先建立阳光供给，给每条小路配上射手，盾卫放在前面。'); text('garden-start', '再试一次 ↗');
      }
      soundUI();
    }
    function stopFrame() { if (frame !== null) window.cancelAnimationFrame?.(frame); frame = null; lastFrame = null; }
    function schedule() { if (frame === null && active && !blocked() && state?.status === 'running' && !destroyed) frame = window.requestAnimationFrame(tick); }
    function tick(timestamp) {
      frame = null; if (destroyed || blocked()) { syncPause(); return; }
      const dt = lastFrame === null ? 0 : Math.max(0, Math.min(100, timestamp - lastFrame)); lastFrame = timestamp;
      game.step(dt); refresh(); draw(); schedule();
    }
    function syncPause() {
      stopFrame(); if (!game) return;
      game.pause(blocked()); if (blocked()) audioCall('pause');
      refresh(); draw(); schedule();
    }
    function choose(id) {
      if (!active || !game || !available(id) || document.querySelector('dialog[open]')) return;
      unlock(); selected = selected === id && !shovel ? null : id; shovel = false; refresh(); draw();
    }
    function reset(index) {
      stopFrame(); audioCall('pause'); manualPaused = false; pointer = null; hover = null; shovel = false; notice = ''; noticeUntil = 0;
      game.reset(index); selected = game.level.cards.includes('sun') ? 'sun' : 'shooter'; refresh(); resize();
    }
    function requestReset(index) {
      if (!active || !game || document.querySelector('dialog[open]')) return;
      if (['running', 'paused'].includes(state.status)) { pendingLevel = index; $('garden-confirm').showModal(); syncPause(); }
      else reset(index);
    }
    function start() {
      if (!active || !ensure() || document.querySelector('dialog[open]')) return;
      unlock();
      if (state.status === 'won') reset(state.levelIndex < window.GardenGame.LEVELS.length - 1 ? state.levelIndex + 1 : state.levelIndex);
      else if (state.status === 'lost') reset(state.levelIndex);
      manualPaused = false; if (state.status === 'ready') game.start();
      syncPause(); canvas.focus({ preventScroll: true });
    }
    function togglePause() {
      if (!active || !game || !['running', 'paused'].includes(state.status) || document.querySelector('dialog[open]')) return;
      manualPaused = !manualPaused; syncPause();
    }
    function act(cell) {
      if (!cell || blocked() || state?.status !== 'running') return;
      if (level().activeRows && !level().activeRows.includes(cell.row)) { showNotice('这条草地尚未开放，请种在亮色草坪上。'); return; }
      if (shovel) {
        if (game.remove(cell.row, cell.col)) showNotice('已腾出位置，可以重新种植。');
        else showNotice('这个位置没有角色。');
      } else if (selected) {
        const plant = cards.get(selected).plant;
        if (state.cooldowns[selected] > 0) showNotice(`${plant.name}还需冷却 ${Math.ceil(state.cooldowns[selected] / 1000)} 秒。`);
        else if (state.sun < plant.cost) showNotice(`还差 ${plant.cost - state.sun} 阳光，先收集金色太阳。`);
        else if (game.plant(selected, cell.row, cell.col)) { selected = null; showNotice('种植成功。继续收集阳光，照顾其他小路。'); }
        else showNotice('这个位置已经有同伴了，换个空格试试。');
      } else showNotice('先点击上方的角色卡，再选择草地。');
      refresh(); draw();
    }
    listen(canvas, 'pointerdown', event => {
      if (pointer || event.isPrimary === false || event.button != null && event.button !== 0 || !active || blocked() || state?.status !== 'running') return;
      unlock(); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    listen(canvas, 'pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId || event.isPrimary === false) return;
      const previous = pointer; pointer = null;
      if ( Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 15 || blocked()) return;
      const id = renderer.sunAt(event.clientX, event.clientY, state);
      if (id != null && game.collectSun(id)) { refresh(); draw(); return; }
      hover = renderer.cellAt(event.clientX, event.clientY); act(hover);
    });
    listen(canvas, 'pointermove', event => { if (!active || !renderer) return; hover = renderer.cellAt(event.clientX, event.clientY); if (state?.status !== 'running') draw(); });
    listen(canvas, 'pointerleave', () => { pointer = null; hover = null; draw(); });
    listen(canvas, 'pointercancel', () => { pointer = null; hover = null; draw(); });
    listen($('garden-start'), 'click', start);
    listen($('garden-overlay-secondary'), 'click', () => { if (active) reset(state.levelIndex); });
    listen($('garden-pause'), 'click', togglePause);
    listen($('garden-restart'), 'click', () => requestReset(state.levelIndex));
    listen($('garden-shovel'), 'click', () => { if (!active || level().shovel === false || document.querySelector('dialog[open]')) return; shovel = !shovel; selected = null; refresh(); draw(); });
    listen($('garden-confirm-cancel'), 'click', () => { pendingLevel = null; $('garden-confirm').close(); });
    listen($('garden-confirm-ok'), 'click', () => { const index = pendingLevel; pendingLevel = null; $('garden-confirm').close(); if (index != null) reset(index); });
    listen($('garden-confirm'), 'close', () => { pendingLevel = null; syncPause(); });
    listen($('garden-sound'), 'click', () => { unlock(); soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled; write('photo-merge-sound', soundEnabled ? 'on' : 'off'); audioCall('setEnabled', soundEnabled); soundUI(); window.dispatchEvent(new window.Event('feitian-soundchange')); });
    listen(window, 'feitian-soundchange', () => { soundEnabled = window.GameSoundEnabled !== false; audioCall('setEnabled', soundEnabled); soundUI(); });
    listen(document, 'keydown', event => {
      if (!active || !game || event.metaKey || event.ctrlKey || event.altKey || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target?.tagName || '') || document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      if (key === 'p' || key === 'escape') { event.preventDefault(); if (!event.repeat) togglePause(); return; }
      if (key === 'r') { event.preventDefault(); if (!event.repeat) requestReset(state.levelIndex); return; }
      if (blocked() || state.status !== 'running') return;
      unlock();
      if (/^[1-6]$/.test(key)) { event.preventDefault(); if (!event.repeat) choose(window.GardenGame.PLANTS[Number(key) - 1].id); }
      else if (key === 'c') { event.preventDefault(); for (const sun of [...state.suns]) game.collectSun(sun.id); refresh(); draw(); }
      else if (key.startsWith('arrow')) { event.preventDefault(); const cell = hover || { row: 2, col: 0 }; hover = { row: Math.max(0, Math.min(4, cell.row + (key === 'arrowdown' ? 1 : key === 'arrowup' ? -1 : 0))), col: Math.max(0, Math.min(8, cell.col + (key === 'arrowright' ? 1 : key === 'arrowleft' ? -1 : 0))) }; draw(); }
      else if (key === 'enter' || key === ' ') { event.preventDefault(); if (!event.repeat) act(hover || { row: 2, col: 0 }); }
    });
    listen(window, 'feitian-modechange', event => {
      const wasActive = active; active = event.detail?.mode === 'garden'; pointer = null; hover = null;
      if (wasActive && !active && state?.status === 'running') manualPaused = true;
      if (!active && $('garden-confirm').open) $('garden-confirm').close();
      if (active && ensure()) resize(); syncPause();
    });
    const loseFocus = () => { pointer = null; if (active && state?.status === 'running') manualPaused = true; syncPause(); };
    listen(window, 'blur', loseFocus); listen(document, 'visibilitychange', () => { if (document.hidden) loseFocus(); else syncPause(); });
    listen(window, 'resize', resize); listen(window, 'orientationchange', resize); listen(window.visualViewport, 'resize', resize);
    soundUI();
    return { get game() { return game; }, destroy() { destroyed = true; active = false; stopFrame(); audioCall('destroy'); game?.pause(true); for (const [target, type, fn, opts] of listeners) target?.removeEventListener?.(type, fn, opts); } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = initGarden;
  else initGarden(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
