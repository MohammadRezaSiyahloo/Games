import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { buildKnightHead, buildColiseum } from '../src/client/arena-models.mjs';
import { Game } from '../src/shared/combat.mjs';
const material = new THREE.MeshStandardMaterial({ color: '#cccccc' });
const body = new THREE.Group();
const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const knight = buildKnightHead(
  THREE,
  body,
  { stone: material, metal: material, gold: material, eye: material },
  mesh,
);
assert.equal(knight.name, 'sculpted-knight-head');
assert.equal(knight.children.filter((c) => c.name === 'ear').length, 2);
assert(
  knight.getObjectByName('forward-muzzle').position.z > 0.5,
  'muzzle faces the actor forward axis',
);
const size = new THREE.Box3().setFromObject(knight).getSize(new THREE.Vector3());
assert(size.x > 0.5 && size.z > 1, 'head has real volume');
assert(size.y < 2.2, 'head proportions stay within the piece silhouette');
knight.traverse((o) => {
  if (o.isMesh) {
    assert.notEqual(o.geometry.type, 'ExtrudeGeometry');
    assert(Array.from(o.geometry.attributes.normal.array).every(Number.isFinite));
  }
});
const scene = new THREE.Scene();
const arena = buildColiseum(THREE, scene, (parent, color, size, x, y, z) => {
  const s = new THREE.Object3D();
  s.position.set(x, y, z);
  parent.add(s);
  return s;
});
assert.equal(arena.name, 'ruined-coliseum');
assert(arena.userData.instances > 1000);
assert(arena.userData.batches <= 8, 'static decoration remains batched');
for (const name of [
  'vaulted-arches',
  'roman-columns',
  'tier-cornices',
  'iron-pit-fence',
  'fallen-masonry',
  'old-blood-stains',
])
  assert(arena.getObjectByName(name));
let meshes = 0;
arena.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    assert.equal(o.castShadow, false, 'distant scenery does not add shadow draw calls');
    assert(o.position.toArray().every(Number.isFinite));
    if (o.isInstancedMesh) assert(Array.from(o.instanceMatrix.array).every(Number.isFinite));
  }
});
assert(meshes < 130, 'detailed arena has a bounded static draw-call budget');
const g = new Game();
g.reset();
g.player.x = 0;
g.player.z = 0;
g.player.face = Math.PI / 2;
g.player.block = true;
g.hurtPlayer(20, { x: 2, z: 0, state: 'attack' });
const block = g.events.find((e) => e.type === 'block');
assert(
  block && block.x > 0 && block.nx === 1,
  'shield sparks have a contact position and outward normal',
);
g.time = 1;
g.player.block = false;
g.player.invuln = 0;
g.hurtPlayer(20, { x: 2, z: 0, state: 'attack' });
assert(g.events.some((e) => e.type === 'steelImpact' && e.strength > 0));
console.log(
  'PASS: volumetric forward-facing knight, finite geometry/normals, coliseum arches/gates/blood, 1000+ batched details, static draw-call budget, and metal contact events.',
);
