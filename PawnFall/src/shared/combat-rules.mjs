export const DIFFICULTIES = {
  pilgrim: {
    name: 'Pilgrim',
    hint: 'Longer tells, one attacker at a time. Learn the court.',
    hp: 0.9,
    damage: 0.75,
    speed: 0.9,
    windup: 1.25,
    recovery: 1.2,
    attackers: 1,
    heal: 25,
    guardRegen: 12,
    pursuit: 1,
  },
  standard: {
    name: 'Standard',
    hint: 'Faster flanks, two active attackers, slower guard recovery. Only 10 vitality restored between fights.',
    hp: 1.2,
    damage: 1.2,
    speed: 1.12,
    windup: 0.94,
    recovery: 0.8,
    attackers: 2,
    heal: 10,
    guardRegen: 8,
    pursuit: 1.3,
  },
  veteran: {
    name: 'Veteran',
    hint: 'Three attackers, short punish windows. Seven vitality restored between fights.',
    hp: 1.32,
    damage: 1.45,
    speed: 1.2,
    windup: 0.82,
    recovery: 0.68,
    attackers: 3,
    heal: 7,
    guardRegen: 6,
    pursuit: 1.35,
  },
  nightmare: {
    name: 'Nightmare',
    hint: 'Relentless pressure and scarce recovery. Five vitality restored between fights.',
    hp: 1.46,
    damage: 1.65,
    speed: 1.25,
    windup: 0.72,
    recovery: 0.6,
    attackers: 3,
    heal: 5,
    guardRegen: 5,
    pursuit: 1.4,
  },
};
export const difficultyById = (id) => DIFFICULTIES[id] || DIFFICULTIES.standard;
export const validDifficulty = (id) => (Object.hasOwn(DIFFICULTIES, id) ? id : 'standard');
export const postureByType = { pawn: 55, knight: 85, bishop: 75, rook: 135, queen: 180, king: 160 };

export function hazardContains(h, p) {
  if (h.shape === 'circle') return Math.hypot(p.x - h.x, p.z - h.z) < h.radius;
  const value =
    h.axis === 'diagA'
      ? (p.x - p.z) / Math.SQRT2
      : h.axis === 'diagB'
        ? (p.x + p.z) / Math.SQRT2
        : p[h.axis];
  return Math.abs(value - h.lane) < (h.width || 0.85);
}

export function updateHazards(game, dt) {
  if (game.training || game.wave < 1 || game.enemies.some((e) => e.boss && !e.dead)) {
    game.hazards = [];
    return;
  }
  const t = game.time;
  game.hazards ||= [];
  if (!game.enemies.some((e) => !e.dead)) {
    game.hazards = [];
    return;
  }
  if (t >= (game.hazardAt ?? t + 1)) {
    const n = (game.hazardCount = (game.hazardCount || 0) + 1);
    const h = {
      id: 'hazard:' + n,
      axis: n % 2 ? 'x' : 'z',
      lane: [-5, 0, 5][n % 3],
      fireAt: t + 1.65,
      until: t + 2.05,
      hit: [],
    };
    h.realm = game.chapter || 0;
    if (h.realm === 1) {
      h.width = 0.6;
      h.fireAt = t + 1.9;
      h.until = t + 2.3;
    }
    if (h.realm === 2) {
      h.shape = 'circle';
      h.x = game.player.x;
      h.z = game.player.z;
      h.radius = 2.1;
      h.fireAt = t + 1.7;
      h.until = t + 2.2;
    }
    if (h.realm === 3) {
      h.axis = n % 2 ? 'diagA' : 'diagB';
      h.lane = 0;
      h.fireAt = t + 1.8;
      h.until = t + 2.2;
    }
    game.hazards.push(h);
    game.hazardAt = t + 9;
    game.emit('hazardTell', { axis: h.axis, lane: h.lane });
  }
  for (const h of game.hazards)
    if (t >= h.fireAt && t < h.until) {
      for (const g of game.partners || [game])
        if (g.hp > 0 && !h.hit.includes(g.player.id) && hazardContains(h, g.player)) {
          h.hit.push(g.player.id);
          g.hurtPlayer(18 * difficultyById(game.difficulty).damage, {
            x: g.player.x + 1,
            z: g.player.z + 1,
            source: h.id,
            unblockable: true,
          });
        }
    }
  game.hazards = game.hazards.filter((h) => t < h.until);
}
