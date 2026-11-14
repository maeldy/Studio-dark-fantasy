import * as THREE from 'three';
import { applyRetroVertexSnap } from './terrain';
import { ProceduralTextures } from './textures';
import { BoxCollider, CircleCollider, LightAnchor, WalkableSurface } from './types';

export interface InteriorBuildContext {
  root: THREE.Group;
  boxColliders: BoxCollider[];
  circleColliders: CircleCollider[];
  walkableSurfaces: WalkableSurface[];
  embers: { ember: THREE.Mesh; phase: number; baseScale?: [number, number, number] }[];
  lightAnchors: LightAnchor[];
  cameraOccluders: THREE.Object3D[];
}

export interface InteriorMaterials {
  stone: THREE.MeshLambertMaterial;
  darkStone: THREE.MeshLambertMaterial;
  mossStone: THREE.MeshLambertMaterial;
  carvedStone: THREE.MeshLambertMaterial;
  dungeonBrick: THREE.MeshLambertMaterial;
  caveRock: THREE.MeshLambertMaterial;
  wetCaveRock: THREE.MeshLambertMaterial;
  woodPlank: THREE.MeshLambertMaterial;
  timber: THREE.MeshLambertMaterial;
  bark: THREE.MeshLambertMaterial;
  plaster: THREE.MeshLambertMaterial;
  rug: THREE.MeshLambertMaterial;
  iron: THREE.MeshStandardMaterial;
  pewter: THREE.MeshStandardMaterial;
  linen: THREE.MeshLambertMaterial;
  ember: THREE.MeshBasicMaterial;
  windowGlow: THREE.MeshBasicMaterial;
  fungiGlow: THREE.MeshBasicMaterial;
  crystalGlow: THREE.MeshBasicMaterial;
  water: THREE.MeshLambertMaterial;
  voidMat: THREE.MeshBasicMaterial;
}

export function createInteriorMaterials(textures: ProceduralTextures): InteriorMaterials {
  const stone = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9aa4aa',
    flatShading: true,
  });
  const darkStone = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#6b7379',
    flatShading: true,
  });
  const mossStone = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#6e8171',
    flatShading: true,
  });
  const carvedStone = new THREE.MeshLambertMaterial({
    map: textures.carvedRuneStoneColor,
    color: '#929ca2',
    flatShading: true,
  });
  const dungeonBrick = new THREE.MeshLambertMaterial({
    map: textures.dungeonBrickColor,
    color: '#9a9e9f',
    flatShading: true,
  });
  const caveRock = new THREE.MeshLambertMaterial({
    map: textures.caveRockColor,
    color: '#889096',
    flatShading: true,
  });
  const wetCaveRock = new THREE.MeshLambertMaterial({
    map: textures.caveRockColor,
    color: '#6d7b7c',
    flatShading: true,
  });
  const woodPlank = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#a89684',
    flatShading: true,
  });
  const timber = new THREE.MeshLambertMaterial({
    map: textures.weatheredTimberColor,
    color: '#9e8f80',
    flatShading: true,
  });
  const bark = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#8f7d6c',
    flatShading: true,
  });
  const plaster = new THREE.MeshLambertMaterial({
    map: textures.plasterTimberColor,
    color: '#aba496',
    flatShading: true,
  });
  const rug = new THREE.MeshLambertMaterial({
    map: textures.wovenRugColor,
    color: '#b0a599',
    flatShading: true,
  });
  const iron = new THREE.MeshStandardMaterial({
    color: '#343a40',
    roughness: 0.52,
    metalness: 0.78,
    flatShading: true,
  });
  const pewter = new THREE.MeshStandardMaterial({
    color: '#7d858c',
    roughness: 0.42,
    metalness: 0.65,
    flatShading: true,
  });
  const linen = new THREE.MeshLambertMaterial({
    color: '#8c8376',
    flatShading: true,
  });
  const ember = new THREE.MeshBasicMaterial({ color: '#ff8a34' });
  const windowGlow = new THREE.MeshBasicMaterial({ color: '#b8763a' });
  const fungiGlow = new THREE.MeshBasicMaterial({ color: '#6ec4a4' });
  const crystalGlow = new THREE.MeshBasicMaterial({ color: '#5c93a8' });
  const water = new THREE.MeshLambertMaterial({
    color: '#18282b',
    transparent: true,
    opacity: 0.86,
  });
  const voidMat = new THREE.MeshBasicMaterial({ color: '#090b0e' });

  for (const mat of [
    stone,
    darkStone,
    mossStone,
    carvedStone,
    dungeonBrick,
    caveRock,
    wetCaveRock,
    woodPlank,
    timber,
    bark,
    plaster,
    rug,
    iron,
    pewter,
    linen,
  ]) {
    applyRetroVertexSnap(mat, 210);
  }

  return {
    stone,
    darkStone,
    mossStone,
    carvedStone,
    dungeonBrick,
    caveRock,
    wetCaveRock,
    woodPlank,
    timber,
    bark,
    plaster,
    rug,
    iron,
    pewter,
    linen,
    ember,
    windowGlow,
    fungiGlow,
    crystalGlow,
    water,
    voidMat,
  };
}

/**
 * Disposes only geometries and materials created inside an interior scene,
 * leaving shared CanvasTexture assets intact for return to the overworld.
 */
export function disposeInteriorGroup(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const anyObj = obj as THREE.Mesh | THREE.Points;
    if (anyObj.geometry) {
      geometries.add(anyObj.geometry);
    }
    const mat = (anyObj as THREE.Mesh).material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (m) materials.add(m);
      }
    } else if (mat) {
      materials.add(mat);
    }
  });

  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

export function addSolidWall(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  cx: number,
  yBase: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  rotY = 0,
  isOccluder = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(cx, yBase + h * 0.5, cz);
  mesh.rotation.y = rotY;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  ctx.root.add(mesh);
  if (isOccluder) ctx.cameraOccluders.push(mesh);

  ctx.boxColliders.push({
    cx,
    cz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    minY: yBase - 0.3,
    maxY: yBase + h + 0.3,
    kind: 'building',
  });
  return mesh;
}

export function addFloorSlab(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  cx: number,
  surfaceY: number,
  cz: number,
  w: number,
  d: number,
  thickness = 0.28,
  registerWalkable = true,
  isOccluder = false
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), mat);
  mesh.position.set(cx, surfaceY - thickness * 0.5, cz);
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  if (isOccluder) ctx.cameraOccluders.push(mesh);
  if (registerWalkable) {
    ctx.walkableSurfaces.push({
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
      yStart: surfaceY,
      yEnd: surfaceY,
    });
  }
  return mesh;
}

export function addCeilingSlab(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  cx: number,
  yBottom: number,
  cz: number,
  w: number,
  d: number,
  thickness = 0.32
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), mat);
  mesh.position.set(cx, yBottom + thickness * 0.5, cz);
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.cameraOccluders.push(mesh);
  return mesh;
}

/**
 * Adds a true walkable staircase + smooth slope surface along X or Z.
 * dir = +1 means height climbs from minCoord -> maxCoord along axis.
 */
export function addWalkableStaircase(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  cx: number,
  cz: number,
  width: number,
  runLength: number,
  yLow: number,
  yHigh: number,
  axis: 'x' | 'z',
  dir: 1 | -1,
  stepCount = 9,
  railMat?: THREE.Material
): void {
  const stepRise = (yHigh - yLow) / stepCount;
  const stepRun = runLength / stepCount;

  for (let i = 0; i < stepCount; i++) {
    const t = (i + 0.5) / stepCount;
    const offsetAlong = (dir > 0 ? t - 0.5 : 0.5 - t) * runLength;
    const stepTop = yLow + (i + 1) * stepRise;
    const stepThickness = Math.max(0.16, stepRise + 0.08);
    const sx = axis === 'x' ? cx + offsetAlong : cx;
    const sz = axis === 'z' ? cz + offsetAlong : cz;
    const w = axis === 'x' ? stepRun * 1.04 : width;
    const d = axis === 'z' ? stepRun * 1.04 : width;

    const tread = new THREE.Mesh(new THREE.BoxGeometry(w, stepThickness, d), mat);
    tread.position.set(sx, stepTop - stepThickness * 0.5, sz);
    tread.castShadow = true;
    tread.receiveShadow = true;
    ctx.root.add(tread);
  }

  if (railMat) {
    const slopeAngle = Math.atan2(yHigh - yLow, runLength);
    const diagLen = Math.hypot(runLength, yHigh - yLow);
    const midY = (yLow + yHigh) * 0.5 + 0.65;
    for (const side of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? diagLen : 0.1, 0.1, axis === 'z' ? diagLen : 0.1),
        railMat
      );
      if (axis === 'z') {
        rail.position.set(cx + side * (width * 0.5 - 0.06), midY, cz);
        rail.rotation.x = dir > 0 ? -slopeAngle : slopeAngle;
      } else {
        rail.position.set(cx, midY, cz + side * (width * 0.5 - 0.06));
        rail.rotation.z = dir > 0 ? slopeAngle : -slopeAngle;
      }
      ctx.root.add(rail);
    }
  }

  ctx.walkableSurfaces.push({
    minX: cx - (axis === 'x' ? runLength * 0.52 : width * 0.52),
    maxX: cx + (axis === 'x' ? runLength * 0.52 : width * 0.52),
    minZ: cz - (axis === 'z' ? runLength * 0.52 : width * 0.52),
    maxZ: cz + (axis === 'z' ? runLength * 0.52 : width * 0.52),
    yStart: dir > 0 ? yLow : yHigh,
    yEnd: dir > 0 ? yHigh : yLow,
    rampAxis: axis,
  });
}

export function addTimberBeamCeiling(
  ctx: InteriorBuildContext,
  beamMat: THREE.Material,
  cx: number,
  y: number,
  cz: number,
  spanW: number,
  spanD: number,
  count: number,
  alongX = true
): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? spanW : 0.24, 0.28, alongX ? 0.24 : spanD),
      beamMat
    );
    beam.position.set(
      alongX ? cx : cx + t * (spanW - 1.0),
      y,
      alongX ? cz + t * (spanD - 1.0) : cz
    );
    beam.castShadow = true;
    ctx.root.add(beam);
  }
}

export function addStonePillar(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  capMat: THREE.Material,
  x: number,
  yBase: number,
  z: number,
  radius: number,
  height: number,
  withCollider = true
): void {
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.5, 0.34, radius * 2.5), capMat);
  plinth.position.set(x, yBase + 0.17, z);
  plinth.receiveShadow = true;
  ctx.root.add(plinth);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, height - 0.64, 7),
    mat
  );
  shaft.position.set(x, yBase + 0.34 + (height - 0.64) * 0.5, z);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  ctx.root.add(shaft);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.45, 0.32, radius * 2.45), capMat);
  cap.position.set(x, yBase + height - 0.16, z);
  ctx.root.add(cap);

  if (withCollider) {
    ctx.circleColliders.push({
      x,
      z,
      radius: radius * 1.15,
      minY: yBase - 0.3,
      maxY: yBase + height + 0.3,
      kind: 'ruin',
    });
  }
}

/**
 * Ribbed medieval groin-vault arch bay inspired by image_5004605c.png
 */
export function addGroinVaultBay(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  ribMat: THREE.Material,
  cx: number,
  yBase: number,
  cz: number,
  width: number,
  depth: number,
  springY: number,
  crownY: number
): void {
  const span = Math.max(width, depth);
  for (const rotY of [0, Math.PI * 0.5]) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(span * 0.48, 0.16, 4, 8, Math.PI),
      ribMat
    );
    rib.position.set(cx, yBase + springY, cz);
    rib.rotation.y = rotY;
    ctx.root.add(rib);
  }
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.55), ribMat);
  boss.position.set(cx, yBase + crownY - 0.1, cz);
  ctx.root.add(boss);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), mat);
  ceiling.position.set(cx, yBase + crownY + 0.22, cz);
  ctx.root.add(ceiling);
  ctx.cameraOccluders.push(ceiling);
}

export function addStoneFireplace(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0,
  lit = true,
  phase = 1.0
): void {
  const fg = new THREE.Group();
  fg.position.set(x, yBase, z);
  fg.rotation.y = rotY;

  const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.3), mats.darkStone);
  hearth.position.set(0, 0.11, 0.15);
  fg.add(hearth);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.35, 0.55), mats.stone);
  back.position.set(0, 1.18, -0.3);
  fg.add(back);

  for (const sx of [-0.88, 0.88]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.45, 0.85), mats.stone);
    cheek.position.set(sx, 0.85, 0.1);
    fg.add(cheek);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.34, 0.95), mats.timber);
  lintel.position.set(0, 1.62, 0.12);
  fg.add(lintel);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.2, 0.72), mats.darkStone);
  hood.position.set(0, 2.8, -0.18);
  fg.add(hood);

  // Stacked firewood & embers inside firebox
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 5), mats.bark);
    log.rotation.z = Math.PI * 0.5 + (i - 1) * 0.12;
    log.position.set(0, 0.3 + i * 0.06, 0.08 + (i - 1) * 0.07);
    fg.add(log);
  }

  if (lit) {
    const fireMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mats.ember);
    fireMesh.position.set(0, 0.45, 0.1);
    fireMesh.scale.set(1.3, 0.8, 1.0);
    fg.add(fireMesh);
    ctx.embers.push({ ember: fireMesh, phase, baseScale: [1.3, 0.8, 1.0] });

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    ctx.lightAnchors.push({
      x: x + sin * 0.55,
      y: yBase + 0.95,
      z: z + cos * 0.55,
      color: '#ff8a36',
      baseIntensity: 7.5,
      distance: 14,
      phase,
    });
  }

  ctx.root.add(fg);
  ctx.boxColliders.push({
    cx: x,
    cz: z,
    halfW: 1.28,
    halfD: 0.72,
    rotY,
    minY: yBase - 0.2,
    maxY: yBase + 2.4,
    kind: 'building',
  });
}

export function addHighBackChair(
  parent: THREE.Group,
  woodMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotY = 0
): void {
  const cg = new THREE.Group();
  cg.position.set(x, y, z);
  cg.rotation.y = rotY;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.48), woodMat);
  seat.position.y = 0.46;
  cg.add(seat);

  for (const lx of [-0.2, 0.2]) {
    for (const lz of [-0.19, 0.19]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.06), woodMat);
      leg.position.set(lx, 0.23, lz);
      cg.add(leg);
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.06), woodMat);
    post.position.set(lx, 0.8, -0.2);
    cg.add(post);
  }
  const backSlat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.05), woodMat);
  backSlat.position.set(0, 0.88, -0.2);
  cg.add(backSlat);

  parent.add(cg);
}

/**
 * Dining table with pewter plates, goblets & tall candlesticks (inspired by image_7e45b3b1.png & image_5004605c.png)
 */
export function addDiningTableSet(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  length = 2.6,
  width = 1.05,
  rotY = 0,
  chairCount = 4
): void {
  const tg = new THREE.Group();
  tg.position.set(x, yBase, z);
  tg.rotation.y = rotY;

  const top = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, width), mats.timber);
  top.position.y = 0.78;
  top.castShadow = true;
  top.receiveShadow = true;
  tg.add(top);

  for (const lx of [-length * 0.38, length * 0.38]) {
    const trestle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.76, width * 0.78), mats.bark);
    trestle.position.set(lx, 0.38, 0);
    tg.add(trestle);
  }

  // Tableware: plates, goblets & candlestick
  const plateOffsets = [-length * 0.28, 0, length * 0.28];
  for (const px of plateOffsets) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.03, 7), mats.pewter);
    plate.position.set(px, 0.84, width * 0.22);
    tg.add(plate);
  }
  const goblet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.15, 6), mats.pewter);
  goblet.position.set(length * 0.18, 0.9, -width * 0.15);
  tg.add(goblet);

  // Candlestick + flame
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.24, 6), mats.pewter);
  stick.position.set(-length * 0.08, 0.94, 0);
  tg.add(stick);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 5), mats.linen);
  candle.position.set(-length * 0.08, 1.12, 0);
  tg.add(candle);
  const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), mats.ember);
  flame.position.set(-length * 0.08, 1.23, 0);
  tg.add(flame);
  ctx.embers.push({ ember: flame, phase: x + z, baseScale: [0.6, 0.9, 0.6] });

  if (chairCount >= 2) {
    addHighBackChair(tg, mats.woodPlank, -length * 0.24, 0, width * 0.65, Math.PI);
    addHighBackChair(tg, mats.woodPlank, length * 0.24, 0, -width * 0.65, 0);
  }
  if (chairCount >= 4) {
    addHighBackChair(tg, mats.woodPlank, length * 0.24, 0, width * 0.65, Math.PI);
    addHighBackChair(tg, mats.woodPlank, -length * 0.24, 0, -width * 0.65, 0);
  }

  ctx.root.add(tg);
  ctx.boxColliders.push({
    cx: x,
    cz: z,
    halfW: length * 0.54,
    halfD: width * 0.62,
    rotY,
    minY: yBase - 0.2,
    maxY: yBase + 1.4,
    kind: 'building',
  });
}

/**
 * Four-poster wooden canopy bed inspired by image_6099594f.png (dark fantasy muted palette)
 */
export function addCanopyBed(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0
): void {
  const bg = new THREE.Group();
  bg.position.set(x, yBase, z);
  bg.rotation.y = rotY;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.34, 2.25), mats.timber);
  frame.position.y = 0.28;
  bg.add(frame);

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.22, 2.08), mats.linen);
  mattress.position.y = 0.54;
  bg.add(mattress);

  const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 1.45), mats.rug);
  quilt.position.set(0, 0.61, 0.3);
  bg.add(quilt);

  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.74, 1.15, 0.12), mats.bark);
  headboard.position.set(0, 0.92, -1.08);
  bg.add(headboard);

  for (const px of [-0.82, 0.82]) {
    for (const pz of [-1.06, 1.06]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.15, 5), mats.bark);
      post.position.set(px, 1.08, pz);
      bg.add(post);
    }
  }
  const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.1, 2.28), mats.timber);
  canopyTop.position.set(0, 2.14, 0);
  bg.add(canopyTop);

  ctx.root.add(bg);
  ctx.boxColliders.push({
    cx: x,
    cz: z,
    halfW: 0.92,
    halfD: 1.18,
    rotY,
    minY: yBase - 0.2,
    maxY: yBase + 2.2,
    kind: 'building',
  });
}

export function addWovenRug(
  ctx: InteriorBuildContext,
  rugMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  rotY = 0
): void {
  const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), rugMat);
  rug.position.set(x, y + 0.015, z);
  rug.rotation.y = rotY;
  rug.receiveShadow = true;
  ctx.root.add(rug);
}

export function addChestAndDrawer(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0
): void {
  const cg = new THREE.Group();
  cg.position.set(x, yBase, z);
  cg.rotation.y = rotY;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.56, 0.62), mats.woodPlank);
  body.position.y = 0.28;
  cg.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 1.06, 6, 1, false, 0, Math.PI), mats.timber);
  lid.rotation.z = Math.PI * 0.5;
  lid.position.y = 0.55;
  cg.add(lid);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.65), mats.iron);
  band.position.y = 0.5;
  cg.add(band);
  ctx.root.add(cg);

  ctx.boxColliders.push({
    cx: x,
    cz: z,
    halfW: 0.56,
    halfD: 0.36,
    rotY,
    minY: yBase - 0.2,
    maxY: yBase + 1.0,
    kind: 'building',
  });
}

export function addWallShelf(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  y: number,
  z: number,
  w = 1.6,
  rotY = 0
): void {
  const sg = new THREE.Group();
  sg.position.set(x, y, z);
  sg.rotation.y = rotY;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.36), mats.woodPlank);
  sg.add(board);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 6), mats.pewter);
    jar.position.set((i - 1) * (w * 0.28), 0.15, 0);
    sg.add(jar);
  }
  ctx.root.add(sg);
}

export function addBarrelCluster(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  count = 2
): void {
  const offsets: [number, number][] = [
    [0, 0],
    [0.72, 0.25],
    [0.25, -0.74],
  ];
  for (let i = 0; i < Math.min(count, offsets.length); i++) {
    const [ox, oz] = offsets[i];
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.84, 7), mats.woodPlank);
    b.position.set(x + ox, yBase + 0.42, z + oz);
    b.castShadow = true;
    ctx.root.add(b);
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 7), mats.iron);
    hoop.position.set(x + ox, yBase + 0.62, z + oz);
    ctx.root.add(hoop);
    ctx.circleColliders.push({
      x: x + ox,
      z: z + oz,
      radius: 0.4,
      minY: yBase - 0.2,
      maxY: yBase + 1.0,
      kind: 'prop',
    });
  }
}

export function addLitCasementWindow(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0
): void {
  const wg = new THREE.Group();
  wg.position.set(x, y, z);
  wg.rotation.y = rotY;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.1), mats.bark);
  wg.add(frame);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), mats.windowGlow);
  wg.add(pane);
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.14), mats.bark);
  wg.add(barV);
  const barH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.14), mats.bark);
  wg.add(barH);
  ctx.root.add(wg);
}

export function addWallTorchSconce(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  y: number,
  z: number,
  nx: number,
  nz: number,
  phase: number,
  withLight = true,
  intensity = 6.5,
  distance = 13
): void {
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), mats.iron);
  bracket.position.set(x, y, z);
  ctx.root.add(bracket);

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.48, 5), mats.bark);
  stick.position.set(x + nx * 0.16, y + 0.14, z + nz * 0.16);
  stick.rotation.z = -nx * 0.35;
  stick.rotation.x = nz * 0.35;
  ctx.root.add(stick);

  const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), mats.ember);
  flame.position.set(x + nx * 0.26, y + 0.38, z + nz * 0.26);
  ctx.root.add(flame);
  ctx.embers.push({ ember: flame, phase, baseScale: [0.85, 1.1, 0.85] });

  if (withLight) {
    ctx.lightAnchors.push({
      x: x + nx * 0.42,
      y: y + 0.42,
      z: z + nz * 0.42,
      color: '#ff8a34',
      baseIntensity: intensity,
      distance,
      phase,
    });
  }
}

export function addInteriorBrazier(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  lit = true,
  phase = 2.0,
  color = '#ff8a34',
  intensity = 7.2
): { emberMesh: THREE.Mesh; lightAnchor: LightAnchor } {
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.72, 5), mats.iron);
  ped.position.set(x, yBase + 0.36, z);
  ctx.root.add(ped);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.28, 6), mats.iron);
  bowl.position.set(x, yBase + 0.82, z);
  ctx.root.add(bowl);

  const emberMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mats.ember);
  emberMesh.position.set(x, yBase + 1.02, z);
  emberMesh.scale.set(1.15, 0.65, 1.15);
  emberMesh.visible = lit;
  ctx.root.add(emberMesh);
  ctx.embers.push({ ember: emberMesh, phase, baseScale: [1.15, 0.65, 1.15] });

  const lightAnchor: LightAnchor = {
    x,
    y: yBase + 1.32,
    z,
    color,
    baseIntensity: lit ? intensity : 0,
    distance: 15,
    phase,
  };
  ctx.lightAnchors.push(lightAnchor);

  ctx.circleColliders.push({
    x,
    z,
    radius: 0.52,
    minY: yBase - 0.2,
    maxY: yBase + 1.3,
    kind: 'prop',
  });

  return { emberMesh, lightAnchor };
}

export function addIronCellGate(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  width: number,
  height: number,
  rotY: number,
  initiallyOpen: boolean,
  tag: string
): { pivot: THREE.Group; setOpen: (open: boolean) => void } {
  const pivot = new THREE.Group();
  pivot.position.set(x - Math.cos(rotY) * (width * 0.5), yBase, z + Math.sin(rotY) * (width * 0.5));
  pivot.rotation.y = rotY + (initiallyOpen ? 1.35 : 0);

  const gateGroup = new THREE.Group();
  gateGroup.position.set(width * 0.5, 0, 0);

  const barCount = Math.max(3, Math.floor(width / 0.28));
  for (let i = 0; i <= barCount; i++) {
    const bx = -width * 0.5 + (i / barCount) * width;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height, 4), mats.iron);
    bar.position.set(bx, height * 0.5, 0);
    gateGroup.add(bar);
  }
  for (const ry of [0.35, height * 0.55, height - 0.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 0.06), mats.iron);
    rail.position.set(0, ry, 0);
    gateGroup.add(rail);
  }
  pivot.add(gateGroup);
  ctx.root.add(pivot);

  const collider: BoxCollider = {
    cx: x,
    cz: z,
    halfW: width * 0.5,
    halfD: 0.18,
    rotY,
    minY: initiallyOpen ? -999 : yBase - 0.2,
    maxY: initiallyOpen ? -998 : yBase + height + 0.2,
    kind: 'building',
    tag,
  };
  ctx.boxColliders.push(collider);

  const setOpen = (open: boolean) => {
    pivot.rotation.y = rotY + (open ? 1.35 : 0);
    collider.minY = open ? -999 : yBase - 0.2;
    collider.maxY = open ? -998 : yBase + height + 0.2;
  };

  return { pivot, setOpen };
}

export function addHangingChains(
  ctx: InteriorBuildContext,
  ironMat: THREE.Material,
  x: number,
  yTop: number,
  z: number,
  length = 2.0
): void {
  const linkCount = Math.max(4, Math.floor(length / 0.28));
  for (let i = 0; i < linkCount; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 6), ironMat);
    link.position.set(x, yTop - 0.14 - i * 0.26, z);
    link.rotation.y = (i % 2) * (Math.PI * 0.5);
    ctx.root.add(link);
  }
}

export function addSarcophagus(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0
): void {
  const sg = new THREE.Group();
  sg.position.set(x, yBase, z);
  sg.rotation.y = rotY;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 2.25), mats.carvedStone);
  base.position.y = 0.36;
  base.castShadow = true;
  sg.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.24, 2.32), mats.stone);
  lid.position.y = 0.84;
  sg.add(lid);
  ctx.root.add(sg);

  ctx.boxColliders.push({
    cx: x,
    cz: z,
    halfW: 0.65,
    halfD: 1.2,
    rotY,
    minY: yBase - 0.2,
    maxY: yBase + 1.1,
    kind: 'ruin',
  });
}

export function addWeaponArmorRack(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0
): void {
  const rg = new THREE.Group();
  rg.position.set(x, yBase, z);
  rg.rotation.y = rotY;

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.65, 0.14), mats.bark);
  post.position.y = 0.82;
  rg.add(post);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.12), mats.bark);
  cross.position.y = 1.38;
  rg.add(cross);

  // Dark steel cuirass & shield
  const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.26), mats.iron);
  cuirass.position.y = 1.18;
  rg.add(cuirass);
  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), mats.iron);
  helm.position.y = 1.72;
  rg.add(helm);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.06, 6), mats.pewter);
  shield.rotation.x = Math.PI * 0.5;
  shield.position.set(0.55, 0.82, 0.12);
  rg.add(shield);

  ctx.root.add(rg);
  ctx.circleColliders.push({
    x,
    z,
    radius: 0.58,
    minY: yBase - 0.2,
    maxY: yBase + 1.8,
    kind: 'prop',
  });
}

export function addHoodedStatue(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  rotY = 0,
  scale = 1
): void {
  const sg = new THREE.Group();
  sg.position.set(x, yBase, z);
  sg.rotation.y = rotY;
  sg.scale.setScalar(scale);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.58, 1.05), mats.mossStone);
  plinth.position.y = 0.29;
  sg.add(plinth);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 1.65, 6), mats.stone);
  robe.position.y = 1.4;
  sg.add(robe);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.54, 6), mats.stone);
  hood.position.set(0, 2.42, 0.04);
  hood.rotation.x = 0.2;
  sg.add(hood);

  ctx.root.add(sg);
  ctx.circleColliders.push({
    x,
    z,
    radius: 0.65 * scale,
    minY: yBase - 0.2,
    maxY: yBase + 2.8 * scale,
    kind: 'ruin',
  });
}

export function addGlowingMushroomCluster(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  scale = 1,
  withLight = false,
  phase = 1.2
): void {
  const mg = new THREE.Group();
  mg.position.set(x, yBase, z);
  mg.scale.setScalar(scale);

  const specs: [number, number, number, number][] = [
    [0, 0, 0.34, 0.2],
    [-0.18, 0.14, 0.22, 0.14],
    [0.2, -0.1, 0.26, 0.16],
  ];
  for (const [ox, oz, h, r] of specs) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.35, h, 5), mats.linen);
    stem.position.set(ox, h * 0.5, oz);
    mg.add(stem);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.85, 6), mats.fungiGlow);
    cap.position.set(ox, h + r * 0.35, oz);
    mg.add(cap);
  }
  ctx.root.add(mg);

  if (withLight) {
    ctx.lightAnchors.push({
      x,
      y: yBase + 0.55 * scale,
      z,
      color: '#6ec4a4',
      baseIntensity: 3.8,
      distance: 10,
      phase,
    });
  }
}

export function addCrystalCluster(
  ctx: InteriorBuildContext,
  mats: InteriorMaterials,
  x: number,
  yBase: number,
  z: number,
  withLight = false,
  phase = 2.0
): void {
  const cg = new THREE.Group();
  cg.position.set(x, yBase, z);
  for (let i = 0; i < 4; i++) {
    const h = 0.45 + (i % 3) * 0.25;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.14, h, 5), mats.crystalGlow);
    shard.position.set(Math.cos(i * 1.6) * 0.16, h * 0.48, Math.sin(i * 1.6) * 0.16);
    shard.rotation.set((i - 1.5) * 0.14, i * 0.7, (i % 2 === 0 ? 1 : -1) * 0.16);
    cg.add(shard);
  }
  ctx.root.add(cg);

  if (withLight) {
    ctx.lightAnchors.push({
      x,
      y: yBase + 0.7,
      z,
      color: '#6ea8c2',
      baseIntensity: 3.6,
      distance: 10,
      phase,
    });
  }
}

export function addStalactite(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  x: number,
  yTop: number,
  z: number,
  height: number,
  radius: number,
  inverted = false
): void {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), mat);
  if (inverted) {
    cone.position.set(x, yTop + height * 0.5, z);
  } else {
    cone.rotation.x = Math.PI;
    cone.position.set(x, yTop - height * 0.5, z);
  }
  cone.castShadow = true;
  ctx.root.add(cone);
}

export function addCaveBoulder(
  ctx: InteriorBuildContext,
  mat: THREE.Material,
  x: number,
  yBase: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  withCollider = true
): void {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat);
  rock.scale.set(sx, sy, sz);
  rock.position.set(x, yBase + sy * 0.45, z);
  rock.rotation.set(x * 0.23, z * 0.41, 0.12);
  rock.castShadow = true;
  rock.receiveShadow = true;
  ctx.root.add(rock);
  ctx.cameraOccluders.push(rock);

  if (withCollider) {
    ctx.circleColliders.push({
      x,
      z,
      radius: Math.max(sx, sz) * 0.85,
      minY: yBase - 0.5,
      maxY: yBase + sy * 1.5,
      kind: 'rock',
    });
  }
}
