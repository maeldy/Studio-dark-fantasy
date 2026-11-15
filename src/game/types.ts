import * as THREE from 'three';
import type {
  ExplorationAtmosphereState,
  ExplorationSaveData,
} from '../types/exploration';
import type {
  GameplaySaveData,
  PlacementPreviewState,
  PlayerSurvivalState,
} from '../types/gameplay';

export type GraphicsQuality = 'low' | 'retro' | 'high';

export interface GraphicsSettings {
  quality: GraphicsQuality;
  vhsEffect: boolean;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  height?: number;
  minY?: number;
  maxY?: number;
  kind?: 'tree' | 'rock' | 'ruin' | 'prop';
  tag?: string;
}

export interface BoxCollider {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  minY?: number;
  maxY?: number;
  kind?: 'ruin' | 'building' | 'bridge';
  tag?: string;
}

export interface LandmarkZone {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
}

export interface LightAnchor {
  x: number;
  y: number;
  z: number;
  color: string;
  baseIntensity: number;
  distance: number;
  phase: number;
  tag?: string;
}

export type InteriorId =
  | 'cabin_interior'
  | 'cottage_interior'
  | 'tower_interior'
  | 'shrine_interior'
  | 'cave_cragstone'
  | 'cave_weeping'
  | 'cave_ancient'
  | 'dungeon_catacombs'
  | 'dungeon_vault';

export type EnvironmentAtmosphere = 'forest' | 'house' | 'cave' | 'dungeon';

export interface PortalLink {
  id: string;
  targetId: InteriorId | 'overworld';
  x: number;
  y: number;
  z: number;
  radius: number;
  label: string;
  transitionKind: 'wood' | 'stone' | 'cave';
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  spawnYaw: number;
  returnDoorId?: string;
}

export interface WalkableSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yStart: number;
  yEnd: number;
  rampAxis?: 'x' | 'z';
  stepCount?: number;
  stairDir?: 1 | -1;
}

export type DevTeleportCategory =
  | 'Overworld Landmarks'
  | 'Outer Regions'
  | 'Dwellings'
  | 'Towers & Fortifications'
  | 'Ruins & Sanctuaries'
  | 'Caves'
  | 'Dungeons';

export interface DevTeleportPoint {
  id: string;
  name: string;
  category: DevTeleportCategory;
  subtitle: string;
  targetEnv: 'overworld' | InteriorId;
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  zoneId?: string;
}

export interface InteriorInteractable {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  kind: 'door' | 'brazier' | 'relic' | 'secret' | 'found_item';
  label: string;
  completedLabel?: string;
  isAvailable?: () => boolean;
  onActivate: () => string | void;
}

export interface InteriorLightingConfig {
  atmosphere: EnvironmentAtmosphere;
  backgroundColor: string;
  fogColor: string;
  fogDensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  dirColor: string;
  dirIntensity: number;
  dirPosition: [number, number, number];
  exposure: number;
  lanternIntensity: number;
  lanternDistance: number;
  defaultCamDistance: number;
}

export interface InteriorInstance {
  id: InteriorId;
  name: string;
  group: THREE.Group;
  lighting: InteriorLightingConfig;
  boxColliders: BoxCollider[];
  circleColliders: CircleCollider[];
  walkableSurfaces: WalkableSurface[];
  portals: PortalLink[];
  interactables: InteriorInteractable[];
  embers: { ember: THREE.Mesh; phase: number; baseScale?: [number, number, number] }[];
  lightAnchors: LightAnchor[];
  cameraOccluders: THREE.Object3D[];
  particles?: THREE.Points;
  boundsRadius: number;
  dispose: () => void;
}

export interface InteractPrompt {
  id: string;
  label: string;
  kind:
    | 'portal'
    | 'door'
    | 'brazier'
    | 'relic'
    | 'secret'
    | 'npc'
    | 'resource'
    | 'found_item'
    | 'structure'
    | 'chest'
    | 'mechanism'
    | 'lore'
    | 'event';
}

export type ItemCategory =
  | 'natural_resource'
  | 'material'
  | 'plant'
  | 'food'
  | 'misc'
  | 'special'
  | 'weapon'
  | 'armor'
  | 'tool'
  | 'equipment'
  | 'crafted'
  | 'quest';

export type ItemIconKey =
  | 'branch'
  | 'deadwood'
  | 'log'
  | 'fiber'
  | 'liana'
  | 'root'
  | 'bark'
  | 'resin'
  | 'stone'
  | 'flint'
  | 'coal'
  | 'ore_iron'
  | 'ore_copper'
  | 'ore_tin'
  | 'mineral_amber'
  | 'mineral_moon'
  | 'mushroom'
  | 'glowcap'
  | 'berries'
  | 'herb'
  | 'flower'
  | 'medicinal'
  | 'seeds'
  | 'edible_root'
  | 'feather'
  | 'bone'
  | 'hide'
  | 'fur'
  | 'fang'
  | 'coin'
  | 'pottery'
  | 'book'
  | 'relic'
  | 'seal'
  | 'compass'
  | 'axe'
  | 'pickaxe'
  | 'spear'
  | 'sword'
  | 'shield'
  | 'armor'
  | 'cloak'
  | 'poultice'
  | 'ration'
  | 'broth'
  | 'ingot'
  | 'cordage'
  | 'key'
  | 'scroll'
  | 'map';

export type ResourceToolRequirement = 'none' | 'axe' | 'pickaxe';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  maxStack: number;
  icon: ItemIconKey;
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  isUnique?: boolean;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface ResourceNodeStateEntry {
  depletedAt: number;
}

export interface ThornvaleSaveState {
  version: number;
  worldSeed: number;
  discoveredIds: string[];
  openedDoors: Record<string, boolean>;
  litBraziers: Record<string, boolean>;
  collectedRelics: Record<string, boolean>;
  defeatedMonsters?: Record<string, number>;
  metNpcs?: Record<string, boolean>;
  inventory: (InventorySlot | null)[];
  resourceStates: Record<string, ResourceNodeStateEntry>;
  collectedFoundItems: Record<string, boolean>;
  gameplay?: GameplaySaveData;
  exploration?: ExplorationSaveData;
}

export type EntityCategory = 'animal' | 'creature' | 'monster' | 'npc';

export type AnimalSpecies =
  | 'stag'
  | 'doe'
  | 'roe_deer'
  | 'boar'
  | 'wolf'
  | 'bear'
  | 'rabbit'
  | 'fox'
  | 'squirrel'
  | 'badger'
  | 'hedgehog'
  | 'mouse'
  | 'crow'
  | 'rook'
  | 'owl'
  | 'barn_owl'
  | 'songbird'
  | 'eagle';

export type CreatureSpecies =
  | 'forest_spirit'
  | 'tree_sprite'
  | 'moss_dryad'
  | 'pale_stag'
  | 'stone_guardian'
  | 'moss_golem'
  | 'fog_apparition'
  | 'wisp_entity'
  | 'shadow_stalker';

export type MonsterSpecies =
  | 'dire_wolf'
  | 'thorn_fiend'
  | 'night_prowler'
  | 'animated_skeleton'
  | 'ruin_wraith'
  | 'hollow_husk'
  | 'giant_spider'
  | 'cave_crawler'
  | 'stone_colossus'
  | 'temple_warden';

export type NpcRole =
  | 'traveler'
  | 'merchant'
  | 'hunter'
  | 'woodcutter'
  | 'hermit'
  | 'guard'
  | 'adventurer'
  | 'pilgrim'
  | 'villager'
  | 'keeper';

export type AnyEntitySpecies =
  | AnimalSpecies
  | CreatureSpecies
  | MonsterSpecies
  | NpcRole;

export type MonsterAiState =
  | 'rest'
  | 'patrol'
  | 'detect'
  | 'alert'
  | 'chase'
  | 'attack'
  | 'disengage'
  | 'return';

export interface ActiveDialogue {
  npcId: string;
  speakerName: string;
  speakerTitle: string;
  role: NpcRole;
  lines: string[];
  lineIndex: number;
}

export interface PlayerVitals {
  hp: number;
  maxHp: number;
  inCombat: boolean;
  hurtFlash: number;
}

export interface EcosystemStats {
  activeAnimals: number;
  activeCreatures: number;
  activeMonsters: number;
  activeNpcs: number;
}

export interface TouchMoveInput {
  x: number; // -1 (left) to 1 (right)
  y: number; // -1 (up/forward) to 1 (down/back)
  magnitude: number; // 0 to 1
}

export interface EngineCallbacks {
  onZoneChange?: (zoneName: string) => void;
  onWebGLContextLost?: (lost: boolean) => void;
  onAudioStateChange?: (enabled: boolean) => void;
  onQualityChange?: (quality: GraphicsQuality) => void;
  onInteractPromptChange?: (prompt: InteractPrompt | null) => void;
  onTransitionChange?: (fading: boolean, label?: string) => void;
  onDiscovery?: (placeName: string, discoveredCount: number, totalCount: number) => void;
  onStatusMessage?: (message: string | null) => void;
  onSaveStateChange?: (state: ThornvaleSaveState) => void;
  onDialogueChange?: (dialogue: ActiveDialogue | null) => void;
  onPlayerVitalsChange?: (vitals: PlayerVitals) => void;
  onSurvivalChange?: (survival: PlayerSurvivalState) => void;
  onPlacementChange?: (placement: PlacementPreviewState) => void;
  onStashModalChange?: (open: boolean) => void;
  onRequestOpenWorkshop?: (tab?: 'craft' | 'build' | 'gear' | 'quests' | 'journal') => void;
  onDevModeChange?: (enabled: boolean) => void;
  onAtmosphereChange?: (atmosphere: ExplorationAtmosphereState) => void;
}

export interface WandererRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvisPivot: THREE.Group;
  torso: THREE.Group;
  neckPivot: THREE.Group;
  headPivot: THREE.Group;
  cape: THREE.Mesh;
  leftArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  lanternPivot: THREE.Group;
  lanternLight: THREE.PointLight;
  contactShadow: THREE.Mesh;
  drawnSwordGroup: THREE.Group;
  sheathedSwordGroup: THREE.Group;
}
