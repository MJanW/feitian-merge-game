(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const BEST_KEY = 'feitian-best-naiwa-v1';
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } },
  };
  const validScore = value => Number.isFinite(value) && value >= 0 && Number.isInteger(value);
  const cleanName = value => [...String(value || '').trim().normalize('NFC')].slice(0, 24).join('').trim() || '玩家';
  const storedBest = Number(storage.get(BEST_KEY, '0'));
  let best = validScore(storedBest) ? storedBest : 0;
  let soundEnabled = storage.get('photo-merge-sound', 'on') !== 'off';
  let game, audio, levels, lastState, toastTimer;
  let activePointer = null;
  let roundId = makeRoundId();
  let roundRecorded = false;
  let submission = null;
  let leaderboard, refreshPromise = null, profilePromise = null;
  let cloudRevision = 0;
  let mutationSerial = 0, appliedMutation = 0;
  const cloud = { rows: [], player: null, ready: false, loading: false, error: '' };

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
  function syncPause() {
    if (!game) return;
    const paused = document.hidden || Boolean(document.querySelector('dialog[open]'));
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
  function openLeaderboard() { showDialog('leaderboard-dialog'); refreshLeaderboard(); }
  function updateSubmissionUI() {
    if (!submission) { $('submit-score-button').hidden = true; return; }
    $('result-note').textContent = submission.message;
    $('submit-score-button').hidden = !leaderboard.online || !leaderboard.configured || submission.submitted || submission.pending;
    $('submit-score-button').textContent = submission.attempted ? '重试上传本局成绩' : '提交本局成绩';
  }
  async function submitRound(record) {
    if (!record || record.pending || record.submitted) return;
    if (!leaderboard.online) { record.message = '本局未上传；请从在线游戏打开共享榜。'; updateSubmissionUI(); return; }
    record.pending = true; record.message = '正在提交本局成绩…'; updateSubmissionUI();
    if (!cloud.ready || !cloud.player || refreshPromise) await (refreshPromise || refreshLeaderboard());
    if (profilePromise) await profilePromise;
    if (!cloud.player) {
      record.pending = false; record.message = cloud.error ? '本局未上传：' + cloud.error : '本局未上传；匿名玩家尚未连接，请重试。';
      if (record === submission) updateSubmissionUI(); return;
    }
    record.attempted = true;
    const mutation = ++mutationSerial;
    try {
      const result = await leaderboard.submitScore(record.score, record.id, cloud.player.name);
      if (mutation >= appliedMutation) { appliedMutation = mutation; cloudRevision++; applyCloud(result); }
      record.submitted = true;
      record.message = result.updated ? (result.rank && result.rank <= 20 ? '已更新共享最高分 · 第 ' + result.rank + ' 名' : '已更新个人最高分，暂未进入前 20 名') : '本局未超过个人最高 ' + result.bestScore.toLocaleString() + ' 分，原纪录保留。';
    } catch (error) { if (mutation >= appliedMutation) handleCloudError(error); record.message = (error.status === 401 ? '本局未上传：' : '上传未确认，请重试：') + (error.message || '共享榜暂不可用'); }
    finally { record.pending = false; renderLeaderboard(); }
  }
  function recordRound(state) {
    if (roundRecorded) return;
    roundRecorded = true;
    submission = { id: roundId, score: state.score, pending: false, submitted: false, attempted: false, message: '' };
    submitRound(submission);
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
    syncPause(); const canvas = $('game-canvas');
    document.addEventListener('pointerdown', event => { if (event.isTrusted) callAudio('unlock'); }, { capture: true });
    document.addEventListener('keydown', event => { if (event.isTrusted) callAudio('unlock'); }, { capture: true });
    canvas.addEventListener('pointermove', event => { if (!document.querySelector('dialog[open]') && (event.pointerType === 'mouse' || event.pointerId === activePointer)) aimFromEvent(event); });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || activePointer !== null || document.querySelector('dialog[open]')) return;
      event.preventDefault(); activePointer = event.pointerId; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); aimFromEvent(event);
    });
    canvas.addEventListener('pointerup', event => { if (activePointer !== event.pointerId) return; clearPointer(); aimFromEvent(event); if (!document.querySelector('dialog[open]')) drop(); });
    canvas.addEventListener('pointercancel', clearPointer); canvas.addEventListener('lostpointercapture', () => { activePointer = null; });
    document.addEventListener('keydown', event => {
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
    document.addEventListener('visibilitychange', syncPause); window.addEventListener('blur', () => { clearPointer(); callAudio('pause'); }); window.addEventListener('resize', () => game.render());
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
    $('sound-button').addEventListener('click', () => { soundEnabled = !soundEnabled; storage.set('photo-merge-sound', soundEnabled ? 'on' : 'off'); callAudio('setEnabled', soundEnabled); updateSoundButton(); });
    $('leaderboard-refresh').addEventListener('click', refreshLeaderboard);
    $('submit-score-button').addEventListener('click', () => submitRound(submission));
    $('nickname-form').addEventListener('submit', event => {
      event.preventDefault(); if (!cloud.player || profilePromise) return;
      const name = cleanName($('nickname-input').value);
      const mutation = ++mutationSerial;
      profilePromise = leaderboard.updateProfile(name).then(result => { if (mutation >= appliedMutation) { appliedMutation = mutation; cloudRevision++; applyCloud(result); } $('nickname-input').value = result.player.name; toast('昵称已更新，原玩家成绩保留'); }).catch(error => { handleCloudError(error); toast('昵称未保存：' + cloud.error); }).finally(() => { profilePromise = null; renderLeaderboard(); });
      renderLeaderboard();
    });
    refreshLeaderboard();
  }
  try { init(); } catch (error) { console.error(error); const message = document.createElement('div'); message.className = 'fatal-error'; message.textContent = error.message || '游戏启动失败，请刷新后重试。'; document.body.append(message); }
})();
