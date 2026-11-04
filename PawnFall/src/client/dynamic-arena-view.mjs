// A fixed pool of meshes keeps the arena changes inexpensive on phones.
export function createDynamicArenaView(THREE, scene) {
  const root = new THREE.Group();
  scene.add(root);
  const stone = new THREE.MeshStandardMaterial({ color: 0x635454, roughness: 0.9, metalness: 0.2 });
  const iron = new THREE.MeshStandardMaterial({
    color: 0x272b30,
    roughness: 0.45,
    metalness: 0.85,
  });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffc767 });
  const make = (geo, mat, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };
  const gates = [-4, 4].map((x) => {
    const group = new THREE.Group();
    group.position.set(x, 0, 1);
    root.add(group);
    for (let i = -2; i <= 2; i++) {
      const bar = make(new THREE.BoxGeometry(0.12, 2.8, 0.12), iron, group);
      bar.position.set(i * 0.4, 1.4, 0);
    }
    for (const y of [0.6, 2.1]) {
      const beam = make(new THREE.BoxGeometry(2.1, 0.16, 0.18), iron, group);
      beam.position.y = y;
    }
    return group;
  });
  const pillar = make(new THREE.CylinderGeometry(0.8, 1, 3.6, 8), stone);
  pillar.position.set(-4, 1, 1);
  const warnings = [-4, 4].map((x) => {
    const m = make(
      new THREE.RingGeometry(0.25, 1.85, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff773e,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.055, 1);
    return m;
  });
  const portal = new THREE.Group();
  root.add(portal);
  portal.position.set(8, 0.07, 7);
  const ring = make(new THREE.TorusGeometry(1.1, 0.08, 6, 32), gold, portal);
  ring.rotation.x = -Math.PI / 2;
  for (const x of [-0.95, 0.95]) {
    const p = make(new THREE.BoxGeometry(0.23, 2.5, 0.3), stone, portal);
    p.position.set(x, 1.25, 0);
  }
  const lintel = make(new THREE.BoxGeometry(2.3, 0.3, 0.4), stone, portal);
  lintel.position.y = 2.5;
  const glow = make(new THREE.RingGeometry(0.8, 1.05, 32), gold, portal);
  glow.position.y = 1.2;
  return {
    update(game) {
      const s = game.arenaShift,
        active = s?.phase === 'active';
      gates.forEach((g, i) => {
        g.visible = !!s && s.kind === 'gates';
        g.position.y = active ? Math.min(0, -2.9 + (game.time - s.fireAt) * 8) : -2.9;
      });
      pillar.visible = !!s && s.kind === 'collapse';
      if (pillar.visible) {
        const k = active ? Math.min(1, (game.time - s.fireAt) * 3) : 0;
        pillar.rotation.z = (-k * Math.PI) / 2;
        pillar.position.y = 1.8 - k * 0.8;
      }
      warnings.forEach((m, i) => {
        m.visible = !!s && s.phase === 'warning' && (s.kind === 'gates' || i === 0);
        m.material.opacity = 0.35 + 0.2 * Math.sin(game.time * 10);
      });
      portal.visible = !!game.secretPortal && !game.secretPortal.used;
      if (portal.visible) {
        glow.rotation.z = game.time * 0.6;
        ring.scale.setScalar(1 + 0.08 * Math.sin(game.time * 3));
      }
    },
  };
}
