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

// 5. Outer North Deepwood track: Sunken Gate -> Greywatch Ridge -> Deepwood Clearing
const NORTH_DEEPWOOD_POINTS = [
  new THREE.Vector3(-16.0, 0, -47.0),
  new THREE.Vector3(-21.0, 0, -66.0),
  new THREE.Vector3(-20.0, 0, -90.0),
  new THREE.Vector3(-18.0, 0, -114.0),
  new THREE.Vector3(-22.0, 0, -134.0),
];

// 6. Outer Western Stonefall Canyon track: West Loop -> Stonefall Pass -> Stone Circle
const WEST_STONEFALL_POINTS = [
  new THREE.Vector3(-50.0, 0, 3.0),
  new THREE.Vector3(-68.0, 0, -4.0),
  new THREE.Vector3(-88.0, 0, -14.0),
  new THREE.Vector3(-106.0, 0, -24.0),
  new THREE.Vector3(-121.0, 0, -32.0),
];

// 7. Outer Southern Thornwood Bridle Path: Elderwood -> Thornwood Glades
const SOUTH_GLADES_POINTS = [
  new THREE.Vector3(14.0, 0, 15.0),
  new THREE.Vector3(17.5, 0, 38.0),
  new THREE.Vector3(14.5, 0, 66.0),
  new THREE.Vector3(11.0, 0, 92.0),
  new THREE.Vector3(8.5, 0, 118.0),
];

// 8. Outer Eastern Highland Track: Silvermire Shore -> Silverwind Ford -> Highland Watch-Ruin
const EAST_HIGHLAND_POINTS = [
  new THREE.Vector3(56.0, 0, -12.0),
  new THREE.Vector3(76.0, 0, -8.5),
  new THREE.Vector3(93.0, 0, -14.0),
  new THREE.Vector3(108.5, 0, -18.0), // Natural rock ford over Silverwind Creek
  new THREE.Vector3(123.0, 0, -18.0),
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

// Outer Highland River: Silverwind Creek -> Waterfall Ledge -> Cascade Pool -> Gorge
export const SILVERWIND_STREAM_POINTS = [
  new THREE.Vector3(118.0, 0, -96.0),
  new THREE.Vector3(116.0, 0, -72.0),
  new THREE.Vector3(114.0, 0, -53.0),
  new THREE.Vector3(112.0, 0, -42.5),
  new THREE.Vector3(109.0, 0, -26.0),
  new THREE.Vector3(108.5, 0, -12.0),
  new THREE.Vector3(113.0, 0, 14.0),
  new THREE.Vector3(118.0, 0, 46.0),
];

const mainCurve = new THREE.CatmullRomCurve3(MAIN_PATH_POINTS);
const eastCurve = new THREE.CatmullRomCurve3(EAST_PATH_POINTS);
const westCurve = new THREE.CatmullRomCurve3(WEST_LOOP_POINTS);
const southEastCurve = new THREE.CatmullRomCurve3(SOUTH_EAST_POINTS);
const northDeepwoodCurve = new THREE.CatmullRomCurve3(NORTH_DEEPWOOD_POINTS);
const westStonefallCurve = new THREE.CatmullRomCurve3(WEST_STONEFALL_POINTS);
const southGladesCurve = new THREE.CatmullRomCurve3(SOUTH_GLADES_POINTS);
const eastHighlandCurve = new THREE.CatmullRomCurve3(EAST_HIGHLAND_POINTS);

export const streamCurve = new THREE.CatmullRomCurve3(STREAM_POINTS);
export const silverwindCurve = new THREE.CatmullRomCurve3(SILVERWIND_STREAM_POINTS);

const allPathSamples: { x: number; z: number }[] = [
  ...mainCurve.getPoints(72).map((p) => ({ x: p.x, z: p.z })),
  ...eastCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
  ...westCurve.getPoints(60).map((p) => ({ x: p.x, z: p.z })),
  ...southEastCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
  ...northDeepwoodCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
  ...westStonefallCurve.getPoints(48).map((p) => ({ x: p.x, z: p.z })),
  ...southGladesCurve.getPoints(52).map((p) => ({ x: p.x, z: p.z })),
  ...eastHighlandCurve.getPoints(44).map((p) => ({ x: p.x, z: p.z })),
];

const streamSamples: { x: number; z: number }[] = streamCurve
  .getPoints(64)
  .map((p) => ({ x: p.x, z: p.z }));

const silverwindSamples: { x: number; z: number }[] = silverwindCurve
  .getPoints(80)
  .map((p) => ({ x: p.x, z: p.z }));

export const PLAYABLE_BOUNDS_RADIUS = 168;
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

// New Outer Region Anchors (Prompt 4)
export const DEEPWOOD_NORTH_CENTER = { x: -19.0, z: -116.0 };
export const FEN_NORTH_CENTER = { x: 26.0, z: -124.0 };
export const CASCADE_CENTER = { x: 112.5, z: -43.0 };
export const HIGHLAND_RUIN_CENTER = { x: 124.0, z: -18.0 };
export const THORNWOOD_GLADES_CENTER = { x: 10.0, z: 108.0 };
export const WAYSTATION_CENTER = { x: 62.0, z: 98.0 };
export const STONEFALL_CIRCLE_CENTER = { x: -122.0, z: -32.0 };
export const MOOR_POND_CENTER = { x: -108.0, z: 62.0 };

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
  // Outer Expanded Regions (Prompt 4)
  { id: 'deepwood_north', name: 'Northern Deepwood', x: DEEPWOOD_NORTH_CENTER.x, z: DEEPWOOD_NORTH_CENTER.z, radius: 20.0 },
  { id: 'fen_north', name: 'Whispering Fen Tarn', x: FEN_NORTH_CENTER.x, z: FEN_NORTH_CENTER.z, radius: 18.0 },
  { id: 'silverwind_waterfall', name: 'Silverwind Cascade', x: CASCADE_CENTER.x, z: CASCADE_CENTER.z, radius: 18.0 },
  { id: 'highland_crags', name: 'Highland Watch-Ruin', x: HIGHLAND_RUIN_CENTER.x, z: HIGHLAND_RUIN_CENTER.z, radius: 18.0 },
  { id: 'thornwood_glades', name: 'Thornwood Glades', x: THORNWOOD_GLADES_CENTER.x, z: THORNWOOD_GLADES_CENTER.z, radius: 22.0 },
  { id: 'abandoned_waystation', name: 'Old Timber Waystation', x: WAYSTATION_CENTER.x, z: WAYSTATION_CENTER.z, radius: 16.0 },
  { id: 'stonefall_valley', name: 'Stonefall Stone Circle', x: STONEFALL_CIRCLE_CENTER.x, z: STONEFALL_CIRCLE_CENTER.z, radius: 19.0 },
  { id: 'western_moor', name: 'Western Moorland Tarn', x: MOOR_POND_CENTER.x, z: MOOR_POND_CENTER.z, radius: 19.0 },
];

export type TerrainBiome =
  | 'clearing'
  | 'deepwood'
  | 'rocky'
  | 'wetland'
  | 'riverbank'
  | 'glade';

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
  // Extra dense northern & southern woods, sparser rocky crags in far east/west
  const northBias = smoothstep(-50, -110, z) * 0.16;
  const rockyThin = smoothstep(88, 128, x) * 0.22;
  return THREE.MathUtils.clamp(0.54 + macro + micro + northBias - rockyThin, 0, 1);
}

export function pathMaskAt(x: number, z: number): number {
  const d = pathDistanceAt(x, z);
  return 1 - smoothstep(1.05, 2.45, d);
}

export function brookDistanceAt(x: number, z: number): number {
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

export function silverwindDistanceAt(x: number, z: number): number {
  let minDistSq = Infinity;
  for (let i = 0; i < silverwindSamples.length; i++) {
    const p = silverwindSamples[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minDistSq) minDistSq = d2;
  }
  return Math.sqrt(minDistSq);
}

export function streamDistanceAt(x: number, z: number): number {
  return Math.min(brookDistanceAt(x, z), silverwindDistanceAt(x, z));
}

export function biomeAt(x: number, z: number): TerrainBiome {
  if (Math.hypot(x, z) < 16) return 'clearing';
  if (
    Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 12 ||
    Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 22 ||
    Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 26
  ) {
    return 'wetland';
  }
  if (streamDistanceAt(x, z) < 6.5 || Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 14) {
    return 'riverbank';
  }
  if (
    x > 86 ||
    Math.hypot(x - STONEFALL_CIRCLE_CENTER.x, z - STONEFALL_CIRCLE_CENTER.z) < 34 ||
    Math.hypot(x - 44, z - 14) < 18
  ) {
    return 'rocky';
  }
  if (z > 68 && Math.hypot(x - THORNWOOD_GLADES_CENTER.x, z - THORNWOOD_GLADES_CENTER.z) < 42) {
    return 'glade';
  }
  return 'deepwood';
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

  // Outer region relief (highland plateau for cascade, western stonefall canyon ridges, deepwood swells)
  const eastHighlandPlateau =
    smoothstep(86, 114, x) * smoothstep(-40, -58, z) * 4.4;
  const highlandWatchRise =
    smoothstep(28, 8, Math.hypot(x - HIGHLAND_RUIN_CENTER.x, z - HIGHLAND_RUIN_CENTER.z)) * 2.4;
  const stonefallRidgeNorth =
    Math.exp(-((x + 104) * (x + 104)) / 420 - ((z + 58) * (z + 58)) / 260) * 4.2;
  const stonefallRidgeSouth =
    Math.exp(-((x + 108) * (x + 108)) / 420 - ((z - 8) * (z - 8)) / 260) * 3.8;
  const southernGladeSwell =
    smoothstep(65, 130, z) * (1.2 + 0.9 * Math.sin(x * 0.04));

  // Gentle flat pads for existing & outer landmarks
  const cabinPadDist = Math.hypot(x - CABIN_CENTER.x, z - CABIN_CENTER.z);
  const cottagePadDist = Math.hypot(x - COTTAGE_CENTER.x, z - COTTAGE_CENTER.z);
  const whisperPadDist = Math.hypot(x - SHRINE_CENTER.x, z - SHRINE_CENTER.z);
  const ruinsPadDist = Math.hypot(x - RUINS_CENTER.x, z - RUINS_CENTER.z);
  const towerPadDist = Math.hypot(x - TOWER_CENTER.x, z - TOWER_CENTER.z);
  const cragCavePadDist = Math.hypot(x - CAVE_CRAG_CENTER.x, z - CAVE_CRAG_CENTER.z);
  const weepCavePadDist = Math.hypot(x - CAVE_WEEPING_CENTER.x, z - CAVE_WEEPING_CENTER.z);
  const ancCavePadDist = Math.hypot(x - CAVE_ANCIENT_CENTER.x, z - CAVE_ANCIENT_CENTER.z);
  const citGatePadDist = Math.hypot(x - CITADEL_GATE_CENTER.x, z - CITADEL_GATE_CENTER.z);

  const deepwoodPadDist = Math.hypot(x - DEEPWOOD_NORTH_CENTER.x, z - DEEPWOOD_NORTH_CENTER.z);
  const highlandRuinPadDist = Math.hypot(x - HIGHLAND_RUIN_CENTER.x, z - HIGHLAND_RUIN_CENTER.z);
  const waystationPadDist = Math.hypot(x - WAYSTATION_CENTER.x, z - WAYSTATION_CENTER.z);
  const stonefallPadDist = Math.hypot(x - STONEFALL_CIRCLE_CENTER.x, z - STONEFALL_CIRCLE_CENTER.z);
  const gladesPadDist = Math.hypot(x - THORNWOOD_GLADES_CENTER.x, z - THORNWOOD_GLADES_CENTER.z);

  // Outer perimeter mountain ring shifted outward to r=158..206 so inner r<=85 stays identical
  const perimeterFactor = smoothstep(158, 206, distFromCenter);
  const ridgeVariation =
    1 + 0.35 * Math.sin(Math.atan2(z, x) * 5.0 + 0.8) + 0.2 * Math.cos(Math.atan2(z, x) * 9.0);
  const perimeterRidge = perimeterFactor * perimeterFactor * 21.0 * ridgeVariation;

  const outerRim =
    smoothstep(188, 232, distFromCenter) * (15 + 8 * Math.sin(x * 0.05) * Math.cos(z * 0.05));

  let h =
    macroHills * (0.12 + 0.88 * clearingFlatness) +
    microBump +
    northClimb +
    eastOverlookRise +
    westernRidge +
    bastionHill +
    towerHill +
    southCragRise +
    eastHighlandPlateau +
    highlandWatchRise +
    stonefallRidgeNorth +
    stonefallRidgeSouth +
    southernGladeSwell +
    perimeterRidge +
    outerRim;

  // Carve / level the winding dirt paths before flattening landmark clearing pads
  const pMask = pathMaskAt(x, z);
  if (pMask > 0.01) {
    const smoothPathHeight =
      northClimb +
      eastOverlookRise +
      bastionHill * 0.9 +
      southCragRise * 0.85 +
      eastHighlandPlateau * 0.7 +
      highlandWatchRise * 0.9 +
      southernGladeSwell * 0.8 +
      macroHills * 0.38 +
      Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.25;
    h = THREE.MathUtils.lerp(h, smoothPathHeight, pMask * 0.65);
  }

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
  if (ruinsPadDist < 16.5) {
    const padBlend = 1 - smoothstep(8.5, 16.5, ruinsPadDist);
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

  // Outer Region Landmark Pads
  if (deepwoodPadDist < 16.0) {
    const padBlend = 1 - smoothstep(7.5, 16.0, deepwoodPadDist);
    h = THREE.MathUtils.lerp(h, 2.55 + microBump * 0.2, padBlend * 0.88);
  }
  if (highlandRuinPadDist < 15.0) {
    const padBlend = 1 - smoothstep(7.5, 15.0, highlandRuinPadDist);
    h = THREE.MathUtils.lerp(h, 3.85 + microBump * 0.18, padBlend * 0.92);
  }
  if (waystationPadDist < 14.0) {
    const padBlend = 1 - smoothstep(6.5, 14.0, waystationPadDist);
    h = THREE.MathUtils.lerp(h, 2.05 + microBump * 0.18, padBlend * 0.9);
  }
  if (stonefallPadDist < 16.5) {
    const padBlend = 1 - smoothstep(8.2, 16.5, stonefallPadDist);
    h = THREE.MathUtils.lerp(h, 2.2 + microBump * 0.18, padBlend * 0.92);
  }
  if (gladesPadDist < 17.0) {
    const padBlend = 1 - smoothstep(8.5, 17.0, gladesPadDist);
    h = THREE.MathUtils.lerp(h, 1.55 + microBump * 0.2, padBlend * 0.86);
  }

  // Shallow Misty Bog Hollow on western edge of the clearing
  const bogDist = Math.hypot(x - BOG_CENTER.x, (z - BOG_CENTER.z) * 0.82);
  const bogDip = (1 - smoothstep(2.8, 8.2, bogDist)) * 0.92;
  h -= bogDip;

  return h;
}

export function groundHeightAt(x: number, z: number): number {
  let h = baseTerrainElevation(x, z);

  // Carve winding Blackwater Brook channel
  const sDist = brookDistanceAt(x, z);
  if (sDist < 3.6) {
    const channelCarve = (1 - smoothstep(0.65, 3.6, sDist)) * 1.15;
    h -= channelCarve;
  }

  // Carve Silverwind Gorge creek channel (shallower near the eastern ford z ~ -18)
  const swDist = silverwindDistanceAt(x, z);
  if (swDist < 4.1) {
    const fordShallow = 1 - 0.52 * (1 - smoothstep(2.0, 6.5, Math.abs(z + 18)));
    const channelCarve = (1 - smoothstep(0.85, 4.1, swDist)) * 1.1 * fordShallow;
    h -= channelCarve;
  }

  // Carve Silvermire Pond basin in the eastern hollow
  const pondDist = Math.hypot((x - POND_CENTER.x) * 0.88, (z - POND_CENTER.z) * 1.05);
  if (pondDist < 10.5) {
    const pondCarve = (1 - smoothstep(3.2, 10.5, pondDist)) * 1.35;
    h -= pondCarve;
  }

  // Carve Whispering Fen Tarn in the north-east wetlands
  const fenDist = Math.hypot((x - FEN_NORTH_CENTER.x) * 0.85, (z - FEN_NORTH_CENTER.z) * 1.05);
  if (fenDist < 11.5) {
    const fenCarve = (1 - smoothstep(3.6, 11.5, fenDist)) * 1.18;
    h -= fenCarve;
  }

  // Carve Silverwind Cascade Pool at base of eastern waterfall
  const cascDist = Math.hypot((x - CASCADE_CENTER.x) * 0.92, (z - CASCADE_CENTER.z) * 0.92);
  if (cascDist < 9.5) {
    const cascCarve = (1 - smoothstep(3.0, 9.5, cascDist)) * 1.3;
    h -= cascCarve;
  }

  // Carve Western Moorland Tarn basin
  const moorDist = Math.hypot((x - MOOR_POND_CENTER.x) * 0.84, (z - MOOR_POND_CENTER.z) * 1.08);
  if (moorDist < 12.0) {
    const moorCarve = (1 - smoothstep(3.8, 12.0, moorDist)) * 1.15;
    h -= moorCarve;
  }

  return h;
}

export function getPondWaterLevel(): number {
  return baseTerrainElevation(POND_CENTER.x, POND_CENTER.z) - 0.52;
}

export function getFenWaterLevel(): number {
  return baseTerrainElevation(FEN_NORTH_CENTER.x, FEN_NORTH_CENTER.z) - 0.45;
}

export function getCascadePoolWaterLevel(): number {
  return baseTerrainElevation(CASCADE_CENTER.x, CASCADE_CENTER.z) - 0.52;
}

export function getMoorWaterLevel(): number {
  return baseTerrainElevation(MOOR_POND_CENTER.x, MOOR_POND_CENTER.z) - 0.46;
}

/**
 * Computes bridge deck elevation in world space when (x, z) lies on the wooden bridge span.
 */
export function bridgeDeckHeightAt(x: number, z: number): number | null {
  const dx = x - BRIDGE_CENTER.x;
  const dz = z - BRIDGE_CENTER.z;
  const cos = Math.cos(BRIDGE_YAW);
  const sin = Math.sin(BRIDGE_YAW);

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
  if (cDistSq < 72) {
    const { lx, lz } = worldToLocalLandmark(x, z, CABIN_CENTER.x, CABIN_CENTER.z, CABIN_YAW);
    const base = groundHeightAt(CABIN_CENTER.x, CABIN_CENTER.z) - 0.06;
    if (Math.abs(lx) <= 1.9 && lz >= 4.4 && lz <= 6.55) {
      const t = 1 - THREE.MathUtils.clamp((lz - 4.4) / 2.15, 0, 1);
      return Math.max(groundHeightAt(x, z), base + t * 0.44);
    }
    if (Math.abs(lx) <= 2.45 && lz >= 2.45 && lz <= 4.45) {
      return base + 0.44;
    }
  }

  // 2. Elderwood Cottage (Wooden front porch & entry steps)
  const cotDistSq = (x - COTTAGE_CENTER.x) ** 2 + (z - COTTAGE_CENTER.z) ** 2;
  if (cotDistSq < 42) {
    const { lx, lz } = worldToLocalLandmark(x, z, COTTAGE_CENTER.x, COTTAGE_CENTER.z, COTTAGE_YAW);
    const base = groundHeightAt(COTTAGE_CENTER.x, COTTAGE_CENTER.z) - 0.05;
    if (Math.abs(lx) <= 1.45 && lz >= 2.0 && lz <= 4.05) {
      const t = 1 - THREE.MathUtils.clamp((lz - 2.0) / 2.05, 0, 1);
      return Math.max(groundHeightAt(x, z), base + t * 0.29);
    }
  }

  // 3. Ancient Ruin (Mossy Bastion stairs, expanded courtyard & upper aqueduct dais)
  const rDistSq = (x - RUINS_CENTER.x) ** 2 + (z - RUINS_CENTER.z) ** 2;
  if (rDistSq < 156) {
    const { lx, lz } = worldToLocalLandmark(x, z, RUINS_CENTER.x, RUINS_CENTER.z, RUINS_YAW);
    const base = groundHeightAt(RUINS_CENTER.x, RUINS_CENTER.z) - 0.1;
    if (Math.abs(lx) <= 2.55 && lz >= 5.25 && lz <= 9.6) {
      const t = 1 - THREE.MathUtils.clamp((lz - 5.25) / 4.35, 0, 1);
      const localGround = groundHeightAt(x, z);
      return Math.max(localGround, THREE.MathUtils.lerp(localGround, base + 0.42, t));
    }
    if (Math.abs(lx) <= 6.95 && lz >= -0.95 && lz <= 5.3) {
      if (Math.abs(lx) <= 2.25 && lz >= -1.1 && lz <= 0.18) {
        const t = 1 - THREE.MathUtils.clamp((lz + 1.1) / 1.28, 0, 1);
        return base + 0.42 + t * 0.36;
      }
      return base + 0.42;
    }
    if (Math.abs(lx) <= 5.75 && lz >= -6.2 && lz <= -0.95) {
      return base + 0.78;
    }
  }

  // 4. Sanctum of Whispering Roots (Monumental stairs, forecourt & upper portal steps -> 1.30m podium)
  const sDistSq = (x - SHRINE_CENTER.x) ** 2 + (z - SHRINE_CENTER.z) ** 2;
  if (sDistSq < 121) {
    const { lx, lz } = worldToLocalLandmark(x, z, SHRINE_CENTER.x, SHRINE_CENTER.z, SHRINE_YAW);
    const base = groundHeightAt(SHRINE_CENTER.x, SHRINE_CENTER.z) - 0.08;
    if (Math.abs(lx) <= 2.3 && lz >= 4.1 && lz <= 7.55) {
      const t = 1 - THREE.MathUtils.clamp((lz - 4.1) / 3.45, 0, 1);
      return Math.max(groundHeightAt(x, z), base + t * 0.42);
    }
    if (Math.abs(lx) <= 5.85 && lz >= -4.2 && lz <= 4.15) {
      if (Math.abs(lx) <= 1.85 && lz >= -1.9 && lz <= -0.1) {
        const t = 1 - THREE.MathUtils.clamp((lz + 1.9) / 1.8, 0, 1);
        return base + 0.42 + t * 0.88;
      }
      if (lz < -1.85) {
        return base + 1.3;
      }
      return base + 0.42;
    }
  }

  // 5. Greywatch Tower (Mossy hillside stone stairs & wide fortified base terrace)
  const tDistSq = (x - TOWER_CENTER.x) ** 2 + (z - TOWER_CENTER.z) ** 2;
  if (tDistSq < 169) {
    const { lx, lz } = worldToLocalLandmark(x, z, TOWER_CENTER.x, TOWER_CENTER.z, TOWER_YAW);
    const base = groundHeightAt(TOWER_CENTER.x, TOWER_CENTER.z) - 0.12;
    if (Math.abs(lx) <= 1.75 && lz >= 3.8 && lz <= 11.4) {
      const t = 1 - THREE.MathUtils.clamp((lz - 3.8) / 7.6, 0, 1);
      const localGround = groundHeightAt(x, z);
      return THREE.MathUtils.lerp(localGround, base + 0.63, t);
    }
    if (Math.hypot(lx, lz + 0.4) <= 6.9) {
      return base + 0.63;
    }
  }

  // 6. Sunken Citadel Gate threshold steps & raised terrace
  const gDistSq = (x - CITADEL_GATE_CENTER.x) ** 2 + (z - CITADEL_GATE_CENTER.z) ** 2;
  if (gDistSq < 56) {
    const { lx, lz } = worldToLocalLandmark(x, z, CITADEL_GATE_CENTER.x, CITADEL_GATE_CENTER.z, CITADEL_GATE_YAW);
    const base = groundHeightAt(CITADEL_GATE_CENTER.x, CITADEL_GATE_CENTER.z) - 0.08;
    if (Math.abs(lx) <= 2.4 && lz >= 3.35 && lz <= 4.45) {
      const t = 1 - THREE.MathUtils.clamp((lz - 3.35) / 1.1, 0, 1);
      return Math.max(groundHeightAt(x, z), base + t * 0.35);
    }
    if (Math.abs(lx) <= 2.95 && lz >= -1.0 && lz <= 3.4) {
      return base + 0.35;
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

export function rawTerrainSlopeAt(x: number, z: number): number {
  const eps = 0.6;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  return Math.hypot(dx, dz);
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
 * Builds an angular 160x160 retro terrain mesh across the expanded 460m Thornvale valley
 * using lightweight MeshLambertMaterial + vertex ambient & biome shading.
 */
export function buildTerrainMesh(colorMap: THREE.CanvasTexture): THREE.Mesh {
  const size = 460;
  const segments = 160;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cMoss = new THREE.Color('#4c6049');
  const cDeepForest = new THREE.Color('#324234');
  const cGladeMoss = new THREE.Color('#5b6f50');
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

    const eps = 0.85;
    const slope = Math.hypot(
      (groundHeightAt(x + eps, z) - groundHeightAt(x - eps, z)) / (2 * eps),
      (groundHeightAt(x, z + eps) - groundHeightAt(x, z - eps)) / (2 * eps)
    );
    const dist = Math.hypot(x, z);
    const pMask = pathMaskAt(x, z);
    const clearingMix =
      Math.max(
        1 - smoothstep(4.5, 11.5, dist),
        1 - smoothstep(5.0, 10.5, Math.hypot(x + 46, z + 18)),
        1 - smoothstep(6.0, 18.0, Math.hypot(x - THORNWOOD_GLADES_CENTER.x, z - THORNWOOD_GLADES_CENTER.z))
      );

    const bogDist = Math.hypot(x - BOG_CENTER.x, (z - BOG_CENTER.z) * 0.82);
    const fenDist = Math.hypot(x - FEN_NORTH_CENTER.x, (z - FEN_NORTH_CENTER.z) * 0.88);
    const moorDist = Math.hypot(x - MOOR_POND_CENTER.x, (z - MOOR_POND_CENTER.z) * 0.85);
    const bogMix = Math.max(
      1 - smoothstep(2.5, 7.6, bogDist),
      1 - smoothstep(3.8, 12.2, fenDist),
      1 - smoothstep(4.2, 13.0, moorDist)
    );

    const streamDist = streamDistanceAt(x, z);
    const pondDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
    const cascDist = Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z);
    const waterBankMix = Math.max(
      1 - smoothstep(1.2, 3.8, streamDist),
      1 - smoothstep(3.5, 10.2, pondDist),
      1 - smoothstep(3.2, 9.6, cascDist)
    );

    const grove = groveDensityAt(x, z);
    const canopyShadowMix =
      smoothstep(7.5, 19.0, dist) * (1 - pMask * 0.88) * (1 - clearingMix) * (0.45 + 0.55 * grove);
    const noisePatch = 0.5 + 0.5 * Math.sin(x * 0.17) * Math.cos(z * 0.19);
    const mossPatch = 0.5 + 0.5 * Math.cos(x * 0.31 + z * 0.27);
    const gladeFactor = 1 - smoothstep(18, 44, Math.hypot(x - THORNWOOD_GLADES_CENTER.x, z - THORNWOOD_GLADES_CENTER.z));

    cTmp.copy(cDeepForest).lerp(cMoss, 0.26 + 0.48 * clearingMix + 0.18 * noisePatch + 0.12 * mossPatch);
    if (gladeFactor > 0.01) {
      cTmp.lerp(cGladeMoss, gladeFactor * 0.42);
    }
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

    const rockBias =
      smoothstep(86, 128, x) * 0.28 +
      (1 - smoothstep(12, 34, Math.hypot(x - STONEFALL_CIRCLE_CENTER.x, z - STONEFALL_CIRCLE_CENTER.z))) * 0.24;
    const rockMix = smoothstep(0.36, 0.88, slope + rockBias);
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
