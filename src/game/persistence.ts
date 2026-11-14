import { ThornvaleSaveState } from './types';

export const WORLD_SEED = 13379;
const STORAGE_KEY = 'thornvale_world_save_v1';

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
