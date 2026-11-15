import * as THREE from 'three';
import { BUILDABLE_STRUCTURES } from '../data/structures';
import {
  addItemsToInventory,
  consumeInventoryIngredients,
  hasInventoryIngredients,
} from '../game/inventory';
import { createDefaultGameplaySave } from '../game/persistence';
import {
  BOG_CENTER,
  bridgeDeckHeightAt,
  CASCADE_CENTER,
  FEN_NORTH_CENTER,
  groundSlopeAt,
  MOOR_POND_CENTER,
  PLAYABLE_BOUNDS_RADIUS,
  POND_CENTER,
  streamDistanceAt,
} from '../game/terrain';
import { ProceduralTextures } from '../game/textures';
import {
  BoxCollider,
  CircleCollider,
  LightAnchor,
  PortalLink,
  ThornvaleSaveState,
} from '../game/types';
import {
  BuildableStructureId,
  CraftingStationKind,
  NearbyStructureInfo,
  PlacedStructureRecord,
  PlacementPreviewState,
  PlacementValidationResult,
  StructureEnvironmentId,
} from '../types/gameplay';
import {
  buildStructureMesh,
  disposeObjectTree,
  setGhostVisualState,
} from '../visuals/LowPolyGearBuilder';

interface InstantiatedStructure {
  record: PlacedStructureRecord;
  group: THREE.Group;
  collider: CircleCollider;
  lightAnchor?: LightAnchor;
  ember?: THREE.Mesh;
}

export interface BuildActionResult {
  success: boolean;
  message: string;
  record?: PlacedStructureRecord;
}

export class BuildingSystem {
  private root: THREE.Group;
  private textures: ProceduralTextures;
  private instantiated: InstantiatedStructure[] = [];
  private activeEnvId: StructureEnvironmentId = 'overworld';

  // Dynamic views returned cleanly to engine without per-frame allocations
  private activeColliders: CircleCollider[] = [];
  private activeLightAnchors: LightAnchor[] = [];
  private activeEmbers: { ember: THREE.Mesh; phase: number; baseScale?: [number, number, number] }[] = [];

  // Ghost placement state
  private activePlacementId: BuildableStructureId | null = null;
  private ghostGroup: THREE.Group | null = null;
  private placementRotY = 0;
  private lastGhostX = 0;
  private lastGhostY = 0;
  private lastGhostZ = 0;
  private lastValidation: PlacementValidationResult = {
    valid: false,
    reason: '',
    snappedY: 0,
  };

  constructor(scene: THREE.Scene, textures: ProceduralTextures) {
    this.root = new THREE.Group();
    this.root.name = 'ThornvalePlayerStructures';
    scene.add(this.root);
    this.textures = textures;
  }

  public getActiveColliders(): CircleCollider[] {
    return this.activeColliders;
  }

  public getActiveLightAnchors(): LightAnchor[] {
    return this.activeLightAnchors;
  }

  public getActiveEmbers(): {
    ember: THREE.Mesh;
    phase: number;
    baseScale?: [number, number, number];
  }[] {
    return this.activeEmbers;
  }

  public isPlacementActive(): boolean {
    return this.activePlacementId !== null;
  }

  public getPlacementPreviewState(): PlacementPreviewState {
    if (!this.activePlacementId) {
      return {
        active: false,
        structureId: null,
        structureName: '',
        valid: false,
        reason: '',
        rotY: 0,
      };
    }
    const def = BUILDABLE_STRUCTURES[this.activePlacementId];
    return {
      active: true,
      structureId: this.activePlacementId,
      structureName: def ? def.name : this.activePlacementId,
      valid: this.lastValidation.valid,
      reason: this.lastValidation.reason,
      rotY: this.placementRotY,
    };
  }

  public syncForEnvironment(
    envId: StructureEnvironmentId,
    saveState: ThornvaleSaveState
  ): void {
    this.activeEnvId = envId;
    this.clearInstantiated();

    const list = saveState.gameplay?.placedStructures ?? [];
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (rec.environmentId !== envId) continue;
      this.instantiateRecord(rec);
    }
  }

  private clearInstantiated(): void {
    for (let i = 0; i < this.instantiated.length; i++) {
      const item = this.instantiated[i];
      this.root.remove(item.group);
      disposeObjectTree(item.group);
    }
    this.instantiated.length = 0;
    this.activeColliders.length = 0;
    this.activeLightAnchors.length = 0;
    this.activeEmbers.length = 0;
  }

  private instantiateRecord(rec: PlacedStructureRecord): void {
    const def = BUILDABLE_STRUCTURES[rec.structureId];
    if (!def) return;

    const { group, ember } = buildStructureMesh(rec.structureId, this.textures, false);
    group.position.set(rec.x, rec.y, rec.z);
    group.rotation.y = rec.rotY;
    this.root.add(group);

    const collider: CircleCollider = {
      x: rec.x,
      z: rec.z,
      radius: def.colliderRadius,
      minY: rec.y - 0.1,
      maxY: rec.y + def.colliderHeight,
      kind: 'prop',
      tag: `built_${rec.id}`,
    };
    this.activeColliders.push(collider);

    let lightAnchor: LightAnchor | undefined;
    if (def.lightColor && def.lightIntensity && def.lightDistance) {
      lightAnchor = {
        x: rec.x,
        y: rec.y + (rec.structureId === 'watch_lantern' ? 2.0 : 0.7),
        z: rec.z,
        color: def.lightColor,
        baseIntensity: def.lightIntensity,
        distance: def.lightDistance,
        phase: Math.abs(rec.x * 0.43 + rec.z * 0.71) % 6.28,
        tag: `built_light_${rec.id}`,
      };
      this.activeLightAnchors.push(lightAnchor);
    }

    if (ember) {
      this.activeEmbers.push({
        ember,
        phase: Math.abs(rec.x * 0.61 + rec.z * 0.29) % 6.28,
        baseScale:
          rec.structureId === 'campfire' ? [1.0, 1.0, 1.0] : [1.0, 1.0, 1.0],
      });
    }

    this.instantiated.push({
      record: rec,
      group,
      collider,
      lightAnchor,
      ember,
    });
  }

  public startPlacement(structureId: BuildableStructureId): boolean {
    const def = BUILDABLE_STRUCTURES[structureId];
    if (!def) return false;
    this.cancelPlacement();
    this.activePlacementId = structureId;
    this.placementRotY = 0;

    const { group } = buildStructureMesh(structureId, this.textures, true);
    this.ghostGroup = group;
    this.root.add(group);
    return true;
  }

  public rotatePlacement(deltaRad = Math.PI / 4): void {
    if (!this.activePlacementId) return;
    this.placementRotY = (this.placementRotY + deltaRad) % (Math.PI * 2);
  }

  public cancelPlacement(): void {
    this.activePlacementId = null;
    if (this.ghostGroup) {
      this.root.remove(this.ghostGroup);
      disposeObjectTree(this.ghostGroup);
      this.ghostGroup = null;
    }
    this.lastValidation = { valid: false, reason: '', snappedY: 0 };
  }

  public updateGhost(
    playerX: number,
    playerY: number,
    playerZ: number,
    playerYaw: number,
    sampleHeight: (x: number, z: number, refY: number) => number,
    envId: StructureEnvironmentId,
    staticCircles: CircleCollider[],
    staticBoxes: BoxCollider[],
    portals: PortalLink[],
    saveState: ThornvaleSaveState
  ): void {
    if (!this.activePlacementId || !this.ghostGroup) return;
    const def = BUILDABLE_STRUCTURES[this.activePlacementId];
    const dist = Math.max(2.1, def.footprintRadius + 1.25);
    const gx = playerX + Math.sin(playerYaw) * dist;
    const gz = playerZ + Math.cos(playerYaw) * dist;
    const gy = sampleHeight(gx, gz, playerY);

    this.lastGhostX = gx;
    this.lastGhostY = gy;
    this.lastGhostZ = gz;

    this.lastValidation = this.validatePlacement(
      this.activePlacementId,
      gx,
      gy,
      gz,
      envId,
      staticCircles,
      staticBoxes,
      portals,
      playerX,
      playerY,
      playerZ,
      saveState
    );

    this.ghostGroup.position.set(gx, gy, gz);
    this.ghostGroup.rotation.y = this.placementRotY;
    setGhostVisualState(this.ghostGroup, this.lastValidation.valid);
  }

  public validatePlacement(
    structureId: BuildableStructureId,
    x: number,
    y: number,
    z: number,
    envId: StructureEnvironmentId,
    staticCircles: CircleCollider[],
    staticBoxes: BoxCollider[],
    portals: PortalLink[],
    playerX: number,
    playerY: number,
    playerZ: number,
    saveState: ThornvaleSaveState
  ): PlacementValidationResult {
    const def = BUILDABLE_STRUCTURES[structureId];
    if (!def) {
      return { valid: false, reason: 'Unknown structure', snappedY: y };
    }

    if (envId === 'overworld' && !def.allowOverworld) {
      return { valid: false, reason: 'Cannot build outdoors', snappedY: y };
    }
    if (envId !== 'overworld' && !def.allowInterior) {
      return { valid: false, reason: 'Must be built outdoors', snappedY: y };
    }

    if (!hasInventoryIngredients(saveState.inventory, def.costs)) {
      return { valid: false, reason: 'Insufficient materials in pack', snappedY: y };
    }

    if (Math.abs(y - playerY) > 1.45) {
      return { valid: false, reason: 'Ground elevation mismatch', snappedY: y };
    }

    if (Math.hypot(x - playerX, z - playerZ) < def.footprintRadius + 0.5) {
      return { valid: false, reason: 'Too close to character', snappedY: y };
    }

    const r = def.footprintRadius;
    if (envId === 'overworld') {
      if (Math.hypot(x, z) > PLAYABLE_BOUNDS_RADIUS - r - 3.5) {
        return { valid: false, reason: 'Beyond valley perimeter', snappedY: y };
      }

      if (groundSlopeAt(x, z) > def.maxSlope) {
        return { valid: false, reason: 'Terrain too steep', snappedY: y };
      }

      if (bridgeDeckHeightAt(x, z) !== null) {
        return { valid: false, reason: 'Cannot build on bridge', snappedY: y };
      }

      // Water clearance
      if (
        Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 5.0 + r ||
        Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 6.4 + r ||
        Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 9.4 + r ||
        Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 10.8 + r ||
        Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z) < 8.4 + r ||
        streamDistanceAt(x, z) < 2.2 + r
      ) {
        return { valid: false, reason: 'Too close to water or mire', snappedY: y };
      }
    } else {
      // Interior wall clearance (~boundsRadius handled by boxColliders, enforce mild floor margin)
      if (Math.hypot(x, z) > 22) {
        return { valid: false, reason: 'Out of interior bounds', snappedY: y };
      }
    }

    // Portals / Doors clearance
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      if (Math.abs(y - p.y) > 2.2) continue;
      if (Math.hypot(x - p.x, z - p.z) < p.radius + r + 0.65) {
        return { valid: false, reason: 'Too close to doorway or portal', snappedY: y };
      }
    }

    // Static circle colliders (trees, rocks, pillars)
    for (let i = 0; i < staticCircles.length; i++) {
      const c = staticCircles[i];
      if (c.maxY !== undefined && y > c.maxY) continue;
      if (c.minY !== undefined && y + def.colliderHeight < c.minY) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.radius + r + 0.12) {
        return { valid: false, reason: 'Blocked by obstacle', snappedY: y };
      }
    }

    // Static OBB colliders (walls, buildings, ruins)
    for (let i = 0; i < staticBoxes.length; i++) {
      const b = staticBoxes[i];
      if (b.maxY !== undefined && y > b.maxY) continue;
      if (b.minY !== undefined && y + def.colliderHeight < b.minY) continue;
      const cos = Math.cos(b.rotY);
      const sin = Math.sin(b.rotY);
      const dx = x - b.cx;
      const dz = z - b.cz;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) < b.halfW + r + 0.12 && Math.abs(lz) < b.halfD + r + 0.12) {
        return { valid: false, reason: 'Blocked by wall or structure', snappedY: y };
      }
    }

    // Existing placed structures
    for (let i = 0; i < this.instantiated.length; i++) {
      const ex = this.instantiated[i].record;
      const exDef = BUILDABLE_STRUCTURES[ex.structureId];
      const minSpacing = (exDef ? exDef.footprintRadius : 0.9) + r + 0.25;
      if (Math.hypot(x - ex.x, z - ex.z) < minSpacing) {
        return { valid: false, reason: 'Overlaps existing structure', snappedY: y };
      }
    }

    return { valid: true, reason: 'Clear ground — ready to place', snappedY: y };
  }

  public confirmPlacement(
    envId: StructureEnvironmentId,
    staticCircles: CircleCollider[],
    staticBoxes: BoxCollider[],
    portals: PortalLink[],
    playerX: number,
    playerY: number,
    playerZ: number,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): BuildActionResult {
    if (!this.activePlacementId) {
      return { success: false, message: 'No structure selected for placement.' };
    }

    const structureId = this.activePlacementId;
    const def = BUILDABLE_STRUCTURES[structureId];
    const current = getActiveSaveState();

    const check = this.validatePlacement(
      structureId,
      this.lastGhostX,
      this.lastGhostY,
      this.lastGhostZ,
      envId,
      staticCircles,
      staticBoxes,
      portals,
      playerX,
      playerY,
      playerZ,
      current
    );

    if (!check.valid) {
      return { success: false, message: `Cannot build: ${check.reason}` };
    }

    const rec: PlacedStructureRecord = {
      id: `str_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      structureId,
      environmentId: envId,
      x: Number(this.lastGhostX.toFixed(2)),
      y: Number(check.snappedY.toFixed(2)),
      z: Number(this.lastGhostZ.toFixed(2)),
      rotY: Number(this.placementRotY.toFixed(3)),
      placedAt: Date.now(),
    };

    let builtOk = false;
    updateSaveState((prev) => {
      const consumed = consumeInventoryIngredients(prev.inventory, def.costs);
      if (!consumed) return prev;
      builtOk = true;
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      return {
        ...prev,
        inventory: consumed,
        gameplay: {
          ...gp,
          placedStructures: [...gp.placedStructures, rec],
          stats: {
            ...gp.stats,
            builtCount: (gp.stats.builtCount ?? 0) + 1,
          },
        },
      };
    });

    if (!builtOk) {
      return { success: false, message: 'Insufficient materials in pack.' };
    }

    this.instantiateRecord(rec);
    this.cancelPlacement();

    return {
      success: true,
      record: rec,
      message: `Built: ${def.name}`,
    };
  }

  public dismantleStructure(
    recordId: string,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): BuildActionResult {
    const idx = this.instantiated.findIndex((i) => i.record.id === recordId);
    const current = getActiveSaveState();
    const savedRec = current.gameplay?.placedStructures.find((s) => s.id === recordId);
    if (!savedRec) {
      return { success: false, message: 'Structure not found.' };
    }
    const def = BUILDABLE_STRUCTURES[savedRec.structureId];
    const refunds = def.costs
      .map((c) => ({
        itemId: c.itemId,
        quantity: Math.max(1, Math.floor(c.quantity * 0.5)),
      }))
      .filter((r) => r.quantity > 0);

    let removedOk = false;
    updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const exists = gp.placedStructures.some((s) => s.id === recordId);
      if (!exists) return prev;

      const added = addItemsToInventory(prev.inventory, refunds, false);
      removedOk = true;
      return {
        ...prev,
        inventory: added.nextSlots,
        gameplay: {
          ...gp,
          placedStructures: gp.placedStructures.filter((s) => s.id !== recordId),
        },
      };
    });

    if (!removedOk) {
      return { success: false, message: 'Could not dismantle structure.' };
    }

    if (idx >= 0) {
      const item = this.instantiated[idx];
      this.root.remove(item.group);
      disposeObjectTree(item.group);
      this.instantiated.splice(idx, 1);

      const cIdx = this.activeColliders.indexOf(item.collider);
      if (cIdx >= 0) this.activeColliders.splice(cIdx, 1);

      if (item.lightAnchor) {
        const lIdx = this.activeLightAnchors.indexOf(item.lightAnchor);
        if (lIdx >= 0) this.activeLightAnchors.splice(lIdx, 1);
      }
      if (item.ember) {
        const eIdx = this.activeEmbers.findIndex((em) => em.ember === item.ember);
        if (eIdx >= 0) this.activeEmbers.splice(eIdx, 1);
      }
    }

    return {
      success: true,
      message: `Dismantled: ${def.name} (materials recovered)`,
    };
  }

  public getNearbyStations(playerX: number, playerY: number, playerZ: number): CraftingStationKind[] {
    const stations: CraftingStationKind[] = ['hand'];
    for (let i = 0; i < this.instantiated.length; i++) {
      const rec = this.instantiated[i].record;
      const def = BUILDABLE_STRUCTURES[rec.structureId];
      if (!def?.providesStation) continue;
      if (Math.abs(playerY - rec.y) > 2.2) continue;
      if (Math.hypot(playerX - rec.x, playerZ - rec.z) <= 5.5) {
        if (!stations.includes(def.providesStation)) {
          stations.push(def.providesStation);
        }
      }
    }
    return stations;
  }

  public getWarmthEnvironment(
    playerX: number,
    playerY: number,
    playerZ: number
  ): { nearFire: boolean; inShelter: boolean } {
    let nearFire = false;
    let inShelter = false;
    for (let i = 0; i < this.instantiated.length; i++) {
      const rec = this.instantiated[i].record;
      const def = BUILDABLE_STRUCTURES[rec.structureId];
      if (!def || Math.abs(playerY - rec.y) > 2.4) continue;
      const dist = Math.hypot(playerX - rec.x, playerZ - rec.z);
      if (rec.structureId === 'field_shelter' && dist <= (def.warmthRadius ?? 4.5)) {
        inShelter = true;
      } else if (def.warmthRadius && dist <= def.warmthRadius) {
        nearFire = true;
      }
    }
    return { nearFire, inShelter };
  }

  public findNearestInteractableStructure(
    playerX: number,
    playerY: number,
    playerZ: number
  ): NearbyStructureInfo | null {
    let best: NearbyStructureInfo | null = null;
    let bestDist = 2.9;

    for (let i = 0; i < this.instantiated.length; i++) {
      const rec = this.instantiated[i].record;
      const def = BUILDABLE_STRUCTURES[rec.structureId];
      if (!def) continue;
      if (Math.abs(playerY - rec.y) > 2.0) continue;
      const dist = Math.hypot(playerX - rec.x, playerZ - rec.z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = { record: rec, def, distance: dist };
      }
    }
    return best;
  }

  public getActiveEnvironmentId(): StructureEnvironmentId {
    return this.activeEnvId;
  }

  public dispose(): void {
    this.cancelPlacement();
    this.clearInstantiated();
  }
}
