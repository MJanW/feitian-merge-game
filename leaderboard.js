(function (global) {
  'use strict';
  const isScore = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
  const isRank = value => value === null || (Number.isSafeInteger(value) && value > 0);
  function readRows(rows) {
    if (!Array.isArray(rows) || rows.length > 20 || rows.some(row => !row || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > 20 || typeof row.name !== 'string' || !isScore(row.score) || !Number.isFinite(row.endedAt) || row.endedAt <= 0)) throw new Error('排行榜响应格式有误，请稍后重试。');
    return rows.map(({ rank, name, score, endedAt }) => ({ rank, name, score, endedAt }));
  }
  function readPlayer(player) {
    if (player === null) return null;
    if (!player || typeof player.id !== 'string' || !player.id || typeof player.name !== 'string' || !isScore(player.bestScore) || !isRank(player.rank)) throw new Error('玩家状态响应有误，请刷新排行榜。');
    return { id: player.id, name: player.name, bestScore: player.bestScore, rank: player.rank };
  }
  class SharedLeaderboard {
    constructor() {
      this.online = /^https?:$/.test(global.location?.protocol || '');
      this.config = global.SUPABASE_CONFIG || {};
      this.configured = Boolean(this.config.url && this.config.publishableKey && this.config.authMode === 'anonymous');
      this.client = null; this.sessionPromise = null; this.anonymousAttempted = false; this.hadSession = false;
    }
    getClient() {
      if (!this.online) throw new Error('请从在线游戏打开共享榜。');
      if (!this.configured) throw new Error('尚未连接 Supabase 排行榜，游戏可正常进行。');
      if (typeof global.supabase?.createClient !== 'function') throw new Error('排行榜组件未加载，请刷新页面。');
      if (!this.client) this.client = global.supabase.createClient(this.config.url, this.config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      return this.client;
    }
    ensureSession() {
      if (this.sessionPromise) return this.sessionPromise;
      this.sessionPromise = this.resolveSession().finally(() => { this.sessionPromise = null; });
      return this.sessionPromise;
    }
    async resolveSession() {
      const client = this.getClient();
      let existing;
      try { existing = await client.auth.getSession(); } catch { throw new Error('匿名玩家会话检查失败，请稍后重试。'); }
      if (existing.error) throw new Error('匿名玩家会话暂不可用，请稍后重试。');
      if (existing.data?.session?.user?.id) { this.hadSession = true; return existing.data.session; }
      if (this.hadSession) throw new Error('浏览器玩家身份已失效，请刷新页面后重试。');
      if (this.anonymousAttempted) throw new Error('匿名玩家连接未完成，请刷新页面后重试。');
      // A failed request may have created a session remotely. Never retry sign-up
      // blindly in this page; subsequent attempts first inspect SDK persistence.
      this.anonymousAttempted = true;
      let created;
      try { created = await client.auth.signInAnonymously(); } catch { throw new Error('匿名玩家连接失败，请检查网络并刷新页面重试。'); }
      if (created.error || !created.data?.session?.user?.id) throw new Error('无法建立匿名玩家，请稍后刷新重试；游戏仍可继续。');
      this.hadSession = true; return created.data.session;
    }
    async request(name, parameters) {
      await this.ensureSession();
      let result;
      try { result = await this.client.rpc(name, parameters); } catch { throw new Error('连接失败，请检查网络后重试。'); }
      if (result.error) {
        const error = new Error(result.error.message || '共享榜请求失败，请重试。');
        error.status = result.status || result.error.status; throw error;
      }
      const data = result.data;
      if (!data || typeof data !== 'object') throw new Error('共享榜响应格式有误，请稍后重试。');
      return data;
    }
    async list() {
      const data = await this.request('feitian_leaderboard');
      return { rows: readRows(data.rows), player: readPlayer(data.player) };
    }
    async submitScore(score, roundId, nickname) {
      const data = await this.request('feitian_submit_score', { p_score: score, p_round_id: roundId, p_nickname: nickname });
      if (typeof data.updated !== 'boolean' || !isRank(data.rank) || !isScore(data.bestScore)) throw new Error('成绩响应格式有误，请重试确认。');
      if (!data.player) throw new Error('玩家状态响应有误，请刷新排行榜。');
      return { updated: data.updated, rank: data.rank, bestScore: data.bestScore, rows: readRows(data.rows), player: readPlayer(data.player) };
    }
    async updateProfile(nickname) {
      const data = await this.request('feitian_update_profile', { p_nickname: nickname });
      if (!data.player) throw new Error('玩家状态响应有误，请刷新排行榜。');
      return { rows: readRows(data.rows), player: readPlayer(data.player) };
    }
  }
  global.SharedLeaderboard = SharedLeaderboard;
  if (typeof module !== 'undefined' && module.exports) module.exports = SharedLeaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
