(function (root) {
  'use strict';
  function initJumpLeaderboard(document, window, options = {}) {
    const $ = id => document.getElementById(id);
    const prefix = 'feitian-jump-pending-score-v1:';
    const validScore = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
    const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
    const cleanName = value => [...String(value || '').trim().normalize('NFC')].slice(0, 24).join('').trim() || '玩家';
    const store = {
      get(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
      set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
      remove(key) { try { window.localStorage.removeItem(key); return true; } catch { return false; } },
      keys() { try { return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter(Boolean); } catch { return null; } },
    };
    let service;
    try { service = new window.SharedLeaderboard({ mode: 'jump' }); }
    catch (_) {
      service = { online: /^https?:$/.test(window.location?.protocol || ''), configured: false,
        config: window.SUPABASE_CONFIG || {}, getPlayerId: () => null,
        list: () => Promise.reject(new Error('排行榜组件未加载，游戏可继续；请刷新后重试。')) };
    }
    const cloud = { rows: [], player: null, ready: false, loading: false, error: '' };
    const pending = new Map(), rounds = new Map();
    const priorBest = Number(store.get('feitian-jump-best-v2', '0'));
    const recoverableBest = validScore(priorBest) ? priorBest : 0;
    let latest = null, revision = 0, writeTail = Promise.resolve(), flushing = null, refreshing = null, profiling = null;
    let emittedStatus = '', profileNote = '';

    function set(id, key, value) { const element = $(id); if (element && element[key] !== value) element[key] = value; }
    function listen(id, type, callback) { $(id)?.addEventListener(type, callback); }
    function safeCallback(name, value) { try { options[name]?.(value); } catch (_) { /* Optional host UI cannot interrupt a score submission. */ } }
    function keyFor(record) { return prefix + encodeURIComponent(record.project) + ':' + record.id; }
    function makeId() { return window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
    function save(record) {
      const { id, score, ownerId, project, endedAt } = record;
      record.saved = store.set(keyFor(record), JSON.stringify({ version: 1, id, score, ownerId, project, endedAt }));
    }
    function notice(record) { return record.saved ? '成绩已保存在本浏览器，联网后可重试。' : '成绩暂存在本页，请勿关闭或刷新。'; }
    function eligible(record, playerId = service.getPlayerId()) { return Boolean(record.ownerId && record.ownerId === playerId || !record.ownerId && record.claimable); }
    function readPending() {
      const keys = store.keys(); if (!keys) return;
      for (const record of pending.values()) {
        if (record.saved && !record.pending && !keys.includes(keyFor(record))) {
          pending.delete(record.id); record.externalRemoved = true;
          record.message = '此待上传记录已在另一页面处理，请刷新排行榜确认。';
        }
      }
      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;
        try {
          const item = JSON.parse(store.get(key, 'null'));
          if (!item || item.version !== 1 || item.project !== service.config.url || !validId(item.id) || !validScore(item.score) ||
            !Number.isFinite(item.endedAt) || item.endedAt <= 0 ||
            !(item.ownerId === null || typeof item.ownerId === 'string' && item.ownerId.length > 0 && item.ownerId.length <= 128) || key !== keyFor(item)) continue;
          if (rounds.get(item.id)?.submitted) continue;
          const current = pending.get(item.id);
          if (!current) {
            const restored = { ...item, saved: true, claimable: false, pending: false, submitted: false, attempted: true, message: '' };
            pending.set(item.id, restored); rounds.set(item.id, restored);
          } else if (!current.pending && current.ownerId === null && item.ownerId && current.score === item.score && current.endedAt === item.endedAt) {
            current.ownerId = item.ownerId; current.claimable = false;
          }
        } catch (_) { /* Malformed or foreign records remain untouched. */ }
      }
    }
    function enqueue(work) { const job = writeTail.then(work, work); writeTail = job.catch(() => {}); return job; }
    function snapshot(record = latest) {
      return record ? { roundId: record.id, score: record.score, message: record.message, pending: record.pending, submitted: record.submitted } : null;
    }
    function renderSubmission() {
      set('jump-submit-status', 'textContent', latest?.message || '');
      set('jump-submit-retry', 'hidden', !latest || !service.online || !service.configured || latest.submitted || latest.pending || latest.externalRemoved || !eligible(latest));
      set('jump-submit-retry', 'disabled', Boolean(flushing));
      const status = snapshot(), signature = JSON.stringify(status);
      if (signature !== emittedStatus) { emittedStatus = signature; safeCallback('onStatus', status); }
    }
    function render() {
      const records = [...pending.values()].filter(record => !record.submitted);
      const unbound = records.filter(record => !eligible(record)).length;
      set('jump-lb-status', 'textContent', !service.online ? '请从在线游戏打开跳跃共享榜。' : cloud.loading ? '正在连接跳跃共享榜…' :
        cloud.error || profileNote || (cloud.player ? '已连接 · ' + cloud.player.name + '（本浏览器玩家）' : '匿名玩家尚未连接，请重试。'));
      $('jump-lb-status')?.classList.toggle('connection-error', Boolean(cloud.error));
      set('jump-lb-refresh', 'hidden', !service.online); set('jump-lb-refresh', 'disabled', cloud.loading);
      set('jump-lb-refresh', 'textContent', cloud.error || !cloud.player ? '重新连接' : '刷新榜单');
      set('jump-lb-pending', 'hidden', records.length === 0);
      set('jump-lb-pending', 'textContent', records.length ? (flushing ? '正在补传成绩… ' : '有 ' + records.length + ' 局成绩待上传。 ') +
        (records.some(record => !record.saved) ? '部分成绩仅暂存在本页，请勿关闭或刷新。' : '成绩已保存在本浏览器。') +
        (unbound ? ' 部分记录归属未确认或属于其他玩家，未自动上传。' : '') : '');
      set('jump-lb-retry', 'hidden', !service.online || records.length === 0); set('jump-lb-retry', 'disabled', Boolean(flushing));
      set('jump-lb-recover', 'hidden', !service.online || !cloud.player || recoverableBest <= cloud.player.bestScore);
      set('jump-lb-form', 'hidden', !cloud.player); set('jump-lb-name', 'disabled', Boolean(profiling)); set('jump-lb-save', 'disabled', Boolean(profiling));
      if (cloud.player && document.activeElement !== $('jump-lb-name')) set('jump-lb-name', 'value', cloud.player.name);
      set('jump-lb-empty', 'hidden', !service.online || cloud.loading || !cloud.ready || cloud.rows.length > 0);
      set('jump-lb-table', 'hidden', !service.online || !cloud.ready || cloud.rows.length === 0);
      const body = $('jump-lb-body');
      if (body) {
        body.replaceChildren();
        for (const entry of cloud.rows) {
          const row = document.createElement('tr'); row.title = new Date(entry.endedAt).toLocaleString('zh-CN');
          for (const value of [String(entry.rank), entry.name, entry.score.toLocaleString()]) {
            const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
          }
          body.append(row);
        }
      }
      renderSubmission();
    }
    function apply(data) { cloud.rows = data.rows; cloud.player = data.player; cloud.ready = true; cloud.error = ''; }
    function failed(error) {
      cloud.error = error?.message || '共享榜暂不可用，请稍后重试。';
      if (error?.status === 401 || error?.code === 'PLAYER_IDENTITY_CHANGED') cloud.player = null;
    }
    function refresh() {
      if (!service.online) { render(); return Promise.resolve(); }
      if (refreshing) return refreshing;
      cloud.loading = true; profileNote = ''; render();
      const startRevision = revision;
      refreshing = Promise.resolve().then(() => service.list()).then(data => { if (startRevision === revision) apply(data); })
        .catch(error => { if (startRevision === revision) failed(error); })
        .finally(() => { cloud.loading = false; refreshing = null; render(); });
      return refreshing;
    }
    async function submit(record) {
      if (record.pending || record.submitted || record.externalRemoved) return;
      record.pending = true; record.message = '正在提交本局成绩… ' + notice(record); renderSubmission();
      try {
        await enqueue(async () => {
          // Listing is independent: a failed leaderboard read must not block a score write.
          const session = await service.ensureSession(), playerId = session.user.id;
          if (!record.ownerId && record.claimable) { record.ownerId = playerId; record.claimable = false; save(record); }
          if (!record.ownerId || record.ownerId !== playerId) throw new Error('成绩归属未确认或玩家身份已变化，记录已保留，未自动上传。');
          record.attempted = true; revision++;
          const result = await service.submitScore(record.score, record.id, cloud.player?.id === playerId ? cloud.player.name : '玩家', record.ownerId);
          if (result.player?.id !== record.ownerId || result.bestScore < record.score) throw new Error('服务器尚未确认这份成绩，请重试。');
          revision++; apply(result);
          record.message = result.updated ? (result.rank && result.rank <= 20 ? '已更新跳跃最高分 · 第 ' + result.rank + ' 名' : '已更新个人最高分，暂未进入前 20 名') :
            '已确认上传；本局未超过个人最高 ' + result.bestScore.toLocaleString() + ' 分，原纪录保留。';
        });
        record.submitted = true; pending.delete(record.id); store.remove(keyFor(record));
      } catch (error) {
        revision++; failed(error);
        record.message = (record.attempted ? '上传未确认：' : '本局未上传：') + cloud.error + ' ' + notice(record);
      } finally { record.pending = false; render(); }
    }
    function flush() {
      if (!service.online || !service.configured) { render(); return Promise.resolve(); }
      if (flushing) return flushing;
      readPending();
      if (!pending.size) { render(); return Promise.resolve(); }
      const attempted = new Set();
      flushing = Promise.resolve().then(async () => {
        try { await service.ensureSession(); }
        catch (error) {
          revision++; failed(error);
          for (const record of pending.values()) if (!record.submitted) record.message = '本局未上传：' + cloud.error + ' ' + notice(record);
          return;
        }
        while (true) {
          const record = [...pending.values()].find(item => !attempted.has(item.id) && !item.submitted && eligible(item));
          if (!record) break;
          attempted.add(record.id); await submit(record);
          if (!record.submitted) break;
        }
      }).finally(() => { flushing = null; render(); });
      render(); return flushing;
    }
    function create(score, id, ownerId = service.getPlayerId()) {
      const record = { id, score, ownerId, project: service.config.url || '', endedAt: Date.now(), claimable: !ownerId,
        pending: false, submitted: false, attempted: false, saved: false, message: '成绩等待上传。' };
      rounds.set(id, record);
      if (service.configured) { save(record); pending.set(id, record); }
      return record;
    }
    function record(score, roundId) {
      if (!validScore(score) || !validId(roundId)) return Promise.resolve({ message: '本局成绩或标识无效，未上传。', submitted: false });
      if (rounds.has(roundId)) {
        const previous = rounds.get(roundId);
        if (previous.score !== score) return Promise.resolve({ message: '同一局的成绩不一致，原记录已保留。', submitted: false });
        latest = previous;
      } else latest = create(score, roundId);
      if (!service.online || !service.configured) latest.message = !service.online ? '本局未上传；请从在线游戏打开共享榜。' : '共享榜暂未连接，本机成绩保留。';
      const current = latest;
      render(); return flush().then(() => snapshot(current));
    }
    function changed(open) {
      if (typeof window.CustomEvent === 'function') window.dispatchEvent(new window.CustomEvent('feitian-jump-boardchange', { detail: { open } }));
      safeCallback(open ? 'onOpen' : 'onClose');
    }
    function open() {
      const dialog = $('jump-lb-dialog');
      if (!dialog) return Promise.resolve();
      if (!dialog.open) {
        try { dialog.showModal(); changed(true); }
        catch (error) { failed(error); render(); return Promise.resolve(); }
      }
      return Promise.all([refresh(), flush()]);
    }
    function recover() {
      if (!cloud.player || recoverableBest <= cloud.player.bestScore) return;
      const ownerId = cloud.player.id;
      if (!window.confirm('将此前跳跃最高 ' + recoverableBest.toLocaleString() + ' 分补传给当前玩家「' + cloud.player.name + '」。请确认这是你的成绩；不会覆盖更高的云端纪录。')) return;
      if (![...pending.values()].some(item => item.ownerId === ownerId && item.score >= recoverableBest)) create(recoverableBest, makeId(), ownerId);
      flush();
    }
    listen('jump-leaderboard-button', 'click', open); listen('jump-end-leaderboard-button', 'click', open);
    listen('jump-lb-close', 'click', () => $('jump-lb-dialog')?.close());
    listen('jump-lb-dialog', 'close', () => changed(false));
    for (const id of ['jump-lb-refresh', 'jump-lb-retry']) listen(id, 'click', () => { refresh(); flush(); });
    listen('jump-submit-retry', 'click', flush); listen('jump-lb-recover', 'click', recover);
    listen('jump-lb-form', 'submit', event => {
      event.preventDefault(); if (!cloud.player || profiling) return;
      const nickname = cleanName($('jump-lb-name')?.value), ownerId = cloud.player.id;
      profiling = enqueue(async () => {
        revision++; const result = await service.updateProfile(nickname, ownerId);
        if (result.player?.id !== ownerId) throw new Error('玩家身份已变化，昵称未确认保存。');
        revision++; apply(result); set('jump-lb-name', 'value', result.player.name); profileNote = '昵称已更新，原玩家成绩保留。';
      }).catch(error => { revision++; failed(error); })
        .finally(() => { profiling = null; render(); });
      render();
    });
    window.addEventListener('online', () => { refresh(); flush(); });
    window.addEventListener('focus', flush);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
    window.addEventListener('storage', event => { if (event.key === null || event.key?.startsWith(prefix)) { readPending(); render(); } });
    readPending(); render();
    const ready = Promise.all([refresh(), flush()]);
    return { record, open, refresh, flush, ready, get status() { return snapshot(); } };
  }
  root.JumpLeaderboard = class JumpLeaderboard { constructor(options) { return initJumpLeaderboard(root.document, root, options); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = initJumpLeaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
