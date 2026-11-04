import { teamAbility } from './team-abilities.mjs';
import { combatTargets } from './arena-objectives.mjs';
// Chess movement becomes a readable, real-time special attack. Units are arena units.
export const PIECES = [
  {
    id: 'pawn',
    symbol: '♟',
    name: 'Pawn',
    ability: 'Pawn Breakthrough',
    text: 'Advance one square, then strike your two forward diagonals.',
    cooldown: 14,
  },
  {
    id: 'knight',
    symbol: '♞',
    name: 'Knight',
    ability: 'L-Shaped Vault',
    text: 'Vault in an L and strike the landing area.',
    cooldown: 18,
  },
  {
    id: 'bishop',
    symbol: '♝',
    name: 'Bishop',
    ability: 'Diagonal Judgement',
    text: 'Send a strike down all four board diagonals.',
    cooldown: 22,
  },
  {
    id: 'rook',
    symbol: '♜',
    name: 'Rook',
    ability: 'File Breaker',
    text: 'Charge along a rank or file, striking the lane.',
    cooldown: 20,
  },
  {
    id: 'queen',
    symbol: '♛',
    name: 'Queen',
    ability: 'Royal Dominion',
    text: 'Strike all eight ranks, files, and diagonals.',
    cooldown: 28,
  },
  {
    id: 'king',
    symbol: '♚',
    name: 'King',
    ability: 'Castling Ward',
    text: 'Step two squares sideways, strike nearby foes, and halve incoming damage for four seconds.',
    cooldown: 24,
  },
];
export const pieceById = (id) => PIECES.find((p) => p.id === id) || PIECES[0];

export function abilityGeometry(a) {
  const { kind, from, aim } = a,
    diagonal = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  const lines = [];
  const ray = (angle, length, width) =>
    lines.push({
      x: from.x,
      z: from.z,
      tx: from.x + Math.sin(angle) * length,
      tz: from.z + Math.cos(angle) * length,
      width,
    });
  if (kind === 'bishop' || kind === 'queen') for (const angle of diagonal) ray(angle, 14, 0.75);
  if (kind === 'queen')
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) ray(angle, 14, 0.75);
  if (kind === 'rook')
    lines.push({ x: from.x, z: from.z, tx: a.target.x, tz: a.target.z, width: 1.2 });
  if (kind === 'knight') {
    lines.push({ x: from.x, z: from.z, tx: a.corner.x, tz: a.corner.z, width: 0.4 });
    lines.push({ x: a.corner.x, z: a.corner.z, tx: a.target.x, tz: a.target.z, width: 0.4 });
  }
  if (kind === 'pawn')
    for (const d of [-Math.PI / 4, Math.PI / 4]) {
      const angle = Math.atan2(aim.x, aim.z) + d;
      lines.push({
        x: a.target.x,
        z: a.target.z,
        tx: a.target.x + Math.sin(angle) * 3.96,
        tz: a.target.z + Math.cos(angle) * 3.96,
        width: 0.9,
      });
    }
  return lines;
}

export function pointInLane(p, line) {
  const dx = line.tx - line.x,
    dz = line.tz - line.z,
    den = dx * dx + dz * dz;
  const k = den ? Math.max(0, Math.min(1, ((p.x - line.x) * dx + (p.z - line.z) * dz) / den)) : 0;
  return Math.hypot(p.x - line.x - dx * k, p.z - line.z - dz * k) < line.width;
}

export function beginAbility(game, actor, kind, enemy = false) {
  const horizontal = Math.abs(Math.sin(actor.face)) > Math.abs(Math.cos(actor.face));
  const aim = {
    x: horizontal ? Math.sign(Math.sin(actor.face)) || 1 : 0,
    z: horizontal ? 0 : Math.sign(Math.cos(actor.face)) || 1,
  };
  const from = { x: actor.x, z: actor.z },
    clamp = (x) => Math.max(-10, Math.min(10, x));
  const target = { ...from };
  let corner = { ...from };
  if (kind === 'knight') {
    corner = { x: clamp(from.x + aim.x * 5.6), z: clamp(from.z + aim.z * 5.6) };
    target.x = clamp(corner.x + (aim.z ? 2.8 : 0));
    target.z = clamp(corner.z + (aim.x ? 2.8 : 0));
  }
  if (kind === 'rook' || kind === 'pawn') {
    const length = kind === 'rook' ? 8.4 : 2.8;
    target.x = clamp(from.x + aim.x * length);
    target.z = clamp(from.z + aim.z * length);
  }
  if (kind === 'king') {
    target.x = clamp(from.x + (aim.z ? 5.6 : 0));
    target.z = clamp(from.z + (aim.x ? 5.6 : 0));
  }
  const windup = enemy ? 1.15 : 0.5,
    duration = windup + 0.5;
  actor.ability = {
    kind,
    enemy,
    from,
    target,
    corner,
    aim,
    begin: game.time,
    fireAt: game.time + windup,
    end: game.time + duration,
    fired: false,
  };
  actor.state = 'ability';
  actor.block = false;
  actor.attackEnd = game.time + duration;
  actor.attackHit = true;
  game.emit('abilityTell', { id: actor.id, kind, x: from.x, z: from.z, enemy });
}

export function tickAbility(game, actor) {
  const a = actor.ability;
  if (!a) return;
  const t = game.time,
    k = Math.max(0, Math.min(1, (t - a.fireAt + 0.35) / 0.35));
  if (['pawn', 'rook', 'knight', 'king'].includes(a.kind)) {
    if (a.kind === 'knight') {
      const bend = 2 / 3;
      const start = k < bend ? a.from : a.corner,
        end = k < bend ? a.corner : a.target;
      const progress = k < bend ? k / bend : (k - bend) / (1 - bend);
      actor.x = start.x + (end.x - start.x) * progress;
      actor.z = start.z + (end.z - start.z) * progress;
    } else {
      actor.x = a.from.x + (a.target.x - a.from.x) * k;
      actor.z = a.from.z + (a.target.z - a.from.z) * k;
    }
    actor.y = a.kind === 'knight' ? Math.sin(k * Math.PI) * 2.8 : 0;
  }
  if (t >= a.fireAt && !a.fired) {
    a.fired = true;
    if (a.kind === 'king') actor.wardUntil = t + 4;
    const lines = abilityGeometry(a);
    const targets = a.enemy ? combatTargets(game) : game.enemies.filter((e) => !e.dead);
    for (const target of targets) {
      const hit =
        a.kind === 'knight' || a.kind === 'king'
          ? Math.hypot(target.x - a.target.x, target.z - a.target.z) <
            (a.kind === 'king' ? 2.7 : 2.5)
          : lines.some((line) => pointInLane(target, line));
      if (hit) {
        const damage = a.enemy ? 22 : a.kind === 'queen' ? 36 : 44;
        if (a.enemy) game.hurtTarget(damage, actor, target);
        else game.hitEnemy(target, damage, 75);
      }
    }
    teamAbility(game, actor, a, lines);
    game.emit('abilityImpact', { id: actor.id, kind: a.kind, x: a.target.x, z: a.target.z });
  }
  if (t >= a.end) {
    actor.y = 0;
    actor.ability = null;
    actor.state = a.enemy ? 'recover' : 'idle';
    actor.until = t + 1.1;
  }
}
