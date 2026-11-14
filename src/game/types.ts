import * as THREE from 'three';

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
}

export interface InteriorInteractable {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  kind: 'door' | 'brazier' | 'relic' | 'secret';
  label: string;
  completedLabel?: string;
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
  kind: 'portal' | 'door' | 'brazier' | 'relic' | 'secret';
}

export interface ThornvaleSaveState {
  version: number;
  worldSeed: number;
  discoveredIds: string[];
  openedDoors: Record<string, boolean>;
  litBraziers: Record<string, boolean>;
  collectedRelics: Record<string, boolean>;
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
}

export interface WandererRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headPivot: THREE.Group;
  cape: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  lanternPivot: THREE.Group;
  lanternLight: THREE.PointLight;
  contactShadow: THREE.Mesh;
}
