(function (root) {
  'use strict';

  const SONG_URL = 'assets/audio/feitian.mp3';

  class MergeAudio {
    constructor() {
      this.enabled = true;
      this.context = null;
      this.song = null;
      this._hasGesture = false;
      this._mediaUnlocked = false;
      this._warmupPromise = null;
      this._songEpoch = 0;
      this._songActive = false;
      this._voices = new Set();
      // A relative HTMLAudio URL works from both file:// and a local web server.
      // Keep the supplied 64.608-second recording intact and reuse this one player.
      try {
        if (typeof root.Audio === 'function') {
          this.song = new root.Audio(SONG_URL);
          this.song.preload = 'auto';
          this.song.loop = false;
          this.song.volume = 0.72;
          this.song.playsInline = true;
          this.song.addEventListener('error', () => this._songFailed(this._songEpoch));
          this.song.addEventListener('ended', () => { this._songActive = false; });
        }
      } catch (_) {
        this.song = null;
      }
    }

    // Call synchronously from a trusted pointer or keyboard event, before awaiting anything.
    unlock() {
      this._hasGesture = true;
      const pending = [];
      try {
        const AudioContext = root.AudioContext || root.webkitAudioContext;
        if ((!this.context || this.context.state === 'closed') && AudioContext) this.context = new AudioContext();
        if (this.context && this.context.state === 'suspended') {
          pending.push(Promise.resolve(this.context.resume()).catch(() => false));
        }
      } catch (_) {
        // A blocked or unsupported audio device must never interrupt the game.
      }
      if (this.song && !this._mediaUnlocked && !this._songActive && !this._warmupPromise) {
        const epoch = ++this._songEpoch;
        try {
          this.song.muted = true;
          const playing = this.song.play();
          this._warmupPromise = Promise.resolve(playing).then(() => {
            if (epoch !== this._songEpoch) return false;
            this._mediaUnlocked = true;
            this._stopSong();
            return true;
          }).catch(() => {
            if (epoch === this._songEpoch) this._stopSong();
            return false;
          }).finally(() => { this._warmupPromise = null; });
          pending.push(this._warmupPromise);
        } catch (_) {
          this._stopSong();
        }
      }
      return Promise.all(pending).then(() => this.enabled && this._hasGesture);
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.pause();
      if (this.song) {
        try { this.song.muted = !this.enabled || (!this._songActive && Boolean(this._warmupPromise)); } catch (_) {}
      }
    }

    playDrop() {
      if (!this.enabled || !this._hasGesture) return false;
      return this._tone(330, 0, 0.075, 0.045, 220);
    }

    playMerge(event = {}) {
      if (!this.enabled || !this._hasGesture) return false;
      // 9 + 9 creates level 10. Clearing 10 + 10 reports level 10 too,
      // but finalMerge=true must never start the special recording.
      if (event.level === 10 && event.finalMerge === false) return this._playSong();
      return this._normalMerge(event.level);
    }

    _normalMerge(level) {
      const safeLevel = Number.isFinite(level) ? Math.max(0, Math.min(10, level)) : 0;
      const base = 330 + safeLevel * 27;
      let played = false;
      for (const [index, ratio] of [1, 1.25, 1.5].entries()) {
        played = this._tone(base * ratio, index * 0.035, 0.16, 0.065, base * ratio * 1.04) || played;
      }
      return played;
    }

    _tone(frequency, delay, duration, volume, endFrequency) {
      if (!this.enabled || !this.context || this.context.state !== 'running') return false;
      let voice;
      try {
        const ctx = this.context;
        const start = ctx.currentTime + delay;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        voice = { oscillator, gain };
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        this._voices.add(voice);
        oscillator.onended = () => this._releaseVoice(voice);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
        return true;
      } catch (_) {
        if (voice) this._releaseVoice(voice);
        return false;
      }
    }

    _releaseVoice(voice) {
      this._voices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain.disconnect(); } catch (_) {}
    }

    _stopSong() {
      this._songEpoch += 1;
      this._songActive = false;
      if (!this.song) return;
      try { this.song.pause(); } catch (_) {}
      try { this.song.currentTime = 0; } catch (_) {}
      try { this.song.muted = !this.enabled; } catch (_) {}
    }

    _songFailed(epoch) {
      if (epoch !== this._songEpoch || !this._songActive) return;
      this._stopSong();
      if (this.enabled && this._hasGesture) this._normalMerge(10);
    }

    _playSong() {
      if (!this.song) return this._normalMerge(10);
      this._stopSong();
      const epoch = this._songEpoch;
      this._songActive = true;
      try {
        this.song.muted = false;
        Promise.resolve(this.song.play()).then(() => {
          if (epoch === this._songEpoch && this._songActive) this._mediaUnlocked = true;
        }).catch(() => this._songFailed(epoch));
        return true;
      } catch (_) {
        this._songFailed(epoch);
        return false;
      }
    }

    pause() {
      this._stopSong();
      for (const voice of this._voices) {
        try { voice.oscillator.stop(); } catch (_) {}
        this._releaseVoice(voice);
      }
    }

    reset() {
      this.pause();
    }
  }

  root.MergeAudio = MergeAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = MergeAudio;
})(typeof window !== 'undefined' ? window : globalThis);
