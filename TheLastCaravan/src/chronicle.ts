import { resources } from './content.ts';
import type { Place, Supplies } from './content.ts';
import { validInjury } from './injuries.ts';
import type { Injury } from './injuries.ts';
import type { Game, Member, Traveler } from './game.ts';

export type PageKind = 'opening' | 'travel' | 'camp' | 'market' | 'encounter';
type Ledger = { supplies: Supplies; wagon: number; crew: Member[] };
type CrewChange = {
  id: Traveler;
  health: number;
  morale: number;
  state: '' | 'fallen' | 'joined';
  injury?: Injury;
};
export type Change = {
  reason: string;
  supplies: Partial<Supplies>;
  wagon: number;
  crew: CrewChange[];
  shortage?: { food: number; water: number };
};
export type DayPage = {
  day: number;
  place: string;
  region: number;
  kind: PageKind;
  story: string;
  changes: Change[];
  leg?: number;
  scene?: string;
};
export const capture = (g: Ledger): Ledger => ({
  supplies: { ...g.supplies },
  wagon: g.wagon,
  crew: g.crew.map((m) => (m.injury ? { ...m, injury: { ...m.injury } } : { ...m })),
});
export function changeSince(before: Ledger, after: Ledger, reason: string): Change {
  const supplies: Partial<Supplies> = {};
  for (const key of resources) {
    const delta = after.supplies[key] - before.supplies[key];
    if (delta) supplies[key] = delta;
  }
  const crew = after.crew.flatMap((member): CrewChange[] => {
    const prior = before.crew.find((m) => m.id === member.id);
    if (!prior) return [{ id: member.id, health: 0, morale: 0, state: 'joined' }];
    const health = member.health - prior.health,
      morale = member.morale - prior.morale;
    const injuryChanged =
      member.health > 0 &&
      (prior.injury?.kind !== member.injury?.kind || prior.injury?.days !== member.injury?.days);
    const injury = injuryChanged
      ? member.injury
        ? { ...member.injury }
        : { kind: prior.injury!.kind, days: 0 }
      : undefined;
    return health || morale || injury
      ? [
          {
            id: member.id,
            health,
            morale,
            state: prior.health && !member.health ? 'fallen' : '',
            ...(injury ? { injury } : {}),
          },
        ]
      : [];
  });
  return { reason, supplies, wagon: after.wagon - before.wagon, crew };
}
export const openingStory =
  'Before first light, four travelers bring their bundles to the wagon. Each leaves something behind. You take the eastern road while the ashes of the last fire are still warm.';
const roads = [
  [
    'Mist hangs under the pines. A wheel catches on a root, and the crew leans into the spokes until the wagon comes free.',
    'A deer path gives way to old paving stones. At midday, the caravan stops beside a fallen milestone to pass around bread and a water skin.',
    'The trees close behind the wagon. By dusk, the crew can no longer see the tracks they left that morning.',
    'Under a roof of branches, the wagon passes an abandoned woodpile. Smoke from an unseen hearth is the only sign anyone still lives here.',
  ],
  [
    'Frost whitens the wheel rims. The caravan moves single file where the road narrows, and nobody speaks until the far side.',
    'A ribbon of snow crosses the track. The crew walks beside the wagon to keep it from sliding toward the ravine.',
    'The sun reaches the road late. The travelers share a cold meal in the lee of a stone wall before starting up again.',
    'Wind carries the sound of a bell down the slope. No one can see its tower, but it keeps the caravan pointed east.',
  ],
  [
    'The flats give back the morning heat. By noon, the water skins are warm, and every sip feels measured.',
    'Ash covers the ruts so completely that the crew follows the shadows of broken fence posts to stay on the road.',
    'The wagon rattles past a burned orchard. Under one blackened tree, someone has left a cup turned upside down.',
    'At sundown, the road turns the color of rust. The crew tightens the wagon straps and looks for lanterns on the horizon.',
  ],
];
const weatherScenes: Record<string, string> = {
  'Forest rain':
    'Rain drums on the wagon cover. The wheel ruts fill with brown water, and the crew has to shove the wagon out of the mud.',
  'Mountain squall':
    'A squall drives snow sideways across the trail. The travelers stop to count one another before crossing the next exposed stretch.',
  'Heat haze':
    'Heat turns the horizon to glass. The crew trades places in the wagon’s thin shadow and keeps the water skins close.',
};
const salt = (value: string) =>
  [...value].reduce((sum, c) => Math.imul(sum ^ c.codePointAt(0)!, 16777619) >>> 0, 2166136261);
export function travelStory(
  seed: string,
  p: Place,
  day: number,
  offset: number,
  weather: string,
  bypass: boolean,
) {
  if (offset === 0 && bypass)
    return 'The ridge offers no place to turn the wagon around. Below, you can see the longer road curl past a stop you will never reach.';
  if (offset === 0 && Object.hasOwn(weatherScenes, weather)) return weatherScenes[weather];
  const list = roads[p.region];
  return list[(salt(seed + '/' + p.id) + day + offset) % list.length];
}
export function companionMoment(g: Game, place: Place, day: number) {
  const voices = {
    mara: 'Mara studies the horizon a little longer than the others. When you ask what she sees, she folds the map and says the road is clear.',
    bram: 'Bram checks the wheel pins the way he once inspected his regiment. He counts under his breath until every pin is accounted for.',
    iona: 'Iona cups a seed in her hand. She says the soil beyond the city wall might still be good enough to plant it.',
    tomas:
      'Tomas starts a letter to his daughter on the back of the ration tally. When the wagon lurches, he puts it away unfinished.',
    nessa:
      'Nessa ties a strip of green cloth to a branch where the trail divides. Someone coming after you will know which way you went.',
    edrin:
      'Edrin holds a bent nail up to the light. He says his first workshop made better nails, though nobody there ever had to repair a wheel in a ditch.',
  };
  if (g.letter === 'sealed' || g.letter === 'draft') {
    voices.tomas =
      'Tomas takes Lina’s letter from his coat to smooth a crease. When the road gets rough again, he holds the page flat with one hand.';
  }
  const living = g.crew.filter((m) => m.health >= 40);
  if (!living.length) return '';
  return voices[living[salt(g.seed + '/crew/' + place.id + '/' + day) % living.length].id];
}
export const cityStory =
  'At the eastern gate, a keeper lifts a lantern and asks how many are left. You count them aloud. Only when the gate shuts behind the wagon do you stop listening for the road.';
export const restStory =
  'The wagon stays where it is. The crew eats beside a low fire, checks sore feet, and lets the light go before anyone brings up the road again.';
export const forageStories = [
  'Two travelers follow the edge of the trees with empty sacks and a water skin. They come back before dark with what they could gather.',
  'The crew searches the sheltered side of the slope. Under the snow, they find enough food to make the walk worthwhile.',
  'The search runs from one patch of shade to the next. The travelers return with what little food they found and a few useful scraps.',
];
export const rationStory =
  'At the ration stop, the crew divides what is left. By the end of the leg, the missed food or water has taken its toll.';
const kinds: PageKind[] = ['opening', 'travel', 'camp', 'market', 'encounter'];
export function validChronicle(
  value: unknown,
  maxDay: number,
  travelers: readonly string[],
): value is DayPage[] {
  if (!Array.isArray(value) || value.length > 1000) return false;
  const integer = (n: unknown, min: number, max: number) =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  const text = (s: unknown) => typeof s === 'string' && s.length <= 1000;
  return value.every(
    (p, i) =>
      p &&
      integer(p.day, value[i - 1]?.day ?? 1, maxDay) &&
      text(p.place) &&
      text(p.story) &&
      integer(p.region, 0, 2) &&
      kinds.includes(p.kind) &&
      (p.leg === undefined || integer(p.leg, 1, 12)) &&
      (p.scene === undefined || text(p.scene)) &&
      Array.isArray(p.changes) &&
      p.changes.length <= 32 &&
      p.changes.every(
        (c: Change) =>
          c &&
          text(c.reason) &&
          c.supplies &&
          typeof c.supplies === 'object' &&
          !Array.isArray(c.supplies) &&
          Object.entries(c.supplies).every(
            ([key, n]) => resources.some((r) => r === key) && integer(n, -10000, 10000),
          ) &&
          integer(c.wagon, -100, 100) &&
          Array.isArray(c.crew) &&
          c.crew.length <= travelers.length &&
          c.crew.every(
            (m) =>
              m &&
              travelers.includes(m.id) &&
              integer(m.health, -100, 100) &&
              integer(m.morale, -100, 100) &&
              ['', 'fallen', 'joined'].includes(m.state) &&
              validInjury(m.injury, true),
          ) &&
          (!c.shortage || (integer(c.shortage.food, 0, 100) && integer(c.shortage.water, 0, 100))),
      ),
  );
}
export function pagesForLeg(g: Pick<Game, 'chronicle' | 'path'>) {
  const leg = g.path.length - 1;
  return g.chronicle.flatMap((page, index) =>
    page.kind === 'travel' && page.leg === leg ? [index] : [],
  );
}
