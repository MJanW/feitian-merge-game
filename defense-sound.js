(function (root) {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  // Short synthesized game cues only. No external audio request and no sound
  // before a user gesture; pause/mode switching clears even scheduled notes.
  class DefenseAudio {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.context = null;
      this._gesture = false;
      this._voices = new Set();
      this._lastShot = -Infinity;
      this._lastKill = -Infinity;
      this._lastSupplyHit = -Infinity;
      this._lastHatch = -Infinity;
      this._lastSpecial = -Infinity;
      this._generation = 0;
    }

    unlock() {
      this._gesture = true;
      let context;
      try {
        const Context = root.AudioContext || root.webkitAudioContext;
        if ((!this.context || this.context.state === 'closed') && Context) {
          this.context = new Context(); this._lastShot = -Infinity; this._lastKill = -Infinity;
          this._lastSupplyHit = -Infinity; this._lastHatch = -Infinity;
          this._lastSpecial = -Infinity;
        }
        context = this.context;
        if (!context || !this.enabled) return Promise.resolve(false);
        const generation = this._generation;
        const pending = context.state === 'suspended' ? context.resume() : null;
        return Promise.resolve(pending).then(() => generation === this._generation && context === this.context && this._canPlay()).catch(() => false);
      } catch (_) { return Promise.resolve(false); }
    }

    _canPlay() { return this.enabled && this._gesture && this.context?.state === 'running'; }
    setEnabled(enabled) { this.enabled = Boolean(enabled); if (!this.enabled) this.pause(); }
    _release(voice) {
      this._voices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain?.disconnect(); } catch (_) {}
    }
    _note(frequency, delay, duration, volume, end = frequency, type = 'sine') {
      if (!this._canPlay() || this._voices.size >= 18) return false;
      let voice;
      try {
        const ctx = this.context, start = ctx.currentTime + clamp(delay, 0, .6), length = clamp(duration, .025, .5);
        const oscillator = ctx.createOscillator(); voice = { oscillator, gain: null };
        this._voices.add(voice);
        const gain = ctx.createGain(); voice.gain = gain;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(clamp(frequency, 70, 1600), start);
        oscillator.frequency.exponentialRampToValueAtTime(clamp(end, 70, 1600), start + length);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(clamp(volume, .0001, .055), start + .005);
        gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.onended = () => this._release(voice);
        oscillator.start(start); oscillator.stop(start + length + .02);
        return true;
      } catch (_) {
        if (voice) { try { voice.oscillator.stop(); } catch (_) {} this._release(voice); }
        return false;
      }
    }

    play(event) {
      if (!this._canPlay()) return false;
      const type = typeof event === 'string' ? event : event?.type;
      const level = Number.isFinite(event?.level) ? clamp(event.level, 0, 10) : 0;
      const now = this.context.currentTime;
      switch (type) {
        case 'slash':
          // Eggs have a separate crack cue. Layer a low impact with a short
          // metallic strike for bottles, and cap the cadence in crowded fights.
          if (event?.targetType === 'supply' || now - this._lastShot < .085) return false;
          this._lastShot = now;
          this._note(175, 0, .075, .036, 75, 'triangle');
          return this._note(event?.ability === 'ice' ? 1420 : 1080, .003, .055, .022, 430, 'square');
        case 'special':
          if (now - this._lastSpecial < .22) return false;
          this._lastSpecial = now;
          if (event.ability === 'lightning') {
            this._note(1350, 0, .07, .019, 240, 'sawtooth');
            return this._note(880, .04, .12, .016, 220, 'triangle');
          }
          this._note(160, 0, .13, .025, 80, 'triangle');
          return this._note(390, .025, .09, .018, 120, 'sine');
        case 'shot': case 'shoot':
          if (now - this._lastShot < .075) return false;
          this._lastShot = now;
          return this._note(460 + level * 25, 0, .045, .013, 190 + level * 8, 'triangle');
        case 'kill':
          if (now - this._lastKill < .055) return false;
          this._lastKill = now;
          this._note(780, 0, .07, .021, 1140);
          return this._note(1180, .03, .11, .012, 780);
        case 'supplyHit':
          if (now - this._lastSupplyHit < .09) return false;
          this._lastSupplyHit = now;
          return this._note(920, 0, .055, .027, 260, 'triangle');
        case 'hatch':
          if (now - this._lastHatch < .12) return false;
          this._lastHatch = now;
          this._note(523.25, 0, .12, .023, 659.25);
          this._note(659.25, .065, .14, .022, 783.99);
          return this._note(1046.5, .13, .22, .019, 880);
        case 'merge': case 'upgrade': {
          const pitch = 1 + level * .025;
          [392, 493.88, 587.33, 783.99].forEach((frequency, index) => this._note(frequency * pitch, index * .055, .16, .028));
          return true;
        }
        case 'route': {
          const tones = { ice: [784, 1175, 1568], fire: [196, 392, 588], lightning: [440, 880, 1320] };
          (tones[event.route] || tones.ice).forEach((frequency, index) => this._note(frequency, index * .075, .19, .028, frequency * 1.05, event.route === 'lightning' ? 'triangle' : 'sine'));
          return true;
        }
        case 'evolveFail':
          this._note(260, 0, .11, .025, 160, 'triangle');
          return this._note(165, .07, .13, .023, 85, 'triangle');
        case 'spawn': case 'place': case 'move':
          this._note(220, 0, .06, .022, 330, 'triangle');
          return this._note(440, .04, .1, .016, 520);
        case 'wave':
          this._note(196, 0, .15, .022, 196, 'triangle');
          this._note(294, .12, .14, .025, 294, 'triangle');
          return this._note(392, .24, .22, .025);
        case 'clear':
          [392, 523.25, 659.25, 783.99].forEach((frequency, index) => this._note(frequency, index * .07, .16, .025));
          return true;
        case 'hit': case 'leak':
          this._note(180, 0, .15, .04, 90, 'triangle');
          return this._note(240, .13, .16, .025, 110, 'triangle');
        case 'lose': case 'gameover':
          this.pause();
          [330, 277.18, 220, 146.83].forEach((frequency, index) => this._note(frequency, index * .13, .24, .03, frequency * .92, 'triangle'));
          return true;
        default: return false;
      }
    }

    pause() {
      this._generation++;
      for (const voice of Array.from(this._voices)) {
        try { voice.oscillator.onended = null; voice.oscillator.stop(); } catch (_) {}
        this._release(voice);
      }
    }
    destroy() {
      this.pause(); this._gesture = false;
      const context = this.context; this.context = null;
      if (context && context.state !== 'closed') {
        try { return Promise.resolve(context.close()).catch(() => {}); } catch (_) {}
      }
      return Promise.resolve();
    }
  }
  root.DefenseAudio = DefenseAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = DefenseAudio;
})(typeof window !== 'undefined' ? window : globalThis);
