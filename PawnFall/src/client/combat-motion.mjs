import { newWeaponStance } from './new-weapon-motion.mjs';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};

export function weaponStance(weapon = 'longsword', time = 0, moving = false) {
  const extra = newWeaponStance(weapon, time);
  if (extra) return extra;
  const breath = Math.sin(time * 2) * 0.005;
  if (weapon === 'rapier')
    return {
      armX: 1.15,
      armY: 0,
      armZ: -0.18,
      bodyX: 0.025,
      bodyY: -0.12,
      bodyZ: 0,
      lift: breath,
      support: 0,
    };
  if (weapon === 'warhammer')
    return {
      armX: 0.25,
      armY: -0.15,
      armZ: -0.6,
      bodyX: 0.055,
      bodyY: 0.08,
      bodyZ: -0.025,
      lift: breath,
      support: 1,
    };
  return {
    armX: 0.22,
    armY: 0,
    armZ: -0.38,
    bodyX: 0,
    bodyY: 0,
    bodyZ: 0,
    lift: breath,
    support: 0,
  };
}

export function heavyBodyPose(phase, weapon = 'longsword') {
  if (['spear', 'greatsword', 'twinblades'].includes(weapon)) {
    const k = Math.max(0, Math.min(1, phase)),
      power = Math.sin(Math.PI * k);
    return {
      lean: power * (weapon === 'spear' ? 0.14 : 0.28),
      twist: power * (weapon === 'twinblades' ? 0.8 : 0.15),
      roll: 0,
      compress: 1 - power * 0.08,
      support: weapon === 'twinblades' ? 0 : 1,
    };
  }
  const k = clamp(phase),
    pulse = Math.sin(k * Math.PI) ** 2;
  if (weapon === 'warhammer')
    return {
      lean: -0.16 * pulse + 0.34 * Math.sin(Math.PI * ease((k - 0.48) / 0.52)),
      twist: 0.1 * pulse,
      roll: 0,
      compress: 1 - 0.035 * pulse,
      support: 1,
    };
  if (weapon === 'rapier')
    return {
      lean: 0.15 * pulse,
      twist: -0.14 * pulse,
      roll: -0.04 * pulse,
      compress: 1,
      support: 0,
    };
  return {
    lean: 0.08 * pulse,
    twist: Math.sin(k * Math.PI * 2) * 0.28,
    roll: -0.065 * pulse,
    compress: 1 - 0.02 * pulse,
    support: ease(k / 0.13) * (1 - ease((k - 0.85) / 0.15)),
  };
}

export function reactionPose(kind, age) {
  const duration = kind === 'stagger' ? 0.7 : kind === 'parry' ? 0.38 : 0.3;
  const k = clamp(age / duration),
    pulse = Math.sin(Math.PI * k) * (1 - k * 0.35);
  return {
    done: k >= 1,
    pulse,
    shieldBack: kind === 'block' ? 0.18 * pulse : kind === 'parry' ? -0.08 * pulse : 0,
    shieldTurn: kind === 'parry' ? -0.45 * pulse : kind === 'block' ? -0.2 * pulse : 0,
    twist: kind === 'parry' ? 0.22 * pulse : 0,
    lean: kind === 'stagger' ? 0.28 * pulse : kind === 'block' ? -0.07 * pulse : 0,
    slump: kind === 'stagger' ? 0.2 * pulse : 0,
  };
}

export function finisherPose(kind, age) {
  const k = clamp(age / (kind === 'team' ? 0.38 : 0.6)),
    pulse = Math.sin(k * Math.PI) ** 2;
  return {
    done: k >= 1,
    twist: (kind === 'team' ? -0.16 : 0.2) * pulse,
    lift: 0.025 * pulse,
    reach: 0.16 * pulse,
  };
}
