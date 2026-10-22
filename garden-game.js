(function (root) {
  'use strict';

  const ROWS = 5, COLS = 9, STEP_MS = 1000 / 60;
  const PLANTS = [
    { id: 'sun', name: '日光伙伴', cost: 50, cooldown: 5000, photoIndex: 1, color: '#f3bc42', description: '每 8 秒产出 25 阳光', hp: 120, production: 8000 },
    { id: 'shooter', name: '飞叶射手', cost: 100, cooldown: 4500, photoIndex: 3, color: '#6d9f55', description: '沿本行发射飞叶', hp: 150, damage: 20, attackInterval: 1400 },
    { id: 'wall', name: '磐石守卫', cost: 50, cooldown: 12000, photoIndex: 5, color: '#bc8d59', description: '高生命，挡住入侵者', hp: 700 },
    { id: 'ice', name: '冰霜伙伴', cost: 175, cooldown: 6500, photoIndex: 7, color: '#75c2da', description: '冰弹减速，持续 3 秒', hp: 150, damage: 18, attackInterval: 1700 },
    { id: 'burst', name: '双星射手', cost: 200, cooldown: 6500, photoIndex: 9, color: '#ac78b5', description: '一次发射两枚飞叶', hp: 150, damage: 20, attackInterval: 1500 },
    { id: 'bomb', name: '焰火伙伴', cost: 150, cooldown: 20000, photoIndex: 11, color: '#e17a5e', description: '短暂引燃后炸开周围三行', hp: 150, fuse: 800, damage: 450 },
  ].map(Object.freeze);
  const PLANT_BY_ID = Object.fromEntries(PLANTS.map(plant => [plant.id, plant]));
  const ENEMIES = Object.freeze({
    walker: Object.freeze({ name: '迷路来客', hp: 100, speed: .2, bite: 26 }),
    helmet: Object.freeze({ name: '铁帽来客', hp: 230, speed: .18, bite: 30 }),
    runner: Object.freeze({ name: '急行来客', hp: 90, speed: .3, bite: 24 }),
    brute: Object.freeze({ name: '重装来客', hp: 400, speed: .13, bite: 38 }),
  });
  const LEVELS = [
    { id: 'morning', title: '01 · 晨光小院', subtitle: '先收集阳光，再照顾每一条小路', cards: ['sun', 'shooter', 'wall'], startSun: 200, duration: 125000, waves: [
      { at: 20000, count: 4, spacing: 7500, pool: ['walker'] },
      { at: 52000, count: 5, spacing: 4500, pool: ['walker', 'walker', 'helmet'] },
      { at: 84000, count: 7, spacing: 2100, pool: ['walker', 'walker', 'helmet'] },
    ] },
    { id: 'breeze', title: '02 · 风过花园', subtitle: '快步与护甲来客，试试冰霜和磐石', cards: ['sun', 'shooter', 'wall', 'ice', 'burst'], startSun: 200, duration: 140000, waves: [
      { at: 18000, count: 5, spacing: 5000, pool: ['walker', 'walker', 'runner'] },
      { at: 47000, count: 8, spacing: 3600, pool: ['walker', 'helmet', 'runner'] },
      { at: 84000, count: 10, spacing: 2600, pool: ['helmet', 'runner', 'walker', 'brute'] },
    ] },
    { id: 'sunset', title: '03 · 落日守望', subtitle: '三轮密集来客，留一手焰火救场', cards: ['sun', 'shooter', 'wall', 'ice', 'burst', 'bomb'], startSun: 225, duration: 150000, waves: [
      { at: 16000, count: 6, spacing: 4800, pool: ['walker', 'walker', 'runner'] },
      { at: 48000, count: 10, spacing: 3200, pool: ['walker', 'helmet', 'runner', 'helmet'] },
      { at: 90000, count: 14, spacing: 2200, pool: ['helmet', 'runner', 'brute', 'walker'] },
    ] },
  ].map(level => Object.freeze({ ...level, cards: Object.freeze(level.cards), waves: Object.freeze(level.waves.map(wave => Object.freeze({ ...wave, pool: Object.freeze(wave.pool) }))) }));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  class GardenGame {
    constructor(options = {}) {
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
      this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
      this.reset(0);
    }

    reset(levelIndex = 0) {
      this.levelIndex = Number.isInteger(levelIndex) ? clamp(levelIndex, 0, LEVELS.length - 1) : 0;
      this.level = LEVELS[this.levelIndex];
      this.status = 'ready'; this.sun = this.level.startSun; this.kills = 0;
      this.elapsed = 0; this.wave = 0; this.totalWaves = this.level.waves.length;
      this.plants = []; this.enemies = []; this.projectiles = []; this.suns = []; this.effects = [];
      this.mowers = Array.from({ length: ROWS }, (_, row) => ({ row, active: false, used: false, x: -.5 }));
      this.cooldowns = Object.fromEntries(PLANTS.map(plant => [plant.id, 0]));
      this._nextId = 1; this._accumulator = 0; this._skyTimer = 2800; this._spawnIndex = 0;
      this._spawnSchedule = [];
      this.level.waves.forEach((wave, waveIndex) => {
        for (let i = 0; i < wave.count; i++) {
          // The first visitor previews the middle lane; later arrivals vary by run.
          const row = waveIndex === 0 && i === 0 ? 2 : Math.floor(this._random() * ROWS);
          const type = wave.pool[Math.floor(this._random() * wave.pool.length)];
          this._spawnSchedule.push({ at: wave.at + i * wave.spacing, row, type, wave: waveIndex + 1 });
        }
      });
      this._spawnSchedule.sort((a, b) => a.at - b.at);
      this.totalEnemies = this._spawnSchedule.length;
      this._notify();
      return this.getState();
    }

    getState() {
      return {
        status: this.status, levelIndex: this.levelIndex, level: this.level,
        sun: this.sun, kills: this.kills, elapsed: this.elapsed,
        wave: this.wave, totalWaves: this.totalWaves, spawned: this._spawnIndex,
        totalEnemies: this.totalEnemies, remainingEnemies: this.totalEnemies - this.kills,
        spawnProgress: this.totalEnemies ? this._spawnIndex / this.totalEnemies : 0,
        plants: this.plants, enemies: this.enemies, projectiles: this.projectiles,
        suns: this.suns, mowers: this.mowers, effects: this.effects, cooldowns: this.cooldowns,
      };
    }

    start() {
      if (this.status !== 'ready') return false;
      this.status = 'running'; this._emit('start'); this._notify(); return true;
    }

    pause(paused = true) {
      if (paused && this.status === 'running') this.status = 'paused';
      else if (!paused && this.status === 'paused') this.status = 'running';
      else return false;
      this._notify(); return true;
    }

    plant(type, row, col) {
      const config = PLANT_BY_ID[type];
      if (this.status !== 'running' || !config || !this.level.cards.includes(type) || !this._validCell(row, col) || this.cooldowns[type] > 0 || this.sun < config.cost || this._plantAt(row, col)) return false;
      const plant = {
        id: this._id('plant'), type, row, col, hp: config.hp, maxHp: config.hp, attackPulse: 0,
        attackTimer: 200, sunTimer: 4000, fuse: config.fuse || 0,
      };
      this.sun -= config.cost; this.cooldowns[type] = config.cooldown; this.plants.push(plant);
      this._effect('plant', row, col + .5, 500); this._emit('plant', { plant }); this._notify();
      return true;
    }

    remove(row, col) {
      if (this.status !== 'running' || !this._validCell(row, col)) return false;
      const plant = this._plantAt(row, col);
      if (!plant) return false;
      this.plants = this.plants.filter(item => item !== plant);
      this._effect('remove', row, col + .5, 400); this._emit('remove', { plant }); this._notify(); return true;
    }

    collectSun(id) {
      if (this.status !== 'running') return false;
      const index = this.suns.findIndex(sun => sun.id === id);
      if (index < 0) return false;
      const [sun] = this.suns.splice(index, 1);
      this.sun += sun.value;
      this._effect('collect', Math.floor(sun.y), sun.x, 650, { value: sun.value, y: sun.y });
      this._emit('collect', { sun, value: sun.value }); this._notify(); return true;
    }

    step(milliseconds) {
      if (this.status !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
      // Cap background-tab catch-up, then use fixed slices for swept collisions.
      this._accumulator += Math.min(milliseconds, 250);
      while (this._accumulator + 1e-7 >= STEP_MS && this.status === 'running') {
        this._accumulator = Math.max(0, this._accumulator - STEP_MS);
        this._step(STEP_MS);
      }
      this._notify();
    }

    _step(dt) {
      this.elapsed += dt;
      for (const type of Object.keys(this.cooldowns)) this.cooldowns[type] = Math.max(0, this.cooldowns[type] - dt);
      this.effects.forEach(effect => { effect.life -= dt; });
      this.effects = this.effects.filter(effect => effect.life > 0);
      this.suns.forEach(sun => { sun.life -= dt; });
      this.suns = this.suns.filter(sun => sun.life > 0);
      this._skyTimer -= dt;
      if (this._skyTimer <= 0) {
        this._skyTimer += 6500;
        this._sun(.7 + this._random() * 7.6, .5 + this._random() * 4, 'sky');
      }
      while (this._spawnIndex < this._spawnSchedule.length && this._spawnSchedule[this._spawnIndex].at <= this.elapsed + 1e-7) {
        const entry = this._spawnSchedule[this._spawnIndex++];
        if (entry.wave !== this.wave) {
          this.wave = entry.wave; this._emit('wave', { wave: this.wave, totalWaves: this.totalWaves });
        }
        this._spawnEnemy(entry.type, entry.row);
      }
      for (const plant of this.plants.slice()) this._stepPlant(plant, dt);
      for (const projectile of this.projectiles) this._stepProjectile(projectile, dt);
      this.projectiles = this.projectiles.filter(projectile => !projectile.dead && projectile.x <= COLS + 1);
      for (const mower of this.mowers) this._stepMower(mower, dt);
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || this.status !== 'running') continue;
        this._stepEnemy(enemy, dt);
      }
      this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
      this.plants = this.plants.filter(plant => plant.hp > 0);
      if (this.status === 'running' && this._spawnIndex === this._spawnSchedule.length && !this.enemies.length) {
        this.status = 'won'; this._emit('win', { levelIndex: this.levelIndex, kills: this.kills });
      }
    }

    _stepPlant(plant, dt) {
      if (plant.hp <= 0) return;
      const config = PLANT_BY_ID[plant.type];
      plant.attackPulse = Math.max(0, plant.attackPulse - dt);
      if (plant.type === 'sun') {
        plant.sunTimer -= dt;
        if (plant.sunTimer <= 0) {
          plant.sunTimer += config.production; plant.attackPulse = 450;
          this._sun(plant.col + .5, plant.row + .3, 'plant');
        }
      } else if (plant.type === 'bomb') {
        plant.fuse -= dt;
        if (plant.fuse <= 0) {
          const x = plant.col + .5;
          for (const enemy of this.enemies) if (enemy.hp > 0 && Math.abs(enemy.row - plant.row) <= 1 && Math.abs(enemy.x - x) <= 1.8) this._damage(enemy, config.damage, 'bomb');
          plant.hp = 0; this._effect('explode', plant.row, x, 850, { radius: 1.8 });
          this._emit('explode', { row: plant.row, x });
        }
      } else if (config.attackInterval) {
        plant.attackTimer = Math.max(0, plant.attackTimer - dt);
        const target = this.enemies.some(enemy => enemy.hp > 0 && enemy.row === plant.row && enemy.x >= plant.col + .35 && enemy.x <= COLS + .5);
        if (target && plant.attackTimer <= 0) {
          plant.attackTimer = config.attackInterval; plant.attackPulse = 230;
          const count = plant.type === 'burst' ? 2 : 1;
          for (let i = 0; i < count; i++) this.projectiles.push({ id: this._id('shot'), type: plant.type, row: plant.row, x: plant.col + .78 - i * .28, damage: config.damage, speed: 5.1 });
          this._emit('shot', { plant, row: plant.row, x: plant.col + .5, count });
        }
      }
    }

    _stepProjectile(projectile, dt) {
      if (projectile.dead) return;
      const from = projectile.x, to = from + projectile.speed * dt / 1000;
      const hit = this.enemies.filter(enemy => enemy.hp > 0 && enemy.row === projectile.row && enemy.x + .24 >= from && enemy.x - .24 <= to).sort((a, b) => a.x - b.x)[0];
      if (hit) {
        projectile.x = hit.x; projectile.dead = true;
        this._damage(hit, projectile.damage, projectile.type);
        if (projectile.type === 'ice' && hit.hp > 0) {
          hit.slowTime = 3000; this._effect('ice', hit.row, hit.x, 450);
        }
      } else projectile.x = to;
    }

    _stepEnemy(enemy, dt) {
      enemy.hitPulse = Math.max(0, enemy.hitPulse - dt);
      const slow = enemy.slowTime > 0 ? .5 : 1;
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
      const config = ENEMIES[enemy.type];
      const nextX = enemy.x - config.speed * slow * dt / 1000;
      const target = this.plants.filter(plant => plant.hp > 0 && plant.row === enemy.row && plant.col + .86 >= nextX && plant.col + .2 <= enemy.x).sort((a, b) => b.col - a.col)[0];
      enemy.eating = Boolean(target);
      if (target) {
        enemy.x = Math.max(enemy.x, target.col + .86);
        target.hp = Math.max(0, target.hp - config.bite * dt / 1000);
      } else enemy.x = nextX;
      const mower = this.mowers[enemy.row];
      if (!mower.used && enemy.x <= .04) {
        mower.used = true; mower.active = true; mower.x = -.45;
        this._effect('mower', enemy.row, -.1, 800); this._emit('mower', { row: enemy.row });
        this._damage(enemy, enemy.hp, 'mower');
      } else if (mower.active && enemy.x <= mower.x + .55) this._damage(enemy, enemy.hp, 'mower');
      else if (enemy.x < -.7) {
        this.status = 'lost'; this._emit('lose', { row: enemy.row, levelIndex: this.levelIndex });
      }
    }

    _stepMower(mower, dt) {
      if (!mower.active) return;
      const from = mower.x;
      mower.x += 5.5 * dt / 1000;
      for (const enemy of this.enemies) if (enemy.hp > 0 && enemy.row === mower.row && enemy.x >= from - .55 && enemy.x <= mower.x + .55) this._damage(enemy, enemy.hp, 'mower');
      if (mower.x > COLS + 1) mower.active = false;
    }

    _damage(enemy, amount, source) {
      if (enemy.hp <= 0) return;
      enemy.hp = Math.max(0, enemy.hp - amount); enemy.hitPulse = 160;
      this._effect('hit', enemy.row, enemy.x, 220, { value: amount, source });
      this._emit('hit', { enemy, damage: amount, source, killed: enemy.hp <= 0 });
      if (enemy.hp <= 0) this.kills++;
    }

    _spawnEnemy(type, row) {
      const config = ENEMIES[type];
      const enemy = { id: this._id('enemy'), type, row, x: COLS + .35, hp: config.hp, maxHp: config.hp, slowTime: 0, hitPulse: 0, eating: false };
      this.enemies.push(enemy); return enemy;
    }

    _sun(x, y, source) {
      const sun = { id: this._id('sun'), x, y, value: 25, life: 15000, maxLife: 15000, source };
      this.suns.push(sun); this._effect('sun', Math.floor(y), x, 500, { y }); return sun;
    }

    _effect(type, row, x, life, extra = {}) { this.effects.push({ type, row, x, life, maxLife: life, ...extra }); }
    _plantAt(row, col) { return this.plants.find(plant => plant.row === row && plant.col === col && plant.hp > 0); }
    _validCell(row, col) { return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < ROWS && col >= 0 && col < COLS; }
    _id(prefix) { return `${prefix}-${this._nextId++}`; }
    _random() { const value = Number(this.random()); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : .5; }
    _emit(type, detail = {}) { this.onEvent({ type, ...detail }); }
    _notify() { this.onChange(this.getState()); }
  }

  GardenGame.ROWS = ROWS; GardenGame.COLS = COLS;
  GardenGame.PLANTS = Object.freeze(PLANTS); GardenGame.LEVELS = Object.freeze(LEVELS);
  GardenGame.ENEMIES = ENEMIES;
  root.GardenGame = GardenGame;
  if (typeof module === 'object' && module.exports) module.exports = GardenGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
