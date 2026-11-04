// Perimeter scenery is static and instanced; the playable board stays clear.
export function addRealmScenery(THREE, roots, batch, materials) {
  const box = new THREE.BoxGeometry(1, 1, 1),
    cone = new THREE.ConeGeometry(0.5, 1, 6);
  const pews = [],
    glass = [],
    ruins = [],
    flowers = [],
    tombs = [],
    embers = [];
  for (const side of [-1, 1]) {
    for (const z of [-9, -4, 1, 6, 11]) {
      pews.push(
        { x: side * 13.1, y: -0.1, z, sx: 1.5, sy: 0.45, sz: 2.5 },
        { x: side * 14, y: 0.35, z, sx: 0.18, sy: 1.2, sz: 2.5 },
      );
      tombs.push(
        { x: side * 13.6, y: 0.1, z, sx: 1.45, sy: 0.8, sz: 2.1 },
        { x: side * 13.6, y: 0.6, z, sx: 1.6, sy: 0.2, sz: 2.2 },
        { x: side * 16, y: 1.1, z, sx: 1, sy: 2.8, sz: 0.35, rz: side * 0.12 },
      );
      for (let j = 0; j < 3; j++)
        embers.push({
          x: side * (12.1 + j * 0.16),
          y: 0.1 + j * 0.04,
          z: z - 0.6 + j * 0.55,
          sx: 0.22,
          sy: 0.2 + j * 0.12,
          sz: 0.22,
        });
    }
    for (const z of [-10, 0, 10]) {
      ruins.push(
        { x: side * 14.2, y: 0.7, z, sx: 1.1, sy: 3.2, sz: 1.1 },
        { x: side * 14.2, y: 2.5, z: z + 2.3, sx: 0.9, sy: 0.5, sz: 5.5, rx: 0.09 * side },
      );
      ruins.push({
        x: side * 13.5,
        y: -0.1,
        z: z + 3,
        sx: 0.9,
        sy: 3.7,
        sz: 0.8,
        rz: Math.PI / 2,
        ry: side * 0.4,
      });
    }
    for (let i = 0; i < 55; i++) {
      const z = -13 + (i % 11) * 2.5,
        x = side * (12.3 + Math.floor(i / 11) * 0.55);
      flowers.push({
        x,
        y: -0.1 + Math.sin(i * 7) * 0.08,
        z: z + Math.sin(i * 3) * 0.45,
        sx: 0.17 + (i % 3) * 0.08,
        sy: 0.25 + (i % 4) * 0.1,
        sz: 0.18 + (i % 3) * 0.08,
      });
    }
    for (const x of [4, 8]) {
      glass.push(
        { x: side * x, y: 6, z: -21, sx: 2.6, sy: 8, sz: 0.1 },
        { x: side * x, y: 10.3, z: -21, sx: 2.2, sy: 1, sz: 0.15, rz: side * 0.4 },
      );
      pews.push(
        { x: side * x, y: 6, z: -20.8, sx: 0.1, sy: 8.5, sz: 0.25 },
        { x: side * x, y: 6, z: -20.8, sx: 2.7, sy: 0.12, sz: 0.25 },
      );
    }
  }
  pews.push(
    { x: 0, y: 0.1, z: -17.5, sx: 7, sy: 1.3, sz: 2.5 },
    { x: 0, y: 0.85, z: -17.5, sx: 7.5, sy: 0.25, sz: 3 },
    { x: 0, y: -0.4, z: -15.6, sx: 9, sy: 0.25, sz: 1.2 },
  );
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    embers.push({
      x: Math.sin(a) * 17,
      y: -0.15,
      z: Math.cos(a) * 17,
      sx: 0.12,
      sy: 0.12,
      sz: 0.5,
      ry: a,
    });
  }
  batch(roots.frost, box, materials.stone, pews).name = 'cathedral-pews-and-altar';
  batch(
    roots.frost,
    box,
    new THREE.MeshStandardMaterial({
      color: 0x688eac,
      emissive: 0x243b57,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    }),
    glass,
  ).name = 'cathedral-stained-glass';
  batch(roots.verdant, box, materials.stone, ruins).name = 'garden-fallen-arcades';
  batch(
    roots.verdant,
    cone,
    new THREE.MeshStandardMaterial({ color: 0xad7883, roughness: 1 }),
    flowers,
  ).name = 'garden-wildflowers';
  batch(roots.eclipse, box, materials.dark, tombs).name = 'eclipse-sarcophagi';
  batch(
    roots.eclipse,
    cone,
    new THREE.MeshStandardMaterial({
      color: 0xc27c45,
      emissive: 0x723617,
      emissiveIntensity: 0.6,
      roughness: 0.8,
    }),
    embers,
  ).name = 'eclipse-ritual-embers';
}
