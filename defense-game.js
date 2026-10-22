(function (root) {
  'use strict';

  const WIDTH = 520, HEIGHT = 760, STEP_MS = 1000 / 60, MAX_DELTA = 250;
  const PATH = Object.freeze([{ x: 32, y: -35 }, { x: 32, y: 380 }, { x: 476, y: 380 }, { x: 476, y: 410 }].map(Object.freeze));
  const SUPPLY_LANE = Object.freeze({ x: 476, startY: 800, stopY: 454, spacing: 52, capacity: 6 });
  const SLOTS = Object.freeze([62, 126, 190, 254, 318, 444, 508, 572, 636, 700].flatMap(y => [105, 205, 305, 405].map(x => ({ x, y }))).map((slot, id) => Object.freeze({ id, ...slot })));
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
  const LEGACY_ENHANCEMENTS = Object.freeze(['echo', 'dominion', 'overdrive']);
  const ENHANCEMENTS = Object.freeze({ ice: Object.freeze(['ice_echo', 'ice_tide', 'ice_mirror']),
    fire: Object.freeze(['fire_ember', 'fire_relay', 'fire_scorch']), lightning: Object.freeze(['lightning_return', 'lightning_resonance', 'lightning_charge']),
    earth: Object.freeze(['earth_fault', 'earth_pierce', 'earth_gravity']), grass: Object.freeze(['grass_branch', 'grass_bloom', 'grass_prison']) });
  const GOLDEN_TALENTS = Object.freeze(['golden_blades', 'golden_domain', 'golden_resonance']);
  // Coefficients always use the triggering raw hit D, before reaction and armor.
  const TALENTS = Object.freeze({
    ice_echo: { name: '碎晶回响', family: 'ice', radius: 90, damage: .6, text: '本人触发含冰反应，向最多 3 个其他敌人释放冰片；冷却 1.5 秒。' },
    ice_tide: { name: '冻潮', family: 'ice', radius: 75, text: '每 5 次主剑命中冻结最多 3 敌 0.35 秒；每敌人冻结抗性 2.4 秒。' },
    ice_mirror: { name: '霜镜', family: 'ice', damage: .6, text: '主剑命中已有冰霜减速且本次未消耗冰霜的敌人时追加伤害；冷却 1.2 秒。' },
    fire_ember: { name: '余烬爆破', family: 'fire', radius: 60, damage: 2, text: '每 5 次主剑命中消耗剩余灼烧，追加伤害不超过所示上限，向最多 3 个其他敌人溅射其 40%；无灼烧时保留计数。' },
    fire_relay: { name: '火种接力', family: 'fire', radius: 90, damage: .35, text: '主剑击杀燃烧目标，向最多 3 敌传播所示每秒灼烧，持续 2 秒；火种击杀不再传播。' },
    fire_scorch: { name: '焦土', family: 'fire', radius: 60, damage: .25, text: '主剑命中留下火圈 1.5 秒，每 0.5 秒对最多 4 敌结算所示伤害；冷却 3 秒。' },
    lightning_return: { name: '折返电弧', family: 'lightning', damage: .8, text: '原生连锁击中过副目标后，向仍存活的首个目标追加一次伤害。' },
    lightning_resonance: { name: '感电共鸣', family: 'lightning', radius: 110, damage: .6, text: '本人触发含雷反应，向最多 2 个其他敌人放电；冷却 1.5 秒。' },
    lightning_charge: { name: '天雷蓄能', family: 'lightning', radius: 75, damage: 1.5, secondary: .4, text: '每 5 次主剑命中落雷，并波及最多 2 个其他敌人；两次触发至少间隔 1.5 秒。' },
    earth_fault: { name: '断层震波', family: 'earth', radius: 100, damage: .7, text: '每 4 次主剑命中，沿路选最近的最多 3 个其他敌人，追加伤害及 5 个百分点破甲（总上限 50%）。' },
    earth_pierce: { name: '碎甲穿刺', family: 'earth', damage: .8, text: '主剑命中已有至少 10% 破甲目标，追加无视护甲伤害；对同一目标冷却 1.2 秒。' },
    earth_gravity: { name: '重力井', family: 'earth', radius: 70, text: '主剑命中产生持续 1.2 秒的领域，只减速域内最近的最多 5 敌 40%；冷却 4 秒。' },
    grass_branch: { name: '缠枝', family: 'grass', radius: 90, damage: .4, text: '每 5 次主剑命中，向最多 3 个其他敌人传播伤害及 0.2 秒定身。' },
    grass_bloom: { name: '寄生花', family: 'grass', radius: 75, damage: .6, secondary: .2, text: '主剑击杀中毒目标，向最多 3 敌爆发伤害，并施加所示每秒毒伤持续 2 秒；派生伤害不再开花。' },
    grass_prison: { name: '森罗藤牢', family: 'grass', radius: 75, text: '本人触发含草反应，对最多 3 敌定身 0.4 秒；冷却 1.5 秒，每敌人藤牢抗性 2.4 秒。' },
  });
  const talentScale = rank => 1 + (rank - 1) / (rank + 3);
  const talentRadiusScale = rank => 1 + .25 * (rank - 1) / (rank + 3);
  const goldenRanks = unit => Object.fromEntries(GOLDEN_TALENTS.map(id => [id, levelNumber(unit?.goldenTalents?.[id])]));
  const goldenResonance = rank => 4 * rank / (rank + 4);
  const CATALOG = {
    ice: ['冰霜', '命中减速 25%，持续 3 秒；触发元素反应后消除冰霜减速。', '冰', '#78d0e0', 'ice', 1],
    fire: ['火焰', '飞刃产生溅射；后续仅出现火元素进化。', '火', '#f29a55', 'fire', 1],
    lightning: ['雷电', '飞刃连锁附近敌人；后续仅出现雷元素进化。', '雷', '#b69af5', 'lightning', 1],
    earth: ['大地', '飞刃侵蚀护甲；后续仅出现土元素进化。', '土', '#cba16d', 'earth', 1],
    grass: ['草木', '每次命中缠绕定身 0.2 秒，并施加持续毒伤。', '草', '#81c875', 'grass', 1],
    golden: ['黄金战士', '吞噬任意普通伙伴积累等级，每阶攻击变为原来的三倍。', '金', '#ffd76a', 'golden', 0],
    rime: ['凛风', '飞刃转速提高，冰霜减速加强至 30%。', '凛', '#b1effa', 'ice', 2],
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
  for (const [id, talent] of Object.entries(TALENTS)) {
    const family = CATALOG[talent.family]; CATALOG[id] = [talent.name, talent.text, family[2], family[3], talent.family, 4];
  }
  CATALOG.golden_blades = ['万剑归宗', '增加一把参与真实碰撞的飞剑，最多 12 把；之后每次增加基础攻击 8%。', '剑', '#ffd76a', 'golden', 4];
  CATALOG.golden_domain = ['天域剑阵', '解锁每 2.6 秒攻击的黄金领域；先扩大范围，再提升伤害。', '阵', '#ffd76a', 'golden', 4];
  CATALOG.golden_resonance = ['炼金共鸣', '强化黄金与五元素的反应倍率，重复选择持续增益。', '鸣', '#ffd76a', 'golden', 4];
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
        level === 11 ? SKILLS[path[0]?.route] : [...(ENHANCEMENTS[path[0]?.route] || []), ...LEGACY_ENHANCEMENTS];
      if (!choices?.includes(route)) break;
      path.push({ level, route });
    }
    return path;
  };
  const evolutionChoices = (unit, level) => {
    if (!Number.isSafeInteger(level) || level < 3 || level >= SAFE_LIMIT || (level + 1) % 4 !== 0) return [];
    const path = evolutionPath(unit).filter(entry => entry.level < level);
    if (path.length !== (level - 3) / 4) return [];
    return [...(level === 3 ? BASE_ROUTES : level === 7 ? ADVANCED[path[0]?.route] : level === 11 ? SKILLS[path[0]?.route] : ENHANCEMENTS[path[0]?.route])];
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
    return { rank, progress: safe(unit.goldenFeed || 0), required: safe(30 * Math.pow(2, Math.min(50, rank - 1))) };
  };
  const routeRanks = routes => Object.fromEntries(ROUTES.map(route => [route, Number.isSafeInteger(routes?.[route]) && routes[route] > 0 ? routes[route] : 0]));
  // Only the defender's current (zero-based) level affects ordinary merge odds.
  const evolutionChance = level => Math.max(0.55, 1 - levelNumber(level) * 0.03);
  const statsForLevel = (level, routes = {}, activeRoute) => {
    const n = levelNumber(level), ranks = routeRanks(routes);
    const family = BASE_ROUTES.find(route => ranks[route]) || 'normal';
    const advanced = (ADVANCED[family] || []).find(route => ranks[route]) || null;
    const skill = (SKILLS[family] || []).find(route => ranks[route]) || null;
    const latest = ranks[activeRoute] ? activeRoute : skill || advanced || family;
    const orbitRadius = 52 + Math.min(16, n);
    const stats = { damage: safe(n + 1), range: orbitRadius, orbitRadius, bladeCount: Math.min(4, 1 + Math.floor(n / 4)),
      angularSpeed: 2.6 + Math.min(0.6, n * 0.025), bladeLength: 24, bladeWidth: 7,
      slow: ranks.ice ? 0.25 : 0, slowDuration: ranks.ice ? 3 : 0.8, rootDuration: ranks.grass ? 0.2 : 0,
      splash: ranks.fire ? 35 : 0, splashDamage: ranks.fire ? 0.45 : 0,
      chain: ranks.lightning ? 2 : 0, chainDamage: ranks.lightning ? 0.48 : 0, chainRange: 90,
      armorPierce: ranks.earth ? 0.2 : 0, burn: ranks.grass ? 0.18 : 0, burnDuration: ranks.grass ? 2 : 0, freeze: 0, freezeCooldown: 2.4,
      chilledBonus: 0, executeBonus: 0, echoDamage: 0, armorBreak: ranks.earth ? 0.02 : 0,
      fieldRadius: 0, fieldDamage: 0, fieldInterval: 2.6,
      ability: family, family, advanced, skill, tier: latest === 'normal' ? 0 : routeInfo(latest, n).tier,
      ranks, specialName: routeInfo(latest, n).name };
    if (advanced === 'glacier') { stats.slow = 0.4; stats.chilledBonus = 0.25; }
    if (advanced === 'blizzard') { stats.slow = 0.32; stats.splash = 48; stats.splashDamage = 0.35; }
    if (advanced === 'magma') { stats.splash = 55; stats.splashDamage = 0.6; stats.burn = 0.15; stats.burnDuration = 1.8; }
    if (advanced === 'solar') { stats.damage = safe(stats.damage * 1.2); stats.armorPierce = 0.3; }
    if (advanced === 'storm') { stats.chain = 3; stats.chainRange = 112; stats.slow = 0.16; }
    if (advanced === 'plasma') { stats.chainDamage = 0.7; stats.armorPierce = 0.4; }
    if (advanced === 'rime') { stats.angularSpeed += 0.35; stats.slow = 0.3; }
    if (advanced === 'inferno') { stats.burn = 0.3; stats.burnDuration = 2.2; stats.splashDamage = 0.65; }
    if (advanced === 'surge') { stats.angularSpeed += 0.35; stats.armorPierce = 0.25; }
    if (advanced === 'bastion') { stats.damage = safe(stats.damage * 1.2); stats.slow = 0.2; }
    if (advanced === 'quake') { stats.splash = 60; stats.splashDamage = 0.55; }
    if (advanced === 'crystal') { stats.armorPierce = 0.45; stats.echoDamage = 0.25; }
    if (advanced === 'vine') { stats.slow = 0.3; stats.slowDuration = 1.4; stats.burnDuration = 2.5; }
    if (advanced === 'thorn') { stats.damage = safe(stats.damage * 1.15); stats.armorPierce = 0.3; stats.burn = 0.25; }
    if (advanced === 'bloom') { stats.splash = 55; stats.splashDamage = 0.4; stats.burn = 0.25; }
    if (skill === 'shatter') { stats.chilledBonus = 0.65; stats.splash = 42; stats.splashDamage = 0.5; }
    if (skill === 'permafrost') { stats.freeze = 0.42; }
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
    const { rank } = goldenProgress(unit), stats = statsForLevel(14), talents = goldenRanks(unit);
    const baseDamage = safe(30 * Math.pow(3, Math.min(40, rank - 1)));
    const baseBlades = Math.min(6, 4 + rank), bladeRank = talents.golden_blades;
    const refinement = Math.max(0, bladeRank - (12 - baseBlades)), domain = talents.golden_domain;
    return { ...stats, damage: safe(baseDamage * (1 + .08 * refinement)), baseDamage, talentDamageBonus: .08 * refinement,
      bladeCount: Math.min(12, baseBlades + bladeRank), bladeLength: 30, bladeWidth: 8,
      angularSpeed: 3.2 + 0.8 * (rank - 1) / (rank + 3), armorPierce: 0.35,
      splash: 42, splashDamage: 0.3, family: 'golden', ability: 'golden', specialName: '黄金战士', tier: rank,
      fieldRadius: domain ? Math.min(160, 100 + (domain - 1) * 15) : 0,
      fieldDamage: domain ? .4 + Math.max(0, domain - 5) * .1 : 0,
      resonanceBonus: goldenResonance(talents.golden_resonance), goldenTalents: talents };
  };
  const choiceInfo = (unit, route, pending) => {
    const info = routeInfo(route, pending?.level ?? unit?.level), fmt = n => String(Number(n.toFixed(3)));
    if (GOLDEN_TALENTS.includes(route)) {
      const before = statsForUnit(unit), talents = goldenRanks(unit), selected = talents[route];
      const after = statsForUnit({ ...unit, goldenTalents: { ...talents, [route]: selected + 1 } });
      if (route === 'golden_blades') return { ...info, name: before.bladeCount >= 12 ? '剑意精修' : info.name,
        description: before.bladeCount >= 12 ? `基础攻击天赋加成 ${fmt(before.talentDamageBonus * 100)}% → ${fmt(after.talentDamageBonus * 100)}%（原基础攻击另计）；实际单剑攻击 ${fmt(before.damage)} → ${fmt(after.damage)}。` : `真实飞剑 ${before.bladeCount} → ${after.bladeCount} 把，上限 12 把；保留原自动 5→6 把成长。` };
      if (route === 'golden_domain') return { ...info, description: `领域半径 ${before.fieldRadius} → ${after.fieldRadius}；每 2.6 秒伤害 ${fmt(before.fieldDamage)}D → ${fmt(after.fieldDamage)}D。D 为结算时单剑原始攻击。` };
      return { ...info, description: `黄金反应倍率额外 +${fmt(before.resonanceBonus)} → +${fmt(after.resonanceBonus)}；不改变 0.75 秒反应冷却。` };
    }
    const talent = TALENTS[route]; if (!talent) return info;
    const rank = levelNumber(unit?.routes?.[route]), next = rank + 1;
    const damage = value => value ? fmt(talent.damage * talentScale(value)) : '0';
    const radius = value => value ? fmt(talent.radius * talentRadiusScale(value)) : '0';
    const changes = [];
    if (talent.damage) changes.push(`额外伤害 ${damage(rank)}D → ${damage(next)}D`);
    if (talent.secondary) changes.push(`附加伤害 ${rank ? fmt(talent.secondary * talentScale(rank)) : '0'}D → ${fmt(talent.secondary * talentScale(next))}D`);
    if (talent.radius) changes.push(`半径 ${radius(rank)} → ${radius(next)}`);
    return { ...info, description: `${changes.join('；')}。${talent.text}` };
  };
  const REACTIONS = Object.freeze([
    { elements: ['fire', 'ice'], name: '融解', color: '#ffd292', multiplier: 3 },
    { elements: ['ice', 'lightning'], name: '超导', color: '#bee5ff', multiplier: 2.4, armorBreak: .1 },
    { elements: ['earth', 'ice'], name: '碎冰', color: '#d1e7dc', multiplier: 2.6, splash: 60, splashDamage: .35 },
    { elements: ['grass', 'ice'], name: '霜绽', color: '#cdf6da', multiplier: 2.3, freeze: .35 },
    { elements: ['fire', 'lightning'], name: '超载', color: '#ffc17b', multiplier: 2.8, splash: 65, splashDamage: .4 },
    { elements: ['earth', 'fire'], name: '熔流', color: '#f3a56b', multiplier: 2.4, burn: .3, burnDuration: 2, dotType: 'fire' },
    { elements: ['fire', 'grass'], name: '燎原', color: '#f4ca79', multiplier: 2.5, burn: .5, burnDuration: 2.5, dotType: 'fire' },
    { elements: ['earth', 'lightning'], name: '磁崩', color: '#d8bafa', multiplier: 2.3, armorBreak: .15 },
    { elements: ['grass', 'lightning'], name: '激生', color: '#d4eb91', multiplier: 2.6, slow: .2, slowDuration: 1.2 },
    { elements: ['earth', 'grass'], name: '缠生', color: '#b0d38f', multiplier: 2.2, slow: .55, slowDuration: 1.6 },
    { elements: ['golden', 'ice'], name: '霜金裂变', color: '#fff0a6', multiplier: 3.5, freeze: .35 },
    { elements: ['golden', 'fire'], name: '熔金爆发', color: '#ffd18b', multiplier: 4.2, splash: 60, splashDamage: .4, targets: 3 },
    { elements: ['golden', 'lightning'], name: '天罚连锁', color: '#e8d4ff', multiplier: 3.8, splash: 110, splashDamage: .5, targets: 2, chain: true },
    { elements: ['golden', 'earth'], name: '碎岳', color: '#f7d990', multiplier: 4, ignoreArmor: true },
    { elements: ['golden', 'grass'], name: '辉光缠生', color: '#d5f5a1', multiplier: 3.5, root: .4, burn: .25, burnDuration: 2, dotType: 'poison' },
  ].map(reaction => {
    const details = [reaction.armorBreak ? `削弱 ${reaction.armorBreak * 100}% 护甲` : '', reaction.freeze ? `冻结 ${reaction.freeze} 秒（抗性 2.4 秒）` : '',
      reaction.splash ? `半径 ${reaction.splash} 内${reaction.targets ? `最多 ${reaction.targets} 个` : ''}其他敌人各受 ${reaction.splashDamage}D` : '',
      reaction.burn ? `每秒 ${reaction.burn}D ${reaction.dotType === 'poison' ? '毒伤' : '灼烧'}持续 ${reaction.burnDuration} 秒` : '',
      reaction.slow ? `减速 ${Math.round(reaction.slow * 1000) / 10}% 持续 ${reaction.slowDuration} 秒` : '', reaction.root ? `定身 ${reaction.root} 秒（藤牢抗性 2.4 秒）` : '', reaction.ignoreArmor ? '本次直击无视护甲' : ''].filter(Boolean);
    return Object.freeze({ ...reaction, id: reaction.elements.join('_'), elements: Object.freeze(reaction.elements),
      description: `反应伤害 ×${reaction.multiplier}${details.length ? '；' + details.join('；') : ''}。` });
  }));
  // Kept as inert compatibility APIs for older callers; evolution is merge-only.
  const upgradeCost = () => null;
  const enemyStatsForWave = (kindOrType, wave, boss = false) => {
    const type = typeof kindOrType === 'object' ? kindOrType : FALLBACK_TYPES.find(value => value.kind === kindOrType) || FALLBACK_TYPES[0];
    const age = Math.max(0, levelNumber(wave) - 1), late = Math.max(0, age - 4);
    // Keep the softened midgame/endless curves; adjust ordinary bottles and
    // elite bottles independently so elites do not inherit the ordinary buff.
    const early = Math.min(5, late), endless = Math.max(0, late - 5);
    const middle = Math.min(10, endless), beyondTwenty = Math.max(0, endless - 10);
    const scaling = safe(1 + age * 0.13 + early * early * 0.16 + early * 0.4 + middle * 0.62 + beyondTwenty * 0.42);
    const previousHp = Math.max(1, Math.round(safe(type.hp * scaling * (boss ? 4.2 : 1))));
    return { maxHp: Math.max(1, Math.round(safe(previousHp * (boss ? 0.7 : 1.25)))),
      speed: type.speed * 0.7 * Math.min(1.8, 1 + Math.min(9, age) * 0.032 + middle * 0.022 + beyondTwenty * 0.012),
      armor: Math.min(0.18, early * 0.018 + middle * 0.0015 + beyondTwenty * 0.0005 + (boss && late ? 0.06 : 0)), reward: 0, damage: boss ? 3 : 1 };
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
      this.units = []; this.enemies = []; this.supplies = []; this.bullets = []; this.effects = []; this.zones = [];
      this.spawnQueue = []; this.spawnTimer = 0; this.waveActive = false; this.completed = false;
      this.goldenAppeared = false; this.goldenRevealRemaining = 0; this.sequence = 0; this.changeTimer = 0; this.supplySequence = 0; this.pendingEvolution = null;
      this._makeUnit(23); this._spawnSupply(); this._notify();
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
      return { status: this.status, isPaused: this.isPaused, isCelebrating: this.goldenRevealRemaining > 0, score: this.score, wave: this.wave, gold: this.gold,
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
        this._removeUnitZones(source);
        if (canFeed(source, target)) this._feedGolden(target, source);
        else if (!this.goldenAppeared && this.wave >= 21 && target.level >= 9 && this._roll() < 0.03) this._awakenGolden(target, source);
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
      this._removeUnitZones(unit);
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

    _canAct() { return (this.status === 'ready' || this.status === 'playing') && !this.isPaused && !this.pendingEvolution && !this.goldenRevealRemaining; }
    _validSlot(slot) { return Number.isInteger(slot) && slot >= 0 && slot < SLOTS.length; }
    _unitAt(slot) { return this.units.find(unit => unit.slot === slot); }
    _notify() { this.onChange(this.getState()); }
    _event(type, details = {}) { this.onEvent({ type, ...details }); }
    _effect(type, at, details = {}) { if (this.effects.length >= 600) this.effects.splice(0, this.effects.length - 599); this.effects.push({ type, x: at.x, y: at.y, age: 0, duration: 0.55, ...details }); }
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
      this.goldenAppeared = true; this.goldenRevealRemaining = 2.8; unit.isGolden = true; unit.goldenRank = 1; unit.goldenFeed = 0;
      this._removeUnitZones(unit); unit.pierceCooldowns = {};
      unit.cooldown = 0; unit.bladeHits = {}; unit.fieldCooldown = 0; unit.pulse = 1; unit.goldenTalents = goldenRanks(); unit.goldenChoicesMade = 0; unit.talentState = {};
      this._effect('golden', unit, { rank: 1, duration: 2.8 });
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
      this._effect('feed', unit, { ...details, duration: 0.8 }); this._event('feed', details); this._queueGoldenChoice();
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

    _queueGoldenChoice() {
      if (this.pendingEvolution || this.goldenRevealRemaining > 0) return;
      const unit = this.units.find(value => value.isGolden && Math.floor((goldenProgress(value).rank - 1) / 2) > levelNumber(value.goldenChoicesMade));
      if (!unit) return;
      const node = levelNumber(unit.goldenChoicesMade) + 1;
      this.pendingEvolution = { kind: 'golden', unitId: unit.id, level: unit.level, rank: goldenProgress(unit).rank,
        node, nodeRank: node * 2 + 1, choices: [...GOLDEN_TALENTS] };
      this.accumulator = 0;
    }
    chooseEvolution(route, expectedPending) {
      const pending = this.pendingEvolution;
      if (expectedPending && (!pending || ['kind', 'unitId', 'level', 'node'].some(key => expectedPending[key] !== pending[key]))) return false;
      if (!pending || !pending.choices.includes(route) || this.status === 'lost') return false;
      const unit = this.units.find(value => value.id === pending.unitId);
      if (!unit || unit.level !== pending.level) return false;
      if (pending.kind === 'golden') {
        if (!unit.isGolden || !GOLDEN_TALENTS.includes(route) || pending.node !== levelNumber(unit.goldenChoicesMade) + 1 ||
          pending.node > Math.floor((goldenProgress(unit).rank - 1) / 2)) return false;
        unit.goldenTalents = goldenRanks(unit); unit.goldenTalents[route]++;
        unit.goldenChoicesMade = pending.node;
      } else {
        if (unit.isGolden || !evolutionChoices(unit, pending.level).includes(route) || unit.routeChoices[pending.level]) return false;
        unit.routeChoices = { ...unit.routeChoices, [pending.level]: route }; this._syncRoutes(unit);
      }
      unit.bladeHits = {}; unit.pulse = .6; this.pendingEvolution = null; this.accumulator = 0;
      this._effect('route', unit, { route, duration: .8 });
      this._event('route', { kind: pending.kind || 'element', unitId: unit.id, slot: unit.slot, level: unit.level, route,
        rank: pending.kind === 'golden' ? unit.goldenTalents[route] : unit.routes[route], routes: { ...unit.routes } });
      this._queueGoldenChoice(); this._notify(); return true;
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
      if (!objects.includes(target)) return;
      const origin = { x: target.x, y: target.y, progress: target.progress };
      const nearby = stats.splash ? objects.filter(object => object !== target && Math.hypot(object.x - target.x, object.y - target.y) <= stats.splash) : [];
      const hit = (object, amount, source = 'native') => type === 'supply' ? this._damageSupply(object, amount, unit) : this._damage(object, amount, stats.slow, stats, unit, source);
      const before = { frost: target.frostTime > 0 && target.frostSlow > 0, armor: target.armorBroken || 0,
        burning: this._dot(target, 'fire')?.remaining > 0, poisoned: this._dot(target, 'poison')?.remaining > 0 };
      const chilled = target.slow > 0 || before.frost;
      const multiplier = (chilled ? 1 + stats.chilledBonus : 1) * (stats.executeBonus && target.hp / target.maxHp < .25 ? 1 + stats.executeBonus : 1);
      const amount = safe(stats.damage * multiplier), previousHp = target.hp; target.hitAngle = blade.angle;
      const result = hit(target, amount, 'direct');
      const dealt = Math.max(0, previousHp - target.hp);
      // Only this direct collision can count or initiate kill talents. The
      // captured position/status survives a lethal hit and is consumed once.
      if (type === 'enemy') this._directTalents(unit, target, origin, before, amount, result || {}, stats);
      if (stats.echoDamage) {
        if (type === 'supply') this._damageSupply(target, safe(stats.damage * stats.echoDamage), unit);
        else this._damage(target, safe(stats.damage * stats.echoDamage), 0, { armorPierce: stats.armorPierce }, unit, 'derived');
        this._effect('skill', origin, { skill: stats.skill || 'echo', ability: stats.ability, radius: 24, duration: .35 });
      }
      for (const object of nearby) hit(object, stats.damage * stats.splashDamage);
      this._effect('slash', origin, { angle: blade.angle, ability: stats.ability, damage: dealt, duration: .22 });
      if (stats.splash) this._effect(stats.family === 'fire' ? 'fire' : 'skill', origin, { skill: stats.skill || stats.advanced, ability: stats.ability, radius: stats.splash, duration: .35 });
      if (stats.skill) this._effect('skill', origin, { skill: stats.skill, ability: stats.ability, radius: 26, duration: .35 });
      let chainHits = 0;
      if (stats.chain) {
        let previous = origin; const struck = new Set([target]);
        for (let index = 0; index < stats.chain; index++) {
          const next = objects.filter(object => !struck.has(object) && Math.hypot(object.x - previous.x, object.y - previous.y) <= stats.chainRange)
            .sort((a, b) => Math.hypot(a.x - previous.x, a.y - previous.y) - Math.hypot(b.x - previous.x, b.y - previous.y) || a.id - b.id)[0];
          if (!next) break;
          this._effect('chain', next, { fromX: previous.x, fromY: previous.y, duration: .25 });
          const position = { x: next.x, y: next.y }; struck.add(next); hit(next, stats.damage * stats.chainDamage); previous = position; chainHits++;
        }
      }
      if (type === 'enemy' && chainHits && unit.routes?.lightning_return && this.enemies.includes(target)) {
        this._derived(target, amount * this._talent(unit, 'lightning_return').damage, unit);
        this._talentEffect(unit, 'lightning_return', origin, 28);
      }
      if (stats.splash || stats.chain) this._event('special', { ability: stats.ability, x: origin.x, y: origin.y, unitId: unit.id });
      unit.pulse = Math.max(unit.pulse || 0, .1);
      this._event('slash', { unitId: unit.id, level: unit.level, x: origin.x, y: origin.y,
        targetId: target.id, targetType: type, bladeIndex: blade.index, ability: stats.ability, damage: dealt });
    }

    _near(at, radius, count, exclude, alongRoad = false) {
      return this.enemies.filter(enemy => enemy !== exclude && enemy.hp > 0 && Math.hypot(enemy.x - at.x, enemy.y - at.y) <= radius)
        .sort((a, b) => (alongRoad ? Math.abs(a.progress - at.progress) - Math.abs(b.progress - at.progress) :
          Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y)) || a.id - b.id).slice(0, count);
    }
    _talent(unit, id) {
      const rank = levelNumber(unit.routes?.[id]), definition = TALENTS[id];
      return { ...definition, rank, damage: (definition.damage || 0) * talentScale(rank),
        secondary: (definition.secondary || 0) * talentScale(rank), radius: (definition.radius || 0) * talentRadiusScale(rank) };
    }
    _talentEffect(unit, id, at, radius) {
      this._effect('talent', at, { skill: id, ability: TALENTS[id].family, family: TALENTS[id].family, radius, duration: .55, unitId: unit.id });
    }
    _readyTalent(unit, id, cooldown) {
      const state = unit.talentState || (unit.talentState = {});
      if ((state[id + ':until'] || 0) > this.elapsed + 1e-8) return false;
      state[id + ':until'] = this.elapsed + cooldown; return true;
    }
    _countTalent(unit, id, threshold) {
      const state = unit.talentState || (unit.talentState = {}), key = id + ':hits';
      state[key] = Math.min(threshold, (state[key] || 0) + 1); return state[key] >= threshold;
    }
    _consumeCount(unit, id) { unit.talentState[id + ':hits'] = 0; }
    _derived(enemy, amount, unit, ignoreArmor = false) {
      return this._damage(enemy, safe(amount), 0, { armorPierce: ignoreArmor ? 1 : 0 }, unit, 'derived');
    }
    _freeze(enemy, duration) {
      if (!this.enemies.includes(enemy) || enemy.freezeResistance > 0) return;
      enemy.freezeTime = Math.max(enemy.freezeTime || 0, duration); enemy.freezeResistance = 2.4;
    }
    _prison(enemy, duration) {
      if (!this.enemies.includes(enemy) || enemy.prisonResistance > 0) return;
      enemy.rootTime = Math.max(enemy.rootTime || 0, duration); enemy.prisonResistance = 2.4;
    }
    _directTalents(unit, target, at, before, amount, result, stats) {
      if (unit.isGolden) return;
      for (const id of ENHANCEMENTS[stats.family] || []) {
        if (!unit.routes?.[id]) continue;
        const talent = this._talent(unit, id), radius = talent.radius;
        let activated = false;
        if (id === 'ice_tide' && this._countTalent(unit, id, 5)) {
          this._consumeCount(unit, id); for (const other of this._near(at, radius, 3)) this._freeze(other, .35); activated = true;
        } else if (id === 'ice_mirror' && before.frost && !result.reaction && this._readyTalent(unit, id, 1.2)) {
          this._derived(target, amount * talent.damage, unit); activated = true;
        } else if (id === 'fire_ember' && this._countTalent(unit, id, 5)) {
          const dot = this._dot(target, 'fire');
          if (dot?.remaining > 0) {
            this._consumeCount(unit, id);
            const extra = Math.min(dot.damage * dot.remaining, 2 * amount) * talentScale(talent.rank);
            delete target.dotEffects.fire; this._syncDotAliases(target);
            this._derived(target, extra, unit);
            for (const other of this._near(at, radius, 3, target)) this._derived(other, extra * .4, unit);
            activated = true;
          }
        } else if (id === 'fire_relay' && result.killed && before.burning) {
          for (const other of this._near(at, radius, 3, target)) this._applyDot(other, 'fire', amount * talent.damage, 2, unit, 'talent:fire_relay'); activated = true;
        } else if (id === 'fire_scorch' && this._readyTalent(unit, id, 3)) {
          this._zone(unit, id, at, radius, 1.5, amount * talent.damage); activated = true;
        } else if (id === 'lightning_charge' && this._countTalent(unit, id, 5) && this._readyTalent(unit, id, 1.5)) {
          this._consumeCount(unit, id); this._derived(target, amount * talent.damage, unit);
          for (const other of this._near(at, radius, 2, target)) this._derived(other, amount * talent.secondary, unit); activated = true;
        } else if (id === 'earth_fault' && this._countTalent(unit, id, 4)) {
          this._consumeCount(unit, id);
          for (const other of this._near(at, radius, 3, target, true)) {
            this._derived(other, amount * talent.damage, unit);
            if (this.enemies.includes(other)) other.armorBroken = Math.min(.5, (other.armorBroken || 0) + .05);
          } activated = true;
        } else if (id === 'earth_pierce' && before.armor >= .1) {
          const pierce = unit.pierceCooldowns || (unit.pierceCooldowns = {});
          if ((pierce[target.id] || 0) <= this.elapsed + 1e-8) {
            this._derived(target, amount * talent.damage, unit, true);
            if (this.enemies.includes(target)) pierce[target.id] = this.elapsed + 1.2; activated = true;
          }
        } else if (id === 'earth_gravity' && this._readyTalent(unit, id, 4)) {
          this._zone(unit, id, at, radius, 1.2, 0); activated = true;
        } else if (id === 'grass_branch' && this._countTalent(unit, id, 5)) {
          this._consumeCount(unit, id);
          for (const other of this._near(at, radius, 3, target)) {
            this._derived(other, amount * talent.damage, unit);
            if (this.enemies.includes(other)) other.rootTime = Math.max(other.rootTime || 0, .2);
          } activated = true;
        } else if (id === 'grass_bloom' && result.killed && before.poisoned) {
          for (const other of this._near(at, radius, 3, target)) {
            this._derived(other, amount * talent.damage, unit);
            this._applyDot(other, 'poison', amount * talent.secondary, 2, unit, 'talent:grass_bloom');
          } activated = true;
        }
        if (activated) this._talentEffect(unit, id, at, radius || 26);
      }
    }
    _reactionTalents(unit, enemy, reaction, amount) {
      if (unit.isGolden) return;
      for (const id of ['ice_echo', 'lightning_resonance', 'grass_prison']) {
        if (!unit.routes?.[id]) continue;
        const talent = this._talent(unit, id);
        if (!reaction.elements.includes(talent.family) || !this._readyTalent(unit, id, 1.5)) continue;
        const count = id === 'lightning_resonance' ? 2 : 3;
        for (const other of this._near(enemy, talent.radius, count, id === 'grass_prison' ? null : enemy)) {
          if (id === 'grass_prison') this._prison(other, .4);
          else this._derived(other, amount * talent.damage, unit);
        }
        this._talentEffect(unit, id, enemy, talent.radius);
      }
    }
    _zone(unit, type, at, radius, duration, damage) {
      this.zones = this.zones.filter(zone => zone.unitId !== unit.id || zone.type !== type);
      this.zones.push({ type, family: TALENTS[type].family, ability: TALENTS[type].family, unitId: unit.id,
        x: at.x, y: at.y, radius, remaining: duration, duration, tickIn: .5, damage: safe(damage) });
    }
    _removeUnitZones(unit) { this.zones = this.zones.filter(zone => zone.unitId !== unit.id); }
    _advanceZones(dt) {
      for (const enemy of this.enemies) { enemy.zoneSlow = 0; enemy.zoneSlowTime = 0; }
      this.zones = this.zones.filter(zone => this.units.some(unit => unit.id === zone.unitId));
      for (const zone of this.zones) {
        const active = Math.min(dt, zone.remaining), unit = this.units.find(value => value.id === zone.unitId);
        if (zone.type === 'earth_gravity') for (const target of this._near(zone, zone.radius, 5)) {
          target.zoneSlow = .4; target.zoneSlowTime = Math.max(target.zoneSlowTime, active);
        }
        if (zone.type === 'fire_scorch') {
          zone.tickIn -= active;
          while (zone.tickIn <= 1e-8) {
            zone.tickIn += .5;
            for (const target of this._near(zone, zone.radius, 4)) this._derived(target, zone.damage, unit);
            this._talentEffect(unit, zone.type, zone, zone.radius);
          }
        }
        zone.remaining = Math.max(0, zone.remaining - dt);
      }
      this.zones = this.zones.filter(zone => zone.remaining > 1e-8);
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
        ...stats, hp: stats.maxHp, progress: 0, hit: 0, boss: entry.boss, slow: 0, slowTime: 0, frostSlow: 0, frostTime: 0, rootTime: 0 };
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
      if (this.goldenRevealRemaining > 0) {
        // The full-field reveal owns this time: no damage, leaks, egg movement,
        // status expiry or attack rotation may progress behind the portrait.
        const revealStep = Math.min(dt, this.goldenRevealRemaining);
        this.goldenRevealRemaining = Math.max(0, this.goldenRevealRemaining - dt);
        if (this.goldenRevealRemaining < 1e-8) this.goldenRevealRemaining = 0;
        for (const effect of this.effects) if (effect.type === 'golden') effect.age = Math.min(effect.duration, effect.age + revealStep);
        if (!this.goldenRevealRemaining) {
          this.effects = this.effects.filter(effect => effect.type !== 'golden');
          this._queueGoldenChoice(); this._notify();
        }
        return;
      }
      this.elapsed += dt; this.changeTimer += dt;
      for (const effect of this.effects) effect.age += dt;
      this.effects = this.effects.filter(effect => effect.age < effect.duration);
      for (const unit of this.units) { unit.cooldown = Math.max(0, unit.cooldown - dt); unit.pulse = Math.max(0, unit.pulse - dt); }
      for (const unit of this.units) for (const [id, until] of Object.entries(unit.pierceCooldowns || {})) if (until <= this.elapsed) delete unit.pierceCooldowns[id];
      this._advanceSupplies(dt); this._advanceZones(dt);
      if (this.waveActive && this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 1e-8) {
          this._spawnEnemy(this.spawnQueue.shift());
          this.spawnTimer += Math.max(0.34, 0.7 - Math.min(9, this.wave - 1) * 0.025 - Math.max(0, this.wave - 10) * 0.012);
        }
      }
      for (const enemy of this.enemies.slice()) {
        // Integrate only the unfrozen part of this step, including status
        // expiries inside it. A 0.2-second root lasts the full 0.2 seconds.
        const stoppedFor = Math.min(dt, Math.max(enemy.freezeTime || 0, enemy.rootTime || 0));
        const slows = [[enemy.slow || 0, enemy.slowTime || 0], [enemy.frostSlow || 0, enemy.frostTime || 0], [enemy.zoneSlow || 0, enemy.zoneSlowTime || 0]];
        const boundaries = [...new Set([stoppedFor, dt, ...slows.map(([, duration]) => clamp(duration, stoppedFor, dt))])].sort((a, b) => a - b);
        let movingTime = 0;
        for (let index = 1; index < boundaries.length; index++) {
          const start = boundaries[index - 1], end = boundaries[index];
          movingTime += (end - start) * (1 - Math.max(0, ...slows.filter(([, duration]) => duration > start).map(([strength]) => strength)));
        }
        const movement = enemy.speed * Math.max(0, movingTime);
        enemy.hit = Math.max(0, enemy.hit - dt); enemy.slowTime = Math.max(0, enemy.slowTime - dt);
        if (!enemy.slowTime) enemy.slow = 0;
        enemy.frostTime = Math.max(0, (enemy.frostTime || 0) - dt);
        if (enemy.frostTime < 1e-8) { enemy.frostTime = 0; enemy.frostSlow = 0; }
        enemy.rootTime = Math.max(0, (enemy.rootTime || 0) - dt);
        if (enemy.rootTime < 1e-8) enemy.rootTime = 0;
        enemy.freezeTime = Math.max(0, (enemy.freezeTime || 0) - dt);
        enemy.freezeResistance = Math.max(0, (enemy.freezeResistance || 0) - dt);
        enemy.prisonResistance = Math.max(0, (enemy.prisonResistance || 0) - dt);
        for (const timer of ['freezeTime', 'freezeResistance', 'prisonResistance']) if (enemy[timer] < 1e-8) enemy[timer] = 0;
        if (enemy.elementMark?.until <= this.elapsed) enemy.elementMark = null;
        if (enemy.dotEffects) {
          for (const [type, dot] of Object.entries(enemy.dotEffects)) {
            const active = Math.min(dt, dot.remaining); dot.remaining = Math.max(0, dot.remaining - dt);
            const owner = this.units.find(unit => unit.id === dot.sourceUnitId);
            this._damage(enemy, dot.damage * active, 0, { armorPierce: .3 }, owner, 'dot');
            if (dot.remaining <= 1e-8) delete enemy.dotEffects[type];
          }
          this._syncDotAliases(enemy);
        } else if (enemy.burnTime > 0) {
          // Existing saved/debug states may contain an untyped legacy DoT.
          // It still ticks, but cannot qualify as fire or poison for talents.
          const active = Math.min(dt, enemy.burnTime); enemy.burnTime = Math.max(0, enemy.burnTime - dt);
          this._damage(enemy, enemy.burnDamage * active, 0, { armorPierce: .3 }, undefined, 'dot');
        }
        if (!this.enemies.includes(enemy)) continue;
        enemy.progress += movement; this._positionEnemy(enemy);
        if (enemy.progress >= PATH_LENGTH) {
          this.enemies.splice(this.enemies.indexOf(enemy), 1); this._cleanupEnemy(enemy); this.lives = Math.max(0, this.lives - enemy.damage);
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

    _elementReaction(enemy, family, amount = 0, unit, stats = {}) {
      if (![...BASE_ROUTES, 'golden'].includes(family) || (enemy.reactionCooldownUntil || 0) > this.elapsed) return null;
      const mark = enemy.elementMark;
      if (mark && mark.until > this.elapsed && mark.element !== family) {
        const definition = REACTIONS.find(entry => entry.elements.includes(mark.element) && entry.elements.includes(family));
        if (definition) {
          enemy.elementMark = null; enemy.reactionCooldownUntil = this.elapsed + .75;
          const golden = definition.elements.includes('golden');
          const snapshot = family === 'golden' ? { damage: amount, unitId: unit?.id, resonance: stats.resonanceBonus || 0 } : mark.golden;
          return { ...definition, multiplier: definition.multiplier + (golden ? snapshot?.resonance || 0 : 0),
            rawDamage: golden ? Math.max(amount, snapshot?.damage || 0) : amount, goldenUnitId: golden ? snapshot?.unitId : undefined };
        }
      }
      enemy.elementMark = { element: family, until: this.elapsed + 3 };
      if (family === 'golden') enemy.elementMark.golden = { damage: amount, unitId: unit?.id, resonance: stats.resonanceBonus || 0 };
      return null;
    }
    _applyReaction(enemy, reaction, amount, dealt, unit) {
      enemy.frostSlow = 0; enemy.frostTime = 0;
      if (reaction.armorBreak) enemy.armorBroken = Math.min(.5, (enemy.armorBroken || 0) + reaction.armorBreak);
      if (reaction.slow) { enemy.slow = Math.max(enemy.slow || 0, reaction.slow); enemy.slowTime = Math.max(enemy.slowTime || 0, reaction.slowDuration); }
      if (reaction.freeze) this._freeze(enemy, reaction.freeze);
      if (reaction.root) this._prison(enemy, reaction.root);
      if (reaction.burn) this._applyDot(enemy, reaction.dotType || 'fire', safe(amount * reaction.burn), reaction.burnDuration, unit, 'reaction:' + reaction.id);
      if (reaction.splash) for (const other of this._near(enemy, reaction.splash, reaction.targets || 52, enemy)) {
        if (reaction.chain) this._effect('chain', other, { fromX: enemy.x, fromY: enemy.y, ability: 'golden', duration: .3 });
        this._derived(other, amount * reaction.splashDamage, unit);
      }
      const details = { reaction: reaction.id, elements: [...reaction.elements], name: reaction.name, color: reaction.color,
        multiplier: reaction.multiplier, damage: dealt, rawDamage: amount, goldenUnitId: reaction.goldenUnitId, enemyId: enemy.id, x: enemy.x, y: enemy.y };
      this._effect('reaction', enemy, { ...details, radius: reaction.splash || 40, duration: 1.15 }); this._event('reaction', details);
    }
    _dot(enemy, type) { return enemy.dotEffects?.[type]; }
    _syncDotAliases(enemy) {
      const active = Object.values(enemy.dotEffects || {}).filter(dot => dot.remaining > 0);
      // The old renderer reads these aggregate aliases. Talent decisions only
      // read the explicitly typed records, never these compatibility fields.
      enemy.burnTime = Math.max(0, ...active.map(dot => dot.remaining));
      enemy.burnDamage = active.reduce((total, dot) => total + dot.damage, 0);
    }
    _applyDot(enemy, type, damage, duration, unit, origin) {
      if (!this.enemies.includes(enemy) || !(damage > 0) || !(duration > 0)) return;
      const effects = enemy.dotEffects || (enemy.dotEffects = {}), previous = effects[type];
      // One bounded record per type. Stronger application owns its source;
      // weaker refreshes cannot borrow a stronger source or recursively proc.
      if (!previous || previous.remaining <= 0 || damage >= previous.damage) effects[type] = {
        type, damage: safe(damage), remaining: Math.max(duration, previous?.remaining || 0), sourceUnitId: unit?.id, origin };
      else previous.remaining = Math.max(previous.remaining, duration);
      this._syncDotAliases(enemy);
    }
    _cleanupEnemy(enemy) {
      for (const unit of this.units) {
        if (unit.pierceCooldowns) delete unit.pierceCooldowns[enemy.id];
        for (const key of Object.keys(unit.bladeHits || {})) if (key.startsWith(`enemy:${enemy.id}:`)) delete unit.bladeHits[key];
      }
    }
    _damage(enemy, amount, slow, stats = {}, unit, source = true) {
      if (!this.enemies.includes(enemy) || !(enemy.hp > 0)) return { killed: false, reaction: null, damage: 0 };
      const origin = typeof source === 'string' ? source : source === false ? 'derived' : unit ? 'native' : 'dot';
      const elementalHit = (origin === 'native' || origin === 'direct') && unit && amount > 0;
      const reaction = elementalHit ? this._elementReaction(enemy, stats.family, amount, unit, stats) : null;
      const rawDamage = reaction?.rawDamage ?? amount, previousHp = enemy.hp;
      const armor = clamp((enemy.armor || 0) - (enemy.armorBroken || 0), 0, .8);
      const pierce = reaction?.ignoreArmor ? 1 : clamp(stats.armorPierce || 0, 0, 1);
      enemy.hp = Math.max(0, enemy.hp - safe(rawDamage * (reaction?.multiplier || 1)) * (1 - armor * (1 - pierce))); enemy.hit = .12;
      if (elementalHit) {
        if (stats.family === 'ice') {
          if (!reaction && slow) { enemy.frostSlow = Math.max(enemy.frostSlow || 0, slow); enemy.frostTime = 3; }
        } else if (slow) { enemy.slow = Math.max(enemy.slow || 0, slow); enemy.slowTime = Math.max(enemy.slowTime || 0, stats.slowDuration || .8); }
        if (stats.family === 'grass') enemy.rootTime = Math.max(enemy.rootTime || 0, .2);
        if (stats.freeze) this._freeze(enemy, stats.freeze);
        if (stats.armorBreak) enemy.armorBroken = Math.min(.5, (enemy.armorBroken || 0) + stats.armorBreak);
        if (stats.burn) this._applyDot(enemy, stats.family === 'grass' ? 'poison' : 'fire', safe(stats.damage * stats.burn), stats.burnDuration, unit, origin);
        if (stats.freeze || stats.armorBreak) this._effect('skill', enemy, { skill: stats.skill, ability: stats.ability, radius: 22, duration: .3 });
      }
      const damage = previousHp - enemy.hp, killed = enemy.hp <= 0;
      // Remove and score before secondary damage, so a killed primary cannot
      // be selected by another splash and scored twice during this hit.
      if (killed) {
        this.enemies.splice(this.enemies.indexOf(enemy), 1); this.kills++; this._cleanupEnemy(enemy);
        const points = safe((enemy.boss ? 50 : 10) + this.wave * 2); this.score = safe(this.score + points);
        this._effect('kill', enemy, { tint: enemy.tint, boss: enemy.boss }); this._effect('score', enemy, { text: `+${points}`, duration: .7 });
        this._event('kill', { enemyId: enemy.id, kind: enemy.kind, boss: enemy.boss, gold: 0, score: points });
      }
      if (reaction) { this._applyReaction(enemy, reaction, rawDamage, damage, unit); this._reactionTalents(unit, enemy, reaction, amount); }
      this._effect('hit', enemy, { duration: .16 });
      return { killed, reaction, damage, rawDamage, origin };
    }

    _damageSupply(supply, amount, attacker) {
      if (!this.supplies.includes(supply)) return;
      supply.hp = Math.max(0, supply.hp - amount); supply.hit = 0.18;
      this._effect('supplyHit', supply, { duration: 0.18 });
      this._event('supplyHit', { supplyId: supply.id, hp: supply.hp, maxHp: supply.maxHp });
      if (supply.hp > 0) return;
      this.supplies.splice(this.supplies.indexOf(supply), 1); this.hatched++;
      const slot = SLOTS.filter(value => !this._unitAt(value.id)).sort((a, b) => Math.hypot(a.x - supply.x, a.y - supply.y) - Math.hypot(b.x - supply.x, b.y - supply.y) || a.id - b.id)[0];
      // Internal levels are zero-based: golden rank 1 hatches Lv.10, rank 2 Lv.11, etc.
      const level = attacker?.isGolden ? Math.min(SAFE_LIMIT - 1, goldenProgress(attacker).rank + 8) : Math.max(0, levelNumber(attacker?.level) - 2);
      const routeChoices = attacker?.isGolden ? {} : Object.fromEntries(evolutionPath(attacker).filter(entry => entry.level <= level).map(entry => [entry.level, entry.route]));
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
  DefenseGame.choiceInfo = choiceInfo; DefenseGame.ENHANCEMENTS = ENHANCEMENTS; DefenseGame.GOLDEN_TALENTS = GOLDEN_TALENTS; DefenseGame.TALENTS = TALENTS;
  DefenseGame.evolutionChance = evolutionChance; DefenseGame.upgradeSuccessRate = evolutionChance;
  root.DefenseGame = DefenseGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = DefenseGame;
})(typeof window !== 'undefined' ? window : globalThis);
