// Rigid weapon grips and compact articulated metal arms preserve each chess silhouette.
export function createWeaponRig(THREE, body, arm, shield, materials) {
  const shared = (createWeaponRig.cache ||= new WeakMap());
  let geo = shared.get(THREE);
  if (!geo) {
    geo = {
      palm: new THREE.BoxGeometry(0.14, 0.14, 0.075),
      finger: new THREE.TorusGeometry(0.073, 0.023, 4, 10, Math.PI * 1.7),
      limb: new THREE.CylinderGeometry(0.07, 0.09, 1, 8),
      joint: new THREE.SphereGeometry(0.1, 8, 6),
      strap: new THREE.BoxGeometry(0.075, 0.9, 0.04),
    };
    shared.set(THREE, geo);
  }
  const metal = materials.steel,
    leather = materials.leather;
  const add = (parent, geometry, material) => {
    const m = new THREE.Mesh(geometry, material);
    parent.add(m);
    return m;
  };
  if (!geo.hand) {
    const positions = [],
      normals = [];
    const pieces = [
      { g: geo.palm, m: new THREE.Matrix4().makeTranslation(0, 0, -0.085) },
      ...[-0.045, 0, 0.045].map((y) => ({
        g: geo.finger,
        m: new THREE.Matrix4()
          .makeTranslation(0, y, 0)
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
      })),
    ];
    for (const p of pieces) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
      g.applyMatrix4(p.m);
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      g.dispose();
    }
    geo.hand = new THREE.BufferGeometry();
    geo.hand.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.hand.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  const hand = (parent) => {
    const group = new THREE.Group();
    parent.add(group);
    group.name = 'armored-grip';
    add(group, geo.hand, metal);
    return group;
  };
  const right = hand(arm);
  right.position.y = 0.11;
  right.name = 'weapon-hand';
  const left = hand(body);
  left.name = 'support-hand';
  const links = Array.from({ length: 4 }, () => new THREE.Object3D()),
    joints = Array.from({ length: 2 }, () => new THREE.Object3D());
  const armBatch = new THREE.InstancedMesh(geo.limb, metal, 4),
    jointBatch = new THREE.InstancedMesh(geo.joint, metal, 2);
  armBatch.name = 'articulated-arms';
  jointBatch.name = 'arm-joints';
  armBatch.frustumCulled = false;
  jointBatch.frustumCulled = false;
  body.add(armBatch, jointBatch);
  const strap = add(body, geo.strap, leather);
  strap.position.set(0, arm.position.y - 0.2, -0.4);
  strap.rotation.z = -0.45;
  const shieldHandle = add(shield, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), leather);
  shieldHandle.position.z = -0.13;
  shieldHandle.name = 'shield-handle';
  const rest = { arm: arm.position.clone(), shield: shield.position.clone() };
  const v = {
    r: new THREE.Vector3(),
    l: new THREE.Vector3(),
    wrist: new THREE.Vector3(),
    support: new THREE.Vector3(),
    guard: new THREE.Vector3(),
    rs: new THREE.Vector3(),
    ls: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    delta: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    zero: new THREE.Vector3(0, 0, 0),
  };
  let support = 0;

  function link(m, a, b) {
    v.delta.subVectors(b, a);
    const length = Math.max(0.001, v.delta.length());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, length, 1);
    m.quaternion.setFromUnitVectors(v.up, v.delta.multiplyScalar(1 / length));
  }

  function chain(a, b, side, index) {
    v.elbow.copy(a).add(b).multiplyScalar(0.5);
    v.elbow.x += side * 0.12;
    v.elbow.z -= Math.min(0.26, a.distanceTo(b) * 0.4);
    v.elbow.y -= 0.12;
    link(links[index * 2], a, v.elbow);
    link(links[index * 2 + 1], v.elbow, b);
    joints[index].position.copy(v.elbow);
  }
  return {
    offhand: null,
    batches: [armBatch, jointBatch],
    rest,
    right,
    left,
    links,
    joints,
    get support() {
      return support;
    },
    update(weapon, desiredSupport, dt) {
      support +=
        (Math.max(0, Math.min(1, desiredSupport)) - support) *
        (1 - Math.exp(-Math.max(0, dt) * 22));
      // Stow the shield against the back while the second hand joins the shaft.
      shield.position.x += (-0.12 - shield.position.x) * support;
      shield.position.y += (rest.arm.y + 0.1 - shield.position.y) * support;
      shield.position.z += (-0.46 - shield.position.z) * support;
      shield.rotation.x *= 1 - support;
      shield.rotation.y += (Math.PI - shield.rotation.y) * support;
      shield.rotation.z = 0.12 * support;
      strap.visible = support > 0.15;
      arm.updateMatrix();
      shield.updateMatrix();
      v.r.set(0, 0.11, -0.14).applyMatrix4(arm.matrix);
      v.support
        .set(
          0,
          weapon === 'warhammer'
            ? 0.58
            : weapon === 'spear'
              ? 0.75
              : weapon === 'greatsword'
                ? 0.34
                : -0.065,
          0,
        )
        .applyMatrix4(arm.matrix);
      if (this.offhand) {
        this.offhand.updateMatrix();
        v.guard.set(0, 0.1, 0).applyMatrix4(this.offhand.matrix);
      } else v.guard.set(0, 0, -0.13).applyMatrix4(shield.matrix);
      v.l.copy(v.guard).lerp(v.support, support);
      left.position.copy(v.l);
      left.quaternion
        .copy(this.offhand?.quaternion || shield.quaternion)
        .slerp(arm.quaternion, support);
      v.rs.set(0.36, rest.arm.y + 0.15, -0.06);
      v.ls.set(-0.36, rest.arm.y + 0.15, -0.06);
      v.wrist.set(0, 0, -0.14).applyQuaternion(left.quaternion).add(v.l);
      chain(v.rs, v.r, 1, 0);
      chain(v.ls, v.wrist, -1, 1);
      right.visible = true;
      left.visible = shield.visible || !!this.offhand || support > 0.05;
      links[2].visible = links[3].visible = joints[1].visible = left.visible;
      for (const [items, batch] of [
        [links, armBatch],
        [joints, jointBatch],
      ]) {
        items.forEach((o, i) => {
          o.updateMatrix();
          if (o.visible === false) o.matrix.scale(v.zero);
          batch.setMatrixAt(i, o.matrix);
        });
        batch.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
