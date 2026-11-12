import type { InjuryKind } from './injuries.ts';

export const resources = ['food', 'water', 'medicine', 'coins', 'materials'] as const;
export type Resource = (typeof resources)[number];
export type Supplies = Record<Resource, number>;
export const crew = [
  {
    id: 'mara',
    name: 'Mara Voss',
    role: 'Scout',
    trait: 'Woodwise',
    story: 'Mara remembers every road except the one that took her brother.',
    perk: 'Cuts travel wear by 2 while fit for duty.',
  },
  {
    id: 'bram',
    name: 'Bram Holt',
    role: 'Guard',
    trait: 'Veteran',
    story: 'Bram still keeps the watch schedule of a regiment that no longer exists.',
    perk: 'Reduces injuries from road encounters by 4 while fit.',
  },
  {
    id: 'iona',
    name: 'Iona Reed',
    role: 'Medic',
    trait: 'Herbalist',
    story: 'Iona carries seeds from the garden she had to leave behind.',
    perk: 'Medicine restores 30 health while Iona is fit, otherwise 18.',
  },
  {
    id: 'tomas',
    name: 'Tomas Vale',
    role: 'Quartermaster',
    trait: 'Resourceful',
    story: 'Tomas tallies supplies on the back of letters from his daughter.',
    perk: 'Saves 1 food per travel day while fit.',
  },
] as const;

export const regions = ['The Greenwild', 'The Frostmarch', 'The Ashen Expanse'] as const;
export type Place = {
  id: string;
  name: string;
  stage: number;
  region: number;
  kind: 'camp' | 'wild' | 'market' | 'city';
  days: number;
  wear: number;
  description: string;
  find?: Partial<Supplies>;
};
export const places: Place[] = [
  {
    id: 'hearth',
    name: 'Hearth Camp',
    stage: 0,
    region: 0,
    kind: 'camp',
    days: 0,
    wear: 0,
    description: 'Four travelers and one wagon. The trail begins beneath the last green boughs.',
  },
  {
    id: 'pine',
    name: 'Pinewatch',
    stage: 1,
    region: 0,
    kind: 'market',
    days: 2,
    wear: 5,
    description: 'A watchtower keeps the road open. Traders sell food, water, and remedies.',
  },
  {
    id: 'hollow',
    name: 'Wolfwood',
    stage: 1,
    region: 0,
    kind: 'wild',
    days: 1,
    wear: 9,
    description: 'The forest trail is quick, but roots and deadfall are hard on the wheels.',
    find: { food: 2 },
  },
  {
    id: 'pass',
    name: 'Glacier Pass',
    stage: 2,
    region: 1,
    kind: 'wild',
    days: 1,
    wear: 18,
    description: 'The high trail saves a day. Ice and loose stones punish the wagon.',
    find: { water: 4 },
  },
  {
    id: 'mill',
    name: 'The Old Mill',
    stage: 2,
    region: 1,
    kind: 'market',
    days: 2,
    wear: 8,
    description: 'A mill family runs a roadside market beside a half-frozen stream.',
  },
  {
    id: 'bridge',
    name: 'Ember Bridge',
    stage: 3,
    region: 1,
    kind: 'wild',
    days: 1,
    wear: 15,
    description: 'A narrow crossing leads out of the mountains. Salvage lies beneath the arch.',
    find: { materials: 3 },
  },
  {
    id: 'rest',
    name: 'Pilgrim’s Rest',
    stage: 3,
    region: 1,
    kind: 'camp',
    days: 2,
    wear: 6,
    description: 'A sheltered trail leads to a shrine where pilgrims leave food and melt snow.',
    find: { food: 4, water: 4 },
  },
  {
    id: 'salt',
    name: 'Saltreach',
    stage: 4,
    region: 2,
    kind: 'wild',
    days: 1,
    wear: 17,
    description: 'The salt flats offer a direct road to the city. Carry water into the heat.',
    find: { coins: 5 },
  },
  {
    id: 'well',
    name: 'The Last Well',
    stage: 4,
    region: 2,
    kind: 'market',
    days: 2,
    wear: 7,
    description:
      'The final settlement before the gates. Its well still runs and its market is open.',
    find: { water: 5 },
  },
  {
    id: 'city',
    name: 'The Last City',
    stage: 5,
    region: 2,
    kind: 'city',
    days: 1,
    wear: 12,
    description: 'The lanterns on the eastern wall are still burning. One final stretch remains.',
  },
];

export type Choice = {
  label: string;
  result: string;
  supplies?: Partial<Supplies>;
  wagon?: number;
  morale?: number;
  health?: number;
  target?: number;
  injury?: InjuryKind;
};
export type Encounter = {
  id: string;
  region?: number;
  title: string;
  narrative: string;
  choices: Choice[];
};
export const encounters: Encounter[] = [
  {
    id: 'merchant',
    title: 'The Abandoned Merchant',
    narrative:
      'A merchant braces his splintered wagon with a shoulder. Tomas recognizes the maker’s mark on the axle. “I can fix that,” he says, already reaching for the toolbox.',
    choices: [
      {
        label: 'Mend the axle',
        result: 'The merchant pays in smoked grain and promises to remember Tomas.',
        supplies: { materials: -2, food: 5 },
        morale: 7,
      },
      {
        label: 'Buy his water cask',
        result: 'You lash a full cask to the wagon before parting ways.',
        supplies: { coins: -3, water: 6 },
      },
      {
        label: 'Keep moving',
        result: 'Tomas watches the merchant shrink behind you.',
        morale: -5,
        target: 3,
      },
    ],
  },
  {
    id: 'child',
    title: 'The Fever',
    narrative:
      'A father asks Iona to look at his feverish daughter. She kneels beside the girl. “One dose might get her to morning.”',
    choices: [
      {
        label: 'Give Iona a dose',
        result: 'Iona waits until the girl can drink on her own.',
        supplies: { medicine: -1 },
        morale: 10,
      },
      {
        label: 'Leave food and water',
        result: 'The father packs the provisions under the girl’s blanket.',
        supplies: { food: -2, water: -2 },
        morale: 3,
      },
      {
        label: 'Save the medicine',
        result: 'Iona keeps her eyes on the road for the rest of the day.',
        morale: -16,
        target: 2,
      },
    ],
  },
  {
    id: 'toll',
    title: 'The Bandit Toll',
    narrative:
      'Three figures step onto the road. Their toll collector names a price. Bram loosens his sword in its scabbard and waits for your word.',
    choices: [
      {
        label: 'Pay for passage',
        result: 'The bandits let you pass and hand over a canteen.',
        supplies: { coins: -5, water: 2 },
      },
      {
        label: 'Let Bram face them',
        result: 'Bram buys you an opening and comes back bleeding.',
        health: -19,
        target: 1,
        morale: 4,
        injury: 'cut',
      },
      {
        label: 'Take the ditch',
        result: 'You escape their reach, but the wagon scrapes against stone.',
        wagon: -15,
      },
    ],
  },
  {
    id: 'wheel',
    title: 'The Split Wheel',
    narrative:
      'A crack like a musket shot brings the wagon to a halt. Mara crouches by the split wheel and points to the steep road ahead.',
    choices: [
      {
        label: 'Fit a new brace',
        result: 'Fresh timber holds the wheel steady for the next leg.',
        supplies: { materials: -2 },
        wagon: 12,
      },
      {
        label: 'Unload two sacks',
        result: 'The lighter load lets the wheel turn without grinding.',
        supplies: { food: -3 },
        wagon: -4,
      },
      {
        label: 'Limp onward',
        result: 'By the time you stop, the wheel has chewed a groove into its axle.',
        wagon: -16,
      },
    ],
  },
  {
    id: 'frost',
    region: 1,
    title: 'The White Wind',
    narrative:
      'The air turns white. Mara spots a rock shelf before the trail vanishes, but you have minutes to reach it.',
    choices: [
      {
        label: 'Build a windbreak',
        result: 'You burn spare timber and wait out the worst gusts.',
        supplies: { materials: -2 },
        morale: 5,
      },
      {
        label: 'Share a hot meal',
        result: 'Full bellies keep everyone warm through the climb.',
        supplies: { food: -3 },
        morale: 6,
      },
      {
        label: 'Push through the storm',
        result: 'You save the supplies. Everyone reaches shelter shivering.',
        health: -13,
        morale: -4,
        injury: 'exposure',
      },
    ],
  },
  {
    id: 'cache',
    title: 'The Cartographer’s Cache',
    narrative:
      'Mara finds a surveyor’s mark on a fallen stone. Beneath it, an iron chest is wedged into the earth.',
    choices: [
      {
        label: 'Pry open the chest',
        result: 'A crowbar breaks. Inside lie coins and two sealed remedies.',
        supplies: { materials: -1, coins: 6, medicine: 2 },
      },
      {
        label: 'Collect the trail rations',
        result: 'A waxed bundle under the stone has kept the food dry.',
        supplies: { food: 4 },
      },
      {
        label: 'Mark it for the next caravan',
        result: 'Mara cuts a fresh trail sign into a nearby pine.',
        morale: 6,
        target: 0,
      },
    ],
  },
  {
    id: 'ford',
    title: 'The Flooded Ford',
    narrative:
      'The current has swallowed the stepping stones. An old rope runs across the river, just above the foam.',
    choices: [
      {
        label: 'Pay for the ferry',
        result: 'A ferryman hauls the wagon across and fills a cask.',
        supplies: { coins: -4, water: 4 },
      },
      {
        label: 'Brace the wagon and cross',
        result: 'The braces hold. The river leaves the wheels badly battered.',
        supplies: { materials: -1 },
        wagon: -8,
      },
      {
        label: 'Cross with what you have',
        result: 'Water pours over the wagon bed and bruises the crew.',
        wagon: -12,
        health: -9,
        injury: 'sprain',
      },
    ],
  },
  {
    id: 'bread',
    title: 'Bread for the Road',
    narrative:
      'A baker and her son are walking west with a basket of bread. They ask if you can spare a drink.',
    choices: [
      {
        label: 'Trade a cask for bread',
        result: 'The baker wraps six portions in a clean cloth.',
        supplies: { water: -3, food: 6 },
        morale: 3,
      },
      {
        label: 'Buy a smaller loaf',
        result: 'You split a fresh loaf four ways.',
        supplies: { coins: -3, food: 3 },
      },
      {
        label: 'Share water freely',
        result: 'The boy takes a long drink and thanks the whole crew.',
        supplies: { water: -2 },
        morale: 8,
      },
      {
        label: 'Keep your provisions',
        result: 'The baker and her son continue west on their own.',
        morale: -4,
      },
    ],
  },
  {
    id: 'ash',
    region: 2,
    title: 'Ash on the Tongue',
    narrative:
      'A black cloud rolls off a burned hamlet. Through the haze, Bram spots the iron rims of an abandoned cart.',
    choices: [
      {
        label: 'Wet cloths and salvage',
        result: 'The damp cloths hold long enough to recover a stack of parts.',
        supplies: { water: -3, materials: 4 },
      },
      {
        label: 'Salvage quickly',
        result: 'Bram returns with two iron fittings and a hacking cough.',
        supplies: { materials: 2 },
        health: -15,
        target: 1,
        injury: 'exposure',
      },
      {
        label: 'Cover your faces and go',
        result: 'The haze passes. Everyone is tired and quiet.',
        morale: -4,
      },
    ],
  },
  {
    id: 'grave',
    title: 'Four Unmarked Graves',
    narrative:
      'Beside the road lie four shallow graves. One carries a child’s wooden horse. Bram stops without being asked.',
    choices: [
      {
        label: 'Build a marker',
        result: 'Bram carves a lantern into the marker before you leave.',
        supplies: { materials: -1 },
        morale: 8,
      },
      {
        label: 'Leave an offering',
        result: 'You set a piece of bread beside the wooden horse.',
        supplies: { food: -1 },
        morale: 4,
      },
      {
        label: 'Carry on in silence',
        result: 'Bram takes the rear watch alone that evening.',
        morale: -7,
        target: 1,
      },
    ],
  },
];

export const offers = [
  { id: 'food', label: 'Buy food', cost: { coins: -3, food: 7 } },
  { id: 'water', label: 'Fill the casks', cost: { coins: -2, water: 8 } },
  { id: 'medicine', label: 'Buy medicine', cost: { coins: -4, medicine: 1 } },
  { id: 'materials', label: 'Buy timber', cost: { coins: -3, materials: 3 } },
  { id: 'sell', label: 'Sell spare timber', cost: { materials: -2, coins: 1 } },
] satisfies { id: string; label: string; cost: Partial<Supplies> }[];
