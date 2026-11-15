import * as THREE from 'three';
import {
  DYNAMIC_EVENT_TEMPLATES,
  JOURNAL_ENTRIES,
  LORE_PROPS,
  SECRET_MECHANISMS,
  TREASURE_CONTAINERS,
} from '../data/exploration';
import { ForestAudioSystem } from '../game/audio';
import { addItemsToInventory, countInventoryItem, ITEM_CATALOG } from '../game/inventory';
import {
  biomeAt,
  LANDMARK_ZONES,
  PLAYABLE_BOUNDS_RADIUS,
  rawTerrainSlopeAt,
  streamDistanceAt,
  walkableHeightAt,
} from '../game/terrain';
import { ProceduralTextures } from '../game/textures';
import {
  BoxCollider,
  CircleCollider,
  InventorySlot,
  LightAnchor,
  ThornvaleSaveState,
} from '../game/types';
import {
  DayNightPhase,
  DevExplorationSnapshot,
  DynamicEventKind,
  DynamicEventTemplate,
  DynamicEventUiSummary,
  ExplorationAtmosphereState,
  ExplorationEnvironmentId,
  ExplorationSaveData,
  LorePropDef,
  SecretMechanismDef,
  TreasureContainerDef,
} from '../types/exploration';
import {
  buildDynamicEventVisual,
  buildLorePropVisual,
  buildMechanismVisual,
  buildTreasureVisual,
  ChestVisualHandle,
  createExplorationMaterials,
  disposeExplorationPalette,
  DynamicEventVisualHandle,
  ExplorationMaterialPalette,
  MechanismVisualHandle,
} from '../visuals/ExplorationModels';

export const DAY_CYCLE_REAL_SECONDS = 720; // 12 real minutes per full 24h cycle
export const MAX_ACTIVE_DYNAMIC_EVENTS = 2;
export const MIN_EVENT_SPAWN_COOLDOWN_SEC = 45;

export function createDefaultExplorationSaveData(): ExplorationSaveData {
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

export function computeDayNightAtmosphere(
  timeOfDayRaw: number,
  cyclePaused = false,
  activeEventsCount = 0
): ExplorationAtmosphereState {
  const timeOfDay = ((timeOfDayRaw % 24) + 24) % 24;
  const hh = Math.floor(timeOfDay);
  const mm = Math.floor((timeOfDay - hh) * 60);
  const hourLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  let phase: DayNightPhase = 'day';
  if (timeOfDay >= 5 && timeOfDay < 8) {
    phase = 'dawn';
  } else if (timeOfDay >= 8 && timeOfDay < 17.5) {
    phase = 'day';
  } else if (timeOfDay >= 17.5 && timeOfDay < 20.5) {
    phase = 'dusk';
  } else {
    phase = 'night';
  }

  // Smooth nocturnal intensity: 0 in full day (9..16.5), 1 in deep night (21..4.5)
  let nocturnalIntensity = 0;
  if (timeOfDay >= 21 || timeOfDay < 4.5) {
    nocturnalIntensity = 1;
  } else if (timeOfDay >= 16.5 && timeOfDay < 21) {
    const t = (timeOfDay - 16.5) / 4.5;
    nocturnalIntensity = 0.5 - 0.5 * Math.cos(Math.PI * t);
  } else if (timeOfDay >= 4.5 && timeOfDay < 9) {
    const t = (timeOfDay - 4.5) / 4.5;
    nocturnalIntensity = 0.5 + 0.5 * Math.cos(Math.PI * t);
  }

  return {
    timeOfDay,
    hourLabel,
    phase,
    isNight: phase === 'night',
    isDuskOrNight: phase === 'dusk' || phase === 'night',
    nocturnalIntensity,
    cyclePaused,
    activeEventsCount,
  };
}

export interface ExteriorAtmosphereProfile {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  keyColor: THREE.Color;
  keyIntensity: number;
  rimIntensity: number;
  exposure: number;
  lanternDistance: number;
  lanternBoost: number;
}

const _daySky = new THREE.Color('#66737d');
const _duskSky = new THREE.Color('#4a4956');
const _nightSky = new THREE.Color('#17202b');

const _dayAmbient = new THREE.Color('#8f9ca6');
const _duskAmbient = new THREE.Color('#7c7682');
const _nightAmbient = new THREE.Color('#394c63');

const _dayHemiSky = new THREE.Color('#bfd0de');
const _duskHemiSky = new THREE.Color('#b0958e');
const _nightHemiSky = new THREE.Color('#4d6884');

const _dayHemiGround = new THREE.Color('#435045');
const _nightHemiGround = new THREE.Color('#182223');

const _dayKey = new THREE.Color('#dce4eb');
const _duskKey = new THREE.Color('#cfa386');
const _nightKey = new THREE.Color('#7894b8');

export function evaluateExteriorAtmosphereProfile(
  atmosphere: ExplorationAtmosphereState,
  out: ExteriorAtmosphereProfile
): void {
  const n = atmosphere.nocturnalIntensity;
  const twilightBlend =
    atmosphere.phase === 'dawn' || atmosphere.phase === 'dusk'
      ? Math.sin(Math.min(1, Math.max(0, n)) * Math.PI)
      : Math.sin(n * Math.PI) * 0.45;

  out.skyColor.copy(_daySky).lerp(_nightSky, n);
  if (twilightBlend > 0.01) {
    out.skyColor.lerp(_duskSky, twilightBlend * 0.52);
  }
  out.fogColor.copy(out.skyColor);
  out.fogDensity = THREE.MathUtils.lerp(0.0235, 0.0285, n);

  out.ambientColor.copy(_dayAmbient).lerp(_nightAmbient, n);
  if (twilightBlend > 0.01) {
    out.ambientColor.lerp(_duskAmbient, twilightBlend * 0.45);
  }
  out.ambientIntensity = THREE.MathUtils.lerp(0.55, 0.36, n);

  out.hemiSky.copy(_dayHemiSky).lerp(_nightHemiSky, n);
  if (twilightBlend > 0.01) {
    out.hemiSky.lerp(_duskHemiSky, twilightBlend * 0.55);
  }
  out.hemiGround.copy(_dayHemiGround).lerp(_nightHemiGround, n);
  out.hemiIntensity = THREE.MathUtils.lerp(1.65, 0.88, n);

  out.keyColor.copy(_dayKey).lerp(_nightKey, n);
  if (twilightBlend > 0.01) {
    out.keyColor.lerp(_duskKey, twilightBlend * 0.6);
  }
  out.keyIntensity = THREE.MathUtils.lerp(1.75, 0.64, n);
  out.rimIntensity = THREE.MathUtils.lerp(0.72, 0.38, n);
  out.exposure = THREE.MathUtils.lerp(1.25, 1.18, n);
  out.lanternDistance = THREE.MathUtils.lerp(9.0, 13.0, n);
  out.lanternBoost = THREE.MathUtils.lerp(1.0, 1.38, n);
}

function consumeInventoryQuantity(
  slots: (InventorySlot | null)[],
  itemId: string,
  qty: number
): (InventorySlot | null)[] | null {
  if (countInventoryItem(slots, itemId) < qty) return null;
  const next = slots.map((s) => (s ? { ...s } : null));
  let rem = qty;
  for (let i = 0; i < next.length && rem > 0; i++) {
    const s = next[i];
    if (!s || s.itemId !== itemId) continue;
    const take = Math.min(rem, s.quantity);
    s.quantity -= take;
    rem -= take;
    if (s.quantity <= 0) next[i] = null;
  }
  return rem === 0 ? next : null;
}

function disposeObjectGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
    }
  });
}

interface ActiveMechanismNode {
  def: SecretMechanismDef;
  visual: MechanismVisualHandle;
  collider: BoxCollider | null;
  phase: number;
}

interface ActiveTreasureNode {
  def: TreasureContainerDef;
  visual: ChestVisualHandle;
  lightAnchor?: LightAnchor;
  phase: number;
  isDevTest?: boolean;
}

interface ActiveLoreNode {
  def: LorePropDef;
  group: THREE.Group;
  runeMesh?: THREE.Mesh;
  lightAnchor?: LightAnchor;
  phase: number;
}

interface ActiveDynamicEvent {
  runtimeId: string;
  template: DynamicEventTemplate;
  x: number;
  y: number;
  z: number;
  remainingSec: number;
  resolved: boolean;
  visual: DynamicEventVisualHandle;
  lightAnchor?: LightAnchor;
  phase: number;
}

export interface ExplorationInteractResult {
  handled: boolean;
  message?: string;
}

export interface ExplorationInteractCandidate {
  id: string;
  kind: 'chest' | 'mechanism' | 'lore' | 'event';
  label: string;
  distSq: number;
  activate: () => ExplorationInteractResult;
}

export interface ExplorationUpdateContext {
  playerX: number;
  playerY: number;
  playerZ: number;
  isInterior: boolean;
  devModeEnabled: boolean;
  overworldStaticCircles: CircleCollider[];
  overworldStaticBoxes: BoxCollider[];
  saveState: ThornvaleSaveState;
  updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void;
}

export class ExplorationSystem {
  private scene: THREE.Scene;
  private audio: ForestAudioSystem;
  private palette: ExplorationMaterialPalette;
  private envGroup: THREE.Group;
  private eventGroup: THREE.Group;

  private activeEnvId: ExplorationEnvironmentId = 'overworld';
  private mechanisms: ActiveMechanismNode[] = [];
  private treasures: ActiveTreasureNode[] = [];
  private loreProps: ActiveLoreNode[] = [];
  private dynamicEvents: ActiveDynamicEvent[] = [];
  private dynamicColliderBuf: BoxCollider[] = [];
  private lightAnchorBuf: LightAnchor[] = [];

  private timeOfDay = 13.25;
  private devTimeOverride: number | null = null;
  private cyclePaused = false;
  private persistTimeAccum = 0;
  private spawnCooldownSec = 22; // First natural event won't fire right on spawn second 0
  private runtimeSeq = 1;
  private lastEmittedMinute = -1;

  constructor(
    scene: THREE.Scene,
    textures: ProceduralTextures,
    audio: ForestAudioSystem,
    initialState: ExplorationSaveData
  ) {
    this.scene = scene;
    this.audio = audio;
    this.palette = createExplorationMaterials(textures);

    this.envGroup = new THREE.Group();
    this.envGroup.name = 'ExplorationEnvironmentGroup';
    this.scene.add(this.envGroup);

    this.eventGroup = new THREE.Group();
    this.eventGroup.name = 'ExplorationDynamicEvents';
    this.scene.add(this.eventGroup);

    this.timeOfDay =
      typeof initialState?.timeOfDay === 'number' && Number.isFinite(initialState.timeOfDay)
        ? initialState.timeOfDay
        : 13.25;
  }

  public getAtmosphereState(): ExplorationAtmosphereState {
    const hour = this.devTimeOverride !== null ? this.devTimeOverride : this.timeOfDay;
    return computeDayNightAtmosphere(hour, this.cyclePaused, this.dynamicEvents.length);
  }

  public syncForEnvironment(
    envId: ExplorationEnvironmentId,
    saveState: ThornvaleSaveState
  ): void {
    this.activeEnvId = envId;
    this.clearEnvironmentNodes();
    this.eventGroup.visible = envId === 'overworld';

    const exp = saveState.exploration ?? createDefaultExplorationSaveData();
    if (this.devTimeOverride === null && typeof exp.timeOfDay === 'number') {
      this.timeOfDay = exp.timeOfDay;
    }

    // 1. Secret Mechanisms in current environment
    for (let i = 0; i < SECRET_MECHANISMS.length; i++) {
      const def = SECRET_MECHANISMS[i];
      if (def.environmentId !== envId) continue;
      const visual = buildMechanismVisual(def, this.palette);
      const isOpen = !!exp.activatedMechanisms[def.id];
      visual.openProgress = isOpen ? 1 : 0;
      this.applyMechanismPose(visual, def, visual.openProgress);
      this.envGroup.add(visual.group);

      let collider: BoxCollider | null = null;
      if (def.doorPos && def.doorSize) {
        collider = {
          cx: def.doorPos.x,
          cz: def.doorPos.z,
          halfW: def.doorSize.w * 0.5,
          halfD: def.doorSize.d * 0.5,
          rotY: def.doorRotY ?? 0,
          minY: def.doorPos.y,
          maxY: def.doorPos.y + def.doorSize.h,
          kind: 'building',
        };
      }

      this.mechanisms.push({
        def,
        visual,
        collider,
        phase: Math.abs(def.triggerPos.x * 0.4 + def.triggerPos.z * 0.7) % 6.28,
      });
    }

    // 2. Treasure Containers in current environment
    for (let i = 0; i < TREASURE_CONTAINERS.length; i++) {
      const def = TREASURE_CONTAINERS[i];
      if (def.environmentId !== envId) continue;
      const visual = buildTreasureVisual(def, this.palette);
      const opened = !!exp.openedChests[def.id];
      visual.openProgress = opened ? 1 : 0;
      visual.lidPivot.rotation.x = -visual.openProgress * 1.42;
      if (visual.innerGlowMesh) {
        visual.innerGlowMesh.visible = opened;
      }
      this.envGroup.add(visual.group);

      const lightAnchor: LightAnchor | undefined =
        def.difficultyTier === 'dungeon' || def.difficultyTier === 'sanctum' || def.requiresNight
          ? {
              x: def.x,
              y: def.y + 0.9,
              z: def.z,
              color: def.requiresNight ? '#7bd9e8' : '#e6aa4c',
              baseIntensity: opened ? 2.4 : def.requiresNight ? 1.8 : 0,
              distance: 7.5,
              phase: Math.abs(def.x * 0.5 + def.z * 0.3) % 6.28,
              tag: `treasure_${def.id}`,
            }
          : undefined;

      this.treasures.push({
        def,
        visual,
        lightAnchor,
        phase: Math.abs(def.x * 0.41 + def.z * 0.63) % 6.28,
      });
    }

    // 3. Environmental Lore Props in current environment
    for (let i = 0; i < LORE_PROPS.length; i++) {
      const def = LORE_PROPS[i];
      if (def.environmentId !== envId) continue;
      const built = buildLorePropVisual(def, this.palette);
      this.envGroup.add(built.group);

      const lightAnchor: LightAnchor | undefined = def.nocturnalHint
        ? {
            x: def.x,
            y: def.y + 1.35,
            z: def.z,
            color: '#79d8e6',
            baseIntensity: 0,
            distance: 7.5,
            phase: Math.abs(def.x * 0.33 + def.z * 0.47) % 6.28,
            tag: `lore_${def.id}`,
          }
        : undefined;

      this.loreProps.push({
        def,
        group: built.group,
        runeMesh: built.runeMesh,
        lightAnchor,
        phase: Math.abs(def.x * 0.37 + def.z * 0.61) % 6.28,
      });
    }
  }

  private clearEnvironmentNodes(): void {
    for (let i = 0; i < this.mechanisms.length; i++) {
      this.envGroup.remove(this.mechanisms[i].visual.group);
      disposeObjectGroup(this.mechanisms[i].visual.group);
    }
    this.mechanisms.length = 0;

    for (let i = 0; i < this.treasures.length; i++) {
      this.envGroup.remove(this.treasures[i].visual.group);
      disposeObjectGroup(this.treasures[i].visual.group);
    }
    this.treasures.length = 0;

    for (let i = 0; i < this.loreProps.length; i++) {
      this.envGroup.remove(this.loreProps[i].group);
      disposeObjectGroup(this.loreProps[i].group);
    }
    this.loreProps.length = 0;
  }

  public clearAllDynamicEvents(): void {
    for (let i = 0; i < this.dynamicEvents.length; i++) {
      const ev = this.dynamicEvents[i];
      this.eventGroup.remove(ev.visual.group);
      disposeObjectGroup(ev.visual.group);
    }
    this.dynamicEvents.length = 0;
  }

  public resetTransientForDevExit(normalSave: ThornvaleSaveState): void {
    this.devTimeOverride = null;
    this.cyclePaused = false;
    this.clearAllDynamicEvents();
    this.timeOfDay = normalSave.exploration?.timeOfDay ?? 13.25;
    this.spawnCooldownSec = 25;
    this.lastEmittedMinute = -1;
  }

  public update(
    dt: number,
    elapsed: number,
    ctx: ExplorationUpdateContext
  ): ExplorationAtmosphereState | null {
    const exp = ctx.saveState.exploration ?? createDefaultExplorationSaveData();

    // 1. Advance 24h cycle smoothly unless paused or pinned in Dev Mode
    if (!this.cyclePaused && this.devTimeOverride === null) {
      this.timeOfDay = (this.timeOfDay + dt * (24 / DAY_CYCLE_REAL_SECONDS)) % 24;
      this.persistTimeAccum += dt;
      if (this.persistTimeAccum >= 5.0) {
        this.persistTimeAccum = 0;
        const currentHour = this.timeOfDay;
        ctx.updateSaveState((prev) => ({
          ...prev,
          exploration: {
            ...(prev.exploration ?? createDefaultExplorationSaveData()),
            timeOfDay: currentHour,
          },
        }));
      }
    }

    const atmosphere = this.getAtmosphereState();

    // 2. Animate secret mechanisms & nocturnal runes
    for (let i = 0; i < this.mechanisms.length; i++) {
      const node = this.mechanisms[i];
      const active = !!exp.activatedMechanisms[node.def.id];
      const target = active ? 1 : 0;
      if (Math.abs(node.visual.openProgress - target) > 0.002) {
        node.visual.openProgress = THREE.MathUtils.damp(
          node.visual.openProgress,
          target,
          5.5,
          dt
        );
        this.applyMechanismPose(node.visual, node.def, node.visual.openProgress);
      }

      if (node.visual.runeOrb) {
        const mat = node.visual.runeOrb.material as THREE.MeshBasicMaterial;
        if (active) {
          mat.color.set('#e5b45b');
        } else if (node.def.nocturnalGlow) {
          const glowBoost = 0.45 + atmosphere.nocturnalIntensity * 0.55;
          mat.color.setRGB(0.35 * glowBoost, 0.78 * glowBoost, 0.88 * glowBoost);
        } else {
          mat.color.set('#5e8e99');
        }
        node.visual.runeOrb.rotation.y = elapsed * 0.9 + node.phase;
      }
    }

    // 3. Animate treasure lids & nocturnal moon-seals
    for (let i = 0; i < this.treasures.length; i++) {
      const node = this.treasures[i];
      const opened = !!exp.openedChests[node.def.id];
      const target = opened ? 1 : 0;
      if (Math.abs(node.visual.openProgress - target) > 0.002) {
        node.visual.openProgress = THREE.MathUtils.damp(
          node.visual.openProgress,
          target,
          7.0,
          dt
        );
        node.visual.lidPivot.rotation.x = -node.visual.openProgress * 1.42;
      }
      if (node.visual.innerGlowMesh) {
        node.visual.innerGlowMesh.visible = node.visual.openProgress > 0.25;
      }
      if (node.visual.runeSealMesh) {
        const ready = atmosphere.isDuskOrNight && !opened;
        node.visual.runeSealMesh.visible = !opened;
        node.visual.runeSealMesh.rotation.y = elapsed * (ready ? 1.8 : 0.4);
        const s = ready ? 1.12 + Math.sin(elapsed * 3.5) * 0.12 : 0.75;
        node.visual.runeSealMesh.scale.setScalar(s);
      }
      if (node.lightAnchor) {
        if (opened) {
          node.lightAnchor.baseIntensity = 2.6;
          node.lightAnchor.color = '#e6aa4c';
        } else if (node.def.requiresNight) {
          node.lightAnchor.baseIntensity = atmosphere.isDuskOrNight ? 2.4 : 0.25;
        } else {
          node.lightAnchor.baseIntensity = 0;
        }
      }
    }

    // 4. Animate Lore Props & Nocturnal Runes
    for (let i = 0; i < this.loreProps.length; i++) {
      const lp = this.loreProps[i];
      if (lp.runeMesh) {
        const mat = lp.runeMesh.material as THREE.MeshBasicMaterial;
        const n = lp.def.nocturnalHint ? 0.35 + atmosphere.nocturnalIntensity * 0.65 : 0.45;
        mat.color.setRGB(0.32 * n, 0.74 * n, 0.82 * n);
      }
      if (lp.lightAnchor) {
        lp.lightAnchor.baseIntensity = lp.def.nocturnalHint
          ? 2.2 * atmosphere.nocturnalIntensity
          : 0;
      }
    }

    // 5. Overworld Dynamic World Events Director & Cleanup
    if (!ctx.isInterior) {
      if (this.spawnCooldownSec > 0) {
        this.spawnCooldownSec -= dt;
      }

      for (let i = this.dynamicEvents.length - 1; i >= 0; i--) {
        const ev = this.dynamicEvents[i];
        ev.remainingSec -= dt;
        this.animateDynamicEvent(ev, elapsed);

        const distFromPlayer = Math.hypot(ev.x - ctx.playerX, ev.z - ctx.playerZ);
        if (ev.remainingSec <= 0 || distFromPlayer > 95) {
          this.eventGroup.remove(ev.visual.group);
          disposeObjectGroup(ev.visual.group);
          this.dynamicEvents.splice(i, 1);
        }
      }

      if (
        this.dynamicEvents.length < MAX_ACTIVE_DYNAMIC_EVENTS &&
        this.spawnCooldownSec <= 0
      ) {
        this.trySpawnNaturalEvent(
          ctx.playerX,
          ctx.playerZ,
          atmosphere,
          ctx.overworldStaticCircles,
          ctx.overworldStaticBoxes
        );
        this.spawnCooldownSec = MIN_EVENT_SPAWN_COOLDOWN_SEC + Math.random() * 25;
      }
    }

    // Throttle UI emissions to whole-minute changes (or event count updates)
    const minuteStamp = Math.floor(atmosphere.timeOfDay * 60) * 10 + this.dynamicEvents.length;
    if (minuteStamp !== this.lastEmittedMinute) {
      this.lastEmittedMinute = minuteStamp;
      return atmosphere;
    }
    return null;
  }

  private applyMechanismPose(
    visual: MechanismVisualHandle,
    def: SecretMechanismDef,
    progress: number
  ): void {
    if (visual.doorMesh && def.doorPos && def.doorSize) {
      const off = def.openOffset ?? { dx: 0, dy: -def.doorSize.h, dz: 0, dRotY: 0 };
      visual.doorMesh.position.set(
        def.doorPos.x + off.dx * progress,
        def.doorPos.y + def.doorSize.h * 0.5 + off.dy * progress,
        def.doorPos.z + off.dz * progress
      );
      visual.doorMesh.rotation.y = (def.doorRotY ?? 0) + off.dRotY * progress;
    }
    if (visual.leverArmPivot) {
      visual.leverArmPivot.rotation.x = THREE.MathUtils.lerp(-0.35, 0.52, progress);
    }
  }

  private animateDynamicEvent(ev: ActiveDynamicEvent, elapsed: number): void {
    const kind = ev.template.kind;
    const parts = ev.visual.animatedParts;
    if (kind === 'traveler_camp' && parts[0]) {
      const f = 0.88 + 0.16 * Math.sin(elapsed * 8.1 + ev.phase);
      parts[0].scale.set(f, 0.85 + f * 0.25, f);
    } else if (kind === 'wandering_peddler' && parts[0]) {
      parts[0].rotation.z = Math.sin(elapsed * 2.2 + ev.phase) * 0.12;
    } else if (kind === 'rare_spirit_stag' && parts[0]) {
      ev.visual.group.position.y = ev.y + Math.sin(elapsed * 1.8 + ev.phase) * 0.08;
    } else if (kind === 'nocturnal_wisp_choir') {
      for (let i = 0; i < parts.length; i++) {
        const a = elapsed * 1.4 + (i / 3) * Math.PI * 2 + ev.phase;
        parts[i].position.set(
          Math.cos(a) * 1.15,
          1.1 + Math.sin(elapsed * 2.4 + i) * 0.24,
          Math.sin(a) * 1.15
        );
      }
    }
  }

  private trySpawnNaturalEvent(
    px: number,
    pz: number,
    atmosphere: ExplorationAtmosphereState,
    staticCircles: CircleCollider[],
    staticBoxes: BoxCollider[],
    forcedKind?: DynamicEventKind
  ): ActiveDynamicEvent | null {
    const candidates = forcedKind
      ? DYNAMIC_EVENT_TEMPLATES.filter((t) => t.kind === forcedKind)
      : DYNAMIC_EVENT_TEMPLATES.filter((t) => {
          if (t.timeFilter === 'any') return true;
          if (t.timeFilter === 'day') return !atmosphere.isDuskOrNight;
          if (t.timeFilter === 'dusk_night') return atmosphere.isDuskOrNight;
          if (t.timeFilter === 'night') return atmosphere.isNight;
          return true;
        });

    if (candidates.length === 0) return null;

    // Avoid spawning two identical event kinds at once unless forced
    const filtered = forcedKind
      ? candidates
      : candidates.filter((c) => !this.dynamicEvents.some((ev) => ev.template.kind === c.kind));
    const pool = filtered.length > 0 ? filtered : candidates;
    const tpl = pool[Math.floor(Math.random() * pool.length)];

    const minR = forcedKind ? 8 : tpl.spawnRadiusMin;
    const maxR = forcedKind ? 14 : tpl.spawnRadiusMax;

    for (let attempt = 0; attempt < 18; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = minR + Math.random() * (maxR - minR);
      const sx = px + Math.cos(ang) * dist;
      const sz = pz + Math.sin(ang) * dist;

      if (Math.hypot(sx, sz) > PLAYABLE_BOUNDS_RADIUS - 14) continue;
      if (streamDistanceAt(sx, sz) < 3.6) continue;
      if (rawTerrainSlopeAt(sx, sz) > 0.52) continue;

      const sy = walkableHeightAt(sx, sz);
      if (sy < 0.08) continue;

      if (!forcedKind) {
        const bio = biomeAt(sx, sz);
        if (!tpl.biomeFilter.includes(bio)) continue;
      }

      // Stay clear of landmarks & major colliders
      let tooClose = false;
      for (let l = 0; l < LANDMARK_ZONES.length; l++) {
        const lz = LANDMARK_ZONES[l];
        if (Math.hypot(sx - lz.x, sz - lz.z) < 11.5) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      for (let c = 0; c < staticCircles.length; c++) {
        const col = staticCircles[c];
        if (Math.hypot(sx - col.x, sz - col.z) < col.radius + 2.4) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      for (let b = 0; b < staticBoxes.length; b++) {
        const box = staticBoxes[b];
        if (Math.hypot(sx - box.cx, sz - box.cz) < Math.max(box.halfW, box.halfD) + 2.6) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const visual = buildDynamicEventVisual(tpl.kind, sx, sy, sz, this.palette);
      this.eventGroup.add(visual.group);

      const lightAnchor: LightAnchor | undefined =
        tpl.lightColor && tpl.lightIntensity
          ? {
              x: sx,
              y: sy + 1.25,
              z: sz,
              color: tpl.lightColor,
              baseIntensity: tpl.lightIntensity,
              distance: 13.5,
              phase: Math.abs(sx * 0.4 + sz * 0.6) % 6.28,
              tag: `dynevent_${this.runtimeSeq}`,
            }
          : undefined;

      const activeEv: ActiveDynamicEvent = {
        runtimeId: `evt_${this.runtimeSeq++}`,
        template: tpl,
        x: sx,
        y: sy,
        z: sz,
        remainingSec: tpl.durationSec,
        resolved: false,
        visual,
        lightAnchor,
        phase: Math.abs(sx * 0.3 + sz * 0.5) % 6.28,
      };
      this.dynamicEvents.push(activeEv);
      return activeEv;
    }

    return null;
  }

  public getDynamicBoxColliders(): BoxCollider[] {
    this.dynamicColliderBuf.length = 0;
    for (let i = 0; i < this.mechanisms.length; i++) {
      const m = this.mechanisms[i];
      if (m.collider && m.visual.openProgress < 0.68) {
        this.dynamicColliderBuf.push(m.collider);
      }
    }
    return this.dynamicColliderBuf;
  }

  public getActiveLightAnchors(isInterior: boolean): LightAnchor[] {
    this.lightAnchorBuf.length = 0;
    for (let i = 0; i < this.treasures.length; i++) {
      const t = this.treasures[i];
      if (t.lightAnchor && t.lightAnchor.baseIntensity > 0.05) {
        this.lightAnchorBuf.push(t.lightAnchor);
      }
    }
    for (let i = 0; i < this.loreProps.length; i++) {
      const lp = this.loreProps[i];
      if (lp.lightAnchor && lp.lightAnchor.baseIntensity > 0.05) {
        this.lightAnchorBuf.push(lp.lightAnchor);
      }
    }
    if (!isInterior) {
      for (let i = 0; i < this.dynamicEvents.length; i++) {
        const ev = this.dynamicEvents[i];
        if (ev.lightAnchor && ev.lightAnchor.baseIntensity > 0.05) {
          this.lightAnchorBuf.push(ev.lightAnchor);
        }
      }
    }
    return this.lightAnchorBuf;
  }

  public findNearestInteractable(
    envId: ExplorationEnvironmentId,
    px: number,
    py: number,
    pz: number,
    getSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ExplorationInteractCandidate | null {
    const saveState = getSaveState();
    const exp = saveState.exploration ?? createDefaultExplorationSaveData();
    const atmosphere = this.getAtmosphereState();

    let best: ExplorationInteractCandidate | null = null;
    let bestDistSq = Infinity;

    // 1. Secret Treasures / Chests
    for (let i = 0; i < this.treasures.length; i++) {
      const node = this.treasures[i];
      const def = node.def;
      if (def.environmentId !== envId) continue;
      if (exp.openedChests[def.id]) continue;
      if (Math.abs(py - def.y) > 1.85) continue;

      const dSq = (px - def.x) * (px - def.x) + (pz - def.z) * (pz - def.z);
      if (dSq > def.radius * def.radius || dSq >= bestDistSq) continue;

      bestDistSq = dSq;
      best = {
        id: def.id,
        kind: 'chest',
        label: `Open ${def.name}`,
        distSq: dSq,
        activate: () => this.activateTreasure(node, getSaveState, updateSaveState),
      };
    }

    // 2. Secret Mechanisms & Switches (hide already-opened ones so room entrances feel seamless)
    for (let i = 0; i < this.mechanisms.length; i++) {
      const node = this.mechanisms[i];
      const def = node.def;
      if (def.environmentId !== envId) continue;
      if (exp.activatedMechanisms[def.id]) continue;
      if (Math.abs(py - def.triggerPos.y) > 1.85) continue;

      const dSq =
        (px - def.triggerPos.x) * (px - def.triggerPos.x) +
        (pz - def.triggerPos.z) * (pz - def.triggerPos.z);
      if (dSq > def.triggerRadius * def.triggerRadius || dSq >= bestDistSq) continue;

      bestDistSq = dSq;
      best = {
        id: def.id,
        kind: 'mechanism',
        label: def.activateLabel,
        distSq: dSq,
        activate: () => this.activateMechanism(node, getSaveState, updateSaveState),
      };
    }

    // 3. Dynamic Events (overworld only)
    if (envId === 'overworld') {
      for (let i = 0; i < this.dynamicEvents.length; i++) {
        const ev = this.dynamicEvents[i];
        if (ev.resolved) continue;
        if (Math.abs(py - ev.y) > 2.2) continue;

        const dSq = (px - ev.x) * (px - ev.x) + (pz - ev.z) * (pz - ev.z);
        const rad = 2.6;
        if (dSq > rad * rad || dSq >= bestDistSq) continue;

        bestDistSq = dSq;
        best = {
          id: ev.runtimeId,
          kind: 'event',
          label: ev.template.promptLabel,
          distSq: dSq,
          activate: () => this.activateDynamicEvent(ev, getSaveState, updateSaveState),
        };
      }
    }

    // 4. Environmental Lore Props
    for (let i = 0; i < this.loreProps.length; i++) {
      const lp = this.loreProps[i];
      const def = lp.def;
      if (def.environmentId !== envId) continue;
      if (Math.abs(py - def.y) > 1.85) continue;

      const dSq = (px - def.x) * (px - def.x) + (pz - def.z) * (pz - def.z);
      if (dSq > def.radius * def.radius || dSq >= bestDistSq) continue;

      bestDistSq = dSq;
      const alreadyRead = !!exp.readLoreIds[def.id];
      best = {
        id: def.id,
        kind: 'lore',
        label: alreadyRead ? `Re-read ${def.title}` : `Inspect ${def.title}`,
        distSq: dSq,
        activate: () => this.activateLoreProp(def, atmosphere, getSaveState, updateSaveState),
      };
    }

    return best;
  }

  private activateMechanism(
    node: ActiveMechanismNode,
    getSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ExplorationInteractResult {
    const def = node.def;
    const live = getSaveState();
    const exp = live.exploration ?? createDefaultExplorationSaveData();
    const atmosphere = this.getAtmosphereState();

    if (exp.activatedMechanisms[def.id]) {
      return { handled: true, message: def.activatedLabel };
    }

    // Multi-switch check (e.g. Twin Barrow Seals, Twin Citadel Levers)
    if (def.requiredSwitches && def.requiredSwitches.length > 0) {
      const missing = def.requiredSwitches.filter((sw) => !exp.activatedMechanisms[sw]);
      if (missing.length > 0) {
        this.audio.playExplorationCue('locked_rattle');
        return {
          handled: true,
          message: `Sealed (${def.requiredSwitches.length - missing.length}/${def.requiredSwitches.length} switches drawn) — ${def.clueText}`,
        };
      }
    }

    // Special Sanctum Moon-Seal check: Night/Dusk OR East Brazier lit
    if (def.id === 'mech_shrine_reliquary') {
      const eastLit = !!live.litBraziers['brazier_shrine_east'];
      if (!atmosphere.isDuskOrNight && !eastLit) {
        this.audio.playExplorationCue('locked_rattle');
        return {
          handled: true,
          message: 'Moonstone Seal sleeps in daylight — kindle the East Brazier or return at Dusk/Night.',
        };
      }
    }

    // Optional key check
    if (def.requiredKeyItemId && countInventoryItem(live.inventory, def.requiredKeyItemId) <= 0) {
      this.audio.playExplorationCue('locked_rattle');
      const keyName = ITEM_CATALOG[def.requiredKeyItemId]?.name ?? def.requiredKeyItemId;
      return { handled: true, message: `Requires ${keyName}.` };
    }

    updateSaveState((prev) => {
      const prevExp = prev.exploration ?? createDefaultExplorationSaveData();
      const nextJournal = { ...prevExp.journalEntries };
      if (def.journalEntryId) nextJournal[def.journalEntryId] = true;

      return {
        ...prev,
        exploration: {
          ...prevExp,
          activatedMechanisms: { ...prevExp.activatedMechanisms, [def.id]: true },
          discoveredSecrets: { ...prevExp.discoveredSecrets, [def.id]: true },
          journalEntries: nextJournal,
        },
      };
    });

    this.audio.playExplorationCue(
      def.kind === 'iron_lever' || def.kind === 'rotating_masonry'
        ? 'lever_clunk'
        : 'mechanism_slide'
    );
    if (def.doorPos) {
      this.audio.playExplorationCue('secret_chime');
    }

    return {
      handled: true,
      message: def.discoveryMessage ?? def.activatedLabel,
    };
  }

  private activateTreasure(
    node: ActiveTreasureNode,
    getSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ExplorationInteractResult {
    const def = node.def;
    const live = getSaveState();
    const exp = live.exploration ?? createDefaultExplorationSaveData();
    const atmosphere = this.getAtmosphereState();

    if (exp.openedChests[def.id]) {
      return { handled: true, message: `${def.name} is already empty.` };
    }

    if (def.requiredMechanismId && !exp.activatedMechanisms[def.requiredMechanismId]) {
      this.audio.playExplorationCue('locked_rattle');
      const mech = SECRET_MECHANISMS.find((m) => m.id === def.requiredMechanismId);
      return {
        handled: true,
        message: mech ? `Passage still sealed — ${mech.clueText}` : 'Sealed behind a mechanism.',
      };
    }

    if (def.requiresNight && !atmosphere.isDuskOrNight) {
      this.audio.playExplorationCue('locked_rattle');
      return {
        handled: true,
        message: `${def.name} is warded against sunlight — return at Dusk or Night.`,
      };
    }

    if (def.requiredKeyItemId && countInventoryItem(live.inventory, def.requiredKeyItemId) <= 0) {
      this.audio.playExplorationCue('locked_rattle');
      const keyName = ITEM_CATALOG[def.requiredKeyItemId]?.name ?? def.requiredKeyItemId;
      return {
        handled: true,
        message: `Locked — requires ${keyName}.`,
      };
    }

    const probe = addItemsToInventory(live.inventory, def.grants, true);
    if (probe.leftover > 0 || probe.addedTotal === 0) {
      this.audio.playExplorationCue('locked_rattle');
      return {
        handled: true,
        message: 'Traveler Pack is full — make space before opening this coffer.',
      };
    }

    let finalSummary = '';
    updateSaveState((prev) => {
      const prevExp = prev.exploration ?? createDefaultExplorationSaveData();
      if (prevExp.openedChests[def.id]) return prev;

      const added = addItemsToInventory(prev.inventory, def.grants, true);
      if (added.leftover > 0 || added.addedTotal === 0) return prev;

      const nextRecipes = { ...prevExp.unlockedRecipes };
      if (def.unlockRecipeIds) {
        for (const rId of def.unlockRecipeIds) nextRecipes[rId] = true;
      }
      const nextJournal = { ...prevExp.journalEntries };
      if (def.unlockJournalId) nextJournal[def.unlockJournalId] = true;

      finalSummary = added.addedItems
        .map((it) => {
          const itemDef = ITEM_CATALOG[it.itemId];
          const label = itemDef ? itemDef.name : it.itemId;
          return it.quantity > 1 ? `${label} x${it.quantity}` : label;
        })
        .join(', ');

      return {
        ...prev,
        inventory: added.nextSlots,
        exploration: {
          ...prevExp,
          openedChests: { ...prevExp.openedChests, [def.id]: true },
          discoveredSecrets: { ...prevExp.discoveredSecrets, [def.id]: true },
          unlockedRecipes: nextRecipes,
          journalEntries: nextJournal,
        },
      };
    });

    this.audio.playExplorationCue('chest_creak');
    if (def.unlockRecipeIds?.length || def.unlockJournalId) {
      this.audio.playExplorationCue('secret_chime');
    }

    const recipeSuffix = def.unlockRecipeIds?.length ? ' · Schematic Unlocked!' : '';
    return {
      handled: true,
      message: `${def.name}: ${finalSummary || 'Recovered'}${recipeSuffix}`,
    };
  }

  private activateLoreProp(
    def: LorePropDef,
    atmosphere: ExplorationAtmosphereState,
    getSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ExplorationInteractResult {
    const live = getSaveState();
    const exp = live.exploration ?? createDefaultExplorationSaveData();
    const isFirstRead = !exp.readLoreIds[def.id] || !exp.journalEntries[def.journalEntryId];
    const journal = JOURNAL_ENTRIES.find((j) => j.id === def.journalEntryId);

    updateSaveState((prev) => {
      const prevExp = prev.exploration ?? createDefaultExplorationSaveData();
      const nextRecipes = { ...prevExp.unlockedRecipes };
      if (def.unlockRecipeIds) {
        for (const rId of def.unlockRecipeIds) nextRecipes[rId] = true;
      }
      return {
        ...prev,
        exploration: {
          ...prevExp,
          readLoreIds: { ...prevExp.readLoreIds, [def.id]: true },
          journalEntries: { ...prevExp.journalEntries, [def.journalEntryId]: true },
          unlockedRecipes: nextRecipes,
        },
      };
    });

    this.audio.playExplorationCue('lore_whisper');
    if (isFirstRead) {
      return {
        handled: true,
        message: `Journal Updated: ${journal ? journal.title : def.title}`,
      };
    }
    const nightSuffix =
      def.nocturnalHint && !atmosphere.isDuskOrNight
        ? ' (Carvings glow dimly after dusk)'
        : '';
    return {
      handled: true,
      message: `${def.title}: ${def.shortSummary}${nightSuffix}`,
    };
  }

  private activateDynamicEvent(
    ev: ActiveDynamicEvent,
    getSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ExplorationInteractResult {
    if (ev.resolved) {
      return { handled: true, message: `${ev.template.title} has already passed.` };
    }

    const live = getSaveState();
    const tpl = ev.template;

    if (tpl.kind === 'wandering_peddler') {
      const coins = countInventoryItem(live.inventory, 'old_coin');
      const grants =
        coins >= 2
          ? tpl.rewards
          : [
              { itemId: 'dried_ration', quantity: 1 },
              { itemId: 'lantern_tallow_flask', quantity: 1 },
            ];

      const workingSlots =
        coins >= 2
          ? consumeInventoryQuantity(live.inventory, 'old_coin', 2) ?? live.inventory
          : live.inventory;

      const probe = addItemsToInventory(workingSlots, grants, true);
      if (probe.leftover > 0 || probe.addedTotal === 0) {
        this.audio.playExplorationCue('locked_rattle');
        return {
          handled: true,
          message: 'Traveler Pack is full — make space to trade with the Peddler.',
        };
      }

      updateSaveState((prev) => {
        const base =
          coins >= 2
            ? consumeInventoryQuantity(prev.inventory, 'old_coin', 2) ?? prev.inventory
            : prev.inventory;
        const added = addItemsToInventory(base, grants, true);
        if (added.leftover > 0) return prev;
        const prevExp = prev.exploration ?? createDefaultExplorationSaveData();
        const nextJournal = { ...prevExp.journalEntries };
        if (tpl.journalEntryId) nextJournal[tpl.journalEntryId] = true;
        return {
          ...prev,
          inventory: added.nextSlots,
          exploration: { ...prevExp, journalEntries: nextJournal },
        };
      });

      ev.resolved = true;
      ev.remainingSec = Math.min(ev.remainingSec, 15);
      this.audio.playExplorationCue('secret_chime');
      return {
        handled: true,
        message:
          coins >= 2
            ? 'Traded 2 Coins -> Iron Ingot, Herbal Poultice & Tallow Flask'
            : 'Peddler shared spare road provisions (+Dried Ration, +Tallow Flask)',
      };
    }

    // Standard dynamic event reward collection
    const probe = addItemsToInventory(live.inventory, tpl.rewards, true);
    if (probe.leftover > 0 || probe.addedTotal === 0) {
      this.audio.playExplorationCue('locked_rattle');
      return {
        handled: true,
        message: 'Traveler Pack is full — make space to gather spoils.',
      };
    }

    const summary = probe.addedItems
      .map((it) => {
        const d = ITEM_CATALOG[it.itemId];
        const name = d ? d.name : it.itemId;
        return it.quantity > 1 ? `${name} x${it.quantity}` : name;
      })
      .join(', ');

    updateSaveState((prev) => {
      const added = addItemsToInventory(prev.inventory, tpl.rewards, true);
      if (added.leftover > 0) return prev;
      const prevExp = prev.exploration ?? createDefaultExplorationSaveData();
      const nextJournal = { ...prevExp.journalEntries };
      if (tpl.journalEntryId) nextJournal[tpl.journalEntryId] = true;
      return {
        ...prev,
        inventory: added.nextSlots,
        exploration: { ...prevExp, journalEntries: nextJournal },
      };
    });

    ev.resolved = true;
    ev.remainingSec = Math.min(ev.remainingSec, 12);
    this.audio.playExplorationCue('secret_chime');
    return {
      handled: true,
      message: `${tpl.title}: ${summary}`,
    };
  }

  public notifyLocationTrigger(
    triggerId: string,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): string | null {
    if (triggerId === 'brazier_tower_beacon') {
      updateSaveState((prev) => {
        const exp = prev.exploration ?? createDefaultExplorationSaveData();
        return {
          ...prev,
          exploration: {
            ...exp,
            completedLocationEvents: { ...exp.completedLocationEvents, tower_beacon: true },
            journalEntries: { ...exp.journalEntries, journal_tower_captain: true },
          },
        };
      });
      this.audio.playExplorationCue('secret_chime');
      return 'Beacon Rekindled — Watch Captain’s Orders logged in Journal';
    }
    if (triggerId === 'brazier_shrine_east') {
      updateSaveState((prev) => {
        const exp = prev.exploration ?? createDefaultExplorationSaveData();
        return {
          ...prev,
          exploration: {
            ...exp,
            completedLocationEvents: { ...exp.completedLocationEvents, shrine_twin_flame: true },
            journalEntries: { ...exp.journalEntries, journal_shrine_roots: true },
          },
        };
      });
      this.audio.playExplorationCue('secret_chime');
      return 'Twin flames burn — the North Moonstone Seal stirs!';
    }
    if (triggerId === 'door_catacomb_secret') {
      updateSaveState((prev) => {
        const exp = prev.exploration ?? createDefaultExplorationSaveData();
        return {
          ...prev,
          exploration: {
            ...exp,
            discoveredSecrets: { ...exp.discoveredSecrets, door_catacomb_secret: true },
            completedLocationEvents: { ...exp.completedLocationEvents, catacomb_vault: true },
            journalEntries: { ...exp.journalEntries, journal_ruin_siege: true },
          },
        };
      });
      this.audio.playExplorationCue('secret_chime');
      return null;
    }
    return null;
  }

  // ==========================================================================
  // DEVELOPER SANDBOX / TEST HELPERS (STRICTLY ISOLATED FROM NORMAL SAVES)
  // ==========================================================================

  public setDevTimeOfDay(hour: number | null): void {
    this.devTimeOverride = hour === null ? null : ((hour % 24) + 24) % 24;
    this.lastEmittedMinute = -1;
  }

  public setDevCyclePaused(paused: boolean): void {
    this.cyclePaused = paused;
    this.lastEmittedMinute = -1;
  }

  public triggerDevDynamicEvent(
    px: number,
    pz: number,
    overworldStaticCircles: CircleCollider[],
    overworldStaticBoxes: BoxCollider[],
    kind?: DynamicEventKind
  ): DynamicEventUiSummary | null {
    if (this.activeEnvId !== 'overworld') return null;
    const spawned = this.trySpawnNaturalEvent(
      px,
      pz,
      this.getAtmosphereState(),
      overworldStaticCircles,
      overworldStaticBoxes,
      kind
    );
    if (!spawned) return null;
    this.lastEmittedMinute = -1;
    return {
      runtimeId: spawned.runtimeId,
      kind: spawned.template.kind,
      title: spawned.template.title,
      x: spawned.x,
      z: spawned.z,
      remainingSec: Math.round(spawned.remainingSec),
      resolved: spawned.resolved,
    };
  }

  public setAllMechanismsState(
    open: boolean,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    updateSaveState((prev) => {
      const exp = prev.exploration ?? createDefaultExplorationSaveData();
      const nextMech: Record<string, boolean> = {};
      if (open) {
        for (const m of SECRET_MECHANISMS) nextMech[m.id] = true;
      }
      return {
        ...prev,
        exploration: { ...exp, activatedMechanisms: nextMech },
      };
    });
    for (let i = 0; i < this.mechanisms.length; i++) {
      const node = this.mechanisms[i];
      node.visual.openProgress = open ? 1 : 0;
      this.applyMechanismPose(node.visual, node.def, node.visual.openProgress);
    }
  }

  public revealAllSecretsAndJournal(
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    updateSaveState((prev) => {
      const exp = prev.exploration ?? createDefaultExplorationSaveData();
      const nextJournal: Record<string, boolean> = { ...exp.journalEntries };
      for (const j of JOURNAL_ENTRIES) nextJournal[j.id] = true;
      const nextSecrets: Record<string, boolean> = { ...exp.discoveredSecrets };
      for (const m of SECRET_MECHANISMS) nextSecrets[m.id] = true;
      const nextRecipes: Record<string, boolean> = {
        ...exp.unlockedRecipes,
        recipe_warden_tincture: true,
        recipe_sunfire_blade: true,
      };
      return {
        ...prev,
        exploration: {
          ...exp,
          journalEntries: nextJournal,
          discoveredSecrets: nextSecrets,
          unlockedRecipes: nextRecipes,
        },
      };
    });
  }

  public spawnDevTestChestNear(px: number, py: number, pz: number, yaw: number): void {
    const tx = px + Math.sin(yaw) * 2.2;
    const tz = pz + Math.cos(yaw) * 2.2;
    const id = `dev_test_chest_${this.runtimeSeq++}`;
    const def: TreasureContainerDef = {
      id,
      name: 'Dev Sandbox Cache',
      kind: 'ancient_chest',
      environmentId: this.activeEnvId,
      x: tx,
      y: this.activeEnvId === 'overworld' ? walkableHeightAt(tx, tz) : py,
      z: tz,
      rotY: yaw + Math.PI,
      radius: 2.3,
      grants: [
        { itemId: 'old_coin', quantity: 5 },
        { itemId: 'moonstone_shard', quantity: 2 },
        { itemId: 'amber_shard', quantity: 1 },
      ],
      unlockRecipeIds: ['recipe_warden_tincture'],
      difficultyTier: 'forest',
    };
    const visual = buildTreasureVisual(def, this.palette);
    this.envGroup.add(visual.group);
    this.treasures.push({
      def,
      visual,
      phase: 0,
      isDevTest: true,
    });
  }

  public getDevSnapshot(saveState: ThornvaleSaveState): DevExplorationSnapshot {
    const exp = saveState.exploration ?? createDefaultExplorationSaveData();
    const atm = this.getAtmosphereState();
    return {
      timeOfDay: atm.timeOfDay,
      phase: atm.phase,
      cyclePaused: atm.cyclePaused,
      activatedMechanismsCount: Object.values(exp.activatedMechanisms).filter(Boolean).length,
      totalMechanismsCount: SECRET_MECHANISMS.length,
      openedChestsCount: Object.values(exp.openedChests).filter(Boolean).length,
      totalChestsCount: TREASURE_CONTAINERS.length,
      unlockedRecipesCount: Object.values(exp.unlockedRecipes).filter(Boolean).length,
      journalCount: Object.values(exp.journalEntries).filter(Boolean).length,
      totalJournalCount: JOURNAL_ENTRIES.length,
      activeEvents: this.dynamicEvents.map((ev) => ({
        runtimeId: ev.runtimeId,
        kind: ev.template.kind,
        title: ev.template.title,
        x: Math.round(ev.x * 10) / 10,
        z: Math.round(ev.z * 10) / 10,
        remainingSec: Math.max(0, Math.round(ev.remainingSec)),
        resolved: ev.resolved,
      })),
    };
  }

  public dispose(): void {
    this.clearEnvironmentNodes();
    this.clearAllDynamicEvents();
    this.scene.remove(this.envGroup);
    this.scene.remove(this.eventGroup);
    disposeExplorationPalette(this.palette);
  }
}
