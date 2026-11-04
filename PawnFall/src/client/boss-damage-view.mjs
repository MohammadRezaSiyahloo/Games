import { bossDamageStage } from '../shared/boss-phases.mjs';
// Fixed meshes and shared materials: damage survives snapshots without spawning repeated debris.

export function createBossDamageView(THREE) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x382d30, metalness: 0.7, roughness: 0.65 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb48a45, metalness: 0.8, roughness: 0.45 });
  const hot = new THREE.MeshStandardMaterial({
    color: 0xb35a35,
    emissive: 0x8c2917,
    emissiveIntensity: 0.7,
    roughness: 0.8,
  });
  const pale = new THREE.MeshStandardMaterial({
    color: 0x9ec8d5,
    emissive: 0x204d63,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.6,
  });
  const geometry = {
    scar: new THREE.BoxGeometry(0.055, 0.48, 0.04),
    shard: new THREE.ConeGeometry(0.14, 0.32, 3),
    plate: new THREE.BoxGeometry(0.38, 0.7, 0.32),
    blade: new THREE.BoxGeometry(0.24, 1.05, 0.08),
    hammer: new THREE.BoxGeometry(0.55, 0.5, 0.58),
  };

  function add(parent, geo, mat, x, y, z, name) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.name = name;
    m.castShadow = false;
    parent.add(m);
    return m;
  }

  function attach(model, boss) {
    if (model.userData.battleDamage) return model.userData.battleDamage;
    const { body, arm, shield } = model.userData;
    const scarParent = boss.boss !== 'confessor' && shield ? shield : body;
    const scars = [];
    const y = boss.boss === 'confessor' ? 2.52 : boss.boss === 'fallenking' ? 1.85 : 1.35;
    const z = boss.boss === 'confessor' ? 0.32 : boss.boss === 'fallenking' ? 0.46 : 0.55;
    for (let i = 0; i < 5; i++) {
      const m = add(
        scarParent,
        geometry.scar,
        boss.boss === 'confessor' ? pale : hot,
        (i - 2) * 0.095,
        (scarParent === body ? y : -0.1) + (i % 2) * 0.17,
        scarParent === body ? z : 0.18,
        'boss-damage-crack',
      );
      m.rotation.z = i % 2 ? 0.65 : -0.55;
      scars.push(m);
    }
    const broken = new THREE.Group();
    broken.name = 'boss-broken-weapon';
    arm.add(broken);
    if (boss.boss === 'fallenking') {
      add(broken, geometry.blade, dark, 0, 1.22, 0, 'broken-royal-blade');
      const edge = add(broken, geometry.shard, gold, 0, 1.84, 0, 'jagged-sword-edge');
      edge.rotation.z = 0.35;
    } else if (boss.boss === 'castellan') {
      add(broken, geometry.hammer, dark, -0.2, 1.45, 0, 'broken-siege-hammer');
      add(broken, geometry.shard, hot, 0.05, 1.58, 0, 'exposed-hammer-fracture');
    } else {
      for (let i = 0; i < 3; i++) {
        const m = add(
          broken,
          geometry.shard,
          pale,
          (i - 1) * 0.2,
          1.42 + (i % 2) * 0.2,
          0,
          'fractured-staff-crystal',
        );
        m.rotation.z = (i - 1) * 0.5;
      }
    }
    const fragments = [];
    for (let i = 0; i < 4; i++)
      fragments.push(
        add(
          model,
          i < 2 ? geometry.plate : geometry.shard,
          boss.boss === 'confessor' ? pale : i < 2 ? dark : gold,
          0,
          0,
          0,
          'boss-fallen-fragment',
        ),
      );
    const state = { boss: boss.boss, scars, broken, fragments, hidden: [], stage: -1 };
    model.userData.battleDamage = state;
    return state;
  }
  return {
    update(boss, model, t) {
      const d = attach(model, boss),
        stage = bossDamageStage(boss),
        data = model.userData;
      if (d.stage !== stage) {
        // Restore only parts owned by this effect, including when an actor is reused on retry.
        for (const part of d.hidden) part.visible = true;
        d.hidden = [];
        const hide = (part) => {
          if (part) {
            part.visible = false;
            d.hidden.push(part);
          }
        };
        d.scars.forEach((m, i) => (m.visible = stage > 0 && i < stage + 2));
        d.broken.visible = stage >= 2;
        if (stage >= 2) {
          if (boss.boss === 'castellan') {
            hide(data.armorPlates?.[0]);
            if (stage === 3) hide(data.armorPlates?.[1]);
            for (const part of (data.arm.userData.original || []).slice(1)) hide(part);
          } else if (boss.boss === 'fallenking') {
            for (const part of (data.arm.userData.parts || []).slice(2)) hide(part);
            const crown = data.body.userData.royalCrown;
            hide(crown?.children[1]);
            hide(crown?.children[3]);
            if (stage === 3) hide(crown?.children[5]);
            if (crown) crown.rotation.z = -0.18;
            hide(data.armorPlates?.[0]);
          } else {
            hide(data.staffCrystal);
            hide(data.staffGlow);
            for (const part of data.arm.userData.original || [])
              if (part.geometry?.type === 'SphereGeometry' || part.isSprite) hide(part);
          }
        } else if (data.body.userData.royalCrown) data.body.userData.royalCrown.rotation.z = 0;
        d.stage = stage;
      }
      const age = Number.isFinite(boss.phaseAt) ? Math.max(0, t - boss.phaseAt) : 3;
      const k = Math.min(1, age / 1.15);
      d.fragments.forEach((m, i) => {
        m.visible = stage >= 2 && !boss.dead && age < 1.3;
        m.position.set(
          (i % 2 ? 1 : -1) * (0.5 + k * (0.65 + i * 0.12)),
          (1 - k) * 1.6 + Math.sin(k * Math.PI) * 0.6 + 0.08,
          0.25 + (i - 1.5) * 0.25 + k * 0.45,
        );
        m.rotation.set(k * 2 + i, 0.3 * i, k * (i % 2 ? 1 : -1));
      });
    },
  };
}
