const ease = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
const poses = {
  spear: {
    rest: [1.0, 0, -0.18, 0],
    wind: [0.85, -0.08, -0.12, -0.28],
    light: [1.54, 0, -0.1, 1.05],
    heavy: [1.57, 0, -0.1, 1.45],
    hit: 0.371,
    heavyHit: 0.484,
  },
  twinblades: {
    rest: [0.35, -0.2, -0.6, 0],
    wind: [-0.65, -1.1, -1.1, -0.04],
    light: [0.85, 1.7, 0.5, 0.18],
    heavy: [0.9, 2.6, 0.5, 0.25],
    hit: 0.375,
    heavyHit: 0.432,
  },
  greatsword: {
    rest: [0.18, -0.22, -0.65, 0],
    wind: [-1.65, -1.3, -0.9, -0.1],
    light: [0.85, 1.7, 0.4, 0.25],
    heavy: [1.1, 0.15, 0.4, 0.5],
    hit: 0.436,
    heavyHit: 0.615,
  },
};

export function newWeaponPose(k, weapon, heavy = false, combo = 0) {
  const spec = poses[weapon];
  if (!spec) return null;
  k = Math.max(0, Math.min(1, k));
  const hit = heavy ? spec.heavyHit : spec.hit,
    wind = heavy && weapon === 'greatsword' ? [-2.55, 0, -0.25, -0.2] : spec.wind,
    strike = heavy ? spec.heavy : spec.light;
  const start = hit * 0.65,
    end = hit + 0.06;
  const [a, b, t] =
    k < start
      ? [spec.rest, wind, ease(k / start)]
      : k < end
        ? [wind, strike, ease((k - start) / (end - start))]
        : [strike, spec.rest, ease((k - end) / (1 - end))];
  const p = a.map((v, i) => v + (b[i] - v) * t),
    sign = weapon === 'twinblades' && combo % 2 ? -1 : 1;
  return {
    x: p[0],
    y: p[1] * sign,
    z: p[2],
    reach: p[3],
    twist:
      Math.sin(k * Math.PI) *
      (weapon === 'spear' ? 0.12 : heavy && weapon === 'twinblades' ? 1.2 : 0.45) *
      sign,
  };
}

export function newWeaponStance(weapon, time) {
  const s = poses[weapon];
  if (!s) return null;
  return {
    armX: s.rest[0],
    armY: s.rest[1],
    armZ: s.rest[2],
    bodyX: weapon === 'spear' ? 0.035 : 0.06,
    bodyY: weapon === 'spear' ? -0.15 : 0.08,
    bodyZ: 0,
    lift: Math.sin(time * 2) * 0.005,
    support: weapon === 'twinblades' ? 0 : 1,
  };
}
