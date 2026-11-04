import assert from 'node:assert/strict';
import { Game, stats } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import {
  restoreCheckpoint,
  captureCheckpoint,
  cleanCheckpoint,
} from '../src/shared/checkpoints.mjs';
import { ROUTES, updateChampionWards } from '../src/shared/routes.mjs';
import { difficultyById } from '../src/shared/combat-rules.mjs';
import { updateEnemy } from '../src/shared/enemy-ai.mjs';

function encounter(wave = 1) {
  const g = new Game();
  g.wave = wave;
  g.spawn();
  return g;
}

function blessings(g) {
  while (g.upgradeChoices.length) assert(g.chooseUpgrade(g.upgradeChoices[0]));
  if (g.promotionChoices.length) assert(g.choosePromotion('pawn'));
  if (g.eventChoices.length) assert(g.chooseEvent('decline'));
}

function advance(g) {
  g.enemies.forEach((e) => (e.dead = true));
  for (let i = 0; i < 160; i++) g.update(0.02);
}
for (const route of ROUTES) {
  const g = encounter();
  const count = g.enemies.length;
  g.hp = 40;
  g.flasks = 2;
  assert(g.offerRoutes());
  const time = g.time;
  g.update(2);
  assert.equal(g.time, time);
  assert(!g.chooseRoute('bad'));
  assert(g.chooseRoute(route.id));
  assert(!g.chooseRoute(route.id));
  assert.equal(g.mode, 'upgrade');
  blessings(g);
  assert.equal(g.mode, 'playing');
  if (route.id === 'sanctuary') {
    assert.equal(g.hp, 65);
    assert.equal(g.flasks, 3);
  }
  if (route.id === 'onslaught') assert.equal(g.enemies.length, count + 2);
  if (route.id === 'champion') assert(g.enemies.some((e) => e.champion === 'knight'));
  assert(!g.rewardRoute(), 'cannot claim before clearing');
  const souls = g.souls;
  g.enemies.forEach((e) => (e.dead = true));
  assert(g.rewardRoute());
  assert(!g.rewardRoute());
  assert.equal(g.souls - souls, route.id === 'champion' ? 200 : route.id === 'onslaught' ? 150 : 0);
  if (route.id === 'champion') {
    g.route = null;
    g.wave = 2;
    g.spawn();
    g.offerRoutes();
    g.chooseRoute('sanctuary');
    assert.equal(g.upgradePicks, 2);
    const first = g.upgradeChoices[0];
    g.chooseUpgrade(first);
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.upgradePicks, 1);
    blessings(g);
  }
}
// Save/retry must reproduce a branch, without granting entry resources again.
for (const id of ['champion', 'onslaught', 'sanctuary']) {
  const g = encounter(3);
  g.hp = 40;
  g.offerRoutes();
  g.chooseRoute(id);
  blessings(g);
  const c = JSON.parse(JSON.stringify(captureCheckpoint(g)));
  const h = new Game();
  assert(restoreCheckpoint(h, c));
  assert.equal(h.enemies.length, g.enemies.length);
  assert.equal(h.hp, g.hp);
  assert.equal(h.flasks, g.flasks);
  assert.equal(h.enemies.find((e) => e.champion)?.name, g.enemies.find((e) => e.champion)?.name);
  assert.equal(h.enemies.find((e) => e.champion)?.max, g.enemies.find((e) => e.champion)?.max);
  assert.equal(h.route.id, id);
  assert.equal(h.route.paid, false);
}
assert.equal(
  cleanCheckpoint({ ...captureCheckpoint(encounter()), route: { id: 'forged' } }).route,
  null,
);
for (const wave of [0, 4]) {
  const g = encounter(wave);
  assert(!g.offerRoutes());
  assert.equal(g.mode, 'upgrade');
}
{
  const g = encounter();
  g.training = {};
  assert(!g.offerRoutes());
}
{
  const g = encounter();
  g.bossTrial = true;
  assert(!g.offerRoutes());
}
// Champions are deterministic by formation and keep fair, committed attack windows.
for (const [wave, type] of [
  [1, 'knight'],
  [2, 'bishop'],
  [3, 'rook'],
]) {
  const g = encounter(wave);
  g.offerRoutes();
  g.chooseRoute('champion');
  blessings(g);
  const e = g.enemies.find((e) => e.champion);
  assert.equal(e.champion, type);
  assert(e.name && e.championHint);
  g.enemies = [e];
  g.player.x = 0;
  g.player.z = 0;
  e.x = 0;
  e.z = 2;
  e.cooldown = 0;
  e.face = Math.PI;
  const states = [];
  let windups = 0;
  let longestRecovery = 0;
  for (let i = 0; i < 550; i++) {
    const previous = e.state;
    g.time += 0.02;
    updateEnemy(g, e, 0.02, stats);
    assert([e.x, e.z, e.y, e.until].every(Number.isFinite));
    if (e.state === 'windup' && previous !== 'windup') {
      windups++;
      assert(e.windupDuration >= 0.75);
      states.push(e.state);
    }
    if (e.state === 'recover' && previous !== 'recover') {
      longestRecovery = Math.max(longestRecovery, e.until - g.time);
      states.push(e.state);
      break;
    }
  }
  assert(windups >= (type === 'rook' ? 1 : 2));
  assert(longestRecovery >= stats[type].recover * difficultyById(g.difficulty).recovery * 1.49);
}
// Marshal ward strips immediately on stagger, flank, death, or distance.
{
  const g = encounter(3);
  g.offerRoutes();
  g.chooseRoute('champion');
  blessings(g);
  const m = g.enemies[0],
    a = g.enemies[1];
  m.x = 0;
  m.z = 0;
  m.face = 0;
  m.guarding = true;
  a.x = 1;
  a.z = 0;
  updateChampionWards(g);
  assert(a.championWarded);
  m.state = 'stagger';
  updateChampionWards(g);
  assert(!a.championWarded);
  m.state = 'approach';
  m.guarding = true;
  g.player.x = 0;
  g.player.z = -1;
  g.hitEnemy(m, 1, 0);
  updateChampionWards(g);
  assert(!a.championWarded);
  assert(m.exposedUntil >= 2);
  g.time = 3;
  m.guarding = true;
  updateChampionWards(g);
  assert(a.championWarded);
  m.dead = true;
  updateChampionWards(g);
  assert(!a.championWarded);
  m.dead = false;
  a.x = 8;
  updateChampionWards(g);
  assert(!a.championWarded);
}
// Co-op: conflicting votes pause time, survive restoration and may be changed.
{
  let b = new Battle('coop');
  if (b.games[0].arenaObjective) b.games[0].arenaObjective.complete = true;
  b.games[0].enemies.forEach((e) => (e.dead = true));
  for (let i = 0; i < 150; i++) b.step(0.02);
  assert.equal(b.routeChoices.length, 3);
  const t = b.time;
  b.setInput(0, { actions: [{ n: 1, kind: 'route:champion' }] });
  b.setInput(1, { actions: [{ n: 1, kind: 'route:onslaught' }] });
  b.step(0.02);
  assert.equal(b.time, t);
  assert.deepEqual(b.routeVotes, ['champion', 'onslaught']);
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert.deepEqual(b.snapshot(0).routeVotes, ['champion', 'onslaught']);
  b.setInput(1, { actions: [{ n: 2, kind: 'route:champion' }] });
  b.step(0.02);
  assert.equal(b.routeChoices.length, 0);
  assert.equal(b.games[0].enemies.filter((e) => e.champion).length, 1);
  assert.equal(b.games[0].enemies, b.games[1].enemies);
  assert(
    b.games.every((g) => g.mode === 'playing'),
    'matching route resumes immediately',
  );
  assert.equal(b.time, t);
  b.inputs = [{}, {}];
  b.step(0.02);
  assert(b.time > t);
  const ranks = b.games.map((g) => Object.values(g.upgrades).reduce((a, b) => a + b, 0));
  if (b.games[0].arenaObjective) b.games[0].arenaObjective.complete = true;
  b.games[0].enemies.forEach((e) => (e.dead = true));
  for (let i = 0; i < 150; i++) b.step(0.02);
  assert(
    b.games.every((g) => g.pendingBlessings === 0),
    'champion bonus is automatic',
  );
  assert(b.games.every((g) => g.mode === 'promotion'));
  b.games.forEach((g, i) =>
    assert.equal(
      Object.values(g.upgrades).reduce((a, b) => a + b, 0),
      ranks[i] + 2,
    ),
  );
  b.setInput(0, { actions: [{ n: 4, kind: 'promote:rook' }] });
  b.setInput(1, { actions: [{ n: 4, kind: 'promote:bishop' }] });
  b.step(0.02);
  assert(b.games.every((g) => g.mode === 'playing'));
  const v = new Battle('versus');
  v.setInput(0, { actions: [{ n: 1, kind: 'route:champion' }] });
  v.step(0.02);
  assert(!v.routeChoices.length);
  assert(!v.games[0].route);
}
console.log(
  'PASS: route risk/rewards, duplicate prevention, extra blessings, deterministic checkpoint retries, champion tells/counters, co-op consensus/restore/barriers and versus isolation.',
);

{
  const b = new Battle('coop');
  let action = 1;
  for (let wave = 0; wave < 6; wave++) {
    assert.equal(b.wave, wave);
    if (b.games[0].arenaObjective) b.games[0].arenaObjective.complete = true;
    b.games[0].enemies.forEach((e) => (e.dead = true));
    for (let i = 0; i < 150; i++) b.step(0.02);
    if (wave === 5) break;
    if (b.routeChoices.length) {
      for (let seat = 0; seat < 2; seat++)
        b.setInput(seat, { actions: [{ n: action, kind: 'route:champion' }] });
      action++;
      b.step(0.02);
    }
    while (
      b.games.some(
        (g) => g.upgradeChoices.length || g.promotionChoices.length || g.eventChoices.length,
      )
    ) {
      for (let seat = 0; seat < 2; seat++)
        b.setInput(seat, {
          actions: [
            {
              n: action,
              kind: b.games[seat].eventChoices.length
                ? 'event:decline'
                : b.games[seat].promotionChoices.length
                  ? 'promote:pawn'
                  : 'upgrade:' + b.games[seat].upgradeChoices[0],
            },
          ],
        });
      action++;
      b.step(0.02);
    }
    assert(
      b.games.every((g) => g.mode === 'playing'),
      'both players leave intermission, including boss encounters',
    );
  }
  assert.equal(b.status, 'ended');
  assert.equal(b.winner, 'team');
  console.log(
    'PASS: complete co-op expedition through routes, extra blessings and both final bosses.',
  );
}
