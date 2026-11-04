import { phaseChangeReady, enterSecondPhase, emitBossPhase } from './boss-phases.mjs';
export const FALLEN_KING = { name: 'The Fallen King', hp: 1100, souls: 2400, poise: 160 };

export function createFallenKing(id, time, players = 1) {
  const hp = Math.round(FALLEN_KING.hp * (players > 1 ? 1.45 : 1));
  return {
    id,
    type: 'king',
    boss: 'fallenking',
    name: FALLEN_KING.name,
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
    dead: false,
    radius: 1.15,
    poise: 0,
    maxPoise: 160,
    coreOpen: false,
    breakImmuneUntil: 0,
    sacrifices: 0,
    hitSeats: [],
    attackKind: 'edict',
  };
}

export function royalGuard(id, type, x, z, time) {
  const hp = type === 'bishop' ? 95 : 80;
  return {
    id,
    type,
    x,
    z,
    y: 0,
    face: 0,
    hp,
    max: hp,
    state: 'approach',
    until: 0,
    cooldown: time + 2,
    role: 'sentinel',
    flankSide: x < 0 ? -1 : 1,
    guardCapable: type === 'pawn',
    maxPoise: 75,
    count: 0,
    dead: false,
    royal: true,
    activeHit: false,
  };
}

export function kingDamage(game, e, damage, poise = damage) {
  const open = e.coreOpen || e.state === 'stagger';
  e.poise = (e.poise || 0) + poise * (open ? 1 : 0.35);
  if (e.poise >= e.maxPoise && game.time >= e.breakImmuneUntil) {
    e.poise = 0;
    e.state = 'stagger';
    e.coreOpen = true;
    e.until = game.time + 2.6;
    e.begin = game.time;
    e.breakImmuneUntil = game.time + 8;
    game.emit('stagger', { id: e.id, x: e.x, z: e.z, boss: true });
  }
  return damage * (open ? 1.35 : 0.65);
}

export function updateFallenKing(game, e, dt) {
  const t = game.time,
    targets = (game.partners || [game]).filter((g) => g.hp > 0).map((g) => g.player);
  const p = targets[e.count % targets.length] || game.player;
  if (phaseChangeReady(e)) {
    e.stolenBishop = game.enemies.some((g) => g.royal && !g.dead && g.type === 'bishop');
    enterSecondPhase(game, e, 2);
    for (const guard of game.enemies.filter((g) => g.royal && !g.dead)) {
      guard.dead = true;
      guard.state = 'dead';
      guard.until = t + 0.8;
      e.sacrifices++;
    }
    e.stolen = game.enemies.some((g) => g.royal && g.type === 'bishop') ? 'bishop' : 'pawn';
    game.emit('royalSacrifice', { id: e.id, x: e.x, z: e.z, count: e.sacrifices });
    emitBossPhase(game, e);
    return;
  }
  if (['enrage', 'stagger', 'exposed'].includes(e.state)) {
    if (t >= e.until) {
      e.state = 'approach';
      e.cooldown = t + 0.6;
      e.coreOpen = false;
    }
    return;
  }
  if (e.state === 'approach') {
    e.face = Math.atan2(p.x - e.x, p.z - e.z);
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d > 4.5) {
      e.x += Math.sin(e.face) * dt * (e.phase === 2 ? 2.4 : 1.5);
      e.z += Math.cos(e.face) * dt * (e.phase === 2 ? 2.4 : 1.5);
    }
    if (t >= e.cooldown) {
      e.attackKind =
        e.phase === 1
          ? e.count % 2
            ? 'sweep'
            : 'edict'
          : e.count % 2 && e.stolenBishop
            ? 'royalCross'
            : 'doubleSweep';
      e.state = 'windup';
      e.begin = t;
      e.until = t + (e.attackKind === 'royalCross' ? 1.5 : 1.25);
      e.target = e.attackKind === 'royalCross' ? { x: p.x, z: p.z } : { x: e.x, z: e.z };
      e.hitSeats = [];
      e.pulses = 0;
      e.count++;
      game.emit('bossTell', { id: e.id, boss: 'fallenking', kind: e.attackKind, x: e.x, z: e.z });
    }
  } else if (e.state === 'windup' && t >= e.until) {
    e.state = 'attack';
    e.begin = t;
    e.until = t + (e.attackKind === 'doubleSweep' ? 1.15 : 0.5);
    if (e.attackKind === 'edict') {
      for (const guard of game.enemies.filter((g) => g.royal && !g.dead)) {
        guard.cooldown = t + 0.25;
        guard.targetId = p.id;
        guard.commandedUntil = t + 3;
      }
      // Only replace fallen guards, with a strict cap and an arrival tell.
      if (game.enemies.filter((g) => g.royal && !g.dead).length < 2 && e.count <= 5) {
        const g = royalGuard('e' + game.serial++, e.count % 2 ? 'bishop' : 'pawn', e.x + 3, e.z, t);
        g.cooldown = t + 1.4;
        game.enemies.push(g);
      }
      game.emit('royalCommand', { id: e.id, x: e.x, z: e.z });
    }
  } else if (e.state === 'attack') {
    const pulse = e.attackKind === 'doubleSweep' && t - e.begin > 0.6 ? 1 : 0;
    if (pulse !== e.pulses) {
      e.pulses = pulse;
      e.hitSeats = [];
    }
    for (const target of targets) {
      let hit = false;
      if (e.attackKind === 'royalCross')
        hit = Math.abs(target.x - e.target.x) < 1.05 || Math.abs(target.z - e.target.z) < 1.05;
      else if (e.attackKind !== 'edict') hit = Math.hypot(target.x - e.x, target.z - e.z) < 4.5;
      if (hit && !e.hitSeats.includes(target.id)) {
        e.hitSeats.push(target.id);
        game.hurtTarget(28 + (e.phase === 2 ? 3 + Math.min(6, e.sacrifices * 2) : 0), e, target);
      }
    }
    if (t >= e.until) {
      e.state = 'exposed';
      e.coreOpen = true;
      e.begin = t;
      e.until = t + (e.phase === 2 ? 2 : 2.5);
      game.emit('coreOpen', { id: e.id, x: e.x, z: e.z, boss: 'fallenking' });
    }
  }
  game.clampActor(e);
}
