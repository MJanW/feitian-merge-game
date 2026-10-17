(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 120;
  const LEADER_RADIUS = 15, PERSON_RADIUS = 12, SPEED = 145, FOLLOW_SPEED = 225;
  const GAP = 29, PICKUP_DISTANCE = 35, DETACH_SPEED = 92, COOLDOWN = 1.4;
  const MAX_LINK = 155, STRETCH_DELAY = 0.75;
  const SHIELD_SECONDS = 6;
  const EXIT = { x: 288, y: 18, width: 94, height: 88 };
  const ASSETS = {
    'sofa-dark': { image: 'assets/rescue/sofa-dark.png', frame: { x: 15, y: 150, width: 1758, height: 675 }, label: '黑沙发' },
    'sofa-gray': { image: 'assets/rescue/sofa-gray.png', frame: { x: 9, y: 154, width: 1757, height: 643 }, label: '灰沙发' },
    table: { image: 'assets/rescue/table.png', frame: { x: 80, y: 90, width: 1824, height: 618 }, label: '桌子' },
    goose: { image: 'assets/rescue/goose.png', frame: { x: 345, y: 90, width: 445, height: 1298 }, label: '巡逻鹅' },
    'plush-blue': { image: 'assets/rescue/plush-blue.png', frame: { x: 73, y: 40, width: 1357, height: 949 }, label: '护盾' },
  };
  const STAGES = [
    { name: '绕开家具', goal: 3, seconds: 90, hint: '绕开家具，蓝玩偶提供短暂抗撞保护', people: [[85, 535], [300, 515], [150, 420], [70, 230], [285, 285]],
      walls: [{ x: 38, y: 300, width: 124, height: 68, asset: 'sofa-dark' }, { x: 244, y: 394, width: 104, height: 66, asset: 'table' }, { x: 226, y: 166, width: 128, height: 74, asset: 'sofa-gray' }], rotators: [], geese: [], item: [200, 510] },
    { name: '家具窄通道', goal: 4, seconds: 100, hint: '先集合，再排队穿过两张沙发之间', people: [[70, 550], [315, 545], [135, 470], [290, 465], [55, 185], [305, 205]],
      walls: [{ x: 16, y: 350, width: 138, height: 68, asset: 'sofa-dark' }, { x: 232, y: 350, width: 152, height: 76, asset: 'sofa-gray' }, { x: 85, y: 213, width: 128, height: 72, asset: 'table' }], rotators: [], geese: [], item: [192, 475] },
    { name: '大鹅来巡逻', goal: 5, seconds: 110, hint: '留意巡逻鹅；护盾不能防队伍拉散', people: [[65, 560], [180, 535], [325, 555], [190, 420], [55, 350], [335, 320], [275, 110]],
      walls: [{ x: 12, y: 440, width: 122, height: 66, asset: 'sofa-dark' }, { x: 267, y: 424, width: 121, height: 72, asset: 'sofa-gray' }, { x: 18, y: 142, width: 110, height: 64, asset: 'table' }],
      rotators: [{ x: 200, y: 300, length: 156, thickness: 19, angle: 0.35, speed: 0.72 }],
      geese: [{ from: [198, 145], to: [330, 145], speed: 105, halfSpine: 24, radius: 12 }], item: [205, 390] },
  ];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const length = (x, y) => Math.hypot(x, y);

  class RescueGame {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.ctx = this.canvas?.getContext('2d') || null;
      this.levels = Array.isArray(options.levels) ? options.levels : [];
      this.onChange = options.onChange || (() => {});
      this.onEvent = options.onEvent || (() => {});
      this.onComplete = options.onComplete || (() => {});
      this.reducedMotion = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      this.images = new Map(); this.destroyed = false;
      if (typeof root.Image === 'function') for (const level of [...this.levels, ...Object.values(ASSETS)]) {
        if (!level?.image || this.images.has(level.image)) continue;
        const image = new root.Image(); this.images.set(level.image, image);
        image.onload = () => { if (!this.destroyed) this.render(); };
        image.src = level.image;
      }
      this.reset(0);
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

    reset(stageIndex = 0) {
      if (this.destroyed) return;
      this.stageIndex = Number.isInteger(stageIndex) ? clamp(stageIndex, 0, STAGES.length - 1) : 0;
      this.stage = STAGES[this.stageIndex];
      this.leader = { x: 200, y: 590, vx: 0, vy: 0, radius: LEADER_RADIUS, level: 0 };
      this.people = this.stage.people.map(([x, y], id) => ({ id, x, y, vx: 0, vy: 0, radius: PERSON_RADIUS, level: 1 + (this.stageIndex * 3 + id) % 11, state: 'waiting', cooldown: 0, stretchTime: 0, flash: 0 }));
      this.walls = this.stage.walls.map(wall => ({ ...wall }));
      this.rotators = this.stage.rotators.map(rotator => ({ ...rotator }));
      this.geese = this.stage.geese.map(goose => ({ ...goose, from: goose.from.slice(), to: goose.to.slice(), x: goose.from[0], y: goose.from[1], vx: 0, vy: 0, distance: 0, direction: 1 }));
      this.item = { x: this.stage.item[0], y: this.stage.item[1], available: true };
      this.shieldRemaining = 0;
      this.chain = []; this.saved = 0; this.elapsed = 0; this.accumulator = 0;
      this.status = 'ready'; this.isPaused = false; this.lastFrame = null;
      this.effects = []; this.stopInput(); this._notify(true); this.render();
    }

    setTarget(x, y) {
      if (this.destroyed || !Number.isFinite(x) || !Number.isFinite(y)) return;
      this.target = { x: clamp(x, LEADER_RADIUS, WIDTH - LEADER_RADIUS), y: clamp(y, LEADER_RADIUS, HEIGHT - LEADER_RADIUS) };
      this.direction = null;
    }

    setDirection(x, y) {
      if (this.destroyed || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const magnitude = length(x, y);
      this.direction = magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : null;
      this.target = null;
    }

    stopInput() { this.target = null; this.direction = null; }

    pause(paused = true) {
      if (this.destroyed) return;
      this.isPaused = Boolean(paused); this.lastFrame = null;
      if (this.isPaused) this.stopInput();
      this._notify();
    }

    _event(type, detail = {}) { this.onEvent({ type, ...detail }); }

    _velocity(body, dt, targetVx, targetVy, acceleration) {
      const dx = targetVx - body.vx, dy = targetVy - body.vy, difference = length(dx, dy);
      const amount = Math.min(1, acceleration * dt / (difference || 1));
      body.vx += dx * amount; body.vy += dy * amount;
    }

    _moveLeader(dt) {
      let vx = 0, vy = 0;
      if (this.direction) { vx = this.direction.x * SPEED; vy = this.direction.y * SPEED; }
      else if (this.target) {
        const dx = this.target.x - this.leader.x, dy = this.target.y - this.leader.y;
        const distance = length(dx, dy), speed = Math.min(SPEED, distance * 7);
        if (distance > 0.12) { vx = dx / distance * speed; vy = dy / distance * speed; }
      }
      this._velocity(this.leader, dt, vx, vy, 750);
      const before = { x: this.leader.x, y: this.leader.y };
      this.leader.x += this.leader.vx * dt; this.leader.y += this.leader.vy * dt;
      this._collide(this.leader);
      return length(this.leader.x - before.x, this.leader.y - before.y);
    }

    // Circle against an oriented rectangle. The contact point carries the
    // rotating obstacle's velocity, so a moving bar can strike a still person.
    _rectangleContact(body, cx, cy, halfWidth, halfHeight, angle = 0, angularSpeed = 0) {
      const c = Math.cos(angle), s = Math.sin(angle), dx = body.x - cx, dy = body.y - cy;
      const x = dx * c + dy * s, y = -dx * s + dy * c;
      const qx = clamp(x, -halfWidth, halfWidth), qy = clamp(y, -halfHeight, halfHeight);
      let nx = x - qx, ny = y - qy, distance = length(nx, ny), penetration;
      if (distance >= body.radius) return 0;
      if (distance > 0.00001) { nx /= distance; ny /= distance; penetration = body.radius - distance; }
      else {
        const horizontal = halfWidth - Math.abs(x), vertical = halfHeight - Math.abs(y);
        if (horizontal < vertical) { nx = x < 0 ? -1 : 1; ny = 0; penetration = body.radius + horizontal; }
        else { nx = 0; ny = y < 0 ? -1 : 1; penetration = body.radius + vertical; }
      }
      const worldNx = nx * c - ny * s, worldNy = nx * s + ny * c;
      const contactX = body.x - worldNx * body.radius, contactY = body.y - worldNy * body.radius;
      const obstacleVx = -angularSpeed * (contactY - cy), obstacleVy = angularSpeed * (contactX - cx);
      const approach = (body.vx - obstacleVx) * worldNx + (body.vy - obstacleVy) * worldNy;
      body.x += worldNx * (penetration + 0.001); body.y += worldNy * (penetration + 0.001);
      if (approach < 0) { body.vx -= approach * worldNx; body.vy -= approach * worldNy; }
      return Math.max(0, -approach);
    }

    _collide(body) {
      let impact = 0;
      // Two projection passes resolve a wall corner without an instantaneous
      // move through either surface. Speeds limit every free step to < 2 pixels.
      for (let pass = 0; pass < 2; pass++) {
        for (const wall of this.walls) impact = Math.max(impact, this._rectangleContact(body, wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width / 2, wall.height / 2));
        for (const bar of this.rotators) impact = Math.max(impact, this._rectangleContact(body, bar.x, bar.y, bar.length / 2, bar.thickness / 2, bar.angle, bar.speed));
        for (const goose of this.geese) impact = Math.max(impact, this._gooseContact(body, goose));
        const r = body.radius;
        if (body.x < r) { impact = Math.max(impact, -body.vx); body.x = r; body.vx = Math.max(0, body.vx); }
        if (body.x > WIDTH - r) { impact = Math.max(impact, body.vx); body.x = WIDTH - r; body.vx = Math.min(0, body.vx); }
        if (body.y < r) { impact = Math.max(impact, -body.vy); body.y = r; body.vy = Math.max(0, body.vy); }
        if (body.y > HEIGHT - r) { impact = Math.max(impact, body.vy); body.y = HEIGHT - r; body.vy = Math.min(0, body.vy); }
      }
      const speed = length(body.vx, body.vy), maxSpeed = body === this.leader ? SPEED : FOLLOW_SPEED;
      if (speed > maxSpeed) { body.vx *= maxSpeed / speed; body.vy *= maxSpeed / speed; }
      return impact;
    }

    _moveGeese(dt) {
      for (const goose of this.geese) {
        const dx = goose.to[0] - goose.from[0], dy = goose.to[1] - goose.from[1], distance = length(dx, dy);
        if (!distance) { goose.vx = goose.vy = 0; continue; }
        const oldX = goose.x, oldY = goose.y;
        goose.distance += goose.speed * goose.direction * dt;
        if (goose.distance > distance) { goose.distance = 2 * distance - goose.distance; goose.direction = -1; }
        else if (goose.distance < 0) { goose.distance = -goose.distance; goose.direction = 1; }
        goose.x = goose.from[0] + dx * goose.distance / distance; goose.y = goose.from[1] + dy * goose.distance / distance;
        goose.vx = (goose.x - oldX) / dt; goose.vy = (goose.y - oldY) / dt;
      }
    }

    _gooseContact(body, goose) {
      // The goose's thin body is a capsule, not the large rectangle enclosing
      // its head and wings. Contact velocity includes the goose's own motion.
      const nearestX = clamp(body.x, goose.x - goose.halfSpine, goose.x + goose.halfSpine);
      let nx = body.x - nearestX, ny = body.y - goose.y, distance = length(nx, ny);
      const radius = body.radius + goose.radius;
      if (distance >= radius) return 0;
      if (distance > 1e-8) { nx /= distance; ny /= distance; }
      else { nx = 0; ny = body.vy - goose.vy <= 0 ? 1 : -1; }
      const approach = (body.vx - goose.vx) * nx + (body.vy - goose.vy) * ny;
      body.x += nx * (radius - distance + 0.001); body.y += ny * (radius - distance + 0.001);
      if (approach < 0) { body.vx -= approach * nx; body.vy -= approach * ny; }
      return Math.max(0, -approach);
    }

    _detach(person, reason = 'impact') {
      if (person.state !== 'following' || (reason === 'impact' && this.shieldRemaining > 0)) return false;
      this.chain = this.chain.filter(id => id !== person.id);
      person.state = 'waiting'; person.cooldown = COOLDOWN; person.stretchTime = 0; person.flash = 0.65;
      this._event('detach', { id: person.id, level: person.level, x: person.x, y: person.y, reason });
      return true;
    }

    _people(dt) {
      for (const person of this.people) {
        person.flash = Math.max(0, person.flash - dt);
        if (person.state !== 'waiting') continue;
        person.cooldown = Math.max(0, person.cooldown - dt);
        person.vx *= Math.exp(-8 * dt); person.vy *= Math.exp(-8 * dt);
        person.x += person.vx * dt; person.y += person.vy * dt; this._collide(person);
      }
      // Snapshot order: a detached middle member is removed immediately, and
      // the next member follows the previous surviving teammate in this step.
      let previous = this.leader;
      for (const id of [...this.chain]) {
        const person = this.people[id];
        const dx = previous.x - person.x, dy = previous.y - person.y, distance = length(dx, dy);
        person.stretchTime = distance > MAX_LINK ? person.stretchTime + dt : 0;
        if (person.stretchTime >= STRETCH_DELAY) { this._detach(person, 'stretch'); continue; }
        const extension = Math.max(0, distance - GAP);
        const force = extension * 24;
        person.vx += ((distance ? dx / distance * force : 0) - person.vx * 8) * dt;
        person.vy += ((distance ? dy / distance * force : 0) - person.vy * 8) * dt;
        const speed = length(person.vx, person.vy);
        if (speed > FOLLOW_SPEED) { person.vx *= FOLLOW_SPEED / speed; person.vy *= FOLLOW_SPEED / speed; }
        person.x += person.vx * dt; person.y += person.vy * dt;
        const impact = this._collide(person);
        if (!(impact >= DETACH_SPEED && this._detach(person))) previous = person;
      }
    }

    _lineBlocked(a, b, cx, cy, halfWidth, halfHeight, angle = 0) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const x = (a.x - cx) * c + (a.y - cy) * s, y = -(a.x - cx) * s + (a.y - cy) * c;
      const dx = (b.x - a.x) * c + (b.y - a.y) * s, dy = -(b.x - a.x) * s + (b.y - a.y) * c;
      let enter = 0, leave = 1;
      for (const [start, delta, half] of [[x, dx, halfWidth + 1], [y, dy, halfHeight + 1]]) {
        if (Math.abs(delta) < 1e-8) { if (Math.abs(start) > half) return false; continue; }
        const first = (-half - start) / delta, last = (half - start) / delta;
        enter = Math.max(enter, Math.min(first, last)); leave = Math.min(leave, Math.max(first, last));
        if (enter > leave) return false;
      }
      return true;
    }

    _clearRecruitmentLine(a, b) {
      return !this.walls.some(wall => this._lineBlocked(a, b, wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width / 2, wall.height / 2))
        && !this.rotators.some(bar => this._lineBlocked(a, b, bar.x, bar.y, bar.length / 2, bar.thickness / 2, bar.angle))
        && !this.geese.some(goose => this._lineBlocked(a, b, goose.x, goose.y, goose.halfSpine, goose.radius)
          || [-1, 1].some(side => {
            const dx = b.x - a.x, dy = b.y - a.y, px = goose.x + side * goose.halfSpine, py = goose.y;
            const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
            return length(a.x + dx * t - px, a.y + dy * t - py) <= goose.radius + 1;
          }));
    }

    _collectItem() {
      if (!this.item.available || length(this.leader.x - this.item.x, this.leader.y - this.item.y) > 32 || !this._clearRecruitmentLine(this.leader, this.item)) return;
      this.item.available = false; this.shieldRemaining = SHIELD_SECONDS;
      this._event('item', { item: 'shield', duration: SHIELD_SECONDS, shieldRemaining: SHIELD_SECONDS, x: this.item.x, y: this.item.y });
    }

    _collect() {
      for (const person of this.people) {
        if (person.state !== 'waiting' || person.cooldown > 0) continue;
        // Join immediately behind the member actually touched. Sending a new
        // recruit to a distant tail would yank them across the whole party.
        const candidates = [this.leader, ...this.chain.map(id => this.people[id])]
          .map((member, index) => ({ member, index, distance: length(member.x - person.x, member.y - person.y) }))
          .filter(candidate => candidate.distance <= PICKUP_DISTANCE && this._clearRecruitmentLine(candidate.member, person))
          .sort((a, b) => a.distance - b.distance);
        if (!candidates.length) continue;
        person.state = 'following'; person.stretchTime = 0; person.flash = 0.5; this.chain.splice(candidates[0].index, 0, person.id);
        this._event('collect', { id: person.id, level: person.level, x: person.x, y: person.y });
      }
    }

    _rescue() {
      const rescued = this.chain.filter(id => {
        const person = this.people[id];
        return person.x >= EXIT.x + person.radius && person.x <= EXIT.x + EXIT.width - person.radius && person.y >= EXIT.y + person.radius && person.y <= EXIT.y + EXIT.height - person.radius;
      });
      if (!rescued.length) return;
      const ids = new Set(rescued); this.chain = this.chain.filter(id => !ids.has(id));
      for (const id of rescued) {
        const person = this.people[id]; person.state = 'saved'; person.vx = person.vy = 0; this.saved++;
        if (!this.reducedMotion) this.effects.push({ x: person.x, y: person.y, age: 0 });
        this._event('rescue', { id, level: person.level, saved: this.saved, x: person.x, y: person.y });
      }
    }

    _complete(won) {
      if (this.status === 'won' || this.status === 'lost') return;
      this.status = won ? 'won' : 'lost'; this.stopInput(); this.leader.vx = this.leader.vy = 0;
      this._notify(true);
      this._event(won ? 'win' : 'lose', { stageIndex: this.stageIndex, score: this.getState().score });
      this.onComplete(this.getState());
    }

    step(milliseconds = STEP_MS) {
      if (this.destroyed || this.isPaused || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      if (this.status === 'won' || this.status === 'lost') { this._advanceEffects(milliseconds / 1000); return; }
      this.accumulator += milliseconds;
      while (this.accumulator + 1e-7 >= STEP_MS && this.status !== 'won' && this.status !== 'lost') {
        this.accumulator -= STEP_MS;
        const dt = STEP_MS / 1000;
        const moved = this._moveLeader(dt);
        if (this.status === 'ready' && moved > 0.001) this.status = 'playing';
        if (this.status === 'ready') continue;
        this.elapsed = Math.min(this.stage.seconds, this.elapsed + dt);
        this.shieldRemaining = Math.max(0, this.shieldRemaining - dt);
        for (const bar of this.rotators) bar.angle += bar.speed * dt;
        this._moveGeese(dt);
        this._collide(this.leader);
        this._collectItem();
        this._people(dt); this._collect(); this._rescue();
        this._advanceEffects(dt);
        if (this.saved >= this.stage.goal) this._complete(true);
        else if (this.elapsed >= this.stage.seconds - 1e-7) { this.elapsed = this.stage.seconds; this._complete(false); }
      }
      this._notify();
    }

    _advanceEffects(seconds) {
      for (const effect of this.effects) effect.age += seconds;
      this.effects = this.effects.filter(effect => effect.age < 0.6);
    }

    getState() {
      const remaining = Math.max(0, this.stage.seconds - this.elapsed);
      return { stageIndex: this.stageIndex, stageName: this.stage.name, stageCount: STAGES.length, goal: this.stage.goal, total: this.people.length, saved: this.saved, following: this.chain.length,
        remaining, shieldRemaining: this.shieldRemaining, score: this.saved * 100 + (this.status === 'won' ? Math.floor(remaining + 1e-7) * 5 : 0), status: this.status, isPaused: this.isPaused };
    }

    _notify(force = false) {
      const state = this.getState();
      // HUD needs tenths, not 120 announcements each second. getState remains exact.
      const signature = JSON.stringify({ ...state, remaining: Math.ceil(state.remaining * 10) / 10, shieldRemaining: Math.ceil(state.shieldRemaining * 10) / 10 });
      if (force || signature !== this.stateSignature) { this.stateSignature = signature; this.onChange(state); }
    }

    _roundRect(x, y, width, height, radius) {
      const ctx = this.ctx;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
      else ctx.rect(x, y, width, height);
    }

    _asset(name, x, y, width, height, flip = false, angle = 0) {
      const info = ASSETS[name], image = info && this.images.get(info.image), ctx = this.ctx;
      if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
        ctx.fillStyle = '#665f54'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(info?.label || '', x, y);
        return;
      }
      const f = info.frame;
      const valid = f && [f.x, f.y, f.width, f.height].every(Number.isFinite) && f.x >= 0 && f.y >= 0 && f.width > 0 && f.height > 0 && f.x + f.width <= image.naturalWidth && f.y + f.height <= image.naturalHeight;
      const source = valid ? [f.x, f.y, f.width, f.height] : [0, 0, image.naturalWidth, image.naturalHeight];
      const scale = Math.min(width / source[2], height / source[3]);
      const w = source[2] * scale, h = source[3] * scale;
      ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle); if (flip) ctx.scale(-1, 1);
      ctx.shadowColor = 'rgba(70,63,57,.16)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
      ctx.drawImage(image, ...source, -w / 2, -h / 2, w, h); ctx.restore();
    }

    _sprite(person, side) {
      const ctx = this.ctx, info = this.levels[person.level] || {}, image = this.images.get(info.image);
      ctx.save(); ctx.translate(person.x, person.y);
      if (!this.reducedMotion && person.flash > 0) { const pop = 1 + Math.sin(person.flash * 12) * 0.06; ctx.scale(pop, pop); }
      if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const f = info.frame;
        const valid = Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) && f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= image.naturalWidth && f[1] + f[3] <= image.naturalHeight;
        const width = valid ? f[2] : image.naturalWidth, height = valid ? f[3] : image.naturalHeight;
        const scale = side / Math.max(width, height);
        ctx.shadowColor = 'rgba(75,79,62,.16)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
        if (valid) ctx.drawImage(image, ...f, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
        else ctx.drawImage(image, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
      } else {
        ctx.fillStyle = person.level === 0 ? '#a9cbb2' : info.color || '#e8bd83';
        ctx.beginPath(); ctx.arc(0, 0, person.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#53434b'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(person.level === 0 ? '领' : String(person.level - 1), 0, 0);
      }
      ctx.restore();
    }

    render() {
      if (!this.ctx || this.destroyed) return;
      const ctx = this.ctx, cssWidth = this.canvas.getBoundingClientRect?.().width || WIDTH;
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      const width = Math.round(cssWidth * dpr), height = Math.round(cssWidth * HEIGHT / WIDTH * dpr);
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = '#fff9ed'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#edf1df';
      for (const [x, y, r] of [[34, 165, 68], [350, 385, 85], [65, 600, 65]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#dce5d1'; ctx.lineWidth = 1;
      for (let y = 130; y < HEIGHT; y += 62) for (let x = 28; x < WIDTH; x += 57) {
        ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x, y - 2); ctx.lineTo(x + 3, y + 3); ctx.stroke();
      }
      ctx.fillStyle = '#d6e8d9'; this._roundRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height, 17); ctx.fill();
      ctx.strokeStyle = '#77a68c'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); this._roundRect(EXIT.x + 2, EXIT.y + 2, EXIT.width - 4, EXIT.height - 4, 15); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#3e6d56'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('出口 ↑', EXIT.x + EXIT.width / 2, EXIT.y + 23);
      ctx.font = '11px system-ui'; ctx.fillText('伙伴到这里集合', EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height - 15);
      ctx.textAlign = 'left'; ctx.fillStyle = '#716552'; ctx.font = 'bold 16px system-ui'; ctx.fillText(this.stage.name, 20, 32);
      ctx.font = '12px system-ui'; ctx.fillText(`救出 ${this.saved} / ${this.stage.goal} 位`, 20, 55);
      ctx.font = '10px system-ui'; ctx.fillText(this.stage.hint, 20, 77);
      for (const wall of this.walls) {
        // The base outline makes the rectangular collision footprint legible
        // even where a transparent photograph has legs or rounded cushions.
        ctx.fillStyle = wall.asset ? '#dcd3c47a' : '#dca7a0'; this._roundRect(wall.x, wall.y, wall.width, wall.height, 7); ctx.fill();
        ctx.strokeStyle = '#b3a591'; ctx.lineWidth = 1.3; ctx.stroke();
        if (wall.asset) this._asset(wall.asset, wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width, wall.height);
        else { ctx.fillStyle = '#efcac3'; this._roundRect(wall.x + 3, wall.y + 3, wall.width - 6, 6, 3); ctx.fill(); }
      }
      for (const bar of this.rotators) {
        ctx.strokeStyle = 'rgba(202,133,106,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(bar.x, bar.y, bar.length / 2 + 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(bar.x, bar.y); ctx.rotate(bar.angle); ctx.fillStyle = '#cf9187'; this._roundRect(-bar.length / 2, -bar.thickness / 2, bar.length, bar.thickness, 8); ctx.fill();
        ctx.fillStyle = '#f0caa8'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      for (const goose of this.geese) {
        ctx.strokeStyle = '#d3ac79'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(...goose.from); ctx.lineTo(...goose.to); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#e9d6b879'; ctx.strokeStyle = '#cfa16a'; this._roundRect(goose.x - goose.halfSpine - goose.radius, goose.y - goose.radius, (goose.halfSpine + goose.radius) * 2, goose.radius * 2, goose.radius); ctx.fill(); ctx.stroke();
        // The source goose is upright. Turn its long body along its patrol,
        // keeping the visible silhouette aligned with the horizontal capsule.
        this._asset('goose', goose.x, goose.y, 32, 82, false, goose.direction < 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      if (this.item.available) {
        ctx.fillStyle = '#dceef2'; ctx.strokeStyle = '#8cb5c2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.item.x, this.item.y, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this._asset('plush-blue', this.item.x, this.item.y - 3, 42, 45);
        ctx.fillStyle = '#557d91'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('抗撞 6 秒', this.item.x, this.item.y + 34);
      }
      let previous = this.leader;
      ctx.strokeStyle = '#7fa78b'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      for (const id of this.chain) {
        const person = this.people[id]; ctx.beginPath(); ctx.moveTo(previous.x, previous.y);
        ctx.quadraticCurveTo((previous.x + person.x) / 2 + 4, (previous.y + person.y) / 2 + 4, person.x, person.y); ctx.stroke(); previous = person;
      }
      ctx.setLineDash([]);
      if (this.shieldRemaining > 0) for (const member of [this.leader, ...this.chain.map(id => this.people[id])]) {
        ctx.strokeStyle = '#70b7d1'; ctx.fillStyle = 'rgba(154,216,232,.17)'; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.arc(member.x, member.y, member.radius + 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      for (const person of this.people) {
        if (person.state === 'saved') continue;
        ctx.strokeStyle = person.cooldown > 0 ? '#cb8b75' : person.state === 'following' ? '#7ba38a' : '#ccb891'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(person.x, person.y + 15, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
        this._sprite(person, 43);
        if (person.state === 'waiting') { ctx.fillStyle = person.cooldown > 0 ? '#af6c58' : '#84704f'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(person.cooldown > 0 ? '稍等' : '+', person.x, person.y - 29); }
      }
      ctx.strokeStyle = '#5d9479'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(this.leader.x, this.leader.y + 16, 18, 6, 0, 0, Math.PI * 2); ctx.stroke(); this._sprite(this.leader, 48);
      if (!this.reducedMotion) for (const effect of this.effects) {
        ctx.globalAlpha = 1 - effect.age / 0.6; ctx.strokeStyle = '#78ad88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(effect.x, effect.y, 12 + effect.age * 45, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (this.status === 'ready') { ctx.fillStyle = '#6e7f67'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('拖动瓶子领队 · 开始移动后计时', WIDTH / 2, HEIGHT - 25); }
    }

    destroy() {
      this.destroyed = true; this.stopInput();
      if (this.raf && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(this.raf);
      for (const image of this.images.values()) image.onload = null;
      this.images.clear(); this.effects.length = 0;
    }
  }
  RescueGame.WIDTH = WIDTH; RescueGame.HEIGHT = HEIGHT;
  RescueGame.STAGES = Object.freeze(STAGES.map((stage, index) => Object.freeze({ index, name: stage.name, goal: stage.goal, total: stage.people.length, seconds: stage.seconds, hint: stage.hint })));
  root.RescueGame = RescueGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = RescueGame;
})(typeof window !== 'undefined' ? window : globalThis);
