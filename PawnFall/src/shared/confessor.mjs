import { phaseChangeReady, enterSecondPhase, emitBossPhase } from './boss-phases.mjs';
// The Pale Confessor: alternating co-op targets and deterministic illusion patterns.
export const CONFESSOR = { id: 'confessor', name: 'The Pale Confessor', hp: 680, souls: 1600 };

export function createConfessor(id, time, players = 1) {
  const hp = Math.round(CONFESSOR.hp * (players > 1 ? 1.45 : 1));
  return {
    id,
    type: 'bishop',
    boss: 'confessor',
    name: CONFESSOR.name,
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
    radius: 0.95,
    poise: 0,
    maxPoise: 100,
    breakImmuneUntil: 0,
    coreOpen: false,
    attackKind: 'salvo',
    illusions: [],
  };
}

export function confessorDamage(game, e, damage, poise = damage) {
  const applied = Math.round(damage * (e.coreOpen ? 1.25 : 0.8));
  if (game.time >= e.breakImmuneUntil) {
    e.poise += poise;
    if (e.poise >= e.maxPoise) {
      e.poise = 0;
      e.state = 'stagger';
      e.coreOpen = true;
      e.until = game.time + 2.5;
      e.illusions = [];
      e.breakImmuneUntil = game.time + 8;
      game.emit('stagger', { id: e.id, x: e.x, z: e.z, boss: true });
    }
  }
  return applied;
}

export function updateConfessor(game, e, dt) {
  const t = game.time;
  const targets = game.partners?.filter((g) => g.hp > 0).map((g) => g.player) || [game.player];
  const p = targets[e.count % targets.length] || game.player;
  if (phaseChangeReady(e)) {
    enterSecondPhase(game, e, 1.8);
    e.illusions = [];
    emitBossPhase(game, e);
  }
  if (e.state === 'enrage' || e.state === 'recover' || e.state === 'stagger') {
    if (t >= e.until) {
      e.state = 'approach';
      e.coreOpen = false;
      e.cooldown = t + 0.6;
      e.illusions = [];
    }
    return;
  }
  if (e.state === 'approach') {
    e.face = Math.atan2(p.x - e.x, p.z - e.z);
    if (t < e.cooldown) return;
    e.count++;
    e.state = 'windup';
    e.begin = t;
    e.until = t + (e.phase === 2 ? 1.3 : 1.7);
    e.attackKind = e.count % 2 ? 'salvo' : 'mirrors';
    if (e.attackKind === 'mirrors') {
      // All three materialize together; the true bishop alone casts a shadow.
      const points = [
        { x: -6, z: -4 },
        { x: 0, z: -7 },
        { x: 6, z: -4 },
      ];
      const real = e.count % 3;
      Object.assign(e, points[real]);
      e.illusions = points.filter((_, i) => i !== real);
      for (const g of game.partners || [game]) g.lock = null;
    }
    e.face = Math.atan2(p.x - e.x, p.z - e.z);
    e.target = { x: p.x, z: p.z };
    game.emit('bossTell', { id: e.id, boss: e.boss, kind: e.attackKind, x: e.x, z: e.z });
  } else if (e.state === 'windup' && t >= e.until) {
    e.state = 'attack';
    e.begin = t;
    e.until = t + (e.phase === 2 ? 1.1 : 0.45);
    e.pulses = 0;
  } else if (e.state === 'attack') {
    const wanted = t - e.begin > 0.65 && e.phase === 2 ? 2 : 1;
    if (wanted > e.pulses) {
      e.pulses = wanted;
      for (const origin of [e, ...e.illusions]) {
        const aim = Math.atan2(e.target.x - origin.x, e.target.z - origin.z);
        const dirs =
          e.attackKind === 'salvo'
            ? [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4, aim]
            : [aim - 0.22, aim, aim + 0.22];
        for (const a of dirs)
          game.projectiles.push({
            id: game.serial++,
            x: origin.x + Math.sin(a),
            z: origin.z + Math.cos(a),
            vx: Math.sin(a) * 6.5,
            vz: Math.cos(a) * 6.5,
            until: t + 4,
            source: e.id,
            damage: 18,
            color: '#a9e8ff',
          });
      }
      game.emit('cast', { x: e.x, z: e.z });
    }
    if (t >= e.until) {
      e.state = 'recover';
      e.coreOpen = true;
      e.until = t + (e.phase === 2 ? 2 : 2.8);
      e.illusions = [];
      game.emit('coreOpen', { id: e.id, boss: e.boss, x: e.x, z: e.z });
    }
  }
  game.clampActor(e);
}
