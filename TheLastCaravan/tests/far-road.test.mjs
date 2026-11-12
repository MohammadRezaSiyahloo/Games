import assert from 'node:assert/strict';
import test from 'node:test';
import { familyPromise, familyReturn } from '../src/far-road.ts';
import { rollCallView } from '../src/ending-view.ts';
import {
  capacityFor,
  canAfford,
  decideLetter,
  gameWorld,
  heavyAt,
  here,
  newGame,
  pendingEvent,
  quote,
  readSave,
  repair,
  resolve,
  roadDaysToCity,
  routes,
  trade,
  travel,
  world,
} from '../src/game.ts';
import { journalText, useLanguage } from '../src/locale.ts';
import { emptyProfile, readProfile, recordRun } from '../src/profile.ts';

const begin = () => newGame('Hearth-01', 'standard', 'far-road', false, 'far');
function advance(g, place, choice) {
  const next = travel(g, place);
  assert.equal(next.current, place);
  const encounter = pendingEvent(next);
  if (!encounter) return next;
  assert.ok(canAfford(next, encounter.choices[choice].supplies), encounter.id);
  return decideLetter(resolve(next, choice), 'keep');
}

test('the Far Road extends every branch beyond the old last stop', () => {
  for (let i = 0; i < 50; i++) {
    const map = world('far-' + i, false, 'far');
    assert.equal(map.nodes.length, 21);
    const stage = new Map(map.nodes.map((p) => [p.id, p.stage]));
    assert.equal(stage.get('city'), 7);
    assert.ok(map.edges.every(([a, b]) => stage.get(a) < stage.get(b)));
    const distance = new Map([['hearth', 0]]);
    for (const p of [...map.nodes].sort((a, b) => a.stage - b.stage)) {
      for (const [, to] of map.edges.filter(([from]) => from === p.id)) {
        distance.set(to, Math.min(distance.get(to) ?? Infinity, distance.get(p.id) + 1));
      }
    }
    assert.equal(distance.size, map.nodes.length);
    assert.equal(distance.get('city'), 6);
  }
  assert.equal(world('far-0', false, 'frontier').nodes.find((p) => p.id === 'city').stage, 5);
  const g = begin();
  assert.equal(g.supplies.food, 15);
  assert.equal(g.supplies.water, 17);
  assert.equal(g.supplies.coins, 15);
  assert.equal(capacityFor(g), 46);
  assert.equal(heavyAt(g), 38);
  assert.ok(
    roadDaysToCity(g).min >
      roadDaysToCity(newGame('Hearth-01', 'standard', 'prior', false, 'frontier')).min,
  );
  assert.ok(roadDaysToCity(g).max > roadDaysToCity(g).min);
});

test('spending medicine is a real cost and the family opens a route only after the old final stretch', () => {
  const arrived = travel(begin(), 'pine');
  assert.equal(pendingEvent(arrived).id, 'child');
  const helped = resolve(arrived, 0);
  const refused = resolve(arrived, 2);
  assert.equal(helped.supplies.medicine, arrived.supplies.medicine - 1);
  assert.ok(helped.log.some((e) => e.text === familyPromise));
  assert.equal(helped.favor, 'family');
  assert.equal(refused.favor, null);
  assert.ok(!gameWorld(helped).nodes.some((p) => p.id === 'reedpath'));
  const late = {
    ...helped,
    current: 'cistern',
    path: ['hearth', 'pine', 'pass', 'rest', 'well', 'cistern'],
  };
  assert.ok(routes(late).some((p) => p.id === 'reedpath'));
  const crossing = routes(late).find((p) => p.id === 'reedpath');
  assert.equal(quote(late, crossing).weather, 'Sheltered from the wind');
  assert.equal(quote(late, crossing).water, 4);
  assert.ok(!routes({ ...late, favor: null }).some((p) => p.id === 'reedpath'));
  assert.ok(readSave(JSON.stringify(late)));
});

test('a full Far Road run survives with normal market purchases, repairs, and the family crossing', () => {
  let g = begin();
  const plan = [
    ['pine', 0],
    ['pass', 2],
    ['rest', 0],
    ['spring', 0],
    ['well', 1],
    ['cistern', 0],
    ['reedpath', 2],
    ['city', 0],
  ];
  for (const [place, choice] of plan) {
    if (here(g).kind === 'market') {
      if (g.supplies.food < 10) g = trade(g, 'food');
      if (g.supplies.water < 11) g = trade(g, 'water');
    }
    if (g.wagon < 77) g = repair(g);
    g = advance(g, place, choice);
  }
  assert.equal(g.status, 'won');
  assert.equal(g.day, 13);
  assert.ok(g.crew.every((m) => m.health > 0));
  assert.ok(g.log.some((e) => e.text === familyReturn));
  assert.equal(g.path.at(-2), 'reedpath');
  assert.deepEqual(readSave(JSON.stringify(g)), g);
  const profile = recordRun(emptyProfile(), g);
  assert.equal(readProfile(JSON.stringify(profile)).records[0].mode, 'far');
  const view = rollCallView(g);
  assert.match(view, /Entered the city/);
  assert.match(view, /the girl is on her feet/i);
  useLanguage('fa');
  try {
    assert.match(rollCallView(g), /حاضری همسفران/);
    assert.match(journalText(familyPromise), /آیونا/);
  } finally {
    useLanguage('en');
  }
});

test('the roll call names the fallen and a v5 save retains its original route', () => {
  const prior = newGame('Hearth-01', 'standard', 'prior', false, 'frontier');
  const { favor, opening, ...old } = prior;
  const migrated = readSave(JSON.stringify({ ...old, version: 5 }));
  assert.equal(migrated.mode, 'frontier');
  assert.equal(migrated.favor, null);
  assert.equal(gameWorld(migrated).nodes.length, 17);
  const expedition = begin();
  expedition.crew[0].health = 5;
  expedition.supplies.food = 0;
  expedition.wagon = 1;
  const failed = travel(expedition, 'hollow');
  assert.equal(failed.status, 'lost');
  assert.match(rollCallView(failed), /Mara Voss/);
  assert.match(rollCallView(failed), /Fell on day 2/);
});
