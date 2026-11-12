import type { Choice, Encounter } from './content.ts';

export const newEncounters: Encounter[] = [
  {
    id: 'woodbridge',
    region: 0,
    title: 'The Broken Footbridge',
    narrative:
      'A plank bridge has collapsed beside a swollen brook. Across the water, a wayhouse keeper lifts a basket of bread. She could bring it over if someone braced the bridge.',
    choices: [
      {
        label: 'Brace the bridge',
        result:
          'You use two lengths of timber. The keeper brings bread and stays to help guide the wagon across.',
        supplies: { materials: -2, food: 5 },
      },
      {
        label: 'Wade across for the basket',
        result: 'You bring back a smaller basket, but the slippery bank turns a traveler’s ankle.',
        supplies: { food: 3 },
        health: -6,
        injury: 'sprain',
      },
      {
        label: 'Leave the bridge behind',
        result: 'You follow the bank until the road bends away from the wayhouse.',
        wagon: -5,
      },
    ],
  },
  {
    id: 'charcoal',
    region: 0,
    title: 'The Charcoal Camp',
    narrative:
      'A family tends a charcoal kiln behind a screen of branches. They offer grain for a share of your water. A smaller bundle is available for coin.',
    choices: [
      {
        label: 'Trade water for grain',
        result: 'The kiln workers fill your food sack and take two measures of water.',
        supplies: { water: -2, food: 5 },
      },
      {
        label: 'Buy a smaller bundle',
        result: 'Three rations of grain go into the wagon for two coins.',
        supplies: { coins: -2, food: 3 },
      },
      {
        label: 'Help cover the kiln',
        result:
          'The workers tell stories while you help them lay the turf. The crew leaves in better spirits.',
        morale: 4,
      },
    ],
  },
  {
    id: 'sled',
    region: 1,
    title: 'The Runaway Sled',
    narrative:
      'An empty sled slides down the slope and catches against a tree. Its owner calls from above. She offers a share of the load if you can help secure it.',
    choices: [
      {
        label: 'Tie off the sled with spare gear',
        result: 'You lose some rope but recover a bundle of metal fittings and a sealed food bag.',
        supplies: { materials: -1, food: 4, coins: 2 },
      },
      {
        label: 'Catch it from below',
        result: 'You save a little of the load. A traveler cuts a hand on the runners.',
        supplies: { food: 3 },
        health: -8,
        injury: 'cut',
      },
      {
        label: 'Warn the owner and keep clear',
        result: 'The owner climbs down safely. The sled slips out of sight.',
        morale: 2,
      },
    ],
  },
  {
    id: 'winch',
    region: 1,
    title: 'The Frozen Winch',
    narrative:
      'A rope winch stands over a half-frozen cistern. Its teeth are packed with ice. You can spend spare wood to lever it free or risk pulling it by hand.',
    choices: [
      {
        label: 'Lever the winch free',
        result: 'A piece of timber snaps, but the winch turns and the bucket comes up full.',
        supplies: { materials: -1, water: 6 },
      },
      {
        label: 'Draw a bucket by hand',
        result: 'The rope burns through a glove. You spill some water on the way back.',
        supplies: { water: 3 },
        health: -7,
      },
      {
        label: 'Leave the winch alone',
        result: 'The rope creaks in the wind as the caravan moves on.',
        morale: -2,
      },
    ],
  },
  {
    id: 'courier',
    region: 2,
    title: 'The Ash Courier',
    narrative:
      'A courier leans against a burned wall, guarding a sack of sealed parcels. A torn boot keeps him from walking far. He asks for food or spare leather.',
    choices: [
      {
        label: 'Patch his boot',
        result: 'You trade repair stock for the courier’s spare water skin and his thanks.',
        supplies: { materials: -1, water: 5 },
        morale: 3,
      },
      {
        label: 'Share a meal',
        result: 'The courier eats beside the wagon, then pays you in small coins.',
        supplies: { food: -2, coins: 5 },
      },
      {
        label: 'Point him toward the next shelter',
        result: 'He marks the direction on a scrap of paper and waits for the wind to fall.',
        morale: 1,
      },
    ],
  },
  {
    id: 'covered-well',
    region: 2,
    title: 'The Covered Well',
    narrative:
      'A stone lid hides a well in the ruins of a courtyard. You can hear water below it. Someone has wedged the lid in place with an iron pin.',
    choices: [
      {
        label: 'Use timber to lift the lid',
        result: 'The lever splinters, but the well opens and the crew fills the casks.',
        supplies: { materials: -2, water: 8 },
      },
      {
        label: 'Reach through the gap',
        result: 'You draw some water before the dust drives you back.',
        supplies: { water: 4 },
        health: -7,
        injury: 'exposure',
      },
      {
        label: 'Keep the lid closed',
        result: 'You mark the well for a better-equipped caravan and move on.',
        morale: 2,
      },
    ],
  },
];

export type CampChoice = Choice & { markRoad?: boolean; scope?: 'crew' };
export const campStories = [
  {
    id: 'mara-map',
    person: 'mara',
    title: 'A Map from Memory',
    narrative:
      'Mara draws a bend in the road in the dirt beside the fire. It looks like a route she has been trying to remember all evening. She asks for a strip of wood to mark the worst turn.',
    choices: [
      {
        label: 'Give Mara wood for a marker',
        result:
          'Mara cuts a marker and shows the crew where to guide the wagon. The next leg will be easier on the wheels.',
        supplies: { materials: -1 },
        morale: 5,
        markRoad: true,
      },
      {
        label: 'Listen while she draws',
        result: 'You listen as Mara describes the route and the brother she last saw there.',
        morale: 4,
      },
    ],
  },
  {
    id: 'bram-watch',
    person: 'bram',
    title: 'The Empty Watch',
    narrative:
      'Bram sets a spare cup beside the fire. He says his old regiment kept one for whoever came off watch last. Tonight he keeps looking at it.',
    choices: [
      {
        label: 'Split a ration and stay with him',
        result:
          'Bram takes a long breath. By the time the ration is gone, he is telling a story about the last winter with his regiment.',
        supplies: { food: -1 },
        health: 6,
        morale: 9,
      },
      {
        label: 'Ask about the spare cup',
        result: 'Bram turns the cup in his hands and tells you who used to drink from it.',
        morale: 4,
      },
    ],
  },
  {
    id: 'iona-tea',
    person: 'iona',
    title: 'A Cup of Bitter Tea',
    narrative:
      'Iona rolls a bundle of dried leaves between her palms. They survived the road better than she expected. She can brew enough tea for everyone if you spare some water.',
    choices: [
      {
        label: 'Boil tea for the crew',
        result:
          'The cups pass around the fire. The bitter tea warms cold hands and settles tired travelers.',
        supplies: { water: -2 },
        health: 4,
        morale: 5,
        scope: 'crew',
      },
      {
        label: 'Help sort the dry leaves',
        result: 'Iona puts away the useful leaves and tells you which she planted in her garden.',
        morale: 4,
      },
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  person: string;
  title: string;
  narrative: string;
  choices: readonly CampChoice[];
}>;
export type CampStory = (typeof campStories)[number];
