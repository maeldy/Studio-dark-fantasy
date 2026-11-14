import {
  biomeAt,
  BOG_CENTER,
  CABIN_CENTER,
  CASCADE_CENTER,
  COTTAGE_CENTER,
  DEEPWOOD_NORTH_CENTER,
  FEN_NORTH_CENTER,
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
  walkableHeightAt,
  WAYSTATION_CENTER,
} from '../terrain';
import {
  AnimalSpecies,
  AnyEntitySpecies,
  BoxCollider,
  CircleCollider,
  CreatureSpecies,
  EntityCategory,
  InteriorId,
  MonsterSpecies,
  NpcRole,
} from '../types';

export interface EntitySpawnDef {
  id: string;
  category: EntityCategory;
  species: AnyEntitySpecies;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  patrolRadius?: number;
  waypoints?: { x: number; z: number }[];
  dialogueId?: string;
  herdId?: string;
  uniqueId?: string;
  maxHp?: number;
  attackDamage?: number;
  moveSpeed?: number;
  aggroRadius?: number;
  leashRadius?: number;
  /** Ambient creature that stays calm unless player enters restricted/close zone */
  territorialOnly?: boolean;
  /** Emits subtle soft point light (registered to world light pool) */
  glowColor?: string;
  glowIntensity?: number;
  glowDistance?: number;
  /** Birds start perched at this height or on ground */
  perchY?: number;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function isSpotClear(
  x: number,
  z: number,
  radius: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[]
): boolean {
  if (Math.hypot(x, z) > PLAYABLE_BOUNDS_RADIUS - 5) return false;
  if (groundSlopeAt(x, z) > 0.56) return false;
  if (Math.hypot(x - BOG_CENTER.x, z - BOG_CENTER.z) < 4.5) return false;
  if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < 6.4) return false;
  if (Math.hypot(x - FEN_NORTH_CENTER.x, z - FEN_NORTH_CENTER.z) < 9.2) return false;
  if (Math.hypot(x - MOOR_POND_CENTER.x, z - MOOR_POND_CENTER.z) < 10.6) return false;
  if (Math.hypot(x - CASCADE_CENTER.x, z - CASCADE_CENTER.z) < 8.5) return false;
  if (streamDistanceAt(x, z) < 2.2) return false;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.radius + radius + 0.35) return false;
  }

  for (let i = 0; i < boxColliders.length; i++) {
    const b = boxColliders[i];
    const cos = Math.cos(b.rotY);
    const sin = Math.sin(b.rotY);
    const dx = x - b.cx;
    const dz = z - b.cz;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (
      Math.abs(lx) < b.halfW + radius + 0.45 &&
      Math.abs(lz) < b.halfD + radius + 0.45
    ) {
      return false;
    }
  }
  return true;
}

function findValidSpot(
  targetX: number,
  targetZ: number,
  radius: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[],
  maxOffset = 7.0
): { x: number; y: number; z: number } | null {
  if (isSpotClear(targetX, targetZ, radius, colliders, boxColliders)) {
    return { x: targetX, y: walkableHeightAt(targetX, targetZ), z: targetZ };
  }
  for (let r = 1.0; r <= maxOffset; r += 1.0) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const tx = targetX + Math.cos(ang) * r;
      const tz = targetZ + Math.sin(ang) * r;
      if (isSpotClear(tx, tz, radius, colliders, boxColliders)) {
        return { x: tx, y: walkableHeightAt(tx, tz), z: tz };
      }
    }
  }
  return null;
}

export function buildOverworldSpawns(
  worldSeed: number,
  colliders: CircleCollider[],
  boxColliders: BoxCollider[]
): EntitySpawnDef[] {
  const rand = seededRand(worldSeed + 4491);
  const spawns: EntitySpawnDef[] = [];

  const pushValidated = (
    def: Omit<EntitySpawnDef, 'y'>,
    radius = 0.55,
    maxOffset = 6.0
  ) => {
    const spot = findValidSpot(def.x, def.z, radius, colliders, boxColliders, maxOffset);
    if (!spot) return;
    spawns.push({
      ...def,
      x: spot.x,
      y: spot.y,
      z: spot.z,
    });
  };

  // ============================================================================
  // 1. OVERWORLD NPCs (Balanced across crossroads, camps, dwellings, tower, ruins)
  // ============================================================================
  pushValidated(
    {
      id: 'npc_alden_crossroads',
      category: 'npc',
      species: 'traveler' as NpcRole,
      x: 4.5,
      z: -7.5,
      yaw: -0.45,
      patrolRadius: 3.5,
      waypoints: [
        { x: 4.5, z: -7.5 },
        { x: 7.5, z: -13.5 },
        { x: 3.2, z: -5.5 },
      ],
      dialogueId: 'npc_alden_crossroads',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_mirella_camp',
      category: 'npc',
      species: 'merchant' as NpcRole,
      x: 16.5,
      z: -14.2,
      yaw: -2.1,
      patrolRadius: 2.2,
      dialogueId: 'npc_mirella_camp',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_kaelen_hunter',
      category: 'npc',
      species: 'hunter' as NpcRole,
      x: -11.5,
      z: 10.5,
      yaw: 0.7,
      patrolRadius: 5.5,
      waypoints: [
        { x: -11.5, z: 10.5 },
        { x: -19.5, z: 14.5 },
        { x: -14.0, z: 12.2 },
      ],
      dialogueId: 'npc_kaelen_hunter',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_bram_homestead',
      category: 'npc',
      species: 'woodcutter' as NpcRole,
      x: CABIN_CENTER.x - 4.2,
      z: CABIN_CENTER.z + 5.8,
      yaw: 0.3,
      patrolRadius: 3.2,
      dialogueId: 'npc_bram_homestead',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_elara_cottage',
      category: 'npc',
      species: 'villager' as NpcRole,
      x: COTTAGE_CENTER.x - 3.6,
      z: COTTAGE_CENTER.z - 4.2,
      yaw: 2.3,
      patrolRadius: 3.0,
      dialogueId: 'npc_elara_cottage',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_gareth_tower',
      category: 'npc',
      species: 'guard' as NpcRole,
      x: TOWER_CENTER.x + 1.4,
      z: TOWER_CENTER.z + 8.6,
      yaw: 0.15,
      patrolRadius: 3.4,
      waypoints: [
        { x: TOWER_CENTER.x - 2.4, z: TOWER_CENTER.z + 8.6 },
        { x: TOWER_CENTER.x + 2.4, z: TOWER_CENTER.z + 8.4 },
      ],
      dialogueId: 'npc_gareth_tower',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_rowan_shrine',
      category: 'npc',
      species: 'pilgrim' as NpcRole,
      x: SHRINE_CENTER.x + 4.8,
      z: SHRINE_CENTER.z + 6.4,
      yaw: -0.9,
      patrolRadius: 2.4,
      dialogueId: 'npc_rowan_shrine',
    },
    0.55
  );

  pushValidated(
    {
      id: 'npc_vespera_ruins',
      category: 'npc',
      species: 'adventurer' as NpcRole,
      x: RUINS_CENTER.x + 13.5,
      z: RUINS_CENTER.z + 12.0,
      yaw: -0.6,
      patrolRadius: 2.8,
      dialogueId: 'npc_vespera_ruins',
    },
    0.55
  );

  // ============================================================================
  // 2. WILDLIFE — REDISTRIBUTED ACROSS ALL BIOMES (168m TERRITORY)
  // ============================================================================
  // A. Clearing, Riverbank & Outer Glade Deer Herds (Stags, Does, Roe Deer)
  const herdZones = [
    { x: 18, z: 5, herdId: 'herd_east_glade', count: 2 },
    { x: -24, z: -12, herdId: 'herd_west_pine', count: 2 },
    { x: 24, z: -36, herdId: 'herd_brook', count: 2 },
    { x: 60, z: -4, herdId: 'herd_silvermire', count: 3 },
    { x: -34, z: 36, herdId: 'herd_south_woods', count: 2 },
    { x: THORNWOOD_GLADES_CENTER.x - 16, z: THORNWOOD_GLADES_CENTER.z - 8, herdId: 'herd_thornwood_south', count: 3 },
    { x: THORNWOOD_GLADES_CENTER.x + 24, z: THORNWOOD_GLADES_CENTER.z + 14, herdId: 'herd_thornwood_east', count: 3 },
    { x: DEEPWOOD_NORTH_CENTER.x + 18, z: DEEPWOOD_NORTH_CENTER.z + 16, herdId: 'herd_deepwood_north', count: 3 },
    { x: 92, z: -30, herdId: 'herd_silverwind_bank', count: 2 },
  ];
  let animalIdx = 0;
  for (const hz of herdZones) {
    for (let i = 0; i < hz.count; i++) {
      const species: AnimalSpecies =
        i === 0 ? 'stag' : i === 1 ? 'doe' : 'roe_deer';
      const ox = (rand() - 0.5) * 9.0;
      const oz = (rand() - 0.5) * 9.0;
      pushValidated(
        {
          id: `animal_deer_${animalIdx++}`,
          category: 'animal',
          species,
          x: hz.x + ox,
          z: hz.z + oz,
          yaw: rand() * Math.PI * 2,
          patrolRadius: 12,
          herdId: hz.herdId,
        },
        0.65
      );
    }
  }

  // B. Wild Boars in deep forest brush & thornwood groves
  const boarAnchors = [
    { x: 12, z: -29 },
    { x: -24, z: 26 },
    { x: 40, z: -6 },
    { x: -38, z: -28 },
    { x: -48, z: 68 },
    { x: 42, z: 86 },
    { x: -64, z: -102 },
    { x: 78, z: -62 },
  ];
  for (const ba of boarAnchors) {
    pushValidated(
      {
        id: `animal_boar_${animalIdx++}`,
        category: 'animal',
        species: 'boar',
        x: ba.x,
        z: ba.z,
        yaw: rand() * Math.PI * 2,
        patrolRadius: 10,
      },
      0.55
    );
  }

  // C. Wild Wolves (spaced forest packs in deep north-west, deepwood & south-west)
  const wolfAnchors = [
    { x: -52, z: -42, herd: 'pack_nw' },
    { x: -57, z: -37, herd: 'pack_nw' },
    { x: 52, z: 34, herd: 'pack_se' },
    { x: 57, z: 30, herd: 'pack_se' },
    { x: -52, z: -116, herd: 'pack_far_nw' },
    { x: -58, z: -112, herd: 'pack_far_nw' },
    { x: -64, z: 96, herd: 'pack_far_sw' },
    { x: -70, z: 92, herd: 'pack_far_sw' },
  ];
  for (const wa of wolfAnchors) {
    pushValidated(
      {
        id: `animal_wolf_${animalIdx++}`,
        category: 'animal',
        species: 'wolf',
        x: wa.x,
        z: wa.z,
        yaw: rand() * Math.PI * 2,
        patrolRadius: 14,
        herdId: wa.herd,
      },
      0.55
    );
  }

  // D. Isolated Mountain / Crag & Highland Bears
  const bearAnchors = [
    { x: 66, z: 12 },
    { x: -66, z: -12 },
    { x: 18, z: -74 },
    { x: 126, z: -66 },
    { x: -110, z: -68 },
    { x: 88, z: 112 },
  ];
  for (const bea of bearAnchors) {
    pushValidated(
      {
        id: `animal_bear_${animalIdx++}`,
        category: 'animal',
        species: 'bear',
        x: bea.x,
        z: bea.z,
        yaw: rand() * Math.PI * 2,
        patrolRadius: 11,
      },
      0.85
    );
  }

  // E. Small Forest Mammals distributed cleanly from 10m to 152m across biomes
  const smallSpeciesPool: AnimalSpecies[] = [
    'rabbit',
    'rabbit',
    'fox',
    'squirrel',
    'squirrel',
    'badger',
    'hedgehog',
    'mouse',
  ];
  for (let i = 0; i < 40; i++) {
    const sp = smallSpeciesPool[i % smallSpeciesPool.length];
    const angle = (i / 40) * Math.PI * 2 + rand() * 0.25;
    const rad = 12 + (i / 40) * 136 + (rand() - 0.5) * 10;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    // Keep shy prey clear of bastion ruins & high-danger stone circle core
    if (Math.hypot(tx - RUINS_CENTER.x, tz - RUINS_CENTER.z) < 18) continue;
    if (Math.hypot(tx - HIGHLAND_RUIN_CENTER.x, tz - HIGHLAND_RUIN_CENTER.z) < 12) continue;
    const b = biomeAt(tx, tz);
    if (b === 'wetland' && (sp === 'rabbit' || sp === 'squirrel')) continue;
    pushValidated(
      {
        id: `animal_small_${animalIdx++}`,
        category: 'animal',
        species: sp,
        x: tx,
        z: tz,
        yaw: rand() * Math.PI * 2,
        patrolRadius: sp === 'fox' ? 13 : 7,
      },
      0.32
    );
  }

  // F. Birds across clearings, riverbanks, fen trees & highland cliffs
  const birdSpots: { species: AnimalSpecies; x: number; z: number; perchOffset?: number }[] = [
    { species: 'songbird', x: 3.2, z: 2.8 },
    { species: 'songbird', x: -5.4, z: -3.2 },
    { species: 'songbird', x: 18.0, z: -16.0 },
    { species: 'songbird', x: 64.0, z: -12.0 },
    { species: 'songbird', x: 26.0, z: 20.0 },
    { species: 'songbird', x: THORNWOOD_GLADES_CENTER.x + 8, z: THORNWOOD_GLADES_CENTER.z - 6 },
    { species: 'songbird', x: WAYSTATION_CENTER.x - 6, z: WAYSTATION_CENTER.z + 4 },
    { species: 'crow', x: -16.0, z: -42.0 },
    { species: 'crow', x: -46.0, z: -62.0 },
    { species: 'crow', x: FEN_NORTH_CENTER.x + 12, z: FEN_NORTH_CENTER.z + 8 },
    { species: 'crow', x: MOOR_POND_CENTER.x - 14, z: MOOR_POND_CENTER.z + 10 },
    { species: 'rook', x: 32.0, z: -30.0 },
    { species: 'rook', x: -30.0, z: 14.0 },
    { species: 'rook', x: STONEFALL_CIRCLE_CENTER.x + 14, z: STONEFALL_CIRCLE_CENTER.z + 12 },
    { species: 'owl', x: -28.0, z: -16.0, perchOffset: 2.6 },
    { species: 'owl', x: 18.0, z: -46.0, perchOffset: 2.8 },
    { species: 'owl', x: DEEPWOOD_NORTH_CENTER.x - 12, z: DEEPWOOD_NORTH_CENTER.z + 10, perchOffset: 2.8 },
    { species: 'barn_owl', x: CABIN_CENTER.x + 5.0, z: CABIN_CENTER.z + 2.0, perchOffset: 2.4 },
    { species: 'barn_owl', x: COTTAGE_CENTER.x + 4.5, z: COTTAGE_CENTER.z + 2.5, perchOffset: 2.4 },
    { species: 'eagle', x: 44.0, z: 14.0, perchOffset: 5.5 },
    { species: 'eagle', x: -24.0, z: -12.0, perchOffset: 6.2 },
    { species: 'eagle', x: CASCADE_CENTER.x + 8, z: CASCADE_CENTER.z - 14, perchOffset: 6.4 },
    { species: 'eagle', x: STONEFALL_CIRCLE_CENTER.x - 12, z: STONEFALL_CIRCLE_CENTER.z - 16, perchOffset: 6.0 },
  ];
  for (let i = 0; i < birdSpots.length; i++) {
    const b = birdSpots[i];
    const spot = findValidSpot(b.x, b.z, 0.35, colliders, boxColliders, 5.0);
    if (!spot) continue;
    spawns.push({
      id: `animal_bird_${i}`,
      category: 'animal',
      species: b.species,
      x: spot.x,
      y: spot.y + (b.perchOffset ?? 0),
      z: spot.z,
      yaw: rand() * Math.PI * 2,
      patrolRadius: b.species === 'eagle' ? 20 : 10,
      perchY: spot.y + (b.perchOffset ?? 0),
    });
  }

  // ============================================================================
  // 3. FANTASTIC & MYSTERIOUS CREATURES (Biome-matched & widely spaced)
  // ============================================================================
  const creatureDefs: Omit<EntitySpawnDef, 'y'>[] = [
    {
      id: 'creature_forest_spirit_west',
      category: 'creature',
      species: 'forest_spirit' as CreatureSpecies,
      x: -36.0,
      z: 4.0,
      patrolRadius: 10,
      glowColor: '#7be0c8',
      glowIntensity: 1.5,
      glowDistance: 7.5,
    },
    {
      id: 'creature_forest_spirit_deepwood',
      category: 'creature',
      species: 'forest_spirit' as CreatureSpecies,
      x: DEEPWOOD_NORTH_CENTER.x - 6,
      z: DEEPWOOD_NORTH_CENTER.z - 8,
      patrolRadius: 10,
      glowColor: '#7be0c8',
      glowIntensity: 1.5,
      glowDistance: 7.5,
    },
    {
      id: 'creature_pale_stag',
      category: 'creature',
      species: 'pale_stag' as CreatureSpecies,
      x: -32.0,
      z: -38.0,
      patrolRadius: 12,
      glowColor: '#8ad8ce',
      glowIntensity: 1.1,
      glowDistance: 6.5,
    },
    {
      id: 'creature_pale_stag_glades',
      category: 'creature',
      species: 'pale_stag' as CreatureSpecies,
      x: THORNWOOD_GLADES_CENTER.x + 2,
      z: THORNWOOD_GLADES_CENTER.z + 18,
      patrolRadius: 14,
      glowColor: '#8ad8ce',
      glowIntensity: 1.1,
      glowDistance: 6.5,
    },
    {
      id: 'creature_tree_sprite_1',
      category: 'creature',
      species: 'tree_sprite' as CreatureSpecies,
      x: -22.0,
      z: -26.0,
      patrolRadius: 6,
    },
    {
      id: 'creature_tree_sprite_north',
      category: 'creature',
      species: 'tree_sprite' as CreatureSpecies,
      x: DEEPWOOD_NORTH_CENTER.x + 14,
      z: DEEPWOOD_NORTH_CENTER.z + 6,
      patrolRadius: 7,
    },
    {
      id: 'creature_moss_dryad',
      category: 'creature',
      species: 'moss_dryad' as CreatureSpecies,
      x: 22.0,
      z: 36.0,
      patrolRadius: 8,
    },
    {
      id: 'creature_moss_dryad_cascade',
      category: 'creature',
      species: 'moss_dryad' as CreatureSpecies,
      x: CASCADE_CENTER.x - 14,
      z: CASCADE_CENTER.z + 12,
      patrolRadius: 8,
    },
    {
      id: 'creature_stone_guardian_shrine',
      category: 'creature',
      species: 'stone_guardian' as CreatureSpecies,
      x: SHRINE_CENTER.x - 4.2,
      z: SHRINE_CENTER.z - 2.4,
      yaw: 0.55,
      patrolRadius: 4,
      territorialOnly: true,
      maxHp: 90,
      attackDamage: 18,
      aggroRadius: 4.6,
      leashRadius: 10,
    },
    {
      id: 'creature_stone_guardian_circle',
      category: 'creature',
      species: 'stone_guardian' as CreatureSpecies,
      x: STONEFALL_CIRCLE_CENTER.x + 5.5,
      z: STONEFALL_CIRCLE_CENTER.z - 4.5,
      yaw: 2.1,
      patrolRadius: 5,
      territorialOnly: true,
      maxHp: 95,
      attackDamage: 18,
      aggroRadius: 5.0,
      leashRadius: 12,
    },
    {
      id: 'creature_moss_golem_tor',
      category: 'creature',
      species: 'moss_golem' as CreatureSpecies,
      x: 41.0,
      z: 7.0,
      patrolRadius: 5,
      territorialOnly: true,
      maxHp: 110,
      attackDamage: 20,
      aggroRadius: 5.5,
      leashRadius: 12,
    },
    {
      id: 'creature_moss_golem_highland',
      category: 'creature',
      species: 'moss_golem' as CreatureSpecies,
      x: HIGHLAND_RUIN_CENTER.x + 12,
      z: HIGHLAND_RUIN_CENTER.z + 14,
      patrolRadius: 6,
      territorialOnly: true,
      maxHp: 115,
      attackDamage: 20,
      aggroRadius: 5.5,
      leashRadius: 12,
    },
    {
      id: 'creature_wisp_bog',
      category: 'creature',
      species: 'wisp_entity' as CreatureSpecies,
      x: BOG_CENTER.x + 3.5,
      z: BOG_CENTER.z - 3.2,
      patrolRadius: 6,
      glowColor: '#8ee6d2',
      glowIntensity: 2.1,
      glowDistance: 8.0,
    },
    {
      id: 'creature_wisp_fen_north',
      category: 'creature',
      species: 'wisp_entity' as CreatureSpecies,
      x: FEN_NORTH_CENTER.x - 10,
      z: FEN_NORTH_CENTER.z + 6,
      patrolRadius: 8,
      glowColor: '#8ee6d2',
      glowIntensity: 2.1,
      glowDistance: 8.0,
    },
    {
      id: 'creature_wisp_moor_west',
      category: 'creature',
      species: 'wisp_entity' as CreatureSpecies,
      x: MOOR_POND_CENTER.x + 12,
      z: MOOR_POND_CENTER.z - 8,
      patrolRadius: 8,
      glowColor: '#8ee6d2',
      glowIntensity: 2.0,
      glowDistance: 8.0,
    },
    {
      id: 'creature_fog_apparition',
      category: 'creature',
      species: 'fog_apparition' as CreatureSpecies,
      x: -44.0,
      z: -56.0,
      patrolRadius: 9,
      glowColor: '#7ea2b8',
      glowIntensity: 0.9,
      glowDistance: 6.0,
    },
    {
      id: 'creature_fog_apparition_moor',
      category: 'creature',
      species: 'fog_apparition' as CreatureSpecies,
      x: MOOR_POND_CENTER.x - 16,
      z: MOOR_POND_CENTER.z + 14,
      patrolRadius: 10,
      glowColor: '#7ea2b8',
      glowIntensity: 0.9,
      glowDistance: 6.0,
    },
    {
      id: 'creature_shadow_stalker',
      category: 'creature',
      species: 'shadow_stalker' as CreatureSpecies,
      x: -18.0,
      z: -68.0,
      patrolRadius: 10,
    },
    {
      id: 'creature_shadow_stalker_fen',
      category: 'creature',
      species: 'shadow_stalker' as CreatureSpecies,
      x: FEN_NORTH_CENTER.x + 16,
      z: FEN_NORTH_CENTER.z - 12,
      patrolRadius: 11,
    },
  ];

  for (const cd of creatureDefs) {
    pushValidated(cd, 0.75, 5.5);
  }

  // ============================================================================
  // 4. OVERWORLD HOSTILE MONSTERS (Spaced across deep woods, fens, ruins & crags)
  // ============================================================================
  const monsterDefs: Omit<EntitySpawnDef, 'y'>[] = [
    // Deep Woods Predators (far from starter paths)
    {
      id: 'mon_dire_wolf_1',
      uniqueId: 'overworld_dire_wolf_1',
      category: 'monster',
      species: 'dire_wolf' as MonsterSpecies,
      x: -54.0,
      z: -30.0,
      patrolRadius: 12,
      maxHp: 45,
      attackDamage: 12,
      moveSpeed: 4.5,
      aggroRadius: 11.5,
      leashRadius: 22,
      herdId: 'dire_pack_west',
    },
    {
      id: 'mon_dire_wolf_2',
      uniqueId: 'overworld_dire_wolf_2',
      category: 'monster',
      species: 'dire_wolf' as MonsterSpecies,
      x: -59.0,
      z: -35.0,
      patrolRadius: 12,
      maxHp: 45,
      attackDamage: 12,
      moveSpeed: 4.5,
      aggroRadius: 11.5,
      leashRadius: 22,
      herdId: 'dire_pack_west',
    },
    {
      id: 'mon_dire_wolf_deepwood_n',
      uniqueId: 'overworld_dire_wolf_dn1',
      category: 'monster',
      species: 'dire_wolf' as MonsterSpecies,
      x: -62.0,
      z: -124.0,
      patrolRadius: 13,
      maxHp: 48,
      attackDamage: 13,
      moveSpeed: 4.55,
      aggroRadius: 11.5,
      leashRadius: 22,
    },
    {
      id: 'mon_thorn_fiend_bog',
      uniqueId: 'overworld_thorn_fiend_1',
      category: 'monster',
      species: 'thorn_fiend' as MonsterSpecies,
      x: -36.0,
      z: 10.0,
      patrolRadius: 8,
      maxHp: 58,
      attackDamage: 14,
      moveSpeed: 3.1,
      aggroRadius: 9.0,
      leashRadius: 17,
    },
    {
      id: 'mon_thorn_fiend_fen',
      uniqueId: 'overworld_thorn_fiend_fen',
      category: 'monster',
      species: 'thorn_fiend' as MonsterSpecies,
      x: FEN_NORTH_CENTER.x + 14.0,
      z: FEN_NORTH_CENTER.z + 10.0,
      patrolRadius: 9,
      maxHp: 60,
      attackDamage: 14,
      moveSpeed: 3.15,
      aggroRadius: 9.5,
      leashRadius: 18,
    },
    {
      id: 'mon_night_prowler_north',
      uniqueId: 'overworld_night_prowler_1',
      category: 'monster',
      species: 'night_prowler' as MonsterSpecies,
      x: 24.0,
      z: -62.0,
      patrolRadius: 10,
      maxHp: 52,
      attackDamage: 14,
      moveSpeed: 4.2,
      aggroRadius: 10.5,
      leashRadius: 19,
    },
    {
      id: 'mon_night_prowler_moor',
      uniqueId: 'overworld_night_prowler_moor',
      category: 'monster',
      species: 'night_prowler' as MonsterSpecies,
      x: MOOR_POND_CENTER.x - 18.0,
      z: MOOR_POND_CENTER.z - 14.0,
      patrolRadius: 11,
      maxHp: 54,
      attackDamage: 14,
      moveSpeed: 4.25,
      aggroRadius: 10.5,
      leashRadius: 20,
    },
    // Mossy Bastion Ruins
    {
      id: 'mon_bastion_skeleton_1',
      uniqueId: 'overworld_bastion_skel_1',
      category: 'monster',
      species: 'animated_skeleton' as MonsterSpecies,
      x: RUINS_CENTER.x + 2.5,
      z: RUINS_CENTER.z + 3.5,
      patrolRadius: 6,
      maxHp: 46,
      attackDamage: 13,
      moveSpeed: 3.15,
      aggroRadius: 9.5,
      leashRadius: 16,
    },
    {
      id: 'mon_bastion_husk_1',
      uniqueId: 'overworld_bastion_husk_1',
      category: 'monster',
      species: 'hollow_husk' as MonsterSpecies,
      x: RUINS_CENTER.x - 4.0,
      z: RUINS_CENTER.z - 2.5,
      patrolRadius: 5,
      maxHp: 56,
      attackDamage: 15,
      moveSpeed: 2.7,
      aggroRadius: 8.5,
      leashRadius: 15,
    },
    {
      id: 'mon_bastion_wraith',
      uniqueId: 'overworld_bastion_wraith',
      category: 'monster',
      species: 'ruin_wraith' as MonsterSpecies,
      x: -18.0,
      z: -50.0,
      patrolRadius: 8,
      maxHp: 60,
      attackDamage: 16,
      moveSpeed: 3.4,
      aggroRadius: 9.5,
      leashRadius: 18,
      glowColor: '#78cbbd',
      glowIntensity: 1.0,
      glowDistance: 6.0,
    },
    // Outer Highland Watch-Ruin & Stonefall Circle Guardians
    {
      id: 'mon_highland_skel',
      uniqueId: 'overworld_highland_skel',
      category: 'monster',
      species: 'animated_skeleton' as MonsterSpecies,
      x: HIGHLAND_RUIN_CENTER.x + 4.5,
      z: HIGHLAND_RUIN_CENTER.z - 6.0,
      patrolRadius: 7,
      maxHp: 52,
      attackDamage: 14,
      moveSpeed: 3.2,
      aggroRadius: 9.5,
      leashRadius: 17,
    },
    {
      id: 'mon_highland_husk',
      uniqueId: 'overworld_highland_husk',
      category: 'monster',
      species: 'hollow_husk' as MonsterSpecies,
      x: HIGHLAND_RUIN_CENTER.x - 5.0,
      z: HIGHLAND_RUIN_CENTER.z + 9.0,
      patrolRadius: 6,
      maxHp: 62,
      attackDamage: 15,
      moveSpeed: 2.75,
      aggroRadius: 9.0,
      leashRadius: 16,
    },
    {
      id: 'mon_stonefall_wraith',
      uniqueId: 'overworld_stonefall_wraith',
      category: 'monster',
      species: 'ruin_wraith' as MonsterSpecies,
      x: STONEFALL_CIRCLE_CENTER.x - 10.0,
      z: STONEFALL_CIRCLE_CENTER.z + 10.0,
      patrolRadius: 9,
      maxHp: 64,
      attackDamage: 16,
      moveSpeed: 3.45,
      aggroRadius: 9.5,
      leashRadius: 18,
      glowColor: '#78cbbd',
      glowIntensity: 1.0,
      glowDistance: 6.0,
    },
  ];

  for (const md of monsterDefs) {
    // Keep monsters off main start clearing if pathDist too close to (0,0)
    if (Math.hypot(md.x, md.z) < 22 && pathDistanceAt(md.x, md.z) < 2) continue;
    pushValidated(md, 0.7, 6.0);
  }

  return spawns;
}

// ============================================================================
// INTERIOR SPAWNS (Houses, Caves & Dungeons — respecting exact floor slabs)
// ============================================================================

export function buildInteriorSpawns(interiorId: InteriorId): EntitySpawnDef[] {
  switch (interiorId) {
    case 'cabin_interior':
      return [
        {
          id: 'npc_hermit_cabin',
          category: 'npc',
          species: 'hermit',
          x: -2.2,
          y: 0,
          z: -1.6,
          yaw: 0.4,
          patrolRadius: 2.0,
          dialogueId: 'npc_hermit_cabin',
        },
      ];

    case 'cottage_interior':
      return [
        {
          id: 'npc_oswin_indoor',
          category: 'npc',
          species: 'keeper',
          x: 1.4,
          y: 0,
          z: -1.4,
          yaw: -0.5,
          patrolRadius: 1.8,
          dialogueId: 'npc_oswin_indoor',
        },
      ];

    case 'tower_interior':
    case 'shrine_interior':
      // Intentionally quiet & deserted — atmospheric solitude
      return [];

    case 'cave_cragstone':
      return [
        {
          id: 'mon_crag_spider_1',
          uniqueId: 'cave_crag_spider_1',
          category: 'monster',
          species: 'giant_spider',
          x: -2.8,
          y: -0.8,
          z: -12.8,
          yaw: 0.3,
          patrolRadius: 3.2,
          maxHp: 54,
          attackDamage: 14,
          moveSpeed: 3.6,
          aggroRadius: 8.5,
          leashRadius: 12,
        },
        {
          id: 'mon_crag_crawler_1',
          uniqueId: 'cave_crag_crawler_1',
          category: 'monster',
          species: 'cave_crawler',
          x: 3.0,
          y: -0.8,
          z: -10.5,
          yaw: -0.6,
          patrolRadius: 3.0,
          maxHp: 44,
          attackDamage: 11,
          moveSpeed: 3.4,
          aggroRadius: 7.5,
          leashRadius: 11,
        },
      ];

    case 'cave_weeping':
      return [
        {
          id: 'mon_weep_crawler_1',
          uniqueId: 'cave_weep_crawler_1',
          category: 'monster',
          species: 'cave_crawler',
          x: -3.2,
          y: -0.55,
          z: -5.2,
          yaw: 0.5,
          patrolRadius: 3.5,
          maxHp: 46,
          attackDamage: 12,
          moveSpeed: 3.3,
          aggroRadius: 8.0,
          leashRadius: 12,
        },
        {
          id: 'creature_weep_wisp',
          category: 'creature',
          species: 'wisp_entity',
          x: 3.5,
          y: -0.55,
          z: -6.5,
          patrolRadius: 3.0,
          glowColor: '#7be0c8',
          glowIntensity: 1.6,
          glowDistance: 7.5,
        },
      ];

    case 'cave_ancient':
      return [
        {
          id: 'mon_barrow_skel_1',
          uniqueId: 'cave_barrow_skel_1',
          category: 'monster',
          species: 'animated_skeleton',
          x: -2.2,
          y: -1.6,
          z: -4.2,
          yaw: 0.2,
          patrolRadius: 2.6,
          maxHp: 50,
          attackDamage: 14,
          moveSpeed: 3.0,
          aggroRadius: 7.5,
          leashRadius: 10,
        },
        {
          id: 'creature_barrow_guardian',
          uniqueId: 'cave_barrow_guardian',
          category: 'creature',
          species: 'stone_guardian',
          x: 0.0,
          y: -1.6,
          z: -11.5,
          yaw: 0,
          patrolRadius: 2.5,
          territorialOnly: true,
          maxHp: 85,
          attackDamage: 18,
          aggroRadius: 4.5,
          leashRadius: 8,
        },
      ];

    case 'dungeon_catacombs':
      return [
        {
          id: 'mon_cat_skel_1',
          uniqueId: 'dungeon_cat_skel_1',
          category: 'monster',
          species: 'animated_skeleton',
          x: -3.2,
          y: 0,
          z: 0.5,
          yaw: 0.6,
          patrolRadius: 3.2,
          maxHp: 50,
          attackDamage: 13,
          moveSpeed: 3.1,
          aggroRadius: 8.5,
          leashRadius: 12,
        },
        {
          id: 'mon_cat_husk_1',
          uniqueId: 'dungeon_cat_husk_1',
          category: 'monster',
          species: 'hollow_husk',
          x: -2.5,
          y: -1.8,
          z: -14.2,
          yaw: 0.3,
          patrolRadius: 3.2,
          maxHp: 62,
          attackDamage: 15,
          moveSpeed: 2.75,
          aggroRadius: 8.5,
          leashRadius: 12,
        },
        {
          id: 'mon_cat_spider_secret',
          uniqueId: 'dungeon_cat_spider_secret',
          category: 'monster',
          species: 'giant_spider',
          x: 3.4,
          y: -1.8,
          z: -15.5,
          yaw: -0.9,
          patrolRadius: 2.5,
          maxHp: 58,
          attackDamage: 15,
          moveSpeed: 3.5,
          aggroRadius: 7.5,
          leashRadius: 11,
        },
      ];

    case 'dungeon_vault':
      return [
        {
          id: 'mon_vault_warden_hall',
          uniqueId: 'dungeon_vault_warden_hall',
          category: 'monster',
          species: 'temple_warden',
          x: 2.4,
          y: 0,
          z: 3.8,
          yaw: -0.4,
          patrolRadius: 3.2,
          maxHp: 72,
          attackDamage: 16,
          moveSpeed: 2.8,
          aggroRadius: 8.5,
          leashRadius: 12,
        },
        {
          id: 'mon_vault_colossus',
          uniqueId: 'dungeon_vault_colossus',
          category: 'monster',
          species: 'stone_colossus',
          x: 0.0,
          y: -1.4,
          z: -16.8,
          yaw: 0,
          patrolRadius: 2.6,
          territorialOnly: true,
          maxHp: 125,
          attackDamage: 22,
          moveSpeed: 2.35,
          aggroRadius: 5.8,
          leashRadius: 9,
        },
        {
          id: 'mon_vault_wraith',
          uniqueId: 'dungeon_vault_wraith',
          category: 'monster',
          species: 'ruin_wraith',
          x: 10.6,
          y: 0,
          z: 4.8,
          yaw: -Math.PI * 0.5,
          patrolRadius: 2.2,
          maxHp: 64,
          attackDamage: 16,
          moveSpeed: 3.2,
          aggroRadius: 6.5,
          leashRadius: 8,
          glowColor: '#82d4c8',
          glowIntensity: 1.1,
          glowDistance: 6.0,
        },
      ];
  }
}
