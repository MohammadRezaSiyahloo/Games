import type { Place } from './content.ts';
import type { Game, Traveler } from './game.ts';

export const journeyModes = [
  {
    id: 'far',
    name: 'The Far Road',
    detail:
      'Two extra stages beyond the Last Well, with more starting provisions and late resupply stops.',
  },
  {
    id: 'frontier',
    name: 'The Long Road',
    detail:
      'Optional detours, a ridge bypass, and changing weather. Starts with 2 extra food, water, and coins.',
  },
  {
    id: 'standard',
    name: 'The Road East',
    detail: 'The familiar expedition with fixed road conditions and no extended detours.',
  },
] as const;
export type JourneyMode = (typeof journeyModes)[number]['id'];
export const detours: Place[] = [
  {
    id: 'grove',
    name: 'Rainkeeper Grove',
    stage: 1.5,
    region: 0,
    kind: 'camp',
    days: 1,
    wear: 5,
    description:
      'Barrels beneath the forest canopy catch the last clean rain. The grove costs an extra stop, but the barrels are full.',
    find: { water: 8, food: 3 },
  },
  {
    id: 'refuge',
    name: 'Bell Refuge',
    stage: 2.5,
    region: 1,
    kind: 'camp',
    days: 1,
    wear: 6,
    description:
      'A buried refuge holds trail rations and a little medicine. The old approach is sheltered from the mountain wind.',
    find: { food: 7, medicine: 1 },
  },
  {
    id: 'spring',
    name: 'Ember Spring',
    stage: 3.5,
    region: 2,
    kind: 'camp',
    days: 1,
    wear: 7,
    description:
      'Water seeps from red rock below the road. Fill the casks before heading back into the flats.',
    find: { water: 10 },
  },
];
export const ridgeBypass: readonly [string, string] = ['ridge', 'bridge'];

export type Bond = { a: Traveler; b: Traveler; strength: number };
export const maxBond = 3;
export const watchCost = 1;
export const orderedPair = (first: Traveler, second: Traveler) =>
  [first, second].sort() as [Traveler, Traveler];
export function bondLevel(g: Game, first: Traveler, second: Traveler) {
  const [a, b] = orderedPair(first, second);
  return g.bonds.find((bond) => bond.a === a && bond.b === b)?.strength ?? 0;
}
export function bondSupport(g: Game, index: number) {
  const person = g.crew[index];
  if (!person?.health) return 0;
  return g.crew.reduce((best, other) => {
    if (other.id === person.id || other.health < 40) return best;
    return Math.max(best, bondLevel(g, person.id, other.id));
  }, 0);
}
export function validBonds(value: unknown, members: readonly { id: Traveler }[]): value is Bond[] {
  if (!Array.isArray(value) || value.length > (members.length * (members.length - 1)) / 2)
    return false;
  const seen = new Set<string>();
  for (const b of value) {
    if (
      !b ||
      typeof b.a !== 'string' ||
      typeof b.b !== 'string' ||
      b.a >= b.b ||
      !members.some((m) => m.id === b.a) ||
      !members.some((m) => m.id === b.b) ||
      !Number.isInteger(b.strength) ||
      b.strength < 1 ||
      b.strength > maxBond
    )
      return false;
    const key = b.a + '/' + b.b;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

const watchStories: Partial<Record<string, readonly string[]>> = {
  'iona/mara': [
    'Iona shows Mara the seeds she carried out of her garden. Mara asks which ones can survive the cold.',
    'Mara finally tells Iona where she last saw her brother. Iona listens until the fire burns low.',
  ],
  'bram/tomas': [
    'Bram holds the lantern while Tomas writes another letter to his daughter.',
    'Tomas asks Bram to carry the letters if he cannot. Bram folds them into the lining of his coat.',
  ],
  'mara/nessa': [
    'Nessa teaches Mara which trail ribbons the forest traders used to tie in the rain.',
  ],
  'bram/edrin': [
    'Edrin hands Bram an old nail from his workshop. Bram turns it over and offers him a button from his regiment.',
  ],
};
export const watchStory = (a: Traveler, b: Traveler, level: number) =>
  watchStories[orderedPair(a, b).join('/')]?.[level - 1];
