import { InventorySlot, ItemCategory, ItemDefinition } from './types';

export const INVENTORY_CAPACITY = 24;

export interface ItemCategoryMeta {
  id: ItemCategory;
  label: string;
}

export const ACTIVE_INVENTORY_CATEGORIES: ItemCategoryMeta[] = [
  { id: 'natural_resource', label: 'Resources' },
  { id: 'material', label: 'Materials' },
  { id: 'plant', label: 'Plants' },
  { id: 'food', label: 'Food' },
  { id: 'misc', label: 'Misc' },
  { id: 'special', label: 'Special' },
];

export const RESERVED_FUTURE_CATEGORIES: ItemCategoryMeta[] = [
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'tool', label: 'Tools' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'crafted', label: 'Crafted' },
  { id: 'quest', label: 'Quest' },
];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  natural_resource: 'Natural Resource',
  material: 'Material',
  plant: 'Plant',
  food: 'Food',
  misc: 'Miscellaneous',
  special: 'Special Object',
  weapon: 'Weapon',
  armor: 'Armor',
  tool: 'Tool',
  equipment: 'Equipment',
  crafted: 'Crafted',
  quest: 'Quest Item',
};

export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  // === WOOD, FIBERS & ROOTS (natural_resource) ===
  branch: {
    id: 'branch',
    name: 'Dead Branch',
    category: 'natural_resource',
    description:
      'A dry fallen bough snapped from deep forest pines. Useful for kindling, shafts, and rough bindings.',
    maxStack: 25,
    icon: 'branch',
    rarity: 'common',
  },
  deadwood: {
    id: 'deadwood',
    name: 'Seasoned Deadwood',
    category: 'natural_resource',
    description:
      'Weathered heartwood cured by wind and mist. Burns steady and splits cleanly.',
    maxStack: 20,
    icon: 'deadwood',
    rarity: 'common',
  },
  small_log: {
    id: 'small_log',
    name: 'Split Timber Log',
    category: 'natural_resource',
    description:
      'A stout length of mossy pine timber gathered from windfall trunks. Foundation stock for future timbercraft.',
    maxStack: 12,
    icon: 'log',
    rarity: 'common',
  },
  plant_fiber: {
    id: 'plant_fiber',
    name: 'Coarse Plant Fiber',
    category: 'natural_resource',
    description:
      'Tough reeds and fibrous woodland stalks twisted into usable cordage strands.',
    maxStack: 30,
    icon: 'fiber',
    rarity: 'common',
  },
  liana_vine: {
    id: 'liana_vine',
    name: 'Forest Liana',
    category: 'natural_resource',
    description:
      'Pliable hanging creeper pulled from ancient boughs. Strong enough to lash staves and frames.',
    maxStack: 20,
    icon: 'liana',
    rarity: 'common',
  },
  gnarled_root: {
    id: 'gnarled_root',
    name: 'Gnarled Bog Root',
    category: 'natural_resource',
    description:
      'Dense, damp root pried from fen soil. Dense grain valued by woodcarvers and herbalists.',
    maxStack: 18,
    icon: 'root',
    rarity: 'uncommon',
  },
  tree_bark: {
    id: 'tree_bark',
    name: 'Stripped Pine Bark',
    category: 'natural_resource',
    description:
      'Thick flaky bark rich in tannin. Used for tinder, hides, and weatherproofing.',
    maxStack: 25,
    icon: 'bark',
    rarity: 'common',
  },
  pine_resin: {
    id: 'pine_resin',
    name: 'Amber Pine Resin',
    category: 'material',
    description:
      'Sticky aromatic pitch weeping from old conifers. Seals wood and feeds long-burning torches.',
    maxStack: 20,
    icon: 'resin',
    rarity: 'uncommon',
  },

  // === STONE, FLINT & ORES ===
  rough_stone: {
    id: 'rough_stone',
    name: 'Rough Fieldstone',
    category: 'natural_resource',
    description:
      'Angular grey slate pried from scree and creek banks. Solid rubble for cairns, hearths, and masonry.',
    maxStack: 25,
    icon: 'stone',
    rarity: 'common',
  },
  flint: {
    id: 'flint',
    name: 'Sharp Flint',
    category: 'natural_resource',
    description:
      'Dark glassy chert with razor fractures. Strikes cold sparks against iron and shapes keen edges.',
    maxStack: 20,
    icon: 'flint',
    rarity: 'common',
  },
  coal_chunk: {
    id: 'coal_chunk',
    name: 'Black Coal Seam',
    category: 'natural_resource',
    description:
      'Dense brittle coal chipped from exposed crag veins. Essential fuel for high-heat hearths and future forges.',
    maxStack: 20,
    icon: 'coal',
    rarity: 'uncommon',
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Raw Iron Ore',
    category: 'natural_resource',
    description:
      'Heavy rust-veined ironstone pulled from weathered rock outcrops across the highlands.',
    maxStack: 15,
    icon: 'ore_iron',
    rarity: 'uncommon',
  },
  copper_ore: {
    id: 'copper_ore',
    name: 'Raw Copper Ore',
    category: 'natural_resource',
    description:
      'Verdigris-streaked ore found near Silverwind Gorge and Cragstone ledges.',
    maxStack: 15,
    icon: 'ore_copper',
    rarity: 'uncommon',
  },
  tin_ore: {
    id: 'tin_ore',
    name: 'Raw Tin Ore',
    category: 'natural_resource',
    description:
      'Silvery-grey cassiterite nuggets nestled along damp riverstones and rocky passes.',
    maxStack: 15,
    icon: 'ore_tin',
    rarity: 'uncommon',
  },
  amber_shard: {
    id: 'amber_shard',
    name: 'Fossilized Amber Shard',
    category: 'material',
    description:
      'Translucent honeyed stone dug from ancient roots. Faintly warm to the touch.',
    maxStack: 10,
    icon: 'mineral_amber',
    rarity: 'rare',
  },
  moonstone_shard: {
    id: 'moonstone_shard',
    name: 'Silvermire Moonstone',
    category: 'material',
    description:
      'Pale opalescent mineral crystal only found in deep highland crevices and cavern thresholds.',
    maxStack: 10,
    icon: 'mineral_moon',
    rarity: 'rare',
  },

  // === PLANTS, MUSHROOMS & FOOD ===
  forest_mushroom: {
    id: 'forest_mushroom',
    name: 'Woodland Chanterelle',
    category: 'food',
    description:
      'Earthy cap harvested beside mossy stumps and fallen logs. Edible once dried or cooked over embers.',
    maxStack: 20,
    icon: 'mushroom',
    rarity: 'common',
  },
  bog_cap: {
    id: 'bog_cap',
    name: 'Mire Glowcap',
    category: 'plant',
    description:
      'Phosphorescent pale mushroom thriving in wet fens and damp hollows. Emits a faint teal sheen.',
    maxStack: 15,
    icon: 'glowcap',
    rarity: 'uncommon',
  },
  wild_berries: {
    id: 'wild_berries',
    name: 'Wild Thornberries',
    category: 'food',
    description:
      'Tart dark-crimson berries clustered on forest thickets. Sustenance for long marches through the mist.',
    maxStack: 25,
    icon: 'berries',
    rarity: 'common',
  },
  wild_herb: {
    id: 'wild_herb',
    name: 'Bitter Sage',
    category: 'plant',
    description:
      'Silvery-green aromatic leaves growing along sunny glade borders. Wards off damp chill.',
    maxStack: 25,
    icon: 'herb',
    rarity: 'common',
  },
  forest_flower: {
    id: 'forest_flower',
    name: 'Ashen Bellflower',
    category: 'plant',
    description:
      'Delicate slate-blue blossoms nodding beside stone markers and quiet clearings.',
    maxStack: 20,
    icon: 'flower',
    rarity: 'common',
  },
  medicinal_herb: {
    id: 'medicinal_herb',
    name: 'Silverleaf Yarrow',
    category: 'plant',
    description:
      'Prized wound-herb favored by rangers and village keepers to staunch bleeding and brew poultices.',
    maxStack: 15,
    icon: 'medicinal',
    rarity: 'uncommon',
  },
  wild_seeds: {
    id: 'wild_seeds',
    name: 'Dormant Forest Seeds',
    category: 'plant',
    description:
      'A dry handful of hardy woodland seeds salvaged from thickets and glade soil.',
    maxStack: 30,
    icon: 'seeds',
    rarity: 'common',
  },
  edible_root: {
    id: 'edible_root',
    name: 'Earthnut Tuber',
    category: 'food',
    description:
      'Nutty starchy tuber dug from soft loamy banks near birch and pine clearings.',
    maxStack: 20,
    icon: 'edible_root',
    rarity: 'common',
  },

  // === ANIMAL & FORAGED MATERIALS ===
  crow_feather: {
    id: 'crow_feather',
    name: 'Dark Crow Feather',
    category: 'material',
    description:
      'Glossy black flight feathers shed near roosts and ruined battlements. Ideal for fletching.',
    maxStack: 25,
    icon: 'feather',
    rarity: 'common',
  },
  bone_shard: {
    id: 'bone_shard',
    name: 'Weathered Bone',
    category: 'material',
    description:
      'Bleached animal bone salvaged from predator dens and old barrows. Carves into pins and grips.',
    maxStack: 20,
    icon: 'bone',
    rarity: 'common',
  },
  raw_hide: {
    id: 'raw_hide',
    name: 'Scrapped Hide',
    category: 'material',
    description:
      'Rough untanned hide recovered from abandoned hunter caches and old traps.',
    maxStack: 12,
    icon: 'hide',
    rarity: 'uncommon',
  },
  coarse_fur: {
    id: 'coarse_fur',
    name: 'Tufted Wolf Pelt',
    category: 'material',
    description:
      'Thick grey winter fur caught on brambles or cured beside forest camps.',
    maxStack: 12,
    icon: 'fur',
    rarity: 'uncommon',
  },
  beast_fang: {
    id: 'beast_fang',
    name: 'Broken Predator Fang',
    category: 'material',
    description:
      'Heavy curved tooth from a forest wolf or cave beast. Worn as a hunter tally.',
    maxStack: 15,
    icon: 'fang',
    rarity: 'uncommon',
  },

  // === FOUND OBJECTS & UNIQUE RELICS ===
  old_coin: {
    id: 'old_coin',
    name: 'Tarnished Silver Crown',
    category: 'misc',
    description:
      'Minted in a forgotten border barony before Thornvale sank into fog. Still bears a worn stag crest.',
    maxStack: 50,
    icon: 'coin',
    rarity: 'uncommon',
  },
  pottery_shard: {
    id: 'pottery_shard',
    name: 'Glazed Pottery Shard',
    category: 'misc',
    description:
      'Fragment of an ancient salt-glazed amphora etched with spiral root motifs.',
    maxStack: 20,
    icon: 'pottery',
    rarity: 'common',
  },
  damaged_book: {
    id: 'damaged_book',
    name: 'Water-Stained Chronicles',
    category: 'special',
    description:
      'A leather-bound parish chronicle swollen with damp. Maps old boundary stones beyond Silvermire.',
    maxStack: 1,
    icon: 'book',
    rarity: 'unique',
    isUnique: true,
  },
  iron_signet: {
    id: 'iron_signet',
    name: 'Greywatch Signet Ring',
    category: 'special',
    description:
      'Heavy blackened iron seal bearing the watchtower battlement emblem of the old southern garrison.',
    maxStack: 1,
    icon: 'seal',
    rarity: 'unique',
    isUnique: true,
  },
  sanctum_charm: {
    id: 'sanctum_charm',
    name: 'Whispering Root Charm',
    category: 'special',
    description:
      'Intertwined palewood knot bound in copper wire. Smells faintly of rain-soaked cedar.',
    maxStack: 1,
    icon: 'relic',
    rarity: 'unique',
    isUnique: true,
  },
  surveyor_compass: {
    id: 'surveyor_compass',
    name: 'Broken Brass Compass',
    category: 'special',
    description:
      'A tarnished surveyor instrument recovered from the southern waystation. Its needle still trembles north.',
    maxStack: 1,
    icon: 'compass',
    rarity: 'unique',
    isUnique: true,
  },
  barrow_seal: {
    id: 'barrow_seal',
    name: 'Sunken Barrow Seal',
    category: 'special',
    description:
      'Cold slate medallion carved with three concentric spirals from beneath the barrow steps.',
    maxStack: 1,
    icon: 'seal',
    rarity: 'unique',
    isUnique: true,
  },
  ancient_tablet: {
    id: 'ancient_tablet',
    name: 'Moss-Cracked Rune Tablet',
    category: 'special',
    description:
      'Fragment of an elder boundary stele recording water rights along Silverwind Gorge.',
    maxStack: 1,
    icon: 'relic',
    rarity: 'unique',
    isUnique: true,
  },
  lantern_tallow_flask: {
    id: 'lantern_tallow_flask',
    name: 'Sealed Tallow Flask',
    category: 'misc',
    description:
      'Stoppered pewter flask half-full of thick refined tallow for long watchtower nights.',
    maxStack: 10,
    icon: 'pottery',
    rarity: 'uncommon',
  },
};

export function createEmptyInventory(capacity = INVENTORY_CAPACITY): (InventorySlot | null)[] {
  return Array.from({ length: capacity }, () => null);
}

export function normalizeInventory(
  slots: (InventorySlot | null)[] | undefined,
  capacity = INVENTORY_CAPACITY
): (InventorySlot | null)[] {
  const result = createEmptyInventory(capacity);
  if (!Array.isArray(slots)) return result;
  for (let i = 0; i < Math.min(capacity, slots.length); i++) {
    const s = slots[i];
    if (
      s &&
      typeof s.itemId === 'string' &&
      ITEM_CATALOG[s.itemId] &&
      typeof s.quantity === 'number' &&
      s.quantity > 0
    ) {
      const def = ITEM_CATALOG[s.itemId];
      result[i] = {
        itemId: s.itemId,
        quantity: Math.min(def.maxStack, Math.floor(s.quantity)),
      };
    }
  }
  return result;
}

export function cloneInventorySlots(
  slots: (InventorySlot | null)[] | undefined
): (InventorySlot | null)[] {
  return normalizeInventory(slots).map((s) => (s ? { ...s } : null));
}

export function countUsedInventorySlots(slots: (InventorySlot | null)[]): number {
  let used = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) used++;
  }
  return used;
}

export function countInventoryItem(slots: (InventorySlot | null)[], itemId: string): number {
  let total = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s && s.itemId === itemId) total += s.quantity;
  }
  return total;
}

export interface AddInventoryOutcome {
  nextSlots: (InventorySlot | null)[];
  addedTotal: number;
  leftover: number;
  addedItems: { itemId: string; quantity: number }[];
}

/**
 * Adds a bundle of items atomically or partially (default atomic: require all items fit).
 */
export function addItemsToInventory(
  currentSlots: (InventorySlot | null)[],
  grants: { itemId: string; quantity: number }[],
  requireAllFit = true
): AddInventoryOutcome {
  const working = cloneInventorySlots(currentSlots);
  const addedItems: { itemId: string; quantity: number }[] = [];
  let addedTotal = 0;
  let leftover = 0;

  for (const grant of grants) {
    const def = ITEM_CATALOG[grant.itemId];
    if (!def || grant.quantity <= 0) continue;

    // Prevent duplicate unique items
    if (def.isUnique && countInventoryItem(working, grant.itemId) > 0) {
      continue;
    }

    let remaining = Math.floor(grant.quantity);
    let addedThis = 0;

    // 1. Fill existing partial stacks first
    for (let i = 0; i < working.length && remaining > 0; i++) {
      const slot = working[i];
      if (!slot || slot.itemId !== grant.itemId) continue;
      const room = def.maxStack - slot.quantity;
      if (room <= 0) continue;
      const take = Math.min(room, remaining);
      slot.quantity += take;
      remaining -= take;
      addedThis += take;
    }

    // 2. Fill empty slots
    for (let i = 0; i < working.length && remaining > 0; i++) {
      if (working[i] !== null) continue;
      const take = Math.min(def.maxStack, remaining);
      working[i] = { itemId: grant.itemId, quantity: take };
      remaining -= take;
      addedThis += take;
    }

    if (addedThis > 0) {
      addedItems.push({ itemId: grant.itemId, quantity: addedThis });
      addedTotal += addedThis;
    }
    if (remaining > 0) {
      leftover += remaining;
    }
  }

  if (requireAllFit && leftover > 0) {
    return {
      nextSlots: cloneInventorySlots(currentSlots),
      addedTotal: 0,
      leftover,
      addedItems: [],
    };
  }

  return {
    nextSlots: working,
    addedTotal,
    leftover,
    addedItems,
  };
}

export function moveOrSwapInventorySlot(
  currentSlots: (InventorySlot | null)[],
  fromIdx: number,
  toIdx: number
): (InventorySlot | null)[] {
  const next = cloneInventorySlots(currentSlots);
  if (
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= next.length ||
    toIdx >= next.length ||
    fromIdx === toIdx
  ) {
    return next;
  }

  const source = next[fromIdx];
  const target = next[toIdx];
  if (!source) return next;

  // Merge stacks if identical item and target has room
  if (target && target.itemId === source.itemId) {
    const def = ITEM_CATALOG[source.itemId];
    if (def && target.quantity < def.maxStack) {
      const space = def.maxStack - target.quantity;
      const moveAmt = Math.min(space, source.quantity);
      target.quantity += moveAmt;
      source.quantity -= moveAmt;
      if (source.quantity <= 0) {
        next[fromIdx] = null;
      }
      return next;
    }
  }

  next[toIdx] = source;
  next[fromIdx] = target;
  return next;
}

export function splitInventorySlot(
  currentSlots: (InventorySlot | null)[],
  slotIdx: number,
  splitAmount?: number
): { nextSlots: (InventorySlot | null)[]; splitSlotIdx: number | null } {
  const next = cloneInventorySlots(currentSlots);
  if (slotIdx < 0 || slotIdx >= next.length) {
    return { nextSlots: next, splitSlotIdx: null };
  }
  const source = next[slotIdx];
  if (!source || source.quantity < 2) {
    return { nextSlots: next, splitSlotIdx: null };
  }

  const emptyIdx = next.findIndex((s) => s === null);
  if (emptyIdx === -1) {
    return { nextSlots: next, splitSlotIdx: null };
  }

  const take = Math.max(
    1,
    Math.min(source.quantity - 1, splitAmount ?? Math.floor(source.quantity / 2))
  );
  source.quantity -= take;
  next[emptyIdx] = { itemId: source.itemId, quantity: take };
  return { nextSlots: next, splitSlotIdx: emptyIdx };
}

export function removeInventorySlotItem(
  currentSlots: (InventorySlot | null)[],
  slotIdx: number,
  amount?: number
): (InventorySlot | null)[] {
  const next = cloneInventorySlots(currentSlots);
  if (slotIdx < 0 || slotIdx >= next.length) return next;
  const slot = next[slotIdx];
  if (!slot) return next;
  if (amount === undefined || amount >= slot.quantity) {
    next[slotIdx] = null;
  } else if (amount > 0) {
    slot.quantity -= Math.floor(amount);
    if (slot.quantity <= 0) next[slotIdx] = null;
  }
  return next;
}
