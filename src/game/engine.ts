import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ForestAudioSystem } from './audio';
import { buildInteriorById } from './interiors';
import { createWandererCharacter } from './models';
import {
  clearWorldSave,
  DISCOVERABLE_CATALOG,
  loadWorldSave,
  persistWorldSave,
  TOTAL_DISCOVERABLE_PLACES,
  WORLD_SEED,
} from './persistence';
import { RetroCompositePass } from './retroPass';
import {
  groundSlopeAt,
  groveDensityAt,
  LANDMARK_ZONES,
  pathMaskAt,
  PLAYABLE_BOUNDS_RADIUS,
  walkableHeightAt,
} from './terrain';
import { createProceduralTextures, ProceduralTextures } from './textures';
import {
  BoxCollider,
  CircleCollider,
  EngineCallbacks,
  GraphicsQuality,
  InteriorInstance,
  InteractPrompt,
  PortalLink,
  ThornvaleSaveState,
  TouchMoveInput,
  WandererRig,
} from './types';
import { buildForestWorld, WorldBuildResult } from './world';

const _moveDir = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _camRayDir = new THREE.Vector3();
const _camRaycaster = new THREE.Raycaster();

const EXTERIOR_BG = new THREE.Color('#66737d');
const EXTERIOR_FOG_COLOR = '#66737d';
const EXTERIOR_FOG_DENSITY = 0.027;

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
      cueKind: 'door' | 'brazier' | 'relic' | 'secret';
      run: () => string | void;
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
  private activeInterior: InteriorInstance | null = null;
  private playerRig: WandererRig;

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private worldLightPool: THREE.PointLight[] = [];
  private lightPoolSortBuf: { idx: number; distSq: number }[] = [];

  private audio: ForestAudioSystem;
  private saveState: ThornvaleSaveState;

  private quality: GraphicsQuality;
  private vhsEnabled = true;

  // Animation loop state
  private clock = new THREE.Clock();
  private frameId = 0;
  private timeoutId = 0;
  private disposed = false;

  // Character physics & animation state
  private playerPos = new THREE.Vector3(0, 0, 5.2);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = Math.PI;
  private isGrounded = true;
  private walkCycle = 0;
  private lanternEnabled = true;

  // Exterior return cache when inside an interior
  private exteriorReturn: { x: number; y: number; z: number; yaw: number } | null = null;

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
  private jumpRequested = false;

  // Mouse & touch drag camera orbit state
  private isDraggingCamera = false;
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

    // 4. Camera (far plane covers outer mountain & citadel silhouettes)
    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.15, 210);

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

    this.playerRig = createWandererCharacter(this.textures);
    this.playerPos.y = walkableHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);

    this.smoothLookAt.set(this.playerPos.x, this.playerPos.y + 1.42, this.playerPos.z);
    this.updateCameraTransform(1.0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.callbacks.onZoneChange?.(this.currentZoneName);
    this.callbacks.onQualityChange?.(this.quality);
    this.callbacks.onSaveStateChange?.(this.saveState);
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
    if (e.code === 'Space') {
      this.jumpRequested = true;
    } else if (e.code === 'KeyL') {
      this.toggleLantern();
    } else if (e.code === 'KeyR') {
      this.resetCamera();
    } else if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) {
      this.triggerInteract();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.isDraggingCamera = true;
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

  private onMouseUp = (): void => {
    this.isDraggingCamera = false;
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
    this.jumpRequested = true;
  }

  public triggerInteract(): void {
    if (this.transitionPhase !== 'idle' || !this.currentInteractAction) return;
    if (this.currentInteractAction.kind === 'portal') {
      const portal = this.currentInteractAction.portal;
      this.pendingPortal = portal;
      this.transitionPhase = 'fadingOut';
      this.transitionTimer = 0;
      this.audio.playTransitionCue(portal.transitionKind);
      this.callbacks.onTransitionChange?.(true, portal.label);
    } else {
      const msg = this.currentInteractAction.run();
      this.audio.playInteractCue(this.currentInteractAction.cueKind);
      if (typeof msg === 'string' && msg.length > 0) {
        this.showStatusMessage(msg);
      }
      this.updateInteractionPrompt();
    }
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

  public resetWorldSave(): void {
    this.saveState = clearWorldSave(WORLD_SEED);
    this.callbacks.onSaveStateChange?.(this.saveState);
    this.showStatusMessage('Exploration ledger cleared');
  }

  // --- Persistence & Discovery ---

  private updateSaveState = (
    updater: (prev: ThornvaleSaveState) => ThornvaleSaveState
  ): void => {
    this.saveState = updater(this.saveState);
    persistWorldSave(this.saveState);
    this.callbacks.onSaveStateChange?.(this.saveState);
  };

  private markPlaceDiscovered(id: string, displayName?: string): void {
    const entry = DISCOVERABLE_CATALOG.find((item) => item.id === id);
    if (!entry) return;
    if (this.saveState.discoveredIds.includes(id)) return;
    const nextIds = [...this.saveState.discoveredIds, id];
    this.updateSaveState((prev) => ({
      ...prev,
      discoveredIds: nextIds,
    }));
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
    if (portal.targetId === 'overworld') {
      // Unload interior and restore exterior forest world cleanly
      if (this.activeInterior) {
        this.scene.remove(this.activeInterior.group);
        this.activeInterior.dispose();
        this.activeInterior = null;
      }
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
        this.saveState,
        this.updateSaveState
      );
      this.activeInterior = built;
      this.worldRoot.visible = false;
      this.scene.add(built.group);
      this.applyInteriorEnvironment(built);

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
    this.scene.background = EXTERIOR_BG.clone();
    this.scene.fog = new THREE.FogExp2(EXTERIOR_FOG_COLOR, EXTERIOR_FOG_DENSITY);
    this.scene.environmentIntensity = 0.72;

    this.ambientLight.color.set('#8f9ca6');
    this.ambientLight.intensity = 0.55;
    this.hemiLight.color.set('#bfd0de');
    this.hemiLight.groundColor.set('#435045');
    this.hemiLight.intensity = 1.65;
    this.keyLight.color.set('#dce4eb');
    this.keyLight.intensity = 1.75;
    this.rimLight.intensity = 0.72;

    this.renderer.toneMappingExposure = 1.25;
    this.retroPass.updateConfig({ exposure: 1.25 });
    this.playerRig.lanternLight.distance = 9;
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

  private getActiveWalkableHeight(x: number, z: number, refY: number): number {
    if (!this.activeInterior) {
      return walkableHeightAt(x, z);
    }

    const surfaces = this.activeInterior.walkableSurfaces;
    let bestH = -Infinity;
    let bestScore = Infinity;

    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;

      let h = s.yStart;
      if (s.rampAxis === 'x') {
        const t = THREE.MathUtils.clamp((x - s.minX) / Math.max(0.001, s.maxX - s.minX), 0, 1);
        h = THREE.MathUtils.lerp(s.yStart, s.yEnd, t);
      } else if (s.rampAxis === 'z') {
        const t = THREE.MathUtils.clamp((z - s.minZ) / Math.max(0.001, s.maxZ - s.minZ), 0, 1);
        h = THREE.MathUtils.lerp(s.yStart, s.yEnd, t);
      }

      if (h > refY + 0.62) continue;

      let score = Math.abs(h - refY);
      // Slight ramp preference when stepping upward onto stairs from a flat landing
      if (s.rampAxis !== undefined && h >= refY - 0.12 && h <= refY + 0.45) {
        score *= 0.45;
      }
      if (score < bestScore) {
        bestScore = score;
        bestH = h;
      }
    }

    return bestH === -Infinity ? refY : bestH;
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

    // 3. Movement relative to camera horizontal direction
    let inputX = 0;
    let inputZ = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) inputZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) inputZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) inputX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) inputX += 1;

    if (this.touchMove.magnitude > 0.05) {
      inputX += this.touchMove.x;
      inputZ += this.touchMove.y;
    }

    const inputLen = Math.hypot(inputX, inputZ);
    const hasMove = inputLen > 0.05;

    const keyboardRun = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const touchRun = this.touchSprint || this.touchMove.magnitude > 0.72;
    const isRunning = hasMove && (keyboardRun || touchRun);

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
      this.playerYaw += yawDiff * (1 - Math.exp(-12 * dt));
    } else {
      const decel = this.isGrounded ? 12.0 : 2.5;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, decel, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, decel, dt);
    }

    // 4. Jump & gravity
    if (this.jumpRequested && this.isGrounded) {
      this.playerVel.y = 6.2;
      this.isGrounded = false;
    }
    this.jumpRequested = false;

    if (!this.isGrounded) {
      this.playerVel.y -= 18.0 * dt;
    }

    // 5. Horizontal movement + Slope (outdoors) & Y-filtered Obstacle Collision
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    let nextX = prevX + this.playerVel.x * dt;
    let nextZ = prevZ + this.playerVel.z * dt;

    if (!this.activeInterior) {
      const currH = walkableHeightAt(prevX, prevZ);
      const nextH = walkableHeightAt(nextX, nextZ);
      const nextSlope = groundSlopeAt(nextX, nextZ);
      if (nextSlope > 0.72 && nextH > currH) {
        const hOnlyX = walkableHeightAt(nextX, prevZ);
        const sOnlyX = groundSlopeAt(nextX, prevZ);
        if (sOnlyX > 0.72 && hOnlyX > currH) nextX = prevX;

        const hOnlyZ = walkableHeightAt(prevX, nextZ);
        const sOnlyZ = groundSlopeAt(prevX, nextZ);
        if (sOnlyZ > 0.72 && hOnlyZ > currH) nextZ = prevZ;
      }
    }

    const playerRadius = 0.42;
    const pFootY = this.playerPos.y;
    const pHeadY = this.playerPos.y + 1.55;
    const colliders: CircleCollider[] = this.activeInterior
      ? this.activeInterior.circleColliders
      : this.world.colliders;
    const boxColliders: BoxCollider[] = this.activeInterior
      ? this.activeInterior.boxColliders
      : this.world.boxColliders;

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
    const groundY = this.getActiveWalkableHeight(
      this.playerPos.x,
      this.playerPos.z,
      this.playerPos.y
    );
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= groundY) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else if (this.isGrounded && this.playerPos.y - groundY < 0.35) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
    } else if (this.playerPos.y > groundY + 0.08) {
      this.isGrounded = false;
    }

    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;

    const heightAboveGround = Math.max(0, this.playerPos.y - groundY);
    this.playerRig.contactShadow.position.y = -heightAboveGround + 0.035;
    const shadowScale = THREE.MathUtils.clamp(1 - heightAboveGround * 0.25, 0.45, 1.0);
    this.playerRig.contactShadow.scale.setScalar(shadowScale);

    // 7. Procedural Character Gait Animation
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.animateCharacter(dt, elapsed, horizSpeed, isRunning);

    // 8. Update Camera Transform (with interior wall-occlusion pull-in)
    this.updateCameraTransform(dt);

    // 9. Texel-snapped shadow frustum + Subtle Canopy Shade outdoors
    if (!this.activeInterior) {
      const canopyShade =
        groveDensityAt(this.playerPos.x, this.playerPos.z) *
        (1 - pathMaskAt(this.playerPos.x, this.playerPos.z));
      const canopyFactor = 1 - canopyShade * 0.14;
      this.keyLight.intensity = 1.75 * canopyFactor;
      this.hemiLight.intensity = 1.65 * (0.92 + 0.08 * canopyFactor);

      if (this.keyLight.castShadow) {
        const snapX = Math.round(this.playerPos.x);
        const snapZ = Math.round(this.playerPos.z);
        this.keyLight.position.set(snapX + 16, this.playerPos.y + 26, snapZ + 14);
        this.keyLight.target.position.set(snapX, this.playerPos.y, snapZ);
      }
    } else if (this.keyLight.castShadow) {
      this.keyLight.target.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    }

    // 10. Dynamic 6-Light Pooling for active exterior or interior point lights
    this.updateNearestWorldLights(elapsed);

    // 11. World or Interior Embers, Mist & Shader Time
    if (!this.activeInterior) {
      this.world.windUniforms.uTime.value = elapsed;
      this.world.crowGroup.rotation.y = elapsed * 0.26;
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

    if (this.lanternEnabled) {
      const baseInt = this.activeInterior
        ? this.activeInterior.lighting.lanternIntensity
        : 1.45;
      const lanternFlicker =
        0.92 + 0.08 * Math.sin(elapsed * 8.4) + 0.05 * Math.cos(elapsed * 14.1);
      this.playerRig.lanternLight.intensity = baseInt * lanternFlicker;
    }

    // 12. Zone Discovery, Interaction Prompt & Audio Update
    this.updateActiveZone();
    this.updateInteractionPrompt();
    const onPath = this.activeInterior
      ? true
      : pathMaskAt(this.playerPos.x, this.playerPos.z) > 0.45;
    this.audio.update(elapsed, dt, horizSpeed, this.isGrounded, onPath);
  }

  private updateNearestWorldLights(elapsed: number): void {
    const anchors = this.activeInterior
      ? this.activeInterior.lightAnchors
      : this.world.lightAnchors;

    this.lightPoolSortBuf.length = 0;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
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
      const a = anchors[this.lightPoolSortBuf[p].idx];
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

    if (speed > 0.2 && this.isGrounded) {
      const freq = isRunning ? 10.6 : 7.0;
      this.walkCycle += dt * freq;
    } else if (this.isGrounded) {
      this.walkCycle = THREE.MathUtils.damp(
        this.walkCycle,
        Math.round(this.walkCycle / Math.PI) * Math.PI,
        6,
        dt
      );
    }

    const swingAmp = (isRunning ? 0.78 : 0.52) * moveBlend;
    const legSwing = Math.sin(this.walkCycle) * swingAmp;
    const armSwing = Math.sin(this.walkCycle) * swingAmp * 0.78;
    const strideBob = Math.abs(Math.cos(this.walkCycle)) * (isRunning ? 0.085 : 0.045) * moveBlend;
    const idleBreath = Math.sin(elapsed * 2.1) * 0.015 * (1 - moveBlend);

    if (!this.isGrounded) {
      rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, 0.35, 10, dt);
      rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, -0.25, 10, dt);
      rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, -0.45, 10, dt);
      rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, -0.45, 10, dt);
      rig.cape.rotation.x = THREE.MathUtils.damp(rig.cape.rotation.x, 0.42, 8, dt);
    } else {
      rig.leftLegPivot.rotation.x = legSwing;
      rig.rightLegPivot.rotation.x = -legSwing;
      rig.leftArmPivot.rotation.x = -armSwing;
      rig.rightArmPivot.rotation.x = armSwing;

      const lean = (isRunning ? 0.17 : 0.07) * moveBlend;
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, lean, 10, dt);
      rig.bodyPivot.position.y = strideBob + idleBreath;

      const capeTarget =
        0.14 + (isRunning ? 0.36 : 0.16) * moveBlend + Math.sin(elapsed * 3.1) * 0.035;
      rig.cape.rotation.x = THREE.MathUtils.damp(rig.cape.rotation.x, capeTarget, 8, dt);
    }

    rig.lanternPivot.rotation.x =
      Math.sin(elapsed * 2.7 + this.walkCycle * 0.5) * (0.06 + 0.14 * moveBlend);
    rig.lanternPivot.rotation.z = Math.cos(elapsed * 2.1) * (0.04 + 0.08 * moveBlend);
    rig.headPivot.rotation.y = Math.sin(elapsed * 0.85) * 0.05 * (1 - moveBlend);
  }

  private updateCameraTransform(dt: number): void {
    _targetLook.set(this.playerPos.x, this.playerPos.y + 1.44, this.playerPos.z);
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
