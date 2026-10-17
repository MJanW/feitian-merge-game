(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 120;
  const LEADER_RADIUS = 15, PERSON_RADIUS = 12, SPEED = 145, FOLLOW_SPEED = 225;
  const GAP = 29, PICKUP_DISTANCE = 35, DETACH_SPEED = 92, COOLDOWN = 1.4;
  const MAX_LINK = 155, STRETCH_DELAY = 0.75;
  const EXIT = { x: 288, y: 18, width: 94, height: 88 };
  const STAGES = [
    { name: '草地集合', goal: 3, seconds: 90, hint: '靠近伙伴，带到右上方出口', people: [[85, 535], [300, 515], [140, 420], [75, 290], [290, 270]], walls: [], rotators: [] },
    { name: '一起过窄门', goal: 4, seconds: 100, hint: '转弯慢一点，让队伍对准中间的门', people: [[85, 540], [310, 530], [125, 440], [280, 425], [85, 205], [295, 175]], walls: [{ x: 0, y: 302, width: 164, height: 23 }, { x: 236, y: 302, width: 164, height: 23 }], rotators: [] },
    { name: '绕过风车', goal: 5, seconds: 110, hint: '留意转动的栏杆，掉队伙伴还能接回来', people: [[75, 555], [175, 535], [305, 525], [325, 410], [75, 390], [85, 215], [285, 175]], walls: [], rotators: [{ x: 200, y: 300, length: 156, thickness: 19, angle: 0.35, speed: 0.72 }] },
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
      if (typeof root.Image === 'function') for (const level of this.levels) {
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

    _detach(person, reason = 'impact') {
      if (person.state !== 'following') return;
      this.chain = this.chain.filter(id => id !== person.id);
      person.state = 'waiting'; person.cooldown = COOLDOWN; person.stretchTime = 0; person.flash = 0.65;
      this._event('detach', { id: person.id, level: person.level, x: person.x, y: person.y, reason });
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
        if (impact >= DETACH_SPEED) this._detach(person);
        else previous = person;
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
        && !this.rotators.some(bar => this._lineBlocked(a, b, bar.x, bar.y, bar.length / 2, bar.thickness / 2, bar.angle));
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
        for (const bar of this.rotators) bar.angle += bar.speed * dt;
        this._collide(this.leader);
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
        remaining, score: this.saved * 100 + (this.status === 'won' ? Math.floor(remaining + 1e-7) * 5 : 0), status: this.status, isPaused: this.isPaused };
    }

    _notify(force = false) {
      const state = this.getState();
      // HUD needs tenths, not 120 announcements each second. getState remains exact.
      const signature = JSON.stringify({ ...state, remaining: Math.ceil(state.remaining * 10) / 10 });
      if (force || signature !== this.stateSignature) { this.stateSignature = signature; this.onChange(state); }
    }

    _roundRect(x, y, width, height, radius) {
      const ctx = this.ctx;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
      else ctx.rect(x, y, width, height);
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
        ctx.fillStyle = '#dca7a0'; this._roundRect(wall.x, wall.y, wall.width, wall.height, 7); ctx.fill();
        ctx.fillStyle = '#efcac3'; this._roundRect(wall.x + 3, wall.y + 3, wall.width - 6, 6, 3); ctx.fill();
      }
      for (const bar of this.rotators) {
        ctx.strokeStyle = 'rgba(202,133,106,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(bar.x, bar.y, bar.length / 2 + 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(bar.x, bar.y); ctx.rotate(bar.angle); ctx.fillStyle = '#cf9187'; this._roundRect(-bar.length / 2, -bar.thickness / 2, bar.length, bar.thickness, 8); ctx.fill();
        ctx.fillStyle = '#f0caa8'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      let previous = this.leader;
      ctx.strokeStyle = '#7fa78b'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      for (const id of this.chain) {
        const person = this.people[id]; ctx.beginPath(); ctx.moveTo(previous.x, previous.y);
        ctx.quadraticCurveTo((previous.x + person.x) / 2 + 4, (previous.y + person.y) / 2 + 4, person.x, person.y); ctx.stroke(); previous = person;
      }
      ctx.setLineDash([]);
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
