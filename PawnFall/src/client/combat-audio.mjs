const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const CUE_TYPES = {
  windup: { notes: [260], end: 440, duration: 0.18, volume: 0.045, type: 'triangle' },
  danger: { notes: [155, 205], end: 85, duration: 0.28, volume: 0.055, type: 'sawtooth' },
  projectile: { notes: [920], end: 580, duration: 0.17, volume: 0.045, type: 'sine' },
  guardbreak: { notes: [95, 140], end: 45, duration: 0.32, volume: 0.06, type: 'square' },
  counter: { notes: [880, 1320], end: 1170, duration: 0.24, volume: 0.045, type: 'triangle' },
  exhausted: { notes: [130], end: 85, duration: 0.14, volume: 0.04, type: 'triangle' },
};

export function cueForEvent(ev) {
  return ev.type === 'windup'
    ? 'windup'
    : ev.type === 'bossTell' || ev.type === 'squadTell' || (ev.type === 'abilityTell' && ev.enemy)
      ? 'danger'
      : ev.type === 'cast'
        ? 'projectile'
        : ev.type === 'guardBreak'
          ? 'guardbreak'
          : ev.type === 'parry'
            ? 'counter'
            : ev.type === 'tired'
              ? 'exhausted'
              : null;
}

export function cuePosition(source, player, yaw = 0) {
  const dx = (source?.x ?? player.x) - player.x,
    dz = (source?.z ?? player.z) - player.z,
    d = Math.hypot(dx, dz);
  return {
    pan: clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(3, d), -0.85, 0.85),
    distance: d,
  };
}

export class CombatAudio {
  constructor(context, preferences) {
    this.context = context;
    this.preferences = preferences;
    this.last = new Map();
    this.until = [];
    this.low = false;
  }

  play(
    kind,
    { id = 'local', source, player = { x: 0, z: 0 }, yaw = 0, ally = false, now = 0 } = {},
  ) {
    const p = this.preferences(),
      spec = CUE_TYPES[kind],
      ctx = this.context();
    if (
      !spec ||
      !ctx ||
      ctx.state === 'suspended' ||
      !p.audioEnabled ||
      p.combatCues === false ||
      !p.master ||
      !p.sfx
    )
      return false;
    const position = cuePosition(source, player, yaw);
    if (kind === 'windup' && position.distance > 18) return false;
    const key = kind + ':' + id,
      prior = this.last.get(key);
    if (prior !== undefined && now - prior < 250) return false;
    this.until = this.until.filter((t) => t > ctx.currentTime);
    if (this.until.length >= 6) return false;
    const t = ctx.currentTime,
      d = spec.duration,
      level =
        spec.volume *
        p.master *
        p.sfx *
        (ally ? 0.45 : 1) *
        Math.max(0.25, 1 - position.distance / 28);
    try {
      const pan = ctx.createStereoPanner?.();
      if (pan) {
        pan.pan.setValueAtTime(p.directionalAudio === false ? 0 : position.pan, t);
        pan.connect(ctx.destination);
      }
      let ended = 0;
      for (const f of spec.notes) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = spec.type;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(spec.end, t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(level / spec.notes.length, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g);
        g.connect(pan || ctx.destination);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
          if (++ended === spec.notes.length) pan?.disconnect();
        };
        o.start(t);
        o.stop(t + d);
      }
      this.last.set(key, now);
      if (this.last.size > 120) this.last.delete(this.last.keys().next().value);
      this.until.push(t + d);
      return true;
    } catch {
      return false;
    }
  }

  event(ev, game, yaw, now, localId = 'player') {
    const kind = cueForEvent(ev);
    if (!kind || (['guardbreak', 'counter', 'exhausted'].includes(kind) && ev.remote)) return false;
    const enemy = game.enemies.find((e) => e.id === ev.id);
    return this.play(enemy?.unblockable && kind === 'windup' ? 'danger' : kind, {
      id: ev.id || ev.type,
      source: enemy || ev,
      player: game.player,
      yaw,
      now,
      ally: !!(ev.target && ev.target !== localId && ev.target !== game.player.id),
    });
  }

  stamina(game, now) {
    const low = game.mode === 'playing' && game.hp > 0 && game.stamina < 18;
    if (low && !this.low) this.play('exhausted', { id: 'stamina', player: game.player, now });
    this.low = low;
  }
}
