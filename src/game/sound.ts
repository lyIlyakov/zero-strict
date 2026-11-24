/**
 * 100% procedural Web Audio synthesizer for «Нулевая смена».
 * Zero external sound files; pitch-varied foley & clear game-event feedback.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private output: GainNode | null = null;
  private lastFootstepAt = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.output = this.ctx.createGain();
      this.output.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.output) {
      const now = this.ctx.currentTime;
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setValueAtTime(muted ? 0 : 1, now);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    endFreq?: number,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.output ?? ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playGate(): void {
    this.playTone(92, 0.48, 'triangle', 0.042, 54);
    this.playTone(158, 0.19, 'sine', 0.022, 82, 0.32);
  }

  playSuit(): void {
    this.playTone(145, 0.10, 'triangle', 0.028, 94);
    this.playTone(235, 0.09, 'sine', 0.018, 165, 0.06);
  }

  playVote(): void {
    this.playTone(285, 0.16, 'sine', 0.038, 275);
    this.playTone(380, 0.18, 'sine', 0.024, 355, 0.065);
  }

  playFootstep(): void {
    const now = performance.now();
    if (now - this.lastFootstepAt < 340) return;
    this.lastFootstepAt = now;
    const pitch = 95 + (Math.random() - 0.5) * 18;
    this.playTone(pitch, 0.065, 'triangle', 0.032, 42);
  }

  playTerminalOpen(): void {
    this.playTone(440, 0.08, 'sine', 0.06, 620);
    this.playTone(660, 0.1, 'sine', 0.05, 780, 0.06);
  }

  playClick(): void {
    this.playTone(540 + (Math.random() - 0.5) * 40, 0.045, 'square', 0.025, 380);
  }

  playTaskComplete(): void {
    this.playTone(523.25, 0.12, 'triangle', 0.07, 523.25, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.07, 659.25, 0.09);
    this.playTone(783.99, 0.24, 'triangle', 0.08, 783.99, 0.18);
  }

  playError(): void {
    this.playTone(190, 0.16, 'sawtooth', 0.05, 130);
  }

  playShieldActivate(): void {
    this.playTone(320, 0.25, 'sine', 0.08, 920);
    this.playTone(640, 0.35, 'triangle', 0.05, 480, 0.08);
  }

  playShieldBlock(): void {
    this.playTone(880, 0.18, 'sawtooth', 0.09, 260);
    this.playTone(1320, 0.28, 'sine', 0.07, 520, 0.03);
  }

  playSabotageLights(): void {
    this.playTone(260, 0.45, 'sawtooth', 0.07, 65);
    this.playTone(180, 0.4, 'square', 0.04, 52, 0.12);
  }

  playLightsRestored(): void {
    this.playTone(180, 0.28, 'triangle', 0.07, 540);
    this.playTone(540, 0.25, 'sine', 0.06, 720, 0.18);
  }

  playAlarm(): void {
    for (let i = 0; i < 3; i++) {
      this.playTone(580, 0.18, 'sawtooth', 0.07, 420, i * 0.24);
    }
  }

  playVictory(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => this.playTone(n, 0.26, 'triangle', 0.08, n, i * 0.11));
  }

  playDefeat(): void {
    const notes = [392, 349.23, 311.13, 233.08];
    notes.forEach((n, i) => this.playTone(n, 0.3, 'sawtooth', 0.06, n * 0.94, i * 0.14));
  }
}

export const soundEngine = new SoundEngine();
