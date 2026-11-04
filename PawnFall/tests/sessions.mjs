import assert from 'node:assert/strict';
import { Battle } from '../src/shared/battle.mjs';
const players = [
  { name: 'A', skin: 'ivory', weapon: 'rapier' },
  { name: 'B', skin: 'ivory', weapon: 'warhammer' },
];
const command = (b, seat, kind) => b.control(seat, { kind, series: b.series, round: b.round });
const step = (b, n = 170) => {
  for (let i = 0; i < n; i++) b.step(0.02);
};

function start(b) {
  command(b, 0, 'ready');
  assert.notEqual(b.phase, 'combat');
  command(b, 1, 'ready');
  assert.equal(b.phase, 'countdown');
  step(b, 100);
  assert.equal(b.phase, 'countdown');
  step(b, 60);
  assert.equal(b.phase, 'combat');
}
let b = new Battle('versus', players, { readyCheck: true, bestOf: 3 });
const x = b.games[0].player.x;
b.setInput(0, { x: 1, actions: [{ n: 1, kind: 'attack' }] });
step(b);
assert.equal(b.time, 0);
assert.equal(b.games[0].player.x, x);
assert.equal(b.games[0].stamina, 100);
start(b);
assert.equal(b.games[0].stamina, 100, 'queued pre-ready attacks are not replayed');
b.games[1].hp = 0;
b.step(0.02);
assert.equal(b.phase, 'roundEnd');
assert.equal(b.status, 'playing');
assert.deepEqual(b.scores, [1, 0]);
const time = b.time;
step(b);
assert.equal(b.time, time, 'round results freeze combat');
b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
start(b);
assert.equal(b.round, 2);
assert.equal(b.games[0].weapon, 'rapier');
assert.equal(b.games[1].weapon, 'warhammer');
assert.equal(b.games[1].hp, 100);
assert.equal(b.games[1].flasks, 3);
b.games[0].hp = 0;
b.step(0.02);
assert.deepEqual(b.scores, [1, 1]);
start(b);
b.games[1].hp = 0;
b.step(0.02);
assert.equal(b.status, 'ended');
assert.equal(b.winner, 0);
assert.deepEqual(b.scores, [2, 1]);
command(b, 0, 'rematch');
assert.equal(b.status, 'ended');
assert.deepEqual(b.rematch, [true, false]);
b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
command(b, 1, 'rematch');
assert.equal(b.series, 2);
assert.equal(b.phase, 'ready');
assert.deepEqual(b.scores, [0, 0]);
assert.deepEqual(b.ready, [false, false]);
b.control(0, { kind: 'ready', series: 1, round: 1 });
assert.deepEqual(b.ready, [false, false], 'old commands cannot affect rematch');
start(b);
b.forfeit(1);
assert.equal(b.winner, 0);
assert.equal(b.reason, 'disconnect');
command(b, 0, 'rematch');
command(b, 1, 'rematch');
assert.equal(b.series, 2, 'departure prevents rematch');
const draw = new Battle('versus', players, { bestOf: 3 });
draw.time = 299.99;
draw.step(0.02);
assert.equal(draw.roundWinner, null);
assert.deepEqual(draw.scores, [0, 0]);
assert.equal(draw.phase, 'roundEnd');
const single = new Battle('versus', players, { bestOf: 1 });
single.games[0].hp = 0;
single.step(0.02);
assert.equal(single.status, 'ended');
assert.equal(single.winner, 1);
const coop = new Battle('coop', players, { readyCheck: true });
start(coop);
coop.games.forEach((g) => (g.hp = 0));
coop.step(0.02);
assert.equal(coop.status, 'ended');
command(coop, 0, 'rematch');
command(coop, 1, 'rematch');
assert.equal(coop.series, 2);
assert.equal(coop.wave, 0);
assert.equal(coop.games[0].enemies, coop.games[1].enemies);
console.log(
  'PASS: two-player ready barrier, countdown, no buffered attacks, best-of-three 2–1 series, round resets and rewards boundary, persisted rematches, stale commands, disconnect forfeits, draws, single-duel and co-op rematches.',
);
