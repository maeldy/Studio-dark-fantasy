import * as THREE from 'three';
import { ForestAudioSystem } from '../audio';
import {
  BOG_CENTER,
  groundSlopeAt,
  PLAYABLE_BOUNDS_RADIUS,
  POND_CENTER,
  streamDistanceAt,
  walkableHeightAt,
} from '../terrain';
import { ProceduralTextures } from '../textures';
import {
  ActiveDialogue,
  AnimalSpecies,
  BoxCollider,
  CircleCollider,
  CreatureSpecies,
  EcosystemStats,
  EntityCategory,
  InteriorId,
  LightAnchor,
  MonsterAiState,
  MonsterSpecies,
  NpcRole,
  ThornvaleSaveState,
  WalkableSurface,
} from '../types';
import { NPC_DIALOGUE_CATALOG, ROLE_FALLBACK_LINES } from './dialogues';
import { buildInteriorSpawns, buildOverworldSpawns, EntitySpawnDef } from './ecosystemLayout';
import {
  buildEntityRig,
  createEntityVisualTextures,
  EntityRig,
  EntityVisualTextures,
} from './entityModels';

// Pre-allocated scratch math helpers (Zero GC in render loop)
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();

function shortestAngleDiff(current: number, target: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

type AnimalState = 'wander' | 'observe' | 'graze' | 'rest' | 'flee' | 'fly' | 'perch' | 'threaten';
type CreatureState = 'lurk' | 'stalk' | 'vanish' | 'reappear' | 'dormant' | 'alert' | 'chase' | 'attack' | 'return';
type NpcState = 'idle' | 'patrol' | 'observe' | 'talk' | 'evade';

export interface SimEntity {
  def: EntitySpawnDef;
  rig: EntityRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  deadTimer: number;
  hitFlashTimer: number;

  // Shared AI timers & targets
  stateTimer: number;
  aiAccum: number;
  phase: number;
  walkCycle: number;
  targetX: number;
  targetZ: number;
  waypointIdx: number;
  blockedTimer: number;
  attackCooldown: number;
  attackWindup: number;
  attackDidHit: boolean;

  // Category-specific states
  animalState: AnimalState;
  creatureState: CreatureState;
  monsterState: MonsterAiState;
  npcState: NpcState;

  // Bird / vertical & opacity
  flyHeight: number;
  opacity: number;
  targetOpacity: number;
  soundCooldown: number;

  // Dynamic light anchor for wisps/spirits
  lightAnchor?: LightAnchor;
}

export interface CombatHitResult {
  hitCount: number;
  killedNames: string[];
  killedEntities: { species: string; category: string }[];
}

export interface EntityUpdateContext {
  dt: number;
  elapsed: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  playerSpeed: number;
  playerCrouching?: boolean;
  lanternOn: boolean;
  isInterior: boolean;
  colliders: CircleCollider[];
  boxColliders: BoxCollider[];
  walkableSurfaces: WalkableSurface[] | null;
  boundsRadius: number;
  talkingNpcId: string | null;
  onPlayerDamaged: (amount: number, knockX: number, knockZ: number) => void;
}

const BIRD_SPECIES = new Set<string>(['crow', 'rook', 'owl', 'barn_owl', 'songbird', 'eagle']);
const PREDATOR_ANIMALS = new Set<string>(['wolf', 'fox', 'bear']);
const PREY_ANIMALS = new Set<string>(['stag', 'doe', 'roe_deer', 'rabbit', 'squirrel', 'mouse']);

const SPECIES_LABELS: Record<string, string> = {
  dire_wolf: 'Dire Wolf',
  thorn_fiend: 'Thorn Fiend',
  night_prowler: 'Night Prowler',
  animated_skeleton: 'Risen Skeleton',
  ruin_wraith: 'Ruin Wraith',
  hollow_husk: 'Hollow Husk',
  giant_spider: 'Giant Spider',
  cave_crawler: 'Cave Crawler',
  stone_colossus: 'Stone Colossus',
  temple_warden: 'Temple Warden',
  stone_guardian: 'Stone Guardian',
  moss_golem: 'Moss Golem',
};

const MONSTER_RESPAWN_MS = 10 * 60 * 1000; // 10 minutes before non-boss monsters return

export class EcosystemManager {
  private overworldGroup: THREE.Group;
  private interiorGroup: THREE.Group;
  private textures: ProceduralTextures;
  private eTex: EntityVisualTextures;
  private audio: ForestAudioSystem;

  private overworldEntities: SimEntity[] = [];
  private interiorEntities: SimEntity[] = [];
  private overworldLightAnchors: LightAnchor[] = [];
  private interiorLightAnchors: LightAnchor[] = [];

  private ambientSoundCooldown = 4.0;
  private nocturnalIntensity = 0;
  private saveState: ThornvaleSaveState;
  private onSaveStateUpdate: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void;

  constructor(
    scene: THREE.Scene,
    textures: ProceduralTextures,
    audio: ForestAudioSystem,
    saveState: ThornvaleSaveState,
    onSaveStateUpdate: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ) {
    this.textures = textures;
    this.eTex = createEntityVisualTextures();
    this.audio = audio;
    this.saveState = saveState;
    this.onSaveStateUpdate = onSaveStateUpdate;

    this.overworldGroup = new THREE.Group();
    this.overworldGroup.name = 'OverworldEcosystem';
    scene.add(this.overworldGroup);

    this.interiorGroup = new THREE.Group();
    this.interiorGroup.name = 'InteriorEcosystem';
    this.interiorGroup.visible = false;
    scene.add(this.interiorGroup);
  }

  public setNocturnalIntensity(val: number): void {
    this.nocturnalIntensity = THREE.MathUtils.clamp(val, 0, 1);
  }

  public syncSaveState(state: ThornvaleSaveState): void {
    this.saveState = state;
  }

  public initOverworld(
    worldSeed: number,
    colliders: CircleCollider[],
    boxColliders: BoxCollider[]
  ): void {
    this.clearEntityList(this.overworldEntities, this.overworldGroup);
    this.overworldLightAnchors = [];

    const defs = buildOverworldSpawns(worldSeed, colliders, boxColliders);
    for (let i = 0; i < defs.length; i++) {
      const entity = this.spawnEntity(defs[i], this.overworldGroup, this.overworldLightAnchors);
      if (entity) this.overworldEntities.push(entity);
    }
  }

  public loadInterior(interiorId: InteriorId): void {
    this.clearEntityList(this.interiorEntities, this.interiorGroup);
    this.interiorLightAnchors = [];
    this.overworldGroup.visible = false;
    this.interiorGroup.visible = true;

    const defs = buildInteriorSpawns(interiorId);
    for (let i = 0; i < defs.length; i++) {
      const entity = this.spawnEntity(defs[i], this.interiorGroup, this.interiorLightAnchors);
      if (entity) this.interiorEntities.push(entity);
    }
  }

  public unloadInterior(): void {
    this.clearEntityList(this.interiorEntities, this.interiorGroup);
    this.interiorLightAnchors = [];
    this.interiorGroup.visible = false;
    this.overworldGroup.visible = true;
  }

  public getDynamicLightAnchors(isInterior: boolean): LightAnchor[] {
    return isInterior ? this.interiorLightAnchors : this.overworldLightAnchors;
  }

  public getStats(isInterior: boolean): EcosystemStats {
    const list = isInterior ? this.interiorEntities : this.overworldEntities;
    let activeAnimals = 0;
    let activeCreatures = 0;
    let activeMonsters = 0;
    let activeNpcs = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || !e.rig.root.visible) continue;
      if (e.def.category === 'animal') activeAnimals++;
      else if (e.def.category === 'creature') activeCreatures++;
      else if (e.def.category === 'monster') activeMonsters++;
      else if (e.def.category === 'npc') activeNpcs++;
    }
    return { activeAnimals, activeCreatures, activeMonsters, activeNpcs };
  }

  public getActiveEntities(isInterior: boolean): SimEntity[] {
    return isInterior ? this.interiorEntities : this.overworldEntities;
  }

  public isActiveCombatNearby(isInterior: boolean): boolean {
    const list = isInterior ? this.interiorEntities : this.overworldEntities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      if (
        e.def.category === 'monster' &&
        (e.monsterState === 'alert' || e.monsterState === 'chase' || e.monsterState === 'attack')
      ) {
        return true;
      }
      if (
        e.def.category === 'creature' &&
        (e.creatureState === 'alert' || e.creatureState === 'chase' || e.creatureState === 'attack')
      ) {
        return true;
      }
    }
    return false;
  }

  public findNearestInteractableNpc(
    isInterior: boolean,
    px: number,
    py: number,
    pz: number
  ): { npcId: string; label: string } | null {
    const list = isInterior ? this.interiorEntities : this.overworldEntities;
    let best: SimEntity | null = null;
    let bestDistSq = 2.85 * 2.85;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.def.category !== 'npc' || !e.alive) continue;
      if (Math.abs(e.y - py) > 1.8) continue;
      const dSq = (e.x - px) ** 2 + (e.z - pz) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = e;
      }
    }
    if (!best) return null;
    const entry = best.def.dialogueId ? NPC_DIALOGUE_CATALOG[best.def.dialogueId] : undefined;
    const label = entry ? `Speak with ${entry.name}` : 'Speak with Traveler';
    return { npcId: best.def.id, label };
  }

  public buildDialogueForNpc(isInterior: boolean, npcId: string): ActiveDialogue | null {
    const list = isInterior ? this.interiorEntities : this.overworldEntities;
    const entity = list.find((e) => e.def.id === npcId);
    if (!entity) return null;

    const entry = entity.def.dialogueId ? NPC_DIALOGUE_CATALOG[entity.def.dialogueId] : undefined;
    const role = (entity.def.species as NpcRole) || 'traveler';

    // Check if any hostile monster is dangerously close to this NPC
    let dangerNearby = false;
    for (let i = 0; i < list.length; i++) {
      const other = list[i];
      if (other.def.category !== 'monster' || !other.alive) continue;
      if (Math.hypot(other.x - entity.x, other.z - entity.z) < 13.0) {
        dangerNearby = true;
        break;
      }
    }

    let lines: string[];
    if (entry) {
      if (dangerNearby && entry.dangerLines.length > 0) {
        lines = [...entry.dangerLines, entry.lines[0]];
      } else {
        const alreadyMet = !!this.saveState.metNpcs?.[npcId];
        lines = alreadyMet ? [...entry.lines] : [...entry.greetings, ...entry.lines];
      }
    } else {
      lines = [...ROLE_FALLBACK_LINES[role]];
    }

    if (!this.saveState.metNpcs?.[npcId]) {
      this.onSaveStateUpdate((prev) => ({
        ...prev,
        metNpcs: { ...(prev.metNpcs ?? {}), [npcId]: true },
      }));
    }

    if (lines.length > 0) {
      this.audio.speakDialogueLine(npcId, role, lines[0]);
    }

    return {
      npcId,
      speakerName: entry ? entry.name : 'Wayfarer',
      speakerTitle: entry ? entry.title : role,
      role,
      lines,
      lineIndex: 0,
    };
  }

  public performPlayerAttack(
    isInterior: boolean,
    px: number,
    py: number,
    pz: number,
    pYaw: number,
    damage = 22
  ): CombatHitResult {
    const list = isInterior ? this.interiorEntities : this.overworldEntities;
    const fwdX = Math.sin(pYaw);
    const fwdZ = Math.cos(pYaw);
    let hitCount = 0;
    const killedNames: string[] = [];
    const killedEntities: { species: string; category: string }[] = [];

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const isHostileTarget =
        e.def.category === 'monster' ||
        (e.def.category === 'creature' && e.maxHp > 0 && e.creatureState !== 'vanish') ||
        (e.def.category === 'animal' && (e.def.species === 'boar' || e.def.species === 'bear' || e.def.species === 'wolf'));
      if (!isHostileTarget) continue;
      if (Math.abs(e.y - py) > 1.8) continue;

      const dx = e.x - px;
      const dz = e.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.65 + e.radius) continue;

      // Forward arc check (generous 140-deg melee cleave)
      const inv = 1 / Math.max(0.001, dist);
      const dot = (dx * inv) * fwdX + (dz * inv) * fwdZ;
      if (dist > 0.9 && dot < 0.25) continue;

      hitCount++;
      e.hp -= damage;
      e.hitFlashTimer = 0.22;
      // Knockback impulse
      e.vx += dx * inv * 4.5;
      e.vz += dz * inv * 4.5;

      // Provoke territorial / passive beasts if struck
      if (e.def.category === 'creature') {
        e.creatureState = 'chase';
      } else if (e.def.category === 'animal') {
        if (e.def.species === 'boar' || e.def.species === 'bear') {
          e.animalState = 'threaten';
          e.stateTimer = 5.0;
        } else {
          e.animalState = 'flee';
          e.stateTimer = 5.0;
        }
      } else if (e.def.category === 'monster') {
        if (e.monsterState === 'rest' || e.monsterState === 'patrol' || e.monsterState === 'return') {
          e.monsterState = 'chase';
        }
      }

      if (e.hp <= 0) {
        e.alive = false;
        e.deadTimer = 0;
        e.rig.contactShadow.visible = false;
        if (e.lightAnchor) e.lightAnchor.baseIntensity = 0;

        if (e.def.uniqueId) {
          const uid = e.def.uniqueId;
          const nowTs = Date.now();
          this.onSaveStateUpdate((prev) => ({
            ...prev,
            defeatedMonsters: { ...(prev.defeatedMonsters ?? {}), [uid]: nowTs },
          }));
        }

        const label = SPECIES_LABELS[e.def.species] ?? e.def.species;
        killedNames.push(label);
        killedEntities.push({ species: e.def.species, category: e.def.category });
      }
    }

    if (hitCount > 0) {
      this.audio.playEcosystemCue('sword_hit');
    }
    return { hitCount, killedNames, killedEntities };
  }

  private spawnEntity(
    def: EntitySpawnDef,
    parent: THREE.Group,
    lightAnchors: LightAnchor[]
  ): SimEntity | null {
    // Check persistent monster defeat timestamp so killed creatures do not instantly respawn
    if (def.uniqueId && this.saveState.defeatedMonsters?.[def.uniqueId]) {
      const killedAt = this.saveState.defeatedMonsters[def.uniqueId];
      if (Date.now() - killedAt < MONSTER_RESPAWN_MS) {
        return null;
      }
    }

    const rig = buildEntityRig(def.category, def.species, this.textures, this.eTex);
    rig.root.position.set(def.x, def.y, def.z);
    rig.root.rotation.y = def.yaw ?? 0;
    parent.add(rig.root);

    const isSmall =
      def.species === 'rabbit' ||
      def.species === 'squirrel' ||
      def.species === 'hedgehog' ||
      def.species === 'mouse' ||
      BIRD_SPECIES.has(def.species);

    const radius =
      def.species === 'bear' || def.species === 'stone_colossus' || def.species === 'moss_golem'
        ? 0.72
        : isSmall
          ? 0.25
          : 0.45;

    const maxHp =
      def.maxHp ??
      (def.category === 'monster'
        ? 50
        : def.species === 'bear'
          ? 70
          : def.species === 'boar'
            ? 38
            : def.category === 'creature'
              ? 80
              : 30);

    let lightAnchor: LightAnchor | undefined;
    if (def.glowColor && def.glowIntensity) {
      lightAnchor = {
        x: def.x,
        y: def.y + 1.1,
        z: def.z,
        color: def.glowColor,
        baseIntensity: def.glowIntensity,
        distance: def.glowDistance ?? 7.0,
        phase: Math.abs(def.x * 0.37 + def.z * 0.51) % 6.28,
        tag: `entity_${def.id}`,
      };
      lightAnchors.push(lightAnchor);
    }

    const isBird = BIRD_SPECIES.has(def.species);
    const isEagle = def.species === 'eagle';

    return {
      def,
      rig,
      x: def.x,
      y: def.y,
      z: def.z,
      vx: 0,
      vz: 0,
      yaw: def.yaw ?? 0,
      radius,
      hp: maxHp,
      maxHp,
      alive: true,
      deadTimer: 0,
      hitFlashTimer: 0,
      stateTimer: 1.5 + ((Math.abs(def.x * 13 + def.z * 7) % 10) * 0.35),
      aiAccum: Math.random() * 0.14,
      phase: Math.abs(def.x * 0.73 + def.z * 1.19) % 6.28,
      walkCycle: 0,
      targetX: def.x,
      targetZ: def.z,
      waypointIdx: 0,
      blockedTimer: 0,
      attackCooldown: 0,
      attackWindup: 0,
      attackDidHit: false,
      animalState: isEagle ? 'fly' : isBird ? 'perch' : 'wander',
      creatureState: def.territorialOnly ? 'dormant' : 'lurk',
      monsterState:
        def.species === 'giant_spider' || def.territorialOnly ? 'rest' : 'patrol',
      npcState: def.waypoints && def.waypoints.length > 1 ? 'patrol' : 'idle',
      flyHeight: isEagle ? 6.2 : def.perchY !== undefined ? Math.max(0, def.perchY - walkableHeightAt(def.x, def.z)) : 0,
      opacity: def.species === 'fog_apparition' ? 0.58 : 1,
      targetOpacity: def.species === 'fog_apparition' ? 0.58 : 1,
      soundCooldown: 4 + Math.random() * 8,
      lightAnchor,
    };
  }

  public update(ctx: EntityUpdateContext): void {
    const list = ctx.isInterior ? this.interiorEntities : this.overworldEntities;
    if (this.ambientSoundCooldown > 0) this.ambientSoundCooldown -= ctx.dt;

    for (let i = 0; i < list.length; i++) {
      const e = list[i];

      // Handle defeated fade-out cleanly
      if (!e.alive) {
        e.deadTimer += ctx.dt;
        if (e.deadTimer < 0.75) {
          const t = e.deadTimer / 0.75;
          e.rig.bodyPivot.rotation.x = t * 1.35;
          e.rig.bodyPivot.position.y = THREE.MathUtils.lerp(e.rig.baseBodyY, 0.15, t);
          if (e.rig.kneePivots) {
            for (let k = 0; k < e.rig.kneePivots.length; k++) {
              e.rig.kneePivots[k].rotation.x = t * 0.65;
            }
          }
          if (e.rig.arms.length === 2) {
            e.rig.arms[0].rotation.x = -t * 0.4;
            e.rig.arms[1].rotation.x = t * 0.35;
          }
        } else {
          e.rig.root.visible = false;
        }
        continue;
      }

      const distSq = (e.x - ctx.playerX) ** 2 + (e.z - ctx.playerZ) ** 2;
      const maxActiveDistSq = ctx.isInterior ? 48 * 48 : 66 * 66;

      if (distSq > maxActiveDistSq) {
        e.rig.root.visible = false;
        continue;
      }
      e.rig.root.visible = true;

      const isNear = distSq < 32 * 32;
      if (!isNear) {
        e.aiAccum += ctx.dt;
        if (e.aiAccum < 0.14) {
          continue;
        }
      }
      const stepDt = isNear ? ctx.dt : Math.min(0.16, e.aiAccum);
      e.aiAccum = 0;

      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - stepDt);
      if (e.soundCooldown > 0) e.soundCooldown -= stepDt;
      if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - stepDt);

      if (e.def.category === 'animal') {
        this.updateAnimal(e, list, ctx, stepDt, isNear);
      } else if (e.def.category === 'creature') {
        this.updateCreature(e, ctx, stepDt, isNear);
      } else if (e.def.category === 'monster') {
        this.updateMonster(e, list, ctx, stepDt);
      } else if (e.def.category === 'npc') {
        this.updateNpc(e, list, ctx, stepDt);
      }

      // Sync position, ground height & light anchor
      e.rig.root.position.set(e.x, e.y + e.flyHeight, e.z);
      e.rig.root.rotation.y = e.yaw;

      if (e.lightAnchor) {
        e.lightAnchor.x = e.x;
        e.lightAnchor.y = e.y + e.flyHeight + 1.1;
        e.lightAnchor.z = e.z;
        const nightGlowBoost = ctx.isInterior ? 1 : 1 + this.nocturnalIntensity * 0.45;
        e.lightAnchor.baseIntensity =
          (e.def.glowIntensity ?? 1.2) * e.opacity * nightGlowBoost;
      }

      // Smooth fade for ghostly creatures
      if (e.rig.fadeMaterials.length > 0) {
        e.opacity = THREE.MathUtils.damp(e.opacity, e.targetOpacity, 4.5, stepDt);
        for (let m = 0; m < e.rig.fadeMaterials.length; m++) {
          (e.rig.fadeMaterials[m] as THREE.MeshLambertMaterial).opacity = e.opacity;
        }
        e.rig.root.visible = e.opacity > 0.04;
      }

      // Hit recoil scale pulse
      if (e.hitFlashTimer > 0) {
        const s = 1 + Math.sin((e.hitFlashTimer / 0.22) * Math.PI) * 0.14;
        e.rig.bodyPivot.scale.set(s, 1 / Math.sqrt(s), s);
      } else {
        e.rig.bodyPivot.scale.set(1, 1, 1);
      }

      if (isNear) {
        this.animateEntityRig(e, ctx.elapsed, stepDt);
      }
    }
  }

  // ==========================================================================
  // 1. WILDLIFE BEHAVIOR & INTER-ANIMAL ECOLOGY
  // ==========================================================================
  private updateAnimal(
    e: SimEntity,
    all: SimEntity[],
    ctx: EntityUpdateContext,
    dt: number,
    isNear: boolean
  ): void {
    const sp = e.def.species as AnimalSpecies;
    const isBird = BIRD_SPECIES.has(sp);
    const isPredator = PREDATOR_ANIMALS.has(sp);
    const isPrey = PREY_ANIMALS.has(sp);

    const dxP = e.x - ctx.playerX;
    const dzP = e.z - ctx.playerZ;
    const distP = Math.hypot(dxP, dzP);
    const stealthMult = ctx.playerCrouching ? 0.62 : 1.0;
    const playerThreatDist =
      (sp === 'rabbit' || sp === 'mouse'
        ? 7.5
        : isBird
          ? 7.0
          : sp === 'boar'
            ? 5.0
            : sp === 'bear'
              ? 6.0
              : ctx.playerSpeed > 4.2
                ? 11.5
                : 7.5) * stealthMult;

    // Inter-entity danger detection (predators, monsters, large animals scaring birds)
    let dangerX = 0;
    let dangerZ = 0;
    let dangerDist = Infinity;
    let preyTarget: SimEntity | null = null;
    let preyDist = 14.0;

    if (isNear) {
      for (let i = 0; i < all.length; i++) {
        const other = all[i];
        if (other === e || !other.alive || !other.rig.root.visible) continue;
        const d = Math.hypot(other.x - e.x, other.z - e.z);
        if (other.def.category === 'monster' && d < 12.0 && d < dangerDist) {
          dangerDist = d;
          dangerX = other.x;
          dangerZ = other.z;
        } else if (isPrey && PREDATOR_ANIMALS.has(other.def.species) && d < 10.5 && d < dangerDist) {
          dangerDist = d;
          dangerX = other.x;
          dangerZ = other.z;
        } else if (isBird && (other.def.category === 'monster' || other.def.species === 'bear' || other.def.species === 'wolf' || other.def.species === 'stag') && d < 6.5 && d < dangerDist) {
          dangerDist = d;
          dangerX = other.x;
          dangerZ = other.z;
        } else if (isPredator && sp === 'wolf' && PREY_ANIMALS.has(other.def.species) && d < preyDist) {
          preyDist = d;
          preyTarget = other;
        }
      }
    }

    if (distP < playerThreatDist && distP < dangerDist) {
      dangerDist = distP;
      dangerX = ctx.playerX;
      dangerZ = ctx.playerZ;
    }

    // Bird Flight & Perch State Machine
    if (isBird) {
      const isEagle = sp === 'eagle';
      if (isEagle) {
        // Eagles soar in majestic loops above crags/ridges
        e.animalState = 'fly';
        const angle = ctx.elapsed * 0.34 + e.phase;
        const rx = e.def.x + Math.cos(angle) * 14;
        const rz = e.def.z + Math.sin(angle) * 14;
        const dirX = rx - e.x;
        const dirZ = rz - e.z;
        const dLen = Math.hypot(dirX, dirZ) || 1;
        e.vx = (dirX / dLen) * 5.2;
        e.vz = (dirZ / dLen) * 5.2;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.y = walkableHeightAt(e.x, e.z);
        e.flyHeight = 6.4 + Math.sin(ctx.elapsed * 0.8 + e.phase) * 1.1;
        e.yaw = Math.atan2(e.vx, e.vz);
        if (e.soundCooldown <= 0 && distP < 28 && this.ambientSoundCooldown <= 0) {
          this.audio.playEcosystemCue('eagle', distP);
          e.soundCooldown = 12 + Math.random() * 12;
          this.ambientSoundCooldown = 4.0;
        }
        return;
      }

      if (e.animalState !== 'fly' && dangerDist < 6.8) {
        e.animalState = 'fly';
        e.stateTimer = 4.5 + Math.random() * 2.5;
        const awayX = e.x - dangerX;
        const awayZ = e.z - dangerZ;
        const len = Math.hypot(awayX, awayZ) || 1;
        e.targetX = e.x + (awayX / len) * 14;
        e.targetZ = e.z + (awayZ / len) * 14;
        if (this.ambientSoundCooldown <= 0 && distP < 18) {
          this.audio.playEcosystemCue(
            sp === 'owl' || sp === 'barn_owl' ? 'owl' : sp === 'songbird' ? 'songbird' : 'crow',
            distP
          );
          this.ambientSoundCooldown = 4.5;
        }
      }

      if (e.animalState === 'fly') {
        e.stateTimer -= dt;
        const tx = e.targetX - e.x;
        const tz = e.targetZ - e.z;
        const dist = Math.hypot(tx, tz) || 1;
        const speed = 5.4;
        e.vx = (tx / dist) * speed;
        e.vz = (tz / dist) * speed;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.y = walkableHeightAt(e.x, e.z);
        const targetFlyH = e.stateTimer > 1.2 ? 4.5 : 0.05;
        e.flyHeight = THREE.MathUtils.damp(e.flyHeight, targetFlyH, 2.8, dt);
        e.yaw += shortestAngleDiff(e.yaw, Math.atan2(e.vx, e.vz)) * (1 - Math.exp(-8 * dt));
        if (e.stateTimer <= 0 && e.flyHeight < 0.25) {
          e.flyHeight = 0;
          e.animalState = 'perch';
          e.stateTimer = 3.5 + Math.random() * 4;
          e.vx = 0;
          e.vz = 0;
        }
        return;
      }

      // Perching / hopping quietly
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.stateTimer = 2.0 + Math.random() * 3.5;
        if (Math.random() < 0.45) {
          const ang = Math.random() * Math.PI * 2;
          const r = 1.5 + Math.random() * 3.5;
          e.targetX = e.def.x + Math.cos(ang) * r;
          e.targetZ = e.def.z + Math.sin(ang) * r;
          e.animalState = 'wander';
        } else {
          e.animalState = 'perch';
          e.vx = 0;
          e.vz = 0;
        }
      }
      if (e.animalState === 'wander') {
        this.steerToward(e, e.targetX, e.targetZ, 1.45, ctx, dt);
        if (Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 0.4) {
          e.animalState = 'perch';
          e.vx = 0;
          e.vz = 0;
        }
      }
      if (e.soundCooldown <= 0 && distP < 24 && this.ambientSoundCooldown <= 0) {
        const isOwl = sp === 'owl' || sp === 'barn_owl';
        const allowCall =
          (isOwl && this.nocturnalIntensity > 0.25) ||
          (sp === 'songbird' && this.nocturnalIntensity < 0.7) ||
          (!isOwl && sp !== 'songbird');
        if (allowCall) {
          this.audio.playEcosystemCue(
            isOwl ? 'owl' : sp === 'songbird' ? 'songbird' : 'crow',
            distP
          );
          e.soundCooldown = 8 + Math.random() * 10;
          this.ambientSoundCooldown = 3.5;
        }
      }
      return;
    }

    // Boar / Bear Threaten reaction when cornered
    if ((sp === 'boar' || sp === 'bear') && distP < (sp === 'bear' ? 5.2 : 3.6) && e.animalState !== 'threaten') {
      e.animalState = 'threaten';
      e.stateTimer = 4.0;
      if (this.ambientSoundCooldown <= 0) {
        this.audio.playEcosystemCue(sp === 'bear' ? 'bear_roar' : 'boar_snort', distP);
        this.ambientSoundCooldown = 3.0;
      }
    }

    if (e.animalState === 'threaten') {
      e.stateTimer -= dt;
      if (distP > 9.5 || e.stateTimer <= 0) {
        e.animalState = 'wander';
        e.stateTimer = 2.0;
      } else {
        const speed = sp === 'bear' ? 3.4 : 4.2;
        this.steerToward(e, ctx.playerX, ctx.playerZ, speed, ctx, dt);
        if (distP < 1.35 + e.radius && e.attackCooldown <= 0) {
          e.attackCooldown = 1.4;
          const inv = 1 / Math.max(0.01, distP);
          ctx.onPlayerDamaged(sp === 'bear' ? 14 : 8, (dxP * inv) * 4, (dzP * inv) * 4);
        }
        return;
      }
    }

    // Fleeing from Player or Predator/Monster
    if (dangerDist < playerThreatDist && sp !== 'bear') {
      if (e.animalState !== 'flee' && distP < 16 && this.ambientSoundCooldown <= 0) {
        this.audio.playEcosystemCue('rustle', distP);
        this.ambientSoundCooldown = 2.2;
      }
      e.animalState = 'flee';
      e.stateTimer = 3.2;
      const ax = e.x - dangerX;
      const az = e.z - dangerZ;
      const len = Math.hypot(ax, az) || 1;
      e.targetX = e.x + (ax / len) * 14;
      e.targetZ = e.z + (az / len) * 14;
    }

    if (e.animalState === 'flee') {
      e.stateTimer -= dt;
      const fleeSpeed =
        sp === 'stag' || sp === 'doe' || sp === 'roe_deer'
          ? 5.6
          : sp === 'rabbit' || sp === 'fox'
            ? 5.2
            : 4.3;
      this.steerToward(e, e.targetX, e.targetZ, fleeSpeed, ctx, dt);
      if (e.stateTimer <= 0 && dangerDist > playerThreatDist + 3.5) {
        e.animalState = 'observe';
        e.stateTimer = 2.0;
        e.vx = 0;
        e.vz = 0;
      }
      return;
    }

    // Wolf hunting nearby prey if no danger + occasional wolf growl
    if (sp === 'wolf' && preyTarget && preyDist < 12.0) {
      if (e.soundCooldown <= 0 && distP < 20 && this.ambientSoundCooldown <= 0) {
        this.audio.playEcosystemCue('wolf_growl', distP);
        e.soundCooldown = 9 + Math.random() * 8;
        this.ambientSoundCooldown = 3.5;
      }
      this.steerToward(e, preyTarget.x, preyTarget.z, 3.8, ctx, dt);
      return;
    }

    // Autonomous organic states: wander -> observe -> graze -> rest
    e.stateTimer -= dt;
    if (e.stateTimer <= 0) {
      const r = Math.random();
      if (r < 0.45) {
        e.animalState = 'wander';
        e.stateTimer = 2.5 + Math.random() * 4.5;
        // Herd cohesion if part of a herd
        let anchorX = e.def.x;
        let anchorZ = e.def.z;
        if (e.def.herdId) {
          for (let i = 0; i < all.length; i++) {
            const mate = all[i];
            if (mate !== e && mate.alive && mate.def.herdId === e.def.herdId) {
              anchorX = THREE.MathUtils.lerp(e.def.x, mate.x, 0.55);
              anchorZ = THREE.MathUtils.lerp(e.def.z, mate.z, 0.55);
              break;
            }
          }
        }
        const rad = (e.def.patrolRadius ?? 8) * (0.35 + Math.random() * 0.65);
        const ang = Math.random() * Math.PI * 2;
        e.targetX = anchorX + Math.cos(ang) * rad;
        e.targetZ = anchorZ + Math.sin(ang) * rad;
      } else if (r < 0.72) {
        e.animalState = 'graze';
        e.stateTimer = 2.2 + Math.random() * 3.0;
        e.vx = 0;
        e.vz = 0;
      } else if (r < 0.9) {
        e.animalState = 'observe';
        e.stateTimer = 1.6 + Math.random() * 2.4;
        e.vx = 0;
        e.vz = 0;
      } else {
        e.animalState = 'rest';
        e.stateTimer = 3.0 + Math.random() * 4.0;
        e.vx = 0;
        e.vz = 0;
      }
    }

    if (e.animalState === 'wander') {
      const strollSpeed =
        sp === 'bear' ? 1.55 : sp === 'boar' ? 1.7 : sp === 'mouse' || sp === 'hedgehog' ? 1.25 : 2.1;
      this.steerToward(e, e.targetX, e.targetZ, strollSpeed, ctx, dt);
      if (Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 0.65) {
        e.animalState = 'observe';
        e.stateTimer = 1.8 + Math.random() * 2.0;
        e.vx = 0;
        e.vz = 0;
      }
    } else {
      e.vx = THREE.MathUtils.damp(e.vx, 0, 8, dt);
      e.vz = THREE.MathUtils.damp(e.vz, 0, 8, dt);
    }
  }

  // ==========================================================================
  // 2. FANTASTIC & MYSTERIOUS CREATURES
  // ==========================================================================
  private updateCreature(
    e: SimEntity,
    ctx: EntityUpdateContext,
    dt: number,
    isNear: boolean
  ): void {
    const sp = e.def.species as CreatureSpecies;
    const dx = ctx.playerX - e.x;
    const dz = ctx.playerZ - e.z;
    const dist = Math.hypot(dx, dz);

    // Territorial stone guardians / moss golems behave like silent statues until trespassed
    if (sp === 'stone_guardian' || sp === 'moss_golem') {
      const aggro = e.def.aggroRadius ?? 4.8;
      const leash = e.def.leashRadius ?? 11;
      const distHome = Math.hypot(e.x - e.def.x, e.z - e.def.z);

      if (e.creatureState === 'dormant') {
        e.vx = 0;
        e.vz = 0;
        if (dist < aggro) {
          e.creatureState = 'alert';
          e.stateTimer = 0.7;
          this.audio.playEcosystemCue('monster_alert');
        }
        return;
      }
      if (e.creatureState === 'alert') {
        e.stateTimer -= dt;
        const desired = Math.atan2(dx, dz);
        e.yaw += shortestAngleDiff(e.yaw, desired) * (1 - Math.exp(-7 * dt));
        if (e.stateTimer <= 0) e.creatureState = 'chase';
        return;
      }
      if (e.creatureState === 'chase') {
        if (dist > leash + 3 || distHome > leash) {
          e.creatureState = 'return';
          return;
        }
        if (dist < 1.85) {
          e.creatureState = 'attack';
          e.attackWindup = 0.45;
          e.attackDidHit = false;
          return;
        }
        this.steerToward(e, ctx.playerX, ctx.playerZ, 2.35, ctx, dt);
        return;
      }
      if (e.creatureState === 'attack') {
        e.attackWindup -= dt;
        e.yaw += shortestAngleDiff(e.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-10 * dt));
        if (!e.attackDidHit && e.attackWindup <= 0.12) {
          e.attackDidHit = true;
          if (dist < 2.25) {
            const inv = 1 / Math.max(0.01, dist);
            ctx.onPlayerDamaged(e.def.attackDamage ?? 18, (-dx * inv) * 5, (-dz * inv) * 5);
          }
        }
        if (e.attackWindup <= -0.55) {
          e.creatureState = 'chase';
        }
        return;
      }
      if (e.creatureState === 'return') {
        this.steerToward(e, e.def.x, e.def.z, 2.0, ctx, dt);
        if (distHome < 0.7) {
          e.creatureState = 'dormant';
          e.vx = 0;
          e.vz = 0;
        }
        return;
      }
    }

    // Ethereal mist spirits / pale stag / fog apparitions
    if (sp === 'forest_spirit' || sp === 'pale_stag' || sp === 'fog_apparition' || sp === 'wisp_entity') {
      if (e.creatureState === 'vanish') {
        e.targetOpacity = 0;
        e.stateTimer -= dt;
        if (e.stateTimer <= 0 && dist > 18) {
          // Relocate gently around home glade
          const ang = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * (e.def.patrolRadius ?? 7);
          e.x = e.def.x + Math.cos(ang) * r;
          e.z = e.def.z + Math.sin(ang) * r;
          e.y = ctx.isInterior ? e.def.y : walkableHeightAt(e.x, e.z);
          e.creatureState = 'lurk';
          e.targetOpacity = sp === 'fog_apparition' ? 0.58 : 0.88;
        }
        return;
      }

      // React to close approach or strong lantern light at short range
      if ((ctx.lanternOn && dist < 6.8 && sp !== 'wisp_entity') || dist < 3.5) {
        e.creatureState = 'vanish';
        e.stateTimer = 8.0 + Math.random() * 5.0;
        if (this.ambientSoundCooldown <= 0) {
          this.audio.playEcosystemCue('spirit_chime', dist);
          this.ambientSoundCooldown = 5.0;
        }
        return;
      }

      // Watch player quietly from mist, or drift gracefully
      if (dist < 18 && isNear) {
        const desiredYaw = Math.atan2(dx, dz);
        e.yaw += shortestAngleDiff(e.yaw, desiredYaw) * (1 - Math.exp(-3.5 * dt));
      }

      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.stateTimer = 3.5 + Math.random() * 4.0;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * (e.def.patrolRadius ?? 7);
        e.targetX = e.def.x + Math.cos(ang) * r;
        e.targetZ = e.def.z + Math.sin(ang) * r;
      }
      if (Math.hypot(e.targetX - e.x, e.targetZ - e.z) > 0.8) {
        this.steerToward(e, e.targetX, e.targetZ, sp === 'wisp_entity' ? 1.65 : 1.2, ctx, dt);
      }
      return;
    }

    // Shy stalkers (tree_sprite, shadow_stalker, moss_dryad): approach ONLY when player is still
    if (dist < 15 && ctx.playerSpeed < 0.25) {
      if (dist > 4.5) {
        this.steerToward(e, ctx.playerX, ctx.playerZ, 1.45, ctx, dt);
      } else {
        const desired = Math.atan2(dx, dz);
        e.yaw += shortestAngleDiff(e.yaw, desired) * (1 - Math.exp(-4 * dt));
        e.vx = 0;
        e.vz = 0;
      }
    } else if (dist < 7.5 && ctx.playerSpeed > 1.2) {
      // Dart away behind cover when player rushes
      const ax = e.x - ctx.playerX;
      const az = e.z - ctx.playerZ;
      const len = Math.hypot(ax, az) || 1;
      this.steerToward(e, e.x + (ax / len) * 8, e.z + (az / len) * 8, 3.6, ctx, dt);
    } else {
      e.vx = THREE.MathUtils.damp(e.vx, 0, 6, dt);
      e.vz = THREE.MathUtils.damp(e.vz, 0, 6, dt);
    }
  }

  // ==========================================================================
  // 3. HOSTILE MONSTERS — FULL 8-STATE AI + LINE-OF-SIGHT + WALL COLLISIONS
  // ==========================================================================
  private updateMonster(
    e: SimEntity,
    all: SimEntity[],
    ctx: EntityUpdateContext,
    dt: number
  ): void {
    const sp = e.def.species as MonsterSpecies;
    const dx = ctx.playerX - e.x;
    const dz = ctx.playerZ - e.z;
    const dist = Math.hypot(dx, dz);
    const heightDiff = Math.abs(ctx.playerY - e.y);
    const distFromHome = Math.hypot(e.x - e.def.x, e.z - e.def.z);

    const nightDetectMult = ctx.isInterior ? 1 : 1 + this.nocturnalIntensity * 0.16;
    const stealthMult = ctx.playerCrouching ? 0.64 : 1.0;
    const aggroR =
      (e.def.aggroRadius ?? 9.0) * (ctx.lanternOn ? 1.1 : 0.88) * nightDetectMult * stealthMult;
    const leashR = e.def.leashRadius ?? 18.0;
    const moveSpd = e.def.moveSpeed ?? 3.2;
    const attackRange = sp === 'stone_colossus' || sp === 'temple_warden' ? 2.1 : 1.65;

    // Periodic ambient monster vocalization / heavy breathing when patrolling or chasing nearby
    if (e.soundCooldown <= 0 && dist < 20 && this.ambientSoundCooldown <= 0) {
      const spCue =
        sp === 'giant_spider' || sp === 'cave_crawler'
          ? 'spider_chitter'
          : sp === 'animated_skeleton' || sp === 'hollow_husk'
            ? 'skeleton_rattle'
            : sp === 'ruin_wraith'
              ? 'wraith_wail'
              : sp === 'stone_colossus' || sp === 'temple_warden'
                ? 'colossus_breath'
                : 'wolf_growl';
      this.audio.playEcosystemCue(spCue, dist);
      e.soundCooldown = 7 + Math.random() * 8;
      this.ambientSoundCooldown = 3.2;
    }

    const canSeePlayer =
      dist <= aggroR &&
      heightDiff < 2.2 &&
      this.hasLineOfSight(e.x, e.z, ctx.playerX, ctx.playerZ, ctx.boxColliders, e.y);

    switch (e.monsterState) {
      case 'rest': {
        e.vx = 0;
        e.vz = 0;
        if (canSeePlayer && (dist < aggroR * 0.78 || !e.def.territorialOnly)) {
          e.monsterState = 'detect';
          e.stateTimer = 0.35;
        } else if (!e.def.territorialOnly && sp !== 'giant_spider') {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.monsterState = 'patrol';
            e.stateTimer = 4.0;
          }
        }
        break;
      }

      case 'patrol': {
        if (canSeePlayer) {
          e.monsterState = 'detect';
          e.stateTimer = 0.32;
          break;
        }
        e.stateTimer -= dt;
        if (e.stateTimer <= 0 || Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 0.7) {
          const ang = Math.random() * Math.PI * 2;
          const r = (e.def.patrolRadius ?? 5) * (0.4 + Math.random() * 0.6);
          e.targetX = e.def.x + Math.cos(ang) * r;
          e.targetZ = e.def.z + Math.sin(ang) * r;
          e.stateTimer = 3.5 + Math.random() * 3.5;
        }
        this.steerToward(e, e.targetX, e.targetZ, moveSpd * 0.52, ctx, dt);
        break;
      }

      case 'detect': {
        e.vx = 0;
        e.vz = 0;
        e.yaw += shortestAngleDiff(e.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-9 * dt));
        e.stateTimer -= dt;
        if (!canSeePlayer && dist > aggroR * 1.15) {
          e.monsterState = 'patrol';
          break;
        }
        if (e.stateTimer <= 0) {
          e.monsterState = 'alert';
          e.stateTimer = 0.45;
          e.blockedTimer = 0;
          const alertCue =
            sp === 'dire_wolf'
              ? 'wolf_growl'
              : sp === 'giant_spider' || sp === 'cave_crawler'
                ? 'spider_chitter'
                : sp === 'animated_skeleton'
                  ? 'skeleton_rattle'
                  : sp === 'ruin_wraith'
                    ? 'wraith_wail'
                    : 'monster_alert';
          this.audio.playEcosystemCue(alertCue, dist);
          // Pack alert for dire wolves
          if (e.def.herdId) {
            for (let i = 0; i < all.length; i++) {
              const mate = all[i];
              if (
                mate !== e &&
                mate.alive &&
                mate.def.herdId === e.def.herdId &&
                (mate.monsterState === 'rest' || mate.monsterState === 'patrol')
              ) {
                mate.monsterState = 'alert';
                mate.stateTimer = 0.4;
              }
            }
          }
        }
        break;
      }

      case 'alert': {
        e.vx = 0;
        e.vz = 0;
        e.yaw += shortestAngleDiff(e.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-10 * dt));
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.monsterState = 'chase';
        }
        break;
      }

      case 'chase': {
        if (distFromHome > leashR || dist > leashR + 3.0 || heightDiff > 2.8) {
          e.monsterState = 'disengage';
          e.stateTimer = 0.9;
          break;
        }
        if (dist <= attackRange && e.attackCooldown <= 0) {
          e.monsterState = 'attack';
          e.attackWindup = 0.36;
          e.attackDidHit = false;
          e.vx = 0;
          e.vz = 0;
          break;
        }
        const prevX = e.x;
        const prevZ = e.z;
        this.steerToward(e, ctx.playerX, ctx.playerZ, moveSpd, ctx, dt);
        const moved = Math.hypot(e.x - prevX, e.z - prevZ);
        if (moved < moveSpd * dt * 0.14) {
          e.blockedTimer += dt;
          if (e.blockedTimer > 2.2) {
            e.monsterState = 'disengage';
            e.stateTimer = 1.0;
          }
        } else {
          e.blockedTimer = Math.max(0, e.blockedTimer - dt * 1.5);
        }
        break;
      }

      case 'attack': {
        e.vx = THREE.MathUtils.damp(e.vx, 0, 10, dt);
        e.vz = THREE.MathUtils.damp(e.vz, 0, 10, dt);
        e.yaw += shortestAngleDiff(e.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-12 * dt));
        e.attackWindup -= dt;
        if (!e.attackDidHit && e.attackWindup <= 0) {
          e.attackDidHit = true;
          if (dist <= attackRange + 0.45 && heightDiff < 1.8) {
            const inv = 1 / Math.max(0.01, dist);
            ctx.onPlayerDamaged(e.def.attackDamage ?? 12, (-dx * inv) * 4.5, (-dz * inv) * 4.5);
          }
          e.attackCooldown = sp === 'stone_colossus' ? 1.5 : 1.05;
        }
        if (e.attackWindup <= -0.42) {
          e.monsterState = 'chase';
        }
        break;
      }

      case 'disengage': {
        e.vx = 0;
        e.vz = 0;
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.monsterState = 'return';
          e.blockedTimer = 0;
        }
        break;
      }

      case 'return': {
        e.hp = Math.min(e.maxHp, e.hp + 4 * dt);
        if (dist < aggroR * 0.65 && canSeePlayer && distFromHome < leashR * 0.5) {
          e.monsterState = 'chase';
          break;
        }
        this.steerToward(e, e.def.x, e.def.z, moveSpd * 0.72, ctx, dt);
        if (distFromHome < 0.8) {
          e.monsterState = e.def.territorialOnly || sp === 'giant_spider' ? 'rest' : 'patrol';
          e.vx = 0;
          e.vz = 0;
        }
        break;
      }
    }
  }

  // ==========================================================================
  // 4. AUTONOMOUS NPCs & REACTIONS
  // ==========================================================================
  private updateNpc(
    e: SimEntity,
    all: SimEntity[],
    ctx: EntityUpdateContext,
    dt: number
  ): void {
    const dxP = ctx.playerX - e.x;
    const dzP = ctx.playerZ - e.z;
    const distP = Math.hypot(dxP, dzP);

    // Pause and face player during dialogue
    if (ctx.talkingNpcId === e.def.id) {
      e.npcState = 'talk';
      e.vx = 0;
      e.vz = 0;
      const desired = Math.atan2(dxP, dzP);
      e.yaw += shortestAngleDiff(e.yaw, desired) * (1 - Math.exp(-8 * dt));
      return;
    }

    // Check nearby monster threat
    let nearestThreat: SimEntity | null = null;
    let threatDist = 10.5;
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      if (m.def.category !== 'monster' || !m.alive) continue;
      const d = Math.hypot(m.x - e.x, m.z - e.z);
      if (d < threatDist) {
        threatDist = d;
        nearestThreat = m;
      }
    }

    if (nearestThreat && e.def.species !== 'guard') {
      e.npcState = 'evade';
      const ax = e.x - nearestThreat.x;
      const az = e.z - nearestThreat.z;
      const len = Math.hypot(ax, az) || 1;
      this.steerToward(e, e.x + (ax / len) * 6, e.z + (az / len) * 6, 2.75, ctx, dt);
      return;
    }

    if (e.npcState === 'talk' || e.npcState === 'evade') {
      e.npcState = 'idle';
      e.stateTimer = 2.0;
    }

    // Look toward player subtly when player approaches within greeting distance
    if (distP < 5.5) {
      const targetHead = shortestAngleDiff(e.yaw, Math.atan2(dxP, dzP));
      const clampedHead = THREE.MathUtils.clamp(targetHead, -0.75, 0.75);
      e.rig.headPivot.rotation.y = THREE.MathUtils.damp(e.rig.headPivot.rotation.y, clampedHead, 6, dt);
    } else {
      const scan = Math.sin(ctx.elapsed * 0.9 + e.phase) * 0.28;
      e.rig.headPivot.rotation.y = THREE.MathUtils.damp(e.rig.headPivot.rotation.y, scan, 4, dt);
    }

    // Waypoint patrol or organic stroll near post
    e.stateTimer -= dt;
    if (e.stateTimer <= 0) {
      if (e.def.waypoints && e.def.waypoints.length > 1) {
        if (e.npcState === 'patrol') {
          e.npcState = 'observe';
          e.stateTimer = 2.2 + Math.random() * 2.5;
          e.vx = 0;
          e.vz = 0;
        } else {
          e.waypointIdx = (e.waypointIdx + 1) % e.def.waypoints.length;
          e.targetX = e.def.waypoints[e.waypointIdx].x;
          e.targetZ = e.def.waypoints[e.waypointIdx].z;
          e.npcState = 'patrol';
          e.stateTimer = 6.0;
        }
      } else if ((e.def.patrolRadius ?? 0) > 1.2) {
        if (e.npcState === 'idle' || e.npcState === 'observe') {
          const ang = Math.random() * Math.PI * 2;
          const r = 0.8 + Math.random() * ((e.def.patrolRadius ?? 2.5) - 0.5);
          e.targetX = e.def.x + Math.cos(ang) * r;
          e.targetZ = e.def.z + Math.sin(ang) * r;
          e.npcState = 'patrol';
          e.stateTimer = 4.5;
        } else {
          e.npcState = 'idle';
          e.stateTimer = 3.0 + Math.random() * 3.5;
          e.vx = 0;
          e.vz = 0;
        }
      }
    }

    if (e.npcState === 'patrol') {
      // Avoid crowding player
      if (distP < 1.55) {
        e.vx = 0;
        e.vz = 0;
      } else {
        this.steerToward(e, e.targetX, e.targetZ, 1.38, ctx, dt);
        if (Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 0.45) {
          e.npcState = 'observe';
          e.stateTimer = 2.5 + Math.random() * 2.5;
          e.vx = 0;
          e.vz = 0;
        }
      }
    } else {
      e.vx = THREE.MathUtils.damp(e.vx, 0, 8, dt);
      e.vz = THREE.MathUtils.damp(e.vz, 0, 8, dt);
    }
  }

  // ==========================================================================
  // STEERING, OBSTACLE AVOIDANCE & COLLISION RESOLUTION
  // ==========================================================================
  private steerToward(
    e: SimEntity,
    tx: number,
    tz: number,
    speed: number,
    ctx: EntityUpdateContext,
    dt: number
  ): void {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;

    const baseAng = Math.atan2(dx, dz);
    const probeDist = Math.max(0.95, e.radius + 0.65);

    // Try straight angle first, then fan left/right feelers to avoid trees/walls
    let chosenAng = baseAng;
    const offsets = [0, 0.55, -0.55, 1.05, -1.05, 1.55, -1.55];
    for (let k = 0; k < offsets.length; k++) {
      const testAng = baseAng + offsets[k];
      const px = e.x + Math.sin(testAng) * probeDist;
      const pz = e.z + Math.cos(testAng) * probeDist;
      if (this.isPointWalkable(px, pz, e.y, e.radius, ctx)) {
        chosenAng = testAng;
        break;
      }
    }

    const desiredVx = Math.sin(chosenAng) * speed;
    const desiredVz = Math.cos(chosenAng) * speed;
    e.vx = THREE.MathUtils.damp(e.vx, desiredVx, 8.0, dt);
    e.vz = THREE.MathUtils.damp(e.vz, desiredVz, 8.0, dt);

    let nx = e.x + e.vx * dt;
    let nz = e.z + e.vz * dt;

    // Resolve hard colliders (2 passes)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < ctx.colliders.length; i++) {
        const c = ctx.colliders[i];
        if (c.maxY !== undefined && e.y + 0.1 > c.maxY) continue;
        if (c.minY !== undefined && e.y + 1.5 < c.minY) continue;
        const cdx = nx - c.x;
        const cdz = nz - c.z;
        const minD = e.radius + c.radius;
        const dSq = cdx * cdx + cdz * cdz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq) || 0.001;
          const push = minD - d;
          nx += (cdx / d) * push;
          nz += (cdz / d) * push;
        }
      }

      for (let i = 0; i < ctx.boxColliders.length; i++) {
        const b = ctx.boxColliders[i];
        if (b.maxY !== undefined && e.y + 0.1 > b.maxY) continue;
        if (b.minY !== undefined && e.y + 1.5 < b.minY) continue;

        const cos = Math.cos(b.rotY);
        const sin = Math.sin(b.rotY);
        const bdx = nx - b.cx;
        const bdz = nz - b.cz;
        let lx = bdx * cos - bdz * sin;
        let lz = bdx * sin + bdz * cos;

        const cx = THREE.MathUtils.clamp(lx, -b.halfW, b.halfW);
        const cz = THREE.MathUtils.clamp(lz, -b.halfD, b.halfD);
        const diffX = lx - cx;
        const diffZ = lz - cz;
        const dSq = diffX * diffX + diffZ * diffZ;

        if (dSq < e.radius * e.radius) {
          if (dSq > 0.00001) {
            const d = Math.sqrt(dSq);
            const push = e.radius - d;
            lx += (diffX / d) * push;
            lz += (diffZ / d) * push;
          } else {
            const penX = b.halfW - Math.abs(lx);
            const penZ = b.halfD - Math.abs(lz);
            if (penX < penZ) lx = (lx >= 0 ? 1 : -1) * (b.halfW + e.radius);
            else lz = (lz >= 0 ? 1 : -1) * (b.halfD + e.radius);
          }
          nx = b.cx + lx * cos + lz * sin;
          nz = b.cz - lx * sin + lz * cos;
        }
      }
    }

    // Clamp to playable perimeter
    const rOrig = Math.hypot(nx, nz);
    if (rOrig > ctx.boundsRadius - 2.0) {
      const s = (ctx.boundsRadius - 2.0) / rOrig;
      nx *= s;
      nz *= s;
    }

    // Keep ground-bound entities out of deep pond/bog water & steep cliffs outdoors
    if (!ctx.isInterior) {
      if (
        Math.hypot(nx - POND_CENTER.x, nz - POND_CENTER.z) < 5.6 ||
        Math.hypot(nx - BOG_CENTER.x, nz - BOG_CENTER.z) < 3.5 ||
        streamDistanceAt(nx, nz) < 1.5 ||
        groundSlopeAt(nx, nz) > 0.72
      ) {
        nx = e.x;
        nz = e.z;
      } else {
        e.y = walkableHeightAt(nx, nz);
      }
    } else if (ctx.walkableSurfaces) {
      const h = this.sampleInteriorHeight(nx, nz, e.y, ctx.walkableSurfaces);
      if (h === null) {
        nx = e.x;
        nz = e.z;
      } else {
        e.y = h;
      }
    }

    e.x = nx;
    e.z = nz;
    if (Math.hypot(e.vx, e.vz) > 0.15) {
      e.yaw += shortestAngleDiff(e.yaw, Math.atan2(e.vx, e.vz)) * (1 - Math.exp(-9 * dt));
    }
  }

  private isPointWalkable(
    x: number,
    z: number,
    refY: number,
    radius: number,
    ctx: EntityUpdateContext
  ): boolean {
    if (Math.hypot(x, z) > ctx.boundsRadius - 2.0) return false;
    if (!ctx.isInterior) {
      if (groundSlopeAt(x, z) > 0.68) return false;
      if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 5.8) return false;
      if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 3.6) return false;
      if (streamDistanceAt(x, z) < 1.55) return false;
    } else if (ctx.walkableSurfaces) {
      if (this.sampleInteriorHeight(x, z, refY, ctx.walkableSurfaces) === null) return false;
    }

    for (let i = 0; i < ctx.colliders.length; i++) {
      const c = ctx.colliders[i];
      if (c.maxY !== undefined && refY + 0.1 > c.maxY) continue;
      if (c.minY !== undefined && refY + 1.5 < c.minY) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < (radius + c.radius + 0.1) ** 2) return false;
    }

    for (let i = 0; i < ctx.boxColliders.length; i++) {
      const b = ctx.boxColliders[i];
      if (b.maxY !== undefined && refY + 0.1 > b.maxY) continue;
      if (b.minY !== undefined && refY + 1.5 < b.minY) continue;
      const cos = Math.cos(b.rotY);
      const sin = Math.sin(b.rotY);
      const dx = x - b.cx;
      const dz = z - b.cz;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) < b.halfW + radius + 0.1 && Math.abs(lz) < b.halfD + radius + 0.1) {
        return false;
      }
    }
    return true;
  }

  private sampleInteriorHeight(
    x: number,
    z: number,
    refY: number,
    surfaces: WalkableSurface[]
  ): number | null {
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
      if (h > refY + 0.55) continue;
      const score = Math.abs(h - refY);
      if (score < bestScore) {
        bestScore = score;
        bestH = h;
      }
    }
    return bestH === -Infinity ? null : bestH;
  }

  private hasLineOfSight(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    boxColliders: BoxCollider[],
    refY: number
  ): boolean {
    const steps = 6;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      for (let i = 0; i < boxColliders.length; i++) {
        const b = boxColliders[i];
        if (b.maxY !== undefined && refY + 0.5 > b.maxY) continue;
        if (b.minY !== undefined && refY + 1.2 < b.minY) continue;
        const cos = Math.cos(b.rotY);
        const sin = Math.sin(b.rotY);
        const dx = sx - b.cx;
        const dz = sz - b.cz;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) <= b.halfW && Math.abs(lz) <= b.halfD) return false;
      }
    }
    return true;
  }

  // ==========================================================================
  // PROCEDURAL LIMB & GAIT ANIMATION
  // ==========================================================================
  private animateEntityRig(e: SimEntity, elapsed: number, dt: number): void {
    const rig = e.rig;
    const sp = e.def.species;
    const speed = Math.hypot(e.vx, e.vz);
    const hitRecoil = e.hitFlashTimer > 0 ? Math.sin((e.hitFlashTimer / 0.22) * Math.PI) : 0;

    // 1. BIRDS (soaring eagles, fluttering songbirds, perched owls/crows)
    if (rig.wings.length === 2) {
      if (speed > 0.12) {
        e.walkCycle += dt * (7.0 + speed * 2.4);
      }
      if (e.animalState === 'fly') {
        const isEagle = sp === 'eagle';
        const beatFreq = isEagle ? 6.2 : 15.0;
        const glideWave = isEagle ? Math.max(0, Math.sin(elapsed * 0.75 + e.phase)) : 0;
        const flapAmp = isEagle ? (glideWave > 0.45 ? 0.12 : 0.56) : 0.78;
        const flap = Math.sin(elapsed * beatFreq + e.phase) * flapAmp + (isEagle ? 0.08 : 0);
        rig.wings[0].rotation.z = flap;
        rig.wings[1].rotation.z = -flap;
        rig.bodyPivot.position.y = rig.baseBodyY + Math.sin(elapsed * beatFreq + e.phase) * (isEagle ? 0.03 : 0.02);
        rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, isEagle ? 0.12 : 0.24, 6, dt);
        rig.bodyPivot.rotation.z = Math.sin(elapsed * 1.1 + e.phase) * (isEagle ? 0.14 : 0.06);
        rig.headPivot.rotation.y = Math.sin(elapsed * 1.2 + e.phase) * 0.14;
        if (rig.tailPivot) {
          rig.tailPivot.rotation.x = 0.15 + Math.cos(elapsed * beatFreq + e.phase) * 0.08;
        }
        for (let i = 0; i < rig.legs.length; i++) {
          rig.legs[i].rotation.x = THREE.MathUtils.damp(rig.legs[i].rotation.x, 0.85, 8, dt);
        }
      } else {
        rig.wings[0].rotation.z = THREE.MathUtils.damp(rig.wings[0].rotation.z, 0.38, 9, dt);
        rig.wings[1].rotation.z = THREE.MathUtils.damp(rig.wings[1].rotation.z, -0.38, 9, dt);
        const hop = speed > 0.15 ? Math.abs(Math.sin(e.walkCycle)) * 0.075 : 0;
        const peck = speed < 0.15 && Math.sin(elapsed * 1.4 + e.phase) > 0.72
          ? Math.abs(Math.sin(elapsed * 9.5 + e.phase)) * 0.42
          : 0;
        rig.bodyPivot.position.y = rig.baseBodyY + hop;
        rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, peck * 0.55 - hitRecoil * 0.2, 10, dt);
        rig.bodyPivot.rotation.z = THREE.MathUtils.damp(rig.bodyPivot.rotation.z, 0, 8, dt);
        rig.headPivot.rotation.y = Math.sin(elapsed * 2.1 + e.phase) * 0.42;
        rig.headPivot.rotation.x = THREE.MathUtils.damp(rig.headPivot.rotation.x, peck, 12, dt);
        for (let i = 0; i < rig.legs.length; i++) {
          rig.legs[i].rotation.x = THREE.MathUtils.damp(
            rig.legs[i].rotation.x,
            speed > 0.15 ? Math.sin(e.walkCycle + i * Math.PI) * 0.35 : 0,
            10,
            dt
          );
        }
        if (rig.tailPivot) {
          rig.tailPivot.rotation.x = Math.sin(elapsed * 3.2 + e.phase) * 0.12;
        }
      }
      return;
    }

    // 2. SPIDER 8-LEG SCUTTLE & LUNGE
    if (sp === 'giant_spider' && rig.legs.length === 8) {
      const moveBlend = THREE.MathUtils.clamp(speed / 2.2, 0, 1);
      if (speed > 0.12) {
        e.walkCycle += dt * (5.2 + speed * 2.8);
      }
      const isAttacking = e.monsterState === 'attack';
      const isAlert = e.monsterState === 'detect' || e.monsterState === 'alert';
      let targetPitch = -hitRecoil * 0.25;
      let targetBodyY = rig.baseBodyY + Math.sin(elapsed * 2.4 + e.phase) * 0.015;
      if (isAttacking) {
        if (e.attackWindup > 0) {
          targetPitch = -0.34;
          targetBodyY = rig.baseBodyY + 0.08;
        } else {
          targetPitch = 0.28;
          targetBodyY = rig.baseBodyY - 0.04;
        }
      } else if (isAlert) {
        targetPitch = -0.14;
      } else if (moveBlend > 0.05) {
        targetBodyY = rig.baseBodyY + Math.abs(Math.sin(e.walkCycle * 1.6)) * 0.03 * moveBlend;
      }
      rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, targetBodyY, 12, dt);
      rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, targetPitch, 14, dt);
      rig.headPivot.rotation.x = isAttacking && e.attackWindup <= 0 ? -0.22 : Math.sin(elapsed * 4.5 + e.phase) * 0.06;

      for (let i = 0; i < 8; i++) {
        const s = i % 2 === 0 ? 1 : -1;
        const idleTwitch = isAlert ? Math.sin(elapsed * 12 + i) * 0.08 : 0;
        rig.legs[i].rotation.z =
          Math.sin(e.walkCycle * 1.6 + i * 1.3) * 0.3 * moveBlend * s + idleTwitch;
        rig.legs[i].rotation.y =
          ((i < 4 ? 1 : -1) * (0.45 - (i % 4) * 0.32)) +
          Math.cos(e.walkCycle * 1.6 + i) * 0.18 * moveBlend;
      }
      return;
    }

    // 3. WISP / APPARITION / SPIRIT FLOAT
    if (
      sp === 'wisp_entity' ||
      sp === 'fog_apparition' ||
      sp === 'ruin_wraith' ||
      sp === 'forest_spirit'
    ) {
      if (speed > 0.12) {
        e.walkCycle += dt * (3.2 + speed * 1.6);
      }
      const hoverAmp = sp === 'wisp_entity' ? 0.14 : 0.11;
      rig.bodyPivot.position.y = rig.baseBodyY + Math.sin(elapsed * 2.2 + e.phase) * hoverAmp;
      rig.bodyPivot.rotation.x = THREE.MathUtils.damp(
        rig.bodyPivot.rotation.x,
        THREE.MathUtils.clamp(speed * 0.08, 0, 0.22) - hitRecoil * 0.25,
        6,
        dt
      );
      rig.bodyPivot.rotation.z = Math.sin(elapsed * 1.5 + e.phase) * 0.06;
      if (sp === 'wisp_entity') {
        rig.bodyPivot.rotation.y = elapsed * 0.9;
      }
      if (rig.arms.length === 2) {
        const isMonsterAttack = e.def.category === 'monster' && e.monsterState === 'attack';
        if (isMonsterAttack) {
          const swingArm = e.attackWindup > 0 ? -1.55 : 0.55;
          rig.arms[0].rotation.x = THREE.MathUtils.damp(rig.arms[0].rotation.x, -0.7, 12, dt);
          rig.arms[1].rotation.x = THREE.MathUtils.damp(rig.arms[1].rotation.x, swingArm, 18, dt);
        } else {
          rig.arms[0].rotation.x = THREE.MathUtils.damp(
            rig.arms[0].rotation.x,
            -0.28 + Math.sin(elapsed * 2.0 + e.phase) * 0.16,
            6,
            dt
          );
          rig.arms[1].rotation.x = THREE.MathUtils.damp(
            rig.arms[1].rotation.x,
            -0.28 + Math.cos(elapsed * 2.0 + e.phase) * 0.16,
            6,
            dt
          );
        }
      }
      return;
    }

    // 4. ANIMALS (Deer, Boar, Wolf, Bear, Fox, Rabbit, Squirrel, Badger, Hedgehog, Mouse)
    if (e.def.category === 'animal' || sp === 'pale_stag') {
      const isDeer = sp === 'stag' || sp === 'doe' || sp === 'roe_deer' || sp === 'pale_stag';
      const isRabbit = sp === 'rabbit';
      const isBear = sp === 'bear';
      const isBoar = sp === 'boar';
      const isQuad = rig.legs.length === 4;

      const strideScale = sp === 'mouse' || sp === 'hedgehog' || sp === 'squirrel' ? 3.8 : 2.1;
      const moveBlend = THREE.MathUtils.clamp(speed / 2.4, 0, 1);
      if (speed > 0.12) {
        e.walkCycle += dt * (4.4 + speed * strideScale);
      }

      const isResting = e.animalState === 'rest';
      const isGrazing = e.animalState === 'graze';
      const isObserving = e.animalState === 'observe';
      const isFleeing = e.animalState === 'flee';
      const isThreaten = e.animalState === 'threaten';

      // Body Y, Pitch & Sway
      let targetBodyY = rig.baseBodyY + Math.sin(elapsed * 2.2 + e.phase) * 0.012;
      let targetPitch = -hitRecoil * 0.22;
      let targetRoll = 0;

      if (isResting && isQuad) {
        targetBodyY = rig.baseBodyY * (isDeer ? 0.54 : 0.68) + Math.sin(elapsed * 1.4 + e.phase) * 0.008;
      } else if (moveBlend > 0.05) {
        if (isRabbit) {
          targetBodyY = rig.baseBodyY + Math.abs(Math.sin(e.walkCycle * 0.95)) * 0.16 * moveBlend;
          targetPitch = Math.cos(e.walkCycle * 0.95) * 0.28 * moveBlend;
        } else if (isDeer && isFleeing) {
          targetBodyY = rig.baseBodyY + Math.abs(Math.sin(e.walkCycle)) * 0.13;
          targetPitch = Math.cos(e.walkCycle) * 0.14;
        } else if (isBear) {
          targetBodyY = rig.baseBodyY - Math.abs(Math.sin(e.walkCycle)) * 0.035 * moveBlend;
          targetRoll = Math.cos(e.walkCycle) * 0.065 * moveBlend;
          targetPitch = isThreaten ? 0.16 : 0;
        } else {
          targetBodyY = rig.baseBodyY + Math.abs(Math.sin(e.walkCycle * 2)) * 0.035 * moveBlend;
          targetPitch = isBoar && isThreaten ? 0.18 : 0;
        }
      } else if (isGrazing) {
        targetPitch = isDeer ? 0.08 : 0.16;
      }

      rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, targetBodyY, 9, dt);
      rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, targetPitch, 9, dt);
      rig.bodyPivot.rotation.z = THREE.MathUtils.damp(rig.bodyPivot.rotation.z, targetRoll, 9, dt);

      // Neck & Head posture
      if (rig.neckPivot) {
        const targetNeckX = isGrazing
          ? 0.86 + Math.sin(elapsed * 4.4 + e.phase) * 0.09
          : isObserving
            ? -0.08
            : isFleeing
              ? 0.14
              : isResting
                ? 0.18
                : Math.sin(elapsed * 1.8 + e.phase) * 0.03;
        rig.neckPivot.rotation.x = THREE.MathUtils.damp(rig.neckPivot.rotation.x, targetNeckX, 7, dt);
      }

      const headX = isGrazing
        ? (rig.neckPivot ? 0.24 : 0.55) + Math.sin(elapsed * 5.2 + e.phase) * 0.12
        : isThreaten
          ? -0.18 + Math.sin(elapsed * 7 + e.phase) * 0.08
          : 0;
      const headY = isObserving
        ? Math.sin(elapsed * 1.6 + e.phase) * 0.42
        : isResting
          ? Math.sin(elapsed * 0.8 + e.phase) * 0.12
          : 0;
      rig.headPivot.rotation.x = THREE.MathUtils.damp(rig.headPivot.rotation.x, headX, 8, dt);
      rig.headPivot.rotation.y = THREE.MathUtils.damp(rig.headPivot.rotation.y, headY, 6, dt);

      // Legs & Knees
      if (isQuad) {
        if (isResting) {
          for (let i = 0; i < 4; i++) {
            const front = i < 2;
            rig.legs[i].rotation.x = THREE.MathUtils.damp(rig.legs[i].rotation.x, front ? -0.75 : 0.72, 6, dt);
            if (rig.kneePivots && rig.kneePivots[i]) {
              rig.kneePivots[i].rotation.x = THREE.MathUtils.damp(
                rig.kneePivots[i].rotation.x,
                front ? 1.35 : -0.95,
                6,
                dt
              );
            }
          }
        } else if (isRabbit) {
          const hopSwing = Math.sin(e.walkCycle * 0.95) * 0.72 * moveBlend;
          rig.legs[0].rotation.x = -hopSwing * 0.7;
          rig.legs[1].rotation.x = -hopSwing * 0.7;
          rig.legs[2].rotation.x = hopSwing;
          rig.legs[3].rotation.x = hopSwing;
        } else {
          const swingAmp = isFleeing || isThreaten ? 0.72 : 0.56;
          const swing = Math.sin(e.walkCycle) * swingAmp * moveBlend;
          const swingOpp = Math.sin(e.walkCycle + Math.PI) * swingAmp * moveBlend;
          rig.legs[0].rotation.x = THREE.MathUtils.damp(rig.legs[0].rotation.x, swing, 14, dt);
          rig.legs[1].rotation.x = THREE.MathUtils.damp(rig.legs[1].rotation.x, swingOpp, 14, dt);
          rig.legs[2].rotation.x = THREE.MathUtils.damp(rig.legs[2].rotation.x, swingOpp, 14, dt);
          rig.legs[3].rotation.x = THREE.MathUtils.damp(rig.legs[3].rotation.x, swing, 14, dt);

          if (rig.kneePivots && rig.kneePivots.length === 4) {
            const k0 = Math.max(0, -Math.cos(e.walkCycle)) * 0.58 * moveBlend;
            const k1 = Math.max(0, Math.cos(e.walkCycle)) * 0.58 * moveBlend;
            rig.kneePivots[0].rotation.x = THREE.MathUtils.damp(rig.kneePivots[0].rotation.x, k0, 14, dt);
            rig.kneePivots[1].rotation.x = THREE.MathUtils.damp(rig.kneePivots[1].rotation.x, k1, 14, dt);
            rig.kneePivots[2].rotation.x = THREE.MathUtils.damp(rig.kneePivots[2].rotation.x, -k1 * 0.5, 14, dt);
            rig.kneePivots[3].rotation.x = THREE.MathUtils.damp(rig.kneePivots[3].rotation.x, -k0 * 0.5, 14, dt);
          }
        }
      }

      if (rig.tailPivot) {
        const tailFreq = isFleeing || isThreaten ? 7.5 : 2.8;
        rig.tailPivot.rotation.y = Math.sin(elapsed * tailFreq + e.phase) * 0.24;
        if (sp === 'squirrel') {
          rig.tailPivot.rotation.x = Math.sin(elapsed * 4.5 + e.phase) * 0.16;
        }
      }
      return;
    }

    // 5. HUMANOID / BIPEDAL MONSTERS, CREATURES & NPCs
    const moveBlend = THREE.MathUtils.clamp(speed / 2.2, 0, 1);
    if (speed > 0.12) {
      e.walkCycle += dt * (4.3 + speed * 2.25);
    }

    const isMonster = e.def.category === 'monster';
    const isCreature = e.def.category === 'creature';
    const isNpc = e.def.category === 'npc';

    const isDormant = isCreature && e.creatureState === 'dormant';
    const isMonsterRest = isMonster && e.monsterState === 'rest';
    const isMonsterAlert =
      (isMonster && (e.monsterState === 'detect' || e.monsterState === 'alert')) ||
      (isCreature && e.creatureState === 'alert');
    const isChasing =
      (isMonster && e.monsterState === 'chase') ||
      (isCreature && e.creatureState === 'chase');
    const isAttacking =
      (isMonster && e.monsterState === 'attack') ||
      (isCreature && e.creatureState === 'attack');
    const isNpcTalk = isNpc && e.npcState === 'talk';
    const isNpcEvade = isNpc && e.npcState === 'evade';

    // Exact damage hit point: monsters at attackWindup === 0 (from 0.36 to -0.42), golems at 0.12 (from 0.45 to -0.55)
    const hitPoint = isCreature ? 0.12 : 0.0;
    const isWindingUp = isAttacking && e.attackWindup > hitPoint;

    // Body bob, lean & twist
    const strideBob = moveBlend > 0.05 ? Math.abs(Math.sin(e.walkCycle)) * (isChasing || isNpcEvade ? 0.055 : 0.032) * moveBlend : 0;
    const idleBreath = !isDormant ? Math.sin(elapsed * 2.0 + e.phase) * 0.012 : 0;
    let bodyPitch = -hitRecoil * 0.28;
    let bodyYaw = 0;

    if (isAttacking) {
      bodyPitch += isWindingUp ? -0.18 : 0.26;
      bodyYaw = isWindingUp ? -0.34 : 0.32;
    } else if (isChasing || isNpcEvade) {
      bodyPitch += 0.14;
      bodyYaw = Math.sin(e.walkCycle) * 0.07 * moveBlend;
    } else if (isMonsterRest) {
      bodyPitch += 0.12;
    } else if (isMonsterAlert) {
      bodyPitch += -0.06;
    } else if (moveBlend > 0.05) {
      bodyYaw = Math.sin(e.walkCycle) * 0.04 * moveBlend;
    }

    rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, rig.baseBodyY + strideBob + idleBreath, 12, dt);
    rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, bodyPitch, 14, dt);
    rig.bodyPivot.rotation.y = THREE.MathUtils.damp(rig.bodyPivot.rotation.y, bodyYaw, 14, dt);

    // Head expressions (preserve NPC headPivot.rotation.y from updateNpc!)
    if (!isNpc) {
      if (isMonsterAlert) {
        rig.headPivot.rotation.y = Math.sin(elapsed * 14 + e.phase) * 0.14;
        rig.headPivot.rotation.x = -0.1;
      } else if (isMonsterRest || isDormant) {
        rig.headPivot.rotation.x = THREE.MathUtils.damp(rig.headPivot.rotation.x, 0.22, 6, dt);
        rig.headPivot.rotation.y = THREE.MathUtils.damp(rig.headPivot.rotation.y, 0, 6, dt);
      } else {
        rig.headPivot.rotation.x = THREE.MathUtils.damp(
          rig.headPivot.rotation.x,
          isAttacking ? (isWindingUp ? -0.15 : 0.18) : 0,
          10,
          dt
        );
        rig.headPivot.rotation.y = THREE.MathUtils.damp(
          rig.headPivot.rotation.y,
          moveBlend < 0.1 ? Math.sin(elapsed * 1.1 + e.phase) * 0.18 : 0,
          5,
          dt
        );
      }
    } else {
      const talkNod = isNpcTalk ? Math.sin(elapsed * 3.8 + e.phase) * 0.08 : 0;
      rig.headPivot.rotation.x = THREE.MathUtils.damp(rig.headPivot.rotation.x, talkNod, 8, dt);
    }

    // Quadruped monsters like cave_crawler / night_prowler
    if (rig.legs.length === 4) {
      const swing = Math.sin(e.walkCycle) * 0.62 * moveBlend;
      rig.legs[0].rotation.x = swing;
      rig.legs[1].rotation.x = -swing;
      rig.legs[2].rotation.x = -swing;
      rig.legs[3].rotation.x = swing;
      return;
    }

    // Bipedal Legs & Knees (legs swing -swing/+swing -> forward is negative rotX, knee bends backward +rotX)
    if (rig.legs.length === 2) {
      const swingAmp = isChasing || isNpcEvade ? 0.68 : 0.52;
      const lHip = -Math.sin(e.walkCycle) * swingAmp * moveBlend;
      const rHip = Math.sin(e.walkCycle) * swingAmp * moveBlend;
      rig.legs[0].rotation.x = THREE.MathUtils.damp(rig.legs[0].rotation.x, lHip, 15, dt);
      rig.legs[1].rotation.x = THREE.MathUtils.damp(rig.legs[1].rotation.x, rHip, 15, dt);

      if (rig.kneePivots && rig.kneePivots.length === 2) {
        const lKnee = moveBlend > 0.05 ? Math.max(0.06, Math.cos(e.walkCycle) * 0.68) * moveBlend : 0;
        const rKnee = moveBlend > 0.05 ? Math.max(0.06, -Math.cos(e.walkCycle) * 0.68) * moveBlend : 0;
        rig.kneePivots[0].rotation.x = THREE.MathUtils.damp(rig.kneePivots[0].rotation.x, lKnee, 15, dt);
        rig.kneePivots[1].rotation.x = THREE.MathUtils.damp(rig.kneePivots[1].rotation.x, rKnee, 15, dt);
      }
    }

    // Arms, Forearms & Weapon Pivot
    if (rig.arms.length === 2) {
      const swing = Math.sin(e.walkCycle) * 0.56 * moveBlend;
      let targetL = swing;
      let targetR = -swing;
      let targetForeL = moveBlend > 0.05 ? -0.24 * moveBlend : -0.12;
      let targetForeR = moveBlend > 0.05 ? -0.24 * moveBlend : -0.12;
      let targetWepX = 0;

      if (isDormant) {
        targetL = 0.04;
        targetR = 0.04;
        targetForeL = -0.05;
        targetForeR = -0.05;
      } else if (isAttacking) {
        if (isCreature) {
          // Two-arm heavy stone slam
          targetL = isWindingUp ? -1.85 : 0.48;
          targetR = isWindingUp ? -1.95 : 0.54;
        } else {
          // Weapon cleave windup -> downward strike
          targetL = isWindingUp ? -0.45 : -0.12;
          targetR = isWindingUp ? -1.95 : 0.52;
          targetForeL = -0.45;
          targetForeR = isWindingUp ? -0.82 : -0.14;
          targetWepX = isWindingUp ? -0.25 : 0.46;
        }
      } else if (isMonsterAlert) {
        const tremor = Math.sin(elapsed * 16 + e.phase) * 0.08;
        targetL = -0.78 + tremor;
        targetR = -0.92 - tremor;
        targetForeL = -0.65;
        targetForeR = -0.75;
      } else if (isChasing) {
        targetL = -0.58 + swing * 0.42;
        targetR = -0.82 - swing * 0.35;
        targetForeL = -0.52;
        targetForeR = -0.65;
      } else if (isNpcTalk) {
        targetL = -0.32 + Math.sin(elapsed * 2.9 + e.phase) * 0.14;
        targetForeL = -0.62 + Math.cos(elapsed * 3.1 + e.phase) * 0.18;
        targetR = -0.18;
        targetForeR = -0.38;
      } else if (isNpc) {
        // NPCs carry staffs/axes/halberds on R or lanterns on L without over-swinging
        const npcSpec = sp;
        const holdsLeftProp = npcSpec === 'adventurer' || npcSpec === 'pilgrim' || npcSpec === 'keeper';
        const holdsRightProp = npcSpec === 'traveler' || npcSpec === 'woodcutter' || npcSpec === 'hermit' || npcSpec === 'guard';
        if (holdsLeftProp) {
          targetL = -0.28 + swing * 0.25;
          targetForeL = -0.45;
        }
        if (holdsRightProp) {
          targetR = -0.24 - swing * 0.25;
          targetForeR = -0.42;
        }
      }

      const armDamp = isAttacking ? 20 : 11;
      rig.arms[0].rotation.x = THREE.MathUtils.damp(rig.arms[0].rotation.x, targetL, armDamp, dt);
      rig.arms[1].rotation.x = THREE.MathUtils.damp(rig.arms[1].rotation.x, targetR, armDamp, dt);

      if (rig.forearmPivots && rig.forearmPivots.length === 2) {
        rig.forearmPivots[0].rotation.x = THREE.MathUtils.damp(rig.forearmPivots[0].rotation.x, targetForeL, armDamp, dt);
        rig.forearmPivots[1].rotation.x = THREE.MathUtils.damp(rig.forearmPivots[1].rotation.x, targetForeR, armDamp, dt);
      }

      if (rig.weaponPivot) {
        rig.weaponPivot.rotation.x = THREE.MathUtils.damp(rig.weaponPivot.rotation.x, targetWepX, 20, dt);
      }
    }

    if (rig.tailPivot) {
      rig.tailPivot.rotation.y = Math.sin(elapsed * 3.1 + e.phase) * 0.18;
    }
  }

  private clearEntityList(list: SimEntity[], group: THREE.Group): void {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      group.remove(e.rig.root);
      e.rig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
    }
    list.length = 0;
  }

  public dispose(): void {
    this.clearEntityList(this.overworldEntities, this.overworldGroup);
    this.clearEntityList(this.interiorEntities, this.interiorGroup);
    this.eTex.dispose();
  }
}

// Re-export unused scratch references silently avoided if not needed
void _vA;
void _vB;
