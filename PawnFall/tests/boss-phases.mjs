import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { bossDamageStage, bossCombatHint, bossPhaseLabel } from '../src/shared/boss-phases.mjs';
import { createBossDamageView } from '../src/client/boss-damage-view.mjs';
for (const chapter of [0, 1, 3]) {
  const g = new Game();
  g.reset(chapter);
  g.wave = 4;
  g.spawn();
  g.events = [];
  const e = g.enemies.find((e) => e.boss);
  e.hp = e.max * 0.76;
  assert.equal(bossDamageStage(e), 0);
  e.hp = e.max * 0.75;
  assert.equal(bossDamageStage(e), 1);
  e.hp = e.max * 0.5;
  g.update(0.02, { skipProgression: true });
  assert.equal(e.phase, 2);
  assert.equal(e.phaseAt, g.time);
  assert.equal(bossDamageStage(e), 2);
  assert.equal(g.events.filter((ev) => ev.type === 'bossPhase').length, 1);
  const until = e.until;
  g.update(0.02, { skipProgression: true });
  assert.equal(e.until, until, 'phase cannot restart');
  const view = createBossDamageView(THREE),
    root = new THREE.Group(),
    body = new THREE.Group(),
    arm = new THREE.Group();
  root.add(body);
  body.add(arm);
  const material = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const piece = (parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
    parent.add(m);
    return m;
  };
  const original = Array.from({ length: 4 }, () => piece(arm));
  arm.userData.original = original;
  arm.userData.parts = original;
  const crown = new THREE.Group();
  body.add(crown);
  Array.from({ length: 6 }, () => piece(crown));
  body.userData.royalCrown = crown;
  root.userData = {
    body,
    arm,
    armorPlates: [piece(body), piece(body)],
    staffCrystal: piece(body),
    staffGlow: piece(body),
  };
  view.update(e, root, e.phaseAt + 0.3);
  assert(root.userData.battleDamage.broken.visible);
  assert(root.userData.battleDamage.fragments.some((m) => m.visible));
  if (e.boss === 'castellan') assert(!root.userData.armorPlates[0].visible);
  if (e.boss === 'confessor') assert(!root.userData.staffCrystal.visible);
  if (e.boss === 'fallenking') {
    assert(!original[2].visible);
    assert(!crown.children[1].visible);
  }
  let count = 0;
  root.traverse(() => count++);
  for (let i = 0; i < 500; i++) view.update(e, root, e.phaseAt + 3 + i * 0.02);
  let after = 0;
  root.traverse((o) => {
    after++;
    assert(o.position.toArray().every(Number.isFinite));
    assert(o.scale.toArray().every(Number.isFinite));
  });
  assert.equal(after, count, 'damage does not allocate new fragments every frame');
  assert(
    root.userData.battleDamage.fragments.every((m) => !m.visible),
    'late snapshots do not replay shattering',
  );
  e.hp = e.max * 0.25;
  assert.equal(bossDamageStage(e), 3);
  view.update(e, root, e.phaseAt + 20);
  assert(bossPhaseLabel(e));
  // A fresh fight restores only the pieces owned by the effect.
  e.phase = 1;
  e.hp = e.max;
  view.update(e, root, 0);
  assert(!root.userData.battleDamage.broken.visible);
  assert(original.every((m) => m.visible));
  assert(crown.children.every((m) => m.visible));
  assert.equal(material.color.getHex(), 0x777777, 'shared character materials are not recolored');
}
{
  const b = new Battle('coop');
  b.wave = 3;
  b.games[0].chapter = 3;
  b.games[0].wave = 3;
  b.games[0].spawn();
  b.connect();
  const boss = b.games[0].enemies.find((e) => e.boss);
  boss.hp = boss.max * 0.5;
  b.step(0.02);
  const restored = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  const e = restored.snapshot(1).enemies.find((e) => e.boss);
  assert.equal(e.phase, 2);
  assert.equal(e.phaseAt, boss.phaseAt);
  assert.equal(bossDamageStage(e), 2);
}
assert(
  bossCombatHint({ boss: 'confessor', phase: 2, attackKind: 'salvo' }).includes('SECOND VOLLEY'),
);
assert(
  bossCombatHint({ boss: 'fallenking', phase: 2, attackKind: 'doubleSweep' }).includes(
    'BOTH SWEEPS',
  ),
);
assert(
  bossCombatHint({ boss: 'castellan', phase: 2, state: 'windup', attackKind: 'hammer' }).includes(
    'DOUBLE',
  ),
);
console.log(
  'PASS: all three boss damage stages, one-time phase transitions, persistent co-op phase clocks, broken equipment/reset, bounded finite geometry, late-snapshot debris and phase-specific attack hints.',
);
