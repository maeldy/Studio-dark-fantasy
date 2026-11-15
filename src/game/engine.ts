import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MONSTER_LOOT_TABLE } from '../data/itemsGameplay';
import { BUILDABLE_STRUCTURES } from '../data/structures';
import { BuildingSystem, BuildActionResult } from '../systems/BuildingSystem';
import { CraftingSystem, CraftResult } from '../systems/CraftingSystem';
import {
  CombatDerivedStats,
  ConsumeResult,
  EquipmentSystem,
  EquipResult,
} from '../systems/EquipmentSystem';
import {
  createDefaultExplorationSaveData,
  evaluateExteriorAtmosphereProfile,
  ExplorationInteractResult,
  ExplorationSystem,
  ExteriorAtmosphereProfile,
} from '../systems/ExplorationSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { SurvivalSystem } from '../systems/SurvivalSystem';
import {
  DevExplorationSnapshot,
  DynamicEventKind,
  DynamicEventUiSummary,
  ExplorationAtmosphereState,
} from '../types/exploration';
import {
  BuildableStructureId,
  GearSlot,
  NearbyStructureInfo,
  PlacementPreviewState,
  PlayerSurvivalState,
  StructureEnvironmentId,
} from '../types/gameplay';
import { ForestAudioSystem } from './audio';
import { DEV_TELEPORT_POINTS } from './devLocations';
import { buildInteriorById } from './interiors';
import {
  addItemsToInventory,
  INVENTORY_CAPACITY,
  ITEM_CATALOG,
  moveOrSwapInventorySlot,
  removeInventorySlotItem,
  splitInventorySlot,
} from './inventory';
import { createWandererCharacter } from './models';
import {
  clearWorldSave,
  cloneSaveState,
  createDefaultGameplaySave,
  DISCOVERABLE_CATALOG,
  loadWorldSave,
  persistWorldSave,
  STASH_CAPACITY,
  TOTAL_DISCOVERABLE_PLACES,
  WORLD_SEED,
} from './persistence';
import { WorldResourceManager } from './resources';
import { RetroCompositePass } from './retroPass';
import {
  bridgeDeckHeightAt,
  groveDensityAt,
  LANDMARK_ZONES,
  landmarkFloorHeightAt,
  pathMaskAt,
  PLAYABLE_BOUNDS_RADIUS,
  rawTerrainSlopeAt,
  walkableHeightAt,
} from './terrain';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { EcosystemManager } from './entities/entityManager';
import {
  ActiveDialogue,
  BoxCollider,
  CircleCollider,
  DevTeleportPoint,
  EcosystemStats,
  EngineCallbacks,
  GraphicsQuality,
  InteriorId,
  InteriorInstance,
  InteractPrompt,
  InventorySlot,
  LightAnchor,
  PlayerVitals,
  PortalLink,
  ThornvaleSaveState,
  TouchMoveInput,
  WandererRig,
} from './types';
import { buildForestWorld, WorldBuildResult } from './world';

class SpatialColliderIndex {
  private readonly cellSize = 8;
  private circleCells = new Map<number, CircleCollider[]>();
  private boxCells = new Map<number, BoxCollider[]>();
  private seenBoxSet = new Set<BoxCollider>();

  constructor(circles: CircleCollider[], boxes: BoxCollider[]) {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const span = Math.ceil((c.radius + 1) / this.cellSize);
      const cx0 = Math.floor(c.x / this.cellSize);
      const cz0 = Math.floor(c.z / this.cellSize);
      for (let ox = -span; ox <= span; ox++) {
        for (let oz = -span; oz <= span; oz++) {
          const k = this.key(cx0 + ox, cz0 + oz);
          let arr = this.circleCells.get(k);
          if (!arr) {
            arr = [];
            this.circleCells.set(k, arr);
          }
          arr.push(c);
        }
      }
    }

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const maxExtent = Math.hypot(b.halfW, b.halfD) + 1.0;
      const minCx = Math.floor((b.cx - maxExtent) / this.cellSize);
      const maxCx = Math.floor((b.cx + maxExtent) / this.cellSize);
      const minCz = Math.floor((b.cz - maxExtent) / this.cellSize);
      const maxCz = Math.floor((b.cz + maxExtent) / this.cellSize);
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const k = this.key(cx, cz);
          let arr = this.boxCells.get(k);
          if (!arr) {
            arr = [];
            this.boxCells.set(k, arr);
          }
          arr.push(b);
        }
      }
    }
  }

  private key(cx: number, cz: number): number {
    return ((cx + 512) << 12) | ((cz + 512) & 0xfff);
  }

  public query(x: number, z: number, outCircles: CircleCollider[], outBoxes: BoxCollider[]): void {
    outCircles.length = 0;
    outBoxes.length = 0;
    this.seenBoxSet.clear();
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const k = this.key(cx + ox, cz + oz);
        const cs = this.circleCells.get(k);
        if (cs) {
          for (let i = 0; i < cs.length; i++) {
            const c = cs[i];
            if (!outCircles.includes(c)) outCircles.push(c);
          }
        }
        const bs = this.boxCells.get(k);
        if (bs) {
          for (let i = 0; i < bs.length; i++) {
            const b = bs[i];
            if (!this.seenBoxSet.has(b)) {
              this.seenBoxSet.add(b);
              outBoxes.push(b);
            }
          }
        }
      }
    }
  }
}

const _moveDir = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _camRayDir = new THREE.Vector3();
const _camRaycaster = new THREE.Raycaster();

const EXTERIOR_BG = new THREE.Color('#66737d');
const EXTERIOR_FOG_COLOR = '#66737d';
const EXTERIOR_FOG_DENSITY = 0.0235;

const _extAtmProfile: ExteriorAtmosphereProfile = {
  skyColor: new THREE.Color('#66737d'),
  fogColor: new THREE.Color('#66737d'),
  fogDensity: 0.0235,
  ambientColor: new THREE.Color('#8f9ca6'),
  ambientIntensity: 0.55,
  hemiSky: new THREE.Color('#bfd0de'),
  hemiGround: new THREE.Color('#435045'),
  hemiIntensity: 1.65,
  keyColor: new THREE.Color('#dce4eb'),
  keyIntensity: 1.75,
  rimIntensity: 0.72,
  exposure: 1.25,
  lanternDistance: 9.0,
  lanternBoost: 1.0,
};

interface QualityProfile {
  targetHeight: number;
  shadows: boolean;
  shadowMapSize: number;
  shadowType: THREE.ShadowMapType;
  foliageDensity: number;
  ditherStrength: number;
}

const QUALITY_PROFILES: Record<GraphicsQuality, QualityProfile> = {
  low: {
    targetHeight: 200,
    shadows: false,
    shadowMapSize: 512,
    shadowType: THREE.BasicShadowMap,
    foliageDensity: 0.52,
    ditherStrength: 0.95,
  },
  retro: {
    targetHeight: 270,
    shadows: true,
    shadowMapSize: 512,
    shadowType: THREE.BasicShadowMap,
    foliageDensity: 0.85,
    ditherStrength: 0.85,
  },
  high: {
    targetHeight: 360,
    shadows: true,
    shadowMapSize: 1024,
    shadowType: THREE.PCFShadowMap,
    foliageDensity: 1.0,
    ditherStrength: 0.72,
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function shortestAngleDiff(current: number, target: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

type ActiveInteractAction =
  | { kind: 'portal'; portal: PortalLink; prompt: InteractPrompt }
  | {
      kind: 'interactable';
      cueKind: 'door' | 'brazier' | 'relic' | 'secret' | 'found_item';
      run: () => string | void;
      prompt: InteractPrompt;
    }
  | {
      kind: 'npc';
      npcId: string;
      prompt: InteractPrompt;
    }
  | {
      kind: 'resource';
      nodeId: string;
      isFoundItem: boolean;
      prompt: InteractPrompt;
    }
  | {
      kind: 'structure';
      structureInfo: NearbyStructureInfo;
      prompt: InteractPrompt;
    }
  | {
      kind: 'exploration';
      expKind: 'chest' | 'mechanism' | 'lore' | 'event';
      run: () => ExplorationInteractResult;
      prompt: InteractPrompt;
    };

export class ForestExplorerEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private retroPass: RetroCompositePass;
  private scene: THREE.Scene;
  private worldRoot: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;
  private textures: ProceduralTextures;
  private world: WorldBuildResult;
  private overworldColliderGrid: SpatialColliderIndex;
  private nearbyCirclesBuf: CircleCollider[] = [];
  private nearbyBoxesBuf: BoxCollider[] = [];
  private playerDynCirclesBuf: CircleCollider[] = [];
  private playerBoxCollidersBuf: BoxCollider[] = [];
  private ecosystemCirclesBuf: CircleCollider[] = [];
  private activeInterior: InteriorInstance | null = null;
  private playerRig: WandererRig;

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private worldLightPool: THREE.PointLight[] = [];
  private lightPoolSortBuf: { idx: number; distSq: number }[] = [];
  private combinedLightAnchors: LightAnchor[] = [];

  private audio: ForestAudioSystem;
  private saveState: ThornvaleSaveState;
  private ecosystem: EcosystemManager;
  private resourceManager: WorldResourceManager;
  private equipmentSystem: EquipmentSystem;
  private craftingSystem: CraftingSystem;
  private buildingSystem: BuildingSystem;
  private survivalSystem: SurvivalSystem;
  private questSystem: QuestSystem;
  private explorationSystem: ExplorationSystem;
  private lastPlacementKey = '';

  private quality: GraphicsQuality;
  private vhsEnabled = true;
  private inputPaused = false;

  // Animation loop state
  private clock = new THREE.Clock();
  private frameId = 0;
  private timeoutId = 0;
  private disposed = false;

  // Character physics, combat & animation state
  private playerPos = new THREE.Vector3(0, 0, 5.2);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = Math.PI;
  private isGrounded = true;
  private walkCycle = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpPreLaunchTimer = 0;
  private landSquashTimer = 0;
  private visualStepOffset = 0;
  private turnAngularVel = 0;
  private lanternEnabled = true;

  private playerHp = 100;
  private readonly maxPlayerHp = 100;
  private hurtFlashTimer = 0;
  private combatCooldownTimer = 0;
  private regenEmitAccum = 0;
  private attackAnimTimer = 0;
  private attackCooldownTimer = 0;
  private gatherAnimTimer = 0;

  // Dialogue state
  private activeDialogue: ActiveDialogue | null = null;

  // Exterior return cache when inside an interior
  private exteriorReturn: { x: number; y: number; z: number; yaw: number } | null = null;

  // Isolated Developer Mode snapshot & transient sandbox state
  private devModeEnabled = false;
  private devSaveState: ThornvaleSaveState | null = null;
  private devNormalSnapshot: {
    saveState: ThornvaleSaveState;
    playerPos: { x: number; y: number; z: number };
    playerYaw: number;
    activeInteriorId: InteriorId | null;
    exteriorReturn: { x: number; y: number; z: number; yaw: number } | null;
    playerHp: number;
    camYaw: number;
    camPitch: number;
    camDistance: number;
    zoneName: string;
  } | null = null;

  // Smooth transition state
  private transitionPhase: 'idle' | 'fadingOut' | 'fadingIn' = 'idle';
  private transitionTimer = 0;
  private pendingPortal: PortalLink | null = null;
  private statusTimer = 0;

  // Camera state
  private camYaw = 0;
  private camPitch = 0.32;
  private camDistance = 5.8;
  private targetCamYaw = 0;
  private targetCamPitch = 0.32;
  private targetCamDistance = 5.8;
  private smoothLookAt = new THREE.Vector3(0, 1.4, 5.2);

  // Input state
  private keys: Record<string, boolean> = {};
  private touchMove: TouchMoveInput = { x: 0, y: 0, magnitude: 0 };
  private touchSprint = false;

  // Mouse & touch drag camera orbit state
  private isDraggingCamera = false;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activeOrbitTouchId: number | null = null;
  private lastTouchOrbitX = 0;
  private lastTouchOrbitY = 0;

  private currentZoneName = 'The Moss Clearing';
  private currentInteractAction: ActiveInteractAction | null = null;
  private lastPromptKey = '';

  constructor(
    container: HTMLElement,
    callbacks: EngineCallbacks = {},
    initialQuality: GraphicsQuality = 'retro'
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.quality = initialQuality;
    this.audio = new ForestAudioSystem();
    this.saveState = loadWorldSave(WORLD_SEED);

    const profile = QUALITY_PROFILES[this.quality];
    const width = container.clientWidth || window.innerWidth;
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    // 1. Renderer setup — pixelRatio locked to 1 because scene renders at retro internal target
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && profile.shadows;
    this.renderer.shadowMap.type = profile.shadowType;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.imageRendering = 'pixelated';
    container.appendChild(this.renderer.domElement);

    const supportsHalfFloat =
      this.renderer.capabilities.isWebGL2 &&
      (this.renderer.extensions.has('EXT_color_buffer_half_float') ||
        this.renderer.extensions.has('EXT_color_buffer_float'));

    // 2. Low-Resolution Retro + VHS Composite Pass
    this.retroPass = new RetroCompositePass(width, height, {
      targetHeight: profile.targetHeight,
      vhsEnabled: this.vhsEnabled,
      ditherStrength: profile.ditherStrength,
      colorLevels: 26, // ~15-bit PS1 RGB color banding
      exposure: this.renderer.toneMappingExposure,
      useHalfFloat: supportsHalfFloat,
    });

    // 3. Scene & Dense Grey-Slate Melancholic Overcast Daytime Fog
    this.scene = new THREE.Scene();
    this.scene.background = EXTERIOR_BG.clone();
    this.scene.fog = new THREE.FogExp2(EXTERIOR_FOG_COLOR, EXTERIOR_FOG_DENSITY);

    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);

    // 4. Camera (far plane covers outer 200m+ mountain & citadel silhouettes)
    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.15, 265);

    // 5. Procedural Studio Environment Reflection (for iron/brass accents only)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.72;
    pmrem.dispose();

    // 6. Permanent Heavily Overcast Daytime Atmospheric Lighting Rig
    this.ambientLight = new THREE.AmbientLight('#8f9ca6', 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#bfd0de', '#435045', 1.65);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#dce4eb', 1.75);
    this.keyLight.position.set(16, 26, 14);
    this.keyLight.castShadow = !this.isSoftwareGl && profile.shadows;
    this.keyLight.shadow.mapSize.width = profile.shadowMapSize;
    this.keyLight.shadow.mapSize.height = profile.shadowMapSize;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 65;
    const d = 20;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0008;
    this.keyLight.shadow.normalBias = 0.03;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight('#8da3b8', 0.72);
    this.rimLight.position.set(-20, 12, -22);
    this.scene.add(this.rimLight);

    // 6-Light dynamic world pool for exterior lanterns, caves, and dungeon sconces
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight('#ff8a33', 0, 18, 1.7);
      this.scene.add(pl);
      this.worldLightPool.push(pl);
    }

    // 7. Procedural Retro Textures, World & Character
    this.textures = createProceduralTextures();
    this.world = buildForestWorld(this.worldRoot, this.textures);
    this.world.setDensityScale(profile.foliageDensity);
    this.overworldColliderGrid = new SpatialColliderIndex(
      this.world.colliders,
      this.world.boxColliders
    );

    this.resourceManager = new WorldResourceManager(
      this.worldRoot,
      WORLD_SEED,
      this.world.colliders,
      this.world.boxColliders,
      this.saveState,
      this.updateSaveState
    );

    this.ecosystem = new EcosystemManager(
      this.scene,
      this.textures,
      this.audio,
      this.saveState,
      this.updateSaveState
    );
    this.ecosystem.initOverworld(
      WORLD_SEED,
      this.world.colliders,
      this.world.boxColliders
    );

    this.playerRig = createWandererCharacter(this.textures);
    this.playerPos.y = walkableHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);

    this.equipmentSystem = new EquipmentSystem(this.playerRig, this.textures);
    this.craftingSystem = new CraftingSystem();
    this.buildingSystem = new BuildingSystem(this.scene, this.textures);
    this.survivalSystem = new SurvivalSystem();
    this.questSystem = new QuestSystem();
    this.explorationSystem = new ExplorationSystem(
      this.scene,
      this.textures,
      this.audio,
      this.saveState.exploration ?? createDefaultExplorationSaveData()
    );

    this.equipmentSystem.syncFromSave(this.saveState);
    this.buildingSystem.syncForEnvironment('overworld', this.saveState);
    this.explorationSystem.syncForEnvironment('overworld', this.saveState);
    this.applyExteriorEnvironment();

    this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.42, this.playerPos.z);
    this.updateCameraTransform(1.0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.callbacks.onZoneChange?.(this.currentZoneName);
    this.callbacks.onQualityChange?.(this.quality);
    this.callbacks.onSaveStateChange?.(this.saveState);
    this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
    this.emitVitals();
    this.emitSurvival();
    this.emitPlacementIfChanged(true);
    this.startLoop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('touchstart', this.onCanvasTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onCanvasTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', this.onCanvasTouchEnd, { passive: true });
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('touchstart', this.onCanvasTouchStart);
    canvas.removeEventListener('touchmove', this.onCanvasTouchMove);
    canvas.removeEventListener('touchend', this.onCanvasTouchEnd);
    canvas.removeEventListener('touchcancel', this.onCanvasTouchEnd);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onWebGLContextLost?.(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onWebGLContextLost?.(false);
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.retroPass.resize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (e.code === 'Escape' && this.activeDialogue) {
      this.closeDialogue();
      return;
    }
    if (this.inputPaused) return;
    if (e.code === 'Escape' && this.buildingSystem.isPlacementActive()) {
      this.cancelStructurePlacement();
      return;
    }
    if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) {
      if (this.activeDialogue) {
        this.advanceDialogue();
      } else if (this.buildingSystem.isPlacementActive()) {
        this.confirmStructurePlacement();
      } else {
        this.triggerInteract();
      }
      return;
    }
    if (e.code === 'KeyG' && !e.repeat && !this.activeDialogue) {
      if (this.currentInteractAction?.kind === 'resource') {
        this.triggerInteract();
      }
      return;
    }
    if (e.code === 'KeyT' && !e.repeat && this.buildingSystem.isPlacementActive()) {
      this.rotateStructurePlacement();
      return;
    }
    if (
      e.code === 'KeyX' &&
      !e.repeat &&
      !this.activeDialogue &&
      !this.buildingSystem.isPlacementActive() &&
      this.currentInteractAction?.kind === 'structure'
    ) {
      this.dismantleStructure(this.currentInteractAction.structureInfo.record.id);
      return;
    }
    if (this.activeDialogue) return;

    if (e.code === 'Space' && !e.repeat) {
      this.triggerJump();
    } else if (e.code === 'KeyL') {
      this.toggleLantern();
    } else if (e.code === 'KeyR' && !e.repeat) {
      if (this.buildingSystem.isPlacementActive()) {
        this.rotateStructurePlacement();
      } else {
        this.resetCamera();
      }
    } else if ((e.code === 'KeyV' || e.code === 'KeyJ') && !e.repeat) {
      this.triggerAttack();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.isDraggingCamera = true;
    this.pointerDownX = e.clientX;
    this.pointerDownY = e.clientY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDraggingCamera) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.orbitBy(-dx * 0.0055, dy * 0.0045);
  };

  private onMouseUp = (e: MouseEvent): void => {
    const wasDragging = this.isDraggingCamera;
    this.isDraggingCamera = false;
    if (wasDragging && e.button === 0 && e.target === this.renderer.domElement) {
      const dragDist = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
      if (dragDist < 5 && !this.activeDialogue && !this.inputPaused) {
        if (this.buildingSystem.isPlacementActive()) {
          this.confirmStructurePlacement();
        } else {
          this.triggerAttack();
        }
      }
    }
  };

  private onCanvasTouchStart = (e: TouchEvent): void => {
    if (this.activeOrbitTouchId !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    this.activeOrbitTouchId = touch.identifier;
    this.lastTouchOrbitX = touch.clientX;
    this.lastTouchOrbitY = touch.clientY;
  };

  private onCanvasTouchMove = (e: TouchEvent): void => {
    if (this.activeOrbitTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.activeOrbitTouchId) {
        e.preventDefault();
        const dx = t.clientX - this.lastTouchOrbitX;
        const dy = t.clientY - this.lastTouchOrbitY;
        this.lastTouchOrbitX = t.clientX;
        this.lastTouchOrbitY = t.clientY;
        this.orbitBy(-dx * 0.0065, dy * 0.005);
        break;
      }
    }
  };

  private onCanvasTouchEnd = (e: TouchEvent): void => {
    if (this.activeOrbitTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.activeOrbitTouchId) {
        this.activeOrbitTouchId = null;
        break;
      }
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const minDist = this.activeInterior ? 2.2 : 3.4;
    const maxDist = this.activeInterior ? 7.2 : 10.8;
    this.targetCamDistance = THREE.MathUtils.clamp(
      this.targetCamDistance + e.deltaY * 0.004,
      minDist,
      maxDist
    );
  };

  // --- Public Controls API for HUD & Touch Controls ---

  public setTouchMove(input: TouchMoveInput): void {
    this.touchMove.x = input.x;
    this.touchMove.y = input.y;
    this.touchMove.magnitude = input.magnitude;
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprint = active;
  }

  public triggerJump(): void {
    this.jumpBufferTimer = 0.13;
  }

  public setInputPaused(paused: boolean): void {
    this.inputPaused = paused;
    if (paused) {
      this.keys = {};
      this.isDraggingCamera = false;
    }
  }

  public moveInventorySlot(fromIdx: number, toIdx: number): void {
    this.updateSaveState((prev) => ({
      ...prev,
      inventory: moveOrSwapInventorySlot(prev.inventory, fromIdx, toIdx),
    }));
  }

  public splitInventorySlot(slotIdx: number): boolean {
    let didSplit = false;
    this.updateSaveState((prev) => {
      const res = splitInventorySlot(prev.inventory, slotIdx);
      if (res.splitSlotIdx === null) return prev;
      didSplit = true;
      return {
        ...prev,
        inventory: res.nextSlots,
      };
    });
    if (!didSplit) {
      this.showStatusMessage('Need stack of 2+ and a free slot to split.');
    }
    return didSplit;
  }

  public discardInventoryItem(slotIdx: number, amount?: number): void {
    this.updateSaveState((prev) => ({
      ...prev,
      inventory: removeInventorySlotItem(prev.inventory, slotIdx, amount),
    }));
  }

  public triggerInteract(): void {
    if (this.transitionPhase !== 'idle') return;
    if (this.buildingSystem.isPlacementActive()) {
      this.confirmStructurePlacement();
      return;
    }
    if (this.activeDialogue) {
      this.advanceDialogue();
      return;
    }
    if (!this.currentInteractAction) return;
    if (this.currentInteractAction.kind === 'portal') {
      const portal = this.currentInteractAction.portal;
      this.pendingPortal = portal;
      this.transitionPhase = 'fadingOut';
      this.transitionTimer = 0;
      this.audio.playTransitionCue(portal.transitionKind);
      this.callbacks.onTransitionChange?.(true, portal.label);
    } else if (this.currentInteractAction.kind === 'npc') {
      const dlg = this.ecosystem.buildDialogueForNpc(
        !!this.activeInterior,
        this.currentInteractAction.npcId
      );
      if (dlg) {
        this.activeDialogue = dlg;
        this.callbacks.onDialogueChange?.({ ...dlg });
        this.updateInteractionPrompt();
      }
    } else if (this.currentInteractAction.kind === 'resource') {
      const combatStats = this.equipmentSystem.getCombatStats(this.getActiveSaveState());
      const res = this.resourceManager.harvestNode(
        this.currentInteractAction.nodeId,
        this.getActiveSaveState(),
        combatStats.ownedTools
      );
      this.audio.playGatherCue(res.cueKind);
      if (res.success) {
        this.gatherAnimTimer = 0.24;
        this.questSystem.recordGather(1, this.updateSaveState);
      }
      if (res.message) {
        this.showStatusMessage(res.message);
      }
      this.updateInteractionPrompt();
    } else if (this.currentInteractAction.kind === 'structure') {
      const { record, def } = this.currentInteractAction.structureInfo;
      if (record.structureId === 'campfire' || record.structureId === 'workbench') {
        this.audio.playInteractCue(record.structureId === 'campfire' ? 'brazier' : 'door');
        this.callbacks.onRequestOpenWorkshop?.('craft');
      } else if (record.structureId === 'storage_chest') {
        this.audio.playInteractCue('door');
        this.callbacks.onStashModalChange?.(true);
      } else if (record.structureId === 'field_shelter') {
        this.playerHp = this.maxPlayerHp;
        this.survivalSystem.applyRestRestore();
        this.audio.playInteractCue('brazier');
        this.emitVitals();
        this.emitSurvival();
        this.showStatusMessage('Rested at Woodland Lean-To — Vitality, Stamina & Warmth restored');
      } else {
        this.showStatusMessage(`${def.name}: ${def.description}`);
      }
    } else if (this.currentInteractAction.kind === 'exploration') {
      const res = this.currentInteractAction.run();
      if (this.currentInteractAction.expKind === 'chest' || this.currentInteractAction.expKind === 'event') {
        this.gatherAnimTimer = 0.24;
      }
      if (res.message) {
        this.showStatusMessage(res.message);
      }
      this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
      this.updateInteractionPrompt();
    } else {
      const cueKind = this.currentInteractAction.cueKind;
      const msg = this.currentInteractAction.run();
      if (cueKind === 'found_item') {
        this.audio.playGatherCue('curio');
        this.gatherAnimTimer = 0.24;
      } else {
        this.audio.playInteractCue(cueKind);
      }
      if (typeof msg === 'string' && msg.length > 0) {
        this.showStatusMessage(msg);
      }
      this.updateInteractionPrompt();
    }
  }

  public advanceDialogue(): void {
    if (!this.activeDialogue) return;
    if (this.activeDialogue.lineIndex + 1 < this.activeDialogue.lines.length) {
      this.activeDialogue = {
        ...this.activeDialogue,
        lineIndex: this.activeDialogue.lineIndex + 1,
      };
      this.audio.playEcosystemCue('npc_murmur');
      this.callbacks.onDialogueChange?.({ ...this.activeDialogue });
    } else {
      this.closeDialogue();
    }
  }

  public closeDialogue(): void {
    if (!this.activeDialogue) return;
    this.activeDialogue = null;
    this.callbacks.onDialogueChange?.(null);
    this.updateInteractionPrompt();
  }

  public triggerAttack(): void {
    if (this.transitionPhase !== 'idle' || this.activeDialogue || this.inputPaused) return;
    if (this.buildingSystem.isPlacementActive()) {
      this.confirmStructurePlacement();
      return;
    }
    if (this.attackCooldownTimer > 0) return;

    this.attackAnimTimer = 0.34;
    this.attackCooldownTimer = 0.48;
    this.audio.playEcosystemCue('sword_swing');
    this.survivalSystem.spendAttackStamina();
    this.emitSurvival();

    const combatStats = this.equipmentSystem.getCombatStats(this.getActiveSaveState());
    const res = this.ecosystem.performPlayerAttack(
      !!this.activeInterior,
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      this.playerYaw,
      combatStats.attackDamage
    );
    if (res.hitCount > 0) {
      this.combatCooldownTimer = 4.5;
      this.emitVitals();
    }
    if (res.killedEntities.length > 0) {
      const lootBatch: { itemId: string; quantity: number }[] = [];
      for (let i = 0; i < res.killedEntities.length; i++) {
        const table = MONSTER_LOOT_TABLE[res.killedEntities[i].species];
        if (!table) continue;
        for (let j = 0; j < table.length; j++) {
          const drop = table[j];
          if (Math.random() <= drop.chance) {
            lootBatch.push({ itemId: drop.itemId, quantity: drop.quantity });
          }
        }
      }

      let gainedSummary = '';
      if (lootBatch.length > 0) {
        let addedAny = 0;
        this.updateSaveState((prev) => {
          const added = addItemsToInventory(prev.inventory, lootBatch, false);
          addedAny = added.addedTotal;
          if (added.addedTotal === 0) return prev;
          return { ...prev, inventory: added.nextSlots };
        });
        if (addedAny > 0) {
          const firstDef = ITEM_CATALOG[lootBatch[0].itemId];
          gainedSummary = firstDef ? ` (+${firstDef.name})` : '';
        }
      }

      this.questSystem.recordDefeat(res.killedEntities.length, this.updateSaveState);
      this.showStatusMessage(`Vanquished: ${res.killedNames[0]}${gainedSummary}`);
    }
  }

  public getEcosystemStats(): EcosystemStats {
    return this.ecosystem.getStats(!!this.activeInterior);
  }

  public getPlayerVitals(): PlayerVitals {
    return {
      hp: Math.round(this.playerHp),
      maxHp: this.maxPlayerHp,
      inCombat: this.combatCooldownTimer > 0,
      hurtFlash: this.hurtFlashTimer,
    };
  }

  private emitVitals(): void {
    this.callbacks.onPlayerVitalsChange?.(this.getPlayerVitals());
  }

  // --- Gameplay Expansion API (Crafting, Building, Equipment, Stash, Quests) ---

  public getSurvivalState(): PlayerSurvivalState {
    return this.survivalSystem.getState();
  }

  private emitSurvival(): void {
    this.callbacks.onSurvivalChange?.(this.survivalSystem.getState());
  }

  public getPlacementState(): PlacementPreviewState {
    return this.buildingSystem.getPlacementPreviewState();
  }

  private emitPlacementIfChanged(force = false): void {
    const p = this.buildingSystem.getPlacementPreviewState();
    const key = `${p.active}:${p.structureId ?? ''}:${p.valid}:${p.reason}:${p.rotY.toFixed(2)}`;
    if (force || key !== this.lastPlacementKey) {
      this.lastPlacementKey = key;
      this.callbacks.onPlacementChange?.(p);
    }
  }

  public getActiveEnvironmentId(): StructureEnvironmentId {
    return this.activeInterior ? this.activeInterior.id : 'overworld';
  }

  public getCombatStats(): CombatDerivedStats {
    return this.equipmentSystem.getCombatStats(this.getActiveSaveState());
  }

  public craftRecipe(recipeId: string): CraftResult {
    const stations = this.buildingSystem.getNearbyStations(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z
    );
    const res = this.craftingSystem.craftRecipe(
      recipeId,
      () => this.getActiveSaveState(),
      this.updateSaveState,
      stations
    );
    if (res.success && res.recipe) {
      this.questSystem.recordCraft(res.recipe.outputItemId, this.updateSaveState);
      this.audio.playGatherCue('mineral');
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public startStructurePlacement(structureId: BuildableStructureId): boolean {
    if (this.transitionPhase !== 'idle' || this.activeDialogue) return false;
    const ok = this.buildingSystem.startPlacement(structureId);
    if (!ok) return false;
    this.updateGhostPlacement();
    this.emitPlacementIfChanged(true);
    const def = BUILDABLE_STRUCTURES[structureId];
    this.showStatusMessage(`Placing ${def.name} — [F/Click] Place, [R/T] Rotate, [Esc] Cancel`);
    return true;
  }

  public rotateStructurePlacement(): void {
    if (!this.buildingSystem.isPlacementActive()) return;
    this.buildingSystem.rotatePlacement(Math.PI / 4);
    this.updateGhostPlacement();
    this.emitPlacementIfChanged(true);
  }

  public cancelStructurePlacement(): void {
    if (!this.buildingSystem.isPlacementActive()) return;
    this.buildingSystem.cancelPlacement();
    this.emitPlacementIfChanged(true);
  }

  public confirmStructurePlacement(): BuildActionResult {
    const envId = this.getActiveEnvironmentId();
    const portals = this.activeInterior ? this.activeInterior.portals : this.world.portals;
    this.updateGhostPlacement();

    const staticCircles = this.getStaticCirclesForPlacement(
      this.playerPos.x,
      this.playerPos.z
    );
    const staticBoxes = this.activeInterior
      ? this.activeInterior.boxColliders
      : this.nearbyBoxesBuf;

    const res = this.buildingSystem.confirmPlacement(
      envId,
      staticCircles,
      staticBoxes,
      portals,
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );

    if (res.success && res.record) {
      this.questSystem.recordBuild(res.record.structureId, this.updateSaveState);
      this.audio.playTransitionCue(
        res.record.structureId === 'campfire' ? 'stone' : 'wood'
      );
      this.emitPlacementIfChanged(true);
      this.updateInteractionPrompt();
    } else {
      this.emitPlacementIfChanged(true);
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public dismantleStructure(recordId: string): BuildActionResult {
    const res = this.buildingSystem.dismantleStructure(
      recordId,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );
    if (res.success) {
      this.audio.playTransitionCue('wood');
      this.updateInteractionPrompt();
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public equipInventorySlot(slotIdx: number): EquipResult {
    const res = this.equipmentSystem.equipFromInventorySlot(
      slotIdx,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );
    if (res.success) {
      this.audio.playGatherCue('curio');
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public unequipGearSlot(slot: GearSlot): EquipResult {
    const res = this.equipmentSystem.unequipSlot(
      slot,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );
    if (res.success) {
      this.audio.playGatherCue('curio');
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public useInventorySlot(slotIdx: number): ConsumeResult {
    const res = this.equipmentSystem.useConsumableSlot(
      slotIdx,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );
    if (res.success && res.effect) {
      this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + res.effect.healHp);
      this.survivalSystem.applyConsumableRestore(
        res.effect.restoreStamina,
        res.effect.restoreWarmth
      );
      this.audio.playGatherCue('foliage');
      this.emitVitals();
      this.emitSurvival();
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  public transferPackToStash(packIdx: number, targetStashIdx?: number): boolean {
    if (packIdx < 0 || packIdx >= INVENTORY_CAPACITY) return false;
    let transferred = false;
    this.updateSaveState((prev) => {
      const pack = prev.inventory.map((s) => (s ? { ...s } : null));
      const src = pack[packIdx];
      if (!src) return prev;
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const stash = gp.stash.map((s) => (s ? { ...s } : null));
      while (stash.length < STASH_CAPACITY) stash.push(null);

      if (targetStashIdx === undefined) {
        const added = addItemsToInventory(
          stash,
          [{ itemId: src.itemId, quantity: src.quantity }],
          true
        );
        if (added.addedTotal <= 0) return prev;
        transferred = true;
        return {
          ...prev,
          inventory: removeInventorySlotItem(pack, packIdx, added.addedTotal),
          gameplay: { ...gp, stash: added.nextSlots },
        };
      }

      if (targetStashIdx < 0 || targetStashIdx >= STASH_CAPACITY) return prev;
      const dst = stash[targetStashIdx];
      const def = ITEM_CATALOG[src.itemId];
      const maxStack = def ? def.maxStack : 99;
      if (!dst) {
        stash[targetStashIdx] = { ...src };
        pack[packIdx] = null;
      } else if (dst.itemId === src.itemId && dst.quantity < maxStack) {
        const room = maxStack - dst.quantity;
        const moveAmt = Math.min(room, src.quantity);
        dst.quantity += moveAmt;
        if (src.quantity - moveAmt <= 0) pack[packIdx] = null;
        else src.quantity -= moveAmt;
      } else {
        stash[targetStashIdx] = { ...src };
        pack[packIdx] = { ...dst };
      }
      transferred = true;
      return { ...prev, inventory: pack, gameplay: { ...gp, stash } };
    });
    if (!transferred) {
      this.showStatusMessage('Storage chest is full.');
    }
    return transferred;
  }

  public transferStashToPack(stashIdx: number, targetPackIdx?: number): boolean {
    if (stashIdx < 0 || stashIdx >= STASH_CAPACITY) return false;
    let transferred = false;
    this.updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const stash: (InventorySlot | null)[] = gp.stash.map((s) => (s ? { ...s } : null));
      while (stash.length < STASH_CAPACITY) stash.push(null);
      const src = stash[stashIdx];
      if (!src) return prev;
      const pack = prev.inventory.map((s) => (s ? { ...s } : null));

      if (targetPackIdx === undefined) {
        const added = addItemsToInventory(
          pack,
          [{ itemId: src.itemId, quantity: src.quantity }],
          true
        );
        if (added.addedTotal <= 0) return prev;
        transferred = true;
        return {
          ...prev,
          inventory: added.nextSlots,
          gameplay: {
            ...gp,
            stash: removeInventorySlotItem(stash, stashIdx, added.addedTotal),
          },
        };
      }

      if (targetPackIdx < 0 || targetPackIdx >= INVENTORY_CAPACITY) return prev;
      const dst = pack[targetPackIdx];
      const def = ITEM_CATALOG[src.itemId];
      const maxStack = def ? def.maxStack : 99;
      if (!dst) {
        pack[targetPackIdx] = { ...src };
        stash[stashIdx] = null;
      } else if (dst.itemId === src.itemId && dst.quantity < maxStack) {
        const room = maxStack - dst.quantity;
        const moveAmt = Math.min(room, src.quantity);
        dst.quantity += moveAmt;
        if (src.quantity - moveAmt <= 0) stash[stashIdx] = null;
        else src.quantity -= moveAmt;
      } else {
        pack[targetPackIdx] = { ...src };
        stash[stashIdx] = { ...dst };
      }
      transferred = true;
      return { ...prev, inventory: pack, gameplay: { ...gp, stash } };
    });
    if (!transferred) {
      this.showStatusMessage('Traveler Pack is full.');
    }
    return transferred;
  }

  public claimQuestReward(questId: string): { success: boolean; message: string } {
    const res = this.questSystem.claimReward(
      questId,
      () => this.getActiveSaveState(),
      this.updateSaveState
    );
    if (res.success) {
      this.audio.playGatherCue('curio');
    }
    if (res.message) {
      this.showStatusMessage(res.message);
    }
    return res;
  }

  private getStaticCirclesForPlacement(px: number, pz: number): CircleCollider[] {
    if (this.activeInterior) {
      return this.activeInterior.circleColliders;
    }
    this.overworldColliderGrid.query(
      px + Math.sin(this.playerYaw) * 2.5,
      pz + Math.cos(this.playerYaw) * 2.5,
      this.nearbyCirclesBuf,
      this.nearbyBoxesBuf
    );
    return this.nearbyCirclesBuf;
  }

  private updateGhostPlacement(): void {
    const envId = this.getActiveEnvironmentId();
    const portals = this.activeInterior ? this.activeInterior.portals : this.world.portals;
    const staticCircles = this.getStaticCirclesForPlacement(
      this.playerPos.x,
      this.playerPos.z
    );
    const staticBoxes = this.activeInterior
      ? this.activeInterior.boxColliders
      : this.nearbyBoxesBuf;

    this.buildingSystem.updateGhost(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      this.playerYaw,
      (x, z, refY) => this.getActiveWalkableHeight(x, z, refY, 0, true),
      envId,
      staticCircles,
      staticBoxes,
      portals,
      this.getActiveSaveState()
    );
  }

  public orbitBy(deltaYaw: number, deltaPitch: number): void {
    this.targetCamYaw += deltaYaw;
    this.targetCamPitch = THREE.MathUtils.clamp(
      this.targetCamPitch + deltaPitch,
      0.1,
      1.05
    );
  }

  public resetCamera(): void {
    this.targetCamYaw = this.playerYaw + Math.PI;
    this.targetCamPitch = 0.32;
    this.targetCamDistance = this.activeInterior
      ? this.activeInterior.lighting.defaultCamDistance
      : 5.8;
  }

  public toggleLantern(): boolean {
    this.lanternEnabled = !this.lanternEnabled;
    this.playerRig.lanternLight.visible = this.lanternEnabled;
    return this.lanternEnabled;
  }

  public toggleAudio(): boolean {
    const enabled = this.audio.toggle();
    this.callbacks.onAudioStateChange?.(enabled);
    return enabled;
  }

  public setQuality(nextQuality: GraphicsQuality): void {
    this.quality = nextQuality;
    const profile = QUALITY_PROFILES[nextQuality];
    this.retroPass.updateConfig({
      targetHeight: profile.targetHeight,
      ditherStrength: profile.ditherStrength,
    });
    this.world.setDensityScale(profile.foliageDensity);

    const shadowsActive = !this.isSoftwareGl && profile.shadows;
    this.renderer.shadowMap.enabled = shadowsActive;
    this.renderer.shadowMap.type = profile.shadowType;
    this.keyLight.castShadow = shadowsActive;
    if (this.keyLight.shadow.mapSize.width !== profile.shadowMapSize) {
      this.keyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }
    this.callbacks.onQualityChange?.(nextQuality);
  }

  public setVhsEnabled(enabled: boolean): void {
    this.vhsEnabled = enabled;
    this.retroPass.updateConfig({ vhsEnabled: enabled });
  }

  public isLanternOn(): boolean {
    return this.lanternEnabled;
  }

  public getSaveState(): ThornvaleSaveState {
    return this.saveState;
  }

  public getDevModeEnabled(): boolean {
    return this.devModeEnabled;
  }

  public getDevTeleportLocations(): DevTeleportPoint[] {
    return DEV_TELEPORT_POINTS;
  }

  private onInteriorLocationTrigger = (triggerId: string): void => {
    const msg = this.explorationSystem.notifyLocationTrigger(triggerId, this.updateSaveState);
    if (msg) {
      this.showStatusMessage(msg);
    }
  };

  public getAtmosphereState(): ExplorationAtmosphereState {
    return this.explorationSystem.getAtmosphereState();
  }

  public getDevExplorationSnapshot(): DevExplorationSnapshot | null {
    if (!this.devModeEnabled) return null;
    return this.explorationSystem.getDevSnapshot(this.getActiveSaveState());
  }

  public setDevTimePreset(hour: number | null): void {
    if (!this.devModeEnabled) return;
    this.explorationSystem.setDevTimeOfDay(hour);
    const atm = this.explorationSystem.getAtmosphereState();
    this.callbacks.onAtmosphereChange?.(atm);
    if (!this.activeInterior) {
      this.applyExteriorEnvironment();
    }
    this.showStatusMessage(
      hour === null ? 'Time override cleared — live cycle active' : `Dev Time pinned to ${atm.hourLabel} (${atm.phase})`
    );
  }

  public toggleDevTimeCyclePaused(): boolean {
    if (!this.devModeEnabled) return false;
    const next = !this.explorationSystem.getAtmosphereState().cyclePaused;
    this.explorationSystem.setDevCyclePaused(next);
    const atm = this.explorationSystem.getAtmosphereState();
    this.callbacks.onAtmosphereChange?.(atm);
    this.showStatusMessage(next ? 'Day/Night cycle paused' : 'Day/Night cycle resumed');
    return next;
  }

  public triggerDevDynamicEvent(kind?: DynamicEventKind): DynamicEventUiSummary | null {
    if (!this.devModeEnabled) return null;
    if (this.activeInterior) {
      this.showStatusMessage('Go outdoors to spawn a dynamic world event');
      return null;
    }
    const ev = this.explorationSystem.triggerDevDynamicEvent(
      this.playerPos.x,
      this.playerPos.z,
      this.world.colliders,
      this.world.boxColliders,
      kind
    );
    if (!ev) {
      this.showStatusMessage('No clear ground nearby to spawn event — step toward a trail or glade');
      return null;
    }
    this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
    this.showStatusMessage(`Spawned Event: ${ev.title} (${ev.x}, ${ev.z})`);
    return ev;
  }

  public clearDevDynamicEvents(): void {
    if (!this.devModeEnabled) return;
    this.explorationSystem.clearAllDynamicEvents();
    this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
    this.updateInteractionPrompt();
    this.showStatusMessage('Cleared active dynamic events');
  }

  public setDevMechanismsOpen(open: boolean): void {
    if (!this.devModeEnabled) return;
    this.explorationSystem.setAllMechanismsState(open, this.updateSaveState);
    this.updateInteractionPrompt();
    this.showStatusMessage(open ? 'All secret mechanisms opened (Dev Sandbox)' : 'All secret mechanisms reset (Dev Sandbox)');
  }

  public revealDevSecretsAndJournal(): void {
    if (!this.devModeEnabled) return;
    this.explorationSystem.revealAllSecretsAndJournal(this.updateSaveState);
    this.showStatusMessage('All Journal lore & crafting schematics unlocked in Dev Sandbox');
  }

  public spawnDevTestChest(): void {
    if (!this.devModeEnabled) return;
    this.explorationSystem.spawnDevTestChestNear(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      this.playerYaw
    );
    this.updateInteractionPrompt();
    this.showStatusMessage('Spawned Dev Sandbox Cache ahead of wanderer');
  }

  public setDevMode(enabled: boolean): void {
    if (enabled === this.devModeEnabled) return;
    this.closeDialogue();
    this.cancelStructurePlacement();
    this.callbacks.onStashModalChange?.(false);

    if (enabled) {
      // Snapshot complete normal state before entering sandboxed Dev Mode
      this.devNormalSnapshot = {
        saveState: cloneSaveState(this.saveState),
        playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
        playerYaw: this.playerYaw,
        activeInteriorId: this.activeInterior ? this.activeInterior.id : null,
        exteriorReturn: this.exteriorReturn ? { ...this.exteriorReturn } : null,
        playerHp: this.playerHp,
        camYaw: this.camYaw,
        camPitch: this.camPitch,
        camDistance: this.camDistance,
        zoneName: this.currentZoneName,
      };
      this.devSaveState = cloneSaveState(this.saveState);
      this.devModeEnabled = true;
      this.ecosystem.syncSaveState(this.devSaveState);
      this.resourceManager.syncFromSave(this.devSaveState);
      this.equipmentSystem.syncFromSave(this.devSaveState);
      this.buildingSystem.syncForEnvironment(this.getActiveEnvironmentId(), this.devSaveState);
      this.explorationSystem.syncForEnvironment(this.getActiveEnvironmentId(), this.devSaveState);
      this.callbacks.onSaveStateChange?.(this.devSaveState);
      this.callbacks.onDevModeChange?.(true);
      this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
      this.emitSurvival();
      this.showStatusMessage('Developer Mode enabled (normal progression isolated)');
      return;
    }

    // Exiting Dev Mode: discard transient dev state and restore normal snapshot bit-for-bit
    const snap = this.devNormalSnapshot;
    this.devModeEnabled = false;
    this.devSaveState = null;
    this.devNormalSnapshot = null;

    if (snap) {
      this.saveState = cloneSaveState(snap.saveState);
      this.explorationSystem.resetTransientForDevExit(this.saveState);
      this.ecosystem.syncSaveState(this.saveState);
      this.resourceManager.syncFromSave(this.saveState);

      if (this.activeInterior) {
        this.scene.remove(this.activeInterior.group);
        this.activeInterior.dispose();
        this.activeInterior = null;
      }
      this.ecosystem.unloadInterior();
      this.ecosystem.initOverworld(WORLD_SEED, this.world.colliders, this.world.boxColliders);

      if (snap.activeInteriorId) {
        const built = buildInteriorById(
          snap.activeInteriorId,
          this.textures,
          this.saveState,
          this.updateSaveState,
          () => this.getActiveSaveState(),
          this.onInteriorLocationTrigger
        );
        this.activeInterior = built;
        this.worldRoot.visible = false;
        this.scene.add(built.group);
        this.ecosystem.loadInterior(snap.activeInteriorId);
        this.applyInteriorEnvironment(built);
      } else {
        this.worldRoot.visible = true;
        this.applyExteriorEnvironment();
      }

      this.equipmentSystem.syncFromSave(this.saveState);
      this.buildingSystem.syncForEnvironment(
        snap.activeInteriorId ?? 'overworld',
        this.saveState
      );
      this.explorationSystem.syncForEnvironment(
        snap.activeInteriorId ?? 'overworld',
        this.saveState
      );
      this.survivalSystem.reset();

      this.exteriorReturn = snap.exteriorReturn ? { ...snap.exteriorReturn } : null;
      this.playerPos.set(snap.playerPos.x, snap.playerPos.y, snap.playerPos.z);
      this.playerVel.set(0, 0, 0);
      this.playerYaw = snap.playerYaw;
      this.isGrounded = true;
      this.visualStepOffset = 0;
      this.playerHp = snap.playerHp;
      this.hurtFlashTimer = 0;
      this.combatCooldownTimer = 0;

      this.playerRig.root.position.copy(this.playerPos);
      this.playerRig.root.rotation.y = this.playerYaw;
      this.camYaw = snap.camYaw;
      this.targetCamYaw = snap.camYaw;
      this.camPitch = snap.camPitch;
      this.targetCamPitch = snap.camPitch;
      this.camDistance = snap.camDistance;
      this.targetCamDistance = snap.camDistance;
      this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.44, this.playerPos.z);
      this.updateCameraTransform(1.0);

      this.currentZoneName = snap.zoneName;
      this.callbacks.onZoneChange?.(snap.zoneName);
      this.callbacks.onSaveStateChange?.(this.saveState);
      this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
      this.emitVitals();
      this.emitSurvival();
      this.emitPlacementIfChanged(true);
      this.updateInteractionPrompt();

      if (!this.isSoftwareGl) {
        this.renderer.compile(this.scene, this.camera);
      }
    }

    this.callbacks.onDevModeChange?.(false);
    this.showStatusMessage('Developer Mode disabled — normal state restored');
  }

  public teleportToDevLocation(locationId: string): boolean {
    if (!this.devModeEnabled) return false;
    const target = DEV_TELEPORT_POINTS.find((pt) => pt.id === locationId);
    if (!target) return false;
    this.placeAtSnapshotTarget(
      target.targetEnv === 'overworld' ? null : target.targetEnv,
      target.x,
      target.y,
      target.z,
      target.yaw ?? Math.PI,
      target.name
    );
    this.showStatusMessage(`Teleported: ${target.name}`);
    return true;
  }

  public returnFromDevTeleport(): boolean {
    if (!this.devModeEnabled || !this.devNormalSnapshot) return false;
    const snap = this.devNormalSnapshot;
    this.placeAtSnapshotTarget(
      snap.activeInteriorId,
      snap.playerPos.x,
      snap.playerPos.y,
      snap.playerPos.z,
      snap.playerYaw,
      snap.zoneName,
      snap.exteriorReturn ? { ...snap.exteriorReturn } : null
    );
    this.showStatusMessage('Returned to normal exploration position');
    return true;
  }

  private placeAtSnapshotTarget(
    targetInteriorId: InteriorId | null,
    x: number,
    y: number | undefined,
    z: number,
    yaw: number,
    displayName: string,
    overrideExteriorReturn?: { x: number; y: number; z: number; yaw: number } | null
  ): void {
    this.closeDialogue();
    this.cancelStructurePlacement();
    this.callbacks.onStashModalChange?.(false);
    this.transitionPhase = 'idle';
    this.pendingPortal = null;
    this.callbacks.onTransitionChange?.(false);

    if (targetInteriorId === null) {
      if (this.activeInterior) {
        this.scene.remove(this.activeInterior.group);
        this.activeInterior.dispose();
        this.activeInterior = null;
      }
      this.ecosystem.unloadInterior();
      this.worldRoot.visible = true;
      this.applyExteriorEnvironment();
      this.exteriorReturn = null;

      const resolvedY = y !== undefined ? y : walkableHeightAt(x, z);
      this.playerPos.set(x, resolvedY, z);
      this.currentZoneName = displayName;
      this.callbacks.onZoneChange?.(displayName);
    } else {
      if (!this.activeInterior) {
        this.exteriorReturn =
          overrideExteriorReturn ??
          (this.devNormalSnapshot
            ? {
                x: this.devNormalSnapshot.playerPos.x,
                y: this.devNormalSnapshot.playerPos.y,
                z: this.devNormalSnapshot.playerPos.z,
                yaw: this.devNormalSnapshot.playerYaw,
              }
            : { x: 0, y: walkableHeightAt(0, 5.2), z: 5.2, yaw: Math.PI });
      }
      if (!this.activeInterior || this.activeInterior.id !== targetInteriorId) {
        if (this.activeInterior) {
          this.scene.remove(this.activeInterior.group);
          this.activeInterior.dispose();
        }
        const activeState = this.getActiveSaveState();
        const built = buildInteriorById(
          targetInteriorId,
          this.textures,
          activeState,
          this.updateSaveState,
          () => this.getActiveSaveState(),
          this.onInteriorLocationTrigger
        );
        this.activeInterior = built;
        this.worldRoot.visible = false;
        this.scene.add(built.group);
        this.ecosystem.loadInterior(targetInteriorId);
        this.applyInteriorEnvironment(built);
      }

      const refY = y ?? 0;
      const resolvedY = this.getActiveWalkableHeight(x, z, refY, 0, true);
      this.playerPos.set(x, resolvedY, z);
      this.currentZoneName = this.activeInterior.name;
      this.callbacks.onZoneChange?.(this.activeInterior.name);
    }

    this.buildingSystem.syncForEnvironment(
      this.getActiveEnvironmentId(),
      this.getActiveSaveState()
    );
    this.explorationSystem.syncForEnvironment(
      this.getActiveEnvironmentId(),
      this.getActiveSaveState()
    );
    this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());

    this.playerVel.set(0, 0, 0);
    this.playerYaw = yaw;
    this.isGrounded = true;
    this.visualStepOffset = 0;
    this.coyoteTimer = 0.11;
    this.jumpBufferTimer = 0;
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;

    this.camYaw = this.playerYaw + Math.PI;
    this.targetCamYaw = this.camYaw;
    this.camDistance = this.activeInterior
      ? this.activeInterior.lighting.defaultCamDistance
      : 5.8;
    this.targetCamDistance = this.camDistance;
    this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.44, this.playerPos.z);
    this.updateCameraTransform(1.0);
    this.updateInteractionPrompt();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private getActiveSaveState(): ThornvaleSaveState {
    return this.devModeEnabled && this.devSaveState ? this.devSaveState : this.saveState;
  }

  public resetWorldSave(): void {
    if (this.devModeEnabled) {
      this.showStatusMessage('Disable Developer Mode before resetting ledger');
      return;
    }
    this.cancelStructurePlacement();
    this.callbacks.onStashModalChange?.(false);
    this.saveState = clearWorldSave(WORLD_SEED);
    this.explorationSystem.resetTransientForDevExit(this.saveState);
    this.ecosystem.syncSaveState(this.saveState);
    this.resourceManager.syncFromSave(this.saveState);
    this.equipmentSystem.syncFromSave(this.saveState);
    this.buildingSystem.syncForEnvironment(this.getActiveEnvironmentId(), this.saveState);
    this.explorationSystem.syncForEnvironment(this.getActiveEnvironmentId(), this.saveState);
    this.survivalSystem.reset();
    this.ecosystem.initOverworld(
      WORLD_SEED,
      this.world.colliders,
      this.world.boxColliders
    );
    this.callbacks.onSaveStateChange?.(this.saveState);
    this.callbacks.onAtmosphereChange?.(this.explorationSystem.getAtmosphereState());
    this.emitSurvival();
    this.showStatusMessage('Exploration ledger cleared');
  }

  // --- Persistence & Discovery ---

  private updateSaveState = (
    updater: (prev: ThornvaleSaveState) => ThornvaleSaveState
  ): void => {
    if (this.devModeEnabled && this.devSaveState) {
      this.devSaveState = updater(this.devSaveState);
      this.ecosystem?.syncSaveState(this.devSaveState);
      this.callbacks.onSaveStateChange?.(this.devSaveState);
      return;
    }
    this.saveState = updater(this.saveState);
    this.ecosystem?.syncSaveState(this.saveState);
    persistWorldSave(this.saveState);
    this.callbacks.onSaveStateChange?.(this.saveState);
  };

  private markPlaceDiscovered(id: string, displayName?: string): void {
    if (this.devModeEnabled) return;
    const entry = DISCOVERABLE_CATALOG.find((item) => item.id === id);
    if (!entry) return;
    if (this.saveState.discoveredIds.includes(id)) return;
    const nextIds = [...this.saveState.discoveredIds, id];
    this.updateSaveState((prev) => ({
      ...prev,
      discoveredIds: nextIds,
    }));
    this.questSystem.syncDiscoveries(nextIds.length, this.updateSaveState);
    this.callbacks.onDiscovery?.(
      displayName ?? entry.name,
      nextIds.length,
      TOTAL_DISCOVERABLE_PLACES
    );
  }

  private showStatusMessage(msg: string): void {
    this.statusTimer = 2.8;
    this.callbacks.onStatusMessage?.(msg);
  }

  // --- Portal Execution & Scene Swapping ---

  private executePortalTransition(portal: PortalLink): void {
    this.closeDialogue();
    this.cancelStructurePlacement();
    this.callbacks.onStashModalChange?.(false);

    if (portal.targetId === 'overworld') {
      // Unload interior and restore exterior forest world cleanly
      if (this.activeInterior) {
        this.scene.remove(this.activeInterior.group);
        this.activeInterior.dispose();
        this.activeInterior = null;
      }
      this.ecosystem.unloadInterior();
      this.worldRoot.visible = true;
      this.applyExteriorEnvironment();

      if (this.exteriorReturn) {
        this.playerPos.set(
          this.exteriorReturn.x,
          this.exteriorReturn.y,
          this.exteriorReturn.z
        );
        this.playerYaw = this.exteriorReturn.yaw;
      } else {
        this.playerPos.set(0, walkableHeightAt(0, 5.2), 5.2);
        this.playerYaw = Math.PI;
      }
      this.exteriorReturn = null;
      this.buildingSystem.syncForEnvironment('overworld', this.getActiveSaveState());
      this.explorationSystem.syncForEnvironment('overworld', this.getActiveSaveState());
    } else {
      // Save player exterior threshold position & outward-facing yaw before entering
      this.exteriorReturn = {
        x: this.playerPos.x,
        y: walkableHeightAt(this.playerPos.x, this.playerPos.z),
        z: this.playerPos.z,
        yaw: this.playerYaw + Math.PI,
      };

      if (this.activeInterior) {
        this.scene.remove(this.activeInterior.group);
        this.activeInterior.dispose();
        this.activeInterior = null;
      }

      const built = buildInteriorById(
        portal.targetId,
        this.textures,
        this.getActiveSaveState(),
        this.updateSaveState,
        () => this.getActiveSaveState(),
        this.onInteriorLocationTrigger
      );
      this.activeInterior = built;
      this.worldRoot.visible = false;
      this.scene.add(built.group);
      this.ecosystem.loadInterior(portal.targetId);
      this.applyInteriorEnvironment(built);
      this.buildingSystem.syncForEnvironment(portal.targetId, this.getActiveSaveState());
      this.explorationSystem.syncForEnvironment(portal.targetId, this.getActiveSaveState());

      this.playerPos.set(portal.spawnX, portal.spawnY, portal.spawnZ);
      this.playerYaw = portal.spawnYaw;

      // Record discovery if entering a dungeon/cave/dwelling directly
      const discoverIdMap: Partial<Record<string, string>> = {
        cabin_interior: 'cabin',
        cottage_interior: 'cottage',
        tower_interior: 'tower',
        shrine_interior: 'whisper',
        cave_cragstone: 'crags',
        cave_weeping: 'weeping_cave',
        cave_ancient: 'barrow_cave',
        dungeon_catacombs: 'dungeon_catacombs',
        dungeon_vault: 'citadel_gate',
      };
      const catId = discoverIdMap[portal.targetId];
      if (catId) this.markPlaceDiscovered(catId);

      this.currentZoneName = built.name;
      this.callbacks.onZoneChange?.(built.name);
    }

    this.playerVel.set(0, 0, 0);
    this.isGrounded = true;
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;

    // Align camera immediately behind player inside new zone
    this.camYaw = this.playerYaw + Math.PI;
    this.targetCamYaw = this.camYaw;
    this.camDistance = this.activeInterior
      ? this.activeInterior.lighting.defaultCamDistance
      : 5.8;
    this.targetCamDistance = this.camDistance;
    this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.44, this.playerPos.z);
    this.updateCameraTransform(1.0);
    this.updateInteractionPrompt();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private applyExteriorEnvironment(): void {
    const atm = this.explorationSystem.getAtmosphereState();
    evaluateExteriorAtmosphereProfile(atm, _extAtmProfile);

    this.scene.background = _extAtmProfile.skyColor.clone();
    this.scene.fog = new THREE.FogExp2(_extAtmProfile.fogColor.getHex(), _extAtmProfile.fogDensity);
    this.scene.environmentIntensity = 0.72 * (1 - atm.nocturnalIntensity * 0.35);

    this.ambientLight.color.copy(_extAtmProfile.ambientColor);
    this.ambientLight.intensity = _extAtmProfile.ambientIntensity;
    this.hemiLight.color.copy(_extAtmProfile.hemiSky);
    this.hemiLight.groundColor.copy(_extAtmProfile.hemiGround);
    this.hemiLight.intensity = _extAtmProfile.hemiIntensity;
    this.keyLight.color.copy(_extAtmProfile.keyColor);
    this.keyLight.intensity = _extAtmProfile.keyIntensity;
    this.rimLight.intensity = _extAtmProfile.rimIntensity;

    this.renderer.toneMappingExposure = _extAtmProfile.exposure;
    this.retroPass.updateConfig({ exposure: _extAtmProfile.exposure });
    this.playerRig.lanternLight.distance = _extAtmProfile.lanternDistance;
    this.audio.setEnvironmentMode('forest');
  }

  private applyInteriorEnvironment(interior: InteriorInstance): void {
    const l = interior.lighting;
    this.scene.background = new THREE.Color(l.backgroundColor);
    this.scene.fog = new THREE.FogExp2(l.fogColor, l.fogDensity);
    this.scene.environmentIntensity = 0.36;

    this.ambientLight.color.set(l.ambientColor);
    this.ambientLight.intensity = l.ambientIntensity;
    this.hemiLight.color.set(l.hemiSky);
    this.hemiLight.groundColor.set(l.hemiGround);
    this.hemiLight.intensity = l.hemiIntensity;
    this.keyLight.color.set(l.dirColor);
    this.keyLight.intensity = l.dirIntensity;
    this.keyLight.position.set(l.dirPosition[0], l.dirPosition[1], l.dirPosition[2]);
    this.keyLight.target.position.set(0, 0, 0);
    this.rimLight.intensity = 0.16;

    this.renderer.toneMappingExposure = l.exposure;
    this.retroPass.updateConfig({ exposure: l.exposure });
    this.playerRig.lanternLight.distance = l.lanternDistance;
    this.audio.setEnvironmentMode(l.atmosphere);
  }

  // --- Loop & Simulation ---

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.timeoutId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.timeoutId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.timeoutId = window.setTimeout(cb, 80);
      }
    };
    this.timeoutId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    this.clock.start();
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;

      this.stepSimulation(dt, elapsed);
      this.retroPass.render(this.renderer, this.scene, this.camera, elapsed);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private getActiveWalkableHeight(
    x: number,
    z: number,
    refY: number,
    velY = 0,
    grounded = true
  ): number {
    if (!this.activeInterior) {
      return walkableHeightAt(x, z);
    }

    const surfaces = this.activeInterior.walkableSurfaces;
    const maxStepUp = grounded ? 0.36 : velY > 0.08 ? 0.05 : 0.18;
    let bestFlatH = -Infinity;
    let bestFlatScore = Infinity;
    let bestRampH = -Infinity;
    let bestRampScore = Infinity;

    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;

      let h = s.yStart;
      if (s.rampAxis === 'x' || s.rampAxis === 'z') {
        const t =
          s.rampAxis === 'x'
            ? THREE.MathUtils.clamp((x - s.minX) / Math.max(0.001, s.maxX - s.minX), 0, 1)
            : THREE.MathUtils.clamp((z - s.minZ) / Math.max(0.001, s.maxZ - s.minZ), 0, 1);

        if (s.stepCount && s.stairDir) {
          const u = s.stairDir > 0 ? t : 1 - t;
          const stepIdx = Math.min(s.stepCount - 1, Math.max(0, Math.floor(u * s.stepCount)));
          const yLow = Math.min(s.yStart, s.yEnd);
          const yHigh = Math.max(s.yStart, s.yEnd);
          h = yLow + ((stepIdx + 1) / s.stepCount) * (yHigh - yLow);
        } else {
          h = THREE.MathUtils.lerp(s.yStart, s.yEnd, t);
        }
      }

      if (h > refY + maxStepUp) continue;

      const score = Math.abs(h - refY);
      if (s.rampAxis !== undefined) {
        if (score < bestRampScore) {
          bestRampScore = score;
          bestRampH = h;
        }
      } else if (score < bestFlatScore) {
        bestFlatScore = score;
        bestFlatH = h;
      }
    }

    if (bestRampH !== -Infinity && (bestFlatH === -Infinity || bestRampH >= bestFlatH - 0.05)) {
      return bestRampH;
    }
    if (bestFlatH !== -Infinity) return bestFlatH;
    return bestRampH === -Infinity ? refY : bestRampH;
  }

  private stepSimulation(dt: number, elapsed: number): void {
    // 0. Transition fade timing & temporary status banner countdown
    if (this.transitionPhase === 'fadingOut') {
      this.transitionTimer += dt;
      if (this.transitionTimer >= 0.22 && this.pendingPortal) {
        const portal = this.pendingPortal;
        this.pendingPortal = null;
        this.executePortalTransition(portal);
        this.transitionPhase = 'fadingIn';
        this.transitionTimer = 0;
        this.callbacks.onTransitionChange?.(false);
      }
      return;
    } else if (this.transitionPhase === 'fadingIn') {
      this.transitionTimer += dt;
      if (this.transitionTimer >= 0.22) {
        this.transitionPhase = 'idle';
      }
    }

    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        this.callbacks.onStatusMessage?.(null);
      }
    }

    // 1. Keyboard camera yaw orbit (Q / E)
    const yawOrbitInput = (this.keys['KeyQ'] ? 1 : 0) - (this.keys['KeyE'] ? 1 : 0);
    if (yawOrbitInput !== 0) {
      this.targetCamYaw += yawOrbitInput * 1.9 * dt;
    }

    // 2. Smooth camera damping
    const camDamp = 1 - Math.exp(-11 * dt);
    this.camYaw += (this.targetCamYaw - this.camYaw) * camDamp;
    this.camPitch += (this.targetCamPitch - this.camPitch) * camDamp;
    this.camDistance += (this.targetCamDistance - this.camDistance) * camDamp;

    // Combat, gather & vitals cooldowns
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (this.gatherAnimTimer > 0) this.gatherAnimTimer = Math.max(0, this.gatherAnimTimer - dt);
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    }
    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);
      if (this.hurtFlashTimer === 0) this.emitVitals();
    }
    if (this.combatCooldownTimer > 0) {
      this.combatCooldownTimer = Math.max(0, this.combatCooldownTimer - dt);
      if (this.combatCooldownTimer === 0) this.emitVitals();
    } else if (this.playerHp < this.maxPlayerHp) {
      this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + 4.5 * dt);
      this.regenEmitAccum += dt;
      if (this.regenEmitAccum >= 0.25 || this.playerHp >= this.maxPlayerHp) {
        this.regenEmitAccum = 0;
        this.emitVitals();
      }
    }

    // 3. Movement relative to camera horizontal direction (paused during dialogue or UI panels)
    let inputX = 0;
    let inputZ = 0;
    if (!this.activeDialogue && !this.inputPaused) {
      if (this.keys['KeyW'] || this.keys['ArrowUp']) inputZ -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) inputZ += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) inputX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) inputX += 1;

      if (this.touchMove.magnitude > 0.05) {
        inputX += this.touchMove.x;
        inputZ += this.touchMove.y;
      }
    }

    const inputLen = Math.hypot(inputX, inputZ);
    const hasMove = inputLen > 0.05;

    const keyboardRun = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const touchRun = this.touchSprint || this.touchMove.magnitude > 0.72;
    const isRunning = hasMove && this.survivalSystem.canSprint() && (keyboardRun || touchRun);

    const maxSpeed = isRunning ? (this.activeInterior ? 5.2 : 6.4) : 3.45;
    const moveScale = hasMove ? Math.min(1, inputLen) : 0;

    if (hasMove) {
      const nx = inputX / inputLen;
      const nz = inputZ / inputLen;

      _camForward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).normalize();
      _camRight.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).normalize();

      _moveDir
        .set(0, 0, 0)
        .addScaledVector(_camForward, -nz)
        .addScaledVector(_camRight, nx)
        .normalize();

      const targetVx = _moveDir.x * maxSpeed * moveScale;
      const targetVz = _moveDir.z * maxSpeed * moveScale;

      const accel = this.isGrounded ? 10.5 : 4.2;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, accel, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, accel, dt);

      const desiredYaw = Math.atan2(_moveDir.x, _moveDir.z);
      const yawDiff = shortestAngleDiff(this.playerYaw, desiredYaw);
      const yawStep = yawDiff * (1 - Math.exp(-12 * dt));
      this.playerYaw += yawStep;
      this.turnAngularVel = THREE.MathUtils.damp(
        this.turnAngularVel,
        THREE.MathUtils.clamp(yawDiff, -1.6, 1.6),
        10,
        dt
      );
    } else {
      const decel = this.isGrounded ? 12.0 : 2.5;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, decel, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, decel, dt);
      this.turnAngularVel = THREE.MathUtils.damp(this.turnAngularVel, 0, 10, dt);
    }

    // 4. Coyote time, jump buffering & crisp gravity
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.jumpPreLaunchTimer > 0) {
      this.jumpPreLaunchTimer = Math.max(0, this.jumpPreLaunchTimer - dt);
    }
    if (this.landSquashTimer > 0) {
      this.landSquashTimer = Math.max(0, this.landSquashTimer - dt);
    }
    if (this.isGrounded) {
      this.coyoteTimer = 0.11;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVel.y = 6.35;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpPreLaunchTimer = 0.08;
      this.landSquashTimer = 0;
    }

    if (!this.isGrounded) {
      this.playerVel.y -= 18.5 * dt;
    }

    // 5. Horizontal movement + Slope (off-pad) & Ledge-Step & Y-filtered Obstacle Collision
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    let nextX = prevX + this.playerVel.x * dt;
    let nextZ = prevZ + this.playerVel.z * dt;

    if (!this.activeInterior) {
      const currH = walkableHeightAt(prevX, prevZ);
      const nextH = walkableHeightAt(nextX, nextZ);
      const onStructuredNext =
        landmarkFloorHeightAt(nextX, nextZ) !== null || bridgeDeckHeightAt(nextX, nextZ) !== null;
      const slopeBlocked =
        !onStructuredNext && rawTerrainSlopeAt(nextX, nextZ) > 0.72 && nextH > currH;
      const ledgeBlocked = nextH - currH > 0.38 && this.playerPos.y <= currH + 0.15;

      if (slopeBlocked || ledgeBlocked) {
        const hOnlyX = walkableHeightAt(nextX, prevZ);
        const structX =
          landmarkFloorHeightAt(nextX, prevZ) !== null ||
          bridgeDeckHeightAt(nextX, prevZ) !== null;
        const blockX =
          (!structX && rawTerrainSlopeAt(nextX, prevZ) > 0.72 && hOnlyX > currH) ||
          (hOnlyX - currH > 0.38 && this.playerPos.y <= currH + 0.15);
        if (blockX) nextX = prevX;

        const hOnlyZ = walkableHeightAt(prevX, nextZ);
        const structZ =
          landmarkFloorHeightAt(prevX, nextZ) !== null ||
          bridgeDeckHeightAt(prevX, nextZ) !== null;
        const blockZ =
          (!structZ && rawTerrainSlopeAt(prevX, nextZ) > 0.72 && hOnlyZ > currH) ||
          (hOnlyZ - currH > 0.38 && this.playerPos.y <= currH + 0.15);
        if (blockZ) nextZ = prevZ;
      }
    }

    const playerRadius = 0.42;
    const pFootY = this.playerPos.y;
    const pHeadY = this.playerPos.y + 1.55;
    const dynStructureCircles = this.buildingSystem.getActiveColliders();
    const expDynBoxes = this.explorationSystem.getDynamicBoxColliders();
    let colliders: CircleCollider[];
    let boxColliders: BoxCollider[];
    this.playerBoxCollidersBuf.length = 0;
    if (this.activeInterior) {
      this.playerDynCirclesBuf.length = 0;
      const baseInt = this.activeInterior.circleColliders;
      for (let i = 0; i < baseInt.length; i++) {
        this.playerDynCirclesBuf.push(baseInt[i]);
      }
      for (let i = 0; i < dynStructureCircles.length; i++) {
        this.playerDynCirclesBuf.push(dynStructureCircles[i]);
      }
      colliders = this.playerDynCirclesBuf;
      const baseIntBoxes = this.activeInterior.boxColliders;
      for (let i = 0; i < baseIntBoxes.length; i++) {
        this.playerBoxCollidersBuf.push(baseIntBoxes[i]);
      }
      for (let i = 0; i < expDynBoxes.length; i++) {
        this.playerBoxCollidersBuf.push(expDynBoxes[i]);
      }
      boxColliders = this.playerBoxCollidersBuf;
    } else {
      this.overworldColliderGrid.query(
        nextX,
        nextZ,
        this.nearbyCirclesBuf,
        this.nearbyBoxesBuf
      );
      for (let i = 0; i < dynStructureCircles.length; i++) {
        this.nearbyCirclesBuf.push(dynStructureCircles[i]);
      }
      colliders = this.nearbyCirclesBuf;
      for (let i = 0; i < this.nearbyBoxesBuf.length; i++) {
        this.playerBoxCollidersBuf.push(this.nearbyBoxesBuf[i]);
      }
      for (let i = 0; i < expDynBoxes.length; i++) {
        this.playerBoxCollidersBuf.push(expDynBoxes[i]);
      }
      boxColliders = this.playerBoxCollidersBuf;
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (c.maxY !== undefined && pFootY + 0.1 > c.maxY) continue;
        if (c.minY !== undefined && pHeadY < c.minY) continue;
        const dx = nextX - c.x;
        const dz = nextZ - c.z;
        const minDist = playerRadius + c.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const push = minDist - dist;
          nextX += (dx / dist) * push;
          nextZ += (dz / dist) * push;
        }
      }

      for (let i = 0; i < boxColliders.length; i++) {
        const b = boxColliders[i];
        if (b.maxY !== undefined && pFootY + 0.1 > b.maxY) continue;
        if (b.minY !== undefined && pHeadY < b.minY) continue;

        const cos = Math.cos(b.rotY);
        const sin = Math.sin(b.rotY);
        const dx = nextX - b.cx;
        const dz = nextZ - b.cz;
        let lx = dx * cos - dz * sin;
        let lz = dx * sin + dz * cos;

        const clampedX = THREE.MathUtils.clamp(lx, -b.halfW, b.halfW);
        const clampedZ = THREE.MathUtils.clamp(lz, -b.halfD, b.halfD);
        const diffX = lx - clampedX;
        const diffZ = lz - clampedZ;
        const distSq = diffX * diffX + diffZ * diffZ;

        if (distSq < playerRadius * playerRadius) {
          if (distSq > 0.000001) {
            const dist = Math.sqrt(distSq);
            const push = playerRadius - dist;
            lx += (diffX / dist) * push;
            lz += (diffZ / dist) * push;
          } else {
            const penX = b.halfW - Math.abs(lx);
            const penZ = b.halfD - Math.abs(lz);
            if (penX < penZ) {
              lx = (lx >= 0 ? 1 : -1) * (b.halfW + playerRadius);
            } else {
              lz = (lz >= 0 ? 1 : -1) * (b.halfD + playerRadius);
            }
          }
          nextX = b.cx + lx * cos + lz * sin;
          nextZ = b.cz - lx * sin + lz * cos;
        }
      }
    }

    const boundsRadius = this.activeInterior
      ? this.activeInterior.boundsRadius
      : PLAYABLE_BOUNDS_RADIUS;
    const distFromOrigin = Math.hypot(nextX, nextZ);
    if (distFromOrigin > boundsRadius) {
      const s = boundsRadius / distFromOrigin;
      nextX *= s;
      nextZ *= s;
    }

    this.playerPos.x = nextX;
    this.playerPos.z = nextZ;

    // 6. Ground snapping (supports terrain, bridges, and multi-floor interior stairs/slabs)
    const prevGroundY = this.playerPos.y;
    const wasGrounded = this.isGrounded;
    const preSnapVelY = this.playerVel.y;
    const groundY = this.getActiveWalkableHeight(
      this.playerPos.x,
      this.playerPos.z,
      this.playerPos.y,
      this.playerVel.y,
      this.isGrounded
    );
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= groundY) {
      if (!wasGrounded && preSnapVelY < -2.4) {
        this.landSquashTimer = 0.22;
      }
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else if (wasGrounded && this.playerPos.y - groundY < 0.34) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
    } else if (this.playerPos.y > groundY + 0.08) {
      this.isGrounded = false;
    }

    const stepDelta = this.playerPos.y - prevGroundY;
    if (
      wasGrounded &&
      this.isGrounded &&
      Math.abs(stepDelta) > 0.008 &&
      Math.abs(stepDelta) <= 0.36
    ) {
      this.visualStepOffset = THREE.MathUtils.clamp(
        this.visualStepOffset - stepDelta,
        -0.34,
        0.34
      );
    }
    this.visualStepOffset = THREE.MathUtils.damp(this.visualStepOffset, 0, 18, dt);

    this.playerRig.root.position.set(
      this.playerPos.x,
      this.playerPos.y + this.visualStepOffset,
      this.playerPos.z
    );
    this.playerRig.root.rotation.y = this.playerYaw;

    const heightAboveGround = Math.max(0, this.playerPos.y - groundY);
    this.playerRig.contactShadow.position.y = -heightAboveGround - this.visualStepOffset + 0.035;
    const shadowScale = THREE.MathUtils.clamp(1 - heightAboveGround * 0.25, 0.45, 1.0);
    this.playerRig.contactShadow.scale.setScalar(shadowScale);

    // 7. Procedural Character Gait Animation
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.animateCharacter(dt, elapsed, horizSpeed, isRunning);

    // 8. Update Camera Transform (with interior wall-occlusion pull-in)
    this.updateCameraTransform(dt);

    // 8b. Update Exploration System (24h Cycle, Secret Mechanisms, Treasures, Dynamic World Events)
    const activeStatePre = this.getActiveSaveState();
    const atmChanged = this.explorationSystem.update(dt, elapsed, {
      playerX: this.playerPos.x,
      playerY: this.playerPos.y,
      playerZ: this.playerPos.z,
      isInterior: !!this.activeInterior,
      devModeEnabled: this.devModeEnabled,
      overworldStaticCircles: this.world.colliders,
      overworldStaticBoxes: this.world.boxColliders,
      saveState: activeStatePre,
      updateSaveState: this.updateSaveState,
    });
    if (atmChanged) {
      this.callbacks.onAtmosphereChange?.(atmChanged);
    }
    const currentAtm = this.explorationSystem.getAtmosphereState();
    this.ecosystem.setNocturnalIntensity(currentAtm.nocturnalIntensity);

    // 9. Texel-snapped shadow frustum + Day/Night Exterior Atmosphere & Canopy Shade
    if (!this.activeInterior) {
      evaluateExteriorAtmosphereProfile(currentAtm, _extAtmProfile);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(_extAtmProfile.skyColor);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(_extAtmProfile.fogColor);
        this.scene.fog.density = _extAtmProfile.fogDensity;
      }
      this.scene.environmentIntensity = 0.72 * (1 - currentAtm.nocturnalIntensity * 0.35);

      const canopyShade =
        groveDensityAt(this.playerPos.x, this.playerPos.z) *
        (1 - pathMaskAt(this.playerPos.x, this.playerPos.z));
      const canopyFactor = 1 - canopyShade * 0.14;

      this.ambientLight.color.copy(_extAtmProfile.ambientColor);
      this.ambientLight.intensity = _extAtmProfile.ambientIntensity;
      this.hemiLight.color.copy(_extAtmProfile.hemiSky);
      this.hemiLight.groundColor.copy(_extAtmProfile.hemiGround);
      this.hemiLight.intensity = _extAtmProfile.hemiIntensity * (0.92 + 0.08 * canopyFactor);
      this.keyLight.color.copy(_extAtmProfile.keyColor);
      this.keyLight.intensity = _extAtmProfile.keyIntensity * canopyFactor;
      this.rimLight.intensity = _extAtmProfile.rimIntensity;

      this.renderer.toneMappingExposure = _extAtmProfile.exposure;
      this.retroPass.updateConfig({ exposure: _extAtmProfile.exposure });
      this.playerRig.lanternLight.distance = _extAtmProfile.lanternDistance;

      if (this.keyLight.castShadow) {
        const snapX = Math.round(this.playerPos.x);
        const snapZ = Math.round(this.playerPos.z);
        this.keyLight.position.set(snapX + 16, this.playerPos.y + 26, snapZ + 14);
        this.keyLight.target.position.set(snapX, this.playerPos.y, snapZ);
      }
    } else if (this.keyLight.castShadow) {
      this.keyLight.target.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    }

    // 10. Update Living Ecosystem (Animals, Creatures, Monsters & NPCs)
    const ecoBaseCircles = this.activeInterior
      ? this.activeInterior.circleColliders
      : this.world.colliders;
    this.ecosystemCirclesBuf.length = 0;
    for (let i = 0; i < ecoBaseCircles.length; i++) {
      this.ecosystemCirclesBuf.push(ecoBaseCircles[i]);
    }
    for (let i = 0; i < dynStructureCircles.length; i++) {
      this.ecosystemCirclesBuf.push(dynStructureCircles[i]);
    }

    this.ecosystem.update({
      dt,
      elapsed,
      playerX: this.playerPos.x,
      playerY: this.playerPos.y,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      playerSpeed: horizSpeed,
      lanternOn: this.lanternEnabled,
      isInterior: !!this.activeInterior,
      colliders: this.ecosystemCirclesBuf,
      boxColliders: this.activeInterior
        ? this.activeInterior.boxColliders
        : this.world.boxColliders,
      walkableSurfaces: this.activeInterior ? this.activeInterior.walkableSurfaces : null,
      boundsRadius,
      talkingNpcId: this.activeDialogue ? this.activeDialogue.npcId : null,
      onPlayerDamaged: (amount, knockX, knockZ) => {
        if (this.transitionPhase !== 'idle') return;
        const stats = this.equipmentSystem.getCombatStats(this.getActiveSaveState());
        const mitigated = Math.max(1, Math.round(amount * (1 - stats.defenseReduction)));
        this.playerHp = Math.max(0, this.playerHp - mitigated);
        this.hurtFlashTimer = 0.35;
        this.combatCooldownTimer = 5.0;
        this.playerVel.x += knockX;
        this.playerVel.z += knockZ;
        this.audio.playEcosystemCue('player_hurt');
        if (this.playerHp <= 0) {
          this.handlePlayerFallen();
        } else {
          this.emitVitals();
        }
      },
    });

    // 10b. Ghost Building Preview & Survival Vitals (Stamina / Warmth / Stations)
    if (this.buildingSystem.isPlacementActive()) {
      this.updateGhostPlacement();
      this.emitPlacementIfChanged();
    }

    const activeState = this.getActiveSaveState();
    const warmthEnv = this.buildingSystem.getWarmthEnvironment(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z
    );
    const nearbyStations = this.buildingSystem.getNearbyStations(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z
    );
    const armorWarmth = this.equipmentSystem.getCombatStats(activeState).warmthBonus;
    if (
      this.survivalSystem.update(
        dt,
        isRunning,
        horizSpeed > 0.25,
        !!this.activeInterior,
        warmthEnv.nearFire,
        warmthEnv.inShelter,
        armorWarmth,
        nearbyStations
      )
    ) {
      this.emitSurvival();
    }

    // 11. Dynamic 6-Light Pooling for active exterior/interior torches + glowing wisps/spirits + placed structures
    this.updateNearestWorldLights(elapsed);

    // 12. World Zone Culling, Resources, Embers, Mist & Shader Time
    if (!this.activeInterior) {
      this.world.windUniforms.uTime.value = elapsed;
      this.world.crowGroup.rotation.y = elapsed * 0.26;
      this.world.updateVisibility(this.playerPos.x, this.playerPos.z, elapsed);
      this.resourceManager.update(
        dt,
        this.playerPos.x,
        this.playerPos.z,
        activeState
      );
    }

    const activeEmbers = this.activeInterior
      ? this.activeInterior.embers
      : this.world.embers;
    for (let i = 0; i < activeEmbers.length; i++) {
      const em = activeEmbers[i];
      if (!em.ember.visible) continue;
      const flicker =
        0.9 +
        0.1 * Math.sin(elapsed * 7.2 + em.phase) +
        0.05 * Math.cos(elapsed * 13.7 + em.phase * 1.7);
      const bs = em.baseScale;
      const sx = bs ? bs[0] : 1.15;
      const sy = bs ? bs[1] : 0.58;
      const sz = bs ? bs[2] : 1.15;
      em.ember.scale.set(
        sx * (0.94 + flicker * 0.08),
        sy * (0.88 + flicker * 0.16),
        sz * (0.94 + flicker * 0.08)
      );
    }

    const builtEmbers = this.buildingSystem.getActiveEmbers();
    for (let i = 0; i < builtEmbers.length; i++) {
      const em = builtEmbers[i];
      const flicker =
        0.9 +
        0.1 * Math.sin(elapsed * 7.6 + em.phase) +
        0.06 * Math.cos(elapsed * 14.3 + em.phase * 1.5);
      const bs = em.baseScale;
      const sx = bs ? bs[0] : 1.0;
      const sy = bs ? bs[1] : 1.0;
      const sz = bs ? bs[2] : 1.0;
      em.ember.scale.set(
        sx * (0.94 + flicker * 0.08),
        sy * (0.88 + flicker * 0.18),
        sz * (0.94 + flicker * 0.08)
      );
    }

    if (this.lanternEnabled) {
      const baseInt = this.activeInterior
        ? this.activeInterior.lighting.lanternIntensity
        : 1.45 * _extAtmProfile.lanternBoost;
      const lanternFlicker =
        0.92 + 0.08 * Math.sin(elapsed * 8.4) + 0.05 * Math.cos(elapsed * 14.1);
      this.playerRig.lanternLight.intensity = baseInt * lanternFlicker;
    }

    // 13. Zone Discovery, Interaction Prompt & Audio Update
    this.updateActiveZone();
    this.updateInteractionPrompt();
    const onPath = this.activeInterior
      ? true
      : pathMaskAt(this.playerPos.x, this.playerPos.z) > 0.45;
    this.audio.update(elapsed, dt, horizSpeed, this.isGrounded, onPath);
  }

  private handlePlayerFallen(): void {
    this.closeDialogue();
    this.cancelStructurePlacement();
    this.callbacks.onStashModalChange?.(false);
    this.playerHp = this.maxPlayerHp;
    this.survivalSystem.applyRestRestore();
    this.hurtFlashTimer = 0;
    this.combatCooldownTimer = 0;
    this.playerVel.set(0, 0, 0);

    if (this.activeInterior) {
      this.scene.remove(this.activeInterior.group);
      this.activeInterior.dispose();
      this.activeInterior = null;
      this.ecosystem.unloadInterior();
      this.worldRoot.visible = true;
      this.applyExteriorEnvironment();
      this.exteriorReturn = null;
      this.buildingSystem.syncForEnvironment('overworld', this.getActiveSaveState());
      this.explorationSystem.syncForEnvironment('overworld', this.getActiveSaveState());
    }

    this.playerPos.set(0, walkableHeightAt(0, 5.2), 5.2);
    this.playerYaw = Math.PI;
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.camYaw = this.playerYaw + Math.PI;
    this.targetCamYaw = this.camYaw;
    this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.44, this.playerPos.z);
    this.updateCameraTransform(1.0);
    this.emitVitals();
    this.emitSurvival();
    this.showStatusMessage('Overwhelmed in the dark — awakened at The Moss Clearing');
  }

  private updateNearestWorldLights(elapsed: number): void {
    const baseAnchors = this.activeInterior
      ? this.activeInterior.lightAnchors
      : this.world.lightAnchors;
    const entityAnchors = this.ecosystem.getDynamicLightAnchors(!!this.activeInterior);
    const builtAnchors = this.buildingSystem.getActiveLightAnchors();
    const explorationAnchors = this.explorationSystem.getActiveLightAnchors(
      !!this.activeInterior
    );

    this.combinedLightAnchors.length = 0;
    for (let i = 0; i < baseAnchors.length; i++) {
      this.combinedLightAnchors.push(baseAnchors[i]);
    }
    for (let i = 0; i < entityAnchors.length; i++) {
      this.combinedLightAnchors.push(entityAnchors[i]);
    }
    for (let i = 0; i < builtAnchors.length; i++) {
      this.combinedLightAnchors.push(builtAnchors[i]);
    }
    for (let i = 0; i < explorationAnchors.length; i++) {
      this.combinedLightAnchors.push(explorationAnchors[i]);
    }

    this.lightPoolSortBuf.length = 0;
    for (let i = 0; i < this.combinedLightAnchors.length; i++) {
      const a = this.combinedLightAnchors[i];
      if (a.baseIntensity <= 0.01) continue;
      const dx = a.x - this.playerPos.x;
      const dy = a.y - (this.playerPos.y + 1.0);
      const dz = a.z - this.playerPos.z;
      this.lightPoolSortBuf.push({ idx: i, distSq: dx * dx + dy * dy + dz * dz });
    }
    this.lightPoolSortBuf.sort((a, b) => a.distSq - b.distSq);

    for (let p = 0; p < this.worldLightPool.length; p++) {
      const light = this.worldLightPool[p];
      if (p >= this.lightPoolSortBuf.length) {
        light.intensity = 0;
        continue;
      }
      const a = this.combinedLightAnchors[this.lightPoolSortBuf[p].idx];
      light.color.set(a.color);
      light.position.set(a.x, a.y, a.z);
      light.distance = a.distance;
      const flicker =
        0.88 +
        0.12 * Math.sin(elapsed * 7.2 + a.phase) +
        0.06 * Math.cos(elapsed * 13.7 + a.phase * 1.7);
      light.intensity = a.baseIntensity * flicker;
    }
  }

  private animateCharacter(dt: number, elapsed: number, speed: number, isRunning: boolean): void {
    const rig = this.playerRig;
    const moveBlend = THREE.MathUtils.clamp(speed / 3.4, 0, 1);
    const runBlend = isRunning ? THREE.MathUtils.clamp((speed - 3.0) / 2.8, 0, 1) : 0;

    if (speed > 0.2 && this.isGrounded) {
      const freq = THREE.MathUtils.lerp(7.2, 11.2, runBlend);
      this.walkCycle += dt * freq;
    } else if (this.isGrounded) {
      this.walkCycle = THREE.MathUtils.damp(
        this.walkCycle,
        Math.round(this.walkCycle / Math.PI) * Math.PI,
        7,
        dt
      );
    }

    const sPhase = Math.sin(this.walkCycle);
    const cPhase = Math.cos(this.walkCycle);
    const swingAmp = THREE.MathUtils.lerp(0.56, 0.88, runBlend) * moveBlend;
    const legSwing = sPhase * swingAmp;
    const armSwing = sPhase * swingAmp * THREE.MathUtils.lerp(0.76, 0.96, runBlend);

    // Asymmetric knee flexion: heel-toe swing bends knee on lift, extends straight on support
    const leftKneeSwing =
      (Math.max(0, -sPhase) * THREE.MathUtils.lerp(0.68, 1.05, runBlend) +
        Math.max(0, cPhase) * 0.14) *
      moveBlend;
    const rightKneeSwing =
      (Math.max(0, sPhase) * THREE.MathUtils.lerp(0.68, 1.05, runBlend) +
        Math.max(0, cPhase) * 0.14) *
      moveBlend;

    const strideBob =
      Math.abs(cPhase) * THREE.MathUtils.lerp(0.048, 0.095, runBlend) * moveBlend;
    const idleBreath = Math.sin(elapsed * 2.05) * 0.016 * (1 - moveBlend);
    const weightShiftZ = Math.sin(elapsed * 0.95) * 0.025 * (1 - moveBlend);

    if (!this.isGrounded) {
      // Multi-phase airborne jump: launch extension -> apex tuck -> fall brace
      const riseFactor = THREE.MathUtils.clamp(this.playerVel.y / 6.0, -1, 1);
      const isLaunching = this.jumpPreLaunchTimer > 0 || riseFactor > 0.15;

      const targetLeftHip = isLaunching ? -0.58 : -0.35;
      const targetRightHip = isLaunching ? 0.36 : -0.15;
      const targetLeftKnee = isLaunching ? 0.82 : 0.62;
      const targetRightKnee = isLaunching ? 0.28 : 0.48;
      const targetArmX = isLaunching ? -0.78 : -0.38;
      const targetElbowX = isLaunching ? -0.55 : -0.45;
      const capeTarget = THREE.MathUtils.clamp(
        0.48 + Math.max(0, -this.playerVel.y) * 0.06,
        0.42,
        0.85
      );

      rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, targetLeftHip, 12, dt);
      rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, targetRightHip, 12, dt);
      rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(rig.leftKneePivot.rotation.x, targetLeftKnee, 12, dt);
      rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(rig.rightKneePivot.rotation.x, targetRightKnee, 12, dt);
      rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, targetArmX, 11, dt);
      rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, targetArmX * 0.85, 11, dt);
      rig.leftForearmPivot.rotation.x = THREE.MathUtils.damp(rig.leftForearmPivot.rotation.x, targetElbowX, 11, dt);
      rig.rightForearmPivot.rotation.x = THREE.MathUtils.damp(rig.rightForearmPivot.rotation.x, targetElbowX, 11, dt);
      rig.torso.rotation.x = THREE.MathUtils.damp(
        rig.torso.rotation.x,
        isLaunching ? 0.18 : -0.05,
        9,
        dt
      );
      rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, 0.02, 10, dt);
      rig.pelvisPivot.rotation.z = THREE.MathUtils.damp(rig.pelvisPivot.rotation.z, 0, 10, dt);
      rig.cape.rotation.x = THREE.MathUtils.damp(rig.cape.rotation.x, capeTarget, 9, dt);
      rig.neckPivot.rotation.x = THREE.MathUtils.damp(
        rig.neckPivot.rotation.x,
        isLaunching ? -0.1 : 0.12,
        9,
        dt
      );
    } else {
      // Landing knee squash absorption curve (0 -> peak -> 0 over 0.22s)
      const squashWave =
        this.landSquashTimer > 0
          ? Math.sin((1 - this.landSquashTimer / 0.22) * Math.PI)
          : 0;

      const targetLeftHip = legSwing - squashWave * 0.28;
      const targetRightHip = -legSwing - squashWave * 0.28;
      const targetLeftKnee = leftKneeSwing + squashWave * 0.56 + 0.04 * (1 - moveBlend);
      const targetRightKnee = rightKneeSwing + squashWave * 0.56 + 0.04 * (1 - moveBlend);

      rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, targetLeftHip, 15, dt);
      rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, targetRightHip, 15, dt);
      rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(rig.leftKneePivot.rotation.x, targetLeftKnee, 15, dt);
      rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(rig.rightKneePivot.rotation.x, targetRightKnee, 15, dt);

      const armSpreadOut = squashWave * 0.22;
      const idleArmHang = 0.05 + Math.sin(elapsed * 2.05 + 0.4) * 0.03 * (1 - moveBlend);
      rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        rig.leftArmPivot.rotation.x,
        -armSwing + idleArmHang,
        14,
        dt
      );
      rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        rig.rightArmPivot.rotation.x,
        armSwing + idleArmHang,
        14,
        dt
      );
      rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(rig.leftArmPivot.rotation.z, armSpreadOut, 12, dt);

      const targetLeftElbow =
        -0.16 * (1 - moveBlend) -
        (0.24 + Math.max(0, -armSwing) * THREE.MathUtils.lerp(0.45, 0.72, runBlend)) * moveBlend -
        squashWave * 0.35;
      const targetRightElbow =
        -0.18 * (1 - moveBlend) -
        (0.24 + Math.max(0, armSwing) * THREE.MathUtils.lerp(0.45, 0.72, runBlend)) * moveBlend -
        squashWave * 0.35;

      rig.leftForearmPivot.rotation.x = THREE.MathUtils.damp(rig.leftForearmPivot.rotation.x, targetLeftElbow, 14, dt);
      rig.rightForearmPivot.rotation.x = THREE.MathUtils.damp(rig.rightForearmPivot.rotation.x, targetRightElbow, 14, dt);

      const lean =
        THREE.MathUtils.lerp(0.08, 0.22, runBlend) * moveBlend +
        squashWave * 0.16 +
        Math.sin(elapsed * 2.05) * 0.014 * (1 - moveBlend);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, lean, 12, dt);
      rig.torso.rotation.z = THREE.MathUtils.damp(
        rig.torso.rotation.z,
        -this.turnAngularVel * 0.12 * moveBlend,
        10,
        dt
      );

      rig.pelvisPivot.rotation.z = THREE.MathUtils.damp(
        rig.pelvisPivot.rotation.z,
        weightShiftZ + sPhase * 0.04 * moveBlend,
        10,
        dt
      );
      rig.pelvisPivot.rotation.y = THREE.MathUtils.damp(
        rig.pelvisPivot.rotation.y,
        -sPhase * 0.08 * moveBlend,
        12,
        dt
      );

      rig.bodyPivot.position.y = THREE.MathUtils.damp(
        rig.bodyPivot.position.y,
        strideBob + idleBreath - squashWave * 0.11,
        18,
        dt
      );

      const capeTarget =
        0.14 +
        THREE.MathUtils.lerp(0.16, 0.42, runBlend) * moveBlend +
        Math.sin(elapsed * 3.1 + this.walkCycle * 0.35) * (0.032 + 0.04 * runBlend);
      rig.cape.rotation.x = THREE.MathUtils.damp(rig.cape.rotation.x, capeTarget, 9, dt);
      rig.neckPivot.rotation.x = THREE.MathUtils.damp(
        rig.neckPivot.rotation.x,
        -lean * 0.35 + Math.sin(elapsed * 1.1) * 0.025 * (1 - moveBlend),
        9,
        dt
      );
    }

    rig.lanternPivot.rotation.x =
      Math.sin(elapsed * 2.7 + this.walkCycle * 0.5) * (0.05 + 0.15 * moveBlend) +
      THREE.MathUtils.clamp(-this.playerVel.y * 0.04, -0.25, 0.25);
    rig.lanternPivot.rotation.z =
      Math.cos(elapsed * 2.1) * (0.04 + 0.08 * moveBlend) - this.turnAngularVel * 0.08;
    rig.headPivot.rotation.y = THREE.MathUtils.damp(
      rig.headPivot.rotation.y,
      Math.sin(elapsed * 0.72) * 0.09 * (1 - moveBlend) + this.turnAngularVel * 0.18,
      7,
      dt
    );

    // Drawn Sword / Equipped Gear Swing or Gathering Reach Animation
    if (this.attackAnimTimer > 0) {
      const p = 1 - this.attackAnimTimer / 0.34;
      this.equipmentSystem.syncRigCombatPose(true, false);
      const swingAngle = THREE.MathUtils.lerp(-1.95, 0.78, Math.min(1, p * 1.35));
      rig.rightArmPivot.rotation.x = swingAngle;
      rig.rightArmPivot.rotation.z = -0.35 + Math.sin(p * Math.PI) * 0.45;
      rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(-0.9, -0.12, Math.min(1, p * 1.35));
      rig.torso.rotation.y = Math.sin(p * Math.PI) * -0.32;
    } else if (this.gatherAnimTimer > 0) {
      const p = Math.sin((1 - this.gatherAnimTimer / 0.24) * Math.PI);
      this.equipmentSystem.syncRigCombatPose(false, true);
      rig.rightArmPivot.rotation.x = -0.95 * p;
      rig.rightForearmPivot.rotation.x = -0.55 * p;
      rig.torso.rotation.x = THREE.MathUtils.lerp(rig.torso.rotation.x, 0.26 * p, 0.65);
    } else {
      this.equipmentSystem.syncRigCombatPose(false, false);
      rig.rightArmPivot.rotation.z = THREE.MathUtils.damp(rig.rightArmPivot.rotation.z, 0, 10, dt);
      rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, 0, 10, dt);
    }
  }

  private updateCameraTransform(dt: number): void {
    _targetLook.set(
      this.playerPos.x,
      this.playerPos.y + this.visualStepOffset + 1.44,
      this.playerPos.z
    );
    const lookAlpha = dt >= 1 ? 1 : 1 - Math.exp(-12 * dt);
    this.smoothLookAt.lerp(_targetLook, lookAlpha);

    const horizDist = Math.cos(this.camPitch) * this.camDistance;
    const vertDist = Math.sin(this.camPitch) * this.camDistance;

    _desiredCamPos.set(
      this.smoothLookAt.x + Math.sin(this.camYaw) * horizDist,
      this.smoothLookAt.y + vertDist,
      this.smoothLookAt.z + Math.cos(this.camYaw) * horizDist
    );

    if (!this.activeInterior) {
      const camGround = walkableHeightAt(_desiredCamPos.x, _desiredCamPos.z);
      if (_desiredCamPos.y < camGround + 0.65) {
        _desiredCamPos.y = camGround + 0.65;
      }
    } else if (this.activeInterior.cameraOccluders.length > 0) {
      _camRayDir.subVectors(_desiredCamPos, this.smoothLookAt);
      const rayLen = _camRayDir.length();
      if (rayLen > 0.1) {
        _camRayDir.multiplyScalar(1 / rayLen);
        _camRaycaster.set(this.smoothLookAt, _camRayDir);
        _camRaycaster.near = 0.2;
        _camRaycaster.far = rayLen;
        const hits = _camRaycaster.intersectObjects(this.activeInterior.cameraOccluders, false);
        if (hits.length > 0) {
          const pullDist = Math.max(1.15, hits[0].distance - 0.35);
          _desiredCamPos.copy(this.smoothLookAt).addScaledVector(_camRayDir, pullDist);
        }
      }
    }

    const posAlpha = dt >= 1 ? 1 : 1 - Math.exp(-14 * dt);
    this.camera.position.lerp(_desiredCamPos, posAlpha);
    this.camera.lookAt(this.smoothLookAt);
  }

  private updateActiveZone(): void {
    if (this.activeInterior) return;

    let foundId = '';
    let foundName = 'Deep Pine Woods';
    for (let i = 0; i < LANDMARK_ZONES.length; i++) {
      const z = LANDMARK_ZONES[i];
      if (Math.hypot(this.playerPos.x - z.x, this.playerPos.z - z.z) <= z.radius) {
        foundId = z.id;
        foundName = z.name;
        break;
      }
    }

    if (foundId) {
      this.markPlaceDiscovered(foundId, foundName);
    }

    if (foundName !== this.currentZoneName) {
      this.currentZoneName = foundName;
      this.callbacks.onZoneChange?.(foundName);
    }
  }

  private updateInteractionPrompt(): void {
    let bestAction: ActiveInteractAction | null = null;
    let bestDistSq = Infinity;

    const portals = this.activeInterior
      ? this.activeInterior.portals
      : this.world.portals;
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      if (Math.abs(this.playerPos.y - p.y) > 2.0) continue;
      const dSq =
        (this.playerPos.x - p.x) * (this.playerPos.x - p.x) +
        (this.playerPos.z - p.z) * (this.playerPos.z - p.z);
      if (dSq <= p.radius * p.radius && dSq < bestDistSq) {
        bestDistSq = dSq;
        bestAction = {
          kind: 'portal',
          portal: p,
          prompt: { id: p.id, label: p.label, kind: 'portal' },
        };
      }
    }

    if (this.activeInterior) {
      const items = this.activeInterior.interactables;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.isAvailable && !it.isAvailable()) continue;
        if (Math.abs(this.playerPos.y - it.y) > 1.8) continue;
        const dSq =
          (this.playerPos.x - it.x) * (this.playerPos.x - it.x) +
          (this.playerPos.z - it.z) * (this.playerPos.z - it.z);
        if (dSq <= it.radius * it.radius && dSq < bestDistSq) {
          bestDistSq = dSq;
          bestAction = {
            kind: 'interactable',
            cueKind: it.kind,
            run: it.onActivate,
            prompt: { id: it.id, label: it.label, kind: it.kind },
          };
        }
      }
    } else if (!this.activeDialogue) {
      const node = this.resourceManager.findNearestInteractableNode(
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z,
        this.getActiveSaveState()
      );
      if (node) {
        const dSq =
          (this.playerPos.x - node.x) * (this.playerPos.x - node.x) +
          (this.playerPos.z - node.z) * (this.playerPos.z - node.z);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          const verb = node.isFoundItem ? 'Take' : 'Gather';
          bestAction = {
            kind: 'resource',
            nodeId: node.id,
            isFoundItem: !!node.isFoundItem,
            prompt: {
              id: node.id,
              label: `${verb} ${node.label}`,
              kind: node.isFoundItem ? 'found_item' : 'resource',
            },
          };
        }
      }
    }

    if (!this.activeDialogue) {
      const nearStructure = this.buildingSystem.findNearestInteractableStructure(
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z
      );
      if (nearStructure) {
        const dSq = nearStructure.distance * nearStructure.distance;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestAction = {
            kind: 'structure',
            structureInfo: nearStructure,
            prompt: {
              id: nearStructure.record.id,
              label: `${nearStructure.def.interactionVerb} (${nearStructure.def.name})`,
              kind: 'structure',
            },
          };
        }
      }

      const expHit = this.explorationSystem.findNearestInteractable(
        this.getActiveEnvironmentId(),
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z,
        () => this.getActiveSaveState(),
        this.updateSaveState
      );
      if (expHit && expHit.distSq < bestDistSq) {
        bestDistSq = expHit.distSq;
        bestAction = {
          kind: 'exploration',
          expKind: expHit.kind,
          run: expHit.activate,
          prompt: {
            id: expHit.id,
            label: expHit.label,
            kind: expHit.kind,
          },
        };
      }

      const npcHit = this.ecosystem.findNearestInteractableNpc(
        !!this.activeInterior,
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z
      );
      if (npcHit && !bestAction) {
        bestAction = {
          kind: 'npc',
          npcId: npcHit.npcId,
          prompt: { id: npcHit.npcId, label: npcHit.label, kind: 'npc' },
        };
      }
    } else {
      bestAction = null;
    }

    this.currentInteractAction = bestAction;
    const key = bestAction ? `${bestAction.prompt.id}:${bestAction.prompt.label}` : '';
    if (key !== this.lastPromptKey) {
      this.lastPromptKey = key;
      this.callbacks.onInteractPromptChange?.(bestAction ? bestAction.prompt : null);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.timeoutId);
    this.unbindEvents();
    this.explorationSystem.dispose();
    this.buildingSystem.dispose();
    this.equipmentSystem.dispose();
    this.resourceManager.dispose();
    this.ecosystem.dispose();
    this.audio.dispose();
    this.retroPass.dispose();

    if (this.activeInterior) {
      this.scene.remove(this.activeInterior.group);
      this.activeInterior.dispose();
      this.activeInterior = null;
    }

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.textures.dispose();
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
