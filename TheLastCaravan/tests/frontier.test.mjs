import assert from 'node:assert/strict';
import test from 'node:test';
import { backupLimit, exportProgress, importProgress } from '../src/backup.ts';
import { bondLevel, bondSupport, detours } from '../src/frontier.ts';
import {
  decideLetter,
  canAfford,
  gameWorld,
  here,
  isBypass,
  newGame,
  pendingEvent,
  quote,
  readSave,
  repair,
  resolve,
  rest,
  routes,
  shareWatch,
  trade,
  travel,
  weather,
} from '../src/game.ts';
import { journalText, t, useLanguage } from '../src/locale.ts';
import { emptyProfile, readProfile, recordRun } from '../src/profile.ts';
import { campView, settingsView, setupView } from '../src/views.ts';

const initial = (seed = 'Hearth-01') => newGame(seed, 'standard', 'test-run', false, 'frontier');
const finishEvent = (g) => {
  const event = pendingEvent(g);
  return event
    ? resolve(
        g,
        event.choices.findIndex((c) => canAfford(g, c.supplies)),
      )
    : g;
};

test('extended atlas detours have entrances and exits across seeds and the bypass skips a stage', () => {
  for (let i = 0; i < 70; i++) {
    const g = initial('ridge-' + i);
    const map = gameWorld(g);
    assert.equal(map.nodes.length, 17);
    assert.deepEqual(map, gameWorld(initial('ridge-' + i)));
    for (const detour of detours) {
      assert.ok(map.edges.filter(([, to]) => to === detour.id).length >= 2);
      assert.ok(map.edges.filter(([from]) => from === detour.id).length >= 2);
    }
    const order = new Map(map.nodes.map((p) => [p.id, p.stage]));
    assert.ok(map.edges.every(([from, to]) => order.get(from) < order.get(to)));
  }
  const g = finishEvent(travel(initial(), 'ridge'));
  const bridge = routes(g).find((p) => p.id === 'bridge');
  assert.equal(isBypass(g, bridge.id), true);
  const cost = quote(g, bridge);
  assert.equal(cost.days, 2);
  assert.equal(travel(g, bridge.id).day, g.day + cost.days);
  assert.equal(gameWorld(newGame('Hearth-01')).nodes.length, 14);
});

test('departure weather changes as camp advances time and the quoted cost is applied', () => {
  const g = initial('Forecast-01');
  const a = routes(g).find((p) => p.id === 'ridge');
  const rested = rest(g);
  rested.day += 1;
  assert.notDeepEqual(weather(g, 0), weather(rested, 0));
  const cost = quote(g, a);
  const next = travel(g, a.id);
  assert.equal(next.wagon, g.wagon - cost.wagon);
  assert.equal(next.day, g.day + cost.days);
  assert.equal(next.supplies.water, g.supplies.water - cost.water);
});

test('shared watches strengthen a bond, cushion road morale, and create grief if a partner falls', () => {
  const g = initial();
  const bonded = shareWatch(g, 0, 2);
  assert.equal(bonded.supplies.food, g.supplies.food - 1);
  assert.equal(bondLevel(bonded, 'mara', 'iona'), 1);
  assert.equal(bondSupport(bonded, 0), 1);
  assert.equal(shareWatch(bonded, 1, 2), bonded);
  assert.match(bonded.log[0].text, /seeds/);
  bonded.supplies.food = 1;
  bonded.supplies.water = 4;
  const short = travel(bonded, 'hollow');
  assert.equal(short.crew[0].morale - bonded.crew[0].morale, -7);
  assert.equal(short.crew[1].morale - bonded.crew[1].morale, -8);
  bonded.crew[2].health = 5;
  const grieving = travel(bonded, 'hollow');
  assert.equal(grieving.crew[2].health, 0);
  assert.equal(grieving.crew[0].morale - bonded.crew[0].morale, -11);
  assert.ok(grieving.log.some((e) => e.text.includes('morale in grief')));
  assert.deepEqual(readSave(JSON.stringify(grieving)), grieving);
});

test('v2 saves migrate to the familiar atlas and profile records migrate to its replay mode', () => {
  const current = newGame('Hearth-01');
  const { mode, bonds, ...previous } = current;
  const restored = readSave(JSON.stringify({ ...previous, version: 2 }));
  assert.deepEqual(restored, {
    ...current,
    chronicle: [],
    letter: 'absent',
    expandedEncounters: false,
  });
  const profile = recordRun(emptyProfile(), { ...current, status: 'won' });
  delete profile.records[0].mode;
  assert.equal(readProfile(JSON.stringify(profile)).records[0].mode, 'standard');
});

test('a full frontier journey can use all three detours and reach the city', () => {
  let g = initial();
  const plan = [
    ['hollow', 0],
    ['grove', 2],
    ['shelter', 0],
    ['refuge', 0],
    ['rest', 1],
    ['spring', 0],
    ['well', 2],
    ['city', 0],
  ];
  for (const [id, index] of plan) {
    if (here(g).kind === 'market') {
      if (g.supplies.food < 12) g = trade(g, 'food');
      if (g.supplies.water < 14) g = trade(g, 'water');
    }
    if (g.wagon < 78) g = repair(g);
    g = travel(g, id);
    if (g.pending) g = resolve(g, index);
    g = decideLetter(g, 'keep');
    assert.equal(g.pending, null);
    assert.equal(g.current, id);
  }
  assert.equal(g.status, 'won');
  assert.equal(g.seen.length, 7);
  assert.ok(g.crew.every((m) => m.health > 0));
  const profile = recordRun(emptyProfile(), g);
  assert.equal(profile.records[0].mode, 'frontier');
  assert.ok(profile.badges.includes('detours'));
  assert.deepEqual(readSave(JSON.stringify(g)), g);
});

test('portable progress restores the expedition and Persian preferences and rejects invalid files', () => {
  const game = shareWatch(initial(), 0, 2);
  const profile = emptyProfile();
  profile.settings.language = 'fa';
  const backup = exportProgress(game, profile);
  assert.deepEqual(importProgress(backup), { game, profile });
  assert.equal(importProgress('{"version":1}'), null);
  assert.equal(importProgress('x'.repeat(backupLimit + 1)), null);
  const invalid = JSON.parse(backup);
  invalid.game.bonds[0].strength = 5;
  assert.equal(importProgress(JSON.stringify(invalid)), null);
  useLanguage('fa');
  try {
    assert.match(t(detours[0].name), /باران‌گیر/);
    assert.match(campView(game, 'bonds', game.log[0].text), /نگهبانی مشترک/);
    assert.match(setupView(game, profile, undefined), /راه بلند/);
    assert.match(settingsView(profile), /ذخیره‌های قابل‌انتقال/);
    for (const entry of game.log) assert.notEqual(journalText(entry.text), entry.text);
  } finally {
    useLanguage('en');
  }
});
