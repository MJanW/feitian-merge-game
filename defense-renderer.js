(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./defense-enemies.js') : root.DefenseEnemies;
  const INK = '#1d332f', PAPER = '#fffdf9', ORANGE = '#d45538';
  const TAU = Math.PI * 2;
  const FONT = '"Avenir Next", "PingFang SC", sans-serif';
  const MONO = '"SFMono-Regular", Consolas, monospace';
  const PATH = [{ x: 38, y: -35 }, { x: 38, y: 315 }, { x: 352, y: 315 }, { x: 352, y: 345 }];
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

  function terrain(ctx, game) {
    ctx.fillStyle = '#e9eddf'; ctx.fillRect(0, 0, 400, 650);
    // Two quiet lawns keep the twelve pieces legible, with a route carved into
    // the field rather than an opaque card laid over the whole game.
    ctx.fillStyle = '#eff1e6'; ctx.fillRect(78, 80, 246, 196); ctx.fillRect(76, 355, 244, 172);
    const path = game.path || PATH;
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    roadPath(ctx, path); ctx.strokeStyle = '#bdbea9'; ctx.lineWidth = 64; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#e0d9bf'; ctx.lineWidth = 58; ctx.stroke();
    roadPath(ctx, path); ctx.strokeStyle = '#e9e1cb'; ctx.lineWidth = 48; ctx.stroke();
    for (let y = 38; y < 290; y += 62) chevron(ctx, 38, y, 0);
    for (let x = 96; x < 325; x += 64) chevron(ctx, x, 315, -Math.PI / 2);
    // The hatching lane has its own color and travels upward. Keeping a gap
    // below the gate makes it distinct from the downward enemy route.
    ctx.fillStyle = '#b8cbb6'; ctx.fillRect(321, 375, 62, 275);
    ctx.fillStyle = '#d4e0cc'; ctx.fillRect(324, 378, 56, 272);
    ctx.fillStyle = '#e4ebda'; ctx.fillRect(329, 382, 46, 268);
    for (let y = 400; y < 635; y += 51) chevron(ctx, 352, y, Math.PI, '#92ad8e');
    for (const [x, y, s] of [[90, 49, 1], [311, 118, .8], [309, 262, .8], [88, 280, .8], [150, 79, .7], [293, 79, .8], [13, 381, .8], [39, 464, 1], [30, 539, .9], [110, 557, .8], [229, 539, .7], [302, 570, .8], [220, 609, 1]]) grass(ctx, x, y, s);
    // Small geometric flower beds give direction and scale without blocking play.
    for (const [x, y] of [[321, 53], [28, 423], [279, 577]]) {
      ellipse(ctx, x, y, 10, 4, '#cdd8b9');
      for (let j = 0; j < 4; j++) {
        const px = x + Math.cos(j * 2.2) * 6, py = y - 3 + Math.sin(j * 2.2) * 4;
        ellipse(ctx, px, py, 2.2, 2.2, j % 2 ? '#f5e4a8' : '#e0a17f');
      }
    }
    text(ctx, '入口', 38, 14, 9, '#756d55', '600', 'center');
    text(ctx, '布阵 · 合成 · 守住', 92, 38, 11, '#536957', '600');
    line(ctx, 92, 53, 284, 53, '#b8c4ac');
    text(ctx, 'FEITIAN DEFENSE', 92, 66, 8, '#667863', '500', 'left', MONO);
    ctx.fillStyle = '#3f6559'; ctx.fillRect(320, 340, 64, 8);
    for (let i = 0; i < 5; i++) polygon(ctx, [[324 + i * 12, 340], [330 + i * 12, 340], [325 + i * 12, 348], [319 + i * 12, 348]], '#e7c480');
    ctx.fillStyle = '#264a3f'; ctx.fillRect(318, 335, 6, 20); ctx.fillRect(380, 335, 6, 20);
    text(ctx, '防线', 352, 363, 10, '#365346', '600', 'center');
    // A low source arch suggests that eggs continue emerging from below.
    ellipse(ctx, 352, 644, 27, 10, '#b8cbb6', '#94ad8a');
    ellipse(ctx, 352, 642, 21, 5, '#95b28f');
    text(ctx, '靠右击蛋，召集同伴', 91, 579, 11, '#4d6853', '600');
    text(ctx, '靠左迎敌，守住防线', 91, 598, 11, '#5b705c');
    if (number(game.reserve) > 0) text(ctx, `待入场 ${Math.floor(game.reserve)} · 腾出空位后加入`, 91, 626, 10, '#7d6434');
    else text(ctx, '拖动换位 · 同阶合成', 91, 626, 10, '#6c7a65');
  }

  function selectedUnit(game, options) {
    return (game.units || []).find(unit => unit.slot === options.selectedSlot);
  }
  function cell(ctx, slot, unit, selected, canMerge, hovered) {
    const { x, y } = slot;
    ctx.fillStyle = '#cad1bc'; ctx.fillRect(x - 31, y - 26, 62, 61);
    ctx.fillStyle = unit ? '#fffdf4' : '#e2e7d7'; ctx.fillRect(x - 31, y - 30, 62, 60);
    ctx.strokeStyle = selected ? ORANGE : canMerge ? '#65996c' : '#bdc8b4';
    ctx.lineWidth = selected || canMerge ? 2 : 1;
    ctx.strokeRect(x - 31, y - 30, 62, 60);
    if (hovered) { ctx.fillStyle = canMerge || !unit ? '#95b98c30' : '#d4553820'; ctx.fillRect(x - 30, y - 29, 60, 58); }
    if (!unit) {
      ellipse(ctx, x, y, 2, 2, '#a8b79d');
      text(ctx, String(number(slot.id, 0) + 1).padStart(2, '0'), x - 24, y + 21, 7, '#86957c', '400', 'left', MONO);
    }
    if (selected || canMerge) {
      const color = selected ? ORANGE : '#4f8358';
      for (const side of [-1, 1]) {
        line(ctx, x + side * 35, y - 32, x + side * 35, y - 22, color, 2);
        line(ctx, x + side * 35, y - 32, x + side * 25, y - 32, color, 2);
        line(ctx, x + side * 35, y + 32, x + side * 35, y + 22, color, 2);
        line(ctx, x + side * 35, y + 32, x + side * 25, y + 32, color, 2);
      }
    }
  }

  function getImage(images, info, level) {
    if (!images) return null;
    return typeof images.get === 'function' ? images.get(level) || images.get(info?.image) : images[level];
  }
  function portrait(ctx, unit, options, x = unit.x, y = unit.y, opacity = 1) {
    const levels = Array.isArray(options.levels) ? options.levels : options.levels?.levels || [];
    const info = levels[unit.level + 1] || {}, image = getImage(options.images, info, unit.level);
    const pulse = options.reducedMotion ? 0 : clamp(number(unit.pulse) / .6, 0, 1);
    ctx.save(); ctx.globalAlpha *= opacity; ctx.translate(x, y + 16);
    ellipse(ctx, 1, 1, 22, 5, '#1d332f1c');
    const spring = 1 + Math.sin(pulse * Math.PI) * .08;
    ctx.scale(1 / spring, spring);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const f = info.frame;
      const valid = Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) && f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= image.naturalWidth && f[1] + f[3] <= image.naturalHeight;
      const source = valid ? f : [0, 0, image.naturalWidth, image.naturalHeight];
      const scale = Math.min(58 / source[2], 61 / source[3]);
      const w = source[2] * scale, h = source[3] * scale;
      ctx.drawImage(image, ...source, -w / 2, -h, w, h);
    } else {
      // A deliberate icon placeholder also works offline if one image is missing.
      ctx.fillStyle = info.color || '#d8a37b'; ctx.fillRect(-11, -29, 22, 29);
      ellipse(ctx, 0, -34, 10, 10, '#f2cdad');
      line(ctx, -16, -22, 16, -22, '#50725d', 4);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= opacity;
    ctx.fillStyle = unit.level === 10 ? '#b78b35' : INK; ctx.fillRect(x - 15, y + 21, 30, 14);
    text(ctx, `Lv.${unit.level}`, x, y + 28, 8, PAPER, '600', 'center', MONO);
    ctx.restore();
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
    const isBoss = Boolean(e.boss || e.isBoss), scale = isBoss ? 1.24 : .9;
    const time = number(game.elapsed) * 1000;
    const wobble = options.reducedMotion ? 0 : Math.sin(time / 170 + number(e.id) * 1.7) * .035;
    const hit = clamp(number(e.hit) / .12, 0, 1);
    ellipse(ctx, e.x + 1.5, e.y + 18 * scale, 12 * scale, 4, '#35423222');
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(wobble); ctx.scale(scale, scale);
    bottle(ctx, e.kind, hit); ctx.restore();
    const hp = Math.max(0, Math.ceil(number(e.hp))), ratio = clamp(number(e.hp) / Math.max(1, number(e.maxHp, e.hp)), 0, 1);
    const barY = e.y - 30 * scale, barW = isBoss ? 34 : 27;
    ctx.fillStyle = '#fffdf9ed'; ctx.fillRect(e.x - barW / 2 - 2, barY - 11, barW + 4, 16);
    text(ctx, hp, e.x, barY - 5, 9, '#263c33', '700', 'center', MONO);
    ctx.fillStyle = '#d7dac8'; ctx.fillRect(e.x - barW / 2, barY + 2, barW, 3);
    ctx.fillStyle = ratio < .3 ? ORANGE : data.tint; ctx.fillRect(e.x - barW / 2, barY + 2, barW * ratio, 3);
    if (isBoss) text(ctx, '◆', e.x, barY - 18, 10, '#a77728', '700', 'center');
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
    ctx.strokeStyle = '#b7a683'; ctx.lineWidth = 1.2; ctx.stroke();
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
    if (e.type === 'score' || e.type === 'damage') {
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
        const range = number(active.range, 180 + active.level * 5);
        ctx.save(); ctx.setLineDash([4, 5]);
        ellipse(ctx, active.x, active.y, range, range, '#386c4e08', '#577b4d50');
        ctx.restore();
      }
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i], index = Number.isFinite(slot.id) ? slot.id : i;
        const unit = units.find(u => u.slot === index);
        const mergeable = active && unit && active.id !== unit.id && active.level === unit.level && unit.level < 10;
        cell(ctx, { ...slot, id: index }, unit, index === options.selectedSlot, mergeable, index === options.hoverSlot);
      }
      for (const unit of units) portrait(ctx, unit, options, unit.x, unit.y, options.drag?.moved && options.drag.fromSlot === unit.slot ? .22 : 1);
      // The route is separate from build slots, so depth order can remain stable.
      for (const e of game.enemies || []) enemy(ctx, e, game, options);
      for (const egg of game.supplies || []) supply(ctx, egg, game, options);
      for (const b of game.bullets || []) {
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
        const radius = 2.2 + Math.min(10, number(b.level)) * .15;
        const toSupply = b.targetType === 'supply';
        ellipse(ctx, b.x, b.y, radius + 2, radius + 2, toSupply ? '#8fb98135' : '#f6d77135');
        ellipse(ctx, b.x, b.y, radius, radius, toSupply ? '#608c52' : b.color || '#d45538', '#fff3c5', .8);
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
