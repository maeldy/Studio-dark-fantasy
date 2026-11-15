import { NpcRole } from '../game/types';

export interface NpcVoiceProfile {
  basePitchHz: number;
  pitchSpan: number;
  syllableDurSec: number;
  gapSec: number;
  formantShift: number;
  breathiness: number;
  warmth: number;
  vibratoDepth: number;
}

const ROLE_VOICE_PROFILES: Record<NpcRole, NpcVoiceProfile> = {
  traveler: {
    basePitchHz: 155,
    pitchSpan: 34,
    syllableDurSec: 0.088,
    gapSec: 0.032,
    formantShift: 1.0,
    breathiness: 0.14,
    warmth: 0.72,
    vibratoDepth: 2.5,
  },
  merchant: {
    basePitchHz: 215,
    pitchSpan: 48,
    syllableDurSec: 0.082,
    gapSec: 0.028,
    formantShift: 1.18,
    breathiness: 0.1,
    warmth: 0.85,
    vibratoDepth: 3.5,
  },
  woodcutter: {
    basePitchHz: 122,
    pitchSpan: 24,
    syllableDurSec: 0.098,
    gapSec: 0.038,
    formantShift: 0.86,
    breathiness: 0.18,
    warmth: 0.78,
    vibratoDepth: 1.8,
  },
  hunter: {
    basePitchHz: 142,
    pitchSpan: 26,
    syllableDurSec: 0.076,
    gapSec: 0.03,
    formantShift: 0.96,
    breathiness: 0.22,
    warmth: 0.62,
    vibratoDepth: 1.5,
  },
  guard: {
    basePitchHz: 112,
    pitchSpan: 22,
    syllableDurSec: 0.095,
    gapSec: 0.034,
    formantShift: 0.84,
    breathiness: 0.1,
    warmth: 0.65,
    vibratoDepth: 1.5,
  },
  pilgrim: {
    basePitchHz: 196,
    pitchSpan: 32,
    syllableDurSec: 0.105,
    gapSec: 0.042,
    formantShift: 1.12,
    breathiness: 0.28,
    warmth: 0.8,
    vibratoDepth: 4.5,
  },
  villager: {
    basePitchHz: 232,
    pitchSpan: 44,
    syllableDurSec: 0.084,
    gapSec: 0.028,
    formantShift: 1.24,
    breathiness: 0.12,
    warmth: 0.9,
    vibratoDepth: 3.2,
  },
  adventurer: {
    basePitchHz: 186,
    pitchSpan: 38,
    syllableDurSec: 0.078,
    gapSec: 0.028,
    formantShift: 1.08,
    breathiness: 0.15,
    warmth: 0.68,
    vibratoDepth: 2.2,
  },
  keeper: {
    basePitchHz: 104,
    pitchSpan: 20,
    syllableDurSec: 0.112,
    gapSec: 0.046,
    formantShift: 0.8,
    breathiness: 0.26,
    warmth: 0.86,
    vibratoDepth: 3.0,
  },
  hermit: {
    basePitchHz: 118,
    pitchSpan: 28,
    syllableDurSec: 0.108,
    gapSec: 0.048,
    formantShift: 0.88,
    breathiness: 0.32,
    warmth: 0.56,
    vibratoDepth: 3.4,
  },
};

// Natural pseudo-vowel formant pairs [F1, F2] in Hz (avoiding repetitive "bla-bla")
const VOWEL_FORMANTS: readonly [number, number][] = [
  [660, 1180], // a
  [480, 1780], // e
  [330, 2100], // i
  [460, 860],  // o
  [340, 740],  // u
  [560, 1460], // schwa/eh
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class FictionalVoiceSynth {
  private activeNodes: AudioNode[] = [];
  private activeTimers: number[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  public stop(): void {
    for (let i = 0; i < this.activeTimers.length; i++) {
      window.clearTimeout(this.activeTimers[i]);
    }
    this.activeTimers.length = 0;

    for (let i = 0; i < this.activeNodes.length; i++) {
      const node = this.activeNodes[i];
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // Node already stopped/disconnected
      }
    }
    this.activeNodes.length = 0;
  }

  private ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  /**
   * Speaks a short, expressive sequence of non-verbal syllables matched to line length,
   * punctuation (?, !), and the NPC's vocal personality.
   */
  public speakLine(
    ctx: AudioContext,
    bus: GainNode,
    npcId: string,
    role: NpcRole,
    text: string
  ): void {
    this.stop();

    const profile = ROLE_VOICE_PROFILES[role] ?? ROLE_VOICE_PROFILES.traveler;
    const trimmed = text.trim();
    if (!trimmed) return;

    const isQuestion = trimmed.endsWith('?');
    const isUrgent = trimmed.includes('!');
    const words = trimmed.split(/\s+/).filter(Boolean);
    const targetSyllables = Math.max(3, Math.min(11, Math.round(words.length * 0.62) + 2));

    let seed = hashString(`${npcId}:${trimmed.slice(0, 48)}`);
    const nextRand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const now = ctx.currentTime + 0.015;
    let cursor = now;
    const speedMult = isUrgent ? 0.84 : 1.0;

    for (let i = 0; i < targetSyllables; i++) {
      const progress = i / Math.max(1, targetSyllables - 1);
      const r1 = nextRand();
      const r2 = nextRand();
      const r3 = nextRand();

      const dur = profile.syllableDurSec * (0.76 + r1 * 0.52) * speedMult;
      const vowelA = VOWEL_FORMANTS[Math.floor(r2 * VOWEL_FORMANTS.length)];
      const vowelB = VOWEL_FORMANTS[Math.floor(r3 * VOWEL_FORMANTS.length)];

      // Natural phrase pitch contour (gentle rise at start, fall at end unless question)
      let contour = Math.sin(progress * Math.PI) * 0.35 - progress * 0.25;
      if (isQuestion && progress > 0.65) {
        contour += (progress - 0.65) * 1.45;
      } else if (isUrgent) {
        contour += 0.22;
      }

      const f0Start =
        profile.basePitchHz +
        contour * profile.pitchSpan +
        (r1 - 0.5) * profile.pitchSpan * 0.55;
      const f0End =
        f0Start * (isQuestion && i === targetSyllables - 1 ? 1.24 : 0.92 + r2 * 0.14);

      // Glottal oscillator (warm saw/triangle blend via lowpass)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(Math.max(65, f0Start), cursor);
      osc.frequency.linearRampToValueAtTime(Math.max(65, f0End), cursor + dur);

      const subOsc = ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(Math.max(65, f0Start), cursor);
      subOsc.frequency.linearRampToValueAtTime(Math.max(65, f0End), cursor + dur);

      const subGain = ctx.createGain();
      subGain.gain.value = 0.45 * profile.warmth;

      // Formant 1 & Formant 2 filters in parallel
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 4.2;
      f1.frequency.setValueAtTime(vowelA[0] * profile.formantShift, cursor);
      f1.frequency.linearRampToValueAtTime(vowelB[0] * profile.formantShift, cursor + dur);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.value = 5.5;
      f2.frequency.setValueAtTime(vowelA[1] * profile.formantShift, cursor);
      f2.frequency.linearRampToValueAtTime(vowelB[1] * profile.formantShift, cursor + dur);

      const f2Gain = ctx.createGain();
      f2Gain.gain.value = 0.42;

      const syllableEnv = ctx.createGain();
      const peakGain = (isUrgent ? 0.2 : 0.16) * (0.85 + r2 * 0.28);
      syllableEnv.gain.setValueAtTime(0.0001, cursor);
      syllableEnv.gain.linearRampToValueAtTime(peakGain, cursor + Math.min(0.022, dur * 0.28));
      syllableEnv.gain.setValueAtTime(peakGain * 0.86, cursor + dur * 0.65);
      syllableEnv.gain.exponentialRampToValueAtTime(0.0001, cursor + dur);

      osc.connect(f1);
      osc.connect(f2);
      subOsc.connect(subGain);
      subGain.connect(f1);

      f1.connect(syllableEnv);
      f2.connect(f2Gain);
      f2Gain.connect(syllableEnv);
      syllableEnv.connect(bus);

      osc.start(cursor);
      osc.stop(cursor + dur + 0.015);
      subOsc.start(cursor);
      subOsc.stop(cursor + dur + 0.015);
      this.activeNodes.push(osc, subOsc, syllableEnv);

      // Subtle consonant aspiration burst at start of alternating syllables
      if (i === 0 || r3 > 0.48) {
        const consBuf = this.ensureNoiseBuffer(ctx);
        const consSrc = ctx.createBufferSource();
        consSrc.buffer = consBuf;
        const consFilt = ctx.createBiquadFilter();
        consFilt.type = 'bandpass';
        consFilt.frequency.value = (1500 + r1 * 1800) * profile.formantShift;
        consFilt.Q.value = 2.2;
        const consGain = ctx.createGain();
        const consAmp = 0.025 + profile.breathiness * 0.07;
        consGain.gain.setValueAtTime(0.0001, cursor);
        consGain.gain.linearRampToValueAtTime(consAmp, cursor + 0.008);
        consGain.gain.exponentialRampToValueAtTime(0.0001, cursor + 0.032);
        consSrc.connect(consFilt);
        consFilt.connect(consGain);
        consGain.connect(bus);
        consSrc.start(cursor, r2 * 0.25, 0.035);
        this.activeNodes.push(consSrc, consGain);
      }

      // Micro-pause like phrasing comma in longer lines
      const phrasePause =
        targetSyllables >= 6 && i === Math.floor(targetSyllables * 0.5)
          ? profile.gapSec * 2.8
          : profile.gapSec * (0.65 + r3 * 0.85);
      cursor += dur + phrasePause * speedMult;
    }

    const totalMs = Math.ceil((cursor - now + 0.1) * 1000);
    const cleanupTimer = window.setTimeout(() => {
      this.activeNodes.length = 0;
    }, totalMs);
    this.activeTimers.push(cleanupTimer);
  }
}
