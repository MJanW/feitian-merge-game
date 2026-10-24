(function (root) {
  'use strict';

  // Keep these keys and level IDs stable when shipping new artwork, levels or builds.
  // Schema revisions belong inside the record, never in a new storage key.
  const PRIMARY = 'feitian-garden-progress';
  const BACKUP = 'feitian-garden-progress-backup';
  const WORLD = 'feitian-garden-world-completed-v1';
  const CLASSIC = 'feitian-garden-classic-completed-v1';
  const DEMO = 'feitian-garden-completed-v1';
  const SEED = 'feitian-garden-world-seed-v1';
  const RECEIPT = 'feitian-garden-clear:', FRONTIER = 'feitian-garden-unlocked:', RECOVERY = 'feitian-garden-recovery:';
  const KEYS = Object.freeze({ primary: PRIMARY, backup: BACKUP, world: WORLD, classic: CLASSIC, demo: DEMO, seed: SEED, receipt: RECEIPT, frontier: FRONTIER, recovery: RECOVERY });
  const RECORD_KEYS = [PRIMARY, BACKUP], LEGACY_KEYS = [WORLD, CLASSIC, DEMO];
  const MAX_BYTES = 256 * 1024, MAX_IDS = 4096, MAX_ORDER = 100000, MAX_SEED = 4294967295;
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id);
  const validSeed = seed => Number.isSafeInteger(seed) && seed > 0 && seed <= MAX_SEED;

  function byteLength(text) {
    let bytes = 0;
    for (const character of text) { const point = character.codePointAt(0); bytes += point <= 127 ? 1 : point <= 2047 ? 2 : point <= 65535 ? 3 : 4; }
    return bytes;
  }
  function orderFor(id) {
    const match = /^(garden|pool|western)-(10|[1-9])$/.exec(id);
    return match ? ['garden', 'pool', 'western'].indexOf(match[1]) * 10 + Number(match[2]) : 0;
  }
  function idFor(order) { return ['garden', 'pool', 'western'][Math.floor((order - 1) / 10)] + '-' + ((order - 1) % 10 + 1); }
  function normalized(record) {
    const completed = [...new Set(record.completed)].sort();
    return { schema: 1, completed, unlockedThrough: Math.max(record.unlockedThrough, ...completed.map(id => Math.min(MAX_ORDER, orderFor(id) + 1))), campaignSeed: record.campaignSeed };
  }
  function validate(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.schema !== 1 ||
        !Array.isArray(record.completed) || record.completed.length > MAX_IDS || !record.completed.every(validId) ||
        !Number.isSafeInteger(record.unlockedThrough) || record.unlockedThrough < 1 || record.unlockedThrough > MAX_ORDER || !validSeed(record.campaignSeed)) {
      throw new Error('进度文件格式不正确，请选择之前导出的花园进度文件。');
    }
    return normalized(record);
  }
  function decode(text) {
    if (text === null) return { kind: 'missing' };
    try {
      if (typeof text !== 'string' || text.length > MAX_BYTES || byteLength(text) > MAX_BYTES) return { kind: 'corrupt' };
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && Number.isSafeInteger(data.schema) && data.schema > 1) return { kind: 'future' };
      return { kind: 'valid', record: validate(data) };
    } catch (_) { return { kind: 'corrupt' }; }
  }
  function legacy(text, key) {
    try {
      if (typeof text !== 'string' || text.length > MAX_BYTES) return null;
      const array = JSON.parse(text);
      if (!Array.isArray(array) || array.length > MAX_IDS) return null;
      if (key === WORLD) return array.filter(validId);
      return array.filter(value => Number.isSafeInteger(value) && (key === DEMO ? value >= 0 && value <= 2 : value >= 0 && value <= 18 && value !== 3))
        .map(value => idFor(value < 3 ? value + 1 : value));
    } catch (_) { return null; }
  }
  function receiptKey(id, order) { return RECEIPT + encodeURIComponent(id) + ':' + order; }
  function readReceipt(key, text) {
    try {
      if (typeof text !== 'string' || text.length > 1024) return null;
      const data = JSON.parse(text);
      if (!data || data.schema !== 1) return null;
      if (key.startsWith(RECEIPT) && validId(data.id) && Number.isSafeInteger(data.order) && data.order >= 0 && data.order <= MAX_ORDER && key === receiptKey(data.id, data.order)) {
        return { completed: [data.id], unlockedThrough: Math.max(1, Math.min(MAX_ORDER, data.order + 1)) };
      }
      if (key.startsWith(FRONTIER) && Number.isSafeInteger(data.unlockedThrough) && data.unlockedThrough >= 1 && data.unlockedThrough <= MAX_ORDER && key === FRONTIER + data.unlockedThrough) {
        return { completed: [], unlockedThrough: data.unlockedThrough };
      }
    } catch (_) { /* Unrelated or damaged receipts remain untouched. */ }
    return null;
  }
  function create(options = {}) {
    const storage = options.storage;
    let memory = null, trusted = false, migrated = false, recovered = false;
    let status = { saved: false, message: '', migrated: false, recovered: false };

    function readDisk() {
      const raw = new Map(), receipts = []; let failed = false, enumerable = false;
      for (const key of [...RECORD_KEYS, ...LEGACY_KEYS, SEED]) {
        try { raw.set(key, storage.getItem(key)); } catch (_) { failed = true; raw.set(key, null); }
      }
      try {
        enumerable = typeof storage.length === 'number' && typeof storage.key === 'function';
        if (enumerable) for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index);
          if (typeof key !== 'string' || !key.startsWith(RECEIPT) && !key.startsWith(FRONTIER)) continue;
          const item = readReceipt(key, storage.getItem(key)); if (item) receipts.push(item);
        }
      } catch (_) { failed = true; }
      return { raw, failed, enumerable, receipts, records: RECORD_KEYS.map(key => decode(raw.get(key))) };
    }
    function seedValue(disk, incoming) {
      for (const record of disk.records) if (record.kind === 'valid') return record.record.campaignSeed;
      if (memory) return memory.campaignSeed;
      if (incoming) return incoming.campaignSeed;
      const oldSeed = Number(disk.raw.get(SEED));
      if (validSeed(oldSeed)) return oldSeed;
      if (validSeed(options.seed)) return options.seed;
      let random;
      try { random = (options.random || Math.random)(); } catch (_) { random = .5; }
      if (!Number.isFinite(random)) random = .5;
      return Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random)) * MAX_SEED) + 1;
    }
    function merge(disk, incoming, addition) {
      const completed = new Set(memory?.completed || []);
      let unlockedThrough = memory?.unlockedThrough || 1;
      const add = record => {
        if (!record) return;
        for (const id of record.completed) completed.add(id);
        unlockedThrough = Math.max(unlockedThrough, record.unlockedThrough);
      };
      for (const entry of disk.records) if (entry.kind === 'valid') { add(entry.record); trusted = true; }
      for (const entry of disk.receipts) { add(entry); if (entry.completed.length || entry.unlockedThrough > 1) trusted = true; }
      add(incoming); add(addition);
      for (const key of LEGACY_KEYS) {
        const ids = legacy(disk.raw.get(key), key);
        if (!ids) continue;
        if (ids.length) trusted = true;
        for (const id of ids) { if (!completed.has(id)) migrated = true; completed.add(id); }
      }
      return normalized({ schema: 1, completed: [...completed], unlockedThrough, campaignSeed: seedValue(disk, incoming) });
    }
    function archiveDamaged(key, raw) {
      // Preserve the exact damaged bytes before automatic recovery. Even a
      // partial legacy save can then be used without destroying repairable data.
      let hash = 2166136261;
      for (let index = 0; index < raw.length; index++) hash = Math.imul(hash ^ raw.charCodeAt(index), 16777619);
      const base = RECOVERY + encodeURIComponent(key) + ':' + (hash >>> 0).toString(16);
      for (let collision = 0; collision < 10; collision++) {
        const archiveKey = base + (collision ? ':' + collision : '');
        const archived = storage.getItem(archiveKey);
        if (archived === raw) return true;
        if (archived === null) { storage.setItem(archiveKey, raw); return storage.getItem(archiveKey) === raw; }
      }
      return false;
    }
    function commit(event, addition, explicitImport = false) {
      const disk = readDisk();
      let incoming = null;
      if (event && (!event.storageArea || event.storageArea === storage)) {
        if (RECORD_KEYS.includes(event.key)) {
          const parsed = decode(event.newValue);
          if (parsed.kind === 'valid') { incoming = parsed.record; trusted = true; }
        } else if (LEGACY_KEYS.includes(event.key)) {
          const ids = legacy(event.newValue, event.key);
          if (ids) { incoming = { completed: ids, unlockedThrough: 1 }; if (ids.length) trusted = true; }
        } else if (typeof event.key === 'string' && (event.key.startsWith(RECEIPT) || event.key.startsWith(FRONTIER))) {
          incoming = readReceipt(event.key, event.newValue); if (incoming && (incoming.completed.length || incoming.unlockedThrough > 1)) trusted = true;
        }
      }
      if (explicitImport) trusted = true;
      const damaged = disk.records.some(entry => entry.kind === 'corrupt');
      const hasValidDisk = disk.records.some(entry => entry.kind === 'valid');
      memory = merge(disk, incoming, addition);
      if (damaged && (hasValidDisk || trusted)) recovered = true;
      const encoded = JSON.stringify(memory);
      let reason = '';
      if (disk.records.some(entry => entry.kind === 'future')) reason = '检测到较新版进度，已保留原始记录。请打开最新版游戏后再保存。';
      else if (disk.failed) reason = '浏览器暂时不允许保存进度。请导出备份，避免关闭页面后丢失。';
      else if (damaged && !trusted) reason = '原进度文件损坏且没有可用备份，已保留原始记录。请导入之前的进度备份。';
      else if (memory.completed.length > MAX_IDS || byteLength(encoded) > MAX_BYTES) reason = '进度记录超过保存容量，请立即导出备份。';
      let copies = 0, receiptsSaved = disk.enumerable;
      if (!reason) {
        // Independent, immutable receipts make victories durable even if two tabs
        // overwrite the aggregate simultaneously and close before storage events.
        // The key includes the original order, so future rearrangements cannot
        // overwrite a receipt created by a previous version of the campaign.
        const receipts = memory.completed.map(id => {
          const order = addition?.receiptOrder && addition.completed.includes(id) ? addition.receiptOrder : orderFor(id);
          return [receiptKey(id, order), { schema: 1, id, order }];
        });
        receipts.push([FRONTIER + memory.unlockedThrough, { schema: 1, unlockedThrough: memory.unlockedThrough }]);
        if (disk.enumerable) for (const [key, value] of receipts) {
          try {
            const existing = storage.getItem(key);
            if (existing === null) storage.setItem(key, JSON.stringify(value));
            if (!readReceipt(key, storage.getItem(key))) receiptsSaved = false;
          } catch (_) { receiptsSaved = false; }
        }
        for (const key of RECORD_KEYS) {
          try {
            // Compare the normalized content, so tabs do not bounce storage events forever.
            const raw = storage.getItem(key), existing = decode(raw);
            if (existing.kind === 'future') { reason = '检测到较新版进度，已保留原始记录。请打开最新版游戏后再保存。'; break; }
            if (existing.kind === 'corrupt' && !archiveDamaged(key, raw)) continue;
            if (existing.kind !== 'valid' || JSON.stringify(existing.record) !== encoded) storage.setItem(key, encoded);
            const saved = decode(storage.getItem(key));
            if (saved.kind === 'valid' && JSON.stringify(saved.record) === encoded) copies++;
          } catch (_) { /* The other copy can still retain this progress. */ }
        }
      }
      const saved = !reason && (copies > 0 || receiptsSaved);
      if (saved) trusted = true;
      status = { saved, migrated, recovered, message: reason || (copies === 2 && (receiptsSaved || !disk.enumerable) ? '' : copies > 0 && disk.enumerable && !receiptsSaved ? '进度已保存，但独立通关备份暂未写入，建议导出备份。' : saved ? '进度已保存，但备用副本暂未写入，建议导出备份。' : '进度暂存在本页，未能写入浏览器。请导出备份后再关闭。') };
      return getSnapshot();
    }
    function getSnapshot() { return { ...memory, completed: [...memory.completed] }; }
    function getStatus() { return { ...status }; }
    function saveCompleted(id, campaignOrder) {
      if (!validId(id) || !Number.isSafeInteger(campaignOrder) || campaignOrder < 1 || campaignOrder > MAX_ORDER) throw new Error('关卡标识或顺序无效，无法记录通关。');
      return commit(null, { completed: [id], unlockedThrough: Math.min(MAX_ORDER, campaignOrder + 1), receiptOrder: campaignOrder });
    }
    function refresh(event) { return commit(event); }
    function exportData() { refresh(); return JSON.stringify(getSnapshot(), null, 2); }
    function importData(text) {
      if (typeof text !== 'string' || text.length > MAX_BYTES || byteLength(text) > MAX_BYTES) throw new Error('进度文件过大，请选择小于 256 KB 的花园进度文件。');
      let data;
      try { data = JSON.parse(text); } catch (_) { throw new Error('无法读取进度文件，请选择之前导出的 JSON 备份。'); }
      if (data && Number.isSafeInteger(data.schema) && data.schema > 1) throw new Error('此进度来自较新版游戏，请先更新游戏再导入。');
      return commit(null, validate(data), true);
    }
    commit();
    return { getSnapshot, getStatus, saveCompleted, refresh, exportData, importData };
  }

  const api = Object.freeze({ create, KEYS, MAX_BYTES });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GardenProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
