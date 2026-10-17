(function (root) {
  'use strict';
  function initJump(document, window) {
    const $ = id => document.getElementById(id);
    // Keep the mobile revision's best; the original high-scoring v1 stays separate.
    const BEST_KEY = 'feitian-jump-best-v2';
    const canvas = $('jump-canvas');
    const hold = $('jump-hold');
    let game = null, audio = null, state = null, board = null;
    let roundId = makeRoundId(), roundRecorded = false;
    let active = false, focused = true, manualPaused = false;
    let pointer = null, keyboard = null;
    let best = 0, savedWarning = false, notice = '', noticeUntil = 0;
    let soundEnabled = typeof window.GameSoundEnabled === 'boolean' ? window.GameSoundEnabled : read('photo-merge-sound', 'on') !== 'off';
    window.GameSoundEnabled = soundEnabled;

    function read(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
    function write(key, value) { try { window.localStorage.setItem(key, String(value)); return true; } catch { return false; } }
    function makeRoundId() { return window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
    function ensureBoard() {
      if (board) return board;
      try { if (typeof window.JumpLeaderboard === 'function') board = new window.JumpLeaderboard(); } catch { /* Online ranking must not block play. */ }
      return board;
    }
    function prop(id, key, value) { const element = $(id); if (element[key] !== value) element[key] = value; }
    function text(id, value) { prop(id, 'textContent', value); }
    function attr(id, key, value) { const element = $(id); if (element.getAttribute(key) !== value) element.setAttribute(key, value); }
    function callAudio(method, ...args) {
      try { const value = audio?.[method]?.(...args); if (value?.catch) value.catch(() => {}); } catch { /* Audio is optional. */ }
    }
    function soundUI() {
      text('jump-sound', soundEnabled ? '音效开' : '音效关');
      attr('jump-sound', 'aria-pressed', String(soundEnabled));
    }
    function blocked() { return !active || !focused || document.hidden || manualPaused || Boolean(document.querySelector('dialog[open]')); }
    function releaseCapture() {
      const held = pointer; pointer = null;
      try { if (held?.target.hasPointerCapture?.(held.id)) held.target.releasePointerCapture(held.id); } catch { /* The browser may already have released it. */ }
    }
    function clearInput() {
      keyboard = null;
      releaseCapture();
      game?.cancelCharge();
      callAudio('setCharge', null);
    }
    function syncPause() {
      if (!game) return;
      const pause = blocked();
      if (pause) { clearInput(); callAudio('pause'); }
      game.pause(pause);
      render(game.getState());
    }
    function saveBest(score) {
      if (!Number.isSafeInteger(score) || score <= best) return;
      best = score;
      savedWarning = !write(BEST_KEY, best);
    }
    function statusText(next) {
      if (next.status === 'lost') return '没有落稳，再试一次！';
      if (blocked()) return '已暂停，继续后重新按住蓄力';
      if (next.phase === 'charging') return next.charge >= 1 ? '蓄力已满，松手起跳' : '按住越久跳得越远，松手起跳';
      if (next.phase === 'jumping') return '瞄准平台中心，落稳再跳';
      if (next.phase === 'falling') return '这次差一点……';
      if (next.bonusAvailable) return `${next.bonusLabel}：停留 ${Math.ceil(next.bonusRemainingMs / 1000)} 秒再得 +${next.bonusPoints}`;
      if (notice && Date.now() < noticeUntil) return notice;
      if (next.status === 'ready') return '按住画面或下方按钮蓄力，松手起跳';
      return next.combo > 1 ? `连续中心 ${next.combo} 次！继续挑战` : '落台得分，每 200 分进化一次';
    }
    function render(next) {
      state = next;
      // Landings and platform rewards both save immediately, not on every frame.
      saveBest(next.score);
      const paused = blocked();
      callAudio('setCharge', !paused && !next.isPaused && soundEnabled && next.phase === 'charging' ? next.charge : null);
      const ended = next.status === 'lost';
      text('jump-score', next.score.toLocaleString());
      text('jump-best', best.toLocaleString());
      text('jump-stage', `图 ${next.photoNumber}`);
      text('jump-cycle', `第 ${next.cycle} 轮`);
      const level = window.GameLevels?.levels?.[next.levelIndex];
      if (level?.image) attr('jump-photo', 'src', level.image);
      attr('jump-photo', 'alt', `当前形态：图 ${next.photoNumber}`);
      text('jump-status', statusText(next) + (savedWarning ? ' · 本机记录暂未保存' : ''));
      text('jump-pause', manualPaused || !focused ? '继续' : '暂停');
      attr('jump-pause', 'aria-pressed', String(manualPaused || !focused));
      prop('jump-pause', 'disabled', ended);
      prop('jump-hold', 'disabled', paused || ended || next.phase === 'jumping' || next.phase === 'falling');
      text('jump-hold', ended ? '本局结束' : paused ? '已暂停' : next.phase === 'charging' ? '松手起跳' : next.phase === 'jumping' || next.phase === 'falling' ? '跳跃中…' : '按住蓄力 · 松手起跳');
      prop('jump-intro', 'hidden', next.status !== 'ready' || paused || next.phase === 'charging');
      prop('jump-paused', 'hidden', !active || !paused || ended);
      prop('jump-result', 'hidden', !ended);
      if (ended) {
        text('jump-result-title', '这次跳了多远？');
        text('jump-result-detail', `${next.score.toLocaleString()} 分 · ${next.hops} 次落台 · 第 ${next.cycle} 轮 · 图 ${next.photoNumber}` + (savedWarning ? ' · 本机记录保存失败' : ` · 本机最高 ${best.toLocaleString()}`));
      }
    }
    function completed(next) {
      clearInput();
      if (savedWarning && next.score === best) savedWarning = !write(BEST_KEY, best);
      render(next);
      if (!roundRecorded) {
        roundRecorded = true;
        try {
          const ranking = ensureBoard();
          if (!ranking) throw new Error('ranking unavailable');
          const submittedRound = roundId;
          Promise.resolve(ranking.record(next.score, submittedRound)).catch(() => {
            if (roundId === submittedRound) text('jump-submit-status', '上传尚未确认，请打开排行榜重试。');
          });
        } catch { text('jump-submit-status', '共享榜暂未连接，请刷新后在排行榜补传本机最高分。'); }
      }
      if (active && focused && !document.hidden) $('jump-result-title').focus({ preventScroll: true });
    }
    function onEvent(event) {
      if (event.type === 'jump') callAudio('playJump');
      else if (event.type === 'evolve') {
        notice = `进化！第 ${event.cycle} 轮 · 图 ${event.levelIndex - 1}`;
        noticeUntil = Date.now() + 2000;
        callAudio('playEvolution', { level: event.levelIndex });
      } else if (event.type === 'perfect') {
        notice = `中心连击 ${event.combo} 次 · +${event.points}`;
        noticeUntil = Date.now() + 1200;
        callAudio('playLanding', { ...event, perfect: true });
      } else if (event.type === 'bonus') {
        const label = { manhole: '井盖', cube: '魔方', kiosk: '便利店', record: '唱片' }[event.kind] || '平台';
        notice = `${label}奖励 +${event.points}！`;
        noticeUntil = Date.now() + 1800;
        callAudio('playBonus', event);
      } else if (event.type === 'land' && !event.perfect) callAudio('playLanding', event);
      else if (event.type === 'lose') callAudio('playLose');
    }
    function ensureGame() {
      if (game) return true;
      try {
        if (typeof window.JumpGame !== 'function') throw new Error('三周目文件未加载，请刷新后重试');
        const saved = Number(read(BEST_KEY, '0'));
        best = Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
        try { if (typeof window.JumpAudio === 'function') audio = new window.JumpAudio(); } catch { audio = null; }
        callAudio('setEnabled', soundEnabled);
        game = new window.JumpGame({ canvas, levels: window.GameLevels.levels, onChange: render, onEvent, onComplete: completed });
        ensureBoard();
        return true;
      } catch (error) {
        text('jump-status', error.message || '三周目启动失败，请刷新后重试');
        return false;
      }
    }
    function restart(ask = true) {
      if (!active || !ensureGame()) return;
      if (ask && state?.status === 'playing') {
        clearInput(); callAudio('pause'); game.pause(true);
        if (!window.confirm('重新开始会清空本局进度，本机最高分会保留。确定吗？')) { syncPause(); return; }
      }
      clearInput(); callAudio('reset'); manualPaused = false; notice = '';
      roundId = makeRoundId(); roundRecorded = false;
      game.reset(); syncPause(); canvas.focus({ preventScroll: true });
    }
    function canCharge() { return active && game && !blocked() && state.status !== 'lost' && state.phase === 'idle'; }
    function finishPointer(event, cancel) {
      if (!pointer || pointer.id !== event.pointerId) return;
      event.preventDefault();
      releaseCapture();
      if (cancel || blocked()) game?.cancelCharge(); else game?.releaseCharge();
    }
    function unlock(event) { if (active && event.isTrusted) callAudio('unlock'); }
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    for (const target of [canvas, hold]) {
      target.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointer !== null || keyboard !== null || !canCharge()) return;
        event.preventDefault();
        pointer = { id: event.pointerId, target };
        try { target.setPointerCapture(event.pointerId); } catch { /* Global pointerup still releases a jump. */ }
        target.focus({ preventScroll: true });
        game.startCharge();
      });
      target.addEventListener('pointerup', event => finishPointer(event, false));
      target.addEventListener('pointercancel', event => finishPointer(event, true));
      target.addEventListener('lostpointercapture', event => finishPointer(event, true));
      target.addEventListener('contextmenu', event => { if (active) event.preventDefault(); });
    }
    window.addEventListener('pointerup', event => finishPointer(event, false));
    window.addEventListener('pointercancel', event => finishPointer(event, true));
    function allowedKeyboardTarget(target) {
      if (!target) return true;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|A)$/.test(target.tagName)) return false;
      return target.tagName !== 'BUTTON' || target === hold;
    }
    function chargeKey(event) {
      if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') return 'Space';
      return event.key === 'Enter' && event.target === hold ? 'Enter' : null;
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Tab' && keyboard) clearInput();
      if (!active || !game || !allowedKeyboardTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      const key = chargeKey(event);
      if (key) {
        event.preventDefault();
        if (event.repeat || keyboard !== null || pointer !== null || !canCharge()) return;
        keyboard = key; game.startCharge(); return;
      }
      if (event.target?.tagName === 'BUTTON') return;
      if (event.key === 'Escape' || event.key?.toLowerCase() === 'p') {
        event.preventDefault();
        if (!event.repeat && state.status !== 'lost') { manualPaused = !manualPaused; syncPause(); }
      } else if (event.key?.toLowerCase() === 'r') {
        event.preventDefault(); if (!event.repeat) restart();
      }
    });
    document.addEventListener('keyup', event => {
      const key = event.key === 'Enter' ? 'Enter' : chargeKey(event);
      if (!keyboard || key !== keyboard) return;
      event.preventDefault(); keyboard = null;
      if (blocked() || !allowedKeyboardTarget(event.target)) game?.cancelCharge(); else game?.releaseCharge();
    });
    document.addEventListener('focusin', event => { if ((keyboard || pointer) && !allowedKeyboardTarget(event.target)) clearInput(); });
    $('jump-pause').addEventListener('click', () => {
      if (!active || !game || state.status === 'lost') return;
      focused = true; manualPaused = !manualPaused; syncPause();
      if (!manualPaused) canvas.focus({ preventScroll: true });
    });
    $('jump-restart').addEventListener('click', () => restart());
    $('jump-retry').addEventListener('click', () => restart(false));
    $('jump-sound').addEventListener('click', () => {
      soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled;
      write('photo-merge-sound', soundEnabled ? 'on' : 'off');
      callAudio('setEnabled', soundEnabled); soundUI();
      window.dispatchEvent(new window.Event('feitian-soundchange'));
    });
    window.addEventListener('feitian-soundchange', () => {
      if (typeof window.GameSoundEnabled === 'boolean') soundEnabled = window.GameSoundEnabled;
      callAudio('setEnabled', soundEnabled); soundUI();
    });
    window.addEventListener('feitian-jump-boardchange', syncPause);
    window.addEventListener('feitian-modechange', event => {
      active = event.detail?.mode === 'jump';
      clearInput();
      if (active && !ensureGame()) return;
      if (typeof window.GameSoundEnabled === 'boolean') soundEnabled = window.GameSoundEnabled;
      callAudio('setEnabled', soundEnabled); soundUI(); syncPause();
    });
    window.addEventListener('blur', () => { focused = false; syncPause(); });
    window.addEventListener('focus', () => { focused = true; syncPause(); });
    document.addEventListener('visibilitychange', () => { clearInput(); syncPause(); });
    window.addEventListener('resize', () => { clearInput(); game?.render(); });
    window.addEventListener('orientationchange', () => { clearInput(); game?.render(); });
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', syncPause));
    soundUI();
    return { get game() { return game; } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = initJump;
  else initJump(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
