import assert from 'node:assert/strict';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { captureRun, restoreRun, cleanRunSave, RunStore } from '../src/shared/run-save.mjs';
import { CURSES, activeRole, allyProtection } from '../src/shared/run-options.mjs';
import { updateArenaShifts } from '../src/shared/arena-shifts.mjs';
import { updateSecretCourt } from '../src/shared/secret-court.mjs';
import { bindTouchCamera } from '../src/client/touch-camera.mjs';
import { captureCheckpoint, restoreCheckpoint } from '../src/shared/checkpoints.mjs';
const fresh = () => {
  const g = new Game();
  g.reset();
  return g;
};
const sum = (g) => Object.values(g.upgrades).reduce((a, b) => a + b, 0);
// Exact suspension keeps attacks, projectiles, enemy tells, cooldowns and pending choices.
for (const mode of ['playing', 'route', 'promotion', 'event', 'upgrade']) {
  const g = fresh();
  g.curse = 'hollow';
  g.checkpointMode = 'fullrun';
  g.time = 36.75;
  g.hp = 37;
  g.stamina = 52;
  g.player.state = 'attack';
  g.player.attackEnd = 37.1;
  g.abilityReadyAt = 44;
  g.enemies[0].state = 'windup';
  g.enemies[0].until = 37.2;
  g.projectiles = [{ id: 'bolt', x: 1, z: 2, vx: 3, vz: 2, until: 40, damage: 20 }];
  if (mode !== 'playing') {
    g.wave = { route: 1, promotion: 2, event: 3, upgrade: 4 }[mode];
    g.beginIntermission();
    assert.equal(g.mode, mode);
  }
  const data = captureRun(g, g.mode, { yaw: 1.4, pitch: 8, zoom: 13 });
  assert(data);
  const h = fresh();
  assert.deepEqual(restoreRun(h, JSON.parse(JSON.stringify(data))), {
    yaw: 1.4,
    pitch: 8,
    zoom: 13,
  });
  for (const key of [
    'time',
    'hp',
    'stamina',
    'player',
    'enemies',
    'projectiles',
    'abilityReadyAt',
    'mode',
    'curse',
    'checkpointMode',
    'upgrades',
    'routeChoices',
    'promotionChoices',
    'eventChoices',
    'upgradeChoices',
  ])
    assert.deepEqual(h[key], g[key], key);
  const bad = structuredClone(data);
  bad.game.player.x = NaN;
  assert.equal(cleanRunSave(bad), null);
  bad.game.player.x = 0;
  bad.game.hp = -5;
  assert.equal(cleanRunSave(bad), null);
}
{
  const g = fresh(),
    mem = new Map(),
    storage = {
      getItem: (k) => mem.get(k),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
  const store = new RunStore(storage);
  assert(!store.available);
  assert(store.save(g, 'playing', {}));
  assert(new RunStore(storage).get());
  store.clear();
  assert(!store.available);
  assert.equal(store.get(), null);
  const blocked = new RunStore({
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('quota');
    },
  });
  assert.equal(blocked.save(g, 'playing', {}), false);
  g.training = {};
  assert.equal(captureRun(g), null);
  g.training = null;
  g.partners = [g];
  assert.equal(captureRun(g), null);
}
// Every normal intermission is one choice, including an extra champion blessing.
for (const piece of ['pawn', 'rook'])
  for (let wave = 1; wave <= 5; wave++) {
    const g = fresh();
    g.chessClass = piece;
    g.wave = wave;
    g.pendingBlessings = 1;
    g.beginIntermission();
    const t = g.time,
      before = sum(g);
    let clicks = 0;
    if (g.routeChoices.length) {
      g.chooseRoute('sanctuary');
      clicks++;
    } else if (g.promotionChoices.length) {
      g.choosePromotion('queen');
      clicks++;
    } else if (g.eventChoices.length) {
      g.chooseEvent('decline');
      clicks++;
    } else if (g.upgradeChoices.length) {
      g.chooseUpgrade(g.upgradeChoices[0]);
      clicks++;
    }
    assert(clicks <= 1);
    assert.equal(g.mode, 'playing');
    assert.equal(g.time, t);
    assert(sum(g) >= before);
    assert.equal(g.pendingBlessings, 0);
    assert.equal(
      g.routeChoices.length +
        g.promotionChoices.length +
        g.eventChoices.length +
        g.upgradeChoices.length,
      0,
    );
  }
for (const curse of CURSES) {
  const g = fresh();
  g.curse = curse.id;
  g.hp = 10;
  g.heal();
  assert.equal(g.hp, 10 + 48 * curse.heal);
}
{
  const g = fresh();
  g.curse = 'glass';
  g.hurtPlayer(20, { x: 0, z: 5 });
  assert.equal(g.hp, 75);
  g.curse = 'hollow';
  g.secretFound = true;
  g.checkpointMode = 'encounter';
  const c = captureCheckpoint(g);
  const h = fresh();
  assert(restoreCheckpoint(h, c));
  assert.equal(h.curse, 'hollow');
  assert.equal(h.secretFound, true);
  const b = new Battle('coop', [
    { coopRole: 'guardian', curse: 'blood' },
    { coopRole: 'controller', chessClass: 'bishop' },
  ]);
  assert.equal(activeRole(b.games[1]).id, 'controller');
  b.games[0].player.block = true;
  b.games[1].player.x = b.games[0].player.x + 2;
  assert.equal(allyProtection(b.games[1]), 0.8);
  b.games[1].hurtPlayer(20, { x: 0, z: 0 });
  assert.equal(b.games[1].hp, 84);
  const g2 = b.games[1];
  g2.player.state = 'ability';
  g2.hitEnemy(g2.enemies[0], 1);
  assert.equal(g2.enemies[0].slowUntil, g2.time + 2);
  b.resetRound();
  assert.equal(b.games[0].curse, 'blood');
  assert.equal(b.games[1].coopRole, 'controller');
  const v = new Battle('versus', [{ curse: 'blood', coopRole: 'guardian' }]);
  assert.equal(v.games[0].curse, 'none');
  assert.equal(activeRole(v.games[0]).id, 'balanced');
}
{
  const g = fresh();
  g.wave = 1;
  g.spawn();
  g.time = 10;
  g.player.x = -4;
  g.player.z = 1;
  updateArenaShifts(g);
  assert.equal(g.arenaShift.phase, 'warning');
  assert.equal(g.hp, 100);
  g.time = 12.1;
  updateArenaShifts(g);
  assert.equal(g.arenaShift.phase, 'warning');
  g.time = 12.3;
  updateArenaShifts(g);
  assert.equal(g.arenaShift.phase, 'active');
  assert(Math.hypot(g.player.x + 4, g.player.z - 1) >= 1.69);
  g.time = 21;
  updateArenaShifts(g);
  assert.equal(g.arenaShift, null);
  g.time = 32;
  updateArenaShifts(g);
  assert.equal(g.arenaShift.kind, 'collapse');
  g.player.x = -4;
  g.player.z = 1;
  g.time = 34.3;
  updateArenaShifts(g);
  assert.equal(g.hp, 78);
  const hp = g.hp;
  updateArenaShifts(g);
  assert.equal(g.hp, hp, 'collapse damage once');
  g.training = {};
  updateArenaShifts(g);
  assert.equal(g.arenaShift, null);
}
{
  const g = fresh();
  g.wave = 1;
  g.spawn();
  g.objective.progress = g.objective.goal;
  updateSecretCourt(g);
  assert(g.secretPortal);
  const n = g.enemies.length;
  for (let i = 0; i < 100; i++) updateSecretCourt(g, {}, 0.05);
  assert.equal(g.enemies.length, n, 'optional encounter stays optional');
  g.player.x = 8;
  g.player.z = 7;
  for (let i = 0; i < 14; i++) updateSecretCourt(g, { revive: true }, 0.05);
  assert(g.secretFound);
  assert.equal(g.enemies.length, n + 1);
  const e = g.enemies.at(-1);
  assert(e.secret);
  const souls = g.souls,
    flasks = g.flasks;
  g.hitEnemy(e, 10000);
  assert.equal(g.souls - souls, 350);
  assert.equal(g.flasks, flasks + 1);
  updateSecretCourt(g, { revive: true }, 1);
  assert.equal(g.enemies.length, n + 1, 'no duplicate Regent');
}
{
  const g = fresh();
  g.startBossRush();
  assert.equal(g.flasks, 2);
  g.hp = 41;
  const seen = [];
  for (let stage = 0; stage < 3; stage++) {
    seen.push(g.enemies.find((e) => e.boss).boss);
    g.arenaObjective = null;
    g.enemies.forEach((e) => (e.dead = true));
    g.clearAt = g.time + 0.01;
    g.update(0.02, { skipAI: true });
    assert.equal(g.hp, 41, 'rush never heals between bosses');
    assert.equal(g.flasks, 2);
    if (stage < 2) {
      assert.equal(g.mode, 'playing');
      assert.equal(g.routeChoices.length, 0);
      assert(captureRun(g));
    }
  }
  assert.deepEqual(seen, ['castellan', 'confessor', 'fallenking']);
  assert.equal(g.mode, 'won');
  assert.equal(g.bossRush.completed, 3);
  assert(g.bossRush.score > 0);
  assert(g.events.some((e) => e.type === 'end' && e.trial && e.rush));
}
{
  const events = {},
    surface = { addEventListener: (n, f) => (events[n] = f), setPointerCapture() {} },
    orbits = [],
    zooms = [];
  let now = 0;
  const t = bindTouchCamera(surface, {
    active: () => true,
    focus() {},
    orbit: (x, y) => orbits.push([x, y]),
    zoom: (r) => zooms.push(r),
    now: () => now,
  });
  const e = (id, x, y) => ({
    pointerType: 'touch',
    pointerId: id,
    clientX: x,
    clientY: y,
    preventDefault() {},
    stopPropagation() {},
  });
  t.down(e(1, 10, 10));
  t.move(e(1, 30, 15));
  assert.deepEqual(orbits.at(-1), [20, 5]);
  t.down(e(2, 130, 15));
  t.move(e(2, 150, 15));
  assert(zooms.at(-1) < 1);
  const count = orbits.length;
  t.up(e(2, 150, 15));
  t.move(e(1, 31, 16));
  assert.equal(orbits.length, count + 1);
  assert.deepEqual(orbits.at(-1), [1, 1]);
  assert(t.recentlyTouched);
  now = 801;
  assert(!t.recentlyTouched);
  t.clear();
  assert(!t.touching);
}
console.log(
  'PASS: exact run suspension/restore and storage failures; one-choice intermissions; curse tradeoffs; co-op roles and PvP isolation; warned arena collisions; optional Regent; three-boss limited-healing score; touch orbit/pinch/rebase.',
);
