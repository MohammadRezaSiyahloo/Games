import assert from 'node:assert/strict';
import { RemoteMotion } from '../src/client/multiplayer-presentation.mjs';

function snapshot(time, x, y = 0, state = 'approach') {
  return {
    time,
    enemies: [{ id: 'enemy', x, z: 0, y, face: time, state, hp: 100 }],
    players: [],
    projectiles: [{ id: 1, x: x + 1, z: 0, vx: 7, vz: 0 }],
  };
}
{
  const motion = new RemoteMotion();
  let prior = 0,
    maxStep = 0,
    clock = -1;
  for (let frame = 0; frame < 180; frame++) {
    const now = (frame * 1000) / 60;
    if (frame % 3 === 0) motion.push(snapshot(frame / 60, (frame / 60) * 2.1), now);
    const sample = motion.sample(now),
      x = sample.poses.get('enemy').x;
    assert(sample.time >= clock, 'animation clock never rewinds');
    clock = sample.time;
    assert(x >= prior - 1e-9, 'approaching enemy never rubber-bands');
    maxStep = Math.max(maxStep, x - prior);
    prior = x;
    assert(Number.isFinite(sample.poses.get('shot:1').x));
  }
  assert(maxStep < 0.06, 'enemy advances every render frame instead of in 50ms steps');
  assert(prior > 5.8, 'buffer does not add a long trailing chase');
}
{
  const motion = new RemoteMotion();
  let previousY = 0,
    previousX = 0,
    maxStep = 0;
  for (let frame = 0; frame < 40; frame++) {
    const t = frame / 60;
    if (frame % 3 === 0)
      motion.push(
        snapshot(t, t * 16, Math.sin(Math.min(1, t / 0.65) * Math.PI) * 3.6, 'attack'),
        t * 1000,
      );
    const pose = motion.sample(t * 1000).poses.get('enemy');
    assert(Number.isFinite(pose.y));
    assert(Math.abs(pose.y - previousY) < 0.5, 'jump height is interpolated');
    maxStep = Math.max(maxStep, pose.x - previousX);
    previousY = pose.y;
    previousX = pose.x;
  }
  assert(maxStep < 0.4, 'fast charge movement is smooth at render frame rate');
}
{
  const motion = new RemoteMotion();
  motion.push(snapshot(0, 0), 0);
  motion.push(snapshot(0.05, 0.1), 50);
  const before = motion.sample(100);
  const stalled = motion.sample(5000);
  assert(stalled.time <= 0.1, 'extrapolation is capped at 50ms');
  assert(stalled.poses.get('enemy').x <= 0.2);
  const time = stalled.time;
  motion.push(snapshot(0.03, 999), 5100);
  assert.equal(motion.frames.at(-1).time, 0.05, 'out-of-order packet ignored');
  assert(motion.sample(5100).time >= time);
  motion.push(
    {
      ...snapshot(0.1, 0.2),
      enemies: [{ id: 'new', x: 7, z: 7, y: 0, face: 0, state: 'approach' }],
    },
    5200,
  );
  assert.equal(
    motion.sample(5200).poses.get('new').x,
    7,
    'new enemies spawn at their real position',
  );
  assert(!motion.sample(5200).poses.has('enemy'), 'removed enemies are not resurrected');
  motion.reset();
  motion.push(snapshot(0, 2), 0);
  assert.equal(motion.sample(0).poses.get('enemy').x, 2, 'new round resets the timeline');
}
{
  const motion = new RemoteMotion();
  motion.push(snapshot(0, 0), 0);
  motion.push(snapshot(0.05, 9), 50);
  assert.equal(
    motion.sample(50).poses.get('enemy').x,
    9,
    'teleports are not smeared across the board',
  );
}
console.log(
  'PASS: 20Hz-to-60fps enemy/projectile interpolation, monotonic animation time, fast charges, knight jumps, bounded packet gaps, stale packets, spawns, removals, round resets and teleports.',
);

{
  const motion = new RemoteMotion();
  const arrivals = [0, 48, 117, 149, 216, 258, 301, 373, 404, 465, 500];
  let packet = 0,
    previous = 0,
    maxStep = 0;
  for (let frame = 0; frame < 36; frame++) {
    const now = (frame * 1000) / 60;
    while (packet < arrivals.length && arrivals[packet] <= now) {
      motion.push(snapshot(packet * 0.05, packet * 0.05 * 2.1), arrivals[packet]);
      packet++;
    }
    const x = motion.sample(now).poses.get('enemy').x;
    assert(x >= previous - 1e-9, 'jitter does not reverse remote movement');
    maxStep = Math.max(maxStep, x - previous);
    previous = x;
  }
  assert(maxStep < 0.065, 'jittered arrivals do not snap the presentation clock');
}
