(function (global) {
  'use strict';
  const isScore = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
  const isRank = value => value === null || (Number.isSafeInteger(value) && value > 0);
  const isTimeout = error => error?.code === 'LEADERBOARD_TIMEOUT' || /网络超时/.test(error?.message || '');
  function timeoutError() { const error = new Error('网络超时，请检查连接后重试。'); error.code = 'LEADERBOARD_TIMEOUT'; return error; }
  function identityError() { const error = new Error('浏览器玩家身份已变化，原玩家的待提交成绩已保留。'); error.code = 'PLAYER_IDENTITY_CHANGED'; return error; }
  function readRows(rows) {
    if (!Array.isArray(rows) || rows.length > 20 || rows.some(row => !row || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > 20 || typeof row.name !== 'string' || !isScore(row.score) || !Number.isFinite(row.endedAt) || row.endedAt <= 0)) throw new Error('排行榜响应格式有误，请稍后重试。');
    return rows.map(({ rank, name, score, endedAt }) => ({ rank, name, score, endedAt }));
  }
  function readPlayer(player) {
    if (player === null) return null;
    if (!player || typeof player.id !== 'string' || !player.id || typeof player.name !== 'string' || !isScore(player.bestScore) || !isRank(player.rank)) throw new Error('玩家状态响应有误，请刷新排行榜。');
    return { id: player.id, name: player.name, bestScore: player.bestScore, rank: player.rank };
  }
  const rpcNames = {
    merge: { list: 'feitian_leaderboard', submit: 'feitian_submit_score', profile: 'feitian_update_profile' },
    jump: { list: 'feitian_jump_leaderboard', submit: 'feitian_jump_submit_score', profile: 'feitian_jump_update_profile' },
    defense: { list: 'feitian_defense_leaderboard', submit: 'feitian_defense_submit_score', profile: 'feitian_defense_update_profile' },
  };
  const transports = [];
  const newTransport = () => ({ client: null, sessionPromise: null, anonymousAttempted: false, hadSession: false, playerId: null, sessionOperation: null });
  class SharedLeaderboard {
    constructor(options = {}) {
      this.mode = options.mode === undefined ? 'merge' : options.mode;
      if (!Object.prototype.hasOwnProperty.call(rpcNames, this.mode)) throw new Error('未知的排行榜模式。');
      this.online = /^https?:$/.test(global.location?.protocol || '');
      this.config = global.SUPABASE_CONFIG || {};
      this.configured = Boolean(this.config.url && this.config.publishableKey && this.config.authMode === 'anonymous');
      this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 15000;
      this.fetchTimeoutMs = Number.isFinite(options.fetchTimeoutMs) && options.fetchTimeoutMs > 0 ? options.fetchTimeoutMs : 10000;
      this._transport = null;
      this._unloadedTransport = newTransport();
    }
    sharedTransport() {
      if (this._transport) return this._transport;
      const factory = global.supabase?.createClient;
      // A delayed SDK load must remain recoverable without pooling a failed
      // initialization or constructing a second GoTrue client for another mode.
      if (typeof factory !== 'function') return this._unloadedTransport;
      const key = [this.config.url, this.config.publishableKey, this.config.authMode, this.config.gatewayUrl || '', factory, global.fetch, this.timeoutMs, this.fetchTimeoutMs];
      let entry = transports.find(candidate => candidate.key.every((value, index) => value === key[index]));
      if (!entry) { entry = { key, state: newTransport() }; transports.push(entry); }
      this._transport = entry.state;
      return this._transport;
    }
    get client() { return this.sharedTransport().client; }
    set client(value) { this.sharedTransport().client = value; }
    get sessionPromise() { return this.sharedTransport().sessionPromise; }
    set sessionPromise(value) { this.sharedTransport().sessionPromise = value; }
    get anonymousAttempted() { return this.sharedTransport().anonymousAttempted; }
    set anonymousAttempted(value) { this.sharedTransport().anonymousAttempted = value; }
    get hadSession() { return this.sharedTransport().hadSession; }
    set hadSession(value) { this.sharedTransport().hadSession = value; }
    get playerId() { return this.sharedTransport().playerId; }
    set playerId(value) { this.sharedTransport().playerId = value; }
    get sessionOperation() { return this.sharedTransport().sessionOperation; }
    set sessionOperation(value) { this.sharedTransport().sessionOperation = value; }
    getPlayerId() { return this.playerId; }
    async bounded(work, milliseconds, parentSignals = []) {
      const controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
      const operation = { signal: controller?.signal, error: null, check() { if (this.error) throw this.error; } };
      let rejectStopped;
      const stopped = new Promise((_, reject) => { rejectStopped = reject; });
      const stop = error => {
        if (operation.error) return;
        operation.error = error;
        rejectStopped(error);
        controller?.abort(error);
      };
      const timer = setTimeout(() => stop(timeoutError()), milliseconds);
      const listeners = parentSignals.filter(Boolean).map(signal => {
        const listener = () => stop(signal.reason || timeoutError());
        if (signal.aborted) listener();
        else signal.addEventListener('abort', listener, { once: true });
        return [signal, listener];
      });
      try {
        return await Promise.race([Promise.resolve().then(() => { operation.check(); return work(operation); }), stopped]);
      } finally {
        clearTimeout(timer);
        for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener);
      }
    }
    gatewayInput(input, init) {
      if (!this.config.gatewayUrl) return input;
      const gateway = new global.URL(this.config.gatewayUrl);
      if (gateway.protocol !== 'https:' || gateway.username || gateway.password || gateway.search || gateway.hash || gateway.pathname !== '/') {
        throw new Error('排行榜入口配置无效，请联系游戏维护者。');
      }
      const original = new global.URL(typeof input === 'string' ? input : input?.url || String(input));
      const project = new global.URL(this.config.url);
      if (original.origin !== project.origin || original.username || original.password) return input;
      const method = (init.method || input?.method || 'GET').toUpperCase();
      const path = original.pathname;
      const allowed = method === 'POST' && (path === '/auth/v1/signup' ||
        path === '/auth/v1/token' && original.searchParams.get('grant_type') === 'refresh_token' ||
        Object.values(rpcNames).some(names => Object.values(names).some(name => path === '/rest/v1/rpc/' + name))) ||
        method === 'GET' && path === '/auth/v1/user';
      if (!allowed) return input;
      const destination = gateway.origin + path + original.search;
      // Keep createClient on the original project URL: its auth storage key and
      // the pending-score project binding must survive a gateway change.
      return typeof global.Request === 'function' && input instanceof global.Request ? new global.Request(destination, input) : destination;
    }
    fetchWithTimeout(input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const authSignal = url.startsWith(this.config.url.replace(/\/$/, '') + '/auth/v1/') ? this.sessionOperation?.signal : null;
      return this.bounded(async operation => {
        const routedInput = this.gatewayInput(input, init);
        // Supplying an init object can reset a Request's referrer settings.
        const requestPolicy = routedInput !== input && typeof global.Request === 'function' && routedInput instanceof global.Request ?
          { referrer: routedInput.referrer, referrerPolicy: routedInput.referrerPolicy } : {};
        const response = await global.fetch(routedInput, { ...requestPolicy, ...init, ...(operation.signal ? { signal: operation.signal } : {}) });
        // Supabase responses are small JSON payloads. Drain a clone so the timer
        // also covers a stalled response body, not only arrival of its headers.
        if (response.body) await response.clone().arrayBuffer();
        operation.check();
        return response;
      }, this.fetchTimeoutMs, [init.signal || input?.signal, authSignal]);
    }
    getClient() {
      if (!this.online) throw new Error('请从在线游戏打开共享榜。');
      if (!this.configured) throw new Error('尚未连接 Supabase 排行榜，游戏可正常进行。');
      if (typeof global.supabase?.createClient !== 'function') throw new Error('排行榜组件未加载，请刷新页面。');
      if (!this.client) this.client = global.supabase.createClient(this.config.url, this.config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        ...(typeof global.fetch === 'function' ? { global: { fetch: (input, init) => this.fetchWithTimeout(input, init) } } : {}),
      });
      return this.client;
    }
    ensureSession() {
      if (this.sessionPromise) return this.sessionPromise;
      let activeOperation;
      this.sessionPromise = this.bounded(async operation => {
        activeOperation = this.sessionOperation = operation;
        return this.resolveSession(operation);
      }, this.timeoutMs).finally(() => {
        if (this.sessionOperation === activeOperation) this.sessionOperation = null;
        this.sessionPromise = null;
      });
      return this.sessionPromise;
    }
    async resolveSession(operation) {
      const client = this.getClient();
      let existing;
      try { existing = await client.auth.getSession(); } catch (error) { if (isTimeout(error)) throw timeoutError(); throw new Error('匿名玩家会话检查失败，请稍后重试。'); }
      if (existing.data?.session?.user?.id) this.hadSession = true;
      operation.check();
      if (isTimeout(existing.error)) throw timeoutError();
      if (existing.error) throw new Error('匿名玩家会话暂不可用，请稍后重试。');
      if (existing.data?.session?.user?.id) { this.playerId = existing.data.session.user.id; return existing.data.session; }
      this.playerId = null;
      if (this.hadSession) throw new Error('浏览器玩家身份已失效，请刷新页面后重试。');
      if (this.anonymousAttempted) throw new Error('匿名玩家连接未完成，请刷新页面后重试。');
      // A failed request may have created a session remotely. Never retry sign-up
      // blindly in this page; subsequent attempts first inspect SDK persistence.
      this.anonymousAttempted = true;
      let created;
      try { created = await client.auth.signInAnonymously(); } catch (error) { if (isTimeout(error)) throw timeoutError(); throw new Error('匿名玩家连接失败，请检查网络并刷新页面重试。'); }
      if (created.data?.session?.user?.id) this.hadSession = true;
      operation.check();
      if (isTimeout(created.error)) throw timeoutError();
      if (created.error || !created.data?.session?.user?.id) throw new Error('无法建立匿名玩家，请稍后刷新重试；游戏仍可继续。');
      this.hadSession = true; this.playerId = created.data.session.user.id; return created.data.session;
    }
    async request(name, parameters, expectedPlayerId) {
      return this.bounded(async operation => {
        const session = await this.ensureSession();
        operation.check();
        if (expectedPlayerId && session.user.id !== expectedPlayerId) throw identityError();
        let result;
        try {
          let query = this.client.rpc(name, parameters);
          if (operation.signal && typeof query.abortSignal === 'function') query = query.abortSignal(operation.signal);
          // The SDK may receive an identity change from another tab while it
          // prepares this request. Keep this RPC bound to the checked session.
          if (session.access_token && typeof query.setHeader === 'function') query = query.setHeader('Authorization', 'Bearer ' + session.access_token);
          result = await query;
        } catch (error) { if (isTimeout(error)) throw timeoutError(); throw new Error('连接失败，请检查网络后重试。'); }
        operation.check();
        if (result.error) {
          if (isTimeout(result.error)) throw timeoutError();
          const error = new Error(result.error.message || '共享榜请求失败，请重试。');
          error.status = result.status || result.error.status; throw error;
        }
        const data = result.data;
        if (!data || typeof data !== 'object') throw new Error('共享榜响应格式有误，请稍后重试。');
        if (expectedPlayerId && data.player?.id !== expectedPlayerId) throw identityError();
        return data;
      }, this.timeoutMs);
    }
    async list() {
      const data = await this.request(rpcNames[this.mode].list);
      return { rows: readRows(data.rows), player: readPlayer(data.player) };
    }
    async submitScore(score, roundId, nickname, expectedPlayerId) {
      const data = await this.request(rpcNames[this.mode].submit, { p_score: score, p_round_id: roundId, p_nickname: nickname }, expectedPlayerId);
      if (typeof data.updated !== 'boolean' || !isRank(data.rank) || !isScore(data.bestScore)) throw new Error('成绩响应格式有误，请重试确认。');
      if (!data.player) throw new Error('玩家状态响应有误，请刷新排行榜。');
      return { updated: data.updated, rank: data.rank, bestScore: data.bestScore, rows: readRows(data.rows), player: readPlayer(data.player) };
    }
    async updateProfile(nickname, expectedPlayerId) {
      const data = await this.request(rpcNames[this.mode].profile, { p_nickname: nickname }, expectedPlayerId);
      if (!data.player) throw new Error('玩家状态响应有误，请刷新排行榜。');
      return { rows: readRows(data.rows), player: readPlayer(data.player) };
    }
  }
  global.SharedLeaderboard = SharedLeaderboard;
  if (typeof module !== 'undefined' && module.exports) module.exports = SharedLeaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
