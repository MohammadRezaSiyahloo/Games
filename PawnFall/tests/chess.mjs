import assert from 'node:assert/strict';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import {
  PIECES,
  beginAbility,
  abilityGeometry,
  pointInLane,
} from '../src/shared/piece-abilities.mjs';
import { attackPose } from '../src/client/attack-animation.mjs';

function game(kind) {
  const g = new Game();
  g.chessClass = kind;
  g.reset();
  g.player.x = 0;
  g.player.z = 0;
  g.player.face = 0;
  g.enemies = [];
  return g;
}

function target(x, z) {
  return {
    id: 'target' + x + ':' + z,
    type: 'rook',
    x,
    z,
    y: 0,
    hp: 1000,
    max: 1000,
    state: 'approach',
    cooldown: 999,
    poise: 0,
    dead: false,
  };
}

function step(g, seconds) {
  for (let i = 0; i < Math.ceil(seconds / 0.01); i++)
    g.update(0.01, { skipAI: true, skipProgression: true });
}
for (const piece of PIECES) {
  const g = game(piece.id);
  assert.equal(g.player.type, piece.id);
  assert(g.ultimate());
  assert.equal(g.stamina, 65);
  assert(!g.ultimate());
  assert(!g.dodge());
  assert(!g.attack());
  const a = g.player.ability;
  let pos;
  if (piece.id === 'bishop' || piece.id === 'queen') pos = { x: 4, z: 4 };
  else if (piece.id === 'pawn') pos = { x: 2, z: 4.8 };
  else pos = a.target;
  g.enemies = [target(pos.x, pos.z), target(-8, -6)];
  step(g, 0.44);
  assert.equal(g.enemies[0].hp, 1000, 'no damage before windup: ' + piece.id);
  step(g, 0.1);
  assert(g.enemies[0].hp < 1000, 'ability connects: ' + piece.id);
  const hp = g.enemies[0].hp;
  step(g, 0.6);
  assert.equal(g.enemies[0].hp, hp, 'one hit per target');
  assert.equal(g.player.ability, null);
  assert.equal(g.player.y, 0);
  if (piece.id === 'king') {
    const before = g.hp;
    g.hurtPlayer(20, { x: g.player.x + 4, z: g.player.z });
    assert.equal(before - g.hp, 10, 'king ward halves damage');
  }
  assert(!g.ultimate(), 'cooldown enforced');
  g.time = g.abilityReadyAt + 1;
  g.stamina = 100;
  g.player.stagger = 0;
  assert(g.ultimate());
  g.reset();
  assert.equal(g.abilityReadyAt, 0, 'new run resets ability');
}
{
  const g = game('bishop');
  g.enemies = [target(5, 5), target(0, 5)];
  g.ultimate();
  step(g, 0.6);
  assert.equal(g.enemies[0].hp, 956);
  assert.equal(g.enemies[1].hp, 1000, 'bishop cannot hit an orthogonal file');
}
{
  const g = game('queen');
  g.enemies = [target(5, 5), target(0, 5)];
  g.ultimate();
  step(g, 0.6);
  assert(
    g.enemies.every((e) => e.hp === 964),
    'queen covers both movement families',
  );
}
{
  const g = game('knight');
  g.ultimate();
  step(g, 0.25);
  assert.equal(g.player.x, 0, 'first leg follows the file');
  assert(g.player.z > 0);
  step(g, 0.2);
  assert(g.player.x > 0, 'second leg turns perpendicular');
  step(g, 0.6);
  assert.equal(g.player.x, 2.8);
  assert.equal(g.player.z, 5.6);
}
{
  const g = game('rook');
  g.ultimate();
  g.hurtPlayer(10, { x: 3, z: 0 });
  assert.equal(g.player.ability, null, 'damage interrupts a windup');
  step(g, 2);
  assert(!g.events.some((e) => e.type === 'abilityImpact'), 'interrupted ability never fires');
}
for (const piece of PIECES) {
  const g = game('pawn'),
    e = target(0, -5);
  e.type = piece.id;
  beginAbility(g, e, piece.id, true);
  g.enemies = [e];
  assert(e.ability.fireAt >= 1.15, 'enemy special windup is readable');
  const lines = abilityGeometry(e.ability);
  for (const line of lines) assert(pointInLane({ x: line.x, z: line.z }, line));
}
{
  let b = new Battle('versus', [
    { name: 'A', chessClass: 'bishop' },
    { name: 'B', chessClass: 'king' },
  ]);
  b.games[0].player.x = 0;
  b.games[0].player.z = 0;
  b.games[1].player.x = 5;
  b.games[1].player.z = 5;
  b.setInput(0, { actions: [{ n: 1, kind: 'ultimate' }] });
  for (let i = 0; i < 60; i++) b.step(0.01);
  assert.equal(b.games[1].hp, 56, 'authoritative ultimate damage');
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert.equal(b.games[0].chessClass, 'bishop');
  assert(b.games[0].abilityReadyAt > 0);
  assert.equal(b.snapshot(0).players[1].type, 'king');
  b.resetRound();
  assert.equal(b.games[0].player.type, 'bishop');
  assert.equal(b.games[0].abilityReadyAt, 0);
}
for (const weapon of ['longsword', 'rapier', 'warhammer']) {
  const a = attackPose(0, weapon),
    b = attackPose(1, weapon);
  for (const key of ['x', 'y', 'z', 'reach'])
    assert(Math.abs(a[key] - b[key]) < 1e-9, 'attack returns to idle pose');
  let prior = a;
  for (let i = 1; i <= 1000; i++) {
    const pose = attackPose(i / 1000, weapon);
    assert(Object.values(pose).every(Number.isFinite));
    assert(
      Math.abs(pose.x - prior.x) < 0.1 && Math.abs(pose.y - prior.y) < 0.1,
      'smooth bounded pose progression',
    );
    prior = pose;
  }
}
console.log(
  'PASS: six piece abilities, timed hits, cooldown/stamina, bishop diagonal and queen coverage, true L vault, king ward, interruptions, enemy telegraphs, authoritative PvP/serialization, round resets and continuous attack poses.',
);
