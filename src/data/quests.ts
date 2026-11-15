import { QuestDefinition } from '../types/gameplay';

export const GAMEPLAY_QUESTS: QuestDefinition[] = [
  {
    id: 'quest_first_camp',
    title: 'Kindle the Clearing',
    giver: 'Alden the Wayfarer',
    description:
      'Gather fieldstones and fallen branches, then build a Stone Campfire in the wilds.',
    kind: 'build',
    targetId: 'campfire',
    targetCount: 1,
    rewards: [
      { itemId: 'dried_ration', quantity: 2 },
      { itemId: 'old_coin', quantity: 3 },
    ],
  },
  {
    id: 'quest_craft_tools',
    title: 'Iron & Flint',
    giver: 'Bram the Woodcutter',
    description:
      'Craft either a Flint Hatchet or Stone Pickaxe so you can harvest heavy timber and deep ore.',
    kind: 'craft',
    targetId: 'any_tool',
    targetCount: 1,
    rewards: [
      { itemId: 'cordage', quantity: 3 },
      { itemId: 'herbal_poultice', quantity: 1 },
    ],
  },
  {
    id: 'quest_forage_valley',
    title: 'Provisions for the Mist',
    giver: 'Maeve of Elderwood',
    description: 'Gather 8 natural resources or forest plants across Thornvale.',
    kind: 'gather',
    targetId: 'any',
    targetCount: 8,
    rewards: [
      { itemId: 'boiled_root_broth', quantity: 1 },
      { itemId: 'medicinal_herb', quantity: 2 },
    ],
  },
  {
    id: 'quest_build_workbench',
    title: 'Timber & Anvil',
    giver: 'Garrison Quartermaster',
    description: 'Construct a Timber Workbench to forge iron blades and protective armor.',
    kind: 'build',
    targetId: 'workbench',
    targetCount: 1,
    rewards: [
      { itemId: 'iron_ingot', quantity: 2 },
      { itemId: 'old_coin', quantity: 5 },
    ],
  },
  {
    id: 'quest_thin_monsters',
    title: 'Ward the Trails',
    giver: 'Greywatch Sentinel',
    description: 'Defeat 3 hostile monsters prowling the ruins, groves, or caverns.',
    kind: 'defeat',
    targetId: 'any',
    targetCount: 3,
    rewards: [
      { itemId: 'moonstone_shard', quantity: 1 },
      { itemId: 'herbal_poultice', quantity: 2 },
    ],
  },
  {
    id: 'quest_chart_landmarks',
    title: 'Surveyor of Thornvale',
    giver: 'Order of the Lantern',
    description: 'Discover 6 distinct landmarks, dwellings, caves, or ruins.',
    kind: 'discover',
    targetId: 'any',
    targetCount: 6,
    rewards: [
      { itemId: 'iron_ingot', quantity: 2 },
      { itemId: 'old_coin', quantity: 8 },
    ],
  },
];
