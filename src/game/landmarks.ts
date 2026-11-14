import * as THREE from 'three';
import { applyRetroVertexSnap } from './terrain';
import { ProceduralTextures } from './textures';
import { BoxCollider, CircleCollider, LightAnchor, PortalLink } from './types';

export interface BuiltLandmark {
  group: THREE.Group;
  boxColliders: BoxCollider[];
  circleColliders: CircleCollider[];
  embers: { ember: THREE.Mesh; phase: number }[];
  lightAnchors: LightAnchor[];
  portals: PortalLink[];
}

export function localToWorldXZ(
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

function createArchBlockGeometry(
  width: number,
  height: number,
  depth: number,
  archRadius: number,
  archSpringY: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-archRadius, 0);
  shape.lineTo(-archRadius, archSpringY);
  shape.absarc(0, archSpringY, archRadius, Math.PI, 0, true);
  shape.lineTo(archRadius, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 7,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

function createSharedArchMaterials(textures: ProceduralTextures) {
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9ca5ab',
    flatShading: true,
  });
  const darkStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#737c83',
    flatShading: true,
  });
  const mossStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#748879',
    flatShading: true,
  });
  const carvedStoneMat = new THREE.MeshLambertMaterial({
    map: textures.carvedRuneStoneColor,
    color: '#99a3a8',
    flatShading: true,
  });
  const caveRockMat = new THREE.MeshLambertMaterial({
    map: textures.caveRockColor,
    color: '#889299',
    flatShading: true,
  });
  const barkMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#968473',
    flatShading: true,
  });
  const woodMat = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#9e8d7c',
    flatShading: true,
  });
  const weatheredTimberMat = new THREE.MeshLambertMaterial({
    map: textures.weatheredTimberColor,
    color: '#a8998a',
    flatShading: true,
  });
  const plasterMat = new THREE.MeshLambertMaterial({
    map: textures.plasterTimberColor,
    color: '#b6afa2',
    flatShading: true,
  });
  const shingleMat = new THREE.MeshLambertMaterial({
    map: textures.roofShingleColor,
    color: '#a8a49c',
    flatShading: true,
  });
  const foliageMat = new THREE.MeshLambertMaterial({
    map: textures.broadleafColor,
    color: '#6f8260',
    flatShading: true,
  });
  const potteryMat = new THREE.MeshLambertMaterial({
    color: '#6e5241',
    flatShading: true,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#343a40',
    roughness: 0.5,
    metalness: 0.76,
    flatShading: true,
  });
  const voidMat = new THREE.MeshLambertMaterial({
    color: '#0e1115',
    flatShading: true,
  });
  const warmWindowMat = new THREE.MeshBasicMaterial({
    color: '#cc7c36',
  });
  const ivyMat = new THREE.MeshLambertMaterial({
    map: textures.ivySprite,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });

  for (const m of [
    stoneMat,
    darkStoneMat,
    mossStoneMat,
    carvedStoneMat,
    caveRockMat,
    barkMat,
    woodMat,
    weatheredTimberMat,
    plasterMat,
    shingleMat,
    foliageMat,
    potteryMat,
    ironMat,
    voidMat,
  ]) {
    applyRetroVertexSnap(m, 200);
  }

  return {
    stoneMat,
    darkStoneMat,
    mossStoneMat,
    carvedStoneMat,
    caveRockMat,
    barkMat,
    woodMat,
    weatheredTimberMat,
    plasterMat,
    shingleMat,
    foliageMat,
    potteryMat,
    ironMat,
    voidMat,
    warmWindowMat,
    ivyMat,
  };
}

function addBrokenPottery(
  group: THREE.Group,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  tilt = 0.25
) {
  const potProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.02),
    new THREE.Vector2(0.22, 0.16),
    new THREE.Vector2(0.16, 0.34),
    new THREE.Vector2(0.11, 0.42),
    new THREE.Vector2(0.15, 0.48),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile, 7), mat);
  pot.position.set(x, y, z);
  pot.rotation.set(tilt, x * 1.7, tilt * 0.6);
  pot.castShadow = true;
  group.add(pot);

  for (let i = 0; i < 2; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.12), mat);
    shard.position.set(x + (i === 0 ? 0.28 : -0.22), y + 0.02, z + 0.22);
    shard.rotation.y = i * 1.1 + 0.4;
    group.add(shard);
  }
}

function addWeatheredCrate(
  group: THREE.Group,
  woodMat: THREE.Material,
  beamMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  size = 0.65,
  yaw = 0.2
) {
  const crate = new THREE.Group();
  crate.position.set(x, y, z);
  crate.rotation.y = yaw;
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.85, size), woodMat);
  box.position.y = size * 0.42;
  box.castShadow = true;
  box.receiveShadow = true;
  crate.add(box);
  const brace = new THREE.Mesh(
    new THREE.BoxGeometry(size * 1.04, size * 0.12, size * 1.04),
    beamMat
  );
  brace.position.y = size * 0.78;
  crate.add(brace);
  group.add(crate);
}

function addIvyStrip(
  group: THREE.Group,
  ivyMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0
) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ivyMat);
  plane.position.set(x, y, z);
  plane.rotation.y = rotY;
  group.add(plane);
}

function addCreepingRoot(
  group: THREE.Group,
  barkMat: THREE.Material,
  pts: THREE.Vector3[],
  radius = 0.14
) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, radius, 5, false), barkMat);
  root.castShadow = true;
  root.receiveShadow = true;
  group.add(root);
}

function addRoofSapling(
  group: THREE.Group,
  barkMat: THREE.Material,
  foliageMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  scale = 1
) {
  const tree = new THREE.Group();
  tree.position.set(x, y, z);
  tree.scale.setScalar(scale);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.05, 5), barkMat);
  trunk.position.y = 0.5;
  trunk.rotation.z = 0.14;
  tree.add(trunk);

  const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), foliageMat);
  c1.position.set(0.08, 1.05, 0);
  c1.scale.set(1.2, 0.85, 1.1);
  tree.add(c1);

  const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), foliageMat);
  c2.position.set(-0.22, 0.82, 0.12);
  tree.add(c2);

  group.add(tree);
}

function addGlowWindow(
  group: THREE.Group,
  frameMat: THREE.Material,
  paneMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotY = 0
) {
  const wg = new THREE.Group();
  wg.position.set(x, y, z);
  wg.rotation.y = rotY;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.14), frameMat);
  wg.add(frame);

  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), paneMat);
  wg.add(pane);

  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.18), frameMat);
  wg.add(mullionV);
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.18), frameMat);
  wg.add(mullionH);

  group.add(wg);
}

/**
 * LOCATION A: HOLLOWBARK HOMESTEAD (Enlarged Two-Story Half-Timbered Woodland Manor / Lodge)
 * Inspired by image_e3f29ff2.png:
 * Stone ground-floor masonry, overhanging half-timbered upper gables, central pyramidal turret spire,
 * covered front portico & stone stairs, glowing casement windows, weathered shingles & interior portal.
 */
export function buildAbandonedCabinLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);
  const emberMat = new THREE.MeshBasicMaterial({ color: '#ff8a34' });

  // 1. Broad Stone Foundation & Lower Masonry Story (9.4m x 6.2m)
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 6.4), m.mossStoneMat);
  foundation.position.set(0, 0.22, -0.35);
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  group.add(foundation);

  const lowerMasonry = new THREE.Mesh(new THREE.BoxGeometry(8.9, 2.75, 5.75), m.stoneMat);
  lowerMasonry.position.set(0, 1.82, -0.35);
  lowerMasonry.castShadow = true;
  lowerMasonry.receiveShadow = true;
  group.add(lowerMasonry);

  // Corner stone quoins & timber belt beam
  const beltBeam = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.24, 6.15), m.barkMat);
  beltBeam.position.set(0, 3.25, -0.35);
  beltBeam.castShadow = true;
  group.add(beltBeam);

  // 2. Overhanging Half-Timbered Upper Story (Twin Winged Gables + Rear Wing)
  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(9.2, 2.35, 6.05), m.plasterMat);
  upperBody.position.set(0, 4.5, -0.35);
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;
  group.add(upperBody);

  // Exposed dark oak vertical & horizontal timber framing posts on facades
  for (const fx of [-4.58, -2.2, 0, 2.2, 4.58]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.45, 6.22), m.barkMat);
    post.position.set(fx, 4.5, -0.35);
    group.add(post);
  }

  // Twin Front Steep Half-Timbered Gables (inspired by image_e3f29ff2.png)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.15, 0);
  gableShape.lineTo(2.15, 0);
  gableShape.lineTo(0, 2.25);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 5.95, bevelEnabled: false });
  gableGeo.translate(0, 0, -2.975);

  for (const gx of [-2.45, 2.45]) {
    const gableWing = new THREE.Mesh(gableGeo, m.plasterMat);
    gableWing.position.set(gx, 5.65, -0.35);
    gableWing.castShadow = true;
    group.add(gableWing);

    // Steep pitched dark shingle roof panels flanking each gable
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.18, 6.55), m.shingleMat);
    roofL.position.set(gx - 1.12, 6.72, -0.35);
    roofL.rotation.z = 0.81;
    roofL.castShadow = true;
    group.add(roofL);

    const roofR = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.18, 6.55), m.shingleMat);
    roofR.position.set(gx + 1.12, 6.72, -0.35);
    roofR.rotation.z = -0.81;
    roofR.castShadow = true;
    group.add(roofR);

    // Upper gable glowing attic windows
    addGlowWindow(group, m.barkMat, m.warmWindowMat, gx, 6.4, 2.66, 0.82, 0.92, 0);
    // Second-floor warm casement windows
    addGlowWindow(group, m.barkMat, m.warmWindowMat, gx, 4.55, 2.7, 1.05, 1.15, 0);
    // Ground floor windows flanking porch
    addGlowWindow(group, m.barkMat, m.warmWindowMat, gx * 1.18, 1.95, 2.55, 1.08, 1.25, 0);
  }

  // Side windows on east & west facades
  addGlowWindow(group, m.barkMat, m.warmWindowMat, -4.64, 4.4, -0.3, 1.15, 1.1, Math.PI * 0.5);
  addGlowWindow(group, m.barkMat, m.warmWindowMat, 4.64, 4.4, -0.3, 1.15, 1.1, Math.PI * 0.5);

  // 3. Central Steep Pyramidal Turret Spire (signature silhouette from image_e3f29ff2.png)
  const turretBase = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.85, 2.55), m.plasterMat);
  turretBase.position.set(0, 6.45, -0.55);
  turretBase.castShadow = true;
  group.add(turretBase);

  const spireRoof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 3.2, 4), m.shingleMat);
  spireRoof.position.set(0, 8.85, -0.55);
  spireRoof.rotation.y = Math.PI * 0.25;
  spireRoof.castShadow = true;
  group.add(spireRoof);

  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.85, 4), m.ironMat);
  finial.position.set(0, 10.7, -0.55);
  group.add(finial);

  // Tall Weathered Stone Chimney rising past upper roof
  const chimneyBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 4.8, 1.3), m.stoneMat);
  chimneyBase.position.set(4.85, 2.5, -0.65);
  chimneyBase.castShadow = true;
  group.add(chimneyBase);
  const chimneyStack = new THREE.Mesh(new THREE.BoxGeometry(0.84, 3.8, 0.92), m.darkStoneMat);
  chimneyStack.position.set(4.8, 6.5, -0.65);
  chimneyStack.castShadow = true;
  group.add(chimneyStack);

  // Side Woodshed Annex on West Flank
  const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 3.8), m.shingleMat);
  shedRoof.position.set(-5.45, 2.35, -0.6);
  shedRoof.rotation.z = 0.34;
  shedRoof.castShadow = true;
  group.add(shedRoof);
  for (const sz of [-2.2, 1.0]) {
    const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.0, 5), m.barkMat);
    sPost.position.set(-6.35, 1.0, sz);
    group.add(sPost);
  }

  // 4. Covered Front Entry Portico, Stone Staircase & Heavy Oak Arched Door
  const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.44, 2.2), m.mossStoneMat);
  porchDeck.position.set(0, 0.22, 3.55);
  porchDeck.receiveShadow = true;
  group.add(porchDeck);

  // Walkable front steps climbing onto portico deck (z = 4.5..6.45)
  for (let s = 0; s < 5; s++) {
    const topY = 0.08 + s * 0.09;
    const h = 0.32;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(3.6 - s * 0.08, h, 0.48),
      s % 2 === 0 ? m.mossStoneMat : m.stoneMat
    );
    step.position.set(0, topY - h * 0.5, 6.28 - s * 0.42);
    step.receiveShadow = true;
    group.add(step);
  }

  // Portico timber pillars & gabled awning
  for (const px of [-1.75, 1.75]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.75, 0.24), m.barkMat);
    col.position.set(px, 1.78, 4.38);
    col.castShadow = true;
    group.add(col);
  }
  const porticoGableGeo = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-2.1, 0);
      s.lineTo(2.1, 0);
      s.lineTo(0, 1.45);
      s.closePath();
      return s;
    })(),
    { depth: 2.2, bevelEnabled: false }
  );
  porticoGableGeo.translate(0, 0, -1.1);
  const porticoGable = new THREE.Mesh(porticoGableGeo, m.plasterMat);
  porticoGable.position.set(0, 3.12, 3.55);
  group.add(porticoGable);

  const pRoofL = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.14, 2.45), m.shingleMat);
  pRoofL.position.set(-1.12, 3.85, 3.55);
  pRoofL.rotation.z = 0.6;
  pRoofL.castShadow = true;
  group.add(pRoofL);
  const pRoofR = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.14, 2.45), m.shingleMat);
  pRoofR.position.set(1.12, 3.85, 3.55);
  pRoofR.rotation.z = -0.6;
  pRoofR.castShadow = true;
  group.add(pRoofR);

  // Heavy Oak Entry Door Set Inside Recessed Stone Arch (Portal to cabin_interior!)
  const doorArch = new THREE.Mesh(
    createArchBlockGeometry(2.15, 2.75, 0.45, 0.72, 1.7),
    m.darkStoneMat
  );
  doorArch.position.set(0, 0.44, 2.58);
  group.add(doorArch);

  const entryDoor = new THREE.Mesh(new THREE.BoxGeometry(1.38, 2.25, 0.14), m.weatheredTimberMat);
  entryDoor.position.set(0, 1.56, 2.48);
  group.add(entryDoor);

  const doorIronRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 4, 8), m.ironMat);
  doorIronRing.position.set(0.38, 1.45, 2.58);
  group.add(doorIronRing);

  // Glowing iron hanging lantern under portico
  const lanternBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), m.ironMat);
  lanternBody.position.set(1.32, 2.65, 4.18);
  group.add(lanternBody);
  const porchGlow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), emberMat);
  porchGlow.position.set(1.32, 2.65, 4.18);
  group.add(porchGlow);
  embers.push({ ember: porchGlow, phase: 2.3 });

  // 5. Clinging Ivy, Roof Moss, Stone Yard Wall, Old Well & Woodsman Props
  addIvyStrip(group, m.ivyMat, -4.55, 2.1, 1.6, 1.4, 3.2, -Math.PI * 0.5);
  addIvyStrip(group, m.ivyMat, 4.55, 2.2, -1.8, 1.6, 3.4, Math.PI * 0.5);
  addIvyStrip(group, m.ivyMat, 5.4, 3.1, -0.65, 1.1, 3.8, Math.PI * 0.5);
  addRoofSapling(group, m.barkMat, m.foliageMat, -3.1, 5.9, -1.8, 0.85);

  // Old mossy stone well & chopping block on right yard
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.72, 7), m.mossStoneMat);
  wellBase.position.set(-5.6, 0.34, 3.2);
  wellBase.castShadow = true;
  group.add(wellBase);
  const wellVoid = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.74, 7), m.voidMat);
  wellVoid.position.set(-5.6, 0.35, 3.2);
  group.add(wellVoid);

  const chopStump = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.62, 6), m.barkMat);
  chopStump.position.set(5.45, 0.28, 2.4);
  chopStump.castShadow = true;
  group.add(chopStump);
  const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.04), m.ironMat);
  axeBlade.position.set(5.42, 0.65, 2.42);
  axeBlade.rotation.z = -0.25;
  group.add(axeBlade);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.82, 7), m.woodMat);
  barrel.position.set(3.4, 0.4, 3.2);
  barrel.castShadow = true;
  group.add(barrel);
  addWeatheredCrate(group, m.woodMat, m.barkMat, 4.2, 0.02, 3.3, 0.66, 0.35);
  addBrokenPottery(group, m.potteryMat, -2.9, 0.03, 4.1, 0.3);

  // Low ruined stone garden wall framing front yard (with wide entry path gap)
  for (const wallSide of [-1, 1] as const) {
    const lowWall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.45), m.mossStoneMat);
    lowWall.position.set(wallSide * 4.2, 0.32, 5.2);
    lowWall.castShadow = true;
    group.add(lowWall);
  }

  // 6. Colliders, Warm Light Anchors & Door Portal
  const addBox = (lx: number, lz: number, halfW: number, halfD: number, kind: BoxCollider['kind'] = 'building') => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    boxColliders.push({ cx: w.x, cz: w.z, halfW, halfD, rotY: yaw, kind });
  };
  const addCircle = (lx: number, lz: number, radius: number, kind: CircleCollider['kind'] = 'prop') => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    circleColliders.push({ x: w.x, z: w.z, radius, kind });
  };

  addBox(0, -0.35, 4.65, 2.95); // Main manor footprint
  addBox(4.85, -0.65, 0.65, 0.72); // Chimney
  addBox(-5.45, -0.6, 1.1, 1.85); // Woodshed
  addBox(-4.2, 5.2, 1.75, 0.3, 'ruin');
  addBox(4.2, 5.2, 1.75, 0.3, 'ruin');
  addCircle(-5.6, 3.2, 0.92, 'ruin');
  addCircle(5.45, 2.4, 0.48);
  addCircle(3.4, 3.2, 0.45);
  addCircle(4.2, 3.3, 0.5);

  const doorWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 3.1);
  const exitSpawnWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 5.4);
  portals.push({
    id: 'portal_cabin_enter',
    targetId: 'cabin_interior',
    x: doorWorld.x,
    y: worldY + 0.44,
    z: doorWorld.z,
    radius: 2.15,
    label: 'Enter Hollowbark Homestead',
    transitionKind: 'wood',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 5.1,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_cabin_enter',
  });

  // Store exterior return metadata cleanly on a mirror portal reference via spawnX/Z convention
  void exitSpawnWorld;

  const lanternWorld = localToWorldXZ(worldX, worldZ, yaw, 1.32, 4.25);
  lightAnchors.push({
    x: lanternWorld.x,
    y: worldY + 2.55,
    z: lanternWorld.z,
    color: '#ff9640',
    baseIntensity: 6.2,
    distance: 16,
    phase: 2.3,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION B: MOSSY BASTION & AQUEDUCT RUINS (Expanded Multi-Space Fortification + Underbastion Crypt Entrance)
 * Inspired by image_d1333899.png & image_4e52b1ea.png.
 */
export function buildAncientRuinLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  // 1. Expanded Two-Tier Flagstone Courtyard + Approach Stairs
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.48, 11.4), m.mossStoneMat);
  courtyard.position.set(0, 0.18, -0.35);
  courtyard.receiveShadow = true;
  group.add(courtyard);

  const upperDais = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 5.2), m.stoneMat);
  upperDais.position.set(0, 0.58, -3.55);
  upperDais.receiveShadow = true;
  group.add(upperDais);

  // Front mossy stairway (z = 5.3..9.2) + inner dais stairs (z = 0.15..-1.15)
  for (let s = -1; s < 6; s++) {
    const topY = 0.06 + s * 0.072;
    const h = 0.68;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(5.05 - s * 0.08, h, 0.6),
      s % 2 === 0 ? m.mossStoneMat : m.stoneMat
    );
    step.position.set(0, topY - h * 0.5, 8.2 - s * 0.52);
    step.receiveShadow = true;
    group.add(step);
  }
  for (let s = 0; s < 4; s++) {
    const topY = 0.50 + s * 0.093;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.24, 0.42), m.mossStoneMat);
    step.position.set(0, topY - 0.12, 0.04 - s * 0.36);
    step.receiveShadow = true;
    group.add(step);
  }

  for (const side of [-1, 1] as const) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 2.8), m.mossStoneMat);
    cheek.position.set(side * 2.65, 0.42, 6.4);
    cheek.rotation.x = 0.14;
    cheek.castShadow = true;
    group.add(cheek);

    const newel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.25, 0.75), m.carvedStoneMat);
    newel.position.set(side * 2.65, 0.6, 7.55);
    newel.castShadow = true;
    group.add(newel);
  }

  // 2. Monumental Three-Bay Two-Tier Stone Aqueduct Arcade along Rear (z = -5.8)
  const archSpan = 3.5;
  const pierOffsets = [-5.25, -1.75, 1.75, 5.25];
  const archTopY = 5.4;

  for (let i = 0; i < pierOffsets.length; i++) {
    const px = pierOffsets[i];
    const brokenRightEdge = i === 3;
    const h = brokenRightEdge ? 3.8 : archTopY;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.65, 1.4), m.mossStoneMat);
    plinth.position.set(px, 1.02, -5.8);
    plinth.castShadow = true;
    group.add(plinth);

    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(1.04, h - 0.8, 1.12),
      i % 2 === 0 ? m.stoneMat : m.darkStoneMat
    );
    pier.position.set(px, 1.15 + (h - 0.8) * 0.5, -5.8);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);

    if (!brokenRightEdge) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.34, 1.3), m.carvedStoneMat);
      cap.position.set(px, h + 0.25, -5.8);
      group.add(cap);
    }
  }

  const singleArchGeo = createArchBlockGeometry(archSpan, 2.5, 1.04, 1.18, 1.05);
  for (const bayX of [-3.5, 0.0]) {
    const arch = new THREE.Mesh(singleArchGeo, m.stoneMat);
    arch.position.set(bayX, 3.05, -5.8);
    arch.castShadow = true;
    arch.receiveShadow = true;
    group.add(arch);

    const entab = new THREE.Mesh(new THREE.BoxGeometry(archSpan + 0.25, 0.52, 1.25), m.carvedStoneMat);
    entab.position.set(bayX, 5.8, -5.8);
    entab.castShadow = true;
    group.add(entab);
  }
  const archStub = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.0), m.mossStoneMat);
  archStub.position.set(2.45, 5.05, -5.8);
  archStub.rotation.z = -0.35;
  group.add(archStub);

  // Upper Aqueduct Tier
  for (const px of [-5.25, -1.75]) {
    const upperPier = new THREE.Mesh(new THREE.BoxGeometry(0.84, 3.0, 0.9), m.darkStoneMat);
    upperPier.position.set(px, 7.55, -5.8);
    upperPier.castShadow = true;
    group.add(upperPier);
  }
  const upperArchGeo = createArchBlockGeometry(archSpan, 1.9, 0.86, 1.08, 0.65);
  const upperArch = new THREE.Mesh(upperArchGeo, m.mossStoneMat);
  upperArch.position.set(-3.5, 7.15, -5.8);
  upperArch.castShadow = true;
  group.add(upperArch);

  const upperCornice = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.42, 1.12), m.carvedStoneMat);
  upperCornice.position.set(-3.4, 9.2, -5.8);
  group.add(upperCornice);

  // 3. Collapsed West Bastion Drum Tower + East Sunken Crypt Gatehouse (Portal!)
  const cornerBastion = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 6.2, 7), m.darkStoneMat);
  cornerBastion.position.set(-5.85, 3.3, 0.9);
  cornerBastion.castShadow = true;
  group.add(cornerBastion);
  const bastionCap = new THREE.Mesh(new THREE.CylinderGeometry(1.88, 1.72, 0.45, 7), m.mossStoneMat);
  bastionCap.position.set(-5.85, 6.45, 0.9);
  group.add(bastionCap);

  // East Wing: Underbastion Crypt Gatehouse built into the ruin foundation (z = -3.4, x = 3.85)
  const cryptHousing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 3.2), m.darkStoneMat);
  cryptHousing.position.set(4.1, 2.4, -3.5);
  cryptHousing.castShadow = true;
  cryptHousing.receiveShadow = true;
  group.add(cryptHousing);

  const cryptArch = new THREE.Mesh(
    createArchBlockGeometry(2.8, 3.1, 0.72, 0.88, 1.65),
    m.carvedStoneMat
  );
  cryptArch.position.set(4.1, 0.78, -1.75);
  cryptArch.castShadow = true;
  group.add(cryptArch);

  const cryptGateBars = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.35, 0.16), m.voidMat);
  cryptGateBars.position.set(4.1, 1.92, -1.85);
  group.add(cryptGateBars);

  for (let b = -3; b <= 3; b++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 4), m.ironMat);
    bar.position.set(4.1 + b * 0.24, 1.92, -1.74);
    group.add(bar);
  }

  // Right flanking broken wall
  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.8, 4.4), m.stoneMat);
  wallRight.position.set(5.75, 1.65, 0.5);
  wallRight.castShadow = true;
  group.add(wallRight);

  // Broken fluted standing columns
  const standingCols = [
    { x: -3.7, z: 3.1, h: 3.55, tilt: 0.04 },
    { x: 3.8, z: 3.1, h: 2.35, tilt: -0.06 },
    { x: -1.85, z: 1.4, h: 1.75, tilt: 0.03 },
  ];
  for (const sc of standingCols) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.38, 0.96), m.mossStoneMat);
    base.position.set(sc.x, 0.58, sc.z);
    group.add(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, sc.h, 7), m.stoneMat);
    shaft.position.set(sc.x, 0.75 + sc.h * 0.5, sc.z);
    shaft.rotation.z = sc.tilt;
    shaft.castShadow = true;
    group.add(shaft);
  }

  const fallenCol = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 2.4, 7), m.stoneMat);
  fallenCol.rotation.set(0.05, 0.55, Math.PI * 0.5);
  fallenCol.position.set(1.3, 0.72, 2.4);
  fallenCol.castShadow = true;
  group.add(fallenCol);

  // 4. Gnarled Roots, Ivy, Sarcophagus & Glowing Brazier
  addCreepingRoot(
    group,
    m.barkMat,
    [
      new THREE.Vector3(-6.8, 0.2, -4.4),
      new THREE.Vector3(-5.8, 2.1, -5.0),
      new THREE.Vector3(-4.6, 4.2, -5.3),
      new THREE.Vector3(-3.0, 5.7, -5.3),
    ],
    0.18
  );
  addCreepingRoot(
    group,
    m.barkMat,
    [
      new THREE.Vector3(6.4, 0.2, -6.2),
      new THREE.Vector3(5.3, 1.8, -5.3),
      new THREE.Vector3(3.4, 1.0, -4.2),
    ],
    0.16
  );

  addIvyStrip(group, m.ivyMat, -3.5, 4.6, -5.2, 2.5, 3.6, 0);
  addIvyStrip(group, m.ivyMat, 0.0, 5.1, -5.2, 2.1, 3.0, 0);
  addIvyStrip(group, m.ivyMat, 4.1, 2.8, -1.35, 2.2, 2.4, 0);
  addRoofSapling(group, m.barkMat, m.foliageMat, -4.8, 9.35, -5.8, 1.25);
  addRoofSapling(group, m.barkMat, m.foliageMat, -5.7, 6.65, 0.9, 1.05);

  const sarcophagus = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 1.02), m.carvedStoneMat);
  sarcophagus.position.set(-1.8, 1.14, -3.4);
  sarcophagus.rotation.y = 0.14;
  sarcophagus.castShadow = true;
  group.add(sarcophagus);

  addBrokenPottery(group, m.potteryMat, 4.6, 0.42, 1.2, 0.25);

  // Brazier lighting the Crypt Entrance!
  const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.22, 0.3, 6), m.ironMat);
  brazierBowl.position.set(2.35, 1.48, -1.6);
  group.add(brazierBowl);
  const brazierPed = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.18, 0.75, 5), m.ironMat);
  brazierPed.position.set(2.35, 1.05, -1.6);
  group.add(brazierPed);
  const ember = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color: '#ff8a33' })
  );
  ember.scale.set(1.15, 0.58, 1.15);
  ember.position.set(2.35, 1.7, -1.6);
  group.add(ember);
  embers.push({ ember, phase: 4.1 });

  // 5. Colliders & Crypt Portal
  const addBox = (lx: number, lz: number, halfW: number, halfD: number) => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    boxColliders.push({ cx: w.x, cz: w.z, halfW, halfD, rotY: yaw, kind: 'ruin' });
  };
  const addCircle = (lx: number, lz: number, radius: number, kind: CircleCollider['kind'] = 'ruin') => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    circleColliders.push({ x: w.x, z: w.z, radius, kind });
  };

  for (const px of pierOffsets) addBox(px, -5.8, 0.72, 0.75);
  addBox(4.1, -3.5, 1.75, 1.65); // Crypt gatehouse
  addBox(5.75, 0.5, 0.55, 2.25);
  addBox(-2.65, 6.4, 0.38, 1.45);
  addBox(2.65, 6.4, 0.38, 1.45);
  addBox(-1.8, -3.4, 1.15, 0.6);
  addCircle(-5.85, 0.9, 2.05);
  for (const sc of standingCols) addCircle(sc.x, sc.z, 0.62);
  addCircle(1.3, 2.4, 0.75);
  addCircle(2.35, -1.6, 0.52, 'prop');

  const cryptPortalWorld = localToWorldXZ(worldX, worldZ, yaw, 4.1, -1.15);
  portals.push({
    id: 'portal_catacombs_enter',
    targetId: 'dungeon_catacombs',
    x: cryptPortalWorld.x,
    y: worldY + 0.78,
    z: cryptPortalWorld.z,
    radius: 2.3,
    label: 'Descend into Underbastion Catacombs',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 8.5,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_catacombs_enter',
  });

  const bWorld = localToWorldXZ(worldX, worldZ, yaw, 2.35, -1.6);
  lightAnchors.push({
    x: bWorld.x,
    y: worldY + 2.0,
    z: bWorld.z,
    color: '#ff8a33',
    baseIntensity: 7.5,
    distance: 19,
    phase: 4.1,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION C: SANCTUM OF WHISPERING ROOTS (Enlarged Stepped Temple & Explorable Inner Shrine)
 */
export function buildAncientShrineLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  const runeGlowMat = new THREE.MeshBasicMaterial({ color: '#b56d2c' });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff9d42' });

  // 1. Broad Forecourt & Monumental Approach Stairs
  const forecourt = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.46, 9.6), m.mossStoneMat);
  forecourt.position.set(0, 0.19, -0.6);
  forecourt.receiveShadow = true;
  group.add(forecourt);

  for (let s = 0; s < 6; s++) {
    const topY = 0.07 + s * 0.07;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.34, 0.58),
      s % 2 === 0 ? m.mossStoneMat : m.stoneMat
    );
    step.position.set(0, topY - 0.17, 7.2 - s * 0.54);
    step.receiveShadow = true;
    group.add(step);
  }

  for (const side of [-1, 1] as const) {
    const bal = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 3.0), m.mossStoneMat);
    bal.position.set(side * 2.48, 0.4, 5.5);
    bal.rotation.x = 0.13;
    group.add(bal);
  }

  // 2. Towering Carved Sanctuary Temple Façade (7.8m wide x 6.8m high!)
  const sanctumPodium = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.92, 4.6), m.darkStoneMat);
  sanctumPodium.position.set(0, 0.84, -3.7);
  sanctumPodium.receiveShadow = true;
  sanctumPodium.castShadow = true;
  group.add(sanctumPodium);

  for (let s = 0; s < 5; s++) {
    const topY = 0.56 + s * 0.18;
    const pStep = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 0.44), m.mossStoneMat);
    pStep.position.set(0, topY - 0.14, -0.3 - s * 0.36);
    pStep.receiveShadow = true;
    group.add(pStep);
  }

  const innerChamber = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.1, 3.4), m.darkStoneMat);
  innerChamber.position.set(0, 3.15, -4.15);
  innerChamber.castShadow = true;
  innerChamber.receiveShadow = true;
  group.add(innerChamber);

  const portalVoid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.85, 0.5), m.voidMat);
  portalVoid.position.set(0, 2.55, -2.55);
  group.add(portalVoid);

  // Carved sanctuary double stone doors slightly recessed inside portal
  const sanctumDoor = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.65, 0.22), m.carvedStoneMat);
  sanctumDoor.position.set(0, 2.5, -2.62);
  group.add(sanctumDoor);

  const portalArch = new THREE.Mesh(
    createArchBlockGeometry(3.2, 3.4, 0.8, 0.96, 1.9),
    m.carvedStoneMat
  );
  portalArch.position.set(0, 1.25, -2.35);
  portalArch.castShadow = true;
  group.add(portalArch);

  for (const px of [-3.35, -1.85, 1.85, 3.35]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 3.3, 0.56), m.carvedStoneMat);
    pillar.position.set(px, 2.9, -2.15);
    pillar.castShadow = true;
    group.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.76), m.stoneMat);
    cap.position.set(px, 4.6, -2.15);
    group.add(cap);
  }

  const frieze = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.75, 4.35), m.carvedStoneMat);
  frieze.position.set(0, 5.1, -3.7);
  frieze.castShadow = true;
  group.add(frieze);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.48, 4.7), m.mossStoneMat);
  cornice.position.set(0, 5.68, -3.7);
  cornice.castShadow = true;
  group.add(cornice);

  const upperCrown = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.05, 2.9), m.darkStoneMat);
  upperCrown.position.set(0, 6.4, -3.8);
  upperCrown.castShadow = true;
  group.add(upperCrown);

  addRoofSapling(group, m.barkMat, m.foliageMat, -2.8, 5.9, -3.1, 1.15);
  addRoofSapling(group, m.barkMat, m.foliageMat, 2.6, 5.9, -3.8, 0.95);
  addIvyStrip(group, m.ivyMat, -2.6, 4.1, -1.65, 1.5, 2.8, 0);
  addIvyStrip(group, m.ivyMat, 2.6, 4.0, -1.65, 1.5, 2.8, 0);

  // 3. Carved Stone Altar in Forecourt Entangled in Creeping Roots
  const altarZ = 1.1;
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.32, 2.05), m.mossStoneMat);
  altarBase.position.set(0, 0.54, altarZ);
  altarBase.receiveShadow = true;
  group.add(altarBase);

  const altarPed = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.92, 1.2), m.carvedStoneMat);
  altarPed.position.set(0, 1.1, altarZ);
  altarPed.castShadow = true;
  group.add(altarPed);

  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 1.52), m.carvedStoneMat);
  altarTop.position.set(0, 1.66, altarZ);
  altarTop.castShadow = true;
  group.add(altarTop);

  const runeInlay = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.56), runeGlowMat);
  runeInlay.position.set(0, 1.65, altarZ);
  group.add(runeInlay);

  const altarEmber = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), flameMat);
  altarEmber.scale.set(1.1, 0.65, 1.1);
  altarEmber.position.set(0, 1.92, altarZ);
  group.add(altarEmber);
  embers.push({ ember: altarEmber, phase: 1.7 });

  addCreepingRoot(
    group,
    m.barkMat,
    [
      new THREE.Vector3(-2.6, 0.32, 2.4),
      new THREE.Vector3(-1.4, 0.8, 1.6),
      new THREE.Vector3(-0.9, 1.65, 1.25),
      new THREE.Vector3(-0.65, 1.75, 0.65),
    ],
    0.14
  );
  addCreepingRoot(
    group,
    m.barkMat,
    [
      new THREE.Vector3(2.4, 0.3, 0.2),
      new THREE.Vector3(1.3, 0.9, 0.65),
      new THREE.Vector3(0.9, 1.65, 1.05),
    ],
    0.13
  );

  // 4. Hooded Sentinel Statues Flanking Steps
  function buildHoodedSentinel(scale = 1): THREE.Group {
    const s = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.6, 1.05), m.mossStoneMat);
    plinth.position.y = 0.3;
    plinth.castShadow = true;
    s.add(plinth);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 1.6, 6), m.stoneMat);
    robe.position.y = 1.38;
    robe.castShadow = true;
    s.add(robe);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.56, 6), m.stoneMat);
    hood.position.set(0, 2.38, 0.04);
    hood.rotation.x = 0.22;
    s.add(hood);
    s.scale.setScalar(scale);
    return s;
  }

  const sentinelSpecs = [
    { x: -3.4, z: 5.2, rot: 0.35, s: 1.12 },
    { x: 3.4, z: 5.2, rot: -0.35, s: 1.12 },
    { x: -3.85, z: 1.6, rot: 0.72, s: 1.0 },
    { x: 3.85, z: 1.6, rot: -0.72, s: 1.0 },
  ];
  for (const sp of sentinelSpecs) {
    const stat = buildHoodedSentinel(sp.s);
    stat.position.set(sp.x, 0.18, sp.z);
    stat.rotation.y = sp.rot;
    group.add(stat);
  }

  // Colliders & Sanctuary Portal
  const addBox = (lx: number, lz: number, halfW: number, halfD: number) => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    boxColliders.push({ cx: w.x, cz: w.z, halfW, halfD, rotY: yaw, kind: 'ruin' });
  };
  const addCircle = (lx: number, lz: number, radius: number) => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    circleColliders.push({ x: w.x, z: w.z, radius, kind: 'ruin' });
  };

  addBox(0, -4.1, 4.1, 1.75); // Sanctuary building
  addBox(0, altarZ, 1.35, 1.02); // Altar
  addBox(-2.48, 5.5, 0.3, 1.5);
  addBox(2.48, 5.5, 0.3, 1.5);
  for (const sp of sentinelSpecs) addCircle(sp.x, sp.z, 0.65);

  const portalWorld = localToWorldXZ(worldX, worldZ, yaw, 0, -2.0);
  portals.push({
    id: 'portal_shrine_enter',
    targetId: 'shrine_interior',
    x: portalWorld.x,
    y: worldY + 1.3,
    z: portalWorld.z,
    radius: 2.3,
    label: 'Enter Sanctum of Whispering Roots',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 8.8,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_shrine_enter',
  });

  const lWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 0.2);
  lightAnchors.push({
    x: lWorld.x,
    y: worldY + 2.25,
    z: lWorld.z,
    color: '#f28b35',
    baseIntensity: 6.4,
    distance: 18,
    phase: 6.4,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION D: GREYWATCH TOWER (Enlarged Tapered Stone Watchtower / Belfry + Multi-Floor Interior)
 * Directly inspired by image_7f78e7c0.png & image_4e52b1ea.png:
 * Thick battered square stone tower with stepped corner buttresses, tall recessed gothic arched entry portal,
 * narrower octagonal upper observation turret crown, broken parapet & ruined flanking curtain wall.
 */
export function buildMedievalTowerLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  // 1. Broad Hilltop Flagstone Terrace & Mossy Approach Steps
  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.8, 0.78, 8), m.mossStoneMat);
  terrace.position.set(0, 0.24, -0.4);
  terrace.receiveShadow = true;
  group.add(terrace);

  for (let s = 0; s < 10; s++) {
    const topY = 0.56 - s * 0.14;
    const stairZ = 4.05 + s * 0.76;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(3.1 - s * 0.05, 0.36, 0.84),
      s % 2 === 0 ? m.mossStoneMat : m.stoneMat
    );
    tread.position.set(Math.sin(s * 0.25) * 0.15, topY - 0.18, stairZ);
    tread.receiveShadow = true;
    group.add(tread);
  }

  // 2. Massive Tapered Square Keep Base + Stepped Stone Buttresses (image_7f78e7c0.png!)
  const keepBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.15, 11.4, 4), m.stoneMat);
  keepBase.rotation.y = Math.PI * 0.25;
  keepBase.position.set(0, 6.2, -0.75);
  keepBase.castShadow = true;
  keepBase.receiveShadow = true;
  group.add(keepBase);

  // Stepped masonry buttresses on the four corners / front piers
  for (const bx of [-2.45, 2.45]) {
    const buttressLow = new THREE.Mesh(new THREE.BoxGeometry(1.18, 4.4, 1.35), m.mossStoneMat);
    buttressLow.position.set(bx, 2.6, 2.05);
    buttressLow.castShadow = true;
    group.add(buttressLow);

    const buttressMid = new THREE.Mesh(new THREE.BoxGeometry(0.95, 4.2, 1.05), m.stoneMat);
    buttressMid.position.set(bx * 0.92, 6.8, 1.78);
    buttressMid.castShadow = true;
    group.add(buttressMid);
  }

  // Tall Recessed Gothic Arched Entryway Portal (front face, z = 2.0)
  const portalFrame = new THREE.Mesh(
    createArchBlockGeometry(3.8, 5.2, 1.15, 1.18, 3.1),
    m.carvedStoneMat
  );
  portalFrame.position.set(0, 0.6, 2.02);
  portalFrame.castShadow = true;
  group.add(portalFrame);

  const portalVoid = new THREE.Mesh(new THREE.BoxGeometry(2.15, 3.9, 0.45), m.voidMat);
  portalVoid.position.set(0, 2.45, 1.72);
  group.add(portalVoid);

  // Studded Iron-Bound Oak Tower Doors
  const towerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.95, 3.15, 0.16), m.weatheredTimberMat);
  towerDoor.position.set(0, 2.15, 1.85);
  group.add(towerDoor);
  const doorStrap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.2), m.ironMat);
  doorStrap.position.set(0, 1.65, 1.85);
  group.add(doorStrap);

  // Upper Platform Stringcourse + Narrower Octagonal Belfry Observation Turret (image_7f78e7c0.png)
  const midDeck = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.55, 5.35), m.darkStoneMat);
  midDeck.position.set(0, 11.95, -0.75);
  midDeck.castShadow = true;
  group.add(midDeck);

  // Broken parapet teeth around mid observation ledge
  for (const [mx, mz, mh] of [
    [-2.4, 1.65, 0.85],
    [0.0, 1.65, 0.65],
    [2.4, 1.65, 0.95],
    [-2.4, -3.15, 0.9],
    [2.4, -3.15, 0.72],
  ]) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.85, mh, 0.48), m.mossStoneMat);
    merlon.position.set(mx, 12.22 + mh * 0.5, mz);
    group.add(merlon);
  }

  // Narrower Octagonal Upper Observation Turret (y = 12.2 .. 18.6)
  const upperDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.02, 6.2, 8), m.stoneMat);
  upperDrum.position.set(0, 15.3, -0.75);
  upperDrum.castShadow = true;
  group.add(upperDrum);

  const upperCorbel = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 1.78, 0.52, 8), m.darkStoneMat);
  upperCorbel.position.set(0, 18.5, -0.75);
  group.add(upperCorbel);

  for (let i = 0; i < 6; i++) {
    if (i === 4) continue; // shattered battlement gap
    const a = (i / 6) * Math.PI * 2;
    const mh = 0.78 + (i % 2) * 0.48;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.7, mh, 0.45), m.mossStoneMat);
    tooth.position.set(Math.cos(a) * 1.76, 18.75 + mh * 0.5, -0.75 + Math.sin(a) * 1.76);
    tooth.rotation.y = -a;
    group.add(tooth);
  }

  // Recessed arched lookout slits on square keep & upper turret
  const midWindow = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.35), m.voidMat);
  midWindow.position.set(0, 9.2, 1.48);
  group.add(midWindow);
  const topSlit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.35), m.voidMat);
  topSlit.position.set(0, 15.8, 1.12);
  group.add(topSlit);

  // Flanking ruined curtain wall spur & lower round turret stump
  const sideCurtain = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 1.05), m.darkStoneMat);
  sideCurtain.position.set(-4.35, 2.2, -0.85);
  sideCurtain.rotation.y = 0.25;
  sideCurtain.castShadow = true;
  group.add(sideCurtain);

  const cornerTurret = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 4.8, 7), m.mossStoneMat);
  cornerTurret.position.set(-5.85, 2.8, -0.2);
  cornerTurret.castShadow = true;
  group.add(cornerTurret);

  // Clinging ivy & saplings
  addIvyStrip(group, m.ivyMat, -1.8, 5.2, 2.22, 1.5, 6.2, -0.15);
  addIvyStrip(group, m.ivyMat, 1.9, 4.6, 2.22, 1.3, 5.2, 0.15);
  addRoofSapling(group, m.barkMat, m.foliageMat, -2.1, 12.2, -1.6, 1.05);
  addRoofSapling(group, m.barkMat, m.foliageMat, 0.5, 18.75, -0.9, 0.95);

  // Watch-brazier & props
  const brazierStand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.18, 0.9, 5), m.ironMat);
  brazierStand.position.set(1.85, 1.02, 3.15);
  group.add(brazierStand);
  const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.26, 6), m.ironMat);
  brazierBowl.position.set(1.85, 1.52, 3.15);
  group.add(brazierBowl);
  const ember = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.2, 0),
    new THREE.MeshBasicMaterial({ color: '#ff8a34' })
  );
  ember.scale.set(1.15, 0.6, 1.15);
  ember.position.set(1.85, 1.7, 3.15);
  group.add(ember);
  embers.push({ ember, phase: 7.2 });

  addWeatheredCrate(group, m.woodMat, m.barkMat, -2.05, 0.62, 3.1, 0.66, 0.35);
  addBrokenPottery(group, m.potteryMat, 2.45, 0.62, 2.85, -0.2);

  // Colliders & Tower Portal
  const addBox = (lx: number, lz: number, halfW: number, halfD: number) => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    boxColliders.push({ cx: w.x, cz: w.z, halfW, halfD, rotY: yaw, kind: 'ruin' });
  };
  const addCircle = (lx: number, lz: number, radius: number, kind: CircleCollider['kind'] = 'ruin') => {
    const w = localToWorldXZ(worldX, worldZ, yaw, lx, lz);
    circleColliders.push({ x: w.x, z: w.z, radius, kind });
  };

  addBox(0, -0.75, 3.05, 2.85);
  addBox(-4.35, -0.85, 1.65, 0.72);
  addCircle(-5.85, -0.2, 1.45);
  addCircle(-2.05, 3.1, 0.52, 'prop');
  addCircle(1.85, 3.15, 0.48, 'prop');

  const portalWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 2.55);
  portals.push({
    id: 'portal_tower_enter',
    targetId: 'tower_interior',
    x: portalWorld.x,
    y: worldY + 0.6,
    z: portalWorld.z,
    radius: 2.35,
    label: 'Enter Greywatch Tower',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 3.1,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_tower_enter',
  });

  const bWorld = localToWorldXZ(worldX, worldZ, yaw, 1.85, 3.15);
  lightAnchors.push({
    x: bWorld.x,
    y: worldY + 2.0,
    z: bWorld.z,
    color: '#ff8a33',
    baseIntensity: 6.4,
    distance: 18,
    phase: 7.2,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION E: ELDERWOOD COTTAGE (Small Rustic Timber & Stone House Built Around an Ancient Tree)
 * Distinct silhouette: gnarled ancient tree trunks & roots growing straight through the cottage corner & roof.
 */
export function buildWoodlandCottageLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  // Stone foundation & wooden stoop
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.44, 4.6), m.mossStoneMat);
  base.position.set(0, 0.2, 0);
  base.receiveShadow = true;
  group.add(base);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.3), m.woodMat);
  porch.position.set(0, 0.14, 2.7);
  porch.receiveShadow = true;
  group.add(porch);

  const stepLow = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 0.46), m.mossStoneMat);
  stepLow.position.set(0, 0.0, 3.85);
  stepLow.receiveShadow = true;
  group.add(stepLow);

  const stepMid = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.22, 0.44), m.woodMat);
  stepMid.position.set(0, 0.09, 3.48);
  stepMid.receiveShadow = true;
  group.add(stepMid);

  // Timber & stone cottage walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.55, 4.2), m.weatheredTimberMat);
  walls.position.set(0, 1.65, 0);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Pitched shingle roof
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.16, 4.8), m.shingleMat);
  roofL.position.set(-1.32, 3.65, 0);
  roofL.rotation.z = 0.65;
  roofL.castShadow = true;
  group.add(roofL);
  const roofR = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.16, 4.8), m.shingleMat);
  roofR.position.set(1.32, 3.65, 0);
  roofR.rotation.z = -0.65;
  roofR.castShadow = true;
  group.add(roofR);

  // Massive Gnarled Ancient Host Tree Woven Around & Through the West Corner!
  const treeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.65, 0, -1.35),
    new THREE.Vector3(-2.45, 2.2, -1.1),
    new THREE.Vector3(-1.85, 4.3, -0.65),
    new THREE.Vector3(-1.15, 6.2, -0.2),
  ]);
  const treeTrunk = new THREE.Mesh(new THREE.TubeGeometry(treeCurve, 8, 0.52, 6, false), m.barkMat);
  treeTrunk.castShadow = true;
  group.add(treeTrunk);

  for (const [cx, cy, cz, r] of [
    [-1.2, 6.8, -0.2, 2.25],
    [-2.5, 5.9, -0.8, 1.75],
    [0.2, 6.4, 0.1, 1.65],
  ]) {
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m.foliageMat);
    crown.scale.set(1.25, 0.72, 1.15);
    crown.position.set(cx, cy, cz);
    crown.castShadow = true;
    group.add(crown);
  }
  addCreepingRoot(
    group,
    m.barkMat,
    [
      new THREE.Vector3(-2.65, 0.9, -1.2),
      new THREE.Vector3(-3.35, 0.35, 0.2),
      new THREE.Vector3(-2.95, 0.08, 1.75),
    ],
    0.18
  );

  // Chimney + door + glowing window
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.85, 4.6, 0.85), m.stoneMat);
  chimney.position.set(2.45, 2.3, -0.95);
  chimney.castShadow = true;
  group.add(chimney);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.25, 0.2), m.barkMat);
  doorFrame.position.set(0, 1.5, 2.12);
  group.add(doorFrame);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.14, 2.05, 0.12), m.woodMat);
  doorPanel.position.set(0, 1.44, 2.18);
  group.add(doorPanel);

  addGlowWindow(group, m.barkMat, m.warmWindowMat, 1.6, 1.75, 2.12, 0.8, 0.82, 0);
  addGlowWindow(group, m.barkMat, m.warmWindowMat, -1.55, 1.75, 2.12, 0.8, 0.82, 0);
  addIvyStrip(group, m.ivyMat, 2.66, 1.6, 0.2, 1.6, 2.3, Math.PI * 0.5);

  const lanternGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.14),
    new THREE.MeshBasicMaterial({ color: '#ff9640' })
  );
  lanternGlow.position.set(-0.9, 2.3, 2.35);
  group.add(lanternGlow);
  embers.push({ ember: lanternGlow, phase: 3.4 });

  // Colliders & Portal
  const wCenter = localToWorldXZ(worldX, worldZ, yaw, 0, 0);
  boxColliders.push({ cx: wCenter.x, cz: wCenter.z, halfW: 2.8, halfD: 2.2, rotY: yaw, kind: 'building' });
  const tWorld = localToWorldXZ(worldX, worldZ, yaw, -2.65, -1.35);
  circleColliders.push({ x: tWorld.x, z: tWorld.z, radius: 0.95, kind: 'tree' });

  const portalWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 2.65);
  portals.push({
    id: 'portal_cottage_enter',
    targetId: 'cottage_interior',
    x: portalWorld.x,
    y: worldY + 0.28,
    z: portalWorld.z,
    radius: 2.15,
    label: 'Enter Elderwood Cottage',
    transitionKind: 'wood',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 4.3,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_cottage_enter',
  });

  lightAnchors.push({
    x: portalWorld.x,
    y: worldY + 2.2,
    z: portalWorld.z,
    color: '#ff9038',
    baseIntensity: 5.2,
    distance: 14,
    phase: 3.4,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION F: NATURAL / HUMID / ANCIENT CAVE MOUTH ENTRANCES (3 Distinct Subterranean Openings)
 */
export function buildCaveEntranceLocation(
  textures: ProceduralTextures,
  kind: 'crag' | 'weeping' | 'ancient',
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  // Backing dark cavern rock cliff mass (so entrance reads as opening into a real rock bluff)
  const bluffBack = new THREE.Mesh(
    new THREE.DodecahedronGeometry(4.6, 1),
    kind === 'weeping' ? m.mossStoneMat : m.caveRockMat
  );
  bluffBack.scale.set(1.35, 1.05, 0.95);
  bluffBack.position.set(0, 2.35, -3.1);
  bluffBack.castShadow = true;
  bluffBack.receiveShadow = true;
  group.add(bluffBack);

  for (const side of [-1, 1] as const) {
    const flankRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.6, 0),
      kind === 'weeping' ? m.mossStoneMat : m.caveRockMat
    );
    flankRock.scale.set(1.05, 1.15, 1.25);
    flankRock.position.set(side * 2.55, 1.55, -0.75);
    flankRock.rotation.set(0.2 * side, side * 0.6, 0.15);
    flankRock.castShadow = true;
    group.add(flankRock);
  }

  const lintelRock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.35, 0), m.caveRockMat);
  lintelRock.scale.set(1.65, 0.72, 1.15);
  lintelRock.position.set(0, 3.35, -0.95);
  lintelRock.castShadow = true;
  group.add(lintelRock);

  // Dark receding cave void mouth
  const caveVoid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.75, 1.9), m.voidMat);
  caveVoid.position.set(0, 1.32, -1.25);
  group.add(caveVoid);

  if (kind === 'crag') {
    // Broken mine timber brace + abandoned miner's lantern outside
    for (const sx of [-1.25, 1.25]) {
      const propPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.6, 5), m.barkMat);
      propPost.position.set(sx, 1.3, 0.25);
      propPost.rotation.z = sx < 0 ? -0.1 : 0.1;
      group.add(propPost);
    }
    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 0.22), m.barkMat);
    headerBeam.position.set(0, 2.55, 0.25);
    group.add(headerBeam);
    addWeatheredCrate(group, m.woodMat, m.barkMat, -2.0, 0.0, 1.2, 0.62, 0.4);

    const glow = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: '#ff9640' })
    );
    glow.position.set(1.38, 0.42, 0.9);
    group.add(glow);
    embers.push({ ember: glow, phase: 1.4 });
    const lw = localToWorldXZ(worldX, worldZ, yaw, 1.38, 0.9);
    lightAnchors.push({ x: lw.x, y: worldY + 0.7, z: lw.z, color: '#ff9038', baseIntensity: 4.8, distance: 12, phase: 1.4 });
  } else if (kind === 'weeping') {
    // Hanging lianas, mossy damp pool threshold & soft cyan-green glowing fungal caps
    addIvyStrip(group, m.ivyMat, -0.7, 2.55, 0.22, 1.2, 1.8, 0);
    addIvyStrip(group, m.ivyMat, 0.85, 2.4, 0.22, 1.1, 1.6, 0);

    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 10),
      new THREE.MeshLambertMaterial({ color: '#1b2b2c', transparent: true, opacity: 0.85 })
    );
    puddle.rotation.x = -Math.PI * 0.5;
    puddle.position.set(0, 0.04, 1.45);
    group.add(puddle);

    const sporeMat = new THREE.MeshBasicMaterial({ color: '#6cb89c' });
    for (const [fx, fy, fz] of [
      [-1.35, 0.25, 0.6],
      [1.45, 0.35, 0.4],
      [-1.1, 0.18, 1.2],
    ]) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 5), sporeMat);
      cap.position.set(fx, fy, fz);
      group.add(cap);
    }
    const lw = localToWorldXZ(worldX, worldZ, yaw, 0, 0.8);
    lightAnchors.push({ x: lw.x, y: worldY + 0.8, z: lw.z, color: '#6cb89c', baseIntensity: 3.4, distance: 11, phase: 2.9 });
  } else {
    // Ancient Cave: colossal twisted tree roots arching over sunken carved megalithic doorway
    const lintelStone = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.62, 0.9), m.carvedStoneMat);
    lintelStone.position.set(0, 2.45, 0.12);
    lintelStone.rotation.z = -0.04;
    group.add(lintelStone);
    for (const sx of [-1.3, 1.3]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.4, 0.82), m.carvedStoneMat);
      jamb.position.set(sx, 1.2, 0.12);
      group.add(jamb);
    }
    addCreepingRoot(
      group,
      m.barkMat,
      [
        new THREE.Vector3(-2.9, 0.0, 1.5),
        new THREE.Vector3(-2.1, 2.1, 0.6),
        new THREE.Vector3(0.0, 3.6, 0.1),
        new THREE.Vector3(2.4, 1.9, 0.5),
        new THREE.Vector3(3.1, 0.0, 1.4),
      ],
      0.28
    );
    const lw = localToWorldXZ(worldX, worldZ, yaw, 0, 0.6);
    lightAnchors.push({ x: lw.x, y: worldY + 1.2, z: lw.z, color: '#d98a42', baseIntensity: 4.0, distance: 12, phase: 5.1 });
  }

  // Colliders around side cliff shoulders (leaving center cave mouth unobstructed!)
  const wBack = localToWorldXZ(worldX, worldZ, yaw, 0, -2.5);
  boxColliders.push({ cx: wBack.x, cz: wBack.z, halfW: 4.4, halfD: 1.9, rotY: yaw, kind: 'ruin' });
  for (const side of [-1, 1] as const) {
    const wFlank = localToWorldXZ(worldX, worldZ, yaw, side * 2.55, -0.5);
    circleColliders.push({ x: wFlank.x, z: wFlank.z, radius: 1.55, kind: 'rock' });
  }

  const portalWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 0.85);
  const portalMap = {
    crag: {
      id: 'portal_cave_crag_enter',
      targetId: 'cave_cragstone' as const,
      label: 'Enter Cragstone Cavern',
      spawnZ: 10.2,
    },
    weeping: {
      id: 'portal_cave_weeping_enter',
      targetId: 'cave_weeping' as const,
      label: 'Enter Weeping Hollow Grotto',
      spawnZ: 8.8,
    },
    ancient: {
      id: 'portal_cave_ancient_enter',
      targetId: 'cave_ancient' as const,
      label: 'Enter Sunken Barrow Cavern',
      spawnZ: 9.2,
    },
  }[kind];

  portals.push({
    id: portalMap.id,
    targetId: portalMap.targetId,
    x: portalWorld.x,
    y: worldY,
    z: portalWorld.z,
    radius: 2.35,
    label: portalMap.label,
    transitionKind: 'cave',
    spawnX: 0,
    spawnY: 0,
    spawnZ: portalMap.spawnZ,
    spawnYaw: Math.PI,
    returnDoorId: portalMap.id,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}

/**
 * LOCATION G: SUNKEN CITADEL GATE (Monumental Cliffside Dungeon Entrance overlooking Silvermire)
 */
export function buildDungeonCliffGateLocation(
  textures: ProceduralTextures,
  worldX: number,
  worldY: number,
  worldZ: number,
  yaw: number
): BuiltLandmark {
  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);
  group.rotation.y = yaw;

  const boxColliders: BoxCollider[] = [];
  const circleColliders: CircleCollider[] = [];
  const embers: { ember: THREE.Mesh; phase: number }[] = [];
  const lightAnchors: LightAnchor[] = [];
  const portals: PortalLink[] = [];
  const m = createSharedArchMaterials(textures);

  // Backing cliff stone wall & stepped approach terrace
  const cliffBack = new THREE.Mesh(new THREE.DodecahedronGeometry(4.9, 0), m.darkStoneMat);
  cliffBack.scale.set(1.45, 1.25, 0.9);
  cliffBack.position.set(0, 2.8, -3.1);
  cliffBack.castShadow = true;
  group.add(cliffBack);

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.38, 4.4), m.mossStoneMat);
  threshold.position.set(0, 0.16, 1.2);
  threshold.receiveShadow = true;
  group.add(threshold);

  for (let s = 0; s < 2; s++) {
    const topY = 0.12 + s * 0.12;
    const cStep = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 0.56), m.stoneMat);
    cStep.position.set(0, topY - 0.14, 4.1 - s * 0.48);
    cStep.receiveShadow = true;
    group.add(cStep);
  }

  // Monumental carved gate piers & gothic arch
  const gateArch = new THREE.Mesh(
    createArchBlockGeometry(4.8, 4.6, 1.35, 1.32, 2.25),
    m.carvedStoneMat
  );
  gateArch.position.set(0, 0.3, -0.35);
  gateArch.castShadow = true;
  group.add(gateArch);

  const gateVoid = new THREE.Mesh(new THREE.BoxGeometry(2.45, 3.2, 0.6), m.voidMat);
  gateVoid.position.set(0, 1.8, -0.65);
  group.add(gateVoid);

  const ironDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.95, 0.18), m.weatheredTimberMat);
  ironDoor.position.set(0, 1.7, -0.42);
  group.add(ironDoor);

  for (const side of [-1, 1] as const) {
    const bastion = new THREE.Mesh(new THREE.BoxGeometry(1.65, 5.2, 2.2), m.stoneMat);
    bastion.position.set(side * 2.95, 2.6, -0.65);
    bastion.castShadow = true;
    group.add(bastion);

    // Iron braziers guarding threshold
    const bPed = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.85, 5), m.ironMat);
    bPed.position.set(side * 2.1, 0.72, 1.35);
    group.add(bPed);
    const bBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.26, 6), m.ironMat);
    bBowl.position.set(side * 2.1, 1.22, 1.35);
    group.add(bBowl);
    const ember = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: '#ff8a34' })
    );
    ember.scale.set(1.1, 0.6, 1.1);
    ember.position.set(side * 2.1, 1.4, 1.35);
    group.add(ember);
    embers.push({ ember, phase: 2.2 + side });
  }

  addIvyStrip(group, m.ivyMat, -2.5, 3.2, 0.55, 1.6, 3.4, 0);
  addIvyStrip(group, m.ivyMat, 2.4, 2.9, 0.55, 1.5, 3.0, 0);
  addRoofSapling(group, m.barkMat, m.foliageMat, -2.8, 5.2, -0.6, 1.0);

  const wBack = localToWorldXZ(worldX, worldZ, yaw, 0, -2.2);
  boxColliders.push({ cx: wBack.x, cz: wBack.z, halfW: 4.5, halfD: 1.9, rotY: yaw, kind: 'ruin' });
  for (const side of [-1, 1] as const) {
    const wBast = localToWorldXZ(worldX, worldZ, yaw, side * 2.95, -0.65);
    boxColliders.push({ cx: wBast.x, cz: wBast.z, halfW: 0.95, halfD: 1.15, rotY: yaw, kind: 'ruin' });
  }

  const portalWorld = localToWorldXZ(worldX, worldZ, yaw, 0, 1.15);
  portals.push({
    id: 'portal_vault_enter',
    targetId: 'dungeon_vault',
    x: portalWorld.x,
    y: worldY + 0.35,
    z: portalWorld.z,
    radius: 2.35,
    label: 'Enter Sunken Citadel Vault',
    transitionKind: 'stone',
    spawnX: 0,
    spawnY: 0,
    spawnZ: 12.2,
    spawnYaw: Math.PI,
    returnDoorId: 'portal_vault_enter',
  });

  const lw = localToWorldXZ(worldX, worldZ, yaw, 0, 1.4);
  lightAnchors.push({
    x: lw.x,
    y: worldY + 1.85,
    z: lw.z,
    color: '#ff8a33',
    baseIntensity: 6.5,
    distance: 18,
    phase: 2.8,
  });

  return { group, boxColliders, circleColliders, embers, lightAnchors, portals };
}
