const TRACKED = new Set([
  'wave',
  'cleared',
  'routeChosen',
  'promoted',
  'eventChosen',
  'rivalRetreat',
  'rivalDefeated',
  'bossDefeated',
  'teamCombo',
  'championDefeated',
]);

export function recordChronicle(game, type, data = {}) {
  if (!TRACKED.has(type) || game.training) return;
  game.journal ||= [];
  const row = { type, wave: game.wave, time: Math.round(game.time || 0) };
  for (const key of ['title', 'route', 'piece', 'choice', 'boss', 'kind', 'adaptation'])
    if (typeof data[key] === 'string') row[key] = data[key].slice(0, 100);
  game.journal.push(row);
  if (game.journal.length > 100) game.journal.shift();
}

export function cleanJournal(data) {
  return Array.isArray(data)
    ? data
        .slice(-100)
        .filter(
          (r) => r && TRACKED.has(r.type) && Number.isInteger(r.wave) && r.wave >= 0 && r.wave <= 5,
        )
        .map((r) => {
          const row = {
            type: r.type,
            wave: r.wave,
            time: Number.isFinite(r.time) ? Math.max(0, Math.min(36000, r.time)) : 0,
          };
          for (const k of ['title', 'route', 'piece', 'choice', 'boss', 'kind', 'adaptation'])
            if (typeof r[k] === 'string') row[k] = r[k].slice(0, 100);
          return row;
        })
    : [];
}

export function chronicleData(game, result = 'Run ended') {
  const journal = cleanJournal(game.journal),
    last = (type) => [...journal].reverse().find((r) => r.type === type);
  return {
    title: 'PAWNFALL · RUN CHRONICLE',
    result: String(result).slice(0, 80),
    piece: game.chessClass || 'pawn',
    weapon: game.weapon || 'longsword',
    souls: Math.max(0, Math.floor(game.souls || 0)),
    seconds: Math.floor(game.time || 0),
    encounters: game.endless?.cleared ?? journal.filter((r) => r.type === 'cleared').length,
    promotion: last('promoted')?.piece || 'None',
    routes: journal
      .filter((r) => r.type === 'routeChosen')
      .map((r) => 'Encounter ' + (r.wave + 1) + ': ' + r.route),
    events: journal
      .filter((r) => r.type === 'eventChosen' && r.choice !== 'decline')
      .map((r) => r.choice),
    champions: journal.filter((r) => r.type === 'championDefeated').map((r) => r.title),
    bosses: journal.filter((r) => r.type === 'bossDefeated').map((r) => r.boss),
    rival: last('rivalDefeated')
      ? 'Defeated'
      : last('rivalRetreat')
        ? 'Escaped; awaits your return'
        : 'Not encountered',
    combos: journal.filter((r) => r.type === 'teamCombo').length,
    blessings: Object.entries(game.upgrades || {})
      .filter(([, v]) => Number.isInteger(v) && v > 0)
      .map(([k, v]) => k + ' ' + v),
  };
}

export function chronicleText(d) {
  const names = {
    fallenking: 'Fallen King',
    confessor: 'Pale Confessor',
    castellan: 'Iron Castellan',
    twinblades: 'Twin blades',
    sanctuary: 'Quiet passage',
    champion: 'Champion challenge',
    onslaught: 'Crowded court',
    bargain: 'Bishop’s bargain',
    duel: 'Wounded knight duel',
    temper: 'Tempered steel',
  };
  const pretty = (v) => names[v] || String(v).replace('forge:', 'Forged ').replace(/_/g, ' ');
  return [
    d.title,
    d.result,
    `${pretty(d.piece)} · ${pretty(d.weapon)} · ${d.souls} souls`,
    `${d.encounters} encounters · ${Math.floor(d.seconds / 60)}m ${d.seconds % 60}s`,
    `Promotion: ${d.promotion}`,
    `Routes: ${d.routes.join(' / ') || 'None'}`,
    `Blessings: ${d.blessings.join(', ') || 'None'}`,
    `Events: ${d.events.map(pretty).join(', ') || 'None'}`,
    `Bosses: ${d.bosses.map(pretty).join(', ') || 'None'}`,
    `Champions: ${d.champions.join(', ') || 'None'}`,
    `Rival: ${d.rival}`,
    `Team combinations: ${d.combos}`,
  ].join('\n');
}
