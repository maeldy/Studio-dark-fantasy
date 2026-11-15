import * as THREE from 'three';
import {
  addBarrelCluster,
  addCanopyBed,
  addCaveBoulder,
  addCeilingSlab,
  addChestAndDrawer,
  addCrystalCluster,
  addDiningTableSet,
  addFloorSlab,
  addGlowingMushroomCluster,
  addGroinVaultBay,
  addHangingChains,
  addHighBackChair,
  addHoodedStatue,
  addInteriorBrazier,
  addIronCellGate,
  addLitCasementWindow,
  addSarcophagus,
  addSolidWall,
  addStalactite,
  addStoneFireplace,
  addStonePillar,
  addTimberBeamCeiling,
  addWalkableStaircase,
  addWallShelf,
  addWallTorchSconce,
  addWeaponArmorRack,
  addWovenRug,
  createInteriorMaterials,
  disposeInteriorGroup,
  InteriorBuildContext,
  InteriorMaterials,
} from './interiorProps';
import { addItemsToInventory, ITEM_CATALOG } from './inventory';
import { ProceduralTextures } from './textures';
import {
  InteriorId,
  InteriorInstance,
  InteriorInteractable,
  PortalLink,
  ThornvaleSaveState,
} from './types';

export interface InteriorPersistenceActions {
  isDoorOpen: (doorId: string) => boolean;
  setDoorOpen: (doorId: string, open: boolean) => void;
  isBrazierLit: (brazierId: string) => boolean;
  setBrazierLit: (brazierId: string, lit: boolean) => void;
  isRelicCollected: (relicId: string) => boolean;
  collectRelic: (relicId: string, label: string) => void;
  isFoundItemCollected: (itemNodeId: string) => boolean;
  collectFoundItem: (
    itemNodeId: string,
    grants: { itemId: string; quantity: number }[]
  ) => { ok: boolean; message: string };
}

function addEntryDoorMesh(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  width: number,
  height: number,
  isStone = false
): void {
  const frameMat = isStone ? mats.carvedStone : mats.bark;
  const panelMat = isStone ? mats.darkStone : mats.timber;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, height + 0.35, 0.25), frameMat);
  frame.position.set(x, yBase + height * 0.5 + 0.1, z);
  ctx.root.add(frame);

  const door = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.16), panelMat);
  door.position.set(x, yBase + height * 0.5, z - 0.06);
  ctx.root.add(door);
}

function addRelicProp(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  y: number,
  z: number,
  collected: boolean,
  color = '#d9a452'
): { mesh: THREE.Group; setCollected: () => void } {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.visible = !collected;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 6), mats.pewter);
  g.add(base);
  const orbMat = new THREE.MeshBasicMaterial({ color });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), orbMat);
  orb.position.y = 0.22;
  g.add(orb);
  ctx.root.add(g);

  return {
    mesh: g,
    setCollected: () => {
      g.visible = false;
    },
  };
}

function makeRoomPerimeterWalls(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  cx: number,
  yBase: number,
  cz: number,
  w: number,
  d: number,
  h: number,
  openSide?: { side: 'north' | 'south' | 'east' | 'west'; gapWidth: number }
): void {
  const wt = 0.45;
  const hw = w * 0.5;
  const hd = d * 0.5;

  const addSegmented = (
    axis: 'x' | 'z',
    fixedCoord: number,
    spanLen: number,
    isOpen: boolean,
    gapW: number
  ) => {
    if (!isOpen) {
      if (axis === 'x') addSolidWall(ctx, mat, cx, yBase, fixedCoord, spanLen, h, wt);
      else addSolidWall(ctx, mat, fixedCoord, yBase, cz, wt, h, spanLen);
      return;
    }
    const wing = Math.max(0.5, (spanLen - gapW) * 0.5);
    const offset = gapW * 0.5 + wing * 0.5;
    if (axis === 'x') {
      addSolidWall(ctx, mat, cx - offset, yBase, fixedCoord, wing, h, wt);
      addSolidWall(ctx, mat, cx + offset, yBase, fixedCoord, wing, h, wt);
    } else {
      addSolidWall(ctx, mat, fixedCoord, yBase, cz - offset, wt, h, wing);
      addSolidWall(ctx, mat, fixedCoord, yBase, cz + offset, wt, h, wing);
    }
  };

  addSegmented('x', cz - hd, w, openSide?.side === 'north', openSide?.gapWidth ?? 0);
  addSegmented('x', cz + hd, w, openSide?.side === 'south', openSide?.gapWidth ?? 0);
  addSegmented('z', cx - hw, d, openSide?.side === 'west', openSide?.gapWidth ?? 0);
  addSegmented('z', cx + hw, d, openSide?.side === 'east', openSide?.gapWidth ?? 0);
}

/**
 * 1. HOLLOWBARK HOMESTEAD (2-Story Half-Timbered Manor Interior)
 * Ground Floor: Hearth Hall (image_9a04e3db.png) + Feast Table (image_7e45b3b1.png) + Pantry Alcove
 * Upper Floor (y = 3.2m): Manor Bedroom (image_6099594f.png) + Study Loft & Homestead Ledger
 */
function buildCabinInterior(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Ground floor shell (12.4m x 12.6m)
  addFloorSlab(ctx, mats.woodPlank, 0, 0, 0, 12.4, 12.8);
  // South entrance wall, West, North & East walls (height 6.6m enclosing two stories)
  makeRoomPerimeterWalls(ctx, mats.plaster, 0, 0, 0, 12.4, 12.8, 6.6);
  // Lower stone wainscoting
  for (const [wx, wz, ww, wd] of [
    [0, -6.12, 11.8, 0.2],
    [0, 6.12, 11.8, 0.2],
    [-5.95, 0, 0.2, 12.0],
    [5.95, 0, 0.2, 12.0],
  ]) {
    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(ww, 1.35, wd), mats.stone);
    wainscot.position.set(wx, 0.67, wz);
    root.add(wainscot);
  }

  addCeilingSlab(ctx, mats.timber, 0, 6.5, 0, 12.8, 13.2);
  addTimberBeamCeiling(ctx, mats.bark, 0, 6.32, 0, 12.2, 12.4, 5, true);

  // Entry Door (South wall z = 6.15)
  addEntryDoorMesh(ctx, mats, 0, 0, 6.08, 1.6, 2.35, false);
  portals.push({
    id: 'portal_cabin_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 5.55,
    radius: 1.9,
    label: 'Exit to Thornvale Forest',
    transitionKind: 'wood',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Glowing casement windows
  addLitCasementWindow(ctx, mats, -3.5, 1.85, 6.12, 1.2, 1.25, 0);
  addLitCasementWindow(ctx, mats, 3.5, 1.85, 6.12, 1.2, 1.25, 0);
  addLitCasementWindow(ctx, mats, -5.92, 4.7, -2.5, 1.25, 1.25, Math.PI * 0.5);
  addLitCasementWindow(ctx, mats, 5.92, 4.7, -2.5, 1.25, 1.25, Math.PI * 0.5);

  // Ground-Floor Northwest Wainscoted Smuggler Alcove (x = -6.2..-3.6, z = -6.4..-3.6)
  // Doorway gap at x = -5.9..-3.9, z = -3.6 is sealed by ExplorationSystem's false wainscot panel!
  addSolidWall(ctx, mats.timber, -3.6, 0, -5.0, 0.32, 3.15, 2.8);
  addSolidWall(ctx, mats.timber, -6.05, 0, -3.6, 0.3, 3.15, 0.32);

  // Hearth Hall: Sunken Stone Fireplace on West wall + Woven Rug + Dining Set
  addStoneFireplace(ctx, mats, -5.3, 0, 0.2, Math.PI * 0.5, true, 1.1);
  addWovenRug(ctx, mats.rug, -1.6, 0, 0.4, 3.8, 4.8);
  addDiningTableSet(ctx, mats, 0.4, 0, 0.2, 2.7, 1.15, Math.PI * 0.5, 4);
  addWallShelf(ctx, mats, 3.2, 1.65, -5.85, 1.9, 0);
  addBarrelCluster(ctx, mats, 4.8, 0, 4.4, 3);
  addChestAndDrawer(ctx, mats, -4.8, 0, 4.5, 0.35);

  // Wall Torch Sconces downstairs
  addWallTorchSconce(ctx, mats, 0, 2.25, -5.95, 0, 1, 2.4, true, 5.5, 12);
  addWallTorchSconce(ctx, mats, 5.85, 2.25, 1.5, -1, 0, 3.7, true, 5.5, 12);

  // Walkable Staircase climbing from Ground (z = 3.4 -> -1.2, x = 4.5) cleanly flush with Loft Floor (y = 3.2)
  addWalkableStaircase(
    ctx,
    mats.woodPlank,
    4.5,
    1.1,
    1.85,
    4.6,
    0,
    3.2,
    'z',
    -1,
    14,
    mats.bark,
    { underSolid: true, underCollider: true, exposedSides: ['neg'] }
  );

  // Second Floor Landing & Bedroom Loft (y = 3.2, covering north half z = -6.3 .. -1.2)
  addFloorSlab(ctx, mats.woodPlank, -1.3, 3.2, -3.75, 9.6, 5.1, 0.26, true, true);
  addFloorSlab(ctx, mats.woodPlank, 4.45, 3.2, -3.75, 2.8, 5.1, 0.26, true, true);
  // Balcony timber balustrade overlooking the hearth hall (leaving stair gap at x = 3.6..5.4 clear!)
  addSolidWall(ctx, mats.bark, -1.3, 3.2, -1.28, 9.2, 0.95, 0.16, 0, false);

  // Upper Manor Bedroom (image_6099594f.png)
  addWovenRug(ctx, mats.rug, -2.5, 3.2, -3.8, 3.8, 3.2);
  addCanopyBed(ctx, mats, -4.1, 3.2, -4.4, 0);
  addChestAndDrawer(ctx, mats, -1.3, 3.2, -5.5, 0);
  addHighBackChair(root, mats.woodPlank, 0.2, 3.2, -3.6, -0.7);
  addWallTorchSconce(ctx, mats, -2.6, 5.0, -5.95, 0, 1, 5.1, true, 5.2, 11);

  // Interactive Homestead Ledger Relic on side table / chest
  const ledgerDone = actions.isRelicCollected('relic_cabin_ledger');
  const ledgerVisual = addRelicProp(ctx, mats, -1.3, 3.88, -5.5, ledgerDone, '#e0b05c');
  interactables.push({
    id: 'relic_cabin_ledger',
    x: -1.3,
    y: 3.2,
    z: -5.5,
    radius: 2.0,
    kind: 'relic',
    label: 'Inspect Forester Ledger',
    onActivate: () => {
      ledgerVisual.setCollected();
      actions.collectRelic('relic_cabin_ledger', 'Forester Watch Ledger');
      return 'Found: Forester Watch Ledger';
    },
  });

  // Ground-floor found book on dining table
  let cabinBookDone = actions.isFoundItemCollected('found_cabin_chronicles');
  const cabinBookMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.24),
    new THREE.MeshLambertMaterial({ color: '#5c3c28', flatShading: true })
  );
  cabinBookMesh.position.set(0.4, 0.82, 0.2);
  cabinBookMesh.rotation.y = 0.4;
  cabinBookMesh.visible = !cabinBookDone;
  root.add(cabinBookMesh);
  interactables.push({
    id: 'found_cabin_chronicles',
    x: 0.4,
    y: 0,
    z: 0.2,
    radius: 2.1,
    kind: 'found_item',
    label: 'Take Water-Stained Chronicles',
    isAvailable: () => !cabinBookDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_cabin_chronicles', [
        { itemId: 'damaged_book', quantity: 1 },
      ]);
      if (res.ok) {
        cabinBookDone = true;
        cabinBookMesh.visible = false;
      }
      return res.message;
    },
  });

  return {
    id: 'cabin_interior',
    name: 'Hollowbark Homestead — Interior',
    group: root,
    lighting: {
      atmosphere: 'house',
      backgroundColor: '#14110e',
      fogColor: '#1c1814',
      fogDensity: 0.026,
      ambientColor: '#6f6152',
      ambientIntensity: 0.95,
      hemiSky: '#a89680',
      hemiGround: '#3d3024',
      hemiIntensity: 1.05,
      dirColor: '#e8c499',
      dirIntensity: 0.65,
      dirPosition: [-4, 9, 4],
      exposure: 1.25,
      lanternIntensity: 1.35,
      lanternDistance: 10.5,
      defaultCamDistance: 4.5,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 8.5,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 2. ELDERWOOD COTTAGE (Cozy Rustic House Built Around a Giant Intruding Tree + Root Cellar)
 */
function buildCottageInterior(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Main upper room (10.4m x 10.6m) with explicit walls leaving North cellar archway open (x = 1.6..4.0)
  addFloorSlab(ctx, mats.woodPlank, 0, 0, 0, 10.4, 10.6);
  addSolidWall(ctx, mats.timber, 0, 0, 5.3, 10.4, 3.9, 0.45);
  addSolidWall(ctx, mats.timber, -5.2, 0, 0, 0.45, 3.9, 10.6);
  addSolidWall(ctx, mats.timber, 5.2, 0, 0, 0.45, 3.9, 10.6);
  addSolidWall(ctx, mats.timber, -1.8, 0, -5.3, 6.8, 3.9, 0.45);
  addSolidWall(ctx, mats.timber, 4.6, 0, -5.3, 1.2, 3.9, 0.45);
  addCeilingSlab(ctx, mats.timber, 0, 3.85, 0, 10.8, 11.0);
  addTimberBeamCeiling(ctx, mats.bark, 0, 3.68, 0, 10.0, 10.2, 4, false);

  addEntryDoorMesh(ctx, mats, 0, 0, 5.05, 1.4, 2.2, false);
  portals.push({
    id: 'portal_cottage_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 4.65,
    radius: 1.85,
    label: 'Exit to Thornvale Forest',
    transitionKind: 'wood',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Giant intruding gnarled tree trunk & roots piercing the north-west corner!
  const treeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.92, 4.2, 7), mats.bark);
  treeTrunk.position.set(-3.4, 1.9, -3.2);
  treeTrunk.rotation.z = -0.09;
  root.add(treeTrunk);
  ctx.circleColliders.push({ x: -3.4, z: -3.2, radius: 1.05, kind: 'tree' });

  addLitCasementWindow(ctx, mats, -2.5, 1.7, 5.05, 1.0, 1.0, 0);
  addLitCasementWindow(ctx, mats, 2.5, 1.7, 5.05, 1.0, 1.0, 0);

  // Stone hearth on East wall, cot, workbench & woven rug
  addStoneFireplace(ctx, mats, 4.55, 0, -1.0, -Math.PI * 0.5, true, 2.2);
  addWovenRug(ctx, mats.rug, 0.2, 0, 0.6, 3.2, 3.8);
  addDiningTableSet(ctx, mats, 0.2, 0, 0.6, 1.9, 0.95, 0, 2);
  addChestAndDrawer(ctx, mats, -3.8, 0, 1.8, Math.PI * 0.5);
  addWallShelf(ctx, mats, 0.0, 1.65, -4.95, 2.2, 0);
  addBarrelCluster(ctx, mats, -4.0, 0, 3.6, 2);

  // Stepped Root Cellar Alcove descending along North-East wing (z = -5.3 -> -7.3 -> -10.5, y = 0 -> -1.2)
  addFloorSlab(ctx, mats.stone, 2.8, -1.2, -8.9, 4.8, 3.2);
  addSolidWall(ctx, mats.mossStone, 0.4, -1.2, -7.9, 0.45, 5.1, 5.2);
  addSolidWall(ctx, mats.mossStone, 5.2, -1.2, -7.9, 0.45, 5.1, 5.2);
  addSolidWall(ctx, mats.mossStone, 2.8, -1.2, -10.5, 4.8, 5.1, 0.45);
  // Side curbs flanking cellar stair descent so player cannot fall into side gap
  addSolidWall(ctx, mats.mossStone, 1.25, -1.2, -6.3, 1.3, 1.45, 2.1, 0, false);
  addSolidWall(ctx, mats.mossStone, 4.35, -1.2, -6.3, 1.3, 1.45, 2.1, 0, false);
  addCeilingSlab(ctx, mats.stone, 2.8, 2.7, -7.9, 5.2, 5.4);
  addWalkableStaircase(ctx, mats.stone, 2.8, -6.3, 1.85, 2.0, -1.2, 0, 'z', 1, 6, undefined, {
    underSolid: true,
    underCollider: false,
  });

  const herbDone = actions.isRelicCollected('relic_cottage_charm');
  const charmVisual = addRelicProp(ctx, mats, 2.8, -1.2 + 0.72, -9.4, herbDone, '#7ad19c');
  const shelfPed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.7), mats.timber);
  shelfPed.position.set(2.8, -1.2 + 0.36, -9.4);
  root.add(shelfPed);

  addWallTorchSconce(ctx, mats, 2.8, 0.8, -10.1, 0, 1, 4.4, true, 4.8, 10);

  interactables.push({
    id: 'relic_cottage_charm',
    x: 2.8,
    y: -1.2,
    z: -9.4,
    radius: 2.0,
    kind: 'relic',
    label: 'Take Rootbound Charm',
    onActivate: () => {
      charmVisual.setCollected();
      actions.collectRelic('relic_cottage_charm', 'Rootbound Herb Charm');
      return 'Found: Rootbound Herb Charm';
    },
  });

  // Sealed tallow flask & coins atop Elderwood chest
  let cottageFlaskDone = actions.isFoundItemCollected('found_cottage_tallow');
  const flaskVis = addRelicProp(ctx, mats, -3.8, 0.72, 1.8, cottageFlaskDone, '#98b0bd');
  interactables.push({
    id: 'found_cottage_tallow',
    x: -3.8,
    y: 0,
    z: 1.8,
    radius: 2.0,
    kind: 'found_item',
    label: 'Take Sealed Tallow Flask',
    isAvailable: () => !cottageFlaskDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_cottage_tallow', [
        { itemId: 'lantern_tallow_flask', quantity: 1 },
        { itemId: 'old_coin', quantity: 2 },
      ]);
      if (res.ok) {
        cottageFlaskDone = true;
        flaskVis.setCollected();
      }
      return res.message;
    },
  });

  return {
    id: 'cottage_interior',
    name: 'Elderwood Cottage — Interior',
    group: root,
    lighting: {
      atmosphere: 'house',
      backgroundColor: '#12100d',
      fogColor: '#191612',
      fogDensity: 0.028,
      ambientColor: '#6d6050',
      ambientIntensity: 0.9,
      hemiSky: '#a2927c',
      hemiGround: '#392d22',
      hemiIntensity: 1.0,
      dirColor: '#e4be8f',
      dirIntensity: 0.55,
      dirPosition: [4, 7, 3],
      exposure: 1.24,
      lanternIntensity: 1.35,
      lanternDistance: 10.5,
      defaultCamDistance: 4.3,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 11.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 3. GREYWATCH TOWER (3-Level Vertical Stone Keep + Walkable Switchback Stairs + Upper Belfry Beacon)
 */
function buildTowerInterior(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Floor 1 (y = 0, 8.2m x 8.2m) & tall keep stone perimeter (height 7.6m)
  // Leave Floor 2 NW doorway open at West wall (x = -4.2, y = 3.4..6.6, z = -3.6..-1.6) for Secret Armory
  addFloorSlab(ctx, mats.stone, 0, 0, 0, 8.4, 8.4);
  addSolidWall(ctx, mats.stone, 0, 0, -4.2, 8.4, 7.6, 0.45);
  addSolidWall(ctx, mats.stone, 0, 0, 4.2, 8.4, 7.6, 0.45);
  addSolidWall(ctx, mats.stone, 4.2, 0, 0, 0.45, 7.6, 8.4);
  // West wall lower tier (y = 0..3.4), upper rim (y = 6.7..7.6), and Floor 2 piers flanking z = -2.6 (gap 2.0m)
  addSolidWall(ctx, mats.stone, -4.2, 0, 0, 0.45, 3.4, 8.4);
  addSolidWall(ctx, mats.stone, -4.2, 6.7, 0, 0.45, 0.9, 8.4);
  addSolidWall(ctx, mats.stone, -4.2, 3.4, -3.9, 0.45, 3.3, 0.6);
  addSolidWall(ctx, mats.stone, -4.2, 3.4, 1.3, 0.45, 3.3, 5.8);

  addEntryDoorMesh(ctx, mats, 0, 0, 4.0, 1.65, 2.6, true);
  portals.push({
    id: 'portal_tower_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 3.55,
    radius: 1.9,
    label: 'Exit to Greywatch Crest',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Guardroom props (Floor 1)
  addWeaponArmorRack(ctx, mats, -2.9, 0, -2.8, 0.4);
  addBarrelCluster(ctx, mats, -3.1, 0, 2.2, 3);
  addDiningTableSet(ctx, mats, -1.2, 0, -0.4, 1.8, 0.9, 0, 2);
  addWallTorchSconce(ctx, mats, 0, 2.1, -3.92, 0, 1, 1.1, true, 6.2, 12);
  addWallTorchSconce(ctx, mats, -3.92, 2.1, 0, 1, 0, 2.5, true, 5.5, 11);

  // Staircase 1 (L-Turn Switchback with Mid-Landing at y = 1.7 -> opens cleanly onto NW Floor 2)
  addWalkableStaircase(ctx, mats.stone, 3.05, 0.4, 1.75, 4.0, 0, 1.7, 'z', -1, 8, mats.iron, {
    underSolid: true,
    underCollider: true,
    exposedSides: ['neg'],
  });
  addFloorSlab(ctx, mats.stone, 2.95, 1.7, -2.75, 2.2, 2.3, 0.28, true, true);
  addWalkableStaircase(ctx, mats.stone, 0.2, -2.95, 1.75, 3.4, 1.7, 3.4, 'x', -1, 8, mats.iron, {
    underSolid: true,
    underCollider: true,
    exposedSides: ['pos'],
  });

  // Floor 2: Mid Armory & Watch Quarters (y = 3.4, full clear walk space + zero stairwell overlaps)
  addFloorSlab(ctx, mats.woodPlank, -1.0, 3.4, 1.25, 6.0, 5.5, 0.24, true, true);
  addFloorSlab(ctx, mats.woodPlank, -2.75, 3.4, -2.75, 2.5, 2.5, 0.24, true, true);
  addFloorSlab(ctx, mats.woodPlank, 3.0, 3.4, 3.25, 2.0, 1.5, 0.24, true, true);
  // Floor 2 stairwell guardrails (protecting open drop on Floor 2 without blocking arrivals!)
  addSolidWall(ctx, mats.bark, 0.25, 3.4, -1.52, 3.5, 0.85, 0.14, 0, false);
  addSolidWall(ctx, mats.bark, 2.02, 3.4, 0.5, 0.14, 0.85, 4.0, 0, false);

  addWallTorchSconce(ctx, mats, -3.92, 5.3, -1.2, 1, 0, 3.6, true, 6.0, 11);
  addChestAndDrawer(ctx, mats, 0.1, 3.4, 3.35, Math.PI);
  addWeaponArmorRack(ctx, mats, -0.35, 3.4, 0.45, 0);

  // Secret Watch Armory Annex (Floor 2 West Wing: x = -7.8..-4.2, y = 3.4, z = -4.2..-1.0)
  addFloorSlab(ctx, mats.stone, -6.0, 3.4, -2.6, 3.8, 3.2, 0.24, true, true);
  makeRoomPerimeterWalls(ctx, mats.stone, -6.0, 3.4, -2.6, 3.6, 3.2, 3.3, {
    side: 'east',
    gapWidth: 2.0,
  });
  addCeilingSlab(ctx, mats.darkStone, -6.0, 6.7, -2.6, 4.0, 3.6);
  addWeaponArmorRack(ctx, mats, -6.8, 3.4, -1.55, 0);
  addWallTorchSconce(ctx, mats, -7.55, 5.1, -2.6, 1, 0, 5.2, true, 5.4, 10);

  // Staircase 2 (L-Turn Switchback with Mid-Landing at y = 5.1 -> opens cleanly onto SE Floor 3)
  addWalkableStaircase(ctx, mats.woodPlank, -3.05, 0.4, 1.75, 3.2, 3.4, 5.1, 'z', 1, 8, mats.bark, {
    underSolid: true,
    underCollider: true,
    exposedSides: ['pos'],
  });
  addFloorSlab(ctx, mats.woodPlank, -2.95, 5.1, 2.95, 2.2, 1.9, 0.24, true, true);
  addWalkableStaircase(ctx, mats.woodPlank, -0.2, 2.95, 1.75, 3.4, 5.1, 6.8, 'x', 1, 8, mats.bark, {
    underSolid: true,
    underCollider: true,
    exposedSides: ['neg'],
  });

  // Floor 3: Upper Octagonal Observation Belfry Deck (y = 6.8)
  addFloorSlab(ctx, mats.stone, 0.0, 6.8, -0.95, 8.0, 6.1, 0.28, true, true);
  addFloorSlab(ctx, mats.stone, 2.75, 6.8, 3.05, 2.5, 1.9, 0.28, true, true);
  addSolidWall(ctx, mats.mossStone, -0.25, 6.8, 2.08, 3.5, 0.85, 0.16, 0, false);

  // Belfry open arched pillars + stone crenellations + sky roof crown (y = 6.8..10.4)
  for (const [px, pz] of [
    [-3.6, -3.6],
    [3.6, -3.6],
    [-3.6, 3.6],
    [3.6, 3.6],
  ]) {
    addStonePillar(ctx, mats.stone, mats.carvedStone, px, 6.8, pz, 0.44, 3.3);
  }
  // Low parapet walls around top deck (keeps player safe!)
  addSolidWall(ctx, mats.mossStone, 0, 6.8, -4.1, 8.4, 1.1, 0.4, 0, false);
  addSolidWall(ctx, mats.mossStone, 0, 6.8, 4.1, 8.4, 1.1, 0.4, 0, false);
  addSolidWall(ctx, mats.mossStone, -4.1, 6.8, 0, 0.4, 1.1, 8.4, 0, false);
  addSolidWall(ctx, mats.mossStone, 4.1, 6.8, 0, 0.4, 1.1, 8.4, 0, false);
  addCeilingSlab(ctx, mats.darkStone, 0, 10.1, 0, 8.6, 8.6);

  // Ignitable Watchtower Warning Beacon Brazier on Top Deck!
  const beaconLitInitial = actions.isBrazierLit('brazier_tower_beacon');
  const beacon = addInteriorBrazier(ctx, mats, 0.8, 6.8, -0.4, beaconLitInitial, 4.8, '#ff9438', 8.5);
  let beaconLit = beaconLitInitial;
  interactables.push({
    id: 'brazier_tower_beacon',
    x: 0.8,
    y: 6.8,
    z: -0.4,
    radius: 2.2,
    kind: 'brazier',
    label: beaconLit ? 'Watchtower Beacon Lit' : 'Ignite Watchtower Beacon',
    onActivate: () => {
      if (beaconLit) return 'The Greywatch signal beacon burns bright.';
      beaconLit = true;
      beacon.emberMesh.visible = true;
      beacon.lightAnchor.baseIntensity = 8.5;
      actions.setBrazierLit('brazier_tower_beacon', true);
      return 'Ignited: Greywatch Signal Beacon';
    },
  });

  // Floor 2 Greywatch Signet Ring on Armory chest
  let towerSignetDone = actions.isFoundItemCollected('found_tower_signet');
  const signetVis = addRelicProp(ctx, mats, 0.1, 3.4 + 0.72, 3.35, towerSignetDone, '#c8d0d6');
  interactables.push({
    id: 'found_tower_signet',
    x: 0.1,
    y: 3.4,
    z: 3.35,
    radius: 2.1,
    kind: 'found_item',
    label: 'Take Greywatch Signet Ring',
    isAvailable: () => !towerSignetDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_tower_signet', [
        { itemId: 'iron_signet', quantity: 1 },
      ]);
      if (res.ok) {
        towerSignetDone = true;
        signetVis.setCollected();
      }
      return res.message;
    },
  });

  return {
    id: 'tower_interior',
    name: 'Greywatch Tower — Interior',
    group: root,
    lighting: {
      atmosphere: 'dungeon',
      backgroundColor: '#111519',
      fogColor: '#1b2229',
      fogDensity: 0.022,
      ambientColor: '#667582',
      ambientIntensity: 0.9,
      hemiSky: '#90a3b3',
      hemiGround: '#32383e',
      hemiIntensity: 1.0,
      dirColor: '#c3d0db',
      dirIntensity: 0.85,
      dirPosition: [5, 14, 5],
      exposure: 1.25,
      lanternIntensity: 1.5,
      lanternDistance: 12,
      defaultCamDistance: 4.4,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 10.5,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 4. SANCTUM OF WHISPERING ROOTS (Inner Monumental Temple Hall)
 */
function buildShrineInterior(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Long pillared temple hall (12.8m wide x 20.6m deep) with North Reliquary doorway
  addFloorSlab(ctx, mats.carvedStone, 0, 0, 0, 12.8, 20.6);
  makeRoomPerimeterWalls(ctx, mats.darkStone, 0, 0, 0, 12.8, 20.6, 6.2, {
    side: 'north',
    gapWidth: 2.6,
  });
  addCeilingSlab(ctx, mats.darkStone, 0, 6.1, 0, 13.2, 21.0);

  // Entry Double Door (South z = 10.0)
  addEntryDoorMesh(ctx, mats, 0, 0, 9.95, 2.0, 2.8, true);
  portals.push({
    id: 'portal_shrine_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 9.3,
    radius: 2.1,
    label: 'Exit to Whispering Glade',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Colonnade of carved temple pillars + Hooded Sentinel Statues
  for (const pz of [-5.8, -1.8, 2.2, 6.2]) {
    addStonePillar(ctx, mats.carvedStone, mats.mossStone, -3.5, 0, pz, 0.48, 5.9);
    addStonePillar(ctx, mats.carvedStone, mats.mossStone, 3.5, 0, pz, 0.48, 5.9);
  }
  addHoodedStatue(ctx, mats, -5.0, 0, -3.8, Math.PI * 0.5, 1.05);
  addHoodedStatue(ctx, mats, 5.0, 0, -3.8, -Math.PI * 0.5, 1.05);
  addHoodedStatue(ctx, mats, -5.0, 0, 3.8, Math.PI * 0.5, 1.0);
  addHoodedStatue(ctx, mats, 5.0, 0, 3.8, -Math.PI * 0.5, 1.0);

  // Creeping subterranean roots hanging from ceiling
  for (const [rx, rz] of [
    [-2.8, -4.5],
    [3.1, -6.2],
    [-4.2, 1.5],
    [4.4, 2.4],
  ]) {
    const rootStrand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 4.2, 5), mats.bark);
    rootStrand.position.set(rx, 4.2, rz);
    rootStrand.rotation.z = rx > 0 ? 0.12 : -0.12;
    root.add(rootStrand);
  }

  // Raised Inner Altar Dais at North End (z = -5.7 .. -10.4, y = 0.72)
  addFloorSlab(ctx, mats.carvedStone, 0, 0.72, -8.05, 8.6, 4.7, 0.72, true);
  addWalkableStaircase(ctx, mats.mossStone, 0, -5.2, 4.2, 1.4, 0, 0.72, 'z', -1, 4);

  // North Moonstone Reliquary Alcove (behind Moon-Seal at z = -10.3)
  addFloorSlab(ctx, mats.carvedStone, 0, 0.72, -12.3, 4.8, 4.2, 0.72, true);
  makeRoomPerimeterWalls(ctx, mats.darkStone, 0, 0.72, -12.3, 4.8, 4.2, 5.4, {
    side: 'south',
    gapWidth: 2.6,
  });
  addCeilingSlab(ctx, mats.darkStone, 0, 6.1, -12.3, 5.2, 4.6);
  addStonePillar(ctx, mats.carvedStone, mats.mossStone, -1.9, 0.72, -13.9, 0.34, 5.2);
  addStonePillar(ctx, mats.carvedStone, mats.mossStone, 1.9, 0.72, -13.9, 0.34, 5.2);
  addWallTorchSconce(ctx, mats, 0, 3.0, -14.1, 0, 1, 5.8, true, 5.4, 11);

  const altarBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.05, 1.35), mats.carvedStone);
  altarBody.position.set(0, 0.72 + 0.52, -8.2);
  root.add(altarBody);
  ctx.boxColliders.push({ cx: 0, cz: -8.2, halfW: 1.45, halfD: 0.72, rotY: 0, kind: 'ruin' });

  // Ritual Braziers flanking altar (West lit, East ignitable)
  addInteriorBrazier(ctx, mats, -2.5, 0.72, -7.4, true, 1.8, '#ff983c', 7.6);
  const eastLit0 = actions.isBrazierLit('brazier_shrine_east');
  const eastBrazier = addInteriorBrazier(ctx, mats, 2.5, 0.72, -7.4, eastLit0, 3.1, '#ff983c', 7.6);
  let eastLit = eastLit0;
  interactables.push({
    id: 'brazier_shrine_east',
    x: 2.5,
    y: 0.72,
    z: -7.4,
    radius: 2.2,
    kind: 'brazier',
    label: eastLit ? 'Sacred Flame Kindled' : 'Kindle Sacred Brazier',
    onActivate: () => {
      if (eastLit) return 'The sacred sanctuary flame already burns.';
      eastLit = true;
      eastBrazier.emberMesh.visible = true;
      eastBrazier.lightAnchor.baseIntensity = 7.6;
      actions.setBrazierLit('brazier_shrine_east', true);
      return 'Kindled: Sacred Sanctuary Brazier';
    },
  });

  // Relic at altar
  const relicDone = actions.isRelicCollected('relic_shrine_sigil');
  const sigilVisual = addRelicProp(ctx, mats, 0, 0.72 + 1.08, -8.2, relicDone, '#e6a856');
  interactables.push({
    id: 'relic_shrine_sigil',
    x: 0,
    y: 0.72,
    z: -8.2,
    radius: 2.4,
    kind: 'relic',
    label: 'Claim Whispering Root Sigil',
    onActivate: () => {
      sigilVisual.setCollected();
      actions.collectRelic('relic_shrine_sigil', 'Whispering Root Sigil');
      return 'Found: Whispering Root Sigil';
    },
  });

  addWallTorchSconce(ctx, mats, -6.1, 2.3, 4.5, 1, 0, 0.8, true, 5.5, 12);
  addWallTorchSconce(ctx, mats, 6.1, 2.3, 4.5, -1, 0, 2.4, true, 5.5, 12);
  addWovenRug(ctx, mats.rug, 0, 0, 1.5, 2.4, 12.0);

  return {
    id: 'shrine_interior',
    name: 'Sanctum of Whispering Roots — Inner Temple',
    group: root,
    lighting: {
      atmosphere: 'dungeon',
      backgroundColor: '#0e1213',
      fogColor: '#141b1c',
      fogDensity: 0.032,
      ambientColor: '#566466',
      ambientIntensity: 0.78,
      hemiSky: '#7d8f8b',
      hemiGround: '#242b29',
      hemiIntensity: 0.85,
      dirColor: '#aebfb9',
      dirIntensity: 0.55,
      dirPosition: [0, 10, -4],
      exposure: 1.22,
      lanternIntensity: 1.55,
      lanternDistance: 12.5,
      defaultCamDistance: 4.8,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 16.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 5. CRAGSTONE CAVERN (Natural Deep Cave with Branching Tunnels, Deep Chasm & Wooden Bridge)
 */
function buildCaveCragstone(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Entry Chamber (z = 2 .. 12.2, y = 0)
  addFloorSlab(ctx, mats.caveRock, 0, 0, 7.2, 7.2, 10.4);
  makeRoomPerimeterWalls(ctx, mats.caveRock, 0, 0, 7.2, 7.2, 10.4, 4.4, { side: 'north', gapWidth: 3.6 });
  addCeilingSlab(ctx, mats.caveRock, 0, 4.3, 7.2, 7.6, 10.8);

  portals.push({
    id: 'portal_cave_crag_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 11.1,
    radius: 2.1,
    label: 'Exit Cragstone Cavern',
    transitionKind: 'cave',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Natural glowing ore crystals & miner's lantern at mouth
  addCrystalCluster(ctx, mats, -2.5, 0, 8.0, true, 1.3);
  addWallTorchSconce(ctx, mats, 3.25, 1.6, 5.2, -1, 0, 2.2, true, 5.5, 12);
  addBarrelCluster(ctx, mats, -2.6, 0, 3.4, 2);

  // Chasm Crossing Gallery (z = -6 .. 2.0): Deep chasm below (-4.5m), narrow wooden plank bridge across!
  const chasmVoid = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 10), mats.voidMat);
  chasmVoid.position.set(0, -4.5, -2.0);
  root.add(chasmVoid);

  // Outer Chasm Walls (keep player safely on ledges/bridge)
  addSolidWall(ctx, mats.caveRock, -7.2, -4.5, -2.0, 0.6, 9.5, 10.0);
  addSolidWall(ctx, mats.caveRock, 7.2, -4.5, -2.0, 0.6, 9.5, 10.0);
  addCeilingSlab(ctx, mats.caveRock, 0, 4.8, -2.0, 15.0, 10.5);

  // Timber & stone plank bridge across the chasm (x = 0, z = -6.2 .. 2.2) + bridge rails!
  addFloorSlab(ctx, mats.woodPlank, 0, 0, -2.0, 2.4, 8.4, 0.24, true, false);
  addSolidWall(ctx, mats.bark, -1.25, 0, -2.0, 0.16, 1.25, 8.4, 0, false);
  addSolidWall(ctx, mats.bark, 1.25, 0, -2.0, 0.16, 1.25, 8.4, 0, false);
  // Chasm guard walls along z = 2.0 & z = -6.0 outside the bridge opening
  addSolidWall(ctx, mats.caveRock, -4.2, 0, 2.0, 5.8, 1.5, 0.5, 0, false);
  addSolidWall(ctx, mats.caveRock, 4.2, 0, 2.0, 5.8, 1.5, 0.5, 0, false);
  addSolidWall(ctx, mats.caveRock, -4.2, 0, -6.0, 5.8, 1.5, 0.5, 0, false);
  addSolidWall(ctx, mats.caveRock, 4.2, 0, -6.0, 5.8, 1.5, 0.5, 0, false);

  // Deeper Cavern Vault & Hidden Smuggler's Alcove (z = -6 .. -17, y = -0.6 via stepped slope)
  addFloorSlab(ctx, mats.caveRock, 0, -0.8, -11.8, 11.6, 11.6);
  makeRoomPerimeterWalls(ctx, mats.caveRock, 0, -0.8, -11.8, 11.6, 11.6, 5.6, {
    side: 'south',
    gapWidth: 3.4,
  });
  addCeilingSlab(ctx, mats.caveRock, 0, 4.7, -11.8, 12.0, 12.0);
  addWalkableStaircase(ctx, mats.caveRock, 0, -6.6, 2.4, 1.6, -0.8, 0, 'z', 1, 4);

  // Organic boulders, stalactites & stalagmites
  addCaveBoulder(ctx, mats.caveRock, -3.4, -0.8, -10.5, 1.2, 1.1, 1.1);
  addCaveBoulder(ctx, mats.caveRock, 3.6, -0.8, -13.2, 1.4, 1.25, 1.2);
  addStalactite(ctx, mats.caveRock, -2.2, 4.7, -9.8, 1.7, 0.38);
  addStalactite(ctx, mats.caveRock, 2.4, 4.7, -14.2, 1.9, 0.42);
  addStalactite(ctx, mats.caveRock, 4.2, -0.8, -9.5, 1.35, 0.35, true);
  addCrystalCluster(ctx, mats, 0.2, -0.8, -15.8, true, 3.4);
  addCrystalCluster(ctx, mats, -4.4, -0.8, -14.8, true, 5.2);

  // Miner's Camp & Relic Chest
  addChestAndDrawer(ctx, mats, -0.2, -0.8, -15.0, 0);
  const relicDone = actions.isRelicCollected('relic_crag_ore');
  const relicVis = addRelicProp(ctx, mats, -0.2, -0.1, -15.0, relicDone, '#7ec8e3');
  interactables.push({
    id: 'relic_crag_ore',
    x: -0.2,
    y: -0.8,
    z: -15.0,
    radius: 2.2,
    kind: 'relic',
    label: 'Take Deep-Vein Quartz Core',
    onActivate: () => {
      relicVis.setCollected();
      actions.collectRelic('relic_crag_ore', 'Deep-Vein Quartz Core');
      return 'Found: Deep-Vein Quartz Core';
    },
  });

  // Miner Satchel in Cragstone Cavern
  let cragSatchelDone = actions.isFoundItemCollected('found_crag_coins');
  const cragSatchelVis = addRelicProp(ctx, mats, 2.2, -0.8, -14.0, cragSatchelDone, '#d4a64a');
  interactables.push({
    id: 'found_crag_coins',
    x: 2.2,
    y: -0.8,
    z: -14.0,
    radius: 2.1,
    kind: 'found_item',
    label: 'Take Miner Satchel',
    isAvailable: () => !cragSatchelDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_crag_coins', [
        { itemId: 'coal_chunk', quantity: 2 },
        { itemId: 'old_coin', quantity: 3 },
      ]);
      if (res.ok) {
        cragSatchelDone = true;
        cragSatchelVis.setCollected();
      }
      return res.message;
    },
  });

  return {
    id: 'cave_cragstone',
    name: 'Cragstone Cavern',
    group: root,
    lighting: {
      atmosphere: 'cave',
      backgroundColor: '#0a0d10',
      fogColor: '#10151a',
      fogDensity: 0.042,
      ambientColor: '#485662',
      ambientIntensity: 0.65,
      hemiSky: '#637887',
      hemiGround: '#1b2024',
      hemiIntensity: 0.68,
      dirColor: '#98aec0',
      dirIntensity: 0.3,
      dirPosition: [2, 10, 4],
      exposure: 1.22,
      lanternIntensity: 1.85,
      lanternDistance: 14.5,
      defaultCamDistance: 4.4,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 18.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 6. WEEPING HOLLOW GROTTO (Humid Flooded Cave with Underground Pools, Stepping Stones & Glowing Fungi)
 */
function buildCaveWeeping(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Entry Bank (z = 4.2 .. 10.2, y = 0)
  addFloorSlab(ctx, mats.wetCaveRock, 0, 0, 7.2, 8.2, 6.4);
  makeRoomPerimeterWalls(ctx, mats.wetCaveRock, 0, 0, 7.2, 8.2, 6.4, 4.4, {
    side: 'north',
    gapWidth: 6.4,
  });
  addCeilingSlab(ctx, mats.wetCaveRock, 0, 4.3, 7.2, 8.6, 6.8);

  portals.push({
    id: 'portal_cave_weeping_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 9.4,
    radius: 2.1,
    label: 'Exit to Thornvale Woods',
    transitionKind: 'cave',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Main Humid Grotto Cavern (z = -12 .. 4.2, width = 14m) with shallow walkable water bed (y = -0.30)
  addFloorSlab(ctx, mats.wetCaveRock, 0, -0.3, -4.0, 14.0, 16.4);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 16.0), mats.water);
  pool.rotation.x = -Math.PI * 0.5;
  pool.position.set(0, -0.14, -4.0);
  root.add(pool);

  makeRoomPerimeterWalls(ctx, mats.wetCaveRock, 0, -0.3, -4.0, 14.0, 16.4, 5.0, {
    side: 'south',
    gapWidth: 6.4,
  });
  addCeilingSlab(ctx, mats.wetCaveRock, 0, 4.6, -4.0, 14.4, 16.8);

  // Walkable stepping stones & slick plank bridge winding through the flooded grotto
  const pads: [number, number, number, number][] = [
    [0, 3.3, 3.2, 2.4],
    [-1.4, 1.2, 2.4, 2.3],
    [-2.5, -1.2, 2.5, 2.3],
    [-0.9, -3.8, 2.7, 2.5],
    [1.4, -6.2, 2.6, 2.4],
    [0.0, -9.2, 5.8, 4.8], // Dry luminous fungal island at north end
  ];
  for (const [px, pz, pw, pd] of pads) {
    addFloorSlab(ctx, mats.mossStone, px, 0, pz, pw, pd, 0.32, true, false);
  }

  // Luminous fungal clusters lighting the wet grotto
  addGlowingMushroomCluster(ctx, mats, -3.5, -0.25, 2.2, 1.3, true, 0.9);
  addGlowingMushroomCluster(ctx, mats, 3.2, -0.25, -2.5, 1.4, true, 2.1);
  addGlowingMushroomCluster(ctx, mats, -2.2, 0.0, -9.6, 1.6, true, 3.5);
  addGlowingMushroomCluster(ctx, mats, 2.1, 0.0, -9.4, 1.4, true, 4.7);

  // Hanging roots & stalactites
  for (const [sx, sz, h] of [
    [-4.2, -1.5, 1.9],
    [4.0, -6.0, 2.1],
    [-1.5, -7.8, 1.6],
    [1.8, 1.5, 1.5],
  ]) {
    addStalactite(ctx, mats.wetCaveRock, sx, 4.6, sz, h, 0.35);
  }

  // Dripping humid mist particles
  const mistCount = 65;
  const mistPos = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistPos[i * 3] = ((i * 37) % 11) - 5.5;
    mistPos[i * 3 + 1] = 0.2 + ((i * 19) % 34) * 0.1;
    mistPos[i * 3 + 2] = -10 + ((i * 53) % 18);
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistPts = new THREE.Points(
    mistGeo,
    new THREE.PointsMaterial({
      map: textures.mistParticle,
      size: 0.45,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      color: '#9ec4be',
    })
  );
  root.add(mistPts);

  const relicDone = actions.isRelicCollected('relic_weeping_pearl');
  const pearlPed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.9), mats.mossStone);
  pearlPed.position.set(0, 0.32, -10.5);
  root.add(pearlPed);
  const pearlVis = addRelicProp(ctx, mats, 0, 0.72, -10.5, relicDone, '#6ec4a4');
  interactables.push({
    id: 'relic_weeping_pearl',
    x: 0,
    y: 0,
    z: -10.5,
    radius: 2.2,
    kind: 'relic',
    label: 'Gather Luminous Grotto Spore',
    onActivate: () => {
      pearlVis.setCollected();
      actions.collectRelic('relic_weeping_pearl', 'Luminous Grotto Spore');
      return 'Found: Luminous Grotto Spore';
    },
  });

  return {
    id: 'cave_weeping',
    name: 'Weeping Hollow Grotto',
    group: root,
    lighting: {
      atmosphere: 'cave',
      backgroundColor: '#0b1212',
      fogColor: '#121d1d',
      fogDensity: 0.044,
      ambientColor: '#48605c',
      ambientIntensity: 0.72,
      hemiSky: '#688c86',
      hemiGround: '#1a2422',
      hemiIntensity: 0.78,
      dirColor: '#8eb2ab',
      dirIntensity: 0.35,
      dirPosition: [0, 9, -4],
      exposure: 1.24,
      lanternIntensity: 1.8,
      lanternDistance: 14,
      defaultCamDistance: 4.5,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    particles: mistPts,
    boundsRadius: 16.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 7. SUNKEN BARROW CAVERN (Ancient Megalithic Cave with Buried Pillars, Root Lintel & Sealed Barrow Gate)
 */
function buildCaveAncient(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Entry Earthen Tunnel (z = 4.0 .. 10.6, y = 0)
  addFloorSlab(ctx, mats.caveRock, 0, 0, 7.3, 6.2, 6.8);
  makeRoomPerimeterWalls(ctx, mats.caveRock, 0, 0, 7.3, 6.2, 6.8, 4.4, {
    side: 'north',
    gapWidth: 3.4,
  });
  addCeilingSlab(ctx, mats.caveRock, 0, 4.3, 7.3, 6.6, 7.2);

  portals.push({
    id: 'portal_cave_ancient_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 9.7,
    radius: 2.0,
    label: 'Exit Sunken Barrow',
    transitionKind: 'cave',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Rock-Hewn Megalithic Steps Descending (z = 4.0 -> -0.5, y = 0 -> -1.6)
  addWalkableStaircase(ctx, mats.carvedStone, 0, 1.8, 3.2, 4.4, -1.6, 0, 'z', 1, 8);
  addSolidWall(ctx, mats.caveRock, -1.85, -1.6, 1.8, 0.5, 6.0, 4.6);
  addSolidWall(ctx, mats.caveRock, 1.85, -1.6, 1.8, 0.5, 6.0, 4.6);
  addCeilingSlab(ctx, mats.caveRock, 0, 4.2, 1.8, 4.2, 4.8);

  // Buried Pillar Vestibule (z = -0.5 .. -7.5, y = -1.6) + Sealed Barrow Gate at z = -7.6
  addFloorSlab(ctx, mats.carvedStone, 0, -1.6, -4.0, 10.6, 7.2);
  addSolidWall(ctx, mats.caveRock, -5.3, -1.6, -4.0, 0.45, 5.6, 7.2);
  addSolidWall(ctx, mats.caveRock, 5.3, -1.6, -4.0, 0.45, 5.6, 7.2);
  addSolidWall(ctx, mats.caveRock, -3.45, -1.6, -0.4, 3.7, 5.6, 0.45);
  addSolidWall(ctx, mats.caveRock, 3.45, -1.6, -0.4, 3.7, 5.6, 0.45);
  addSolidWall(ctx, mats.carvedStone, -3.3, -1.6, -7.6, 4.0, 5.6, 0.55);
  addSolidWall(ctx, mats.carvedStone, 3.3, -1.6, -7.6, 4.0, 5.6, 0.55);
  addCeilingSlab(ctx, mats.caveRock, 0, 3.9, -4.0, 11.0, 7.6);

  addStonePillar(ctx, mats.carvedStone, mats.mossStone, -3.2, -1.6, -3.6, 0.52, 4.2);
  addStonePillar(ctx, mats.carvedStone, mats.mossStone, 3.2, -1.6, -3.6, 0.52, 3.1);
  addWallTorchSconce(ctx, mats, -4.9, 0.8, -3.5, 1, 0, 1.4, true, 5.8, 12);
  addWallTorchSconce(ctx, mats, 4.9, 0.8, -3.5, -1, 0, 3.2, true, 5.8, 12);

  // Toggleable Ancient Barrow Iron Gate
  const gateInitiallyOpen = actions.isDoorOpen('door_barrow_gate');
  let gateOpen = gateInitiallyOpen;
  const barrowGate = addIronCellGate(
    ctx,
    mats,
    0,
    -1.6,
    -7.6,
    2.5,
    3.0,
    0,
    gateInitiallyOpen,
    'door_barrow_gate'
  );
  interactables.push({
    id: 'door_barrow_gate',
    x: 0,
    y: -1.6,
    z: -7.1,
    radius: 2.3,
    kind: 'door',
    label: gateOpen ? 'Close Barrow Gate' : 'Unseal Barrow Gate',
    onActivate: () => {
      gateOpen = !gateOpen;
      barrowGate.setOpen(gateOpen);
      actions.setDoorOpen('door_barrow_gate', gateOpen);
      return gateOpen ? 'Unsealed the Ancient Barrow Gate' : 'Closed the Barrow Gate';
    },
  });

  // Inner Forgotten Barrow Tomb (z = -7.6 .. -16.8, y = -1.6) with West Secret Burial Niche (z = -14.4..-12.0)
  addFloorSlab(ctx, mats.carvedStone, 0, -1.6, -12.2, 9.6, 9.2);
  addSolidWall(ctx, mats.carvedStone, 0, -1.6, -16.8, 9.6, 5.6, 0.45);
  addSolidWall(ctx, mats.carvedStone, -3.05, -1.6, -7.6, 3.5, 5.6, 0.45);
  addSolidWall(ctx, mats.carvedStone, 3.05, -1.6, -7.6, 3.5, 5.6, 0.45);
  addSolidWall(ctx, mats.carvedStone, 4.8, -1.6, -12.2, 0.45, 5.6, 9.2);
  addSolidWall(ctx, mats.carvedStone, -4.8, -1.6, -9.8, 0.45, 5.6, 4.4);
  addSolidWall(ctx, mats.carvedStone, -4.8, -1.6, -15.6, 0.45, 5.6, 2.4);
  addCeilingSlab(ctx, mats.caveRock, 0, 3.9, -12.2, 10.0, 9.6);

  // Hidden Barrow Burial Niche (x = -9.2..-4.8, y = -1.6, z = -15.4..-11.0)
  addFloorSlab(ctx, mats.carvedStone, -7.0, -1.6, -13.2, 4.6, 4.4);
  makeRoomPerimeterWalls(ctx, mats.carvedStone, -7.0, -1.6, -13.2, 4.4, 4.4, 4.6, {
    side: 'east',
    gapWidth: 2.4,
  });
  addCeilingSlab(ctx, mats.caveRock, -7.0, 3.0, -13.2, 4.8, 4.8);
  addWallTorchSconce(ctx, mats, -8.85, 0.45, -13.2, 1, 0, 4.9, true, 5.4, 10);

  addSarcophagus(ctx, mats, 0, -1.6, -13.2, 0);
  addHoodedStatue(ctx, mats, -3.3, -1.6, -14.8, 0.6, 1.0);
  addHoodedStatue(ctx, mats, 3.3, -1.6, -14.8, -0.6, 1.0);
  addInteriorBrazier(ctx, mats, -2.1, -1.6, -11.5, true, 2.7, '#ff8e38', 7.0);
  addInteriorBrazier(ctx, mats, 2.1, -1.6, -11.5, true, 4.1, '#ff8e38', 7.0);

  const relicDone = actions.isRelicCollected('relic_barrow_crown');
  const crownVis = addRelicProp(ctx, mats, 0, -1.6 + 1.0, -13.2, relicDone, '#dfb467');
  interactables.push({
    id: 'relic_barrow_crown',
    x: 0,
    y: -1.6,
    z: -13.2,
    radius: 2.3,
    kind: 'relic',
    label: 'Claim Barrow King Torque',
    onActivate: () => {
      crownVis.setCollected();
      actions.collectRelic('relic_barrow_crown', 'Barrow King Torque');
      return 'Found: Barrow King Torque';
    },
  });

  // Sunken Barrow Seal in the pillared vestibule
  let barrowSealDone = actions.isFoundItemCollected('found_barrow_seal');
  const sealItemVis = addRelicProp(ctx, mats, -3.6, -1.6, -5.8, barrowSealDone, '#98b4c4');
  interactables.push({
    id: 'found_barrow_seal',
    x: -3.6,
    y: -1.6,
    z: -5.8,
    radius: 2.1,
    kind: 'found_item',
    label: 'Take Sunken Barrow Seal',
    isAvailable: () => !barrowSealDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_barrow_seal', [
        { itemId: 'barrow_seal', quantity: 1 },
      ]);
      if (res.ok) {
        barrowSealDone = true;
        sealItemVis.setCollected();
      }
      return res.message;
    },
  });

  return {
    id: 'cave_ancient',
    name: 'Sunken Barrow Cavern',
    group: root,
    lighting: {
      atmosphere: 'cave',
      backgroundColor: '#0b0c0e',
      fogColor: '#131618',
      fogDensity: 0.038,
      ambientColor: '#565d63',
      ambientIntensity: 0.68,
      hemiSky: '#757f87',
      hemiGround: '#1c2021',
      hemiIntensity: 0.72,
      dirColor: '#b5bec4',
      dirIntensity: 0.35,
      dirPosition: [0, 9, -6],
      exposure: 1.24,
      lanternIntensity: 1.8,
      lanternDistance: 14,
      defaultCamDistance: 4.5,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 22.5,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 8. UNDERBASTION CATACOMBS (Dungeon beneath Mossy Bastion Ruins — directly inspired by image_5004605c.png!)
 * Ribbed groin-vault masonry, thick round stone piers, flickering wall torches, barred prison cells with hanging chains,
 * oak table & high-back chairs, descending crypt hall with sarcophagi, AND a hidden secret wall switch!
 */
function buildDungeonCatacombs(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // Vaulted Guard & Prison Hall (13.6m wide x 14.4m deep, y = 0)
  addFloorSlab(ctx, mats.dungeonBrick, 0, 0, 2.5, 13.8, 14.4);
  // Explicit perimeter walls leaving North stair archway (x = -1.6..1.6, z = -4.7) open!
  addSolidWall(ctx, mats.dungeonBrick, 0, 0, 9.7, 13.8, 5.4, 0.5);
  addSolidWall(ctx, mats.dungeonBrick, -6.9, 0, 2.5, 0.5, 5.4, 14.4);
  addSolidWall(ctx, mats.dungeonBrick, 6.9, 0, 2.5, 0.5, 5.4, 14.4);
  addSolidWall(ctx, mats.dungeonBrick, -4.3, 0, -4.7, 5.2, 5.4, 0.5);
  addSolidWall(ctx, mats.dungeonBrick, 4.3, 0, -4.7, 5.2, 5.4, 0.5);

  addEntryDoorMesh(ctx, mats, 0, 0, 9.4, 1.9, 2.6, true);
  portals.push({
    id: 'portal_catacombs_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 8.8,
    radius: 2.0,
    label: 'Ascend to Bastion Courtyard',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // 2x2 Ribbed Groin Vault Bays + Thick Round Stone Piers (image_5004605c.png)
  for (const bx of [-3.3, 3.3]) {
    for (const bz of [-1.0, 5.8]) {
      addGroinVaultBay(ctx, mats.dungeonBrick, mats.carvedStone, bx, 0, bz, 6.8, 7.2, 2.6, 5.1);
    }
  }
  addStonePillar(ctx, mats.dungeonBrick, mats.carvedStone, -3.2, 0, 2.4, 0.55, 4.9);
  addStonePillar(ctx, mats.dungeonBrick, mats.carvedStone, 3.2, 0, 2.4, 0.55, 4.9);

  // Oak Table + High-Back Chairs + Barrel Cluster in center-right bay (image_5004605c.png!)
  addDiningTableSet(ctx, mats, 2.2, 0, 5.2, 2.4, 1.05, 0, 4);
  addBarrelCluster(ctx, mats, 5.3, 0, 7.2, 3);
  addWeaponArmorRack(ctx, mats, 5.4, 0, -2.5, -Math.PI * 0.5);

  // West Prison Cell Alcove with Barred Iron Gate & Hanging Chains!
  addSolidWall(ctx, mats.dungeonBrick, -4.8, 0, -1.2, 3.8, 5.0, 0.45);
  const cellOpen0 = actions.isDoorOpen('door_catacomb_cell');
  let cellOpen = cellOpen0;
  const cellGate = addIronCellGate(
    ctx,
    mats,
    -3.2,
    0,
    -2.9,
    3.2,
    2.6,
    Math.PI * 0.5,
    cellOpen0,
    'door_catacomb_cell'
  );
  addHangingChains(ctx, mats.iron, -5.6, 4.4, -3.3, 2.2);
  addHangingChains(ctx, mats.iron, -4.6, 4.4, -2.3, 1.8);

  interactables.push({
    id: 'door_catacomb_cell',
    x: -2.7,
    y: 0,
    z: -2.9,
    radius: 2.2,
    kind: 'door',
    label: cellOpen ? 'Lock Prison Cell Gate' : 'Unlock Prison Cell Gate',
    onActivate: () => {
      cellOpen = !cellOpen;
      cellGate.setOpen(cellOpen);
      actions.setDoorOpen('door_catacomb_cell', cellOpen);
      return cellOpen ? 'Unlocked Iron Cell Gate' : 'Closed Iron Cell Gate';
    },
  });

  // Wall Torch Sconces along dungeon piers & walls
  addWallTorchSconce(ctx, mats, -6.55, 2.2, 5.5, 1, 0, 0.9, true, 6.8, 13);
  addWallTorchSconce(ctx, mats, 6.55, 2.2, 5.5, -1, 0, 2.3, true, 6.8, 13);
  addWallTorchSconce(ctx, mats, -6.55, 2.2, -2.6, 1, 0, 3.7, true, 6.0, 12);
  addWallTorchSconce(ctx, mats, 6.55, 2.2, -2.6, -1, 0, 5.1, true, 6.0, 12);

  // Descending Stone Staircase into Lower Crypt & Ossuary (z = -4.7 .. -9.2, y = 0 -> -1.8)
  addWalkableStaircase(ctx, mats.carvedStone, 0, -6.95, 3.1, 4.5, -1.8, 0, 'z', 1, 9);
  addSolidWall(ctx, mats.dungeonBrick, -1.9, -1.8, -6.95, 0.5, 7.2, 4.7);
  addSolidWall(ctx, mats.dungeonBrick, 1.9, -1.8, -6.95, 0.5, 7.2, 4.7);
  addCeilingSlab(ctx, mats.dungeonBrick, 0, 5.2, -6.95, 4.4, 5.0);

  // Lower Crypt & Ossuary (z = -9.2 .. -21.0, y = -1.8)
  addFloorSlab(ctx, mats.dungeonBrick, 0, -1.8, -15.1, 12.6, 11.8);
  addSolidWall(ctx, mats.dungeonBrick, -4.1, -1.8, -9.2, 4.4, 5.8, 0.5);
  addSolidWall(ctx, mats.dungeonBrick, 4.1, -1.8, -9.2, 4.4, 5.8, 0.5);
  addSolidWall(ctx, mats.dungeonBrick, -6.3, -1.8, -15.1, 0.5, 5.8, 11.8);
  addSolidWall(ctx, mats.dungeonBrick, 0, -1.8, -21.0, 12.6, 5.8, 0.5);
  // East wall of crypt has a Secret Wall Passage! (x = 6.3, z = -15.1)
  addSolidWall(ctx, mats.dungeonBrick, 6.3, -1.8, -11.4, 0.5, 5.8, 4.4);
  addSolidWall(ctx, mats.dungeonBrick, 6.3, -1.8, -18.8, 0.5, 5.8, 4.4);
  addCeilingSlab(ctx, mats.dungeonBrick, 0, 3.9, -15.1, 13.0, 12.2);

  addWovenRug(ctx, mats.rug, 0, -1.8, -15.2, 2.5, 9.5);
  addSarcophagus(ctx, mats, -3.4, -1.8, -12.6, Math.PI * 0.5);
  addSarcophagus(ctx, mats, -3.4, -1.8, -16.8, Math.PI * 0.5);
  addSarcophagus(ctx, mats, 3.4, -1.8, -12.6, Math.PI * 0.5);
  addHoodedStatue(ctx, mats, 0, -1.8, -19.5, 0, 1.15);
  addInteriorBrazier(ctx, mats, -1.8, -1.8, -18.4, true, 1.5, '#ff8834', 7.2);
  addInteriorBrazier(ctx, mats, 1.8, -1.8, -18.4, true, 4.2, '#ff8834', 7.2);

  // Secret Sliding Masonry Wall leading to Hidden Relic Vault (x = 6.3..11.5, z = -15.1)
  const secretOpen0 = actions.isDoorOpen('door_catacomb_secret');
  let secretOpen = secretOpen0;
  const secretWallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.6, 3.1), mats.carvedStone);
  secretWallMesh.position.set(6.3, secretOpen0 ? -1.8 - 4.0 : -1.8 + 2.8, -15.1);
  root.add(secretWallMesh);
  const secretCollider = {
    cx: 6.3,
    cz: -15.1,
    halfW: 0.35,
    halfD: 1.6,
    rotY: 0,
    minY: secretOpen0 ? -999 : -2.0,
    maxY: secretOpen0 ? -998 : 4.2,
    kind: 'building' as const,
  };
  ctx.boxColliders.push(secretCollider);

  // Wall Torch Lever near z = -17.2, x = 5.9
  interactables.push({
    id: 'door_catacomb_secret',
    x: 5.5,
    y: -1.8,
    z: -16.9,
    radius: 2.2,
    kind: 'secret',
    label: secretOpen ? 'Secret Crypt Vault Opened' : 'Pull Loose Wall Ring',
    onActivate: () => {
      if (secretOpen) return 'The secret stone wall has already sunk into the floor.';
      secretOpen = true;
      secretWallMesh.position.y = -5.8;
      secretCollider.minY = -999;
      secretCollider.maxY = -998;
      actions.setDoorOpen('door_catacomb_secret', true);
      return 'A hidden masonry slab grinds open!';
    },
  });

  // Hidden Secret Vault Room behind secret wall (x = 6.5 .. 11.7, z = -17.8 .. -12.4, y = -1.8)
  addFloorSlab(ctx, mats.carvedStone, 9.1, -1.8, -15.1, 5.2, 5.4);
  makeRoomPerimeterWalls(ctx, mats.carvedStone, 9.1, -1.8, -15.1, 5.2, 5.4, 4.6, {
    side: 'west',
    gapWidth: 3.1,
  });
  addCeilingSlab(ctx, mats.dungeonBrick, 9.1, 2.7, -15.1, 5.6, 5.8);
  addChestAndDrawer(ctx, mats, 10.6, -1.8, -15.1, -Math.PI * 0.5);
  const relicDone = actions.isRelicCollected('relic_catacomb_chalice');
  const chaliceVis = addRelicProp(ctx, mats, 10.6, -1.8 + 0.72, -15.1, relicDone, '#e3ae4f');
  addWallTorchSconce(ctx, mats, 11.3, 0.3, -15.1, -1, 0, 6.2, true, 5.5, 10);

  interactables.push({
    id: 'relic_catacomb_chalice',
    x: 10.6,
    y: -1.8,
    z: -15.1,
    radius: 2.1,
    kind: 'relic',
    label: 'Claim Bastion Ossuary Chalice',
    onActivate: () => {
      chaliceVis.setCollected();
      actions.collectRelic('relic_catacomb_chalice', 'Bastion Ossuary Chalice');
      return 'Found: Bastion Ossuary Chalice';
    },
  });

  return {
    id: 'dungeon_catacombs',
    name: 'Underbastion Catacombs',
    group: root,
    lighting: {
      atmosphere: 'dungeon',
      backgroundColor: '#0c0b0b',
      fogColor: '#161413',
      fogDensity: 0.036,
      ambientColor: '#57524c',
      ambientIntensity: 0.68,
      hemiSky: '#736c63',
      hemiGround: '#1b1815',
      hemiIntensity: 0.72,
      dirColor: '#bfa98d',
      dirIntensity: 0.32,
      dirPosition: [2, 10, 4],
      exposure: 1.24,
      lanternIntensity: 1.78,
      lanternDistance: 13.5,
      defaultCamDistance: 4.5,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 24.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

/**
 * 9. SUNKEN CITADEL VAULT (Monumental Forgotten Temple & Dungeon with Pillared Great Hall,
 *    Side Armory Wing, Natural Underground Chasm Crossing, and Lower Inner Sanctum)
 */
function buildDungeonVault(
  textures: ProceduralTextures,
  actions: InteriorPersistenceActions
): InteriorInstance {
  const root = new THREE.Group();
  const mats = createInteriorMaterials(textures);
  const ctx: InteriorBuildContext = {
    root,
    boxColliders: [],
    circleColliders: [],
    walkableSurfaces: [],
    embers: [],
    lightAnchors: [],
    cameraOccluders: [],
  };
  const interactables: InteriorInteractable[] = [];
  const portals: PortalLink[] = [];

  // 1. Pillared Great Hall (15.0m wide x 17.6m deep, z = -4.0 .. 13.6, y = 0)
  addFloorSlab(ctx, mats.carvedStone, 0, 0, 4.8, 15.0, 17.6);
  // South wall
  addSolidWall(ctx, mats.dungeonBrick, 0, 0, 13.6, 15.0, 6.4, 0.55);
  // West wall with sealed Treasury arch gap (z = 2.8 .. 6.8) leading to West Treasury Wing
  addSolidWall(ctx, mats.dungeonBrick, -7.5, 0, -0.6, 0.55, 6.4, 6.8);
  addSolidWall(ctx, mats.dungeonBrick, -7.5, 0, 10.2, 0.55, 6.4, 6.8);
  // East wall with wide arch gap (z = 2.8 .. 6.8) to Armory Wing
  addSolidWall(ctx, mats.dungeonBrick, 7.5, 0, -0.6, 0.55, 6.4, 6.8);
  addSolidWall(ctx, mats.dungeonBrick, 7.5, 0, 10.2, 0.55, 6.4, 6.8);
  // North wall with center gap (x = -2.1..2.1) leading to underground gorge crossing
  addSolidWall(ctx, mats.dungeonBrick, -4.8, 0, -4.0, 5.4, 6.4, 0.55);
  addSolidWall(ctx, mats.dungeonBrick, 4.8, 0, -4.0, 5.4, 6.4, 0.55);

  addCeilingSlab(ctx, mats.dungeonBrick, 0, 6.3, 4.8, 15.4, 18.0);
  addGroinVaultBay(ctx, mats.dungeonBrick, mats.carvedStone, 0, 0, 5.0, 14.5, 16.0, 3.0, 5.8);

  addEntryDoorMesh(ctx, mats, 0, 0, 13.25, 2.2, 3.0, true);
  portals.push({
    id: 'portal_vault_exit',
    targetId: 'overworld',
    x: 0,
    y: 0,
    z: 12.5,
    radius: 2.15,
    label: 'Exit to Silvermire Cliffside',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 0,
    spawnYaw: 0,
  });

  // Great Hall Colonnade & Crimson Runner Rug
  addWovenRug(ctx, mats.rug, 0, 0, 4.8, 2.8, 15.0);
  for (const gz of [-1.2, 3.8, 8.8]) {
    addStonePillar(ctx, mats.carvedStone, mats.darkStone, -3.8, 0, gz, 0.55, 6.1);
    addStonePillar(ctx, mats.carvedStone, mats.darkStone, 3.8, 0, gz, 0.55, 6.1);
  }
  addWallTorchSconce(ctx, mats, -7.1, 2.4, 8.5, 1, 0, 1.2, true, 6.5, 13);
  addWallTorchSconce(ctx, mats, 7.1, 2.4, 8.5, -1, 0, 2.5, true, 6.5, 13);
  addWallTorchSconce(ctx, mats, -7.1, 2.4, -0.5, 1, 0, 3.8, true, 6.5, 13);

  // 2. East Armory & Archive Wing (x = 7.5 .. 14.5, z = 1.0 .. 8.6, y = 0)
  addFloorSlab(ctx, mats.dungeonBrick, 11.0, 0, 4.8, 7.0, 7.6);
  makeRoomPerimeterWalls(ctx, mats.dungeonBrick, 11.0, 0, 4.8, 7.0, 7.6, 5.2, {
    side: 'west',
    gapWidth: 4.0,
  });
  addCeilingSlab(ctx, mats.dungeonBrick, 11.0, 5.1, 4.8, 7.4, 8.0);
  addWeaponArmorRack(ctx, mats, 13.3, 0, 2.5, -Math.PI * 0.5);
  addWeaponArmorRack(ctx, mats, 13.3, 0, 7.0, -Math.PI * 0.5);
  addDiningTableSet(ctx, mats, 10.8, 0, 4.8, 2.2, 1.0, Math.PI * 0.5, 2);
  addWallTorchSconce(ctx, mats, 14.1, 2.2, 4.8, -1, 0, 4.4, true, 5.8, 12);

  // 2b. Sealed West Citadel Treasury Wing (x = -14.5..-7.5, z = 1.0..8.6, y = 0)
  addFloorSlab(ctx, mats.carvedStone, -11.0, 0, 4.8, 7.0, 7.6);
  makeRoomPerimeterWalls(ctx, mats.dungeonBrick, -11.0, 0, 4.8, 7.0, 7.6, 5.2, {
    side: 'east',
    gapWidth: 4.0,
  });
  addCeilingSlab(ctx, mats.dungeonBrick, -11.0, 5.1, 4.8, 7.4, 8.0);
  addStonePillar(ctx, mats.carvedStone, mats.darkStone, -10.2, 0, 2.5, 0.44, 5.0);
  addStonePillar(ctx, mats.carvedStone, mats.darkStone, -10.2, 0, 7.1, 0.44, 5.0);
  addInteriorBrazier(ctx, mats, -13.2, 0, 2.5, true, 1.4, '#ffaa44', 6.5);
  addInteriorBrazier(ctx, mats, -13.2, 0, 7.1, true, 3.8, '#ffaa44', 6.5);

  // 3. Natural Subterranean Cavern Gorge Crossing (z = -4.0 .. -12.0) connecting Citadel Hall to Inner Sanctum
  const gorgeVoid = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 8.5), mats.voidMat);
  gorgeVoid.position.set(0, -5.0, -8.0);
  root.add(gorgeVoid);
  addSolidWall(ctx, mats.caveRock, -7.8, -5.0, -8.0, 0.6, 11.0, 8.5);
  addSolidWall(ctx, mats.caveRock, 7.8, -5.0, -8.0, 0.6, 11.0, 8.5);
  addCeilingSlab(ctx, mats.caveRock, 0, 6.2, -8.0, 16.0, 8.8);
  addStalactite(ctx, mats.caveRock, -3.5, 6.2, -7.8, 2.1, 0.45);
  addStalactite(ctx, mats.caveRock, 3.8, 6.2, -8.5, 2.3, 0.48);

  // Walkable ancient stone aqueduct bridge spanning the chasm (z = -4.0 -> -12.0, descending smoothly 0 -> -1.4)
  addWalkableStaircase(ctx, mats.carvedStone, 0, -8.0, 3.2, 8.0, -1.4, 0, 'z', 1, 10, mats.stone, {
    underCollider: false,
    exposedSides: ['neg', 'pos'],
  });

  // 4. Lower Citadel Inner Sanctum (z = -12.0 .. -23.0, y = -1.4)
  addFloorSlab(ctx, mats.carvedStone, 0, -1.4, -17.5, 13.6, 11.0);
  makeRoomPerimeterWalls(ctx, mats.carvedStone, 0, -1.4, -17.5, 13.6, 11.0, 6.4, {
    side: 'south',
    gapWidth: 3.8,
  });
  addCeilingSlab(ctx, mats.carvedStone, 0, 4.9, -17.5, 14.0, 11.4);

  addHoodedStatue(ctx, mats, -4.6, -1.4, -20.5, 0.5, 1.35);
  addHoodedStatue(ctx, mats, 4.6, -1.4, -20.5, -0.5, 1.35);

  const sanctumAltar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.15, 1.5), mats.carvedStone);
  sanctumAltar.position.set(0, -1.4 + 0.58, -20.6);
  root.add(sanctumAltar);
  ctx.boxColliders.push({ cx: 0, cz: -20.6, halfW: 1.65, halfD: 0.8, rotY: 0, kind: 'ruin' });

  const brazierLit0 = actions.isBrazierLit('brazier_vault_sanctum');
  const sBrazier = addInteriorBrazier(ctx, mats, -2.5, -1.4, -19.5, brazierLit0, 3.3, '#ff9838', 8.5);
  addInteriorBrazier(ctx, mats, 2.5, -1.4, -19.5, true, 5.7, '#ff9838', 7.8);
  let sLit = brazierLit0;
  interactables.push({
    id: 'brazier_vault_sanctum',
    x: -2.5,
    y: -1.4,
    z: -19.5,
    radius: 2.3,
    kind: 'brazier',
    label: sLit ? 'Citadel Flame Kindled' : 'Kindle Citadel Brazier',
    onActivate: () => {
      if (sLit) return 'The Citadel sanctum brazier is already ablaze.';
      sLit = true;
      sBrazier.emberMesh.visible = true;
      sBrazier.lightAnchor.baseIntensity = 8.5;
      actions.setBrazierLit('brazier_vault_sanctum', true);
      return 'Kindled: Citadel Sanctum Brazier';
    },
  });

  const relicDone = actions.isRelicCollected('relic_vault_seal');
  const sealVis = addRelicProp(ctx, mats, 0, -1.4 + 1.2, -20.6, relicDone, '#d89b4a');
  interactables.push({
    id: 'relic_vault_seal',
    x: 0,
    y: -1.4,
    z: -20.6,
    radius: 2.5,
    kind: 'relic',
    label: 'Claim Sunken Citadel Seal',
    onActivate: () => {
      sealVis.setCollected();
      actions.collectRelic('relic_vault_seal', 'Sunken Citadel Seal');
      return 'Found: Sunken Citadel Seal';
    },
  });

  // Citadel Armory Paychest on East Armory table
  let vaultPaychestDone = actions.isFoundItemCollected('found_vault_armory');
  const paychestVis = addRelicProp(ctx, mats, 10.8, 0.78, 4.8, vaultPaychestDone, '#d4a64a');
  interactables.push({
    id: 'found_vault_armory',
    x: 10.8,
    y: 0,
    z: 4.8,
    radius: 2.2,
    kind: 'found_item',
    label: 'Take Citadel Paychest',
    isAvailable: () => !vaultPaychestDone,
    onActivate: () => {
      const res = actions.collectFoundItem('found_vault_armory', [
        { itemId: 'old_coin', quantity: 5 },
        { itemId: 'iron_ore', quantity: 2 },
      ]);
      if (res.ok) {
        vaultPaychestDone = true;
        paychestVis.setCollected();
      }
      return res.message;
    },
  });

  return {
    id: 'dungeon_vault',
    name: 'Sunken Citadel Vault',
    group: root,
    lighting: {
      atmosphere: 'dungeon',
      backgroundColor: '#0c0d10',
      fogColor: '#15181d',
      fogDensity: 0.032,
      ambientColor: '#565f68',
      ambientIntensity: 0.72,
      hemiSky: '#788490',
      hemiGround: '#1a1e22',
      hemiIntensity: 0.78,
      dirColor: '#b7c4d0',
      dirIntensity: 0.38,
      dirPosition: [-2, 11, -5],
      exposure: 1.25,
      lanternIntensity: 1.8,
      lanternDistance: 14,
      defaultCamDistance: 4.8,
    },
    boxColliders: ctx.boxColliders,
    circleColliders: ctx.circleColliders,
    walkableSurfaces: ctx.walkableSurfaces,
    portals,
    interactables,
    embers: ctx.embers,
    lightAnchors: ctx.lightAnchors,
    cameraOccluders: ctx.cameraOccluders,
    boundsRadius: 26.0,
    dispose: () => disposeInteriorGroup(root),
  };
}

export function buildInteriorById(
  id: InteriorId,
  textures: ProceduralTextures,
  saveState: ThornvaleSaveState,
  onSaveChange: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void,
  getLiveSaveState?: () => ThornvaleSaveState,
  onLocationTrigger?: (triggerId: string) => void
): InteriorInstance {
  const readState = getLiveSaveState ?? (() => saveState);
  const actions: InteriorPersistenceActions = {
    isDoorOpen: (doorId) => !!readState().openedDoors[doorId],
    setDoorOpen: (doorId, open) => {
      onSaveChange((prev) => ({
        ...prev,
        openedDoors: { ...prev.openedDoors, [doorId]: open },
      }));
      if (open) onLocationTrigger?.(doorId);
    },
    isBrazierLit: (brazierId) => !!readState().litBraziers[brazierId],
    setBrazierLit: (brazierId, lit) => {
      onSaveChange((prev) => ({
        ...prev,
        litBraziers: { ...prev.litBraziers, [brazierId]: lit },
      }));
      if (lit) onLocationTrigger?.(brazierId);
    },
    isRelicCollected: (relicId) => !!readState().collectedRelics[relicId],
    collectRelic: (relicId) =>
      onSaveChange((prev) => ({
        ...prev,
        collectedRelics: { ...prev.collectedRelics, [relicId]: true },
      })),
    isFoundItemCollected: (itemNodeId) => !!readState().collectedFoundItems[itemNodeId],
    collectFoundItem: (itemNodeId, grants) => {
      const live = readState();
      if (live.collectedFoundItems[itemNodeId]) {
        return { ok: false, message: 'Already collected.' };
      }
      const probe = addItemsToInventory(live.inventory, grants, true);
      if (probe.addedTotal === 0 && probe.leftover > 0) {
        return {
          ok: false,
          message: 'Your pack is full — make space before taking this.',
        };
      }
      onSaveChange((prev) => {
        const res = addItemsToInventory(prev.inventory, grants, true);
        if (res.addedTotal === 0 && res.leftover > 0) return prev;
        return {
          ...prev,
          inventory: res.nextSlots,
          collectedFoundItems: {
            ...prev.collectedFoundItems,
            [itemNodeId]: true,
          },
        };
      });
      const summary = probe.addedItems
        .map((it) => {
          const def = ITEM_CATALOG[it.itemId];
          const name = def ? def.name : it.itemId;
          return it.quantity > 1 ? `${name} x${it.quantity}` : name;
        })
        .join(', ');
      return {
        ok: true,
        message: `Found: ${summary || 'Item'}`,
      };
    },
  };

  switch (id) {
    case 'cabin_interior':
      return buildCabinInterior(textures, actions);
    case 'cottage_interior':
      return buildCottageInterior(textures, actions);
    case 'tower_interior':
      return buildTowerInterior(textures, actions);
    case 'shrine_interior':
      return buildShrineInterior(textures, actions);
    case 'cave_cragstone':
      return buildCaveCragstone(textures, actions);
    case 'cave_weeping':
      return buildCaveWeeping(textures, actions);
    case 'cave_ancient':
      return buildCaveAncient(textures, actions);
    case 'dungeon_catacombs':
      return buildDungeonCatacombs(textures, actions);
    case 'dungeon_vault':
      return buildDungeonVault(textures, actions);
  }
}
