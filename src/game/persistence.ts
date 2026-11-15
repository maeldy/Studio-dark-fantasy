import { ExplorationSaveData } from '../types/exploration';
import {
  BuildableStructureId,
  GameplaySaveData,
  PlacedStructureRecord,
  QuestProgressRecord,
  StructureEnvironmentId,
} from '../types/gameplay';
import { cloneInventorySlots, createEmptyInventory, normalizeInventory } from './inventory';
import { ResourceNodeStateEntry, ThornvaleSaveState } from './types';

export const WORLD_SEED = 13379;
const STORAGE_KEY = 'thornvale_world_save_v1';
export const STASH_CAPACITY = 18;

const VALID_STRUCTURE_IDS = new Set<string>([
  'campfire',
  'workbench',
  'storage_chest',
  'watch_lantern',
  'timber_palisade',
  'field_shelter',
]);

export function createDefaultGameplaySave(): GameplaySaveData {
  return {
    equipment: {
      weapon: null,
      tool: null,
      armor: null,
      shield: null,
    },
    placedStructures: [],
    stash: createEmptyInventory(STASH_CAPACITY),
    questStates: {},
    stats: {
      craftedCount: 0,
      builtCount: 0,
      gatheredCount: 0,
      defeatedCount: 0,
    },
  };
}

export function cloneGameplaySave(raw?: GameplaySaveData): GameplaySaveData {
  if (!raw) return createDefaultGameplaySave();
  const questStates: Record<string, QuestProgressRecord> = {};
  if (raw.questStates) {
    for (const [k, v] of Object.entries(raw.questStates)) {
      if (v) {
        questStates[k] = {
          progress: Math.max(0, Math.floor(v.progress || 0)),
          completed: !!v.completed,
          claimed: !!v.claimed,
        };
      }
    }
  }
  const placedStructures: PlacedStructureRecord[] = Array.isArray(raw.placedStructures)
    ? raw.placedStructures
        .filter(
          (s) =>
            s &&
            typeof s.id === 'string' &&
            VALID_STRUCTURE_IDS.has(s.structureId) &&
            typeof s.environmentId === 'string' &&
            Number.isFinite(s.x) &&
            Number.isFinite(s.y) &&
            Number.isFinite(s.z)
        )
        .map((s) => ({
          id: s.id,
          structureId: s.structureId as BuildableStructureId,
          environmentId: s.environmentId as StructureEnvironmentId,
          x: s.x,
          y: s.y,
          z: s.z,
          rotY: Number.isFinite(s.rotY) ? s.rotY : 0,
          placedAt: typeof s.placedAt === 'number' ? s.placedAt : Date.now(),
        }))
    : [];

  return {
    equipment: {
      weapon: typeof raw.equipment?.weapon === 'string' ? raw.equipment.weapon : null,
      tool: typeof raw.equipment?.tool === 'string' ? raw.equipment.tool : null,
      armor: typeof raw.equipment?.armor === 'string' ? raw.equipment.armor : null,
      shield: typeof raw.equipment?.shield === 'string' ? raw.equipment.shield : null,
    },
    placedStructures,
    stash: normalizeInventory(raw.stash, STASH_CAPACITY).map((s) => (s ? { ...s } : null)),
    questStates,
    stats: {
      craftedCount: Math.max(0, Math.floor(raw.stats?.craftedCount ?? 0)),
      builtCount: Math.max(0, Math.floor(raw.stats?.builtCount ?? 0)),
      gatheredCount: Math.max(0, Math.floor(raw.stats?.gatheredCount ?? 0)),
      defeatedCount: Math.max(0, Math.floor(raw.stats?.defeatedCount ?? 0)),
    },
  };
}

function sanitizeBoolRecord(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true && typeof k === 'string') out[k] = true;
  }
  return out;
}

export function createDefaultExplorationSave(): ExplorationSaveData {
  return {
    timeOfDay: 13.25,
    activatedMechanisms: {},
    openedChests: {},
    discoveredSecrets: {},
    unlockedRecipes: {},
    readLoreIds: {},
    journalEntries: {},
    completedLocationEvents: {},
  };
}

export function cloneExplorationSave(raw?: ExplorationSaveData): ExplorationSaveData {
  if (!raw) return createDefaultExplorationSave();
  const rawTime = typeof raw.timeOfDay === 'number' && Number.isFinite(raw.timeOfDay)
    ? ((raw.timeOfDay % 24) + 24) % 24
    : 13.25;
  return {
    timeOfDay: rawTime,
    activatedMechanisms: sanitizeBoolRecord(raw.activatedMechanisms),
    openedChests: sanitizeBoolRecord(raw.openedChests),
    discoveredSecrets: sanitizeBoolRecord(raw.discoveredSecrets),
    unlockedRecipes: sanitizeBoolRecord(raw.unlockedRecipes),
    readLoreIds: sanitizeBoolRecord(raw.readLoreIds),
    journalEntries: sanitizeBoolRecord(raw.journalEntries),
    completedLocationEvents: sanitizeBoolRecord(raw.completedLocationEvents),
  };
}

export interface DiscoverableCatalogEntry {
  id: string;
  name: string;
  category: 'landmark' | 'dwelling' | 'cave' | 'dungeon';
}

export const DISCOVERABLE_CATALOG: DiscoverableCatalogEntry[] = [
  { id: 'clearing', name: 'The Moss Clearing', category: 'landmark' },
  { id: 'bog', name: 'Mire of Sunken Roots', category: 'landmark' },
  { id: 'overlook', name: 'Standing Stones Overlook', category: 'landmark' },
  { id: 'bridge', name: 'Blackwater Bridge', category: 'landmark' },
  { id: 'cabin', name: 'Hollowbark Homestead', category: 'dwelling' },
  { id: 'cottage', name: 'Elderwood Cottage', category: 'dwelling' },
  { id: 'tower', name: 'Greywatch Tower', category: 'landmark' },
  { id: 'ruins', name: 'Mossy Bastion Ruins', category: 'landmark' },
  { id: 'whisper', name: 'Sanctum of Whispering Roots', category: 'landmark' },
  { id: 'crags', name: 'Cragstone Cavern', category: 'cave' },
  { id: 'weeping_cave', name: 'Weeping Hollow Grotto', category: 'cave' },
  { id: 'barrow_cave', name: 'Sunken Barrow Cavern', category: 'cave' },
  { id: 'pond', name: 'Silvermire Pond', category: 'landmark' },
  { id: 'citadel_gate', name: 'Sunken Citadel Vault', category: 'dungeon' },
  { id: 'dungeon_catacombs', name: 'Underbastion Catacombs', category: 'dungeon' },
  // Outer Expanded Regions (Prompt 4)
  { id: 'deepwood_north', name: 'Northern Deepwood', category: 'landmark' },
  { id: 'fen_north', name: 'Whispering Fen Tarn', category: 'landmark' },
  { id: 'silverwind_waterfall', name: 'Silverwind Cascade', category: 'landmark' },
  { id: 'highland_crags', name: 'Highland Watch-Ruin', category: 'landmark' },
  { id: 'thornwood_glades', name: 'Thornwood Glades', category: 'landmark' },
  { id: 'abandoned_waystation', name: 'Old Timber Waystation', category: 'landmark' },
  { id: 'stonefall_valley', name: 'Stonefall Stone Circle', category: 'landmark' },
  { id: 'western_moor', name: 'Western Moorland Tarn', category: 'landmark' },
];

export const TOTAL_DISCOVERABLE_PLACES = DISCOVERABLE_CATALOG.length;

export function createInitialSaveState(worldSeed = WORLD_SEED): ThornvaleSaveState {
  return {
    version: 1,
    worldSeed,
    discoveredIds: ['clearing'],
    openedDoors: {},
    litBraziers: {},
    collectedRelics: {},
    defeatedMonsters: {},
    metNpcs: {},
    inventory: createEmptyInventory(),
    resourceStates: {},
    collectedFoundItems: {},
    gameplay: createDefaultGameplaySave(),
    exploration: createDefaultExplorationSave(),
  };
}

export function cloneSaveState(state: ThornvaleSaveState): ThornvaleSaveState {
  const clonedResources: Record<string, ResourceNodeStateEntry> = {};
  if (state.resourceStates) {
    for (const [k, v] of Object.entries(state.resourceStates)) {
      if (v && typeof v.depletedAt === 'number') {
        clonedResources[k] = { depletedAt: v.depletedAt };
      }
    }
  }
  return {
    version: state.version,
    worldSeed: state.worldSeed,
    discoveredIds: [...state.discoveredIds],
    openedDoors: { ...state.openedDoors },
    litBraziers: { ...state.litBraziers },
    collectedRelics: { ...state.collectedRelics },
    defeatedMonsters: state.defeatedMonsters ? { ...state.defeatedMonsters } : {},
    metNpcs: state.metNpcs ? { ...state.metNpcs } : {},
    inventory: cloneInventorySlots(state.inventory),
    resourceStates: clonedResources,
    collectedFoundItems: state.collectedFoundItems ? { ...state.collectedFoundItems } : {},
    gameplay: cloneGameplaySave(state.gameplay),
    exploration: cloneExplorationSave(state.exploration),
  };
}

export function loadWorldSave(worldSeed = WORLD_SEED): ThornvaleSaveState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialSaveState(worldSeed);
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSaveState(worldSeed);
    const parsed = JSON.parse(raw) as Partial<ThornvaleSaveState>;
    if (parsed.version !== 1 || parsed.worldSeed !== worldSeed) {
      return createInitialSaveState(worldSeed);
    }
    const sanitizedResources: Record<string, ResourceNodeStateEntry> = {};
    if (parsed.resourceStates && typeof parsed.resourceStates === 'object') {
      for (const [k, v] of Object.entries(parsed.resourceStates)) {
        if (v && typeof v.depletedAt === 'number' && Number.isFinite(v.depletedAt)) {
          sanitizedResources[k] = { depletedAt: v.depletedAt };
        }
      }
    }
    return {
      version: 1,
      worldSeed,
      discoveredIds: Array.isArray(parsed.discoveredIds)
        ? Array.from(new Set(parsed.discoveredIds))
        : ['clearing'],
      openedDoors: parsed.openedDoors && typeof parsed.openedDoors === 'object' ? parsed.openedDoors : {},
      litBraziers: parsed.litBraziers && typeof parsed.litBraziers === 'object' ? parsed.litBraziers : {},
      collectedRelics:
        parsed.collectedRelics && typeof parsed.collectedRelics === 'object' ? parsed.collectedRelics : {},
      defeatedMonsters:
        parsed.defeatedMonsters && typeof parsed.defeatedMonsters === 'object'
          ? parsed.defeatedMonsters
          : {},
      metNpcs: parsed.metNpcs && typeof parsed.metNpcs === 'object' ? parsed.metNpcs : {},
      inventory: normalizeInventory(parsed.inventory),
      resourceStates: sanitizedResources,
      collectedFoundItems:
        parsed.collectedFoundItems && typeof parsed.collectedFoundItems === 'object'
          ? parsed.collectedFoundItems
          : {},
      gameplay: cloneGameplaySave(parsed.gameplay),
      exploration: cloneExplorationSave(parsed.exploration),
    };
  } catch {
    return createInitialSaveState(worldSeed);
  }
}

export function persistWorldSave(state: ThornvaleSaveState): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private-mode restriction errors
  }
}

export function clearWorldSave(worldSeed = WORLD_SEED): ThornvaleSaveState {
  const fresh = createInitialSaveState(worldSeed);
  persistWorldSave(fresh);
  return fresh;
}
