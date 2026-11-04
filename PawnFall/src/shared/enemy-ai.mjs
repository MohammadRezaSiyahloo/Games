import { combatTargets } from './arena-objectives.mjs';
import { updateChampionWards } from './routes.mjs';
import { difficultyById } from './combat-rules.mjs';
import { beginAbility } from './piece-abilities.mjs';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function updateEnemy(game, e, dt, stats) {
  const t = game.time,
    st = stats[e.type],
    rule = difficultyById(game.difficulty);
  const players = combatTargets(game);
  const closest = [...players].sort((a, b) => distance(a, e) - distance(b, e))[0] || game.player;
  const p = e.state === 'approach' ? closest : players.find((p) => p.id === e.targetId) || closest;
  if (e.state === 'approach') e.targetId = p.id;
  const d = distance(e, p),
    facing = Math.atan2(p.x - e.x, p.z - e.z);
  e.guarding =
    !!e.guardCapable &&
    t >= (e.exposedUntil || 0) &&
    d < 4.4 &&
    (e.state === 'approach' ||
      (e.state === 'windup' && t < e.begin + (e.windupDuration || st.windup) * 0.55));
  updateChampionWards(game);
  if (e.state === 'stagger') {
    if (t >= e.until) e.state = 'approach';
    return;
  }
  if (game.training?.behavior === 'dummy') {
    e.guarding = false;
    e.state = 'approach';
    return;
  }
  if (game.training?.behavior === 'guard') {
    e.guarding = true;
    e.state = 'approach';
    e.face = angle(e.face, facing, Math.min(1, dt * 5));
    return;
  }
  if (e.state === 'approach') {
    e.face = angle(e.face, facing, Math.min(1, dt * 7));
    const side = e.flankSide || 1;
    const stop = e.type === 'bishop' ? 6 : st.range * 0.78;
    const pursuingFlask = !game.training && p.state === 'heal' && rule.pursuit > 1;
    let walk = 0,
      heading = facing;
    if (pursuingFlask && e.type !== 'bishop' && d > stop) {
      walk = rule.pursuit;
    } else if (e.type === 'bishop' && d < 4.5) {
      walk = 1;
      heading = facing + Math.PI;
    } else if (d > stop) {
      walk = 1;
      if ((e.type === 'knight' || e.role === 'flanker') && d > 2.8 && d < 8) heading += side * 0.62;
    } else if ((e.type === 'knight' || e.type === 'queen') && t < e.cooldown) {
      walk = 0.55;
      heading = facing + (side * Math.PI) / 2;
    }
    const bishop =
      e.type === 'rook'
        ? game.enemies
            .filter((a) => !a.dead && a.type === 'bishop')
            .sort((a, b) => distance(a, e) - distance(b, e))[0]
        : null;
    e.covering = null;
    if (bishop && distance(e, bishop) < 9 && d > st.range) {
      const dx = p.x - bishop.x,
        dz = p.z - bishop.z,
        length = Math.hypot(dx, dz) || 1;
      const screen = { x: bishop.x + (dx / length) * 2.4, z: bishop.z + (dz / length) * 2.4 };
      heading = Math.atan2(screen.x - e.x, screen.z - e.z);
      walk = distance(e, screen) > 0.65 ? 1 : 0;
      e.covering = bishop.id;
    }
    const pressured = game.enemies.some(
      (a) => a !== e && !a.dead && a.type === 'pawn' && a.state === 'windup' && a.targetId === p.id,
    );
    e.squadTell =
      e.type === 'knight' &&
      pressured &&
      p.state === 'walk' &&
      d < st.range &&
      t >= e.cooldown - 0.4;
    e.x +=
      Math.sin(heading) *
      st.speed *
      (t < (e.slowUntil || 0) ? 0.65 : 1) *
      rule.speed *
      (game.runModifier === 'relentless' ? 1.2 : 1) *
      walk *
      dt;
    e.z +=
      Math.cos(heading) *
      st.speed *
      (t < (e.slowUntil || 0) ? 0.65 : 1) *
      rule.speed *
      (game.runModifier === 'relentless' ? 1.2 : 1) *
      walk *
      dt;
    const active = game.enemies.filter(
      (a) => a !== e && !a.dead && ['windup', 'attack', 'ability'].includes(a.state),
    ).length;
    if (d < st.range && t >= e.cooldown - (e.squadTell ? 0.4 : 0) && active < rule.attackers)
      windup(false);
  } else if (e.state === 'windup') {
    // Track only the early tell. The final committed aim gives dodges a fair opening.
    if (t < e.begin + e.windupDuration * 0.48) {
      e.face = angle(e.face, facing, Math.min(1, dt * 5));
      e.target = { x: p.x, z: p.z };
    }
    if (t >= e.until) {
      e.state = 'attack';
      e.begin = t;
      e.activeHit = false;
      e.guarding = false;
      if (e.type === 'bishop') {
        const dirs = e.count % 2 === 0 ? [e.face - 0.26, e.face, e.face + 0.26] : [e.face];
        for (const a of dirs)
          game.projectiles.push({
            id: game.serial++,
            x: e.x + Math.sin(a),
            z: e.z + Math.cos(a),
            vx: Math.sin(a) * 7,
            vz: Math.cos(a) * 7,
            until: t + 4,
            source: e.id,
            damage: st.damage * rule.damage,
          });
        e.until = t + 0.3;
        game.emit('cast', { x: e.x, z: e.z });
      } else if (e.type === 'knight') {
        e.from = { x: e.x, z: e.z };
        e.until = t + 0.65;
      } else if (e.type === 'rook' && e.count % 2 === 0) {
        e.until = t + 0.85;
        e.charge = true;
      } else {
        e.until = t + 0.45;
        e.charge = false;
        game.emit('slam', { x: e.x, z: e.z, large: e.type === 'rook' || e.type === 'queen' });
      }
    }
  } else if (e.state === 'attack') {
    const elapsed = t - e.begin;
    if (e.type === 'knight') {
      const k = clamp(elapsed / 0.65, 0, 1);
      e.x = e.from.x + (e.target.x - e.from.x) * k;
      e.z = e.from.z + (e.target.z - e.from.z) * k;
      e.y = Math.sin(k * Math.PI) * 3.6;
      if (k > 0.85 && !e.activeHit) {
        e.activeHit = true;
        if (distance(e, p) < 2.5) game.hurtTarget(st.damage * rule.damage, e, p);
        game.emit('slam', { x: e.x, z: e.z, large: true });
      }
    } else if (e.charge) {
      e.x += Math.sin(e.face) * dt * 9;
      e.z += Math.cos(e.face) * dt * 9;
      if (!e.activeHit && distance(e, p) < 2) {
        game.hurtTarget(st.damage * rule.damage, e, p);
        e.activeHit = true;
      }
    } else if (e.type !== 'bishop' && !e.activeHit && elapsed > 0.1) {
      e.activeHit = true;
      const range = e.type === 'queen' ? 4.2 : e.type === 'rook' ? 3.7 : 2.8;
      const nx = (p.x - e.x) / (distance(e, p) || 1),
        nz = (p.z - e.z) / (distance(e, p) || 1);
      if (
        distance(e, p) < range &&
        (e.type === 'rook' ||
          e.type === 'queen' ||
          nx * Math.sin(e.face) + nz * Math.cos(e.face) > 0.2)
      )
        game.hurtTarget(st.damage * rule.damage, e, p);
    }
    if (t >= e.until) {
      e.y = 0;
      if (
        (e.type === 'queen' && (e.comboStep || 0) < 2) ||
        (['knight', 'bishop'].includes(e.champion) && (e.comboStep || 0) < 1) ||
        (e.rival && e.returning && (e.comboStep || 0) < 1)
      ) {
        e.comboStep = (e.comboStep || 0) + 1;
        windup(true);
      } else {
        e.comboStep = 0;
        e.state = 'recover';
        e.recoverAt = t;
        e.until =
          t +
          st.recover *
            rule.recovery *
            (e.champion || e.rival ? 1.5 : 1) *
            (game.runModifier === 'relentless' ? 0.8 : 1);
      }
    }
  } else if (e.state === 'recover' && t >= e.until) {
    e.state = 'approach';
    e.cooldown = t + 0.12;
  }
  game.clampActor(e);

  function windup(chain) {
    e.state = 'windup';
    e.unblockable = !!(e.rival && e.returning && e.adaptation === 'breaker' && chain);
    e.guarding = !!e.guardCapable && t >= (e.exposedUntil || 0);
    e.begin = t;
    e.windupDuration = Math.max(
      e.champion || e.rival ? 0.85 : 0.38,
      (chain ? 0.6 : st.windup) * rule.windup,
    );
    e.until = t + e.windupDuration;
    e.target = { x: p.x, z: p.z };
    e.targetId = p.id;
    e.activeHit = false;
    e.face = facing;
    if (!chain) {
      e.count++;
      e.comboStep = 0;
    }
    game.emit('windup', { id: e.id, kind: chain ? 'chain' : e.type, target: p.id });
    if (e.squadTell) game.emit('squadTell', { id: e.id, kind: 'pincer' });
    if (!game.training?.tutorial && !e.champion && !e.rival && !chain && e.count % 3 === 0)
      beginAbility(game, e, e.type, true);
  }
}
