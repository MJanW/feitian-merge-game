(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./defense-enemies.js') : root.DefenseEnemies;
  const INK = '#294329', PAPER = '#fff8dc', ORANGE = '#e98235';
  const engine = () => root.DefenseGame;
  const ABILITY = { normal: '#e7eddf', ice: '#9de6f2', fire: '#ffb44d', lightning: '#f7e76a' };
  const TAU = Math.PI * 2;
  const FONT = '"Avenir Next", "PingFang SC", sans-serif';
  const MONO = '"SFMono-Regular", Consolas, monospace';
  const PATH = [{ x: 32, y: -35 }, { x: 32, y: 315 }, { x: 366, y: 315 }, { x: 366, y: 345 }];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const number = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;

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
  function terrain(ctx, game) {
    ctx.fillStyle = '#86b74d'; ctx.fillRect(0, 0, 400, 650);
    // A continuous lawn, rather than separate card boxes, makes all 24 cells
    // feel like part of the playfield shown in the reference video.
    for (let row = 0; row < 10; row++) for (let col = 0; col < 6; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#9fc85d' : '#a9cf66';
      ctx.fillRect(50 + col * 70, 54 + row * 70, 70, 70);
    }
    const path = game.path || PATH;
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    roadPath(ctx, path); ctx.strokeStyle = '#47733b'; ctx.lineWidth = 63; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#f1e5b7'; ctx.lineWidth = 57; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#85877c'; ctx.lineWidth = 47; ctx.stroke();
    ctx.save(); ctx.setLineDash([10, 12]); roadPath(ctx, path); ctx.strokeStyle = '#eee8cf'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    round(ctx, 341, 373, 51, 288, 18, '#4c773d', '#365d31', 2);
    round(ctx, 346, 378, 41, 282, 15, '#75974e');
    for (let y = 399; y < 635; y += 51) chevron(ctx, 366, y, Math.PI, '#d4dda0');
    // Timber gate between invading bottles and the egg supply lane.
    for (let i = 0; i < 4; i++) {
      const x = 339 + i * 16;
      polygon(ctx, [[x, 352], [x, 332], [x + 6, 324], [x + 12, 332], [x + 12, 352]], '#b77d42', '#644b2f', 2);
      line(ctx, x + 3, 336, x + 3, 348, '#deb16a', 1.5);
    }
    round(ctx, 337, 340, 65, 7, 2, '#865831', '#644b2f', 1.5);
    bush(ctx, 327, 27, 1.1); bush(ctx, 15, 605, 1.2); bush(ctx, 309, 602, .8);
    for (const [x, y] of [[69, 36], [310, 45], [28, 401], [40, 543], [281, 593], [169, 615]]) flower(ctx, x, y);
    round(ctx, 87, 13, 197, 29, 13, '#365e35', '#244a2c', 2);
    text(ctx, '飞刃守卫 · 无限进化', 185, 28, 12, '#fff7d3', '800', 'center');
    round(ctx, 63, 580, 229, 48, 12, '#5c843d', '#3d6b34', 2);
    text(ctx, '左侧迎敌  ·  右侧击蛋', 177, 594, 11, '#fff9da', '700', 'center');
    text(ctx, number(game.reserve) > 0 ? `待命 ${Math.floor(game.reserve)} 位 · 点击空位部署` : '拖动换位 · 同级合成', 177, 614, 10, '#e7edbd', '600', 'center');
    ellipse(ctx, 366, 646, 23, 9, '#314e2d');
    ellipse(ctx, 366, 642, 23, 7, '#bc9b62', '#5b6235', 2);
    ellipse(ctx, 366, 641, 17, 4, '#496c38');
  }

  function selectedUnit(game, options) {
    return (game.units || []).find(unit => unit.slot === options.selectedSlot);
  }
  function cell(ctx, slot, unit, selected, canMerge, hovered) {
    const { x, y } = slot;
    const base = (Math.round(x / 70) + Math.round(y / 70)) % 2 ? '#acd269' : '#9fc85b';
    round(ctx, x - 32, y - 32, 64, 64, 7, selected ? '#dfe88b' : hovered ? '#c4de7a' : base, selected ? '#ffeb81' : canMerge ? '#fcf3bc' : '#759c4690', selected || canMerge ? 3 : 1.2);
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
    if (typeof options.formForLevel === 'function') return options.formForLevel(unit.level) || {};
    const levels = Array.isArray(options.levels) ? options.levels : options.levels?.levels || [];
    const count = Math.max(1, levels.length - 1), photoIndex = unit.level % count;
    return { ...levels[photoIndex + 1], photoIndex, cycle: Math.floor(unit.level / count) };
  }
  function crop(image, frame) {
    const valid = Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite) && frame[0] >= 0 && frame[1] >= 0 && frame[2] > 0 && frame[3] > 0 && frame[0] + frame[2] <= image.naturalWidth && frame[1] + frame[3] <= image.naturalHeight;
    return valid ? frame : [0, 0, image.naturalWidth, image.naturalHeight];
  }
  function portrait(ctx, unit, options, x = unit.x, y = unit.y, opacity = 1) {
    const info = form(unit, options), image = getImage(options.images, info, unit.level);
    const stats = engine()?.statsForLevel?.(unit.level) || {}, ability = stats.ability || 'normal';
    const pulse = options.reducedMotion ? 0 : clamp(number(unit.pulse) / .6, 0, 1);
    ctx.save(); ctx.globalAlpha *= opacity; ctx.translate(x, y + 15);
    ellipse(ctx, 1, 2, 21, 6, '#345d3555', '#d9e5a650', 1);
    const spring = 1 + Math.sin(pulse * Math.PI) * .08;
    ctx.scale(1 / spring, spring);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const source = crop(image, info.frame), scale = Math.min(49 / source[2], 52 / source[3]);
      const w = source[2] * scale, h = source[3] * scale;
      ctx.drawImage(image, ...source, -w / 2, -h, w, h);
    } else {
      round(ctx, -11, -29, 22, 29, 6, info.color || '#dbb071', '#4c613c', 1.5);
      ellipse(ctx, 0, -34, 10, 10, '#f2cdad', '#735e3b', 1.5);
      line(ctx, -16, -22, 16, -22, '#50725d', 4);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= opacity;
    const label = `Lv.${unit.level + 1}`, width = Math.max(32, label.length * 5.1 + 10);
    round(ctx, x - width / 2, y + 19, width, 15, 5, ability === 'normal' ? '#365e35' : '#354c43', ability === 'normal' ? '#d6e59b' : ABILITY[ability], 1.4);
    text(ctx, label, x, y + 27, 8, '#fffce6', '800', 'center', MONO);
    if (ability !== 'normal') {
      round(ctx, x + 15, y - 27, 16, 15, 6, ABILITY[ability], '#406441', 1.2);
      text(ctx, ability === 'ice' ? '❄' : ability === 'fire' ? '炎' : 'ϟ', x + 23, y - 19, 10, '#254e4b', '800', 'center');
    }
    ctx.restore();
  }
  function orbit(ctx, unit, game, options) {
    const blades = engine()?.bladesFor?.(unit, number(game.elapsed)) || [];
    const stats = engine()?.statsForLevel?.(unit.level) || {};
    const ability = stats.ability || 'normal', color = ABILITY[ability] || ABILITY.normal;
    for (const blade of blades) {
      if (![blade.x, blade.y, blade.innerX, blade.innerY, blade.outerX, blade.outerY].every(Number.isFinite)) continue;
      const radius = Math.hypot(blade.x - unit.x, blade.y - unit.y), angle = Math.atan2(blade.y - unit.y, blade.x - unit.x);
      if (!options.reducedMotion) {
        ctx.beginPath(); ctx.arc(unit.x, unit.y, radius, angle - .36, angle);
        ctx.strokeStyle = ability === 'normal' ? '#fff9d840' : color + '65'; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.arc(unit.x, unit.y, radius, angle - .17, angle);
        ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      const dx = blade.outerX - blade.innerX, dy = blade.outerY - blade.innerY, length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length, ny = dx / length, bx = blade.innerX + dx * .25, by = blade.innerY + dy * .25;
      line(ctx, blade.innerX, blade.innerY, bx, by, '#665439', 5.3);
      line(ctx, bx + nx * 5, by + ny * 5, bx - nx * 5, by - ny * 5, '#4d613d', 2.5);
      polygon(ctx, [[bx + nx * 3.5, by + ny * 3.5], [blade.outerX, blade.outerY], [bx - nx * 3.5, by - ny * 3.5]], color, '#355046', 1.4);
      line(ctx, bx, by, blade.outerX, blade.outerY, '#fffef0', 1.2);
      if (ability === 'fire') {
        polygon(ctx, [[bx + nx * 5, by + ny * 5], [bx - dx * .16 + nx * 10, by - dy * .16 + ny * 10], [bx + dx * .35 + nx * 3, by + dy * .35 + ny * 3]], '#f79a3d88');
      } else if (ability === 'lightning') {
        const ex = blade.outerX, ey = blade.outerY;
        line(ctx, ex, ey, ex + nx * 4 - dx * .1, ey + ny * 4 - dy * .1, '#ffed8a', 2);
        line(ctx, ex + nx * 4 - dx * .1, ey + ny * 4 - dy * .1, ex + nx * 6 + dx * .1, ey + ny * 6 + dy * .1, '#fff8c8', 1.5);
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

  function enemy(ctx, e, game, options) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.y < -45 || e.y > 700) return;
    const data = catalog?.byKind?.[e.kind] || { tint: '#c58a39' };
    const isBoss = Boolean(e.boss || e.isBoss), scale = isBoss ? 1.2 : 1;
    const time = number(game.elapsed) * 1000;
    const wobble = options.reducedMotion ? 0 : Math.sin(time / 170 + number(e.id) * 1.7) * .035;
    const hit = clamp(number(e.hit) / .12, 0, 1);
    ellipse(ctx, e.x + 1.5, e.y + 19 * scale, 10 * scale, 4, '#29432944');
    const images = options.enemyImages, image = typeof images?.get === 'function' ? images.get(e.kind) : images?.[e.kind];
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(wobble); ctx.scale(scale, scale);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const source = crop(image, data.frame), ratio = Math.min(21 / source[2], 42 / source[3]);
      const w = source[2] * ratio, h = source[3] * ratio;
      ctx.drawImage(image, ...source, -w / 2, 20 - h, w, h);
      if (hit > 0) ellipse(ctx, 0, 0, w * .7, h * .45, null, `rgba(255,245,161,${hit})`, 2);
    } else { ctx.scale(.7, .85); bottle(ctx, e.kind, hit); }
    if (number(e.slowTime) > 0) ellipse(ctx, 0, 18, 13, 5, '#b4f3ff55', '#d3fbff', 1.5);
    ctx.restore();
    const hp = Math.max(0, Math.ceil(number(e.hp))), ratio = clamp(number(e.hp) / Math.max(1, number(e.maxHp, e.hp)), 0, 1);
    const barY = e.y - 29 * scale, barW = isBoss ? 31 : 25;
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
  function supply(ctx, egg, game, options) {
    if (!Number.isFinite(egg.x) || !Number.isFinite(egg.y) || egg.y < 370 || egg.y > 680) return;
    const ratio = clamp(number(egg.hp) / Math.max(1, number(egg.maxHp, egg.hp)), 0, 1);
    const hit = clamp(number(egg.hit) / .18, 0, 1);
    const sway = options.reducedMotion ? 0 : Math.sin(number(game.elapsed) * 2.5 + number(egg.id)) * .025;
    ellipse(ctx, egg.x + 1, egg.y + 20, 23, 7, '#526e4324');
    ellipse(ctx, egg.x, egg.y + 18, 21, 6, '#b5cd9f', '#9bb58a');
    ctx.save(); ctx.translate(egg.x, egg.y); ctx.rotate(sway);
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

  function effect(ctx, e, options) {
    const t = clamp(number(e.age) / Math.max(.001, number(e.duration, .55)), 0, 1);
    if (t >= 1 || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
    const fade = 1 - t, motion = options.reducedMotion ? .35 : t;
    ctx.save(); ctx.globalAlpha *= fade;
    const color = e.color || e.tint || (e.type === 'leak' ? ORANGE : '#d7ad4a');
    if (e.type === 'slash') {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(number(e.angle));
      ctx.beginPath(); ctx.arc(0, 0, 8 + motion * 13, -.8, 1.05);
      ctx.strokeStyle = ABILITY[e.ability] || '#fff6c1'; ctx.lineWidth = 4 * fade + .5; ctx.stroke(); ctx.restore();
    } else if (e.type === 'fire') {
      const r = number(e.radius, 42) * (.35 + motion * .65);
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
    } else if (e.type === 'score' || e.type === 'damage') {
      text(ctx, e.text || `${e.type === 'score' ? '+' : '−'}${Math.ceil(number(e.value, number(e.amount)))}`, e.x, e.y - 20 - motion * 25, 13, e.type === 'score' ? '#3a6f4a' : ORANGE, '700', 'center', MONO);
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
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(0, 0, 400, 650); ctx.clip();
      ctx.clearRect(0, 0, 400, 650); terrain(ctx, game);
      const units = game.units || [], slots = game.slots || [], active = selectedUnit(game, options);
      if (active) {
        const range = number(engine()?.statsForLevel?.(active.level)?.orbitRadius, number(active.range, 82));
        ctx.save(); ctx.setLineDash([4, 5]);
        ellipse(ctx, active.x, active.y, range, range, '#386c4e08', '#577b4d50');
        ctx.restore();
      }
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i], index = Number.isFinite(slot.id) ? slot.id : i;
        const unit = units.find(u => u.slot === index);
        const mergeable = active && unit && active.id !== unit.id && active.level === unit.level;
        cell(ctx, { ...slot, id: index }, unit, index === options.selectedSlot, mergeable, index === options.hoverSlot);
      }
      for (const unit of units) portrait(ctx, unit, options, unit.x, unit.y, options.drag?.moved && options.drag.fromSlot === unit.slot ? .22 : 1);
      // The route is separate from build slots, so depth order can remain stable.
      for (const e of game.enemies || []) enemy(ctx, e, game, options);
      for (const egg of game.supplies || []) supply(ctx, egg, game, options);
      for (const unit of units) {
        // Moving the pointer is only a preview; the unit still attacks at its
        // original slot until release, so keep that physical orbit visible.
        ctx.save();
        if (options.drag?.moved && options.drag.fromSlot === unit.slot) ctx.globalAlpha *= .22;
        orbit(ctx, unit, game, options);
        ctx.restore();
      }
      for (const e of game.effects || []) effect(ctx, e, options);
      if (options.drag?.moved) {
        const u = units.find(unit => unit.slot === options.drag.fromSlot);
        if (u && Number.isFinite(options.drag.x) && Number.isFinite(options.drag.y)) {
          ellipse(ctx, options.drag.x, options.drag.y + 29, 28, 7, '#213f3128');
          portrait(ctx, u, options, options.drag.x, options.drag.y - 14, .92);
        }
      }
    } finally { ctx.restore(); }
  }

  const api = Object.freeze({ draw, drawBottle: bottle });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DefenseRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
