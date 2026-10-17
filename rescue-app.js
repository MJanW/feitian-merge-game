(function (root) {
  'use strict';
  function initRescue(document, window) {
    const $ = id => document.getElementById(id);
    const BEST_PREFIX = 'feitian-rescue-best-v3:';
    const keys = new Set();
    const directional = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
    const canvas = $('rescue-canvas');
    let game = null, audio = null, pointer = null, active = false, focused = true, manualPaused = false;
    let state = null, best = {}, savedWarning = false, notice = '', noticeUntil = 0;
    let soundEnabled = typeof window.GameSoundEnabled === 'boolean' ? window.GameSoundEnabled : read('photo-merge-sound', 'on') !== 'off';
    window.GameSoundEnabled = soundEnabled;
    function read(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
    function write(key, value) { try { window.localStorage.setItem(key, String(value)); return true; } catch { return false; } }
    function callAudio(method, ...args) {
      try { const value = audio?.[method]?.(...args); if (value?.catch) value.catch(() => {}); } catch { /* Sound must never interrupt rescue. */ }
    }
    function soundUI() {
      $('rescue-sound').textContent = soundEnabled ? '音效开' : '音效关';
      $('rescue-sound').setAttribute('aria-pressed', String(soundEnabled));
    }
    function clearInput() {
      const captured = pointer; pointer = null; keys.clear();
      if (captured !== null && canvas.hasPointerCapture?.(captured)) canvas.releasePointerCapture(captured);
      game?.stopInput();
    }
    function blocked() { return !active || document.hidden || !focused || manualPaused || Boolean(document.querySelector('dialog[open]')); }
    function syncPause() {
      if (!game) return;
      const pause = blocked();
      if (pause) { clearInput(); callAudio('pause'); }
      game.pause(pause);
      render(game.getState());
    }
    function noticeText() {
      if (!state) return '';
      if (state.status === 'won') return '伙伴们安全到达了！';
      if (state.status === 'lost') return '时间到了，再试一次更顺的路线';
      if (blocked()) return '已暂停，点击「继续」后出发';
      if (state.shieldRemaining > 0) return `护队 ${Math.ceil(state.shieldRemaining)} 秒 · 抗撞不掉队，仍需绕开家具`;
      if (notice && Date.now() < noticeUntil) return notice;
      return state.status === 'ready' ? '拖动水瓶出发，碰到朋友就能带上他' : `队伍 ${state.following} 人 · 把朋友带进绿色出口`;
    }
    function render(next) {
      state = next;
      $('rescue-stage').textContent = `${next.stageIndex + 1} / ${next.stageCount}`;
      $('rescue-count').textContent = `${next.saved} / ${next.goal}`;
      $('rescue-time').textContent = String(Math.max(0, Math.ceil(next.remaining)));
      $('rescue-score').textContent = next.score.toLocaleString();
      $('rescue-best').textContent = (best[next.stageIndex] || 0).toLocaleString();
      $('rescue-status').textContent = noticeText();
      $('rescue-pause').textContent = manualPaused || !focused ? '继续' : '暂停';
      $('rescue-pause').setAttribute('aria-pressed', String(manualPaused || !focused));
      const ended = next.status === 'won' || next.status === 'lost';
      $('rescue-pause').disabled = ended;
      $('rescue-intro').hidden = next.status !== 'ready' || blocked();
      $('rescue-paused').hidden = !active || !blocked() || ended;
      $('rescue-result').hidden = !ended;
      document.querySelectorAll('[data-rescue-stage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.rescueStage) === next.stageIndex)));
      if (ended) {
        $('rescue-result-title').textContent = next.status === 'won' ? '救援成功！' : '差一点就到了';
        $('rescue-result-detail').textContent = `救出 ${next.saved} 位朋友 · ${next.score.toLocaleString()} 分` + (savedWarning ? ' · 本机记录保存失败' : '');
        $('rescue-next').hidden = next.status !== 'won' || next.stageIndex >= next.stageCount - 1;
      }
    }
    function completed(next) {
      clearInput();
      if (next.score > (best[next.stageIndex] || 0)) {
        best[next.stageIndex] = next.score;
        savedWarning = !write(BEST_PREFIX + next.stageIndex, next.score);
      }
      render(next);
      $('rescue-result-title').focus({ preventScroll: true });
    }
    function onEvent(event) {
      const messages = { collect: '接到朋友啦，慢一点转弯', detach: '有人掉队了！可以回去接他', rescue: '一位朋友安全到达', item: '蓝玩偶护队！6 秒内撞击不会掉队', win: '伙伴们安全到达了！', lose: '时间到了，再试一次' };
      notice = messages[event.type] || ''; noticeUntil = Date.now() + 1700;
      if (event.type === 'collect' || event.type === 'rescue') callAudio('playMerge', { level: event.type === 'collect' ? 2 : 5 });
      else if (event.type === 'win' || event.type === 'item') callAudio('playMerge', { level: event.type === 'win' ? 8 : 6 });
      else if (event.type === 'detach') callAudio('playDrop');
    }
    function ensureGame() {
      if (game) return true;
      try {
        if (typeof window.RescueGame !== 'function') throw new Error('二周目文件未加载，请刷新后重试');
        for (let i = 0; i < window.RescueGame.STAGES.length; i++) {
          const value = Number(read(BEST_PREFIX + i, '0'));
          best[i] = Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : 0;
        }
        if (typeof window.MergeAudio === 'function') audio = new window.MergeAudio();
        callAudio('setEnabled', soundEnabled);
        game = new window.RescueGame({ canvas, levels: window.GameLevels.levels, onChange: render, onEvent, onComplete: completed });
        return true;
      } catch (error) {
        $('rescue-status').textContent = error.message || '二周目启动失败，请刷新后重试';
        console.error(error); return false;
      }
    }
    function resetStage(index, ask = true) {
      if (!ensureGame()) return;
      if (ask && state?.status === 'playing') {
        clearInput(); game.pause(true);
        if (!window.confirm('重新出发会清空本关进度，本机最高分会保留。确定吗？')) { syncPause(); return; }
      }
      clearInput(); callAudio('reset'); manualPaused = false; savedWarning = false; notice = '';
      game.reset(index); syncPause(); canvas.focus({ preventScroll: true });
    }
    function setTarget(event) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) game.setTarget((event.clientX - rect.left) / rect.width * window.RescueGame.WIDTH, (event.clientY - rect.top) / rect.height * window.RescueGame.HEIGHT);
    }
    function updateDirection() {
      let x = 0, y = 0;
      for (const key of keys) { x += directional[key][0]; y += directional[key][1]; }
      game?.setDirection(x, y);
    }
    function unlock(event) { if (active && event.isTrusted) callAudio('unlock'); }
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    canvas.addEventListener('pointerdown', event => {
      if (!active || blocked() || !game || event.button !== 0 || pointer !== null || ['won', 'lost'].includes(state.status)) return;
      event.preventDefault(); clearInput(); pointer = event.pointerId;
      canvas.setPointerCapture(pointer); canvas.focus({ preventScroll: true }); setTarget(event);
    });
    canvas.addEventListener('pointermove', event => { if (pointer === event.pointerId && !blocked()) { event.preventDefault(); setTarget(event); } });
    canvas.addEventListener('pointerup', event => { if (pointer === event.pointerId) clearInput(); });
    canvas.addEventListener('pointercancel', clearInput);
    canvas.addEventListener('lostpointercapture', clearInput);
    document.addEventListener('keydown', event => {
      if (!active || !game || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (event.target.tagName === 'BUTTON') return;
      if (key === 'p' || key === 'Escape') { event.preventDefault(); if (!event.repeat) { manualPaused = !manualPaused; syncPause(); } return; }
      if (key === 'r') { event.preventDefault(); if (!event.repeat) resetStage(state.stageIndex); return; }
      if (!directional[key] || blocked()) return;
      event.preventDefault(); keys.add(key); updateDirection();
    });
    document.addEventListener('keyup', event => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (keys.delete(key)) updateDirection();
    });
    $('rescue-pause').addEventListener('click', () => { focused = true; manualPaused = !manualPaused; syncPause(); if (!manualPaused) canvas.focus({ preventScroll: true }); });
    $('rescue-restart').addEventListener('click', () => resetStage(state?.stageIndex || 0));
    $('rescue-retry').addEventListener('click', () => resetStage(state?.stageIndex || 0, false));
    $('rescue-next').addEventListener('click', () => { if (state?.status === 'won' && state.stageIndex < state.stageCount - 1) resetStage(state.stageIndex + 1, false); });
    document.querySelectorAll('[data-rescue-stage]').forEach(button => button.addEventListener('click', () => resetStage(Number(button.dataset.rescueStage))));
    $('rescue-sound').addEventListener('click', () => { soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled; write('photo-merge-sound', soundEnabled ? 'on' : 'off'); callAudio('setEnabled', soundEnabled); soundUI(); window.dispatchEvent(new window.Event('feitian-soundchange')); });
    window.addEventListener('feitian-soundchange', () => { soundEnabled = window.GameSoundEnabled; callAudio('setEnabled', soundEnabled); soundUI(); });
    window.addEventListener('feitian-modechange', event => {
      active = event.detail.mode === 'rescue';
      clearInput();
      if (active && !ensureGame()) return;
      soundEnabled = window.GameSoundEnabled; callAudio('setEnabled', soundEnabled); soundUI(); syncPause();
    });
    window.addEventListener('blur', () => { focused = false; syncPause(); });
    window.addEventListener('focus', () => { focused = true; syncPause(); });
    document.addEventListener('visibilitychange', syncPause);
    window.addEventListener('resize', () => { clearInput(); game?.render(); });
    window.addEventListener('orientationchange', clearInput);
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', syncPause));
    soundUI();
    return { get game() { return game; } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = initRescue;
  else initRescue(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
