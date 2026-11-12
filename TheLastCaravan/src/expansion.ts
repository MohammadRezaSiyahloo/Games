import type { Encounter, Place, Supplies } from './content.ts';

export const roles = ['Scout', 'Guard', 'Medic', 'Quartermaster', 'Reserve'] as const;
export type Role = (typeof roles)[number];
export const rolePerks: Record<Role, string> = {
  Scout: 'Cuts travel wear by 2 and improves foraging while fit.',
  Guard: 'Reduces road encounter injuries by 4 while fit.',
  Medic: 'Allows medicine to restore 30 health instead of 18 while fit.',
  Quartermaster: 'Saves 1 food per travel day while fit.',
  Reserve: 'Travels without a duty. Can take over for a wounded companion.',
};

export const recruits = [
  {
    id: 'nessa',
    name: 'Nessa Flint',
    role: 'Scout',
    trait: 'Trailwise',
    story:
      'Nessa used to guide peddlers through the trees. She still ties strips of green cloth to every fork.',
    perk: 'Adds 1 food when foraging while fit.',
    price: 4,
    market: 1,
  },
  {
    id: 'edrin',
    name: 'Edrin Moss',
    role: 'Guard',
    trait: 'Tinkerer',
    story: 'A millwright who keeps a handful of bent nails from his first workshop.',
    perk: 'Repairs restore 5 extra wagon condition while he is fit.',
    price: 5,
    market: 2,
  },
] as const;

export const upgrades = [
  {
    id: 'wheels',
    name: 'Ironbound wheels',
    materials: 4,
    coins: 2,
    detail: 'Reduces travel wear by 4 on every leg.',
  },
  {
    id: 'rack',
    name: 'Cargo rack',
    materials: 3,
    coins: 3,
    detail: 'Adds 10 cargo space and raises the heavy-load threshold by 8.',
  },
  {
    id: 'stove',
    name: 'Travel stove',
    materials: 4,
    coins: 2,
    detail: 'Reduces food use by 1 per travel day and improves camp cooking.',
  },
  {
    id: 'cover',
    name: 'Waxed canopy',
    materials: 3,
    coins: 2,
    detail: 'Reduces incoming encounter damage to crew by 3 and wagon by 5.',
  },
  {
    id: 'braces',
    name: 'Ashwood braces',
    materials: 3,
    coins: 2,
    detail: 'Repairing restores 10 extra wagon condition.',
  },
] as const;
export type Upgrade = (typeof upgrades)[number]['id'];
export const upgradeSlots = 2;

export const outfits = [
  { id: 'standard', name: 'Hearth Caravan', detail: 'Balanced starting provisions.', bonus: {} },
  {
    id: 'merchant',
    name: 'Merchant Train',
    detail: '+6 coins, −3 food. Opens after your first arrival.',
    bonus: { coins: 6, food: -3 },
  },
  {
    id: 'field',
    name: 'Field Infirmary',
    detail: '+3 medicine, −4 coins. Opens when all four founders reach the city.',
    bonus: { medicine: 3, coins: -4 },
  },
  {
    id: 'wright',
    name: 'Wheelwright’s Wagon',
    detail: '+4 materials, −3 water. Opens when you arrive with 80% wagon condition.',
    bonus: { materials: 4, water: -3 },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  detail: string;
  bonus: Partial<Supplies>;
}>;
export type Outfit = (typeof outfits)[number]['id'];

export const variants: (Place & { replaces: string })[] = [
  {
    id: 'oak',
    replaces: 'hollow',
    name: 'Hollow Oak',
    stage: 1,
    region: 0,
    kind: 'wild',
    days: 1,
    wear: 13,
    description:
      'Lightning opened an ancient oak. A rain barrel and good dry wood survived beneath its roots.',
    find: { water: 3, materials: 2 },
  },
  {
    id: 'kiln',
    replaces: 'pine',
    name: 'Potter’s Kiln',
    stage: 1,
    region: 0,
    kind: 'market',
    days: 2,
    wear: 7,
    description: 'The kiln still burns. Potters trade alongside a sheltered well.',
    find: { water: 3 },
  },
  {
    id: 'lodge',
    replaces: 'mill',
    name: 'The Winter Lodge',
    stage: 2,
    region: 1,
    kind: 'market',
    days: 2,
    wear: 11,
    description:
      'A shuttered lodge shelters teamsters, a small market, and a spare bundle of kindling.',
    find: { materials: 2 },
  },
  {
    id: 'ruins',
    replaces: 'salt',
    name: 'Cinder Ruins',
    stage: 4,
    region: 2,
    kind: 'wild',
    days: 1,
    wear: 16,
    description:
      'Soot lies thick in the old courtyard. An apothecary’s box is half buried by the gate.',
    find: { medicine: 2 },
  },
];

export const extraEncounters: Encounter[] = [
  {
    id: 'lantern',
    title: 'A Lantern in the Pines',
    region: 0,
    narrative:
      'A charcoal burner hangs a lamp across the track. He has water for sale and nowhere warm to sleep.',
    choices: [
      {
        label: 'Offer a hot meal for water',
        result: 'The burner fills your casks and eats with the crew.',
        supplies: { food: -2, water: 6 },
        morale: 4,
      },
      {
        label: 'Buy water',
        result: 'You leave with four measures of clear water.',
        supplies: { coins: -2, water: 4 },
      },
      { label: 'Stay on the road', result: 'The lamp goes out as you pass.', morale: -3 },
    ],
  },
  {
    id: 'berries',
    title: 'The Red Brambles',
    region: 0,
    narrative:
      'A hillside of berry canes stands beyond an old fence. Something has been feeding there.',
    choices: [
      {
        label: 'Gather a few baskets',
        result: 'You harvest from the fence line and leave the den alone.',
        supplies: { food: 3 },
        health: -6,
      },
      {
        label: 'Spend water washing the good fruit',
        result: 'Clean fruit fills two of your empty sacks.',
        supplies: { water: -2, food: 5 },
      },
      {
        label: 'Leave the hillside alone',
        result: 'The brambles rustle as you turn away.',
        morale: -2,
      },
    ],
  },
  {
    id: 'bell',
    title: 'The Empty Bell Tower',
    region: 0,
    narrative:
      'A bell rings in a village with no smoke. A rope runs from the tower into a low, dark storeroom.',
    choices: [
      {
        label: 'Leave a repair kit for the watch',
        result: 'The watchwoman steps out and shares her stores.',
        supplies: { materials: -1, food: 3, water: 3 },
        morale: 5,
      },
      {
        label: 'Look through the rubble',
        result: 'You salvage metal, but a loose beam scrapes the wagon.',
        supplies: { materials: 3 },
        wagon: -8,
      },
      { label: 'Answer with your own bell', result: 'An unseen traveler rings back.', morale: 3 },
    ],
  },
  {
    id: 'wolves',
    title: 'The Following Pack',
    region: 0,
    narrative:
      'Paws have followed your wagon since dusk. By moonrise there are eyes on both sides of the road.',
    choices: [
      { label: 'Leave a trail of meat', result: 'The pack stops to feed.', supplies: { food: -3 } },
      {
        label: 'Burn spare wood as a signal',
        result: 'The pack scatters before the torchlight.',
        supplies: { materials: -1 },
        morale: 4,
      },
      {
        label: 'Hold the road',
        result: 'Everyone reaches shelter with scratches and bruises.',
        health: -11,
        morale: -4,
      },
    ],
  },
  {
    id: 'ice',
    title: 'Black Ice',
    region: 1,
    narrative:
      'The track disappears beneath a smooth black sheet. Old wheel ruts lead straight toward the drop.',
    choices: [
      {
        label: 'Cut skids from spare timber',
        result: 'The runners hold the wagon on the inside of the track.',
        supplies: { materials: -2 },
        wagon: -2,
      },
      {
        label: 'Unload and carry the casks',
        result: 'One cask cracks against the ice, but the wagon holds.',
        supplies: { water: -3 },
        wagon: -5,
        injury: 'sprain',
      },
      {
        label: 'Ease the wagon across',
        result: 'The wagon reaches solid ground with a bent rim.',
        wagon: -14,
      },
    ],
  },
  {
    id: 'cairn',
    title: 'The Seventh Cairn',
    region: 1,
    narrative:
      'Someone has left a bundle of cloth and an unopened bottle at a snowbound trail marker.',
    choices: [
      {
        label: 'Leave a ration and take the remedy',
        result: 'You unwrap a dose of good medicine.',
        supplies: { food: -2, medicine: 1 },
        morale: 3,
      },
      {
        label: 'Build up the cairn',
        result: 'The next traveler will be able to see the marker in the snow.',
        supplies: { materials: -1 },
        morale: 8,
      },
      {
        label: 'Take the dry blankets',
        result: 'The blankets keep the wind off the rear watch.',
        morale: 4,
      },
    ],
  },
  {
    id: 'rope',
    title: 'The Hanging Causeway',
    region: 1,
    narrative:
      'A frayed footbridge will carry people. The only wagon road lies below a spill of loose scree.',
    choices: [
      {
        label: 'Rig a hauling line',
        result: 'You lower the wagon with a rope and reclaim a lost trader’s coins.',
        supplies: { materials: -2, coins: 4 },
        wagon: -3,
      },
      {
        label: 'Let the wagon slide',
        result: 'The wheels scrape but reach the lower track.',
        wagon: -11,
      },
      {
        label: 'Carry a lighter load across',
        result: 'You abandon a few provisions to make the crossing.',
        supplies: { food: -3, water: -2 },
        morale: 3,
      },
    ],
  },
  {
    id: 'snow',
    title: 'A Roof Against the Snow',
    region: 1,
    narrative:
      'A stone herder’s hut has enough room for the crew. Someone else has stashed dry wood inside.',
    choices: [
      {
        label: 'Leave coins and light a fire',
        result: 'You leave payment and warm everyone through.',
        supplies: { coins: -3 },
        health: 8,
        morale: 5,
      },
      {
        label: 'Cook from your own stores',
        result: 'The smell of stew brings the crew around the hearth.',
        supplies: { food: -2 },
        morale: 9,
      },
      {
        label: 'Use the hut as shelter',
        result: 'A short stop cuts the wind, but the cold sets into your hands.',
        health: -6,
        morale: 2,
      },
    ],
  },
  {
    id: 'waterline',
    title: 'The Water Line',
    region: 2,
    narrative:
      'A single pump still runs beside the road. Travelers have marked a line in the dirt to keep the queue fair.',
    choices: [
      {
        label: 'Pay for a place in line',
        result: 'Your turn comes before the pump runs dry.',
        supplies: { coins: -3, water: 7 },
      },
      {
        label: 'Offer timber for the pump handle',
        result: 'The pump keeper fills your casks in thanks.',
        supplies: { materials: -2, water: 6 },
        morale: 5,
      },
      {
        label: 'Wait for the last draw',
        result: 'Only a little water is left at the bottom.',
        supplies: { water: 2 },
        morale: -3,
      },
    ],
  },
  {
    id: 'dust',
    title: 'The Dust Wall',
    region: 2,
    narrative:
      'Dust blots out the horizon. A low wall offers cover, but its lee is filling with grit.',
    choices: [
      {
        label: 'Stretch a wet blanket over the wagon',
        result: 'The blanket keeps grit out of the axle bearings.',
        supplies: { water: -3 },
        wagon: -3,
      },
      {
        label: 'Build a timber screen',
        result: 'The screen takes the worst of the storm.',
        supplies: { materials: -2 },
        morale: 5,
      },
      {
        label: 'Shelter behind the wall',
        result: 'Dust works into the wheels and the crew’s lungs.',
        wagon: -9,
        health: -9,
      },
    ],
  },
  {
    id: 'salt-road',
    title: 'The Salt Trader',
    region: 2,
    narrative:
      'A trader has walked here with two full skins and a sack of salt. She asks for medicine for a cut that won’t close.',
    choices: [
      {
        label: 'Treat the cut for both skins',
        result: 'The trader offers both skins and leaves with the wound cleaned.',
        supplies: { medicine: -1, water: 8 },
        morale: 4,
      },
      {
        label: 'Buy a skin',
        result: 'You add a single skin to the wagon.',
        supplies: { coins: -3, water: 4 },
      },
      {
        label: 'Share your shade',
        result: 'You sit together until the sun moves off the road.',
        morale: 4,
      },
    ],
  },
  {
    id: 'city-fire',
    title: 'Fire on the Horizon',
    region: 2,
    narrative:
      'A signal fire burns where the city road meets the flats. Its keeper is rationing food to stranded travelers.',
    choices: [
      {
        label: 'Contribute to the pot',
        result: 'The keeper fills your casks while the travelers share a meal.',
        supplies: { food: -2, water: 4 },
        morale: 7,
      },
      {
        label: 'Buy a meal for the crew',
        result: 'Everyone eats before the road steepens again.',
        supplies: { coins: -4, food: 5 },
      },
      {
        label: 'Ask what lies ahead',
        result: 'The keeper points to the ridge where the city lanterns will come into view.',
        morale: 5,
      },
    ],
  },
  {
    id: 'letters',
    title: 'Letters Home',
    narrative:
      'The road bends around a mailbox still nailed to a post. Folded letters spill from the cracked door.',
    choices: [
      {
        label: 'Wrap the letters for the city',
        result: 'The bundle goes into the safest corner of the wagon.',
        supplies: { materials: -1 },
        morale: 8,
      },
      {
        label: 'Read one aloud',
        result: 'The crew listens to a letter from someone who wanted to be remembered.',
        morale: 4,
      },
      {
        label: 'Leave a note for others',
        result: 'You leave the map of a useful water source with the letters.',
        supplies: { water: -1 },
        morale: 6,
      },
    ],
  },
  {
    id: 'lantern-oil',
    title: 'The Broken Lantern',
    narrative:
      'A gust takes the lantern off its hook. Night is closing in and the front wheel needs someone to guide it.',
    choices: [
      {
        label: 'Buy a lamp from the next rider',
        result: 'A rider parts with a little lamp and a lump of dried cheese.',
        supplies: { coins: -3, food: 2 },
        morale: 4,
      },
      {
        label: 'Make a torch',
        result: 'A strip of spare wood lights the road to camp.',
        supplies: { materials: -1 },
      },
      {
        label: 'Guide the wagon in darkness',
        result: 'The wagon clips an unseen stone.',
        wagon: -10,
        morale: -3,
      },
    ],
  },
];

export const forks: Place[] = [
  {
    id: 'ridge',
    name: 'Crow Ridge',
    stage: 1,
    region: 0,
    kind: 'wild',
    days: 1,
    wear: 16,
    description:
      'Crows circle an exposed ridge. The trail is steep, but old iron and dry timber are easy to spot.',
    find: { materials: 3 },
  },
  {
    id: 'shelter',
    name: 'Snow Lantern',
    stage: 2,
    region: 1,
    kind: 'camp',
    days: 1,
    wear: 14,
    description:
      'A shepherd’s shelter is visible between the snowbanks. Fuel is scarce, but a box of trail rations waits inside.',
    find: { food: 3 },
  },
  {
    id: 'quarry',
    name: 'Old Quarry',
    stage: 3,
    region: 1,
    kind: 'wild',
    days: 1,
    wear: 19,
    description:
      'An exposed quarry track shaves a day off the sheltered road. Stone dust hides a bundle of iron fittings.',
    find: { materials: 3, coins: 3 },
  },
  {
    id: 'station',
    name: 'Cinder Station',
    stage: 4,
    region: 2,
    kind: 'camp',
    days: 1,
    wear: 14,
    description:
      'An abandoned courier station has a jar of clear water and old medical stores. The yard is rough on the wheels.',
    find: { water: 3, medicine: 1 },
  },
];
