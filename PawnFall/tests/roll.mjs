import assert from 'node:assert/strict';
import { rollPose } from '../src/client/roll-animation.mjs';
import * as THREE from '../public/vendor/three.module.js';
for (const direction of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  let prior = rollPose(0, direction);
  for (let i = 1; i <= 1000; i++) {
    const p = rollPose(i / 1000, direction);
    assert(Object.values(p).every(Number.isFinite));
    assert(p.angle >= prior.angle && p.angle - prior.angle < 0.015, 'continuous complete rotation');
    assert(p.scale >= 0.72 && p.scale <= 1);
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(p.axisX, 0, p.axisZ),
      p.angle,
    );
    for (const center of [0.95, 1.2, 1.4, 1.1, 1.65, 1.9]) {
      const offset = new THREE.Vector3(0, center * p.scale, 0).applyQuaternion(q);
      const base = new THREE.Vector3(-offset.x, center * p.scale + p.lift - offset.y, -offset.z);
      const pivot = new THREE.Vector3(0, center * p.scale, 0).applyQuaternion(q).add(base);
      assert(
        Math.abs(pivot.x) < 1e-9 && Math.abs(pivot.z) < 1e-9,
        'body rotates around its center',
      );
      assert(pivot.y >= center * 0.72, 'pivot stays above the board');
    }
    prior = p;
  }
  const start = rollPose(0, direction),
    end = rollPose(1, direction);
  assert.equal(start.angle, 0);
  assert.equal(end.angle, Math.PI * 2);
  for (const key of ['scale', 'lift', 'armX', 'armZ', 'shieldY', 'shieldZ'])
    assert(Math.abs(start[key] - end[key]) < 1e-9, 'returns to ready pose');
}
assert.equal(rollPose(0.01).angle, 0, 'brief takeoff before rotation');
assert.equal(rollPose(0.99).angle, Math.PI * 2, 'rotation settles before recovery');
assert(rollPose(0.5).axisX > 0, 'forward dodge rolls forward');
console.log(
  'PASS: directional centered roll, complete eased revolution, tuck, finite transforms for all six pieces and seamless ready-pose endpoints.',
);
