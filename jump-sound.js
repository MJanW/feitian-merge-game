(function (root) {
  'use strict';

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const MAX_VOICES = 24;
  const BONUS_TUNES = Object.freeze({
    manhole: Object.freeze([196, 392, 587.33]),
    cube: Object.freeze([523.25, 659.25, 783.99, 1046.5]),
    kiosk: Object.freeze([440, 523.25, 659.25, 523.25, 880]),
    record: Object.freeze([392, 493.88, 587.33, 739.99, 783.99, 987.77]),
  });

  // All sounds are short Web Audio oscillators. This mode does not load the
  // merge game's song or play any sound before a trusted interaction unlocks it.
  class JumpAudio {
    constructor() {
      this.enabled = true;
      this.context = null;
      this._hasGesture = false;
      this._generation = 0;
      this._resumePromise = null;
      this._voices = new Set();
      this._chargeVoice = null;
      this._chargeAmount = null;
      this._chargeExpired = false;
    }

    // The controller calls this synchronously inside a trusted input handler.
    unlock() {
      this._hasGesture = true;
      const generation = this._generation;
      let context;
      try {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if ((!this.context || this.context.state === 'closed') && AudioContext) {
          this._stopVoices();
          this.context = new AudioContext();
          this._resumePromise = null;
        }
        context = this.context;
        if (!context || !this.enabled) return Promise.resolve(false);
        if (context.state === 'suspended' && !this._resumePromise) {
          const pending = Promise.resolve(context.resume()).catch(() => false);
          this._resumePromise = pending;
          pending.then(() => { if (this._resumePromise === pending) this._resumePromise = null; });
        }
      } catch (_) {
        return Promise.resolve(false);
      }
      return Promise.resolve(this._resumePromise).then(() => {
        if (generation !== this._generation || context !== this.context || !this._canPlay()) return false;
        this._syncCharge();
        return true;
      });
    }

    _canPlay() { return this.enabled && this._hasGesture && this.context?.state === 'running'; }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.pause();
    }

    setCharge(amount) {
      if (amount === null || !Number.isFinite(amount) || !this.enabled || !this._hasGesture) {
        this._chargeAmount = null;
        this._chargeExpired = false;
        this._stopCharge();
        return false;
      }
      if (this._chargeAmount === null) this._chargeExpired = false;
      this._chargeAmount = clamp(amount, 0, 1);
      return this._syncCharge();
    }

    _syncCharge() {
      if (!this._canPlay() || this._chargeAmount === null || this._chargeExpired) return false;
      let voice = this._chargeVoice;
      try {
        const ctx = this.context, now = ctx.currentTime;
        const frequency = 155 + Math.pow(this._chargeAmount, 1.2) * 690;
        const volume = 0.018 + this._chargeAmount * 0.018;
        if (!voice) {
          if (this._voices.size >= MAX_VOICES) return false;
          const oscillator = ctx.createOscillator();
          voice = { oscillator, gain: null };
          const gain = ctx.createGain(); voice.gain = gain;
          this._chargeVoice = voice;
          this._voices.add(voice);
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, now);
          gain.gain.setValueAtTime(0.0001, now);
          oscillator.connect(gain); gain.connect(ctx.destination);
          oscillator.onended = () => {
            if (this._chargeVoice === voice) {
              this._chargeVoice = null;
              this._chargeExpired = this._chargeAmount !== null;
            }
            this._releaseVoice(voice);
          };
          oscillator.start(now);
          // A missed release must never leave a permanent tone. Reaching this
          // safety stop silences this hold; the next fresh hold may sound again.
          oscillator.stop(now + 4.5);
        }
        voice.oscillator.frequency.cancelScheduledValues(now);
        voice.oscillator.frequency.setTargetAtTime(frequency, now, 0.025);
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(volume, now, 0.025);
        return true;
      } catch (_) {
        if (this._chargeVoice === voice) this._chargeVoice = null;
        if (voice) this._stopVoice(voice);
        return false;
      }
    }

    _note(frequency, delay, duration, volume, endFrequency = frequency, type = 'sine') {
      if (!this._canPlay() || this._voices.size >= MAX_VOICES) return false;
      let voice;
      try {
        const ctx = this.context;
        const start = ctx.currentTime + clamp(finite(delay, 0), 0, 1);
        const length = clamp(finite(duration, 0.12), 0.035, 0.6);
        const oscillator = ctx.createOscillator();
        voice = { oscillator, gain: null };
        const gain = ctx.createGain(); voice.gain = gain;
        this._voices.add(voice);
        oscillator.type = type === 'triangle' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(clamp(finite(frequency, 330), 80, 1800), start);
        oscillator.frequency.exponentialRampToValueAtTime(clamp(finite(endFrequency, frequency), 80, 1800), start + length);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(clamp(finite(volume, 0.025), 0.0001, 0.065), start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.onended = () => this._releaseVoice(voice);
        oscillator.start(start); oscillator.stop(start + length + 0.025);
        return true;
      } catch (_) {
        if (voice) this._stopVoice(voice);
        return false;
      }
    }

    playJump() {
      this.setCharge(null);
      const low = this._note(190, 0, 0.17, 0.034, 760, 'triangle');
      return this._note(820, 0.015, 0.19, 0.013, 210) || low;
    }

    playLanding(event = {}) {
      if (event?.samePlatform || event?.points === 0) return false;
      this.setCharge(null);
      let played = false;
      if (event?.perfect) {
        const tier = clamp(Math.floor(finite(event.combo, 1)), 1, 16);
        const base = 392 * Math.pow(2, (tier - 1) / 24);
        for (const [index, ratio] of [1, 1.5, 2].entries()) {
          played = this._note(base * ratio, index * 0.055, 0.13, 0.027) || played;
        }
      } else {
        played = this._note(230, 0, 0.09, 0.03, 140, 'triangle');
        played = this._note(430, 0.015, 0.11, 0.012, 285) || played;
      }
      return played;
    }

    playBonus(event = {}) {
      const notes = Object.prototype.hasOwnProperty.call(BONUS_TUNES, event?.kind) ? BONUS_TUNES[event.kind] : null;
      if (!notes) return false;
      let played = false;
      const type = event.kind === 'cube' || event.kind === 'manhole' ? 'triangle' : 'sine';
      for (let index = 0; index < notes.length; index++) {
        played = this._note(notes[index], index * 0.08, 0.17, 0.029, notes[index], type) || played;
      }
      return played;
    }

    playEvolution(event = {}) {
      const level = clamp(finite(event?.level, 0), 0, 11);
      const base = 392 * Math.pow(2, level / 24);
      let played = false;
      for (const [index, ratio] of [1, 1.25, 1.5, 2].entries()) {
        played = this._note(base * ratio, index * 0.085, 0.24, 0.026) || played;
      }
      return played;
    }

    playLose() {
      this.pause();
      let played = false;
      for (const [index, frequency] of [440, 330, 247, 165].entries()) {
        played = this._note(frequency, index * 0.09, index === 3 ? 0.28 : 0.14, 0.027, frequency * 0.9, 'triangle') || played;
      }
      return played;
    }

    _releaseVoice(voice) {
      this._voices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain.disconnect(); } catch (_) {}
    }

    _stopVoice(voice) {
      try { voice.oscillator.stop(); } catch (_) {}
      this._releaseVoice(voice);
    }

    _stopCharge() {
      const voice = this._chargeVoice;
      this._chargeVoice = null;
      if (voice) this._stopVoice(voice);
    }

    _stopVoices() {
      this._chargeVoice = null;
      for (const voice of [...this._voices]) this._stopVoice(voice);
    }

    pause() {
      this._generation++;
      this._chargeAmount = null;
      this._chargeExpired = false;
      this._stopVoices();
    }

    reset() { this.pause(); }
  }

  root.JumpAudio = JumpAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = JumpAudio;
})(typeof window !== 'undefined' ? window : globalThis);
