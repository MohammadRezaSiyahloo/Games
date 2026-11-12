import assert from 'node:assert/strict';
import test from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { buildCamp } from '../src/camp-scene.ts';
import {
  decideLetter,
  alive,
  assign,
  canAfford,
  capacityFor,
  cook,
  encounterEffect,
  forage,
  gameWorld,
  here,
  install,
  newGame,
  pendingEvent,
  quote,
  readSave,
  recruit,
  repair,
  resolve,
  routes,
  setRations,
  trade,
  travel,
} from '../src/game.ts';
import { emptyProfile, outfitsOpen, readProfile, recordRun } from '../src/profile.ts';

const initial = () => newGame('Hearth-01');
function finishEvent(game) {
  const pending = pendingEvent(game);
  return pending
    ? resolve(
        game,
        pending.choices.findIndex((c) => canAfford(game, c.supplies)),
      )
    : game;
}

test('new map forks cross between lanes and offer different provisions and wear', () => {
  const game = initial();
  assert.deepEqual(new Set(routes(game).map((p) => p.id)), new Set(['pine', 'hollow', 'ridge']));
  const ridge = finishEvent(travel(game, 'ridge'));
  assert.deepEqual(ridge.path, ['hearth', 'ridge']);
  assert.equal(here(ridge).find.materials, 3);
  assert.ok(routes(ridge).some((p) => p.id === 'shelter'));
  assert.ok(routes(ridge).some((p) => p.id !== 'shelter'));
  assert.ok(gameWorld(ridge).edges.some(([from, to]) => from === 'station' && to === 'city'));
  assert.ok(
    quote(
      game,
      routes(game).find((p) => p.id === 'ridge'),
    ).wagon >
      quote(
        game,
        routes(game).find((p) => p.id === 'pine'),
      ).wagon,
  );
});

test('recruits consume supplies and can cover a wounded companion’s duty', () => {
  const atMarket = finishEvent(travel(initial(), 'pine'));
  const candidate = recruit(atMarket);
  assert.equal(alive(candidate), 5);
  assert.equal(candidate.crew[4].id, 'nessa');
  assert.equal(candidate.crew[4].role, 'Reserve');
  assert.equal(recruit(candidate), candidate);
  assert.equal(candidate.supplies.coins, atMarket.supplies.coins - 4);
  const place = routes(candidate)[0];
  assert.equal(quote(candidate, place).water, quote(atMarket, place).water + place.days);
  candidate.crew[0].health = 33;
  const changed = assign(candidate, 4, 'Scout');
  assert.equal(changed.crew[4].role, 'Scout');
  assert.equal(changed.crew[0].role, 'Reserve');
  assert.equal(quote(changed, place).wagon, quote(candidate, place).wagon - 2);
  assert.deepEqual(readSave(JSON.stringify(changed)), changed);
});

test('upgrades cost resources, alter rules, and respect the two-slot limit', () => {
  const g = initial();
  g.supplies.materials = 11;
  const withRack = install(g, 'rack');
  assert.equal(capacityFor(withRack), 50);
  assert.equal(withRack.supplies.coins, 7);
  const withStove = install(withRack, 'stove');
  assert.equal(withStove.supplies.materials, 4);
  assert.equal(install(withStove, 'cover'), withStove);
  const route = routes(withStove)[0];
  assert.equal(quote(withRack, route).food, quote(withStove, route).food + route.days);
  const withCover = install(g, 'cover');
  const impact = encounterEffect(withCover, {
    label: 'Cross',
    result: 'Crossed',
    health: -14,
    wagon: -12,
  });
  assert.equal(impact.health, -7);
  assert.equal(impact.wagon, -7);
  const withBraces = install(g, 'braces');
  withBraces.wagon = 49;
  assert.equal(repair(withBraces).wagon, 84);
});

test('camp actions and lean rations have predictable costs and benefits', () => {
  const g = initial();
  const camped = forage(cook(g));
  assert.equal(camped.supplies.food, g.supplies.food + 2);
  assert.equal(camped.supplies.water, g.supplies.water - 2);
  assert.equal(camped.day, g.day + 1);
  assert.equal(cook(camped), camped);
  assert.equal(forage(camped), camped);
  const lean = setRations(camped, 'lean');
  const route = routes(lean).find((p) => p.id === 'pine');
  const quoteLean = quote(lean, route);
  const after = travel(lean, route.id);
  assert.equal(quoteLean.food, quote(camped, route).food - route.days);
  assert.equal(after.crew[0].health, 100 - quoteLean.rationHealth);
  assert.equal(after.crew[0].morale, camped.crew[0].morale - quoteLean.rationMorale);
  assert.equal(after.ration, 'normal');
});

test('a legacy save preserves its atlas, pending encounter, and founder assignments', () => {
  const previous = travel(newGame('Legacy-09', 'standard', 'legacy-original', true), 'pine');
  const { id, classic, outfit, upgrades, ration, mode, bonds, ...legacy } = previous;
  const oldState = {
    ...legacy,
    version: 1,
    crew: legacy.crew.map(({ health, morale }) => ({ health, morale })),
  };
  const migrated = readSave(JSON.stringify(oldState));
  assert.equal(migrated.version, 8);
  assert.equal(migrated.classic, true);
  assert.deepEqual(gameWorld(migrated), gameWorld(previous));
  assert.equal(migrated.pending, previous.pending);
  assert.equal(migrated.crew[2].role, 'Medic');
  assert.equal(finishEvent(migrated).pending, null);
});

test('an expanded expedition can win with a recruit and unlock outfits exactly once', () => {
  let g = newGame('Hearth-01', 'standard', 'Hearth-01', false, 'standard', undefined, false);
  const plan = [
    ['pine', 1],
    ['pass', 0],
    ['bridge', 0],
    ['station', 1],
    ['city', 0],
  ];
  for (const [id, choice] of plan) {
    if (g.current === 'pine') {
      g = recruit(g);
      g = trade(trade(g, 'food'), 'water');
    }
    if (g.wagon < 72) g = repair(g);
    if (id === 'station' || id === 'city') g = setRations(g, 'lean');
    g = travel(g, id);
    if (g.pending) g = resolve(g, choice);
    g = decideLetter(g, 'keep');
  }
  assert.equal(g.status, 'won');
  assert.ok(g.crew[4]?.health > 0);
  const p = recordRun(emptyProfile(), g);
  assert.ok(p.badges.includes('companion'));
  assert.ok(outfitsOpen(p).includes('merchant'));
  assert.equal(p.finished, 1);
  assert.equal(p.victories, 1);
  assert.equal(recordRun(p, g), p);
  assert.deepEqual(readProfile(JSON.stringify(p)), p);
  assert.equal(newGame('Replay-1', 'merchant').supplies.coins, 16);
});

test('three regional Babylon camps render with animated crew and wagon geometry', async () => {
  for (const region of [0, 1, 2]) {
    const engine = new NullEngine();
    try {
      const members = ['mara', 'bram', 'iona', 'tomas', 'nessa'];
      const camp = buildCamp(engine, { region, members, condition: 34, animate: true });
      camp.size(1.38);
      camp.animate(1.2);
      await camp.scene.whenReadyAsync();
      camp.scene.render();
      assert.equal(camp.scene.getTransformNodesById('traveler').length, members.length);
      assert.ok(camp.scene.getMeshByName('wagon bed'));
      assert.equal(camp.scene.meshes.filter((m) => m.name === 'flame').length, 5);
      camp.scene.dispose();
    } finally {
      engine.dispose();
    }
  }
});
