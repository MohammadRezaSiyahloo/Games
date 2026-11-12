import type { Place } from './content.ts';

export const lateStops: Place[] = [
  {
    id: 'cistern',
    name: 'Cistern Market',
    stage: 5,
    region: 2,
    kind: 'market',
    days: 2,
    wear: 9,
    description:
      'The cistern keepers draw water from below the burned streets. The approach is longer, but traders have food, spare wood, and medicine.',
    find: { water: 8 },
  },
  {
    id: 'gardens',
    name: 'Silt Gardens',
    stage: 5,
    region: 2,
    kind: 'camp',
    days: 1,
    wear: 13,
    description:
      'Gardeners left dried roots and sealed jars along the old irrigation wall. The short track is rutted, with no market at the far end.',
    find: { food: 6, water: 5 },
  },
  {
    id: 'beacon',
    name: 'Beacon Steps',
    stage: 6,
    region: 2,
    kind: 'camp',
    days: 1,
    wear: 12,
    description:
      'A watch fire marks the steep final approach. A small ration cache is tucked inside a wall beneath the steps.',
    find: { food: 3, water: 3 },
  },
  {
    id: 'crowswall',
    name: 'Crow’s Wall',
    stage: 6,
    region: 2,
    kind: 'market',
    days: 2,
    wear: 8,
    description:
      'The longer road runs along a sheltered wall. One last market gives you a chance to prepare for the city road.',
    find: { water: 5 },
  },
];
export const familyCrossing: Place = {
  id: 'reedpath',
  name: 'Reedkeeper Crossing',
  stage: 6,
  region: 2,
  kind: 'camp',
  days: 1,
  wear: 4,
  description:
    'The family leads you along the shaded towpath and leaves you fresh water and trail bread.',
  find: { water: 7, food: 3 },
};
export const familyPromise =
  'The father remembers Iona’s kindness. Before you part, he tells you to look for his family’s reed mark beyond the Last Well.';
export const familyReturn =
  'At the edge of the flats, you find the reed mark. The girl is on her feet again. Her father waves you toward a shaded crossing the main road misses.';

export const alternateOpenings: import('./content.ts').Encounter[] = [
  {
    id: 'fallen-signal',
    title: 'The Fallen Signal',
    region: 0,
    narrative:
      'A watchkeeper drags a broken lantern post off the road. She tells you it used to guide travelers to safe ground. She can still raise it if someone has timber.',
    choices: [
      {
        label: 'Give her timber for the post',
        result:
          'You cut two lengths from your repair stock. With the post braced, she lights the lantern again.',
        supplies: { materials: -2 },
        morale: 5,
      },
      {
        label: 'Show her where to find fallen wood',
        result: 'She takes your directions and sets off toward the trees.',
        morale: 2,
      },
      {
        label: 'Keep the repair stock',
        result: 'The unlit lantern disappears behind the wagon.',
        morale: -3,
      },
    ],
  },
  {
    id: 'empty-casks',
    title: 'The Empty Casks',
    region: 0,
    narrative:
      'Two coopers sit beside a split barrel. Their nearest well has dried up. They can patch the wood, but they need water to soak the staves and get back to work.',
    choices: [
      {
        label: 'Share three measures of water',
        result: 'They save a drink for the walk home and pour the rest over the dry staves.',
        supplies: { water: -3 },
        morale: 5,
      },
      {
        label: 'Leave a small meal',
        result: 'They share the meal before starting out to look for water.',
        supplies: { food: -2 },
        morale: 3,
      },
      {
        label: 'Keep the water for the road',
        result: 'The coopers tip the broken barrel off the track and let you pass.',
        morale: -3,
      },
    ],
  },
];
export const openingIds = ['child', 'fallen-signal', 'empty-casks'] as const;
export type Opening = (typeof openingIds)[number];
export const favors = {
  family: {
    opening: 'child',
    label: 'Family’s crossing',
    stop: familyCrossing,
    promise: familyPromise,
    returnText: familyReturn,
  },
  watch: {
    opening: 'fallen-signal',
    label: 'Watchkeeper’s shortcut',
    stop: {
      id: 'causeway',
      name: 'Watchkeeper’s Causeway',
      stage: 6,
      region: 2,
      kind: 'camp',
      days: 1,
      wear: 6,
      description:
        'The watchkeeper leads you under the old causeway. The shade saves water, and she shares a basket of bread and spare timber.',
      find: { food: 4, water: 4, materials: 2 },
    },
    promise:
      'The watchkeeper tells you to look for a lantern carved into a stone beyond the Last Well. Her old patrol took a shaded road past it.',
    returnText:
      'Beyond the Last Well, a familiar lantern swings in the dusk. The watchkeeper leads you down to her old patrol road.',
  },
  cooper: {
    opening: 'empty-casks',
    label: 'Coopers’ shortcut',
    stop: {
      id: 'coopers-yard',
      name: 'Coopers’ Yard',
      stage: 6,
      region: 2,
      kind: 'camp',
      days: 1,
      wear: 8,
      description:
        'The coopers walk you through the shade of their drying yard and fill the casks from a covered well.',
      find: { water: 10, food: 1 },
    },
    promise:
      'The coopers say their yard lies beyond the Last Well. They promise to show you its covered well if you reach the flats.',
    returnText:
      'The coopers are waiting beside a row of mended casks. They show you a shaded lane through their yard and offer water from the covered well.',
  },
} as const satisfies Record<
  string,
  { opening: Opening; label: string; stop: Place; promise: string; returnText: string }
>;
export type Favor = keyof typeof favors;
export const favorKeys = Object.keys(favors) as Favor[];
export const favorForOpening = (opening: string) =>
  favorKeys.find((key) => favors[key].opening === opening);
export const favorAtStop = (id: string) => favorKeys.find((key) => favors[key].stop.id === id);
