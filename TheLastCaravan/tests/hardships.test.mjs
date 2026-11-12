import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assign,
  fit,
  gameWorld,
  newGame,
  pendingEvent,
  quote,
  readSave,
  resolve,
  rest,
  routes,
  travel,
  treat,
} from '../src/game.ts';
import { favors, favorForOpening, openingIds } from '../src/far-road.ts';
import { dayView } from '../src/chronicle-view.ts';
import { journalText, t, useLanguage } from '../src/locale.ts';
import { emptyProfile, readProfile, recordRun } from '../src/profile.ts';
import { campView } from '../src/views.ts';

function sprain() {
  const g = newGame('Hearth-01');
  g.pending = 'ford';
  g.seen.push('ford');
  return resolve(g, 2);
}

test('a sprain disables scouting, raises the route quote, and stays visible in the diary', () => {
  const injured = sprain();
  assert.deepEqual(injured.crew[0].injury, { kind: 'sprain', days: 2 });
  assert.equal(fit(injured, 0), false);
  const p = routes(injured).find((p) => p.id === 'hollow');
  assert.equal(quote(injured, p).injuryWear, 2);
  const swapped = assign(injured, 1, 'Scout');
  assert.equal(quote(swapped, p).injuryWear, 0);
  assert.equal(quote(injured, p).wagon - quote(swapped, p).wagon, 2);
  assert.match(dayView(injured.chronicle.at(-1)), /Sprained ankle/);
  assert.deepEqual(readSave(JSON.stringify(injured)), injured);
});

test('road recovery progresses by travel days and never rewrites past entries', () => {
  const injured = sprain();
  const next = travel(injured, 'hollow');
  assert.equal(next.crew[0].injury.days, 1);
  assert.equal(
    next.chronicle.at(-1).changes.find((c) => c.reason === 'Recovery on the road').crew[0].injury
      .days,
    1,
  );
  assert.equal(
    next.chronicle.find((p) => p.kind === 'encounter').changes[0].crew[0].injury.days,
    2,
  );
  assert.equal(injured.crew[0].injury.days, 2);
  assert.deepEqual(readSave(JSON.stringify(next)), next);
});

test('medicine clears injuries at full health and rest trades a day of supplies for recovery', () => {
  const injured = sprain();
  injured.crew[0].health = 100;
  const medic = treat(injured, 0);
  assert.equal(medic.crew[0].injury, undefined);
  assert.equal(medic.supplies.medicine, injured.supplies.medicine - 1);
  assert.equal(fit(medic, 0), true);
  assert.equal(medic.chronicle.at(-1).changes[0].crew[0].injury.days, 0);
  const camped = rest(injured);
  assert.equal(camped.day, injured.day + 1);
  assert.equal(camped.supplies.food, injured.supplies.food - 4);
  assert.equal(camped.crew[0].injury, undefined);
  useLanguage('fa');
  try {
    assert.match(campView(injured, 'supplies', ''), /درمان پیچ‌خوردگی/);
    assert.match(
      journalText(medic.log.find((e) => e.text.includes('recovered from their injury')).text),
      /بهبود/,
    );
    assert.match(dayView(medic.chronicle.at(-1)), /بهبود از پیچ‌خوردگی/);
  } finally {
    useLanguage('en');
  }
});

test('all three seeded Far Road openings spend a different resource and reveal their own late shortcut', () => {
  const cases = new Map();
  for (let i = 0; i < 80; i++) {
    const seed = 'hardships-' + i;
    const g = newGame(seed, 'standard', seed, false, 'far');
    assert.equal(newGame(seed, 'standard', seed, false, 'far').opening, g.opening);
    cases.set(g.opening, g);
  }
  assert.deepEqual(new Set(cases.keys()), new Set(openingIds));
  const costKey = { family: 'medicine', watch: 'materials', cooper: 'water' };
  for (const [opening, game] of cases) {
    const arrival = travel(game, 'ridge');
    assert.equal(pendingEvent(arrival).id, opening);
    const helped = resolve(arrival, 0),
      passed = resolve(arrival, 2);
    const favor = favorForOpening(opening);
    const arc = favors[favor],
      key = costKey[favor];
    assert.equal(
      helped.supplies[key],
      arrival.supplies[key] + pendingEvent(arrival).choices[0].supplies[key],
    );
    assert.equal(helped.favor, favor);
    assert.equal(passed.favor, null);
    assert.ok(!gameWorld(helped).nodes.some((p) => p.id === arc.stop.id));
    const late = { ...helped, current: 'gardens', path: [...helped.path, 'gardens'] };
    assert.ok(routes(late).some((p) => p.id === arc.stop.id));
    assert.equal(quote(late, arc.stop).weather, 'Sheltered from the wind');
    useLanguage('fa');
    try {
      assert.notEqual(t(pendingEvent(arrival).title), pendingEvent(arrival).title);
      assert.notEqual(journalText(arc.returnText), arc.returnText);
    } finally {
      useLanguage('en');
    }
  }
});

test('old Far Road saves and records retain the original fever opening', () => {
  const initial = newGame('legacy-far', 'standard', 'legacy', false, 'far');
  const { opening, favor, ...prior } = initial;
  const old = readSave(JSON.stringify({ ...prior, version: 6, familyAid: false }));
  assert.equal(old.opening, 'child');
  assert.equal(old.favor, null);
  const profile = recordRun(emptyProfile(), { ...initial, status: 'won' });
  delete profile.records[0].opening;
  assert.equal(readProfile(JSON.stringify(profile)).records[0].opening, 'child');
});
