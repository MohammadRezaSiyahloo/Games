import assert from 'node:assert/strict';
import { Game } from '../src/shared/combat.mjs';
import { CASTELLAN, createCastellan } from '../src/shared/bosses.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { Progression } from '../src/client/progression.mjs';
const step = (g, seconds, input = {}) => {
  for (let n = 0; n < Math.ceil(seconds / 0.02); n++) g.update(0.02, input);
};

function fight() {
  const g = new Game();
  g.reset(0);
  g.wave = 4;
  g.spawn();
  g.events = [];
  return g;
}
{
  const g = fight(),
    e = g.enemies[0];
  assert.equal(g.enemies.length, 1);
  assert.equal(e.boss, 'castellan');
  assert.equal(e.hp, 780);
  g.hitEnemy(e, 32);
  assert.equal(e.hp, 768);
  e.coreOpen = true;
  g.hitEnemy(e, 32);
  assert.equal(e.hp, 715);
  assert.equal(e.poise, 32);
  e.poise = 120;
  g.hitEnemy(e, 10);
  assert.equal(e.state, 'stagger');
  assert(e.coreOpen);
  assert(g.events.some((x) => x.type === 'stagger'));
  const until = e.until;
  g.hitEnemy(e, 32);
  assert.equal(e.until, until, 'posture immunity prevents stagger loops');
}
{
  const g = fight(),
    e = g.enemies[0];
  e.cooldown = 0;
  g.update(0.02);
  assert.equal(e.state, 'windup');
  assert.equal(e.attackKind, 'charge');
  const locked = { ...e.target };
  g.player.x = 5;
  step(g, 1);
  assert.equal(e.state, 'windup');
  assert.deepEqual(e.target, locked, 'telegraph does not track the player');
  assert.equal(g.hp, 100);
  step(g, 2);
  assert.equal(e.state, 'exposed');
  assert(e.coreOpen);
  assert.equal(g.hp, 100);
  assert(e.until - g.time > 2, 'a missed charge gives a long punish window');
}
{
  const g = fight(),
    e = g.enemies[0];
  e.cooldown = 0;
  g.player.z = 1;
  step(g, 3);
  assert.equal(g.hp, 70, 'charge damages once');
  assert.equal(g.events.filter((x) => x.type === 'hurt' && x.id === 'player').length, 1);
}
for (const phase of [1, 2]) {
  const g = fight(),
    e = g.enemies[0];
  e.x = 0;
  e.z = 0;
  e.count = 1;
  e.phase = phase;
  e.cooldown = 0;
  g.player.x = 0;
  g.player.z = 3;
  g.update(0.02);
  assert.equal(e.attackKind, 'hammer');
  step(g, 2.9);
  assert.equal(g.hp, phase === 1 ? 72 : 44, 'hammer pulse timing');
  assert.equal(e.state, 'exposed');
  assert(e.coreOpen);
}
{
  const g = fight(),
    e = g.enemies[0];
  e.x = 0;
  e.z = 0;
  e.count = 1;
  e.phase = 2;
  e.cooldown = 0;
  g.player.z = 3;
  step(g, 2.9, { block: true });
  assert.equal(g.hp, 100);
  assert.equal(g.events.filter((x) => x.type === 'block').length, 2, 'both slams can be guarded');
}
{
  const g = fight(),
    e = g.enemies[0];
  e.hp = e.max * 0.49;
  g.update(0.02);
  assert.equal(e.phase, 2);
  assert.equal(e.state, 'enrage');
  step(g, 1);
  assert.equal(g.events.filter((x) => x.type === 'bossPhase').length, 1);
  step(g, 1.1);
  assert.equal(e.state, 'approach');
  e.count = 2;
  e.cooldown = 0;
  g.player.x = 5;
  g.player.z = 0;
  g.update(0.02);
  assert.equal(e.attackKind, 'cross');
  g.player.x = 5;
  g.player.z = 0;
  assert.equal(e.z, -5);
  step(g, 2.3);
  assert.equal(g.hp, 100, 'diagonal safe pockets avoid crossfire');
}
{
  const g = fight(),
    e = g.enemies[0];
  e.phase = 2;
  e.count = 2;
  e.cooldown = 0;
  g.player.x = 0;
  g.player.z = 5;
  step(g, 2.3);
  assert.equal(g.hp, 74, 'crossfire hits marked lane');
}
{
  const b = new Battle('coop', [
    { name: 'A', skin: 'ivory' },
    { name: 'B', skin: 'ivory' },
  ]);
  b.wave = 3;
  b.games[0].wave = 3;
  b.games[0].spawn();
  b.connect();
  const e = b.games[0].enemies[0];
  assert.equal(e.hp, Math.round(CASTELLAN.hp * 1.45));
  b.games[0].player.x = 7;
  b.games[0].player.z = -5;
  b.games[1].player.x = 0;
  b.games[1].player.z = -2;
  e.cooldown = 0;
  b.step(0.02);
  assert.equal(e.aim.x, 1, 'first charge targets the first ally');
  assert.equal(e.target.x, 9.7);
  e.state = 'approach';
  e.count = 1;
  e.cooldown = 0;
  b.games[1].player.x = e.x;
  b.games[1].player.z = e.z + 3;
  b.step(0.02);
  assert.equal(e.attackKind, 'hammer');
  assert.equal(e.target.x, e.x, 'the second attack selects the other ally');
  const restored = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert.equal(restored.games[0].enemies[0].attackKind, 'hammer');
  assert.equal(restored.games[1].enemies, restored.games[0].enemies);
  restored.games[0].hitEnemy(restored.games[0].enemies[0], 10000);
  restored.step(0.02);
  assert(restored.snapshot(0).events.some((x) => x.type === 'bossDefeated'));
  assert(restored.snapshot(1).events.some((x) => x.type === 'bossDefeated'));
}
{
  const memory = new Map(),
    p = new Progression({ getItem: (k) => memory.get(k), setItem: (k, v) => memory.set(k, v) });
  p.event({ type: 'bossDefeated' }, 'ashen');
  assert(p.data.unlocked.includes('castellan'));
  assert(p.equip('siege'));
  assert(p.equipTitle('siegebreaker'));
  p.event({ type: 'end', won: true, trial: true }, 'ashen');
  assert.equal(p.data.stats.wins, 0);
  assert.equal(p.data.completed.length, 0, 'challenge does not grant a campaign clear');
  const g = fight();
  g.bossTrial = true;
  g.hitEnemy(g.enemies[0], 10000);
  step(g, 2.7);
  assert(g.events.some((e) => e.type === 'end' && e.won && e.trial));
}
console.log(
  'PASS: boss spawn, armor, exposed-core damage, posture break immunity, fixed telegraphs, charge, double hammer, guarding, phase transition, crossfire, co-op scaling/targets/serialization, shared rewards and challenge progression.',
);
