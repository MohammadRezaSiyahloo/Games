import { angleLerp } from '../src/shared/combat.mjs';
import assert from 'node:assert/strict';
import {
  reconcileAvatar,
  interpolateAvatar,
  matchResult,
} from '../src/client/multiplayer-presentation.mjs';
import { Battle } from '../src/shared/battle.mjs';
const current = { x: 0, z: 0, y: 0, face: Math.PI - 0.02 };
const snapshot = { x: 1, z: 0, y: 0, face: -Math.PI + 0.02, state: 'walk', hp: 90 };
const p = reconcileAvatar(current, snapshot);
assert.equal(p.x, 0, 'packets do not snap the camera-followed player');
assert.equal(p.hp, 90, 'combat values remain authoritative');
interpolateAvatar(p, snapshot, 1 / 60, {}, 0);
assert(p.x > 0 && p.x < 0.3, 'correction distributed across frames');
assert(Math.abs(p.face - current.face) < 0.02, 'rotation takes shortest path');
for (let n = 0; n < 100; n++) interpolateAvatar(p, snapshot, 1 / 60, {}, 0);
assert(Math.abs(p.x - snapshot.x) < 1e-6);
const instant = { x: 0, z: 0, y: 0, face: 0 };
interpolateAvatar(instant, { x: 0, z: 0, y: 0, face: 0, state: 'walk' }, 1 / 60, { x: 1 }, 0);
assert(
  Math.abs(instant.x - 3.8 / 60) < 1e-9,
  'movement responds in the first render frame, without a server packet',
);
const first = reconcileAvatar(current, snapshot, true);
assert.equal(first.x, 1, 'initial spawn exact');
assert.equal(
  reconcileAvatar(current, { ...snapshot, x: 10 }).x,
  10,
  'large teleports reset interpolation',
);
const dodge = { ...snapshot, state: 'dodge' };
const a = { x: 1, z: 0, y: 0, face: 0 };
interpolateAvatar(a, dodge, 0.02, { x: 1 }, 0.2);
assert.equal(a.x, 1, 'no walking prediction during a roll');
for (const seat of [0, 1])
  for (const winner of [0, 1, null]) {
    const r = matchResult({ mode: 'versus', names: ['Alice', 'Bob'], seat, winner });
    assert.equal(r.outcome, winner === null ? 'draw' : winner === seat ? 'victory' : 'defeat');
    assert.equal(
      r.winner,
      winner === null
        ? 'No winner — the duel is tied.'
        : (winner === 0 ? 'Alice' : 'Bob') + ' wins!',
    );
  }
assert.equal(
  matchResult({ mode: 'coop', names: ['A', 'B'], seat: 0, winner: 'team' }).winner,
  'Your alliance wins!',
);
const b = new Battle('versus', [{ name: 'A' }, { name: 'B' }]);
b.games[0].player.x = 0;
b.games[0].player.z = 1;
b.games[1].player.x = 0;
b.games[1].player.z = -1;
b.setInput(0, { actions: [{ n: 1, kind: 'attack' }] });
for (let n = 0; n < 12; n++) b.step(0.02);
const hits = b.events.filter((e) => e.type === 'hurt');
assert.equal(hits.length, 1, 'one impact event per PvP hit, no duplicate feedback');
assert.equal(hits[0].seat, 1);
console.log(
  'PASS: snapshot smoothing, authoritative combat values, teleport/spawn placement, angular interpolation, dodge prediction, both players’ win/loss/draw results, and deduplicated PvP impact events.',
);

assert(
  Math.abs(angleLerp(-20 * Math.PI, 0, 0.5) + 20 * Math.PI) < 1e-9,
  'repeated roll rotations take the shortest recovery path',
);
