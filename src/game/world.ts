import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buildAncientPineGeometries,
  buildBridgeLianaGeometry,
  buildBroadleafGeometries,
  buildBushGeometry,
  buildDeadTreeGeometries,
  buildDecayingLogGeometries,
  buildFallenBranchGeometry,
  buildHangingLianaGeometry,
  buildMossMoundGeometry,
  buildRockIvyGeometry,
  buildRockVariantGeometry,
  buildRootedTreeGeometries,
  buildSaplingGeometries,
  buildSoilRootGeometry,
  buildTallConiferGeometries,
  buildTrunkIvyGeometry,
  buildTwistedTreeGeometries,
} from './foliage';
import {
  buildAbandonedCabinLocation,
  buildAncientRuinLocation,
  buildAncientShrineLocation,
  buildCaveEntranceLocation,
  buildDungeonCliffGateLocation,
  buildMedievalTowerLocation,
  buildWoodlandCottageLocation,
} from './landmarks';
import {
  createAbandonedCart,
  createDeadBogTree,
  createDistantSilhouettes,
  createGraveMarker,
  createHeroPineTree,
  createIronBrazier,
  createLanternPost,
  createOldWoodenBridge,
  createRockFormation,
  createRuinArchway,
  createSentinelStatue,
  createStandingStone,
  createWaystoneShrine,
} from './models';
import { WORLD_SEED } from './persistence';
import {
  applyRetroVertexSnap,
  BOG_CENTER,
  BOG_WATER_LEVEL,
  BRIDGE_CENTER,
  BRIDGE_YAW,
  BRIDGE_HALF_LENGTH,
  BRIDGE_HALF_WIDTH,
  buildTerrainMesh,
  CABIN_CENTER,
  CABIN_YAW,
  CAVE_ANCIENT_CENTER,
  CAVE_ANCIENT_YAW,
  CAVE_CRAG_CENTER,
  CAVE_CRAG_YAW,
  CAVE_WEEPING_CENTER,
  CAVE_WEEPING_YAW,
  CITADEL_GATE_CENTER,
  CITADEL_GATE_YAW,
  COTTAGE_CENTER,
  COTTAGE_YAW,
  getPondWaterLevel,
  groundHeightAt,
  groundSlopeAt,
  groveDensityAt,
  pathDistanceAt,
  POND_CENTER,
  RUINS_CENTER,
  RUINS_YAW,
  SHRINE_CENTER,
  SHRINE_YAW,
  streamCurve,
  streamDistanceAt,
  TOWER_CENTER,
  TOWER_YAW,
} from './terrain';
import { ProceduralTextures } from './textures';
import { BoxCollider, CircleCollider, LightAnchor, PortalLink } from './types';

export interface AnimatedEmber {
  ember: THREE.Mesh;
  phase: number;
  baseScale?: [number, number, number];
}

export interface WorldBuildResult {
  colliders: CircleCollider[];
  boxColliders: BoxCollider[];
  embers: AnimatedEmber[];
  lightAnchors: LightAnchor[];
  portals: PortalLink[];
  windUniforms: { uTime: { value: number } };
  mistPoints: THREE.Points;
  crowGroup: THREE.Group;
  setDensityScale: (density: number) => void;
}

interface PlacedTreeRecord {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  rot: number;
  species: 'tall0' | 'tall1' | 'ancient0' | 'ancient1' | 'broad0' | 'broad1' | 'twist0' | 'twist1' | 'rooted' | 'dead0' | 'dead1';
}

interface PlacedBoulderRecord {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

class SpatialGrid2D {
  private cellSize: number;
  private cells = new Map<number, { x: number; z: number }[]>();

  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cz: number): number {
    return ((cx + 512) << 12) | ((cz + 512) & 0xfff);
  }

  public hasNeighborWithin(x: number, z: number, minDist: number): boolean {
    const minDistSq = minDist * minDist;
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const span = Math.ceil(minDist / this.cellSize);

    for (let ox = -span; ox <= span; ox++) {
      for (let oz = -span; oz <= span; oz++) {
        const list = this.cells.get(this.key(cx + ox, cz + oz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const dx = x - list[i].x;
          const dz = z - list[i].z;
          if (dx * dx + dz * dz < minDistSq) return true;
        }
      }
    }
    return false;
  }

  public insert(x: number, z: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const k = this.key(cx, cz);
    let list = this.cells.get(k);
    if (!list) {
      list = [];
      this.cells.set(k, list);
    }
    list.push({ x, z });
  }
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createCrossedBillboardGeometry(width: number, height: number): THREE.BufferGeometry {
  const p1 = new THREE.PlaneGeometry(width, height);
  p1.translate(0, height * 0.5, 0);

  const p2 = new THREE.PlaneGeometry(width, height);
  p2.rotateY(Math.PI * 0.5);
  p2.translate(0, height * 0.5, 0);

  const merged = mergeGeometries([p1, p2], false);
  p1.dispose();
  p2.dispose();
  return merged;
}

function attachWindSway(
  material: THREE.MeshLambertMaterial,
  windUniforms: { uTime: { value: number } },
  amplitude: number,
  hanging = false
) {
  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);
    shader.uniforms.uTime = windUniforms.uTime;
    const swayExpr = hanging
      ? 'float swayFactor = clamp(-position.y * 0.45, 0.0, 1.45);'
      : 'float swayFactor = clamp(position.y, 0.0, 1.65);';
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        ${swayExpr}
        #ifdef USE_INSTANCING
          vec3 worldSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 worldSeed = vec3(0.0);
        #endif
        float wave = sin(uTime * 1.65 + worldSeed.x * 0.55 + worldSeed.z * 0.45) * 0.7
                   + cos(uTime * 2.8 + worldSeed.z * 0.9) * 0.3;
        transformed.x += wave * swayFactor * ${amplitude.toFixed(3)};
        transformed.z += cos(uTime * 1.4 + worldSeed.x * 0.7) * swayFactor * ${(amplitude * 0.55).toFixed(3)};
        `
      );
  };
}

function createStreamWaterGeometry(): THREE.BufferGeometry {
  const segs = 40;
  const halfW = 1.45;
  const pts = streamCurve.getPoints(segs);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const p = pts[i];
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(segs, i + 1)];
    const tx = pNext.x - pPrev.x;
    const tz = pNext.z - pPrev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;

    const centerBedY = groundHeightAt(p.x, p.z);
    const waterY = centerBedY + 0.52;

    positions.push(p.x - nx * halfW, waterY, p.z - nz * halfW);
    positions.push(p.x + nx * halfW, waterY, p.z + nz * halfW);

    const v = i / segs;
    uvs.push(0, v * 8, 1, v * 8);

    if (i < segs) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function localToWorldXZ(
  originX: number,
  originZ: number,
  yaw: number,
  lx: number,
  lz: number
): { x: number; z: number } {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: originX + lx * cos + lz * sin,
    z: originZ - lx * sin + lz * cos,
  };
}

export function buildForestWorld(
  scene: THREE.Object3D,
  textures: ProceduralTextures
): WorldBuildResult {
  const colliders: CircleCollider[] = [];
  const boxColliders: BoxCollider[] = [];
  const embers: AnimatedEmber[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const windUniforms = { uTime: { value: 0 } };
  const rand = seededRand(WORLD_SEED);
  const scalableMeshes: { inst: THREE.InstancedMesh; maxCount: number }[] = [];

  // 1. Continuous Expanded Forest Terrain (320m mesh, 92m playable radius)
  const terrain = buildTerrainMesh(textures.groundColor);
  scene.add(terrain);

  // 2. Water Features: Western Bog Tarn + Winding Blackwater Brook + Eastern Silvermire Pond
  const waterMat = new THREE.MeshLambertMaterial({
    color: '#1f2930',
    transparent: true,
    opacity: 0.88,
  });

  const bogWater = new THREE.Mesh(new THREE.CircleGeometry(5.8, 12), waterMat);
  bogWater.rotation.x = -Math.PI / 2;
  bogWater.scale.set(1.0, 1.25, 1.0);
  bogWater.position.set(BOG_CENTER.x, BOG_WATER_LEVEL, BOG_CENTER.z);
  bogWater.receiveShadow = true;
  scene.add(bogWater);

  const streamMat = new THREE.MeshLambertMaterial({
    color: '#243139',
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
  });
  const streamMesh = new THREE.Mesh(createStreamWaterGeometry(), streamMat);
  streamMesh.receiveShadow = true;
  scene.add(streamMesh);

  const pondWater = new THREE.Mesh(new THREE.CircleGeometry(7.2, 16), waterMat);
  pondWater.rotation.x = -Math.PI / 2;
  pondWater.scale.set(1.15, 0.92, 1.0);
  pondWater.position.set(POND_CENTER.x, getPondWaterLevel(), POND_CENTER.z);
  pondWater.receiveShadow = true;
  scene.add(pondWater);

  // Gnarled dead trees around the bog, pond shore, and Whispering Ring
  const deadTreeSpots = [
    { x: BOG_CENTER.x - 4.2, z: BOG_CENTER.z - 2.6, s: 1.05, r: 0.4 },
    { x: BOG_CENTER.x + 2.8, z: BOG_CENTER.z - 4.8, s: 0.92, r: -1.1 },
    { x: BOG_CENTER.x - 2.5, z: BOG_CENTER.z + 5.2, s: 1.15, r: 2.1 },
    { x: POND_CENTER.x - 7.8, z: POND_CENTER.z + 4.4, s: 1.08, r: 0.9 },
    { x: POND_CENTER.x + 6.4, z: POND_CENTER.z - 5.2, s: 0.95, r: -0.7 },
    { x: -53.0, z: -23.5, s: 1.12, r: 1.4 },
    { x: -39.5, z: -12.5, s: 1.02, r: -1.8 },
  ];
  for (const dt of deadTreeSpots) {
    const tree = createDeadBogTree(textures, dt.s);
    tree.position.set(dt.x, groundHeightAt(dt.x, dt.z) - 0.1, dt.z);
    tree.rotation.y = dt.r;
    scene.add(tree);
    colliders.push({ x: dt.x, z: dt.z, radius: 0.48 * dt.s, kind: 'tree' });
  }

  // 3. Distant Gothic Citadel, Watchtower, Aqueduct & Layered Mountain/Pine Silhouettes
  const silhouettes = createDistantSilhouettes();
  scene.add(silhouettes);

  // 4. Starting Clearing Shrine, Brazier, Fallen Log & Abandoned Cart
  const shrine = createWaystoneShrine(textures);
  const shrineX = -5.4;
  const shrineZ = -4.8;
  shrine.position.set(shrineX, groundHeightAt(shrineX, shrineZ) - 0.04, shrineZ);
  shrine.rotation.y = 0.65;
  scene.add(shrine);
  colliders.push({ x: shrineX, z: shrineZ, radius: 1.45, kind: 'ruin' });

  const clearingBrazier = createIronBrazier();
  const cbX = -3.5;
  const cbZ = -4.2;
  const cbY = groundHeightAt(cbX, cbZ) - 0.02;
  clearingBrazier.group.position.set(cbX, cbY, cbZ);
  scene.add(clearingBrazier.group);
  colliders.push({ x: cbX, z: cbZ, radius: 0.55, kind: 'prop' });
  embers.push({ ember: clearingBrazier.ember, phase: 0.4 });
  lightAnchors.push({
    x: cbX,
    y: cbY + 1.25,
    z: cbZ,
    color: '#ff8a33',
    baseIntensity: 7.0,
    distance: 18,
    phase: 0.4,
  });

  const logMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#9c8a79',
    flatShading: true,
  });
  applyRetroVertexSnap(logMat, 200);
  const fallenLog = new THREE.Group();
  const logBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 6), logMat);
  logBody.rotation.z = Math.PI / 2;
  logBody.position.y = 0.28;
  logBody.castShadow = true;
  fallenLog.add(logBody);
  const logX = 4.9;
  const logZ = 3.2;
  fallenLog.position.set(logX, groundHeightAt(logX, logZ) - 0.05, logZ);
  fallenLog.rotation.y = -0.48;
  scene.add(fallenLog);
  colliders.push({ x: logX - 0.9, z: logZ - 0.4, radius: 0.65, kind: 'prop' });
  colliders.push({ x: logX + 0.9, z: logZ + 0.4, radius: 0.65, kind: 'prop' });

  const cart = createAbandonedCart(textures);
  const cartX = 5.6;
  const cartZ = -7.6;
  cart.position.set(cartX, groundHeightAt(cartX, cartZ) - 0.06, cartZ);
  cart.rotation.y = -2.15;
  scene.add(cart);
  colliders.push({ x: cartX, z: cartZ, radius: 1.35, kind: 'prop' });

  // 5. Forgotten Graveyard Markers
  const graveSpots: { x: number; z: number; rot: number; tilt: number; kind: 'slab' | 'cross' }[] = [
    { x: -8.6, z: -7.2, rot: 0.4, tilt: 0.09, kind: 'cross' },
    { x: -9.8, z: -5.8, rot: 0.25, tilt: -0.07, kind: 'slab' },
    { x: 14.5, z: -31.0, rot: -0.9, tilt: 0.12, kind: 'cross' },
    { x: 15.8, z: -29.2, rot: -0.7, tilt: -0.08, kind: 'slab' },
    { x: 13.4, z: -32.6, rot: -1.1, tilt: 0.06, kind: 'slab' },
    { x: -39.5, z: -23.0, rot: 0.8, tilt: 0.1, kind: 'cross' },
    { x: -41.2, z: -25.2, rot: 0.55, tilt: -0.09, kind: 'slab' },
  ];
  for (const gs of graveSpots) {
    const marker = createGraveMarker(textures, gs.kind);
    marker.position.set(gs.x, groundHeightAt(gs.x, gs.z) - 0.05, gs.z);
    marker.rotation.set(gs.tilt, gs.rot, gs.tilt * 0.6);
    scene.add(marker);
    colliders.push({ x: gs.x, z: gs.z, radius: 0.45, kind: 'ruin' });
  }

  // 6. Trail Lantern Posts guiding the winding forest paths
  const lanternLocations = [
    { x: 4.3, z: -10.5, rot: -2.2 },
    { x: 14.4, z: -22.5, rot: -2.7 },
    { x: 0.5, z: -38.8, rot: -1.1 },
    { x: 21.5, z: -14.2, rot: -2.6 },
    { x: 32.5, z: -38.8, rot: -2.2 },
    { x: 42.8, z: -58.8, rot: -2.0 },
    { x: -29.0, z: -52.5, rot: -0.8 },
    { x: -31.0, z: 16.0, rot: 0.5 },
  ];
  for (let i = 0; i < lanternLocations.length; i++) {
    const loc = lanternLocations[i];
    const post = createLanternPost(textures);
    const ly = groundHeightAt(loc.x, loc.z) - 0.04;
    post.group.position.set(loc.x, ly, loc.z);
    post.group.rotation.y = loc.rot;
    scene.add(post.group);
    colliders.push({ x: loc.x, z: loc.z, radius: 0.35, kind: 'prop' });
    embers.push({ ember: post.ember, phase: i * 1.9 });
    lightAnchors.push({
      x: loc.x + Math.cos(loc.rot) * 0.6,
      y: ly + 2.2,
      z: loc.z - Math.sin(loc.rot) * 0.6,
      color: '#ff9640',
      baseIntensity: 5.5,
      distance: 15,
      phase: i * 1.9,
    });
  }

  // 7. Ancient Sunken Ruin Gate + Cobblestone Causeway
  const gateX = -16.8;
  const gateZ = -47.5;
  const gateRot = 1.18;
  const archway = createRuinArchway(textures);
  archway.position.set(gateX, groundHeightAt(gateX, gateZ) - 0.1, gateZ);
  archway.rotation.y = gateRot;
  scene.add(archway);

  const cobbleMat = new THREE.MeshLambertMaterial({
    map: textures.cobbleColor,
    color: '#aeb6bc',
    flatShading: true,
  });
  applyRetroVertexSnap(cobbleMat, 200);
  for (let c = -2; c <= 4; c++) {
    const cx = gateX + Math.sin(gateRot) * (c * 2.1);
    const cz = gateZ + Math.cos(gateRot) * (c * 2.1);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.7), cobbleMat);
    slab.position.set(cx, groundHeightAt(cx, cz) - 0.03, cz);
    slab.rotation.y = gateRot + (rand() - 0.5) * 0.12;
    slab.receiveShadow = true;
    scene.add(slab);
  }

  const pierOffset = 2.35;
  const cosG = Math.cos(gateRot);
  const sinG = Math.sin(gateRot);
  colliders.push({
    x: gateX + pierOffset * cosG,
    z: gateZ - pierOffset * sinG,
    radius: 1.05,
    kind: 'ruin',
  });
  colliders.push({
    x: gateX - pierOffset * cosG,
    z: gateZ + pierOffset * sinG,
    radius: 1.05,
    kind: 'ruin',
  });

  const gateBrazierOffsets = [
    { dx: 3.1, dz: 1.8 },
    { dx: -3.1, dz: -1.4 },
  ];
  for (let i = 0; i < gateBrazierOffsets.length; i++) {
    const off = gateBrazierOffsets[i];
    const bx = gateX + off.dx;
    const bz = gateZ + off.dz;
    const by = groundHeightAt(bx, bz) - 0.03;
    const b = createIronBrazier();
    b.group.position.set(bx, by, bz);
    scene.add(b.group);
    colliders.push({ x: bx, z: bz, radius: 0.55, kind: 'prop' });
    embers.push({ ember: b.ember, phase: 3.1 + i * 1.3 });
    lightAnchors.push({
      x: bx,
      y: by + 1.25,
      z: bz,
      color: '#ff8a33',
      baseIntensity: 7.4,
      distance: 19,
      phase: 3.1 + i * 1.3,
    });
  }

  // 8. Standing Stones Overlook + Sentinel Statue
  const overlookCenter = { x: 31.0, z: -28.0 };
  const stonePositions = [
    { dx: -2.4, dz: -1.6, h: 3.1, r: 0.5 },
    { dx: 2.5, dz: -1.2, h: 2.6, r: -0.4 },
  ];
  for (const sp of stonePositions) {
    const sx = overlookCenter.x + sp.dx;
    const sz = overlookCenter.z + sp.dz;
    const stone = createStandingStone(textures, sp.h);
    stone.position.set(sx, groundHeightAt(sx, sz) - 0.08, sz);
    stone.rotation.y = sp.r;
    scene.add(stone);
    colliders.push({ x: sx, z: sz, radius: 0.65, kind: 'ruin' });
  }

  const sentinel = createSentinelStatue(textures);
  const sentX = overlookCenter.x + 0.6;
  const sentZ = overlookCenter.z - 3.3;
  sentinel.position.set(sentX, groundHeightAt(sentX, sentZ) - 0.05, sentZ);
  sentinel.rotation.y = 0.15;
  scene.add(sentinel);
  colliders.push({ x: sentX, z: sentZ, radius: 0.85, kind: 'ruin' });

  const overlookBrazier = createIronBrazier();
  const obY = groundHeightAt(overlookCenter.x, overlookCenter.z) - 0.02;
  overlookBrazier.group.position.set(overlookCenter.x, obY, overlookCenter.z);
  scene.add(overlookBrazier.group);
  colliders.push({ x: overlookCenter.x, z: overlookCenter.z, radius: 0.55, kind: 'prop' });
  embers.push({ ember: overlookBrazier.ember, phase: 5.2 });
  lightAnchors.push({
    x: overlookCenter.x,
    y: obY + 1.25,
    z: overlookCenter.z,
    color: '#ff8a33',
    baseIntensity: 6.8,
    distance: 18,
    phase: 5.2,
  });

  // 9. Blackwater Wooden Bridge at (36, -44)
  const sinB = Math.sin(BRIDGE_YAW);
  const cosB = Math.cos(BRIDGE_YAW);
  const bankSouthY = groundHeightAt(
    BRIDGE_CENTER.x - sinB * BRIDGE_HALF_LENGTH,
    BRIDGE_CENTER.z - cosB * BRIDGE_HALF_LENGTH
  );
  const bankNorthY = groundHeightAt(
    BRIDGE_CENTER.x + sinB * BRIDGE_HALF_LENGTH,
    BRIDGE_CENTER.z + cosB * BRIDGE_HALF_LENGTH
  );
  const bridge = createOldWoodenBridge(
    textures,
    BRIDGE_HALF_LENGTH,
    BRIDGE_HALF_WIDTH,
    bankSouthY,
    bankNorthY
  );
  bridge.position.set(BRIDGE_CENTER.x, 0, BRIDGE_CENTER.z);
  bridge.rotation.y = BRIDGE_YAW;
  scene.add(bridge);

  for (const side of [-1, 1] as const) {
    const railPos = localToWorldXZ(
      BRIDGE_CENTER.x,
      BRIDGE_CENTER.z,
      BRIDGE_YAW,
      side * (BRIDGE_HALF_WIDTH + 0.12),
      0
    );
    boxColliders.push({
      cx: railPos.x,
      cz: railPos.z,
      halfW: 0.16,
      halfD: BRIDGE_HALF_LENGTH - 0.15,
      rotY: BRIDGE_YAW,
      kind: 'bridge',
    });
  }

  // Helper to register all meshes, colliders, embers, light anchors and portals from landmarks
  const registerLandmark = (built: ReturnType<typeof buildAbandonedCabinLocation>) => {
    scene.add(built.group);
    boxColliders.push(...built.boxColliders);
    colliders.push(...built.circleColliders);
    embers.push(...built.embers);
    lightAnchors.push(...built.lightAnchors);
    portals.push(...built.portals);
  };

  // 10. LOCATION A — Hollowbark Homestead (Abandoned Forest Cabin at (48, -67))
  const cabinX = CABIN_CENTER.x;
  const cabinZ = CABIN_CENTER.z;
  const cabinY = groundHeightAt(cabinX, cabinZ) - 0.06;
  registerLandmark(
    buildAbandonedCabinLocation(textures, cabinX, cabinY, cabinZ, CABIN_YAW)
  );

  // 11. LOCATION B — Mossy Bastion & Aqueduct Ruins (Ancient Ruin at (-54, -72))
  const bastionX = RUINS_CENTER.x;
  const bastionZ = RUINS_CENTER.z;
  const bastionY = groundHeightAt(bastionX, bastionZ) - 0.1;
  registerLandmark(
    buildAncientRuinLocation(textures, bastionX, bastionY, bastionZ, RUINS_YAW)
  );

  // 12. LOCATION C — Sanctum of Whispering Roots (Ancient Shrine at (-46, -18))
  const ringX = SHRINE_CENTER.x;
  const ringZ = SHRINE_CENTER.z;
  const shrineY = groundHeightAt(ringX, ringZ) - 0.08;
  registerLandmark(
    buildAncientShrineLocation(textures, ringX, shrineY, ringZ, SHRINE_YAW)
  );

  // Outer circle of ancient standing stones framing the shrine clearing
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    // Leave front staircase opening clear
    if (Math.sin(a - SHRINE_YAW) > 0.72) continue;
    const dist = 8.4 + (i % 2) * 0.75;
    const sx = ringX + Math.cos(a) * dist;
    const sz = ringZ + Math.sin(a) * dist;
    const stone = createStandingStone(textures, 2.2 + (i % 3) * 0.45);
    stone.position.set(sx, groundHeightAt(sx, sz) - 0.08, sz);
    stone.rotation.set(((i % 2) - 0.5) * 0.14, -a + Math.PI * 0.5, ((i % 3) - 1) * 0.08);
    scene.add(stone);
    colliders.push({ x: sx, z: sz, radius: 0.65, kind: 'ruin' });
  }

  // 12B. LOCATION D — Greywatch Tower (Ruined Medieval Watchtower on the Northern Crest at (-4, -64))
  const towerX = TOWER_CENTER.x;
  const towerZ = TOWER_CENTER.z;
  const towerY = groundHeightAt(towerX, towerZ) - 0.12;
  registerLandmark(
    buildMedievalTowerLocation(textures, towerX, towerY, towerZ, TOWER_YAW)
  );

  // Subtle overgrown mossy stepping stones climbing off-trail from near (-9.5, -49) toward Greywatch Tower
  const stepStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#7d8d81',
    flatShading: true,
  });
  applyRetroVertexSnap(stepStoneMat, 200);
  const trailMarkerCoords: [number, number][] = [
    [-9.2, -49.5],
    [-8.1, -51.2],
    [-6.9, -52.9],
    [-6.0, -54.5],
  ];
  for (let i = 0; i < trailMarkerCoords.length; i++) {
    const [tx, tz] = trailMarkerCoords[i];
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.85), stepStoneMat);
    flag.position.set(tx, groundHeightAt(tx, tz) - 0.01, tz);
    flag.rotation.y = 0.42 + (i % 2) * 0.18;
    flag.receiveShadow = true;
    scene.add(flag);
  }
  const towerWaymarker = createStandingStone(textures, 1.55);
  towerWaymarker.position.set(-10.4, groundHeightAt(-10.4, -49.8) - 0.08, -49.8);
  towerWaymarker.rotation.set(0.12, 0.35, -0.08);
  scene.add(towerWaymarker);
  colliders.push({ x: -10.4, z: -49.8, radius: 0.55, kind: 'ruin' });

  // 12C. LOCATION E — Elderwood Cottage (Tree-Woven Woodland House at (27, 25))
  const cottageX = COTTAGE_CENTER.x;
  const cottageZ = COTTAGE_CENTER.z;
  const cottageY = groundHeightAt(cottageX, cottageZ) - 0.05;
  registerLandmark(
    buildWoodlandCottageLocation(textures, cottageX, cottageY, cottageZ, COTTAGE_YAW)
  );

  // Subtle lantern & stepping slabs guiding off the South-East ridge trail toward Elderwood Cottage
  const cottageStepCoords: [number, number][] = [
    [28.5, 20.6],
    [28.0, 21.8],
    [27.6, 22.9],
  ];
  for (const [cx, cz] of cottageStepCoords) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.8), stepStoneMat);
    slab.position.set(cx, groundHeightAt(cx, cz) - 0.01, cz);
    slab.rotation.y = COTTAGE_YAW;
    slab.receiveShadow = true;
    scene.add(slab);
  }

  // 12D. LOCATION F — Three Subterranean Caves (Cragstone, Weeping Hollow, Sunken Barrow)
  const cragCaveX = CAVE_CRAG_CENTER.x;
  const cragCaveZ = CAVE_CRAG_CENTER.z;
  registerLandmark(
    buildCaveEntranceLocation(
      textures,
      'crag',
      cragCaveX,
      groundHeightAt(cragCaveX, cragCaveZ) - 0.08,
      cragCaveZ,
      CAVE_CRAG_YAW
    )
  );

  const weepCaveX = CAVE_WEEPING_CENTER.x;
  const weepCaveZ = CAVE_WEEPING_CENTER.z;
  registerLandmark(
    buildCaveEntranceLocation(
      textures,
      'weeping',
      weepCaveX,
      groundHeightAt(weepCaveX, weepCaveZ) - 0.08,
      weepCaveZ,
      CAVE_WEEPING_YAW
    )
  );

  const ancCaveX = CAVE_ANCIENT_CENTER.x;
  const ancCaveZ = CAVE_ANCIENT_CENTER.z;
  registerLandmark(
    buildCaveEntranceLocation(
      textures,
      'ancient',
      ancCaveX,
      groundHeightAt(ancCaveX, ancCaveZ) - 0.08,
      ancCaveZ,
      CAVE_ANCIENT_YAW
    )
  );

  // Mossy marker stone pointing off-trail toward Sunken Barrow Cavern
  const barrowMarker = createStandingStone(textures, 1.4);
  barrowMarker.position.set(-4.2, groundHeightAt(-4.2, 26.0) - 0.06, 26.0);
  barrowMarker.rotation.set(0.08, 0.4, -0.06);
  scene.add(barrowMarker);
  colliders.push({ x: -4.2, z: 26.0, radius: 0.52, kind: 'ruin' });

  // 12E. LOCATION G — Sunken Citadel Gate (Dungeon Entrance overlooking Silvermire at (64, -36))
  const citGateX = CITADEL_GATE_CENTER.x;
  const citGateZ = CITADEL_GATE_CENTER.z;
  registerLandmark(
    buildDungeonCliffGateLocation(
      textures,
      citGateX,
      groundHeightAt(citGateX, citGateZ) - 0.08,
      citGateZ,
      CITADEL_GATE_YAW
    )
  );

  // 13. Natural Rock Formations across Cragstone Tor + forest ridges & slopes
  const cragSpecs: { x: number; z: number; v: 0 | 1 | 2; s: number; r: number; colR: number }[] = [
    { x: 46.5, z: 10.5, v: 0, s: 1.18, r: 0.4, colR: 2.0 },
    { x: 40.5, z: 18.2, v: 1, s: 1.05, r: -0.7, colR: 1.85 },
    { x: 49.0, z: 17.5, v: 2, s: 1.2, r: 1.2, colR: 2.1 },
    { x: 55.5, z: 8.5, v: 0, s: 0.95, r: 2.3, colR: 1.7 },
    { x: -34.0, z: -50.0, v: 1, s: 1.1, r: 0.8, colR: 1.9 },
    { x: 24.0, z: -55.0, v: 2, s: 1.05, r: -1.3, colR: 1.85 },
    { x: 60.0, z: -61.0, v: 0, s: 1.08, r: 0.2, colR: 1.9 },
    // Additional organic outcrops distributed on ridges and hollows
    { x: -24.0, z: -12.0, v: 2, s: 1.05, r: 0.5, colR: 1.85 },
    { x: -27.5, z: -8.0, v: 1, s: 0.92, r: -0.9, colR: 1.65 },
    { x: 17.5, z: -38.5, v: 0, s: 1.0, r: 1.5, colR: 1.75 },
    { x: -8.5, z: 24.5, v: 2, s: 1.12, r: -0.3, colR: 1.9 },
    { x: -58.0, z: 12.0, v: 0, s: 1.15, r: 2.1, colR: 1.95 },
    { x: 22.0, z: 36.0, v: 1, s: 1.08, r: 0.6, colR: 1.85 },
    { x: -10.5, z: -66.0, v: 2, s: 1.18, r: 1.1, colR: 2.0 },
    { x: 66.5, z: -43.0, v: 1, s: 1.02, r: -1.6, colR: 1.8 },
    { x: -64.0, z: -38.0, v: 0, s: 1.1, r: 0.85, colR: 1.9 },
    { x: 4.5, z: 34.0, v: 2, s: 0.96, r: -2.1, colR: 1.7 },
  ];
  for (const cs of cragSpecs) {
    const crag = createRockFormation(textures, cs.v, cs.s);
    crag.position.set(cs.x, groundHeightAt(cs.x, cs.z) - 0.16, cs.z);
    crag.rotation.y = cs.r;
    scene.add(crag);
    colliders.push({ x: cs.x, z: cs.z, radius: cs.colR, kind: 'rock' });
  }

  // 14. Hero Tall Slender Pines framing the starting clearing tighter (leaving spawn camera sightline clear)
  const heroPineSpots = [
    { x: -8.6, z: 3.6, s: 1.12 },
    { x: -7.5, z: -9.0, s: 1.05 },
    { x: 8.1, z: 4.0, s: 1.08 },
    { x: 8.8, z: -3.8, s: 0.96 },
    { x: -6.2, z: 8.8, s: 1.12 },
    { x: 6.4, z: 9.2, s: 1.04 },
    { x: -10.0, z: -2.0, s: 0.94 },
    { x: 7.4, z: -10.4, s: 1.1 },
  ];
  const treeGrid = new SpatialGrid2D(4.0);
  for (const spot of heroPineSpots) {
    const tree = createHeroPineTree(textures, spot.s);
    tree.position.set(spot.x, groundHeightAt(spot.x, spot.z) - 0.08, spot.z);
    tree.rotation.y = rand() * Math.PI * 2;
    scene.add(tree);
    colliders.push({ x: spot.x, z: spot.z, radius: 0.52 * spot.s, kind: 'tree' });
    treeGrid.insert(spot.x, spot.z);
  }

  // Small natural forest glades tucked in deeper woods so clearings alternate with thickets
  const smallGlades = [
    { x: 22.5, z: 6.0, r: 4.2 },
    { x: -27.0, z: -22.5, r: 4.0 },
    { x: 15.0, z: -53.0, r: 4.1 },
    { x: -20.0, z: 27.0, r: 4.3 },
  ];

  // Keep a misty sightline corridor open from Winding Pine Hollow toward Greywatch Tower
  // Keep misty sightline corridors open toward Greywatch Tower (from North Trail Bend & Pine Hollow)
  const distToSeg = (x: number, z: number, ax: number, az: number, bx: number, bz: number): number => {
    const abx = bx - ax;
    const abz = bz - az;
    const lenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(((x - ax) * abx + (z - az) * abz) / lenSq, 0, 1);
    if (t < 0.08 || t > 0.92) return Infinity;
    return Math.hypot(x - (ax + abx * t), z - (az + abz * t));
  };

  const isInTowerSightline = (x: number, z: number): boolean => {
    return (
      distToSeg(x, z, -4.5, -40.5, towerX, towerZ) < 4.2 ||
      distToSeg(x, z, 8.0, -22.0, towerX, towerZ) < 3.8
    );
  };

  const isClearOfFeatures = (
    x: number,
    z: number,
    minPath: number,
    minWater = 2.6,
    allowClearingEdge = false
  ): boolean => {
    const originMin = allowClearingEdge ? 7.6 : 8.5;
    if (Math.hypot(x, z) < originMin) return false;
    if (Math.hypot(x - 0, z - 5.2) < 3.4) return false; // Player spawn & camera clearance
    if (z > 6.2 && z < 11.8 && Math.abs(x) < 3.4) return false; // Initial behind-camera cone
    if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 6.4) return false;
    if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 8.1) return false;
    if (streamDistanceAt(x, z) < minWater) return false;
    if (pathDistanceAt(x, z) < minPath) return false;
    if (Math.hypot(x - gateX, z - gateZ) < 6.0) return false;
    if (Math.hypot(x - overlookCenter.x, z - overlookCenter.z) < 5.0) return false;
    if (Math.hypot(x - cabinX, z - cabinZ) < 9.2) return false;
    if (Math.hypot(x - cottageX, z - cottageZ) < 6.8) return false;
    if (Math.hypot(x - bastionX, z - bastionZ) < 10.2) return false;
    if (Math.hypot(x - ringX, z - ringZ) < 10.6) return false;
    if (Math.hypot(x + 41.2, z + 10.2) < 4.8) return false; // Shrine front staircase & glade approach
    if (Math.hypot(x - towerX, z - towerZ) < 9.4) return false;
    if (Math.hypot(x + 6.0, z + 55.2) < 4.2) return false; // Tower mossy stairs approach
    if (Math.hypot(x - cragCaveX, z - cragCaveZ) < 7.0) return false;
    if (Math.hypot(x - weepCaveX, z - weepCaveZ) < 7.0) return false;
    if (Math.hypot(x - ancCaveX, z - ancCaveZ) < 7.0) return false;
    if (Math.hypot(x - citGateX, z - citGateZ) < 7.8) return false;
    if (Math.hypot(x - BRIDGE_CENTER.x, z - BRIDGE_CENTER.z) < 5.4) return false;
    if (Math.hypot(x - 45.5, z - 14.5) < 5.0) return false;
    for (let i = 0; i < smallGlades.length; i++) {
      const g = smallGlades[i];
      if (Math.hypot(x - g.x, z - g.z) < g.r) return false;
    }
    return true;
  };

  // Shared Retro Materials for Instanced Forest Flora & Geology
  const barkMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#ab9989',
    flatShading: true,
  });
  const deadBarkMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#8f867d',
    flatShading: true,
  });
  const pineNeedleMat = new THREE.MeshLambertMaterial({
    map: textures.foliageColor,
    color: '#ffffff',
    flatShading: true,
  });
  const broadleafMat = new THREE.MeshLambertMaterial({
    map: textures.broadleafColor,
    color: '#ffffff',
    flatShading: true,
  });
  const mossMat = new THREE.MeshLambertMaterial({
    map: textures.foliageColor,
    color: '#8da383',
    flatShading: true,
  });
  const rockMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#ffffff',
    flatShading: true,
  });
  applyRetroVertexSnap(barkMat, 200);
  applyRetroVertexSnap(deadBarkMat, 200);
  applyRetroVertexSnap(pineNeedleMat, 200);
  applyRetroVertexSnap(broadleafMat, 200);
  applyRetroVertexSnap(mossMat, 200);
  applyRetroVertexSnap(rockMat, 200);

  // Build All 7 Diverse Tree Species Geometries
  const tall0Geo = buildTallConiferGeometries(0);
  const tall1Geo = buildTallConiferGeometries(1);
  const ancient0Geo = buildAncientPineGeometries(0);
  const ancient1Geo = buildAncientPineGeometries(1);
  const broad0Geo = buildBroadleafGeometries(0);
  const broad1Geo = buildBroadleafGeometries(1);
  const twist0Geo = buildTwistedTreeGeometries(0);
  const twist1Geo = buildTwistedTreeGeometries(1);
  const rootedGeo = buildRootedTreeGeometries();
  const dead0Geo = buildDeadTreeGeometries(0);
  const dead1Geo = buildDeadTreeGeometries(1);
  const sapling0Geo = buildSaplingGeometries(0);
  const sapling1Geo = buildSaplingGeometries(1);

  // 15. Dense Multi-Species Canopy Tree Generation (~1,225 primary/twisted/dead trees + ~520 saplings)
  const speciesBuckets: Record<PlacedTreeRecord['species'], PlacedTreeRecord[]> = {
    tall0: [],
    tall1: [],
    ancient0: [],
    ancient1: [],
    broad0: [],
    broad1: [],
    twist0: [],
    twist1: [],
    rooted: [],
    dead0: [],
    dead1: [],
  };
  const allTrees: PlacedTreeRecord[] = [];

  const targetCounts: Record<PlacedTreeRecord['species'], number> = {
    tall0: 185,
    tall1: 245,
    ancient0: 85,
    ancient1: 80,
    broad0: 130,
    broad1: 145,
    twist0: 70,
    twist1: 65,
    rooted: 95,
    dead0: 65,
    dead1: 60,
  };

  const speciesOrder: PlacedTreeRecord['species'][] = [
    'ancient0',
    'ancient1',
    'broad0',
    'broad1',
    'tall1',
    'tall0',
    'rooted',
    'twist0',
    'twist1',
    'dead0',
    'dead1',
  ];

  // Dense clusters first (grove cores) then general woodland fill
  for (const species of speciesOrder) {
    const target = targetCounts[species];
    let tries = 0;
    const isAncient = species === 'ancient0' || species === 'ancient1';
    const isBroad = species === 'broad0' || species === 'broad1';
    const isTwist = species === 'twist0' || species === 'twist1';
    const isRooted = species === 'rooted';
    const isDead = species === 'dead0' || species === 'dead1';

    const minPath = isTwist ? 2.1 : isBroad ? 2.25 : isDead ? 2.15 : 2.4;
    const minWater = isTwist || isRooted ? 1.85 : 2.55;

    while (speciesBuckets[species].length < target && tries < target * 30) {
      tries++;
      const angle = rand() * Math.PI * 2;
      const radius = 8.0 + Math.pow(rand(), 0.78) * 84.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfFeatures(x, z, minPath, minWater, true)) continue;
      if (isInTowerSightline(x, z)) continue;

      const grove = groveDensityAt(x, z);
      const slope = groundSlopeAt(x, z);
      const nearWater = streamDistanceAt(x, z) < 5.5 || Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 9.5;

      // Ecological placement bias: ancient pines in deeper groves, broadleafs near edges/hollows,
      // rooted & twisted trees near slopes/streams/bog
      if (isAncient && rand() > 0.34 + grove * 0.66) continue;
      if ((isRooted || isTwist) && !nearWater && slope < 0.2 && rand() > 0.48 + grove * 0.35) continue;
      if (!isDead && rand() > 0.48 + grove * 0.62) continue;

      const spacing = isAncient
        ? 2.65 - grove * 0.85
        : isBroad
          ? 2.25 - grove * 0.7
          : isDead
            ? 1.75
            : 1.95 - grove * 0.68;

      if (treeGrid.hasNeighborWithin(x, z, spacing)) continue;

      const sx = isAncient
        ? 0.88 + rand() * 0.42
        : isBroad
          ? 0.84 + rand() * 0.46
          : isTwist
            ? 0.82 + rand() * 0.45
            : 0.78 + rand() * 0.48;
      const sy = isAncient
        ? 0.85 + rand() * 0.42
        : isBroad
          ? 0.82 + rand() * 0.4
          : 0.76 + rand() * 0.58;

      const y = groundHeightAt(x, z) - 0.12;
      const rec: PlacedTreeRecord = {
        x,
        y,
        z,
        sx,
        sy,
        rot: rand() * Math.PI * 2,
        species,
      };
      speciesBuckets[species].push(rec);
      allTrees.push(rec);
      treeGrid.insert(x, z);
    }
  }

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  const pinePalette = ['#687d69', '#778d76', '#5c7061', '#859882'];
  const broadleafPalette = ['#6d825d', '#7c8f68', '#5e7355', '#87926b', '#55684e'];
  const twistPalette = ['#5e705b', '#6d7a5e', '#4f6052'];

  function instantiateSplitTree(
    records: PlacedTreeRecord[],
    geo: { woodGeo: THREE.BufferGeometry; foliageGeo: THREE.BufferGeometry },
    fMat: THREE.MeshLambertMaterial,
    palette: string[],
    colliderScale: number,
    castFoliageShadow: boolean
  ) {
    if (records.length === 0) return;
    const woodInst = new THREE.InstancedMesh(geo.woodGeo, barkMat, records.length);
    const foliageInst = new THREE.InstancedMesh(geo.foliageGeo, fMat, records.length);
    woodInst.castShadow = true;
    woodInst.receiveShadow = true;
    foliageInst.castShadow = castFoliageShadow;
    foliageInst.receiveShadow = true;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      dummy.position.set(r.x, r.y, r.z);
      const tiltAmp = r.species.startsWith('twist') ? 0.14 : 0.08;
      dummy.rotation.set((rand() - 0.5) * tiltAmp, r.rot, (rand() - 0.5) * tiltAmp);
      dummy.scale.set(r.sx, r.sy, r.sx);
      dummy.updateMatrix();

      woodInst.setMatrixAt(i, dummy.matrix);
      foliageInst.setMatrixAt(i, dummy.matrix);

      cTmp.set(palette[Math.floor(rand() * palette.length)]);
      cTmp.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.05);
      foliageInst.setColorAt(i, cTmp);

      cTmp.set('#ffffff').offsetHSL(0, 0, (rand() - 0.5) * 0.14);
      woodInst.setColorAt(i, cTmp);

      if (Math.hypot(r.x, r.z) < PLAYABLE_CHECK_RADIUS) {
        colliders.push({ x: r.x, z: r.z, radius: colliderScale * r.sx, kind: 'tree' });
      }
    }

    woodInst.instanceMatrix.needsUpdate = true;
    if (woodInst.instanceColor) woodInst.instanceColor.needsUpdate = true;
    woodInst.computeBoundingSphere();

    foliageInst.instanceMatrix.needsUpdate = true;
    if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
    foliageInst.computeBoundingSphere();

    scene.add(woodInst, foliageInst);
  }

  instantiateSplitTree(speciesBuckets.tall0, tall0Geo, pineNeedleMat, pinePalette, 0.36, true);
  instantiateSplitTree(speciesBuckets.tall1, tall1Geo, pineNeedleMat, pinePalette, 0.36, true);
  instantiateSplitTree(speciesBuckets.ancient0, ancient0Geo, pineNeedleMat, pinePalette, 0.62, true);
  instantiateSplitTree(speciesBuckets.ancient1, ancient1Geo, pineNeedleMat, pinePalette, 0.62, true);
  instantiateSplitTree(speciesBuckets.broad0, broad0Geo, broadleafMat, broadleafPalette, 0.46, true);
  instantiateSplitTree(speciesBuckets.broad1, broad1Geo, broadleafMat, broadleafPalette, 0.42, true);
  instantiateSplitTree(speciesBuckets.twist0, twist0Geo, broadleafMat, twistPalette, 0.38, false);
  instantiateSplitTree(speciesBuckets.twist1, twist1Geo, broadleafMat, twistPalette, 0.38, false);
  instantiateSplitTree(speciesBuckets.rooted, rootedGeo, broadleafMat, broadleafPalette, 0.72, false);

  function instantiateDeadTree(records: PlacedTreeRecord[], geo: THREE.BufferGeometry) {
    if (records.length === 0) return;
    const inst = new THREE.InstancedMesh(geo, deadBarkMat, records.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set((rand() - 0.5) * 0.14, r.rot, (rand() - 0.5) * 0.14);
      dummy.scale.set(r.sx, r.sy, r.sx);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      cTmp.set('#b2aba2').lerp(new THREE.Color('#808d7c'), rand() * 0.3);
      inst.setColorAt(i, cTmp);
      if (Math.hypot(r.x, r.z) < PLAYABLE_CHECK_RADIUS) {
        colliders.push({ x: r.x, z: r.z, radius: 0.44 * r.sx, kind: 'tree' });
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
  }

  instantiateDeadTree(speciesBuckets.dead0, dead0Geo);
  instantiateDeadTree(speciesBuckets.dead1, dead1Geo);

  // 16. Mid-Story Saplings & Young Trees (~270 clustered around parent trees & path borders)
  function populateSaplings(
    targetCount: number,
    geo: { woodGeo: THREE.BufferGeometry; foliageGeo: THREE.BufferGeometry },
    fMat: THREE.MeshLambertMaterial,
    palette: string[]
  ) {
    const wInst = new THREE.InstancedMesh(geo.woodGeo, barkMat, targetCount);
    const fInst = new THREE.InstancedMesh(geo.foliageGeo, fMat, targetCount);
    fInst.receiveShadow = true;
    let placed = 0;
    let tries = 0;
    while (placed < targetCount && tries < targetCount * 10) {
      tries++;
      // Cluster 65% near existing trees, 35% along clearing & trail edges
      let x = 0;
      let z = 0;
      if (allTrees.length > 0 && rand() < 0.68) {
        const host = allTrees[Math.floor(rand() * allTrees.length)];
        const a = rand() * Math.PI * 2;
        const d = 1.45 + rand() * 2.8;
        x = host.x + Math.cos(a) * d;
        z = host.z + Math.sin(a) * d;
      } else {
        const a = rand() * Math.PI * 2;
        const rad = 6.2 + Math.pow(rand(), 0.78) * 83;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
      }

      if (!isClearOfFeatures(x, z, 2.0, 2.0, true)) continue;
      if (treeGrid.hasNeighborWithin(x, z, 1.05)) continue;

      const sx = 0.75 + rand() * 0.65;
      const sy = 0.72 + rand() * 0.7;
      dummy.position.set(x, groundHeightAt(x, z) - 0.06, z);
      dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      wInst.setMatrixAt(placed, dummy.matrix);
      fInst.setMatrixAt(placed, dummy.matrix);
      cTmp.set(palette[Math.floor(rand() * palette.length)]);
      fInst.setColorAt(placed, cTmp);
      treeGrid.insert(x, z);
      placed++;
    }
    wInst.count = placed;
    fInst.count = placed;
    wInst.instanceMatrix.needsUpdate = true;
    fInst.instanceMatrix.needsUpdate = true;
    if (fInst.instanceColor) fInst.instanceColor.needsUpdate = true;
    wInst.computeBoundingSphere();
    fInst.computeBoundingSphere();
    scene.add(wInst, fInst);
    scalableMeshes.push({ inst: wInst, maxCount: placed });
    scalableMeshes.push({ inst: fInst, maxCount: placed });
  }

  populateSaplings(270, sapling0Geo, pineNeedleMat, pinePalette);
  populateSaplings(250, sapling1Geo, broadleafMat, broadleafPalette);

  // 17. Dense Multi-Lobe Forest Bushes & Impassable Thickets (530 bushes across 2 variants)
  const bush0Geo = buildBushGeometry(0);
  const bush1Geo = buildBushGeometry(1);
  const bushGrid = new SpatialGrid2D(2.5);

  function populateBushes(targetCount: number, geo: THREE.BufferGeometry, makeThicketColliders: boolean) {
    const inst = new THREE.InstancedMesh(geo, broadleafMat, targetCount);
    inst.receiveShadow = true;
    let placed = 0;
    let tries = 0;
    while (placed < targetCount && tries < targetCount * 10) {
      tries++;
      let x = 0;
      let z = 0;
      if (allTrees.length > 0 && rand() < 0.62) {
        const host = allTrees[Math.floor(rand() * allTrees.length)];
        const a = rand() * Math.PI * 2;
        const d = 1.0 + rand() * 2.3;
        x = host.x + Math.cos(a) * d;
        z = host.z + Math.sin(a) * d;
      } else {
        const a = rand() * Math.PI * 2;
        const rad = 6.0 + rand() * 83;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
      }

      if (!isClearOfFeatures(x, z, 1.95, 1.85, true)) continue;
      if (bushGrid.hasNeighborWithin(x, z, 1.05)) continue;

      const s = 0.85 + rand() * 1.1;
      dummy.position.set(x, groundHeightAt(x, z) - 0.05, z);
      dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
      dummy.scale.set(s * (0.95 + rand() * 0.35), s * (0.9 + rand() * 0.4), s * (0.95 + rand() * 0.35));
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      cTmp.set('#6d8167').lerp(new THREE.Color('#8a9877'), rand());
      inst.setColorAt(placed, cTmp);

      // Thick dense bushes in deep groves act as real walk-blocking undergrowth
      if (makeThicketColliders && s > 1.2 && pathDistanceAt(x, z) > 2.5) {
        colliders.push({ x, z, radius: 0.62 * s, kind: 'prop' });
      }
      bushGrid.insert(x, z);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
  }

  populateBushes(290, bush0Geo, true);
  populateBushes(240, bush1Geo, false);

  // 18. Geological Variety: Irregular Boulders, Embedded Mossy Slabs, Crag Stones & Scattered Scree
  const rock0Geo = buildRockVariantGeometry(0);
  const rock1Geo = buildRockVariantGeometry(1);
  const rock2Geo = buildRockVariantGeometry(2);
  const placedBoulders: PlacedBoulderRecord[] = [];

  function populateRocks(
    targetCount: number,
    geo: THREE.BufferGeometry,
    minScale: number,
    maxScale: number,
    minPath: number,
    withColliders: boolean,
    mossBias: number,
    scalable = false
  ) {
    const inst = new THREE.InstancedMesh(geo, rockMat, targetCount);
    inst.receiveShadow = true;
    inst.castShadow = withColliders;
    let placed = 0;
    let tries = 0;
    while (placed < targetCount && tries < targetCount * 12) {
      tries++;
      let x = 0;
      let z = 0;
      // Cluster some rocks into natural talus/rockfalls near slopes and stream banks
      if (placedBoulders.length > 4 && rand() < 0.38) {
        const anchor = placedBoulders[Math.floor(rand() * placedBoulders.length)];
        const a = rand() * Math.PI * 2;
        const d = 1.0 + rand() * 2.2;
        x = anchor.x + Math.cos(a) * d;
        z = anchor.z + Math.sin(a) * d;
      } else {
        const a = rand() * Math.PI * 2;
        const rad = 5.5 + rand() * 83;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
      }

      if (pathDistanceAt(x, z) < minPath) continue;
      if (Math.hypot(x, z) < 5.8 || Math.hypot(x, z - 5.2) < 3.0) continue;
      if (Math.hypot(x - BRIDGE_CENTER.x, z - BRIDGE_CENTER.z) < 4.8) continue;
      if (Math.hypot(x - cabinX, z - cabinZ) < 8.6) continue;
      if (Math.hypot(x - cottageX, z - cottageZ) < 6.4) continue;
      if (Math.hypot(x - bastionX, z - bastionZ) < 9.4) continue;
      if (Math.hypot(x - ringX, z - ringZ) < 9.6) continue;
      if (Math.hypot(x - towerX, z - towerZ) < 8.6) continue;
      if (Math.hypot(x - cragCaveX, z - cragCaveZ) < 6.4) continue;
      if (Math.hypot(x - weepCaveX, z - weepCaveZ) < 6.4) continue;
      if (Math.hypot(x - ancCaveX, z - ancCaveZ) < 6.4) continue;
      if (Math.hypot(x - citGateX, z - citGateZ) < 7.2) continue;
      if (Math.hypot(x + 6.0, z + 55.2) < 3.5) continue;

      const s = minScale + rand() * (maxScale - minScale);
      const sx = s * (0.82 + rand() * 0.55);
      const sy = s * (0.55 + rand() * 0.62);
      const sz = s * (0.82 + rand() * 0.52);
      const y = groundHeightAt(x, z) + sy * 0.22;

      dummy.position.set(x, y, z);
      dummy.rotation.set((rand() - 0.5) * 0.8, rand() * Math.PI * 2, (rand() - 0.5) * 0.8);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      cTmp.set('#969fa6').lerp(new THREE.Color('#748a78'), rand() * mossBias);
      inst.setColorAt(placed, cTmp);

      const avgRadius = Math.max(sx, sz) * 0.64;
      if (withColliders && avgRadius > 0.52) {
        colliders.push({ x, z, radius: avgRadius, kind: 'rock' });
        placedBoulders.push({ x, y, z, sx, sy, sz });
      }
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
    if (scalable) scalableMeshes.push({ inst, maxCount: placed });
  }

  populateRocks(115, rock0Geo, 0.72, 1.55, 2.35, true, 0.55);
  populateRocks(145, rock1Geo, 0.65, 1.45, 2.1, true, 0.78);
  populateRocks(75, rock2Geo, 0.82, 1.48, 2.45, true, 0.65);
  populateRocks(340, rock0Geo, 0.18, 0.42, 1.35, false, 0.5, true);

  // 19. Decaying Mossy Logs (with branch stubs & moss caps), Stumps, Soil Roots, Fallen Branches & Moss Mounds
  const decayLogGeo = buildDecayingLogGeometries();
  const decayLogCount = 64;
  const decayWoodInst = new THREE.InstancedMesh(decayLogGeo.woodGeo, barkMat, decayLogCount);
  const decayMossInst = new THREE.InstancedMesh(decayLogGeo.mossGeo, mossMat, decayLogCount);
  decayWoodInst.castShadow = true;
  decayWoodInst.receiveShadow = true;
  decayMossInst.receiveShadow = true;

  let dlPlaced = 0;
  let dlTries = 0;
  while (dlPlaced < decayLogCount && dlTries < 850) {
    dlTries++;
    const a = rand() * Math.PI * 2;
    const rad = 11 + rand() * 76;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (!isClearOfFeatures(x, z, 3.3, 2.7)) continue;

    const yaw = rand() * Math.PI * 2;
    const s = 0.8 + rand() * 0.48;
    dummy.position.set(x, groundHeightAt(x, z) - 0.04, z);
    dummy.rotation.set(0, yaw, (rand() - 0.5) * 0.08);
    dummy.scale.set(s, s * (0.9 + rand() * 0.2), s);
    dummy.updateMatrix();
    decayWoodInst.setMatrixAt(dlPlaced, dummy.matrix);
    decayMossInst.setMatrixAt(dlPlaced, dummy.matrix);

    colliders.push({
      x: x + Math.cos(yaw) * 0.85 * s,
      z: z - Math.sin(yaw) * 0.85 * s,
      radius: 0.54 * s,
      kind: 'prop',
    });
    colliders.push({
      x: x - Math.cos(yaw) * 0.85 * s,
      z: z + Math.sin(yaw) * 0.85 * s,
      radius: 0.54 * s,
      kind: 'prop',
    });
    dlPlaced++;
  }
  decayWoodInst.count = dlPlaced;
  decayMossInst.count = dlPlaced;
  decayWoodInst.instanceMatrix.needsUpdate = true;
  decayMossInst.instanceMatrix.needsUpdate = true;
  decayWoodInst.computeBoundingSphere();
  decayMossInst.computeBoundingSphere();
  scene.add(decayWoodInst, decayMossInst);

  // Mossy Stumps (68 scattered in groves & glade borders)
  const stumpGeo = new THREE.CylinderGeometry(0.24, 0.44, 0.72, 6);
  stumpGeo.translate(0, 0.32, 0);
  const stumpInst = new THREE.InstancedMesh(stumpGeo, barkMat, 68);
  let sPlaced = 0;
  let sTries = 0;
  while (sPlaced < 68 && sTries < 750) {
    sTries++;
    const a = rand() * Math.PI * 2;
    const rad = 6.5 + rand() * 82;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (pathDistanceAt(x, z) < 2.25 || streamDistanceAt(x, z) < 2.3) continue;
    if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 5.2) continue;

    const sc = 0.72 + rand() * 0.8;
    dummy.position.set(x, groundHeightAt(x, z) - 0.06, z);
    dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
    dummy.scale.set(sc, 0.68 + rand() * 0.85, sc);
    dummy.updateMatrix();
    stumpInst.setMatrixAt(sPlaced, dummy.matrix);
    colliders.push({ x, z, radius: 0.44 * sc, kind: 'prop' });
    sPlaced++;
  }
  stumpInst.count = sPlaced;
  stumpInst.instanceMatrix.needsUpdate = true;
  stumpInst.computeBoundingSphere();
  scene.add(stumpInst);

  // Emerging Gnarled Soil Roots anchored around real trees & slopes (210 instances)
  const root0Geo = buildSoilRootGeometry(0);
  const root1Geo = buildSoilRootGeometry(1);
  function populateSoilRoots(targetCount: number, geo: THREE.BufferGeometry) {
    const inst = new THREE.InstancedMesh(geo, barkMat, targetCount);
    inst.receiveShadow = true;
    let placed = 0;
    let tries = 0;
    while (placed < targetCount && tries < targetCount * 6 && allTrees.length > 0) {
      tries++;
      const host = allTrees[Math.floor(rand() * allTrees.length)];
      const a = rand() * Math.PI * 2;
      const dist = 1.0 + rand() * 2.2;
      const x = host.x + Math.cos(a) * dist;
      const z = host.z + Math.sin(a) * dist;
      if (pathDistanceAt(x, z) < 1.9 || streamDistanceAt(x, z) < 1.8) continue;

      const s = 0.75 + rand() * 0.65;
      dummy.position.set(x, groundHeightAt(x, z) - 0.04, z);
      dummy.rotation.set((rand() - 0.5) * 0.16, a + (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.16);
      dummy.scale.set(s, s * (0.8 + rand() * 0.45), s);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
    scalableMeshes.push({ inst, maxCount: placed });
  }
  populateSoilRoots(175, root0Geo);
  populateSoilRoots(165, root1Geo);

  // Fallen Forest Branches (260 scattered twigs/limbs)
  const branchGeo = buildFallenBranchGeometry();
  const branchInst = new THREE.InstancedMesh(branchGeo, deadBarkMat, 260);
  let brPlaced = 0;
  let brTries = 0;
  while (brPlaced < 260 && brTries < 1200) {
    brTries++;
    const a = rand() * Math.PI * 2;
    const rad = 5.5 + rand() * 82;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (pathDistanceAt(x, z) < 1.55 || streamDistanceAt(x, z) < 1.7) continue;
    const s = 0.78 + rand() * 0.75;
    dummy.position.set(x, groundHeightAt(x, z) + 0.02, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, (rand() - 0.5) * 0.15);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    branchInst.setMatrixAt(brPlaced, dummy.matrix);
    brPlaced++;
  }
  branchInst.count = brPlaced;
  branchInst.instanceMatrix.needsUpdate = true;
  branchInst.computeBoundingSphere();
  scene.add(branchInst);
  scalableMeshes.push({ inst: branchInst, maxCount: brPlaced });

  // Low-Poly Moss Mounds / Floor Cushions nestled at tree bases & boulders (380 instances)
  const mossMoundGeo = buildMossMoundGeometry();
  const mossMoundInst = new THREE.InstancedMesh(mossMoundGeo, mossMat, 380);
  mossMoundInst.receiveShadow = true;
  let mmPlaced = 0;
  let mmTries = 0;
  while (mmPlaced < 380 && mmTries < 1600) {
    mmTries++;
    let x = 0;
    let z = 0;
    if (allTrees.length > 0 && rand() < 0.65) {
      const host = allTrees[Math.floor(rand() * allTrees.length)];
      const a = rand() * Math.PI * 2;
      const d = 0.7 + rand() * 1.6;
      x = host.x + Math.cos(a) * d;
      z = host.z + Math.sin(a) * d;
    } else if (placedBoulders.length > 0 && rand() < 0.7) {
      const b = placedBoulders[Math.floor(rand() * placedBoulders.length)];
      const a = rand() * Math.PI * 2;
      x = b.x + Math.cos(a) * 0.9;
      z = b.z + Math.sin(a) * 0.9;
    } else {
      const a = rand() * Math.PI * 2;
      const r = 6.0 + rand() * 82;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    if (pathDistanceAt(x, z) < 1.5 || streamDistanceAt(x, z) < 1.5) continue;

    const s = 0.8 + rand() * 1.05;
    dummy.position.set(x, groundHeightAt(x, z) - 0.03, z);
    dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
    dummy.scale.set(s * 1.15, s * 0.85, s);
    dummy.updateMatrix();
    mossMoundInst.setMatrixAt(mmPlaced, dummy.matrix);
    cTmp.set('#7a8e6f').lerp(new THREE.Color('#5a6d56'), rand());
    mossMoundInst.setColorAt(mmPlaced, cTmp);
    mmPlaced++;
  }
  mossMoundInst.count = mmPlaced;
  mossMoundInst.instanceMatrix.needsUpdate = true;
  if (mossMoundInst.instanceColor) mossMoundInst.instanceColor.needsUpdate = true;
  mossMoundInst.computeBoundingSphere();
  scene.add(mossMoundInst);
  scalableMeshes.push({ inst: mossMoundInst, maxCount: mmPlaced });

  // 20. Clinging Ivy (on Trunks & Rocks) + Overhead Hanging Lianas & Between-Tree Catenary Vines
  const ivyMat = new THREE.MeshLambertMaterial({
    map: textures.ivySprite,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  attachWindSway(ivyMat, windUniforms, 0.03);

  // Trunk Ivy Wraps anchored directly to real placed trees (440 instances)
  const trunkIvyGeo = buildTrunkIvyGeometry();
  const trunkIvyInst = new THREE.InstancedMesh(trunkIvyGeo, ivyMat, 440);
  let tiPlaced = 0;
  for (let i = 0; i < allTrees.length && tiPlaced < 440; i++) {
    const tr = allTrees[i];
    if (tr.species === 'dead0' && rand() > 0.5) continue;
    if (rand() > 0.45) continue;
    const wScale = tr.species.startsWith('ancient') ? tr.sx * 1.38 : tr.sx * 1.02;
    dummy.position.set(tr.x, tr.y + 0.05, tr.z);
    dummy.rotation.set(0, tr.rot + rand() * 1.2, 0);
    dummy.scale.set(wScale, 0.88 + rand() * 0.35, wScale);
    dummy.updateMatrix();
    trunkIvyInst.setMatrixAt(tiPlaced, dummy.matrix);
    cTmp.setRGB(0.84 + rand() * 0.16, 0.88 + rand() * 0.12, 0.78 + rand() * 0.14);
    trunkIvyInst.setColorAt(tiPlaced, cTmp);
    tiPlaced++;
  }
  trunkIvyInst.count = tiPlaced;
  trunkIvyInst.instanceMatrix.needsUpdate = true;
  if (trunkIvyInst.instanceColor) trunkIvyInst.instanceColor.needsUpdate = true;
  trunkIvyInst.computeBoundingSphere();
  scene.add(trunkIvyInst);
  scalableMeshes.push({ inst: trunkIvyInst, maxCount: tiPlaced });

  // Rock Ivy Drapes anchored directly on real placed boulders (175 instances)
  const rockIvyGeo = buildRockIvyGeometry();
  const rockIvyInst = new THREE.InstancedMesh(rockIvyGeo, ivyMat, 175);
  let riPlaced = 0;
  for (let i = 0; i < placedBoulders.length && riPlaced < 175; i++) {
    const b = placedBoulders[i];
    if (rand() > 0.55) continue;
    dummy.position.set(b.x, b.y + b.sy * 0.16, b.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(b.sx * 0.98, b.sy * 0.9, b.sz * 0.98);
    dummy.updateMatrix();
    rockIvyInst.setMatrixAt(riPlaced, dummy.matrix);
    cTmp.setRGB(0.82 + rand() * 0.16, 0.86 + rand() * 0.14, 0.76 + rand() * 0.14);
    rockIvyInst.setColorAt(riPlaced, cTmp);
    riPlaced++;
  }
  rockIvyInst.count = riPlaced;
  rockIvyInst.instanceMatrix.needsUpdate = true;
  if (rockIvyInst.instanceColor) rockIvyInst.instanceColor.needsUpdate = true;
  rockIvyInst.computeBoundingSphere();
  scene.add(rockIvyInst);
  scalableMeshes.push({ inst: rockIvyInst, maxCount: riPlaced });

  // Hanging Branch Lianas swaying overhead & at eye-level beneath Ancient, Broadleaf & Twisted limbs (480 instances)
  const lianaMat = new THREE.MeshLambertMaterial({
    map: textures.lianaSprite,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  attachWindSway(lianaMat, windUniforms, 0.085, true);

  const hangLianaGeo = buildHangingLianaGeometry();
  const hangLianaInst = new THREE.InstancedMesh(hangLianaGeo, lianaMat, 480);
  let hlPlaced = 0;
  for (let i = 0; i < allTrees.length * 2 && hlPlaced < 480; i++) {
    const host = allTrees[i % allTrees.length];
    if (host.species.startsWith('dead')) continue;
    if (rand() > 0.52) continue;
    const isLarge = host.species.startsWith('ancient') || host.species.startsWith('broad');
    const offsetR = (isLarge ? 1.0 : 0.7) + rand() * (isLarge ? 1.6 : 1.0);
    const a = rand() * Math.PI * 2;
    const attachH = (isLarge ? 3.8 : 3.5) * host.sy + rand() * 1.4;
    dummy.position.set(
      host.x + Math.cos(a) * offsetR,
      host.y + attachH,
      host.z + Math.sin(a) * offsetR
    );
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const dropScale = 0.72 + rand() * 0.58;
    dummy.scale.set(0.85 + rand() * 0.45, dropScale, 0.85 + rand() * 0.45);
    dummy.updateMatrix();
    hangLianaInst.setMatrixAt(hlPlaced, dummy.matrix);
    cTmp.setRGB(0.78 + rand() * 0.2, 0.84 + rand() * 0.16, 0.74 + rand() * 0.16);
    hangLianaInst.setColorAt(hlPlaced, cTmp);
    hlPlaced++;
  }
  hangLianaInst.count = hlPlaced;
  hangLianaInst.instanceMatrix.needsUpdate = true;
  if (hangLianaInst.instanceColor) hangLianaInst.instanceColor.needsUpdate = true;
  hangLianaInst.computeBoundingSphere();
  scene.add(hangLianaInst);
  scalableMeshes.push({ inst: hangLianaInst, maxCount: hlPlaced });

  // Catenary Lianas Strung Between Nearby Tree Pairs Overhead (200 vine spans)
  const bridgeLianaGeo = buildBridgeLianaGeometry();
  const bridgeLianaMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#4c5e42',
    flatShading: true,
  });
  applyRetroVertexSnap(bridgeLianaMat, 200);
  const bridgeLianaInst = new THREE.InstancedMesh(bridgeLianaGeo, bridgeLianaMat, 200);
  let blPlaced = 0;
  for (let i = 0; i < allTrees.length && blPlaced < 200; i++) {
    const tA = allTrees[i];
    if (tA.species.startsWith('dead')) continue;
    for (let j = i + 1; j < Math.min(allTrees.length, i + 55); j++) {
      const tB = allTrees[j];
      const dx = tB.x - tA.x;
      const dz = tB.z - tA.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.6 || dist > 6.5) continue;
      if (rand() > 0.45) continue;

      const midX = (tA.x + tB.x) * 0.5;
      const midZ = (tA.z + tB.z) * 0.5;
      const yA = tA.y + (3.1 + rand() * 1.4) * tA.sy;
      const yB = tB.y + (3.1 + rand() * 1.4) * tB.sy;
      const midY = (yA + yB) * 0.5;
      const yaw = -Math.atan2(dz, dx);

      dummy.position.set(midX, midY, midZ);
      dummy.rotation.set(0, yaw, Math.atan2(yB - yA, dist));
      dummy.scale.set(dist, 1.85 + rand() * 1.35, 1.4);
      dummy.updateMatrix();
      bridgeLianaInst.setMatrixAt(blPlaced, dummy.matrix);
      blPlaced++;
      break;
    }
  }
  bridgeLianaInst.count = blPlaced;
  bridgeLianaInst.instanceMatrix.needsUpdate = true;
  bridgeLianaInst.computeBoundingSphere();
  scene.add(bridgeLianaInst);
  scalableMeshes.push({ inst: bridgeLianaInst, maxCount: blPlaced });

  // 21. Dense Crossed 2D Billboard Vegetation (Grass, Ferns, Tall Woodland Plants, Brambles)
  function populateBillboards(
    tex: THREE.CanvasTexture,
    targetCount: number,
    width: number,
    height: number,
    swayAmt: number,
    minPathDist: number,
    clusterAroundTrees: boolean,
    waterLover: boolean
  ) {
    const geo = createCrossedBillboardGeometry(width, height);
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      alphaTest: 0.44,
      side: THREE.DoubleSide,
    });
    attachWindSway(mat, windUniforms, swayAmt);

    const inst = new THREE.InstancedMesh(geo, mat, targetCount);
    inst.receiveShadow = true;
    inst.castShadow = false;

    let placed = 0;
    let tries = 0;
    while (placed < targetCount && tries < targetCount * 6) {
      tries++;
      let x = 0;
      let z = 0;
      if (clusterAroundTrees && allTrees.length > 0 && rand() < 0.55) {
        const host = allTrees[Math.floor(rand() * allTrees.length)];
        const a = rand() * Math.PI * 2;
        const d = 0.7 + rand() * 3.1;
        x = host.x + Math.cos(a) * d;
        z = host.z + Math.sin(a) * d;
      } else {
        const angle = rand() * Math.PI * 2;
        const rad = 1.6 + Math.pow(rand(), 0.74) * 86;
        x = Math.cos(angle) * rad;
        z = Math.sin(angle) * rad;
      }

      const pDist = pathDistanceAt(x, z);
      if (pDist < minPathDist) continue;
      if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < (waterLover ? 4.0 : 4.6)) continue;
      if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < (waterLover ? 5.9 : 6.4)) continue;
      if (streamDistanceAt(x, z) < (waterLover ? 1.35 : 1.55)) continue;
      if (Math.hypot(x - cabinX, z - cabinZ) < 6.5) continue;
      if (Math.hypot(x - cottageX, z - cottageZ) < 5.0) continue;
      if (Math.hypot(x - bastionX, z - bastionZ) < 7.8) continue;
      if (Math.hypot(x - ringX, z - ringZ) < 7.2) continue;
      if (Math.hypot(x - towerX, z - towerZ) < 6.8) continue;
      if (Math.hypot(x - cragCaveX, z - cragCaveZ) < 5.4) continue;
      if (Math.hypot(x - weepCaveX, z - weepCaveZ) < 5.4) continue;
      if (Math.hypot(x - ancCaveX, z - ancCaveZ) < 5.4) continue;
      if (Math.hypot(x - citGateX, z - citGateZ) < 6.2) continue;

      const s = 0.78 + rand() * 0.78;
      dummy.position.set(x, groundHeightAt(x, z) - 0.05, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(s, s * (0.88 + rand() * 0.45), s);
      dummy.updateMatrix();
      inst.setMatrixAt(placed, dummy.matrix);

      cTmp.setRGB(0.72 + rand() * 0.24, 0.76 + rand() * 0.2, 0.68 + rand() * 0.18);
      inst.setColorAt(placed, cTmp);
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
    scalableMeshes.push({ inst, maxCount: placed });
  }

  populateBillboards(textures.grassSprite, 3200, 0.92, 0.74, 0.14, 1.28, false, false);
  populateBillboards(textures.fernSprite, 1750, 1.22, 0.96, 0.11, 1.48, true, false);
  populateBillboards(textures.tallPlantSprite, 820, 1.22, 1.45, 0.13, 1.62, false, true);
  populateBillboards(textures.brambleSprite, 780, 1.35, 1.02, 0.06, 1.9, true, false);

  // 22. GPU-Animated Mist Particles spread across the dense ancient forest
  const mistCount = 210;
  const mistPositions = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 88;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = groundHeightAt(x, z) + 0.55 + rand() * 3.4;
    mistPositions[i * 3] = x;
    mistPositions[i * 3 + 1] = y;
    mistPositions[i * 3 + 2] = z;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = new THREE.PointsMaterial({
    map: textures.mistParticle,
    size: 0.45,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    color: '#b6c5d1',
    sizeAttenuation: true,
  });
  mistMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float seed = position.x * 0.73 + position.z * 1.19;
        transformed.x += sin(uTime * 0.25 + seed) * 0.95;
        transformed.y += cos(uTime * 0.33 + seed * 1.3) * 0.28;
        transformed.z += cos(uTime * 0.21 + seed * 0.8) * 0.95;
        `
      );
  };
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.frustumCulled = false;
  scene.add(mistPoints);

  // 23. Circling Distant Dark Crows above the Ruin Gate & Bastion Ridge
  const crowGroup = new THREE.Group();
  crowGroup.position.set(gateX - 6, 15, gateZ - 6);
  const crowMat = new THREE.MeshBasicMaterial({ color: '#101418', side: THREE.DoubleSide });
  const crowGeo = new THREE.BufferGeometry();
  const wingVerts = new Float32Array([
    0, 0, 0.25, -0.45, 0.12, -0.1, 0, 0, -0.15,
    0, 0, 0.25, 0, 0, -0.15, 0.45, 0.12, -0.1,
  ]);
  crowGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 4.5 + (i % 2) * 2.5;
    const crow = new THREE.Mesh(crowGeo, crowMat);
    crow.position.set(Math.cos(a) * r, (i % 3) * 1.2, Math.sin(a) * r);
    crow.rotation.y = -a;
    crowGroup.add(crow);
  }
  scene.add(crowGroup);

  // 24. Subtle Overcast Glade Light Shafts filtering softly into deep woodland clearings
  const shaftCanvas = document.createElement('canvas');
  shaftCanvas.width = 64;
  shaftCanvas.height = 64;
  const sctx = shaftCanvas.getContext('2d')!;
  const sImg = sctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    const v = y / 63;
    const vFade = Math.sin(v * Math.PI);
    const vSoft = vFade * vFade * (1 - v * 0.35);
    for (let x = 0; x < 64; x++) {
      const u = (x / 63) * 2 - 1;
      const hFade = Math.max(0, 1 - u * u);
      const streak = 0.72 + 0.28 * Math.sin(x * 0.45);
      const alpha = Math.floor(Math.max(0, Math.min(1, vSoft * hFade * hFade * streak)) * 255);
      const idx = (y * 64 + x) * 4;
      sImg.data[idx] = 200;
      sImg.data[idx + 1] = 214;
      sImg.data[idx + 2] = 224;
      sImg.data[idx + 3] = alpha;
    }
  }
  sctx.putImageData(sImg, 0, 0);
  const shaftTex = new THREE.CanvasTexture(shaftCanvas);
  shaftTex.magFilter = THREE.LinearFilter;
  shaftTex.minFilter = THREE.LinearFilter;

  const shaftMat = new THREE.MeshBasicMaterial({
    map: shaftTex,
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
  const shaftGeo = new THREE.PlaneGeometry(5.2, 13.0);
  for (const g of smallGlades) {
    const sy = groundHeightAt(g.x, g.z);
    for (let p = 0; p < 2; p++) {
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.set(g.x, sy + 6.2, g.z);
      shaft.rotation.set(0.12, p * (Math.PI * 0.5) + 0.3, -0.15);
      scene.add(shaft);
    }
  }

  const setDensityScale = (density: number) => {
    const clamped = Math.max(0.25, Math.min(1, density));
    for (const item of scalableMeshes) {
      item.inst.count = Math.max(1, Math.floor(item.maxCount * clamped));
    }
    mistPoints.visible = clamped > 0.3;
  };

  return {
    colliders,
    boxColliders,
    embers,
    lightAnchors,
    portals,
    windUniforms,
    mistPoints,
    crowGroup,
    setDensityScale,
  };
}

const PLAYABLE_CHECK_RADIUS = 94;
