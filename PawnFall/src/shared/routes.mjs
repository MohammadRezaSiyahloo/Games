export const ROUTES = [
  {
    id: 'sanctuary',
    name: 'The quiet passage',
    risk: 'RECOVERY',
    text: 'Face the regular encounter. Restore 25 vitality and gain one flask now.',
    reward: 'Recover before the next fight.',
  },
  {
    id: 'champion',
    name: 'The champion’s challenge',
    risk: 'DUEL A CHAMPION',
    text: 'A named champion leads the next encounter. Read its tell and exploit its weakness.',
    reward: 'Clear reward: 200 souls and one extra blessing.',
  },
  {
    id: 'onslaught',
    name: 'The crowded court',
    risk: 'REINFORCEMENTS',
    text: 'Two extra knights join the next encounter. Manage your space and stamina.',
    reward: 'Clear reward: 150 souls and one flask.',
  },
];
export const CHAMPIONS = {
  rook: {
    name: 'The Iron Marshal',
    hint: 'Its guard wards nearby allies. Flank or stagger the Marshal to break the ward.',
  },
  bishop: {
    name: 'The Ashen Cantor',
    hint: 'Two volleys, one long recovery. Keep moving until the second cast.',
  },
  knight: {
    name: 'The Red Huntmaster',
    hint: 'Two marked leaps. Dodge both landings, then punish the long recovery.',
  },
};

export function routeAvailable(game) {
  return (
    !game.training &&
    !game.bossTrial &&
    game.wave > 0 &&
    game.wave < 4 &&
    !game.enemies.some((e) => e.boss)
  );
}

export function cleanRoute(route) {
  return route && ROUTES.some((r) => r.id === route.id)
    ? { id: route.id, paid: !!route.paid }
    : null;
}

export function applyEncounterRoute(game) {
  const id = game.route?.id;
  if (!routeAvailable(game)) return;
  if (id === 'champion') {
    const e = game.enemies.find((e) => CHAMPIONS[e.type]) || game.enemies[0];
    if (!CHAMPIONS[e.type]) return;
    e.champion = e.type;
    if (!e.rival) e.name = CHAMPIONS[e.type].name;
    e.championHint = CHAMPIONS[e.type].hint;
    e.elite = true;
    e.hp = e.max = Math.round(e.max * 1.45);
    e.maxPoise *= 1.2;
  }
  if (id === 'onslaught') {
    // Spawn through the same factory as regular enemies; no copied combat timers.
    for (const x of [-8, 8]) game.enemies.push(game.makeReinforcement(x));
  }
}

export function rewardRoute(game) {
  const route = game.route;
  if (!route || route.paid || !game.enemies.every((e) => e.dead)) return false;
  route.paid = true;
  if (route.id === 'champion') {
    game.souls += 200;
    game.pendingBlessings = 1;
  }
  if (route.id === 'onslaught') {
    game.souls += 150;
    game.flasks = Math.min(12, game.flasks + 1);
  }
  game.emit('routeReward', { route: route.id });
  return true;
}

export function updateChampionWards(game) {
  for (const e of game.enemies) {
    const marshal = game.enemies.find(
      (m) =>
        m !== e &&
        m.champion === 'rook' &&
        !m.dead &&
        m.guarding &&
        game.time >= (m.exposedUntil || 0) &&
        ['approach', 'windup'].includes(m.state) &&
        Math.hypot(e.x - m.x, e.z - m.z) < 4,
    );
    e.championWarded = !!marshal;
  }
}
