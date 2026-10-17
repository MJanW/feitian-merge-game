(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 120;
  const CHARGE_MS = 1200, DISTANCE_PER_MS = 0.23, FOOT_RADIUS = 10, PROJECTION = 0.55;
  const Platforms = root.JumpPlatforms || (typeof require === 'function' ? require('./jump-platforms.js') : null);
  let PlatformRenderer = root.JumpPlatformRenderer;
  if (!PlatformRenderer && typeof require === 'function') {
    try { PlatformRenderer = require('./jump-platform-renderer.js'); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  const KINDS = Object.keys(Platforms.MODELS);
  const BONUS_WAIT_MS = 2000;
  const FALL_SECONDS = 0.54, DRIFT_SECONDS = 0.025;
  const EDGE_HOLD_SECONDS = 0.12, EDGE_TIP_SECONDS = 0.3;
  const BONUSES = Object.freeze({
    manhole: Object.freeze({ points: 5, label: '井盖' }),
    cube: Object.freeze({ points: 10, label: '魔方' }),
    kiosk: Object.freeze({ points: 15, label: '便利店' }),
    record: Object.freeze({ points: 30, label: '唱片' }),
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = t => t * t * (3 - 2 * t);
  const projectedDistance = (x, y) => Math.hypot(x, y * PROJECTION);

  function evolutionForScore(value) {
    const score = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const evolutions = Math.floor(score / 200), levelIndex = evolutions % 12, remainder = score % 200;
    return { levelIndex, photoNumber: levelIndex - 1, cycle: Math.floor(evolutions / 12) + 1,
      evolutions, fractionToNext: remainder / 200, pointsToNext: 200 - remainder };
  }

  class JumpGame {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.ctx = this.canvas?.getContext('2d') || null;
      this.levels = Array.isArray(options.levels) ? options.levels : [];
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onChange = options.onChange || (() => {});
      this.onEvent = options.onEvent || (() => {});
      this.onComplete = options.onComplete || (() => {});
      this.reducedMotion = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      this.visibleHeight = HEIGHT; this.cssWidth = WIDTH; this.cssHeight = HEIGHT;
      this.images = new Map(); this.destroyed = false;
      if (typeof root.Image === 'function') for (const level of this.levels) {
        if (!level?.image || this.images.has(level.image)) continue;
        const image = new root.Image(); this.images.set(level.image, image);
        image.onload = () => { if (!this.destroyed) this.render(); };
        image.src = level.image;
      }
      this.reset();
      if (this.ctx && typeof root.requestAnimationFrame === 'function') {
        const frame = now => {
          if (this.destroyed) return;
          const delta = this.lastFrame === null ? 0 : clamp(now - this.lastFrame, 0, 50);
          this.lastFrame = now; this.step(delta); if (!this.isPaused) this.render();
          this.raf = root.requestAnimationFrame(frame);
        };
        this.raf = root.requestAnimationFrame(frame);
      }
    }

    reset() {
      if (this.destroyed) return;
      this.status = 'ready'; this.phase = 'idle'; this.isPaused = false;
      this.score = 0; this.hops = 0; this.combo = 0; this.chargeMs = 0; this.chargeRemainderStart = 0;
      this.elapsed = 0; this.accumulator = 0; this.lastFrame = null;
      this.currentId = 0; this.lastPoints = 0; this.lastPerfect = false;
      this.bonusIdleMs = 0;
      this.player = { x: 125, y: 0, z: 0 };
      this.platforms = [Platforms.createPlatform(0, 'grass', { x: 125, y: 0 })];
      this.platforms.push(Platforms.createPlatform(1, 'parcel', { x: 275, y: -Math.sqrt(240 * 240 - 150 * 150) }));
      this._appendPlatform(); this._appendPlatform();
      this.cameraY = this._cameraAnchor(); this.cameraFrom = this.cameraY; this.cameraTo = this.cameraY; this.cameraTime = 0.4;
      this.jump = null; this.fall = null; this.teeter = null; this.fallTime = 0;
      this.squeeze = 0; this.squeezeVelocity = 0;
      this.landingPulse = 0; this.evolutionPulse = 0;
      this.effects = []; this.completed = false; this._notify(true); this.render();
    }

    _roll() {
      const value = this.random();
      return Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
    }

    _appendPlatform() {
      const previous = this.platforms[this.platforms.length - 1], id = previous.id + 1;
      const difficulty = Math.min(1, id / 120);
      const alternatives = KINDS.length - 1;
      const kind = id === 2 ? 'record' : id === 3 ? 'cube' : KINDS[(KINDS.indexOf(previous.kind) + 1 + Math.min(alternatives - 1, Math.floor(this._roll() * alternatives))) % KINDS.length];
      const model = Platforms.MODELS[kind];
      const size = id === 2 ? 0.69 : id === 3 ? 1.1 : [0.68, 0.82, 0.96, 1.1, 1.22][(id + Math.floor(this._roll() * 5)) % 5] * (1 - difficulty * 0.055);
      const angle = model.shape === 'circle' ? 0 : model.angle + (this._roll() - 0.5) * 0.32;
      const depth = clamp(model.depth + (this._roll() - 0.5) * 12, 18, 60);
      const gapGroup = (id + Math.floor(this._roll() * 3)) % 3;
      const requestedDistance = [165, 215, 270][gapGroup] + this._roll() * 20;
      const preferredX = 75 + this._roll() * 250;
      const oldBounds = Platforms.bounds(previous);
      const previousOutline = Platforms.outline(previous);
      const reachable = CHARGE_MS * DISTANCE_PER_MS - 2;
      const maximum = Math.min(290, 354 - previous.radius);
      let best = null;
      // Search a small deterministic fan instead of rejecting random samples
      // indefinitely. Broad size changes persist late in a run. If a large
      // roof leaves little room, shrink only the next prop until it fits.
      for (let attempt = 0; attempt < 7 && !best; attempt++) {
        const shrink = Math.pow(0.88, attempt);
        const platform = Platforms.createPlatform(id, kind, {
          rx: clamp(model.rx * size * shrink, 28, model.shape === 'circle' ? 63 : 65),
          ry: clamp(model.ry * size * shrink, 27, 50), angle,
          depth: Math.max(18, depth * Math.pow(0.9, attempt)),
        });
        const local = Platforms.bounds(platform), minimum = Math.max(160, previous.radius + platform.radius + 18);
        const desired = clamp(requestedDistance, minimum, maximum);
        const distances = [desired, ...Array.from({ length: 13 }, (_, index) => minimum + (maximum - minimum) * index / 12)];
        for (const distance of distances) for (let direction = -12; direction <= 12; direction++) {
          const theta = direction * Math.PI / 32;
          const dx = Math.sin(theta) * distance, dy = -Math.cos(theta) * distance;
          const x = previous.x + dx, y = previous.y + dy;
          if (-dy < 110 || x + local.minX < 14 || x + local.maxX > WIDTH - 14) continue;
          // Screen distance, not unprojected world distance, determines charge.
          // Every stable foot centre lies inside this convex top. Checking its
          // complete outline plus a margin also bounds circular sampling error.
          if (previousOutline.some(vertex => projectedDistance(dx - vertex.x, dy - vertex.y) > reachable)) continue;
          // Bodies extend down from their top. Separation is checked after
          // projection, including depth, so a tall prop cannot cover a top.
          const horizontallyClear = x + local.minX >= oldBounds.maxX + 8 || x + local.maxX <= oldBounds.minX - 8;
          const verticallyClear = (y + local.maxY) * PROJECTION + platform.depth <= oldBounds.minY * PROJECTION - 8;
          if (!horizontallyClear && !verticallyClear) continue;
          if (Math.abs(dx) < 55 && -dy * PROJECTION < 125) continue;
          const cost = Math.abs(distance - desired) * 1.6 + Math.abs(x - preferredX) * 0.35;
          if (!best || cost < best.cost) best = { ...platform, x, y, cost };
        }
      }
      if (!best) throw new Error('No reachable jump platform fits the board');
      delete best.cost; this.platforms.push(best);
    }

    _current() { return this.platforms.find(platform => platform.id === this.currentId); }
    _next() { return this.platforms.find(platform => platform.id === this.currentId + 1); }

    _cameraAnchor() {
      // Keep the default composition while leaving room above the player for
      // a full jump arc on shorter, wider phone boards.
      return Math.max(this.visibleHeight * 465 / HEIGHT, Math.min(245, this.visibleHeight - 80));
    }

    startCharge() {
      if (this.destroyed || this.isPaused || this.status === 'lost' || this.phase !== 'idle') return false;
      this.status = 'playing'; this.phase = 'charging'; this.chargeMs = 0;
      this.chargeRemainderStart = this.accumulator;
      this.bonusIdleMs = 0;
      this._notify(true); return true;
    }

    releaseCharge() {
      if (this.destroyed || this.isPaused || this.phase !== 'charging') return false;
      const next = this._next(), dx = next.x - this.player.x, dy = next.y - this.player.y;
      const distanceToTarget = projectedDistance(dx, dy), distance = this._heldCharge() * DISTANCE_PER_MS;
      this.jump = { fromX: this.player.x, fromY: this.player.y,
        toX: this.player.x + dx / distanceToTarget * distance,
        toY: this.player.y + dy / distanceToTarget * distance,
        time: 0, duration: 0.3 + distance / 1000,
        height: this.reducedMotion ? 54 : 56 + distance * 0.18,
        direction: dx < 0 ? -1 : 1 };
      this.jump.stableLanding = this._landingAt(this.jump.toX, this.jump.toY).ratio >= 0.5;
      this.teeter = null;
      this.phase = 'jumping'; this.chargeMs = 0;
      this._event('jump', { distance, duration: this.jump.duration });
      this._notify(true); return true;
    }

    cancelCharge() {
      if (this.destroyed || this.phase !== 'charging') return false;
      this.phase = 'idle'; this.chargeMs = 0; this._notify(true); return true;
    }

    _heldCharge() {
      // Include time since the final fixed physics tick, excluding the idle
      // remainder from before press-down. Fast releases should not lose a frame.
      return clamp(this.chargeMs + this.accumulator - this.chargeRemainderStart, 0, CHARGE_MS);
    }

    pause(paused = true) {
      if (this.destroyed) return;
      this.isPaused = Boolean(paused); this.lastFrame = null;
      if (this.isPaused && this.phase === 'charging') { this.phase = 'idle'; this.chargeMs = 0; }
      this._notify(true);
    }

    _event(type, detail = {}) { this.onEvent({ type, ...detail }); }

    _evolveFrom(previousScore) {
      const before = evolutionForScore(previousScore), after = evolutionForScore(this.score);
      if (after.evolutions <= before.evolutions) return;
      this.evolutionPulse = 0.85;
      this._event('evolve', { ...after, score: this.score });
    }

    _waitForBonus(milliseconds) {
      const platform = this._current(), bonus = BONUSES[platform.kind];
      if (this.status !== 'playing' || this.phase !== 'idle' || this.currentId === 0 || !bonus || platform.bonusClaimed) return;
      this.bonusIdleMs = Math.min(BONUS_WAIT_MS, this.bonusIdleMs + milliseconds);
      if (this.bonusIdleMs < BONUS_WAIT_MS - 1e-7) return;
      // The receipt belongs to this platform, so hopping on it again or
      // leaving/revisiting cannot repeatedly collect its waiting reward.
      platform.bonusClaimed = true; this.bonusIdleMs = BONUS_WAIT_MS;
      const previousScore = this.score;
      this.score += bonus.points;
      this.effects.push({ x: this.player.x, y: this.player.y, age: 0, points: bonus.points, perfect: false });
      this.effects = this.effects.slice(-6);
      this._event('bonus', { points: bonus.points, kind: platform.kind, score: this.score });
      this._evolveFrom(previousScore);
      this._notify(true);
    }

    _landingAt(x, y) {
      const next = this._next(), current = this._current();
      const ahead = Platforms.support(next, x, y, FOOT_RADIUS);
      const behind = Platforms.support(current, x, y, FOOT_RADIUS);
      return ahead.ratio >= behind.ratio ? { ...ahead, platform: next } : { ...behind, platform: current };
    }

    _startFall(edge = false) {
      const flight = this.jump;
      this.fall = { x: this.player.x, y: this.player.y, z: this.player.z,
        vx: edge ? this.teeter.normal.x * 55 : flight ? (flight.toX - flight.fromX) / flight.duration : 0,
        vy: edge ? this.teeter.normal.y * 55 : flight ? (flight.toY - flight.fromY) / flight.duration : 0,
        speed: edge ? 150 : flight ? 4 * flight.height / flight.duration : 400,
        gravity: edge ? 1200 : flight ? 8 * flight.height / (flight.duration * flight.duration) : 1600,
        edge, angle: edge ? this.teeter.angle : 0,
        normal: edge ? this.teeter.normal : null };
      this.phase = 'falling'; this.fallTime = 0; this.combo = 0;
    }

    _stepTeeter(dt) {
      const edge = this.teeter;
      edge.time = Math.min(EDGE_HOLD_SECONDS + EDGE_TIP_SECONDS, edge.time + dt);
      const progress = clamp((edge.time - EDGE_HOLD_SECONDS) / EDGE_TIP_SECONDS, 0, 1);
      // Keep the foot still briefly, then rotate the entire character around
      // its contact edge. The final outward slide releases that support.
      edge.angle = this.reducedMotion ? 0 : 1.25 * progress * progress;
      const dx = edge.x - edge.point.x, dy = edge.y - edge.point.y;
      const radial = dx * edge.normal.x + dy * edge.normal.y;
      const shift = radial * (Math.cos(edge.angle) - 1) + 13 * progress ** 3;
      this.player.x = edge.x + edge.normal.x * shift;
      this.player.y = edge.y + edge.normal.y * shift;
      this.player.z = edge.angle ? -radial * Math.sin(edge.angle) : 0;
      if (edge.time >= EDGE_HOLD_SECONDS + EDGE_TIP_SECONDS) this._startFall(true);
    }

    _land() {
      const next = this._next(), support = this._landingAt(this.player.x, this.player.y);
      this.player.z = 0;
      this.bonusIdleMs = 0;
      if (support.ratio < 0.5) {
        this.combo = 0; this.lastPoints = 0; this.lastPerfect = false; this.landingPulse = 0;
        if (support.ratio > 1e-7) {
          this.phase = 'teetering';
          this.teeter = { x: this.player.x, y: this.player.y, time: 0, angle: 0,
            point: support.point, normal: support.normal, platformId: support.platform.id };
          if (!this.reducedMotion) this.squeezeVelocity += 1.5;
        } else this._startFall();
        return;
      }
      this.phase = 'idle'; this.landingPulse = 0.32;
      // An impact adds velocity to the same spring used for charging/takeoff;
      // the pose itself never snaps to a different scale at a phase boundary.
      if (!this.reducedMotion) this.squeezeVelocity += 3.4;
      if (support.platform.id !== next.id) {
        this.combo = 0; this.lastPoints = 0; this.lastPerfect = false;
        this._event('land', { points: 0, perfect: false, samePlatform: true, score: this.score });
        return;
      }
      const previousScore = this.score;
      const perfect = Math.hypot(this.player.x - next.x, this.player.y - next.y) <= 13;
      this.combo = perfect ? this.combo + 1 : 0;
      const points = perfect ? Math.min(this.combo, 16) * 2 : 1;
      this.score += points; this.hops += 1; this.currentId = next.id;
      this.lastPoints = points; this.lastPerfect = perfect;
      this.effects.push({ x: this.player.x, y: this.player.y, age: 0, points, perfect });
      this.effects = this.effects.slice(-6);
      this.cameraFrom = this.cameraY; this.cameraTo = this._cameraAnchor() - next.y * PROJECTION; this.cameraTime = 0;
      // Keep two old platforms and three ahead; score, not an ever-growing
      // visited set, remembers the journey. Collision only uses current/next.
      this.platforms = this.platforms.filter(platform => platform.id >= this.currentId - 2);
      while (this.platforms[this.platforms.length - 1].id < this.currentId + 3) this._appendPlatform();
      this._event('land', { points, perfect, samePlatform: false, score: this.score, hops: this.hops });
      if (perfect) this._event('perfect', { points, combo: this.combo, score: this.score });
      this._evolveFrom(previousScore);
    }

    _finish() {
      if (this.completed) return;
      this.completed = true; this.status = 'lost'; this.phase = 'falling';
      this._notify(true); this._event('lose', { score: this.score, hops: this.hops });
      this.onComplete(this.getState());
    }

    _stepPose(dt) {
      if (this.reducedMotion) { this.squeeze = 0; this.squeezeVelocity = 0; return; }
      const charge = clamp(this.chargeMs - this.chargeRemainderStart, 0, CHARGE_MS);
      let target = this.phase === 'charging' ? 0.04 * (1 - Math.exp(-charge / 55)) + charge / CHARGE_MS * 0.24 : 0;
      if (this.phase === 'jumping') {
        const lift = clamp(this.jump.time / this.jump.duration / 0.32, 0, 1);
        target = -0.15 * Math.sin(lift * Math.PI);
      }
      this.squeezeVelocity += ((target - this.squeeze) * 260 - this.squeezeVelocity * 16) * dt;
      this.squeeze = clamp(this.squeeze + this.squeezeVelocity * dt, -0.2, 0.3);
    }

    step(milliseconds = STEP_MS) {
      if (this.destroyed || this.isPaused || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      this.accumulator += milliseconds;
      while (this.accumulator + 1e-7 >= STEP_MS) {
        this.accumulator = Math.max(0, this.accumulator - STEP_MS);
        const dt = STEP_MS / 1000;
        if (this.status === 'playing') this.elapsed += dt;
        this.landingPulse = Math.max(0, this.landingPulse - dt);
        this.evolutionPulse = Math.max(0, this.evolutionPulse - dt);
        for (const effect of this.effects) effect.age += dt;
        this.effects = this.effects.filter(effect => effect.age < 0.9);
        this.cameraTime = Math.min(0.4, this.cameraTime + dt);
        this.cameraY = this.cameraFrom + (this.cameraTo - this.cameraFrom) * smooth(this.cameraTime / 0.4);
        if (this.status === 'lost') continue;
        if (this.phase === 'charging') this.chargeMs = Math.min(CHARGE_MS + this.chargeRemainderStart, this.chargeMs + STEP_MS);
        else if (this.phase === 'jumping') {
          this.jump.time += dt;
          const progress = Math.min(1, this.jump.time / this.jump.duration);
          this.player.x = this.jump.fromX + (this.jump.toX - this.jump.fromX) * progress;
          this.player.y = this.jump.fromY + (this.jump.toY - this.jump.fromY) * progress;
          // The same arc has an explicit downward velocity at touchdown. A
          // missed platform continues this trajectory instead of restarting
          // from rest below the platform plane.
          this.player.z = 4 * this.jump.height * progress * (1 - progress);
          if (progress >= 1) this._land();
        } else if (this.phase === 'teetering') {
          this._stepTeeter(dt);
        } else if (this.phase === 'falling') {
          this.fallTime = Math.min(FALL_SECONDS, this.fallTime + dt);
          const t = this.fallTime, drift = DRIFT_SECONDS * (1 - Math.exp(-t / DRIFT_SECONDS));
          this.player.x = this.fall.x + this.fall.vx * drift;
          this.player.y = this.fall.y + this.fall.vy * drift;
          this.player.z = this.fall.z - this.fall.speed * t - this.fall.gravity * t * t / 2;
          if (this.fallTime >= FALL_SECONDS) this._finish();
        } else if (this.phase === 'idle') this._waitForBonus(STEP_MS);
        this._stepPose(dt);
      }
      this._notify();
    }

    getState() {
      const next = this._next(), current = this._current(), bonus = BONUSES[current.kind];
      const unclaimed = Boolean(bonus && this.currentId > 0 && !current.bonusClaimed);
      return { status: this.status, phase: this.phase, isPaused: this.isPaused,
        score: this.score, hops: this.hops, combo: this.combo, charge: this.phase === 'charging' ? this._heldCharge() / CHARGE_MS : 0,
        ...evolutionForScore(this.score), lastPoints: this.lastPoints, lastPerfect: this.lastPerfect,
        bonusPoints: bonus?.points || 0, bonusLabel: bonus?.label || '',
        bonusAvailable: unclaimed && this.status === 'playing' && this.phase === 'idle',
        bonusRemainingMs: unclaimed ? Math.max(0, BONUS_WAIT_MS - this.bonusIdleMs) : 0,
        canBufferCharge: this.status === 'playing' && this.phase === 'jumping' && !this.isPaused &&
          Boolean(this.jump?.stableLanding) && this.jump.duration - this.jump.time <= 0.12 + 1e-7,
        nextDistance: projectedDistance(next.x - this.player.x, next.y - this.player.y) };
    }

    _notify(force = false) {
      const state = this.getState();
      const signature = JSON.stringify({ ...state, charge: Math.round(state.charge * 100), bonusRemainingMs: Math.ceil(state.bonusRemainingMs / 100) * 100, nextDistance: undefined });
      if (force || signature !== this.stateSignature) { this.stateSignature = signature; this.onChange(state); }
    }

    _ellipse(x, y, rx, ry) {
      this.ctx.beginPath(); this.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    }

    _platform(platform) {
      const y = platform.y * PROJECTION + this.cameraY;
      if (y < -150 || y > this.visibleHeight + 100) return;
      const renderer = root.JumpPlatformRenderer || PlatformRenderer;
      if (renderer) renderer.draw(this.ctx, platform, { cameraY: this.cameraY, projection: PROJECTION, currentId: this.currentId });
    }

    _flipSprite(centerY) {
      if (this.reducedMotion) return;
      let angle;
      if (this.phase === 'jumping') {
        const progress = this.jump.time / this.jump.duration;
        angle = this.jump.direction * Math.PI * 2 * smooth(clamp((progress - 0.08) / 0.82, 0, 1));
      } else if (this.phase === 'falling' && this.fallTime > 0) {
        if (this.fall?.edge) return; // The inherited edge rotation is around the foot.
        angle = (this.jump?.direction || 1) * 0.7 * smooth(clamp(this.fallTime / 0.42, 0, 1));
      } else return;
      // Rotate around the visible sprite's centre rather than its feet, so the
      // somersault follows the same jump arc without swinging in a wide orbit.
      this.ctx.translate(0, centerY);
      this.ctx.rotate(angle);
      this.ctx.translate(0, -centerY);
    }

    _sprite() {
      const ctx = this.ctx, state = this.getState(), info = this.levels[state.levelIndex] || {};
      const image = this.images.get(info.image), screenY = this.player.y * PROJECTION + this.cameraY;
      const falling = this.phase === 'falling';
      const alpha = falling ? 1 - smooth(clamp((this.fallTime - 0.24) / (FALL_SECONDS - 0.24), 0, 1)) : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      if (!falling && this.phase !== 'teetering') {
        ctx.fillStyle = '#65566628';
        const shadow = clamp(1 - this.player.z / 220, 0.35, 1);
        this._ellipse(this.player.x, screenY + 1.2, 9 * shadow, 3.6 * shadow); ctx.fill();
      }
      ctx.translate(this.player.x, screenY - this.player.z);
      if (!this.reducedMotion && (this.phase === 'teetering' || falling && this.fall?.edge)) {
        const edge = this.phase === 'teetering' ? this.teeter : this.fall;
        const angle = edge.angle + (falling ? .4 * smooth(clamp(this.fallTime / .42, 0, 1)) : 0);
        // Project a forward/backward or sideways fall in the actual outward
        // direction. A near-vertical jump should not inexplicably topple left.
        const { x: nx, y: ny } = edge.normal, c = Math.cos(angle), s = Math.sin(angle);
        ctx.transform(ny * ny + nx * nx * c, PROJECTION * nx * ny * (c - 1) + nx * s,
          -nx * s, c - ny * PROJECTION * s, 0, 0);
      }
      if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const f = info.frame;
        const valid = Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) && f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= image.naturalWidth && f[1] + f[3] <= image.naturalHeight;
        const source = valid ? f : [0, 0, image.naturalWidth, image.naturalHeight];
        const scale = Math.min(43.2 / source[2], 49.2 / source[3]);
        const w = source[2] * scale, h = source[3] * scale;
        this._flipSprite(-h * (this.reducedMotion ? 1 : 1 - this.squeeze) / 2);
        this._foot();
        if (!this.reducedMotion) ctx.scale(1 + this.squeeze * 0.7, 1 - this.squeeze);
        ctx.shadowColor = '#63535e30'; ctx.shadowBlur = 2.4; ctx.shadowOffsetY = 1.2;
        ctx.drawImage(image, ...source, -w / 2, -h, w, h);
      } else {
        this._flipSprite(-14.4 * (this.reducedMotion ? 1 : 1 - this.squeeze));
        this._foot();
        if (!this.reducedMotion) ctx.scale(1 + this.squeeze * 0.7, 1 - this.squeeze);
        ctx.fillStyle = info.color || '#a9d8e6'; ctx.beginPath(); ctx.arc(0, -14.4, 13.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4c525b'; ctx.font = 'bold 8.8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(state.photoNumber), 0, -11.4);
      }
      ctx.restore();
    }

    _foot() {
      const ctx = this.ctx;
      ctx.fillStyle = '#fff7e8'; ctx.strokeStyle = '#7c6f62'; ctx.lineWidth = 1.2;
      this._ellipse(0, 0, FOOT_RADIUS, FOOT_RADIUS * PROJECTION); ctx.fill(); ctx.stroke();
    }

    render() {
      if (!this.ctx || this.destroyed) return;
      const ctx = this.ctx, rect = this.canvas.getBoundingClientRect?.();
      if (Number.isFinite(rect?.width) && rect.width > 0 && (rect.height === undefined || Number.isFinite(rect.height) && rect.height > 0)) {
        const cssHeight = Number.isFinite(rect.height) && rect.height > 0 ? rect.height : rect.width * HEIGHT / WIDTH;
        const oldAnchor = this._cameraAnchor();
        this.cssWidth = rect.width; this.cssHeight = cssHeight;
        this.visibleHeight = cssHeight / rect.width * WIDTH;
        const shift = this._cameraAnchor() - oldAnchor;
        // Preserve camera interpolation and the entire world simulation when
        // orientation/browser chrome changes the board's available height.
        this.cameraY += shift; this.cameraFrom += shift; this.cameraTo += shift;
      }
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      const width = Math.max(1, Math.round(this.cssWidth * dpr)), height = Math.max(1, Math.round(this.cssHeight * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      ctx.setTransform(width / WIDTH, 0, 0, width / WIDTH, 0, 0);
      ctx.clearRect(0, 0, WIDTH, this.visibleHeight + 1);
      const sky = ctx.createLinearGradient(0, 0, 0, this.visibleHeight);
      sky.addColorStop(0, '#f1e9e3'); sky.addColorStop(0.55, '#fbf4e8'); sky.addColorStop(1, '#e9eee7');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, this.visibleHeight + 1);
      ctx.fillStyle = '#ffffff70';
      for (const [x, y, r] of [[38, 120, 48], [360, 220, 66], [60, 360, 40], [320, 565, 65]]) {
        this._ellipse(x, y * this.visibleHeight / HEIGHT, r, r * 0.28); ctx.fill();
      }
      ctx.strokeStyle = '#d5cfc566'; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const x = 25 + (i * 113) % 355, y = (85 + (i * 83) % 475) * this.visibleHeight / HEIGHT;
        ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
      }
      const current = this._current(), next = this._next();
      ctx.strokeStyle = '#9f94874d'; ctx.lineWidth = 2; ctx.setLineDash([3, 8]);
      ctx.beginPath(); ctx.moveTo(current.x, current.y * PROJECTION + this.cameraY);
      ctx.lineTo(next.x, next.y * PROJECTION + this.cameraY); ctx.stroke(); ctx.setLineDash([]);
      // Keep the opening instructions clear; reveal distant scenery on the
      // first charge, when the introduction disappears.
      let spriteDrawn = false;
      for (const platform of [...this.platforms].sort((a, b) => a.y - b.y)) {
        // Once below the top plane, foreground props occlude the falling
        // character. Drawing it over every prop made it pass through solid tops.
        if (!spriteDrawn && (this.phase === 'falling' || this.phase === 'teetering' && this.player.z < 0) && platform.y >= this.player.y) {
          this._sprite(); spriteDrawn = true;
        }
        if (this.status !== 'ready' || platform.id <= 2) this._platform(platform);
      }
      if (!this.reducedMotion && this.landingPulse > 0) {
        ctx.strokeStyle = '#b18a6177'; ctx.lineWidth = 2;
        const r = 18 + (0.32 - this.landingPulse) * 110;
        this._ellipse(this.player.x, this.player.y * PROJECTION + this.cameraY, r, r * PROJECTION); ctx.stroke();
      }
      if (!spriteDrawn) this._sprite();
      for (const effect of this.effects) {
        ctx.save(); ctx.globalAlpha = 1 - effect.age / 0.9;
        ctx.fillStyle = effect.perfect ? '#9d6c3d' : '#6b8072'; ctx.font = 'bold 23px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(`+${effect.points}`, effect.x, effect.y * PROJECTION + this.cameraY - 66 - (this.reducedMotion ? 0 : effect.age * 35));
        ctx.restore();
      }
      if (this.evolutionPulse > 0) {
        ctx.save(); ctx.globalAlpha = Math.min(1, this.evolutionPulse * 4);
        ctx.fillStyle = '#94714f'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center';
        const state = this.getState();
        ctx.fillText(state.levelIndex === 0 ? `第 ${state.cycle} 轮 · 再次出发` : `进化！图 ${state.photoNumber}`, WIDTH / 2, Math.min(100, this.visibleHeight * .16)); ctx.restore();
      }
    }

    destroy() {
      this.destroyed = true;
      if (this.raf && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(this.raf);
      for (const image of this.images.values()) image.onload = null;
      this.images.clear(); this.effects.length = 0;
    }
  }
  JumpGame.WIDTH = WIDTH; JumpGame.HEIGHT = HEIGHT;
  JumpGame.CHARGE_MS = CHARGE_MS; JumpGame.DISTANCE_PER_MS = DISTANCE_PER_MS;
  JumpGame.FOOT_RADIUS = FOOT_RADIUS;
  JumpGame.evolutionForScore = evolutionForScore;
  root.JumpGame = JumpGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = JumpGame;
})(typeof window !== 'undefined' ? window : globalThis);
