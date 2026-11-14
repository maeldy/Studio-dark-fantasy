import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SplitTreeGeo {
  woodGeo: THREE.BufferGeometry;
  foliageGeo: THREE.BufferGeometry;
}

export interface DecayingLogGeo {
  woodGeo: THREE.BufferGeometry;
  mossGeo: THREE.BufferGeometry;
}

function prepGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  if (nonIndexed !== geo) geo.dispose();

  if (!nonIndexed.attributes.normal) {
    nonIndexed.computeVertexNormals();
  }
  if (!nonIndexed.attributes.uv) {
    const count = nonIndexed.attributes.position.count;
    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  for (const name of Object.keys(nonIndexed.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') {
      nonIndexed.deleteAttribute(name);
    }
  }
  return nonIndexed;
}

function mergeClean(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map(prepGeo);
  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function hashCoord(x: number, y: number, z: number, seed: number): number {
  const ix = Math.round(x * 40);
  const iy = Math.round(y * 40);
  const iz = Math.round(z * 40);
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1274126177) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function jitterGeometry(
  geo: THREE.BufferGeometry,
  ampXZ: number,
  ampY: number,
  seed: number,
  minY = -Infinity
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < minY) continue;
    const rx = (hashCoord(x, y, z, seed) - 0.5) * 2 * ampXZ;
    const ry = (hashCoord(x, y, z, seed + 17) - 0.5) * 2 * ampY;
    const rz = (hashCoord(x, y, z, seed + 53) - 0.5) * 2 * ampXZ;
    pos.setXYZ(i, x + rx, y + ry, z + rz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeRootGeo(
  angle: number,
  startY: number,
  reach: number,
  radius: number,
  archLift = 0.12
): THREE.BufferGeometry {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cos * radius * 0.45, startY, sin * radius * 0.45),
    new THREE.Vector3(cos * reach * 0.45, startY * 0.35 + archLift, sin * reach * 0.45),
    new THREE.Vector3(cos * reach * 0.88, 0.06, sin * reach * 0.88),
    new THREE.Vector3(cos * reach, -0.18, sin * reach),
  ]);
  return new THREE.TubeGeometry(curve, 4, radius, 4, false);
}

/**
 * 1. Tall Thin Conifer (9.5-11.5m misty ridge pine with sparse dead lower stubs and irregular upper tiers)
 */
export function buildTallConiferGeometries(variant: 0 | 1): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  const h = variant === 0 ? 10.6 : 9.4;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(variant === 0 ? 0.08 : -0.1, h * 0.35, 0.06),
    new THREE.Vector3(variant === 0 ? -0.06 : 0.09, h * 0.72, -0.07),
    new THREE.Vector3(0.03, h, 0.04),
  ]);
  const trunk = new THREE.TubeGeometry(trunkCurve, 5, 0.16, 5, false);
  // Taper trunk radius upward
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    const t = THREE.MathUtils.clamp(y / h, 0, 1);
    const taper = THREE.MathUtils.lerp(1.75, 0.28, t);
    tPos.setX(i, tPos.getX(i) * taper);
    tPos.setZ(i, tPos.getZ(i) * taper);
  }
  tPos.needsUpdate = true;
  trunk.computeVertexNormals();
  woodParts.push(trunk);

  // Small snapped lower dead branch stubs
  for (let s = 0; s < 4; s++) {
    const a = s * 1.75 + variant * 0.9;
    const sy = 2.1 + s * 0.85;
    const stub = new THREE.CylinderGeometry(0.022, 0.045, 0.75 + (s % 2) * 0.25, 4);
    stub.rotateZ(-Math.cos(a) * 1.15);
    stub.rotateX(Math.sin(a) * 1.15);
    stub.translate(Math.cos(a) * 0.32, sy, Math.sin(a) * 0.32);
    woodParts.push(stub);
  }

  // Asymmetric needle tiers: variant 0 = high misty pine, variant 1 = low-bough dense spruce blocking eye-level sightlines
  const tiers = variant === 0
    ? [
        { y: 5.5, r: 1.65, th: 2.0, ox: 0.1, oz: -0.06 },
        { y: 6.9, r: 1.38, th: 1.9, ox: -0.08, oz: 0.09 },
        { y: 8.3, r: 1.08, th: 1.85, ox: 0.06, oz: 0.05 },
        { y: 9.7, r: 0.72, th: 1.7, ox: -0.03, oz: -0.04 },
      ]
    : [
        { y: 2.35, r: 2.25, th: 1.9, ox: -0.1, oz: 0.08 },
        { y: 3.75, r: 1.95, th: 1.95, ox: 0.09, oz: -0.06 },
        { y: 5.15, r: 1.55, th: 1.9, ox: -0.07, oz: 0.06 },
        { y: 6.55, r: 1.15, th: 1.8, ox: 0.05, oz: -0.04 },
        { y: 7.9, r: 0.76, th: 1.6, ox: -0.02, oz: 0.03 },
      ];

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const cone = new THREE.ConeGeometry(t.r, t.th, 6);
    cone.rotateY(i * 0.65 + variant * 0.5);
    cone.rotateZ((i % 2 === 0 ? 1 : -1) * 0.06);
    cone.translate(t.ox, t.y, t.oz);
    jitterGeometry(cone, 0.18, 0.14, 100 + variant * 31 + i * 7);
    foliageParts.push(cone);
  }

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * 2. Large Ancient Pine (massive trunk, exposed buttress roots, wide horizontal limbs, flat old-growth shelves)
 */
export function buildAncientPineGeometries(variant: 0 | 1): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  const trunkH = variant === 0 ? 9.8 : 8.9;
  const trunk = new THREE.CylinderGeometry(0.18, 0.54, trunkH, 6, 4);
  trunk.translate(0, trunkH * 0.48, 0);
  jitterGeometry(trunk, 0.09, 0.08, 220 + variant * 19, 0.4);
  woodParts.push(trunk);

  // 5 thick exposed surface buttress roots gripping the soil
  for (let r = 0; r < 5; r++) {
    const angle = (r / 5) * Math.PI * 2 + variant * 0.45 + (r % 2) * 0.25;
    woodParts.push(makeRootGeo(angle, 0.95 + (r % 2) * 0.25, 1.55 + (r % 3) * 0.28, 0.14, 0.16));
  }

  // Heavy horizontal spreading primary limbs + wide flattened ancient pine bough pads
  const limbAngles = variant === 0 ? [0.2, 1.9, 3.5, 5.1] : [0.8, 2.5, 4.1, 5.6];
  for (let i = 0; i < limbAngles.length; i++) {
    const a = limbAngles[i];
    const ly = 4.6 + i * 0.95;
    const len = 2.05 + (i % 2) * 0.65;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    const limbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cos * 0.22, ly, sin * 0.22),
      new THREE.Vector3(cos * len * 0.55, ly + 0.28, sin * len * 0.55),
      new THREE.Vector3(cos * len, ly + 0.12, sin * len),
    ]);
    woodParts.push(new THREE.TubeGeometry(limbCurve, 3, 0.105, 4, false));

    const pad = new THREE.ConeGeometry(1.75 + (i % 2) * 0.35, 1.25, 6);
    pad.rotateY(a + 0.3);
    pad.translate(cos * len * 0.88, ly + 0.58, sin * len * 0.88);
    jitterGeometry(pad, 0.26, 0.16, 305 + i * 11 + variant * 7);
    foliageParts.push(pad);
  }

  // Broad irregular crown cap atop trunk
  const crown1 = new THREE.ConeGeometry(2.55, 1.85, 7);
  crown1.translate(0.15, trunkH - 0.3, -0.1);
  jitterGeometry(crown1, 0.32, 0.22, 355 + variant);
  foliageParts.push(crown1);

  const crown2 = new THREE.ConeGeometry(1.65, 1.45, 6);
  crown2.translate(-0.2, trunkH + 0.65, 0.18);
  jitterGeometry(crown2, 0.22, 0.18, 377 + variant);
  foliageParts.push(crown2);

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * 3. Broadleaf Forest Tree (Oak / Alder with forked trunk, surface roots & overlapping irregular crowns)
 */
export function buildBroadleafGeometries(variant: 0 | 1): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  const forkY = variant === 0 ? 3.1 : 2.55;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(variant === 0 ? 0.12 : -0.15, forkY * 0.5, 0.08),
    new THREE.Vector3(0, forkY, 0),
  ]);
  const trunk = new THREE.TubeGeometry(trunkCurve, 4, variant === 0 ? 0.34 : 0.28, 6, false);
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const t = THREE.MathUtils.clamp(tPos.getY(i) / forkY, 0, 1);
    const flare = THREE.MathUtils.lerp(1.42, 0.82, t);
    tPos.setX(i, tPos.getX(i) * flare);
    tPos.setZ(i, tPos.getZ(i) * flare);
  }
  tPos.needsUpdate = true;
  trunk.computeVertexNormals();
  woodParts.push(trunk);

  // 4 surface roots
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2 + variant * 0.55;
    woodParts.push(makeRootGeo(a, 0.65, 1.35 + (r % 2) * 0.3, 0.11, 0.11));
  }

  // Forking crooked primary boughs + irregular polyhedral leaf crowns (variant 1 spreads lower into mid-story)
  const branches = variant === 0
    ? [
        { a: 0.25, reach: 2.35, topY: 6.2, rCrown: 1.95 },
        { a: 1.85, reach: 2.15, topY: 5.5, rCrown: 1.75 },
        { a: 3.45, reach: 2.45, topY: 6.6, rCrown: 2.0 },
        { a: 4.95, reach: 2.0, topY: 5.1, rCrown: 1.65 },
      ]
    : [
        { a: 0.55, reach: 2.2, topY: 4.3, rCrown: 1.65 },
        { a: 2.4, reach: 2.15, topY: 5.1, rCrown: 1.75 },
        { a: 3.9, reach: 2.25, topY: 3.9, rCrown: 1.6 },
        { a: 5.2, reach: 1.95, topY: 5.9, rCrown: 1.55 },
      ];

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const cos = Math.cos(b.a);
    const sin = Math.sin(b.a);
    const endX = cos * b.reach;
    const endZ = sin * b.reach;

    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, forkY - 0.18, 0),
      new THREE.Vector3(endX * 0.48, forkY + (b.topY - forkY) * 0.55, endZ * 0.48),
      new THREE.Vector3(endX, b.topY, endZ),
    ]);
    woodParts.push(new THREE.TubeGeometry(bCurve, 4, 0.11, 4, false));

    const cluster = new THREE.IcosahedronGeometry(b.rCrown, 0);
    cluster.scale(1.18, 0.78, 1.05);
    cluster.rotateY(b.a);
    cluster.translate(endX * 0.86, b.topY + 0.35, endZ * 0.86);
    jitterGeometry(cluster, 0.32, 0.24, 410 + i * 19 + variant * 13);
    foliageParts.push(cluster);
  }

  // Central upper crown cap
  const topCrown = new THREE.IcosahedronGeometry(variant === 0 ? 2.05 : 1.75, 0);
  topCrown.scale(1.25, 0.82, 1.15);
  topCrown.translate(0.1, variant === 0 ? 7.25 : 7.45, -0.1);
  jitterGeometry(topCrown, 0.34, 0.25, 490 + variant * 7);
  foliageParts.push(topCrown);

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * 4. Twisted & Crooked Tree (writhing witchwood trunk + gnarled overhanging limbs + sparse ragged foliage)
 */
export function buildTwistedTreeGeometries(variant: 0 | 1): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  const dir = variant === 0 ? 1 : -1;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.1, 0),
    new THREE.Vector3(dir * 0.65, 1.4, -0.35),
    new THREE.Vector3(-dir * 0.4, 3.0, 0.45),
    new THREE.Vector3(dir * 0.85, 4.6, 0.2),
    new THREE.Vector3(dir * 1.15, 5.7, -0.25),
  ]);
  const trunk = new THREE.TubeGeometry(trunkCurve, 7, 0.21, 5, false);
  const tPos = trunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const t = THREE.MathUtils.clamp(tPos.getY(i) / 5.7, 0, 1);
    const s = THREE.MathUtils.lerp(1.45, 0.42, t);
    tPos.setX(i, tPos.getX(i) * (0.88 + 0.12 * s));
  }
  tPos.needsUpdate = true;
  trunk.computeVertexNormals();
  woodParts.push(trunk);

  for (let r = 0; r < 4; r++) {
    const a = r * 1.55 + 0.4 + variant * 0.6;
    woodParts.push(makeRootGeo(a, 0.55, 1.4, 0.095, 0.18));
  }

  const limbSpecs = [
    [
      new THREE.Vector3(dir * 0.15, 2.5, 0.25),
      new THREE.Vector3(-dir * 1.1, 3.3, 0.9),
      new THREE.Vector3(-dir * 1.85, 3.0, 1.35),
    ],
    [
      new THREE.Vector3(dir * 0.65, 4.0, 0.22),
      new THREE.Vector3(dir * 1.75, 4.7, -0.65),
      new THREE.Vector3(dir * 2.35, 4.4, -1.05),
    ],
    [
      new THREE.Vector3(dir * 0.95, 5.0, -0.1),
      new THREE.Vector3(dir * 0.35, 6.0, -0.85),
      new THREE.Vector3(-dir * 0.15, 6.2, -1.35),
    ],
  ];

  for (let i = 0; i < limbSpecs.length; i++) {
    const pts = limbSpecs[i];
    const c = new THREE.CatmullRomCurve3(pts);
    woodParts.push(new THREE.TubeGeometry(c, 4, 0.075, 4, false));

    const end = pts[pts.length - 1];
    const clump = new THREE.IcosahedronGeometry(1.05 - i * 0.12, 0);
    clump.scale(1.25, 0.68, 1.1);
    clump.translate(end.x * 0.92, end.y + 0.25, end.z * 0.92);
    jitterGeometry(clump, 0.22, 0.18, 560 + i * 17 + variant * 11);
    foliageParts.push(clump);
  }

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * 5. Exposed-Root Buttress Tree (high arching stilt roots clinging over slopes/rocks + dense canopy)
 */
export function buildRootedTreeGeometries(): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  const trunk = new THREE.CylinderGeometry(0.15, 0.36, 7.2, 6, 3);
  trunk.translate(0, 4.1, 0);
  jitterGeometry(trunk, 0.08, 0.06, 611, 1.0);
  woodParts.push(trunk);

  // 6 dramatic arching stilt/buttress roots lifting the trunk collar ~0.9m above soil
  for (let r = 0; r < 6; r++) {
    const angle = (r / 6) * Math.PI * 2 + (r % 2) * 0.18;
    const reach = 1.65 + (r % 3) * 0.32;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cos * 0.18, 1.35, sin * 0.18),
      new THREE.Vector3(cos * reach * 0.45, 0.85, sin * reach * 0.45),
      new THREE.Vector3(cos * reach * 0.85, 0.22, sin * reach * 0.85),
      new THREE.Vector3(cos * reach, -0.2, sin * reach),
    ]);
    woodParts.push(new THREE.TubeGeometry(rootCurve, 4, 0.11, 4, false));
  }

  const crowns = [
    { x: 0.45, y: 5.5, z: -0.35, r: 1.55 },
    { x: -0.55, y: 6.1, z: 0.4, r: 1.45 },
    { x: 0.1, y: 7.1, z: 0.15, r: 1.65 },
    { x: -0.15, y: 8.1, z: -0.1, r: 1.1 },
  ];
  for (let i = 0; i < crowns.length; i++) {
    const c = crowns[i];
    const cl = new THREE.IcosahedronGeometry(c.r, 0);
    cl.scale(1.18, 0.78, 1.12);
    cl.translate(c.x, c.y, c.z);
    jitterGeometry(cl, 0.24, 0.18, 650 + i * 13);
    foliageParts.push(cl);
  }

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * 6. Dead Trees & Broken Trunks (0 = jagged snapped trunk, 1 = tall leafless skeletal deadwood)
 */
export function buildDeadTreeGeometries(variant: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  if (variant === 0) {
    // Jagged broken trunk snag (~3.8m tall)
    const trunk = new THREE.CylinderGeometry(0.24, 0.42, 3.6, 6, 2);
    trunk.translate(0, 1.75, 0);
    jitterGeometry(trunk, 0.08, 0.24, 710, 2.8);
    parts.push(trunk);

    // Splinter teeth at fracture top
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2 + 0.4;
      const tooth = new THREE.ConeGeometry(0.11, 0.85, 4);
      tooth.rotateZ(s === 0 ? 0.18 : -0.14);
      tooth.translate(Math.cos(a) * 0.14, 3.65, Math.sin(a) * 0.14);
      parts.push(tooth);
    }

    for (let r = 0; r < 4; r++) {
      parts.push(makeRootGeo(r * 1.6 + 0.3, 0.55, 1.25, 0.1, 0.12));
    }

    const stub = new THREE.CylinderGeometry(0.04, 0.09, 1.15, 4);
    stub.rotateZ(-0.95);
    stub.translate(0.55, 2.35, 0.15);
    parts.push(stub);
  } else {
    // Tall gnarled skeleton dead tree
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0.22, 1.8, -0.12),
      new THREE.Vector3(-0.18, 3.8, 0.18),
      new THREE.Vector3(0.25, 5.8, -0.08),
    ]);
    parts.push(new THREE.TubeGeometry(curve, 6, 0.17, 5, false));

    for (let r = 0; r < 4; r++) {
      parts.push(makeRootGeo(r * 1.55 + 0.7, 0.6, 1.35, 0.095, 0.14));
    }

    const limbs = [
      [new THREE.Vector3(0.05, 2.8, 0.08), new THREE.Vector3(-1.1, 3.7, 0.75), new THREE.Vector3(-1.8, 3.4, 1.1)],
      [new THREE.Vector3(0.08, 3.9, 0.1), new THREE.Vector3(1.25, 4.7, -0.55), new THREE.Vector3(1.9, 4.4, -0.85)],
      [new THREE.Vector3(0.12, 4.9, 0.0), new THREE.Vector3(-0.45, 5.9, -0.85), new THREE.Vector3(-0.85, 6.4, -1.2)],
      [new THREE.Vector3(0.22, 5.4, -0.05), new THREE.Vector3(0.75, 6.4, 0.65)],
    ];
    for (const pts of limbs) {
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.06, 4, false));
    }
  }

  return mergeClean(parts);
}

/**
 * 7. Young Trees & Saplings (0 = young conifer, 1 = slender broadleaf sapling)
 */
export function buildSaplingGeometries(variant: 0 | 1): SplitTreeGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  if (variant === 0) {
    const trunk = new THREE.CylinderGeometry(0.03, 0.09, 2.7, 5);
    trunk.translate(0, 1.32, 0);
    woodParts.push(trunk);

    const t1 = new THREE.ConeGeometry(0.72, 1.15, 5);
    t1.translate(0, 1.35, 0);
    jitterGeometry(t1, 0.1, 0.08, 801);
    foliageParts.push(t1);

    const t2 = new THREE.ConeGeometry(0.5, 1.05, 5);
    t2.rotateY(0.5);
    t2.translate(0.03, 2.05, -0.02);
    jitterGeometry(t2, 0.08, 0.07, 809);
    foliageParts.push(t2);

    const t3 = new THREE.ConeGeometry(0.3, 0.85, 5);
    t3.translate(-0.02, 2.65, 0.02);
    foliageParts.push(t3);
  } else {
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(0.08, 1.1, 0.04),
      new THREE.Vector3(-0.05, 2.2, -0.04),
    ]);
    woodParts.push(new THREE.TubeGeometry(trunkCurve, 4, 0.055, 4, false));

    const twig = new THREE.CylinderGeometry(0.02, 0.035, 0.9, 4);
    twig.rotateZ(-0.65);
    twig.translate(0.32, 1.65, 0.08);
    woodParts.push(twig);

    const c1 = new THREE.IcosahedronGeometry(0.62, 0);
    c1.scale(1.1, 0.85, 1.05);
    c1.translate(-0.08, 2.35, -0.04);
    jitterGeometry(c1, 0.12, 0.1, 823);
    foliageParts.push(c1);

    const c2 = new THREE.IcosahedronGeometry(0.46, 0);
    c2.translate(0.52, 1.92, 0.12);
    jitterGeometry(c2, 0.1, 0.08, 839);
    foliageParts.push(c2);
  }

  return {
    woodGeo: mergeClean(woodParts),
    foliageGeo: mergeClean(foliageParts),
  };
}

/**
 * Multi-Lobe Wild Forest Bushes (replaces uniform single dodecahedrons)
 */
export function buildBushGeometry(variant: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const offsets = variant === 0
    ? [
        { x: 0, y: 0.42, z: 0, r: 0.56, sx: 1.25, sy: 0.82, sz: 1.15 },
        { x: -0.45, y: 0.3, z: 0.25, r: 0.42, sx: 1.1, sy: 0.78, sz: 1.1 },
        { x: 0.42, y: 0.34, z: -0.22, r: 0.44, sx: 1.15, sy: 0.86, sz: 1.0 },
        { x: 0.08, y: 0.62, z: 0.15, r: 0.36, sx: 1.05, sy: 0.8, sz: 1.05 },
      ]
    : [
        { x: 0, y: 0.36, z: 0, r: 0.62, sx: 1.35, sy: 0.72, sz: 1.25 },
        { x: 0.5, y: 0.28, z: 0.3, r: 0.4, sx: 1.05, sy: 0.75, sz: 1.1 },
        { x: -0.42, y: 0.38, z: -0.28, r: 0.46, sx: 1.1, sy: 0.9, sz: 1.0 },
      ];

  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[i];
    const g = new THREE.IcosahedronGeometry(o.r, 0);
    g.scale(o.sx, o.sy, o.sz);
    g.translate(o.x, o.y, o.z);
    jitterGeometry(g, 0.12, 0.09, 901 + i * 19 + variant * 7);
    parts.push(g);
  }
  return mergeClean(parts);
}

/**
 * Irregular Geological Rocks (0 = jagged boulder, 1 = flat-topped mossy slab, 2 = clustered crag)
 */
export function buildRockVariantGeometry(variant: 0 | 1 | 2): THREE.BufferGeometry {
  if (variant === 0) {
    const g = new THREE.IcosahedronGeometry(0.85, 0);
    g.scale(1.15, 0.92, 1.0);
    return jitterGeometry(g, 0.22, 0.18, 1001);
  }
  if (variant === 1) {
    const g = new THREE.DodecahedronGeometry(0.9, 0);
    g.scale(1.35, 0.62, 1.15);
    return jitterGeometry(g, 0.2, 0.12, 1033);
  }
  const parts: THREE.BufferGeometry[] = [];
  const main = new THREE.DodecahedronGeometry(0.82, 0);
  main.scale(1.05, 1.28, 0.95);
  jitterGeometry(main, 0.2, 0.18, 1061);
  parts.push(main);

  const sub = new THREE.IcosahedronGeometry(0.55, 0);
  sub.scale(1.15, 0.8, 1.1);
  sub.translate(0.55, -0.22, 0.35);
  jitterGeometry(sub, 0.14, 0.1, 1087);
  parts.push(sub);
  return mergeClean(parts);
}

/**
 * Low-poly Moss Mound / Forest Floor Cushion
 */
export function buildMossMoundGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const m1 = new THREE.IcosahedronGeometry(0.68, 0);
  m1.scale(1.4, 0.28, 1.25);
  m1.translate(0, 0.06, 0);
  jitterGeometry(m1, 0.12, 0.04, 1117);
  parts.push(m1);

  const m2 = new THREE.IcosahedronGeometry(0.45, 0);
  m2.scale(1.3, 0.26, 1.1);
  m2.translate(0.45, 0.04, 0.24);
  jitterGeometry(m2, 0.08, 0.03, 1129);
  parts.push(m2);
  return mergeClean(parts);
}

/**
 * Emerging Gnarled Soil Root Arch
 */
export function buildSoilRootGeometry(variant: 0 | 1): THREE.BufferGeometry {
  const curve = variant === 0
    ? new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.95, -0.15, -0.12),
        new THREE.Vector3(-0.35, 0.24, 0.15),
        new THREE.Vector3(0.32, 0.32, -0.08),
        new THREE.Vector3(0.95, -0.16, 0.18),
      ])
    : new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.75, -0.14, 0.1),
        new THREE.Vector3(-0.15, 0.19, -0.14),
        new THREE.Vector3(0.45, 0.14, 0.12),
        new THREE.Vector3(1.1, -0.18, -0.05),
      ]);
  return prepGeo(new THREE.TubeGeometry(curve, 6, 0.11, 5, false));
}

/**
 * Decaying Fallen Log with Broken Branch Stubs + Moss Cap
 */
export function buildDecayingLogGeometries(): DecayingLogGeo {
  const woodParts: THREE.BufferGeometry[] = [];
  const mossParts: THREE.BufferGeometry[] = [];

  const bodyCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.7, 0.24, -0.08),
    new THREE.Vector3(-0.4, 0.28, 0.08),
    new THREE.Vector3(0.8, 0.25, -0.05),
    new THREE.Vector3(1.75, 0.22, 0.07),
  ]);
  const body = new THREE.TubeGeometry(bodyCurve, 5, 0.27, 5, false);
  woodParts.push(body);

  const stub1 = new THREE.CylinderGeometry(0.05, 0.11, 0.85, 4);
  stub1.rotateZ(-0.75);
  stub1.rotateY(0.4);
  stub1.translate(-0.55, 0.55, 0.18);
  woodParts.push(stub1);

  const stub2 = new THREE.CylinderGeometry(0.04, 0.09, 0.7, 4);
  stub2.rotateZ(0.82);
  stub2.rotateY(-0.5);
  stub2.translate(0.75, 0.48, -0.15);
  woodParts.push(stub2);

  for (const mx of [-0.9, 0.15, 1.05]) {
    const cap = new THREE.IcosahedronGeometry(0.32, 0);
    cap.scale(1.45, 0.42, 0.95);
    cap.translate(mx, 0.48, 0);
    jitterGeometry(cap, 0.06, 0.03, 1200 + Math.round(mx * 10));
    mossParts.push(cap);
  }

  return {
    woodGeo: mergeClean(woodParts),
    mossGeo: mergeClean(mossParts),
  };
}

/**
 * Fallen Forest Branch
 */
export function buildFallenBranchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.75, 0.05, 0.04),
    new THREE.Vector3(0.0, 0.09, -0.06),
    new THREE.Vector3(0.75, 0.06, 0.08),
  ]);
  parts.push(new THREE.TubeGeometry(main, 4, 0.055, 4, false));

  const fork = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 0.08, -0.04),
    new THREE.Vector3(0.45, 0.14, -0.38),
  ]);
  parts.push(new THREE.TubeGeometry(fork, 2, 0.032, 4, false));
  return mergeClean(parts);
}

/**
 * Clinging Ivy Wrap for Tree Trunks (curved tapered planes hugging bark from y=0.1 to y=4.6)
 */
export function buildTrunkIvyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.35;
    const p = new THREE.PlaneGeometry(0.82, 4.5, 1, 3);
    const pos = p.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const yNorm = (pos.getY(v) + 2.25) / 4.5;
      const radiusOffset = THREE.MathUtils.lerp(0.5, 0.3, yNorm);
      pos.setZ(v, pos.getZ(v) + radiusOffset);
    }
    pos.needsUpdate = true;
    p.rotateY(a);
    p.translate(0, 2.25, 0);
    parts.push(p);
  }
  return mergeClean(parts);
}

/**
 * Creeping Rock Ivy Drape
 */
export function buildRockIvyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.PlaneGeometry(1.3, 1.3);
    p.rotateX(-0.55);
    p.rotateY(i * 1.45);
    p.translate(0, 0.58, 0);
    parts.push(p);
  }
  return mergeClean(parts);
}

/**
 * Hanging Branch Liana / Moss Vine Curtain (pivots at top y=0 and hangs down to y=-3.2)
 */
export function buildHangingLianaGeometry(): THREE.BufferGeometry {
  const p1 = new THREE.PlaneGeometry(1.25, 3.2);
  p1.translate(0, -1.6, 0);
  const p2 = new THREE.PlaneGeometry(1.25, 3.2);
  p2.rotateY(Math.PI * 0.5);
  p2.translate(0, -1.6, 0);
  return mergeClean([p1, p2]);
}

/**
 * Catenary Liana Vine Bridge (spans x = -0.5 to +0.5 so scaling X stretches seamlessly between two trees)
 */
export function buildBridgeLianaGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const mainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, 0.0, 0),
    new THREE.Vector3(-0.22, -0.24, 0.03),
    new THREE.Vector3(0.0, -0.35, 0),
    new THREE.Vector3(0.24, -0.23, -0.03),
    new THREE.Vector3(0.5, 0.0, 0),
  ]);
  parts.push(new THREE.TubeGeometry(mainCurve, 6, 0.024, 4, false));

  // Two hanging offshoot tendrils along the draped vine
  const tendril1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.14, -0.28, 0.02),
    new THREE.Vector3(-0.16, -0.62, 0.04),
  ]);
  parts.push(new THREE.TubeGeometry(tendril1, 2, 0.015, 3, false));

  const tendril2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.16, -0.27, -0.02),
    new THREE.Vector3(0.18, -0.66, -0.03),
  ]);
  parts.push(new THREE.TubeGeometry(tendril2, 2, 0.015, 3, false));

  return mergeClean(parts);
}
