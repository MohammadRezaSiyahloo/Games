import { Progression } from '../src/client/progression.mjs';
import assert from 'node:assert/strict';
import { Game, stats } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { offerPromotion } from '../src/shared/promotion.mjs';
import { captureCheckpoint, restoreCheckpoint } from '../src/shared/checkpoints.mjs';
import { configureTraining } from '../src/shared/training.mjs';
import {
  createArenaObjective,
  updateArenaObjective,
  encounterComplete,
  rewardArenaObjective,
  combatTargets,
} from '../src/shared/arena-objectives.mjs';
import { updateEnemy } from '../src/shared/enemy-ai.mjs';
import * as THREE from '../public/vendor/three.module.js';
import { createArenaObjectiveView } from '../src/client/arena-objective-view.mjs';

function gameAt(wave = 1, chapter = 0) {
  const g = new Game();
  g.reset(chapter);
  g.wave = wave;
  g.spawn();
  return g;
}

function tickGoal(g, seconds, input = {}) {
  for (let t = 0; t < seconds; t += 0.02) {
    g.time += 0.02;
    updateArenaObjective(g, 0.02, input);
  }
}

function clearCards(g) {
  while (g.upgradeChoices.length) g.chooseUpgrade(g.upgradeChoices[0]);
}
for (const piece of ['knight', 'bishop', 'rook', 'queen', 'pawn']) {
  const g = gameAt(2);
  g.weapon = 'rapier';
  g.player.weapon = 'rapier';
  g.upgrades.force = 2;
  g.abilityReadyAt = 999;
  g.time = 15;
  g.offerUpgrades();
  clearCards(g);
  assert.equal(g.mode, 'promotion');
  assert.equal(g.promotionChoices.length, 5);
  const t = g.time;
  g.update(0.05, { x: 1 });
  assert.equal(g.time, t);
  assert(!g.attack());
  assert(!g.choosePromotion('king'));
  assert(g.choosePromotion(piece));
  if (g.eventChoices.length) assert(g.chooseEvent('decline'));
  assert(!g.choosePromotion(piece));
  assert.equal(g.chessClass, piece);
  assert.equal(g.player.type, piece);
  assert.equal(g.weapon, 'rapier');
  assert.equal(g.upgrades.force, 2);
  assert.equal(g.mode, 'playing');
  assert.equal(g.abilityReadyAt, g.time);
  assert(g.promotionResolved);
  assert(!offerPromotion(g));
  const h = new Game();
  assert(restoreCheckpoint(h, JSON.parse(JSON.stringify(captureCheckpoint(g)))));
  assert.equal(h.player.type, piece);
  assert(h.promotionResolved);
  assert(!offerPromotion(h));
}
{
  const g = gameAt(1);
  g.offerUpgrades();
  clearCards(g);
  if (g.eventChoices.length) assert(g.chooseEvent('decline'));
  assert.equal(g.mode, 'playing');
  assert(!g.promotionResolved);
}
for (const kind of ['knight', 'bishop', 'rook', 'queen', 'king']) {
  const g = gameAt(2);
  g.chessClass = kind;
  assert(!offerPromotion(g));
}
{
  const g = gameAt(2);
  g.bossTrial = true;
  assert(!offerPromotion(g));
}
{
  const g = gameAt(2);
  configureTraining(g, stats, { enemy: 'rook' });
  assert(!g.arenaObjective);
  assert(!offerPromotion(g));
}
// Capture requires a living player and uncontested presence. Killing enemies alone is insufficient.
{
  const g = gameAt(1);
  const a = g.arenaObjective;
  assert.equal(a.kind, 'capture');
  g.player.x = a.x;
  g.player.z = a.z;
  g.enemies.forEach((e, i) => {
    e.x = 8;
    e.z = -8 + i;
  });
  g.enemies[0].x = 0;
  g.enemies[0].z = -1;
  tickGoal(g, 2);
  assert.equal(a.progress, 0);
  assert(a.contested);
  g.enemies.forEach((e) => (e.dead = true));
  assert(!encounterComplete(g));
  g.player.x = 9;
  tickGoal(g, 2);
  assert.equal(a.progress, 0);
  g.player.x = a.x;
  g.hp = 0;
  tickGoal(g, 2);
  assert.equal(a.progress, 0);
  g.hp = 100;
  tickGoal(g, 8.1);
  assert(a.complete);
  assert(encounterComplete(g));
  const souls = g.souls;
  assert(rewardArenaObjective(g));
  assert.equal(g.souls, souls + 150);
  assert(!rewardArenaObjective(g));
  const h = new Game();
  assert(restoreCheckpoint(h, captureCheckpoint(g)));
  assert.equal(h.arenaObjective.progress, 0);
  assert(!h.arenaObjective.paid);
}
// Ritual channels reset on release, movement, guarding and damage. Completed sigils stay broken.
{
  const g = gameAt(2),
    a = g.arenaObjective;
  assert.equal(a.kind, 'ritual');
  g.enemies.forEach((e) => (e.dead = true));
  Object.assign(g.player, { x: -6, z: 0, state: 'idle', speed: 0 });
  tickGoal(g, 1, { revive: true });
  assert(a.sigils[0].progress > 0.9);
  tickGoal(g, 0.1);
  assert.equal(a.sigils[0].progress, 0);
  g.player.speed = 1;
  tickGoal(g, 1, { revive: true });
  assert.equal(a.sigils[0].progress, 0);
  g.player.speed = 0;
  g.player.block = true;
  tickGoal(g, 1, { revive: true });
  assert.equal(a.sigils[0].progress, 0);
  g.player.block = false;
  g.player.hitAt = g.time;
  tickGoal(g, 0.3, { revive: true });
  assert.equal(a.sigils[0].progress, 0);
  tickGoal(g, 2.5, { revive: true });
  assert(a.sigils[0].broken);
  assert.equal(a.progress, 1);
  for (const s of a.sigils.slice(1)) {
    Object.assign(g.player, { x: s.x, z: s.z });
    tickGoal(g, 2.1, { revive: true });
  }
  assert(a.complete);
  assert(encounterComplete(g));
  assert.equal(g.events.filter((e) => e.type === 'sigilBroken').length, 3);
}
// The defended king is a real AI/ability/projectile target. Losing him cannot award a clear.
{
  const g = gameAt(3),
    a = g.arenaObjective;
  assert.equal(a.kind, 'defend');
  g.player.x = 10;
  g.player.z = 10;
  const e = g.enemies[0];
  Object.assign(e, { x: 0, z: 2, state: 'approach', cooldown: 0 });
  updateEnemy(g, e, 0.02, stats);
  assert.equal(e.targetId, 'objectiveKing');
  assert(combatTargets(g).includes(a.king));
  const hp = g.hp;
  g.hurtTarget(40, e, a.king);
  assert.equal(g.hp, hp);
  assert.equal(a.king.hp, 140);
  g.time += 0.5;
  g.hurtTarget(1000, e, a.king);
  assert(a.failed);
  assert(!encounterComplete(g));
  assert(!rewardArenaObjective(g));
  g.update(0.02);
  assert.equal(g.mode, 'dead');
  assert.equal(g.deathRecap.attack, 'The king has fallen');
}
{
  const g = gameAt(3),
    a = g.arenaObjective;
  g.enemies.forEach((e) => {
    e.cooldown = 999;
  });
  tickGoal(g, 18.1);
  assert(a.complete);
  assert(!combatTargets(g).includes(a.king));
  assert(!encounterComplete(g));
  g.enemies.forEach((e) => (e.dead = true));
  assert(encounterComplete(g));
}
// No forced objectives in bosses, sparring or the solo opening.
assert.equal(new Game().arenaObjective, null);
for (const chapter of [0, 1]) assert.equal(gameAt(4, chapter).arenaObjective, null);
// Co-op channels share progress and don't double tick; downed seats cannot channel.
{
  let b = new Battle('coop');
  assert.equal(b.games[0].arenaObjective.kind, 'defend');
  b.games[0].wave = b.games[1].wave = 1;
  b.games[0].chapter = b.games[1].chapter = 1;
  b.games[0].spawn();
  b.connect();
  const a = b.games[0].arenaObjective;
  assert.equal(a.kind, 'ritual');
  b.games[0].enemies.forEach((e) => (e.cooldown = 999));
  for (const g of b.games) {
    g.player.x = -6;
    g.player.z = 0;
    g.player.hitAt = -10;
    g.player.invuln = 999;
  }
  b.setInput(0, { revive: true });
  b.setInput(1, { revive: true });
  for (let i = 0; i < 50; i++) b.step(0.02);
  assert(
    a.sigils[0].progress > 0.9 && a.sigils[0].progress < 1.1,
    'shared channel progresses once, not per seat',
  );
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert.equal(b.games[0].arenaObjective, b.games[1].arenaObjective);
  assert(b.snapshot(1).arenaObjective.sigils[0].progress > 0.9);
  for (let i = 0; i < 55; i++) b.step(0.02);
  assert(b.games[0].arenaObjective.sigils[0].broken);
  b.games[1].hp = 0;
  b.games[0].player.x = 6;
  b.games[1].player.x = 0;
  for (let i = 0; i < 110; i++) b.step(0.02);
  assert(b.games[0].arenaObjective.sigils[1].broken);
}
// Mixed co-op promotion choices persist; action replays and early combat are rejected.
{
  let b = new Battle('coop');
  b.games.forEach((g) => {
    g.wave = 2;
    g.offerUpgrades();
    clearCards(g);
  });
  const t = b.time;
  assert(b.games.every((g) => g.mode === 'promotion'));
  b.setInput(0, { actions: [{ n: 1, kind: 'promote:queen' }] });
  b.setInput(1, { actions: [{ n: 1, kind: 'attack' }] });
  b.step(0.02);
  assert.equal(b.games[0].chessClass, 'queen');
  assert.equal(b.games[1].chessClass, 'pawn');
  assert.equal(b.time, t);
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  b.step(0.02);
  assert.equal(b.games[0].chessClass, 'queen');
  b.setInput(1, { actions: [{ n: 2, kind: 'promote:bishop' }] });
  b.step(0.02);
  assert.equal(b.time, t);
  b.games.forEach((g) => {
    if (g.eventChoices.length) g.chooseEvent('decline');
  });
  b.step(0.02);
  assert(b.time > t);
  assert(b.snapshot(0).players[1].promotionResolved);
  assert.equal(b.snapshot(0).players[1].type, 'bishop');
  const v = new Battle('versus');
  v.setInput(0, { actions: [{ n: 1, kind: 'promote:queen' }] });
  v.step(0.02);
  assert.equal(v.games[0].chessClass, 'pawn');
  assert.equal(v.snapshot(0).arenaObjective, null);
}
// Reusable world markers remain finite across each objective and hide outside combat.
{
  const scene = new THREE.Scene();
  const view = createArenaObjectiveView(THREE, scene, () => {
    const g = new THREE.Group();
    g.userData = { crown: new THREE.Object3D(), body: new THREE.Group() };
    return g;
  });
  for (const wave of [1, 2, 3]) {
    const g = gameAt(wave);
    view.update(g);
    assert(view.root.visible);
    scene.traverse((o) => {
      assert(o.position.toArray().every(Number.isFinite));
      assert(o.scale.toArray().every(Number.isFinite));
      if (o.geometry) assert([...o.geometry.attributes.position.array].every(Number.isFinite));
    });
  }
  const g = gameAt(3);
  g.mode = 'dead';
  view.update(g);
  assert(!view.root.visible);
}
console.log(
  'PASS: promotion eligibility/choices/cooldown/checkpoints, capture contesting, interruptible rituals, protected king AI/damage/failure, co-op authority/restore/barriers, PvP/training isolation and finite objective models.',
);

{
  const b = new Battle('coop');
  const a = b.games[0].arenaObjective;
  b.games[0].hurtTarget(1000, { type: 'rook' }, a.king);
  b.step(0.02);
  assert.equal(b.status, 'ended');
  assert.equal(b.reason, 'kingFallen');
  assert.equal(b.winner, null);
  assert(b.snapshot(1).players.every((p) => p.deathRecap.attack === 'The king has fallen'));
  const career = new Progression();
  const souls = career.data.stats.souls;
  career.event({ type: 'arenaObjectiveReward', reward: 150 }, 'ashen');
  assert.equal(career.data.stats.souls, souls + 150);
  console.log(
    'PASS: king loss ends the co-op match with a shared recap; objective rewards count toward career souls.',
  );
}
