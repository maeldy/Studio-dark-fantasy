import { SurfaceKind } from './audioCatalog';

export type MovementGait = 'walk' | 'run' | 'crouch';

export interface ProceduralBuses {
  ambience: GainNode;
  sfx: GainNode;
  creatures: GainNode;
  weather: GainNode;
  music: GainNode;
  echoSend: GainNode;
}

export class ProceduralSoundBank {
  private noiseBuf: AudioBuffer | null = null;
  private stepSign = 1;

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf && this.noiseBuf.sampleRate === ctx.sampleRate) {
      return this.noiseBuf;
    }
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    this.noiseBuf = buf;
    return buf;
  }

  private playFilteredNoise(
    ctx: AudioContext,
    dest: AudioNode,
    dur: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    q: number,
    gainPeak: number,
    attack = 0.008,
    echoDest?: AudioNode,
    echoSendAmt = 0
  ): void {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const offset = Math.random() * 1.1;

    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + dur);
    }
    filt.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(dest);
    if (echoDest && echoSendAmt > 0.01) {
      const send = ctx.createGain();
      send.gain.value = echoSendAmt;
      gain.connect(send);
      send.connect(echoDest);
    }
    src.start(now, offset, dur + 0.02);
  }

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gainPeak: number,
    attack = 0.012,
    echoDest?: AudioNode,
    echoSendAmt = 0
  ): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, f0), now);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, f1), now + dur);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(dest);
    if (echoDest && echoSendAmt > 0.01) {
      const send = ctx.createGain();
      send.gain.value = echoSendAmt;
      gain.connect(send);
      send.connect(echoDest);
    }
    osc.start(now);
    osc.stop(now + dur + 0.025);
  }

  // =========================================================================
  // 1. FOOTSTEPS, JUMPS, LANDINGS & WATER INTERACTIONS
  // =========================================================================

  public playFootstep(
    ctx: AudioContext,
    buses: ProceduralBuses,
    surface: SurfaceKind,
    gait: MovementGait,
    waterDepth: number,
    echoAmount: number
  ): void {
    this.stepSign *= -1;
    const pitchJitter = 1 + this.stepSign * 0.06 + (Math.random() - 0.5) * 0.08;
    const gaitVol = gait === 'run' ? 1.35 : gait === 'crouch' ? 0.42 : 0.92;
    const gaitDur = gait === 'run' ? 0.86 : gait === 'crouch' ? 1.2 : 1.0;

    switch (surface) {
      case 'grass': {
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.085 * gaitDur,
          'bandpass',
          1050 * pitchJitter,
          620 * pitchJitter,
          1.1,
          0.095 * gaitVol
        );
        this.playTone(ctx, buses.sfx, 'sine', 95 * pitchJitter, 58, 0.055, 0.045 * gaitVol, 0.004);
        break;
      }
      case 'dirt_path': {
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.078 * gaitDur,
          'bandpass',
          680 * pitchJitter,
          360 * pitchJitter,
          1.4,
          0.115 * gaitVol
        );
        this.playTone(ctx, buses.sfx, 'triangle', 120 * pitchJitter, 62, 0.06, 0.065 * gaitVol, 0.004);
        break;
      }
      case 'leaves': {
        // Crispy dry forest litter crunch + soft thud
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.115 * gaitDur,
          'bandpass',
          2250 * pitchJitter,
          1200 * pitchJitter,
          1.35,
          0.11 * gaitVol
        );
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.075,
          'highpass',
          3100 * pitchJitter,
          2400,
          0.8,
          0.045 * gaitVol
        );
        break;
      }
      case 'wood': {
        // Hollow wooden plank knock + occasional subtle creak
        this.playTone(
          ctx,
          buses.sfx,
          'triangle',
          168 * pitchJitter,
          82 * pitchJitter,
          0.095,
          0.11 * gaitVol,
          0.003,
          buses.echoSend,
          echoAmount * 0.45
        );
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.065,
          'bandpass',
          490 * pitchJitter,
          310,
          1.8,
          0.065 * gaitVol
        );
        if (Math.random() < (gait === 'crouch' ? 0.12 : 0.24)) {
          this.playTone(
            ctx,
            buses.sfx,
            'sawtooth',
            265 * pitchJitter,
            215,
            0.16,
            0.018 * gaitVol,
            0.03
          );
        }
        break;
      }
      case 'stone':
      case 'dungeon': {
        const isDungeon = surface === 'dungeon';
        this.playTone(
          ctx,
          buses.sfx,
          'triangle',
          (isDungeon ? 210 : 250) * pitchJitter,
          98,
          0.068,
          0.095 * gaitVol,
          0.002,
          buses.echoSend,
          Math.max(echoAmount, isDungeon ? 0.55 : 0.22)
        );
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.055,
          'bandpass',
          1650 * pitchJitter,
          820,
          1.9,
          0.085 * gaitVol,
          0.003,
          buses.echoSend,
          Math.max(echoAmount, isDungeon ? 0.55 : 0.22)
        );
        break;
      }
      case 'cave': {
        // Damp cavern rock tap + subtle grit + deep cave echo
        this.playTone(
          ctx,
          buses.sfx,
          'triangle',
          190 * pitchJitter,
          84,
          0.075,
          0.09 * gaitVol,
          0.003,
          buses.echoSend,
          Math.max(0.45, echoAmount)
        );
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.09 * gaitDur,
          'bandpass',
          1850 * pitchJitter,
          940,
          1.5,
          0.075 * gaitVol,
          0.004,
          buses.echoSend,
          Math.max(0.45, echoAmount)
        );
        break;
      }
      case 'gravel': {
        // Loose crunching pebbles (two micro-bursts)
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.095 * gaitDur,
          'bandpass',
          2400 * pitchJitter,
          1350,
          1.4,
          0.105 * gaitVol,
          0.004,
          buses.echoSend,
          echoAmount * 0.4
        );
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.06,
          'highpass',
          3400 * pitchJitter,
          2800,
          1.0,
          0.055 * gaitVol
        );
        break;
      }
      case 'mud': {
        // Sticky bog suction + wet squelch
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.14 * gaitDur,
          'bandpass',
          420 * pitchJitter,
          780 * pitchJitter,
          2.6,
          0.125 * gaitVol,
          0.012
        );
        this.playTone(
          ctx,
          buses.sfx,
          'sine',
          115 * pitchJitter,
          210 * pitchJitter,
          0.11,
          0.075 * gaitVol,
          0.02
        );
        break;
      }
      case 'water_shallow':
      case 'water_deep': {
        const deep = surface === 'water_deep' || waterDepth > 0.28;
        const splashDur = (deep ? 0.24 : 0.16) * (gait === 'crouch' ? 1.15 : 1.0);
        const splashFreq = deep ? 680 : 1250;
        const splashVol = (deep ? 0.155 : 0.115) * gaitVol;
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          splashDur,
          'bandpass',
          splashFreq * pitchJitter,
          360,
          1.1,
          splashVol,
          0.012,
          buses.echoSend,
          echoAmount * 0.25
        );
        // Bubbly water drop plop
        this.playTone(
          ctx,
          buses.sfx,
          'sine',
          (deep ? 260 : 380) * pitchJitter,
          (deep ? 520 : 690) * pitchJitter,
          0.095,
          0.055 * gaitVol,
          0.01
        );
        break;
      }
      case 'snow': {
        // Prepared crisp snow crunch for future snowy biomes
        this.playFilteredNoise(
          ctx,
          buses.sfx,
          0.11 * gaitDur,
          'bandpass',
          1750 * pitchJitter,
          900,
          1.9,
          0.11 * gaitVol
        );
        break;
      }
    }
  }

  public playJump(ctx: AudioContext, buses: ProceduralBuses, surface: SurfaceKind): void {
    const inWater = surface === 'water_shallow' || surface === 'water_deep';
    if (inWater) {
      this.playWaterSplash(ctx, buses, 0.85, 0.15);
    } else {
      this.playFilteredNoise(ctx, buses.sfx, 0.11, 'bandpass', 420, 920, 0.9, 0.085, 0.008);
      this.playTone(ctx, buses.sfx, 'triangle', 110, 185, 0.09, 0.05, 0.006);
    }
  }

  public playLand(
    ctx: AudioContext,
    buses: ProceduralBuses,
    surface: SurfaceKind,
    impactStrength: number,
    echoAmount: number
  ): void {
    const amp = Math.max(0.55, Math.min(1.4, impactStrength));
    if (surface === 'water_shallow' || surface === 'water_deep') {
      this.playWaterSplash(ctx, buses, amp * 1.15, echoAmount);
      return;
    }
    this.playTone(
      ctx,
      buses.sfx,
      'sine',
      115,
      46,
      0.13,
      0.13 * amp,
      0.004,
      buses.echoSend,
      echoAmount * 0.5
    );
    this.playFootstep(ctx, buses, surface, 'run', 0, echoAmount);
  }

  public playWaterSplash(
    ctx: AudioContext,
    buses: ProceduralBuses,
    intensity: number,
    echoAmount: number
  ): void {
    const amp = Math.max(0.4, Math.min(1.4, intensity));
    this.playFilteredNoise(
      ctx,
      buses.sfx,
      0.28,
      'bandpass',
      1350,
      420,
      0.9,
      0.15 * amp,
      0.01,
      buses.echoSend,
      echoAmount * 0.35
    );
    this.playTone(ctx, buses.sfx, 'sine', 220, 480, 0.12, 0.06 * amp, 0.01);
  }

  // =========================================================================
  // 2. ENVIRONMENTAL & ARCHITECTURAL MICRO-EVENTS
  // =========================================================================

  public playEnvironmentDetail(
    ctx: AudioContext,
    buses: ProceduralBuses,
    kind:
      | 'twig_snap'
      | 'leaf_rustle'
      | 'frog_croak'
      | 'swamp_insect'
      | 'rockfall'
      | 'cliff_echo_gust'
      | 'wood_creak'
      | 'shutter_rattle'
      | 'hearth_pop'
      | 'cave_drip'
      | 'dungeon_chain'
      | 'torch_crackle',
    echoAmount: number
  ): void {
    switch (kind) {
      case 'twig_snap': {
        this.playFilteredNoise(ctx, buses.ambience, 0.05, 'bandpass', 2400, 1400, 2.2, 0.065, 0.002);
        this.playTone(ctx, buses.ambience, 'triangle', 480, 190, 0.04, 0.04, 0.002);
        break;
      }
      case 'leaf_rustle': {
        this.playFilteredNoise(
          ctx,
          buses.ambience,
          0.32,
          'bandpass',
          1550,
          1100,
          1.1,
          0.045,
          0.05
        );
        break;
      }
      case 'frog_croak': {
        const base = 145 + Math.random() * 45;
        const now = ctx.currentTime;
        const bursts = Math.random() > 0.45 ? 2 : 1;
        for (let b = 0; b < bursts; b++) {
          const t = now + b * 0.17;
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.linearRampToValueAtTime(base * 1.18, t + 0.08);
          const filt = ctx.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.value = 460;
          filt.Q.value = 3.6;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.055, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          osc.connect(filt);
          filt.connect(gain);
          gain.connect(buses.creatures);
          osc.start(t);
          osc.stop(t + 0.13);
        }
        break;
      }
      case 'swamp_insect': {
        this.playTone(ctx, buses.creatures, 'sine', 3400 + Math.random() * 900, 3100, 0.24, 0.015, 0.04);
        break;
      }
      case 'rockfall': {
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          window.setTimeout(() => {
            if (ctx.state === 'closed') return;
            this.playTone(
              ctx,
              buses.ambience,
              'triangle',
              125 + Math.random() * 80,
              48,
              0.12,
              0.055,
              0.005,
              buses.echoSend,
              Math.max(0.35, echoAmount)
            );
            this.playFilteredNoise(
              ctx,
              buses.ambience,
              0.14,
              'bandpass',
              1200 + Math.random() * 600,
              480,
              1.4,
              0.045,
              0.005,
              buses.echoSend,
              Math.max(0.35, echoAmount)
            );
          }, i * (95 + Math.random() * 140));
        }
        break;
      }
      case 'cliff_echo_gust': {
        this.playFilteredNoise(
          ctx,
          buses.weather,
          1.35,
          'bandpass',
          380,
          720,
          1.8,
          0.08,
          0.35,
          buses.echoSend,
          0.45
        );
        break;
      }
      case 'wood_creak': {
        const f0 = 185 + Math.random() * 90;
        this.playTone(
          ctx,
          buses.ambience,
          'sawtooth',
          f0,
          f0 * (0.78 + Math.random() * 0.14),
          0.34,
          0.032,
          0.05,
          buses.echoSend,
          echoAmount * 0.4
        );
        break;
      }
      case 'shutter_rattle': {
        this.playTone(ctx, buses.ambience, 'triangle', 140, 86, 0.07, 0.045, 0.004);
        window.setTimeout(() => {
          if (ctx.state === 'closed') return;
          this.playTone(ctx, buses.ambience, 'triangle', 125, 76, 0.06, 0.03, 0.004);
        }, 110);
        break;
      }
      case 'hearth_pop':
      case 'torch_crackle': {
        this.playFilteredNoise(
          ctx,
          buses.ambience,
          0.045,
          'highpass',
          2600 + Math.random() * 1400,
          1900,
          1.5,
          kind === 'hearth_pop' ? 0.05 : 0.035,
          0.002
        );
        break;
      }
      case 'cave_drip': {
        const f = 920 + Math.random() * 520;
        this.playTone(
          ctx,
          buses.ambience,
          'sine',
          f,
          f * 1.48,
          0.065,
          0.05,
          0.003,
          buses.echoSend,
          Math.max(0.5, echoAmount)
        );
        break;
      }
      case 'dungeon_chain': {
        this.playFilteredNoise(
          ctx,
          buses.ambience,
          0.26,
          'bandpass',
          2400,
          1650,
          3.4,
          0.032,
          0.02,
          buses.echoSend,
          0.55
        );
        break;
      }
    }
  }

  // =========================================================================
  // 3. WILDLIFE, CREATURES & MONSTERS (Entity-linked)
  // =========================================================================

  public playSpeciesCue(
    ctx: AudioContext,
    buses: ProceduralBuses,
    cue: string,
    distance: number,
    echoAmount: number
  ): void {
    const atten = Math.max(0.18, 1 - distance / 34);

    if (cue === 'rustle') {
      this.playFilteredNoise(ctx, buses.creatures, 0.16, 'bandpass', 1400, 920, 1.2, 0.08 * atten, 0.02);
      return;
    }
    if (cue === 'crow') {
      for (let c = 0; c < 2; c++) {
        window.setTimeout(() => {
          if (ctx.state === 'closed') return;
          this.playTone(ctx, buses.creatures, 'sawtooth', 640 - c * 40, 410, 0.14, 0.055 * atten, 0.015, buses.echoSend, echoAmount * 0.4);
        }, c * 210);
      }
      return;
    }
    if (cue === 'owl') {
      this.playTone(ctx, buses.creatures, 'sine', 385, 330, 0.4, 0.065 * atten, 0.05, buses.echoSend, Math.max(0.2, echoAmount * 0.6));
      return;
    }
    if (cue === 'songbird') {
      const f = 1550 + Math.random() * 450;
      this.playTone(ctx, buses.creatures, 'sine', f, f * 1.32, 0.14, 0.04 * atten, 0.012);
      return;
    }
    if (cue === 'eagle') {
      this.playTone(ctx, buses.creatures, 'sawtooth', 1420, 960, 0.34, 0.045 * atten, 0.03, buses.echoSend, 0.35);
      return;
    }
    if (cue === 'wolf_growl' || cue === 'boar_snort' || cue === 'bear_roar') {
      const base = cue === 'bear_roar' ? 76 : cue === 'boar_snort' ? 105 : 118;
      this.playTone(ctx, buses.creatures, 'sawtooth', base, base * 0.72, cue === 'bear_roar' ? 0.48 : 0.32, 0.115 * atten, 0.04, buses.echoSend, echoAmount * 0.45);
      return;
    }
    if (cue === 'spider_chitter') {
      for (let k = 0; k < 3; k++) {
        window.setTimeout(() => {
          if (ctx.state === 'closed') return;
          this.playFilteredNoise(ctx, buses.creatures, 0.04, 'bandpass', 2800 + k * 250, 1900, 3.0, 0.06 * atten, 0.003);
        }, k * 55);
      }
      return;
    }
    if (cue === 'skeleton_rattle') {
      for (let k = 0; k < 2; k++) {
        window.setTimeout(() => {
          if (ctx.state === 'closed') return;
          this.playFilteredNoise(ctx, buses.creatures, 0.065, 'bandpass', 2150, 1450, 2.8, 0.065 * atten, 0.004, buses.echoSend, 0.4);
        }, k * 70);
      }
      return;
    }
    if (cue === 'colossus_breath') {
      this.playFilteredNoise(ctx, buses.creatures, 0.55, 'lowpass', 220, 110, 1.2, 0.095 * atten, 0.14, buses.echoSend, 0.45);
      return;
    }
    if (cue === 'wraith_wail') {
      this.playTone(ctx, buses.creatures, 'sine', 420, 290, 0.55, 0.06 * atten, 0.08, buses.echoSend, 0.55);
      return;
    }
    if (cue === 'spirit_chime') {
      this.playTone(ctx, buses.creatures, 'sine', 587.33, 880, 0.48, 0.065 * atten, 0.06, buses.echoSend, 0.45);
      return;
    }
    if (cue === 'monster_alert') {
      this.playTone(ctx, buses.creatures, 'sawtooth', 88, 62, 0.36, 0.115 * atten, 0.04, buses.echoSend, echoAmount * 0.5);
      return;
    }
    if (cue === 'sword_swing') {
      this.playFilteredNoise(ctx, buses.sfx, 0.14, 'bandpass', 940, 340, 1.0, 0.16, 0.01);
      return;
    }
    if (cue === 'sword_hit' || cue === 'monster_hit' || cue === 'player_hurt') {
      const f0 = cue === 'sword_hit' ? 190 : cue === 'player_hurt' ? 105 : 135;
      this.playTone(
        ctx,
        buses.sfx,
        'triangle',
        f0,
        46,
        0.18,
        cue === 'player_hurt' ? 0.21 : 0.17,
        0.01,
        buses.echoSend,
        echoAmount * 0.35
      );
      this.playFilteredNoise(ctx, buses.sfx, 0.08, 'bandpass', 1100, 420, 1.3, 0.08, 0.004);
    }
  }
}
