// ============================================================================
// AUDIO & CELEBRATION SOUNDS (js/audio.js)
// Real-time Web Audio Synthesizer (Chimes, Clicks, Confetti, Completion)
// ============================================================================

class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play crisp, uplifting task completion sound
  playTaskDone() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const tones = [
        { f: 659.25, start: now, dur: 0.12 },
        { f: 987.77, start: now + 0.08, dur: 0.35 }
      ];
      tones.forEach(t => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.f, t.start);
        gain.gain.setValueAtTime(0.28, t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, t.start + t.dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t.start);
        osc.stop(t.start + t.dur);
      });
    } catch (e) {
      console.warn('playTaskDone error:', e);
    }
  }

  // A soft "ding-dong" for an event that's coming up (js/event-chime.js)
  playReminderChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [{ f: 880, t: 0 }, { f: 659.25, t: 0.32 }].forEach(n => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.22, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.9);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.95);
      });
    } catch (e) {
      console.warn('playReminderChime error:', e);
    }
  }

  // Play a triumphant, shimmering celebratory synth chime
  playCelebrationChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.85);
      });
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  }

  // Play pleasant double coin ting when pocket money is earned
  playCoinChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [987.77, 1318.51].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.3, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.5);
      });
    } catch (e) {
      console.warn('Coin chime error:', e);
    }
  }

  // Soft click/pop for undo
  playUndoPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // Soft subtle click for tabs and toggles
  playClick() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // A tiny tick for each step of a slider (Rewards' points), rising with the
  // value (pitch 0–1); quiet, and no more than one every 25ms
  playTick(pitch = 0.5) {
    try {
      const nowMs = Date.now();
      if (this._lastTick && nowMs - this._lastTick < 25) return;
      this._lastTick = nowMs;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 + Math.max(0, Math.min(1, pitch)) * 700, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {}
  }

  // Trash / delete sound
  playTrash() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Success chime
  playSuccess() {
    try {
      this.playCelebrationChime();
    } catch (e) {}
  }

  // Trophy podium chime
  playTrophyChime() {
    try {
      this.playCelebrationChime();
    } catch (e) {}
  }
}

// Global SFX Instance
const sfx = new SoundEffects();
window.sfx = sfx;
window.SoundEffects = SoundEffects;

// Confetti Burst Trigger
function triggerConfettiBurst() {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: 50,
      angle: 60,
      spread: 70,
      origin: { x: 0.1, y: 0.7 },
      colors: ['#38bdf8', '#0284c7', '#f59e0b', '#10b981', '#ec4899']
    });
    window.confetti({
      particleCount: 50,
      angle: 120,
      spread: 70,
      origin: { x: 0.9, y: 0.7 },
      colors: ['#38bdf8', '#0284c7', '#f59e0b', '#10b981', '#ec4899']
    });
    setTimeout(() => {
      window.confetti({
        particleCount: 65,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#ffd700', '#38bdf8', '#f43f5e']
      });
    }, 150);
  }
}
window.triggerConfettiBurst = triggerConfettiBurst;
