(function (root) {
  'use strict';

  const MODELS = Object.freeze({
    parcel: Object.freeze({ shape: 'rect', rx: 50, ry: 41, angle: Math.PI / 4, depth: 43 }),
    cube: Object.freeze({ shape: 'rect', rx: 44, ry: 44, angle: Math.PI / 4, depth: 53 }),
    record: Object.freeze({ shape: 'circle', rx: 49, ry: 49, angle: 0, depth: 19 }),
    grass: Object.freeze({ shape: 'rect', rx: 55, ry: 43, angle: Math.PI / 4, depth: 25 }),
    book: Object.freeze({ shape: 'rect', rx: 60, ry: 31, angle: Math.PI / 4, depth: 20 }),
    kiosk: Object.freeze({ shape: 'rect', rx: 47, ry: 40, angle: Math.PI / 4, depth: 56 }),
    drum: Object.freeze({ shape: 'circle', rx: 46, ry: 46, angle: 0, depth: 42 }),
    stone: Object.freeze({ shape: 'hex', rx: 54, ry: 47, angle: Math.PI / 12, depth: 33 }),
  });
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

  // Local, already rotated vertices; callers add the platform's world centre.
  // Winding is counter-clockwise in mathematical world coordinates.
  function outline(platform) {
    const { rx, ry, angle } = platform;
    let vertices;
    if (platform.shape === 'rect') vertices = [{ x: -rx, y: -ry }, { x: rx, y: -ry }, { x: rx, y: ry }, { x: -rx, y: ry }];
    else {
      const count = platform.shape === 'hex' ? 6 : 64;
      vertices = Array.from({ length: count }, (_, index) => ({ x: rx * Math.cos(index * Math.PI * 2 / count), y: ry * Math.sin(index * Math.PI * 2 / count) }));
    }
    const c = Math.cos(angle), s = Math.sin(angle);
    return vertices.map(vertex => ({ x: vertex.x * c - vertex.y * s, y: vertex.x * s + vertex.y * c }));
  }

  function createPlatform(id, kind, options = {}) {
    const model = MODELS[kind] || MODELS.grass;
    const rx = Math.max(1, finite(options.rx, model.rx));
    const platform = { id, kind: MODELS[kind] ? kind : 'grass', shape: model.shape,
      x: finite(options.x, 0), y: finite(options.y, 0), rx,
      ry: model.shape === 'circle' ? rx : Math.max(1, finite(options.ry, model.ry)),
      angle: model.shape === 'circle' ? 0 : finite(options.angle, model.angle),
      depth: Math.max(0, finite(options.depth, model.depth)) };
    platform.radius = model.shape === 'circle' ? rx : Math.max(...outline(platform).map(vertex => Math.hypot(vertex.x, vertex.y)));
    return platform;
  }

  function contains(platform, worldX, worldY, footRadius = 5) {
    if (![worldX, worldY, footRadius].every(Number.isFinite) || footRadius < 0) return false;
    const x = worldX - platform.x, y = worldY - platform.y;
    if (platform.shape === 'circle') return platform.rx >= footRadius && Math.hypot(x, y) <= platform.rx - footRadius + 1e-7;
    const vertices = outline(platform);
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      // Erode every convex edge by the same round foot radius. A circumscribed
      // circle would accept empty corners of hexagons and miss rectangle tips.
      if (dx * (y - a.y) - dy * (x - a.x) < footRadius * Math.hypot(dx, dy) - 1e-7) return false;
    }
    return true;
  }

  function bounds(platform) {
    if (platform.shape === 'circle') return { minX: platform.x - platform.rx, maxX: platform.x + platform.rx,
      minY: platform.y - platform.ry, maxY: platform.y + platform.ry, width: platform.rx * 2, height: platform.ry * 2 };
    const vertices = outline(platform), xs = vertices.map(vertex => vertex.x + platform.x), ys = vertices.map(vertex => vertex.y + platform.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  const api = Object.freeze({ MODELS, createPlatform, outline, contains, bounds });
  root.JumpPlatforms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
