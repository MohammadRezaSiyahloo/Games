import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { createWeaponRig } from '../src/client/weapon-rig.mjs';
import {
  weaponStance,
  heavyBodyPose,
  reactionPose,
  finisherPose,
} from '../src/client/combat-motion.mjs';
import { attackPose, heavyAttackPose } from '../src/client/attack-animation.mjs';
import { weaponById, HEAVY_ATTACKS } from '../src/shared/arsenal.mjs';
const material = new THREE.MeshStandardMaterial(),
  materials = { steel: material, leather: material };
for (const weapon of ['longsword', 'rapier', 'warhammer']) {
  const body = new THREE.Group(),
    arm = new THREE.Group(),
    shield = new THREE.Group();
  arm.position.set(0.57, 1.08, 0);
  shield.position.set(-0.6, 1, 0.42);
  body.add(arm, shield);
  const rig = createWeaponRig(THREE, body, arm, shield, materials);
  assert.equal(rig.right.parent, arm, 'primary hand is rigidly attached to the weapon grip');
  assert.equal(rig.left.parent, body);
  assert.equal(rig.batches.length, 2, 'arm and joint draw calls are batched');
  for (const heavy of [false, true])
    for (let i = 0; i <= 300; i++) {
      const k = i / 300,
        pose = heavy ? heavyAttackPose(k, weapon) : attackPose(k, weapon);
      arm.position.copy(rig.rest.arm);
      arm.position.z = pose.reach;
      arm.rotation.set(pose.x, pose.y, pose.z);
      shield.position.copy(rig.rest.shield);
      shield.rotation.set(0, -0.18, 0);
      const bodyPose = heavy ? heavyBodyPose(k, weapon) : null;
      rig.update(weapon, bodyPose?.support ?? weaponStance(weapon).support, 1 / 60);
      body.updateMatrixWorld(true);
      const grip = new THREE.Vector3(0, 0.11, 0).applyMatrix4(arm.matrixWorld),
        hand = new THREE.Vector3();
      rig.right.getWorldPosition(hand);
      assert(grip.distanceTo(hand) < 1e-8, 'weapon hand never separates from grip during a swing');
      for (const object of [...rig.links, ...rig.joints, rig.left]) {
        assert(object.position.toArray().every(Number.isFinite));
        assert(object.quaternion.toArray().every(Number.isFinite));
      }
      for (const batch of rig.batches)
        for (let n = 0; n < batch.count; n++) {
          const m = new THREE.Matrix4();
          batch.getMatrixAt(n, m);
          assert(m.elements.every(Number.isFinite));
        }
    }
  if (weapon === 'warhammer') {
    for (let i = 0; i < 120; i++) {
      shield.position.copy(rig.rest.shield);
      rig.update(weapon, 1, 1 / 60);
    }
    const target = new THREE.Vector3(0, 0.58, 0).applyMatrix4(arm.matrix);
    assert(target.distanceTo(rig.left.position) < 0.001, 'second hand follows the hammer shaft');
    assert(shield.position.z < -0.4, 'shield is stowed behind the body for two-handed stance');
  }
}
for (const [kind, fn] of [
  ['light', attackPose],
  ['heavy', heavyAttackPose],
]) {
  const weapon = kind === 'heavy' ? HEAVY_ATTACKS.rapier : weaponById('rapier');
  const pose = fn(weapon.hitAt / weapon.duration, 'rapier');
  const tip = new THREE.Vector3(0, 1.8, 0).applyEuler(new THREE.Euler(pose.x, pose.y, pose.z));
  assert(tip.z > 1.4, 'rapier thrust points forward at the authoritative contact phase');
}
for (const weapon of ['longsword', 'rapier', 'warhammer']) {
  const a = heavyBodyPose(0, weapon),
    b = heavyBodyPose(1, weapon);
  for (const key of ['lean', 'twist', 'roll', 'compress'])
    assert(Math.abs(a[key] - b[key]) < 1e-9, 'body returns to stance');
  let prior = heavyBodyPose(0, weapon);
  for (let i = 1; i <= 1000; i++) {
    const p = heavyBodyPose(i / 1000, weapon);
    assert(Object.values(p).every(Number.isFinite));
    assert(Math.abs(p.lean - prior.lean) < 0.04);
    prior = p;
  }
}
assert(weaponStance('rapier').armX > 1);
assert.equal(weaponStance('warhammer').support, 1);
assert.notDeepEqual(heavyBodyPose(0.5, 'rapier'), heavyBodyPose(0.5, 'warhammer'));
assert(reactionPose('block', 0.1).shieldBack > 0);
assert(reactionPose('parry', 0.1).shieldTurn < 0);
assert(reactionPose('stagger', 0.2).slump > 0);
for (const kind of ['block', 'parry', 'stagger']) {
  assert(reactionPose(kind, 2).done);
  assert.equal(reactionPose(kind, 0).pulse, 0);
}
assert(finisherPose('team', 1).done);
assert(finisherPose('solo', 0.2).reach > 0);
console.log(
  'PASS: stable gauntlet grips, batched articulated arms, two-hand hammer support, shield stowing, forward-facing rapier contact, weapon stances, full-body heavies, shield recoil, parry deflection and finishing-pose recovery.',
);
