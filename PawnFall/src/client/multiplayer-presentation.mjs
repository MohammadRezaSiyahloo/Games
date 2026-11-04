// Rendering state only; authoritative positions and the winner stay on the server.
export function reconcileAvatar(current, incoming, first = false) {
  const next = { ...incoming, id: 'player', isAvatar: true };
  if (!first && Math.hypot(current.x - incoming.x, current.z - incoming.z) < 8) {
    next.x = current.x;
    next.z = current.z;
    next.y = current.y || 0;
    next.face = current.face;
  }
  return next;
}

export function interpolateAvatar(player, snapshot, dt, input, age) {
  const walking = ['walk', 'block', 'idle'].includes(snapshot.state) && !snapshot.dead;
  const length = Math.max(1, Math.hypot(input.x || 0, input.z || 0));
  const speed = snapshot.block ? 1.8 : input.sprint ? 5.6 : 3.8;
  const k = 1 - Math.exp(-Math.max(0, dt) * (walking && (input.x || input.z) ? 8 : 18));
  if (walking) {
    player.x += ((input.x || 0) / length) * speed * dt;
    player.z += ((input.z || 0) / length) * speed * dt;
  }
  const ahead = walking ? Math.max(0, Math.min(0.12, age)) + dt : 0;
  const x = snapshot.x + ((input.x || 0) / length) * speed * ahead;
  const z = snapshot.z + ((input.z || 0) / length) * speed * ahead;
  player.x += (x - player.x) * k;
  player.z += (z - player.z) * k;
  player.x = Math.max(-10.5, Math.min(10.5, player.x));
  player.z = Math.max(-10.5, Math.min(10.5, player.z));
  player.y += ((snapshot.y || 0) - player.y) * k;
  const angle = ((snapshot.face - player.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  player.face += angle * k;
}

export function matchResult(state) {
  const draw = state.winner === null;
  const team = state.winner === 'team';
  const won = team || (!draw && state.winner === state.seat);
  return {
    outcome: draw ? 'draw' : won ? 'victory' : 'defeat',
    title: draw
      ? state.mode === 'versus'
        ? 'DRAW'
        : 'EXPEDITION ENDED'
      : won
        ? 'VICTORY'
        : 'DEFEAT',
    winner: draw
      ? state.mode === 'versus'
        ? 'No winner — the duel is tied.'
        : 'The court remains undefeated.'
      : team
        ? 'Your alliance wins!'
        : (state.names[state.winner] || 'Player') + ' wins!',
    detail: 'Rewards and progress saved. You can find another match below.',
  };
}

// Render remote actors on a short buffered timeline, instead of chasing each packet.
// Damage, AI, collisions and all match decisions remain authoritative on the server.

export class RemoteMotion {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = [];
    this.renderAt = null;
    this.delay = 0.06;
    this.sampledAt = null;
  }

  push(state, receivedAt) {
    const time = state.time;
    if (!Number.isFinite(time)) return;
    const last = this.frames.at(-1);
    if (last && time < last.time) return;
    const poses = new Map();
    const actors = [
      ...(state.enemies || []),
      ...(state.projectiles || []).map((p) => ({ ...p, id: 'shot:' + p.id })),
      ...(state.players || []).map((p, i) => ({ ...p, id: 'seat:' + i })),
    ];
    for (const p of actors)
      poses.set(p.id, {
        x: p.x,
        z: p.z,
        y: p.y || 0,
        face: p.face || 0,
        state: p.state,
        vx: p.vx,
        vz: p.vz,
      });
    const frame = { time, receivedAt, poses };
    if (last && time === last.time) {
      this.frames[this.frames.length - 1] = frame;
      return;
    }
    if (last) {
      const gap = time - last.time;
      if (gap > 0 && gap < 0.3)
        this.delay = Math.max(0.05, Math.min(0.12, this.delay * 0.85 + gap * 1.2 * 0.15));
    }
    this.frames.push(frame);
    if (this.frames.length > 24) this.frames.shift();
  }

  sample(now) {
    const last = this.frames.at(-1);
    if (!last) return { time: 0, poses: new Map() };
    const desired =
      last.time + Math.min(0.18, Math.max(0, (now - last.receivedAt) / 1000)) - this.delay;
    const dt = this.sampledAt === null ? 0 : Math.max(0, (now - this.sampledAt) / 1000);
    this.sampledAt = now;
    // Slew the render clock instead of jumping when a packet arrives late.
    const error = desired - (this.renderAt ?? desired);
    const advance = dt * Math.max(0.85, Math.min(1.15, 1 + error * 3));
    const candidate =
      this.frames.length === 1
        ? last.time
        : this.renderAt === null || dt > 0.5
          ? desired
          : this.renderAt + advance;
    const time = Math.min(
      last.time + 0.05,
      Math.max(this.renderAt ?? this.frames[0].time, candidate),
    );
    this.renderAt = time;
    let a = this.frames[0],
      b = last;
    for (let i = 1; i < this.frames.length; i++)
      if (this.frames[i].time >= time) {
        a = this.frames[i - 1];
        b = this.frames[i];
        break;
      }
    if (time >= last.time) {
      a = this.frames.at(-2) || last;
      b = last;
    }
    const span = b.time - a.time,
      k = span > 0 ? Math.max(0, Math.min(1, (time - a.time) / span)) : 1;
    const poses = new Map();
    for (const [id, latest] of last.poses) {
      const from = a.poses.get(id),
        to = b.poses.get(id);
      if (!from || !to || Math.hypot(to.x - from.x, to.z - from.z) > 5.6) {
        poses.set(id, { ...latest });
        continue;
      }
      const angle = ((to.face - from.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const pose = {
        x: from.x + (to.x - from.x) * k,
        z: from.z + (to.z - from.z) * k,
        y: from.y + (to.y - from.y) * k,
        face: from.face + angle * k,
      };
      if (time > last.time && span > 0 && from.state === to.state) {
        const ahead = Math.min(0.05, time - last.time);
        // Bounded continuation bridges a late packet without inventing attack outcomes.
        const vx = Number.isFinite(to.vx) ? to.vx : (to.x - from.x) / span;
        const vz = Number.isFinite(to.vz) ? to.vz : (to.z - from.z) / span;
        pose.x = to.x + Math.max(-18, Math.min(18, vx)) * ahead;
        pose.z = to.z + Math.max(-18, Math.min(18, vz)) * ahead;
      }
      poses.set(id, pose);
    }
    return { time, poses };
  }
}
