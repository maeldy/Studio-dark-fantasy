import * as THREE from 'three';
import { applyRetroVertexSnap } from '../terrain';
import { ProceduralTextures } from '../textures';
import {
  AnimalSpecies,
  AnyEntitySpecies,
  CreatureSpecies,
  EntityCategory,
  MonsterSpecies,
  NpcRole,
} from '../types';

export interface EntityRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  baseBodyY: number;
  headPivot: THREE.Group;
  neckPivot?: THREE.Group;
  tailPivot?: THREE.Group;
  legs: THREE.Group[];
  kneePivots?: THREE.Group[];
  wings: THREE.Group[];
  arms: THREE.Group[];
  forearmPivots?: THREE.Group[];
  weaponPivot?: THREE.Group;
  contactShadow: THREE.Mesh;
  fadeMaterials: THREE.Material[];
  emissiveMaterials: THREE.MeshBasicMaterial[];
  baseShadowScale: number;
}

export interface EntityVisualTextures {
  furLight: THREE.CanvasTexture;
  furDark: THREE.CanvasTexture;
  feather: THREE.CanvasTexture;
  mossSkin: THREE.CanvasTexture;
  chitin: THREE.CanvasTexture;
  clothWool: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeLowResTex(
  size: number,
  seed: number,
  baseHex: string,
  streakCount: number,
  c1: string,
  c2: string,
  vertical = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(seed);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < streakCount; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = vertical ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 5);
    const h = vertical ? 2 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 2);
    ctx.fillStyle = rand() > 0.5 ? c1 : c2;
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createEntityVisualTextures(): EntityVisualTextures {
  const furLight = makeLowResTex(32, 1021, '#9e9588', 110, '#857c6f', '#b5ac9f', false);
  const furDark = makeLowResTex(32, 2049, '#5e564d', 115, '#463f38', '#756c60', false);
  const feather = makeLowResTex(32, 3077, '#6b6f75', 95, '#4b4f54', '#8b9096', true);
  const mossSkin = makeLowResTex(32, 4093, '#4b5a46', 105, '#2d3b2b', '#6d7a61', true);
  const chitin = makeLowResTex(32, 5119, '#312c30', 90, '#1c181b', '#4d464a', false);
  const clothWool = makeLowResTex(32, 6133, '#7b7871', 120, '#625f58', '#969289', true);

  return {
    furLight,
    furDark,
    feather,
    mossSkin,
    chitin,
    clothWool,
    dispose: () => {
      furLight.dispose();
      furDark.dispose();
      feather.dispose();
      mossSkin.dispose();
      chitin.dispose();
      clothWool.dispose();
    },
  };
}

function makeMat(
  color: string,
  map?: THREE.Texture,
  options: {
    transparent?: boolean;
    opacity?: number;
    emissive?: string;
    emissiveIntensity?: number;
    side?: THREE.Side;
    metalness?: number;
    roughness?: number;
  } = {}
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  if (options.metalness !== undefined) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      map: map ?? null,
      metalness: options.metalness,
      roughness: options.roughness ?? 0.55,
      flatShading: true,
      transparent: !!options.transparent,
      opacity: options.opacity ?? 1,
      side: options.side ?? THREE.FrontSide,
    });
    applyRetroVertexSnap(mat, 210);
    return mat;
  }
  const mat = new THREE.MeshLambertMaterial({
    color,
    map: map ?? null,
    flatShading: true,
    transparent: !!options.transparent,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.FrontSide,
  });
  applyRetroVertexSnap(mat, 210);
  return mat;
}

function createShadow(textures: ProceduralTextures, size: number, opacity = 0.54): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  return mesh;
}

function addEyes(
  head: THREE.Group,
  xOff: number,
  yOff: number,
  zOff: number,
  size: number,
  color: string,
  emissiveOut: THREE.MeshBasicMaterial[]
): void {
  const mat = new THREE.MeshBasicMaterial({ color });
  emissiveOut.push(mat);
  const geo = new THREE.BoxGeometry(size, size * 0.8, size * 0.6);
  for (const s of [-1, 1] as const) {
    const eye = new THREE.Mesh(geo, mat);
    eye.position.set(s * xOff, yOff, zOff);
    head.add(eye);
  }
}

// ============================================================================
// ANIMALS (18 distinct low-poly PS1 rigs)
// ============================================================================

function buildDeerRig(
  variant: 'stag' | 'doe' | 'roe_deer' | 'pale_stag',
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const root = new THREE.Group();
  const isPale = variant === 'pale_stag';
  const scale =
    variant === 'roe_deer' ? 0.72 : variant === 'doe' ? 0.92 : isPale ? 1.15 : 1.05;
  const shadow = createShadow(textures, 1.35 * scale, isPale ? 0.35 : 0.55);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.82 * scale;
  root.add(bodyPivot);

  const coatMat = makeMat(
    isPale ? '#b8c3bd' : variant === 'roe_deer' ? '#7b5b42' : variant === 'doe' ? '#725944' : '#5e4736',
    eTex.furLight,
    isPale
      ? { transparent: true, opacity: 0.9, emissive: '#3b4e4c', emissiveIntensity: 0.28 }
      : {}
  );
  const bellyMat = makeMat(isPale ? '#d5e0da' : '#a89a86', eTex.furLight, isPale ? { transparent: true, opacity: 0.9 } : {});
  const hoofMat = makeMat(isPale ? '#445250' : '#231d19');
  const hornMat = makeMat(isPale ? '#d3e2dc' : '#857762', undefined, isPale ? { emissive: '#6ea89c', emissiveIntensity: 0.25 } : {});

  // Sloped angular ribcage + haunches
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 0.44 * scale, 0.58 * scale), coatMat);
  chest.position.set(0, 0.04 * scale, 0.16 * scale);
  chest.rotation.x = -0.08;
  chest.castShadow = true;
  bodyPivot.add(chest);

  const haunch = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.40 * scale, 0.56 * scale), coatMat);
  haunch.position.set(0, 0.01 * scale, -0.24 * scale);
  haunch.castShadow = true;
  bodyPivot.add(haunch);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.30 * scale, 0.16 * scale, 0.74 * scale), bellyMat);
  belly.position.set(0, -0.14 * scale, -0.04 * scale);
  bodyPivot.add(belly);

  // Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.1 * scale, -0.52 * scale);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.2 * scale, 4), bellyMat);
  tail.rotation.x = -Math.PI * 0.72;
  tail.position.z = -0.06 * scale;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  // Neck & Head
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.16 * scale, 0.38 * scale);
  bodyPivot.add(neckPivot);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * scale, 0.17 * scale, 0.52 * scale, 5),
    coatMat
  );
  neck.position.set(0, 0.22 * scale, 0.12 * scale);
  neck.rotation.x = 0.44;
  neck.castShadow = true;
  neckPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.42 * scale, 0.22 * scale);
  neckPivot.add(headPivot);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.2 * scale, 0.26 * scale), coatMat);
  skull.position.set(0, 0.04 * scale, 0.03 * scale);
  headPivot.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.12 * scale, 0.22 * scale), coatMat);
  snout.position.set(0, 0.0, 0.21 * scale);
  snout.rotation.x = 0.18;
  headPivot.add(snout);

  for (const s of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055 * scale, 0.18 * scale, 4), coatMat);
    ear.position.set(s * 0.12 * scale, 0.14 * scale, -0.04 * scale);
    ear.rotation.z = -s * 0.58;
    ear.rotation.x = -0.25;
    headPivot.add(ear);
  }

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(headPivot, 0.095 * scale, 0.06 * scale, 0.12 * scale, 0.036 * scale, isPale ? '#9cf5df' : '#181410', emissives);

  if (variant === 'stag' || variant === 'pale_stag' || variant === 'roe_deer') {
    const antScale = variant === 'roe_deer' ? 0.48 : variant === 'pale_stag' ? 1.25 : 1.0;
    for (const s of [-1, 1] as const) {
      const mainBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02 * scale, 0.03 * scale, 0.48 * antScale, 4),
        hornMat
      );
      mainBeam.position.set(s * 0.12 * scale, 0.26 * scale + 0.12 * antScale, 0);
      mainBeam.rotation.z = -s * 0.42;
      mainBeam.rotation.x = -0.24;
      headPivot.add(mainBeam);

      if (variant !== 'roe_deer') {
        const tine1 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012 * scale, 0.02 * scale, 0.24 * antScale, 4),
          hornMat
        );
        tine1.position.set(s * 0.22 * scale, 0.43 * scale + 0.08 * antScale, 0.06 * scale);
        tine1.rotation.z = -s * 0.1;
        tine1.rotation.x = 0.42;
        headPivot.add(tine1);

        const tine2 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01 * scale, 0.018 * scale, 0.22 * antScale, 4),
          hornMat
        );
        tine2.position.set(s * 0.27 * scale, 0.52 * scale + 0.12 * antScale, -0.07 * scale);
        tine2.rotation.z = -s * 0.72;
        headPivot.add(tine2);
      }
    }
  }

  // 4 Slender articulated legs + knees
  const legs: THREE.Group[] = [];
  const kneePivots: THREE.Group[] = [];
  const legOffsets: [number, number][] = [
    [-0.14 * scale, 0.28 * scale],
    [0.14 * scale, 0.28 * scale],
    [-0.14 * scale, -0.32 * scale],
    [0.14 * scale, -0.32 * scale],
  ];
  for (const [lx, lz] of legOffsets) {
    const legPivot = new THREE.Group();
    legPivot.position.set(lx, -0.08 * scale, lz);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055 * scale, 0.038 * scale, 0.4 * scale, 4),
      coatMat
    );
    upper.position.y = -0.18 * scale;
    upper.castShadow = true;
    legPivot.add(upper);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.36 * scale, 0);
    legPivot.add(kneePivot);

    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036 * scale, 0.028 * scale, 0.36 * scale, 4),
      coatMat
    );
    lower.position.y = -0.18 * scale;
    kneePivot.add(lower);

    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.06 * scale, 0.08 * scale), hoofMat);
    hoof.position.set(0, -0.36 * scale, 0.01 * scale);
    kneePivot.add(hoof);

    bodyPivot.add(legPivot);
    legs.push(legPivot);
    kneePivots.push(kneePivot);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.82 * scale,
    headPivot,
    neckPivot,
    tailPivot,
    legs,
    kneePivots,
    wings: [],
    arms: [],
    contactShadow: shadow,
    fadeMaterials: isPale ? [coatMat, bellyMat, hornMat] : [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

function buildBoarRig(textures: ProceduralTextures, eTex: EntityVisualTextures): EntityRig {
  const root = new THREE.Group();
  const shadow = createShadow(textures, 1.15, 0.56);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.46;
  root.add(bodyPivot);

  const furMat = makeMat('#42362d', eTex.furDark);
  const bristleMat = makeMat('#29221d', eTex.furDark);
  const tuskMat = makeMat('#cbc2ae');

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.88), furMat);
  barrel.position.set(0, 0.04, -0.04);
  barrel.castShadow = true;
  bodyPivot.add(barrel);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.72), bristleMat);
  ridge.position.set(0, 0.31, -0.02);
  bodyPivot.add(ridge);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.06, 0.38);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 5), furMat);
  head.rotation.x = Math.PI * 0.55;
  head.position.set(0, -0.02, 0.18);
  head.castShadow = true;
  headPivot.add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.08, 6), bristleMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, -0.06, 0.41);
  headPivot.add(snout);

  for (const s of [-1, 1] as const) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.14, 4), tuskMat);
    tusk.position.set(s * 0.11, -0.03, 0.34);
    tusk.rotation.z = -s * 0.55;
    tusk.rotation.x = 0.35;
    headPivot.add(tusk);

    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 4), bristleMat);
    ear.position.set(s * 0.14, 0.16, 0.06);
    ear.rotation.z = -s * 0.5;
    headPivot.add(ear);
  }

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(headPivot, 0.12, 0.05, 0.2, 0.04, '#181410', emissives);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.12, -0.48);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.22, 4), bristleMat);
  tail.rotation.x = -0.8;
  tail.position.z = -0.08;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [
    [-0.17, 0.24],
    [0.17, 0.24],
    [-0.17, -0.32],
    [0.17, -0.32],
  ] as [number, number][]) {
    const lp = new THREE.Group();
    lp.position.set(lx, -0.14, lz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.32, 4), bristleMat);
    leg.position.y = -0.16;
    lp.add(leg);
    bodyPivot.add(lp);
    legs.push(lp);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.46,
    headPivot,
    tailPivot,
    legs,
    wings: [],
    arms: [],
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

function buildWolfRig(
  isDire: boolean,
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const root = new THREE.Group();
  const sc = isDire ? 1.24 : 0.96;
  const shadow = createShadow(textures, 1.25 * sc, 0.55);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.58 * sc;
  root.add(bodyPivot);

  const coat = makeMat(isDire ? '#2c3036' : '#585c61', eTex.furDark);
  const ruff = makeMat(isDire ? '#1b1d22' : '#40444a', eTex.furDark);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36 * sc, 0.38 * sc, 0.86 * sc), coat);
  torso.position.set(0, 0.02 * sc, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  const chestRuff = new THREE.Mesh(new THREE.ConeGeometry(0.24 * sc, 0.42 * sc, 5), ruff);
  chestRuff.rotation.x = Math.PI * 0.5;
  chestRuff.position.set(0, 0.05 * sc, 0.26 * sc);
  bodyPivot.add(chestRuff);

  if (isDire) {
    for (let i = 0; i < 3; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06 * sc, 0.18 * sc, 4), ruff);
      tuft.position.set(0, 0.26 * sc, (0.2 - i * 0.24) * sc);
      tuft.rotation.x = -0.35;
      bodyPivot.add(tuft);
    }
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.14 * sc, 0.42 * sc);
  bodyPivot.add(headPivot);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24 * sc, 0.22 * sc, 0.26 * sc), coat);
  skull.position.set(0, 0.04 * sc, 0.1 * sc);
  headPivot.add(skull);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.13 * sc, 0.12 * sc, 0.24 * sc), ruff);
  muzzle.position.set(0, 0.0 * sc, 0.28 * sc);
  headPivot.add(muzzle);

  for (const s of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05 * sc, 0.15 * sc, 4), ruff);
    ear.position.set(s * 0.09 * sc, 0.2 * sc, 0.05 * sc);
    headPivot.add(ear);
  }

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(
    headPivot,
    0.08 * sc,
    0.08 * sc,
    0.22 * sc,
    0.036 * sc,
    isDire ? '#ff7d3b' : '#c9b87a',
    emissives
  );

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.1 * sc, -0.42 * sc);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075 * sc, 0.44 * sc, 5), ruff);
  tail.rotation.x = -Math.PI * 0.65;
  tail.position.set(0, -0.06 * sc, -0.18 * sc);
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [
    [-0.13 * sc, 0.28 * sc],
    [0.13 * sc, 0.28 * sc],
    [-0.13 * sc, -0.3 * sc],
    [0.13 * sc, -0.3 * sc],
  ] as [number, number][]) {
    const lp = new THREE.Group();
    lp.position.set(lx, -0.1 * sc, lz);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052 * sc, 0.035 * sc, 0.48 * sc, 4),
      coat
    );
    leg.position.y = -0.24 * sc;
    leg.castShadow = true;
    lp.add(leg);
    bodyPivot.add(lp);
    legs.push(lp);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.58 * sc,
    headPivot,
    tailPivot,
    legs,
    wings: [],
    arms: [],
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

function buildBearRig(textures: ProceduralTextures, eTex: EntityVisualTextures): EntityRig {
  const root = new THREE.Group();
  const shadow = createShadow(textures, 1.85, 0.6);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.78;
  root.add(bodyPivot);

  const fur = makeMat('#3a2c22', eTex.furDark);
  const muzzleMat = makeMat('#5a4637', eTex.furLight);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.8, 1.32), fur);
  trunk.position.set(0, 0.06, 0);
  trunk.castShadow = true;
  bodyPivot.add(trunk);

  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.28, 0.56), fur);
  hump.position.set(0, 0.44, 0.28);
  bodyPivot.add(hump);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.16, 0.65);
  bodyPivot.add(headPivot);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.44), fur);
  skull.position.set(0, 0.04, 0.18);
  skull.castShadow = true;
  headPivot.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), muzzleMat);
  snout.position.set(0, -0.05, 0.46);
  headPivot.add(snout);

  for (const s of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 5), fur);
    ear.rotation.x = Math.PI * 0.5;
    ear.position.set(s * 0.19, 0.27, 0.15);
    headPivot.add(ear);
  }

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(headPivot, 0.13, 0.1, 0.39, 0.045, '#191410', emissives);

  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [
    [-0.29, 0.4],
    [0.29, 0.4],
    [-0.29, -0.44],
    [0.29, -0.44],
  ] as [number, number][]) {
    const lp = new THREE.Group();
    lp.position.set(lx, -0.22, lz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.56, 5), fur);
    leg.position.y = -0.28;
    leg.castShadow = true;
    lp.add(leg);
    bodyPivot.add(lp);
    legs.push(lp);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.78,
    headPivot,
    legs,
    wings: [],
    arms: [],
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

function buildSmallMammalRig(
  species: 'rabbit' | 'fox' | 'squirrel' | 'badger' | 'hedgehog' | 'mouse',
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const root = new THREE.Group();
  const shadowSize =
    species === 'fox' ? 0.95 : species === 'badger' ? 0.85 : species === 'mouse' ? 0.36 : 0.56;
  const shadow = createShadow(textures, shadowSize, 0.48);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);
  const headPivot = new THREE.Group();
  bodyPivot.add(headPivot);
  const tailPivot = new THREE.Group();
  bodyPivot.add(tailPivot);
  const legs: THREE.Group[] = [];
  const emissives: THREE.MeshBasicMaterial[] = [];

  if (species === 'fox') {
    bodyPivot.position.y = 0.38;
    const coat = makeMat('#8c4c2c', eTex.furLight);
    const tip = makeMat('#d4cab9', eTex.furLight);
    const dark = makeMat('#241d19');

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.62), coat);
    torso.castShadow = true;
    bodyPivot.add(torso);

    headPivot.position.set(0, 0.08, 0.3);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.2), coat);
    skull.position.set(0, 0.04, 0.08);
    headPivot.add(skull);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), coat);
    snout.rotation.x = Math.PI * 0.5;
    snout.position.set(0, 0.01, 0.26);
    headPivot.add(snout);

    for (const s of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), dark);
      ear.position.set(s * 0.07, 0.16, 0.06);
      headPivot.add(ear);
    }
    addEyes(headPivot, 0.065, 0.06, 0.18, 0.03, '#14110e', emissives);

    tailPivot.position.set(0, 0.04, -0.31);
    const tailBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.36, 5), coat);
    tailBody.rotation.x = Math.PI * 0.42;
    tailBody.position.set(0, 0.04, -0.16);
    tailPivot.add(tailBody);
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 5), tip);
    tailTip.rotation.x = -Math.PI * 0.58;
    tailTip.position.set(0, 0.08, -0.36);
    tailPivot.add(tailTip);

    for (const [lx, lz] of [
      [-0.09, 0.2],
      [0.09, 0.2],
      [-0.09, -0.22],
      [0.09, -0.22],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.06, lz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.32, 4), dark);
      leg.position.y = -0.16;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'rabbit') {
    bodyPivot.position.y = 0.18;
    const coat = makeMat('#7c7063', eTex.furLight);
    const white = makeMat('#cfc7b8');

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.32), coat);
    body.rotation.x = -0.15;
    body.castShadow = true;
    bodyPivot.add(body);

    headPivot.position.set(0, 0.09, 0.14);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.16), coat);
    head.position.set(0, 0.04, 0.06);
    headPivot.add(head);

    for (const s of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.18, 0.03), coat);
      ear.position.set(s * 0.045, 0.18, 0.03);
      ear.rotation.z = -s * 0.14;
      ear.rotation.x = -0.15;
      headPivot.add(ear);
    }
    addEyes(headPivot, 0.06, 0.05, 0.11, 0.025, '#171412', emissives);

    tailPivot.position.set(0, 0.02, -0.16);
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), white);
    tailPivot.add(puff);

    for (const [lx, lz, big] of [
      [-0.08, 0.09, false],
      [0.08, 0.09, false],
      [-0.09, -0.1, true],
      [0.09, -0.1, true],
    ] as [number, number, boolean][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.04, lz);
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(big ? 0.06 : 0.04, 0.14, big ? 0.13 : 0.05),
        coat
      );
      leg.position.y = -0.07;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'squirrel') {
    bodyPivot.position.y = 0.14;
    const coat = makeMat('#7d4c2c', eTex.furLight);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), coat);
    bodyPivot.add(body);

    headPivot.position.set(0, 0.06, 0.11);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), coat);
    head.position.set(0, 0.03, 0.04);
    headPivot.add(head);
    for (const s of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 3), coat);
      ear.position.set(s * 0.04, 0.1, 0.02);
      headPivot.add(ear);
    }
    addEyes(headPivot, 0.04, 0.04, 0.09, 0.02, '#14100d', emissives);

    tailPivot.position.set(0, 0.04, -0.1);
    const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), coat);
    tail1.position.set(0, 0.1, -0.04);
    tail1.rotation.x = -0.3;
    tailPivot.add(tail1);
    const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), coat);
    tail2.position.set(0, 0.22, 0.02);
    tail2.rotation.x = 0.35;
    tailPivot.add(tail2);

    for (const [lx, lz] of [
      [-0.05, 0.07],
      [0.05, 0.07],
      [-0.05, -0.07],
      [0.05, -0.07],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.03, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.04), coat);
      leg.position.y = -0.05;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'badger') {
    bodyPivot.position.y = 0.22;
    const dark = makeMat('#2c2e30', eTex.furDark);
    const stripe = makeMat('#bfc2be');

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.56), dark);
    torso.castShadow = true;
    bodyPivot.add(torso);

    headPivot.position.set(0, 0.03, 0.27);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), dark);
    head.position.set(0, 0.01, 0.1);
    headPivot.add(head);

    const whiteStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.26), stripe);
    whiteStripe.position.set(0, 0.09, 0.11);
    headPivot.add(whiteStripe);

    addEyes(headPivot, 0.08, 0.03, 0.18, 0.028, '#121212', emissives);

    for (const [lx, lz] of [
      [-0.12, 0.18],
      [0.12, 0.18],
      [-0.12, -0.2],
      [0.12, -0.2],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.08, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), dark);
      leg.position.y = -0.07;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'hedgehog') {
    bodyPivot.position.y = 0.11;
    const spine = makeMat('#3f372f', eTex.furDark);
    const face = makeMat('#8d7d6a');

    const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), spine);
    dome.scale.set(0.95, 0.85, 1.2);
    bodyPivot.add(dome);

    for (let i = 0; i < 4; i++) {
      const q = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), spine);
      q.position.set((i % 2 === 0 ? -1 : 1) * 0.04, 0.12, 0.06 - i * 0.06);
      q.rotation.x = -0.4;
      bodyPivot.add(q);
    }

    headPivot.position.set(0, -0.01, 0.15);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), face);
    snout.rotation.x = Math.PI * 0.5;
    snout.position.z = 0.05;
    headPivot.add(snout);
    addEyes(headPivot, 0.035, 0.02, 0.04, 0.018, '#141210', emissives);

    for (const [lx, lz] of [
      [-0.07, 0.06],
      [0.07, 0.06],
      [-0.07, -0.07],
      [0.07, -0.07],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.05, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.04), face);
      leg.position.y = -0.03;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else {
    // Mouse
    bodyPivot.position.y = 0.065;
    const coat = makeMat('#696259', eTex.furLight);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.15), coat);
    bodyPivot.add(body);

    headPivot.position.set(0, 0.01, 0.075);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.08, 4), coat);
    snout.rotation.x = Math.PI * 0.5;
    snout.position.z = 0.035;
    headPivot.add(snout);
    for (const s of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 5), coat);
      ear.rotation.x = Math.PI * 0.5;
      ear.position.set(s * 0.035, 0.04, 0.01);
      headPivot.add(ear);
    }
    addEyes(headPivot, 0.022, 0.015, 0.04, 0.012, '#141210', emissives);

    tailPivot.position.set(0, -0.01, -0.075);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.16, 4), coat);
    tail.rotation.x = Math.PI * 0.48;
    tail.position.z = -0.08;
    tailPivot.add(tail);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: bodyPivot.position.y,
    headPivot,
    tailPivot,
    legs,
    wings: [],
    arms: [],
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

function buildBirdRig(
  species: 'crow' | 'rook' | 'owl' | 'barn_owl' | 'songbird' | 'eagle',
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const root = new THREE.Group();
  const scale =
    species === 'eagle'
      ? 1.45
      : species === 'owl' || species === 'barn_owl'
        ? 1.05
        : species === 'songbird'
          ? 0.62
          : 0.92;
  const shadow = createShadow(textures, 0.58 * scale, 0.42);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.22 * scale;
  root.add(bodyPivot);

  const mainColor =
    species === 'crow'
      ? '#1a1d22'
      : species === 'rook'
        ? '#2a2d33'
        : species === 'owl'
          ? '#5e4c3a'
          : species === 'barn_owl'
            ? '#b8b0a1'
            : species === 'eagle'
              ? '#4a3829'
              : '#5f5247';
  const accentColor =
    species === 'songbird'
      ? '#8b4d37'
      : species === 'barn_owl'
        ? '#d8d0c2'
        : species === 'eagle'
          ? '#cfc5b2'
          : '#383b42';

  const bodyMat = makeMat(mainColor, eTex.feather);
  const accentMat = makeMat(accentColor, eTex.feather);
  const beakMat = makeMat(species === 'eagle' ? '#b38b3b' : species === 'crow' ? '#2c2f34' : '#7a684b');

  const isOwl = species === 'owl' || species === 'barn_owl';
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, isOwl ? 0.28 * scale : 0.18 * scale, 0.28 * scale),
    bodyMat
  );
  torso.rotation.x = isOwl ? -0.38 : -0.15;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const breast = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * scale, 0.14 * scale, 0.12 * scale),
    accentMat
  );
  breast.position.set(0, -0.02 * scale, 0.1 * scale);
  bodyPivot.add(breast);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, (isOwl ? 0.16 : 0.1) * scale, (isOwl ? 0.06 : 0.13) * scale);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(
      (isOwl ? 0.19 : 0.13) * scale,
      (isOwl ? 0.17 : 0.13) * scale,
      (isOwl ? 0.16 : 0.14) * scale
    ),
    species === 'eagle' ? accentMat : bodyMat
  );
  head.position.set(0, 0.05 * scale, 0);
  headPivot.add(head);

  if (species === 'owl') {
    for (const s of [-1, 1] as const) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.028 * scale, 0.09 * scale, 3), bodyMat);
      tuft.position.set(s * 0.08 * scale, 0.16 * scale, 0.02 * scale);
      tuft.rotation.z = -s * 0.35;
      headPivot.add(tuft);
    }
  }

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03 * scale, 0.11 * scale, 4), beakMat);
  beak.rotation.x = Math.PI * 0.55;
  beak.position.set(0, 0.03 * scale, 0.11 * scale);
  headPivot.add(beak);

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(
    headPivot,
    (isOwl ? 0.055 : 0.048) * scale,
    0.06 * scale,
    0.075 * scale,
    (isOwl ? 0.034 : 0.02) * scale,
    isOwl ? '#d6a442' : '#121212',
    emissives
  );

  // Articulated Wings
  const wings: THREE.Group[] = [];
  const wingSpan = species === 'eagle' ? 0.62 : 0.34;
  for (const s of [-1, 1] as const) {
    const wp = new THREE.Group();
    wp.position.set(s * 0.09 * scale, 0.05 * scale, 0);
    const wingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(wingSpan * scale, 0.025 * scale, 0.22 * scale),
      bodyMat
    );
    wingMesh.position.set(s * (wingSpan * 0.5) * scale, 0, -0.02 * scale);
    wingMesh.castShadow = true;
    wp.add(wingMesh);
    bodyPivot.add(wp);
    wings.push(wp);
  }

  // Tail fan
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, -0.04 * scale, -0.15 * scale);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * scale, 0.02 * scale, 0.2 * scale),
    bodyMat
  );
  tail.position.z = -0.1 * scale;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  // Legs
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const lp = new THREE.Group();
    lp.position.set(s * 0.05 * scale, -0.08 * scale, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * scale, 0.012 * scale, 0.14 * scale, 4), beakMat);
    leg.position.y = -0.07 * scale;
    lp.add(leg);
    bodyPivot.add(lp);
    legs.push(lp);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.22 * scale,
    headPivot,
    tailPivot,
    legs,
    wings,
    arms: [],
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

// ============================================================================
// FANTASTIC & MYSTERIOUS CREATURES (remaining 8 besides pale_stag)
// ============================================================================

function buildFantasticCreatureRig(
  species: Exclude<CreatureSpecies, 'pale_stag'>,
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const root = new THREE.Group();
  const isGhost =
    species === 'fog_apparition' || species === 'wisp_entity' || species === 'shadow_stalker' || species === 'forest_spirit';
  const shadow = createShadow(textures, species === 'moss_golem' || species === 'stone_guardian' ? 1.55 : 0.95, isGhost ? 0.24 : 0.5);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);
  const headPivot = new THREE.Group();
  bodyPivot.add(headPivot);
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  const fadeMaterials: THREE.Material[] = [];
  const emissives: THREE.MeshBasicMaterial[] = [];

  if (species === 'forest_spirit' || species === 'moss_dryad' || species === 'tree_sprite') {
    const sc = species === 'tree_sprite' ? 0.62 : species === 'forest_spirit' ? 1.22 : 1.05;
    bodyPivot.position.y = 0.72 * sc;
    const barkMat = makeMat(
      species === 'forest_spirit' ? '#7b877c' : '#4a4337',
      eTex.mossSkin,
      species === 'forest_spirit' ? { transparent: true, opacity: 0.85 } : {}
    );
    const mossMat = makeMat(
      species === 'forest_spirit' ? '#607a6e' : '#3d5239',
      eTex.mossSkin,
      species === 'forest_spirit' ? { transparent: true, opacity: 0.85 } : {}
    );
    if (species === 'forest_spirit') fadeMaterials.push(barkMat, mossMat);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * sc, 0.25 * sc, 0.72 * sc, 5),
      barkMat
    );
    torso.castShadow = true;
    bodyPivot.add(torso);

    const mossMantle = new THREE.Mesh(
      new THREE.ConeGeometry(0.32 * sc, 0.34 * sc, 6),
      mossMat
    );
    mossMantle.position.y = 0.24 * sc;
    bodyPivot.add(mossMantle);

    headPivot.position.set(0, 0.42 * sc, 0);
    const mask = new THREE.Mesh(new THREE.OctahedronGeometry(0.15 * sc, 0), barkMat);
    mask.scale.set(0.9, 1.35, 0.85);
    mask.position.y = 0.14 * sc;
    headPivot.add(mask);

    // Asymmetrical branch antlers
    for (const s of [-1, 1] as const) {
      const h = (s === 1 ? 0.44 : 0.32) * sc;
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * sc, 0.036 * sc, h, 4), barkMat);
      horn.position.set(s * 0.14 * sc, 0.32 * sc, -0.02 * sc);
      horn.rotation.z = -s * 0.48;
      headPivot.add(horn);
    }

    addEyes(
      headPivot,
      0.06 * sc,
      0.16 * sc,
      0.11 * sc,
      0.03 * sc,
      species === 'forest_spirit' ? '#9bf0d8' : '#d2b463',
      emissives
    );

    for (const s of [-1, 1] as const) {
      const ap = new THREE.Group();
      ap.position.set(s * 0.22 * sc, 0.24 * sc, 0);
      const len = (s === -1 ? 0.62 : 0.5) * sc; // asymmetrical root-arms
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * sc, 0.024 * sc, len, 4), barkMat);
      arm.position.y = -len * 0.5;
      ap.add(arm);
      bodyPivot.add(ap);
      arms.push(ap);

      const lp = new THREE.Group();
      lp.position.set(s * 0.1 * sc, -0.3 * sc, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * sc, 0.04 * sc, 0.46 * sc, 4), barkMat);
      leg.position.y = -0.22 * sc;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'stone_guardian' || species === 'moss_golem') {
    const sc = species === 'moss_golem' ? 1.15 : 1.05;
    bodyPivot.position.y = 0.78 * sc;
    const stone = makeMat('#545b61', textures.stoneColor);
    const moss = makeMat('#3b4e38', eTex.mossSkin);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.76 * sc, 0.74 * sc, 0.52 * sc), stone);
    chest.castShadow = true;
    bodyPivot.add(chest);

    const mossCap = new THREE.Mesh(new THREE.BoxGeometry(0.8 * sc, 0.16 * sc, 0.54 * sc), moss);
    mossCap.position.y = 0.34 * sc;
    bodyPivot.add(mossCap);

    headPivot.position.set(0, 0.44 * sc, 0.04 * sc);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.32 * sc, 0.34 * sc, 0.32 * sc), stone);
    helm.position.y = 0.16 * sc;
    headPivot.add(helm);

    const runeMat = new THREE.MeshBasicMaterial({
      color: species === 'stone_guardian' ? '#7cd4b8' : '#d69d49',
    });
    emissives.push(runeMat);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2 * sc, 0.045 * sc, 0.04 * sc), runeMat);
    visor.position.set(0, 0.18 * sc, 0.16 * sc);
    headPivot.add(visor);

    const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 * sc, 0), runeMat);
    chestCore.position.set(0, 0.06 * sc, 0.27 * sc);
    bodyPivot.add(chestCore);

    for (const s of [-1, 1] as const) {
      const ap = new THREE.Group();
      ap.position.set(s * 0.5 * sc, 0.24 * sc, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * sc, 0.76 * sc, 0.22 * sc), stone);
      arm.position.y = -0.34 * sc;
      arm.castShadow = true;
      ap.add(arm);
      bodyPivot.add(ap);
      arms.push(ap);

      const lp = new THREE.Group();
      lp.position.set(s * 0.22 * sc, -0.32 * sc, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * sc, 0.48 * sc, 0.24 * sc), stone);
      leg.position.y = -0.24 * sc;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }
  } else if (species === 'wisp_entity') {
    bodyPivot.position.y = 1.1;
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#a7e8d8',
      transparent: true,
      opacity: 0.85,
    });
    const shellMat = makeMat('#4e756e', undefined, {
      transparent: true,
      opacity: 0.55,
      emissive: '#4d8a7e',
      emissiveIntensity: 0.45,
    });
    fadeMaterials.push(coreMat, shellMat);
    emissives.push(coreMat);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), coreMat);
    bodyPivot.add(core);
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), shellMat);
    cage.scale.set(0.85, 1.4, 0.85);
    bodyPivot.add(cage);
  } else {
    // fog_apparition or shadow_stalker
    const isShadow = species === 'shadow_stalker';
    bodyPivot.position.y = 0.95;
    const shroudMat = makeMat(
      isShadow ? '#15181d' : '#8da0ab',
      eTex.clothWool,
      {
        transparent: true,
        opacity: isShadow ? 0.86 : 0.58,
        emissive: isShadow ? '#0d1014' : '#3c515c',
        emissiveIntensity: 0.25,
      }
    );
    fadeMaterials.push(shroudMat);

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.38, 6), shroudMat);
    cloak.position.y = 0.02;
    bodyPivot.add(cloak);

    headPivot.position.set(0, 0.65, 0);
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 5), shroudMat);
    cowl.position.y = 0.14;
    headPivot.add(cowl);

    addEyes(
      headPivot,
      0.055,
      0.1,
      0.1,
      0.032,
      isShadow ? '#d9694c' : '#b8e8f2',
      emissives
    );

    for (const s of [-1, 1] as const) {
      const ap = new THREE.Group();
      ap.position.set(s * 0.22, 0.4, 0.04);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.014, 0.68, 4), shroudMat);
      arm.position.y = -0.32;
      ap.add(arm);
      bodyPivot.add(ap);
      arms.push(ap);
    }
  }

  return {
    root,
    bodyPivot,
    baseBodyY: bodyPivot.position.y,
    headPivot,
    legs,
    wings: [],
    arms,
    contactShadow: shadow,
    fadeMaterials,
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

// ============================================================================
// MONSTERS (distinct low-poly silhouettes across forest, ruins, caves, dungeons)
// ============================================================================

function buildMonsterRig(
  species: MonsterSpecies,
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  if (species === 'dire_wolf') {
    return buildWolfRig(true, textures, eTex);
  }

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);
  const headPivot = new THREE.Group();
  bodyPivot.add(headPivot);
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  const fadeMaterials: THREE.Material[] = [];
  const emissives: THREE.MeshBasicMaterial[] = [];
  let weaponPivot: THREE.Group | undefined;

  if (species === 'giant_spider') {
    const shadow = createShadow(textures, 1.6, 0.62);
    root.add(shadow);
    bodyPivot.position.y = 0.36;

    const bodyMat = makeMat('#241f22', eTex.chitin);
    const stripeMat = makeMat('#4b2926', eTex.chitin);

    const abdomen = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), bodyMat);
    abdomen.scale.set(0.95, 0.8, 1.25);
    abdomen.position.set(0, 0.1, -0.44);
    abdomen.castShadow = true;
    bodyPivot.add(abdomen);

    const dorsalMark = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.36), stripeMat);
    dorsalMark.position.set(0, 0.38, -0.42);
    bodyPivot.add(dorsalMark);

    const thorax = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.36), bodyMat);
    thorax.position.set(0, 0, 0.08);
    thorax.castShadow = true;
    bodyPivot.add(thorax);

    headPivot.position.set(0, 0.02, 0.26);
    for (const s of [-1, 1] as const) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.16, 4), stripeMat);
      fang.rotation.x = Math.PI * 0.72;
      fang.position.set(s * 0.08, -0.04, 0.14);
      headPivot.add(fang);
    }
    addEyes(headPivot, 0.09, 0.06, 0.09, 0.032, '#d44c3b', emissives);
    addEyes(headPivot, 0.04, 0.09, 0.1, 0.025, '#d44c3b', emissives);

    // 8 articulated bent spider legs
    for (let side of [-1, 1] as const) {
      for (let idx = 0; idx < 4; idx++) {
        const lp = new THREE.Group();
        const zOff = 0.18 - idx * 0.14;
        lp.position.set(side * 0.18, 0.02, zOff);
        lp.rotation.y = side * (0.45 - idx * 0.32);

        const femur = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 0.055), bodyMat);
        femur.position.set(side * 0.22, 0.14, 0);
        femur.rotation.z = side * 0.55;
        lp.add(femur);

        const tibia = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.05), bodyMat);
        tibia.position.set(side * 0.44, -0.1, 0);
        tibia.rotation.z = -side * 0.22;
        lp.add(tibia);

        bodyPivot.add(lp);
        legs.push(lp);
      }
    }

    return {
      root,
      bodyPivot,
      baseBodyY: bodyPivot.position.y,
      headPivot,
      legs,
      wings: [],
      arms,
      contactShadow: shadow,
      fadeMaterials,
      emissiveMaterials: emissives,
      baseShadowScale: 1,
    };
  }

  if (species === 'cave_crawler') {
    const shadow = createShadow(textures, 1.15, 0.58);
    root.add(shadow);
    bodyPivot.position.y = 0.34;

    const skinMat = makeMat('#665d58', eTex.chitin);
    const spineMat = makeMat('#3a3330');

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.78), skinMat);
    torso.castShadow = true;
    bodyPivot.add(torso);

    for (let i = 0; i < 4; i++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), spineMat);
      crest.position.set(0, 0.18, 0.24 - i * 0.18);
      crest.rotation.x = -0.35;
      bodyPivot.add(crest);
    }

    headPivot.position.set(0, 0.02, 0.4);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.28), skinMat);
    skull.position.set(0, 0, 0.1);
    headPivot.add(skull);
    addEyes(headPivot, 0.09, 0.05, 0.22, 0.032, '#c8d6a3', emissives);

    for (const [lx, lz] of [
      [-0.24, 0.26],
      [0.24, 0.26],
      [-0.22, -0.26],
      [0.22, -0.26],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.02, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.11), spineMat);
      leg.position.y = -0.18;
      leg.rotation.z = (lx < 0 ? 1 : -1) * 0.25;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }

    return {
      root,
      bodyPivot,
      baseBodyY: bodyPivot.position.y,
      headPivot,
      legs,
      wings: [],
      arms,
      contactShadow: shadow,
      fadeMaterials,
      emissiveMaterials: emissives,
      baseShadowScale: 1,
    };
  }

  if (species === 'night_prowler') {
    const shadow = createShadow(textures, 1.35, 0.58);
    root.add(shadow);
    bodyPivot.position.y = 0.52;

    const pelt = makeMat('#1d2026', eTex.furDark);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.94), pelt);
    torso.castShadow = true;
    bodyPivot.add(torso);

    headPivot.position.set(0, 0.08, 0.48);
    const skull = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 5), pelt);
    skull.rotation.x = Math.PI * 0.52;
    skull.position.z = 0.14;
    headPivot.add(skull);
    addEyes(headPivot, 0.075, 0.06, 0.22, 0.034, '#e05b46', emissives);

    for (const [lx, lz] of [
      [-0.18, 0.32],
      [0.18, 0.32],
      [-0.16, -0.34],
      [0.16, -0.34],
    ] as [number, number][]) {
      const lp = new THREE.Group();
      lp.position.set(lx, -0.08, lz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.48, 4), pelt);
      leg.position.y = -0.24;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }

    return {
      root,
      bodyPivot,
      baseBodyY: bodyPivot.position.y,
      headPivot,
      legs,
      wings: [],
      arms,
      contactShadow: shadow,
      fadeMaterials,
      emissiveMaterials: emissives,
      baseShadowScale: 1,
    };
  }

  if (species === 'thorn_fiend') {
    const shadow = createShadow(textures, 1.25, 0.56);
    root.add(shadow);
    bodyPivot.position.y = 0.78;
    const rootMat = makeMat('#3b3329', textures.barkColor);
    const thornMat = makeMat('#293826', eTex.mossSkin);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.85, 5), rootMat);
    torso.castShadow = true;
    bodyPivot.add(torso);

    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), thornMat);
    crown.position.y = 0.32;
    bodyPivot.add(crown);

    headPivot.position.set(0, 0.48, 0.06);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 5), rootMat);
    head.position.y = 0.16;
    headPivot.add(head);
    addEyes(headPivot, 0.065, 0.12, 0.14, 0.03, '#cf6f38', emissives);

    for (const s of [-1, 1] as const) {
      const ap = new THREE.Group();
      ap.position.set(s * 0.3, 0.28, 0);
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.025, 0.78, 4), rootMat);
      branch.position.y = -0.36;
      ap.add(branch);
      bodyPivot.add(ap);
      arms.push(ap);

      const lp = new THREE.Group();
      lp.position.set(s * 0.14, -0.36, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.45, 4), rootMat);
      leg.position.y = -0.22;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }

    return {
      root,
      bodyPivot,
      baseBodyY: bodyPivot.position.y,
      headPivot,
      legs,
      wings: [],
      arms,
      contactShadow: shadow,
      fadeMaterials,
      emissiveMaterials: emissives,
      baseShadowScale: 1,
    };
  }

  if (species === 'stone_colossus' || species === 'temple_warden') {
    const isColossus = species === 'stone_colossus';
    const sc = isColossus ? 1.38 : 1.12;
    const shadow = createShadow(textures, 1.55 * sc, 0.62);
    root.add(shadow);
    bodyPivot.position.y = 0.85 * sc;

    const stone = makeMat(isColossus ? '#454a50' : '#4f555b', textures.stoneColor);
    const iron = makeMat('#3d434a', undefined, { metalness: 0.72, roughness: 0.45 });

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72 * sc, 0.78 * sc, 0.46 * sc), stone);
    chest.castShadow = true;
    bodyPivot.add(chest);

    headPivot.position.set(0, 0.48 * sc, 0);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.3 * sc, 0.34 * sc, 0.3 * sc), isColossus ? stone : iron);
    helm.position.y = 0.16 * sc;
    headPivot.add(helm);

    const glowMat = new THREE.MeshBasicMaterial({ color: isColossus ? '#e07d38' : '#d44c3b' });
    emissives.push(glowMat);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2 * sc, 0.04 * sc, 0.04 * sc), glowMat);
    visor.position.set(0, 0.16 * sc, 0.15 * sc);
    headPivot.add(visor);

    for (const s of [-1, 1] as const) {
      const ap = new THREE.Group();
      ap.position.set(s * 0.48 * sc, 0.26 * sc, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * sc, 0.76 * sc, 0.2 * sc), stone);
      arm.position.y = -0.34 * sc;
      ap.add(arm);

      if (s === 1) {
        weaponPivot = new THREE.Group();
        weaponPivot.position.set(0, -0.68 * sc, 0.1 * sc);
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03 * sc, 0.03 * sc, 1.45 * sc, 5),
          iron
        );
        shaft.rotation.x = Math.PI * 0.48;
        shaft.position.z = 0.38 * sc;
        weaponPivot.add(shaft);

        const headHammer = new THREE.Mesh(
          new THREE.BoxGeometry(0.28 * sc, 0.22 * sc, 0.32 * sc),
          isColossus ? stone : iron
        );
        headHammer.position.set(0, -0.02 * sc, 0.98 * sc);
        weaponPivot.add(headHammer);
        ap.add(weaponPivot);
      }

      bodyPivot.add(ap);
      arms.push(ap);

      const lp = new THREE.Group();
      lp.position.set(s * 0.2 * sc, -0.35 * sc, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.21 * sc, 0.52 * sc, 0.22 * sc), stone);
      leg.position.y = -0.25 * sc;
      lp.add(leg);
      bodyPivot.add(lp);
      legs.push(lp);
    }

    return {
      root,
      bodyPivot,
      baseBodyY: bodyPivot.position.y,
      headPivot,
      legs,
      wings: [],
      arms,
      weaponPivot,
      contactShadow: shadow,
      fadeMaterials,
      emissiveMaterials: emissives,
      baseShadowScale: 1,
    };
  }

  // animated_skeleton, hollow_husk, or ruin_wraith
  const isWraith = species === 'ruin_wraith';
  const isSkel = species === 'animated_skeleton';
  const shadow = createShadow(textures, 1.05, isWraith ? 0.32 : 0.56);
  root.add(shadow);
  bodyPivot.position.y = 0.74;

  const mainMat = makeMat(
    isSkel ? '#b5ab98' : isWraith ? '#485963' : '#4a433d',
    isWraith ? eTex.clothWool : undefined,
    isWraith ? { transparent: true, opacity: 0.78 } : {}
  );
  const shroudMat = makeMat(
    isSkel ? '#332d27' : isWraith ? '#29353c' : '#2a2623',
    eTex.clothWool,
    isWraith ? { transparent: true, opacity: 0.78 } : {}
  );
  const rustIron = makeMat('#57443b', undefined, { metalness: 0.65, roughness: 0.58 });
  if (isWraith) fadeMaterials.push(mainMat, shroudMat);

  if (isSkel) {
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 5), mainMat);
    spine.position.y = 0.22;
    bodyPivot.add(spine);
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.32 - r * 0.03, 0.055, 0.2), mainMat);
      rib.position.y = 0.42 - r * 0.11;
      bodyPivot.add(rib);
    }
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.16), mainMat);
    pelvis.position.y = 0.02;
    bodyPivot.add(pelvis);
  } else {
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, isWraith ? 0.36 : 0.22, isWraith ? 1.15 : 0.65, 6),
      shroudMat
    );
    torso.position.y = isWraith ? 0.15 : 0.25;
    torso.castShadow = !isWraith;
    bodyPivot.add(torso);
  }

  headPivot.position.set(0, 0.58, 0.02);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.24, 0.21), mainMat);
  skull.position.y = 0.12;
  headPivot.add(skull);

  if (isWraith) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 5), rustIron);
    crown.position.y = 0.3;
    headPivot.add(crown);
  }

  addEyes(
    headPivot,
    0.055,
    0.14,
    0.11,
    0.032,
    isWraith ? '#8be3d4' : '#d65c3e',
    emissives
  );

  const forearmPivots: THREE.Group[] = [];
  const kneePivots: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const ap = new THREE.Group();
    ap.position.set(s * 0.23, 0.48, 0);
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(isSkel ? 0.028 : 0.05, isSkel ? 0.025 : 0.045, 0.27, 4),
      mainMat
    );
    upperArm.position.y = -0.12;
    ap.add(upperArm);

    const fp = new THREE.Group();
    fp.position.set(0, -0.25, 0);
    ap.add(fp);

    const lowerArm = new THREE.Mesh(
      new THREE.CylinderGeometry(isSkel ? 0.024 : 0.044, isSkel ? 0.022 : 0.04, 0.27, 4),
      mainMat
    );
    lowerArm.position.y = -0.135;
    fp.add(lowerArm);

    if (s === 1) {
      weaponPivot = new THREE.Group();
      weaponPivot.position.set(0, -0.25, 0.04);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.74, 0.018), rustIron);
      blade.rotation.x = Math.PI * 0.45;
      blade.position.z = 0.34;
      weaponPivot.add(blade);
      fp.add(weaponPivot);
    }

    bodyPivot.add(ap);
    arms.push(ap);
    forearmPivots.push(fp);

    if (!isWraith) {
      const lp = new THREE.Group();
      lp.position.set(s * 0.1, 0, 0);
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(isSkel ? 0.03 : 0.06, isSkel ? 0.027 : 0.054, 0.34, 4),
        mainMat
      );
      thigh.position.y = -0.17;
      lp.add(thigh);

      const kp = new THREE.Group();
      kp.position.set(0, -0.34, 0);
      lp.add(kp);

      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(isSkel ? 0.026 : 0.052, isSkel ? 0.024 : 0.048, 0.34, 4),
        mainMat
      );
      shin.position.y = -0.17;
      kp.add(shin);

      bodyPivot.add(lp);
      legs.push(lp);
      kneePivots.push(kp);
    }
  }

  return {
    root,
    bodyPivot,
    baseBodyY: bodyPivot.position.y,
    headPivot,
    legs,
    kneePivots,
    wings: [],
    arms,
    forearmPivots,
    weaponPivot,
    contactShadow: shadow,
    fadeMaterials,
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

// ============================================================================
// NPC HUMANOIDS (10 roles with distinct medieval garments & props)
// ============================================================================

const NPC_PALETTES: Record<
  NpcRole,
  { tunic: string; cloak: string; skin: string; trim: string; hasHood?: boolean; hasHat?: boolean; hasArmor?: boolean; prop?: 'staff' | 'axe' | 'pack' | 'halberd' | 'bow' | 'lantern' }
> = {
  traveler: { tunic: '#51483e', cloak: '#2c3638', skin: '#b69882', trim: '#766146', hasHood: true, prop: 'staff' },
  merchant: { tunic: '#684539', cloak: '#45382e', skin: '#b0917a', trim: '#9e7d45', hasHat: true, prop: 'pack' },
  hunter: { tunic: '#384737', cloak: '#263024', skin: '#a88a73', trim: '#59422e', hasHood: true, prop: 'bow' },
  woodcutter: { tunic: '#5e4334', cloak: '#3b3027', skin: '#ad8970', trim: '#4b4e52', prop: 'axe' },
  hermit: { tunic: '#3c3a37', cloak: '#282a27', skin: '#a6907c', trim: '#6e6556', hasHood: true, prop: 'staff' },
  guard: { tunic: '#3a4047', cloak: '#292d33', skin: '#ad8e78', trim: '#636c75', hasArmor: true, prop: 'halberd' },
  adventurer: { tunic: '#413c47', cloak: '#252930', skin: '#b3957f', trim: '#826e48', hasArmor: true, prop: 'lantern' },
  pilgrim: { tunic: '#4b4a43', cloak: '#353732', skin: '#ac9380', trim: '#8c7e62', hasHood: true, prop: 'lantern' },
  villager: { tunic: '#5d5347', cloak: '#403932', skin: '#b59781', trim: '#756452', hasHat: true },
  keeper: { tunic: '#543c32', cloak: '#2f2924', skin: '#a88c76', trim: '#8b6f47', prop: 'lantern' },
};

function buildNpcRig(
  role: NpcRole,
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  const pal = NPC_PALETTES[role];
  const root = new THREE.Group();
  const shadow = createShadow(textures, 1.05, 0.56);
  root.add(shadow);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.68;
  root.add(bodyPivot);

  const tunicMat = makeMat(pal.tunic, eTex.clothWool);
  const cloakMat = makeMat(pal.cloak, eTex.clothWool);
  const skinMat = makeMat(pal.skin);
  const trimMat = makeMat(pal.trim, undefined, pal.hasArmor ? { metalness: 0.72, roughness: 0.45 } : {});
  const bootMat = makeMat('#292019');

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.62, 6), tunicMat);
  torso.position.y = 0.25;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.08, 6), bootMat);
  belt.position.y = 0.06;
  bodyPivot.add(belt);

  // Cloak / Mantle
  const cloak = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.06), cloakMat);
  cloak.position.set(0, 0.16, -0.17);
  cloak.rotation.x = 0.1;
  cloak.castShadow = true;
  bodyPivot.add(cloak);

  if (pal.hasArmor) {
    for (const s of [-1, 1] as const) {
      const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 5), trimMat);
      pauldron.position.set(s * 0.24, 0.52, 0);
      pauldron.rotation.z = -s * 0.85;
      bodyPivot.add(pauldron);
    }
  }

  // Head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.58, 0);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), skinMat);
  head.position.y = 0.12;
  head.castShadow = true;
  headPivot.add(head);

  const emissives: THREE.MeshBasicMaterial[] = [];
  addEyes(headPivot, 0.055, 0.14, 0.112, 0.028, '#171513', emissives);

  if (pal.hasHood) {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 6), cloakMat);
    hood.position.set(0, 0.2, -0.02);
    hood.rotation.x = -0.16;
    headPivot.add(hood);
  } else if (pal.hasHat) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.03, 7), cloakMat);
    brim.position.y = 0.23;
    headPivot.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.16, 6), cloakMat);
    crown.position.y = 0.31;
    headPivot.add(crown);
  } else if (pal.hasArmor) {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.16, 6), trimMat);
    helm.position.y = 0.22;
    headPivot.add(helm);
  }

  if (pal.prop === 'pack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.26), trimMat);
    pack.position.set(0, 0.28, -0.24);
    bodyPivot.add(pack);
    const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 5), cloakMat);
    bedroll.rotation.z = Math.PI * 0.5;
    bedroll.position.set(0, 0.52, -0.24);
    bodyPivot.add(bedroll);
  } else if (pal.prop === 'bow') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 4, 7, Math.PI), trimMat);
    bow.position.set(-0.14, 0.32, -0.2);
    bow.rotation.set(0, 0, -0.6);
    bodyPivot.add(bow);
  }

  // Arms & Forearms
  const arms: THREE.Group[] = [];
  const forearmPivots: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const ap = new THREE.Group();
    ap.position.set(s * 0.24, 0.48, 0);
    const upperSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.23, 5), tunicMat);
    upperSleeve.position.y = -0.11;
    ap.add(upperSleeve);

    const fp = new THREE.Group();
    fp.position.set(0, -0.22, 0);
    ap.add(fp);

    const lowerSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.045, 0.23, 5), tunicMat);
    lowerSleeve.position.y = -0.115;
    fp.add(lowerSleeve);

    if (s === 1 && pal.prop === 'staff') {
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 1.45, 5), trimMat);
      staff.position.set(0, 0.12, 0.12);
      staff.rotation.x = 0.18;
      fp.add(staff);
    } else if (s === 1 && pal.prop === 'axe') {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 4), trimMat);
      haft.position.set(0, -0.20, 0.2);
      haft.rotation.x = Math.PI * 0.42;
      fp.add(haft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.14), makeMat('#656d75'));
      blade.position.set(0, -0.23, 0.5);
      fp.add(blade);
    } else if (s === 1 && pal.prop === 'halberd') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.75, 5), bootMat);
      pole.position.set(0, 0.27, 0.14);
      fp.add(pole);
      const headMetal = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.16), trimMat);
      headMetal.position.set(0, 1.1, 0.18);
      fp.add(headMetal);
    } else if (s === -1 && pal.prop === 'lantern') {
      const lanMat = new THREE.MeshBasicMaterial({ color: '#ff9d45' });
      emissives.push(lanMat);
      const lan = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), lanMat);
      lan.position.set(0, -0.26, 0.08);
      fp.add(lan);
    }

    bodyPivot.add(ap);
    arms.push(ap);
    forearmPivots.push(fp);
  }

  // Legs & Knees
  const legs: THREE.Group[] = [];
  const kneePivots: THREE.Group[] = [];
  for (const s of [-1, 1] as const) {
    const lp = new THREE.Group();
    lp.position.set(s * 0.11, -0.02, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.31, 5), bootMat);
    thigh.position.y = -0.155;
    lp.add(thigh);

    const kp = new THREE.Group();
    kp.position.set(0, -0.31, 0);
    lp.add(kp);

    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.05, 0.31, 5), bootMat);
    boot.position.y = -0.155;
    kp.add(boot);

    bodyPivot.add(lp);
    legs.push(lp);
    kneePivots.push(kp);
  }

  return {
    root,
    bodyPivot,
    baseBodyY: 0.68,
    headPivot,
    legs,
    kneePivots,
    wings: [],
    arms,
    forearmPivots,
    contactShadow: shadow,
    fadeMaterials: [],
    emissiveMaterials: emissives,
    baseShadowScale: 1,
  };
}

// ============================================================================
// PUBLIC BUILD DISPATCHER
// ============================================================================

export function buildEntityRig(
  category: EntityCategory,
  species: AnyEntitySpecies,
  textures: ProceduralTextures,
  eTex: EntityVisualTextures
): EntityRig {
  if (category === 'animal') {
    const s = species as AnimalSpecies;
    if (s === 'stag' || s === 'doe' || s === 'roe_deer') return buildDeerRig(s, textures, eTex);
    if (s === 'boar') return buildBoarRig(textures, eTex);
    if (s === 'wolf') return buildWolfRig(false, textures, eTex);
    if (s === 'bear') return buildBearRig(textures, eTex);
    if (
      s === 'rabbit' ||
      s === 'fox' ||
      s === 'squirrel' ||
      s === 'badger' ||
      s === 'hedgehog' ||
      s === 'mouse'
    ) {
      return buildSmallMammalRig(s, textures, eTex);
    }
    return buildBirdRig(s as 'crow' | 'rook' | 'owl' | 'barn_owl' | 'songbird' | 'eagle', textures, eTex);
  }

  if (category === 'creature') {
    const c = species as CreatureSpecies;
    if (c === 'pale_stag') return buildDeerRig('pale_stag', textures, eTex);
    return buildFantasticCreatureRig(c, textures, eTex);
  }

  if (category === 'monster') {
    return buildMonsterRig(species as MonsterSpecies, textures, eTex);
  }

  return buildNpcRig(species as NpcRole, textures, eTex);
}
