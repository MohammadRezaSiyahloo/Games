import { phaseChangeReady, enterSecondPhase, emitBossPhase } from './boss-phases.mjs';
// Boss rules contain no rendering or browser dependencies; shared by solo and co-op.
export const CASTELLAN = {
  id: 'castellan',
  name: 'The Iron Castellan',
  subtitle: 'Siege engine of the Ashen Court',
  hp: 780,
  souls: 1400,
  poise: 125,
};

export function createCastellan(id, time, players = 1) {
  const hp = Math.round(CASTELLAN.hp * (players > 1 ? 1.45 : 1));
  return {
    id,
    type: 'rook',
    boss: CASTELLAN.id,
    name: CASTELLAN.name,
    x: 0,
    z: -5,
    y: 0,
    face: 0,
    hp,
    max: hp,
    phase: 1,
    state: 'approach',
    cooldown: time + 2,
    until: 0,
    begin: time,
    count: 0,
    hitUntil: 0,
    dead: false,
    radius: 1.35,
    poise: 0,
    maxPoise: CASTELLAN.poise,
    breakImmuneUntil: 0,
    coreOpen: false,
    hitSeats: [],
    attackKind: 'charge',
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function players(game) {
  return game.partners?.filter((g) => g.hp > 0).map((g) => g.player) || [game.player];
}

function hit(game, e, p, damage) {
  if (e.hitSeats.includes(p.id)) return;
  e.hitSeats.push(p.id);
  game.hurtTarget(damage, e, p);
}

function expose(game, e, duration) {
  e.state = 'exposed';
  e.coreOpen = true;
  e.until = game.time + duration;
  e.begin = game.time;
  e.hitSeats = [];
  game.emit('coreOpen', { id: e.id, x: e.x, z: e.z });
}

export function bossDamage(game, e, damage, poise = damage) {
  const vulnerable = e.coreOpen || e.state === 'stagger';
  const applied = Math.round(damage * (vulnerable ? 1.65 : 0.38));
  if (vulnerable && game.time >= e.breakImmuneUntil) {
    e.poise = (e.poise || 0) + poise;
    if (e.poise >= e.maxPoise) {
      e.poise = 0;
      e.state = 'stagger';
      e.coreOpen = true;
      e.begin = game.time;
      e.until = game.time + 2.6;
      e.breakImmuneUntil = game.time + 9;
      game.emit('stagger', { id: e.id, x: e.x, z: e.z, boss: true });
    }
  }
  return applied;
}

export function updateCastellan(game, e, dt) {
  const t = game.time,
    targets = players(game);
  let p = targets[e.count % targets.length] || game.player;
  if (phaseChangeReady(e)) {
    enterSecondPhase(game, e, 1.9);
    e.poise = 0;
    emitBossPhase(game, e);
  }
  if (e.state === 'enrage') {
    if (t >= e.until) {
      e.state = 'approach';
      e.cooldown = t + 0.4;
    }
    return;
  }
  if (e.state === 'stagger' || e.state === 'exposed') {
    if (t >= e.until) {
      e.coreOpen = false;
      e.state = 'approach';
      e.cooldown = t + 0.5;
    }
    return;
  }
  if (e.state === 'approach') {
    e.coreOpen = false;
    e.poise = Math.max(0, (e.poise || 0) - dt * 5);
    const dx = p.x - e.x,
      dz = p.z - e.z,
      d = Math.hypot(dx, dz);
    e.face = Math.atan2(dx, dz);
    const kind =
      e.phase === 2 && e.count % 3 === 2 ? 'cross' : e.count % 2 === 0 ? 'charge' : 'hammer';
    if (kind === 'hammer' && d > 4.6) {
      e.x += (dx / d) * dt * (e.phase === 2 ? 2.6 : 1.8);
      e.z += (dz / d) * dt * (e.phase === 2 ? 2.6 : 1.8);
    }
    if (t >= e.cooldown && (kind !== 'hammer' || d < 4.8)) {
      e.attackKind = kind;
      e.state = 'windup';
      e.begin = t;
      e.until =
        t + (kind === 'cross' ? 1.65 : kind === 'charge' ? (e.phase === 2 ? 1.1 : 1.45) : 1.5);
      e.hitSeats = [];
      e.pulses = 0;
      e.count++;
      if (kind === 'charge') {
        const horizontal = Math.abs(dx) > Math.abs(dz);
        e.aim = { x: horizontal ? Math.sign(dx) || 1 : 0, z: horizontal ? 0 : Math.sign(dz) || 1 };
        e.face = Math.atan2(e.aim.x, e.aim.z);
        e.from = { x: e.x, z: e.z };
        e.target = { x: e.aim.x ? e.aim.x * 9.7 : e.x, z: e.aim.z ? e.aim.z * 9.7 : e.z };
      } else e.target = { x: e.x + Math.sin(e.face) * 1.5, z: e.z + Math.cos(e.face) * 1.5 };
      game.emit('bossTell', { id: e.id, kind, x: e.x, z: e.z });
    }
  } else if (e.state === 'windup' && t >= e.until) {
    e.state = 'attack';
    e.begin = t;
    e.until =
      t +
      (e.attackKind === 'charge' ? 1.5 : e.attackKind === 'hammer' && e.phase === 2 ? 1.35 : 0.55);
    e.hitSeats = [];
  } else if (e.state === 'attack') {
    const elapsed = t - e.begin;
    if (e.attackKind === 'charge') {
      const speed = e.phase === 2 ? 16 : 13.5,
        remaining = distance(e, e.target),
        step = Math.min(speed * dt, remaining);
      const before = { x: e.x, z: e.z };
      e.x += e.aim.x * step;
      e.z += e.aim.z * step;
      for (const player of targets) {
        const vx = e.x - before.x,
          vz = e.z - before.z,
          den = vx * vx + vz * vz,
          k = den
            ? Math.max(
                0,
                Math.min(1, ((player.x - before.x) * vx + (player.z - before.z) * vz) / den),
              )
            : 0;
        if (Math.hypot(player.x - (before.x + vx * k), player.z - (before.z + vz * k)) < 1.85)
          hit(game, e, player, 30);
      }
      if (remaining < 0.2 || t >= e.until) {
        game.emit('slam', { x: e.x, z: e.z, large: true, boss: true });
        expose(game, e, e.hitSeats.length ? 2 : 3.4);
      }
    } else if (e.attackKind === 'hammer') {
      const wanted = elapsed > 0.9 && e.phase === 2 ? 2 : elapsed > 0.14 ? 1 : 0;
      if (wanted > e.pulses) {
        e.pulses = wanted;
        e.hitSeats = [];
        for (const player of targets)
          if (distance(player, e.target) < 3.8) hit(game, e, player, 28);
        game.emit('slam', { x: e.target.x, z: e.target.z, large: true, boss: true });
      }
      if (t >= e.until) expose(game, e, 2.9);
    } else {
      if (!e.pulses && elapsed > 0.15) {
        e.pulses = 1;
        for (const player of targets)
          if (Math.abs(player.x - e.x) < 1.3 || Math.abs(player.z - e.z) < 1.3)
            hit(game, e, player, 26);
        game.emit('bossCross', { x: e.x, z: e.z });
      }
      if (t >= e.until) expose(game, e, 2.8);
    }
  }
  game.clampActor(e);
}
