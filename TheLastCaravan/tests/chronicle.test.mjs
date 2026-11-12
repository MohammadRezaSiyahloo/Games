import assert from 'node:assert/strict';
import test from 'node:test';
import { chronicleView, dayTrack, dayView } from '../src/chronicle-view.ts';
import { pagesForLeg } from '../src/chronicle.ts';
import {
  cook,
  forage,
  newGame,
  readSave,
  resolve,
  rest,
  routes,
  trade,
  travel,
} from '../src/game.ts';
import { journalText, useLanguage } from '../src/locale.ts';

const begin = () => newGame('Hearth-01');

test('a two-day trip has separate stories and resource totals that match the simulation', () => {
  const game = begin();
  const next = travel(game, 'pine');
  const entries = pagesForLeg(next).map((i) => next.chronicle[i]);
  assert.deepEqual(
    entries.map((page) => page.day),
    [2, 3],
  );
  assert.notEqual(entries[0].story, entries[1].story);
  assert.ok(
    entries.every(
      (page) => page.changes[0].supplies.food === -3 && page.changes[0].supplies.water === -4,
    ),
  );
  assert.equal(
    entries.reduce((sum, page) => sum + page.changes[0].wagon, 0),
    next.wagon - game.wagon,
  );
  assert.equal(
    entries.reduce((sum, page) => sum + page.changes[0].supplies.food, 0),
    next.supplies.food - game.supplies.food,
  );
  assert.deepEqual(readSave(JSON.stringify(next)), next);
});

test('shortages, lean rations, and the arrival cache are explained separately', () => {
  const game = begin();
  game.supplies.food = 1;
  game.supplies.water = 3;
  game.ration = 'lean';
  const next = travel(game, 'hollow');
  const page = next.chronicle.at(-1);
  assert.deepEqual(page.changes[0].shortage, { food: 1, water: 1 });
  assert.deepEqual(page.changes[0].supplies, { food: -1, water: -3 });
  assert.equal(
    page.changes.find((c) => c.reason.startsWith('At the ration stop')).crew[0].health,
    -17,
  );
  assert.equal(
    page.changes.find((c) => c.reason.startsWith('The crew stretches')).crew[0].health,
    -2,
  );
  assert.equal(page.changes.at(-1).supplies.food, 2);
  assert.equal(next.crew[0].health, 81);
  assert.equal(next.supplies.food, 2);
});

test('encounter and market pages report clamped outcomes and actual transactions', () => {
  const next = travel(begin(), 'pine');
  next.wagon = 99;
  next.pending = 'wheel';
  const resolved = resolve(next, 0);
  const outcome = resolved.chronicle.at(-1);
  assert.equal(outcome.kind, 'encounter');
  assert.equal(outcome.changes[0].wagon, 1);
  assert.equal(outcome.changes[0].supplies.materials, -2);
  const bought = trade(resolved, 'food');
  assert.deepEqual(bought.chronicle.at(-1).changes[0].supplies, { food: 7, coins: -3 });
});

test('camp days record rest, foraging, and their real costs', () => {
  const start = begin();
  const cooked = cook(start);
  const rested = rest(cooked);
  const foraged = forage(rested);
  assert.deepEqual(
    foraged.chronicle.map((page) => page.day),
    [1, 1, 2, 3],
  );
  assert.match(rested.chronicle.at(-1).story, /low fire/);
  assert.match(foraged.chronicle.at(-1).story, /empty sacks/);
  assert.equal(foraged.chronicle.at(-1).changes[0].supplies.water, -2);
  assert.ok(foraged.chronicle.at(-1).changes[0].supplies.food > 0);
});

test('old saves keep their ledger and start collecting new diary pages', () => {
  const { chronicle, ...current } = begin();
  const before = readSave(JSON.stringify({ ...current, version: 3 }));
  assert.deepEqual(before.log, current.log);
  assert.deepEqual(before.chronicle, []);
  const next = travel(before, routes(before)[0].id);
  assert.ok(next.chronicle.length > 0);
  assert.deepEqual(readSave(JSON.stringify(next)), next);
});

test('Persian diary output translates the road, companion moments, and exact costs', () => {
  const game = begin();
  const next = travel(game, 'pine');
  useLanguage('fa');
  try {
    for (const page of next.chronicle) {
      assert.notEqual(journalText(page.story), page.story);
      for (const change of page.changes) assert.notEqual(journalText(change.reason), change.reason);
    }
    const output = chronicleView(next.chronicle);
    assert.match(output, /روز ۲ سفر/);
    assert.match(output, /به سوی دیده‌بان کاج/);
    assert.match(dayView(next.chronicle.at(-1)), /−۴/);
  } finally {
    useLanguage('en');
  }
});

test('travel cards preserve exact changes, their causes, and direct day navigation', () => {
  const start = begin();
  start.supplies.food = 4;
  const arrived = travel(start, 'pine');
  const pages = pagesForLeg(arrived).map((index) => arrived.chronicle[index]);
  const second = dayView(pages[1]);
  assert.match(second, /class="travel-scene"/);
  assert.match(second, /Rations and wear on the road/);
  assert.match(second, /Missing 2 food and 0 water/);
  assert.match(second, /portrait-mara/);
  assert.match(second, /−14/);
  assert.match(dayTrack(pages, 1), /data-id="1" aria-label="Day 3" aria-current="step"/);
  assert.equal(dayTrack([pages[0]], 0), '');
  assert.match(chronicleView(pages), /class="chronicle-thumb"/);
});
