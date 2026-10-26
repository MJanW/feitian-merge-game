(function (root) {
  'use strict';

  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const MAX_VOICES = 16;
  const LIMITS = Object.freeze({ shot: .105, hit: .075, bite: .16, collect: .065, plant: .06, select: .045, packet: .14, armorBreak: .1, armLost: .13, headless: .13, explode: .15, mower: .25, plantFood: .3, cartMove: .15, kelp: .2, kelpSink: .2, mineArm: .15, mineExplosion: .18 });

  // Original, short garden foley and melodic accents. All sources are made
  // locally; there are no music downloads, timers, or looping background nodes.
  class GardenAudio {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.context = null;
      this._gesture = false;
      this._activeRequested = false;
      this._destroyed = false;
      this._generation = 0;
      this._resumePromise = null;
      this._voices = new Set();
      this._last = Object.create(null);
      this._noiseBuffer = null;
      this._bus = null;
      this._compressor = null;
      this._document = root.document;
      this._visibility = () => { if (this._document?.hidden) this.suspend(); };
      this._document?.addEventListener?.('visibilitychange', this._visibility);
    }

    // Call directly from a pointer/keyboard gesture, including after unmuting.
    unlock() {
      if (this._destroyed || !this.enabled || this._document?.hidden) return Promise.resolve(false);
      this._gesture = true;
      this._activeRequested = true;
      const generation = this._generation;
      let context;
      try {
        const Context = root.AudioContext || root.webkitAudioContext;
        if ((!this.context || this.context.state === 'closed') && Context) {
          this._clearVoices();
          this._disconnectBus();
          this.context = new Context();
          this._resumePromise = null;
          this._last = Object.create(null);
          this._noiseBuffer = null;
          this._makeBus();
        }
        context = this.context;
        if (!context) return Promise.resolve(false);
        if (context.state === 'suspended' && !this._resumePromise) {
          const pending = Promise.resolve(context.resume()).catch(() => false);
          this._resumePromise = pending;
          pending.then(() => { if (this._resumePromise === pending) this._resumePromise = null; });
        }
      } catch (_) { return Promise.resolve(false); }
      return Promise.resolve(this._resumePromise).then(() => {
        if (context !== this.context || generation !== this._generation || !this._canPlay()) {
          // An old resume promise must not restart audio after a hidden-tab
          // event, mute, or destroy happened while the browser was unlocking.
          if (context === this.context && !this._activeRequested) this._suspendContext(context);
          return false;
        }
        return true;
      });
    }

    _canPlay() {
      return !this._destroyed && this.enabled && this._gesture && this._activeRequested && !this._document?.hidden && this.context?.state === 'running';
    }

    _makeBus() {
      const ctx = this.context;
      this._bus = ctx.createGain();
      this._bus.gain.setValueAtTime(.7, finite(ctx.currentTime, 0));
      if (typeof ctx.createDynamicsCompressor === 'function') {
        this._compressor = ctx.createDynamicsCompressor();
        for (const [key, value] of Object.entries({ threshold: -24, knee: 18, ratio: 5, attack: .004, release: .16 })) {
          this._compressor[key]?.setValueAtTime(value, finite(ctx.currentTime, 0));
        }
        this._bus.connect(this._compressor); this._compressor.connect(ctx.destination);
      } else this._bus.connect(ctx.destination);
    }

    _disconnectBus() {
      try { this._bus?.disconnect(); } catch (_) {}
      try { this._compressor?.disconnect(); } catch (_) {}
      this._bus = null; this._compressor = null;
    }

    _release(voice) {
      this._voices.delete(voice);
      try { voice.source.onended = null; voice.source.disconnect(); } catch (_) {}
      try { voice.gain?.disconnect(); } catch (_) {}
      try { voice.filter?.disconnect(); } catch (_) {}
    }

    _stop(voice) {
      try { voice.source.onended = null; voice.source.stop(); } catch (_) {}
      this._release(voice);
    }

    _clearVoices() { for (const voice of [...this._voices]) this._stop(voice); }

    _available() {
      if (!this._canPlay()) return false;
      const now = finite(this.context.currentTime, 0);
      for (const voice of [...this._voices]) if (voice.end <= now) this._stop(voice);
      return this._voices.size < MAX_VOICES;
    }

    _envelope(voice, start, length, volume) {
      const gain = this.context.createGain(); voice.gain = gain;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(clamp(finite(volume, .02), .0001, .055), start + Math.min(.008, length / 4));
      gain.gain.exponentialRampToValueAtTime(.0001, start + length);
      gain.connect(this._bus || this.context.destination);
      voice.end = start + length + .025;
      voice.source.onended = () => this._release(voice);
      return gain;
    }

    _note(frequency, delay, duration, volume, endFrequency = frequency, wave = 'sine') {
      if (!this._available()) return false;
      let voice;
      try {
        const ctx = this.context, start = finite(ctx.currentTime, 0) + clamp(finite(delay, 0), 0, .8);
        const length = clamp(finite(duration, .1), .025, .6), source = ctx.createOscillator();
        voice = { source, gain: null, end: Infinity }; this._voices.add(voice);
        source.type = wave === 'triangle' ? 'triangle' : 'sine';
        source.frequency.setValueAtTime(clamp(finite(frequency, 330), 45, 2400), start);
        source.frequency.exponentialRampToValueAtTime(clamp(finite(endFrequency, finite(frequency, 330)), 45, 2400), start + length);
        source.connect(this._envelope(voice, start, length, volume));
        source.start(start); source.stop(voice.end);
        return true;
      } catch (_) { if (voice) this._stop(voice); return false; }
    }

    _noise(duration, volume, cutoff = 700, delay = 0) {
      if (!this._available()) return false;
      const ctx = this.context;
      if (!ctx.createBuffer || !ctx.createBufferSource || !ctx.createBiquadFilter) return this._note(150, delay, duration, volume * .6, 70, 'triangle');
      let voice;
      try {
        if (!this._noiseBuffer) {
          const sampleRate = clamp(finite(ctx.sampleRate, 44100), 8000, 192000);
          this._noiseBuffer = ctx.createBuffer(1, Math.ceil(sampleRate * .65), sampleRate);
          const data = this._noiseBuffer.getChannelData(0);
          let seed = 191;
          for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647 - .5) * 1.4; }
        }
        const start = finite(ctx.currentTime, 0) + clamp(finite(delay, 0), 0, .8);
        const length = clamp(finite(duration, .08), .025, .5), source = ctx.createBufferSource();
        voice = { source, gain: null, filter: null, end: Infinity }; this._voices.add(voice);
        source.buffer = this._noiseBuffer;
        const filter = ctx.createBiquadFilter(); voice.filter = filter; filter.type = 'lowpass';
        filter.frequency.setValueAtTime(clamp(finite(cutoff, 700), 120, 4800), start);
        filter.Q?.setValueAtTime(.65, start);
        source.connect(filter); filter.connect(this._envelope(voice, start, length, volume));
        source.start(start); source.stop(voice.end);
        return true;
      } catch (_) { if (voice) this._stop(voice); return false; }
    }

    _tones(notes, spacing = .07, duration = .18, volume = .024) {
      let played = false;
      notes.forEach((frequency, index) => { played = this._note(frequency, index * spacing, duration, volume) || played; });
      return played;
    }

    play(event) {
      if (!this._canPlay()) return false;
      const type = typeof event === 'string' ? event : event?.type;
      const now = finite(this.context.currentTime, 0), limit = LIMITS[type];
      if (limit && now - (this._last[type] ?? -Infinity) < limit) return false;
      // No catch-up queue: crowded battles skip redundant sounds rather than
      // schedule a burst that keeps playing after the action has finished.
      if (limit) this._last[type] = now;
      switch (type) {
        case 'shot': {
          const plant = event?.plant?.type || event?.plantType || event?.source;
          if (plant === 'tide') return this._note(560, 0, .13, .024, 190, 'sine');
          if (plant === 'cactus') { const base = this._noise(.045, .016, 2100); return this._note(890, 0, .065, .018, 250, 'triangle') || base; }
          if (plant === 'ice') {
            const base = this._note(730, 0, .09, .018, 1110);
            return this._note(1520, .014, .14, .009, 1230) || base;
          }
          if (plant === 'star') return this._tones([988, 1482], .018, .13, .012);
          if (plant === 'corn') {
            const base = this._note(370, 0, .065, .027, 170, 'triangle');
            return this._note(240, .05, .09, .014, 310) || base;
          }
          if (plant === 'cannon') {
            const base = this._noise(.16, .035, 580);
            return this._note(130, 0, .24, .047, 48) || base;
          }
          if (plant === 'lightning') {
            const base = this._noise(.055, .021, 3300);
            return this._note(980, .006, .085, .013, 210, 'triangle') || base;
          }
          if (plant === 'torch') return this._noise(.11, .023, 1100);
          const base = this._note(430, 0, .085, .027, 155);
          return this._noise(.035, .012, 800) || base;
        }
        case 'hit': {
          if (event?.source === 'mower') return false;
          const armor = event?.armorDamage > 0 || event?.enemy?.armorHp > 0;
          if (armor) {
            const base = this._note(590, 0, .055, .019, 420, 'triangle');
            return this._note(1040, .004, .065, .007, 740) || base;
          }
          const base = this._noise(.055, .019, 650);
          return this._note(145, 0, .07, .014, 70) || base;
        }
        case 'bite': {
          if (event?.shielded) {
            const tap = this._note(510, 0, .07, .009, 640);
            return this._note(820, .018, .06, .004, 690) || tap;
          }
          const plant = event?.plant?.type || event?.plantType;
          const firm = plant === 'wall' || plant === 'tallwall' || plant === 'mine';
          // A dry leaf crunch followed by a small, rounded chew. Short tails
          // stay below attacks in the mix, even with several enemies eating.
          const crunch = this._noise(firm ? .055 : .045, firm ? .014 : .013, firm ? 800 : 1700);
          const chew = this._note(firm ? 205 : 180, .018, .085, .009, 95, 'triangle');
          return this._noise(.028, .006, firm ? 1200 : 900, .07) || crunch || chew;
        }
        case 'plant': {
          const base = this._noise(.075, .025, 480);
          return this._note(240, .018, .1, .023, 370) || base;
        }
        case 'kelp': { const base = this._noise(.22, .024, 490); return this._note(310, 0, .24, .021, 75) || base; }
        case 'kelpSink': {
          const water = this._noise(.24, .018, 360);
          const bubble = this._note(260, 0, .14, .014, 85, 'sine');
          return this._note(175, .09, .16, .009, 65, 'sine') || bubble || water;
        }
        case 'cartMove': { const base = this._noise(.22, .02, 1300); return this._tones([175, 210, 175], .06, .06, .016) || base; }
        case 'select': return this._note(410, 0, .055, .018, 560, 'triangle');
        case 'packet': return this._note(275, 0, .045, .016, 190, 'triangle');
        case 'collect': return this._tones([1046.5, 1568], .035, .14, .019);
        case 'plantFood':
          return this._tones([392, 587.33, 783.99, 1174.66], .055, .24, .026);
        case 'armorBreak': {
          const base = this._noise(.12, .029, 2100);
          return this._note(680, .035, .13, .015, 170, 'triangle') || base;
        }
        case 'armLost': case 'headless': return this._noise(.11, .023, 450);
        case 'mineArm': return this._tones([440, 660], .055, .09, .016);
        case 'mineExplosion': {
          const earth = this._noise(.28, .048, 590);
          const thud = this._note(145, 0, .29, .044, 45);
          return this._noise(.09, .019, 1600, .1) || earth || thud;
        }
        case 'explode': {
          const base = this._noise(.34, .052, 850);
          return this._note(115, 0, .37, .05, 45) || base;
        }
        case 'mower': {
          const base = this._noise(.4, .035, 1050);
          return this._note(85, 0, .4, .025, 145, 'triangle') || base;
        }
        case 'win':
          this.pause(); return this._tones([392, 493.88, 587.33, 783.99, 987.77], .095, .27, .027);
        case 'lose':
          this.pause(); return this._tones([349.23, 293.66, 233.08, 174.61], .12, .24, .022);
        default: return false;
      }
    }

    pause() {
      this._generation++;
      this._clearVoices();
      this._last = Object.create(null);
    }

    _suspendContext(context) {
      try { return Promise.resolve(context?.state !== 'closed' ? context?.suspend?.() : null).catch(() => {}); }
      catch (_) { return Promise.resolve(); }
    }

    suspend() {
      this._activeRequested = false;
      this.pause();
      return this._suspendContext(this.context);
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.suspend();
    }

    destroy() {
      this._destroyed = true; this._activeRequested = false; this._gesture = false;
      this.pause();
      this._document?.removeEventListener?.('visibilitychange', this._visibility);
      this._disconnectBus(); this._noiseBuffer = null;
      const context = this.context; this.context = null; this._resumePromise = null;
      try { return Promise.resolve(context && context.state !== 'closed' ? context.close() : null).catch(() => {}); }
      catch (_) { return Promise.resolve(); }
    }
  }

  root.GardenAudio = GardenAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = GardenAudio;
})(typeof window !== 'undefined' ? window : globalThis);
