import assert from 'node:assert/strict';
import { Game, stats } from '../src/shared/combat.mjs';
import { configureTutorial, tutorialEvent, TUTORIAL_STEPS } from '../src/shared/tutorial.mjs';
import { PerformanceTuner } from '../src/client/performance-tuner.mjs';
import { Preferences } from '../src/client/preferences.mjs';
import { EndlessRecords } from '../src/client/endless-records.mjs';
import { NetworkClient } from '../src/client/network.mjs';
import { connectionRecovery } from '../src/shared/connection-recovery.mjs';
const memory = new Map(),
  storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
const g = new Game();
g.reset();
configureTutorial(g, stats);

function drain() {
  for (const ev of g.events) tutorialEvent(g, ev);
  g.events = [];
}

function step(n, input = {}, skipAI = false) {
  for (let i = 0; i < n; i++) {
    g.update(0.02, { ...input, skipAI, skipProgression: true });
    drain();
  }
}
assert(g.training.tutorial);
assert.equal(g.training.unlimited, false);
g.player.x = 3.1;
step(1, {}, true);
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'attack');
g.player.x = 0;
g.player.z = 2;
g.player.face = Math.PI;
assert(g.attack());
step(30, {}, true);
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'heavy');
g.player.x = 0;
g.player.z = 2;
g.player.face = Math.PI;
assert(g.heavyAttack());
step(65, {}, true);
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'dodge');
assert(g.dodge(1, 0));
drain();
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'block');
step(180, { block: true });
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'parry');
step(180, { block: true });
assert.equal(
  TUTORIAL_STEPS[g.training.tutorial.step].id,
  'parry',
  'holding guard never completes the parry lesson',
);
step(20);
const enemy = g.enemies[0];
g.player.x = 0;
g.player.z = 2.2;
g.player.face = Math.PI;
g.player.stagger = 0;
g.player.invuln = 0;
g.stamina = 100;
Object.assign(enemy, {
  x: 0,
  z: 0,
  face: 0,
  state: 'attack',
  begin: g.time - 0.11,
  until: g.time + 0.4,
  activeHit: false,
  targetId: g.player.id,
});
step(1, { block: true });
assert.equal(
  TUTORIAL_STEPS[g.training.tutorial.step].id,
  'ability',
  'a real fresh-guard parry advances the lesson',
);
assert(g.ultimate());
step(65, {}, true);
assert.equal(TUTORIAL_STEPS[g.training.tutorial.step].id, 'stamina');
step(200, {}, true);
assert(g.training.tutorial.complete);
assert.equal(g.training.tutorial.step, 8);
assert.equal(g.mode, 'playing');
assert.equal(g.souls, 0);
{
  const prefs = new Preferences(storage),
    tuner = new PerformanceTuner(prefs);
  for (let i = 0; i < 151; i++) tuner.sample(32);
  assert.equal(prefs.data.quality, 'low');
  assert(prefs.data.performanceCalibrated);
  prefs.set({ quality: 'high', qualityMode: 'manual' });
  for (let i = 0; i < 200; i++) tuner.sample(70);
  assert.equal(prefs.data.quality, 'high');
  tuner.reset();
  for (let i = 0; i < 151; i++) tuner.sample(16, { coarse: false, width: 1400 });
  assert.equal(prefs.data.quality, 'medium');
  tuner.reset();
  for (let i = 0; i < 151; i++) tuner.sample(8, { coarse: false, width: 1400 });
  assert.equal(prefs.data.quality, 'high');
  tuner.reset();
  for (let i = 0; i < 200; i++) tuner.sample(1000, { active: false });
  assert.equal(tuner.samples.length, 0);
  const saved = new Preferences(storage);
  assert.equal(saved.data.qualityMode, 'auto');
}
{
  const records = new EndlessRecords(storage);
  records.record('standard', 20, 100);
  records.record('veteran', 10, 150);
  assert.equal(records.best('standard'), 20);
  assert.equal(records.best('veteran'), 10);
  assert(!records.record('standard', 19));
  const next = new EndlessRecords(storage);
  assert.equal(next.best('standard'), 20);
  assert.equal(next.best('pilgrim'), 0);
  const e = new Game();
  e.reset();
  e.startEndless();
  e.endless.encounter = 10;
  e.endless.cleared = 9;
  e.wave = 4;
  e.arenaObjective = null;
  e.clearAt = 0.001;
  e.enemies.forEach((x) => (x.dead = true));
  e.update(0.02, { skipAI: true });
  assert(e.events.some((x) => x.type === 'endlessMilestone' && x.cleared === 10));
}
{
  assert(connectionRecovery('coop', [10000, 10000], 14000).reconnecting);
  assert.equal(connectionRecovery('coop', [10000, 10000], 14000).expired, -1);
  assert.equal(connectionRecovery('coop', [10000, 10000], 56000).expired, 0);
  assert.equal(connectionRecovery('versus', [10000, 10000], 23000).expired, 0);
  const client = new NetworkClient(storage);
  client.mode = 'coop';
  client.room = 'room';
  client.token = 'test-token';
  client.receive({
    status: 'playing',
    mode: 'coop',
    seat: 0,
    acks: [4, 0],
    events: [],
    players: [],
  });
  assert(client.recovery());
  const resumed = new NetworkClient(storage);
  resumed.request = async (path, data) => {
    assert.equal(path, 'room');
    assert.equal(data.room, 'room');
    return { status: 'playing', mode: 'coop', seat: 0, acks: [7, 0], events: [], players: [] };
  };
  await resumed.resume();
  assert.equal(resumed.room, 'room');
  assert.equal(resumed.actionId, 7);
  assert.equal(resumed.actions.length, 0);
  resumed.receive({ status: 'ended', mode: 'coop', seat: 0, acks: [7, 0] });
  assert.equal(resumed.recovery(), null);
  client.savedAt = 0;
  client.remember();
  const retry = new NetworkClient(storage);
  retry.request = async () => {
    throw Error('offline');
  };
  await assert.rejects(retry.resume());
  assert(retry.recovery(), 'temporary rejoin failures keep the retry available');
  await client.leave();
  assert.equal(client.recovery(), null);
}
console.log(
  'PASS: playable eight-step tutorial with real attacks/block/parry/ability/stamina; auto graphics/manual preservation; per-difficulty endless records/milestones; recovery grace, exact room resume, action acknowledgements and retry/leave cleanup.',
);
