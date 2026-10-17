(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 120;
  const CHARGE_MS = 1200, DISTANCE_PER_MS = 0.3, FOOT_RADIUS = 5, PROJECTION = 0.55;
  const Platforms = root.JumpPlatforms || (typeof require === 'function' ? require('./jump-platforms.js') : null);
  let PlatformRenderer = root.JumpPlatformRenderer;
  if (!PlatformRenderer && typeof require === 'function') {
    try { PlatformRenderer = require('./jump-platform-renderer.js'); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  const KINDS = Object.keys(Platforms.MODELS);
  const BONUS_WAIT_MS = 2000;
  const BONUSES = Object.freeze({
    manhole: Object.freeze({ points: 5, label: '井盖' }),
    cube: Object.freeze({ points: 10, label: '魔方' }),
    kiosk: Object.freeze({ points: 15, label: '便利店' }),
    record: Object.freeze({ points: 30, label: '唱片' }),
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = t => t * t * (3 - 2 * t);

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
      this.score = 0; this.hops = 0; this.combo = 0; this.chargeMs = 0;
      this.elapsed = 0; this.accumulator = 0; this.lastFrame = null;
      this.currentId = 0; this.lastPoints = 0; this.lastPerfect = false;
      this.bonusIdleMs = 0;
      this.player = { x: 125, y: 0, z: 0 };
      this.platforms = [Platforms.createPlatform(0, 'grass', { x: 125, y: 0 })];
      this.platforms.push(Platforms.createPlatform(1, 'parcel', { x: 275, y: -Math.sqrt(240 * 240 - 150 * 150) }));
      this._appendPlatform(); this._appendPlatform();
      this.cameraY = this._cameraAnchor(); this.cameraFrom = this.cameraY; this.cameraTo = this.cameraY; this.cameraTime = 0.4;
      this.jump = null; this.fallTime = 0; this.landingPulse = 0; this.evolutionPulse = 0;
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
      this.bonusIdleMs = 0;
      this._notify(true); return true;
    }

    releaseCharge() {
      if (this.destroyed || this.isPaused || this.phase !== 'charging') return false;
      const next = this._next(), dx = next.x - this.player.x, dy = next.y - this.player.y;
      const distanceToTarget = Math.hypot(dx, dy), distance = this.chargeMs * DISTANCE_PER_MS;
      this.jump = { fromX: this.player.x, fromY: this.player.y,
        toX: this.player.x + dx / distanceToTarget * distance,
        toY: this.player.y + dy / distanceToTarget * distance,
        time: 0, duration: 0.38 + distance / 1000,
        height: this.reducedMotion ? 70 : 72 + distance * 0.2,
        direction: dx < 0 ? -1 : 1 };
      this.phase = 'jumping'; this.chargeMs = 0;
      this._event('jump', { distance, duration: this.jump.duration });
      this._notify(true); return true;
    }

    cancelCharge() {
      if (this.destroyed || this.phase !== 'charging') return false;
      this.phase = 'idle'; this.chargeMs = 0; this._notify(true); return true;
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

    _land() {
      const next = this._next(), current = this._current();
      const on = platform => Platforms.contains(platform, this.player.x, this.player.y, FOOT_RADIUS);
      this.player.z = 0;
      this.bonusIdleMs = 0;
      if (!on(next) && !on(current)) {
        this.phase = 'falling'; this.fallTime = 0; this.combo = 0; return;
      }
      this.phase = 'idle'; this.landingPulse = 0.32;
      if (!on(next)) {
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
        if (this.phase === 'charging') this.chargeMs = Math.min(CHARGE_MS, this.chargeMs + STEP_MS);
        else if (this.phase === 'jumping') {
          this.jump.time += dt;
          const progress = Math.min(1, this.jump.time / this.jump.duration);
          this.player.x = this.jump.fromX + (this.jump.toX - this.jump.fromX) * progress;
          this.player.y = this.jump.fromY + (this.jump.toY - this.jump.fromY) * progress;
          this.player.z = Math.sin(progress * Math.PI) * this.jump.height;
          if (progress >= 1) this._land();
        } else if (this.phase === 'falling') {
          this.fallTime += dt; this.player.z = -Math.pow(this.fallTime, 2) * 650;
          if (this.fallTime >= 0.5) this._finish();
        } else if (this.phase === 'idle') this._waitForBonus(STEP_MS);
      }
      this._notify();
    }

    getState() {
      const next = this._next(), current = this._current(), bonus = BONUSES[current.kind];
      const unclaimed = Boolean(bonus && this.currentId > 0 && !current.bonusClaimed);
      return { status: this.status, phase: this.phase, isPaused: this.isPaused,
        score: this.score, hops: this.hops, combo: this.combo, charge: this.chargeMs / CHARGE_MS,
        ...evolutionForScore(this.score), lastPoints: this.lastPoints, lastPerfect: this.lastPerfect,
        bonusPoints: bonus?.points || 0, bonusLabel: bonus?.label || '',
        bonusAvailable: unclaimed && this.status === 'playing' && this.phase === 'idle',
        bonusRemainingMs: unclaimed ? Math.max(0, BONUS_WAIT_MS - this.bonusIdleMs) : 0,
        nextDistance: Math.hypot(next.x - this.player.x, next.y - this.player.y) };
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
      if (this.reducedMotion || this.phase !== 'jumping') return;
      const progress = this.jump.time / this.jump.duration;
      const turn = smooth(clamp((progress - 0.08) / 0.82, 0, 1));
      // Rotate around the visible sprite's centre rather than its feet, so the
      // somersault follows the same jump arc without swinging in a wide orbit.
      this.ctx.translate(0, centerY);
      this.ctx.rotate(this.jump.direction * Math.PI * 2 * turn);
      this.ctx.translate(0, -centerY);
    }

    _sprite() {
      const ctx = this.ctx, state = this.getState(), info = this.levels[state.levelIndex] || {};
      const image = this.images.get(info.image), screenY = this.player.y * PROJECTION + this.cameraY;
      const falling = this.phase === 'falling', alpha = falling ? clamp(1 - this.fallTime / 0.5, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = '#65566628';
      const shadow = clamp(1 - this.player.z / 220, 0.35, 1);
      this._ellipse(this.player.x, screenY + 1.5, 11.25 * shadow, 4.5 * shadow); ctx.fill();
      ctx.translate(this.player.x, screenY - this.player.z);
      if (!this.reducedMotion) {
        const squeeze = this.phase === 'charging' ? state.charge * 0.22 : this.phase === 'idle' && this.landingPulse > 0 ? Math.sin(this.landingPulse / 0.32 * Math.PI) * 0.18 : 0;
        ctx.scale(1 + squeeze * 0.7, 1 - squeeze);
      }
      if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const f = info.frame;
        const valid = Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) && f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= image.naturalWidth && f[1] + f[3] <= image.naturalHeight;
        const source = valid ? f : [0, 0, image.naturalWidth, image.naturalHeight];
        const scale = Math.min(54 / source[2], 61.5 / source[3]);
        const w = source[2] * scale, h = source[3] * scale;
        this._flipSprite(-h / 2);
        ctx.shadowColor = '#63535e30'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
        ctx.drawImage(image, ...source, -w / 2, -h, w, h);
      } else {
        this._flipSprite(-18);
        ctx.fillStyle = info.color || '#a9d8e6'; ctx.beginPath(); ctx.arc(0, -18, 16.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4c525b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(state.photoNumber), 0, -14.25);
      }
      ctx.restore();
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
      for (const platform of [...this.platforms].sort((a, b) => a.y - b.y)) {
        if (this.status !== 'ready' || platform.id <= 2) this._platform(platform);
      }
      if (!this.reducedMotion && this.landingPulse > 0) {
        ctx.strokeStyle = '#b18a6177'; ctx.lineWidth = 2;
        const r = 18 + (0.32 - this.landingPulse) * 110;
        this._ellipse(this.player.x, this.player.y * PROJECTION + this.cameraY, r, r * PROJECTION); ctx.stroke();
      }
      this._sprite();
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
  JumpGame.evolutionForScore = evolutionForScore;
  root.JumpGame = JumpGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = JumpGame;
})(typeof window !== 'undefined' ? window : globalThis);
