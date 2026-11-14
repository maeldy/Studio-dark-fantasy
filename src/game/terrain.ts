import * as THREE from 'three';
import { LandmarkZone } from './types';

// 1. Main winding path: Moss Clearing -> Pine Hollow -> Sunken Ruin Gate -> Mossy Bastion Ruins
const MAIN_PATH_POINTS = [
  new THREE.Vector3(0, 0, 7),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(2.2, 0, -9),
  new THREE.Vector3(8.5, 0, -17),
  new THREE.Vector3(12.5, 0, -26),
  new THREE.Vector3(5.5, 0, -35),
  new THREE.Vector3(-5.0, 0, -42),
  new THREE.Vector3(-16.0, 0, -47),
  new THREE.Vector3(-29.0, 0, -55),
  new THREE.Vector3(-42.0, 0, -63),
  new THREE.Vector3(-54.0, 0, -72),
];

// 2. East trail: Pine Fork -> Standing Stones Overlook -> Blackwater Bridge -> Abandoned Cabin
const EAST_PATH_POINTS = [
  new THREE.Vector3(8.5, 0, -17),
  new THREE.Vector3(19.0, 0, -15.5),
  new THREE.Vector3(27.5, 0, -21.0),
  new THREE.Vector3(31.0, 0, -28.0),
  new THREE.Vector3(33.2, 0, -35.5),
  new THREE.Vector3(34.0, 0, -40.8),
  new THREE.Vector3(36.0, 0, -44.0), // Exact center of Old Wooden Bridge
  new THREE.Vector3(38.1, 0, -47.2),
  new THREE.Vector3(41.8, 0, -54.5),
  new THREE.Vector3(46.0, 0, -63.0),
];

// 3. Western forest loop: Moss Clearing -> Southern Hollow -> Whispering Ring -> Sunken Gate
const WEST_LOOP_POINTS = [
  new THREE.Vector3(-2.5, 0, 4.5),
  new THREE.Vector3(-12.0, 0, 11.5),
  new THREE.Vector3(-25.0, 0, 17.5),
  new THREE.Vector3(-40.0, 0, 16.0),
  new THREE.Vector3(-50.0, 0, 3.0),
  new THREE.Vector3(-46.0, 0, -18.0), // Mysterious Clearing (Whispering Ring)
  new THREE.Vector3(-37.0, 0, -33.0),
  new THREE.Vector3(-25.0, 0, -43.0),
  new THREE.Vector3(-16.0, 0, -47.0),
];

// 4. South-East ridge trail: Clearing -> Cragstone Tor -> Silvermire Shore -> Overlook
const SOUTH_EAST_POINTS = [
  new THREE.Vector3(1.5, 0, 6.5),
  new THREE.Vector3(14.0, 0, 15.0),
  new THREE.Vector3(29.0, 0, 20.0),
  new THREE.Vector3(44.0, 0, 14.0), // Cragstone Tor rock formations
  new THREE.Vector3(54.0, 0, 1.0),
  new THREE.Vector3(56.0, 0, -12.0), // Near Silvermire Pond west shore
  new THREE.Vector3(44.0, 0, -21.0),
  new THREE.Vector3(31.0, 0, -28.0),
];

// Winding forest stream flowing beneath Blackwater Bridge into Silvermire Pond
export const STREAM_POINTS = [
  new THREE.Vector3(10.0, 0, -78.0),
  new THREE.Vector3(18.0, 0, -62.0),
  new THREE.Vector3(27.0, 0, -50.0),
  new THREE.Vector3(36.0, 0, -44.0),
  new THREE.Vector3(47.0, 0, -37.0),
  new THREE.Vector3(59.0, 0, -27.0),
  new THREE.Vector3(70.0, 0, -16.0),
];

const mainCurve = new THREE.CatmullRomCurve3(MAIN_PATH_POINTS);
const eastCurve = new THREE.CatmullRomCurve3(EAST_PATH_POINTS);
const westCurve = new THREE.CatmullRomCurve3(WEST_LOOP_POINTS);
const southEastCurve = new THREE.CatmullRomCurve3(SOUTH_EAST_POINTS);
export const streamCurve = new THREE.CatmullRomCurve3(STREAM_POINTS);

const allPathSamples: { x: number; z: number }[] = [
  ...mainCurve.getPoints(72).map((p) => ({ x: p.x, z: p.z })),
  ...eastCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
  ...westCurve.getPoints(60).map((p) => ({ x: p.x, z: p.z })),
  ...southEastCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
];

const streamSamples: { x: number; z: number }[] = streamCurve
  .getPoints(64)
  .map((p) => ({ x: p.x, z: p.z }));

export const PLAYABLE_BOUNDS_RADIUS = 92;
export const BOG_CENTER = { x: -14.0, z: 2.0 };
export const BOG_WATER_LEVEL = -0.36;
export const POND_CENTER = { x: 70.0, z: -16.0 };
export const TOWER_CENTER = { x: -4.0, z: -64.0 };
export const TOWER_YAW = -0.21;
export const RUINS_CENTER = { x: -54.0, z: -72.0 };
export const RUINS_YAW = 0.85;
export const SHRINE_CENTER = { x: -46.0, z: -18.0 };
export const SHRINE_YAW = 0.55;
export const CABIN_CENTER = { x: 48.0, z: -67.0 };
export const CABIN_YAW = -0.48;
export const COTTAGE_CENTER = { x: 27.0, z: 25.0 };
export const COTTAGE_YAW = 2.55;
export const CAVE_CRAG_CENTER = { x: 54.0, z: 19.0 };
export const CAVE_CRAG_YAW = -2.2;
export const CAVE_WEEPING_CENTER = { x: -45.0, z: 22.0 };
export const CAVE_WEEPING_YAW = 0.65;
export const CAVE_ANCIENT_CENTER = { x: -8.0, z: 38.0 };
export const CAVE_ANCIENT_YAW = 0.1;
export const CITADEL_GATE_CENTER = { x: 64.0, z: -36.0 };
export const CITADEL_GATE_YAW = -1.3;

// Bridge geometry constants (shared identically by mesh and walkable collision)
export const BRIDGE_CENTER = { x: 36.0, z: -44.0 };
export const BRIDGE_YAW = Math.atan2(0.545, -0.838); // Perpendicular to stream at (36, -44)
export const BRIDGE_HALF_LENGTH = 3.85;
export const BRIDGE_HALF_WIDTH = 1.38;

export const LANDMARK_ZONES: LandmarkZone[] = [
  { id: 'clearing', name: 'The Moss Clearing', x: 0, z: 0, radius: 13.5 },
  { id: 'bog', name: 'Mire of Sunken Roots', x: -14.0, z: 2.0, radius: 9.2 },
  { id: 'hollow', name: 'Winding Pine Hollow', x: 10, z: -22, radius: 12 },
  { id: 'overlook', name: 'Standing Stones Overlook', x: 30, z: -27, radius: 10.5 },
  { id: 'bridge', name: 'Blackwater Bridge', x: 36, z: -44, radius: 9.0 },
  { id: 'cabin', name: 'Hollowbark Homestead', x: 48, z: -67, radius: 15.0 },
  { id: 'cottage', name: 'Elderwood Cottage', x: 27, z: 25, radius: 12.0 },
  { id: 'tower', name: 'Greywatch Tower', x: -4, z: -64, radius: 15.0 },
  { id: 'gate', name: 'Sunken Ruin Gate', x: -16, z: -47, radius: 12.5 },
  { id: 'ruins', name: 'Mossy Bastion Ruins', x: -54, z: -72, radius: 18.0 },
  { id: 'whisper', name: 'Sanctum of Whispering Roots', x: -46, z: -18, radius: 16.0 },
  { id: 'crags', name: 'Cragstone Cavern', x: 54, z: 19, radius: 12.0 },
  { id: 'weeping_cave', name: 'Weeping Hollow Grotto', x: -45, z: 22, radius: 12.0 },
  { id: 'barrow_cave', name: 'Sunken Barrow Cavern', x: -8, z: 38, radius: 12.0 },
  { id: 'citadel_gate', name: 'Sunken Citadel Vault', x: 64, z: -36, radius: 12.5 },
  { id: 'crags_tor', name: 'Cragstone Tor', x: 44, z: 14, radius: 12.0 },
  { id: 'pond', name: 'Silvermire Pond', x: 70, z: -16, radius: 14.0 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Injects subtle classic PS1 clip-space vertex snapping into Lambert/Standard materials
 * without adding extra render passes.
 */
export function applyRetroVertexSnap(
  material: THREE.Material,
  snapGrid = 190.0
): void {
  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      #include <project_vertex>
      vec4 snappedPos = gl_Position;
      float snapW = max(snappedPos.w, 0.001);
      vec2 grid = vec2(${snapGrid.toFixed(1)}, ${(snapGrid * 0.75).toFixed(1)});
      snappedPos.xyz = snappedPos.xyz / snapW;
      snappedPos.xy = floor(snappedPos.xy * grid + 0.5) / grid;
      snappedPos.xyz *= snapW;
      gl_Position = snappedPos;
      `
    );
  };
}

export function pathDistanceAt(x: number, z: number): number {
  let minDistSq = Infinity;
  for (let i = 0; i < allPathSamples.length; i++) {
    const p = allPathSamples[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minDistSq) minDistSq = d2;
  }
  return Math.sqrt(minDistSq);
}

export function groveDensityAt(x: number, z: number): number {
  const macro =
    Math.sin(x * 0.068 + 0.6) * Math.cos(z * 0.064 - 0.4) * 0.34 +
    Math.cos(x * 0.037 - z * 0.046 + 1.2) * 0.24;
  const micro = Math.sin(x * 0.16 - z * 0.14 + 2.1) * 0.14;
  return THREE.MathUtils.clamp(0.54 + macro + micro, 0, 1);
}

export function pathMaskAt(x: number, z: number): number {
  const d = pathDistanceAt(x, z);
  return 1 - smoothstep(1.05, 2.45, d);
}

export function streamDistanceAt(x: number, z: number): number {
  let minDistSq = Infinity;
  for (let i = 0; i < streamSamples.length; i++) {
    const p = streamSamples[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minDistSq) minDistSq = d2;
  }
  return Math.sqrt(minDistSq);
}

function baseTerrainElevation(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  const clearingFlatness = smoothstep(7, 22, distFromCenter);

  const macroHills =
    Math.sin(x * 0.048 + 0.4) * Math.cos(z * 0.045 - 0.3) * 2.15 +
    Math.sin(x * 0.095 - z * 0.08) * 0.85 +
    Math.cos(x * 0.028 + z * 0.036) * 1.25;

  const microBump =
    Math.sin(x * 0.24 + 1.1) * Math.cos(z * 0.22 - 0.7) * 0.16 +
    Math.sin((x + z) * 0.42) * 0.06;

  // Rolling regional hills that hide landmarks behind crests
  const northClimb = smoothstep(-10, -52, z) * 2.5;
  const eastOverlookRise = smoothstep(14, 34, x) * smoothstep(-10, -32, z) * 1.9;
  const westernRidge =
    Math.exp(-((x + 24) * (x + 24)) / 180 - ((z + 12) * (z + 12)) / 260) * 3.1;
  const bastionHill =
    smoothstep(19, 0, Math.hypot(x - RUINS_CENTER.x, z - RUINS_CENTER.z)) * 3.1;
  const towerHill =
    smoothstep(22, 6.5, Math.hypot(x - TOWER_CENTER.x, z - TOWER_CENTER.z)) * 3.6;
  const southCragRise =
    smoothstep(22, 0, Math.hypot(x - 44, z - 14)) * 2.4;

  // Gentle flat pads for buildings, ruins, shrine, tower & underground mouths
  const cabinPadDist = Math.hypot(x - CABIN_CENTER.x, z - CABIN_CENTER.z);
  const cottagePadDist = Math.hypot(x - COTTAGE_CENTER.x, z - COTTAGE_CENTER.z);
  const whisperPadDist = Math.hypot(x - SHRINE_CENTER.x, z - SHRINE_CENTER.z);
  const ruinsPadDist = Math.hypot(x - RUINS_CENTER.x, z - RUINS_CENTER.z);
  const towerPadDist = Math.hypot(x - TOWER_CENTER.x, z - TOWER_CENTER.z);
  const cragCavePadDist = Math.hypot(x - CAVE_CRAG_CENTER.x, z - CAVE_CRAG_CENTER.z);
  const weepCavePadDist = Math.hypot(x - CAVE_WEEPING_CENTER.x, z - CAVE_WEEPING_CENTER.z);
  const ancCavePadDist = Math.hypot(x - CAVE_ANCIENT_CENTER.x, z - CAVE_ANCIENT_CENTER.z);
  const citGatePadDist = Math.hypot(x - CITADEL_GATE_CENTER.x, z - CITADEL_GATE_CENTER.z);

  const perimeterFactor = smoothstep(82, 128, distFromCenter);
  const ridgeVariation =
    1 + 0.35 * Math.sin(Math.atan2(z, x) * 5.0 + 0.8) + 0.2 * Math.cos(Math.atan2(z, x) * 9.0);
  const perimeterRidge = perimeterFactor * perimeterFactor * 18.5 * ridgeVariation;

  const outerRim =
    smoothstep(115, 165, distFromCenter) * (14 + 8 * Math.sin(x * 0.06) * Math.cos(z * 0.06));

  let h =
    macroHills * (0.12 + 0.88 * clearingFlatness) +
    microBump +
    northClimb +
    eastOverlookRise +
    westernRidge +
    bastionHill +
    towerHill +
    southCragRise +
    perimeterRidge +
    outerRim;

  // Flatten sanctuary glade, homestead yard, cottage clearing, ruin terrace & tower hilltop
  if (whisperPadDist < 15.5) {
    const padBlend = 1 - smoothstep(7.8, 15.5, whisperPadDist);
    h = THREE.MathUtils.lerp(h, 1.35 + microBump * 0.25, padBlend * 0.92);
  }
  if (cabinPadDist < 14.5) {
    const padBlend = 1 - smoothstep(7.2, 14.5, cabinPadDist);
    h = THREE.MathUtils.lerp(h, 2.35 + microBump * 0.2, padBlend * 0.94);
  }
  if (cottagePadDist < 10.5) {
    const padBlend = 1 - smoothstep(4.8, 10.5, cottagePadDist);
    h = THREE.MathUtils.lerp(h, 1.85 + microBump * 0.2, padBlend * 0.9);
  }
  if (ruinsPadDist < 15.5) {
    const padBlend = 1 - smoothstep(7.5, 15.5, ruinsPadDist);
    h = THREE.MathUtils.lerp(h, 5.1 + microBump * 0.18, padBlend * 0.94);
  }
  if (towerPadDist < 12.0) {
    const padBlend = 1 - smoothstep(6.2, 12.0, towerPadDist);
    h = THREE.MathUtils.lerp(h, 5.8 + microBump * 0.18, padBlend * 0.94);
  }
  if (cragCavePadDist < 10.0) {
    const padBlend = 1 - smoothstep(4.2, 10.0, cragCavePadDist);
    h = THREE.MathUtils.lerp(h, 2.95 + microBump * 0.2, padBlend * 0.9);
  }
  if (weepCavePadDist < 10.0) {
    const padBlend = 1 - smoothstep(4.2, 10.0, weepCavePadDist);
    h = THREE.MathUtils.lerp(h, 1.65 + microBump * 0.2, padBlend * 0.9);
  }
  if (ancCavePadDist < 10.0) {
    const padBlend = 1 - smoothstep(4.2, 10.0, ancCavePadDist);
    h = THREE.MathUtils.lerp(h, 0.95 + microBump * 0.2, padBlend * 0.9);
  }
  if (citGatePadDist < 11.0) {
    const padBlend = 1 - smoothstep(4.6, 11.0, citGatePadDist);
    h = THREE.MathUtils.lerp(h, 2.25 + microBump * 0.2, padBlend * 0.92);
  }

  // Shallow Misty Bog Hollow on western edge of the clearing
  const bogDist = Math.hypot(x - BOG_CENTER.x, (z - BOG_CENTER.z) * 0.82);
  const bogDip = (1 - smoothstep(2.8, 8.2, bogDist)) * 0.92;
  h -= bogDip;

  // Carve / level the winding dirt paths
  const pMask = pathMaskAt(x, z);
  if (pMask > 0.01) {
    const smoothPathHeight =
      northClimb +
      eastOverlookRise +
      bastionHill * 0.9 +
      southCragRise * 0.85 +
      macroHills * 0.38 +
      Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.25;
    h = THREE.MathUtils.lerp(h, smoothPathHeight, pMask * 0.65);
  }

  return h;
}

export function groundHeightAt(x: number, z: number): number {
  let h = baseTerrainElevation(x, z);

  // Carve winding Blackwater Brook channel
  const sDist = streamDistanceAt(x, z);
  if (sDist < 3.6) {
    const channelCarve = (1 - smoothstep(0.65, 3.6, sDist)) * 1.15;
    h -= channelCarve;
  }

  // Carve Silvermire Pond basin in the eastern hollow
  const pondDist = Math.hypot((x - POND_CENTER.x) * 0.88, (z - POND_CENTER.z) * 1.05);
  if (pondDist < 10.5) {
    const pondCarve = (1 - smoothstep(3.2, 10.5, pondDist)) * 1.35;
    h -= pondCarve;
  }

  return h;
}

export function getPondWaterLevel(): number {
  return baseTerrainElevation(POND_CENTER.x, POND_CENTER.z) - 0.52;
}

/**
 * Computes bridge deck elevation in world space when (x, z) lies on the wooden bridge span.
 */
export function bridgeDeckHeightAt(x: number, z: number): number | null {
  const dx = x - BRIDGE_CENTER.x;
  const dz = z - BRIDGE_CENTER.z;
  const cos = Math.cos(BRIDGE_YAW);
  const sin = Math.sin(BRIDGE_YAW);

  // Local u (width across deck), v (length along deck)
  const localU = dx * cos - dz * sin;
  const localV = dx * sin + dz * cos;

  if (Math.abs(localU) > BRIDGE_HALF_WIDTH || Math.abs(localV) > BRIDGE_HALF_LENGTH) {
    return null;
  }

  const endSouthX = BRIDGE_CENTER.x - sin * BRIDGE_HALF_LENGTH;
  const endSouthZ = BRIDGE_CENTER.z - cos * BRIDGE_HALF_LENGTH;
  const endNorthX = BRIDGE_CENTER.x + sin * BRIDGE_HALF_LENGTH;
  const endNorthZ = BRIDGE_CENTER.z + cos * BRIDGE_HALF_LENGTH;

  const bankSouthY = groundHeightAt(endSouthX, endSouthZ);
  const bankNorthY = groundHeightAt(endNorthX, endNorthZ);
  const t = THREE.MathUtils.clamp((localV + BRIDGE_HALF_LENGTH) / (BRIDGE_HALF_LENGTH * 2), 0, 1);

  return THREE.MathUtils.lerp(bankSouthY, bankNorthY, t) + Math.sin(t * Math.PI) * 0.48;
}

function worldToLocalLandmark(
  x: number,
  z: number,
  cx: number,
  cz: number,
  yaw: number
): { lx: number; lz: number } {
  const dx = x - cx;
  const dz = z - cz;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
}

export function landmarkFloorHeightAt(x: number, z: number): number | null {
  // 1. Hollowbark Homestead (Enlarged manor portico steps & covered porch deck)
  const cDistSq = (x - CABIN_CENTER.x) ** 2 + (z - CABIN_CENTER.z) ** 2;
  if (cDistSq < 64) {
    const { lx, lz } = worldToLocalLandmark(x, z, CABIN_CENTER.x, CABIN_CENTER.z, CABIN_YAW);
    const base = groundHeightAt(CABIN_CENTER.x, CABIN_CENTER.z) - 0.06;
    if (Math.abs(lx) <= 1.85 && lz >= 4.4 && lz <= 6.2) {
      const t = 1 - THREE.MathUtils.clamp((lz - 4.4) / 1.8, 0, 1);
      return base + t * 0.42;
    }
    if (Math.abs(lx) <= 2.4 && lz >= 2.7 && lz <= 4.45) {
      return base + 0.42;
    }
  }

  // 2. Elderwood Cottage (Wooden front porch & entry step)
  const cotDistSq = (x - COTTAGE_CENTER.x) ** 2 + (z - COTTAGE_CENTER.z) ** 2;
  if (cotDistSq < 36) {
    const { lx, lz } = worldToLocalLandmark(x, z, COTTAGE_CENTER.x, COTTAGE_CENTER.z, COTTAGE_YAW);
    const base = groundHeightAt(COTTAGE_CENTER.x, COTTAGE_CENTER.z) - 0.06;
    if (Math.abs(lx) <= 1.4 && lz >= 1.9 && lz <= 3.5) {
      const t = 1 - THREE.MathUtils.clamp((lz - 1.9) / 1.6, 0, 1);
      return base + t * 0.28;
    }
  }

  // 3. Ancient Ruin (Mossy Bastion stairs, expanded courtyard & upper aqueduct dais)
  const rDistSq = (x - RUINS_CENTER.x) ** 2 + (z - RUINS_CENTER.z) ** 2;
  if (rDistSq < 144) {
    const { lx, lz } = worldToLocalLandmark(x, z, RUINS_CENTER.x, RUINS_CENTER.z, RUINS_YAW);
    const base = groundHeightAt(RUINS_CENTER.x, RUINS_CENTER.z) - 0.1;
    if (Math.abs(lx) <= 2.4 && lz >= 5.2 && lz <= 7.8) {
      const t = 1 - THREE.MathUtils.clamp((lz - 5.2) / 2.6, 0, 1);
      return base + t * 0.42;
    }
    if (Math.abs(lx) <= 6.8 && lz >= -0.4 && lz <= 5.25) {
      return base + 0.42;
    }
    if (Math.abs(lx) <= 2.1 && lz >= -1.4 && lz <= -0.25) {
      const t = 1 - THREE.MathUtils.clamp((lz + 1.4) / 1.15, 0, 1);
      return base + 0.42 + t * 0.36;
    }
    if (Math.abs(lx) <= 5.6 && lz >= -6.2 && lz <= -1.3) {
      return base + 0.78;
    }
  }

  // 4. Sanctum of Whispering Roots (Monumental stairs, forecourt & upper portal steps)
  const sDistSq = (x - SHRINE_CENTER.x) ** 2 + (z - SHRINE_CENTER.z) ** 2;
  if (sDistSq < 110) {
    const { lx, lz } = worldToLocalLandmark(x, z, SHRINE_CENTER.x, SHRINE_CENTER.z, SHRINE_YAW);
    const base = groundHeightAt(SHRINE_CENTER.x, SHRINE_CENTER.z) - 0.08;
    if (Math.abs(lx) <= 2.2 && lz >= 4.0 && lz <= 7.2) {
      const t = 1 - THREE.MathUtils.clamp((lz - 4.0) / 3.2, 0, 1);
      return base + t * 0.42;
    }
    if (Math.abs(lx) <= 5.8 && lz >= -4.2 && lz <= 4.1) {
      if (Math.abs(lx) <= 1.8 && lz >= -3.1 && lz <= -1.2) {
        const t = 1 - THREE.MathUtils.clamp((lz + 3.1) / 1.9, 0, 1);
        return base + 0.42 + t * 0.48;
      }
      return base + 0.42;
    }
  }

  // 5. Greywatch Tower (Mossy hillside stone stairs & wide fortified base terrace)
  const tDistSq = (x - TOWER_CENTER.x) ** 2 + (z - TOWER_CENTER.z) ** 2;
  if (tDistSq < 144) {
    const { lx, lz } = worldToLocalLandmark(x, z, TOWER_CENTER.x, TOWER_CENTER.z, TOWER_YAW);
    const base = groundHeightAt(TOWER_CENTER.x, TOWER_CENTER.z) - 0.12;
    if (Math.abs(lx) <= 1.65 && lz >= 3.8 && lz <= 10.6) {
      const t = 1 - THREE.MathUtils.clamp((lz - 3.8) / 6.8, 0, 1);
      return Math.max(groundHeightAt(x, z), base - 1.35 + t * 1.95);
    }
    if (Math.hypot(lx, lz + 0.4) <= 6.8) {
      return base + 0.6;
    }
  }

  // 6. Sunken Citadel Gate threshold steps
  const gDistSq = (x - CITADEL_GATE_CENTER.x) ** 2 + (z - CITADEL_GATE_CENTER.z) ** 2;
  if (gDistSq < 49) {
    const { lx, lz } = worldToLocalLandmark(x, z, CITADEL_GATE_CENTER.x, CITADEL_GATE_CENTER.z, CITADEL_GATE_YAW);
    const base = groundHeightAt(CITADEL_GATE_CENTER.x, CITADEL_GATE_CENTER.z) - 0.08;
    if (Math.abs(lx) <= 2.3 && lz >= 1.2 && lz <= 4.6) {
      const t = 1 - THREE.MathUtils.clamp((lz - 1.2) / 3.4, 0, 1);
      return base + t * 0.35;
    }
  }

  return null;
}

/**
 * Returns the walkable floor height at (x, z), accounting for elevated bridge planks and stone landmarks.
 */
export function walkableHeightAt(x: number, z: number): number {
  const groundY = groundHeightAt(x, z);
  const deckY = bridgeDeckHeightAt(x, z);
  const landmarkY = landmarkFloorHeightAt(x, z);
  let best = groundY;
  if (deckY !== null && deckY > best) best = deckY;
  if (landmarkY !== null && landmarkY > best) best = landmarkY;
  return best;
}

export function groundSlopeAt(x: number, z: number): number {
  const eps = 0.6;
  const hL = walkableHeightAt(x - eps, z);
  const hR = walkableHeightAt(x + eps, z);
  const hD = walkableHeightAt(x, z - eps);
  const hU = walkableHeightAt(x, z + eps);
  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  return Math.hypot(dx, dz);
}

/**
 * Builds an angular 128x128 retro terrain mesh across the expanded 300m forest region
 * using lightweight MeshLambertMaterial + vertex ambient shading.
 */
export function buildTerrainMesh(colorMap: THREE.CanvasTexture): THREE.Mesh {
  const size = 320;
  const segments = 128;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cMoss = new THREE.Color('#4c6049');
  const cDeepForest = new THREE.Color('#324234');
  const cCanopyShadow = new THREE.Color('#222e24');
  const cPathEarth = new THREE.Color('#75624e');
  const cPathCenter = new THREE.Color('#8c765f');
  const cBogMud = new THREE.Color('#3b3d3a');
  const cStreamBank = new THREE.Color('#434740');
  const cRockSlope = new THREE.Color('#5b646c');
  const cTmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const eps = 0.8;
    const slope = Math.hypot(
      (groundHeightAt(x + eps, z) - groundHeightAt(x - eps, z)) / (2 * eps),
      (groundHeightAt(x, z + eps) - groundHeightAt(x, z - eps)) / (2 * eps)
    );
    const dist = Math.hypot(x, z);
    const pMask = pathMaskAt(x, z);
    const clearingMix =
      Math.max(
        1 - smoothstep(4.5, 11.5, dist),
        1 - smoothstep(5.0, 10.5, Math.hypot(x + 46, z + 18))
      );
    const bogDist = Math.hypot(x - BOG_CENTER.x, (z - BOG_CENTER.z) * 0.82);
    const bogMix = 1 - smoothstep(2.5, 7.6, bogDist);
    const streamDist = streamDistanceAt(x, z);
    const pondDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
    const waterBankMix = Math.max(
      1 - smoothstep(1.2, 3.8, streamDist),
      1 - smoothstep(3.5, 10.2, pondDist)
    );

    const grove = groveDensityAt(x, z);
    const canopyShadowMix =
      smoothstep(7.5, 19.0, dist) * (1 - pMask * 0.88) * (1 - clearingMix) * (0.45 + 0.55 * grove);
    const noisePatch = 0.5 + 0.5 * Math.sin(x * 0.17) * Math.cos(z * 0.19);
    const mossPatch = 0.5 + 0.5 * Math.cos(x * 0.31 + z * 0.27);

    cTmp.copy(cDeepForest).lerp(cMoss, 0.26 + 0.48 * clearingMix + 0.18 * noisePatch + 0.12 * mossPatch);
    cTmp.lerp(cCanopyShadow, canopyShadowMix * 0.68);

    if (bogMix > 0.01) {
      cTmp.lerp(cBogMud, bogMix * 0.85);
    }

    if (waterBankMix > 0.01) {
      cTmp.lerp(cStreamBank, waterBankMix * 0.78);
    }

    if (pMask > 0.01) {
      const innerPath = smoothstep(0.45, 0.95, pMask);
      const pathCol = cPathEarth.clone().lerp(cPathCenter, innerPath);
      cTmp.lerp(pathCol, pMask * 0.9);
    }

    const rockMix = smoothstep(0.36, 0.88, slope);
    if (rockMix > 0.01) {
      cTmp.lerp(cRockSlope, rockMix * 0.88);
    }

    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    map: colorMap,
    vertexColors: true,
  });
  applyRetroVertexSnap(mat, 200);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'ForestTerrain';
  return mesh;
}

export function getMainPathSamples(): { x: number; z: number }[] {
  return allPathSamples;
}
