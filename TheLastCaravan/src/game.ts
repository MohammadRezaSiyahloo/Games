import { crew, encounters, offers, places, resources } from './content.ts';
import type { Choice, Place, Supplies } from './content.ts';
import {
  extraEncounters,
  forks,
  outfits,
  recruits,
  roles,
  upgrades,
  upgradeSlots,
  variants,
} from './expansion.ts';
import type { Outfit, Role, Upgrade } from './expansion.ts';
import {
  bondLevel,
  bondSupport,
  detours,
  journeyModes,
  maxBond,
  orderedPair,
  ridgeBypass,
  validBonds,
  watchCost,
  watchStory,
} from './frontier.ts';
import type { Bond, JourneyMode } from './frontier.ts';
import {
  capture,
  changeSince,
  cityStory,
  companionMoment,
  forageStories,
  openingStory,
  rationStory,
  restStory,
  travelStory,
  validChronicle,
} from './chronicle.ts';
import type { DayPage, PageKind } from './chronicle.ts';
import {
  custodySuffix,
  letterBearer,
  letterChoices,
  letterEnding,
  letterIntro,
  letterPending,
  letterRoadBeat,
  letterStages,
  letterTitle,
  tomasIndex,
  tomasLives,
  withBearer,
} from './letter.ts';
import type { LetterDecision, LetterStage } from './letter.ts';
import {
  alternateOpenings,
  favorAtStop,
  favorForOpening,
  favors,
  favorKeys,
  lateStops,
  openingIds,
} from './far-road.ts';
import type { Favor, Opening } from './far-road.ts';
import { injuries, plannedInjury, validInjury } from './injuries.ts';
import type { Injury } from './injuries.ts';
import { campStories, newEncounters } from './new-scenes.ts';
import type { CampChoice } from './new-scenes.ts';

export const travelers = [...crew, ...recruits] as const;
export type Traveler = (typeof travelers)[number]['id'];
const roadEncounters = [...encounters, ...extraEncounters];
export const allEncounters = [...roadEncounters, ...alternateOpenings, ...newEncounters];
const allPlaces = [
  ...places,
  ...variants,
  ...forks,
  ...detours,
  ...lateStops,
  ...Object.values(favors).map((favor) => favor.stop),
];
export const maxCrew = 5;

export type Member = { id: Traveler; role: Role; health: number; morale: number; injury?: Injury };
export type World = {
  nodes: (Place & { x: number; y: number; lane: number })[];
  edges: [string, string][];
};
export type Entry = { day: number; text: string };
export type Game = {
  version: 8;
  expandedEncounters: boolean;
  opening: Opening | null;
  favor: Favor | null;
  letter: LetterStage;
  chronicle: DayPage[];
  mode: JourneyMode;
  bonds: Bond[];
  id: string;
  seed: string;
  classic: boolean;
  outfit: Outfit;
  upgrades: Upgrade[];
  ration: 'normal' | 'lean';
  rng: number;
  current: string;
  path: string[];
  day: number;
  supplies: Supplies;
  wagon: number;
  crew: Member[];
  pending: string | null;
  seen: string[];
  log: Entry[];
  actions: string[];
  status: 'travel' | 'won' | 'lost';
  reason: string;
};
export const capacity = 40;
const bound = (n: number) => Math.min(100, Math.max(0, n));
const start: Supplies = { food: 11, water: 13, medicine: 2, coins: 10, materials: 4 };
export const cargo = (supplies: Supplies) =>
  supplies.food + supplies.water + supplies.medicine + supplies.materials;
export const alive = (g: Game) => g.crew.filter((m) => m.health > 0).length;
const healthyEnough = (m: Member | undefined) => Boolean(m && m.health >= 40 && m.morale >= 35);
export const fit = (g: Game, i: number) => healthyEnough(g.crew[i]) && !g.crew[i]?.injury;
const injuryBlocks = (g: Game, role: Role) =>
  g.crew.some((m) => m.role === role && m.injury && healthyEnough(m));
export const roleFit = (g: Game, role: Role) => g.crew.some((m, i) => m.role === role && fit(g, i));
const has = (g: Game, upgrade: Upgrade) => g.upgrades.includes(upgrade);
const fitTraveler = (g: Game, id: Traveler) =>
  fit(
    g,
    g.crew.findIndex((m) => m.id === id),
  );
export const capacityFor = (g: Game) =>
  capacity + (g.mode === 'far' ? 6 : 0) + (has(g, 'rack') ? 10 : 0);
export const traveler = (id: Traveler) => travelers.find((entry) => entry.id === id)!;
export const memberName = (g: Game, i: number) => traveler(g.crew[i].id).name;
export const heavyAt = (g: Game) => (g.mode === 'far' ? 38 : 32) + (has(g, 'rack') ? 8 : 0);
export const morale = (g: Game) =>
  Math.round(g.crew.reduce((sum, m) => sum + (m.health ? m.morale : 0), 0) / Math.max(alive(g), 1));
const hash = (seed: string) =>
  [...seed].reduce((n, c) => Math.imul(n ^ c.codePointAt(0)!, 16777619), 2166136261) >>> 0;
function step(value: number) {
  const state = (value + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state ^ (state >>> 15), state | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
export function world(
  seed: string,
  classic = false,
  mode: JourneyMode = 'standard',
  favor: Favor | null = null,
): World {
  let state = hash(seed);
  const random = () => {
    const next = step(state);
    state = next.state;
    return next.value;
  };
  const atlas =
    classic || seed === 'Hearth-01'
      ? places
      : places.map((place) => {
          const variant = variants.find((entry) => entry.replaces === place.id);
          return variant && hash(seed + '/' + place.id) % 3 !== 0 ? variant : place;
        });
  const stages = Array.from({ length: 6 }, (_, stage) => atlas.filter((p) => p.stage === stage));
  for (const stage of stages.slice(1, 5)) if (random() < 0.5) stage.reverse();
  const x = [9, 24, 42, 59, 76, 92];
  const nodes = stages.flatMap((stage, s) =>
    stage.map((p, lane) => ({
      ...p,
      x: x[s],
      y: stage.length === 1 ? 57 : (lane === 0 ? 36 : 74) + Math.round((random() - 0.5) * 11),
      lane,
    })),
  );
  const edges: World['edges'] = [];
  for (let s = 0; s < 5; s++) {
    const a = stages[s],
      b = stages[s + 1];
    if (a.length === 1 || b.length === 1) {
      for (const origin of a) for (const end of b) edges.push([origin.id, end.id]);
      continue;
    }
    for (let i = 0; i < 2; i++) edges.push([a[i].id, b[i].id]);
    const cross = random() < 0.5 ? 0 : 1;
    edges.push([a[cross].id, b[1 - cross].id]);
  }
  if (!classic) {
    for (const node of nodes) {
      if (node.stage > 0 && node.stage < 5 && node.lane === 0) node.y -= 7;
    }
    for (const fork of forks) {
      nodes.push({ ...fork, x: x[fork.stage], y: 52 + Math.round((random() - 0.5) * 7), lane: 2 });
    }
    edges.push(['hearth', forks[0].id], [forks[3].id, 'city']);
    for (let i = 0; i < 3; i++) {
      const a = forks[i],
        b = forks[i + 1];
      const lane = random() < 0.5 ? 0 : 1;
      edges.push([a.id, b.id], [a.id, stages[i + 2][lane].id], [stages[i + 1][1 - lane].id, b.id]);
    }
  }
  if (!classic && mode !== 'standard') {
    const destination = (id: string) =>
      nodes.find((p) => p.id === id || variants.some((v) => v.id === p.id && v.replaces === id))!
        .id;
    const [grove, refuge, spring] = detours;
    nodes.push(...detours.map((stop, i) => ({ ...stop, x: [33, 51, 68][i], y: 89, lane: 3 })));
    edges.push(
      [destination('hollow'), grove.id],
      ['ridge', grove.id],
      [grove.id, 'pass'],
      [grove.id, 'shelter'],
    );
    edges.push(
      ['shelter', refuge.id],
      [destination('mill'), refuge.id],
      [refuge.id, 'rest'],
      [refuge.id, 'quarry'],
    );
    edges.push(
      ['rest', spring.id],
      ['quarry', spring.id],
      [spring.id, 'well'],
      [spring.id, 'station'],
    );
    edges.push([...ridgeBypass]);
  }
  if (!classic && mode === 'far') {
    const eastX = [7, 18, 31, 44, 57, 68, 80, 94];
    for (const node of nodes) {
      if (node.id === 'city') node.stage = 7;
      node.x = Number.isInteger(node.stage)
        ? eastX[node.stage]
        : (eastX[Math.floor(node.stage)] + eastX[Math.ceil(node.stage)]) / 2;
    }
    const arriving = edges.filter(([, to]) => to === 'city').map(([from]) => from);
    for (let i = edges.length - 1; i >= 0; i--) if (edges[i][1] === 'city') edges.splice(i, 1);
    const lanes = random() < 0.5 ? [32, 72] : [72, 32];
    lateStops.forEach((stop, i) =>
      nodes.push({ ...stop, x: eastX[stop.stage], y: lanes[i % 2], lane: i % 2 }),
    );
    const [cistern, gardens, beacon, crowswall] = lateStops;
    for (const origin of arriving) edges.push([origin, cistern.id], [origin, gardens.id]);
    for (const stop of [cistern, gardens])
      edges.push([stop.id, beacon.id], [stop.id, crowswall.id]);
    edges.push([beacon.id, 'city'], [crowswall.id, 'city']);
    if (favor) {
      const stop = favors[favor].stop;
      nodes.push({ ...stop, x: eastX[6], y: 52, lane: 4 });
      edges.push([cistern.id, stop.id], [gardens.id, stop.id], [stop.id, 'city']);
    }
  }
  return { nodes, edges };
}
export function newGame(
  seed: string,
  outfit: Outfit = 'standard',
  id = seed,
  classic = false,
  mode: JourneyMode = 'standard',
  openingOverride?: Opening,
  expandedEncounters = true,
): Game {
  const supplies = { ...start };
  const bonus: Partial<Supplies> = outfits.find((config) => config.id === outfit)!.bonus;
  for (const key of resources) supplies[key] += bonus[key] ?? 0;
  if (!classic && mode === 'frontier') {
    supplies.food += 2;
    supplies.water += 2;
    supplies.coins += 2;
  }
  if (!classic && mode === 'far') {
    supplies.food += 4;
    supplies.water += 4;
    supplies.coins += 5;
  }
  return {
    version: 8,
    expandedEncounters: !classic && expandedEncounters,
    opening:
      !classic && mode === 'far'
        ? (openingOverride ??
          openingIds[seed === 'Hearth-01' ? 0 : hash(seed + '/opening') % openingIds.length])
        : null,
    favor: null,
    letter: 'started',
    chronicle: [
      {
        day: 1,
        place: 'Hearth Camp',
        region: 0,
        kind: 'opening',
        story: openingStory,
        changes: [{ reason: letterIntro, supplies: {}, wagon: 0, crew: [] }],
      },
    ],
    mode: classic ? 'standard' : mode,
    bonds: [],
    id,
    seed,
    outfit,
    classic,
    upgrades: [],
    ration: 'normal',
    rng: hash(seed + '/road'),
    current: 'hearth',
    path: ['hearth'],
    day: 1,
    supplies,
    wagon: 100,
    crew: crew.map((c, i) => ({
      id: c.id,
      role: c.role,
      health: 100,
      morale: [82, 75, 88, 80][i],
    })),
    pending: null,
    seen: [],
    actions: [],
    status: 'travel',
    reason: '',
    log: [{ day: 1, text: 'The caravan gathers at Hearth Camp.' }],
  };
}
export const gameWorld = (g: Game) =>
  world(
    g.seed,
    g.classic,
    g.mode,
    lateStops.some((stop) => stop.stage === 5 && g.path.includes(stop.id)) ? g.favor : null,
  );
export const here = (g: Game) => allPlaces.find((p) => p.id === g.current)!;
export function routes(g: Game, origin = g.current): Place[] {
  const map = gameWorld(g);
  return map.edges
    .filter(([from]) => from === origin)
    .map(([, to]) => map.nodes.find((p) => p.id === to)!);
}
function roadCondition(g: Game, p: Place) {
  const steady = { label: '', water: 0, wear: 0 };
  if (g.classic || g.seed === 'Hearth-01' || p.kind === 'city' || favorAtStop(p.id) !== undefined)
    return steady;
  const roll = hash(g.seed + '/' + g.current + '/' + p.id) % 4;
  if (roll === 0)
    return { label: ['Muddy track', 'Glazed ice', 'Loose scree'][p.region], water: 0, wear: 4 };
  if (roll === 1 && p.region === 2) return { label: 'Dry wind', water: 1, wear: 0 };
  if (roll === 2) return { label: 'Maintained road', water: 0, wear: -3 };
  return steady;
}
export const isBypass = (g: Game, id: string, origin = g.current) =>
  g.mode !== 'standard' && !g.classic && origin === ridgeBypass[0] && id === ridgeBypass[1];
export function roadDaysToCity(g: Game, origin = g.current) {
  const map = gameWorld(g);
  const totals = new Map<string, { min: number; max: number }>([['city', { min: 0, max: 0 }]]);
  for (const node of [...map.nodes].sort((a, b) => b.stage - a.stage)) {
    if (node.kind === 'city') continue;
    const onward = map.edges
      .filter(([from]) => from === node.id)
      .map(([, to]) => {
        const stop = map.nodes.find((p) => p.id === to)!;
        const remaining = totals.get(to)!;
        const days = stop.days + Number(isBypass(g, to, node.id));
        return { min: days + remaining.min, max: days + remaining.max };
      });
    totals.set(node.id, {
      min: Math.min(...onward.map((route) => route.min)),
      max: Math.max(...onward.map((route) => route.max)),
    });
  }
  return totals.get(origin)!;
}
export function weather(g: Game, region: number) {
  const clear = { label: '', water: 0, wear: 0, morale: 0 };
  if (g.mode === 'standard') return clear;
  const roll = hash(g.seed + '/weather/' + region + '/' + Math.floor((g.day - 1) / 2)) % 4;
  if (roll < 2) return { ...clear, label: 'Clear weather' };
  if (region === 0) return { label: 'Forest rain', water: 0, wear: roll === 3 ? 4 : 2, morale: 0 };
  if (region === 1)
    return {
      label: 'Mountain squall',
      water: 0,
      wear: roll === 3 ? 4 : 2,
      morale: roll === 3 ? 4 : 2,
    };
  return { label: 'Heat haze', water: roll === 3 ? 1 : 0, wear: 0, morale: roll === 3 ? 3 : 1 };
}
export function quote(g: Game, p: Place) {
  const members = alive(g);
  const heavy = Number(cargo(g.supplies) > heavyAt(g));
  const lean = Number(g.ration === 'lean');
  const condition = roadCondition(g, p);
  const sheltered = favorAtStop(p.id) !== undefined;
  const forecast = sheltered
    ? { label: 'Sheltered from the wind', water: 0, wear: 0, morale: 0 }
    : weather(g, p.region);
  const bypass = isBypass(g, p.id);
  const days = bypass ? p.days + 1 : p.days;
  const foodBase =
    members - Number(roleFit(g, 'Quartermaster')) - Number(has(g, 'stove')) - lean + heavy;
  const marker = g.actions.includes('marked-road') ? 3 : 0;
  const wearBase =
    p.wear +
    condition.wear +
    forecast.wear +
    (bypass ? 8 : 0) -
    Number(roleFit(g, 'Scout')) * 2 -
    Number(has(g, 'wheels')) * 4;
  return {
    days,
    bypass,
    markedRoad: Math.max(0, wearBase) - Math.max(0, wearBase - marker),
    food: days * Math.max(1, foodBase),
    injuryFood: injuryBlocks(g, 'Quartermaster')
      ? days * (Math.max(1, foodBase) - Math.max(1, foodBase - 1))
      : 0,
    injuryWear: injuryBlocks(g, 'Scout')
      ? Math.max(0, wearBase - marker) - Math.max(0, wearBase - marker - 2)
      : 0,
    water:
      days *
      (Math.max(1, members) +
        Number(p.region === 2 && !sheltered) +
        condition.water +
        forecast.water),
    wagon: Math.max(0, wearBase - marker) + (g.wagon < 30 ? 5 : 0) + heavy * 2,
    condition: condition.label,
    weather: forecast.label,
    weatherWater: forecast.water * days,
    weatherWear: forecast.wear,
    weatherMorale: Math.max(0, forecast.morale - (has(g, 'cover') ? 2 : 0)),
    rationHealth: 2 * lean * days,
    rationMorale: 5 * lean * days,
  };
}
export function shortfall(g: Game, p: Place) {
  const cost = quote(g, p);
  const food = Math.max(0, cost.food - g.supplies.food);
  const water = Math.max(0, cost.water - g.supplies.water);
  return { food, water, health: 7 * food + 10 * water, morale: Math.min(36, 4 * (food + water)) };
}
export function canAfford(g: Game, change: Partial<Supplies> = {}) {
  return resources.every((key) => g.supplies[key] + (change[key] ?? 0) >= 0);
}
export function canTrade(g: Game, change: Partial<Supplies>) {
  const projected = { ...g.supplies };
  for (const key of resources) projected[key] += change[key] ?? 0;
  return canAfford(g, change) && cargo(projected) <= capacityFor(g);
}
function append(g: Game, text: string) {
  g.log.unshift({ day: g.day, text });
}
function actionPage(
  g: Game,
  next: Game,
  kind: PageKind,
  reason: string,
  story = next.log[0].text,
  scene?: string,
) {
  const place = here(next);
  next.chronicle.push({
    day: next.day,
    place: place.name,
    region: place.region,
    kind,
    story,
    changes: [changeSince(g, next, reason)],
    ...(scene ? { scene } : {}),
  });
}
function updateSupplies(g: Game, change: Partial<Supplies>) {
  for (const key of resources) g.supplies[key] += Math.min(0, change[key] ?? 0);
  let left = capacityFor(g) - cargo(g.supplies);
  for (const key of resources) {
    const amount = Math.max(0, change[key] ?? 0);
    const loaded = key === 'coins' ? amount : Math.min(left, amount);
    g.supplies[key] += loaded;
    if (key !== 'coins') left -= loaded;
    if (loaded < amount) append(g, `Cargo was full. Left ${amount - loaded} ${key} behind.`);
  }
}
function affect(g: Game, health: number, spirit: number, target?: number, support = false) {
  const supportByMember = support ? g.crew.map((_, i) => bondSupport(g, i)) : [];
  const fallen: Traveler[] = [];
  g.crew.forEach((m, i) => {
    if (!m.health || (target !== undefined && i !== target)) return;
    m.health = bound(m.health + health);
    const change = spirit < 0 && support ? Math.min(0, spirit + supportByMember[i]) : spirit;
    m.morale = m.health ? bound(m.morale + change) : 0;
    if (!m.health) {
      delete m.injury;
      fallen.push(m.id);
      append(g, `${memberName(g, i)} died on the journey.`);
    }
  });
  if (fallen.includes('tomas') && (g.letter === 'sealed' || g.letter === 'draft')) {
    const bearer = letterBearer(g);
    if (bearer >= 0) append(g, `${memberName(g, bearer)} ${custodySuffix}`);
  }
  if (!fallen.length || !g.bonds.length) return;
  g.crew.forEach((m, i) => {
    if (!m.health) return;
    const grief = fallen.reduce((loss, id) => loss + bondLevel(g, m.id, id) * 3, 0);
    if (!grief) return;
    m.morale = bound(m.morale - grief);
    append(g, `${memberName(g, i)} lost ${grief} morale in grief.`);
  });
}
function recoverInjuries(g: Game, days: number) {
  g.crew.forEach((m, i) => {
    if (!m.health || !m.injury) return;
    const remaining = m.injury.days - days;
    if (remaining > 0) m.injury = { kind: m.injury.kind, days: remaining };
    else {
      delete m.injury;
      append(g, `${memberName(g, i)} recovered from their injury.`);
    }
  });
}
function conclude(g: Game) {
  if (!alive(g) || !g.wagon) {
    g.status = 'lost';
    g.reason = !alive(g)
      ? 'The road claimed your last traveler.'
      : 'The wagon could go no farther.';
  } else if (g.current === 'city') {
    g.status = 'won';
    g.reason = 'The gates opened. Your people are home.';
  } else return;
  g.pending = null;
  append(g, g.reason);
}
const ready = (g: Game) => g.status === 'travel' && !g.pending && !letterPending(g);
function recordEnding(g: Game, page: DayPage) {
  const ending = letterEnding(g);
  if (!ending) return;
  const text = withBearer(ending, (index) => memberName(g, index));
  append(g, text);
  page.changes.push(changeSince(g, g, text));
}
export function travel(g: Game, id: string): Game {
  const p = routes(g).find((node) => node.id === id);
  if (!p || !ready(g)) return g;
  const next = structuredClone(g);
  const price = quote(next, p);
  const missing = shortfall(next, p);
  const foodPerDay = price.food / price.days,
    waterPerDay = price.water / price.days;
  const pages: DayPage[] = [];
  for (let i = 0; i < price.days; i++) {
    const before = capture(next);
    const food = Math.max(0, foodPerDay - next.supplies.food),
      water = Math.max(0, waterPerDay - next.supplies.water);
    next.supplies.food = Math.max(0, next.supplies.food - foodPerDay);
    next.supplies.water = Math.max(0, next.supplies.water - waterPerDay);
    const wear =
      Math.floor((price.wagon * (i + 1)) / price.days) - Math.floor((price.wagon * i) / price.days);
    next.wagon = bound(next.wagon - wear);
    next.day++;
    const change = changeSince(before, next, 'Rations and wear on the road');
    if (food || water) change.shortage = { food, water };
    pages.push({
      day: next.day,
      place: p.name,
      region: p.region,
      kind: 'travel',
      leg: g.path.length,
      story: travelStory(g.seed, p, next.day, i, price.weather, price.bypass),
      changes: [change],
    });
  }
  const moment = companionMoment(g, p, next.day);
  if (moment && p.kind !== 'city') pages[0].changes.push(changeSince(next, next, moment));
  if (p.stage >= 3 && p.kind !== 'city') {
    const beat = letterRoadBeat(g);
    if (beat) pages[0].changes.push(changeSince(next, next, beat));
  }
  if (price.injuryFood)
    pages[0].changes.push(
      changeSince(next, next, 'With the quartermaster injured, the crew used more food.'),
    );
  if (price.injuryWear)
    pages[0].changes.push(
      changeSince(next, next, 'With the scout injured, the wagon took more wear.'),
    );
  if (price.markedRoad)
    pages[0].changes.push(
      changeSince(next, next, 'Mara’s marker guided the wagon past the worst turn.'),
    );
  if (price.condition) pages[0].changes.push(changeSince(next, next, price.condition));
  next.chronicle.push(...pages);
  const last = pages.at(-1)!;
  next.path.push(id);
  next.current = id;
  next.actions = [];
  next.ration = 'normal';
  append(
    next,
    `Reached ${p.name}. Used ${price.food - missing.food} food and ${price.water - missing.water} water. Wagon wear ${g.wagon - next.wagon}.`,
  );
  const note = (reason: string, change: () => void) => {
    const before = capture(next),
      logLength = next.log.length;
    change();
    last.changes.push(changeSince(before, next, reason));
    for (const entry of next.log.slice(0, next.log.length - logLength).reverse()) {
      if (entry.text.endsWith('morale in grief.') || entry.text.endsWith(custodySuffix))
        last.changes.push(changeSince(next, next, entry.text));
    }
  };
  if (missing.health) {
    append(
      next,
      `Short by ${missing.food} food and ${missing.water} water. The crew lost ${missing.health} health each.`,
    );
    note(rationStory, () => affect(next, -missing.health, -missing.morale, undefined, true));
  }
  if (price.rationMorale) {
    append(
      next,
      `Lean rations cost each traveler ${price.rationHealth} health and ${price.rationMorale} morale.`,
    );
    note('The crew stretches the food by eating less.', () =>
      affect(next, -price.rationHealth, -price.rationMorale, undefined, true),
    );
  }
  if (price.weatherMorale) {
    append(next, `${price.weather} cost the crew up to ${price.weatherMorale} morale.`);
    note(price.weather, () => affect(next, 0, -price.weatherMorale, undefined, true));
  }
  if (next.crew.some((m) => m.injury))
    note('Recovery on the road', () => recoverInjuries(next, price.days));
  conclude(next);
  if (next.status !== 'travel') {
    if (next.status === 'won') last.changes.push(changeSince(next, next, cityStory));
    last.changes.push(changeSince(next, next, next.reason));
    recordEnding(next, last);
    return next;
  }
  if (p.find) {
    const found =
      'Found ' +
      Object.entries(p.find)
        .map(([key, qty]) => `${qty} ${key}`)
        .join(' and ') +
      ' on arrival.';
    append(next, found);
    const before = capture(next);
    const logLength = next.log.length;
    updateSupplies(next, p.find);
    last.changes.push(changeSince(before, next, p.description));
    for (const entry of next.log.slice(0, next.log.length - logLength).reverse()) {
      last.changes.push(changeSince(next, next, entry.text));
    }
  }
  if (next.mode === 'far' && next.favor && p.stage === 5) {
    const memory = favors[next.favor].returnText;
    append(next, memory);
    last.changes.push(changeSince(next, next, memory));
  }
  if (next.letter === 'started' && p.stage >= 2) next.letter = 'choice';
  const pool = next.classic
    ? encounters
    : next.expandedEncounters
      ? [...roadEncounters, ...newEncounters]
      : roadEncounters;
  const available = pool.filter(
    (e) => (e.region === undefined || e.region === p.region) && !next.seen.includes(e.id),
  );
  if (!available.length) return next;
  const roll = step(next.rng);
  next.rng = roll.state;
  next.pending =
    next.opening && p.stage === 1
      ? next.opening
      : available[Math.floor(roll.value * available.length)].id;
  next.seen.push(next.pending);
  return next;
}
export function option(g: Game, choice: Choice): Choice {
  if (choice.target !== undefined && g.crew[choice.target].health === 0) {
    const substitute = g.crew.findIndex((m) => m.health > 0);
    if (substitute === -1) return { ...choice, target: undefined };
    const name = memberName(g, substitute).split(' ')[0];
    const former = memberName(g, choice.target).split(' ')[0];
    return {
      ...choice,
      label: choice.label.replace(former, name),
      result: `${memberName(g, substitute)} takes the fallen traveler’s place.`,
      target: substitute,
    };
  }
  return choice;
}
export const pendingEvent = (g: Game) => allEncounters.find((e) => e.id === g.pending);
export function encounterEffect(g: Game, base: Choice): Choice {
  const choice = option(g, base);
  const harm = choice.health ?? 0;
  const wear = choice.wagon ?? 0;
  return {
    ...choice,
    health:
      harm < 0
        ? Math.min(0, harm + (roleFit(g, 'Guard') ? 4 : 0) + (has(g, 'cover') ? 3 : 0))
        : harm,
    wagon: wear < 0 ? Math.min(0, wear + (has(g, 'cover') ? 5 : 0)) : wear,
  };
}
export function resolve(g: Game, index: number): Game {
  const encounter = pendingEvent(g);
  const base = encounter?.choices[index];
  if (g.status !== 'travel' || !base) return g;
  const choice = encounterEffect(g, base);
  if (!canAfford(g, choice.supplies)) return g;
  const next = structuredClone(g);
  next.pending = null;
  append(next, choice.result);
  updateSupplies(next, choice.supplies ?? {});
  next.wagon = bound(next.wagon + (choice.wagon ?? 0));
  const setback = plannedInjury(g, choice.injury, choice.target);
  affect(next, choice.health ?? 0, choice.morale ?? 0, choice.target);
  if (setback && next.crew[setback.index].health) {
    next.crew[setback.index].injury = setback.injury;
    append(
      next,
      `${memberName(next, setback.index)} suffered an injury: ${injuries[setback.injury.kind].name}.`,
    );
  }
  conclude(next);
  actionPage(g, next, 'encounter', encounter!.title, choice.result, encounter!.id);
  const page = next.chronicle.at(-1)!;
  for (const entry of next.log.slice(0, next.log.length - g.log.length).reverse()) {
    if (entry.text !== choice.result) page.changes.push(changeSince(next, next, entry.text));
  }
  const favor =
    g.opening && encounter?.id === g.opening && index === 0
      ? favorForOpening(g.opening)
      : undefined;
  if (favor) {
    next.favor = favor;
    const promise = favors[favor].promise;
    append(next, promise);
    page.changes.push(changeSince(next, next, promise));
  }
  if (next.status !== 'travel') recordEnding(next, page);
  return next;
}
export function decideLetter(g: Game, decision: LetterDecision): Game {
  if (!letterPending(g) || (decision !== 'finish' && decision !== 'keep')) return g;
  const choice = letterChoices(g)[decision];
  if (g.supplies.food < choice.food) return g;
  const next = structuredClone(g);
  next.letter = decision === 'finish' ? 'sealed' : 'draft';
  next.supplies.food -= choice.food;
  if (choice.morale) affect(next, 0, choice.morale, tomasLives(g) ? tomasIndex(g) : undefined);
  append(next, choice.text);
  actionPage(g, next, 'encounter', letterTitle, choice.text, 'lina-letter');
  return next;
}

export function trade(g: Game, id: string): Game {
  const offer = offers.find((entry) => entry.id === id);
  if (!ready(g) || here(g).kind !== 'market' || !offer || !canTrade(g, offer.cost)) return g;
  const next = structuredClone(g);
  updateSupplies(next, offer.cost);
  append(next, `${offer.label} at ${here(g).name}.`);
  actionPage(g, next, 'market', offer.label);
  return next;
}
export const repairGain = (g: Game) =>
  25 + (has(g, 'braces') ? 10 : 0) + (fitTraveler(g, 'edrin') ? 5 : 0);
export function repair(g: Game): Game {
  if (!ready(g) || g.wagon === 100 || g.supplies.materials < 2) return g;
  const next = structuredClone(g);
  next.supplies.materials -= 2;
  const gain = Math.min(repairGain(g), 100 - next.wagon);
  next.wagon += gain;
  append(next, `Spent 2 materials to restore ${gain} wagon condition.`);
  actionPage(g, next, 'camp', 'Repair the wagon');
  return next;
}
export function treat(g: Game, i: number): Game {
  const member = g.crew[i];
  if (
    !ready(g) ||
    !member?.health ||
    (member.health === 100 && !member.injury) ||
    !g.supplies.medicine
  )
    return g;
  const next = structuredClone(g);
  next.supplies.medicine--;
  const gain = Math.min(roleFit(g, 'Medic') ? 30 : 18, 100 - member.health);
  affect(next, gain, 4, i);
  if (next.crew[i].injury) {
    delete next.crew[i].injury;
    append(next, `${memberName(g, i)} recovered from their injury.`);
  }
  append(next, `${memberName(g, i)} received medicine and recovered ${gain} health.`);
  actionPage(g, next, 'camp', 'Treatment at camp');
  return next;
}
export function rest(g: Game): Game {
  const count = alive(g);
  if (
    !ready(g) ||
    g.actions.includes('rest') ||
    g.supplies.food < count ||
    g.supplies.water < count
  )
    return g;
  const next = structuredClone(g);
  next.actions.push('rest');
  next.day++;
  next.supplies.food -= count;
  next.supplies.water -= count;
  affect(next, 10, 9);
  recoverInjuries(next, 2);
  append(next, `Rested for a day. Used ${count} food and ${count} water.`);
  actionPage(g, next, 'camp', 'Rest for a day', restStory);
  return next;
}

export function assign(g: Game, index: number, role: Role): Game {
  const member = g.crew[index];
  if (!ready(g) || !member?.health || !roles.includes(role) || member.role === role) return g;
  const next = structuredClone(g);
  const other = next.crew.findIndex((m) => m.health && m.role === role);
  if (role !== 'Reserve' && other !== -1) next.crew[other].role = member.role;
  next.crew[index].role = role;
  append(next, `${memberName(g, index)} now serves as ${role.toLowerCase()}.`);
  return next;
}
export const recruitOffer = (g: Game) =>
  here(g).kind === 'market'
    ? recruits.find(
        (person) => person.market === here(g).stage && !g.crew.some((m) => m.id === person.id),
      )
    : undefined;
export function recruit(g: Game): Game {
  const offer = recruitOffer(g);
  if (!ready(g) || !offer || alive(g) >= maxCrew || g.supplies.coins < offer.price) return g;
  const next = structuredClone(g);
  const role = next.crew.some((m) => m.health && m.role === offer.role) ? 'Reserve' : offer.role;
  next.supplies.coins -= offer.price;
  next.crew.push({ id: offer.id, role, health: 95, morale: 76 });
  append(next, `${offer.name} joined the caravan as ${role.toLowerCase()}.`);
  actionPage(g, next, 'market', 'A new traveler joins');
  return next;
}
export function install(g: Game, id: Upgrade): Game {
  const upgrade = upgrades.find((u) => u.id === id);
  if (
    !ready(g) ||
    !upgrade ||
    has(g, id) ||
    g.upgrades.length >= upgradeSlots ||
    g.supplies.materials < upgrade.materials ||
    g.supplies.coins < upgrade.coins
  )
    return g;
  const next = structuredClone(g);
  next.supplies.materials -= upgrade.materials;
  next.supplies.coins -= upgrade.coins;
  next.upgrades.push(id);
  append(next, `Installed ${upgrade.name.toLowerCase()}.`);
  actionPage(g, next, 'camp', upgrade.name);
  return next;
}
export function setRations(g: Game, ration: Game['ration']): Game {
  return ready(g) && g.ration !== ration ? { ...g, ration } : g;
}
export const cookMorale = (g: Game) => (has(g, 'stove') ? 12 : 8);
export function cook(g: Game): Game {
  if (!ready(g) || g.actions.includes('cook') || g.supplies.food < 2) return g;
  const next = structuredClone(g);
  next.actions.push('cook');
  next.supplies.food -= 2;
  affect(next, 4, cookMorale(g));
  append(next, 'Shared a hot meal. Used 2 food.');
  actionPage(g, next, 'camp', 'Cook a hot meal');
  return next;
}
export function forageYield(g: Game) {
  const region = here(g).region;
  const food = [3, 2, 1][region] + Number(roleFit(g, 'Scout')) + Number(fitTraveler(g, 'nessa'));
  return { food, materials: region === 2 ? 2 : 0 };
}
export function forage(g: Game): Game {
  if (
    !ready(g) ||
    g.actions.includes('forage') ||
    g.supplies.water < 2 ||
    !canTrade(g, { water: -2, ...forageYield(g) })
  )
    return g;
  const next = structuredClone(g);
  next.day++;
  next.actions.push('forage');
  const found = forageYield(g);
  updateSupplies(next, { water: -2, ...found });
  append(
    next,
    `Spent a day foraging and 2 water. Brought back ${found.food} food${found.materials ? ' and 2 materials' : ''}.`,
  );
  actionPage(g, next, 'camp', 'Forage nearby', forageStories[here(next).region]);
  return next;
}

export function shareWatch(g: Game, first: number, second: number): Game {
  const a = g.crew[first],
    b = g.crew[second];
  if (
    !ready(g) ||
    g.actions.includes('watch') ||
    !a?.health ||
    !b?.health ||
    first === second ||
    g.supplies.food < watchCost ||
    bondLevel(g, a.id, b.id) >= maxBond
  )
    return g;
  const next = structuredClone(g);
  next.supplies.food -= watchCost;
  next.actions.push('watch');
  const [left, right] = orderedPair(a.id, b.id);
  const existing = next.bonds.find((bond) => bond.a === left && bond.b === right);
  if (existing) existing.strength++;
  else next.bonds.push({ a: left, b: right, strength: 1 });
  affect(next, 0, 5, first);
  affect(next, 0, 5, second);
  const level = bondLevel(next, left, right);
  append(
    next,
    `${memberName(g, first)} and ${memberName(g, second)} shared a watch. Their bond is now ${level}.`,
  );
  const story = watchStory(left, right, level);
  if (story) append(next, story);
  actionPage(g, next, 'camp', 'Share a watch');
  return next;
}

export function availableCampStories(g: Game) {
  if (!ready(g) || g.actions.includes('conversation')) return [];
  return campStories.filter(
    (story) =>
      g.crew.some((member) => member.id === story.person && member.health) &&
      !g.chronicle.some((page) => page.scene === story.id),
  );
}
export function campStoryChoice(g: Game, id: string, index: number): CampChoice | undefined {
  const story = availableCampStories(g).find((candidate) => candidate.id === id);
  const choice = story?.choices[index] as CampChoice | undefined;
  if (!story || !choice) return undefined;
  return {
    ...choice,
    target:
      choice.scope === 'crew'
        ? undefined
        : g.crew.findIndex((member) => member.id === story.person),
  };
}
export function resolveCampStory(g: Game, id: string, index: number): Game {
  const story = availableCampStories(g).find((candidate) => candidate.id === id);
  const choice = campStoryChoice(g, id, index);
  if (!story || !choice || !canAfford(g, choice.supplies)) return g;
  const next = structuredClone(g);
  next.actions.push('conversation');
  if (choice.markRoad) next.actions.push('marked-road');
  append(next, choice.result);
  updateSupplies(next, choice.supplies ?? {});
  affect(next, choice.health ?? 0, choice.morale ?? 0, choice.target);
  actionPage(g, next, 'camp', story.title, choice.result, story.id);
  return next;
}

export const saveKey = 'last-caravan-expedition-v1';
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
export function readSave(raw: string | null): Game | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version === 1 && Array.isArray(data.crew) && data.crew.length === crew.length) {
      data.version = 2;
      data.id = 'legacy-' + hash(raw).toString(36);
      data.classic = true;
      data.outfit = 'standard';
      data.upgrades = [];
      data.ration = 'normal';
      data.crew = data.crew.map((member: Member, i: number) => ({
        ...member,
        id: crew[i].id,
        role: crew[i].role,
      }));
    }
    if (data?.version === 2) {
      data.version = 3;
      data.mode = 'standard';
      data.bonds = [];
    }
    if (data?.version === 3) {
      data.version = 4;
      data.chronicle = [];
    }
    if (data?.version === 4) {
      data.version = 5;
      data.letter = 'absent';
    }
    if (data?.version === 5) {
      data.version = 6;
      data.familyAid = false;
    }
    if (data?.version === 6) {
      data.version = 7;
      data.opening = data.mode === 'far' ? 'child' : null;
      data.favor = data.familyAid ? 'family' : null;
      delete data.familyAid;
    }
    if (data?.version === 7) {
      data.version = 8;
      data.expandedEncounters = false;
    }
    const g = data as Game;
    if (
      g?.version !== 8 ||
      typeof g.expandedEncounters !== 'boolean' ||
      (g.mode === 'far' ? !g.opening || !openingIds.includes(g.opening) : g.opening !== null) ||
      (g.favor !== null &&
        (!favorKeys.includes(g.favor) ||
          favors[g.favor].opening !== g.opening ||
          !g.seen?.includes(g.opening))) ||
      !letterStages.includes(g.letter) ||
      typeof g.id !== 'string' ||
      !g.id ||
      g.id.length > 80 ||
      typeof g.seed !== 'string' ||
      !g.seed ||
      g.seed.length > 32 ||
      typeof g.classic !== 'boolean' ||
      !journeyModes.some((m) => m.id === g.mode) ||
      (g.classic && g.mode !== 'standard') ||
      !outfits.some((o) => o.id === g.outfit) ||
      !['normal', 'lean'].includes(g.ration) ||
      !Array.isArray(g.upgrades) ||
      g.upgrades.length > upgradeSlots ||
      new Set(g.upgrades).size !== g.upgrades.length ||
      !g.upgrades.every((id) => upgrades.some((u) => u.id === id)) ||
      !finite(g.rng, 0, 0xffffffff) ||
      !finite(g.day, 1, 100) ||
      !finite(g.wagon, 0, 100) ||
      !allPlaces.some((p) => p.id === g.current) ||
      !['travel', 'won', 'lost'].includes(g.status) ||
      typeof g.reason !== 'string' ||
      !Array.isArray(g.path) ||
      g.path[0] !== 'hearth' ||
      g.path.at(-1) !== g.current ||
      !Array.isArray(g.seen) ||
      !Array.isArray(g.actions) ||
      !g.actions.every((action) =>
        ['rest', 'cook', 'forage', 'watch', 'conversation', 'marked-road'].includes(action),
      ) ||
      !Array.isArray(g.crew) ||
      g.crew.length < crew.length ||
      g.crew.length > travelers.length ||
      !g.crew.every(
        (m, i) =>
          m &&
          travelers.some((person) => person.id === m.id) &&
          (i >= crew.length || m.id === crew[i].id) &&
          roles.includes(m.role) &&
          finite(m.health, 0, 100) &&
          finite(m.morale, 0, 100) &&
          validInjury(m.injury) &&
          (m.health > 0 || !m.injury),
      ) ||
      new Set(g.crew.map((m) => m.id)).size !== g.crew.length ||
      alive(g) > maxCrew ||
      !validBonds(g.bonds, g.crew) ||
      roles
        .slice(0, -1)
        .some((role) => g.crew.filter((m) => m.health && m.role === role).length > 1) ||
      !resources.every((key) => finite(g.supplies?.[key], 0, 10000)) ||
      cargo(g.supplies) > capacityFor(g) ||
      !validChronicle(
        g.chronicle,
        g.day,
        g.crew.map((m) => m.id),
      ) ||
      !Array.isArray(g.log) ||
      !g.log.every((e) => e && finite(e.day, 1, 100) && typeof e.text === 'string') ||
      g.seen.length > (g.mode === 'far' ? 9 : g.mode === 'frontier' ? 7 : 4) ||
      new Set(g.seen).size !== g.seen.length ||
      !g.seen.every((id) => (g.classic ? encounters : allEncounters).some((e) => e.id === id)) ||
      (g.pending !== null && !g.seen.includes(g.pending))
    )
      return null;
    const map = gameWorld(g);
    return g.path
      .slice(1)
      .every((id, i) => map.edges.some(([from, to]) => from === g.path[i] && to === id))
      ? g
      : null;
  } catch {
    return null;
  }
}
