import { newWeaponPose } from './new-weapon-motion.mjs';
const smooth = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};

export function attackPose(phase, weapon = 'longsword', combo = 0) {
  const extra = newWeaponPose(phase, weapon, false, combo);
  if (extra) return extra;
  const k = Math.max(0, Math.min(1, phase)),
    hit = weapon === 'warhammer' ? 0.49 : 0.37;
  const rest =
      weapon === 'rapier'
        ? [1.15, 0, -0.18, 0]
        : weapon === 'warhammer'
          ? [0.25, -0.15, -0.6, 0]
          : [0.22, 0, -0.38, 0],
    wind =
      weapon === 'rapier'
        ? [1.05, 0, -0.18, -0.1]
        : weapon === 'warhammer'
          ? [-2.1, 0, -0.8, 0]
          : [-1.1, -1.5, -1.2, 0];
  const impact =
    weapon === 'rapier'
      ? [1.5, 0, -0.18, 0.9]
      : weapon === 'warhammer'
        ? [0.8, 0, 0.6, 0.1]
        : [0.8, 1.55, 0.55, 0.12];
  let a, b, t;
  if (k < hit * 0.7) {
    a = rest;
    b = wind;
    t = smooth(k / (hit * 0.7));
  } else if (k < hit + 0.12) {
    a = wind;
    b = impact;
    t = smooth((k - hit * 0.7) / (hit + 0.12 - hit * 0.7));
  } else {
    a = impact;
    b = rest;
    t = smooth((k - hit - 0.12) / (1 - hit - 0.12));
  }
  const pose = a.map((v, i) => v + (b[i] - v) * t);
  return {
    x: pose[0],
    y: pose[1] * (combo === 1 ? -1 : 1),
    z: pose[2],
    reach: pose[3],
    twist: Math.sin(k * Math.PI) * (combo === 1 ? -0.35 : 0.35),
  };
}

export function heavyAttackPose(phase, weapon = 'longsword') {
  const extra = newWeaponPose(phase, weapon, true);
  if (extra) return extra;
  const k = Math.max(0, Math.min(1, phase));
  const hit = weapon === 'warhammer' ? 0.624 : weapon === 'rapier' ? 0.375 : 0.455;
  const rest =
    weapon === 'rapier'
      ? [1.15, 0, -0.18, 0]
      : weapon === 'warhammer'
        ? [0.25, -0.15, -0.6, 0]
        : [0.22, 0, -0.38, 0];
  const wind =
    weapon === 'warhammer'
      ? [-2.5, 0, -0.35, -0.15]
      : weapon === 'rapier'
        ? [1.05, -0.12, -0.2, -0.25]
        : [-0.95, -2, -1.1, -0.08];
  const strike =
    weapon === 'warhammer'
      ? [1.1, 0, 0.5, 0.2]
      : weapon === 'rapier'
        ? [1.5, 0, -0.15, 1.0]
        : [0.75, 2.15, 0.7, 0.35];
  let a, b, t;
  if (k < hit * 0.65) {
    a = rest;
    b = wind;
    t = smooth(k / (hit * 0.65));
  } else if (k < hit + 0.02) {
    a = wind;
    b = strike;
    t = smooth((k - hit * 0.65) / (hit * 0.35 + 0.02));
  } else {
    a = strike;
    b = rest;
    t = smooth((k - hit - 0.02) / (1 - hit - 0.02));
  }
  const p = a.map((v, i) => v + (b[i] - v) * t);
  return {
    x: p[0],
    y: p[1],
    z: p[2],
    reach: p[3],
    twist: Math.sin(k * Math.PI) * (weapon === 'longsword' ? 0.55 : 0.12),
  };
}

export function fallenPose(age, type = 'pawn') {
  const k = smooth(Math.max(0, age) / 0.5);
  return { roll: -Math.PI * 0.5 * k, lift: 0.72 * k, armX: 0.1 + 0.5 * k, armZ: -0.45 - 0.35 * k };
}
