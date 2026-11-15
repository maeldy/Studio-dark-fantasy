import { PERSONAL_MUSIC_TRACKS, PersonalMusicPoolId, PersonalMusicTrack } from './audioCatalog';

export type MusicSituationMode =
  | 'nature_exploration'
  | 'chateau_mysterieux'
  | 'discretion_decouverte'
  | 'combat';

interface DeckSlot {
  audio: HTMLAudioElement;
  gainNode: GainNode | null;
  connected: boolean;
  trackId: string | null;
}

/**
 * Dual-deck crossfading music controller using the user's personal .m4a tracks
 * plus a procedural dark-fantasy combat stem (since no combat tracks were in the archive).
 */
export class ThornvaleMusicManager {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;

  private decks: [DeckSlot, DeckSlot];
  private activeDeckIdx: 0 | 1 = 0;

  private activeMode: MusicSituationMode = 'nature_exploration';
  private isPlaying = false;
  private enabled = false;

  // Cooldown / spacing between tracks during calm exploration so forest ambience breathes
  private pauseTimerSec = 0;
  private discoveryBoostTimer = 0;
  private lastTrackByPool: Partial<Record<PersonalMusicPoolId, string>> = {};

  // Procedural combat tension pulse state (non-overlapping single interval)
  private combatPulseAccum = 0;
  private combatStep = 0;
  private combatBlend = 0; // 0..1

  constructor() {
    this.decks = [
      { audio: this.createAudioElement(), gainNode: null, connected: false, trackId: null },
      { audio: this.createAudioElement(), gainNode: null, connected: false, trackId: null },
    ];
  }

  private createAudioElement(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'none';
    el.loop = false;
    el.crossOrigin = 'anonymous';
    return el;
  }

  public attachContext(ctx: AudioContext, musicBus: GainNode): void {
    this.ctx = ctx;
    this.musicBus = musicBus;

    for (let i = 0; i < 2; i++) {
      const deck = this.decks[i];
      if (!deck.connected) {
        try {
          const src = ctx.createMediaElementSource(deck.audio);
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(gain);
          gain.connect(musicBus);
          deck.gainNode = gain;
          deck.connected = true;
        } catch {
          // Fallback: if MediaElementSource fails, direct element volume stays 0-1
          deck.gainNode = null;
          deck.connected = false;
        }
      }
      deck.audio.onended = () => {
        if (this.activeDeckIdx === i && this.enabled) {
          this.onCurrentTrackEnded();
        }
      };
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.pauseAll();
    } else if (this.ctx && this.musicBus) {
      if (this.activeMode !== 'combat' && !this.isPlaying && this.pauseTimerSec <= 0) {
        this.startTrackForPool(this.modeToPool(this.activeMode), 2.0);
      } else {
        const active = this.decks[this.activeDeckIdx];
        if (active.trackId && active.audio.paused && this.activeMode !== 'combat') {
          void active.audio.play().catch(() => {});
          this.rampDeckGain(this.activeDeckIdx, 0.85, 1.2);
          this.isPlaying = true;
        }
      }
    }
  }

  public triggerDiscoveryAccent(durationSec = 26): void {
    this.discoveryBoostTimer = Math.max(this.discoveryBoostTimer, durationSec);
    if (this.enabled && this.activeMode !== 'combat') {
      this.setSituationMode('discretion_decouverte');
    }
  }

  public setSituationMode(nextMode: MusicSituationMode): void {
    if (this.discoveryBoostTimer > 0 && nextMode === 'nature_exploration') {
      nextMode = 'discretion_decouverte';
    }
    if (nextMode === this.activeMode) return;

    const prevMode = this.activeMode;
    this.activeMode = nextMode;
    if (!this.enabled || !this.ctx) return;

    if (nextMode === 'combat') {
      // Duck personal exploration deck softly while combat pulse takes priority
      this.rampDeckGain(0, 0.16, 1.4);
      this.rampDeckGain(1, 0.16, 1.4);
      return;
    }

    if (prevMode === 'combat') {
      const targetPool = this.modeToPool(nextMode);
      const active = this.decks[this.activeDeckIdx];
      const currentTrack = PERSONAL_MUSIC_TRACKS.find((t) => t.id === active.trackId);
      if (currentTrack && currentTrack.pool === targetPool && !active.audio.paused) {
        this.rampDeckGain(this.activeDeckIdx, 0.85, 2.2);
      } else {
        this.pauseTimerSec = 0;
        this.startTrackForPool(targetPool, 2.4);
      }
      return;
    }

    const targetPool = this.modeToPool(nextMode);
    const currentDeck = this.decks[this.activeDeckIdx];
    const currentTrack = PERSONAL_MUSIC_TRACKS.find((t) => t.id === currentDeck.trackId);
    if (!currentTrack || currentTrack.pool !== targetPool || currentDeck.audio.paused) {
      this.pauseTimerSec = 0;
      this.startTrackForPool(targetPool, 2.8);
    }
  }

  public update(dt: number, inCombat: boolean, targetPool: PersonalMusicPoolId): void {
    if (!this.enabled || !this.ctx || !this.musicBus) return;

    if (this.discoveryBoostTimer > 0) {
      this.discoveryBoostTimer = Math.max(0, this.discoveryBoostTimer - dt);
    }

    const desiredMode: MusicSituationMode = inCombat
      ? 'combat'
      : this.discoveryBoostTimer > 0
        ? 'discretion_decouverte'
        : targetPool;

    if (desiredMode !== this.activeMode) {
      this.setSituationMode(desiredMode);
    }

    // Combat procedural dark-fantasy rhythmic layer (only while combatBlend > 0.01)
    const targetCombatBlend = inCombat ? 1 : 0;
    const rate = inCombat ? 1.4 : 0.45;
    this.combatBlend += (targetCombatBlend - this.combatBlend) * Math.min(1, dt * rate);

    if (this.combatBlend > 0.03) {
      this.combatPulseAccum += dt;
      const stepPeriod = 0.34;
      if (this.combatPulseAccum >= stepPeriod) {
        this.combatPulseAccum -= stepPeriod;
        this.playCombatPulseStep(this.ctx, this.musicBus, this.combatStep, this.combatBlend);
        this.combatStep = (this.combatStep + 1) % 8;
      }
    } else {
      this.combatPulseAccum = 0;
      this.combatStep = 0;
    }

    // Inter-track natural breathing pause
    if (!inCombat && !this.isPlaying && this.pauseTimerSec > 0) {
      this.pauseTimerSec -= dt;
      if (this.pauseTimerSec <= 0) {
        this.startTrackForPool(this.modeToPool(this.activeMode), 2.5);
      }
    }
  }

  private modeToPool(mode: MusicSituationMode): PersonalMusicPoolId {
    if (mode === 'chateau_mysterieux') return 'chateau_mysterieux';
    if (mode === 'discretion_decouverte') return 'discretion_decouverte';
    return 'nature_exploration';
  }

  private pickTrackFromPool(pool: PersonalMusicPoolId): PersonalMusicTrack {
    const candidates = PERSONAL_MUSIC_TRACKS.filter((t) => t.pool === pool);
    const lastId = this.lastTrackByPool[pool];
    const filtered = candidates.length > 1 ? candidates.filter((c) => c.id !== lastId) : candidates;
    const totalWeight = filtered.reduce((acc, t) => acc + t.weight, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < filtered.length; i++) {
      r -= filtered[i].weight;
      if (r <= 0) {
        this.lastTrackByPool[pool] = filtered[i].id;
        return filtered[i];
      }
    }
    const chosen = filtered[0];
    this.lastTrackByPool[pool] = chosen.id;
    return chosen;
  }

  private startTrackForPool(pool: PersonalMusicPoolId, fadeSec: number): void {
    if (!this.ctx || !this.enabled) return;
    const track = this.pickTrackFromPool(pool);
    const nextIdx: 0 | 1 = this.activeDeckIdx === 0 ? 1 : 0;
    const prevIdx: 0 | 1 = this.activeDeckIdx;
    const nextDeck = this.decks[nextIdx];
    const prevDeck = this.decks[prevIdx];

    // Crossfade old deck out cleanly
    this.rampDeckGain(prevIdx, 0, fadeSec);
    window.setTimeout(() => {
      if (this.activeDeckIdx !== prevIdx && !prevDeck.audio.paused) {
        prevDeck.audio.pause();
      }
    }, Math.ceil(fadeSec * 1000) + 120);

    nextDeck.trackId = track.id;
    nextDeck.audio.src = track.url;
    nextDeck.audio.currentTime = 0;
    if (nextDeck.gainNode) {
      nextDeck.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      nextDeck.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    } else {
      nextDeck.audio.volume = 0.01;
    }

    this.activeDeckIdx = nextIdx;
    this.isPlaying = true;

    void nextDeck.audio
      .play()
      .then(() => {
        if (this.enabled && this.activeDeckIdx === nextIdx) {
          this.rampDeckGain(nextIdx, this.activeMode === 'combat' ? 0.16 : 0.85, fadeSec);
        }
      })
      .catch(() => {
        this.isPlaying = false;
      });
  }

  private onCurrentTrackEnded(): void {
    this.isPlaying = false;
    // Leave 6–14 seconds of pure forest/environment breathing between nature tracks
    this.pauseTimerSec =
      this.activeMode === 'nature_exploration' ? 6 + Math.random() * 8 : 3 + Math.random() * 4;
  }

  private rampDeckGain(idx: 0 | 1, target: number, durationSec: number): void {
    const deck = this.decks[idx];
    if (deck.gainNode && this.ctx) {
      const now = this.ctx.currentTime;
      deck.gainNode.gain.cancelScheduledValues(now);
      deck.gainNode.gain.setTargetAtTime(Math.max(0.0001, target), now, Math.max(0.08, durationSec * 0.35));
    } else {
      deck.audio.volume = Math.max(0, Math.min(1, target));
    }
  }

  private pauseAll(): void {
    this.isPlaying = false;
    for (let i = 0; i < 2; i++) {
      const deck = this.decks[i];
      if (deck.gainNode && this.ctx) {
        const now = this.ctx.currentTime;
        deck.gainNode.gain.cancelScheduledValues(now);
        deck.gainNode.gain.setTargetAtTime(0.0001, now, 0.15);
      }
      deck.audio.pause();
    }
  }

  private playCombatPulseStep(ctx: AudioContext, bus: GainNode, step: number, blend: number): void {
    const now = ctx.currentTime;
    const isDownbeat = step === 0 || step === 4;
    const isAccent = step === 2 || step === 6 || step === 7;

    if (isDownbeat || isAccent) {
      // Deep war-drum pulse
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isDownbeat ? 92 : 76, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
      const gain = ctx.createGain();
      const peak = (isDownbeat ? 0.18 : 0.1) * blend;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.24);
    }

    // Dark minor string/brass ostinato (D minor / Phrygian)
    const pattern = [146.83, 155.56, 174.61, 155.56, 146.83, 130.81, 138.59, 146.83];
    if (step % 2 === 0 || step === 7) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pattern[step], now);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 390 + blend * 220;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.045 * blend, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.33);
    }
  }

  public getCurrentTrackInfo(): { title: string; pool: PersonalMusicPoolId } | null {
    const deck = this.decks[this.activeDeckIdx];
    if (!deck.trackId || deck.audio.paused) return null;
    const found = PERSONAL_MUSIC_TRACKS.find((t) => t.id === deck.trackId);
    return found ? { title: found.title, pool: found.pool } : null;
  }

  public dispose(): void {
    this.pauseAll();
    for (let i = 0; i < 2; i++) {
      this.decks[i].audio.src = '';
      this.decks[i].gainNode = null;
      this.decks[i].connected = false;
    }
    this.ctx = null;
    this.musicBus = null;
  }
}
