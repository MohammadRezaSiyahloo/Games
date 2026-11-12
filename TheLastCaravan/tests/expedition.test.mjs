import assert from 'node:assert/strict';
import test from 'node:test';
import { resources } from '../src/content.ts';
import {
  decideLetter,
  allEncounters,
  alive,
  canAfford,
  cargo,
  capacity,
  newGame,
  pendingEvent,
  quote,
  readSave,
  repair,
  resolve,
  rest,
  routes,
  trade,
  travel,
  treat,
  world,
} from '../src/game.ts';

const initial = () => newGame('Hearth-01');
const cleared = (g, target) => {
  const arrived = travel(g, target);
  const event = pendingEvent(arrived);
  return decideLetter(
    event
      ? resolve(
          arrived,
          event.choices.findIndex((c) => canAfford(arrived, c.supplies)),
        )
      : arrived,
    'keep',
  );
};

test('seeded maps contain 14 reachable places and reproducible branching', () => {
  for (let i = 0; i < 100; i++) {
    const seed = 'atlas-' + i;
    const map = world(seed);
    assert.deepEqual(map, world(seed));
    assert.equal(map.nodes.length, 14);
    assert.equal(new Set(map.nodes.map((p) => p.region)).size, 3);
    const visited = new Set(['hearth']);
    for (let stage = 0; stage < 5; stage++) {
      for (const node of map.nodes.filter((p) => p.stage === stage)) {
        assert.ok(visited.has(node.id));
        const exits = map.edges.filter(([from]) => from === node.id);
        assert.ok(exits.length >= 1);
        for (const [, to] of exits) visited.add(to);
      }
    }
    assert.equal(visited.size, 14);
  }
  assert.notDeepEqual(world('atlas-0'), world('atlas-1'));
  assert.equal(world('atlas-0', true).nodes.length, 10);
  assert.equal(routes(initial()).length, 3);
  assert.ok(routes(initial(), 'ridge').some((node) => node.id === 'shelter'));
});

test('travel consumes the quoted supplies and triggers a reproducible event', () => {
  const g = initial();
  const p = routes(g).find((p) => p.id === 'pine');
  const cost = quote(g, p);
  const next = travel(g, p.id);
  assert.deepEqual(next, travel(initial(), p.id));
  assert.equal(next.day, g.day + p.days);
  assert.equal(next.supplies.food, g.supplies.food - cost.food);
  assert.equal(next.supplies.water, g.supplies.water - cost.water);
  assert.equal(next.wagon, g.wagon - cost.wagon);
  assert.deepEqual(next.path, ['hearth', 'pine']);
  assert.ok(pendingEvent(next));
  assert.equal(travel(next, routes(next)[0].id), next);
  assert.equal(travel(g, 'city'), g);
});

test('all encounters have a free exit, and costs and outcomes change game state', () => {
  assert.equal(allEncounters.length, 32);
  for (const encounter of allEncounters) {
    const g = initial();
    g.pending = encounter.id;
    g.supplies = Object.fromEntries(resources.map((key) => [key, 0]));
    const free = encounter.choices.findIndex((c) => canAfford(g, c.supplies));
    assert.ok(free >= 0, encounter.title);
    assert.equal(resolve(g, free).pending, null);
  }
  const g = initial();
  g.pending = 'child';
  const helped = resolve(g, 0),
    refused = resolve(g, 2);
  assert.equal(helped.supplies.medicine, g.supplies.medicine - 1);
  assert.equal(helped.crew[2].morale, 98);
  assert.equal(refused.crew[2].morale, 72);
  g.supplies.medicine = 0;
  assert.equal(resolve(g, 0), g);
});

test('shortages wound and discourage travelers, whose condition changes travel costs', () => {
  const g = initial();
  const p = routes(g).find((p) => p.id === 'pine');
  g.supplies.food = 4;
  g.supplies.water = 5;
  const next = travel(g, p.id);
  assert.equal(next.crew[0].health, 56);
  assert.equal(next.crew[0].morale, 62);
  assert.equal(next.supplies.water, 0);
  const fitQuote = quote(g, p);
  g.crew[3].morale = 34;
  assert.equal(quote(g, p).food, fitQuote.food + p.days);
  g.crew[0].health = 39;
  assert.equal(quote(g, p).wagon, fitQuote.wagon + 2);
});

test('camp repairs, treatment and rest spend supplies and respect action limits', () => {
  const g = initial();
  g.wagon = 84;
  g.crew[0].health = 60;
  const fixed = repair(g),
    treated = treat(g, 0),
    rested = rest(g);
  assert.equal(fixed.wagon, 100);
  assert.equal(fixed.supplies.materials, 2);
  assert.equal(treated.crew[0].health, 90);
  assert.equal(treated.supplies.medicine, 1);
  assert.equal(rested.day, 2);
  assert.equal(rested.supplies.food, 7);
  assert.equal(rested.crew[0].health, 70);
  assert.equal(rest(rested), rested);
  g.crew[0].health = 0;
  assert.equal(treat(g, 0), g);
});

test('trading checks location, pending encounters, cargo and coin', () => {
  const g = initial();
  assert.equal(trade(g, 'food'), g);
  const arrived = travel(g, 'pine');
  assert.equal(trade(arrived, 'food'), arrived);
  const atMarket = resolve(arrived, 0);
  const bought = trade(atMarket, 'food');
  assert.equal(bought.supplies.food, atMarket.supplies.food + 7);
  assert.equal(bought.supplies.coins, atMarket.supplies.coins - 3);
  atMarket.supplies = { food: 40, water: 0, materials: 0, medicine: 0, coins: 10 };
  assert.equal(cargo(atMarket.supplies), capacity);
  assert.equal(trade(atMarket, 'water'), atMarket);
});

test('save/load restores a pending encounter exactly and rejects corrupt saves', () => {
  const g = travel(initial(), 'pine');
  const restored = readSave(JSON.stringify(g));
  assert.deepEqual(restored, g);
  assert.deepEqual(resolve(restored, 0), resolve(g, 0));
  assert.equal(readSave('{'), null);
  assert.equal(readSave(JSON.stringify({ ...g, path: ['hearth', 'city', 'pine'] })), null);
});

test('a player can reach the city with all four travelers on the starting seed', () => {
  let g = initial();
  for (const id of ['pine', 'mill', 'bridge', 'salt', 'city']) {
    assert.ok(routes(g).some((p) => p.id === id));
    if (g.current === 'pine' || g.current === 'mill') {
      g = trade(g, 'food');
      g = trade(g, 'water');
    }
    if (g.wagon < 75) g = repair(g);
    g = cleared(g, id);
  }
  assert.equal(g.status, 'won');
  assert.equal(g.current, 'city');
  assert.equal(alive(g), 4);
  assert.equal(g.path.length, 6);
});

test('losing the wagon or the entire crew ends the journey', () => {
  const g = initial();
  g.wagon = 1;
  const broken = travel(g, routes(g)[0].id);
  assert.equal(broken.status, 'lost');
  assert.equal(broken.pending, null);
  assert.equal(broken.wagon, 0);
  const empty = initial();
  empty.supplies.food = empty.supplies.water = 0;
  const starved = travel(empty, 'pine');
  assert.equal(starved.status, 'lost');
  assert.equal(alive(starved), 0);
  assert.equal(travel(starved, routes(starved)[0].id), starved);
});
