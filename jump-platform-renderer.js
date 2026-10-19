(function (root) {
  'use strict';
  const geometry = typeof module !== 'undefined' && module.exports ? require('./jump-platforms.js') : root.JumpPlatforms;
  const PALETTES = {
    parcel: { top: '#dcb57b', light: '#c89a60', dark: '#a57543', rim: '#f1d6aa' },
    cube: { top: '#283e4b', light: '#233844', dark: '#192b37', rim: '#526675' },
    record: { top: '#25303a', light: '#263842', dark: '#111c27', rim: '#4d626b' },
    grass: { top: '#8bbb73', light: '#b08057', dark: '#865e43', rim: '#bfd59a' },
    book: { top: '#dc725a', light: '#f2dfba', dark: '#be5143', rim: '#f3ad8a' },
    kiosk: { top: '#76aba8', light: '#f1dcb0', dark: '#d3b58e', rim: '#b4d4c1' },
    drum: { top: '#f6e1af', light: '#d76852', dark: '#a4423c', rim: '#ffedc7' },
    stone: { top: '#b1bec0', light: '#8d9fa6', dark: '#6c818e', rim: '#d8dfd9' },
    manhole: { top: '#82908d', light: '#667773', dark: '#3f514e', rim: '#c2cdc3' },
  };
  const CUBE_COLORS = ['#ef7355', '#f8cd62', '#62b0ad', '#f2ebd8', '#86b370', '#6c91c4'];
  const TAU = Math.PI * 2;

  function path(ctx, vertices) {
    ctx.beginPath(); ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
  }
  function polygon(ctx, vertices, fill) { path(ctx, vertices); ctx.fillStyle = fill; ctx.fill(); }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function signedArea(vertices) {
    return vertices.reduce((sum, p, i) => { const q = vertices[(i + 1) % vertices.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
  }

  // Each front face has its own local (u, v) map. Its decorative panels stay
  // inside the actual extruded face even on a rotated or narrow block.
  function face(ctx, a, b, depth, color, kind, sideIndex) {
    const point = (u, v) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + depth * v });
    const rect = (u, v, w, h, fill) => polygon(ctx, [point(u, v), point(u + w, v), point(u + w, v + h), point(u, v + h)], fill);
    const stripe = (u1, v1, u2, v2, stroke, width = 1) => { const p = point(u1, v1), q = point(u2, v2); line(ctx, p.x, p.y, q.x, q.y, stroke, width); };
    const vertices = [a, b, point(1, 1), point(0, 1)];
    ctx.save(); path(ctx, vertices); ctx.fillStyle = color; ctx.fill(); ctx.clip();
    switch (kind) {
      case 'parcel': {
        rect(.42, 0, .17, 1, '#e8ca92');
        stripe(.44, 0, .44, 1, '#f6dca5', 1.2);
        rect(.08, .25, .26, .43, '#f8ecd0');
        rect(.105, .3, .13, .045, '#957448');
        for (let i = 0; i < 7; i++) rect(.11 + i * .023, .43, i % 3 === 0 ? .014 : .007, .15, '#7c654c');
        stripe(.73, .65, .73, .3, '#705137', 1.5);
        stripe(.68, .4, .73, .3, '#705137', 1.5); stripe(.78, .4, .73, .3, '#705137', 1.5);
        stripe(.83, .65, .83, .3, '#705137', 1.5);
        stripe(.78, .4, .83, .3, '#705137', 1.5); stripe(.88, .4, .83, .3, '#705137', 1.5);
        stripe(0, .91, 1, .91, '#78573540'); break;
      }
      case 'cube': {
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
          const colorIndex = (row * 2 + col + sideIndex * 3 + 1) % CUBE_COLORS.length;
          rect(col / 3 + .025, row / 3 + .04, .283, .25, CUBE_COLORS[colorIndex]);
        }
        break;
      }
      case 'grass': {
        rect(0, 0, 1, .18, '#689b5d');
        for (let i = 0; i < 9; i++) {
          rect(i / 9, .11, .065, .13 + (i % 3) * .04, '#709d5d');
          const u = .08 + (i * .107) % .84, v = .42 + (i % 3) * .16;
          rect(u, v, .035, .065, i % 2 ? '#d4ac7b' : '#6d503b');
        }
        break;
      }
      case 'book': {
        if (sideIndex % 2) {
          rect(0, 0, 1, 1, '#bd5445');
          stripe(.12, .22, .88, .22, '#edbd7e', 1.4); stripe(.12, .76, .88, .76, '#edbd7e', 1.4);
          rect(.2, .38, .6, .2, '#e6b675');
        } else {
          rect(0, .12, 1, .75, '#f2e4c9');
          for (let i = 0; i < 5; i++) stripe(.025, .23 + i * .12, .98, .23 + i * .12, '#bdae8d', .8);
          rect(0, 0, 1, .1, '#c55d49'); rect(0, .9, 1, .1, '#ab463b');
        }
        break;
      }
      case 'kiosk': {
        rect(0, .03, 1, .24, '#fff0ce');
        for (let i = 0; i < 8; i += 2) rect(i / 8, .03, 1 / 8, .24, '#c5624f');
        rect(.1, .37, .34, .37, '#507d80'); rect(.13, .4, .28, .28, '#b7d5c8');
        stripe(.27, .4, .27, .7, '#426f73', 1.5); stripe(.13, .55, .42, .55, '#426f73', 1.2);
        rect(.62, .34, .23, .66, '#805b46'); rect(.66, .39, .15, .28, '#b8d7cb');
        rect(.67, .76, .025, .04, '#eed59a');
        stripe(0, .95, 1, .95, '#957653', 2); break;
      }
      case 'stone': {
        polygon(ctx, [point(.05, .3), point(.46, .16), point(.32, .9)], '#b9c5c040');
        polygon(ctx, [point(.62, .24), point(.95, .45), point(.77, .97)], '#3b56652b');
        for (let i = 0; i < 6; i++) rect(.12 + (i * .17) % .8, .33 + (i % 3) * .18, .025, .035, '#dce1d49c');
        break;
      }
    }
    ctx.restore();
    line(ctx, a.x, a.y + depth, b.x, b.y + depth, '#293c4130', .8);
  }

  function cylinder(ctx, p, projection, colors) {
    const rx = p.rx, ry = p.ry * projection, depth = p.depth;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(-rx, depth);
    ctx.ellipse(0, depth, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(rx, 0); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI); ctx.closePath();
    const shade = ctx.createLinearGradient(-rx, 0, rx, 0);
    shade.addColorStop(0, colors.light); shade.addColorStop(.45, colors.light); shade.addColorStop(1, colors.dark);
    ctx.fillStyle = shade; ctx.fill(); ctx.clip();
    if (p.kind === 'drum') {
      for (let i = 0; i < 10; i++) {
        const angle = Math.PI * i / 9, x = Math.cos(angle) * rx, y = Math.sin(angle) * ry;
        line(ctx, x, y + 3, x, y + depth - 3, i % 2 ? '#f6cd8b' : '#ffdfaa', 2.5);
        ellipse(ctx, x, y + 5, 2, 2, '#fff0c7'); ellipse(ctx, x, y + depth - 5, 2, 2, '#fff0c7');
      }
      ctx.beginPath(); ctx.ellipse(0, depth - 3, rx, ry, 0, 0, Math.PI);
      ctx.strokeStyle = '#f0c17b'; ctx.lineWidth = 4; ctx.stroke();
    } else if (p.kind === 'manhole') {
      for (const offset of [3, depth - 3]) {
        ctx.beginPath(); ctx.ellipse(0, offset, rx, ry, 0, 0, Math.PI);
        ctx.strokeStyle = offset === 3 ? '#a3b4a9' : '#293e39'; ctx.lineWidth = 2; ctx.stroke();
      }
      for (let i = 1; i < 9; i++) {
        const angle = Math.PI * i / 9, x = Math.cos(angle) * rx, y = Math.sin(angle) * ry;
        line(ctx, x, y + 5, x, y + depth - 5, '#354b46', 1.5);
      }
    } else {
      ctx.beginPath(); ctx.ellipse(0, depth - 2, rx, ry, 0, 0, Math.PI);
      ctx.strokeStyle = '#62737d'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 3, rx, ry, 0, 0, Math.PI);
      ctx.strokeStyle = '#95a3a2'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  function flower(ctx, x, y, scale) {
    line(ctx, x, y, x + 2 * scale, y + 7 * scale, '#4d8557', 1.4 * scale);
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ellipse(ctx, x + Math.cos(a) * 3 * scale, y + Math.sin(a) * 3 * scale, 2 * scale, 2 * scale, '#fff7d6'); }
    ellipse(ctx, x, y, 1.7 * scale, 1.7 * scale, '#dfab46');
  }

  function topDecorations(ctx, p) {
    const x = p.rx, y = p.ry;
    switch (p.kind) {
      case 'parcel': {
        ctx.fillStyle = '#f1d69d'; ctx.fillRect(-x, -y * .16, x * 2, y * .32);
        ctx.fillStyle = '#e8c58a'; ctx.fillRect(-x * .14, -y, x * .28, y * 2);
        line(ctx, -x, -y * .03, x, -y * .03, '#b8915e', 1.1);
        ctx.fillStyle = '#fcf0d3'; ctx.fillRect(x * .28, -y * .72, x * .4, y * .35);
        for (let i = 0; i < 5; i++) line(ctx, x * .34 + i * 2.5, -y * .64, x * .34 + i * 2.5, -y * .47, '#917d5d', i % 2 ? 1 : 1.5);
        break;
      }
      case 'cube': {
        const w = x * 2 / 3, h = y * 2 / 3;
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
          ctx.fillStyle = CUBE_COLORS[(row + col * 2) % CUBE_COLORS.length];
          ctx.fillRect(-x + col * w + 2, -y + row * h + 2, w - 4, h - 4);
        }
        break;
      }
      case 'record': {
        for (let i = 0; i < 7; i++) { const r = x * (.36 + i * .085); ellipse(ctx, 0, 0, r, r, null, i % 2 ? '#53616b' : '#394854', .7); }
        ctx.save(); ctx.globalAlpha *= .32;
        ctx.beginPath(); ctx.arc(0, 0, x * .88, -.95, -.48); ctx.strokeStyle = '#c4d1cc'; ctx.lineWidth = x * .18; ctx.stroke();
        ctx.restore();
        ellipse(ctx, 0, 0, x * .27, x * .27, '#d78564', '#edb58a', 1.5);
        ellipse(ctx, 0, 0, 2.6, 2.6, '#202d36');
        line(ctx, x * .73, -y * .48, x * .52, y * .16, '#cad0bc', 2.7);
        line(ctx, x * .52, y * .16, x * .37, y * .26, '#cad0bc', 2.7);
        ellipse(ctx, x * .73, -y * .48, 4, 4, '#c3b18e', '#eef0d4');
        ctx.fillStyle = '#ebbd79'; ctx.fillRect(x * .31, y * .2, 7, 5); break;
      }
      case 'grass': {
        for (let i = 0; i < 14; i++) {
          const gx = -x * .84 + (i * 17.7) % (x * 1.68), gy = -y * .8 + (i * 23.1) % (y * 1.6);
          line(ctx, gx - 2, gy + 2, gx, gy - 3, '#67995f', 1.2); line(ctx, gx, gy - 3, gx + 2, gy + 2, '#aace87', 1.2);
        }
        flower(ctx, -x * .62, -y * .53, .9); flower(ctx, x * .65, y * .46, .75); flower(ctx, -x * .5, y * .63, .65);
        break;
      }
      case 'book': {
        ctx.fillStyle = '#bf5447'; ctx.fillRect(-x, -y, x * .22, y * 2);
        line(ctx, -x * .71, -y, -x * .71, y, '#f6b888', 1.3);
        ctx.strokeStyle = '#f5c99a'; ctx.lineWidth = 1.3; ctx.strokeRect(-x * .53, -y * .75, x * 1.28, y * 1.5);
        ctx.fillStyle = '#efbf83'; ctx.fillRect(-x * .18, -y * .55, x * .6, y * .08);
        polygon(ctx, [{ x: x * .1, y: -y * .33 }, { x: x * .28, y: -y * .12 }, { x: x * .1, y: y * .09 }, { x: -x * .08, y: -y * .12 }], '#efc892');
        line(ctx, -x * .24, y * .46, x * .46, y * .46, '#f7d4a3', 1.3); break;
      }
      case 'kiosk': {
        ctx.fillStyle = '#51898c'; ctx.fillRect(-x * .88, -y * .86, x * 1.76, y * 1.72);
        ctx.fillStyle = '#82b2a6'; ctx.fillRect(-x * .78, -y * .76, x * 1.56, y * 1.52);
        for (let i = 1; i < 5; i++) line(ctx, -x * .78 + i * x * .31, -y * .76, -x * .78 + i * x * .31, y * .76, '#6a9f98', 1);
        ctx.fillStyle = '#d7dcc1'; ctx.fillRect(-x * .58, -y * .58, x * .4, y * .3);
        for (let i = 0; i < 4; i++) line(ctx, -x * .54 + i * 3, -y * .53, -x * .54 + i * 3, -y * .34, '#879a8f', .8);
        break;
      }
      case 'drum': {
        ellipse(ctx, 0, 0, x * .91, y * .91, '#f8e8bf', '#d5b47a', 1.2);
        ellipse(ctx, 0, 0, x * .72, y * .72, null, '#d4bc8d70', .8);
        for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ellipse(ctx, Math.cos(a) * x * .95, Math.sin(a) * y * .95, 1.5, 1.5, '#c59a61'); }
        break;
      }
      case 'stone': {
        polygon(ctx, [{ x: -x * .7, y: -y * .3 }, { x: -x * .12, y: -y * .74 }, { x: x * .18, y: -y * .24 }, { x: -x * .26, y: y * .03 }], '#cbd2cb');
        polygon(ctx, [{ x: x * .2, y: y * .12 }, { x: x * .78, y: -y * .13 }, { x: x * .48, y: y * .58 }], '#93a5aa');
        for (let i = 0; i < 15; i++) {
          const sx = -x * .78 + (i * 17.3) % (x * 1.56), sy = -y * .74 + (i * 29.7) % (y * 1.48);
          ellipse(ctx, sx, sy, i % 3 === 0 ? 2 : 1.1, i % 3 === 0 ? 1.6 : .8, i % 2 ? '#778d97' : '#e5e6d7');
        }
        break;
      }
      case 'manhole': {
        ellipse(ctx, 0, 0, x * .94, y * .94, '#647972', '#c5d0c5', 1.6);
        ellipse(ctx, 0, 0, x * .8, y * .8, '#83958b', '#425d52', 2.3);
        ellipse(ctx, 0, 0, x * .69, y * .69, '#6b8077', '#b5c4b5', 1.4);
        const grateRadius = x * .67;
        for (let i = -4; i <= 4; i++) {
          const offset = x * .14 * i, reach = Math.sqrt(grateRadius * grateRadius - offset * offset);
          line(ctx, -reach, offset, reach, offset, '#354f45', 2.6);
          line(ctx, -reach, offset - 1, reach, offset - 1, '#a9bca9', .8);
          line(ctx, offset, -reach, offset, reach, '#354f45', 2.6);
          line(ctx, offset + 1, -reach, offset + 1, reach, '#9cb29f', .8);
        }
        for (let i = 0; i < 8; i++) {
          const angle = (i + .5) * TAU / 8;
          const bx = Math.cos(angle) * x * .87, by = Math.sin(angle) * y * .87;
          ellipse(ctx, bx, by, 2.1, 2.1, '#354e43', '#b3c1b0', .6);
        }
        for (const sign of [-1, 1]) {
          ellipse(ctx, sign * x * .76, 0, x * .04, y * .12, '#2d463c', '#b7c6b6', .8);
        }
        break;
      }
    }
  }

  // Only the extrusion compresses: the world-space landing footprint stays
  // unchanged, while the top and everything standing on it move together.
  function deformation(p, compression = 0) {
    const amount = Number.isFinite(compression) ? Math.max(-.03, Math.min(.10, compression)) : 0;
    const topOffset = p.depth * amount;
    return { topOffset, depth: p.depth - topOffset };
  }

  function draw(ctx, p, options = {}) {
    const projection = options.projection ?? .55, cameraY = options.cameraY ?? 0, currentId = options.currentId ?? 0;
    const centerY = p.y * projection + cameraY, colors = PALETTES[p.kind] || PALETTES.stone;
    const local = p.shape === 'circle' ? null : geometry.outline(p);
    const vertices = local?.map(point => ({ x: point.x, y: point.y * projection }));
    if (vertices && signedArea(vertices) < 0) vertices.reverse();
    const bounds = geometry.bounds(p), halfWidth = bounds.width / 2, halfHeight = bounds.height * projection / 2;
    const { topOffset, depth } = deformation(p, options.compression);
    ctx.save();
    try {
      if (p.id > currentId + 1) ctx.globalAlpha *= .84;
      ctx.translate(p.x, centerY);
      // A directional ground shadow anchors the block; its outline cannot be
      // confused with a standable surface because it stays below the top.
      ctx.save(); ctx.shadowColor = '#53665f25'; ctx.shadowBlur = 9; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      if (p.shape === 'circle') ellipse(ctx, 12, p.depth + 12, p.rx * 1.02, p.ry * projection * .86, '#6c786426');
      else polygon(ctx, vertices.map(v => ({ x: v.x + 13, y: v.y + p.depth + 12 })), '#6c786426');
      ctx.restore();
      ctx.translate(0, topOffset);
      if (p.shape === 'circle') cylinder(ctx, { ...p, depth }, projection, colors);
      else {
        let side = 0;
        for (let i = 0; i < vertices.length; i++) {
          const a = vertices[i], b = vertices[(i + 1) % vertices.length];
          if (b.x - a.x < -.01) face(ctx, a, b, depth, b.y < a.y ? colors.light : colors.dark, p.kind, side++);
        }
      }
      if (p.shape === 'circle') { ctx.beginPath(); ctx.ellipse(0, 0, p.rx, p.ry * projection, 0, 0, TAU); }
      else path(ctx, vertices);
      ctx.fillStyle = colors.top; ctx.fill(); ctx.strokeStyle = colors.rim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); ctx.clip();
      const angle = p.angle || 0, c = Math.cos(angle), s = Math.sin(angle);
      ctx.transform(c, s * projection, -s, c * projection, 0, 0);
      topDecorations(ctx, p);
      if (p.id === currentId || p.id === currentId + 1) {
        const next = p.id === currentId + 1;
        ellipse(ctx, 0, 0, 13, 13, next ? '#fff9e6c2' : '#fff9e64d', next ? '#ffffffed' : '#ffffff87', 1.6);
        ellipse(ctx, 0, 0, 2.3, 2.3, p.kind === 'record' ? '#76604a' : '#577e77');
      }
      ctx.restore();
      // Return to the fixed base coordinate system for the next-block label.
      ctx.translate(0, -topOffset);
      if (p.id === currentId + 1) {
        ctx.fillStyle = '#526a68'; ctx.font = '600 11px "Avenir Next","PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('下一座', 0, halfHeight + p.depth + 17, Math.max(44, halfWidth * 2));
      }
    } finally { ctx.restore(); }
  }

  const renderer = { draw, deformation };
  root.JumpPlatformRenderer = renderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = renderer;
})(typeof window !== 'undefined' ? window : globalThis);
