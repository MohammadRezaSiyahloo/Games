const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return clamp(x * x * x * (x * (x * 6 - 15) + 10));
};
// One full, forward revolution with zero angular velocity at takeoff and landing.
// This curve is sampled directly: angle smoothing must never skip part of the roll.

export function rollPose(phase, direction = 0) {
  const k = clamp(phase);
  const tuck = Math.sin(Math.PI * ease(k)) ** 2;
  return {
    angle: Math.PI * 2 * ease((k - 0.06) / 0.88),
    axisX: Math.cos(direction),
    axisZ: -Math.sin(direction),
    scale: 1 - 0.28 * tuck,
    lift: 0.1 * tuck,
    armX: 0.1 - 1.25 * tuck,
    armZ: -0.45 - 0.55 * tuck,
    shieldY: -0.18 + 0.68 * tuck,
    shieldZ: 0.42 + 0.12 * tuck,
  };
}
