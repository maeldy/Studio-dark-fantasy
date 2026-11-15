import { ItemDefinition } from '../game/types';
import { ConsumableEffect, GearStats } from '../types/gameplay';

export const GAMEPLAY_ITEMS: Record<string, ItemDefinition> = {
  // === TOOLS (tool) ===
  flint_hatchet: {
    id: 'flint_hatchet',
    name: 'Flint Hatchet',
    category: 'tool',
    description:
      'Knapped chert head lashed tightly with cordage to an ash shaft. Splits felled timber trunks.',
    maxStack: 1,
    icon: 'axe',
    rarity: 'common',
  },
  stone_pickaxe: {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    category: 'tool',
    description:
      'Pointed flint-and-slate pick bound with pine resin. Breaks deep iron seams and moonstone veins.',
    maxStack: 1,
    icon: 'pickaxe',
    rarity: 'common',
  },
  iron_axe: {
    id: 'iron_axe',
    name: 'Iron Forester Axe',
    category: 'tool',
    description:
      'Heavy forged iron felling axe balanced for seasoned timber and close-quarters defense.',
    maxStack: 1,
    icon: 'axe',
    rarity: 'uncommon',
  },
  iron_pickaxe: {
    id: 'iron_pickaxe',
    name: 'Iron Crag Pickaxe',
    category: 'tool',
    description:
      'Tempered iron mining pick capable of cleaving highland ironstone and crystal outcrops.',
    maxStack: 1,
    icon: 'pickaxe',
    rarity: 'uncommon',
  },

  // === WEAPONS (weapon) ===
  hunting_spear: {
    id: 'hunting_spear',
    name: 'Flint Hunting Spear',
    category: 'weapon',
    description:
      'Long seasoned shaft tipped with honed flint and bone collars. Keeps forest beasts at bay.',
    maxStack: 1,
    icon: 'spear',
    rarity: 'common',
  },
  thornvale_longsword: {
    id: 'thornvale_longsword',
    name: 'Forged Iron Longsword',
    category: 'weapon',
    description:
      'Double-edged iron blade quenched in cold brook water. Hits harder than a weathered travel sword.',
    maxStack: 1,
    icon: 'sword',
    rarity: 'uncommon',
  },
  moonstone_blade: {
    id: 'moonstone_blade',
    name: 'Silvermire Moonblade',
    category: 'weapon',
    description:
      'Edge inlaid with opalescent moonstone shards. Carves swiftly through barrow undead and wardens.',
    maxStack: 1,
    icon: 'sword',
    rarity: 'rare',
  },

  // === ARMOR & SHIELDS (armor) ===
  wooden_buckler: {
    id: 'wooden_buckler',
    name: 'Bound Timber Buckler',
    category: 'armor',
    description:
      'Layered pine planks braced with resin and rawhide. Deflects claw swipes and jagged spears.',
    maxStack: 1,
    icon: 'shield',
    rarity: 'common',
  },
  iron_kite_shield: {
    id: 'iron_kite_shield',
    name: 'Greywatch Kite Shield',
    category: 'armor',
    description:
      'Rim-forged iron shield stamped with the watchtower crest. Offers stout protection in vaults.',
    maxStack: 1,
    icon: 'shield',
    rarity: 'uncommon',
  },
  hide_jerkin: {
    id: 'hide_jerkin',
    name: 'Tanned Hide Jerkin',
    category: 'armor',
    description:
      'Supple cured hide laced over wool padding. Dampens blows without weighing down forest marches.',
    maxStack: 1,
    icon: 'armor',
    rarity: 'common',
  },
  wolfskin_cloak: {
    id: 'wolfskin_cloak',
    name: 'Wolfskin Mantle',
    category: 'armor',
    description:
      'Heavy fur-trimmed mantle cured with pine bark. Holds warmth through damp fens and mountain fog.',
    maxStack: 1,
    icon: 'cloak',
    rarity: 'uncommon',
  },
  iron_brigandine: {
    id: 'iron_brigandine',
    name: 'Riveted Iron Brigandine',
    category: 'armor',
    description:
      'Overlapping iron plates riveted beneath coarse hide. Built to withstand colossi and crypt wardens.',
    maxStack: 1,
    icon: 'armor',
    rarity: 'rare',
  },

  // === REFINED MATERIALS (crafted / material) ===
  cordage: {
    id: 'cordage',
    name: 'Twisted Cordage',
    category: 'crafted',
    description:
      'Braided woodland fiber and liana rope strong enough for tool lashings and palisade framing.',
    maxStack: 30,
    icon: 'cordage',
    rarity: 'common',
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: 'Smelted Iron Ingot',
    category: 'crafted',
    description:
      'Dense bar of dark Thornvale iron smelted with seam coal over hot embers.',
    maxStack: 20,
    icon: 'ingot',
    rarity: 'uncommon',
  },
  bronze_ingot: {
    id: 'bronze_ingot',
    name: 'Cast Bronze Ingot',
    category: 'crafted',
    description:
      'Copper and tin alloyed into a corrosion-resistant golden bar for fittings and hilts.',
    maxStack: 20,
    icon: 'ingot',
    rarity: 'uncommon',
  },

  // === CONSUMABLES & PROVISIONS (food / crafted) ===
  herbal_poultice: {
    id: 'herbal_poultice',
    name: 'Yarrow Wound Poultice',
    category: 'crafted',
    description:
      'Crushed Silverleaf Yarrow and pine resin bound in fiber cloth. Mends bleeding wounds swiftly.',
    maxStack: 10,
    icon: 'poultice',
    rarity: 'uncommon',
  },
  roasted_chanterelles: {
    id: 'roasted_chanterelles',
    name: 'Roasted Chanterelles',
    category: 'food',
    description:
      'Woodland mushrooms seared on ember stones with bitter sage. Restores vitality and endurance.',
    maxStack: 15,
    icon: 'mushroom',
    rarity: 'common',
  },
  dried_ration: {
    id: 'dried_ration',
    name: 'Trail Berry Ration',
    category: 'food',
    description:
      'Pressed thornberries and roasted earthnuts wrapped in bark. Keeps a wanderer moving all day.',
    maxStack: 15,
    icon: 'ration',
    rarity: 'common',
  },
  boiled_root_broth: {
    id: 'boiled_root_broth',
    name: 'Spiced Root Broth',
    category: 'food',
    description:
      'Steaming broth simmered from earthnuts, sage, and yarrow. Warms chilled bones and restores vigor.',
    maxStack: 10,
    icon: 'broth',
    rarity: 'uncommon',
  },
  warden_tincture: {
    id: 'warden_tincture',
    name: "Warden's Amber Tincture",
    category: 'crafted',
    description:
      'Illuminated apothecary draught distilled from fossilized amber, yarrow, and glowcaps. Mends severe wounds and wards off night chill.',
    maxStack: 6,
    icon: 'poultice',
    rarity: 'rare',
  },

  // === UNIQUE EXPLORATION GEAR & WEAPONS ===
  warden_greatsword: {
    id: 'warden_greatsword',
    name: "Oathbreaker's Warden Blade",
    category: 'weapon',
    description:
      'Broad, rune-etched iron greatsword recovered from the Sunken Citadel Treasury. Bears an amber pommel stone.',
    maxStack: 1,
    icon: 'sword',
    rarity: 'unique',
    isUnique: true,
  },
  sunfire_blade: {
    id: 'sunfire_blade',
    name: 'Sunfire Amber Edge',
    category: 'weapon',
    description:
      'Forged from an ancient sanctuary schematic — warm amber fuller channels faint hearth warmth along keen steel.',
    maxStack: 1,
    icon: 'sword',
    rarity: 'unique',
  },
  ashwood_tower_shield: {
    id: 'ashwood_tower_shield',
    name: 'Ashwood Watch Bulwark',
    category: 'armor',
    description:
      'Tall iron-rimmed watchtower shield locked inside Greywatch Keep. Turns aside heavy blows in deep ruins.',
    maxStack: 1,
    icon: 'shield',
    rarity: 'unique',
    isUnique: true,
  },
  lantern_bearer_mantle: {
    id: 'lantern_bearer_mantle',
    name: "Lantern-Bearer's Cloak",
    category: 'armor',
    description:
      'Oiled midnight-wool mantle fastened with bronze clasps. Keeps mist and night frost at bay.',
    maxStack: 1,
    icon: 'cloak',
    rarity: 'unique',
    isUnique: true,
  },

  // === EXPLORATION KEYS, MAPS, DOCUMENTS & RELICS ===
  greywatch_armory_key: {
    id: 'greywatch_armory_key',
    name: 'Greywatch Armory Key',
    category: 'special',
    description:
      'Heavy iron ward key stamped with a rook turret. Unlocks the sealed chest inside Greywatch Tower.',
    maxStack: 1,
    icon: 'key',
    rarity: 'unique',
    isUnique: true,
  },
  citadel_crypt_key: {
    id: 'citadel_crypt_key',
    name: 'Citadel Ossuary Key',
    category: 'special',
    description:
      'Verdigris bronze skeleton key hung with tiny iron rings. Opens the Grand Treasury chest beneath the Citadel.',
    maxStack: 1,
    icon: 'key',
    rarity: 'unique',
    isUnique: true,
  },
  forester_cipher_map: {
    id: 'forester_cipher_map',
    name: "Forester's Boundary Map",
    category: 'special',
    description:
      'Oilcloth field sketch marking the concealed boulder behind Silverwind Cascade and Greywatch Tower sconce.',
    maxStack: 1,
    icon: 'map',
    rarity: 'unique',
    isUnique: true,
  },
  herbalist_ledger_scroll: {
    id: 'herbalist_ledger_scroll',
    name: 'Elderwood Apothecary Folio',
    category: 'special',
    description:
      'Pressed bark folio recording the recipe for Warden Amber Tincture beneath Elderwood roots.',
    maxStack: 1,
    icon: 'scroll',
    rarity: 'unique',
    isUnique: true,
  },
  citadel_mason_note: {
    id: 'citadel_mason_note',
    name: "Mason's Seal Parchment",
    category: 'special',
    description:
      'Drafting parchment noting two iron rune levers guarding the Sunken Citadel West Treasury.',
    maxStack: 1,
    icon: 'scroll',
    rarity: 'unique',
    isUnique: true,
  },
  amber_star_astrolabe: {
    id: 'amber_star_astrolabe',
    name: 'Amber-Star Astrolabe',
    category: 'special',
    description:
      'Patinated brass star-wheel inlaid with amber shards. Aligns with Stonefall monoliths under night skies.',
    maxStack: 1,
    icon: 'compass',
    rarity: 'unique',
    isUnique: true,
  },
};

export const GEAR_STATS_BY_ITEM_ID: Record<string, GearStats> = {
  flint_hatchet: {
    slot: 'tool',
    visualKind: 'flint_hatchet',
    attackBonus: 4,
    defenseReduction: 0,
    warmthBonus: 0,
    toolKind: 'axe',
    gatherBonus: 1,
  },
  stone_pickaxe: {
    slot: 'tool',
    visualKind: 'stone_pickaxe',
    attackBonus: 4,
    defenseReduction: 0,
    warmthBonus: 0,
    toolKind: 'pickaxe',
    gatherBonus: 1,
  },
  iron_axe: {
    slot: 'tool',
    visualKind: 'iron_axe',
    attackBonus: 9,
    defenseReduction: 0,
    warmthBonus: 0,
    toolKind: 'axe',
    gatherBonus: 2,
  },
  iron_pickaxe: {
    slot: 'tool',
    visualKind: 'iron_pickaxe',
    attackBonus: 8,
    defenseReduction: 0,
    warmthBonus: 0,
    toolKind: 'pickaxe',
    gatherBonus: 2,
  },
  hunting_spear: {
    slot: 'weapon',
    visualKind: 'hunting_spear',
    attackBonus: 10,
    defenseReduction: 0,
    warmthBonus: 0,
  },
  thornvale_longsword: {
    slot: 'weapon',
    visualKind: 'thornvale_longsword',
    attackBonus: 18,
    defenseReduction: 0,
    warmthBonus: 0,
  },
  moonstone_blade: {
    slot: 'weapon',
    visualKind: 'moonstone_blade',
    attackBonus: 28,
    defenseReduction: 0.05,
    warmthBonus: 0,
  },
  wooden_buckler: {
    slot: 'shield',
    visualKind: 'wooden_buckler',
    attackBonus: 0,
    defenseReduction: 0.16,
    warmthBonus: 0,
  },
  iron_kite_shield: {
    slot: 'shield',
    visualKind: 'iron_kite_shield',
    attackBonus: 0,
    defenseReduction: 0.28,
    warmthBonus: 0,
  },
  hide_jerkin: {
    slot: 'armor',
    visualKind: 'hide_jerkin',
    attackBonus: 0,
    defenseReduction: 0.14,
    warmthBonus: 0.2,
  },
  wolfskin_cloak: {
    slot: 'armor',
    visualKind: 'wolfskin_cloak',
    attackBonus: 0,
    defenseReduction: 0.18,
    warmthBonus: 0.55,
  },
  iron_brigandine: {
    slot: 'armor',
    visualKind: 'iron_brigandine',
    attackBonus: 0,
    defenseReduction: 0.34,
    warmthBonus: 0.25,
  },
  warden_greatsword: {
    slot: 'weapon',
    visualKind: 'warden_greatsword',
    attackBonus: 34,
    defenseReduction: 0.08,
    warmthBonus: 0,
  },
  sunfire_blade: {
    slot: 'weapon',
    visualKind: 'sunfire_blade',
    attackBonus: 31,
    defenseReduction: 0.04,
    warmthBonus: 0.18,
  },
  ashwood_tower_shield: {
    slot: 'shield',
    visualKind: 'ashwood_tower_shield',
    attackBonus: 0,
    defenseReduction: 0.36,
    warmthBonus: 0,
  },
  lantern_bearer_mantle: {
    slot: 'armor',
    visualKind: 'lantern_bearer_mantle',
    attackBonus: 0,
    defenseReduction: 0.24,
    warmthBonus: 0.72,
  },
};

export const CONSUMABLE_EFFECTS_BY_ITEM_ID: Record<string, ConsumableEffect> = {
  wild_berries: {
    healHp: 8,
    restoreStamina: 18,
    restoreWarmth: 2,
    message: 'Ate Wild Thornberries (+8 HP, +18 Stamina)',
  },
  forest_mushroom: {
    healHp: 6,
    restoreStamina: 14,
    restoreWarmth: 0,
    message: 'Ate Woodland Chanterelle (+6 HP, +14 Stamina)',
  },
  edible_root: {
    healHp: 7,
    restoreStamina: 20,
    restoreWarmth: 2,
    message: 'Ate Earthnut Tuber (+7 HP, +20 Stamina)',
  },
  roasted_chanterelles: {
    healHp: 20,
    restoreStamina: 35,
    restoreWarmth: 12,
    message: 'Ate Roasted Chanterelles (+20 HP, +35 Stamina, +12 Warmth)',
  },
  dried_ration: {
    healHp: 24,
    restoreStamina: 55,
    restoreWarmth: 10,
    message: 'Ate Trail Berry Ration (+24 HP, +55 Stamina)',
  },
  boiled_root_broth: {
    healHp: 32,
    restoreStamina: 45,
    restoreWarmth: 42,
    message: 'Drank Spiced Root Broth (+32 HP, +45 Stamina, +42 Warmth)',
  },
  herbal_poultice: {
    healHp: 48,
    restoreStamina: 20,
    restoreWarmth: 8,
    message: 'Applied Yarrow Wound Poultice (+48 HP)',
  },
  warden_tincture: {
    healHp: 68,
    restoreStamina: 55,
    restoreWarmth: 35,
    message: "Drank Warden's Amber Tincture (+68 HP, +55 Stamina, +35 Warmth)",
  },
};

export interface MonsterLootDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

export const MONSTER_LOOT_TABLE: Record<string, MonsterLootDrop[]> = {
  dire_wolf: [
    { itemId: 'coarse_fur', quantity: 1, chance: 0.85 },
    { itemId: 'beast_fang', quantity: 1, chance: 0.7 },
  ],
  thorn_fiend: [
    { itemId: 'gnarled_root', quantity: 1, chance: 0.85 },
    { itemId: 'pine_resin', quantity: 1, chance: 0.65 },
  ],
  night_prowler: [
    { itemId: 'raw_hide', quantity: 1, chance: 0.8 },
    { itemId: 'beast_fang', quantity: 1, chance: 0.75 },
  ],
  animated_skeleton: [
    { itemId: 'bone_shard', quantity: 2, chance: 0.9 },
    { itemId: 'old_coin', quantity: 2, chance: 0.55 },
  ],
  ruin_wraith: [
    { itemId: 'moonstone_shard', quantity: 1, chance: 0.5 },
    { itemId: 'old_coin', quantity: 3, chance: 0.7 },
  ],
  hollow_husk: [
    { itemId: 'bone_shard', quantity: 1, chance: 0.85 },
    { itemId: 'plant_fiber', quantity: 2, chance: 0.6 },
  ],
  giant_spider: [
    { itemId: 'liana_vine', quantity: 2, chance: 0.85 },
    { itemId: 'beast_fang', quantity: 1, chance: 0.65 },
  ],
  cave_crawler: [
    { itemId: 'coal_chunk', quantity: 1, chance: 0.75 },
    { itemId: 'bone_shard', quantity: 1, chance: 0.7 },
  ],
  stone_colossus: [
    { itemId: 'iron_ore', quantity: 2, chance: 0.9 },
    { itemId: 'moonstone_shard', quantity: 1, chance: 0.7 },
  ],
  temple_warden: [
    { itemId: 'moonstone_shard', quantity: 2, chance: 0.9 },
    { itemId: 'old_coin', quantity: 5, chance: 0.85 },
  ],
  stone_guardian: [
    { itemId: 'rough_stone', quantity: 2, chance: 0.9 },
    { itemId: 'amber_shard', quantity: 1, chance: 0.6 },
  ],
  moss_golem: [
    { itemId: 'gnarled_root', quantity: 2, chance: 0.85 },
    { itemId: 'amber_shard', quantity: 1, chance: 0.5 },
  ],
  boar: [
    { itemId: 'raw_hide', quantity: 1, chance: 0.85 },
    { itemId: 'bone_shard', quantity: 1, chance: 0.55 },
  ],
  bear: [
    { itemId: 'coarse_fur', quantity: 2, chance: 0.95 },
    { itemId: 'beast_fang', quantity: 1, chance: 0.7 },
  ],
  wolf: [
    { itemId: 'coarse_fur', quantity: 1, chance: 0.75 },
    { itemId: 'beast_fang', quantity: 1, chance: 0.45 },
  ],
};
