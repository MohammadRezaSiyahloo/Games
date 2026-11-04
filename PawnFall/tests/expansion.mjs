import assert from 'node:assert/strict';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { WEAPONS, UPGRADES } from '../src/shared/arsenal.mjs';
import { Progression } from '../src/client/progression.mjs';
const step = (g, t, input = {}) => {
  for (let i = 0; i < Math.ceil(t / 0.02); i++) g.update(0.02, input);
};

function duel(weapon = 'longsword') {
  const g = new Game();
  g.reset();
  g.setWeapon(weapon);
  g.player.x = 0;
  g.player.z = 0;
  g.player.face = 0;
  g.enemies = [
    {
      id: 'target',
      type: 'rook',
      hp: 1000,
      max: 1000,
      x: 0,
      z: 2.4,
      y: 0,
      state: 'approach',
      cooldown: 999,
      face: 0,
      poise: 0,
      dead: false,
    },
  ];
  return g;
}
for (const w of WEAPONS) {
  const g = duel(w.id);
  g.enemies[0].z = Math.min(g.enemies[0].z, w.range - 0.3);
  assert(g.attack());
  assert.equal(g.stamina, 100 - w.cost);
  step(g, w.hitAt - 0.03);
  assert.equal(g.enemies[0].hp, 1000, 'no early hit');
  step(g, 0.04);
  assert.equal(g.enemies[0].hp, 1000 - w.damage, w.name + ' damage');
  assert.equal(g.player.attackDuration, w.duration);
  assert(!g.setWeapon('longsword'), 'cannot swap during combat');
}
{
  const g = duel();
  g.player.face = Math.PI / 2;
  g.enemies[0].x = 2;
  g.enemies[0].z = 0;
  g.hp = 50;
  g.upgrades.mercy = 1;
  g.update(0.02, { block: true });
  g.hurtPlayer(30, g.enemies[0]);
  assert.equal(g.hp, 60);
  assert(g.events.some((e) => e.type === 'parry'));
  assert.equal(g.enemies[0].state, 'stagger');
  g.player.invuln = 0;
  step(g, 0.3, { block: true });
  g.hurtPlayer(20, g.enemies[0]);
  assert(g.events.some((e) => e.type === 'block'));
  assert.equal(g.hp, 60, 'held guard is not repeated parry');
  g.player.invuln = 0;
  g.hurtPlayer(20, { x: -3, z: 0 });
  assert.equal(g.hp, 40, 'rear hits bypass guard');
}
{
  const g = duel('rapier');
  g.update(0.02, { block: true });
  g.hurtPlayer(20, g.enemies[0]);
  assert(g.attack());
  step(g, 0.15);
  assert.equal(g.enemies[0].hp, 947, 'rapier riposte multiplier');
  const old = g.enemies[0].hp;
  step(g, 0.4);
  g.attack();
  step(g, 0.15);
  assert.equal(old - g.enemies[0].hp, 23, 'riposte consumed once');
}
{
  const g = duel();
  g.update(0.02, { block: true });
  step(g, 0.22, { block: true });
  g.hurtPlayer(20, g.enemies[0]);
  assert(!g.events.some((e) => e.type === 'parry'), 'late guard blocks normally');
}
{
  const g = duel();
  g.upgrades.ember = 1;
  g.hitEnemy(g.enemies[0], 10);
  step(g, 3.1);
  assert.equal(g.enemies[0].hp, 978, 'burn ticks exactly three times');
  g.reset();
  assert.deepEqual(g.upgrades, {});
  assert.deepEqual(g.upgradeChoices, []);
}
for (let realm = 0; realm < 4; realm++) {
  const g = new Game();
  g.reset(realm);
  for (let wave = 0; wave < 5; wave++) {
    assert.equal(g.wave, wave);
    if (g.arenaObjective) g.arenaObjective.complete = true;
    for (const e of g.enemies) g.hitEnemy(e, 100000);
    step(g, 2.8);
    if (wave < 4) {
      const time = g.time;
      step(g, 5);
      assert.equal(g.time, time, 'intermission freezes combat');
      if (g.mode === 'route') assert(g.chooseRoute('sanctuary'));
      else if (g.mode === 'promotion') assert(g.choosePromotion('pawn'));
      else if (g.mode === 'event') assert(g.chooseEvent('decline'));
      else {
        assert.equal(g.mode, 'upgrade');
        assert.equal(new Set(g.upgradeChoices).size, 3);
        assert(!g.chooseUpgrade('invalid'));
        assert(g.chooseUpgrade(g.upgradeChoices[0]));
      }
      assert.equal(g.mode, 'playing', 'exactly one choice resumes the encounter');
    }
  }
  assert.equal(g.mode, 'won', 'all realms finish through upgrade transitions');
}
{
  const g = new Game();
  g.reset(1);
  g.wave = 4;
  g.spawn();
  const e = g.enemies[0];
  assert.equal(e.boss, 'confessor');
  e.cooldown = 0;
  g.update(0.02);
  assert.equal(e.state, 'windup');
  assert.equal(g.projectiles.length, 0);
  const target = { ...e.target };
  g.player.x = 9;
  step(g, 1);
  assert.deepEqual(e.target, target, 'fixed aim');
  step(g, 0.8);
  assert(g.projectiles.length >= 5, 'crossed volley');
  step(g, 0.6);
  assert(e.coreOpen, 'recovery window');
  e.state = 'approach';
  e.cooldown = 0;
  g.update(0.02);
  assert.equal(e.illusions.length, 2);
  assert.equal(e.attackKind, 'mirrors');
  assert.equal(g.nearest(), null, 'illusions disable auto targeting');
  e.hp = e.max * 0.49;
  g.update(0.02);
  assert.equal(e.phase, 2);
  assert.equal(e.state, 'enrage');
  assert.equal(e.illusions.length, 0);
  step(g, 2);
  e.cooldown = 0;
  g.update(0.02);
  step(g, 1.4);
  const serial = g.serial;
  step(g, 0.7);
  assert(g.serial > serial, 'second-phase extra volley');
}
{
  let b = new Battle('coop', [{ weapon: 'warhammer' }, { weapon: 'rapier' }]);
  assert.equal(b.games[0].weapon, 'warhammer');
  assert.equal(b.games[1].weapon, 'rapier');
  b.games[0].enemies.forEach((e) => (e.dead = true));
  for (let i = 0; i < 140; i++) b.step(0.02);
  assert.equal(b.routeChoices.length, 3);
  b.setInput(0, { actions: [{ n: 1, kind: 'route:sanctuary' }] });
  b.setInput(1, { actions: [{ n: 1, kind: 'route:sanctuary' }] });
  b.step(0.02);
  b.inputs = [{}, {}];
  b.acks = [0, 0];
  assert(
    b.games.every((g) => g.mode === 'playing'),
    'route completes the natural intermission',
  );
  // Exercise the standalone blessing API and server barrier independently.
  b.games.forEach((g) => g.offerUpgrades());
  assert(b.games.every((g) => g.mode === 'upgrade'));
  const time = b.time;
  const id = b.games[0].upgradeChoices[0];
  const beforeRank = b.games[0].upgrades[id] || 0;
  b.setInput(0, { actions: [{ n: 1, kind: 'upgrade:invalid' }] });
  b.step(0.02);
  assert.equal(b.games[0].mode, 'upgrade', 'unoffered choice rejected');
  b.setInput(0, { actions: [{ n: 2, kind: 'upgrade:' + id }] });
  b.step(0.02);
  assert.equal(b.games[0].upgrades[id], beforeRank + 1);
  assert.equal(b.time, time);
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  b.step(0.02);
  assert.equal(b.games[0].upgrades[id], beforeRank + 1, 'restored actions deduplicated');
  b.setInput(1, { actions: [{ n: 1, kind: 'upgrade:' + b.games[1].upgradeChoices[1] }] });
  b.step(0.02);
  assert.equal(b.time, time);
  b.games.forEach((g) => {
    if (g.eventChoices.length) g.chooseEvent('decline');
  });
  b.step(0.02);
  assert(b.time > time, 'resumes after both players choose');
  for (const wave of [3, 4]) {
    b.games[0].wave = wave;
    b.games[0].spawn();
    assert.equal(b.games[0].enemies[0].boss, wave === 3 ? 'castellan' : 'confessor');
    assert.equal(b.games[0].enemies[0].max, Math.round((wave === 3 ? 780 : 680) * 1.45));
  }
  const snap = b.snapshot(0);
  assert.equal(snap.players[1].weapon, 'rapier');
  assert(snap.players[0].upgrades[id]);
  const vs = new Battle('versus', [{ weapon: 'warhammer' }, { weapon: 'rapier' }]);
  vs.setInput(0, { actions: [{ n: 1, kind: 'upgrade:force' }] });
  vs.step(0.02);
  assert.deepEqual(vs.games[0].upgrades, {});
}
{
  const memory = new Map();
  memory.set(
    'pawnfall-profile-v4',
    JSON.stringify({ skin: 'ivory', stats: { kills: 9 }, completed: [], unlocked: [] }),
  );
  const p = new Progression({ getItem: (k) => memory.get(k), setItem: (k, v) => memory.set(k, v) });
  assert.equal(p.data.weapon, 'longsword');
  assert.equal(p.data.stats.kills, 9);
  p.event({ type: 'bossDefeated', boss: 'confessor' }, 'frost');
  assert(p.equip('pale'));
  assert(p.equipTitle('oracle'));
  assert.equal(p.data.stats.castellanKills, 0);
  for (let i = 0; i < 20; i++) p.event({ type: 'parry' });
  assert(p.equipTitle('counterblade'));
}
console.log(
  'PASS: all weapons, ripostes, directional parry timing, burn, run reset, all 20 encounters through upgrade choices, Confessor phases/illusions/volleys, co-op selection barrier/serialization/scaling, versus restrictions, older saves and rewards.',
);
