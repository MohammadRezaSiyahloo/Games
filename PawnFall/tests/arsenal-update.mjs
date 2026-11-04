import assert from 'node:assert/strict';
import { Game, stats } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { HEAVY_ATTACKS } from '../src/shared/arsenal.mjs';
import { configureTraining } from '../src/shared/training.mjs';
import { heavyAttackPose, fallenPose } from '../src/client/attack-animation.mjs';
import { LocalActionPresentation } from '../src/client/local-action-presentation.mjs';
import { Preferences } from '../src/client/preferences.mjs';

function fight(weapon = 'longsword') {
  const g = new Game();
  g.weapon = weapon;
  g.reset();
  configureTraining(g, stats, { enemy: 'rook', behavior: 'guard', unlimited: false });
  g.training = null;
  g.player.x = 0;
  g.player.z = 2;
  g.player.face = Math.PI;
  g.enemies[0].face = 0;
  g.enemies[0].guarding = true;
  g.enemies[0].hp = g.enemies[0].max = 500;
  return g;
}
for (const [weapon, w] of Object.entries(HEAVY_ATTACKS)) {
  const g = fight(weapon),
    p = g.player,
    e = g.enemies[0],
    z = p.z;
  assert(g.heavyAttack());
  assert.equal(g.stamina, 100 - w.cost);
  assert(!g.attack());
  const original = e.hp;
  for (let t = 0; t < w.hitAt - 0.04; t += 0.01)
    g.update(0.01, { skipAI: true, skipProgression: true });
  assert.equal(e.hp, original, 'heavy respects windup');
  for (let i = 0; i < 10; i++) g.update(0.01, { skipAI: true, skipProgression: true });
  assert.equal(e.hp, original - w.damage, 'heavy bypasses frontal guard');
  assert(e.hitStrength > 0.2);
  assert(e.poise > 0 || e.state === 'stagger');
  if (weapon === 'rapier') assert(p.z > z + 0.8, 'rapier retreats opposite its facing');
  for (let i = 0; i < 140; i++) g.update(0.01, { skipAI: true, skipProgression: true });
  assert.equal(p.state, 'idle');
  const start = heavyAttackPose(0, weapon),
    end = heavyAttackPose(1, weapon);
  for (const key of Object.keys(start))
    assert(Math.abs(start[key] - end[key]) < 1e-9, 'heavy pose recovers to ready');
  let prior = start;
  for (let i = 1; i <= 1000; i++) {
    const pose = heavyAttackPose(i / 1000, weapon);
    assert(Object.values(pose).every(Number.isFinite));
    assert(Math.abs(pose.y - prior.y) < 0.1);
    prior = pose;
  }
  const low = fight(weapon);
  low.stamina = w.cost - 1;
  assert(!low.heavyAttack());
  assert.equal(low.player.state, 'idle');
}
{
  const g = fight();
  g.hp = 12;
  g.player.invuln = 0;
  g.hurtPlayer(30, { type: 'knight', x: 0, z: 1, state: 'attack' });
  assert.equal(g.deathRecap.source, 'Knight');
  assert.equal(g.deathRecap.damage, 12);
  assert(g.deathRecap.tip.includes('sideways'));
  assert(g.player.dead);
  const b = new Battle('versus', [{}, {}]);
  b.setInput(0, { actions: [{ kind: 'heavy', n: 1 }] });
  b.step(0.02);
  assert.equal(b.games[0].player.attackKind, 'heavy');
  const saved = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert.equal(saved.games[0].player.attackKind, 'heavy');
  b.games[1].player.invuln = 0;
  b.games[1].hp = 2;
  b.games[1].hurtPlayer(50, b.games[0].player);
  assert.equal(b.snapshot(1).players[1].deathRecap.source, 'Rival');
  assert.equal(b.snapshot(1).players[1].deathRecap.attack, 'Heavy attack');
}
{
  const g = new Game();
  g.runModifier = 'scarce';
  g.reset();
  assert.equal(g.flasks, 1);
  g.runModifier = 'patrol';
  g.reset();
  assert.equal(g.enemies.length, 4);
  assert(g.enemies.at(-1).elite);
  g.wave = 4;
  g.spawn();
  assert.equal(g.enemies.length, 1, 'patrol does not add an enemy to boss fights');
  const a = fight(),
    b = fight();
  a.runModifier = 'relentless';
  a.enemies[0].cooldown = 99;
  b.enemies[0].cooldown = 99;
  a.player.z = b.player.z = 8;
  const before = a.enemies[0].z;
  a.update(0.02, { skipProgression: true });
  b.update(0.02, { skipProgression: true });
  assert(
    a.enemies[0].z - before > b.enemies[0].z - before,
    'relentless speeds up regular movement',
  );
}
{
  const local = new LocalActionPresentation();
  const p = { hp: 100, stamina: 100, state: 'idle', weapon: 'warhammer', attackAt: -10, face: 0 };
  local.begin('heavy', 1, p, 0, 0);
  const pose = local.sample(p, 100, {}, 0.1);
  assert.equal(pose.state, 'attack');
  assert.equal(pose.attackKind, 'heavy');
  assert.equal(pose.attackDuration, 1.25);
  assert(pose.visualAttackPhase > 0);
  const loaded = new Preferences({
    getItem() {
      return JSON.stringify({ bindings: { j: 'KeyH' } });
    },
    setItem() {},
  });
  assert.equal(loaded.data.bindings.j, 'KeyH');
  assert.notEqual(
    loaded.data.bindings.h,
    'KeyH',
    'new heavy binding preserves an older custom layout',
  );
  for (const type of Object.keys(stats)) {
    assert(Math.abs(fallenPose(0, type).roll) < 1e-9);
    const pose = fallenPose(1, type);
    assert.equal(pose.roll, -Math.PI / 2);
    assert(pose.lift > 0.6);
  }
}
console.log(
  'PASS: weapon-specific heavies, stamina/windup/guard bypass, rapier retreat, finite continuous poses, death records, authoritative heavy actions, run modifiers, local anticipation, binding migration and fallen poses.',
);
