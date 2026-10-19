(function (root) {
  'use strict';

  const WIDTH = 400, HEIGHT = 650, STEP_MS = 1000 / 60, MAX_DELTA = 250;
  const PATH = Object.freeze([{ x: 32, y: -35 }, { x: 32, y: 315 }, { x: 366, y: 315 }, { x: 366, y: 345 }].map(Object.freeze));
  const SUPPLY_LANE = Object.freeze({ x: 366, startY: 690, stopY: 395, spacing: 52, capacity: 6 });
  const SLOTS = Object.freeze([90, 160, 230, 395, 465, 535].flatMap(y => [85, 155, 225, 295].map(x => ({ x, y }))).map((slot, id) => Object.freeze({ id, ...slot })));
  const FALLBACK_TYPES = [
    { kind: 'whisky', name: '威士忌', hp: 4, speed: 24, reward: 9, tint: '#c58a39' },
    { kind: 'brandy', name: '白兰地', hp: 7, speed: 18, reward: 15, tint: '#a76135' },
    { kind: 'wine', name: '红酒', hp: 3, speed: 29, reward: 8, tint: '#7b344d' },
    { kind: 'baijiu', name: '白酒', hp: 5, speed: 25, reward: 12, tint: '#d65a42' },
    { kind: 'gin', name: '金酒', hp: 2, speed: 37, reward: 8, tint: '#4d9bb1' },
    { kind: 'champagne', name: '香槟', hp: 10, speed: 20, reward: 20, tint: '#71915b' },
  ];
  const PATH_LENGTH = PATH.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y), 0);
  const TAU = Math.PI * 2, SAFE_LIMIT = Number.MAX_SAFE_INTEGER;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const safe = value => Math.min(SAFE_LIMIT, Math.max(0, Number.isFinite(value) ? value : SAFE_LIMIT));
  const levelNumber = level => Number.isSafeInteger(level) && level >= 0 ? level : 0;
  const noop = () => {};
  const statsForLevel = level => {
    const n = levelNumber(level), ability = n >= 11 ? 'lightning' : n >= 7 ? 'fire' : n >= 3 ? 'ice' : 'normal';
    const orbitRadius = 82 + Math.min(26, n * 1.6);
    return { damage: safe(n + 1), range: orbitRadius, orbitRadius, bladeCount: Math.min(4, 1 + Math.floor(n / 4)),
      angularSpeed: 2.6 + Math.min(0.6, n * 0.025), bladeLength: 24, bladeWidth: 7,
      slow: n >= 3 ? 0.28 : 0, splash: n >= 7 ? 42 : 0, chain: n >= 11 ? 3 : 0,
      ability, specialName: ({ normal: '环刃', ice: '霜刃', fire: '焰刃', lightning: '雷刃' })[ability] };
  };
  const upgradeCost = level => Number.isSafeInteger(level) && level >= 0 && level < SAFE_LIMIT
    ? safe(Math.max(15, Math.round(safe(18 + level * 8 + level * level * 0.6) / 5) * 5)) : null;
  const bladesFor = (unit, time) => {
    const stats = statsForLevel(unit.level), phase = Number.isFinite(unit.phase) ? unit.phase : (unit.id || 0) * 2.399963229728653;
    const rotation = ((Number.isFinite(time) ? time : 0) * stats.angularSpeed + phase) % TAU;
    return Array.from({ length: stats.bladeCount }, (_, index) => {
      const angle = rotation + index * TAU / stats.bladeCount, dx = Math.cos(angle), dy = Math.sin(angle);
      const inner = stats.orbitRadius - stats.bladeLength / 2, outer = stats.orbitRadius + stats.bladeLength / 2;
      return { index, angle, x: unit.x + dx * stats.orbitRadius, y: unit.y + dy * stats.orbitRadius,
        innerX: unit.x + dx * inner, innerY: unit.y + dy * inner, outerX: unit.x + dx * outer, outerY: unit.y + dy * outer };
    });
  };
  const segmentDistance = (point, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? clamp(((point.x - ax) * dx + (point.y - ay) * dy) / lengthSq, 0, 1) : 0;
    return Math.hypot(point.x - ax - t * dx, point.y - ay - t * dy);
  };

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
      this.gold = 60; this.lives = 12; this.maxLives = 12; this.kills = 0; this.reserve = 0; this.hatched = 0;
      this.maxLevel = 0; this.elapsed = 0; this.accumulator = 0; this.nextWaveIn = 0;
      this.units = []; this.enemies = []; this.supplies = []; this.bullets = []; this.effects = [];
      this.spawnQueue = []; this.spawnTimer = 0; this.waveActive = false; this.completed = false;
      this.sequence = 0; this.changeTimer = 0; this.supplySequence = 0;
      this._makeUnit(15); this._spawnSupply(); this._notify();
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
        maxLevel: this.maxLevel, reserve: this.reserve, hatched: this.hatched, supplyCount: this.supplies.length, nextWaveIn: this.nextWaveIn,
        remaining: this.enemies.length + this.spawnQueue.length, elapsed: this.elapsed };
    }

    place(slot) {
      if (!this._canAct() || !this._validSlot(slot) || this._unitAt(slot) || this.reserve < 1) return false;
      this.reserve--; const unit = this._makeUnit(slot);
      this._effect('spawn', unit, { level: 0 }); this._event('spawn', { unitId: unit.id, slot, level: 0 }); this._notify(); return true;
    }

    move(fromSlot, toSlot) {
      if (!this._canAct() || !this._validSlot(fromSlot) || !this._validSlot(toSlot) || fromSlot === toSlot) return false;
      const source = this._unitAt(fromSlot), target = this._unitAt(toSlot);
      if (!source || (target && (target.level !== source.level || target.level >= SAFE_LIMIT))) return false;
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
      const unit = { id: ++this.sequence, slot, level: 0, x: SLOTS[slot].x, y: SLOTS[slot].y, cooldown: 0, pulse: 0, phase: this.sequence * 2.399963229728653, bladeHits: {} };
      this.units.push(unit); return unit;
    }
    _evolve(unit, type) {
      unit.level++; unit.cooldown = 0; unit.bladeHits = {}; unit.pulse = 0.6; this.maxLevel = Math.max(this.maxLevel, unit.level);
      this._effect(type, unit, { level: unit.level, duration: 0.8 });
      this._event(type, { unitId: unit.id, slot: unit.slot, level: unit.level });
    }

    _spawnSupply() {
      // Eggs remain available until broken. A full lane waits instead of
      // expiring rewards or allowing offscreen queues to grow indefinitely.
      const first = this.supplySequence++ === 0;
      const maxHp = first ? 2 : Math.round(safe(3 + Math.min(9, this.supplySequence * 0.3) + Math.max(0, this.wave - 5) * 0.4));
      this.supplies.push({ id: ++this.sequence, x: SUPPLY_LANE.x, y: SUPPLY_LANE.startY,
        hp: maxHp, maxHp, hit: 0, speed: 36 + Math.min(6, this.wave * 0.35) });
    }

    _advanceSupplies(dt) {
      this.supplies.sort((a, b) => a.y - b.y || a.id - b.id);
      for (let index = 0; index < this.supplies.length; index++) {
        const supply = this.supplies[index];
        const stop = index ? this.supplies[index - 1].y + SUPPLY_LANE.spacing : SUPPLY_LANE.stopY;
        supply.y = Math.max(stop, supply.y - supply.speed * dt);
        supply.hit = Math.max(0, supply.hit - dt);
      }
      const last = this.supplies[this.supplies.length - 1];
      if (this.supplies.length < SUPPLY_LANE.capacity && (!last || last.y <= SUPPLY_LANE.startY - SUPPLY_LANE.spacing)) this._spawnSupply();
    }

    _swing(unit, dt) {
      const stats = statsForLevel(unit.level), hits = unit.bladeHits || (unit.bladeHits = {});
      for (const key of Object.keys(hits)) if (hits[key] <= this.elapsed) delete hits[key];
      // Substep the same radial segments the renderer draws. The thin blade
      // cannot tunnel between ticks, and each blade hits once per revolution.
      const samples = Math.max(1, Math.ceil(stats.angularSpeed * dt / 0.025));
      const objects = [...this.enemies.map(object => ({ type: 'enemy', object })), ...this.supplies.map(object => ({ type: 'supply', object }))];
      const candidates = objects.filter(({ object }) => {
        const radius = object.boss ? 17 : 13;
        const distance = Math.hypot(object.x - unit.x, object.y - unit.y);
        return object.y <= HEIGHT + 20 && Math.abs(distance - stats.orbitRadius) <= stats.bladeLength / 2 + radius + stats.bladeWidth;
      });
      if (!candidates.length) return;
      for (let sample = 0; sample <= samples; sample++) {
        const at = this.elapsed - dt + dt * sample / samples;
        for (const blade of bladesFor(unit, at)) {
          for (const { type, object } of candidates) {
            const key = `${type}:${object.id}:${blade.index}`;
            if (hits[key] || !(type === 'supply' ? this.supplies : this.enemies).includes(object)) continue;
            const radius = object.boss ? 17 : 13;
            if (segmentDistance(object, blade.innerX, blade.innerY, blade.outerX, blade.outerY) > radius + stats.bladeWidth / 2) continue;
            hits[key] = this.elapsed + TAU / stats.angularSpeed * 0.8;
            this._bladeHit(unit, blade, object, type, stats);
          }
        }
      }
    }

    _bladeHit(unit, blade, target, type, stats) {
      const objects = type === 'supply' ? this.supplies : this.enemies;
      const origin = { x: target.x, y: target.y };
      const nearby = stats.splash ? objects.filter(object => object !== target && Math.hypot(object.x - target.x, object.y - target.y) <= stats.splash) : [];
      const hit = (object, amount) => type === 'supply' ? this._damageSupply(object, amount) : this._damage(object, amount, stats.slow);
      hit(target, stats.damage);
      for (const object of nearby) hit(object, stats.damage * 0.45);
      this._effect('slash', origin, { angle: blade.angle, ability: stats.ability, duration: 0.2 });
      if (stats.splash) this._effect('fire', origin, { radius: stats.splash, duration: 0.35 });
      if (stats.chain) {
        let previous = origin;
        const struck = new Set([target]);
        for (let index = 0; index < stats.chain; index++) {
          const next = objects.filter(object => !struck.has(object) && Math.hypot(object.x - previous.x, object.y - previous.y) <= 90)
            .sort((a, b) => Math.hypot(a.x - previous.x, a.y - previous.y) - Math.hypot(b.x - previous.x, b.y - previous.y))[0];
          if (!next) break;
          this._effect('chain', next, { fromX: previous.x, fromY: previous.y, duration: 0.25 });
          const position = { x: next.x, y: next.y }; struck.add(next); hit(next, stats.damage * 0.6); previous = position;
        }
      }
      if (stats.splash || stats.chain) this._event('special', { ability: stats.ability, x: origin.x, y: origin.y, unitId: unit.id });
      unit.pulse = Math.max(unit.pulse, 0.1);
      this._event('slash', { unitId: unit.id, level: unit.level, x: origin.x, y: origin.y,
        targetId: target.id, targetType: type, bladeIndex: blade.index, ability: stats.ability, damage: stats.damage });
    }

    _beginWave() {
      this.wave = safe(this.wave + 1); this.waveActive = true; this.nextWaveIn = 0;
      const count = Math.min(44, 6 + this.wave * 2);
      const kinds = this.wave === 1 ? ['wine', 'whisky'] : this.wave < 3 ? ['wine', 'whisky', 'gin'] : this.wave < 5 ? ['wine', 'whisky', 'gin', 'baijiu'] : this.types.map(type => type.kind);
      this.spawnQueue = Array.from({ length: count }, (_, index) => ({ kind: kinds[Math.floor(this._roll() * kinds.length)], boss: this.wave % 5 === 0 && index === count - 1 }));
      if (this.wave % 5 === 0) this.spawnQueue[this.spawnQueue.length - 1].kind = 'champagne';
      this.spawnTimer = this.wave === 1 ? 2 : 0.7;
      this._event('wave', { wave: this.wave, count, boss: this.wave % 5 === 0 });
    }

    _spawnEnemy(entry) {
      const type = this.types.find(value => value.kind === entry.kind) || this.types[0];
      const age = Math.max(0, this.wave - 1), scaling = safe(1 + age * 0.12 + age * age * 0.003);
      const maxHp = Math.max(1, Math.round(safe(type.hp * scaling * (entry.boss ? 3 : 1))));
      const enemy = { id: ++this.sequence, kind: type.kind, name: type.name, tint: type.tint, x: PATH[0].x, y: PATH[0].y,
        hp: maxHp, maxHp, progress: 0, hit: 0, boss: entry.boss, speed: type.speed * 0.8 * Math.min(1.85, 1 + (this.wave - 1) * 0.028),
        reward: Math.round(safe(type.reward * (1 + (this.wave - 1) * 0.09) * (entry.boss ? 4 : 1))),
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
      this._advanceSupplies(dt);
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
          this._effect('leak', PATH[PATH.length - 1]); this._event('hit', { lives: this.lives, damage: enemy.damage, enemyId: enemy.id });
          if (this.lives === 0) { this._lose(); return; }
        }
      }
      for (const unit of this.units.slice()) this._swing(unit, dt);
      if (this.waveActive && !this.spawnQueue.length && !this.enemies.length) {
        this.waveActive = false; this.nextWaveIn = 5;
        const bonus = safe(15 + this.wave * 3); this.gold = safe(this.gold + bonus); this.score = safe(this.score + this.wave * 5);
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
      this.gold = safe(this.gold + enemy.reward); const points = safe((enemy.boss ? 50 : 10) + this.wave * 2); this.score = safe(this.score + points);
      this._effect('kill', enemy, { tint: enemy.tint, boss: enemy.boss });
      this._effect('score', enemy, { text: `+${enemy.reward}`, duration: 0.7 });
      this._event('kill', { enemyId: enemy.id, kind: enemy.kind, boss: enemy.boss, gold: enemy.reward, score: points });
    }

    _damageSupply(supply, amount) {
      if (!this.supplies.includes(supply)) return;
      supply.hp = Math.max(0, supply.hp - amount); supply.hit = 0.18;
      this._effect('supplyHit', supply, { duration: 0.18 });
      this._event('supplyHit', { supplyId: supply.id, hp: supply.hp, maxHp: supply.maxHp });
      if (supply.hp > 0) return;
      this.supplies.splice(this.supplies.indexOf(supply), 1); this.hatched++;
      const slot = SLOTS.filter(value => !this._unitAt(value.id)).sort((a, b) => Math.hypot(a.x - supply.x, a.y - supply.y) - Math.hypot(b.x - supply.x, b.y - supply.y) || a.id - b.id)[0];
      let details;
      if (slot) {
        const unit = this._makeUnit(slot.id); unit.pulse = 0.6;
        details = { supplyId: supply.id, unitId: unit.id, slot: slot.id, level: 0 };
      } else {
        this.reserve = safe(this.reserve + 1); details = { supplyId: supply.id, reserve: true, level: 0 };
      }
      this._effect('hatch', supply, { ...details, duration: 0.8 }); this._event('hatch', details); this._notify();
    }

    _lose() {
      if (this.completed) return;
      this.status = 'lost'; this.isPaused = false; this.completed = true; this.accumulator = 0;
      this._event('lose', { score: this.score, wave: this.wave }); this._notify(); this.onComplete(this.getState());
    }
  }

  DefenseGame.WIDTH = WIDTH; DefenseGame.HEIGHT = HEIGHT; DefenseGame.SLOTS = SLOTS; DefenseGame.PATH = PATH;
  DefenseGame.PATH_LENGTH = PATH_LENGTH; DefenseGame.upgradeCost = upgradeCost; DefenseGame.statsForLevel = statsForLevel; DefenseGame.bladesFor = bladesFor;
  DefenseGame.SUPPLY_LANE = SUPPLY_LANE;
  root.DefenseGame = DefenseGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = DefenseGame;
})(typeof window !== 'undefined' ? window : globalThis);
