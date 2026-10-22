(function (root) {
  'use strict';

  const ROWS = 5, COLS = 9, STEP_MS = 1000 / 60;
  const PLANTS = [
    { id: 'sun', name: '日光伙伴', cost: 50, cooldown: 7500, photoIndex: 1, color: '#f3bc42', description: '首产约7秒，之后每24秒产出25阳光', hp: 300, production: 24000 },
    { id: 'shooter', name: '飞叶射手', cost: 100, cooldown: 7500, photoIndex: 3, color: '#6d9f55', description: '约1.4秒一发，每发20伤害', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'wall', name: '磐石守卫', cost: 50, cooldown: 30000, initialCooldown: 15000, photoIndex: 5, color: '#bc8d59', description: '4000生命，挡住入侵者', hp: 4000 },
    { id: 'ice', name: '冰霜伙伴', cost: 175, cooldown: 7500, photoIndex: 7, color: '#75c2da', description: '20伤害，移动和啃咬减半10秒', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'burst', name: '双星射手', cost: 200, cooldown: 7500, photoIndex: 9, color: '#ac78b5', description: '连续两发，每发20伤害', hp: 300, damage: 20, attackInterval: 1425 },
    { id: 'bomb', name: '焰火伙伴', cost: 150, cooldown: 50000, initialCooldown: 25000, photoIndex: 11, color: '#e17a5e', description: '1.2秒后在3×3范围造成1800伤害', hp: 300, fuse: 1200, damage: 1800 },
  ].map(Object.freeze);
  const PLANT_BY_ID = Object.fromEntries(PLANTS.map(plant => [plant.id, plant]));
  const ENEMIES = Object.freeze({
    walker: Object.freeze({ name: '迷路来客', hp: 270, armor: 0, speed: .2, bite: 100 }),
    helmet: Object.freeze({ name: '路障来客', hp: 640, armor: 370, speed: .2, bite: 100 }),
    runner: Object.freeze({ name: '撑杆来客', hp: 500, armor: 0, speed: .4, bite: 100, vault: true }),
    brute: Object.freeze({ name: '铁桶来客', hp: 1370, armor: 1100, speed: .2, bite: 100 }),
    flag: Object.freeze({ name: '旗帜来客', hp: 270, armor: 0, speed: .27, bite: 100 }),
  });
  const LEVELS = [
    { id: 'morning', title: '01 · 第一束阳光', subtitle: '一行草坪，从收集阳光和种植射手开始', cards: ['shooter'], activeRows: [2], shovel: false, reward: 'sun', startSun: 150, duration: 75000,
      tutorialGate: { type: 'shooter', count: 2, hint: '先收集阳光，在中间草坪种下2名飞叶射手' }, waves: [
      { at: 3000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 15000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 27000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 39000, count: 2, spacing: 1800, pool: ['walker'] },
    ] },
    { id: 'breeze', title: '02 · 日光伙伴', subtitle: '三行草坪，先发展阳光再布防', cards: ['shooter', 'sun'], activeRows: [1, 2, 3], shovel: false, reward: 'bomb', startSun: 50, duration: 145000,
      tutorialGate: { type: 'sun', count: 3, hint: '先种下3名日光伙伴；每次点击阳光收集25点' }, waves: [
      { at: 10000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 25000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 40000, count: 2, spacing: 4000, pool: ['walker'] },
      { at: 60000, count: 2, spacing: 3500, pool: ['walker'] },
      { at: 80000, count: 3, spacing: 2500, pool: ['walker'] },
      { at: 104000, count: 5, spacing: 900, pool: ['walker'], flag: true },
    ] },
    { id: 'sunset', title: '03 · 路障来客', subtitle: '护甲需要更多火力，焰火可以解围', cards: ['shooter', 'sun', 'bomb'], activeRows: [1, 2, 3], shovel: false, reward: 'wall', startSun: 50, duration: 160000, waves: [
      { at: 20000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 37000, count: 1, spacing: 0, pool: ['walker'] },
      { at: 55000, count: 2, spacing: 5000, pool: ['walker'] },
      { at: 76000, count: 2, spacing: 4500, pool: ['helmet', 'walker'] },
      { at: 100000, count: 3, spacing: 3000, pool: ['walker', 'helmet'] },
      { at: 126000, count: 6, spacing: 1000, pool: ['helmet', 'walker'], flag: true },
    ] },
    { id: 'practice', title: '自由演练', subtitle: '五行草坪，六名伙伴与所有白天来客', practice: true, cards: ['sun', 'shooter', 'wall', 'ice', 'burst', 'bomb'], activeRows: [0, 1, 2, 3, 4], shovel: true, reward: null, startSun: 50, duration: 300000, waves: [
      { at: 25000, count: 2, spacing: 20000, pool: ['walker'] },
      { at: 65000, count: 3, spacing: 15000, pool: ['walker'] },
      { at: 115000, count: 3, spacing: 12000, pool: ['walker', 'helmet'] },
      { at: 160000, count: 4, spacing: 9000, pool: ['walker', 'helmet', 'runner'] },
      { at: 215000, count: 4, spacing: 8000, pool: ['helmet', 'runner', 'brute', 'walker'] },
      { at: 275000, count: 8, spacing: 1000, pool: ['helmet', 'walker', 'brute'], flag: true },
    ] },
  ].map(level => Object.freeze({ ...level, cards: Object.freeze(level.cards), activeRows: Object.freeze(level.activeRows), tutorialGate: level.tutorialGate ? Object.freeze(level.tutorialGate) : null, waves: Object.freeze(level.waves.map(wave => Object.freeze({ ...wave, pool: Object.freeze(wave.pool) }))) }));
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
      this.spawnElapsed = 0; this.tutorialReady = !this.level.tutorialGate;
      this._plantedCounts = Object.fromEntries(PLANTS.map(plant => [plant.id, 0]));
      this.plants = []; this.enemies = []; this.projectiles = []; this.suns = []; this.effects = [];
      this.mowers = Array.from({ length: ROWS }, (_, row) => ({ row, enabled: this.level.activeRows.includes(row), active: false, used: false, x: -.5 }));
      this.cooldowns = Object.fromEntries(PLANTS.map(plant => [plant.id, plant.initialCooldown || 0]));
      this._nextId = 1; this._accumulator = 0; this._skyCount = 0; this._skyTimer = this._skyInterval(); this._spawnIndex = 0;
      this._spawnSchedule = [];
      this.level.waves.forEach((wave, waveIndex) => {
        for (let i = 0; i < wave.count; i++) {
          // The first visitor previews the middle lane; later arrivals vary by run.
          const rows = this.level.activeRows;
          const row = waveIndex === 0 && i === 0 ? 2 : rows[Math.floor(this._random() * rows.length)];
          const type = wave.flag && i === 0 ? 'flag' : wave.pool[Math.floor(this._random() * wave.pool.length)];
          this._spawnSchedule.push({ at: wave.at + i * wave.spacing, row, type, wave: waveIndex + 1, flag: Boolean(wave.flag) });
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
        activeRows: this.level.activeRows, tutorialReady: this.tutorialReady,
        tutorialHint: this.tutorialReady ? '' : this.level.tutorialGate.hint,
        spawnElapsed: this.spawnElapsed,
        nextWaveIn: this.tutorialReady && this._spawnIndex < this._spawnSchedule.length ? Math.max(0, this._spawnSchedule[this._spawnIndex].at - this.spawnElapsed) : null,
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
      if (!this.tutorialReady && type !== this.level.tutorialGate.type) return false;
      if (this.status !== 'running' || !config || !this.level.cards.includes(type) || !this._validCell(row, col) || this.cooldowns[type] > 0 || this.sun < config.cost || this._plantAt(row, col)) return false;
      const plant = {
        id: this._id('plant'), type, row, col, hp: config.hp, maxHp: config.hp, attackPulse: 0,
        attackTimer: 200, burstTimer: 0, pendingShot: false, sunTimer: 7000, fuse: config.fuse || 0,
      };
      this.sun -= config.cost; this.cooldowns[type] = config.cooldown; this.plants.push(plant);
      this._plantedCounts[type]++;
      const gate = this.level.tutorialGate;
      if (!this.tutorialReady && gate && this._plantedCounts[gate.type] >= gate.count) {
        this.tutorialReady = true; this._emit('tutorialComplete');
      }
      this._effect('plant', row, col + .5, 500); this._emit('plant', { plant }); this._notify();
      return true;
    }

    remove(row, col) {
      if (this.status !== 'running' || !this.level.shovel || !this._validCell(row, col)) return false;
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
      if (this.tutorialReady) this.spawnElapsed += dt;
      for (const type of Object.keys(this.cooldowns)) {
        const remaining = this.cooldowns[type] - dt;
        this.cooldowns[type] = remaining <= 1e-7 ? 0 : remaining;
      }
      this.effects.forEach(effect => { effect.life -= dt; });
      this.effects = this.effects.filter(effect => effect.life > 0);
      this.suns.forEach(sun => {
        if (sun.falling) {
          sun.y = Math.min(sun.targetY, sun.y + .65 * dt / 1000);
          sun.falling = sun.y < sun.targetY;
        } else sun.life -= dt;
      });
      this.suns = this.suns.filter(sun => sun.life > 0);
      this._skyTimer -= dt;
      if (this._skyTimer <= 0) {
        this._skyCount++; this._skyTimer += this._skyInterval();
        const rows = this.level.activeRows, row = rows[Math.floor(this._random() * rows.length)];
        this._sun(.7 + this._random() * 7.6, row + .6, 'sky');
      }
      while (this.tutorialReady && this._spawnIndex < this._spawnSchedule.length && this._spawnSchedule[this._spawnIndex].at <= this.spawnElapsed + 1e-7) {
        const entry = this._spawnSchedule[this._spawnIndex++];
        if (entry.wave !== this.wave) {
          this.wave = entry.wave; this._emit('wave', { wave: this.wave, totalWaves: this.totalWaves, flag: entry.flag });
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
        if (plant.sunTimer <= 1e-7) {
          plant.sunTimer += config.production; plant.attackPulse = 450;
          this._sun(plant.col + .5, plant.row + .3, 'plant');
        }
      } else if (plant.type === 'bomb') {
        plant.fuse -= dt;
        if (plant.fuse <= 1e-7) {
          const x = plant.col + .5;
          for (const enemy of this.enemies) if (enemy.hp > 0 && Math.abs(enemy.row - plant.row) <= 1 && Math.abs(enemy.x - x) <= 1.5) this._damage(enemy, config.damage, 'bomb');
          plant.hp = 0; this._effect('explode', plant.row, x, 850, { radius: 1.5 });
          this._emit('explode', { row: plant.row, x });
        }
      } else if (config.attackInterval) {
        if (plant.pendingShot) {
          plant.burstTimer -= dt;
          if (plant.burstTimer <= 1e-7) { plant.pendingShot = false; this._shoot(plant); }
        }
        plant.attackTimer = Math.max(0, plant.attackTimer - dt);
        const target = this.enemies.some(enemy => enemy.hp > 0 && !enemy.headless && enemy.row === plant.row && enemy.x >= plant.col + .35 && enemy.x <= COLS + .5);
        if (target && plant.attackTimer <= 1e-7) {
          plant.attackTimer = config.attackInterval - 75 + this._random() * 150; plant.attackPulse = 230;
          const count = plant.type === 'burst' ? 2 : 1;
          this._shoot(plant);
          if (count === 2) { plant.pendingShot = true; plant.burstTimer = 150; }
          this._emit('shot', { plant, row: plant.row, x: plant.col + .5, count });
        }
      }
    }

    _shoot(plant) {
      const config = PLANT_BY_ID[plant.type];
      this.projectiles.push({ id: this._id('shot'), type: plant.type, row: plant.row, x: plant.col + .78, damage: config.damage, speed: 5.1 });
    }

    _stepProjectile(projectile, dt) {
      if (projectile.dead) return;
      const from = projectile.x, to = from + projectile.speed * dt / 1000;
      const hit = this.enemies.filter(enemy => enemy.hp > 0 && !enemy.vaulting && enemy.row === projectile.row && enemy.x + .24 >= from && enemy.x - .24 <= to).sort((a, b) => a.x - b.x)[0];
      if (hit) {
        projectile.x = hit.x; projectile.dead = true;
        this._damage(hit, projectile.damage, projectile.type);
        if (projectile.type === 'ice' && hit.hp > 0) {
          hit.slowTime = 10000; this._effect('ice', hit.row, hit.x, 450);
        }
      } else projectile.x = to;
    }

    _stepEnemy(enemy, dt) {
      enemy.hitPulse = Math.max(0, enemy.hitPulse - dt);
      const slow = enemy.slowTime > 0 ? .5 : 1;
      enemy.slowTime = Math.max(0, enemy.slowTime - dt);
      const config = ENEMIES[enemy.type];
      if (enemy.headless) {
        enemy.eating = false; enemy.dyingTime = Math.max(0, enemy.dyingTime - dt);
        enemy.x -= enemy.speed * slow * dt / 1000;
        if (enemy.dyingTime <= 0) this._damage(enemy, enemy.hp, 'decay');
        // A defeated body cannot eat plants, consume a mower, or enter the house.
        return;
      }
      if (enemy.vaulting) {
        enemy.vaultProgress = Math.min(1, enemy.vaultProgress + dt / 1200);
        enemy.x = enemy.vaultFrom + (enemy.vaultTo - enemy.vaultFrom) * enemy.vaultProgress;
        if (enemy.vaultProgress >= 1) {
          enemy.vaulting = false; enemy.hasPole = false; enemy.speed = enemy.walkSpeed;
          this._effect('land', enemy.row, enemy.x, 450); this._emit('vaultLand', { enemy });
        }
        return;
      }
      const nextX = enemy.x - enemy.speed * slow * dt / 1000;
      const target = this.plants.filter(plant => plant.hp > 0 && plant.row === enemy.row && plant.col + .86 >= nextX && plant.col + .2 <= enemy.x).sort((a, b) => b.col - a.col)[0];
      enemy.eating = Boolean(target);
      if (target && enemy.hasPole) {
        enemy.eating = false; enemy.vaulting = true; enemy.vaultProgress = 0;
        enemy.vaultFrom = enemy.x; enemy.vaultTo = target.col - .15;
        this._effect('vault', enemy.row, enemy.x, 450); this._emit('vault', { enemy });
      } else if (target) {
        enemy.x = Math.max(enemy.x, target.col + .86);
        if (target.type !== 'bomb') target.hp = Math.max(0, target.hp - config.bite * slow * dt / 1000);
      } else enemy.x = nextX;
      const mower = this.mowers[enemy.row];
      if (!enemy.vaulting && mower.enabled && !mower.used && enemy.x <= .04) {
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
      if (enemy.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return;
      const armorDamage = Math.min(enemy.armorHp, amount), hadArmor = enemy.armorHp > 0;
      enemy.armorHp = Math.max(0, enemy.armorHp - armorDamage);
      enemy.bodyHp = Math.max(0, enemy.bodyHp - (amount - armorDamage));
      enemy.hp = enemy.armorHp + enemy.bodyHp; enemy.hitPulse = 160;
      if (hadArmor && !enemy.armorHp) {
        this._effect('armorBreak', enemy.row, enemy.x, 650, { enemyType: enemy.type });
        this._emit('armorBreak', { enemy });
      }
      if (enemy.hp > 0 && enemy.bodyHp < 90 && !enemy.headless) {
        enemy.headless = true; enemy.eating = false; enemy.dyingTime = 3000;
        enemy.vaulting = false; enemy.hasPole = false;
        this._effect('headless', enemy.row, enemy.x, 500, { enemyType: enemy.type });
        this._emit('headless', { enemy });
      }
      this._effect('hit', enemy.row, enemy.x, 220, { value: amount, source });
      this._emit('hit', { enemy, damage: amount, source, killed: enemy.hp <= 0 });
      if (enemy.hp <= 0) this.kills++;
    }

    _spawnEnemy(type, row) {
      const config = ENEMIES[type];
      if (!config || !this.level.activeRows.includes(row)) return null;
      const walkSpeed = 1 / (4 + this._random() * 3);
      const speed = config.vault || type === 'flag' ? config.speed : walkSpeed;
      const enemy = { id: this._id('enemy'), type, row, x: COLS + .35, hp: config.hp, maxHp: config.hp,
        armorHp: config.armor, maxArmorHp: config.armor, bodyHp: config.hp - config.armor,
        speed, walkSpeed, hasPole: Boolean(config.vault), vaulting: false, vaultProgress: 0,
        headless: false, dyingTime: 0, slowTime: 0, hitPulse: 0, eating: false };
      this.enemies.push(enemy); return enemy;
    }

    _sun(x, y, source) {
      const sun = { id: this._id('sun'), x, y: source === 'sky' ? -.35 : y, targetY: y, falling: source === 'sky', value: 25, life: 7500, maxLife: 7500, source };
      this.suns.push(sun); this._effect('sun', Math.floor(y), x, 500, { y }); return sun;
    }

    _effect(type, row, x, life, extra = {}) { this.effects.push({ type, row, x, life, maxLife: life, ...extra }); }
    _plantAt(row, col) { return this.plants.find(plant => plant.row === row && plant.col === col && plant.hp > 0); }
    _validCell(row, col) { return Number.isInteger(row) && Number.isInteger(col) && this.level.activeRows.includes(row) && col >= 0 && col < COLS; }
    _skyInterval() { return Math.min(4250 + this._skyCount * 100, 9500) + this._random() * 2750; }
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
