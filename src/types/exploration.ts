import type { InteriorId } from '../game/types';

export type ExplorationEnvironmentId = 'overworld' | InteriorId;

export type DayNightPhase = 'dawn' | 'day' | 'dusk' | 'night';

export type MechanismKind =
  | 'sliding_wall'
  | 'pivoting_bookcase'
  | 'movable_boulder'
  | 'rotating_masonry'
  | 'iron_lever'
  | 'multi_rune_seal';

export interface SecretMechanismDef {
  id: string;
  name: string;
  environmentId: ExplorationEnvironmentId;
  kind: MechanismKind;
  triggerPos: { x: number; y: number; z: number };
  triggerRadius: number;
  /** Physical door/slab blocked while unactivated. Omit for standalone switches wired to a master door. */
  doorPos?: { x: number; y: number; z: number };
  doorSize?: { w: number; h: number; d: number };
  doorRotY?: number;
  openOffset?: { dx: number; dy: number; dz: number; dRotY: number };
  /** Optional item key required in inventory */
  requiredKeyItemId?: string;
  /** If true, consumes/uses existing switch IDs that must all be activated first */
  requiredSwitches?: string[];
  /** Visual material hint */
  visualTone?: 'stone' | 'wood' | 'moss' | 'dungeon' | 'iron';
  activateLabel: string;
  activatedLabel: string;
  clueText: string;
  journalEntryId?: string;
  discoveryMessage?: string;
  /** Optional built-in door ID to keep synced with existing interiors */
  syncDoorId?: string;
  nocturnalGlow?: boolean;
}

export type TreasureContainerKind =
  | 'ancient_chest'
  | 'abandoned_satchel'
  | 'forgotten_crate'
  | 'hidden_cache'
  | 'hollow_stump';

export interface TreasureGrant {
  itemId: string;
  quantity: number;
}

export interface TreasureContainerDef {
  id: string;
  name: string;
  kind: TreasureContainerKind;
  environmentId: ExplorationEnvironmentId;
  x: number;
  y: number;
  z: number;
  rotY: number;
  radius: number;
  requiredKeyItemId?: string;
  requiredMechanismId?: string;
  requiresNight?: boolean;
  grants: TreasureGrant[];
  unlockRecipeIds?: string[];
  unlockJournalId?: string;
  difficultyTier: 'forest' | 'outskirt' | 'tower' | 'sanctum' | 'dungeon';
}

export type LorePropKind =
  | 'wall_inscription'
  | 'carved_monolith'
  | 'fresco_panel'
  | 'ancient_scroll'
  | 'battle_remnant'
  | 'camp_remnant'
  | 'grave_marker';

export interface LorePropDef {
  id: string;
  title: string;
  kind: LorePropKind;
  environmentId: ExplorationEnvironmentId;
  x: number;
  y: number;
  z: number;
  rotY: number;
  radius: number;
  shortSummary: string;
  journalEntryId: string;
  unlockRecipeIds?: string[];
  nocturnalHint?: boolean;
}

export interface JournalEntryDef {
  id: string;
  title: string;
  category: 'lore' | 'map_clue' | 'secret' | 'phenomenon';
  regionName: string;
  excerpt: string;
  body: string;
  secretHint?: string;
}

export type DynamicEventKind =
  | 'traveler_camp'
  | 'wandering_peddler'
  | 'recent_skirmish'
  | 'rare_spirit_stag'
  | 'nocturnal_wisp_choir'
  | 'beast_pack_trail';

export interface DynamicEventTemplate {
  kind: DynamicEventKind;
  title: string;
  promptLabel: string;
  timeFilter: 'any' | 'day' | 'dusk_night' | 'night';
  biomeFilter: ('clearing' | 'deepwood' | 'rocky' | 'wetland' | 'riverbank' | 'glade')[];
  durationSec: number;
  spawnRadiusMin: number;
  spawnRadiusMax: number;
  rewards: TreasureGrant[];
  journalEntryId?: string;
  lightColor?: string;
  lightIntensity?: number;
}

export interface DynamicEventUiSummary {
  runtimeId: string;
  kind: DynamicEventKind;
  title: string;
  x: number;
  z: number;
  remainingSec: number;
  resolved: boolean;
}

export interface ExplorationAtmosphereState {
  timeOfDay: number;
  hourLabel: string;
  phase: DayNightPhase;
  isNight: boolean;
  isDuskOrNight: boolean;
  nocturnalIntensity: number;
  cyclePaused: boolean;
  activeEventsCount: number;
}

export interface ExplorationSaveData {
  timeOfDay: number;
  activatedMechanisms: Record<string, boolean>;
  openedChests: Record<string, boolean>;
  discoveredSecrets: Record<string, boolean>;
  unlockedRecipes: Record<string, boolean>;
  readLoreIds: Record<string, boolean>;
  journalEntries: Record<string, boolean>;
  completedLocationEvents: Record<string, boolean>;
}

export interface DevExplorationSnapshot {
  timeOfDay: number;
  phase: DayNightPhase;
  cyclePaused: boolean;
  activatedMechanismsCount: number;
  totalMechanismsCount: number;
  openedChestsCount: number;
  totalChestsCount: number;
  unlockedRecipesCount: number;
  journalCount: number;
  totalJournalCount: number;
  activeEvents: DynamicEventUiSummary[];
}
