import {
  BIOME_AUDIO_PROFILES,
  PersonalMusicPoolId,
  SurfaceKind,
  ThornvaleAudioBiomeId,
} from '../audio/audioCatalog';
import {
  AudioSettingsState,
  AudioVolumeChannel,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
} from '../audio/audioSettings';
import { ThornvaleMusicManager } from '../audio/musicManager';
import { MovementGait, ProceduralBuses, ProceduralSoundBank } from '../audio/proceduralAudio';
import { SpatialAudioContext } from '../audio/surfaceDetector';
import { FictionalVoiceSynth } from '../audio/voiceSynth';
import { NpcRole } from './types';

export interface AudioFrameInput {
  elapsed: number;
  dt: number;
  speed: number;
  isGrounded: boolean;
  gait: MovementGait;
  isCrouching: boolean;
  inCombat: boolean;
  isNight: boolean;
  nocturnalIntensity: number;
  spatial: SpatialAudioContext;
  stepTriggered: boolean;
}

/**
 * Central intelligent audio manager for Thornvale.
 * Coordinates personal .m4a music decks, 7-channel user volume settings,
 * surface-aware footsteps, biome & interior soundscapes, fictional NPC voices,
 * and entity-driven wildlife/monster cues.
 */
export class ForestAudioSystem {
  private ctx: AudioContext | null = null;

  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private creaturesBus: GainNode | null = null;
  private dialogueBus: GainNode | null = null;
  private weatherBus: GainNode | null = null;

  private echoSend: GainNode | null = null;
  private echoDelay: DelayNode | null = null;
  private echoFeedback: GainNode | null = null;
  private echoFilter: BiquadFilterNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;

  private buses: ProceduralBuses | null = null;
  private settings: AudioSettingsState;
  private musicManager = new ThornvaleMusicManager();
  private procedural = new ProceduralSoundBank();
  private voiceSynth = new FictionalVoiceSynth();

  private enabled = false;
  private envMode: 'forest' | 'house' | 'cave' | 'dungeon' = 'forest';
  private activeBiome: ThornvaleAudioBiomeId = 'plaines';
  private activeSurface: SurfaceKind = 'grass';
  private activeEchoAmount = 0.08;
  private wasInWater = false;
  private stealthAccum = 0;

  // Controlled stochastic scheduler timers (prevent overlapping / spam)
  private nextNatureDetailIn = 3.5;
  private nextEnvDetailIn = 4.5;
  private lastInteriorKind: string = 'none';

  private settingsListeners = new Set<(s: AudioSettingsState) => void>();

  constructor() {
    this.settings = loadAudioSettings();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getSettings(): AudioSettingsState {
    return { ...this.settings };
  }

  public onSettingsChange(cb: (s: AudioSettingsState) => void): () => void {
    this.settingsListeners.add(cb);
    return () => {
      this.settingsListeners.delete(cb);
    };
  }

  public setChannelVolume(channel: AudioVolumeChannel, value: number): AudioSettingsState {
    const clamped = Math.max(0, Math.min(1, value));
    this.settings = { ...this.settings, [channel]: clamped };
    saveAudioSettings(this.settings);
    this.applyBusVolumes();
    for (const cb of this.settingsListeners) {
      cb({ ...this.settings });
    }
    return { ...this.settings };
  }

  public resetSettings(): AudioSettingsState {
    this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    saveAudioSettings(this.settings);
    this.applyBusVolumes();
    for (const cb of this.settingsListeners) {
      cb({ ...this.settings });
    }
    return { ...this.settings };
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
    if (this.enabled) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupBuses(this.ctx);
      if (this.musicBus) {
        this.musicManager.attachContext(this.ctx, this.musicBus);
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.enabled = true;
    this.applyBusVolumes();
    this.musicManager.setEnabled(true);
  }

  public stop(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.voiceSynth.stop();
    this.musicManager.setEnabled(false);

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0, now, 0.16);
    }
  }

  public getMusicChannel(): { context: AudioContext | null; bus: GainNode | null } {
    return { context: this.ctx, bus: this.musicBus };
  }

  public getDebugAudioSnapshot(): {
    enabled: boolean;
    biome: ThornvaleAudioBiomeId;
    surface: SurfaceKind;
    trackTitle: string | null;
    musicPool: PersonalMusicPoolId | null;
  } {
    const track = this.musicManager.getCurrentTrackInfo();
    return {
      enabled: this.enabled,
      biome: this.activeBiome,
      surface: this.activeSurface,
      trackTitle: track ? track.title : null,
      musicPool: track ? track.pool : null,
    };
  }

  private setupBuses(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.masterGain);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.masterGain);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.masterGain);

    this.creaturesBus = ctx.createGain();
    this.creaturesBus.connect(this.masterGain);

    this.dialogueBus = ctx.createGain();
    this.dialogueBus.connect(this.masterGain);

    this.weatherBus = ctx.createGain();
    this.weatherBus.connect(this.masterGain);

    // Spatial delay-echo unit for caves, castles, dungeons, cliffs
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.65;

    this.echoDelay = ctx.createDelay(1.0);
    this.echoDelay.delayTime.value = 0.18;

    this.echoFeedback = ctx.createGain();
    this.echoFeedback.gain.value = 0.25;

    this.echoFilter = ctx.createBiquadFilter();
    this.echoFilter.type = 'lowpass';
    this.echoFilter.frequency.value = 1450;

    this.echoSend.connect(this.echoDelay);
    this.echoDelay.connect(this.echoFilter);
    this.echoFilter.connect(this.echoFeedback);
    this.echoFeedback.connect(this.echoDelay);
    this.echoFilter.connect(this.ambienceBus);

    this.buses = {
      ambience: this.ambienceBus,
      sfx: this.sfxBus,
      creatures: this.creaturesBus,
      weather: this.weatherBus,
      music: this.musicBus,
      echoSend: this.echoSend,
    };

    // Seamless brown/pink noise loop for wind
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 4;
    const windBuffer = ctx.createBuffer(1, length, sampleRate);
    const windData = windBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      windData[i] = lastOut * 2.8;
    }
    const windNoise = ctx.createBufferSource();
    windNoise.buffer = windBuffer;
    windNoise.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 320;
    this.windFilter.Q.value = 0.85;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.28;

    windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.weatherBus);
    windNoise.start();

    // Seamless white/pink stream loop for brooks & waterfalls
    const waterBuffer = ctx.createBuffer(1, length, sampleRate);
    const waterData = waterBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.96 * b0 + w * 0.25;
      b1 = 0.8 * b1 + w * 0.35;
      waterData[i] = (b0 + b1) * 0.5;
    }
    const waterNoise = ctx.createBufferSource();
    waterNoise.buffer = waterBuffer;
    waterNoise.loop = true;

    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 920;
    this.waterFilter.Q.value = 0.65;

    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.0001;

    waterNoise.connect(this.waterFilter);
    this.waterFilter.connect(this.waterGain);
    this.waterGain.connect(this.ambienceBus);
    waterNoise.start();

    // Subtle hollow resonance drone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 65.41;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.02;
    osc.connect(droneGain);
    droneGain.connect(this.ambienceBus);
    osc.start();
    this.droneGain = droneGain;

    this.applyBusVolumes();
  }

  private applyBusVolumes(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.enabled ? this.settings.master * 0.68 : 0.0;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.14);

    this.musicBus?.gain.setTargetAtTime(this.settings.music * 0.72, now, 0.08);
    this.ambienceBus?.gain.setTargetAtTime(this.settings.ambience * 0.85, now, 0.08);
    this.sfxBus?.gain.setTargetAtTime(this.settings.sfx * 0.92, now, 0.08);
    this.creaturesBus?.gain.setTargetAtTime(this.settings.creatures * 0.9, now, 0.08);
    this.dialogueBus?.gain.setTargetAtTime(this.settings.dialogue * 0.95, now, 0.08);
    this.weatherBus?.gain.setTargetAtTime(this.settings.weather * 0.85, now, 0.08);
  }

  public setEnvironmentMode(mode: 'forest' | 'house' | 'cave' | 'dungeon'): void {
    this.envMode = mode;
    if (!this.ctx || !this.windFilter || !this.windGain || !this.droneGain) return;
    const now = this.ctx.currentTime;
    if (mode === 'house') {
      this.windFilter.frequency.setTargetAtTime(160, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.08, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.012, now, 0.35);
    } else if (mode === 'cave') {
      this.windFilter.frequency.setTargetAtTime(135, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.13, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.042, now, 0.35);
    } else if (mode === 'dungeon') {
      this.windFilter.frequency.setTargetAtTime(150, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.12, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.048, now, 0.35);
    } else {
      this.windFilter.frequency.setTargetAtTime(320, now, 0.35);
      this.windGain.gain.setTargetAtTime(0.28, now, 0.35);
      this.droneGain.gain.setTargetAtTime(0.022, now, 0.35);
    }
  }

  // =========================================================================
  // MAIN FRAME UPDATE (Central Audio Coordinator)
  // =========================================================================

  public updateFrame(frame: AudioFrameInput): void {
    const {
      elapsed,
      dt,
      speed,
      isGrounded,
      gait,
      isCrouching,
      inCombat,
      isNight,
      nocturnalIntensity,
      spatial,
      stepTriggered,
    } = frame;

    this.activeBiome = spatial.biome;
    this.activeSurface = spatial.surface;

    if (!this.enabled || !this.ctx || !this.buses) return;

    const profile = BIOME_AUDIO_PROFILES[spatial.biome];
    const now = this.ctx.currentTime;

    // 1. Update spatial echo acoustics (small cave vs large cave vs house vs castle vs mountains)
    let targetEcho = profile.echoAmount;
    let targetDelay = profile.echoTimeSec;
    if (spatial.interiorKind === 'small_cave') {
      targetEcho = 0.34;
      targetDelay = 0.14;
    } else if (spatial.interiorKind === 'large_cave') {
      targetEcho = 0.56;
      targetDelay = 0.31;
    } else if (spatial.interiorKind === 'small_house') {
      targetEcho = 0.14;
      targetDelay = 0.07;
    } else if (spatial.interiorKind === 'castle_hall' || spatial.interiorKind === 'dungeon') {
      targetEcho = 0.55;
      targetDelay = 0.29;
    }
    this.activeEchoAmount = targetEcho;
    if (this.echoDelay && this.echoFeedback) {
      this.echoDelay.delayTime.setTargetAtTime(targetDelay, now, 0.3);
      this.echoFeedback.gain.setTargetAtTime(Math.min(0.5, targetEcho * 0.72), now, 0.3);
    }

    // Reset transient schedulers cleanly when crossing between interior/exterior
    if (spatial.interiorKind !== this.lastInteriorKind) {
      this.lastInteriorKind = spatial.interiorKind;
      this.nextEnvDetailIn = 2.0 + Math.random() * 2.5;
      this.nextNatureDetailIn = 2.5 + Math.random() * 3.0;
    }

    // 2. Wind, Mountain Gusts & Water Stream Layers
    if (this.windFilter && this.windGain) {
      const gustSpeed = spatial.biome === 'montagnes' || spatial.biome === 'falaises' ? 0.55 : 0.27;
      const gust =
        0.5 +
        0.5 * Math.sin(elapsed * gustSpeed) * Math.cos(elapsed * (gustSpeed * 0.48));
      const altBoost = 1 + spatial.altitudeFactor * 0.45;
      const atten = 1 - profile.exteriorAttenuation * 0.78;
      const windFreq = profile.windCenterHz * (0.76 + gust * 0.55) * altBoost;
      const windAmp = profile.windLevel * (0.35 + gust * 0.48) * atten;

      this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.28);
      this.windGain.gain.setTargetAtTime(Math.max(0.02, windAmp), now, 0.32);
    }

    if (this.waterGain && this.waterFilter) {
      const waterLvl = Math.max(
        spatial.waterProximity * 0.24,
        spatial.waterfallProximity * 0.42,
        spatial.inWater ? 0.14 : 0
      );
      const waterFreq = 720 + spatial.waterfallProximity * 620;
      this.waterFilter.frequency.setTargetAtTime(waterFreq, now, 0.3);
      const isDampCave =
        spatial.interiorKind === 'small_cave' || spatial.interiorKind === 'large_cave';
      this.waterGain.gain.setTargetAtTime(
        spatial.isInterior && !isDampCave ? 0.0001 : Math.max(0.0001, waterLvl),
        now,
        0.35
      );
    }

    // 3. Water entry / exit splash detection
    if (spatial.inWater !== this.wasInWater) {
      this.wasInWater = spatial.inWater;
      if (isGrounded) {
        this.procedural.playWaterSplash(
          this.ctx,
          this.buses,
          spatial.inWater ? 0.95 : 0.65,
          this.activeEchoAmount
        );
      }
    }

    // 4. Synchronized Footsteps (strictly grounded + moving + tied to gait walkCycle)
    if (stepTriggered && isGrounded && speed > 0.35) {
      this.procedural.playFootstep(
        this.ctx,
        this.buses,
        spatial.surface,
        gait,
        spatial.waterDepth,
        this.activeEchoAmount
      );
    }

    // 5. Stealth duration tracking for "missions de découverte ou de discrétion"
    if (isCrouching) {
      this.stealthAccum = Math.min(10, this.stealthAccum + dt);
    } else {
      this.stealthAccum = Math.max(0, this.stealthAccum - dt * 1.5);
    }

    // 6. Music Pool Selection (respecting user folder destinations)
    let targetPool: PersonalMusicPoolId = profile.musicPool;
    if (
      this.stealthAccum > 1.6 ||
      spatial.interiorKind === 'small_cave' ||
      spatial.interiorKind === 'large_cave'
    ) {
      targetPool = 'discretion_decouverte';
    } else if (
      spatial.inCastleZone ||
      spatial.interiorKind === 'castle_hall' ||
      spatial.interiorKind === 'dungeon' ||
      spatial.interiorKind === 'ruin_sanctum'
    ) {
      targetPool = 'chateau_mysterieux';
    } else {
      targetPool = profile.musicPool;
    }
    this.musicManager.update(dt, inCombat, targetPool);

    // 7. Controlled Environmental Details (non-cacophonous intervals)
    this.nextEnvDetailIn -= dt;
    if (this.nextEnvDetailIn <= 0) {
      this.triggerContextualEnvDetail(spatial, isNight);
      this.nextEnvDetailIn =
        spatial.isInterior ? 4.2 + Math.random() * 5.5 : 4.8 + Math.random() * 6.5;
    }

    this.nextNatureDetailIn -= dt;
    if (this.nextNatureDetailIn <= 0) {
      this.triggerContextualNatureDetail(spatial, nocturnalIntensity);
      this.nextNatureDetailIn = 5.5 + Math.random() * 7.0;
    }
  }

  /** Backward-compatible update signature */
  public update(
    elapsed: number,
    dt: number,
    speed: number,
    isGrounded: boolean,
    onPath: boolean
  ): void {
    this.updateFrame({
      elapsed,
      dt,
      speed,
      isGrounded,
      gait: speed > 4.2 ? 'run' : 'walk',
      isCrouching: false,
      inCombat: false,
      isNight: false,
      nocturnalIntensity: 0,
      stepTriggered: false,
      spatial: {
        biome: this.envMode === 'house' ? 'villages' : this.envMode === 'cave' ? 'grottes' : this.envMode === 'dungeon' ? 'donjons' : 'foret_ancienne',
        surface: this.envMode === 'house' ? 'wood' : this.envMode === 'cave' ? 'cave' : this.envMode === 'dungeon' ? 'dungeon' : onPath ? 'dirt_path' : 'grass',
        waterDepth: 0,
        inWater: false,
        waterProximity: 0,
        waterfallProximity: 0,
        isInterior: this.envMode !== 'forest',
        interiorId: null,
        interiorKind: 'none',
        altitudeFactor: 0,
        nearFire: false,
        canopyDensity: 0.5,
        inCastleZone: false,
      },
    });
  }

  private triggerContextualEnvDetail(spatial: SpatialAudioContext, isNight: boolean): void {
    if (!this.ctx || !this.buses) return;

    if (spatial.nearFire && Math.random() < 0.65) {
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        spatial.interiorKind === 'small_house' ? 'hearth_pop' : 'torch_crackle',
        this.activeEchoAmount
      );
      return;
    }

    if (spatial.interiorKind === 'small_house') {
      const r = Math.random();
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        r < 0.62 ? 'wood_creak' : 'shutter_rattle',
        this.activeEchoAmount
      );
      return;
    }

    if (spatial.interiorKind === 'castle_hall' || spatial.interiorKind === 'ruin_sanctum') {
      if (isNight && Math.random() < 0.35) {
        this.procedural.playSpeciesCue(this.ctx, this.buses, 'owl', 22, 0.35);
      } else {
        this.procedural.playEnvironmentDetail(this.ctx, this.buses, 'wood_creak', this.activeEchoAmount);
      }
      return;
    }

    if (spatial.interiorKind === 'small_cave' || spatial.interiorKind === 'large_cave') {
      const r = Math.random();
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        r < 0.72 ? 'cave_drip' : 'rockfall',
        this.activeEchoAmount
      );
      return;
    }

    if (spatial.interiorKind === 'dungeon') {
      const r = Math.random();
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        r < 0.45 ? 'cave_drip' : r < 0.8 ? 'dungeon_chain' : 'rockfall',
        this.activeEchoAmount
      );
      return;
    }

    // Exterior biome micro-details
    if (spatial.biome === 'montagnes' || spatial.biome === 'falaises') {
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        Math.random() < 0.5 ? 'cliff_echo_gust' : 'rockfall',
        this.activeEchoAmount
      );
    } else if (spatial.biome === 'ruines' || spatial.biome === 'chateaux') {
      if (isNight && Math.random() < 0.45) {
        this.procedural.playSpeciesCue(this.ctx, this.buses, 'owl', 18, 0.3);
      } else if (Math.random() < 0.5) {
        this.procedural.playEnvironmentDetail(this.ctx, this.buses, 'rockfall', this.activeEchoAmount);
      }
    } else if (spatial.biome === 'foret_ancienne' || spatial.biome === 'plaines') {
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        Math.random() < 0.45 ? 'twig_snap' : 'leaf_rustle',
        this.activeEchoAmount
      );
    }
  }

  private triggerContextualNatureDetail(
    spatial: SpatialAudioContext,
    nocturnalIntensity: number
  ): void {
    if (!this.ctx || !this.buses || spatial.isInterior) return;
    if (spatial.biome === 'marecages') {
      this.procedural.playEnvironmentDetail(
        this.ctx,
        this.buses,
        Math.random() < (nocturnalIntensity > 0.35 ? 0.65 : 0.45) ? 'frog_croak' : 'swamp_insect',
        this.activeEchoAmount
      );
    } else if (spatial.biome === 'rivieres_lacs' && Math.random() < 0.4) {
      this.procedural.playEnvironmentDetail(this.ctx, this.buses, 'frog_croak', this.activeEchoAmount);
    }
  }

  // =========================================================================
  // MOVEMENT, VOICE, DISCOVERY & GAMEPLAY CUES
  // =========================================================================

  public playJumpCue(surface: SurfaceKind): void {
    if (!this.ctx || !this.buses || !this.enabled) return;
    this.procedural.playJump(this.ctx, this.buses, surface);
  }

  public playLandCue(surface: SurfaceKind, fallSpeed: number): void {
    if (!this.ctx || !this.buses || !this.enabled) return;
    this.procedural.playLand(
      this.ctx,
      this.buses,
      surface,
      Math.abs(fallSpeed) / 7.0,
      this.activeEchoAmount
    );
  }

  public speakDialogueLine(npcId: string, role: NpcRole, text: string): void {
    if (!this.ctx || !this.dialogueBus || !this.enabled) return;
    this.voiceSynth.speakLine(this.ctx, this.dialogueBus, npcId, role, text);
  }

  public stopDialogueSpeech(): void {
    this.voiceSynth.stop();
  }

  public playDiscoveryMoment(): void {
    if (!this.ctx || !this.buses || !this.enabled) return;
    // Rare discovery harmonic swell + activates discovery/discretion track temporarily
    const now = this.ctx.currentTime;
    const notes = [293.66, 349.23, 440.0, 587.33]; // D minor 9 evocative dark-fantasy swell
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      osc.connect(gain);
      gain.connect(this.buses.music);
      osc.start(t);
      osc.stop(t + 1.4);
    }
    this.musicManager.triggerDiscoveryAccent(28);
  }

  public playTransitionCue(kind: 'wood' | 'stone' | 'cave'): void {
    if (!this.ctx || !this.sfxBus || !this.enabled) return;
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
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playInteractCue(kind: 'door' | 'brazier' | 'relic' | 'secret'): void {
    if (!this.ctx || !this.sfxBus || !this.enabled) return;
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
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.28);
    if (kind === 'relic' || kind === 'secret') {
      this.musicManager.triggerDiscoveryAccent(22);
    }
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
    if (!this.ctx || !this.sfxBus || !this.enabled) return;
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
      gain.connect(this.sfxBus);
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
        gain.connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 0.47);
      }
      this.musicManager.triggerDiscoveryAccent(24);
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
    } else if (kind === 'chest_creak') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.linearRampToValueAtTime(280, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.34);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    } else if (kind === 'locked_rattle') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.setValueAtTime(92, now + 0.07);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    }
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.44);
  }

  public playGatherCue(kind: 'foliage' | 'mineral' | 'curio' | 'locked'): void {
    if (!this.ctx || !this.sfxBus || !this.enabled) return;
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
      gain.connect(this.sfxBus);
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
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playEcosystemCue(
    kind:
      | 'rustle'
      | 'crow'
      | 'owl'
      | 'songbird'
      | 'eagle'
      | 'wolf_growl'
      | 'boar_snort'
      | 'bear_roar'
      | 'spider_chitter'
      | 'skeleton_rattle'
      | 'colossus_breath'
      | 'wraith_wail'
      | 'monster_alert'
      | 'monster_hit'
      | 'sword_swing'
      | 'sword_hit'
      | 'player_hurt'
      | 'spirit_chime'
      | 'npc_murmur',
    distance = 6
  ): void {
    if (!this.ctx || !this.buses || !this.enabled) return;
    if (kind === 'npc_murmur') {
      // Legacy fallback if called without full line text
      this.voiceSynth.speakLine(this.ctx, this.dialogueBus!, 'npc_generic', 'traveler', 'Well met.');
      return;
    }
    this.procedural.playSpeciesCue(this.ctx, this.buses, kind, distance, this.activeEchoAmount);
  }

  public dispose(): void {
    this.voiceSynth.stop();
    this.musicManager.dispose();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.musicBus = null;
    this.ambienceBus = null;
    this.sfxBus = null;
    this.creaturesBus = null;
    this.dialogueBus = null;
    this.weatherBus = null;
    this.echoSend = null;
    this.echoDelay = null;
    this.echoFeedback = null;
    this.echoFilter = null;
    this.windGain = null;
    this.windFilter = null;
    this.waterGain = null;
    this.waterFilter = null;
    this.droneGain = null;
    this.buses = null;
    this.enabled = false;
  }
}
