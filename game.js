(function (root) {
  'use strict';

  const WIDTH = 400;
  const HEIGHT = 650;
  const DANGER_Y = 120;
  const RADII = [20.7, 28.6, 34.8, 41.8, 52.8, 52.6575, 70, 82, 77.76, 110, 113.4, 149.04];
  const MERGE_SCORES = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
  const STEP_MS = 1000 / 120;
  const DROP_DELAY = 450;
  const FRESH_GRACE = 1800;
  const DANGER_DELAY = 2000;

  class MergeGame {
    constructor(options = {}) {
      this.Matter = options.matter || root.Matter;
      if (!this.Matter) throw new Error('Matter.js must load before the game.');
      this.canvas = options.canvas || null;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.onChange = options.onChange || (() => {});
      this.onMerge = options.onMerge || (() => {});
      this.onGameOver = options.onGameOver || (() => {});
      this.random = options.random || Math.random;
      this.reducedMotion = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      this.engine = this.Matter.Engine.create({
        positionIterations: 10,
        velocityIterations: 8,
        enableSleeping: false,
      });
      this.engine.gravity.y = 1.25;
      this.images = new Map();
      this.balls = new Map();
      this.pendingMerges = [];
      this.particles = [];
      this.blasts = [];
      this.floats = [];
      this.levels = [];
      this.destroyed = false;
      this._collisionHandler = event => {
        for (const pair of event.pairs) {
          // Matter reports the child circles in a compound, not the game-piece parent.
          const a = pair.bodyA.parent || pair.bodyA;
          const b = pair.bodyB.parent || pair.bodyB;
          if (a === b) continue;
          if (event.name === 'collisionStart') {
            // Start events run before the velocity solver. Active events run after it,
            // so only a new impact overrides the normally inelastic resting contact.
            const speed = this._impactSpeed(pair, a, b);
            pair.restitution = speed > 1.5 ? (a.isStatic || b.isStatic ? 0.45 : 0.38) : 0;
            if (speed > 1.5) {
              this._squash(a, pair.collision.normal, speed);
              this._squash(b, pair.collision.normal, speed);
            }
          }
          if (a.gameLevel !== undefined && a.gameLevel === b.gameLevel && this.balls.has(a.id) && this.balls.has(b.id)) {
            this.pendingMerges.push([a.id, b.id]);
          }
        }
      };
      this.Matter.Events.on(this.engine, 'collisionStart', this._collisionHandler);
      this.Matter.Events.on(this.engine, 'collisionActive', this._collisionHandler);
      this.setLevels(options.levels || []);
      this.reset();
      this._lastFrame = null;
      if (this.ctx && typeof root.requestAnimationFrame === 'function') {
        const frame = now => {
          if (this.destroyed) return;
          const delta = this._lastFrame === null ? 0 : Math.min(50, now - this._lastFrame);
          this._lastFrame = now;
          this.step(delta);
          this.render();
          this._raf = root.requestAnimationFrame(frame);
        };
        this._raf = root.requestAnimationFrame(frame);
      }
    }

    setLevels(levels) {
      levels = Array.isArray(levels) ? levels : [];
      this.levels = RADII.map((fallbackRadius, index) => {
        const source = levels[index] || {};
        const radius = Number.isFinite(source.radius) && source.radius >= 8 && source.radius <= 180 ? source.radius : fallbackRadius;
        const imageSize = Array.isArray(source.imageSize) && source.imageSize.length === 2 && source.imageSize.every(value => Number.isFinite(value) && value > 0) ? source.imageSize.slice() : null;
        const f = source.frame;
        const frame = imageSize && Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) && f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= imageSize[0] && f[1] + f[3] <= imageSize[1] ? f.slice() : null;
        const p = source.parts;
        const parts = Array.isArray(p) && p.length > 0 && p.length <= 32 && p.every(part => Array.isArray(part) && part.length === 3 && part.every(Number.isFinite) && part[2] >= 0.025 && part[2] <= 1.15 && Math.abs(part[0]) + part[2] <= 1.15 && Math.abs(part[1]) + part[2] <= 1.15) ? p.map(part => part.slice()) : null;
        return {
          name: source.name || `照片 ${index}`,
          color: source.color || ['#eabb70', '#a5c9b5', '#d7acd0'][index % 3],
          image: typeof source.image === 'string' ? source.image : '',
          radius, frame, imageSize,
          parts: parts && (Math.max(...parts.map(part => part[0] + part[2])) - Math.min(...parts.map(part => part[0] - part[2]))) * radius < WIDTH - 4 ? parts : null,
        };
      });
      // Keep a hot-swapped visual theme and its collision geometry in agreement.
      for (const old of [...this.balls.values()]) {
        const center = this._spriteCenter(old);
        this._removeBall(old);
        const replacement = this._createBall(old.gameLevel, center.x, center.y, old.velocity);
        this.Matter.Body.setAngle(replacement, old.angle);
        const rotatedCenter = this._spriteCenter(replacement);
        this.Matter.Body.translate(replacement, { x: center.x - rotatedCenter.x, y: center.y - rotatedCenter.y });
        this.Matter.Body.setAngularVelocity(replacement, old.angularVelocity);
        replacement.bornAt = old.bornAt;
        replacement.dangerSince = old.dangerSince;
        this._constrainBody(replacement);
      }
      this.pendingMerges.length = 0;
      if (typeof root.Image === 'function') {
        const needed = new Set(this.levels.map(level => level.image).filter(Boolean));
        for (const src of this.images.keys()) {
          if (!needed.has(src)) this.images.delete(src);
        }
        for (const src of needed) {
          if (this.images.has(src)) continue;
          const image = new root.Image();
          this.images.set(src, image);
          image.onload = () => { if (!this.destroyed) this.render(); };
          image.src = src;
        }
      }
      if (this.ctx && this.current !== undefined) this.render();
    }

    reset() {
      const { Composite, Bodies, Engine } = this.Matter;
      Composite.clear(this.engine.world, false);
      Engine.clear(this.engine);
      this.balls.clear();
      this.pendingMerges.length = 0;
      this.particles.length = 0;
      this.blasts.length = 0;
      this.floats.length = 0;
      this.time = 0;
      this.accumulator = 0;
      this.score = 0;
      this.coins = 0;
      this.maxLevel = 0;
      this.danger = 0;
      this.isOver = false;
      this.isPaused = false;
      this.lastDrop = -DROP_DELAY;
      this.current = this._randomLevel();
      this.next = this._randomLevel();
      this.aimX = WIDTH / 2;
      this._lastFrame = null;
      const wall = { isStatic: true, friction: 0.2, restitution: 0 };
      Composite.add(this.engine.world, [
        Bodies.rectangle(-40, HEIGHT / 2, 80, HEIGHT + 400, wall),
        Bodies.rectangle(WIDTH + 40, HEIGHT / 2, 80, HEIGHT + 400, wall),
        Bodies.rectangle(WIDTH / 2, HEIGHT + 40, WIDTH + 160, 80, wall),
      ]);
      this._notify(true);
      this.render();
    }

    _randomLevel() {
      return Math.min(3, Math.floor(Math.max(0, this.random()) * 4));
    }

    aim(x) {
      if (!Number.isFinite(x) || this.destroyed) return;
      const bounds = this._shapeBounds(this.current);
      this.aimX = Math.max(2 - bounds.min.x, Math.min(WIDTH - 2 - bounds.max.x, x));
      this._notify();
      this.render();
    }

    drop() {
      if (!this.getState().canDrop) return false;
      this._createBall(this.current, this.aimX, 50);
      this.lastDrop = this.time;
      this.current = this.next;
      this.next = this._randomLevel();
      this.aim(this.aimX);
      this._notify();
      return true;
    }

    _createBall(level, x, y, velocity) {
      const { Bodies, Body } = this.Matter;
      const radius = this._radius(level);
      const material = {
        restitution: 0,
        friction: 0.18,
        frictionStatic: 0.6,
        frictionAir: 0.008,
        density: 0.002,
        slop: 0.02,
      };
      const geometry = this.levels[level].parts;
      const pieces = geometry ? geometry.map(([px, py, r]) => Bodies.circle(x + px * radius, y + py * radius, r * radius, material)) : null;
      const ball = pieces ? Body.create({ ...material, parts: pieces }) : Bodies.circle(x, y, radius, material);
      // A silhouette may need many overlapping circles. Its weight follows game size,
      // not the number of circles used to approximate the photographed outline.
      Body.setMass(ball, Math.PI * radius * radius * material.density);
      if (pieces) {
        // Body.create prepends its parent to the supplied parts array. Only children
        // describe the photographed silhouette and contribute to this calculation.
        const physicalParts = ball.parts.slice(1);
        const partMass = physicalParts.reduce((sum, part) => sum + part.mass, 0);
        const moment = physicalParts.reduce((sum, part) => {
          const dx = part.position.x - ball.position.x, dy = part.position.y - ball.position.y;
          // Matter scales each circle's intrinsic inertia by four. Include the matching
          // parallel-axis term, otherwise a finely split long figure spins unrealistically.
          return sum + part.inertia + 4 * part.mass * (dx * dx + dy * dy);
        }, 0);
        Body.setInertia(ball, moment * ball.mass / partMass);
      }
      // Compound bodies rotate around their mass centre; the image is centred on its frame.
      ball.spriteOffset = { x: x - ball.position.x, y: y - ball.position.y };
      ball.gameLevel = level;
      ball.bornAt = this.time;
      ball.dangerSince = null;
      ball.squash = 0;
      ball.squashAngle = 0;
      ball.popAt = null;
      this.balls.set(ball.id, ball);
      this.Matter.Composite.add(this.engine.world, ball);
      if (velocity) this.Matter.Body.setVelocity(ball, velocity);
      this._constrainBody(ball);
      this.maxLevel = Math.max(this.maxLevel, level);
      return ball;
    }

    _radius(level) { return this.levels[level]?.radius || RADII[level]; }

    _impactSpeed(pair, a, b) {
      const { Body } = this.Matter;
      // During collisionStart raw velocity still contains this substep's displacement.
      // The getters normalize it to Matter's 60 Hz units, including angular velocity.
      const av = a.isStatic ? { x: 0, y: 0 } : Body.getVelocity(a);
      const bv = b.isStatic ? { x: 0, y: 0 } : Body.getVelocity(b);
      const aw = a.isStatic ? 0 : Body.getAngularVelocity(a);
      const bw = b.isStatic ? 0 : Body.getAngularVelocity(b);
      const { normal, supports, supportCount } = pair.collision;
      const points = supports.slice(0, supportCount).filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y));
      let speed = 0;
      for (const point of points) {
        const ax = av.x - aw * (point.y - a.position.y);
        const ay = av.y + aw * (point.x - a.position.x);
        const bx = bv.x - bw * (point.y - b.position.y);
        const by = bv.y + bw * (point.x - b.position.x);
        // The collision normal points from B to A: separating contacts stay at zero.
        speed = Math.max(speed, (bx - ax) * normal.x + (by - ay) * normal.y);
      }
      return speed;
    }

    _shapeBounds(level) {
      const radius = this._radius(level);
      const parts = this.levels[level].parts || [[0, 0, 1]];
      return {
        min: { x: Math.min(...parts.map(p => p[0] - p[2])) * radius, y: Math.min(...parts.map(p => p[1] - p[2])) * radius },
        max: { x: Math.max(...parts.map(p => p[0] + p[2])) * radius, y: Math.max(...parts.map(p => p[1] + p[2])) * radius },
      };
    }

    _bodyBounds(body) {
      // Matter's broad-phase bounds include velocity padding. Read the physical vertices
      // instead; approximating them by a larger circle would hold bodies just off the floor
      // and prevent the collision solver from ever producing a rebound.
      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
      const bounds = { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } };
      for (const part of parts) for (const point of part.vertices) {
        bounds.min.x = Math.min(bounds.min.x, point.x); bounds.min.y = Math.min(bounds.min.y, point.y);
        bounds.max.x = Math.max(bounds.max.x, point.x); bounds.max.y = Math.max(bounds.max.y, point.y);
      }
      return bounds;
    }

    _spriteCenter(body) {
      const offset = body.spriteOffset || { x: 0, y: 0 };
      const c = Math.cos(body.angle), s = Math.sin(body.angle);
      return { x: body.position.x + offset.x * c - offset.y * s, y: body.position.y + offset.x * s + offset.y * c };
    }

    _constrainBody(body) {
      if (body.isStatic) return;
      const bounds = this._bodyBounds(body);
      const dx = bounds.min.x < 0 ? -bounds.min.x : bounds.max.x > WIDTH ? WIDTH - bounds.max.x : 0;
      const dy = bounds.max.y > HEIGHT ? HEIGHT - bounds.max.y : 0;
      if (!dx && !dy) return;
      this.Matter.Body.translate(body, { x: dx, y: dy });
      // This is only a penetration guard. Normal impacts get restitution from Matter;
      // adding another bounce here would inject energy into resting stacks.
      const velocity = { ...body.velocity };
      if ((dx > 0 && velocity.x < 0) || (dx < 0 && velocity.x > 0)) velocity.x = 0;
      if (dy < 0 && velocity.y > 0) velocity.y = 0;
      this.Matter.Body.setVelocity(body, velocity);
      if (dx) body.positionImpulse.x = 0;
      if (dy) body.positionImpulse.y = 0;
    }

    _squash(body, normal, speed) {
      if (this.reducedMotion || body.gameLevel === undefined) return;
      const amount = Math.min(0.30, speed / 25);
      if (amount > body.squash) { body.squash = amount; body.squashAngle = Math.atan2(normal.y, normal.x); }
    }

    _removeBall(ball) {
      this.balls.delete(ball.id);
      this.Matter.Composite.remove(this.engine.world, ball);
    }

    _mergeContacts() {
      // Remove both parents before adding a child. A body can join only one merge per step.
      const contacts = this.pendingMerges.splice(0);
      const consumed = new Set();
      for (const [aId, bId] of contacts) {
        if (consumed.has(aId) || consumed.has(bId)) continue;
        const a = this.balls.get(aId);
        const b = this.balls.get(bId);
        if (!a || !b || a.gameLevel !== b.gameLevel) continue;
        consumed.add(aId);
        consumed.add(bId);
        const oldLevel = a.gameLevel;
        const finalMerge = oldLevel === RADII.length - 1;
        const level = finalMerge ? oldLevel : oldLevel + 1;
        const ac = this._spriteCenter(a), bc = this._spriteCenter(b);
        const x = (ac.x + bc.x) / 2;
        const y = (ac.y + bc.y) / 2;
        const velocity = { x: (a.velocity.x + b.velocity.x) * 0.25, y: Math.min(0, (a.velocity.y + b.velocity.y) * 0.25) - 1 };
        this._removeBall(a);
        this._removeBall(b);
        if (!finalMerge) this._createBall(level, x, y, velocity).popAt = this.time;
        const gained = finalMerge ? 300 : MERGE_SCORES[level];
        const previousMilestone = Math.floor(this.score / 2000);
        this.score += gained;
        this.coins += Math.floor(this.score / 2000) - previousMilestone;
        if (finalMerge) this.coins += 1;
        this._burst(x, y, this.levels[level].color, level, finalMerge);
        this.floats.push({ x: Math.max(30, Math.min(WIDTH - 30, x)), y: Math.max(35, y - 18), text: '+' + gained, life: 900, big: finalMerge });
        this.onMerge({ x, y, level, score: gained, totalScore: this.score, finalMerge });
      }
    }

    _checkDanger() {
      let danger = 0;
      for (const ball of this.balls.values()) {
        const isOld = this.time - ball.bornAt >= FRESH_GRACE;
        const crossesLine = this._bodyBounds(ball).min.y < DANGER_Y;
        const isSettled = Math.hypot(ball.velocity.x, ball.velocity.y) < 1.1;
        if (isOld && crossesLine && isSettled) {
          if (ball.dangerSince === null) ball.dangerSince = this.time;
          danger = Math.max(danger, Math.min(1, (this.time - ball.dangerSince) / DANGER_DELAY));
        } else {
          ball.dangerSince = null;
        }
      }
      this.danger = danger;
      if (danger >= 1 && !this.isOver) {
        this.isOver = true;
        this._notify(true);
        this.onGameOver(this.getState());
      }
    }

    step(milliseconds = STEP_MS) {
      if (this.destroyed || this.isPaused || this.isOver || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      this.accumulator += milliseconds;
      // Fixed steps make physics and countdowns independent of the display refresh rate.
      while (this.accumulator + 0.000001 >= STEP_MS && !this.isOver) {
        this.accumulator -= STEP_MS;
        this.time += STEP_MS;
        this.Matter.Engine.update(this.engine, STEP_MS);
        this._mergeContacts();
        for (const ball of this.balls.values()) {
          this._constrainBody(ball);
          ball.squash *= Math.exp(-9 * STEP_MS / 1000);
        }
        this._checkDanger();
        for (const particle of this.particles) {
          particle.life -= STEP_MS;
          particle.x += particle.vx * STEP_MS / 16.6667;
          particle.y += particle.vy * STEP_MS / 16.6667;
          particle.vy += 0.06 * STEP_MS / 16.6667;
        }
        this.particles = this.particles.filter(particle => particle.life > 0);
        for (const blast of this.blasts) blast.life -= STEP_MS;
        this.blasts = this.blasts.filter(blast => blast.life > 0);
        for (const float of this.floats) { float.life -= STEP_MS; if (!this.reducedMotion) float.y -= STEP_MS * 0.035; }
        this.floats = this.floats.filter(float => float.life > 0);
      }
      this._notify();
    }

    pause(paused = true) {
      this.isPaused = Boolean(paused);
      this._lastFrame = null;
      this._notify();
    }

    revive() {
      if (!this.isOver || this.coins < 1 || this.destroyed) return false;
      const upper = [...this.balls.values()].sort((a, b) => this._bodyBounds(a).min.y - this._bodyBounds(b).min.y);
      const clear = upper.filter(ball => this._bodyBounds(ball).min.y < 210);
      for (const ball of clear.length ? clear : upper.slice(0, 3)) this._removeBall(ball);
      for (const ball of this.balls.values()) {
        ball.dangerSince = null;
        ball.bornAt = this.time;
      }
      this.coins -= 1;
      this.isOver = false;
      this.isPaused = false;
      this.danger = 0;
      this.accumulator = 0;
      this.pendingMerges.length = 0;
      this.lastDrop = this.time - DROP_DELAY;
      this._lastFrame = null;
      this._notify(true);
      this.render();
      return true;
    }

    getState() {
      return {
        score: this.score,
        current: this.current,
        next: this.next,
        coins: this.coins,
        isOver: this.isOver,
        isPaused: this.isPaused,
        bodyCount: this.balls.size,
        maxLevel: this.maxLevel,
        danger: Math.round(this.danger * 1000) / 1000,
        canDrop: !this.destroyed && !this.isOver && !this.isPaused && this.time - this.lastDrop >= DROP_DELAY - 0.001,
        aimX: this.aimX,
      };
    }

    _notify(force = false) {
      const state = this.getState();
      const signature = JSON.stringify(state);
      if (force || this._stateSignature !== signature) {
        this._stateSignature = signature;
        this.onChange(state);
      }
    }

    _burst(x, y, color, level = 0, finalMerge = false) {
      if (this.reducedMotion) return;
      const count = finalMerge ? 48 : 8 + level * 2;
      // A terminal pair leaves a wide expanding ring and several speeds of sparks.
      // These are visual only and never consume the random stream used for drops.
      if (finalMerge) this.blasts.push({ x, y, life: 520, radius: this._radius(level) });
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * Math.PI * 2;
        const speed = finalMerge ? 3.8 + i % 3 * 1.4 : 2 + level * 0.15;
        this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: finalMerge ? 720 : 420, radius: finalMerge ? 2 + i % 4 : 3,
          color: finalMerge ? [color, '#f6bb4c', '#f08b60', '#ffe5a3'][i % 4] : color });
      }
    }

    _drawBall(level, x, y, radius, angle = 0, preview = false, visual = null) {
      const ctx = this.ctx;
      const info = this.levels[level];
      ctx.save();
      ctx.translate(x, y);
      if (!this.reducedMotion && visual) {
        const squash = visual.squash || 0;
        if (squash > 0.004) {
          ctx.rotate(visual.squashAngle); ctx.scale(1 - squash, 1 + squash * 0.85); ctx.rotate(-visual.squashAngle);
        }
        if (visual.popAt !== null && this.time - visual.popAt < 220) {
          const pop = 1 + 0.28 * (1 - (this.time - visual.popAt) / 220);
          ctx.scale(pop, pop);
        }
      }
      ctx.rotate(angle);
      ctx.shadowColor = 'rgba(99, 67, 45, 0.13)';
      ctx.shadowBlur = preview ? 4 : 6;
      ctx.shadowOffsetY = 3;
      const image = this.images.get(info.image);
      if (image && image.complete && image.naturalWidth && image.naturalHeight) {
        const frame = info.frame && info.frame[0] + info.frame[2] <= image.naturalWidth && info.frame[1] + info.frame[3] <= image.naturalHeight ? info.frame : null;
        const sourceWidth = frame ? frame[2] : image.naturalWidth;
        const sourceHeight = frame ? frame[3] : image.naturalHeight;
        const scale = radius * 2 / Math.max(sourceWidth, sourceHeight);
        const width = sourceWidth * scale, height = sourceHeight * scale;
        if (frame) ctx.drawImage(image, ...frame, -width / 2, -height / 2, width, height);
        else ctx.drawImage(image, -width / 2, -height / 2, width, height);
      } else {
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#4f453f';
        ctx.font = `700 ${Math.max(15, radius * 0.6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(level), 0, 1);
      }
      ctx.restore();
    }

    render() {
      if (!this.ctx || this.destroyed || this.current === undefined) return;
      const ctx = this.ctx;
      const cssWidth = this.canvas.getBoundingClientRect?.().width || WIDTH;
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      const pixelWidth = Math.round(cssWidth * dpr);
      const pixelHeight = Math.round(cssWidth * HEIGHT / WIDTH * dpr);
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
      }
      ctx.setTransform(this.canvas.width / WIDTH, 0, 0, this.canvas.height / HEIGHT, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fffaf1';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = 'rgba(166, 131, 91, 0.12)';
      for (let x = 14; x < WIDTH; x += 24) {
        for (let y = 15; y < HEIGHT; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (this.danger > 0) {
        ctx.fillStyle = `rgba(233, 112, 83, ${0.04 + this.danger * 0.12})`;
        ctx.fillRect(0, 0, WIDTH, DANGER_Y);
      }
      ctx.save();
      ctx.strokeStyle = this.danger > 0 ? '#d76f54' : '#e6cdb0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(12, DANGER_Y);
      ctx.lineTo(WIDTH - 12, DANGER_Y);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = this.danger > 0 ? '#a84432' : '#806c55';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.danger > 0 ? '留意上方，快合成！' : '危险线', 14, DANGER_Y - 9);

      if (!this.isOver) {
        const radius = this._radius(this.current);
        ctx.save();
        ctx.globalAlpha = this.getState().canDrop ? 0.8 : 0.35;
        ctx.strokeStyle = '#d6b58e';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(this.aimX, 50 + radius + 7);
        ctx.lineTo(this.aimX, HEIGHT - 8);
        ctx.stroke();
        ctx.setLineDash([]);
        this._drawBall(this.current, this.aimX, 50, radius, 0, true);
        ctx.restore();
      }
      for (const ball of this.balls.values()) {
        const center = this._spriteCenter(ball);
        this._drawBall(ball.gameLevel, center.x, center.y, this._radius(ball.gameLevel), ball.angle, false, ball);
      }
      for (const blast of this.blasts) {
        const progress = 1 - blast.life / 520;
        ctx.globalAlpha = 0.65 * (1 - progress) ** 2;
        ctx.strokeStyle = '#edaa42';
        ctx.lineWidth = 1 + 5 * (1 - progress);
        ctx.beginPath();
        ctx.arc(blast.x, blast.y, 12 + blast.radius * 1.15 * (1 - (1 - progress) ** 2), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const particle of this.particles) {
        ctx.globalAlpha = Math.min(1, particle.life / 200);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const float of this.floats) {
        ctx.globalAlpha = Math.min(1, float.life / 250);
        ctx.fillStyle = float.big ? '#b05128' : '#654839';
        ctx.font = `800 ${float.big ? 32 : 20}px "PingFang SC", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(float.text, float.x, float.y);
      }
      ctx.globalAlpha = 1;
    }

    destroy() {
      this.destroyed = true;
      if (this._raf && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(this._raf);
      this.Matter.Events.off(this.engine, 'collisionStart', this._collisionHandler);
      this.Matter.Events.off(this.engine, 'collisionActive', this._collisionHandler);
      this.Matter.Composite.clear(this.engine.world, false);
      this.Matter.Engine.clear(this.engine);
      this.balls.clear();
      this.images.clear();
    }
  }

  MergeGame.WIDTH = WIDTH;
  MergeGame.HEIGHT = HEIGHT;
  MergeGame.RADII = RADII.slice();
  MergeGame.MERGE_SCORES = MERGE_SCORES.slice();
  root.MergeGame = MergeGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = MergeGame;
})(typeof window !== 'undefined' ? window : globalThis);
