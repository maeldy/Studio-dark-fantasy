import * as THREE from 'three';
import { addItemsToInventory, ITEM_CATALOG } from './inventory';
import {
  biomeAt,
  BOG_CENTER,
  CABIN_CENTER,
  CASCADE_CENTER,
  COTTAGE_CENTER,
  DEEPWOOD_NORTH_CENTER,
  FEN_NORTH_CENTER,
  groundHeightAt,
  groundSlopeAt,
  HIGHLAND_RUIN_CENTER,
  MOOR_POND_CENTER,
  pathDistanceAt,
  PLAYABLE_BOUNDS_RADIUS,
  POND_CENTER,
  RUINS_CENTER,
  SHRINE_CENTER,
  STONEFALL_CIRCLE_CENTER,
  streamDistanceAt,
  THORNWOOD_GLADES_CENTER,
  TOWER_CENTER,
  WAYSTATION_CENTER,
} from './terrain';
import {
  BoxCollider,
  CircleCollider,
  ResourceToolRequirement,
  ThornvaleSaveState,
} from './types';

export type ResourceVisualKind =
  | 'branch_pile'
  | 'deadwood_log'
  | 'felled_timber'
  | 'fiber_reeds'
  | 'liana_clump'
  | 'bog_root_clump'
  | 'bark_stump'
  | 'resin_knot'
  | 'stone_cluster'
  | 'flint_outcrop'
  | 'coal_seam'
  | 'iron_vein'
  | 'copper_vein'
  | 'tin_vein'
  | 'amber_deposit'
  | 'moonstone_outcrop'
  | 'chanterelle_patch'
  | 'glowcap_cluster'
  | 'thornberry_bush'
  | 'sage_tuft'
  | 'bellflower_patch'
  | 'yarrow_clump'
  | 'earthnut_patch'
  | 'feather_roost'
  | 'bone_pile'
  | 'hunter_cache'
  | 'fur_snag'
  | 'fang_trophy'
  | 'found_coins'
  | 'found_pottery'
  | 'found_relic'
  | 'found_compass'
  | 'found_flask';

export interface ResourceYieldSpec {
  itemId: string;
  quantity: number;
}

export interface ResourceNodeDef {
  id: string;
  label: string;
  visualKind: ResourceVisualKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  radius: number;
  yields: ResourceYieldSpec[];
  requiredTool: ResourceToolRequirement;
  respawnSeconds: number; // 0 = non-respawning (unique / found item)
  isFoundItem?: boolean;
  cueKind: 'foliage' | 'mineral' | 'curio';
}

interface ManagedNode extends ResourceNodeDef {
  chunkKey: number;
  group: THREE.Group;
  harvestVisual: THREE.Object3D;
  glowLightPos?: { x: number; y: number; z: number };
}

export interface ResourceHarvestResult {
  success: boolean;
  blockedByTool?: ResourceToolRequirement;
  inventoryFull?: boolean;
  message: string;
  cueKind: 'foliage' | 'mineral' | 'curio' | 'locked';
  isFoundItem?: boolean;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function isResourceSpotValid(
  x: number,
  z: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[],
  allowNearWater = false
): boolean {
  if (Math.hypot(x, z) > PLAYABLE_BOUNDS_RADIUS - 4) return false;
  if (groundSlopeAt(x, z) > 0.62) return false;
  if (!allowNearWater) {
    if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 4.8) return false;
    if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 6.4) return false;
    if (Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 9.4) return false;
    if (Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 10.8) return false;
    if (Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z) < 8.4) return false;
    if (streamDistanceAt(x, z) < 2.2) return false;
  } else {
    if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 3.6) return false;
    if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 5.3) return false;
    if (Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 7.8) return false;
    if (Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 9.0) return false;
    if (streamDistanceAt(x, z) < 1.3) return false;
  }

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (Math.hypot(x - c.x, z - c.z) < c.radius + 0.65) return false;
  }
  for (let i = 0; i < boxColliders.length; i++) {
    const b = boxColliders[i];
    const cos = Math.cos(b.rotY);
    const sin = Math.sin(b.rotY);
    const dx = x - b.cx;
    const dz = z - b.cz;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) < b.halfW + 0.75 && Math.abs(lz) < b.halfD + 0.75) {
      return false;
    }
  }
  return true;
}

function snapToValidResourceSpot(
  tx: number,
  tz: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[],
  allowNearWater = false,
  maxOffset = 5.5
): { x: number; y: number; z: number } | null {
  if (isResourceSpotValid(tx, tz, colliders, boxColliders, allowNearWater)) {
    return { x: tx, y: groundHeightAt(tx, tz), z: tz };
  }
  for (let r = 1.1; r <= maxOffset; r += 1.1) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const x = tx + Math.cos(ang) * r;
      const z = tz + Math.sin(ang) * r;
      if (isResourceSpotValid(x, z, colliders, boxColliders, allowNearWater)) {
        return { x, y: groundHeightAt(x, z), z };
      }
    }
  }
  return null;
}

export function buildOverworldResourceDefs(
  worldSeed: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[]
): ResourceNodeDef[] {
  const rand = seededRand(worldSeed + 8821);
  const defs: ResourceNodeDef[] = [];
  const placed: { x: number; z: number }[] = [];

  const isFreeFromNodes = (x: number, z: number, minSpacing = 2.6): boolean => {
    const s2 = minSpacing * minSpacing;
    for (let i = 0; i < placed.length; i++) {
      const dx = x - placed[i].x;
      const dz = z - placed[i].z;
      if (dx * dx + dz * dz < s2) return false;
    }
    return true;
  };

  const addNode = (
    id: string,
    label: string,
    visualKind: ResourceVisualKind,
    tx: number,
    tz: number,
    yields: ResourceYieldSpec[],
    opts: {
      requiredTool?: ResourceToolRequirement;
      respawnSeconds?: number;
      isFoundItem?: boolean;
      cueKind: 'foliage' | 'mineral' | 'curio';
      radius?: number;
      scale?: number;
      allowNearWater?: boolean;
      forceExact?: boolean;
    }
  ) => {
    let pos: { x: number; y: number; z: number } | null = null;
    if (opts.forceExact) {
      pos = { x: tx, y: groundHeightAt(tx, tz), z: tz };
    } else {
      pos = snapToValidResourceSpot(tx, tz, colliders, boxColliders, !!opts.allowNearWater);
    }
    if (!pos) return;
    if (!opts.forceExact && !isFreeFromNodes(pos.x, pos.z, 2.4)) return;
    placed.push({ x: pos.x, z: pos.z });
    defs.push({
      id,
      label,
      visualKind,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rotY: rand() * Math.PI * 2,
      scale: opts.scale ?? 0.92 + rand() * 0.22,
      radius: opts.radius ?? 2.35,
      yields,
      requiredTool: opts.requiredTool ?? 'none',
      respawnSeconds: opts.respawnSeconds ?? 120,
      isFoundItem: opts.isFoundItem,
      cueKind: opts.cueKind,
    });
  };

  // ============================================================================
  // A. CURATED STARTER & LANDMARK RESOURCE SPOTS (Immediate discoverability)
  // ============================================================================
  addNode(
    'res_start_branches_1',
    'Dead Branches',
    'branch_pile',
    -4.6,
    3.6,
    [{ itemId: 'branch', quantity: 2 }],
    { cueKind: 'foliage', respawnSeconds: 90 }
  );
  addNode(
    'res_start_berries_1',
    'Wild Thornberries',
    'thornberry_bush',
    5.8,
    4.2,
    [
      { itemId: 'wild_berries', quantity: 2 },
      { itemId: 'wild_seeds', quantity: 1 },
    ],
    { cueKind: 'foliage', respawnSeconds: 110 }
  );
  addNode(
    'res_start_stone_1',
    'Rough Fieldstones',
    'stone_cluster',
    -6.4,
    -4.5,
    [
      { itemId: 'rough_stone', quantity: 2 },
      { itemId: 'flint', quantity: 1 },
    ],
    { cueKind: 'mineral', respawnSeconds: 120 }
  );
  addNode(
    'res_start_herbs_1',
    'Bitter Sage',
    'sage_tuft',
    4.2,
    -3.8,
    [
      { itemId: 'wild_herb', quantity: 2 },
      { itemId: 'forest_flower', quantity: 1 },
    ],
    { cueKind: 'foliage', respawnSeconds: 95 }
  );
  addNode(
    'res_start_mushroom_1',
    'Woodland Chanterelles',
    'chanterelle_patch',
    -9.2,
    8.5,
    [{ itemId: 'forest_mushroom', quantity: 2 }],
    { cueKind: 'foliage', respawnSeconds: 100 }
  );

  // Sample tool-gated resources (clean scaffolding for future Axe & Pickaxe)
  addNode(
    'res_gated_timber_homestead',
    'Heavy Pine Trunk (Axe Required)',
    'felled_timber',
    CABIN_CENTER.x + 8.5,
    CABIN_CENTER.z + 6.5,
    [{ itemId: 'small_log', quantity: 3 }],
    { requiredTool: 'axe', cueKind: 'foliage', respawnSeconds: 180, scale: 1.15 }
  );
  addNode(
    'res_gated_timber_waystation',
    'Windfall Oak Log (Axe Required)',
    'felled_timber',
    WAYSTATION_CENTER.x - 9.0,
    WAYSTATION_CENTER.z - 5.5,
    [{ itemId: 'small_log', quantity: 3 }],
    { requiredTool: 'axe', cueKind: 'foliage', respawnSeconds: 180, scale: 1.15 }
  );
  addNode(
    'res_gated_deep_iron_tor',
    'Deep Iron Seam (Pickaxe Required)',
    'iron_vein',
    46.5,
    17.5,
    [
      { itemId: 'iron_ore', quantity: 3 },
      { itemId: 'coal_chunk', quantity: 1 },
    ],
    { requiredTool: 'pickaxe', cueKind: 'mineral', respawnSeconds: 210, scale: 1.2 }
  );
  addNode(
    'res_gated_moonstone_stonefall',
    'Sealed Moonstone Crystal (Pickaxe Required)',
    'moonstone_outcrop',
    STONEFALL_CIRCLE_CENTER.x + 15.0,
    STONEFALL_CIRCLE_CENTER.z - 11.0,
    [{ itemId: 'moonstone_shard', quantity: 2 }],
    { requiredTool: 'pickaxe', cueKind: 'mineral', respawnSeconds: 240, scale: 1.2 }
  );

  // ============================================================================
  // B. CURATED UNIQUE & FOUND OVERWORLD ITEMS (Non-respawning once collected)
  // ============================================================================
  addNode(
    'found_clearing_coins',
    'Tarnished Coin Pouch',
    'found_coins',
    9.2,
    9.6,
    [{ itemId: 'old_coin', quantity: 3 }],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.2 }
  );
  addNode(
    'found_waystation_compass',
    'Broken Brass Compass',
    'found_compass',
    WAYSTATION_CENTER.x + 2.2,
    WAYSTATION_CENTER.z - 1.2,
    [
      { itemId: 'surveyor_compass', quantity: 1 },
      { itemId: 'old_coin', quantity: 2 },
    ],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.3 }
  );
  addNode(
    'found_highland_tablet',
    'Moss-Cracked Rune Tablet',
    'found_relic',
    HIGHLAND_RUIN_CENTER.x - 1.4,
    HIGHLAND_RUIN_CENTER.z + 2.6,
    [
      { itemId: 'ancient_tablet', quantity: 1 },
      { itemId: 'pottery_shard', quantity: 1 },
    ],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.4 }
  );
  addNode(
    'found_deepwood_charm',
    'Whispering Root Charm',
    'found_relic',
    DEEPWOOD_NORTH_CENTER.x + 2.4,
    DEEPWOOD_NORTH_CENTER.z - 2.6,
    [{ itemId: 'sanctum_charm', quantity: 1 }],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.4 }
  );
  addNode(
    'found_stonefall_coins',
    'Circle Offering Urn',
    'found_pottery',
    STONEFALL_CIRCLE_CENTER.x + 1.8,
    STONEFALL_CIRCLE_CENTER.z + 2.2,
    [
      { itemId: 'old_coin', quantity: 5 },
      { itemId: 'pottery_shard', quantity: 2 },
    ],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.4 }
  );
  addNode(
    'found_fen_tallow',
    'Stranded Lantern Flask',
    'found_flask',
    FEN_NORTH_CENTER.x - 11.2,
    FEN_NORTH_CENTER.z + 3.4,
    [
      { itemId: 'lantern_tallow_flask', quantity: 1 },
      { itemId: 'amber_shard', quantity: 1 },
    ],
    {
      isFoundItem: true,
      respawnSeconds: 0,
      cueKind: 'curio',
      radius: 2.3,
      allowNearWater: true,
    }
  );
  addNode(
    'found_cascade_pottery',
    'Gorge Amphora Fragments',
    'found_pottery',
    CASCADE_CENTER.x - 9.8,
    CASCADE_CENTER.z + 4.8,
    [
      { itemId: 'pottery_shard', quantity: 2 },
      { itemId: 'moonstone_shard', quantity: 1 },
    ],
    {
      isFoundItem: true,
      respawnSeconds: 0,
      cueKind: 'curio',
      radius: 2.3,
      allowNearWater: true,
    }
  );
  addNode(
    'found_moor_coins',
    'Moorland Cairns Cache',
    'found_coins',
    MOOR_POND_CENTER.x + 12.8,
    MOOR_POND_CENTER.z + 5.2,
    [
      { itemId: 'old_coin', quantity: 4 },
      { itemId: 'bone_shard', quantity: 2 },
    ],
    {
      isFoundItem: true,
      respawnSeconds: 0,
      cueKind: 'curio',
      radius: 2.3,
      allowNearWater: true,
    }
  );
  addNode(
    'found_shrine_offering',
    'Elder Shrine Offering',
    'found_pottery',
    SHRINE_CENTER.x + 4.2,
    SHRINE_CENTER.z - 3.6,
    [
      { itemId: 'pottery_shard', quantity: 2 },
      { itemId: 'old_coin', quantity: 2 },
    ],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.2 }
  );
  addNode(
    'found_cottage_cache',
    'Weathered Hunter Satchel',
    'hunter_cache',
    COTTAGE_CENTER.x - 6.8,
    COTTAGE_CENTER.z + 5.6,
    [
      { itemId: 'raw_hide', quantity: 2 },
      { itemId: 'coarse_fur', quantity: 1 },
    ],
    { isFoundItem: true, respawnSeconds: 0, cueKind: 'curio', radius: 2.2 }
  );

  // ============================================================================
  // C. BIOME-DRIVEN PROCEDURAL NATURAL NODES ACROSS THE 168m MAP
  // ============================================================================
  interface BiomeRollSpec {
    label: string;
    visual: ResourceVisualKind;
    yields: ResourceYieldSpec[];
    cue: 'foliage' | 'mineral' | 'curio';
    respawn: number;
    nearWater?: boolean;
  }

  const deepwoodPool: BiomeRollSpec[] = [
    { label: 'Dead Branches', visual: 'branch_pile', yields: [{ itemId: 'branch', quantity: 2 }], cue: 'foliage', respawn: 95 },
    { label: 'Seasoned Deadwood', visual: 'deadwood_log', yields: [{ itemId: 'deadwood', quantity: 2 }, { itemId: 'tree_bark', quantity: 1 }], cue: 'foliage', respawn: 130 },
    { label: 'Split Firewood Stack', visual: 'felled_timber', yields: [{ itemId: 'small_log', quantity: 1 }, { itemId: 'deadwood', quantity: 1 }], cue: 'foliage', respawn: 145 },
    { label: 'Hanging Liana Vines', visual: 'liana_clump', yields: [{ itemId: 'liana_vine', quantity: 2 }], cue: 'foliage', respawn: 115 },
    { label: 'Stripped Pine Bark', visual: 'bark_stump', yields: [{ itemId: 'tree_bark', quantity: 2 }, { itemId: 'pine_resin', quantity: 1 }], cue: 'foliage', respawn: 125 },
    { label: 'Amber Resin Knot', visual: 'resin_knot', yields: [{ itemId: 'pine_resin', quantity: 1 }], cue: 'foliage', respawn: 160 },
    { label: 'Woodland Chanterelles', visual: 'chanterelle_patch', yields: [{ itemId: 'forest_mushroom', quantity: 2 }], cue: 'foliage', respawn: 100 },
    { label: 'Wild Thornberries', visual: 'thornberry_bush', yields: [{ itemId: 'wild_berries', quantity: 2 }, { itemId: 'wild_seeds', quantity: 1 }], cue: 'foliage', respawn: 110 },
    { label: 'Bramble Fur Snag', visual: 'fur_snag', yields: [{ itemId: 'coarse_fur', quantity: 1 }, { itemId: 'plant_fiber', quantity: 1 }], cue: 'foliage', respawn: 170 },
    { label: 'Crow Roost Feathers', visual: 'feather_roost', yields: [{ itemId: 'crow_feather', quantity: 2 }], cue: 'foliage', respawn: 150 },
    { label: 'Fossilized Amber Pocket', visual: 'amber_deposit', yields: [{ itemId: 'amber_shard', quantity: 1 }], cue: 'mineral', respawn: 220 },
  ];

  const gladePool: BiomeRollSpec[] = [
    { label: 'Bitter Sage', visual: 'sage_tuft', yields: [{ itemId: 'wild_herb', quantity: 2 }, { itemId: 'wild_seeds', quantity: 1 }], cue: 'foliage', respawn: 95 },
    { label: 'Ashen Bellflowers', visual: 'bellflower_patch', yields: [{ itemId: 'forest_flower', quantity: 2 }], cue: 'foliage', respawn: 95 },
    { label: 'Silverleaf Yarrow', visual: 'yarrow_clump', yields: [{ itemId: 'medicinal_herb', quantity: 1 }, { itemId: 'wild_seeds', quantity: 1 }], cue: 'foliage', respawn: 135 },
    { label: 'Earthnut Tubers', visual: 'earthnut_patch', yields: [{ itemId: 'edible_root', quantity: 2 }], cue: 'foliage', respawn: 115 },
    { label: 'Wild Thornberries', visual: 'thornberry_bush', yields: [{ itemId: 'wild_berries', quantity: 3 }], cue: 'foliage', respawn: 110 },
    { label: 'Coarse Plant Fibers', visual: 'fiber_reeds', yields: [{ itemId: 'plant_fiber', quantity: 2 }], cue: 'foliage', respawn: 90 },
    { label: 'Dead Branches', visual: 'branch_pile', yields: [{ itemId: 'branch', quantity: 2 }], cue: 'foliage', respawn: 95 },
  ];

  const wetlandPool: BiomeRollSpec[] = [
    { label: 'Mire Glowcaps', visual: 'glowcap_cluster', yields: [{ itemId: 'bog_cap', quantity: 2 }], cue: 'foliage', respawn: 130, nearWater: true },
    { label: 'Gnarled Bog Roots', visual: 'bog_root_clump', yields: [{ itemId: 'gnarled_root', quantity: 1 }, { itemId: 'edible_root', quantity: 1 }], cue: 'foliage', respawn: 130, nearWater: true },
    { label: 'Fen Reeds & Fiber', visual: 'fiber_reeds', yields: [{ itemId: 'plant_fiber', quantity: 3 }], cue: 'foliage', respawn: 95, nearWater: true },
    { label: 'Silverleaf Yarrow', visual: 'yarrow_clump', yields: [{ itemId: 'medicinal_herb', quantity: 2 }], cue: 'foliage', respawn: 140 },
    { label: 'Weathered Bones', visual: 'bone_pile', yields: [{ itemId: 'bone_shard', quantity: 2 }], cue: 'mineral', respawn: 165 },
    { label: 'Crow Roost Feathers', visual: 'feather_roost', yields: [{ itemId: 'crow_feather', quantity: 2 }], cue: 'foliage', respawn: 140 },
  ];

  const rockyPool: BiomeRollSpec[] = [
    { label: 'Rough Fieldstones', visual: 'stone_cluster', yields: [{ itemId: 'rough_stone', quantity: 2 }], cue: 'mineral', respawn: 115 },
    { label: 'Sharp Flint Outcrop', visual: 'flint_outcrop', yields: [{ itemId: 'flint', quantity: 2 }, { itemId: 'rough_stone', quantity: 1 }], cue: 'mineral', respawn: 130 },
    { label: 'Black Coal Seam', visual: 'coal_seam', yields: [{ itemId: 'coal_chunk', quantity: 2 }], cue: 'mineral', respawn: 150 },
    { label: 'Weathered Iron Ore', visual: 'iron_vein', yields: [{ itemId: 'iron_ore', quantity: 1 }, { itemId: 'rough_stone', quantity: 1 }], cue: 'mineral', respawn: 175 },
    { label: 'Verdigris Copper Vein', visual: 'copper_vein', yields: [{ itemId: 'copper_ore', quantity: 2 }], cue: 'mineral', respawn: 175 },
    { label: 'Cassiterite Tin Vein', visual: 'tin_vein', yields: [{ itemId: 'tin_ore', quantity: 2 }], cue: 'mineral', respawn: 175 },
    { label: 'Moonstone Crevice', visual: 'moonstone_outcrop', yields: [{ itemId: 'moonstone_shard', quantity: 1 }], cue: 'mineral', respawn: 240 },
    { label: 'Predator Fang Cairn', visual: 'fang_trophy', yields: [{ itemId: 'beast_fang', quantity: 1 }, { itemId: 'bone_shard', quantity: 1 }], cue: 'mineral', respawn: 190 },
  ];

  const riverbankPool: BiomeRollSpec[] = [
    { label: 'River Reeds', visual: 'fiber_reeds', yields: [{ itemId: 'plant_fiber', quantity: 2 }], cue: 'foliage', respawn: 90, nearWater: true },
    { label: 'Smooth River Flint', visual: 'flint_outcrop', yields: [{ itemId: 'flint', quantity: 1 }, { itemId: 'rough_stone', quantity: 2 }], cue: 'mineral', respawn: 115, nearWater: true },
    { label: 'Tin Stream Nuggets', visual: 'tin_vein', yields: [{ itemId: 'tin_ore', quantity: 1 }, { itemId: 'rough_stone', quantity: 1 }], cue: 'mineral', respawn: 165, nearWater: true },
    { label: 'Earthnut Tubers', visual: 'earthnut_patch', yields: [{ itemId: 'edible_root', quantity: 2 }], cue: 'foliage', respawn: 115, nearWater: true },
    { label: 'Silverleaf Yarrow', visual: 'yarrow_clump', yields: [{ itemId: 'medicinal_herb', quantity: 1 }], cue: 'foliage', respawn: 135, nearWater: true },
  ];

  let procCounter = 0;
  for (let attempt = 0; attempt < 340 && procCounter < 175; attempt++) {
    const r = 13 + Math.sqrt(rand()) * (PLAYABLE_BOUNDS_RADIUS - 20);
    const ang = rand() * Math.PI * 2;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;

    // Avoid cluttering right on top of roads or bastion core
    if (pathDistanceAt(x, z) < 1.8) continue;
    if (Math.hypot(x - RUINS_CENTER.x, z - RUINS_CENTER.z) < 7.5) continue;
    if (Math.hypot(x - TOWER_CENTER.x, z - TOWER_CENTER.z) < 6.5) continue;
    if (Math.hypot(x - CABIN_CENTER.x, z - CABIN_CENTER.z) < 6.5) continue;

    const biome = biomeAt(x, z);
    const pool =
      biome === 'wetland'
        ? wetlandPool
        : biome === 'rocky'
          ? rockyPool
          : biome === 'riverbank'
            ? riverbankPool
            : biome === 'glade' || biome === 'clearing'
              ? gladePool
              : deepwoodPool;

    const spec = pool[Math.floor(rand() * pool.length)];
    const prevLen = defs.length;
    addNode(`res_proc_${procCounter}`, spec.label, spec.visual, x, z, spec.yields, {
      cueKind: spec.cue,
      respawnSeconds: spec.respawn,
      allowNearWater: !!spec.nearWater,
    });
    if (defs.length > prevLen) {
      procCounter++;
    }
  }

  return defs;
}

// ============================================================================
// PROCEDURAL LOW-POLY PS1 NODE MESH BUILDER + SPATIAL MANAGER
// ============================================================================

export class WorldResourceManager {
  private root: THREE.Group;
  private chunkGroups = new Map<number, { cx: number; cz: number; group: THREE.Group }>();
  private nodes: ManagedNode[] = [];
  private nodesById = new Map<string, ManagedNode>();
  private nodesByChunk = new Map<number, ManagedNode[]>();
  private sharedMaterials: THREE.Material[] = [];
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private saveState: ThornvaleSaveState;
  private updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void;
  private respawnCheckAccum = 0;

  // Shared materials cached for fast batched creation
  private matBark: THREE.MeshLambertMaterial;
  private matMossWood: THREE.MeshLambertMaterial;
  private matStone: THREE.MeshLambertMaterial;
  private matFlint: THREE.MeshLambertMaterial;
  private matCoal: THREE.MeshLambertMaterial;
  private matIronOre: THREE.MeshLambertMaterial;
  private matCopperOre: THREE.MeshLambertMaterial;
  private matTinOre: THREE.MeshLambertMaterial;
  private matAmber: THREE.MeshLambertMaterial;
  private matMoonstone: THREE.MeshLambertMaterial;
  private matLeaf: THREE.MeshLambertMaterial;
  private matBerry: THREE.MeshLambertMaterial;
  private matMushroom: THREE.MeshLambertMaterial;
  private matGlowcap: THREE.MeshBasicMaterial;
  private matFlower: THREE.MeshLambertMaterial;
  private matBone: THREE.MeshLambertMaterial;
  private matHide: THREE.MeshLambertMaterial;
  private matGold: THREE.MeshLambertMaterial;
  private matPottery: THREE.MeshLambertMaterial;
  private matRelicGlow: THREE.MeshBasicMaterial;

  private readonly chunkSize = 36;

  constructor(
    parentRoot: THREE.Group,
    worldSeed: number,
    colliders: CircleCollider[],
    boxColliders: BoxCollider[],
    saveState: ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ) {
    this.root = new THREE.Group();
    this.root.name = 'ThornvaleResources';
    parentRoot.add(this.root);

    this.saveState = saveState;
    this.updateSaveState = updateSaveState;

    const reg = <T extends THREE.Material>(m: T): T => {
      this.sharedMaterials.push(m);
      return m;
    };

    this.matBark = reg(new THREE.MeshLambertMaterial({ color: '#4d3b2b', flatShading: true }));
    this.matMossWood = reg(new THREE.MeshLambertMaterial({ color: '#5b563c', flatShading: true }));
    this.matStone = reg(new THREE.MeshLambertMaterial({ color: '#6b7278', flatShading: true }));
    this.matFlint = reg(new THREE.MeshLambertMaterial({ color: '#333b42', flatShading: true }));
    this.matCoal = reg(new THREE.MeshLambertMaterial({ color: '#22252a', flatShading: true }));
    this.matIronOre = reg(new THREE.MeshLambertMaterial({ color: '#8f523b', flatShading: true }));
    this.matCopperOre = reg(new THREE.MeshLambertMaterial({ color: '#4f8c73', flatShading: true }));
    this.matTinOre = reg(new THREE.MeshLambertMaterial({ color: '#9ca8b0', flatShading: true }));
    this.matAmber = reg(new THREE.MeshLambertMaterial({ color: '#d48d36', flatShading: true }));
    this.matMoonstone = reg(new THREE.MeshLambertMaterial({ color: '#b4d6e8', flatShading: true }));
    this.matLeaf = reg(new THREE.MeshLambertMaterial({ color: '#4a623c', flatShading: true }));
    this.matBerry = reg(new THREE.MeshLambertMaterial({ color: '#8c2d35', flatShading: true }));
    this.matMushroom = reg(new THREE.MeshLambertMaterial({ color: '#c89b5a', flatShading: true }));
    this.matGlowcap = reg(new THREE.MeshBasicMaterial({ color: '#78e0c4' }));
    this.matFlower = reg(new THREE.MeshLambertMaterial({ color: '#7b93bd', flatShading: true }));
    this.matBone = reg(new THREE.MeshLambertMaterial({ color: '#d5ceb8', flatShading: true }));
    this.matHide = reg(new THREE.MeshLambertMaterial({ color: '#6c4d35', flatShading: true }));
    this.matGold = reg(new THREE.MeshLambertMaterial({ color: '#d4a64a', flatShading: true }));
    this.matPottery = reg(new THREE.MeshLambertMaterial({ color: '#8c5d47', flatShading: true }));
    this.matRelicGlow = reg(new THREE.MeshBasicMaterial({ color: '#e6b868' }));

    const defs = buildOverworldResourceDefs(worldSeed, colliders, boxColliders);
    for (const def of defs) {
      this.instantiateNode(def);
    }
    this.syncFromSave(this.saveState);
  }

  private getChunkKey(cx: number, cz: number): number {
    return ((cx + 256) << 10) | ((cz + 256) & 0x3ff);
  }

  private getOrCreateChunkGroup(x: number, z: number): { key: number; group: THREE.Group } {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const key = this.getChunkKey(cx, cz);
    let entry = this.chunkGroups.get(key);
    if (!entry) {
      const group = new THREE.Group();
      this.root.add(group);
      entry = { cx, cz, group };
      this.chunkGroups.set(key, entry);
    }
    return { key, group: entry.group };
  }

  private regGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.sharedGeometries.push(g);
    return g;
  }

  private buildNodeVisual(def: ResourceNodeDef): { group: THREE.Group; harvestVisual: THREE.Object3D } {
    const group = new THREE.Group();
    group.position.set(def.x, def.y, def.z);
    group.rotation.y = def.rotY;
    group.scale.setScalar(def.scale);

    const harvestVisual = new THREE.Group();
    group.add(harvestVisual);

    const addBox = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      const m = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(w, h, d)), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      parent.add(m);
      return m;
    };

    switch (def.visualKind) {
      case 'branch_pile': {
        addBox(harvestVisual, 0.72, 0.08, 0.09, this.matBark, 0, 0.05, 0, 0.08, 0.3, 0.04);
        addBox(harvestVisual, 0.58, 0.07, 0.08, this.matMossWood, 0.08, 0.09, 0.06, -0.05, -0.5, 0.1);
        addBox(harvestVisual, 0.42, 0.06, 0.06, this.matBark, -0.1, 0.11, -0.04, 0.1, 1.1, -0.1);
        break;
      }
      case 'deadwood_log':
      case 'felled_timber': {
        const logGeo = this.regGeo(new THREE.CylinderGeometry(0.16, 0.19, 1.15, 6));
        const log = new THREE.Mesh(logGeo, this.matMossWood);
        log.rotation.z = Math.PI * 0.5;
        log.position.y = 0.17;
        harvestVisual.add(log);
        if (def.visualKind === 'felled_timber') {
          const log2 = new THREE.Mesh(logGeo, this.matBark);
          log2.rotation.z = Math.PI * 0.5;
          log2.rotation.y = 0.18;
          log2.position.set(0.05, 0.38, 0.14);
          harvestVisual.add(log2);
        }
        break;
      }
      case 'bark_stump': {
        const stump = new THREE.Mesh(
          this.regGeo(new THREE.CylinderGeometry(0.26, 0.34, 0.42, 6)),
          this.matBark
        );
        stump.position.y = 0.21;
        group.add(stump); // Stump persists even after bark stripped
        addBox(harvestVisual, 0.28, 0.3, 0.06, this.matMossWood, 0, 0.24, 0.28, 0.12, 0, 0);
        addBox(harvestVisual, 0.24, 0.26, 0.06, this.matAmber, 0.24, 0.22, -0.12, 0, 1.1, 0);
        break;
      }
      case 'resin_knot': {
        const stump = new THREE.Mesh(
          this.regGeo(new THREE.CylinderGeometry(0.22, 0.28, 0.38, 6)),
          this.matBark
        );
        stump.position.y = 0.19;
        group.add(stump);
        const drop = new THREE.Mesh(
          this.regGeo(new THREE.OctahedronGeometry(0.14, 0)),
          this.matAmber
        );
        drop.position.set(0.18, 0.28, 0.12);
        harvestVisual.add(drop);
        break;
      }
      case 'fiber_reeds':
      case 'liana_clump':
      case 'bog_root_clump': {
        const mat =
          def.visualKind === 'bog_root_clump' ? this.matMossWood : this.matLeaf;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const blade = new THREE.Mesh(
            this.regGeo(new THREE.ConeGeometry(0.08, 0.52, 4)),
            mat
          );
          blade.position.set(Math.cos(a) * 0.16, 0.24, Math.sin(a) * 0.16);
          blade.rotation.set(Math.sin(a) * 0.28, a, Math.cos(a) * 0.28);
          harvestVisual.add(blade);
        }
        break;
      }
      case 'stone_cluster':
      case 'flint_outcrop':
      case 'coal_seam':
      case 'iron_vein':
      case 'copper_vein':
      case 'tin_vein':
      case 'amber_deposit':
      case 'moonstone_outcrop': {
        // Persistent rock bed so depleted ore veins still show scarred grey stone
        const baseRock = new THREE.Mesh(
          this.regGeo(new THREE.DodecahedronGeometry(0.38, 0)),
          this.matStone
        );
        baseRock.scale.set(1.25, 0.65, 1.05);
        baseRock.position.y = 0.14;
        group.add(baseRock);

        const crystalMat =
          def.visualKind === 'flint_outcrop'
            ? this.matFlint
            : def.visualKind === 'coal_seam'
              ? this.matCoal
              : def.visualKind === 'iron_vein'
                ? this.matIronOre
                : def.visualKind === 'copper_vein'
                  ? this.matCopperOre
                  : def.visualKind === 'tin_vein'
                    ? this.matTinOre
                    : def.visualKind === 'amber_deposit'
                      ? this.matAmber
                      : def.visualKind === 'moonstone_outcrop'
                        ? this.matMoonstone
                        : this.matStone;

        for (let i = 0; i < 3; i++) {
          const nugget = new THREE.Mesh(
            this.regGeo(new THREE.OctahedronGeometry(0.16 + i * 0.02, 0)),
            crystalMat
          );
          nugget.position.set((i - 1) * 0.18, 0.31 + (i === 1 ? 0.08 : 0), (i % 2) * 0.14 - 0.06);
          nugget.rotation.set(i * 0.4, i * 0.9, 0.2);
          harvestVisual.add(nugget);
        }
        break;
      }
      case 'thornberry_bush': {
        // Leafy bush persists; crimson berries vanish when harvested
        const bush = new THREE.Mesh(
          this.regGeo(new THREE.DodecahedronGeometry(0.42, 0)),
          this.matLeaf
        );
        bush.scale.set(1.15, 0.85, 1.15);
        bush.position.y = 0.28;
        group.add(bush);
        const offsets = [
          [0.22, 0.42, 0.18],
          [-0.2, 0.36, 0.25],
          [0.14, 0.48, -0.22],
          [-0.26, 0.32, -0.14],
          [0.02, 0.56, 0.08],
        ];
        for (const [bx, by, bz] of offsets) {
          const berry = new THREE.Mesh(
            this.regGeo(new THREE.BoxGeometry(0.085, 0.085, 0.085)),
            this.matBerry
          );
          berry.position.set(bx, by, bz);
          harvestVisual.add(berry);
        }
        break;
      }
      case 'chanterelle_patch':
      case 'glowcap_cluster': {
        const capMat = def.visualKind === 'glowcap_cluster' ? this.matGlowcap : this.matMushroom;
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 0.18;
          const oz = i === 1 ? 0.14 : -0.08;
          const stem = new THREE.Mesh(
            this.regGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.18, 5)),
            this.matBone
          );
          stem.position.set(ox, 0.09, oz);
          harvestVisual.add(stem);
          const cap = new THREE.Mesh(
            this.regGeo(new THREE.ConeGeometry(0.13 - i * 0.015, 0.11, 6)),
            capMat
          );
          cap.position.set(ox, 0.19, oz);
          harvestVisual.add(cap);
        }
        break;
      }
      case 'sage_tuft':
      case 'bellflower_patch':
      case 'yarrow_clump':
      case 'earthnut_patch': {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const stalk = new THREE.Mesh(
            this.regGeo(new THREE.BoxGeometry(0.05, 0.28, 0.05)),
            this.matLeaf
          );
          stalk.position.set(Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14);
          stalk.rotation.z = Math.cos(a) * 0.22;
          harvestVisual.add(stalk);
          if (def.visualKind !== 'earthnut_patch') {
            const topMat =
              def.visualKind === 'bellflower_patch'
                ? this.matFlower
                : def.visualKind === 'yarrow_clump'
                  ? this.matBone
                  : this.matLeaf;
            const bud = new THREE.Mesh(
              this.regGeo(new THREE.BoxGeometry(0.09, 0.09, 0.09)),
              topMat
            );
            bud.position.set(Math.cos(a) * 0.16, 0.29, Math.sin(a) * 0.16);
            harvestVisual.add(bud);
          }
        }
        break;
      }
      case 'feather_roost': {
        addBox(harvestVisual, 0.24, 0.02, 0.07, this.matFlint, -0.06, 0.03, 0, 0, 0.4, 0);
        addBox(harvestVisual, 0.22, 0.02, 0.06, this.matCoal, 0.06, 0.04, 0.06, 0, -0.5, 0);
        addBox(harvestVisual, 0.18, 0.02, 0.06, this.matBone, 0.02, 0.05, -0.05, 0, 0.1, 0);
        break;
      }
      case 'bone_pile':
      case 'fang_trophy': {
        addBox(harvestVisual, 0.46, 0.07, 0.08, this.matBone, 0, 0.05, 0, 0, 0.4, 0.05);
        addBox(harvestVisual, 0.36, 0.06, 0.07, this.matBone, 0.05, 0.08, 0.04, 0, -0.7, 0);
        if (def.visualKind === 'fang_trophy') {
          const fang = new THREE.Mesh(
            this.regGeo(new THREE.ConeGeometry(0.06, 0.22, 4)),
            this.matBone
          );
          fang.position.set(0, 0.15, 0.12);
          fang.rotation.x = 0.5;
          harvestVisual.add(fang);
        }
        break;
      }
      case 'hunter_cache':
      case 'fur_snag': {
        addBox(harvestVisual, 0.42, 0.14, 0.32, this.matHide, 0, 0.08, 0, 0, 0.2, 0);
        addBox(harvestVisual, 0.28, 0.09, 0.22, this.matBark, 0.04, 0.17, 0.02, 0, -0.3, 0);
        break;
      }
      case 'found_coins': {
        const pouch = new THREE.Mesh(
          this.regGeo(new THREE.DodecahedronGeometry(0.18, 0)),
          this.matHide
        );
        pouch.position.y = 0.14;
        harvestVisual.add(pouch);
        const coin = new THREE.Mesh(
          this.regGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 6)),
          this.matGold
        );
        coin.position.set(0.18, 0.04, 0.12);
        harvestVisual.add(coin);
        break;
      }
      case 'found_pottery': {
        const urn = new THREE.Mesh(
          this.regGeo(new THREE.CylinderGeometry(0.15, 0.12, 0.32, 6)),
          this.matPottery
        );
        urn.position.y = 0.16;
        harvestVisual.add(urn);
        addBox(harvestVisual, 0.16, 0.04, 0.14, this.matPottery, 0.22, 0.03, 0.1, 0, 0.5, 0);
        break;
      }
      case 'found_compass':
      case 'found_relic':
      case 'found_flask': {
        const ped = new THREE.Mesh(
          this.regGeo(new THREE.BoxGeometry(0.32, 0.16, 0.32)),
          this.matStone
        );
        ped.position.y = 0.08;
        group.add(ped);
        const gemMat =
          def.visualKind === 'found_compass'
            ? this.matGold
            : def.visualKind === 'found_flask'
              ? this.matTinOre
              : this.matRelicGlow;
        const itemMesh = new THREE.Mesh(
          this.regGeo(new THREE.OctahedronGeometry(0.15, 0)),
          gemMat
        );
        itemMesh.position.y = 0.28;
        harvestVisual.add(itemMesh);
        break;
      }
    }

    return { group, harvestVisual };
  }

  private instantiateNode(def: ResourceNodeDef): void {
    const { key, group: chunkGroup } = this.getOrCreateChunkGroup(def.x, def.z);
    const { group, harvestVisual } = this.buildNodeVisual(def);
    chunkGroup.add(group);

    const managed: ManagedNode = {
      ...def,
      chunkKey: key,
      group,
      harvestVisual,
    };
    this.nodes.push(managed);
    this.nodesById.set(def.id, managed);

    let list = this.nodesByChunk.get(key);
    if (!list) {
      list = [];
      this.nodesByChunk.set(key, list);
    }
    list.push(managed);
  }

  public isNodeAvailable(nodeId: string, state: ThornvaleSaveState): boolean {
    const node = this.nodesById.get(nodeId);
    if (!node) return false;
    if (node.isFoundItem) {
      return !state.collectedFoundItems[nodeId];
    }
    return !state.resourceStates[nodeId];
  }

  public syncFromSave(state: ThornvaleSaveState): void {
    this.saveState = state;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const avail = this.isNodeAvailable(n.id, state);
      n.harvestVisual.visible = avail;
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerZ: number,
    saveState: ThornvaleSaveState
  ): void {
    this.saveState = saveState;

    // Visibility culling by 36m spatial chunk
    const maxChunkDistSq = 82 * 82;
    this.chunkGroups.forEach((entry) => {
      const centerX = (entry.cx + 0.5) * this.chunkSize;
      const centerZ = (entry.cz + 0.5) * this.chunkSize;
      const dx = centerX - playerX;
      const dz = centerZ - playerZ;
      entry.group.visible = dx * dx + dz * dz <= maxChunkDistSq;
    });

    // Respawn depleted natural nodes cleanly every 0.8s, never while player is close (< 14m)
    this.respawnCheckAccum += dt;
    if (this.respawnCheckAccum < 0.8) return;
    this.respawnCheckAccum = 0;

    const depletedEntries = Object.entries(saveState.resourceStates);
    if (depletedEntries.length === 0) return;

    const nowMs = Date.now();
    const minPlayerSafeSq = 14 * 14;
    const toRestore: string[] = [];

    for (const [id, entry] of depletedEntries) {
      const node = this.nodesById.get(id);
      if (!node || node.isFoundItem || node.respawnSeconds <= 0) continue;
      if (nowMs - entry.depletedAt < node.respawnSeconds * 1000) continue;
      const dx = node.x - playerX;
      const dz = node.z - playerZ;
      if (dx * dx + dz * dz < minPlayerSafeSq) continue;
      toRestore.push(id);
    }

    if (toRestore.length > 0) {
      this.updateSaveState((prev) => {
        const nextRes = { ...prev.resourceStates };
        for (const id of toRestore) {
          delete nextRes[id];
        }
        return {
          ...prev,
          resourceStates: nextRes,
        };
      });
      for (const id of toRestore) {
        const node = this.nodesById.get(id);
        if (node) node.harvestVisual.visible = true;
      }
    }
  }

  public findNearestInteractableNode(
    playerX: number,
    playerY: number,
    playerZ: number,
    saveState: ThornvaleSaveState
  ): ManagedNode | null {
    const pCx = Math.floor(playerX / this.chunkSize);
    const pCz = Math.floor(playerZ / this.chunkSize);

    let best: ManagedNode | null = null;
    let bestDistSq = Infinity;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const list = this.nodesByChunk.get(this.getChunkKey(pCx + ox, pCz + oz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const n = list[i];
          if (!this.isNodeAvailable(n.id, saveState)) continue;
          if (Math.abs(playerY - n.y) > 2.2) continue;
          const dx = playerX - n.x;
          const dz = playerZ - n.z;
          const dSq = dx * dx + dz * dz;
          if (dSq <= n.radius * n.radius && dSq < bestDistSq) {
            bestDistSq = dSq;
            best = n;
          }
        }
      }
    }
    return best;
  }

  public harvestNode(
    nodeId: string,
    saveState: ThornvaleSaveState,
    ownedTools: { axe?: boolean; pickaxe?: boolean } = {}
  ): ResourceHarvestResult {
    const node = this.nodesById.get(nodeId);
    if (!node || !this.isNodeAvailable(nodeId, saveState)) {
      return {
        success: false,
        message: 'Nothing remains to gather here.',
        cueKind: 'foliage',
      };
    }

    // Tool-gating check (clean foundation for future tools)
    if (node.requiredTool === 'axe' && !ownedTools.axe) {
      return {
        success: false,
        blockedByTool: 'axe',
        message: 'An axe is needed to split heavy timber.',
        cueKind: 'locked',
      };
    }
    if (node.requiredTool === 'pickaxe' && !ownedTools.pickaxe) {
      return {
        success: false,
        blockedByTool: 'pickaxe',
        message: 'A pickaxe is needed to mine deep seams.',
        cueKind: 'locked',
      };
    }

    const fitTest = addItemsToInventory(saveState.inventory, node.yields, true);
    if (fitTest.addedTotal === 0 && fitTest.leftover > 0) {
      return {
        success: false,
        inventoryFull: true,
        message: 'Your pack is full — make space before gathering.',
        cueKind: 'locked',
      };
    }

    const nowMs = Date.now();
    this.updateSaveState((prev) => {
      const res = addItemsToInventory(prev.inventory, node.yields, true);
      if (res.addedTotal === 0 && res.leftover > 0) return prev;
      if (node.isFoundItem) {
        return {
          ...prev,
          inventory: res.nextSlots,
          collectedFoundItems: {
            ...prev.collectedFoundItems,
            [node.id]: true,
          },
        };
      }
      return {
        ...prev,
        inventory: res.nextSlots,
        resourceStates: {
          ...prev.resourceStates,
          [node.id]: { depletedAt: nowMs },
        },
      };
    });

    node.harvestVisual.visible = false;

    const summary = fitTest.addedItems
      .map((it) => {
        const def = ITEM_CATALOG[it.itemId];
        const name = def ? def.name : it.itemId;
        return it.quantity > 1 ? `${name} x${it.quantity}` : name;
      })
      .join(', ');

    return {
      success: true,
      message: `${node.isFoundItem ? 'Found' : 'Gathered'}: ${summary}`,
      cueKind: node.cueKind,
      isFoundItem: node.isFoundItem,
    };
  }

  public getNodeCount(): number {
    return this.nodes.length;
  }

  public dispose(): void {
    for (const g of this.sharedGeometries) g.dispose();
    for (const m of this.sharedMaterials) m.dispose();
    this.sharedGeometries.length = 0;
    this.sharedMaterials.length = 0;
    this.nodes.length = 0;
    this.nodesById.clear();
    this.nodesByChunk.clear();
    this.chunkGroups.clear();
  }
}
