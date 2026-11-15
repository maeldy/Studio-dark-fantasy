import { InteriorId, InventorySlot, ResourceToolRequirement } from '../game/types';

export type GearSlot = 'weapon' | 'tool' | 'armor' | 'shield';

export type GearVisualKind =
  | 'flint_hatchet'
  | 'stone_pickaxe'
  | 'iron_axe'
  | 'iron_pickaxe'
  | 'hunting_spear'
  | 'thornvale_longsword'
  | 'moonstone_blade'
  | 'warden_greatsword'
  | 'sunfire_blade'
  | 'wooden_buckler'
  | 'iron_kite_shield'
  | 'ashwood_tower_shield'
  | 'hide_jerkin'
  | 'wolfskin_cloak'
  | 'lantern_bearer_mantle'
  | 'iron_brigandine';

export interface GearStats {
  slot: GearSlot;
  visualKind: GearVisualKind;
  attackBonus: number;
  defenseReduction: number; // 0..0.65 damage mitigation fraction
  warmthBonus: number; // bonus passive warmth insulation
  toolKind?: Exclude<ResourceToolRequirement, 'none'>;
  gatherBonus?: number;
}

export interface ConsumableEffect {
  healHp: number;
  restoreStamina: number;
  restoreWarmth: number;
  message: string;
}

export type CraftingStationKind = 'hand' | 'campfire' | 'workbench';

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  outputItemId: string;
  outputQuantity: number;
  station: CraftingStationKind;
  category: 'tool' | 'weapon' | 'armor' | 'supply' | 'material';
  ingredients: CraftingIngredient[];
  description: string;
  /** Optional recipe schematic ID unlocked through world exploration */
  requiredUnlockId?: string;
}

export type BuildableStructureId =
  | 'campfire'
  | 'workbench'
  | 'storage_chest'
  | 'watch_lantern'
  | 'timber_palisade'
  | 'field_shelter';

export interface BuildableStructureDef {
  id: BuildableStructureId;
  name: string;
  description: string;
  costs: CraftingIngredient[];
  footprintRadius: number;
  colliderRadius: number;
  colliderHeight: number;
  maxSlope: number;
  allowOverworld: boolean;
  allowInterior: boolean;
  providesStation?: CraftingStationKind;
  warmthRadius?: number;
  lightColor?: string;
  lightIntensity?: number;
  lightDistance?: number;
  interactionVerb: string;
}

export type StructureEnvironmentId = 'overworld' | InteriorId;

export interface PlacedStructureRecord {
  id: string;
  structureId: BuildableStructureId;
  environmentId: StructureEnvironmentId;
  x: number;
  y: number;
  z: number;
  rotY: number;
  placedAt: number;
}

export interface PlacementValidationResult {
  valid: boolean;
  reason: string;
  snappedY: number;
}

export interface PlacementPreviewState {
  active: boolean;
  structureId: BuildableStructureId | null;
  structureName: string;
  valid: boolean;
  reason: string;
  rotY: number;
}

export interface EquipmentLoadout {
  weapon: string | null;
  tool: string | null;
  armor: string | null;
  shield: string | null;
}

export interface PlayerSurvivalState {
  stamina: number;
  maxStamina: number;
  warmth: number;
  maxWarmth: number;
  nearFire: boolean;
  inShelter: boolean;
  nearbyStations: CraftingStationKind[];
}

export type QuestKind = 'gather' | 'craft' | 'build' | 'defeat' | 'discover';

export interface QuestReward {
  itemId: string;
  quantity: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  giver: string;
  description: string;
  kind: QuestKind;
  targetId?: string; // itemId, structureId, species, or 'any'
  targetCount: number;
  rewards: QuestReward[];
}

export interface QuestProgressRecord {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface GameplayStats {
  craftedCount: number;
  builtCount: number;
  gatheredCount: number;
  defeatedCount: number;
}

export interface GameplaySaveData {
  equipment: EquipmentLoadout;
  placedStructures: PlacedStructureRecord[];
  stash: (InventorySlot | null)[];
  questStates: Record<string, QuestProgressRecord>;
  stats: GameplayStats;
}

export interface NearbyStructureInfo {
  record: PlacedStructureRecord;
  def: BuildableStructureDef;
  distance: number;
}
