// Persistent objective meshes: no per-frame geometry allocation or extra lights.
export function createArenaObjectiveView(THREE, scene, createActor) {
  const root = new THREE.Group();
  root.name = 'arena-objective-markers';
  scene.add(root);
  const gold = new THREE.MeshStandardMaterial({
    color: '#cba65b',
    metalness: 0.75,
    roughness: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#29232b', roughness: 0.7 });
  const blood = new THREE.MeshStandardMaterial({
    color: '#8c2739',
    emissive: '#4d0715',
    emissiveIntensity: 0.6,
    roughness: 0.45,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#f2ce78',
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    parent.add(mesh);
    return mesh;
  };
  const ring = (parent, outer, mat) => {
    const m = add(parent, new THREE.RingGeometry(outer - 0.09, outer, 48), mat, 0, 0.045, 0);
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  const throne = new THREE.Group();
  throne.name = 'contested-throne';
  root.add(throne);
  const captureRing = ring(throne, 2.8, ringMat.clone());
  add(throne, new THREE.BoxGeometry(1.5, 0.18, 1.4), dark, 0, 0.1, 0);
  add(throne, new THREE.BoxGeometry(1.1, 0.65, 0.75), dark, 0, 0.5, 0.25);
  add(throne, new THREE.BoxGeometry(1.35, 1.9, 0.22), dark, 0, 1, 0.72);
  add(throne, new THREE.BoxGeometry(1.5, 0.12, 0.28), gold, 0, 1.95, 0.72);
  for (const x of [-0.6, 0.6]) {
    add(throne, new THREE.BoxGeometry(0.14, 0.9, 0.95), gold, x, 0.7, 0.2);
    add(throne, new THREE.ConeGeometry(0.17, 0.45, 4), gold, x, 2.2, 0.72);
  }
  const flag = add(throne, new THREE.OctahedronGeometry(0.22), gold, 0, 2.8, 0.72);
  const sigils = Array.from({ length: 3 }, (_, i) => {
    const group = new THREE.Group();
    group.name = 'ritual-sigil-' + i;
    root.add(group);
    const circle = ring(group, 1.8, ringMat.clone());
    circle.material.color.set('#ee5565');
    add(group, new THREE.CylinderGeometry(0.65, 0.8, 0.22, 6), dark, 0, 0.13, 0);
    const crystal = add(group, new THREE.OctahedronGeometry(0.38), blood, 0, 0.95, 0);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      add(
        group,
        new THREE.BoxGeometry(0.12, 0.28, 0.25),
        gold,
        Math.sin(a) * 0.95,
        0.18,
        Math.cos(a) * 0.95,
      );
    }
    return { group, circle, crystal };
  });
  const king = createActor('king', true);
  king.name = 'wounded-objective-king';
  root.add(king);
  king.userData.crown.visible = true;
  king.userData.body.rotation.x = 0.14;
  king.userData.body.rotation.z = 0.09;
  const kingRing = ring(king, 1.2, ringMat.clone());
  return {
    root,
    update(game) {
      const a = game.arenaObjective;
      root.visible =
        !!a &&
        !game.training &&
        (game.mode === 'playing' || ['route', 'upgrade', 'promotion'].includes(game.mode));
      throne.visible = a?.kind === 'capture';
      king.visible = a?.kind === 'defend';
      if (throne.visible) {
        throne.position.set(a.x, 0, a.z);
        captureRing.material.color.set(
          a.complete ? '#acd6a0' : a.contested ? '#ef626b' : '#f2ce78',
        );
        captureRing.material.opacity = a.complete ? 0.35 : 0.7;
        flag.rotation.y = game.time * 0.65;
      }
      for (let i = 0; i < sigils.length; i++) {
        const v = sigils[i],
          s = a?.sigils?.[i];
        v.group.visible = a?.kind === 'ritual' && !!s;
        if (!v.group.visible) continue;
        v.group.position.set(s.x, 0, s.z);
        v.crystal.visible = !s.broken;
        v.crystal.rotation.y = game.time * 0.7;
        v.crystal.position.y = 0.95 + Math.sin(game.time * 2 + i) * 0.08;
        v.circle.material.color.set(s.broken ? '#a6cfa1' : s.progress > 0 ? '#f5d284' : '#ee5565');
        v.circle.material.opacity = s.broken ? 0.3 : 0.65;
        v.circle.scale.setScalar(1 + (s.progress || 0) * 0.035);
      }
      if (king.visible) {
        king.position.set(a.king.x, 0, a.king.z);
        king.rotation.y = a.king.face;
        king.userData.body.rotation.z = a.failed
          ? -1.2
          : 0.09 + (game.time - a.king.hitAt < 0.25 ? 0.15 : 0);
        kingRing.material.color.set(
          a.complete ? '#a6cfa1' : a.king.hp < 60 ? '#ef626b' : '#f2ce78',
        );
      }
    },
  };
}
