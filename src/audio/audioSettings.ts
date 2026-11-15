export type AudioVolumeChannel =
  | 'master'
  | 'music'
  | 'ambience'
  | 'sfx'
  | 'creatures'
  | 'dialogue'
  | 'weather';

export interface AudioSettingsState {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  creatures: number;
  dialogue: number;
  weather: number;
}

export const AUDIO_SETTINGS_STORAGE_KEY = 'thornvale_audio_settings_v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsState = {
  master: 0.78,
  music: 0.65,
  ambience: 0.82,
  sfx: 0.85,
  creatures: 0.82,
  dialogue: 0.88,
  weather: 0.75,
};

export const AUDIO_CHANNEL_LABELS: Record<AudioVolumeChannel, string> = {
  master: 'Master Volume',
  music: 'Music',
  ambience: 'Ambience',
  sfx: 'Sound Effects',
  creatures: 'Wildlife & Monsters',
  dialogue: 'Character Voices',
  weather: 'Weather & Wind',
};

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function loadAudioSettings(): AudioSettingsState {
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettingsState>;
    return {
      master: clamp01(parsed.master, DEFAULT_AUDIO_SETTINGS.master),
      music: clamp01(parsed.music, DEFAULT_AUDIO_SETTINGS.music),
      ambience: clamp01(parsed.ambience, DEFAULT_AUDIO_SETTINGS.ambience),
      sfx: clamp01(parsed.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
      creatures: clamp01(parsed.creatures, DEFAULT_AUDIO_SETTINGS.creatures),
      dialogue: clamp01(parsed.dialogue, DEFAULT_AUDIO_SETTINGS.dialogue),
      weather: clamp01(parsed.weather, DEFAULT_AUDIO_SETTINGS.weather),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettingsState): void {
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
