(function (root) {
  'use strict';

  const ROWS = 5, COLS = 9, STEP_MS = 1000 / 60, MAX_DECK_SIZE = 8, MAX_CONVEYOR_PACKETS = 8;
  const ATTACKERS = Object.freeze(['shooter', 'ice', 'burst', 'star', 'corn', 'cannon', 'lightning', 'tide', 'cactus']);
  const ULTIMATES = {
    lily: ['浮叶守护', '空莲叶获得2000点护盾，持续10秒，可再种植伙伴'],
    kelp: ['深水漩涡', '吞没两条水路内最近的三名来客'],
    tide: ['碧波连发', '连续释放16枚强化水弹'],
    cactus: ['针雨风暴', '发射12枚可穿透整行的强化尖刺'],
    sun: ['灿烂日光', '喷出8颗阳光，共200点，记得点击收集'],
    shooter: ['飞叶风暴', '连续发射20发强化飞叶'],
    wall: ['坚不可摧', '回满生命，并获得10秒护盾'],
    mine: ['快速布雷', '立即完成埋伏准备，触发时对同排近处造成2400伤害'],
    ice: ['极寒时刻', '冻结全场4秒，并连续发射寒冰弹'],
    burst: ['双重狂潮', '连续发射30发强化飞叶'],
    bomb: ['盛大焰火', '立即引爆更大范围的强化焰火'],
    star: ['满天星雨', '向四周连续释放3轮星星弹幕'],
    corn: ['黄油盛宴', '连续投出黄油，命中定身4秒'],
    tallwall: ['城墙守护', '回满生命，获得更厚的10秒护盾'],
    torch: ['烈焰长廊', '焚烧整行来客，并持续灼烧5秒'],
    cannon: ['重炮齐鸣', '连续投出3枚大范围重炮弹'],
    lightning: ['雷霆风暴', '雷击全场来客并短暂定身'],
  };
  const PLANTS = [
    { id: 'sun', name: '日光伙伴', cost: 50, cooldown: 7500, photoIndex: 1, color: '#f3bc42', description: '首产约7秒，之后每24秒产出25阳光', hp: 300, production: 24000 },
    { id: 'shooter', name: '飞叶射手', cost: 100, cooldown: 7500, photoIndex: 3, color: '#6d9f55', description: '约1.4秒一发，每发20伤害', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'wall', name: '磐石守卫', cost: 50, cooldown: 30000, initialCooldown: 15000, photoIndex: 5, color: '#bc8d59', description: '4000生命，挡住入侵者', hp: 4000 },
    { id: 'mine', name: '土豆地雷', cost: 25, cooldown: 30000, initialCooldown: 15000, color: '#b18a52', description: '埋伏15秒后就绪，接触来客时对同排近处造成1800伤害；只能种在陆地', hp: 300, armTime: 15000, damage: 1800, landOnly: true },
    { id: 'ice', name: '寒冰射手', cost: 175, cooldown: 7500, photoIndex: 7, color: '#75c2da', description: '20伤害，移动和啃咬减半10秒', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'burst', name: '双发射手', cost: 200, cooldown: 7500, photoIndex: 9, color: '#ac78b5', description: '连续两发，每发20伤害', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'bomb', name: '焰火伙伴', cost: 150, cooldown: 50000, initialCooldown: 25000, photoIndex: 11, color: '#e17a5e', description: '1.2秒后在3×3范围造成1800伤害', hp: 300, fuse: 1200, damage: 1800 },
    { id: 'star', name: '星星射手', cost: 125, cooldown: 7500, color: '#e8b83f', description: '约1.5秒向左、上下和右侧斜向发射五颗星，每颗20伤害', hp: 300, damage: 20, attackInterval: 1500 },
    { id: 'corn', name: '玉米投手', cost: 100, cooldown: 7500, color: '#dfb547', description: '抛射20伤害玉米；25%概率投出40伤害黄油并定身4秒', hp: 300, damage: 20, attackInterval: 3000 },
    { id: 'tallwall', name: '高坚果守卫', cost: 125, cooldown: 30000, initialCooldown: 15000, color: '#9c7752', description: '8000生命，拦住撑杆跳跃', hp: 8000 },
    { id: 'torch', name: '火炬伙伴', cost: 175, cooldown: 7500, color: '#e7803e', description: '穿过的普通飞叶伤害翻倍，并灼烧前方近处敌人', hp: 500, damage: 25, attackInterval: 1200 },
    { id: 'cannon', name: '重炮投手', cost: 325, cooldown: 15000, color: '#b78c61', description: '每4.5秒投出90伤害炮弹，波及邻近行', hp: 300, damage: 90, attackInterval: 4500 },
    { id: 'lightning', name: '闪电伙伴', cost: 200, cooldown: 7500, color: '#a68cdb', description: '每2.2秒释放35伤害闪电，最多连锁3名相邻来客', hp: 300, damage: 35, attackInterval: 2200 },
    { id: 'lily', name: '莲叶伙伴', cost: 25, cooldown: 7500, color: '#65aa69', description: '只种在水上，承载一名陆生伙伴', hp: 300, aquatic: true, support: true },
    { id: 'kelp', name: '缠绕海草', cost: 25, cooldown: 20000, color: '#478d74', description: '只种在水上，一次性拖走靠近的来客', hp: 300, aquatic: true },
    { id: 'tide', name: '碧波射手', cost: 125, cooldown: 7500, color: '#4daac1', description: '水生射手，每1.4秒发射20伤害水弹', hp: 300, aquatic: true, damage: 20, attackInterval: 1425 },
    { id: 'cactus', name: '荒原仙人掌', cost: 175, cooldown: 7500, color: '#729d48', description: '每1.6秒发射尖刺，穿透两名同排来客', hp: 300, damage: 20, attackInterval: 1600 },
  ].map(plant => Object.freeze({ ...plant, ultimateName: ULTIMATES[plant.id][0], ultimateDescription: ULTIMATES[plant.id][1] }));
  const PLANT_BY_ID = Object.fromEntries(PLANTS.map(plant => [plant.id, plant]));
  const ENEMIES = Object.freeze({
    walker: Object.freeze({ name: '迷路来客', hp: 270, armor: 0, speed: .2, bite: 100 }),
    helmet: Object.freeze({ name: '路障来客', hp: 640, armor: 370, speed: .2, bite: 100 }),
    runner: Object.freeze({ name: '撑杆来客', hp: 500, armor: 0, speed: .4, bite: 100, vault: true }),
    brute: Object.freeze({ name: '铁桶来客', hp: 1370, armor: 1100, speed: .2, bite: 100 }),
    flag: Object.freeze({ name: '旗帜来客', hp: 270, armor: 0, speed: .27, bite: 100 }),
  });
  // A journey has stable teaching milestones and seed-selected interludes.
  // Reopening the saved journey preserves its map; a new seed changes the fun slots.
  const DEFAULT_CAMPAIGN_SEED = 20261024;
  const WORLD_NAMES = { garden: '花园', pool: '泳池', western: '沙漠西部' };
  function campaignRandom(seed) {
    let value = Number(seed) >>> 0;
    if (!Number.isFinite(Number(seed))) value = DEFAULT_CAMPAIGN_SEED;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  function freezeLevel(level) {
    return Object.freeze({ ...level,
      cards: Object.freeze(level.cards), recommendedDeck: Object.freeze(level.recommendedDeck),
      activeRows: Object.freeze(level.activeRows), waterRows: Object.freeze(level.waterRows),
      tracks: Object.freeze(level.tracks.map(track => Object.freeze({ ...track, rows: Object.freeze(track.rows) }))),
      conveyorInitial: Object.freeze(level.conveyorInitial || []), conveyorPool: Object.freeze(level.conveyorPool || []),
      tutorialGate: level.tutorialGate ? Object.freeze(level.tutorialGate) : null,
      waves: Object.freeze(level.waves.map(wave => Object.freeze({ ...wave, pool: Object.freeze(wave.pool) }))),
    });
  }
  function createCampaign(seed = DEFAULT_CAMPAIGN_SEED) {
    const random = campaignRandom(seed), levels = [], unlocked = ['shooter'];
    const rewards = ['sun', 'wall', 'mine', 'ice', 'star', 'corn', 'burst', 'tallwall', 'bomb', 'lily',
      'kelp', 'tide', 'torch', 'cannon', 'lightning', null, null, null, null, 'cactus',
      null, null, null, null, null, null, null, null, null, null];
    const titles = {
      garden: ['第一束阳光', '日光伙伴', '稳稳的防线', '埋伏迎客', '冰凉的午后', '星光花坛', '黄油时刻', '双发的默契', '高墙之后', '花园告别礼'],
      pool: ['池畔初见', '水下的拥抱', '碧波初鸣', '池畔灯火', '重炮迎潮', '水面雷光', '两岸守望', '涟漪派对', '浪花快车', '夏日终曲'],
      western: ['第一辆矿车', '荒原针阵', '轨道换防', '驿站来信', '落日哨所', '仙人掌峡谷', '铁轨交响', '沙丘快车', '荒原夜话', '西部大巡游'],
    };
    for (const [worldIndex, chapter] of ['garden', 'pool', 'western'].entries()) {
      const candidates = [4, 6, 8, 9];
      for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      const beltStage = candidates[0], challengeStage = candidates[1], challenge = random() < .5 ? 'limited' : 'overcast';
      for (let stage = 1; stage <= 10; stage++) {
        const index = worldIndex * 10 + stage - 1, rows = chapter === 'pool' ? 6 : 5;
        const activeRows = chapter === 'garden' && stage === 1 ? [2] : chapter === 'garden' && stage < 5 ? [1, 2, 3] : Array.from({ length: rows }, (_, row) => row);
        const waterRows = chapter === 'pool' ? [2, 3] : [];
        const mode = stage === beltStage ? 'conveyor' : stage === challengeStage ? challenge : 'normal';
        const westernLayouts = {
          4: [{ col: 2, rows: [0, 1, 2], initialRow: 1 }, { col: 5, rows: [2, 3, 4], initialRow: 3 }],
          5: [{ col: 2, rows: [1, 2, 3], initialRow: 2 }, { col: 7, rows: [0, 1, 2, 3, 4], initialRow: 4 }],
          6: [{ col: 2, rows: [2, 3, 4], initialRow: 3 }, { col: 6, rows: [0, 1, 2], initialRow: 1 }],
          7: [{ col: 2, rows: [0, 1, 2, 3, 4], initialRow: 0 }, { col: 5, rows: [1, 2, 3], initialRow: 2 }, { col: 7, rows: [2, 3, 4], initialRow: 4 }],
          8: [{ col: 3, rows: [0, 1, 2, 3, 4], initialRow: 2 }, { col: 5, rows: [0, 1, 2, 3, 4], initialRow: 4 }],
          9: [{ col: 1, rows: [0, 1, 2], initialRow: 1 }, { col: 2, rows: [2, 3, 4], initialRow: 3 }, { col: 5, rows: [0, 1, 2, 3, 4], initialRow: 2 }],
        };
        const tracks = chapter === 'western' ? westernLayouts[stage] || [{ col: 2, rows: [0, 1, 2, 3, 4], initialRow: 2 }, ...(stage >= 3 ? [{ col: 5, rows: [0, 1, 2, 3, 4], initialRow: 1 }] : [])] : [];
        let cards = unlocked.filter(id => chapter === 'pool' || !PLANT_BY_ID[id].aquatic);
        // Pool companions stay unlocked in the collection, but are unavailable on dry maps.
        const preferred = chapter === 'pool' ? ['sun', 'lily', 'tide', 'shooter', 'ice', 'kelp', 'bomb', 'tallwall', 'wall', 'star'] :
          chapter === 'western' ? ['sun', 'cactus', 'shooter', 'ice', 'bomb', 'tallwall', 'torch', 'cannon', 'wall', 'mine'] : ['sun', 'shooter', 'wall', 'mine', 'bomb', 'ice', 'star', 'corn', 'burst', 'tallwall'];
        let recommendedDeck = preferred.filter(id => cards.includes(id)).slice(0, MAX_DECK_SIZE);
        if (stage === 1 && chapter === 'garden') recommendedDeck = ['shooter'];
        const featureIntro = chapter === 'garden' && stage === 4 ? '土豆地雷需要15秒准备，请提前埋伏；铲子也已解锁，可移走伙伴重新布阵。' : chapter === 'garden' && stage === 5 ? '能量豆已解锁：每局一颗，点击伙伴释放大招。' : chapter === 'garden' && stage === 10 ? '焰火伙伴已解锁：在来客密集时，用3×3范围爆炸化解危机。' :
          chapter === 'pool' && stage === 1 ? '水路需要莲叶承载陆生伙伴；莲叶上还能再种一名伙伴。' : chapter === 'pool' && stage === 2 ? '海草可直接种在水里，一次拖走一名靠近的来客。' : chapter === 'pool' && stage === 3 ? '碧波射手可直接在水上射击。' :
          chapter === 'western' && stage === 1 ? '先把伙伴种在矿车上；选择矿车，再点同一轨道的目标行换防。' : chapter === 'western' && stage === 3 ? '第二条轨道开放，矿车可以带着伙伴一起换行。' : chapter === 'western' ? ({
            4: '上下两段短轨道在中路交接，分别照顾两侧来客。',
            5: '中路短轨道配合前方长轨道，前线矿车要及时避开啃咬。',
            6: '上方前线、下方后排，两辆矿车的行驶范围不同。',
            7: '三辆矿车分工：后排全线支援，中排换防，前线救急。',
            8: '主攻击列变成轨道，集中火力后及时把矿车送到下一行。',
            9: '后方补给空间被短轨道分开，移动射手保护两片日光花坛。',
          }[stage] || '') : '';
        let level = { id: `${chapter}-${stage}`, title: `${worldIndex + 1}-${stage} · ${titles[chapter][stage - 1]}`, chapter, worldStage: stage, campaignOrder: index + 1,
          rows, activeRows, waterRows, tracks, mode, cards, recommendedDeck, reward: rewards[index], featureIntro,
          shovel: index >= 3, plantFoodEnabled: index >= 4, startSun: chapter === 'garden' ? (stage < 4 ? (stage === 1 ? 150 : 50) : 100) : chapter === 'pool' ? 175 : 150,
          skySun: true, duration: 285000, subtitle: featureIntro || `${WORLD_NAMES[chapter]}第${stage}关 · 建立补给，守住每条路线`,
          waves: [0, 1, 2, 3].map(wave => ({ at: [35000, 90000, 150000, 215000][wave],
            count: [2, 3, 4, 6][wave] + worldIndex + Math.floor(stage / 4), spacing: wave === 3 ? 1700 : 6500,
            pool: wave < 1 ? ['walker'] : wave < 2 ? ['walker', 'helmet'] : stage < 4 && chapter === 'garden' ? ['walker', 'helmet'] : wave < 3 ? ['walker', 'helmet', 'runner'] : stage < 7 && chapter === 'garden' ? ['walker', 'helmet', 'runner'] : ['walker', 'helmet', 'brute', 'runner'], flag: wave === 3 })),
        };
        if (chapter === 'garden' && stage === 1) Object.assign(level, { duration: 75000, tutorialGate: { type: 'shooter', count: 2, hint: '先收集阳光，在中间草坪种下2名飞叶射手' },
          waves: [3000, 15000, 27000, 39000].map((at, wave) => ({ at, count: wave === 3 ? 2 : 1, spacing: 1800, pool: ['walker'] })) });
        if (chapter === 'garden' && stage === 2) Object.assign(level, { duration: 145000, tutorialGate: { type: 'sun', count: 3, hint: '先种下3名日光伙伴；每次点击阳光收集25点' },
          waves: [10000, 25000, 40000, 60000, 80000, 104000].map((at, wave) => ({ at, count: [1, 1, 2, 2, 3, 5][wave], spacing: wave === 5 ? 900 : 3500, pool: ['walker'], flag: wave === 5 })) });
        if (mode === 'conveyor') {
          cards = cards.filter(id => id !== 'sun');
          const core = ['shooter', 'shooter', 'shooter', 'wall', 'mine', 'ice', 'star', 'burst', 'bomb', 'cactus'].filter(id => cards.includes(id));
          const waterSupply = chapter === 'pool' ? ['tide', 'tide', 'lily', 'lily', 'kelp'] : [];
          level = { ...level, cards, recommendedDeck: [], startSun: 0, skySun: false, conveyorInterval: chapter === 'garden' ? 6500 : 5000,
            conveyorInitial: chapter === 'pool' ? ['shooter', 'shooter', 'tide', 'tide', 'lily', 'lily'] : ['shooter', 'shooter', 'wall'],
            conveyorPool: [...core, ...waterSupply], modeLabel: '传送带', ruleSummary: '自动送卡 · 免费种植 · 最多保留8张', subtitle: '这一站是随机插入的传送带挑战，跟着补给调整阵型。' };
        } else if (mode === 'overcast') Object.assign(level, { skySun: false, startSun: chapter === 'pool' ? 250 : 175, waves: level.waves.map(wave => ({ ...wave, at: wave.at + 15000, count: Math.max(1, Math.ceil(wave.count * .8)) })), modeLabel: '阴天挑战', ruleSummary: '没有天空阳光 · 建立日光补给', subtitle: '云朵遮住天空，日光伙伴负责全部阳光。' });
        else if (mode === 'limited') Object.assign(level, { plantLimit: chapter === 'pool' ? 24 : 18, startSun: 200, modeLabel: '限额布阵', ruleSummary: chapter === 'pool' ? '最多24名伙伴 · 莲叶不占名额' : '最多18名伙伴 · 铲除后可补种', subtitle: '用有限的伙伴，守住每一条路线。' });
        levels.push(freezeLevel(level));
        if (level.reward && !unlocked.includes(level.reward)) unlocked.push(level.reward);
      }
    }
    return Object.freeze(levels);
  }
  const LEVELS = createCampaign();
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const STAR_DIRECTIONS = Object.freeze([[-1, 0], [0, -1], [0, 1], [Math.SQRT1_2, -Math.SQRT1_2], [Math.SQRT1_2, Math.SQRT1_2]].map(Object.freeze));

  // Earliest contact along a swept segment, including vertical and leftward shots.
  function starContact(fromX, fromY, toX, toY, enemy) {
    let entry = 0, exit = 1;
    for (const [from, delta, center, radius] of [
      [fromX, toX - fromX, enemy.x, .24],
      [fromY, toY - fromY, enemy.row + .44, .26],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (from < center - radius || from > center + radius) return null;
      } else {
        const first = (center - radius - from) / delta, last = (center + radius - from) / delta;
        entry = Math.max(entry, Math.min(first, last)); exit = Math.min(exit, Math.max(first, last));
        if (entry > exit) return null;
      }
    }
    return entry;
  }

  class GardenGame {
    constructor(options = {}) {
      this.levels = createCampaign(options.campaignSeed ?? DEFAULT_CAMPAIGN_SEED);
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
      this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
      this.reset(0);
    }

    reset(levelIndex = 0) {
      this.levelIndex = Number.isInteger(levelIndex) ? clamp(levelIndex, 0, this.levels.length - 1) : 0;
      this.level = this.levels[this.levelIndex]; this.rows = this.level.rows; this.waterRows = this.level.waterRows;
      this.deck = this.level.mode === 'conveyor' ? [...this.level.cards] : [...this.level.recommendedDeck];
      this.status = 'ready'; this.sun = this.level.startSun; this.kills = 0; this.plantFood = this.level.plantFoodEnabled ? 1 : 0;
      this.elapsed = 0; this.wave = 0; this.totalWaves = this.level.waves.length;
      this.spawnElapsed = 0; this.tutorialReady = !this.level.tutorialGate;
      this._plantedCounts = Object.fromEntries(PLANTS.map(plant => [plant.id, 0]));
      this.plants = []; this.enemies = []; this.projectiles = []; this.suns = []; this.effects = [];
      this.mowers = Array.from({ length: this.rows }, (_, row) => ({ row, enabled: this.level.activeRows.includes(row), aquatic: this.waterRows.includes(row), active: false, used: false, x: -.5 }));
      this.cooldowns = Object.fromEntries(PLANTS.map(plant => [plant.id, plant.initialCooldown || 0]));
      this.carts = this.level.tracks.map((track, index) => ({ id: `cart-${index}`, col: track.col, row: track.initialRow, fromRow: track.initialRow, moveTime: 0 }));
      this._nextId = 1; this.conveyor = []; this.conveyorNextIn = this.level.mode === 'conveyor' ? this.level.conveyorInterval : null; this._conveyorBag = [];
      for (const type of this.level.conveyorInitial) this.conveyor.push({ id: this._id('packet'), type, age: 0 });
      this._accumulator = 0; this._skyCount = 0; this._skyTimer = this._skyInterval(); this._spawnIndex = 0;
      this._spawnSchedule = [];
      this.level.waves.forEach((wave, waveIndex) => {
        for (let i = 0; i < wave.count; i++) {
          // The first visitor previews the middle lane; later arrivals vary by run.
          const rows = this.level.activeRows;
          const row = waveIndex === 0 && i === 0 ? rows[Math.floor(rows.length / 2)] : rows[Math.floor(this._random() * rows.length)];
          const type = wave.flag && i === 0 ? 'flag' : wave.pool[Math.floor(this._random() * wave.pool.length)];
          this._spawnSchedule.push({ at: wave.at + i * wave.spacing, row, type, wave: waveIndex + 1, flag: Boolean(wave.flag) });
        }
      });
      this._spawnSchedule.sort((a, b) => a.at - b.at);
      this.totalEnemies = this._spawnSchedule.length;
      this._notify();
      return this.getState();
    }

    getState() {
      return {
        status: this.status, levelIndex: this.levelIndex, level: this.level, deck: [...this.deck],
        rows: this.rows, waterRows: this.waterRows, tracks: this.level.tracks, carts: this.carts,
        plantFoodEnabled: this.level.plantFoodEnabled, activeRows: this.level.activeRows, tutorialReady: this.tutorialReady,
        tutorialHint: this.tutorialReady ? '' : this.level.tutorialGate.hint,
        spawnElapsed: this.spawnElapsed, conveyor: this.conveyor.map(packet => ({ ...packet })), conveyorNextIn: this.conveyorNextIn,
        nextWaveIn: this.tutorialReady && this._spawnIndex < this._spawnSchedule.length ? Math.max(0, this._spawnSchedule[this._spawnIndex].at - this.spawnElapsed) : null,
        sun: this.sun, plantFood: this.plantFood, kills: this.kills, elapsed: this.elapsed,
        wave: this.wave, totalWaves: this.totalWaves, spawned: this._spawnIndex,
        totalEnemies: this.totalEnemies, remainingEnemies: this.totalEnemies - this.kills,
        spawnProgress: this.totalEnemies ? this._spawnIndex / this.totalEnemies : 0,
        plants: this.plants, enemies: this.enemies, projectiles: this.projectiles,
        suns: this.suns, mowers: this.mowers, effects: this.effects, cooldowns: this.cooldowns,
      };
    }

    setDeck(ids) {
      if (this.status !== 'ready') return false;
      if (this.level.mode === 'conveyor') { this.deck = [...this.level.cards]; this._notify(); return true; }
      if (!Array.isArray(ids) || !ids.length || ids.length > MAX_DECK_SIZE || new Set(ids).size !== ids.length) return false;
      for (const id of ids) if (!this.level.cards.includes(id)) return false;
      if (this.level.tutorialGate && !ids.includes(this.level.tutorialGate.type)) return false;
      if (this.level.cards.includes('sun') && !ids.includes('sun')) return false;
      if (!ids.some(id => ATTACKERS.includes(id))) return false;
      if (this.waterRows.length && !ids.includes('lily')) return false;
      this.deck = [...ids]; this._notify(); return true;
    }

    start() {
      if (this.status !== 'ready') return false;
      this.status = 'running'; this._emit('start'); this._notify(); return true;
    }

    pause(paused = true) {
      if (paused && this.status === 'running') this.status = 'paused';
      else if (!paused && this.status === 'paused') this.status = 'running';
      else return false;
      this._notify(); return true;
    }

    plant(type, row, col) {
      const config = PLANT_BY_ID[type];
      if (this.level.mode === 'conveyor' || !this.tutorialReady && type !== this.level.tutorialGate.type) return false;
      if (this.status !== 'running' || !config || !this.deck.includes(type) || !this._canPlant(type, row, col) || this.cooldowns[type] > 0 || this.sun < config.cost) return false;
      this.sun -= config.cost; this.cooldowns[type] = config.cooldown;
      this._placePlant(type, row, col); return true;
    }

    plantFromConveyor(packetId, row, col) {
      if (this.status !== 'running' || this.level.mode !== 'conveyor') return false;
      const index = this.conveyor.findIndex(packet => packet.id === packetId);
      if (index < 0 || !this._canPlant(this.conveyor[index].type, row, col)) return false;
      const [packet] = this.conveyor.splice(index, 1);
      this._placePlant(packet.type, row, col); return true;
    }

    canPlant(type, row, col) { return Boolean(PLANT_BY_ID[type] && this._canPlant(type, row, col)); }

    _canPlant(type, row, col) {
      const config = PLANT_BY_ID[type];
      if (!config || !this._validCell(row, col)) return false;
      const water = this.waterRows.includes(row), living = this.plants.filter(plant => plant.hp > 0 && plant.row === row && plant.col === col);
      if (config.aquatic && !water) return false;
      if (config.landOnly && water) return false;
      if (type === 'lily') { if (living.length) return false; }
      else {
        if (living.some(plant => plant.type !== 'lily')) return false;
        if (water && !config.aquatic && !living.some(plant => plant.type === 'lily')) return false;
        if (config.aquatic && living.length) return false;
      }
      const track = this.level.tracks.find(item => item.col === col && item.rows.includes(row));
      if (track && !this.carts.some(cart => cart.col === col && cart.row === row)) return false;
      return config.support || !this.level.plantLimit || this.plants.filter(plant => plant.hp > 0 && plant.type !== 'lily').length < this.level.plantLimit;
    }

    moveCart(cartId, targetRow) {
      if (this.status !== 'running' || !Number.isInteger(targetRow)) return false;
      const cart = this.carts.find(item => item.id === cartId);
      if (!cart || cart.row === targetRow || cart.moveTime > 1e-7) return false;
      const track = this.level.tracks.find(item => item.col === cart.col);
      if (!track || !track.rows.includes(targetRow) || this._plantAt(targetRow, cart.col) || this.carts.some(item => item !== cart && item.col === cart.col && item.row === targetRow)) return false;
      const fromRow = cart.row;
      for (const plant of this.plants) if (plant.hp > 0 && plant.row === fromRow && plant.col === cart.col) plant.row = targetRow;
      cart.fromRow = fromRow; cart.row = targetRow; cart.moveTime = 250;
      this._effect('cartMove', targetRow, cart.col + .5, 350, { col: cart.col, fromRow, toRow: targetRow });
      this._emit('cartMove', { cart, fromRow, toRow: targetRow }); this._notify(); return true;
    }

    _placePlant(type, row, col) {
      const config = PLANT_BY_ID[type];
      const plant = {
        id: this._id('plant'), type, row, col, hp: config.hp, maxHp: config.hp, attackPulse: 0, hurtPulse: 0,
        attackTimer: 200, burstTimer: 0, pendingShot: false, sunTimer: 7000, fuse: config.fuse || 0,
        powerTime: 0, powerShots: 0, powerTimer: 0, shieldHp: 0, shieldTime: 0,
        ...(type === 'mine' ? { armRemaining: config.armTime, armed: false, boosted: false } : {}),
      };
      this.plants.push(plant);
      this._plantedCounts[type]++;
      const gate = this.level.tutorialGate;
      if (!this.tutorialReady && gate && this._plantedCounts[gate.type] >= gate.count) {
        this.tutorialReady = true; this._emit('tutorialComplete');
      }
      this._effect('plant', row, col + .5, 500); this._emit('plant', { plant }); this._notify();
      return true;
    }

    remove(row, col) {
      if (this.status !== 'running' || !this.level.shovel || !this._validCell(row, col)) return false;
      const plant = this._plantAt(row, col);
      if (!plant) return false;
      this.plants = this.plants.filter(item => item !== plant);
      this._effect('remove', row, col + .5, 400); this._emit('remove', { plant }); this._notify(); return true;
    }

    collectSun(id) {
      if (this.status !== 'running') return false;
      const index = this.suns.findIndex(sun => sun.id === id);
      if (index < 0) return false;
      const [sun] = this.suns.splice(index, 1);
      this.sun += sun.value;
      this._effect('collect', Math.floor(sun.y), sun.x, 650, { value: sun.value, y: sun.y });
      this._emit('collect', { sun, x: sun.x, y: sun.y, value: sun.value }); this._notify(); return true;
    }

    usePlantFood(row, col) {
      if (this.status !== 'running' || !this.level.plantFoodEnabled || this.plantFood < 1 || !this._validCell(row, col)) return false;
      const plant = this._plantAt(row, col);
      if (!plant) return false;
      this.plantFood--; plant.powerTime = 2800; plant.attackPulse = 600;
      const x = plant.col + .5, y = plant.row + .44;
      this._effect('power', row, x, 2800, { plantType: plant.type, y });
      switch (plant.type) {
        case 'lily':
          for (const occupant of this.plants) if (occupant.hp > 0 && occupant.row === row && occupant.col === col) { occupant.shieldHp = 2000; occupant.shieldTime = 10000; occupant.powerTime = 10000; }
          this._effect('lilyPower', row, x, 1000); break;
        case 'kelp': {
          const targets = this.enemies.filter(enemy => enemy.hp > 0 && this.waterRows.includes(enemy.row)).sort((a, b) => Math.hypot(a.x - x, a.row - row) - Math.hypot(b.x - x, b.row - row)).slice(0, 3);
          for (const enemy of targets) { this._effect('kelp', enemy.row, enemy.x, 1000, { power: true }); this._damage(enemy, enemy.hp, 'kelp'); }
          plant.hp = 0; break;
        }
        case 'sun':
          for (let i = 0; i < 8; i++) this._sun(x, y, 'power', { offsetX: (i % 4 - 1.5) * .45, offsetY: .2 + Math.floor(i / 4) * .45 });
          break;
        case 'wall': case 'tallwall':
          plant.hp = plant.maxHp; plant.shieldHp = plant.type === 'tallwall' ? 4000 : 2000;
          plant.shieldTime = plant.powerTime = 10000;
          break;
        case 'ice':
          for (const enemy of this.enemies) if (enemy.hp > 0 && !enemy.headless) {
            enemy.freezeTime = 4000; enemy.slowTime = 10000;
            this._effect('ice', enemy.row, enemy.x, 700, { power: true });
          }
          plant.powerShots = 10; plant.powerShotInterval = 140;
          break;
        case 'star': plant.powerShots = 3; plant.powerShotInterval = 400; break;
        case 'mine': plant.boosted = true; this._armMine(plant); break;
        case 'bomb': plant.boosted = true; plant.fuse = 100; break;
        case 'torch':
          for (const enemy of this.enemies) if (enemy.hp > 0 && enemy.row === row) {
            this._damage(enemy, 700, 'fire'); if (enemy.hp > 0) { enemy.burnTime = 5000; enemy.burnDamage = 75; }
          }
          this._effect('flame', row, x, 1300, { y, radius: COLS, power: true });
          break;
        case 'lightning': {
          const targets = this.enemies.filter(enemy => enemy.hp > 0);
          for (const enemy of targets) { this._damage(enemy, 250, 'lightning'); enemy.stunTime = 1500; }
          this._effect('lightning', row, x, 1100, { power: true, points: [{ x, y }, ...targets.map(enemy => ({ x: enemy.x, y: enemy.row + .44 }))] });
          break;
        }
        default:
          plant.powerShots = { shooter: 20, burst: 30, corn: 8, cannon: 3, tide: 16, cactus: 12 }[plant.type] || 0;
          plant.powerShotInterval = { shooter: 95, burst: 70, corn: 200, cannon: 550, tide: 110, cactus: 160 }[plant.type] || 100;
      }
      plant.powerTimer = 0;
      this._emit('plantFood', { plant, plantType: plant.type }); this._notify(); return true;
    }

    step(milliseconds) {
      if (this.status !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      // Cap background-tab catch-up, then use fixed slices for swept collisions.
      this._accumulator += Math.min(milliseconds, 250);
      while (this._accumulator + 1e-7 >= STEP_MS && this.status === 'running') {
        this._accumulator = Math.max(0, this._accumulator - STEP_MS);
        this._step(STEP_MS);
      }
      this._notify();
    }

    _step(dt) {
      this.elapsed += dt;
      for (const cart of this.carts) cart.moveTime = Math.max(0, cart.moveTime - dt);
      if (this.tutorialReady) this.spawnElapsed += dt;
      for (const type of Object.keys(this.cooldowns)) {
        const remaining = this.cooldowns[type] - dt;
        this.cooldowns[type] = remaining <= 1e-7 ? 0 : remaining;
      }
      this.effects.forEach(effect => { effect.life -= dt; });
      this.effects = this.effects.filter(effect => effect.life > 0);
      this.suns.forEach(sun => {
        sun.age += dt;
        if (!sun.landed) {
          const progress = Math.min(1, sun.age / sun.flightDuration);
          const easing = sun.source === 'sky' ? progress : 1 - Math.pow(1 - progress, 2);
          sun.x = sun.startX + (sun.targetX - sun.startX) * easing;
          sun.y = sun.startY + (sun.targetY - sun.startY) * easing - (sun.source === 'sky' ? 0 : Math.sin(progress * Math.PI) * .72);
          if (progress >= 1) { sun.landed = true; sun.falling = false; sun.x = sun.targetX; sun.y = sun.targetY; }
        } else sun.life -= dt;
      });
      this.suns = this.suns.filter(sun => sun.life > 0);
      if (this.level.mode === 'conveyor') this._stepConveyor(dt);
      if (this.level.skySun !== false) {
        this._skyTimer -= dt;
        if (this._skyTimer <= 0) {
          this._skyCount++; this._skyTimer += this._skyInterval();
          const rows = this.level.activeRows, row = rows[Math.floor(this._random() * rows.length)];
          this._sun(.7 + this._random() * 7.6, row + .6, 'sky');
        }
      }
      while (this.tutorialReady && this._spawnIndex < this._spawnSchedule.length && this._spawnSchedule[this._spawnIndex].at <= this.spawnElapsed + 1e-7) {
        const entry = this._spawnSchedule[this._spawnIndex++];
        if (entry.wave !== this.wave) {
          this.wave = entry.wave; this._emit('wave', { wave: this.wave, totalWaves: this.totalWaves, flag: entry.flag });
        }
        this._spawnEnemy(entry.type, entry.row);
      }
      for (const plant of this.plants.slice()) this._stepPlant(plant, dt);
      for (const projectile of this.projectiles) this._stepProjectile(projectile, dt);
      this.projectiles = this.projectiles.filter(projectile => !projectile.dead && projectile.x <= COLS + 1 &&
        (projectile.type !== 'star' || (projectile.x >= -1 && projectile.y >= -1 && projectile.y <= this.rows + 1)));
      for (const mower of this.mowers) this._stepMower(mower, dt);
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || this.status !== 'running') continue;
        this._stepEnemy(enemy, dt);
      }
      this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
      this.plants = this.plants.filter(plant => plant.hp > 0);
      if (this.status === 'running' && this._spawnIndex === this._spawnSchedule.length && !this.enemies.length) {
        this.status = 'won'; this._emit('win', { levelIndex: this.levelIndex, kills: this.kills });
      }
    }

    _stepConveyor(dt) {
      for (const packet of this.conveyor) packet.age += dt;
      // A full belt waits without discarding cards or banking a burst of arrivals.
      if (this.conveyor.length >= MAX_CONVEYOR_PACKETS) return;
      this.conveyorNextIn = Math.max(0, this.conveyorNextIn - dt);
      if (this.conveyorNextIn > 1e-7) return;
      if (!this._conveyorBag.length) {
        this._conveyorBag = [...this.level.conveyorPool];
        for (let i = this._conveyorBag.length - 1; i > 0; i--) {
          const j = Math.floor(this._random() * (i + 1));
          [this._conveyorBag[i], this._conveyorBag[j]] = [this._conveyorBag[j], this._conveyorBag[i]];
        }
      }
      const packet = { id: this._id('packet'), type: this._conveyorBag.pop(), age: 0 };
      this.conveyor.push(packet); this.conveyorNextIn = this.level.conveyorInterval;
      this._emit('conveyor', { packet });
    }

    _stepPlant(plant, dt) {
      if (plant.hp <= 0) return;
      const config = PLANT_BY_ID[plant.type];
      plant.attackPulse = Math.max(0, plant.attackPulse - dt);
      plant.hurtPulse = Math.max(0, plant.hurtPulse - dt);
      plant.powerTime = Math.max(0, (plant.powerTime || 0) - dt);
      plant.shieldTime = Math.max(0, (plant.shieldTime || 0) - dt);
      if (!plant.shieldTime) plant.shieldHp = 0;
      if (plant.powerShots > 0) {
        plant.powerTimer -= dt;
        while (plant.powerTimer <= 1e-7 && plant.powerShots > 0) {
          plant.powerTimer += plant.powerShotInterval; plant.powerShots--; plant.attackPulse = 220;
          this._shoot(plant, { power: true });
          this._emit('shot', { plant, row: plant.row, x: plant.col + .5, count: plant.type === 'star' ? 12 : 1, power: true });
        }
      }
      if (plant.type === 'kelp') {
        const target = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.headless && enemy.row === plant.row && Math.abs(enemy.x - (plant.col + .5)) < .9).sort((a, b) => a.x - b.x)[0];
        if (target) { plant.hp = 0; this._effect('kelp', plant.row, target.x, 1000); this._damage(target, target.hp, 'kelp'); this._emit('kelp', { row: plant.row, x: target.x }); }
      } else if (plant.type === 'sun') {
        plant.sunTimer -= dt;
        if (plant.sunTimer <= 1e-7) {
          plant.sunTimer += config.production; plant.attackPulse = 450;
          this._sun(plant.col + .5, plant.row + .3, 'plant');
        }
      } else if (plant.type === 'mine') {
        if (!plant.armed) {
          plant.armRemaining = Math.max(0, plant.armRemaining - dt);
          if (plant.armRemaining <= 1e-7) this._armMine(plant);
        }
        const x = plant.col + .5;
        if (plant.armed && this.enemies.some(enemy => enemy.hp > 0 && !enemy.headless && !enemy.vaulting && !enemy.hasPole && enemy.row === plant.row && Math.abs(enemy.x - x) <= .5)) {
          const radius = plant.boosted ? 1.1 : .8, damage = plant.boosted ? 2400 : config.damage;
          // Remove the trigger before applying damage: a crowded lane spends only one mine.
          plant.hp = 0;
          for (const enemy of this.enemies) if (enemy.hp > 0 && !enemy.vaulting && enemy.row === plant.row && Math.abs(enemy.x - x) <= radius) this._damage(enemy, damage, 'mine');
          this._effect('mineExplosion', plant.row, x, 900, { radius, power: plant.boosted });
          this._emit('mineExplosion', { row: plant.row, x, damage, radius, power: plant.boosted });
        }
      } else if (plant.type === 'bomb') {
        plant.fuse -= dt;
        if (plant.fuse <= 1e-7) {
          const x = plant.col + .5;
          for (const enemy of this.enemies) if (enemy.hp > 0 && Math.abs(enemy.row - plant.row) <= (plant.boosted ? 2 : 1) && Math.abs(enemy.x - x) <= (plant.boosted ? 2.5 : 1.5)) this._damage(enemy, plant.boosted ? 3000 : config.damage, 'bomb');
          plant.hp = 0; this._effect('explode', plant.row, x, 850, { radius: plant.boosted ? 2.5 : 1.5, power: Boolean(plant.boosted) });
          this._emit('explode', { row: plant.row, x });
        }
      } else if (config.attackInterval) {
        if (plant.pendingShot) {
          plant.burstTimer -= dt;
          if (plant.burstTimer <= 1e-7) { plant.pendingShot = false; this._shoot(plant); }
        }
        plant.attackTimer = Math.max(0, plant.attackTimer - dt);
        const target = this.enemies.some(enemy => {
          if (enemy.hp <= 0 || enemy.headless || enemy.x > COLS + .5) return false;
          if (plant.type !== 'star') return enemy.row === plant.row && enemy.x >= plant.col + .35 && (plant.type !== 'torch' || enemy.x <= plant.col + 1.95);
          if (enemy.vaulting || enemy.x < -.5) return false;
          const x = plant.col + .5, y = plant.row + .44;
          return STAR_DIRECTIONS.some(([vx, vy]) => starContact(x, y, x + vx * 14, y + vy * 14, enemy) !== null);
        });
        if (target && plant.attackTimer <= 1e-7) {
          plant.attackTimer = config.attackInterval - 75 + this._random() * 150; plant.attackPulse = 230;
          const count = plant.type === 'star' ? 5 : plant.type === 'burst' ? 2 : 1;
          this._shoot(plant);
          if (count === 2) { plant.pendingShot = true; plant.burstTimer = 150; }
          this._emit('shot', { plant, row: plant.row, x: plant.col + .5, count });
        }
      }
    }

    _armMine(plant) {
      if (plant.armed) return;
      plant.armRemaining = 0; plant.armed = true; plant.attackPulse = 400;
      const x = plant.col + .5;
      this._effect('mineArm', plant.row, x, 550);
      this._emit('mineArm', { plant, row: plant.row, x });
    }

    _shoot(plant, options = {}) {
      const config = PLANT_BY_ID[plant.type], power = Boolean(options.power);
      const x = plant.col + .5, y = plant.row + .44;
      if (plant.type === 'star') {
        const directions = power ? Array.from({ length: 12 }, (_, i) => [Math.cos(i * Math.PI / 6), Math.sin(i * Math.PI / 6)]) : STAR_DIRECTIONS;
        for (const [dx, dy] of directions) this.projectiles.push({ id: this._id('shot'), type: 'star', row: plant.row,
          x, y, vx: dx * 5.1, vy: dy * 5.1, damage: power ? 40 : config.damage, speed: 5.1, power });
        return;
      }
      const targets = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.headless && enemy.row === plant.row && enemy.x >= plant.col + .35 && enemy.x <= COLS + .5).sort((a, b) => a.x - b.x);
      if (plant.type === 'lightning') {
        if (!targets.length) return;
        const hit = new Set(), points = [{ x, y }]; let target = targets[0];
        for (let hop = 0; hop < 3 && target; hop++) {
          hit.add(target); points.push({ x: target.x, y: target.row + .44 });
          this._damage(target, Math.round(config.damage * Math.pow(.8, hop)), 'lightning');
          const previous = target;
          target = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.headless && !hit.has(enemy) && Math.hypot(enemy.x - previous.x, enemy.row - previous.row) <= 1.7)
            .sort((a, b) => Math.hypot(a.x - previous.x, a.row - previous.row) - Math.hypot(b.x - previous.x, b.row - previous.row))[0];
        }
        this._effect('lightning', plant.row, x, 380, { points }); return;
      }
      if (plant.type === 'torch') {
        for (const enemy of targets) if (enemy.x <= plant.col + 1.95) {
          this._damage(enemy, config.damage, 'fire'); if (enemy.hp > 0) { enemy.burnTime = Math.max(enemy.burnTime, 2200); enemy.burnDamage = Math.max(enemy.burnDamage, 15); }
        }
        this._effect('flame', plant.row, x, 450, { y, radius: 1.45 }); return;
      }
      if (plant.type === 'corn' || plant.type === 'cannon') {
        // Powered lobs still fly visibly when their previous target has fallen.
        const target = targets[0], flightDuration = plant.type === 'corn' ? 850 : 1100;
        const targetX = target ? Math.max(x + .2, target.x - target.speed * flightDuration / 1000 * (target.slowTime > 0 ? .5 : 1)) : Math.min(COLS - .3, x + 4);
        const butter = plant.type === 'corn' && (power || this._random() < .25);
        this.projectiles.push({ id: this._id('shot'), type: plant.type, row: plant.row, lob: true,
          x, y: y - .3, startX: x, startY: y - .3, targetX, targetY: y, age: 0, flightDuration,
          arcHeight: plant.type === 'corn' ? 1.2 : 1.65, damage: plant.type === 'cannon' ? (power ? 450 : config.damage) : butter ? 40 : config.damage,
          radius: plant.type === 'cannon' ? (power ? 1.85 : 1.25) : .45, butter, power });
        return;
      }
      this.projectiles.push({ id: this._id('shot'), type: plant.type, row: plant.row, x: plant.col + .78, y,
        damage: power ? (plant.type === 'ice' ? 30 : 35) : config.damage, pierce: plant.type === 'cactus' ? (power ? 99 : 2) : 1, hitIds: [], speed: power ? 6.4 : 5.1, power });
    }

    _stepProjectile(projectile, dt) {
      if (projectile.dead) return;
      if (projectile.lob) {
        projectile.age += dt;
        const t = Math.min(1, projectile.age / projectile.flightDuration);
        projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * t;
        projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * t - Math.sin(t * Math.PI) * projectile.arcHeight;
        if (t >= 1) {
          projectile.dead = true;
          const targets = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.vaulting && Math.hypot(enemy.x - projectile.x, enemy.row - projectile.row) <= projectile.radius)
            .sort((a, b) => Math.hypot(a.x - projectile.x, a.row - projectile.row) - Math.hypot(b.x - projectile.x, b.row - projectile.row));
          for (const enemy of (projectile.type === 'corn' ? targets.slice(0, 1) : targets)) {
            this._damage(enemy, projectile.damage, projectile.type);
            if (projectile.butter && enemy.hp > 0) { enemy.stunTime = 4000; this._effect('butter', enemy.row, enemy.x, 500); }
          }
          this._effect(projectile.type === 'cannon' ? 'explode' : 'kernel', projectile.row, projectile.x, projectile.type === 'cannon' ? 600 : 250,
            { radius: projectile.radius, power: projectile.power, butter: projectile.butter, y: projectile.y });
        }
        return;
      }
      if (projectile.type === 'star') {
        const toX = projectile.x + projectile.vx * dt / 1000, toY = projectile.y + projectile.vy * dt / 1000;
        let hit = null, firstContact = Infinity;
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0 || enemy.vaulting) continue;
          const contact = starContact(projectile.x, projectile.y, toX, toY, enemy);
          if (contact !== null && contact < firstContact) { hit = enemy; firstContact = contact; }
        }
        if (hit) {
          projectile.x += (toX - projectile.x) * firstContact; projectile.y += (toY - projectile.y) * firstContact;
          projectile.dead = true; this._damage(hit, projectile.damage, 'star');
        } else { projectile.x = toX; projectile.y = toY; }
        return;
      }
      const from = projectile.x, to = from + projectile.speed * dt / 1000;
      const hits = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.vaulting && !(projectile.hitIds || []).includes(enemy.id) && enemy.row === projectile.row && enemy.x + .24 >= from && enemy.x - .24 <= to).sort((a, b) => a.x - b.x);
      const hit = hits[0];
      // Convert a pea once, and only if the torch was crossed before contact.
      const travelEnd = hit ? Math.min(to, hit.x - .24) : to;
      if (projectile.type === 'shooter' || projectile.type === 'burst') {
        const torch = this.plants.find(plant => plant.hp > 0 && plant.type === 'torch' && plant.row === projectile.row && plant.col + .5 >= from && plant.col + .5 <= travelEnd);
        if (torch) { projectile.type = 'fire'; projectile.damage *= 2; this._effect('flame', torch.row, torch.col + .5, 200, { radius: .25 }); }
      }
      if (projectile.type === 'cactus') {
        for (const target of hits) {
          projectile.hitIds.push(target.id); this._damage(target, projectile.damage, 'cactus'); projectile.pierce--;
          if (projectile.pierce <= 0) { projectile.dead = true; projectile.x = target.x; break; }
        }
        if (!projectile.dead) projectile.x = to;
      } else if (hit) {
        projectile.x = hit.x; projectile.dead = true;
        this._damage(hit, projectile.damage, projectile.type);
        if (projectile.type === 'ice' && hit.hp > 0) {
          hit.slowTime = 10000; this._effect('ice', hit.row, hit.x, 450);
        }
      } else projectile.x = to;
    }

    _stepEnemy(enemy, dt) {
      enemy.hitPulse = Math.max(0, enemy.hitPulse - dt);
      const slow = enemy.slowTime > 0 ? .5 : 1;
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
      const config = ENEMIES[enemy.type];
      if (enemy.burnTime > 0) {
        const burnSlice = Math.min(dt, enemy.burnTime); enemy.burnTime -= burnSlice;
        enemy.burnAccumulator = (enemy.burnAccumulator || 0) + burnSlice;
        if (enemy.burnAccumulator >= 250 - 1e-7 || enemy.burnTime <= 0) {
          this._damage(enemy, (enemy.burnDamage || 15) * enemy.burnAccumulator / 1000, 'fire'); enemy.burnAccumulator = 0;
          if (enemy.hp <= 0) return;
        }
        if (enemy.burnTime <= 0) enemy.burnDamage = 0;
      }
      const immobilized = (enemy.stunTime || 0) > 0 || (enemy.freezeTime || 0) > 0;
      enemy.stunTime = Math.max(0, (enemy.stunTime || 0) - dt);
      enemy.freezeTime = Math.max(0, (enemy.freezeTime || 0) - dt);
      if (immobilized && !enemy.headless) { enemy.eating = false; return; }
      if (enemy.headless) {
        enemy.eating = false; enemy.dyingTime = Math.max(0, enemy.dyingTime - dt);
        enemy.x -= enemy.speed * slow * dt / 1000;
        if (enemy.dyingTime <= 0) this._damage(enemy, enemy.hp, 'decay');
        // A defeated body cannot eat plants, consume a mower, or enter the house.
        return;
      }
      if (enemy.vaulting) {
        enemy.vaultProgress = Math.min(1, enemy.vaultProgress + dt / 1200);
        enemy.x = enemy.vaultFrom + (enemy.vaultTo - enemy.vaultFrom) * enemy.vaultProgress;
        if (enemy.vaultProgress >= 1) {
          enemy.vaulting = false; enemy.hasPole = false; enemy.speed = enemy.walkSpeed;
          this._effect('land', enemy.row, enemy.x, 450); this._emit('vaultLand', { enemy });
        }
        return;
      }
      const nextX = enemy.x - enemy.speed * slow * dt / 1000;
      const target = this.plants.filter(plant => plant.hp > 0 && plant.row === enemy.row && plant.col + .86 >= nextX && plant.col + .2 <= enemy.x).sort((a, b) => b.col - a.col || Number(a.type === 'lily') - Number(b.type === 'lily'))[0];
      enemy.eating = Boolean(target);
      if (target && enemy.hasPole && target.type === 'tallwall') {
        enemy.hasPole = false; enemy.speed = enemy.walkSpeed;
        this._effect('blocked', enemy.row, enemy.x, 500); this._emit('vaultBlocked', { enemy, plant: target });
      }
      if (target && enemy.hasPole) {
        enemy.eating = false; enemy.vaulting = true; enemy.vaultProgress = 0;
        enemy.vaultFrom = enemy.x; enemy.vaultTo = target.col - .15;
        this._effect('vault', enemy.row, enemy.x, 450); this._emit('vault', { enemy });
      } else if (target) {
        enemy.x = Math.max(enemy.x, target.col + .86);
        if (target.type !== 'bomb') {
          const damage = config.bite * slow * dt / 1000, shield = Math.min(target.shieldHp || 0, damage);
          target.shieldHp = Math.max(0, (target.shieldHp || 0) - shield);
          target.hp = Math.max(0, target.hp - (damage - shield));
          target.hurtPulse = 180;
        }
      } else enemy.x = nextX;
      const mower = this.mowers[enemy.row];
      if (!enemy.vaulting && mower.enabled && !mower.used && enemy.x <= .04) {
        mower.used = true; mower.active = true; mower.x = -.45;
        this._effect('mower', enemy.row, -.1, 800); this._emit('mower', { row: enemy.row });
        this._damage(enemy, enemy.hp, 'mower');
      } else if (mower.active && enemy.x <= mower.x + .55) this._damage(enemy, enemy.hp, 'mower');
      else if (enemy.x < -.7) {
        this.status = 'lost'; this._emit('lose', { row: enemy.row, levelIndex: this.levelIndex });
      }
    }

    _stepMower(mower, dt) {
      if (!mower.active) return;
      const from = mower.x;
      mower.x += 5.5 * dt / 1000;
      for (const enemy of this.enemies) if (enemy.hp > 0 && enemy.row === mower.row && enemy.x >= from - .55 && enemy.x <= mower.x + .55) this._damage(enemy, enemy.hp, 'mower');
      if (mower.x > COLS + 1) mower.active = false;
    }

    _damage(enemy, amount, source) {
      if (enemy.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
      const armorDamage = Math.min(enemy.armorHp, amount), hadArmor = enemy.armorHp > 0;
      enemy.armorHp = Math.max(0, enemy.armorHp - armorDamage);
      enemy.bodyHp = Math.max(0, enemy.bodyHp - (amount - armorDamage));
      enemy.hp = enemy.armorHp + enemy.bodyHp; enemy.hitPulse = 160;
      if (hadArmor && !enemy.armorHp) {
        this._effect('armorBreak', enemy.row, enemy.x, 650, { enemyType: enemy.type });
        this._emit('armorBreak', { enemy });
      }
      if (enemy.hp > 0 && enemy.bodyHp <= 180 && !enemy.armLost) {
        enemy.armLost = true;
        this._effect('armLost', enemy.row, enemy.x, 700, { enemyType: enemy.type });
        this._emit('armLost', { enemy });
      }
      if (enemy.hp > 0 && enemy.bodyHp < 90 && !enemy.headless) {
        enemy.headless = true; enemy.eating = false; enemy.dyingTime = 3000;
        enemy.vaulting = false; enemy.hasPole = false;
        this._effect('headless', enemy.row, enemy.x, 500, { enemyType: enemy.type });
        this._emit('headless', { enemy });
      }
      this._effect('hit', enemy.row, enemy.x, 220, { value: amount, source });
      this._emit('hit', { enemy, damage: amount, source, armorDamage, armorImpact: hadArmor, killed: enemy.hp <= 0 });
      if (enemy.hp <= 0) {
        this.kills++;
        this._effect('defeat', enemy.row, enemy.x, 700, { enemyType: enemy.type, source,
          armLost: enemy.armLost, headless: enemy.headless, hasPole: enemy.hasPole, armorHp: enemy.armorHp });
        this._emit('defeat', { enemy, source });
      }
    }

    _spawnEnemy(type, row) {
      const config = ENEMIES[type];
      if (!config || !this.level.activeRows.includes(row)) return null;
      const walkSpeed = 1 / (4 + this._random() * 3);
      const aquatic = this.waterRows.includes(row);
      const speed = (!aquatic && config.vault) || type === 'flag' ? config.speed : walkSpeed;
      const enemy = { id: this._id('enemy'), type, row, aquatic, x: COLS + .35, hp: config.hp, maxHp: config.hp,
        armorHp: config.armor, maxArmorHp: config.armor, bodyHp: config.hp - config.armor,
        speed, walkSpeed, hasPole: Boolean(config.vault && !aquatic), vaulting: false, vaultProgress: 0,
        armLost: false, headless: false, dyingTime: 0, slowTime: 0, stunTime: 0, freezeTime: 0, burnTime: 0, burnDamage: 0, hitPulse: 0, eating: false };
      this.enemies.push(enemy); return enemy;
    }

    _sun(x, y, source, options = {}) {
      const sky = source === 'sky', pop = source === 'plant' || source === 'power';
      const targetX = clamp(x + (pop ? options.offsetX ?? (.35 + this._random() * .3) * (this._random() < .5 ? -1 : 1) : 0), .25, COLS - .25);
      const targetY = clamp(y + (pop ? options.offsetY ?? .55 : 0), .25, this.rows - .25);
      const startY = sky ? -.35 : y;
      const flightDuration = sky ? Math.max(500, (targetY - startY) / .65 * 1000) : pop ? 900 : 0;
      const sun = { id: this._id('sun'), x, y: startY, startX: x, startY, targetX, targetY, age: 0, flightDuration,
        landed: flightDuration === 0, falling: sky, value: 25, life: 7500, maxLife: 7500, source };
      this.suns.push(sun); this._effect('sun', Math.floor(y), x, 500, { y }); return sun;
    }

    _effect(type, row, x, life, extra = {}) { this.effects.push({ type, row, x, life, maxLife: life, ...extra }); }
    plantAt(row, col) { return this._plantAt(row, col); }
    _plantAt(row, col) { return this.plants.filter(plant => plant.row === row && plant.col === col && plant.hp > 0).sort((a, b) => Number(a.type === 'lily') - Number(b.type === 'lily'))[0]; }
    _validCell(row, col) { return Number.isInteger(row) && Number.isInteger(col) && this.level.activeRows.includes(row) && col >= 0 && col < COLS; }
    _skyInterval() { return Math.min(4250 + this._skyCount * 100, 9500) + this._random() * 2750; }
    _id(prefix) { return `${prefix}-${this._nextId++}`; }
    _random() { const value = Number(this.random()); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : .5; }
    _emit(type, detail = {}) { this.onEvent({ type, ...detail }); }
    _notify() { this.onChange(this.getState()); }
  }

  GardenGame.ROWS = ROWS; GardenGame.COLS = COLS; GardenGame.MAX_DECK_SIZE = MAX_DECK_SIZE; GardenGame.MAX_CONVEYOR_PACKETS = MAX_CONVEYOR_PACKETS;
  GardenGame.PLANTS = Object.freeze(PLANTS); GardenGame.LEVELS = Object.freeze(LEVELS);
  GardenGame.ENEMIES = ENEMIES; GardenGame.createCampaign = createCampaign; GardenGame.DEFAULT_CAMPAIGN_SEED = DEFAULT_CAMPAIGN_SEED;
  root.GardenGame = GardenGame;
  if (typeof module === 'object' && module.exports) module.exports = GardenGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
