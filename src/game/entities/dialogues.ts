import { NpcRole } from '../types';

export interface NpcDialogueEntry {
  id: string;
  name: string;
  title: string;
  role: NpcRole;
  greetings: string[];
  lines: string[];
  dangerLines: string[];
}

/**
 * Expandable catalogue of Thornvale NPC conversations.
 * Add new NPC entries or extend existing lines arrays without touching engine logic.
 */
export const NPC_DIALOGUE_CATALOG: Record<string, NpcDialogueEntry> = {
  npc_alden_crossroads: {
    id: 'npc_alden_crossroads',
    name: 'Alden',
    title: 'Road-Worn Traveler',
    role: 'traveler',
    greetings: [
      'Keep your lantern dry, stranger. The mist thickens beyond the crossroads.',
    ],
    lines: [
      'I walked north from Blackwater Bridge before dawn. Even the crows refused to settle near the old bastion.',
      'If you follow the western track into the hollow, watch for pale figures among the birch trunks—they vanish the moment your lantern finds them.',
      'Stay on packed earth when you hear twigs snap in the undergrowth. Wolves run bolder near dusk.',
    ],
    dangerLines: [
      'Lower your voice—something foul is prowling nearby!',
    ],
  },
  npc_mirella_camp: {
    id: 'npc_mirella_camp',
    name: 'Mirella',
    title: 'Traveling Peddler',
    role: 'merchant',
    greetings: [
      'Warm your hands by the embers, wanderer. Few souls still tread these timber roads.',
    ],
    lines: [
      'I trade salt, tallow candles, and iron nails between Elderwood and the outer valleys—when the roads stay clear.',
      'The homesteaders at Hollowbark left a ledger behind when the fog crept down from Greywatch.',
      'If you head toward Silvermire Pond, mind the cliff vault to the east. Heavy footsteps echo behind those iron doors.',
    ],
    dangerLines: [
      'By the hearth—keep that blade ready! A beast is close!',
    ],
  },
  npc_bram_homestead: {
    id: 'npc_bram_homestead',
    name: 'Bram',
    title: 'Timber-Feller',
    role: 'woodcutter',
    greetings: [
      'Thought I heard boots on the pine needles. Rare to see company out by Hollowbark.',
    ],
    lines: [
      'We used to haul clean pine down past the bridge, before the moss grew thick enough to choke the stone arches.',
      'Some of the deep oaks near the western shrine bleed sap cold as well-water. I do not swing my axe at those.',
      'Old Oswin still keeps the hearth inside the cottage to the south, though he speaks mostly to the embers now.',
    ],
    dangerLines: [
      'Back away from the trees—there is something hunting out there!',
    ],
  },
  npc_kaelen_hunter: {
    id: 'npc_kaelen_hunter',
    name: 'Kaelen',
    title: 'Mire-Edge Tracker',
    role: 'hunter',
    greetings: [
      'Tread softly. There is a stag herd grazing south of the bog.',
    ],
    lines: [
      'Deer will bolt at the crunch of gravel, yet I saw a white-horned hart stand still right beside the ruin stones without blinking.',
      'Boars root around the ferns past Pine Hollow. Give them room unless you want tusks at your greaves.',
      'And if you enter Cragstone Cavern—bring steel. Spiders big as hounds nest in the dark hollows.',
    ],
    dangerLines: [
      'Eyes up! Trackers do not linger when fangs are near.',
    ],
  },
  npc_gareth_tower: {
    id: 'npc_gareth_tower',
    name: 'Sergeant Gareth',
    title: 'Greywatch Warden',
    role: 'guard',
    greetings: [
      'Halt and state your purpose—ah, another wanderer of the pale road.',
    ],
    lines: [
      'Greywatch Tower still stands, though half the garrison rode south years ago and never sent word back.',
      'The Mossy Bastion to the northwest is strictly off-limits to folk without iron. Dead men walk beneath those broken arches.',
      'If you mean to climb the tower stairs, light the beacon brazier at the summit—it pushes back the gloom, if only a little.',
    ],
    dangerLines: [
      'Stand back, traveler! Hostiles have breached the ridge!',
    ],
  },
  npc_rowan_shrine: {
    id: 'npc_rowan_shrine',
    name: 'Sister Rowan',
    title: 'Silent Pilgrim',
    role: 'pilgrim',
    greetings: [
      'Peace to your lantern, wayfarer. Even under slate skies, the roots remember.',
    ],
    lines: [
      'The Sanctum of Whispering Roots was built long before Greywatch stone was quarried.',
      'Walk slowly near the standing stones. The moss-bound guardians wake only for those who trespass uninvited.',
      'Six old relics lie scattered across Thornvale—some hidden behind forgotten cavern doors, others watched by sleepless things.',
    ],
    dangerLines: [
      'May the old roots shield us—danger draws near!',
    ],
  },
  npc_elara_cottage: {
    id: 'npc_elara_cottage',
    name: 'Elara',
    title: 'Elderwood Villager',
    role: 'villager',
    greetings: [
      'Good day, traveler. Please mind the hens and the woodpile—the wind has been bitter since morning.',
    ],
    lines: [
      'My father helped lay the planks on Blackwater Bridge. You can still hear the brook rushing beneath it on quiet nights.',
      'Sometimes foxes slip right up to the porch at twilight, and owls nest in the eaves above.',
      'If you are heading up toward Sunken Barrow Cavern, watch your footing. The old tombs below were sealed for a reason.',
    ],
    dangerLines: [
      'Mercy! Keep that creature away from the cottage!',
    ],
  },
  npc_vespera_ruins: {
    id: 'npc_vespera_ruins',
    name: 'Vespera',
    title: 'Ruin-Delver',
    role: 'adventurer',
    greetings: [
      'Careful near the bastion steps. The stones here remember sharper steel than ours.',
    ],
    lines: [
      'I traced the aqueduct markings all the way from Sunken Gate. Beneath these ruins lie catacombs older than the crown.',
      'If you duel a stone warden or a skeleton in tight corridors, strike cleanly and step back—never let them pin you to a wall.',
      'Should the dark overwhelm you, crawl back toward the Moss Clearing to catch your breath.',
    ],
    dangerLines: [
      'Steel out! Something from the bastion is closing in!',
    ],
  },
  npc_oswin_indoor: {
    id: 'npc_oswin_indoor',
    name: 'Old Oswin',
    title: 'Cottage Keeper',
    role: 'keeper',
    greetings: [
      'Come in out of the damp, traveler. Shake the moss from your cloak.',
    ],
    lines: [
      'Folk say the forest holds no mercy, yet it spares those who know when to walk quietly and when to stand their ground.',
      'I keep a cellar beneath the floorboards, though cold air has been seeping up through the stone lately.',
      'Tend the brazier if the shadows lengthen. Fire still speaks a language older than anything beneath the hills.',
    ],
    dangerLines: [
      'Lock the latch—something prowls outside the eaves!',
    ],
  },
  npc_hermit_cabin: {
    id: 'npc_hermit_cabin',
    name: 'Corvin',
    title: 'Homestead Hermit',
    role: 'hermit',
    greetings: [
      'You found Hollowbark intact, then. Most passersby hurry past the gate.',
    ],
    lines: [
      'I stayed behind to watch the ledger and listen to the pines. The owls bring news faster than any rider.',
      'Upstairs by the shutters you can hear the crows circling the northern ridge whenever something stirs in the catacombs.',
      'Beware the Sunken Citadel Vault east of Silvermire. The wardens there never laid down their halberds.',
    ],
    dangerLines: [
      'Hush—heavy tread beyond the porch!',
    ],
  },
};

export const ROLE_FALLBACK_LINES: Record<NpcRole, string[]> = {
  traveler: [
    'The forest roads twist more than any map admits. Keep your bearings by the stones.',
    'Smoke from a hearth is the kindest sight in Thornvale.',
  ],
  merchant: [
    'Good iron and dry boots are worth more than coin out here.',
    'Even the boldest peddlers skirt the ruined bastion after dusk.',
  ],
  hunter: [
    'Watch the brush—hares scatter seconds before a wolf breaks cover.',
    'A calm step lets you watch deer graze without startling the grove.',
  ],
  woodcutter: [
    'Pine holds resin, oak holds memory. Both take patience to split.',
    'The fog settles thickest along Blackwater Brook.',
  ],
  hermit: [
    'Silence in these woods is never empty; it only listens back.',
    'Old stones keep their own counsel.',
  ],
  guard: [
    'Keep your lantern lit in the hollows and your hand near your hilt.',
    'Report any movement from the ruins to the watchtower.',
  ],
  adventurer: [
    'Every sealed archway in Thornvale hides either a relic or a guardian.',
    'Do not let cave crawlers flank you in narrow tunnels.',
  ],
  pilgrim: [
    'The ancient sanctum still hums beneath the moss.',
    'Not every spirit in these woods seeks harm; some only remember.',
  ],
  villager: [
    'Stay on the trodden path if you do not wish to lose the sun.',
    'We mend our roofs against the rain, and pray the ruins stay quiet.',
  ],
  keeper: [
    'The hearth stays warm for those who wander far.',
    'Rest a moment before descending into the deep stone.',
  ],
};
