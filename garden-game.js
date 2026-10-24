(function (root) {
  'use strict';

  const ROWS = 5, COLS = 9, STEP_MS = 1000 / 60, MAX_DECK_SIZE = 8, MAX_CONVEYOR_PACKETS = 8;
  const ATTACKERS = Object.freeze(['shooter', 'ice', 'burst', 'star', 'corn', 'cannon', 'lightning']);
  const ULTIMATES = {
    sun: ['灿烂日光', '喷出8颗阳光，共200点，记得点击收集'],
    shooter: ['飞叶风暴', '连续发射20发强化飞叶'],
    wall: ['坚不可摧', '回满生命，并获得10秒护盾'],
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
    { id: 'ice', name: '寒冰射手', cost: 175, cooldown: 7500, photoIndex: 7, color: '#75c2da', description: '20伤害，移动和啃咬减半10秒', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'burst', name: '双发射手', cost: 200, cooldown: 7500, photoIndex: 9, color: '#ac78b5', description: '连续两发，每发20伤害', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'bomb', name: '焰火伙伴', cost: 150, cooldown: 50000, initialCooldown: 25000, photoIndex: 11, color: '#e17a5e', description: '1.2秒后在3×3范围造成1800伤害', hp: 300, fuse: 1200, damage: 1800 },
    { id: 'star', name: '星星射手', cost: 125, cooldown: 7500, color: '#e8b83f', description: '约1.5秒向左、上下和右侧斜向发射五颗星，每颗20伤害', hp: 300, damage: 20, attackInterval: 1500 },
    { id: 'corn', name: '玉米投手', cost: 100, cooldown: 7500, color: '#dfb547', description: '抛射20伤害玉米；25%概率投出40伤害黄油并定身4秒', hp: 300, damage: 20, attackInterval: 3000 },
    { id: 'tallwall', name: '高坚果守卫', cost: 125, cooldown: 30000, initialCooldown: 15000, color: '#9c7752', description: '8000生命，拦住撑杆跳跃', hp: 8000 },
    { id: 'torch', name: '火炬伙伴', cost: 175, cooldown: 7500, color: '#e7803e', description: '穿过的普通飞叶伤害翻倍，并灼烧前方近处敌人', hp: 500, damage: 25, attackInterval: 1200 },
    { id: 'cannon', name: '重炮投手', cost: 325, cooldown: 15000, color: '#b78c61', description: '每4.5秒投出90伤害炮弹，波及邻近行', hp: 300, damage: 90, attackInterval: 4500 },
    { id: 'lightning', name: '闪电伙伴', cost: 200, cooldown: 7500, color: '#a68cdb', description: '每2.2秒释放35伤害闪电，最多连锁3名相邻来客', hp: 300, damage: 35, attackInterval: 2200 },
  ].map(plant => Object.freeze({ ...plant, ultimateName: ULTIMATES[plant.id][0], ultimateDescription: ULTIMATES[plant.id][1] }));
  const PLANT_BY_ID = Object.fromEntries(PLANTS.map(plant => [plant.id, plant]));
  const ENEMIES = Object.freeze({
    walker: Object.freeze({ name: '迷路来客', hp: 270, armor: 0, speed: .2, bite: 100 }),
    helmet: Object.freeze({ name: '路障来客', hp: 640, armor: 370, speed: .2, bite: 100 }),
    runner: Object.freeze({ name: '撑杆来客', hp: 500, armor: 0, speed: .4, bite: 100, vault: true }),
    brute: Object.freeze({ name: '铁桶来客', hp: 1370, armor: 1100, speed: .2, bite: 100 }),
    flag: Object.freeze({ name: '旗帜来客', hp: 270, armor: 0, speed: .27, bite: 100 }),
  });
  const LEVELS = [
    { id: 'morning', title: '01 · 第一束阳光', subtitle: '一行草坪，从收集阳光和种植射手开始', cards: ['shooter'], activeRows: [2], shovel: false, reward: 'sun', startSun: 150, duration: 75000,
      tutorialGate: { type: 'shooter', count: 2, hint: '先收集阳光，在中间草坪种下2名飞叶射手' }, waves: [
      { at: 3000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 15000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 27000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 39000, count: 2, spacing: 1800, pool: ['walker'] },
    ] },
    { id: 'breeze', title: '02 · 日光伙伴', subtitle: '三行草坪，先发展阳光再布防', cards: ['shooter', 'sun'], activeRows: [1, 2, 3], shovel: false, reward: 'bomb', startSun: 50, duration: 145000,
      tutorialGate: { type: 'sun', count: 3, hint: '先种下3名日光伙伴；每次点击阳光收集25点' }, waves: [
      { at: 10000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 25000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 40000, count: 2, spacing: 4000, pool: ['walker'] },
      { at: 60000, count: 2, spacing: 3500, pool: ['walker'] },
      { at: 80000, count: 3, spacing: 2500, pool: ['walker'] },
      { at: 104000, count: 5, spacing: 900, pool: ['walker'], flag: true },
    ] },
    { id: 'sunset', title: '03 · 路障来客', subtitle: '护甲需要更多火力，焰火可以解围', cards: ['shooter', 'sun', 'bomb'], activeRows: [1, 2, 3], shovel: false, reward: 'wall', startSun: 50, duration: 160000, waves: [
      { at: 20000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 37000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 55000, count: 2, spacing: 5000, pool: ['walker'] },
      { at: 76000, count: 2, spacing: 4500, pool: ['helmet', 'walker'] },
      { at: 100000, count: 3, spacing: 3000, pool: ['walker', 'helmet'] },
      { at: 126000, count: 6, spacing: 1000, pool: ['helmet', 'walker'], flag: true },
    ] },
    { id: 'practice', title: '自由演练', subtitle: '十二名伙伴自由搭配，练习能量豆与组合布阵', practice: true, cards: PLANTS.map(plant => plant.id), activeRows: [0, 1, 2, 3, 4], shovel: true, reward: null, startSun: 50, duration: 300000, waves: [
      { at: 25000, count: 2, spacing: 20000, pool: ['walker'] },
      { at: 65000, count: 3, spacing: 15000, pool: ['walker'] },
      { at: 115000, count: 3, spacing: 12000, pool: ['walker', 'helmet'] },
      { at: 160000, count: 4, spacing: 9000, pool: ['walker', 'helmet', 'runner'] },
      { at: 215000, count: 4, spacing: 8000, pool: ['helmet', 'runner', 'brute', 'walker'] },
      { at: 275000, count: 8, spacing: 1000, pool: ['helmet', 'walker', 'brute'], flag: true },
    ] },
    ...[
      { id: 'courtyard-gate', title: '04 · 花园的大门', subtitle: '撑杆来客首次现身，前后两层防线更安全', chapter: 'courtyard', reward: 'ice', cards: ['sun', 'shooter', 'wall', 'bomb'], activeRows: [1, 2, 3], startSun: 75, pools: [['walker'], ['walker', 'helmet'], ['walker', 'runner'], ['helmet', 'runner', 'walker']], counts: [2, 3, 4, 7] },
      { id: 'dunes-frost', title: '05 · 沙丘里的寒流', subtitle: '五行战场开放，用寒冰减缓来客推进', chapter: 'dunes', reward: 'corn', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice'], pools: [['walker'], ['walker', 'helmet'], ['runner', 'walker'], ['helmet', 'runner', 'walker']], counts: [3, 4, 5, 8] },
      { id: 'dunes-butter', title: '06 · 黄油时刻', subtitle: '投射物越过人群，黄油留下最危险的目标', chapter: 'dunes', reward: 'star', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn'], pools: [['walker'], ['helmet', 'walker'], ['brute', 'walker'], ['helmet', 'brute', 'walker']], counts: [3, 4, 5, 8] },
      { id: 'dunes-stars', title: '07 · 沙海星阵', subtitle: '把星星放在中央，让斜向弹幕照顾多行', chapter: 'dunes', reward: 'tallwall', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star'], pools: [['walker'], ['runner', 'walker'], ['helmet', 'runner'], ['brute', 'runner', 'walker']], counts: [3, 5, 6, 9] },
      { id: 'dunes-wall', title: '08 · 不可逾越', subtitle: '撑杆来客成队出现，高坚果守住跳跃路线', chapter: 'dunes', reward: 'torch', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star', 'tallwall'], pools: [['walker', 'runner'], ['runner', 'walker'], ['helmet', 'runner'], ['runner', 'brute', 'walker']], counts: [3, 5, 6, 10] },
      { id: 'harbor-fire', title: '09 · 港口的灯火', subtitle: '射手后排、火炬前排，尝试火焰飞叶组合', chapter: 'harbor', reward: 'cannon', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star', 'tallwall', 'torch'], pools: [['walker'], ['helmet', 'walker'], ['brute', 'helmet'], ['brute', 'runner', 'walker']], counts: [4, 5, 7, 10] },
      { id: 'harbor-cannon', title: '10 · 重炮迎潮', subtitle: '来客越来越密集，范围炮击可以同时打穿护甲', chapter: 'harbor', reward: 'lightning', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star', 'tallwall', 'torch', 'cannon'], pools: [['walker', 'helmet'], ['helmet', 'walker'], ['brute', 'helmet'], ['brute', 'helmet', 'walker']], counts: [4, 6, 8, 11] },
      { id: 'harbor-storm', title: '11 · 雷云集结', subtitle: '相邻敌人可以传导闪电，留住密集人群再出手', chapter: 'harbor', reward: 'burst', cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star', 'tallwall', 'torch', 'cannon', 'lightning'], pools: [['walker'], ['runner', 'helmet'], ['helmet', 'walker', 'runner'], ['brute', 'helmet', 'runner', 'walker']], counts: [4, 7, 8, 12] },
      { id: 'harbor-finale', title: '12 · 守住最后一波', subtitle: '十二名伙伴集结，把每局唯一的能量豆留给关键时刻', chapter: 'harbor', reward: null, cards: PLANTS.map(plant => plant.id), pools: [['walker', 'helmet'], ['runner', 'helmet'], ['brute', 'runner', 'walker'], ['brute', 'helmet', 'runner']], counts: [4, 7, 9, 14] },
    ].map((stage, index) => {
      const { pools, counts, ...details } = stage;
      return { ...details, activeRows: stage.activeRows || [0, 1, 2, 3, 4], shovel: true, startSun: stage.startSun || 100,
        duration: 245000 + index * 5000,
        waves: pools.map((pool, wave) => ({ at: [25000, 85000, 140000, 205000][wave] + index * 2000,
          count: counts[wave], spacing: wave === 3 ? 1400 : Math.max(4500, 10000 - index * 400), pool, flag: wave === 3 })) };
    }),
    ...[
      { id: 'fairground-belt', title: '13 · 传送带开张', subtitle: '卡片自动送来，不需要阳光；先守好三行草坪', mode: 'conveyor', modeLabel: '传送带', ruleSummary: '免费种植传送带卡片 · 最多保留8张',
        cards: ['shooter', 'wall', 'ice', 'bomb'], activeRows: [1, 2, 3], startSun: 0, conveyorInterval: 6500, conveyorInitial: ['shooter', 'shooter', 'wall'], conveyorPool: ['shooter', 'shooter', 'shooter', 'ice', 'ice', 'wall', 'bomb'],
        pools: [['walker'], ['walker', 'helmet'], ['walker', 'helmet'], ['helmet', 'walker']], counts: [2, 3, 4, 7], times: [30000, 70000, 110000, 155000] },
      { id: 'fairground-overcast', title: '14 · 阴天也灿烂', subtitle: '天空不再掉落阳光，日光伙伴负责所有补给', modeLabel: '阴天挑战', ruleSummary: '没有天空阳光 · 善用日光伙伴和能量豆', skySun: false,
        cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'corn', 'star', 'burst'], activeRows: [1, 2, 3], startSun: 150,
        pools: [['walker'], ['walker', 'helmet'], ['walker', 'runner'], ['helmet', 'walker']], counts: [2, 3, 4, 7], times: [35000, 85000, 140000, 195000] },
      { id: 'fairground-artillery', title: '15 · 空投派对', subtitle: '玉米和重炮从传送带登场，留好焰火应急', mode: 'conveyor', modeLabel: '重炮传送带', ruleSummary: '免费空投卡片 · 重炮和玉米越过前排投射',
        cards: ['shooter', 'corn', 'cannon', 'wall', 'bomb'], startSun: 0, conveyorInterval: 5500, conveyorInitial: ['shooter', 'corn', 'cannon'], conveyorPool: ['shooter', 'shooter', 'corn', 'corn', 'cannon', 'cannon', 'wall', 'bomb'],
        pools: [['walker'], ['walker', 'helmet'], ['helmet', 'brute', 'walker'], ['helmet', 'brute', 'walker']], counts: [3, 5, 6, 9], times: [35000, 85000, 140000, 195000] },
      { id: 'fairground-small-garden', title: '16 · 十五席花园', subtitle: '最多同时种下15名伙伴，每个位置都要精打细算', modeLabel: '限额布阵', ruleSummary: '全场最多15名伙伴 · 铲除后可以重新种植', plantLimit: 15,
        cards: ['sun', 'shooter', 'wall', 'bomb', 'ice', 'burst', 'tallwall', 'torch', 'cannon', 'lightning'], startSun: 200,
        pools: [['walker'], ['walker', 'helmet'], ['walker', 'runner'], ['helmet', 'runner', 'walker']], counts: [3, 4, 5, 8], times: [35000, 90000, 145000, 205000] },
      { id: 'fairground-rush', title: '17 · 冰火快车', subtitle: '补给更快，来客更多，冰冻与火焰轮番上阵', mode: 'conveyor', modeLabel: '疾速传送带', ruleSummary: '每4.5秒一张卡片 · 密集来客与冰火组合',
        cards: ['shooter', 'burst', 'ice', 'torch', 'wall', 'bomb'], startSun: 0, conveyorInterval: 4500, conveyorInitial: ['shooter', 'burst', 'ice'], conveyorPool: ['shooter', 'burst', 'burst', 'ice', 'ice', 'torch', 'wall', 'bomb'],
        pools: [['walker'], ['helmet', 'walker', 'runner'], ['helmet', 'runner', 'walker'], ['brute', 'helmet', 'walker']], counts: [3, 6, 8, 12], times: [35000, 85000, 135000, 185000] },
      { id: 'fairground-finale', title: '18 · 花园庆典', subtitle: '带上最合拍的八名伙伴，迎接庆典的最后一波', modeLabel: '庆典终章', ruleSummary: '自由选择最多8名伙伴 · 每局1颗能量豆',
        cards: PLANTS.map(plant => plant.id), startSun: 150,
        pools: [['walker', 'helmet'], ['runner', 'helmet'], ['brute', 'runner', 'walker'], ['brute', 'helmet', 'runner', 'walker']], counts: [4, 6, 8, 12], times: [35000, 95000, 160000, 225000] },
    ].map(stage => {
      const { pools, counts, times, ...details } = stage;
      return { ...details, chapter: 'fairground', activeRows: stage.activeRows || [0, 1, 2, 3, 4], shovel: true, reward: null,
        skySun: stage.mode === 'conveyor' ? false : stage.skySun !== false, duration: times[3] + 60000,
        waves: pools.map((pool, wave) => ({ at: times[wave], count: counts[wave], spacing: wave === 3 ? 1700 : 6500, pool, flag: wave === 3 })) };
    }),
  ].map((level, index) => Object.freeze({ ...level, chapter: level.chapter || 'courtyard', campaignOrder: level.practice ? null : index < 3 ? index + 1 : index, conveyorInitial: Object.freeze(level.conveyorInitial || []), conveyorPool: Object.freeze(level.conveyorPool || []), cards: Object.freeze(level.cards), activeRows: Object.freeze(level.activeRows), tutorialGate: level.tutorialGate ? Object.freeze(level.tutorialGate) : null, waves: Object.freeze(level.waves.map(wave => Object.freeze({ ...wave, pool: Object.freeze(wave.pool) }))) }));
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
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
      this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
      this.reset(0);
    }

    reset(levelIndex = 0) {
      this.levelIndex = Number.isInteger(levelIndex) ? clamp(levelIndex, 0, LEVELS.length - 1) : 0;
      this.level = LEVELS[this.levelIndex];
      this.deck = this.level.mode === 'conveyor' ? [...this.level.cards] : this.level.cards.slice(0, MAX_DECK_SIZE);
      this.status = 'ready'; this.sun = this.level.startSun; this.kills = 0; this.plantFood = 1;
      this.elapsed = 0; this.wave = 0; this.totalWaves = this.level.waves.length;
      this.spawnElapsed = 0; this.tutorialReady = !this.level.tutorialGate;
      this._plantedCounts = Object.fromEntries(PLANTS.map(plant => [plant.id, 0]));
      this.plants = []; this.enemies = []; this.projectiles = []; this.suns = []; this.effects = [];
      this.mowers = Array.from({ length: ROWS }, (_, row) => ({ row, enabled: this.level.activeRows.includes(row), active: false, used: false, x: -.5 }));
      this.cooldowns = Object.fromEntries(PLANTS.map(plant => [plant.id, plant.initialCooldown || 0]));
      this._nextId = 1; this.conveyor = []; this.conveyorNextIn = this.level.mode === 'conveyor' ? this.level.conveyorInterval : null; this._conveyorBag = [];
      for (const type of this.level.conveyorInitial) this.conveyor.push({ id: this._id('packet'), type, age: 0 });
      this._accumulator = 0; this._skyCount = 0; this._skyTimer = this._skyInterval(); this._spawnIndex = 0;
      this._spawnSchedule = [];
      this.level.waves.forEach((wave, waveIndex) => {
        for (let i = 0; i < wave.count; i++) {
          // The first visitor previews the middle lane; later arrivals vary by run.
          const rows = this.level.activeRows;
          const row = waveIndex === 0 && i === 0 ? 2 : rows[Math.floor(this._random() * rows.length)];
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
        activeRows: this.level.activeRows, tutorialReady: this.tutorialReady,
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
      if (this.status !== 'running' || !config || !this.deck.includes(type) || !this._canPlant(row, col) || this.cooldowns[type] > 0 || this.sun < config.cost) return false;
      this.sun -= config.cost; this.cooldowns[type] = config.cooldown;
      this._placePlant(type, row, col); return true;
    }

    plantFromConveyor(packetId, row, col) {
      if (this.status !== 'running' || this.level.mode !== 'conveyor' || !this._canPlant(row, col)) return false;
      const index = this.conveyor.findIndex(packet => packet.id === packetId);
      if (index < 0) return false;
      const [packet] = this.conveyor.splice(index, 1);
      this._placePlant(packet.type, row, col); return true;
    }

    _canPlant(row, col) {
      return this._validCell(row, col) && !this._plantAt(row, col) &&
        (!this.level.plantLimit || this.plants.filter(plant => plant.hp > 0).length < this.level.plantLimit);
    }

    _placePlant(type, row, col) {
      const config = PLANT_BY_ID[type];
      const plant = {
        id: this._id('plant'), type, row, col, hp: config.hp, maxHp: config.hp, attackPulse: 0, hurtPulse: 0,
        attackTimer: 200, burstTimer: 0, pendingShot: false, sunTimer: 7000, fuse: config.fuse || 0,
        powerTime: 0, powerShots: 0, powerTimer: 0, shieldHp: 0, shieldTime: 0,
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
      if (this.status !== 'running' || this.plantFood < 1 || !this._validCell(row, col)) return false;
      const plant = this._plantAt(row, col);
      if (!plant) return false;
      this.plantFood--; plant.powerTime = 2800; plant.attackPulse = 600;
      const x = plant.col + .5, y = plant.row + .44;
      this._effect('power', row, x, 2800, { plantType: plant.type, y });
      switch (plant.type) {
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
          plant.powerShots = { shooter: 20, burst: 30, corn: 8, cannon: 3 }[plant.type] || 0;
          plant.powerShotInterval = { shooter: 95, burst: 70, corn: 200, cannon: 550 }[plant.type] || 100;
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
        (projectile.type !== 'star' || (projectile.x >= -1 && projectile.y >= -1 && projectile.y <= ROWS + 1)));
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
      if (plant.type === 'sun') {
        plant.sunTimer -= dt;
        if (plant.sunTimer <= 1e-7) {
          plant.sunTimer += config.production; plant.attackPulse = 450;
          this._sun(plant.col + .5, plant.row + .3, 'plant');
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
        damage: power ? (plant.type === 'ice' ? 30 : 35) : config.damage, speed: power ? 6.4 : 5.1, power });
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
      const hit = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.vaulting && enemy.row === projectile.row && enemy.x + .24 >= from && enemy.x - .24 <= to).sort((a, b) => a.x - b.x)[0];
      // Convert a pea once, and only if the torch was crossed before contact.
      const travelEnd = hit ? Math.min(to, hit.x - .24) : to;
      if (projectile.type === 'shooter' || projectile.type === 'burst') {
        const torch = this.plants.find(plant => plant.hp > 0 && plant.type === 'torch' && plant.row === projectile.row && plant.col + .5 >= from && plant.col + .5 <= travelEnd);
        if (torch) { projectile.type = 'fire'; projectile.damage *= 2; this._effect('flame', torch.row, torch.col + .5, 200, { radius: .25 }); }
      }
      if (hit) {
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
      const target = this.plants.filter(plant => plant.hp > 0 && plant.row === enemy.row && plant.col + .86 >= nextX && plant.col + .2 <= enemy.x).sort((a, b) => b.col - a.col)[0];
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
      const speed = config.vault || type === 'flag' ? config.speed : walkSpeed;
      const enemy = { id: this._id('enemy'), type, row, x: COLS + .35, hp: config.hp, maxHp: config.hp,
        armorHp: config.armor, maxArmorHp: config.armor, bodyHp: config.hp - config.armor,
        speed, walkSpeed, hasPole: Boolean(config.vault), vaulting: false, vaultProgress: 0,
        armLost: false, headless: false, dyingTime: 0, slowTime: 0, stunTime: 0, freezeTime: 0, burnTime: 0, burnDamage: 0, hitPulse: 0, eating: false };
      this.enemies.push(enemy); return enemy;
    }

    _sun(x, y, source, options = {}) {
      const sky = source === 'sky', pop = source === 'plant' || source === 'power';
      const targetX = clamp(x + (pop ? options.offsetX ?? (.35 + this._random() * .3) * (this._random() < .5 ? -1 : 1) : 0), .25, COLS - .25);
      const targetY = clamp(y + (pop ? options.offsetY ?? .55 : 0), .25, ROWS - .25);
      const startY = sky ? -.35 : y;
      const flightDuration = sky ? Math.max(500, (targetY - startY) / .65 * 1000) : pop ? 900 : 0;
      const sun = { id: this._id('sun'), x, y: startY, startX: x, startY, targetX, targetY, age: 0, flightDuration,
        landed: flightDuration === 0, falling: sky, value: 25, life: 7500, maxLife: 7500, source };
      this.suns.push(sun); this._effect('sun', Math.floor(y), x, 500, { y }); return sun;
    }

    _effect(type, row, x, life, extra = {}) { this.effects.push({ type, row, x, life, maxLife: life, ...extra }); }
    _plantAt(row, col) { return this.plants.find(plant => plant.row === row && plant.col === col && plant.hp > 0); }
    _validCell(row, col) { return Number.isInteger(row) && Number.isInteger(col) && this.level.activeRows.includes(row) && col >= 0 && col < COLS; }
    _skyInterval() { return Math.min(4250 + this._skyCount * 100, 9500) + this._random() * 2750; }
    _id(prefix) { return `${prefix}-${this._nextId++}`; }
    _random() { const value = Number(this.random()); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : .5; }
    _emit(type, detail = {}) { this.onEvent({ type, ...detail }); }
    _notify() { this.onChange(this.getState()); }
  }

  GardenGame.ROWS = ROWS; GardenGame.COLS = COLS; GardenGame.MAX_DECK_SIZE = MAX_DECK_SIZE; GardenGame.MAX_CONVEYOR_PACKETS = MAX_CONVEYOR_PACKETS;
  GardenGame.PLANTS = Object.freeze(PLANTS); GardenGame.LEVELS = Object.freeze(LEVELS);
  GardenGame.ENEMIES = ENEMIES;
  root.GardenGame = GardenGame;
  if (typeof module === 'object' && module.exports) module.exports = GardenGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
