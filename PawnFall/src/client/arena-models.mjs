// Procedural, closed 3D forms; no paper-thin horse silhouette or external model load.
export function buildKnightHead(THREE, body, { stone, metal, gold, eye }, mesh) {
  const head = new THREE.Group();
  head.name = 'sculpted-knight-head';
  body.add(head);
  const ellipsoid = (x, y, z, sx, sy, sz, material = stone) => {
    const m = mesh(new THREE.SphereGeometry(1, 20, 14), material, head, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const neck = ellipsoid(0, 1.62, -0.02, 0.34, 0.67, 0.32);
  neck.rotation.x = -0.18;
  ellipsoid(0, 2.22, 0.17, 0.34, 0.43, 0.39);
  const muzzle = ellipsoid(0, 2.02, 0.57, 0.27, 0.23, 0.38);
  muzzle.name = 'forward-muzzle';
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.12, 0.48, 6), stone, head, side * 0.19, 2.68, 0.01);
    ear.rotation.z = side * -0.12;
    ear.name = 'ear';
    const socket = ellipsoid(side * 0.303, 2.29, 0.36, 0.04, 0.066, 0.075, metal);
    socket.name = 'eye-socket';
    ellipsoid(side * 0.337, 2.3, 0.385, 0.022, 0.033, 0.038, eye);
    ellipsoid(side * 0.18, 2.08, 0.87, 0.035, 0.035, 0.018, metal);
    mesh(new THREE.BoxGeometry(0.035, 0.045, 0.63), gold, head, side * 0.275, 2.1, 0.49);
  }
  for (let i = 0; i < 7; i++) {
    const m = mesh(
      new THREE.BoxGeometry(0.13, 0.21, 0.16),
      metal,
      head,
      0,
      1.3 + i * 0.17,
      -0.29 + i * 0.012,
    );
    m.rotation.x = -0.25;
  }
  const bridle = mesh(new THREE.TorusGeometry(0.255, 0.022, 6, 24), gold, head, 0, 2.01, 0.74);
  bridle.scale.y = 0.75;
  return head;
}

// Static decoration is instanced into a handful of batches rather than hundreds of draw calls.

export function buildColiseum(THREE, scene, glow) {
  const root = new THREE.Group();
  root.name = 'ruined-coliseum';
  scene.add(root);
  const stone = new THREE.MeshStandardMaterial({ color: '#796e62', roughness: 0.94 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#4d4540', roughness: 1 });
  const bronze = new THREE.MeshStandardMaterial({
    color: '#9e7849',
    metalness: 0.7,
    roughness: 0.42,
  });
  const iron = new THREE.MeshStandardMaterial({ color: '#25262b', metalness: 0.8, roughness: 0.5 });
  const sand = new THREE.MeshStandardMaterial({ color: '#6f5140', roughness: 1 });
  const blood = new THREE.MeshStandardMaterial({
    color: '#540b16',
    roughness: 0.78,
    transparent: true,
    opacity: 0.83,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const obj = new THREE.Object3D(),
    batches = [];
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = false;
    root.add(m);
    return m;
  };
  const batch = (geo, mat, items, name) => {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    m.name = name;
    m.castShadow = false;
    items.forEach((p, i) => {
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      obj.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
      obj.updateMatrix();
      m.setMatrixAt(i, obj.matrix);
    });
    root.add(m);
    batches.push(m);
    return m;
  };
  const floor = add(new THREE.CylinderGeometry(22.2, 22.2, 0.3, 96), sand, 0, -1.08, 0);
  floor.receiveShadow = true;
  floor.name = 'bloodied-arena-floor';
  const archBlocks = [],
    columns = [],
    rails = [],
    spikes = [];
  for (let tier = 0; tier < 3; tier++) {
    const radius = 23 + tier * 3.1,
      base = tier * 3.7,
      count = 16 + tier * 8;
    const walk = add(
      new THREE.RingGeometry(radius - 0.3, radius + 3.2, 96),
      tier % 2 ? stoneDark : stone,
      0,
      base - 0.75,
      0,
    );
    walk.rotation.x = -Math.PI / 2;
    const wall = add(
      new THREE.CylinderGeometry(radius + 3.1, radius + 3.1, 3.6, 96, 1, true),
      stoneDark,
      0,
      base + 0.9,
      0,
    );
    wall.material.side = THREE.DoubleSide;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const place = (dx, y, dz, sx, sy, sz, rz = 0) => ({
        x: Math.sin(a) * (radius + dz) + Math.cos(a) * dx,
        y: base + y,
        z: Math.cos(a) * (radius + dz) - Math.sin(a) * dx,
        sx,
        sy,
        sz,
        ry: a,
        rz,
      });
      for (const side of [-1, 1]) columns.push(place(side * 1.28, 0.9, 0, 0.35, 2.9, 0.42));
      for (let k = 0; k < 9; k++) {
        const theta = (k / 8) * Math.PI;
        archBlocks.push(
          place(
            Math.cos(theta) * 1.3,
            2.35 + Math.sin(theta) * 1.3,
            0,
            0.48,
            0.42,
            0.8,
            theta - Math.PI / 2,
          ),
        );
      }
      rails.push(place(0, 3.4, 0, 2.8, 0.25, 0.95));
    }
    for (let row = 0; row < 4; row++) {
      const seat = add(
        new THREE.TorusGeometry(radius + 0.35 + row * 0.63, 0.18, 4, 96),
        stone,
        0,
        base - 0.35 + row * 0.23,
        0,
      );
      seat.rotation.x = Math.PI / 2;
    }
  }
  batch(new THREE.BoxGeometry(1, 1, 1), stone, archBlocks, 'vaulted-arches');
  batch(new THREE.CylinderGeometry(1, 1, 1, 8), stone, columns, 'roman-columns');
  batch(new THREE.BoxGeometry(1, 1, 1), bronze, rails, 'tier-cornices');
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    spikes.push({
      x: Math.sin(a) * 21.4,
      y: -0.3,
      z: Math.cos(a) * 21.4,
      sx: 0.1,
      sy: 0.7,
      sz: 0.1,
    });
  }
  batch(new THREE.ConeGeometry(1, 1, 5), iron, spikes, 'iron-pit-fence');
  const rubble = [];
  for (let i = 0; i < 65; i++) {
    const a = i * 2.399963,
      rad = 17.4 + (i % 9) * 0.42;
    rubble.push({
      x: Math.sin(a) * rad,
      y: -0.7,
      z: Math.cos(a) * rad,
      sx: 0.3 + (i % 5) * 0.13,
      sy: 0.2 + (i % 3) * 0.2,
      sz: 0.45,
      ry: i * 0.7,
      rz: (i % 4) * 0.13,
    });
  }
  batch(new THREE.BoxGeometry(1, 1, 1), stoneDark, rubble, 'fallen-masonry');
  const stain = new THREE.Shape();
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * Math.PI * 2,
      r = 0.75 + 0.18 * Math.sin(i * 3.1);
    if (!i) stain.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else stain.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  stain.closePath();
  const stains = [];
  for (let i = 0; i < 60; i++) {
    const a = i * 2.399963,
      rad = 16.6 + (i % 11) * 0.38;
    stains.push({
      x: Math.sin(a) * rad,
      y: -0.917 + (i % 3) * 0.001,
      z: Math.cos(a) * rad,
      sx: 0.3 + (i % 7) * 0.16,
      sy: 0.2 + (i % 5) * 0.2,
      sz: 1,
      rx: -Math.PI / 2,
      rz: i * 0.6,
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    stains.push({
      x: Math.sin(a) * 10.4,
      y: 0.011,
      z: Math.cos(a) * 10.4,
      sx: 0.3,
      sy: 0.45,
      sz: 1,
      rx: -Math.PI / 2,
      rz: a,
    });
  }
  batch(new THREE.ShapeGeometry(stain), blood, stains, 'old-blood-stains');
  const cloth = new THREE.Shape();
  cloth.moveTo(-0.8, 2.6);
  cloth.lineTo(0.8, 2.6);
  cloth.lineTo(0.8, -1.2);
  cloth.lineTo(0.35, -0.9);
  cloth.lineTo(0.03, -1.5);
  cloth.lineTo(-0.25, -0.9);
  cloth.lineTo(-0.8, -1.3);
  cloth.closePath();
  const clothGeo = new THREE.ShapeGeometry(cloth),
    clothMat = new THREE.MeshStandardMaterial({
      color: '#751523',
      roughness: 1,
      side: THREE.DoubleSide,
    });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      x = Math.sin(a) * 22.4,
      z = Math.cos(a) * 22.4;
    const banner = add(clothGeo, clothMat, x, 4.5, z);
    banner.rotation.y = a;
    banner.name = 'torn-crimson-banner';
    const torchX = Math.sin(a) * 21.8,
      torchZ = Math.cos(a) * 21.8;
    glow(root, '#ff8d43', 1.7, torchX, 2.7, torchZ);
    const bracket = add(new THREE.BoxGeometry(0.16, 1, 0.3), iron, torchX, 2.05, torchZ);
    bracket.rotation.y = a;
  }
  // Four monumental barred gates define the cardinal directions.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      gate = new THREE.Group();
    gate.position.set(Math.sin(a) * 22.25, -0.85, Math.cos(a) * 22.25);
    gate.rotation.y = a;
    root.add(gate);
    const voidMat = new THREE.MeshBasicMaterial({ color: '#08080d' });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 5.3), voidMat);
    back.position.set(0, 2.3, -0.3);
    back.material.side = THREE.DoubleSide;
    gate.add(back);
    for (let j = -3; j <= 3; j++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 5, 6), iron);
      bar.position.set(j * 0.5, 2.3, 0);
      gate.add(bar);
    }
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.8, 1), stone);
      pillar.position.set(side * 2.3, 2.4, 0);
      gate.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.6, 1.2), bronze);
    lintel.position.set(0, 5.1, 0);
    gate.add(lintel);
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  root.userData = {
    batches: batches.length,
    instances: batches.reduce((n, m) => n + m.count, 0),
    innerRadius: 21.4,
  };
  return root;
}
