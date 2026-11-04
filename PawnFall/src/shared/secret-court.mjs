export function updateSecretCourt(game, input = {}, dt = 1 / 60) {
  if (
    game.training ||
    game.bossTrial ||
    game.wave < 1 ||
    game.wave > 3 ||
    game.enemies.some((e) => e.boss)
  )
    return;
  if (!game.secretFound && !game.secretPortal && game.objective?.progress >= game.objective?.goal) {
    game.secretPortal = { x: 8, z: 7, progress: 0, used: false };
    game.emit('secretRevealed');
  }
  const portal = game.secretPortal;
  if (!portal || portal.used) return;
  const team = game.partners || [game];
  const channel = team.some(
    (g) =>
      g.hp > 0 &&
      !g.player.block &&
      !team.some(
        (a) =>
          a !== g &&
          a.hp <= 0 &&
          !a.player.eliminated &&
          Math.hypot(a.player.x - g.player.x, a.player.z - g.player.z) < 2.5,
      ) &&
      (game.partners ? g.interacting : input.revive) &&
      Math.hypot(g.player.x - portal.x, g.player.z - portal.z) < 1.8 &&
      !['attack', 'ability', 'dodge', 'heal'].includes(g.player.state),
  );
  portal.progress = channel ? portal.progress + dt : 0;
  if (portal.progress >= 0.65) {
    portal.used = true;
    game.secretFound = true;
    for (const g of team) g.secretFound = true;
    const e = game.makeReinforcement(7);
    Object.assign(e, {
      type: 'queen',
      name: 'The Nameless Regent',
      hp: 300,
      max: 300,
      maxPoise: 180,
      x: 6,
      z: 5,
      secret: true,
      elite: true,
    });
    game.enemies.push(e);
    game.emit('secretEntered', { x: 6, z: 5 });
  }
}
