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
    manhole: Object.freeze({ shape: 'circle', rx: 48, ry: 48, angle: 0, depth: 16 }),
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

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function fraction(area, radius) {
    const value = clamp(area / (Math.PI * radius * radius), 0, 1);
    // Snap only numerical noise, especially the exact 50% straight-edge case.
    for (const boundary of [0, .5, 1]) if (Math.abs(value - boundary) < 1e-12) return boundary;
    return value;
  }

  function circleSegment(angle) {
    // The series avoids cancellation at an almost tangent intersection.
    if (angle < .001) {
      const squared = angle * angle;
      return angle * squared * (2 / 3 + squared * (-2 / 15 + squared * (4 / 315 - squared * 2 / 2835)));
    }
    return angle - Math.sin(angle) * Math.cos(angle);
  }

  function circleOverlap(radius, otherRadius, distance) {
    if (distance >= radius + otherRadius) return 0;
    if (distance <= Math.abs(radius - otherRadius)) return Math.PI * Math.min(radius, otherRadius) ** 2;
    // Half-angle factors retain precision near both internal and external
    // tangency, including platforms much larger than the player's round foot.
    const angle = 2 * Math.asin(Math.sqrt(clamp((otherRadius - distance + radius) * (otherRadius + distance - radius) / (4 * distance * radius), 0, 1)));
    const otherAngle = 2 * Math.asin(Math.sqrt(clamp((radius - distance + otherRadius) * (radius + distance - otherRadius) / (4 * distance * otherRadius), 0, 1)));
    return radius * radius * circleSegment(angle) + otherRadius * otherRadius * circleSegment(otherAngle);
  }

  function circlePolygonOverlap(vertices, x, y, radius) {
    let area = 0;
    const squaredRadius = radius * radius;
    for (let index = 0; index < vertices.length; index++) {
      const a = { x: vertices[index].x - x, y: vertices[index].y - y };
      const b = { x: vertices[(index + 1) % vertices.length].x - x, y: vertices[(index + 1) % vertices.length].y - y };
      const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
      const nearestT = -(a.x * dx + a.y * dy) / lengthSquared;
      const nearestX = a.x + nearestT * dx, nearestY = a.y + nearestT * dy;
      const halfSquared = (squaredRadius - nearestX * nearestX - nearestY * nearestY) / lengthSquared;
      const cuts = [0, 1];
      if (halfSquared > 0) {
        const half = Math.sqrt(halfSquared);
        for (const t of [nearestT - half, nearestT + half]) if (t > 0 && t < 1) cuts.push(t);
      }
      cuts.sort((left, right) => left - right);
      for (let part = 1; part < cuts.length; part++) {
        const from = cuts[part - 1], to = cuts[part];
        const ax = a.x + from * dx, ay = a.y + from * dy;
        const bx = a.x + to * dx, by = a.y + to * dy;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const cross = ax * by - ay * bx;
        // Each directed sub-edge contributes either a triangle within the foot
        // or the corresponding circular sector. The signed sum is exact.
        area += halfSquared > 0 && mx * mx + my * my < squaredRadius ? cross / 2 :
          squaredRadius * Math.atan2(cross, ax * bx + ay * by) / 2;
      }
    }
    return Math.abs(area);
  }

  function polygonEdge(vertices, x, y) {
    let nearest = null, inside = true;
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length];
      const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
      const length = Math.sqrt(lengthSquared);
      const side = dx * (y - a.y) - dy * (x - a.x);
      if (side < 0) inside = false;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSquared, 0, 1);
      const point = { x: a.x + t * dx, y: a.y + t * dy };
      const distanceSquared = (x - point.x) ** 2 + (y - point.y) ** 2;
      const normal = { x: dy / length, y: -dx / length };
      if (!nearest || distanceSquared < nearest.distanceSquared - 1e-12) nearest = { point, normal, distanceSquared };
      else if (Math.abs(distanceSquared - nearest.distanceSquared) <= 1e-12 &&
        Math.hypot(point.x - nearest.point.x, point.y - nearest.point.y) < 1e-8) {
        // At an exact vertex the outward bisector is stable under edge order.
        const nx = nearest.normal.x + normal.x, ny = nearest.normal.y + normal.y, size = Math.hypot(nx, ny);
        if (size > 0) nearest.normal = { x: nx / size, y: ny / size };
      }
    }
    if (nearest.distanceSquared > 1e-20) {
      const sign = inside ? -1 : 1, distance = Math.sqrt(nearest.distanceSquared);
      nearest.normal = { x: sign * (x - nearest.point.x) / distance, y: sign * (y - nearest.point.y) / distance };
    }
    return nearest;
  }

  // The player's footprint is a world-space circle, independent of sprite size
  // or transparent pixels. point is the nearest rim point; normal faces out.
  function support(platform, worldX, worldY, footRadius = 10) {
    const valid = [worldX, worldY, footRadius].every(Number.isFinite) && footRadius >= 0;
    const x = valid ? worldX - platform.x : 0, y = valid ? worldY - platform.y : 0;
    let point, normal, area = 0;
    if (platform.shape === 'circle') {
      const distance = Math.hypot(x, y);
      normal = distance > 0 ? { x: x / distance, y: y / distance } : { x: 1, y: 0 };
      point = { x: normal.x * platform.rx, y: normal.y * platform.rx };
      if (valid && footRadius > 0) area = circleOverlap(footRadius, platform.rx, distance);
    } else {
      const vertices = outline(platform), edge = polygonEdge(vertices, x, y);
      point = edge.point; normal = edge.normal;
      if (valid && footRadius > 0) area = circlePolygonOverlap(vertices, x, y, footRadius);
    }
    // A zero-radius foot degenerates to the existing point-in-platform test.
    const ratio = !valid ? 0 : footRadius === 0 ? Number(contains(platform, worldX, worldY, 0)) : fraction(area, footRadius);
    return { ratio, point: { x: point.x + platform.x, y: point.y + platform.y }, normal };
  }

  function bounds(platform) {
    if (platform.shape === 'circle') return { minX: platform.x - platform.rx, maxX: platform.x + platform.rx,
      minY: platform.y - platform.ry, maxY: platform.y + platform.ry, width: platform.rx * 2, height: platform.ry * 2 };
    const vertices = outline(platform), xs = vertices.map(vertex => vertex.x + platform.x), ys = vertices.map(vertex => vertex.y + platform.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  const api = Object.freeze({ MODELS, createPlatform, outline, contains, support, bounds });
  root.JumpPlatforms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
