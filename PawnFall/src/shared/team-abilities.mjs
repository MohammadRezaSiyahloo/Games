function intersection(a, b) {
  const rx = a.tx - a.x,
    rz = a.tz - a.z,
    sx = b.tx - b.x,
    sz = b.tz - b.z,
    den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-6) return null;
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = (dx * sz - dz * sx) / den,
    u = (dx * rz - dz * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * rx, z: a.z + t * rz } : null;
}

export function teamAbility(game, actor, a, lines) {
  if (!game.partners || a.enemy) return;
  const seat = game.partners.findIndex((g) => g.player === actor);
  if (seat < 0) return;
  const memory = (game.partners[0].teamMemory ||= []);
  const cast = { seat, piece: a.kind, time: game.time, from: { ...a.from }, lines, spent: false };
  const other = [...memory]
    .reverse()
    .find((c) => c.seat !== seat && game.time - c.time <= 1.5 && !c.spent);
  if (other) {
    const pair = [other.piece, cast.piece];
    if (pair.includes('rook') && pair.includes('bishop')) {
      let cross;
      for (const l of cast.lines) for (const r of other.lines) cross ||= intersection(l, r);
      if (cross && Math.abs(cross.x) <= 10.5 && Math.abs(cross.z) <= 10.5) {
        for (const e of [...game.enemies])
          if (!e.dead && Math.hypot(e.x - cross.x, e.z - cross.z) < 3.5) game.hitEnemy(e, 50, 90);
        game.emit('teamCombo', { kind: 'crossing', x: cross.x, z: cross.z });
        other.spent = cast.spent = true;
      }
    }
    if (pair.includes('king')) {
      const ally = game.partners[other.seat];
      if (ally.hp > 0 && Math.hypot(other.from.x - cast.from.x, other.from.z - cast.from.z) < 5) {
        actor.wardUntil = game.time + 4;
        ally.player.wardUntil = game.time + 4;
        game.emit('teamCombo', { kind: 'ward', x: actor.x, z: actor.z });
        other.spent = cast.spent = true;
      }
    }
  }
  memory.push(cast);
  while (memory.length > 4 || (memory[0] && game.time - memory[0].time > 2)) memory.shift();
}
