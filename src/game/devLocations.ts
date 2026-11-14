import { localToWorldXZ } from './landmarks';
import {
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
  LANDMARK_ZONES,
  RUINS_CENTER,
  RUINS_YAW,
  SHRINE_CENTER,
  SHRINE_YAW,
  TOWER_CENTER,
  TOWER_YAW,
} from './terrain';
import { DevTeleportCategory, DevTeleportPoint } from './types';

export const DEV_TELEPORT_CATEGORIES: DevTeleportCategory[] = [
  'Overworld Landmarks',
  'Outer Regions',
  'Dwellings',
  'Towers & Fortifications',
  'Ruins & Sanctuaries',
  'Caves',
  'Dungeons',
];

const OVERWORLD_SPAWN_OVERRIDES: Record<
  string,
  { category: DevTeleportCategory; x: number; z: number; yaw: number; subtitle: string }
> = {
  clearing: {
    category: 'Overworld Landmarks',
    x: 0,
    z: 5.2,
    yaw: Math.PI,
    subtitle: 'Starting trail clearing',
  },
  bog: {
    category: 'Overworld Landmarks',
    x: -10.2,
    z: 5.8,
    yaw: -2.2,
    subtitle: 'Western mire shoreline',
  },
  hollow: {
    category: 'Overworld Landmarks',
    x: 10.0,
    z: -20.5,
    yaw: 2.8,
    subtitle: 'Pine path fork',
  },
  overlook: {
    category: 'Overworld Landmarks',
    x: 29.5,
    z: -25.5,
    yaw: 0.4,
    subtitle: 'Eastern standing stones',
  },
  bridge: {
    category: 'Overworld Landmarks',
    x: 34.4,
    z: -41.4,
    yaw: 0.55,
    subtitle: 'South bridge abutment',
  },
  gate: {
    category: 'Overworld Landmarks',
    x: -15.0,
    z: -45.0,
    yaw: 0.85,
    subtitle: 'Ancient forest road archway',
  },
  crags_tor: {
    category: 'Overworld Landmarks',
    x: 42.5,
    z: 15.5,
    yaw: -0.6,
    subtitle: 'Jagged southeast rock ridge',
  },
  pond: {
    category: 'Overworld Landmarks',
    x: 61.8,
    z: -15.5,
    yaw: Math.PI * 0.5,
    subtitle: 'Silvermire western bank',
  },
  deepwood_north: {
    category: 'Outer Regions',
    x: -19.0,
    z: -112.0,
    yaw: Math.PI,
    subtitle: 'Northern old-growth pine clearing',
  },
  fen_north: {
    category: 'Outer Regions',
    x: 18.0,
    z: -118.0,
    yaw: -2.2,
    subtitle: 'Misty northeastern marsh pools',
  },
  silverwind_waterfall: {
    category: 'Outer Regions',
    x: 104.5,
    z: -40.5,
    yaw: -1.35,
    subtitle: 'Silverwind Gorge cascade basin',
  },
  highland_crags: {
    category: 'Outer Regions',
    x: 121.0,
    z: -14.0,
    yaw: Math.PI,
    subtitle: 'Rocky eastern watch-ruin crest',
  },
  thornwood_glades: {
    category: 'Outer Regions',
    x: 10.0,
    z: 106.0,
    yaw: Math.PI,
    subtitle: 'Southern berry thickets & glades',
  },
  abandoned_waystation: {
    category: 'Outer Regions',
    x: 59.5,
    z: 94.5,
    yaw: 2.7,
    subtitle: 'Secluded forest waystation camp',
  },
  stonefall_valley: {
    category: 'Outer Regions',
    x: -118.0,
    z: -28.0,
    yaw: 1.3,
    subtitle: 'Western crag pass & stone circle',
  },
  western_moor: {
    category: 'Outer Regions',
    x: -99.0,
    z: 58.0,
    yaw: 2.3,
    subtitle: 'Southwestern mist-bound moor tarn',
  },
  cabin: (() => {
    const p = localToWorldXZ(CABIN_CENTER.x, CABIN_CENTER.z, CABIN_YAW, 0, 5.8);
    return {
      category: 'Dwellings',
      x: p.x,
      z: p.z,
      yaw: CABIN_YAW + Math.PI,
      subtitle: 'Front portico approach',
    };
  })(),
  cottage: (() => {
    const p = localToWorldXZ(COTTAGE_CENTER.x, COTTAGE_CENTER.z, COTTAGE_YAW, 0, 4.4);
    return {
      category: 'Dwellings',
      x: p.x,
      z: p.z,
      yaw: COTTAGE_YAW + Math.PI,
      subtitle: 'Front timber stoop',
    };
  })(),
  tower: (() => {
    const p = localToWorldXZ(TOWER_CENTER.x, TOWER_CENTER.z, TOWER_YAW, 0, 6.2);
    return {
      category: 'Towers & Fortifications',
      x: p.x,
      z: p.z,
      yaw: TOWER_YAW + Math.PI,
      subtitle: 'Watchtower terrace steps',
    };
  })(),
  ruins: (() => {
    const p = localToWorldXZ(RUINS_CENTER.x, RUINS_CENTER.z, RUINS_YAW, 0, 6.4);
    return {
      category: 'Ruins & Sanctuaries',
      x: p.x,
      z: p.z,
      yaw: RUINS_YAW + Math.PI,
      subtitle: 'Bastion courtyard steps',
    };
  })(),
  whisper: (() => {
    const p = localToWorldXZ(SHRINE_CENTER.x, SHRINE_CENTER.z, SHRINE_YAW, 0, 5.2);
    return {
      category: 'Ruins & Sanctuaries',
      x: p.x,
      z: p.z,
      yaw: SHRINE_YAW + Math.PI,
      subtitle: 'Sanctum stone forecourt',
    };
  })(),
  crags: (() => {
    const p = localToWorldXZ(CAVE_CRAG_CENTER.x, CAVE_CRAG_CENTER.z, CAVE_CRAG_YAW, 0, 2.4);
    return {
      category: 'Caves',
      x: p.x,
      z: p.z,
      yaw: CAVE_CRAG_YAW + Math.PI,
      subtitle: 'Mine-braced cavern mouth',
    };
  })(),
  weeping_cave: (() => {
    const p = localToWorldXZ(
      CAVE_WEEPING_CENTER.x,
      CAVE_WEEPING_CENTER.z,
      CAVE_WEEPING_YAW,
      0,
      2.4
    );
    return {
      category: 'Caves',
      x: p.x,
      z: p.z,
      yaw: CAVE_WEEPING_YAW + Math.PI,
      subtitle: 'Mossy damp grotto mouth',
    };
  })(),
  barrow_cave: (() => {
    const p = localToWorldXZ(
      CAVE_ANCIENT_CENTER.x,
      CAVE_ANCIENT_CENTER.z,
      CAVE_ANCIENT_YAW,
      0,
      2.4
    );
    return {
      category: 'Caves',
      x: p.x,
      z: p.z,
      yaw: CAVE_ANCIENT_YAW + Math.PI,
      subtitle: 'Root-bound barrow entrance',
    };
  })(),
  citadel_gate: (() => {
    const p = localToWorldXZ(
      CITADEL_GATE_CENTER.x,
      CITADEL_GATE_CENTER.z,
      CITADEL_GATE_YAW,
      0,
      3.5
    );
    return {
      category: 'Dungeons',
      x: p.x,
      z: p.z,
      yaw: CITADEL_GATE_YAW + Math.PI,
      subtitle: 'Cliffside citadel archway',
    };
  })(),
};

const INTERIOR_LOCATIONS: DevTeleportPoint[] = [
  // Dwellings
  {
    id: 'int_cabin_ground',
    name: 'Hollowbark Homestead — Hall',
    category: 'Dwellings',
    subtitle: 'Interior ground floor',
    targetEnv: 'cabin_interior',
    x: 0,
    y: 0,
    z: 4.8,
    yaw: Math.PI,
    zoneId: 'cabin',
  },
  {
    id: 'int_cabin_loft',
    name: 'Hollowbark Homestead — Upper Loft',
    category: 'Dwellings',
    subtitle: 'Top of interior timber stairs',
    targetEnv: 'cabin_interior',
    x: -0.5,
    y: 3.2,
    z: -3.2,
    yaw: 0,
    zoneId: 'cabin',
  },
  {
    id: 'int_cottage_main',
    name: 'Elderwood Cottage — Main Room',
    category: 'Dwellings',
    subtitle: 'Hearth & Edward study',
    targetEnv: 'cottage_interior',
    x: 0,
    y: 0,
    z: 4.0,
    yaw: Math.PI,
    zoneId: 'cottage',
  },
  {
    id: 'int_cottage_cellar',
    name: 'Elderwood Cottage — Cellar',
    category: 'Dwellings',
    subtitle: 'Subterranean root cellar',
    targetEnv: 'cottage_interior',
    x: 2.8,
    y: -1.2,
    z: -8.5,
    yaw: Math.PI,
    zoneId: 'cottage',
  },

  // Towers & Fortifications
  {
    id: 'int_tower_base',
    name: 'Greywatch Tower — Ground Floor',
    category: 'Towers & Fortifications',
    subtitle: 'Base stone guardroom',
    targetEnv: 'tower_interior',
    x: 0,
    y: 0,
    z: 2.8,
    yaw: Math.PI,
    zoneId: 'tower',
  },
  {
    id: 'int_tower_mid',
    name: 'Greywatch Tower — Second Floor',
    category: 'Towers & Fortifications',
    subtitle: 'Timber landing & watch armory',
    targetEnv: 'tower_interior',
    x: -1.0,
    y: 3.4,
    z: 1.5,
    yaw: 0,
    zoneId: 'tower',
  },
  {
    id: 'int_tower_belfry',
    name: 'Greywatch Tower — Belfry Deck',
    category: 'Towers & Fortifications',
    subtitle: 'Upper watch platform',
    targetEnv: 'tower_interior',
    x: 0.0,
    y: 6.8,
    z: -1.0,
    yaw: 0,
    zoneId: 'tower',
  },

  // Ruins & Sanctuaries
  {
    id: 'int_shrine_temple',
    name: 'Sanctum Temple — Inner Hall',
    category: 'Ruins & Sanctuaries',
    subtitle: 'Moss-carved sanctuary altar',
    targetEnv: 'shrine_interior',
    x: 0,
    y: 0,
    z: 8.4,
    yaw: Math.PI,
    zoneId: 'whisper',
  },

  // Caves
  {
    id: 'int_cave_cragstone',
    name: 'Cragstone Cavern — Interior',
    category: 'Caves',
    subtitle: 'Flooded mine & crystal bridge',
    targetEnv: 'cave_cragstone',
    x: 0,
    y: 0,
    z: 9.8,
    yaw: Math.PI,
    zoneId: 'crags',
  },
  {
    id: 'int_cave_weeping',
    name: 'Weeping Hollow Grotto — Interior',
    category: 'Caves',
    subtitle: 'Fungal spring & stepping stones',
    targetEnv: 'cave_weeping',
    x: 0,
    y: 0,
    z: 8.4,
    yaw: Math.PI,
    zoneId: 'weeping_cave',
  },
  {
    id: 'int_cave_ancient',
    name: 'Sunken Barrow Cavern — Interior',
    category: 'Caves',
    subtitle: 'Sunken megalithic steps',
    targetEnv: 'cave_ancient',
    x: 0,
    y: 0,
    z: 8.8,
    yaw: Math.PI,
    zoneId: 'barrow_cave',
  },

  // Dungeons
  {
    id: 'int_dungeon_catacombs',
    name: 'Underbastion Catacombs — Nave',
    category: 'Dungeons',
    subtitle: 'Ossuary entrance beneath ruins',
    targetEnv: 'dungeon_catacombs',
    x: 0,
    y: 0,
    z: 8.2,
    yaw: Math.PI,
    zoneId: 'dungeon_catacombs',
  },
  {
    id: 'int_dungeon_catacombs_vault',
    name: 'Underbastion Catacombs — Secret Crypt',
    category: 'Dungeons',
    subtitle: 'Hidden eastern reliquary',
    targetEnv: 'dungeon_catacombs',
    x: 9.1,
    y: -1.8,
    z: -15.1,
    yaw: Math.PI,
    zoneId: 'dungeon_catacombs',
  },
  {
    id: 'int_dungeon_vault',
    name: 'Sunken Citadel Vault — Entry',
    category: 'Dungeons',
    subtitle: 'Chasm bridge & iron gate',
    targetEnv: 'dungeon_vault',
    x: 0,
    y: 0,
    z: 11.8,
    yaw: Math.PI,
    zoneId: 'citadel_gate',
  },
  {
    id: 'int_dungeon_vault_sanctum',
    name: 'Sunken Citadel Vault — Sanctum',
    category: 'Dungeons',
    subtitle: 'Deep warden chamber',
    targetEnv: 'dungeon_vault',
    x: 0,
    y: -1.4,
    z: -16.0,
    yaw: Math.PI,
    zoneId: 'citadel_gate',
  },
];

export function buildDevTeleportLocations(): DevTeleportPoint[] {
  const overworldLocations: DevTeleportPoint[] = LANDMARK_ZONES.map((zone) => {
    const ov = OVERWORLD_SPAWN_OVERRIDES[zone.id];
    const isBuildingExterior =
      ov &&
      (ov.category === 'Dwellings' ||
        ov.category === 'Towers & Fortifications' ||
        ov.category === 'Ruins & Sanctuaries' ||
        ov.category === 'Caves' ||
        ov.category === 'Dungeons');
    return {
      id: `ext_${zone.id}`,
      name: isBuildingExterior ? `${zone.name} (Exterior)` : zone.name,
      category: ov ? ov.category : 'Overworld Landmarks',
      subtitle: ov ? ov.subtitle : 'Discovered world zone',
      targetEnv: 'overworld',
      x: ov ? ov.x : zone.x,
      z: ov ? ov.z : zone.z,
      yaw: ov ? ov.yaw : Math.PI,
      zoneId: zone.id,
    };
  });

  return [...overworldLocations, ...INTERIOR_LOCATIONS];
}

export const DEV_TELEPORT_POINTS: DevTeleportPoint[] = buildDevTeleportLocations();
