(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 60, MAX_DELTA = 250;
  const PATH = Object.freeze([{ x: 32, y: -35 }, { x: 32, y: 315 }, { x: 366, y: 315 }, { x: 366, y: 345 }].map(Object.freeze));
  const SUPPLY_LANE = Object.freeze({ x: 366, startY: 690, stopY: 395, spacing: 52, capacity: 6 });
  const SLOTS = Object.freeze([90, 160, 245, 385, 460, 535].flatMap(y => [85, 155, 225, 295].map(x => ({ x, y }))).map((slot, id) => Object.freeze({ id, ...slot })));
  const FALLBACK_TYPES = [
    { kind: 'whisky', name: '威士忌', hp: 8, speed: 31, reward: 9, tint: '#c58a39' },
    { kind: 'brandy', name: '白兰地', hp: 14, speed: 23, reward: 15, tint: '#a76135' },
    { kind: 'wine', name: '红酒', hp: 6, speed: 37, reward: 8, tint: '#7b344d' },
    { kind: 'baijiu', name: '白酒', hp: 10, speed: 32, reward: 12, tint: '#d65a42' },
    { kind: 'gin', name: '金酒', hp: 4, speed: 48, reward: 8, tint: '#4d9bb1' },
    { kind: 'champagne', name: '香槟', hp: 20, speed: 26, reward: 20, tint: '#71915b' },
  ];
  const PATH_LENGTH = PATH.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y), 0);
  const TAU = Math.PI * 2, SAFE_LIMIT = Number.MAX_SAFE_INTEGER;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const safe = value => Math.min(SAFE_LIMIT, Math.max(0, Number.isFinite(value) ? value : SAFE_LIMIT));
  const levelNumber = level => Number.isSafeInteger(level) && level >= 0 ? level : 0;
  const noop = () => {};
  const BASE_ROUTES = Object.freeze(['ice', 'fire', 'lightning', 'earth', 'grass']);
  const ADVANCED = Object.freeze({ ice: ['glacier', 'blizzard', 'rime'], fire: ['magma', 'solar', 'inferno'], lightning: ['storm', 'plasma', 'surge'],
    earth: ['bastion', 'quake', 'crystal'], grass: ['vine', 'thorn', 'bloom'] });
  const SKILLS = Object.freeze({ ice: ['shatter', 'permafrost', 'whiteout', 'hail'], fire: ['eruption', 'slag', 'flare', 'nova'],
    lightning: ['thunderhead', 'cyclone', 'pulse', 'arc'], earth: ['fault', 'meteor', 'fortress', 'erosion'], grass: ['root', 'venom', 'harvest', 'seedstorm'] });
  const ENHANCEMENTS = Object.freeze(['echo', 'dominion', 'overdrive']);
  const CATALOG = {
    ice: ['冰霜', '飞刃减速敌人；后续仅出现冰元素进化。', '冰', '#78d0e0', 'ice', 1],
    fire: ['火焰', '飞刃产生溅射；后续仅出现火元素进化。', '火', '#f29a55', 'fire', 1],
    lightning: ['雷电', '飞刃连锁附近敌人；后续仅出现雷元素进化。', '雷', '#b69af5', 'lightning', 1],
    earth: ['大地', '飞刃侵蚀护甲；后续仅出现土元素进化。', '土', '#cba16d', 'earth', 1],
    grass: ['草木', '飞刃施加持续毒伤；后续仅出现草元素进化。', '草', '#81c875', 'grass', 1],
    golden: ['黄金战士', '吞噬任意普通伙伴积累等级，每阶攻击变为原来的三倍。', '金', '#ffd76a', 'golden', 0],
    rime: ['凛风', '飞刃转速提高，冰霜减速持续更久。', '凛', '#b1effa', 'ice', 2],
    inferno: ['烈狱', '飞刃持续灼烧目标，并强化火焰溅射。', '狱', '#ff9063', 'fire', 2],
    surge: ['雷涌', '飞刃转速提高，连锁能穿透部分护甲。', '涌', '#aaadff', 'lightning', 2],
    bastion: ['岩垒', '重型飞刃提高直击伤害并减速敌人。', '垒', '#c8ac7d', 'earth', 2],
    quake: ['地震', '飞刃震荡周围敌人，造成范围伤害。', '震', '#c59560', 'earth', 2],
    crystal: ['晶岩', '飞刃穿甲并追加碎晶伤害。', '岩', '#edcf9e', 'earth', 2],
    vine: ['藤蔓', '毒伤与减速持续牵制敌人。', '藤', '#69bb84', 'grass', 2],
    thorn: ['荆棘', '提高直击与穿甲能力，毒伤更强。', '棘', '#a6c866', 'grass', 2],
    bloom: ['繁花', '花粉扩散到附近目标，造成范围毒伤。', '花', '#b7dc8a', 'grass', 2],
    fault: ['断层', '重击侵蚀护甲并震荡周围目标。', '断', '#d9b780', 'earth', 3],
    meteor: ['陨星', '落星追加重击，并扩大震荡范围。', '陨', '#f2bd77', 'earth', 3],
    fortress: ['山岳', '周期释放减速领域，削弱闯入的敌人。', '岳', '#cfbb91', 'earth', 3],
    erosion: ['风化', '飞刃穿透大部分护甲，并持续破甲。', '砂', '#ecd4aa', 'earth', 3],
    root: ['缠根', '命中短暂束缚敌人，并深度减速。', '根', '#7bcd91', 'grass', 3],
    venom: ['剧毒', '大幅提高持续毒伤与毒素持续时间。', '毒', '#b4df69', 'grass', 3],
    harvest: ['收割', '对低生命目标造成额外伤害，花粉溅射。', '穗', '#cfe989', 'grass', 3],
    seedstorm: ['飞种', '种子连锁附近目标，传播毒素。', '种', '#a2dca4', 'grass', 3],
    glacier: ['寒晶', '加深减速，并对已减速的敌人造成额外伤害。', '晶', '#75d9ed', 'ice', 2],
    blizzard: ['暴雪', '飞刃掀起冰雪范围攻击，减速周围敌人。', '雪', '#c0edf5', 'ice', 2],
    magma: ['熔岩', '扩大火焰溅射，并留下持续灼烧。', '熔', '#ee7042', 'fire', 2],
    solar: ['曜炎', '提高直击伤害，飞刃穿透部分护甲。', '日', '#ffd276', 'fire', 2],
    storm: ['风暴', '连锁更远、更多目标，并附带减速。', '风', '#9ac8f5', 'lightning', 2],
    plasma: ['磁暴', '强化电弧伤害，并穿透敌人护甲。', '磁', '#cf9ef4', 'lightning', 2],
    shatter: ['裂晶', '对受减速目标造成强力碎晶伤害，并击碎周围目标。', '裂', '#80e0e9', 'ice', 3],
    permafrost: ['永冻', '命中会短暂冻结敌人；同一敌人冻结后有抗性间隔。', '冻', '#a2eafa', 'ice', 3],
    whiteout: ['霜域', '每隔数秒在身边展开减速并伤害敌人的霜域。', '霜', '#d2f4ff', 'ice', 3],
    hail: ['冰雹', '命中后追加一次冰雹追击，并扩大冰雪溅射。', '雹', '#9eddec', 'ice', 3],
    eruption: ['地火', '大幅扩大熔岩爆发范围与溅射伤害。', '地', '#ed6946', 'fire', 3],
    slag: ['熔蚀', '持续灼烧并侵蚀护甲，后续飞刃更容易造成伤害。', '蚀', '#e99350', 'fire', 3],
    flare: ['日冕', '强烈日冕持续灼烧命中的敌人。', '冕', '#ffd96b', 'fire', 3],
    nova: ['耀斑', '对生命低于四分之一的目标造成斩杀增伤。', '耀', '#ffe7a4', 'fire', 3],
    thunderhead: ['雷云', '连锁更多目标，提升后续电弧伤害。', '云', '#a3bafb', 'lightning', 3],
    cyclone: ['飓风', '周期释放风场，伤害并减速周围敌人。', '飓', '#9ad7e4', 'lightning', 3],
    pulse: ['脉冲', '电弧命中短暂麻痹敌人，并侵蚀部分护甲。', '脉', '#d8b0f9', 'lightning', 3],
    arc: ['穿弧', '电弧穿透大部分护甲，连锁距离更远。', '弧', '#bda4fa', 'lightning', 3],
    echo: ['回响', '每次命中追加回响伤害；重复选择会提高回响强度。', '响', '#e6ca91', null, 4],
    dominion: ['领域', '周期释放范围攻击；重复选择会扩大范围并增强伤害。', '域', '#a8dfc4', null, 4],
    overdrive: ['超载', '提高飞刃转速和伤害；重复选择持续强化。', '载', '#f0a59b', null, 4],
  };
  const ROUTES = Object.freeze(Object.keys(CATALOG));
  const routeInfo = (id, level) => {
    const entry = Object.prototype.hasOwnProperty.call(CATALOG, id) ? CATALOG[id] : null;
    if (!entry) return { id: 'normal', name: '环刃', description: '合成同级、同元素的伙伴来进化，保留目标技能。', icon: '刃', color: '#b5a58d', family: 'normal', tier: 0 };
    return { id, name: entry[0], description: entry[1], icon: entry[2], color: entry[3], family: entry[4],
      tier: entry[5] === 4 && Number.isSafeInteger(level) ? Math.max(4, Math.floor((level + 1) / 4)) : entry[5] };
  };
  // Accept only a contiguous, valid ancestry. Unknown or cross-family nodes
  // must never collapse into apparently matching merge paths.
  const evolutionPath = unit => {
    const raw = unit?.routeChoices || {}, path = [];
    const entries = Object.entries(raw).map(([key, route]) => ({ key, level: Number(key), route }))
      .filter(entry => Number.isSafeInteger(entry.level) && entry.level >= 3 && entry.level < SAFE_LIMIT &&
        (entry.level + 1) % 4 === 0 && entry.key === String(entry.level)).sort((a, b) => a.level - b.level);
    for (const { level, route } of entries) {
      if (level !== 3 + path.length * 4) break;
      const choices = level === 3 ? BASE_ROUTES : level === 7 ? ADVANCED[path[0]?.route] :
        level === 11 ? SKILLS[path[0]?.route] : ENHANCEMENTS;
      if (!choices?.includes(route)) break;
      path.push({ level, route });
    }
    return path;
  };
  const evolutionChoices = (unit, level) => {
    if (!Number.isSafeInteger(level) || level < 3 || level >= SAFE_LIMIT || (level + 1) % 4 !== 0) return [];
    const path = evolutionPath(unit).filter(entry => entry.level < level);
    if (path.length !== (level - 3) / 4) return [];
    return [...(level === 3 ? BASE_ROUTES : level === 7 ? ADVANCED[path[0]?.route] : level === 11 ? SKILLS[path[0]?.route] : ENHANCEMENTS)];
  };
  const elementFor = unit => unit?.isGolden ? 'golden' : evolutionPath(unit)[0]?.route || BASE_ROUTES.find(id => unit?.routes?.[id] > 0) || 'normal';
  const validPath = unit => {
    const path = evolutionPath(unit), raw = Object.keys(unit.routeChoices || {});
    return path.length === raw.length && path.every(entry => entry.level <= unit.level);
  };
  const canMerge = (source, target) => {
    if (!source || !target || source === target || source.id === target.id || source.isGolden || target.isGolden ||
      !Number.isSafeInteger(source.level) || source.level < 0 || source.level >= SAFE_LIMIT || source.level !== target.level) return false;
    return validPath(source) && validPath(target) && elementFor(source) === elementFor(target);
  };
  const canFeed = (source, target) => Boolean(source && target && source !== target && source.id !== target.id &&
    !source.isGolden && target.isGolden && Number.isSafeInteger(source.level) && source.level >= 0 && source.level < SAFE_LIMIT);
  const goldenProgress = unit => {
    if (!unit?.isGolden) return null;
    const rank = Math.max(1, levelNumber(unit.goldenRank));
    return { rank, progress: safe(unit.goldenFeed || 0), required: safe(10 * Math.pow(2, Math.min(50, rank - 1))) };
  };
  const routeRanks = routes => Object.fromEntries(ROUTES.map(route => [route, Number.isSafeInteger(routes?.[route]) && routes[route] > 0 ? routes[route] : 0]));
  const evolutionChance = level => Math.max(0.55, 0.95 - levelNumber(level) * 0.03);
  const statsForLevel = (level, routes = {}, activeRoute) => {
    const n = levelNumber(level), ranks = routeRanks(routes);
    const family = BASE_ROUTES.find(route => ranks[route]) || 'normal';
    const advanced = (ADVANCED[family] || []).find(route => ranks[route]) || null;
    const skill = (SKILLS[family] || []).find(route => ranks[route]) || null;
    const latest = ranks[activeRoute] ? activeRoute : skill || advanced || family;
    const orbitRadius = 52 + Math.min(16, n);
    const stats = { damage: safe(n + 1), range: orbitRadius, orbitRadius, bladeCount: Math.min(4, 1 + Math.floor(n / 4)),
      angularSpeed: 2.6 + Math.min(0.6, n * 0.025), bladeLength: 24, bladeWidth: 7,
      slow: ranks.ice ? 0.25 : 0, slowDuration: 0.8,
      splash: ranks.fire ? 35 : 0, splashDamage: ranks.fire ? 0.45 : 0,
      chain: ranks.lightning ? 2 : 0, chainDamage: ranks.lightning ? 0.48 : 0, chainRange: 90,
      armorPierce: ranks.earth ? 0.2 : 0, burn: ranks.grass ? 0.18 : 0, burnDuration: ranks.grass ? 2 : 0, freeze: 0, freezeCooldown: 2.4,
      chilledBonus: 0, executeBonus: 0, echoDamage: 0, armorBreak: ranks.earth ? 0.02 : 0,
      fieldRadius: 0, fieldDamage: 0, fieldInterval: 2.6,
      ability: family, family, advanced, skill, tier: latest === 'normal' ? 0 : routeInfo(latest, n).tier,
      ranks, specialName: routeInfo(latest, n).name };
    if (advanced === 'glacier') { stats.slow = 0.4; stats.slowDuration = 1.2; stats.chilledBonus = 0.25; }
    if (advanced === 'blizzard') { stats.slow = 0.32; stats.splash = 48; stats.splashDamage = 0.35; }
    if (advanced === 'magma') { stats.splash = 55; stats.splashDamage = 0.6; stats.burn = 0.15; stats.burnDuration = 1.8; }
    if (advanced === 'solar') { stats.damage = safe(stats.damage * 1.2); stats.armorPierce = 0.3; }
    if (advanced === 'storm') { stats.chain = 3; stats.chainRange = 112; stats.slow = 0.16; }
    if (advanced === 'plasma') { stats.chainDamage = 0.7; stats.armorPierce = 0.4; }
    if (advanced === 'rime') { stats.angularSpeed += 0.35; stats.slow = 0.3; stats.slowDuration = 1.4; }
    if (advanced === 'inferno') { stats.burn = 0.3; stats.burnDuration = 2.2; stats.splashDamage = 0.65; }
    if (advanced === 'surge') { stats.angularSpeed += 0.35; stats.armorPierce = 0.25; }
    if (advanced === 'bastion') { stats.damage = safe(stats.damage * 1.2); stats.slow = 0.2; }
    if (advanced === 'quake') { stats.splash = 60; stats.splashDamage = 0.55; }
    if (advanced === 'crystal') { stats.armorPierce = 0.45; stats.echoDamage = 0.25; }
    if (advanced === 'vine') { stats.slow = 0.3; stats.slowDuration = 1.4; stats.burnDuration = 2.5; }
    if (advanced === 'thorn') { stats.damage = safe(stats.damage * 1.15); stats.armorPierce = 0.3; stats.burn = 0.25; }
    if (advanced === 'bloom') { stats.splash = 55; stats.splashDamage = 0.4; stats.burn = 0.25; }
    if (skill === 'shatter') { stats.chilledBonus = 0.65; stats.splash = 42; stats.splashDamage = 0.5; }
    if (skill === 'permafrost') { stats.freeze = 0.42; stats.slowDuration = 1.6; }
    if (skill === 'whiteout') { stats.fieldRadius = 100; stats.fieldDamage = 0.6; stats.slow = 0.45; }
    if (skill === 'hail') { stats.echoDamage = 0.4; stats.splash = 60; }
    if (skill === 'eruption') { stats.splash = 84; stats.splashDamage = 0.9; }
    if (skill === 'slag') { stats.armorPierce = 0.55; stats.armorBreak = 0.1; stats.burn = 0.3; stats.burnDuration = 2.4; }
    if (skill === 'flare') { stats.burn = 0.5; stats.burnDuration = 2.4; stats.splash = 45; }
    if (skill === 'nova') { stats.executeBonus = 1.4; stats.splashDamage = 0.65; }
    if (skill === 'thunderhead') { stats.chain = 5; stats.chainDamage = 0.8; }
    if (skill === 'cyclone') { stats.fieldRadius = 110; stats.fieldDamage = 0.45; stats.slow = 0.35; }
    if (skill === 'pulse') { stats.freeze = 0.3; stats.armorBreak = 0.08; }
    if (skill === 'arc') { stats.armorPierce = 0.85; stats.chainRange = 145; stats.chainDamage = 0.85; }
    if (skill === 'fault') { stats.armorBreak = 0.1; stats.splash = 75; stats.splashDamage = 0.6; }
    if (skill === 'meteor') { stats.echoDamage = Math.max(stats.echoDamage, 0.6); stats.splash = 85; stats.splashDamage = 0.6; }
    if (skill === 'fortress') { stats.fieldRadius = 105; stats.fieldDamage = 0.5; stats.slow = 0.4; }
    if (skill === 'erosion') { stats.armorPierce = 0.8; stats.armorBreak = 0.12; }
    if (skill === 'root') { stats.freeze = 0.35; stats.slow = 0.5; stats.slowDuration = 1.6; }
    if (skill === 'venom') { stats.burn = 0.65; stats.burnDuration = 3; }
    if (skill === 'harvest') { stats.executeBonus = 1.3; stats.splash = Math.max(stats.splash, 50); stats.splashDamage = 0.65; }
    if (skill === 'seedstorm') { stats.chain = 3; stats.chainDamage = 0.6; stats.chainRange = 110; stats.burn = 0.35; }
    // Diminishing returns keep every practical future rank useful without
    // unbounded geometry, attack rates, or simulation work.
    stats.echoDamage += (1.2 - stats.echoDamage) * ranks.echo / (ranks.echo + 6);
    if (ranks.dominion) {
      stats.fieldRadius = Math.max(stats.fieldRadius, 95 + 65 * ranks.dominion / (ranks.dominion + 5));
      stats.fieldDamage += 1.2 * ranks.dominion / (ranks.dominion + 6);
    }
    if (ranks.overdrive) {
      const drive = ranks.overdrive / (ranks.overdrive + 8);
      stats.angularSpeed += (4.8 - stats.angularSpeed) * drive;
      stats.damage = safe(stats.damage * (1 + drive));
    }
    return stats;
  };
  const statsForUnit = unit => {
    if (!unit?.isGolden) return statsForLevel(unit?.level, unit?.routes, unit?.route);
    const { rank } = goldenProgress(unit), stats = statsForLevel(14);
    return { ...stats, damage: safe(30 * Math.pow(3, Math.min(40, rank - 1))),
      bladeCount: Math.min(6, 4 + rank), bladeLength: 30, bladeWidth: 8,
      angularSpeed: 3.2 + 0.8 * (rank - 1) / (rank + 3), armorPierce: 0.35,
      splash: 42, splashDamage: 0.3, family: 'golden', ability: 'golden', specialName: '黄金战士', tier: rank };
  };
  const REACTIONS = Object.freeze([
    { elements: ['fire', 'ice'], name: '融解', color: '#ffd292', multiplier: 2, description: '后手伤害翻倍。' },
    { elements: ['ice', 'lightning'], name: '超导', color: '#bee5ff', multiplier: 1.6, armorBreak: 0.1, description: '后手伤害 ×1.6，并削弱 10% 护甲。' },
    { elements: ['earth', 'ice'], name: '碎冰', color: '#d1e7dc', multiplier: 1.7, splash: 60, splashDamage: 0.35, description: '后手伤害 ×1.7，碎冰震伤周围目标。' },
    { elements: ['grass', 'ice'], name: '霜绽', color: '#cdf6da', multiplier: 1.5, freeze: 0.35, description: '后手伤害 ×1.5，短暂冻结目标。' },
    { elements: ['fire', 'lightning'], name: '超载', color: '#ffc17b', multiplier: 1.8, splash: 65, splashDamage: 0.4, description: '后手伤害 ×1.8，爆炸波及周围目标。' },
    { elements: ['earth', 'fire'], name: '熔流', color: '#f3a56b', multiplier: 1.6, burn: 0.3, burnDuration: 2, description: '后手伤害 ×1.6，熔流持续灼烧。' },
    { elements: ['fire', 'grass'], name: '燎原', color: '#f4ca79', multiplier: 1.6, burn: 0.5, burnDuration: 2.5, description: '后手伤害 ×1.6，追加持续燃烧。' },
    { elements: ['earth', 'lightning'], name: '磁崩', color: '#d8bafa', multiplier: 1.5, armorBreak: 0.15, description: '后手伤害 ×1.5，并削弱 15% 护甲。' },
    { elements: ['grass', 'lightning'], name: '激生', color: '#d4eb91', multiplier: 1.7, slow: 0.2, slowDuration: 1.2, description: '后手伤害 ×1.7，麻痹减速 20%。' },
    { elements: ['earth', 'grass'], name: '缠生', color: '#b0d38f', multiplier: 1.4, slow: 0.55, slowDuration: 1.6, description: '后手伤害 ×1.4，根系减速 55%。' },
  ].map(reaction => Object.freeze({ ...reaction, id: reaction.elements.join('_'), elements: Object.freeze(reaction.elements) })));
  // Kept as inert compatibility APIs for older callers; evolution is merge-only.
  const upgradeCost = () => null;
  const enemyStatsForWave = (kindOrType, wave, boss = false) => {
    const type = typeof kindOrType === 'object' ? kindOrType : FALLBACK_TYPES.find(value => value.kind === kindOrType) || FALLBACK_TYPES[0];
    const age = Math.max(0, levelNumber(wave) - 1), late = Math.max(0, age - 4);
    // Keep waves 1–10 intact, then grow linearly alongside defender damage.
    // Stacking quadratic HP and fast-rising armor created a wall around wave 20.
    const early = Math.min(5, late), endless = Math.max(0, late - 5);
    const scaling = safe(1 + age * 0.13 + early * early * 0.16 + early * 0.4 + endless * 0.92);
    return { maxHp: Math.max(1, Math.round(safe(type.hp * scaling * (boss ? 4.2 : 1)))),
      speed: type.speed * 0.7 * Math.min(2.3, 1 + age * 0.032),
      armor: Math.min(0.2, early * 0.018 + endless * 0.003 + (boss && late ? 0.06 : 0)), reward: 0, damage: boss ? 3 : 1 };
  };
  const bladesFor = (unit, time) => {
    const stats = statsForUnit(unit), phase = Number.isFinite(unit.phase) ? unit.phase : (unit.id || 0) * 2.399963229728653;
    const rotation = ((Number.isFinite(time) ? time : 0) * stats.angularSpeed + phase) % TAU;
    return Array.from({ length: stats.bladeCount }, (_, index) => {
      const angle = rotation + index * TAU / stats.bladeCount, dx = Math.cos(angle), dy = Math.sin(angle);
      const inner = stats.orbitRadius - stats.bladeLength / 2, outer = stats.orbitRadius + stats.bladeLength / 2;
      return { index, angle, x: unit.x + dx * stats.orbitRadius, y: unit.y + dy * stats.orbitRadius,
        innerX: unit.x + dx * inner, innerY: unit.y + dy * inner, outerX: unit.x + dx * outer, outerY: unit.y + dy * outer };
    });
  };
  const segmentDistance = (point, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? clamp(((point.x - ax) * dx + (point.y - ay) * dy) / lengthSq, 0, 1) : 0;
    return Math.hypot(point.x - ax - t * dx, point.y - ay - t * dy);
  };

  class DefenseGame {
    constructor(options = {}) {
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onChange = options.onChange || noop;
      this.onEvent = options.onEvent || noop;
      this.onComplete = options.onComplete || noop;
      const catalog = root.DefenseEnemies?.types;
      this.types = FALLBACK_TYPES.map(fallback => ({ ...fallback, ...(Array.isArray(catalog) ? catalog.find(type => type.kind === fallback.kind) : null) }));
      this.path = PATH; this.slots = SLOTS;
      this.reset();
    }

    reset() {
      this.status = 'ready'; this.isPaused = false; this.score = 0; this.wave = 0;
      this.gold = 0; this.lives = 12; this.maxLives = 12; this.kills = 0; this.reserve = 0; this.reserveQueue = []; this.hatched = 0;
      this.maxLevel = 0; this.elapsed = 0; this.accumulator = 0; this.nextWaveIn = 0;
      this.units = []; this.enemies = []; this.supplies = []; this.bullets = []; this.effects = [];
      this.spawnQueue = []; this.spawnTimer = 0; this.waveActive = false; this.completed = false;
      this.goldenAppeared = false; this.sequence = 0; this.changeTimer = 0; this.supplySequence = 0; this.pendingEvolution = null;
      this._makeUnit(15); this._spawnSupply(); this._notify();
      return true;
    }

    start() {
      if (this.status !== 'ready' || this.pendingEvolution) return false;
      this.status = 'playing'; this._beginWave(); this._notify(); return true;
    }

    pause(value = true) {
      if (this.status !== 'playing') return false;
      this.isPaused = Boolean(value); this.accumulator = 0; this._notify(); return true;
    }

    getState() {
      return { status: this.status, isPaused: this.isPaused, score: this.score, wave: this.wave, gold: this.gold,
        lives: this.lives, maxLives: this.maxLives, kills: this.kills, unitCount: this.units.length,
        maxLevel: this.maxLevel, reserve: this.reserve, hatched: this.hatched, supplyCount: this.supplies.length, nextWaveIn: this.nextWaveIn,
        remaining: this.enemies.length + this.spawnQueue.length, elapsed: this.elapsed,
        goldenAppeared: this.goldenAppeared, pendingEvolution: this.pendingEvolution ? { ...this.pendingEvolution, choices: [...this.pendingEvolution.choices] } : null };
    }

    place(slot) {
      if (!this._canAct() || !this._validSlot(slot) || this._unitAt(slot) || this.reserve < 1) return false;
      this.reserve--; const unit = this._makeUnit(slot, this.reserveQueue.shift());
      this._effect('spawn', unit, { level: unit.level }); this._event('spawn', { unitId: unit.id, slot, level: unit.level }); this._notify(); return true;
    }

    move(fromSlot, toSlot) {
      if (!this._canAct() || !this._validSlot(fromSlot) || !this._validSlot(toSlot) || fromSlot === toSlot) return false;
      const source = this._unitAt(fromSlot), target = this._unitAt(toSlot);
      if (!source || (target && !canMerge(source, target) && !canFeed(source, target))) return false;
      if (target) {
        this.units.splice(this.units.indexOf(source), 1);
        if (canFeed(source, target)) this._feedGolden(target, source);
        else if (!this.goldenAppeared && this.wave >= 26 && target.level >= 14 && this._roll() < 0.05) this._awakenGolden(target, source);
        else this._attemptEvolution(target, 'merge', { materialId: source.id, sourceRoutes: routeRanks(source.routes), cost: 0 });
      } else {
        Object.assign(source, { slot: toSlot, x: SLOTS[toSlot].x, y: SLOTS[toSlot].y, pulse: 0.35 });
        this._event('move', { unitId: source.id, fromSlot, slot: toSlot, level: source.level });
      }
      this._notify(); return true;
    }

    canDiscard(slot, expectedUnitId) {
      if (!this._canAct() || !this._validSlot(slot)) return false;
      const unit = this._unitAt(slot);
      if (!unit || unit.isGolden || (arguments.length > 1 && unit.id !== expectedUnitId)) return false;
      return this.units.length > 1 || this.reserve > 0;
    }

    discard(slot, expectedUnitId) {
      const allowed = arguments.length > 1 ? this.canDiscard(slot, expectedUnitId) : this.canDiscard(slot);
      if (!allowed) return false;
      const unit = this._unitAt(slot);
      this.units.splice(this.units.indexOf(unit), 1);
      this._event('discard', { unitId: unit.id, slot, level: unit.level });
      this._notify(); return true;
    }

    upgrade() { return false; }

    step(milliseconds) {
      if (this.status !== 'playing' || this.isPaused || this.pendingEvolution || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      // A background-tab gap must not advance a whole unseen wave. Small deltas
      // accumulate, so 30, 60 and 120 Hz share the same deterministic simulation.
      this.accumulator += Math.min(milliseconds, MAX_DELTA);
      while (this.accumulator + 1e-8 >= STEP_MS && this.status === 'playing' && !this.pendingEvolution) {
        this.accumulator = Math.max(0, this.accumulator - STEP_MS); this._tick(STEP_MS / 1000);
      }
    }

    _canAct() { return (this.status === 'ready' || this.status === 'playing') && !this.isPaused && !this.pendingEvolution; }
    _validSlot(slot) { return Number.isInteger(slot) && slot >= 0 && slot < SLOTS.length; }
    _unitAt(slot) { return this.units.find(unit => unit.slot === slot); }
    _notify() { this.onChange(this.getState()); }
    _event(type, details = {}) { this.onEvent({ type, ...details }); }
    _effect(type, at, details = {}) { this.effects.push({ type, x: at.x, y: at.y, age: 0, duration: 0.55, ...details }); }
    _roll() { const value = this.random(); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5; }
    _makeUnit(slot, blueprint = {}) {
      const unit = { id: ++this.sequence, slot, level: 0, x: SLOTS[slot].x, y: SLOTS[slot].y, cooldown: 0, pulse: 0, phase: this.sequence * 2.399963229728653, bladeHits: {}, routes: routeRanks(), route: null, routeChoices: {} };
      unit.level = levelNumber(blueprint.level); unit.routeChoices = { ...blueprint.routeChoices };
      this._syncRoutes(unit); this.maxLevel = Math.max(this.maxLevel, unit.level);
      this.units.push(unit); return unit;
    }
    _drawChoices(pool) {
      const remaining = [...pool], choices = [];
      while (remaining.length && choices.length < 3) choices.push(remaining.splice(Math.floor(this._roll() * remaining.length), 1)[0]);
      return choices;
    }
    _awakenGolden(unit, material) {
      this.goldenAppeared = true; unit.isGolden = true; unit.goldenRank = 1; unit.goldenFeed = 0;
      unit.cooldown = 0; unit.bladeHits = {}; unit.fieldCooldown = 0; unit.pulse = 1;
      this._effect('golden', unit, { rank: 1, duration: 1.4 });
      this._event('golden', { unitId: unit.id, slot: unit.slot, level: unit.level, rank: 1, materialId: material.id });
    }
    _feedGolden(unit, material) {
      const previousRank = goldenProgress(unit).rank, gained = material.level + 1;
      unit.goldenFeed = safe((unit.goldenFeed || 0) + gained);
      // Exponential requirements make this loop logarithmic even for the largest safe feeder.
      let progress = goldenProgress(unit);
      while (progress.progress >= progress.required) {
        unit.goldenFeed = Math.max(0, progress.progress - progress.required); unit.goldenRank = safe(progress.rank + 1);
        progress = goldenProgress(unit);
      }
      unit.pulse = 0.8; unit.bladeHits = {};
      const details = { unitId: unit.id, materialId: material.id, gained, previousRank, ...progress };
      this._effect('feed', unit, { ...details, duration: 0.8 }); this._event('feed', details);
    }
    _attemptEvolution(unit, method, details) {
      const chance = evolutionChance(unit.level);
      // The material is consumed once. Failure preserves the target and its ancestry.
      if (this._roll() >= chance) {
        const previousLevel = unit.level; unit.pulse = 0.2;
        this._effect('evolveFail', unit, { duration: 0.7, previousLevel, level: unit.level, lostLevel: previousLevel - unit.level });
        this._event('evolveFail', { method, unitId: unit.id, slot: unit.slot, previousLevel, level: unit.level, chance, ...details });
        return;
      }
      unit.level++; this._syncRoutes(unit); unit.cooldown = 0; unit.bladeHits = {}; unit.pulse = 0.6; this.maxLevel = Math.max(this.maxLevel, unit.level);
      if ((unit.level + 1) % 4 === 0) {
        const choices = this._drawChoices(evolutionChoices(unit, unit.level));
        if (choices.length) this.pendingEvolution = { unitId: unit.id, level: unit.level, choices };
        this.accumulator = 0;
      }
      this._effect(method, unit, { level: unit.level, duration: 0.8 });
      this._event(method, { unitId: unit.id, slot: unit.slot, level: unit.level, chance, ...details });
    }

    _syncRoutes(unit) {
      const ranks = routeRanks(); let latest = -1, active = null;
      for (const { level: stage, route } of evolutionPath(unit)) {
        if (stage > unit.level) continue;
        ranks[route] = safe(ranks[route] + 1);
        if (stage > latest) { latest = stage; active = route; }
      }
      unit.routes = ranks; unit.route = active;
    }

    chooseEvolution(route) {
      const pending = this.pendingEvolution;
      if (!pending || !pending.choices.includes(route) || this.status === 'lost') return false;
      const unit = this.units.find(value => value.id === pending.unitId);
      if (!unit || unit.level !== pending.level || !evolutionChoices(unit, pending.level).includes(route)) return false;
      unit.routeChoices = { ...unit.routeChoices, [pending.level]: route }; this._syncRoutes(unit);
      unit.bladeHits = {}; unit.pulse = 0.6; this.pendingEvolution = null; this.accumulator = 0;
      this._effect('route', unit, { route, duration: 0.8 });
      this._event('route', { unitId: unit.id, slot: unit.slot, level: unit.level, route, rank: unit.routes[route], routes: { ...unit.routes } });
      this._notify(); return true;
    }

    _spawnSupply() {
      // Eggs remain available until broken. A full lane waits instead of
      // expiring rewards or allowing offscreen queues to grow indefinitely.
      const first = this.supplySequence++ === 0;
      // Preserve opening recruitment, then toughen shells with both production
      // and waves so high-level/AoE defenders cannot endlessly one-shot eggs.
      const extra = Math.max(0, this.supplySequence - 40), late = Math.max(0, this.wave - 5);
      const maxHp = first ? 2 : Math.round(safe(2 + Math.min(6, this.supplySequence * 0.12)
        + extra * 0.25 + extra * extra * 0.002 + late * late * 0.5));
      this.supplies.push({ id: ++this.sequence, x: SUPPLY_LANE.x, y: SUPPLY_LANE.startY,
        hp: maxHp, maxHp, hit: 0, speed: 65 + Math.min(25, this.wave * 0.6) });
    }

    _advanceSupplies(dt) {
      this.supplies.sort((a, b) => a.y - b.y || a.id - b.id);
      for (let index = 0; index < this.supplies.length; index++) {
        const supply = this.supplies[index];
        const stop = index ? this.supplies[index - 1].y + SUPPLY_LANE.spacing : SUPPLY_LANE.stopY;
        supply.y = Math.max(stop, supply.y - supply.speed * dt);
        supply.hit = Math.max(0, supply.hit - dt);
      }
      const last = this.supplies[this.supplies.length - 1];
      if (this.supplies.length < SUPPLY_LANE.capacity && (!last || last.y <= SUPPLY_LANE.startY - SUPPLY_LANE.spacing)) this._spawnSupply();
    }

    _swing(unit, dt) {
      const stats = statsForUnit(unit), hits = unit.bladeHits || (unit.bladeHits = {});
      for (const key of Object.keys(hits)) if (hits[key] <= this.elapsed) delete hits[key];
      // Substep the same radial segments the renderer draws. The thin blade
      // cannot tunnel between ticks, and each blade hits once per revolution.
      const samples = Math.max(1, Math.ceil(stats.angularSpeed * dt / 0.025));
      const objects = [...this.enemies.map(object => ({ type: 'enemy', object })), ...this.supplies.map(object => ({ type: 'supply', object }))];
      const candidates = objects.filter(({ type, object }) => {
        const radius = type === 'supply' ? 13 : object.boss ? 23 : 18;
        const distance = Math.hypot(object.x - unit.x, object.y - unit.y);
        return object.y <= HEIGHT + 20 && Math.abs(distance - stats.orbitRadius) <= stats.bladeLength / 2 + radius + stats.bladeWidth;
      });
      if (!candidates.length) return;
      for (let sample = 0; sample <= samples; sample++) {
        const at = this.elapsed - dt + dt * sample / samples;
        for (const blade of bladesFor(unit, at)) {
          for (const { type, object } of candidates) {
            const key = `${type}:${object.id}:${blade.index}`;
            if (hits[key] || !(type === 'supply' ? this.supplies : this.enemies).includes(object)) continue;
            const radius = type === 'supply' ? 13 : object.boss ? 23 : 18;
            if (segmentDistance(object, blade.innerX, blade.innerY, blade.outerX, blade.outerY) > radius + stats.bladeWidth / 2) continue;
            hits[key] = this.elapsed + TAU / stats.angularSpeed * 0.8;
            this._bladeHit(unit, blade, object, type, stats);
          }
        }
      }
    }

    _bladeHit(unit, blade, target, type, stats) {
      const objects = type === 'supply' ? this.supplies : this.enemies;
      const origin = { x: target.x, y: target.y };
      const nearby = stats.splash ? objects.filter(object => object !== target && Math.hypot(object.x - target.x, object.y - target.y) <= stats.splash) : [];
      const hit = (object, amount) => type === 'supply' ? this._damageSupply(object, amount, unit) : this._damage(object, amount, stats.slow, stats, unit);
      const multiplier = (target.slow ? 1 + stats.chilledBonus : 1) * (stats.executeBonus && target.hp / target.maxHp < 0.25 ? 1 + stats.executeBonus : 1);
      const previousHp = target.hp; target.hitAngle = blade.angle;
      hit(target, safe(stats.damage * multiplier));
      const dealt = Math.max(0, previousHp - target.hp);
      if (stats.echoDamage) { if (type === 'supply') this._damageSupply(target, safe(stats.damage * stats.echoDamage), unit); else this._damage(target, safe(stats.damage * stats.echoDamage), stats.slow, stats, unit, false); this._effect('skill', origin, { skill: stats.skill || 'echo', ability: stats.ability, radius: 24, duration: 0.35 }); }
      for (const object of nearby) hit(object, stats.damage * stats.splashDamage);
      this._effect('slash', origin, { angle: blade.angle, ability: stats.ability, damage: dealt, duration: 0.22 });
      if (stats.splash) this._effect(stats.family === 'fire' ? 'fire' : 'skill', origin, { skill: stats.skill || stats.advanced, ability: stats.ability, radius: stats.splash, duration: 0.35 });
      if (stats.skill) this._effect('skill', origin, { skill: stats.skill, ability: stats.ability, radius: 26, duration: 0.35 });
      if (stats.chain) {
        let previous = origin;
        const struck = new Set([target]);
        for (let index = 0; index < stats.chain; index++) {
          const next = objects.filter(object => !struck.has(object) && Math.hypot(object.x - previous.x, object.y - previous.y) <= stats.chainRange)
            .sort((a, b) => Math.hypot(a.x - previous.x, a.y - previous.y) - Math.hypot(b.x - previous.x, b.y - previous.y))[0];
          if (!next) break;
          this._effect('chain', next, { fromX: previous.x, fromY: previous.y, duration: 0.25 });
          const position = { x: next.x, y: next.y }; struck.add(next); hit(next, stats.damage * stats.chainDamage); previous = position;
        }
      }
      if (stats.splash || stats.chain) this._event('special', { ability: stats.ability, x: origin.x, y: origin.y, unitId: unit.id });
      unit.pulse = Math.max(unit.pulse, 0.1);
      this._event('slash', { unitId: unit.id, level: unit.level, x: origin.x, y: origin.y,
        targetId: target.id, targetType: type, bladeIndex: blade.index, ability: stats.ability, damage: dealt });
    }

    _beginWave() {
      this.wave = safe(this.wave + 1); this.waveActive = true; this.nextWaveIn = 0;
      const count = Math.min(52, 8 + this.wave * 2);
      const kinds = this.wave === 1 ? ['wine', 'whisky'] : this.wave < 3 ? ['wine', 'whisky', 'gin'] : this.wave < 5 ? ['wine', 'whisky', 'gin', 'baijiu'] : this.types.map(type => type.kind);
      this.spawnQueue = Array.from({ length: count }, (_, index) => ({ kind: kinds[Math.floor(this._roll() * kinds.length)], boss: this.wave % 5 === 0 && index === count - 1 }));
      if (this.wave % 5 === 0) this.spawnQueue[this.spawnQueue.length - 1].kind = 'champagne';
      this.spawnTimer = this.wave === 1 ? 2 : 0.7;
      this._event('wave', { wave: this.wave, count, boss: this.wave % 5 === 0 });
    }

    _spawnEnemy(entry) {
      const type = this.types.find(value => value.kind === entry.kind) || this.types[0];
      const stats = enemyStatsForWave(type, this.wave, entry.boss);
      const enemy = { id: ++this.sequence, kind: type.kind, name: type.name, tint: type.tint, x: PATH[0].x, y: PATH[0].y,
        ...stats, hp: stats.maxHp, progress: 0, hit: 0, boss: entry.boss, slow: 0, slowTime: 0 };
      this.enemies.push(enemy);
    }

    _positionEnemy(enemy) {
      let remaining = enemy.progress;
      for (let index = 1; index < PATH.length; index++) {
        const from = PATH[index - 1], to = PATH[index], segment = Math.hypot(to.x - from.x, to.y - from.y);
        if (remaining <= segment) { const t = remaining / segment; enemy.x = from.x + (to.x - from.x) * t; enemy.y = from.y + (to.y - from.y) * t; return; }
        remaining -= segment;
      }
      enemy.x = PATH[PATH.length - 1].x; enemy.y = PATH[PATH.length - 1].y;
    }

    _tick(dt) {
      this.elapsed += dt; this.changeTimer += dt;
      for (const effect of this.effects) effect.age += dt;
      this.effects = this.effects.filter(effect => effect.age < effect.duration);
      for (const unit of this.units) { unit.cooldown = Math.max(0, unit.cooldown - dt); unit.pulse = Math.max(0, unit.pulse - dt); }
      this._advanceSupplies(dt);
      if (this.waveActive && this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 1e-8) {
          this._spawnEnemy(this.spawnQueue.shift());
          this.spawnTimer += Math.max(0.28, 0.7 - (this.wave - 1) * 0.025);
        }
      }
      for (const enemy of this.enemies.slice()) {
        enemy.hit = Math.max(0, enemy.hit - dt); enemy.slowTime = Math.max(0, enemy.slowTime - dt);
        if (!enemy.slowTime) enemy.slow = 0;
        enemy.freezeTime = Math.max(0, (enemy.freezeTime || 0) - dt);
        enemy.freezeResistance = Math.max(0, (enemy.freezeResistance || 0) - dt);
        if (enemy.burnTime > 0) {
          const burning = Math.min(dt, enemy.burnTime); enemy.burnTime -= burning;
          this._damage(enemy, enemy.burnDamage * burning, 0, { armorPierce: 0.3 });
          if (!this.enemies.includes(enemy)) continue;
        }
        enemy.progress += enemy.speed * (1 - enemy.slow) * (enemy.freezeTime ? 0 : 1) * dt; this._positionEnemy(enemy);
        if (enemy.progress >= PATH_LENGTH) {
          this.enemies.splice(this.enemies.indexOf(enemy), 1); this.lives = Math.max(0, this.lives - enemy.damage);
          this._effect('leak', PATH[PATH.length - 1]); this._event('hit', { lives: this.lives, damage: enemy.damage, enemyId: enemy.id });
          if (this.lives === 0) { this._lose(); return; }
        }
      }
      for (const unit of this.units.slice()) { this._swing(unit, dt); this._field(unit, dt); }
      if (this.waveActive && !this.spawnQueue.length && !this.enemies.length) {
        this.waveActive = false; this.nextWaveIn = 3;
        this.score = safe(this.score + this.wave * 5);
        this._event('clear', { wave: this.wave, gold: 0 }); this._notify();
      } else if (!this.waveActive) {
        this.nextWaveIn = Math.max(0, this.nextWaveIn - dt);
        if (this.nextWaveIn <= 1e-8) { this._beginWave(); this._notify(); }
      }
      if (this.changeTimer >= 0.15) { this.changeTimer = 0; this._notify(); }
    }

    _field(unit, dt) {
      const stats = statsForUnit(unit);
      if (!stats.fieldRadius) return;
      unit.fieldCooldown = Math.max(0, (unit.fieldCooldown || 0) - dt);
      if (unit.fieldCooldown) return;
      const targets = this.enemies.filter(enemy => Math.hypot(enemy.x - unit.x, enemy.y - unit.y) <= stats.fieldRadius);
      if (!targets.length) return;
      unit.fieldCooldown = stats.fieldInterval;
      for (const target of targets) this._damage(target, safe(stats.damage * stats.fieldDamage), stats.slow, stats, unit);
      this._effect('field', unit, { ability: stats.ability, radius: stats.fieldRadius, duration: 0.6 });
      this._event('special', { ability: stats.ability, x: unit.x, y: unit.y, unitId: unit.id });
    }

    _elementReaction(enemy, family) {
      if (!BASE_ROUTES.includes(family) || (enemy.reactionCooldownUntil || 0) > this.elapsed) return null;
      const mark = enemy.elementMark;
      if (mark && mark.until > this.elapsed && mark.element !== family) {
        const reaction = REACTIONS.find(entry => entry.elements.includes(mark.element) && entry.elements.includes(family));
        if (reaction) { enemy.elementMark = null; enemy.reactionCooldownUntil = this.elapsed + 0.75; return reaction; }
      }
      enemy.elementMark = { element: family, until: this.elapsed + 3 }; return null;
    }
    _applyReaction(enemy, reaction, amount, dealt) {
      if (reaction.armorBreak) enemy.armorBroken = Math.min(0.5, (enemy.armorBroken || 0) + reaction.armorBreak);
      if (reaction.slow) { enemy.slow = Math.max(enemy.slow || 0, reaction.slow); enemy.slowTime = Math.max(enemy.slowTime || 0, reaction.slowDuration); }
      if (reaction.freeze && !(enemy.freezeResistance > 0)) { enemy.freezeTime = reaction.freeze; enemy.freezeResistance = 2.4; }
      if (reaction.burn) { enemy.burnDamage = Math.max(enemy.burnDamage || 0, safe(amount * reaction.burn)); enemy.burnTime = Math.max(enemy.burnTime || 0, reaction.burnDuration); }
      if (reaction.splash) for (const other of this.enemies.slice()) {
        if (other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= reaction.splash) this._damage(other, safe(amount * reaction.splashDamage), 0, {}, undefined, false);
      }
      const details = { reaction: reaction.id, elements: [...reaction.elements], name: reaction.name, color: reaction.color,
        multiplier: reaction.multiplier, damage: dealt, enemyId: enemy.id, x: enemy.x, y: enemy.y };
      this._effect('reaction', enemy, { ...details, radius: reaction.splash || 40, duration: 0.65 }); this._event('reaction', details);
    }

    _damage(enemy, amount, slow, stats = {}, unit, allowReaction = true) {
      if (!this.enemies.includes(enemy)) return;
      const reaction = allowReaction && unit && amount > 0 ? this._elementReaction(enemy, stats.family) : null;
      const previousHp = enemy.hp;
      const armor = clamp((enemy.armor || 0) - (enemy.armorBroken || 0), 0, 0.8);
      enemy.hp = Math.max(0, enemy.hp - safe(amount * (reaction?.multiplier || 1)) * (1 - armor * (1 - (stats.armorPierce || 0)))); enemy.hit = 0.12;
      if (slow) { enemy.slow = Math.max(enemy.slow, slow); enemy.slowTime = Math.max(enemy.slowTime || 0, stats.slowDuration || 0.8); }
      if (stats.freeze && !(enemy.freezeResistance > 0)) { enemy.freezeTime = stats.freeze; enemy.freezeResistance = stats.freezeCooldown || 2.4; }
      if (stats.armorBreak) enemy.armorBroken = Math.min(0.5, (enemy.armorBroken || 0) + stats.armorBreak);
      if (stats.burn) { enemy.burnDamage = Math.max(enemy.burnDamage || 0, safe(stats.damage * stats.burn)); enemy.burnTime = Math.max(enemy.burnTime || 0, stats.burnDuration); }
      if (unit && (stats.freeze || stats.armorBreak)) this._effect('skill', enemy, { skill: stats.skill, ability: stats.ability, radius: 22, duration: 0.3 });
      if (reaction) this._applyReaction(enemy, reaction, amount, previousHp - enemy.hp);
      this._effect('hit', enemy, { duration: 0.16 });
      if (enemy.hp > 0) return;
      this.enemies.splice(this.enemies.indexOf(enemy), 1); this.kills++;
      const points = safe((enemy.boss ? 50 : 10) + this.wave * 2); this.score = safe(this.score + points);
      this._effect('kill', enemy, { tint: enemy.tint, boss: enemy.boss });
      this._effect('score', enemy, { text: `+${points}`, duration: 0.7 });
      this._event('kill', { enemyId: enemy.id, kind: enemy.kind, boss: enemy.boss, gold: 0, score: points });
    }

    _damageSupply(supply, amount, attacker) {
      if (!this.supplies.includes(supply)) return;
      supply.hp = Math.max(0, supply.hp - amount); supply.hit = 0.18;
      this._effect('supplyHit', supply, { duration: 0.18 });
      this._event('supplyHit', { supplyId: supply.id, hp: supply.hp, maxHp: supply.maxHp });
      if (supply.hp > 0) return;
      this.supplies.splice(this.supplies.indexOf(supply), 1); this.hatched++;
      const slot = SLOTS.filter(value => !this._unitAt(value.id)).sort((a, b) => Math.hypot(a.x - supply.x, a.y - supply.y) - Math.hypot(b.x - supply.x, b.y - supply.y) || a.id - b.id)[0];
      const level = attacker?.isGolden ? 0 : Math.max(0, levelNumber(attacker?.level) - 2);
      const routeChoices = Object.fromEntries(evolutionPath(attacker).filter(entry => entry.level <= level).map(entry => [entry.level, entry.route]));
      const blueprint = { level, routeChoices };
      let details;
      if (slot) {
        const unit = this._makeUnit(slot.id, blueprint); unit.pulse = 0.6;
        details = { supplyId: supply.id, unitId: unit.id, slot: slot.id, level, routeChoices: { ...routeChoices } };
      } else {
        this.reserveQueue.push(blueprint); this.reserve = safe(this.reserve + 1);
        details = { supplyId: supply.id, reserve: true, level, routeChoices: { ...routeChoices } };
      }
      this._effect('hatch', supply, { ...details, duration: 0.8 }); this._event('hatch', details); this._notify();
    }

    _lose() {
      if (this.completed) return;
      this.status = 'lost'; this.isPaused = false; this.completed = true; this.accumulator = 0;
      this._event('lose', { score: this.score, wave: this.wave }); this._notify(); this.onComplete(this.getState());
    }
  }

  DefenseGame.WIDTH = WIDTH; DefenseGame.HEIGHT = HEIGHT; DefenseGame.SLOTS = SLOTS; DefenseGame.PATH = PATH;
  DefenseGame.PATH_LENGTH = PATH_LENGTH; DefenseGame.upgradeCost = upgradeCost; DefenseGame.statsForLevel = statsForLevel; DefenseGame.bladesFor = bladesFor;
  DefenseGame.SUPPLY_LANE = SUPPLY_LANE; DefenseGame.ROUTES = ROUTES;
  DefenseGame.routeInfo = routeInfo; DefenseGame.evolutionChoices = evolutionChoices; DefenseGame.enemyStatsForWave = enemyStatsForWave;
  DefenseGame.evolutionPath = evolutionPath; DefenseGame.canMerge = canMerge;
  DefenseGame.statsForUnit = statsForUnit; DefenseGame.elementFor = elementFor; DefenseGame.canFeed = canFeed;
  DefenseGame.goldenProgress = goldenProgress; DefenseGame.REACTIONS = REACTIONS; DefenseGame.BASE_ROUTES = BASE_ROUTES;
  DefenseGame.evolutionChance = evolutionChance; DefenseGame.upgradeSuccessRate = evolutionChance;
  root.DefenseGame = DefenseGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = DefenseGame;
})(typeof window !== 'undefined' ? window : globalThis);
