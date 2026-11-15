export type AudioFolderCategory =
  | 'musiques'
  | 'ambiances'
  | 'nature_animaux'
  | 'deplacements'
  | 'eau_meteo'
  | 'creatures'
  | 'dialogues'
  | 'armes_combats'
  | 'interactions'
  | 'architecture_environnements';

export type PersonalMusicPoolId =
  | 'nature_exploration'
  | 'chateau_mysterieux'
  | 'discretion_decouverte';

export interface PersonalMusicTrack {
  id: string;
  title: string;
  pool: PersonalMusicPoolId;
  originalArchivePath: string;
  url: string;
  durationSec: number;
  format: 'm4a';
  codec: 'aac';
  sampleRate: 44100;
  channels: 2;
  /** Relative selection weight inside its pool */
  weight: number;
  /** Gameplay contexts where this track fits best */
  contexts: string[];
}

export const PERSONAL_MUSIC_TRACKS: PersonalMusicTrack[] = [
  // --- Dossier 1 : marche en nature et the général (6 pistes dans l'archive) ---
  {
    id: 'nat_a_walk_along_the_gates',
    title: 'A Walk Along the Gates',
    pool: 'nature_exploration',
    originalArchivePath: 'son pour thornvale/marche en nature et the général/A Walk Along the Gates.m4a',
    url: '/audio/musiques/nature_exploration/a_walk_along_the_gates.m4a',
    durationSec: 239.14,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.15,
    contexts: ['overworld', 'clearing', 'deepwood', 'glade', 'path'],
  },
  {
    id: 'nat_el_bosque_de_los_suenos',
    title: 'El bosque de los sueños',
    pool: 'nature_exploration',
    originalArchivePath: 'son pour thornvale/marche en nature et the général/El bosque de los sueños.m4a',
    url: '/audio/musiques/nature_exploration/el_bosque_de_los_suenos.m4a',
    durationSec: 178.03,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.15,
    contexts: ['overworld', 'deepwood', 'riverbank', 'glade'],
  },
  {
    id: 'nat_outward_and_inward',
    title: 'Outward and Inward',
    pool: 'nature_exploration',
    originalArchivePath: 'son pour thornvale/marche en nature et the général/Outward and Inward.m4a',
    url: '/audio/musiques/nature_exploration/outward_and_inward.m4a',
    durationSec: 303.59,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.1,
    contexts: ['overworld', 'clearing', 'deepwood', 'rocky'],
  },
  {
    id: 'nat_the_beyond',
    title: 'The Beyond',
    pool: 'nature_exploration',
    originalArchivePath: 'son pour thornvale/marche en nature et the général/The Beyond.m4a',
    url: '/audio/musiques/nature_exploration/the_beyond.m4a',
    durationSec: 331.0,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.0,
    contexts: ['overworld', 'wetland', 'rocky', 'night'],
  },
  {
    id: 'nat_my_dark_fantasy_dream',
    title: 'My Dark Fantasy Dream',
    pool: 'nature_exploration',
    originalArchivePath: 'son pour thornvale/marche en nature et the général/rexlity  my dark fantasy dream.m4a',
    url: '/audio/musiques/nature_exploration/rexlity_my_dark_fantasy_dream.m4a',
    durationSec: 84.4,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.0,
    contexts: ['overworld', 'dusk', 'night', 'deepwood'],
  },
  {
    id: 'nat_hide_cs01',
    title: 'Hide (CS01 Version)',
    pool: 'nature_exploration',
    originalArchivePath:
      'son pour thornvale/marche en nature et the général/Dorian Concept  Hide (CS01 Version) (Official Video).m4a',
    url: '/audio/musiques/nature_exploration/dorian_concept_hide.m4a',
    durationSec: 182.14,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 0.9,
    contexts: ['overworld', 'clearing', 'dawn', 'glade'],
  },

  // --- Dossier 2 : château místerieux (2 pistes) ---
  {
    id: 'cas_a_warning_before_reading',
    title: 'A Warning Before Reading',
    pool: 'chateau_mysterieux',
    originalArchivePath: 'son pour thornvale/château místerieux/A Warning Before Reading.m4a',
    url: '/audio/musiques/chateau_mysterieux/a_warning_before_reading.m4a',
    durationSec: 107.35,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.0,
    contexts: ['tower', 'tower_interior', 'ruins', 'gate', 'citadel_gate', 'dungeon_vault'],
  },
  {
    id: 'cas_mysteries_of_an_ancient_church',
    title: 'Mysteries of an Ancient Church',
    pool: 'chateau_mysterieux',
    originalArchivePath: 'son pour thornvale/château místerieux/Mysteries of an Ancient Church.m4a',
    url: '/audio/musiques/chateau_mysterieux/mysteries_of_an_ancient_church.m4a',
    durationSec: 312.54,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.15,
    contexts: ['shrine_interior', 'whisper', 'dungeon_catacombs', 'dungeon_vault', 'ruins', 'tower'],
  },

  // --- Dossier 3 : missions de découverte ou de discrétion (1 piste) ---
  {
    id: 'dis_fimnur_silent_halls',
    title: 'Silent Halls (Dungeon Synth)',
    pool: 'discretion_decouverte',
    originalArchivePath:
      'son pour thornvale/missions de découverte ou de discrétion/Fimnur  Silent Halls (Dungeon Synth).m4a',
    url: '/audio/musiques/discretion_decouverte/fimnur_silent_halls.m4a',
    durationSec: 218.13,
    format: 'm4a',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    weight: 1.0,
    contexts: ['stealth', 'discovery', 'cave_cragstone', 'cave_weeping', 'cave_ancient', 'secret'],
  },
];

export type SurfaceKind =
  | 'grass'
  | 'dirt_path'
  | 'leaves'
  | 'wood'
  | 'stone'
  | 'gravel'
  | 'mud'
  | 'water_shallow'
  | 'water_deep'
  | 'snow'
  | 'cave'
  | 'dungeon';

export type ThornvaleAudioBiomeId =
  | 'foret_ancienne'
  | 'foret_sombre'
  | 'plaines'
  | 'marecages'
  | 'montagnes'
  | 'falaises'
  | 'rivieres_lacs'
  | 'cascades'
  | 'villages'
  | 'chateaux'
  | 'ruines'
  | 'sanctuaires'
  | 'grottes'
  | 'donjons'
  | 'forets_enneigees'
  | 'deserts'
  | 'jungles'
  | 'plages'
  | 'regions_souterraines'
  | 'regions_maudites';

export interface BiomeAudioProfile {
  id: ThornvaleAudioBiomeId;
  label: string;
  presentInCurrentMap: boolean;
  musicPool: PersonalMusicPoolId;
  windLevel: number;
  windCenterHz: number;
  /** 0 = open air, 1 = heavily enclosed interior */
  exteriorAttenuation: number;
  /** Delay reverb send amount (0..0.65) */
  echoAmount: number;
  echoTimeSec: number;
  defaultSurface: SurfaceKind;
  natureActivity: number;
  waterPresence: number;
  frogAndInsectLevel: number;
  rockfallRate: number;
  creakRate: number;
  dripRate: number;
  /** Drop-in URLs for future custom ambient loops */
  customAmbientUrls: string[];
}

export const BIOME_AUDIO_PROFILES: Record<ThornvaleAudioBiomeId, BiomeAudioProfile> = {
  foret_ancienne: {
    id: 'foret_ancienne',
    label: 'Forêts anciennes',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.42,
    windCenterHz: 330,
    exteriorAttenuation: 0.0,
    echoAmount: 0.08,
    echoTimeSec: 0.14,
    defaultSurface: 'leaves',
    natureActivity: 1.0,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.25,
    rockfallRate: 0.0,
    creakRate: 0.35,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  foret_sombre: {
    id: 'foret_sombre',
    label: 'Forêts sombres',
    presentInCurrentMap: false,
    musicPool: 'nature_exploration',
    windLevel: 0.48,
    windCenterHz: 240,
    exteriorAttenuation: 0.0,
    echoAmount: 0.14,
    echoTimeSec: 0.18,
    defaultSurface: 'leaves',
    natureActivity: 0.55,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.2,
    rockfallRate: 0.0,
    creakRate: 0.5,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  plaines: {
    id: 'plaines',
    label: 'Plaines',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.36,
    windCenterHz: 390,
    exteriorAttenuation: 0.0,
    echoAmount: 0.04,
    echoTimeSec: 0.1,
    defaultSurface: 'grass',
    natureActivity: 0.9,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.2,
    rockfallRate: 0.0,
    creakRate: 0.05,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  marecages: {
    id: 'marecages',
    label: 'Marécages',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.26,
    windCenterHz: 205,
    exteriorAttenuation: 0.0,
    echoAmount: 0.14,
    echoTimeSec: 0.16,
    defaultSurface: 'mud',
    natureActivity: 0.45,
    waterPresence: 0.45,
    frogAndInsectLevel: 1.0,
    rockfallRate: 0.0,
    creakRate: 0.15,
    dripRate: 0.12,
    customAmbientUrls: [],
  },
  montagnes: {
    id: 'montagnes',
    label: 'Montagnes',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.88,
    windCenterHz: 520,
    exteriorAttenuation: 0.0,
    echoAmount: 0.32,
    echoTimeSec: 0.28,
    defaultSurface: 'gravel',
    natureActivity: 0.25,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.85,
    creakRate: 0.0,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  falaises: {
    id: 'falaises',
    label: 'Falaises',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.95,
    windCenterHz: 580,
    exteriorAttenuation: 0.0,
    echoAmount: 0.38,
    echoTimeSec: 0.34,
    defaultSurface: 'gravel',
    natureActivity: 0.2,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 1.0,
    creakRate: 0.0,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  rivieres_lacs: {
    id: 'rivieres_lacs',
    label: 'Rivières et lacs',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.32,
    windCenterHz: 340,
    exteriorAttenuation: 0.0,
    echoAmount: 0.1,
    echoTimeSec: 0.15,
    defaultSurface: 'gravel',
    natureActivity: 0.8,
    waterPresence: 0.9,
    frogAndInsectLevel: 0.55,
    rockfallRate: 0.0,
    creakRate: 0.1,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  cascades: {
    id: 'cascades',
    label: 'Cascades',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.55,
    windCenterHz: 460,
    exteriorAttenuation: 0.0,
    echoAmount: 0.24,
    echoTimeSec: 0.24,
    defaultSurface: 'gravel',
    natureActivity: 0.4,
    waterPresence: 1.0,
    frogAndInsectLevel: 0.2,
    rockfallRate: 0.25,
    creakRate: 0.0,
    dripRate: 0.25,
    customAmbientUrls: [],
  },
  villages: {
    id: 'villages',
    label: 'Villages & Habitations',
    presentInCurrentMap: true,
    musicPool: 'nature_exploration',
    windLevel: 0.14,
    windCenterHz: 185,
    exteriorAttenuation: 0.72,
    echoAmount: 0.16,
    echoTimeSec: 0.08,
    defaultSurface: 'wood',
    natureActivity: 0.18,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.05,
    rockfallRate: 0.0,
    creakRate: 0.85,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  chateaux: {
    id: 'chateaux',
    label: 'Châteaux',
    presentInCurrentMap: true,
    musicPool: 'chateau_mysterieux',
    windLevel: 0.34,
    windCenterHz: 260,
    exteriorAttenuation: 0.65,
    echoAmount: 0.48,
    echoTimeSec: 0.24,
    defaultSurface: 'stone',
    natureActivity: 0.2,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.15,
    creakRate: 0.9,
    dripRate: 0.2,
    customAmbientUrls: [],
  },
  ruines: {
    id: 'ruines',
    label: 'Ruines',
    presentInCurrentMap: true,
    musicPool: 'chateau_mysterieux',
    windLevel: 0.52,
    windCenterHz: 310,
    exteriorAttenuation: 0.18,
    echoAmount: 0.26,
    echoTimeSec: 0.2,
    defaultSurface: 'stone',
    natureActivity: 0.45,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.15,
    rockfallRate: 0.35,
    creakRate: 0.4,
    dripRate: 0.08,
    customAmbientUrls: [],
  },
  sanctuaires: {
    id: 'sanctuaires',
    label: 'Sanctuaires',
    presentInCurrentMap: true,
    musicPool: 'chateau_mysterieux',
    windLevel: 0.22,
    windCenterHz: 210,
    exteriorAttenuation: 0.55,
    echoAmount: 0.44,
    echoTimeSec: 0.26,
    defaultSurface: 'stone',
    natureActivity: 0.25,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.05,
    creakRate: 0.25,
    dripRate: 0.25,
    customAmbientUrls: [],
  },
  grottes: {
    id: 'grottes',
    label: 'Grottes',
    presentInCurrentMap: true,
    musicPool: 'discretion_decouverte',
    windLevel: 0.22,
    windCenterHz: 150,
    exteriorAttenuation: 0.94,
    echoAmount: 0.52,
    echoTimeSec: 0.29,
    defaultSurface: 'cave',
    natureActivity: 0.0,
    waterPresence: 0.1,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.48,
    creakRate: 0.12,
    dripRate: 1.0,
    customAmbientUrls: [],
  },
  donjons: {
    id: 'donjons',
    label: 'Donjons',
    presentInCurrentMap: true,
    musicPool: 'chateau_mysterieux',
    windLevel: 0.24,
    windCenterHz: 165,
    exteriorAttenuation: 0.95,
    echoAmount: 0.58,
    echoTimeSec: 0.33,
    defaultSurface: 'dungeon',
    natureActivity: 0.0,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.28,
    creakRate: 0.72,
    dripRate: 0.65,
    customAmbientUrls: [],
  },
  forets_enneigees: {
    id: 'forets_enneigees',
    label: 'Forêts enneigées',
    presentInCurrentMap: false,
    musicPool: 'nature_exploration',
    windLevel: 0.62,
    windCenterHz: 420,
    exteriorAttenuation: 0.0,
    echoAmount: 0.06,
    echoTimeSec: 0.12,
    defaultSurface: 'snow',
    natureActivity: 0.2,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.0,
    creakRate: 0.2,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  deserts: {
    id: 'deserts',
    label: 'Déserts',
    presentInCurrentMap: false,
    musicPool: 'nature_exploration',
    windLevel: 0.75,
    windCenterHz: 480,
    exteriorAttenuation: 0.0,
    echoAmount: 0.15,
    echoTimeSec: 0.22,
    defaultSurface: 'gravel',
    natureActivity: 0.08,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.15,
    rockfallRate: 0.1,
    creakRate: 0.0,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  jungles: {
    id: 'jungles',
    label: 'Jungles',
    presentInCurrentMap: false,
    musicPool: 'nature_exploration',
    windLevel: 0.25,
    windCenterHz: 290,
    exteriorAttenuation: 0.0,
    echoAmount: 0.12,
    echoTimeSec: 0.14,
    defaultSurface: 'leaves',
    natureActivity: 1.0,
    waterPresence: 0.3,
    frogAndInsectLevel: 0.95,
    rockfallRate: 0.0,
    creakRate: 0.35,
    dripRate: 0.45,
    customAmbientUrls: [],
  },
  plages: {
    id: 'plages',
    label: 'Plages',
    presentInCurrentMap: false,
    musicPool: 'nature_exploration',
    windLevel: 0.66,
    windCenterHz: 440,
    exteriorAttenuation: 0.0,
    echoAmount: 0.06,
    echoTimeSec: 0.12,
    defaultSurface: 'gravel',
    natureActivity: 0.4,
    waterPresence: 0.85,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.0,
    creakRate: 0.0,
    dripRate: 0.0,
    customAmbientUrls: [],
  },
  regions_souterraines: {
    id: 'regions_souterraines',
    label: 'Régions souterraines',
    presentInCurrentMap: false,
    musicPool: 'discretion_decouverte',
    windLevel: 0.28,
    windCenterHz: 140,
    exteriorAttenuation: 0.98,
    echoAmount: 0.6,
    echoTimeSec: 0.35,
    defaultSurface: 'cave',
    natureActivity: 0.0,
    waterPresence: 0.15,
    frogAndInsectLevel: 0.0,
    rockfallRate: 0.55,
    creakRate: 0.1,
    dripRate: 0.9,
    customAmbientUrls: [],
  },
  regions_maudites: {
    id: 'regions_maudites',
    label: 'Régions maudites ou surnaturelles',
    presentInCurrentMap: false,
    musicPool: 'chateau_mysterieux',
    windLevel: 0.5,
    windCenterHz: 215,
    exteriorAttenuation: 0.15,
    echoAmount: 0.42,
    echoTimeSec: 0.3,
    defaultSurface: 'mud',
    natureActivity: 0.1,
    waterPresence: 0.0,
    frogAndInsectLevel: 0.15,
    rockfallRate: 0.2,
    creakRate: 0.45,
    dripRate: 0.2,
    customAmbientUrls: [],
  },
};

export interface MissingAudioSlot {
  id: string;
  folder: AudioFolderCategory;
  suggestedFile: string;
  description: string;
  fallbackStatus: 'procedural_synth' | 'reused_music_pool';
}

/**
 * Explicit registry of missing external recordings so future personal files
 * can be dropped into /public/audio/<folder>/ and hooked without refactoring.
 */
export const MISSING_AUDIO_SLOTS: MissingAudioSlot[] = [
  {
    id: 'combat_music',
    folder: 'musiques',
    suggestedFile: '/audio/musiques/combat_theme.m4a',
    description: 'Dedicated dark-fantasy combat music stem (currently synthesized dynamically)',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'discovery_fanfare',
    folder: 'musiques',
    suggestedFile: '/audio/musiques/discovery_stinger.m4a',
    description: 'Dedicated rare-discovery musical swell (currently synthesized + Silent Halls)',
    fallbackStatus: 'reused_music_pool',
  },
  {
    id: 'footsteps_surfaces',
    folder: 'deplacements',
    suggestedFile: '/audio/deplacements/step_<surface>.m4a',
    description: 'Recorded footsteps per surface (grass, dirt, leaves, wood, stone, gravel, mud, water, snow, cave)',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'water_swamp_loops',
    folder: 'eau_meteo',
    suggestedFile: '/audio/eau_meteo/brook_stream_loop.m4a',
    description: 'Recorded stream, waterfall, rain, and wind loops',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'wildlife_calls',
    folder: 'nature_animaux',
    suggestedFile: '/audio/nature_animaux/<species>.m4a',
    description: 'Recorded songbirds, crows, owls, frogs, swamp insects, deer, wolves, bears',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'monster_vocals',
    folder: 'creatures',
    suggestedFile: '/audio/creatures/<monster>.m4a',
    description: 'Recorded monster roars, spider chitter, skeleton rattle, colossus breaths',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'architecture_sfx',
    folder: 'architecture_environnements',
    suggestedFile: '/audio/architecture_environnements/<prop>.m4a',
    description: 'Recorded wooden floor creaks, shutter bangs, fireplace crackle, heavy gates, cave drips',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'combat_sfx',
    folder: 'armes_combats',
    suggestedFile: '/audio/armes_combats/<weapon_event>.m4a',
    description: 'Recorded sword whooshes, steel/flesh/stone impacts, player hurt grunts',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'interaction_sfx',
    folder: 'interactions',
    suggestedFile: '/audio/interactions/<action>.m4a',
    description: 'Recorded harvesting, doors, chests, levers, mechanisms, crafting',
    fallbackStatus: 'procedural_synth',
  },
  {
    id: 'npc_voices',
    folder: 'dialogues',
    suggestedFile: '/audio/dialogues/<role>_syllables.m4a',
    description: 'Optional voice banks (currently expressive multi-formant fictional speech synth)',
    fallbackStatus: 'procedural_synth',
  },
];
