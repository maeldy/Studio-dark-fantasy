import {
  biomeAt,
  BOG_CENTER,
  BOG_WATER_LEVEL,
  bridgeDeckHeightAt,
  brookDistanceAt,
  CASCADE_CENTER,
  FEN_NORTH_CENTER,
  getCascadePoolWaterLevel,
  getFenWaterLevel,
  getMoorWaterLevel,
  getPondWaterLevel,
  groundHeightAt,
  groveDensityAt,
  landmarkFloorHeightAt,
  MOOR_POND_CENTER,
  pathMaskAt,
  POND_CENTER,
  rawTerrainSlopeAt,
  RUINS_CENTER,
  SHRINE_CENTER,
  silverwindDistanceAt,
  TOWER_CENTER,
  CITADEL_GATE_CENTER,
  HIGHLAND_RUIN_CENTER,
  STONEFALL_CIRCLE_CENTER,
  CABIN_CENTER,
  COTTAGE_CENTER,
} from '../game/terrain';
import { EnvironmentAtmosphere, InteriorId } from '../game/types';
import { SurfaceKind, ThornvaleAudioBiomeId } from './audioCatalog';

export interface SpatialAudioContext {
  biome: ThornvaleAudioBiomeId;
  surface: SurfaceKind;
  waterDepth: number;
  inWater: boolean;
  waterProximity: number; // 0..1 proximity to brook, river, pond, cascade
  waterfallProximity: number; // 0..1 proximity to Silverwind Cascade
  isInterior: boolean;
  interiorId: InteriorId | null;
  interiorKind: 'none' | 'small_house' | 'castle_hall' | 'ruin_sanctum' | 'small_cave' | 'large_cave' | 'dungeon';
  altitudeFactor: number; // 0..1 higher in crags/mountains/towers
  nearFire: boolean;
  canopyDensity: number;
  inCastleZone: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function detectSpatialAudioContext(params: {
  x: number;
  y: number;
  z: number;
  isInterior: boolean;
  interiorId: InteriorId | null;
  interiorAtmosphere: EnvironmentAtmosphere;
  nearFire: boolean;
}): SpatialAudioContext {
  const { x, y, z, isInterior, interiorId, nearFire } = params;

  if (isInterior && interiorId) {
    if (interiorId === 'cabin_interior' || interiorId === 'cottage_interior') {
      const inCottageCellar = interiorId === 'cottage_interior' && y < -0.5;
      return {
        biome: 'villages',
        surface: inCottageCellar ? 'stone' : 'wood',
        waterDepth: 0,
        inWater: false,
        waterProximity: 0,
        waterfallProximity: 0,
        isInterior: true,
        interiorId,
        interiorKind: 'small_house',
        altitudeFactor: 0,
        nearFire,
        canopyDensity: 0,
        inCastleZone: false,
      };
    }
    if (interiorId === 'tower_interior') {
      const onTimberLanding = y >= 2.8 && y < 6.1 && x > -4.1;
      return {
        biome: 'chateaux',
        surface: onTimberLanding ? 'wood' : 'stone',
        waterDepth: 0,
        inWater: false,
        waterProximity: 0,
        waterfallProximity: 0,
        isInterior: true,
        interiorId,
        interiorKind: 'castle_hall',
        altitudeFactor: clamp01((y - 1.5) / 10),
        nearFire,
        canopyDensity: 0,
        inCastleZone: true,
      };
    }
    if (interiorId === 'shrine_interior') {
      return {
        biome: 'sanctuaires',
        surface: 'stone',
        waterDepth: 0,
        inWater: false,
        waterProximity: 0,
        waterfallProximity: 0,
        isInterior: true,
        interiorId,
        interiorKind: 'ruin_sanctum',
        altitudeFactor: 0,
        nearFire,
        canopyDensity: 0,
        inCastleZone: true,
      };
    }
    if (interiorId === 'cave_weeping') {
      return {
        biome: 'grottes',
        surface: 'cave',
        waterDepth: 0,
        inWater: false,
        waterProximity: 0.28,
        waterfallProximity: 0,
        isInterior: true,
        interiorId,
        interiorKind: 'small_cave',
        altitudeFactor: 0,
        nearFire,
        canopyDensity: 0,
        inCastleZone: false,
      };
    }
    if (interiorId === 'cave_cragstone' || interiorId === 'cave_ancient') {
      const onCragWoodBridge =
        interiorId === 'cave_cragstone' && Math.abs(x) <= 1.25 && z >= -6.2 && z <= 2.2 && y >= -0.35;
      return {
        biome: 'grottes',
        surface: onCragWoodBridge ? 'wood' : 'cave',
        waterDepth: 0,
        inWater: false,
        waterProximity: interiorId === 'cave_cragstone' ? 0.22 : 0.12,
        waterfallProximity: 0,
        isInterior: true,
        interiorId,
        interiorKind: 'large_cave',
        altitudeFactor: 0,
        nearFire,
        canopyDensity: 0,
        inCastleZone: false,
      };
    }
    // dungeon_catacombs / dungeon_vault
    return {
      biome: 'donjons',
      surface: 'dungeon',
      waterDepth: 0,
      inWater: false,
      waterProximity: 0,
      waterfallProximity: 0,
      isInterior: true,
      interiorId,
      interiorKind: 'dungeon',
      altitudeFactor: 0,
      nearFire,
      canopyDensity: 0,
      inCastleZone: true,
    };
  }

  // --- Exterior Overworld Detection ---
  const terrainBiome = biomeAt(x, z);
  const groundY = groundHeightAt(x, z);
  const slope = rawTerrainSlopeAt(x, z);
  const pathMask = pathMaskAt(x, z);
  const canopy = groveDensityAt(x, z);

  // Check bridges & raised architectural stone/wood floors first
  const onBridge = bridgeDeckHeightAt(x, z) !== null;
  const onLandmarkFloor = landmarkFloorHeightAt(x, z) !== null;

  // Water bodies & depth calculation
  let waterDepth = 0;
  if (!onBridge && !onLandmarkFloor) {
    const bogDist = Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z);
    if (bogDist < 9.2 && groundY < BOG_WATER_LEVEL) {
      waterDepth = Math.max(waterDepth, BOG_WATER_LEVEL - groundY);
    }

    const pondDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
    const pondLvl = getPondWaterLevel();
    if (pondDist < 11.2 && groundY < pondLvl) {
      waterDepth = Math.max(waterDepth, pondLvl - groundY);
    }

    const fenDist = Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z);
    const fenLvl = getFenWaterLevel();
    if (fenDist < 12.2 && groundY < fenLvl) {
      waterDepth = Math.max(waterDepth, fenLvl - groundY);
    }

    const moorDist = Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z);
    const moorLvl = getMoorWaterLevel();
    if (moorDist < 12.5 && groundY < moorLvl) {
      waterDepth = Math.max(waterDepth, moorLvl - groundY);
    }

    const cascDist = Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z);
    const cascLvl = getCascadePoolWaterLevel();
    if (cascDist < 10.2 && groundY < cascLvl) {
      waterDepth = Math.max(waterDepth, cascLvl - groundY);
    }

    // Stream bed wading (shallow brook & silverwind creek)
    const brookDist = brookDistanceAt(x, z);
    const swDist = silverwindDistanceAt(x, z);
    if (brookDist < 1.55) {
      waterDepth = Math.max(waterDepth, 0.14 * (1 - brookDist / 1.55) + 0.05);
    }
    if (swDist < 1.85) {
      waterDepth = Math.max(waterDepth, 0.18 * (1 - swDist / 1.85) + 0.06);
    }
  }

  const inWater = waterDepth > 0.04;

  // Proximity to flowing water & cascade
  const minStreamDist = Math.min(brookDistanceAt(x, z), silverwindDistanceAt(x, z));
  const pondEdgeDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
  const cascadeDist = Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z);
  const waterfallProximity = clamp01(1 - (cascadeDist - 4) / 28);
  const waterProximity = Math.max(
    waterfallProximity,
    clamp01(1 - (minStreamDist - 1.5) / 14),
    clamp01(1 - (pondEdgeDist - 6) / 14)
  );

  // Check castle / tower / ruin / sanctum exterior proximity
  const nearTower = Math.hypot(x - TOWER_CENTER.x, z - TOWER_CENTER.z) < 16;
  const nearRuins = Math.hypot(x - RUINS_CENTER.x, z - RUINS_CENTER.z) < 19;
  const nearShrine = Math.hypot(x - SHRINE_CENTER.x, z - SHRINE_CENTER.z) < 16;
  const nearCitadel = Math.hypot(x - CITADEL_GATE_CENTER.x, z - CITADEL_GATE_CENTER.z) < 14;
  const nearHighlandRuin = Math.hypot(x - HIGHLAND_RUIN_CENTER.x, z - HIGHLAND_RUIN_CENTER.z) < 16;
  const nearCabinPorch = Math.hypot(x - CABIN_CENTER.x, z - CABIN_CENTER.z) < 8.5 && onLandmarkFloor;
  const nearCottagePorch = Math.hypot(x - COTTAGE_CENTER.x, z - COTTAGE_CENTER.z) < 7.0 && onLandmarkFloor;

  const inCastleZone = nearTower || nearRuins || nearShrine || nearCitadel;

  // Determine active surface under feet
  let surface: SurfaceKind = 'grass';
  if (inWater) {
    surface = waterDepth > 0.3 ? 'water_deep' : 'water_shallow';
  } else if (onBridge || nearCabinPorch || nearCottagePorch) {
    surface = 'wood';
  } else if (onLandmarkFloor) {
    surface = 'stone';
  } else if (
    terrainBiome === 'wetland' &&
    (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 7.8 ||
      Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 11.5 ||
      Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 12.2)
  ) {
    surface = 'mud';
  } else if (pathMask > 0.45) {
    surface = 'dirt_path';
  } else if (
    terrainBiome === 'rocky' ||
    slope > 0.38 ||
    Math.hypot(x - STONEFALL_CIRCLE_CENTER.x, z - STONEFALL_CIRCLE_CENTER.z) < 22
  ) {
    surface = 'gravel';
  } else if (canopy > 0.62 && terrainBiome === 'deepwood') {
    surface = 'leaves';
  } else {
    surface = 'grass';
  }

  // Determine dominant ThornvaleAudioBiomeId
  let biome: ThornvaleAudioBiomeId = 'foret_ancienne';
  if (nearTower || nearCitadel) {
    biome = 'chateaux';
  } else if (nearShrine) {
    biome = 'sanctuaires';
  } else if (nearRuins || nearHighlandRuin) {
    biome = 'ruines';
  } else if (waterfallProximity > 0.42) {
    biome = 'cascades';
  } else if (terrainBiome === 'wetland') {
    biome = 'marecages';
  } else if (terrainBiome === 'riverbank') {
    biome = 'rivieres_lacs';
  } else if (terrainBiome === 'rocky') {
    biome = x > 100 && z < -25 ? 'falaises' : 'montagnes';
  } else if (terrainBiome === 'clearing' || terrainBiome === 'glade') {
    biome = 'plaines';
  } else {
    biome = 'foret_ancienne';
  }

  const altitudeFactor = clamp01((y - 2.2) / 6.5);

  return {
    biome,
    surface,
    waterDepth,
    inWater,
    waterProximity,
    waterfallProximity,
    isInterior: false,
    interiorId: null,
    interiorKind: 'none',
    altitudeFactor,
    nearFire,
    canopyDensity: canopy,
    inCastleZone,
  };
}
