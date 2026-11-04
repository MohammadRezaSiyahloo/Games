export const BESTIARY = [
  {
    id: 'pawn',
    name: 'Hollow Pawn',
    group: 'soldiers',
    symbol: '♟',
    attacks:
      'A forward sword strike, occasional frontal guard, and a marked diagonal capture ability.',
    counter:
      'Face the strike to parry, or flank its shield. Do not spend all your stamina on a guarded target.',
  },
  {
    id: 'knight',
    name: 'Fallen Knight',
    group: 'soldiers',
    symbol: '♞',
    attacks:
      'Flanks your approach, then leaps to a committed landing. Its piece ability traces an L.',
    counter:
      'Move sideways after the aim commits. Punish the landing recovery rather than chasing the jump.',
  },
  {
    id: 'bishop',
    name: 'Hollow Bishop',
    group: 'soldiers',
    symbol: '♝',
    attacks:
      'Retreats to maintain distance and alternates single bolts with a three-bolt spread. Its special strikes diagonals.',
    counter:
      'Cross the projectile path instead of running along it. Close the gap during recovery and leave marked diagonals.',
  },
  {
    id: 'rook',
    name: 'Iron Rook',
    group: 'soldiers',
    symbol: '♜',
    attacks: 'Guards its front, screens nearby bishops, and alternates charges with broad slams.',
    counter:
      'Leave its committed charge lane, flank the shield, or use a heavy strike. Avoid the marked slam area.',
  },
  {
    id: 'queen',
    name: 'Fallen Queen',
    group: 'soldiers',
    symbol: '♛',
    attacks: 'Chains three wide strikes and periodically attacks ranks, files and diagonals.',
    counter:
      'Wait for all three strikes before committing to an attack. Preserve enough stamina to evade the full sequence.',
  },
  {
    id: 'king',
    name: 'Hollow King',
    group: 'soldiers',
    symbol: '♚',
    attacks: 'Durable melee fighter whose Castling Ward grants temporary protection.',
    counter: 'Bait the melee windup and punish recovery. Reposition while its ward is active.',
  },
  {
    id: 'champion-knight',
    name: 'The Red Huntmaster',
    group: 'champions',
    symbol: '♞',
    attacks: 'Two marked leaps, increased vitality and posture, followed by a longer recovery.',
    counter: 'Dodge both landings. The second tell remains visible; punish after the second jump.',
  },
  {
    id: 'champion-bishop',
    name: 'The Ashen Cantor',
    group: 'champions',
    symbol: '♝',
    attacks:
      'Two consecutive volleys before a longer recovery. The second cast has its own windup.',
    counter: 'Keep moving through both casts, then close in during the extended recovery.',
  },
  {
    id: 'champion-rook',
    name: 'The Iron Marshal',
    group: 'champions',
    symbol: '♜',
    attacks:
      'Its frontal guard wards nearby allies. The ward is inactive while it staggers or recovers.',
    counter:
      'Flank the Marshal to expose it for two seconds, parry it, or break its posture to remove protection.',
  },
  {
    id: 'rival',
    name: 'Ser Veyr',
    group: 'champions',
    symbol: '♞',
    attacks:
      'Retreats when first wounded and returns scarred. Quick attacks teach him a guard; heavies teach a double leap; frequent guarding adds an unblockable second leap.',
    counter:
      'Read the returning variant. Use heavies or flanks against his guard, and dodge the red second-leap tell rather than blocking it.',
  },
  {
    id: 'castellan',
    name: 'The Iron Castellan',
    group: 'bosses',
    symbol: '♜',
    attacks:
      'Armored siege engine with fixed charge lanes and hammer slams. Phase II adds double slams and cross-board attacks.',
    counter:
      'Bait the committed charge, leave its lane, and punish the exposed core. Breaking posture creates a longer opening.',
  },
  {
    id: 'confessor',
    name: 'The Pale Confessor',
    group: 'bosses',
    symbol: '♝',
    attacks: 'Crossed projectiles and a mirror rite. Phase II adds a delayed second volley.',
    counter:
      'Its doubles cast no shadows. Identify the real bishop, dodge both volleys, and punish the exposed recovery.',
  },
  {
    id: 'fallenking',
    name: 'The Fallen King',
    group: 'bosses',
    symbol: '♚',
    attacks:
      'Commands a bounded royal guard. At half vitality he sacrifices survivors, fights alone, and gains stronger sweeps and a cross if a living bishop was sacrificed.',
    counter:
      'Kill royal bishops before the sacrifice to deny the stolen cross. Dodge both sword sweeps, leave committed cross lanes, and punish the exposed crown.',
  },
];

export function cleanDiscoveries(data) {
  return Array.isArray(data)
    ? [...new Set(data.filter((id) => BESTIARY.some((e) => e.id === id)))].slice(0, BESTIARY.length)
    : [];
}

export function encounteredEntries(enemies = []) {
  const ids = [];
  for (const e of enemies) {
    if (e.isAvatar || e.escaped) continue;
    if (e.boss) ids.push(e.boss);
    else ids.push(e.type);
    if (e.champion) ids.push('champion-' + e.champion);
    if (e.rival) ids.push('rival');
  }
  return cleanDiscoveries(ids);
}

export function discoverEnemies(progress, game) {
  if (
    game.mode !== 'playing' ||
    game.training ||
    game.routeChoices?.length ||
    game.upgradeChoices?.length ||
    game.promotionChoices?.length ||
    game.eventChoices?.length ||
    game.waitingForAlly
  )
    return false;
  const old = cleanDiscoveries(progress.data.encountered),
    next = cleanDiscoveries([...old, ...encounteredEntries(game.enemies)]);
  if (next.length === old.length) return false;
  progress.data.encountered = next;
  progress.save();
  return true;
}

export function bestiaryEntries(discovered, filter = 'all', query = '') {
  const known = new Set(cleanDiscoveries(discovered)),
    text = String(query).trim().toLowerCase().slice(0, 80);
  return BESTIARY.filter(
    (e) =>
      (filter === 'all' || e.group === filter) &&
      (!text ||
        (known.has(e.id)
          ? (e.name + ' ' + e.attacks + ' ' + e.counter).toLowerCase().includes(text)
          : 'undiscovered'.includes(text))),
  );
}

export function discoveriesFromStats(stats = {}) {
  return [
    ['castellanKills', 'castellan'],
    ['confessorKills', 'confessor'],
    ['fallenKingKills', 'fallenking'],
  ]
    .filter(([key]) => Number.isFinite(stats[key]) && stats[key] > 0)
    .map(([, id]) => id);
}
