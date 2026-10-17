(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const BEST_KEY = 'feitian-best-naiwa-v1';
  const OUTBOX_PREFIX = 'feitian-pending-score-v1:';
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } },
    keys() { try { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean); } catch { return null; } },
  };
  const validScore = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
  const cleanName = value => [...String(value || '').trim().normalize('NFC')].slice(0, 24).join('').trim() || '玩家';
  const storedBest = Number(storage.get(BEST_KEY, '0'));
  let best = validScore(storedBest) ? storedBest : 0;
  let soundEnabled = storage.get('photo-merge-sound', 'on') !== 'off';
  window.GameSoundEnabled = soundEnabled;
  let game, audio, levels, lastState, toastTimer;
  let activePointer = null;
  let windowFocused = true;
  let roundId = makeRoundId();
  let roundRecorded = false;
  let submission = null;
  const pendingScores = new Map();
  let flushPromise = null, writeTail = Promise.resolve(), recovery = null;
  const recoverableBest = validScore(storedBest) ? storedBest : 0;
  let leaderboard, refreshPromise = null, profilePromise = null;
  let cloudRevision = 0;
  const cloud = { rows: [], player: null, ready: false, loading: false, error: '' };
  const mergeActive = () => !window.GameModes || window.GameModes.current === 'merge';

  function queueKey(record) { return OUTBOX_PREFIX + encodeURIComponent(record.project) + ':' + record.id; }
  function savePending(record) {
    const { id, score, ownerId, project, endedAt } = record;
    record.saved = storage.set(queueKey(record), JSON.stringify({ version: 1, id, score, ownerId, project, endedAt }));
  }
  function readPending() {
    const keys = storage.keys(); if (!keys) return;
    for (const record of pendingScores.values()) {
      if (record.saved && !record.pending && !keys.includes(queueKey(record))) {
        pendingScores.delete(record.id);
        record.externalRemoved = true; record.message = '此待上传记录已在另一页面处理，请刷新排行榜确认。';
      }
    }
    for (const key of keys) {
      if (!key.startsWith(OUTBOX_PREFIX)) continue;
      try {
        const item = JSON.parse(storage.get(key, 'null'));
        if (!item || item.version !== 1 || item.project !== leaderboard.config.url || !/^[A-Za-z0-9_-]{8,128}$/.test(item.id) || !validScore(item.score) || !Number.isFinite(item.endedAt) || item.endedAt <= 0 || !(item.ownerId === null || (typeof item.ownerId === 'string' && item.ownerId.length > 0 && item.ownerId.length <= 128)) || key !== queueKey(item)) continue;
        const existing = pendingScores.get(item.id);
        if (!existing) pendingScores.set(item.id, { ...item, saved: true, claimable: false, pending: false, submitted: false, attempted: true, message: '' });
        else if (!existing.pending && existing.ownerId === null && item.ownerId && existing.score === item.score && existing.endedAt === item.endedAt) { existing.ownerId = item.ownerId; existing.claimable = false; }
      } catch { /* Ignore malformed data without deleting another record. */ }
    }
  }
  function enqueueWrite(work) {
    const job = writeTail.then(work, work);
    writeTail = job.catch(() => {});
    return job;
  }
  function pendingNotice(record) { return record.saved ? '成绩已保存在本浏览器，联网后可重试。' : '成绩暂存在本页，请勿关闭或刷新页面。'; }
  function updatePendingUI() {
    const records = [...pendingScores.values()].filter(record => !record.submitted);
    const ownId = leaderboard.getPlayerId();
    const retryable = records.filter(record => record.ownerId === ownId && ownId || !record.ownerId && record.claimable);
    const unbound = records.length - retryable.length;
    $('pending-score-status').hidden = !records.length;
    $('pending-score-status').textContent = records.length ? (flushPromise ? '正在补传成绩…' : '有 ' + records.length + ' 局成绩待上传。') + (records.some(record => !record.saved) ? ' 部分成绩仅暂存在本页，请勿关闭或刷新。' : ' 成绩已保存在本浏览器。') + (unbound ? ' 部分记录归属未确认或属于其他玩家，未自动上传。' : '') : '';
    $('retry-pending-button').hidden = !leaderboard.online || !records.length;
    $('retry-pending-button').disabled = Boolean(flushPromise);
    $('recover-best-button').hidden = !leaderboard.online || !cloud.player || recoverableBest <= cloud.player.bestScore;
  }

  function makeRoundId() { return window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
  function callAudio(method, ...args) {
    try { const result = audio?.[method]?.(...args); if (result && typeof result.catch === 'function') result.catch(() => {}); } catch { /* Optional audio never blocks gameplay. */ }
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function clearPointer() {
    const pointer = activePointer; activePointer = null;
    if (pointer !== null && $('game-canvas').hasPointerCapture?.(pointer)) $('game-canvas').releasePointerCapture(pointer);
  }
  function syncDialogViewport() {
    const viewport = window.visualViewport, style = document.documentElement.style;
    const height = viewport?.height, top = viewport?.offsetTop;
    if (Number.isFinite(height) && height > 0) style.setProperty('--dialog-viewport-height', `${height}px`);
    else style.removeProperty('--dialog-viewport-height');
    if (Number.isFinite(top) && top >= 0) style.setProperty('--dialog-viewport-top', `${top}px`);
    else style.removeProperty('--dialog-viewport-top');
  }
  function syncPause() {
    if (!game) return;
    const paused = !mergeActive() || !windowFocused || document.hidden || Boolean(document.querySelector('dialog[open]'));
    game.pause(paused);
    if (paused) { clearPointer(); callAudio('pause'); }
    $('paused-overlay').hidden = !paused || game.getState().isOver;
  }
  function showDialog(id) { if (!$(id).open) $(id).showModal(); syncPause(); }
  function closeDialog(id) { $(id).close(); syncPause(); }
  function updateSoundButton() {
    $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
    $('sound-button').querySelector('span').textContent = soundEnabled ? '音效开' : '音效关';
    $('sound-button').querySelector('use').setAttribute('href', soundEnabled ? '#i-sound' : '#i-mute');
  }
  function updateNextAvatar(level) {
    const image = $('next-avatar');
    image.src = level.image; image.alt = '下一个：' + level.name;
    Object.assign(image.style, { width: '100%', height: '100%', left: '0%', top: '0%', objectFit: 'contain' });
    const frame = level.frame, size = level.imageSize;
    if (!Array.isArray(frame) || frame.length !== 4 || !Array.isArray(size) || size.length !== 2 || ![...frame, ...size].every(Number.isFinite)) return;
    const [sx, sy, width, height] = frame, [imageWidth, imageHeight] = size;
    if (sx < 0 || sy < 0 || width <= 0 || height <= 0 || imageWidth <= 0 || imageHeight <= 0 || sx + width > imageWidth || sy + height > imageHeight) return;
    // Scale the full source uniformly, then center its complete subject frame.
    const side = Math.max(width, height);
    Object.assign(image.style, {
      width: imageWidth / side * 100 + '%', height: imageHeight / side * 100 + '%',
      left: ((side - width) / 2 - sx) / side * 100 + '%',
      top: ((side - height) / 2 - sy) / side * 100 + '%', objectFit: 'fill',
    });
  }
  function onState(state) {
    const previous = lastState; lastState = state;
    if (!previous || previous.score !== state.score) {
      $('score').textContent = state.score.toLocaleString();
      if (state.score > best) { best = state.score; storage.set(BEST_KEY, best); }
      $('best').textContent = best.toLocaleString();
    }
    $('coins').textContent = state.coins; $('coin-chip').hidden = state.coins < 1;
    if (!previous || previous.next !== state.next) updateNextAvatar(levels[state.next]);
    $('board-empty').hidden = state.bodyCount > 0 || state.score > 0;
    $('board-wrap').classList.toggle('danger', state.danger > 0);
    $('board-status').textContent = state.isOver ? '本局结束' : state.danger > 0 ? '小心越线，快合成！' : state.bodyCount ? '相同人物碰在一起，合成升级' : '准备好，开始合成';
  }
  function renderLeaderboard() {
    const local = !leaderboard.online;
    $('leaderboard-status').textContent = local ? '请从在线游戏打开共享榜。' : cloud.loading ? '正在连接共享榜…' : cloud.error || (cloud.player ? '已连接 · ' + cloud.player.name + '（本浏览器玩家）' : '匿名玩家尚未连接，请重试。');
    $('leaderboard-status').classList.toggle('connection-error', Boolean(cloud.error));
    $('leaderboard-refresh').hidden = local;
    $('leaderboard-refresh').disabled = cloud.loading;
    $('leaderboard-refresh').textContent = cloud.error || !cloud.player ? '重新连接' : '刷新榜单';
    $('nickname-form').hidden = !cloud.player;
    $('nickname-input').disabled = Boolean(profilePromise);
    $('nickname-save').disabled = Boolean(profilePromise);
    if (cloud.player && document.activeElement !== $('nickname-input')) $('nickname-input').value = cloud.player.name;
    $('leaderboard-empty').hidden = local || cloud.loading || !cloud.ready || cloud.rows.length > 0;
    $('leaderboard-table').hidden = local || !cloud.ready || cloud.rows.length === 0;
    $('leaderboard-body').replaceChildren();
    cloud.rows.forEach(entry => {
      const row = document.createElement('tr'); row.title = new Date(entry.endedAt).toLocaleString('zh-CN');
      for (const value of [String(entry.rank), entry.name, entry.score.toLocaleString()]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      $('leaderboard-body').append(row);
    });
    updateSubmissionUI();
    updatePendingUI();
  }
  function applyCloud(data) {
    cloud.rows = data.rows; cloud.player = data.player; cloud.ready = true; cloud.error = '';
  }
  function handleCloudError(error) {
    cloud.error = error.message || '共享榜暂不可用，请稍后重试。';
    if (error.status === 401) cloud.player = null;
  }
  function refreshLeaderboard() {
    if (!leaderboard.online) { renderLeaderboard(); return Promise.resolve(); }
    if (refreshPromise) return refreshPromise;
    cloud.loading = true; renderLeaderboard();
    const revision = cloudRevision;
    refreshPromise = leaderboard.list().then(data => { if (revision === cloudRevision) applyCloud(data); }).catch(error => { if (revision === cloudRevision) handleCloudError(error); }).finally(() => { cloud.loading = false; refreshPromise = null; renderLeaderboard(); });
    return refreshPromise;
  }
  function openLeaderboard() { showDialog('leaderboard-dialog'); refreshLeaderboard(); flushPending(); }
  function updateSubmissionUI() {
    if (!submission) { $('submit-score-button').hidden = true; return; }
    $('result-note').textContent = submission.message;
    $('submit-score-button').hidden = Boolean(!leaderboard.online || !leaderboard.configured || submission.submitted || submission.pending || submission.externalRemoved);
    $('submit-score-button').textContent = submission.attempted ? '重试上传本局成绩' : '提交本局成绩';
  }
  async function submitRound(record) {
    if (!record || record.pending || record.submitted) return;
    if (!leaderboard.online) { record.message = '本局未上传；请从在线游戏打开共享榜。'; updateSubmissionUI(); return; }
    record.pending = true; record.message = '正在提交本局成绩… ' + pendingNotice(record); updateSubmissionUI();
    try {
      await enqueueWrite(async () => {
        // A blocked GET leaderboard must never prevent a final score POST.
        const session = await leaderboard.ensureSession();
        const playerId = session.user.id;
        if (!record.ownerId && record.claimable) { record.ownerId = playerId; record.claimable = false; savePending(record); }
        if (!record.ownerId || record.ownerId !== playerId) throw new Error('成绩归属未确认或玩家身份已变化，记录已保留，未自动上传。');
        record.attempted = true;
        cloudRevision++;
        const result = await leaderboard.submitScore(record.score, record.id, cloud.player?.id === playerId ? cloud.player.name : '玩家', record.ownerId);
        if (result.player.id !== record.ownerId || result.bestScore < record.score) throw new Error('服务器尚未确认这份成绩，请重试。');
        cloudRevision++; applyCloud(result);
        record.message = result.updated ? (result.rank && result.rank <= 20 ? '已更新共享最高分 · 第 ' + result.rank + ' 名' : '已更新个人最高分，暂未进入前 20 名') : '已确认上传；本局未超过个人最高 ' + result.bestScore.toLocaleString() + ' 分，原纪录保留。';
      });
      record.submitted = true;
      pendingScores.delete(record.id); storage.remove(queueKey(record));
    } catch (error) { cloudRevision++; handleCloudError(error); record.message = (record.attempted ? '上传未确认：' : '本局未上传：') + (error.message || '共享榜暂不可用') + ' ' + pendingNotice(record); }
    finally { record.pending = false; renderLeaderboard(); }
  }
  function flushPending() {
    if (!leaderboard.online || !leaderboard.configured) return Promise.resolve();
    if (flushPromise) return flushPromise;
    readPending();
    if (!pendingScores.size) { updatePendingUI(); return Promise.resolve(); }
    const attempted = new Set();
    flushPromise = Promise.resolve().then(async () => {
      try { await leaderboard.ensureSession(); }
      catch (error) {
        handleCloudError(error);
        for (const record of pendingScores.values()) if (!record.submitted) record.message = '本局未上传：' + error.message + ' ' + pendingNotice(record);
        return;
      }
      while (true) {
        const ownId = leaderboard.getPlayerId();
        const record = [...pendingScores.values()].find(item => !attempted.has(item.id) && !item.submitted && (item.ownerId === ownId && ownId || !item.ownerId && item.claimable));
        if (!record) break;
        attempted.add(record.id);
        await submitRound(record);
        if (!record.submitted) break;
      }
    }).finally(() => { flushPromise = null; renderLeaderboard(); });
    updatePendingUI();
    return flushPromise;
  }
  function createPending(score, id = makeRoundId(), ownerId = leaderboard.getPlayerId()) {
    const record = { id, score, ownerId, project: leaderboard.config.url || '', endedAt: Date.now(), claimable: !ownerId, pending: false, submitted: false, attempted: false, message: '成绩等待上传。' };
    if (leaderboard.online && leaderboard.configured) { savePending(record); pendingScores.set(id, record); }
    return record;
  }
  function recordRound(state) {
    if (roundRecorded) return;
    roundRecorded = true;
    submission = createPending(state.score, roundId);
    if (leaderboard.online && leaderboard.configured) flushPending(); else submitRound(submission);
  }
  function finishRound() {
    const state = game.getState(); if (!state.isOver) return;
    recordRound(state); $('revive-panel').hidden = true; $('result-panel').hidden = false;
    $('end-score').textContent = state.score.toLocaleString(); $('end-best').textContent = '本机最高 ' + best.toLocaleString();
    updateSubmissionUI(); showDialog('end-dialog');
  }
  function endGame(state) {
    if (state.coins < 1) { finishRound(); return; }
    $('revive-panel').hidden = false; $('result-panel').hidden = true;
    $('revive-score').textContent = state.score.toLocaleString(); $('revive-count').textContent = '还剩 ' + state.coins + ' 枚复活币';
    showDialog('end-dialog');
  }
  function newGame() {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); clearPointer(); callAudio('reset');
    roundId = makeRoundId(); roundRecorded = false; submission = null; game.reset(); syncPause(); $('game-canvas').focus({ preventScroll: true });
  }
  function askRestart() {
    if (document.querySelector('dialog[open]')) return;
    const state = game.getState(); if (state.bodyCount === 0 && state.score === 0) newGame(); else showDialog('restart-dialog');
  }
  function aimFromEvent(event) { const rect = $('game-canvas').getBoundingClientRect(); if (rect.width > 0) game.aim((event.clientX - rect.left) / rect.width * MergeGame.WIDTH); }
  function drop() { if (game.drop()) callAudio('playDrop'); }

  function init() {
    if (!window.Matter || !window.MergeGame || !window.GameLevels || !Array.isArray(MergeGame.RADII) || !Array.isArray(GameLevels.levels) || GameLevels.levels.length !== MergeGame.RADII.length) throw new Error('游戏文件加载失败，请刷新页面或确认文件夹完整。');
    levels = GameLevels.levels; $('brand-title').textContent = GameLevels.title; document.title = GameLevels.title;
    leaderboard = new SharedLeaderboard();
    if (typeof window.MergeAudio === 'function') audio = new MergeAudio();
    callAudio('setEnabled', soundEnabled); updateSoundButton(); $('best').textContent = best.toLocaleString();
    game = new MergeGame({ canvas: $('game-canvas'), levels, onChange: onState, onMerge: event => { callAudio('playMerge', event); $('score').classList.remove('score-pop'); requestAnimationFrame(() => $('score').classList.add('score-pop')); }, onGameOver: endGame });
    syncPause(); syncDialogViewport(); const canvas = $('game-canvas');
    window.visualViewport?.addEventListener('resize', syncDialogViewport);
    window.visualViewport?.addEventListener('scroll', syncDialogViewport);
    document.addEventListener('pointerdown', event => { if (mergeActive() && event.isTrusted) callAudio('unlock'); }, { capture: true });
    document.addEventListener('keydown', event => { if (mergeActive() && event.isTrusted) callAudio('unlock'); }, { capture: true });
    canvas.addEventListener('pointermove', event => { if (mergeActive() && !document.querySelector('dialog[open]') && (event.pointerType === 'mouse' || event.pointerId === activePointer)) aimFromEvent(event); });
    canvas.addEventListener('pointerdown', event => {
      if (!mergeActive() || event.button !== 0 || activePointer !== null || document.querySelector('dialog[open]')) return;
      event.preventDefault(); activePointer = event.pointerId; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); aimFromEvent(event);
    });
    canvas.addEventListener('pointerup', event => { if (activePointer !== event.pointerId) return; clearPointer(); if (!mergeActive()) return; aimFromEvent(event); if (!document.querySelector('dialog[open]')) drop(); });
    canvas.addEventListener('pointercancel', clearPointer); canvas.addEventListener('lostpointercapture', () => { activePointer = null; });
    document.addEventListener('keydown', event => {
      if (!mergeActive()) return;
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'r' && !event.repeat) {
        if ($('end-dialog').open && !$('leaderboard-dialog').open) { event.preventDefault(); finishRound(); newGame(); }
        else if (!document.querySelector('dialog[open]')) { event.preventDefault(); askRestart(); }
        return;
      }
      if (document.querySelector('dialog[open]') || event.target.tagName === 'BUTTON') return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); game.aim(game.getState().aimX + (event.key === 'ArrowLeft' ? -12 : 12)); }
      else if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) drop(); }
    });
    document.addEventListener('visibilitychange', () => { syncPause(); if (!document.hidden) flushPending(); });
    window.addEventListener('blur', () => { windowFocused = false; syncPause(); });
    window.addEventListener('focus', () => { windowFocused = true; syncPause(); });
    window.addEventListener('feitian-modechange', () => { clearPointer(); callAudio('pause'); soundEnabled = window.GameSoundEnabled; callAudio('setEnabled', soundEnabled); updateSoundButton(); syncPause(); });
    window.addEventListener('feitian-soundchange', () => { soundEnabled = window.GameSoundEnabled; callAudio('setEnabled', soundEnabled); updateSoundButton(); });
    window.addEventListener('online', () => { refreshLeaderboard(); flushPending(); });
    window.addEventListener('storage', event => { if (event.key?.startsWith(OUTBOX_PREFIX)) { readPending(); updatePendingUI(); } });
    const resizeGame = () => { clearPointer(); game?.render(); };
    window.addEventListener('resize', resizeGame); window.addEventListener('orientationchange', resizeGame);
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('close', syncPause);
      dialog.addEventListener('click', event => { if (event.target !== dialog || dialog.id === 'end-dialog') return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog.id); });
    });
    $('end-dialog').addEventListener('cancel', event => event.preventDefault());
    $('leaderboard-button').addEventListener('click', openLeaderboard); $('end-leaderboard-button').addEventListener('click', openLeaderboard);
    $('restart-button').addEventListener('click', askRestart); $('confirm-restart-button').addEventListener('click', newGame); $('play-again-button').addEventListener('click', newGame);
    $('give-up-button').addEventListener('click', finishRound);
    $('revive-button').addEventListener('click', () => { if (game.revive()) { closeDialog('end-dialog'); toast('顶部已清空，继续合成'); } });
    $('sound-button').addEventListener('click', () => { soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled; storage.set('photo-merge-sound', soundEnabled ? 'on' : 'off'); callAudio('setEnabled', soundEnabled); updateSoundButton(); if (typeof window.Event === 'function') window.dispatchEvent(new window.Event('feitian-soundchange')); });
    $('leaderboard-refresh').addEventListener('click', () => { refreshLeaderboard(); flushPending(); });
    $('retry-pending-button').addEventListener('click', () => { refreshLeaderboard(); flushPending(); });
    $('submit-score-button').addEventListener('click', flushPending);
    $('recover-best-button').addEventListener('click', () => {
      if (!cloud.player || recoverableBest <= cloud.player.bestScore) return;
      recovery = { score: recoverableBest, ownerId: cloud.player.id };
      $('recover-description').textContent = '将此前本机最高 ' + recoverableBest.toLocaleString() + ' 分补传给当前玩家「' + cloud.player.name + '」。请确认这是你的成绩；不会覆盖更高的云端纪录。';
      showDialog('recover-dialog');
    });
    $('confirm-recover-button').addEventListener('click', () => {
      if (!recovery) return;
      const record = recovery; recovery = null;
      const duplicate = [...pendingScores.values()].some(item => item.ownerId === record.ownerId && item.score >= record.score);
      if (!duplicate) createPending(record.score, makeRoundId(), record.ownerId);
      closeDialog('recover-dialog'); flushPending();
    });
    $('nickname-form').addEventListener('submit', event => {
      event.preventDefault(); if (!cloud.player || profilePromise) return;
      const name = cleanName($('nickname-input').value), ownerId = cloud.player.id;
      profilePromise = enqueueWrite(async () => { cloudRevision++; const result = await leaderboard.updateProfile(name, ownerId); cloudRevision++; applyCloud(result); $('nickname-input').value = result.player.name; toast('昵称已更新，原玩家成绩保留'); }).catch(error => { cloudRevision++; handleCloudError(error); toast('昵称未保存：' + cloud.error); }).finally(() => { profilePromise = null; renderLeaderboard(); });
      renderLeaderboard();
    });
    readPending(); refreshLeaderboard(); flushPending();
  }
  try { init(); } catch (error) { console.error(error); const message = document.createElement('div'); message.className = 'fatal-error'; message.textContent = error.message || '游戏启动失败，请刷新后重试。'; document.body.append(message); }
})();
