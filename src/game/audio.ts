/**
 * Procedural forest audio system with separated ambient and music buses,
 * ready for future melancholic dark fantasy music stems without refactoring.
 */
export class ForestAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private enabled = false;
  private stepAccum = 0;
  private lastStepSign = 1;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    if (!this.enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.enabled;
  }

  public start(): void {
    if (this.enabled) return;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupBuses(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.32, now, 0.35);
    }
    this.enabled = true;
  }

  public stop(): void {
    if (!this.enabled) return;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0, now, 0.2);
    }
    this.enabled = false;
  }

  /**
   * Returns the AudioContext and dedicated music GainNode bus for future authorized tracks.
   */
  public getMusicChannel(): { context: AudioContext | null; bus: GainNode | null } {
    return { context: this.ctx, bus: this.musicBus };
  }

  private setupBuses(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(ctx.destination);

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = 1.0;
    this.ambientBus.connect(this.masterGain);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.65;
    this.musicBus.connect(this.masterGain);

    // 4-second seamless brown/pink noise loop for soft forest wind
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 2.8;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 320;
    this.windFilter.Q.value = 0.85;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.34;

    noise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ambientBus);
    noise.start();

    // Subtle hollow wind resonance
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 65.41; // C2
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.03;
    osc.connect(droneGain);
    droneGain.connect(this.ambientBus);
    osc.start();
    this.droneGain = droneGain;
  }

  private envMode: 'forest' | 'house' | 'cave' | 'dungeon' = 'forest';
  private droneGain: GainNode | null = null;

  public setEnvironmentMode(mode: 'forest' | 'house' | 'cave' | 'dungeon'): void {
    this.envMode = mode;
    if (!this.ctx || !this.windFilter || !this.windGain || !this.droneGain) return;
    const now = this.ctx.currentTime;
    if (mode === 'house') {
      this.windFilter.frequency.setTargetAtTime(160, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.09, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.015, now, 0.35);
    } else if (mode === 'cave') {
      this.windFilter.frequency.setTargetAtTime(130, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.14, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.05, now, 0.35);
    } else if (mode === 'dungeon') {
      this.windFilter.frequency.setTargetAtTime(145, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.12, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.055, now, 0.35);
    } else {
      this.windFilter.frequency.setTargetAtTime(320, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.34, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.03, now, 0.35);
    }
  }

  public playTransitionCue(kind: 'wood' | 'stone' | 'cave'): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'wood' ? 'triangle' : 'sine';
    const baseFreq = kind === 'wood' ? 145 : kind === 'stone' ? 88 : 68;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 0.24);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playInteractCue(kind: 'door' | 'brazier' | 'relic' | 'secret'): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'relic' ? 'sine' : 'triangle';
    const f0 = kind === 'relic' ? 392 : kind === 'brazier' ? 220 : 120;
    const f1 = kind === 'relic' ? 523.25 : kind === 'brazier' ? 310 : 75;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + 0.22);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playExplorationCue(
    kind:
      | 'mechanism_slide'
      | 'lever_clunk'
      | 'chest_creak'
      | 'secret_chime'
      | 'locked_rattle'
      | 'lore_whisper'
  ): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;
    const now = this.ctx.currentTime;

    if (kind === 'mechanism_slide') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(72, now);
      osc.frequency.linearRampToValueAtTime(52, now + 0.55);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 210;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.62);
      return;
    }

    if (kind === 'secret_chime') {
      const freqs = [392.0, 523.25, 659.25];
      for (let i = 0; i < freqs.length; i++) {
        const t = now + i * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[i], t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.09, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(this.ambientBus);
        osc.start(t);
        osc.stop(t + 0.47);
      }
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (kind === 'lever_clunk') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }
    if (kind === 'chest_creak') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.linearRampToValueAtTime(280, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.34);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.38);
      return;
    }
    if (kind === 'locked_rattle') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.setValueAtTime(92, now + 0.07);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    // lore_whisper
    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain);
    gain.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.44);
  }

  public playGatherCue(kind: 'foliage' | 'mineral' | 'curio' | 'locked'): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;
    const now = this.ctx.currentTime;

    if (kind === 'foliage') {
      const dur = 0.14;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const env = Math.sin((i / ch.length) * Math.PI);
        ch[i] = (Math.random() * 2 - 1) * env * 0.7;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1150;
      filt.Q.value = 1.0;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.13;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.ambientBus);
      src.start(now);
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (kind === 'mineral') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.15);
    } else if (kind === 'curio') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.24);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(kind === 'locked' ? 0.08 : 0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ambientBus);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public update(elapsed: number, dt: number, speed: number, isGrounded: boolean, onPath: boolean): void {
    if (!this.enabled || !this.ctx || !this.windFilter || !this.windGain) return;

    if (this.envMode === 'forest') {
      const gust = 0.5 + 0.5 * Math.sin(elapsed * 0.27) * Math.cos(elapsed * 0.13);
      this.windFilter.frequency.setTargetAtTime(220 + gust * 250, this.ctx.currentTime, 0.25);
      this.windGain.gain.setTargetAtTime(0.24 + gust * 0.22, this.ctx.currentTime, 0.3);
    }

    if (isGrounded && speed > 0.6) {
      this.stepAccum += dt * (speed > 4.2 ? 3.2 : 2.15);
      if (this.stepAccum >= 1) {
        this.stepAccum -= 1;
        this.lastStepSign *= -1;
        this.playFootstep(onPath || this.envMode !== 'forest', speed > 4.2);
      }
    } else {
      this.stepAccum = 0.75;
    }
  }

  private playFootstep(onPath: boolean, isRunning: boolean): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;

    const now = this.ctx.currentTime;
    const dur = 0.085;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.exp((-i / bufSize) * 4.5);
      ch[i] = (Math.random() * 2 - 1) * env;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const modePitch = this.envMode === 'house' ? 320 : this.envMode === 'cave' || this.envMode === 'dungeon' ? 760 : onPath ? 620 : 410;
    filter.frequency.value = modePitch + this.lastStepSign * 45;
    filter.Q.value = onPath ? 1.4 : 0.9;

    const gain = this.ctx.createGain();
    gain.gain.value = isRunning ? 0.16 : 0.10;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientBus);
    src.start(now);
  }

  public playEcosystemCue(
    kind:
      | 'rustle'
      | 'crow'
      | 'owl'
      | 'songbird'
      | 'wolf_growl'
      | 'monster_alert'
      | 'monster_hit'
      | 'sword_swing'
      | 'sword_hit'
      | 'player_hurt'
      | 'spirit_chime'
      | 'npc_murmur'
  ): void {
    if (!this.ctx || !this.ambientBus || !this.enabled) return;
    const now = this.ctx.currentTime;

    if (kind === 'rustle') {
      const dur = 0.16;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const env = Math.sin((i / ch.length) * Math.PI);
        ch[i] = (Math.random() * 2 - 1) * env * 0.6;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.08;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientBus);
      src.start(now);
      return;
    }

    if (kind === 'crow') {
      for (let c = 0; c < 2; c++) {
        const t = now + c * 0.21;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(640 - c * 40, t);
        osc.frequency.exponentialRampToValueAtTime(420, t + 0.14);
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 950;
        filt.Q.value = 2.0;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(filt);
        filt.connect(gain);
        gain.connect(this.ambientBus);
        osc.start(t);
        osc.stop(t + 0.17);
      }
      return;
    }

    if (kind === 'owl') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.linearRampToValueAtTime(335, now + 0.36);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.42);
      return;
    }

    if (kind === 'songbird') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650, now);
      osc.frequency.exponentialRampToValueAtTime(2250, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.13);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    if (kind === 'wolf_growl' || kind === 'monster_alert') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const base = kind === 'wolf_growl' ? 115 : 86;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.32);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 340;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.36);
      return;
    }

    if (kind === 'sword_swing') {
      const dur = 0.14;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const env = Math.sin((i / ch.length) * Math.PI);
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(900, now);
      filt.frequency.exponentialRampToValueAtTime(340, now + dur);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.15;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.ambientBus);
      src.start(now);
      return;
    }

    if (kind === 'sword_hit' || kind === 'monster_hit' || kind === 'player_hurt') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const f0 = kind === 'sword_hit' ? 185 : kind === 'player_hurt' ? 105 : 130;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(kind === 'player_hurt' ? 0.2 : 0.16, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.19);
      return;
    }

    if (kind === 'spirit_chime') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.45);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.54);
      return;
    }

    if (kind === 'npc_murmur') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const f = 140 + Math.random() * 45;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.92, now + 0.09);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.ambientBus);
      osc.start(now);
      osc.stop(now + 0.11);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.ambientBus = null;
    this.musicBus = null;
    this.windGain = null;
    this.windFilter = null;
    this.droneGain = null;
    this.enabled = false;
  }
}
