export function updateArenaShifts(game) {
  if (
    game.training ||
    game.bossTrial ||
    game.wave < 1 ||
    game.enemies.some((e) => e.boss && !e.dead) ||
    !game.enemies.some((e) => !e.dead)
  ) {
    game.arenaShift = null;
    return;
  }
  const t = game.time;
  let s = game.arenaShift;
  if (!s && t >= (game.shiftAt ?? Infinity)) {
    const kind = (game.shiftCount || 0) % 2 ? 'collapse' : 'gates';
    game.shiftCount = (game.shiftCount || 0) + 1;
    s = game.arenaShift = {
      kind,
      phase: 'warning',
      begin: t,
      fireAt: t + 2.2,
      until: t + 10,
      hit: [],
    };
    game.shiftAt = t + 22;
    game.emit('arenaShiftTell', { kind });
  }
  if (!s) return;
  if (t >= s.until) {
    game.arenaShift = null;
    return;
  }
  if (t >= s.fireAt && s.phase === 'warning') {
    s.phase = 'active';
    game.emit('arenaShiftImpact', { kind: s.kind, x: -4, z: 1 });
    if (s.kind === 'collapse')
      for (const g of game.partners || [game])
        if (g.hp > 0 && Math.hypot(g.player.x + 4, g.player.z - 1) < 2.3)
          g.hurtPlayer(22, { x: -4, z: 1, source: 'hazard:collapse', unblockable: true });
  }
  if (s.phase === 'active') {
    const blocks =
      s.kind === 'gates'
        ? [
            { x: -4, z: 1 },
            { x: 4, z: 1 },
          ]
        : [{ x: -4, z: 1 }];
    for (const a of [
      ...(game.partners || [game]).map((g) => g.player),
      ...game.enemies.filter((e) => !e.dead && e.y < 1),
    ])
      for (const b of blocks) {
        const d = Math.hypot(a.x - b.x, a.z - b.z),
          r = (a.radius || 0.6) + 1.1;
        if (d < r) {
          const dx = d ? (a.x - b.x) / d : 1,
            dz = d ? (a.z - b.z) / d : 0;
          a.x = b.x + dx * r;
          a.z = b.z + dz * r;
          game.clampActor(a);
        }
      }
    game.projectiles = game.projectiles.filter(
      (p) => !blocks.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < 1.1),
    );
  }
}
