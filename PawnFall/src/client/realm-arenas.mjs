import { addRealmScenery } from './realm-scenery.mjs';
export const hazardAngle = (axis) =>
  ({ z: Math.PI / 2, diagA: Math.PI / 4, diagB: -Math.PI / 4 })[axis] || 0;
// Each realm is assembled once; static details share instanced batches.

export function buildRealmArenas(THREE, scene) {
  const groups = [],
    obstacles = [];
  const make = (name) => {
    const root = new THREE.Group();
    root.name = name;
    root.visible = false;
    scene.add(root);
    groups.push(root);
    return root;
  };
  const material = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness });
  const stone = material('#8199ac'),
    ice = material('#add9e5', 0.2),
    bark = material('#354b39'),
    leaf = material('#42664a'),
    dark = material('#282032'),
    gold = material('#b99352', 0.4),
    violet = material('#745689', 0.1);
  const batch = (root, geo, mat, items) => {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length),
      o = new THREE.Object3D();
    items.forEach((p, i) => {
      o.position.set(p.x || 0, p.y || 0, p.z || 0);
      o.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      o.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.castShadow = false;
    root.add(mesh);
    return mesh;
  };
  const box = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(0.5, 0.6, 1, 8),
    cone = new THREE.ConeGeometry(0.7, 1, 8);
  const frost = make('realm-frost-cathedral'),
    pillars = [],
    tips = [],
    arches = [];
  for (const x of [-15, 15])
    for (const z of [-18, -12, -6, 0, 6, 12, 18]) {
      pillars.push({ x, y: 5, z, sx: 1.2, sy: 12, sz: 1.2 });
      tips.push({ x, y: 12, z, sx: 1.8, sy: 3, sz: 1.8 });
      obstacles.push({
        realm: 1,
        min: { x: x - 0.9, y: -1, z: z - 0.9 },
        max: { x: x + 0.9, y: 13.5, z: z + 0.9 },
      });
    }
  for (const z of [-20, 20])
    for (const x of [-12, -6, 0, 6, 12])
      for (const side of [-1, 1])
        arches.push({ x: x + side * 1.4, y: 8.5, z, sx: 0.55, sy: 5, sz: 0.8, rz: side * 0.58 });
  batch(frost, cylinder, stone, pillars);
  batch(frost, cone, ice, tips);
  batch(frost, box, ice, arches);
  batch(frost, box, stone, [
    { x: 0, y: -0.9, z: -18, sx: 31, sy: 0.5, sz: 10 },
    { x: 0, y: -0.9, z: 18, sx: 31, sy: 0.5, sz: 10 },
  ]);
  const verdant = make('realm-verdant-sanctuary'),
    trees = [],
    crowns = [],
    ruins = [],
    roots = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = Math.sin(a) * 18,
      z = Math.cos(a) * 18;
    trees.push({ x, y: 3, z, sx: 1.3, sy: 8, sz: 1.3, rz: Math.sin(i) * 0.12 });
    crowns.push({ x, y: 9, z, sx: 3.8, sy: 3, sz: 3.8 });
    roots.push({
      x: x * 0.78,
      y: -0.25,
      z: z * 0.78,
      sx: 1.3,
      sy: 1.5,
      sz: 1.3,
      rx: Math.PI / 2,
      ry: a,
    });
    ruins.push({
      x: x * 0.86,
      y: 1,
      z: z * 0.86,
      sx: 1.1,
      sy: 3.5,
      sz: 1.1,
      rz: Math.sin(i) * 0.2,
    });
    obstacles.push({
      realm: 2,
      min: { x: x - 1, y: -1, z: z - 1 },
      max: { x: x + 1, y: 9, z: z + 1 },
    });
  }
  batch(verdant, cylinder, bark, trees);
  batch(verdant, new THREE.IcosahedronGeometry(1, 1), leaf, crowns);
  batch(verdant, box, stone, ruins);
  batch(verdant, new THREE.TorusGeometry(1.6, 0.22, 6, 16), bark, roots);
  const eclipse = make('realm-eclipse-throne'),
    spires = [],
    obelisk = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    spires.push({
      x: Math.sin(a) * 24,
      y: 5,
      z: Math.cos(a) * 24,
      sx: 2,
      sy: 12 + (i % 3) * 3,
      sz: 2,
    });
  }
  for (const x of [-15, 15])
    for (const z of [-15, 15]) {
      obelisk.push({ x, y: 4, z, sx: 1.7, sy: 10, sz: 1.7 });
      obstacles.push({
        realm: 3,
        min: { x: x - 1, y: -1, z: z - 1 },
        max: { x: x + 1, y: 10, z: z + 1 },
      });
    }
  batch(eclipse, cone, dark, spires);
  batch(eclipse, box, violet, obelisk);
  batch(eclipse, box, dark, [
    { y: 0, z: -18, sx: 12, sy: 1, sz: 7 },
    { y: 2, z: -19, sx: 4, sy: 3, sz: 3 },
    { y: 5, z: -20, sx: 4, sy: 6, sz: 1 },
  ]);
  batch(eclipse, cone, gold, [
    { x: -2.8, y: 4, z: -19, sx: 0.8, sy: 7, sz: 0.8 },
    { x: 2.8, y: 4, z: -19, sx: 0.8, sy: 7, sz: 0.8 },
  ]);
  batch(eclipse, new THREE.TorusGeometry(4, 0.1, 6, 48), gold, [{ y: 10, z: -21, rx: 0 }]);
  addRealmScenery(THREE, { frost, verdant, eclipse }, batch, { stone, dark });
  return {
    groups,
    obstacles,
    set(realm) {
      groups.forEach((g, i) => (g.visible = realm === i + 1));
    },
  };
}

export function resolveArenaCamera(aim, desired, boxes = []) {
  let limit = 1;
  for (const box of boxes) {
    let enter = 0,
      exit = 1;
    for (const k of ['x', 'y', 'z']) {
      const delta = desired[k] - aim[k];
      if (Math.abs(delta) < 1e-8) {
        if (aim[k] < box.min[k] || aim[k] > box.max[k]) {
          enter = 2;
          break;
        }
      } else {
        const a = (box.min[k] - aim[k]) / delta,
          b = (box.max[k] - aim[k]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (enter > 0 && enter <= exit && enter < limit) limit = Math.max(0.15, enter - 0.08);
  }
  return {
    x: aim.x + (desired.x - aim.x) * limit,
    y: aim.y + (desired.y - aim.y) * limit,
    z: aim.z + (desired.z - aim.z) * limit,
  };
}
