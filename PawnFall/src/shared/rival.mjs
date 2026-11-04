export function placeRival(game) {
  if (
    game.training ||
    game.bossTrial ||
    (game.enemies.some((e) => e.boss) && !(game.expedition && game.wave === 3)) ||
    ![1, 3].includes(game.wave)
  )
    return;
  let e = game.enemies.find((e) => e.type === 'knight');
  if (!e && game.expedition && game.wave === 3) {
    e = game.makeReinforcement(6);
    game.enemies.push(e);
  }
  if (!e) return;
  const returning = game.wave === 3;
  e.rival = true;
  e.returning = returning;
  e.name = returning ? 'Ser Veyr, the Scarred' : 'Ser Veyr, the Red Huntmaster';
  e.adaptation = returning ? game.rivalMemory?.adaptation || 'sentinel' : null;
  e.guardCapable = e.adaptation === 'sentinel';
  e.elite = true;
  e.hp = e.max = Math.round(e.max * (returning ? 1.35 : 1.1));
  e.championHint = returning
    ? e.adaptation === 'breaker'
      ? 'His red-marked second leap breaks guard. Dodge it, then punish recovery.'
      : e.adaptation === 'hunter'
        ? 'He learned your heavy attacks: bait both leaps, then strike during recovery.'
        : 'He learned your quick attacks: flank his frontal guard or use a heavy strike.'
    : 'He retreats when wounded. Remember his name.';
}

export function rivalRetreat(game, e, applied) {
  if (!e.rival || e.returning || e.dead || e.hp - applied > e.max * 0.3) return false;
  const team = game.partners || [game];
  const total = (key) => team.reduce((n, g) => n + (g.tactics?.[key] || 0), 0);
  const adaptation =
    total('blocks') > total('heavy') + 2
      ? 'breaker'
      : total('heavy') > total('light')
        ? 'hunter'
        : 'sentinel';
  for (const g of team) g.rivalMemory = { escaped: true, defeated: false, adaptation };
  e.hp = 1;
  e.dead = true;
  e.escaped = true;
  e.state = 'retreat';
  e.until = game.time + 1.2;
  e.ability = null;
  game.emit('rivalRetreat', { id: e.id, x: e.x, z: e.z, adaptation });
  return true;
}
