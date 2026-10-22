(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./defense-enemies.js') : root.DefenseEnemies;
  const forms = typeof module !== 'undefined' && module.exports ? require('./defense-forms.js') : root.DefenseForms;
  const INK = '#294329', PAPER = '#fff8dc', ORANGE = '#e98235';
  const engine = () => root.DefenseGame;
  const ABILITY = { normal: '#e7eddf', ice: '#9de6f2', fire: '#ffb44d', lightning: '#f7e76a', earth: '#deb77d', grass: '#b0ed80', golden: '#ffe18a' };
  const ROUTE_MARK = { ice: '❄', fire: '炎', lightning: 'ϟ', earth: '岩', grass: '叶' };
  const ROUTES = ['ice', 'fire', 'lightning', 'earth', 'grass'];
  const ROUTE_INK = { ice: '#368eac', fire: '#bd532d', lightning: '#897130', earth: '#8d6644', grass: '#438742' };
  const TALENT_FAMILY = Object.freeze({
    ice_echo: 'ice', ice_tide: 'ice', ice_mirror: 'ice',
    fire_ember: 'fire', fire_relay: 'fire', fire_scorch: 'fire',
    lightning_return: 'lightning', lightning_resonance: 'lightning', lightning_charge: 'lightning',
    earth_fault: 'earth', earth_pierce: 'earth', earth_gravity: 'earth',
    grass_branch: 'grass', grass_bloom: 'grass', grass_prison: 'grass',
    golden_blades: 'golden', golden_domain: 'golden', golden_resonance: 'golden',
  });
  const TAU = Math.PI * 2;
  const FONT = '"Avenir Next", "PingFang SC", sans-serif';
  const MONO = '"SFMono-Regular", Consolas, monospace';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const number = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const statsFor = unit => engine()?.statsForUnit?.(unit) || engine()?.statsForLevel?.(unit.level, unit.routes, unit.route) || {};
  function geometry(game) {
    const width = Math.max(1, number(game.width, number(engine()?.WIDTH, 520)));
    const height = Math.max(1, number(game.height, number(engine()?.HEIGHT, 760)));
    const fallbackPath = [{ x: 32, y: -35 }, { x: 32, y: height / 2 }, { x: width - 44, y: height / 2 }, { x: width - 44, y: height / 2 + 30 }];
    const path = game.path || engine()?.PATH || fallbackPath;
    const end = path.at(-1), lane = game.supplyLane || engine()?.SUPPLY_LANE || { x: end.x, stopY: end.y + 44, startY: height + 40, spacing: 52 };
    return { width, height, path, lane, gate: end };
  }

  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function polygon(ctx, points, fill, stroke, width = 1) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function text(ctx, content, x, y, size = 11, color = INK, weight = '500', align = 'left', font = FONT) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(content), x, y);
  }
  function impactNumber(ctx, value, x, y, color) {
    ctx.font = `800 12px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#495236'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    const label = `−${Number.isInteger(value) ? value : Math.round(value * 10) / 10}`;
    ctx.strokeText(label, x, y); ctx.fillStyle = color; ctx.fillText(label, x, y);
  }
  function effectLabel(ctx, label, x, y, color, size = 10) {
    ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#4e5039'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeText(label, x, y); ctx.fillStyle = color; ctx.fillText(label, x, y);
  }
  function roadPath(ctx, path) {
    ctx.beginPath(); path.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  }
  function grass(ctx, x, y, scale = 1) {
    line(ctx, x - 3 * scale, y + 2 * scale, x - 4 * scale, y - 2 * scale, '#91a386', 1);
    line(ctx, x, y + 2 * scale, x + scale, y - 4 * scale, '#91a386', 1);
    line(ctx, x + 3 * scale, y + 2 * scale, x + 5 * scale, y - scale, '#a8b598', 1);
  }
  function chevron(ctx, x, y, direction, color = '#b3a98b') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(direction);
    line(ctx, -4, -3, 0, 1, color, 1.5); line(ctx, 0, 1, 4, -3, color, 1.5); ctx.restore();
  }

  function round(ctx, x, y, w, h, radius, fill, stroke, width = 1) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function bush(ctx, x, y, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ellipse(ctx, 0, 7, 18, 6, '#3c793b44');
    for (const [dx, dy, r] of [[-10, 0, 10], [0, -6, 13], [12, 1, 10]]) {
      ellipse(ctx, dx, dy, r, r * .8, '#518a38', '#366a35', 1.6);
      ellipse(ctx, dx - 2, dy - 3, r * .65, r * .48, '#79ae44');
    }
    ctx.restore();
  }
  function flower(ctx, x, y) {
    line(ctx, x, y + 6, x, y, '#558739', 1.5);
    for (let i = 0; i < 5; i++) ellipse(ctx, x + Math.cos(i * TAU / 5) * 3.2, y + Math.sin(i * TAU / 5) * 3.2, 2.6, 2.6, '#fffbdc');
    ellipse(ctx, x, y, 2.3, 2.3, '#efbd4b');
  }
  function terrain(ctx, game, board) {
    const { width, height, path, lane, gate } = board;
    ctx.fillStyle = '#86b74d'; ctx.fillRect(0, 0, width, height);
    // The lawn and both deployment regions occupy one continuous board.
    for (let row = 0; row < Math.ceil(height / 64); row++) for (let col = 0; col < Math.ceil(width / 64); col++) {
      ctx.fillStyle = (row + col) % 2 ? '#9fc85d' : '#a9cf66';
      ctx.fillRect(col * 64, row * 64, 64, 64);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    roadPath(ctx, path); ctx.strokeStyle = '#47733b'; ctx.lineWidth = 63; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#f1e5b7'; ctx.lineWidth = 57; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#85877c'; ctx.lineWidth = 47; ctx.stroke();
    ctx.save(); ctx.setLineDash([10, 12]); roadPath(ctx, path); ctx.strokeStyle = '#eee8cf'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    const laneTop = lane.stopY - 22, laneBottom = Math.min(height + 12, lane.startY);
    round(ctx, lane.x - 25.5, laneTop, 51, laneBottom - laneTop, 18, '#4c773d', '#365d31', 2);
    round(ctx, lane.x - 20.5, laneTop + 5, 41, laneBottom - laneTop - 6, 15, '#75974e');
    for (let y = lane.stopY + 4; y < height - 15; y += lane.spacing || 52) chevron(ctx, lane.x, y, Math.PI, '#d4dda0');
    // Timber gate between invading bottles and the egg supply lane.
    for (let i = 0; i < 4; i++) {
      const x = gate.x - 27 + i * 16;
      polygon(ctx, [[x, gate.y + 7], [x, gate.y - 13], [x + 6, gate.y - 21], [x + 12, gate.y - 13], [x + 12, gate.y + 7]], '#b77d42', '#644b2f', 2);
      line(ctx, x + 3, gate.y - 9, x + 3, gate.y + 3, '#deb16a', 1.5);
    }
    round(ctx, gate.x - 29, gate.y - 5, 65, 7, 2, '#865831', '#644b2f', 1.5);
    bush(ctx, width - 22, 23, .7); bush(ctx, 16, height - 25, .85);
    for (const [x, y] of [[66, 16], [width - 74, 16], [25, gate.y + 50], [35, height - 105]]) flower(ctx, x, y);
    round(ctx, width / 2 - 105, 3, 210, 23, 11, '#365e35', '#244a2c', 1.5);
    text(ctx, '飞刃守卫 · 无限进化', width / 2, 15, 11, '#fff7d3', '800', 'center');
    const footerX = (path[0].x + lane.x) / 2;
    round(ctx, footerX - 155, height - 23, 310, 19, 8, '#5c843d', '#3d6b34', 1);
    text(ctx, number(game.reserve) > 0 ? `待命 ${Math.floor(game.reserve)} 位 · 点击空位部署` : '左侧迎敌 · 右侧击蛋 · 同级同元素合成', footerX, height - 13, 9, '#fff9da', '600', 'center');
    ellipse(ctx, lane.x, height - 4, 23, 9, '#314e2d');
    ellipse(ctx, lane.x, height - 8, 23, 7, '#bc9b62', '#5b6235', 2);
    ellipse(ctx, lane.x, height - 9, 17, 4, '#496c38');
  }

  function selectedUnit(game, options) {
    return (game.units || []).find(unit => unit.slot === options.selectedSlot);
  }
  function dropAction(source, target) {
    if (!source || source.id === target?.id) return null;
    if (!target) return 'move';
    if (engine()?.canFeed?.(source, target)) return 'feed';
    if (engine()?.canMerge?.(source, target)) return 'merge';
    return 'swap';
  }
  function cell(ctx, slot, unit, selected, action, hovered) {
    const { x, y } = slot;
    const base = (Math.round(x / 70) + Math.round(y / 70)) % 2 ? '#acd269' : '#9fc85b';
    const swapping = hovered && action === 'swap', feedable = action === 'feed', mergeable = action === 'merge';
    const moving = hovered && action === 'move';
    round(ctx, x - 32, y - 32, 64, 64, 7, selected ? '#dfe88b' : swapping ? '#a8d5b1' : feedable ? '#e4d07b' : hovered ? '#c4de7a' : base, feedable ? '#b97b21' : selected ? '#ffeb81' : swapping ? '#367a6b' : mergeable ? '#fcf3bc' : moving ? '#5b8439' : '#759c4690', selected || mergeable || swapping || feedable || moving ? 3 : 1.2);
    if (unit) ellipse(ctx, x, y + 13, 24, 8, '#6d983c66');
    else {
      line(ctx, x - 4, y + 1, x + 4, y + 1, '#6a963f66', 1.6);
      line(ctx, x, y - 3, x, y + 5, '#6a963f66', 1.6);
    }
    if (selected) {
      for (const direction of [-1, 1]) polygon(ctx, [[x + direction * 39, y - 4], [x + direction * 34, y], [x + direction * 39, y + 4]], '#fff4a0', '#b08b35', .8);
    }
  }

  function getImage(images, info, level) {
    if (info?.image && typeof info.image === 'object') return info.image;
    if (!images) return null;
    const index = Number.isInteger(info?.photoIndex) ? info.photoIndex : level;
    return typeof images.get === 'function' ? images.get(index) || images.get(info?.image) : images[index];
  }
  function form(unit, options) {
    if (unit.isGolden) return forms?.goldenPortrait || { image: 'assets/defense/golden-warrior.png' };
    if (typeof options.formForLevel === 'function') return options.formForLevel(unit.level) || {};
    const levels = Array.isArray(options.levels) ? options.levels : options.levels?.levels || [];
    const count = Math.max(1, levels.length - 1), photoIndex = unit.level % count;
    return { ...levels[photoIndex + 1], photoIndex, cycle: Math.floor(unit.level / count) };
  }
  function crop(image, frame) {
    const valid = Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite) && frame[0] >= 0 && frame[1] >= 0 && frame[2] > 0 && frame[3] > 0 && frame[0] + frame[2] <= image.naturalWidth && frame[1] + frame[3] <= image.naturalHeight;
    return valid ? frame : [0, 0, image.naturalWidth, image.naturalHeight];
  }
  function attributeIdentity(unit) {
    const definitions = (engine()?.evolutionPath?.(unit) || [])
      .filter(step => step.level <= unit.level)
      .map(step => engine()?.routeInfo?.(step.route, step.level))
      .filter(Boolean);
    return {
      branch: definitions.find(info => info.tier === 2),
      skill: definitions.find(info => info.tier === 3),
      active: definitions.at(-1),
    };
  }
  function snowflake(ctx, x, y, r, color) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
      line(ctx, x - dx, y - dy, x + dx, y + dy, color, 1.2);
    }
  }
  // Every talent has a fixed silhouette budget. The same glyph is readable on
  // a defender's small crest and on its larger impact, without more particles
  // being created for repeated choices or very large damage values.
  function talentGlyph(ctx, skill, family, r, phase = 0) {
    const color = ABILITY[family] || ABILITY.normal, ink = ROUTE_INK[family] || '#a17932';
    const flame = (x, y, size) => polygon(ctx, [[x - size * .6, y + size * .5], [x - size * .8, y - size * .2], [x, y - size], [x + size * .2, y - size * .1], [x + size * .7, y - size * .5], [x + size * .6, y + size * .5]], '#ffd284', '#dc7338', 1.3);
    const leaf = (x, y, size) => polygon(ctx, [[x, y], [x - size * .4, y - size * .6], [x + size * .7, y - size], [x + size * .5, y - size * .2]], '#c8f49a', '#57863e', 1);
    if (skill === 'ice_echo') {
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * TAU / 3 + phase * .3); polygon(ctx, [[-r * .17, -r * .3], [0, -r], [r * .17, -r * .3], [0, 0]], '#dbfbff', ink, 1.5); ctx.restore(); }
    } else if (skill === 'ice_tide') {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, r * .2, r * (.45 + i * .25), Math.PI * 1.08, Math.PI * 1.92); ctx.strokeStyle = i % 2 ? '#f1ffff' : color; ctx.lineWidth = 2.5; ctx.stroke(); }
      snowflake(ctx, 0, r * .25, r * .25, '#e7ffff');
    } else if (skill === 'ice_mirror') {
      for (const side of [-1, 1]) polygon(ctx, [[side * r * .14, -r * .8], [side * r * .8, -r * .1], [side * r * .14, r * .8]], '#9de6f240', '#edffff', 2);
      line(ctx, -r * .6, r * .4, r * .6, -r * .4, color, 2);
    } else if (skill === 'fire_ember') {
      ellipse(ctx, 0, 0, r * .55, r * .55, '#ff8a382b', color, 2.3);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; flame(Math.cos(a) * r * .72, Math.sin(a) * r * .72, r * .18); }
    } else if (skill === 'fire_relay') {
      for (let i = 0; i < 3; i++) { const x = (i - 1) * r * .65; if (i < 2) line(ctx, x, r * .15, x + r * .65, -r * .05, '#fff0ad', 2); flame(x, i % 2 ? -r * .3 : r * .1, r * .32); }
    } else if (skill === 'fire_scorch') {
      ellipse(ctx, 0, r * .2, r, r * .45, '#733e3429', '#ffa158', 2.5);
      for (let i = 0; i < 5; i++) flame((i - 2) * r * .35, Math.abs(i - 2) * r * .12, r * (.35 + (i === 2 ? .15 : 0)));
    } else if (skill === 'lightning_return') {
      ctx.beginPath(); ctx.moveTo(-r * .7, -r * .7); ctx.lineTo(r * .7, -r * .4); ctx.lineTo(r * .2, 0); ctx.lineTo(r * .65, r * .4); ctx.lineTo(-r * .7, r * .65);
      ctx.strokeStyle = '#f6eea6'; ctx.lineWidth = 3; ctx.stroke();
      polygon(ctx, [[-r, r * .65], [-r * .4, r * .25], [-r * .4, r * .9]], '#fff5c0', ink, 1);
    } else if (skill === 'lightning_resonance') {
      for (const side of [-1, 1]) ellipse(ctx, side * r * .3, 0, r * .65, r * .65, '#d9b6ff1f', side < 0 ? '#dfb4ff' : '#fff3ae', 2);
      for (let i = 0; i < 3; i++) ellipse(ctx, 0, (i - 1) * r * .45, r * .09, r * .09, '#fff9dd');
    } else if (skill === 'lightning_charge') {
      polygon(ctx, [[r * .25, -r], [-r * .4, r * .05], [r * .02, -r * .05], [-r * .2, r * .8], [r * .55, -r * .2], [r * .15, -r * .1]], '#fff2a4', '#ad7dbf', 1.5);
      ellipse(ctx, 0, r * .8, r * .7, r * .18, null, '#e9c5ff', 2);
    } else if (skill === 'earth_fault') {
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * .2, -r * .35); ctx.lineTo(r * .1, -r * .55); ctx.lineTo(0, -r); ctx.strokeStyle = '#70533d'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#efca88'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    } else if (skill === 'earth_pierce') {
      for (let i = 0; i < 3; i++) { const x = (i - 1) * r * .55, top = -r * (i === 1 ? 1 : .65); polygon(ctx, [[x - r * .15, r * .65], [x - r * .13, top + r * .3], [x, top], [x + r * .13, top + r * .3], [x + r * .15, r * .65]], '#ebcb94', '#71553e', 1.5); }
    } else if (skill === 'earth_gravity') {
      for (let i = 0; i < 3; i++) ellipse(ctx, 0, i * r * .1, r * (1 - i * .28), r * (.48 - i * .1), i === 2 ? '#634f553f' : null, i % 2 ? '#f8d99d' : '#ba9bda', 2);
      for (const side of [-1, 1]) polygon(ctx, [[side * r * .75, -r * .8], [side * r * .3, -r * .5], [side * r * .6, -r * .3]], color, ink, 1);
    } else if (skill === 'grass_branch') {
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(r * .5, -r * .25, -r * .4, -r * .65, 0, -r); ctx.strokeStyle = '#9bdf79'; ctx.lineWidth = 2.5; ctx.stroke(); leaf(0, -r * .4, r * .3); ctx.restore(); }
    } else if (skill === 'grass_bloom') {
      for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * TAU / 5 + phase * .15); ellipse(ctx, 0, -r * .45, r * .27, r * .5, '#e9bfe25c', '#dbf9b1', 1.5); ctx.restore(); }
      ellipse(ctx, 0, 0, r * .18, r * .18, '#f9e99b', '#6b9351', 1.5);
    } else if (skill === 'grass_prison') {
      for (let i = 0; i < 3; i++) { const spread = r * (.35 + i * .3); ctx.beginPath(); ctx.moveTo(-spread, r * .65); ctx.bezierCurveTo(-spread, -r, spread, -r, spread, r * .65); ctx.strokeStyle = i % 2 ? '#d8f7b1' : '#80c96e'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ellipse(ctx, 0, r * .65, r, r * .2, null, '#9de877', 2);
    } else if (skill === 'golden_blades') {
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate((i - 1) * .55); polygon(ctx, [[0, -r], [-r * .12, -r * .65], [-r * .08, r * .6], [r * .08, r * .6], [r * .12, -r * .65]], '#fff3c1', '#b98731', 1.4); line(ctx, -r * .25, r * .55, r * .25, r * .55, '#e7b845', 2); ctx.restore(); }
    } else if (skill === 'golden_domain') {
      ellipse(ctx, 0, 0, r, r, '#ffd96814', '#f9d06c', 2);
      polygon(ctx, Array.from({ length: 12 }, (_, i) => { const a = i * TAU / 12 - Math.PI / 2, reach = r * (i % 2 ? .46 : .83); return [Math.cos(a) * reach, Math.sin(a) * reach]; }), null, '#fff1b2', 1.6);
    } else if (skill === 'golden_resonance') {
      ellipse(ctx, 0, 0, r * .75, r * .75, null, '#ffe4a3', 2);
      ROUTES.forEach((route, i) => { const a = i * TAU / 5 - Math.PI / 2; ellipse(ctx, Math.cos(a) * r * .75, Math.sin(a) * r * .75, r * .17, r * .17, ABILITY[route], '#fff9d4', 1.2); });
    } else ellipse(ctx, 0, 0, r, r, null, color, 2);
  }
  // Advanced silhouettes remain bounded regardless of level. Each branch has
  // geometry of its own, while the original portrait and blade hitboxes stay intact.
  function advancedAttributes(ctx, unit, identity, options, elapsed) {
    const branch = identity.branch;
    if (!branch) return;
    const phase = options.reducedMotion ? 0 : number(elapsed) * 1.4 + number(unit.phase);
    const color = branch.color || ABILITY[branch.family] || '#d1e8ed';
    ctx.save();
    if (branch.id === 'glacier') {
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 12, rise = i % 2 ? 20 : 12;
        polygon(ctx, [[x - 7, 18], [x - 4, 3 - rise], [x + 1, -4 - rise], [x + 7, 18]], '#8ed4f0b8', '#277493', 1.2);
        line(ctx, x + 1, -2 - rise, x + 2, 15, '#eefcff', 1.2);
      }
    } else if (branch.id === 'blizzard') {
      for (let i = 0; i < 3; i++) {
        const a = phase + i * TAU / 3;
        ctx.beginPath(); ctx.ellipse(0, -10, 32, 23, -.35, a, a + 1.8);
        ctx.strokeStyle = '#d8ffffce'; ctx.lineWidth = 2; ctx.stroke();
        snowflake(ctx, Math.cos(a) * 31, -10 + Math.sin(a) * 23, 4.5, '#f2ffff');
      }
    } else if (branch.id === 'magma') {
      ellipse(ctx, 0, 13, 30, 10, '#733b35cc', '#ed7844', 2.2);
      for (const side of [-1, 1]) {
        polygon(ctx, [[side * 17, 12], [side * 29, 6], [side * 26, -17], [side * 20, -25], [side * 22, -4]], '#653d3cdd', '#ea7845', 1.5);
        line(ctx, side * 24, -15, side * 20, -5, '#ffd37c', 2);
        line(ctx, side * 20, -5, side * 25, 3, '#ff9c4b', 2);
      }
      for (let i = 0; i < 3; i++) ellipse(ctx, (i - 1) * 17, 12 + Math.sin(phase + i) * 2, 3, 1.5, '#ffce72');
    } else if (branch.id === 'solar') {
      ellipse(ctx, 0, -13, 28, 28, '#ffdd6426', '#ffe4a4', 2.2);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + phase * .14, x = Math.cos(a), y = Math.sin(a);
        line(ctx, x * 29, -13 + y * 29, x * 35, -13 + y * 35, '#fff3bd', 2.5);
      }
    } else if (branch.id === 'storm') {
      for (let i = 0; i < 3; i++) {
        const y = -26 + i * 15, drift = Math.sin(phase + i) * 2;
        ctx.beginPath(); ctx.moveTo(-31, y + 5); ctx.bezierCurveTo(-13, y - 6, 19, y + 11, 30, y - 5 + drift);
        ctx.strokeStyle = '#c9f6e0c9'; ctx.lineWidth = 3 - i * .5; ctx.stroke();
        line(ctx, 26, y - 4 + drift, 30, y - 5 + drift, '#f7ffe8', 2);
      }
    } else if (branch.id === 'plasma') {
      for (const angle of [-.5, .5]) {
        ctx.save(); ctx.translate(0, -12); ctx.rotate(angle);
        ellipse(ctx, 0, 0, 32, 14, null, '#e1bcff', 2.2);
        const a = phase + angle * 3;
        ellipse(ctx, Math.cos(a) * 32, Math.sin(a) * 14, 3.3, 3.3, '#faf1ff', '#9866c6', 1);
        ctx.restore();
      }
    } else if (branch.family === 'earth') {
      for (const side of [-1, 1]) {
        if (branch.id === 'bastion') {
          polygon(ctx, [[side * 16, 17], [side * 30, 11], [side * 32, -20], [side * 23, -28], [side * 17, -17]], '#957557dd', '#e2c698', 1.5);
          line(ctx, side * 23, -16, side * 24, 10, '#f9dfab', 1.4);
        } else if (branch.id === 'quake') {
          polygon(ctx, [[side * 16, 16], [side * 30, 13], [side * 34, -3], [side * 23, -12]], '#a67a4bd9', '#664e38', 1.5);
          line(ctx, side * 29, -2, side * 22, 3, '#f2c47a', 2);
          line(ctx, side * 22, 3, side * 28, 10, '#f2c47a', 2);
        } else {
          polygon(ctx, [[side * 20, 15], [side * 33, -6], [side * 28, -32], [side * 19, -14]], '#e6c481ba', '#93724b', 1.2);
          line(ctx, side * 28, -28, side * 25, 8, '#fff3bd', 1.5);
        }
      }
    } else if (branch.family === 'grass') {
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 16, 18); ctx.bezierCurveTo(side * 35, 0, side * 14, -17, side * 28, -33);
        ctx.strokeStyle = '#477c3d'; ctx.lineWidth = 3; ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const y = 8 - i * 16, x = side * (24 + Math.sin(phase + i) * 2);
          if (branch.id === 'thorn') polygon(ctx, [[x, y], [x + side * 10, y - 7], [x + side * 3, y + 5]], '#7ca94c', '#38623a', 1);
          else if (branch.id === 'bloom') {
            for (let j = 0; j < 4; j++) ellipse(ctx, x + Math.cos(j * TAU / 4) * 3, y + Math.sin(j * TAU / 4) * 3, 2.7, 2.7, '#f5e6b3');
            ellipse(ctx, x, y, 2, 2, '#debe54');
          } else polygon(ctx, [[x, y + 4], [x + side * 11, y - 2], [x + side * 9, y - 10], [x + side * 2, y - 7]], '#98d367c9', '#4b8a45', 1);
        }
      }
    } else if (['rime', 'inferno', 'surge'].includes(branch.id)) {
      for (let i = 0; i < 4; i++) {
        const a = phase * .25 + i * TAU / 4;
        const x = Math.cos(a) * 29, y = -13 + Math.sin(a) * 27;
        if (branch.id === 'rime') snowflake(ctx, x, y, 6, '#e6fdff');
        else if (branch.id === 'inferno') polygon(ctx, [[x - 4, y + 7], [x, y - 9], [x + 5, y + 5]], '#ffce73', '#d56b37', 1);
        else polygon(ctx, [[x + 2, y - 9], [x - 5, y + 1], [x, y], [x - 2, y + 8], [x + 5, y - 3]], '#fff5ad', '#ba9448', 1);
      }
    }
    if (identity.skill) {
      const skill = identity.skill, mark = skill.icon || '✦';
      // A compact crest names the learned skill without growing an opaque
      // backdrop over the face. Its outline also survives reduced motion.
      polygon(ctx, [[0, -47], [9, -39], [6, -30], [-6, -30], [-9, -39]], '#fff9e4', skill.color || color, 1.7);
      text(ctx, mark, 0, -38, 10, '#435954', '800', 'center');
    }
    if (number(identity.active?.tier) >= 4) {
      const id = identity.active.id;
      ctx.save(); ctx.translate(0, 16);
      if (TALENT_FAMILY[id]) {
        talentGlyph(ctx, id, branch.family, 14, phase);
      } else if (id === 'echo') {
        ellipse(ctx, -3, -2, 30, 8, null, color, 1.3);
        ellipse(ctx, 3, 2, 30, 8, null, '#fff9df', 1.3);
      } else if (id === 'dominion') {
        polygon(ctx, [[-30, 0], [-15, -9], [15, -9], [30, 0], [15, 9], [-15, 9]], null, color, 1.8);
      } else {
        for (const side of [-1, 1]) polygon(ctx, [[side * 18, 5], [side * 25, -6], [side * 24, 1], [side * 31, -5], [side * 26, 8]], '#fff5b4', color, 1);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // Ambient attributes stay tied to simulation time. Pausing or choosing a route
  // therefore freezes the whole model; reduced motion keeps the shape language.
  function attributes(ctx, unit, stats, options, elapsed) {
    const ranks = stats.ranks || {}, dominant = stats.ability || 'normal';
    const phase = options.reducedMotion ? 0 : number(elapsed) * 2.2 + number(unit.phase, number(unit.id) * .71);
    for (const route of [...ROUTES.filter(route => route !== dominant), dominant]) {
      if (number(ranks[route]) <= 0) continue;
      const primary = route === dominant, strength = primary ? 1 : .52;
      ctx.save(); ctx.globalAlpha *= strength;
      const color = ABILITY[route], ink = ROUTE_INK[route];
      // A restrained colored backing makes identical photos legible even at
      // mobile size, without tinting faces or expanding physical hitboxes.
      ellipse(ctx, 0, -11, 28, 32, color + (primary ? '45' : '25'));
      ellipse(ctx, 0, 14, 28, 8, color + '6b', ink, primary ? 1.5 : 1);
      if (route === 'ice') {
        for (const side of [-1, 1]) {
          const drift = options.reducedMotion ? 0 : Math.sin(phase + side) * 1.1;
          const x = side * 24, y = -9 + drift;
          polygon(ctx, [[x, y - 24], [x + side * 6, y - 9], [x + side * 3, y + 12], [x - side * 5, y + 9], [x - side * 3, y - 12]], '#b9f0f5b8', ink, 1.1);
          line(ctx, x, y - 21, x, y + 9, '#f1ffff', 1.3);
          line(ctx, x, y - 2, x + side * 5, y - 8, '#f1ffff', 1);
          polygon(ctx, [[side * 12, 17], [side * 17, 4], [side * 21, 16]], '#dffcffdd', ink, .8);
        }
        for (const side of [-1, 1]) line(ctx, side * 6, 14, side * 21, 14, '#f1ffff', 1);
      } else if (route === 'fire') {
        for (const [side, offset] of [[-1, 0], [1, 1.8]]) {
          const flicker = options.reducedMotion ? 0 : Math.sin(phase * 1.6 + offset) * 2;
          const x = side * 23;
          polygon(ctx, [[x - side * 7, 15], [x + side * 7, 7], [x + side * 8, -9], [x + side * 2, -4], [x + side * 4, -31 + flicker], [x - side * 5, -20], [x - side * 8, -30 - flicker], [x - side * 9, 0]], '#ef843caa', '#c65b34', 1.1);
          polygon(ctx, [[x - side * 4, 13], [x + side * 3, 6], [x + side * 1, -13 + flicker], [x - side * 4, -4], [x - side * 6, -13]], '#ffe28e');
          const rise = options.reducedMotion ? 0 : (phase + offset) % 2.4;
          ellipse(ctx, side * (27 + Math.sin(phase + offset)), -25 - rise * 5, 1.6, 2.2, '#ffe8ad');
        }
        line(ctx, -16, 14, 16, 14, '#ffebae', 2);
      } else if (route === 'lightning') {
        const drift = options.reducedMotion ? 0 : Math.sin(phase * 1.4) * 2;
        for (const side of [-1, 1]) {
          const points = [[side * 18, -39], [side * 28, -26], [side * 22, -23], [side * (30 + drift), -7], [side * 24, -6], [side * 28, 10], [side * 17, 17]];
          ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
          ctx.strokeStyle = '#b48d32'; ctx.lineWidth = 3.8; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.strokeStyle = '#fff4ab'; ctx.lineWidth = 1.7; ctx.stroke();
          polygon(ctx, [[side * 12, 9], [side * 18, 12], [side * 14, 14], [side * 21, 17], [side * 10, 15], [side * 14, 12]], '#fff6b0', ink, .6);
        }
      } else if (route === 'earth') {
        for (const side of [-1, 1]) {
          const drift = options.reducedMotion ? 0 : Math.sin(phase + side) * 1.5;
          polygon(ctx, [[side * 18, 17], [side * 28, 13], [side * 31, -10 + drift], [side * 22, -20 + drift], [side * 17, -10]], '#b68f65c9', ink, 1.4);
          line(ctx, side * 21, -10 + drift, side * 27, -4 + drift, '#f6db9e', 1.4);
          polygon(ctx, [[side * 25, -26 + drift], [side * 28, -31 + drift], [side * 34, -27 + drift], [side * 31, -22 + drift]], '#dfbd85', ink, 1);
        }
      } else if (route === 'grass') {
        for (const side of [-1, 1]) {
          const drift = options.reducedMotion ? 0 : Math.sin(phase + side) * 1.6;
          ctx.beginPath(); ctx.moveTo(side * 17, 17); ctx.quadraticCurveTo(side * 31, -2, side * 23, -28 + drift);
          ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.stroke();
          for (let i = 0; i < 3; i++) {
            const y = 8 - i * 12 + drift, x = side * 24;
            polygon(ctx, [[x, y + 3], [x + side * 9, y], [x + side * 12, y - 9], [x + side * 3, y - 6]], '#9cdb75bf', ink, 1);
            line(ctx, x, y + 2, x + side * 9, y - 6, '#deffc3', .8);
          }
        }
      }
      ctx.restore();
    }
  }
  function goldenAttributes(ctx, unit, options, elapsed) {
    const phase = options.reducedMotion ? 0 : number(elapsed) * .65;
    const rank = clamp(number(unit.goldenRank, 1), 1, 6);
    // Open, segmented aureole: the face remains completely unobscured. All
    // decoration stays within a cell-sized silhouette even after many feeds.
    ctx.save(); ctx.translate(0, -11);
    for (let i = 0; i < 6; i++) {
      const a = phase + i * TAU / 6;
      ctx.beginPath(); ctx.arc(0, -2, 29, a, a + .7);
      ctx.strokeStyle = '#966129'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = i % 2 ? '#fff8d7' : '#f6cd67'; ctx.lineWidth = 2; ctx.stroke();
      const x = Math.cos(a + .35) * 34, y = -2 + Math.sin(a + .35) * 34;
      polygon(ctx, [[x, y - 2.5], [x + 1.7, y], [x, y + 2.5], [x - 1.7, y]], '#fff8cf', '#be8d37', .6);
    }
    for (const side of [-1, 1]) {
      polygon(ctx, [[side * 12, 17], [side * 22, 5], [side * 31, -3], [side * 25, 18]], '#d3a944b0', '#815a28', 1.3);
      line(ctx, side * 17, 15, side * 27, 3, '#fff2bc', 1.3);
      const rise = options.reducedMotion ? .6 : (phase * .7 + (side + 1) * .35) % 1;
      const y = 10 - rise * 37;
      line(ctx, side * 30 - 2, y, side * 30 + 2, y, '#fff6cb', 1.3);
      line(ctx, side * 30, y - 3, side * 30, y + 3, '#fff6cb', 1.3);
    }
    polygon(ctx, [[-11, -32], [-13, -42], [-5, -37], [0, -46], [5, -37], [13, -42], [11, -32]], '#f4d474', '#85622d', 1.3);
    polygon(ctx, [[0, -40], [2.5, -36], [0, -32], [-2.5, -36]], '#fffcef', '#ba8b37', .6);
    for (let i = 0; i < rank; i++) ellipse(ctx, (i - (rank - 1) / 2) * 5, 27, 1.25, 1.25, '#fff5b5');
    const talents = statsFor(unit).goldenTalents || unit.goldenTalents || {};
    ['golden_blades', 'golden_domain', 'golden_resonance'].forEach((skill, index) => {
      if (number(talents[skill]) <= 0) return;
      ctx.save(); ctx.translate((index - 1) * 18, 33); talentGlyph(ctx, skill, 'golden', 6); ctx.restore();
    });
    ctx.restore();
  }
  function portrait(ctx, unit, options, x = unit.x, y = unit.y, opacity = 1, elapsed = 0) {
    const info = form(unit, options), image = unit.isGolden ? options.goldenImage : getImage(options.images, info, unit.level);
    const stats = statsFor(unit), ability = unit.isGolden ? 'golden' : stats.ability || 'normal';
    const identity = attributeIdentity(unit);
    const pulse = options.reducedMotion ? 0 : clamp(number(unit.pulse) / .6, 0, 1);
    ctx.save(); ctx.globalAlpha *= opacity; ctx.translate(x, y + 15);
    ellipse(ctx, 1, 2, 21, 6, '#345d3555', '#d9e5a650', 1);
    ctx.save(); ctx.translate(0, -15);
    if (unit.isGolden) goldenAttributes(ctx, unit, options, elapsed);
    else { attributes(ctx, unit, stats, options, elapsed); advancedAttributes(ctx, unit, identity, options, elapsed); }
    ctx.restore();
    const spring = 1 + Math.sin(pulse * Math.PI) * .08;
    ctx.scale(1 / spring, spring);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const source = crop(image, info.frame), scale = Math.min(49 / source[2], 52 / source[3]);
      const w = source[2] * scale, h = source[3] * scale;
      ctx.drawImage(image, ...source, -w / 2, -h, w, h);
    } else {
      round(ctx, -11, -29, 22, 29, 6, unit.isGolden ? '#e1b851' : info.color || '#dbb071', '#4c613c', 1.5);
      ellipse(ctx, 0, -34, 10, 10, '#f2cdad', '#735e3b', 1.5);
      line(ctx, -16, -22, 16, -22, '#50725d', 4);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= opacity;
    const label = unit.isGolden ? `黄金 ${Math.min(999, Math.max(1, Math.floor(number(unit.goldenRank, 1))))}${unit.goldenRank > 999 ? '+' : ''}` : `Lv.${unit.level + 1}`;
    const width = Math.max(32, label.length * 5.1 + 10);
    round(ctx, x - width / 2, y + 19, width, 15, 5, ability === 'normal' ? '#365e35' : '#354c43', ability === 'normal' ? '#d6e59b' : ABILITY[ability], 1.4);
    text(ctx, label, x, y + 27, 8, '#fffce6', '800', 'center', MONO);
    if (unit.isGolden) {
      const progress = engine()?.goldenProgress?.(unit) || { progress: 0, required: 30 };
      const ratio = clamp(number(progress.progress) / Math.max(1, number(progress.required, 30)), 0, 1);
      round(ctx, x - 22, y + 35, 44, 4, 2, '#755524', '#fff0bb', .7);
      if (ratio > 0) { ctx.fillStyle = '#ffde77'; ctx.fillRect(x - 21, y + 36, 42 * ratio, 2); }
    } else if (ability !== 'normal') {
      const rank = Math.max(1, number(stats.ranks?.[ability], number(unit.routes?.[ability], 1)));
      const advanced = identity.active && identity.active.tier >= 2;
      const badge = advanced ? Array.from(identity.active.name || '进阶').slice(0, 5).join('') : `${ROUTE_MARK[ability] || '✦'}${rank}`;
      const badgeWidth = Math.max(23, Array.from(badge).length * (advanced ? 8 : 5.5) + 8);
      round(ctx, x + 5, y - 27, badgeWidth, 15, 6, identity.active?.color || ABILITY[ability], '#406441', 1.2);
      text(ctx, badge, x + 5 + badgeWidth / 2, y - 19, advanced ? 8 : 9, '#254e4b', '800', 'center');
      // Retained routes remain visible even when the latest choice changes
      // the primary blade color. The badge number is that route's rank.
      let marker = 0;
      for (const route of ROUTES) {
        if (route !== ability && number(stats.ranks?.[route]) > 0) ellipse(ctx, x - 20 + marker++ * 8, y - 22, 3, 3, ABILITY[route], '#406441', 1);
      }
    }
    const dormant = engine()?.evolutionPath?.(unit)?.filter(step => step.level > unit.level) || [];
    if (dormant.length) {
      const mark = [...new Set(dormant.map(step => ROUTE_MARK[step.route] || '').filter(Boolean))].join('');
      const badge = `${mark}休`, width = Math.max(28, badge.length * 8 + 8);
      round(ctx, x - width / 2, y - 44, width, 13, 4, '#e8e9dc', '#818a7c', 1);
      text(ctx, badge, x, y - 37, 8, '#657061', '700', 'center');
    }
    ctx.restore();
  }
  function orbit(ctx, unit, game, options) {
    const blades = engine()?.bladesFor?.(unit, number(game.elapsed)) || [];
    const stats = statsFor(unit);
    const ability = unit.isGolden ? 'golden' : stats.ability || 'normal', identity = attributeIdentity(unit);
    const color = unit.isGolden ? ABILITY.golden : identity.active?.color || ABILITY[ability] || ABILITY.normal;
    for (const blade of blades.slice(0, 12)) {
      if (![blade.x, blade.y, blade.innerX, blade.innerY, blade.outerX, blade.outerY].every(Number.isFinite)) continue;
      const radius = Math.hypot(blade.x - unit.x, blade.y - unit.y), angle = Math.atan2(blade.y - unit.y, blade.x - unit.x);
      if (!options.reducedMotion) {
        ctx.beginPath(); ctx.arc(unit.x, unit.y, radius, angle - .42, angle);
        ctx.strokeStyle = ability === 'normal' ? '#fff9d84d' : color + '65'; ctx.lineWidth = 6; ctx.stroke();
        ctx.beginPath(); ctx.arc(unit.x, unit.y, radius, angle - .2, angle);
        ctx.strokeStyle = color + 'bb'; ctx.lineWidth = 2.8; ctx.stroke();
      }
      const dx = blade.outerX - blade.innerX, dy = blade.outerY - blade.innerY, length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length, ny = dx / length, bx = blade.innerX + dx * .25, by = blade.innerY + dy * .25;
      const metal = unit.isGolden ? '#c69b45' : '#8a9c9a', darkMetal = unit.isGolden ? '#815b2b' : '#3b5857';
      // Faceted blade and wrapped grip share the exact collision endpoints.
      line(ctx, blade.innerX, blade.innerY, bx, by, darkMetal, 5);
      for (const f of [.06, .13, .2]) line(ctx, blade.innerX + dx * f - nx * 2, blade.innerY + dy * f - ny * 2, blade.innerX + dx * f + nx * 2, blade.innerY + dy * f + ny * 2, metal, 1);
      ellipse(ctx, blade.innerX, blade.innerY, 2.7, 2.7, color, darkMetal, 1);
      polygon(ctx, [[bx + nx * 5.8 - dx * .03, by + ny * 5.8 - dy * .03], [bx + nx * 6.7 + dx * .04, by + ny * 6.7 + dy * .04], [bx, by + dy * .02], [bx - nx * 6.7 + dx * .04, by - ny * 6.7 + dy * .04], [bx - nx * 5.8 - dx * .03, by - ny * 5.8 - dy * .03]], metal, darkMetal, .9);
      polygon(ctx, [[bx + nx * 3, by + ny * 3], [bx + dx * .42 + nx * 2.4, by + dy * .42 + ny * 2.4], [blade.outerX, blade.outerY], [bx - nx * 3, by - ny * 3]], color, darkMetal, 1);
      polygon(ctx, [[bx, by], [blade.outerX, blade.outerY], [bx - nx * 3, by - ny * 3]], '#fbfff0d9');
      line(ctx, bx, by, blade.outerX, blade.outerY, '#ffffff', 1);
      line(ctx, bx + dx * .12, by + dy * .12, bx + dx * .34, by + dy * .34, metal, 1);
      ellipse(ctx, bx, by, 2, 2, unit.isGolden ? '#fff7ce' : color, darkMetal, .7);
      if (ability === 'ice') {
        polygon(ctx, [[bx + nx * 4, by + ny * 4], [bx + nx * 7 + dx * .2, by + ny * 7 + dy * .2], [bx + dx * .4, by + dy * .4]], '#dffcff', '#368eac', .7);
      } else if (ability === 'fire') {
        polygon(ctx, [[bx + nx * 5, by + ny * 5], [bx - dx * .16 + nx * 10, by - dy * .16 + ny * 10], [bx + dx * .35 + nx * 3, by + dy * .35 + ny * 3]], '#f79a3d88');
      } else if (ability === 'lightning') {
        const ex = blade.outerX, ey = blade.outerY;
        line(ctx, ex, ey, ex + nx * 4 - dx * .1, ey + ny * 4 - dy * .1, '#ffed8a', 2);
        line(ctx, ex + nx * 4 - dx * .1, ey + ny * 4 - dy * .1, ex + nx * 6 + dx * .1, ey + ny * 6 + dy * .1, '#fff8c8', 1.5);
      } else if (ability === 'earth') {
        polygon(ctx, [[bx + nx * 4, by + ny * 4], [bx + nx * 6 + dx * .18, by + ny * 6 + dy * .18], [bx + dx * .3, by + dy * .3]], '#d5bc8a', '#87674c', .8);
      } else if (ability === 'grass') {
        polygon(ctx, [[bx + nx * 2, by + ny * 2], [bx + nx * 7 + dx * .17, by + ny * 7 + dy * .17], [bx + nx * 3 + dx * .28, by + ny * 3 + dy * .28]], '#c1f095', '#527c3f', .8);
      }
    }
  }

  function bottlePath(ctx, kind) {
    ctx.beginPath();
    if (kind === 'brandy') {
      ctx.moveTo(-4, -20); ctx.lineTo(4, -20); ctx.lineTo(4, -12);
      ctx.bezierCurveTo(4, -7, 14, -6, 14, 6); ctx.bezierCurveTo(14, 18, 8, 19, 0, 19);
      ctx.bezierCurveTo(-8, 19, -14, 18, -14, 6); ctx.bezierCurveTo(-14, -6, -4, -7, -4, -12);
    } else if (kind === 'whisky') {
      ctx.moveTo(-4, -22); ctx.lineTo(4, -22); ctx.lineTo(4, -11); ctx.lineTo(11, -5);
      ctx.lineTo(12, 16); ctx.quadraticCurveTo(12, 19, 8, 19); ctx.lineTo(-8, 19);
      ctx.quadraticCurveTo(-12, 19, -12, 16); ctx.lineTo(-11, -5); ctx.lineTo(-4, -11);
    } else if (kind === 'gin') {
      ctx.moveTo(-4, -22); ctx.lineTo(4, -22); ctx.lineTo(4, -12); ctx.lineTo(12, -7);
      ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.lineTo(-12, -7); ctx.lineTo(-4, -12);
    } else if (kind === 'baijiu') {
      ctx.moveTo(-5, -21); ctx.lineTo(5, -21); ctx.lineTo(5, -12);
      ctx.quadraticCurveTo(12, -7, 12, -3); ctx.lineTo(12, 17); ctx.quadraticCurveTo(12, 20, 8, 20);
      ctx.lineTo(-8, 20); ctx.quadraticCurveTo(-12, 20, -12, 17); ctx.lineTo(-12, -3); ctx.quadraticCurveTo(-12, -7, -5, -12);
    } else if (kind === 'champagne') {
      ctx.moveTo(-4, -24); ctx.lineTo(4, -24); ctx.lineTo(5, -11);
      ctx.bezierCurveTo(5, -7, 12, -5, 12, 2); ctx.lineTo(12, 18); ctx.quadraticCurveTo(0, 22, -12, 18);
      ctx.lineTo(-12, 2); ctx.bezierCurveTo(-12, -5, -5, -7, -5, -11);
    } else {
      ctx.moveTo(-3.5, -25); ctx.lineTo(3.5, -25); ctx.lineTo(3.5, -9);
      ctx.bezierCurveTo(3.5, -5, 10, -5, 10, 0); ctx.lineTo(10, 19); ctx.lineTo(-10, 19);
      ctx.lineTo(-10, 0); ctx.bezierCurveTo(-10, -5, -3.5, -5, -3.5, -9);
    }
    ctx.closePath();
  }
  function bottle(ctx, kind, hit = 0) {
    const fills = { whisky: '#c99545', brandy: '#a86a35', wine: '#413f3d', baijiu: '#f8f4df', gin: '#7fbcd0', champagne: '#526c45' };
    const edge = kind === 'baijiu' ? '#baaa8d' : '#34473e';
    bottlePath(ctx, kind); ctx.fillStyle = fills[kind] || fills.whisky; ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); bottlePath(ctx, kind); ctx.clip();
    ctx.fillStyle = '#ffffff38'; ctx.fillRect(-8, -17, 3, 34);
    ctx.fillStyle = '#152f3025'; ctx.fillRect(8, -15, 6, 38);
    if (hit > 0) { ctx.fillStyle = `rgba(255,255,240,${clamp(hit * .65, 0, .7)})`; ctx.fillRect(-20, -30, 40, 60); }
    ctx.restore();
    if (kind === 'whisky') {
      ctx.fillStyle = '#274f40'; ctx.fillRect(-5, -24, 10, 5);
      polygon(ctx, [[-8, -3], [7, -5], [8, 10], [-7, 12]], '#ece5c9');
      line(ctx, -5, 2, 5, 0, '#675a3c', 1); line(ctx, -5, 7, 5, 5, '#b39760', 1.2);
      text(ctx, 'W', 0, 4, 6, '#574b31', '700', 'center', MONO);
    } else if (kind === 'brandy') {
      ctx.fillStyle = '#47392c'; ctx.fillRect(-5, -22, 10, 5);
      ellipse(ctx, 0, -6, 3, 3, '#ecd396', '#73512d', .7);
      ctx.fillStyle = '#f3e8c6'; ctx.fillRect(-10, 2, 20, 11);
      line(ctx, -8, 4, 8, 4, '#aa8947', .6); text(ctx, 'BRANDY', 0, 9, 4, '#704d2b', '700', 'center', MONO);
    } else if (kind === 'wine') {
      ctx.fillStyle = '#7b344d'; ctx.fillRect(-4, -26, 8, 14);
      ctx.fillStyle = '#f0e6cd'; ctx.fillRect(-8, 1, 16, 12);
      polygon(ctx, [[-4, 6], [0, 2], [4, 6], [0, 10]], '#9c5f65');
      line(ctx, -6, 11, 6, 11, '#9d7e64', .6);
    } else if (kind === 'baijiu') {
      ctx.fillStyle = '#c94735'; ctx.fillRect(-6, -24, 12, 8);
      polygon(ctx, [[-8, -10], [-4, -12], [11, 6], [8, 9]], '#d6533d');
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(-8, 1, 16, 13);
      ctx.strokeStyle = '#ba9d5d'; ctx.lineWidth = .7; ctx.strokeRect(-8, 1, 16, 13);
      text(ctx, '白', 0, 7, 8, '#b03f2c', '700', 'center');
    } else if (kind === 'gin') {
      ctx.fillStyle = '#d6d7bd'; ctx.fillRect(-5, -24, 10, 5);
      ctx.fillStyle = '#f4f0d8'; ctx.fillRect(-8, -3, 16, 15);
      ctx.strokeStyle = '#518fa5'; ctx.lineWidth = .8; ctx.strokeRect(-6, -1, 12, 11);
      ellipse(ctx, 0, 3, 2.5, 2.5, '#5997a9'); text(ctx, 'GIN', 0, 8, 4, '#3c7688', '700', 'center', MONO);
    } else if (kind === 'champagne') {
      polygon(ctx, [[-4, -25], [4, -25], [6, -9], [-6, -9]], '#d6b75c');
      line(ctx, -4, -17, 4, -20, '#efdfa7', 1.5);
      polygon(ctx, [[-8, -6], [9, 2], [9, 5], [-9, -3]], '#e9cc79');
      ctx.fillStyle = '#f0e5c6'; ctx.fillRect(-9, 5, 18, 10);
      text(ctx, 'BRUT', 0, 10, 5, '#657149', '700', 'center', MONO);
      ellipse(ctx, 0, 0, 2, 2, '#b65140');
    }
  }

  function enemyStatus(ctx, e, game, options) {
    // These accents follow the actual control timers, not the reaction mark:
    // consuming frost therefore removes its crystals on the very next frame.
    const phase = options.reducedMotion ? 0 : Math.sin(number(game.elapsed) * 5 + number(e.id));
    if (number(e.frostTime) > 0) {
      ellipse(ctx, 0, 26, 19 + phase * .6, 7, '#72dfff55', '#e5fcff', 2);
      for (const side of [-1, 1]) {
        const x = side * 15;
        polygon(ctx, [[x - 4, 23], [x - 3, 13], [x + side * 2, 7], [x + 4, 19], [x + 3, 25]], '#71d9eecc', '#e5fcff', 1.3);
        line(ctx, x, 23, x + side, 12, '#ffffff', 1);
      }
      snowflake(ctx, 0, 28, 4, '#e5fcff');
    } else if (number(e.slowTime) > 0) {
      ellipse(ctx, 0, 25, 16, 6, '#c5cfac44', '#d4ddbb', 1.3);
    }
    if (number(e.rootTime) > 0) {
      ellipse(ctx, 0, 27, 19, 6, '#407b4966', '#a5ec76', 1.5);
      // Two narrow coils leave the bottle label visible while the feet and
      // side leaves make even a short, repeatedly refreshed root recognizable.
      for (const color of ['#245d36', '#9ce66d']) {
        ctx.strokeStyle = color; ctx.lineWidth = color === '#245d36' ? 4.5 : 2.4;
        ctx.beginPath(); ctx.moveTo(-17, 28);
        ctx.bezierCurveTo(-5, 21, 16, 26, 15, 17);
        ctx.bezierCurveTo(14, 10, -18, 17, -14, 6);
        ctx.stroke();
      }
      for (const side of [-1, 1]) {
        const x = side * 15, y = side < 0 ? 8 : 19;
        polygon(ctx, [[x, y + 3], [x + side * 7, y - 4], [x + side * 8, y + 2], [x + side * 3, y + 6]], '#a5ec76', '#245d36', 1.2);
      }
    }
  }

  function enemy(ctx, e, game, options, board) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.y < -45 || e.y > board.height + 50) return;
    const data = catalog?.byKind?.[e.kind] || { tint: '#c58a39' };
    const isBoss = Boolean(e.boss || e.isBoss), scale = isBoss ? 1.2 : 1;
    const time = number(game.elapsed) * 1000;
    const wobble = options.reducedMotion ? 0 : Math.sin(time / 170 + number(e.id) * 1.7) * .035;
    const hit = clamp(number(e.hit) / .12, 0, 1);
    const recoil = options.reducedMotion ? 0 : Math.sin(hit * Math.PI * .75) * 3.2;
    const hitAngle = number(e.hitAngle, number(e.id) % 2 ? 0 : Math.PI);
    const lean = options.reducedMotion ? 0 : Math.cos(hitAngle) * hit * .12;
    ellipse(ctx, e.x + 1.5, e.y + 27 * scale, 13 * scale, 5, '#29432944');
    const images = options.enemyImages, image = typeof images?.get === 'function' ? images.get(e.kind) : images?.[e.kind];
    ctx.save(); ctx.translate(e.x + Math.cos(hitAngle) * recoil, e.y + Math.sin(hitAngle) * recoil); ctx.rotate(wobble + lean); ctx.scale(scale, scale);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const source = crop(image, data.frame), ratio = Math.min(29 / source[2], 57 / source[3]);
      const w = source[2] * ratio, h = source[3] * ratio;
      ctx.drawImage(image, ...source, -w / 2, 27 - h, w, h);
      if (hit > 0) {
        // Screen the same transparent crop so the flash follows the real
        // bottle silhouette and cannot brighten a rectangular background.
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= hit * .7;
        ctx.drawImage(image, ...source, -w / 2, 27 - h, w, h); ctx.restore();
        ellipse(ctx, 0, 0, w * .66, h * .45, null, `rgba(255,245,161,${hit * .8})`, 2);
      }
    } else { ctx.save(); ctx.scale(.96, 1.15); bottle(ctx, e.kind, hit); ctx.restore(); }
    enemyStatus(ctx, e, game, options);
    ctx.restore();
  }

  function enemyVitals(ctx, e, board) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.y < -45 || e.y > board.height + 50) return;
    const isBoss = Boolean(e.boss || e.isBoss), scale = isBoss ? 1.2 : 1;
    const hp = Math.max(0, Math.ceil(number(e.hp))), ratio = clamp(number(e.hp) / Math.max(1, number(e.maxHp, e.hp)), 0, 1);
    const barY = e.y - 37 * scale, barW = isBoss ? 32 : 27;
    round(ctx, e.x - barW / 2 - 1, barY - 11, barW + 2, 16, 4, '#fff9db', '#5e6945', 1);
    text(ctx, hp, e.x, barY - 5, hp > 999 ? 7 : 9, '#34482e', '800', 'center', MONO);
    ctx.fillStyle = '#d2d7a6'; ctx.fillRect(e.x - barW / 2 + 2, barY + 1, barW - 4, 2.5);
    ctx.fillStyle = ratio < .3 ? '#df6c44' : '#629b47'; ctx.fillRect(e.x - barW / 2 + 2, barY + 1, (barW - 4) * ratio, 2.5);
    if (isBoss) text(ctx, '♛', e.x, barY - 19, 15, '#f7d15e', '800', 'center');
  }

  function eggPath(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -23);
    ctx.bezierCurveTo(9, -23, 18, -7, 18, 5);
    ctx.bezierCurveTo(18, 23, -18, 23, -18, 5);
    ctx.bezierCurveTo(-18, -7, -9, -23, 0, -23); ctx.closePath();
  }
  function supply(ctx, egg, game, options, board) {
    if (!Number.isFinite(egg.x) || !Number.isFinite(egg.y) || egg.y < board.lane.stopY - 25 || egg.y > board.height + 30) return;
    const ratio = clamp(number(egg.hp) / Math.max(1, number(egg.maxHp, egg.hp)), 0, 1);
    const hit = clamp(number(egg.hit) / .18, 0, 1);
    const sway = options.reducedMotion ? 0 : Math.sin(number(game.elapsed) * 2.5 + number(egg.id)) * .025;
    ellipse(ctx, egg.x + 1, egg.y + 20, 23, 7, '#526e4324');
    ellipse(ctx, egg.x, egg.y + 18, 21, 6, '#b5cd9f', '#9bb58a');
    ctx.save(); ctx.translate(egg.x, egg.y); ctx.rotate(sway);
    if (!options.reducedMotion && hit > 0) ctx.scale(1 + hit * .06, 1 - hit * .07);
    eggPath(ctx); ctx.fillStyle = '#fff9e9'; ctx.fill();
    ctx.strokeStyle = '#7b7948'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); eggPath(ctx); ctx.clip();
    ellipse(ctx, -7, -9, 5, 10, '#ffffffb8');
    ellipse(ctx, 12, 9, 4, 16, '#e0cd9b45');
    if (ratio < .76) {
      ctx.beginPath(); ctx.moveTo(-11, -18); ctx.lineTo(-5, -11); ctx.lineTo(-9, -6); ctx.lineTo(-3, -2);
      ctx.strokeStyle = '#a78e61'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    if (ratio < .4) {
      ctx.beginPath(); ctx.moveTo(17, 3); ctx.lineTo(10, 8); ctx.lineTo(13, 13); ctx.lineTo(4, 17); ctx.lineTo(1, 22);
      ctx.strokeStyle = '#a78e61'; ctx.lineWidth = 1.3; ctx.stroke();
    }
    if (hit > 0) { ctx.fillStyle = `rgba(255,255,255,${hit * .65})`; ctx.fillRect(-20, -25, 40, 50); }
    ctx.restore();
    const hp = String(Math.max(0, Math.ceil(number(egg.hp))));
    text(ctx, hp, 0, 4, hp.length > 3 ? 10 : 14, '#35513d', '700', 'center', MONO);
    ctx.restore();
  }

  const REACTION_TINT = Object.freeze({ fire: '#ff792b', ice: '#72e7ff', lightning: '#e6afff', earth: '#e6b063', grass: '#a4f46f', golden: '#ffe084' });
  function reactionPair(e) {
    const elements = Array.isArray(e.elements) ? [...e.elements].sort() : String(e.reaction || '').split('_').sort();
    return { key: elements.join('_'), colors: elements.map(element => REACTION_TINT[element] || '#fff0bd') };
  }
  function effectTime(e) { return clamp(number(e.age) / Math.max(.001, number(e.duration, .55)), 0, 1); }
  function reactionFade(t) { return t < .66 ? 1 : (1 - t) / .34; }
  function reactionEffect(ctx, e, motion) {
    const { key, colors } = reactionPair(e), color = e.color || '#fff0bd';
    const r = clamp(number(e.radius, 40), 48, 70) * (.72 + motion * .28);
    ctx.save(); ctx.translate(e.x, e.y);
    // Two saturated elements share one impact ring. The dark rim keeps the
    // burst legible on both the gray road and the light grass at phone scale.
    ellipse(ctx, 0, 0, r, r, '#203b444d', '#263c4ddd', 5);
    for (let half = 0; half < 2; half++) {
      ctx.beginPath(); ctx.arc(0, 0, r, half * Math.PI + .12, (half + 1) * Math.PI - .12);
      ctx.strokeStyle = colors[half] || color; ctx.lineWidth = 3.5; ctx.stroke();
    }
    ellipse(ctx, 0, 0, 12 + motion * 11, 12 + motion * 11, '#fff8d754');
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + .24, reach = r * (.65 + motion * .35), x = Math.cos(a) * reach, y = Math.sin(a) * reach;
      line(ctx, Math.cos(a) * (reach - 9), Math.sin(a) * (reach - 9), x, y, '#283642', 5);
      line(ctx, Math.cos(a) * (reach - 9), Math.sin(a) * (reach - 9), x, y, colors[i % 2] || color, 2.8);
    }
    if (key.includes('golden')) {
      const family = key.split('_').find(element => element !== 'golden');
      ellipse(ctx, 0, 0, r * .86, r * .86, '#f7ca4018', '#ffdc79', 2);
      if (family === 'ice') {
        talentGlyph(ctx, 'ice_echo', 'ice', r * .85);
        snowflake(ctx, 0, 0, r * .38, '#fff6c7');
      } else if (family === 'fire') {
        talentGlyph(ctx, 'fire_ember', 'fire', r * .8);
        polygon(ctx, [[0, -r * .5], [-r * .35, r * .2], [r * .35, r * .2]], '#ffdf737a', '#fff8cc', 1.5);
      } else if (family === 'lightning') {
        talentGlyph(ctx, 'lightning_charge', 'lightning', r * .8);
        for (const side of [-1, 1]) { line(ctx, side * r * .2, -r * .2, side * r * .7, 0, '#fff7c0', 2.3); line(ctx, side * r * .7, 0, side * r * .5, r * .4, '#e9c5ff', 2); }
      } else if (family === 'earth') {
        talentGlyph(ctx, 'earth_fault', 'earth', r * .85);
        polygon(ctx, [[-r * .25, 0], [0, -r * .6], [r * .25, 0], [0, r * .15]], '#ffedaa', '#c08c3f', 1.5);
      } else if (family === 'grass') {
        talentGlyph(ctx, 'grass_prison', 'grass', r * .8);
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ellipse(ctx, Math.cos(a) * r * .37, Math.sin(a) * r * .37, 4, 6, '#fff0b3', '#9bc46c', 1); }
      }
    } else if (key === 'fire_ice') {
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * r * .4;
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.bezierCurveTo(x + 8, -3, x - 8, -12, x + 3, -r);
        ctx.strokeStyle = i % 2 ? '#ffb05a' : '#dbfbff'; ctx.lineWidth = 4; ctx.stroke();
      }
    } else if (key === 'fire_lightning') {
      ellipse(ctx, 0, 0, r, r, '#ff943b85', '#fff3b0', 3.5);
      polygon(ctx, Array.from({ length: 12 }, (_, i) => { const a = i * TAU / 12, reach = r * (i % 2 ? .42 : 1.2); return [Math.cos(a) * reach, Math.sin(a) * reach]; }), '#fff0a999', '#fff5ca', 2);
    } else if (key === 'earth_fire') {
      ellipse(ctx, 0, 6, r, r * .6, '#7c3f27a0', '#ffb76b', 3);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        line(ctx, 0, 4, Math.cos(a + .2) * r * .55, 4 + Math.sin(a + .2) * r * .4, '#ffe0a0', 2);
        line(ctx, Math.cos(a + .2) * r * .55, 4 + Math.sin(a + .2) * r * .4, Math.cos(a) * r, 4 + Math.sin(a) * r * .6, '#f7a35a', 2);
      }
    } else if (key === 'fire_grass') {
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, x = Math.cos(a) * r * .8, y = Math.sin(a) * r * .8;
        polygon(ctx, [[x - 3, y + 5], [x - 5, y - 2], [x + 2, y - 12], [x + 5, y + 3]], '#ff8b3ce6', '#ffe8a2', 1.8);
        line(ctx, x, y + 3, x + 1, y - 6, '#e5f49d', 1);
      }
    } else if (key === 'ice_lightning') {
      snowflake(ctx, 0, 0, r, '#dbfaff');
      for (const side of [-1, 1]) polygon(ctx, [[side * 7, -r], [side * 15, -2], [side * 8, -5], [side * 13, r]], '#fff3b4', '#acc7fb', 1);
    } else if (key === 'earth_ice') {
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, x = Math.cos(a) * r, y = Math.sin(a) * r;
        polygon(ctx, [[x - 5, y + 5], [x - 3, y - 7], [x + 4, y - 10], [x + 6, y + 3]], '#d5f0eac9', '#9bbaaf', 1);
        line(ctx, x - 1, y + 3, x + 2, y - 6, '#fffce7', 1);
      }
    } else if (key === 'grass_ice') {
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4;
        ctx.save(); ctx.rotate(a); polygon(ctx, [[0, 2], [-7, -r * .55], [0, -r], [7, -r * .55]], '#81e3b8ba', '#e0fff3', 2); ctx.restore();
      }
      snowflake(ctx, 0, 0, 8, '#f5fffd');
    } else if (key === 'earth_lightning') {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3, x = Math.cos(a) * r, y = Math.sin(a) * r;
        polygon(ctx, [[x - 4, y - 6], [x + 6, y - 3], [x + 4, y + 5], [x - 6, y + 3]], '#ae82cb', '#ffe8c2', 1.6);
        line(ctx, 0, 0, x * .5 + 4, y * .5 - 3, '#e9d8ff', 2); line(ctx, x * .5 + 4, y * .5 - 3, x, y, '#e9d8ff', 2);
      }
    } else if (key === 'grass_lightning') {
      ellipse(ctx, 0, 0, r, r * .65, null, '#d6f599', 3.5);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4, x = Math.cos(a) * r, y = Math.sin(a) * r * .65;
        polygon(ctx, [[x, y - 7], [x - 4, y + 1], [x, y], [x - 2, y + 7], [x + 5, y - 2]], '#fff3ac', '#a4cb65', .8);
      }
    } else if (key === 'earth_grass') {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-r, 7); ctx.bezierCurveTo(-r * .5, -r, r * .5, r, r, -7);
        ctx.strokeStyle = '#c9b17b'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#84b85c'; ctx.lineWidth = 2; ctx.stroke();
        polygon(ctx, [[0, 0], [6, -10], [14, -11], [10, -3]], '#c8ec9c', '#598b48', 1); ctx.restore();
      }
    } else ellipse(ctx, 0, 0, r, r, null, color, 2);
    ctx.restore();
  }

  function reactionBadges(ctx, reactions, options, board) {
    const occupied = [], seen = new Set();
    for (const e of [...reactions].reverse()) {
      const t = effectTime(e), identity = e.enemyId ?? `${e.x},${e.y}`;
      if (t >= 1 || !Number.isFinite(e.x) || !Number.isFinite(e.y) || seen.has(identity)) continue;
      seen.add(identity);
      if (occupied.length >= 6) break;
      const label = `${e.name || '元素反应'}${number(e.multiplier) > 1 ? ` ×${e.multiplier}` : ''}`;
      const width = clamp(Array.from(label).length * 9 + 34, 90, 152), height = 25;
      const x = clamp(e.x + 22, width / 2 + 7, board.width - 7 - width / 2);
      const idealY = clamp(e.y - 48 - (options.reducedMotion ? 2 : t * 8), 18, board.height - 20);
      let y = idealY;
      for (const offset of [0, -29, 29, -58, 58, -87, 87]) {
        const candidate = clamp(idealY + offset, 18, board.height - 20);
        if (occupied.every(box => Math.abs(x - box.x) >= (width + box.width) / 2 + 4 || Math.abs(candidate - box.y) >= height + 3)) { y = candidate; break; }
      }
      if (occupied.some(box => Math.abs(x - box.x) < (width + box.width) / 2 + 4 && Math.abs(y - box.y) < height + 3)) continue;
      occupied.push({ x, y, width });
      const { colors } = reactionPair(e);
      ctx.save(); ctx.globalAlpha *= reactionFade(t);
      round(ctx, x - width / 2, y - height / 2 + 2, width, height, 7, '#18302bc9');
      round(ctx, x - width / 2, y - height / 2, width, height, 7, '#243c34', '#fff2c7', 1.3);
      ellipse(ctx, x - width / 2 + 11, y - 3, 3.5, 3.5, colors[0] || '#fff0bd');
      ellipse(ctx, x - width / 2 + 15, y + 3, 3.5, 3.5, colors[1] || '#fff0bd');
      text(ctx, label, x + 8, y, 12, '#fff9e0', '800', 'center');
      ctx.restore();
    }
  }

  function goldenReveal(ctx, e, options, board) {
    const t = effectTime(e);
    if (t >= 1 || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
    const fade = Math.min(1, t / .1, (1 - t) / .18);
    const rise = options.reducedMotion ? 1 : 1 - Math.pow(1 - clamp(t / .28, 0, 1), 3);
    const phase = options.reducedMotion ? 0 : t * .22;
    ctx.save(); ctx.globalAlpha *= fade;
    // The engine briefly holds the battlefield during this one-time entrance.
    // Use one gentle exposure envelope, never alternating bright flashes.
    ctx.fillStyle = '#142a24df'; ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = '#7c5a273d'; ctx.fillRect(0, board.height / 2 - 227, board.width, 447);
    ctx.translate(board.width / 2, board.height / 2);
    ctx.save(); ctx.translate(0, -30);
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + phase, near = 57, far = 350;
      polygon(ctx, [[Math.cos(a - .035) * near, Math.sin(a - .035) * near], [Math.cos(a - .075) * far, Math.sin(a - .075) * far], [Math.cos(a + .075) * far, Math.sin(a + .075) * far], [Math.cos(a + .035) * near, Math.sin(a + .035) * near]], i % 2 ? '#ffe1a118' : '#e6b35c24');
    }
    const scale = .8 + rise * .2;
    ctx.scale(scale, scale);
    for (let i = 3; i >= 0; i--) ellipse(ctx, 0, -2, 113 + i * 15, 113 + i * 15, i % 2 ? '#efbb4520' : '#ffd97716');
    ellipse(ctx, 0, -2, 112, 112, '#84662c70', '#ffe9a6', 2.5);
    ellipse(ctx, 0, -2, 103, 103, null, '#d4a74f', 1);
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6 + phase;
      ctx.save(); ctx.rotate(angle); ctx.translate(0, -125);
      // Six ceremonial swords frame the cutout without covering its face.
      polygon(ctx, [[0, -27], [-6, -8], [-4, 16], [4, 16], [6, -8]], '#fff8d2', '#b88736', 1.5);
      polygon(ctx, [[0, -27], [0, 16], [4, 16], [6, -8]], '#ebbf64');
      line(ctx, -10, 16, 10, 16, '#e6ae43', 4);
      line(ctx, 0, 18, 0, 29, '#ffe6a2', 5);
      polygon(ctx, [[0, 29], [4, 33], [0, 37], [-4, 33]], '#ffedb3', '#b88736', 1);
      ctx.restore();
    }
    const image = options.goldenImage;
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const source = crop(image, forms?.goldenPortrait?.frame), fit = Math.min(184 / source[2], 222 / source[3]);
      const width = source[2] * fit, height = source[3] * fit;
      ctx.drawImage(image, ...source, -width / 2, 102 - height, width, height);
    } else {
      polygon(ctx, [[0, -72], [-46, -22], [-32, 78], [32, 78], [46, -22]], '#e2b857', '#fff1b8', 3);
      ellipse(ctx, 0, -82, 27, 31, '#ffe2ac', '#b68132', 2);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + .3 + phase, x = Math.cos(a) * 153, y = Math.sin(a) * 153;
      polygon(ctx, [[x, y - 6], [x + 2, y - 1], [x + 6, y], [x + 2, y + 1], [x, y + 6], [x - 2, y + 1], [x - 6, y], [x - 2, y - 1]], '#fff4c8');
    }
    ctx.restore();
    round(ctx, -57, -209, 114, 27, 13, '#473d25', '#dcb46c', 1);
    text(ctx, '隐 藏 进 化', 0, -195, 12, '#fff0be', '800', 'center');
    effectLabel(ctx, '黄金战士', 0, 146, '#ffe3a0', 38);
    line(ctx, -111, 182, -59, 182, '#c39c59', 1); line(ctx, 59, 182, 111, 182, '#c39c59', 1);
    text(ctx, '传 说 降 临', 0, 182, 13, '#fff2ca', '800', 'center');
    text(ctx, '吞噬棋子 · 无限成长', 0, 218, 12, '#e7d5af', '600', 'center');
    text(ctx, '战场暂歇 · 准备迎战', 0, 251, 10, '#d5c49e', '500', 'center');
    ctx.restore();
  }

  function battlefieldFields(ctx, game, options) {
    const phase = options.reducedMotion ? 0 : number(game.elapsed) * .45;
    for (const zone of (game.zones || []).slice(-80)) {
      if (![zone.x, zone.y].every(Number.isFinite) || number(zone.remaining) <= 0) continue;
      const family = zone.family || zone.ability || TALENT_FAMILY[zone.type];
      if (!['fire_scorch', 'earth_gravity'].includes(zone.type)) continue;
      const r = clamp(number(zone.radius, 60), 1, 160), color = ABILITY[family] || ABILITY.earth;
      const fade = clamp(number(zone.remaining) / Math.max(.01, number(zone.duration, 1)), .18, 1);
      ctx.save(); ctx.translate(zone.x, zone.y); ctx.globalAlpha *= .5 + fade * .35;
      ellipse(ctx, 0, 0, r, r, family === 'fire' ? '#e46d3321' : '#725b8e24', color, 1.5);
      ctx.save(); ctx.setLineDash([6, 5]); ellipse(ctx, 0, 0, r * .88, r * .88, null, color, 1); ctx.restore();
      if (zone.type === 'fire_scorch') {
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6, x = Math.cos(a) * r * .82, y = Math.sin(a) * r * .82;
          const rise = options.reducedMotion ? 0 : Math.sin(phase * 5 + i) * 2;
          polygon(ctx, [[x - 4, y + 3], [x - 1, y - 8 - rise], [x + 4, y + 3]], '#ffc16caa', '#ff955a', .8);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + phase;
          ctx.beginPath(); ctx.arc(0, 0, r * (.34 + i * .2), a, a + Math.PI * 1.1);
          ctx.strokeStyle = i % 2 ? '#ecd199' : '#c9b1e3'; ctx.lineWidth = 1.7; ctx.stroke();
        }
        ellipse(ctx, 0, 0, 9, 5, '#65517555', '#e7c89a', 1);
      }
      ctx.restore();
    }
    for (const unit of (game.units || []).filter(unit => unit.isGolden).slice(0, 40)) {
      const radius = number(statsFor(unit).fieldRadius);
      if (radius <= 0 || ![unit.x, unit.y].every(Number.isFinite)) continue;
      const r = clamp(radius, 1, 160);
      ctx.save(); ctx.translate(unit.x, unit.y);
      ellipse(ctx, 0, 0, r, r, '#ffe18a0b', '#f9d26c85', 1.8);
      ctx.save(); ctx.setLineDash([12, 9]); ellipse(ctx, 0, 0, r - Math.min(6, r / 3), r - Math.min(6, r / 3), null, '#fff0b38c', 1.1); ctx.restore();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + phase * .16, x = Math.cos(a) * r, y = Math.sin(a) * r;
        polygon(ctx, [[x, y - 5], [x + 2.5, y], [x, y + 5], [x - 2.5, y]], '#ffedb0b0', '#ba8b3b', .7);
      }
      ctx.restore();
    }
  }

  function effect(ctx, e, options) {
    const t = effectTime(e);
    if (t >= 1 || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
    const fade = 1 - t, motion = options.reducedMotion ? .35 : t;
    ctx.save(); ctx.globalAlpha *= e.type === 'reaction' ? reactionFade(t) : fade;
    const color = e.color || e.tint || (e.type === 'leak' ? ORANGE : '#d7ad4a');
    if (e.type === 'reaction') {
      reactionEffect(ctx, e, motion);
    } else if (e.type === 'talent') {
      const skill = e.skill, family = TALENT_FAMILY[skill] || e.ability || 'normal';
      const r = clamp(number(e.radius, 45), 12, 160) * (.65 + motion * .35);
      ctx.save(); ctx.translate(e.x, e.y);
      ellipse(ctx, 0, 0, r, r, (ABILITY[family] || ABILITY.normal) + '12', null);
      talentGlyph(ctx, skill, family, r * .83, motion);
      ctx.restore();
    } else if (e.type === 'golden' || e.type === 'feed') {
      const awakening = e.type === 'golden', evolved = awakening || number(e.rank) > number(e.previousRank, e.rank);
      const r = 15 + motion * (awakening ? 43 : evolved ? 30 : 15);
      ellipse(ctx, e.x, e.y - 9, r, r, null, '#fff2b4', evolved ? 3 : 1.5);
      if (evolved) {
        ellipse(ctx, e.x, e.y - 9, r * .75, r * .75, null, '#dba643', 1.4);
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8, x = e.x + Math.cos(a) * r, y = e.y - 9 + Math.sin(a) * r;
          polygon(ctx, [[x, y - 5], [x + 2, y], [x, y + 5], [x - 2, y]], i % 2 ? '#fff6d2' : '#ebc96c');
        }
      }
      effectLabel(ctx, awakening ? '黄金觉醒' : evolved ? '黄金进阶' : `投喂 +${Math.max(0, Math.floor(number(e.gained)))}`, e.x, e.y - 48 - motion * 10, '#fff6ce', 11);
    } else if (e.type === 'slash') {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(number(e.angle));
      const strikeColor = ABILITY[e.ability] || '#fff6c1';
      ctx.beginPath(); ctx.arc(0, 0, 10 + motion * 15, -1.15, 1.05);
      ctx.strokeStyle = '#5c6a3d80'; ctx.lineWidth = 7 * fade + 1; ctx.stroke();
      ctx.strokeStyle = strikeColor; ctx.lineWidth = 4.5 * fade + .5; ctx.stroke();
      if (t < .55) {
        const r = 8 + motion * 9;
        polygon(ctx, [[-r, 0], [-3, -3], [0, -r], [3, -3], [r, 0], [3, 3], [0, r], [-3, 3]], '#fff8c9', strikeColor, 1);
        ellipse(ctx, 0, 0, 3, 3, '#fffef1');
      }
      ctx.restore();
      if (number(e.damage) > 0) impactNumber(ctx, e.damage, e.x + 15, e.y - 18 - motion * 18, '#fff3bf');
    } else if (e.type === 'fire') {
      const r = clamp(number(e.radius, 42), 1, 160) * (.35 + motion * .65);
      ellipse(ctx, e.x, e.y, r, r, '#ffb94b25', '#fbb94d', 2 * fade + .5);
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
        polygon(ctx, [[x - 3, y + 5], [x + 2, y - 8], [x + 6, y + 3]], '#f29438b0');
      }
    } else if (e.type === 'chain' && Number.isFinite(e.fromX) && Number.isFinite(e.fromY)) {
      const dx = e.x - e.fromX, dy = e.y - e.fromY, length = Math.max(1, Math.hypot(dx, dy));
      ctx.beginPath(); ctx.moveTo(e.fromX, e.fromY);
      for (let i = 1; i < 6; i++) { const t = i / 6, offset = (i % 2 ? 1 : -1) * 5; ctx.lineTo(e.fromX + dx * t - dy / length * offset, e.fromY + dy * t + dx / length * offset); }
      ctx.lineTo(e.x, e.y); ctx.strokeStyle = '#e6a83b'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#fff8b8'; ctx.lineWidth = 2.2; ctx.stroke();
    } else if (e.type === 'field') {
      const r = clamp(number(e.radius, 38), 6, 160), tint = ABILITY[e.ability] || '#d8eccc';
      if (e.ability === 'golden') {
        ctx.save(); ctx.translate(e.x, e.y); talentGlyph(ctx, 'golden_domain', 'golden', r); ctx.restore();
      } else {
        ellipse(ctx, e.x, e.y, r, r, tint + '20', tint, 1.7);
        ctx.save(); ctx.setLineDash([4, 5]);
        ellipse(ctx, e.x, e.y, r * .8, r * .8, null, tint, 1.2);
        ctx.restore();
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4 + .5;
          snowflake(ctx, e.x + Math.cos(a) * r * .6, e.y + Math.sin(a) * r * .6, 3, '#f3ffec');
        }
      }
    } else if (e.type === 'skill') {
      const r = clamp(number(e.radius, 38), 6, 95) * (.45 + motion * .55);
      const skill = e.skill, tint = ABILITY[e.ability] || '#e7eddf';
      ctx.save(); ctx.translate(e.x, e.y);
      if (skill === 'shatter' || skill === 'hail') {
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6, x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (skill === 'hail') {
            line(ctx, x - 4, y - 13, x, y, '#d6fbff', 1.8);
            ellipse(ctx, x, y, 4, 4, '#e9fdff', '#438ea9', 1);
          } else polygon(ctx, [[x - 3, y + 4], [x, y - 8], [x + 4, y + 3]], '#e5fbff', '#52a6bb', 1);
        }
      } else if (skill === 'permafrost' || skill === 'whiteout') {
        ellipse(ctx, 0, 0, r, r, '#c0f5ff1c', '#c8faff', 2);
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + (skill === 'whiteout' ? motion * 2 : 0);
          snowflake(ctx, Math.cos(a) * r * .68, Math.sin(a) * r * .68, skill === 'permafrost' ? 6 : 3, '#ecffff');
        }
      } else if (skill === 'eruption' || skill === 'slag') {
        ellipse(ctx, 0, 3, r, r * .6, '#7e3d282f', '#f79148', 2);
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * r * .35, y = Math.sin(i * 2) * r * .25;
          if (skill === 'eruption') polygon(ctx, [[x - 5, y + 6], [x, y - 14 - r * .25], [x + 7, y + 5]], '#ffb657b3', '#ee7853', 1);
          else ellipse(ctx, x, y, 5 + motion * 3, 3 + motion * 2, '#ffc572a6', '#bf5c3b', 1);
        }
      } else if (skill === 'flare' || skill === 'nova') {
        ellipse(ctx, 0, 0, r, r, '#ffe59920', '#ffdf88', 2.5);
        if (skill === 'nova') ellipse(ctx, 0, 0, r * .6, r * .6, null, '#fff5d5', 3);
        else for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          line(ctx, Math.cos(a) * r * .55, Math.sin(a) * r * .55, Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, '#fff0bc', 2);
        }
      } else if (['fault', 'meteor', 'fortress', 'erosion'].includes(skill)) {
        if (skill === 'fortress') polygon(ctx, [[-r, 5], [-r, -r * .5], [0, -r], [r, -r * .5], [r, 5], [0, r * .6]], '#debf8b25', '#ead0a1', 2.4);
        else if (skill === 'fault') {
          for (let i = 0; i < 4; i++) {
            const a = i * TAU / 4; ctx.save(); ctx.rotate(a);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, -r * .35); ctx.lineTo(2, -r * .55); ctx.lineTo(7, -r);
            ctx.strokeStyle = '#ecd09d'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
          }
        } else for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5, x = Math.cos(a) * r * .65, y = Math.sin(a) * r * .65;
          if (skill === 'meteor') line(ctx, x - 8, y - 15, x, y, '#e1c590', 2.4);
          polygon(ctx, [[x - 4, y - 3], [x + 2, y - 6], [x + 6, y + 2], [x - 3, y + 5]], skill === 'meteor' ? '#b18c69' : '#ddc397', '#f3dfba', 1);
        }
      } else if (['root', 'venom', 'harvest', 'seedstorm'].includes(skill)) {
        if (skill === 'root') {
          for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * TAU / 3); ctx.beginPath(); ctx.moveTo(-r, 7); ctx.quadraticCurveTo(-r * .2, -r, r, -5); ctx.strokeStyle = '#b4db8c'; ctx.lineWidth = 2.4; ctx.stroke(); ctx.restore(); }
        } else if (skill === 'venom') {
          for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ellipse(ctx, Math.cos(a) * r * .7, Math.sin(a) * r * .7, 3 + i * .6, 4 + i * .6, '#bde68e50', '#d9f4a8', 1.2); }
        } else if (skill === 'harvest') {
          for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6); polygon(ctx, [[0, 0], [-6, -r * .65], [0, -r], [6, -r * .65]], '#f2e4ab70', '#eaffce', 1); ctx.restore(); }
        } else {
          for (let i = 0; i < 7; i++) { const a = i * TAU / 7; ellipse(ctx, Math.cos(a) * r, Math.sin(a) * r, 2, 3, '#e3f6b5', '#8db35f', 1); line(ctx, Math.cos(a) * r * .5, Math.sin(a) * r * .5, Math.cos(a) * r * .85, Math.sin(a) * r * .85, '#d4f3a3', 1.3); }
        }
      } else if (skill === 'cyclone') {
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + motion * 3;
          ctx.beginPath(); ctx.arc(0, 0, r * (.5 + i * .2), a, a + Math.PI);
          ctx.strokeStyle = '#d1f8df'; ctx.lineWidth = 2.5; ctx.stroke();
        }
      } else if (skill === 'thunderhead' || skill === 'arc') {
        for (let i = 0; i < (skill === 'thunderhead' ? 3 : 1); i++) {
          const x = (i - (skill === 'thunderhead' ? 1 : 0)) * r * .5;
          polygon(ctx, [[x + 5, -r], [x - 9, 0], [x, -3], [x - 5, r], [x + 12, -8], [x + 3, -4]], '#fff1af', '#ba8a35', 1);
        }
      } else {
        ellipse(ctx, 0, 0, r, r, null, skill === 'pulse' ? '#debaff' : tint, 2.4);
        ellipse(ctx, 0, 0, r * .65, r * .65, null, '#fff6d9', 1.6);
        for (let i = 0; i < 4; i++) ellipse(ctx, Math.cos(i * TAU / 4) * r, Math.sin(i * TAU / 4) * r, 3, 3, '#fff9ee');
      }
      ctx.restore();
    } else if (e.type === 'score' || e.type === 'damage') {
      text(ctx, e.text || `${e.type === 'score' ? '+' : '−'}${Math.ceil(number(e.value, number(e.amount)))}`, e.x, e.y - 20 - motion * 25, 13, e.type === 'score' ? '#3a6f4a' : ORANGE, '700', 'center', MONO);
    } else if (e.type === 'evolveFail') {
      ellipse(ctx, e.x, e.y + 2, 19 + motion * 12, 10 + motion * 7, null, '#849080', 2 * fade + .4);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .3, r = 16 + motion * 20;
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r + motion * motion * 10;
        polygon(ctx, [[x - 2, y - 3], [x + 3, y - 1], [x + 1, y + 3], [x - 3, y + 1]], '#9ba595', '#6d7b66', .7);
      }
      const labelY = e.y - 44 - motion * 8;
      round(ctx, e.x - 28, labelY - 8, 56, 16, 5, '#e8ebdbed', '#8b9580', .8);
      text(ctx, '等级保留', e.x, labelY, 9, '#617157', '700', 'center');
    } else if (e.type === 'merge' || e.type === 'upgrade') {
      ellipse(ctx, e.x, e.y - 3, 18 + motion * 28, 18 + motion * 28, null, '#d5a443', 2 * fade + .7);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8, r = 17 + motion * 32, x = e.x + Math.cos(a) * r, y = e.y - 3 + Math.sin(a) * r;
        polygon(ctx, [[x, y - 4], [x + 2, y], [x, y + 4], [x - 2, y]], i % 2 ? '#f6d56f' : ORANGE);
      }
    } else if (e.type === 'hatch') {
      ellipse(ctx, e.x, e.y, 16 + motion * 22, 21 + motion * 18, '#f6dd8438', '#d4b35c', 1.5);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .4, r = 15 + motion * 30;
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r + motion * motion * 18;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + motion * 2);
        polygon(ctx, [[-5, -5], [1, -8], [5, -3], [2, 0], [5, 4], [-2, 6]], '#fff9e9', '#baa77d', 1);
        ctx.restore();
      }
      text(ctx, e.reserve ? '待入场 +1' : '同伴 +1', e.x - 18, e.y - 30 - motion * 15, 12, '#42683c', '700', 'right');
    } else if (e.type === 'supplyHit') {
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, r = 12 + motion * 13;
        line(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.x + Math.cos(a) * (r + 4), e.y + Math.sin(a) * (r + 4), '#c5a857', 1.6);
      }
    } else if (e.type === 'kill' || e.type === 'hit') {
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .3, r = 4 + motion * (e.type === 'kill' ? 24 : 13);
        line(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.x + Math.cos(a) * (r + 4), e.y + Math.sin(a) * (r + 4), color, 2);
      }
    } else if (e.type === 'shot') {
      ellipse(ctx, e.x, e.y, 2 + fade * 5, 2 + fade * 5, '#f4d883');
    } else {
      ellipse(ctx, e.x, e.y, 10 + motion * 19, 5 + motion * 8, null, color, 2);
    }
    ctx.restore();
  }
  function draw(ctx, game, options = {}) {
    if (!ctx || !game) return;
    const board = geometry(game);
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(0, 0, board.width, board.height); ctx.clip();
      ctx.clearRect(0, 0, board.width, board.height); terrain(ctx, game, board);
      const units = game.units || [], slots = game.slots || [];
      const active = options.drag?.moved ? units.find(unit => unit.slot === options.drag.fromSlot) : selectedUnit(game, options);
      if (active) {
        const range = number(statsFor(active).orbitRadius, number(active.range, 52));
        ctx.save(); ctx.setLineDash([4, 5]);
        ellipse(ctx, active.x, active.y, range, range, '#386c4e08', '#577b4d50');
        ctx.restore();
      }
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i], index = Number.isFinite(slot.id) ? slot.id : i;
        const unit = units.find(u => u.slot === index);
        cell(ctx, { ...slot, id: index }, unit, index === active?.slot, dropAction(active, unit), index === options.hoverSlot);
      }
      battlefieldFields(ctx, game, options);
      for (const unit of units) portrait(ctx, unit, options, unit.x, unit.y, options.drag?.moved && options.drag.fromSlot === unit.slot ? .22 : 1, game.elapsed);
      // The route is separate from build slots, so depth order can remain stable.
      for (const e of game.enemies || []) enemy(ctx, e, game, options, board);
      for (const egg of game.supplies || []) supply(ctx, egg, game, options, board);
      for (const unit of units) {
        // Moving the pointer is only a preview; the unit still attacks at its
        // original slot until release, so keep that physical orbit visible.
        ctx.save();
        if (options.drag?.moved && options.drag.fromSlot === unit.slot) ctx.globalAlpha *= .22;
        orbit(ctx, unit, game, options);
        ctx.restore();
      }
      // A dense blade volley must not bury the one-time reveal or feed result.
      // Retain a small priority budget while bounding the total canvas work.
      const allEffects = game.effects || [];
      const reveals = allEffects.filter(e => e.type === 'golden' || e.type === 'feed').slice(-8);
      const reactions = allEffects.filter(e => e.type === 'reaction').slice(-24);
      const ordinary = allEffects.filter(e => !['golden', 'feed', 'reaction'].includes(e.type)).slice(-(96 - reveals.length - reactions.length));
      for (const e of [...ordinary, ...reactions, ...reveals]) effect(ctx, e, options);
      if (options.drag?.moved) {
        const u = units.find(unit => unit.slot === options.drag.fromSlot);
        if (u && Number.isFinite(options.drag.x) && Number.isFinite(options.drag.y)) {
          ellipse(ctx, options.drag.x, options.drag.y + 29, 28, 7, '#213f3128');
          portrait(ctx, u, options, options.drag.x, options.drag.y - 14, .92, game.elapsed);
        }
      }
      // Keep the pending action above portraits, effects and the drag preview.
      // Feeding is directional; a golden hero dragged onto a normal one swaps.
      const hovered = units.find(unit => unit.slot === options.hoverSlot);
      const hoveredSlot = slots.find((slot, index) => (Number.isFinite(slot.id) ? slot.id : index) === options.hoverSlot);
      const action = hoveredSlot && dropAction(active, hovered);
      if (action === 'feed') {
        round(ctx, hovered.x - 29, hovered.y - 51, 58, 15, 4, '#fff0b9', '#b58530', 1);
        text(ctx, `投喂 +${active.level + 1}`, hovered.x, hovered.y - 43, 8, '#694923', '800', 'center');
      } else if (action) {
        const point = hovered || hoveredSlot;
        const label = action === 'swap' ? '⇄ 交换位置' : action === 'merge' ? '合成进化' : '移动到这里';
        const fill = action === 'swap' ? '#367a6b' : action === 'merge' ? '#6f773d' : '#5b8439';
        round(ctx, point.x - 29, point.y - 44, 58, 15, 4, fill, '#fff1d7', .8);
        text(ctx, label, point.x, point.y - 36, 8, '#fff8df', '800', 'center');
      }
      // Bottle bodies overlap in a dense queue. Draw all health labels in a
      // final pass so the following bottle (or its flash) cannot cover them.
      for (const e of game.enemies || []) enemyVitals(ctx, e, board);
      reactionBadges(ctx, reactions, options, board);
      let awakening;
      for (let i = allEffects.length - 1; i >= 0; i--) {
        if (allEffects[i].type === 'golden' && effectTime(allEffects[i]) < 1) { awakening = allEffects[i]; break; }
      }
      if (awakening) goldenReveal(ctx, awakening, options, board);
    } finally { ctx.restore(); }
  }

  const api = Object.freeze({ draw, drawBottle: bottle });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DefenseRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
