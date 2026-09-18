export class AudioEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  enabled = true;
  volume = 0.35;
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
        this.engine = this.context.createOscillator();
        this.engine.type = 'sawtooth';
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 260;
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.gain);
        this.engine.start();
      }
      void this.context.resume();
    } catch {
      /* Audio is optional. */
    }
  }
  update(speed: number, active: boolean) {
    if (!this.context || !this.gain || !this.engineGain || !this.engine) return;
    this.gain.gain.setTargetAtTime(
      this.enabled ? this.volume : 0,
      this.context.currentTime,
      0.03,
    );
    this.engine.frequency.setTargetAtTime(
      38 + speed * 2.4,
      this.context.currentTime,
      0.08,
    );
    this.engineGain.gain.setTargetAtTime(
      active ? 0.055 : 0,
      this.context.currentTime,
      0.05,
    );
  }
  play(type: string) {
    if (!this.context || !this.gain || !this.enabled) return;
    const ctx = this.context,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const notes: Record<string, number> = {
      item: 740,
      boost: 480,
      hit: 110,
      lap: 880,
      finish: 1046,
      go: 660,
      tick: 440,
      click: 520,
    };
    oscillator.type = type === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(notes[type] || 440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      (notes[type] || 440) * (type === 'hit' ? 0.4 : 1.5),
      ctx.currentTime + 0.2,
    );
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(this.gain);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
  }
}
export const audio = new AudioEngine();
