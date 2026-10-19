(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 60, MAX_DELTA = 250;
  const PATH = Object.freeze([{ x: 38, y: -35 }, { x: 38, y: 315 }, { x: 352, y: 315 }, { x: 352, y: 690 }].map(Object.freeze));
  const SLOTS = Object.freeze([
    [115, 160], [195, 160], [275, 160], [115, 240], [195, 240], [275, 240],
    [105, 390], [185, 390], [265, 390], [105, 470], [185, 470], [265, 470],
  ].map(([x, y], id) => Object.freeze({ id, x, y })));
  const FALLBACK_TYPES = [
    { kind: 'whisky', name: '威士忌', hp: 38, speed: 24, reward: 9, tint: '#c58a39' },
    { kind: 'brandy', name: '白兰地', hp: 76, speed: 18, reward: 15, tint: '#a76135' },
    { kind: 'wine', name: '红酒', hp: 30, speed: 29, reward: 8, tint: '#7b344d' },
    { kind: 'baijiu', name: '白酒', hp: 56, speed: 25, reward: 12, tint: '#d65a42' },
    { kind: 'gin', name: '金酒', hp: 24, speed: 37, reward: 8, tint: '#4d9bb1' },
    { kind: 'champagne', name: '香槟', hp: 110, speed: 20, reward: 20, tint: '#71915b' },
  ];
  const PATH_LENGTH = PATH.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y), 0);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const noop = () => {};
  const statsForLevel = level => {
    const n = Number.isInteger(level) ? clamp(level, 0, 10) : 0;
    return { damage: Math.round(12 * 1.65 ** n), range: 180 + n * 5, cooldown: Math.max(0.46, 0.88 - n * 0.038), splash: n >= 5 ? 24 + (n - 5) * 3 : 0, slow: n >= 3 ? 0.2 : 0 };
  };
  const upgradeCost = level => Number.isInteger(level) && level >= 0 && level < 10 ? Math.round(30 * 1.48 ** level / 5) * 5 : null;

  class DefenseGame {
    constructor(options = {}) {
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onChange = options.onChange || noop;
      this.onEvent = options.onEvent || noop;
      this.onComplete = options.onComplete || noop;
      const catalog = root.DefenseEnemies?.types;
      this.types = FALLBACK_TYPES.map(fallback => ({ ...fallback, ...(Array.isArray(catalog) ? catalog.find(type => type.kind === fallback.kind) : null) }));
      this.path = PATH; this.slots = SLOTS;
      this.reset();
    }

    reset() {
      this.status = 'ready'; this.isPaused = false; this.score = 0; this.wave = 0;
      this.gold = 60; this.lives = 12; this.maxLives = 12; this.kills = 0; this.spawnCost = 20;
      this.maxLevel = 0; this.elapsed = 0; this.accumulator = 0; this.nextWaveIn = 0;
      this.units = []; this.enemies = []; this.bullets = []; this.effects = [];
      this.spawnQueue = []; this.spawnTimer = 0; this.waveActive = false; this.completed = false;
      this.sequence = 0; this.changeTimer = 0; this._makeUnit(0); this._notify();
      return true;
    }

    start() {
      if (this.status !== 'ready') return false;
      this.status = 'playing'; this._beginWave(); this._notify(); return true;
    }

    pause(value = true) {
      if (this.status !== 'playing') return false;
      this.isPaused = Boolean(value); this.accumulator = 0; this._notify(); return true;
    }

    getState() {
      return { status: this.status, isPaused: this.isPaused, score: this.score, wave: this.wave, gold: this.gold,
        lives: this.lives, maxLives: this.maxLives, kills: this.kills, unitCount: this.units.length,
        maxLevel: this.maxLevel, spawnCost: this.spawnCost, nextWaveIn: this.nextWaveIn,
        remaining: this.enemies.length + this.spawnQueue.length, elapsed: this.elapsed };
    }

    place(slot) {
      if (!this._canAct() || !this._validSlot(slot) || this._unitAt(slot) || this.gold < this.spawnCost) return false;
      this.gold -= this.spawnCost; const unit = this._makeUnit(slot);
      this._effect('spawn', unit, { level: 0 }); this._event('spawn', { unitId: unit.id, slot, level: 0 }); this._notify(); return true;
    }

    move(fromSlot, toSlot) {
      if (!this._canAct() || !this._validSlot(fromSlot) || !this._validSlot(toSlot) || fromSlot === toSlot) return false;
      const source = this._unitAt(fromSlot), target = this._unitAt(toSlot);
      if (!source || (target && (target.level !== source.level || target.level >= 10))) return false;
      if (target) {
        this.units.splice(this.units.indexOf(source), 1); this._evolve(target, 'merge');
      } else {
        Object.assign(source, { slot: toSlot, x: SLOTS[toSlot].x, y: SLOTS[toSlot].y, pulse: 0.35 });
        this._event('move', { unitId: source.id, fromSlot, slot: toSlot, level: source.level });
      }
      this._notify(); return true;
    }

    upgrade(slot) {
      if (!this._canAct() || !this._validSlot(slot)) return false;
      const unit = this._unitAt(slot), cost = unit && upgradeCost(unit.level);
      if (!unit || cost === null || this.gold < cost) return false;
      this.gold -= cost; this._evolve(unit, 'upgrade'); this._notify(); return true;
    }

    step(milliseconds) {
      if (this.status !== 'playing' || this.isPaused || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      // A background-tab gap must not advance a whole unseen wave. Small deltas
      // accumulate, so 30, 60 and 120 Hz share the same deterministic simulation.
      this.accumulator += Math.min(milliseconds, MAX_DELTA);
      while (this.accumulator + 1e-8 >= STEP_MS && this.status === 'playing') {
        this.accumulator = Math.max(0, this.accumulator - STEP_MS); this._tick(STEP_MS / 1000);
      }
    }

    _canAct() { return (this.status === 'ready' || this.status === 'playing') && !this.isPaused; }
    _validSlot(slot) { return Number.isInteger(slot) && slot >= 0 && slot < SLOTS.length; }
    _unitAt(slot) { return this.units.find(unit => unit.slot === slot); }
    _notify() { this.onChange(this.getState()); }
    _event(type, details = {}) { this.onEvent({ type, ...details }); }
    _effect(type, at, details = {}) { this.effects.push({ type, x: at.x, y: at.y, age: 0, duration: 0.55, ...details }); }
    _roll() { const value = this.random(); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5; }
    _makeUnit(slot) {
      const unit = { id: ++this.sequence, slot, level: 0, x: SLOTS[slot].x, y: SLOTS[slot].y, cooldown: 0, pulse: 0 };
      this.units.push(unit); return unit;
    }
    _evolve(unit, type) {
      unit.level++; unit.cooldown = 0; unit.pulse = 0.6; this.maxLevel = Math.max(this.maxLevel, unit.level);
      this._effect(type, unit, { level: unit.level, duration: 0.8 });
      this._event(type, { unitId: unit.id, slot: unit.slot, level: unit.level });
    }

    _beginWave() {
      this.wave++; this.waveActive = true; this.nextWaveIn = 0;
      const count = Math.min(44, 6 + this.wave * 2);
      const kinds = this.wave === 1 ? ['wine', 'whisky'] : this.wave < 3 ? ['wine', 'whisky', 'gin'] : this.wave < 5 ? ['wine', 'whisky', 'gin', 'baijiu'] : this.types.map(type => type.kind);
      this.spawnQueue = Array.from({ length: count }, (_, index) => ({ kind: kinds[Math.floor(this._roll() * kinds.length)], boss: this.wave % 5 === 0 && index === count - 1 }));
      if (this.wave % 5 === 0) this.spawnQueue[this.spawnQueue.length - 1].kind = 'champagne';
      this.spawnTimer = this.wave === 1 ? 2 : 0.7;
      this._event('wave', { wave: this.wave, count, boss: this.wave % 5 === 0 });
    }

    _spawnEnemy(entry) {
      const type = this.types.find(value => value.kind === entry.kind) || this.types[0];
      const scaling = 1.23 ** Math.min(this.wave - 1, 100) * (1 + Math.max(0, this.wave - 20) * 0.08);
      const maxHp = Math.round(type.hp * scaling * (entry.boss ? 4.2 : 1));
      const enemy = { id: ++this.sequence, kind: type.kind, name: type.name, tint: type.tint, x: PATH[0].x, y: PATH[0].y,
        hp: maxHp, maxHp, progress: 0, hit: 0, boss: entry.boss, speed: type.speed * Math.min(1.85, 1 + (this.wave - 1) * 0.028),
        reward: Math.round(type.reward * (1 + (this.wave - 1) * 0.055) * (entry.boss ? 4 : 1)),
        damage: entry.boss ? 3 : 1, slow: 0, slowTime: 0 };
      this.enemies.push(enemy);
    }

    _positionEnemy(enemy) {
      let remaining = enemy.progress;
      for (let index = 1; index < PATH.length; index++) {
        const from = PATH[index - 1], to = PATH[index], segment = Math.hypot(to.x - from.x, to.y - from.y);
        if (remaining <= segment) { const t = remaining / segment; enemy.x = from.x + (to.x - from.x) * t; enemy.y = from.y + (to.y - from.y) * t; return; }
        remaining -= segment;
      }
      enemy.x = PATH[PATH.length - 1].x; enemy.y = PATH[PATH.length - 1].y;
    }

    _tick(dt) {
      this.elapsed += dt; this.changeTimer += dt;
      for (const effect of this.effects) effect.age += dt;
      this.effects = this.effects.filter(effect => effect.age < effect.duration);
      for (const unit of this.units) { unit.cooldown = Math.max(0, unit.cooldown - dt); unit.pulse = Math.max(0, unit.pulse - dt); }
      if (this.waveActive && this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 1e-8) {
          this._spawnEnemy(this.spawnQueue.shift());
          this.spawnTimer += Math.max(0.43, 1.35 - (this.wave - 1) * 0.055);
        }
      }
      for (const enemy of this.enemies.slice()) {
        enemy.hit = Math.max(0, enemy.hit - dt); enemy.slowTime = Math.max(0, enemy.slowTime - dt);
        if (!enemy.slowTime) enemy.slow = 0;
        enemy.progress += enemy.speed * (1 - enemy.slow) * dt; this._positionEnemy(enemy);
        if (enemy.progress >= PATH_LENGTH) {
          this.enemies.splice(this.enemies.indexOf(enemy), 1); this.lives = Math.max(0, this.lives - enemy.damage);
          this._effect('leak', { x: 352, y: 625 }); this._event('hit', { lives: this.lives, damage: enemy.damage, enemyId: enemy.id });
          if (this.lives === 0) { this._lose(); return; }
        }
      }
      for (const unit of this.units) {
        if (unit.cooldown > 0) continue;
        const stats = statsForLevel(unit.level);
        // Prioritize the enemy nearest the exit, not array insertion order.
        const target = this.enemies.filter(enemy => Math.hypot(enemy.x - unit.x, enemy.y - unit.y) <= stats.range)
          .sort((a, b) => b.progress - a.progress)[0];
        if (!target) continue;
        this.bullets.push({ id: ++this.sequence, x: unit.x, y: unit.y, targetId: target.id, level: unit.level,
          damage: stats.damage, splash: stats.splash, slow: stats.slow, speed: 360 + unit.level * 14, age: 0 });
        unit.cooldown = stats.cooldown; unit.pulse = Math.max(unit.pulse, 0.14);
        this._event('shoot', { unitId: unit.id, level: unit.level, x: unit.x, y: unit.y, targetId: target.id });
      }
      const remainingBullets = [];
      for (const bullet of this.bullets) {
        bullet.age += dt;
        const target = this.enemies.find(enemy => enemy.id === bullet.targetId);
        if (!target || bullet.age > 3) continue;
        const dx = target.x - bullet.x, dy = target.y - bullet.y, distance = Math.hypot(dx, dy), travel = bullet.speed * dt;
        if (distance <= travel + 6) {
          const nearby = bullet.splash ? this.enemies.filter(enemy => enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= bullet.splash) : [];
          this._damage(target, bullet.damage, bullet.slow);
          for (const enemy of nearby) this._damage(enemy, bullet.damage * 0.45, bullet.slow);
        } else { bullet.x += dx / distance * travel; bullet.y += dy / distance * travel; remainingBullets.push(bullet); }
      }
      this.bullets = remainingBullets;
      if (this.waveActive && !this.spawnQueue.length && !this.enemies.length) {
        this.waveActive = false; this.nextWaveIn = 5;
        const bonus = 15 + this.wave * 3; this.gold += bonus; this.score += this.wave * 5;
        this._event('clear', { wave: this.wave, gold: bonus }); this._notify();
      } else if (!this.waveActive) {
        this.nextWaveIn = Math.max(0, this.nextWaveIn - dt);
        if (this.nextWaveIn <= 1e-8) { this._beginWave(); this._notify(); }
      }
      if (this.changeTimer >= 0.15) { this.changeTimer = 0; this._notify(); }
    }

    _damage(enemy, amount, slow) {
      if (!this.enemies.includes(enemy)) return;
      enemy.hp = Math.max(0, enemy.hp - amount); enemy.hit = 0.12;
      if (slow) { enemy.slow = Math.max(enemy.slow, slow); enemy.slowTime = 0.8; }
      this._effect('hit', enemy, { duration: 0.16 });
      if (enemy.hp > 0) return;
      this.enemies.splice(this.enemies.indexOf(enemy), 1); this.kills++;
      this.gold += enemy.reward; const points = (enemy.boss ? 50 : 10) + this.wave * 2; this.score += points;
      this._effect('kill', enemy, { tint: enemy.tint, boss: enemy.boss });
      this._effect('score', enemy, { text: `+${enemy.reward}`, duration: 0.7 });
      this._event('kill', { enemyId: enemy.id, kind: enemy.kind, boss: enemy.boss, gold: enemy.reward, score: points });
    }

    _lose() {
      if (this.completed) return;
      this.status = 'lost'; this.isPaused = false; this.completed = true; this.accumulator = 0;
      this._event('lose', { score: this.score, wave: this.wave }); this._notify(); this.onComplete(this.getState());
    }
  }

  DefenseGame.WIDTH = WIDTH; DefenseGame.HEIGHT = HEIGHT; DefenseGame.SLOTS = SLOTS; DefenseGame.PATH = PATH;
  DefenseGame.PATH_LENGTH = PATH_LENGTH; DefenseGame.upgradeCost = upgradeCost; DefenseGame.statsForLevel = statsForLevel;
  root.DefenseGame = DefenseGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = DefenseGame;
})(typeof window !== 'undefined' ? window : globalThis);
