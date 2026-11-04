const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;

export function createArenaObjective(game) {
  if (game.training || game.bossTrial || game.enemies.some((e) => e.boss)) return null;
  if (game.wave === 0 && !game.expedition) return null;
  const kind =
    game.wave === 0
      ? 'defend'
      : ['capture', 'ritual', 'defend'][(game.chapter + game.wave - 1) % 3];
  if (game.wave >= 4) return null;
  const base = { kind, complete: false, failed: false, paid: false, reward: 150, progress: 0 };
  if (kind === 'capture')
    return {
      ...base,
      title: 'Claim the fallen throne',
      x: 0,
      z: -1,
      radius: 2.8,
      goal: 8,
      contested: false,
    };
  if (kind === 'ritual')
    return {
      ...base,
      title: 'Break the blood rite',
      goal: 3,
      sigils: [
        [-6, 0],
        [6, 0],
        [0, -6],
      ].map(([x, z], i) => ({ id: i, x, z, progress: 0, broken: false })),
    };
  return {
    ...base,
    title: 'Protect the wounded king',
    goal: 18,
    king: {
      id: 'objectiveKing',
      type: 'king',
      x: 0,
      z: 4,
      y: 0,
      face: Math.PI,
      hp: 180,
      max: 180,
      hitAt: -10,
      state: 'idle',
    },
  };
}

export function combatTargets(game) {
  const players = (game.partners || [game]).filter((g) => g.hp > 0).map((g) => g.player);
  const a = game.arenaObjective;
  if (a?.kind === 'defend' && !a.complete && !a.failed && a.king.hp > 0) players.push(a.king);
  return players;
}

export function hurtObjective(game, damage, target) {
  const a = game.arenaObjective;
  if (target?.id !== 'objectiveKing' || a?.kind !== 'defend') return false;
  if (a.complete || a.failed || game.time < (a.king.invuln || 0)) return true;
  a.king.hp = Math.max(0, a.king.hp - damage);
  a.king.hitAt = game.time;
  a.king.invuln = game.time + 0.35;
  game.emit('kingHurt', { x: a.king.x, z: a.king.z, hp: a.king.hp });
  if (!a.king.hp) {
    a.failed = true;
    a.king.dead = true;
  }
  return true;
}

export function updateArenaObjective(game, dt, input = {}) {
  const a = game.arenaObjective;
  if (!a || a.failed || a.complete || game.training || game.bossTrial) return;
  const team = (game.partners || [game]).filter((g) => g.hp > 0 && !g.player.dead);
  if (a.kind === 'capture') {
    a.contested = game.enemies.some((e) => !e.dead && near(e, a, a.radius + 0.6));
    a.occupied = team.some((g) => g.player.y < 0.8 && near(g.player, a, a.radius));
    if (a.occupied && !a.contested) a.progress = Math.min(a.goal, a.progress + dt);
  } else if (a.kind === 'ritual') {
    for (const s of a.sigils) {
      if (s.broken) continue;
      const channeling = team.some((g) => {
        const p = g.player;
        const reviving = game.partners?.some(
          (other) => other !== g && other.hp <= 0 && near(p, other.player, 2.4),
        );
        return (
          !reviving &&
          (game.partners ? g.interacting : input.revive) &&
          near(p, s, 1.8) &&
          p.y < 0.5 &&
          !p.block &&
          ['idle', 'walk'].includes(p.state) &&
          (p.speed || 0) < 0.2 &&
          game.time - (p.hitAt ?? -10) > 0.65
        );
      });
      // Holding together never speeds the channel; releasing or taking damage resets it.
      s.progress = channeling ? Math.min(2, s.progress + dt) : 0;
      if (s.progress >= 2) {
        s.broken = true;
        game.emit('sigilBroken', { x: s.x, z: s.z });
      }
    }
    a.progress = a.sigils.filter((s) => s.broken).length;
  } else {
    if (a.king.hp <= 0) {
      a.failed = true;
      return;
    }
    a.progress = game.enemies.every((e) => e.dead) ? a.goal : Math.min(a.goal, a.progress + dt);
  }
  if (a.progress >= a.goal) {
    a.complete = true;
    game.emit('arenaObjectiveComplete', { kind: a.kind });
  }
}

export function encounterComplete(game) {
  const a = game.arenaObjective;
  return game.enemies.every((e) => e.dead) && (!a || a.complete) && !a?.failed;
}

export function rewardArenaObjective(game) {
  const a = game.arenaObjective;
  if (!a || a.paid || !a.complete || a.failed || !encounterComplete(game)) return false;
  a.paid = true;
  for (const g of game.partners || [game]) g.souls += a.reward;
  game.emit('arenaObjectiveReward', { reward: a.reward });
  return true;
}

export function objectiveFailureRecap() {
  return {
    source: 'The wounded king',
    attack: 'The king has fallen',
    damage: 0,
    tip: 'Intercept enemies before they reach the king. Stagger or eliminate attackers to protect him.',
    recent: [],
  };
}
